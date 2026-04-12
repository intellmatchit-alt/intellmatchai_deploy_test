/**
 * Commit Batch Use Case
 *
 * Commits an import batch and starts the processing pipeline.
 *
 * @module application/use-cases/import/CommitBatchUseCase
 */

import { prisma } from '../../../infrastructure/database/prisma/client.js';
import { queueService } from '../../../infrastructure/queue/QueueService.js';
import { logger } from '../../../shared/logger/index.js';

/**
 * Result of committing a batch
 */
export interface CommitBatchResult {
  batchId: string;
  status: string;
  jobId: string | null;
  totalContacts: number;
}

/**
 * Commit Batch Use Case
 */
export class CommitBatchUseCase {
  /**
   * Execute the use case
   */
  async execute(userId: string, batchId: string): Promise<CommitBatchResult> {
    logger.info('Committing import batch', { userId, batchId });

    // Verify batch exists and belongs to user
    const batch = await prisma.contactImportBatch.findFirst({
      where: {
        id: batchId,
        userId,
        status: { in: ['PENDING', 'UPLOADING'] },
      },
    });

    if (!batch) {
      throw new Error('Import batch not found or not in valid state');
    }

    if (batch.totalReceived === 0) {
      throw new Error('Cannot commit batch with no contacts');
    }

    // Update batch status
    await prisma.contactImportBatch.update({
      where: { id: batchId },
      data: {
        status: 'PROCESSING',
        startedAt: new Date(),
        currentStage: 'normalize',
        stageProgress: 0,
        overallProgress: 0,
      },
    });

    // Create audit log
    await prisma.importAuditLog.create({
      data: {
        userId,
        batchId,
        action: 'COMMIT',
        details: {
          totalContacts: batch.totalReceived,
        },
      },
    });

    // Queue the first stage (normalize)
    const job = await queueService.addImportJob({
      batchId,
      userId,
      stage: 'normalize',
    });

    const jobId = job?.id?.toString() || null;

    // Update with job ID
    if (jobId) {
      await prisma.contactImportBatch.update({
        where: { id: batchId },
        data: { currentJobId: jobId },
      });
    }

    logger.info('Import batch committed', {
      batchId,
      userId,
      totalContacts: batch.totalReceived,
      jobId,
    });

    return {
      batchId,
      status: 'PROCESSING',
      jobId,
      totalContacts: batch.totalReceived,
    };
  }
}

export default CommitBatchUseCase;
