/**
 * Zone Builder
 *
 * Geographic clustering for zone-first day planning:
 * - K-means clustering to group candidates by location
 * - Zone merging for close clusters
 * - Day-to-zone assignment with big rock handling
 * - Utility-based zone scoring
 *
 * v3 Enhancements:
 * - Zone validation with diameter and balance checks
 * - DBSCAN fallback for corridor-like cities
 * - Big Rock zone seeding
 * - PlanTrace logging
 */

import {
  Zone,
  EnrichedCandidate,
  ZoneConfig,
  DEFAULT_ZONE_CONFIG,
} from './types';
import {
  ZoneV3,
  ZoneBuilderResult,
  EnrichedCandidateCanonical,
  CanonicalPlaceId,
} from '../types/optimizer-v3';
import { OptimizerV3Config, DEFAULT_OPTIMIZER_V3_CONFIG } from '../config/optimizer-config';
import { getFeatureFlags } from '../config/feature-flags';
import { validateZones, rebalanceZones, haversineDistance as haversineDistanceV3 } from './zone-validator';
import { dbscanClustering, handleInsufficientClusters, createDBSCANConfig } from './dbscan-clustering';
import { PlanTraceBuilder } from '../observability/plan-trace';
import { haversineDistance } from '../utils/duration-estimator';

// =============================================================================
// MAIN ZONE BUILDING
// =============================================================================

export interface ZoneBuildResult {
  zones: Zone[];
  dayAssignments: Map<number, number>; // dayIndex -> zoneId
  candidateZoneMap: Map<string, number>; // candidateId -> zoneId
}

/**
 * Build zones from candidates and assign days to zones
 */
export function buildZonesAndAssignDays(
  candidates: EnrichedCandidate[],
  numDays: number,
  config: ZoneConfig = DEFAULT_ZONE_CONFIG
): ZoneBuildResult {
  if (candidates.length === 0) {
    return {
      zones: [],
      dayAssignments: new Map(),
      candidateZoneMap: new Map(),
    };
  }

  // Step 1: Initial clustering
  const k = calculateOptimalK(candidates.length, numDays);
  let zones = kMeansClustering(candidates, k);

  // Step 2: Merge close zones
  zones = mergeCloseZones(zones, config.zoneMergeDistanceKm);

  // Step 3: Compute zone properties
  for (const zone of zones) {
    zone.bigRocks = zone.candidates.filter(c => c.isBigRock);
    zone.hasBigRock = zone.bigRocks.length > 0;
    zone.totalUtility = computeZoneUtility(zone.candidates);
    zone.name = inferZoneName(zone);
  }

  // Step 4: Assign days to zones
  const dayAssignments = assignDaysToZones(zones, numDays);

  // Step 5: Build candidate -> zone map
  const candidateZoneMap = new Map<string, number>();
  for (const zone of zones) {
    for (const candidate of zone.candidates) {
      candidateZoneMap.set(candidate.id, zone.id);
      candidate.zoneId = zone.id;
    }
  }

  return { zones, dayAssignments, candidateZoneMap };
}

// =============================================================================
// K-MEANS CLUSTERING
// =============================================================================

/**
 * Calculate optimal number of clusters
 */
function calculateOptimalK(numCandidates: number, numDays: number): number {
  // At least numDays zones, but cap at reasonable amount
  const minK = Math.min(numDays, numCandidates);
  const maxK = Math.min(numDays + 2, Math.ceil(numCandidates / 3), 8);
  return Math.max(minK, Math.min(maxK, numCandidates));
}

/**
 * K-means clustering with k-means++ initialization
 */
