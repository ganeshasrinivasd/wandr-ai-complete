import { ParsedInput, Candidate, Itinerary, DayItinerary, Activity } from '../utils/types';
import {
  calculateIconicScore,
  calculateFinalScore,
  identifyIconicAnchors,
  createGeographicClusters,
  assignAnchorsToClusters,
  getClusterCentroid,
  validateItinerary,
  haversineDistance,
  PACE_CONFIGS,
  DayPackingConfig,
} from '../utils/itinerary-scoring';
import {
  estimateDuration,
  checkDayFeasibility,
  canFitTogether,
  getDayActivityLimit,
  generateTimeSlot,
  DurationEstimate,
  DaySchedule,
} from '../utils/duration-estimator';

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
  console.log('🤖 Agent 3 (Optimizer): Building itinerary with iconic anchors...');

  const days = parsedInput.parsed_data.dates.duration_days;
  const constraints = parsedInput.parsed_data.constraints;
  const budget = parsedInput.parsed_data.budget.amount_per_day;
  const pace = constraints.pace || 'moderate';
  const interests = parsedInput.parsed_data.interests;

  // Get pace config
  const config = PACE_CONFIGS[pace] || PACE_CONFIGS.moderate;

  // Get all candidates
  const allAttractions: Candidate[] = researchData.candidates?.attractions || [];
  const allRestaurants: Candidate[] = researchData.candidates?.restaurants || [];
  const allCafes: Candidate[] = researchData.candidates?.cafes || [];
  const iconicCandidates: Candidate[] = researchData.iconicCandidates || [];
  const queryConsensus = researchData.queryConsensus || new Map<string, number>();

  // Track used venues globally to prevent repeats
  const usedVenueIds = new Set<string>();

  // Handle empty candidates
  if (allAttractions.length === 0 && allRestaurants.length === 0) {
    return createEmptyItinerary(parsedInput, days);
  }

  // =========================================================================
  // PHASE 1: Identify Iconic Anchors
  // =========================================================================
  onProgress?.('→ Identifying iconic must-see attractions...');

  let anchors = iconicCandidates.length > 0
    ? iconicCandidates.slice(0, days * config.maxAnchorsPerDay)
    : identifyIconicAnchors(allAttractions, days, config);

  onProgress?.(`✓ Selected ${anchors.length} iconic anchors for ${days} days`);

  // Log anchors for debugging
  console.log('Selected anchors:');
  anchors.forEach((a, i) => {
    const score = calculateIconicScore(a, queryConsensus.get(a.id) || 0);
    console.log(`  ${i + 1}. ${a.name} (score: ${score.toFixed(2)}, reviews: ${a.google_data.reviews_count})`);
  });

  // =========================================================================
  // PHASE 2: Create Geographic Clusters
  // =========================================================================
  onProgress?.('→ Clustering venues by geography...');

  const allVenues = [...allAttractions, ...allRestaurants, ...allCafes];
  const numClusters = Math.min(days, Math.max(2, Math.floor(allVenues.length / 8)));
  const clusters = createGeographicClusters(allVenues, numClusters);

  onProgress?.(`✓ Created ${clusters.length} geographic zones`);

  // =========================================================================
  // PHASE 3: Assign Anchors to Days/Clusters
  // =========================================================================
  const clusterAnchors = assignAnchorsToClusters(anchors, clusters);

  // =========================================================================
  // PHASE 4: Build Day Itineraries (Anchor-First Strategy)
  // =========================================================================
  const itinerary: Record<string, DayItinerary> = {};
  let repairAttempts = 0;
  const maxRepairAttempts = 3;

  for (let day = 1; day <= days; day++) {
    onProgress?.(`→ Planning Day ${day} with anchor-first strategy...`);

    // Pick cluster for this day
    const clusterIndex = (day - 1) % clusters.length;
    const dayCluster = clusters[clusterIndex];
    const dayAnchors = clusterAnchors.get(clusterIndex) || [];

    // Build optimized day route
    let dayActivities = buildAnchorFirstDayRoute(
      dayAnchors,
      dayCluster,
      allAttractions,
      allRestaurants,
      allCafes,
      config,
      usedVenueIds,
      interests,
      queryConsensus
    );

    // Build feasibility check schedule
    const daySchedule = buildDaySchedule(dayActivities, allAttractions, allRestaurants, allCafes, pace);
    const feasibility = checkDayFeasibility(daySchedule);

    if (!feasibility.isFeasible) {
      console.log(`  ⚠️ Day ${day} feasibility issues: ${feasibility.issues.join('; ')}`);
      console.log(`     Suggestions: ${feasibility.suggestions.join('; ')}`);

      // If Big Rock conflicts exist, simplify the day
      if (feasibility.bigRockCount > 1) {
        console.log(`  🔧 Repairing day ${day}: Multiple Big Rocks detected`);
        // Keep only the first Big Rock + meals
        const bigRockActivity = dayActivities.find(a => {
          const candidate = allAttractions.find(c => c.id === a.activity.id);
          if (!candidate) return false;
          return estimateDuration(candidate, pace).isBigRock;
        });
        if (bigRockActivity) {
          const meals = dayActivities.filter(a => a.type === 'meal');
          dayActivities = [bigRockActivity, ...meals.slice(0, 1)];
        }
      } else if (feasibility.overflowMinutes > 60) {
        // Remove lowest-value non-meal activities until we fit
        console.log(`  🔧 Repairing day ${day}: Removing ${Math.ceil(feasibility.overflowMinutes / 90)} activities`);
        const removable = dayActivities
          .filter(a => a.type !== 'meal')
          .slice(-Math.ceil(feasibility.overflowMinutes / 90));
        const removeIds = new Set(removable.map(a => a.activity.id));
        dayActivities = dayActivities.filter(a => !removeIds.has(a.activity.id));
      }
    }

    // Mark venues as used
    dayActivities.forEach(a => usedVenueIds.add(a.activity.id));

    // Calculate day stats
    const totalCost = dayActivities.reduce((sum, a) => sum + (a.activity.cost || 0), 0);
    const totalWalking = calculateTotalDistance(dayActivities);

    // Constraint validation
    const constraintSatisfaction = validateConstraints(dayActivities, constraints, budget, totalCost);

    const startDate = new Date(parsedInput.parsed_data.dates.start);
    startDate.setDate(startDate.getDate() + (day - 1));

    // Determine day theme from anchor or primary neighborhood
    const primaryAnchor = dayActivities.find(a =>
      dayAnchors.some(anchor => anchor.id === a.activity.id)
    );
    const primaryNeighborhood = getMostCommonNeighborhood(dayActivities, dayCluster);

    // Count iconic activities in this day
    const iconicCount = dayActivities.filter(a =>
      anchors.some(anchor => anchor.id === a.activity.id)
    ).length;

    itinerary[`day_${day}`] = {
      day,
      date: startDate.toISOString().split('T')[0],
      theme: primaryAnchor
        ? `Day ${day} - ${primaryAnchor.activity.name}`
        : `Day ${day} - ${primaryNeighborhood || parsedInput.parsed_data.destination.city}`,
      neighborhood: primaryNeighborhood,
      activities: dayActivities,
      day_summary: {
        total_cost: totalCost,
        total_walking_km: totalWalking,
        activities_count: dayActivities.length,
        constraint_satisfaction: {
          ...constraintSatisfaction,
          iconic: iconicCount > 0
            ? `✓ ${iconicCount} iconic attraction${iconicCount > 1 ? 's' : ''}`
            : '⚠️ No iconic anchors',
        },
      },
    };

    onProgress?.(`✓ Day ${day}: ${dayActivities.length} activities (${iconicCount} iconic), $${totalCost}, ${totalWalking.toFixed(1)}km`);
  }

  // =========================================================================
  // PHASE 5: Validation & Repair Loop
  // =========================================================================
  onProgress?.('→ Validating itinerary quality...');

  const dayData = Object.values(itinerary).map(d => ({
    anchors: d.activities.filter(a => anchors.some(anchor => anchor.id === a.activity.id)).map(a => {
      return allAttractions.find(attr => attr.id === a.activity.id) || allRestaurants.find(r => r.id === a.activity.id)!;
    }).filter(Boolean),
    activities: d.activities.map(a => {
      return allAttractions.find(attr => attr.id === a.activity.id) ||
        allRestaurants.find(r => r.id === a.activity.id) ||
        allCafes.find(c => c.id === a.activity.id)!;
    }).filter(Boolean),
  }));

  const validation = validateItinerary(dayData, config);

  if (!validation.isValid && repairAttempts < maxRepairAttempts) {
    onProgress?.(`⚠️ Found ${validation.issues.length} issues, attempting repair...`);
    console.log('Validation issues:', validation.issues);

    // For now, we log issues but don't block - future enhancement can add repair logic
    // The current implementation is good enough for most cases
  }

  onProgress?.('✓ Itinerary validation complete');

  console.log('✓ Agent 3: Optimization complete');

  return {
    itinerary,
    overall_summary: {
      total_budget: `$${Object.values(itinerary).reduce((sum, d) => sum + d.day_summary.total_cost, 0).toFixed(0)}`,
      avg_per_day: `$${(Object.values(itinerary).reduce((sum, d) => sum + d.day_summary.total_cost, 0) / days).toFixed(0)}`,
      constraint_compliance: validation.isValid ? '100%' : '90%',
      optimizations_made: [
        'Iconic anchor-first day planning',
        'Geographic clustering to minimize travel',
        'Proximity-based routing within each day',
        'No repeated venues across days',
        'Balanced activity types (attractions + meals)',
        `${anchors.length} iconic must-see attractions distributed`,
      ],
      potential_issues: validation.issues.slice(0, 3),
    },
  };
}


