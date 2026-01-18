/**
 * Iconic Place Retrieval Pipeline
 *
 * A generalized multi-layer funnel for retrieving truly iconic places
 * for ANY destination type (city, region, island, national park, etc.)
 *
 * ARCHITECTURE:
 * ┌─────────────────────────────────────────────────────────────────┐
 * │  Layer 1: RECALL (LLM Seeds)                                   │
 * │  → Generate 30-80 iconic place names via LLM                   │
 * │  → Grouped: landmarks/culture/nature/neighborhoods/experiences │
 * └─────────────────────────────────────────────────────────────────┘
 *                              ↓
 * ┌─────────────────────────────────────────────────────────────────┐
 * │  Layer 2: GROUNDING (Google Places Resolution)                 │
 * │  → Resolve each seed to place_id + coords + hours              │
 * │  → Track resolution confidence                                 │
 * └─────────────────────────────────────────────────────────────────┘
 *                              ↓
 * ┌─────────────────────────────────────────────────────────────────┐
 * │  Layer 3: COVERAGE (Text Search Expansion)                     │
 * │  → Multiple query templates to catch missed places             │
 * │  → Query consensus tracking                                    │
 * └─────────────────────────────────────────────────────────────────┘
 *                              ↓
 * ┌─────────────────────────────────────────────────────────────────┐
 * │  Layer 4: MULTI-CENTER NEARBY (Geographic Expansion)           │
 * │  → Auto-detect 3-8 search centers from initial results         │
 * │  → Small radius nearby searches around each centroid           │
 * └─────────────────────────────────────────────────────────────────┘
 *                              ↓
 * ┌─────────────────────────────────────────────────────────────────┐
 * │  Layer 5: QUALITY CONTROL (Dedupe + Ranking)                   │
 * │  → Deduplicate by place_id                                     │
 * │  → Cap category dominance                                      │
 * │  → Compute final confidence scores                             │
 * └─────────────────────────────────────────────────────────────────┘
 */

import OpenAI from 'openai';

// =============================================================================
// TYPES & SCHEMAS
// =============================================================================

/**
 * Destination type detection for adaptive retrieval
 */
export type DestinationType =
  | 'city'           // Tokyo, Paris, NYC
  | 'region'         // Tuscany, Provence, Rajasthan
  | 'island'         // Bali, Santorini, Maui
  | 'national_park'  // Yellowstone, Banff, Kruger
  | 'coastal'        // Amalfi Coast, French Riviera
  | 'mountain'       // Swiss Alps, Himalayas
  | 'historic'       // Angkor Wat area, Petra region
  | 'multi_city';    // Japan trip, Italy tour

/**
 * Seed categories for structured recall
 */
export interface IconicSeeds {
  destination: string;
  destinationType: DestinationType;

  // Core categories (always populated)
  landmarks: SeedEntry[];        // Famous monuments, structures, viewpoints
  cultural: SeedEntry[];         // Museums, temples, historic sites
  nature: SeedEntry[];           // Parks, gardens, natural wonders

  // Context-dependent categories
  neighborhoods: SeedEntry[];    // Distinct areas worth exploring
  experiences: SeedEntry[];      // Activities, markets, unique experiences
  foodAreas: SeedEntry[];        // Food streets, market halls, culinary districts

  // Metadata
  generatedAt: string;
  seedCount: number;
  llmModel: string;
}

export interface SeedEntry {
  name: string;                  // "Eiffel Tower", "Tsukiji Outer Market"
  category: string;              // Subcategory for variety tracking
  whyIconic: string;             // Brief reason (for storyteller context)
  expectedType?: string;         // Hint for Google Places type
  isNeighborhood?: boolean;      // Flag for neighborhood-type seeds
}

/**
 * Grounded place with full Google Places data
 */
export interface GroundedPlace {
  // Core identification
  placeId: string;
  canonicalName: string;         // Google's official name
  seedName?: string;             // Original seed name if from LLM

  // Location
  location: {
    lat: number;
    lng: number;
  };
  formattedAddress: string;
  neighborhood?: string;

  // Google data
  googleData: {
    rating: number;
    reviewCount: number;
    priceLevel?: number;
    types: string[];
    openingHours?: {
      weekdayText: string[];
      isOpenNow?: boolean;
    };
    photoReference?: string;
  };

  // Retrieval metadata (crucial for confidence)
  retrievalMeta: {
    source: RetrievalSource;
    queryUsed?: string;
    resolutionConfidence: number;  // 0-1: how confident in the match
    consensusScore: number;        // 0-1: found in how many queries
    seedMatch?: boolean;           // Was this an LLM seed?
    textSearchRank?: number;       // Position in text search results
  };

