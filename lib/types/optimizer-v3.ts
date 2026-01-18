/**
 * Optimizer v3 Types
 *
 * Central type definitions for the v3 optimizer pipeline.
 * All downstream components after canonical registry use EnrichedCandidateCanonical only.
 */

import { ActivityCategory, BigRockType } from '../planning/types';

// =============================================================================
// PLACE IDENTITY HELPERS
// =============================================================================

/** Raw provider ID (e.g., Google Place ID) */
export type RawPlaceId = string;

/** Canonical place ID: pid:<raw> or fallback normalizedName|city|geohash6 */
export type CanonicalPlaceId = string;

/** Reference to a canonical place with provenance */
export interface PlaceRef {
  canonicalId: CanonicalPlaceId;
  rawIds: RawPlaceId[];
}

// =============================================================================
// REASON CODE ENUMS
// =============================================================================

export enum DropReasonCode {
  DUPLICATE_CANONICAL = 'DUPLICATE_CANONICAL',
  ANCHOR_POLICY_MAX_REACHED = 'ANCHOR_POLICY_MAX_REACHED',
  DAY_DIAMETER_EXCEEDED = 'DAY_DIAMETER_EXCEEDED',
  TIME_BUDGET_EXCEEDED = 'TIME_BUDGET_EXCEEDED',
  TRAVEL_TIME_EXCEEDED_REAL = 'TRAVEL_TIME_EXCEEDED_REAL',
  OPEN_HOURS_CONFLICT = 'OPEN_HOURS_CONFLICT',
  LOW_UTILITY = 'LOW_UTILITY',
  AVOID_INCLUDE = 'AVOID_INCLUDE',
  ZONE_IMBALANCE = 'ZONE_IMBALANCE',
  BIG_ROCK_DAY_LIMIT = 'BIG_ROCK_DAY_LIMIT',
  PRUNED_LOW_UTILITY = 'PRUNED_LOW_UTILITY',
  PRUNER_CAP_EXCEEDED = 'PRUNER_CAP_EXCEEDED',
  PRUNER_GEOHASH_TOPK = 'PRUNER_GEOHASH_TOPK',
}

export enum RepairActionCode {
  REORDER_2OPT = 'REORDER_2OPT',
  DROP_LOWEST_UTILITY = 'DROP_LOWEST_UTILITY',
  SWAP_NEARBY = 'SWAP_NEARBY',
  MOVE_TO_ADJACENT_DAY = 'MOVE_TO_ADJACENT_DAY',
  SHRINK_DURATION = 'SHRINK_DURATION',
  COMPRESS_BUFFERS = 'COMPRESS_BUFFERS',
  RELAX_DIAMETER_THRESHOLD = 'RELAX_DIAMETER_THRESHOLD',
}

export enum InfeasibilityReasonCode {
  NO_VALID_OPEN_WINDOW = 'NO_VALID_OPEN_WINDOW',
  EXCEEDS_ALL_DAY_BUDGETS = 'EXCEEDS_ALL_DAY_BUDGETS',
  HARD_CONSTRAINT_VIOLATION = 'HARD_CONSTRAINT_VIOLATION',
  ZONE_ASSIGNMENT_IMPOSSIBLE = 'ZONE_ASSIGNMENT_IMPOSSIBLE',
}

export enum TravelValidationExceptionCode {
  NOT_ENOUGH_LEGS = 'NOT_ENOUGH_LEGS',
  API_QUOTA_EXCEEDED = 'API_QUOTA_EXCEEDED',
  VALIDATION_DISABLED = 'VALIDATION_DISABLED',
}

export type FeasibilityViolationType =
  | 'TIME_BUDGET_EXCEEDED'
  | 'DAY_DIAMETER_EXCEEDED'
  | 'OPEN_HOURS_CONFLICT'
  | 'TRAVEL_TIME_EXCEEDED_REAL'
  | 'TRAVEL_TIME_EXCEEDED_EST'
  | 'BIG_ROCK_DAY_LIMIT'
  | 'MISSING_ANCHOR'
  | 'MISSING_MEAL';

// =============================================================================
// ENRICHED CANDIDATE TYPES
// =============================================================================

/** Base interface for enriched candidate (shared fields) */
export interface EnrichedCandidateBase {
  name: string;
  normalizedName: string;
  location: { lat: number; lng: number };
  category: ActivityCategory;
  categoryConfidence: number;
  durationMinutes: number;
  durationMin: number;
  durationMax: number;
  rating: number;
  reviewCount: number;
  priceLevel?: number;
  photoUrl?: string;
  vicinity?: string;
  googleTypes: string[];
  iconicScore: number;
  utilityScore: number;
  isBigRock: boolean;
  bigRockType?: BigRockType;
  dedupKey: string;
  isGeneric: boolean;
  geohash6?: string;
}

