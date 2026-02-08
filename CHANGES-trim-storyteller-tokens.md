# Trim Storyteller/Agent 4 Input Tokens

## Problem

Agent 4 (Storyteller) was sending the **full itinerary object** to Claude via `JSON.stringify(itinerary, null, 2)`. This included many fields the LLM never uses for narrative writing (photo URLs, lat/lng coordinates, internal IDs, upvote counts, etc.). The pretty-print formatting (`null, 2`) also added ~30% extra whitespace tokens.

## Changes Made

**File:** `lib/agents/agent4-storyteller.ts`

### 1. Added `trimItineraryForLLM()` helper (lines 14-58)

Strips the itinerary down to only fields the storyteller needs:

| Kept (per activity)                  | Removed (per activity)                          |
|--------------------------------------|--------------------------------------------------|
| `time`, `type`                       | `activity.id`                                    |
| `activity.name`                      | `activity.photo_url`                             |
| `activity.duration_minutes`          | `activity.location` (lat/lng)                    |
| `activity.cost`                      | `activity.upvotes`                               |
| `activity.description`              | `travel.from`                                    |
| `activity.reddit_quote`             | `travel.cost`                                    |
| `activity.accessibility_notes`      | `travel.distance_km`                             |
| `activity.vegan_details`            |                                                  |
| `travel.mode`, `travel.duration_minutes` |                                              |

| Kept (per day)                       | Removed (per day)                                |
|--------------------------------------|--------------------------------------------------|
| `day`, `date`, `theme`, `neighborhood` | `day_summary.total_walking_km`                 |
| `day_summary.total_cost`            | `day_summary.activities_count`                   |
|                                      | `day_summary.constraint_satisfaction`            |

| Kept (overall_summary)               | Removed (overall_summary)                       |
|--------------------------------------|--------------------------------------------------|
| `total_budget`                       | `optimizations_made`                             |
| `avg_per_day`                        | `potential_issues`                                |
| `constraint_compliance`             |                                                  |

### 2. Added `formatConstraints()` helper (lines 64-71)

Converts constraints from JSON to a compact readable string:

**Before:** `{"accessibility":["wheelchair_accessible"],"dietary":["vegan"],"pace":"moderate","other":[]}`

**After:** `accessibility: wheelchair_accessible | dietary: vegan | pace: moderate`

### 3. Updated v1 `runAgent4Storyteller()` (lines 117, 120)

- `JSON.stringify(constraints)` -> `formatConstraints(constraints)`
- `JSON.stringify(itinerary, null, 2)` -> `JSON.stringify(trimItineraryForLLM(itinerary))` (compact, no pretty-print)

### 4. Updated v3 `runAgent4StorytellerV3()` (lines 287, 290)

- Same changes as v1 above.

### What was NOT changed

- Fallback markdown functions (`generateFallbackMarkdown`, `generateFallbackMarkdownV3`) still use the full original `itinerary` object since they render directly without LLM cost.

## Estimated Token Savings

- Removing unused fields: ~40-50% reduction per activity
- Removing pretty-print whitespace: ~30% reduction
- Compact constraints format: ~60% reduction on constraints string
- **Combined: ~50-70% fewer input tokens** to the Storyteller agent per request

## Verification

- TypeScript transpile check: passed (no errors)
- Fallback functions unchanged (use original full itinerary)
- All fields needed for narrative writing are preserved
