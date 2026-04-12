/**
 * Use Case: Update Match Status
 * Handles user actions on matches (save, ignore, contacted)
 */

import { IPitchMatchRepository, IPitchSectionRepository, IPitchRepository } from '../../../domain/repositories/IPitchRepository';
import { PitchMatchStatus } from '../../../domain/entities/Pitch';
import { UpdateMatchStatusRequestDTO, MatchStatusUpdateResponseDTO } from '../../dto/pitch.dto';
import { NotFoundError, AuthorizationError } from '../../../shared/errors/index.js';
import { logger } from '../../../shared/logger';

export class UpdateMatchStatusUseCase {
  constructor(
    private readonly matchRepository: IPitchMatchRepository,
    private readonly sectionRepository: IPitchSectionRepository,
    private readonly pitchRepository: IPitchRepository,
  ) {}

  async execute(
    userId: string,
    matchId: string,
    input: UpdateMatchStatusRequestDTO,
  ): Promise<MatchStatusUpdateResponseDTO> {
    const { status, outreachEdited } = input;

    // Fetch match
    const match = await this.matchRepository.findById(matchId);
    if (!match) {
      throw new NotFoundError('Match');
    }

    // Verify ownership through section -> pitch -> user
    const section = await this.sectionRepository.findById(match.pitchSectionId);
    if (!section) {
      throw new NotFoundError('Section');
    }

    const pitch = await this.pitchRepository.findById(section.pitchId);
    if (!pitch || pitch.userId !== userId) {
      throw new AuthorizationError('Access denied');
    }

    // Prepare update
    const now = new Date();
    const updateData: {
      status: PitchMatchStatus;
      savedAt?: Date;
      ignoredAt?: Date;
      contactedAt?: Date;
      archivedAt?: Date;
      outreachEdited?: string;
    } = { status };

    switch (status) {
      case PitchMatchStatus.SAVED:
        updateData.savedAt = now;
        break;
      case PitchMatchStatus.IGNORED:
        updateData.ignoredAt = now;
        break;
      case PitchMatchStatus.CONTACTED:
        updateData.contactedAt = now;
        break;
      case PitchMatchStatus.ARCHIVED:
        updateData.archivedAt = now;
        break;
    }

    if (outreachEdited !== undefined) {
      updateData.outreachEdited = outreachEdited;
    }

    // Update match
    const updatedMatch = await this.matchRepository.update(matchId, updateData);

    logger.info('Match status updated', {
      matchId,
      userId,
      status,
      contactId: match.contactId,
    });

    return {
      id: updatedMatch.id,
      status: updatedMatch.status,
      savedAt: updatedMatch.savedAt?.toISOString(),
      ignoredAt: updatedMatch.ignoredAt?.toISOString(),
      contactedAt: updatedMatch.contactedAt?.toISOString(),
    };
  }
}