  // Computed scores (for optimizer)
  scores: {
    iconicScore: number;           // Based on reviews + category + consensus
    anchorCandidate: boolean;      // Should be considered for day anchors
    confidence: number;            // Overall retrieval confidence
  };
}

export type RetrievalSource =
  | 'seed_resolved'      // LLM seed successfully resolved
  | 'text_search'        // Found via text search query
  | 'nearby_search'      // Found via nearby search
  | 'seed_fallback';     // Seed couldn't resolve, used text search

/**
 * Pipeline configuration
 */
export interface RetrievalConfig {
  destination: string;
  country: string;
  interests: string[];
  tripDuration: number;

  // Tuning parameters
  maxSeeds: number;              // Default: 60
  maxTextSearchQueries: number;  // Default: 12
  maxCenters: number;            // Default: 5
  nearbyRadius: number;          // Default: 3000m

  // Quality controls
  maxRestaurantRatio: number;    // Default: 0.25
  maxMallCount: number;          // Default: 2
  minAnchorConfidence: number;   // Default: 0.6
}

/**
 * Final pipeline output
 */
export interface RetrievalResult {
  candidates: GroundedPlace[];
  anchors: GroundedPlace[];      // Pre-identified anchor candidates

  metadata: {
    destination: string;
    destinationType: DestinationType;
    seedsGenerated: number;
    seedsResolved: number;
    textSearchHits: number;
    nearbySearchHits: number;
    totalBeforeDedupe: number;
    totalAfterDedupe: number;
    searchCenters: { lat: number; lng: number; name: string }[];
    processingTimeMs: number;
  };

  // For debugging/transparency
  queryLog: {
    query: string;
    resultsCount: number;
    topResults: string[];
  }[];
}

// =============================================================================
// LAYER 1: RECALL (LLM SEED GENERATION)
// =============================================================================

const SEED_GENERATION_PROMPT = `You are a travel expert. Generate a list of iconic places for {destination}, {country}.

DESTINATION TYPE: {destinationType}

Generate 40-70 place names grouped into these categories:

## LANDMARKS (8-15 entries)
Famous monuments, towers, bridges, viewpoints, architectural icons.
Format: name | subcategory | why iconic (10 words max)

## CULTURAL (8-12 entries)
Museums, temples, churches, historic sites, palaces, heritage sites.
Format: name | subcategory | why iconic

## NATURE (5-10 entries)
Parks, gardens, beaches, mountains, natural wonders, scenic areas.
Format: name | subcategory | why iconic

## NEIGHBORHOODS (5-8 entries)
Distinct districts, old towns, artistic quarters, local areas worth exploring.
Format: name | character description | why visit

## EXPERIENCES (5-10 entries)
Markets, food halls, unique activities, cultural experiences, festivals areas.
Format: name | type | why iconic

## FOOD_AREAS (3-6 entries)
Famous food streets, market areas, culinary districts (NOT individual restaurants).
Format: name | specialty | why iconic

RULES:
- Use official/common English names
- Include both world-famous AND locally beloved places
- For neighborhoods, describe the area character
- Avoid generic chain establishments
- Include hidden gems that locals recommend
- For {destinationType} destinations, emphasize appropriate categories

OUTPUT FORMAT: Use exact format above with | delimiter. One entry per line.`;

/**
 * Detect destination type for adaptive seed generation
 */
export function detectDestinationType(
  destination: string,
  country: string
): DestinationType {
  const destLower = destination.toLowerCase();
  const countryLower = country.toLowerCase();

  // Pattern matching for destination types
  const patterns: [RegExp, DestinationType][] = [
    [/national park|park|forest|canyon|falls/i, 'national_park'],
    [/island|islands|isle|atoll/i, 'island'],
    [/coast|riviera|shore|beach/i, 'coastal'],
    [/alps|mountains|highlands|hills/i, 'mountain'],
    [/region|province|prefecture|state|county/i, 'region'],
    [/temple|ruins|ancient|archaeological/i, 'historic'],
  ];

  for (const [pattern, type] of patterns) {
    if (pattern.test(destLower)) return type;
  }

  // Multi-city detection (country-level trips)
  if (destLower === countryLower || destLower.includes('tour')) {
    return 'multi_city';
  }

  // Default to city
  return 'city';
}

/**
 * Generate iconic seeds using LLM
 */
