/**
 * Phone Enrichment Pipeline (Bulk Import)
 *
 * Uses CallerKit as the sole source of truth for phone-based enrichment.
 * Phone number is the unique identifier → CallerKit returns the real name,
 * location, and carrier info.
 *
 * Pipeline per contact:
 * 1. CallerKit: phone → real name, location, carrier
 * 2. SDAIA: record processing for compliance
 * 3. Update contact in DB
 *
 * Note: SerpAPI/ScrapIn LinkedIn search by name is NOT used because
 * contact names can be incorrect and name-based search returns wrong profiles.
 *
 * @module infrastructure/services/import/PhoneEnrichmentPipeline
 */

import { SdaiaLegalBasis } from '@prisma/client';
import { prisma } from '../../database/prisma/client.js';
import { config } from '../../../config/index.js';
import { logger } from '../../../shared/logger/index.js';
import { CallerKitService, CallerKitResult } from '../../external/enrichment/CallerKitService.js';
import { getSdaiaComplianceService, SdaiaComplianceMetadata } from '../SdaiaComplianceService.js';

/**
 * Result of enriching a single contact
 */
export interface PhoneEnrichmentResult {
  success: boolean;
  contactId: string;
  fieldsUpdated: string[];
  providers: string[];
  callerKitData?: CallerKitResult['data'];
  linkedInUrl?: string;
  sdaiaCompliance?: SdaiaComplianceMetadata;
  processingTimeMs: number;
  error?: string;
}

/**
 * Result of enriching a batch of contacts
 */
export interface BatchEnrichmentResult {
  totalProcessed: number;
  enrichedCount: number;
  failedCount: number;
  results: PhoneEnrichmentResult[];
  totalTimeMs: number;
}

/**
 * Phone Enrichment Pipeline
 */
export class PhoneEnrichmentPipeline {
  private callerKit: CallerKitService;

  constructor() {
    this.callerKit = new CallerKitService();
  }

  /**
   * Enrich a single contact through the full pipeline
   */
  async enrichContact(
    contact: {
      id: string;
      phone?: string | null;
      fullName?: string | null;
      company?: string | null;
      jobTitle?: string | null;
      linkedinUrl?: string | null;
    },
    options: {
      userId: string;
      batchId: string;
      consentId: string;
      legalBasis: SdaiaLegalBasis;
    }
  ): Promise<PhoneEnrichmentResult> {
    const startTime = Date.now();
    const fieldsUpdated: string[] = [];
    const providers: string[] = [];
    let callerKitData: CallerKitResult['data'] | undefined;

    try {
      // Step 1: CallerKit phone lookup (sole source of truth)
      if (contact.phone && await this.callerKit.isAvailable()) {
        logger.debug('PhoneEnrichmentPipeline: CallerKit lookup', { contactId: contact.id, phone: contact.phone });
        const ckResult = await this.callerKit.lookupPhone(contact.phone);

        if (ckResult.success && ckResult.data) {
          callerKitData = ckResult.data;
          providers.push('callerkit');

          const updates: Record<string, any> = {};

          // CallerKit name is the REAL name from the phone number
          // Always update fullName from CallerKit (it's the trusted source)
          if (ckResult.data.name) {
            updates.fullName = ckResult.data.name;
            fieldsUpdated.push('fullName');
          }

          // Update location from CallerKit
          if (ckResult.data.location) {
            const locationParts = [
              ckResult.data.location.city,
              ckResult.data.location.region,
              ckResult.data.location.countryCode,
            ].filter(Boolean);
            if (locationParts.length > 0) {
              updates.location = locationParts.join(', ');
              fieldsUpdated.push('location');
            }
          }

          // Store enrichment data
          updates.enrichmentData = {
            _pipelineSource: 'phone_enrichment',
            callerKit: callerKitData,
            providers,
            enrichedAt: new Date().toISOString(),
          };
          updates.enrichedAt = new Date();
          updates.isEnriched = true;
          updates.dataConfidence = 'MEDIUM';

          await prisma.contact.update({
            where: { id: contact.id },
            data: updates,
          });
          fieldsUpdated.push('enrichmentData');
        }
      }

      // Step 2: SDAIA compliance record
      let sdaiaCompliance: SdaiaComplianceMetadata | undefined;
      if (providers.length > 0) {
        const sdaiaService = getSdaiaComplianceService();
        sdaiaCompliance = await sdaiaService.recordProcessing({
          userId: options.userId,
          contactId: contact.id,
          batchId: options.batchId,
          legalBasis: options.legalBasis,
          consentId: options.consentId,
          purpose: 'Bulk import phone enrichment - CallerKit phone lookup',
          dataFields: fieldsUpdated,
          providers,
        });
      }

      return {
        success: true,
        contactId: contact.id,
        fieldsUpdated,
        providers,
        callerKitData,
        sdaiaCompliance,
        processingTimeMs: Date.now() - startTime,
      };
    } catch (error) {
      logger.error('PhoneEnrichmentPipeline: enrichContact failed', {
        contactId: contact.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      return {
        success: false,
        contactId: contact.id,
        fieldsUpdated,
        providers,
        processingTimeMs: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Enrich a batch of contacts
   */
  async enrichBatch(
    contactIds: string[],
    options: {
      userId: string;
      batchId: string;
      consentId: string;
      delayMs?: number;
      onProgress?: (processed: number, total: number) => void;
    }
  ): Promise<BatchEnrichmentResult> {
    const startTime = Date.now();
    const delayMs = options.delayMs ?? 1000;
    const results: PhoneEnrichmentResult[] = [];
    let enrichedCount = 0;
    let failedCount = 0;

    for (let i = 0; i < contactIds.length; i++) {
      const contactId = contactIds[i];

      // Fetch contact data
      const contact = await prisma.contact.findUnique({
        where: { id: contactId },
        select: {
          id: true,
          phone: true,
          fullName: true,
          company: true,
          jobTitle: true,
          linkedinUrl: true,
        },
      });

      if (!contact) {
        failedCount++;
        continue;
      }

      // Skip contacts without phone
      if (!contact.phone) {
        results.push({
          success: false,
          contactId,
          fieldsUpdated: [],
          providers: [],
          processingTimeMs: 0,
          error: 'No phone number',
        });
        continue;
      }

      const result = await this.enrichContact(contact, {
        userId: options.userId,
        batchId: options.batchId,
        consentId: options.consentId,
        legalBasis: 'CONSENT',
      });

      results.push(result);
      if (result.success && result.fieldsUpdated.length > 0) {
        enrichedCount++;
      } else if (!result.success) {
        failedCount++;
      }

      // Progress callback
      if (options.onProgress) {
        options.onProgress(i + 1, contactIds.length);
      }

      // Rate limit delay
      if (i < contactIds.length - 1) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }

    return {
      totalProcessed: contactIds.length,
      enrichedCount,
      failedCount,
      results,
      totalTimeMs: Date.now() - startTime,
    };
  }

}

// Singleton
let phoneEnrichmentPipeline: PhoneEnrichmentPipeline | null = null;

export function getPhoneEnrichmentPipeline(): PhoneEnrichmentPipeline {
  if (!phoneEnrichmentPipeline) {
    phoneEnrichmentPipeline = new PhoneEnrichmentPipeline();
  }
  return phoneEnrichmentPipeline;
}
