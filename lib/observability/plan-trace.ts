/**
 * PlanTrace - Observability for Optimizer v3
 *
 * Structured trace data for debugging itinerary planning decisions.
 * Persisted to runs/<runId>/plan_trace.json for post-hoc analysis.
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  PlanTrace,
  PlanTraceConfigConflict,
  DropReasonCode,
  RepairActionCode,
  InfeasibilityReasonCode,
  TravelValidationExceptionCode,
  FeasibilityViolationType,
  CanonicalPlaceId,
  RawPlaceId,
} from '../types/optimizer-v3';
import { isFeatureEnabled } from '../config/feature-flags';

// =============================================================================
// RUN ID GENERATION
// =============================================================================

/**
 * Generate a unique run ID.
 * Format: timestamp_random (e.g., 20260117_143052_a1b2c3)
 */
export function generateRunId(): string {
  const now = new Date();
  const timestamp = now.toISOString()
    .replace(/[-:T]/g, '')
    .slice(0, 14);
  const random = Math.random().toString(36).substring(2, 8);
  return `${timestamp}_${random}`;
}

// =============================================================================
// PLAN TRACE BUILDER
// =============================================================================

/**
 * Builder class for constructing PlanTrace incrementally.
 */
export class PlanTraceBuilder {
  private trace: PlanTrace;

  constructor(runId?: string) {
    this.trace = {
      runId: runId || generateRunId(),
      timestamp: new Date().toISOString(),

      config: {
        conflicts: [],
      },

      retrieval: {
        totalCandidates: 0,
        afterFilters: 0,
        afterDedup: 0,
        afterPruning: 0,
        anchorsSelected: 0,
        anchorsInfeasible: 0,
      },

      pruning: {
        droppedCount: 0,
        droppedByCategory: {},
        droppedByGeohash: {},
        droppedTopExamples: [],
      },

      idMapping: {
        missingRawIds: [],
      },

      anchors: {
        selected: [],
        dropped: [],
        infeasible: [],
      },

      zoning: {
        method: 'kmeans',
        zoneCount: 0,
        zoneDiameters: {},
        zoneLoads: {},
        validationPassed: true,
        fallbackUsed: false,
        pinnedCandidates: {},
      },

      optimization: {
        perDay: [],
      },

      feasibility: {
        violations: [],
        repairs: [],
        finalStatus: 'pass',
      },

      travelMetrics: {
        legsValidated: 0,
        legsRequested: 0,
        validationExceptions: [],
        estimatedVsRealDeltas: [],
      },
    };
  }

  // -------------------------------------------------------------------------
  // Config Logging
  // -------------------------------------------------------------------------

  logConfigConflict(conflict: PlanTraceConfigConflict): void {
    this.trace.config!.conflicts.push(conflict);
  }

  logConfigConflicts(conflicts: PlanTraceConfigConflict[]): void {
    this.trace.config!.conflicts.push(...conflicts);
  }

  // -------------------------------------------------------------------------
  // Retrieval Logging
  // -------------------------------------------------------------------------

  logRetrieval(stats: Partial<PlanTrace['retrieval']>): void {
    Object.assign(this.trace.retrieval, stats);
  }

  // -------------------------------------------------------------------------
  // Pruning Logging
  // -------------------------------------------------------------------------

  logPruning(stats: Partial<PlanTrace['pruning']>): void {
    Object.assign(this.trace.pruning, stats);
  }

  logPrunedCandidate(
    id: string,
    name: string,
    reasonCode: DropReasonCode,
    category?: string,
    geohash?: string
  ): void {
    this.trace.pruning.droppedCount++;

    if (category) {
      this.trace.pruning.droppedByCategory[category] =
        (this.trace.pruning.droppedByCategory[category] || 0) + 1;
    }

    if (geohash) {
      this.trace.pruning.droppedByGeohash[geohash] =
        (this.trace.pruning.droppedByGeohash[geohash] || 0) + 1;
    }

    // Keep top 10 examples
    if (this.trace.pruning.droppedTopExamples.length < 10) {
      this.trace.pruning.droppedTopExamples.push({ id, name, reasonCode });
    }
  }

  // -------------------------------------------------------------------------
  // ID Mapping Logging
  // -------------------------------------------------------------------------