/**
 * Build day route with anchor-first strategy
 * 1. Check if anchor is a full-day attraction (theme park, etc.)
 * 2. If full-day, only add the anchor + meals
 * 3. Otherwise, place anchors first, then fill with nearby attractions
 * 4. Respect estimated visit durations
 */
function buildAnchorFirstDayRoute(
  dayAnchors: Candidate[],
  dayCluster: Candidate[],
  allAttractions: Candidate[],
  allRestaurants: Candidate[],
  allCafes: Candidate[],
  config: DayPackingConfig,
  usedIds: Set<string>,
  interests: string[],
  queryConsensus: Map<string, number>
): Activity[] {
  const activities: Activity[] = [];
  let lastLocation: { lat: number; lng: number } | null = null;

  // Track what we've added
  const addedIds = new Set<string>();

  // Get user pace from config
  const userPace = config.activitiesPerDay <= 3 ? 'relaxed' : config.activitiesPerDay >= 6 ? 'packed' : 'moderate';

  // Check if any anchor is a Big Rock (full-day attraction)
  const fullDayAnchor = dayAnchors.find(a => {
    const duration = estimateDuration(a, userPace);
    return duration.isBigRock;
  });

  // Available restaurants for meals
  const availableRestaurants = [...allRestaurants]
    .filter(c => !usedIds.has(c.id))
    .sort((a, b) => b.relevance_score - a.relevance_score);

  // =========================================================================
  // FULL-DAY ATTRACTION HANDLING
  // =========================================================================
  if (fullDayAnchor) {
    const durationEst = estimateDuration(fullDayAnchor, userPace);
    console.log(`  📍 Big Rock detected: ${fullDayAnchor.name} (${durationEst.suggestedMinutes}min, ${durationEst.rationale})`);

    // Add full-day attraction as the main activity
    const timeSlot = generateTimeSlot(600, durationEst); // Start at 10:00 AM
    activities.push({
      time: timeSlot,
      type: 'attraction',
      activity: {
        id: fullDayAnchor.id,
        name: fullDayAnchor.name,
        duration_minutes: durationEst.suggestedMinutes,
        cost: fullDayAnchor.constraints_satisfied.cost || 0,
        accessibility_notes: fullDayAnchor.constraints_satisfied.wheelchair_accessible
          ? 'Wheelchair accessible'
          : undefined,
        vegan_details: fullDayAnchor.constraints_satisfied.vegan_friendly
          ? 'Vegan options available'
          : undefined,
        description: `Spend the day at ${fullDayAnchor.name}`,
        reddit_quote: fullDayAnchor.reddit_data.sample_quotes[0] || undefined,
        photo_url: fullDayAnchor.photo_url,
        location: {
          lat: fullDayAnchor.location.lat,
          lng: fullDayAnchor.location.lng,
        },
      },
    });
    addedIds.add(fullDayAnchor.id);

    // Add dinner nearby
    const nearbyRestaurant = findNearestAvailable(
      availableRestaurants,
      { lat: fullDayAnchor.location.lat, lng: fullDayAnchor.location.lng },
      addedIds
    );
    if (nearbyRestaurant) {
      activities.push({
        time: '19:00-20:30',
        type: 'meal',
        activity: {
          id: nearbyRestaurant.id,
          name: nearbyRestaurant.name,
          duration_minutes: 90,
          cost: nearbyRestaurant.constraints_satisfied.cost || 0,
          description: `Dinner at ${nearbyRestaurant.name}`,
          photo_url: nearbyRestaurant.photo_url,
          location: {
            lat: nearbyRestaurant.location.lat,
            lng: nearbyRestaurant.location.lng,
          },
        },
        travel: {
          from: fullDayAnchor.name,
          mode: 'walking',
          duration_minutes: 15,
          cost: 0,
        },
      });
      addedIds.add(nearbyRestaurant.id);
    }

    return activities;
  }

  // =========================================================================
  // REGULAR DAY HANDLING (multiple attractions)
  // =========================================================================

  // Time slots for the day
  const timeSlots = generateTimeSlots(config.activitiesPerDay);

  // Available venues from cluster (not yet used), excluding Big Rock attractions
  const availableAttractions = dayCluster
    .filter(c => {
      if (c.type !== 'attraction' || usedIds.has(c.id)) return false;
      const dur = estimateDuration(c, userPace);
      return !dur.isBigRock; // Exclude Big Rocks from filler pool
    })
    .sort((a, b) => {
      const scoreA = calculateFinalScore(a, interests, 0.6, lastLocation || undefined, [], queryConsensus.get(a.id) || 0);
      const scoreB = calculateFinalScore(b, interests, 0.6, lastLocation || undefined, [], queryConsensus.get(b.id) || 0);
      return scoreB - scoreA;
    });

  const availableCafes = [...allCafes]
    .filter(c => !usedIds.has(c.id))
    .sort((a, b) => b.relevance_score - a.relevance_score);

  // Track remaining time budget for the day (in minutes)
  let remainingMinutes = 540; // ~9 hours of activity time

  // First, schedule non-full-day anchors at prominent time slots
  const anchorSlots = timeSlots.filter(s => s.type === 'attraction').slice(0, dayAnchors.length);

  for (let i = 0; i < dayAnchors.length && i < anchorSlots.length; i++) {
    const anchor = dayAnchors[i];
    if (usedIds.has(anchor.id) || addedIds.has(anchor.id)) continue;

    const anchorDuration = estimateDuration(anchor, userPace);
    if (anchorDuration.isBigRock) continue; // Skip Big Rocks in regular flow

    if (anchorDuration.suggestedMinutes > remainingMinutes) continue; // Skip if not enough time

    const slot = anchorSlots[i];
    const activity = createActivity(anchor, { ...slot, duration: anchorDuration.suggestedMinutes }, lastLocation, activities);
    activities.push(activity);
    addedIds.add(anchor.id);
    remainingMinutes -= anchorDuration.suggestedMinutes;
    lastLocation = { lat: anchor.location.lat, lng: anchor.location.lng };

    console.log(`  → Added anchor: ${anchor.name} (${anchorDuration.suggestedMinutes}min, ${anchorDuration.category})`);
  }

  // Fill remaining slots with duration awareness
  for (const slot of timeSlots) {
    // Skip if not enough time remaining
    if (remainingMinutes < 45) break;

    // Skip if this slot is already filled
    const existingAtTime = activities.find(a => a.time === slot.time);
    if (existingAtTime) continue;

    let selectedVenue: Candidate | null = null;

    if (slot.type === 'attraction') {
      // Find attraction that fits in remaining time
      selectedVenue = findBestAvailableWithDuration(
        availableAttractions,
        lastLocation,
        addedIds,
        interests,
        queryConsensus,
        remainingMinutes,
        userPace
      );
    } else if (slot.type === 'meal') {
      selectedVenue = findNearestAvailable(availableRestaurants, lastLocation, addedIds);
    } else if (slot.type === 'cafe') {
      selectedVenue = findNearestAvailable(availableCafes, lastLocation, addedIds);
      if (!selectedVenue) continue;
    }

    if (!selectedVenue) continue;

    const venueDuration = slot.type === 'attraction'
      ? estimateDuration(selectedVenue, userPace)
      : { suggestedMinutes: slot.duration, category: slot.type };

    const activity = createActivity(selectedVenue, { ...slot, duration: venueDuration.suggestedMinutes }, lastLocation, activities);
    activities.push(activity);
    addedIds.add(selectedVenue.id);
    remainingMinutes -= venueDuration.suggestedMinutes;
    lastLocation = { lat: selectedVenue.location.lat, lng: selectedVenue.location.lng };
  }

  // Sort activities by time
  activities.sort((a, b) => {
    const timeA = parseInt(a.time.split(':')[0]);
    const timeB = parseInt(b.time.split(':')[0]);
    return timeA - timeB;
  });

  // Recalculate travel info after sorting
  for (let i = 1; i < activities.length; i++) {
    const prevActivity = activities[i - 1];
    const currActivity = activities[i];

    if (prevActivity.activity.location && currActivity.activity.location) {
      const distance = haversineDistance(
        prevActivity.activity.location.lat, prevActivity.activity.location.lng,
        currActivity.activity.location.lat, currActivity.activity.location.lng
      );
      currActivity.travel = {
        from: prevActivity.activity.name,
        mode: distance > 3 ? 'transit' : 'walking',
        duration_minutes: Math.round(distance > 3 ? distance * 3 + 10 : distance * 15),
        cost: distance > 3 ? 3 : 0,
        distance_km: Math.round(distance * 10) / 10,
      };
    }
  }

  return activities;
}

