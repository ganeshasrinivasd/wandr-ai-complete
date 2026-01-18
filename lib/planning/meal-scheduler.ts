/**
 * Meal Scheduler
 *
 * Handles meal slot injection with intent policies:
 * - booked: Specific restaurant selected
 * - suggested: Recommend a restaurant, not mandatory
 * - area_only: Just suggest area, user picks restaurant
 *
 * Key rules:
 * - Never assign non-restaurants to meal slots
 * - Big rock days default to area_only
 * - Select restaurants near activities in the same zone
 * - CRITICAL: Respects used tracking to prevent duplicates
 * - When includeRestaurants=false, meals are time blocks only (no venue selection)
 */

import {
  MealSlot,
  MealConfig,
  MealIntent,
  EnrichedCandidate,
  DayTimeline,
  TimelineSlot,
  DEFAULT_MEAL_CONFIG,
} from './types';
import { haversineDistance } from '../utils/duration-estimator';
import { TripLedger } from '../utils/trip-ledger';
import {
  isValidRestaurantStrict,
  filterValidRestaurantsStrict,
  RestaurantValidationPolicy,
  DEFAULT_RESTAURANT_POLICY,
} from '../validation/restaurant-validation';

// =============================================================================
// MEAL SCHEDULING OPTIONS
// =============================================================================

export interface MealSchedulingOptions {
  /** If false, meals are time blocks only with no restaurant venues */
  includeRestaurants: boolean;
  /** Restaurant validation policy */
  restaurantPolicy: RestaurantValidationPolicy;
}

export const DEFAULT_MEAL_SCHEDULING_OPTIONS: MealSchedulingOptions = {
  includeRestaurants: false, // Default: no restaurant selection
  restaurantPolicy: DEFAULT_RESTAURANT_POLICY,
};

// =============================================================================
// MAIN MEAL SCHEDULING
// =============================================================================

/**
 * Schedule meals into a day timeline
 *
 * CRITICAL: Now accepts a TripLedger to track used restaurants and prevent duplicates.
 * The ledger is updated in-place when a restaurant is selected.
 *
 * When options.includeRestaurants=false, meals are inserted as time blocks only
 * with area hints but no specific venue selection.
 *
 * @param timeline - The day timeline to add meals to
 * @param restaurants - All available restaurant candidates
 * @param config - Meal configuration
 * @param ledger - TripLedger for tracking used candidates (optional for backward compat)
 * @param options - Meal scheduling options (includeRestaurants flag)
 */
export function scheduleMeals(
  timeline: DayTimeline,
  restaurants: EnrichedCandidate[],
  config: MealConfig = DEFAULT_MEAL_CONFIG,
  ledger?: TripLedger,
  options: MealSchedulingOptions | RestaurantValidationPolicy = DEFAULT_MEAL_SCHEDULING_OPTIONS
): DayTimeline {
  // Handle backward compatibility: if options is RestaurantValidationPolicy, convert
  const schedulingOptions: MealSchedulingOptions = 
    'includeRestaurants' in options 
      ? options 
      : { includeRestaurants: false, restaurantPolicy: options };

  const meals: ('lunch' | 'dinner')[] = ['lunch', 'dinner'];
  const newSlots = [...timeline.slots];

  // Determine meal policy based on day type
  let mealIntent: MealIntent;
  if (!schedulingOptions.includeRestaurants) {
    // When restaurants disabled, always use area_only
    mealIntent = 'area_only';
  } else if (timeline.isBigRockDay) {
    mealIntent = config.defaultIntentByDayType.bigRock;
  } else {
    mealIntent = config.defaultIntentByDayType.normal;
  }

  let totalMealMin = 0;

  for (const mealType of meals) {
    const mealConfig = config[mealType];

    // Find best insertion point within meal window
    const insertionPoint = findMealInsertionPoint(
      newSlots,
      mealConfig.window[0],
      mealConfig.window[1]
    );

    if (insertionPoint === null) continue;

    // Get nearby activities for area hint calculation
    const nearbyActivities = findNearbyActivities(newSlots, insertionPoint, 3);

    // Create meal slot
    const mealSlot = schedulingOptions.includeRestaurants
      ? createMealSlotWithLedger(
          mealType,
          mealConfig,
          mealIntent,
          restaurants,
          nearbyActivities,
          timeline.zoneId,
          timeline.dayIndex,
          ledger,
          schedulingOptions.restaurantPolicy
        )
      : createMealSlotWithoutVenue(
          mealType,
          mealConfig,
          nearbyActivities,
          timeline.primaryZoneName
        );

    // Insert meal slot
    const mealTimelineSlot: TimelineSlot = {
      type: 'meal',
      startMin: 0, // Will be recalculated
      endMin: 0,
      duration: mealConfig.duration,
      mealSlot,
    };

    newSlots.splice(insertionPoint, 0, mealTimelineSlot);
    totalMealMin += mealConfig.duration;
  }

  // Recalculate timeline with meals
  return recalculateTimeline({
    ...timeline,
    slots: newSlots,
    totalMealMin,
  });
}

