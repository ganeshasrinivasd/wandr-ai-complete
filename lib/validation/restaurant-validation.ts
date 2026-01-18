/**
 * Restaurant Validation Module
 *
 * Validates that meal venues are actual restaurants/cafes, not:
 * - Markets, bazaars, shopping areas
 * - Religious sites (temples, churches, mosques)
 * - Tourist attractions that happen to serve food
 * - Generic establishments
 *
 * Policy flag `allowFoodMarkets` can override market exclusion
 * if user explicitly wants food market experiences.
 */

import { EnrichedCandidate } from '../planning/types';

// =============================================================================
// EXCLUSION PATTERNS
// =============================================================================

/**
 * Google Place types that are NEVER valid restaurants
 */
const EXCLUDED_TYPES = new Set([
  // Religious sites
  'hindu_temple',
  'temple',
  'buddhist_temple',
  'jain_temple',
  'church',
  'mosque',
  'synagogue',
  'place_of_worship',
  // Tourist attractions
  'tourist_attraction',
  'museum',
  'park',
  'zoo',
  'aquarium',
  'amusement_park',
  // Shopping (excluded by default)
  'market',
  'shopping_mall',
  'store',
  'supermarket',
  'grocery_or_supermarket',
  'department_store',
  'convenience_store',
  // Generic
  'establishment',
  'point_of_interest',
  'locality',
  'political',
]);

/**
 * Name patterns that indicate NOT a restaurant (case-insensitive)
 */
const EXCLUDED_NAME_PATTERNS = [
  // Religious
  /\b(temple|mandir|kovil|gurdwara|masjid|mosque|church|cathedral|chapel|synagogue|dargah)\b/i,
  // Tourist attractions
  /\b(museum|fort|palace|zoo|park|aquarium)\b/i,
  // Markets and bazaars (excluded by default)
  /\b(market|bazaar|bazar|rythu|mandi|chowk|haat|mela)\b/i,
  // Shopping
  /\b(mall|shopping|store|supermarket|hypermarket|wholesale|model)\b/i,
  // Generic/placeholder
  /^(restaurant|cafe|food|eatery)$/i,
];

/**
 * Name patterns that indicate a VALID restaurant (overrides some exclusions)
 */
const VALID_RESTAURANT_PATTERNS = [
  /\b(restaurant|cafe|kitchen|diner|eatery|bistro|grill|pizzeria|trattoria)\b/i,
  /\b(dhaba|biryani|kebab|tandoor|mughlai|chinese|italian|thai|japanese|korean)\b/i,
  /\b(bakery|patisserie|confectionery|ice\s*cream)\b/i,
  /\b(bar|pub|brewery|lounge)\b/i,
];

/**
 * Google types that indicate a valid restaurant
 */
const VALID_RESTAURANT_TYPES = new Set([
  'restaurant',
  'cafe',
  'food',
  'meal_takeaway',
  'meal_delivery',
  'bakery',
  'bar',
]);

// =============================================================================
// VALIDATION POLICY
// =============================================================================

export interface RestaurantValidationPolicy {
  /** Allow food markets as meal venues (default: false) */
  allowFoodMarkets: boolean;
  /** Allow street food stalls (default: true) */
  allowStreetFood: boolean;
  /** Minimum rating for restaurants (default: 3.5) */
  minRating: number;
  /** Minimum review count (default: 10) */
  minReviewCount: number;
}

export const DEFAULT_RESTAURANT_POLICY: RestaurantValidationPolicy = {
  allowFoodMarkets: false,
  allowStreetFood: true,
  minRating: 3.5,
  minReviewCount: 10,
};

// =============================================================================
// VALIDATION FUNCTIONS
// =============================================================================

/**
 * Check if a candidate is a valid restaurant for meal scheduling
 *
 * @param candidate - The candidate to validate
 * @param policy - Validation policy (optional)
 * @returns true if valid restaurant, false otherwise
 */
export function isValidRestaurantStrict(
  candidate: EnrichedCandidate,
  policy: RestaurantValidationPolicy = DEFAULT_RESTAURANT_POLICY
): boolean {
  const nameLower = candidate.name.toLowerCase();
  const types = new Set((candidate.googleTypes || []).map(t => t.toLowerCase()));

  // Step 1: Check for hard exclusions (religious sites, attractions)
  const hardExcludedTypes = [
    'hindu_temple', 'temple', 'buddhist_temple', 'jain_temple',
    'church', 'mosque', 'synagogue', 'place_of_worship',
    'museum', 'zoo', 'aquarium', 'amusement_park',
  ];

  if (hardExcludedTypes.some(t => types.has(t))) {
    return false;
  }

  // Check name for religious/attraction patterns
  const hardExcludedNamePatterns = [
    /\b(temple|mandir|kovil|gurdwara|masjid|mosque|church|cathedral|synagogue|dargah)\b/i,
    /\b(museum|fort|palace|zoo|aquarium)\b/i,
  ];

  if (hardExcludedNamePatterns.some(p => p.test(nameLower))) {
    return false;
  }

  // Step 2: Check for market/bazaar exclusions (policy-dependent)
  if (!policy.allowFoodMarkets) {
    const marketTypes = ['market', 'shopping_mall', 'store', 'supermarket', 'grocery_or_supermarket'];
    if (marketTypes.some(t => types.has(t))) {
      return false;
    }

    const marketNamePatterns = [
      /\b(market|bazaar|bazar|rythu|mandi|chowk|haat|mela)\b/i,
      /\b(mall|shopping|store|supermarket|wholesale)\b/i,
    ];

    if (marketNamePatterns.some(p => p.test(nameLower))) {
      return false;
    }
  }

  // Step 3: Check for generic/placeholder names
  if (/^(restaurant|cafe|food|eatery)$/i.test(candidate.name.trim())) {
    return false;
  }

  // Step 4: Positive validation - must be a restaurant
  // Check category
  if (candidate.category === 'restaurant' || candidate.category === 'cafe') {
    return meetsQualityThresholds(candidate, policy);
  }

  // Check Google types
  if (Array.from(VALID_RESTAURANT_TYPES).some(t => types.has(t))) {
    return meetsQualityThresholds(candidate, policy);
  }

  // Check name patterns
  if (VALID_RESTAURANT_PATTERNS.some(p => p.test(nameLower))) {
    return meetsQualityThresholds(candidate, policy);
  }

  // Default: not a restaurant
  return false;
}

