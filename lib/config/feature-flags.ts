/**
 * Feature Flags
 *
 * Central configuration for feature toggles in the optimizer v3 pipeline.
 * These flags control optional functionality that can be enabled/disabled.
 */

export interface FeatureFlags {
  /**
   * Enable meal planning (restaurant retrieval and scheduling).
   * When false: no restaurant retrieval, no restaurant slots, only meal_placeholder blocks.
   * Default: false
   */
  ENABLE_MEALS: boolean;

  /**
   * Enable real travel time validation using Distance Matrix API.
   * When false: only heuristic travel times are used.
   * Default: true
   */
  ENABLE_REAL_TRAVEL_VALIDATION: boolean;

  /**
   * Enable DBSCAN fallback clustering when K-means validation fails.
   * When false: only K-means clustering is used.
   * Default: true
   */
  ENABLE_DBSCAN_FALLBACK: boolean;

  /**
   * Enable PlanTrace persistence to disk.
   * When false: PlanTrace is created but not persisted.
   * Default: true
   */
  ENABLE_PLAN_TRACE_PERSISTENCE: boolean;

  /**
   * Enable anchor-first scheduling in optimizer.
   * When false: uses legacy utility-based selection.
   * Default: true
   */
  ENABLE_ANCHOR_FIRST_SCHEDULING: boolean;
}

/**
 * Default feature flags for production.
 * ENABLE_MEALS is OFF by default - meals are time blocks only.
 */
export const DEFAULT_FEATURE_FLAGS: FeatureFlags = {
  ENABLE_MEALS: false,
  ENABLE_REAL_TRAVEL_VALIDATION: true,
  ENABLE_DBSCAN_FALLBACK: true,
  ENABLE_PLAN_TRACE_PERSISTENCE: true,
  ENABLE_ANCHOR_FIRST_SCHEDULING: true,
};

// Runtime feature flag storage (can be overridden)
let currentFlags: FeatureFlags = { ...DEFAULT_FEATURE_FLAGS };

/**
 * Get current feature flags.
 * Returns a copy to prevent mutation.
 */
export function getFeatureFlags(): FeatureFlags {
  return { ...currentFlags };
}

/**
 * Set feature flags (for testing or runtime configuration).
 * Merges with current flags.
 */
export function setFeatureFlags(flags: Partial<FeatureFlags>): void {
  currentFlags = { ...currentFlags, ...flags };
}

/**
 * Reset feature flags to defaults.
 */
export function resetFeatureFlags(): void {
  currentFlags = { ...DEFAULT_FEATURE_FLAGS };
}

/**
 * Check if a specific feature is enabled.
 */
export function isFeatureEnabled(flag: keyof FeatureFlags): boolean {
  return currentFlags[flag];
}

/**
 * Environment-based feature flag initialization.
 * Reads from process.env if available.
 */
export function initFeatureFlagsFromEnv(): void {
  if (typeof process !== 'undefined' && process.env) {
    const envFlags: Partial<FeatureFlags> = {};

    if (process.env.ENABLE_MEALS !== undefined) {
      envFlags.ENABLE_MEALS = process.env.ENABLE_MEALS === 'true';
    }
    if (process.env.ENABLE_REAL_TRAVEL_VALIDATION !== undefined) {
      envFlags.ENABLE_REAL_TRAVEL_VALIDATION = process.env.ENABLE_REAL_TRAVEL_VALIDATION !== 'false';
    }
    if (process.env.ENABLE_DBSCAN_FALLBACK !== undefined) {
      envFlags.ENABLE_DBSCAN_FALLBACK = process.env.ENABLE_DBSCAN_FALLBACK !== 'false';
    }
    if (process.env.ENABLE_PLAN_TRACE_PERSISTENCE !== undefined) {
      envFlags.ENABLE_PLAN_TRACE_PERSISTENCE = process.env.ENABLE_PLAN_TRACE_PERSISTENCE !== 'false';
    }
    if (process.env.ENABLE_ANCHOR_FIRST_SCHEDULING !== undefined) {
      envFlags.ENABLE_ANCHOR_FIRST_SCHEDULING = process.env.ENABLE_ANCHOR_FIRST_SCHEDULING !== 'false';
    }

    setFeatureFlags(envFlags);
  }
}
