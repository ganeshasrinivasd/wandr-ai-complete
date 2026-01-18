/**
 * Duration Estimator Module
 *
 * STRATEGY SUMMARY:
 * Estimates realistic visit durations using:
 * 1. Category-based priors (base duration by place type)
 * 2. Name-based scale detection (keywords like "Studios", "National Park")
 * 3. Opening hours constraints (cap duration if limited hours)
 * 4. User pace modifiers (relaxed/normal/packed)
 * 5. Big Rock rules (theme parks, hikes dominate a day)
 * 6. Feasibility checking and repair suggestions
 *
 * v2 additions:
 * - BigRock detection with confidence scoring
 * - Category normalization with Google types
 * - Integration with new planning/types.ts
 */

import { Candidate } from './types';
import {
  BigRockType,
  BIG_ROCK_CONFIGS,
  ActivityCategory,
  DURATION_PRIORS as NEW_DURATION_PRIORS,
} from '../planning/types';

// ============================================================================
// A) DURATION PRIOR TABLE
// ============================================================================

export interface DurationPrior {
  baseMinutes: number;
  minMinutes: number;
  maxMinutes: number;
  isBigRock: boolean;        // Dominates the day
  category: string;
}

/**
 * Category -> Base duration priors
 * Based on typical visitor behavior patterns
 */
