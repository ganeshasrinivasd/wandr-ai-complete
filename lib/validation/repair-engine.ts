/**
 * Repair Engine
 *
 * Fixes infeasible itineraries using a repair ladder:
 * 1. Reorder activities to reduce travel
 * 2. Swap with backup from same zone
 * 3. Shrink durations (small overflow only)
 * 4. Compress buffers
 * 5. Drop lowest-utility activity
 * 6. Backtrack (request more candidates)
 */

import {
  DayTimeline,
  TimelineSlot,
  FeasibilityIssue,
  EnrichedCandidate,
  TravelMatrix,
  ZoneConfig,
  DEFAULT_ZONE_CONFIG,
} from '../planning/types';
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

  // 1. REORDER to reduce travel
  if (issue.type === 'excessive_travel') {
    const result = tryReorder(itinerary, dayIndex);
    if (result.changed) return result;
  }

  // 2. SWAP with backup from same zone
  if (issue.type === 'over_budget' || issue.type === 'excessive_travel') {
    const result = trySwap(itinerary, dayIndex, context.backupCandidates);
    if (result.changed) return result;
  }

  // 3. SHRINK durations (small overflow only)
  if (issue.type === 'over_budget' && (issue.overflowMin ?? 0) <= 45) {
    const result = tryShrink(itinerary, dayIndex, issue.overflowMin ?? 30);
    if (result.changed) return result;
  }

  // 4. COMPRESS buffers
  if (issue.type === 'over_budget' && (issue.overflowMin ?? 0) <= 30) {
    const result = tryCompressBuffers(itinerary, dayIndex, context.zoneConfig);
    if (result.changed) return result;
  }

  // 5. DROP lowest-utility activity
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
 * Strategy 3: Shrink activity durations
 */
function tryShrink(
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
      const maxShrink = candidate.durationExpected - candidate.durationMin;
      const actualShrink = Math.min(targetShrink, maxShrink, 30); // Max 30 min shrink

      if (actualShrink > 0) {
        shrunkAmount = actualShrink;
        return {
          ...slot,
          duration: slot.duration - actualShrink,
          endMin: slot.endMin - actualShrink,
        };
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
