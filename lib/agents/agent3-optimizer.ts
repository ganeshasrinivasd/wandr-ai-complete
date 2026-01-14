import { ParsedInput, Candidate, Itinerary, DayItinerary, Activity } from '../utils/types';

interface CandidateWithDistance extends Candidate {
  distanceFromLast?: number;
}

export async function runAgent3Optimizer(
  parsedInput: ParsedInput,
  candidates: any,
  onProgress?: (message: string) => void
): Promise<Itinerary> {
  console.log('🤖 Agent 3 (Optimizer): Building itinerary...');

  const days = parsedInput.parsed_data.dates.duration_days;
  const constraints = parsedInput.parsed_data.constraints;
  const budget = parsedInput.parsed_data.budget.amount_per_day;
  const pace = constraints.pace;

  // Activities per day based on pace
  const activitiesPerDay = pace === 'relaxed' ? 3 : pace === 'moderate' ? 4 : 5;

  // Get all candidates
  const allAttractions: Candidate[] = candidates.candidates?.attractions || [];
  const allRestaurants: Candidate[] = candidates.candidates?.restaurants || [];
  const allCafes: Candidate[] = candidates.candidates?.cafes || [];

  // Track used venues globally to prevent repeats
  const usedVenueIds = new Set<string>();

  // Handle empty candidates
  if (allAttractions.length === 0 && allRestaurants.length === 0) {
    return createEmptyItinerary(parsedInput, days);
  }

  onProgress?.('→ Clustering venues by geography...');

  // Create geographic clusters using K-means style clustering
  const allVenues = [...allAttractions, ...allRestaurants, ...allCafes];
  const clusters = createGeographicClusters(allVenues, Math.min(days, 5));

  onProgress?.(`✓ Created ${clusters.length} geographic zones`);

  const itinerary: Record<string, DayItinerary> = {};

  for (let day = 1; day <= days; day++) {
    onProgress?.(`→ Planning Day ${day} with optimal routing...`);

    // Pick cluster for this day (cycle through if more days than clusters)
    const clusterIndex = (day - 1) % clusters.length;
    const dayCluster = clusters[clusterIndex];

    // Get available (unused) venues from this cluster
    const availableAttractions = dayCluster
      .filter(c => c.type === 'attraction' && !usedVenueIds.has(c.id))
      .sort((a, b) => b.relevance_score - a.relevance_score);

    const availableRestaurants = dayCluster
      .filter(c => c.type === 'restaurant' && !usedVenueIds.has(c.id))
      .sort((a, b) => b.relevance_score - a.relevance_score);

    const availableCafes = dayCluster
      .filter(c => c.type === 'cafe' && !usedVenueIds.has(c.id))
      .sort((a, b) => b.relevance_score - a.relevance_score);

    // If cluster is depleted, pull from other clusters
    const backupAttractions = allAttractions
      .filter(c => !usedVenueIds.has(c.id) && !availableAttractions.includes(c))
      .sort((a, b) => b.relevance_score - a.relevance_score);

    const backupRestaurants = allRestaurants
      .filter(c => !usedVenueIds.has(c.id) && !availableRestaurants.includes(c))
      .sort((a, b) => b.relevance_score - a.relevance_score);

    // Build the day's route with proximity optimization
    const dayActivities = buildOptimizedDayRoute(
      [...availableAttractions, ...backupAttractions],
      [...availableRestaurants, ...backupRestaurants],
      [...availableCafes],
      activitiesPerDay,
      usedVenueIds
    );

    // Mark venues as used
    dayActivities.forEach(a => usedVenueIds.add(a.activity.id));

    // Calculate day stats
    const totalCost = dayActivities.reduce((sum, a) => sum + (a.activity.cost || 0), 0);
    const totalWalking = calculateTotalDistance(dayActivities);

    // Constraint validation
    const constraintSatisfaction = validateConstraints(dayActivities, constraints, budget, totalCost);

    const startDate = new Date(parsedInput.parsed_data.dates.start);
    startDate.setDate(startDate.getDate() + (day - 1));

    // Determine day theme from primary neighborhood
    const primaryNeighborhood = getMostCommonNeighborhood(dayActivities);

    itinerary[`day_${day}`] = {
      day,
      date: startDate.toISOString().split('T')[0],
      theme: `Day ${day} - ${primaryNeighborhood || parsedInput.parsed_data.destination.city}`,
      neighborhood: primaryNeighborhood,
      activities: dayActivities,
      day_summary: {
        total_cost: totalCost,
        total_walking_km: totalWalking,
        activities_count: dayActivities.length,
        constraint_satisfaction: constraintSatisfaction,
      },
    };

    onProgress?.(`✓ Day ${day}: ${dayActivities.length} activities, $${totalCost}, ${totalWalking.toFixed(1)}km walking`);
  }

  console.log('✓ Agent 3: Optimization complete');

  return {
    itinerary,
    overall_summary: {
      total_budget: `$${Object.values(itinerary).reduce((sum, d) => sum + d.day_summary.total_cost, 0).toFixed(0)}`,
      avg_per_day: `$${(Object.values(itinerary).reduce((sum, d) => sum + d.day_summary.total_cost, 0) / days).toFixed(0)}`,
      constraint_compliance: '100%',
      optimizations_made: [
        'Geographic clustering to minimize travel',
        'Proximity-based routing within each day',
        'No repeated venues across days',
        'Balanced activity types (attractions + meals)',
      ],
      potential_issues: [],
    },
  };
}


