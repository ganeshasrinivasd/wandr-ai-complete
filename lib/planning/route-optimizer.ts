/**
 * Route Optimizer
 *
 * Optimizes the order of activities within a day to minimize travel:
 * - Nearest-neighbor heuristic for initial ordering
 * - 2-opt improvement for small sets
 * - Travel matrix estimation via haversine
 */

import { EnrichedCandidate, TravelMatrix } from './types';
import { haversineDistance, estimateTravelTime } from '../utils/duration-estimator';

// =============================================================================
// MAIN ROUTE ORDERING
// =============================================================================

/**
 * Order activities to minimize total travel time
 * Uses nearest-neighbor for initial solution, then 2-opt improvement for small sets
 */
export function orderDayRoute(
  activities: EnrichedCandidate[],
  travelMatrix?: TravelMatrix
): EnrichedCandidate[] {
  if (activities.length <= 1) return activities;
  if (activities.length === 2) return activities; // No optimization needed

  // Build travel matrix if not provided
  const matrix = travelMatrix || buildTravelMatrix(activities);

  // Get initial ordering via nearest-neighbor
  const ordered = nearestNeighborOrder(activities, matrix);

  // Apply 2-opt improvement for small sets (n <= 8)
  if (activities.length <= 8) {
    return twoOptImprove(ordered, matrix);
  }

  return ordered;
}

// =============================================================================
// NEAREST NEIGHBOR HEURISTIC
// =============================================================================

/**
 * Order activities using nearest-neighbor greedy heuristic
 * Starts from highest-utility activity
 */
export function nearestNeighborOrder(
  activities: EnrichedCandidate[],
  travelMatrix: TravelMatrix
): EnrichedCandidate[] {
  if (activities.length <= 1) return [...activities];

  const remaining = new Set(activities.map(a => a.id));
  const ordered: EnrichedCandidate[] = [];

  // Start with highest-utility activity (big rocks first, then by utility)
  const sorted = [...activities].sort((a, b) => {
    // Big rocks always come first
    if (a.isBigRock && !b.isBigRock) return -1;
    if (!a.isBigRock && b.isBigRock) return 1;
    // Then by utility score
    return b.utilityScore - a.utilityScore;
  });

  let current = sorted[0];
  ordered.push(current);
  remaining.delete(current.id);

  // Greedily select nearest remaining activity
  while (remaining.size > 0) {
    let nearestDist = Infinity;
    let nearest: EnrichedCandidate | null = null;

    for (const id of remaining) {
      const candidate = activities.find(a => a.id === id)!;
      const dist = getTravelTime(travelMatrix, current.id, candidate.id);

      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = candidate;
      }
    }

    if (nearest) {
      ordered.push(nearest);
      remaining.delete(nearest.id);
      current = nearest;
    } else {
      break;
    }
  }

  return ordered;
}

// =============================================================================
// 2-OPT IMPROVEMENT
// =============================================================================

/**
 * Improve route using 2-opt local search
 * Reverses segments to find better orderings
 */
export function twoOptImprove(
  route: EnrichedCandidate[],
  travelMatrix: TravelMatrix
): EnrichedCandidate[] {
  if (route.length < 4) return route;

  let improved = true;
  let bestRoute = [...route];
  let bestCost = calculateRouteCost(bestRoute, travelMatrix);

  const maxIterations = 100; // Prevent infinite loops
  let iterations = 0;

  while (improved && iterations < maxIterations) {
    improved = false;
    iterations++;

    for (let i = 0; i < bestRoute.length - 2; i++) {
      for (let j = i + 2; j < bestRoute.length; j++) {
        // Try reversing segment [i+1, j]
        const newRoute = [
          ...bestRoute.slice(0, i + 1),
          ...bestRoute.slice(i + 1, j + 1).reverse(),
          ...bestRoute.slice(j + 1),
        ];

        const newCost = calculateRouteCost(newRoute, travelMatrix);

        if (newCost < bestCost - 0.5) { // Small threshold to avoid floating point issues
          bestRoute = newRoute;
          bestCost = newCost;
          improved = true;
        }
      }
    }
  }

  return bestRoute;
}

// =============================================================================
// TRAVEL MATRIX
// =============================================================================

/**
 * Build a travel matrix for a set of candidates
 * Uses haversine distance with urban speed assumptions
 */
export function buildTravelMatrix(
  candidates: EnrichedCandidate[]
): TravelMatrix {
  const matrix: TravelMatrix = new Map();

  for (const from of candidates) {
    const row = new Map<string, number>();

    for (const to of candidates) {
      if (from.id === to.id) {
        row.set(to.id, 0);
      } else {
        const travelMin = estimateTravelTime(from.location, to.location);
        row.set(to.id, travelMin);
      }
    }

    matrix.set(from.id, row);
  }

  return matrix;
}

/**
 * Get travel time between two candidates from matrix
 */
export function getTravelTime(
  matrix: TravelMatrix,
  fromId: string,
  toId: string
): number {
  const row = matrix.get(fromId);
  if (!row) return 30; // Default 30 minutes if not in matrix
  return row.get(toId) ?? 30;
}

/**
 * Calculate total travel cost for a route
 */
export function calculateRouteCost(
  route: EnrichedCandidate[],
  travelMatrix: TravelMatrix
): number {
  let total = 0;

  for (let i = 0; i < route.length - 1; i++) {
    total += getTravelTime(travelMatrix, route[i].id, route[i + 1].id);
  }

  return total;
}

// =============================================================================
// ROUTE ANALYSIS
// =============================================================================

/**
 * Get detailed travel breakdown for a route
 */
