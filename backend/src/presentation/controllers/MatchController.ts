/**
 * Match Controller
 *
 * Handles HTTP requests for matching and recommendation endpoints.
 *
 * @module presentation/controllers/MatchController
 */

import { Request, Response, NextFunction } from 'express';
import { getMatchingService, matchFeedbackService, matchHistoryService } from '../../infrastructure/external/matching';
import { GetFollowUpContactsUseCase } from '../../application/use-cases/contact';
import { PrismaContactRepository } from '../../infrastructure/repositories/PrismaContactRepository';
import { AuthenticationError, ValidationError } from '../../shared/errors';
import { logger } from '../../shared/logger';
import { MatchFeedbackAction } from '@prisma/client';
import { prisma } from '../../infrastructure/database/prisma/client';
import { cacheService } from '../../infrastructure/cache/CacheService';
import { enhancedExplainabilityService } from '../../infrastructure/services/explainability';

// Initialize services (using factory for matching)
const matchingService = getMatchingService();
const contactRepository = new PrismaContactRepository();
const getFollowUpContactsUseCase = new GetFollowUpContactsUseCase(contactRepository);

/**
 * Match Controller
 *
 * Provides HTTP handlers for matching and recommendation operations.
 */
export class MatchController {
  /**
   * Get ranked matches for user's contacts
   *
   * GET /api/v1/matches
   *
   * Query params:
   * - limit: number of results (default 20, max 100)
   * - minScore: minimum match score (default 0)
   * - sector: filter by sector ID
   */
  async getMatches(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AuthenticationError('Authentication required');
      }

      const options = {
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 20,
        minScore: req.query.minScore ? parseInt(req.query.minScore as string, 10) : 0,
        sectorId: req.query.sector as string | undefined,
        includeBreakdown: true,
      };

      const orgId = req.orgContext?.organizationId || undefined;
      const matches = await matchingService.getMatches(req.user.userId, options, orgId);

      // Save fresh calculated scores to database for consistency
      // This ensures contacts list always shows the latest scores
      try {
        const updatePromises = matches.map((match: any) =>
          prisma.contact.update({
            where: { id: match.contactId },
            data: { matchScore: match.score },
          }).catch(() => null) // Ignore individual update failures
        );
        await Promise.all(updatePromises);

        // Invalidate cache so contacts list shows fresh scores
        await cacheService.invalidateContactMatchCache(req.user.userId);
      } catch (updateError) {
        logger.warn('Failed to batch update match scores', { error: updateError });
      }

