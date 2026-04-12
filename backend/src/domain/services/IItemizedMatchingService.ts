/**
 * Itemized Explainable Matching Service Interface
 *
 * Defines the contract for itemized matching with per-criterion scores and explanations.
 * NO TOTAL SCORE - Each criterion gets its own 0-100% score displayed independently.
 *
 * @module domain/services/IItemizedMatchingService
 */

// ============================================
// Type Definitions
// ============================================

/**
 * Criterion importance levels
 * CRITICAL - Must match for viable connection (e.g., required skills for a job)
 * HIGH - Strong weight in overall match quality
 * MEDIUM - Moderate influence on match
 * LOW - Nice to have, minimal impact
 */
export type CriterionImportance = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

/**
 * Match status based on score ranges
 * 95-100% = PERFECT - Exact match (same university, same skill, same industry)
 * 80-94%  = EXCELLENT - Very strong alignment with minor differences
 * 60-79%  = STRONG - Good match with some gaps
 * 40-59%  = MODERATE - Partial match, some alignment
 * 20-39%  = WEAK - Limited overlap
 * 0-19%   = NO_MATCH - No meaningful connection
 */
export type MatchStatus = 'PERFECT' | 'EXCELLENT' | 'STRONG' | 'MODERATE' | 'WEAK' | 'NO_MATCH';

/**
 * Match type describes how two values relate
 * EXACT - Values are identical (e.g., "Stanford MBA" = "Stanford MBA")
 * PARTIAL - Values overlap or are similar (e.g., "MBA" matches "Stanford MBA")
 * COMPLEMENTARY - Values are complementary (e.g., "Looking for investor" meets "Looking for startups")
 * NONE - No meaningful relationship
 */
export type MatchType = 'EXACT' | 'PARTIAL' | 'COMPLEMENTARY' | 'NONE';

/**
 * Entity types that can be matched
 */
export type EntityType =
  | 'USER'
  | 'CONTACT'
  | 'PROJECT'
  | 'JOB'
  | 'DEAL_SELL'
  | 'DEAL_BUY'
  | 'EVENT_ATTENDEE'
  | 'OPPORTUNITY'
  | 'PITCH';

/**
 * Itemized match types (what scenarios we support)
 */
export type ItemizedMatchType =
  | 'PROFILE_TO_PROFILE'      // User <-> Contact networking match
  | 'PROFILE_TO_USER'         // User <-> User matching
  | 'PROJECT_TO_INVESTOR'     // Project seeking investment
  | 'PROJECT_TO_PARTNER'      // Project seeking partners
  | 'PROJECT_TO_TALENT'       // Project seeking talent
  | 'PROJECT_TO_DYNAMIC'      // Project with auto-detected criteria from lookingFor
  | 'JOB_TO_CANDIDATE'        // Job opportunity to candidate
  | 'DEAL_TO_BUYER'           // Deal seeking buyers
  | 'DEAL_TO_PROVIDER'        // Deal seeking providers
  | 'EVENT_ATTENDEE_MATCH'    // Event attendee complementary matching
  | 'OPPORTUNITY_TO_CANDIDATE' // HIRING opportunity to candidate
  | 'CANDIDATE_TO_OPPORTUNITY' // OPEN_TO_OPPORTUNITIES user to hiring opportunity
  | 'PITCH_TO_CONTACT';       // Pitch deck matching to contact

// ============================================
// Data Structures
// ============================================

/**
 * Detailed explanation for why a criterion scored as it did
 * ALWAYS quote exact values from both profiles
 */
export interface CriterionExplanation {
  /** Human-readable summary (e.g., "Perfect industry alignment - both focus on AI and Healthcare") */
  summary: string;

  /** Source entity's value(s) for this criterion (e.g., "Project: AI/ML, Healthcare, Mobile Health") */
  sourceValue: string;

  /** Target entity's value(s) for this criterion (e.g., "Investor focus: AI/ML, Healthcare Technology") */
  targetValue: string;

  /** How the values relate */
  matchType: MatchType;

  /**
   * Detailed breakdown items
   * Each item shows specific matches (e.g., "AI/Machine Learning: Exact match")
   */
  details: string[];
}

/**
 * A single criterion match result
 */
export interface CriterionMatch {
  /** Unique identifier for this criterion (e.g., "industry", "skills", "education") */
  id: string;

