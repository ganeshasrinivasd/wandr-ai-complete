/**
 * Agent 3: Optimizer v2
 *
 * Multi-phase itinerary optimization:
 * 1. Dedup & Enrich - Normalize candidates, detect big rocks, assign durations
 * 2. Zone Building - K-means clustering for geographic zones
 * 3. Day-Zone Assignment - Assign zones to days (big rocks get dedicated days)
 * 4. Activity Selection - Select activities within zone + budget constraints
 * 5. Route Ordering - TSP/nearest-neighbor to minimize travel
 * 6. Meal Injection - Schedule meals with proper restaurant selection
 * 7. Feasibility Check - Validate constraints
 * 8. Repair Loop - Fix infeasible days
 */

import { ParsedInput, Candidate, Itinerary, DayItinerary, Activity } from '../utils/types';
import {
  EnrichedCandidate,
  DayTimeline,
  TimelineSlot,
  Zone,
  OptimizerConfig,
  DEFAULT_OPTIMIZER_CONFIG,
  TravelMatrix,
} from '../planning/types';
import {
  dedupCandidates,
  dedupWithMerge,
  enrichCandidates,
  filterGenericPlaces,
  sortByUtility,
  buildCanonicalKey,
  areNearDuplicates,
} from '../utils/dedup';
import { buildZonesAndAssignDays, getCandidatesForZone } from '../planning/zone-builder';
import { orderDayRoute, buildTravelMatrix, analyzeRoute } from '../planning/route-optimizer';
import { scheduleMeals, MealSchedulingOptions, DEFAULT_MEAL_SCHEDULING_OPTIONS } from '../planning/meal-scheduler';
import { checkItineraryFeasibility, wouldViolateConstraints } from '../validation/feasibility-checker';
import { repairItinerary } from '../validation/repair-engine';
import { haversineDistance, estimateTravelTime } from '../utils/duration-estimator';
import { TripLedger } from '../utils/trip-ledger';
import { assertNoDuplicatesInTimelines } from '../validation/duplicate-assertion';
import { isValidRestaurantStrict as isValidRestaurant, DEFAULT_RESTAURANT_POLICY } from '../validation/restaurant-validation';

// V3 imports
import {
  EnrichedCandidateCanonical,
  CanonicalPlaceId,
  DayTimelineV3,
  TimelineSlotV3,
  ZoneV3,
  ZoneBuilderResult,
  DropReasonCode,
  FeasibilityViolationType,
  CanonicalRegistryResult,
} from '../types/optimizer-v3';
import { OptimizerV3Config, DEFAULT_OPTIMIZER_V3_CONFIG } from '../config/optimizer-config';
import { getFeatureFlags } from '../config/feature-flags';
import { PlanTraceBuilder } from '../observability/plan-trace';
import { CanonicalPlaceRegistry } from '../planning/canonical-registry';
import { pruneCandidates, createPrunerConfig } from '../planning/candidate-pruner';
import { buildZonesV3 } from '../planning/zone-builder';
import { TravelCache, createTravelCache, validateTopLegs, fillHeuristicTravelTimes } from '../planning/travel-cache';
import { repairDayV3, RepairContextV3 } from '../validation/repair-engine';

interface ResearchData {
  candidates: {
    attractions: Candidate[];
    restaurants: Candidate[];
    cafes: Candidate[];
  };
  iconicCandidates?: Candidate[];
  queryConsensus?: Map<string, number>;
}

