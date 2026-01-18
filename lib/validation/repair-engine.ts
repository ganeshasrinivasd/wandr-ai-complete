/**
 * Repair Engine
 *
 * Fixes infeasible itineraries using a repair ladder:
 * 1. Reorder activities to reduce travel
 * 2. Swap with backup from same zone
 * 3. Shrink durations (small overflow only, respects category minimums)
 * 4. Compress buffers
 * 5. Drop lowest-utility activity
 * 6. Anchor recovery (if day lacks anchor)
 * 7. Backtrack (request more candidates)
 *
 * v3 Enhancements:
 * - Priority-ordered repair with REPAIR_PRIORITY_ORDER
 * - Pinned candidate protection (anchors + mustInclude + big rocks)
 * - PlanTrace logging with RepairActionCode
 */

import {
  DayTimeline,
  TimelineSlot,
  FeasibilityIssue,
  EnrichedCandidate,
  TravelMatrix,
  ZoneConfig,
  DEFAULT_ZONE_CONFIG,
  DURATION_PRIORS,
  ActivityCategory,
} from '../planning/types';
import {
  DayTimelineV3,
  EnrichedCandidateCanonical,
  CanonicalPlaceId,
  RepairActionCode,
  FeasibilityViolationType,
} from '../types/optimizer-v3';
import { PlanTraceBuilder } from '../observability/plan-trace';
import { OptimizerV3Config, DEFAULT_OPTIMIZER_V3_CONFIG } from '../config/optimizer-config';
import {
  checkDayFeasibility,
  findShrinkableActivity,
  findDroppableActivity,
  getMostCriticalIssue,
} from './feasibility-checker';
import { orderDayRoute, buildTravelMatrix } from '../planning/route-optimizer';

// =============================================================================
// REPAIR CONTEXT
// =============================================================================

export interface RepairContext {
  itinerary: DayTimeline[];
  backupCandidates: EnrichedCandidate[];
  dayBudgetMin: number;
  zoneConfig: ZoneConfig;
  maxIterations: number;
}

export interface RepairResult {
  success: boolean;
  repairedItinerary: DayTimeline[];
  repairsApplied: string[];
  remainingIssues: FeasibilityIssue[];
}

// =============================================================================
// MAIN REPAIR LOOP
// =============================================================================

/**
 * Main repair loop - attempts to fix all feasibility issues
 */
export async function repairItinerary(
  context: RepairContext
): Promise<RepairResult> {
  let itinerary = context.itinerary.map(day => ({ ...day, slots: [...day.slots] }));
  const repairsApplied: string[] = [];
  let iterations = 0;

  while (iterations < context.maxIterations) {
    iterations++;

    // Check feasibility of all days
    let allValid = true;
    let worstIssue: FeasibilityIssue | null = null;
    let worstDayIndex = -1;

    for (let i = 0; i < itinerary.length; i++) {
      const report = checkDayFeasibility(
        itinerary[i],
        context.dayBudgetMin,
        context.zoneConfig
      );

      if (!report.isValid) {
        allValid = false;
        const issue = getMostCriticalIssue(report);
        if (issue && (!worstIssue || (issue.overflowMin ?? 0) > (worstIssue.overflowMin ?? 0))) {
          worstIssue = issue;
          worstDayIndex = i;
        }
      }
    }

    if (allValid) {
      return {
        success: true,
        repairedItinerary: itinerary,
        repairsApplied,
        remainingIssues: [],
      };
    }

    if (!worstIssue || worstDayIndex < 0) break;

    // Apply repair
    const repairResult = applyRepair(
      itinerary,
      worstDayIndex,
      worstIssue,
      context
    );

    if (!repairResult.changed) {
      console.warn(`Could not repair: ${worstIssue.message}`);
      break;
    }

    itinerary = repairResult.itinerary;
    repairsApplied.push(repairResult.repairDescription);
  }

  // Collect remaining issues
  const remainingIssues: FeasibilityIssue[] = [];
  for (const day of itinerary) {
    const report = checkDayFeasibility(day, context.dayBudgetMin, context.zoneConfig);
    remainingIssues.push(...report.issues);
  }

  return {
    success: remainingIssues.filter(i => i.severity === 'error').length === 0,
    repairedItinerary: itinerary,
    repairsApplied,
    remainingIssues,
  };
}

// =============================================================================
// REPAIR APPLICATION
// =============================================================================

interface ApplyRepairResult {
  changed: boolean;
  itinerary: DayTimeline[];
  repairDescription: string;
}

/**
 * Apply a single repair action
 */
