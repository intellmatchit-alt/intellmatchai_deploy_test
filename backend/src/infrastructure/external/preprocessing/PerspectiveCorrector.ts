/**
 * Perspective Corrector
 *
 * Corrects image perspective and skew for better OCR results.
 * Uses edge detection to find document boundaries and applies
 * rotation correction.
 *
 * @module infrastructure/external/preprocessing/PerspectiveCorrector
 */

import sharp from 'sharp';
import { CardBoundaries } from '../../../domain/services/IImagePreprocessor';
import { logger } from '../../../shared/logger';

/**
 * Correction result
 */
export interface CorrectionResult {
  /** Corrected image buffer */
  buffer: Buffer;

  /** Rotation angle applied (degrees) */
  rotationApplied: number;

  /** Whether correction was successful */
  success: boolean;

  /** Description of corrections made */
  corrections: string[];
}

/**
 * Maximum skew angle to correct (degrees)
 */
const MAX_SKEW_ANGLE = 15;

/**
 * Minimum skew angle to bother correcting (degrees)
 */
const MIN_SKEW_THRESHOLD = 0.5;

/**
 * Perspective Corrector class
 *
 * Analyzes image edges to detect skew and rotation, then applies
 * corrections to straighten the image for optimal OCR processing.
 */
export class PerspectiveCorrector {
  /**
   * Correct perspective and skew of an image
   *
   * @param imageBuffer - Image buffer to correct
   * @param boundaries - Optional detected card boundaries
   * @returns Corrected image and metadata
   */
  async correct(
    imageBuffer: Buffer,
    boundaries?: CardBoundaries
  ): Promise<CorrectionResult> {
    const corrections: string[] = [];
    let currentBuffer = imageBuffer;
    let totalRotation = 0;

    try {
      // 1. Auto-rotate based on EXIF orientation
      currentBuffer = await this.autoRotate(currentBuffer);
      corrections.push('EXIF orientation applied');

      // 2. Detect and correct major orientation (90°, 180°, 270°)
      const orientationResult = await this.detectAndCorrectOrientation(currentBuffer);
      if (orientationResult.rotated) {
        currentBuffer = orientationResult.buffer;
        totalRotation += orientationResult.angle;
        corrections.push(`Orientation corrected by ${orientationResult.angle}°`);
      }

      // 3. Detect and correct minor skew
      const skewAngle = await this.detectSkewAngle(currentBuffer);

      if (Math.abs(skewAngle) > MIN_SKEW_THRESHOLD && Math.abs(skewAngle) <= MAX_SKEW_ANGLE) {
        currentBuffer = await this.rotateImage(currentBuffer, -skewAngle);
        totalRotation += -skewAngle;
        corrections.push(`Skew corrected by ${(-skewAngle).toFixed(1)}°`);
      }

      // 4. Crop to boundaries if provided
      if (boundaries) {
        const cropResult = await this.cropToBoundaries(currentBuffer, boundaries);
        if (cropResult.cropped) {
          currentBuffer = cropResult.buffer;
          corrections.push('Cropped to card boundaries');
        }
      }

      return {
        buffer: currentBuffer,
        rotationApplied: totalRotation,
        success: true,
        corrections,
      };
    } catch (error) {
      logger.warn('Perspective correction failed', { error });
      return {
        buffer: imageBuffer,
        rotationApplied: 0,
        success: false,
        corrections: ['Perspective correction failed, using original image'],
      };
    }
  }

