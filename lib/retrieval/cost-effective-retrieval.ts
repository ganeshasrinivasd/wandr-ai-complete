/**
 * Cost-Effective Iconic Place Retrieval Pipeline
 *
 * DESIGN PRINCIPLES:
 * 1. Google Text Search as primary recall driver (cheap, high recall)
 * 2. Bounded multi-center Nearby Search for coverage
 * 3. LLM fallback ONLY when recall is weak (adaptive)
 * 4. Place Details ONLY for winners (final itinerary + backups)
 * 5. Aggressive caching to approach zero cost for popular destinations
 *
 * TARGET COST: <= $0.05/query typical, near-zero for cached destinations
 *
 * ARCHITECTURE:
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │                     COST-EFFECTIVE RETRIEVAL                           │
 * ├─────────────────────────────────────────────────────────────────────────┤
 * │  1. CACHE CHECK → Hit? Return cached candidates                        │
 * │  2. TEXT SEARCH (8-10 queries) → Primary recall                        │
 * │  3. MULTI-CENTER NEARBY (3-5 centers × 4-6 types) → Coverage           │
 * │  4. RECALL HEALTH CHECK → Is pool sufficient?                          │
 * │  5. [CONDITIONAL] LLM FALLBACK → Generate anchor hints → Text Search   │
 * │  6. DEDUPE & SCORE → Rank candidates                                   │
 * │  7. CACHE WRITE → Store for future queries                             │
 * │  8. [LATER] WINNER DETAILS → Only for final itinerary                  │
 * └─────────────────────────────────────────────────────────────────────────┘
 */

// =============================================================================
// TYPES & INTERFACES
// =============================================================================

export interface RetrievalConfig {
  destination: string;
  country: string;
  language?: string;
  interests: string[];
  tripDuration: number;
  pace: 'relaxed' | 'moderate' | 'packed';
  seasonBucket?: string; // 'summer' | 'winter' | 'shoulder'
}

export interface RetrievalCandidate {
  placeId: string;
  name: string;
  location: { lat: number; lng: number };
  types: string[];
  rating: number;
  reviewCount: number;
  priceLevel?: number;
  photoReference?: string;
  vicinity?: string;

  // Scoring metadata
  retrievalSource: 'text_search' | 'nearby_search' | 'llm_hint';
  queryHit: string;          // Which query found this
  textSearchRank?: number;   // Position in results (1-20)
  consensusCount: number;    // How many queries found this

  // Computed scores
  iconicScore: number;
  anchorCandidate: boolean;
}

export interface RetrievalResult {
  candidates: RetrievalCandidate[];
  anchors: RetrievalCandidate[];
  metadata: {
    cacheHit: boolean;
    textSearchQueries: number;
    nearbySearchCalls: number;
    llmFallbackUsed: boolean;
    totalCandidatesRaw: number;
    totalCandidatesDeduped: number;
    recallHealthScore: number;
    estimatedCost: number;
    processingTimeMs: number;
  };
}

export interface RecallHealthResult {
  isHealthy: boolean;
  score: number;              // 0-1
  reasons: string[];
  metrics: {
    highIconicCount: number;  // Candidates with iconicScore > 0.5
    anchorCount: number;      // Strong anchor candidates
    categoryBalance: number;  // 0-1, how balanced categories are
    restaurantRatio: number;  // % of candidates that are restaurants
    coverageScore: number;    // 0-1, geographic spread
  };
  requiredAnchors: number;    // Based on trip duration/pace
}

// =============================================================================
// A) BUDGET MANAGER
// =============================================================================

interface BudgetLimits {
  textSearch: number;
  nearbySearch: number;
  findPlace: number;
  placeDetails: number;
  llmCalls: number;
}

interface BudgetCosts {
  textSearch: number;      // ~$0.003 per call (basic fields)
  nearbySearch: number;    // ~$0.003 per call (basic fields)
  findPlace: number;       // ~$0.002 per call
  placeDetails: number;    // ~$0.017 per call
  llmCall: number;         // ~$0.008 per call (gpt-4o-mini)
}

const DEFAULT_COSTS: BudgetCosts = {
  textSearch: 0.003,
  nearbySearch: 0.003,
  findPlace: 0.002,
  placeDetails: 0.017,
  llmCall: 0.008,
};

const DEFAULT_LIMITS: BudgetLimits = {
  textSearch: 12,
  nearbySearch: 20,      // 5 centers × 4 types
  findPlace: 5,          // Only for critical resolutions
  placeDetails: 15,      // Winners only
  llmCalls: 1,
};

export class BudgetManager {
  private counts: Record<keyof BudgetLimits, number> = {
    textSearch: 0,
    nearbySearch: 0,
    findPlace: 0,
    placeDetails: 0,
    llmCalls: 0,
  };

  private limits: BudgetLimits;
  private costs: BudgetCosts;
  private hardBudget: number;

  constructor(
    hardBudget: number = 0.05,
    limits: Partial<BudgetLimits> = {},
    costs: Partial<BudgetCosts> = {}
  ) {
    this.hardBudget = hardBudget;
    this.limits = { ...DEFAULT_LIMITS, ...limits };
    this.costs = { ...DEFAULT_COSTS, ...costs };
  }

  canCall(type: keyof BudgetLimits, count: number = 1): boolean {
    // Check individual limit
    if (this.counts[type] + count > this.limits[type]) {
      return false;
    }
    // Check total budget - map llmCalls to llmCall for cost lookup
    const costKey = type === 'llmCalls' ? 'llmCall' : type;
    const projectedCost = this.getCurrentCost() + ((this.costs as any)[costKey] || 0.01) * count;
    return projectedCost <= this.hardBudget;
  }

  recordCall(type: keyof BudgetLimits, count: number = 1): void {
    this.counts[type] += count;
  }

  getCurrentCost(): number {
    return (
      this.counts.textSearch * this.costs.textSearch +
      this.counts.nearbySearch * this.costs.nearbySearch +
      this.counts.findPlace * this.costs.findPlace +
      this.counts.placeDetails * this.costs.placeDetails +
      this.counts.llmCalls * (this.costs as any).llmCall
    );
  }

  getRemainingBudget(): number {
    return Math.max(0, this.hardBudget - this.getCurrentCost());
  }

  getStats(): Record<string, number> {
    return {
      ...this.counts,
      currentCost: this.getCurrentCost(),
      remainingBudget: this.getRemainingBudget(),
    };
  }

