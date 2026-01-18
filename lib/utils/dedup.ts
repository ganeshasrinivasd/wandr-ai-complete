/**
 * Deduplication and Normalization Utilities
 *
 * Handles:
 * - Candidate deduplication by place_id or normalized name + geohash
 * - Near-duplicate detection using distance + name similarity
 * - Name normalization for matching
 * - Generic place detection
 * - Candidate enrichment pipeline
 *
 * DEDUP STRATEGY:
 * 1. Exact match: same placeId -> dedupe
 * 2. Canonical key: normalizedName + geohash(7) -> dedupe
 * 3. Near-duplicate: distance < 120m AND Jaro-Winkler > 0.9 -> merge
 */

import { EnrichedCandidate, ActivityCategory } from '../planning/types';
import {
  detectBigRockV2,
  getDurationPriorV2,
  normalizeToCategory,
} from './duration-estimator';

// =============================================================================
// GEOHASH IMPLEMENTATION (Precision 7 = ~150m cells)
// =============================================================================

const GEOHASH_CHARS = '0123456789bcdefghjkmnpqrstuvwxyz';

/**
 * Encode lat/lng to geohash string
 * Precision 7 gives ~150m x 150m cells
 */
export function encodeGeohash(
  lat: number,
  lng: number,
  precision: number = 7
): string {
  let minLat = -90, maxLat = 90;
  let minLng = -180, maxLng = 180;
  let hash = '';
  let bit = 0;
  let ch = 0;
  let isLng = true;

  while (hash.length < precision) {
    if (isLng) {
      const mid = (minLng + maxLng) / 2;
      if (lng >= mid) {
        ch |= (1 << (4 - bit));
        minLng = mid;
      } else {
        maxLng = mid;
      }
    } else {
      const mid = (minLat + maxLat) / 2;
      if (lat >= mid) {
        ch |= (1 << (4 - bit));
        minLat = mid;
      } else {
        maxLat = mid;
      }
    }

    isLng = !isLng;
    bit++;

    if (bit === 5) {
      hash += GEOHASH_CHARS[ch];
      bit = 0;
      ch = 0;
    }
  }

  return hash;
}

// =============================================================================
// JARO-WINKLER SIMILARITY
// =============================================================================

/**
 * Calculate Jaro similarity between two strings
 */
function jaroSimilarity(s1: string, s2: string): number {
  if (s1 === s2) return 1.0;
  if (s1.length === 0 || s2.length === 0) return 0.0;

  const matchDistance = Math.floor(Math.max(s1.length, s2.length) / 2) - 1;
  const s1Matches = new Array(s1.length).fill(false);
  const s2Matches = new Array(s2.length).fill(false);

  let matches = 0;
  let transpositions = 0;

  for (let i = 0; i < s1.length; i++) {
    const start = Math.max(0, i - matchDistance);
    const end = Math.min(i + matchDistance + 1, s2.length);

    for (let j = start; j < end; j++) {
      if (s2Matches[j] || s1[i] !== s2[j]) continue;
      s1Matches[i] = true;
      s2Matches[j] = true;
      matches++;
      break;
    }
  }

  if (matches === 0) return 0.0;

  let k = 0;
  for (let i = 0; i < s1.length; i++) {
    if (!s1Matches[i]) continue;
    while (!s2Matches[k]) k++;
    if (s1[i] !== s2[k]) transpositions++;
    k++;
  }

  return (
    (matches / s1.length +
      matches / s2.length +
      (matches - transpositions / 2) / matches) /
    3
  );
}

/**
 * Calculate Jaro-Winkler similarity (gives bonus for common prefix)
 * Returns 0-1 where 1 is exact match
 */
export function jaroWinklerSimilarity(s1: string, s2: string): number {
  const jaro = jaroSimilarity(s1, s2);

  // Find common prefix (up to 4 chars)
  let prefixLen = 0;
  for (let i = 0; i < Math.min(s1.length, s2.length, 4); i++) {
    if (s1[i] === s2[i]) prefixLen++;
    else break;
  }

  // Winkler modification: boost similarity for common prefix
  return jaro + prefixLen * 0.1 * (1 - jaro);
}

// =============================================================================
// CANONICAL KEY GENERATION
// =============================================================================

/**
 * Build canonical dedup key using placeId (primary) or normalizedName + geohash(7)
 */
export function buildCanonicalKey(candidate: {
  placeId?: string;
  name: string;
  location: { lat: number; lng: number };
}): string {
  // Primary: use place_id if available (Google's canonical identifier)
  if (candidate.placeId) {
    return `pid:${candidate.placeId}`;
  }

  // Fallback: normalized name + geohash (precision 7 = ~150m)
  const normalizedName = normalizeName(candidate.name);
  const geohash = encodeGeohash(candidate.location.lat, candidate.location.lng, 7);

  return `name:${normalizedName}|gh:${geohash}`;
}