function applyRepair(
  itinerary: DayTimeline[],
  dayIndex: number,
  issue: FeasibilityIssue,
  context: RepairContext
): ApplyRepairResult {
  const day = itinerary[dayIndex];

  // Repair ladder - try each strategy in order

  // 1. ANCHOR RECOVERY - if day lacks anchor, try to swap in one (prioritize this)
  if (issue.type === 'missing_anchor') {
    const result = tryAnchorRecovery(itinerary, dayIndex, context.backupCandidates);
    if (result.changed) return result;
    // If anchor recovery fails, continue with other repairs
  }

  // 2. REORDER to reduce travel
  if (issue.type === 'excessive_travel') {
    const result = tryReorder(itinerary, dayIndex);
    if (result.changed) return result;
  }

  // 3. SWAP with backup from same zone
  if (issue.type === 'over_budget' || issue.type === 'excessive_travel') {
    const result = trySwap(itinerary, dayIndex, context.backupCandidates);
    if (result.changed) return result;
  }

  // 4. SHRINK durations (small overflow only, respects category minimums)
  if (issue.type === 'over_budget' && (issue.overflowMin ?? 0) <= 45) {
    const result = tryShrinkWithMinDuration(itinerary, dayIndex, issue.overflowMin ?? 30);
    if (result.changed) return result;
  }

  // 5. COMPRESS buffers
  if (issue.type === 'over_budget' && (issue.overflowMin ?? 0) <= 30) {
    const result = tryCompressBuffers(itinerary, dayIndex, context.zoneConfig);
    if (result.changed) return result;
  }

  // 6. DROP lowest-utility activity
  if (issue.type === 'over_budget') {
    const result = tryDrop(itinerary, dayIndex);
    if (result.changed) return result;
  }

  return {
    changed: false,
    itinerary,
    repairDescription: 'No repair possible',
  };
}

// =============================================================================
// REPAIR STRATEGIES
// =============================================================================

/**
 * Strategy 1: Reorder activities to reduce travel
 */
function tryReorder(
  itinerary: DayTimeline[],
  dayIndex: number
): ApplyRepairResult {
  const day = itinerary[dayIndex];
  const activities = day.slots
    .filter(s => s.type === 'activity' && s.candidate)
    .map(s => s.candidate!);

  if (activities.length <= 2) {
    return { changed: false, itinerary, repairDescription: '' };
  }

  const travelMatrix = buildTravelMatrix(activities);
  const reordered = orderDayRoute(activities, travelMatrix);

  // Rebuild timeline with reordered activities
  const newTimeline = rebuildTimelineWithActivities(day, reordered, travelMatrix);

  // Check if travel improved
  if (newTimeline.totalTravelMin < day.totalTravelMin - 5) {
    const newItinerary = [...itinerary];
    newItinerary[dayIndex] = newTimeline;

    return {
      changed: true,
      itinerary: newItinerary,
      repairDescription: `Reordered Day ${dayIndex + 1} activities (saved ${day.totalTravelMin - newTimeline.totalTravelMin} min travel)`,
    };
  }

  return { changed: false, itinerary, repairDescription: '' };
}

/**
 * Strategy 2: Swap activity with backup from same zone
 */
function trySwap(
  itinerary: DayTimeline[],
  dayIndex: number,
  backupCandidates: EnrichedCandidate[]
): ApplyRepairResult {
  const day = itinerary[dayIndex];

  // Find droppable activity
  const droppableId = findDroppableActivity(day);
  if (!droppableId) {
    return { changed: false, itinerary, repairDescription: '' };
  }

  const droppedSlot = day.slots.find(
    s => s.type === 'activity' && s.candidate?.id === droppableId
  );
  if (!droppedSlot?.candidate) {
    return { changed: false, itinerary, repairDescription: '' };
  }

  const droppedCandidate = droppedSlot.candidate;

  // Find better backup in same zone with shorter duration
  const backup = backupCandidates.find(
    c =>
      c.zoneId === day.zoneId &&
      c.id !== droppableId &&
      c.durationExpected < droppedCandidate.durationExpected &&
      !day.slots.some(s => s.candidate?.id === c.id)
  );

  if (!backup) {
    return { changed: false, itinerary, repairDescription: '' };
  }

  // Swap activities
  const newActivities = day.slots
    .filter(s => s.type === 'activity' && s.candidate?.id !== droppableId)
    .map(s => s.candidate!)
    .concat([backup]);

  const travelMatrix = buildTravelMatrix(newActivities);
  const newTimeline = rebuildTimelineWithActivities(day, newActivities, travelMatrix);

  const newItinerary = [...itinerary];
  newItinerary[dayIndex] = newTimeline;

  return {
    changed: true,
    itinerary: newItinerary,
    repairDescription: `Swapped "${droppedCandidate.name}" with "${backup.name}" on Day ${dayIndex + 1}`,
  };
}

/**
 * Strategy 3: Shrink activity durations (with category minimum guard)
 *
 * CRITICAL: Never shrinks below category minimum duration.
 * This prevents unrealistic visit times (e.g., 30 min at a zoo).
 * Also handles keyword-based overrides for misclassified big attractions.
 */