export async function generateSeeds(
  destination: string,
  country: string,
  interests: string[],
  openaiClient: OpenAI
): Promise<IconicSeeds> {
  const destinationType = detectDestinationType(destination, country);

  const prompt = SEED_GENERATION_PROMPT
    .replace(/{destination}/g, destination)
    .replace(/{country}/g, country)
    .replace(/{destinationType}/g, destinationType);

  const response = await openaiClient.chat.completions.create({
    model: 'gpt-4o-mini', // Fast and cheap for seed generation
    messages: [
      {
        role: 'system',
        content: 'You are a travel expert who knows iconic places worldwide. Be specific with place names.'
      },
      {
        role: 'user',
        content: prompt + `\n\nUser interests: ${interests.join(', ')}`
      }
    ],
    temperature: 0.3, // Low temp for consistency
    max_tokens: 2000,
  });

  const content = response.choices[0].message.content || '';

  // Parse the structured response
  const seeds = parseSeedResponse(content, destinationType);

  return {
    destination,
    destinationType,
    ...seeds,
    generatedAt: new Date().toISOString(),
    seedCount: countSeeds(seeds),
    llmModel: 'gpt-4o-mini',
  };
}

/**
 * Parse LLM response into structured seeds
 */
function parseSeedResponse(
  content: string,
  destinationType: DestinationType
): Omit<IconicSeeds, 'destination' | 'destinationType' | 'generatedAt' | 'seedCount' | 'llmModel'> {
  const sections: Record<string, SeedEntry[]> = {
    landmarks: [],
    cultural: [],
    nature: [],
    neighborhoods: [],
    experiences: [],
    foodAreas: [],
  };

  let currentSection = '';
  const lines = content.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();

    // Detect section headers
    if (trimmed.startsWith('## LANDMARKS')) currentSection = 'landmarks';
    else if (trimmed.startsWith('## CULTURAL')) currentSection = 'cultural';
    else if (trimmed.startsWith('## NATURE')) currentSection = 'nature';
    else if (trimmed.startsWith('## NEIGHBORHOODS')) currentSection = 'neighborhoods';
    else if (trimmed.startsWith('## EXPERIENCES')) currentSection = 'experiences';
    else if (trimmed.startsWith('## FOOD')) currentSection = 'foodAreas';
    else if (trimmed.includes('|') && currentSection) {
      // Parse entry
      const parts = trimmed.split('|').map(p => p.trim());
      if (parts.length >= 2) {
        sections[currentSection].push({
          name: parts[0].replace(/^[-*]\s*/, ''), // Remove list markers
          category: parts[1] || 'general',
          whyIconic: parts[2] || '',
          isNeighborhood: currentSection === 'neighborhoods',
        });
      }
    }
  }

  return sections as any;
}

function countSeeds(seeds: any): number {
  return (
    seeds.landmarks.length +
    seeds.cultural.length +
    seeds.nature.length +
    seeds.neighborhoods.length +
    seeds.experiences.length +
    seeds.foodAreas.length
  );
}

// =============================================================================
// LAYER 2: GROUNDING (GOOGLE PLACES RESOLUTION)
// =============================================================================

/**
 * Resolve a single seed to a Google Place
 * Uses Find Place from Text for precise matching
 */
export async function resolveSeed(
  seed: SeedEntry,
  destination: string,
  apiKey: string
): Promise<GroundedPlace | null> {
  // Build search query with destination context
  const query = seed.isNeighborhood
    ? `${seed.name} neighborhood ${destination}`
    : `${seed.name} ${destination}`;

  try {
    // Try Find Place from Text first (more precise)
    const findPlaceUrl = `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?` +
      `input=${encodeURIComponent(query)}` +
      `&inputtype=textquery` +
      `&fields=place_id,name,geometry,formatted_address,rating,user_ratings_total,price_level,types,opening_hours,photos` +
      `&key=${apiKey}`;

    const response = await fetch(findPlaceUrl);
    const data = await response.json();

    if (data.candidates && data.candidates.length > 0) {
      const place = data.candidates[0];

      // Calculate resolution confidence
      const confidence = calculateResolutionConfidence(seed.name, place.name);

      if (confidence < 0.3) {
        // Too low confidence, try text search as fallback
        return await resolveViaTextSearch(seed, destination, apiKey);
      }

      return createGroundedPlace(place, {
        source: 'seed_resolved',
        seedName: seed.name,
        resolutionConfidence: confidence,
        consensusScore: 0.5, // Base score for seed resolution
        seedMatch: true,
      });
    }

    // Fallback to text search
    return await resolveViaTextSearch(seed, destination, apiKey);

  } catch (error) {
    console.error(`Failed to resolve seed "${seed.name}":`, error);
    return null;
  }
}

