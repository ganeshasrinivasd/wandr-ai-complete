# Implementation Plan: Optimizer v3 Improvements

## Overview

Implement the Optimizer v3 architecture for WANDR AI with anchor-first scheduling, canonical place registry, robust zone clustering, two-tier travel estimation, decoupled meals, soft conflict handling, and PlanTrace observability. All changes are additive and backward compatible.

## Tasks

- [x] 1. Phase 0: Types and Configuration
  - [x] 1.1 Create lib/types/optimizer-v3.ts with all v3 types
    - Export EnrichedCandidateBase, EnrichedCandidateRaw, EnrichedCandidateCanonical
    - Export RawPlaceId, CanonicalPlaceId, PlaceRef helpers
    - Export all enums: DropReasonCode, RepairActionCode, InfeasibilityReasonCode, TravelValidationExceptionCode, FeasibilityViolationType
    - Export AnchorPolicy, AnchorCandidateRaw, AnchorCandidate, AnchorSelectionResult
    - Export TimelineSlotType, TimelineSlot, DayTimeline, Zone, ZoneBuilderResult, ZoneValidationResult
    - Export PlanTrace and related types
    - _Requirements: 5.2, 8.10_
  
  - [x] 1.2 Create lib/config/feature-flags.ts
    - Implement FeatureFlags interface with ENABLE_MEALS, ENABLE_REAL_TRAVEL_VALIDATION, ENABLE_DBSCAN_FALLBACK
    - Implement DEFAULT_FEATURE_FLAGS with ENABLE_MEALS=false
    - Implement getFeatureFlags() function
    - _Requirements: 4.1_
  
  - [x] 1.3 Create lib/config/optimizer-config.ts
    - Implement OptimizerV3Config with all v3 parameters and defaults
    - Add config validation: clamp minTotalAnchors when > maxAnchorsTotalDefault
    - Log config conflicts to PlanTrace.config.conflicts
    - _Requirements: 1.2, 2.7, 3.4, 12.1, 12.3, 13.1_

- [x] 2. Phase 1: Observability Infrastructure
  - [x] 2.1 Create lib/observability/plan-trace.ts
    - Implement PlanTrace interface with all sections: config, retrieval, pruning, idMapping, anchors, zoning, optimization, feasibility, travelMetrics
    - Implement PlanTraceBuilder class with all log methods
    - Implement persist() to write runs/<runId>/plan_trace.json
    - Implement cleanupOldTraces(retentionCount) sorting by timestamp
    - Add runId generator (uuid or timestamp+random)
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 8.8, 8.9, 8.10_
  
  - [ ]* 2.2 Write property test for PlanTrace enum codes
    - **Property 24: PlanTrace Uses Enum Codes**
    - **Validates: Requirements 8.10**

- [x] 3. Phase 2: Canonical Place Registry
  - [x] 3.1 Create lib/planning/canonical-registry.ts
    - Implement name normalization: lower-case, trim, strip punctuation, remove stopwords, NFKD unicode
    - Implement dedupKey composition: `${normalizedName}|${geohash6}|${primaryCategory}`
    - Implement exact duplicate detection: rawId match → same canonical
    - Implement near-duplicate detection: dedupKey match OR (distance <= 300m AND Jaro-Winkler >= 0.92)
    - Implement merge logic: keep highest reviewCount, union photoUrls, union categories
    - Implement mustInclude/avoidInclude mapping with fetch-by-id fallback
    - Log RAW_ID_NOT_FOUND / FETCH_FAILED to PlanTrace.idMapping
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.7, 5.8, 9.1_
  
  - [ ]* 3.2 Write property test for canonical ID format
    - **Property 17: Canonical ID Format**
    - **Validates: Requirements 5.2**
  
  - [ ]* 3.3 Write property test for duplicate merge
    - **Property 18: Duplicate Merge Keeps Best Fields**
    - **Validates: Requirements 5.3, 5.4**
  
  - [ ]* 3.4 Write property test for raw to canonical mapping
    - **Property 32: Raw to Canonical ID Mapping**
    - **Validates: Requirements 5.5**