export const DURATION_PRIORS: Record<string, DurationPrior> = {
  // ===== BIG ROCKS (dominate the day) =====
  'theme_park': {
    baseMinutes: 420,  // 7 hours
    minMinutes: 300,   // 5 hours minimum
    maxMinutes: 600,   // 10 hours max
    isBigRock: true,
    category: 'Theme Park',
  },
  'amusement_park': {
    baseMinutes: 420,
    minMinutes: 300,
    maxMinutes: 600,
    isBigRock: true,
    category: 'Amusement Park',
  },
  'water_park': {
    baseMinutes: 300,
    minMinutes: 180,
    maxMinutes: 420,
    isBigRock: true,
    category: 'Water Park',
  },
  'national_park': {
    baseMinutes: 360,  // 6 hours
    minMinutes: 180,
    maxMinutes: 600,
    isBigRock: true,
    category: 'National Park',
  },
  'day_hike': {
    baseMinutes: 300,
    minMinutes: 180,
    maxMinutes: 480,
    isBigRock: true,
    category: 'Day Hike',
  },
  'safari': {
    baseMinutes: 300,
    minMinutes: 180,
    maxMinutes: 480,
    isBigRock: true,
    category: 'Safari',
  },
  'guided_tour_full': {
    baseMinutes: 360,
    minMinutes: 240,
    maxMinutes: 480,
    isBigRock: true,
    category: 'Full-Day Tour',
  },

  // ===== LARGE ATTRACTIONS (half-day) =====
  'zoo': {
    baseMinutes: 210,  // 3.5 hours
    minMinutes: 120,
    maxMinutes: 300,
    isBigRock: false,  // Can be big rock if major zoo
    category: 'Zoo',
  },
  'aquarium': {
    baseMinutes: 150,  // 2.5 hours
    minMinutes: 90,
    maxMinutes: 240,
    isBigRock: false,
    category: 'Aquarium',
  },
  'large_museum': {
    baseMinutes: 180,  // 3 hours
    minMinutes: 120,
    maxMinutes: 300,
    isBigRock: false,
    category: 'Large Museum',
  },
  'botanical_garden': {
    baseMinutes: 120,
    minMinutes: 60,
    maxMinutes: 180,
    isBigRock: false,
    category: 'Botanical Garden',
  },

  // ===== STANDARD ATTRACTIONS (1-3 hours) =====
  'museum': {
    baseMinutes: 120,  // 2 hours
    minMinutes: 60,
    maxMinutes: 180,
    isBigRock: false,
    category: 'Museum',
  },
  'art_gallery': {
    baseMinutes: 90,
    minMinutes: 45,
    maxMinutes: 150,
    isBigRock: false,
    category: 'Art Gallery',
  },
  'palace': {
    baseMinutes: 90,
    minMinutes: 60,
    maxMinutes: 150,
    isBigRock: false,
    category: 'Palace',
  },
  'castle': {
    baseMinutes: 90,
    minMinutes: 60,
    maxMinutes: 150,
    isBigRock: false,
    category: 'Castle',
  },
  'historic_site': {
    baseMinutes: 75,
    minMinutes: 45,
    maxMinutes: 120,
    isBigRock: false,
    category: 'Historic Site',
  },
  'park': {
    baseMinutes: 75,
    minMinutes: 30,
    maxMinutes: 180,
    isBigRock: false,
    category: 'Park',
  },
  'beach': {
    baseMinutes: 180,
    minMinutes: 60,
    maxMinutes: 360,
    isBigRock: false,  // Can become big rock based on user intent
    category: 'Beach',
  },
  'market': {
    baseMinutes: 90,
    minMinutes: 45,
    maxMinutes: 150,
    isBigRock: false,
    category: 'Market',
  },
  'shopping_mall': {
    baseMinutes: 120,
    minMinutes: 60,
    maxMinutes: 240,
    isBigRock: false,
    category: 'Shopping Mall',
  },
  'outlet': {
    baseMinutes: 180,
    minMinutes: 90,
    maxMinutes: 300,
    isBigRock: false,
    category: 'Outlet Mall',
  },

  // ===== QUICK VISITS (30-60 minutes) =====
  'tourist_attraction': {
    baseMinutes: 60,
    minMinutes: 30,
    maxMinutes: 120,
    isBigRock: false,
    category: 'Attraction',
  },
  'landmark': {
    baseMinutes: 30,
    minMinutes: 15,
    maxMinutes: 60,
    isBigRock: false,
    category: 'Landmark',
  },
  'monument': {
    baseMinutes: 30,
    minMinutes: 15,
    maxMinutes: 60,
    isBigRock: false,
    category: 'Monument',
  },
  'viewpoint': {
    baseMinutes: 30,
    minMinutes: 15,
    maxMinutes: 45,
    isBigRock: false,
    category: 'Viewpoint',
  },
  'photo_stop': {
    baseMinutes: 20,
    minMinutes: 10,
    maxMinutes: 30,
    isBigRock: false,
    category: 'Photo Stop',
  },
  'church': {
    baseMinutes: 45,
    minMinutes: 20,
    maxMinutes: 90,
    isBigRock: false,
    category: 'Church',
  },
  'temple': {
    baseMinutes: 60,
    minMinutes: 30,
    maxMinutes: 120,
    isBigRock: false,
    category: 'Temple',
  },
  'hindu_temple': {
    baseMinutes: 60,
    minMinutes: 30,
    maxMinutes: 120,
    isBigRock: false,
    category: 'Temple',
  },
  'mosque': {
    baseMinutes: 45,
    minMinutes: 20,
    maxMinutes: 90,
    isBigRock: false,
    category: 'Mosque',
  },

  // ===== FOOD & DRINK =====
  'restaurant': {
    baseMinutes: 75,
    minMinutes: 45,
    maxMinutes: 120,
    isBigRock: false,
    category: 'Restaurant',
  },
  'fine_dining': {
    baseMinutes: 120,
    minMinutes: 90,
    maxMinutes: 180,
    isBigRock: false,
    category: 'Fine Dining',
  },
  'cafe': {
    baseMinutes: 45,
    minMinutes: 20,
    maxMinutes: 90,
    isBigRock: false,
    category: 'Cafe',
  },
  'bar': {
    baseMinutes: 60,
    minMinutes: 30,
    maxMinutes: 120,
    isBigRock: false,
    category: 'Bar',
  },
  'food_court': {
    baseMinutes: 45,
    minMinutes: 30,
    maxMinutes: 60,
    isBigRock: false,
    category: 'Food Court',
  },

  // ===== NEIGHBORHOODS =====
  'neighborhood': {
    baseMinutes: 120,
    minMinutes: 60,
    maxMinutes: 240,
    isBigRock: false,
    category: 'Neighborhood Walk',
  },

  // Default
  'default': {
    baseMinutes: 60,
    minMinutes: 30,
    maxMinutes: 120,
    isBigRock: false,
    category: 'Attraction',
  },
};

// ============================================================================
// B) MODIFIERS AND RULES
// ============================================================================

/**
 * Keywords that indicate larger/longer attractions
 */
