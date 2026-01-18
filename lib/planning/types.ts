/**
 * Planning Types & Configuration
 *
 * Core interfaces for the optimizer v2 pipeline:
 * - Big rock detection and handling
 * - Duration priors by category
 * - Zone-based day allocation
 * - Meal scheduling with intent policy
 * - Feasibility checking and repair
 */

// =============================================================================
// BIG ROCK CONFIGURATION
// =============================================================================

export type BigRockType =
  | 'theme_park'
  | 'zoo'
  | 'aquarium'
  | 'major_museum'
  | 'water_park'
  | 'safari'
  | 'amusement_park';

export interface BigRockConfig {
  googleTypes: string[];           // Google Place types that indicate big rock
  nameKeywords: string[];          // Name patterns (case-insensitive)
  minReviewCount: number;          // High review count = likely major attraction
  durationRange: [number, number]; // [min, max] in minutes
  maxOtherActivities: number;      // Max additional activities on same day
  requiresFullDay: boolean;        // If true, should be only major activity
}

export const BIG_ROCK_CONFIGS: Record<BigRockType, BigRockConfig> = {
  theme_park: {
    googleTypes: ['theme_park', 'amusement_park'],
    nameKeywords: ['wonderla', 'disney', 'universal', 'world', 'kingdom', 'adventure', 'legoland', 'six flags'],
    minReviewCount: 10000,
    durationRange: [300, 420], // 5-7 hours
    maxOtherActivities: 1,
    requiresFullDay: true,
  },
  zoo: {
    googleTypes: ['zoo'],
    nameKeywords: ['zoo', 'zoological', 'wildlife park', 'safari park', 'animal park'],
    minReviewCount: 5000,
    durationRange: [180, 300], // 3-5 hours
    maxOtherActivities: 1,
    requiresFullDay: false,
  },
  aquarium: {
    googleTypes: ['aquarium'],
    nameKeywords: ['aquarium', 'sea world', 'oceanarium', 'marine', 'sealife'],
    minReviewCount: 5000,
    durationRange: [150, 240], // 2.5-4 hours
    maxOtherActivities: 2,
    requiresFullDay: false,
  },
  major_museum: {
    googleTypes: ['museum'],
    nameKeywords: ['national museum', 'state museum', 'british museum', 'louvre', 'smithsonian', 'metropolitan', 'natural history'],
    minReviewCount: 20000,
    durationRange: [180, 300], // 3-5 hours
    maxOtherActivities: 1,
    requiresFullDay: false,
  },
  water_park: {
    googleTypes: ['amusement_park'],
    nameKeywords: ['water park', 'waterpark', 'splash', 'aqua park', 'wave pool'],
    minReviewCount: 3000,
    durationRange: [240, 360], // 4-6 hours
    maxOtherActivities: 0,
    requiresFullDay: true,
  },
  safari: {
    googleTypes: ['zoo', 'park'],
    nameKeywords: ['safari', 'game reserve', 'wildlife sanctuary', 'national park safari'],
    minReviewCount: 3000,
    durationRange: [240, 360], // 4-6 hours
    maxOtherActivities: 1,
    requiresFullDay: true,
  },
  amusement_park: {
    googleTypes: ['amusement_park'],
    nameKeywords: ['fun world', 'amusement', 'funfair', 'carnival', 'fantasy'],
    minReviewCount: 5000,
    durationRange: [180, 300], // 3-5 hours
    maxOtherActivities: 1,
    requiresFullDay: false,
  },
};

// =============================================================================
// ACTIVITY CATEGORIES & DURATION PRIORS
// =============================================================================

export type ActivityCategory =
  | 'theme_park' | 'zoo' | 'aquarium' | 'museum' | 'major_museum'
  | 'landmark' | 'monument' | 'fort' | 'palace'
  | 'temple' | 'church' | 'mosque' | 'religious'
  | 'park' | 'garden' | 'viewpoint' | 'beach'
  | 'market' | 'shopping' | 'mall'
  | 'restaurant' | 'cafe' | 'bar'
  | 'tour' | 'experience' | 'show'
  | 'neighborhood' | 'walk' | 'lake' | 'unknown';