function tryShrinkWithMinDuration(
  itinerary: DayTimeline[],
  dayIndex: number,
  targetShrink: number
): ApplyRepairResult {
  const day = itinerary[dayIndex];

  const shrinkableId = findShrinkableActivity(day);
  if (!shrinkableId) {
    return { changed: false, itinerary, repairDescription: '' };
  }

  let shrunkAmount = 0;
  const newSlots = day.slots.map(slot => {
    if (slot.type === 'activity' && slot.candidate?.id === shrinkableId) {
      const candidate = slot.candidate;

      // Get category minimum duration (with keyword override for big attractions)
      const minDuration = getMinDurationForCategory(candidate.category, candidate.name);

      // Calculate max shrink respecting category minimum
      const currentDuration = slot.duration;
      const maxShrinkByCategory = currentDuration - minDuration;
      const maxShrinkByCandidate = candidate.durationExpected - candidate.durationMin;

      // Use the more restrictive limit
      const maxAllowedShrink = Math.min(maxShrinkByCategory, maxShrinkByCandidate);

      // Cap at 30 min per shrink operation
      const actualShrink = Math.min(targetShrink, maxAllowedShrink, 30);

      if (actualShrink > 0) {
        shrunkAmount = actualShrink;
        console.log(`  → Shrinking "${candidate.name}" by ${actualShrink}min (min: ${minDuration}min for ${candidate.category})`);
        return {
          ...slot,
          duration: slot.duration - actualShrink,
          endMin: slot.endMin - actualShrink,
        };
      } else {
        console.log(`  → Cannot shrink "${candidate.name}" - already at category minimum (${minDuration}min for ${candidate.category})`);
      }
    }
    return slot;
  });

  if (shrunkAmount === 0) {
    return { changed: false, itinerary, repairDescription: '' };
  }

  const newTimeline = recalculateTimeline({ ...day, slots: newSlots });
  const newItinerary = [...itinerary];
  newItinerary[dayIndex] = newTimeline;

  const activity = day.slots.find(s => s.candidate?.id === shrinkableId)?.candidate;

  return {
    changed: true,
    itinerary: newItinerary,
    repairDescription: `Shortened "${activity?.name}" by ${shrunkAmount} min on Day ${dayIndex + 1}`,
  };
}

/**
 * Get minimum duration for a category based on DURATION_PRIORS
 * Also handles keyword-based overrides for misclassified large attractions
 */
function getMinDurationForCategory(category: ActivityCategory, candidateName?: string): number {
  // Keyword-based override for misclassified large attractions
  // These should NEVER be shrunk below 240-300 minutes
  if (candidateName) {
    const nameLower = candidateName.toLowerCase();
    const bigAttractionPatterns = [
      /amusement/i,
      /theme\s*park/i,
      /water\s*park/i,
      /film\s*city/i,
      /adventure\s*park/i,
      /resort.*rides/i,
      /wonderla/i,
      /disney/i,
      /universal/i,
      /legoland/i,
      /six\s*flags/i,
      /sea\s*world/i,
      /busch\s*gardens/i,
    ];
    
    if (bigAttractionPatterns.some(p => p.test(nameLower))) {
      console.log(`  → Big attraction override for "${candidateName}" - min duration 240min`);
      return 240; // Minimum 4 hours for big attractions
    }
  }

  const prior = DURATION_PRIORS[category];
  if (prior) {
    // Use the base minimum (first element of base tuple)
    return prior.base[0];
  }

  // Fallback minimums for categories not in DURATION_PRIORS
  const fallbackMinimums: Partial<Record<ActivityCategory, number>> = {
    theme_park: 300,
    zoo: 180,
    aquarium: 120,
    museum: 90,
    major_museum: 180,
    landmark: 45,
    monument: 30,
    fort: 90,
    palace: 90,
    temple: 45,
    church: 30,
    mosque: 30,
    religious: 30,
    park: 60,
    garden: 45,
    viewpoint: 20,
    beach: 90,
    market: 60,
    shopping: 60,
    mall: 90,
    restaurant: 60,
    cafe: 30,
    bar: 60,
    tour: 120,
    experience: 60,
    show: 90,
    neighborhood: 60,
    walk: 45,
    lake: 45,
    unknown: 30,
  };

  return fallbackMinimums[category] ?? 30;
}

/**
 * Strategy 3 (legacy): Shrink activity durations
 * @deprecated Use tryShrinkWithMinDuration for category-aware shrinking
 */
function tryShrink(
  itinerary: DayTimeline[],
  dayIndex: number,
  targetShrink: number
): ApplyRepairResult {
  // Delegate to new function
  return tryShrinkWithMinDuration(itinerary, dayIndex, targetShrink);
}

/**
 * Strategy 4: Compress buffers
 */
function tryCompressBuffers(
  itinerary: DayTimeline[],
  dayIndex: number,
  config: ZoneConfig
): ApplyRepairResult {
  const day = itinerary[dayIndex];

  const bufferSlots = day.slots.filter(s => s.type === 'buffer');
  const currentBufferTotal = bufferSlots.reduce((s, b) => s + b.duration, 0);

  // Minimum buffer per activity (5 min each)
  const activityCount = day.slots.filter(s => s.type === 'activity').length;
  const minBufferTotal = activityCount * 5;

  if (currentBufferTotal <= minBufferTotal) {
    return { changed: false, itinerary, repairDescription: '' };
  }

  const compressionRatio = minBufferTotal / currentBufferTotal;
  const savedTime = currentBufferTotal - minBufferTotal;

  const newSlots = day.slots.map(slot => {
    if (slot.type === 'buffer') {
      const newDuration = Math.max(5, Math.round(slot.duration * compressionRatio));
      return { ...slot, duration: newDuration };
    }
    return slot;
  });

  const newTimeline = recalculateTimeline({ ...day, slots: newSlots });
  const newItinerary = [...itinerary];
  newItinerary[dayIndex] = newTimeline;

  return {
    changed: true,
    itinerary: newItinerary,
    repairDescription: `Compressed buffers on Day ${dayIndex + 1} (saved ${savedTime} min)`,
  };
}

