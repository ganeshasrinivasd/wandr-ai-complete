/**
 * Feasibility Checker
 *
 * Validates day timelines against constraints:
 * - Budget (total time) limits
 * - Travel time limits (per-segment and daily)
 * - Anchor presence
 * - Meal presence
 * - Cross-zone violations
 */

import {
  DayTimeline,
  FeasibilityReport,
  FeasibilityIssue,
  RepairAction,
  ZoneConfig,
  DEFAULT_ZONE_CONFIG,
  EnrichedCandidate,
} from '../planning/types';

// =============================================================================
// MAIN FEASIBILITY CHECK
// =============================================================================

/**
 * Check feasibility of a single day timeline
 */
export function checkDayFeasibility(
  timeline: DayTimeline,
  dayBudgetMin: number,
  config: ZoneConfig = DEFAULT_ZONE_CONFIG
): FeasibilityReport {
  const issues: FeasibilityIssue[] = [];

  // Calculate total budget used
  const totalUsed =
    timeline.totalActivityMin +
    timeline.totalTravelMin +
    timeline.totalMealMin +
    timeline.totalBufferMin;

  // Check 1: Total budget
  if (totalUsed > dayBudgetMin) {
    const overflow = totalUsed - dayBudgetMin;
    issues.push({
      type: 'over_budget',
      severity: overflow > 60 ? 'error' : 'warning',
      dayIndex: timeline.dayIndex,
      message: `Day ${timeline.dayIndex + 1} exceeds budget by ${overflow} min (${totalUsed}/${dayBudgetMin})`,
      overflowMin: overflow,
      suggestedRepair:
        overflow <= 30
          ? { type: 'compress_buffer', newBufferMin: Math.max(5, timeline.totalBufferMin - overflow) }
          : { type: 'drop', candidateId: findLowestUtilityActivity(timeline) },
    });
  }

  // Check 2: Daily travel time
  if (timeline.totalTravelMin > config.maxDailyTravelMin) {
    issues.push({
      type: 'excessive_travel',
      severity: 'warning',
      dayIndex: timeline.dayIndex,
      message: `Day ${timeline.dayIndex + 1} has ${timeline.totalTravelMin} min travel (max: ${config.maxDailyTravelMin})`,
      suggestedRepair: { type: 'reorder' },
    });
  }

  // Check 3: Per-segment travel time
  for (let i = 0; i < timeline.slots.length; i++) {
    const slot = timeline.slots[i];
    if (slot.type === 'travel' && slot.duration > config.maxConsecutiveTravelMin) {
      issues.push({
        type: 'excessive_travel',
        severity: 'warning',
        dayIndex: timeline.dayIndex,
        message: `Travel segment of ${slot.duration} min exceeds limit (${config.maxConsecutiveTravelMin} min)`,
        suggestedRepair: { type: 'reorder' },
      });
    }
  }

  // Check 4: Has anchor (non big-rock days)
  if (!timeline.isBigRockDay) {
    const hasAnchor = timeline.slots.some(
      s =>
        s.type === 'activity' &&
        s.candidate &&
        (s.candidate.reviewCount > 30000 || s.candidate.isBigRock)
    );

    if (!hasAnchor) {
      // CHANGED: Missing anchor is now a warning that triggers repair
      // Previously was informational only, now triggers Anchor Recovery
      issues.push({
        type: 'missing_anchor',
        severity: 'warning', // Warning triggers repair in repair engine
        dayIndex: timeline.dayIndex,
        message: `Day ${timeline.dayIndex + 1} lacks a major anchor attraction (triggers Anchor Recovery)`,
      });
    }
  }

  // Check 5: Has meals
  const mealCount = timeline.slots.filter(s => s.type === 'meal').length;
  if (mealCount < 2) {
    issues.push({
      type: 'missing_meal',
      severity: 'warning',
      dayIndex: timeline.dayIndex,
      message: `Day ${timeline.dayIndex + 1} has only ${mealCount} meal slot(s) (expected 2)`,
    });
  }

  // Check 6: Cross-zone violations
  const crossZoneCandidates = timeline.slots
    .filter(
      s =>
        s.type === 'activity' &&
        s.candidate &&
        s.candidate.zoneId !== undefined &&
        s.candidate.zoneId !== timeline.zoneId
    )
    .map(s => s.candidate!.name);

  if (crossZoneCandidates.length > 0) {
    issues.push({
      type: 'cross_zone',
      severity: 'warning',
      dayIndex: timeline.dayIndex,
      message: `Day ${timeline.dayIndex + 1} has cross-zone activities: ${crossZoneCandidates.join(', ')}`,
      suggestedRepair: {
        type: 'swap',
        candidateOut: crossZoneCandidates[0],
        candidateIn: '',
      },
    });
  }

  // Build day summary
  const activityCount = timeline.slots.filter(s => s.type === 'activity').length;
  const hasAnchor = timeline.slots.some(
    s => s.type === 'activity' && s.candidate && s.candidate.reviewCount > 30000
  );

  return {
    isValid: issues.filter(i => i.severity === 'error').length === 0,
    issues,
    perDaySummary: [
      {
        dayIndex: timeline.dayIndex,
        budgetUsed: totalUsed,
        travelMin: timeline.totalTravelMin,
        activityCount,
        hasAnchor,
      },
    ],
  };
}

