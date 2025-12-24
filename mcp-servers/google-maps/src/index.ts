import { Client, PlaceInputType } from '@googlemaps/google-maps-services-js';

const client = new Client({});
const API_KEY = process.env.GOOGLE_MAPS_API_KEY!;

interface Location {
  lat: number;
  lng: number;
}

// Tool 1: Search places
export async function searchPlaces(params: {
  query: string;
  location: Location;
  radius?: number;
  type?: string;
}) {
  const { query, location, radius = 5000, type } = params;

  console.log(`→ Searching places: ${query}`);

  try {
    const response = await client.placesNearby({
      params: {
        location,
        radius,
        keyword: query,
        type: type as any,
        key: API_KEY,
      },
    });

    const results = response.data.results.map((place) => ({
      place_id: place.place_id,
      name: place.name,
      vicinity: place.vicinity,
      location: place.geometry?.location,
      rating: place.rating,
      user_ratings_total: place.user_ratings_total,
      price_level: place.price_level,
      types: place.types,
      opening_hours: place.opening_hours,
    }));

    console.log(`✓ Found ${results.length} places`);
    return results;
  } catch (error) {
    console.error('Error searching places:', error);
    throw error;
  }
}

// Tool 2: Get place details
export async function getPlaceDetails(placeId: string) {
  console.log(`→ Getting details for place: ${placeId}`);

  try {
    const response = await client.placeDetails({
      params: {
        place_id: placeId,
        fields: [
          'name',
          'formatted_address',
          'geometry',
          'rating',
          'user_ratings_total',
          'price_level',
          'opening_hours',
          'wheelchair_accessible_entrance',
          'website',
          'formatted_phone_number',
          'reviews',
          'types',
        ],
        key: API_KEY,
      },
    });

    const place = response.data.result;

    console.log(`✓ Got details for: ${place.name}`);

    return {
      place_id: placeId,
      name: place.name,
      address: place.formatted_address,
      location: place.geometry?.location,
      rating: place.rating,
      reviews_count: place.user_ratings_total,
      price_level: place.price_level,
      opening_hours: place.opening_hours,
      wheelchair_accessible: place.wheelchair_accessible_entrance,
      website: place.website,
      phone: place.formatted_phone_number,
      reviews: place.reviews?.slice(0, 5).map((r) => ({
        author: r.author_name,
        rating: r.rating,
        text: r.text,
        time: r.time,
      })),
      types: place.types,
    };
  } catch (error) {
    console.error('Error getting place details:', error);
    throw error;
  }
}

// Tool 3: Check accessibility
export async function checkAccessibility(placeId: string) {
  console.log(`→ Checking accessibility for: ${placeId}`);

  try {
    const response = await client.placeDetails({
      params: {
        place_id: placeId,
        fields: ['wheelchair_accessible_entrance', 'name'],
        key: API_KEY,
      },
    });

    const place = response.data.result;
    const accessible = place.wheelchair_accessible_entrance;

    console.log(
      `✓ Accessibility: ${accessible === true ? 'Yes' : accessible === false ? 'No' : 'Unknown'}`
    );

    return {
      place_id: placeId,
      name: place.name,
      wheelchair_accessible: accessible === true,
      confidence: accessible !== undefined ? 'verified' : 'unknown',
      source: 'google_maps',
    };
  } catch (error) {
    console.error('Error checking accessibility:', error);
    return {
      place_id: placeId,
      wheelchair_accessible: false,
      confidence: 'unknown',
      error: 'Failed to fetch data',
    };
  }
}

// Tool 4: Get directions
export async function getDirections(params: {
  origin: string | Location;
  destination: string | Location;
  mode?: 'driving' | 'walking' | 'transit' | 'bicycling';
}) {
  const { origin, destination, mode = 'transit' } = params;

  console.log(`→ Getting directions: ${origin} → ${destination}`);

  try {
    const response = await client.directions({
      params: {
        origin: origin as any,
        destination: destination as any,
        mode: mode as any,
        key: API_KEY,
      },
    });

    const route = response.data.routes[0];
    const leg = route.legs[0];

    console.log(
      `✓ Route: ${leg.distance?.text} in ${leg.duration?.text}`
    );

    return {
      distance: leg.distance,
      duration: leg.duration,
      start_address: leg.start_address,
      end_address: leg.end_address,
      steps: leg.steps.map((step) => ({
        instruction: step.html_instructions,
        distance: step.distance,
        duration: step.duration,
        travel_mode: step.travel_mode,
      })),
    };
  } catch (error) {
    console.error('Error getting directions:', error);
    throw error;
  }
}

// Tool 5: Calculate route time for multiple waypoints
export async function calculateRouteTime(params: {
  waypoints: string[];
  mode?: 'driving' | 'walking' | 'transit';
}) {
  const { waypoints, mode = 'transit' } = params;

  console.log(`→ Calculating route time for ${waypoints.length} waypoints`);

  let totalSeconds = 0;
  let totalMeters = 0;

  for (let i = 0; i < waypoints.length - 1; i++) {
    try {
      const response = await client.directions({
        params: {
          origin: waypoints[i],
          destination: waypoints[i + 1],
          mode: mode as any,
          key: API_KEY,
        },
      });

      const leg = response.data.routes[0].legs[0];
      totalSeconds += leg.duration?.value || 0;
      totalMeters += leg.distance?.value || 0;
    } catch (error) {
      console.error(`Error calculating leg ${i}:`, error);
    }
  }

  console.log(
    `✓ Total: ${Math.round(totalMeters / 1000)}km in ${Math.round(totalSeconds / 60)} minutes`
  );

  return {
    total_time_seconds: totalSeconds,
    total_time_minutes: Math.round(totalSeconds / 60),
    total_distance_km: (totalMeters / 1000).toFixed(2),
    waypoints_count: waypoints.length,
  };
}

// Export all tools
export const googleMapsTools = {
  searchPlaces,
  getPlaceDetails,
  checkAccessibility,
  getDirections,
  calculateRouteTime,
};

// CLI test interface
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('\n🧪 Testing Google Maps MCP Server\n');

  searchPlaces({
    query: 'wheelchair accessible restaurants',
    location: { lat: 35.6762, lng: 139.6503 }, // Tokyo
    radius: 5000,
  })
    .then((results) => {
      console.log('\n📊 Results:', JSON.stringify(results.slice(0, 3), null, 2));
    })
    .catch((error) => {
      console.error('❌ Error:', error);
      process.exit(1);
    });
}
