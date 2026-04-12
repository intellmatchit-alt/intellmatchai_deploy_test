/**
 * Enrichment Service Factory
 *
 * Creates the appropriate enrichment service based on configuration.
 * Uses PDL when available, falls back to manual-only mode.
 *
 * @module infrastructure/external/enrichment/EnrichmentServiceFactory
 */

import {
  IEnrichmentService,
  EnrichmentInput,
  EnrichmentResult,
  EnrichedCompanyData,
} from '../../../domain/services/IEnrichmentService';
import { PDLEnrichmentService } from './PDLEnrichmentService';
import { logger } from '../../../shared/logger';
import { config } from '../../../config';

/**
 * Enrichment service type
 */
export type EnrichmentServiceType = 'pdl' | 'manual' | 'auto';

/**
 * Manual Enrichment Service (No-op)
 *
 * Placeholder when no enrichment provider is configured.
 * Returns empty results, allowing manual data entry only.
 */
class ManualEnrichmentService implements IEnrichmentService {
  async isAvailable(): Promise<boolean> {
    return true;
  }

  async getRemainingCredits(): Promise<number | null> {
    return null;
  }

  async enrichPerson(input: EnrichmentInput): Promise<EnrichmentResult> {
    return {
      success: false,
      error: 'No enrichment service configured. Please enter data manually.',
      source: 'manual',
      processingTimeMs: 0,
    };
  }

  async enrichCompany(): Promise<{
    success: boolean;
    data?: EnrichedCompanyData;
    error?: string;
  }> {
    return {
      success: false,
      error: 'No enrichment service configured. Please enter data manually.',
    };
  }
}

/**
 * Enrichment Service Factory
 *
 * Creates enrichment service instances based on configuration.
 */
export class EnrichmentServiceFactory {
  private static pdlInstance: PDLEnrichmentService | null = null;
  private static manualInstance: ManualEnrichmentService | null = null;

  /**
   * Create an enrichment service instance
   */
  static create(type: EnrichmentServiceType = 'auto'): IEnrichmentService {
    switch (type) {
      case 'pdl':
        return this.getPDLService();

      case 'manual':
        return this.getManualService();

      case 'auto':
      default:
        return this.getBestAvailable();
    }
  }

  private static getPDLService(): PDLEnrichmentService {
    if (!this.pdlInstance) {
      this.pdlInstance = new PDLEnrichmentService();
      logger.info('Created PDL enrichment service instance');
    }
    return this.pdlInstance;
  }

  private static getManualService(): ManualEnrichmentService {
    if (!this.manualInstance) {
      this.manualInstance = new ManualEnrichmentService();
      logger.info('Created manual enrichment service instance');
    }
    return this.manualInstance;
  }

  private static getBestAvailable(): IEnrichmentService {
    const usePDL = config.features.pdlEnrichment;
    const pdlConfigured = !!config.ai.pdl.apiKey;

    if (usePDL && pdlConfigured) {
      logger.info('Using PDL enrichment service (cloud)');
      return this.getPDLService();
    }

    logger.info('Using manual enrichment service (no cloud provider)');
    return this.getManualService();
  }

  static async checkAvailability(): Promise<{
    pdl: boolean;
    manual: boolean;
    recommended: EnrichmentServiceType;
  }> {
    const pdl = await this.getPDLService().isAvailable();
    const manual = await this.getManualService().isAvailable();

    return {
      pdl,
      manual,
      recommended: pdl ? 'pdl' : 'manual',
    };
  }
}

/**
 * Get default enrichment service instance
 */
export function getEnrichmentService(): IEnrichmentService {
  return EnrichmentServiceFactory.create('auto');
}