const SCALE_KEYWORDS = {
  fullDay: [
    'universal studios', 'disneyland', 'disney world', 'disneyworld',
    'theme park', 'water park', 'legoland', 'six flags', 'seaworld',
    'sea world', 'busch gardens', 'cedar point', 'knott\'s berry',
    'national park', 'safari park', 'adventure park',
  ],
  halfDay: [
    'zoo', 'aquarium', 'botanical garden', 'gardens', 'outlet',
    'science center', 'science museum', 'natural history',
    'smithsonian', 'metropolitan museum', 'louvre', 'british museum',
    'vatican museum', 'uffizi', 'prado', 'rijksmuseum',
  ],
  extended: [
    'studios', 'world', 'land', 'kingdom', 'resort', 'complex',
    'center', 'centre', 'institute', 'national',
  ],
  quick: [
    'viewpoint', 'overlook', 'lookout', 'bridge', 'gate', 'tower',
    'statue', 'monument', 'memorial', 'fountain', 'square', 'plaza',
  ],
};

/**
 * User pace multipliers
 */
export const PACE_MULTIPLIERS: Record<string, number> = {
  relaxed: 1.3,    // 30% more time
  moderate: 1.0,   // Normal
  normal: 1.0,
  packed: 0.7,     // 30% less time
  rushed: 0.6,
};

export interface DurationEstimate {
  suggestedMinutes: number;
  minMinutes: number;
  maxMinutes: number;
  confidence: 'low' | 'medium' | 'high';
  isBigRock: boolean;
  rationale: string;
  category: string;
}

/**
 * Estimate visit duration for a place
 */
