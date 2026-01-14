import { ParsedInput, Candidate } from '../utils/types';
import { googleMapsMCP } from '../mcp/google-maps-client';

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
}

// Expanded place types for variety
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

const FOOD_TYPES = [
  'restaurant',
  'cafe',
  'bakery',
  'bar',
];

export async function runAgent2Researcher(
  parsedInput: ParsedInput,
  onProgress?: (message: string) => void
): Promise<ResearchResult> {
  console.log('🤖 Agent 2 (Researcher): Starting research...');

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

  // Calculate how many candidates we need (at least 4 per day + buffer)
  const minAttractionsNeeded = days * 3 + 5;
  const minRestaurantsNeeded = days * 2 + 3;

  // Search for attractions with variety
  onProgress?.('→ Searching attractions and experiences...');
  
  for (const type of ATTRACTION_TYPES) {
    if (candidates.attractions.length >= minAttractionsNeeded) break;
    
    try {
      // Build search query based on interests
      const interestQuery = interests.length > 0 
        ? `${interests[Math.floor(Math.random() * interests.length)]} ${type}`
        : `popular ${type}`;
      
      const places = await googleMapsMCP.searchPlaces(
        interestQuery,
        cityCoords,
        15000, // 15km radius for better coverage
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

  onProgress?.(`✓ Found ${candidates.attractions.length} attractions`);

  // Search for restaurants
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

      candidates.restaurants.push(createCandidate(place, 'restaurant'));
    }
  } catch (error) {
    console.error('Error searching restaurants:', error);
  }

  onProgress?.(`✓ Found ${candidates.restaurants.length} restaurants`);

  // Search for cafes
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

      candidates.cafes.push(createCandidate(place, 'cafe'));
    }
  } catch (error) {
    console.error('Error searching cafes:', error);
  }

  onProgress?.(`✓ Found ${candidates.cafes.length} cafes`);

  // Extract unique neighborhoods
  const neighborhoods = new Set<string>();
  [...candidates.attractions, ...candidates.restaurants, ...candidates.cafes].forEach(c => {
    if (c.location.neighborhood) {
      neighborhoods.add(c.location.neighborhood.split(',')[0].trim());
    }
  });

  console.log('✓ Agent 2: Research complete');
  console.log(`  → ${candidates.attractions.length} attractions`);
  console.log(`  → ${candidates.restaurants.length} restaurants`);
  console.log(`  → ${candidates.cafes.length} cafes`);

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

function createCandidate(place: any, type: 'attraction' | 'restaurant' | 'cafe'): Candidate {
  return {
    id: place.place_id || `place_${Date.now()}_${Math.random()}`,
    name: place.name || 'Unknown Place',
    type: type === 'cafe' ? 'cafe' : type,
    location: {
      lat: place.location?.lat || 0,
      lng: place.location?.lng || 0,
      neighborhood: place.vicinity || place.formatted_address || '',
    },
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
  
  // Fallback coords for common cities
  const coords: Record<string, { lat: number; lng: number }> = {
    'Tokyo': { lat: 35.6762, lng: 139.6503 },
    'Hyderabad': { lat: 17.3850, lng: 78.4867 },
    'Paris': { lat: 48.8566, lng: 2.3522 },
    'New York': { lat: 40.7128, lng: -74.0060 },
    'London': { lat: 51.5074, lng: -0.1278 },
  };
  return coords[city] || { lat: 0, lng: 0 };
}