export interface DurationPrior {
  base: [number, number];           // [min, max] for standard case
  withHighReviews: [number, number]; // When reviewCount > threshold
  reviewThreshold: number;
  paceMultiplier: {                  // Adjust by user pace preference
    relaxed: number;
    moderate: number;
    packed: number;
  };
}

export const DURATION_PRIORS: Record<ActivityCategory, DurationPrior> = {
  theme_park:    { base: [300, 420], withHighReviews: [360, 480], reviewThreshold: 20000, paceMultiplier: { relaxed: 1.2, moderate: 1.0, packed: 0.8 } },
  zoo:           { base: [180, 300], withHighReviews: [240, 360], reviewThreshold: 15000, paceMultiplier: { relaxed: 1.2, moderate: 1.0, packed: 0.8 } },
  aquarium:      { base: [120, 180], withHighReviews: [150, 240], reviewThreshold: 10000, paceMultiplier: { relaxed: 1.2, moderate: 1.0, packed: 0.85 } },
  museum:        { base: [90, 150],  withHighReviews: [120, 180], reviewThreshold: 10000, paceMultiplier: { relaxed: 1.3, moderate: 1.0, packed: 0.75 } },
  major_museum:  { base: [180, 300], withHighReviews: [240, 360], reviewThreshold: 30000, paceMultiplier: { relaxed: 1.2, moderate: 1.0, packed: 0.8 } },
  landmark:      { base: [45, 90],   withHighReviews: [60, 120],  reviewThreshold: 20000, paceMultiplier: { relaxed: 1.3, moderate: 1.0, packed: 0.8 } },
  monument:      { base: [30, 60],   withHighReviews: [45, 90],   reviewThreshold: 15000, paceMultiplier: { relaxed: 1.3, moderate: 1.0, packed: 0.8 } },
  fort:          { base: [90, 180],  withHighReviews: [120, 240], reviewThreshold: 20000, paceMultiplier: { relaxed: 1.2, moderate: 1.0, packed: 0.8 } },
  palace:        { base: [90, 150],  withHighReviews: [120, 180], reviewThreshold: 15000, paceMultiplier: { relaxed: 1.2, moderate: 1.0, packed: 0.85 } },
  temple:        { base: [45, 90],   withHighReviews: [60, 120],  reviewThreshold: 30000, paceMultiplier: { relaxed: 1.3, moderate: 1.0, packed: 0.8 } },
  church:        { base: [30, 60],   withHighReviews: [45, 90],   reviewThreshold: 20000, paceMultiplier: { relaxed: 1.3, moderate: 1.0, packed: 0.8 } },
  mosque:        { base: [30, 60],   withHighReviews: [45, 90],   reviewThreshold: 20000, paceMultiplier: { relaxed: 1.3, moderate: 1.0, packed: 0.8 } },
  religious:     { base: [30, 75],   withHighReviews: [45, 90],   reviewThreshold: 15000, paceMultiplier: { relaxed: 1.3, moderate: 1.0, packed: 0.8 } },
  park:          { base: [60, 120],  withHighReviews: [90, 150],  reviewThreshold: 10000, paceMultiplier: { relaxed: 1.3, moderate: 1.0, packed: 0.7 } },
  garden:        { base: [45, 90],   withHighReviews: [60, 120],  reviewThreshold: 8000,  paceMultiplier: { relaxed: 1.3, moderate: 1.0, packed: 0.7 } },
  viewpoint:     { base: [20, 45],   withHighReviews: [30, 60],   reviewThreshold: 5000,  paceMultiplier: { relaxed: 1.2, moderate: 1.0, packed: 0.8 } },
  beach:         { base: [90, 180],  withHighReviews: [120, 240], reviewThreshold: 10000, paceMultiplier: { relaxed: 1.3, moderate: 1.0, packed: 0.7 } },
  market:        { base: [60, 120],  withHighReviews: [90, 150],  reviewThreshold: 10000, paceMultiplier: { relaxed: 1.2, moderate: 1.0, packed: 0.8 } },
  shopping:      { base: [60, 120],  withHighReviews: [90, 150],  reviewThreshold: 8000,  paceMultiplier: { relaxed: 1.2, moderate: 1.0, packed: 0.75 } },
  mall:          { base: [90, 180],  withHighReviews: [120, 240], reviewThreshold: 15000, paceMultiplier: { relaxed: 1.2, moderate: 1.0, packed: 0.7 } },
  restaurant:    { base: [60, 90],   withHighReviews: [75, 105],  reviewThreshold: 5000,  paceMultiplier: { relaxed: 1.2, moderate: 1.0, packed: 0.85 } },
  cafe:          { base: [30, 60],   withHighReviews: [45, 75],   reviewThreshold: 3000,  paceMultiplier: { relaxed: 1.3, moderate: 1.0, packed: 0.8 } },
  bar:           { base: [60, 120],  withHighReviews: [90, 150],  reviewThreshold: 3000,  paceMultiplier: { relaxed: 1.2, moderate: 1.0, packed: 0.85 } },
  tour:          { base: [120, 180], withHighReviews: [150, 240], reviewThreshold: 5000,  paceMultiplier: { relaxed: 1.1, moderate: 1.0, packed: 0.9 } },
  experience:    { base: [60, 120],  withHighReviews: [90, 150],  reviewThreshold: 3000,  paceMultiplier: { relaxed: 1.1, moderate: 1.0, packed: 0.9 } },
  show:          { base: [90, 150],  withHighReviews: [120, 180], reviewThreshold: 5000,  paceMultiplier: { relaxed: 1.0, moderate: 1.0, packed: 1.0 } },
  neighborhood:  { base: [60, 120],  withHighReviews: [90, 150],  reviewThreshold: 5000,  paceMultiplier: { relaxed: 1.3, moderate: 1.0, packed: 0.7 } },
  walk:          { base: [45, 90],   withHighReviews: [60, 120],  reviewThreshold: 3000,  paceMultiplier: { relaxed: 1.2, moderate: 1.0, packed: 0.8 } },
  lake:          { base: [45, 90],   withHighReviews: [60, 120],  reviewThreshold: 8000,  paceMultiplier: { relaxed: 1.3, moderate: 1.0, packed: 0.8 } },
  unknown:       { base: [45, 90],   withHighReviews: [60, 120],  reviewThreshold: 10000, paceMultiplier: { relaxed: 1.2, moderate: 1.0, packed: 0.8 } },
};

