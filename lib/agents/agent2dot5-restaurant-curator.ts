import Anthropic from '@anthropic-ai/sdk';
import { ParsedInput, Candidate } from '../utils/types';
import { googleMapsMCP } from '../mcp/google-maps-client';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

interface RestaurantResults {
  restaurants: Candidate[];
  cafes: Candidate[];
  summary: {
    total_restaurants: number;
    price_tiers: Record<string, number>;
    cuisine_types: string[];
    dietary_compliant: number;
  };
}

/**
 * Agent 2.5: Restaurant Curator
 * 
 * Specialized agent for finding world-class restaurants that match:
 * - Budget (price tier: ¥, ¥¥, ¥¥¥, ¥¥¥¥)
 * - Dietary constraints (vegan, vegetarian, halal, kosher, gluten-free)
 * - Cuisine preferences (if user interested in "food")
 * - Rating & popularity (sort by rating × log(reviews))
 */
export async function runAgent2dot5RestaurantCurator(
  parsedInput: ParsedInput,
  cityCoords: { lat: number; lng: number },
  onProgress?: (message: string) => void
): Promise<RestaurantResults> {
  console.log('🤖 Agent 2.5 (Restaurant Curator): Finding best restaurants...');

  const destination = parsedInput.parsed_data.destination;
  const budget = parsedInput.parsed_data.budget.amount_per_day;
  const dietary = parsedInput.parsed_data.constraints.dietary || [];
  const interests = parsedInput.parsed_data.interests || [];

  // ========================================
  // STEP 1: DETERMINE BUDGET TIER
  // ========================================
  
  // Google Places price_level: 0-4 (free to very expensive)
  // Map daily budget to price level
  const maxPriceLevel = budget < 50 ? 1 :    // $ (budget)
                        budget < 100 ? 2 :   // $$ (moderate)
                        budget < 200 ? 3 :   // $$$ (pricey)
                        4;                    // $$$$ (fine dining)
  
  onProgress?.(`→ Budget tier: ${getPriceLevelSymbol(maxPriceLevel)} (max $${budget}/day)`);

  // ========================================
  // STEP 2: BUILD SEARCH QUERIES
  // ========================================
  
  const searchQueries = [
    // Base queries - always search
    'best restaurants',
    'top rated restaurants',
    'local cuisine',
    'popular dining',
  ];

  // Add dietary-specific queries
  if (dietary.includes('vegan')) {
    searchQueries.push('vegan restaurants', 'plant based food');
  }
  if (dietary.includes('vegetarian')) {
    searchQueries.push('vegetarian restaurants');
  }
  if (dietary.includes('halal')) {
    searchQueries.push('halal restaurants');
  }
  if (dietary.includes('kosher')) {
    searchQueries.push('kosher restaurants');
  }
  if (dietary.includes('gluten_free')) {
    searchQueries.push('gluten free restaurants');
  }

  // Add cuisine-specific queries if user is interested in food
  if (interests.includes('food')) {
    // Add popular cuisines for the destination
    const cuisinesByCity: Record<string, string[]> = {
      'Tokyo': ['ramen shops', 'sushi restaurants', 'izakaya', 'tempura restaurants'],
      'Paris': ['french bistro', 'cafe', 'brasserie', 'patisserie'],
      'New York': ['pizza', 'bagels', 'delis', 'fine dining'],
      'Rome': ['trattoria', 'pizzeria', 'gelato', 'osteria'],
      'Bangkok': ['street food', 'thai restaurants', 'night markets'],
    };
    
    const localCuisines = cuisinesByCity[destination.city] || [];
    searchQueries.push(...localCuisines);
  }

  onProgress?.(`→ Searching ${searchQueries.length} restaurant categories...`);

  // ========================================
  // STEP 3: SEARCH ALL CATEGORIES
  // ========================================
  
  const allRestaurants: any[] = [];
  const seenPlaceIds = new Set<string>();

  for (const query of searchQueries) {
    try {
      const places = await googleMapsMCP.searchPlaces(
        query,
        cityCoords,
        10000, // 10km radius (smaller than attractions)
        'restaurant'
      );

      // Add unique places only
      for (const place of places) {
        if (!seenPlaceIds.has(place.place_id)) {
          seenPlaceIds.add(place.place_id);
          allRestaurants.push(place);
        }
      }

      onProgress?.(`  ✓ ${query}: ${places.length} found`);
    } catch (error) {
      console.error(`Error searching ${query}:`, error);
    }
  }

  // ========================================
  // STEP 4: FILTER BY PRICE LEVEL
  // ========================================
  
  const affordableRestaurants = allRestaurants.filter(place => {
    const priceLevel = place.price_level || 2; // Default to $$
    return priceLevel <= maxPriceLevel;
  });

  onProgress?.(`→ Filtered to ${affordableRestaurants.length} restaurants within budget`);

  // ========================================
  // STEP 5: CALCULATE POPULARITY SCORES
  // ========================================
  
  const scoredRestaurants = affordableRestaurants.map(place => ({
    ...place,
    popularity_score: calculatePopularityScore(place),
    dietary_match: checkDietaryMatch(place, dietary),
  }));

  // ========================================
  // STEP 6: SORT BY POPULARITY
  // ========================================
  
  scoredRestaurants.sort((a, b) => {
    // Boost dietary matches
    const aScore = a.popularity_score * (a.dietary_match ? 1.5 : 1);
    const bScore = b.popularity_score * (b.dietary_match ? 1.5 : 1);
    return bScore - aScore;
  });

  // ========================================
  // STEP 7: SEPARATE RESTAURANTS & CAFES
  // ========================================
  
  const restaurants = scoredRestaurants
    .filter(p => !p.types.includes('cafe'))
    .slice(0, 20); // Top 20 restaurants

  const cafes = scoredRestaurants
    .filter(p => p.types.includes('cafe'))
    .slice(0, 10); // Top 10 cafes

  onProgress?.(`✓ Selected ${restaurants.length} restaurants, ${cafes.length} cafes`);

  // ========================================
  // STEP 8: CONVERT TO CANDIDATE FORMAT
  // ========================================
  
  const restaurantCandidates: Candidate[] = restaurants.map(place => ({
    id: place.place_id,
    name: place.name,
    type: 'restaurant',
    location: {
      lat: place.location?.lat || cityCoords.lat,
      lng: place.location?.lng || cityCoords.lng,
      neighborhood: place.vicinity || destination.city,
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
      wheelchair_accessible: place.wheelchair_accessible_entrance || true,
      vegan_friendly: place.dietary_match || false,
      cost: estimateMealCost(place.price_level || 2),
    },
    relevance_score: place.popularity_score,
    why_relevant: getRestaurantWhy(place, dietary),
  }));

  const cafeCandidates: Candidate[] = cafes.map(place => ({
    id: place.place_id,
    name: place.name,
    type: 'cafe',
    location: {
      lat: place.location?.lat || cityCoords.lat,
      lng: place.location?.lng || cityCoords.lng,
      neighborhood: place.vicinity || destination.city,
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
      price_level: place.price_level || 1,
      opening_hours: place.opening_hours,
    },
    constraints_satisfied: {
      wheelchair_accessible: place.wheelchair_accessible_entrance || true,
      vegan_friendly: false,
      cost: 8,
    },
    relevance_score: place.popularity_score,
    why_relevant: `Popular cafe (${place.rating}★)`,
  }));

  // ========================================
  // STEP 9: GENERATE SUMMARY
  // ========================================
  
  const priceTiers: Record<string, number> = {};
  for (const place of restaurants) {
    const tier = getPriceLevelSymbol(place.price_level || 2);
    priceTiers[tier] = (priceTiers[tier] || 0) + 1;
  }

  const cuisineTypes = [...new Set(
    restaurants
      .flatMap(p => p.types)
      .filter((t: string) => t !== 'restaurant' && t !== 'food' && t !== 'point_of_interest')
  )].slice(0, 5);

  const dietaryCompliant = restaurants.filter(p => p.dietary_match).length;

  console.log('✓ Agent 2.5: Restaurant curation complete');
  console.log(`  → ${restaurantCandidates.length} restaurants, ${cafeCandidates.length} cafes`);

  return {
    restaurants: restaurantCandidates,
    cafes: cafeCandidates,
    summary: {
      total_restaurants: restaurantCandidates.length,
      price_tiers: priceTiers,
      cuisine_types: cuisineTypes,
      dietary_compliant: dietaryCompliant,
    },
  };
}

