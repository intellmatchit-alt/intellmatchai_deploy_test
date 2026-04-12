/**
 * Sharp Preprocessor Service
 *
 * Main implementation of IImagePreprocessor using Sharp library.
 * Orchestrates the complete preprocessing pipeline for business card images.
 *
 * @module infrastructure/external/preprocessing/SharpPreprocessorService
 */

import sharp from 'sharp';
import {
  IImagePreprocessor,
  PreprocessInput,
  PreprocessResult,
  CardDetectionResult,
  ImageQualityResult,
} from '../../../domain/services/IImagePreprocessor';
import { CardClassifier } from './CardClassifier';
import { QualityAssessor } from './QualityAssessor';
import { PerspectiveCorrector } from './PerspectiveCorrector';
import { logger } from '../../../shared/logger';

/**
 * Enhancement level options
 */
export type EnhancementLevel = 'none' | 'light' | 'aggressive';

/**
 * Preprocessor configuration
 */
export interface PreprocessorConfig {
  /** Enhancement level: none, light, or aggressive */
  enhancementLevel: EnhancementLevel;

  /** Target width for OCR (optimal: 1200px) */
  targetWidth: number;

  /** Output format */
  outputFormat: 'jpeg' | 'png';

  /** JPEG quality (1-100) */
  jpegQuality: number;
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: PreprocessorConfig = {
  enhancementLevel: 'light',
  targetWidth: 1200,
  outputFormat: 'jpeg',
  jpegQuality: 90,
};

/**
 * Sharp Preprocessor Service
 *
 * Implements the full preprocessing pipeline:
 * 1. Card classification
 * 2. Quality assessment
 * 3. Perspective/skew correction
 * 4. Image enhancement
 */
export class SharpPreprocessorService implements IImagePreprocessor {
  private readonly classifier: CardClassifier;
  private readonly assessor: QualityAssessor;
  private readonly corrector: PerspectiveCorrector;
  private readonly config: PreprocessorConfig;

  constructor(config: Partial<PreprocessorConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.classifier = new CardClassifier();
    this.assessor = new QualityAssessor();
    this.corrector = new PerspectiveCorrector();
  }

  /**
   * Process an image through the full preprocessing pipeline
   */
  async process(input: PreprocessInput): Promise<PreprocessResult> {
    const startTime = Date.now();
    const warnings: string[] = [];
    const transformationsApplied: string[] = [];

    try {
      // Decode base64 image
      let imageBuffer: Buffer = Buffer.from(input.imageData, 'base64');
      const originalMetadata = await sharp(imageBuffer).metadata();

      if (!originalMetadata.width || !originalMetadata.height) {
        throw new Error('Unable to determine image dimensions');
      }

      const originalSize = {
        width: originalMetadata.width,
        height: originalMetadata.height,
      };

      // 1. Classify card
      const cardDetection = await this.classifier.classify(imageBuffer);
      if (!cardDetection.isBusinessCard) {
        warnings.push(
          `Image may not be a business card (confidence: ${(cardDetection.confidence * 100).toFixed(0)}%). Proceeding with processing.`
        );
      }

      // 2. Assess quality
      const quality = await this.assessor.assess(imageBuffer);
      if (!quality.isUsable) {
        warnings.push('Image quality is below recommended threshold. OCR results may be affected.');
      }
      warnings.push(...quality.suggestions);

      // 3. Correct perspective/skew
      const correctionResult = await this.corrector.correct(
        imageBuffer,
        cardDetection.boundaries
      );
      imageBuffer = correctionResult.buffer as Buffer;
      transformationsApplied.push(...correctionResult.corrections);

      // 4. Apply enhancements
      if (this.config.enhancementLevel !== 'none') {
        imageBuffer = await this.enhanceImage(imageBuffer, quality) as Buffer;
        transformationsApplied.push(`Enhancement applied (${this.config.enhancementLevel})`);
      }

      // 5. Resize for optimal OCR
      const resizedBuffer = await this.resizeForOCR(imageBuffer);
      imageBuffer = resizedBuffer.buffer as Buffer;
      if (resizedBuffer.resized) {
        transformationsApplied.push(`Resized to ${this.config.targetWidth}px width`);
      }

      // 6. Convert to output format
      imageBuffer = await this.convertToOutput(imageBuffer) as Buffer;
      transformationsApplied.push(`Converted to ${this.config.outputFormat.toUpperCase()}`);

      // Get final dimensions
      const finalMetadata = await sharp(imageBuffer).metadata();
      const processedSize = {
        width: finalMetadata.width || originalSize.width,
        height: finalMetadata.height || originalSize.height,
      };

      const processingTimeMs = Date.now() - startTime;

      logger.info('Image preprocessing completed', {
        processingTimeMs,
        transformations: transformationsApplied.length,
        cardConfidence: cardDetection.confidence,
        qualityScore: quality.score,
      });

      return {
        processedImageData: imageBuffer.toString('base64'),
        mimeType: this.config.outputFormat === 'jpeg' ? 'image/jpeg' : 'image/png',
        cardDetection,
        quality,
        metadata: {
          originalSize,
          processedSize,
          processingTimeMs,
          transformationsApplied,
        },
        warnings,
      };
    } catch (error) {
      logger.error('Image preprocessing failed', { error });

      // Return original image on failure
      return this.createFallbackResult(input, startTime, error as Error);
    }
  }

