/**
 * Agent 2: Researcher
 *
 * Uses the cost-effective iconic retrieval pipeline to find places.
 * Features:
 * - Category-balanced text search for high iconic recall
 * - Multi-center nearby search for coverage
 * - Adaptive LLM fallback (only when recall is weak)
 * - Destination-level caching (near-zero cost for repeat queries)
 * - Budget management with graceful degradation
 *
 * v3 Enhancements:
 * - Outputs explicit anchors with policy metadata
 * - Computes iconicScore and utilityScore for all candidates
 * - Supports ENABLE_MEALS feature flag
 * - Outputs enrichedCandidatesRaw for canonical registry
 */

import { ParsedInput, Candidate } from '../utils/types';
import {
  retrieveCandidates,
  toOptimizerFormat,
  RetrievalConfig,
  RetrievalResult,
} from '../retrieval/cost-effective-retrieval';
import {
  EnrichedCandidateRaw,
  AnchorCandidateRaw,
  AnchorPolicy,
  RawPlaceId,
} from '../types/optimizer-v3';
import { getFeatureFlags } from '../config/feature-flags';
import { computeIconicScore, selectAnchors, createAnchorPolicy } from '../planning/anchor-policy';
import { DEFAULT_OPTIMIZER_V3_CONFIG } from '../config/optimizer-config';
import { normalizeName } from '../planning/canonical-registry';

// Legacy interface for backward compatibility
interface ResearchResult {
  candidates: {
    attractions: Candidate[];
    restaurants: Candidate[];
    cafes: Candidate[];
  };
  research_summary: {
    total_candidates: number;
    reddit_threads_analyzed: number;
    constraint_failures: number;
    top_neighborhoods: string[];
  };
  // NEW: Added for optimizer improvements
  iconicCandidates?: Candidate[];
  queryConsensus?: Map<string, number>;
  retrievalMetadata?: {
    cacheHit: boolean;
    llmFallbackUsed: boolean;
    recallHealthScore: number;
    estimatedCost: number;
  };
}

// =============================================================================
// V3 RESEARCH OUTPUT
// =============================================================================

export interface ResearchOutputV3 {
  // Enriched candidates with raw IDs (pre-canonicalization)
  enrichedCandidatesRaw: EnrichedCandidateRaw[];

  // Legacy format for backward compatibility
  candidates: {
    attractions: Candidate[];
    restaurants: Candidate[];
    cafes: Candidate[];
  };

  // Anchor data (all use raw IDs)
  anchorCandidatesRaw: AnchorCandidateRaw[];
  anchorPolicy: AnchorPolicy;
  mustIncludeRawIds: RawPlaceId[];
  avoidIncludeRawIds: RawPlaceId[];

  // Metadata
  retrievalMetadata: {
    totalRetrieved: number;
    afterFilters: number;
    afterEnrichment: number;
    iconicScoreRange: [number, number];
    utilityScoreRange: [number, number];
    cacheHit: boolean;
    llmFallbackUsed: boolean;
    recallHealthScore: number;
    estimatedCost: number;
  };
}

/**
 * Main researcher function - now uses cost-effective retrieval pipeline
 */