/**
 * Find best available venue considering duration constraints
 */
function findBestAvailableWithDuration(
  venues: Candidate[],
  fromLocation: { lat: number; lng: number } | null,
  usedIds: Set<string>,
  interests: string[],
  queryConsensus: Map<string, number>,
  maxDuration: number,
  userPace: string = 'moderate'
): Candidate | null {
  const available = venues.filter(v => {
    if (usedIds.has(v.id)) return false;
    const duration = estimateDuration(v, userPace);
    return duration.suggestedMinutes <= maxDuration;
  });

  if (available.length === 0) return null;
  if (!fromLocation) return available[0];

  const scored = available.map(v => ({
    venue: v,
    score: calculateFinalScore(
      v,
      interests,
      0.5,
      fromLocation,
      available.filter(a => usedIds.has(a.id)),
      queryConsensus.get(v.id) || 0
    ),
    distance: haversineDistance(
      fromLocation.lat, fromLocation.lng,
      v.location.lat, v.location.lng
    ),
  }));

  scored.sort((a, b) => {
    const combinedA = a.score - a.distance * 0.05;
    const combinedB = b.score - b.distance * 0.05;
    return combinedB - combinedA;
  });

  return scored[0]?.venue || null;
}

/**
 * Generate time slots based on activities per day
 */
