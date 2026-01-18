/**
 * Travel Cache
 *
 * Two-tier travel time estimation with caching:
 * - Tier 1: Cheap heuristic for early-stage routing
 * - Tier 2: Real API calls for final validation
 *
 * Cache key format: (origin_geohash_7, dest_geohash_7, mode, timeBucket)
 */

import {
  TravelValidationExceptionCode,
  DayTimelineV3,
  CanonicalPlaceId,
} from '../types/optimizer-v3';
import { OptimizerV3Config, DEFAULT_OPTIMIZER_V3_CONFIG } from '../config/optimizer-config';
import { getFeatureFlags } from '../config/feature-flags';
import { PlanTraceBuilder } from '../observability/plan-trace';
import { haversineDistance } from './zone-validator';

// =============================================================================
// CACHE TYPES
// =============================================================================

export interface TravelCacheKey {
  originGeohash7: string;
  destGeohash7: string;
  mode: 'driving' | 'walking' | 'transit';
  timeBucket: number; // 0=morning, 1=afternoon, 2=evening
}

export interface TravelCacheEntry {
  estimatedMinutes: number;
  realMinutes?: number;
  source: 'heuristic' | 'api';
  timestamp: number;
}

export interface LegValidationResult {
  legsValidated: number;
  legsRequested: number;
  exception?: TravelValidationExceptionCode;
}

export interface TravelLeg {
  fromCanonicalId: CanonicalPlaceId;
  toCanonicalId: CanonicalPlaceId;
  fromLocation: { lat: number; lng: number };
  toLocation: { lat: number; lng: number };
  estimatedMinutes: number;
}

// =============================================================================
// TRAVEL CACHE CLASS
// =============================================================================

export class TravelCache {
  private cache: Map<string, TravelCacheEntry> = new Map();
  private timeBucketMinutes: number;
  private defaultMode: 'driving' | 'walking' | 'transit';

  constructor(config: OptimizerV3Config = DEFAULT_OPTIMIZER_V3_CONFIG) {
    this.timeBucketMinutes = config.timeBucketMinutes;
    this.defaultMode = config.defaultTravelMode;
  }

  /**
   * Get heuristic travel time estimate (cheap, no API call).
   * Uses haversine distance with mode-specific speed assumptions.
   */
  getHeuristic(
    origin: { lat: number; lng: number },
    dest: { lat: number; lng: number },
    mode?: 'driving' | 'walking' | 'transit'
  ): number {
    const travelMode = mode || this.defaultMode;
    const distanceKm = haversineDistance(origin.lat, origin.lng, dest.lat, dest.lng);

    // Speed assumptions (km/h) with urban traffic factor
    const speeds: Record<string, number> = {
      driving: 25,   // Urban driving with traffic
      walking: 4.5,  // Average walking speed
      transit: 20,   // Public transit with stops
    };

    const speedKmH = speeds[travelMode] || 25;
    const travelMinutes = (distanceKm / speedKmH) * 60;

    // Add buffer for parking, walking to/from, etc.
    const bufferMinutes = travelMode === 'driving' ? 10 : 5;

    return Math.ceil(travelMinutes + bufferMinutes);
  }

  /**
   * Get real travel time from API (expensive, cached).
   * Falls back to heuristic if API fails.
   */
  async getReal(
    origin: { lat: number; lng: number },
    dest: { lat: number; lng: number },
    mode?: 'driving' | 'walking' | 'transit',
    timeOfDay?: number
  ): Promise<number> {
    const travelMode = mode || this.defaultMode;
    const timeBucket = this.computeTimeBucket(timeOfDay || 600); // Default to 10 AM
    const cacheKey = this.buildCacheKey(origin, dest, travelMode, timeBucket);
    const keyString = this.cacheKeyToString(cacheKey);

    // Check cache first
    const cached = this.cache.get(keyString);
    if (cached && cached.realMinutes !== undefined) {
      return cached.realMinutes;
    }

    // Try API call
    try {
      const realMinutes = await this.fetchRealTravelTime(origin, dest, travelMode);

      // Update cache
      const entry: TravelCacheEntry = {
        estimatedMinutes: this.getHeuristic(origin, dest, travelMode),
        realMinutes,
        source: 'api',
        timestamp: Date.now(),
      };
      this.cache.set(keyString, entry);

      return realMinutes;
    } catch (error) {
      console.warn('[TravelCache] API call failed, using heuristic:', error);
      return this.getHeuristic(origin, dest, travelMode);
    }
  }

  /**
   * Get cached entry if available.
   */
  getCached(key: TravelCacheKey): TravelCacheEntry | undefined {
    return this.cache.get(this.cacheKeyToString(key));
  }

  /**
   * Compute time bucket from time of day (minutes from midnight).
   */
  computeTimeBucket(timeOfDay: number): number {
    // 0 = morning (6-12), 1 = afternoon (12-18), 2 = evening (18-24/0-6)
    if (timeOfDay >= 360 && timeOfDay < 720) return 0;  // 6 AM - 12 PM
    if (timeOfDay >= 720 && timeOfDay < 1080) return 1; // 12 PM - 6 PM
    return 2; // 6 PM - 6 AM
  }

  /**
   * Build cache key from parameters.
   */
  buildCacheKey(
    origin: { lat: number; lng: number },
    dest: { lat: number; lng: number },
    mode: 'driving' | 'walking' | 'transit',
    timeBucket: number
  ): TravelCacheKey {
    return {
      originGeohash7: encodeGeohash(origin.lat, origin.lng, 7),
      destGeohash7: encodeGeohash(dest.lat, dest.lng, 7),
      mode,
      timeBucket,
    };
  }

