# WANDR AI - Architecture Documentation

> A cost-effective, agentic travel planning system using multi-agent orchestration

> Last Updated: January 17, 2026
> Version: 2.2 (with comprehensive agentic system analysis)

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [The 4-Agent Pipeline](#2-the-4-agent-pipeline)
3. [Orchestrator](#3-orchestrator)
4. [Planning Modules](#4-planning-modules)
5. [Validation Modules](#5-validation-modules)
6. [Deduplication System](#6-deduplication-system)
7. [Retrieval Pipeline](#7-retrieval-pipeline)
8. [Itinerary Decision Process](#8-itinerary-decision-process)
9. [Known Issues & Solutions](#9-known-issues--solutions)
10. [Data Types & Flow](#10-data-types--flow)
11. [Key Algorithms](#11-key-algorithms)
12. [API Endpoints](#12-api-endpoints)
13. [Performance & Cost](#13-performance--cost)
14. [File Structure](#14-file-structure)

---

## 1. System Overview

WANDR AI is a multi-agent travel planning system that generates optimized, day-by-day itineraries. The architecture follows a **sequential agent pipeline** where each agent has a specialized role:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           WANDR AI ARCHITECTURE                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   User Input                                                                │
│       │                                                                     │
│       ▼                                                                     │
│   ┌─────────────┐    ┌──────────────┐    ┌─────────────┐    ┌───────────┐ │
│   │   Agent 1   │───▶│   Agent 2    │───▶│   Agent 3   │───▶│  Agent 4  │ │
│   │   Parser    │    │  Researcher  │    │  Optimizer  │    │Storyteller│ │
│   └─────────────┘    └──────────────┘    └─────────────┘    └───────────┘ │
│         │                   │                   │                  │       │
│         ▼                   ▼                   ▼                  ▼       │
│   ParsedInput         Candidates          DayTimelines        Markdown     │
│   + Conflicts         + Anchors           + Feasibility       Narrative    │
│                                                                             │
│   ─────────────────── ORCHESTRATOR (SSE Streaming) ─────────────────────   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | Next.js 14 (React 18), TypeScript, TailwindCSS, Framer Motion |
| **Backend** | Next.js API Routes (Node.js) |
| **AI Models** | OpenAI GPT-4o-mini (parsing), Anthropic Claude Sonnet (storytelling) |
| **Database** | Supabase (PostgreSQL) |
| **Maps** | Google Maps API (places), Mapbox GL (visualization) |

### Design Principles

1. **Zone-First Planning** - Minimize cross-zone travel through geographic clustering
2. **Big Rock Detection** - Major attractions (theme parks, zoos) dominate their days
3. **Duplicate Prevention** - Geohash + Jaro-Winkler similarity for robust dedup
4. **Cost Awareness** - Aggressive caching, bounded API calls, deferred details
5. **Constraint Respect** - Strict restaurant validation, budget/time tracking
6. **Repair Over Failure** - Always attempt to fix infeasible days
7. **Streaming UX** - Real-time feedback via Server-Sent Events (SSE)

---

## 2. The 4-Agent Pipeline

### Agent 1: Parser (`lib/agents/agent1-parser.ts`)

**Purpose**: Validate and normalize user input into structured format.

**Model**: GPT-4o-mini with structured JSON output

**Input**: Raw user request (destination, dates, budget, constraints, interests)

**Processing**:
- Parses dates, budget amounts, trip duration
- Extracts constraints (accessibility, dietary, pace)
- Detects conflicts (e.g., "5-star hotels on $50/day budget")
- Generates clarification prompts for vague inputs

**Output**: `ParsedInput` object containing:
```typescript
{
  valid: boolean;
  parsed_data: {
    destination: { city, country };
    dates: { start, end, duration_days };
    travelers: { count, profiles };
    budget: { amount_per_day, currency, flexibility };
    constraints: { accessibility[], dietary[], pace, other[] };
    interests: string[];
  };
  conflicts: Conflict[];
  clarifications_needed: Clarification[];
}
```

**Error Handling**:
- Validates OpenAI response structure before accessing
- Falls back gracefully if no content returned

---

### Agent 2: Researcher (`lib/agents/agent2-researcher.ts`)

**Purpose**: Find candidate attractions, restaurants, and cafes using cost-effective retrieval.

**Strategy**: Multi-source retrieval with caching

```
┌─────────────────────────────────────────────────────────────────┐
│                  COST-EFFECTIVE RETRIEVAL                       │
├─────────────────────────────────────────────────────────────────┤
│  1. CACHE CHECK ──▶ Hit? Return cached candidates               │
│  2. TEXT SEARCH (8-10 queries) ──▶ Primary recall               │
│  3. MULTI-CENTER NEARBY (3-5 centers) ──▶ Coverage expansion    │
│  4. RECALL HEALTH CHECK ──▶ Is pool sufficient?                 │
│  5. [CONDITIONAL] LLM FALLBACK ──▶ Generate anchor hints        │
│  6. NEAR-DUPLICATE REMOVAL ──▶ Merge similar places             │
│  7. DEDUP & SCORE ──▶ Rank candidates                           │
│  8. CACHE WRITE ──▶ Store for future queries                    │
└─────────────────────────────────────────────────────────────────┘
```

**Output**:
```typescript
{
  candidates: {
    attractions: Candidate[];
    restaurants: Candidate[];
    cafes: Candidate[];
  };
  iconicCandidates: Candidate[];  // High-value anchors
  metadata: {
    cacheHit: boolean;
    estimatedCost: number;
    recallHealthScore: number;
  };
}
```

---

### Agent 3: Optimizer (`lib/agents/agent3-optimizer.ts`)

**Purpose**: Build feasible, optimized day-by-day itineraries.

**8-Phase Process**:

```
┌─────────────────────────────────────────────────────────────────┐
│                    OPTIMIZER PHASES                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Phase 1: DEDUP & ENRICH                                        │
│     ├── Remove duplicates (placeId + geohash + name)            │
│     ├── Near-duplicate merge (distance < 120m, similarity > 0.9)│
│     ├── Detect big rocks (theme parks, zoos)                    │
│     └── Assign durations based on category + signals            │
│                      │                                          │
│                      ▼                                          │
│  Phase 2: ZONE BUILDING                                         │
│     ├── K-means clustering by location                          │
│     ├── Merge nearby zones (< 2km)                              │
│     └── Calculate zone utilities                                │
│                      │                                          │
│                      ▼                                          │
│  Phase 3: DAY-ZONE ASSIGNMENT                                   │
│     ├── Big rock zones → dedicated days                         │
│     └── Regular zones → by utility score                        │
│                      │                                          │
│                      ▼                                          │
│  Phase 4: ACTIVITY SELECTION                                    │
│     ├── Select top activities per zone                          │
│     ├── Respect time budget (480-660 min/day)                   │
│     ├── Track usedIds AND usedDedupKeys                         │
│     └── Check near-duplicates within same day                   │
│                      │                                          │
│                      ▼                                          │
│  Phase 5: ROUTE ORDERING                                        │
│     ├── Nearest-neighbor TSP                                    │
│     └── 2-opt improvement                                       │
│                      │                                          │
│                      ▼                                          │
│  Phase 6: MEAL INJECTION                                        │
│     ├── Schedule lunch + dinner                                 │
│     ├── Select restaurants near activities                      │
│     └── CRITICAL: Validate no temples/museums in meals          │
│                      │                                          │
│                      ▼                                          │
│  Phase 7: FEASIBILITY CHECK                                     │
│     ├── Time budget validation                                  │
│     ├── Travel time limits                                      │
│     └── Anchor presence check                                   │
│                      │                                          │
│                      ▼                                          │
│  Phase 8: REPAIR LOOP                                           │
│     └── Fix infeasible days (reorder, swap, shrink, drop)       │
│                      │                                          │
│                      ▼                                          │
│  ASSERTION: No duplicates in final itinerary                    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Key Features**:
- Big Rock detection: Theme parks, zoos get dedicated days
- Zone-first planning: Minimize cross-zone travel
- **Duplicate prevention**: Tracks both `usedIds` AND `usedDedupKeys`
- **Near-duplicate detection**: Skips places within 120m with similar names
- Restaurant validation: Temples/museums never in meal slots
- **Assertions**: Validates no duplicates at end of optimization

---

### Agent 4: Storyteller (`lib/agents/agent4-storyteller.ts`)

**Purpose**: Convert structured itinerary into engaging narrative.

**Model**: Claude 3 Sonnet

**Approach**:
- Writes in 2nd person ("You'll start your day...")
- Includes Reddit quotes where available
- Maintains accessibility/dietary constraint info
- Adds practical details (costs, hours, booking tips)
- Fallback: Generates basic markdown if LLM fails

**Output**: Markdown-formatted itinerary with:
- Day themes
- Activity descriptions
- Travel directions
- Meal recommendations
- Pro tips

---

## 3. Orchestrator

**File**: `lib/agents/orchestrator.ts`

The orchestrator chains the 4 agents and manages streaming updates:

```typescript
async function* orchestratePlanGeneration(
  input: PlanInput
): AsyncGenerator<StreamUpdate> {
  // Agent 1: Parse
  yield { agent: 'parser', status: 'running' };
  const parsedInput = await runAgent1Parser(input);
  yield { agent: 'parser', status: 'complete', data: parsedInput };

  // Stop if conflicts found
  if (!parsedInput.valid && parsedInput.conflicts.length > 0) {
    yield { agent: 'parser', status: 'error', conflicts: parsedInput.conflicts };
    return;
  }

  // Agent 2: Research
  yield { agent: 'researcher', status: 'running' };
  const researchData = await runAgent2Researcher(parsedInput);
  yield { agent: 'researcher', status: 'complete', data: researchData };

  // Agent 3: Optimize
  yield { agent: 'optimizer', status: 'running' };
  const itinerary = await runAgent3Optimizer(parsedInput, researchData);
  yield { agent: 'optimizer', status: 'complete', data: itinerary };

  // Agent 4: Storytell
  yield { agent: 'storyteller', status: 'running' };
  const narrative = await runAgent4Storyteller(parsedInput, itinerary);
  yield { agent: 'storyteller', status: 'complete', data: narrative };
}
```

**Communication**:
- Agents pass structured data between stages
- Each stage yields `StreamUpdate` for real-time client feedback
- Stops immediately if parser finds hard conflicts

---

## 4. Planning Modules

### 4.1 Zone Builder (`lib/planning/zone-builder.ts`)

**Geographic clustering for day planning**

**Algorithm**: K-means clustering with K-means++ initialization

```
Optimal K = min(days, max(numDays + 2, 8))

K-means++ Initialization:
1. Pick first centroid randomly (weighted by utility)
2. For remaining centroids:
   - Compute distance to nearest existing centroid
   - Weight selection by distance² (diversity bias)
3. Run Lloyd's algorithm until convergence (max 20 iterations)
```

**Zone Merging**: Merge clusters < 2km apart
- Preserves high-utility zones
- Recomputes centroid after merge

**Day Assignment**:
1. Big rock zones → dedicated days first
2. Regular zones → assigned by utility score
3. Reuses best zones if not enough days

**Zone Utility Calculation**:
```
zoneUtility = Σ(candidateUtility × bonuses)

Bonuses:
- 50k+ reviews: 2x anchor bonus
- 10k+ reviews: 1.5x anchor bonus
- Big rock: 3x multiplier
```

---

### 4.2 Route Optimizer (`lib/planning/route-optimizer.ts`)

**Minimize travel within each day**

**Algorithm**: Nearest-Neighbor TSP + 2-Opt Improvement

```
Nearest-Neighbor:
1. Start from highest-utility activity (big rocks first)
2. While unvisited activities remain:
   - Add nearest unvisited activity
3. Return ordered route

2-Opt Improvement (for n ≤ 8):
1. For each pair (i, j) where i < j:
   - Reverse segment [i+1, j]
   - If new distance < old distance:
     - Accept reversal
2. Repeat until no improvement
```

**Travel Matrix**: Pre-compute pairwise travel times

```typescript
travelTime(a, b) = (haversine(a, b) / 20 km/h) × 60 + 5 min buffer
```

---

### 4.3 Meal Scheduler (`lib/planning/meal-scheduler.ts`)

**Inject meals with strict restaurant validation**

**Meal Intent Policies**:
| Intent | Description | When Used |
|--------|-------------|-----------|
| `booked` | Specific restaurant selected | High confidence days |
| `suggested` | Recommend a restaurant | Normal days |
| `area_only` | Suggest area, user picks | Big rock days |

**CRITICAL Restaurant Validation** (`isValidRestaurant()`):

```typescript
// EXCLUSION LIST - Never restaurants even if they serve food
const excludedTypes = [
  'hindu_temple', 'temple', 'buddhist_temple',
  'church', 'mosque', 'synagogue', 'place_of_worship',
  'tourist_attraction', 'museum', 'park', 'zoo'
];

const excludedNamePatterns = [
  'temple', 'mandir', 'kovil', 'gurdwara', 'masjid',
  'church', 'cathedral', 'museum', 'fort', 'palace'
];

// Must have valid restaurant type
const validTypes = ['restaurant', 'cafe', 'food', 'bakery', 'bar'];
```

**Restaurant Scoring**:
```
score = 0
score += rating × 2                    // 0-10 points
score += log10(reviewCount) × 2        // 0-10 points (popularity)
score += 20 if sameZone                // Zone bonus (critical!)
score -= distanceKm × 5                // Distance penalty
score += 5 if priceLevel in [1,3]      // Reasonable price bonus
```

**Meal Windows**:
| Meal | Window | Duration |
|------|--------|----------|
| Breakfast | 0-90 min | 45 min |
| Lunch | 210-330 min (11:30-1:30) | 60 min |
| Dinner | 480-600 min (8:00-10:00) | 60 min |

---

### 4.4 Duration Estimator (`lib/utils/duration-estimator.ts`)

**Estimate realistic visit durations**

**3-Part Strategy**:

**1. Category-Based Priors**:
| Category | Duration Range |
|----------|----------------|
| Theme Park | 300-600 min (5-10 hours) |
| Zoo | 180-300 min (3-5 hours) |
| Aquarium | 120-180 min (2-3 hours) |
| Museum | 90-180 min (1.5-3 hours) |
| Landmark | 30-60 min |
| Temple/Church | 30-90 min |
| Restaurant | 60-90 min |

**2. Name-Based Scale Detection**:
```
"Studios", "World", "Kingdom", "National" → +20-50%
"Viewpoint", "Tower", "Bridge" → -30%
Major keywords (Disney, Louvre, Smithsonian) → full-day
```

**3. Big Rock Detection (V2)**:
```
Type-name match (type: 'theme_park', name: 'Disney') → 95% confidence
Type + high reviews → 85% confidence
Name + very high reviews → 75% confidence
Upgrade to big rock if duration ≥ 300 min
```

**4. Modifiers**:
```
User pace: relaxed ×1.3, packed ×0.7
Review count: 50k+ → +20%, 20k+ → +10%
Operating hours: Cap at available hours
```

---

## 5. Validation Modules

### 5.1 Feasibility Checker (`lib/validation/feasibility-checker.ts`)

**Validates day timelines against constraints**

**6 Validation Checks**:

| Check | Threshold | Severity |
|-------|-----------|----------|
| Budget | Total time ≤ day budget | Error if > 60 min over |
| Daily Travel | Total ≤ 100 min | Warning |
| Per-Segment | Each leg ≤ 35 min | Warning |
| Anchor Presence | 1+ place with 30k+ reviews | Info |
| Meal Presence | ≥ 2 meals | Warning |
| Cross-Zone | Activities in assigned zone | Warning |

**Output**: Feasibility report with score (0-100)

---

### 5.2 Repair Engine (`lib/validation/repair-engine.ts`)

**Fixes infeasible days using a repair ladder**

**5-Strategy Hierarchy**:

```
┌────────────────────────────────────────────────────────────────┐
│                     REPAIR STRATEGIES                          │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  1. REORDER ──────▶ Re-optimize route (2-opt)                  │
│       │            Reduces travel time                         │
│       ▼                                                        │
│  2. SWAP ─────────▶ Replace low-utility activity               │
│       │            With shorter alternative from same zone     │
│       ▼                                                        │
│  3. SHRINK ───────▶ Reduce activity duration by up to 30 min   │
│       │            Only if flexibility exists                  │
│       ▼                                                        │
│  4. COMPRESS ─────▶ Reduce 15-min buffers to 5 min             │
│       │                                                        │
│       ▼                                                        │
│  5. DROP ─────────▶ Remove lowest-utility non-big-rock         │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

**Loop**: Iterates up to max iterations until feasible or stuck

---

## 6. Deduplication System

**File**: `lib/utils/dedup.ts`

### Strategy Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    DEDUP STRATEGY                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Phase 1: EXACT DEDUP by Canonical Key                          │
│     │                                                           │
│     ├── Primary: Google place_id                                │
│     │                                                           │
│     └── Fallback: normalizedName + geohash(precision=7)         │
│                   (~150m × 150m cells)                          │
│                                                                 │
│  Phase 2: NEAR-DUPLICATE MERGE                                  │
│     │                                                           │
│     └── Criteria: distance < 120m AND nameSimilarity > 0.9      │
│                   (Jaro-Winkler algorithm)                      │
│                                                                 │
│  Merge Strategy:                                                │
│     - Keep higher reviewCount & rating                          │
│     - Preserve best placeId                                     │
│     - Merge metadata from both                                  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Geohash Encoding

```
Precision 7 = ~150m × 150m cells

encodeGeohash(lat, lng, precision=7) → string
Example: encodeGeohash(17.385, 78.486, 7) → "tey1npk"
```

### Jaro-Winkler Similarity

```typescript
// Jaro similarity
jaro = (m/len1 + m/len2 + (m - t/2)/m) / 3
  where m = matching chars, t = transpositions

// Winkler modification (prefix bonus)
jaroWinkler = jaro + prefixLen × 0.1 × (1 - jaro)
  where prefixLen = common prefix length (max 4)

// Result: 0-1 where 1 = exact match
```

### Name Normalization

```typescript
normalizeName(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')       // Remove special chars
    .replace(/\s+/g, ' ')              // Collapse whitespace
    .replace(/\b(the|a|an|of)\b/g, '') // Remove articles
    .trim();
}

// "The Taj Mahal!" → "taj mahal"
```

### Instrumentation

```typescript
interface DedupStats {
  inputCount: number;
  exactDuplicates: number;
  nearDuplicates: number;
  outputCount: number;
}

// Logged during optimization:
// "Dedup stats: 154 input → 142 output"
// "  - Exact duplicates removed: 8"
// "  - Near-duplicates merged: 4"
```

### Day Builder Enforcement

The optimizer enforces uniqueness at multiple levels:

```typescript
// Global tracking across all days
const usedCandidateIds = new Set<string>();
const usedDedupKeys = new Set<string>();

// Per-day duplicate check
const isUsed = (c: EnrichedCandidate): boolean => {
  return usedIds.has(c.id) || usedDedupKeys.has(c.dedupKey);
};

// Near-duplicate check within same day
const wouldBeDuplicate = (c: EnrichedCandidate): boolean => {
  if (dayUsedKeys.has(c.dedupKey)) return true;
  for (const selected of selectedActivities) {
    if (areNearDuplicates(c, selected)) return true;
  }
  return false;
};
```

### Assertion at End

```typescript
function assertNoDuplicatesInTimelines(timelines: DayTimeline[]): void {
  // Check within each day
  // Check across days
  // Log detailed info if duplicates found
}
```

---

## 7. Retrieval Pipeline

**File**: `lib/retrieval/cost-effective-retrieval.ts`

### Cost Budget

| API Call | Cost | Limit |
|----------|------|-------|
| Text Search | ~$0.003 | 12 calls |
| Nearby Search | ~$0.003 | 20 calls |
| LLM Fallback | ~$0.008 | 1 call |
| Place Details | ~$0.017 | 15 calls (deferred) |
| **Total Target** | **≤$0.05** | per destination |

### Text Search Templates

```typescript
const TEXT_SEARCH_TEMPLATES = [
  // High priority
  'famous landmarks {dest}',
  'must see attractions {dest}',
  'top things to do {dest}',

  // Medium priority
  'best museums {dest}',
  'historic sites {dest}',
  'famous temples shrines {dest}',

  // Lower priority
  'hidden gems {dest}',
  'best neighborhoods {dest}',
];
```

### Recall Health Check

```typescript
interface RecallHealthResult {
  isHealthy: boolean;
  score: number;  // 0-1
  reasons: string[];
  metrics: {
    highIconicCount: number;   // Candidates with iconicScore > 0.5
    anchorCount: number;       // Strong anchor candidates
    categoryBalance: number;   // Shannon entropy normalized
    restaurantRatio: number;   // % restaurants (target < 40%)
    coverageScore: number;     // Geographic spread
  };
}

// Triggers LLM fallback if health < threshold
```

### Near-Duplicate Removal in Retrieval

After collecting all candidates, the retrieval pipeline runs a near-duplicate removal pass:

```typescript
// In STEP 7: FINAL SCORING
let finalCandidates = Array.from(candidateMap.values());

// Near-duplicate detection pass
const beforeNearDedupe = finalCandidates.length;
finalCandidates = removeNearDuplicates(finalCandidates);
// Logs: "Near-duplicates removed: X"
```

### Iconic Scoring

```
iconicScore = reviewScore × 0.45 + ratingScore × 0.25 + typeScore × 0.2 + consensusBonus

reviewScore = min(1, (log10(reviewCount) - 2) / 3)
ratingScore = max(0, (rating - 3.5) / 1.5)
typeScore = typeWeight[primaryType] (0.3-1.0)
consensusBonus = min(0.2, queriesFound × 0.05)
```

---

---

## 8. RAG System (Retrieval-Augmented Generation)

### Overview

WANDR AI includes a sophisticated RAG system built on Pinecone vector database for storing and retrieving travel knowledge. This system augments the agentic pipeline with curated travel expertise and learned patterns.

#### RAG Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           RAG KNOWLEDGE SYSTEM                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────┐    ┌──────────────────┐    ┌─────────────────────────┐ │
│  │  CITY KNOWLEDGE │    │   POLICY RULES   │    │  REPAIR PLAYBOOKS       │ │
│  │   (Namespace)   │    │   (Namespace)    │    │    (Namespace)          │ │
│  ├─────────────────┤    ├──────────────────┤    ├─────────────────────────┤ │
│  │ • Iconic Anchors│    │ • Hard Rules     │    │ • Duplicate Detection   │ │
│  │ • Big Rocks     │    │ • Soft Rules     │    │ • Duration Fixes        │ │
│  │ • Day Templates │    │ • Stage-specific │    │ • Travel Optimization   │ │
│  │ • Zone Maps     │    │ • Constraints    │    │ • Anchor Recovery       │ │
│  └─────────────────┘    └──────────────────┘    └─────────────────────────┘ │
│           │                       │                         │               │
│           ▼                       ▼                         ▼               │
│  ┌─────────────────────────────────────────────────────────────────────────┐ │
│  │                    PINECONE VECTOR DATABASE                             │ │
│  │  • OpenAI text-embedding-3-small (1536 dimensions)                     │ │
│  │  • Cosine similarity matching                                          │ │
│  │  • Semantic search with metadata filtering                             │ │
│  │  • 30-minute embedding cache for performance                           │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Knowledge Types

#### 1. City Knowledge (`city_knowledge` namespace)

**Iconic Anchors**: Must-see attractions with curated metadata
```typescript
interface IconicAnchor {
  name: string;
  location: { lat: number; lng: number };
  zone: string;
  category: string;
  typical_duration_min: number;
  best_time: ('morning' | 'afternoon' | 'evening')[];
  nearby_pairings: string[];  // Smart pairing suggestions
  accessibility: { wheelchair: 'full' | 'partial' | 'none' };
}
```

**Big Rocks**: Full-day attractions requiring dedicated days
```typescript
interface BigRock {
  name: string;
  min_duration_min: number;
  preferred_duration_min: number;
  requires_full_day: boolean;
  max_companions: number;      // Max additional activities
  best_start_time: string;     // Optimal start time
  companion_suggestions: string[];
}
```

**Day Templates**: Proven itinerary patterns
```typescript
interface DayTemplate {
  theme: string;
  zones: string[];
  is_big_rock_day: boolean;
  pace: 'relaxed' | 'moderate' | 'packed';
  anchor_sequence: Array<{
    name: string;
    slot: 'morning' | 'midday' | 'afternoon' | 'evening';
    duration_min: number;
  }>;
  energy_curve: ('high' | 'medium' | 'low')[];
}
```

**Zone Maps**: Geographic clustering knowledge
```typescript
interface CityZone {
  name: string;
  centroid: { lat: number; lng: number };
  radius_km: number;
  character: string;           // "Historic", "Modern", "Shopping"
  best_for: string[];
  adjacent_zones: string[];
  typical_duration_hours: number;
}
```

#### 2. Policy Rules (`policy_rules` namespace)

**Hard Rules**: Must-follow constraints
- "Never schedule temples during meal slots"
- "Big rocks require minimum 4 hours"
- "Maximum 2 hours travel per day"

**Soft Rules**: Preferences and optimizations
- "Prefer morning visits for outdoor attractions"
- "Group activities by zone to minimize travel"
- "Schedule high-energy activities early"

#### 3. Repair Playbooks (`repair_playbooks` namespace)

**Duplicate Detection**: Patterns for identifying duplicates
```typescript
interface RepairPlaybook {
  failure_type: 'duplicate' | 'duration' | 'travel' | 'anchor';
  detection_pattern: {
    same_place_id?: boolean;
    or_same_dedupkey?: boolean;
    duration_threshold_min?: number;
  };
  strategies: Array<{
    name: string;
    priority: number;
    action: string;
    pseudocode: string;
  }>;
}
```

### RAG Integration Points

#### Agent 2 (Researcher) Enhancement
```typescript
// Query for city-specific anchors
const anchors = await queryAnchors(
  city, 
  buildAnchorQuery(city, interests), 
  topK: 20
);

// Boost iconic candidates in scoring
candidates.forEach(c => {
  if (anchors.some(a => a.name === c.name)) {
    c.iconicScore += 0.3; // RAG boost
  }
});
```

#### Agent 3 (Optimizer) Enhancement
```typescript
// Query for big rock knowledge
const bigRocks = await queryBigRocks(city, buildBigRockQuery(city));

// Apply learned duration patterns
bigRocks.forEach(br => {
  const candidate = candidates.find(c => c.name === br.name);
  if (candidate) {
    candidate.durationExpected = br.preferred_duration_min;
    candidate.isBigRock = br.requires_full_day;
  }
});

// Query for day templates
const templates = await queryTemplates(
  city, 
  buildTemplateQuery(city, days, interests)
);

// Use templates to guide day structure
templates.forEach(template => {
  if (template.is_big_rock_day) {
    // Apply big rock day pattern
    applyBigRockDayTemplate(template);
  }
});
```

#### Repair Engine Enhancement
```typescript
// Query for repair strategies
const playbooks = await queryRepairPlaybooks(
  failureType, 
  buildPlaybookQuery(failureType, context)
);

// Apply learned repair strategies
playbooks.forEach(playbook => {
  playbook.strategies
    .sort((a, b) => a.priority - b.priority)
    .forEach(strategy => {
      if (canApplyStrategy(strategy, timeline)) {
        applyRepairStrategy(strategy, timeline);
      }
    });
});
```

### Embedding Strategy

**Text Embedding Model**: OpenAI `text-embedding-3-small`
- **Dimensions**: 1536
- **Cost**: ~$0.00002 per 1K tokens
- **Performance**: 30-minute in-memory cache

**Query Building**:
```typescript
// Anchor queries
buildAnchorQuery(city, interests) → 
  "Hyderabad iconic landmarks must-see attractions history food"

// Big rock queries  
buildBigRockQuery(city) →
  "Hyderabad full day attractions theme parks film city zoo aquarium"

// Template queries
buildTemplateQuery(city, days, interests) →
  "5 day itinerary Hyderabad history food travel plan"
```

**Semantic Matching**: Cosine similarity with metadata filtering
```typescript
// Example query with filters
await queryPinecone({
  namespace: 'city_knowledge',
  query: embedding,
  topK: 20,
  filter: {
    city: { $eq: 'hyderabad' },
    doc_type: { $eq: 'anchor' },
    confidence: { $gte: 0.8 }
  }
});
```

### Knowledge Curation Workflow

#### 1. Data Collection
- Manual curation of iconic attractions per city
- Analysis of successful itineraries
- Pattern extraction from user feedback
- Integration of local expertise

#### 2. Document Preparation
```typescript
// Anchor document creation
const anchorDoc: AnchorDocument = {
  id: `anchor_${city}_${placeId}`,
  doc_type: 'anchor',
  city: city.toLowerCase(),
  content: buildAnchorContent(anchor), // Natural language description
  structured_data: {
    name: "Charminar",
    location: { lat: 17.3616, lng: 78.4747 },
    category: "historic_landmark",
    typical_duration_min: 90,
    best_time: ['morning', 'evening'],
    nearby_pairings: ['Laad Bazaar', 'Mecca Masjid']
  },
  confidence: 0.95,
  last_verified: "2026-01-15",
  version: "1.0"
};
```

#### 3. Embedding & Indexing
```typescript
// Generate embeddings and upsert to Pinecone
await upsertAnchors([anchorDoc]);
await upsertBigRocks([bigRockDoc]);
await upsertTemplates([templateDoc]);
```

### Performance & Costs

**Typical RAG Query Costs**:
| Operation | Embedding Cost | Pinecone Cost | Total |
|-----------|----------------|---------------|-------|
| Anchor Query | ~$0.0001 | ~$0.0001 | ~$0.0002 |
| Big Rock Query | ~$0.0001 | ~$0.0001 | ~$0.0002 |
| Template Query | ~$0.0001 | ~$0.0001 | ~$0.0002 |
| **Total per City** | **~$0.0003** | **~$0.0003** | **~$0.0006** |

**Cache Hit Rates**:
- Embedding Cache: ~80% (30-minute TTL)
- Knowledge Cache: ~60% (city-level caching)
- **Effective Cost**: ~$0.0002 per query with caching

### Future RAG Enhancements

#### 1. Dynamic Learning
- Automatic pattern extraction from successful itineraries
- User feedback integration for anchor scoring
- Seasonal pattern learning (weather, events, crowds)

#### 2. Multi-Modal Knowledge
- Image embeddings for visual attraction matching
- Review sentiment analysis integration
- Real-time event and closure data

#### 3. Personalization
- User preference learning and storage
- Collaborative filtering for similar travelers
- Dynamic template generation based on user history

---

## 9. Itinerary Decision Process

### How the Agentic System Decides Your Itinerary

The WANDR AI system uses a sophisticated 4-agent pipeline where each agent has specialized responsibilities. Here's exactly how your itinerary gets decided:

#### Agent Flow & Decision Making

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        AGENTIC DECISION PIPELINE                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  USER INPUT: "5 days in Hyderabad, $200/day, history & food"               │
│       │                                                                     │
│       ▼                                                                     │
│  ┌─────────────┐  AGENT 1: PARSER (GPT-4o-mini)                            │
│  │   PARSER    │  ├── Validates: dates, budget, constraints                │
│  │             │  ├── Extracts: destination, interests, pace               │
│  │             │  ├── Detects conflicts: "5-star hotels on $50/day"        │
│  │             │  └── Output: Structured ParsedInput                       │
│  └─────────────┘                                                           │
│       │                                                                     │
│       ▼                                                                     │
│  ┌─────────────┐  AGENT 2: RESEARCHER (Cost-Effective Retrieval)           │
│  │ RESEARCHER  │  ├── Text Search: "famous landmarks Hyderabad" (8-10 queries) │
│  │             │  ├── Nearby Search: Multi-center coverage (3-5 centers)   │
│  │             │  ├── LLM Fallback: Only if recall health < threshold       │
│  │             │  ├── Deduplication: Geohash + Jaro-Winkler similarity     │
│  │             │  └── Output: ~150-200 candidates (attractions/restaurants) │
│  └─────────────┘                                                           │
│       │                                                                     │
│       ▼                                                                     │
│  ┌─────────────┐  AGENT 3: OPTIMIZER (8-Phase Zone-First Planning)         │
│  │ OPTIMIZER   │  ├── Phase 1: Dedup & Enrich (detect big rocks)          │
│  │             │  ├── Phase 2: Zone Building (K-means clustering)          │
│  │             │  ├── Phase 3: Day-Zone Assignment (big rocks get days)    │
│  │             │  ├── Phase 4: Activity Selection (budget constraints)     │
│  │             │  ├── Phase 5: Route Ordering (TSP optimization)           │
│  │             │  ├── Phase 6: Meal Injection (restaurant validation)      │
│  │             │  ├── Phase 7: Feasibility Check (time/travel limits)      │
│  │             │  └── Phase 8: Repair Loop (fix infeasible days)           │
│  └─────────────┘                                                           │
│       │                                                                     │
│       ▼                                                                     │
│  ┌─────────────┐  AGENT 4: STORYTELLER (Claude 3 Sonnet)                   │
│  │STORYTELLER  │  ├── Converts structured data to narrative                │
│  │             │  ├── Adds Reddit quotes & local insights                  │
│  │             │  ├── Includes practical details (costs, hours)            │
│  │             │  └── Output: Engaging markdown itinerary                  │
│  └─────────────┘                                                           │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### Key Decision Factors

**1. Zone-First Planning Philosophy**
- The system clusters attractions geographically using K-means clustering
- Each day is assigned to a primary zone to minimize cross-city travel
- Big rocks (theme parks, major attractions) get dedicated days

**2. Big Rock Detection Algorithm**
```typescript
// Detects major attractions that should dominate a day
isBigRock = (
  (type === 'theme_park' || type === 'zoo' || type === 'aquarium') ||
  (reviewCount > 50000 && estimatedDuration > 300 minutes) ||
  (name.includes('World', 'Studios', 'Kingdom') && reviewCount > 20000)
)
```

**3. Restaurant Selection Criteria**
```typescript
// CRITICAL: Strict restaurant validation to prevent temples in meal slots
isValidRestaurant = (
  !excludedTypes.includes(googleType) &&           // Not temple/museum
  !excludedNamePatterns.some(p => name.includes(p)) && // Not "temple", "mandir"
  validTypes.includes(googleType)                   // Actually restaurant/cafe
)
```

**4. Activity Selection Algorithm**
```typescript
// For each day, select activities based on:
utilityScore = (
  rating * 2 +                           // 0-10 points (quality)
  log10(reviewCount) * 2 +               // 0-10 points (popularity)  
  (isBigRock ? 5 : 0) +                  // Big rock bonus
  (sameZone ? 20 : 0) +                  // Zone coherence bonus
  (iconicScore > 0.5 ? 3 : 0)            // Iconic attraction bonus
)
```

#### The Hyderabad Issue: Root Cause Analysis

**Problem**: The system is repeatedly selecting "Erragadda Model Rythu Bazaar" for meals, which appears to be a market/bazaar, not a restaurant.

**Root Cause**: Restaurant validation failure in the meal scheduler

**Why This Happens**:

1. **Insufficient Restaurant Pool**: The researcher may not be finding enough valid restaurants in Hyderabad
2. **Validation Bypass**: The market might have `restaurant` in its Google types despite being primarily a market
3. **Zone Scoring**: The bazaar might be scoring high due to zone proximity, overriding restaurant validation

**Current Validation Logic**:
```typescript
// This should catch markets, but might be failing
const excludedTypes = [
  'tourist_attraction', 'museum', 'park', 'zoo'
  // Missing: 'market', 'shopping_mall', 'store'
];

const excludedNamePatterns = [
  'temple', 'mandir', 'museum', 'fort'
  // Missing: 'bazaar', 'market', 'rythu'
];
```

---

## 10. Known Issues & Solutions

### Issue 1: Markets/Bazaars Selected as Restaurants

**Symptom**: "Erragadda Model Rythu Bazaar" appearing in meal slots

**Root Cause**: Incomplete restaurant validation patterns

**Solution**: Enhanced restaurant validation

```typescript
// ENHANCED EXCLUSION PATTERNS
const excludedTypes = [
  'hindu_temple', 'temple', 'buddhist_temple',
  'church', 'mosque', 'synagogue', 'place_of_worship',
  'tourist_attraction', 'museum', 'park', 'zoo',
  'market', 'shopping_mall', 'store', 'supermarket',  // ADD THESE
  'establishment', 'point_of_interest'                // ADD THESE
];

const excludedNamePatterns = [
  'temple', 'mandir', 'kovil', 'gurdwara', 'masjid',
  'church', 'cathedral', 'museum', 'fort', 'palace',
  'bazaar', 'market', 'rythu', 'mandi',              // ADD THESE
  'shopping', 'mall', 'store', 'supermarket'         // ADD THESE
];
```

### Issue 2: Insufficient Restaurant Discovery

**Symptom**: Limited restaurant options leading to poor selections

**Root Cause**: Text search queries not optimized for restaurants

**Solution**: Enhanced restaurant search templates

```typescript
const RESTAURANT_SEARCH_TEMPLATES = [
  'best restaurants {dest}',
  'top rated restaurants {dest}',
  'popular local restaurants {dest}',
  'famous food places {dest}',
  '{dest} restaurant recommendations',
  'where to eat {dest}',
  'local cuisine {dest}',
  'street food {dest}'  // Important for Indian cities
];
```

### Issue 3: Zone Assignment Issues

**Symptom**: Activities scattered across city despite zone-first planning

**Root Cause**: K-means clustering may create unbalanced zones

**Solution**: Zone validation and rebalancing

```typescript
// Validate zone quality after clustering
function validateZones(zones: Zone[]): boolean {
  for (const zone of zones) {
    // Check zone has sufficient attractions
    if (zone.candidates.length < 2) return false;
    
    // Check zone geographic coherence (max 5km diameter)
    const maxDistance = getMaxIntraZoneDistance(zone);
    if (maxDistance > 5000) return false;
  }
  return true;
}
```

### Issue 4: Meal Timing Problems

**Symptom**: Meals scheduled at inappropriate times

**Root Cause**: Meal window insertion logic not accounting for activity flow

**Solution**: Improved meal scheduling

```typescript
// Better meal window logic
const MEAL_WINDOWS = {
  lunch: [660, 810],    // 11:00 AM - 1:30 PM
  dinner: [1080, 1200], // 6:00 PM - 8:00 PM
};

// Prefer inserting meals AFTER activities, not during travel
function findMealInsertionPoint(slots, windowStart, windowEnd) {
  // Look for activity endings within meal window
  for (const slot of slots) {
    if (slot.type === 'activity' && 
        slot.endMin >= windowStart && 
        slot.endMin <= windowEnd) {
      return slot.index + 1; // Insert after activity
    }
  }
}
```

---

## 11. Data Types & Flow

### Input Flow

```
PlanInput (raw strings)
       │
       ▼
ParsedInput (structured)
  ├── destination: { city, country }
  ├── dates: { start, end, duration_days }
  ├── travelers: { count, profiles }
  ├── budget: { amount_per_day, currency, flexibility }
  ├── constraints: { accessibility[], dietary[], pace, other[] }
  └── interests: string[]
```

### Candidate Flow

```
RetrievalCandidate (from Google Maps)
       │
       ▼
EnrichedCandidate (after enrichment)
  ├── id: string
  ├── placeId?: string
  ├── name: string
  ├── normalizedName: string
  ├── location: { lat, lng }
  ├── googleTypes: string[]
  ├── rating: number
  ├── reviewCount: number
  │
  ├── category: ActivityCategory
  ├── categoryConfidence: number
  ├── isBigRock: boolean
  ├── bigRockType?: string
  │
  ├── durationMin: number
  ├── durationMax: number
  ├── durationExpected: number
  │
  ├── dedupKey: string      ← Canonical ID for dedup
  ├── isGeneric: boolean
  ├── utilityScore: number
  └── zoneId?: number
```

### Timeline Flow

```
DayTimeline (internal)
  ├── dayIndex: number
  ├── zoneId: number
  ├── isBigRockDay: boolean
  ├── bigRock?: EnrichedCandidate
  │
  ├── slots: TimelineSlot[]
  │   └── { type, startMin, endMin, duration, candidate?, mealSlot?, travel? }
  │
  ├── totalActivityMin: number
  ├── totalTravelMin: number
  ├── totalMealMin: number
  ├── totalBufferMin: number
  │
  ├── budgetUsed: number
  └── budgetRemaining: number
       │
       ▼
DayItinerary (output)
  ├── day: number
  ├── date: string
  ├── theme: string
  ├── neighborhood: string
  ├── activities: Activity[]
  └── day_summary: { total_cost, total_walking_km, ... }
       │
       ▼
Itinerary (final)
  ├── itinerary: { day_1, day_2, ... }
  └── overall_summary: { total_budget, constraint_compliance, ... }
```

---

## 12. Key Algorithms

### K-Means Clustering

```
Input: candidates[], k
Output: zones[] with centroids

1. INITIALIZATION (K-means++):
   centroids = [randomCandidate(weighted by utility)]
   for i = 1 to k-1:
     distances = [minDist(c, centroids) for c in candidates]
     weights = distances²
     centroids.push(weightedRandom(candidates, weights))

2. LLOYD'S ALGORITHM:
   repeat (max 20 iterations):
     // Assignment
     for each candidate:
       candidate.zone = argmin(dist(candidate, centroid))

     // Update
     for each zone:
       centroid = mean(zone.candidates)

     if no changes: break

3. MERGE NEARBY:
   while any pair of zones < 2km apart:
     merge lowest-utility pair
```

### Nearest-Neighbor TSP

```
Input: activities[], travelMatrix
Output: orderedActivities[]

1. START:
   current = highestUtility(activities)
   route = [current]
   unvisited = activities - {current}

2. GREEDY:
   while unvisited not empty:
     next = argmin(travelMatrix[current][u] for u in unvisited)
     route.append(next)
     unvisited.remove(next)
     current = next

3. 2-OPT IMPROVEMENT (if n ≤ 8):
   improved = true
   while improved:
     improved = false
     for i in 0..n-2:
       for j in i+2..n-1:
         if swap improves total distance:
           reverse(route[i+1:j+1])
           improved = true
```

### Haversine Distance

```
Input: (lat1, lng1), (lat2, lng2)
Output: distance in km

R = 6371  // Earth radius in km
dLat = toRad(lat2 - lat1)
dLng = toRad(lng2 - lng1)

a = sin²(dLat/2) + cos(lat1) × cos(lat2) × sin²(dLng/2)
c = 2 × atan2(√a, √(1-a))

distance = R × c
```

### Jaro-Winkler Algorithm

```
Input: s1, s2 (strings)
Output: similarity (0-1)

1. JARO SIMILARITY:
   matchDistance = floor(max(len(s1), len(s2)) / 2) - 1
   matches = count matching chars within matchDistance
   transpositions = count out-of-order matches / 2

   jaro = (m/len1 + m/len2 + (m - t)/m) / 3

2. WINKLER MODIFICATION:
   prefixLen = common prefix length (max 4)
   jaroWinkler = jaro + prefixLen × 0.1 × (1 - jaro)
```

---

## 13. API Endpoints

### POST `/api/plan/generate`

**Request**:
```json
{
  "destination": "Hyderabad, India",
  "dates": "January 20-24, 2026",
  "budget": "$200/day",
  "travelers": "2 adults",
  "interests": ["history", "food", "culture"],
  "constraints": "vegetarian, moderate pace"
}
```

**Response** (SSE Stream):
```
data: {"agent":"parser","status":"running","message":"Validating input..."}
data: {"agent":"parser","status":"complete","data":{...}}
data: {"agent":"researcher","status":"running","message":"Finding places..."}
data: {"agent":"researcher","status":"complete","data":{...}}
data: {"agent":"optimizer","status":"running","message":"Building itinerary..."}
data: {"agent":"optimizer","status":"complete","data":{...}}
data: {"agent":"storyteller","status":"running","message":"Writing narrative..."}
data: {"agent":"storyteller","status":"complete","data":{...}}
data: {"status":"complete","planId":"uuid","message":"Plan saved!"}
```

### GET `/api/plan/[id]`

**Response**:
```json
{
  "id": "uuid",
  "destination": "Hyderabad, India",
  "duration_days": 4,
  "itinerary": { ... },
  "narrative": "## Day 1: Historic Old City\n\nYou'll start your day...",
  "created_at": "2026-01-16T..."
}
```

### GET `/api/places/autocomplete`

**Query**: `?input=Hyd`

**Response**:
```json
{
  "predictions": [
    {
      "description": "Hyderabad, Telangana, India",
      "place_id": "ChIJx9Lr6tqZyzsRwvu6koO3k64"
    }
  ]
}
```

---

## 14. Performance & Cost

### Typical Execution

| Stage | Time | Cost |
|-------|------|------|
| Parser | 2-3 sec | ~$0.001 |
| Researcher | 10-15 sec | ~$0.03-0.05 |
| Researcher (cached) | <1 sec | ~$0.001 |
| Optimizer | 5-10 sec | $0 (local) |
| Storyteller | 5-8 sec | ~$0.02 |
| **Total** | **30-50 sec** | **$0.05-0.08** |

### Caching

- **Destination Cache**: 14-day TTL, stores candidates + anchors
- **Place Details Cache**: 90-day TTL, stores opening hours + photos
- **Hit Rate**: ~60% for popular destinations
- **Cost with Cache**: Near-zero for repeat queries

### Memory Footprint

- Typical candidate pool: 100-200 places
- Per-candidate memory: ~2KB
- Timeline per day: ~5KB
- Total working memory: ~50-100MB per request

---

## 14. File Structure

```
lib/
├── agents/
│   ├── agent1-parser.ts      # Input validation & structuring
│   ├── agent2-researcher.ts  # Candidate retrieval
│   ├── agent3-optimizer.ts   # Itinerary optimization
│   ├── agent4-storyteller.ts # Narrative generation
│   └── orchestrator.ts       # Agent coordination
│
├── planning/
│   ├── types.ts              # Core type definitions
│   ├── zone-builder.ts       # K-means clustering
│   ├── route-optimizer.ts    # TSP + 2-opt
│   └── meal-scheduler.ts     # Meal injection + validation
│
├── validation/
│   ├── feasibility-checker.ts # Constraint validation
│   └── repair-engine.ts       # Itinerary repair
│
├── retrieval/
│   └── cost-effective-retrieval.ts # Google Maps API wrapper
│
└── utils/
    ├── dedup.ts              # Deduplication (geohash + Jaro-Winkler)
    ├── duration-estimator.ts # Visit duration estimation
    └── types.ts              # Shared types

app/
├── api/
│   ├── places/
│   │   └── autocomplete/route.ts  # Location autocomplete
│   └── plan/
│       ├── generate/route.ts      # POST /api/plan/generate
│       └── [id]/route.ts          # GET /api/plan/[id]
│
├── planner/page.tsx          # Input form UI
├── plan/
│   ├── generating/page.tsx   # Generation progress UI
│   └── [id]/page.tsx         # Itinerary display UI
│
components/
├── LocationAutocomplete.tsx  # Destination input with suggestions
├── DayMap.tsx               # Mapbox day visualization
└── ...
```

---

*Generated: January 17, 2026*
*Version: 2.2 (with comprehensive agentic system analysis and Hyderabad issue fixes)*
