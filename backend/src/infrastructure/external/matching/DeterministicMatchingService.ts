/**
 * Deterministic Matching Service
 *
 * Enhanced matching implementation with semantic similarity as primary signal,
 * goal alignment, network proximity, and complementary skills.
 * Uses algorithmic scoring based on:
 * - Semantic Similarity (30%) - Primary signal - AI embeddings via OpenAI
 * - Goal Alignment (18%) - Important but not dominant
 * - Skill Match (18%)
 * - Sector Overlap (10%)
 * - Network Proximity (8%) - 2nd/3rd degree connections via Neo4j
 * - Complementary Skills (6%)
 * - Recency (3%)
 * - Interaction Frequency (3%)
 * - Interest Overlap (2%)
 * - Hobby Overlap (2%)
 *
 * @module infrastructure/external/matching/DeterministicMatchingService
 */

import { prisma } from '../../database/prisma/client';
import {
  IMatchingService,
  MatchResult,
  MatchQueryOptions,
  IntersectionPoint,
  DailyRecommendation,
} from '../../../domain/services/IMatchingService';
import { logger } from '../../../shared/logger';
import { cacheService, CACHE_KEYS, CACHE_TTL } from '../../cache/CacheService';
import { neo4jGraphService } from '../../database/neo4j/GraphService';
import {
  embeddingService,
  ProfileEmbeddingInput,
  SimilarityResult,
} from '../embedding/EmbeddingService';
import { matchHistoryService } from './MatchHistoryService';
import { matchFeedbackService } from './MatchFeedbackService';
import {
  CohereRerankService,
  formatContactForRerank,
  buildRerankQuery,
} from '../rerank/CohereRerankService';
import { config } from '../../../config';
import {
  calculateConfidence,
  COMPLEMENTARY_SKILLS as SHARED_COMPLEMENTARY_SKILLS,
  SENIOR_ROLE_PATTERNS as SHARED_SENIOR_ROLE_PATTERNS,
  INVESTOR_ROLE_PATTERNS as SHARED_INVESTOR_ROLE_PATTERNS,
  HIRING_ROLE_PATTERNS as SHARED_HIRING_ROLE_PATTERNS,
  INVESTMENT_COMPANY_PATTERNS as SHARED_INVESTMENT_COMPANY_PATTERNS,
  matchesRolePatterns,
} from '../../../shared/matching';
import { skillTaxonomyService } from '../../services/taxonomy';

/**
 * New scoring weights (v7) - Semantic similarity is primary signal
 */
const WEIGHTS = {
  goalAlignment: 0.18,        // Important but not dominant
  sector: 0.10,
  skill: 0.18,
  semanticSimilarity: 0.30,   // Primary signal - AI embeddings via OpenAI
  networkProximity: 0.06,     // 2nd/3rd degree connections via Neo4j
  complementarySkills: 0.08,
  recency: 0.03,              // Minor factor
  interaction: 0.03,          // Minor factor
  interest: 0.02,
  hobby: 0.02,
};

/**
 * Senior/Leadership job title patterns
 */
const SENIOR_ROLE_PATTERNS = [
  /\b(ceo|cto|cfo|coo|cmo|cio|chief)\b/i,
  /\b(president|vp|vice\s*president)\b/i,
  /\b(director|head\s+of|lead)\b/i,
  /\b(senior|sr\.?|principal|staff)\b/i,
  /\b(founder|co-?founder|partner)\b/i,
  /\b(managing\s+director|md)\b/i,
  /\b(executive|evp|svp)\b/i,
];

/**
 * Investor/VC job title patterns
 */
const INVESTOR_ROLE_PATTERNS = [
  /\b(investor|venture\s*capital|vc)\b/i,
  /\b(angel|seed|funding)\b/i,
  /\b(portfolio|investment|fund)\b/i,
  /\b(partner.*capital|capital.*partner)\b/i,
  /\b(managing.*partner)\b/i,
];

/**
 * Hiring/Recruiter job title patterns
 */
const HIRING_ROLE_PATTERNS = [
  /\b(recruiter|recruiting|talent)\b/i,
  /\b(hr|human\s*resources)\b/i,
  /\b(hiring\s*manager)\b/i,
  /\b(people\s*operations)\b/i,
];

/**
 * Investment company patterns
 */
const INVESTMENT_COMPANY_PATTERNS = [
  /capital/i,
  /ventures/i,
  /partners/i,
  /investments/i,
  /fund/i,
  /holdings/i,
];

/**
 * Complementary skills matrix
 * Skills that work well together
 */
const COMPLEMENTARY_SKILLS: Record<string, string[]> = {
  // Tech
  'Sales': ['Marketing', 'Business Development', 'Communication', 'Negotiation'],
  'Marketing': ['Sales', 'Content', 'Analytics', 'Social Media', 'SEO'],
  'Frontend Development': ['Backend Development', 'UI/UX Design', 'DevOps', 'Mobile Development'],
  'Backend Development': ['Frontend Development', 'DevOps', 'Data Engineering', 'Cloud', 'Database'],
  'Full Stack Development': ['DevOps', 'Cloud', 'UI/UX Design'],
  'Mobile Development': ['Frontend Development', 'UI/UX Design', 'Backend Development'],
  'DevOps': ['Backend Development', 'Cloud', 'Security', 'Infrastructure'],
  'Cloud': ['DevOps', 'Backend Development', 'Security', 'Infrastructure'],
  'Data Analysis': ['Data Science', 'Business Intelligence', 'Machine Learning', 'Statistics'],
  'Data Science': ['Machine Learning', 'Data Analysis', 'AI', 'Python', 'Statistics'],
  'Machine Learning': ['Data Science', 'AI', 'Python', 'Deep Learning'],
  'AI': ['Machine Learning', 'Data Science', 'Deep Learning', 'NLP'],
  'UI/UX Design': ['Product Design', 'Frontend Development', 'Research', 'Figma'],
  'Product Design': ['UI/UX Design', 'Research', 'Prototyping'],

  // Business
  'Product Management': ['Engineering', 'Design', 'Marketing', 'Data Analysis', 'Strategy'],
  'Project Management': ['Product Management', 'Agile', 'Scrum', 'Operations'],
  'Business Development': ['Sales', 'Marketing', 'Strategy', 'Partnerships'],
  'Strategy': ['Business Development', 'Finance', 'Operations', 'Consulting'],
  'Consulting': ['Strategy', 'Business Analysis', 'Project Management'],
  'Finance': ['Legal', 'Strategy', 'Operations', 'Accounting'],
  'Accounting': ['Finance', 'Tax', 'Audit', 'Compliance'],
  'Legal': ['Finance', 'Compliance', 'Contracts', 'IP'],
  'Operations': ['Project Management', 'Strategy', 'Finance', 'Supply Chain'],

  // Creative
  'Content': ['Marketing', 'SEO', 'Social Media', 'Writing'],
  'Writing': ['Content', 'Editing', 'Marketing', 'Communications'],
  'Graphic Design': ['UI/UX Design', 'Branding', 'Marketing'],
  'Video Production': ['Content', 'Marketing', 'Animation'],

  // Leadership
  'Leadership': ['Management', 'Strategy', 'Team Building', 'Communication'],
  'Management': ['Leadership', 'Operations', 'Strategy', 'HR'],
  'Team Building': ['Leadership', 'HR', 'Management'],
};

/**
 * Deterministic Matching Service
 *
 * Enhanced algorithm with goal alignment priority and complementary skills detection.
 */
export class DeterministicMatchingService implements IMatchingService {
  private cohereService: CohereRerankService;
  private cohereEnabled: boolean;

