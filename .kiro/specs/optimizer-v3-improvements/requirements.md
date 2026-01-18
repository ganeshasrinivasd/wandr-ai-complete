# Requirements Document

## Introduction

This document specifies requirements for the WANDR AI Optimizer v3 improvements. The goal is to produce iconic/quality itinerary plans with geographically coherent days, feasible schedules, consistent deduplication, and better debuggability while maintaining the existing 4-agent pipeline architecture (Parser → Researcher → Optimizer → Storyteller).

## Glossary

- **Anchor**: A top iconic POI meeting anchor eligibility criteria (reviewCount >= 10000 OR iconicScore >= 0.7 OR in curated top list)
- **Anchor_Policy**: Configuration object defining minimum/maximum anchors per day and diversity targets
- **Big_Rock**: A full-day attraction with durationMinutes >= 180 (theme park, zoo, major museum)
- **Canonical_Place_Registry**: Single source of truth for deduplicated place records with canonical IDs
- **Day_Diameter**: Maximum geographic spread (km) of activities within a single day
- **DBSCAN**: Density-Based Spatial Clustering of Applications with Noise - a fallback clustering algorithm
- **Enriched_Candidate**: A place candidate with computed properties (duration, category, utility score)
- **Feature_Flag**: Configuration toggle to enable/disable specific functionality
- **Geohash**: A hierarchical spatial data structure encoding geographic coordinates (precision 6 = ~1.2km cells for dedup, precision 7 = ~150m for travel cache)
- **Iconic_Score**: Computed score: `f(reviewCount, rating, categoryPrior, globalPopularityRank)`
- **K_Means**: A clustering algorithm that partitions candidates into k geographic zones
- **Optimizer**: Agent 3 in the pipeline responsible for building day timelines
- **Parser**: Agent 1 in the pipeline responsible for extracting structured data from user input
- **Plan_Trace**: Structured observability object tracking decisions and reasons throughout planning
- **Researcher**: Agent 2 in the pipeline responsible for retrieving candidate places
- **Soft_Conflict**: A parser-detected issue that can be resolved with defaults rather than blocking
- **Travel_Cache**: Cache for travel time estimates keyed by origin/destination geohash pairs
- **Zone**: A geographic cluster of candidates assigned to a specific day
- **Zone_Validator**: Component that validates zone quality and triggers fallback clustering

## Configuration Defaults

The following constants SHALL be used as defaults (tunable via configuration):

| Parameter | Default Value | Description |
|-----------|---------------|-------------|
| `maxDayDiameterKm` | 8 | Maximum geographic spread for a day's activities |
| `minAnchorsPerDayCoverage` | 0.67 | Fraction of days that must have at least one anchor |
| `maxAnchorsTotalDefault` | 12 | Maximum total anchors to select (prevents explosion in high-review cities) |
| `topNLegsRealTravelValidation` | 4 | Number of legs per day to validate with real travel API |
| `timeBucketMinutes` | 60 | Time bucket granularity for travel cache (morning/afternoon/evening) |
| `dailyStartTime` | 480 (8:00 AM) | Default day start time in minutes from midnight |
| `dailyEndTime` | 1260 (9:00 PM) | Default day end time in minutes from midnight |
| `bufferMinutesBetweenSlots` | 15 | Default buffer between activities |
| `minBufferMinutes` | 5 | Minimum buffer after compression |
| `mealPlaceholderMinutes` | 60 | Duration for meal placeholder blocks |
| `bigRockThresholdMinutes` | 180 | Duration threshold for Big Rock classification |
| `anchorReviewCountThreshold` | 10000 | Minimum reviews for anchor eligibility |
| `anchorIconicScoreThreshold` | 0.7 | Minimum iconic score for anchor eligibility |
| `maxZoneToMinZonePoiRatio` | 2.0 | Maximum POI count imbalance ratio between zones |
| `maxZoneMinutesToMinZoneMinutesRatio` | 1.8 | Maximum planned minutes imbalance ratio between zones |
| `maxAdditionalPoisOnBigRockDay` | 2 | Maximum small POIs alongside a Big Rock |
| `defaultTravelMode` | "driving" | Default travel mode unless specified |
| `nearbySwapRadiusKm` | 2.0 | Radius for "nearby" candidate swaps during repair |
| `dedupMergeRadiusMeters` | 300 | Distance threshold for near-duplicate merge (same name + within radius) |
| `planTraceRetentionCount` | 50 | Number of recent plan traces to retain locally |
| `lowUtilityThreshold` | 0.3 | Relative utility threshold below which POI may be dropped (0-1 scale) |

