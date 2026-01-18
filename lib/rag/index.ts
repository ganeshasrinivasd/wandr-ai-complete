/**
 * RAG Module Index
 *
 * Exports all RAG-related types, utilities, and clients
 * for Pinecone-based agentic retrieval.
 */

// Types
export * from './types';

// Embeddings
export {
  generateEmbedding,
  generateEmbeddings,
  getCachedEmbedding,
  clearEmbeddingCache,
  buildAnchorQuery,
  buildBigRockQuery,
  buildTemplateQuery,
  buildZoneQuery,
  buildRuleQuery,
  buildPlaybookQuery,
  buildAnchorContent,
  buildBigRockContent,
  buildTemplateContent,
  buildRuleContent,
  buildPlaybookContent,
} from './embeddings';

// Pinecone Client
export {
  getPineconeClient,
  getPineconeIndex,
  indexExists,
  createIndexIfNotExists,
  getIndexStats,
  queryPinecone,
  queryAnchors,
  queryBigRocks,
  queryTemplates,
  queryZoneMap,
  queryPolicyRules,
  queryRepairPlaybooks,
  upsertDocuments,
  upsertAnchors,
  upsertBigRocks,
  upsertTemplates,
  upsertZoneMap,
  upsertPolicyRules,
  upsertRepairPlaybooks,
  deleteDocuments,
  deleteAllInNamespace,
  parseStructuredData,
  healthCheck,
} from './pinecone-client';
