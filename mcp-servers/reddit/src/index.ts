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