  // Graceful degradation helpers
  shouldSkipLLMFallback(): boolean {
    return !this.canCall('llmCalls') || this.getRemainingBudget() < 0.015;
  }

  getMaxNearbycenters(): number {
    const remaining = this.limits.nearbySearch - this.counts.nearbySearch;
    return Math.min(5, Math.floor(remaining / 4)); // 4 types per center
  }

  getMaxTextSearchQueries(): number {
    return this.limits.textSearch - this.counts.textSearch;
  }
}

// =============================================================================
// B) CACHING LAYER
// =============================================================================

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttlMs: number;
  accessCount: number;
  lastAccessed: number;
}

interface DestinationCacheKey {
  city: string;
  country: string;
  language: string;
  seasonBucket: string;
}

interface DestinationCacheValue {
  candidates: RetrievalCandidate[];
  anchors: RetrievalCandidate[];
  searchCenters: { lat: number; lng: number; name: string }[];
  generatedAt: string;
}

interface PlaceDetailsCacheValue {
  placeId: string;
  name: string;
  formattedAddress: string;
  openingHours?: {
    weekdayText: string[];
    periods?: Array<{
      open: { day: number; time: string };
      close?: { day: number; time: string };
    }>;
    specialHours?: Array<{
      date: string;
      open?: string;
      close?: string;
      isClosed: boolean;
    }>;
  };
  phoneNumber?: string;
  website?: string;
  photos?: string[];
  priceLevel?: number;
  wheelchair?: boolean;
  fetchedAt: string;
}

// In-memory cache (replace with Redis/Upstash in production)
const destinationCache = new Map<string, CacheEntry<DestinationCacheValue>>();
const placeDetailsCache = new Map<string, CacheEntry<PlaceDetailsCacheValue>>();

const DESTINATION_TTL_MS = 14 * 24 * 60 * 60 * 1000;  // 14 days
const PLACE_DETAILS_TTL_MS = 90 * 24 * 60 * 60 * 1000; // 90 days
const STALE_THRESHOLD_MS = 7 * 24 * 60 * 60 * 1000;   // 7 days for lazy refresh

function buildDestinationCacheKey(config: RetrievalConfig): string {
  const season = config.seasonBucket || getSeasonBucket(new Date());
  return `dest:${config.destination.toLowerCase()}:${config.country.toLowerCase()}:${config.language || 'en'}:${season}`;
}

function getSeasonBucket(date: Date): string {
  const month = date.getMonth();
  if (month >= 5 && month <= 8) return 'summer';
  if (month >= 11 || month <= 1) return 'winter';
  return 'shoulder';
}

export function cacheGetDestination(config: RetrievalConfig): DestinationCacheValue | null {
  const key = buildDestinationCacheKey(config);
  const entry = destinationCache.get(key);

  if (!entry) return null;

  const now = Date.now();
  const age = now - entry.timestamp;

  // Expired
  if (age > entry.ttlMs) {
    destinationCache.delete(key);
    return null;
  }

  // Update access stats
  entry.accessCount++;
  entry.lastAccessed = now;

  return entry.data;
}

export function cacheSetDestination(
  config: RetrievalConfig,
  value: DestinationCacheValue,
  ttlMs: number = DESTINATION_TTL_MS
): void {
  const key = buildDestinationCacheKey(config);
  destinationCache.set(key, {
    data: value,
    timestamp: Date.now(),
    ttlMs,
    accessCount: 1,
    lastAccessed: Date.now(),
  });
}

export function cacheGetPlaceDetails(placeId: string): PlaceDetailsCacheValue | null {
  const entry = placeDetailsCache.get(placeId);

  if (!entry) return null;

  const now = Date.now();
  const age = now - entry.timestamp;

  // Expired
  if (age > entry.ttlMs) {
    placeDetailsCache.delete(placeId);
    return null;
  }

  entry.accessCount++;
  entry.lastAccessed = now;

  // Flag for lazy refresh if stale
  const isStale = age > STALE_THRESHOLD_MS;

  return entry.data;
}

export function cacheSetPlaceDetails(
  placeId: string,
  value: PlaceDetailsCacheValue,
  ttlMs: number = PLACE_DETAILS_TTL_MS
): void {
  placeDetailsCache.set(placeId, {
    data: value,
    timestamp: Date.now(),
    ttlMs,
    accessCount: 1,
    lastAccessed: Date.now(),
  });
}

export function shouldRefreshPlaceDetails(placeId: string): boolean {
  const entry = placeDetailsCache.get(placeId);
  if (!entry) return true;
  return Date.now() - entry.timestamp > STALE_THRESHOLD_MS;
}

// =============================================================================
// C) TEXT SEARCH TEMPLATES (PRIMARY RECALL)
// =============================================================================

/**
 * Category-balanced text search templates
 * Designed to maximize iconic recall across different place types
 */
const TEXT_SEARCH_TEMPLATES: { template: string; category: string; priority: number }[] = [
  // HIGH PRIORITY - Core iconic queries
  { template: 'famous landmarks {dest}', category: 'landmark', priority: 1 },
  { template: 'must see attractions {dest}', category: 'attraction', priority: 1 },
  { template: 'top things to do {dest}', category: 'attraction', priority: 1 },
  { template: 'best restaurants {dest}', category: 'restaurant', priority: 1 }, // ADD: High priority restaurants

  // MEDIUM PRIORITY - Category-specific
  { template: 'best museums {dest}', category: 'museum', priority: 2 },
  { template: 'historic sites {dest}', category: 'historic', priority: 2 },
  { template: 'famous temples shrines {dest}', category: 'religious', priority: 2 },
  { template: 'best parks gardens {dest}', category: 'nature', priority: 2 },
  { template: 'best viewpoints {dest}', category: 'viewpoint', priority: 2 },
  { template: 'top rated restaurants {dest}', category: 'restaurant', priority: 2 }, // ADD: More restaurants
  { template: 'local food places {dest}', category: 'restaurant', priority: 2 }, // ADD: Local food

  // LOWER PRIORITY - Coverage expansion
  { template: 'famous markets {dest}', category: 'market', priority: 3 },
  { template: 'old town historic center {dest}', category: 'neighborhood', priority: 3 },
  { template: 'best neighborhoods {dest}', category: 'neighborhood', priority: 3 },
  { template: 'hidden gems {dest}', category: 'hidden', priority: 3 },
  { template: 'street food {dest}', category: 'restaurant', priority: 3 }, // ADD: Street food
];

