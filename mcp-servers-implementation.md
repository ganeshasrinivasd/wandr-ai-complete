# MCP Servers Implementation

## Reddit MCP Server

### Directory: `mcp-servers/reddit/`

#### `package.json`
```json
{
  "name": "mcp-server-reddit",
  "version": "1.0.0",
  "type": "module",
  "main": "dist/index.js",
  "scripts": {
    "dev": "tsx src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js"
  },
  "dependencies": {
    "snoowrap": "^1.23.0",
    "dotenv": "^16.4.5"
  },
  "devDependencies": {
    "@types/node": "^20.12.12",
    "typescript": "^5.4.5",
    "tsx": "^4.9.0"
  }
}
```

#### `tsconfig.json`
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "lib": ["ES2020"],
    "moduleResolution": "node",
    "esModuleInterop": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "skipLibCheck": true
  },
  "include": ["src/**/*"]
}
```

#### `src/index.ts`
```typescript
import Snoowrap from 'snoowrap';
import * as crypto from 'crypto';

// Initialize Reddit client
const reddit = new Snoowrap({
  userAgent: 'wandr-travel-planner/1.0.0',
  clientId: process.env.REDDIT_CLIENT_ID!,
  clientSecret: process.env.REDDIT_CLIENT_SECRET!,
  username: process.env.REDDIT_USERNAME!,
  password: process.env.REDDIT_PASSWORD!,
});

// Simple in-memory cache (for hackathon - use Redis in production)
const cache = new Map<string, { data: any; expiresAt: number }>();

interface RedditSearchParams {
  query: string;
  subreddits?: string[];
  time_filter?: 'hour' | 'day' | 'week' | 'month' | 'year' | 'all';
  limit?: number;
}

interface PlaceMention {
  place: string;
  mentions: number;
  sentiment: number;
  quotes: string[];
}

// Tool 1: Search Reddit
export async function searchReddit(params: RedditSearchParams) {
  const {
    query,
    subreddits = ['travel', 'JapanTravel', 'solotravel'],
    time_filter = 'year',
    limit = 50,
  } = params;

  // Check cache
  const cacheKey = crypto
    .createHash('md5')
    .update(JSON.stringify({ query, subreddits, time_filter }))
    .digest('hex');

  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    console.log('✓ Cache hit for query:', query);
    return cached.data;
  }

  console.log('→ Searching Reddit for:', query);

  const results: any[] = [];

  for (const subreddit of subreddits) {
    try {
      const posts = await reddit
        .getSubreddit(subreddit)
        .search({
          query,
          time: time_filter,
          limit: Math.floor(limit / subreddits.length),
          sort: 'relevance',
        });

      for (const post of posts) {
        results.push({
          id: post.id,
          title: post.title,
          body: post.selftext || '',
          author: post.author.name,
          score: post.score,
          num_comments: post.num_comments,
          url: `https://reddit.com${post.permalink}`,
          created_utc: post.created_utc,
          subreddit: post.subreddit.display_name,
        });
      }
    } catch (error) {
      console.error(`Error searching r/${subreddit}:`, error);
    }
  }

  const result = {
    query,
    subreddits,
    results_count: results.length,
    posts: results,
    cached_at: new Date().toISOString(),
  };

  // Cache for 1 hour
  cache.set(cacheKey, {
    data: result,
    expiresAt: Date.now() + 60 * 60 * 1000,
  });

  console.log(`✓ Found ${results.length} posts`);
  return result;
}

