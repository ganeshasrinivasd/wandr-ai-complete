/**
 * Global Ledger for Cross-Role Deduplication
 *
 * Tracks POI usage across the entire itinerary to prevent:
 * 1. Exact duplicates (same place_id)
 * 2. Near-duplicates (same dedupKey)
 * 3. Area over-usage (markets/bazaars appearing too often)
 * 4. Cross-role duplicates (same place as attraction AND meal)
 */

import { EnrichedCandidate } from './types';

// =============================================================================
// AREA PATTERNS (for markets, bazaars, neighborhoods)
// =============================================================================

const AREA_NAME_PATTERNS = [
  'market', 'bazaar', 'bazar', 'chowk', 'gali', 'street',
  'lane', 'mall', 'center', 'centre', 'complex', 'junction',
];

const AREA_TYPE_PATTERNS = [
  'market', 'shopping_mall', 'shopping_center', 'street_address',
];

// =============================================================================
// GLOBAL LEDGER CLASS
// =============================================================================

export type UsageRole = 'attraction' | 'meal' | 'accommodation' | 'transport';

export interface UsageRecord {
  placeId: string;
  dedupKey: string;
  name: string;
  normalizedName: string;
  role: UsageRole;
  dayIndex: number;
  slotIndex?: number;
  timestamp: number;
}

export interface AreaUsageRecord {
  areaKey: string;
  displayName: string;
  count: number;
  days: number[];
  roles: UsageRole[];
}

export interface LedgerStats {
  totalUsed: number;
  byRole: Record<UsageRole, number>;
  areaCount: number;
  duplicatesBlocked: number;
  nearDuplicatesBlocked: number;
}

/**
 * Global Ledger for tracking POI usage across the entire itinerary
 */
export class GlobalLedger {
  private usedPlaceIds = new Set<string>();
  private usedDedupKeys = new Set<string>();
  private usedNormalizedNames = new Set<string>();
  private usageRecords: UsageRecord[] = [];
  private areaUsage = new Map<string, AreaUsageRecord>();

  // Configurable limits
  private maxAreaUsagePerTrip: number;
  private maxAreaUsagePerDay: number;
  private allowCrossRoleDuplicates: boolean;

  // Stats tracking
  private duplicatesBlocked = 0;
  private nearDuplicatesBlocked = 0;

  constructor(options: {
    maxAreaUsagePerTrip?: number;
    maxAreaUsagePerDay?: number;
    allowCrossRoleDuplicates?: boolean;
  } = {}) {
    this.maxAreaUsagePerTrip = options.maxAreaUsagePerTrip ?? 1;
    this.maxAreaUsagePerDay = options.maxAreaUsagePerDay ?? 1;
    this.allowCrossRoleDuplicates = options.allowCrossRoleDuplicates ?? false;
  }

  // ===========================================================================
  // CORE USAGE CHECKING
  // ===========================================================================

  /**
   * Check if a candidate can be used (not already in ledger)
   */
  canUse(
    candidate: EnrichedCandidate,
    role: UsageRole,
    dayIndex: number
  ): { allowed: boolean; reason?: string } {
    // Check 1: Exact place_id duplicate
    if (candidate.placeId && this.usedPlaceIds.has(candidate.placeId)) {
      this.duplicatesBlocked++;
      return {
        allowed: false,
        reason: `Duplicate place_id: ${candidate.placeId} already used`,
      };
    }

    // Check 2: DedupKey duplicate
    if (candidate.dedupKey && this.usedDedupKeys.has(candidate.dedupKey)) {
      this.duplicatesBlocked++;
      return {
        allowed: false,
        reason: `Duplicate dedupKey: ${candidate.dedupKey} already used`,
      };
    }

    // Check 3: Normalized name duplicate (catches near-duplicates)
    const normalizedName = this.normalizeNameForLedger(candidate.name);
    if (this.usedNormalizedNames.has(normalizedName)) {
      // Allow if cross-role duplicates are allowed (e.g., user wants same restaurant twice)
      if (!this.allowCrossRoleDuplicates) {
        this.nearDuplicatesBlocked++;
        return {
          allowed: false,
          reason: `Near-duplicate name: "${candidate.name}" too similar to existing entry`,
        };
      }
    }

    // Check 4: Area usage limits (for markets, bazaars, etc.)
    if (this.isAreaType(candidate)) {
      const areaKey = this.getAreaKey(candidate);
      const areaRecord = this.areaUsage.get(areaKey);

      if (areaRecord) {
        // Check trip-level limit
        if (areaRecord.count >= this.maxAreaUsagePerTrip) {
          return {
            allowed: false,
            reason: `Area "${areaRecord.displayName}" already used ${areaRecord.count} time(s) in trip`,
          };
        }

        // Check day-level limit
        const usageOnDay = areaRecord.days.filter(d => d === dayIndex).length;
        if (usageOnDay >= this.maxAreaUsagePerDay) {
          return {
            allowed: false,
            reason: `Area "${areaRecord.displayName}" already used on day ${dayIndex + 1}`,
          };
        }
      }
    }

    return { allowed: true };
  }