- [x] 4. Phase 3: Researcher Enhancements
  - [x] 4.1 Create lib/planning/anchor-policy.ts
    - Implement computeIconicScore() using ICONIC_SCORE_WEIGHTS
    - Implement selectAnchors() with eligibility thresholds, tie-break sorting, cap enforcement
    - Return AnchorSelectionResult with anchors (raw) and infeasibleAnchors
    - _Requirements: 1.1, 1.2, 1.3, 1.11_
  
  - [ ]* 4.2 Write property test for anchor eligibility
    - **Property 1: Anchor Eligibility**
    - **Validates: Requirements 1.1**
  
  - [ ]* 4.3 Write property test for anchor cap and ranking
    - **Property 2: Anchor Cap and Ranking**
    - **Validates: Requirements 1.2, 1.3**
  
  - [ ]* 4.4 Write property test for iconic score range
    - **Property 6: Iconic Score Range**
    - **Validates: Requirements 1.11**
  
  - [x] 4.5 Update lib/agents/agent2-researcher.ts
    - Compute iconicScore and utilityScore for all candidates
    - Output enrichedCandidatesRaw with raw IDs
    - Call selectAnchors() and output anchorCandidatesRaw
    - Output mustIncludeRawIds and avoidIncludeRawIds
    - When ENABLE_MEALS=false: output empty restaurants and cafes arrays
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 4.2_

- [x] 5. Checkpoint - Verify types, config, observability, registry, and researcher
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Phase 4: Candidate Pruning and Zone Building
  - [x] 6.1 Create lib/planning/candidate-pruner.ts
    - Implement pruneCandidates() preserving anchors + mustInclude
    - Group by geohash6 cell and category
    - Keep topKPerGeohashCell per group
    - Apply global maxCandidatePoolTotal cap
    - Return PrunerResult and log to PlanTrace.pruning
    - _Requirements: 2.6, 2.7_
  
  - [x] 6.2 Create lib/planning/zone-validator.ts
    - Implement validateZones() checking diameter, POI count ratio, minutes ratio
    - Implement computeZoneDiameter() using max pairwise haversine
    - Implement rebalanceZones() moving lowest-value POIs while keeping pinned candidates
    - _Requirements: 2.2, 2.3, 2.4, 2.5, 10.1_
  
  - [ ]* 6.3 Write property test for zone diameter validation
    - **Property 7: Zone Diameter Validation**
    - **Validates: Requirements 2.2, 10.1, 10.2**
  
  - [ ]* 6.4 Write property test for zone POI count balance
    - **Property 8: Zone POI Count Balance**
    - **Validates: Requirements 2.4**
  
  - [x] 6.5 Create lib/planning/dbscan-clustering.ts
    - Implement dbscanClustering() with epsilon and minPoints
    - Implement handleInsufficientClusters() when clusters < numDays
    - _Requirements: 2.6_
  
  - [x] 6.6 Update lib/planning/zone-builder.ts
    - Implement buildZones() with K-means as initial method
    - Identify Big Rocks and create seed zones (pin top numDays Big Rocks)
    - Call validateZones() and fallback to DBSCAN when validation fails
    - Return ZoneBuilderResult with assignmentByCanonicalId and pinnedByCanonicalId
    - Log zoning stats to PlanTrace
    - _Requirements: 2.1, 2.6, 12.4, 12.5_

- [x] 7. Phase 5: Travel Cache and Validation
  - [x] 7.1 Create lib/planning/travel-cache.ts
    - Implement TravelCache class with getHeuristic() and getReal()
    - Implement cache key format: (origin_geohash_7, dest_geohash_7, mode, timeBucket)
    - Implement selectTopLegsForValidation() selecting legs with largest estimated travel time
    - Implement validateTopLegs() validating up to N legs, logging exceptions
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.6, 3.7, 11.1_
  
  - [ ]* 7.2 Write property test for travel cache key format
    - **Property 12: Travel Cache Key Format**
    - **Validates: Requirements 3.4**