/**
 * Interest-based query boosters
 */
const INTEREST_QUERY_MAP: Record<string, string[]> = {
  'food': [
    'best restaurants {dest}', 
    'famous food markets {dest}', 
    'local cuisine {dest}',
    'top rated restaurants {dest}',        // ADD: More restaurant queries
    'popular local restaurants {dest}',    // ADD: Local focus
    'where to eat {dest}',                 // ADD: Natural language
    'famous food places {dest}'            // ADD: Food places
  ],
  'culture': ['cultural attractions {dest}', 'art galleries {dest}'],
  'history': ['ancient monuments {dest}', 'historical landmarks {dest}'],
  'nature': ['nature attractions {dest}', 'scenic spots {dest}', 'beaches {dest}'],
  'art': ['art museums {dest}', 'street art {dest}'],
  'nightlife': ['nightlife {dest}', 'best bars {dest}'],
  'shopping': ['shopping districts {dest}'],
  'architecture': ['famous architecture {dest}', 'iconic buildings {dest}'],
  'adventure': ['adventure activities {dest}', 'outdoor activities {dest}'],
  'relaxation': ['spas {dest}', 'peaceful places {dest}'],
};

/**
 * Build optimized query list based on interests and budget
 */
function buildTextSearchQueries(
  destination: string,
  interests: string[],
  maxQueries: number
): string[] {
  const queries: string[] = [];
  const usedCategories = new Set<string>();

  // Sort templates by priority
  const sortedTemplates = [...TEXT_SEARCH_TEMPLATES].sort((a, b) => a.priority - b.priority);

  // Add high-priority templates first
  for (const { template, category } of sortedTemplates) {
    if (queries.length >= maxQueries - interests.length) break;
    if (usedCategories.has(category) && category !== 'attraction') continue;

    queries.push(template.replace('{dest}', destination));
    usedCategories.add(category);
  }

  // Add interest-specific queries
  for (const interest of interests.slice(0, 3)) {
    if (queries.length >= maxQueries) break;

    const interestQueries = INTEREST_QUERY_MAP[interest.toLowerCase()];
    if (interestQueries && interestQueries.length > 0) {
      queries.push(interestQueries[0].replace('{dest}', destination));
    }
  }

  return queries.slice(0, maxQueries);
}

// =============================================================================
// D) MULTI-CENTER NEARBY SEARCH
// =============================================================================

/**
 * Nearby search types prioritized by iconic potential
 */
const NEARBY_TYPE_PRIORITIES: { type: string; iconicWeight: number }[] = [
  { type: 'tourist_attraction', iconicWeight: 1.0 },
  { type: 'museum', iconicWeight: 0.9 },
  { type: 'park', iconicWeight: 0.7 },
  { type: 'church', iconicWeight: 0.7 },
  { type: 'hindu_temple', iconicWeight: 0.8 },
  { type: 'mosque', iconicWeight: 0.7 },
  { type: 'art_gallery', iconicWeight: 0.6 },
  { type: 'zoo', iconicWeight: 0.6 },
  { type: 'aquarium', iconicWeight: 0.6 },
  { type: 'amusement_park', iconicWeight: 0.7 },
  { type: 'stadium', iconicWeight: 0.5 },
  { type: 'market', iconicWeight: 0.5 },
];

/**
 * Select nearby types based on interests and remaining budget
 */
function selectNearbyTypes(interests: string[], maxTypes: number): string[] {
  const selected: string[] = [];
  const interestTypes = new Set<string>();

  // Map interests to types
  for (const interest of interests) {
    switch (interest.toLowerCase()) {
      case 'culture':
      case 'history':
        interestTypes.add('museum');
        interestTypes.add('church');
        break;
      case 'nature':
        interestTypes.add('park');
        interestTypes.add('zoo');
        break;
      case 'art':
        interestTypes.add('art_gallery');
        interestTypes.add('museum');
        break;
      case 'adventure':
        interestTypes.add('amusement_park');
        interestTypes.add('stadium');
        break;
    }
  }

  // Always include tourist_attraction
  selected.push('tourist_attraction');

  // Add interest-matched types
  for (const type of Array.from(interestTypes)) {
    if (selected.length >= maxTypes) break;
    if (!selected.includes(type)) selected.push(type);
  }

  // Fill remaining with high-priority types
  for (const { type } of NEARBY_TYPE_PRIORITIES) {
    if (selected.length >= maxTypes) break;
    if (!selected.includes(type)) selected.push(type);
  }

  return selected.slice(0, maxTypes);
}

/**
 * Identify search centers from initial text search results
 * Uses k-means-like clustering with a fixed small k
 */
export function buildMultiCenterPlan(
  initialCandidates: RetrievalCandidate[],
  cityCenter: { lat: number; lng: number },
  maxCenters: number = 5
): { lat: number; lng: number; name: string; isCity: boolean }[] {
  const centers: { lat: number; lng: number; name: string; isCity: boolean }[] = [];

  // Always include city center
  centers.push({
    ...cityCenter,
    name: 'City Center',
    isCity: true,
  });

  if (initialCandidates.length < 5 || maxCenters <= 1) {
    return centers;
  }

  // Filter to high-iconic candidates for center selection
  const highIconic = initialCandidates
    .filter(c => c.iconicScore > 0.4)
    .sort((a, b) => b.iconicScore - a.iconicScore);

  if (highIconic.length < 3) {
    return centers;
  }

  // Simple clustering: find candidates far from existing centers
  const MIN_DISTANCE_KM = 2.0; // Minimum 2km between centers

  for (const candidate of highIconic) {
    if (centers.length >= maxCenters) break;

    // Check distance from all existing centers
    const tooClose = centers.some(center =>
      haversineDistance(
        center.lat, center.lng,
        candidate.location.lat, candidate.location.lng
      ) < MIN_DISTANCE_KM
    );

    if (!tooClose) {
      centers.push({
        lat: candidate.location.lat,
        lng: candidate.location.lng,
        name: candidate.name,
        isCity: false,
      });
    }
  }

  return centers;
}

// =============================================================================
// E) RECALL HEALTH CHECK
// =============================================================================

/**
 * Compute iconic score for a candidate
 * Based on review count + rating + type
 */
