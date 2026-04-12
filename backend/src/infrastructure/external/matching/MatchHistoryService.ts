/**
 * Match History Service
 *
 * Tracks historical match scores for analytics and trend analysis.
 * Stores snapshots of match calculations to enable:
 * - Score trend analysis over time
 * - ML model improvement
 * - User engagement analytics
 *
 * @module infrastructure/external/matching/MatchHistoryService
 */

import { prisma } from '../../database/prisma/client';
import { Prisma } from '@prisma/client';
import { logger } from '../../../shared/logger';
import { MatchResult } from '../../../domain/services/IMatchingService';

/**
 * Match history record input
 */
export interface MatchHistoryInput {
  userId: string;
  contactId: string;
  matchType?: 'contact' | 'project' | 'opportunity';
  matchResult: MatchResult;
  calculationMethod?: 'deterministic' | 'ai' | 'hybrid';
}

/**
 * Match history trend data
 */
export interface MatchTrend {
  contactId: string;
  contactName?: string;
  scores: Array<{
    date: Date;
    score: number;
  }>;
  currentScore: number;
  previousScore: number | null;
  trend: 'up' | 'down' | 'stable';
  changePercent: number | null;
}

/**
 * Match analytics summary
 */
export interface MatchAnalytics {
  totalMatches: number;
  averageScore: number;
  topScoreFactors: Array<{
    factor: string;
    averageContribution: number;
  }>;
  scoreDistribution: {
    excellent: number; // 80-100
    good: number;      // 60-79
    fair: number;      // 40-59
    low: number;       // 0-39
  };
}

/**
 * Match History Service
 */
