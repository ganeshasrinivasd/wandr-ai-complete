/**
 * Itinerary Scoring Algorithm
 *
 * AGENT STRATEGY SUMMARY:
 * This module implements a multi-factor scoring system to identify "iconic" places
 * and balance them with user preferences. The algorithm uses:
 * 1. IconicScore - Proxy for fame using review count, category weights, and query consensus
 * 2. PreferenceScore - Match to user interests
 * 3. Penalties - Distance, redundancy, closed hours
 *
 * The day-packing strategy selects iconic anchors first, then fills with
 * nearby preference-matched places while respecting pace constraints.
 */

import { Candidate } from './types';

// ============================================================================
// A) SCORING FUNCTIONS
// ============================================================================

/**
 * Category weights for determining "iconicness"
 * Higher weight = more likely to be iconic/famous
 */
export const ICONIC_CATEGORY_WEIGHTS: Record<string, number> = {
  // High iconic potential (landmarks, major attractions)
  'tourist_attraction': 1.0,
  'landmark': 1.0,
  'point_of_interest': 0.8,
  'museum': 0.9,
  'art_gallery': 0.7,
  'church': 0.7,
  'hindu_temple': 0.8,
  'mosque': 0.7,
  'synagogue': 0.6,
  'palace': 1.0,
  'castle': 1.0,
  'monument': 0.95,
  'historic_site': 0.85,

  // Medium iconic potential
  'park': 0.6,
  'zoo': 0.7,
  'aquarium': 0.7,
  'amusement_park': 0.75,
  'stadium': 0.65,
  'market': 0.6,
  'shopping_mall': 0.4,

  // Lower iconic (but good for preferences)
  'restaurant': 0.3,
  'cafe': 0.2,
  'bar': 0.25,
  'night_club': 0.3,
  'spa': 0.2,
  'bakery': 0.15,
};

/**
 * User interest to place type mapping
 */
export const INTEREST_TYPE_MAP: Record<string, string[]> = {
  'culture': ['museum', 'art_gallery', 'church', 'hindu_temple', 'mosque', 'historic_site', 'monument', 'palace'],
  'history': ['museum', 'historic_site', 'monument', 'palace', 'castle', 'church'],
  'food': ['restaurant', 'cafe', 'bakery', 'market', 'bar'],
  'nature': ['park', 'zoo', 'aquarium', 'garden', 'beach'],
  'shopping': ['shopping_mall', 'market', 'store'],
  'nightlife': ['bar', 'night_club', 'casino'],
  'art': ['art_gallery', 'museum', 'street_art'],
  'architecture': ['church', 'palace', 'castle', 'historic_site', 'monument'],
  'adventure': ['amusement_park', 'stadium', 'zoo'],
  'relaxation': ['spa', 'park', 'cafe', 'beach'],
};

/**
 * Review count thresholds for iconic classification
 */
export const ICONIC_THRESHOLDS = {
  MINIMUM_REVIEWS: 500,        // Minimum to be considered
  NOTABLE_REVIEWS: 2000,       // Notable attraction
  FAMOUS_REVIEWS: 5000,        // Well-known attraction
  VERY_FAMOUS_REVIEWS: 10000,  // Major landmark
  WORLD_FAMOUS_REVIEWS: 50000, // World-renowned
};

// Note: Duration estimation has been moved to duration-estimator.ts
// Use: estimateDuration(), checkDayFeasibility(), canFitTogether()

/**
 * Calculate the Iconic Score for a place
 * Uses review count, rating, and category as proxies for fame
 *
 * @returns Score between 0 and 1
 */
