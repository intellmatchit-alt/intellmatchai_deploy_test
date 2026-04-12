/**
 * Quality Assessor
 *
 * Assesses image quality for OCR processing by checking
 * brightness, contrast, sharpness, and resolution.
 *
 * @module infrastructure/external/preprocessing/QualityAssessor
 */

import sharp from 'sharp';
import {
  ImageQualityResult,
  QualityIssue,
  QualityIssueType,
} from '../../../domain/services/IImagePreprocessor';
import { logger } from '../../../shared/logger';

/**
 * Quality thresholds
 */
const THRESHOLDS = {
  /** Minimum resolution (shortest side in pixels) */
  MIN_RESOLUTION: 300,

  /** Brightness thresholds (0-255 scale) */
  BRIGHTNESS: {
    MIN: 30,
    MAX: 230,
    OPTIMAL_MIN: 80,
    OPTIMAL_MAX: 180,
  },

  /** Contrast threshold (standard deviation of pixel values) */
  CONTRAST: {
    MIN: 30,
    OPTIMAL: 50,
  },

  /** Sharpness threshold (Laplacian variance) */
  SHARPNESS: {
    MIN: 100,
    OPTIMAL: 500,
  },
};

/**
 * Quality Assessor class
 *
 * Analyzes images to determine their suitability for OCR processing.
 * Provides detailed quality metrics and suggestions for improvement.
 */
export class QualityAssessor {
  /**
   * Assess image quality for OCR
   *
   * @param imageBuffer - Image buffer to analyze
   * @returns Quality assessment results
   */
  async assess(imageBuffer: Buffer): Promise<ImageQualityResult> {
    try {
      const metadata = await sharp(imageBuffer).metadata();

      if (!metadata.width || !metadata.height) {
        return this.createFailedResult('Unable to determine image dimensions');
      }

      // Calculate metrics
      const brightness = await this.measureBrightness(imageBuffer);
      const contrast = await this.measureContrast(imageBuffer);
      const sharpness = await this.measureSharpness(imageBuffer);
      const resolution = { width: metadata.width, height: metadata.height };

      // Identify issues
      const issues = this.identifyIssues(brightness, contrast, sharpness, resolution);

      // Calculate overall score
      const score = this.calculateScore(brightness, contrast, sharpness, resolution);

      // Generate suggestions
      const suggestions = this.generateSuggestions(issues);

      // Determine if usable
      const isUsable = score >= 0.3 && !issues.some((i) => i.severity === 'high');

      return {
        score,
        isUsable,
        issues,
        suggestions,
        metrics: {
          brightness,
          contrast,
          sharpness,
          resolution,
        },
      };
    } catch (error) {
      logger.warn('Quality assessment failed', { error });
      return this.createFailedResult('Quality assessment error');
    }
  }

  /**
   * Measure average brightness of the image
   */
  private async measureBrightness(imageBuffer: Buffer): Promise<number> {
    try {
      const { data } = await sharp(imageBuffer)
        .greyscale()
        .resize(100, 100, { fit: 'inside' })
        .raw()
        .toBuffer({ resolveWithObject: true });

      const pixels = new Uint8Array(data);
      let sum = 0;
      for (let i = 0; i < pixels.length; i++) {
        sum += pixels[i];
      }
      return sum / pixels.length;
    } catch (error) {
      logger.warn('Brightness measurement failed', { error });
      return 128; // Return neutral value
    }
  }

  /**
   * Measure contrast (standard deviation of pixel values)
   */
  private async measureContrast(imageBuffer: Buffer): Promise<number> {
    try {
      const { data } = await sharp(imageBuffer)
        .greyscale()
        .resize(100, 100, { fit: 'inside' })
        .raw()
        .toBuffer({ resolveWithObject: true });

      const pixels = new Uint8Array(data);

      // Calculate mean
      let sum = 0;
      for (let i = 0; i < pixels.length; i++) {
        sum += pixels[i];
      }
      const mean = sum / pixels.length;

      // Calculate standard deviation
      let variance = 0;
      for (let i = 0; i < pixels.length; i++) {
        variance += Math.pow(pixels[i] - mean, 2);
      }
      variance /= pixels.length;

      return Math.sqrt(variance);
    } catch (error) {
      logger.warn('Contrast measurement failed', { error });
      return THRESHOLDS.CONTRAST.OPTIMAL; // Return neutral value
    }
  }

  /**
   * Measure sharpness using Laplacian variance
   */
  private async measureSharpness(imageBuffer: Buffer): Promise<number> {
    try {
      // Apply Laplacian kernel and measure variance
      const { data } = await sharp(imageBuffer)
        .greyscale()
        .resize(200, 200, { fit: 'inside' })
        .convolve({
          width: 3,
          height: 3,
          kernel: [0, -1, 0, -1, 4, -1, 0, -1, 0], // Laplacian kernel
        })
        .raw()
        .toBuffer({ resolveWithObject: true });

      const pixels = new Uint8Array(data);

      // Calculate variance of Laplacian
      let sum = 0;
      for (let i = 0; i < pixels.length; i++) {
        sum += pixels[i];
      }
      const mean = sum / pixels.length;

      let variance = 0;
      for (let i = 0; i < pixels.length; i++) {
        variance += Math.pow(pixels[i] - mean, 2);
      }
      variance /= pixels.length;

      return variance;
    } catch (error) {
      logger.warn('Sharpness measurement failed', { error });
      return THRESHOLDS.SHARPNESS.OPTIMAL; // Return neutral value
    }
  }

