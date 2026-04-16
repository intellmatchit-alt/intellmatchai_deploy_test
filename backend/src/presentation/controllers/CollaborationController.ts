/**
 * Collaboration Controller
 * Handles HTTP requests for Collaboration operations
 * Updated for feature-based collaboration (no missions)
 */

import { Request, Response, NextFunction } from "express";
import { logger } from "../../shared/logger";
import { prisma } from "../../infrastructure/database/prisma/client.js";

// Import repositories
import {
  PrismaCollaborationRequestRepository,
  PrismaCollaborationSessionRepository,
  PrismaCollaborationMatchResultRepository,
  PrismaIntroductionRepository,
  PrismaCollaborationLedgerRepository,
  PrismaCollaborationSettingsRepository,
} from "../../infrastructure/repositories/PrismaCollaborationRepository";

// Import queue service
import { queueService } from "../../infrastructure/queue/QueueService";

// Import WebSocket for real-time notifications
import { emitToUser } from "../../infrastructure/websocket/index.js";

// Import wallet and config services for paid collaboration
import { walletService } from "../../infrastructure/services/WalletService.js";
import { InsufficientPointsError } from "../../shared/errors/InsufficientPointsError.js";
import { systemConfigService } from "../../infrastructure/services/SystemConfigService.js";

// Import use cases
import {
  SendCollaborationRequestUseCase,
  AcceptRequestUseCase,
  RejectRequestUseCase,
  CancelRequestUseCase,
  ListSentRequestsUseCase,
  ListReceivedRequestsUseCase,
  RunMatchingUseCase,
  GetSessionStatusUseCase,
  GetMatchResultsUseCase,
  CreateIntroductionUseCase,
  CompleteIntroductionUseCase,
  DeclineIntroductionUseCase,
  RespondToIntroductionUseCase,
  GetCollaborationSettingsUseCase,
  UpdateCollaborationSettingsUseCase,
  GetCollaborationLedgerUseCase,
  SendInvitationUseCase,
  AcceptInvitationUseCase,
  ListTeamMembersUseCase,
  RemoveTeamMemberUseCase,
} from "../../application/use-cases/collaboration";

import {
  CollaborationRequestStatus,
  CollaborationSourceType,
  InvitationChannel,
  TeamMemberStatus,
  getSourceId,
} from "../../domain/entities/Collaboration";

// Initialize repositories
const requestRepository = new PrismaCollaborationRequestRepository();
const sessionRepository = new PrismaCollaborationSessionRepository();
const matchResultRepository = new PrismaCollaborationMatchResultRepository();
const introductionRepository = new PrismaIntroductionRepository();
const ledgerRepository = new PrismaCollaborationLedgerRepository();
const settingsRepository = new PrismaCollaborationSettingsRepository();

// Initialize use cases
const sendRequestUseCase = new SendCollaborationRequestUseCase(
  prisma,
  requestRepository,
  settingsRepository,
);
const acceptRequestUseCase = new AcceptRequestUseCase(
  requestRepository,
  sessionRepository,
);
const rejectRequestUseCase = new RejectRequestUseCase(requestRepository);
const cancelRequestUseCase = new CancelRequestUseCase(requestRepository);
const listSentRequestsUseCase = new ListSentRequestsUseCase(requestRepository);
const listReceivedRequestsUseCase = new ListReceivedRequestsUseCase(
  requestRepository,
);
const runMatchingUseCase = new RunMatchingUseCase(
  requestRepository,
  sessionRepository,
  queueService,
  matchResultRepository,
);
const getSessionStatusUseCase = new GetSessionStatusUseCase(
  requestRepository,
  sessionRepository,
);
const getMatchResultsUseCase = new GetMatchResultsUseCase(
  sessionRepository,
  matchResultRepository,
);
const createIntroductionUseCase = new CreateIntroductionUseCase(
  requestRepository,
  matchResultRepository,
  introductionRepository,
);
const completeIntroductionUseCase = new CompleteIntroductionUseCase(
  requestRepository,
  introductionRepository,
  ledgerRepository,
);
const declineIntroductionUseCase = new DeclineIntroductionUseCase(
  introductionRepository,
);
const respondToIntroductionUseCase = new RespondToIntroductionUseCase(
  introductionRepository,
  requestRepository,
  ledgerRepository,
);
const getSettingsUseCase = new GetCollaborationSettingsUseCase(
  settingsRepository,
);
const updateSettingsUseCase = new UpdateCollaborationSettingsUseCase(
  settingsRepository,
);
const getLedgerUseCase = new GetCollaborationLedgerUseCase(ledgerRepository);

