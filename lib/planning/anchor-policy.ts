/**
 * Anchor Policy
 *
 * Defines anchor selection and scheduling rules.
 * Anchors are top iconic POIs that must be prioritized in the itinerary.
 *
 * Eligibility: reviewCount >= threshold OR iconicScore >= threshold
 * Selection: Ranked by iconicScore, then reviewCount, capped at maxAnchorsTotalDefault
 */

import {
  AnchorPolicy,
  AnchorCandidateRaw,
  AnchorSelectionResult,
  EnrichedCandidateRaw,
  InfeasibilityReasonCode,
  ICONIC_SCORE_WEIGHTS,
  CATEGORY_PRIORS,
} from '../types/optimizer-v3';
import { OptimizerV3Config, DEFAULT_OPTIMIZER_V3_CONFIG } from '../config/optimizer-config';

// =============================================================================
// ICONIC SCORE COMPUTATION
// =============================================================================

/**
 * Normalize review count to 0-1 using log scale.
 * Capped at 100k reviews.
 */
function normalizeReviewCount(reviewCount: number): number {
  const capped = Math.min(reviewCount, 100000);
  if (capped <= 0) return 0;
  // Log scale: log10(100000) ≈ 5, so divide by 5
  return Math.min(1, Math.log10(capped + 1) / 5);
}

/**
 * Normalize rating to 0-1.
 * Rating is 1-5, so (rating - 1) / 4
 */
function normalizeRating(rating: number): number {
  if (rating <= 0) return 0.64; // Default to 4.2 normalized
  return Math.min(1, Math.max(0, (rating - 1) / 4));
}

/**
 * Get category prior weight.
 */
function getCategoryPrior(category: string): number {
  return CATEGORY_PRIORS[category] ?? 0.5;
}

/**
 * Compute iconic score for a candidate.
 * Score is in range [0, 1].
 *
 * Formula:
 * iconicScore = w1 * normalize(reviewCount) + w2 * normalize(rating) + w3 * categoryPrior + w4 * normalize(globalPopularityRank)
 */
export function computeIconicScore(candidate: {
  reviewCount: number;
  rating: number;
  category: string;
  globalPopularityRank?: number;
}): number {
  const reviewScore = normalizeReviewCount(candidate.reviewCount);
  const ratingScore = normalizeRating(candidate.rating);
  const categoryPrior = getCategoryPrior(candidate.category);

  // Global popularity rank: if missing, treat as median (0.5)
  // Lower rank = more popular, so invert: 1 - (rank / maxRank)
  const popularityScore = candidate.globalPopularityRank !== undefined
    ? Math.max(0, 1 - candidate.globalPopularityRank / 100)
    : 0.5;

  const score =
    ICONIC_SCORE_WEIGHTS.reviewCount * reviewScore +
    ICONIC_SCORE_WEIGHTS.rating * ratingScore +
    ICONIC_SCORE_WEIGHTS.categoryPrior * categoryPrior +
    ICONIC_SCORE_WEIGHTS.globalPopularityRank * popularityScore;

  // Clamp to [0, 1]
  return Math.min(1, Math.max(0, score));
}

// =============================================================================
// ANCHOR ELIGIBILITY
// =============================================================================

/**
 * Check if a candidate is eligible to be an anchor.
 * Eligibility: reviewCount >= threshold OR iconicScore >= threshold
 */
export function isAnchorEligible(
  candidate: EnrichedCandidateRaw,
  config: OptimizerV3Config = DEFAULT_OPTIMIZER_V3_CONFIG
): boolean {
  return (
    candidate.reviewCount >= config.anchorReviewCountThreshold ||
    candidate.iconicScore >= config.anchorIconicScoreThreshold
  );
}

// =============================================================================
// ANCHOR SELECTION
// =============================================================================

/**
 * Select anchors from candidates.
 *
 * Selection rules:
 * 1. Filter to eligible candidates
 * 2. Sort by iconicScore (desc), then reviewCount (desc) as tie-breaker
 * 3. Apply diversity targets (try to cover multiple categories)
 * 4. Cap at maxAnchorsTotalDefault
 *
 * Returns ranked anchors and any infeasible anchors.
 */