  /** Display name (e.g., "Industry/Sector", "Technical Skills") */
  name: string;

  /** Icon or emoji for visual display */
  icon: string;

  /** Score 0-100 (NO decimals for cleaner display) */
  score: number;

  /** Derived status from score */
  status: MatchStatus;

  /** How important this criterion is for the match type */
  importance: CriterionImportance;

  /** Detailed explanation with quoted values */
  explanation: CriterionExplanation;

  /** Optional: raw data used for calculation (for debugging) */
  rawData?: {
    sourceValues: string[];
    targetValues: string[];
    matchedCount: number;
    totalCount: number;
  };
}

/**
 * Reference to an entity in the match
 */
export interface EntityRef {
  /** Entity ID */
  id: string;

  /** Display name */
  name: string;

  /** Entity type */
  type: EntityType;

  /** Optional additional metadata */
  metadata?: {
    company?: string;
    jobTitle?: string;
    avatarUrl?: string;
  };
}

/**
 * Suggested action based on match analysis
 */
export interface SuggestedAction {
  /** Action headline (e.g., "HIGH PRIORITY: Request warm intro") */
  action: string;

  /** Why this action is recommended */
  reason: string;

  /** Pre-filled message template */
  messageTemplate?: string;

  /** Priority level for this action */
  priority?: 'HIGH' | 'MEDIUM' | 'LOW';
}

/**
 * Summary of match quality counts
 * Used for quick overview badges
 */
export interface MatchSummary {
  /** Number of criteria with PERFECT (95-100%) score */
  perfectMatches: number;

  /** Number of criteria with EXCELLENT (80-94%) score */
  excellentMatches: number;

  /** Number of criteria with STRONG (60-79%) score */
  strongMatches: number;

  /** Number of criteria with MODERATE (40-59%) score */
  moderateMatches: number;

  /** Number of criteria with WEAK (20-39%) score */
  weakMatches: number;

  /** Number of criteria with NO_MATCH (0-19%) score */
  noMatches: number;

  /** How many CRITICAL criteria were met (score >= 60) */
  criticalMet: number;

  /** Total number of CRITICAL criteria */
  criticalTotal: number;
}

/**
 * Ice breaker suggestion for networking
 */
export interface IceBreaker {
  /** The ice breaker text */
  text: string;

  /** What criterion/data inspired this ice breaker */
  basedOn: string;

  /** Relevance score 0-100 */
  relevance: number;
}

/**
 * Complete itemized match result
 */
export interface ItemizedMatchResult {
  /** Unique match ID for caching/reference */
  matchId: string;

  /** Type of match being calculated */
  matchType: ItemizedMatchType;

  /** Source entity (the one seeking matches) */
  source: EntityRef;

  /** Target entity (the potential match) */
  target: EntityRef;

  /**
   * Per-criterion scores and explanations
   * SORTED by importance (CRITICAL first), then by score (highest first)
   */
  criteria: CriterionMatch[];

  /** Quick summary counts */
  summary: MatchSummary;

  /**
   * Concerns/warnings about the match
   * (e.g., "Geography: Jordan not in investor's primary focus countries")
   */
  concerns: string[];

  /** Recommended action based on match quality */
  suggestedAction?: SuggestedAction;

  /**
   * Ice breakers for networking
   * Based on shared interests, background, etc.
   */
  iceBreakers: IceBreaker[];

  /** When this match was calculated */
  calculatedAt: Date;

  /** Cache expiry time */
  expiresAt?: Date;
}

// ============================================
// Batch Results
// ============================================

/**
 * Batch match result for list views (lighter weight)
 */
export interface ItemizedMatchListItem {
  /** Target entity reference */
  target: EntityRef;

  /** Summary badge counts */
  summary: MatchSummary;

  /** Top 3 criteria (highest scores) for quick preview */
  topCriteria: Pick<CriterionMatch, 'id' | 'name' | 'icon' | 'score' | 'status'>[];

  /** Main concern if any */
  primaryConcern?: string;

  /** Whether full details are available (cached) */
  hasFullDetails: boolean;
}

// ============================================
// Service Interface
// ============================================

/**
 * Options for match calculation
 */
export interface ItemizedMatchOptions {
  /** Skip LLM-enhanced explanations for faster response */
  skipLlmEnhancement?: boolean;

  /** Include raw calculation data for debugging */
  includeRawData?: boolean;

