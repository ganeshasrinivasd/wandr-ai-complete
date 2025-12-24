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