  constructor() {
    this.cohereService = new CohereRerankService();
    this.cohereEnabled = !!(config.ai.cohere?.apiKey);
  }

  /**
   * Get ranked matches for user's contacts
   *
   * Uses the centralized calculateContactMatchScoreBatch method for consistency.
   * All score calculations go through the same logic.
   */
  async getMatches(userId: string, options?: MatchQueryOptions, organizationId?: string): Promise<MatchResult[]> {
    const limit = options?.limit ?? 20;
    const minScore = options?.minScore ?? 0;

    logger.info('[GetMatches] Starting batch match calculation', { userId, limit, minScore, organizationId });

    // Build cache key with options (include orgId for scoping)
    const orgSuffix = organizationId ? `:org:${organizationId}` : '';
    const cacheKey = `${CACHE_KEYS.CONTACT_MATCHES}${userId}:${limit}:${minScore}${orgSuffix}`;

    // Try to get from cache first
    const cached = await cacheService.get<MatchResult[]>(cacheKey);
    if (cached) {
      logger.info('[GetMatches] Returning cached contact matches', {
        userId,
        count: cached.length,
        source: 'cache'
      });
      return cached;
    }

    // Get user's profile data including goals, interests, and hobbies
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        userSectors: { include: { sector: true } },
        userSkills: { include: { skill: true } },
        userInterests: { include: { interest: true } },
        userHobbies: { include: { hobby: true } },
        userGoals: true,
      },
    });

    if (!user) {
      logger.warn('[GetMatches] User not found', { userId });
      return [];
    }

    // Get hidden contacts from feedback (user has marked these as "hide")
    const hiddenContactIds = await matchFeedbackService.getHiddenContactIds(userId);

    // Get user's contacts with all relevant data including interests and hobbies
    // Scope by organization context when organizationId is provided
    const contactWhere = organizationId
      ? { organizationId }
      : { ownerId: userId };

    const contacts = await prisma.contact.findMany({
      where: contactWhere,
      include: {
        contactSectors: { include: { sector: true } },
        contactSkills: { include: { skill: true } },
        contactInterests: { include: { interest: true } },
        contactHobbies: { include: { hobby: true } },
        interactions: {
          orderBy: { occurredAt: 'desc' },
          take: 10,
        },
      },
    });

    // Filter out hidden contacts
    const visibleContacts = contacts.filter((c) => !hiddenContactIds.has(c.id));

    logger.info('[GetMatches] Processing contacts', {
      userId,
      totalContacts: contacts.length,
      visibleContacts: visibleContacts.length,
      hiddenContacts: hiddenContactIds.size,
    });

    // Use the centralized batch calculation method
    const results = await this.calculateContactMatchScoreBatch(userId, user, visibleContacts, minScore);

    // Sort by score descending
    results.sort((a, b) => b.score - a.score);

    // Apply limit
    let finalResults = results.slice(0, limit);

    // Optional: Apply Cohere semantic reranking for top results
    if (this.cohereEnabled && finalResults.length > 0) {
      finalResults = await this.applySemanticReranking(user, finalResults, visibleContacts);
    }

    // Log the results for debugging
    logger.info('[GetMatches] Calculation complete', {
      userId,
      totalResults: results.length,
      returnedResults: finalResults.length,
      topScores: finalResults.slice(0, 5).map(r => ({
        contactId: r.contactId,
        score: r.score,
      })),
    });

    // Record match history (async, non-blocking)
    matchHistoryService.recordBatchMatches(
      finalResults.map((result) => ({
        userId,
        contactId: result.contactId,
        matchType: 'contact',
        matchResult: result,
        calculationMethod: 'deterministic',
      }))
    ).catch((error) => {
      logger.warn('Failed to record match history', { error });
    });

    // Cache the results
    await cacheService.set(cacheKey, finalResults, CACHE_TTL.CONTACT_MATCHES);
    logger.debug('[GetMatches] Cached contact matches', { userId, count: finalResults.length });

    return finalResults;
  }

  /**
   * Centralized batch calculation method for multiple contacts.
   * This ensures the same logic is used for both batch and individual calculations.
   * Now includes detailed data (intersections, reasons, suggestedMessage) for consistency
   * with the detail view.
   */
  private async calculateContactMatchScoreBatch(
    userId: string,
    user: any,
    contacts: any[],
    minScore: number = 0
  ): Promise<MatchResult[]> {
    // Fetch network proximity data from Neo4j (2nd/3rd degree connections)
    const networkDegrees = await this.getNetworkDegreesMap(userId);

    // Calculate semantic similarity scores using embeddings for ALL contacts at once
    const semanticScores = await this.getSemanticSimilarityScores(user, contacts);

    // Get feedback scores for all contacts (for score adjustment)
    const contactIds = contacts.map((c) => c.id);
    const feedbackScores = await matchFeedbackService.getBulkFeedbackScores(userId, contactIds);

    logger.debug('[BatchCalculation] Fetched external scores', {
      userId,
      contactCount: contacts.length,
      networkDegreesCount: networkDegrees.size,
      semanticScoresCount: semanticScores.size,
      feedbackScoresCount: feedbackScores.size,
    });

    // Calculate scores for each contact using the SAME logic
    const results: MatchResult[] = [];

    for (const contact of contacts) {
      // Get network degree for this contact (0 = no connection, 1-3 = degrees of separation)
      const networkDegree = networkDegrees.get(contact.id) || 0;
      // Get semantic similarity score (0-100)
      const semanticScore = semanticScores.get(contact.id) || 0;

      // Use the core calculation method with detailed=true for full data
      const result = this.calculateMatchScore(user, contact, true, networkDegree, semanticScore);

      // Generate reasons and suggested message (same as detail view)
      result.reasons = this.generateReasons(result, user, contact, networkDegree, semanticScore);
      result.suggestedMessage = this.generateSuggestedMessage(result, contact, user);

      // Calculate confidence based on data completeness
      const confidenceResult = calculateConfidence(
        {
          hasSectors: (user.userSectors?.length ?? 0) > 0,
          hasSkills: (user.userSkills?.length ?? 0) > 0,
          hasGoals: (user.userGoals?.length ?? 0) > 0,
          hasBio: !!user.bio,
          hasEmbedding: semanticScore > 0,
          hasInterests: (user.userInterests?.length ?? 0) > 0,
          hasHobbies: (user.userHobbies?.length ?? 0) > 0,
        },
        {
          hasSectors: (contact.contactSectors?.length ?? 0) > 0,
          hasSkills: (contact.contactSkills?.length ?? 0) > 0,
          hasGoals: false, // contacts don't have goals
          hasBio: !!contact.bio,
          hasEmbedding: semanticScore > 0,
          hasInterests: (contact.contactInterests?.length ?? 0) > 0,
          hasHobbies: (contact.contactHobbies?.length ?? 0) > 0,
        }
      );
      result.confidence = confidenceResult.confidence;
      result.matchQuality = confidenceResult.matchQuality;

      // Apply feedback-based score adjustment
      const feedbackScore = feedbackScores.get(contact.id) || 0;
      const originalScore = result.score;

      if (feedbackScore !== 0) {
        const adjustment = matchFeedbackService.calculateFeedbackAdjustment(feedbackScore);
        result.score = Math.min(100, Math.max(0, Math.round(result.score * adjustment)));
      }

      logger.debug('[BatchCalculation] Contact score', {
        contactId: contact.id,
        contactName: contact.fullName,
        networkDegree,
        semanticScore,
        rawScore: originalScore,
        feedbackScore,
        finalScore: result.score,
      });

      if (result.score >= minScore) {
        results.push(result);
      }
    }

    return results;
  }

  /**
   * Get detailed match for a specific contact
   *
   * IMPORTANT: This method now uses the centralized calculateContactMatchScore
   * to ensure consistency with getMatches. The score calculation is identical
   * for both list and detail views.
   */
  async getMatchDetails(userId: string, contactId: string, organizationId?: string): Promise<MatchResult | null> {
    logger.info('[MatchDetails] Starting match details calculation', { userId, contactId, organizationId });

    // Build cache key for detail (include orgId for scoping)
    const orgSuffix = organizationId ? `:org:${organizationId}` : '';
    const detailCacheKey = `${CACHE_KEYS.CONTACT_MATCH_DETAIL}${userId}:${contactId}${orgSuffix}`;

    // Try to get from detail cache first
    const cachedDetail = await cacheService.get<MatchResult>(detailCacheKey);
    if (cachedDetail) {
      logger.info('[MatchDetails] Returning cached match details', {
        userId,
        contactId,
        cachedScore: cachedDetail.score,
        source: 'detail_cache'
      });
      return cachedDetail;
    }

    // IMPORTANT: Check if we have this contact's score in the batch cache
    // This ensures consistency between list and detail views
    const batchCacheKey = `${CACHE_KEYS.CONTACT_MATCHES}${userId}:100:0${orgSuffix}`; // Common batch cache key
    const cachedBatch = await cacheService.get<MatchResult[]>(batchCacheKey);
    const cachedFromBatch = cachedBatch?.find(m => m.contactId === contactId);

    if (cachedFromBatch) {
      logger.info('[MatchDetails] Found score in batch cache, using it for consistency', {
        userId,
        contactId,
        batchScore: cachedFromBatch.score,
        source: 'batch_cache'
      });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        userSectors: { include: { sector: true } },
        userSkills: { include: { skill: true } },
        userInterests: { include: { interest: true } },
        userHobbies: { include: { hobby: true } },
        userGoals: true,
      },
    });

    if (!user) return null;

    // Scope contact query by organization context
    const contactWhere = organizationId
      ? { id: contactId, organizationId }
      : { id: contactId, ownerId: userId };

    const contact = await prisma.contact.findFirst({
      where: contactWhere,
      include: {
        contactSectors: { include: { sector: true } },
        contactSkills: { include: { skill: true } },
        contactInterests: { include: { interest: true } },
        contactHobbies: { include: { hobby: true } },
        interactions: {
          orderBy: { occurredAt: 'desc' },
          take: 10,
        },
      },
    });

    if (!contact) return null;

    // Use the centralized score calculation method
    const result = await this.calculateContactMatchScore(userId, user, contact, true);

    logger.info('[MatchDetails] Score calculated', {
      userId,
      contactId,
      contactName: contact.fullName,
      calculatedScore: result.score,
      scoreBreakdown: result.scoreBreakdown,
      batchCachedScore: cachedFromBatch?.score,
      scoreDiff: cachedFromBatch ? Math.abs(result.score - cachedFromBatch.score) : null,
    });

    // If we have a cached batch score and it differs significantly, log a warning
    if (cachedFromBatch && Math.abs(result.score - cachedFromBatch.score) > 1) {
      logger.warn('[MatchDetails] Score discrepancy detected between batch and detail calculation', {
        userId,
        contactId,
        batchScore: cachedFromBatch.score,
        detailScore: result.score,
        diff: Math.abs(result.score - cachedFromBatch.score),
      });
    }

    // Add generated reasons
    const networkDegrees = await this.getNetworkDegreesMap(userId);
    const networkDegree = networkDegrees.get(contactId) || 0;
    const semanticScores = await this.getSemanticSimilarityScores(user, [contact]);
    const semanticScore = semanticScores.get(contactId) || 0;

    result.reasons = this.generateReasons(result, user, contact, networkDegree, semanticScore);
    result.suggestedMessage = this.generateSuggestedMessage(result, contact, user);

    // Record to match history (async, non-blocking)
    matchHistoryService.recordMatch({
      userId,
      contactId,
      matchType: 'contact',
      matchResult: result,
      calculationMethod: 'deterministic',
    }).catch((error) => {
      logger.warn('Failed to record match history', { error });
    });

    // Cache the result with same TTL as batch for consistency
    await cacheService.set(detailCacheKey, result, CACHE_TTL.CONTACT_MATCHES);

    return result;
  }

  /**
   * Centralized method to calculate match score for a single contact.
   * This is the SINGLE source of truth for score calculation.
   * Both getMatches and getMatchDetails use this method.
   */
  private async calculateContactMatchScore(
    userId: string,
    user: any,
    contact: any,
    detailed: boolean = false
  ): Promise<MatchResult> {
    // Get network proximity from Neo4j
    const networkDegrees = await this.getNetworkDegreesMap(userId);
    const networkDegree = networkDegrees.get(contact.id) || 0;

    // Calculate semantic similarity score
    const semanticScores = await this.getSemanticSimilarityScores(user, [contact]);
    const semanticScore = semanticScores.get(contact.id) || 0;

    logger.debug('[CalculateScore] Input values', {
      contactId: contact.id,
      contactName: contact.fullName,
      networkDegree,
      semanticScore,
      userSectors: user.userSectors?.length || 0,
      userSkills: user.userSkills?.length || 0,
      contactSectors: contact.contactSectors?.length || 0,
      contactSkills: contact.contactSkills?.length || 0,
    });

    const result = this.calculateMatchScore(user, contact, detailed, networkDegree, semanticScore);

    // Apply feedback-based score adjustment
    const feedbackScores = await matchFeedbackService.getBulkFeedbackScores(userId, [contact.id]);
    const feedbackScore = feedbackScores.get(contact.id) || 0;

    const originalScore = result.score;
    if (feedbackScore !== 0) {
      const adjustment = matchFeedbackService.calculateFeedbackAdjustment(feedbackScore);
      result.score = Math.min(100, Math.max(0, Math.round(result.score * adjustment)));
    }

    logger.debug('[CalculateScore] Final score', {
      contactId: contact.id,
      contactName: contact.fullName,
      rawScore: originalScore,
      feedbackScore,
      finalScore: result.score,
      breakdown: result.scoreBreakdown,
    });

    return result;
  }

  /**
   * Get intersection points between user and contact
   */
  async getIntersections(userId: string, contactId: string, organizationId?: string): Promise<IntersectionPoint[]> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        userSectors: { include: { sector: true } },
        userSkills: { include: { skill: true } },
        userInterests: { include: { interest: true } },
        userHobbies: { include: { hobby: true } },
      },
    });

    if (!user) return [];

    // Scope contact query by organization context
    const contactWhere = organizationId
      ? { id: contactId, organizationId }
      : { id: contactId, ownerId: userId };

    const contact = await prisma.contact.findFirst({
      where: contactWhere,
      include: {
        contactSectors: { include: { sector: true } },
        contactSkills: { include: { skill: true } },
        contactInterests: { include: { interest: true } },
        contactHobbies: { include: { hobby: true } },
      },
    });

    if (!contact) return [];

    return this.findIntersections(user, contact);
  }

  /**
   * Get daily recommendations
   */
  async getDailyRecommendations(userId: string, count: number = 3, organizationId?: string): Promise<DailyRecommendation[]> {
    // Get top matches that haven't been contacted recently
    const matches = await this.getMatches(userId, {
      limit: count * 2,
      minScore: 30,
    }, organizationId);

    // Get recent interactions to filter out recently contacted
    const recentInteractions = await prisma.interaction.findMany({
      where: {
        userId,
        occurredAt: {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
        },
      },
      select: { contactId: true },
    });

    const recentContactIds = new Set(recentInteractions.map((i) => i.contactId));

    // Filter and get top recommendations
    const recommendations: DailyRecommendation[] = [];

    for (const match of matches) {
      if (recommendations.length >= count) break;

      // Skip recently contacted
      if (recentContactIds.has(match.contactId)) continue;

      const contact = await prisma.contact.findUnique({
        where: { id: match.contactId },
        select: {
          id: true,
          fullName: true,
          company: true,
          jobTitle: true,
        },
      });

      if (!contact) continue;

      recommendations.push({
        contact: {
          id: contact.id,
          name: contact.fullName,
          company: contact.company || undefined,
          jobTitle: contact.jobTitle || undefined,
        },
        match,
        recommendationReason: this.getRecommendationReason(match),
      });
    }

    return recommendations;
  }

  /**
   * Recalculate match score for a contact
   */
  async recalculateScore(userId: string, contactId: string, organizationId?: string): Promise<number> {
    const result = await this.getMatchDetails(userId, contactId, organizationId);

    if (!result) return 0;

    // Update the stored match score
    await prisma.contact.update({
      where: { id: contactId },
      data: { matchScore: result.score },
    });

    return result.score;
  }

  // ============================================
  // Private Helper Methods
  // ============================================

  /**
   * Calculate match score between user and contact with enhanced algorithm
   *
   * THIS IS THE SINGLE SOURCE OF TRUTH FOR SCORE CALCULATION.
   * All score calculations (both batch and individual) go through this method.
   *
   * @param user - User data with profile information
   * @param contact - Contact data with profile information
   * @param detailed - Whether to include detailed intersection info
   * @param networkDegree - Degree of separation from Neo4j (1-3), 0 = no connection
   * @param semanticScore - Semantic similarity score (0-100) from AI embeddings
   */
  private calculateMatchScore(
    user: any,
    contact: any,
    detailed: boolean = false,
    networkDegree: number = 0,
    semanticScore: number = 0
  ): MatchResult {
    // Extract user data
    const userSectorIds = new Set<string>(user.userSectors.map((s: any) => s.sectorId as string));
    const userSkillNames = user.userSkills.map((s: any) => s.skill?.name || '').filter(Boolean);
    const userSkillIds = new Set<string>(user.userSkills.map((s: any) => s.skillId as string));
    const userInterestIds = new Set<string>(user.userInterests?.map((i: any) => i.interestId as string) || []);
    const userHobbyIds = new Set<string>(user.userHobbies?.map((h: any) => h.hobbyId as string) || []);
    const userGoals = user.userGoals || [];

    // Extract contact data
    const contactSectorIds = new Set<string>(contact.contactSectors.map((s: any) => s.sectorId as string));
    const contactSkillNames = contact.contactSkills.map((s: any) => s.skill?.name || '').filter(Boolean);
    const contactSkillIds = new Set<string>(contact.contactSkills.map((s: any) => s.skillId as string));
    const contactInterestIds = new Set<string>(contact.contactInterests?.map((i: any) => i.interestId as string) || []);
    const contactHobbyIds = new Set<string>(contact.contactHobbies?.map((h: any) => h.hobbyId as string) || []);

    // 1. Calculate Goal Alignment Score (25% weight)
    const goalResult = this.calculateGoalAlignment(user, contact, userGoals);
    const goalAlignmentScore = goalResult.score;

    // 2. Calculate Sector Overlap Score (15% weight)
    const sectorOverlap = this.calculateSetOverlap(userSectorIds, contactSectorIds);
    const sectorScore = sectorOverlap * 100;

    // 3. Calculate Skill Match Score (12% weight) - enhanced with taxonomy
    let skillScore: number;
    if (skillTaxonomyService.isAvailable() && userSkillNames.length > 0 && contactSkillNames.length > 0) {
      const taxonomyResult = skillTaxonomyService.calculateSkillScore(userSkillNames, contactSkillNames);
      skillScore = taxonomyResult.score;
    } else {
      const skillOverlap = this.calculateSetOverlap(userSkillIds, contactSkillIds);
      skillScore = skillOverlap * 100;
    }

    // 4. Semantic Similarity Score (25% weight) - passed in from AI embeddings
    const semanticSimilarityScore = semanticScore;

    // 5. Calculate Network Proximity Score (8% weight) - from Neo4j graph
    // 1st degree (via mutual contact) = 100, 2nd degree = 70, 3rd degree = 40, no connection = 0
    const networkProximityScore = this.calculateNetworkProximityScore(networkDegree);

    // 6. Calculate Complementary Skills Score (7% weight)
    const complementarySkillsScore = this.calculateComplementarySkills(userSkillNames, contactSkillNames);

    // 7. Calculate Interaction Score (6% weight)
    const interactionCount = contact.interactions?.length || 0;
    const interactionScore = Math.min(100, interactionCount * 20);

    // 8. Calculate Interest Score (5% weight)
    const interestOverlap = this.calculateSetOverlap(userInterestIds, contactInterestIds);
    const interestScore = interestOverlap * 100;

    // 9. Calculate Hobby Score (5% weight)
    const hobbyOverlap = this.calculateSetOverlap(userHobbyIds, contactHobbyIds);
    const hobbyScore = hobbyOverlap * 100;

    // 10. Calculate Recency Score (7% weight) - exponential decay based on last update
    // IMPORTANT: Only give recency points if there's meaningful match data
    // This prevents "free" points for contacts with no overlap
    const hasAnyMatchData = sectorScore > 0 || skillScore > 0 || interestScore > 0 ||
                            hobbyScore > 0 || goalAlignmentScore > 0 || interactionCount > 0;

    // Calculate days since update (for logging and recency calculation)
    const relevantDate = contact.updatedAt || contact.createdAt;
    const daysSinceUpdate = Math.floor(
      (Date.now() - relevantDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    // Only award recency points if there's meaningful match data
    let recencyScore = 0;
    if (hasAnyMatchData) {
      // Exponential decay with half-life of ~30 days
      // Day 0: 100, Day 30: ~37, Day 60: ~14, Day 90: ~5
      recencyScore = Math.round(100 * Math.exp(-daysSinceUpdate / 30));
    }

    // Calculate weighted total with detailed logging
    const weightedComponents = {
      goalAlignment: goalAlignmentScore * WEIGHTS.goalAlignment,
      sector: sectorScore * WEIGHTS.sector,
      skill: skillScore * WEIGHTS.skill,
      semantic: semanticSimilarityScore * WEIGHTS.semanticSimilarity,
      network: networkProximityScore * WEIGHTS.networkProximity,
      complementary: complementarySkillsScore * WEIGHTS.complementarySkills,
      recency: recencyScore * WEIGHTS.recency,
      interaction: interactionScore * WEIGHTS.interaction,
      interest: interestScore * WEIGHTS.interest,
      hobby: hobbyScore * WEIGHTS.hobby,
    };

    const totalScore = Math.round(
      weightedComponents.goalAlignment +
      weightedComponents.sector +
      weightedComponents.skill +
      weightedComponents.semantic +
      weightedComponents.network +
      weightedComponents.complementary +
      weightedComponents.recency +
      weightedComponents.interaction +
      weightedComponents.interest +
      weightedComponents.hobby
    );

    // Log detailed score calculation for debugging
    logger.debug('[ScoreCalculation] Detailed breakdown', {
      contactId: contact.id,
      contactName: contact.fullName,
      rawScores: {
        goalAlignment: Math.round(goalAlignmentScore),
        sector: Math.round(sectorScore),
        skill: Math.round(skillScore),
        semantic: Math.round(semanticSimilarityScore),
        network: Math.round(networkProximityScore),
        complementary: Math.round(complementarySkillsScore),
        recency: Math.round(recencyScore),
        interaction: Math.round(interactionScore),
        interest: Math.round(interestScore),
        hobby: Math.round(hobbyScore),
      },
      weightedContributions: {
        goalAlignment: Math.round(weightedComponents.goalAlignment * 100) / 100,
        sector: Math.round(weightedComponents.sector * 100) / 100,
        skill: Math.round(weightedComponents.skill * 100) / 100,
        semantic: Math.round(weightedComponents.semantic * 100) / 100,
        network: Math.round(weightedComponents.network * 100) / 100,
        complementary: Math.round(weightedComponents.complementary * 100) / 100,
        recency: Math.round(weightedComponents.recency * 100) / 100,
        interaction: Math.round(weightedComponents.interaction * 100) / 100,
        interest: Math.round(weightedComponents.interest * 100) / 100,
        hobby: Math.round(weightedComponents.hobby * 100) / 100,
      },
      inputs: {
        networkDegree,
        semanticScore,
        daysSinceUpdate,
        interactionCount,
        userSectorCount: userSectorIds.size,
        contactSectorCount: contactSectorIds.size,
        userSkillCount: userSkillIds.size,
        contactSkillCount: contactSkillIds.size,
        userGoalCount: userGoals.length,
      },
      totalScore,
      finalScore: Math.min(100, totalScore),
    });

    // Find intersections if detailed
    const intersections = detailed ? this.findIntersections(user, contact) : [];

    return {
      contactId: contact.id,
      score: Math.min(100, totalScore),
      scoreBreakdown: {
        goalAlignmentScore: Math.round(goalAlignmentScore),
        sectorScore: Math.round(sectorScore),
        skillScore: Math.round(skillScore),
        semanticSimilarityScore: Math.round(semanticSimilarityScore),
        networkProximityScore: Math.round(networkProximityScore),
        complementarySkillsScore: Math.round(complementarySkillsScore),
        recencyScore: Math.round(recencyScore),
        interactionScore: Math.round(interactionScore),
        interestScore: Math.round(interestScore),
        hobbyScore: Math.round(hobbyScore),
      },
      intersections,
      goalAlignment: detailed ? goalResult.details : undefined,
      networkDegree: networkDegree > 0 ? networkDegree : undefined,
    };
  }

  /**
   * Calculate goal alignment score based on user's networking goals
   */
  private calculateGoalAlignment(
    user: any,
    contact: any,
    userGoals: any[]
  ): { score: number; details: { matchedGoals: string[]; relevantTraits: string[] } } {
    if (!userGoals || userGoals.length === 0) {
      return { score: 0, details: { matchedGoals: [], relevantTraits: [] } };
    }

    let totalScore = 0;
    const matchedGoals: string[] = [];
    const relevantTraits: string[] = [];

    const contactJobTitle = (contact.jobTitle || '').toLowerCase();
    const contactCompany = (contact.company || '').toLowerCase();

    // Check if contact has senior role
    const isSeniorRole = SENIOR_ROLE_PATTERNS.some((p) => p.test(contactJobTitle));
    // Check if contact is investor/VC
    const isInvestorRole = INVESTOR_ROLE_PATTERNS.some((p) => p.test(contactJobTitle));
    const isInvestmentCompany = INVESTMENT_COMPANY_PATTERNS.some((p) => p.test(contactCompany));
    // Check if contact is recruiter/hiring manager
    const isHiringRole = HIRING_ROLE_PATTERNS.some((p) => p.test(contactJobTitle));

    // Get contact skills for matching
    const contactSkillNames = contact.contactSkills?.map((s: any) => s.skill?.name || '').filter(Boolean) || [];
    const userSkillNames = user.userSkills?.map((s: any) => s.skill?.name || '').filter(Boolean) || [];

    // Check if sectors overlap
    const userSectorIds = new Set(user.userSectors?.map((s: any) => s.sectorId) || []);
    const contactSectorIds = new Set(contact.contactSectors?.map((s: any) => s.sectorId) || []);
    const hasSameSector = [...userSectorIds].some((id) => contactSectorIds.has(id));

    // Check for complementary skills
    const hasComplementary = this.hasComplementarySkills(userSkillNames, contactSkillNames);

    for (const goal of userGoals) {
      const goalType = goal.goalType;
      let goalScore = 0;

      switch (goalType) {
        case 'MENTORSHIP':
          // User seeking mentor - contact should be senior
          if (isSeniorRole) {
            goalScore += 40;
            relevantTraits.push('Senior professional');
          }
          if (hasSameSector) {
            goalScore += 30;
            relevantTraits.push('Same industry');
          }
          if (goalScore > 0) matchedGoals.push('Mentorship');
          break;

        case 'INVESTMENT':
          // User seeking investment - contact should be investor/VC
          if (isInvestorRole) {
            goalScore += 50;
            relevantTraits.push('Investor');
          }
          if (isInvestmentCompany) {
            goalScore += 30;
            relevantTraits.push('Investment firm');
          }
          if (goalScore > 0) matchedGoals.push('Investment');
          break;

        case 'PARTNERSHIP':
          // User seeking partners - same sector, complementary skills
          if (hasSameSector) {
            goalScore += 30;
            relevantTraits.push('Same sector');
          }
          if (hasComplementary) {
            goalScore += 40;
            relevantTraits.push('Complementary skills');
          }
          if (goalScore > 0) matchedGoals.push('Partnership');
          break;

        case 'HIRING':
          // User is hiring - contact has skills they might need
          if (contactSkillNames.length > 0) {
            goalScore += 30;
            relevantTraits.push('Has relevant skills');
          }
          if (hasSameSector) {
            goalScore += 20;
            relevantTraits.push('Industry experience');
          }
          if (goalScore > 0) matchedGoals.push('Potential hire');
          break;

        case 'JOB_SEEKING':
          // User seeking job - contact is recruiter/manager or at good company
          if (isHiringRole) {
            goalScore += 50;
            relevantTraits.push('Recruiter/HR');
          }
          if (isSeniorRole && hasSameSector) {
            goalScore += 30;
            relevantTraits.push('Industry leader');
          }
          if (goalScore > 0) matchedGoals.push('Job opportunity');
          break;

        case 'COLLABORATION':
          // Similar interests and complementary skills
          if (hasComplementary) {
            goalScore += 40;
            relevantTraits.push('Complementary skills');
          }
          if (hasSameSector) {
            goalScore += 30;
            relevantTraits.push('Same field');
          }
          if (goalScore > 0) matchedGoals.push('Collaboration');
          break;

        case 'LEARNING':
          // User wants to learn - contact has expertise
          if (isSeniorRole) {
            goalScore += 35;
            relevantTraits.push('Experienced');
          }
          if (contactSkillNames.length > 0) {
            goalScore += 25;
            relevantTraits.push('Has expertise');
          }
          if (goalScore > 0) matchedGoals.push('Learning opportunity');
          break;

        case 'SALES':
          // User in sales - contact could be prospect
          if (isSeniorRole) {
            goalScore += 30;
            relevantTraits.push('Decision maker');
          }
          if (hasSameSector) {
            goalScore += 20;
            relevantTraits.push('Target industry');
          }
          if (goalScore > 0) matchedGoals.push('Sales prospect');
          break;

        default:
          // General networking
          if (hasSameSector) goalScore += 20;
          if (hasComplementary) goalScore += 20;
          break;
      }

      totalScore += goalScore;
    }

    // Average by number of goals and cap at 100
    const avgScore = userGoals.length > 0 ? totalScore / userGoals.length : 0;
    const finalScore = Math.min(100, avgScore);

    // Remove duplicate traits
    const uniqueTraits = [...new Set(relevantTraits)];

    return {
      score: finalScore,
      details: {
        matchedGoals: [...new Set(matchedGoals)],
        relevantTraits: uniqueTraits,
      },
    };
  }

  /**
   * Calculate complementary skills score
   */
  private calculateComplementarySkills(userSkills: string[], contactSkills: string[]): number {
    if (userSkills.length === 0 || contactSkills.length === 0) return 0;

    let matches = 0;
    const normalizedContactSkills = contactSkills.map((s) => s.toLowerCase());

    for (const userSkill of userSkills) {
      const complements = COMPLEMENTARY_SKILLS[userSkill] || [];
      for (const complement of complements) {
        if (normalizedContactSkills.some((cs) => cs.includes(complement.toLowerCase()))) {
          matches++;
        }
      }
    }

    // Each complement = 25 points, max 100
    return Math.min(100, matches * 25);
  }

  /**
   * Check if user and contact have complementary skills
   */
  private hasComplementarySkills(userSkills: string[], contactSkills: string[]): boolean {
    if (userSkills.length === 0 || contactSkills.length === 0) return false;

    const normalizedContactSkills = contactSkills.map((s) => s.toLowerCase());

    for (const userSkill of userSkills) {
      const complements = COMPLEMENTARY_SKILLS[userSkill] || [];
      for (const complement of complements) {
        if (normalizedContactSkills.some((cs) => cs.includes(complement.toLowerCase()))) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Calculate overlap ratio between two sets (Jaccard similarity)
   */
  private calculateSetOverlap(set1: Set<string>, set2: Set<string>): number {
    if (set1.size === 0 || set2.size === 0) return 0;

    let overlap = 0;
    for (const item of set1) {
      if (set2.has(item)) overlap++;
    }

    // Jaccard similarity coefficient
    const union = set1.size + set2.size - overlap;
    return overlap / union;
  }

  /**
   * Get network degrees map from Neo4j for all contacts
   * Maps contactId -> degree of separation (1, 2, or 3)
   */
  private async getNetworkDegreesMap(userId: string): Promise<Map<string, number>> {
    const degreeMap = new Map<string, number>();

    // Check if Neo4j is available
    if (!neo4jGraphService.isAvailable()) {
      logger.debug('Neo4j not available, skipping network proximity scoring');
      return degreeMap;
    }

    try {
      // Get contacts grouped by degree of separation (up to 3 degrees)
      const contactsByDegree = await neo4jGraphService.getContactsByDegree(userId, 3);

      // Convert the Map<degree, contactIds[]> to Map<contactId, degree>
      for (const [degree, contactIds] of contactsByDegree) {
        for (const contactId of contactIds) {
          // Only set if not already set (prefer lower degree)
          if (!degreeMap.has(contactId)) {
            degreeMap.set(contactId, degree);
          }
        }
      }

      logger.debug('Fetched network degrees from Neo4j', {
        userId,
        degree1Count: contactsByDegree.get(1)?.length || 0,
        degree2Count: contactsByDegree.get(2)?.length || 0,
        degree3Count: contactsByDegree.get(3)?.length || 0,
      });
    } catch (error) {
      logger.warn('Failed to fetch network degrees from Neo4j', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    return degreeMap;
  }

  /**
   * Calculate network proximity score based on degrees of separation
   * 1st degree = 100 (connected via mutual contact)
   * 2nd degree = 70 (friend of a friend)
   * 3rd degree = 40 (friend of a friend of a friend)
   * No connection = 0
   */
  private calculateNetworkProximityScore(degree: number): number {
    switch (degree) {
      case 1:
        return 100; // Direct shared connection
      case 2:
        return 70;  // 2nd degree connection
      case 3:
        return 40;  // 3rd degree connection
      default:
        return 0;   // No network connection
    }
  }

  /**
   * Check if a contact has meaningful profile data for semantic similarity
   * Returns true if contact has data beyond just a name
   */
  private contactHasMeaningfulData(contact: any): boolean {
    // Check for bio
    if (contact.bio && contact.bio.trim().length > 10) return true;
    // Check for job title
    if (contact.jobTitle && contact.jobTitle.trim().length > 0) return true;
    // Check for company
    if (contact.company && contact.company.trim().length > 0) return true;
    // Check for sectors
    if (contact.contactSectors && contact.contactSectors.length > 0) return true;
    // Check for skills
    if (contact.contactSkills && contact.contactSkills.length > 0) return true;
    // Check for interests
    if (contact.contactInterests && contact.contactInterests.length > 0) return true;
    // Check for hobbies
    if (contact.contactHobbies && contact.contactHobbies.length > 0) return true;

    return false;
  }

  /**
   * Get semantic similarity scores for contacts using AI embeddings
   * Maps contactId -> similarity score (0-100)
   *
   * IMPORTANT: Only calculates semantic similarity for contacts with meaningful
   * profile data. Contacts with only a name will get 0 score to avoid
   * false positives from AI embeddings finding similarity in text structure.
   */
  private async getSemanticSimilarityScores(user: any, contacts: any[]): Promise<Map<string, number>> {
    const scoreMap = new Map<string, number>();

    // Check if embedding service is available
    if (!embeddingService.isAvailable()) {
      logger.debug('Embedding service not available, skipping semantic similarity scoring');
      return scoreMap;
    }

    // Filter contacts to only those with meaningful profile data
    const contactsWithData = contacts.filter((c) => this.contactHasMeaningfulData(c));

    // Set 0 score for contacts without meaningful data
    for (const contact of contacts) {
      if (!this.contactHasMeaningfulData(contact)) {
        scoreMap.set(contact.id, 0);
        logger.debug('Contact has no meaningful data for semantic similarity', {
          contactId: contact.id,
          contactName: contact.fullName,
        });
      }
    }

    if (contactsWithData.length === 0) {
      logger.debug('No contacts with meaningful data for semantic similarity scoring');
      return scoreMap;
    }

    try {
      // Build user profile for embedding
      const userProfile: ProfileEmbeddingInput = {
        id: user.id,
        type: 'user',
        fullName: user.fullName,
        bio: user.bio,
        jobTitle: user.jobTitle,
        company: user.company,
        sectors: user.userSectors?.map((s: any) => s.sector?.name).filter(Boolean) || [],
        skills: user.userSkills?.map((s: any) => s.skill?.name).filter(Boolean) || [],
        interests: user.userInterests?.map((i: any) => i.interest?.name).filter(Boolean) || [],
        hobbies: user.userHobbies?.map((h: any) => h.hobby?.name).filter(Boolean) || [],
        goals: user.userGoals?.map((g: any) => g.goalType).filter(Boolean) || [],
      };

      // Build contact profiles for embedding (only for contacts with meaningful data)
      const contactProfiles: ProfileEmbeddingInput[] = contactsWithData.map((contact: any) => ({
        id: contact.id,
        type: 'contact' as const,
        fullName: contact.fullName,
        bio: contact.bio,
        jobTitle: contact.jobTitle,
        company: contact.company,
        sectors: contact.contactSectors?.map((s: any) => s.sector?.name).filter(Boolean) || [],
        skills: contact.contactSkills?.map((s: any) => s.skill?.name).filter(Boolean) || [],
        interests: contact.contactInterests?.map((i: any) => i.interest?.name).filter(Boolean) || [],
        hobbies: contact.contactHobbies?.map((h: any) => h.hobby?.name).filter(Boolean) || [],
      }));

      // Calculate bulk similarity
      const similarities = await embeddingService.calculateBulkSimilarity(userProfile, contactProfiles);

      // Convert to Map
      for (const result of similarities) {
        scoreMap.set(result.targetId, result.normalizedScore);
      }

      logger.debug('Calculated semantic similarity scores', {
        userId: user.id,
        totalContacts: contacts.length,
        contactsWithData: contactsWithData.length,
        scoresCalculated: scoreMap.size,
      });
    } catch (error) {
      logger.warn('Failed to calculate semantic similarity scores', {
        userId: user.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    return scoreMap;
  }

  /**
   * Apply Cohere semantic reranking to improve match ordering
   * Uses user goals and profile to rerank contacts semantically
   */
  private async applySemanticReranking(
    user: any,
    results: MatchResult[],
    contacts: any[]
  ): Promise<MatchResult[]> {
    try {
      // Build query from user goals and profile
      const query = buildRerankQuery({
        goals: user.userGoals?.map((g: any) => g.goalType) || [],
        sectors: user.userSectors?.map((s: any) => s.sector?.name).filter(Boolean) || [],
        skills: user.userSkills?.map((s: any) => s.skill?.name).filter(Boolean) || [],
        interests: user.userInterests?.map((i: any) => i.interest?.name).filter(Boolean) || [],
      });

      // Create contact map for quick lookup
      const contactMap = new Map(contacts.map((c) => [c.id, c]));

      // Format contacts for reranking
      const documents = results.map((result) => {
        const contact = contactMap.get(result.contactId);
        return formatContactForRerank({
          id: result.contactId,
          name: contact?.fullName || '',
          company: contact?.company,
          jobTitle: contact?.jobTitle,
          sectors: contact?.contactSectors?.map((s: any) => s.sector?.name).filter(Boolean),
          skills: contact?.contactSkills?.map((s: any) => s.skill?.name).filter(Boolean),
          interests: contact?.contactInterests?.map((i: any) => i.interest?.name).filter(Boolean),
          bio: contact?.bio,
        });
      });

      // Rerank with Cohere
      const rerankResponse = await this.cohereService.rerank(query, documents, {
        topN: results.length,
        minScore: 0.1,
      });

      logger.debug('Applied Cohere semantic reranking', {
        originalCount: results.length,
        rerankedCount: rerankResponse.results.length,
        processingTimeMs: rerankResponse.processingTimeMs,
      });

      // Create map of contact ID to relevance score
      const relevanceScores = new Map(
        rerankResponse.results.map((r) => [r.id, r.relevanceScore])
      );

      // Create map of original results by contact ID
      const resultMap = new Map(results.map((r) => [r.contactId, r]));

      // Reorder results based on Cohere ranking while preserving original scores
      // Note: We use Cohere only for ordering, not for score modification,
      // to ensure consistency between list and detail views
      const rerankedResults: MatchResult[] = [];

      for (const rerankResult of rerankResponse.results) {
        const originalResult = resultMap.get(rerankResult.id);
        if (originalResult) {
          // Keep original score for consistency with detail view
          rerankedResults.push({
            ...originalResult,
            reasons: originalResult.reasons
              ? [...originalResult.reasons, 'Semantically relevant to your goals']
              : ['Semantically relevant to your goals'],
          });
        }
      }

      // Add any results not returned by Cohere (in case of filtering)
      for (const result of results) {
        if (!relevanceScores.has(result.contactId)) {
          rerankedResults.push(result);
        }
      }

      return rerankedResults;
    } catch (error) {
      logger.warn('Cohere reranking failed, using original order', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return results;
    }
  }

  /**
   * Find intersection points between user and contact
   */
  private findIntersections(user: any, contact: any): IntersectionPoint[] {
    const intersections: IntersectionPoint[] = [];

    // Find sector intersections
    const userSectorMap = new Map<string, any>(
      user.userSectors.map((s: any) => [s.sectorId, s.sector])
    );

    for (const cs of contact.contactSectors || []) {
      if (userSectorMap.has(cs.sectorId)) {
        const sector = userSectorMap.get(cs.sectorId);
        intersections.push({
          type: 'sector',
          label: sector?.name || 'Unknown',
          id: cs.sectorId,
          strength: 1.0,
        });
      }
    }

    // Find skill intersections
    const userSkillMap = new Map<string, any>(
      user.userSkills.map((s: any) => [s.skillId, s.skill])
    );

    for (const cs of contact.contactSkills || []) {
      if (userSkillMap.has(cs.skillId)) {
        const skill = userSkillMap.get(cs.skillId);
        intersections.push({
          type: 'skill',
          label: skill?.name || 'Unknown',
          id: cs.skillId,
          strength: 0.8,
        });
      }
    }

    // Find interest intersections
    const userInterestMap = new Map<string, any>(
      (user.userInterests || []).map((i: any) => [i.interestId, i.interest])
    );

    for (const ci of contact.contactInterests || []) {
      if (userInterestMap.has(ci.interestId)) {
        const interest = userInterestMap.get(ci.interestId);
        intersections.push({
          type: 'interest',
          label: interest?.name || 'Unknown',
          id: ci.interestId,
          strength: 0.7,
        });
      }
    }

    // Find hobby intersections
    const userHobbyMap = new Map<string, any>(
      (user.userHobbies || []).map((h: any) => [h.hobbyId, h.hobby])
    );

    for (const ch of contact.contactHobbies || []) {
      if (userHobbyMap.has(ch.hobbyId)) {
        const hobby = userHobbyMap.get(ch.hobbyId);
        intersections.push({
          type: 'hobby',
          label: hobby?.name || 'Unknown',
          id: ch.hobbyId,
          strength: 0.6,
        });
      }
    }

    // Check company match
    if (user.company && contact.company) {
      const userCompany = user.company.toLowerCase();
      const contactCompany = contact.company.toLowerCase();

      if (
        userCompany === contactCompany ||
        userCompany.includes(contactCompany) ||
        contactCompany.includes(userCompany)
      ) {
        intersections.push({
          type: 'company',
          label: contact.company,
          strength: 0.9,
        });
      }
    }

    // Check location match
    if (user.location && contact.location) {
      const userLoc = user.location.toLowerCase();
      const contactLoc = (contact.location || '').toLowerCase();

      if (
        userLoc === contactLoc ||
        userLoc.includes(contactLoc) ||
        contactLoc.includes(userLoc)
      ) {
        intersections.push({
          type: 'location',
          label: contact.location || user.location,
          strength: 0.6,
        });
      }
    }

    return intersections;
  }

  /**
   * Generate human-readable reasons for match
   */
  private generateReasons(
    result: MatchResult,
    user: any,
    contact: any,
    networkDegree: number = 0,
    semanticScore: number = 0
  ): string[] {
    const reasons: string[] = [];

    // Goal alignment reasons (highest priority)
    if (result.goalAlignment && result.goalAlignment.matchedGoals.length > 0) {
      for (const goal of result.goalAlignment.matchedGoals) {
        reasons.push(`Aligns with your ${goal.toLowerCase()} goals`);
      }
    }

    if (result.scoreBreakdown.goalAlignmentScore >= 50) {
      const traits = result.goalAlignment?.relevantTraits || [];
      if (traits.length > 0) {
        reasons.push(traits.slice(0, 2).join(', '));
      }
    }

    // Semantic similarity reasons (from AI embeddings)
    if (semanticScore >= 70) {
      reasons.push('Highly similar professional profile');
    } else if (semanticScore >= 50) {
      reasons.push('Strong profile alignment based on AI analysis');
    }

    // Network proximity reasons (from Neo4j graph)
    if (networkDegree > 0) {
      switch (networkDegree) {
        case 1:
          reasons.push('Connected through a mutual contact');
          break;
        case 2:
          reasons.push('2nd degree connection in your network');
          break;
        case 3:
          reasons.push('3rd degree connection - friend of a friend');
          break;
      }
    }

    // Sector reasons
    if (result.scoreBreakdown.sectorScore >= 50) {
      const sectorIntersections = result.intersections.filter((i) => i.type === 'sector');
      if (sectorIntersections.length > 0) {
        reasons.push(`Works in ${sectorIntersections.map((i) => i.label).join(', ')}`);
      }
    }

    // Skill reasons
    if (result.scoreBreakdown.skillScore >= 50) {
      const skillIntersections = result.intersections.filter((i) => i.type === 'skill');
      if (skillIntersections.length > 0) {
        reasons.push(`Shares skills in ${skillIntersections.map((i) => i.label).join(', ')}`);
      }
    }

    // Complementary skills reason
    if (result.scoreBreakdown.complementarySkillsScore >= 50) {
      reasons.push('Has complementary skills to yours');
    }

    // Interest reasons
    if (result.scoreBreakdown.interestScore >= 50) {
      const interestIntersections = result.intersections.filter((i) => i.type === 'interest');
      if (interestIntersections.length > 0) {
        reasons.push(`Shares interests in ${interestIntersections.map((i) => i.label).join(', ')}`);
      }
    }

    // Hobby reasons
    if (result.scoreBreakdown.hobbyScore >= 50) {
      const hobbyIntersections = result.intersections.filter((i) => i.type === 'hobby');
      if (hobbyIntersections.length > 0) {
        reasons.push(`Enjoys ${hobbyIntersections.map((i) => i.label).join(', ')}`);
      }
    }

    // Company match
    const companyMatch = result.intersections.find((i) => i.type === 'company');
    if (companyMatch) {
      reasons.push(`Connected through ${companyMatch.label}`);
    }

    // Location match
    const locationMatch = result.intersections.find((i) => i.type === 'location');
    if (locationMatch) {
      reasons.push(`Both based in ${locationMatch.label}`);
    }

    // Active relationship
    if (result.scoreBreakdown.interactionScore >= 60) {
      reasons.push('You have an active relationship');
    }

    // Default reason if none
    if (reasons.length === 0) {
      reasons.push('Potential connection based on profile analysis');
    }

    return reasons;
  }

  /**
   * Generate 6 amazing ice breaker messages for reaching out
   * Returns messages separated by newlines for frontend to split and display
   */
  private generateSuggestedMessage(result: MatchResult, contact: any, user: any): string {
    const name = contact.fullName?.split(' ')[0] || 'there';
    const goals = result.goalAlignment?.matchedGoals || [];
    const company = contact.company || 'your company';
    const jobTitle = contact.jobTitle || 'your role';
    const messages: string[] = [];

    // Get intersection labels for personalization
    const sectorIntersections = result.intersections.filter((i) => i.type === 'sector');
    const skillIntersections = result.intersections.filter((i) => i.type === 'skill');
    const interestIntersections = result.intersections.filter((i) => i.type === 'interest');
    const sector = sectorIntersections[0]?.label || 'our industry';
    const skill = skillIntersections[0]?.label || '';
    const interest = interestIntersections[0]?.label || '';

    // 1. Goal-based opener (always first)
    if (goals.includes('Mentorship')) {
      messages.push(`Hi ${name}! Your journey in ${sector} is truly inspiring. I'd be honored to learn from someone who has achieved what I aspire to.`);
    } else if (goals.includes('Investment')) {
      messages.push(`Hi ${name}! I'm building something exciting and your investment expertise in ${sector} caught my attention. Would love 15 minutes of your time.`);
    } else if (goals.includes('Partnership')) {
      messages.push(`Hi ${name}! I've been thinking about potential collaborations, and your work at ${company} aligns perfectly with what I'm building.`);
    } else if (goals.includes('Job opportunity')) {
      messages.push(`Hi ${name}! Your role at ${company} is exactly where I see my career heading. I'd value any insights you could share.`);
    } else if (goals.includes('Collaboration')) {
      messages.push(`Hi ${name}! Our complementary skills could create something remarkable together. I'd love to explore what that might look like.`);
    } else {
      messages.push(`Hi ${name}! Your professional journey caught my attention and I'd love to connect with someone who shares similar passions.`);
    }

    // 2. Shared sector/industry opener
    if (sectorIntersections.length > 0) {
      messages.push(`Hey ${name}! Fellow ${sector} professional here. I find it's always valuable to connect with others who understand the unique challenges of our field.`);
    } else {
      messages.push(`Hey ${name}! I believe the most interesting connections happen across industries. Your perspective from ${sector} would be fascinating to hear.`);
    }

    // 3. Skills-focused message
    if (skill) {
      messages.push(`Hi ${name}! I noticed your expertise in ${skill} - it's an area I'm deeply passionate about too. Would love to exchange ideas sometime.`);
    } else if (skillIntersections.length === 0 && result.scoreBreakdown.complementarySkillsScore > 30) {
      messages.push(`Hi ${name}! What excites me about connecting is that your skillset complements mine perfectly. Together we could tackle challenges neither of us could alone.`);
    } else {
      messages.push(`Hi ${name}! Your skill set is impressive. I'm always looking to learn from people who excel in areas I'm working to develop.`);
    }

    // 4. Interest/hobby based casual opener
    if (interest) {
      messages.push(`Hey ${name}! Beyond work, I noticed we share an interest in ${interest}. Sometimes the best professional relationships start with common passions!`);
    } else {
      messages.push(`Hey ${name}! I believe great professional relationships go beyond just business. Would love to grab coffee and learn what drives you.`);
    }

    // 5. Value proposition message
    if (goals.includes('Mentorship')) {
      messages.push(`Hi ${name}! I'm not just looking to take - I'd love to hear about challenges you're facing where my fresh perspective might help.`);
    } else if (goals.includes('Collaboration')) {
      messages.push(`Hi ${name}! I've been working on some ideas that I think could benefit from your expertise. Happy to share more if you're curious.`);
    } else if (goals.includes('Partnership')) {
      messages.push(`Hi ${name}! I see real potential for us to create value together. Let me know if you'd be open to exploring what that could look like.`);
    } else {
      messages.push(`Hi ${name}! I believe in building relationships where both sides grow. I'd love to learn about your goals and see if I can contribute somehow.`);
    }

    // 6. Casual, low-pressure closer
    const casualClosers = [
      `Hey ${name}! No pressure at all - just thought I'd reach out. Even a quick virtual coffee chat would be great. What do you say?`,
      `Hi ${name}! I know you're busy, so even a 10-minute call would mean a lot. Let me know what works for your schedule!`,
      `Hey ${name}! If you're ever free for a casual chat, I'd love to hear about your journey. No agenda - just genuine curiosity!`,
    ];
    messages.push(casualClosers[Math.floor(Math.random() * casualClosers.length)]);

    return messages.join('\n');
  }

  /**
   * Get recommendation reason based on match analysis
   */
  private getRecommendationReason(match: MatchResult): string {
    // Goal-based reasons first
    if (match.goalAlignment && match.goalAlignment.matchedGoals.length > 0) {
      return `Strong ${match.goalAlignment.matchedGoals[0].toLowerCase()} match`;
    }

    if (match.scoreBreakdown.goalAlignmentScore >= 60) {
      return 'Aligns with your networking goals';
    }

    if (match.score >= 70) {
      return 'Strong profile match - high potential connection';
    }

    if (match.scoreBreakdown.complementarySkillsScore >= 60) {
      return 'Has complementary skills to collaborate';
    }

    if (match.scoreBreakdown.sectorScore >= 60) {
      return "Works in a sector you're interested in";
    }

    if (match.scoreBreakdown.skillScore >= 60) {
      return 'Shares key skills with you';
    }

    if (match.intersections.length > 0) {
      return `Shared connection: ${match.intersections[0].label}`;
    }

    return 'Recommended based on your network';
  }
}