/**
 * Check if candidate meets quality thresholds
 */
function meetsQualityThresholds(
  candidate: EnrichedCandidate,
  policy: RestaurantValidationPolicy
): boolean {
  // Rating check (skip if no rating)
  if (candidate.rating && candidate.rating < policy.minRating) {
    return false;
  }

  // Review count check (skip if no reviews)
  if (candidate.reviewCount && candidate.reviewCount < policy.minReviewCount) {
    return false;
  }

  return true;
}

/**
 * Get rejection reason for a candidate (for debugging)
 */
export function getRestaurantRejectionReason(
  candidate: EnrichedCandidate,
  policy: RestaurantValidationPolicy = DEFAULT_RESTAURANT_POLICY
): string | null {
  const nameLower = candidate.name.toLowerCase();
  const types = new Set((candidate.googleTypes || []).map(t => t.toLowerCase()));

  // Check hard exclusions
  const hardExcludedTypes = [
    'hindu_temple', 'temple', 'buddhist_temple', 'jain_temple',
    'church', 'mosque', 'synagogue', 'place_of_worship',
    'museum', 'zoo', 'aquarium', 'amusement_park',
  ];

  for (const t of hardExcludedTypes) {
    if (types.has(t)) {
      return `Excluded type: ${t}`;
    }
  }

  // Check name patterns
  if (/\b(temple|mandir|kovil|gurdwara|masjid|mosque|church|cathedral|synagogue|dargah)\b/i.test(nameLower)) {
    return 'Name contains religious site pattern';
  }

  if (/\b(museum|fort|palace|zoo|aquarium)\b/i.test(nameLower)) {
    return 'Name contains attraction pattern';
  }

  // Check market exclusions
  if (!policy.allowFoodMarkets) {
    const marketTypes = ['market', 'shopping_mall', 'store', 'supermarket'];
    for (const t of marketTypes) {
      if (types.has(t)) {
        return `Market type excluded: ${t}`;
      }
    }

    if (/\b(market|bazaar|bazar|rythu|mandi|chowk)\b/i.test(nameLower)) {
      return 'Name contains market/bazaar pattern';
    }
  }

  // Check if it's actually a restaurant
  if (candidate.category !== 'restaurant' && candidate.category !== 'cafe') {
    if (!Array.from(VALID_RESTAURANT_TYPES).some(t => types.has(t))) {
      if (!VALID_RESTAURANT_PATTERNS.some(p => p.test(nameLower))) {
        return `Not identified as restaurant (category: ${candidate.category})`;
      }
    }
  }

  // Quality checks
  if (candidate.rating && candidate.rating < policy.minRating) {
    return `Rating ${candidate.rating} below minimum ${policy.minRating}`;
  }

  if (candidate.reviewCount && candidate.reviewCount < policy.minReviewCount) {
    return `Review count ${candidate.reviewCount} below minimum ${policy.minReviewCount}`;
  }

  return null; // Valid
}

/**
 * Filter candidates to only valid restaurants
 */
export function filterValidRestaurantsStrict(
  candidates: EnrichedCandidate[],
  policy: RestaurantValidationPolicy = DEFAULT_RESTAURANT_POLICY
): EnrichedCandidate[] {
  return candidates.filter(c => isValidRestaurantStrict(c, policy));
}

/**
 * Log validation results for debugging
 */
export function logRestaurantValidation(
  candidates: EnrichedCandidate[],
  policy: RestaurantValidationPolicy = DEFAULT_RESTAURANT_POLICY
): void {
  const valid: string[] = [];
  const invalid: Array<{ name: string; reason: string }> = [];

  for (const c of candidates) {
    const reason = getRestaurantRejectionReason(c, policy);
    if (reason) {
      invalid.push({ name: c.name, reason });
    } else {
      valid.push(c.name);
    }
  }

  console.log(`Restaurant validation: ${valid.length} valid, ${invalid.length} invalid`);
  if (invalid.length > 0) {
    console.log('Invalid candidates:');
    invalid.forEach(({ name, reason }) => {
      console.log(`  - ${name}: ${reason}`);
    });
  }
}