/**
 * Fallback resolution via Text Search
 */
async function resolveViaTextSearch(
  seed: SeedEntry,
  destination: string,
  apiKey: string
): Promise<GroundedPlace | null> {
  const query = `${seed.name} ${destination}`;

  const textSearchUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?` +
    `query=${encodeURIComponent(query)}` +
    `&key=${apiKey}`;

  try {
    const response = await fetch(textSearchUrl);
    const data = await response.json();

    if (data.results && data.results.length > 0) {
      const place = data.results[0];
      const confidence = calculateResolutionConfidence(seed.name, place.name);

      return createGroundedPlace(place, {
        source: 'seed_fallback',
        seedName: seed.name,
        resolutionConfidence: confidence,
        consensusScore: 0.4,
        seedMatch: true,
        textSearchRank: 1,
      });
    }
  } catch (error) {
    console.error(`Text search fallback failed for "${seed.name}":`, error);
  }

  return null;
}

/**
 * Batch resolve all seeds with concurrency control
 */
export async function resolveSeeds(
  seeds: IconicSeeds,
  apiKey: string,
  maxConcurrent: number = 5
): Promise<GroundedPlace[]> {
  const allSeeds: SeedEntry[] = [
    ...seeds.landmarks,
    ...seeds.cultural,
    ...seeds.nature,
    ...seeds.neighborhoods,
    ...seeds.experiences,
    ...seeds.foodAreas,
  ];

  const results: GroundedPlace[] = [];

  // Process in batches to respect rate limits
  for (let i = 0; i < allSeeds.length; i += maxConcurrent) {
    const batch = allSeeds.slice(i, i + maxConcurrent);
    const batchPromises = batch.map(seed =>
      resolveSeed(seed, seeds.destination, apiKey)
    );

    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults.filter((r): r is GroundedPlace => r !== null));

    // Small delay between batches to avoid rate limiting
    if (i + maxConcurrent < allSeeds.length) {
      await delay(200);
    }
  }

  return results;
}

/**
 * Calculate confidence that resolved place matches seed
 */
function calculateResolutionConfidence(seedName: string, resolvedName: string): number {
  const seedLower = seedName.toLowerCase().trim();
  const resolvedLower = resolvedName.toLowerCase().trim();

  // Exact match
  if (seedLower === resolvedLower) return 1.0;

  // Contains check
  if (resolvedLower.includes(seedLower) || seedLower.includes(resolvedLower)) {
    return 0.85;
  }

  // Word overlap
  const seedWords = new Set(seedLower.split(/\s+/));
  const resolvedWords = new Set(resolvedLower.split(/\s+/));

  let overlap = 0;
  for (const word of seedWords) {
    if (word.length > 2 && resolvedWords.has(word)) overlap++;
  }

  const overlapRatio = overlap / Math.max(seedWords.size, 1);
  return Math.min(0.9, overlapRatio + 0.3);
}

// =============================================================================
// LAYER 3: COVERAGE (TEXT SEARCH EXPANSION)
// =============================================================================

/**
 * Text search query templates
 */
const TEXT_SEARCH_TEMPLATES = [
  // High-signal iconic queries
  'top attractions in {destination}',
  '{destination} must see places',
  '{destination} famous landmarks',
  'things to do in {destination}',
  'best places to visit {destination}',

  // Category-specific
  '{destination} museums',
  '{destination} temples shrines',
  '{destination} historic sites',
  '{destination} parks gardens',
  '{destination} markets',
  '{destination} viewpoints',

  // Local flavor
  'best neighborhoods {destination}',
  '{destination} local favorites',
  'hidden gems {destination}',

  // Interest-based (dynamically added)
  // '{destination} {interest}'
];

/**
 * Expand coverage with multiple text searches
 */
export async function expandTextSearch(
  destination: string,
  interests: string[],
  apiKey: string,
  maxQueries: number = 12
): Promise<{ places: GroundedPlace[]; queryLog: any[] }> {
  // Build query list
  const queries = TEXT_SEARCH_TEMPLATES
    .map(t => t.replace(/{destination}/g, destination))
    .slice(0, maxQueries - interests.length);

  // Add interest-based queries
  for (const interest of interests.slice(0, 3)) {
    queries.push(`${destination} ${interest}`);
  }

  const allPlaces: GroundedPlace[] = [];
  const placeIdToQueries = new Map<string, Set<string>>();
  const queryLog: any[] = [];

  for (const query of queries) {
    try {
      const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?` +
        `query=${encodeURIComponent(query)}` +
        `&key=${apiKey}`;

      const response = await fetch(url);
      const data = await response.json();

      const results = data.results || [];
      queryLog.push({
        query,
        resultsCount: results.length,
        topResults: results.slice(0, 3).map((r: any) => r.name),
      });

      for (let i = 0; i < results.length; i++) {
        const place = results[i];
        const placeId = place.place_id;

        // Track which queries found this place
        if (!placeIdToQueries.has(placeId)) {
          placeIdToQueries.set(placeId, new Set());
        }
        placeIdToQueries.get(placeId)!.add(query);

        // Only add if new
        if (!allPlaces.some(p => p.placeId === placeId)) {
          const grounded = createGroundedPlace(place, {
            source: 'text_search',
            queryUsed: query,
            resolutionConfidence: 0.9,
            consensusScore: 0, // Will be updated after
            textSearchRank: i + 1,
          });
          allPlaces.push(grounded);
        }
      }

      // Rate limiting
      await delay(100);

    } catch (error) {
      console.error(`Text search failed for "${query}":`, error);
    }
  }

  // Update consensus scores
  const maxQueries_ = queries.length;
  for (const place of allPlaces) {
    const foundInQueries = placeIdToQueries.get(place.placeId)?.size || 1;
    place.retrievalMeta.consensusScore = Math.min(1, foundInQueries / Math.min(maxQueries_, 5));
  }

  return { places: allPlaces, queryLog };
}