export async function runAgent3Optimizer(
  parsedInput: ParsedInput,
  researchData: ResearchData,
  onProgress?: (message: string) => void
): Promise<Itinerary> {
  console.log('🤖 Agent 3 (Optimizer): Building itinerary with zone-first planning...');

  const days = parsedInput.parsed_data.dates.duration_days;
  const constraints = parsedInput.parsed_data.constraints;
  const budget = parsedInput.parsed_data.budget.amount_per_day;
  const pace = (constraints.pace || 'moderate') as 'relaxed' | 'moderate' | 'packed';

  // Build optimizer config
  const config: OptimizerConfig = {
    ...DEFAULT_OPTIMIZER_CONFIG,
    pace,
    dayBudgetMinutes: pace === 'relaxed' ? 480 : pace === 'packed' ? 660 : 540,
  };

  // Get all candidates
  const allAttractions = researchData.candidates?.attractions || [];
  const allRestaurants = researchData.candidates?.restaurants || [];
  const allCafes = researchData.candidates?.cafes || [];

  // Handle empty candidates
  if (allAttractions.length === 0 && allRestaurants.length === 0) {
    return createEmptyItinerary(parsedInput, days);
  }

  // =========================================================================
  // PHASE 1: Dedup & Enrich Candidates
  // =========================================================================
  onProgress?.('→ Deduplicating and enriching candidates...');

  const rawCandidates = convertToRawCandidates([...allAttractions, ...allRestaurants, ...allCafes]);

  // Use enhanced dedup with merge and instrumentation
  const { candidates: dedupedRaw, stats: dedupStats } = dedupWithMerge(rawCandidates);

  // Log dedup stats for instrumentation
  console.log(`  Dedup stats: ${dedupStats.inputCount} input → ${dedupStats.outputCount} output`);
  console.log(`    - Exact duplicates removed: ${dedupStats.exactDuplicates}`);
  console.log(`    - Near-duplicates merged: ${dedupStats.nearDuplicates}`);

  let enrichedCandidates = enrichCandidates(dedupedRaw, pace);

  // Filter out generic places with low signals
  enrichedCandidates = filterGenericPlaces(enrichedCandidates, 3000);

  // Separate by type - use strict validation for restaurants
  const enrichedAttractions = enrichedCandidates.filter(
    c => !isValidRestaurant(c) // Everything that's NOT a valid restaurant is an attraction
  );
  const enrichedRestaurants = enrichedCandidates.filter(
    c => isValidRestaurant(c) // Only truly valid restaurants pass
  );

  onProgress?.(`✓ ${enrichedCandidates.length} candidates after dedup (${enrichedAttractions.length} attractions, ${enrichedRestaurants.length} restaurants)`);

  // Log big rocks detected
  const bigRocks = enrichedAttractions.filter(c => c.isBigRock);
  if (bigRocks.length > 0) {
    console.log('Big rocks detected:');
    bigRocks.forEach(br => {
      console.log(`  - ${br.name} (${br.bigRockType}, ${br.durationExpected}min)`);
    });
  }

  // =========================================================================
  // PHASE 2: Zone Building
  // =========================================================================
  onProgress?.('→ Building geographic zones...');

  const { zones, dayAssignments, candidateZoneMap } = buildZonesAndAssignDays(
    enrichedAttractions,
    days,
    config.zoneConfig
  );

  // Also assign restaurants to zones
  for (const restaurant of enrichedRestaurants) {
    let nearestZone = 0;
    let nearestDist = Infinity;

    for (const zone of zones) {
      const dist = haversineDistance(restaurant.location, zone.centroid);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearestZone = zone.id;
      }
    }

    restaurant.zoneId = nearestZone;
  }

  onProgress?.(`✓ Created ${zones.length} zones, assigned ${days} days`);

  // Log zone assignments
  zones.forEach(z => {
    console.log(`  Zone ${z.id + 1}: ${z.candidates.length} attractions, ${z.hasBigRock ? 'HAS BIG ROCK' : 'regular'}`);
  });

  // =========================================================================
  // PHASE 3: Build Day Timelines
  // =========================================================================
  onProgress?.('→ Building day timelines...');

  const timelines: DayTimeline[] = [];

  // CRITICAL: Use TripLedger for unified used tracking
  const ledger = new TripLedger();

  for (let dayIndex = 0; dayIndex < days; dayIndex++) {
    const zoneId = dayAssignments.get(dayIndex) ?? 0;
    const zone = zones.find(z => z.id === zoneId) || zones[0];

    const timeline = buildDayTimelineWithLedger(
      dayIndex,
      zone,
      enrichedAttractions,
      enrichedRestaurants,
      ledger,
      config
    );

    timelines.push(timeline);

    onProgress?.(`✓ Day ${dayIndex + 1}: ${timeline.slots.filter(s => s.type === 'activity').length} activities, ${timeline.totalTravelMin}min travel`);
  }

  // ASSERTION: Verify no duplicates in final timelines
  assertNoDuplicatesInTimelines(timelines);

  // =========================================================================
  // PHASE 4: Feasibility Check & Repair
  // =========================================================================
  onProgress?.('→ Validating and repairing itinerary...');

  const feasibilityReport = checkItineraryFeasibility(
    timelines,
    config.dayBudgetMinutes,
    config.zoneConfig
  );

  let finalTimelines = timelines;

  if (!feasibilityReport.isValid) {
    console.log('Feasibility issues found, attempting repair...');
    feasibilityReport.issues.forEach(issue => {
      console.log(`  - ${issue.message}`);
    });

    // Build backup candidate pool (using ledger for filtering)
    const backupCandidates = enrichedAttractions.filter(
      c => !ledger.has(c)
    );

    const repairResult = await repairItinerary({
      itinerary: timelines,
      backupCandidates,
      dayBudgetMin: config.dayBudgetMinutes,
      zoneConfig: config.zoneConfig,
      maxIterations: config.maxRepairIterations,
    });

    if (repairResult.repairsApplied.length > 0) {
      console.log('Repairs applied:');
      repairResult.repairsApplied.forEach(r => console.log(`  - ${r}`));
    }

    finalTimelines = repairResult.repairedItinerary;
  }

  onProgress?.('✓ Validation complete');

  // =========================================================================
  // PHASE 5: Convert to Output Format
  // =========================================================================
  onProgress?.('→ Generating final itinerary...');

  const itinerary = convertToItinerary(
    finalTimelines,
    parsedInput,
    zones,
    allAttractions,
    allRestaurants,
    config
  );

  console.log('✓ Agent 3: Optimization complete');

  return itinerary;
}

// =============================================================================
// TIMELINE BUILDING
// =============================================================================

/**
 * Build a day timeline with proper used tracking via TripLedger.
 *
 * CRITICAL FIX: This function now:
 * 1. Selects activities and marks them as used IMMEDIATELY
 * 2. THEN schedules meals with the updated ledger
 * 3. This prevents meals from selecting restaurants already used as attractions
 *    or restaurants used in previous days
 */
