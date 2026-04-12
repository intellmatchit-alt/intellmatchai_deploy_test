/**
 * Recommendation Service Factory
 *
 * Creates the appropriate recommendation service based on configuration.
 * Uses Recombee when available, falls back to local recommendations.
 *
 * @module infrastructure/external/recommendation/RecommendationServiceFactory
 */

import {
  IRecommendationService,
  ItemProperties,
  UserProperties,
  InteractionType,
  RecommendationResult,
  RecommendationOptions,
} from '../../../domain/services/IRecommendationService';
import { RecombeeService } from './RecombeeService';
import { logger } from '../../../shared/logger';
import { config } from '../../../config';

/**
 * Recommendation service type
 */
export type RecommendationServiceType = 'recombee' | 'local' | 'auto';

/**
 * Local Recommendation Service (Fallback)
 *
 * Simple in-memory recommendation service when Recombee is not available.
 * Uses basic content-based filtering with cached data.
 */
class LocalRecommendationService implements IRecommendationService {
  private users: Map<string, UserProperties> = new Map();
  private items: Map<string, ItemProperties> = new Map();
  private interactions: Map<string, Array<{ itemId: string; type: InteractionType; timestamp: Date }>> = new Map();

  async isAvailable(): Promise<boolean> {
    return true;
  }

  async setUserProperties(userId: string, properties: UserProperties): Promise<void> {
    this.users.set(userId, properties);
  }

  async setItemProperties(itemId: string, properties: ItemProperties): Promise<void> {
    this.items.set(itemId, properties);
  }

  async deleteUser(userId: string): Promise<void> {
    this.users.delete(userId);
    this.interactions.delete(userId);
  }

  async deleteItem(itemId: string): Promise<void> {
    this.items.delete(itemId);
  }

  async trackInteraction(
    userId: string,
    itemId: string,
    interactionType: InteractionType,
    timestamp?: Date
  ): Promise<void> {
    const userInteractions = this.interactions.get(userId) || [];
    userInteractions.push({
      itemId,
      type: interactionType,
      timestamp: timestamp || new Date(),
    });
    this.interactions.set(userId, userInteractions);
  }

  async getRecommendations(
    userId: string,
    options: RecommendationOptions = {}
  ): Promise<RecommendationResult[]> {
    const user = this.users.get(userId);
    if (!user) {
      return [];
    }

    const userInteractions = this.interactions.get(userId) || [];
    const interactedItems = new Set(userInteractions.map((i) => i.itemId));

    // Simple content-based scoring
    const results: RecommendationResult[] = [];

    for (const [itemId, item] of this.items.entries()) {
      // Skip items user already interacted with
      if (interactedItems.has(itemId)) continue;

      const score = this.calculateContentScore(user, item);
      if (score > 0) {
        results.push({
          itemId,
          score,
          properties: item,
        });
      }
    }

    // Sort by score descending
    results.sort((a, b) => b.score - a.score);

    // Apply limit
    const limit = options.count || 20;
    return results.slice(0, limit);
  }

  async getSimilarItems(
    itemId: string,
    options: RecommendationOptions = {}
  ): Promise<RecommendationResult[]> {
    const sourceItem = this.items.get(itemId);
    if (!sourceItem) {
      return [];
    }

    const results: RecommendationResult[] = [];

    for (const [id, item] of this.items.entries()) {
      if (id === itemId) continue;

      const score = this.calculateItemSimilarity(sourceItem, item);
      if (score > 0) {
        results.push({
          itemId: id,
          score,
          properties: item,
        });
      }
    }

    results.sort((a, b) => b.score - a.score);
    const limit = options.count || 10;
    return results.slice(0, limit);
  }

  async getRelatedItems(
    itemId: string,
    options: RecommendationOptions = {}
  ): Promise<RecommendationResult[]> {
    return this.getSimilarItems(itemId, options);
  }

  async batchSyncUsers(
    users: Array<{ userId: string; properties: UserProperties }>
  ): Promise<void> {
    for (const { userId, properties } of users) {
      this.users.set(userId, properties);
    }
  }

  async batchSyncItems(
    items: Array<{ itemId: string; properties: ItemProperties }>
  ): Promise<void> {
    for (const { itemId, properties } of items) {
      this.items.set(itemId, properties);
    }
  }

