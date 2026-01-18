/**
 * Optimizer v3 Configuration
 *
 * Extended configuration with all v3 parameters including anchor policy,
 * zone validation, travel estimation, and pruning settings.
 */

import { AnchorPolicy, PlanTraceConfigConflict } from '../types/optimizer-v3';

// =============================================================================
// OPTIMIZER V3 CONFIG INTERFACE
// =============================================================================

export interface OptimizerV3Config {
  // -------------------------------------------------------------------------
  // Day Budget & Timing
  // -------------------------------------------------------------------------
  /** Total available minutes per day (computed from end - start) */
  dayBudgetMinutes: number;
  /** Day start time in minutes from midnight (e.g., 480 = 8:00 AM) */
  dayStartTime: number;
  /** Day end time in minutes from midnight (e.g., 1260 = 9:00 PM) */
  dayEndTime: number;
  /** User pace preference */
  pace: 'relaxed' | 'moderate' | 'packed';
  /** Default buffer between activities in minutes */
  bufferMinutesBetweenSlots: number;
  /** Minimum buffer after compression in minutes */
  minBufferMinutes: number;

  // -------------------------------------------------------------------------
  // Anchor Policy
  // -------------------------------------------------------------------------
  /** Maximum geographic spread for a day's activities in km */
  maxDayDiameterKm: number;
  /** Fraction of days that must have at least one anchor (0-1) */
  minAnchorsPerDayCoverage: number;
  /** Maximum total anchors to select */
  maxAnchorsTotalDefault: number;
  /** Minimum reviews for anchor eligibility */
  anchorReviewCountThreshold: number;
  /** Minimum iconic score for anchor eligibility (0-1) */
  anchorIconicScoreThreshold: number;

  // -------------------------------------------------------------------------
  // Travel Estimation
  // -------------------------------------------------------------------------
  /** Number of legs per day to validate with real travel API */
  topNLegsRealTravelValidation: number;
  /** Time bucket granularity for travel cache in minutes */
  timeBucketMinutes: number;
  /** Default travel mode */
  defaultTravelMode: 'driving' | 'walking' | 'transit';

  // -------------------------------------------------------------------------
  // Zone Validation
  // -------------------------------------------------------------------------
  /** Maximum POI count imbalance ratio between zones */
  maxZoneToMinZonePoiRatio: number;
  /** Maximum planned minutes imbalance ratio between zones */
  maxZoneMinutesToMinZoneMinutesRatio: number;

  // -------------------------------------------------------------------------
  // Big Rock Handling
  // -------------------------------------------------------------------------
  /** Duration threshold for Big Rock classification in minutes */
  bigRockThresholdMinutes: number;
  /** Maximum small POIs alongside a Big Rock */
  maxAdditionalPoisOnBigRockDay: number;

  // -------------------------------------------------------------------------
  // Meal Placeholders
  // -------------------------------------------------------------------------
  /** Duration for meal placeholder blocks in minutes */
  mealPlaceholderMinutes: number;

  // -------------------------------------------------------------------------
  // Repair & Swap
  // -------------------------------------------------------------------------
  /** Radius for "nearby" candidate swaps during repair in km */
  nearbySwapRadiusKm: number;
  /** Relative utility threshold below which POI may be dropped (0-1) */
  lowUtilityThreshold: number;

  // -------------------------------------------------------------------------
  // Deduplication
  // -------------------------------------------------------------------------
  /** Distance threshold for near-duplicate merge in meters */
  dedupMergeRadiusMeters: number;

  // -------------------------------------------------------------------------
  // Candidate Pruning
  // -------------------------------------------------------------------------
  /** Maximum candidates per day for pruning */
  maxCandidatesPerDay: number;
  /** Maximum total candidate pool after pruning */
  maxCandidatePoolTotal: number;
  /** Top K candidates to keep per geohash cell */
  topKPerGeohashCell: number;

  // -------------------------------------------------------------------------
  // DBSCAN Clustering
  // -------------------------------------------------------------------------
  /** DBSCAN epsilon (max distance between points) in km */
  dbscanEpsilonKm: number;
  /** DBSCAN minimum points to form a cluster */
  dbscanMinPoints: number;