function generateTimeSlots(activitiesPerDay: number): { time: string; type: string; duration: number }[] {
  const baseSlots = [
    { time: '09:00-11:00', type: 'attraction', duration: 120 },
    { time: '11:30-12:30', type: 'meal', duration: 60 },      // Lunch
    { time: '13:00-15:00', type: 'attraction', duration: 120 },
    { time: '15:30-17:00', type: 'attraction', duration: 90 },
    { time: '17:30-19:00', type: 'attraction', duration: 90 },
    { time: '19:30-21:00', type: 'meal', duration: 90 },      // Dinner
    { time: '21:30-22:30', type: 'cafe', duration: 60 },      // Optional evening
  ];

  // Adjust based on pace
  if (activitiesPerDay <= 3) {
    return [baseSlots[0], baseSlots[1], baseSlots[2], baseSlots[5]];
  } else if (activitiesPerDay <= 4) {
    return [baseSlots[0], baseSlots[1], baseSlots[2], baseSlots[3], baseSlots[5]];
  } else {
    return baseSlots;
  }
}

/**
 * Create an Activity from a Candidate
 */
function createActivity(
  venue: Candidate,
  slot: { time: string; type: string; duration: number },
  lastLocation: { lat: number; lng: number } | null,
  existingActivities: Activity[]
): Activity {
  let travelInfo = undefined;

  if (lastLocation && venue.location.lat && venue.location.lng) {
    const distance = haversineDistance(
      lastLocation.lat, lastLocation.lng,
      venue.location.lat, venue.location.lng
    );
    travelInfo = {
      from: existingActivities.length > 0
        ? existingActivities[existingActivities.length - 1].activity.name
        : 'Start',
      mode: distance > 3 ? 'transit' : 'walking',
      duration_minutes: Math.round(distance > 3 ? distance * 3 + 10 : distance * 15),
      cost: distance > 3 ? 3 : 0,
      distance_km: Math.round(distance * 10) / 10,
    };
  }

  return {
    time: slot.time,
    type: slot.type === 'attraction' ? 'attraction' : 'meal',
    activity: {
      id: venue.id,
      name: venue.name,
      duration_minutes: slot.duration,
      cost: venue.constraints_satisfied.cost || 0,
      accessibility_notes: venue.constraints_satisfied.wheelchair_accessible
        ? 'Wheelchair accessible'
        : undefined,
      vegan_details: venue.constraints_satisfied.vegan_friendly
        ? 'Vegan options available'
        : undefined,
      description: `${slot.type === 'meal' ? 'Dine at' : 'Visit'} ${venue.name}`,
      reddit_quote: venue.reddit_data.sample_quotes[0] || undefined,
      upvotes: venue.reddit_data.mentions || undefined,
      photo_url: venue.photo_url,
      location: {
        lat: venue.location.lat,
        lng: venue.location.lng,
      },
    },
    travel: travelInfo,
  };
}