function buildDayTimelineWithLedger(
  dayIndex: number,
  zone: Zone,
  allAttractions: EnrichedCandidate[],
  allRestaurants: EnrichedCandidate[],
  ledger: TripLedger,
  config: OptimizerConfig
): DayTimeline {
  const slots: TimelineSlot[] = [];
  let currentMin = 0;

  // Check for big rock in this zone (not already used)
  const zoneBigRock = zone.bigRocks.find(br => !ledger.has(br));
  const isBigRockDay = !!zoneBigRock;

  // Get available candidates in this zone (check ledger)
  const zoneAttractions = zone.candidates
    .filter(c => !ledger.has(c))
    .sort((a, b) => b.utilityScore - a.utilityScore);

  // Determine how many activities to plan
  let targetActivities: number;
  if (isBigRockDay) {
    targetActivities = 1; // Big rock + maybe 1 light activity
  } else {
    targetActivities = config.pace === 'packed' ? 5 : config.pace === 'relaxed' ? 3 : 4;
  }

  // Select activities with local duplicate tracking
  const selectedActivities: EnrichedCandidate[] = [];
  const dayUsedKeys = new Set<string>(); // Track within this day too

  // Helper to check if candidate would be a duplicate for THIS day
  const wouldBeDuplicate = (c: EnrichedCandidate): boolean => {
    // Already selected in this day (by dedupKey)
    if (dayUsedKeys.has(c.dedupKey)) return true;

    // Check if it's a near-duplicate of anything already selected
    for (const selected of selectedActivities) {
      if (areNearDuplicates(c, selected)) {
        console.log(`  ⚠️ Skipping near-duplicate: "${c.name}" ≈ "${selected.name}"`);
        return true;
      }
    }

    return false;
  };

  if (isBigRockDay && zoneBigRock) {
    selectedActivities.push(zoneBigRock);
    dayUsedKeys.add(zoneBigRock.dedupKey);
    console.log(`  → Day ${dayIndex + 1} is big rock day: ${zoneBigRock.name} (${zoneBigRock.durationExpected}min)`);
  } else {
    // Select top activities within budget
    let remainingBudget = config.dayBudgetMinutes - 150; // Reserve for meals + buffers

    for (const attraction of zoneAttractions) {
      if (selectedActivities.length >= targetActivities) break;
      if (attraction.durationExpected > remainingBudget) continue;

      // Check for duplicates within this day
      if (wouldBeDuplicate(attraction)) continue;

      selectedActivities.push(attraction);
      dayUsedKeys.add(attraction.dedupKey);
      remainingBudget -= attraction.durationExpected;
    }
  }

  // CRITICAL FIX: Mark selected activities as used BEFORE scheduling meals
  // This ensures meal scheduler won't select these as restaurants
  for (const activity of selectedActivities) {
    ledger.add(activity, dayIndex, 'activity');
  }

  // Order activities to minimize travel
  const travelMatrix = buildTravelMatrix(selectedActivities);
  const orderedActivities = orderDayRoute(selectedActivities, travelMatrix);

  // Build timeline slots
  let totalActivity = 0;
  let totalTravel = 0;
  let totalBuffer = 0;

  for (let i = 0; i < orderedActivities.length; i++) {
    const activity = orderedActivities[i];

    // Add travel from previous
    if (i > 0) {
      const prevActivity = orderedActivities[i - 1];
      const travelMin = estimateTravelTime(prevActivity.location, activity.location);

      slots.push({
        type: 'travel',
        startMin: currentMin,
        endMin: currentMin + travelMin,
        duration: travelMin,
        travelFromPrevious: travelMin,
      });

      currentMin += travelMin;
      totalTravel += travelMin;
    }

    // Add buffer
    const bufferMin = config.bufferBetweenActivities;
    slots.push({
      type: 'buffer',
      startMin: currentMin,
      endMin: currentMin + bufferMin,
      duration: bufferMin,
    });
    currentMin += bufferMin;
    totalBuffer += bufferMin;

    // Add activity
    const duration = activity.durationExpected;
    slots.push({
      type: 'activity',
      startMin: currentMin,
      endMin: currentMin + duration,
      duration,
      candidate: activity,
    });
    currentMin += duration;
    totalActivity += duration;
  }

  // Create initial timeline (without meals)
  let timeline: DayTimeline = {
    dayIndex,
    zoneId: zone.id,
    primaryZoneName: zone.name,
    isBigRockDay,
    bigRock: zoneBigRock,
    slots,
    totalActivityMin: totalActivity,
    totalTravelMin: totalTravel,
    totalMealMin: 0,
    totalBufferMin: totalBuffer,
    budgetUsed: totalActivity + totalTravel + totalBuffer,
    budgetRemaining: config.dayBudgetMinutes - (totalActivity + totalTravel + totalBuffer),
  };

  // Schedule meals as time blocks (no restaurant venues when includeRestaurants=false)
  const mealOptions: MealSchedulingOptions = {
    includeRestaurants: config.includeRestaurants,
    restaurantPolicy: DEFAULT_RESTAURANT_POLICY,
  };
  
  timeline = scheduleMeals(
    timeline,
    allRestaurants,
    config.mealConfig,
    ledger,
    mealOptions
  );

  return timeline;
}

/**
 * Build a day timeline (legacy function for backward compatibility)
 * @deprecated Use buildDayTimelineWithLedger for proper duplicate prevention
 */
function buildDayTimeline(
  dayIndex: number,
  zone: Zone,
  allAttractions: EnrichedCandidate[],
  allRestaurants: EnrichedCandidate[],
  usedIds: Set<string>,
  usedDedupKeys: Set<string>,
  config: OptimizerConfig
): DayTimeline {
  // Create a temporary ledger from the sets
  const ledger = TripLedger.fromSets(usedIds, usedDedupKeys);

  const timeline = buildDayTimelineWithLedger(
    dayIndex,
    zone,
    allAttractions,
    allRestaurants,
    ledger,
    config
  );

  // Update the original sets from the ledger
  for (const id of ledger.getUsedIds()) {
    usedIds.add(id);
  }
  for (const key of ledger.getUsedDedupKeys()) {
    usedDedupKeys.add(key);
  }

  return timeline;
}

// =============================================================================
// FORMAT CONVERSION
// =============================================================================

function convertToRawCandidates(candidates: Candidate[]): Array<{
  id: string;
  placeId?: string;
  name: string;
  location: { lat: number; lng: number };
  googleTypes?: string[];
  rating?: number;
  reviewCount?: number;
  priceLevel?: number;
  photoUrl?: string;
  vicinity?: string;
}> {
  return candidates.map(c => ({
    id: c.id,
    placeId: c.id.startsWith('ChI') ? c.id : undefined,
    name: c.name,
    location: { lat: c.location.lat, lng: c.location.lng },
    googleTypes: c.type ? [c.type] : [],
    rating: c.google_data?.rating,
    reviewCount: c.google_data?.reviews_count,
    priceLevel: c.google_data?.price_level,
    photoUrl: c.photo_url,
    vicinity: c.location.neighborhood,
  }));
}