// ========================================
// HELPER FUNCTIONS
// ========================================

/**
 * Calculate popularity score: rating × log(reviews)
 */
function calculatePopularityScore(place: any): number {
  const rating = place.rating || 4.0;
  const reviewCount = place.user_ratings_total || 0;
  
  if (reviewCount === 0) {
    return rating * 2;
  }
  
  return rating * Math.log10(Math.max(reviewCount, 1));
}

/**
 * Check if restaurant matches dietary requirements
 */
function checkDietaryMatch(place: any, dietary: string[]): boolean {
  if (dietary.length === 0) return false;
  
  const placeTypes = place.types || [];
  const placeName = place.name.toLowerCase();
  const placeTypesStr = placeTypes.join(' ').toLowerCase();
  
  for (const diet of dietary) {
    const dietLower = diet.toLowerCase();
    if (placeTypesStr.includes(dietLower) || placeName.includes(dietLower)) {
      return true;
    }
  }
  
  return false;
}

/**
 * Estimate meal cost based on Google price_level
 */
function estimateMealCost(priceLevel: number): number {
  const costs = {
    0: 5,   // Free/very cheap
    1: 12,  // $ (budget)
    2: 20,  // $$ (moderate)
    3: 40,  // $$$ (pricey)
    4: 80,  // $$$$ (fine dining)
  };
  return costs[priceLevel as keyof typeof costs] || 20;
}

/**
 * Get price level symbol
 */
function getPriceLevelSymbol(priceLevel: number): string {
  const symbols = {
    0: 'Free',
    1: '$',
    2: '$$',
    3: '$$$',
    4: '$$$$',
  };
  return symbols[priceLevel as keyof typeof symbols] || '$$';
}

/**
 * Generate why this restaurant is relevant
 */
function getRestaurantWhy(place: any, dietary: string[]): string {
  const rating = place.rating || 4.0;
  const reviews = place.user_ratings_total || 0;
  const priceSymbol = getPriceLevelSymbol(place.price_level || 2);
  
  if (place.dietary_match && reviews > 1000) {
    return `Highly rated ${dietary[0]} restaurant (${rating}★, ${formatNumber(reviews)} reviews, ${priceSymbol})`;
  } else if (place.dietary_match) {
    return `${dietary[0]}-friendly (${rating}★, ${priceSymbol})`;
  } else if (reviews > 5000) {
    return `Must-try restaurant (${rating}★, ${formatNumber(reviews)} reviews, ${priceSymbol})`;
  } else if (reviews > 1000) {
    return `Popular dining spot (${rating}★, ${formatNumber(reviews)} reviews, ${priceSymbol})`;
  } else {
    return `Highly rated (${rating}★, ${priceSymbol})`;
  }
}

/**
 * Format large numbers for display
 */
function formatNumber(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  } else if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'k';
  }
  return num.toString();
}