// =============================================================================
// HAVERSINE DISTANCE (for near-duplicate detection)
// =============================================================================

/**
 * Calculate distance in meters between two points
 */
export function haversineDistanceMeters(
  loc1: { lat: number; lng: number },
  loc2: { lat: number; lng: number }
): number {
  const R = 6371000; // Earth radius in meters
  const dLat = toRad(loc2.lat - loc1.lat);
  const dLng = toRad(loc2.lng - loc1.lng);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(loc1.lat)) * Math.cos(toRad(loc2.lat)) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}

// =============================================================================
// NEAR-DUPLICATE DETECTION
// =============================================================================

/**
 * Check if two candidates are near-duplicates
 * Criteria: distance < 120m AND name similarity > 0.9
 */
export function areNearDuplicates(
  c1: { name: string; location: { lat: number; lng: number } },
  c2: { name: string; location: { lat: number; lng: number } },
  maxDistanceMeters: number = 120,
  minNameSimilarity: number = 0.9
): boolean {
  const distance = haversineDistanceMeters(c1.location, c2.location);
  if (distance > maxDistanceMeters) return false;

  const name1 = normalizeName(c1.name);
  const name2 = normalizeName(c2.name);
  const similarity = jaroWinklerSimilarity(name1, name2);

  return similarity >= minNameSimilarity;
}

// =============================================================================
// ENHANCED DEDUPLICATION WITH MERGE
// =============================================================================

interface DedupStats {
  inputCount: number;
  exactDuplicates: number;
  nearDuplicates: number;
  outputCount: number;
}

/**
 * Enhanced deduplication with near-duplicate merge
 * Returns deduped candidates and stats for instrumentation
 */
export function dedupWithMerge<T extends {
  id: string;
  placeId?: string;
  name: string;
  location: { lat: number; lng: number };
  reviewCount?: number;
  rating?: number;
}>(candidates: T[]): { candidates: T[]; stats: DedupStats } {
  const stats: DedupStats = {
    inputCount: candidates.length,
    exactDuplicates: 0,
    nearDuplicates: 0,
    outputCount: 0,
  };

  if (candidates.length === 0) {
    return { candidates: [], stats };
  }

  // Phase 1: Exact dedup by canonical key
  const byCanonicalKey = new Map<string, T>();

  for (const candidate of candidates) {
    const key = buildCanonicalKey(candidate);
    const existing = byCanonicalKey.get(key);

    if (!existing) {
      byCanonicalKey.set(key, candidate);
    } else {
      stats.exactDuplicates++;
      // Keep the one with more reviews (more authoritative)
      const existingReviews = existing.reviewCount || 0;
      const candidateReviews = candidate.reviewCount || 0;
      if (candidateReviews > existingReviews) {
        byCanonicalKey.set(key, mergeCandidate(existing, candidate));
      } else {
        byCanonicalKey.set(key, mergeCandidate(candidate, existing));
      }
    }
  }

  // Phase 2: Near-duplicate detection and merge
  const exactDeduped = Array.from(byCanonicalKey.values());
  const result: T[] = [];
  const merged = new Set<number>();

  for (let i = 0; i < exactDeduped.length; i++) {
    if (merged.has(i)) continue;

    let current = exactDeduped[i];

    // Find near-duplicates
    for (let j = i + 1; j < exactDeduped.length; j++) {
      if (merged.has(j)) continue;

      if (areNearDuplicates(current, exactDeduped[j])) {
        stats.nearDuplicates++;
        merged.add(j);

        // Merge: keep the one with better data
        const other = exactDeduped[j];
        const currentScore = (current.reviewCount || 0) + (current.rating || 0) * 100;
        const otherScore = (other.reviewCount || 0) + (other.rating || 0) * 100;

        if (otherScore > currentScore) {
          current = mergeCandidate(current, other);
        } else {
          current = mergeCandidate(other, current);
        }
      }
    }

    result.push(current);
  }

  stats.outputCount = result.length;
  return { candidates: result, stats };
}

/**
 * Merge two candidates, keeping best fields from each
 * Primary candidate's identity is kept, secondary fills gaps
 */
function mergeCandidate<T extends {
  id: string;
  placeId?: string;
  name: string;
  reviewCount?: number;
  rating?: number;
}>(secondary: T, primary: T): T {
  return {
    ...secondary,
    ...primary,
    // Prefer non-empty placeId
    placeId: primary.placeId || secondary.placeId,
    // Keep higher review count
    reviewCount: Math.max(primary.reviewCount || 0, secondary.reviewCount || 0),
    // Keep higher rating
    rating: Math.max(primary.rating || 0, secondary.rating || 0),
  };
}

