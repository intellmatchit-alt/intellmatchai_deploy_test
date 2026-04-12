/**
 * Itemized Match Controller
 *
 * Handles HTTP requests for itemized explainable matching endpoints.
 *
 * @module presentation/controllers/ItemizedMatchController
 */

import { Request, Response, NextFunction } from 'express';
import { itemizedMatchingService } from '../../infrastructure/services/itemized-matching';
import { AuthenticationError, NotFoundError, ValidationError } from '../../shared/errors';
import { logger } from '../../shared/logger';

/**
 * Itemized Match Controller
 */
export class ItemizedMatchController {
  /**
   * Get itemized match between user and a contact
   *
   * GET /api/v1/matches/itemized/:contactId
   *
   * Returns per-criterion scores with detailed explanations.
   * NO total score - each criterion has its own 0-100% score.
   */
  async getProfileMatch(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AuthenticationError('Authentication required');
      }

      const { contactId } = req.params;
      const skipLlm = req.query.skipLlm === 'true';
      const includeRaw = req.query.includeRaw === 'true';
      const forceRecalculate = req.query.force === 'true';

      const result = await itemizedMatchingService.matchProfiles(
        req.user.userId,
        contactId,
        {
          skipLlmEnhancement: skipLlm,
          includeRawData: includeRaw,
          forceRecalculate,
        }
      );