export function estimateDuration(
  candidate: Candidate,
  userPace: string = 'moderate',
  userIntent?: Record<string, string>, // e.g., { food: 'focused', landmarks: 'quick' }
  openingHours?: { open: string; close: string }
): DurationEstimate {
  const nameLower = candidate.name.toLowerCase();
  const type = candidate.type || 'default';

  // Step 1: Get base prior - first try type, then detect from name
  let prior = DURATION_PRIORS[type] || DURATION_PRIORS['default'];

  // Detect more specific category from name
  if (nameLower.includes('zoo') || nameLower.includes('zoological')) {
    prior = DURATION_PRIORS['zoo'];
  } else if (nameLower.includes('aquarium')) {
    prior = DURATION_PRIORS['aquarium'];
  } else if (nameLower.includes('botanical') || nameLower.includes('botanic garden')) {
    prior = DURATION_PRIORS['botanical_garden'];
  } else if (nameLower.includes('national park') || nameLower.includes('state park')) {
    prior = DURATION_PRIORS['national_park'];
  } else if (nameLower.includes('museum')) {
    // Detect large museums
    if (SCALE_KEYWORDS.halfDay.some(kw => nameLower.includes(kw))) {
      prior = DURATION_PRIORS['large_museum'];
    } else {
      prior = DURATION_PRIORS['museum'];
    }
  } else if (nameLower.includes('palace')) {
    prior = DURATION_PRIORS['palace'];
  } else if (nameLower.includes('castle')) {
    prior = DURATION_PRIORS['castle'];
  } else if (nameLower.includes('temple')) {
    prior = DURATION_PRIORS['temple'];
  } else if (nameLower.includes('church') || nameLower.includes('cathedral') || nameLower.includes('basilica')) {
    prior = DURATION_PRIORS['church'];
  } else if (nameLower.includes('market')) {
    prior = DURATION_PRIORS['market'];
  } else if (nameLower.includes('observatory') || nameLower.includes('viewpoint') || nameLower.includes('overlook')) {
    prior = DURATION_PRIORS['viewpoint'];
  } else if (nameLower.includes('beach')) {
    prior = DURATION_PRIORS['beach'];
  } else if (nameLower.includes('gallery')) {
    prior = DURATION_PRIORS['art_gallery'];
  }
  let confidence: 'low' | 'medium' | 'high' = 'medium';
  let rationale: string[] = [];

  // Step 2: Check name for scale keywords
  let scaleMultiplier = 1.0;

  // Full-day keywords
  if (SCALE_KEYWORDS.fullDay.some(kw => nameLower.includes(kw))) {
    prior = DURATION_PRIORS['theme_park'];
    scaleMultiplier = 1.0;
    confidence = 'high';
    rationale.push('Full-day attraction detected from name');
  }
  // Half-day keywords
  else if (SCALE_KEYWORDS.halfDay.some(kw => nameLower.includes(kw))) {
    scaleMultiplier = 1.5;
    rationale.push('Major attraction detected from name');
  }
  // Extended visit keywords
  else if (SCALE_KEYWORDS.extended.some(kw => nameLower.includes(kw))) {
    scaleMultiplier = 1.2;
    rationale.push('Larger-than-typical venue');
  }
  // Quick visit keywords
  else if (SCALE_KEYWORDS.quick.some(kw => nameLower.includes(kw))) {
    scaleMultiplier = 0.7;
    rationale.push('Quick visit location');
  }

  // Step 3: Check review count as popularity proxy
  const reviewCount = candidate.google_data?.reviews_count || 0;
  if (reviewCount > 50000) {
    scaleMultiplier *= 1.2;
    rationale.push('Very popular (50k+ reviews)');
    confidence = 'high';
  } else if (reviewCount > 20000) {
    scaleMultiplier *= 1.1;
    rationale.push('Popular attraction (20k+ reviews)');
  } else if (reviewCount < 500) {
    confidence = 'low';
    rationale.push('Limited reviews, duration uncertain');
  }

  // Step 4: Apply user pace
  const paceMultiplier = PACE_MULTIPLIERS[userPace] || 1.0;
  if (paceMultiplier !== 1.0) {
    rationale.push(`Adjusted for ${userPace} pace`);
  }

  // Step 5: Apply user intent if provided
  let intentMultiplier = 1.0;
  if (userIntent) {
    const categoryLower = prior.category.toLowerCase();
    if (userIntent[categoryLower] === 'focused' || userIntent[categoryLower] === 'priority') {
      intentMultiplier = 1.3;
      rationale.push(`Extended for user ${categoryLower} focus`);
    } else if (userIntent[categoryLower] === 'quick' || userIntent[categoryLower] === 'brief') {
      intentMultiplier = 0.6;
      rationale.push(`Shortened per user preference`);
    }
  }

  // Step 6: Calculate adjusted duration
  const combinedMultiplier = scaleMultiplier * paceMultiplier * intentMultiplier;
  let suggestedMinutes = Math.round(prior.baseMinutes * combinedMultiplier);
  let minMinutes = Math.round(prior.minMinutes * combinedMultiplier);
  let maxMinutes = Math.round(prior.maxMinutes * combinedMultiplier);

  // Step 7: Cap by opening hours if provided
  if (openingHours) {
    // Safely parse opening hours with validation
    const openParts = openingHours.open?.split(':');
    const closeParts = openingHours.close?.split(':');

    if (openParts?.length >= 1 && closeParts?.length >= 1) {
      const openHour = parseInt(openParts[0], 10);
      const closeHour = parseInt(closeParts[0], 10);

      // Only use if both parsed successfully and are valid hours
      if (!isNaN(openHour) && !isNaN(closeHour) &&
          openHour >= 0 && openHour <= 24 &&
          closeHour >= 0 && closeHour <= 24) {
        const availableMinutes = (closeHour - openHour) * 60;

        if (availableMinutes > 0 && availableMinutes < maxMinutes) {
          maxMinutes = availableMinutes;
          if (suggestedMinutes > availableMinutes) {
            suggestedMinutes = Math.round(availableMinutes * 0.8); // Leave 20% buffer
            rationale.push(`Capped by ${availableMinutes / 60}hr operating window`);
          }
        }
      }
    }
  }

  // Step 8: Determine if this is a Big Rock
  let isBigRock = prior.isBigRock;

  // Upgrade to Big Rock if scaled up significantly
  if (!isBigRock && suggestedMinutes >= 300) {
    isBigRock = true;
    rationale.push('Upgraded to Big Rock due to extended duration');
  }

  // Large zoos are Big Rocks (check name since type field is generic)
  if (prior.category === 'Zoo' && reviewCount > 20000) {
    isBigRock = true;
    rationale.push('Major zoo - treat as Big Rock');
  }

  // Generate final rationale
  if (rationale.length === 0) {
    rationale.push(`Standard ${prior.category} visit`);
  }

  return {
    suggestedMinutes,
    minMinutes,
    maxMinutes,
    confidence,
    isBigRock,
    rationale: rationale.join('; '),
    category: prior.category,
  };
}

// ============================================================================
// C) DAY FEASIBILITY AND REPAIR
// ============================================================================

