/**
 * Pinecone Client Module
 *
 * Handles connection to Pinecone and provides query/upsert helpers
 * for the wandr-knowledge index.
 */

import { Pinecone, Index, RecordMetadata } from '@pinecone-database/pinecone';
import {
  PINECONE_INDEX_CONFIG,
  PineconeQueryConfig,
  PineconeQueryResult,
  AnchorDocument,
  BigRockDocument,
  DayTemplateDocument,
  ZoneMapDocument,
  PolicyRuleDocument,
  RepairPlaybookDocument,
} from './types';
import { getCachedEmbedding } from './embeddings';

// =============================================================================
// PINECONE CLIENT SINGLETON
// =============================================================================

let pineconeClient: Pinecone | null = null;
let pineconeIndex: Index | null = null;

/**
 * Get or create Pinecone client instance
 */
export function getPineconeClient(): Pinecone {
  if (!pineconeClient) {
    const apiKey = process.env.PINECONE_API_KEY;
    if (!apiKey) {
      throw new Error('PINECONE_API_KEY environment variable is required');
    }
    pineconeClient = new Pinecone({ apiKey });
  }
  return pineconeClient;
}

/**
 * Get or create index instance
 */
export function getPineconeIndex(): Index {
  if (!pineconeIndex) {
    const client = getPineconeClient();
    pineconeIndex = client.index(PINECONE_INDEX_CONFIG.indexName);
  }
  return pineconeIndex;
}

// =============================================================================
// INDEX MANAGEMENT
// =============================================================================

/**
 * Check if the wandr-knowledge index exists
 */
export async function indexExists(): Promise<boolean> {
  const client = getPineconeClient();
  const indexes = await client.listIndexes();
  return indexes.indexes?.some(idx => idx.name === PINECONE_INDEX_CONFIG.indexName) ?? false;
}

/**
 * Create the wandr-knowledge index if it doesn't exist
 */
export async function createIndexIfNotExists(): Promise<void> {
  const exists = await indexExists();
  if (exists) {
    console.log(`Index '${PINECONE_INDEX_CONFIG.indexName}' already exists`);
    return;
  }

  const client = getPineconeClient();
  console.log(`Creating index '${PINECONE_INDEX_CONFIG.indexName}'...`);

  await client.createIndex({
    name: PINECONE_INDEX_CONFIG.indexName,
    dimension: PINECONE_INDEX_CONFIG.dimensions,
    metric: PINECONE_INDEX_CONFIG.metric,
    spec: {
      serverless: {
        cloud: 'aws',
        region: 'us-east-1',
      },
    },
  });

  // Wait for index to be ready
  console.log('Waiting for index to be ready...');
  await waitForIndexReady();
  console.log('Index created and ready');
}

/**
 * Wait for index to be ready
 */
