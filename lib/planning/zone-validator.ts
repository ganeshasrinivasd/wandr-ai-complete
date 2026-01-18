/**
 * Zone Validator
 *
 * Validates zone quality and triggers fallback clustering.
 * Checks:
 * - Zone diameter (max pairwise haversine distance)
 * - POI count balance between zones
 * - Planned minutes balance between zones
 */

import {
  ZoneV3,
  ZoneValidationResult,
  EnrichedCandidateCanonical,
  CanonicalPlaceId,
} from '../types/optimizer-v3';
import { OptimizerV3Config, DEFAULT_OPTIMIZER_V3_CONFIG } from '../config/optimizer-config';

// =============================================================================
// ZONE VALIDATION
// =============================================================================

/**
 * Validate zones against quality thresholds.
 *
 * Checks:
 * 1. Zone diameter <= maxDayDiameterKm
 * 2. POI count ratio <= maxZoneToMinZonePoiRatio
 * 3. Planned minutes ratio <= maxZoneMinutesToMinZoneMinutesRatio
 */
export function validateZones(
  zones: ZoneV3[],
  config: OptimizerV3Config = DEFAULT_OPTIMIZER_V3_CONFIG
): ZoneValidationResult {
  const violations: ZoneValidationResult['violations'] = [];
  const zoneDiameters = new Map<number, number>();
  const zoneLoads = new Map<number, { poiCount: number; plannedMinutes: number }>();

  // Skip validation for empty or single zone
  if (zones.length === 0) {
    return {
      isValid: true,
      violations: [],
      zoneDiameters,
      zoneLoads,
    };
  }

  // Compute diameter and load for each zone
  for (const zone of zones) {
    const diameter = computeZoneDiameter(zone);
    zoneDiameters.set(zone.id, diameter);

    const plannedMinutes = zone.candidates.reduce(
      (sum, c) => sum + c.durationMinutes,
      0
    );
    zoneLoads.set(zone.id, {
      poiCount: zone.candidates.length,
      plannedMinutes,
    });

    // Check diameter
    if (diameter > config.maxDayDiameterKm) {
      violations.push({
        zoneId: zone.id,
        type: 'diameter_exceeded',
        value: diameter,
        threshold: config.maxDayDiameterKm,
      });
    }
  }

  // Check POI count balance
  if (zones.length > 1) {
    const poiCounts = zones.map(z => z.candidates.length);
    const minPoi = Math.min(...poiCounts);
    const maxPoi = Math.max(...poiCounts);

    if (minPoi > 0) {
      const poiRatio = maxPoi / minPoi;
      if (poiRatio > config.maxZoneToMinZonePoiRatio) {
        // Find the zone with max POIs
        const maxZone = zones.find(z => z.candidates.length === maxPoi);
        if (maxZone) {
          violations.push({
            zoneId: maxZone.id,
            type: 'poi_imbalance',
            value: poiRatio,
            threshold: config.maxZoneToMinZonePoiRatio,
          });
        }
      }
    }

    // Check minutes balance
    const minutesCounts = Array.from(zoneLoads.values()).map(l => l.plannedMinutes);
    const minMinutes = Math.min(...minutesCounts);
    const maxMinutes = Math.max(...minutesCounts);

    if (minMinutes > 0) {
      const minutesRatio = maxMinutes / minMinutes;
      if (minutesRatio > config.maxZoneMinutesToMinZoneMinutesRatio) {
        // Find the zone with max minutes
        let maxZoneId = 0;
        let maxZoneMinutes = 0;
        for (const [zoneId, load] of zoneLoads.entries()) {
          if (load.plannedMinutes > maxZoneMinutes) {
            maxZoneMinutes = load.plannedMinutes;
            maxZoneId = zoneId;
          }
        }
        violations.push({
          zoneId: maxZoneId,
          type: 'minutes_imbalance',
          value: minutesRatio,
          threshold: config.maxZoneMinutesToMinZoneMinutesRatio,
        });
      }
    }
  }

  return {
    isValid: violations.length === 0,
    violations,
    zoneDiameters,
    zoneLoads,
  };
}

// =============================================================================
// ZONE DIAMETER COMPUTATION
// =============================================================================

/**
 * Compute zone diameter as max pairwise haversine distance.
 */
export function computeZoneDiameter(zone: ZoneV3): number {
  const candidates = zone.candidates;
  if (candidates.length <= 1) return 0;

  let maxDistance = 0;

  for (let i = 0; i < candidates.length; i++) {
    for (let j = i + 1; j < candidates.length; j++) {
      const dist = haversineDistance(
        candidates[i].location.lat,
        candidates[i].location.lng,
        candidates[j].location.lat,
        candidates[j].location.lng
      );
      if (dist > maxDistance) {
        maxDistance = dist;
      }
    }
  }

  return maxDistance;
}

/**
 * Haversine distance between two points in km.
 */
export function haversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371; // Earth's radius in km
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}

// =============================================================================
// ZONE REBALANCING
// =============================================================================