/**
 * Strategy 5: Drop lowest-utility activity
 */
function tryDrop(
  itinerary: DayTimeline[],
  dayIndex: number
): ApplyRepairResult {
  const day = itinerary[dayIndex];

  const droppableId = findDroppableActivity(day);
  if (!droppableId) {
    return { changed: false, itinerary, repairDescription: '' };
  }

  const droppedActivity = day.slots.find(
    s => s.candidate?.id === droppableId
  )?.candidate;

  const newActivities = day.slots
    .filter(s => s.type === 'activity' && s.candidate?.id !== droppableId)
    .map(s => s.candidate!);

  if (newActivities.length === 0) {
    return { changed: false, itinerary, repairDescription: '' };
  }

  const travelMatrix = buildTravelMatrix(newActivities);
  const newTimeline = rebuildTimelineWithActivities(day, newActivities, travelMatrix);

  const newItinerary = [...itinerary];
  newItinerary[dayIndex] = newTimeline;

  return {
    changed: true,
    itinerary: newItinerary,
    repairDescription: `Dropped "${droppedActivity?.name}" from Day ${dayIndex + 1}`,
  };
}

/**
 * Strategy 6: Anchor Recovery
 *
 * If a day lacks an anchor attraction (reviewCount >= 30k or isBigRock),
 * attempt to swap in a high-quality anchor from the backup pool.
 */
function tryAnchorRecovery(
  itinerary: DayTimeline[],
  dayIndex: number,
  backupCandidates: EnrichedCandidate[]
): ApplyRepairResult {
  const day = itinerary[dayIndex];

  // Check if day already has an anchor
  const hasAnchor = day.slots.some(
    s =>
      s.type === 'activity' &&
      s.candidate &&
      (s.candidate.reviewCount >= 30000 || s.candidate.isBigRock)
  );

  if (hasAnchor) {
    return { changed: false, itinerary, repairDescription: '' };
  }

  // Find best anchor candidate from backup pool in same zone
  const anchorCandidates = backupCandidates
    .filter(c =>
      c.zoneId === day.zoneId &&
      (c.reviewCount >= 30000 || c.isBigRock) &&
      !day.slots.some(s => s.candidate?.id === c.id)
    )
    .sort((a, b) => b.utilityScore - a.utilityScore);

  if (anchorCandidates.length === 0) {
    // No anchor available in same zone - try any zone
    const anyZoneAnchors = backupCandidates
      .filter(c =>
        (c.reviewCount >= 30000 || c.isBigRock) &&
        !day.slots.some(s => s.candidate?.id === c.id)
      )
      .sort((a, b) => b.utilityScore - a.utilityScore);

    if (anyZoneAnchors.length === 0) {
      console.warn(`  ⚠️ No anchor candidates available for Day ${dayIndex + 1}`);
      return { changed: false, itinerary, repairDescription: '' };
    }

    // Use cross-zone anchor but log warning
    console.warn(`  ⚠️ Using cross-zone anchor for Day ${dayIndex + 1}`);
    anchorCandidates.push(anyZoneAnchors[0]);
  }

  const anchor = anchorCandidates[0];

  // Find lowest-utility non-anchor activity to swap out
  const swappableActivities = day.slots
    .filter(s =>
      s.type === 'activity' &&
      s.candidate &&
      !s.candidate.isBigRock &&
      s.candidate.reviewCount < 30000
    )
    .map(s => s.candidate!)
    .sort((a, b) => a.utilityScore - b.utilityScore);

  if (swappableActivities.length === 0) {
    // No activity to swap - try adding anchor if budget allows
    console.warn(`  ⚠️ No swappable activity for anchor recovery on Day ${dayIndex + 1}`);
    return { changed: false, itinerary, repairDescription: '' };
  }

  const toSwapOut = swappableActivities[0];

  // Perform swap
  const newActivities = day.slots
    .filter(s => s.type === 'activity' && s.candidate?.id !== toSwapOut.id)
    .map(s => s.candidate!)
    .concat([anchor]);

  const travelMatrix = buildTravelMatrix(newActivities);
  const newTimeline = rebuildTimelineWithActivities(day, newActivities, travelMatrix);

  const newItinerary = [...itinerary];
  newItinerary[dayIndex] = newTimeline;

  return {
    changed: true,
    itinerary: newItinerary,
    repairDescription: `Anchor Recovery: Swapped "${toSwapOut.name}" with anchor "${anchor.name}" on Day ${dayIndex + 1}`,
  };
}

// =============================================================================
// TIMELINE REBUILDING
// =============================================================================

/**
 * Rebuild a timeline with new activities
 */
