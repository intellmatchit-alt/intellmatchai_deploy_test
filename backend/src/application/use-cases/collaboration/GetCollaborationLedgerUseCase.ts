/**
 * Use Case: Get Collaboration Ledger
 * Gets user's collaboration history with other users
 */

import { ICollaborationLedgerRepository } from '../../../domain/repositories/ICollaborationRepository';
import { CollaborationLedgerSummary, CollaborationSourceType } from '../../../domain/entities/Collaboration';

export interface GetCollaborationLedgerOutput {
  totalCollaborators: number;
  totalIntroductions: number;
  collaborators: CollaborationLedgerSummary[];
}

export interface GetLedgerWithUserOutput {
  userId: string;
  entries: {
    id: string;
    sourceType: CollaborationSourceType;
    sourceId: string;
    introductionsCount: number;
    lastIntroductionAt: string | null;
    createdAt: string;
  }[];
}

export class GetCollaborationLedgerUseCase {
  constructor(private readonly ledgerRepository: ICollaborationLedgerRepository) {}

  async execute(userId: string): Promise<GetCollaborationLedgerOutput> {
    const [collaborators, totalCollaborations, totalIntroductions] = await Promise.all([
      this.ledgerRepository.getCollaboratorSummaries(userId),
      this.ledgerRepository.countTotalCollaborations(userId),
      this.ledgerRepository.countTotalIntroductions(userId),
    ]);

    return {
      totalCollaborators: collaborators.length,
      totalIntroductions,
      collaborators: collaborators.map((c) => ({
        ...c,
        lastCollaborationAt: c.lastCollaborationAt,
      })),
    };
  }

  async getWithUser(userId: string, otherUserId: string): Promise<GetLedgerWithUserOutput> {
    const entries = await this.ledgerRepository.getHistoryWithUser(userId, otherUserId);

    return {
      userId: otherUserId,
      entries: entries.map((e) => ({
        id: e.id,
        sourceType: e.sourceType,
        sourceId: e.sourceId,
        introductionsCount: e.introductionsCount,
        lastIntroductionAt: e.lastIntroductionAt?.toISOString() || null,
        createdAt: e.createdAt.toISOString(),
      })),
    };
  }
}
