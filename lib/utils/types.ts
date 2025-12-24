export interface PlanInput {
  destination: string;
  dates: string;
  budget: string;
  travelers: string;
  constraints: string;
  interests: string;
  special_requests: string;
}

export interface ParsedInput {
  valid: boolean;
  parsed_data: {
    destination: {
      city: string;
      country: string;
    };
    dates: {
      start: string;
      end: string;
      duration_days: number;
    };
    travelers: {
      count: number;
      profiles: Array<{
        id: number;
        constraints: string[];
      }>;
    };
    budget: {
      amount_per_day: number;
      currency: string;
      flexibility: 'strict' | 'flexible';
    };
    constraints: {
      accessibility: string[];
      dietary: string[];
      pace: 'relaxed' | 'moderate' | 'packed';
      other: string[];
    };
    interests: string[];
    special_requests: string;
  };
  conflicts: string[];
  clarifications_needed: string[];
}

export interface Candidate {
  id: string;
  name: string;
  type: 'attraction' | 'restaurant' | 'cafe' | 'experience';
  location: {
    lat: number;
    lng: number;
    neighborhood: string;
  };
  reddit_data: {
    mentions: number;
    sentiment: number;
    sample_quotes: string[];
    sources: string[];
  };
  google_data: {
    rating: number;
    reviews_count: number;
    price_level: number;
    opening_hours?: any;
  };
  constraints_satisfied: {
    wheelchair_accessible: boolean;
    vegan_friendly: boolean;
    cost: number;
  };
  relevance_score: number;
  why_relevant: string;
}

export interface Activity {
  time: string;
  type: 'attraction' | 'meal' | 'travel' | 'rest';
  activity: {
    id: string;
    name: string;
    duration_minutes: number;
    cost: number;
    accessibility_notes?: string;
    vegan_details?: string;
    description?: string;
    reddit_quote?: string;
    upvotes?: number;
  };
  travel?: {
    from: string;
    mode: string;
    duration_minutes: number;
    cost: number;
  };
}

export interface DayItinerary {
  day: number;
  date: string;
  theme: string;
  neighborhood: string;
  activities: Activity[];
  day_summary: {
    total_cost: number;
    total_walking_km: number;
    activities_count: number;
    constraint_satisfaction: Record<string, string>;
  };
}

export interface Itinerary {
  itinerary: Record<string, DayItinerary>;
  overall_summary: {
    total_budget: string;
    avg_per_day: string;
    constraint_compliance: string;
    optimizations_made: string[];
    potential_issues: string[];
  };
}

export interface StreamUpdate {
  agent?: 'parser' | 'researcher' | 'optimizer' | 'storyteller';
  status: 'waiting' | 'running' | 'complete' | 'error';
  message?: string;
  data?: any;
  planId?: string;
}