## Daily Budget Computation

The daily time budget is computed as:

```
dailyBudgetMinutes = dailyEndTime - dailyStartTime
```

Feasibility check formula:

```
sum(activityDurations) + sum(travelTimes) + sum(buffers) + sum(mealPlaceholders) <= dailyBudgetMinutes
```

With defaults: `dailyBudgetMinutes = 1260 - 480 = 780 minutes = 13 hours` (8:00 AM to 9:00 PM)

## Iconic Score Computation

The `iconicScore` is computed as a value in range `[0, 1]`:

```
iconicScore = w1 * normalize(reviewCount) + w2 * normalize(rating) + w3 * categoryPrior + w4 * normalize(globalPopularityRank)
```

Where:
- `reviewCount`: Number of Google reviews (normalized to 0-1 using log scale, capped at 100k)
- `rating`: Google rating 1-5 (normalized to 0-1)
- `categoryPrior`: Category-specific weight (e.g., landmark=0.8, museum=0.7, park=0.5) - defined per category
- `globalPopularityRank`: Rank in destination's top attractions (if missing, treat as median rank)

Fallback defaults:
- If `rating` missing → assume 4.2
- If `globalPopularityRank` missing → treat as median (0.5 normalized)
- If `categoryPrior` undefined → use 0.5

## Day Diameter Computation

`dayDiameterKm` is computed as the **maximum pairwise haversine distance** among all scheduled POIs in that day:

```
dayDiameterKm = max(haversineDistance(poi_i, poi_j)) for all pairs (i, j) in day's POIs
```

This ensures the worst-case geographic spread is captured for validation.

## Reason Code Enums

### DropReasonCode
- `DUPLICATE_CANONICAL` - POI is a duplicate of an already-scheduled canonical place
- `ANCHOR_POLICY_MAX_REACHED` - Maximum anchors per day already scheduled
- `DAY_DIAMETER_EXCEEDED` - Adding POI would exceed day diameter threshold
- `TIME_BUDGET_EXCEEDED` - Adding POI would exceed daily time budget
- `TRAVEL_TIME_EXCEEDED_REAL` - Real travel time validation failed
- `OPEN_HOURS_CONFLICT` - POI not open during available time window
- `LOW_UTILITY` - POI utility score below threshold for selection
- `AVOID_INCLUDE` - POI is in the avoidInclude list
- `ZONE_IMBALANCE` - Dropped during zone rebalancing
- `BIG_ROCK_DAY_LIMIT` - Big Rock day already has max additional POIs

### RepairActionCode
- `REORDER_2OPT` - Reordered activities using 2-opt local improvement
- `DROP_LOWEST_UTILITY` - Dropped lowest utility non-anchor activity
- `SWAP_NEARBY` - Swapped with nearby candidate from same zone (within `nearbySwapRadiusKm`)
- `MOVE_TO_ADJACENT_DAY` - Moved candidate to adjacent day (dayIndex ± 1 only)
- `SHRINK_DURATION` - Reduced activity duration to minimum
- `COMPRESS_BUFFERS` - Compressed buffers to minimum
- `RELAX_DIAMETER_THRESHOLD` - Relaxed day diameter constraint (logged)

### InfeasibilityReasonCode
- `NO_VALID_OPEN_WINDOW` - POI has no valid open window during trip dates
- `EXCEEDS_ALL_DAY_BUDGETS` - Travel + duration exceeds budget for every possible day
- `HARD_CONSTRAINT_VIOLATION` - Violates avoidInclude, closed days, or other hard constraints
- `ZONE_ASSIGNMENT_IMPOSSIBLE` - Cannot assign to any zone without exceeding diameter

## Requirements

### Requirement 1: Anchor-First Scheduling Contract

**User Story:** As a traveler, I want my itinerary to include the most iconic attractions for my destination, so that I don't miss must-see landmarks.

#### Acceptance Criteria

