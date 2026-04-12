/**
 * Match Feedback Service
 *
 * Handles user feedback on match recommendations (accept/reject/rate).
 * Aggregates feedback into stats for use in match scoring.
 *
 * Feedback scoring weights:
 * - ACCEPT: +20 points
 * - CONNECT: +30 points
 * - MESSAGE: +25 points
 * - SAVE: +10 points
 * - REJECT: -15 points
 * - HIDE: -25 points
 *
 * @module infrastructure/external/matching/MatchFeedbackService
 */

import { prisma } from '../../database/prisma/client';
import { MatchFeedbackAction, Prisma } from '@prisma/client';
import { logger } from '../../../shared/logger';
import { cacheService, CACHE_KEYS as CacheKeys } from '../../cache/CacheService';

/**
 * Feedback input
 */
export interface FeedbackInput {
  userId: string;
  contactId: string;
  action: MatchFeedbackAction;
  matchType?: 'contact' | 'project' | 'opportunity';
  matchScoreAtFeedback?: number;
  rating?: number;
  feedbackNote?: string;
  feedbackSource?: string;
}

/**
 * Feedback stats for a contact
 */
export interface FeedbackStats {
  feedbackScore: number;
  avgRating: number | null;
  acceptCount: number;
  rejectCount: number;
  hideCount: number;
  lastFeedbackAt: Date | null;
}

/**
 * Feedback adjustment weights
 */
const FEEDBACK_WEIGHTS: Record<MatchFeedbackAction, number> = {
  ACCEPT: 20,
  CONNECT: 30,
  MESSAGE: 25,
  SAVE: 10,
  REJECT: -15,
  HIDE: -25,
};

/**
 * Match Feedback Service
 */
