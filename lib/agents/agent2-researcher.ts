import { ParsedInput, Candidate } from '../utils/types';
import { googleMapsMCP } from '../mcp/google-maps-client';
import {
  getIconicSearchQueries,
  getInterestSearchQueries,
  calculateIconicScore,
  calculateQueryConsensus,
  deduplicateCandidates,
  ICONIC_CATEGORY_WEIGHTS,
} from '../utils/itinerary-scoring';

interface ResearchResult {
  candidates: {
    attractions: Candidate[];
    restaurants: Candidate[];
    cafes: Candidate[];
  };
  iconicCandidates: Candidate[]; // Specifically identified iconic places
  queryConsensus: Map<string, number>; // place_id -> consensus bonus
  research_summary: {
    total_candidates: number;
    iconic_candidates: number;
    reddit_threads_analyzed: number;
    constraint_failures: number;
    top_neighborhoods: string[];
    queries_run: number;
  };
}

// Place types for different categories
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
  'historic_site',
  'monument',
  'palace',
  'castle',
];

const FOOD_TYPES = ['restaurant', 'cafe', 'bakery', 'bar'];

export async function runAgent2Researcher(
  parsedInput: ParsedInput,
  onProgress?: (message: string) => void
): Promise<ResearchResult> {
  console.log('🤖 Agent 2 (Researcher): Starting research with iconic discovery...');

  const destination = parsedInput.parsed_data.destination;
  const interests = parsedInput.parsed_data.interests;
  const days = parsedInput.parsed_data.dates.duration_days;

  const candidates: ResearchResult['candidates'] = {
    attractions: [],
    restaurants: [],
    cafes: [],
  };

  const seenPlaceIds = new Set<string>();
  const queryResults = new Map<string, Set<string>>(); // Track which places found in which queries

  onProgress?.('→ Getting city coordinates...');
  const cityCoords = await getCityCoordinates(destination.city);

  // Calculate how many candidates we need
  const minAttractionsNeeded = days * 4 + 8; // More buffer for filtering
  const minRestaurantsNeeded = days * 2 + 4;

  let totalQueriesRun = 0;

  // =========================================================================
  // PHASE 1: Run ICONIC queries first to ensure we capture famous places
  // =========================================================================
  onProgress?.('→ Searching for iconic landmarks and must-see attractions...');

  const iconicQueries = getIconicSearchQueries(destination.city, destination.country);

  for (const query of iconicQueries.slice(0, 6)) { // Run top 6 iconic queries
    try {
      totalQueriesRun++;
      const places = await googleMapsMCP.searchPlaces(query, cityCoords, 20000); // Wider radius

      const queryPlaceIds = new Set<string>();

      for (const place of places.slice(0, 10)) {
        if (!place.place_id) continue;

        queryPlaceIds.add(place.place_id);

        if (seenPlaceIds.has(place.place_id)) continue;
        seenPlaceIds.add(place.place_id);

        const candidate = createCandidate(place, 'attraction');
        candidates.attractions.push(candidate);
      }

      queryResults.set(query, queryPlaceIds);

      // Small delay to avoid rate limiting
      await delay(100);
    } catch (error) {
      console.error(`Error with iconic query "${query}":`, error);
    }
  }

  onProgress?.(`✓ Found ${candidates.attractions.length} places from iconic queries`);

  // =========================================================================
  // PHASE 2: Run interest-based queries
  // =========================================================================
  onProgress?.('→ Searching based on your interests...');

  const interestQueries = getInterestSearchQueries(destination.city, interests);

  for (const query of interestQueries.slice(0, 8)) { // Run top 8 interest queries
    if (candidates.attractions.length >= minAttractionsNeeded) break;

    try {
      totalQueriesRun++;
      const places = await googleMapsMCP.searchPlaces(query, cityCoords, 15000);

      const queryPlaceIds = new Set<string>();

      for (const place of places.slice(0, 8)) {
        if (!place.place_id) continue;

        queryPlaceIds.add(place.place_id);

        if (seenPlaceIds.has(place.place_id)) continue;
        seenPlaceIds.add(place.place_id);

        const candidate = createCandidate(place, 'attraction');
        candidates.attractions.push(candidate);
      }

      queryResults.set(query, queryPlaceIds);
      await delay(100);
    } catch (error) {
      console.error(`Error with interest query "${query}":`, error);
    }
  }

  onProgress?.(`✓ Found ${candidates.attractions.length} total attractions`);

  // =========================================================================
  // PHASE 3: Fill with type-based queries if needed
  // =========================================================================
  if (candidates.attractions.length < minAttractionsNeeded) {
    onProgress?.('→ Searching additional attraction types...');

    for (const type of ATTRACTION_TYPES) {
      if (candidates.attractions.length >= minAttractionsNeeded) break;

      try {
        totalQueriesRun++;
        const places = await googleMapsMCP.searchPlaces(
          `popular ${type}`,
          cityCoords,
          15000,
          type
        );

        for (const place of places.slice(0, 5)) {
          if (!place.place_id || seenPlaceIds.has(place.place_id)) continue;
          seenPlaceIds.add(place.place_id);
          candidates.attractions.push(createCandidate(place, 'attraction'));
        }
      } catch (error) {
        console.error(`Error searching ${type}:`, error);
      }
    }
  }

  // =========================================================================
  // PHASE 4: Search for restaurants
  // =========================================================================
  onProgress?.('→ Searching restaurants...');

  const restaurantQueries = [
    `best restaurants ${destination.city}`,
    `famous restaurants ${destination.city}`,
    `local food ${destination.city}`,
    `popular dining ${destination.city}`,
  ];

  for (const query of restaurantQueries) {
    if (candidates.restaurants.length >= minRestaurantsNeeded) break;

    try {
      totalQueriesRun++;
      const restaurants = await googleMapsMCP.searchPlaces(query, cityCoords, 15000, 'restaurant');

      for (const place of restaurants.slice(0, 8)) {
        if (!place.place_id || seenPlaceIds.has(place.place_id)) continue;
        seenPlaceIds.add(place.place_id);
        candidates.restaurants.push(createCandidate(place, 'restaurant'));
      }
    } catch (error) {
      console.error('Error searching restaurants:', error);
    }
  }

  onProgress?.(`✓ Found ${candidates.restaurants.length} restaurants`);

  // =========================================================================
  // PHASE 5: Search for cafes
  // =========================================================================
  onProgress?.('→ Searching cafes...');

  try {
    totalQueriesRun++;
    const cafes = await googleMapsMCP.searchPlaces(
      `popular cafes ${destination.city}`,
      cityCoords,
      15000,
      'cafe'
    );

    for (const place of cafes.slice(0, 10)) {
      if (!place.place_id || seenPlaceIds.has(place.place_id)) continue;
      seenPlaceIds.add(place.place_id);
      candidates.cafes.push(createCandidate(place, 'cafe'));
    }
  } catch (error) {
    console.error('Error searching cafes:', error);
  }

  onProgress?.(`✓ Found ${candidates.cafes.length} cafes`);

  // =========================================================================
  // PHASE 6: Calculate query consensus bonus for each place
  // =========================================================================
  const queryConsensus = new Map<string, number>();

  for (const candidate of [...candidates.attractions, ...candidates.restaurants, ...candidates.cafes]) {
    const consensus = calculateQueryConsensus(candidate.id, queryResults);
    queryConsensus.set(candidate.id, consensus);

    // Update relevance score with consensus bonus
    candidate.relevance_score = calculateIconicScore(candidate, consensus);
  }

  // =========================================================================
  // PHASE 7: Identify explicitly iconic candidates
  // =========================================================================
  const iconicThreshold = 0.45;
  const iconicCandidates = candidates.attractions
    .filter(c => calculateIconicScore(c, queryConsensus.get(c.id) || 0) >= iconicThreshold)
    .sort((a, b) => {
      const scoreA = calculateIconicScore(a, queryConsensus.get(a.id) || 0);
      const scoreB = calculateIconicScore(b, queryConsensus.get(b.id) || 0);
      return scoreB - scoreA;
    });

  onProgress?.(`✓ Identified ${iconicCandidates.length} iconic/must-see attractions`);

  // Extract unique neighborhoods
  const neighborhoods = new Set<string>();
  [...candidates.attractions, ...candidates.restaurants, ...candidates.cafes].forEach(c => {
    if (c.location.neighborhood) {
      neighborhoods.add(c.location.neighborhood.split(',')[0].trim());
    }
  });

  console.log('✓ Agent 2: Research complete');
  console.log(`  → ${candidates.attractions.length} attractions (${iconicCandidates.length} iconic)`);
  console.log(`  → ${candidates.restaurants.length} restaurants`);
  console.log(`  → ${candidates.cafes.length} cafes`);
  console.log(`  → ${totalQueriesRun} queries run`);

  return {
    candidates,
    iconicCandidates,
    queryConsensus,
    research_summary: {
      total_candidates:
        candidates.attractions.length + candidates.restaurants.length + candidates.cafes.length,
      iconic_candidates: iconicCandidates.length,
      reddit_threads_analyzed: 0,
      constraint_failures: 0,
      top_neighborhoods: Array.from(neighborhoods).slice(0, 5),
      queries_run: totalQueriesRun,
    },
  };
}