      logger.info('[ItemizedMatch] Profile match returned', {
        userId: req.user.userId,
        contactId,
        criteriaCount: result.criteria.length,
        perfectCount: result.summary.perfectMatches,
      });

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      if ((error as Error).message?.includes('not found')) {
        res.status(404).json({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Contact not found',
          },
        });
        return;
      }
      next(error);
    }
  }

  /**
   * Get batch itemized matches for multiple contacts
   *
   * POST /api/v1/matches/itemized/batch
   *
   * Body: { contactIds: string[] }
   *
   * Returns summary data for list views (lighter weight).
   */
  async getBatchProfileMatches(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AuthenticationError('Authentication required');
      }

      const { contactIds } = req.body;

      if (!Array.isArray(contactIds) || contactIds.length === 0) {
        throw new ValidationError('contactIds must be a non-empty array');
      }

      if (contactIds.length > 50) {
        throw new ValidationError('Maximum 50 contacts per batch');
      }

      const results = await itemizedMatchingService.batchMatchProfiles(
        req.user.userId,
        contactIds
      );

      logger.info('[ItemizedMatch] Batch profile matches returned', {
        userId: req.user.userId,
        requestedCount: contactIds.length,
        returnedCount: results.length,
      });

      res.status(200).json({
        success: true,
        data: {
          matches: results,
          total: results.length,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get itemized match for a project and potential collaborator/investor
   *
   * GET /api/v1/projects/:projectId/matches/itemized/:targetId
   *
   * Query params:
   * - type: 'investor' | 'partner' | 'talent' (default: 'investor')
   */
  async getProjectMatch(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AuthenticationError('Authentication required');
      }

      const { projectId, targetId } = req.params;
      const matchType = (req.query.type as string) || 'auto';

      const typeMap: Record<string, 'PROJECT_TO_INVESTOR' | 'PROJECT_TO_PARTNER' | 'PROJECT_TO_TALENT' | 'PROJECT_TO_DYNAMIC'> = {
        auto: 'PROJECT_TO_DYNAMIC',
        investor: 'PROJECT_TO_INVESTOR',
        partner: 'PROJECT_TO_PARTNER',
        talent: 'PROJECT_TO_TALENT',
      };

      if (!typeMap[matchType]) {
        throw new ValidationError('Invalid match type. Must be: auto, investor, partner, or talent');
      }

      // Verify user owns the project
      const { prisma } = await import('../../infrastructure/database/prisma/client.js');
      const project = await prisma.project.findUnique({
        where: { id: projectId },
        select: { userId: true },
      });

      if (!project) {
        throw new NotFoundError('Project not found');
      }

      if (project.userId !== req.user.userId) {
        res.status(403).json({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'You do not own this project',
          },
        });
        return;
      }

      const result = await itemizedMatchingService.matchProjectToContact(
        projectId,
        targetId,
        typeMap[matchType]
      );

      logger.info('[ItemizedMatch] Project match returned', {
        projectId,
        targetId,
        matchType: typeMap[matchType],
        criteriaCount: result.criteria.length,
      });

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      if ((error as Error).message?.includes('not found')) {
        res.status(404).json({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Project or contact not found',
          },
        });
        return;
      }
      next(error);
    }
  }

  /**
   * Get all itemized matches for a project against the user's contacts
   *
   * GET /api/v1/projects/:projectId/matches/itemized
   *
   * Query params:
   * - type: 'investor' | 'partner' | 'talent' (default: 'investor')
   *
   * Returns list view of all contact matches scored against the project.
   */
  async getProjectMatches(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AuthenticationError('Authentication required');
      }

      const { projectId } = req.params;
      const matchType = (req.query.type as string) || 'auto';

      const typeMap: Record<string, 'PROJECT_TO_INVESTOR' | 'PROJECT_TO_PARTNER' | 'PROJECT_TO_TALENT' | 'PROJECT_TO_DYNAMIC'> = {
        auto: 'PROJECT_TO_DYNAMIC',
        investor: 'PROJECT_TO_INVESTOR',
        partner: 'PROJECT_TO_PARTNER',
        talent: 'PROJECT_TO_TALENT',
      };

      if (!typeMap[matchType]) {
        throw new ValidationError('Invalid match type. Must be: auto, investor, partner, or talent');
      }

      // Verify user owns the project
      const { prisma } = await import('../../infrastructure/database/prisma/client.js');
      const project = await prisma.project.findUnique({
        where: { id: projectId },
        select: { userId: true },
      });

      if (!project) {
        throw new NotFoundError('Project not found');
      }

      if (project.userId !== req.user.userId) {
        res.status(403).json({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'You do not own this project',
          },
        });
        return;
      }

      // Get all user's contacts
      const contacts = await prisma.contact.findMany({
        where: { ownerId: req.user.userId },
        select: { id: true },
        take: 100, // Limit for performance
      });

      const contactIds = contacts.map((c: { id: string }) => c.id);

      if (contactIds.length === 0) {
        res.status(200).json({
          success: true,
          data: {
            matches: [],
            total: 0,
          },
        });
        return;
      }

      const results = await itemizedMatchingService.batchMatchItemToContacts(
        projectId,
        'PROJECT',
        contactIds
      );

      logger.info('[ItemizedMatch] Project matches list returned', {
        projectId,
        matchType: typeMap[matchType],
        matchCount: results.length,
      });

      res.status(200).json({
        success: true,
        data: {
          matches: results,
          total: results.length,
        },
      });
    } catch (error) {
      if ((error as Error).message?.includes('not found')) {
        res.status(404).json({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Project not found',
          },
        });
        return;
      }
      next(error);
    }
  }

  /**
   * Get itemized match for a deal and potential buyer/provider
   *
   * GET /api/v1/deals/:dealId/matches/itemized/:contactId
   *
   * Query params:
   * - type: 'buyer' | 'provider' (default: based on deal mode)
   */
  async getDealMatch(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AuthenticationError('Authentication required');
      }

      const { dealId, contactId } = req.params;
      const matchType = req.query.type as string;

      // Determine match type from query or infer from deal
      let resolvedMatchType: 'DEAL_TO_BUYER' | 'DEAL_TO_PROVIDER';

      if (matchType === 'buyer') {
        resolvedMatchType = 'DEAL_TO_BUYER';
      } else if (matchType === 'provider') {
        resolvedMatchType = 'DEAL_TO_PROVIDER';
      } else {
        // Infer from deal mode
        const { prisma } = await import('../../infrastructure/database/prisma/client.js');
        const deal = await prisma.dealRequest.findUnique({
          where: { id: dealId },
          select: { mode: true },
        });

        if (!deal) {
          throw new NotFoundError('Deal not found');
        }

        // SELL mode = looking for buyers, BUY mode = looking for providers
        resolvedMatchType = deal.mode === 'SELL' ? 'DEAL_TO_BUYER' : 'DEAL_TO_PROVIDER';
      }

      const result = await itemizedMatchingService.matchDealToContact(
        dealId,
        contactId,
        resolvedMatchType
      );

      logger.info('[ItemizedMatch] Deal match returned', {
        dealId,
        contactId,
        matchType: resolvedMatchType,
        criteriaCount: result.criteria.length,
      });

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      if ((error as Error).message?.includes('not found')) {
        res.status(404).json({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Deal or contact not found',
          },
        });
        return;
      }
      next(error);
    }
  }

  /**
   * Get itemized match between two event attendees
   *
   * GET /api/v1/events/:eventId/matches/itemized/:attendeeId
   *
   * Uses the requesting user's event attendance as the source.
   */
  async getEventMatch(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Event matches can work with token auth (for guests)
      const { eventId, attendeeId } = req.params;
      const token = req.query.token as string;

      // Get the requesting attendee (either by auth or by token)
      let requestingAttendeeId: string | null = null;

      if (req.user) {
        // Find the user's attendance record
        const { prisma } = await import('../../infrastructure/database/prisma/client.js');
        const attendance = await prisma.eventAttendee.findFirst({
          where: { eventId, userId: req.user.userId },
        });
        if (attendance) {
          requestingAttendeeId = attendance.id;
        }
      } else if (token) {
        // Find by access token
        const { prisma } = await import('../../infrastructure/database/prisma/client.js');
        const attendance = await prisma.eventAttendee.findFirst({
          where: { eventId, accessToken: token, tokenExpiry: { gt: new Date() } },
        });
        if (attendance) {
          requestingAttendeeId = attendance.id;
        }
      }

      if (!requestingAttendeeId) {
        throw new AuthenticationError('Please register for the event first');
      }

      const result = await itemizedMatchingService.matchEventAttendees(
        requestingAttendeeId,
        attendeeId,
        eventId
      );

      logger.info('[ItemizedMatch] Event match returned', {
        eventId,
        sourceAttendeeId: requestingAttendeeId,
        targetAttendeeId: attendeeId,
        criticalMet: result.summary.criticalMet,
      });

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      if ((error as Error).message?.includes('not found')) {
        res.status(404).json({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Attendee not found',
          },
        });
        return;
      }
      next(error);
    }
  }

  /**
   * Get all itemized matches for an event attendee
   *
   * GET /api/v1/events/:eventId/matches/itemized
   *
   * Returns list view of all matches sorted by complementary goals.
   */
  async getEventMatches(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { eventId } = req.params;
      const token = req.query.token as string;

      // Get the requesting attendee
      let requestingAttendeeId: string | null = null;

      if (req.user) {
        const { prisma } = await import('../../infrastructure/database/prisma/client.js');
        const attendance = await prisma.eventAttendee.findFirst({
          where: { eventId, userId: req.user.userId },
        });
        if (attendance) {
          requestingAttendeeId = attendance.id;
        }
      } else if (token) {
        const { prisma } = await import('../../infrastructure/database/prisma/client.js');
        const attendance = await prisma.eventAttendee.findFirst({
          where: { eventId, accessToken: token, tokenExpiry: { gt: new Date() } },
        });
        if (attendance) {
          requestingAttendeeId = attendance.id;
        }
      }

      if (!requestingAttendeeId) {
        throw new AuthenticationError('Please register for the event first');
      }

      const results = await itemizedMatchingService.getEventAttendeeMatches(
        requestingAttendeeId,
        eventId
      );

      logger.info('[ItemizedMatch] Event matches list returned', {
        eventId,
        attendeeId: requestingAttendeeId,
        matchCount: results.length,
      });

      res.status(200).json({
        success: true,
        data: {
          matches: results,
          total: results.length,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get itemized match for an opportunity and a candidate
   *
   * GET /api/v1/opportunities/:opportunityId/matches/itemized/:candidateId
   *
   * Query params:
   * - type: 'contact' | 'user' (default: 'contact')
   */
  async getOpportunityMatch(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AuthenticationError('Authentication required');
      }

      const { opportunityId, candidateId } = req.params;
      const candidateType = (req.query.type as string) === 'user' ? 'USER' : 'CONTACT';

      const result = await itemizedMatchingService.matchOpportunityToCandidate(
        opportunityId,
        candidateId,
        candidateType as 'CONTACT' | 'USER'
      );

      logger.info('[ItemizedMatch] Opportunity match returned', {
        opportunityId,
        candidateId,
        candidateType,
        criteriaCount: result.criteria.length,
        criticalMet: result.summary.criticalMet,
      });

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      if ((error as Error).message?.includes('not found')) {
        res.status(404).json({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Opportunity or candidate not found',
          },
        });
        return;
      }
      next(error);
    }
  }

  /**
   * Get all candidate matches for an opportunity
   *
   * GET /api/v1/opportunities/:opportunityId/matches/itemized
   *
   * Query params:
   * - type: 'contact' | 'user' (default: 'contact')
   */
  async getOpportunityMatches(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AuthenticationError('Authentication required');
      }

      const { opportunityId } = req.params;
      const candidateType = (req.query.type as string) === 'user' ? 'USER' : 'CONTACT';

      const results = await itemizedMatchingService.getOpportunityCandidates(
        opportunityId,
        candidateType as 'CONTACT' | 'USER'
      );

      logger.info('[ItemizedMatch] Opportunity matches list returned', {
        opportunityId,
        candidateType,
        matchCount: results.length,
      });

      res.status(200).json({
        success: true,
        data: {
          matches: results,
          total: results.length,
        },
      });
    } catch (error) {
      if ((error as Error).message?.includes('not found')) {
        res.status(404).json({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Opportunity not found',
          },
        });
        return;
      }
      next(error);
    }
  }

  /**
   * Get itemized match for a pitch and a contact
   *
   * GET /api/v1/pitches/:pitchId/matches/itemized/:contactId
   */
  async getPitchMatch(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AuthenticationError('Authentication required');
      }

      const { pitchId, contactId } = req.params;

      // Verify user owns the pitch
      const { prisma } = await import('../../infrastructure/database/prisma/client.js');
      const pitch = await prisma.pitch.findUnique({
        where: { id: pitchId },
        select: { userId: true },
      });

      if (!pitch) {
        throw new NotFoundError('Pitch not found');
      }

      if (pitch.userId !== req.user.userId) {
        res.status(403).json({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'You do not own this pitch',
          },
        });
        return;
      }

      const result = await itemizedMatchingService.matchPitchToContact(
        pitchId,
        contactId
      );

      logger.info('[ItemizedMatch] Pitch match returned', {
        pitchId,
        contactId,
        criteriaCount: result.criteria.length,
        criticalMet: result.summary.criticalMet,
      });

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      if ((error as Error).message?.includes('not found')) {
        res.status(404).json({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Pitch or contact not found',
          },
        });
        return;
      }
      next(error);
    }
  }

  /**
   * Invalidate cached matches for a contact (call after contact update)
   *
   * POST /api/v1/matches/itemized/invalidate/:contactId
   */
  async invalidateCache(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AuthenticationError('Authentication required');
      }

      const { contactId } = req.params;

      await itemizedMatchingService.invalidateContactCache(contactId);

      res.status(200).json({
        success: true,
        message: 'Cache invalidated',
      });
    } catch (error) {
      next(error);
    }
  }
}

// Export singleton instance
export const itemizedMatchController = new ItemizedMatchController();

export default ItemizedMatchController;