// =============================================================================
// LAYER 4: MULTI-CENTER NEARBY SEARCH
// =============================================================================

/**
 * Automatically pick search centers from initial results
 */
export function pickSearchCenters(
  places: GroundedPlace[],
  maxCenters: number = 5
): { lat: number; lng: number; name: string }[] {
  if (places.length === 0) return [];
  if (places.length <= maxCenters) {
    return places.map(p => ({
      lat: p.location.lat,
      lng: p.location.lng,
      name: p.canonicalName,
    }));
  }

  // K-means clustering
  const coords = places.map(p => p.location);

  // Initialize centroids using places spread across the area
  const sortedByLat = [...places].sort((a, b) => a.location.lat - b.location.lat);
  const centroids: { lat: number; lng: number }[] = [];

  for (let i = 0; i < maxCenters; i++) {
    const idx = Math.floor((i / maxCenters) * sortedByLat.length);
    centroids.push({
      lat: sortedByLat[idx].location.lat,
      lng: sortedByLat[idx].location.lng,
    });
  }

  // Run K-means iterations
  for (let iter = 0; iter < 5; iter++) {
    const clusters: GroundedPlace[][] = Array.from({ length: maxCenters }, () => []);

    // Assign places to nearest centroid
    for (const place of places) {
      let minDist = Infinity;
      let closestCluster = 0;

      for (let i = 0; i < centroids.length; i++) {
        const dist = haversineDistance(
          place.location.lat, place.location.lng,
          centroids[i].lat, centroids[i].lng
        );
        if (dist < minDist) {
          minDist = dist;
          closestCluster = i;
        }
      }

      clusters[closestCluster].push(place);
    }

    // Update centroids
    for (let i = 0; i < maxCenters; i++) {
      if (clusters[i].length > 0) {
        centroids[i] = {
          lat: clusters[i].reduce((sum, p) => sum + p.location.lat, 0) / clusters[i].length,
          lng: clusters[i].reduce((sum, p) => sum + p.location.lng, 0) / clusters[i].length,
        };
      }
    }
  }

  // Find representative place for each centroid
  return centroids.map(centroid => {
    const nearest = places.reduce((best, place) => {
      const dist = haversineDistance(
        place.location.lat, place.location.lng,
        centroid.lat, centroid.lng
      );
      const bestDist = haversineDistance(
        best.location.lat, best.location.lng,
        centroid.lat, centroid.lng
      );
      return dist < bestDist ? place : best;
    });

    return {
      lat: centroid.lat,
      lng: centroid.lng,
      name: nearest.canonicalName,
    };
  });
}

/**
 * Run nearby searches around multiple centers
 */