export function kMeansClustering(
  candidates: EnrichedCandidate[],
  k: number
): Zone[] {
  if (candidates.length <= k) {
    // Each candidate is its own zone
    return candidates.map((c, idx) => ({
      id: idx,
      centroid: { ...c.location },
      candidates: [c],
      totalUtility: 0,
      hasBigRock: false,
      bigRocks: [],
    }));
  }

  // K-means++ initialization
  const centroids = initializeCentroids(candidates, k);

  // Iterate until convergence (max 20 iterations)
  let assignments: number[] = [];
  const maxIterations = 20;

  for (let iter = 0; iter < maxIterations; iter++) {
    // Assign candidates to nearest centroid
    const newAssignments = candidates.map(c => {
      let minDist = Infinity;
      let minIdx = 0;

      for (let i = 0; i < centroids.length; i++) {
        const dist = haversineDistance(c.location, centroids[i]);
        if (dist < minDist) {
          minDist = dist;
          minIdx = i;
        }
      }
      return minIdx;
    });

    // Check convergence
    if (arraysEqual(newAssignments, assignments)) {
      break;
    }
    assignments = newAssignments;

    // Recompute centroids
    for (let i = 0; i < k; i++) {
      const clusterCandidates = candidates.filter((_, idx) => assignments[idx] === i);
      if (clusterCandidates.length > 0) {
        centroids[i] = {
          lat: clusterCandidates.reduce((s, c) => s + c.location.lat, 0) / clusterCandidates.length,
          lng: clusterCandidates.reduce((s, c) => s + c.location.lng, 0) / clusterCandidates.length,
        };
      }
    }
  }

  // Build zone objects
  const zones: Zone[] = centroids.map((centroid, id) => ({
    id,
    centroid,
    candidates: candidates.filter((_, idx) => assignments[idx] === id),
    totalUtility: 0,
    hasBigRock: false,
    bigRocks: [],
  }));

  // Filter out empty zones
  return zones.filter(z => z.candidates.length > 0).map((z, idx) => ({ ...z, id: idx }));
}

/**
 * K-means++ centroid initialization
 */
function initializeCentroids(
  candidates: EnrichedCandidate[],
  k: number
): Array<{ lat: number; lng: number }> {
  const centroids: Array<{ lat: number; lng: number }> = [];

  // First centroid: candidate with highest utility (likely important)
  const sorted = [...candidates].sort((a, b) => b.utilityScore - a.utilityScore);
  centroids.push({ ...sorted[0].location });

  // Remaining centroids: weighted by distance from existing
  // Max iterations to prevent infinite loop (k * 10 attempts should be plenty)
  const maxIterations = k * 10;
  let iterations = 0;

  while (centroids.length < k && iterations < maxIterations) {
    iterations++;

    const distances = candidates.map(c => {
      const minDist = Math.min(
        ...centroids.map(cent => haversineDistance(c.location, cent))
      );
      return minDist * minDist; // Square for probability weighting
    });

    const totalDist = distances.reduce((a, b) => a + b, 0);
    if (totalDist === 0) break;

    let target = Math.random() * totalDist;
    let foundCentroid = false;

    for (let i = 0; i < candidates.length; i++) {
      target -= distances[i];
      if (target <= 0) {
        // Check for duplicate centroids
        const newCentroid = candidates[i].location;
        const isDuplicate = centroids.some(
          c => c.lat === newCentroid.lat && c.lng === newCentroid.lng
        );
        if (!isDuplicate) {
          centroids.push({ ...newCentroid });
          foundCentroid = true;
        }
        break;
      }
    }

    // Fallback: if no centroid found (floating point edge case), pick farthest candidate
    if (!foundCentroid && centroids.length < k) {
      let maxDist = -1;
      let farthestIdx = 0;
      for (let i = 0; i < distances.length; i++) {
        if (distances[i] > maxDist) {
          const loc = candidates[i].location;
          const isDuplicate = centroids.some(
            c => c.lat === loc.lat && c.lng === loc.lng
          );
          if (!isDuplicate) {
            maxDist = distances[i];
            farthestIdx = i;
          }
        }
      }
      if (maxDist > 0) {
        centroids.push({ ...candidates[farthestIdx].location });
      }
    }
  }

  if (iterations >= maxIterations) {
    console.warn(`K-means++ reached max iterations (${maxIterations}), using ${centroids.length} centroids`);
  }

  return centroids;
}

// =============================================================================
// ZONE MERGING
// =============================================================================

/**
 * Merge zones that are geographically close
 */