  /**
   * Calculate content-based similarity score
   */
  private calculateContentScore(user: UserProperties, item: ItemProperties): number {
    let score = 0;
    let factors = 0;

    // Sector overlap
    if (user.sectors && item.sectors) {
      const overlap = this.calculateOverlap(user.sectors, item.sectors);
      score += overlap * 0.3;
      factors++;
    }

    // Skill overlap
    if (user.skills && item.skills) {
      const overlap = this.calculateOverlap(user.skills, item.skills);
      score += overlap * 0.25;
      factors++;
    }

    // Interest overlap
    if (user.interests && item.interests) {
      const overlap = this.calculateOverlap(user.interests, item.interests);
      score += overlap * 0.15;
      factors++;
    }

    // Location match
    if (user.location && item.location && user.location === item.location) {
      score += 0.1;
      factors++;
    }

    // Company match (might want to avoid same company)
    if (user.company && item.company && user.company !== item.company) {
      score += 0.05;
      factors++;
    }

    return factors > 0 ? score : 0;
  }

  /**
   * Calculate item-to-item similarity
   */
  private calculateItemSimilarity(item1: ItemProperties, item2: ItemProperties): number {
    let score = 0;

    if (item1.sectors && item2.sectors) {
      score += this.calculateOverlap(item1.sectors, item2.sectors) * 0.4;
    }

    if (item1.skills && item2.skills) {
      score += this.calculateOverlap(item1.skills, item2.skills) * 0.3;
    }

    if (item1.interests && item2.interests) {
      score += this.calculateOverlap(item1.interests, item2.interests) * 0.2;
    }

    if (item1.company === item2.company) {
      score += 0.1;
    }

    return score;
  }

  /**
   * Calculate Jaccard-like overlap between two arrays
   */
  private calculateOverlap(arr1: string[], arr2: string[]): number {
    const set1 = new Set(arr1.map((s) => s.toLowerCase()));
    const set2 = new Set(arr2.map((s) => s.toLowerCase()));

    let intersection = 0;
    for (const item of set1) {
      if (set2.has(item)) intersection++;
    }

    const union = set1.size + set2.size - intersection;
    return union > 0 ? intersection / union : 0;
  }
}

/**
 * Recommendation Service Factory
 *
 * Creates recommendation service instances based on configuration.
 */
export class RecommendationServiceFactory {
  private static recombeeInstance: RecombeeService | null = null;
  private static localInstance: LocalRecommendationService | null = null;

  /**
   * Create a recommendation service instance
   */
  static create(type: RecommendationServiceType = 'auto'): IRecommendationService {
    switch (type) {
      case 'recombee':
        return this.getRecombeeService();

      case 'local':
        return this.getLocalService();

      case 'auto':
      default:
        return this.getBestAvailable();
    }
  }

  private static getRecombeeService(): RecombeeService {
    if (!this.recombeeInstance) {
      this.recombeeInstance = new RecombeeService();
      logger.info('Created Recombee recommendation service instance');
    }
    return this.recombeeInstance;
  }

  private static getLocalService(): LocalRecommendationService {
    if (!this.localInstance) {
      this.localInstance = new LocalRecommendationService();
      logger.info('Created local recommendation service instance');
    }
    return this.localInstance;
  }

  private static getBestAvailable(): IRecommendationService {
    const useRecombee = config.features.recombee;
    const recombeeConfigured =
      config.ai.recombee.databaseId && config.ai.recombee.secretToken;

    if (useRecombee && recombeeConfigured) {
      logger.info('Using Recombee recommendation service (cloud)');
      return this.getRecombeeService();
    }

    logger.info('Using local recommendation service (fallback)');
    return this.getLocalService();
  }

  static async checkAvailability(): Promise<{
    recombee: boolean;
    local: boolean;
    recommended: RecommendationServiceType;
  }> {
    const recombee = await this.getRecombeeService().isAvailable();
    const local = await this.getLocalService().isAvailable();

    return {
      recombee,
      local,
      recommended: recombee ? 'recombee' : 'local',
    };
  }
}

/**
 * Get default recommendation service instance
 */
export function getRecommendationService(): IRecommendationService {
  return RecommendationServiceFactory.create('auto');
}