export interface DaySchedule {
  activities: Array<{
    id: string;
    name: string;
    duration: DurationEstimate;
    travelTimeFromPrev: number;
  }>;
  startTime: number;  // Minutes from midnight (e.g., 570 = 9:30 AM)
  endTime: number;    // Minutes from midnight (e.g., 1170 = 7:30 PM)
  lunchBreak: number; // Minutes
  dinnerBreak: number;
}

export interface FeasibilityResult {
  isFeasible: boolean;
  totalRequiredMinutes: number;
  availableMinutes: number;
  overflowMinutes: number;
  issues: string[];
  suggestions: string[];
  bigRockCount: number;
}

/**
 * Check if a day's schedule is feasible
 */
export function checkDayFeasibility(schedule: DaySchedule): FeasibilityResult {
  const issues: string[] = [];
  const suggestions: string[] = [];

  // Calculate available time
  const availableMinutes = schedule.endTime - schedule.startTime
    - schedule.lunchBreak - schedule.dinnerBreak;

  // Calculate required time
  let totalRequired = 0;
  let bigRockCount = 0;
  const bigRocks: string[] = [];

  for (const activity of schedule.activities) {
    totalRequired += activity.duration.suggestedMinutes;
    totalRequired += activity.travelTimeFromPrev;

    if (activity.duration.isBigRock) {
      bigRockCount++;
      bigRocks.push(activity.name);
    }
  }

  // Check Big Rock rules
  if (bigRockCount > 1) {
    issues.push(`Multiple Big Rock attractions scheduled: ${bigRocks.join(', ')}`);
    suggestions.push('Move one Big Rock to another day');
  }

  if (bigRockCount === 1 && schedule.activities.length > 3) {
    const nonBigRockCount = schedule.activities.length - 1;
    if (nonBigRockCount > 2) {
      issues.push(`Big Rock day has ${nonBigRockCount} additional activities (max 2 recommended)`);
      suggestions.push('Remove extra activities - Big Rock days should have minimal additions');
    }
  }

  // Check time overflow
  const overflowMinutes = totalRequired - availableMinutes;

  if (overflowMinutes > 0) {
    issues.push(`Day is overpacked by ${Math.round(overflowMinutes)} minutes`);

    if (overflowMinutes <= 60) {
      suggestions.push('Shorten 1-2 visits or start earlier');
    } else if (overflowMinutes <= 120) {
      suggestions.push('Remove one attraction or move to another day');
    } else {
      suggestions.push('Day needs major restructuring - remove 2+ attractions');
    }
  }

  // Check for unrealistic packing
  const averageDuration = totalRequired / schedule.activities.length;
  if (schedule.activities.length > 5 && averageDuration < 45) {
    issues.push('Schedule appears rushed with too many short stops');
    suggestions.push('Consider fewer, more meaningful visits');
  }

  return {
    isFeasible: issues.length === 0,
    totalRequiredMinutes: totalRequired,
    availableMinutes,
    overflowMinutes: Math.max(0, overflowMinutes),
    issues,
    suggestions,
    bigRockCount,
  };
}

/**
 * Repair an infeasible day schedule
 */