export function calculateIconicScore(candidate: Candidate, queryConsensusBonus: number = 0): number {
  const reviewCount = candidate.google_data.reviews_count || 0;
  const rating = candidate.google_data.rating || 0;
  const categoryWeight = ICONIC_CATEGORY_WEIGHTS[candidate.type] || 0.3;

  // Review count score (logarithmic scale, capped at 1)
  // log10(500) ≈ 2.7, log10(50000) ≈ 4.7
  const reviewScore = Math.min(
    Math.max(0, (Math.log10(reviewCount + 1) - 2.5) / 2.2),
    1
  );

  // Rating score (normalized 0-1, with 4.0+ being good)
  const ratingScore = Math.max(0, (rating - 3.5) / 1.5);

  // Combined iconic score with weights
  const baseScore = (
    reviewScore * 0.45 +           // Review count is primary signal
    ratingScore * 0.25 +           // Rating matters but less
    categoryWeight * 0.20 +        // Category type
    queryConsensusBonus * 0.10     // Bonus if found in multiple iconic queries
  );

  return Math.min(1, Math.max(0, baseScore));
}

/**
 * Calculate Preference Score based on user interests
 *
 * @returns Score between 0 and 1
 */
export function calculatePreferenceScore(
  candidate: Candidate,
  userInterests: string[],
  mustDo: string[] = [],
  avoid: string[] = []
): number {
  // Check if explicitly avoided
  const nameL = candidate.name.toLowerCase();
  if (avoid.some(a => nameL.includes(a.toLowerCase()))) {
    return -1; // Negative score = exclude
  }

  // Check if must-do
  if (mustDo.some(m => nameL.includes(m.toLowerCase()))) {
    return 1.0; // Maximum preference
  }

  // Calculate interest match
  let interestMatchScore = 0;
  const candidateTypes = [candidate.type];

  for (const interest of userInterests) {
    const matchingTypes = INTEREST_TYPE_MAP[interest.toLowerCase()] || [];
    if (candidateTypes.some(t => matchingTypes.includes(t))) {
      interestMatchScore += 1 / userInterests.length;
    }
  }

  // Boost for high-rated places even if no direct interest match
  const ratingBoost = ((candidate.google_data.rating || 4.0) - 4.0) * 0.2;

  return Math.min(1, Math.max(0, interestMatchScore + ratingBoost));
}

/**
 * Calculate Distance Penalty
 * Penalizes places far from the centroid or last location
 *
 * @returns Penalty between 0 and 1 (0 = no penalty, 1 = max penalty)
 */
export function calculateDistancePenalty(
  candidate: Candidate,
  referencePoint: { lat: number; lng: number },
  maxAcceptableKm: number = 10
): number {
  const distance = haversineDistance(
    candidate.location.lat,
    candidate.location.lng,
    referencePoint.lat,
    referencePoint.lng
  );

  // Linear penalty up to maxAcceptableKm, then capped
  return Math.min(1, distance / maxAcceptableKm);
}

/**
 * Calculate Redundancy Penalty
 * Penalizes places of same type already selected
 *
 * @returns Penalty between 0 and 1
 */
export function calculateRedundancyPenalty(
  candidate: Candidate,
  selectedCandidates: Candidate[],
  maxSameType: number = 2
): number {
  const sameTypeCount = selectedCandidates.filter(c => c.type === candidate.type).length;

  if (sameTypeCount >= maxSameType) {
    return 0.8; // High penalty for exceeding limit
  }

  return sameTypeCount * 0.15; // Incremental penalty
}

/**
 * Combined scoring function
 * FinalScore = (IconicScore * w1 + PreferenceScore * w2) - Penalties
 */
export function calculateFinalScore(
  candidate: Candidate,
  userInterests: string[],
  iconicWeight: number = 0.5, // "Iconic vs Local" knob (0 = all preference, 1 = all iconic)
  referencePoint?: { lat: number; lng: number },
  selectedCandidates: Candidate[] = [],
  queryConsensusBonus: number = 0,
  mustDo: string[] = [],
  avoid: string[] = []
): number {
  const preferenceScore = calculatePreferenceScore(candidate, userInterests, mustDo, avoid);

  // Exclude if explicitly avoided
  if (preferenceScore < 0) return -Infinity;

  const iconicScore = calculateIconicScore(candidate, queryConsensusBonus);

  // Weighted combination based on user's iconic preference
  const baseScore = iconicScore * iconicWeight + preferenceScore * (1 - iconicWeight);

  // Apply penalties
  let penalty = 0;

  if (referencePoint) {
    penalty += calculateDistancePenalty(candidate, referencePoint) * 0.2;
  }

  penalty += calculateRedundancyPenalty(candidate, selectedCandidates) * 0.15;

  return Math.max(0, baseScore - penalty);
}