function rebuildTimelineWithActivities(
  original: DayTimeline,
  activities: EnrichedCandidate[],
  travelMatrix: TravelMatrix
): DayTimeline {
  const slots: TimelineSlot[] = [];
  let currentMin = 0;
  let totalTravel = 0;
  let totalActivity = 0;
  let totalBuffer = 0;

  for (let i = 0; i < activities.length; i++) {
    const activity = activities[i];

    // Add travel from previous
    if (i > 0) {
      const prevId = activities[i - 1].id;
      const travelMin = travelMatrix.get(prevId)?.get(activity.id) ?? 20;

      slots.push({
        type: 'travel',
        startMin: currentMin,
        endMin: currentMin + travelMin,
        duration: travelMin,
        travelFromPrevious: travelMin,
      });

      currentMin += travelMin;
      totalTravel += travelMin;
    }

    // Add buffer (15 min default)
    const bufferMin = 15;
    slots.push({
      type: 'buffer',
      startMin: currentMin,
      endMin: currentMin + bufferMin,
      duration: bufferMin,
    });
    currentMin += bufferMin;
    totalBuffer += bufferMin;

    // Add activity
    const duration = activity.durationExpected;
    slots.push({
      type: 'activity',
      startMin: currentMin,
      endMin: currentMin + duration,
      duration,
      candidate: activity,
    });
    currentMin += duration;
    totalActivity += duration;
  }

  // Preserve meals from original
  const originalMeals = original.slots.filter(s => s.type === 'meal');
  const totalMeal = originalMeals.reduce((s, m) => s + m.duration, 0);

  const newBudgetUsed = totalActivity + totalTravel + totalBuffer + totalMeal;

  // Calculate day budget from original values (budgetUsed + budgetRemaining = dayBudget)
  const dayBudget = (original.budgetUsed ?? 0) + (original.budgetRemaining ?? 0);

  return {
    ...original,
    slots,
    totalActivityMin: totalActivity,
    totalTravelMin: totalTravel,
    totalBufferMin: totalBuffer,
    totalMealMin: totalMeal,
    budgetUsed: newBudgetUsed,
    budgetRemaining: Math.max(0, dayBudget - newBudgetUsed),
  };
}

/**
 * Recalculate timeline times after modifications
 */
function recalculateTimeline(timeline: DayTimeline): DayTimeline {
  let currentMin = 0;
  const updatedSlots = timeline.slots.map(slot => {
    const updated = {
      ...slot,
      startMin: currentMin,
      endMin: currentMin + slot.duration,
    };
    currentMin += slot.duration;
    return updated;
  });

  const totalActivity = updatedSlots
    .filter(s => s.type === 'activity')
    .reduce((t, s) => t + s.duration, 0);

  const totalTravel = updatedSlots
    .filter(s => s.type === 'travel')
    .reduce((t, s) => t + s.duration, 0);

  const totalBuffer = updatedSlots
    .filter(s => s.type === 'buffer')
    .reduce((t, s) => t + s.duration, 0);

  const totalMeal = updatedSlots
    .filter(s => s.type === 'meal')
    .reduce((t, s) => t + s.duration, 0);

  const newBudgetUsed = totalActivity + totalTravel + totalBuffer + totalMeal;

  // Calculate day budget from original values (budgetUsed + budgetRemaining = dayBudget)
  const dayBudget = (timeline.budgetUsed ?? 0) + (timeline.budgetRemaining ?? 0);

  return {
    ...timeline,
    slots: updatedSlots,
    totalActivityMin: totalActivity,
    totalTravelMin: totalTravel,
    totalBufferMin: totalBuffer,
    totalMealMin: totalMeal,
    budgetUsed: newBudgetUsed,
    budgetRemaining: Math.max(0, dayBudget - newBudgetUsed),
  };
}


// =============================================================================
// V3 REPAIR ENGINE
// =============================================================================

/**
 * Priority order for repair actions.
 * Try less disruptive repairs first.
 */
export const REPAIR_PRIORITY_ORDER: RepairActionCode[] = [
  RepairActionCode.REORDER_2OPT,
  RepairActionCode.DROP_LOWEST_UTILITY,
  RepairActionCode.SWAP_NEARBY,
  RepairActionCode.MOVE_TO_ADJACENT_DAY,
  RepairActionCode.SHRINK_DURATION,
  RepairActionCode.COMPRESS_BUFFERS,
  RepairActionCode.RELAX_DIAMETER_THRESHOLD,
];

export interface RepairResultV3 {
  success: boolean;
  actionsTaken: Array<{
    actionCode: RepairActionCode;
    dayIndex: number;
    details: string;
  }>;
  repairedTimeline: DayTimelineV3;
}

export interface RepairContextV3 {
  timeline: DayTimelineV3;
  backupCandidates: EnrichedCandidateCanonical[];
  pinnedSet: Set<CanonicalPlaceId>;
  config: OptimizerV3Config;
  trace?: PlanTraceBuilder;
}

/**
 * Repair a single day's timeline using v3 priority-ordered repairs.
 *
 * Protection rules:
 * 1. Anchors cannot be dropped or moved unless infeasible
 * 2. MustInclude cannot be dropped unless infeasible
 * 3. Pinned Big Rocks cannot be moved across days unless infeasible
 */
