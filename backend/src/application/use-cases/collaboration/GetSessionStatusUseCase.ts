/**
 * Use Case: Get Session Status
 * Gets the current status of a collaboration matching session
 */

import {
  ICollaborationRequestRepository,
  ICollaborationSessionRepository,
} from '../../../domain/repositories/ICollaborationRepository';
import { CollaborationSessionStatus } from '../../../domain/entities/Collaboration';
import { NotFoundError, ForbiddenError } from '../../../shared/errors/index.js';

export interface GetSessionStatusOutput {
  id: string;
  status: string;
  progress: number;
  totalContacts: number;
  matchCount: number;
  error: string | null;
  startedAt: string | null;
  completedAt: string | null;
}

export class GetSessionStatusUseCase {
  constructor(
    private readonly requestRepository: ICollaborationRequestRepository,
    private readonly sessionRepository: ICollaborationSessionRepository
  ) {}

  async execute(userId: string, sessionId: string): Promise<GetSessionStatusOutput> {
    const session = await this.sessionRepository.findById(sessionId);

    if (!session) {
      throw new NotFoundError('Collaboration session not found');
    }

    // Only the collaborator can view session status
    if (session.collaboratorUserId !== userId) {
      throw new ForbiddenError('You do not have permission to view this session');
    }

    return {
      id: session.id,
      status: session.status,
      progress: session.progress,
      totalContacts: session.totalContacts,
      matchCount: session.matchCount,
      error: session.error,
      startedAt: session.startedAt?.toISOString() || null,
      completedAt: session.completedAt?.toISOString() || null,
    };
  }
}