  /**
   * Mark a candidate as used
   */
  markUsed(
    candidate: EnrichedCandidate,
    role: UsageRole,
    dayIndex: number,
    slotIndex?: number
  ): void {
    // Add to ID sets
    if (candidate.placeId) {
      this.usedPlaceIds.add(candidate.placeId);
    }
    if (candidate.dedupKey) {
      this.usedDedupKeys.add(candidate.dedupKey);
    }

    const normalizedName = this.normalizeNameForLedger(candidate.name);
    this.usedNormalizedNames.add(normalizedName);

    // Create usage record
    const record: UsageRecord = {
      placeId: candidate.placeId || '',
      dedupKey: candidate.dedupKey || '',
      name: candidate.name,
      normalizedName,
      role,
      dayIndex,
      slotIndex,
      timestamp: Date.now(),
    };
    this.usageRecords.push(record);

    // Track area usage
    if (this.isAreaType(candidate)) {
      const areaKey = this.getAreaKey(candidate);
      const existing = this.areaUsage.get(areaKey);

      if (existing) {
        existing.count++;
        existing.days.push(dayIndex);
        if (!existing.roles.includes(role)) {
          existing.roles.push(role);
        }
      } else {
        this.areaUsage.set(areaKey, {
          areaKey,
          displayName: candidate.name,
          count: 1,
          days: [dayIndex],
          roles: [role],
        });
      }
    }
  }

  /**
   * Remove a candidate from the ledger (for repair/swap operations)
   */
  unmark(candidate: EnrichedCandidate, dayIndex: number): void {
    if (candidate.placeId) {
      this.usedPlaceIds.delete(candidate.placeId);
    }
    if (candidate.dedupKey) {
      this.usedDedupKeys.delete(candidate.dedupKey);
    }

    const normalizedName = this.normalizeNameForLedger(candidate.name);
    this.usedNormalizedNames.delete(normalizedName);

    // Remove from records
    this.usageRecords = this.usageRecords.filter(
      r => !(r.placeId === candidate.placeId && r.dayIndex === dayIndex)
    );

    // Update area usage
    if (this.isAreaType(candidate)) {
      const areaKey = this.getAreaKey(candidate);
      const existing = this.areaUsage.get(areaKey);

      if (existing) {
        existing.count--;
        const dayIdx = existing.days.indexOf(dayIndex);
        if (dayIdx >= 0) {
          existing.days.splice(dayIdx, 1);
        }

        if (existing.count <= 0) {
          this.areaUsage.delete(areaKey);
        }
      }
    }
  }

  // ===========================================================================
  // BATCH OPERATIONS
  // ===========================================================================

  /**
   * Check multiple candidates and return which ones are allowed
   */
  filterAllowed(
    candidates: EnrichedCandidate[],
    role: UsageRole,
    dayIndex: number
  ): EnrichedCandidate[] {
    return candidates.filter(c => this.canUse(c, role, dayIndex).allowed);
  }

