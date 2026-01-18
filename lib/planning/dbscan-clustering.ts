/**
 * DBSCAN Clustering
 *
 * Fallback clustering for corridor-like cities where K-means fails.
 * DBSCAN (Density-Based Spatial Clustering of Applications with Noise)
 * groups points based on density rather than distance to centroids.
 */

import {
  ZoneV3,
  EnrichedCandidateCanonical,
} from '../types/optimizer-v3';
import { haversineDistance } from './zone-validator';
import { OptimizerV3Config, DEFAULT_OPTIMIZER_V3_CONFIG } from '../config/optimizer-config';

// =============================================================================
// DBSCAN CONFIGURATION
// =============================================================================

export interface DBSCANConfig {
  /** Max distance between points in cluster (km) */
  epsilon: number;
  /** Min points to form a cluster */
  minPoints: number;
}

export const DEFAULT_DBSCAN_CONFIG: DBSCANConfig = {
  epsilon: 1.6,   // 8km / 5
  minPoints: 3,
};

// =============================================================================
// DBSCAN IMPLEMENTATION
// =============================================================================

/**
 * DBSCAN clustering algorithm.
 *
 * @param candidates - Candidates to cluster
 * @param config - DBSCAN configuration
 * @returns Array of zones (noise points form their own single-point zones)
 */
export function dbscanClustering(
  candidates: EnrichedCandidateCanonical[],
  config: DBSCANConfig = DEFAULT_DBSCAN_CONFIG
): ZoneV3[] {
  if (candidates.length === 0) return [];

  const n = candidates.length;
  const labels = new Array<number>(n).fill(-1); // -1 = unvisited
  const NOISE = -2;
  let clusterId = 0;

  // Build distance matrix for efficiency
  const distances = buildDistanceMatrix(candidates);

  for (let i = 0; i < n; i++) {
    if (labels[i] !== -1) continue; // Already processed

    const neighbors = regionQuery(i, config.epsilon, distances);

    if (neighbors.length < config.minPoints) {
      labels[i] = NOISE;
    } else {
      // Start a new cluster
      expandCluster(i, neighbors, clusterId, labels, config, distances);
      clusterId++;
    }
  }

  // Convert labels to zones
  return labelsToZones(candidates, labels, clusterId);
}

/**
 * Expand cluster from seed point.
 */
function expandCluster(
  seedIdx: number,
  neighbors: number[],
  clusterId: number,
  labels: number[],
  config: DBSCANConfig,
  distances: number[][]
): void {
  labels[seedIdx] = clusterId;

  const queue = [...neighbors];
  const visited = new Set<number>([seedIdx]);

  while (queue.length > 0) {
    const idx = queue.shift()!;
    if (visited.has(idx)) continue;
    visited.add(idx);

    if (labels[idx] === -2) {
      // Was noise, now border point
      labels[idx] = clusterId;
    }

    if (labels[idx] !== -1) continue; // Already in a cluster

    labels[idx] = clusterId;

    const newNeighbors = regionQuery(idx, config.epsilon, distances);
    if (newNeighbors.length >= config.minPoints) {
      // Core point, add its neighbors to queue
      for (const n of newNeighbors) {
        if (!visited.has(n)) {
          queue.push(n);
        }
      }
    }
  }
}

/**
 * Find all points within epsilon distance.
 */
function regionQuery(
  pointIdx: number,
  epsilon: number,
  distances: number[][]
): number[] {
  const neighbors: number[] = [];
  for (let i = 0; i < distances.length; i++) {
    if (distances[pointIdx][i] <= epsilon) {
      neighbors.push(i);
    }
  }
  return neighbors;
}

/**
 * Build distance matrix.
 */
function buildDistanceMatrix(candidates: EnrichedCandidateCanonical[]): number[][] {
  const n = candidates.length;
  const matrix: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const dist = haversineDistance(
        candidates[i].location.lat,
        candidates[i].location.lng,
        candidates[j].location.lat,
        candidates[j].location.lng
      );
      matrix[i][j] = dist;
      matrix[j][i] = dist;
    }
  }

  return matrix;
}

/**
 * Convert cluster labels to Zone objects.
 */
function labelsToZones(
  candidates: EnrichedCandidateCanonical[],
  labels: number[],
  numClusters: number
): ZoneV3[] {
  const zones: ZoneV3[] = [];

  // Create zones for each cluster
  for (let clusterId = 0; clusterId < numClusters; clusterId++) {
    const clusterCandidates = candidates.filter((_, i) => labels[i] === clusterId);
    if (clusterCandidates.length === 0) continue;

    zones.push(createZone(clusterId, clusterCandidates));
  }

  // Handle noise points - assign to nearest cluster or create singleton zones
  const noiseIndices = labels
    .map((label, idx) => (label === -2 ? idx : -1))
    .filter(idx => idx !== -1);

  if (noiseIndices.length > 0 && zones.length > 0) {
    // Assign noise to nearest cluster
    for (const idx of noiseIndices) {
      const candidate = candidates[idx];
      const nearestZone = findNearestZone(candidate, zones);
      if (nearestZone) {
        nearestZone.candidates.push(candidate);
      }
    }

    // Recompute zone properties
    for (const zone of zones) {
      zone.centroid = computeCentroid(zone.candidates);
      zone.totalUtility = zone.candidates.reduce((sum, c) => sum + c.utilityScore, 0);
      zone.hasBigRock = zone.candidates.some(c => c.isBigRock);
      zone.bigRocks = zone.candidates.filter(c => c.isBigRock);
    }
  } else if (noiseIndices.length > 0 && zones.length === 0) {
    // All points are noise - create one zone with all
    const allCandidates = candidates.filter((_, i) => labels[i] === -2);
    zones.push(createZone(0, allCandidates));
  }

  return zones;
}