function computeIconicScore(candidate: Partial<RetrievalCandidate>): number {
  const reviewCount = candidate.reviewCount || 0;
  const rating = candidate.rating || 0;
  const types = candidate.types || [];

  // Review score (logarithmic, capped)
  // log10(1000) = 3, log10(100000) = 5
  const reviewScore = Math.min(1, Math.max(0, (Math.log10(reviewCount + 1) - 2) / 3));

  // Rating score (normalized)
  const ratingScore = Math.max(0, (rating - 3.5) / 1.5);

  // Type weight
  const typeWeights: Record<string, number> = {
    'tourist_attraction': 1.0,
    'landmark': 1.0,
    'museum': 0.9,
    'point_of_interest': 0.8,
    'church': 0.7,
    'hindu_temple': 0.8,
    'park': 0.6,
    'art_gallery': 0.7,
    'zoo': 0.6,
    'restaurant': 0.3,
    'cafe': 0.2,
    'shopping_mall': 0.3,
  };

  let typeScore = 0.4; // Default
  for (const type of types) {
    if (typeWeights[type] !== undefined) {
      typeScore = Math.max(typeScore, typeWeights[type]);
    }
  }

  // Consensus bonus (applied externally)
  const consensusBonus = Math.min(0.2, (candidate.consensusCount || 1) * 0.05);

  return Math.min(1, reviewScore * 0.45 + ratingScore * 0.25 + typeScore * 0.2 + consensusBonus);
}

/**
 * Check if recall is healthy enough to skip LLM fallback
 */
export function recallHealthCheck(
  candidates: RetrievalCandidate[],
  config: RetrievalConfig
): RecallHealthResult {
  const reasons: string[] = [];

  // Calculate required anchors based on trip
  const anchorsPerDay = config.pace === 'relaxed' ? 1 : config.pace === 'packed' ? 2 : 1.5;
  const requiredAnchors = Math.ceil(config.tripDuration * anchorsPerDay);

  // Metric 1: High iconic count
  const highIconicCount = candidates.filter(c => c.iconicScore > 0.5).length;
  const anchorCount = candidates.filter(c => c.anchorCandidate).length;

  // Metric 2: Category balance
  const categories = {
    landmark: 0,
    museum: 0,
    nature: 0,
    religious: 0,
    experience: 0,
    food: 0,
    other: 0,
  };

  for (const c of candidates) {
    if (c.types.some(t => ['tourist_attraction', 'landmark', 'point_of_interest'].includes(t))) {
      categories.landmark++;
    } else if (c.types.some(t => ['museum', 'art_gallery'].includes(t))) {
      categories.museum++;
    } else if (c.types.some(t => ['park', 'zoo', 'aquarium', 'natural_feature'].includes(t))) {
      categories.nature++;
    } else if (c.types.some(t => ['church', 'hindu_temple', 'mosque', 'synagogue'].includes(t))) {
      categories.religious++;
    } else if (c.types.some(t => ['restaurant', 'cafe', 'bakery', 'food'].includes(t))) {
      categories.food++;
    } else if (c.types.some(t => ['amusement_park', 'stadium', 'market'].includes(t))) {
      categories.experience++;
    } else {
      categories.other++;
    }
  }

  // Calculate category balance (Shannon entropy normalized)
  const total = candidates.length || 1;
  const nonFoodTotal = total - categories.food;
  const categoryValues = [
    categories.landmark,
    categories.museum,
    categories.nature,
    categories.religious,
    categories.experience,
  ];

  let entropy = 0;
  for (const count of categoryValues) {
    if (count > 0) {
      const p = count / (nonFoodTotal || 1);
      entropy -= p * Math.log2(p);
    }
  }
  const maxEntropy = Math.log2(categoryValues.length);
  const categoryBalance = maxEntropy > 0 ? entropy / maxEntropy : 0;

  // Metric 3: Restaurant over-dominance
  const restaurantRatio = categories.food / total;

  // Metric 4: Geographic coverage (simplified)
  const lats = candidates.map(c => c.location.lat);
  const lngs = candidates.map(c => c.location.lng);
  const latSpread = Math.max(...lats) - Math.min(...lats);
  const lngSpread = Math.max(...lngs) - Math.min(...lngs);
  const coverageScore = Math.min(1, (latSpread + lngSpread) * 10); // Rough km estimate

  // Evaluate health
  let isHealthy = true;
  let score = 0;

  // Check 1: Enough anchors?
  if (anchorCount < requiredAnchors) {
    isHealthy = false;
    reasons.push(`Insufficient anchors: ${anchorCount}/${requiredAnchors} required`);
  }
  score += Math.min(1, anchorCount / requiredAnchors) * 0.4;

  // Check 2: Category balance
  if (categoryBalance < 0.4) {
    reasons.push(`Poor category balance: ${categoryBalance.toFixed(2)}`);
    if (categoryBalance < 0.25) isHealthy = false;
  }
  score += categoryBalance * 0.25;

  // Check 3: Restaurant dominance
  if (restaurantRatio > 0.4) {
    reasons.push(`Restaurant over-dominance: ${(restaurantRatio * 100).toFixed(0)}%`);
    if (restaurantRatio > 0.5) isHealthy = false;
  }
  score += (1 - restaurantRatio) * 0.2;

  // Check 4: High iconic places
  if (highIconicCount < 5) {
    reasons.push(`Low iconic count: ${highIconicCount}`);
    if (highIconicCount < 3) isHealthy = false;
  }
  score += Math.min(1, highIconicCount / 10) * 0.15;

  return {
    isHealthy,
    score,
    reasons,
    metrics: {
      highIconicCount,
      anchorCount,
      categoryBalance,
      restaurantRatio,
      coverageScore,
    },
    requiredAnchors,
  };
}

// =============================================================================
// F) ADAPTIVE LLM FALLBACK
// =============================================================================

const LLM_ANCHOR_HINT_PROMPT = `You are a travel expert. The current retrieval for {destination}, {country} is missing iconic places.

Current issues:
{issues}

Generate 10-15 iconic anchor hints that are likely missing. Focus on:
- World-famous landmarks and monuments
- Must-see cultural sites (museums, temples, palaces)
- Iconic natural attractions (parks, viewpoints, gardens)
- Famous neighborhoods or districts
- Unique local experiences

User interests: {interests}

Output format (one per line):
NAME | CATEGORY | WHY_FAMOUS

Categories: landmark, museum, nature, religious, neighborhood, experience

Only include genuinely iconic places that any visitor should know about.`;

interface AnchorHint {
  name: string;
  category: string;
  whyFamous: string;
}

/**
 * Call LLM to generate anchor hints when recall is weak
 * Returns structured hints that become text search queries
 */