// Tool 2: Extract place mentions from threads
export async function extractPlaceMentions(
  threadIds: string[],
  location: string
): Promise<{ mentions: PlaceMention[]; total: number }> {
  console.log(`→ Extracting mentions from ${threadIds.length} threads`);

  const mentionCounts: Record<string, { count: number; quotes: string[] }> = {};

  // Regex patterns to extract place recommendations
  const patterns = [
    /recommend(?:ed)?\s+([A-Z][a-zA-Z\s&'-]+)/gi,
    /try(?:ing)?\s+([A-Z][a-zA-Z\s&'-]+)/gi,
    /visit(?:ed)?\s+([A-Z][a-zA-Z\s&'-]+)/gi,
    /loved\s+([A-Z][a-zA-Z\s&'-]+)/gi,
    /amazing\s+([A-Z][a-zA-Z\s&'-]+)/gi,
    /check out\s+([A-Z][a-zA-Z\s&'-]+)/gi,
  ];

  for (const threadId of threadIds.slice(0, 20)) {
    // Limit for speed
    try {
      const post = await reddit.getSubmission(threadId);
      await post.expandReplies({ limit: 10, depth: 1 });

      const comments = post.comments;

      for (const comment of comments) {
        if (!comment.body) continue;

        for (const pattern of patterns) {
          const matches = [...comment.body.matchAll(pattern)];

          for (const match of matches) {
            const placeName = match[1].trim();

            // Filter out common words that aren't places
            if (
              placeName.length < 3 ||
              ['The', 'This', 'That', 'There', 'They'].includes(placeName)
            ) {
              continue;
            }

            if (!mentionCounts[placeName]) {
              mentionCounts[placeName] = { count: 0, quotes: [] };
            }

            mentionCounts[placeName].count++;

            // Store sample quote
            if (mentionCounts[placeName].quotes.length < 3) {
              mentionCounts[placeName].quotes.push(
                comment.body.substring(0, 200)
              );
            }
          }
        }
      }
    } catch (error) {
      console.error(`Error fetching thread ${threadId}:`, error);
    }
  }

  const mentions: PlaceMention[] = Object.entries(mentionCounts)
    .map(([place, data]) => ({
      place,
      mentions: data.count,
      sentiment: 0.8, // Simplified - could use sentiment analysis
      quotes: data.quotes,
    }))
    .sort((a, b) => b.mentions - a.mentions)
    .slice(0, 30);

  console.log(`✓ Extracted ${mentions.length} place mentions`);

  return {
    mentions,
    total: mentions.length,
  };
}

// Tool 3: Get sentiment for a specific place
export async function getPlaceSentiment(
  placeName: string,
  threadIds: string[]
): Promise<{
  place: string;
  sentiment_score: number;
  positive_count: number;
  negative_count: number;
  total_mentions: number;
  confidence: 'high' | 'medium' | 'low';
}> {
  console.log(`→ Analyzing sentiment for: ${placeName}`);

  const positiveWords = [
    'amazing',
    'love',
    'best',
    'great',
    'incredible',
    'recommend',
    'must',
    'perfect',
    'awesome',
    'beautiful',
    'excellent',
  ];

  const negativeWords = [
    'bad',
    'worst',
    'avoid',
    'terrible',
    'disappointing',
    'overrated',
    'crowded',
    'expensive',
    'waste',
    'skip',
  ];

  let positive = 0;
  let negative = 0;
  let total = 0;

  for (const threadId of threadIds.slice(0, 15)) {
    try {
      const post = await reddit.getSubmission(threadId);
      await post.expandReplies({ limit: 10, depth: 1 });

      const allText = [post.title, post.selftext, ...post.comments.map((c: any) => c.body)].join(
        ' '
      );

      if (allText.toLowerCase().includes(placeName.toLowerCase())) {
        total++;

        const lowerText = allText.toLowerCase();

        positiveWords.forEach((word) => {
          if (lowerText.includes(word)) positive++;
        });

        negativeWords.forEach((word) => {
          if (lowerText.includes(word)) negative++;
        });
      }
    } catch (error) {
      console.error(`Error analyzing thread ${threadId}:`, error);
    }
  }

  const sentimentScore =
    total > 0 ? (positive - negative) / (positive + negative + 1) : 0;

  const confidence =
    total > 10 ? 'high' : total > 3 ? 'medium' : 'low';

  console.log(
    `✓ Sentiment: ${sentimentScore.toFixed(2)} (${positive} pos, ${negative} neg, ${total} mentions)`
  );

  return {
    place: placeName,
    sentiment_score: sentimentScore,
    positive_count: positive,
    negative_count: negative,
    total_mentions: total,
    confidence,
  };
}

// Export all tools
export const redditTools = {
  searchReddit,
  extractPlaceMentions,
  getPlaceSentiment,
};

// CLI test interface (for development)
if (import.meta.url === `file://${process.argv[1]}`) {
  const testQuery = process.argv[2] || 'Tokyo wheelchair accessible';

  console.log('\n🧪 Testing Reddit MCP Server\n');

  searchReddit({
    query: testQuery,
    subreddits: ['JapanTravel', 'travel'],
    limit: 10,
  })
    .then((results) => {
      console.log('\n📊 Results:', JSON.stringify(results, null, 2));
    })
    .catch((error) => {
      console.error('❌ Error:', error);
      process.exit(1);
    });
}
```

---

## Google Maps MCP Server

### Directory: `mcp-servers/google-maps/`

#### `package.json`
```json
{
  "name": "mcp-server-google-maps",
  "version": "1.0.0",
  "type": "module",
  "main": "dist/index.js",
  "scripts": {
    "dev": "tsx src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js"
  },
  "dependencies": {
    "@googlemaps/google-maps-services-js": "^3.3.42",
    "dotenv": "^16.4.5"
  },
  "devDependencies": {
    "@types/node": "^20.12.12",
    "typescript": "^5.4.5",
    "tsx": "^4.9.0"
  }
}
```

#### `tsconfig.json`
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "lib": ["ES2020"],
    "moduleResolution": "node",
    "esModuleInterop": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "skipLibCheck": true
  },
  "include": ["src/**/*"]
}
```

#### `src/index.ts`
```typescript
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
```

---

## Integration Layer

### `lib/mcp/reddit-client.ts`
```typescript
import { redditTools } from '../../mcp-servers/reddit/src/index';

export const redditMCP = {
  async search(query: string, subreddits?: string[], limit?: number) {
    return await redditTools.searchReddit({
      query,
      subreddits,
      limit,
    });
  },

  async extractMentions(threadIds: string[], location: string) {
    return await redditTools.extractPlaceMentions(threadIds, location);
  },

  async getSentiment(placeName: string, threadIds: string[]) {
    return await redditTools.getPlaceSentiment(placeName, threadIds);
  },
};
```

### `lib/mcp/google-maps-client.ts`
```typescript
import { googleMapsTools } from '../../mcp-servers/google-maps/src/index';

export const googleMapsMCP = {
  async searchPlaces(
    query: string,
    location: { lat: number; lng: number },
    radius?: number,
    type?: string
  ) {
    return await googleMapsTools.searchPlaces({
      query,
      location,
      radius,
      type,
    });
  },

  async getPlaceDetails(placeId: string) {
    return await googleMapsTools.getPlaceDetails(placeId);
  },

  async checkAccessibility(placeId: string) {
    return await googleMapsTools.checkAccessibility(placeId);
  },

  async getDirections(
    origin: string,
    destination: string,
    mode?: 'driving' | 'walking' | 'transit'
  ) {
    return await googleMapsTools.getDirections({
      origin,
      destination,
      mode,
    });
  },

  async calculateRouteTime(waypoints: string[], mode?: string) {
    return await googleMapsTools.calculateRouteTime({
      waypoints,
      mode: mode as any,
    });
  },
};
```

---

## Testing the MCP Servers

### Test Reddit Server:
```bash
cd mcp-servers/reddit
npm install
REDDIT_CLIENT_ID=xxx REDDIT_CLIENT_SECRET=xxx REDDIT_USERNAME=xxx REDDIT_PASSWORD=xxx npm run dev "Tokyo vegan restaurants"
```

### Test Google Maps Server:
```bash
cd mcp-servers/google-maps
npm install
GOOGLE_MAPS_API_KEY=xxx npm run dev
```

---

Both MCP servers are now ready! They provide the data layer for the agents.