// ============================================================================
// B) DAY PACKING STRATEGY
// ============================================================================

export interface DayPackingConfig {
  activitiesPerDay: number;
  minAnchorsPerDay: number;
  maxAnchorsPerDay: number;
  iconicThreshold: number;      // Minimum iconic score to be an anchor
  maxTravelTimeMinutes: number; // Max travel time between activities
  paceMultiplier: number;       // 0.7 (relaxed) to 1.3 (packed)
}

export const PACE_CONFIGS: Record<string, DayPackingConfig> = {
  relaxed: {
    activitiesPerDay: 3,
    minAnchorsPerDay: 1,
    maxAnchorsPerDay: 1,
    iconicThreshold: 0.5,
    maxTravelTimeMinutes: 20,
    paceMultiplier: 0.7,
  },
  moderate: {
    activitiesPerDay: 4,
    minAnchorsPerDay: 1,
    maxAnchorsPerDay: 2,
    iconicThreshold: 0.45,
    maxTravelTimeMinutes: 25,
    paceMultiplier: 1.0,
  },
  packed: {
    activitiesPerDay: 6,
    minAnchorsPerDay: 1,
    maxAnchorsPerDay: 2,
    iconicThreshold: 0.4,
    maxTravelTimeMinutes: 30,
    paceMultiplier: 1.3,
  },
};

/**
 * Identify iconic anchors from candidates
 * Anchors are the "must-see" attractions for each day
 */
export function identifyIconicAnchors(
  candidates: Candidate[],
  numDays: number,
  config: DayPackingConfig
): Candidate[] {
  // Score all candidates for iconic-ness
  const scored = candidates
    .map(c => ({
      candidate: c,
      iconicScore: calculateIconicScore(c),
    }))
    .filter(s => s.iconicScore >= config.iconicThreshold)
    .sort((a, b) => b.iconicScore - a.iconicScore);

  // Select top anchors (1-2 per day, capped)
  const maxAnchors = numDays * config.maxAnchorsPerDay;
  const minAnchors = numDays * config.minAnchorsPerDay;

  // Ensure variety - don't pick all from same category
  const selectedAnchors: Candidate[] = [];
  const typeCounts: Record<string, number> = {};

  for (const { candidate } of scored) {
    if (selectedAnchors.length >= maxAnchors) break;

    const typeCount = typeCounts[candidate.type] || 0;
    if (typeCount >= 2) continue; // Max 2 of same type as anchors

    selectedAnchors.push(candidate);
    typeCounts[candidate.type] = typeCount + 1;
  }

  // If we don't have enough anchors, lower threshold and try again
  if (selectedAnchors.length < minAnchors) {
    const remaining = candidates
      .filter(c => !selectedAnchors.includes(c))
      .map(c => ({ candidate: c, iconicScore: calculateIconicScore(c) }))
      .sort((a, b) => b.iconicScore - a.iconicScore);

    for (const { candidate } of remaining) {
      if (selectedAnchors.length >= minAnchors) break;
      selectedAnchors.push(candidate);
    }
  }

  return selectedAnchors;
}

/**
 * Create geographic clusters using K-means
 */