// =============================================================================
// ZONE & TRAVEL CONSTRAINTS
// =============================================================================

export interface ZoneConfig {
  maxZonesPerDay: number;           // Prefer 1, allow 2 max
  maxConsecutiveTravelMin: number;  // Max travel between consecutive activities
  maxDailyTravelMin: number;        // Max total travel in a day
  crossZonePenalty: number;         // Penalty multiplier for cross-zone hops
  zoneMergeDistanceKm: number;      // Merge zones closer than this
}

export const DEFAULT_ZONE_CONFIG: ZoneConfig = {
  maxZonesPerDay: 1,
  maxConsecutiveTravelMin: 35,
  maxDailyTravelMin: 100,
  crossZonePenalty: 3.0,
  zoneMergeDistanceKm: 2.0,
};

// =============================================================================
// MEAL POLICY & CONFIGURATION
// =============================================================================

export type MealIntent = 'booked' | 'suggested' | 'area_only';

export interface MealSlot {
  type: 'breakfast' | 'lunch' | 'dinner';
  windowStart: number;    // Minutes from day start (e.g., 720 = noon)
  windowEnd: number;
  durationMin: number;
  intent: MealIntent;
  venue?: EnrichedCandidate;         // If booked/suggested
  nearbyOptions?: EnrichedCandidate[]; // If area_only, 2-4 options
}

export interface MealConfig {
  breakfast: { window: [number, number]; duration: number };
  lunch:     { window: [number, number]; duration: number };
  dinner:    { window: [number, number]; duration: number };
  defaultIntentByDayType: {
    bigRock: MealIntent;
    normal: MealIntent;
    lowConfidence: MealIntent;
  };
}

export const DEFAULT_MEAL_CONFIG: MealConfig = {
  breakfast: { window: [0, 90], duration: 45 },       // 8:00-9:30 AM (from day start)
  lunch:     { window: [210, 330], duration: 60 },    // 11:30 AM - 1:30 PM
  dinner:    { window: [540, 660], duration: 75 },    // 5:00 - 7:00 PM
  defaultIntentByDayType: {
    bigRock: 'area_only',
    normal: 'suggested',
    lowConfidence: 'area_only',
  },
};

// =============================================================================
// ENRICHED CANDIDATE (Post-processing)
// =============================================================================