export async function runAgent2Researcher(
  parsedInput: ParsedInput,
  onProgress?: (message: string) => void
): Promise<ResearchResult> {
  console.log('🤖 Agent 2 (Researcher): Starting cost-effective retrieval...');

  const destination = parsedInput.parsed_data.destination;
  const interests = parsedInput.parsed_data.interests;
  const days = parsedInput.parsed_data.dates.duration_days;
  const pace = parsedInput.parsed_data.constraints.pace || 'moderate';

  // Build retrieval config
  const config: RetrievalConfig = {
    destination: destination.city,
    country: destination.country,
    language: 'en',
    interests: interests,
    tripDuration: days,
    pace: pace,
  };

  try {
    // Run the new retrieval pipeline
    const result = await retrieveCandidates(
      config,
      process.env.GOOGLE_MAPS_API_KEY || '',
      process.env.OPENAI_API_KEY || '',
      onProgress
    );

    // Convert to optimizer format
    const optimizerData = toOptimizerFormat(result);

    // Convert to legacy Candidate format for backward compatibility
    const candidates = convertToLegacyFormat(optimizerData);

    // Extract neighborhoods
    const neighborhoods = extractNeighborhoods(result.candidates);

    // Log results
    console.log('✓ Agent 2: Research complete');
    console.log(`  → ${candidates.attractions.length} attractions`);
    console.log(`  → ${candidates.restaurants.length} restaurants`);
    console.log(`  → ${candidates.cafes.length} cafes`);
    console.log(`  → ${result.anchors.length} anchor candidates identified`);
    console.log(`  → Cache hit: ${result.metadata.cacheHit}`);
    console.log(`  → LLM fallback: ${result.metadata.llmFallbackUsed}`);
    console.log(`  → Cost: $${result.metadata.estimatedCost.toFixed(3)}`);

    return {
      candidates,
      research_summary: {
        total_candidates: result.metadata.totalCandidatesDeduped,
        reddit_threads_analyzed: 0, // Reddit integration can be added later
        constraint_failures: 0,
        top_neighborhoods: neighborhoods,
      },
      // NEW: Pass through for optimizer improvements
      iconicCandidates: convertAnchorsToLegacy(result.anchors),
      queryConsensus: optimizerData.queryConsensus,
      retrievalMetadata: {
        cacheHit: result.metadata.cacheHit,
        llmFallbackUsed: result.metadata.llmFallbackUsed,
        recallHealthScore: result.metadata.recallHealthScore,
        estimatedCost: result.metadata.estimatedCost,
      },
    };

  } catch (error) {
    console.error('Retrieval pipeline error, falling back to legacy:', error);
    onProgress?.('⚠️ Using fallback retrieval...');

    // Fallback to legacy retrieval if new pipeline fails
    return await legacyRetrieval(parsedInput, onProgress);
  }
}

/**
 * Convert new retrieval format to legacy Candidate format
 */
function convertToLegacyFormat(
  optimizerData: ReturnType<typeof toOptimizerFormat>
): ResearchResult['candidates'] {
  const convertCandidate = (c: any): Candidate => ({
    id: c.id,
    name: c.name,
    type: c.type as Candidate['type'],
    location: {
      lat: c.location.lat,
      lng: c.location.lng,
      neighborhood: c.location.neighborhood || '',
    },
    photo_url: c.photo_url,
    reddit_data: {
      mentions: 0,
      sentiment: 0.7,
      sample_quotes: [],
      sources: [],
    },
    google_data: {
      rating: c.google_data?.rating || 4.0,
      reviews_count: c.google_data?.reviews_count || 100,
      price_level: c.google_data?.price_level || 2,
      opening_hours: undefined,
    },
    constraints_satisfied: {
      wheelchair_accessible: c.constraints_satisfied?.wheelchair_accessible ?? true,
      vegan_friendly: c.constraints_satisfied?.vegan_friendly ?? true,
      cost: c.constraints_satisfied?.cost || 30,
    },
    relevance_score: c.relevance_score || 0.5,
    why_relevant: c._isAnchorCandidate
      ? `Iconic attraction with ${c.google_data?.reviews_count || 'many'} reviews`
      : `Popular ${c.type} with ${c.google_data?.reviews_count || 'many'} reviews`,
  });

  return {
    attractions: optimizerData.candidates.attractions.map(convertCandidate),
    restaurants: optimizerData.candidates.restaurants.map(convertCandidate),
    cafes: optimizerData.candidates.cafes.map(convertCandidate),
  };
}

/**
 * Convert anchor candidates to legacy format
 */
function convertAnchorsToLegacy(anchors: RetrievalResult['anchors']): Candidate[] {
  return anchors.map(a => ({
    id: a.placeId,
    name: a.name,
    type: 'attraction' as const,
    location: {
      lat: a.location.lat,
      lng: a.location.lng,
      neighborhood: a.vicinity || '',
    },
    photo_url: a.photoReference
      ? `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photo_reference=${a.photoReference}&key=${process.env.GOOGLE_MAPS_API_KEY}`
      : undefined,
    reddit_data: {
      mentions: 0,
      sentiment: 0.7,
      sample_quotes: [],
      sources: [],
    },
    google_data: {
      rating: a.rating,
      reviews_count: a.reviewCount,
      price_level: a.priceLevel || 2,
      opening_hours: undefined,
    },
    constraints_satisfied: {
      wheelchair_accessible: true,
      vegan_friendly: false,
      cost: (a.priceLevel || 2) * 15,
    },
    relevance_score: a.iconicScore,
    why_relevant: `Iconic: ${a.name} (${a.reviewCount} reviews, ${a.rating}★)`,
  }));
}

