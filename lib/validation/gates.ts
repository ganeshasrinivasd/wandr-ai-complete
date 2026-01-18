/**
 * Validation Gates Module
 *
 * Implements hard and soft constraint gates that run during optimization:
 * 1. AnchorGate - Ensures iconic anchors per day
 * 2. DurationGate - Enforces minimum durations for big-rocks
 * 3. MealGate - Validates meal venues
 * 4. EnergyGate - Enforces energy pacing
 * 5. DedupGate - Prevents duplicates
 * 6. ZoneGate - Limits cross-zone travel
 * 7. TravelGate - Enforces travel time limits
 */

import { DayTimeline, TimelineSlot, EnrichedCandidate } from '../planning/types';
import { IconicAnchor, BigRock, PolicyRule } from '../rag/types';
import { GlobalLedger } from '../planning/global-ledger';

// =============================================================================
// GATE RESULT TYPES
// =============================================================================

export type GateSeverity = 'error' | 'warning' | 'info';

export interface GateViolation {
  gate: string;
  severity: GateSeverity;
  message: string;
  details: Record<string, any>;
  autoFixable: boolean;
  suggestedFix?: string;
}

export interface GateResult {
  gate: string;
  passed: boolean;
  violations: GateViolation[];
}

export interface AllGatesResult {
  allPassed: boolean;
  hardPassed: boolean;
  softPassed: boolean;
  results: GateResult[];
  violations: GateViolation[];
  hardViolations: GateViolation[];
  softViolations: GateViolation[];
}

// =============================================================================
// GATE CONFIGURATIONS
// =============================================================================

export interface AnchorGateConfig {
  anchors: IconicAnchor[];
  minAnchorsPerDay: number;
  exemptBigRockDays: boolean;
}

export interface DurationGateConfig {
  bigRocks: BigRock[];
  rules: PolicyRule[];
  defaultMinByCategory: Record<string, number>;
}

export interface MealGateConfig {
  validTypes: string[];
  invalidTypes: string[];
  invalidNamePatterns: string[];
  requireVerifiedHours: boolean;
}

export interface EnergyGateConfig {
  maxConsecutiveHighEnergy: number;
  noHighEnergyAfterHour: number; // 24-hour format (e.g., 18 for 6 PM)
  bufferAfterBigRockMin: number;
}

export interface ZoneGateConfig {
  maxCrossZoneTrips: number;
  maxDailyZones: number;
}

export interface TravelGateConfig {
  maxPerLegMin: number;
  maxDailyTotalMin: number;
}

// =============================================================================
// DEFAULT CONFIGURATIONS
// =============================================================================

export const DEFAULT_ANCHOR_CONFIG: AnchorGateConfig = {
  anchors: [],
  minAnchorsPerDay: 1,
  exemptBigRockDays: true,
};

export const DEFAULT_DURATION_CONFIG: DurationGateConfig = {
  bigRocks: [],
  rules: [],
  defaultMinByCategory: {
    theme_park: 240,
    amusement_park: 240,
    zoo: 180,
    aquarium: 120,
    museum: 90,
    art_gallery: 60,
    temple: 45,
    church: 30,
    landmark: 30,
    viewpoint: 20,
    park: 60,
    restaurant: 45,
    cafe: 30,
  },
};

export const DEFAULT_MEAL_CONFIG: MealGateConfig = {
  validTypes: ['restaurant', 'cafe', 'bakery', 'food_court', 'bar'],
  invalidTypes: ['market', 'bazaar', 'shopping_mall', 'tourist_attraction', 'museum', 'temple'],
  invalidNamePatterns: ['bazaar', 'market', 'mall', 'chowk', 'temple', 'mandir', 'masjid', 'museum'],
  requireVerifiedHours: false,
};

export const DEFAULT_ENERGY_CONFIG: EnergyGateConfig = {
  maxConsecutiveHighEnergy: 2,
  noHighEnergyAfterHour: 18, // 6 PM
  bufferAfterBigRockMin: 30,
};

export const DEFAULT_ZONE_CONFIG: ZoneGateConfig = {
  maxCrossZoneTrips: 1,
  maxDailyZones: 2,
};

export const DEFAULT_TRAVEL_CONFIG: TravelGateConfig = {
  maxPerLegMin: 35,
  maxDailyTotalMin: 100,
};