  /**
   * Identify quality issues based on metrics
   */
  private identifyIssues(
    brightness: number,
    contrast: number,
    sharpness: number,
    resolution: { width: number; height: number }
  ): QualityIssue[] {
    const issues: QualityIssue[] = [];
    const minDimension = Math.min(resolution.width, resolution.height);

    // Check resolution
    if (minDimension < THRESHOLDS.MIN_RESOLUTION) {
      issues.push({
        type: 'low_resolution',
        severity: minDimension < 150 ? 'high' : minDimension < 250 ? 'medium' : 'low',
        description: `Image resolution is too low (${minDimension}px). Minimum recommended: ${THRESHOLDS.MIN_RESOLUTION}px`,
      });
    }

    // Check brightness
    if (brightness < THRESHOLDS.BRIGHTNESS.MIN) {
      issues.push({
        type: 'low_brightness',
        severity: brightness < 15 ? 'high' : brightness < 25 ? 'medium' : 'low',
        description: `Image is too dark (brightness: ${brightness.toFixed(0)}/255)`,
      });
    } else if (brightness > THRESHOLDS.BRIGHTNESS.MAX) {
      issues.push({
        type: 'high_brightness',
        severity: brightness > 245 ? 'high' : brightness > 240 ? 'medium' : 'low',
        description: `Image is too bright/washed out (brightness: ${brightness.toFixed(0)}/255)`,
      });
    }

    // Check contrast
    if (contrast < THRESHOLDS.CONTRAST.MIN) {
      issues.push({
        type: 'low_contrast',
        severity: contrast < 15 ? 'high' : contrast < 25 ? 'medium' : 'low',
        description: `Image has low contrast (stdev: ${contrast.toFixed(1)}). Text may be hard to distinguish.`,
      });
    }

    // Check sharpness
    if (sharpness < THRESHOLDS.SHARPNESS.MIN) {
      issues.push({
        type: 'blur',
        severity: sharpness < 30 ? 'high' : sharpness < 60 ? 'medium' : 'low',
        description: `Image appears blurry (sharpness: ${sharpness.toFixed(0)}). Focus issues may affect OCR.`,
      });
    }

    return issues;
  }

  /**
   * Calculate overall quality score (0-1)
   */
  private calculateScore(
    brightness: number,
    contrast: number,
    sharpness: number,
    resolution: { width: number; height: number }
  ): number {
    const minDimension = Math.min(resolution.width, resolution.height);

    // Resolution score
    const resolutionScore =
      minDimension >= THRESHOLDS.MIN_RESOLUTION
        ? 1
        : Math.max(0, minDimension / THRESHOLDS.MIN_RESOLUTION);

    // Brightness score (best at optimal range)
    let brightnessScore = 1;
    if (brightness < THRESHOLDS.BRIGHTNESS.MIN) {
      brightnessScore = brightness / THRESHOLDS.BRIGHTNESS.MIN;
    } else if (brightness > THRESHOLDS.BRIGHTNESS.MAX) {
      brightnessScore = Math.max(0, (255 - brightness) / (255 - THRESHOLDS.BRIGHTNESS.MAX));
    } else if (
      brightness < THRESHOLDS.BRIGHTNESS.OPTIMAL_MIN ||
      brightness > THRESHOLDS.BRIGHTNESS.OPTIMAL_MAX
    ) {
      brightnessScore = 0.8;
    }

    // Contrast score
    const contrastScore =
      contrast >= THRESHOLDS.CONTRAST.OPTIMAL
        ? 1
        : contrast >= THRESHOLDS.CONTRAST.MIN
          ? 0.7 + (0.3 * (contrast - THRESHOLDS.CONTRAST.MIN)) / (THRESHOLDS.CONTRAST.OPTIMAL - THRESHOLDS.CONTRAST.MIN)
          : Math.max(0, contrast / THRESHOLDS.CONTRAST.MIN);

    // Sharpness score
    const sharpnessScore =
      sharpness >= THRESHOLDS.SHARPNESS.OPTIMAL
        ? 1
        : sharpness >= THRESHOLDS.SHARPNESS.MIN
          ? 0.7 + (0.3 * (sharpness - THRESHOLDS.SHARPNESS.MIN)) / (THRESHOLDS.SHARPNESS.OPTIMAL - THRESHOLDS.SHARPNESS.MIN)
          : Math.max(0, sharpness / THRESHOLDS.SHARPNESS.MIN);

    // Weighted combination
    return (
      resolutionScore * 0.2 +
      brightnessScore * 0.25 +
      contrastScore * 0.25 +
      sharpnessScore * 0.3
    );
  }

  /**
   * Generate improvement suggestions based on issues
   */
  private generateSuggestions(issues: QualityIssue[]): string[] {
    const suggestions: string[] = [];

    for (const issue of issues) {
      switch (issue.type) {
        case 'low_resolution':
          suggestions.push('Try scanning the card from a closer distance or use a higher resolution camera');
          break;
        case 'low_brightness':
          suggestions.push('The image is too dark. Try adding more light or adjusting camera exposure');
          break;
        case 'high_brightness':
          suggestions.push('The image is overexposed. Reduce lighting or move away from direct light');
          break;
        case 'low_contrast':
          suggestions.push('Low contrast detected. Ensure the card has clear text against the background');
          break;
        case 'blur':
          suggestions.push('Image appears blurry. Hold the camera steady or use autofocus');
          break;
      }
    }

    // Remove duplicates
    return [...new Set(suggestions)];
  }

  /**
   * Create a failed assessment result
   */
  private createFailedResult(reason: string): ImageQualityResult {
    return {
      score: 0,
      isUsable: false,
      issues: [
        {
          type: 'blur',
          severity: 'high',
          description: reason,
        },
      ],
      suggestions: ['Unable to assess image quality. Please try again with a different image.'],
      metrics: {
        brightness: 0,
        contrast: 0,
        sharpness: 0,
        resolution: { width: 0, height: 0 },
      },
    };
  }
}
