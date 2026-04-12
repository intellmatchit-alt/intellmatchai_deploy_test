/**
 * Rerank Service Factory
 *
 * Creates the appropriate rerank service based on configuration.
 * Uses Cohere when available, falls back to simple scoring.
 *
 * @module infrastructure/external/rerank/RerankServiceFactory
 */

import {
  IRerankService,
  RerankDocument,
  RerankOptions,
  RerankResponse,
  RerankResult,
} from '../../../domain/services/IRerankService';
import { CohereRerankService } from './CohereRerankService';
import { logger } from '../../../shared/logger';
import { config } from '../../../config';

/**
 * Rerank service type
 */
export type RerankServiceType = 'cohere' | 'simple' | 'auto';

/**
 * Simple Rerank Service (Fallback)
 *
 * Basic text-matching reranking when Cohere is not available.
 * Uses keyword matching and TF-IDF-like scoring.
 */
class SimpleRerankService implements IRerankService {
  async isAvailable(): Promise<boolean> {
    return true;
  }

  async rerank(
    query: string,
    documents: RerankDocument[],
    options: RerankOptions = {}
  ): Promise<RerankResponse> {
    const startTime = Date.now();

    if (documents.length === 0) {
      return {
        results: [],
        processingTimeMs: 0,
        model: 'simple-keyword',
      };
    }

    // Tokenize query into keywords
    const queryTerms = this.tokenize(query);

    // Score each document
    const scoredDocs = documents.map((doc, index) => {
      const docTerms = this.tokenize(doc.text);
      const score = this.calculateScore(queryTerms, docTerms);

      return {
        id: doc.id,
        originalIndex: index,
        relevanceScore: score,
        document: doc,
      };
    });

    // Sort by score descending
    scoredDocs.sort((a, b) => b.relevanceScore - a.relevanceScore);

    // Apply filters
    let results = scoredDocs;

    if (options.minScore !== undefined) {
      results = results.filter((r) => r.relevanceScore >= options.minScore!);
    }

    if (options.topN !== undefined) {
      results = results.slice(0, options.topN);
    }

    return {
      results,
      processingTimeMs: Date.now() - startTime,
      model: 'simple-keyword',
    };
  }

  /**
   * Tokenize text into normalized terms
   */
  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter((term) => term.length > 2);
  }

  /**
   * Calculate relevance score using term overlap
   */
  private calculateScore(queryTerms: string[], docTerms: string[]): number {
    if (queryTerms.length === 0 || docTerms.length === 0) {
      return 0;
    }

    const docTermSet = new Set(docTerms);
    let matchCount = 0;
    let weightedScore = 0;

    for (const term of queryTerms) {
      if (docTermSet.has(term)) {
        matchCount++;
        // Weight earlier query terms higher (they're usually more important)
        weightedScore += 1 / (queryTerms.indexOf(term) + 1);
      }
    }

    // Combine match ratio with weighted position score
    const matchRatio = matchCount / queryTerms.length;
    const normalizedWeighted = weightedScore / queryTerms.length;

    // Score between 0 and 1
    return matchRatio * 0.6 + normalizedWeighted * 0.4;
  }
}

/**
 * Rerank Service Factory
 *
 * Creates rerank service instances based on configuration.
 */
export class RerankServiceFactory {
  private static cohereInstance: CohereRerankService | null = null;
  private static simpleInstance: SimpleRerankService | null = null;

  /**
   * Create a rerank service instance
   */
  static create(type: RerankServiceType = 'auto'): IRerankService {
    switch (type) {
      case 'cohere':
        return this.getCohereService();

      case 'simple':
        return this.getSimpleService();

      case 'auto':
      default:
        return this.getBestAvailable();
    }
  }

  private static getCohereService(): CohereRerankService {
    if (!this.cohereInstance) {
      this.cohereInstance = new CohereRerankService();
      logger.info('Created Cohere rerank service instance');
    }
    return this.cohereInstance;
  }

  private static getSimpleService(): SimpleRerankService {
    if (!this.simpleInstance) {
      this.simpleInstance = new SimpleRerankService();
      logger.info('Created simple rerank service instance');
    }
    return this.simpleInstance;
  }

  private static getBestAvailable(): IRerankService {
    const useCohere = config.features.cohereRerank;
    const cohereConfigured = !!config.ai.cohere.apiKey;

    if (useCohere && cohereConfigured) {
      logger.info('Using Cohere rerank service (cloud)');
      return this.getCohereService();
    }

    logger.info('Using simple rerank service (fallback)');
    return this.getSimpleService();
  }

  static async checkAvailability(): Promise<{
    cohere: boolean;
    simple: boolean;
    recommended: RerankServiceType;
  }> {
    const cohere = await this.getCohereService().isAvailable();
    const simple = await this.getSimpleService().isAvailable();

    return {
      cohere,
      simple,
      recommended: cohere ? 'cohere' : 'simple',
    };
  }
}

/**
 * Get default rerank service instance
 */
export function getRerankService(): IRerankService {
  return RerankServiceFactory.create('auto');
}
