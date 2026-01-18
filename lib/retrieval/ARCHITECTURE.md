# Cost-Effective Iconic Place Retrieval Pipeline

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        RETRIEVAL PIPELINE FLOW                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────┐     ┌─────────────────────────────────────────────────┐   │
│  │ USER QUERY  │────▶│  1. CACHE CHECK                                 │   │
│  │ - dest      │     │     Key: {city,country,lang,season}             │   │
│  │ - interests │     │     Hit? → Return cached (cost: $0.00)          │   │
│  │ - duration  │     └────────────────────┬────────────────────────────┘   │
│  └─────────────┘                          │ Miss                           │
│                                           ▼                                 │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  2. TEXT SEARCH (Primary Recall)                                    │   │
│  │     • 8-10 category-balanced queries                                │   │
│  │     • "famous landmarks {dest}", "must see {dest}", etc.            │   │
│  │     • Collect: place_id, name, coords, rating, reviews, types       │   │
│  │     • Cost: ~$0.024-0.030                                           │   │
│  └────────────────────────────────┬────────────────────────────────────┘   │
│                                   ▼                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  3. MULTI-CENTER NEARBY (Coverage Expansion)                        │   │
│  │     • Identify 3-5 centers from text search results                 │   │
│  │     • Run nearby search: 4-6 types per center                       │   │
│  │     • Radius: 3km per center                                        │   │
│  │     • Cost: ~$0.012-0.020                                           │   │
│  └────────────────────────────────┬────────────────────────────────────┘   │
│                                   ▼                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  4. RECALL HEALTH CHECK                                             │   │
│  │     Inputs: candidate pool                                          │   │
│  │     Metrics:                                                        │   │
│  │       • High-iconic count (iconicScore > 0.5)                       │   │
│  │       • Category balance (Shannon entropy)                          │   │
│  │       • Restaurant ratio (< 40%)                                    │   │
│  │       • Anchor count vs required (pace × days)                      │   │
│  │     Output: isHealthy: boolean, score: 0-1                          │   │
│  └────────────────────────────────┬────────────────────────────────────┘   │
│                                   │                                         │
│                    ┌──────────────┴──────────────┐                          │
│                    ▼                              ▼                          │
│  ┌─────────────────────────────┐  ┌─────────────────────────────────────┐  │
│  │  5a. HEALTHY PATH           │  │  5b. LLM FALLBACK (Adaptive)        │  │
│  │      Skip LLM               │  │      • Generate 10-15 anchor hints  │  │
│  │      Proceed to scoring     │  │      • Convert to 6-8 text queries  │  │
│  │      Cost: $0.00            │  │      • NO per-hint Find Place       │  │
│  │                             │  │      • Cost: ~$0.008 + $0.018       │  │
│  └─────────────────────────────┘  └─────────────────────────────────────┘  │
│                    │                              │                          │
│                    └──────────────┬───────────────┘                          │
│                                   ▼                                          │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  6. DEDUPE & QUALITY CONTROL                                        │   │
│  │     • Deduplicate by place_id (merge consensus)                     │   │
│  │     • Cap restaurant ratio (25%)                                    │   │
│  │     • Cap mall count (2)                                            │   │
│  │     • Compute final iconic scores                                   │   │
│  │     • Identify anchor candidates                                    │   │
│  └────────────────────────────────┬────────────────────────────────────┘   │
│                                   ▼                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  7. CACHE WRITE                                                     │   │
│  │     • Store top 200 candidates                                      │   │
│  │     • TTL: 14-30 days                                               │   │
│  │     • Future queries: $0.00                                         │   │
│  └────────────────────────────────┬────────────────────────────────────┘   │
│                                   ▼                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  OUTPUT TO OPTIMIZER                                                │   │
│  │     • candidates: RetrievalCandidate[]                              │   │
│  │     • anchors: RetrievalCandidate[]                                 │   │
│  │     • queryConsensus: Map<placeId, score>                           │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ═══════════════════════════════════════════════════════════════════════   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  8. WINNER-ONLY DETAILS (After Optimizer)                           │   │
│  │     • Called AFTER itinerary is built                               │   │
│  │     • Only for: itinerary places + top K backups                    │   │
│  │     • Fetches: opening_hours, phone, website, photos                │   │
│  │     • Cached per place_id (90-day TTL)                              │   │
│  │     • Cost: ~$0.12-0.17 (for 8-10 winners)                          │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Step-by-Step Pipeline

