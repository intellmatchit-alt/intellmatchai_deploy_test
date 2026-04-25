/**
 * SDAIA PDPL Compliance Service
 *
 * Handles Saudi Personal Data Protection Law (PDPL) compliance:
 * - Processing records for audit trail
 * - Right to Access (data subject)
 * - Right to Deletion (data subject)
 * - Data retention and cleanup
 *
 * @module infrastructure/services/SdaiaComplianceService
 */

import { SdaiaLegalBasis } from '@prisma/client';
import { prisma } from '../database/prisma/client';
import { config } from '../../config/index';
import { logger } from '../../shared/logger/index';

/**
 * SDAIA compliance metadata attached to enrichment results
 */
export interface SdaiaComplianceMetadata {
  legalBasis: string;
  processingPurpose: string;
  consentId?: string;
  consentTimestamp?: string;
  retentionPeriodDays: number;
  scheduledDeletionDate: string;
  processingRecordId: string;
  dataMinimized: boolean;
  crossBorderTransfer: {
    destinationCountry: string;
    transferMechanism: string;
    adequacyDecision: boolean;
  };
}

/**
 * Subject data response (right to access)
 */
export interface SubjectDataResponse {
  contact: {
    id: string;
    fullName: string;
    email?: string | null;
    phone?: string | null;
    company?: string | null;
    enrichmentData?: any;
    enrichedAt?: Date | null;
  };
  processingRecords: {
    id: string;
    processingPurpose: string;
    legalBasis: string;
    dataFieldsProcessed: any;
    providersUsed: any;
    createdAt: Date;
    scheduledDeletionAt: Date;
    status: string;
  }[];
}

/**
 * Input for recording processing
 */
export interface RecordProcessingInput {
  userId: string;
  contactId: string;
  batchId?: string;
  legalBasis: SdaiaLegalBasis;
  consentId?: string;
  purpose: string;
  dataFields: string[];
  providers: string[];
  retentionDays?: number;
}

/**
 * SDAIA PDPL Compliance Service
 */
export class SdaiaComplianceService {
  /**
   * Record a data processing activity
   */
  async recordProcessing(params: RecordProcessingInput): Promise<SdaiaComplianceMetadata> {
    const retentionDays = params.retentionDays || config.sdaia.retentionDays;
    const scheduledDeletionAt = new Date();
    scheduledDeletionAt.setDate(scheduledDeletionAt.getDate() + retentionDays);

    const crossBorderTransfer = {
      destinationCountry: 'US',
      transferMechanism: 'Standard Contractual Clauses',
      adequacyDecision: false,
    };

    const record = await prisma.sdaiaProcessingRecord.create({
      data: {
        userId: params.userId,
        subjectContactId: params.contactId,
        batchId: params.batchId,
        processingPurpose: params.purpose,
        legalBasis: params.legalBasis,
        consentId: params.consentId,
        consentTimestamp: params.consentId ? new Date() : null,
        dataFieldsProcessed: params.dataFields,
        providersUsed: params.providers,
        retentionDays,
        scheduledDeletionAt,
        crossBorderTransfer,
      },
    });

    if (config.sdaia.auditLogging) {
      logger.info('SDAIA processing recorded', {
        recordId: record.id,
        userId: params.userId,
        contactId: params.contactId,
        purpose: params.purpose,
        providers: params.providers,
      });
    }

    return this.buildComplianceMetadata(record);
  }

  /**
   * Right to Access - Get all data for a contact
   */
  async getSubjectData(contactId: string, userId: string): Promise<SubjectDataResponse | null> {
    const contact = await prisma.contact.findFirst({
      where: { id: contactId, ownerId: userId },
      select: {
        id: true,
        fullName: true,
        email: true,
        phone: true,
        company: true,
        enrichmentData: true,
        enrichedAt: true,
      },
    });

    if (!contact) return null;

    const records = await prisma.sdaiaProcessingRecord.findMany({
      where: {
        subjectContactId: contactId,
        userId,
        status: 'ACTIVE',
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        processingPurpose: true,
        legalBasis: true,
        dataFieldsProcessed: true,
        providersUsed: true,
        createdAt: true,
        scheduledDeletionAt: true,
        status: true,
      },
    });

    return {
      contact,
      processingRecords: records,
    };
  }

  /**
   * Right to Deletion - Delete all enrichment data for a contact
   */
  async deleteSubjectData(contactId: string, userId: string): Promise<void> {
    // Mark processing records as deleted
    await prisma.sdaiaProcessingRecord.updateMany({
      where: {
        subjectContactId: contactId,
        userId,
        status: 'ACTIVE',
      },
      data: {
        status: 'DELETED',
        deletedAt: new Date(),
      },
    });

    // Clear contact enrichment data
    await prisma.contact.updateMany({
      where: { id: contactId, ownerId: userId },
      data: {
        enrichmentData: undefined,
        enrichedAt: null,
        isEnriched: false,
      },
    });

    logger.info('SDAIA subject data deleted', { contactId, userId });
  }

  /**
   * List processing records for a user
   */
  async listProcessingRecords(
    userId: string,
    options?: { page?: number; limit?: number }
  ): Promise<{ records: any[]; total: number }> {
    const page = options?.page || 1;
    const limit = options?.limit || 20;
    const skip = (page - 1) * limit;

    const [records, total] = await Promise.all([
      prisma.sdaiaProcessingRecord.findMany({
        where: { userId, status: 'ACTIVE' },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          subjectContact: {
            select: { id: true, fullName: true },
          },
        },
      }),
      prisma.sdaiaProcessingRecord.count({
        where: { userId, status: 'ACTIVE' },
      }),
    ]);

    return { records, total };
  }

  /**
   * Cleanup expired processing records
   */
  async cleanupExpiredRecords(): Promise<number> {
    const result = await prisma.sdaiaProcessingRecord.updateMany({
      where: {
        status: 'ACTIVE',
        scheduledDeletionAt: { lte: new Date() },
      },
      data: {
        status: 'EXPIRED',
        deletedAt: new Date(),
      },
    });

    if (result.count > 0) {
      logger.info('SDAIA expired records cleaned up', { count: result.count });
    }

    return result.count;
  }

  /**
   * Build compliance metadata from a processing record
   */
  buildComplianceMetadata(record: any): SdaiaComplianceMetadata {
    return {
      legalBasis: record.legalBasis,
      processingPurpose: record.processingPurpose,
      consentId: record.consentId || undefined,
      consentTimestamp: record.consentTimestamp?.toISOString(),
      retentionPeriodDays: record.retentionDays,
      scheduledDeletionDate: record.scheduledDeletionAt.toISOString(),
      processingRecordId: record.id,
      dataMinimized: true,
      crossBorderTransfer: record.crossBorderTransfer || {
        destinationCountry: 'US',
        transferMechanism: 'Standard Contractual Clauses',
        adequacyDecision: false,
      },
    };
  }
}

// Singleton instance
let sdaiaComplianceService: SdaiaComplianceService | null = null;

export function getSdaiaComplianceService(): SdaiaComplianceService {
  if (!sdaiaComplianceService) {
    sdaiaComplianceService = new SdaiaComplianceService();
  }
  return sdaiaComplianceService;
}