  logIdMappingFailure(
    rawId: RawPlaceId,
    source: 'mustInclude' | 'avoidInclude',
    reason: 'RAW_ID_NOT_FOUND' | 'FETCH_FAILED'
  ): void {
    this.trace.idMapping.missingRawIds.push({ rawId, source, reason });
  }

  // -------------------------------------------------------------------------
  // Anchor Logging
  // -------------------------------------------------------------------------

  logAnchorSelected(canonicalId: CanonicalPlaceId, name: string, iconicScore: number): void {
    this.trace.anchors.selected.push({ canonicalId, name, iconicScore });
    this.trace.retrieval.anchorsSelected++;
  }

  logAnchorDropped(canonicalId: CanonicalPlaceId, name: string, reasonCode: DropReasonCode): void {
    this.trace.anchors.dropped.push({ canonicalId, name, reasonCode });
  }

  logAnchorInfeasible(
    canonicalId: CanonicalPlaceId,
    name: string,
    reasonCode: InfeasibilityReasonCode
  ): void {
    this.trace.anchors.infeasible.push({ canonicalId, name, reasonCode });
    this.trace.retrieval.anchorsInfeasible++;
  }

  // -------------------------------------------------------------------------
  // Zoning Logging
  // -------------------------------------------------------------------------

  logZoning(stats: Partial<PlanTrace['zoning']>): void {
    Object.assign(this.trace.zoning, stats);
  }

  logZoneDiameter(zoneId: number, diameterKm: number): void {
    this.trace.zoning.zoneDiameters[zoneId] = diameterKm;
  }

  logZoneLoad(zoneId: number, poiCount: number, plannedMinutes: number): void {
    this.trace.zoning.zoneLoads[zoneId] = { poiCount, plannedMinutes };
  }

  logPinnedCandidate(canonicalId: CanonicalPlaceId, type: 'anchor' | 'big_rock'): void {
    this.trace.zoning.pinnedCandidates[canonicalId] = type;
  }

  // -------------------------------------------------------------------------
  // Optimization Logging
  // -------------------------------------------------------------------------

  logOptimization(
    dayIndex: number,
    selected: Array<{ id: CanonicalPlaceId; name: string }>,
    dropped: Array<{ id: CanonicalPlaceId; name: string; reasonCode: DropReasonCode }>,
    mealPlaceholder: { included: boolean; omittedReason?: string }
  ): void {
    this.trace.optimization.perDay.push({
      dayIndex,
      selected,
      dropped,
      mealPlaceholderIncluded: mealPlaceholder.included,
      mealPlaceholderOmittedReason: mealPlaceholder.omittedReason,
    });
  }

  logSelectedCandidate(dayIndex: number, id: CanonicalPlaceId, name: string): void {
    const dayEntry = this.getOrCreateDayEntry(dayIndex);
    dayEntry.selected.push({ id, name });
  }

  logDroppedCandidate(
    dayIndex: number,
    id: CanonicalPlaceId,
    name: string,
    reasonCode: DropReasonCode
  ): void {
    const dayEntry = this.getOrCreateDayEntry(dayIndex);
    dayEntry.dropped.push({ id, name, reasonCode });
  }

  private getOrCreateDayEntry(dayIndex: number) {
    let entry = this.trace.optimization.perDay.find(d => d.dayIndex === dayIndex);
    if (!entry) {
      entry = {
        dayIndex,
        selected: [],
        dropped: [],
        mealPlaceholderIncluded: false,
      };
      this.trace.optimization.perDay.push(entry);
    }
    return entry;
  }

  // -------------------------------------------------------------------------
  // Feasibility Logging
  // -------------------------------------------------------------------------

  logFeasibilityViolation(
    dayIndex: number,
    type: FeasibilityViolationType,
    message: string
  ): void {
    this.trace.feasibility.violations.push({ dayIndex, type, message });
  }

  logRepair(dayIndex: number, actionCode: RepairActionCode, details: string): void {
    this.trace.feasibility.repairs.push({ dayIndex, actionCode, details });
  }

  setFeasibilityStatus(status: 'pass' | 'fail'): void {
    this.trace.feasibility.finalStatus = status;
  }