// =============================================================================
// LEGACY DEDUPLICATION (kept for backward compatibility)
// =============================================================================

/**
 * Deduplicate candidates by place_id or (normalized_name + geohash)
 * Keeps the candidate with more reviews when duplicates are found.
 * @deprecated Use dedupWithMerge for better near-duplicate handling
 */
export function dedupCandidates<T extends {
  id: string;
  placeId?: string;
  name: string;
  location: { lat: number; lng: number };
  reviewCount?: number;
}>(candidates: T[]): T[] {
  const { candidates: deduped } = dedupWithMerge(candidates);
  return deduped;
}

/**
 * Get deduplication key for a candidate
 * @deprecated Use buildCanonicalKey instead
 */
function getDedupKey(candidate: {
  placeId?: string;
  name: string;
  location: { lat: number; lng: number };
}): string {
  return buildCanonicalKey(candidate);
}

// =============================================================================
// NAME NORMALIZATION
// =============================================================================

/**
 * Normalize a place name for deduplication matching
 */
export function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '') // Remove special chars
    .replace(/\s+/g, ' ')        // Collapse whitespace
    .replace(/\b(the|a|an|of|in|at|on)\b/g, '') // Remove articles/prepositions
    .replace(/\b(temple|church|mosque|park|garden|museum|restaurant|cafe|hotel)\b/g, '') // Remove generic suffixes for matching
    .trim();
}

/**
 * Get geo grid cell for a location
 * Grid size in degrees (~0.002 = ~200m at equator)
 */
function getGeoGrid(
  location: { lat: number; lng: number },
  gridSize: number
): string {
  const latGrid = Math.floor(location.lat / gridSize);
  const lngGrid = Math.floor(location.lng / gridSize);
  return `${latGrid},${lngGrid}`;
}

// =============================================================================
// GENERIC PLACE DETECTION
// =============================================================================

/**
 * Check if a place name is too generic to be useful
 */
export function isGenericPlace(candidate: {
  name: string;
  reviewCount?: number;
}): boolean {
  const genericPatterns = [
    /^view\s*point$/i,
    /^restaurant$/i,
    /^cafe$/i,
    /^hotel$/i,
    /^park$/i,
    /^garden$/i,
    /^temple$/i,
    /^church$/i,
    /^market$/i,
    /^shop$/i,
    /^atm$/i,
    /^parking$/i,
    /^bus\s*stop$/i,
    /^metro\s*station$/i,
    /^point\s*of\s*interest$/i,
    /^tourist\s*attraction$/i,
  ];

  const nameLower = candidate.name.toLowerCase().trim();

  // Check if name matches generic pattern
  if (genericPatterns.some(p => p.test(nameLower))) {
    // Allow if it has very high reviews (probably actually significant)
    if ((candidate.reviewCount || 0) >= 5000) {
      return false;
    }
    return true;
  }

  // Flag very short generic names with low reviews
  if (nameLower.length <= 12 && (candidate.reviewCount || 0) < 1000) {
    const words = nameLower.split(/\s+/);
    if (words.length <= 2) {
      // Single or two-word name with low reviews
      return true;
    }
  }

  return false;
}

// =============================================================================
// CANDIDATE ENRICHMENT
// =============================================================================

/**
 * Enrich a raw candidate with computed properties
 */
