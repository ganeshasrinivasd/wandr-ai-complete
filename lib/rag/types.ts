/**
 * RAG Types for Pinecone-based Agentic Retrieval
 *
 * These types define the structure of documents stored in Pinecone
 * and the interfaces for retrieval results used by the agent pipeline.
 */

// =============================================================================
// PINECONE DOCUMENT TYPES
// =============================================================================

/**
 * Base metadata fields present on all Pinecone documents
 */
export interface BaseDocumentMetadata {
  doc_type: 'anchor' | 'big_rock' | 'day_template' | 'zone_map' | 'rule' | 'playbook';
  city?: string;
  country?: string;
  confidence: number;
  last_verified: string;
  version: string;
}

/**
 * Iconic Anchor Document
 * Stored in: city_knowledge namespace
 */
export interface AnchorDocument {
  id: string;
  doc_type: 'anchor';
  city: string;
  country: string;
  zone: string;
  content: string; // Natural language description for embedding
  structured_data: {
    name: string;
    place_id?: string;
    normalized_name: string;
    location: { lat: number; lng: number };
    category: string;
    iconic: boolean;
    typical_duration_min: number;
    best_time: ('morning' | 'afternoon' | 'evening')[];
    nearby_pairings: string[];
    accessibility?: {
      wheelchair: 'full' | 'partial' | 'none';
      notes?: string;
    };
  };
  confidence: number;
  last_verified: string;
  version: string;
}

/**
 * Big Rock Document (Full-day attractions)
 * Stored in: city_knowledge namespace
 */
export interface BigRockDocument {
  id: string;
  doc_type: 'big_rock';
  city: string;
  country: string;
  zone: string;
  content: string;
  structured_data: {
    name: string;
    place_id?: string;
    normalized_name: string;
    location: { lat: number; lng: number };
    min_duration_min: number;
    preferred_duration_min: number;
    max_duration_min: number;
    requires_full_day: boolean;
    max_companions: number; // Max light fillers allowed
    best_start_time: string; // e.g., "09:00"
    typical_end_time: string;
    companion_suggestions: string[];
    booking_required: boolean;
    booking_url?: string;
  };
  confidence: number;
  last_verified: string;
  version: string;
}

/**
 * Day Template Document
 * Stored in: city_knowledge namespace
 */
export interface DayTemplateDocument {
  id: string;
  doc_type: 'day_template';
  city: string;
  country: string;
  content: string;
  structured_data: {
    day_index?: number; // Suggested day number (1, 2, 3...)
    theme: string;
    zones: string[];
    is_big_rock_day: boolean;
    pace: 'relaxed' | 'moderate' | 'packed';
    interests: string[];
    anchor_sequence: Array<{
      name: string;
      slot: 'morning' | 'midday' | 'afternoon' | 'evening';
      duration_min: number;
    }>;
    meal_suggestions: {
      breakfast?: { zone: string; cuisine: string };
      lunch: { zone: string; cuisine: string };
      dinner: { zone: string; cuisine: string };
    };
    total_travel_estimate_min: number;
    energy_curve: ('high' | 'medium' | 'low')[];
  };
  confidence: number;
  last_verified: string;
  version: string;
}

/**
 * Zone Map Document
 * Stored in: city_knowledge namespace
 */
export interface ZoneMapDocument {
  id: string;
  doc_type: 'zone_map';
  city: string;
  country: string;
  content: string;
  structured_data: {
    zones: Array<{
      id: string;
      name: string;
      display_name: string;
      centroid: { lat: number; lng: number };
      radius_km: number;
      character: string; // e.g., "Historic", "Modern", "Shopping"
      best_for: string[];
      typical_duration_hours: number;
      adjacent_zones: string[];
    }>;
    recommended_pairings: Array<{
      zones: [string, string];
      travel_time_min: number;
      good_for: string[];
    }>;
  };
  confidence: number;
  last_verified: string;
  version: string;
}

/**
 * Policy Rule Document
 * Stored in: policy_rules namespace
 */
export interface PolicyRuleDocument {
  id: string;
  doc_type: 'rule';
  rule_type: 'hard' | 'soft';
  stage: 'researcher' | 'optimizer' | 'repair' | 'all';
  content: string;
  structured_data: {
    rule_id: string;
    applies_to: string[]; // Categories, types, or conditions
    condition: string; // Pseudo-condition for matching
    action: string;
    parameters: Record<string, number | string | boolean>;
    failure_label: string;
    priority: number; // Lower = higher priority
  };
  confidence: number;
  version: string;
}

/**
 * Repair Playbook Document
 * Stored in: repair_playbooks namespace
 */
export interface RepairPlaybookDocument {
  id: string;
  doc_type: 'playbook';
  stage: 'repair';
  content: string;
  structured_data: {
    playbook_id: string;
    failure_type: string;
    failure_subtype?: string;
    detection_pattern: {
      same_place_id?: boolean;
      or_same_dedupkey?: boolean;
      roles?: string[];
      duration_threshold_min?: number;
      travel_threshold_min?: number;
    };
    strategies: Array<{
      name: string;
      priority: number;
      action: string;
      pseudocode: string;
    }>;
    examples: Array<{
      before: string;
      after: string;
    }>;
  };
  confidence: number;
  version: string;
}