export class MatchFeedbackService {
  /**
   * Record user feedback on a match
   */
  async recordFeedback(input: FeedbackInput): Promise<void> {
    const {
      userId,
      contactId,
      action,
      matchType = 'contact',
      matchScoreAtFeedback,
      rating,
      feedbackNote,
      feedbackSource,
    } = input;

    try {
      // Record the feedback event
      await prisma.matchFeedback.create({
        data: {
          userId,
          contactId,
          action,
          matchType,
          matchScoreAtFeedback,
          rating,
          feedbackNote,
          feedbackSource,
        },
      });

      // Update aggregated stats
      await this.updateFeedbackStats(userId, contactId, action, rating);

      // Invalidate cached matches for this user
      await this.invalidateMatchCache(userId);

      logger.debug('Recorded match feedback', { userId, contactId, action });
    } catch (error) {
      logger.error('Failed to record match feedback', {
        userId,
        contactId,
        action,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Update aggregated feedback stats
   */
  private async updateFeedbackStats(
    userId: string,
    contactId: string,
    action: MatchFeedbackAction,
    rating?: number
  ): Promise<void> {
    const weight = FEEDBACK_WEIGHTS[action];

    // Build update based on action
    const actionCountField = `${action.toLowerCase()}Count` as const;

    // Try to update existing stats or create new
    const existingStats = await prisma.matchFeedbackStats.findUnique({
      where: {
        userId_contactId: { userId, contactId },
      },
    });

    if (existingStats) {
      // Calculate new feedback score (clamped to -100 to +100)
      const newScore = Math.max(-100, Math.min(100, existingStats.feedbackScore + weight));

      // Calculate new average rating if provided
      let newAvgRating = existingStats.avgRating;
      let newRatingCount = existingStats.ratingCount;

      if (rating !== undefined && rating >= 1 && rating <= 5) {
        const currentTotal = existingStats.avgRating
          ? Number(existingStats.avgRating) * existingStats.ratingCount
          : 0;
        newRatingCount = existingStats.ratingCount + 1;
        newAvgRating = new Prisma.Decimal((currentTotal + rating) / newRatingCount);
      }

      // Build dynamic update object
      const updateData: Prisma.MatchFeedbackStatsUpdateInput = {
        feedbackScore: newScore,
        lastFeedbackAt: new Date(),
      };

      // Increment the appropriate action count
      switch (action) {
        case 'ACCEPT':
          updateData.acceptCount = { increment: 1 };
          break;
        case 'REJECT':
          updateData.rejectCount = { increment: 1 };
          break;
        case 'SAVE':
          updateData.saveCount = { increment: 1 };
          break;
        case 'CONNECT':
          updateData.connectCount = { increment: 1 };
          break;
        case 'MESSAGE':
          updateData.messageCount = { increment: 1 };
          break;
        case 'HIDE':
          updateData.hideCount = { increment: 1 };
          break;
      }

      if (newAvgRating !== existingStats.avgRating) {
        updateData.avgRating = newAvgRating;
        updateData.ratingCount = newRatingCount;
      }

      await prisma.matchFeedbackStats.update({
        where: { id: existingStats.id },
        data: updateData,
      });
    } else {
      // Create new stats record
      const createData: Prisma.MatchFeedbackStatsCreateInput = {
        userId,
        contactId,
        feedbackScore: Math.max(-100, Math.min(100, weight)),
        lastFeedbackAt: new Date(),
        acceptCount: action === 'ACCEPT' ? 1 : 0,
        rejectCount: action === 'REJECT' ? 1 : 0,
        saveCount: action === 'SAVE' ? 1 : 0,
        connectCount: action === 'CONNECT' ? 1 : 0,
        messageCount: action === 'MESSAGE' ? 1 : 0,
        hideCount: action === 'HIDE' ? 1 : 0,
      };

      if (rating !== undefined && rating >= 1 && rating <= 5) {
        createData.avgRating = rating;
        createData.ratingCount = 1;
      }

      await prisma.matchFeedbackStats.create({
        data: createData,
      });
    }
  }

  /**
   * Get feedback stats for a specific contact
   */
  async getFeedbackStats(userId: string, contactId: string): Promise<FeedbackStats | null> {
    const stats = await prisma.matchFeedbackStats.findUnique({
      where: {
        userId_contactId: { userId, contactId },
      },
    });

    if (!stats) {
      return null;
    }

    return {
      feedbackScore: stats.feedbackScore,
      avgRating: stats.avgRating ? Number(stats.avgRating) : null,
      acceptCount: stats.acceptCount,
      rejectCount: stats.rejectCount,
      hideCount: stats.hideCount,
      lastFeedbackAt: stats.lastFeedbackAt,
    };
  }

  /**
   * Get feedback scores for multiple contacts (bulk)
   * Returns a map of contactId -> feedbackScore
   */
  async getBulkFeedbackScores(
    userId: string,
    contactIds: string[]
  ): Promise<Map<string, number>> {
    const feedbackMap = new Map<string, number>();

    if (contactIds.length === 0) {
      return feedbackMap;
    }

    const stats = await prisma.matchFeedbackStats.findMany({
      where: {
        userId,
        contactId: { in: contactIds },
      },
      select: {
        contactId: true,
        feedbackScore: true,
      },
    });

    for (const stat of stats) {
      feedbackMap.set(stat.contactId, stat.feedbackScore);
    }

    return feedbackMap;
  }

  /**
   * Get hidden contacts (should be excluded from matches)
   */
  async getHiddenContactIds(userId: string): Promise<Set<string>> {
    const stats = await prisma.matchFeedbackStats.findMany({
      where: {
        userId,
        hideCount: { gt: 0 },
      },
      select: {
        contactId: true,
      },
    });

    return new Set(stats.map((s) => s.contactId));
  }

  /**
   * Get contacts with positive feedback (for boosting)
   */
  async getPositiveFeedbackContactIds(
    userId: string,
    minScore: number = 20
  ): Promise<Set<string>> {
    const stats = await prisma.matchFeedbackStats.findMany({
      where: {
        userId,
        feedbackScore: { gte: minScore },
      },
      select: {
        contactId: true,
      },
    });

    return new Set(stats.map((s) => s.contactId));
  }

  /**
   * Get feedback history for a contact
   */
  async getFeedbackHistory(
    userId: string,
    contactId: string,
    limit: number = 20
  ): Promise<
    Array<{
      action: MatchFeedbackAction;
      rating: number | null;
      feedbackNote: string | null;
      feedbackSource: string | null;
      createdAt: Date;
    }>
  > {
    const feedback = await prisma.matchFeedback.findMany({
      where: { userId, contactId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        action: true,
        rating: true,
        feedbackNote: true,
        feedbackSource: true,
        createdAt: true,
      },
    });

    return feedback;
  }

  /**
   * Get user feedback summary (for analytics)
   */
  async getUserFeedbackSummary(
    userId: string
  ): Promise<{
    totalFeedback: number;
    acceptRate: number;
    rejectRate: number;
    avgRating: number | null;
    feedbackByAction: Record<string, number>;
  }> {
    const feedback = await prisma.matchFeedback.groupBy({
      by: ['action'],
      where: { userId },
      _count: { id: true },
    });

    const feedbackByAction: Record<string, number> = {};
    let totalFeedback = 0;
    let acceptCount = 0;
    let rejectCount = 0;

    for (const fb of feedback) {
      feedbackByAction[fb.action] = fb._count.id;
      totalFeedback += fb._count.id;

      if (fb.action === 'ACCEPT' || fb.action === 'CONNECT' || fb.action === 'MESSAGE') {
        acceptCount += fb._count.id;
      } else if (fb.action === 'REJECT' || fb.action === 'HIDE') {
        rejectCount += fb._count.id;
      }
    }

    // Get average rating
    const ratingAgg = await prisma.matchFeedback.aggregate({
      where: {
        userId,
        rating: { not: null },
      },
      _avg: { rating: true },
    });

    return {
      totalFeedback,
      acceptRate: totalFeedback > 0 ? Math.round((acceptCount / totalFeedback) * 100) : 0,
      rejectRate: totalFeedback > 0 ? Math.round((rejectCount / totalFeedback) * 100) : 0,
      avgRating: ratingAgg._avg.rating,
      feedbackByAction,
    };
  }

  /**
   * Calculate feedback-based score adjustment
   * Returns a multiplier or bonus to apply to match scores
   */
  calculateFeedbackAdjustment(feedbackScore: number): number {
    // Convert feedback score (-100 to +100) to adjustment factor
    // Positive feedback: boost by up to 15%
    // Negative feedback: penalize by up to 25%
    if (feedbackScore > 0) {
      return 1 + (feedbackScore / 100) * 0.15; // Max 1.15x
    } else if (feedbackScore < 0) {
      return 1 + (feedbackScore / 100) * 0.25; // Min 0.75x
    }
    return 1;
  }

  /**
   * Invalidate match cache when feedback is recorded
   */
  private async invalidateMatchCache(userId: string): Promise<void> {
    try {
      // Invalidate all matching-related cache for this user
      const cacheKey = `${CacheKeys.CONTACT_MATCHES}${userId}`;
      await cacheService.delete(cacheKey);

      // Also invalidate daily recommendations
      await cacheService.delete(`daily_recommendations:${userId}`);
    } catch (error) {
      logger.warn('Failed to invalidate match cache after feedback', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Clean up old feedback records (retention policy)
   */
  async cleanupOldFeedback(daysToKeep: number = 365): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const result = await prisma.matchFeedback.deleteMany({
      where: {
        createdAt: { lt: cutoffDate },
      },
    });

    logger.info('Cleaned up old match feedback', {
      deletedCount: result.count,
      cutoffDate,
    });

    return result.count;
  }
}

// Export singleton instance
export const matchFeedbackService = new MatchFeedbackService();