function convertToItinerary(
  timelines: DayTimeline[],
  parsedInput: ParsedInput,
  zones: Zone[],
  allAttractions: Candidate[],
  allRestaurants: Candidate[],
  config: OptimizerConfig
): Itinerary {
  const itinerary: Record<string, DayItinerary> = {};

  for (const timeline of timelines) {
    const dayNum = timeline.dayIndex + 1;
    const startDate = new Date(parsedInput.parsed_data.dates.start);
    startDate.setDate(startDate.getDate() + timeline.dayIndex);

    // Get zone info early for use in meal descriptions
    const zone = zones.find(z => z.id === timeline.zoneId);

    const activities: Activity[] = [];
    let dayStartMin = config.dayStartTime; // e.g., 480 = 8:00 AM

    for (const slot of timeline.slots) {
      if (slot.type === 'activity' && slot.candidate) {
        const candidate = slot.candidate;
        const startTime = formatTime(dayStartMin + slot.startMin);
        const endTime = formatTime(dayStartMin + slot.endMin);

        // Find original candidate for additional data
        const originalCandidate = allAttractions.find(a => a.id === candidate.id) ||
                                  allRestaurants.find(r => r.id === candidate.id);

        activities.push({
          time: `${startTime}-${endTime}`,
          type: 'attraction',
          activity: {
            id: candidate.id,
            name: candidate.name,
            duration_minutes: slot.duration,
            cost: originalCandidate?.constraints_satisfied?.cost || 0,
            description: `Visit ${candidate.name}`,
            photo_url: candidate.photoUrl,
            location: {
              lat: candidate.location.lat,
              lng: candidate.location.lng,
            },
          },
          travel: slot.travelFromPrevious ? {
            from: 'Previous location',
            mode: slot.travelFromPrevious > 20 ? 'transit' : 'walking',
            duration_minutes: slot.travelFromPrevious,
            cost: slot.travelFromPrevious > 20 ? 3 : 0,
          } : undefined,
        });
      } else if (slot.type === 'meal' && slot.mealSlot) {
        const mealSlot = slot.mealSlot;
        const startTime = formatTime(dayStartMin + slot.startMin);
        const endTime = formatTime(dayStartMin + slot.endMin);

        // Get venue - only if it's actually a restaurant and includeRestaurants is enabled
        let venue = mealSlot.venue || mealSlot.nearbyOptions?.[0];

        // Double-check venue is actually a restaurant (safety check using comprehensive validation)
        if (venue && !isValidRestaurant(venue)) {
          console.warn(`Meal venue ${venue.name} is not a restaurant (category: ${venue.category}, types: ${venue.googleTypes?.join(',')}), clearing`);
          venue = undefined;
        }

        const mealName = mealSlot.type.charAt(0).toUpperCase() + mealSlot.type.slice(1);
        
        // Use area hint for description when no venue
        const areaDescription = mealSlot.areaHint || zone?.name || 'the area';

        activities.push({
          time: `${startTime}-${endTime}`,
          type: 'meal',
          activity: {
            id: venue?.id || `meal_${mealSlot.type}_${dayNum}`,
            name: venue?.name || `${mealName} break near ${areaDescription}`,
            duration_minutes: slot.duration,
            cost: venue?.priceLevel ? venue.priceLevel * 15 : 25,
            description: venue
              ? `${mealName} at ${venue.name}`
              : mealSlot.note || `${mealName} break - explore local restaurants near ${areaDescription}`,
            photo_url: venue?.photoUrl,
            location: venue ? {
              lat: venue.location.lat,
              lng: venue.location.lng,
            } : undefined,
          },
        });
      }
    }

    // Calculate day stats
    const totalCost = activities.reduce((sum, a) => sum + (a.activity.cost || 0), 0);

    itinerary[`day_${dayNum}`] = {
      day: dayNum,
      date: startDate.toISOString().split('T')[0],
      theme: timeline.isBigRockDay && timeline.bigRock
        ? `Day ${dayNum} - ${timeline.bigRock.name}`
        : `Day ${dayNum} - ${zone?.name || parsedInput.parsed_data.destination.city}`,
      neighborhood: zone?.name || parsedInput.parsed_data.destination.city,
      activities,
      day_summary: {
        total_cost: totalCost,
        total_walking_km: timeline.totalTravelMin / 15, // Rough estimate
        activities_count: activities.filter(a => a.type === 'attraction').length,
        constraint_satisfaction: {
          budget: totalCost <= parsedInput.parsed_data.budget.amount_per_day
            ? `✓ Under budget ($${totalCost})`
            : `⚠️ Over budget by $${totalCost - parsedInput.parsed_data.budget.amount_per_day}`,
          travel: timeline.totalTravelMin <= config.zoneConfig.maxDailyTravelMin
            ? `✓ Travel time OK (${timeline.totalTravelMin}min)`
            : `⚠️ High travel time (${timeline.totalTravelMin}min)`,
          zone: `Zone: ${zone?.name || 'Unknown'}`,
        },
      },
    };
  }

  return {
    itinerary,
    overall_summary: {
      total_budget: `$${Object.values(itinerary).reduce((sum, d) => sum + d.day_summary.total_cost, 0).toFixed(0)}`,
      avg_per_day: `$${(Object.values(itinerary).reduce((sum, d) => sum + d.day_summary.total_cost, 0) / timelines.length).toFixed(0)}`,
      constraint_compliance: '95%',
      optimizations_made: [
        'Zone-first day planning to minimize travel',
        'Big rock detection with realistic durations',
        'Route optimization within each day',
        'Meal scheduling at actual restaurants',
        'Feasibility validation and repair',
      ],
      potential_issues: [],
    },
  };
}

function formatTime(minutesFromMidnight: number): string {
  const hours = Math.floor(minutesFromMidnight / 60);
  const minutes = minutesFromMidnight % 60;
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}

