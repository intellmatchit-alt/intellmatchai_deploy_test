/**
 * Use Case: Accept Collaboration Request
 * Collaborator accepts a request and creates a matching session
 */

import {
  ICollaborationRequestRepository,
  ICollaborationSessionRepository,
} from '../../../domain/repositories/ICollaborationRepository';
import { CollaborationRequestStatus, CollaborationSessionStatus } from '../../../domain/entities/Collaboration';
import { NotFoundError, ForbiddenError, ValidationError } from '../../../shared/errors/index';
import { logger } from '../../../shared/logger';
import { prisma } from '../../../infrastructure/database/prisma/client';
import { emitToUser } from '../../../infrastructure/websocket/index';
import { walletService } from '../../../infrastructure/services/WalletService';
import { systemConfigService } from '../../../infrastructure/services/SystemConfigService';

export interface AcceptRequestOutput {
  id: string;
  status: string;
  sessionId: string;
  respondedAt: string;
}

export class AcceptRequestUseCase {
  constructor(
    private readonly requestRepository: ICollaborationRequestRepository,
    private readonly sessionRepository: ICollaborationSessionRepository
  ) {}

  async execute(userId: string, requestId: string): Promise<AcceptRequestOutput> {
    const request = await this.requestRepository.findById(requestId);

    if (!request) {
      throw new NotFoundError('Collaboration request not found');
    }

    // Only the recipient can accept
    if (request.toUserId !== userId) {
      throw new ForbiddenError('You do not have permission to accept this request');
    }

    if (request.status !== CollaborationRequestStatus.PENDING) {
      throw new ValidationError(`Cannot accept a request with status: ${request.status}`);
    }

    logger.info('Accepting collaboration request', { requestId, userId });

    // Update request status
    const updatedRequest = await this.requestRepository.update(requestId, {
      status: CollaborationRequestStatus.ACCEPTED,
      respondedAt: new Date(),
    });

    // Create matching session
    const session = await this.sessionRepository.create({
      collaborationRequestId: requestId,
      collaboratorUserId: userId,
    });

    logger.info('Collaboration request accepted, session created', {
      requestId,
      sessionId: session.id,
    });

    // Credit collaborator with their share of the request cost
    let collaboratorShare = 0;
    try {
      const cost = await systemConfigService.getNumber('collaboration_request_cost', 0);
      if (cost > 0) {
        const platformPercentage = await systemConfigService.getNumber('collaboration_platform_percentage', 20);
        const platformCut = Math.floor(cost * platformPercentage / 100);
        collaboratorShare = cost - platformCut;
        if (collaboratorShare > 0) {
          await walletService.credit(userId, collaboratorShare, 'Collaboration accepted - earned', requestId, 'COLLABORATION_ACCEPT');
          logger.info('Collaborator credited for accepted request', { userId, collaboratorShare, platformCut, requestId });
        }
      }
    } catch (walletError) {
      logger.error('Failed to credit collaborator wallet', { userId, requestId, error: walletError });
    }

    // Notify the request sender that their request was accepted
    try {
      const acceptor = await prisma.user.findUnique({
        where: { id: userId },
        select: { fullName: true },
      });
      const acceptorName = acceptor?.fullName || 'Someone';

      await prisma.notification.create({
        data: {
          userId: request.fromUserId,
          type: 'collaboration_request_accepted',
          title: 'Collaboration Request Accepted',
          message: `${acceptorName} accepted your collaboration request`,
          data: { requestId, sessionId: session.id },
        },
      });

      emitToUser(request.fromUserId, 'notification:new', {
        type: 'collaboration_request_accepted',
        title: 'Collaboration Request Accepted',
        message: `${acceptorName} accepted your collaboration request`,
        requestId,
        sessionId: session.id,
      });
    } catch (notifError) {
      logger.warn('Failed to create accept notification', { error: notifError });
    }

    return {
      id: updatedRequest.id,
      status: updatedRequest.status,
      sessionId: session.id,
      respondedAt: updatedRequest.respondedAt!.toISOString(),
    };
  }
}