export function mergeCloseZones(
  zones: Zone[],
  maxDistKm: number
): Zone[] {
  if (zones.length <= 1) return zones;

  const merged: Zone[] = [];
  const used = new Set<number>();

  // Sort by utility so we keep high-utility zone IDs
  const sortedZones = [...zones].sort((a, b) => b.totalUtility - a.totalUtility);

  for (let i = 0; i < sortedZones.length; i++) {
    if (used.has(sortedZones[i].id)) continue;

    const zone: Zone = {
      ...sortedZones[i],
      candidates: [...sortedZones[i].candidates],
    };

    for (let j = i + 1; j < sortedZones.length; j++) {
      if (used.has(sortedZones[j].id)) continue;

      const dist = haversineDistance(zone.centroid, sortedZones[j].centroid);
      if (dist <= maxDistKm) {
        // Merge zone j into zone
        zone.candidates.push(...sortedZones[j].candidates);
        used.add(sortedZones[j].id);

        // Recompute centroid
        zone.centroid = {
          lat: zone.candidates.reduce((s, c) => s + c.location.lat, 0) / zone.candidates.length,
          lng: zone.candidates.reduce((s, c) => s + c.location.lng, 0) / zone.candidates.length,
        };
      }
    }

    merged.push(zone);
    used.add(sortedZones[i].id);
  }

  // Reassign IDs
  return merged.map((z, idx) => ({ ...z, id: idx }));
}

// =============================================================================
// DAY ASSIGNMENT
// =============================================================================

/**
 * Assign days to zones based on big rocks and utility
 */
export function assignDaysToZones(
  zones: Zone[],
  numDays: number
): Map<number, number> {
  const dayAssignments = new Map<number, number>();

  if (zones.length === 0) return dayAssignments;

  // Separate big rock zones and regular zones
  const bigRockZones = zones
    .filter(z => z.hasBigRock)
    .sort((a, b) => b.totalUtility - a.totalUtility);

  const regularZones = zones
    .filter(z => !z.hasBigRock)
    .sort((a, b) => b.totalUtility - a.totalUtility);

  let dayIndex = 0;

  // First: assign days to big rock zones (one per day)
  for (const zone of bigRockZones) {
    if (dayIndex >= numDays) break;
    dayAssignments.set(dayIndex, zone.id);
    dayIndex++;
  }

  // Second: assign remaining days to high-utility zones
  for (const zone of regularZones) {
    if (dayIndex >= numDays) break;

    // Check if zone has enough content for a day
    const totalDuration = zone.candidates.reduce(
      (sum, c) => sum + c.durationExpected,
      0
    );

    if (totalDuration >= 120) { // At least 2 hours of content
      dayAssignments.set(dayIndex, zone.id);
      dayIndex++;
    }
  }

  // Fill remaining days by reusing best zones
  const allZonesSorted = [...zones].sort((a, b) => b.totalUtility - a.totalUtility);
  let zoneIdx = 0;

  while (dayIndex < numDays && allZonesSorted.length > 0) {
    dayAssignments.set(dayIndex, allZonesSorted[zoneIdx % allZonesSorted.length].id);
    dayIndex++;
    zoneIdx++;
  }

  return dayAssignments;
}

// =============================================================================
// ZONE UTILITIES
// =============================================================================

/**
 * Compute total utility score for a zone
 */
export function computeZoneUtility(candidates: EnrichedCandidate[]): number {
  return candidates.reduce((sum, c) => {
    const anchorBonus = c.reviewCount > 50000 ? 2.0 : c.reviewCount > 10000 ? 1.5 : 1.0;
    const bigRockBonus = c.isBigRock ? 3.0 : 1.0;
    return sum + c.utilityScore * anchorBonus * bigRockBonus;
  }, 0);
}

/**
 * Infer a human-readable name for a zone
 */
export function inferZoneName(zone: Zone): string {
  // Try to find the most iconic place in the zone
  const sortedByReviews = [...zone.candidates].sort(
    (a, b) => b.reviewCount - a.reviewCount
  );

  if (sortedByReviews.length === 0) {
    return `Zone ${zone.id + 1}`;
  }

  const topPlace = sortedByReviews[0];

  // Use vicinity if available
  if (topPlace.vicinity) {
    const parts = topPlace.vicinity.split(',');
    if (parts.length > 0) {
      return parts[0].trim();
    }
  }

  // Fallback to top place name + "Area"
  return `${topPlace.name} Area`;
}