// =============================================================================
// ENERGY CLASSIFICATION
// =============================================================================

type EnergyLevel = 'low' | 'medium' | 'high';

const CATEGORY_ENERGY: Record<string, EnergyLevel> = {
  theme_park: 'high',
  amusement_park: 'high',
  zoo: 'high',
  hiking: 'high',
  adventure: 'high',
  museum: 'medium',
  art_gallery: 'medium',
  temple: 'medium',
  church: 'medium',
  palace: 'medium',
  fort: 'medium',
  landmark: 'medium',
  viewpoint: 'low',
  cafe: 'low',
  restaurant: 'low',
  park: 'low',
  garden: 'low',
};

function getActivityEnergy(candidate: EnrichedCandidate | undefined): EnergyLevel {
  if (!candidate) return 'low';

  // Check category first
  if (candidate.category && CATEGORY_ENERGY[candidate.category]) {
    return CATEGORY_ENERGY[candidate.category];
  }

  // Check Google types
  if (candidate.googleTypes) {
    for (const type of candidate.googleTypes) {
      if (CATEGORY_ENERGY[type]) {
        return CATEGORY_ENERGY[type];
      }
    }
  }

  // Check if big rock
  if (candidate.isBigRock) {
    return 'high';
  }

  return 'medium'; // Default
}

// =============================================================================
// ANCHOR GATE
// =============================================================================

/**
 * Validates that each day has at least one iconic anchor
 */
export function runAnchorGate(
  timeline: DayTimeline,
  config: AnchorGateConfig = DEFAULT_ANCHOR_CONFIG
): GateResult {
  const violations: GateViolation[] = [];

  // Exempt big-rock days if configured
  if (config.exemptBigRockDays && timeline.isBigRockDay) {
    return { gate: 'AnchorGate', passed: true, violations: [] };
  }

  // Get activity slots
  const activities = timeline.slots.filter(s => s.type === 'activity');

  // Count iconic anchors
  const iconicCount = activities.filter(slot => {
    const candidate = slot.candidate;
    if (!candidate) return false;

    // Check if in anchors list
    return config.anchors.some(anchor =>
      anchor.place_id === candidate.placeId ||
      anchor.normalized_name === candidate.normalizedName?.toLowerCase()
    );
  }).length;

  if (iconicCount < config.minAnchorsPerDay) {
    violations.push({
      gate: 'AnchorGate',
      severity: 'warning',
      message: `Day ${timeline.dayIndex + 1} has ${iconicCount} iconic anchor(s), needs at least ${config.minAnchorsPerDay}`,
      details: {
        dayIndex: timeline.dayIndex,
        iconicCount,
        required: config.minAnchorsPerDay,
        activities: activities.map(a => a.candidate?.name),
      },
      autoFixable: true,
      suggestedFix: 'swap_for_anchor',
    });
  }

  return {
    gate: 'AnchorGate',
    passed: violations.length === 0,
    violations,
  };
}

// =============================================================================
// DURATION GATE
// =============================================================================

/**
 * Validates that big-rocks and categories have minimum durations
 */
export function runDurationGate(
  timeline: DayTimeline,
  config: DurationGateConfig = DEFAULT_DURATION_CONFIG
): GateResult {
  const violations: GateViolation[] = [];

  for (const slot of timeline.slots) {
    if (slot.type !== 'activity' || !slot.candidate) continue;

    const candidate = slot.candidate;
    const duration = slot.duration;

    // Check against big-rock list
    const bigRockMatch = config.bigRocks.find(br =>
      br.place_id === candidate.placeId ||
      br.normalized_name === candidate.normalizedName?.toLowerCase()
    );

    if (bigRockMatch) {
      if (duration < bigRockMatch.min_duration_min) {
        violations.push({
          gate: 'DurationGate',
          severity: 'error',
          message: `"${candidate.name}" is a big-rock requiring ${bigRockMatch.min_duration_min} min, scheduled for ${duration} min`,
          details: {
            candidate: candidate.name,
            scheduled: duration,
            minimum: bigRockMatch.min_duration_min,
            preferred: bigRockMatch.preferred_duration_min,
          },
          autoFixable: true,
          suggestedFix: 'extend_duration',
        });
      }
      continue;
    }

    // Check against category minimums
    const category = candidate.category || 'unknown';
    const minDuration = config.defaultMinByCategory[category];

    if (minDuration && duration < minDuration * 0.8) { // Allow 20% flexibility
      violations.push({
        gate: 'DurationGate',
        severity: 'warning',
        message: `"${candidate.name}" (${category}) scheduled for ${duration} min, typically needs ${minDuration} min`,
        details: {
          candidate: candidate.name,
          category,
          scheduled: duration,
          typical: minDuration,
        },
        autoFixable: true,
        suggestedFix: 'adjust_duration',
      });
    }
  }

  return {
    gate: 'DurationGate',
    passed: violations.filter(v => v.severity === 'error').length === 0,
    violations,
  };
}