- [x] 8. Phase 6: Optimizer Scheduling and Repairs
  - [x] 8.1 Update lib/validation/repair-engine.ts
    - Implement priority-ordered repair with REPAIR_PRIORITY_ORDER
    - Accept pinnedSet (anchors + mustInclude + pinned big rocks)
    - Protect pinned candidates from drop/move unless infeasible
    - Log repair actions to PlanTrace with RepairActionCode
    - _Requirements: 13.1, 13.2, 13.3, 13.4_
  
  - [ ]* 8.2 Write property test for repair priority order
    - **Property 29: Repair Priority Order**
    - **Validates: Requirements 13.1**
  
  - [ ]* 8.3 Write property test for pinned candidates protection
    - **Property 30: Pinned Candidates During Repair**
    - **Validates: Requirements 13.2**
  
  - [x] 8.4 Update lib/agents/agent3-optimizer.ts
    - Consume canonical candidates from registry
    - Implement anchor-first selection: schedule anchors before non-anchors
    - Maintain global usedCanonicalIds set across all days
    - Drop duplicates with DropReasonCode.DUPLICATE_CANONICAL
    - Insert meal_placeholder attempt (lunch 12:00-14:00, then dinner 18:00-20:00)
    - Log meal_placeholder omission reason if infeasible
    - Fill travelFromPrevious for all activity slots after first
    - Run feasibility checks and call repair engine on failure
    - Call validateTopLegs for real travel validation
    - _Requirements: 1.7, 1.8, 1.9, 1.10, 3.5, 4.3, 4.4, 9.2, 9.3, 11.2, 12.2, 12.3_
  
  - [ ]* 8.5 Write property test for no duplicates in output
    - **Property 25: No Duplicates in Output**
    - **Validates: Requirements 9.2, 9.3, 9.4**

- [x] 9. Checkpoint - Verify pruning, zoning, travel cache, and optimizer
  - Ensure all tests pass, ask the user if questions arise.

- [x] 10. Phase 7: Parser and Storyteller Updates
  - [x] 10.1 Update lib/agents/agent1-parser.ts
    - Extend output with hard_blockers, soft_conflicts, assumptions arrays
    - Halt pipeline if hard_blockers is non-empty
    - Continue with defaults if only soft_conflicts exist
    - Populate assumptions with {field, defaultValue, reason, humanReadable}
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.6_
  
  - [x] 10.2 Update lib/agents/agent4-storyteller.ts
    - Render meal_placeholder slots as "Meal break (flexible)" with placeholderType
    - Display assumptions from parser in final output
    - Reference canonical records from registry
    - _Requirements: 4.6, 5.7, 6.5_

- [x] 11. Phase 8: Documentation Update
  - [x] 11.1 Update arc.md
    - Remove Pinecone from "current architecture" section
    - Add Pinecone to "Future Enhancements" section
    - Update to reflect current retrieval pipeline implementation
    - Document v3 changes: anchor-first scheduling, canonical registry, zone validation, PlanTrace
    - _Requirements: 7.1, 7.2, 7.3_

- [ ] 12. Phase 9: Integration Testing
  - [ ]* 12.1 Write end-to-end integration test
    - Test full pipeline: Parser → Researcher → Registry → Pruner → ZoneBuilder → Optimizer → Storyteller
    - Assert PlanTrace is persisted and cleanup invoked
    - Assert ENABLE_MEALS=false yields no restaurant/cafe candidates
    - Assert at most 1 meal_placeholder per day
    - _Requirements: 4.2, 4.3, 8.8, 9.2, 9.3_
  
  - [ ]* 12.2 Write feature flag behavior tests
    - Test ENABLE_MEALS=false produces no restaurants/cafes
    - Test ENABLE_DBSCAN_FALLBACK triggers fallback on validation failure
    - _Requirements: 4.1, 4.2, 4.3, 2.6_

- [x] 13. Final Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties
- Unit tests validate specific examples and edge cases
- All downstream components after canonical registry use EnrichedCandidateCanonical only
- PlanTrace is created for every run and persisted to runs/<runId>/plan_trace.json
