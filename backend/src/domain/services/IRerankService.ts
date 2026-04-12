/**
 * Rerank Service Interface
 *
 * Defines the contract for semantic reranking services.
 * Implementations can use Cohere Rerank or other providers.
 *
 * @module domain/services/IRerankService
 */

/**
 * Document to be reranked
 */
export interface RerankDocument {
  /** Unique identifier */
  id: string;

  /** Text content to compare against query */
  text: string;

  /** Optional metadata for context */
  metadata?: Record<string, unknown>;
}

/**
 * Reranked result
 */
export interface RerankResult {
  /** Original document ID */
  id: string;

  /** Original index in input array */
  originalIndex: number;

  /** Relevance score (0-1) */
  relevanceScore: number;

  /** Original document */
  document: RerankDocument;
}

/**
 * Rerank options
 */
export interface RerankOptions {
  /** Number of top results to return */
  topN?: number;

  /** Model to use for reranking */
  model?: string;

  /** Maximum tokens per document */
  maxTokens?: number;

  /** Return documents with score above this threshold */
  minScore?: number;
}

/**
 * Rerank response
 */
export interface RerankResponse {
  /** Reranked results sorted by relevance */
  results: RerankResult[];

  /** Processing time in milliseconds */
  processingTimeMs: number;

  /** Model used for reranking */
  model: string;

  /** Tokens used */
  tokensUsed?: number;
}

/**
 * Rerank Service Interface
 *
 * Strategy pattern interface for semantic reranking.
 * Used to improve quality of search/recommendation results.
 */
export interface IRerankService {
  /**
   * Rerank documents based on query relevance
   *
   * @param query - The search query or context
   * @param documents - Documents to rerank
   * @param options - Reranking options
   * @returns Reranked results sorted by relevance
   */
  rerank(
    query: string,
    documents: RerankDocument[],
    options?: RerankOptions
  ): Promise<RerankResponse>;

  /**
   * Check if the service is available and configured
   *
   * @returns True if service can process requests
   */
  isAvailable(): Promise<boolean>;
}
