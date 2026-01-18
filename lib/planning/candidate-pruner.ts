/**
 * Candidate Pruner
 *
 * Pre-zoning candidate reduction for performance.
 * Geography-aware to preserve corridor coverage.
 *
 * Pruning strategy:
 * 1) Always keep anchors + mustInclude (never pruned)
 * 2) Group remaining by geohash6 cell and category
 * 3) Keep top-K by utility per group (preserves geographic diversity)
 * 4) Apply global maxCandidatePoolTotal cap
 */

import {
  EnrichedCandidateCanonical,
  CanonicalPlaceId,
  DropReasonCode,
} from '../types/optimizer-v3';
import { PlanTraceBuilder } from '../observability/plan-trace';
import { DEFAULT_OPTIMIZER_V3_CONFIG, OptimizerV3Config } from '../config/optimizer-config';

// =============================================================================
// PRUNER CONFIGURATION
// =============================================================================

export interface PrunerConfig {
  maxCandidatesPerDay: number;    // Default: 30
  maxCandidatePoolTotal: number;  // Default: 200
  topKPerGeohashCell: number;     // Default: 10
  pruneGeohashPrecision: number;  // Constant: 6 (~1.2km cells)
}

export const DEFAULT_PRUNER_CONFIG: PrunerConfig = {
  maxCandidatesPerDay: 30,
  maxCandidatePoolTotal: 200,
  topKPerGeohashCell: 10,
  pruneGeohashPrecision: 6,
};

// =============================================================================
// PRUNER RESULT
// =============================================================================

export interface PrunerResult {
  prunedCandidates: EnrichedCandidateCanonical[];
  droppedCount: number;
  droppedByCategory: Record<string, number>;
  droppedByGeohash: Record<string, number>;
  droppedTopExamples: Array<{
    id: CanonicalPlaceId;
    name: string;
    reasonCode: DropReasonCode;
  }>;
}

// =============================================================================
// PRUNER IMPLEMENTATION
// =============================================================================

/**
 * Prune candidates while preserving anchors, mustInclude, and geographic diversity.
 *
 * @param candidates - All canonical candidates from registry
 * @param numDays - Number of trip days (affects pool size)
 * @param anchors - Set of canonical IDs that must be kept (anchors)
 * @param mustInclude - Set of canonical IDs that must be kept (user must-sees)
 * @param config - Pruner configuration
 * @param trace - Optional PlanTrace builder for logging
 */
