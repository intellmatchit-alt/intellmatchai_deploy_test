/**
 * Matching Service Interface
 *
 * Defines the contract for contact matching/recommendation services.
 * Implementations can use deterministic algorithms or AI services like Recombee.
 *
 * @module domain/services/IMatchingService
 */

/**
 * Match result for a single contact
 */
export interface MatchResult {
  /** Contact ID */
  contactId: string;

  /** Overall match score (0-100) */
  score: number;

  /** Breakdown of score components */
  scoreBreakdown: {
    /** Goal alignment score (25%) - highest priority */
    goalAlignmentScore: number;

    /** Sector overlap score (15%) */
    sectorScore: number;

    /** Skill overlap score (12%) */
    skillScore: number;

    /** Semantic similarity score (10%) - AI embeddings via OpenAI */
    semanticSimilarityScore?: number;

    /** Network proximity score (8%) - 2nd/3rd degree connections via Neo4j */
    networkProximityScore?: number;

    /** Complementary skills score (7%) */
    complementarySkillsScore: number;

    /** Recency bonus (7%) */
    recencyScore: number;

    /** Interaction bonus (6%) */
    interactionScore: number;

    /** Interest overlap score (5%) */
    interestScore: number;

    /** Hobby overlap score (5%) */
    hobbyScore: number;
  };

  /** Intersection points (shared attributes) */
  intersections: IntersectionPoint[];

  /** AI-generated reasons for match (if available) */
  reasons?: string[];

  /** Suggested conversation opener (if available) */
  suggestedMessage?: string;

  /** Goal alignment details */
  goalAlignment?: {
    matchedGoals: string[];
    relevantTraits: string[];
  };

  /** Network degree of separation (1-3), if available from Neo4j */
  networkDegree?: number;

  /** Confidence level (0-100) based on data completeness */
  confidence?: number;

  /** Match quality indicator based on confidence */
  matchQuality?: 'HIGH' | 'MEDIUM' | 'LOW';
}

/**
 * Intersection point between user and contact
 */
export interface IntersectionPoint {
  /** Type of intersection */
  type: 'sector' | 'skill' | 'interest' | 'hobby' | 'company' | 'location' | 'network';

  /** Label for the intersection */
  label: string;

  /** Optional ID reference */
  id?: string;

  /** Strength of intersection (0-1) */
  strength: number;
}

/**
 * Match query options
 */
export interface MatchQueryOptions {
  /** Maximum number of results */
  limit?: number;

  /** Minimum score threshold */
  minScore?: number;

  /** Filter by sector */
  sectorId?: string;

  /** Include score breakdown */
  includeBreakdown?: boolean;

  /** Include AI-generated reasons */
  includeReasons?: boolean;
}

/**
 * Daily recommendation result
 */
export interface DailyRecommendation {
  /** Contact information */
  contact: {
    id: string;
    name: string;
    company?: string;
    jobTitle?: string;
  };

  /** Match result */
  match: MatchResult;

  /** Reason for recommendation today */
  recommendationReason: string;
}

/**
 * Matching Service Interface
 *
 * Strategy pattern interface for matching implementations.
 * Allows swapping between deterministic and AI-powered matching.
 */
export interface IMatchingService {
  /**
   * Calculate match scores for user's contacts
   *
   * @param userId - User ID
   * @param options - Query options
   * @param organizationId - Optional organization ID for org-scoped contacts
   * @returns Ranked match results
   */
  getMatches(userId: string, options?: MatchQueryOptions, organizationId?: string): Promise<MatchResult[]>;

  /**
   * Get detailed match analysis for a specific contact
   *
   * @param userId - User ID
   * @param contactId - Contact ID
   * @param organizationId - Optional organization ID for org-scoped contacts
   * @returns Detailed match result
   */
  getMatchDetails(userId: string, contactId: string, organizationId?: string): Promise<MatchResult | null>;

  /**
   * Get intersection points between user and contact
   *
   * @param userId - User ID
   * @param contactId - Contact ID
   * @param organizationId - Optional organization ID for org-scoped contacts
   * @returns Intersection points
   */
  getIntersections(userId: string, contactId: string, organizationId?: string): Promise<IntersectionPoint[]>;

  /**
   * Get daily recommended contacts
   *
   * @param userId - User ID
   * @param count - Number of recommendations
   * @param organizationId - Optional organization ID for org-scoped contacts
   * @returns Daily recommendations
   */
  getDailyRecommendations(userId: string, count?: number, organizationId?: string): Promise<DailyRecommendation[]>;

  /**
   * Recalculate match score for a contact
   *
   * @param userId - User ID
   * @param contactId - Contact ID
   * @param organizationId - Optional organization ID for org-scoped contacts
   * @returns Updated match score
   */
  recalculateScore(userId: string, contactId: string, organizationId?: string): Promise<number>;
}
