# Tasks: Itinerary Quality Gates

## Status: COMPLETED ✓

All tasks have been implemented and verified.

## Task List

- [x] 1. Create TripLedger module
  - [x] 1.1 Create `lib/utils/trip-ledger.ts` with TripLedger class
  - [x] 1.2 Implement `has()`, `add()`, `remove()` methods
  - [x] 1.3 Implement `hasNearDuplicate()` and `isUsedOrDuplicate()` methods
  - [x] 1.4 Implement `fromSets()` static method for backward compatibility
  - [x] 1.5 Add helper functions `filterAvailable()` and `filterAvailableStrict()`

- [x] 2. Create Restaurant Validation module
  - [x] 2.1 Create `lib/validation/restaurant-validation.ts`
  - [x] 2.2 Define exclusion patterns (religious, attractions, markets)
  - [x] 2.3 Implement `isValidRestaurantStrict()` with policy support
  - [x] 2.4 Implement `filterValidRestaurantsStrict()`
  - [x] 2.5 Implement `getRestaurantRejectionReason()` for debugging

- [x] 3. Create Duplicate Assertion module
  - [x] 3.1 Create `lib/validation/duplicate-assertion.ts`
  - [x] 3.2 Implement `checkForDuplicates()` with detailed result
  - [x] 3.3 Implement `assertNoDuplicatesInTimelines()` (logs warning, doesn't throw)
  - [x] 3.4 Support detection by id, dedupKey, and near-duplicates

- [x] 4. Modify Meal Scheduler
  - [x] 4.1 Add imports for TripLedger and restaurant-validation
  - [x] 4.2 Update `scheduleMeals()` signature to accept ledger and policy
  - [x] 4.3 Create `createMealSlotWithLedger()` function
  - [x] 4.4 Filter used restaurants before selection
  - [x] 4.5 Mark selected restaurants as used immediately
  - [x] 4.6 Deprecate old `createMealSlot()` function

- [x] 5. Modify Repair Engine
  - [x] 5.1 Add import for DURATION_PRIORS
  - [x] 5.2 Create `getMinDurationForCategory()` helper
  - [x] 5.3 Create `tryShrinkWithMinDuration()` with category guard
  - [x] 5.4 Create `tryAnchorRecovery()` repair strategy
  - [x] 5.5 Update `applyRepair()` to use new strategies
  - [x] 5.6 Deprecate old `tryShrink()` function

- [x] 6. Modify Agent 3 Optimizer
  - [x] 6.1 Add imports for new modules
  - [x] 6.2 Replace separate Sets with TripLedger in Phase 3
  - [x] 6.3 Create `buildDayTimelineWithLedger()` function
  - [x] 6.4 Mark activities as used BEFORE scheduling meals (critical fix)
  - [x] 6.5 Call `assertNoDuplicatesInTimelines()` after building all days
  - [x] 6.6 Deprecate old `buildDayTimeline()` function

- [x] 7. Verification
  - [x] 7.1 Run TypeScript compilation (`npx tsc --noEmit`)
  - [x] 7.2 Verify no type errors in modified files
  - [x] 7.3 Start dev server and verify no runtime errors

## Implementation Notes

### Critical Ordering Fix (Task 6.4)
The most important fix is ensuring activities are marked as used BEFORE meal scheduling:

```typescript
// In buildDayTimelineWithLedger():

// 1. Select activities
const selectedActivities = selectActivitiesFromZone(zone, ledger);

// 2. CRITICAL: Mark as used BEFORE meals
for (const activity of selectedActivities) {
  ledger.add(activity, dayIndex, 'activity');
}

// 3. NOW schedule meals (ledger is up-to-date)
timeline = scheduleMeals(timeline, restaurants, config, ledger);
```

### Files Modified/Created
- `lib/utils/trip-ledger.ts` (NEW)
- `lib/validation/restaurant-validation.ts` (NEW)
- `lib/validation/duplicate-assertion.ts` (NEW)
- `lib/planning/meal-scheduler.ts` (MODIFIED)
- `lib/validation/repair-engine.ts` (MODIFIED)
- `lib/agents/agent3-optimizer.ts` (MODIFIED)
