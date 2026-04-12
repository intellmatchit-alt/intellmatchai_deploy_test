/**
 * Scan Card Use Case
 *
 * Handles business card scanning and OCR extraction.
 *
 * @module application/use-cases/scan/ScanCardUseCase
 */

import { IOCRService, OCRResult } from '../../../domain/services/IOCRService';
import { getImagePreprocessor } from '../../../infrastructure/external/preprocessing';
import { logger } from '../../../shared/logger';
import { ValidationError, ExternalServiceError } from '../../../shared/errors';

/**
 * Scan card input DTO
 */
export interface ScanCardInput {
  /** Base64 encoded image data */
  imageData: string;

  /** Image MIME type */
  mimeType: string;
}

/**
 * Preprocessing metadata
 */
export interface PreprocessingInfo {
  /** Whether image was preprocessed */
  applied: boolean;

  /** Processing time in ms */
  processingTimeMs?: number;

  /** Card detection confidence (0-1) */
  cardConfidence?: number;

  /** Image quality score (0-1) */
  qualityScore?: number;

  /** Transformations applied */
  transformations?: string[];

  /** Rotation angle applied (degrees) */
  rotationAngle?: number;

  /** Original image dimensions */
  originalSize?: { width: number; height: number };

  /** Processed image dimensions */
  processedSize?: { width: number; height: number };

  /** Processed image as base64 (cleaned version for saving) */
  processedImageData?: string;

  /** Processed image MIME type */
  processedMimeType?: string;
}

/**
 * Scan card output DTO
 */
export interface ScanCardOutput {
  /** Extracted fields */
  fields: {
    name?: string;
    title?: string;
    firstName?: string;
    middleName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
    company?: string;
    jobTitle?: string;
    website?: string;
    linkedInUrl?: string;
    location?: string;
  };

  /** Raw OCR text */
  rawText: string;

  /** Confidence score (0-1) */
  confidence: number;

  /** Processing time in ms */
  processingTimeMs: number;

  /** Any warnings */
  warnings?: string[];

  /** Preprocessing information */
  preprocessing?: PreprocessingInfo;
}

/**
 * Scan card use case
 *
 * Processes a business card image and extracts contact information.
 */
export class ScanCardUseCase {
  constructor(private readonly ocrService: IOCRService) {}

  /**
   * Execute card scanning
   *
   * @param userId - ID of the user scanning the card
   * @param input - Image data and type
   * @returns Extracted fields
   */
  async execute(userId: string, input: ScanCardInput): Promise<ScanCardOutput> {
    logger.info('Scanning business card', { userId });

    // Validate image data
    if (!input.imageData || input.imageData.length === 0) {
      throw new ValidationError('Image data is required');
    }

    // Validate MIME type
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!validTypes.includes(input.mimeType)) {
      throw new ValidationError(`Invalid image type. Supported: ${validTypes.join(', ')}`);
    }

    // Check if OCR service is available
    const isAvailable = await this.ocrService.isAvailable();
    if (!isAvailable) {
      throw new ExternalServiceError('OCR', 'OCR service is not available');
    }

    // Collect all warnings
    const warnings: string[] = [];

    // Perform OCR directly on original image (no preprocessing)
    let result: OCRResult;
    try {
      result = await this.ocrService.extractFromCard(input.imageData, input.mimeType);
    } catch (error) {
      logger.error('OCR extraction failed', { error, userId });
      throw new ExternalServiceError('OCR', 'Failed to extract text from image');
    }

    // Merge warnings from OCR
    if (result.warnings) {
      warnings.push(...result.warnings);
    }

    logger.info('Card scanned successfully', {
      userId,
      confidence: result.fields.confidence,
      processingTimeMs: result.processingTimeMs,
    });

    return {
      fields: {
        name: result.fields.name,
        email: result.fields.email,
        phone: result.fields.phone,
        company: result.fields.company,
        jobTitle: result.fields.jobTitle,
        website: result.fields.website,
        linkedInUrl: result.fields.linkedInUrl,
      },
      rawText: result.fields.rawText,
      confidence: result.fields.confidence,
      processingTimeMs: result.processingTimeMs,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  }
}
