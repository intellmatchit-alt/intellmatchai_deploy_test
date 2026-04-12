/**
 * Embedding Service
 *
 * Generates and manages vector embeddings for semantic similarity matching.
 * Uses OpenAI's text-embedding-3-small model for efficient embeddings.
 * Caches embeddings in Redis for performance.
 *
 * @module infrastructure/external/embedding/EmbeddingService
 */

import { config } from '../../../config';
import { logger } from '../../../shared/logger';
import { cacheService } from '../../cache/CacheService';

/**
 * Embedding model configuration
 */
const EMBEDDING_MODEL = 'text-embedding-3-small';
const EMBEDDING_DIMENSIONS = 1536;
const OPENAI_EMBEDDINGS_URL = 'https://api.openai.com/v1/embeddings';

/**
 * Cache configuration for embeddings
 */
const CACHE_TTL = {
  USER_EMBEDDING: 86400,      // 24 hours - user profile embeddings
  CONTACT_EMBEDDING: 86400,   // 24 hours - contact profile embeddings
  BIO_EMBEDDING: 43200,       // 12 hours - bio/description embeddings
};

const CACHE_KEYS = {
  USER_EMBEDDING: 'embedding:user:',
  CONTACT_EMBEDDING: 'embedding:contact:',
  BIO_EMBEDDING: 'embedding:bio:',
};

/**
 * Profile data for generating embeddings
 */
export interface ProfileEmbeddingInput {
  id: string;
  type: 'user' | 'contact';
  fullName?: string;
  bio?: string;
  jobTitle?: string;
  company?: string;
  sectors?: string[];
  skills?: string[];
  interests?: string[];
  hobbies?: string[];
  goals?: string[];
}

/**
 * Embedding result with vector and metadata
 */
export interface EmbeddingResult {
  id: string;
  type: 'user' | 'contact';
  embedding: number[];
  textHash: string;
  generatedAt: Date;
}

/**
 * Similarity result between two profiles
 */
export interface SimilarityResult {
  sourceId: string;
  targetId: string;
  similarity: number;
  normalizedScore: number; // 0-100 scale
}

/**
 * Embedding Service
 *
 * Handles vector embedding generation and similarity calculations.
 */
export class EmbeddingService {
  private isEnabled: boolean;

  constructor() {
    this.isEnabled = !!(config.ai.openai.enabled && config.ai.openai.apiKey);

    if (this.isEnabled) {
      logger.info('EmbeddingService initialized with OpenAI', {
        model: EMBEDDING_MODEL,
        dimensions: EMBEDDING_DIMENSIONS,
      });
    } else {
      logger.warn('EmbeddingService disabled - OpenAI API key not configured');
    }
  }

  /**
   * Check if embedding service is available
   */
  isAvailable(): boolean {
    return this.isEnabled;
  }

