/**
 * OCR Service Factory
 *
 * Creates the appropriate OCR service based on configuration.
 * Uses Azure when available, falls back to Tesseract.
 *
 * @module infrastructure/external/ocr/OCRServiceFactory
 */

import { IOCRService } from '../../../domain/services/IOCRService';
import { TesseractOCRService } from './TesseractOCRService';
import { AzureOCRService } from './AzureOCRService';
import { GoogleVisionOCRService } from './GoogleVisionOCRService';
import { logger } from '../../../shared/logger';
import { config } from '../../../config';

/**
 * OCR service type
 */
export type OCRServiceType = 'azure' | 'google-vision' | 'tesseract' | 'auto';

/**
 * OCR Service Factory
 *
 * Creates OCR service instances based on configuration and availability.
 */
export class OCRServiceFactory {
  private static tesseractInstance: TesseractOCRService | null = null;
  private static azureInstance: AzureOCRService | null = null;
  private static googleVisionInstance: GoogleVisionOCRService | null = null;

  /**
   * Create an OCR service instance
   *
   * @param type - Service type to create ('auto' uses best available)
   * @returns OCR service instance
   */
  static create(type: OCRServiceType = 'auto'): IOCRService {
    switch (type) {
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
   * Get the best available OCR service
   *
   * Priority:
   * 1. Azure (if configured and feature flag enabled)
   * 2. Google Vision (if configured and feature flag enabled)
   * 3. Tesseract (always available)
   */
  private static getBestAvailable(): IOCRService {
    const useAzure = config.features.azureOcr;
    const azureConfigured = config.ai.azure.endpoint && config.ai.azure.key;

    if (useAzure && azureConfigured) {
      logger.info('Using Azure OCR service (cloud)');
      return this.getAzureService();
    }

    const useGoogleVision = config.features.googleVision;
    const googleVisionConfigured = config.ai.googleVision?.apiKey;

    if (useGoogleVision && googleVisionConfigured) {
      logger.info('Using Google Vision OCR service (cloud)');
      return this.getGoogleVisionService();
    }

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
    recommended: OCRServiceType;
  }> {
    const tesseract = await this.getTesseractService().isAvailable();
    const azure = await this.getAzureService().isAvailable();
    const googleVision = await this.getGoogleVisionService().isAvailable();

    return {
      tesseract,
      azure,
      googleVision,
      recommended: azure ? 'azure' : googleVision ? 'google-vision' : 'tesseract',
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