function createCandidate(
  place: any,
  type: 'attraction' | 'restaurant' | 'cafe'
): Candidate {
  // Build photo URL if photo_reference exists
  const photoUrl = place.photo_reference
    ? `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photo_reference=${place.photo_reference}&key=${process.env.GOOGLE_MAPS_API_KEY}`
    : undefined;

  // Determine more specific type from place types
  const placeTypes = place.types || [];
  let specificType = type;
  for (const t of placeTypes) {
    if (ICONIC_CATEGORY_WEIGHTS[t] !== undefined) {
      specificType = t as any;
      break;
    }
  }

  const reviewCount = place.user_ratings_total || 0;
  const rating = place.rating || 4.0;

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
      rating: rating,
      reviews_count: reviewCount,
      price_level: place.price_level || 2,
      opening_hours: place.opening_hours,
    },
    constraints_satisfied: {
      wheelchair_accessible: true,
      vegan_friendly: type !== 'attraction',
      cost: (place.price_level || 2) * 15,
    },
    relevance_score: calculateIconicScore({
      google_data: { rating, reviews_count: reviewCount },
      type: specificType,
    } as Candidate),
    why_relevant: reviewCount >= 5000
      ? `Famous attraction with ${reviewCount.toLocaleString()} reviews`
      : reviewCount >= 1000
        ? `Popular ${type} with ${reviewCount.toLocaleString()} reviews`
        : `Highly rated ${type}`,
  };
}

