// Reddit MCP Server - Currently disabled
// To enable, add Reddit API credentials to .env.local

export const redditTools = {
  searchReddit: async (params: any) => {
    console.log('Reddit search disabled - skipping');
    return { query: params.query, results_count: 0, posts: [] };
  },
  extractPlaceMentions: async (threadIds: string[], location: string) => {
    console.log('Reddit extraction disabled - skipping');
    return { mentions: [], total: 0 };
  },
  getPlaceSentiment: async (placeName: string, threadIds: string[]) => {
    console.log('Reddit sentiment disabled - skipping');
    return {
      place: placeName,
      sentiment_score: 0,
      positive_count: 0,
      negative_count: 0,
      total_mentions: 0,
      confidence: 'low' as const,
    };
  },
};
