/**
 * Use Case: Cancel Collaboration Request
 * Owner cancels a pending request
 */

import { ICollaborationRequestRepository } from '../../../domain/repositories/ICollaborationRepository';
import { CollaborationRequestStatus } from '../../../domain/entities/Collaboration';
import { NotFoundError, ForbiddenError, ValidationError } from '../../../shared/errors/index';
import { logger } from '../../../shared/logger';
import { walletService } from '../../../infrastructure/services/WalletService';
import { systemConfigService } from '../../../infrastructure/services/SystemConfigService';

export interface CancelRequestOutput {
  id: string;
  status: string;
}

export class CancelRequestUseCase {
  constructor(private readonly requestRepository: ICollaborationRequestRepository) {}

  async execute(userId: string, requestId: string): Promise<CancelRequestOutput> {
    const request = await this.requestRepository.findById(requestId);

    if (!request) {
      throw new NotFoundError('Collaboration request not found');
    }

    // Only the sender (owner) can cancel
    if (request.fromUserId !== userId) {
      throw new ForbiddenError('You do not have permission to cancel this request');
    }

    if (request.status !== CollaborationRequestStatus.PENDING) {
      throw new ValidationError(`Cannot cancel a request with status: ${request.status}`);
    }

    logger.info('Cancelling collaboration request', { requestId, userId });

    const updatedRequest = await this.requestRepository.update(requestId, {
      status: CollaborationRequestStatus.CANCELLED,
    });

    logger.info('Collaboration request cancelled', { requestId });

    // Refund the requester's points
    try {
      const cost = await systemConfigService.getNumber('collaboration_request_cost', 0);
      if (cost > 0) {
        await walletService.credit(userId, cost, 'Collaboration request cancelled - refund', requestId, 'COLLABORATION_REFUND');
        logger.info('Refunded requester for cancelled collaboration', { userId, cost, requestId });
      }
    } catch (walletError) {
      logger.error('Failed to refund cancelled collaboration request cost', { userId, requestId, error: walletError });
    }

    return {
      id: updatedRequest.id,
      status: updatedRequest.status,
    };
  }
}