// V2 - Invitation and Team Member use cases
const sendInvitationUseCase = new SendInvitationUseCase(
  prisma,
  requestRepository,
  matchResultRepository,
);
const acceptInvitationUseCase = new AcceptInvitationUseCase();
const listTeamMembersUseCase = new ListTeamMembersUseCase(prisma);
const removeTeamMemberUseCase = new RemoveTeamMemberUseCase(prisma);

// ============================================================================
// Collaboration Request Endpoints
// ============================================================================

/**
 * Send collaboration request
 * POST /api/v1/collaboration-requests
 * Body: { sourceType, sourceId, toUserId?, toContactId?, message? }
 * NOTE: Either toUserId or toContactId must be provided (not both)
 * For contacts without accounts, auto-sends email invitation.
 */
export async function sendRequest(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = req.user!.userId;

    const input = {
      sourceType: req.body.sourceType as CollaborationSourceType,
      sourceId: req.body.sourceId,
      toUserId: req.body.toUserId,
      toContactId: req.body.toContactId,
      message: req.body.message,
      voiceMessageUrl: req.body.voiceMessageUrl,
    };

    // Debit points for collaboration request
    const collaborationCost = await systemConfigService.getNumber(
      "collaboration_request_cost",
      0,
    );
    if (collaborationCost > 0) {
      try {
        await walletService.debit(
          userId,
          collaborationCost,
          "Collaboration request",
          null,
          "COLLABORATION_REQUEST",
        );
      } catch (error) {
        if (error instanceof InsufficientPointsError) {
          res.status(402).json({
            success: false,
            error: {
              code: "INSUFFICIENT_POINTS",
              message: error.message,
              details: (error as any).details || { needed: collaborationCost },
            },
          });
          return;
        }
        throw error;
      }
    }

    let result;
    try {
      result = await sendRequestUseCase.execute(userId, input);
    } catch (useCaseError) {
      // Refund if use case fails after debit
      if (collaborationCost > 0) {
        try {
          await walletService.credit(
            userId,
            collaborationCost,
            "Collaboration request failed - refund",
            null,
            "COLLABORATION_REFUND",
          );
        } catch (refundError) {
          logger.error("Failed to refund collaboration request cost", {
            userId,
            error: refundError,
          });
        }
      }
      throw useCaseError;
    }

    // Auto-send email to non-member contacts
    if (result.toContactId && input.toContactId) {
      try {
        const contact = await prisma.contact.findUnique({
          where: { id: input.toContactId },
          select: { email: true, fullName: true },
        });
        if (contact?.email) {
          const sender = await prisma.user.findUnique({
            where: { id: userId },
            select: { fullName: true, company: true },
          });
          const senderName = sender?.fullName || "Someone";
          const { emailService } =
            await import("../../infrastructure/services/EmailService.js");
          const frontendUrl =
            process.env.FRONTEND_URL || "https://intellmatch.com";

          // Get source title
          let sourceTitle = "a collaboration";
          try {
            if (input.sourceType === "PROJECT") {
              const p = await prisma.project.findUnique({
                where: { id: input.sourceId },
                select: { title: true },
              });
              if (p?.title) sourceTitle = p.title;
            } else if (input.sourceType === "OPPORTUNITY") {
              const o = await prisma.opportunityIntent.findUnique({
                where: { id: input.sourceId },
                select: { title: true },
              });
              if (o?.title) sourceTitle = o.title;
            } else if (input.sourceType === "PITCH") {
              const p = await prisma.pitch.findUnique({
                where: { id: input.sourceId },
                select: { title: true },
              });
              if (p?.title) sourceTitle = p.title;
            } else if (input.sourceType === "DEAL") {
              const d = await prisma.dealRequest.findUnique({
                where: { id: input.sourceId },
                select: { title: true },
              });
              if (d?.title) sourceTitle = d.title;
            }
          } catch {
            /* ignore */
          }

          await emailService.sendCollaborationInvitationEmail(contact.email, {
            recipientName: contact.fullName,
            inviterName: senderName,
            ownerName: senderName,
            ownerCompany: sender?.company || undefined,
            sourceType: input.sourceType as string,
            sourceTitle,
            sourceDescription: input.message || undefined,
            invitationUrl: `${frontendUrl}/register`,
            customMessage: input.message || undefined,
          });
          logger.info("Auto-sent collaboration invitation email", {
            contactId: input.toContactId,
            contactEmail: contact.email,
            requestId: result.id,
          });
        }
      } catch (emailError) {
        logger.warn("Failed to send collaboration invitation email", {
          contactId: input.toContactId,
          error: emailError,
        });
      }
    }

    // Create in-app notification for the recipient (if they are a platform user)
    if (result.toUserId) {
      try {
        // Get sender name and source title for notification message
        const senderUser = await prisma.user.findUnique({
          where: { id: userId },
          select: { fullName: true },
        });
        const sName = senderUser?.fullName || "Someone";

        let sTitle = "a collaboration";
        try {
          if (input.sourceType === "PROJECT") {
            const p = await prisma.project.findUnique({
              where: { id: input.sourceId },
              select: { title: true },
            });
            if (p?.title) sTitle = p.title;
          } else if (input.sourceType === "OPPORTUNITY") {
            const o = await prisma.opportunityIntent.findUnique({
              where: { id: input.sourceId },
              select: { title: true },
            });
            if (o?.title) sTitle = o.title;
          } else if (input.sourceType === "PITCH") {
            const p = await prisma.pitch.findUnique({
              where: { id: input.sourceId },
              select: { title: true },
            });
            if (p?.title) sTitle = p.title;
          } else if (input.sourceType === "DEAL") {
            const d = await prisma.dealRequest.findUnique({
              where: { id: input.sourceId },
              select: { title: true },
            });
            if (d?.title) sTitle = d.title;
          }
        } catch {
          /* ignore */
        }

        await prisma.notification.create({
          data: {
            userId: result.toUserId,
            type: "collaboration_request_received",
            title: "New Collaboration Request",
            message: `${sName} wants to collaborate on "${sTitle}"`,
            data: {
              requestId: result.id,
              sourceType: input.sourceType,
              sourceId: input.sourceId,
              fromUserId: userId,
            },
          },
        });

        // Real-time WebSocket push
        emitToUser(result.toUserId, "notification:new", {
          type: "collaboration_request_received",
          title: "New Collaboration Request",
          message: `${sName} wants to collaborate on "${sTitle}"`,
          requestId: result.id,
        });
      } catch (notifError) {
        logger.warn("Failed to create collaboration request notification", {
          error: notifError,
        });
      }
    }

    res.status(201).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

/**
 * Send bulk collaboration requests
 * POST /api/v1/collaboration-requests/bulk
 * Body: { sourceType, sourceId, contactIds: string[], message?, voiceMessageUrl? }
 *
 * For contacts without IntellMatch accounts, auto-sends email invitations.
 */
export async function sendBulkRequests(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = req.user!.userId;
    const { sourceType, sourceId, contactIds, message, voiceMessageUrl } =
      req.body;

    if (!Array.isArray(contactIds) || contactIds.length === 0) {
      res.status(400).json({
        success: false,
        error: { message: "contactIds must be a non-empty array" },
      });
      return;
    }

    if (contactIds.length > 50) {
      res.status(400).json({
        success: false,
        error: { message: "Cannot send more than 50 requests at once" },
      });
      return;
    }

    // Get sender info for email invitations
    const sender = await prisma.user.findUnique({
      where: { id: userId },
      select: { fullName: true, company: true },
    });
    const senderName = sender?.fullName || "Someone";

    // Get source feature title for email
    let sourceTitle = "a collaboration";
    try {
      if (sourceType === "PROJECT") {
        const p = await prisma.project.findUnique({
          where: { id: sourceId },
          select: { title: true },
        });
        if (p?.title) sourceTitle = p.title;
      } else if (sourceType === "OPPORTUNITY") {
        const o = await prisma.opportunityIntent.findUnique({
          where: { id: sourceId },
          select: { title: true },
        });
        if (o?.title) sourceTitle = o.title;
      } else if (sourceType === "PITCH") {
        const p = await prisma.pitch.findUnique({
          where: { id: sourceId },
          select: { title: true, companyName: true },
        });
        if (p?.title) sourceTitle = p.title;
      } else if (sourceType === "DEAL") {
        const d = await prisma.dealRequest.findUnique({
          where: { id: sourceId },
          select: { title: true },
        });
        if (d?.title) sourceTitle = d.title;
      }
    } catch {
      /* ignore - use default */
    }

    // Debit points for bulk collaboration requests
    const collaborationCost = await systemConfigService.getNumber(
      "collaboration_request_cost",
      0,
    );
    const totalCost = collaborationCost * contactIds.length;
    if (totalCost > 0) {
      try {
        await walletService.debit(
          userId,
          totalCost,
          `Bulk collaboration requests (${contactIds.length})`,
          null,
          "COLLABORATION_REQUEST",
        );
      } catch (error) {
        if (error instanceof InsufficientPointsError) {
          res.status(402).json({
            success: false,
            error: {
              code: "INSUFFICIENT_POINTS",
              message: error.message,
              details: (error as any).details || { needed: totalCost },
            },
          });
          return;
        }
        throw error;
      }
    }

    const results: {
      contactId: string;
      success: boolean;
      requestId?: string;
      error?: string;
      emailSent?: boolean;
    }[] = [];

    for (const contactId of contactIds) {
      try {
        const result = await sendRequestUseCase.execute(userId, {
          sourceType: sourceType as CollaborationSourceType,
          sourceId,
          toContactId: contactId,
          message,
          voiceMessageUrl,
        });

        let emailSent = false;

        // If the request was sent to a contact (not converted to user), auto-send email
        if (result.toContactId) {
          try {
            const contact = await prisma.contact.findUnique({
              where: { id: contactId },
              select: { email: true, fullName: true },
            });

            if (contact?.email) {
              const { emailService } =
                await import("../../infrastructure/services/EmailService.js");
              const frontendUrl =
                process.env.FRONTEND_URL || "https://intellmatch.com";

              await emailService.sendCollaborationInvitationEmail(
                contact.email,
                {
                  recipientName: contact.fullName,
                  inviterName: senderName,
                  ownerName: senderName,
                  ownerCompany: sender?.company || undefined,
                  sourceType: sourceType,
                  sourceTitle: sourceTitle,
                  sourceDescription: message || undefined,
                  invitationUrl: `${frontendUrl}/register`,
                  customMessage: message || undefined,
                },
              );
              emailSent = true;
              logger.info("Auto-sent collaboration invitation email", {
                contactId,
                contactEmail: contact.email,
                requestId: result.id,
              });
            }
          } catch (emailError) {
            logger.warn("Failed to send collaboration invitation email", {
              contactId,
              error: emailError,
            });
          }
        }

        // Create in-app notification if the request resolved to a platform user
        if (result.toUserId) {
          try {
            await prisma.notification.create({
              data: {
                userId: result.toUserId,
                type: "collaboration_request_received",
                title: "New Collaboration Request",
                message: `${senderName} wants to collaborate on "${sourceTitle}"`,
                data: {
                  requestId: result.id,
                  sourceType,
                  sourceId,
                  fromUserId: userId,
                },
              },
            });
            emitToUser(result.toUserId, "notification:new", {
              type: "collaboration_request_received",
              title: "New Collaboration Request",
              message: `${senderName} wants to collaborate on "${sourceTitle}"`,
              requestId: result.id,
            });
          } catch (notifError) {
            logger.warn(
              "Failed to create bulk collaboration request notification",
              { error: notifError },
            );
          }
        }

        results.push({
          contactId,
          success: true,
          requestId: result.id,
          emailSent,
        });
      } catch (error: any) {
        results.push({
          contactId,
          success: false,
          error: error.message || "Failed to send request",
        });
      }
    }

    const successCount = results.filter((r) => r.success).length;
    const failedCount = results.filter((r) => !r.success).length;
    const emailsSent = results.filter((r) => r.emailSent).length;

    // Refund for failed requests
    if (failedCount > 0 && collaborationCost > 0) {
      const refundAmount = failedCount * collaborationCost;
      try {
        await walletService.credit(
          userId,
          refundAmount,
          `Collaboration bulk refund (${failedCount} failed)`,
          null,
          "COLLABORATION_REFUND",
        );
      } catch (refundError) {
        logger.error("Failed to refund bulk collaboration failures", {
          userId,
          refundAmount,
          error: refundError,
        });
      }
    }

    res.status(201).json({
      success: true,
      data: {
        results,
        summary: {
          total: contactIds.length,
          sent: successCount,
          failed: failedCount,
          emailsSent,
        },
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * List sent requests (owner view)
 * GET /api/v1/collaboration-requests/sent
 */
export async function listSentRequests(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = req.user!.userId;

    const query = {
      status: req.query.status as CollaborationRequestStatus | undefined,
      sourceType: req.query.sourceType as CollaborationSourceType | undefined,
      sourceId: req.query.sourceId as string | undefined,
      page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
      limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 20,
    };

    const result = await listSentRequestsUseCase.execute(userId, query);

    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

/**
 * List received requests (collaborator inbox)
 * GET /api/v1/collaboration-requests/inbox
 */
export async function listReceivedRequests(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = req.user!.userId;

    const query = {
      status: req.query.status as CollaborationRequestStatus | undefined,
      sourceType: req.query.sourceType as CollaborationSourceType | undefined,
      page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
      limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 20,
    };

    const result = await listReceivedRequestsUseCase.execute(userId, query);

    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

/**
 * Get request by ID (filtered based on role)
 * GET /api/v1/collaboration-requests/:id
 */
export async function getRequest(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = req.user!.userId;
    const requestId = req.params.id;

    const request = await requestRepository.findByIdWithDetails(
      String(requestId),
    );

    if (!request) {
      res.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: "Request not found" },
      });
      return;
    }

    // Check if user has access
    if (request.fromUserId !== userId && request.toUserId !== userId) {
      res.status(403).json({
        success: false,
        error: { code: "FORBIDDEN", message: "Access denied" },
      });
      return;
    }

    const sourceId = getSourceId(request);

    // Format based on role
    if (request.fromUserId === userId) {
      // Owner view - no contact data
      res.json({
        success: true,
        data: {
          id: request.id,
          sourceType: request.sourceType,
          sourceId: sourceId,
          status: request.status,
          message: request.message,
          voiceMessageUrl: request.voiceMessageUrl || null,
          createdAt: request.createdAt.toISOString(),
          respondedAt: request.respondedAt?.toISOString() || null,
          toUser: request.toUser,
          completedIntroductionsCount: request.completedIntroductionsCount,
        },
      });
    } else {
      // Collaborator view - full access
      res.json({
        success: true,
        data: {
          id: request.id,
          sourceType: request.sourceType,
          sourceId: sourceId,
          status: request.status,
          message: request.message,
          voiceMessageUrl: request.voiceMessageUrl || null,
          createdAt: request.createdAt.toISOString(),
          respondedAt: request.respondedAt?.toISOString() || null,
          sourceFeature: request.sourceFeature,
          fromUser: request.fromUser,
          session: request.session,
        },
      });
    }
  } catch (error) {
    next(error);
  }
}

/**
 * Cancel request (owner only)
 * POST /api/v1/collaboration-requests/:id/cancel
 */
export async function cancelRequest(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = req.user!.userId;
    const requestId = req.params.id;

    const result = await cancelRequestUseCase.execute(
      userId,
      String(requestId),
    );

    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

/**
 * Accept request (collaborator only)
 * POST /api/v1/collaboration-requests/:id/accept
 */
export async function acceptRequest(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = req.user!.userId;
    const requestId = req.params.id;

    const result = await acceptRequestUseCase.execute(
      userId,
      String(requestId),
    );

    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

/**
 * Reject request (collaborator only)
 * POST /api/v1/collaboration-requests/:id/reject
 */
export async function rejectRequest(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = req.user!.userId;
    const requestId = req.params.id;

    const result = await rejectRequestUseCase.execute(
      userId,
      String(requestId),
    );

    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

// ============================================================================
// Collaboration Session Endpoints
// ============================================================================

/**
 * Run matching for a request
 * POST /api/v1/collaboration-requests/:id/run-matching
 */
export async function runMatching(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = req.user!.userId;
    const requestId = req.params.id;

    const result = await runMatchingUseCase.execute(userId, String(requestId));

    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

/**
 * Get session status
 * GET /api/v1/collaboration-sessions/:sessionId
 */
export async function getSessionStatus(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = req.user!.userId;
    const sessionId = req.params.sessionId;

    const result = await getSessionStatusUseCase.execute(
      userId,
      String(sessionId),
    );

    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

/**
 * Get match results for a session
 * GET /api/v1/collaboration-sessions/:sessionId/results
 */
export async function getMatchResults(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = req.user!.userId;
    const sessionId = req.params.sessionId;

    const query = {
      minScore: req.query.minScore
        ? parseInt(req.query.minScore as string, 10)
        : undefined,
      isIntroduced:
        req.query.isIntroduced !== undefined
          ? req.query.isIntroduced === "true"
          : undefined,
      isDismissed:
        req.query.isDismissed !== undefined
          ? req.query.isDismissed === "true"
          : undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 50,
      offset: req.query.offset ? parseInt(req.query.offset as string, 10) : 0,
    };

    const result = await getMatchResultsUseCase.execute(
      userId,
      String(sessionId),
      query,
    );

    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

// ============================================================================
// Introduction Endpoints
// ============================================================================

/**
 * Create introduction
 * POST /api/v1/collaboration-requests/:id/introductions
 */
export async function createIntroduction(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = req.user!.userId;
    const requestId = String(req.params.id);

    const input = {
      requestId,
      matchResultId: req.body.matchResultId,
      channel: req.body.channel as "EMAIL" | "WHATSAPP" | undefined,
      contactEmail: req.body.contactEmail,
      contactPhone: req.body.contactPhone,
      message: req.body.message,
    };

    const result = await createIntroductionUseCase.execute(userId, input);

    res.status(201).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

/**
 * Get introductions for a request
 * GET /api/v1/collaboration-requests/:id/introductions
 * Both feature owner and collaborator can view (with different data)
 */
export async function getIntroductions(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = req.user!.userId;
    const requestId = req.params.id;

    // Get request with details to check ownership
    const request = await requestRepository.findByIdWithDetails(
      String(requestId),
    );
    if (!request) {
      res.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: "Request not found" },
      });
      return;
    }

    const isOwner = request.fromUserId === userId;
    const isCollaborator = request.toUserId === userId;

    if (!isOwner && !isCollaborator) {
      res.status(403).json({
        success: false,
        error: { code: "FORBIDDEN", message: "Access denied" },
      });
      return;
    }

    const introductions =
      await introductionRepository.findByCollaborationRequestId(
        String(requestId),
      );

    // For feature owner, fetch contact details
    if (isOwner) {
      const contactIds = introductions.map((i) => i.thirdPartyContactRef);
      const contacts = await prisma.contact.findMany({
        where: { id: { in: contactIds } },
        select: {
          id: true,
          fullName: true,
          company: true,
          jobTitle: true,
        },
      });

      const contactMap = new Map(
        contacts.map(
          (c: {
            id: string;
            fullName: string;
            company: string | null;
            jobTitle: string | null;
          }) => [c.id, c],
        ),
      );

      res.json({
        success: true,
        data: {
          introductions: introductions.map((i) => {
            const contact = contactMap.get(i.thirdPartyContactRef);
            return {
              id: i.id,
              status: i.status,
              channel: i.channel || null,
              contactName: i.contactName || contact?.fullName || null,
              completedAt: i.completedAt?.toISOString() || null,
              createdAt: i.createdAt.toISOString(),
              contact: contact
                ? {
                    fullName: contact.fullName,
                    company: contact.company,
                    jobTitle: contact.jobTitle,
                  }
                : null,
              collaborator: {
                id: request.toUser.id,
                fullName: request.toUser.fullName,
                avatarUrl: request.toUser.avatarUrl,
              },
            };
          }),
        },
      });
    } else {
      // For collaborator, include contact name and channel info
      res.json({
        success: true,
        data: {
          introductions: introductions.map((i) => ({
            id: i.id,
            thirdPartyContactRef: i.thirdPartyContactRef,
            status: i.status,
            channel: i.channel || null,
            contactName: i.contactName || null,
            contactEmail: i.contactEmail || null,
            contactPhone: i.contactPhone || null,
            completedAt: i.completedAt?.toISOString() || null,
            createdAt: i.createdAt.toISOString(),
          })),
        },
      });
    }
  } catch (error) {
    next(error);
  }
}

/**
 * Complete introduction
 * POST /api/v1/introductions/:id/complete
 */
export async function completeIntroduction(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = req.user!.userId;
    const introductionId = String(req.params.id);

    const result = await completeIntroductionUseCase.execute(
      userId,
      introductionId,
    );

    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

/**
 * Decline introduction
 * POST /api/v1/introductions/:id/decline
 */
export async function declineIntroduction(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = req.user!.userId;
    const introductionId = String(req.params.id);

    const result = await declineIntroductionUseCase.execute(
      userId,
      introductionId,
    );

    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

/**
 * Add contact from introduction
 * POST /api/v1/introductions/:id/add-contact
 * Creates a contact in the feature owner's contact list from an introduction
 */
export async function addContactFromIntroduction(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = req.user!.userId;
    const introductionId = String(req.params.id);

    // Get the introduction
    const introduction = await introductionRepository.findById(introductionId);
    if (!introduction) {
      res.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: "Introduction not found" },
      });
      return;
    }

    // Get the collaboration request to verify ownership
    const request = await requestRepository.findByIdWithDetails(
      introduction.collaborationRequestId,
    );
    if (!request) {
      res.status(404).json({
        success: false,
        error: {
          code: "NOT_FOUND",
          message: "Collaboration request not found",
        },
      });
      return;
    }

    // Only the feature owner can add contacts from introductions
    if (request.fromUserId !== userId) {
      res.status(403).json({
        success: false,
        error: {
          code: "FORBIDDEN",
          message: "Only the feature owner can add contacts from introductions",
        },
      });
      return;
    }

    // Get the original contact data
    const sourceContact = await prisma.contact.findUnique({
      where: { id: introduction.thirdPartyContactRef },
      include: {
        contactSectors: { include: { sector: true } },
        contactSkills: { include: { skill: true } },
      },
    });

    if (!sourceContact) {
      res.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: "Source contact not found" },
      });
      return;
    }

    // Check if contact already exists for this user (by email or name+company)
    const existingContact = await prisma.contact.findFirst({
      where: {
        ownerId: userId,
        OR: [
          ...(sourceContact.email ? [{ email: sourceContact.email }] : []),
          {
            AND: [
              { fullName: sourceContact.fullName },
              { company: sourceContact.company },
            ],
          },
        ],
      },
    });

    if (existingContact) {
      res.status(409).json({
        success: false,
        error: {
          code: "CONFLICT",
          message: "Contact already exists in your network",
        },
        data: { existingContactId: existingContact.id },
      });
      return;
    }

    // Get source feature info for notes
    const sourceId = getSourceId(request);
    const sourceTitle = request.sourceFeature?.title || "Unknown";

    // Create the new contact for the feature owner
    const newContact = await prisma.contact.create({
      data: {
        ownerId: userId,
        fullName: sourceContact.fullName,
        email: sourceContact.email,
        phone: sourceContact.phone,
        company: sourceContact.company,
        jobTitle: sourceContact.jobTitle,
        website: sourceContact.website,
        linkedinUrl: sourceContact.linkedinUrl,
        location: sourceContact.location,
        bio: sourceContact.bio,
        bioSummary: sourceContact.bioSummary,
        source: "COLLABORATION",
        introducedByUserId: request.toUserId,
        introductionId: introductionId,
        notes: `Introduced by ${request.toUser.fullName} for ${request.sourceType.toLowerCase()}: ${sourceTitle}`,
        rawSources: [],
      },
    });

    // Copy sectors
    if (sourceContact.contactSectors.length > 0) {
      await prisma.contactSector.createMany({
        data: sourceContact.contactSectors.map((cs: { sectorId: string }) => ({
          contactId: newContact.id,
          sectorId: cs.sectorId,
          source: "AI",
        })),
        skipDuplicates: true,
      });
    }

    // Copy skills
    if (sourceContact.contactSkills.length > 0) {
      await prisma.contactSkill.createMany({
        data: sourceContact.contactSkills.map((cs: { skillId: string }) => ({
          contactId: newContact.id,
          skillId: cs.skillId,
          source: "AI",
        })),
        skipDuplicates: true,
      });
    }

    // Fetch the complete contact with relations
    const completeContact = await prisma.contact.findUnique({
      where: { id: newContact.id },
      include: {
        contactSectors: { include: { sector: true } },
        contactSkills: { include: { skill: true } },
        introducedByUser: {
          select: { id: true, fullName: true, avatarUrl: true },
        },
      },
    });

    res.status(201).json({
      success: true,
      data: {
        contact: completeContact,
        message: `Contact "${newContact.fullName}" added to your network`,
      },
    });
  } catch (error) {
    next(error);
  }
}

// ============================================================================
// Collaboration Settings Endpoints
// ============================================================================

/**
 * Get collaboration settings
 * GET /api/v1/collaboration-settings
 */
export async function getSettings(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = req.user!.userId;

    const result = await getSettingsUseCase.execute(userId);

    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

/**
 * Update collaboration settings
 * PUT /api/v1/collaboration-settings
 */
export async function updateSettings(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = req.user!.userId;

    const input = {
      globalCollaborationEnabled: req.body.globalCollaborationEnabled,
      allowedSourceTypes: req.body.allowedSourceTypes as
        | CollaborationSourceType[]
        | undefined,
      blockedUserIds: req.body.blockedUserIds,
      allowedUserIds: req.body.allowedUserIds,
      perTypeOverrides: req.body.perTypeOverrides,
    };

    const result = await updateSettingsUseCase.execute(userId, input);

    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

// ============================================================================
// Collaboration Ledger Endpoints
// ============================================================================

/**
 * Get collaboration ledger
 * GET /api/v1/collaboration-ledger
 */
export async function getLedger(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = req.user!.userId;

    const result = await getLedgerUseCase.execute(userId);

    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

/**
 * Get ledger with specific user
 * GET /api/v1/collaboration-ledger/with/:userId
 */
export async function getLedgerWithUser(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = req.user!.userId;
    const otherUserId = String(req.params.userId);

    const result = await getLedgerUseCase.getWithUser(userId, otherUserId);

    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

// ============================================================================
// Collaboration Invitation Endpoints (V2)
// ============================================================================

/**
 * Send collaboration invitation (via Email/WhatsApp/SMS)
 * POST /api/v1/collaboration-requests/:id/send-invitation
 * Body: { matchResultId?, recipientName, recipientEmail?, recipientPhone?, channel, message? }
 */
export async function sendInvitation(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = req.user!.userId;
    const collaborationRequestId = String(req.params.id);

    const input = {
      collaborationRequestId,
      matchResultId: req.body.matchResultId,
      recipientName: req.body.recipientName,
      recipientEmail: req.body.recipientEmail,
      recipientPhone: req.body.recipientPhone,
      channel: req.body.channel as InvitationChannel,
      message: req.body.message,
    };

    const result = await sendInvitationUseCase.execute(userId, input);

    if (result.success) {
      res.status(201).json({ success: true, data: result });
    } else {
      res.status(400).json({
        success: false,
        error: {
          code: "INVITATION_FAILED",
          message: result.error || "Failed to send invitation",
        },
      });
    }
  } catch (error) {
    next(error);
  }
}

/**
 * Get invitation by token (PUBLIC - no auth required)
 * GET /api/v1/invitations/:token
 */
export async function getInvitationByToken(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const token = String(req.params.token);

    const result = await acceptInvitationUseCase.getInvitation({ token });

    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

/**
 * Accept invitation (PUBLIC - no auth required)
 * POST /api/v1/invitations/:token/accept
 * Body: { acceptedByUserId? }
 */
export async function acceptInvitation(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const token = String(req.params.token);
    const acceptedByUserId = req.body.acceptedByUserId || req.user?.userId;

    const result = await acceptInvitationUseCase.accept({
      token,
      acceptedByUserId,
    });

    if (result.success) {
      res.json({ success: true, data: result });
    } else {
      res.status(400).json({
        success: false,
        error: {
          code: "ACCEPT_FAILED",
          message: result.error || "Failed to accept invitation",
        },
      });
    }
  } catch (error) {
    next(error);
  }
}

/**
 * Decline invitation (PUBLIC - no auth required)
 * POST /api/v1/invitations/:token/decline
 * Body: { reason? }
 */
export async function declineInvitationByToken(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const token = String(req.params.token);
    const reason = req.body.reason;

    const result = await acceptInvitationUseCase.decline({ token, reason });

    if (result.success) {
      res.json({ success: true, data: { message: "Invitation declined" } });
    } else {
      res.status(400).json({
        success: false,
        error: {
          code: "DECLINE_FAILED",
          message: result.error || "Failed to decline invitation",
        },
      });
    }
  } catch (error) {
    next(error);
  }
}

// ============================================================================
// Team Member Endpoints (V2)
// ============================================================================

/**
 * List team members for a feature
 * GET /api/v1/:sourceType/:sourceId/team
 * Query: { status? }
 */
export async function listTeamMembers(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = req.user!.userId;
    const sourceType = String(
      req.params.sourceType,
    ).toUpperCase() as CollaborationSourceType;
    const sourceId = String(req.params.sourceId);
    const status = req.query.status as TeamMemberStatus | undefined;

    const result = await listTeamMembersUseCase.execute(userId, {
      sourceType,
      sourceId,
      status,
    });

    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

/**
 * Remove team member from a feature
 * DELETE /api/v1/:sourceType/:sourceId/team/:memberId
 * Body: { reason? }
 */
export async function removeTeamMember(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = req.user!.userId;
    const sourceType = String(
      req.params.sourceType,
    ).toUpperCase() as CollaborationSourceType;
    const sourceId = String(req.params.sourceId);
    const memberId = String(req.params.memberId);
    const reason = req.body.reason;

    const result = await removeTeamMemberUseCase.execute(userId, {
      sourceType,
      sourceId,
      memberId,
      reason,
    });

    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

// ============================================================================
// Public Introduction Consent Endpoints (no auth required)
// ============================================================================

/**
 * Get introduction by token (PUBLIC - no auth required)
 * GET /api/v1/introductions/by-token/:token
 */
export async function getIntroductionByToken(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const token = String(req.params.token);

    const result = await respondToIntroductionUseCase.getByToken(token);

    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

/**
 * Accept introduction by token (PUBLIC - no auth required)
 * POST /api/v1/introductions/by-token/:token/accept
 */
export async function acceptIntroductionByToken(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const token = String(req.params.token);

    const result = await respondToIntroductionUseCase.accept(token);

    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

/**
 * Decline introduction by token (PUBLIC - no auth required)
 * POST /api/v1/introductions/by-token/:token/decline
 */
export async function declineIntroductionByToken(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const token = String(req.params.token);

    const result = await respondToIntroductionUseCase.decline(token);

    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

// ============================================================================
// Voice Upload Endpoint
// ============================================================================

/**
 * Upload a voice message for collaboration requests
 * POST /api/v1/collaboration-requests/upload-voice
 * Multipart: voice (audio file)
 * Returns: { url: string }
 */
export async function uploadVoice(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = req.user!.userId;

    if (!req.file) {
      res.status(400).json({
        success: false,
        error: { code: "NO_FILE", message: "No audio file provided" },
      });
      return;
    }

    const mimeType = req.file.mimetype || "audio/webm";
    const ext = req.file.originalname?.split(".").pop() || "webm";

    let mediaUrl: string;
    try {
      const { getStorageService } =
        await import("../../infrastructure/external/storage/index.js");
      const storage = getStorageService();

      const bucket = "collaboration-voice";
      const key = `${userId}/${Date.now()}-${Math.random().toString(36).substr(2, 9)}.${ext}`;

      await storage.ensureBucket(bucket);

      const result = await storage.upload(bucket, key, req.file.buffer, {
        contentType: mimeType,
      });
      mediaUrl = result.url;
    } catch (storageError) {
      // Fallback to base64 data URL
      logger.warn("Storage upload failed for voice, using base64", {
        error: storageError,
      });
      const base64 = req.file.buffer.toString("base64");
      mediaUrl = `data:${mimeType};base64,${base64}`;
    }

    logger.info("Voice message uploaded for collaboration", {
      userId,
      url: mediaUrl.substring(0, 100),
    });

    res.status(201).json({
      success: true,
      data: { url: mediaUrl },
    });
  } catch (error) {
    next(error);
  }
}
