/**
 * Hybrid Matching Service
 *
 * Combines deterministic scoring with Recombee's collaborative filtering
 * for enhanced contact matching. Uses a weighted blend of:
 * - Deterministic score (profile-based matching)
 * - Recombee score (collaborative filtering)
 *
 * Falls back to deterministic-only when Recombee is unavailable.
 *
 * @module infrastructure/external/matching/HybridMatchingService
 */

import {
  IMatchingService,
  MatchResult,
  MatchQueryOptions,
  IntersectionPoint,
  DailyRecommendation,
} from '../../../domain/services/IMatchingService';
import { DeterministicMatchingService } from './DeterministicMatchingService';
import { RecombeeService } from '../recommendation/RecombeeService';
import { prisma } from '../../database/prisma/client';
import { logger } from '../../../shared/logger';
import { cacheService, CACHE_KEYS, CACHE_TTL } from '../../cache/CacheService';

/**
 * Hybrid score weights
 */
const HYBRID_WEIGHTS = {
  deterministic: 0.7, // 70% deterministic (profile-based)
  recombee: 0.3,       // 30% collaborative filtering
};

/**
 * Hybrid Matching Service
 *
 * Blends deterministic and collaborative filtering approaches.
 */
export class HybridMatchingService implements IMatchingService {
  private deterministicService: DeterministicMatchingService;
  private recombeeService: RecombeeService;
  private recombeeAvailable: boolean = false;

  constructor() {
    this.deterministicService = new DeterministicMatchingService();
    this.recombeeService = new RecombeeService();

    // Check availability on init
    this.initializeRecombee();
  }

  /**
   * Initialize Recombee connection
   */
  private async initializeRecombee(): Promise<void> {
    try {
      this.recombeeAvailable = await this.recombeeService.isAvailable();
      if (this.recombeeAvailable) {
        logger.info('HybridMatchingService: Recombee is available');
      } else {
        logger.info('HybridMatchingService: Recombee not available, using deterministic only');
      }
    } catch (error) {
      logger.warn('HybridMatchingService: Failed to check Recombee availability', { error });
      this.recombeeAvailable = false;
    }
  }

  /**
   * Get ranked matches with hybrid scoring
   */
  async getMatches(userId: string, options?: MatchQueryOptions, organizationId?: string): Promise<MatchResult[]> {
    // Get deterministic matches
    const deterministicMatches = await this.deterministicService.getMatches(userId, {
      ...options,
      limit: (options?.limit ?? 20) * 2, // Get more to blend
    }, organizationId);

    // If Recombee not available, return deterministic only
    if (!this.recombeeAvailable) {
      return deterministicMatches.slice(0, options?.limit ?? 20);
    }

    try {
      // Get Recombee recommendations
      const recombeeRecommendations = await this.recombeeService.getRecommendations(userId, {
        count: (options?.limit ?? 20) * 2,
        scenario: 'contact_match',
        returnProperties: false,
      });

      // Create score map from Recombee (itemId -> score)
      const recombeeScores = new Map<string, number>();
      recombeeRecommendations.forEach((rec) => {
        // Recombee score is 0-1, convert to 0-100
        recombeeScores.set(rec.itemId, rec.score * 100);
      });

      // Blend scores
      const blendedResults: MatchResult[] = deterministicMatches.map((match) => {
        const recombeeScore = recombeeScores.get(match.contactId) || 0;

        // Weighted blend
        const blendedScore = Math.round(
          match.score * HYBRID_WEIGHTS.deterministic +
          recombeeScore * HYBRID_WEIGHTS.recombee
        );

        return {
          ...match,
          score: Math.min(100, blendedScore),
          // Add indicator that Recombee was used
          reasons: recombeeScore > 0
            ? [...(match.reasons || []), 'Recommended by similar users']
            : match.reasons,
        };
      });

      // Add any Recombee-only recommendations not in deterministic results
      const existingContactIds = new Set(deterministicMatches.map((m) => m.contactId));
      for (const rec of recombeeRecommendations) {
        if (!existingContactIds.has(rec.itemId)) {
          // Get basic contact info - scope by organization context
          const contactWhere = organizationId
            ? { id: rec.itemId, organizationId }
            : { id: rec.itemId, ownerId: userId };

          const contact = await prisma.contact.findFirst({
            where: contactWhere,
            select: { id: true },
          });

          if (contact) {
            // Add as Recombee-only recommendation
            blendedResults.push({
              contactId: rec.itemId,
              score: Math.round(rec.score * 100 * HYBRID_WEIGHTS.recombee),
              scoreBreakdown: {
                goalAlignmentScore: 0,
                sectorScore: 0,
                skillScore: 0,
                complementarySkillsScore: 0,
                recencyScore: 0,
                interactionScore: 0,
                interestScore: 0,
                hobbyScore: 0,
              },
              intersections: [],
              reasons: ['Recommended by users with similar preferences'],
            });
          }
        }
      }

      // Sort by blended score and apply limit
      blendedResults.sort((a, b) => b.score - a.score);
      return blendedResults.slice(0, options?.limit ?? 20);
    } catch (error) {
      logger.warn('HybridMatchingService: Recombee failed, using deterministic only', { error });
      return deterministicMatches.slice(0, options?.limit ?? 20);
    }
  }