export function selectAnchors(
  candidates: EnrichedCandidateRaw[],
  policy: AnchorPolicy,
  config: OptimizerV3Config = DEFAULT_OPTIMIZER_V3_CONFIG
): AnchorSelectionResult {
  // Filter to eligible candidates
  const eligible = candidates.filter(c => isAnchorEligible(c, config));

  // Sort by iconicScore (desc), then reviewCount (desc)
  const sorted = [...eligible].sort((a, b) => {
    if (b.iconicScore !== a.iconicScore) {
      return b.iconicScore - a.iconicScore;
    }
    return b.reviewCount - a.reviewCount;
  });

  // Apply diversity targets
  const selected: AnchorCandidateRaw[] = [];
  const selectedCategories = new Set<string>();
  const targetCategories = new Set(policy.diversityTargets.categories);

  // First pass: select one from each target category
  for (const category of targetCategories) {
    const candidate = sorted.find(
      c => c.category === category && !selected.some(s => s.rawId === c.rawId)
    );
    if (candidate && selected.length < config.maxAnchorsTotalDefault) {
      selected.push(toAnchorCandidate(candidate));
      selectedCategories.add(category);
    }
  }

  // Second pass: fill remaining slots with highest-scoring candidates
  for (const candidate of sorted) {
    if (selected.length >= config.maxAnchorsTotalDefault) break;
    if (selected.some(s => s.rawId === candidate.rawId)) continue;

    selected.push(toAnchorCandidate(candidate));
    selectedCategories.add(candidate.category);
  }

  // Check diversity coverage
  const categoryCoverage = selectedCategories.size / targetCategories.size;
  if (categoryCoverage < policy.diversityTargets.minCategoryCoverage) {
    console.warn(
      `[AnchorPolicy] Category coverage ${(categoryCoverage * 100).toFixed(0)}% ` +
      `below target ${(policy.diversityTargets.minCategoryCoverage * 100).toFixed(0)}%`
    );
  }

  // Identify infeasible anchors (eligible but not selected due to cap)
  const infeasibleAnchors: AnchorSelectionResult['infeasibleAnchors'] = [];
  if (eligible.length > config.maxAnchorsTotalDefault) {
    const notSelected = eligible.filter(
      c => !selected.some(s => s.rawId === c.rawId)
    );
    // Only mark as infeasible if they would have been selected without cap
    // (i.e., they're in the top N by score)
    for (const candidate of notSelected.slice(0, 5)) {
      infeasibleAnchors.push({
        rawId: candidate.rawId,
        reasonCode: InfeasibilityReasonCode.EXCEEDS_ALL_DAY_BUDGETS,
      });
    }
  }

  return {
    anchors: selected,
    infeasibleAnchors,
  };
}

/**
 * Convert enriched candidate to anchor candidate.
 */
function toAnchorCandidate(candidate: EnrichedCandidateRaw): AnchorCandidateRaw {
  return {
    rawId: candidate.rawId,
    name: candidate.name,
    iconicScore: candidate.iconicScore,
    reviewCount: candidate.reviewCount,
    rating: candidate.rating,
    category: candidate.category,
    location: candidate.location,
  };
}

// =============================================================================
// ANCHOR POLICY HELPERS
// =============================================================================

/**
 * Create default anchor policy for a trip.
 */
export function createAnchorPolicy(
  numDays: number,
  config: OptimizerV3Config = DEFAULT_OPTIMIZER_V3_CONFIG
): AnchorPolicy {
  // Scale anchors with trip length
  const minTotal = Math.max(1, Math.floor(numDays * 0.8));
  const maxTotal = Math.min(config.maxAnchorsTotalDefault, numDays * 2);

  return {
    minTotalAnchors: Math.min(minTotal, maxTotal),
    minAnchorsPerDay: 1,
    maxAnchorsPerDay: 3,
    diversityTargets: {
      categories: ['landmark', 'museum', 'park', 'temple', 'beach', 'monument'],
      minCategoryCoverage: 0.5,
    },
  };
}

/**
 * Validate anchor policy against config.
 * Returns clamped policy if needed.
 */
export function validateAnchorPolicy(
  policy: AnchorPolicy,
  config: OptimizerV3Config = DEFAULT_OPTIMIZER_V3_CONFIG
): { policy: AnchorPolicy; clamped: boolean; message?: string } {
  if (policy.minTotalAnchors > config.maxAnchorsTotalDefault) {
    return {
      policy: {
        ...policy,
        minTotalAnchors: config.maxAnchorsTotalDefault,
      },
      clamped: true,
      message: `minTotalAnchors (${policy.minTotalAnchors}) > maxAnchorsTotalDefault (${config.maxAnchorsTotalDefault}), clamped`,
    };
  }

  return { policy, clamped: false };
}

/**
 * Check if anchor coverage meets policy requirements.
 */
export function checkAnchorCoverage(
  scheduledAnchors: number,
  numDays: number,
  policy: AnchorPolicy,
  config: OptimizerV3Config = DEFAULT_OPTIMIZER_V3_CONFIG
): {
  meetsMinTotal: boolean;
  meetsPerDayCoverage: boolean;
  coverage: number;
} {
  const meetsMinTotal = scheduledAnchors >= policy.minTotalAnchors;

  // Per-day coverage: at least minAnchorsPerDayCoverage fraction of days have an anchor
  // This is checked during scheduling, here we just check total
  const expectedDaysWithAnchor = Math.ceil(numDays * config.minAnchorsPerDayCoverage);
  const meetsPerDayCoverage = scheduledAnchors >= expectedDaysWithAnchor;

  return {
    meetsMinTotal,
    meetsPerDayCoverage,
    coverage: scheduledAnchors / numDays,
  };
}
