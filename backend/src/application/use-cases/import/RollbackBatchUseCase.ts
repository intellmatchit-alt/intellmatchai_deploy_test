/**
 * Rollback Batch Use Case
 *
 * Rolls back an import batch by deleting all contacts imported in that batch.
 *
 * @module application/use-cases/import/RollbackBatchUseCase
 */

import { prisma } from '../../../infrastructure/database/prisma/client';
import { logger } from '../../../shared/logger/index';

/**
 * Result of rolling back a batch
 */
export interface RollbackBatchResult {
  batchId: string;
  deletedCount: number;
  status: string;
}

/**
 * Rollback Batch Use Case
 */
export class RollbackBatchUseCase {
  /**
   * Execute the use case
   */
  async execute(userId: string, batchId: string): Promise<RollbackBatchResult> {
    logger.info('Rolling back import batch', { userId, batchId });

    // Verify batch exists and belongs to user
    const batch = await prisma.contactImportBatch.findFirst({
      where: {
        id: batchId,
        userId,
      },
    });

    if (!batch) {
      throw new Error('Import batch not found');
    }

    // Count contacts to be deleted
    const contactCount = await prisma.contact.count({
      where: { importBatchId: batchId },
    });

    // Delete all contacts from this batch
    // Cascade will handle related records (sectors, skills, etc.)
    const deleteResult = await prisma.contact.deleteMany({
      where: { importBatchId: batchId },
    });

    // Update batch status
    await prisma.contactImportBatch.update({
      where: { id: batchId },
      data: {
        status: 'ROLLED_BACK',
        completedAt: new Date(),
        errorMessage: `Rolled back: ${deleteResult.count} contacts deleted`,
      },
    });

    // Create audit log
    await prisma.importAuditLog.create({
      data: {
        userId,
        batchId,
        action: 'ROLLBACK',
        details: {
          deletedCount: deleteResult.count,
        },
      },
    });

    logger.info('Import batch rolled back', {
      batchId,
      userId,
      deletedCount: deleteResult.count,
    });

    return {
      batchId,
      deletedCount: deleteResult.count,
      status: 'ROLLED_BACK',
    };
  }
}

export default RollbackBatchUseCase;