/**
 * Rebalance zones by moving lowest-value POIs from overloaded zones.
 * Pinned candidates (anchors + big rocks) cannot be moved.
 *
 * @param zones - Zones to rebalance
 * @param pinnedIds - Set of canonical IDs that cannot be moved
 * @param config - Optimizer config
 */
export function rebalanceZones(
  zones: ZoneV3[],
  pinnedIds: Set<CanonicalPlaceId>,
  config: OptimizerV3Config = DEFAULT_OPTIMIZER_V3_CONFIG
): ZoneV3[] {
  if (zones.length <= 1) return zones;

  // Create mutable copies
  const rebalanced = zones.map(z => ({
    ...z,
    candidates: [...z.candidates],
  }));

  // Compute target POI count per zone
  const totalPois = rebalanced.reduce((sum, z) => sum + z.candidates.length, 0);
  const targetPerZone = Math.ceil(totalPois / rebalanced.length);

  // Find overloaded and underloaded zones
  const overloaded = rebalanced.filter(z => z.candidates.length > targetPerZone * 1.3);
  const underloaded = rebalanced.filter(z => z.candidates.length < targetPerZone * 0.7);

  if (overloaded.length === 0 || underloaded.length === 0) {
    return rebalanced;
  }

  // Move lowest-utility non-pinned POIs from overloaded to nearest underloaded
  for (const srcZone of overloaded) {
    // Get movable candidates (not pinned)
    const movable = srcZone.candidates
      .filter(c => !pinnedIds.has(c.canonicalId))
      .sort((a, b) => a.utilityScore - b.utilityScore); // Lowest utility first

    // How many to move
    const excess = srcZone.candidates.length - targetPerZone;
    const toMove = movable.slice(0, Math.min(excess, movable.length));

    for (const candidate of toMove) {
      // Find nearest underloaded zone
      const destZone = findNearestUnderloadedZone(
        candidate,
        underloaded,
        targetPerZone
      );

      if (destZone) {
        // Remove from source
        srcZone.candidates = srcZone.candidates.filter(
          c => c.canonicalId !== candidate.canonicalId
        );

        // Add to destination
        destZone.candidates.push(candidate);

        console.log(
          `[Rebalance] Moved "${candidate.name}" from zone ${srcZone.id} to zone ${destZone.id}`
        );
      }
    }
  }

  // Recompute zone properties
  for (const zone of rebalanced) {
    zone.totalUtility = zone.candidates.reduce((sum, c) => sum + c.utilityScore, 0);
    zone.hasBigRock = zone.candidates.some(c => c.isBigRock);
    zone.bigRocks = zone.candidates.filter(c => c.isBigRock);
    zone.centroid = computeCentroid(zone.candidates);
  }

  return rebalanced;
}

/**
 * Find nearest underloaded zone for a candidate.
 */
function findNearestUnderloadedZone(
  candidate: EnrichedCandidateCanonical,
  underloaded: ZoneV3[],
  targetPerZone: number
): ZoneV3 | null {
  let nearest: ZoneV3 | null = null;
  let minDist = Infinity;

  for (const zone of underloaded) {
    // Skip if zone is now at capacity
    if (zone.candidates.length >= targetPerZone) continue;

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

// =============================================================================
// ZONE SPLITTING
// =============================================================================

/**
 * Split a zone that exceeds diameter threshold.
 * Uses simple bisection based on centroid distance.
 */
export function splitZone(
  zone: ZoneV3,
  nextZoneId: number
): [ZoneV3, ZoneV3] {
  const candidates = zone.candidates;
  if (candidates.length <= 2) {
    // Can't split meaningfully
    return [zone, { ...zone, id: nextZoneId, candidates: [] }];
  }

  // Find the two candidates furthest apart
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
  const zone1Candidates: EnrichedCandidateCanonical[] = [];
  const zone2Candidates: EnrichedCandidateCanonical[] = [];

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
      zone1Candidates.push(c);
    } else {
      zone2Candidates.push(c);
    }
  }

  const zone1: ZoneV3 = {
    id: zone.id,
    centroid: computeCentroid(zone1Candidates),
    candidates: zone1Candidates,
    totalUtility: zone1Candidates.reduce((sum, c) => sum + c.utilityScore, 0),
    hasBigRock: zone1Candidates.some(c => c.isBigRock),
    bigRocks: zone1Candidates.filter(c => c.isBigRock),
    name: zone.name ? `${zone.name} (A)` : undefined,
  };

  const zone2: ZoneV3 = {
    id: nextZoneId,
    centroid: computeCentroid(zone2Candidates),
    candidates: zone2Candidates,
    totalUtility: zone2Candidates.reduce((sum, c) => sum + c.utilityScore, 0),
    hasBigRock: zone2Candidates.some(c => c.isBigRock),
    bigRocks: zone2Candidates.filter(c => c.isBigRock),
    name: zone.name ? `${zone.name} (B)` : undefined,
  };

  return [zone1, zone2];
}
