/**
 * Matching Service Factory
 *
 * Creates the appropriate matching service based on configuration.
 * Uses Hybrid (Deterministic + Recombee) when available,
 * falls back to deterministic matching.
 *
 * @module infrastructure/external/matching/MatchingServiceFactory
 */

import { IMatchingService } from '../../../domain/services/IMatchingService';
import { DeterministicMatchingService } from './DeterministicMatchingService';
import { HybridMatchingService, hybridMatchingService } from './HybridMatchingService';
import { logger } from '../../../shared/logger';
import { config } from '../../../config';

/**
 * Matching service type
 */
export type MatchingServiceType = 'recombee' | 'hybrid' | 'deterministic' | 'auto';

/**
 * Matching Service Factory
 *
 * Creates matching service instances based on configuration.
 * Supports deterministic, hybrid (deterministic + Recombee), and auto modes.
 */
export class MatchingServiceFactory {
  private static deterministicInstance: DeterministicMatchingService | null = null;
  private static hybridInstance: HybridMatchingService | null = null;

  /**
   * Create a matching service instance
   */
  static create(type: MatchingServiceType = 'auto'): IMatchingService {
    switch (type) {
      case 'recombee':
      case 'hybrid':
        // Use hybrid service (deterministic + Recombee)
        return this.getHybridService();

      case 'deterministic':
        return this.getDeterministicService();

      case 'auto':
      default:
        return this.getBestAvailable();
    }
  }

  private static getDeterministicService(): DeterministicMatchingService {
    if (!this.deterministicInstance) {
      this.deterministicInstance = new DeterministicMatchingService();
      logger.info('Created deterministic matching service instance');
    }
    return this.deterministicInstance;
  }

  private static getHybridService(): HybridMatchingService {
    if (!this.hybridInstance) {
      this.hybridInstance = hybridMatchingService;
      logger.info('Created hybrid matching service instance');
    }
    return this.hybridInstance;
  }

  private static getBestAvailable(): IMatchingService {
    const useRecombee = config.features.recombee;
    const recombeeConfigured =
      config.ai.recombee.databaseId && config.ai.recombee.secretToken;

    if (useRecombee && recombeeConfigured) {
      logger.info('Using hybrid matching service (deterministic + Recombee)');
      return this.getHybridService();
    }

    logger.info('Using deterministic matching service (local)');
    return this.getDeterministicService();
  }

  static async checkAvailability(): Promise<{
    deterministic: boolean;
    hybrid: boolean;
    recombee: boolean;
    recommended: MatchingServiceType;
  }> {
    const deterministic = true; // Always available
    const hybrid = config.features.recombee &&
      !!(config.ai.recombee.databaseId && config.ai.recombee.secretToken);
    const recombee = hybrid && hybridMatchingService.isRecombeeEnabled();

    return {
      deterministic,
      hybrid,
      recombee,
      recommended: recombee ? 'hybrid' : 'deterministic',
    };
  }
}

/**
 * Get default matching service instance
 *
 * NOTE: Currently forced to 'deterministic' only.
 * Recombee hybrid matching is disabled to avoid score penalties
 * when Recombee has no data for contacts.
 */
export function getMatchingService(): IMatchingService {
  return MatchingServiceFactory.create('deterministic');
}