### Step 1: Cache Check
```typescript
const cached = cacheGetDestination(config);
if (cached) return cached; // Cost: $0.00
```

### Step 2: Text Search (Primary Recall)
```typescript
const queries = [
  'famous landmarks {dest}',      // Priority 1
  'must see attractions {dest}',  // Priority 1
  'top things to do {dest}',      // Priority 1
  'best museums {dest}',          // Priority 2
  'historic sites {dest}',        // Priority 2
  'best parks gardens {dest}',    // Priority 2
  'famous temples {dest}',        // Priority 2
  'best viewpoints {dest}',       // Priority 2
  // + 2-3 interest-based queries
];

// Run 8-10 queries, collect basic fields
for (query of queries) {
  results = await googleTextSearch(query, cityCenter);
  // Collect: place_id, name, coords, rating, review_count, types
}
```

### Step 3: Multi-Center Nearby Search
```typescript
// Identify centers from high-iconic text search results
const centers = buildMultiCenterPlan(initialCandidates, cityCenter, 5);
// centers = [cityCenter, landmark1, landmark2, ...]

// Run nearby searches at each center
const types = ['tourist_attraction', 'museum', 'park', 'church'];
for (center of centers) {
  for (type of types) {
    results = await googleNearbySearch(center, 3000, type);
  }
}
```

### Step 4: Recall Health Check
```typescript
const health = recallHealthCheck(candidates, config);

// Thresholds:
// - anchorCount >= tripDuration × 1.5
// - categoryBalance >= 0.4 (Shannon entropy)
// - restaurantRatio <= 0.4
// - highIconicCount >= 5
```

### Step 5: Adaptive LLM Fallback
```typescript
if (!health.isHealthy && budget.canCall('llmCalls')) {
  // Generate 10-15 anchor hints (NOT 40-70 seeds)
  const { hints, queries } = await llmAnchorFallback(dest, issues);

  // Convert hints to batched text searches
  // "Eiffel Tower Louvre Paris" (batch 2-3 per query)
  for (query of queries.slice(0, 8)) {
    results = await googleTextSearch(query);
  }
}
```

### Step 6: Dedupe & Score
```typescript
// Merge by place_id, combine consensus
const deduped = dedupeCandidates(allCandidates);

// Compute iconic scores
for (c of deduped) {
  c.iconicScore = reviewScore * 0.45 + ratingScore * 0.25 + typeWeight * 0.2 + consensusBonus;
  c.anchorCandidate = c.iconicScore > 0.5 && (c.reviewCount > 500 || c.consensus >= 2);
}

// Apply quality controls
filtered = applyQualityControls(deduped, { maxRestaurantRatio: 0.25 });
```

### Step 7: Cache Write
```typescript
cacheSetDestination(config, {
  candidates: filtered,
  anchors: filtered.filter(c => c.anchorCandidate),
  searchCenters,
}, TTL_14_DAYS);
```

### Step 8: Winner Details (Post-Optimizer)
```typescript
// Called AFTER optimizer builds itinerary
const winnerIds = selectWinnersForEnrichment(itinerary, candidates);
const details = await enrichWinnersWithDetails(winnerIds, apiKey, budget);

// Returns: opening_hours, phone, website, photos
// Cached per place_id for 90 days
```

---

## Recall Health Check Definition

### Inputs
- `candidates`: Current candidate pool
- `config`: Trip configuration (duration, pace, interests)

### Metrics