/**
 * Create a meal slot WITHOUT venue selection (time block only)
 * Used when includeRestaurants=false
 */
export function createMealSlotWithoutVenue(
  mealType: 'breakfast' | 'lunch' | 'dinner',
  config: { window: [number, number]; duration: number },
  nearbyActivities: EnrichedCandidate[],
  zoneName?: string
): MealSlot {
  // Calculate area hint from nearby activities or zone
  let areaHint = zoneName || 'the area';
  
  if (nearbyActivities.length > 0) {
    // Use vicinity of nearest activity if available
    const nearestWithVicinity = nearbyActivities.find(a => a.vicinity);
    if (nearestWithVicinity?.vicinity) {
      // Extract neighborhood from vicinity (usually format: "Street, Neighborhood, City")
      const parts = nearestWithVicinity.vicinity.split(',');
      if (parts.length >= 2) {
        areaHint = parts[1].trim();
      } else {
        areaHint = nearestWithVicinity.vicinity;
      }
    }
  }

  return {
    type: mealType,
    windowStart: config.window[0],
    windowEnd: config.window[1],
    durationMin: config.duration,
    intent: 'area_only',
    venue: undefined,
    nearbyOptions: undefined,
    areaHint,
    note: `${mealType.charAt(0).toUpperCase() + mealType.slice(1)} break - explore local restaurants near ${areaHint}`,
  };
}

// =============================================================================
// MEAL SLOT CREATION
// =============================================================================

/**
 * Create a meal slot with restaurant selection based on policy
 * CRITICAL: Uses ledger for used-aware filtering to prevent duplicates
 */