export async function llmAnchorFallback(
  destination: string,
  country: string,
  interests: string[],
  healthResult: RecallHealthResult,
  openaiApiKey: string
): Promise<{ hints: AnchorHint[]; queries: string[] }> {
  const prompt = LLM_ANCHOR_HINT_PROMPT
    .replace('{destination}', destination)
    .replace('{country}', country)
    .replace('{issues}', healthResult.reasons.join('\n'))
    .replace('{interests}', interests.join(', '));

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiApiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are a travel expert who knows iconic places worldwide.' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.3,
        max_tokens: 800,
      }),
    });

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';

    // Parse hints
    const hints: AnchorHint[] = [];
    const lines = content.split('\n').filter((l: string) => l.includes('|'));

    for (const line of lines.slice(0, 15)) {
      const parts = line.split('|').map((p: string) => p.trim());
      if (parts.length >= 2) {
        hints.push({
          name: parts[0].replace(/^[-*]\s*/, ''),
          category: parts[1] || 'landmark',
          whyFamous: parts[2] || '',
        });
      }
    }

    // Convert hints to batched text search queries
    // Group by category for efficiency
    const byCategory: Record<string, string[]> = {};
    for (const hint of hints) {
      if (!byCategory[hint.category]) byCategory[hint.category] = [];
      byCategory[hint.category].push(hint.name);
    }

    const queries: string[] = [];
    for (const [category, names] of Object.entries(byCategory)) {
      // Batch 2-3 names per query
      for (let i = 0; i < names.length; i += 2) {
        const batch = names.slice(i, i + 2).join(' ');
        queries.push(`${batch} ${destination}`);
      }
    }

    return { hints, queries: queries.slice(0, 8) };

  } catch (error) {
    console.error('LLM fallback failed:', error);
    return { hints: [], queries: [] };
  }
}

// =============================================================================
// G) MAIN RETRIEVAL PIPELINE
// =============================================================================

/**
 * Main retrieval function
 * Implements the full cost-effective pipeline
 */