async function waitForIndexReady(maxWaitMs: number = 60000): Promise<void> {
  const client = getPineconeClient();
  const startTime = Date.now();

  while (Date.now() - startTime < maxWaitMs) {
    const description = await client.describeIndex(PINECONE_INDEX_CONFIG.indexName);
    if (description.status?.ready) {
      return;
    }
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  throw new Error(`Index not ready after ${maxWaitMs}ms`);
}

/**
 * Get index statistics
 */
export async function getIndexStats(): Promise<{
  totalVectors: number;
  namespaces: Record<string, { vectorCount: number }>;
}> {
  const index = getPineconeIndex();
  const stats = await index.describeIndexStats();

  // Transform namespaces to expected format
  const namespaces: Record<string, { vectorCount: number }> = {};
  if (stats.namespaces) {
    for (const [key, value] of Object.entries(stats.namespaces)) {
      namespaces[key] = { vectorCount: value.recordCount || 0 };
    }
  }

  return {
    totalVectors: stats.totalRecordCount || 0,
    namespaces,
  };
}

// =============================================================================
// QUERY HELPERS
// =============================================================================

/**
 * Query Pinecone with embedding generation
 */
export async function queryPinecone<T extends RecordMetadata>(
  config: PineconeQueryConfig
): Promise<PineconeQueryResult<T>> {
  const startTime = Date.now();
  const index = getPineconeIndex();

  // Generate embedding for query
  const embedding = await getCachedEmbedding(config.query);

  // Query the appropriate namespace
  const namespace = index.namespace(config.namespace);
  const results = await namespace.query({
    vector: embedding,
    topK: config.topK,
    filter: config.filter,
    includeMetadata: config.includeMetadata ?? true,
  });

  return {
    matches: results.matches?.map(match => ({
      id: match.id,
      score: match.score || 0,
      metadata: match.metadata as T,
    })) || [],
    latencyMs: Date.now() - startTime,
  };
}

/**
 * Query for city anchors
 */
export async function queryAnchors(
  city: string,
  query: string,
  topK: number = 20
): Promise<PineconeQueryResult<RecordMetadata>> {
  return queryPinecone<RecordMetadata>({
    namespace: 'city_knowledge',
    query,
    topK,
    filter: {
      city: { $eq: city.toLowerCase() },
      doc_type: { $eq: 'anchor' },
    },
  });
}

/**
 * Query for big rocks
 */
export async function queryBigRocks(
  city: string,
  query: string,
  topK: number = 10
): Promise<PineconeQueryResult<RecordMetadata>> {
  return queryPinecone<RecordMetadata>({
    namespace: 'city_knowledge',
    query,
    topK,
    filter: {
      city: { $eq: city.toLowerCase() },
      doc_type: { $eq: 'big_rock' },
    },
  });
}

/**
 * Query for day templates
 */
export async function queryTemplates(
  city: string,
  query: string,
  topK: number = 5
): Promise<PineconeQueryResult<RecordMetadata>> {
  return queryPinecone<RecordMetadata>({
    namespace: 'city_knowledge',
    query,
    topK,
    filter: {
      city: { $eq: city.toLowerCase() },
      doc_type: { $eq: 'day_template' },
    },
  });
}

/**
 * Query for zone map
 */
export async function queryZoneMap(
  city: string,
  query: string
): Promise<PineconeQueryResult<RecordMetadata>> {
  return queryPinecone<RecordMetadata>({
    namespace: 'city_knowledge',
    query,
    topK: 1,
    filter: {
      city: { $eq: city.toLowerCase() },
      doc_type: { $eq: 'zone_map' },
    },
  });
}

/**
 * Query for policy rules
 */
export async function queryPolicyRules(
  query: string,
  stage?: string,
  ruleType?: 'hard' | 'soft',
  topK: number = 10
): Promise<PineconeQueryResult<RecordMetadata>> {
  const filter: Record<string, any> = {
    doc_type: { $eq: 'rule' },
  };

  if (stage) {
    filter.stage = { $in: [stage, 'all'] };
  }

  if (ruleType) {
    filter.rule_type = { $eq: ruleType };
  }

  return queryPinecone<RecordMetadata>({
    namespace: 'policy_rules',
    query,
    topK,
    filter,
  });
}

/**
 * Query for repair playbooks
 */
export async function queryRepairPlaybooks(
  failureType: string,
  query: string,
  topK: number = 3
): Promise<PineconeQueryResult<RecordMetadata>> {
  return queryPinecone<RecordMetadata>({
    namespace: 'repair_playbooks',
    query,
    topK,
    filter: {
      doc_type: { $eq: 'playbook' },
      failure_type: { $eq: failureType },
    },
  });
}

// =============================================================================
// UPSERT HELPERS
// =============================================================================

/**
 * Upsert documents to a namespace
 */
export async function upsertDocuments(
  namespace: string,
  documents: Array<{
    id: string;
    content: string;
    metadata: RecordMetadata;
  }>
): Promise<void> {
  const index = getPineconeIndex();
  const ns = index.namespace(namespace);

  // Generate embeddings for all documents
  const embeddings = await Promise.all(
    documents.map(doc => getCachedEmbedding(doc.content))
  );

  // Prepare vectors
  const vectors = documents.map((doc, i) => ({
    id: doc.id,
    values: embeddings[i],
    metadata: doc.metadata,
  }));

  // Upsert in batches of 100
  const BATCH_SIZE = 100;
  for (let i = 0; i < vectors.length; i += BATCH_SIZE) {
    const batch = vectors.slice(i, i + BATCH_SIZE);
    await ns.upsert(batch);
    console.log(`Upserted ${Math.min(i + BATCH_SIZE, vectors.length)}/${vectors.length} documents to ${namespace}`);
  }
}

/**
 * Upsert anchor documents
 */
export async function upsertAnchors(anchors: AnchorDocument[]): Promise<void> {
  await upsertDocuments(
    PINECONE_INDEX_CONFIG.namespaces.cityKnowledge,
    anchors.map(anchor => ({
      id: anchor.id,
      content: anchor.content,
      metadata: {
        doc_type: anchor.doc_type,
        city: anchor.city.toLowerCase(),
        country: anchor.country.toLowerCase(),
        zone: anchor.zone,
        confidence: anchor.confidence,
        last_verified: anchor.last_verified,
        version: anchor.version,
        // Flatten key structured data for filtering
        name: anchor.structured_data.name,
        category: anchor.structured_data.category,
        iconic: anchor.structured_data.iconic,
        // Store full structured data as JSON string
        structured_data_json: JSON.stringify(anchor.structured_data),
      },
    }))
  );
}

/**
 * Upsert big rock documents
 */
export async function upsertBigRocks(bigRocks: BigRockDocument[]): Promise<void> {
  await upsertDocuments(
    PINECONE_INDEX_CONFIG.namespaces.cityKnowledge,
    bigRocks.map(bigRock => ({
      id: bigRock.id,
      content: bigRock.content,
      metadata: {
        doc_type: bigRock.doc_type,
        city: bigRock.city.toLowerCase(),
        country: bigRock.country.toLowerCase(),
        zone: bigRock.zone,
        confidence: bigRock.confidence,
        last_verified: bigRock.last_verified,
        version: bigRock.version,
        // Flatten key structured data for filtering
        name: bigRock.structured_data.name,
        min_duration_min: bigRock.structured_data.min_duration_min,
        requires_full_day: bigRock.structured_data.requires_full_day,
        // Store full structured data as JSON string
        structured_data_json: JSON.stringify(bigRock.structured_data),
      },
    }))
  );
}

/**
 * Upsert day template documents
 */
export async function upsertTemplates(templates: DayTemplateDocument[]): Promise<void> {
  await upsertDocuments(
    PINECONE_INDEX_CONFIG.namespaces.cityKnowledge,
    templates.map(template => ({
      id: template.id,
      content: template.content,
      metadata: {
        doc_type: template.doc_type,
        city: template.city.toLowerCase(),
        country: template.country.toLowerCase(),
        confidence: template.confidence,
        last_verified: template.last_verified,
        version: template.version,
        // Flatten key structured data for filtering
        theme: template.structured_data.theme,
        pace: template.structured_data.pace,
        is_big_rock_day: template.structured_data.is_big_rock_day,
        // Store full structured data as JSON string
        structured_data_json: JSON.stringify(template.structured_data),
      },
    }))
  );
}

/**
 * Upsert zone map document
 */
export async function upsertZoneMap(zoneMap: ZoneMapDocument): Promise<void> {
  await upsertDocuments(
    PINECONE_INDEX_CONFIG.namespaces.cityKnowledge,
    [{
      id: zoneMap.id,
      content: zoneMap.content,
      metadata: {
        doc_type: zoneMap.doc_type,
        city: zoneMap.city.toLowerCase(),
        country: zoneMap.country.toLowerCase(),
        confidence: zoneMap.confidence,
        last_verified: zoneMap.last_verified,
        version: zoneMap.version,
        // Store full structured data as JSON string
        structured_data_json: JSON.stringify(zoneMap.structured_data),
      },
    }]
  );
}

/**
 * Upsert policy rule documents
 */
export async function upsertPolicyRules(rules: PolicyRuleDocument[]): Promise<void> {
  await upsertDocuments(
    PINECONE_INDEX_CONFIG.namespaces.policyRules,
    rules.map(rule => ({
      id: rule.id,
      content: rule.content,
      metadata: {
        doc_type: rule.doc_type,
        rule_type: rule.rule_type,
        stage: rule.stage,
        confidence: rule.confidence,
        version: rule.version,
        // Flatten key structured data for filtering
        rule_id: rule.structured_data.rule_id,
        failure_label: rule.structured_data.failure_label,
        priority: rule.structured_data.priority,
        // Store full structured data as JSON string
        structured_data_json: JSON.stringify(rule.structured_data),
      },
    }))
  );
}

/**
 * Upsert repair playbook documents
 */
export async function upsertRepairPlaybooks(playbooks: RepairPlaybookDocument[]): Promise<void> {
  await upsertDocuments(
    PINECONE_INDEX_CONFIG.namespaces.repairPlaybooks,
    playbooks.map(playbook => ({
      id: playbook.id,
      content: playbook.content,
      metadata: {
        doc_type: playbook.doc_type,
        stage: playbook.stage,
        confidence: playbook.confidence,
        version: playbook.version,
        // Flatten key structured data for filtering
        playbook_id: playbook.structured_data.playbook_id,
        failure_type: playbook.structured_data.failure_type,
        failure_subtype: playbook.structured_data.failure_subtype || '',
        // Store full structured data as JSON string
        structured_data_json: JSON.stringify(playbook.structured_data),
      },
    }))
  );
}

// =============================================================================
// DELETE HELPERS
// =============================================================================

/**
 * Delete documents by IDs from a namespace
 */
export async function deleteDocuments(
  namespace: string,
  ids: string[]
): Promise<void> {
  const index = getPineconeIndex();
  const ns = index.namespace(namespace);
  await ns.deleteMany(ids);
}

/**
 * Delete all documents in a namespace
 */
export async function deleteAllInNamespace(namespace: string): Promise<void> {
  const index = getPineconeIndex();
  const ns = index.namespace(namespace);
  await ns.deleteAll();
}

// =============================================================================
// UTILITY HELPERS
// =============================================================================

/**
 * Parse structured_data from metadata JSON string
 */
export function parseStructuredData<T>(metadata: RecordMetadata): T | null {
  const jsonStr = metadata.structured_data_json;
  if (typeof jsonStr === 'string') {
    try {
      return JSON.parse(jsonStr) as T;
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Health check for Pinecone connection
 */
export async function healthCheck(): Promise<{
  connected: boolean;
  indexExists: boolean;
  stats?: { totalVectors: number };
  error?: string;
}> {
  try {
    const exists = await indexExists();
    if (!exists) {
      return { connected: true, indexExists: false };
    }

    const stats = await getIndexStats();
    return {
      connected: true,
      indexExists: true,
      stats: { totalVectors: stats.totalVectors },
    };
  } catch (error) {
    return {
      connected: false,
      indexExists: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
