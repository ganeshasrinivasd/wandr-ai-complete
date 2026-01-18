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
 */

import { ParsedInput, Candidate } from '../utils/types';
import {
  retrieveCandidates,
  toOptimizerFormat,
  RetrievalConfig,
  RetrievalResult,
} from '../retrieval/cost-effective-retrieval';

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