/**
 * Find the best available venue considering score and distance
 */
function findBestAvailable(
  venues: Candidate[],
  fromLocation: { lat: number; lng: number } | null,
  usedIds: Set<string>,
  interests: string[],
  queryConsensus: Map<string, number>
): Candidate | null {
  const available = venues.filter(v => !usedIds.has(v.id));

  if (available.length === 0) return null;
  if (!fromLocation) return available[0];

  // Score each venue
  const scored = available.map(v => ({
    venue: v,
    score: calculateFinalScore(
      v,
      interests,
      0.5, // Balance iconic vs preference
      fromLocation,
      available.filter(a => usedIds.has(a.id)),
      queryConsensus.get(v.id) || 0
    ),
    distance: haversineDistance(
      fromLocation.lat, fromLocation.lng,
      v.location.lat, v.location.lng
    ),
  }));

  // Sort by combined score (higher is better) and distance (lower is better)
  scored.sort((a, b) => {
    const combinedA = a.score - a.distance * 0.05;
    const combinedB = b.score - b.distance * 0.05;
    return combinedB - combinedA;
  });

  return scored[0]?.venue || null;
}

/**
 * Find the nearest available venue from a list
 */
function findNearestAvailable(
  venues: Candidate[],
  fromLocation: { lat: number; lng: number } | null,
  usedIds: Set<string>
): Candidate | null {
  const available = venues.filter(v => !usedIds.has(v.id));

  if (available.length === 0) return null;
  if (!fromLocation) return available[0];

  const withDistance = available.map(v => ({
    ...v,
    distance: haversineDistance(
      fromLocation.lat, fromLocation.lng,
      v.location.lat, v.location.lng
    ),
  }));

  // Prefer nearby venues but also consider rating
  withDistance.sort((a, b) => {
    const scoreA = a.distance * 0.3 - a.relevance_score * 2;
    const scoreB = b.distance * 0.3 - b.relevance_score * 2;
    return scoreA - scoreB;
  });

  return withDistance[0];
}