export function createMealSlotWithLedger(
  mealType: 'breakfast' | 'lunch' | 'dinner',
  config: { window: [number, number]; duration: number },
  policy: MealIntent,
  restaurants: EnrichedCandidate[],
  nearbyActivities: EnrichedCandidate[],
  zoneId: number,
  dayIndex: number,
  ledger?: TripLedger,
  restaurantPolicy: RestaurantValidationPolicy = DEFAULT_RESTAURANT_POLICY
): MealSlot {
  // Step 1: Filter to only actual restaurants/cafes using strict validation
  let validRestaurants = filterValidRestaurantsStrict(restaurants, restaurantPolicy);

  // Step 2: CRITICAL - Filter out already-used restaurants
  if (ledger) {
    const beforeCount = validRestaurants.length;
    validRestaurants = validRestaurants.filter(r => !ledger.has(r));
    const filtered = beforeCount - validRestaurants.length;
    if (filtered > 0) {
      console.log(`  → ${mealType}: Filtered ${filtered} already-used restaurants`);
    }
  }

  // Log warning if no valid restaurants found
  if (validRestaurants.length === 0) {
    console.warn(`⚠️ No valid restaurants found for ${mealType} in zone ${zoneId}`);
    console.warn(`  Total candidates: ${restaurants.length}`);
    if (restaurants.length > 0) {
      console.warn(`  Sample invalid: ${restaurants.slice(0, 3).map(r => `${r.name} (${r.googleTypes?.join(', ')})`).join(', ')}`);
    }
  }

  // Calculate centroid of nearby activities
  const centroid = calculateCentroid(nearbyActivities);

  // Score and sort restaurants
  const scoredRestaurants = validRestaurants
    .map(r => ({
      restaurant: r,
      score: scoreRestaurantForMeal(r, centroid, zoneId),
    }))
    .sort((a, b) => b.score - a.score);

  const mealSlot: MealSlot = {
    type: mealType,
    windowStart: config.window[0],
    windowEnd: config.window[1],
    durationMin: config.duration,
    intent: scoredRestaurants.length === 0 ? 'area_only' : policy, // Fallback to area_only if no restaurants
  };

  switch (mealSlot.intent) {
    case 'booked':
    case 'suggested':
      // Pick top restaurant if available
      if (scoredRestaurants.length > 0) {
        const selectedVenue = scoredRestaurants[0].restaurant;
        mealSlot.venue = selectedVenue;

        // CRITICAL: Mark as used immediately to prevent reuse in same day
        if (ledger) {
          ledger.add(selectedVenue, dayIndex, 'meal');
          console.log(`  → ${mealType}: Selected "${selectedVenue.name}" (marked as used)`);
        }
      } else {
        // Fallback: no specific venue, just area suggestion
        console.warn(`⚠️ No restaurants available for ${mealType}, falling back to area suggestion`);
      }
      break;

    case 'area_only':
      // Provide 2-4 nearby options if available (don't mark as used)
      if (scoredRestaurants.length > 0) {
        mealSlot.nearbyOptions = scoredRestaurants
          .slice(0, 4)
          .map(s => s.restaurant);
      } else {
        // No restaurants found at all - this is the problematic case
        console.warn(`⚠️ No restaurants found for ${mealType} meal slot - this may cause issues`);
      }
      break;
  }

  return mealSlot;
}

/**
 * Create a meal slot with restaurant selection based on policy
 * @deprecated Use createMealSlotWithLedger for proper duplicate prevention
 */
export function createMealSlot(
  mealType: 'breakfast' | 'lunch' | 'dinner',
  config: { window: [number, number]; duration: number },
  policy: MealIntent,
  restaurants: EnrichedCandidate[],
  nearbyActivities: EnrichedCandidate[],
  zoneId: number
): MealSlot {
  // Delegate to new function without ledger (backward compat)
  return createMealSlotWithLedger(
    mealType,
    config,
    policy,
    restaurants,
    nearbyActivities,
    zoneId,
    -1, // Unknown day index
    undefined, // No ledger
    DEFAULT_RESTAURANT_POLICY
  );
}

// =============================================================================
// RESTAURANT FILTERING
// =============================================================================

/**
 * Filter to only include actual restaurants and cafes
 * This is CRITICAL to prevent assigning temples/markets to meal slots
 * @deprecated Use filterValidRestaurantsStrict from restaurant-validation.ts
 */
export function filterValidRestaurants(
  candidates: EnrichedCandidate[]
): EnrichedCandidate[] {
  return candidates.filter(c => isValidRestaurant(c));
}

/**
 * Check if a candidate is a valid restaurant/cafe
 * IMPORTANT: Excludes religious sites, temples, markets, and other non-food establishments
 * @deprecated Use isValidRestaurantStrict from restaurant-validation.ts for stricter validation
 */