/**
 * Extract unique neighborhoods from candidates
 */
function extractNeighborhoods(candidates: RetrievalResult['candidates']): string[] {
  const neighborhoods = new Set<string>();

  for (const c of candidates) {
    if (c.vicinity) {
      // Extract first part of address as neighborhood
      const parts = c.vicinity.split(',');
      if (parts.length > 0) {
        neighborhoods.add(parts[0].trim());
      }
    }
  }

  return Array.from(neighborhoods).slice(0, 5);
}

// =============================================================================
// LEGACY FALLBACK (in case new pipeline fails)
// =============================================================================

import { googleMapsMCP } from '../mcp/google-maps-client';

const ATTRACTION_TYPES = [
  'tourist_attraction',
  'museum',
  'park',
  'art_gallery',
  'church',
  'hindu_temple',
  'mosque',
  'synagogue',
  'zoo',
  'aquarium',
  'amusement_park',
  'stadium',
  'shopping_mall',
  'market',
  'night_club',
  'spa',
];

async function legacyRetrieval(
  parsedInput: ParsedInput,
  onProgress?: (message: string) => void
): Promise<ResearchResult> {
  console.log('🤖 Agent 2 (Researcher): Using legacy retrieval...');

  const destination = parsedInput.parsed_data.destination;
  const interests = parsedInput.parsed_data.interests;
  const days = parsedInput.parsed_data.dates.duration_days;

  const candidates: ResearchResult['candidates'] = {
    attractions: [],
    restaurants: [],
    cafes: [],
  };

  const seenPlaceIds = new Set<string>();

  onProgress?.('→ Getting city coordinates...');
  const cityCoords = await getCityCoordinates(destination.city);

  const minAttractionsNeeded = days * 3 + 5;
  const minRestaurantsNeeded = days * 2 + 3;

  onProgress?.('→ Searching attractions...');

  for (const type of ATTRACTION_TYPES) {
    if (candidates.attractions.length >= minAttractionsNeeded) break;

    try {
      const interestQuery = interests.length > 0
        ? `${interests[Math.floor(Math.random() * interests.length)]} ${type}`
        : `popular ${type}`;

      const places = await googleMapsMCP.searchPlaces(
        interestQuery,
        cityCoords,
        15000,
        type
      );

      for (const place of places.slice(0, 5)) {
        if (!place.place_id || seenPlaceIds.has(place.place_id)) continue;
        seenPlaceIds.add(place.place_id);
        candidates.attractions.push(createLegacyCandidate(place, 'attraction'));
      }
    } catch (error) {
      console.error(`Error searching ${type}:`, error);
    }
  }

  onProgress?.(`✓ Found ${candidates.attractions.length} attractions`);
  onProgress?.('→ Searching restaurants...');

  try {
    const restaurants = await googleMapsMCP.searchPlaces(
      'best restaurants',
      cityCoords,
      15000,
      'restaurant'
    );

    for (const place of restaurants.slice(0, minRestaurantsNeeded)) {
      if (!place.place_id || seenPlaceIds.has(place.place_id)) continue;
      seenPlaceIds.add(place.place_id);
      candidates.restaurants.push(createLegacyCandidate(place, 'restaurant'));
    }
  } catch (error) {
    console.error('Error searching restaurants:', error);
  }

  onProgress?.(`✓ Found ${candidates.restaurants.length} restaurants`);
  onProgress?.('→ Searching cafes...');

  try {
    const cafes = await googleMapsMCP.searchPlaces(
      'popular cafes',
      cityCoords,
      15000,
      'cafe'
    );

    for (const place of cafes.slice(0, 10)) {
      if (!place.place_id || seenPlaceIds.has(place.place_id)) continue;
      seenPlaceIds.add(place.place_id);
      candidates.cafes.push(createLegacyCandidate(place, 'cafe'));
    }
  } catch (error) {
    console.error('Error searching cafes:', error);
  }

  onProgress?.(`✓ Found ${candidates.cafes.length} cafes`);

  const neighborhoods = new Set<string>();
  [...candidates.attractions, ...candidates.restaurants, ...candidates.cafes].forEach(c => {
    if (c.location.neighborhood) {
      neighborhoods.add(c.location.neighborhood.split(',')[0].trim());
    }
  });

  return {
    candidates,
    research_summary: {
      total_candidates: candidates.attractions.length + candidates.restaurants.length + candidates.cafes.length,
      reddit_threads_analyzed: 0,
      constraint_failures: 0,
      top_neighborhoods: Array.from(neighborhoods).slice(0, 5),
    },
  };
}

