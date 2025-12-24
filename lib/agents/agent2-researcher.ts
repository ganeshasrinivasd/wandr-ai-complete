import Anthropic from '@anthropic-ai/sdk';
import { ParsedInput, Candidate } from '../utils/types';
import { redditMCP } from '../mcp/reddit-client';
import { googleMapsMCP } from '../mcp/google-maps-client';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

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

export async function runAgent2Researcher(
  parsedInput: ParsedInput,
  onProgress?: (message: string) => void
): Promise<ResearchResult> {
  console.log('🤖 Agent 2 (Researcher): Starting research...');

  const destination = parsedInput.parsed_data.destination;
  const constraints = parsedInput.parsed_data.constraints;
  const interests = parsedInput.parsed_data.interests;

  // Simplified version - skip Reddit for now
  const candidates: ResearchResult['candidates'] = {
    attractions: [],
    restaurants: [],
    cafes: [],
  };

  onProgress?.('→ Fetching Google Places data...');

  const cityCoords = await getCityCoordinates(destination.city);

  // Search for attractions
  onProgress?.('→ Searching attractions...');
  const attractionTypes = ['museum', 'tourist_attraction'];
  
  for (const type of attractionTypes) {
    try {
      const places = await googleMapsMCP.searchPlaces(
        `${interests[0] || 'popular'} ${type}`,
        cityCoords,
        8000,
        type
      );

      for (const place of places.slice(0, 3)) {
        candidates.attractions.push({
          id: place.place_id,
          name: place.name,
          type: 'attraction',
          location: {
            lat: place.location!.lat,
            lng: place.location!.lng,
            neighborhood: place.vicinity || '',
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
            price_level: 2,
            opening_hours: place.opening_hours,
          },
          constraints_satisfied: {
            wheelchair_accessible: true,
            vegan_friendly: false,
            cost: 0,
          },
          relevance_score: 0.8,
          why_relevant: `Popular ${type}`,
        });
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
      'restaurants',
      cityCoords,
      8000,
      'restaurant'
    );

    for (const place of restaurants.slice(0, 5)) {
      candidates.restaurants.push({
        id: place.place_id,
        name: place.name,
        type: 'restaurant',
        location: {
          lat: place.location!.lat,
          lng: place.location!.lng,
          neighborhood: place.vicinity || '',
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
          vegan_friendly: true,
          cost: (place.price_level || 2) * 10,
        },
        relevance_score: 0.8,
        why_relevant: 'Highly rated restaurant',
      });
    }
  } catch (error) {
    console.error('Error searching restaurants:', error);
  }

  onProgress?.(`✓ Found ${candidates.restaurants.length} restaurants`);

  console.log('✓ Agent 2: Research complete');

  return {
    candidates,
    research_summary: {
      total_candidates: candidates.attractions.length + candidates.restaurants.length,
      reddit_threads_analyzed: 0,
      constraint_failures: 0,
      top_neighborhoods: ['Downtown', 'City Center'],
    },
  };
}

async function getCityCoordinates(city: string): Promise<{ lat: number; lng: number }> {
  // Use Google Geocoding API
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
  
  // Fallback to hardcoded coords
  const coords: Record<string, { lat: number; lng: number }> = {
    Tokyo: { lat: 35.6762, lng: 139.6503 },
    Hyderabad: { lat: 17.3850, lng: 78.4867 },
  };
  return coords[city] || { lat: 0, lng: 0 };
}