export async function retrieveCandidates(
  config: RetrievalConfig,
  googleApiKey: string,
  openaiApiKey: string,
  onProgress?: (message: string) => void
): Promise<RetrievalResult> {
  const startTime = Date.now();
  const budget = new BudgetManager(0.05);

  // Track all candidates with deduplication
  const candidateMap = new Map<string, RetrievalCandidate>();
  const queryHits = new Map<string, Set<string>>(); // placeId -> queries that found it

  // =========================================================================
  // STEP 1: CHECK CACHE
  // =========================================================================
  onProgress?.('📦 Checking cache...');

  const cached = cacheGetDestination(config);
  if (cached) {
    onProgress?.('✓ Cache hit! Using cached candidates');
    return {
      candidates: cached.candidates,
      anchors: cached.anchors,
      metadata: {
        cacheHit: true,
        textSearchQueries: 0,
        nearbySearchCalls: 0,
        llmFallbackUsed: false,
        totalCandidatesRaw: cached.candidates.length,
        totalCandidatesDeduped: cached.candidates.length,
        recallHealthScore: 1,
        estimatedCost: 0,
        processingTimeMs: Date.now() - startTime,
      },
    };
  }

  // =========================================================================
  // STEP 2: GET CITY CENTER
  // =========================================================================
  onProgress?.('📍 Getting city coordinates...');

  const cityCenter = await getCityCenter(config.destination, config.country, googleApiKey);

  // =========================================================================
  // STEP 3: TEXT SEARCH (PRIMARY RECALL)
  // =========================================================================
  onProgress?.('🔍 Running text searches...');

  const maxTextQueries = budget.getMaxTextSearchQueries();
  const textQueries = buildTextSearchQueries(config.destination, config.interests, maxTextQueries);

  for (const query of textQueries) {
    if (!budget.canCall('textSearch')) break;

    try {
      const results = await googleTextSearch(query, cityCenter, googleApiKey);
      budget.recordCall('textSearch');

      for (let i = 0; i < results.length; i++) {
        const place = results[i];
        const placeId = place.place_id;

        // Track query hits for consensus
        if (!queryHits.has(placeId)) queryHits.set(placeId, new Set());
        queryHits.get(placeId)!.add(query);

        // Add or update candidate
        if (!candidateMap.has(placeId)) {
          candidateMap.set(placeId, {
            placeId,
            name: place.name,
            location: {
              lat: place.geometry?.location?.lat || 0,
              lng: place.geometry?.location?.lng || 0,
            },
            types: place.types || [],
            rating: place.rating || 0,
            reviewCount: place.user_ratings_total || 0,
            priceLevel: place.price_level,
            photoReference: place.photos?.[0]?.photo_reference,
            vicinity: place.formatted_address || place.vicinity,
            retrievalSource: 'text_search',
            queryHit: query,
            textSearchRank: i + 1,
            consensusCount: 1,
            iconicScore: 0,
            anchorCandidate: false,
          });
        } else {
          // Update consensus
          candidateMap.get(placeId)!.consensusCount++;
        }
      }
    } catch (error) {
      console.error(`Text search failed for "${query}":`, error);
    }
  }

  onProgress?.(`✓ Text search: ${candidateMap.size} candidates from ${budget.getStats().textSearch} queries`);

  // =========================================================================
  // STEP 4: MULTI-CENTER NEARBY SEARCH
  // =========================================================================
  onProgress?.('📍 Running multi-center nearby searches...');

  // Compute initial scores
  for (const candidate of Array.from(candidateMap.values())) {
    candidate.iconicScore = computeIconicScore(candidate);
    candidate.anchorCandidate = candidate.iconicScore > 0.5 && candidate.reviewCount > 500;
  }

  const initialCandidates = Array.from(candidateMap.values());
  const maxCenters = budget.getMaxNearbycenters();
  const searchCenters = buildMultiCenterPlan(initialCandidates, cityCenter, maxCenters);
  const nearbyTypes = selectNearbyTypes(config.interests, 4);

  for (const center of searchCenters) {
    for (const type of nearbyTypes) {
      if (!budget.canCall('nearbySearch')) break;

      try {
        const results = await googleNearbySearch(
          center.lat,
          center.lng,
          3000, // 3km radius
          type,
          googleApiKey
        );
        budget.recordCall('nearbySearch');

        for (const place of results.slice(0, 8)) {
          const placeId = place.place_id;

          if (!candidateMap.has(placeId)) {
            candidateMap.set(placeId, {
              placeId,
              name: place.name,
              location: {
                lat: place.geometry?.location?.lat || 0,
                lng: place.geometry?.location?.lng || 0,
              },
              types: place.types || [],
              rating: place.rating || 0,
              reviewCount: place.user_ratings_total || 0,
              priceLevel: place.price_level,
              photoReference: place.photos?.[0]?.photo_reference,
              vicinity: place.vicinity,
              retrievalSource: 'nearby_search',
              queryHit: `nearby:${center.name}:${type}`,
              consensusCount: 1,
              iconicScore: 0,
              anchorCandidate: false,
            });
          }
        }
      } catch (error) {
        console.error(`Nearby search failed at ${center.name}:`, error);
      }
    }
  }

  onProgress?.(`✓ Nearby search: ${candidateMap.size} total candidates`);

  // =========================================================================
  // STEP 5: RECALL HEALTH CHECK
  // =========================================================================
  onProgress?.('🏥 Checking recall health...');

  // Recompute scores with consensus
  for (const candidate of Array.from(candidateMap.values())) {
    const hits = queryHits.get(candidate.placeId)?.size || 1;
    candidate.consensusCount = hits;
    candidate.iconicScore = computeIconicScore(candidate);
    candidate.anchorCandidate = candidate.iconicScore > 0.5 &&
      (candidate.reviewCount > 500 || hits >= 2);
  }

  const candidates = Array.from(candidateMap.values());
  const healthResult = recallHealthCheck(candidates, config);

  onProgress?.(`   Health score: ${healthResult.score.toFixed(2)} (${healthResult.isHealthy ? 'HEALTHY' : 'NEEDS BOOST'})`);

  // =========================================================================
  // STEP 6: ADAPTIVE LLM FALLBACK (if needed)
  // =========================================================================
  let llmUsed = false;

  if (!healthResult.isHealthy && !budget.shouldSkipLLMFallback()) {
    onProgress?.('🤖 Running LLM fallback for anchor hints...');

    const { hints, queries } = await llmAnchorFallback(
      config.destination,
      config.country,
      config.interests,
      healthResult,
      openaiApiKey
    );
    budget.recordCall('llmCalls');
    llmUsed = true;

    // Run additional text searches from LLM hints
    for (const query of queries) {
      if (!budget.canCall('textSearch')) break;

      try {
        const results = await googleTextSearch(query, cityCenter, googleApiKey);
        budget.recordCall('textSearch');

        for (let i = 0; i < results.length; i++) {
          const place = results[i];
          const placeId = place.place_id;

          if (!candidateMap.has(placeId)) {
            candidateMap.set(placeId, {
              placeId,
              name: place.name,
              location: {
                lat: place.geometry?.location?.lat || 0,
                lng: place.geometry?.location?.lng || 0,
              },
              types: place.types || [],
              rating: place.rating || 0,
              reviewCount: place.user_ratings_total || 0,
              priceLevel: place.price_level,
              photoReference: place.photos?.[0]?.photo_reference,
              vicinity: place.formatted_address || place.vicinity,
              retrievalSource: 'llm_hint',
              queryHit: query,
              textSearchRank: i + 1,
              consensusCount: 1,
              iconicScore: 0,
              anchorCandidate: false,
            });
          }
        }
      } catch (error) {
        console.error(`LLM hint search failed for "${query}":`, error);
      }
    }

    onProgress?.(`✓ LLM fallback added ${hints.length} hints, ${candidateMap.size} total candidates`);
  }

  // =========================================================================
  // STEP 7: FINAL SCORING & RANKING
  // =========================================================================
  onProgress?.('📊 Final scoring and ranking...');

  let finalCandidates = Array.from(candidateMap.values());

  // Near-duplicate detection pass (catches duplicates with different placeIds)
  const beforeNearDedupe = finalCandidates.length;
  finalCandidates = removeNearDuplicates(finalCandidates);
  const nearDupsRemoved = beforeNearDedupe - finalCandidates.length;
  if (nearDupsRemoved > 0) {
    console.log(`  Near-duplicates removed: ${nearDupsRemoved}`);
  }

  // Recompute final scores
  for (const candidate of finalCandidates) {
    candidate.iconicScore = computeIconicScore(candidate);
    candidate.anchorCandidate = candidate.iconicScore > 0.5 &&
      (candidate.reviewCount > 500 || candidate.consensusCount >= 2);
  }

  // Sort by iconic score
  finalCandidates.sort((a, b) => b.iconicScore - a.iconicScore);

  // Apply quality controls
  const qualityControlled = applyQualityControls(finalCandidates, {
    maxRestaurantRatio: 0.25,
    maxMallCount: 2,
    maxCandidates: 200,
  });

  const anchors = qualityControlled.filter(c => c.anchorCandidate);

  // =========================================================================
  // STEP 8: CACHE WRITE
  // =========================================================================
  onProgress?.('💾 Caching results...');

  cacheSetDestination(config, {
    candidates: qualityControlled,
    anchors,
    searchCenters,
    generatedAt: new Date().toISOString(),
  });

  // =========================================================================
  // RETURN RESULTS
  // =========================================================================
  const estimatedCost = budget.getCurrentCost();

  onProgress?.(`✓ Complete: ${qualityControlled.length} candidates, ${anchors.length} anchors, $${estimatedCost.toFixed(3)} cost`);

  return {
    candidates: qualityControlled,
    anchors,
    metadata: {
      cacheHit: false,
      textSearchQueries: budget.getStats().textSearch,
      nearbySearchCalls: budget.getStats().nearbySearch,
      llmFallbackUsed: llmUsed,
      totalCandidatesRaw: candidateMap.size,
      totalCandidatesDeduped: qualityControlled.length,
      recallHealthScore: healthResult.score,
      estimatedCost,
      processingTimeMs: Date.now() - startTime,
    },
  };
}

// =============================================================================
// H) WINNER-ONLY DETAILS ENRICHMENT
// =============================================================================

interface WinnerSelectionCriteria {
  topKAttractions: number;
  topKRestaurants: number;
  backupCount: number;
  diversityWeight: number;
}

/**
 * Select winners that need Place Details enrichment
 * Called AFTER optimizer selects itinerary
 */