  // -------------------------------------------------------------------------
  // PlanTrace
  // -------------------------------------------------------------------------
  /** Number of recent plan traces to retain locally */
  planTraceRetentionCount: number;

  // -------------------------------------------------------------------------
  // Max Repair Iterations
  // -------------------------------------------------------------------------
  /** Maximum repair iterations per day */
  maxRepairIterations: number;
}

// =============================================================================
// DEFAULT CONFIGURATION
// =============================================================================

export const DEFAULT_OPTIMIZER_V3_CONFIG: OptimizerV3Config = {
  // Day Budget & Timing
  dayBudgetMinutes: 780, // 13 hours (8 AM to 9 PM)
  dayStartTime: 480,     // 8:00 AM
  dayEndTime: 1260,      // 9:00 PM
  pace: 'moderate',
  bufferMinutesBetweenSlots: 15,
  minBufferMinutes: 5,

  // Anchor Policy
  maxDayDiameterKm: 8,
  minAnchorsPerDayCoverage: 0.67,
  maxAnchorsTotalDefault: 12,
  anchorReviewCountThreshold: 10000,
  anchorIconicScoreThreshold: 0.7,

  // Travel Estimation
  topNLegsRealTravelValidation: 4,
  timeBucketMinutes: 60,
  defaultTravelMode: 'driving',

  // Zone Validation
  maxZoneToMinZonePoiRatio: 2.0,
  maxZoneMinutesToMinZoneMinutesRatio: 1.8,

  // Big Rock Handling
  bigRockThresholdMinutes: 180,
  maxAdditionalPoisOnBigRockDay: 2,

  // Meal Placeholders
  mealPlaceholderMinutes: 60,

  // Repair & Swap
  nearbySwapRadiusKm: 2.0,
  lowUtilityThreshold: 0.3,

  // Deduplication
  dedupMergeRadiusMeters: 300,

  // Candidate Pruning
  maxCandidatesPerDay: 30,
  maxCandidatePoolTotal: 200,
  topKPerGeohashCell: 10,

  // DBSCAN Clustering (epsilon = maxDayDiameterKm / 5)
  dbscanEpsilonKm: 1.6,
  dbscanMinPoints: 3,

  // PlanTrace
  planTraceRetentionCount: 50,

  // Max Repair Iterations
  maxRepairIterations: 10,
};

// =============================================================================
// DEFAULT ANCHOR POLICY
// =============================================================================

export const DEFAULT_ANCHOR_POLICY: AnchorPolicy = {
  minTotalAnchors: 3,
  minAnchorsPerDay: 1,
  maxAnchorsPerDay: 3,
  diversityTargets: {
    categories: ['landmark', 'museum', 'park', 'temple', 'beach'],
    minCategoryCoverage: 0.5,
  },
};

// =============================================================================
// CONFIG VALIDATION
// =============================================================================

export interface ConfigValidationResult {
  isValid: boolean;
  conflicts: PlanTraceConfigConflict[];
  clampedConfig: OptimizerV3Config;
}

/**
 * Validate and clamp optimizer config.
 * Returns clamped config and any conflicts found.
 */