  /**
   * Pre-register candidates without fully marking them
   * Useful for planning phases where final selection hasn't happened
   */
  reserve(
    candidates: EnrichedCandidate[],
    role: UsageRole,
    dayIndex: number
  ): Set<string> {
    const reserved = new Set<string>();

    for (const candidate of candidates) {
      if (this.canUse(candidate, role, dayIndex).allowed) {
        if (candidate.placeId) {
          this.usedPlaceIds.add(candidate.placeId);
          reserved.add(candidate.placeId);
        }
      }
    }

    return reserved;
  }

  /**
   * Release reserved candidates
   */
  releaseReservation(placeIds: Set<string>): void {
    for (const id of placeIds) {
      this.usedPlaceIds.delete(id);
    }
  }

  // ===========================================================================
  // QUERY METHODS
  // ===========================================================================

  /**
   * Get all usage records for a specific day
   */
  getUsageForDay(dayIndex: number): UsageRecord[] {
    return this.usageRecords.filter(r => r.dayIndex === dayIndex);
  }

  /**
   * Get all usage records for a specific role
   */
  getUsageByRole(role: UsageRole): UsageRecord[] {
    return this.usageRecords.filter(r => r.role === role);
  }

  /**
   * Check if a specific place_id is used
   */
  isPlaceIdUsed(placeId: string): boolean {
    return this.usedPlaceIds.has(placeId);
  }

  /**
   * Check if a specific dedupKey is used
   */
  isDedupKeyUsed(dedupKey: string): boolean {
    return this.usedDedupKeys.has(dedupKey);
  }

  /**
   * Get area usage statistics
   */
  getAreaUsage(): Map<string, AreaUsageRecord> {
    return new Map(this.areaUsage);
  }

  /**
   * Get ledger statistics
   */
  getStats(): LedgerStats {
    const byRole: Record<UsageRole, number> = {
      attraction: 0,
      meal: 0,
      accommodation: 0,
      transport: 0,
    };

    for (const record of this.usageRecords) {
      byRole[record.role]++;
    }

    return {
      totalUsed: this.usageRecords.length,
      byRole,
      areaCount: this.areaUsage.size,
      duplicatesBlocked: this.duplicatesBlocked,
      nearDuplicatesBlocked: this.nearDuplicatesBlocked,
    };
  }

  // ===========================================================================
  // VALIDATION
  // ===========================================================================

  /**
   * Validate that no duplicates exist in the ledger
   * Returns list of violations if any found
   */
  validateNoDuplicates(): { valid: boolean; violations: string[] } {
    const violations: string[] = [];

    // Check for place_id duplicates in records
    const placeIdCounts = new Map<string, number>();
    for (const record of this.usageRecords) {
      if (record.placeId) {
        const count = (placeIdCounts.get(record.placeId) || 0) + 1;
        placeIdCounts.set(record.placeId, count);
      }
    }

    for (const [placeId, count] of placeIdCounts) {
      if (count > 1) {
        const records = this.usageRecords.filter(r => r.placeId === placeId);
        const details = records.map(r => `Day ${r.dayIndex + 1} (${r.role})`).join(', ');
        violations.push(`Duplicate place_id ${placeId}: ${details}`);
      }
    }

    // Check for dedupKey duplicates
    const dedupKeyCounts = new Map<string, number>();
    for (const record of this.usageRecords) {
      if (record.dedupKey) {
        const count = (dedupKeyCounts.get(record.dedupKey) || 0) + 1;
        dedupKeyCounts.set(record.dedupKey, count);
      }
    }

    for (const [dedupKey, count] of dedupKeyCounts) {
      if (count > 1) {
        const records = this.usageRecords.filter(r => r.dedupKey === dedupKey);
        const details = records.map(r => `"${r.name}" on Day ${r.dayIndex + 1}`).join(', ');
        violations.push(`Duplicate dedupKey ${dedupKey}: ${details}`);
      }
    }

    return {
      valid: violations.length === 0,
      violations,
    };
  }

