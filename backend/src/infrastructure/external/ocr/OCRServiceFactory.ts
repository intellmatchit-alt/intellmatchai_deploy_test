/**
 * OCR Service Factory
 *
 * Creates the appropriate OCR service based on configuration.
 * Priority: OpenAI Vision > Azure > Google Vision > Tesseract
 *
 * @module infrastructure/external/ocr/OCRServiceFactory
 */

import { IOCRService } from '../../../domain/services/IOCRService';
import { TesseractOCRService } from './TesseractOCRService';
import { AzureOCRService } from './AzureOCRService';
import { GoogleVisionOCRService } from './GoogleVisionOCRService';
import { OpenAIVisionOCRService } from './OpenAIVisionOCRService';
import { logger } from '../../../shared/logger';
import { config } from '../../../config';

/**
 * OCR service type
 */
export type OCRServiceType = 'openai-vision' | 'azure' | 'google-vision' | 'tesseract' | 'auto';

/**
 * OCR Service Factory
 *
 * Creates OCR service instances based on configuration and availability.
 */
export class OCRServiceFactory {
  private static tesseractInstance: TesseractOCRService | null = null;
  private static azureInstance: AzureOCRService | null = null;
  private static googleVisionInstance: GoogleVisionOCRService | null = null;
  private static openaiVisionInstance: OpenAIVisionOCRService | null = null;

  /**
   * Create an OCR service instance
   *
   * @param type - Service type to create ('auto' uses best available)
   * @returns OCR service instance
   */
  static create(type: OCRServiceType = 'auto'): IOCRService {
    switch (type) {
      case 'openai-vision':
        return this.getOpenAIVisionService();

      case 'azure':
        return this.getAzureService();

      case 'google-vision':
        return this.getGoogleVisionService();

      case 'tesseract':
        return this.getTesseractService();

      case 'auto':
      default:
        return this.getBestAvailable();
    }
  }

  /**
   * Get Tesseract service instance (singleton)
   */
  private static getTesseractService(): TesseractOCRService {
    if (!this.tesseractInstance) {
      this.tesseractInstance = new TesseractOCRService();
      logger.info('Created Tesseract OCR service instance');
    }
    return this.tesseractInstance;
  }

  /**
   * Get Azure service instance (singleton)
   */
  private static getAzureService(): AzureOCRService {
    if (!this.azureInstance) {
      this.azureInstance = new AzureOCRService();
      logger.info('Created Azure OCR service instance');
    }
    return this.azureInstance;
  }

  /**
   * Get Google Vision service instance (singleton)
   */
  private static getGoogleVisionService(): GoogleVisionOCRService {
    if (!this.googleVisionInstance) {
      this.googleVisionInstance = new GoogleVisionOCRService();
      logger.info('Created Google Vision OCR service instance');
    }
    return this.googleVisionInstance;
  }

  /**
   * Get OpenAI Vision service instance (singleton)
   */
  private static getOpenAIVisionService(): OpenAIVisionOCRService {
    if (!this.openaiVisionInstance) {
      this.openaiVisionInstance = new OpenAIVisionOCRService();
      logger.info('Created OpenAI Vision OCR service instance');
    }
    return this.openaiVisionInstance;
  }

  /**
   * Get the best available OCR service
   *
   * Priority:
   * 1. OpenAI Vision (if OpenAI API key is configured)
   * 2. Azure (if configured and feature flag enabled)
   * 3. Google Vision (if configured and feature flag enabled)
   * 4. Tesseract (always available)
   */
  private static getBestAvailable(): IOCRService {
    // Priority 1: OpenAI Vision (best quality, uses GPT-4o)
    const openaiConfigured = !!config.ai?.openai?.apiKey;
    if (openaiConfigured) {
      logger.info('Using OpenAI Vision OCR service (GPT-4o)');
      return this.getOpenAIVisionService();
    }

    // Priority 2: Azure
    const useAzure = config.features.azureOcr;
    const azureConfigured = config.ai.azure.endpoint && config.ai.azure.key;

    if (useAzure && azureConfigured) {
      logger.info('Using Azure OCR service (cloud)');
      return this.getAzureService();
    }

    // Priority 3: Google Vision
    const useGoogleVision = config.features.googleVision;
    const googleVisionConfigured = config.ai.googleVision?.apiKey;

    if (useGoogleVision && googleVisionConfigured) {
      logger.info('Using Google Vision OCR service (cloud)');
      return this.getGoogleVisionService();
    }

    // Priority 4: Tesseract (local fallback)
    logger.info('Using Tesseract OCR service (local)');
    return this.getTesseractService();
  }

  /**
   * Check which services are available
   */
  static async checkAvailability(): Promise<{
    tesseract: boolean;
    azure: boolean;
    googleVision: boolean;
    openaiVision: boolean;
    recommended: OCRServiceType;
  }> {
    const tesseract = await this.getTesseractService().isAvailable();
    const azure = await this.getAzureService().isAvailable();
    const googleVision = await this.getGoogleVisionService().isAvailable();
    const openaiVision = await this.getOpenAIVisionService().isAvailable();

    return {
      tesseract,
      azure,
      googleVision,
      openaiVision,
      recommended: openaiVision ? 'openai-vision' : azure ? 'azure' : googleVision ? 'google-vision' : 'tesseract',
    };
  }
}

/**
 * Get default OCR service instance
 *
 * Convenience function for getting the auto-selected service.
 */
export function getOCRService(): IOCRService {
  return OCRServiceFactory.create('auto');
}