export function validateOptimizerConfig(
  config: Partial<OptimizerV3Config>,
  anchorPolicy?: AnchorPolicy
): ConfigValidationResult {
  const conflicts: PlanTraceConfigConflict[] = [];
  const merged = { ...DEFAULT_OPTIMIZER_V3_CONFIG, ...config };
  const policy = anchorPolicy || DEFAULT_ANCHOR_POLICY;

  // Validate: minTotalAnchors <= maxAnchorsTotalDefault
  if (policy.minTotalAnchors > merged.maxAnchorsTotalDefault) {
    conflicts.push({
      code: 'ANCHOR_MIN_GT_MAX',
      message: `minTotalAnchors (${policy.minTotalAnchors}) > maxAnchorsTotalDefault (${merged.maxAnchorsTotalDefault}), clamping`,
      field: 'minTotalAnchors',
      value: policy.minTotalAnchors,
      clampedTo: merged.maxAnchorsTotalDefault,
    });
    // Note: We don't modify policy here, caller should handle
  }

  // Validate: dayStartTime < dayEndTime
  if (merged.dayStartTime >= merged.dayEndTime) {
    conflicts.push({
      code: 'INVALID_DAY_WINDOW',
      message: `dayStartTime (${merged.dayStartTime}) >= dayEndTime (${merged.dayEndTime}), using defaults`,
      field: 'dayStartTime',
      value: merged.dayStartTime,
      clampedTo: DEFAULT_OPTIMIZER_V3_CONFIG.dayStartTime,
    });
    merged.dayStartTime = DEFAULT_OPTIMIZER_V3_CONFIG.dayStartTime;
    merged.dayEndTime = DEFAULT_OPTIMIZER_V3_CONFIG.dayEndTime;
  }

  // Recompute dayBudgetMinutes
  merged.dayBudgetMinutes = merged.dayEndTime - merged.dayStartTime;

  // Validate: dayBudgetMinutes > 0
  if (merged.dayBudgetMinutes <= 0) {
    conflicts.push({
      code: 'NEGATIVE_BUDGET',
      message: `dayBudgetMinutes (${merged.dayBudgetMinutes}) <= 0, using default`,
      field: 'dayBudgetMinutes',
      value: merged.dayBudgetMinutes,
      clampedTo: DEFAULT_OPTIMIZER_V3_CONFIG.dayBudgetMinutes,
    });
    merged.dayBudgetMinutes = DEFAULT_OPTIMIZER_V3_CONFIG.dayBudgetMinutes;
  }

  // Validate: maxDayDiameterKm > 0
  if (merged.maxDayDiameterKm <= 0) {
    conflicts.push({
      code: 'OTHER',
      message: `maxDayDiameterKm (${merged.maxDayDiameterKm}) <= 0, using default`,
      field: 'maxDayDiameterKm',
      value: merged.maxDayDiameterKm,
      clampedTo: DEFAULT_OPTIMIZER_V3_CONFIG.maxDayDiameterKm,
    });
    merged.maxDayDiameterKm = DEFAULT_OPTIMIZER_V3_CONFIG.maxDayDiameterKm;
  }

  // Recompute DBSCAN epsilon based on maxDayDiameterKm
  if (!config.dbscanEpsilonKm) {
    merged.dbscanEpsilonKm = merged.maxDayDiameterKm / 5;
  }

  return {
    isValid: conflicts.length === 0,
    conflicts,
    clampedConfig: merged,
  };
}

/**
 * Create config for a specific pace.
 */
export function createConfigForPace(
  pace: 'relaxed' | 'moderate' | 'packed',
  overrides?: Partial<OptimizerV3Config>
): OptimizerV3Config {
  const paceAdjustments: Record<string, Partial<OptimizerV3Config>> = {
    relaxed: {
      dayStartTime: 540,  // 9:00 AM
      dayEndTime: 1200,   // 8:00 PM
      bufferMinutesBetweenSlots: 20,
      maxAdditionalPoisOnBigRockDay: 1,
    },
    moderate: {
      dayStartTime: 480,  // 8:00 AM
      dayEndTime: 1260,   // 9:00 PM
      bufferMinutesBetweenSlots: 15,
      maxAdditionalPoisOnBigRockDay: 2,
    },
    packed: {
      dayStartTime: 420,  // 7:00 AM
      dayEndTime: 1320,   // 10:00 PM
      bufferMinutesBetweenSlots: 10,
      maxAdditionalPoisOnBigRockDay: 3,
    },
  };

  const baseConfig = {
    ...DEFAULT_OPTIMIZER_V3_CONFIG,
    ...paceAdjustments[pace],
    pace,
    ...overrides,
  };

  // Recompute dayBudgetMinutes
  baseConfig.dayBudgetMinutes = baseConfig.dayEndTime - baseConfig.dayStartTime;

  return baseConfig;
}