export function repairDaySchedule(
  schedule: DaySchedule,
  feasibility: FeasibilityResult,
  allDays: DaySchedule[],
  currentDayIndex: number
): { repairedSchedule: DaySchedule; movedActivities: string[]; droppedActivities: string[] } {
  const movedActivities: string[] = [];
  const droppedActivities: string[] = [];
  let activities = [...schedule.activities];

  // Rule 1: If multiple Big Rocks, move extras
  const bigRocks = activities.filter(a => a.duration.isBigRock);
  if (bigRocks.length > 1) {
    // Keep the first Big Rock, move others
    for (let i = 1; i < bigRocks.length; i++) {
      movedActivities.push(bigRocks[i].name);
      activities = activities.filter(a => a.id !== bigRocks[i].id);
    }
  }

  // Rule 2: If Big Rock day, limit other activities
  const hasBigRock = activities.some(a => a.duration.isBigRock);
  if (hasBigRock) {
    const bigRock = activities.find(a => a.duration.isBigRock)!;
    const others = activities.filter(a => !a.duration.isBigRock);

    // Keep only 2 shortest non-Big-Rock activities
    if (others.length > 2) {
      others.sort((a, b) => a.duration.suggestedMinutes - b.duration.suggestedMinutes);
      const toKeep = others.slice(0, 2);
      const toMove = others.slice(2);

      for (const activity of toMove) {
        movedActivities.push(activity.name);
      }

      activities = [bigRock, ...toKeep];
    }
  }

  // Rule 3: If still overpacked, remove lowest-priority items
  let currentTotal = activities.reduce(
    (sum, a) => sum + a.duration.suggestedMinutes + a.travelTimeFromPrev,
    0
  );
  const available = schedule.endTime - schedule.startTime
    - schedule.lunchBreak - schedule.dinnerBreak;

  while (currentTotal > available && activities.length > 1) {
    // Find shortest non-Big-Rock activity to drop
    const removable = activities
      .filter(a => !a.duration.isBigRock)
      .sort((a, b) => a.duration.suggestedMinutes - b.duration.suggestedMinutes);

    if (removable.length === 0) break;

    const toRemove = removable[0];
    droppedActivities.push(toRemove.name);
    activities = activities.filter(a => a.id !== toRemove.id);

    currentTotal = activities.reduce(
      (sum, a) => sum + a.duration.suggestedMinutes + a.travelTimeFromPrev,
      0
    );
  }

  return {
    repairedSchedule: { ...schedule, activities },
    movedActivities,
    droppedActivities,
  };
}

// ============================================================================
// D) INTEGRATION HELPERS
// ============================================================================

/**
 * Check if two attractions can fit in the same day
 */
export function canFitTogether(
  attraction1: DurationEstimate,
  attraction2: DurationEstimate,
  travelTimeMinutes: number,
  availableDayMinutes: number = 480 // 8 hours minus breaks
): boolean {
  // Two Big Rocks cannot fit together
  if (attraction1.isBigRock && attraction2.isBigRock) {
    return false;
  }

  // One Big Rock + regular attraction
  if (attraction1.isBigRock || attraction2.isBigRock) {
    const bigRock = attraction1.isBigRock ? attraction1 : attraction2;
    const other = attraction1.isBigRock ? attraction2 : attraction1;

    // Only allow short activities with Big Rocks
    return other.suggestedMinutes <= 60;
  }

  // Two regular attractions
  const totalTime = attraction1.suggestedMinutes + attraction2.suggestedMinutes + travelTimeMinutes;
  return totalTime <= availableDayMinutes;
}

/**
 * Get suggested activities limit for a day based on anchor
 */
export function getDayActivityLimit(anchorDuration: DurationEstimate, pace: string = 'moderate'): number {
  if (anchorDuration.isBigRock) {
    return 2; // Big Rock + 1-2 light activities
  }

  const paceMultiplier = pace === 'packed' ? 1.3 : pace === 'relaxed' ? 0.7 : 1.0;

  if (anchorDuration.suggestedMinutes >= 180) {
    return Math.round(3 * paceMultiplier); // Half-day anchor
  }

  return Math.round(5 * paceMultiplier); // Regular day
}

/**
 * Generate time slot for an activity based on its duration
 */
export function generateTimeSlot(
  startMinutes: number,
  duration: DurationEstimate
): string {
  const endMinutes = startMinutes + duration.suggestedMinutes;

  const formatTime = (mins: number) => {
    const hours = Math.floor(mins / 60);
    const minutes = mins % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  };

  return `${formatTime(startMinutes)}-${formatTime(endMinutes)}`;
}

// ============================================================================
// E) V2 BIG ROCK DETECTION (New Planning System)
// ============================================================================

export interface BigRockDetectionResult {
  isBigRock: boolean;
  bigRockType?: BigRockType;
  confidence: number; // 0-1
}

/**
 * Detect if a candidate is a "big rock" using the new planning system.
 * Big rocks are attractions that require significant time (theme parks, zoos, etc.)
 */