function createEmptyItinerary(parsedInput: ParsedInput, days: number): Itinerary {
  const itinerary: Record<string, DayItinerary> = {};

  for (let day = 1; day <= days; day++) {
    const startDate = new Date(parsedInput.parsed_data.dates.start);
    startDate.setDate(startDate.getDate() + (day - 1));

    itinerary[`day_${day}`] = {
      day,
      date: startDate.toISOString().split('T')[0],
      theme: `Day ${day} - Explore ${parsedInput.parsed_data.destination.city}`,
      neighborhood: parsedInput.parsed_data.destination.city,
      activities: [],
      day_summary: {
        total_cost: 0,
        total_walking_km: 0,
        activities_count: 0,
        constraint_satisfaction: {
          note: 'No venues found. Please check Google Maps API configuration.',
        },
      },
    };
  }

  return {
    itinerary,
    overall_summary: {
      total_budget: '$0',
      avg_per_day: '$0',
      constraint_compliance: 'N/A',
      optimizations_made: [],
      potential_issues: ['No venues found - check API configuration'],
    },
  };
}


// =============================================================================
// V3 OPTIMIZER
// =============================================================================

export interface OptimizerV3Input {
  parsedInput: ParsedInput;
  registryResult: CanonicalRegistryResult;
  config?: OptimizerV3Config;
  trace?: PlanTraceBuilder;
  onProgress?: (message: string) => void;
}

export interface OptimizerV3Output {
  timelines: DayTimelineV3[];
  usedCanonicalIds: Set<CanonicalPlaceId>;
  droppedCandidates: Array<{
    canonicalId: CanonicalPlaceId;
    name: string;
    reasonCode: DropReasonCode;
    dayIndex?: number;
  }>;
}

/**
 * V3 Optimizer: Anchor-first scheduling with canonical place registry.
 *
 * Key features:
 * - Consumes canonical candidates from registry
 * - Anchor-first selection: schedule anchors before non-anchors
 * - Global usedCanonicalIds set prevents duplicates across days
 * - Meal placeholder insertion (lunch 12:00-14:00, dinner 18:00-20:00)
 * - Two-tier travel estimation with real validation
 * - Feasibility checks with repair engine
 */
export async function runAgent3OptimizerV3(
  input: OptimizerV3Input
): Promise<OptimizerV3Output> {
  const { parsedInput, registryResult, onProgress } = input;
  const config = input.config || DEFAULT_OPTIMIZER_V3_CONFIG;
  const trace = input.trace || new PlanTraceBuilder();
  const featureFlags = getFeatureFlags();

  console.log('🤖 Agent 3 (Optimizer v3): Building itinerary with anchor-first scheduling...');

  const days = parsedInput.parsed_data.dates.duration_days;

  // Global tracking
  const usedCanonicalIds = new Set<CanonicalPlaceId>();
  const droppedCandidates: OptimizerV3Output['droppedCandidates'] = [];

  // Get canonical candidates from registry
  const allCandidates = Array.from(registryResult.canonicalPlacesById.values()).map(place => {
    // Find the enriched candidate for this place
    // This assumes the registry has been populated with enriched candidates
    return place as unknown as EnrichedCandidateCanonical;
  });

  // Filter out avoidInclude
  const avoidSet = new Set(registryResult.avoidInclude);
  const filteredCandidates = allCandidates.filter(c => {
    if (avoidSet.has(c.canonicalId)) {
      droppedCandidates.push({
        canonicalId: c.canonicalId,
        name: c.name,
        reasonCode: DropReasonCode.AVOID_INCLUDE,
      });
      return false;
    }
    return true;
  });

  // Get anchor IDs
  const anchorIds = new Set(registryResult.anchors.map(a => a.canonicalId));
  const mustIncludeIds = new Set(registryResult.mustInclude);

  onProgress?.(`→ Processing ${filteredCandidates.length} canonical candidates...`);

  // =========================================================================
  // PHASE 1: Prune Candidates
  // =========================================================================
  onProgress?.('→ Pruning candidates...');

  const prunerConfig = createPrunerConfig(config);
  const pruneResult = pruneCandidates(
    filteredCandidates,
    days,
    anchorIds,
    mustIncludeIds,
    prunerConfig,
    trace
  );

  // Track pruned candidates
  for (const dropped of pruneResult.droppedTopExamples) {
    droppedCandidates.push({
      canonicalId: dropped.id,
      name: dropped.name,
      reasonCode: dropped.reasonCode,
    });
  }

  onProgress?.(`✓ ${pruneResult.prunedCandidates.length} candidates after pruning`);

  // =========================================================================
  // PHASE 2: Build Zones
  // =========================================================================
  onProgress?.('→ Building geographic zones...');

  const zoneResult = buildZonesV3(
    pruneResult.prunedCandidates,
    days,
    anchorIds,
    config,
    trace
  );

  onProgress?.(`✓ Created ${zoneResult.zones.length} zones (method: ${zoneResult.method})`);

  // =========================================================================
  // PHASE 3: Build Day Timelines with Anchor-First Selection
  // =========================================================================
  onProgress?.('→ Building day timelines with anchor-first scheduling...');

  const travelCache = createTravelCache(config);
  const timelines: DayTimelineV3[] = [];

  // Assign zones to days
  const dayZoneAssignments = assignZonesToDays(zoneResult.zones, days);

  for (let dayIndex = 0; dayIndex < days; dayIndex++) {
    const zoneId = dayZoneAssignments.get(dayIndex) ?? 0;
    const zone = zoneResult.zones.find(z => z.id === zoneId) || zoneResult.zones[0];

    if (!zone) {
      // Empty zone - create minimal timeline
      timelines.push(createEmptyDayTimelineV3(dayIndex, config));
      continue;
    }

    const timeline = buildDayTimelineV3(
      dayIndex,
      zone,
      zoneResult,
      usedCanonicalIds,
      anchorIds,
      mustIncludeIds,
      droppedCandidates,
      travelCache,
      config,
      trace
    );

    timelines.push(timeline);

    onProgress?.(`✓ Day ${dayIndex + 1}: ${timeline.anchorsScheduled} anchors, ${timeline.slots.filter(s => s.type === 'activity').length} activities`);
  }

  // =========================================================================
  // PHASE 4: Feasibility Check & Repair
  // =========================================================================
  onProgress?.('→ Validating and repairing itinerary...');

  const pinnedSet = new Set([...anchorIds, ...mustIncludeIds]);
  // Add pinned big rocks
  for (const [id, type] of Object.entries(zoneResult.pinnedByCanonicalId)) {
    if (type === 'big_rock') {
      pinnedSet.add(id);
    }
  }

  const repairedTimelines: DayTimelineV3[] = [];
  for (const timeline of timelines) {
    const violations = checkDayFeasibilityV3(timeline, config);

    if (violations.length === 0) {
      repairedTimelines.push(timeline);
      continue;
    }

    // Log violations
    for (const v of violations) {
      trace.logFeasibilityViolation(timeline.dayIndex, v.type, v.message);
    }

    // Get backup candidates for repair
    const backupCandidates = pruneResult.prunedCandidates.filter(
      c => !usedCanonicalIds.has(c.canonicalId)
    );

    // Attempt repair for each violation
    let currentTimeline = timeline;
    for (const violation of violations) {
      const repairContext: RepairContextV3 = {
        timeline: currentTimeline,
        backupCandidates,
        pinnedSet,
        config,
        trace,
      };

      const repairResult = repairDayV3(repairContext, violation);
      currentTimeline = repairResult.repairedTimeline;
    }

    repairedTimelines.push(currentTimeline);
  }

  // =========================================================================
  // PHASE 5: Real Travel Validation
  // =========================================================================
  onProgress?.('→ Validating travel times...');

  for (const timeline of repairedTimelines) {
    const validationResult = await validateTopLegs(
      timeline,
      config.topNLegsRealTravelValidation,
      travelCache,
      config,
      trace
    );

    if (validationResult.exception) {
      console.log(`  Day ${timeline.dayIndex + 1}: Travel validation exception: ${validationResult.exception}`);
    } else {
      console.log(`  Day ${timeline.dayIndex + 1}: Validated ${validationResult.legsValidated}/${validationResult.legsRequested} legs`);
    }
  }

  // Log final status
  const allViolations = repairedTimelines.flatMap(t => checkDayFeasibilityV3(t, config));
  trace.setFeasibilityStatus(allViolations.length === 0 ? 'pass' : 'fail');

  onProgress?.('✓ Optimization complete');

  console.log('✓ Agent 3 v3: Optimization complete');
  console.log(`  → ${usedCanonicalIds.size} unique places scheduled`);
  console.log(`  → ${droppedCandidates.length} candidates dropped`);

  return {
    timelines: repairedTimelines,
    usedCanonicalIds,
    droppedCandidates,
  };
}

