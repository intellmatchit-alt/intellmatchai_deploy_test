/**
 * Recombee Recommendation Service
 *
 * ML-powered recommendation engine using Recombee API.
 * Provides personalized contact recommendations using hybrid
 * collaborative + content-based filtering.
 *
 * @module infrastructure/external/recommendation/RecombeeService
 */

import {
  IRecommendationService,
  ItemProperties,
  UserProperties,
  InteractionType,
  RecommendationResult,
  RecommendationOptions,
} from '../../../domain/services/IRecommendationService';
import { logger } from '../../../shared/logger';
import { config } from '../../../config';

/**
 * Recombee API request types
 */
interface RecombeeRequest {
  cascadeCreate?: boolean;
  [key: string]: unknown;
}

/**
 * Recombee recommendation response
 */
interface RecombeeRecommendation {
  id: string;
  values?: Record<string, unknown>;
}

/**
 * Recombee Service Implementation
 *
 * Uses Recombee's REST API for ML-powered recommendations.
 * Supports user/item management, interaction tracking, and recommendations.
 */
export class RecombeeService implements IRecommendationService {
  private databaseId: string | undefined;
  private secretToken: string | undefined;
  private baseUrl: string;
  private region: string = 'us-west';

  constructor() {
    this.databaseId = config.ai.recombee.databaseId;
    this.secretToken = config.ai.recombee.secretToken;
    this.baseUrl = `https://rapi.recombee.com`;

    if (this.databaseId && this.secretToken) {
      logger.info('Recombee service configured', { databaseId: this.databaseId });
    } else {
      logger.warn('Recombee service not configured - missing credentials');
    }
  }