// =============================================================================
// MEAL GATE
// =============================================================================

/**
 * Validates that meal slots have proper restaurant/cafe venues
 */
export function runMealGate(
  timeline: DayTimeline,
  config: MealGateConfig = DEFAULT_MEAL_CONFIG
): GateResult {
  const violations: GateViolation[] = [];

  const mealSlots = timeline.slots.filter(s => s.type === 'meal');

  for (const slot of mealSlots) {
    const candidate = slot.candidate;
    if (!candidate) continue;

    const types = candidate.googleTypes || [];
    const nameLower = candidate.name.toLowerCase();

    // Check for valid types
    const hasValidType = types.some(t => config.validTypes.includes(t));
    const hasInvalidType = types.some(t => config.invalidTypes.includes(t));
    const hasInvalidName = config.invalidNamePatterns.some(p => nameLower.includes(p));

    if (!hasValidType || hasInvalidType || hasInvalidName) {
      violations.push({
        gate: 'MealGate',
        severity: 'error',
        message: `"${candidate.name}" is not a valid meal venue for ${slot.mealSlot || 'meal'}`,
        details: {
          candidate: candidate.name,
          slot: slot.mealSlot,
          types,
          hasValidType,
          hasInvalidType,
          hasInvalidName,
        },
        autoFixable: true,
        suggestedFix: 'replace_meal_venue',
      });
    }
  }

  return {
    gate: 'MealGate',
    passed: violations.length === 0,
    violations,
  };
}

// =============================================================================
// ENERGY GATE
// =============================================================================

/**
 * Validates energy pacing throughout the day
 */
export function runEnergyGate(
  timeline: DayTimeline,
  config: EnergyGateConfig = DEFAULT_ENERGY_CONFIG
): GateResult {
  const violations: GateViolation[] = [];

  const activities = timeline.slots.filter(s => s.type === 'activity');

  // Check 1: No high-energy after cutoff hour
  const cutoffMin = config.noHighEnergyAfterHour * 60; // Convert to minutes from midnight

  for (const slot of activities) {
    if (slot.startMin >= cutoffMin) {
      const energy = getActivityEnergy(slot.candidate);
      if (energy === 'high') {
        violations.push({
          gate: 'EnergyGate',
          severity: 'warning',
          message: `High-energy "${slot.candidate?.name}" scheduled after ${config.noHighEnergyAfterHour}:00`,
          details: {
            candidate: slot.candidate?.name,
            startMin: slot.startMin,
            startTime: formatMinutesToTime(slot.startMin),
            cutoff: config.noHighEnergyAfterHour,
          },
          autoFixable: true,
          suggestedFix: 'reorder_activities',
        });
      }
    }
  }

  // Check 2: Max consecutive high-energy
  let consecutiveHigh = 0;
  for (const slot of activities) {
    const energy = getActivityEnergy(slot.candidate);
    if (energy === 'high') {
      consecutiveHigh++;
      if (consecutiveHigh > config.maxConsecutiveHighEnergy) {
        violations.push({
          gate: 'EnergyGate',
          severity: 'warning',
          message: `${consecutiveHigh} consecutive high-energy activities (max ${config.maxConsecutiveHighEnergy})`,
          details: {
            consecutiveHigh,
            maxAllowed: config.maxConsecutiveHighEnergy,
          },
          autoFixable: true,
          suggestedFix: 'insert_low_energy_break',
        });
        break;
      }
    } else {
      consecutiveHigh = 0;
    }
  }

  // Check 3: Buffer after big-rock
  if (timeline.isBigRockDay && timeline.bigRock) {
    const bigRockSlot = activities.find(s => s.candidate?.placeId === timeline.bigRock?.placeId);
    if (bigRockSlot) {
      const bigRockEnd = bigRockSlot.endMin;
      const nextActivity = activities.find(s => s.startMin > bigRockEnd && s !== bigRockSlot);

      if (nextActivity) {
        const gap = nextActivity.startMin - bigRockEnd;
        if (gap < config.bufferAfterBigRockMin) {
          violations.push({
            gate: 'EnergyGate',
            severity: 'info',
            message: `Only ${gap} min buffer after big-rock "${timeline.bigRock.name}" (recommend ${config.bufferAfterBigRockMin} min)`,
            details: {
              bigRock: timeline.bigRock.name,
              gap,
              recommended: config.bufferAfterBigRockMin,
            },
            autoFixable: true,
            suggestedFix: 'add_buffer',
          });
        }
      }
    }
  }

  return {
    gate: 'EnergyGate',
    passed: violations.filter(v => v.severity === 'error').length === 0,
    violations,
  };
}

