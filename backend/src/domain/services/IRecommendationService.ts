/**
 * Recommendation Service Interface
 *
 * Defines the contract for ML-powered recommendation services.
 * Implementations can use Recombee or other recommendation engines.
 *
 * @module domain/services/IRecommendationService
 */

/**
 * Item properties for recommendation engine
 */
export interface ItemProperties {
  /** Item sectors */
  sectors?: string[];

  /** Item skills */
  skills?: string[];

  /** Item interests */
  interests?: string[];

  /** Company name */
  company?: string;

  /** Job title */
  jobTitle?: string;

  /** Location */
  location?: string;

  /** Item type (e.g., 'contact', 'user') */
  itemType?: string;

  /** Last interaction timestamp */
  lastInteraction?: Date;

  /** Creation timestamp */
  createdAt?: Date;

  /** Custom properties */
  [key: string]: unknown;
}

/**
 * User properties for recommendation engine
 */
export interface UserProperties {
  /** User sectors */
  sectors?: string[];

  /** User skills */
  skills?: string[];

  /** User interests */
  interests?: string[];

  /** User goals */
  goals?: string[];

  /** Company name */
  company?: string;

  /** Job title */
  jobTitle?: string;

  /** Location */
  location?: string;

  /** Custom properties */
  [key: string]: unknown;
}

/**
 * Interaction type for tracking
 */
export type InteractionType =
  | 'view'           // Viewed the contact
  | 'detail_view'    // Viewed contact details
  | 'save'           // Saved/favorited the contact
  | 'message'        // Sent a message
  | 'meeting'        // Had a meeting
  | 'follow_up'      // Followed up
  | 'introduced'     // Made an introduction
  | 'dismiss'        // Dismissed from recommendations
  | 'bookmark';      // Bookmarked for later

/**
 * Recommendation result
 */
export interface RecommendationResult {
  /** Item ID */
  itemId: string;

  /** Recommendation score (0-1) */
  score: number;

  /** Item properties */
  properties?: ItemProperties;

  /** Recommendation reasons */
  reasons?: string[];
}

/**
 * Recommendation options
 */
export interface RecommendationOptions {
  /** Number of recommendations to return */
  count?: number;

  /** Scenario name for A/B testing */
  scenario?: string;

  /** Filter expression */
  filter?: string;

  /** Booster expression */
  booster?: string;

  /** Include item properties in response */
  returnProperties?: boolean;

  /** Specific properties to include */
  includedProperties?: string[];

  /** Minimum score threshold */
  minScore?: number;

  /** Diversity parameter (0-1) */
  diversity?: number;

  /** Rotation rate for repeated recommendations */
  rotationRate?: number;

  /** Time window for rotation */
  rotationTime?: number;
}

/**
 * Recommendation Service Interface
 *
 * Strategy pattern interface for ML-powered recommendations.
 * Supports hybrid collaborative + content-based filtering.
 */
export interface IRecommendationService {
  /**
   * Add or update a user in the recommendation engine
   *
   * @param userId - User identifier
   * @param properties - User properties
   */
  setUserProperties(userId: string, properties: UserProperties): Promise<void>;

  /**
   * Add or update an item in the recommendation engine
   *
   * @param itemId - Item identifier
   * @param properties - Item properties
   */
  setItemProperties(itemId: string, properties: ItemProperties): Promise<void>;

  /**
   * Delete a user from the recommendation engine
   *
   * @param userId - User identifier
   */
  deleteUser(userId: string): Promise<void>;

  /**
   * Delete an item from the recommendation engine
   *
   * @param itemId - Item identifier
   */
  deleteItem(itemId: string): Promise<void>;

  /**
   * Track an interaction event
   *
   * @param userId - User identifier
   * @param itemId - Item identifier
   * @param interactionType - Type of interaction
   * @param timestamp - Optional timestamp (defaults to now)
   * @param metadata - Optional additional metadata
   */
  trackInteraction(
    userId: string,
    itemId: string,
    interactionType: InteractionType,
    timestamp?: Date,
    metadata?: Record<string, unknown>
  ): Promise<void>;

  /**
   * Get personalized recommendations for a user
   *
   * @param userId - User identifier
   * @param options - Recommendation options
   * @returns List of recommended items
   */
  getRecommendations(
    userId: string,
    options?: RecommendationOptions
  ): Promise<RecommendationResult[]>;

  /**
   * Get similar items to a given item
   *
   * @param itemId - Source item identifier
   * @param options - Recommendation options
   * @returns List of similar items
   */
  getSimilarItems(
    itemId: string,
    options?: RecommendationOptions
  ): Promise<RecommendationResult[]>;

  /**
   * Get items commonly viewed/interacted with together
   *
   * @param itemId - Source item identifier
   * @param options - Recommendation options
   * @returns List of related items
   */
  getRelatedItems(
    itemId: string,
    options?: RecommendationOptions
  ): Promise<RecommendationResult[]>;

  /**
   * Batch sync users to recommendation engine
   *
   * @param users - Array of user ID and properties
   */
  batchSyncUsers(
    users: Array<{ userId: string; properties: UserProperties }>
  ): Promise<void>;

  /**
   * Batch sync items to recommendation engine
   *
   * @param items - Array of item ID and properties
   */
  batchSyncItems(
    items: Array<{ itemId: string; properties: ItemProperties }>
  ): Promise<void>;

  /**
   * Check if the service is available and configured
   *
   * @returns True if service can process requests
   */
  isAvailable(): Promise<boolean>;
}