export function pruneCandidates(
  candidates: EnrichedCandidateCanonical[],
  numDays: number,
  anchors: Set<CanonicalPlaceId>,
  mustInclude: Set<CanonicalPlaceId>,
  config: PrunerConfig = DEFAULT_PRUNER_CONFIG,
  trace?: PlanTraceBuilder
): PrunerResult {
  const droppedByCategory: Record<string, number> = {};
  const droppedByGeohash: Record<string, number> = {};
  const droppedTopExamples: PrunerResult['droppedTopExamples'] = [];

  // Separate protected candidates from prunable ones
  const protectedIds = new Set([...anchors, ...mustInclude]);
  const protectedCandidates: EnrichedCandidateCanonical[] = [];
  const prunableCandidates: EnrichedCandidateCanonical[] = [];

  for (const c of candidates) {
    if (protectedIds.has(c.canonicalId)) {
      protectedCandidates.push(c);
    } else {
      prunableCandidates.push(c);
    }
  }

  // Group prunable candidates by geohash6 + category
  const groups = groupByGeohashAndCategory(prunableCandidates, config.pruneGeohashPrecision);

  // Keep top-K by utility per group
  const keptFromGroups: EnrichedCandidateCanonical[] = [];
  const droppedFromGroups: EnrichedCandidateCanonical[] = [];

  for (const [groupKey, groupCandidates] of groups.entries()) {
    // Sort by utility score descending
    const sorted = [...groupCandidates].sort((a, b) => b.utilityScore - a.utilityScore);

    // Keep top K
    const kept = sorted.slice(0, config.topKPerGeohashCell);
    const dropped = sorted.slice(config.topKPerGeohashCell);

    keptFromGroups.push(...kept);
    droppedFromGroups.push(...dropped);

    // Track dropped by geohash
    if (dropped.length > 0) {
      const [geohash] = groupKey.split('|');
      droppedByGeohash[geohash] = (droppedByGeohash[geohash] || 0) + dropped.length;
    }
  }

  // Log dropped from geohash groups
  for (const c of droppedFromGroups) {
    droppedByCategory[c.category] = (droppedByCategory[c.category] || 0) + 1;
    if (droppedTopExamples.length < 10) {
      droppedTopExamples.push({
        id: c.canonicalId,
        name: c.name,
        reasonCode: DropReasonCode.PRUNER_GEOHASH_TOPK,
      });
    }
  }

  // Combine protected + kept from groups
  let combined = [...protectedCandidates, ...keptFromGroups];

  // Apply global cap if needed
  const maxPool = Math.min(
    config.maxCandidatePoolTotal,
    numDays * config.maxCandidatesPerDay
  );

  const droppedFromCap: EnrichedCandidateCanonical[] = [];
  if (combined.length > maxPool) {
    // Sort non-protected by utility and drop lowest
    const protectedSet = new Set(protectedCandidates.map(c => c.canonicalId));
    const nonProtected = combined.filter(c => !protectedSet.has(c.canonicalId));
    const protectedOnly = combined.filter(c => protectedSet.has(c.canonicalId));

    // Sort non-protected by utility descending
    nonProtected.sort((a, b) => b.utilityScore - a.utilityScore);

    // Keep as many as we can within cap
    const slotsForNonProtected = maxPool - protectedOnly.length;
    const keptNonProtected = nonProtected.slice(0, Math.max(0, slotsForNonProtected));
    const droppedNonProtected = nonProtected.slice(Math.max(0, slotsForNonProtected));

    droppedFromCap.push(...droppedNonProtected);
    combined = [...protectedOnly, ...keptNonProtected];
  }

  // Log dropped from cap
  for (const c of droppedFromCap) {
    droppedByCategory[c.category] = (droppedByCategory[c.category] || 0) + 1;
    if (droppedTopExamples.length < 10) {
      droppedTopExamples.push({
        id: c.canonicalId,
        name: c.name,
        reasonCode: DropReasonCode.PRUNER_CAP_EXCEEDED,
      });
    }
  }

  const totalDropped = droppedFromGroups.length + droppedFromCap.length;

  // Log to PlanTrace if provided
  if (trace) {
    trace.logPruning({
      droppedCount: totalDropped,
      droppedByCategory,
      droppedByGeohash,
      droppedTopExamples,
    });
  }

  console.log(`[Pruner] Pruned ${totalDropped} candidates`);
  console.log(`  → Protected: ${protectedCandidates.length} (anchors + mustInclude)`);
  console.log(`  → Kept from groups: ${keptFromGroups.length}`);
  console.log(`  → Dropped from geohash groups: ${droppedFromGroups.length}`);
  console.log(`  → Dropped from cap: ${droppedFromCap.length}`);
  console.log(`  → Final pool: ${combined.length}`);

  return {
    prunedCandidates: combined,
    droppedCount: totalDropped,
    droppedByCategory,
    droppedByGeohash,
    droppedTopExamples,
  };
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Group candidates by geohash + category.
 */
function groupByGeohashAndCategory(
  candidates: EnrichedCandidateCanonical[],
  precision: number
): Map<string, EnrichedCandidateCanonical[]> {
  const groups = new Map<string, EnrichedCandidateCanonical[]>();

  for (const c of candidates) {
    const geohash = c.geohash6 || encodeGeohash(c.location.lat, c.location.lng, precision);
    const groupKey = `${geohash}|${c.category}`;

    if (!groups.has(groupKey)) {
      groups.set(groupKey, []);
    }
    groups.get(groupKey)!.push(c);
  }

  return groups;
}

/**
 * Simple geohash encoder.
 */
function encodeGeohash(lat: number, lng: number, precision: number): string {
  const BASE32 = '0123456789bcdefghjkmnpqrstuvwxyz';
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

/**
 * Create pruner config from optimizer config.
 */
export function createPrunerConfig(
  optimizerConfig: OptimizerV3Config = DEFAULT_OPTIMIZER_V3_CONFIG
): PrunerConfig {
  return {
    maxCandidatesPerDay: optimizerConfig.maxCandidatesPerDay,
    maxCandidatePoolTotal: optimizerConfig.maxCandidatePoolTotal,
    topKPerGeohashCell: optimizerConfig.topKPerGeohashCell,
    pruneGeohashPrecision: 6, // Constant
  };
}
