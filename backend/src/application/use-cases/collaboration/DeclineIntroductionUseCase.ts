/**
 * Use Case: Decline Introduction
 * Collaborator declines to proceed with an introduction
 */

import { IIntroductionRepository } from '../../../domain/repositories/ICollaborationRepository';
import { IntroductionStatus } from '../../../domain/entities/Collaboration';
import { NotFoundError, ForbiddenError, ValidationError } from '../../../shared/errors/index';
import { logger } from '../../../shared/logger';

export interface DeclineIntroductionOutput {
  id: string;
  status: string;
}

export class DeclineIntroductionUseCase {
  constructor(private readonly introductionRepository: IIntroductionRepository) {}

  async execute(userId: string, introductionId: string): Promise<DeclineIntroductionOutput> {
    const introduction = await this.introductionRepository.findById(introductionId);

    if (!introduction) {
      throw new NotFoundError('Introduction not found');
    }

    // Only the collaborator can decline
    if (introduction.collaboratorUserId !== userId) {
      throw new ForbiddenError('Only the collaborator can decline introductions');
    }

    if (introduction.status !== IntroductionStatus.PENDING) {
      throw new ValidationError(`Cannot decline introduction with status: ${introduction.status}`);
    }

    logger.info('Declining introduction', { introductionId, userId });

    const updated = await this.introductionRepository.update(introductionId, {
      status: IntroductionStatus.DECLINED,
    });

    logger.info('Introduction declined', { introductionId });

    return {
      id: updated.id,
      status: updated.status,
    };
  }
}