1. WHEN the Researcher completes retrieval, THE Researcher SHALL output an `anchors` array containing POIs meeting anchor eligibility: `reviewCount >= anchorReviewCountThreshold` OR `iconicScore >= anchorIconicScoreThreshold` OR in curated top list
2. THE Researcher SHALL cap anchors array at `maxAnchorsTotalDefault` (default 12), ranked by tie-break rules: (1) highest iconicScore, (2) highest reviewCount, (3) diversityTargets satisfaction
3. THE anchors array SHALL be pre-ranked so Optimizer can iterate in priority order
4. WHEN the Researcher completes retrieval, THE Researcher SHALL output an `anchorPolicy` object containing `minTotalAnchors`, `minAnchorsPerDay`, `maxAnchorsPerDay`, and `diversityTargets`
5. WHEN the Researcher completes retrieval, THE Researcher SHALL output a `mustInclude` array containing canonical POI IDs from anchors plus user-specified must-sees
6. WHEN the Researcher completes retrieval, THE Researcher SHALL output an `avoidInclude` array containing canonical POI IDs to exclude
7. WHEN the Optimizer builds day timelines, THE Optimizer SHALL schedule anchors FIRST before filling remaining slots with other candidates
8. WHEN scheduling anchors, THE Optimizer SHALL enforce `totalAnchorsScheduled >= minTotalAnchors` as a hard constraint unless anchor is infeasible
9. WHEN scheduling anchors, THE Optimizer SHALL enforce `minAnchorsPerDay` for at least `minAnchorsPerDayCoverage` fraction of days (default 67%)
10. IF anchor placement is infeasible, THEN THE Optimizer SHALL emit `infeasibleAnchors: [{id, reasonCode: InfeasibilityReasonCode}]` and log the reason, never silently dropping anchors
11. THE Researcher SHALL compute `iconicScore` using formula: `f(reviewCount, rating, categoryPrior, globalPopularityRank)`

### Requirement 2: Robust Zone Clustering

**User Story:** As a traveler visiting a corridor-like city (coastline, river, linear layout), I want my daily activities to be geographically coherent, so that I don't waste time traveling back and forth.

#### Acceptance Criteria

1. THE Zone_Builder SHALL run K_Means clustering as the initial clustering method
2. WHEN zones are created, THE Zone_Validator SHALL validate each zone against `maxDayDiameterKm` threshold (default 8km)
3. WHEN zones are created, THE Zone_Validator SHALL validate total planned minutes feasibility for each zone
4. WHEN zones are created, THE Zone_Validator SHALL validate POI count balance: `maxZoneToMinZonePoiRatio <= 2.0`
5. WHEN zones are created, THE Zone_Validator SHALL validate planned minutes balance: `maxZoneMinutesToMinZoneMinutesRatio <= 1.8`
6. IF zone validation fails, THEN THE Zone_Builder SHALL fallback to density-based clustering (DBSCAN-like) or graph clustering
7. WHEN rebalancing zones, THE Zone_Builder SHALL move lowest-value POIs from overloaded zones while keeping anchors pinned
8. THE Zone_Builder SHALL expose `maxDayDiameterKm` as a configurable guardrail parameter

### Requirement 3: Two-Tier Travel Time Estimation

**User Story:** As a traveler, I want realistic travel time estimates in my itinerary, so that my schedule is actually achievable.

#### Acceptance Criteria

1. WHEN estimating travel during early-stage routing, THE Travel_Estimator SHALL use a cheap Haversine-based heuristic
2. WHEN validating final candidate legs, THE Travel_Estimator SHALL use real travel time API calls for top `topNLegsRealTravelValidation` legs per day (default 4), where "top legs" means legs with largest estimated travel time to maximize risk coverage
3. WHEN a day fails feasibility due to travel time, THE Travel_Estimator SHALL fetch real travel times for all legs on that day
4. THE Travel_Cache SHALL cache travel time results with key format: `(origin_geohash_7, dest_geohash_7, mode, timeBucket)`
5. IF real travel time exceeds feasibility threshold, THEN THE Repair_Engine SHALL attempt repairs in priority order
6. THE System SHALL use `defaultTravelMode` ("driving") unless parser specifies walking/transit, or infer based on city density + distance thresholds
7. IF travel API quota is exceeded, THEN THE System SHALL fallback to heuristic and log with reason code