export function repairDayV3(
  context: RepairContextV3,
  violation: { type: FeasibilityViolationType; message: string }
): RepairResultV3 {
  const { timeline, backupCandidates, pinnedSet, config, trace } = context;
  const actionsTaken: RepairResultV3['actionsTaken'] = [];
  let currentTimeline = { ...timeline, slots: [...timeline.slots] };

  // Try repairs in priority order
  for (const actionCode of REPAIR_PRIORITY_ORDER) {
    const result = tryRepairActionV3(
      actionCode,
      currentTimeline,
      backupCandidates,
      pinnedSet,
      config,
      violation
    );

    if (result.changed) {
      currentTimeline = result.timeline;
      actionsTaken.push({
        actionCode,
        dayIndex: timeline.dayIndex,
        details: result.details,
      });

      // Log to trace
      if (trace) {
        trace.logRepair(timeline.dayIndex, actionCode, result.details);
      }

      console.log(`[Repair v3] Day ${timeline.dayIndex}: ${actionCode} - ${result.details}`);

      // Check if issue is resolved
      if (result.resolved) {
        return {
          success: true,
          actionsTaken,
          repairedTimeline: currentTimeline,
        };
      }
    }
  }

  // Return best effort
  return {
    success: actionsTaken.length > 0,
    actionsTaken,
    repairedTimeline: currentTimeline,
  };
}

interface RepairActionResult {
  changed: boolean;
  resolved: boolean;
  timeline: DayTimelineV3;
  details: string;
}

/**
 * Try a specific repair action.
 */
function tryRepairActionV3(
  actionCode: RepairActionCode,
  timeline: DayTimelineV3,
  backupCandidates: EnrichedCandidateCanonical[],
  pinnedSet: Set<CanonicalPlaceId>,
  config: OptimizerV3Config,
  violation: { type: FeasibilityViolationType; message: string }
): RepairActionResult {
  switch (actionCode) {
    case RepairActionCode.REORDER_2OPT:
      return tryReorder2OptV3(timeline, pinnedSet);

    case RepairActionCode.DROP_LOWEST_UTILITY:
      return tryDropLowestUtilityV3(timeline, pinnedSet);

    case RepairActionCode.SWAP_NEARBY:
      return trySwapNearbyV3(timeline, backupCandidates, pinnedSet, config);

    case RepairActionCode.SHRINK_DURATION:
      return tryShrinkDurationV3(timeline, pinnedSet, config);

    case RepairActionCode.COMPRESS_BUFFERS:
      return tryCompressBuffersV3(timeline, config);

    case RepairActionCode.RELAX_DIAMETER_THRESHOLD:
      return tryRelaxDiameterV3(timeline, config);

    case RepairActionCode.MOVE_TO_ADJACENT_DAY:
      // This requires access to other days, handled at higher level
      return { changed: false, resolved: false, timeline, details: 'Not applicable for single day' };

    default:
      return { changed: false, resolved: false, timeline, details: 'Unknown action' };
  }
}

/**
 * Reorder activities using 2-opt to reduce travel time.
 */
function tryReorder2OptV3(
  timeline: DayTimelineV3,
  pinnedSet: Set<CanonicalPlaceId>
): RepairActionResult {
  const activities = timeline.slots
    .filter(s => s.type === 'activity' && s.candidate)
    .map(s => s.candidate!);

  if (activities.length <= 2) {
    return { changed: false, resolved: false, timeline, details: 'Not enough activities' };
  }

  // Simple 2-opt: try swapping pairs and keep best
  let bestOrder = [...activities];
  let bestTravelTime = estimateTotalTravelV3(activities);
  let improved = false;

  for (let i = 0; i < activities.length - 1; i++) {
    for (let j = i + 1; j < activities.length; j++) {
      // Skip if either is pinned (keep relative order of pinned)
      if (pinnedSet.has(activities[i].canonicalId) || pinnedSet.has(activities[j].canonicalId)) {
        continue;
      }

      // Try swap
      const newOrder = [...activities];
      [newOrder[i], newOrder[j]] = [newOrder[j], newOrder[i]];

      const newTravelTime = estimateTotalTravelV3(newOrder);
      if (newTravelTime < bestTravelTime - 5) {
        bestOrder = newOrder;
        bestTravelTime = newTravelTime;
        improved = true;
      }
    }
  }

  if (!improved) {
    return { changed: false, resolved: false, timeline, details: 'No improvement found' };
  }

  const newTimeline = rebuildTimelineV3(timeline, bestOrder);
  const savedTime = estimateTotalTravelV3(activities) - bestTravelTime;

  return {
    changed: true,
    resolved: newTimeline.budgetRemaining >= 0,
    timeline: newTimeline,
    details: `Reordered activities, saved ${Math.round(savedTime)} min travel`,
  };
}

/**
 * Drop lowest utility non-pinned activity.
 */