  /**
   * Classify whether an image is a business card
   */
  async classifyCard(imageData: string, mimeType: string): Promise<CardDetectionResult> {
    try {
      const imageBuffer = Buffer.from(imageData, 'base64');
      return await this.classifier.classify(imageBuffer);
    } catch (error) {
      logger.error('Card classification failed', { error });
      return {
        isBusinessCard: false,
        confidence: 0,
        reason: 'Classification error',
      };
    }
  }

  /**
   * Assess the quality of an image for OCR
   */
  async assessQuality(imageData: string, mimeType: string): Promise<ImageQualityResult> {
    try {
      const imageBuffer = Buffer.from(imageData, 'base64');
      return await this.assessor.assess(imageBuffer);
    } catch (error) {
      logger.error('Quality assessment failed', { error });
      return {
        score: 0,
        isUsable: false,
        issues: [{ type: 'blur', severity: 'high', description: 'Assessment failed' }],
        suggestions: ['Unable to assess image quality'],
        metrics: {
          brightness: 0,
          contrast: 0,
          sharpness: 0,
          resolution: { width: 0, height: 0 },
        },
      };
    }
  }

  /**
   * Check if the preprocessor service is available
   */
  async isAvailable(): Promise<boolean> {
    try {
      // Test that sharp is working by creating a small test image
      await sharp({
        create: {
          width: 1,
          height: 1,
          channels: 3,
          background: { r: 255, g: 255, b: 255 },
        },
      }).toBuffer();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Enhance image quality for better OCR
   */
  private async enhanceImage(
    imageBuffer: Buffer,
    quality: ImageQualityResult
  ): Promise<Buffer> {
    let pipeline = sharp(imageBuffer);

    const { brightness, contrast, sharpness } = quality.metrics;
    const isAggressive = this.config.enhancementLevel === 'aggressive';

    // Normalize contrast and brightness
    const needsBrightnessAdjust = brightness < 80 || brightness > 180;
    const needsContrastAdjust = contrast < 50;

    if (needsBrightnessAdjust || needsContrastAdjust) {
      // Calculate adjustments
      let brightnessMultiplier = 1;
      if (brightness < 80) {
        brightnessMultiplier = isAggressive ? 1.4 : 1.2;
      } else if (brightness > 180) {
        brightnessMultiplier = isAggressive ? 0.7 : 0.85;
      }

      // Apply linear adjustment for normalization
      pipeline = pipeline.linear(
        brightnessMultiplier, // multiply
        needsContrastAdjust ? 10 : 0 // add (slight boost)
      );
    }

    // Normalize to enhance contrast
    if (needsContrastAdjust || isAggressive) {
      pipeline = pipeline.normalize();
    }

    // Apply sharpening based on blur detection
    if (sharpness < 300 || isAggressive) {
      const sigma = isAggressive ? 1.5 : 1.0;
      pipeline = pipeline.sharpen({
        sigma,
        m1: isAggressive ? 1.5 : 1.0,
        m2: isAggressive ? 1.0 : 0.5,
      });
    }

    return pipeline.toBuffer();
  }

  /**
   * Resize image to optimal width for OCR
   */
  private async resizeForOCR(
    imageBuffer: Buffer
  ): Promise<{ buffer: Buffer; resized: boolean }> {
    const metadata = await sharp(imageBuffer).metadata();

    if (!metadata.width || metadata.width <= this.config.targetWidth) {
      return { buffer: imageBuffer, resized: false };
    }

    const buffer = await sharp(imageBuffer)
      .resize(this.config.targetWidth, null, {
        fit: 'inside',
        withoutEnlargement: true,
      })
      .toBuffer();

    return { buffer, resized: true };
  }

  /**
   * Convert to output format
   */
  private async convertToOutput(imageBuffer: Buffer): Promise<Buffer> {
    if (this.config.outputFormat === 'jpeg') {
      return sharp(imageBuffer)
        .jpeg({ quality: this.config.jpegQuality })
        .toBuffer();
    }
    return sharp(imageBuffer).png().toBuffer();
  }

  /**
   * Create a fallback result when preprocessing fails
   */
  private async createFallbackResult(
    input: PreprocessInput,
    startTime: number,
    error: Error
  ): Promise<PreprocessResult> {
    const imageBuffer = Buffer.from(input.imageData, 'base64');
    let width = 0;
    let height = 0;

    try {
      const metadata = await sharp(imageBuffer).metadata();
      width = metadata.width || 0;
      height = metadata.height || 0;
    } catch {
      // Use defaults
    }

    return {
      processedImageData: input.imageData,
      mimeType: input.mimeType,
      cardDetection: {
        isBusinessCard: true, // Assume it is to proceed with OCR
        confidence: 0,
        reason: 'Classification skipped due to error',
      },
      quality: {
        score: 0.5,
        isUsable: true,
        issues: [],
        suggestions: [],
        metrics: {
          brightness: 128,
          contrast: 50,
          sharpness: 200,
          resolution: { width, height },
        },
      },
      metadata: {
        originalSize: { width, height },
        processedSize: { width, height },
        processingTimeMs: Date.now() - startTime,
        transformationsApplied: [],
      },
      warnings: [`Preprocessing failed: ${error.message}. Using original image.`],
    };
  }
}