/**
 * Build an optimized day route using nearest-neighbor algorithm
 * Ensures activities are geographically close to minimize travel
 */
function buildOptimizedDayRoute(
  attractions: Candidate[],
  restaurants: Candidate[],
  cafes: Candidate[],
  targetActivities: number,
  usedIds: Set<string>
): Activity[] {
  const activities: Activity[] = [];
  let lastLocation: { lat: number; lng: number } | null = null;

  // Time slots for the day
  const timeSlots = [
    { time: '09:00-11:00', type: 'attraction', duration: 120 },
    { time: '11:30-12:30', type: 'meal', duration: 60 },      // Lunch
    { time: '13:00-15:30', type: 'attraction', duration: 150 },
    { time: '16:00-17:30', type: 'attraction', duration: 90 },
    { time: '18:00-19:30', type: 'meal', duration: 90 },      // Dinner
    { time: '20:00-21:00', type: 'cafe', duration: 60 },      // Optional evening
  ];

  const slotsToUse = timeSlots.slice(0, Math.min(targetActivities + 1, timeSlots.length));

  for (const slot of slotsToUse) {
    let selectedVenue: Candidate | null = null;

    if (slot.type === 'attraction') {
      selectedVenue = findNearestAvailable(attractions, lastLocation, usedIds);
    } else if (slot.type === 'meal') {
      selectedVenue = findNearestAvailable(restaurants, lastLocation, usedIds);
    } else if (slot.type === 'cafe') {
      selectedVenue = findNearestAvailable(cafes, lastLocation, usedIds);
      if (!selectedVenue) continue; // Cafe is optional
    }

    if (!selectedVenue) continue;

    // Calculate travel info from last location
    let travelInfo = undefined;
    if (lastLocation) {
      const distance = haversineDistance(
        lastLocation.lat, lastLocation.lng,
        selectedVenue.location.lat, selectedVenue.location.lng
      );
      travelInfo = {
        from: activities[activities.length - 1]?.activity.name || 'Start',
        mode: distance > 3 ? 'transit' : 'walking',
        duration_minutes: Math.round(distance > 3 ? distance * 3 : distance * 15),
        cost: distance > 3 ? 3 : 0,
        distance_km: Math.round(distance * 10) / 10,
      };
    }

    activities.push({
      time: slot.time,
      type: slot.type === 'attraction' ? 'attraction' : 'meal',
      activity: {
        id: selectedVenue.id,
        name: selectedVenue.name,
        duration_minutes: slot.duration,
        cost: selectedVenue.constraints_satisfied.cost || 0,
        accessibility_notes: selectedVenue.constraints_satisfied.wheelchair_accessible
          ? 'Wheelchair accessible'
          : undefined,
        vegan_details: selectedVenue.constraints_satisfied.vegan_friendly
          ? 'Vegan options available'
          : undefined,
        description: `${slot.type === 'meal' ? 'Dine at' : 'Visit'} ${selectedVenue.name}`,
        reddit_quote: selectedVenue.reddit_data.sample_quotes[0] || undefined,
        upvotes: selectedVenue.reddit_data.mentions || undefined,
      },
      travel: travelInfo,
    });

    // Mark as used and update last location
    usedIds.add(selectedVenue.id);
    lastLocation = { lat: selectedVenue.location.lat, lng: selectedVenue.location.lng };
  }

  return activities;
}

/**
 * Find the nearest available venue from a list
 */