  /**
   * Get a report of all cross-role usages (same place as attraction AND meal)
   */
  findCrossRoleUsages(): Array<{
    placeId: string;
    name: string;
    roles: UsageRole[];
    days: number[];
  }> {
    const byPlaceId = new Map<string, UsageRecord[]>();

    for (const record of this.usageRecords) {
      if (record.placeId) {
        const existing = byPlaceId.get(record.placeId) || [];
        existing.push(record);
        byPlaceId.set(record.placeId, existing);
      }
    }

    const crossRoleUsages: Array<{
      placeId: string;
      name: string;
      roles: UsageRole[];
      days: number[];
    }> = [];

    for (const [placeId, records] of byPlaceId) {
      const roles = [...new Set(records.map(r => r.role))];
      if (roles.length > 1) {
        crossRoleUsages.push({
          placeId,
          name: records[0].name,
          roles,
          days: [...new Set(records.map(r => r.dayIndex))],
        });
      }
    }

    return crossRoleUsages;
  }

  // ===========================================================================
  // HELPER METHODS
  // ===========================================================================

  /**
   * Normalize name for ledger comparison
   */
  private normalizeNameForLedger(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, ' ')
      .replace(/\b(the|a|an|of|in|at|on)\b/g, '')
      .trim();
  }

  /**
   * Check if candidate is an "area" type (market, bazaar, etc.)
   */
  private isAreaType(candidate: EnrichedCandidate): boolean {
    const nameLower = candidate.name.toLowerCase();

    // Check name patterns
    if (AREA_NAME_PATTERNS.some(p => nameLower.includes(p))) {
      return true;
    }

    // Check type patterns
    if (candidate.googleTypes) {
      if (candidate.googleTypes.some(t => AREA_TYPE_PATTERNS.includes(t))) {
        return true;
      }
    }

    return false;
  }

  /**
   * Get area key for grouping similar areas
   */
  private getAreaKey(candidate: EnrichedCandidate): string {
    // Use normalized name + truncated location for area key
    const normalizedName = this.normalizeNameForLedger(candidate.name);

    // Remove common suffixes for grouping
    const cleanedName = normalizedName
      .replace(/\s*(market|bazaar|bazar|chowk|gali|street|lane)\s*/g, '')
      .trim();

    return cleanedName || normalizedName;
  }

  // ===========================================================================
  // SERIALIZATION
  // ===========================================================================

  /**
   * Export ledger state for debugging or persistence
   */
  export(): {
    usedPlaceIds: string[];
    usedDedupKeys: string[];
    usageRecords: UsageRecord[];
    areaUsage: Array<[string, AreaUsageRecord]>;
    stats: LedgerStats;
  } {
    return {
      usedPlaceIds: Array.from(this.usedPlaceIds),
      usedDedupKeys: Array.from(this.usedDedupKeys),
      usageRecords: this.usageRecords,
      areaUsage: Array.from(this.areaUsage.entries()),
      stats: this.getStats(),
    };
  }

  /**
   * Clear all ledger state
   */
  clear(): void {
    this.usedPlaceIds.clear();
    this.usedDedupKeys.clear();
    this.usedNormalizedNames.clear();
    this.usageRecords = [];
    this.areaUsage.clear();
    this.duplicatesBlocked = 0;
    this.nearDuplicatesBlocked = 0;
  }
}

// =============================================================================
// FACTORY FUNCTION
// =============================================================================

/**
 * Create a new GlobalLedger with default settings
 */
export function createGlobalLedger(options?: {
  maxAreaUsagePerTrip?: number;
  maxAreaUsagePerDay?: number;
  allowCrossRoleDuplicates?: boolean;
}): GlobalLedger {
  return new GlobalLedger(options);
}

// =============================================================================
// ASSERTION HELPER
// =============================================================================

/**
 * Assert no duplicates in the final itinerary
 * Throws if duplicates found
 */
export function assertNoDuplicates(ledger: GlobalLedger): void {
  const validation = ledger.validateNoDuplicates();

  if (!validation.valid) {
    console.error('Duplicate violations found:');
    for (const violation of validation.violations) {
      console.error(`  - ${violation}`);
    }
    throw new Error(`Itinerary contains ${validation.violations.length} duplicate violations`);
  }

  const crossRole = ledger.findCrossRoleUsages();
  if (crossRole.length > 0) {
    console.warn('Cross-role usages found:');
    for (const usage of crossRole) {
      console.warn(`  - "${usage.name}" used as ${usage.roles.join(' and ')}`);
    }
  }
}