export class MatchHistoryService {
  /**
   * Record a match history entry
   */
  async recordMatch(input: MatchHistoryInput): Promise<void> {
    const { userId, contactId, matchType = 'contact', matchResult, calculationMethod = 'deterministic' } = input;

    try {
      await prisma.matchHistory.create({
        data: {
          userId,
          contactId,
          matchType,
          totalScore: matchResult.score,
          goalAlignmentScore: matchResult.scoreBreakdown.goalAlignmentScore,
          sectorScore: matchResult.scoreBreakdown.sectorScore,
          skillScore: matchResult.scoreBreakdown.skillScore,
          semanticSimilarityScore: matchResult.scoreBreakdown.semanticSimilarityScore,
          networkProximityScore: matchResult.scoreBreakdown.networkProximityScore,
          complementarySkillsScore: matchResult.scoreBreakdown.complementarySkillsScore,
          recencyScore: matchResult.scoreBreakdown.recencyScore,
          interactionScore: matchResult.scoreBreakdown.interactionScore,
          interestScore: matchResult.scoreBreakdown.interestScore,
          hobbyScore: matchResult.scoreBreakdown.hobbyScore,
          networkDegree: matchResult.networkDegree,
          calculationMethod,
          intersections: matchResult.intersections as unknown as Prisma.InputJsonValue,
          reasons: matchResult.reasons as unknown as Prisma.InputJsonValue,
        },
      });

      logger.debug('Recorded match history', { userId, contactId, score: matchResult.score });
    } catch (error) {
      logger.error('Failed to record match history', {
        userId,
        contactId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Record multiple match history entries in batch
   */
  async recordBatchMatches(inputs: MatchHistoryInput[]): Promise<void> {
    if (inputs.length === 0) return;

    try {
      const data: Prisma.MatchHistoryCreateManyInput[] = inputs.map((input) => ({
        userId: input.userId,
        contactId: input.contactId,
        matchType: input.matchType || 'contact',
        totalScore: input.matchResult.score,
        goalAlignmentScore: input.matchResult.scoreBreakdown.goalAlignmentScore,
        sectorScore: input.matchResult.scoreBreakdown.sectorScore,
        skillScore: input.matchResult.scoreBreakdown.skillScore,
        semanticSimilarityScore: input.matchResult.scoreBreakdown.semanticSimilarityScore,
        networkProximityScore: input.matchResult.scoreBreakdown.networkProximityScore,
        complementarySkillsScore: input.matchResult.scoreBreakdown.complementarySkillsScore,
        recencyScore: input.matchResult.scoreBreakdown.recencyScore,
        interactionScore: input.matchResult.scoreBreakdown.interactionScore,
        interestScore: input.matchResult.scoreBreakdown.interestScore,
        hobbyScore: input.matchResult.scoreBreakdown.hobbyScore,
        networkDegree: input.matchResult.networkDegree,
        calculationMethod: input.calculationMethod || 'deterministic',
        intersections: input.matchResult.intersections as unknown as Prisma.InputJsonValue,
        reasons: input.matchResult.reasons as unknown as Prisma.InputJsonValue,
      }));

      await prisma.matchHistory.createMany({
        data,
        skipDuplicates: true,
      });

      logger.debug('Recorded batch match history', { count: inputs.length });
    } catch (error) {
      logger.error('Failed to record batch match history', {
        count: inputs.length,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Get match history for a specific contact
   */
  async getContactHistory(
    userId: string,
    contactId: string,
    limit: number = 30
  ): Promise<Array<{
    calculatedAt: Date;
    totalScore: number;
    scoreBreakdown: Record<string, number | null>;
  }>> {
    const history = await prisma.matchHistory.findMany({
      where: { userId, contactId },
      orderBy: { calculatedAt: 'desc' },
      take: limit,
    });

    return history.map((h) => ({
      calculatedAt: h.calculatedAt,
      totalScore: h.totalScore,
      scoreBreakdown: {
        goalAlignmentScore: h.goalAlignmentScore,
        sectorScore: h.sectorScore,
        skillScore: h.skillScore,
        semanticSimilarityScore: h.semanticSimilarityScore,
        networkProximityScore: h.networkProximityScore,
        complementarySkillsScore: h.complementarySkillsScore,
        recencyScore: h.recencyScore,
        interactionScore: h.interactionScore,
        interestScore: h.interestScore,
        hobbyScore: h.hobbyScore,
      },
    }));
  }

  /**
   * Get score trends for top contacts
   */
  async getScoreTrends(
    userId: string,
    daysBack: number = 30,
    limit: number = 10
  ): Promise<MatchTrend[]> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysBack);

    // Get contacts with history
    const contactsWithHistory = await prisma.matchHistory.groupBy({
      by: ['contactId'],
      where: {
        userId,
        calculatedAt: { gte: startDate },
      },
      _count: { id: true },
      _max: { totalScore: true },
      orderBy: { _max: { totalScore: 'desc' } },
      take: limit,
    });

    const trends: MatchTrend[] = [];

    for (const contactGroup of contactsWithHistory) {
      const contactId = contactGroup.contactId;

      // Get all history entries for this contact
      const history = await prisma.matchHistory.findMany({
        where: {
          userId,
          contactId,
          calculatedAt: { gte: startDate },
        },
        orderBy: { calculatedAt: 'asc' },
        select: {
          calculatedAt: true,
          totalScore: true,
        },
      });

      if (history.length === 0) continue;

      // Get contact name
      const contact = await prisma.contact.findUnique({
        where: { id: contactId },
        select: { fullName: true },
      });

      const currentScore = history[history.length - 1].totalScore;
      const previousScore = history.length > 1 ? history[history.length - 2].totalScore : null;

      let trend: 'up' | 'down' | 'stable' = 'stable';
      let changePercent: number | null = null;

      if (previousScore !== null) {
        const change = currentScore - previousScore;
        changePercent = previousScore > 0 ? Math.round((change / previousScore) * 100) : null;

        if (change > 5) trend = 'up';
        else if (change < -5) trend = 'down';
      }

      trends.push({
        contactId,
        contactName: contact?.fullName,
        scores: history.map((h) => ({
          date: h.calculatedAt,
          score: h.totalScore,
        })),
        currentScore,
        previousScore,
        trend,
        changePercent,
      });
    }

    return trends;
  }

  /**
   * Get match analytics for a user
   */
  async getAnalytics(userId: string, daysBack: number = 30): Promise<MatchAnalytics> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysBack);

    // Get all recent match history
    const history = await prisma.matchHistory.findMany({
      where: {
        userId,
        calculatedAt: { gte: startDate },
      },
    });

    if (history.length === 0) {
      return {
        totalMatches: 0,
        averageScore: 0,
        topScoreFactors: [],
        scoreDistribution: {
          excellent: 0,
          good: 0,
          fair: 0,
          low: 0,
        },
      };
    }

    // Calculate average score
    const totalScore = history.reduce((sum, h) => sum + h.totalScore, 0);
    const averageScore = Math.round(totalScore / history.length);

    // Calculate score distribution
    const scoreDistribution = {
      excellent: 0,
      good: 0,
      fair: 0,
      low: 0,
    };

    for (const h of history) {
      if (h.totalScore >= 80) scoreDistribution.excellent++;
      else if (h.totalScore >= 60) scoreDistribution.good++;
      else if (h.totalScore >= 40) scoreDistribution.fair++;
      else scoreDistribution.low++;
    }

    // Calculate top contributing factors
    const factorSums: Record<string, number> = {
      goalAlignment: 0,
      sector: 0,
      skill: 0,
      semanticSimilarity: 0,
      networkProximity: 0,
      complementarySkills: 0,
      recency: 0,
      interaction: 0,
      interest: 0,
      hobby: 0,
    };

    for (const h of history) {
      if (h.goalAlignmentScore) factorSums.goalAlignment += h.goalAlignmentScore;
      if (h.sectorScore) factorSums.sector += h.sectorScore;
      if (h.skillScore) factorSums.skill += h.skillScore;
      if (h.semanticSimilarityScore) factorSums.semanticSimilarity += h.semanticSimilarityScore;
      if (h.networkProximityScore) factorSums.networkProximity += h.networkProximityScore;
      if (h.complementarySkillsScore) factorSums.complementarySkills += h.complementarySkillsScore;
      if (h.recencyScore) factorSums.recency += h.recencyScore;
      if (h.interactionScore) factorSums.interaction += h.interactionScore;
      if (h.interestScore) factorSums.interest += h.interestScore;
      if (h.hobbyScore) factorSums.hobby += h.hobbyScore;
    }

    const topScoreFactors = Object.entries(factorSums)
      .map(([factor, sum]) => ({
        factor,
        averageContribution: Math.round(sum / history.length),
      }))
      .sort((a, b) => b.averageContribution - a.averageContribution)
      .slice(0, 5);

    return {
      totalMatches: history.length,
      averageScore,
      topScoreFactors,
      scoreDistribution,
    };
  }

  /**
   * Clean up old history entries (retention policy)
   */
  async cleanupOldHistory(daysToKeep: number = 90): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const result = await prisma.matchHistory.deleteMany({
      where: {
        calculatedAt: { lt: cutoffDate },
      },
    });

    logger.info('Cleaned up old match history', {
      deletedCount: result.count,
      cutoffDate,
    });

    return result.count;
  }
}

// Export singleton instance
export const matchHistoryService = new MatchHistoryService();