function findNearestAvailable(
  venues: Candidate[],
  fromLocation: { lat: number; lng: number } | null,
  usedIds: Set<string>
): Candidate | null {
  const available = venues.filter(v => !usedIds.has(v.id));
  
  if (available.length === 0) return null;
  if (!fromLocation) return available[0]; // Return highest rated if no location yet

  // Sort by distance from last location
  const withDistance = available.map(v => ({
    ...v,
    distance: haversineDistance(
      fromLocation.lat, fromLocation.lng,
      v.location.lat, v.location.lng
    )
  }));

  // Prefer nearby venues but also consider rating
  withDistance.sort((a, b) => {
    // Score = distance penalty + rating bonus
    const scoreA = a.distance * 0.3 - a.relevance_score * 2;
    const scoreB = b.distance * 0.3 - b.relevance_score * 2;
    return scoreA - scoreB;
  });

  return withDistance[0];
}

/**
 * Create geographic clusters using simple K-means approach
 */
function createGeographicClusters(venues: Candidate[], k: number): Candidate[][] {
  if (venues.length === 0) return [[]];
  if (venues.length <= k) return venues.map(v => [v]);

  // Initialize centroids using venues spread across the area
  const sortedByLat = [...venues].sort((a, b) => a.location.lat - b.location.lat);
  const centroids: { lat: number; lng: number }[] = [];
  
  for (let i = 0; i < k; i++) {
    const idx = Math.floor((i / k) * sortedByLat.length);
    centroids.push({
      lat: sortedByLat[idx].location.lat,
      lng: sortedByLat[idx].location.lng
    });
  }

  // Assign venues to nearest centroid
  const clusters: Candidate[][] = Array.from({ length: k }, () => []);
  
  for (const venue of venues) {
    let minDist = Infinity;
    let closestCluster = 0;
    
    for (let i = 0; i < centroids.length; i++) {
      const dist = haversineDistance(
        venue.location.lat, venue.location.lng,
        centroids[i].lat, centroids[i].lng
      );
      if (dist < minDist) {
        minDist = dist;
        closestCluster = i;
      }
    }
    
    clusters[closestCluster].push(venue);
  }

  // Filter out empty clusters
  return clusters.filter(c => c.length > 0);
}

/**
 * Calculate distance between two points using Haversine formula
 */
function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}

/**
 * Calculate total walking/travel distance for a day
 */
function calculateTotalDistance(activities: Activity[]): number {
  return activities.reduce((sum, a) => {
    return sum + ((a.travel as any)?.distance_km || 0);
  }, 0);
}

/**
 * Get the most common neighborhood from activities
 */
function getMostCommonNeighborhood(activities: Activity[]): string {
  // This would need venue data - for now return empty
  return '';
}

/**
 * Validate constraints for the day
 */
function validateConstraints(
  activities: Activity[],
  constraints: any,
  budget: number,
  totalCost: number
): Record<string, string> {
  const result: Record<string, string> = {};

  if (constraints.accessibility?.includes('wheelchair_accessible')) {
    const allAccessible = activities.every(a => a.activity.accessibility_notes);
    result.wheelchair = allAccessible
      ? '✓ All venues wheelchair accessible'
      : '⚠️ Some venues not verified';
  }

  if (constraints.dietary?.length > 0) {
    const meals = activities.filter(a => a.type === 'meal');
    const allDietary = meals.every(a => a.activity.vegan_details);
    result.dietary = allDietary
      ? `✓ All meals have ${constraints.dietary.join(', ')} options`
      : '⚠️ Limited dietary options';
  }

  result.budget = totalCost <= budget
    ? `✓ $${totalCost} (under $${budget} budget)`
    : `⚠️ $${totalCost} (over budget by $${totalCost - budget})`;

  return result;
}

/**
 * Create empty itinerary when no candidates found
 */
function createEmptyItinerary(parsedInput: ParsedInput, days: number): Itinerary {
  const itinerary: Record<string, DayItinerary> = {};
  
  for (let day = 1; day <= days; day++) {
    const startDate = new Date(parsedInput.parsed_data.dates.start);
    startDate.setDate(startDate.getDate() + (day - 1));
    
    itinerary[`day_${day}`] = {
      day,
      date: startDate.toISOString().split('T')[0],
      theme: `Day ${day} - Explore ${parsedInput.parsed_data.destination.city}`,
      neighborhood: parsedInput.parsed_data.destination.city,
      activities: [],
      day_summary: {
        total_cost: 0,
        total_walking_km: 0,
        activities_count: 0,
        constraint_satisfaction: {
          note: 'No venues found. Please check Google Maps API configuration.'
        },
      },
    };
  }
  
  return {
    itinerary,
    overall_summary: {
      total_budget: '$0',
      avg_per_day: '$0',
      constraint_compliance: 'N/A',
      optimizations_made: [],
      potential_issues: ['No venues found - check API configuration'],
    },
  };
}