      res.status(200).json({
        success: true,
        data: {
          matches,
          total: matches.length,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get detailed match analysis for a contact
   *
   * GET /api/v1/matches/:contactId
   */
  async getMatchDetails(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AuthenticationError('Authentication required');
      }

      const orgId = req.orgContext?.organizationId || undefined;
      const match = await matchingService.getMatchDetails(
        req.user.userId,
        req.params.contactId,
        orgId
      );

      if (!match) {
        res.status(404).json({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Contact not found',
          },
        });
        return;
      }

      // Save the fresh calculated score to the database for consistency
      // This ensures contacts list and detail page show the same score
      try {
        await prisma.contact.update({
          where: { id: req.params.contactId },
          data: { matchScore: match.score },
        });

        // Invalidate cache so contacts list shows fresh score
        await cacheService.invalidateContactMatchCache(req.user.userId);
      } catch (updateError) {
        // Log but don't fail the request if update fails
        logger.warn('Failed to update match score in database', {
          contactId: req.params.contactId,
          error: updateError
        });
      }

      // Enrich with explainability insights
      let insights: any = {};
      try {
        const user = await prisma.user.findUnique({
          where: { id: req.user.userId },
          include: {
            userSkills: { include: { skill: true } },
            userSectors: { include: { sector: true } },
            userGoals: { where: { isActive: true } },
          },
        });
        const contact = await prisma.contact.findFirst({
          where: { id: req.params.contactId },
          include: {
            contactSkills: { include: { skill: true } },
            contactSectors: { include: { sector: true } },
          },
        });

        if (user && contact) {
          const userProfile = {
            skills: user.userSkills.map((us: any) => us.skill.name),
            sectors: user.userSectors.map((us: any) => us.sector.name),
            goals: user.userGoals.map((ug: any) => ug.goalType),
            bio: user.bio || undefined,
            jobTitle: user.jobTitle || undefined,
          };
          const contactProfile = {
            skills: contact.contactSkills.map((cs: any) => cs.skill.name),
            sectors: contact.contactSectors.map((cs: any) => cs.sector.name),
          };

          const suggestions = enhancedExplainabilityService.generateImprovementSuggestions(
            userProfile, [], []
          );
          const skillGap = enhancedExplainabilityService.generateSkillGapAnalysis(
            userProfile.skills, contactProfile.skills
          );

          insights = { profileImprovements: suggestions, skillGap };
        }
      } catch (insightErr) {
        logger.debug('Failed to generate match insights', { error: insightErr });
      }

      res.status(200).json({
        success: true,
        data: { ...match, ...insights },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get intersection points with a contact
   *
   * GET /api/v1/matches/intersections/:contactId
   */
  async getIntersections(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AuthenticationError('Authentication required');
      }

      const orgId = req.orgContext?.organizationId || undefined;
      const intersections = await matchingService.getIntersections(
        req.user.userId,
        req.params.contactId,
        orgId
      );

      res.status(200).json({
        success: true,
        data: {
          contactId: req.params.contactId,
          intersections,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get daily recommendations
   *
   * GET /api/v1/recommendations/daily
   *
   * Query params:
   * - count: number of recommendations (default 3, max 10)
   */
  async getDailyRecommendations(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AuthenticationError('Authentication required');
      }

      const count = req.query.count
        ? Math.min(parseInt(req.query.count as string, 10), 10)
        : 3;

      const orgId = req.orgContext?.organizationId || undefined;
      const recommendations = await matchingService.getDailyRecommendations(
        req.user.userId,
        count,
        orgId
      );

      res.status(200).json({
        success: true,
        data: {
          recommendations,
          date: new Date().toISOString().split('T')[0],
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get follow-up reminders
   *
   * GET /api/v1/recommendations/followup
   *
   * Query params:
   * - days: days since last contact (default 30)
   */
  async getFollowUpReminders(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AuthenticationError('Authentication required');
      }

      const days = req.query.days ? parseInt(req.query.days as string, 10) : 30;

      const contacts = await getFollowUpContactsUseCase.execute(req.user.userId, days);

      res.status(200).json({
        success: true,
        data: {
          contacts,
          daysThreshold: days,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Recalculate match score for a contact
   *
   * POST /api/v1/matches/:contactId/recalculate
   */
  async recalculateScore(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AuthenticationError('Authentication required');
      }

      const orgId = req.orgContext?.organizationId || undefined;
      const newScore = await matchingService.recalculateScore(
        req.user.userId,
        req.params.contactId,
        orgId
      );

      res.status(200).json({
        success: true,
        data: {
          contactId: req.params.contactId,
          score: newScore,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Record feedback on a match
   *
   * POST /api/v1/matches/:contactId/feedback
   *
   * Body:
   * - action: ACCEPT | REJECT | SAVE | CONNECT | MESSAGE | HIDE
   * - rating: 1-5 (optional)
   * - feedbackNote: string (optional)
   * - source: where feedback was given (optional)
   */
  async recordFeedback(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AuthenticationError('Authentication required');
      }

      const { action, rating, feedbackNote, source } = req.body;
      const contactId = req.params.contactId;

      // Validate action
      const validActions: MatchFeedbackAction[] = ['ACCEPT', 'REJECT', 'SAVE', 'CONNECT', 'MESSAGE', 'HIDE'];
      if (!action || !validActions.includes(action)) {
        throw new ValidationError('Invalid feedback action. Must be one of: ' + validActions.join(', '));
      }

      // Validate rating if provided
      if (rating !== undefined && (rating < 1 || rating > 5)) {
        throw new ValidationError('Rating must be between 1 and 5');
      }

      // Get current match score for tracking
      const orgId = req.orgContext?.organizationId || undefined;
      const matchDetails = await matchingService.getMatchDetails(req.user.userId, contactId, orgId);
      const matchScoreAtFeedback = matchDetails?.score;

      await matchFeedbackService.recordFeedback({
        userId: req.user.userId,
        contactId,
        action: action as MatchFeedbackAction,
        matchType: 'contact',
        matchScoreAtFeedback,
        rating,
        feedbackNote,
        feedbackSource: source,
      });

      logger.info('Recorded match feedback', {
        userId: req.user.userId,
        contactId,
        action,
      });

      res.status(200).json({
        success: true,
        data: {
          contactId,
          action,
          recorded: true,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get feedback stats for a contact
   *
   * GET /api/v1/matches/:contactId/feedback
   */
  async getFeedbackStats(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AuthenticationError('Authentication required');
      }

      const stats = await matchFeedbackService.getFeedbackStats(
        req.user.userId,
        req.params.contactId
      );

      res.status(200).json({
        success: true,
        data: stats,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get user feedback summary
   *
   * GET /api/v1/matches/feedback/summary
   */
  async getFeedbackSummary(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AuthenticationError('Authentication required');
      }

      const summary = await matchFeedbackService.getUserFeedbackSummary(req.user.userId);

      res.status(200).json({
        success: true,
        data: summary,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get match history for a contact
   *
   * GET /api/v1/matches/:contactId/history
   */
  async getMatchHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AuthenticationError('Authentication required');
      }

      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 30;

      const history = await matchHistoryService.getContactHistory(
        req.user.userId,
        req.params.contactId,
        limit
      );

      res.status(200).json({
        success: true,
        data: {
          contactId: req.params.contactId,
          history,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get match analytics for user
   *
   * GET /api/v1/matches/analytics
   */
  async getMatchAnalytics(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AuthenticationError('Authentication required');
      }

      const daysBack = req.query.days ? parseInt(req.query.days as string, 10) : 30;

      const analytics = await matchHistoryService.getAnalytics(req.user.userId, daysBack);
      const trends = await matchHistoryService.getScoreTrends(req.user.userId, daysBack, 10);

      res.status(200).json({
        success: true,
        data: {
          analytics,
          trends,
          period: `${daysBack} days`,
        },
      });
    } catch (error) {
      next(error);
    }
  }
}

// Export singleton instance
export const matchController = new MatchController();