export function selectWinnersForEnrichment(
  itinerary: any[], // Day activities from optimizer
  candidates: RetrievalCandidate[],
  criteria: WinnerSelectionCriteria = {
    topKAttractions: 8,
    topKRestaurants: 4,
    backupCount: 4,
    diversityWeight: 0.3,
  }
): string[] {
  const winnerIds = new Set<string>();

  // 1. All places in the itinerary
  for (const day of itinerary) {
    for (const activity of day.activities || []) {
      winnerIds.add(activity.activity?.id || activity.placeId);
    }
  }

  // 2. Top K attractions not in itinerary (backups)
  const attractions = candidates
    .filter(c => !c.types.some(t => ['restaurant', 'cafe', 'food'].includes(t)))
    .filter(c => !winnerIds.has(c.placeId))
    .slice(0, criteria.backupCount);

  for (const a of attractions) {
    winnerIds.add(a.placeId);
  }

  // 3. Top restaurants if not in itinerary
  const restaurants = candidates
    .filter(c => c.types.some(t => ['restaurant'].includes(t)))
    .filter(c => !winnerIds.has(c.placeId))
    .slice(0, criteria.topKRestaurants);

  for (const r of restaurants) {
    winnerIds.add(r.placeId);
  }

  return Array.from(winnerIds);
}

/**
 * Enrich winners with Place Details
 * Handles opening hours with multi-period and special hours
 */
export async function enrichWinnersWithDetails(
  winnerIds: string[],
  googleApiKey: string,
  budget: BudgetManager,
  onProgress?: (message: string) => void
): Promise<Map<string, PlaceDetailsCacheValue>> {
  const enriched = new Map<string, PlaceDetailsCacheValue>();

  for (const placeId of winnerIds) {
    // Check cache first
    const cached = cacheGetPlaceDetails(placeId);
    if (cached && !shouldRefreshPlaceDetails(placeId)) {
      enriched.set(placeId, cached);
      continue;
    }

    // Budget check
    if (!budget.canCall('placeDetails')) {
      onProgress?.(`⚠️ Budget exhausted, skipping details for ${winnerIds.length - enriched.size} places`);
      break;
    }

    try {
      const details = await googlePlaceDetails(placeId, googleApiKey);
      budget.recordCall('placeDetails');

      const parsed: PlaceDetailsCacheValue = {
        placeId,
        name: details.name,
        formattedAddress: details.formatted_address,
        openingHours: details.opening_hours ? {
          weekdayText: details.opening_hours.weekday_text || [],
          periods: details.opening_hours.periods?.map((p: any) => ({
            open: { day: p.open?.day, time: p.open?.time },
            close: p.close ? { day: p.close.day, time: p.close.time } : undefined,
          })),
          specialHours: [], // Would need to fetch from another source
        } : undefined,
        phoneNumber: details.formatted_phone_number,
        website: details.website,
        photos: details.photos?.slice(0, 5).map((p: any) => p.photo_reference),
        priceLevel: details.price_level,
        wheelchair: details.wheelchair_accessible_entrance,
        fetchedAt: new Date().toISOString(),
      };

      // Cache it
      cacheSetPlaceDetails(placeId, parsed);
      enriched.set(placeId, parsed);

    } catch (error) {
      console.error(`Failed to get details for ${placeId}:`, error);
    }
  }

  return enriched;
}

// =============================================================================
// I) GOOGLE API HELPERS
// =============================================================================

async function getCityCenter(
  city: string,
  country: string,
  apiKey: string
): Promise<{ lat: number; lng: number }> {
  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(`${city}, ${country}`)}&key=${apiKey}`;
    const response = await fetch(url);
    const data = await response.json();

    if (data.results?.[0]?.geometry?.location) {
      return {
        lat: data.results[0].geometry.location.lat,
        lng: data.results[0].geometry.location.lng,
      };
    }
  } catch (error) {
    console.error('Geocoding failed:', error);
  }

  // Fallback for common cities
  const fallbacks: Record<string, { lat: number; lng: number }> = {
    'tokyo': { lat: 35.6762, lng: 139.6503 },
    'paris': { lat: 48.8566, lng: 2.3522 },
    'new york': { lat: 40.7128, lng: -74.0060 },
    'london': { lat: 51.5074, lng: -0.1278 },
  };

  return fallbacks[city.toLowerCase()] || { lat: 0, lng: 0 };
}

async function googleTextSearch(
  query: string,
  location: { lat: number; lng: number },
  apiKey: string
): Promise<any[]> {
  const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?` +
    `query=${encodeURIComponent(query)}` +
    `&location=${location.lat},${location.lng}` +
    `&radius=25000` +
    `&key=${apiKey}`;

  const response = await fetch(url);
  const data = await response.json();

  return data.results || [];
}

async function googleNearbySearch(
  lat: number,
  lng: number,
  radius: number,
  type: string,
  apiKey: string
): Promise<any[]> {
  const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?` +
    `location=${lat},${lng}` +
    `&radius=${radius}` +
    `&type=${type}` +
    `&key=${apiKey}`;

  const response = await fetch(url);
  const data = await response.json();

  return data.results || [];
}

async function googlePlaceDetails(
  placeId: string,
  apiKey: string
): Promise<any> {
  const fields = [
    'name',
    'formatted_address',
    'formatted_phone_number',
    'opening_hours',
    'website',
    'price_level',
    'photos',
    'wheelchair_accessible_entrance',
  ].join(',');

  const url = `https://maps.googleapis.com/maps/api/place/details/json?` +
    `place_id=${placeId}` +
    `&fields=${fields}` +
    `&key=${apiKey}`;

  const response = await fetch(url);
  const data = await response.json();

  return data.result || {};
}

// =============================================================================
// J) QUALITY CONTROLS
// =============================================================================

function applyQualityControls(
  candidates: RetrievalCandidate[],
  limits: {
    maxRestaurantRatio: number;
    maxMallCount: number;
    maxCandidates: number;
  }
): RetrievalCandidate[] {
  const result: RetrievalCandidate[] = [];
  let restaurantCount = 0;
  let mallCount = 0;

  // Sort by iconic score first
  const sorted = [...candidates].sort((a, b) => b.iconicScore - a.iconicScore);

  const maxRestaurants = Math.floor(limits.maxCandidates * limits.maxRestaurantRatio);

  for (const candidate of sorted) {
    if (result.length >= limits.maxCandidates) break;

    const isRestaurant = candidate.types.some(t =>
      ['restaurant', 'food', 'cafe', 'bakery'].includes(t)
    );
    const isMall = candidate.types.includes('shopping_mall');

    // Skip if over restaurant limit
    if (isRestaurant && restaurantCount >= maxRestaurants) continue;

    // Skip if over mall limit
    if (isMall && mallCount >= limits.maxMallCount) continue;

    result.push(candidate);
    if (isRestaurant) restaurantCount++;
    if (isMall) mallCount++;
  }

  return result;
}

