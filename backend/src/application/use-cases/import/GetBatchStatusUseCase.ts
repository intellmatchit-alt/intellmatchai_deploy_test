/**
 * Get Batch Status Use Case
 *
 * Returns the current status and progress of an import batch.
 *
 * @module application/use-cases/import/GetBatchStatusUseCase
 */

import { prisma } from '../../../infrastructure/database/prisma/client.js';
import { logger } from '../../../shared/logger/index.js';

/**
 * Batch status result
 */
export interface BatchStatusResult {
  batchId: string;
  status: string;
  source: string;
  currentStage: string | null;
  stageProgress: number;
  overallProgress: number;
  stats: {
    totalReceived: number;
    totalImported: number;
    duplicatesMerged: number;
    enrichedCount: number;
    taggedCount: number;
    summarizedCount: number;
    matchedCount: number;
    failedCount: number;
  };
  error: string | null;
  startedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
}

/**
 * Get Batch Status Use Case
 */
export class GetBatchStatusUseCase {
  /**
   * Execute the use case
   */
  async execute(userId: string, batchId: string): Promise<BatchStatusResult | null> {
    logger.debug('Getting batch status', { userId, batchId });

    const batch = await prisma.contactImportBatch.findFirst({
      where: {
        id: batchId,
        userId,
      },
    });

    if (!batch) {
      return null;
    }

    return {
      batchId: batch.id,
      status: batch.status,
      source: batch.source,
      currentStage: batch.currentStage,
      stageProgress: batch.stageProgress,
      overallProgress: batch.overallProgress,
      stats: {
        totalReceived: batch.totalReceived,
        totalImported: batch.totalImported,
        duplicatesMerged: batch.duplicatesMerged,
        enrichedCount: batch.enrichedCount,
        taggedCount: batch.taggedCount,
        summarizedCount: batch.summarizedCount,
        matchedCount: batch.matchedCount,
        failedCount: batch.failedCount,
      },
      error: batch.errorMessage,
      startedAt: batch.startedAt,
      completedAt: batch.completedAt,
      createdAt: batch.createdAt,
    };
  }
}

export default GetBatchStatusUseCase;
