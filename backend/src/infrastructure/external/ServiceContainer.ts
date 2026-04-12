/**
 * Service Container
 *
 * Central dependency injection container for all external services.
 * Provides singleton access to configured service instances.
 *
 * @module infrastructure/external/ServiceContainer
 */

import { IOCRService } from '../../domain/services/IOCRService';
import { IMatchingService } from '../../domain/services/IMatchingService';
import { IEnrichmentService } from '../../domain/services/IEnrichmentService';
import { IRecommendationService } from '../../domain/services/IRecommendationService';
import { IRerankService } from '../../domain/services/IRerankService';
import { OCRServiceFactory, getOCRService } from './ocr';
import { MatchingServiceFactory, getMatchingService } from './matching';
import {
  ExplanationServiceFactory,
  IExplanationService,
  getExplanationService,
} from './explanation';
import { EnrichmentServiceFactory, getEnrichmentService } from './enrichment';
import { RecommendationServiceFactory, getRecommendationService } from './recommendation';
import { RerankServiceFactory, getRerankService } from './rerank';
import { logger } from '../../shared/logger';

/**
 * Service availability status
 */
export interface ServiceStatus {
  ocr: {
    tesseract: boolean;
    azure: boolean;
    active: 'tesseract' | 'azure';
  };
  matching: {
    deterministic: boolean;
    recombee: boolean;
    active: 'deterministic' | 'recombee';
  };
  explanation: {
    template: boolean;
    openai: boolean;
    active: 'template' | 'openai';
  };
  enrichment: {
    pdl: boolean;
    manual: boolean;
    active: 'pdl' | 'manual';
  };
  recommendation: {
    recombee: boolean;
    local: boolean;
    active: 'recombee' | 'local';
  };
  rerank: {
    cohere: boolean;
    simple: boolean;
    active: 'cohere' | 'simple';
  };
}

/**
 * Service Container
 *
 * Provides centralized access to all external services.
 */
export class ServiceContainer {
  private static instance: ServiceContainer | null = null;

  private ocrService: IOCRService | null = null;
  private matchingService: IMatchingService | null = null;
  private explanationService: IExplanationService | null = null;
  private enrichmentService: IEnrichmentService | null = null;
  private recommendationService: IRecommendationService | null = null;
  private rerankService: IRerankService | null = null;

  private constructor() {
    // Private constructor for singleton
  }

  /**
   * Get singleton instance
   */
  static getInstance(): ServiceContainer {
    if (!this.instance) {
      this.instance = new ServiceContainer();
    }
    return this.instance;
  }

  /**
   * Initialize all services
   *
   * Call this during application startup.
   */
  async initialize(): Promise<void> {
    logger.info('Initializing service container...');

    // Initialize services (lazy loading on first access)
    this.ocrService = getOCRService();
    this.matchingService = getMatchingService();
    this.explanationService = getExplanationService();
    this.enrichmentService = getEnrichmentService();
    this.recommendationService = getRecommendationService();
    this.rerankService = getRerankService();

    // Log status
    const status = await this.getStatus();
    logger.info('Service container initialized', { status });
  }

  /**
   * Get OCR service
   */
  getOCR(): IOCRService {
    if (!this.ocrService) {
      this.ocrService = getOCRService();
    }
    return this.ocrService;
  }

  /**
   * Get matching service
   */
  getMatching(): IMatchingService {
    if (!this.matchingService) {
      this.matchingService = getMatchingService();
    }
    return this.matchingService;
  }

  /**
   * Get explanation service
   */
  getExplanation(): IExplanationService {
    if (!this.explanationService) {
      this.explanationService = getExplanationService();
    }
    return this.explanationService;
  }

  /**
   * Get enrichment service (PDL)
   */
  getEnrichment(): IEnrichmentService {
    if (!this.enrichmentService) {
      this.enrichmentService = getEnrichmentService();
    }
    return this.enrichmentService;
  }

  /**
   * Get recommendation service (Recombee)
   */
  getRecommendation(): IRecommendationService {
    if (!this.recommendationService) {
      this.recommendationService = getRecommendationService();
    }
    return this.recommendationService;
  }

  /**
   * Get rerank service (Cohere)
   */
  getRerank(): IRerankService {
    if (!this.rerankService) {
      this.rerankService = getRerankService();
    }
    return this.rerankService;
  }

  /**
   * Get service availability status
   */
  async getStatus(): Promise<ServiceStatus> {
    const [
      ocrStatus,
      matchingStatus,
      explanationStatus,
      enrichmentStatus,
      recommendationStatus,
      rerankStatus,
    ] = await Promise.all([
      OCRServiceFactory.checkAvailability(),
      MatchingServiceFactory.checkAvailability(),
      ExplanationServiceFactory.checkAvailability(),
      EnrichmentServiceFactory.checkAvailability(),
      RecommendationServiceFactory.checkAvailability(),
      RerankServiceFactory.checkAvailability(),
    ]);

    return {
      ocr: {
        tesseract: ocrStatus.tesseract,
        azure: ocrStatus.azure,
        active: ocrStatus.recommended as 'tesseract' | 'azure',
      },
      matching: {
        deterministic: matchingStatus.deterministic,
        recombee: matchingStatus.recombee,
        active: matchingStatus.recommended as 'deterministic' | 'recombee',
      },
      explanation: {
        template: explanationStatus.template,
        openai: explanationStatus.openai,
        active: explanationStatus.recommended as 'template' | 'openai',
      },
      enrichment: {
        pdl: enrichmentStatus.pdl,
        manual: enrichmentStatus.manual,
        active: enrichmentStatus.recommended as 'pdl' | 'manual',
      },
      recommendation: {
        recombee: recommendationStatus.recombee,
        local: recommendationStatus.local,
        active: recommendationStatus.recommended as 'recombee' | 'local',
      },
      rerank: {
        cohere: rerankStatus.cohere,
        simple: rerankStatus.simple,
        active: rerankStatus.recommended as 'cohere' | 'simple',
      },
    };
  }

  /**
   * Health check for all services
   */
  async healthCheck(): Promise<{
    healthy: boolean;
    services: Record<string, boolean>;
  }> {
    const results: Record<string, boolean> = {};

    try {
      results.ocr = await this.getOCR().isAvailable();
    } catch {
      results.ocr = false;
    }

    // Matching service is always available (deterministic fallback)
    results.matching = true;

    try {
      results.explanation = await this.getExplanation().isAvailable();
    } catch {
      results.explanation = false;
    }

    try {
      results.enrichment = await this.getEnrichment().isAvailable();
    } catch {
      results.enrichment = false;
    }

    try {
      results.recommendation = await this.getRecommendation().isAvailable();
    } catch {
      results.recommendation = false;
    }

    try {
      results.rerank = await this.getRerank().isAvailable();
    } catch {
      results.rerank = false;
    }

    const healthy = Object.values(results).some((v) => v);

    return { healthy, services: results };
  }
}

/**
 * Get the service container singleton
 */
export function getServiceContainer(): ServiceContainer {
  return ServiceContainer.getInstance();
}

/**
 * Convenience exports for direct service access
 */
export {
  getOCRService,
  getMatchingService,
  getExplanationService,
  getEnrichmentService,
  getRecommendationService,
  getRerankService,
};
