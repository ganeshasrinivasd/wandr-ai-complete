/**
 * Google Maps Client using native fetch API
 *
 * Replaces @googlemaps/google-maps-services-js to avoid bundling issues with Next.js
 */

const API_KEY = process.env.GOOGLE_MAPS_API_KEY!;
const BASE_URL = 'https://maps.googleapis.com/maps/api';

interface Location {
  lat: number;
  lng: number;
}

interface PlaceResult {
  place_id: string;
  name: string;
  vicinity?: string;
  location?: Location;
  rating?: number;
  user_ratings_total?: number;
  price_level?: number;
  types?: string[];
  opening_hours?: { open_now?: boolean };
  photo_reference?: string | null;
}

interface PlaceDetails {
  place_id: string;
  name?: string;
  address?: string;
  location?: Location;
  rating?: number;
  reviews_count?: number;
  price_level?: number;
  opening_hours?: any;
  wheelchair_accessible?: boolean;
  website?: string;
  phone?: string;
  reviews?: Array<{
    author: string;
    rating: number;
    text: string;
    time: number;
  }>;
  types?: string[];
}

// Tool 1: Search places
async function searchPlaces(
  query: string,
  location: Location,
  radius?: number,
  type?: string
): Promise<PlaceResult[]> {
  const params = new URLSearchParams({
    location: `${location.lat},${location.lng}`,
    radius: String(radius || 5000),
    keyword: query,
    key: API_KEY,
  });

  if (type) {
    params.append('type', type);
  }

  console.log(`→ Searching places: ${query}`);

  try {
    const response = await fetch(`${BASE_URL}/place/nearbysearch/json?${params}`);
    const data = await response.json();

    if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
      console.error('Places API error:', data.status, data.error_message);
      return [];
    }

    const results = (data.results || []).map((place: any) => ({
      place_id: place.place_id,
      name: place.name,
      vicinity: place.vicinity,
      location: place.geometry?.location,
      rating: place.rating,
      user_ratings_total: place.user_ratings_total,
      price_level: place.price_level,
      types: place.types,
      opening_hours: place.opening_hours,
      photo_reference: place.photos?.[0]?.photo_reference || null,
    }));

    console.log(`✓ Found ${results.length} places`);
    return results;
  } catch (error) {
    console.error('Error searching places:', error);
    return [];
  }
}

// Tool 2: Get place details
async function getPlaceDetails(placeId: string): Promise<PlaceDetails | null> {
  const fields = [
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
  ].join(',');

  const params = new URLSearchParams({
    place_id: placeId,
    fields,
    key: API_KEY,
  });

  console.log(`→ Getting details for place: ${placeId}`);

  try {
    const response = await fetch(`${BASE_URL}/place/details/json?${params}`);
    const data = await response.json();

    if (data.status !== 'OK') {
      console.error('Place details API error:', data.status, data.error_message);
      return null;
    }

    const place = data.result;
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
      reviews: place.reviews?.slice(0, 5).map((r: any) => ({
        author: r.author_name,
        rating: r.rating,
        text: r.text,
        time: r.time,
      })),
      types: place.types,
    };
  } catch (error) {
    console.error('Error getting place details:', error);
    return null;
  }
}

// Tool 3: Check accessibility
async function checkAccessibility(placeId: string): Promise<{
  place_id: string;
  name?: string;
  wheelchair_accessible: boolean;
  confidence: 'verified' | 'unknown';
  source: string;
  error?: string;
}> {
  const params = new URLSearchParams({
    place_id: placeId,
    fields: 'wheelchair_accessible_entrance,name',
    key: API_KEY,
  });

  console.log(`→ Checking accessibility for: ${placeId}`);

  try {
    const response = await fetch(`${BASE_URL}/place/details/json?${params}`);
    const data = await response.json();

    if (data.status !== 'OK') {
      return {
        place_id: placeId,
        wheelchair_accessible: false,
        confidence: 'unknown',
        source: 'google_maps',
        error: 'Failed to fetch data',
      };
    }

    const place = data.result;
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
      source: 'google_maps',
      error: 'Failed to fetch data',
    };
  }
}

// Tool 4: Get directions
async function getDirections(
  origin: string | Location,
  destination: string | Location,
  mode?: 'driving' | 'walking' | 'transit' | 'bicycling'
): Promise<{
  distance?: { text: string; value: number };
  duration?: { text: string; value: number };
  start_address?: string;
  end_address?: string;
  steps?: Array<{
    instruction: string;
    distance: { text: string; value: number };
    duration: { text: string; value: number };
    travel_mode: string;
  }>;
} | null> {
  const originStr = typeof origin === 'string' ? origin : `${origin.lat},${origin.lng}`;
  const destStr = typeof destination === 'string' ? destination : `${destination.lat},${destination.lng}`;

  const params = new URLSearchParams({
    origin: originStr,
    destination: destStr,
    mode: mode || 'transit',
    key: API_KEY,
  });

  console.log(`→ Getting directions: ${originStr} → ${destStr}`);

  try {
    const response = await fetch(`${BASE_URL}/directions/json?${params}`);
    const data = await response.json();

    if (data.status !== 'OK') {
      console.error('Directions API error:', data.status, data.error_message);
      return null;
    }

    const route = data.routes[0];
    const leg = route.legs[0];

    console.log(`✓ Route: ${leg.distance?.text} in ${leg.duration?.text}`);

    return {
      distance: leg.distance,
      duration: leg.duration,
      start_address: leg.start_address,
      end_address: leg.end_address,
      steps: leg.steps.map((step: any) => ({
        instruction: step.html_instructions,
        distance: step.distance,
        duration: step.duration,
        travel_mode: step.travel_mode,
      })),
    };
  } catch (error) {
    console.error('Error getting directions:', error);
    return null;
  }
}

// Tool 5: Calculate route time for multiple waypoints
async function calculateRouteTime(
  waypoints: string[],
  mode?: 'driving' | 'walking' | 'transit'
): Promise<{
  total_time_seconds: number;
  total_time_minutes: number;
  total_distance_km: string;
  waypoints_count: number;
}> {
  console.log(`→ Calculating route time for ${waypoints.length} waypoints`);

  let totalSeconds = 0;
  let totalMeters = 0;

  for (let i = 0; i < waypoints.length - 1; i++) {
    const result = await getDirections(waypoints[i], waypoints[i + 1], mode);
    if (result) {
      totalSeconds += result.duration?.value || 0;
      totalMeters += result.distance?.value || 0;
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

// Export the client
export const googleMapsMCP = {
  searchPlaces,
  getPlaceDetails,
  checkAccessibility,
  getDirections,
  calculateRouteTime,
};