  /**
   * Detect and correct major orientation issues (90°, 180°, 270° rotations)
   *
   * Business cards are typically landscape (wider than tall).
   * Uses aspect ratio and text line analysis to determine correct orientation.
   */
  private async detectAndCorrectOrientation(
    imageBuffer: Buffer
  ): Promise<{ buffer: Buffer; rotated: boolean; angle: number }> {
    try {
      const metadata = await sharp(imageBuffer).metadata();
      if (!metadata.width || !metadata.height) {
        return { buffer: imageBuffer, rotated: false, angle: 0 };
      }

      const width = metadata.width;
      const height = metadata.height;
      const aspectRatio = width / height;

      logger.info('Orientation detection', { width, height, aspectRatio, isPortrait: aspectRatio < 0.9 });

      // If image is portrait (taller than wide), it likely needs 90° rotation
      // Business cards are typically 1.75:1 (landscape)
      if (aspectRatio < 0.9) {
        // Portrait orientation - rotate to landscape
        // Check which direction has more horizontal text lines
        const rotatedBuffer = await this.rotateImage(imageBuffer, 90);
        const counterRotatedBuffer = await this.rotateImage(imageBuffer, -90);

        const originalScore = await this.calculateTextLineScore(imageBuffer);
        const rotatedScore = await this.calculateTextLineScore(rotatedBuffer);
        const counterRotatedScore = await this.calculateTextLineScore(counterRotatedBuffer);

        logger.info('Orientation scores for portrait image', {
          originalScore,
          rotatedScore,
          counterRotatedScore,
          willRotate90: rotatedScore > originalScore && rotatedScore >= counterRotatedScore,
          willRotateMinus90: counterRotatedScore > originalScore && counterRotatedScore > rotatedScore,
        });

        // For portrait images, always rotate to landscape
        // Pick the rotation direction with the best text line score
        if (rotatedScore >= counterRotatedScore) {
          logger.info('Rotating portrait image 90° to landscape');
          return { buffer: rotatedBuffer as Buffer, rotated: true, angle: 90 };
        } else {
          logger.info('Rotating portrait image -90° to landscape');
          return { buffer: counterRotatedBuffer as Buffer, rotated: true, angle: -90 };
        }
      }

      // Check for 180° rotation (upside down)
      // Compare text line scores between normal and 180° rotated
      const flippedBuffer = await this.rotateImage(imageBuffer, 180);
      const normalScore = await this.calculateTextLineScore(imageBuffer);
      const flippedScore = await this.calculateTextLineScore(flippedBuffer);

      // If flipped score is significantly better, the image was upside down
      if (flippedScore > normalScore * 1.2) {
        logger.debug('Image appears upside down, rotating 180°', { normalScore, flippedScore });
        return { buffer: flippedBuffer as Buffer, rotated: true, angle: 180 };
      }

      return { buffer: imageBuffer, rotated: false, angle: 0 };
    } catch (error) {
      logger.warn('Orientation detection failed', { error });
      return { buffer: imageBuffer, rotated: false, angle: 0 };
    }
  }

  /**
   * Calculate a score indicating how well horizontal text lines are detected
   * Higher score = more horizontal text lines = correct orientation
   */
  private async calculateTextLineScore(imageBuffer: Buffer): Promise<number> {
    try {
      const metadata = await sharp(imageBuffer).metadata();
      if (!metadata.width || !metadata.height) {
        return 0;
      }

      // Resize for faster processing
      const targetWidth = Math.min(300, metadata.width);
      const scale = targetWidth / metadata.width;
      const targetHeight = Math.round(metadata.height * scale);

      // Apply horizontal edge detection to find text lines
      const { data } = await sharp(imageBuffer)
        .greyscale()
        .resize(targetWidth, targetHeight)
        .convolve({
          width: 3,
          height: 3,
          kernel: [-1, -2, -1, 0, 0, 0, 1, 2, 1], // Sobel Y - detects horizontal edges
        })
        .raw()
        .toBuffer({ resolveWithObject: true });

      const pixels = new Uint8Array(data);
      const threshold = 25;

      // Count rows with significant horizontal edge activity
      let strongRows = 0;
      let totalEdgeStrength = 0;

      for (let y = 0; y < targetHeight; y++) {
        let rowStrength = 0;
        for (let x = 0; x < targetWidth; x++) {
          const value = pixels[y * targetWidth + x];
          if (value > threshold) {
            rowStrength += value;
          }
        }
        totalEdgeStrength += rowStrength;
        if (rowStrength > targetWidth * 10) {
          strongRows++;
        }
      }

      // Score combines number of text-line rows and total edge strength
      return strongRows * 100 + totalEdgeStrength / 1000;
    } catch (error) {
      logger.warn('Text line score calculation failed', { error });
      return 0;
    }
  }

  /**
   * Auto-rotate image based on EXIF orientation
   */
  private async autoRotate(imageBuffer: Buffer): Promise<Buffer> {
    return sharp(imageBuffer).rotate().toBuffer();
  }

  /**
   * Detect skew angle using edge analysis
   *
   * Uses horizontal edge detection and line analysis to estimate
   * the rotation angle of text lines.
   */
  private async detectSkewAngle(imageBuffer: Buffer): Promise<number> {
    try {
      const metadata = await sharp(imageBuffer).metadata();
      if (!metadata.width || !metadata.height) {
        return 0;
      }

      // Resize for faster processing
      const targetWidth = Math.min(400, metadata.width);
      const scale = targetWidth / metadata.width;
      const targetHeight = Math.round(metadata.height * scale);

      // Apply horizontal edge detection (Sobel Y)
      const { data } = await sharp(imageBuffer)
        .greyscale()
        .resize(targetWidth, targetHeight)
        .convolve({
          width: 3,
          height: 3,
          kernel: [-1, -2, -1, 0, 0, 0, 1, 2, 1], // Sobel Y kernel
        })
        .raw()
        .toBuffer({ resolveWithObject: true });

      const pixels = new Uint8Array(data);

      // Analyze edge orientations using projection
      const angles = await this.analyzeEdgeOrientations(pixels, targetWidth, targetHeight);

      // Find dominant angle
      const dominantAngle = this.findDominantAngle(angles);

      return dominantAngle;
    } catch (error) {
      logger.warn('Skew detection failed', { error });
      return 0;
    }
  }