function createLegacyCandidate(place: any, type: 'attraction' | 'restaurant' | 'cafe'): Candidate {
  const photoUrl = place.photo_reference
    ? `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photo_reference=${place.photo_reference}&key=${process.env.GOOGLE_MAPS_API_KEY}`
    : undefined;

  return {
    id: place.place_id || `place_${Date.now()}_${Math.random()}`,
    name: place.name || 'Unknown Place',
    type: type === 'cafe' ? 'cafe' : type,
    location: {
      lat: place.location?.lat || 0,
      lng: place.location?.lng || 0,
      neighborhood: place.vicinity || place.formatted_address || '',
    },
    photo_url: photoUrl,
    reddit_data: {
      mentions: 0,
      sentiment: 0.7,
      sample_quotes: [],
      sources: [],
    },
    google_data: {
      rating: place.rating || 4.0,
      reviews_count: place.user_ratings_total || 100,
      price_level: place.price_level || 2,
      opening_hours: place.opening_hours,
    },
    constraints_satisfied: {
      wheelchair_accessible: true,
      vegan_friendly: type !== 'attraction',
      cost: (place.price_level || 2) * 15,
    },
    relevance_score: (place.rating || 4.0) / 5 * (place.user_ratings_total ? Math.min(place.user_ratings_total / 1000, 1) : 0.5),
    why_relevant: `Highly rated ${type} with ${place.user_ratings_total || 'many'} reviews`,
  };
}

