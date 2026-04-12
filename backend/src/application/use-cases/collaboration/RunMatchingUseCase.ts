/**
 * Use Case: Run Matching
 * Starts the matching process for a collaboration session (BullMQ job)
 */

import {
  ICollaborationRequestRepository,
  ICollaborationSessionRepository,
  ICollaborationMatchResultRepository,
} from '../../../domain/repositories/ICollaborationRepository';
import {
  CollaborationRequestStatus,
  CollaborationSessionStatus,
  CollaborationMatchingJobData,
  getSourceId,
} from '../../../domain/entities/Collaboration';
import { NotFoundError, ForbiddenError, ValidationError } from '../../../shared/errors/index.js';
import { logger } from '../../../shared/logger';
import { QueueService, QueueName } from '../../../infrastructure/queue/QueueService';

export interface RunMatchingOutput {
  session: {
    id: string;
    status: string;
    progress: number;
    totalContacts: number;
    matchCount: number;
    error: string | null;
    startedAt: string | null;
    completedAt: string | null;
  };
  jobId: string | null;
}

export class RunMatchingUseCase {
  constructor(
    private readonly requestRepository: ICollaborationRequestRepository,
    private readonly sessionRepository: ICollaborationSessionRepository,
    private readonly queueService: QueueService,
    private readonly matchResultRepository?: ICollaborationMatchResultRepository
  ) {}

  async execute(userId: string, requestId: string): Promise<RunMatchingOutput> {
    // Get request with details
    const request = await this.requestRepository.findByIdWithDetails(requestId);

    if (!request) {
      throw new NotFoundError('Collaboration request not found');
    }

    // Only the collaborator can run matching
    if (request.toUserId !== userId) {
      throw new ForbiddenError('You do not have permission to run matching for this request');
    }

    if (request.status !== CollaborationRequestStatus.ACCEPTED) {
      throw new ValidationError('Request must be accepted before running matching');
    }

    // Get or check session
    let session = await this.sessionRepository.findByCollaborationRequestId(requestId);

    if (!session) {
      throw new NotFoundError('Collaboration session not found');
    }

    // Check if already running
    if (session.status === CollaborationSessionStatus.RUNNING) {
      return {
        session: {
          id: session.id,
          status: session.status,
          progress: session.progress,
          totalContacts: session.totalContacts,
          matchCount: session.matchCount,
          error: session.error,
          startedAt: session.startedAt?.toISOString() || null,
          completedAt: session.completedAt?.toISOString() || null,
        },
        jobId: session.bullJobId || null,
      };
    }

    // If already completed, allow re-running by clearing only non-introduced results
    if (session.status === CollaborationSessionStatus.DONE) {
      logger.info('Re-running matching for completed session', { sessionId: session.id, requestId });

      let preservedCount = 0;
      if (this.matchResultRepository) {
        // Count introduced results that will be preserved
        preservedCount = await this.matchResultRepository.countIntroducedBySessionId(session.id);
        // Only delete match results that haven't been introduced
        const deletedCount = await this.matchResultRepository.deleteNonIntroducedBySessionId(session.id);
        logger.info('Cleared non-introduced match results', { sessionId: session.id, deletedCount, preservedCount });
      }

      // Reset session to PENDING status, keeping count of preserved results
      session = await this.sessionRepository.update(session.id, {
        status: CollaborationSessionStatus.PENDING,
        progress: 0,
        matchCount: preservedCount,
        totalContacts: 0,
        error: null,
        startedAt: null,
        completedAt: null,
        bullJobId: null,
      });
    }

    logger.info('Starting matching process', { sessionId: session.id, requestId });

    // Update session status to RUNNING
    session = await this.sessionRepository.update(session.id, {
      status: CollaborationSessionStatus.RUNNING,
      startedAt: new Date(),
      progress: 0,
    });

    // Queue the matching job with source feature info instead of missionId
    const sourceId = getSourceId(request);
    const jobData: CollaborationMatchingJobData = {
      sessionId: session.id,
      collaboratorUserId: userId,
      sourceType: request.sourceType,
      sourceId: sourceId,
    };

    const job = await this.queueService.addJob(
      QueueName.COLLABORATION_MATCHING,
      `collab:match:${session.id}`,
      jobData
    );

    // Update session with job ID
    await this.sessionRepository.update(session.id, {
      bullJobId: job.id?.toString(),
    });

    logger.info('Matching job queued', { sessionId: session.id, jobId: job.id });

    return {
      session: {
        id: session.id,
        status: CollaborationSessionStatus.RUNNING,
        progress: session.progress,
        totalContacts: session.totalContacts,
        matchCount: session.matchCount,
        error: session.error,
        startedAt: session.startedAt?.toISOString() || null,
        completedAt: session.completedAt?.toISOString() || null,
      },
      jobId: job.id?.toString() || null,
    };
  }
}