// =============================================================================
// RETRIEVAL RESULT TYPES
// =============================================================================

/**
 * Parsed anchor from Pinecone retrieval
 */
export interface IconicAnchor {
  id: string;
  name: string;
  place_id?: string;
  normalized_name: string;
  location: { lat: number; lng: number };
  zone: string;
  category: string;
  typical_duration_min: number;
  best_time: ('morning' | 'afternoon' | 'evening')[];
  nearby_pairings: string[];
  confidence: number;
}

/**
 * Parsed big rock from Pinecone retrieval
 */
export interface BigRock {
  id: string;
  name: string;
  place_id?: string;
  normalized_name: string;
  location: { lat: number; lng: number };
  zone: string;
  min_duration_min: number;
  preferred_duration_min: number;
  max_duration_min: number;
  requires_full_day: boolean;
  max_companions: number;
  best_start_time: string;
  confidence: number;
}

/**
 * Parsed day template from Pinecone retrieval
 */
export interface DayTemplate {
  id: string;
  theme: string;
  zones: string[];
  is_big_rock_day: boolean;
  pace: 'relaxed' | 'moderate' | 'packed';
  interests: string[];
  anchor_sequence: Array<{
    name: string;
    slot: 'morning' | 'midday' | 'afternoon' | 'evening';
    duration_min: number;
  }>;
  meal_suggestions: {
    lunch: { zone: string; cuisine: string };
    dinner: { zone: string; cuisine: string };
  };
  energy_curve: ('high' | 'medium' | 'low')[];
  confidence: number;
}

/**
 * Parsed zone from Pinecone retrieval
 */
export interface CityZone {
  id: string;
  name: string;
  display_name: string;
  centroid: { lat: number; lng: number };
  radius_km: number;
  character: string;
  best_for: string[];
  adjacent_zones: string[];
}

/**
 * Parsed policy rule from Pinecone retrieval
 */
export interface PolicyRule {
  rule_id: string;
  rule_type: 'hard' | 'soft';
  stage: 'researcher' | 'optimizer' | 'repair' | 'all';
  applies_to: string[];
  condition: string;
  action: string;
  parameters: Record<string, number | string | boolean>;
  failure_label: string;
  priority: number;
}

/**
 * Parsed repair playbook from Pinecone retrieval
 */
export interface RepairPlaybook {
  playbook_id: string;
  failure_type: string;
  failure_subtype?: string;
  detection_pattern: {
    same_place_id?: boolean;
    or_same_dedupkey?: boolean;
    roles?: string[];
    duration_threshold_min?: number;
    travel_threshold_min?: number;
  };
  strategies: Array<{
    name: string;
    priority: number;
    action: string;
    pseudocode: string;
  }>;
}

// =============================================================================
// AGGREGATED CITY KNOWLEDGE
// =============================================================================

/**
 * Complete city knowledge pack retrieved from Pinecone
 */
export interface CityKnowledge {
  city: string;
  country: string;
  anchors: IconicAnchor[];
  bigRocks: BigRock[];
  templates: DayTemplate[];
  zones: CityZone[];
  retrievalMetadata: {
    anchorsRetrieved: number;
    bigRocksRetrieved: number;
    templatesRetrieved: number;
    cacheHit: boolean;
    latencyMs: number;
  };
}

/**
 * Policy rules pack retrieved from Pinecone
 */
export interface PolicyRulesPack {
  duration: PolicyRule[];
  meal: PolicyRule[];
  energy: PolicyRule[];
  dedup: PolicyRule[];
  travel: PolicyRule[];
  all: PolicyRule[];
}

/**
 * Repair playbooks pack retrieved from Pinecone
 */
export interface RepairPlaybooksPack {
  duplicate: RepairPlaybook[];
  duration: RepairPlaybook[];
  travel: RepairPlaybook[];
  anchor: RepairPlaybook[];
}

// =============================================================================
// PINECONE QUERY TYPES
// =============================================================================

/**
 * Pinecone query configuration
 */
export interface PineconeQueryConfig {
  namespace: 'city_knowledge' | 'policy_rules' | 'repair_playbooks';
  query: string;
  topK: number;
  filter?: Record<string, any>;
  includeMetadata?: boolean;
}

/**
 * Pinecone query result
 */
export interface PineconeQueryResult<T> {
  matches: Array<{
    id: string;
    score: number;
    metadata: T;
  }>;
  latencyMs: number;
}

// =============================================================================
// EMBEDDING TYPES
// =============================================================================

/**
 * Embedding model configuration
 */
export interface EmbeddingConfig {
  model: 'text-embedding-3-small' | 'text-embedding-3-large';
  dimensions: number;
}

/**
 * Default embedding configuration
 */
export const DEFAULT_EMBEDDING_CONFIG: EmbeddingConfig = {
  model: 'text-embedding-3-small',
  dimensions: 1536,
};

// =============================================================================
// INDEX CONFIGURATION
// =============================================================================

/**
 * Pinecone index configuration
 */
export const PINECONE_INDEX_CONFIG = {
  indexName: 'wandr-knowledge',
  namespaces: {
    cityKnowledge: 'city_knowledge',
    policyRules: 'policy_rules',
    repairPlaybooks: 'repair_playbooks',
  },
  dimensions: 1536, // text-embedding-3-small
  metric: 'cosine' as const,
};