async function getCityCoordinates(city: string): Promise<{ lat: number; lng: number }> {
  try {
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(city)}&key=${process.env.GOOGLE_MAPS_API_KEY}`
    );
    const data = await response.json();

    if (data.results && data.results[0]) {
      return {
        lat: data.results[0].geometry.location.lat,
        lng: data.results[0].geometry.location.lng
      };
    }
  } catch (error) {
    console.error('Geocoding error:', error);
  }

  const coords: Record<string, { lat: number; lng: number }> = {
    'Tokyo': { lat: 35.6762, lng: 139.6503 },
    'Hyderabad': { lat: 17.3850, lng: 78.4867 },
    'Paris': { lat: 48.8566, lng: 2.3522 },
    'New York': { lat: 40.7128, lng: -74.0060 },
    'London': { lat: 51.5074, lng: -0.1278 },
  };
  return coords[city] || { lat: 0, lng: 0 };
}

// =============================================================================
// V3 RESEARCHER IMPLEMENTATION
// =============================================================================

import { ActivityCategory, BigRockType } from '../planning/types';
import { UTILITY_SCORE_WEIGHTS } from '../types/optimizer-v3';

/**
 * V3 Researcher - Enhanced version with anchor selection and enriched candidates.
 * 
 * Key differences from v2:
 * - Computes iconicScore and utilityScore for all candidates
 * - Outputs enrichedCandidatesRaw with raw IDs (pre-canonicalization)
 * - Selects anchors using anchor-policy
 * - Respects ENABLE_MEALS feature flag
 * - Outputs mustIncludeRawIds and avoidIncludeRawIds
 */
export async function runAgent2ResearcherV3(
  parsedInput: ParsedInput,
  onProgress?: (message: string) => void
): Promise<ResearchOutputV3> {
  console.log('🤖 Agent 2 (Researcher v3): Starting enhanced retrieval...');

  const destination = parsedInput.parsed_data.destination;
  const interests = parsedInput.parsed_data.interests;
  const days = parsedInput.parsed_data.dates.duration_days;
  const pace = parsedInput.parsed_data.constraints.pace || 'moderate';
  const featureFlags = getFeatureFlags();

  // Build retrieval config
  const config: RetrievalConfig = {
    destination: destination.city,
    country: destination.country,
    language: 'en',
    interests: interests,
    tripDuration: days,
    pace: pace,
  };

  try {
    onProgress?.('→ Retrieving candidates...');
    
    // Run the retrieval pipeline
    const result = await retrieveCandidates(
      config,
      process.env.GOOGLE_MAPS_API_KEY || '',
      process.env.OPENAI_API_KEY || '',
      onProgress
    );

    onProgress?.('→ Enriching candidates with v3 scores...');

    // Convert to enriched raw candidates
    const enrichedCandidatesRaw: EnrichedCandidateRaw[] = result.candidates.map(c =>
      convertToEnrichedRaw(c, interests)
    );

    // Filter out restaurants/cafes if ENABLE_MEALS is false
    let filteredCandidates = enrichedCandidatesRaw;
    if (!featureFlags.ENABLE_MEALS) {
      filteredCandidates = enrichedCandidatesRaw.filter(c => 
        c.category !== 'restaurant' && c.category !== 'cafe'
      );
      console.log(`  → Filtered out ${enrichedCandidatesRaw.length - filteredCandidates.length} meal-related candidates (ENABLE_MEALS=false)`);
    }

    onProgress?.('→ Selecting anchors...');

    // Create anchor policy for this trip
    const anchorPolicy = createAnchorPolicy(days, DEFAULT_OPTIMIZER_V3_CONFIG);

    // Select anchors from enriched candidates
    const anchorResult = selectAnchors(filteredCandidates, anchorPolicy, DEFAULT_OPTIMIZER_V3_CONFIG);

    // Build mustInclude from anchors + any user-specified must-sees
    const userMustSee = (parsedInput.parsed_data as any).must_see || [];
    const mustIncludeRawIds: string[] = [
      ...anchorResult.anchors.map(a => a.rawId),
      ...userMustSee.map((name: string) => 
        findRawIdByName(filteredCandidates, name)
      ).filter((id: string | null): id is string => id !== null),
    ];

    // Build avoidInclude from user preferences
    const userAvoid = (parsedInput.parsed_data as any).avoid || [];
    const avoidIncludeRawIds: string[] = userAvoid.map((name: string) =>
      findRawIdByName(filteredCandidates, name)
    ).filter((id: string | null): id is string => id !== null);

    // Build legacy format for backward compatibility
    const legacyCandidates = buildLegacyCandidates(filteredCandidates, featureFlags.ENABLE_MEALS);

    // Compute score ranges for metadata
    const iconicScores = filteredCandidates.map(c => c.iconicScore);
    const utilityScores = filteredCandidates.map(c => c.utilityScore);

    // Log results
    console.log('✓ Agent 2 v3: Research complete');
    console.log(`  → ${filteredCandidates.length} enriched candidates`);
    console.log(`  → ${anchorResult.anchors.length} anchors selected`);
    console.log(`  → ${anchorResult.infeasibleAnchors.length} anchors infeasible`);
    console.log(`  → ${mustIncludeRawIds.length} must-include IDs`);
    console.log(`  → ENABLE_MEALS: ${featureFlags.ENABLE_MEALS}`);

    return {
      enrichedCandidatesRaw: filteredCandidates,
      candidates: legacyCandidates,
      anchorCandidatesRaw: anchorResult.anchors,
      anchorPolicy,
      mustIncludeRawIds,
      avoidIncludeRawIds,
      retrievalMetadata: {
        totalRetrieved: result.metadata.totalCandidatesRaw,
        afterFilters: result.metadata.totalCandidatesDeduped,
        afterEnrichment: filteredCandidates.length,
        iconicScoreRange: [Math.min(...iconicScores), Math.max(...iconicScores)],
        utilityScoreRange: [Math.min(...utilityScores), Math.max(...utilityScores)],
        cacheHit: result.metadata.cacheHit,
        llmFallbackUsed: result.metadata.llmFallbackUsed,
        recallHealthScore: result.metadata.recallHealthScore,
        estimatedCost: result.metadata.estimatedCost,
      },
    };

  } catch (error) {
    console.error('V3 Retrieval pipeline error:', error);
    throw error;
  }
}

// =============================================================================
// V3 HELPER FUNCTIONS
// =============================================================================

/**
 * Convert raw retrieval candidate to EnrichedCandidateRaw.
 */
function convertToEnrichedRaw(
  candidate: RetrievalResult['candidates'][number],
  userInterests: string[]
): EnrichedCandidateRaw {
  const category = mapGoogleTypeToCategory(candidate.types || []);
  const isBigRock = isBigRockCandidate(candidate, category);
  const bigRockType = isBigRock ? detectBigRockType(candidate, category) : undefined;
  const duration = estimateDuration(category, isBigRock, bigRockType);
  const normalizedName = normalizeName(candidate.name);
  
  // Compute iconic score
  const iconicScore = computeIconicScore({
    reviewCount: candidate.reviewCount || 0,
    rating: candidate.rating || 4.0,
    category,
    globalPopularityRank: undefined, // Not available from Google
  });

  // Compute utility score
  const utilityScore = computeUtilityScore({
    iconicScore,
    category,
    userInterests,
    rating: candidate.rating || 4.0,
    reviewCount: candidate.reviewCount || 0,
  });

  // Build dedupKey
  const geohash6 = encodeGeohash(candidate.location.lat, candidate.location.lng, 6);
  const dedupKey = `${normalizedName}|${geohash6}|${category}`;

  return {
    rawId: candidate.placeId,
    name: candidate.name,
    normalizedName,
    location: candidate.location,
    category: category as ActivityCategory,
    categoryConfidence: 0.8, // Default confidence
    durationMinutes: duration.typical,
    durationMin: duration.min,
    durationMax: duration.max,
    rating: candidate.rating || 4.0,
    reviewCount: candidate.reviewCount || 0,
    priceLevel: candidate.priceLevel,
    photoUrl: candidate.photoReference
      ? `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photo_reference=${candidate.photoReference}&key=${process.env.GOOGLE_MAPS_API_KEY}`
      : undefined,
    vicinity: candidate.vicinity,
    googleTypes: candidate.types || [],
    iconicScore,
    utilityScore,
    isBigRock,
    bigRockType,
    dedupKey,
    isGeneric: isGenericPlace(candidate.name, candidate.types || []),
    geohash6,
  };
}

/**
 * Map Google Place types to our ActivityCategory.
 */
function mapGoogleTypeToCategory(types: string[]): ActivityCategory {
  const typeSet = new Set(types);

  // Check for specific categories in priority order
  if (typeSet.has('museum') || typeSet.has('art_gallery')) return 'museum';
  if (typeSet.has('amusement_park') || typeSet.has('theme_park')) return 'theme_park';
  if (typeSet.has('zoo')) return 'zoo';
  if (typeSet.has('aquarium')) return 'aquarium';
  if (typeSet.has('church') || typeSet.has('hindu_temple') || typeSet.has('mosque') || typeSet.has('synagogue')) return 'temple';
  if (typeSet.has('park') || typeSet.has('national_park')) return 'park';
  if (typeSet.has('beach')) return 'beach';
  if (typeSet.has('stadium')) return 'experience'; // Map stadium to experience
  if (typeSet.has('shopping_mall') || typeSet.has('department_store')) return 'shopping';
  if (typeSet.has('market')) return 'market';
  if (typeSet.has('restaurant')) return 'restaurant';
  if (typeSet.has('cafe')) return 'cafe';
  if (typeSet.has('bar') || typeSet.has('night_club')) return 'bar'; // Map nightlife to bar
  if (typeSet.has('tourist_attraction') || typeSet.has('point_of_interest')) return 'landmark';
  if (typeSet.has('natural_feature') || typeSet.has('establishment')) return 'viewpoint';

  return 'unknown';
}

/**
 * Check if candidate qualifies as a Big Rock (major attraction requiring significant time).
 */
function isBigRockCandidate(
  candidate: RetrievalResult['candidates'][number],
  category: ActivityCategory
): boolean {
  const bigRockCategories: ActivityCategory[] = ['theme_park', 'zoo', 'aquarium', 'major_museum'];
  
  // Category-based big rocks
  if (bigRockCategories.includes(category)) return true;

  // Review-count based big rocks (very popular attractions)
  if ((candidate.reviewCount || 0) >= 50000) return true;

  // Name-based detection for known big rocks
  const bigRockKeywords = [
    'disneyland', 'disney', 'universal', 'legoland', 'seaworld',
    'louvre', 'british museum', 'metropolitan museum', 'smithsonian',
    'national park', 'grand canyon', 'yellowstone', 'yosemite',
  ];
  const nameLower = candidate.name.toLowerCase();
  if (bigRockKeywords.some(kw => nameLower.includes(kw))) return true;

  return false;
}

/**
 * Detect the type of Big Rock.
 */
function detectBigRockType(
  candidate: RetrievalResult['candidates'][number],
  category: ActivityCategory
): BigRockType {
  if (category === 'theme_park') return 'theme_park';
  if (category === 'zoo') return 'zoo';
  if (category === 'aquarium') return 'aquarium';
  if (category === 'major_museum' || category === 'museum') {
    // Check if it's a major museum by review count
    if ((candidate.reviewCount || 0) >= 20000) return 'major_museum';
  }
  if (category === 'park') return 'safari'; // Map national parks to safari type
  
  return 'amusement_park'; // Default big rock type
}

/**
 * Estimate duration for a candidate based on category and big rock status.
 */
function estimateDuration(
  category: ActivityCategory,
  isBigRock: boolean,
  bigRockType?: BigRockType
): { typical: number; min: number; max: number } {
  // Big rocks get extended durations
  if (isBigRock) {
    switch (bigRockType) {
      case 'theme_park':
        return { typical: 480, min: 360, max: 600 }; // 6-10 hours
      case 'major_museum':
        return { typical: 240, min: 180, max: 300 }; // 3-5 hours
      case 'zoo':
      case 'aquarium':
        return { typical: 210, min: 150, max: 270 }; // 2.5-4.5 hours
      case 'safari':
        return { typical: 300, min: 240, max: 480 }; // 4-8 hours
      default:
        return { typical: 240, min: 180, max: 360 }; // 3-6 hours
    }
  }

  // Standard durations by category
  switch (category) {
    case 'museum':
      return { typical: 120, min: 60, max: 180 };
    case 'temple':
      return { typical: 60, min: 30, max: 90 };
    case 'park':
      return { typical: 90, min: 45, max: 150 };
    case 'beach':
      return { typical: 180, min: 90, max: 300 };
    case 'landmark':
    case 'monument':
      return { typical: 45, min: 20, max: 75 };
    case 'viewpoint':
      return { typical: 30, min: 15, max: 60 };
    case 'market':
      return { typical: 90, min: 45, max: 150 };
    case 'shopping':
      return { typical: 120, min: 60, max: 180 };
    case 'restaurant':
      return { typical: 75, min: 45, max: 120 };
    case 'cafe':
      return { typical: 45, min: 20, max: 75 };
    case 'bar':
      return { typical: 120, min: 60, max: 240 };
    default:
      return { typical: 60, min: 30, max: 120 };
  }
}

/**
 * Check if a place name is generic (e.g., "Restaurant", "Park").
 */
function isGenericPlace(name: string, types: string[]): boolean {
  const genericNames = [
    'restaurant', 'cafe', 'park', 'museum', 'temple', 'church',
    'beach', 'market', 'mall', 'hotel', 'bar', 'club',
  ];
  const nameLower = name.toLowerCase().trim();
  
  // Check if name is just a generic word
  if (genericNames.includes(nameLower)) return true;
  
  // Check if name is very short and matches a type
  if (name.length <= 15 && types.some(t => nameLower.includes(t.replace('_', ' ')))) {
    return true;
  }

  return false;
}

/**
 * Compute utility score for a candidate.
 */
function computeUtilityScore(params: {
  iconicScore: number;
  category: ActivityCategory;
  userInterests: string[];
  rating: number;
  reviewCount: number;
}): number {
  const { iconicScore, category, userInterests, rating, reviewCount } = params;

  // User preference match (0-1)
  const interestKeywords: Record<string, string[]> = {
    'history': ['museum', 'monument', 'temple', 'palace', 'fort'],
    'art': ['museum', 'art_gallery', 'landmark'],
    'nature': ['park', 'beach', 'viewpoint', 'garden'],
    'food': ['restaurant', 'cafe', 'market'],
    'shopping': ['shopping', 'market'],
    'adventure': ['theme_park', 'zoo', 'aquarium', 'beach'],
    'culture': ['temple', 'museum', 'landmark', 'monument'],
    'nightlife': ['nightlife', 'bar'],
  };

  let preferenceMatch = 0.5; // Default neutral
  for (const interest of userInterests) {
    const keywords = interestKeywords[interest.toLowerCase()] || [];
    if (keywords.includes(category)) {
      preferenceMatch = Math.min(1, preferenceMatch + 0.2);
    }
  }

  // Quality signal (0-1)
  const ratingNorm = Math.min(1, Math.max(0, (rating - 3) / 2)); // 3-5 → 0-1
  const reviewNorm = Math.min(1, Math.log10(reviewCount + 1) / 5);
  const qualitySignal = (ratingNorm + reviewNorm) / 2;

  // Diversity bonus (placeholder - would need context of already selected)
  const diversityBonus = 0.5;

  // Travel penalty (placeholder - would need location context)
  const travelPenalty = 0;

  // Compute weighted score
  const score =
    UTILITY_SCORE_WEIGHTS.iconic * iconicScore +
    UTILITY_SCORE_WEIGHTS.userPrefs * preferenceMatch +
    UTILITY_SCORE_WEIGHTS.diversity * diversityBonus +
    UTILITY_SCORE_WEIGHTS.quality * qualitySignal -
    UTILITY_SCORE_WEIGHTS.travelPenalty * travelPenalty;

  return Math.min(1, Math.max(0, score));
}

/**
 * Find raw ID by place name (fuzzy match).
 */
function findRawIdByName(candidates: EnrichedCandidateRaw[], name: string): string | null {
  const normalizedSearch = normalizeName(name);
  
  // Exact match first
  const exact = candidates.find(c => c.normalizedName === normalizedSearch);
  if (exact) return exact.rawId;

  // Partial match
  const partial = candidates.find(c => 
    c.normalizedName.includes(normalizedSearch) || 
    normalizedSearch.includes(c.normalizedName)
  );
  if (partial) return partial.rawId;

  return null;
}

/**
 * Build legacy candidates format for backward compatibility.
 */
function buildLegacyCandidates(
  enriched: EnrichedCandidateRaw[],
  enableMeals: boolean
): ResearchOutputV3['candidates'] {
  const attractions: Candidate[] = [];
  const restaurants: Candidate[] = [];
  const cafes: Candidate[] = [];

  for (const c of enriched) {
    const legacy: Candidate = {
      id: c.rawId,
      name: c.name,
      type: mapCategoryToLegacyType(c.category),
      location: {
        lat: c.location.lat,
        lng: c.location.lng,
        neighborhood: c.vicinity || '',
      },
      photo_url: c.photoUrl,
      reddit_data: {
        mentions: 0,
        sentiment: 0.7,
        sample_quotes: [],
        sources: [],
      },
      google_data: {
        rating: c.rating,
        reviews_count: c.reviewCount,
        price_level: c.priceLevel || 2,
        opening_hours: undefined,
      },
      constraints_satisfied: {
        wheelchair_accessible: true,
        vegan_friendly: c.category === 'restaurant' || c.category === 'cafe',
        cost: (c.priceLevel || 2) * 15,
      },
      relevance_score: c.utilityScore,
      why_relevant: c.isBigRock
        ? `Big Rock: ${c.name} (${c.reviewCount} reviews)`
        : `${c.category}: ${c.name} (${c.rating}★)`,
    };

    if (c.category === 'restaurant') {
      if (enableMeals) restaurants.push(legacy);
    } else if (c.category === 'cafe') {
      if (enableMeals) cafes.push(legacy);
    } else {
      attractions.push(legacy);
    }
  }

  return { attractions, restaurants, cafes };
}

/**
 * Map ActivityCategory to legacy Candidate type.
 */
function mapCategoryToLegacyType(category: ActivityCategory): Candidate['type'] {
  if (category === 'restaurant') return 'restaurant';
  if (category === 'cafe') return 'cafe';
  return 'attraction';
}

/**
 * Simple geohash encoder.
 */
function encodeGeohash(lat: number, lng: number, precision: number): string {
  const BASE32 = '0123456789bcdefghjkmnpqrstuvwxyz';
  let minLat = -90, maxLat = 90;
  let minLng = -180, maxLng = 180;
  let hash = '';
  let bit = 0;
  let ch = 0;
  let isLng = true;

  while (hash.length < precision) {
    if (isLng) {
      const mid = (minLng + maxLng) / 2;
      if (lng >= mid) {
        ch |= (1 << (4 - bit));
        minLng = mid;
      } else {
        maxLng = mid;
      }
    } else {
      const mid = (minLat + maxLat) / 2;
      if (lat >= mid) {
        ch |= (1 << (4 - bit));
        minLat = mid;
      } else {
        maxLat = mid;
      }
    }
    isLng = !isLng;
    if (bit < 4) {
      bit++;
    } else {
      hash += BASE32[ch];
      bit = 0;
      ch = 0;
    }
  }

  return hash;
}
