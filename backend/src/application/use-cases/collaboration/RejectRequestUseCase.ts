/**
 * Use Case: Reject Collaboration Request
 * Collaborator rejects a request
 */

import { ICollaborationRequestRepository } from '../../../domain/repositories/ICollaborationRepository';
import { CollaborationRequestStatus } from '../../../domain/entities/Collaboration';
import { NotFoundError, ForbiddenError, ValidationError } from '../../../shared/errors/index';
import { logger } from '../../../shared/logger';
import { prisma } from '../../../infrastructure/database/prisma/client';
import { emitToUser } from '../../../infrastructure/websocket/index';
import { walletService } from '../../../infrastructure/services/WalletService';
import { systemConfigService } from '../../../infrastructure/services/SystemConfigService';

export interface RejectRequestOutput {
  id: string;
  status: string;
  respondedAt: string;
}

export class RejectRequestUseCase {
  constructor(private readonly requestRepository: ICollaborationRequestRepository) {}

  async execute(userId: string, requestId: string): Promise<RejectRequestOutput> {
    const request = await this.requestRepository.findById(requestId);

    if (!request) {
      throw new NotFoundError('Collaboration request not found');
    }

    // Only the recipient can reject
    if (request.toUserId !== userId) {
      throw new ForbiddenError('You do not have permission to reject this request');
    }

    if (request.status !== CollaborationRequestStatus.PENDING) {
      throw new ValidationError(`Cannot reject a request with status: ${request.status}`);
    }

    logger.info('Rejecting collaboration request', { requestId, userId });

    const updatedRequest = await this.requestRepository.update(requestId, {
      status: CollaborationRequestStatus.REJECTED,
      respondedAt: new Date(),
    });

    logger.info('Collaboration request rejected', { requestId });

    // Refund the requester's points
    try {
      const cost = await systemConfigService.getNumber('collaboration_request_cost', 0);
      if (cost > 0) {
        await walletService.credit(request.fromUserId, cost, 'Collaboration request declined - refund', requestId, 'COLLABORATION_REFUND');
        logger.info('Refunded requester for rejected collaboration', { fromUserId: request.fromUserId, cost, requestId });
      }
    } catch (walletError) {
      logger.error('Failed to refund collaboration request cost', { fromUserId: request.fromUserId, requestId, error: walletError });
    }

    // Notify the request sender that their request was rejected
    try {
      const rejector = await prisma.user.findUnique({
        where: { id: userId },
        select: { fullName: true },
      });
      const rejectorName = rejector?.fullName || 'Someone';

      await prisma.notification.create({
        data: {
          userId: request.fromUserId,
          type: 'collaboration_request_rejected',
          title: 'Collaboration Request Declined',
          message: `${rejectorName} declined your collaboration request`,
          data: { requestId },
        },
      });

      emitToUser(request.fromUserId, 'notification:new', {
        type: 'collaboration_request_rejected',
        title: 'Collaboration Request Declined',
        message: `${rejectorName} declined your collaboration request`,
        requestId,
      });
    } catch (notifError) {
      logger.warn('Failed to create reject notification', { error: notifError });
    }

    return {
      id: updatedRequest.id,
      status: updatedRequest.status,
      respondedAt: updatedRequest.respondedAt!.toISOString(),
    };
  }
}