export interface EnrichedCandidate {
  // From retrieval
  id: string;
  placeId?: string;
  name: string;
  normalizedName: string;
  location: { lat: number; lng: number };
  googleTypes: string[];
  rating: number;
  reviewCount: number;
  priceLevel?: number;
  photoUrl?: string;
  vicinity?: string;

  // Computed
  category: ActivityCategory;
  categoryConfidence: number;      // 0-1
  isBigRock: boolean;
  bigRockType?: BigRockType;
  durationMin: number;
  durationMax: number;
  durationExpected: number;        // Mid-point adjusted by confidence

  // Zone assignment
  zoneId?: number;

  // Dedup tracking
  dedupKey: string;
  isGeneric: boolean;              // "View Point", "Restaurant", etc.

  // Utility score for selection
  utilityScore: number;
}

// =============================================================================
// ZONE STRUCTURE
// =============================================================================

export interface Zone {
  id: number;
  centroid: { lat: number; lng: number };
  candidates: EnrichedCandidate[];
  totalUtility: number;
  hasBigRock: boolean;
  bigRocks: EnrichedCandidate[];
  name?: string;  // Human-readable zone name (e.g., "Old City", "Tech Park Area")
}

// =============================================================================
// DAY TIMELINE
// =============================================================================

export interface TimelineSlot {
  type: 'activity' | 'meal' | 'travel' | 'buffer';
  startMin: number;                 // Minutes from day start
  endMin: number;
  duration: number;
  candidate?: EnrichedCandidate;
  mealSlot?: MealSlot;
  travelFromPrevious?: number;      // Travel time in minutes
}

export interface DayTimeline {
  dayIndex: number;
  zoneId: number;
  primaryZoneName?: string;
  isBigRockDay: boolean;
  bigRock?: EnrichedCandidate;
  slots: TimelineSlot[];
  totalActivityMin: number;
  totalTravelMin: number;
  totalMealMin: number;
  totalBufferMin: number;
  budgetUsed: number;
  budgetRemaining: number;
}

// =============================================================================
// FEASIBILITY & REPAIR
// =============================================================================

export interface FeasibilityIssue {
  type: 'over_budget' | 'excessive_travel' | 'cross_zone' | 'missing_anchor' | 'missing_meal';
  severity: 'error' | 'warning';
  dayIndex: number;
  message: string;
  overflowMin?: number;
  suggestedRepair?: RepairAction;
}

export type RepairAction =
  | { type: 'reorder' }
  | { type: 'swap'; candidateOut: string; candidateIn: string }
  | { type: 'shrink'; candidateId: string; newDuration: number }
  | { type: 'compress_buffer'; newBufferMin: number }
  | { type: 'drop'; candidateId: string }
  | { type: 'backtrack' };

export interface FeasibilityReport {
  isValid: boolean;
  issues: FeasibilityIssue[];
  perDaySummary: {
    dayIndex: number;
    budgetUsed: number;
    travelMin: number;
    activityCount: number;
    hasAnchor: boolean;
  }[];
}

// =============================================================================
// TRAVEL MATRIX
// =============================================================================

export type TravelMatrix = Map<string, Map<string, number>>; // id -> id -> minutes

// =============================================================================
// OPTIMIZER CONFIG
// =============================================================================

export interface OptimizerConfig {
  dayBudgetMinutes: number;       // Total available minutes per day (e.g., 600)
  dayStartTime: number;           // Minutes from midnight (e.g., 480 = 8:00 AM)
  pace: 'relaxed' | 'moderate' | 'packed';
  bufferBetweenActivities: number; // Default buffer in minutes
  minBufferBetweenActivities: number; // Minimum allowed after compression
  zoneConfig: ZoneConfig;
  mealConfig: MealConfig;
  maxRepairIterations: number;
}

export const DEFAULT_OPTIMIZER_CONFIG: OptimizerConfig = {
  dayBudgetMinutes: 600,          // 10 hours
  dayStartTime: 480,              // 8:00 AM
  pace: 'moderate',
  bufferBetweenActivities: 15,
  minBufferBetweenActivities: 5,
  zoneConfig: DEFAULT_ZONE_CONFIG,
  mealConfig: DEFAULT_MEAL_CONFIG,
  maxRepairIterations: 10,
};