// =============================================================================
// DEDUP GATE
// =============================================================================

/**
 * Validates no duplicates exist in the timeline
 */
export function runDedupGate(
  timeline: DayTimeline,
  ledger: GlobalLedger
): GateResult {
  const violations: GateViolation[] = [];

  // Check for duplicates within this day
  const seenIds = new Set<string>();
  const seenNames = new Set<string>();

  for (const slot of timeline.slots) {
    if (!slot.candidate) continue;

    const placeId = slot.candidate.placeId;
    const normalizedName = slot.candidate.normalizedName?.toLowerCase();

    if (placeId && seenIds.has(placeId)) {
      violations.push({
        gate: 'DedupGate',
        severity: 'error',
        message: `Duplicate place_id "${placeId}" in day ${timeline.dayIndex + 1}`,
        details: {
          placeId,
          candidate: slot.candidate.name,
          dayIndex: timeline.dayIndex,
        },
        autoFixable: true,
        suggestedFix: 'remove_duplicate',
      });
    }
    if (placeId) seenIds.add(placeId);

    if (normalizedName && seenNames.has(normalizedName)) {
      violations.push({
        gate: 'DedupGate',
        severity: 'error',
        message: `Duplicate name "${slot.candidate.name}" in day ${timeline.dayIndex + 1}`,
        details: {
          name: slot.candidate.name,
          normalizedName,
          dayIndex: timeline.dayIndex,
        },
        autoFixable: true,
        suggestedFix: 'remove_duplicate',
      });
    }
    if (normalizedName) seenNames.add(normalizedName);
  }

  // Check ledger for cross-day duplicates
  const ledgerValidation = ledger.validateNoDuplicates();
  if (!ledgerValidation.valid) {
    for (const violation of ledgerValidation.violations) {
      violations.push({
        gate: 'DedupGate',
        severity: 'error',
        message: violation,
        details: { source: 'ledger' },
        autoFixable: true,
        suggestedFix: 'remove_duplicate',
      });
    }
  }

  return {
    gate: 'DedupGate',
    passed: violations.length === 0,
    violations,
  };
}

// =============================================================================
// ZONE GATE
// =============================================================================

/**
 * Validates zone coherence (limits cross-zone travel)
 */
