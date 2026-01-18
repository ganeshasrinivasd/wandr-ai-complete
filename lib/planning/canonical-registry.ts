/**
 * Canonical Place Registry
 *
 * Single source of truth for place deduplication.
 * Creates canonical IDs and merges duplicates into unified records.
 *
 * Dedup Rules:
 * 1. If rawId matches → same canonical (highest priority)
 * 2. If dedupKey matches exactly → merge (reason: 'exact_key')
 * 3. If within dedupMergeRadiusMeters AND name similarity >= 0.92 → merge (reason: 'near_duplicate')
 */

import {
  CanonicalPlace,
  CanonicalRegistryResult,
  EnrichedCandidateRaw,
  EnrichedCandidateCanonical,
  AnchorCandidateRaw,
  AnchorCandidate,
  RawPlaceId,
  CanonicalPlaceId,
} from '../types/optimizer-v3';
import { PlanTraceBuilder } from '../observability/plan-trace';

// =============================================================================
// GEOHASH UTILITIES
// =============================================================================

const BASE32 = '0123456789bcdefghjkmnpqrstuvwxyz';

/**
 * Encode lat/lng to geohash with specified precision.
 */
export function encodeGeohash(lat: number, lng: number, precision: number = 6): string {
  let minLat = -90, maxLat = 90;
  let minLng = -180, maxLng = 180;
  let hash = '';
  let isEven = true;
  let bit = 0;
  let ch = 0;

  while (hash.length < precision) {
    if (isEven) {
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

    isEven = !isEven;
    if (bit < 4) {
      bit++;
    } else {
      hash += BASE32[ch];
      bit = 0;
      ch = 0;
    }
  }

  return hash;
}

// =============================================================================
// NAME NORMALIZATION
// =============================================================================

const STOPWORDS = new Set(['the', 'a', 'an', 'of', 'in', 'at', 'and', 'or']);

/**
 * Normalize a place name for dedup comparison.
 * Rules:
 * 1. Lower-case
 * 2. Trim + collapse whitespace
 * 3. Strip punctuation (except hyphens in compound names)
 * 4. Remove stopwords
 * 5. Normalize unicode (NFKD) and remove diacritics
 */
export function normalizeName(name: string): string {
  let normalized = name
    // Normalize unicode
    .normalize('NFKD')
    // Remove diacritics
    .replace(/[\u0300-\u036f]/g, '')
    // Lower-case
    .toLowerCase()
    // Replace punctuation with space (except hyphens)
    .replace(/[^\w\s-]/g, ' ')
    // Collapse whitespace
    .replace(/\s+/g, ' ')
    .trim();

  // Remove stopwords
  const words = normalized.split(' ').filter(w => !STOPWORDS.has(w));
  return words.join(' ');
}

// =============================================================================
// STRING SIMILARITY (JARO-WINKLER)
// =============================================================================

/**
 * Compute Jaro similarity between two strings.
 */
function jaroSimilarity(s1: string, s2: string): number {
  if (s1 === s2) return 1;
  if (s1.length === 0 || s2.length === 0) return 0;

  const matchWindow = Math.floor(Math.max(s1.length, s2.length) / 2) - 1;
  const s1Matches = new Array(s1.length).fill(false);
  const s2Matches = new Array(s2.length).fill(false);

  let matches = 0;
  let transpositions = 0;

  // Find matches
  for (let i = 0; i < s1.length; i++) {
    const start = Math.max(0, i - matchWindow);
    const end = Math.min(i + matchWindow + 1, s2.length);

    for (let j = start; j < end; j++) {
      if (s2Matches[j] || s1[i] !== s2[j]) continue;
      s1Matches[i] = true;
      s2Matches[j] = true;
      matches++;
      break;
    }
  }

  if (matches === 0) return 0;

  // Count transpositions
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
 * Compute Jaro-Winkler similarity (boosts common prefix).
 */
export function jaroWinklerSimilarity(s1: string, s2: string): number {
  const jaro = jaroSimilarity(s1, s2);

  // Find common prefix (up to 4 chars)
  let prefix = 0;
  for (let i = 0; i < Math.min(s1.length, s2.length, 4); i++) {
    if (s1[i] === s2[i]) prefix++;
    else break;
  }

  return jaro + prefix * 0.1 * (1 - jaro);
}

// =============================================================================
// HAVERSINE DISTANCE
// =============================================================================

/**
 * Calculate haversine distance between two points in meters.
 */
export function haversineDistanceMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371000; // Earth radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// =============================================================================
// CANONICAL PLACE REGISTRY
// =============================================================================

export interface CanonicalRegistryConfig {
  dedupMergeRadiusMeters: number;
  nameSimilarityThreshold: number;
  city: string;
}

const DEFAULT_REGISTRY_CONFIG: CanonicalRegistryConfig = {
  dedupMergeRadiusMeters: 300,
  nameSimilarityThreshold: 0.92,
  city: '',
};

export class CanonicalPlaceRegistry {
  private config: CanonicalRegistryConfig;
  private canonicalPlacesById: Map<CanonicalPlaceId, CanonicalPlace> = new Map();
  private rawIdToCanonicalId: Map<RawPlaceId, CanonicalPlaceId> = new Map();
  private dedupKeyToCanonicalId: Map<string, CanonicalPlaceId> = new Map();
  private mergeLog: CanonicalRegistryResult['mergeLog'] = [];
  private idMappingFailures: CanonicalRegistryResult['idMappingFailures'] = [];

  constructor(config: Partial<CanonicalRegistryConfig> = {}) {
    this.config = { ...DEFAULT_REGISTRY_CONFIG, ...config };
  }

  /**
   * Register candidates and create canonical records.
   */
  async register(
    candidates: EnrichedCandidateRaw[],
    anchorCandidatesRaw: AnchorCandidateRaw[],
    mustIncludeRawIds: RawPlaceId[],
    avoidIncludeRawIds: RawPlaceId[],
    trace?: PlanTraceBuilder
  ): Promise<CanonicalRegistryResult> {
    // Process all candidates
    for (const candidate of candidates) {
      this.processCandidate(candidate);
    }

    // Map mustInclude raw IDs to canonical IDs
    const mustInclude: CanonicalPlaceId[] = [];
    for (const rawId of mustIncludeRawIds) {
      const canonicalId = this.rawIdToCanonicalId.get(rawId);
      if (canonicalId) {
        mustInclude.push(canonicalId);
      } else {
        this.idMappingFailures.push({
          rawId,
          source: 'mustInclude',
          reason: 'RAW_ID_NOT_FOUND',
        });
        trace?.logIdMappingFailure(rawId, 'mustInclude', 'RAW_ID_NOT_FOUND');
      }
    }

    // Map avoidInclude raw IDs to canonical IDs
    const avoidInclude: CanonicalPlaceId[] = [];
    for (const rawId of avoidIncludeRawIds) {
      const canonicalId = this.rawIdToCanonicalId.get(rawId);
      if (canonicalId) {
        avoidInclude.push(canonicalId);
      } else {
        this.idMappingFailures.push({
          rawId,
          source: 'avoidInclude',
          reason: 'RAW_ID_NOT_FOUND',
        });
        trace?.logIdMappingFailure(rawId, 'avoidInclude', 'RAW_ID_NOT_FOUND');
      }
    }

    // Convert anchor candidates to canonical
    const anchors: AnchorCandidate[] = [];
    for (const anchor of anchorCandidatesRaw) {
      const canonicalId = this.rawIdToCanonicalId.get(anchor.rawId);
      if (canonicalId) {
        const canonical = this.canonicalPlacesById.get(canonicalId);
        anchors.push({
          canonicalId,
          rawIds: canonical?.rawIds || [anchor.rawId],
          name: anchor.name,
          iconicScore: anchor.iconicScore,
          reviewCount: anchor.reviewCount,
          rating: anchor.rating,
          category: anchor.category,
          location: anchor.location,
        });
      }
    }

    return {
      canonicalPlacesById: new Map(this.canonicalPlacesById),
      rawIdToCanonicalId: new Map(this.rawIdToCanonicalId),
      mustInclude,
      avoidInclude,
      anchors,
      idMappingFailures: [...this.idMappingFailures],
      mergeLog: [...this.mergeLog],
    };
  }

  /**
   * Process a single candidate and add to registry.
   */
  private processCandidate(candidate: EnrichedCandidateRaw): void {
    const rawId = candidate.rawId;

    // Check if rawId already mapped
    if (this.rawIdToCanonicalId.has(rawId)) {
      return;
    }

    // Generate dedup key
    const geohash6 = candidate.geohash6 || encodeGeohash(
      candidate.location.lat,
      candidate.location.lng,
      6
    );
    const dedupKey = this.generateDedupKey(candidate.normalizedName, geohash6, candidate.category);

    // Check for exact dedupKey match
    const existingByKey = this.dedupKeyToCanonicalId.get(dedupKey);
    if (existingByKey) {
      this.mergeIntoExisting(existingByKey, candidate, 'exact_key');
      return;
    }

    // Check for near-duplicate (distance + name similarity)
    const nearDuplicate = this.findNearDuplicate(candidate);
    if (nearDuplicate) {
      this.mergeIntoExisting(nearDuplicate, candidate, 'near_duplicate');
      return;
    }

    // Create new canonical record
    const canonicalId = this.generateCanonicalId(rawId);
    const canonical: CanonicalPlace = {
      canonicalId,
      name: candidate.name,
      normalizedName: candidate.normalizedName,
      location: candidate.location,
      geohash6,
      reviewCount: candidate.reviewCount,
      rating: candidate.rating,
      categories: [candidate.category],
      photoUrls: candidate.photoUrl ? [candidate.photoUrl] : [],
      rawIds: [rawId],
    };

    this.canonicalPlacesById.set(canonicalId, canonical);
    this.rawIdToCanonicalId.set(rawId, canonicalId);
    this.dedupKeyToCanonicalId.set(dedupKey, canonicalId);
  }

  /**
   * Generate canonical ID from raw ID.
   * Format: pid:<rawId>
   */
  private generateCanonicalId(rawId: RawPlaceId): CanonicalPlaceId {
    return `pid:${rawId}`;
  }

  /**
   * Generate dedup key from normalized name, geohash, and category.
   */
  private generateDedupKey(normalizedName: string, geohash6: string, category: string): string {
    return `${normalizedName}|${geohash6}|${category}`;
  }

  /**
   * Find a near-duplicate in existing records.
   */
  private findNearDuplicate(candidate: EnrichedCandidateRaw): CanonicalPlaceId | null {
    for (const [canonicalId, canonical] of this.canonicalPlacesById) {
      // Check distance
      const distance = haversineDistanceMeters(
        candidate.location.lat,
        candidate.location.lng,
        canonical.location.lat,
        canonical.location.lng
      );

      if (distance > this.config.dedupMergeRadiusMeters) {
        continue;
      }

      // Check name similarity
      const similarity = jaroWinklerSimilarity(
        candidate.normalizedName,
        canonical.normalizedName
      );

      if (similarity >= this.config.nameSimilarityThreshold) {
        return canonicalId;
      }
    }

    return null;
  }

  /**
   * Merge a candidate into an existing canonical record.
   */
  private mergeIntoExisting(
    canonicalId: CanonicalPlaceId,
    candidate: EnrichedCandidateRaw,
    reason: 'exact_key' | 'near_duplicate'
  ): void {
    const canonical = this.canonicalPlacesById.get(canonicalId);
    if (!canonical) return;

    // Map raw ID
    this.rawIdToCanonicalId.set(candidate.rawId, canonicalId);
    canonical.rawIds.push(candidate.rawId);

    // Keep highest reviewCount
    if (candidate.reviewCount > canonical.reviewCount) {
      canonical.reviewCount = candidate.reviewCount;
      canonical.name = candidate.name; // Use name from higher-review source
    }

    // Keep highest rating
    if (candidate.rating > canonical.rating) {
      canonical.rating = candidate.rating;
    }

    // Union categories
    if (!canonical.categories.includes(candidate.category)) {
      canonical.categories.push(candidate.category);
    }

    // Union photos
    if (candidate.photoUrl && !canonical.photoUrls.includes(candidate.photoUrl)) {
      canonical.photoUrls.push(candidate.photoUrl);
    }

    // Log merge
    this.mergeLog.push({
      canonicalId,
      mergedRawIds: [candidate.rawId],
      reason,
    });
  }

  /**
   * Get canonical place by raw ID.
   */
  getCanonical(rawId: RawPlaceId): CanonicalPlace | undefined {
    const canonicalId = this.rawIdToCanonicalId.get(rawId);
    return canonicalId ? this.canonicalPlacesById.get(canonicalId) : undefined;
  }

  /**
   * Get canonical ID for a raw ID.
   */
  getCanonicalId(rawId: RawPlaceId): CanonicalPlaceId | undefined {
    return this.rawIdToCanonicalId.get(rawId);
  }

  /**
   * Convert enriched candidates from raw to canonical.
   */
  toCanonicalCandidates(
    rawCandidates: EnrichedCandidateRaw[]
  ): EnrichedCandidateCanonical[] {
    const seen = new Set<CanonicalPlaceId>();
    const result: EnrichedCandidateCanonical[] = [];

    for (const raw of rawCandidates) {
      const canonicalId = this.rawIdToCanonicalId.get(raw.rawId);
      if (!canonicalId || seen.has(canonicalId)) continue;

      seen.add(canonicalId);
      const canonical = this.canonicalPlacesById.get(canonicalId);

      result.push({
        ...raw,
        canonicalId,
        rawIds: canonical?.rawIds || [raw.rawId],
        geohash6: canonical?.geohash6 || encodeGeohash(raw.location.lat, raw.location.lng, 6),
      });
    }

    return result;
  }
}

// =============================================================================
// FACTORY FUNCTION
// =============================================================================

/**
 * Create and populate a canonical registry from candidates.
 */
export async function createCanonicalRegistry(
  candidates: EnrichedCandidateRaw[],
  anchorCandidatesRaw: AnchorCandidateRaw[],
  mustIncludeRawIds: RawPlaceId[],
  avoidIncludeRawIds: RawPlaceId[],
  config: Partial<CanonicalRegistryConfig> = {},
  trace?: PlanTraceBuilder
): Promise<{ registry: CanonicalPlaceRegistry; result: CanonicalRegistryResult }> {
  const registry = new CanonicalPlaceRegistry(config);
  const result = await registry.register(
    candidates,
    anchorCandidatesRaw,
    mustIncludeRawIds,
    avoidIncludeRawIds,
    trace
  );

  // Log to trace
  if (trace) {
    trace.logRetrieval({
      afterDedup: result.canonicalPlacesById.size,
    });
  }

  return { registry, result };
}
