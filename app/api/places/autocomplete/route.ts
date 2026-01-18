import { NextRequest, NextResponse } from 'next/server';

/**
 * Places Autocomplete API Route
 *
 * Uses Google Places Autocomplete to suggest locations as user types.
 * Filters to cities and regions only (no specific addresses).
 */

const GOOGLE_PLACES_API_URL = 'https://maps.googleapis.com/maps/api/place/autocomplete/json';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const input = searchParams.get('input');

  if (!input || input.length < 2) {
    return NextResponse.json({ predictions: [] });
  }

  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    console.error('GOOGLE_MAPS_API_KEY not configured');
    return NextResponse.json(
      { error: 'Service not configured' },
      { status: 500 }
    );
  }

  try {
    const params = new URLSearchParams({
      input,
      key: apiKey,
      types: '(cities)', // Only return cities
      language: 'en',
    });

    const response = await fetch(`${GOOGLE_PLACES_API_URL}?${params}`);
    const data = await response.json();

    if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
      console.error('Places API error:', data.status, data.error_message);
      return NextResponse.json(
        { error: 'Failed to fetch suggestions', status: data.status },
        { status: 500 }
      );
    }

    // Transform predictions to a simpler format
    const predictions = (data.predictions || []).map((p: any) => ({
      placeId: p.place_id,
      description: p.description,
      mainText: p.structured_formatting?.main_text || p.description.split(',')[0],
      secondaryText: p.structured_formatting?.secondary_text || '',
    }));

    return NextResponse.json({ predictions });
  } catch (error) {
    console.error('Places autocomplete error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch suggestions' },
      { status: 500 }
    );
  }
}