  /**
   * Check if Recombee service is available
   */
  async isAvailable(): Promise<boolean> {
    if (!this.databaseId || !this.secretToken) {
      return false;
    }

    try {
      // Test with a simple API call - list items (count=0 to minimize data)
      // Note: trailing slash is required for Recombee endpoints
      await this.makeRequest('GET', 'items/list/', { count: 0 });
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Recombee availability check failed', {
        error: errorMessage,
        databaseId: this.databaseId,
      });
      return false;
    }
  }

  /**
   * Add or update user properties in Recombee
   */
  async setUserProperties(userId: string, properties: UserProperties): Promise<void> {
    if (!this.isConfigured()) {
      logger.warn('Recombee not configured, skipping setUserProperties');
      return;
    }

    try {
      const recombeeProps = this.transformProperties(properties);
      await this.makeRequest('POST', `users/${encodeURIComponent(userId)}`, {
        ...recombeeProps,
        cascadeCreate: true,
      });
      logger.debug('User properties set in Recombee', { userId });
    } catch (error) {
      logger.error('Failed to set user properties in Recombee', { userId, error });
      throw error;
    }
  }

  /**
   * Add or update item properties in Recombee
   */
  async setItemProperties(itemId: string, properties: ItemProperties): Promise<void> {
    if (!this.isConfigured()) {
      logger.warn('Recombee not configured, skipping setItemProperties');
      return;
    }

    try {
      const recombeeProps = this.transformProperties(properties);
      await this.makeRequest('POST', `items/${encodeURIComponent(itemId)}`, {
        ...recombeeProps,
        cascadeCreate: true,
      });
      logger.debug('Item properties set in Recombee', { itemId });
    } catch (error) {
      logger.error('Failed to set item properties in Recombee', { itemId, error });
      throw error;
    }
  }

  /**
   * Delete a user from Recombee
   */
  async deleteUser(userId: string): Promise<void> {
    if (!this.isConfigured()) return;

    try {
      await this.makeRequest('DELETE', `users/${encodeURIComponent(userId)}`);
      logger.debug('User deleted from Recombee', { userId });
    } catch (error) {
      logger.error('Failed to delete user from Recombee', { userId, error });
      throw error;
    }
  }

  /**
   * Delete an item from Recombee
   */
  async deleteItem(itemId: string): Promise<void> {
    if (!this.isConfigured()) return;

    try {
      await this.makeRequest('DELETE', `items/${encodeURIComponent(itemId)}`);
      logger.debug('Item deleted from Recombee', { itemId });
    } catch (error) {
      logger.error('Failed to delete item from Recombee', { itemId, error });
      throw error;
    }
  }

  /**
   * Track an interaction event in Recombee
   */
  async trackInteraction(
    userId: string,
    itemId: string,
    interactionType: InteractionType,
    timestamp?: Date,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    if (!this.isConfigured()) {
      logger.warn('Recombee not configured, skipping interaction tracking');
      return;
    }

    try {
      const endpoint = this.getInteractionEndpoint(interactionType);
      const body: RecombeeRequest = {
        userId,
        itemId,
        cascadeCreate: true,
        timestamp: timestamp?.toISOString(),
        ...metadata,
      };

      await this.makeRequest('POST', endpoint, body);
      logger.debug('Interaction tracked in Recombee', { userId, itemId, interactionType });
    } catch (error) {
      logger.error('Failed to track interaction in Recombee', {
        userId,
        itemId,
        interactionType,
        error,
      });
      throw error;
    }
  }

  /**
   * Get personalized recommendations for a user
   */
  async getRecommendations(
    userId: string,
    options: RecommendationOptions = {}
  ): Promise<RecommendationResult[]> {
    if (!this.isConfigured()) {
      logger.warn('Recombee not configured, returning empty recommendations');
      return [];
    }

    try {
      const params: Record<string, unknown> = {
        count: options.count || 20,
        scenario: options.scenario || 'contact_match',
        returnProperties: options.returnProperties ?? true,
        cascadeCreate: true,
      };

      if (options.filter) {
        params.filter = options.filter;
      }
      if (options.booster) {
        params.booster = options.booster;
      }
      if (options.diversity !== undefined) {
        params.diversity = options.diversity;
      }
      if (options.rotationRate !== undefined) {
        params.rotationRate = options.rotationRate;
      }
      if (options.rotationTime !== undefined) {
        params.rotationTime = options.rotationTime;
      }
      if (options.includedProperties) {
        params.includedProperties = options.includedProperties;
      }

      const response = await this.makeRequest<{ recomms: RecombeeRecommendation[] }>(
        'POST',
        `recomms/users/${encodeURIComponent(userId)}/items`,
        params
      );

      return this.transformRecommendations(response.recomms, options.minScore);
    } catch (error) {
      logger.error('Failed to get recommendations from Recombee', { userId, error });
      return [];
    }
  }

  /**
   * Get similar items to a given item
   */
  async getSimilarItems(
    itemId: string,
    options: RecommendationOptions = {}
  ): Promise<RecommendationResult[]> {
    if (!this.isConfigured()) {
      return [];
    }

    try {
      const params: Record<string, unknown> = {
        count: options.count || 10,
        scenario: options.scenario || 'similar_contacts',
        returnProperties: options.returnProperties ?? true,
      };

      if (options.filter) {
        params.filter = options.filter;
      }

      const response = await this.makeRequest<{ recomms: RecombeeRecommendation[] }>(
        'POST',
        `recomms/items/${encodeURIComponent(itemId)}/items`,
        params
      );

      return this.transformRecommendations(response.recomms, options.minScore);
    } catch (error) {
      logger.error('Failed to get similar items from Recombee', { itemId, error });
      return [];
    }
  }

  /**
   * Get items commonly viewed/interacted with together
   */
  async getRelatedItems(
    itemId: string,
    options: RecommendationOptions = {}
  ): Promise<RecommendationResult[]> {
    // Recombee uses same endpoint for item-to-item recommendations
    return this.getSimilarItems(itemId, {
      ...options,
      scenario: options.scenario || 'frequently_viewed_together',
    });
  }

  /**
   * Batch sync users to Recombee
   */
  async batchSyncUsers(
    users: Array<{ userId: string; properties: UserProperties }>
  ): Promise<void> {
    if (!this.isConfigured()) {
      logger.warn('Recombee not configured, skipping batch user sync');
      return;
    }

    try {
      const requests = users.map((user) => ({
        method: 'POST',
        path: `/users/${encodeURIComponent(user.userId)}`,
        params: {
          ...this.transformProperties(user.properties),
          cascadeCreate: true,
        },
      }));

      await this.makeRequest('POST', 'batch', { requests });
      logger.info('Batch user sync completed', { count: users.length });
    } catch (error) {
      logger.error('Failed to batch sync users to Recombee', { error });
      throw error;
    }
  }

  /**
   * Batch sync items to Recombee
   */
  async batchSyncItems(
    items: Array<{ itemId: string; properties: ItemProperties }>
  ): Promise<void> {
    if (!this.isConfigured()) {
      logger.warn('Recombee not configured, skipping batch item sync');
      return;
    }

    try {
      const requests = items.map((item) => ({
        method: 'POST',
        path: `/items/${encodeURIComponent(item.itemId)}`,
        params: {
          ...this.transformProperties(item.properties),
          cascadeCreate: true,
        },
      }));

      await this.makeRequest('POST', 'batch', { requests });
      logger.info('Batch item sync completed', { count: items.length });
    } catch (error) {
      logger.error('Failed to batch sync items to Recombee', { error });
      throw error;
    }
  }

  /**
   * Check if service is configured
   */
  private isConfigured(): boolean {
    return !!(this.databaseId && this.secretToken);
  }

  /**
   * Make authenticated request to Recombee API
   */
  private async makeRequest<T = unknown>(
    method: string,
    endpoint: string,
    body?: Record<string, unknown>
  ): Promise<T> {
    const timestamp = Math.floor(Date.now() / 1000);

    // Ensure endpoint has trailing slash (Recombee API requirement)
    const normalizedEndpoint = endpoint.endsWith('/') ? endpoint : `${endpoint}/`;

    // Build query parameters for GET requests or empty for POST
    const queryParts: string[] = [];

    // For GET with body params, add them as query string
    if (method === 'GET' && body) {
      for (const [key, value] of Object.entries(body)) {
        if (value !== undefined) {
          queryParts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
        }
      }
    }

    // Add timestamp to query
    queryParts.push(`hmac_timestamp=${timestamp}`);

    // Build the path for signing (without protocol/host)
    const pathWithQuery = `/${this.databaseId}/${normalizedEndpoint}?${queryParts.join('&')}`;

    // Generate HMAC signature
    const signature = await this.generateSignature(pathWithQuery);

    // Add signature to query
    const fullQuery = `${queryParts.join('&')}&hmac_sign=${signature}`;
    const fullUrl = `${this.baseUrl}/${this.databaseId}/${normalizedEndpoint}?${fullQuery}`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    const response = await fetch(fullUrl, {
      method,
      headers,
      // For POST, send body as JSON; for GET, params are in query string
      body: method !== 'GET' && body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Recombee API error ${response.status}: ${error}`);
    }

    // Handle empty response
    const text = await response.text();
    if (!text) return {} as T;

    return JSON.parse(text) as T;
  }

  /**
   * Generate HMAC-SHA1 signature for Recombee API
   *
   * The signature is computed from the request URI without protocol and host,
   * including the hmac_timestamp parameter.
   */
  private async generateSignature(pathWithQuery: string): Promise<string> {
    const crypto = await import('crypto');
    const hmac = crypto.createHmac('sha1', this.secretToken!);
    hmac.update(pathWithQuery);
    return hmac.digest('hex');
  }

  /**
   * Transform properties to Recombee format
   */
  private transformProperties(
    properties: UserProperties | ItemProperties
  ): Record<string, unknown> {
    const transformed: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(properties)) {
      if (value === undefined || value === null) continue;

      // Convert arrays to Recombee set format
      if (Array.isArray(value)) {
        transformed[key] = value;
      } else if (value instanceof Date) {
        transformed[key] = value.toISOString();
      } else {
        transformed[key] = value;
      }
    }

    return transformed;
  }

  /**
   * Get Recombee endpoint for interaction type
   */
  private getInteractionEndpoint(type: InteractionType): string {
    const endpointMap: Record<InteractionType, string> = {
      view: 'detailviews',
      detail_view: 'detailviews',
      save: 'purchases',
      message: 'purchases',
      meeting: 'purchases',
      follow_up: 'purchases',
      introduced: 'purchases',
      dismiss: 'ratings', // with rating -1
      bookmark: 'bookmarks',
    };

    return endpointMap[type] || 'detailviews';
  }

  /**
   * Transform Recombee recommendations to our format
   */
  private transformRecommendations(
    recomms: RecombeeRecommendation[],
    minScore?: number
  ): RecommendationResult[] {
    return recomms
      .map((rec, index) => ({
        itemId: rec.id,
        // Recombee doesn't return explicit scores, derive from position
        score: 1 - index * 0.05,
        properties: rec.values as ItemProperties | undefined,
      }))
      .filter((r) => !minScore || r.score >= minScore);
  }
}