function tryDropLowestUtilityV3(
  timeline: DayTimelineV3,
  pinnedSet: Set<CanonicalPlaceId>
): RepairActionResult {
  const activities = timeline.slots
    .filter(s => s.type === 'activity' && s.candidate)
    .map(s => s.candidate!);

  // Find lowest utility non-pinned activity
  const droppable = activities
    .filter(a => !pinnedSet.has(a.canonicalId))
    .sort((a, b) => a.utilityScore - b.utilityScore);

  if (droppable.length === 0) {
    return { changed: false, resolved: false, timeline, details: 'No droppable activities' };
  }

  const toDrop = droppable[0];
  const remaining = activities.filter(a => a.canonicalId !== toDrop.canonicalId);

  if (remaining.length === 0) {
    return { changed: false, resolved: false, timeline, details: 'Cannot drop last activity' };
  }

  const newTimeline = rebuildTimelineV3(timeline, remaining);

  return {
    changed: true,
    resolved: newTimeline.budgetRemaining >= 0,
    timeline: newTimeline,
    details: `Dropped "${toDrop.name}" (utility: ${toDrop.utilityScore.toFixed(2)})`,
  };
}

/**
 * Swap activity with nearby backup.
 */
function trySwapNearbyV3(
  timeline: DayTimelineV3,
  backupCandidates: EnrichedCandidateCanonical[],
  pinnedSet: Set<CanonicalPlaceId>,
  config: OptimizerV3Config
): RepairActionResult {
  const activities = timeline.slots
    .filter(s => s.type === 'activity' && s.candidate)
    .map(s => s.candidate!);

  // Find swappable (non-pinned) activity with lowest utility
  const swappable = activities
    .filter(a => !pinnedSet.has(a.canonicalId))
    .sort((a, b) => a.utilityScore - b.utilityScore);

  if (swappable.length === 0) {
    return { changed: false, resolved: false, timeline, details: 'No swappable activities' };
  }

  const toSwap = swappable[0];

  // Find nearby backup with shorter duration
  const nearbyBackups = backupCandidates
    .filter(b => {
      if (activities.some(a => a.canonicalId === b.canonicalId)) return false;
      const dist = haversineDistanceSimple(toSwap.location, b.location);
      return dist <= config.nearbySwapRadiusKm && b.durationMinutes < toSwap.durationMinutes;
    })
    .sort((a, b) => b.utilityScore - a.utilityScore);

  if (nearbyBackups.length === 0) {
    return { changed: false, resolved: false, timeline, details: 'No suitable nearby backup' };
  }

  const backup = nearbyBackups[0];
  const newActivities = activities
    .filter(a => a.canonicalId !== toSwap.canonicalId)
    .concat([backup]);

  const newTimeline = rebuildTimelineV3(timeline, newActivities);

  return {
    changed: true,
    resolved: newTimeline.budgetRemaining >= 0,
    timeline: newTimeline,
    details: `Swapped "${toSwap.name}" with "${backup.name}"`,
  };
}

/**
 * Shrink activity durations respecting minimums.
 */
function tryShrinkDurationV3(
  timeline: DayTimelineV3,
  pinnedSet: Set<CanonicalPlaceId>,
  config: OptimizerV3Config
): RepairActionResult {
  const newSlots = [...timeline.slots];
  let totalShrunk = 0;

  for (let i = 0; i < newSlots.length; i++) {
    const slot = newSlots[i];
    if (slot.type !== 'activity' || !slot.candidate) continue;

    // Don't shrink pinned candidates as aggressively
    const isPinned = pinnedSet.has(slot.candidate.canonicalId);
    const minDuration = isPinned
      ? slot.candidate.durationMin
      : Math.max(30, slot.candidate.durationMin);

    const maxShrink = slot.duration - minDuration;
    if (maxShrink > 0) {
      const shrinkAmount = Math.min(maxShrink, 15); // Max 15 min per activity
      newSlots[i] = {
        ...slot,
        duration: slot.duration - shrinkAmount,
        endMin: slot.endMin - shrinkAmount,
      };
      totalShrunk += shrinkAmount;
    }
  }

  if (totalShrunk === 0) {
    return { changed: false, resolved: false, timeline, details: 'No shrinkable activities' };
  }

  const newTimeline = recalculateTimelineV3({ ...timeline, slots: newSlots });

  return {
    changed: true,
    resolved: newTimeline.budgetRemaining >= 0,
    timeline: newTimeline,
    details: `Shrunk activities by ${totalShrunk} min total`,
  };
}

/**
 * Compress buffer times.
 */
function tryCompressBuffersV3(
  timeline: DayTimelineV3,
  config: OptimizerV3Config
): RepairActionResult {
  const newSlots = [...timeline.slots];
  let totalCompressed = 0;

  for (let i = 0; i < newSlots.length; i++) {
    const slot = newSlots[i];
    if (slot.type !== 'buffer') continue;

    const minBuffer = config.minBufferMinutes;
    if (slot.duration > minBuffer) {
      const compress = slot.duration - minBuffer;
      newSlots[i] = {
        ...slot,
        duration: minBuffer,
        endMin: slot.startMin + minBuffer,
      };
      totalCompressed += compress;
    }
  }

  if (totalCompressed === 0) {
    return { changed: false, resolved: false, timeline, details: 'Buffers already minimal' };
  }

  const newTimeline = recalculateTimelineV3({ ...timeline, slots: newSlots });

  return {
    changed: true,
    resolved: newTimeline.budgetRemaining >= 0,
    timeline: newTimeline,
    details: `Compressed buffers by ${totalCompressed} min`,
  };
}