  /**
   * Get detailed match with hybrid scoring
   *
   * IMPORTANT: This method now applies the same hybrid blending as getMatches
   * to ensure consistency between list and detail views.
   */
  async getMatchDetails(userId: string, contactId: string, organizationId?: string): Promise<MatchResult | null> {
    // Get deterministic result
    const deterministicResult = await this.deterministicService.getMatchDetails(userId, contactId, organizationId);

    if (!deterministicResult) {
      return null;
    }

    // If Recombee not available, return deterministic only
    if (!this.recombeeAvailable) {
      logger.debug('[HybridMatchDetails] Recombee not available, using deterministic only', {
        userId,
        contactId,
        score: deterministicResult.score,
      });
      return deterministicResult;
    }

    try {
      // Get Recombee score for this specific contact
      const recombeeRecommendations = await this.recombeeService.getRecommendations(userId, {
        count: 100, // Get enough to find this contact
        scenario: 'contact_match',
        returnProperties: false,
      });

      // Find the Recombee score for this contact
      const recombeeRec = recombeeRecommendations.find((rec) => rec.itemId === contactId);
      const recombeeScore = recombeeRec ? recombeeRec.score * 100 : 0;

      // Apply same hybrid blending as getMatches
      const blendedScore = Math.round(
        deterministicResult.score * HYBRID_WEIGHTS.deterministic +
        recombeeScore * HYBRID_WEIGHTS.recombee
      );

      logger.info('[HybridMatchDetails] Applied hybrid blending', {
        userId,
        contactId,
        deterministicScore: deterministicResult.score,
        recombeeScore: Math.round(recombeeScore),
        blendedScore,
        weights: HYBRID_WEIGHTS,
      });

      return {
        ...deterministicResult,
        score: Math.min(100, blendedScore),
        reasons: recombeeScore > 0
          ? [...(deterministicResult.reasons || []), 'Recommended by similar users']
          : deterministicResult.reasons,
      };
    } catch (error) {
      logger.warn('[HybridMatchDetails] Recombee failed, using deterministic only', {
        userId,
        contactId,
        error,
      });
      return deterministicResult;
    }
  }

  /**
   * Get intersections (delegates to deterministic)
   */
  async getIntersections(userId: string, contactId: string, organizationId?: string): Promise<IntersectionPoint[]> {
    return this.deterministicService.getIntersections(userId, contactId, organizationId);
  }