  // -------------------------------------------------------------------------
  // Travel Metrics Logging
  // -------------------------------------------------------------------------

  logTravelValidation(legsValidated: number, legsRequested: number): void {
    this.trace.travelMetrics.legsValidated = legsValidated;
    this.trace.travelMetrics.legsRequested = legsRequested;
  }

  logTravelValidationException(code: TravelValidationExceptionCode): void {
    this.trace.travelMetrics.validationExceptions.push(code);
  }

  logTravelDelta(
    dayIndex: number,
    fromCanonicalId: CanonicalPlaceId,
    toCanonicalId: CanonicalPlaceId,
    estimated: number,
    real: number
  ): void {
    this.trace.travelMetrics.estimatedVsRealDeltas.push({
      dayIndex,
      fromCanonicalId,
      toCanonicalId,
      estimated,
      real,
      delta: real - estimated,
    });
  }

  // -------------------------------------------------------------------------
  // Build & Persist
  // -------------------------------------------------------------------------

  build(): PlanTrace {
    return { ...this.trace };
  }

  getRunId(): string {
    return this.trace.runId;
  }

  /**
   * Persist trace to runs/<runId>/plan_trace.json
   */
  async persist(): Promise<void> {
    if (!isFeatureEnabled('ENABLE_PLAN_TRACE_PERSISTENCE')) {
      console.log(`[PlanTrace] Persistence disabled, skipping write for ${this.trace.runId}`);
      return;
    }

    try {
      const runsDir = path.join(process.cwd(), 'runs', this.trace.runId);
      await fs.promises.mkdir(runsDir, { recursive: true });

      const tracePath = path.join(runsDir, 'plan_trace.json');
      await fs.promises.writeFile(tracePath, JSON.stringify(this.trace, null, 2));

      console.log(`[PlanTrace] Persisted to ${tracePath}`);

      // Cleanup old traces
      await PlanTraceBuilder.cleanupOldTraces(50);
    } catch (error) {
      console.error(`[PlanTrace] Failed to persist: ${error}`);
      // Don't throw - persistence failure shouldn't break the pipeline
    }
  }

  /**
   * Cleanup old traces to enforce retention limit.
   * Keeps most recent N traces by timestamp.
   */
  static async cleanupOldTraces(retentionCount: number): Promise<void> {
    try {
      const runsDir = path.join(process.cwd(), 'runs');

      // Check if runs directory exists
      try {
        await fs.promises.access(runsDir);
      } catch {
        return; // No runs directory, nothing to clean
      }

      const entries = await fs.promises.readdir(runsDir, { withFileTypes: true });
      const runDirs = entries.filter(e => e.isDirectory()).map(e => e.name);

      if (runDirs.length <= retentionCount) {
        return; // Under limit, nothing to clean
      }

      // Sort by timestamp (runId format: YYYYMMDDHHMMSS_random)
      runDirs.sort((a, b) => b.localeCompare(a)); // Descending (newest first)

      // Delete oldest runs beyond retention limit
      const toDelete = runDirs.slice(retentionCount);
      for (const runId of toDelete) {
        const runPath = path.join(runsDir, runId);
        await fs.promises.rm(runPath, { recursive: true, force: true });
        console.log(`[PlanTrace] Cleaned up old trace: ${runId}`);
      }
    } catch (error) {
      console.error(`[PlanTrace] Cleanup failed: ${error}`);
      // Don't throw - cleanup failure shouldn't break the pipeline
    }
  }
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Load a PlanTrace from disk.
 */
export async function loadPlanTrace(runId: string): Promise<PlanTrace | null> {
  try {
    const tracePath = path.join(process.cwd(), 'runs', runId, 'plan_trace.json');
    const content = await fs.promises.readFile(tracePath, 'utf-8');
    return JSON.parse(content) as PlanTrace;
  } catch {
    return null;
  }
}

/**
 * List all available run IDs.
 */
export async function listRunIds(): Promise<string[]> {
  try {
    const runsDir = path.join(process.cwd(), 'runs');
    const entries = await fs.promises.readdir(runsDir, { withFileTypes: true });
    return entries
      .filter(e => e.isDirectory())
      .map(e => e.name)
      .sort((a, b) => b.localeCompare(a)); // Newest first
  } catch {
    return [];
  }
}