export async function expandNearbyCenters(
  centers: { lat: number; lng: number; name: string }[],
  apiKey: string,
  radius: number = 3000,
  types: string[] = ['tourist_attraction', 'museum', 'park', 'restaurant']
): Promise<GroundedPlace[]> {
  const allPlaces: GroundedPlace[] = [];
  const seenIds = new Set<string>();

  for (const center of centers) {
    for (const type of types) {
      try {
        const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?` +
          `location=${center.lat},${center.lng}` +
          `&radius=${radius}` +
          `&type=${type}` +
          `&key=${apiKey}`;

        const response = await fetch(url);
        const data = await response.json();

        for (const place of (data.results || []).slice(0, 10)) {
          if (seenIds.has(place.place_id)) continue;
          seenIds.add(place.place_id);

          const grounded = createGroundedPlace(place, {
            source: 'nearby_search',
            queryUsed: `nearby:${center.name}:${type}`,
            resolutionConfidence: 0.95, // High confidence for nearby
            consensusScore: 0.3, // Lower base for nearby
          });
          allPlaces.push(grounded);
        }

        await delay(50);

      } catch (error) {
        console.error(`Nearby search failed at ${center.name}:`, error);
      }
    }
  }

  return allPlaces;
}

// =============================================================================
// LAYER 5: QUALITY CONTROL
// =============================================================================

/**
 * Deduplicate candidates by place_id, merging metadata
 */
export function dedupeCandidates(
  candidates: GroundedPlace[]
): GroundedPlace[] {
  const placeMap = new Map<string, GroundedPlace>();

  for (const place of candidates) {
    const existing = placeMap.get(place.placeId);

    if (!existing) {
      placeMap.set(place.placeId, place);
    } else {
      // Merge: keep highest confidence, combine consensus
      existing.retrievalMeta.consensusScore = Math.max(
        existing.retrievalMeta.consensusScore,
        place.retrievalMeta.consensusScore
      );

      // Seed match takes priority
      if (place.retrievalMeta.seedMatch) {
        existing.retrievalMeta.seedMatch = true;
        existing.seedName = place.seedName;
      }

      // Higher resolution confidence wins
      if (place.retrievalMeta.resolutionConfidence > existing.retrievalMeta.resolutionConfidence) {
        existing.retrievalMeta.resolutionConfidence = place.retrievalMeta.resolutionConfidence;
      }
    }
  }

  return Array.from(placeMap.values());
}

/**
 * Apply quality controls: cap category dominance, ensure diversity
 */
export function applyQualityControls(
  candidates: GroundedPlace[],
  config: RetrievalConfig
): GroundedPlace[] {
  // Sort by confidence first
  const sorted = [...candidates].sort((a, b) => {
    // Seed matches get priority
    if (a.retrievalMeta.seedMatch && !b.retrievalMeta.seedMatch) return -1;
    if (!a.retrievalMeta.seedMatch && b.retrievalMeta.seedMatch) return 1;

    // Then by consensus + confidence
    const scoreA = a.retrievalMeta.consensusScore + a.retrievalMeta.resolutionConfidence;
    const scoreB = b.retrievalMeta.consensusScore + b.retrievalMeta.resolutionConfidence;
    return scoreB - scoreA;
  });

  // Track category counts
  const typeCounts: Record<string, number> = {};
  const maxRestaurants = Math.floor(sorted.length * config.maxRestaurantRatio);

  const filtered: GroundedPlace[] = [];

  for (const place of sorted) {
    const primaryType = place.googleData.types[0] || 'unknown';

    // Cap restaurants
    if (primaryType === 'restaurant' || primaryType === 'food') {
      const currentCount = typeCounts['restaurant'] || 0;
      if (currentCount >= maxRestaurants) continue;
      typeCounts['restaurant'] = currentCount + 1;
    }

    // Cap malls
    if (primaryType === 'shopping_mall') {
      const currentCount = typeCounts['shopping_mall'] || 0;
      if (currentCount >= config.maxMallCount) continue;
      typeCounts['shopping_mall'] = currentCount + 1;
    }

    filtered.push(place);
  }

  return filtered;
}

/**
 * Rank and identify anchor candidates
 */
export function rankAnchorCandidates(
  candidates: GroundedPlace[],
  minConfidence: number = 0.6
): GroundedPlace[] {
  // Calculate iconic scores and identify anchors
  for (const place of candidates) {
    const reviewScore = Math.min(1, Math.log10((place.googleData.reviewCount || 1) + 1) / 4.7);
    const ratingScore = Math.max(0, ((place.googleData.rating || 0) - 3.5) / 1.5);
    const consensusBonus = place.retrievalMeta.consensusScore * 0.2;
    const seedBonus = place.retrievalMeta.seedMatch ? 0.15 : 0;

    place.scores.iconicScore = Math.min(1,
      reviewScore * 0.4 +
      ratingScore * 0.25 +
      consensusBonus +
      seedBonus +
      (place.retrievalMeta.resolutionConfidence * 0.2)
    );

    place.scores.confidence = (
      place.retrievalMeta.resolutionConfidence * 0.5 +
      place.retrievalMeta.consensusScore * 0.3 +
      (place.retrievalMeta.seedMatch ? 0.2 : 0)
    );

    // Anchor candidate if:
    // 1. High iconic score (> 0.5)
    // 2. High confidence (> minConfidence)
    // 3. OR was an LLM seed with decent resolution
    place.scores.anchorCandidate = (
      place.scores.iconicScore > 0.5 &&
      place.scores.confidence >= minConfidence
    ) || (
      (place.retrievalMeta.seedMatch === true) &&
      place.retrievalMeta.resolutionConfidence > 0.7
    );
  }

  // Sort by anchor candidacy and iconic score
  candidates.sort((a, b) => {
    if (a.scores.anchorCandidate && !b.scores.anchorCandidate) return -1;
    if (!a.scores.anchorCandidate && b.scores.anchorCandidate) return 1;
    return b.scores.iconicScore - a.scores.iconicScore;
  });

  return candidates;
}

// =============================================================================
// MAIN PIPELINE
// =============================================================================

/**
 * Run the complete iconic retrieval pipeline
 */
export async function runIconicRetrievalPipeline(
  config: RetrievalConfig,
  openaiClient: OpenAI,
  googleApiKey: string,
  onProgress?: (message: string) => void
): Promise<RetrievalResult> {
  const startTime = Date.now();
  const queryLog: any[] = [];

  onProgress?.('🌱 Layer 1: Generating iconic seeds...');

  // LAYER 1: Generate seeds
  const seeds = await generateSeeds(
    config.destination,
    config.country,
    config.interests,
    openaiClient
  );

  onProgress?.(`✓ Generated ${seeds.seedCount} seeds across ${seeds.destinationType} destination`);

  // LAYER 2: Resolve seeds
  onProgress?.('🔍 Layer 2: Resolving seeds to places...');

  const resolvedSeeds = await resolveSeeds(seeds, googleApiKey);

  onProgress?.(`✓ Resolved ${resolvedSeeds.length}/${seeds.seedCount} seeds`);

  // LAYER 3: Text search expansion
  onProgress?.('📚 Layer 3: Expanding coverage with text searches...');

  const { places: textSearchPlaces, queryLog: textSearchLog } = await expandTextSearch(
    config.destination,
    config.interests,
    googleApiKey,
    config.maxTextSearchQueries
  );

  queryLog.push(...textSearchLog);
  onProgress?.(`✓ Found ${textSearchPlaces.length} places from text searches`);

  // Combine for center detection
  const initialPlaces = dedupeCandidates([...resolvedSeeds, ...textSearchPlaces]);

  // LAYER 4: Multi-center nearby search
  onProgress?.('📍 Layer 4: Running multi-center nearby searches...');

  const centers = pickSearchCenters(initialPlaces, config.maxCenters);

  const nearbyPlaces = await expandNearbyCenters(
    centers,
    googleApiKey,
    config.nearbyRadius
  );

  onProgress?.(`✓ Found ${nearbyPlaces.length} places from ${centers.length} search centers`);

  // LAYER 5: Quality control
  onProgress?.('✨ Layer 5: Applying quality controls...');

  const allCandidates = [...resolvedSeeds, ...textSearchPlaces, ...nearbyPlaces];
  const totalBeforeDedupe = allCandidates.length;

  let finalCandidates = dedupeCandidates(allCandidates);
  finalCandidates = applyQualityControls(finalCandidates, config);
  finalCandidates = rankAnchorCandidates(finalCandidates, config.minAnchorConfidence);

  const anchors = finalCandidates.filter(c => c.scores.anchorCandidate);

  onProgress?.(`✓ Final: ${finalCandidates.length} candidates, ${anchors.length} anchor candidates`);

  return {
    candidates: finalCandidates,
    anchors,
    metadata: {
      destination: config.destination,
      destinationType: seeds.destinationType,
      seedsGenerated: seeds.seedCount,
      seedsResolved: resolvedSeeds.length,
      textSearchHits: textSearchPlaces.length,
      nearbySearchHits: nearbyPlaces.length,
      totalBeforeDedupe,
      totalAfterDedupe: finalCandidates.length,
      searchCenters: centers,
      processingTimeMs: Date.now() - startTime,
    },
    queryLog,
  };
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function createGroundedPlace(
  googlePlace: any,
  meta: Partial<GroundedPlace['retrievalMeta']> & { seedName?: string }
): GroundedPlace {
  return {
    placeId: googlePlace.place_id,
    canonicalName: googlePlace.name,
    seedName: meta.seedName,

    location: {
      lat: googlePlace.geometry?.location?.lat || 0,
      lng: googlePlace.geometry?.location?.lng || 0,
    },
    formattedAddress: googlePlace.formatted_address || googlePlace.vicinity || '',
    neighborhood: extractNeighborhood(googlePlace.formatted_address || googlePlace.vicinity),

    googleData: {
      rating: googlePlace.rating || 0,
      reviewCount: googlePlace.user_ratings_total || 0,
      priceLevel: googlePlace.price_level,
      types: googlePlace.types || [],
      openingHours: googlePlace.opening_hours ? {
        weekdayText: googlePlace.opening_hours.weekday_text || [],
        isOpenNow: googlePlace.opening_hours.open_now,
      } : undefined,
      photoReference: googlePlace.photos?.[0]?.photo_reference,
    },

    retrievalMeta: {
      source: meta.source || 'text_search',
      queryUsed: meta.queryUsed,
      resolutionConfidence: meta.resolutionConfidence || 0.5,
      consensusScore: meta.consensusScore || 0,
      seedMatch: meta.seedMatch || false,
      textSearchRank: meta.textSearchRank,
    },

    scores: {
      iconicScore: 0, // Computed later
      anchorCandidate: false,
      confidence: 0,
    },
  };
}

function extractNeighborhood(address: string): string {
  if (!address) return '';
  const parts = address.split(',');
  return parts.length > 1 ? parts[0].trim() : '';
}

function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// =============================================================================
// EXPORTS FOR OPTIMIZER/STORYTELLER
// =============================================================================

/**
 * Convert RetrievalResult to format expected by existing optimizer
 */
export function toOptimizerFormat(result: RetrievalResult): {
  candidates: {
    attractions: any[];
    restaurants: any[];
    cafes: any[];
  };
  iconicCandidates: any[];
  queryConsensus: Map<string, number>;
} {
  const attractions: any[] = [];
  const restaurants: any[] = [];
  const cafes: any[] = [];
  const queryConsensus = new Map<string, number>();

  for (const place of result.candidates) {
    const converted = {
      id: place.placeId,
      name: place.canonicalName,
      type: categorizeType(place.googleData.types),
      location: {
        lat: place.location.lat,
        lng: place.location.lng,
        neighborhood: place.neighborhood || place.formattedAddress,
      },
      photo_url: place.googleData.photoReference
        ? `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photo_reference=${place.googleData.photoReference}&key=${process.env.GOOGLE_MAPS_API_KEY}`
        : undefined,
      reddit_data: {
        mentions: 0,
        sentiment: 0.7,
        sample_quotes: [],
        sources: [],
      },
      google_data: {
        rating: place.googleData.rating,
        reviews_count: place.googleData.reviewCount,
        price_level: place.googleData.priceLevel || 2,
        opening_hours: place.googleData.openingHours,
      },
      constraints_satisfied: {
        wheelchair_accessible: true,
        vegan_friendly: true,
        cost: (place.googleData.priceLevel || 2) * 15,
      },
      relevance_score: place.scores.iconicScore,
      why_relevant: place.seedName
        ? `Iconic: ${place.seedName}`
        : `Popular ${categorizeType(place.googleData.types)} (${place.googleData.reviewCount} reviews)`,

      // New fields for optimizer
      _retrievalConfidence: place.scores.confidence,
      _isAnchorCandidate: place.scores.anchorCandidate,
    };

    // Store consensus score
    queryConsensus.set(place.placeId, place.retrievalMeta.consensusScore);

    // Categorize
    const type = categorizeType(place.googleData.types);
    if (type === 'restaurant') {
      restaurants.push(converted);
    } else if (type === 'cafe') {
      cafes.push(converted);
    } else {
      attractions.push(converted);
    }
  }

  // Extract iconic candidates (anchors)
  const iconicCandidates = result.anchors.map(place => ({
    id: place.placeId,
    name: place.canonicalName,
    type: categorizeType(place.googleData.types),
    location: {
      lat: place.location.lat,
      lng: place.location.lng,
      neighborhood: place.neighborhood,
    },
    google_data: {
      rating: place.googleData.rating,
      reviews_count: place.googleData.reviewCount,
      price_level: place.googleData.priceLevel || 2,
    },
    relevance_score: place.scores.iconicScore,
  }));

  return {
    candidates: { attractions, restaurants, cafes },
    iconicCandidates,
    queryConsensus,
  };
}

function categorizeType(types: string[]): 'attraction' | 'restaurant' | 'cafe' {
  if (types.includes('restaurant') || types.includes('food')) return 'restaurant';
  if (types.includes('cafe') || types.includes('bakery')) return 'cafe';
  return 'attraction';
}