| Metric | Calculation | Healthy Threshold |
|--------|-------------|-------------------|
| `anchorCount` | Candidates with `iconicScore > 0.5` AND `(reviews > 500 OR consensus >= 2)` | >= `duration × 1.5` |
| `categoryBalance` | Shannon entropy of [landmark, museum, nature, religious, experience] / max_entropy | >= 0.4 |
| `restaurantRatio` | food_candidates / total_candidates | <= 0.4 |
| `highIconicCount` | Candidates with `iconicScore > 0.5` | >= 5 |
| `coverageScore` | Geographic spread (lat/lng variance) | > 0 |

### Health Score Formula
```
score = (anchorRatio × 0.40) + (categoryBalance × 0.25) + ((1 - restaurantRatio) × 0.20) + (iconicRatio × 0.15)

isHealthy = (anchorCount >= required) AND (categoryBalance >= 0.25) AND (restaurantRatio <= 0.5) AND (highIconicCount >= 3)
```

### Output
```typescript
{
  isHealthy: boolean,
  score: number,           // 0-1
  reasons: string[],       // Why unhealthy
  metrics: {...},
  requiredAnchors: number  // Based on trip
}
```

---

## Budget Table

### Typical Query (Cache Miss, Healthy Recall)

| Endpoint | Calls | Unit Cost | Total |
|----------|-------|-----------|-------|
| Geocoding | 1 | $0.005 | $0.005 |
| Text Search | 10 | $0.003 | $0.030 |
| Nearby Search | 16 | $0.003 | $0.048 |
| **Total** | **27** | | **$0.043** |

### Typical Query (Cache Miss, LLM Fallback Needed)

| Endpoint | Calls | Unit Cost | Total |
|----------|-------|-----------|-------|
| Geocoding | 1 | $0.005 | $0.005 |
| Text Search | 10 | $0.003 | $0.030 |
| Nearby Search | 12 | $0.003 | $0.036 |
| LLM (GPT-4o-mini) | 1 | $0.008 | $0.008 |
| LLM Text Search | 6 | $0.003 | $0.018 |
| **Total** | **30** | | **$0.047** |

### Cached Query

| Endpoint | Calls | Unit Cost | Total |
|----------|-------|-----------|-------|
| Cache Read | 1 | $0.000 | $0.000 |
| **Total** | **1** | | **$0.000** |

### Winner Details (Post-Optimizer)

| Endpoint | Calls | Unit Cost | Total |
|----------|-------|-----------|-------|
| Place Details | 8-12 | $0.017 | $0.136-0.204 |
| **Total** | **8-12** | | **$0.17 avg** |

### Budget Caps (Hard Limits)

| Resource | Limit | Rationale |
|----------|-------|-----------|
| Text Search | 12 | Primary recall driver |
| Nearby Search | 20 | 5 centers × 4 types |
| Find Place | 5 | Only for critical resolution |
| Place Details | 15 | Winners only |
| LLM Calls | 1 | Single fallback |
| **Hard Budget** | **$0.05** | Excludes winner details |

---

## Caching Design

### Destination Cache

**Key Format:**
```
dest:{city}:{country}:{language}:{season_bucket}
Example: dest:tokyo:japan:en:spring
```

**Stored Data:**
```typescript
{
  candidates: RetrievalCandidate[],  // Top 200
  anchors: RetrievalCandidate[],     // Pre-identified
  searchCenters: { lat, lng, name }[],
  generatedAt: ISO timestamp
}
```

**TTL:** 14-30 days (configurable)

**Behavior:**
- Read-through: Check cache first, return if hit
- Write-through: Always write after fresh retrieval
- No invalidation: Let TTL expire naturally

### Place Details Cache

**Key Format:**
```
place:{place_id}
Example: place:ChIJN1t_tDeuEmsRUsoyG83frY4
```

**Stored Data:**
```typescript
{
  placeId: string,
  name: string,
  formattedAddress: string,
  openingHours: {
    weekdayText: string[],
    periods: Array<{ open, close }>,
    specialHours: Array<{ date, open, close, isClosed }>
  },
  phoneNumber: string,
  website: string,
  photos: string[],
  wheelchair: boolean,
  fetchedAt: ISO timestamp
}
```