export function runZoneGate(
  timeline: DayTimeline,
  config: ZoneGateConfig = DEFAULT_ZONE_CONFIG
): GateResult {
  const violations: GateViolation[] = [];

  const activities = timeline.slots.filter(s => s.type === 'activity' && s.candidate);

  // Count zones
  const zones = new Set<number>();
  for (const slot of activities) {
    if (slot.candidate?.zoneId !== undefined) {
      zones.add(slot.candidate.zoneId);
    }
  }

  if (zones.size > config.maxDailyZones) {
    violations.push({
      gate: 'ZoneGate',
      severity: 'warning',
      message: `Day ${timeline.dayIndex + 1} spans ${zones.size} zones (max ${config.maxDailyZones})`,
      details: {
        dayIndex: timeline.dayIndex,
        zoneCount: zones.size,
        maxAllowed: config.maxDailyZones,
        zones: Array.from(zones),
      },
      autoFixable: true,
      suggestedFix: 'recluster_day',
    });
  }

  // Count cross-zone transitions
  let crossZoneTrips = 0;
  let prevZone: number | null = null;

  for (const slot of activities) {
    const zone = slot.candidate?.zoneId;
    if (zone !== undefined) {
      if (prevZone !== null && zone !== prevZone) {
        crossZoneTrips++;
      }
      prevZone = zone;
    }
  }

  if (crossZoneTrips > config.maxCrossZoneTrips) {
    violations.push({
      gate: 'ZoneGate',
      severity: 'warning',
      message: `Day ${timeline.dayIndex + 1} has ${crossZoneTrips} cross-zone trips (max ${config.maxCrossZoneTrips})`,
      details: {
        dayIndex: timeline.dayIndex,
        crossZoneTrips,
        maxAllowed: config.maxCrossZoneTrips,
      },
      autoFixable: true,
      suggestedFix: 'reorder_for_zone_coherence',
    });
  }

  return {
    gate: 'ZoneGate',
    passed: violations.filter(v => v.severity === 'error').length === 0,
    violations,
  };
}

// =============================================================================
// TRAVEL GATE
// =============================================================================

/**
 * Validates travel time constraints
 */
export function runTravelGate(
  timeline: DayTimeline,
  config: TravelGateConfig = DEFAULT_TRAVEL_CONFIG
): GateResult {
  const violations: GateViolation[] = [];

  // Check individual leg travel times
  const travelSlots = timeline.slots.filter(s => s.type === 'travel');

  for (const slot of travelSlots) {
    if (slot.duration > config.maxPerLegMin) {
      violations.push({
        gate: 'TravelGate',
        severity: 'warning',
        message: `Travel leg of ${slot.duration} min exceeds ${config.maxPerLegMin} min limit`,
        details: {
          duration: slot.duration,
          maxAllowed: config.maxPerLegMin,
        },
        autoFixable: true,
        suggestedFix: 'recluster_or_reorder',
      });
    }
  }

  // Check total daily travel
  if (timeline.totalTravelMin > config.maxDailyTotalMin) {
    violations.push({
      gate: 'TravelGate',
      severity: 'error',
      message: `Total daily travel ${timeline.totalTravelMin} min exceeds ${config.maxDailyTotalMin} min limit`,
      details: {
        totalTravel: timeline.totalTravelMin,
        maxAllowed: config.maxDailyTotalMin,
        dayIndex: timeline.dayIndex,
      },
      autoFixable: true,
      suggestedFix: 'reduce_activities_or_recluster',
    });
  }

  return {
    gate: 'TravelGate',
    passed: violations.filter(v => v.severity === 'error').length === 0,
    violations,
  };
}

// =============================================================================
// COMBINED GATE RUNNER
// =============================================================================

export interface GateRunnerConfig {
  anchor?: AnchorGateConfig;
  duration?: DurationGateConfig;
  meal?: MealGateConfig;
  energy?: EnergyGateConfig;
  zone?: ZoneGateConfig;
  travel?: TravelGateConfig;
  ledger: GlobalLedger;
}

/**
 * Run all validation gates on a timeline
 */
export function runAllGates(
  timeline: DayTimeline,
  config: GateRunnerConfig
): AllGatesResult {
  const results: GateResult[] = [];

  // Run each gate
  results.push(runAnchorGate(timeline, config.anchor));
  results.push(runDurationGate(timeline, config.duration));
  results.push(runMealGate(timeline, config.meal));
  results.push(runEnergyGate(timeline, config.energy));
  results.push(runDedupGate(timeline, config.ledger));
  results.push(runZoneGate(timeline, config.zone));
  results.push(runTravelGate(timeline, config.travel));

  // Collect all violations
  const allViolations = results.flatMap(r => r.violations);
  const hardViolations = allViolations.filter(v => v.severity === 'error');
  const softViolations = allViolations.filter(v => v.severity === 'warning');

  return {
    allPassed: allViolations.length === 0,
    hardPassed: hardViolations.length === 0,
    softPassed: softViolations.length === 0,
    results,
    violations: allViolations,
    hardViolations,
    softViolations,
  };
}

// =============================================================================
// UTILITY HELPERS
// =============================================================================

function formatMinutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
}