  /** Use cached result if available (default: true) */
  useCache?: boolean;

  /** Force recalculation even if cached */
  forceRecalculate?: boolean;
}

/**
 * Itemized Explainable Matching Service Interface
 */
export interface IItemizedMatchingService {
  // ============================================
  // Profile Matching (User <-> Contact/User)
  // ============================================

  /**
   * Calculate itemized match between user and a contact
   */
  matchProfiles(
    userId: string,
    contactId: string,
    options?: ItemizedMatchOptions
  ): Promise<ItemizedMatchResult>;

  /**
   * Calculate itemized match between two users
   */
  matchUsers(
    userId1: string,
    userId2: string,
    options?: ItemizedMatchOptions
  ): Promise<ItemizedMatchResult>;

  /**
   * Batch calculate matches for multiple contacts (list view)
   */
  batchMatchProfiles(
    userId: string,
    contactIds: string[],
    options?: ItemizedMatchOptions
  ): Promise<ItemizedMatchListItem[]>;

  // ============================================
  // Item Matching (Project/Job/Deal -> Contact)
  // ============================================

  /**
   * Match a project to a potential collaborator/investor
   */
  matchProjectToContact(
    projectId: string,
    contactId: string,
    matchType: 'PROJECT_TO_INVESTOR' | 'PROJECT_TO_PARTNER' | 'PROJECT_TO_TALENT' | 'PROJECT_TO_DYNAMIC',
    options?: ItemizedMatchOptions
  ): Promise<ItemizedMatchResult>;

  /**
   * Match a job to a candidate
   */
  matchJobToCandidate(
    jobId: string,
    contactId: string,
    options?: ItemizedMatchOptions
  ): Promise<ItemizedMatchResult>;

  /**
   * Match a deal to a buyer/provider
   */
  matchDealToContact(
    dealId: string,
    contactId: string,
    matchType: 'DEAL_TO_BUYER' | 'DEAL_TO_PROVIDER',
    options?: ItemizedMatchOptions
  ): Promise<ItemizedMatchResult>;

  /**
   * Batch match an item to multiple contacts
   */
  batchMatchItemToContacts(
    itemId: string,
    itemType: 'PROJECT' | 'JOB' | 'DEAL',
    contactIds: string[],
    options?: ItemizedMatchOptions
  ): Promise<ItemizedMatchListItem[]>;

  // ============================================
  // Opportunity Matching (HIRING <-> OPEN_TO_OPPORTUNITIES)
  // ============================================

  /**
   * Match a HIRING opportunity to a candidate (contact or user)
   * Uses OpportunityCriteria: RoleFit, Skills, Seniority, Sector, Location, Network
   */
  matchOpportunityToCandidate(
    opportunityId: string,
    candidateId: string,
    candidateType: 'CONTACT' | 'USER',
    options?: ItemizedMatchOptions
  ): Promise<ItemizedMatchResult>;

  /**
   * Get all candidate matches for an opportunity
   */
  getOpportunityCandidates(
    opportunityId: string,
    candidateType: 'CONTACT' | 'USER',
    options?: ItemizedMatchOptions
  ): Promise<ItemizedMatchListItem[]>;

  // ============================================
  // Event Matching (Attendee <-> Attendee)
  // ============================================

  /**
   * Match two event attendees
   * Special handling for complementary goals (CRITICAL criterion)
   */
  matchEventAttendees(
    attendeeId: string,
    otherAttendeeId: string,
    eventId: string,
    options?: ItemizedMatchOptions
  ): Promise<ItemizedMatchResult>;

  /**
   * Get all matches for an attendee at an event
   */
  getEventAttendeeMatches(
    attendeeId: string,
    eventId: string,
    options?: ItemizedMatchOptions
  ): Promise<ItemizedMatchListItem[]>;

  // ============================================
  // Cache Management
  // ============================================

  /**
   * Invalidate cached matches for a user (when profile changes)
   */
  invalidateUserCache(userId: string): Promise<void>;

  /**
   * Invalidate cached matches for a contact (when contact is updated)
   */
  invalidateContactCache(contactId: string): Promise<void>;

  /**
   * Invalidate all cached matches for an item
   */
  invalidateItemCache(itemId: string, itemType: 'PROJECT' | 'JOB' | 'DEAL'): Promise<void>;
}

// ============================================
// Export Default
// ============================================

export default IItemizedMatchingService;