### Requirement 4: Decoupled Meal Planning

**User Story:** As a system maintainer, I want meal planning to be toggleable, so that the core itinerary logic remains simple and type-safe.

#### Acceptance Criteria

1. THE System SHALL provide a feature flag `ENABLE_MEALS` defaulting to `false`
2. WHILE `ENABLE_MEALS` is false, THE Researcher SHALL NOT retrieve restaurant candidates
3. WHILE `ENABLE_MEALS` is false, THE Optimizer SHALL NOT create restaurant slots in timelines
4. WHILE `ENABLE_MEALS` is false, THE Optimizer SHALL include buffer time and "free meal time block" as `slotType: 'meal_placeholder'` with duration `mealPlaceholderMinutes` (default 60)
5. THE System SHALL update TimelineSlot type union to include `'meal_placeholder'` alongside existing `'activity' | 'meal' | 'travel' | 'buffer'`
6. THE Storyteller SHALL render `meal_placeholder` slots as "Meal break (flexible)" in output
7. WHERE `ENABLE_MEALS` is true (future), THE Meal_Planner SHALL operate as a post-pass after core optimization

### Requirement 5: Canonical Place Registry

**User Story:** As a system maintainer, I want a single source of truth for place deduplication, so that duplicate handling is consistent throughout the pipeline.

#### Acceptance Criteria

1. THE Canonical_Place_Registry SHALL be created after Research enrichment as a single dedup stage
2. WHEN creating canonical records, THE Canonical_Place_Registry SHALL generate canonical IDs using: `normalizedName + city + geohash_6`, with fallback to `provider_place_id` if present
3. WHEN duplicates are detected by canonical key, THE Canonical_Place_Registry SHALL merge them keeping best fields: highest reviewCount, best photos, union of categories
4. WHEN two POIs have matching normalizedName AND distance <= `dedupMergeRadiusMeters` (default 300m), THE Canonical_Place_Registry SHALL merge them as near-duplicates
5. THE Canonical_Place_Registry SHALL return `canonicalPlacesById` map and `rawIdToCanonicalId` mapping
6. THE Optimizer SHALL work ONLY on canonical IDs from the registry
7. THE Presenter (Storyteller) SHALL reference canonical records from the registry
8. WHEN merging duplicates, THE Canonical_Place_Registry SHALL log merge reason in Plan_Trace

### Requirement 6: Parser Soft Conflicts

**User Story:** As a traveler, I want the system to continue planning even when my input has minor ambiguities, so that I get a usable itinerary with reasonable defaults.

#### Acceptance Criteria

1. WHEN parsing user input, THE Parser SHALL categorize detected issues into `hard_blockers` array and `soft_conflicts` array
2. IF `hard_blockers` is non-empty, THEN THE Parser SHALL halt the pipeline
3. IF only `soft_conflicts` exist, THEN THE Parser SHALL continue the pipeline using default assumptions
4. WHEN using defaults for soft conflicts, THE Parser SHALL populate an `assumptions` array with human-readable description and structured `{field, defaultValue, reason}` entries
5. THE Storyteller SHALL present assumptions in the final output to inform the user
6. THE Parser SHALL use configuration defaults (dailyStartTime, dailyEndTime, etc.) when user input is ambiguous

### Requirement 7: RAG Stack Documentation Consistency

**User Story:** As a developer, I want the architecture documentation to accurately reflect the current system state, so that I can understand and maintain the codebase.

#### Acceptance Criteria

1. THE arc.md documentation SHALL remove Pinecone from the "current architecture" section
2. THE arc.md documentation SHALL list Pinecone as a future enhancement option in a "Future Enhancements" section
3. THE arc.md documentation SHALL accurately reflect the current retrieval pipeline implementation

### Requirement 8: PlanTrace Observability

**User Story:** As a developer debugging itinerary quality issues, I want structured trace data for each planning run, so that I can understand why specific POIs were chosen or dropped.

#### Acceptance Criteria

