/**
 * List Batches Use Case
 *
 * Lists all import batches for a user.
 *
 * @module application/use-cases/import/ListBatchesUseCase
 */

import { prisma } from '../../../infrastructure/database/prisma/client.js';
import { logger } from '../../../shared/logger/index.js';

/**
 * Batch summary for listing
 */
export interface BatchSummary {
  id: string;
  source: string;
  status: string;
  totalReceived: number;
  totalImported: number;
  duplicatesMerged: number;
  overallProgress: number;
  createdAt: Date;
  completedAt: Date | null;
}

/**
 * Input for listing batches
 */
export interface ListBatchesInput {
  page?: number;
  limit?: number;
  status?: string;
}

/**
 * Result of listing batches
 */
export interface ListBatchesResult {
  batches: BatchSummary[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * List Batches Use Case
 */
export class ListBatchesUseCase {
  /**
   * Execute the use case
   */
  async execute(userId: string, input: ListBatchesInput = {}): Promise<ListBatchesResult> {
    const page = input.page || 1;
    const limit = input.limit || 20;
    const skip = (page - 1) * limit;

    logger.debug('Listing import batches', { userId, page, limit, status: input.status });

    // Build where clause
    const where: any = { userId };
    if (input.status) {
      where.status = input.status;
    }

    // Get total count
    const total = await prisma.contactImportBatch.count({ where });

    // Get batches
    const batches = await prisma.contactImportBatch.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      select: {
        id: true,
        source: true,
        status: true,
        totalReceived: true,
        totalImported: true,
        duplicatesMerged: true,
        overallProgress: true,
        createdAt: true,
        completedAt: true,
      },
    });

    return {
      batches,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }
}

export default ListBatchesUseCase;
