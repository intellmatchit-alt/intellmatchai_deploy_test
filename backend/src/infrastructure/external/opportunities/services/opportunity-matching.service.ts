/**
 * Opportunity Matching Service
 *
 * Main orchestration service for Jobs/Opportunities matching.
 * Pipeline:
 * 1. Load intent and user profile
 * 2. Find candidates
 * 3. Parse candidate data (role family, track, seniority, experience)
 * 4. Apply hard filters (PASS/FAIL/REVIEW)
 * 5. Score candidates (deterministic)
 * 6. AI validation (optional, cannot override FAIL)
 * 7. Generate explanations
 * 8. Save matches
 *
 * @module services/opportunity-matching.service
 */

import { PrismaClient, OpportunityMatch, OpportunityMatchStatus } from '@prisma/client';
import { logger } from '../../../../shared/logger';
import {
  MatchCandidate,
  MatchResult,
  IntentWithDetails,
  UserProfile,
  MatchingConfig,
  DEFAULT_MATCHING_CONFIG,
  DEFAULT_SCORING_WEIGHTS,
  NETWORKING_SCORING_WEIGHTS,
  INTENT_THRESHOLDS,
  HardFilterStatus,
  MatchLevel,
  ConfidenceLevel,
  RoleFamily,
  CareerTrack,
  ParsedSeniority,
  ParsedExperience,
  ScoringWeights,
  applyConfidenceCap,
  scoreToMatchLevel,
  MatchingStats,
  IntentThresholds,
} from '../types/opportunity-matching.types';
import {
  scoreCandidate,
  normalizeToRoleFamily,
  inferCareerTrack,
  parseSeniority,
  parseExperience,
  applyHardFilters,
  calculateConfidence,
  areRoleFamiliesCompatible,
} from '../utils/opportunity-scoring.utils';
import { opportunityLLMService } from './opportunity-llm.service';

// ============================================================================
// Service Class
// ============================================================================

export class OpportunityMatchingService {
  private prisma: PrismaClient;
  private config: MatchingConfig;

  /**
   * Statistics from the most recent matching run. Reset on each invocation of
   * findMatchesForIntent. Exposed via getLastMatchStats() for worker reporting.
   */
  private lastMatchStats: MatchingStats | null = null;

  constructor(prisma: PrismaClient, config: Partial<MatchingConfig> = {}) {
    this.prisma = prisma;
    this.config = { ...DEFAULT_MATCHING_CONFIG, ...config };
  }

  /**
   * Retrieve statistics from the last matching run. Returns null if no matches have been run yet.
   */
  public getLastMatchStats(): MatchingStats | null {
    return this.lastMatchStats;
  }

  // ============================================================================
  // Main Pipeline
  // ============================================================================