export function detectBigRockV2(candidate: {
  name: string;
  googleTypes?: string[];
  reviewCount: number;
  rating?: number;
}): BigRockDetectionResult {
  const nameLower = candidate.name.toLowerCase();
  const types = new Set((candidate.googleTypes || []).map(t => t.toLowerCase()));

  // Priority order for detection
  const priorityOrder: BigRockType[] = [
    'theme_park',
    'water_park',
    'safari',
    'zoo',
    'aquarium',
    'major_museum',
    'amusement_park',
  ];

  for (const brType of priorityOrder) {
    const config = BIG_ROCK_CONFIGS[brType];

    const typeMatch = config.googleTypes.some(gt => types.has(gt));
    const nameMatch = config.nameKeywords.some(kw => nameLower.includes(kw));
    const reviewMatch = candidate.reviewCount >= config.minReviewCount;

    // Strong match: type + name (high confidence)
    if (typeMatch && nameMatch) {
      return { isBigRock: true, bigRockType: brType, confidence: 0.95 };
    }

    // Medium match: type + high reviews
    if (typeMatch && reviewMatch) {
      return { isBigRock: true, bigRockType: brType, confidence: 0.85 };
    }

    // Weak match: name + very high reviews
    if (nameMatch && candidate.reviewCount >= config.minReviewCount * 2) {
      return { isBigRock: true, bigRockType: brType, confidence: 0.75 };
    }

    // Name-only match with decent reviews
    if (nameMatch && candidate.reviewCount >= config.minReviewCount * 0.5) {
      return { isBigRock: true, bigRockType: brType, confidence: 0.6 };
    }
  }

  return { isBigRock: false, confidence: 0 };
}

// ============================================================================
// F) V2 DURATION PRIOR (New Planning System)
// ============================================================================

export interface DurationPriorV2 {
  min: number;
  max: number;
  expected: number;
}

/**
 * Get duration estimate using the new planning system's category priors.
 */
export function getDurationPriorV2(
  category: ActivityCategory,
  signals: {
    reviewCount: number;
    rating: number;
    isBigRock: boolean;
    bigRockType?: BigRockType;
  },
  pace: 'relaxed' | 'moderate' | 'packed' = 'moderate'
): DurationPriorV2 {
  // If big rock, use big rock config
  if (signals.isBigRock && signals.bigRockType) {
    const brConfig = BIG_ROCK_CONFIGS[signals.bigRockType];
    const [min, max] = brConfig.durationRange;
    const paceMultiplier = NEW_DURATION_PRIORS[category]?.paceMultiplier[pace] ?? 1.0;

    const adjustedMin = Math.round(min * paceMultiplier);
    const adjustedMax = Math.round(max * paceMultiplier);
    const expected = Math.round(adjustedMin + (adjustedMax - adjustedMin) * 0.6);

    return { min: adjustedMin, max: adjustedMax, expected };
  }

  // Get category prior
  const prior = NEW_DURATION_PRIORS[category] || NEW_DURATION_PRIORS.unknown;
  const paceMultiplier = prior.paceMultiplier[pace];

  // Use high-review variant if applicable
  const useHighReview = signals.reviewCount >= prior.reviewThreshold;
  const [baseMin, baseMax] = useHighReview ? prior.withHighReviews : prior.base;

  const min = Math.round(baseMin * paceMultiplier);
  const max = Math.round(baseMax * paceMultiplier);

  // Calculate expected based on rating
  let ratingBias: number;
  if (signals.rating >= 4.7) ratingBias = 0.7;
  else if (signals.rating >= 4.5) ratingBias = 0.6;
  else if (signals.rating >= 4.0) ratingBias = 0.5;
  else if (signals.rating >= 3.5) ratingBias = 0.4;
  else ratingBias = 0.35;

  // Boost for very popular places
  if (signals.reviewCount > 50000) {
    ratingBias = Math.min(ratingBias + 0.1, 0.75);
  } else if (signals.reviewCount > 20000) {
    ratingBias = Math.min(ratingBias + 0.05, 0.7);
  }

  const expected = Math.round(min + (max - min) * ratingBias);

  return { min, max, expected };
}

// ============================================================================
// G) CATEGORY NORMALIZATION (New Planning System)
// ============================================================================

/**
 * Normalize a place to a standard ActivityCategory
 */