export function isValidRestaurant(candidate: EnrichedCandidate): boolean {
  const nameLower = candidate.name.toLowerCase();
  const types = candidate.googleTypes?.map(t => t.toLowerCase()) || [];

  // EXCLUSION LIST - these are NEVER restaurants even if they serve food
  const excludedTypes = [
    'hindu_temple', 'temple', 'buddhist_temple', 'jain_temple',
    'church', 'mosque', 'synagogue', 'place_of_worship',
    'tourist_attraction', 'point_of_interest', 'museum',
    'park', 'zoo', 'aquarium', 'amusement_park',
    'market', 'shopping_mall', 'store', 'supermarket',     // Markets & stores
    'establishment', 'grocery_or_supermarket'              // Generic establishments
  ];

  const excludedNamePatterns = [
    'temple', 'mandir', 'kovil', 'gurdwara', 'masjid', 'mosque',
    'church', 'cathedral', 'chapel', 'synagogue', 'dargah',
    'museum', 'fort', 'palace', 'zoo', 'park',
    'bazaar', 'market', 'rythu', 'mandi', 'chowk', 'haat',  // Market patterns
    'shopping', 'mall', 'store', 'supermarket',             // Shopping patterns
    'model', 'wholesale'                                     // Wholesale/model patterns
  ];

  // If any excluded type is present, NOT a restaurant
  if (types.some(t => excludedTypes.includes(t))) {
    return false;
  }

  // If name contains excluded patterns, NOT a restaurant
  if (excludedNamePatterns.some(p => nameLower.includes(p))) {
    return false;
  }

  // Now check if it IS a restaurant
  if (candidate.category === 'restaurant' || candidate.category === 'cafe') {
    return true;
  }

  const validTypes = ['restaurant', 'cafe', 'food', 'meal_takeaway', 'bakery', 'bar'];
  return types.some(t => validTypes.includes(t));
}

// =============================================================================
// RESTAURANT SCORING
// =============================================================================

/**
 * Score a restaurant for meal selection
 */
export function scoreRestaurantForMeal(
  restaurant: EnrichedCandidate,
  centroid: { lat: number; lng: number },
  zoneId: number
): number {
  let score = 0;

  // Base score from rating (0-10 points)
  score += restaurant.rating * 2;

  // Popularity bonus (0-10 points, log scale)
  score += Math.min(Math.log10(restaurant.reviewCount + 1) * 2, 10);

  // Same zone bonus (20 points) - important to avoid cross-zone travel
  if (restaurant.zoneId === zoneId) {
    score += 20;
  }

  // Distance penalty from centroid (-5 points per km)
  const distKm = haversineDistance(restaurant.location, centroid);
  score -= distKm * 5;

  // Price level bonus (reasonable = 1-3)
  if (restaurant.priceLevel !== undefined) {
    if (restaurant.priceLevel >= 1 && restaurant.priceLevel <= 3) {
      score += 5;
    }
  }

  return score;
}

// =============================================================================
// INSERTION POINT FINDING
// =============================================================================

/**
 * Find the best insertion point for a meal within the time window
 */
export function findMealInsertionPoint(
  slots: TimelineSlot[],
  windowStart: number,
  windowEnd: number
): number | null {
  // Calculate cumulative time to find slot positions
  let currentTime = 0;
  const slotTimes: { index: number; startMin: number; endMin: number }[] = [];

  for (let i = 0; i < slots.length; i++) {
    slotTimes.push({
      index: i,
      startMin: currentTime,
      endMin: currentTime + slots[i].duration,
    });
    currentTime += slots[i].duration;
  }

  // Find best insertion point within meal window
  // Prefer inserting after activities, not during travel/buffer

  for (let i = 0; i < slotTimes.length; i++) {
    const slot = slotTimes[i];

    // Check if this slot ends within meal window
    if (slot.endMin >= windowStart && slot.endMin <= windowEnd) {
      // Prefer inserting after activity slots
      if (slots[slot.index].type === 'activity') {
        return slot.index + 1;
      }
    }
  }

  // Fallback: find any gap within window
  for (let i = 0; i < slotTimes.length; i++) {
    const slot = slotTimes[i];

    if (slot.endMin >= windowStart && slot.startMin <= windowEnd) {
      return slot.index + 1;
    }
  }

  // Last fallback: insert at middle of day
  const midWindow = (windowStart + windowEnd) / 2;
  for (let i = 0; i < slotTimes.length; i++) {
    if (slotTimes[i].startMin >= midWindow) {
      return i;
    }
  }

  // Append at end
  return slots.length;
}

/**
 * Find activities near the insertion point for restaurant proximity calculation
 */
