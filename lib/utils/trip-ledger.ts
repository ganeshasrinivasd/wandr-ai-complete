/**
 * Trip Ledger - Unified Used Tracking
 *
 * Single source of truth for tracking used candidates across the entire trip.
 * Prevents duplicates by checking both candidate.id and candidate.dedupKey.
 *
 * Usage:
 *   const ledger = new TripLedger();
 *   if (!ledger.has(candidate)) {
 *     ledger.add(candidate);
 *   }
 */

import { EnrichedCandidate, DayTimeline, TimelineSlot } from '../planning/types';
import { areNearDuplicates } from './dedup';

export interface LedgerEntry {
  id: string;
  dedupKey: string;
  name: string;
  dayIndex: number;
  slotType: 'activity' | 'meal';
  slotIndex?: number;
}

/**
 * TripLedger - Tracks used candidates to prevent duplicates
 */
export class TripLedger {
  private usedIds = new Set<string>();
  private usedDedupKeys = new Set<string>();
  private entries: LedgerEntry[] = [];
  private candidatesByKey = new Map<string, EnrichedCandidate>();

  /**
   * Check if a candidate is already used (by id OR dedupKey)
   */
  has(candidate: EnrichedCandidate): boolean {
    return this.usedIds.has(candidate.id) || this.usedDedupKeys.has(candidate.dedupKey);
  }

  /**
   * Check if a candidate would be a near-duplicate of any used candidate
   */
  hasNearDuplicate(candidate: EnrichedCandidate): boolean {
    for (const used of this.candidatesByKey.values()) {
      if (areNearDuplicates(candidate, used)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Check if candidate is used OR is a near-duplicate
   */
  isUsedOrDuplicate(candidate: EnrichedCandidate): boolean {
    return this.has(candidate) || this.hasNearDuplicate(candidate);
  }

  /**
   * Add a candidate to the ledger
   */
  add(
    candidate: EnrichedCandidate,
    dayIndex: number,
    slotType: 'activity' | 'meal',
    slotIndex?: number
  ): void {
    this.usedIds.add(candidate.id);
    this.usedDedupKeys.add(candidate.dedupKey);
    this.candidatesByKey.set(candidate.dedupKey, candidate);

    this.entries.push({
      id: candidate.id,
      dedupKey: candidate.dedupKey,
      name: candidate.name,
      dayIndex,
      slotType,
      slotIndex,
    });
  }

  /**
   * Add a candidate without tracking slot info (simpler API)
   */
  addCandidate(candidate: EnrichedCandidate, dayIndex: number = -1): void {
    this.add(candidate, dayIndex, 'activity');
  }

  /**
   * Add all activity candidates from a timeline slot array
   */
  addSlots(slots: TimelineSlot[], dayIndex: number): void {
    slots.forEach((slot, idx) => {
      if (slot.candidate) {
        this.add(slot.candidate, dayIndex, slot.type === 'meal' ? 'meal' : 'activity', idx);
      }
      if (slot.mealSlot?.venue) {
        this.add(slot.mealSlot.venue, dayIndex, 'meal', idx);
      }
    });
  }

  /**
   * Add all candidates from a timeline
   */
  addTimeline(timeline: DayTimeline): void {
    this.addSlots(timeline.slots, timeline.dayIndex);
  }

  /**
   * Remove a candidate from the ledger (for repair/swap operations)
   */
  remove(candidate: EnrichedCandidate): void {
    this.usedIds.delete(candidate.id);
    this.usedDedupKeys.delete(candidate.dedupKey);
    this.candidatesByKey.delete(candidate.dedupKey);
    this.entries = this.entries.filter(e => e.id !== candidate.id);
  }

  /**
   * Get all entries
   */
  getEntries(): LedgerEntry[] {
    return [...this.entries];
  }

  /**
   * Get entries for a specific day
   */
  getEntriesForDay(dayIndex: number): LedgerEntry[] {
    return this.entries.filter(e => e.dayIndex === dayIndex);
  }

  /**
   * Get count of used candidates
   */
  size(): number {
    return this.usedIds.size;
  }

  /**
   * Check if ledger is empty
   */
  isEmpty(): boolean {
    return this.usedIds.size === 0;
  }

  /**
   * Clear all entries
   */
  clear(): void {
    this.usedIds.clear();
    this.usedDedupKeys.clear();
    this.candidatesByKey.clear();
    this.entries = [];
  }

  /**
   * Get raw sets for backward compatibility
   */
  getUsedIds(): Set<string> {
    return new Set(this.usedIds);
  }

  getUsedDedupKeys(): Set<string> {
    return new Set(this.usedDedupKeys);
  }

  /**
   * Create from existing sets (for migration)
   */
  static fromSets(
    usedIds: Set<string>,
    usedDedupKeys: Set<string>
  ): TripLedger {
    const ledger = new TripLedger();
    usedIds.forEach(id => ledger.usedIds.add(id));
    usedDedupKeys.forEach(key => ledger.usedDedupKeys.add(key));
    return ledger;
  }
}

/**
 * Filter candidates that are not in the ledger
 */
export function filterAvailable(
  candidates: EnrichedCandidate[],
  ledger: TripLedger
): EnrichedCandidate[] {
  return candidates.filter(c => !ledger.has(c));
}

/**
 * Filter candidates that are not used and not near-duplicates
 */
export function filterAvailableStrict(
  candidates: EnrichedCandidate[],
  ledger: TripLedger
): EnrichedCandidate[] {
  return candidates.filter(c => !ledger.isUsedOrDuplicate(c));
}