export function createGeographicClusters(
  venues: Candidate[],
  numClusters: number
): Candidate[][] {
  if (venues.length === 0) return [[]];
  if (venues.length <= numClusters) return venues.map(v => [v]);

  // Initialize centroids using venues spread across the area
  const sortedByLat = [...venues].sort((a, b) => a.location.lat - b.location.lat);
  const centroids: { lat: number; lng: number }[] = [];

  for (let i = 0; i < numClusters; i++) {
    const idx = Math.floor((i / numClusters) * sortedByLat.length);
    centroids.push({
      lat: sortedByLat[idx].location.lat,
      lng: sortedByLat[idx].location.lng,
    });
  }

  // Run K-means iterations
  for (let iter = 0; iter < 5; iter++) {
    const clusters: Candidate[][] = Array.from({ length: numClusters }, () => []);

    // Assign venues to nearest centroid
    for (const venue of venues) {
      let minDist = Infinity;
      let closestCluster = 0;

      for (let i = 0; i < centroids.length; i++) {
        const dist = haversineDistance(
          venue.location.lat, venue.location.lng,
          centroids[i].lat, centroids[i].lng
        );
        if (dist < minDist) {
          minDist = dist;
          closestCluster = i;
        }
      }

      clusters[closestCluster].push(venue);
    }

    // Update centroids
    for (let i = 0; i < numClusters; i++) {
      if (clusters[i].length > 0) {
        centroids[i] = {
          lat: clusters[i].reduce((sum, v) => sum + v.location.lat, 0) / clusters[i].length,
          lng: clusters[i].reduce((sum, v) => sum + v.location.lng, 0) / clusters[i].length,
        };
      }
    }

    // On last iteration, return clusters
    if (iter === 4) {
      return clusters.filter(c => c.length > 0);
    }
  }

  return [venues]; // Fallback
}

/**
 * Assign anchors to clusters, ensuring each cluster gets at least one if possible
 */
export function assignAnchorsToClusters(
  anchors: Candidate[],
  clusters: Candidate[][]
): Map<number, Candidate[]> {
  const clusterAnchors = new Map<number, Candidate[]>();

  // Initialize empty arrays for each cluster
  clusters.forEach((_, idx) => clusterAnchors.set(idx, []));

  // Assign each anchor to its nearest cluster
  for (const anchor of anchors) {
    let minDist = Infinity;
    let closestCluster = 0;

    for (let i = 0; i < clusters.length; i++) {
      const centroid = getClusterCentroid(clusters[i]);
      const dist = haversineDistance(
        anchor.location.lat, anchor.location.lng,
        centroid.lat, centroid.lng
      );
      if (dist < minDist) {
        minDist = dist;
        closestCluster = i;
      }
    }

    const existing = clusterAnchors.get(closestCluster) || [];
    existing.push(anchor);
    clusterAnchors.set(closestCluster, existing);
  }

  return clusterAnchors;
}

/**
 * Get centroid of a cluster
 */
export function getClusterCentroid(cluster: Candidate[]): { lat: number; lng: number } {
  if (cluster.length === 0) return { lat: 0, lng: 0 };

  return {
    lat: cluster.reduce((sum, v) => sum + v.location.lat, 0) / cluster.length,
    lng: cluster.reduce((sum, v) => sum + v.location.lng, 0) / cluster.length,
  };
}

// ============================================================================
// C) VALIDATION & REPAIR
// ============================================================================

export interface ValidationResult {
  isValid: boolean;
  issues: string[];
  dayIssues: Map<number, string[]>;
}

/**
 * Validate itinerary quality
 */
export function validateItinerary(
  days: { anchors: Candidate[]; activities: Candidate[] }[],
  config: DayPackingConfig
): ValidationResult {
  const issues: string[] = [];
  const dayIssues = new Map<number, string[]>();

  for (let i = 0; i < days.length; i++) {
    const day = days[i];
    const dayProblems: string[] = [];

    // Check anchor count
    if (day.anchors.length < config.minAnchorsPerDay) {
      dayProblems.push(`Day ${i + 1} lacks iconic anchor (has ${day.anchors.length})`);
    }

    // Check anchor quality
    const weakAnchors = day.anchors.filter(a => calculateIconicScore(a) < config.iconicThreshold);
    if (weakAnchors.length > 0) {
      dayProblems.push(`Day ${i + 1} has weak anchors below threshold`);
    }

    // Check total activities
    const totalActivities = day.anchors.length + day.activities.length;
    if (totalActivities < config.activitiesPerDay - 1) {
      dayProblems.push(`Day ${i + 1} underfilled (${totalActivities}/${config.activitiesPerDay})`);
    }

    // Check travel distances
    const allVenues = [...day.anchors, ...day.activities];
    if (allVenues.length > 1) {
      const totalTravel = calculateTotalTravelTime(allVenues);
      if (totalTravel > config.maxTravelTimeMinutes * (allVenues.length - 1)) {
        dayProblems.push(`Day ${i + 1} has excessive travel time (${totalTravel}min)`);
      }
    }

    if (dayProblems.length > 0) {
      dayIssues.set(i, dayProblems);
      issues.push(...dayProblems);
    }
  }

  return {
    isValid: issues.length === 0,
    issues,
    dayIssues,
  };
}