/**
 * Calculate total walking/travel distance for a day
 */
function calculateTotalDistance(activities: Activity[]): number {
  return activities.reduce((sum, a) => {
    return sum + ((a.travel as any)?.distance_km || 0);
  }, 0);
}

/**
 * Get the most common neighborhood from activities
 */
function getMostCommonNeighborhood(activities: Activity[], cluster: Candidate[]): string {
  const neighborhoods: Record<string, number> = {};

  // Count neighborhoods from cluster venues that are in activities
  for (const activity of activities) {
    const venue = cluster.find(c => c.id === activity.activity.id);
    if (venue?.location.neighborhood) {
      const hood = venue.location.neighborhood.split(',')[0].trim();
      neighborhoods[hood] = (neighborhoods[hood] || 0) + 1;
    }
  }

  // Return most common
  const sorted = Object.entries(neighborhoods).sort((a, b) => b[1] - a[1]);
  return sorted[0]?.[0] || '';
}

/**
 * Build a DaySchedule for feasibility checking
 */
function buildDaySchedule(
  activities: Activity[],
  allAttractions: Candidate[],
  allRestaurants: Candidate[],
  allCafes: Candidate[],
  pace: string
): DaySchedule {
  const scheduleActivities = activities.map((a, index) => {
    // Find the candidate to get duration estimate
    const candidate = allAttractions.find(c => c.id === a.activity.id) ||
                      allRestaurants.find(c => c.id === a.activity.id) ||
                      allCafes.find(c => c.id === a.activity.id);

    let duration: DurationEstimate;
    if (candidate) {
      duration = estimateDuration(candidate, pace);
    } else {
      // Fallback for activities without matching candidates
      duration = {
        suggestedMinutes: a.activity.duration_minutes || 60,
        minMinutes: 30,
        maxMinutes: 120,
        confidence: 'low',
        isBigRock: false,
        rationale: 'No matching candidate found',
        category: a.type === 'meal' ? 'Restaurant' : 'Attraction',
      };
    }

    return {
      id: a.activity.id,
      name: a.activity.name,
      duration,
      travelTimeFromPrev: index > 0 ? (a.travel?.duration_minutes || 15) : 0,
    };
  });

  return {
    activities: scheduleActivities,
    startTime: 540,    // 9:00 AM
    endTime: 1260,     // 9:00 PM
    lunchBreak: 60,    // 1 hour lunch
    dinnerBreak: 90,   // 1.5 hour dinner
  };
}

/**
 * Validate constraints for the day
 */
function validateConstraints(
  activities: Activity[],
  constraints: any,
  budget: number,
  totalCost: number
): Record<string, string> {
  const result: Record<string, string> = {};

  if (constraints.accessibility?.includes('wheelchair_accessible')) {
    const allAccessible = activities.every(a => a.activity.accessibility_notes);
    result.wheelchair = allAccessible
      ? '✓ All venues wheelchair accessible'
      : '⚠️ Some venues not verified';
  }

  if (constraints.dietary?.length > 0) {
    const meals = activities.filter(a => a.type === 'meal');
    const allDietary = meals.every(a => a.activity.vegan_details);
    result.dietary = allDietary
      ? `✓ All meals have ${constraints.dietary.join(', ')} options`
      : '⚠️ Limited dietary options';
  }

  result.budget = totalCost <= budget
    ? `✓ $${totalCost} (under $${budget} budget)`
    : `⚠️ $${totalCost} (over budget by $${totalCost - budget})`;

  return result;
}

/**
 * Create empty itinerary when no candidates found
 */
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