  /**
   * Get daily recommendations with hybrid scoring
   */
  async getDailyRecommendations(userId: string, count: number = 3, organizationId?: string): Promise<DailyRecommendation[]> {
    // Use hybrid matches for better daily recommendations
    const matches = await this.getMatches(userId, {
      limit: count * 2,
      minScore: 30,
    }, organizationId);

    // Get recent interactions to filter out recently contacted
    const recentInteractions = await prisma.interaction.findMany({
      where: {
        userId,
        occurredAt: {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        },
      },
      select: { contactId: true },
    });

    const recentContactIds = new Set(recentInteractions.map((i) => i.contactId));

    // Filter and build recommendations
    const recommendations: DailyRecommendation[] = [];

    for (const match of matches) {
      if (recommendations.length >= count) break;

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
   * Recalculate score (delegates to deterministic)
   */
  async recalculateScore(userId: string, contactId: string, organizationId?: string): Promise<number> {
    return this.deterministicService.recalculateScore(userId, contactId, organizationId);
  }

  /**
   * Sync user to Recombee for collaborative filtering
   */
  async syncUserToRecombee(userId: string): Promise<void> {
    if (!this.recombeeAvailable) return;

    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
          userSectors: { include: { sector: true } },
          userSkills: { include: { skill: true } },
          userGoals: { where: { isActive: true } },
        },
      });

      if (!user) return;

      await this.recombeeService.setUserProperties(userId, {
        sectors: user.userSectors.map((s) => s.sector.name),
        skills: user.userSkills.map((s) => s.skill.name),
        goals: user.userGoals.map((g) => g.goalType),
        company: user.company || undefined,
        jobTitle: user.jobTitle || undefined,
      });

      logger.debug('Synced user to Recombee', { userId });
    } catch (error) {
      logger.warn('Failed to sync user to Recombee', { userId, error });
    }
  }

  /**
   * Sync contact to Recombee as an item
   */
  async syncContactToRecombee(contactId: string): Promise<void> {
    if (!this.recombeeAvailable) return;

    try {
      const contact = await prisma.contact.findUnique({
        where: { id: contactId },
        include: {
          contactSectors: { include: { sector: true } },
          contactSkills: { include: { skill: true } },
        },
      });

      if (!contact) return;

      await this.recombeeService.setItemProperties(contactId, {
        sectors: contact.contactSectors.map((s) => s.sector.name),
        skills: contact.contactSkills.map((s) => s.skill.name),
        company: contact.company || undefined,
        jobTitle: contact.jobTitle || undefined,
        ownerId: contact.ownerId,
      });

      logger.debug('Synced contact to Recombee', { contactId });
    } catch (error) {
      logger.warn('Failed to sync contact to Recombee', { contactId, error });
    }
  }

  /**
   * Track interaction in Recombee
   */
  async trackInteraction(
    userId: string,
    contactId: string,
    interactionType: 'view' | 'save' | 'message' | 'meeting' | 'dismiss'
  ): Promise<void> {
    if (!this.recombeeAvailable) return;

    try {
      await this.recombeeService.trackInteraction(userId, contactId, interactionType);
      logger.debug('Tracked interaction in Recombee', { userId, contactId, interactionType });
    } catch (error) {
      logger.warn('Failed to track interaction in Recombee', { userId, contactId, error });
    }
  }

  /**
   * Check if Recombee is being used
   */
  isRecombeeEnabled(): boolean {
    return this.recombeeAvailable;
  }

  /**
   * Get recommendation reason based on match
   */
  private getRecommendationReason(match: MatchResult): string {
    // Check if Recombee contributed
    if (match.reasons?.includes('Recommended by similar users')) {
      return 'Popular with similar professionals';
    }

    if (match.goalAlignment && match.goalAlignment.matchedGoals.length > 0) {
      return `Strong ${match.goalAlignment.matchedGoals[0].toLowerCase()} match`;
    }

    if (match.scoreBreakdown.goalAlignmentScore >= 60) {
      return 'Aligns with your networking goals';
    }

    if (match.score >= 70) {
      return 'Strong profile match';
    }

    if (match.scoreBreakdown.complementarySkillsScore >= 60) {
      return 'Has complementary skills';
    }

    if (match.intersections.length > 0) {
      return `Shared connection: ${match.intersections[0].label}`;
    }

    return 'Recommended based on your network';
  }
}

// Export singleton instance
export const hybridMatchingService = new HybridMatchingService();