  /**
   * Generate embedding for a profile
   */
  async generateProfileEmbedding(profile: ProfileEmbeddingInput): Promise<EmbeddingResult | null> {
    if (!this.isEnabled) {
      return null;
    }

    // Check cache first
    const cacheKey = this.getCacheKey(profile.type, profile.id);
    const textToEmbed = this.profileToText(profile);
    const textHash = this.hashText(textToEmbed);

    // Try to get cached embedding
    const cached = await cacheService.get<EmbeddingResult>(cacheKey);
    if (cached && cached.textHash === textHash) {
      logger.debug('Returning cached embedding', { id: profile.id, type: profile.type });
      return cached;
    }

    try {
      // Generate new embedding
      const embedding = await this.callEmbeddingAPI(textToEmbed);

      const result: EmbeddingResult = {
        id: profile.id,
        type: profile.type,
        embedding,
        textHash,
        generatedAt: new Date(),
      };

      // Cache the result
      const ttl = profile.type === 'user' ? CACHE_TTL.USER_EMBEDDING : CACHE_TTL.CONTACT_EMBEDDING;
      await cacheService.set(cacheKey, result, ttl);

      logger.debug('Generated and cached embedding', { id: profile.id, type: profile.type });
      return result;
    } catch (error) {
      logger.error('Failed to generate embedding', {
        id: profile.id,
        type: profile.type,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return null;
    }
  }

  /**
   * Generate embeddings for multiple profiles in batch
   */
  async generateBatchEmbeddings(profiles: ProfileEmbeddingInput[]): Promise<Map<string, EmbeddingResult>> {
    const results = new Map<string, EmbeddingResult>();

    if (!this.isEnabled || profiles.length === 0) {
      return results;
    }

    // Check cache first for all profiles
    const uncachedProfiles: ProfileEmbeddingInput[] = [];
    const textMap = new Map<string, string>();

    for (const profile of profiles) {
      const cacheKey = this.getCacheKey(profile.type, profile.id);
      const textToEmbed = this.profileToText(profile);
      const textHash = this.hashText(textToEmbed);
      textMap.set(profile.id, textToEmbed);

      const cached = await cacheService.get<EmbeddingResult>(cacheKey);
      if (cached && cached.textHash === textHash) {
        results.set(profile.id, cached);
      } else {
        uncachedProfiles.push(profile);
      }
    }

    // Generate embeddings for uncached profiles
    if (uncachedProfiles.length > 0) {
      const texts = uncachedProfiles.map(p => textMap.get(p.id)!);

      try {
        const embeddings = await this.callBatchEmbeddingAPI(texts);

        for (let i = 0; i < uncachedProfiles.length; i++) {
          const profile = uncachedProfiles[i];
          const embedding = embeddings[i];

          if (embedding) {
            const result: EmbeddingResult = {
              id: profile.id,
              type: profile.type,
              embedding,
              textHash: this.hashText(textMap.get(profile.id)!),
              generatedAt: new Date(),
            };

            results.set(profile.id, result);

            // Cache the result
            const cacheKey = this.getCacheKey(profile.type, profile.id);
            const ttl = profile.type === 'user' ? CACHE_TTL.USER_EMBEDDING : CACHE_TTL.CONTACT_EMBEDDING;
            await cacheService.set(cacheKey, result, ttl);
          }
        }

        logger.debug('Generated batch embeddings', {
          count: uncachedProfiles.length,
          cached: profiles.length - uncachedProfiles.length,
        });
      } catch (error) {
        logger.error('Failed to generate batch embeddings', {
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return results;
  }

  /**
   * Calculate semantic similarity between two profiles
   */
  async calculateSimilarity(
    profile1: ProfileEmbeddingInput,
    profile2: ProfileEmbeddingInput
  ): Promise<SimilarityResult | null> {
    const [embedding1, embedding2] = await Promise.all([
      this.generateProfileEmbedding(profile1),
      this.generateProfileEmbedding(profile2),
    ]);

    if (!embedding1 || !embedding2) {
      return null;
    }

    const similarity = this.cosineSimilarity(embedding1.embedding, embedding2.embedding);

    // Normalize to 0-100 scale (cosine similarity is -1 to 1, but usually 0-1 for text)
    const normalizedScore = Math.round(Math.max(0, similarity) * 100);

    return {
      sourceId: profile1.id,
      targetId: profile2.id,
      similarity,
      normalizedScore,
    };
  }

  /**
   * Calculate similarity scores for one profile against many others
   */
  async calculateBulkSimilarity(
    sourceProfile: ProfileEmbeddingInput,
    targetProfiles: ProfileEmbeddingInput[]
  ): Promise<SimilarityResult[]> {
    const results: SimilarityResult[] = [];

    if (!this.isEnabled || targetProfiles.length === 0) {
      return results;
    }

    // Generate source embedding
    const sourceEmbedding = await this.generateProfileEmbedding(sourceProfile);
    if (!sourceEmbedding) {
      return results;
    }

    // Generate target embeddings in batch
    const targetEmbeddings = await this.generateBatchEmbeddings(targetProfiles);

    // Calculate similarities
    for (const profile of targetProfiles) {
      const targetEmbedding = targetEmbeddings.get(profile.id);
      if (targetEmbedding) {
        const similarity = this.cosineSimilarity(
          sourceEmbedding.embedding,
          targetEmbedding.embedding
        );
        const normalizedScore = Math.round(Math.max(0, similarity) * 100);

        results.push({
          sourceId: sourceProfile.id,
          targetId: profile.id,
          similarity,
          normalizedScore,
        });
      }
    }

    // Sort by similarity descending
    results.sort((a, b) => b.similarity - a.similarity);

    return results;
  }

  /**
   * Invalidate cached embedding for a profile
   */
  async invalidateEmbedding(type: 'user' | 'contact', id: string): Promise<void> {
    const cacheKey = this.getCacheKey(type, id);
    await cacheService.delete(cacheKey);
    logger.debug('Invalidated embedding cache', { type, id });
  }

  // ============================================
  // Private Helper Methods
  // ============================================

  /**
   * Convert profile to text for embedding
   */
  private profileToText(profile: ProfileEmbeddingInput): string {
    const parts: string[] = [];

    if (profile.fullName) {
      parts.push(`Name: ${profile.fullName}`);
    }

    if (profile.jobTitle) {
      parts.push(`Role: ${profile.jobTitle}`);
    }

    if (profile.company) {
      parts.push(`Company: ${profile.company}`);
    }

    if (profile.bio) {
      parts.push(`About: ${profile.bio}`);
    }

    if (profile.sectors && profile.sectors.length > 0) {
      parts.push(`Industries: ${profile.sectors.join(', ')}`);
    }

    if (profile.skills && profile.skills.length > 0) {
      parts.push(`Skills: ${profile.skills.join(', ')}`);
    }

    if (profile.interests && profile.interests.length > 0) {
      parts.push(`Interests: ${profile.interests.join(', ')}`);
    }

    if (profile.hobbies && profile.hobbies.length > 0) {
      parts.push(`Hobbies: ${profile.hobbies.join(', ')}`);
    }

    if (profile.goals && profile.goals.length > 0) {
      parts.push(`Goals: ${profile.goals.join(', ')}`);
    }

    return parts.join('. ');
  }

  /**
   * Simple hash function for text (for cache invalidation)
   */
  private hashText(text: string): string {
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return hash.toString(16);
  }

  /**
   * Get cache key for profile embedding
   */
  private getCacheKey(type: 'user' | 'contact', id: string): string {
    const prefix = type === 'user' ? CACHE_KEYS.USER_EMBEDDING : CACHE_KEYS.CONTACT_EMBEDDING;
    return `${prefix}${id}`;
  }

  /**
   * Call OpenAI embeddings API
   */
  private async callEmbeddingAPI(text: string): Promise<number[]> {
    const response = await fetch(OPENAI_EMBEDDINGS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.ai.openai.apiKey}`,
      },
      body: JSON.stringify({
        model: EMBEDDING_MODEL,
        input: text,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI embeddings API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json() as {
      data?: Array<{ embedding?: number[] }>;
    };

    const embedding = data.data?.[0]?.embedding;
    if (!embedding) {
      throw new Error('No embedding in response');
    }

    return embedding;
  }

  /**
   * Call OpenAI embeddings API for batch processing
   */
  private async callBatchEmbeddingAPI(texts: string[]): Promise<number[][]> {
    // OpenAI supports up to 2048 inputs in a single request
    const batchSize = 100;
    const results: number[][] = [];

    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);

      const response = await fetch(OPENAI_EMBEDDINGS_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.ai.openai.apiKey}`,
        },
        body: JSON.stringify({
          model: EMBEDDING_MODEL,
          input: batch,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenAI embeddings API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json() as {
        data?: Array<{ embedding?: number[]; index: number }>;
      };

      // Sort by index to maintain order
      const sortedData = (data.data || []).sort((a, b) => a.index - b.index);

      for (const item of sortedData) {
        if (item.embedding) {
          results.push(item.embedding);
        }
      }
    }

    return results;
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error('Vectors must have the same length');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    const magnitude = Math.sqrt(normA) * Math.sqrt(normB);

    if (magnitude === 0) {
      return 0;
    }

    return dotProduct / magnitude;
  }
}

// Export singleton instance
export const embeddingService = new EmbeddingService();