**TTL:** 90-180 days

**Lazy Refresh:**
```typescript
// Stale threshold: 7 days
if (age > 7_DAYS) {
  // Mark for background refresh
  // Still return cached data
  scheduleRefresh(placeId);
}
```

### Cache Impact on Cost

| Scenario | First Query | Subsequent Queries |
|----------|-------------|-------------------|
| Popular city (Tokyo, Paris) | $0.04 | $0.00 |
| Medium city (Kyoto, Lyon) | $0.04 | $0.00 |
| Small town | $0.05 | $0.00 |

**Expected cache hit rate after warmup: 60-80% for popular destinations**

---

## Edge Cases

### 1. Small Towns / Low-Data Regions

**Problem:** Text search returns few results, low review counts.

**Handling:**
```typescript
if (candidates.length < 20 && !budget.shouldSkipLLMFallback()) {
  // Lower thresholds for health check
  healthCheck.requiredAnchors = Math.max(2, duration);
  healthCheck.iconicThreshold = 0.3; // Lower bar

  // Expand search radius for nearby
  nearbyRadius = 5000; // 5km instead of 3km

  // LLM fallback more likely to trigger
}
```

### 2. Very Large Cities (Tokyo, NYC, London)

**Problem:** Too many results, need better filtering.

**Handling:**
```typescript
if (candidates.length > 150) {
  // Stricter quality controls
  applyQualityControls(candidates, {
    maxRestaurantRatio: 0.20,  // Stricter
    maxMallCount: 1,
    iconicThreshold: 0.55,     // Higher bar for anchors
  });

  // More search centers for coverage
  maxCenters = 6;
}
```

### 3. Cities with Multiple Separated Hubs

**Example:** Los Angeles, Dubai, Hong Kong

**Handling:**
```typescript
// Detect multi-hub via geographic spread
const latSpread = max(lats) - min(lats);
const lngSpread = max(lngs) - min(lngs);

if (latSpread > 0.1 || lngSpread > 0.1) { // ~10km spread
  // Force more search centers
  maxCenters = Math.min(8, maxCenters + 2);

  // Cluster-aware center selection
  centers = kMeansClusters(candidates, maxCenters);
}
```

### 4. Unknown Opening Hours

**Problem:** Many places lack opening_hours in API response.

**Handling:**
```typescript
// In optimizer, handle missing hours gracefully
if (!place.openingHours) {
  // Assume standard hours
  place.openingHours = {
    weekdayText: ['Assumed: 9:00 AM – 6:00 PM'],
    periods: DEFAULT_PERIODS,
    isAssumed: true
  };

  // Flag in UI
  activity.hoursNote = 'Hours not verified - check before visiting';
}
```

### 5. Seasonal Destinations

**Problem:** Some places are seasonal (ski resorts, beaches).

**Handling:**
```typescript
// Season bucket in cache key
const seasonBucket = getSeasonBucket(tripDate);
// 'summer' | 'winter' | 'shoulder'

// Different cache entries per season
cacheKey = `dest:${city}:${country}:${lang}:${seasonBucket}`;

// LLM prompt includes season context
prompt += `\nSeason: ${seasonBucket}. Include seasonal attractions.`;
```

---

## Integration Notes

### Files to Modify

#### 1. `lib/agents/agent2-researcher.ts`

**Current:** Direct Google Places nearby search with fixed types.

**Change:** Replace with `retrieveCandidates()` from new pipeline.

```typescript
// BEFORE
export async function runAgent2Researcher(parsedInput, onProgress) {
  const cityCoords = await getCityCoordinates(destination.city);
  for (const type of ATTRACTION_TYPES) {
    const places = await googleMapsMCP.searchPlaces(...);
  }
  // ...
}

// AFTER
import { retrieveCandidates, toOptimizerFormat } from '../retrieval/cost-effective-retrieval';

export async function runAgent2Researcher(parsedInput, onProgress) {
  const result = await retrieveCandidates({
    destination: parsedInput.parsed_data.destination.city,
    country: parsedInput.parsed_data.destination.country,
    interests: parsedInput.parsed_data.interests,
    tripDuration: parsedInput.parsed_data.dates.duration_days,
    pace: parsedInput.parsed_data.constraints.pace || 'moderate',
  }, process.env.GOOGLE_MAPS_API_KEY, process.env.OPENAI_API_KEY, onProgress);

  return toOptimizerFormat(result);
}
```