/**
 * Relax diameter threshold (last resort).
 */
function tryRelaxDiameterV3(
  timeline: DayTimelineV3,
  config: OptimizerV3Config
): RepairActionResult {
  // This is a soft relaxation - just mark as acceptable
  // The actual diameter check happens in zone validation
  return {
    changed: true,
    resolved: true,
    timeline,
    details: `Relaxed diameter threshold for day ${timeline.dayIndex}`,
  };
}

// =============================================================================
// V3 HELPER FUNCTIONS
// =============================================================================

/**
 * Estimate total travel time for a sequence of activities.
 */
function estimateTotalTravelV3(activities: EnrichedCandidateCanonical[]): number {
  let total = 0;
  for (let i = 1; i < activities.length; i++) {
    const dist = haversineDistanceSimple(activities[i - 1].location, activities[i].location);
    // Assume 25 km/h average speed + 10 min buffer
    total += (dist / 25) * 60 + 10;
  }
  return total;
}

/**
 * Simple haversine distance.
 */
function haversineDistanceSimple(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
  const R = 6371;
  const dLat = (b.lat - a.lat) * Math.PI / 180;
  const dLng = (b.lng - a.lng) * Math.PI / 180;
  const lat1 = a.lat * Math.PI / 180;
  const lat2 = b.lat * Math.PI / 180;

  const x = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));

  return R * c;
}

/**
 * Rebuild timeline with new activities.
 */
function rebuildTimelineV3(
  original: DayTimelineV3,
  activities: EnrichedCandidateCanonical[]
): DayTimelineV3 {
  const slots: DayTimelineV3['slots'] = [];
  let currentMin = 0;
  let totalTravel = 0;
  let totalActivity = 0;
  let totalBuffer = 0;

  for (let i = 0; i < activities.length; i++) {
    const activity = activities[i];

    // Add travel from previous
    if (i > 0) {
      const travelMin = Math.ceil(
        (haversineDistanceSimple(activities[i - 1].location, activity.location) / 25) * 60 + 10
      );

      slots.push({
        type: 'travel',
        startMin: currentMin,
        endMin: currentMin + travelMin,
        duration: travelMin,
        travelFromPrevious: travelMin,
      });

      currentMin += travelMin;
      totalTravel += travelMin;
    }

    // Add buffer
    const bufferMin = 15;
    slots.push({
      type: 'buffer',
      startMin: currentMin,
      endMin: currentMin + bufferMin,
      duration: bufferMin,
    });
    currentMin += bufferMin;
    totalBuffer += bufferMin;

    // Add activity
    const duration = activity.durationMinutes;
    slots.push({
      type: 'activity',
      startMin: currentMin,
      endMin: currentMin + duration,
      duration,
      candidate: activity,
    });
    currentMin += duration;
    totalActivity += duration;
  }

  // Preserve meal placeholders
  const originalMeals = original.slots.filter(s => s.type === 'meal_placeholder' || s.type === 'meal');
  const totalMeal = originalMeals.reduce((s, m) => s + m.duration, 0);

  const budgetUsed = totalActivity + totalTravel + totalBuffer + totalMeal;
  const dayBudget = original.budgetUsed + original.budgetRemaining;

  return {
    ...original,
    slots,
    totalActivityMin: totalActivity,
    totalTravelMin: totalTravel,
    totalBufferMin: totalBuffer,
    totalMealMin: totalMeal,
    budgetUsed,
    budgetRemaining: Math.max(0, dayBudget - budgetUsed),
    anchorsScheduled: activities.filter(a => a.iconicScore >= 0.7).length,
  };
}

/**
 * Recalculate timeline times after modifications.
 */
function recalculateTimelineV3(timeline: DayTimelineV3): DayTimelineV3 {
  let currentMin = 0;
  const updatedSlots = timeline.slots.map(slot => {
    const updated = {
      ...slot,
      startMin: currentMin,
      endMin: currentMin + slot.duration,
    };
    currentMin += slot.duration;
    return updated;
  });

  const totalActivity = updatedSlots
    .filter(s => s.type === 'activity')
    .reduce((t, s) => t + s.duration, 0);

  const totalTravel = updatedSlots
    .filter(s => s.type === 'travel')
    .reduce((t, s) => t + s.duration, 0);

  const totalBuffer = updatedSlots
    .filter(s => s.type === 'buffer')
    .reduce((t, s) => t + s.duration, 0);

  const totalMeal = updatedSlots
    .filter(s => s.type === 'meal' || s.type === 'meal_placeholder')
    .reduce((t, s) => t + s.duration, 0);

  const budgetUsed = totalActivity + totalTravel + totalBuffer + totalMeal;
  const dayBudget = timeline.budgetUsed + timeline.budgetRemaining;

  return {
    ...timeline,
    slots: updatedSlots,
    totalActivityMin: totalActivity,
    totalTravelMin: totalTravel,
    totalBufferMin: totalBuffer,
    totalMealMin: totalMeal,
    budgetUsed,
    budgetRemaining: Math.max(0, dayBudget - budgetUsed),
  };
}
