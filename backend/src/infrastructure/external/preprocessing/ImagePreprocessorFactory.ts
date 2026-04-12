/**
 * Image Preprocessor Factory
 *
 * Factory for creating and managing image preprocessor instances.
 * Provides singleton access and configuration-based instantiation.
 *
 * @module infrastructure/external/preprocessing/ImagePreprocessorFactory
 */

import { IImagePreprocessor } from '../../../domain/services/IImagePreprocessor';
import { SharpPreprocessorService, EnhancementLevel } from './SharpPreprocessorService';
import { config } from '../../../config';
import { logger } from '../../../shared/logger';

/**
 * Singleton instance
 */
let preprocessorInstance: IImagePreprocessor | null = null;

/**
 * Get the image preprocessor instance
 *
 * Returns null if the feature is disabled or unavailable.
 * Uses singleton pattern to avoid creating multiple instances.
 *
 * @returns Image preprocessor instance or null if disabled
 */
export function getImagePreprocessor(): IImagePreprocessor | null {
  // Check if feature is enabled
  if (!config.features.imagePreprocessing) {
    logger.warn('Image preprocessing feature is DISABLED - check FEATURE_IMAGE_PREPROCESSING env var');
    return null;
  }

  // Return existing instance if available
  if (preprocessorInstance) {
    logger.debug('Using existing image preprocessor instance');
    return preprocessorInstance;
  }

  try {
    // Get enhancement level from config
    const enhancementLevel = config.imagePreprocessing.level as EnhancementLevel;

    logger.info('Creating new image preprocessor', {
      featureEnabled: config.features.imagePreprocessing,
      enhancementLevel,
    });

    // Create new instance
    preprocessorInstance = new SharpPreprocessorService({
      enhancementLevel,
      targetWidth: 1200,
      outputFormat: 'jpeg',
      jpegQuality: 90,
    });

    logger.info('Image preprocessor initialized successfully', {
      enhancementLevel,
    });

    return preprocessorInstance;
  } catch (error) {
    logger.error('Failed to initialize image preprocessor', { error });
    return null;
  }
}

/**
 * Create a new image preprocessor with custom configuration
 *
 * Use this when you need a preprocessor with non-default settings.
 *
 * @param options - Custom configuration options
 * @returns New image preprocessor instance
 */
export function createImagePreprocessor(options?: {
  enhancementLevel?: EnhancementLevel;
  targetWidth?: number;
  outputFormat?: 'jpeg' | 'png';
  jpegQuality?: number;
}): IImagePreprocessor {
  return new SharpPreprocessorService({
    enhancementLevel: options?.enhancementLevel || 'light',
    targetWidth: options?.targetWidth || 1200,
    outputFormat: options?.outputFormat || 'jpeg',
    jpegQuality: options?.jpegQuality || 90,
  });
}

/**
 * Reset the singleton instance
 *
 * Useful for testing or when configuration changes.
 */
export function resetImagePreprocessor(): void {
  preprocessorInstance = null;
  logger.debug('Image preprocessor instance reset');
}

/**
 * Check if image preprocessing is available
 *
 * @returns True if preprocessing is available and enabled
 */
export async function isPreprocessingAvailable(): Promise<boolean> {
  const preprocessor = getImagePreprocessor();
  if (!preprocessor) {
    return false;
  }
  return preprocessor.isAvailable();
}
