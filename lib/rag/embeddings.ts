/**
 * Embeddings Module
 *
 * Handles generation of embeddings using OpenAI's text-embedding models.
 * Used for both indexing documents and querying Pinecone.
 */

import { EmbeddingConfig, DEFAULT_EMBEDDING_CONFIG } from './types';

// =============================================================================
// EMBEDDING GENERATION
// =============================================================================

/**
 * Generate embedding for a single text
 */
export async function generateEmbedding(
  text: string,
  config: EmbeddingConfig = DEFAULT_EMBEDDING_CONFIG
): Promise<number[]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY environment variable is required');
  }

  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      input: text,
      dimensions: config.dimensions,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`OpenAI embedding error: ${error.error?.message || 'Unknown error'}`);
  }

  const data = await response.json();
  return data.data[0].embedding;
}

/**
 * Generate embeddings for multiple texts (batched)
 */
export async function generateEmbeddings(
  texts: string[],
  config: EmbeddingConfig = DEFAULT_EMBEDDING_CONFIG
): Promise<number[][]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY environment variable is required');
  }

  // OpenAI allows up to 2048 inputs per batch
  const BATCH_SIZE = 100;
  const embeddings: number[][] = [];

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);

    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        input: batch,
        dimensions: config.dimensions,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`OpenAI embedding error: ${error.error?.message || 'Unknown error'}`);
    }

    const data = await response.json();

    // Sort by index to maintain order
    const sortedData = data.data.sort((a: any, b: any) => a.index - b.index);
    embeddings.push(...sortedData.map((d: any) => d.embedding));
  }

  return embeddings;
}

// =============================================================================
// QUERY EMBEDDING HELPERS
// =============================================================================

/**
 * Build a query string for anchor retrieval
 */
export function buildAnchorQuery(city: string, interests: string[]): string {
  const interestStr = interests.length > 0 ? interests.join(' ') : 'popular attractions';
  return `${city} iconic landmarks must-see attractions ${interestStr}`;
}

/**
 * Build a query string for big-rock retrieval
 */
export function buildBigRockQuery(city: string): string {
  return `${city} full day attractions theme parks film city zoo aquarium`;
}

/**
 * Build a query string for day template retrieval
 */
export function buildTemplateQuery(city: string, days: number, interests: string[]): string {
  const interestStr = interests.length > 0 ? interests.join(' ') : 'sightseeing';
  return `${days} day itinerary ${city} ${interestStr} travel plan`;
}

/**
 * Build a query string for zone retrieval
 */
export function buildZoneQuery(city: string): string {
  return `${city} neighborhoods zones areas districts tourist regions`;
}

/**
 * Build a query string for policy rule retrieval
 */
export function buildRuleQuery(category: string, stage: string): string {
  return `${category} policy rule constraint ${stage} scheduling`;
}

/**
 * Build a query string for repair playbook retrieval
 */
export function buildPlaybookQuery(failureType: string, context?: string): string {
  return `repair fix ${failureType} ${context || ''} itinerary correction`;
}

// =============================================================================
// EMBEDDING CACHE (In-memory for development)
// =============================================================================

const embeddingCache = new Map<string, { embedding: number[]; timestamp: number }>();
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

/**
 * Get cached embedding or generate new one
 */
export async function getCachedEmbedding(
  text: string,
  config: EmbeddingConfig = DEFAULT_EMBEDDING_CONFIG
): Promise<number[]> {
  const cacheKey = `${config.model}:${text}`;
  const cached = embeddingCache.get(cacheKey);

  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.embedding;
  }

  const embedding = await generateEmbedding(text, config);
  embeddingCache.set(cacheKey, { embedding, timestamp: Date.now() });

  // Cleanup old entries
  if (embeddingCache.size > 1000) {
    const now = Date.now();
    for (const [key, value] of embeddingCache.entries()) {
      if (now - value.timestamp > CACHE_TTL_MS) {
        embeddingCache.delete(key);
      }
    }
  }

  return embedding;
}

/**
 * Clear embedding cache
 */
export function clearEmbeddingCache(): void {
  embeddingCache.clear();
}

// =============================================================================
// DOCUMENT CONTENT BUILDERS
// =============================================================================

/**
 * Build content string for anchor document embedding
 */
export function buildAnchorContent(anchor: {
  name: string;
  city: string;
  zone: string;
  category: string;
  description?: string;
  nearby_pairings?: string[];
}): string {
  const parts = [
    anchor.name,
    `in ${anchor.city}`,
    `located in ${anchor.zone}`,
    `category: ${anchor.category}`,
  ];

  if (anchor.description) {
    parts.push(anchor.description);
  }

  if (anchor.nearby_pairings && anchor.nearby_pairings.length > 0) {
    parts.push(`near ${anchor.nearby_pairings.join(', ')}`);
  }

  return parts.join('. ');
}

/**
 * Build content string for big-rock document embedding
 */
export function buildBigRockContent(bigRock: {
  name: string;
  city: string;
  description?: string;
  duration_hours?: number;
}): string {
  const parts = [
    bigRock.name,
    `in ${bigRock.city}`,
    'full day attraction',
  ];

  if (bigRock.description) {
    parts.push(bigRock.description);
  }

  if (bigRock.duration_hours) {
    parts.push(`requires ${bigRock.duration_hours} hours`);
  }

  return parts.join('. ');
}

/**
 * Build content string for day template document embedding
 */
export function buildTemplateContent(template: {
  theme: string;
  city: string;
  zones: string[];
  interests: string[];
  is_big_rock_day: boolean;
}): string {
  const parts = [
    `Day itinerary: ${template.theme}`,
    `in ${template.city}`,
    `covering ${template.zones.join(', ')}`,
    `interests: ${template.interests.join(', ')}`,
  ];

  if (template.is_big_rock_day) {
    parts.push('full day attraction day');
  }

  return parts.join('. ');
}

/**
 * Build content string for policy rule document embedding
 */
export function buildRuleContent(rule: {
  rule_id: string;
  action: string;
  applies_to: string[];
  stage: string;
}): string {
  return [
    `Rule ${rule.rule_id}`,
    `action: ${rule.action}`,
    `applies to: ${rule.applies_to.join(', ')}`,
    `stage: ${rule.stage}`,
  ].join('. ');
}

/**
 * Build content string for repair playbook document embedding
 */
export function buildPlaybookContent(playbook: {
  playbook_id: string;
  failure_type: string;
  strategies: Array<{ name: string; action: string }>;
}): string {
  const strategyStr = playbook.strategies
    .map(s => `${s.name}: ${s.action}`)
    .join('; ');

  return [
    `Repair playbook ${playbook.playbook_id}`,
    `fixes: ${playbook.failure_type}`,
    `strategies: ${strategyStr}`,
  ].join('. ');
}