export function analyzeRoute(
  route: EnrichedCandidate[],
  travelMatrix?: TravelMatrix
): RouteAnalysis {
  const matrix = travelMatrix || buildTravelMatrix(route);
  const segments: RouteSegment[] = [];
  let totalTravel = 0;
  let maxSegment = 0;

  for (let i = 0; i < route.length - 1; i++) {
    const travelMin = getTravelTime(matrix, route[i].id, route[i + 1].id);
    const distanceKm = haversineDistance(route[i].location, route[i + 1].location);

    segments.push({
      from: route[i],
      to: route[i + 1],
      travelMinutes: travelMin,
      distanceKm,
    });

    totalTravel += travelMin;
    maxSegment = Math.max(maxSegment, travelMin);
  }

  return {
    route,
    segments,
    totalTravelMinutes: totalTravel,
    maxSegmentMinutes: maxSegment,
    averageSegmentMinutes: route.length > 1 ? totalTravel / (route.length - 1) : 0,
    totalDistanceKm: segments.reduce((s, seg) => s + seg.distanceKm, 0),
  };
}

export interface RouteSegment {
  from: EnrichedCandidate;
  to: EnrichedCandidate;
  travelMinutes: number;
  distanceKm: number;
}

export interface RouteAnalysis {
  route: EnrichedCandidate[];
  segments: RouteSegment[];
  totalTravelMinutes: number;
  maxSegmentMinutes: number;
  averageSegmentMinutes: number;
  totalDistanceKm: number;
}

// =============================================================================
// ROUTE VALIDATION
// =============================================================================

/**
 * Check if a route has acceptable travel times
 */
export function validateRoute(
  analysis: RouteAnalysis,
  maxTotalTravel: number = 120,
  maxSegmentTravel: number = 40
): RouteValidation {
  const issues: string[] = [];

  if (analysis.totalTravelMinutes > maxTotalTravel) {
    issues.push(
      `Total travel (${Math.round(analysis.totalTravelMinutes)} min) exceeds limit (${maxTotalTravel} min)`
    );
  }

  if (analysis.maxSegmentMinutes > maxSegmentTravel) {
    issues.push(
      `Longest segment (${Math.round(analysis.maxSegmentMinutes)} min) exceeds limit (${maxSegmentTravel} min)`
    );
  }

  // Check for zig-zag patterns (returning to near previous locations)
  const zigzags = detectZigZag(analysis.route);
  if (zigzags.length > 0) {
    issues.push(`Route has zig-zag pattern near: ${zigzags.join(', ')}`);
  }

  return {
    isValid: issues.length === 0,
    issues,
    totalTravelMinutes: analysis.totalTravelMinutes,
    maxSegmentMinutes: analysis.maxSegmentMinutes,
  };
}

export interface RouteValidation {
  isValid: boolean;
  issues: string[];
  totalTravelMinutes: number;
  maxSegmentMinutes: number;
}

/**
 * Detect zig-zag patterns in a route
 * Returns names of places that create zig-zag
 */
function detectZigZag(route: EnrichedCandidate[]): string[] {
  const zigzags: string[] = [];

  if (route.length < 4) return zigzags;

  for (let i = 2; i < route.length; i++) {
    const prev2 = route[i - 2];
    const current = route[i];

    // Check if current is closer to prev2 than to prev1
    const distToPrev2 = haversineDistance(current.location, prev2.location);

    if (distToPrev2 < 0.5) { // Within 500m of a place we visited 2 stops ago
      zigzags.push(current.name);
    }
  }

  return zigzags;
}

// =============================================================================
// ROUTE UTILITIES
// =============================================================================

/**
 * Insert an activity at the optimal position in a route
 */
export function insertOptimal(
  route: EnrichedCandidate[],
  activity: EnrichedCandidate,
  travelMatrix?: TravelMatrix
): EnrichedCandidate[] {
  if (route.length === 0) return [activity];

  const matrix = travelMatrix || buildTravelMatrix([...route, activity]);

  let bestPosition = 0;
  let bestCost = Infinity;

  // Try inserting at each position
  for (let i = 0; i <= route.length; i++) {
    const newRoute = [...route.slice(0, i), activity, ...route.slice(i)];
    const cost = calculateRouteCost(newRoute, matrix);

    if (cost < bestCost) {
      bestCost = cost;
      bestPosition = i;
    }
  }

  return [...route.slice(0, bestPosition), activity, ...route.slice(bestPosition)];
}

/**
 * Remove an activity and re-optimize the route
 */
export function removeAndReoptimize(
  route: EnrichedCandidate[],
  activityId: string,
  travelMatrix?: TravelMatrix
): EnrichedCandidate[] {
  const filtered = route.filter(a => a.id !== activityId);

  if (filtered.length <= 2) return filtered;

  const matrix = travelMatrix || buildTravelMatrix(filtered);
  return twoOptImprove(filtered, matrix);
}

/**
 * Swap two activities and check if it improves the route
 */
export function trySwap(
  route: EnrichedCandidate[],
  idx1: number,
  idx2: number,
  travelMatrix: TravelMatrix
): { improved: boolean; newRoute: EnrichedCandidate[] } {
  if (idx1 < 0 || idx2 < 0 || idx1 >= route.length || idx2 >= route.length) {
    return { improved: false, newRoute: route };
  }

  const currentCost = calculateRouteCost(route, travelMatrix);

  const newRoute = [...route];
  [newRoute[idx1], newRoute[idx2]] = [newRoute[idx2], newRoute[idx1]];

  const newCost = calculateRouteCost(newRoute, travelMatrix);

  if (newCost < currentCost) {
    return { improved: true, newRoute };
  }

  return { improved: false, newRoute: route };
}