/** Enriched candidate with raw provider ID (pre-canonicalization) */
export interface EnrichedCandidateRaw extends EnrichedCandidateBase {
  rawId: RawPlaceId;
}

/** Enriched candidate with canonical ID (post-canonicalization) */
export interface EnrichedCandidateCanonical extends EnrichedCandidateBase {
  canonicalId: CanonicalPlaceId;
  rawIds: RawPlaceId[];
}

// =============================================================================
// ANCHOR TYPES
// =============================================================================

export interface AnchorPolicy {
  minTotalAnchors: number;
  minAnchorsPerDay: number;
  maxAnchorsPerDay: number;
  diversityTargets: {
    categories: string[];
    minCategoryCoverage: number;
  };
}

/** Anchor candidate with raw ID (pre-canonicalization) */
export interface AnchorCandidateRaw {
  rawId: RawPlaceId;
  name: string;
  iconicScore: number;
  reviewCount: number;
  rating: number;
  category: string;
  location: { lat: number; lng: number };
}

/** Anchor candidate with canonical ID (post-canonicalization) */
export interface AnchorCandidate {
  canonicalId: CanonicalPlaceId;
  rawIds: RawPlaceId[];
  name: string;
  iconicScore: number;
  reviewCount: number;
  rating: number;
  category: string;
  location: { lat: number; lng: number };
}

export interface AnchorSelectionResult {
  anchors: AnchorCandidateRaw[];
  infeasibleAnchors: Array<{
    rawId: RawPlaceId;
    reasonCode: InfeasibilityReasonCode;
  }>;
}

// =============================================================================
// TIMELINE TYPES
// =============================================================================

export type TimelineSlotType = 'activity' | 'meal' | 'travel' | 'buffer' | 'meal_placeholder';

export interface TimelineSlotV3 {
  type: TimelineSlotType;
  startMin: number;
  endMin: number;
  duration: number;
  candidate?: EnrichedCandidateCanonical;
  travelFromPrevious?: number;
  placeholderType?: 'breakfast' | 'lunch' | 'dinner';
}

export interface DayTimelineV3 {
  dayIndex: number;
  zoneId: number;
  primaryZoneName?: string;
  isBigRockDay: boolean;
  bigRock?: EnrichedCandidateCanonical;
  slots: TimelineSlotV3[];
  totalActivityMin: number;
  totalTravelMin: number;
  totalMealMin: number;
  totalBufferMin: number;
  budgetUsed: number;
  budgetRemaining: number;
  anchorsScheduled: number;
}

// =============================================================================
// ZONE TYPES
// =============================================================================

export interface ZoneV3 {
  id: number;
  centroid: { lat: number; lng: number };
  candidates: EnrichedCandidateCanonical[];
  totalUtility: number;
  hasBigRock: boolean;
  bigRocks: EnrichedCandidateCanonical[];
  name?: string;
  diameterKm?: number;
}

export interface ZoneValidationResult {
  isValid: boolean;
  violations: Array<{
    zoneId: number;
    type: 'diameter_exceeded' | 'time_infeasible' | 'poi_imbalance' | 'minutes_imbalance';
    value: number;
    threshold: number;
  }>;
  zoneDiameters: Map<number, number>;
  zoneLoads: Map<number, { poiCount: number; plannedMinutes: number }>;
}

export interface ZoneBuilderResult {
  zones: ZoneV3[];
  assignmentByCanonicalId: Record<CanonicalPlaceId, number>;
  pinnedByCanonicalId: Record<CanonicalPlaceId, 'anchor' | 'big_rock'>;
  validation: ZoneValidationResult;
  fallbackUsed: boolean;
  method: 'kmeans' | 'dbscan' | 'graph';
}

// =============================================================================
// CANONICAL REGISTRY TYPES
// =============================================================================

export interface CanonicalPlace {
  canonicalId: CanonicalPlaceId;
  name: string;
  normalizedName: string;
  location: { lat: number; lng: number };
  geohash6: string;
  reviewCount: number;
  rating: number;
  categories: string[];
  photoUrls: string[];
  rawIds: RawPlaceId[];
}