export function enrichCandidate(
  rawCandidate: {
    id: string;
    placeId?: string;
    name: string;
    location: { lat: number; lng: number };
    googleTypes?: string[];
    rating?: number;
    reviewCount?: number;
    priceLevel?: number;
    photoUrl?: string;
    vicinity?: string;
  },
  pace: 'relaxed' | 'moderate' | 'packed' = 'moderate'
): EnrichedCandidate {
  // Normalize category
  const { category, confidence: categoryConfidence } = normalizeToCategory({
    name: rawCandidate.name,
    googleTypes: rawCandidate.googleTypes,
    reviewCount: rawCandidate.reviewCount,
  });

  // Detect big rock
  const bigRockResult = detectBigRockV2({
    name: rawCandidate.name,
    googleTypes: rawCandidate.googleTypes,
    reviewCount: rawCandidate.reviewCount || 0,
    rating: rawCandidate.rating,
  });

  // Get duration prior
  const duration = getDurationPriorV2(
    category,
    {
      reviewCount: rawCandidate.reviewCount || 0,
      rating: rawCandidate.rating || 4.0,
      isBigRock: bigRockResult.isBigRock,
      bigRockType: bigRockResult.bigRockType,
    },
    pace
  );

  // Compute utility score
  const utilityScore = computeUtilityScore({
    rating: rawCandidate.rating || 4.0,
    reviewCount: rawCandidate.reviewCount || 0,
    isBigRock: bigRockResult.isBigRock,
    categoryConfidence,
  });

  // Build dedup key
  const dedupKey = getDedupKey({
    placeId: rawCandidate.placeId,
    name: rawCandidate.name,
    location: rawCandidate.location,
  });

  // Check if generic
  const isGeneric = isGenericPlace({
    name: rawCandidate.name,
    reviewCount: rawCandidate.reviewCount,
  });

  return {
    id: rawCandidate.id,
    placeId: rawCandidate.placeId,
    name: rawCandidate.name,
    normalizedName: normalizeName(rawCandidate.name),
    location: rawCandidate.location,
    googleTypes: rawCandidate.googleTypes || [],
    rating: rawCandidate.rating || 4.0,
    reviewCount: rawCandidate.reviewCount || 0,
    priceLevel: rawCandidate.priceLevel,
    photoUrl: rawCandidate.photoUrl,
    vicinity: rawCandidate.vicinity,

    category,
    categoryConfidence,
    isBigRock: bigRockResult.isBigRock,
    bigRockType: bigRockResult.bigRockType,
    durationMin: duration.min,
    durationMax: duration.max,
    durationExpected: duration.expected,

    dedupKey,
    isGeneric,
    utilityScore,
  };
}

/**
 * Enrich multiple candidates
 */
export function enrichCandidates(
  rawCandidates: Array<{
    id: string;
    placeId?: string;
    name: string;
    location: { lat: number; lng: number };
    googleTypes?: string[];
    rating?: number;
    reviewCount?: number;
    priceLevel?: number;
    photoUrl?: string;
    vicinity?: string;
  }>,
  pace: 'relaxed' | 'moderate' | 'packed' = 'moderate'
): EnrichedCandidate[] {
  return rawCandidates.map(c => enrichCandidate(c, pace));
}

// =============================================================================
// UTILITY SCORING
// =============================================================================

/**
 * Compute utility score for a candidate
 * Higher score = more valuable to include in itinerary
 */
export function computeUtilityScore(params: {
  rating: number;
  reviewCount: number;
  isBigRock: boolean;
  categoryConfidence: number;
}): number {
  let score = 0;

  // Rating component (0-10 points)
  score += params.rating * 2;

  // Popularity component (0-10 points, log scale)
  const popularityScore = Math.min(
    Math.log10(params.reviewCount + 1) * 2,
    10
  );
  score += popularityScore;

  // Big rock bonus (5 points)
  if (params.isBigRock) {
    score += 5;
  }

  // Category confidence bonus (0-2 points)
  score += params.categoryConfidence * 2;

  // Iconic threshold bonus (high reviews)
  if (params.reviewCount >= 50000) {
    score += 3;
  } else if (params.reviewCount >= 20000) {
    score += 2;
  } else if (params.reviewCount >= 10000) {
    score += 1;
  }

  return score;
}

// =============================================================================
// FILTERING UTILITIES
// =============================================================================

/**
 * Filter out generic places with low confidence
 */
export function filterGenericPlaces(
  candidates: EnrichedCandidate[],
  keepThreshold: number = 5000 // Keep if reviews > threshold
): EnrichedCandidate[] {
  return candidates.filter(c => {
    if (!c.isGeneric) return true;
    // Keep generic places with high reviews
    return c.reviewCount >= keepThreshold;
  });
}

/**
 * Filter candidates by category
 */
export function filterByCategory(
  candidates: EnrichedCandidate[],
  categories: ActivityCategory[]
): EnrichedCandidate[] {
  const categorySet = new Set(categories);
  return candidates.filter(c => categorySet.has(c.category));
}

/**
 * Get restaurants and cafes only
 */
export function getRestaurants(
  candidates: EnrichedCandidate[]
): EnrichedCandidate[] {
  return candidates.filter(c =>
    c.category === 'restaurant' || c.category === 'cafe'
  );
}

/**
 * Get attractions (non-food places)
 */
export function getAttractions(
  candidates: EnrichedCandidate[]
): EnrichedCandidate[] {
  return candidates.filter(c =>
    c.category !== 'restaurant' && c.category !== 'cafe' && c.category !== 'bar'
  );
}

/**
 * Sort candidates by utility score (highest first)
 */
export function sortByUtility(
  candidates: EnrichedCandidate[]
): EnrichedCandidate[] {
  return [...candidates].sort((a, b) => b.utilityScore - a.utilityScore);
}

/**
 * Get top N candidates by utility
 */
export function getTopCandidates(
  candidates: EnrichedCandidate[],
  n: number
): EnrichedCandidate[] {
  return sortByUtility(candidates).slice(0, n);
}
