/**
 * Cohere Rerank Service
 *
 * Semantic reranking service using Cohere's Rerank API.
 * Improves quality of search and recommendation results by
 * reranking based on semantic relevance to user query/goals.
 *
 * @module infrastructure/external/rerank/CohereRerankService
 */

import {
  IRerankService,
  RerankDocument,
  RerankOptions,
  RerankResponse,
  RerankResult,
} from '../../../domain/services/IRerankService';
import { logger } from '../../../shared/logger';
import { config } from '../../../config';

/**
 * Cohere API response types
 */
interface CohereRerankResult {
  index: number;
  relevance_score: number;
}

interface CohereRerankResponse {
  id: string;
  results: CohereRerankResult[];
  meta?: {
    api_version: {
      version: string;
    };
    billed_units?: {
      search_units: number;
    };
  };
}

/**
 * Cohere Rerank Service Implementation
 *
 * Uses Cohere's Rerank API for semantic document reranking.
 * Supports multiple models and configurable options.
 */
export class CohereRerankService implements IRerankService {
  private apiKey: string | undefined;
  private baseUrl = 'https://api.cohere.ai/v1';
  private defaultModel = 'rerank-english-v3.0';

  constructor() {
    this.apiKey = config.ai.cohere.apiKey;

    if (this.apiKey) {
      logger.info('Cohere Rerank service configured');
    } else {
      logger.warn('Cohere Rerank service not configured - missing API key');
    }
  }

  /**
   * Check if Cohere service is available
   */
  async isAvailable(): Promise<boolean> {
    if (!this.apiKey) {
      return false;
    }

    try {
      // Test with a minimal rerank request
      const response = await fetch(`${this.baseUrl}/rerank`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.defaultModel,
          query: 'test',
          documents: ['test document'],
          top_n: 1,
        }),
      });

      return response.ok;
    } catch (error) {
      logger.error('Cohere availability check failed', { error });
      return false;
    }
  }

  /**
   * Rerank documents based on query relevance
   */
  async rerank(
    query: string,
    documents: RerankDocument[],
    options: RerankOptions = {}
  ): Promise<RerankResponse> {
    if (!this.apiKey) {
      throw new Error('Cohere Rerank service not configured');
    }

    if (documents.length === 0) {
      return {
        results: [],
        processingTimeMs: 0,
        model: options.model || this.defaultModel,
      };
    }

    const startTime = Date.now();

    try {
      // Extract text from documents for Cohere API
      const documentTexts = documents.map((doc) => doc.text);

      const requestBody: Record<string, unknown> = {
        model: options.model || this.defaultModel,
        query,
        documents: documentTexts,
        top_n: options.topN || documents.length,
        return_documents: false, // We already have the documents
      };

      if (options.maxTokens) {
        requestBody.max_chunks_per_doc = Math.ceil(options.maxTokens / 256);
      }

      const response = await fetch(`${this.baseUrl}/rerank`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      const processingTimeMs = Date.now() - startTime;

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({})) as { message?: string };
        throw new Error(
          errorData.message || `Cohere API error: ${response.status}`
        );
      }

      const result = await response.json() as CohereRerankResponse;

      // Transform Cohere results to our format
      const rerankResults = this.transformResults(
        result.results,
        documents,
        options.minScore
      );

      return {
        results: rerankResults,
        processingTimeMs,
        model: options.model || this.defaultModel,
        tokensUsed: result.meta?.billed_units?.search_units,
      };
    } catch (error) {
      logger.error('Cohere rerank failed', { error, query });
      throw error;
    }
  }

  /**
   * Transform Cohere results to our format
   */
  private transformResults(
    cohereResults: CohereRerankResult[],
    originalDocuments: RerankDocument[],
    minScore?: number
  ): RerankResult[] {
    return cohereResults
      .map((result) => ({
        id: originalDocuments[result.index].id,
        originalIndex: result.index,
        relevanceScore: result.relevance_score,
        document: originalDocuments[result.index],
      }))
      .filter((r) => !minScore || r.relevanceScore >= minScore)
      .sort((a, b) => b.relevanceScore - a.relevanceScore);
  }
}

/**
 * Contact-specific reranking helper
 *
 * Formats contact data for reranking based on user goals.
 */
export function formatContactForRerank(contact: {
  id: string;
  name: string;
  company?: string;
  jobTitle?: string;
  sectors?: string[];
  skills?: string[];
  interests?: string[];
  bio?: string;
}): RerankDocument {
  const parts: string[] = [];

  parts.push(`${contact.name}`);

  if (contact.jobTitle) {
    parts.push(`- ${contact.jobTitle}`);
  }

  if (contact.company) {
    parts.push(`at ${contact.company}`);
  }

  if (contact.sectors && contact.sectors.length > 0) {
    parts.push(`Sectors: ${contact.sectors.join(', ')}`);
  }

  if (contact.skills && contact.skills.length > 0) {
    parts.push(`Skills: ${contact.skills.join(', ')}`);
  }

  if (contact.interests && contact.interests.length > 0) {
    parts.push(`Interests: ${contact.interests.join(', ')}`);
  }

  if (contact.bio) {
    parts.push(contact.bio);
  }

  return {
    id: contact.id,
    text: parts.join('. '),
    metadata: {
      name: contact.name,
      company: contact.company,
      jobTitle: contact.jobTitle,
    },
  };
}

/**
 * Build rerank query from user goals
 */
export function buildRerankQuery(user: {
  goals?: string[];
  sectors?: string[];
  skills?: string[];
  interests?: string[];
}): string {
  const parts: string[] = [];

  if (user.goals && user.goals.length > 0) {
    parts.push(`Looking for: ${user.goals.join(', ')}`);
  }

  if (user.sectors && user.sectors.length > 0) {
    parts.push(`Working in: ${user.sectors.join(', ')}`);
  }

  if (user.skills && user.skills.length > 0) {
    parts.push(`With expertise in: ${user.skills.join(', ')}`);
  }

  if (user.interests && user.interests.length > 0) {
    parts.push(`Interested in: ${user.interests.join(', ')}`);
  }

  return parts.join('. ') || 'Professional networking connection';
}