export interface CanonicalRegistryResult {
  canonicalPlacesById: Map<CanonicalPlaceId, CanonicalPlace>;
  rawIdToCanonicalId: Map<RawPlaceId, CanonicalPlaceId>;
  mustInclude: CanonicalPlaceId[];
  avoidInclude: CanonicalPlaceId[];
  anchors: AnchorCandidate[];
  idMappingFailures: Array<{
    rawId: RawPlaceId;
    source: 'mustInclude' | 'avoidInclude';
    reason: 'RAW_ID_NOT_FOUND' | 'FETCH_FAILED';
  }>;
  mergeLog: Array<{
    canonicalId: CanonicalPlaceId;
    mergedRawIds: RawPlaceId[];
    reason: 'exact_key' | 'near_duplicate';
  }>;
}

// =============================================================================
// PLAN TRACE TYPES
// =============================================================================

export interface PlanTraceConfigConflict {
  code: 'ANCHOR_MIN_GT_MAX' | 'INVALID_DAY_WINDOW' | 'NEGATIVE_BUDGET' | 'OTHER';
  message: string;
  field?: string;
  value?: unknown;
  clampedTo?: unknown;
}

export interface PlanTrace {
  runId: string;
  timestamp: string;

  config?: {
    conflicts: PlanTraceConfigConflict[];
  };

  retrieval: {
    totalCandidates: number;
    afterFilters: number;
    afterDedup: number;
    afterPruning: number;
    anchorsSelected: number;
    anchorsInfeasible: number;
  };

  pruning: {
    droppedCount: number;
    droppedByCategory: Record<string, number>;
    droppedByGeohash: Record<string, number>;
    droppedTopExamples: Array<{ id: string; name: string; reasonCode: DropReasonCode }>;
  };

  idMapping: {
    missingRawIds: Array<{
      rawId: RawPlaceId;
      source: 'mustInclude' | 'avoidInclude';
      reason: 'RAW_ID_NOT_FOUND' | 'FETCH_FAILED';
    }>;
  };

  anchors: {
    selected: Array<{ canonicalId: CanonicalPlaceId; name: string; iconicScore: number }>;
    dropped: Array<{ canonicalId: CanonicalPlaceId; name: string; reasonCode: DropReasonCode }>;
    infeasible: Array<{ canonicalId: CanonicalPlaceId; name: string; reasonCode: InfeasibilityReasonCode }>;
  };

  zoning: {
    method: 'kmeans' | 'dbscan' | 'graph';
    zoneCount: number;
    zoneDiameters: Record<number, number>;
    zoneLoads: Record<number, { poiCount: number; plannedMinutes: number }>;
    validationPassed: boolean;
    fallbackUsed: boolean;
    pinnedCandidates: Record<CanonicalPlaceId, 'anchor' | 'big_rock'>;
  };

  optimization: {
    perDay: Array<{
      dayIndex: number;
      selected: Array<{ id: CanonicalPlaceId; name: string }>;
      dropped: Array<{ id: CanonicalPlaceId; name: string; reasonCode: DropReasonCode }>;
      mealPlaceholderIncluded: boolean;
      mealPlaceholderOmittedReason?: string;
    }>;
  };

  feasibility: {
    violations: Array<{
      dayIndex: number;
      type: FeasibilityViolationType;
      message: string;
    }>;
    repairs: Array<{
      dayIndex: number;
      actionCode: RepairActionCode;
      details: string;
    }>;
    finalStatus: 'pass' | 'fail';
  };

  travelMetrics: {
    legsValidated: number;
    legsRequested: number;
    validationExceptions: TravelValidationExceptionCode[];
    estimatedVsRealDeltas: Array<{
      dayIndex: number;
      fromCanonicalId: CanonicalPlaceId;
      toCanonicalId: CanonicalPlaceId;
      estimated: number;
      real: number;
      delta: number;
    }>;
  };
}

// =============================================================================
// ICONIC SCORE WEIGHTS
// =============================================================================

export const ICONIC_SCORE_WEIGHTS = {
  reviewCount: 0.35,
  rating: 0.25,
  categoryPrior: 0.25,
  globalPopularityRank: 0.15,
};

export const CATEGORY_PRIORS: Record<string, number> = {
  landmark: 0.9,
  major_museum: 0.85,
  theme_park: 0.85,
  monument: 0.8,
  palace: 0.8,
  fort: 0.75,
  temple: 0.7,
  museum: 0.7,
  zoo: 0.7,
  aquarium: 0.65,
  beach: 0.6,
  park: 0.5,
  garden: 0.5,
  viewpoint: 0.5,
  market: 0.45,
  neighborhood: 0.4,
  unknown: 0.3,
};

export const UTILITY_SCORE_WEIGHTS = {
  iconic: 0.35,
  userPrefs: 0.25,
  diversity: 0.15,
  quality: 0.15,
  travelPenalty: 0.10,
};