// =============================================================================
// K) UTILITY FUNCTIONS
// =============================================================================

function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}

/**
 * Calculate Jaro-Winkler similarity for name matching
 */
function jaroWinklerSimilarity(s1: string, s2: string): number {
  if (s1 === s2) return 1.0;
  if (s1.length === 0 || s2.length === 0) return 0.0;

  const matchDistance = Math.floor(Math.max(s1.length, s2.length) / 2) - 1;
  const s1Matches = new Array(s1.length).fill(false);
  const s2Matches = new Array(s2.length).fill(false);

  let matches = 0;
  let transpositions = 0;

  for (let i = 0; i < s1.length; i++) {
    const start = Math.max(0, i - matchDistance);
    const end = Math.min(i + matchDistance + 1, s2.length);

    for (let j = start; j < end; j++) {
      if (s2Matches[j] || s1[i] !== s2[j]) continue;
      s1Matches[i] = true;
      s2Matches[j] = true;
      matches++;
      break;
    }
  }

  if (matches === 0) return 0.0;

  let k = 0;
  for (let i = 0; i < s1.length; i++) {
    if (!s1Matches[i]) continue;
    while (!s2Matches[k]) k++;
    if (s1[i] !== s2[k]) transpositions++;
    k++;
  }

  const jaro = (matches / s1.length + matches / s2.length + (matches - transpositions / 2) / matches) / 3;

  // Find common prefix (up to 4 chars)
  let prefixLen = 0;
  for (let i = 0; i < Math.min(s1.length, s2.length, 4); i++) {
    if (s1[i] === s2[i]) prefixLen++;
    else break;
  }

  return jaro + prefixLen * 0.1 * (1 - jaro);
}

/**
 * Normalize name for comparison
 */
function normalizeNameForComparison(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .replace(/\b(the|a|an|of|in|at|on)\b/g, '')
    .trim();
}

/**
 * Remove near-duplicates from retrieval candidates
 * Uses distance < 120m AND name similarity > 0.9
 */
function removeNearDuplicates(candidates: RetrievalCandidate[]): RetrievalCandidate[] {
  if (candidates.length === 0) return [];

  const result: RetrievalCandidate[] = [];
  const merged = new Set<number>();

  for (let i = 0; i < candidates.length; i++) {
    if (merged.has(i)) continue;

    let best = candidates[i];

    // Find and merge near-duplicates
    for (let j = i + 1; j < candidates.length; j++) {
      if (merged.has(j)) continue;

      const other = candidates[j];

      // Check distance (convert km to meters)
      const distKm = haversineDistance(
        best.location.lat, best.location.lng,
        other.location.lat, other.location.lng
      );

      if (distKm > 0.12) continue; // 120m threshold

      // Check name similarity
      const name1 = normalizeNameForComparison(best.name);
      const name2 = normalizeNameForComparison(other.name);
      const similarity = jaroWinklerSimilarity(name1, name2);

      if (similarity < 0.9) continue;

      // Found a near-duplicate - merge
      merged.add(j);

      // Keep the one with better score
      const bestScore = (best.reviewCount || 0) + (best.rating || 0) * 100;
      const otherScore = (other.reviewCount || 0) + (other.rating || 0) * 100;

      if (otherScore > bestScore) {
        // Merge: keep other's identity but take best fields
        best = {
          ...best,
          ...other,
          reviewCount: Math.max(best.reviewCount || 0, other.reviewCount || 0),
          rating: Math.max(best.rating || 0, other.rating || 0),
          consensusCount: Math.max(best.consensusCount, other.consensusCount),
        };
      } else {
        // Keep best's identity but merge fields
        best = {
          ...other,
          ...best,
          reviewCount: Math.max(best.reviewCount || 0, other.reviewCount || 0),
          rating: Math.max(best.rating || 0, other.rating || 0),
          consensusCount: Math.max(best.consensusCount, other.consensusCount),
        };
      }
    }

    result.push(best);
  }

  return result;
}

// =============================================================================
// L) INTEGRATION HELPERS
// =============================================================================

/**
 * Convert to format expected by existing Agent3 Optimizer
 */
export function toOptimizerFormat(result: RetrievalResult): {
  candidates: {
    attractions: any[];
    restaurants: any[];
    cafes: any[];
  };
  iconicCandidates: any[];
  queryConsensus: Map<string, number>;
} {
  const attractions: any[] = [];
  const restaurants: any[] = [];
  const cafes: any[] = [];
  const queryConsensus = new Map<string, number>();

  for (const c of result.candidates) {
    const formatted = {
      id: c.placeId,
      name: c.name,
      type: categorizeType(c.types),
      location: {
        lat: c.location.lat,
        lng: c.location.lng,
        neighborhood: c.vicinity || '',
      },
      photo_url: c.photoReference
        ? `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photo_reference=${c.photoReference}&key=${process.env.GOOGLE_MAPS_API_KEY}`
        : undefined,
      google_data: {
        rating: c.rating,
        reviews_count: c.reviewCount,
        price_level: c.priceLevel || 2,
      },
      constraints_satisfied: {
        wheelchair_accessible: true,
        vegan_friendly: true,
        cost: (c.priceLevel || 2) * 15,
      },
      relevance_score: c.iconicScore,
      _isAnchorCandidate: c.anchorCandidate,
    };

    queryConsensus.set(c.placeId, c.consensusCount / 5); // Normalize

    const type = categorizeType(c.types);
    if (type === 'restaurant') restaurants.push(formatted);
    else if (type === 'cafe') cafes.push(formatted);
    else attractions.push(formatted);
  }

  const iconicCandidates = result.anchors.map(c => ({
    id: c.placeId,
    name: c.name,
    type: categorizeType(c.types),
    location: { lat: c.location.lat, lng: c.location.lng },
    google_data: {
      rating: c.rating,
      reviews_count: c.reviewCount,
    },
    relevance_score: c.iconicScore,
  }));

  return { candidates: { attractions, restaurants, cafes }, iconicCandidates, queryConsensus };
}

function categorizeType(types: string[]): 'attraction' | 'restaurant' | 'cafe' {
  if (types.includes('restaurant') || types.includes('food')) return 'restaurant';
  if (types.includes('cafe') || types.includes('bakery')) return 'cafe';
  return 'attraction';
}