/**
 * Calculate estimated travel time between venues
 */
function calculateTotalTravelTime(venues: Candidate[]): number {
  let total = 0;
  for (let i = 1; i < venues.length; i++) {
    const dist = haversineDistance(
      venues[i - 1].location.lat, venues[i - 1].location.lng,
      venues[i].location.lat, venues[i].location.lng
    );
    // Estimate: walking = 15min/km, transit = 3min/km
    total += dist > 2 ? dist * 3 + 10 : dist * 15; // 10min for transit waiting
  }
  return Math.round(total);
}

// ============================================================================
// D) ICONIC QUERY SUGGESTIONS
// ============================================================================

/**
 * Generate iconic-specific search queries for a destination
 * These should be run in addition to interest-based queries
 */
export function getIconicSearchQueries(city: string, country: string): string[] {
  return [
    // Direct iconic queries
    `famous landmarks ${city}`,
    `must see attractions ${city}`,
    `iconic places ${city}`,
    `top tourist attractions ${city}`,
    `${city} famous monuments`,

    // UNESCO and notable sites
    `UNESCO world heritage ${city}`,
    `historic sites ${city}`,

    // Category-specific iconic
    `most famous museum ${city}`,
    `famous temples ${city}`,
    `famous markets ${city}`,
    `viewpoints ${city}`,

    // Local fame
    `${city} bucket list`,
    `what ${city} is famous for`,
  ];
}

/**
 * Get interest-based search queries
 */
export function getInterestSearchQueries(city: string, interests: string[]): string[] {
  const queries: string[] = [];

  for (const interest of interests) {
    switch (interest.toLowerCase()) {
      case 'food':
        queries.push(`best restaurants ${city}`, `famous food ${city}`, `local cuisine ${city}`);
        break;
      case 'culture':
        queries.push(`cultural attractions ${city}`, `museums ${city}`, `art galleries ${city}`);
        break;
      case 'nature':
        queries.push(`parks ${city}`, `gardens ${city}`, `nature attractions ${city}`);
        break;
      case 'shopping':
        queries.push(`shopping districts ${city}`, `markets ${city}`, `boutiques ${city}`);
        break;
      case 'nightlife':
        queries.push(`nightlife ${city}`, `bars ${city}`, `clubs ${city}`);
        break;
      case 'history':
        queries.push(`historical sites ${city}`, `ancient monuments ${city}`);
        break;
      case 'art':
        queries.push(`art galleries ${city}`, `street art ${city}`);
        break;
      default:
        queries.push(`${interest} ${city}`);
    }
  }

  return queries;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Haversine distance between two points in km
 */
export function haversineDistance(
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number {
  const R = 6371; // Earth's radius in km
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);

  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}

/**
 * Deduplicate candidates by place_id
 */
export function deduplicateCandidates(candidates: Candidate[]): Candidate[] {
  const seen = new Set<string>();
  return candidates.filter(c => {
    if (seen.has(c.id)) return false;
    seen.add(c.id);
    return true;
  });
}

/**
 * Track query consensus - places found in multiple iconic queries get bonus
 */
export function calculateQueryConsensus(
  placeId: string,
  queryResults: Map<string, Set<string>>
): number {
  let foundInQueries = 0;

  for (const placeIds of queryResults.values()) {
    if (placeIds.has(placeId)) {
      foundInQueries++;
    }
  }

  // Normalize: found in 3+ queries = max bonus
  return Math.min(1, foundInQueries / 3);
}
