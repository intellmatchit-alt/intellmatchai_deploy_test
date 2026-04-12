/**
 * Create Import Batch Use Case
 *
 * Creates a new import batch with consent recording.
 *
 * @module application/use-cases/import/CreateImportBatchUseCase
 */

import { prisma } from '../../../infrastructure/database/prisma/client.js';
import { logger } from '../../../shared/logger/index.js';

/**
 * Input for creating an import batch
 */
export interface CreateImportBatchInput {
  source: 'PHONE_FULL' | 'PHONE_PICKER' | 'CSV_UPLOAD' | 'VCF_UPLOAD' | 'GOOGLE_SYNC' | 'MANUAL';
  enrichmentEnabled?: boolean;
  aiSummaryEnabled?: boolean;
  phoneEnrichmentEnabled?: boolean;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Result of creating an import batch
 */
export interface CreateImportBatchResult {
  batchId: string;
  status: string;
}

/**
 * Create Import Batch Use Case
 */
export class CreateImportBatchUseCase {
  /**
   * Execute the use case
   */
  async execute(userId: string, input: CreateImportBatchInput): Promise<CreateImportBatchResult> {
    logger.info('Creating import batch', { userId, source: input.source });

    // Create the batch
    const batch = await prisma.contactImportBatch.create({
      data: {
        userId,
        source: input.source,
        status: 'PENDING',
        consentedAt: new Date(),
        enrichmentEnabled: true,
        aiSummaryEnabled: true,
        phoneEnrichmentEnabled: true,
      },
    });

    // Record consent
    await prisma.userImportConsent.create({
      data: {
        userId,
        consentVersion: '1.0',
        enrichmentConsent: true,
        aiSummaryConsent: true,
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
      },
    });

    // Create audit log
    await prisma.importAuditLog.create({
      data: {
        userId,
        batchId: batch.id,
        action: 'CREATE',
        details: {
          source: input.source,
          enrichmentEnabled: input.enrichmentEnabled,
          aiSummaryEnabled: input.aiSummaryEnabled,
          phoneEnrichmentEnabled: input.phoneEnrichmentEnabled,
        },
      },
    });

    logger.info('Import batch created', { batchId: batch.id, userId });

    return {
      batchId: batch.id,
      status: batch.status,
    };
  }
}

export default CreateImportBatchUseCase;