export function normalizeToCategory(candidate: {
  name: string;
  googleTypes?: string[];
  reviewCount?: number;
}): { category: ActivityCategory; confidence: number } {
  const types = new Set((candidate.googleTypes || []).map(t => t.toLowerCase()));
  const nameLower = candidate.name.toLowerCase();

  // Type-based classification (high confidence)
  const typeMapping: [string[], ActivityCategory][] = [
    [['theme_park', 'amusement_park'], 'theme_park'],
    [['zoo'], 'zoo'],
    [['aquarium'], 'aquarium'],
    [['museum'], 'museum'],
    [['hindu_temple', 'buddhist_temple', 'jain_temple'], 'temple'],
    [['church'], 'church'],
    [['mosque'], 'mosque'],
    [['synagogue'], 'religious'],
    [['park'], 'park'],
    [['restaurant', 'food'], 'restaurant'],
    [['cafe'], 'cafe'],
    [['bar', 'night_club'], 'bar'],
    [['shopping_mall'], 'mall'],
    [['market', 'grocery_or_supermarket'], 'market'],
    [['tourist_attraction', 'point_of_interest'], 'landmark'],
    [['art_gallery'], 'museum'],
  ];

  for (const [googleTypes, category] of typeMapping) {
    if (googleTypes.some(gt => types.has(gt))) {
      // Check for major museum upgrade
      if (category === 'museum' && isMajorMuseumCandidate(candidate)) {
        return { category: 'major_museum', confidence: 0.9 };
      }
      return { category, confidence: 0.9 };
    }
  }

  // Name-based classification (medium confidence)
  const nameMapping: [RegExp, ActivityCategory][] = [
    [/\b(fort|fortress|citadel|qila)\b/i, 'fort'],
    [/\b(palace|mahal|haveli)\b/i, 'palace'],
    [/\b(temple|mandir|kovil)\b/i, 'temple'],
    [/\b(church|cathedral|chapel)\b/i, 'church'],
    [/\b(mosque|masjid|dargah)\b/i, 'mosque'],
    [/\b(museum)\b/i, 'museum'],
    [/\b(garden|botanical)\b/i, 'garden'],
    [/\b(beach)\b/i, 'beach'],
    [/\b(lake|reservoir)\b/i, 'lake'],
    [/\b(view\s*point|lookout|observation)\b/i, 'viewpoint'],
    [/\b(market|bazaar|bazar)\b/i, 'market'],
    [/\b(zoo|zoological)\b/i, 'zoo'],
    [/\b(aquarium|oceanarium)\b/i, 'aquarium'],
    [/\b(restaurant|kitchen|diner|eatery)\b/i, 'restaurant'],
    [/\b(cafe|coffee|bakery)\b/i, 'cafe'],
  ];

  for (const [pattern, category] of nameMapping) {
    if (pattern.test(nameLower)) {
      return { category, confidence: 0.7 };
    }
  }

  // Default
  return { category: 'landmark', confidence: 0.4 };
}

/**
 * Check if a museum is a major museum
 */
function isMajorMuseumCandidate(candidate: {
  name: string;
  reviewCount?: number;
}): boolean {
  const nameLower = candidate.name.toLowerCase();
  const majorPatterns = [
    /national\s+museum/i,
    /state\s+museum/i,
    /\b(louvre|smithsonian|british\s+museum|metropolitan|hermitage)\b/i,
    /natural\s+history\s+museum/i,
    /science\s+museum/i,
  ];

  return (
    majorPatterns.some(p => p.test(nameLower)) ||
    (candidate.reviewCount || 0) >= 30000
  );
}

// ============================================================================
// H) TRAVEL TIME ESTIMATION
// ============================================================================

/**
 * Calculate haversine distance between two points in kilometers
 */
export function haversineDistance(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;

  const x =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLng / 2) * Math.sin(dLng / 2) * Math.cos(lat1) * Math.cos(lat2);
  const c = 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));

  return R * c;
}

/**
 * Estimate travel time between two points
 * Assumes average urban speed of 20 km/h (accounting for traffic)
 */
export function estimateTravelTime(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
  averageSpeedKmh: number = 20
): number {
  const distanceKm = haversineDistance(from, to);
  const baseMinutes = (distanceKm / averageSpeedKmh) * 60;

  // Minimum 5 minutes even for very close places
  // Add 5 minutes buffer for parking/walking
  return Math.max(5, Math.round(baseMinutes + 5));
}

/**
 * Format duration as human-readable string
 */
export function formatDurationMinutes(minutes: number): string {
  if (minutes < 60) {
    return `${minutes} min`;
  }
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (mins === 0) {
    return `${hours} hr`;
  }
  return `${hours} hr ${mins} min`;
}
