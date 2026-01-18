/**
 * Duplicate Assertion Module
 *
 * Validates that no duplicates exist in the final itinerary.
 * Checks both within-day and cross-day duplicates using:
 * - candidate.id
 * - candidate.dedupKey
 * - Near-duplicate detection (name similarity + proximity)
 */

import { DayTimeline, TimelineSlot, EnrichedCandidate } from '../planning/types';
import { areNearDuplicates } from '../utils/dedup';

// =============================================================================
// DUPLICATE INFO
// =============================================================================

export interface DuplicateInfo {
  candidate: {
    name: string;
    id: string;
    dedupKey: string;
  };
  occurrences: Array<{
    dayIndex: number;
    slotIndex: number;
    slotType: 'activity' | 'meal';
  }>;
  type: 'exact_id' | 'exact_dedupKey' | 'near_duplicate';
}

export interface DuplicateAssertionResult {
  valid: boolean;
  duplicates: DuplicateInfo[];
  summary: string;
}

// =============================================================================
// MAIN ASSERTION
// =============================================================================

/**
 * Assert no duplicates exist in timelines.
 * Throws detailed error if duplicates found.
 *
 * @param timelines - Array of day timelines to check
 * @param strict - If true, throws error; if false, logs warning (default: false for production safety)
 * @throws Error with detailed duplicate info when strict=true
 */
export function assertNoDuplicatesInTimelines(timelines: DayTimeline[], strict: boolean = false): void {
  const result = checkForDuplicates(timelines);

  if (!result.valid) {
    const errorLines = [
      '❌ DUPLICATE ASSERTION FAILED',
      result.summary,
      '',
      'Duplicates found:',
    ];

    for (const dup of result.duplicates) {
      errorLines.push(`  ${dup.candidate.name} (${dup.type})`);
      errorLines.push(`    ID: ${dup.candidate.id}`);
      errorLines.push(`    DedupKey: ${dup.candidate.dedupKey}`);
      errorLines.push('    Occurrences:');
      for (const occ of dup.occurrences) {
        errorLines.push(`      - Day ${occ.dayIndex + 1}, Slot ${occ.slotIndex} (${occ.slotType})`);
      }
    }

    const errorMessage = errorLines.join('\n');
    console.error(errorMessage);

    if (strict) {
      // In strict mode, throw to fail fast
      throw new Error(errorMessage);
    } else {
      // In production, log but don't throw to avoid breaking the pipeline
      console.warn(`⚠️ Found ${result.duplicates.length} duplicates - continuing with warning`);
    }
  }
}

/**
 * Check for duplicates without throwing.
 * Returns detailed result for inspection.
 */
export function checkForDuplicates(timelines: DayTimeline[]): DuplicateAssertionResult {
  const duplicates: DuplicateInfo[] = [];

  // Collect all candidates with their locations
  const allCandidates: Array<{
    candidate: EnrichedCandidate;
    dayIndex: number;
    slotIndex: number;
    slotType: 'activity' | 'meal';
  }> = [];

  for (const timeline of timelines) {
    timeline.slots.forEach((slot, slotIndex) => {
      // Activity candidates
      if (slot.type === 'activity' && slot.candidate) {
        allCandidates.push({
          candidate: slot.candidate,
          dayIndex: timeline.dayIndex,
          slotIndex,
          slotType: 'activity',
        });
      }
      // Meal venue candidates
      if (slot.type === 'meal' && slot.mealSlot?.venue) {
        allCandidates.push({
          candidate: slot.mealSlot.venue,
          dayIndex: timeline.dayIndex,
          slotIndex,
          slotType: 'meal',
        });
      }
    });
  }

  // Check for ID duplicates
  const byId = new Map<string, typeof allCandidates>();
  for (const entry of allCandidates) {
    const id = entry.candidate.id;
    const existing = byId.get(id) || [];
    existing.push(entry);
    byId.set(id, existing);
  }

  for (const [id, entries] of byId) {
    if (entries.length > 1) {
      duplicates.push({
        candidate: {
          name: entries[0].candidate.name,
          id: entries[0].candidate.id,
          dedupKey: entries[0].candidate.dedupKey,
        },
        occurrences: entries.map(e => ({
          dayIndex: e.dayIndex,
          slotIndex: e.slotIndex,
          slotType: e.slotType,
        })),
        type: 'exact_id',
      });
    }
  }

  // Check for dedupKey duplicates (may catch different IDs with same canonical key)
  const byDedupKey = new Map<string, typeof allCandidates>();
  for (const entry of allCandidates) {
    const key = entry.candidate.dedupKey;
    const existing = byDedupKey.get(key) || [];
    existing.push(entry);
    byDedupKey.set(key, existing);
  }

  for (const [key, entries] of byDedupKey) {
    if (entries.length > 1) {
      // Check if already reported as ID duplicate
      const alreadyReported = duplicates.some(
        d => d.candidate.dedupKey === key && d.type === 'exact_id'
      );
      if (!alreadyReported) {
        duplicates.push({
          candidate: {
            name: entries[0].candidate.name,
            id: entries[0].candidate.id,
            dedupKey: entries[0].candidate.dedupKey,
          },
          occurrences: entries.map(e => ({
            dayIndex: e.dayIndex,
            slotIndex: e.slotIndex,
            slotType: e.slotType,
          })),
          type: 'exact_dedupKey',
        });
      }
    }
  }

  // Check for near-duplicates (different IDs but similar name + close location)
  const reportedPairs = new Set<string>();

  for (let i = 0; i < allCandidates.length; i++) {
    for (let j = i + 1; j < allCandidates.length; j++) {
      const a = allCandidates[i];
      const b = allCandidates[j];

      // Skip if same ID (already caught above)
      if (a.candidate.id === b.candidate.id) continue;
      if (a.candidate.dedupKey === b.candidate.dedupKey) continue;

      // Check near-duplicate
      if (areNearDuplicates(a.candidate, b.candidate)) {
        const pairKey = [a.candidate.id, b.candidate.id].sort().join('|');
        if (!reportedPairs.has(pairKey)) {
          reportedPairs.add(pairKey);
          duplicates.push({
            candidate: {
              name: `${a.candidate.name} ≈ ${b.candidate.name}`,
              id: `${a.candidate.id} / ${b.candidate.id}`,
              dedupKey: `${a.candidate.dedupKey} / ${b.candidate.dedupKey}`,
            },
            occurrences: [
              { dayIndex: a.dayIndex, slotIndex: a.slotIndex, slotType: a.slotType },
              { dayIndex: b.dayIndex, slotIndex: b.slotIndex, slotType: b.slotType },
            ],
            type: 'near_duplicate',
          });
        }
      }
    }
  }

  const valid = duplicates.length === 0;
  const summary = valid
    ? `✓ No duplicates found in ${timelines.length} days, ${allCandidates.length} candidates`
    : `Found ${duplicates.length} duplicate(s) in ${timelines.length} days`;

  return { valid, duplicates, summary };
}

/**
 * Log duplicate check results (for debugging)
 */
export function logDuplicateCheck(timelines: DayTimeline[]): void {
  const result = checkForDuplicates(timelines);
  console.log(result.summary);

  if (!result.valid) {
    for (const dup of result.duplicates) {
      console.log(`  - ${dup.candidate.name} (${dup.type})`);
      dup.occurrences.forEach(occ => {
        console.log(`      Day ${occ.dayIndex + 1}, Slot ${occ.slotIndex} (${occ.slotType})`);
      });
    }
  }
}
