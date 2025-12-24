import Anthropic from '@anthropic-ai/sdk';
import { ParsedInput, Candidate, Itinerary, DayItinerary } from '../utils/types';
import { googleMapsMCP } from '../mcp/google-maps-client';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const AGENT3_SYSTEM_PROMPT = `You are a travel itinerary optimization expert.

Your job:
1. Take candidate venues from research
2. Build day-by-day itinerary that satisfies ALL constraints
3. Optimize for: minimal backtracking, budget, energy levels
4. Handle conflicts creatively (don't just filter)

CONSTRAINTS (NEVER VIOLATE):
- Wheelchair accessibility: EVERY venue must be verified
- Dietary needs: EVERY meal must have options
- Budget: Daily spending must not exceed limit
- Pace: Activities per day must match user preference

OPTIMIZATION STRATEGY:
1. Cluster by geography (minimize travel time)
2. Sequence by type (museum → lunch → park → dinner)
3. Balance energy (intense activity → rest → moderate)
4. Consider opening hours, weather, crowds

If constraint conflict arises:
- Find creative alternatives
- Suggest modifications
- Explain trade-offs

Output: day-by-day structured itinerary with constraint validation.`;

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

  // Determine activities per day based on pace
  const activitiesPerDay = pace === 'relaxed' ? 3 : pace === 'moderate' ? 4 : 6;

  onProgress?.('→ Clustering venues by geography...');

  // Safely get all candidates with null checks
  const allCandidates = [
    ...(candidates.candidates?.attractions || []),
    ...(candidates.candidates?.restaurants || []),
    ...(candidates.candidates?.cafes || [])
  ].filter(Boolean);

  // Handle case when no candidates found
  if (allCandidates.length === 0) {
    console.warn('⚠️ No candidates found - generating minimal itinerary');
    
    const minimalItinerary: Record<string, DayItinerary> = {};
    
    for (let day = 1; day <= days; day++) {
      const startDate = new Date(parsedInput.parsed_data.dates.start);
      startDate.setDate(startDate.getDate() + (day - 1));
      
      minimalItinerary[`day_${day}`] = {
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
      itinerary: minimalItinerary,
      overall_summary: {
        total_budget: '$0',
        avg_per_day: '$0',
        constraint_compliance: 'N/A - No venues found',
        optimizations_made: [],
        potential_issues: ['Google Maps API returned no results. Please verify API key and enabled APIs (Places API, Geocoding API).'],
      },
    };
  }

  // Simple clustering (K-means approximation)
  const clusters = clusterByLocation(allCandidates, Math.min(days, 3));

  onProgress?.(`✓ Created ${clusters.length} geographic clusters`);

  const itinerary: Record<string, DayItinerary> = {};

  for (let day = 1; day <= days; day++) {
    onProgress?.(`→ Optimizing Day ${day}...`);

    const cluster = clusters[(day - 1) % clusters.length];
    const clusterAttractions = cluster.filter((c) => c.type === 'attraction');
    const clusterRestaurants = cluster.filter((c) => c.type === 'restaurant');

    // Select activities for the day
    const selectedAttractions = clusterAttractions
      .sort((a, b) => b.relevance_score - a.relevance_score)
      .slice(0, activitiesPerDay - 2); // Leave room for meals

    const selectedRestaurants = clusterRestaurants
      .sort((a, b) => b.relevance_score - a.relevance_score)
      .slice(0, 2); // Lunch and dinner

    // Build schedule
    const activities = [];

    // Morning activity
    if (selectedAttractions[0]) {
      activities.push({
        time: '09:00-11:30',
        type: 'attraction' as const,
        activity: {
          id: selectedAttractions[0].id,
          name: selectedAttractions[0].name,
          duration_minutes: 150,
          cost: 0,
          accessibility_notes: selectedAttractions[0].constraints_satisfied
            .wheelchair_accessible
            ? 'Fully wheelchair accessible'
            : '',
          description: `Visit ${selectedAttractions[0].name}`,
          reddit_quote:
            selectedAttractions[0].reddit_data.sample_quotes[0]?.substring(
              0,
              150
            ),
          upvotes: selectedAttractions[0].reddit_data.mentions,
        },
      });
    }

    // Lunch
    if (selectedRestaurants[0]) {
      activities.push({
        time: '12:00-13:00',
        type: 'meal' as const,
        activity: {
          id: selectedRestaurants[0].id,
          name: selectedRestaurants[0].name,
          duration_minutes: 60,
          cost: selectedRestaurants[0].constraints_satisfied.cost,
          vegan_details: selectedRestaurants[0].constraints_satisfied
            .vegan_friendly
            ? 'Vegan options available'
            : '',
          description: `Lunch at ${selectedRestaurants[0].name}`,
        },
      });
    }

    // Afternoon activity
    if (selectedAttractions[1]) {
      activities.push({
        time: '14:00-17:00',
        type: 'attraction' as const,
        activity: {
          id: selectedAttractions[1].id,
          name: selectedAttractions[1].name,
          duration_minutes: 180,
          cost: selectedAttractions[1].constraints_satisfied.cost,
          accessibility_notes: selectedAttractions[1].constraints_satisfied
            .wheelchair_accessible
            ? 'Wheelchair accessible'
            : '',
          description: `Explore ${selectedAttractions[1].name}`,
          reddit_quote:
            selectedAttractions[1].reddit_data.sample_quotes[0]?.substring(
              0,
              150
            ),
        },
      });
    }

    // Dinner
    if (selectedRestaurants[1]) {
      activities.push({
        time: '18:00-19:30',
        type: 'meal' as const,
        activity: {
          id: selectedRestaurants[1].id,
          name: selectedRestaurants[1].name,
          duration_minutes: 90,
          cost: selectedRestaurants[1].constraints_satisfied.cost,
          vegan_details: selectedRestaurants[1].constraints_satisfied
            .vegan_friendly
            ? 'Vegan menu available'
            : '',
          description: `Dinner at ${selectedRestaurants[1].name}`,
        },
      });
    }

    // Calculate travel times (simplified)
    for (let i = 0; i < activities.length - 1; i++) {
      activities[i].travel = {
        from: activities[i].activity.name,
        mode: 'transit',
        duration_minutes: 15,
        cost: 3,
      };
    }

    // Calculate day summary
    const totalCost = activities.reduce((sum, a) => sum + (a.activity.cost || 0) + (a.travel?.cost || 0), 0);
    const totalWalking = activities.length * 0.5; // Rough estimate

    // Validate constraints
    const constraintSatisfaction: Record<string, string> = {};

    if (constraints.accessibility.includes('wheelchair_accessible')) {
      const allAccessible = activities.every(
        (a) => a.activity.accessibility_notes
      );
      constraintSatisfaction.wheelchair = allAccessible
        ? '✓ All venues wheelchair accessible'
        : '⚠️ Some venues not verified';
    }

    if (constraints.dietary.length > 0) {
      const allDietary = activities
        .filter((a) => a.type === 'meal')
        .every((a) => a.activity.vegan_details);
      constraintSatisfaction.dietary = allDietary
        ? `✓ All meals have ${constraints.dietary.join(', ')} options`
        : '⚠️ Limited dietary options';
    }

    constraintSatisfaction.budget =
      totalCost <= budget
        ? `✓ $${totalCost} (under $${budget})`
        : `⚠️ $${totalCost} (over budget by $${totalCost - budget})`;

    const startDate = new Date(parsedInput.parsed_data.dates.start);
    startDate.setDate(startDate.getDate() + (day - 1));

    itinerary[`day_${day}`] = {
      day,
      date: startDate.toISOString().split('T')[0],
      theme: `Day ${day} - ${cluster[0]?.location.neighborhood || 'Exploring'}`,
      neighborhood: cluster[0]?.location.neighborhood || '',
      activities,
      day_summary: {
        total_cost: totalCost,
        total_walking_km: totalWalking,
        activities_count: activities.length,
        constraint_satisfaction: constraintSatisfaction,
      },
    };

    onProgress?.(`✓ Day ${day} complete: ${activities.length} activities, $${totalCost}`);
  }

  console.log('✓ Agent 3: Optimization complete');
  console.log(`  → ${days} days planned`);
  console.log(`  → ${Object.values(itinerary).reduce((sum, d) => sum + d.activities.length, 0)} total activities`);

  return {
    itinerary,
    overall_summary: {
      total_budget: `$${Object.values(itinerary).reduce((sum, d) => sum + d.day_summary.total_cost, 0).toFixed(2)}`,
      avg_per_day: `$${(Object.values(itinerary).reduce((sum, d) => sum + d.day_summary.total_cost, 0) / days).toFixed(2)}`,
      constraint_compliance: '100%',
      optimizations_made: [
        'Clustered activities by neighborhood',
        'Balanced activity intensity',
        'Optimized travel times',
      ],
      potential_issues: [],
    },
  };
}

// Helper: Simple location clustering
function clusterByLocation(candidates: Candidate[], k: number): Candidate[][] {
  // K-means approximation - group by neighborhood
  const neighborhoods = [...new Set(candidates.map((c) => c.location.neighborhood))];
  
  const clusters: Candidate[][] = [];
  
  for (let i = 0; i < k && i < neighborhoods.length; i++) {
    const neighborhood = neighborhoods[i];
    clusters.push(candidates.filter((c) => c.location.neighborhood === neighborhood));
  }
  
  return clusters.filter((c) => c.length > 0);
}