  /**
   * Analyze edge orientations using horizontal projection profile
   */
  private async analyzeEdgeOrientations(
    pixels: Uint8Array,
    width: number,
    height: number
  ): Promise<number[]> {
    const angles: number[] = [];
    const threshold = 30;

    // Find rows with significant edge activity
    const rowActivity: number[] = [];
    for (let y = 0; y < height; y++) {
      let activity = 0;
      for (let x = 0; x < width; x++) {
        if (pixels[y * width + x] > threshold) {
          activity++;
        }
      }
      rowActivity.push(activity);
    }

    // Find peaks in row activity (text lines)
    const peaks: number[] = [];
    for (let y = 2; y < height - 2; y++) {
      if (
        rowActivity[y] > rowActivity[y - 1] &&
        rowActivity[y] > rowActivity[y + 1] &&
        rowActivity[y] > width * 0.1
      ) {
        peaks.push(y);
      }
    }

    // Analyze pairs of peaks to estimate skew
    for (let i = 0; i < peaks.length - 1; i++) {
      const y1 = peaks[i];
      const y2 = peaks[i + 1];

      // Find center of mass for each peak row
      const x1 = this.findCenterOfMass(pixels, width, y1);
      const x2 = this.findCenterOfMass(pixels, width, y2);

      if (x1 !== null && x2 !== null) {
        const angle = Math.atan2(y2 - y1, x2 - x1) * (180 / Math.PI);
        // Adjust to measure deviation from horizontal
        const skew = angle - 90;
        if (Math.abs(skew) <= MAX_SKEW_ANGLE) {
          angles.push(skew);
        }
      }
    }

    return angles;
  }

  /**
   * Find center of mass of edge pixels in a row
   */
  private findCenterOfMass(
    pixels: Uint8Array,
    width: number,
    row: number
  ): number | null {
    let sum = 0;
    let weightedSum = 0;
    const threshold = 30;

    for (let x = 0; x < width; x++) {
      const value = pixels[row * width + x];
      if (value > threshold) {
        sum += value;
        weightedSum += x * value;
      }
    }

    return sum > 0 ? weightedSum / sum : null;
  }

  /**
   * Find the dominant angle from a list of detected angles
   */
  private findDominantAngle(angles: number[]): number {
    if (angles.length === 0) {
      return 0;
    }

    // Use histogram binning to find most common angle
    const binSize = 0.5;
    const bins = new Map<number, number>();

    for (const angle of angles) {
      const bin = Math.round(angle / binSize) * binSize;
      bins.set(bin, (bins.get(bin) || 0) + 1);
    }

    let maxCount = 0;
    let dominantAngle = 0;

    for (const [angle, count] of bins) {
      if (count > maxCount) {
        maxCount = count;
        dominantAngle = angle;
      }
    }

    // Only return if we have reasonable confidence
    return maxCount >= 3 ? dominantAngle : 0;
  }

  /**
   * Rotate image by specified angle
   */
  private async rotateImage(imageBuffer: Buffer, angle: number): Promise<Buffer> {
    return sharp(imageBuffer)
      .rotate(angle, {
        background: { r: 255, g: 255, b: 255, alpha: 1 },
      })
      .toBuffer();
  }

  /**
   * Crop image to detected boundaries
   */
  private async cropToBoundaries(
    imageBuffer: Buffer,
    boundaries: CardBoundaries
  ): Promise<{ buffer: Buffer; cropped: boolean }> {
    try {
      const metadata = await sharp(imageBuffer).metadata();
      if (!metadata.width || !metadata.height) {
        return { buffer: imageBuffer, cropped: false };
      }

      // Calculate bounding box from corners
      const minX = Math.max(0, Math.min(boundaries.topLeft.x, boundaries.bottomLeft.x) - 10);
      const maxX = Math.min(
        metadata.width,
        Math.max(boundaries.topRight.x, boundaries.bottomRight.x) + 10
      );
      const minY = Math.max(0, Math.min(boundaries.topLeft.y, boundaries.topRight.y) - 10);
      const maxY = Math.min(
        metadata.height,
        Math.max(boundaries.bottomLeft.y, boundaries.bottomRight.y) + 10
      );

      const cropWidth = maxX - minX;
      const cropHeight = maxY - minY;

      // Only crop if the crop region is significantly different
      if (
        cropWidth < metadata.width * 0.95 ||
        cropHeight < metadata.height * 0.95
      ) {
        const buffer = await sharp(imageBuffer)
          .extract({
            left: Math.round(minX),
            top: Math.round(minY),
            width: Math.round(cropWidth),
            height: Math.round(cropHeight),
          })
          .toBuffer();

        return { buffer, cropped: true };
      }

      return { buffer: imageBuffer, cropped: false };
    } catch (error) {
      logger.warn('Crop to boundaries failed', { error });
      return { buffer: imageBuffer, cropped: false };
    }
  }
}
