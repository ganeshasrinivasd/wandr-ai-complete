# Iconic Retrieval Pipeline

## Architecture Overview

```
┌────────────────────────────────────────────────────────────────────────────┐
│                        ICONIC RETRIEVAL PIPELINE                          │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │  LAYER 1: RECALL (LLM Seeds)                                        │  │
│  │  ────────────────────────────────────────────────────────────────   │  │
│  │  • GPT-4o-mini generates 40-70 iconic place names                   │  │
│  │  • Grouped: landmarks / culture / nature / neighborhoods /          │  │
│  │             experiences / food-areas                                │  │
│  │  • Adaptive to destination type (city/island/park/region)           │  │
│  │  • Output: List of SeedEntry with name + whyIconic                  │  │
│  └─────────────────────────────────────────────────────────────────────┘  │
│                                    ↓                                       │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │  LAYER 2: GROUNDING (Google Places Resolution)                      │  │
│  │  ────────────────────────────────────────────────────────────────   │  │
│  │  • Find Place from Text API (precise matching)                      │  │
│  │  • Fallback: Text Search if Find Place fails                        │  │
│  │  • Computes resolution confidence (name similarity)                 │  │
│  │  • Output: GroundedPlace with place_id + coords + hours             │  │
│  └─────────────────────────────────────────────────────────────────────┘  │
│                                    ↓                                       │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │  LAYER 3: COVERAGE (Text Search Expansion)                          │  │
│  │  ────────────────────────────────────────────────────────────────   │  │
│  │  • 12+ query templates:                                             │  │
│  │    - "top attractions in {dest}"                                    │  │
│  │    - "{dest} must see places"                                       │  │
│  │    - "{dest} famous landmarks"                                      │  │
│  │    - "{dest} {user_interest}"                                       │  │
│  │  • Tracks query consensus (places found in multiple queries)        │  │
│  │  • Output: More GroundedPlaces + consensus scores                   │  │
│  └─────────────────────────────────────────────────────────────────────┘  │
│                                    ↓                                       │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │  LAYER 4: MULTI-CENTER NEARBY (Geographic Expansion)                │  │
│  │  ────────────────────────────────────────────────────────────────   │  │
│  │  • K-means clustering on initial results → 3-8 centers              │  │
│  │  • Small radius (3km) nearby search at each center                  │  │
│  │  • Catches local gems near iconic spots                             │  │
│  │  • Output: Additional GroundedPlaces                                │  │
│  └─────────────────────────────────────────────────────────────────────┘  │
│                                    ↓                                       │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │  LAYER 5: QUALITY CONTROL                                           │  │
│  │  ────────────────────────────────────────────────────────────────   │  │
│  │  • Dedupe by place_id (merge metadata)                              │  │
│  │  • Cap restaurant ratio (max 25%)                                   │  │
│  │  • Cap mall count (max 2)                                           │  │
│  │  • Compute final confidence scores                                  │  │
│  │  • Identify anchor candidates                                       │  │
│  │  • Output: Final ranked candidates + anchors                        │  │
│  └─────────────────────────────────────────────────────────────────────┘  │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

## Confidence Score Computation

Confidence flows through the pipeline and is computed at each layer:

### 1. Resolution Confidence (0-1)
How confident we are that the resolved Google Place matches the intended place.

```
resolutionConfidence = nameMatch(seedName, canonicalName)

Where nameMatch:
- Exact match → 1.0
- Contains → 0.85
- Word overlap ratio + 0.3 (capped at 0.9)
```

### 2. Consensus Score (0-1)
How many independent queries found this place.

```
consensusScore = min(1, foundInQueries / 5)

Seed sources: base 0.5
Text search: updated based on query hits
Nearby: base 0.3
```

### 3. Iconic Score (0-1)
Overall "fame" score combining multiple signals.

```
iconicScore =
    reviewScore × 0.40      // log10(reviews)/4.7
  + ratingScore × 0.25      // (rating-3.5)/1.5
  + consensusBonus × 0.20   // consensusScore
  + seedBonus × 0.15        // if from LLM seed
```

### 4. Final Confidence (0-1)
Combined confidence passed to optimizer.

```
confidence =
    resolutionConfidence × 0.50
  + consensusScore × 0.30
  + seedBonus × 0.20
```

### Anchor Candidate Selection

A place becomes an anchor candidate if:
```
(iconicScore > 0.5 AND confidence >= 0.6)
OR
(seedMatch AND resolutionConfidence > 0.7)
```

## Integration with Optimizer

The pipeline outputs data in a format compatible with the existing optimizer:

```typescript
const result = await runIconicRetrievalPipeline(config, openai, googleKey);
const optimizerInput = toOptimizerFormat(result);

// optimizerInput contains:
{
  candidates: {
    attractions: [...],  // With _retrievalConfidence, _isAnchorCandidate
    restaurants: [...],
    cafes: [...]
  },
  iconicCandidates: [...],  // Pre-identified anchors
  queryConsensus: Map<placeId, score>  // For scoring bonus
}
```

The optimizer should:
1. Use `iconicCandidates` as the primary anchor pool
2. Apply `queryConsensus.get(id)` bonus when scoring
3. Trust places with `_isAnchorCandidate = true` for day anchors
4. Use `_retrievalConfidence` to break ties

## Confidence Flow to Storyteller

The storyteller receives confidence data to craft appropriate descriptions:

| Confidence Level | Storyteller Behavior |
|------------------|---------------------|
| > 0.9 | "Don't miss..." / "The iconic..." |
| 0.7-0.9 | "Popular..." / "Highly recommended..." |
| 0.5-0.7 | "Consider visiting..." / "Worth exploring..." |
| < 0.5 | "You might enjoy..." / "If time permits..." |

## Destination Type Adaptations

The pipeline adapts seed generation based on destination type:

| Type | Emphasis | Example |
|------|----------|---------|
| `city` | Landmarks, neighborhoods, food areas | Tokyo, Paris |
| `island` | Beaches, nature, experiences | Bali, Santorini |
| `national_park` | Nature, trails, viewpoints | Yellowstone |
| `region` | Towns, scenic routes, local culture | Tuscany |
| `coastal` | Beaches, coastal towns, activities | Amalfi Coast |
| `mountain` | Peaks, trails, villages | Swiss Alps |
| `historic` | Ruins, temples, heritage sites | Angkor area |
| `multi_city` | Key cities, transit hubs | Japan tour |

## API Costs

Estimated Google Places API calls per retrieval:

| Layer | Calls | Cost Estimate |
|-------|-------|---------------|
| Seed Resolution | 40-70 | ~$0.07 |
| Text Search | 10-15 | ~$0.02 |
| Nearby Search | 15-40 | ~$0.03 |
| **Total** | **65-125** | **~$0.12** |

Plus OpenAI GPT-4o-mini: ~$0.01 for seed generation

**Total per retrieval: ~$0.13**

## Quality Metrics

Track these metrics to monitor retrieval quality:

```typescript
{
  seedResolutionRate: resolved / generated,  // Target: > 0.7
  anchorCoverage: anchors / days,            // Target: 1-2 per day
  categoryBalance: attractions / total,      // Target: > 0.5
  consensusRate: highConsensus / total,      // Target: > 0.3
  averageConfidence: sum(conf) / count,      // Target: > 0.6
}
```
