# Requirements: Itinerary Quality Gates

## Overview
Implement minimal-diff, architecture-consistent changes to fix quality issues in the Wandr AI itinerary planner without rewriting the 4-agent pipeline (Parser → Researcher → Optimizer → Narrator).

## Problem Statement
The current itinerary generation has three critical quality issues:
1. **Duplicate POIs** - Meal scheduling is blind to "used" sets, causing the same venue to appear multiple times
2. **Invalid Meal Venues** - Markets, bazaars, and non-restaurant establishments are being selected as meal venues
3. **Realism Regressions** - Repair SHRINK can violate category minimum durations (e.g., 30 min at a zoo)

## User Stories

### US-1: Unified Used Tracking
As a trip planner, I want a single source of truth for tracking used candidates across the entire trip, so that no venue appears more than once in the itinerary.

**Acceptance Criteria:**
- 1.1 A TripLedger class tracks used candidates by both `id` and `dedupKey`
- 1.2 The ledger supports checking for near-duplicates (similar name + close location)
- 1.3 Activities are marked as used BEFORE meal scheduling occurs (critical ordering)
- 1.4 The ledger is passed to meal scheduler to filter out already-used restaurants
- 1.5 Backward compatibility is maintained via `fromSets()` static method

### US-2: Restaurant Validation
As a trip planner, I want meal venues to be actual restaurants or cafes, so that users aren't directed to markets, temples, or other non-food establishments for meals.

**Acceptance Criteria:**
- 2.1 Markets, bazaars, and shopping areas are excluded from meal venues by default
- 2.2 Religious sites (temples, churches, mosques) are never valid meal venues
- 2.3 Tourist attractions that happen to serve food are excluded
- 2.4 A policy flag `allowFoodMarkets` can override market exclusion when desired
- 2.5 Quality thresholds (min rating, min reviews) can be configured
- 2.6 Rejection reasons are available for debugging

### US-3: Duplicate Assertion
As a developer, I want to assert that no duplicates exist in the final itinerary, so that quality issues are caught before delivery.

**Acceptance Criteria:**
- 3.1 Within-day duplicates are detected (same venue twice in one day)
- 3.2 Cross-day duplicates are detected (same venue on different days)
- 3.3 Detection works by id, dedupKey, and near-duplicate matching
- 3.4 Detailed error reporting includes day/slot info for debugging
- 3.5 Assertion logs warnings but doesn't hard-fail the pipeline

### US-4: Realistic Duration Repair
As a trip planner, I want the repair engine to respect category minimum durations, so that itineraries remain realistic (no 30-minute zoo visits).

**Acceptance Criteria:**
- 4.1 SHRINK repair never reduces below category minimum duration
- 4.2 Category minimums are derived from DURATION_PRIORS when available
- 4.3 Fallback minimums exist for categories not in DURATION_PRIORS
- 4.4 Shrink operations log the category minimum being respected

### US-5: Anchor Recovery
As a trip planner, I want days without anchor attractions to attempt recovery, so that each day has at least one high-quality highlight.

**Acceptance Criteria:**
- 5.1 Anchor is defined as reviewCount >= 30k OR isBigRock
- 5.2 If day lacks anchor, attempt to swap in one from backup pool
- 5.3 Prefer same-zone anchors, fall back to cross-zone if needed
- 5.4 Swap out lowest-utility non-anchor activity
- 5.5 This is a soft gate - don't hard-fail if no anchor available

## Constraints

### Architecture Constraints
- MUST NOT rewrite the 4-agent pipeline (Parser → Researcher → Optimizer → Narrator)
- Changes must be minimal-diff and architecture-consistent
- Only add thin "gates" and shared utilities

### Technical Constraints
- All new modules must be TypeScript with proper type exports
- Backward compatibility must be maintained for existing function signatures
- Deprecated functions should delegate to new implementations

## Dependencies
- `lib/planning/types.ts` - EnrichedCandidate, DayTimeline, TimelineSlot types
- `lib/utils/dedup.ts` - areNearDuplicates function
- `lib/planning/route-optimizer.ts` - buildTravelMatrix, orderDayRoute functions