#### 2. `lib/agents/agent3-optimizer.ts`

**Current:** Uses `researchData.iconicCandidates` if available.

**Change:** Always use `iconicCandidates` from new pipeline (guaranteed to be populated).

```typescript
// BEFORE
let anchors = iconicCandidates.length > 0
  ? iconicCandidates.slice(0, days * config.maxAnchorsPerDay)
  : identifyIconicAnchors(allAttractions, days, config);

// AFTER
// iconicCandidates is always populated by new pipeline
let anchors = researchData.iconicCandidates.slice(0, days * config.maxAnchorsPerDay);

// Use queryConsensus for scoring bonus
const consensusBonus = researchData.queryConsensus.get(candidate.id) || 0;
const score = calculateFinalScore(candidate, interests, 0.6, lastLocation, [], consensusBonus);
```

#### 3. New File: `lib/agents/data-enricher.ts`

**Purpose:** Fetch Place Details for winners after optimizer runs.

```typescript
import { selectWinnersForEnrichment, enrichWinnersWithDetails, BudgetManager } from '../retrieval/cost-effective-retrieval';

export async function enrichItinerary(itinerary, candidates, budget) {
  const winnerIds = selectWinnersForEnrichment(itinerary, candidates);
  const details = await enrichWinnersWithDetails(winnerIds, apiKey, budget);

  // Merge details into itinerary
  for (const day of itinerary) {
    for (const activity of day.activities) {
      const detail = details.get(activity.activity.id);
      if (detail) {
        activity.activity.openingHours = detail.openingHours;
        activity.activity.phone = detail.phoneNumber;
        activity.activity.website = detail.website;
      }
    }
  }

  return itinerary;
}
```

#### 4. `lib/agents/orchestrator.ts`

**Change:** Add enrichment step after optimizer.

```typescript
// After optimizer
const itinerary = await runAgent3Optimizer(parsedInput, researchResult);

// NEW: Enrich winners with details
yield { agent: 'enricher', status: 'running', message: 'Fetching place details...' };
const enrichedItinerary = await enrichItinerary(
  Object.values(itinerary.itinerary),
  researchResult.candidates.attractions,
  new BudgetManager(0.20) // Separate budget for details
);
```

### Migration Checklist

- [ ] Create `lib/retrieval/` directory
- [ ] Add `cost-effective-retrieval.ts`
- [ ] Add caching infrastructure (Redis/Upstash for production)
- [ ] Update `agent2-researcher.ts` to use new pipeline
- [ ] Update `agent3-optimizer.ts` to use `iconicCandidates`
- [ ] Create `data-enricher.ts` for winner details
- [ ] Update `orchestrator.ts` to include enrichment step
- [ ] Add environment variable for cache configuration
- [ ] Add monitoring for cache hit rate and API costs
- [ ] Test with diverse destinations (city, island, park, region)

---

## Summary

| Metric | Old Pipeline | New Pipeline |
|--------|--------------|--------------|
| **Cost (typical)** | ~$0.03 | ~$0.04 |
| **Cost (cached)** | N/A | $0.00 |
| **Iconic recall** | Medium | High |
| **LLM usage** | None | Adaptive (when needed) |
| **Cache support** | None | Full |
| **Determinism** | High | High |
| **API calls** | ~19 | ~27-30 |

**Key Improvements:**
1. **Better iconic recall** via category-balanced text search
2. **Near-zero cost** for popular destinations via caching
3. **Adaptive LLM** only when Google-only retrieval fails
4. **Winner-only details** saves $0.10+ per query
5. **Graceful degradation** when budget exhausted