  /**
   * Convert cache key to string for Map storage.
   */
  private cacheKeyToString(key: TravelCacheKey): string {
    return `${key.originGeohash7}|${key.destGeohash7}|${key.mode}|${key.timeBucket}`;
  }

  /**
   * Fetch real travel time from Google Maps API.
   */
  private async fetchRealTravelTime(
    origin: { lat: number; lng: number },
    dest: { lat: number; lng: number },
    mode: 'driving' | 'walking' | 'transit'
  ): Promise<number> {
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      throw new Error('GOOGLE_MAPS_API_KEY not configured');
    }

    const url = new URL('https://maps.googleapis.com/maps/api/distancematrix/json');
    url.searchParams.set('origins', `${origin.lat},${origin.lng}`);
    url.searchParams.set('destinations', `${dest.lat},${dest.lng}`);
    url.searchParams.set('mode', mode);
    url.searchParams.set('key', apiKey);

    const response = await fetch(url.toString());
    const data = await response.json();

    if (data.status !== 'OK' || !data.rows?.[0]?.elements?.[0]) {
      throw new Error(`Distance Matrix API error: ${data.status}`);
    }

    const element = data.rows[0].elements[0];
    if (element.status !== 'OK') {
      throw new Error(`Route not found: ${element.status}`);
    }

    // Duration is in seconds
    return Math.ceil(element.duration.value / 60);
  }

  /**
   * Clear cache (for testing).
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get cache size (for monitoring).
   */
  size(): number {
    return this.cache.size;
  }
}

// =============================================================================
// LEG VALIDATION
// =============================================================================

/**
 * Select top N legs for validation (those with largest estimated travel time).
 */
export function selectTopLegsForValidation(
  timeline: DayTimelineV3,
  n: number
): TravelLeg[] {
  const legs: TravelLeg[] = [];

  // Extract legs from timeline slots
  for (let i = 1; i < timeline.slots.length; i++) {
    const prevSlot = timeline.slots[i - 1];
    const currSlot = timeline.slots[i];

    // Only consider activity-to-activity legs
    if (prevSlot.type !== 'activity' || currSlot.type !== 'activity') continue;
    if (!prevSlot.candidate || !currSlot.candidate) continue;

    legs.push({
      fromCanonicalId: prevSlot.candidate.canonicalId,
      toCanonicalId: currSlot.candidate.canonicalId,
      fromLocation: prevSlot.candidate.location,
      toLocation: currSlot.candidate.location,
      estimatedMinutes: currSlot.travelFromPrevious || 0,
    });
  }

  // Sort by estimated travel time descending and take top N
  return legs
    .sort((a, b) => b.estimatedMinutes - a.estimatedMinutes)
    .slice(0, n);
}

/**
 * Validate top N legs with real travel times.
 */
export async function validateTopLegs(
  timeline: DayTimelineV3,
  n: number,
  cache: TravelCache,
  config: OptimizerV3Config = DEFAULT_OPTIMIZER_V3_CONFIG,
  trace?: PlanTraceBuilder
): Promise<LegValidationResult> {
  const featureFlags = getFeatureFlags();

  // Check if validation is enabled
  if (!featureFlags.ENABLE_REAL_TRAVEL_VALIDATION) {
    trace?.logTravelValidationException(TravelValidationExceptionCode.VALIDATION_DISABLED);
    return {
      legsValidated: 0,
      legsRequested: n,
      exception: TravelValidationExceptionCode.VALIDATION_DISABLED,
    };
  }

  const legs = selectTopLegsForValidation(timeline, n);

  if (legs.length === 0) {
    trace?.logTravelValidationException(TravelValidationExceptionCode.NOT_ENOUGH_LEGS);
    return {
      legsValidated: 0,
      legsRequested: n,
      exception: TravelValidationExceptionCode.NOT_ENOUGH_LEGS,
    };
  }

  let validated = 0;

  for (const leg of legs) {
    try {
      const realMinutes = await cache.getReal(
        leg.fromLocation,
        leg.toLocation,
        config.defaultTravelMode
      );

      // Log delta to trace
      if (trace) {
        trace.logTravelDelta(
          timeline.dayIndex,
          leg.fromCanonicalId,
          leg.toCanonicalId,
          leg.estimatedMinutes,
          realMinutes
        );
      }

      validated++;
    } catch (error) {
      console.warn(`[TravelCache] Failed to validate leg: ${error}`);
      // Continue with other legs
    }
  }

  return {
    legsValidated: validated,
    legsRequested: n,
  };
}

/**
 * Fill travel times for all legs in a timeline using heuristic.
 */
export function fillHeuristicTravelTimes(
  timeline: DayTimelineV3,
  cache: TravelCache
): DayTimelineV3 {
  const updatedSlots = [...timeline.slots];

  for (let i = 1; i < updatedSlots.length; i++) {
    const prevSlot = updatedSlots[i - 1];
    const currSlot = updatedSlots[i];

    // Only fill for activity slots
    if (currSlot.type !== 'activity' || !currSlot.candidate) continue;

    // Find previous activity slot
    let prevActivity = null;
    for (let j = i - 1; j >= 0; j--) {
      if (updatedSlots[j].type === 'activity' && updatedSlots[j].candidate) {
        prevActivity = updatedSlots[j];
        break;
      }
    }

    if (prevActivity && prevActivity.candidate) {
      const travelTime = cache.getHeuristic(
        prevActivity.candidate.location,
        currSlot.candidate.location
      );
      updatedSlots[i] = { ...currSlot, travelFromPrevious: travelTime };
    }
  }

  return { ...timeline, slots: updatedSlots };
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

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
 * Create a travel cache instance.
 */
export function createTravelCache(
  config: OptimizerV3Config = DEFAULT_OPTIMIZER_V3_CONFIG
): TravelCache {
  return new TravelCache(config);
}
