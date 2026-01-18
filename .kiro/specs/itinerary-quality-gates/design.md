# Design: Itinerary Quality Gates

## Overview
This design adds quality gates to the existing 4-agent pipeline without architectural changes. The approach uses thin utility modules and strategic integration points.

## Architecture

### Component Diagram
```
┌─────────────────────────────────────────────────────────────────┐
│                     Agent 3: Optimizer                          │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐      │
│  │ Phase 1-2    │───▶│ Phase 3      │───▶│ Phase 4-5    │      │
│  │ Dedup/Zones  │    │ Build Days   │    │ Validate     │      │
│  └──────────────┘    └──────┬───────┘    └──────┬───────┘      │
│                             │                    │               │
│                      ┌──────▼───────┐    ┌──────▼───────┐      │
│                      │ TripLedger   │    │ Duplicate    │      │
│                      │ (NEW)        │    │ Assertion    │      │
│                      └──────┬───────┘    │ (NEW)        │      │
│                             │            └──────────────┘      │
│                      ┌──────▼───────┐                          │
│                      │ Meal         │                          │
│                      │ Scheduler    │                          │
│                      │ (MODIFIED)   │                          │
│                      └──────┬───────┘                          │
│                             │                                   │
│                      ┌──────▼───────┐                          │
│                      │ Restaurant   │                          │
│                      │ Validation   │                          │
│                      │ (NEW)        │                          │
│                      └──────────────┘                          │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                     Repair Engine (MODIFIED)                    │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐      │
│  │ Strategy 1-2 │───▶│ Strategy 3   │───▶│ Strategy 6   │      │
│  │ Reorder/Swap │    │ Shrink       │    │ Anchor       │      │
│  │              │    │ (MIN GUARD)  │    │ Recovery     │      │
│  └──────────────┘    └──────────────┘    │ (NEW)        │      │
│                                          └──────────────┘      │
└─────────────────────────────────────────────────────────────────┘
```

## New Modules

### 1. TripLedger (`lib/utils/trip-ledger.ts`)

**Purpose:** Single source of truth for tracking used candidates across the trip.

**Interface:**
```typescript
class TripLedger {
  has(candidate: EnrichedCandidate): boolean;
  hasNearDuplicate(candidate: EnrichedCandidate): boolean;
  isUsedOrDuplicate(candidate: EnrichedCandidate): boolean;
  add(candidate, dayIndex, slotType, slotIndex?): void;
  remove(candidate: EnrichedCandidate): void;
  static fromSets(usedIds, usedDedupKeys): TripLedger;
}
```

**Key Design Decisions:**
- Checks both `id` and `dedupKey` for comprehensive duplicate detection
- Stores full candidate references for near-duplicate checking
- Provides backward compatibility via `fromSets()` for migration

### 2. Restaurant Validation (`lib/validation/restaurant-validation.ts`)

**Purpose:** Validate that meal venues are actual restaurants/cafes.

**Interface:**
```typescript
interface RestaurantValidationPolicy {
  allowFoodMarkets: boolean;
  allowStreetFood: boolean;
  minRating: number;
  minReviewCount: number;
}

function isValidRestaurantStrict(candidate, policy?): boolean;
function filterValidRestaurantsStrict(candidates, policy?): EnrichedCandidate[];
function getRestaurantRejectionReason(candidate, policy?): string | null;
```

**Exclusion Patterns:**
- Hard exclusions: Religious sites, museums, zoos, parks
- Soft exclusions (policy-dependent): Markets, bazaars, shopping areas
- Name patterns: temple, mandir, bazaar, market, mall, etc.

### 3. Duplicate Assertion (`lib/validation/duplicate-assertion.ts`)

**Purpose:** Assert no duplicates exist in final itinerary.

**Interface:**
```typescript
function assertNoDuplicatesInTimelines(timelines: DayTimeline[]): void;
function checkForDuplicates(timelines): DuplicateAssertionResult;
```

**Detection Methods:**
1. Exact ID match
2. Exact dedupKey match
3. Near-duplicate (name similarity + proximity)

## Modified Modules

### 1. Meal Scheduler (`lib/planning/meal-scheduler.ts`)

**Changes:**
- New `scheduleMeals()` signature accepts `ledger?: TripLedger` and `restaurantPolicy`
- New `createMealSlotWithLedger()` function
- Filters used restaurants before selection
- Marks selected restaurants as used immediately

**Critical Ordering Fix:**
```typescript
// BEFORE (broken): Meals scheduled, then activities marked
scheduleMeals(timeline, restaurants);
for (activity of selectedActivities) ledger.add(activity);

// AFTER (fixed): Activities marked, then meals scheduled
for (activity of selectedActivities) ledger.add(activity);
scheduleMeals(timeline, restaurants, config, ledger);
```

### 2. Repair Engine (`lib/validation/repair-engine.ts`)

**Changes:**
- `tryShrinkWithMinDuration()` respects category minimums
- `getMinDurationForCategory()` helper using DURATION_PRIORS
- `tryAnchorRecovery()` new repair strategy (Strategy 6)

**Category Minimum Guard:**
```typescript
const minDuration = getMinDurationForCategory(candidate.category);
const maxAllowedShrink = Math.min(
  currentDuration - minDuration,  // Category minimum
  candidate.durationExpected - candidate.durationMin  // Candidate minimum
);
```

### 3. Agent 3 Optimizer (`lib/agents/agent3-optimizer.ts`)

**Changes:**
- Uses TripLedger instead of separate Sets
- New `buildDayTimelineWithLedger()` function
- Marks activities as used BEFORE scheduling meals
- Calls `assertNoDuplicatesInTimelines()` after building all days

## Data Flow

### Phase 3: Build Day Timelines
```
1. Create TripLedger (empty)
2. For each day:
   a. Select activities from zone (check ledger)
   b. Mark selected activities as used in ledger  ← CRITICAL: Before meals
   c. Order activities (TSP)
   d. Build timeline slots
   e. Schedule meals (pass ledger)
      - Filter restaurants by ledger
      - Select best restaurant
      - Mark selected restaurant as used
3. Assert no duplicates in all timelines
```

## Testing Strategy

### Unit Tests
- TripLedger: has(), add(), remove(), fromSets()
- Restaurant validation: exclusion patterns, policy flags
- Duplicate assertion: within-day, cross-day, near-duplicates

### Integration Tests
- Full optimizer run with duplicate-prone input
- Repair engine with category minimum violations
- Meal scheduling with limited restaurant pool

## Backward Compatibility

All changes maintain backward compatibility:
- Old function signatures still work (delegate to new implementations)
- Deprecated functions marked with `@deprecated` JSDoc
- `TripLedger.fromSets()` for migration from Set-based tracking
