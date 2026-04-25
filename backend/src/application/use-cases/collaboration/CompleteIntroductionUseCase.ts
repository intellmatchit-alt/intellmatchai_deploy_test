/**
 * Use Case: Complete Introduction
 * Marks an introduction as completed and updates the ledger
 */

import {
  ICollaborationRequestRepository,
  IIntroductionRepository,
  ICollaborationLedgerRepository,
} from '../../../domain/repositories/ICollaborationRepository';
import { IntroductionStatus, getSourceId } from '../../../domain/entities/Collaboration';
import { NotFoundError, ForbiddenError, ValidationError } from '../../../shared/errors/index';
import { logger } from '../../../shared/logger';

export interface CompleteIntroductionOutput {
  id: string;
  status: string;
  completedAt: string;
}

export class CompleteIntroductionUseCase {
  constructor(
    private readonly requestRepository: ICollaborationRequestRepository,
    private readonly introductionRepository: IIntroductionRepository,
    private readonly ledgerRepository: ICollaborationLedgerRepository
  ) {}

  async execute(userId: string, introductionId: string): Promise<CompleteIntroductionOutput> {
    const introduction = await this.introductionRepository.findById(introductionId);

    if (!introduction) {
      throw new NotFoundError('Introduction not found');
    }

    // Only the collaborator can complete
    if (introduction.collaboratorUserId !== userId) {
      throw new ForbiddenError('Only the collaborator can complete introductions');
    }

    if (introduction.status !== IntroductionStatus.PENDING && introduction.status !== IntroductionStatus.ACCEPTED) {
      throw new ValidationError(`Cannot complete introduction with status: ${introduction.status}`);
    }

    // Get request to update ledger
    const request = await this.requestRepository.findById(introduction.collaborationRequestId);
    if (!request) {
      throw new NotFoundError('Associated request not found');
    }

    logger.info('Completing introduction', { introductionId, userId });

    // Update introduction
    const updated = await this.introductionRepository.update(introductionId, {
      status: IntroductionStatus.COMPLETED,
      completedAt: new Date(),
    });

    // Update ledger (increment count) using sourceType and sourceId
    const sourceId = getSourceId(request);
    await this.ledgerRepository.incrementIntroductionsCount(
      request.fromUserId,
      request.toUserId,
      request.sourceType,
      sourceId
    );

    logger.info('Introduction completed, ledger updated', { introductionId });

    return {
      id: updated.id,
      status: updated.status,
      completedAt: updated.completedAt!.toISOString(),
    };
  }
}