  /**
   * Find matches for a user's opportunity intent
   * This is the main entry point
   */
  async findMatchesForIntent(
    userId: string,
    intentId?: string,
    organizationId?: string
  ): Promise<MatchResult[]> {
    const startTime = Date.now();
    // Initialize statistics object for this run
    const stats: MatchingStats = {
      totalCandidates: 0,
      passedHardFilters: 0,
      failedHardFilters: 0,
      reviewCandidates: 0,
      scoredCandidates: 0,
      filteredOutDeterministic: 0,
      filteredOutPostAI: 0,
      finalMatches: 0,
    };

    logger.info('Starting opportunity matching', {
      userId,
      intentId,
      organizationId,
      config: this.config,
    });

    try {
      // Step 1: Load intent with preferences
      const intent = await this.getIntentWithDetails(userId, intentId);
      if (!intent) {
        throw new Error('No active opportunity intent found');
      }

      logger.info('Loaded intent', {
        intentType: intent.intentType,
        roleArea: intent.roleArea,
        seniority: intent.seniority,
        skillCount: intent.skillPrefs.length,
        sectorCount: intent.sectorPrefs.length,
      });

      // Step 2: Load user profile
      const user = await this.getUserProfile(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Compute effective thresholds for this intent type (enforces stricter rules for HIRING)
      const thresholds = this.getEffectiveThresholds(intent.intentType);

      // Step 3: Find candidates
      const rawCandidates = await this.findAllCandidates(intent, userId, organizationId);
      stats.totalCandidates = rawCandidates.length;

      if (rawCandidates.length === 0) {
        logger.warn('No candidates found for matching', { userId, intentId });
        this.lastMatchStats = stats;
        return [];
      }

      // Step 3.5: Pre-filter obvious mismatches before expensive enrichment/scoring
      const prefilteredCandidates = this.prefilterCandidates(intent, rawCandidates);

      if (prefilteredCandidates.length === 0) {
        logger.info('No candidates after prefiltering', {
          userId,
          intentId,
          totalCandidates: rawCandidates.length,
        });
        this.lastMatchStats = stats;
        return [];
      }

      // Step 4: Parse and enrich candidate data
      const enrichedCandidates = prefilteredCandidates.map(c => this.enrichCandidate(c, intent.roleArea));

      // Step 5: Apply hard filters
      const filterResults = enrichedCandidates.map(candidate => ({
        candidate,
        filter: applyHardFilters(intent, candidate, {
          // Use intent-specific required skill coverage threshold (stricter for HIRING)
          minRequiredSkillCoverage: thresholds.minRequiredSkillCoverage,
          strictLocationMatching: this.config.strictLocationMatching,
        }),
      }));

      // Separate by filter status
      const passed = filterResults.filter(r => r.filter.status === HardFilterStatus.PASS);
      const review = filterResults.filter(r => r.filter.status === HardFilterStatus.REVIEW);
      const failed = filterResults.filter(r => r.filter.status === HardFilterStatus.FAIL);

      stats.passedHardFilters = passed.length;
      stats.reviewCandidates = review.length;
      stats.failedHardFilters = failed.length;

      logger.info('Hard filter results', {
        passed: passed.length,
        review: review.length,
        failed: failed.length,
        failReasons: this.aggregateFilterReasons(failed),
      });

      // Include PASS and REVIEW candidates for scoring
      const candidatesToScore = [...passed, ...review].map(r => r.candidate);

      // Step 6: Score candidates
      const scoredResults = this.scoreAllCandidates(intent, user, candidatesToScore, thresholds.minDeterministicScore);
      stats.scoredCandidates = scoredResults.length;
      // Count how many were removed by deterministic threshold
      stats.filteredOutDeterministic = candidatesToScore.length - scoredResults.length;

      logger.info('Scored candidates', {
        count: scoredResults.length,
        topScore: scoredResults[0]?.score,
        avgScore: scoredResults.length > 0 ? Math.round(scoredResults.reduce((a, b) => a + b.score, 0) / scoredResults.length) : 0,
      });

      // Step 7: AI validation for top candidates
      // Determine how many candidates to validate with AI
      const validationBatchSize = Math.max(0, this.config.aiValidationBatchSize || 0);
      const topForValidation = scoredResults.slice(0, validationBatchSize > 0 ? validationBatchSize : scoredResults.length);

      // Perform AI validation only on the top subset. Returns adjusted candidates in the same order.
      const aiValidatedSubset = await this.performAIValidation(intent, topForValidation);

      // Merge validated subset back with the rest of scored results. Use candidateId for identity.
      const validatedMap: Map<string, MatchResult> = new Map(
        aiValidatedSubset.map(v => [v.candidateId, v])
      );
      const combinedResults: MatchResult[] = scoredResults.map(candidate => {
        const validated = validatedMap.get(candidate.candidateId);
        return validated ? validated : candidate;
      });

      // Filter using the same post-AI threshold for all candidates
      const afterAIThreshold = combinedResults.filter(c => c.score >= thresholds.minPostAIScore);
      stats.filteredOutPostAI = combinedResults.length - afterAIThreshold.length;

      // Sort combined results using stable comparator
      const sortedAfterAI = afterAIThreshold.sort((a, b) => this.compareMatchResults(a, b));

      // Step 8: Generate explanations for top subset
      const explanationBatchSize = Math.max(0, this.config.explanationBatchSize || 0);
      const topForExplanations = sortedAfterAI.slice(0, explanationBatchSize > 0 ? explanationBatchSize : sortedAfterAI.length);
      const explainedTop = await this.generateMatchExplanations(intent, topForExplanations);

      // Build a map of explained results for quick lookup
      const explainedMap: Map<string, MatchResult> = new Map(explainedTop.map(e => [e.candidateId, e]));

      // Attach explanations or fallback to all candidates in sorted order
      const finalMatches: MatchResult[] = sortedAfterAI.map(c => {
        const explained = explainedMap.get(c.candidateId);
        if (explained) return explained;
        // Fallback explanation
        return {
          ...c,
          suggestedAction: this.getFallbackAction(intent.intentType),
          suggestedMessage: this.getFallbackMessage(intent.intentType, c),
          nextSteps: this.getFallbackNextSteps(intent.intentType),
        };
      });

      stats.finalMatches = finalMatches.length;

      // Step 9: Save matches
      await this.saveMatches(intent.id, finalMatches);

      // Step 10: Update lastMatchedAt
      await this.prisma.opportunityIntent.update({
        where: { id: intent.id },
        data: { lastMatchedAt: new Date() },
      });

      const durationMs = Date.now() - startTime;

      // Persist stats to instance for external consumption (worker)
      this.lastMatchStats = stats;

      logger.info('Opportunity matching completed', {
        userId,
        intentType: intent.intentType,
        stats,
        durationMs,
        aiProvider: opportunityLLMService.getActiveProvider(),
      });

      return finalMatches;
    } catch (error) {
      const durationMs = Date.now() - startTime;
      logger.error('Opportunity matching failed', {
        userId,
        intentId,
        durationMs,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  }

  /**
   * Aggregate filter reasons for logging
   */
  private aggregateFilterReasons(failed: Array<{ filter: { reasons: any[] } }>): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const f of failed) {
      for (const reason of f.filter.reasons) {
        counts[reason] = (counts[reason] || 0) + 1;
      }
    }
    return counts;
  }

  // ============================================================================
  // Data Loading
  // ============================================================================

  /**
   * Get intent with all preferences
   */
  private async getIntentWithDetails(
    userId: string,
    intentId?: string
  ): Promise<IntentWithDetails | null> {
    const where: any = {
      userId,
      isActive: true,
    };

    if (intentId) {
      where.id = intentId;
    }

    const intent = await this.prisma.opportunityIntent.findFirst({
      where,
      include: {
        sectorPrefs: {
          include: { sector: true },
        },
        skillPrefs: {
          include: { skill: true },
        },
      },
    });

    if (!intent) return null;

    return {
      id: intent.id,
      userId: intent.userId,
      intentType: intent.intentType,
      roleArea: intent.roleArea,
      seniority: intent.seniority,
      locationPref: intent.locationPref,
      remoteOk: intent.remoteOk ?? false,
      isActive: intent.isActive,
      sectorPrefs: intent.sectorPrefs,
      skillPrefs: intent.skillPrefs.map(sp => ({
        ...sp,
        isRequired: (sp as any).isRequired ?? false,
      })),
      languageReqs: (intent as any).languages || (intent as any).languageReqs || [],
      minExperienceYears: (intent as any).minExperienceYears || null,
      lastMatchedAt: intent.lastMatchedAt,
    };
  }

  /**
   * Get user profile
   */
  private async getUserProfile(userId: string): Promise<UserProfile | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        userSectors: { include: { sector: true } },
        userSkills: { include: { skill: true } },
        userGoals: { where: { isActive: true } },
        userInterests: { include: { interest: true } },
        userHobbies: { include: { hobby: true } },
      },
    });

    if (!user) return null;

    return {
      id: user.id,
      fullName: user.fullName,
      company: user.company,
      jobTitle: user.jobTitle,
      bio: user.bio,
      location: user.location,
      userSectors: user.userSectors,
      userSkills: user.userSkills,
      userGoals: user.userGoals,
      userInterests: user.userInterests,
      userHobbies: user.userHobbies,
    };
  }

  // ============================================================================
  // Candidate Finding
  // ============================================================================

  /**
   * Find all candidates
   */
  private async findAllCandidates(
    intent: IntentWithDetails,
    userId: string,
    organizationId?: string
  ): Promise<MatchCandidate[]> {
    const contactCandidates = await this.findContactCandidates(intent, userId, organizationId);

    let userCandidates: MatchCandidate[] = [];
    if (this.config.enableUserMatching) {
      const user = await this.getUserProfile(userId);
      if (user) {
        userCandidates = await this.findUserCandidates(intent, user);
      }
    }

    return [...contactCandidates, ...userCandidates];
  }

  /**
   * Find contact candidates
   */
  private async findContactCandidates(
    intent: IntentWithDetails,
    userId: string,
    organizationId?: string
  ): Promise<MatchCandidate[]> {
    const where: any = {
      OR: [
        { ownerId: userId },
        ...(organizationId ? [{ organizationId }] : []),
      ],
    };

    // Exclude already matched contacts in last 7 days
    const recentMatches = await this.prisma.opportunityMatch.findMany({
      where: {
        intentId: intent.id,
        createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        matchedContactId: { not: null },
      },
      select: { matchedContactId: true },
    });

    const excludeIds = recentMatches
      .map(m => m.matchedContactId)
      .filter((id): id is string => id !== null);

    if (excludeIds.length > 0) {
      where.id = { notIn: excludeIds };
    }

    const contacts = await this.prisma.contact.findMany({
      where,
      take: this.config.maxContactCandidates,
      include: {
        contactSectors: { include: { sector: true } },
        contactSkills: { include: { skill: true } },
        contactInterests: { include: { interest: true } },
        contactHobbies: { include: { hobby: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });

    return contacts.map(c => this.mapContactToCandidate(c));
  }

  /**
   * Find user candidates
   */
  private async findUserCandidates(
    intent: IntentWithDetails,
    currentUser: UserProfile
  ): Promise<MatchCandidate[]> {
    // Find users with matching opportunity intent
    const users = await this.prisma.user.findMany({
      where: {
        id: { not: currentUser.id },
        opportunityIntents: {
          some: {
            isActive: true,
            intentType: { in: ['OPEN_TO_OPPORTUNITIES', 'HIRING'] },
          },
        },
      },
      take: this.config.maxUserCandidates,
      include: {
        userSectors: { include: { sector: true } },
        userSkills: { include: { skill: true } },
        userGoals: { where: { isActive: true } },
        userInterests: { include: { interest: true } },
        userHobbies: { include: { hobby: true } },
        opportunityIntents: { where: { isActive: true }, take: 1 },
      },
    });

    return users.map(u => this.mapUserToCandidate(u));
  }

  /**
   * Map contact to candidate
   */
  private mapContactToCandidate(contact: any): MatchCandidate {
    return {
      type: 'contact',
      id: contact.id,
      name: contact.fullName || contact.name || 'Unknown',
      company: contact.company,
      jobTitle: contact.jobTitle,
      bio: contact.bio || contact.notes,
      location: contact.location,
      sectors: contact.contactSectors?.map((cs: any) => cs.sector.name) || [],
      skills: contact.contactSkills?.map((cs: any) => cs.skill.name) || [],
      interests: contact.contactInterests?.map((ci: any) => ci.interest.name) || [],
      hobbies: contact.contactHobbies?.map((ch: any) => ch.hobby.name) || [],
      goals: [],
      opportunityIntent: contact.opportunityIntent || null,
      roleFamily: RoleFamily.UNKNOWN,
      careerTrack: CareerTrack.UNKNOWN,
      seniority: { level: null, ladder: null, rank: 0 },
      experience: null,
      updatedAt: contact.updatedAt,
    };
  }

  /**
   * Map user to candidate
   */
  private mapUserToCandidate(user: any): MatchCandidate {
    return {
      type: 'user',
      id: user.id,
      name: user.fullName,
      company: user.company,
      jobTitle: user.jobTitle,
      bio: user.bio,
      location: user.location,
      sectors: user.userSectors?.map((us: any) => us.sector.name) || [],
      skills: user.userSkills?.map((us: any) => us.skill.name) || [],
      interests: user.userInterests?.map((ui: any) => ui.interest.name) || [],
      hobbies: user.userHobbies?.map((uh: any) => uh.hobby.name) || [],
      goals: user.userGoals?.map((ug: any) => ug.goalType) || [],
      opportunityIntent: user.opportunityIntents?.[0]?.intentType || null,
      roleFamily: RoleFamily.UNKNOWN,
      careerTrack: CareerTrack.UNKNOWN,
      seniority: { level: null, ladder: null, rank: 0 },
      experience: null,
      updatedAt: user.updatedAt,
    };
  }

  /**
   * Enrich candidate with parsed data
   */
  private enrichCandidate(candidate: MatchCandidate, targetRoleArea: string | null): MatchCandidate {
    const roleFamily = normalizeToRoleFamily(candidate.jobTitle);
    const careerTrack = inferCareerTrack(candidate.jobTitle);
    const seniority = parseSeniority(candidate.jobTitle);
    const targetFamily = normalizeToRoleFamily(targetRoleArea);
    const experience = parseExperience(candidate.workHistory, targetFamily);

    return {
      ...candidate,
      roleFamily,
      careerTrack,
      seniority,
      experience,
    };
  }

  // ============================================================================
  // Scoring
  // ============================================================================

  /**
   * Score all candidates
   */
  private scoreAllCandidates(
    intent: IntentWithDetails,
    user: UserProfile,
    candidates: MatchCandidate[],
    minScore: number
  ): MatchResult[] {
    const results: MatchResult[] = [];

    // Determine scoring weights based on intent type
    const scoringWeights = this.getScoringWeightsForIntent(intent.intentType);

    for (const candidate of candidates) {
      const result = scoreCandidate(intent, user, candidate, scoringWeights);

      // Apply minimum deterministic score filter (intent-specific)
      if (result.score >= minScore) {
        results.push(result);
      }
    }

    // Sort using stable comparator
    return results.sort((a, b) => this.compareMatchResults(a, b));
  }

  /**
   * Perform a lightweight prefilter on raw candidates before expensive enrichment and scoring.
   * This removes obvious mismatches while preserving recall. It checks role family compatibility,
   * executive/founder/board/advisor tracks, required skills presence, and optional strict
   * location matching. Only applies stricter checks for HIRING intents.
   */
  private prefilterCandidates(
    intent: IntentWithDetails,
    candidates: MatchCandidate[]
  ): MatchCandidate[] {
    const targetFamily = normalizeToRoleFamily(intent.roleArea);
    const requiredSkills = intent.skillPrefs
      .filter(sp => (sp as any).isRequired)
      .map(sp => (sp as any).skill?.name?.toLowerCase())
      .filter((s): s is string => !!s);
    const strictLocation = this.config.strictLocationMatching;
    const locationPref = intent.locationPref?.toLowerCase() || null;
    const remoteOk = intent.remoteOk;

    return candidates.filter(candidate => {
      // Determine candidate attributes quickly using jobTitle (raw candidate may not be enriched)
      const candidateFamily = normalizeToRoleFamily(candidate.jobTitle);
      const candidateTrack = inferCareerTrack(candidate.jobTitle);

      // HIRING-specific prefilters
      if (intent.intentType === 'HIRING') {
        // 1. Role family compatibility: if target is known and candidate's family is clearly incompatible,
        // and candidate is an executive/founder/board/advisor, drop.
        if (targetFamily !== RoleFamily.UNKNOWN) {
          const compatible =
            targetFamily === candidateFamily ||
            areRoleFamiliesCompatible(targetFamily, candidateFamily);
          if (!compatible) {
            if (
              candidateTrack === CareerTrack.EXECUTIVE ||
              candidateTrack === CareerTrack.FOUNDER ||
              candidateTrack === CareerTrack.BOARD ||
              candidateTrack === CareerTrack.ADVISOR
            ) {
              return false;
            }
          }
        }

        // 2. Career track mismatch with missing required skills: Executives/founders/board/advisors
        // lacking any required skills are unlikely to be valid IC candidates. If required skills
        // exist, ensure candidate has at least one; otherwise drop.
        if (
          (candidateTrack === CareerTrack.EXECUTIVE ||
            candidateTrack === CareerTrack.FOUNDER ||
            candidateTrack === CareerTrack.BOARD ||
            candidateTrack === CareerTrack.ADVISOR) &&
          requiredSkills.length > 0
        ) {
          const candidateSkills = (candidate.skills || []).map(s => s.toLowerCase());
          const hasRequired = requiredSkills.some(req => candidateSkills.includes(req));
          if (!hasRequired) {
            return false;
          }
        }

        // 3. Strict location matching: only if configured and intent has a specific location pref
        if (strictLocation && locationPref && !remoteOk) {
          const candidateLocation = candidate.location?.toLowerCase() || null;
          if (!candidateLocation || candidateLocation !== locationPref) {
            return false;
          }
        }
      }

      // Non-HIRING intents: apply optional location filter if strict matching is enabled
      if (intent.intentType !== 'HIRING' && strictLocation && locationPref && !remoteOk) {
        const candidateLocation = candidate.location?.toLowerCase() || null;
        if (!candidateLocation || candidateLocation !== locationPref) {
          return false;
        }
      }

      return true;
    });
  }

  /**
   * Select scoring weights based on intent type. HIRING uses default/hiring-optimized weights,
   * OPEN_TO_OPPORTUNITIES uses networking-oriented weights, and other intents fall back to
   * the stricter default. This ensures deterministic selection and preserves hiring strictness.
   */
  private getScoringWeightsForIntent(intentType: string): ScoringWeights {
    switch (intentType) {
      case 'OPEN_TO_OPPORTUNITIES':
      case 'REFERRALS_ONLY':
        return NETWORKING_SCORING_WEIGHTS;
      case 'ADVISORY_BOARD':
        // Advisory board and other networking-like intents use networking weights
        return NETWORKING_SCORING_WEIGHTS;
      case 'HIRING':
      default:
        return DEFAULT_SCORING_WEIGHTS;
    }
  }

  /**
   * Compare two MatchResult objects for stable sorting. Order by score descending, then
   * hard filter status (PASS before REVIEW), then confidenceScore descending, then candidateId.
   */
  private compareMatchResults(a: MatchResult, b: MatchResult): number {
    if (a.score !== b.score) {
      return b.score - a.score;
    }
    // Hard filter status: PASS (0) before REVIEW (1). FAIL should never appear here.
    const statusPriority = (status: HardFilterStatus) => {
      switch (status) {
        case HardFilterStatus.PASS:
          return 0;
        case HardFilterStatus.REVIEW:
          return 1;
        case HardFilterStatus.FAIL:
        default:
          return 2;
      }
    };
    const aStatus = statusPriority(a.hardFilterStatus);
    const bStatus = statusPriority(b.hardFilterStatus);
    if (aStatus !== bStatus) {
      return aStatus - bStatus;
    }
    // Confidence score descending
    if (a.confidenceScore !== b.confidenceScore) {
      return b.confidenceScore - a.confidenceScore;
    }
    // Tiebreaker: candidateId lexicographically
    return a.candidateId.localeCompare(b.candidateId);
  }

  // ============================================================================
  // AI Validation
  // ============================================================================

  /**
   * Get effective thresholds for intent type
   */
  private getEffectiveThresholds(intentType: string): IntentThresholds {
    const intentThreshold = INTENT_THRESHOLDS[intentType as keyof typeof INTENT_THRESHOLDS];
    return {
      minDeterministicScore: Math.max(
        this.config.minDeterministicScore,
        intentThreshold?.minDeterministicScore ?? this.config.minDeterministicScore
      ),
      minPostAIScore: Math.max(
        this.config.minPostAIScore,
        intentThreshold?.minPostAIScore ?? this.config.minPostAIScore
      ),
      minRequiredSkillCoverage: Math.max(
        this.config.minRequiredSkillCoverage,
        intentThreshold?.minRequiredSkillCoverage ?? this.config.minRequiredSkillCoverage
      ),
    };
  }

  /**
   * Perform AI validation on top candidates
   * IMPORTANT: AI cannot override hard filter FAIL
   * HARDENED: Handle fallback with confidence penalty
   */
  private async performAIValidation(
    intent: IntentWithDetails,
    candidates: MatchResult[]
  ): Promise<MatchResult[]> {
    if (candidates.length === 0) return [];

    const validationResult = await opportunityLLMService.validateCandidateRoles(
      intent,
      candidates,
      this.config.llmTimeoutMs
    );

    // Handle fallback (all providers failed)
    if (validationResult?.fallbackUsed) {
      logger.warn('AI validation fell back to deterministic scores', {
        reason: validationResult.fallbackReason,
      });

      // Apply confidence penalty for fallback but do NOT filter here; filtering handled by caller
      return candidates.map(candidate => {
        const reducedConfidence = Math.max(0, candidate.confidenceScore - 10);
        const { level: cappedLevel, reason: capReason } = applyConfidenceCap(
          candidate.matchLevel,
          reducedConfidence,
          candidate.isSparseProfile
        );

        return {
          ...candidate,
          confidenceScore: reducedConfidence,
          matchLevel: cappedLevel,
          levelCappedReason: capReason || candidate.levelCappedReason,
          aiValidated: false,
          aiNotes: `LLM unavailable: ${validationResult.fallbackReason}. Using deterministic score only.`,
        };
      });
    }

    if (!validationResult) {
      logger.warn('AI validation returned null, using deterministic scores');
      return candidates;
    }

    logger.info('AI validation completed', {
      provider: validationResult.provider,
      latencyMs: validationResult.latencyMs,
      candidatesValidated: candidates.length,
    });

    // Apply AI scores and adjustments
    const validated = candidates.map((candidate, idx) => {
      // AI cannot override FAIL
      if (candidate.hardFilterStatus === HardFilterStatus.FAIL) {
        return candidate;
      }

      const aiScore = validationResult.scores[idx] ?? 0; // Use 0 not 50 for missing
      const multiplier = this.aiScoreToMultiplier(aiScore);
      let adjustedScore = Math.round(candidate.score * multiplier);

      // Clamp adjusted score within 0..100
      adjustedScore = Math.min(100, Math.max(0, adjustedScore));

      const aiNote = validationResult.notes?.[idx] || null;

      // Compute new match level based on adjusted score
      const proposedLevel = scoreToMatchLevel(adjustedScore, candidate.hardFilterStatus);

      // Band-limiting: prevent rank jumps greater than one band up or down
      const levelOrder: MatchLevel[] = [
        MatchLevel.POOR,
        MatchLevel.WEAK,
        MatchLevel.GOOD,
        MatchLevel.VERY_GOOD,
        MatchLevel.EXCELLENT,
      ];
      const bandMin = [0, 21, 41, 61, 81];
      const bandMax = [20, 40, 60, 80, 100];
      const origIndex = levelOrder.indexOf(candidate.matchLevel);
      const newIndex = levelOrder.indexOf(proposedLevel);
      let finalIndex = newIndex;
      let finalScore = adjustedScore;

      // If new level is more than one band above original, cap at one band up and adjust score to upper bound
      if (newIndex > origIndex + 1) {
        finalIndex = origIndex + 1;
        finalScore = Math.min(finalScore, bandMax[finalIndex]);
      }
      // If new level is more than one band below original, cap at one band down and adjust score to lower bound
      else if (newIndex < origIndex - 1) {
        finalIndex = origIndex - 1;
        finalScore = Math.max(finalScore, bandMin[finalIndex]);
      }

      // Compute final match level after band-limiting
      const bandLimitedLevel = levelOrder[finalIndex];

      // Apply confidence cap
      const { level: cappedLevel, reason: capReason } = applyConfidenceCap(
        bandLimitedLevel,
        candidate.confidenceScore,
        candidate.isSparseProfile
      );

      return {
        ...candidate,
        score: finalScore,
        matchLevel: cappedLevel,
        levelCappedReason: capReason || candidate.levelCappedReason,
        aiValidated: true,
        aiNotes: aiNote,
      };
    });

    // Do not filter here; sorting handled by caller
    return validated;
  }

  /**
   * Convert AI score to multiplier
   */
  private aiScoreToMultiplier(aiScore: number): number {
    // Tightened impact: AI only nudges deterministic score within a narrow range.
    // High AI scores (>=80) yield up to +5% boost, mid scores around 0 change,
    // and low scores incur modest penalties. Boundaries prevent destabilizing rank jumps.
    if (aiScore >= 80) return 1.05;
    if (aiScore >= 60) return 1.02;
    if (aiScore >= 40) return 1.0;
    if (aiScore >= 20) return 0.98;
    return 0.95;
  }

  // ============================================================================
  // Explanation Generation
  // ============================================================================

  /**
   * Generate explanations for matches
   */
  private async generateMatchExplanations(
    intent: IntentWithDetails,
    candidates: MatchResult[]
  ): Promise<MatchResult[]> {
    if (candidates.length === 0) return [];

    const explanations = await opportunityLLMService.generateExplanationsBatch(
      intent,
      candidates,
      this.config.maxConcurrentLLMCalls,
      this.config.llmTimeoutMs
    );

    return candidates.map(candidate => {
      const explanation = explanations.get(candidate.candidateId);

      if (explanation) {
        return {
          ...candidate,
          suggestedAction: explanation.suggestedAction,
          suggestedMessage: explanation.suggestedMessage,
          nextSteps: explanation.nextSteps,
        };
      }

      // Fallback explanation
      return {
        ...candidate,
        suggestedAction: this.getFallbackAction(intent.intentType),
        suggestedMessage: this.getFallbackMessage(intent.intentType, candidate),
        nextSteps: this.getFallbackNextSteps(intent.intentType),
      };
    });
  }

  private getFallbackAction(intentType: string): string {
    switch (intentType) {
      case 'HIRING': return 'Send Message';
      case 'OPEN_TO_OPPORTUNITIES': return 'Connect';
      case 'ADVISORY_BOARD': return 'Request Intro';
      default: return 'Connect';
    }
  }

  private getFallbackMessage(intentType: string, candidate: MatchResult): string {
    const firstName = candidate.candidateName.split(' ')[0];
    switch (intentType) {
      case 'HIRING':
        return `Hi ${firstName}! I came across your profile and was impressed by your background. We have an opportunity that might interest you. Would you be open to a brief chat?`;
      case 'OPEN_TO_OPPORTUNITIES':
        return `Hi ${firstName}! I'm exploring new opportunities and would love to connect and learn more about your work at ${candidate.candidateCompany || 'your company'}.`;
      default:
        return `Hi ${firstName}! I came across your profile and thought we might have some interesting synergies. Would you be open to connecting?`;
    }
  }

  private getFallbackNextSteps(intentType: string): string[] {
    switch (intentType) {
      case 'HIRING':
        return ['Review their full profile', 'Prepare role details', 'Schedule intro call'];
      case 'OPEN_TO_OPPORTUNITIES':
        return ['Send connection request', 'Research their company', 'Prepare your pitch'];
      default:
        return ['Send connection request', 'Engage with their content', 'Find common ground'];
    }
  }

  // ============================================================================
  // Data Persistence
  // ============================================================================

  /**
   * Save matches to database
   */
  private async saveMatches(intentId: string, matches: MatchResult[]): Promise<void> {
    // Perform upserts and stale match archival in a single transaction to avoid race conditions
    await this.prisma.$transaction(async tx => {
      // Upsert or update all current matches
      for (const match of matches) {
        try {
          const matchData: any = {
            intentId,
            matchScore: match.score,
            matchType: match.candidateType,
            matchLevel: match.matchLevel,
            confidence: match.confidence,
            confidenceScore: match.confidenceScore,
            hardFilterStatus: match.hardFilterStatus,
            levelCappedReason: match.levelCappedReason,
            isSparseProfile: match.isSparseProfile,
            reasons: match.keyStrengths,
            risks: match.keyRisks,
            suggestedAction: match.suggestedAction,
            suggestedMessage: match.suggestedMessage,
            nextSteps: match.nextSteps,
            sharedSectors: match.sharedSectors,
            sharedSkills: match.sharedSkills,
            missingSkills: match.missingRequiredSkills,
            explanation: match.explanation,
            scoreBreakdown: match.componentScores,
            aiValidated: match.aiValidated,
            aiNotes: match.aiNotes,
            status: 'PENDING' as any,
          };

          if (match.candidateType === 'user') {
            matchData.matchedUserId = match.candidateId;
          } else {
            matchData.matchedContactId = match.candidateId;
          }

          const uniqueKey = match.candidateType === 'user'
            ? { intentId_matchedUserId: { intentId, matchedUserId: match.candidateId } }
            : { intentId_matchedContactId: { intentId, matchedContactId: match.candidateId } };

          await tx.opportunityMatch.upsert({
            where: uniqueKey as any,
            create: matchData,
            update: matchData,
          });
        } catch (error) {
          logger.warn('Failed to save opportunity match', {
            error: error instanceof Error ? error.message : 'Unknown',
            candidateId: match.candidateId,
          });
        }
      }

      // After upserts, archive stale matches not present in this run
      // Determine candidate IDs to keep
      const userIdsToKeep = matches
        .filter(m => m.candidateType === 'user')
        .map(m => m.candidateId);
      const contactIdsToKeep = matches
        .filter(m => m.candidateType === 'contact')
        .map(m => m.candidateId);

      // Define active statuses that can be archived safely (do not modify HIRED/REJECTED/ARCHIVED)
      const activeStatuses: any[] = [
        'PENDING',
        'CONTACTED',
        'RESPONDED',
        'SCHEDULED',
      ];

      // Archive stale user matches
      try {
        await tx.opportunityMatch.updateMany({
          where: {
            intentId,
            matchedUserId: {
              not: null,
              ...(userIdsToKeep.length > 0 ? { notIn: userIdsToKeep } : {}),
            },
            status: { in: activeStatuses },
          },
          data: { status: 'ARCHIVED' as any },
        });
      } catch (error) {
        logger.warn('Failed to archive stale user matches', {
          error: error instanceof Error ? error.message : 'Unknown',
        });
      }

      // Archive stale contact matches
      try {
        await tx.opportunityMatch.updateMany({
          where: {
            intentId,
            matchedContactId: {
              not: null,
              ...(contactIdsToKeep.length > 0 ? { notIn: contactIdsToKeep } : {}),
            },
            status: { in: activeStatuses },
          },
          data: { status: 'ARCHIVED' as any },
        });
      } catch (error) {
        logger.warn('Failed to archive stale contact matches', {
          error: error instanceof Error ? error.message : 'Unknown',
        });
      }
    });
  }

  // ============================================================================
  // Public Helpers
  // ============================================================================

  /**
   * Get matching statistics
   */
  async getMatchingStats(intentId: string): Promise<{
    totalMatches: number;
    avgScore: number;
    topScore: number;
    byMatchLevel: Record<string, number>;
    byStatus: Record<string, number>;
  }> {
    const matches = await this.prisma.opportunityMatch.findMany({
      where: { intentId },
      select: {
        matchScore: true,
        status: true,
        matchLevel: true,
      },
    });

    const byMatchLevel: Record<string, number> = {};
    const byStatus: Record<string, number> = {};
    let totalScore = 0;
    let topScore = 0;

    for (const match of matches) {
      totalScore += match.matchScore;
      topScore = Math.max(topScore, match.matchScore);

      const level = (match as any).matchLevel || 'UNKNOWN';
      byMatchLevel[level] = (byMatchLevel[level] || 0) + 1;

      byStatus[match.status] = (byStatus[match.status] || 0) + 1;
    }

    return {
      totalMatches: matches.length,
      avgScore: matches.length > 0 ? Math.round(totalScore / matches.length) : 0,
      topScore,
      byMatchLevel,
      byStatus,
    };
  }
}

// Factory function
export function createOpportunityMatchingService(
  prisma: PrismaClient,
  config?: Partial<MatchingConfig>
): OpportunityMatchingService {
  return new OpportunityMatchingService(prisma, config);
}