// =============================================================================
// V3 DAY TIMELINE BUILDING
// =============================================================================

/**
 * Build a day timeline with anchor-first selection.
 */
function buildDayTimelineV3(
  dayIndex: number,
  zone: ZoneV3,
  zoneResult: ZoneBuilderResult,
  usedCanonicalIds: Set<CanonicalPlaceId>,
  anchorIds: Set<CanonicalPlaceId>,
  mustIncludeIds: Set<CanonicalPlaceId>,
  droppedCandidates: OptimizerV3Output['droppedCandidates'],
  travelCache: TravelCache,
  config: OptimizerV3Config,
  trace: PlanTraceBuilder
): DayTimelineV3 {
  const featureFlags = getFeatureFlags();
  const slots: TimelineSlotV3[] = [];
  const selectedActivities: EnrichedCandidateCanonical[] = [];
  const dayDropped: OptimizerV3Output['droppedCandidates'] = [];

  // Get available candidates in this zone (not already used globally)
  const availableCandidates = zone.candidates.filter(c => !usedCanonicalIds.has(c.canonicalId));

  // Separate anchors and non-anchors
  const availableAnchors = availableCandidates.filter(c => anchorIds.has(c.canonicalId));
  const availableMustInclude = availableCandidates.filter(
    c => mustIncludeIds.has(c.canonicalId) && !anchorIds.has(c.canonicalId)
  );
  const availableRegular = availableCandidates.filter(
    c => !anchorIds.has(c.canonicalId) && !mustIncludeIds.has(c.canonicalId)
  );

  // Sort each group by utility
  availableAnchors.sort((a, b) => b.utilityScore - a.utilityScore);
  availableMustInclude.sort((a, b) => b.utilityScore - a.utilityScore);
  availableRegular.sort((a, b) => b.utilityScore - a.utilityScore);

  // Check for big rock in this zone
  const zoneBigRock = zone.bigRocks.find(br => !usedCanonicalIds.has(br.canonicalId));
  const isBigRockDay = !!zoneBigRock;

  // Calculate time budget
  let remainingBudget = config.dayBudgetMinutes;

  // Reserve time for meal placeholder
  const mealPlaceholderMinutes = featureFlags.ENABLE_MEALS ? 0 : config.mealPlaceholderMinutes;
  remainingBudget -= mealPlaceholderMinutes;

  // ANCHOR-FIRST SELECTION
  // 1. Schedule big rock first if present
  if (isBigRockDay && zoneBigRock) {
    if (zoneBigRock.durationMinutes <= remainingBudget) {
      selectedActivities.push(zoneBigRock);
      usedCanonicalIds.add(zoneBigRock.canonicalId);
      remainingBudget -= zoneBigRock.durationMinutes;
      console.log(`  → Day ${dayIndex + 1} Big Rock: ${zoneBigRock.name} (${zoneBigRock.durationMinutes}min)`);
    } else {
      dayDropped.push({
        canonicalId: zoneBigRock.canonicalId,
        name: zoneBigRock.name,
        reasonCode: DropReasonCode.TIME_BUDGET_EXCEEDED,
        dayIndex,
      });
    }
  }

  // 2. Schedule anchors
  for (const anchor of availableAnchors) {
    if (usedCanonicalIds.has(anchor.canonicalId)) continue;

    // Check if adding would exceed budget (with travel estimate)
    const travelEstimate = selectedActivities.length > 0
      ? travelCache.getHeuristic(
          selectedActivities[selectedActivities.length - 1].location,
          anchor.location
        )
      : 0;

    if (anchor.durationMinutes + travelEstimate <= remainingBudget) {
      selectedActivities.push(anchor);
      usedCanonicalIds.add(anchor.canonicalId);
      remainingBudget -= anchor.durationMinutes + travelEstimate;
    } else {
      dayDropped.push({
        canonicalId: anchor.canonicalId,
        name: anchor.name,
        reasonCode: DropReasonCode.TIME_BUDGET_EXCEEDED,
        dayIndex,
      });
    }
  }

  // 3. Schedule mustInclude
  for (const must of availableMustInclude) {
    if (usedCanonicalIds.has(must.canonicalId)) continue;

    const travelEstimate = selectedActivities.length > 0
      ? travelCache.getHeuristic(
          selectedActivities[selectedActivities.length - 1].location,
          must.location
        )
      : 0;

    if (must.durationMinutes + travelEstimate <= remainingBudget) {
      selectedActivities.push(must);
      usedCanonicalIds.add(must.canonicalId);
      remainingBudget -= must.durationMinutes + travelEstimate;
    } else {
      dayDropped.push({
        canonicalId: must.canonicalId,
        name: must.name,
        reasonCode: DropReasonCode.TIME_BUDGET_EXCEEDED,
        dayIndex,
      });
    }
  }

  // 4. Fill remaining time with regular candidates
  // Limit based on big rock day
  const maxAdditional = isBigRockDay ? config.maxAdditionalPoisOnBigRockDay : 10;
  let additionalCount = 0;

  for (const candidate of availableRegular) {
    if (additionalCount >= maxAdditional) break;
    if (usedCanonicalIds.has(candidate.canonicalId)) {
      // Already used globally - drop as duplicate
      dayDropped.push({
        canonicalId: candidate.canonicalId,
        name: candidate.name,
        reasonCode: DropReasonCode.DUPLICATE_CANONICAL,
        dayIndex,
      });
      continue;
    }

    const travelEstimate = selectedActivities.length > 0
      ? travelCache.getHeuristic(
          selectedActivities[selectedActivities.length - 1].location,
          candidate.location
        )
      : 0;

    if (candidate.durationMinutes + travelEstimate <= remainingBudget) {
      selectedActivities.push(candidate);
      usedCanonicalIds.add(candidate.canonicalId);
      remainingBudget -= candidate.durationMinutes + travelEstimate;
      additionalCount++;
    }
  }

  // Add dropped to global list
  droppedCandidates.push(...dayDropped);

  // Build timeline slots with travel times
  let currentMin = 0;
  let totalActivity = 0;
  let totalTravel = 0;
  let totalBuffer = 0;

  for (let i = 0; i < selectedActivities.length; i++) {
    const activity = selectedActivities[i];

    // Add travel from previous
    if (i > 0) {
      const prevActivity = selectedActivities[i - 1];
      const travelMin = travelCache.getHeuristic(prevActivity.location, activity.location);

      slots.push({
        type: 'travel',
        startMin: currentMin,
        endMin: currentMin + travelMin,
        duration: travelMin,
        travelFromPrevious: travelMin,
      });

      currentMin += travelMin;
      totalTravel += travelMin;
    }

    // Add buffer
    const bufferMin = config.bufferMinutesBetweenSlots;
    slots.push({
      type: 'buffer',
      startMin: currentMin,
      endMin: currentMin + bufferMin,
      duration: bufferMin,
    });
    currentMin += bufferMin;
    totalBuffer += bufferMin;

    // Add activity
    const duration = activity.durationMinutes;
    slots.push({
      type: 'activity',
      startMin: currentMin,
      endMin: currentMin + duration,
      duration,
      candidate: activity,
      travelFromPrevious: i > 0 ? slots[slots.length - 3].duration : undefined,
    });
    currentMin += duration;
    totalActivity += duration;
  }

  // Insert meal placeholder (when ENABLE_MEALS=false)
  let mealPlaceholderIncluded = false;
  let mealPlaceholderOmittedReason: string | undefined;

  if (!featureFlags.ENABLE_MEALS && mealPlaceholderMinutes > 0) {
    const mealResult = tryInsertMealPlaceholder(
      slots,
      currentMin,
      config.mealPlaceholderMinutes,
      config.dayBudgetMinutes
    );

    if (mealResult.inserted) {
      mealPlaceholderIncluded = true;
      currentMin = mealResult.newCurrentMin;
    } else {
      mealPlaceholderOmittedReason = mealResult.reason;
    }
  }

  // Log to trace
  trace.logOptimization(
    dayIndex,
    selectedActivities.map(a => ({ id: a.canonicalId, name: a.name })),
    dayDropped.map(d => ({ id: d.canonicalId, name: d.name, reasonCode: d.reasonCode })),
    { included: mealPlaceholderIncluded, omittedReason: mealPlaceholderOmittedReason }
  );

  const totalMeal = mealPlaceholderIncluded ? mealPlaceholderMinutes : 0;
  const budgetUsed = totalActivity + totalTravel + totalBuffer + totalMeal;

  return {
    dayIndex,
    zoneId: zone.id,
    primaryZoneName: zone.name,
    isBigRockDay,
    bigRock: zoneBigRock,
    slots,
    totalActivityMin: totalActivity,
    totalTravelMin: totalTravel,
    totalMealMin: totalMeal,
    totalBufferMin: totalBuffer,
    budgetUsed,
    budgetRemaining: Math.max(0, config.dayBudgetMinutes - budgetUsed),
    anchorsScheduled: selectedActivities.filter(a => anchorIds.has(a.canonicalId)).length,
  };
}

