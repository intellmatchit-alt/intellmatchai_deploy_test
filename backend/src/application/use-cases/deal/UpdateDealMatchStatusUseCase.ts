/**
 * Use Case: Update Deal Match Status
 * Handles user actions on matches (save, ignore, contacted)
 */

import { IDealRequestRepository, IDealMatchResultRepository } from '../../../domain/repositories/IDealRepository';
import { DealMatchStatus } from '../../../domain/entities/Deal';
import { NotFoundError, AuthorizationError } from '../../../shared/errors/index';
import { logger } from '../../../shared/logger';

export interface UpdateMatchStatusInput {
  status: DealMatchStatus;
  openerEdited?: string;
}

export interface UpdateMatchStatusOutput {
  id: string;
  status: DealMatchStatus;
  savedAt: string | null;
  ignoredAt: string | null;
  contactedAt: string | null;
}

export class UpdateDealMatchStatusUseCase {
  constructor(
    private readonly matchRepository: IDealMatchResultRepository,
    private readonly dealRepository: IDealRequestRepository,
  ) {}

  async execute(
    userId: string,
    matchId: string,
    input: UpdateMatchStatusInput
  ): Promise<UpdateMatchStatusOutput> {
    const { status, openerEdited } = input;

    // Fetch match
    const match = await this.matchRepository.findById(matchId);
    if (!match) {
      throw new NotFoundError('Match');
    }

    // Verify ownership through deal -> user
    const deal = await this.dealRepository.findById(match.dealRequestId);
    if (!deal || deal.userId !== userId) {
      throw new AuthorizationError('Access denied');
    }

    // Prepare update
    const now = new Date();
    const updateData: {
      status: DealMatchStatus;
      savedAt?: Date;
      ignoredAt?: Date;
      contactedAt?: Date;
      archivedAt?: Date;
      openerEdited?: string;
    } = { status };

    switch (status) {
      case DealMatchStatus.SAVED:
        updateData.savedAt = now;
        break;
      case DealMatchStatus.IGNORED:
        updateData.ignoredAt = now;
        break;
      case DealMatchStatus.CONTACTED:
        updateData.contactedAt = now;
        break;
      case DealMatchStatus.ARCHIVED:
        updateData.archivedAt = now;
        break;
    }

    if (openerEdited !== undefined) {
      updateData.openerEdited = openerEdited;
    }

    // Update match
    const updatedMatch = await this.matchRepository.update(matchId, updateData);

    logger.info('Deal match status updated', {
      matchId,
      userId,
      status,
      dealId: match.dealRequestId,
    });

    return {
      id: updatedMatch.id,
      status: updatedMatch.status,
      savedAt: updatedMatch.savedAt?.toISOString() || null,
      ignoredAt: updatedMatch.ignoredAt?.toISOString() || null,
      contactedAt: updatedMatch.contactedAt?.toISOString() || null,
    };
  }
}