/**
 * Get candidates for a specific zone
 */
export function getCandidatesForZone(
  candidates: EnrichedCandidate[],
  zoneId: number
): EnrichedCandidate[] {
  return candidates.filter(c => c.zoneId === zoneId);
}

/**
 * Get the zone containing a specific candidate
 */
export function getZoneForCandidate(
  zones: Zone[],
  candidateId: string
): Zone | undefined {
  return zones.find(z => z.candidates.some(c => c.id === candidateId));
}

/**
 * Check if two candidates are in the same zone
 */
export function areSameZone(
  c1: EnrichedCandidate,
  c2: EnrichedCandidate
): boolean {
  return c1.zoneId !== undefined && c1.zoneId === c2.zoneId;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function arraysEqual(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

/**
 * Calculate the average distance between candidates in a zone
 * Used to detect overly spread-out zones
 */
export function calculateZoneSpread(zone: Zone): number {
  if (zone.candidates.length <= 1) return 0;

  let totalDist = 0;
  let count = 0;

  for (let i = 0; i < zone.candidates.length; i++) {
    for (let j = i + 1; j < zone.candidates.length; j++) {
      totalDist += haversineDistance(
        zone.candidates[i].location,
        zone.candidates[j].location
      );
      count++;
    }
  }

  return count > 0 ? totalDist / count : 0;
}

/**
 * Check if adding a candidate to a day would cause cross-zone travel
 */
export function wouldCrossZone(
  dayZoneId: number,
  candidate: EnrichedCandidate
): boolean {
  return candidate.zoneId !== undefined && candidate.zoneId !== dayZoneId;
}


// =============================================================================
// V3 ZONE BUILDING
// =============================================================================

/**
 * Build zones using v3 algorithm with validation and fallback.
 *
 * Strategy:
 * 1. Identify Big Rocks and create seed zones
 * 2. Run K-means clustering
 * 3. Validate zones (diameter, balance)
 * 4. If validation fails and ENABLE_DBSCAN_FALLBACK, try DBSCAN
 * 5. Rebalance if needed
 * 6. Log to PlanTrace
 */
export function buildZonesV3(
  candidates: EnrichedCandidateCanonical[],
  numDays: number,
  anchors: Set<CanonicalPlaceId>,
  config: OptimizerV3Config = DEFAULT_OPTIMIZER_V3_CONFIG,
  trace?: PlanTraceBuilder
): ZoneBuilderResult {
  const featureFlags = getFeatureFlags();

  if (candidates.length === 0) {
    const emptyResult: ZoneBuilderResult = {
      zones: [],
      assignmentByCanonicalId: {},
      pinnedByCanonicalId: {},
      validation: {
        isValid: true,
        violations: [],
        zoneDiameters: new Map(),
        zoneLoads: new Map(),
      },
      fallbackUsed: false,
      method: 'kmeans',
    };
    return emptyResult;
  }

  // Step 1: Identify Big Rocks and pin them
  const bigRocks = candidates.filter(c => c.isBigRock);
  const pinnedByCanonicalId: Record<CanonicalPlaceId, 'anchor' | 'big_rock'> = {};

  // Pin anchors
  for (const anchorId of anchors) {
    pinnedByCanonicalId[anchorId] = 'anchor';
  }

  // Pin top numDays Big Rocks as zone seeds
  const sortedBigRocks = [...bigRocks].sort((a, b) => b.utilityScore - a.utilityScore);
  const pinnedBigRocks = sortedBigRocks.slice(0, numDays);
  for (const br of pinnedBigRocks) {
    if (!pinnedByCanonicalId[br.canonicalId]) {
      pinnedByCanonicalId[br.canonicalId] = 'big_rock';
    }
  }

  console.log(`[ZoneBuilder v3] Building zones for ${candidates.length} candidates, ${numDays} days`);
  console.log(`  → ${bigRocks.length} Big Rocks, ${pinnedBigRocks.length} pinned as seeds`);
  console.log(`  → ${anchors.size} anchors pinned`);

  // Step 2: Run K-means clustering
  let zones = kMeansClusteringV3(candidates, numDays, pinnedBigRocks);
  let method: 'kmeans' | 'dbscan' | 'graph' = 'kmeans';
  let fallbackUsed = false;

  // Step 3: Validate zones
  let validation = validateZones(zones, config);

  // Step 4: If validation fails, try DBSCAN fallback
  if (!validation.isValid && featureFlags.ENABLE_DBSCAN_FALLBACK) {
    console.log(`[ZoneBuilder v3] K-means validation failed, trying DBSCAN fallback`);
    console.log(`  → Violations: ${validation.violations.map(v => v.type).join(', ')}`);

    const dbscanConfig = createDBSCANConfig(config);
    zones = dbscanClustering(candidates, dbscanConfig);
    zones = handleInsufficientClusters(zones, numDays, candidates);
    method = 'dbscan';
    fallbackUsed = true;

    // Re-validate
    validation = validateZones(zones, config);
  }

  // Step 5: Rebalance if still imbalanced
  const pinnedIds = new Set(Object.keys(pinnedByCanonicalId));
  if (!validation.isValid) {
    console.log(`[ZoneBuilder v3] Attempting rebalance`);
    zones = rebalanceZones(zones, pinnedIds, config);
    validation = validateZones(zones, config);
  }

  // Step 6: Build assignment map
  const assignmentByCanonicalId: Record<CanonicalPlaceId, number> = {};
  for (const zone of zones) {
    for (const c of zone.candidates) {
      assignmentByCanonicalId[c.canonicalId] = zone.id;
    }
  }

  // Log to PlanTrace
  if (trace) {
    const zoneDiameters: Record<number, number> = {};
    const zoneLoads: Record<number, { poiCount: number; plannedMinutes: number }> = {};

    for (const [zoneId, diameter] of validation.zoneDiameters) {
      zoneDiameters[zoneId] = diameter;
    }
    for (const [zoneId, load] of validation.zoneLoads) {
      zoneLoads[zoneId] = load;
    }

    trace.logZoning({
      method,
      zoneCount: zones.length,
      zoneDiameters,
      zoneLoads,
      validationPassed: validation.isValid,
      fallbackUsed,
      pinnedCandidates: pinnedByCanonicalId,
    });
  }

  console.log(`[ZoneBuilder v3] Complete: ${zones.length} zones, method=${method}, valid=${validation.isValid}`);

  return {
    zones,
    assignmentByCanonicalId,
    pinnedByCanonicalId,
    validation,
    fallbackUsed,
    method,
  };
}

/**
 * K-means clustering for v3 with Big Rock seeding.
 */
function kMeansClusteringV3(
  candidates: EnrichedCandidateCanonical[],
  k: number,
  bigRockSeeds: EnrichedCandidateCanonical[]
): ZoneV3[] {
  if (candidates.length === 0) return [];
  if (candidates.length <= k) {
    // Each candidate is its own zone
    return candidates.map((c, idx) => createZoneV3(idx, [c]));
  }

  // Initialize centroids: use Big Rock locations as seeds, then k-means++ for rest
  const centroids: Array<{ lat: number; lng: number }> = [];

  // Add Big Rock seeds first
  for (const br of bigRockSeeds.slice(0, k)) {
    centroids.push({ ...br.location });
  }

  // Fill remaining with k-means++ from non-Big-Rock candidates
  const nonBigRocks = candidates.filter(c => !c.isBigRock);
  while (centroids.length < k && nonBigRocks.length > 0) {
    const nextCentroid = selectNextCentroidKMeansPlusPlus(nonBigRocks, centroids);
    if (nextCentroid) {
      centroids.push(nextCentroid);
    } else {
      break;
    }
  }

  // If still not enough centroids, use any remaining candidates
  if (centroids.length < k) {
    for (const c of candidates) {
      if (centroids.length >= k) break;
      const isDuplicate = centroids.some(
        cent => cent.lat === c.location.lat && cent.lng === c.location.lng
      );
      if (!isDuplicate) {
        centroids.push({ ...c.location });
      }
    }
  }

  // Run K-means iterations
  let assignments: number[] = [];
  const maxIterations = 20;

  for (let iter = 0; iter < maxIterations; iter++) {
    // Assign candidates to nearest centroid
    const newAssignments = candidates.map(c => {
      let minDist = Infinity;
      let minIdx = 0;

      for (let i = 0; i < centroids.length; i++) {
        const dist = haversineDistanceV3(
          c.location.lat,
          c.location.lng,
          centroids[i].lat,
          centroids[i].lng
        );
        if (dist < minDist) {
          minDist = dist;
          minIdx = i;
        }
      }
      return minIdx;
    });

    // Check convergence
    if (arraysEqualV3(newAssignments, assignments)) {
      break;
    }
    assignments = newAssignments;

    // Recompute centroids (but keep Big Rock seeds fixed)
    for (let i = bigRockSeeds.length; i < centroids.length; i++) {
      const clusterCandidates = candidates.filter((_, idx) => assignments[idx] === i);
      if (clusterCandidates.length > 0) {
        centroids[i] = {
          lat: clusterCandidates.reduce((s, c) => s + c.location.lat, 0) / clusterCandidates.length,
          lng: clusterCandidates.reduce((s, c) => s + c.location.lng, 0) / clusterCandidates.length,
        };
      }
    }
  }

  // Build zone objects
  const zones: ZoneV3[] = [];
  for (let i = 0; i < centroids.length; i++) {
    const zoneCandidates = candidates.filter((_, idx) => assignments[idx] === i);
    if (zoneCandidates.length > 0) {
      zones.push(createZoneV3(i, zoneCandidates));
    }
  }

  // Renumber zones sequentially
  return zones.map((z, idx) => ({ ...z, id: idx }));
}

/**
 * Select next centroid using k-means++ weighted probability.
 */
function selectNextCentroidKMeansPlusPlus(
  candidates: EnrichedCandidateCanonical[],
  existingCentroids: Array<{ lat: number; lng: number }>
): { lat: number; lng: number } | null {
  if (candidates.length === 0) return null;
  if (existingCentroids.length === 0) {
    // Pick highest utility candidate
    const sorted = [...candidates].sort((a, b) => b.utilityScore - a.utilityScore);
    return { ...sorted[0].location };
  }

  // Compute squared distances to nearest centroid
  const distances = candidates.map(c => {
    const minDist = Math.min(
      ...existingCentroids.map(cent =>
        haversineDistanceV3(c.location.lat, c.location.lng, cent.lat, cent.lng)
      )
    );
    return minDist * minDist;
  });

  const totalDist = distances.reduce((a, b) => a + b, 0);
  if (totalDist === 0) return null;

  // Weighted random selection
  let target = Math.random() * totalDist;
  for (let i = 0; i < candidates.length; i++) {
    target -= distances[i];
    if (target <= 0) {
      const loc = candidates[i].location;
      const isDuplicate = existingCentroids.some(
        c => c.lat === loc.lat && c.lng === loc.lng
      );
      if (!isDuplicate) {
        return { ...loc };
      }
    }
  }

  return null;
}

/**
 * Create a ZoneV3 from candidates.
 */
function createZoneV3(id: number, candidates: EnrichedCandidateCanonical[]): ZoneV3 {
  const centroid = candidates.length > 0
    ? {
        lat: candidates.reduce((s, c) => s + c.location.lat, 0) / candidates.length,
        lng: candidates.reduce((s, c) => s + c.location.lng, 0) / candidates.length,
      }
    : { lat: 0, lng: 0 };

  return {
    id,
    centroid,
    candidates,
    totalUtility: candidates.reduce((sum, c) => sum + c.utilityScore, 0),
    hasBigRock: candidates.some(c => c.isBigRock),
    bigRocks: candidates.filter(c => c.isBigRock),
  };
}

function arraysEqualV3(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}