/**
 * Check feasibility of an entire itinerary
 */
export function checkItineraryFeasibility(
  timelines: DayTimeline[],
  dayBudgetMin: number,
  config: ZoneConfig = DEFAULT_ZONE_CONFIG
): FeasibilityReport {
  const allIssues: FeasibilityIssue[] = [];
  const perDaySummary: FeasibilityReport['perDaySummary'] = [];

  for (const timeline of timelines) {
    const dayReport = checkDayFeasibility(timeline, dayBudgetMin, config);
    allIssues.push(...dayReport.issues);
    perDaySummary.push(...dayReport.perDaySummary);
  }

  // Check cross-day issues
  const bigRockDays = timelines.filter(t => t.isBigRockDay);
  if (bigRockDays.length > timelines.length / 2) {
    allIssues.push({
      type: 'over_budget',
      severity: 'warning',
      dayIndex: -1,
      message: `Too many big-rock days (${bigRockDays.length}/${timelines.length}), trip may feel rushed`,
    });
  }

  return {
    isValid: allIssues.filter(i => i.severity === 'error').length === 0,
    issues: allIssues,
    perDaySummary,
  };
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Find the lowest-utility activity that can be dropped
 */
function findLowestUtilityActivity(timeline: DayTimeline): string {
  const activities = timeline.slots
    .filter(s => s.type === 'activity' && s.candidate)
    .map(s => s.candidate!)
    .filter(c => !c.isBigRock); // Don't drop big rocks

  if (activities.length === 0) return '';

  // Sort by utility (lowest first)
  activities.sort((a, b) => a.utilityScore - b.utilityScore);

  return activities[0].id;
}

/**
 * Find activity that can be shrunk
 */
export function findShrinkableActivity(timeline: DayTimeline): string {
  const activities = timeline.slots
    .filter(s => s.type === 'activity' && s.candidate)
    .map(s => s.candidate!)
    .filter(c => !c.isBigRock && c.durationExpected > c.durationMin);

  if (activities.length === 0) return '';

  // Sort by utility (lowest first = most shrinkable)
  activities.sort((a, b) => a.utilityScore - b.utilityScore);

  return activities[0].id;
}

/**
 * Find activity that can be dropped
 */
export function findDroppableActivity(timeline: DayTimeline): string {
  const activities = timeline.slots
    .filter(s => s.type === 'activity' && s.candidate)
    .map(s => s.candidate!)
    .filter(c => !c.isBigRock && c.reviewCount < 30000);

  if (activities.length === 0) return '';

  // Sort by utility (lowest first)
  activities.sort((a, b) => a.utilityScore - b.utilityScore);

  return activities[0].id;
}

// =============================================================================
// FEASIBILITY SCORING
// =============================================================================

/**
 * Calculate a feasibility score (0-100) for a timeline
 * Higher = more feasible
 */
export function calculateFeasibilityScore(
  timeline: DayTimeline,
  dayBudgetMin: number,
  config: ZoneConfig = DEFAULT_ZONE_CONFIG
): number {
  let score = 100;

  const totalUsed =
    timeline.totalActivityMin +
    timeline.totalTravelMin +
    timeline.totalMealMin +
    timeline.totalBufferMin;

  // Budget penalty: -1 point per minute over budget, -0.5 per minute near limit
  if (totalUsed > dayBudgetMin) {
    score -= (totalUsed - dayBudgetMin) * 1;
  } else if (totalUsed > dayBudgetMin * 0.95) {
    score -= (totalUsed - dayBudgetMin * 0.95) * 0.5;
  }

  // Travel penalty: -0.5 per minute over limit
  if (timeline.totalTravelMin > config.maxDailyTravelMin) {
    score -= (timeline.totalTravelMin - config.maxDailyTravelMin) * 0.5;
  }

  // Anchor bonus
  const hasAnchor = timeline.slots.some(
    s => s.type === 'activity' && s.candidate && s.candidate.reviewCount > 30000
  );
  if (!hasAnchor && !timeline.isBigRockDay) {
    score -= 10;
  }

  // Meal bonus
  const mealCount = timeline.slots.filter(s => s.type === 'meal').length;
  if (mealCount < 2) {
    score -= (2 - mealCount) * 5;
  }

  return Math.max(0, Math.min(100, score));
}

// =============================================================================
// ISSUE PRIORITIZATION
// =============================================================================

/**
 * Get the most critical issue from a feasibility report
 */
export function getMostCriticalIssue(
  report: FeasibilityReport
): FeasibilityIssue | null {
  if (report.issues.length === 0) return null;

  // Errors first
  const errors = report.issues.filter(i => i.severity === 'error');
  if (errors.length > 0) {
    // Prioritize by overflow amount
    return errors.sort((a, b) => (b.overflowMin ?? 0) - (a.overflowMin ?? 0))[0];
  }

  // Then warnings by type priority
  const typePriority: Record<FeasibilityIssue['type'], number> = {
    over_budget: 4,
    excessive_travel: 3,
    cross_zone: 2,
    missing_anchor: 1,
    missing_meal: 1,
  };

  return report.issues.sort(
    (a, b) => typePriority[b.type] - typePriority[a.type]
  )[0];
}

/**
 * Group issues by day
 */
export function groupIssuesByDay(
  report: FeasibilityReport
): Map<number, FeasibilityIssue[]> {
  const grouped = new Map<number, FeasibilityIssue[]>();

  for (const issue of report.issues) {
    const dayIssues = grouped.get(issue.dayIndex) || [];
    dayIssues.push(issue);
    grouped.set(issue.dayIndex, dayIssues);
  }

  return grouped;
}

// =============================================================================
// CONSTRAINT CHECKING
// =============================================================================

/**
 * Check if adding an activity would violate constraints
 */
export function wouldViolateConstraints(
  timeline: DayTimeline,
  candidate: EnrichedCandidate,
  additionalTravelMin: number,
  dayBudgetMin: number,
  config: ZoneConfig = DEFAULT_ZONE_CONFIG
): { wouldViolate: boolean; reason?: string } {
  const newTotal =
    timeline.totalActivityMin +
    candidate.durationExpected +
    timeline.totalTravelMin +
    additionalTravelMin +
    timeline.totalMealMin +
    timeline.totalBufferMin +
    15; // Buffer for new activity

  // Check budget
  if (newTotal > dayBudgetMin) {
    return {
      wouldViolate: true,
      reason: `Would exceed budget by ${newTotal - dayBudgetMin} min`,
    };
  }

  // Check travel
  if (additionalTravelMin > config.maxConsecutiveTravelMin) {
    return {
      wouldViolate: true,
      reason: `Travel time ${additionalTravelMin} min exceeds limit`,
    };
  }

  const newTotalTravel = timeline.totalTravelMin + additionalTravelMin;
  if (newTotalTravel > config.maxDailyTravelMin) {
    return {
      wouldViolate: true,
      reason: `Total travel ${newTotalTravel} min would exceed limit`,
    };
  }

  // Check cross-zone
  if (candidate.zoneId !== undefined && candidate.zoneId !== timeline.zoneId) {
    return {
      wouldViolate: true,
      reason: `Would cross into zone ${candidate.zoneId}`,
    };
  }

  // Check big rock rules
  if (timeline.isBigRockDay) {
    const nonBigRockActivities = timeline.slots.filter(
      s => s.type === 'activity' && s.candidate && !s.candidate.isBigRock
    ).length;

    if (nonBigRockActivities >= 1 && !candidate.isBigRock) {
      return {
        wouldViolate: true,
        reason: 'Big rock day already has max additional activities',
      };
    }
  }

  return { wouldViolate: false };
}