async function getCityCoordinates(city: string): Promise<{ lat: number; lng: number }> {
  try {
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
        city
      )}&key=${process.env.GOOGLE_MAPS_API_KEY}`
    );
    const data = await response.json();

    if (data.results && data.results[0]) {
      return {
        lat: data.results[0].geometry.location.lat,
        lng: data.results[0].geometry.location.lng,
      };
    }
  } catch (error) {
    console.error('Geocoding error:', error);
  }

  // Fallback coords for common cities
  const coords: Record<string, { lat: number; lng: number }> = {
    Tokyo: { lat: 35.6762, lng: 139.6503 },
    Hyderabad: { lat: 17.385, lng: 78.4867 },
    Paris: { lat: 48.8566, lng: 2.3522 },
    'New York': { lat: 40.7128, lng: -74.006 },
    London: { lat: 51.5074, lng: -0.1278 },
    Rome: { lat: 41.9028, lng: 12.4964 },
    Barcelona: { lat: 41.3851, lng: 2.1734 },
    Bangkok: { lat: 13.7563, lng: 100.5018 },
    Dubai: { lat: 25.2048, lng: 55.2708 },
    Singapore: { lat: 1.3521, lng: 103.8198 },
  };
  return coords[city] || { lat: 0, lng: 0 };
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