/**
 * Create a zone from candidates.
 */
function createZone(id: number, candidates: EnrichedCandidateCanonical[]): ZoneV3 {
  return {
    id,
    centroid: computeCentroid(candidates),
    candidates,
    totalUtility: candidates.reduce((sum, c) => sum + c.utilityScore, 0),
    hasBigRock: candidates.some(c => c.isBigRock),
    bigRocks: candidates.filter(c => c.isBigRock),
  };
}

/**
 * Compute centroid of candidates.
 */
function computeCentroid(
  candidates: EnrichedCandidateCanonical[]
): { lat: number; lng: number } {
  if (candidates.length === 0) {
    return { lat: 0, lng: 0 };
  }

  const sumLat = candidates.reduce((sum, c) => sum + c.location.lat, 0);
  const sumLng = candidates.reduce((sum, c) => sum + c.location.lng, 0);

  return {
    lat: sumLat / candidates.length,
    lng: sumLng / candidates.length,
  };
}

/**
 * Find nearest zone to a candidate.
 */
function findNearestZone(
  candidate: EnrichedCandidateCanonical,
  zones: ZoneV3[]
): ZoneV3 | null {
  let nearest: ZoneV3 | null = null;
  let minDist = Infinity;

  for (const zone of zones) {
    const dist = haversineDistance(
      candidate.location.lat,
      candidate.location.lng,
      zone.centroid.lat,
      zone.centroid.lng
    );

    if (dist < minDist) {
      minDist = dist;
      nearest = zone;
    }
  }

  return nearest;
}

// =============================================================================
// INSUFFICIENT CLUSTERS HANDLING
// =============================================================================

/**
 * Handle case when DBSCAN yields fewer clusters than days.
 *
 * Strategy:
 * 1. If clusters < numDays, split largest clusters using K-means bisection
 * 2. Continue until we have numDays clusters or can't split further
 */
export function handleInsufficientClusters(
  zones: ZoneV3[],
  numDays: number,
  candidates: EnrichedCandidateCanonical[]
): ZoneV3[] {
  if (zones.length >= numDays) return zones;
  if (zones.length === 0) {
    // Create single zone with all candidates
    return [createZone(0, candidates)];
  }

  let result = [...zones];
  let nextId = Math.max(...result.map(z => z.id)) + 1;

  // Keep splitting until we have enough zones
  while (result.length < numDays) {
    // Find largest zone that can be split
    const sortedBySize = [...result].sort(
      (a, b) => b.candidates.length - a.candidates.length
    );

    const toSplit = sortedBySize.find(z => z.candidates.length >= 2);
    if (!toSplit) break; // Can't split any further

    // Split using bisection
    const [zone1, zone2] = bisectZone(toSplit, nextId);
    nextId++;

    // Replace original with two new zones
    result = result.filter(z => z.id !== toSplit.id);
    result.push(zone1, zone2);

    console.log(
      `[DBSCAN] Split zone ${toSplit.id} (${toSplit.candidates.length} POIs) ` +
      `into zones ${zone1.id} (${zone1.candidates.length}) and ${zone2.id} (${zone2.candidates.length})`
    );
  }

  // Renumber zones sequentially
  return result.map((z, idx) => ({ ...z, id: idx }));
}

/**
 * Bisect a zone into two using furthest-point seeding.
 */
function bisectZone(zone: ZoneV3, newId: number): [ZoneV3, ZoneV3] {
  const candidates = zone.candidates;
  if (candidates.length <= 1) {
    return [zone, createZone(newId, [])];
  }

  // Find two furthest points as seeds
  let maxDist = 0;
  let seed1 = candidates[0];
  let seed2 = candidates[1];

  for (let i = 0; i < candidates.length; i++) {
    for (let j = i + 1; j < candidates.length; j++) {
      const dist = haversineDistance(
        candidates[i].location.lat,
        candidates[i].location.lng,
        candidates[j].location.lat,
        candidates[j].location.lng
      );
      if (dist > maxDist) {
        maxDist = dist;
        seed1 = candidates[i];
        seed2 = candidates[j];
      }
    }
  }

  // Assign each candidate to nearest seed
  const group1: EnrichedCandidateCanonical[] = [];
  const group2: EnrichedCandidateCanonical[] = [];

  for (const c of candidates) {
    const dist1 = haversineDistance(
      c.location.lat,
      c.location.lng,
      seed1.location.lat,
      seed1.location.lng
    );
    const dist2 = haversineDistance(
      c.location.lat,
      c.location.lng,
      seed2.location.lat,
      seed2.location.lng
    );

    if (dist1 <= dist2) {
      group1.push(c);
    } else {
      group2.push(c);
    }
  }

  return [
    createZone(zone.id, group1),
    createZone(newId, group2),
  ];
}

/**
 * Create DBSCAN config from optimizer config.
 */
export function createDBSCANConfig(
  optimizerConfig: OptimizerV3Config = DEFAULT_OPTIMIZER_V3_CONFIG
): DBSCANConfig {
  return {
    epsilon: optimizerConfig.dbscanEpsilonKm,
    minPoints: optimizerConfig.dbscanMinPoints,
  };
}
