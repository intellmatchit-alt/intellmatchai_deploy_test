/**
 * Use Case: Get Match Results
 * Gets the match results for a collaboration session (COLLABORATOR ONLY)
 */

import {
  ICollaborationSessionRepository,
  ICollaborationMatchResultRepository,
} from '../../../domain/repositories/ICollaborationRepository';
import { CollaborationMatchReason } from '../../../domain/entities/Collaboration';
import { NotFoundError, ForbiddenError } from '../../../shared/errors/index';

export interface GetMatchResultsInput {
  minScore?: number;
  isIntroduced?: boolean;
  isDismissed?: boolean;
  limit?: number;
  offset?: number;
}

export interface MatchResultItem {
  id: string;
  contactId: string;
  score: number;
  reasonsJson: CollaborationMatchReason[];
  isIntroduced: boolean;
  isDismissed: boolean;
  contact: {
    id: string;
    fullName: string;
    company: string | null;
    jobTitle: string | null;
    avatarUrl: string | null;
  };
}

export interface GetMatchResultsOutput {
  sessionId: string;
  status: string;
  matchCount: number;
  results: MatchResultItem[];
}

export class GetMatchResultsUseCase {
  constructor(
    private readonly sessionRepository: ICollaborationSessionRepository,
    private readonly matchResultRepository: ICollaborationMatchResultRepository
  ) {}

  async execute(
    userId: string,
    sessionId: string,
    input: GetMatchResultsInput
  ): Promise<GetMatchResultsOutput> {
    const session = await this.sessionRepository.findById(sessionId);

    if (!session) {
      throw new NotFoundError('Collaboration session not found');
    }

    // PRIVACY: Only the collaborator can view match results (never the owner)
    if (session.collaboratorUserId !== userId) {
      throw new ForbiddenError('You do not have permission to view these match results');
    }

    const results = await this.matchResultRepository.findBySessionId({
      sessionId,
      minScore: input.minScore,
      isIntroduced: input.isIntroduced,
      isDismissed: input.isDismissed,
      limit: input.limit || 50,
      offset: input.offset || 0,
    });

    return {
      sessionId: session.id,
      status: session.status,
      matchCount: session.matchCount,
      results: results.map((r) => ({
        id: r.id,
        contactId: r.contactId,
        score: r.score,
        reasonsJson: r.reasonsJson,
        isIntroduced: r.isIntroduced,
        isDismissed: r.isDismissed,
        contact: r.contact,
      })),
    };
  }
}