1. THE System SHALL create a structured Plan_Trace object for each planning run
2. THE Plan_Trace SHALL include retrieval stats: candidate counts, filters applied, dedup counts
3. THE Plan_Trace SHALL include anchor stats: selected anchors, dropped anchors with `DropReasonCode`, infeasible anchors with `InfeasibilityReasonCode`
4. THE Plan_Trace SHALL include zoning stats: cluster method used (K_Means or fallback), zone diameters, zone loads (POI count and minutes)
5. THE Plan_Trace SHALL include optimization decisions: selected POIs, dropped POIs with `DropReasonCode`
6. THE Plan_Trace SHALL include feasibility checks: violations detected, repairs attempted with `RepairActionCode`, final pass/fail status
7. THE Plan_Trace SHALL include cost/time metrics: estimated vs real travel time deltas per leg
8. THE Plan_Trace SHALL be persisted as JSON under `runs/<runId>/plan_trace.json`
9. THE System SHALL retain the last `planTraceRetentionCount` (default 50) plan traces locally
10. THE Plan_Trace SHALL use standardized reason code enums for consistent log analysis

### Requirement 9: No Duplicate POIs

**User Story:** As a traveler, I want each place to appear only once in my itinerary, so that my trip doesn't have redundant visits.

#### Acceptance Criteria

1. THE Canonical_Place_Registry SHALL ensure no duplicate POIs exist after deduplication
2. THE Optimizer SHALL ensure no POI appears in the same day more than once
3. THE Optimizer SHALL ensure no POI appears across multiple days
4. THE Duplicate_Assertion SHALL validate final output contains no duplicates by canonical ID

### Requirement 10: Geographic Day Coherence

**User Story:** As a traveler, I want each day's activities to be in the same general area, so that I minimize transit time.

#### Acceptance Criteria

1. THE Zone_Validator SHALL enforce `maxDayDiameterKm` threshold for each zone (default 8km)
2. IF a day exceeds the diameter threshold, THEN THE System SHALL log the reason with `RepairActionCode.RELAX_DIAMETER_THRESHOLD`
3. THE Plan_Trace SHALL record zone diameter measurements for each day

### Requirement 11: Feasibility Validation with Real Travel Times

**User Story:** As a traveler, I want my itinerary to be actually achievable, so that I'm not rushing between distant locations.

#### Acceptance Criteria

1. WHEN validating final itinerary, THE Feasibility_Checker SHALL use real travel times for top `topNLegsRealTravelValidation` legs per day (default 4), where "top legs" means legs with largest estimated travel time
2. IF real travel times cause feasibility failure, THEN THE Repair_Engine SHALL attempt repairs in priority order
3. THE Plan_Trace SHALL record estimated vs actual travel time deltas for validated legs

### Requirement 12: Big Rock Scheduling

**User Story:** As a traveler visiting a major attraction like a theme park or zoo, I want that attraction to be the focus of my day, so that I have enough time to enjoy it fully.

#### Acceptance Criteria

1. THE System SHALL classify a POI as Big_Rock when `durationMinutes >= bigRockThresholdMinutes` (default 180)
2. WHEN a Big_Rock is scheduled, THE Optimizer SHALL schedule it as the primary block for that day
3. WHEN a Big_Rock is scheduled, THE Optimizer SHALL allow at most `maxAdditionalPoisOnBigRockDay` small POIs (default 2) alongside it
4. THE Zone_Builder SHALL NOT cluster Big_Rocks with far-away anchors in the same zone
5. IF multiple Big_Rocks exist, THE Optimizer SHALL schedule them on separate days when possible
6. THE Plan_Trace SHALL record Big_Rock scheduling decisions with reason codes

### Requirement 13: Repair Engine Priority Order

**User Story:** As a system maintainer, I want deterministic repair behavior, so that itinerary fixes are predictable and testable.

#### Acceptance Criteria

1. THE Repair_Engine SHALL attempt repairs in the following priority order:
   - Reorder within day (2-opt local improvement)
   - Drop lowest utility non-anchor
   - Swap with nearby candidate from same zone (within `nearbySwapRadiusKm`, default 2km)
   - Move candidate to adjacent day (dayIndex ± 1 only)
   - Shrink activity duration to category minimum
   - Compress buffers to `minBufferMinutes`
   - Relax soft constraints (never anchors unless infeasible)
2. THE Repair_Engine SHALL keep anchors pinned unless they are infeasible
3. THE Repair_Engine SHALL log each repair action with `RepairActionCode`
4. THE Repair_Engine SHALL stop after first successful repair that resolves the issue