export function findNearbyActivities(
  slots: TimelineSlot[],
  insertionPoint: number,
  count: number
): EnrichedCandidate[] {
  const activities: EnrichedCandidate[] = [];

  // Look backward for nearby activities
  for (let i = insertionPoint - 1; i >= 0 && activities.length < count; i--) {
    if (slots[i].type === 'activity' && slots[i].candidate) {
      activities.push(slots[i].candidate!);
    }
  }

  // Look forward for nearby activities
  for (let i = insertionPoint; i < slots.length && activities.length < count; i++) {
    if (slots[i].type === 'activity' && slots[i].candidate) {
      activities.push(slots[i].candidate!);
    }
  }

  return activities;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Calculate centroid of activity locations
 */
function calculateCentroid(
  activities: EnrichedCandidate[]
): { lat: number; lng: number } {
  if (activities.length === 0) {
    return { lat: 0, lng: 0 };
  }

  return {
    lat: activities.reduce((s, a) => s + a.location.lat, 0) / activities.length,
    lng: activities.reduce((s, a) => s + a.location.lng, 0) / activities.length,
  };
}

/**
 * Recalculate timeline with updated slots
 */
function recalculateTimeline(timeline: DayTimeline): DayTimeline {
  let currentMin = 0;
  const updatedSlots = timeline.slots.map(slot => {
    const updated = {
      ...slot,
      startMin: currentMin,
      endMin: currentMin + slot.duration,
    };
    currentMin += slot.duration;
    return updated;
  });

  const totalActivityMin = updatedSlots
    .filter(s => s.type === 'activity')
    .reduce((t, s) => t + s.duration, 0);

  const totalTravelMin = updatedSlots
    .filter(s => s.type === 'travel')
    .reduce((t, s) => t + s.duration, 0);

  const totalBufferMin = updatedSlots
    .filter(s => s.type === 'buffer')
    .reduce((t, s) => t + s.duration, 0);

  const totalMealMin = updatedSlots
    .filter(s => s.type === 'meal')
    .reduce((t, s) => t + s.duration, 0);

  const newBudgetUsed = totalActivityMin + totalTravelMin + totalBufferMin + totalMealMin;

  // Calculate day budget from original values (budgetUsed + budgetRemaining = dayBudget)
  const dayBudget = (timeline.budgetUsed ?? 0) + (timeline.budgetRemaining ?? 0);

  return {
    ...timeline,
    slots: updatedSlots,
    totalActivityMin,
    totalTravelMin,
    totalBufferMin,
    totalMealMin,
    budgetUsed: newBudgetUsed,
    budgetRemaining: Math.max(0, dayBudget - newBudgetUsed),
  };
}

// =============================================================================
// MEAL POLICY HELPERS
// =============================================================================

/**
 * Determine meal policy based on day characteristics
 */
export function determineMealPolicy(
  isBigRockDay: boolean,
  restaurantConfidence: number, // 0-1, how confident we are in restaurant data
  config: MealConfig = DEFAULT_MEAL_CONFIG
): MealIntent {
  if (isBigRockDay) {
    return config.defaultIntentByDayType.bigRock;
  }

  if (restaurantConfidence < 0.5) {
    return config.defaultIntentByDayType.lowConfidence;
  }

  return config.defaultIntentByDayType.normal;
}

/**
 * Get restaurants within a zone for meal suggestions
 */
export function getRestaurantsInZone(
  restaurants: EnrichedCandidate[],
  zoneId: number
): EnrichedCandidate[] {
  const valid = filterValidRestaurants(restaurants);
  return valid.filter(r => r.zoneId === zoneId);
}

/**
 * Get the best restaurant near a specific location
 */
export function getBestRestaurantNear(
  restaurants: EnrichedCandidate[],
  location: { lat: number; lng: number },
  maxDistanceKm: number = 2
): EnrichedCandidate | null {
  const valid = filterValidRestaurants(restaurants);

  const nearby = valid
    .map(r => ({
      restaurant: r,
      distance: haversineDistance(r.location, location),
    }))
    .filter(r => r.distance <= maxDistanceKm)
    .sort((a, b) => {
      // Sort by utility score, with small distance penalty
      const aScore = a.restaurant.utilityScore - a.distance * 0.5;
      const bScore = b.restaurant.utilityScore - b.distance * 0.5;
      return bScore - aScore;
    });

  return nearby.length > 0 ? nearby[0].restaurant : null;
}