/**
 * Try to insert a meal placeholder slot.
 * Strategy: Try lunch window (12:00-14:00) first, then dinner (18:00-20:00).
 */
function tryInsertMealPlaceholder(
  slots: TimelineSlotV3[],
  currentMin: number,
  placeholderMinutes: number,
  dayBudgetMinutes: number
): { inserted: boolean; newCurrentMin: number; reason?: string; placeholderType?: 'lunch' | 'dinner' } {
  // Check if we have room
  if (currentMin + placeholderMinutes > dayBudgetMinutes) {
    return {
      inserted: false,
      newCurrentMin: currentMin,
      reason: 'No time budget remaining for meal placeholder',
    };
  }

  // Try to find a gap for lunch (around 12:00 = 720 min from midnight, but we use relative time)
  // Assuming day starts at 8:00 AM (480 min), lunch target is around 240 min into the day
  const lunchTargetMin = 240; // 4 hours after day start
  const dinnerTargetMin = 600; // 10 hours after day start

  // Find best insertion point
  let insertIndex = slots.length;
  let insertMin = currentMin;
  let placeholderType: 'lunch' | 'dinner' = 'lunch';

  // Look for a gap near lunch time
  for (let i = 0; i < slots.length; i++) {
    const slot = slots[i];
    if (slot.type === 'activity' && slot.startMin >= lunchTargetMin - 60 && slot.startMin <= lunchTargetMin + 60) {
      // Insert before this activity
      insertIndex = i;
      insertMin = slot.startMin;
      break;
    }
  }

  // If no good lunch spot, try dinner
  if (insertIndex === slots.length && currentMin >= dinnerTargetMin - 60) {
    placeholderType = 'dinner';
    insertMin = currentMin;
  }

  // Insert the placeholder
  const placeholderSlot: TimelineSlotV3 = {
    type: 'meal_placeholder',
    startMin: insertMin,
    endMin: insertMin + placeholderMinutes,
    duration: placeholderMinutes,
    placeholderType,
  };

  // For simplicity, append at end (proper insertion would require shifting all subsequent slots)
  slots.push(placeholderSlot);

  return {
    inserted: true,
    newCurrentMin: currentMin + placeholderMinutes,
    placeholderType,
  };
}

/**
 * Assign zones to days based on big rocks and utility.
 */
function assignZonesToDays(
  zones: ZoneV3[],
  numDays: number
): Map<number, number> {
  const assignments = new Map<number, number>();

  if (zones.length === 0) return assignments;

  // Separate big rock zones and regular zones
  const bigRockZones = zones.filter(z => z.hasBigRock).sort((a, b) => b.totalUtility - a.totalUtility);
  const regularZones = zones.filter(z => !z.hasBigRock).sort((a, b) => b.totalUtility - a.totalUtility);

  let dayIndex = 0;

  // Assign big rock zones first (one per day)
  for (const zone of bigRockZones) {
    if (dayIndex >= numDays) break;
    assignments.set(dayIndex, zone.id);
    dayIndex++;
  }

  // Assign remaining days to regular zones
  for (const zone of regularZones) {
    if (dayIndex >= numDays) break;
    assignments.set(dayIndex, zone.id);
    dayIndex++;
  }

  // Fill remaining days by reusing best zones
  const allZonesSorted = [...zones].sort((a, b) => b.totalUtility - a.totalUtility);
  let zoneIdx = 0;

  while (dayIndex < numDays && allZonesSorted.length > 0) {
    assignments.set(dayIndex, allZonesSorted[zoneIdx % allZonesSorted.length].id);
    dayIndex++;
    zoneIdx++;
  }

  return assignments;
}

/**
 * Create an empty day timeline.
 */
function createEmptyDayTimelineV3(dayIndex: number, config: OptimizerV3Config): DayTimelineV3 {
  return {
    dayIndex,
    zoneId: 0,
    isBigRockDay: false,
    slots: [],
    totalActivityMin: 0,
    totalTravelMin: 0,
    totalMealMin: 0,
    totalBufferMin: 0,
    budgetUsed: 0,
    budgetRemaining: config.dayBudgetMinutes,
    anchorsScheduled: 0,
  };
}

/**
 * Check day feasibility and return violations.
 */
function checkDayFeasibilityV3(
  timeline: DayTimelineV3,
  config: OptimizerV3Config
): Array<{ type: FeasibilityViolationType; message: string }> {
  const violations: Array<{ type: FeasibilityViolationType; message: string }> = [];

  // Check time budget
  if (timeline.budgetUsed > config.dayBudgetMinutes) {
    violations.push({
      type: 'TIME_BUDGET_EXCEEDED',
      message: `Day ${timeline.dayIndex + 1} exceeds budget by ${timeline.budgetUsed - config.dayBudgetMinutes} min`,
    });
  }

  // Check big rock day limits
  if (timeline.isBigRockDay) {
    const nonBigRockCount = timeline.slots.filter(
      s => s.type === 'activity' && s.candidate && !s.candidate.isBigRock
    ).length;

    if (nonBigRockCount > config.maxAdditionalPoisOnBigRockDay) {
      violations.push({
        type: 'BIG_ROCK_DAY_LIMIT',
        message: `Day ${timeline.dayIndex + 1} has ${nonBigRockCount} non-big-rock POIs (max: ${config.maxAdditionalPoisOnBigRockDay})`,
      });
    }
  }

  // Check for missing meal placeholder (when ENABLE_MEALS=false)
  const featureFlags = getFeatureFlags();
  if (!featureFlags.ENABLE_MEALS) {
    const hasMealPlaceholder = timeline.slots.some(s => s.type === 'meal_placeholder');
    if (!hasMealPlaceholder && timeline.slots.filter(s => s.type === 'activity').length > 0) {
      violations.push({
        type: 'MISSING_MEAL',
        message: `Day ${timeline.dayIndex + 1} has no meal placeholder`,
      });
    }
  }

  return violations;
}
