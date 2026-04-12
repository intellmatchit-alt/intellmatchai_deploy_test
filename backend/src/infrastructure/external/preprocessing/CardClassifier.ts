/**
 * Card Classifier
 *
 * Detects whether an image contains a business card using
 * aspect ratio analysis and edge detection.
 *
 * @module infrastructure/external/preprocessing/CardClassifier
 */

import sharp from 'sharp';
import { CardDetectionResult, CardBoundaries } from '../../../domain/services/IImagePreprocessor';
import { logger } from '../../../shared/logger';

/**
 * Standard business card aspect ratios
 */
const CARD_ASPECT_RATIOS = {
  US: 3.5 / 2, // 3.5" x 2"
  EU: 85 / 55, // 85mm x 55mm (ISO 7810 ID-1)
  JP: 91 / 55, // 91mm x 55mm
};

/**
 * Aspect ratio tolerance for matching
 */
const ASPECT_RATIO_TOLERANCE = 0.25;

/**
 * Minimum confidence threshold for card detection
 */
const MIN_CONFIDENCE_THRESHOLD = 0.5;

/**
 * Card Classifier class
 *
 * Uses multiple heuristics to determine if an image contains a business card:
 * - Aspect ratio matching against standard card sizes
 * - Edge detection to find rectangular structures
 * - Content analysis for card-like features
 */
export class CardClassifier {
  /**
   * Classify whether an image is a business card
   *
   * @param imageBuffer - Image buffer to analyze
   * @returns Classification result with confidence score
   */
  async classify(imageBuffer: Buffer): Promise<CardDetectionResult> {
    try {
      const metadata = await sharp(imageBuffer).metadata();

      if (!metadata.width || !metadata.height) {
        return {
          isBusinessCard: false,
          confidence: 0,
          reason: 'Unable to determine image dimensions',
        };
      }

      // Calculate confidence scores from different factors
      const aspectRatioScore = this.checkAspectRatio(metadata.width, metadata.height);
      const edgeScore = await this.analyzeEdges(imageBuffer, metadata.width, metadata.height);
      const sizeScore = this.checkImageSize(metadata.width, metadata.height);

      // Weighted combination of scores
      const confidence = aspectRatioScore * 0.4 + edgeScore * 0.4 + sizeScore * 0.2;

      const isBusinessCard = confidence >= MIN_CONFIDENCE_THRESHOLD;

      // Detect boundaries if it looks like a card
      let boundaries: CardBoundaries | undefined;
      if (isBusinessCard) {
        boundaries = await this.detectBoundaries(imageBuffer, metadata.width, metadata.height);
      }

      const reasons: string[] = [];
      if (aspectRatioScore > 0.5) {
        reasons.push('aspect ratio matches standard card sizes');
      }
      if (edgeScore > 0.5) {
        reasons.push('rectangular edges detected');
      }
      if (sizeScore > 0.5) {
        reasons.push('image size appropriate for card scan');
      }

      return {
        isBusinessCard,
        confidence: Math.min(1, Math.max(0, confidence)),
        boundaries,
        reason:
          reasons.length > 0
            ? `Detected as card: ${reasons.join(', ')}`
            : 'Image does not appear to be a business card',
      };
    } catch (error) {
      logger.warn('Card classification failed', { error });
      return {
        isBusinessCard: false,
        confidence: 0,
        reason: 'Classification error: unable to analyze image',
      };
    }
  }

  /**
   * Check if aspect ratio matches standard business card sizes
   */
  private checkAspectRatio(width: number, height: number): number {
    // Consider both orientations (landscape and portrait)
    const ratio = Math.max(width, height) / Math.min(width, height);

    let bestMatch = 0;
    for (const [, standardRatio] of Object.entries(CARD_ASPECT_RATIOS)) {
      const diff = Math.abs(ratio - standardRatio) / standardRatio;
      const match = Math.max(0, 1 - diff / ASPECT_RATIO_TOLERANCE);
      bestMatch = Math.max(bestMatch, match);
    }

    return bestMatch;
  }

  /**
   * Analyze edges to detect rectangular structures
   *
   * Uses a Sobel-like edge detection approach via sharp's
   * convolution capabilities.
   */
  private async analyzeEdges(
    imageBuffer: Buffer,
    width: number,
    height: number
  ): Promise<number> {
    try {
      // Convert to grayscale and detect edges using Laplacian-like operation
      const edgeBuffer = await sharp(imageBuffer)
        .greyscale()
        .resize(300, 300, { fit: 'inside' }) // Normalize size for consistent analysis
        .convolve({
          width: 3,
          height: 3,
          kernel: [-1, -1, -1, -1, 8, -1, -1, -1, -1], // Laplacian kernel for edge detection
        })
        .raw()
        .toBuffer();

      // Analyze edge distribution
      const pixels = new Uint8Array(edgeBuffer);
      let edgePixels = 0;
      const threshold = 30;

      for (let i = 0; i < pixels.length; i++) {
        if (pixels[i] > threshold) {
          edgePixels++;
        }
      }

      const edgeRatio = edgePixels / pixels.length;

      // Business cards typically have moderate edge density (borders, text)
      // Too few edges = blank/uniform image
      // Too many edges = noisy/complex image
      const optimalEdgeRatio = 0.15;
      const edgeVariance = Math.abs(edgeRatio - optimalEdgeRatio);
      const edgeScore = Math.max(0, 1 - edgeVariance * 5);

      // Check for rectangular structure by analyzing edge concentrations
      // at expected border locations
      const rectangleScore = await this.checkRectangularStructure(pixels, 300, 300);

      return edgeScore * 0.5 + rectangleScore * 0.5;
    } catch (error) {
      logger.warn('Edge analysis failed', { error });
      return 0.5; // Neutral score on failure
    }
  }

  /**
   * Check for rectangular structure in edge map
   */
  private async checkRectangularStructure(
    edgePixels: Uint8Array,
    width: number,
    height: number
  ): Promise<number> {
    // Sample edge density at borders vs interior
    const borderWidth = Math.floor(width * 0.1);
    const borderHeight = Math.floor(height * 0.1);

    let borderEdges = 0;
    let borderPixels = 0;
    let interiorEdges = 0;
    let interiorPixels = 0;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = y * width + x;
        const isEdge = edgePixels[idx] > 30;
        const isBorder =
          x < borderWidth ||
          x >= width - borderWidth ||
          y < borderHeight ||
          y >= height - borderHeight;

        if (isBorder) {
          borderPixels++;
          if (isEdge) borderEdges++;
        } else {
          interiorPixels++;
          if (isEdge) interiorEdges++;
        }
      }
    }

    const borderDensity = borderPixels > 0 ? borderEdges / borderPixels : 0;
    const interiorDensity = interiorPixels > 0 ? interiorEdges / interiorPixels : 0;

    // Cards typically have higher edge density at borders
    // and text content in interior
    if (borderDensity > 0 && interiorDensity > 0) {
      // Mild preference for border edges, but not too extreme
      const ratio = borderDensity / interiorDensity;
      if (ratio > 0.8 && ratio < 3) {
        return 0.8;
      } else if (ratio > 0.5 && ratio < 5) {
        return 0.5;
      }
    }

    return 0.3;
  }

  /**
   * Check if image size is appropriate for a card scan
   */
  private checkImageSize(width: number, height: number): number {
    const minDimension = Math.min(width, height);
    const maxDimension = Math.max(width, height);

    // Typical card scans are 300-2000px
    const minSizeScore =
      minDimension >= 300 ? 1 : minDimension >= 200 ? 0.7 : minDimension >= 100 ? 0.4 : 0.2;

    // Very large images (>4000px) might be full page scans, not cards
    const maxSizeScore =
      maxDimension <= 2500 ? 1 : maxDimension <= 4000 ? 0.7 : maxDimension <= 6000 ? 0.4 : 0.2;

    return (minSizeScore + maxSizeScore) / 2;
  }

  /**
   * Detect card boundaries within the image
   */
  private async detectBoundaries(
    imageBuffer: Buffer,
    width: number,
    height: number
  ): Promise<CardBoundaries | undefined> {
    try {
      // For now, return full image boundaries
      // In a more sophisticated implementation, we would use
      // contour detection to find the actual card edges
      return {
        topLeft: { x: 0, y: 0 },
        topRight: { x: width, y: 0 },
        bottomLeft: { x: 0, y: height },
        bottomRight: { x: width, y: height },
      };
    } catch (error) {
      logger.warn('Boundary detection failed', { error });
      return undefined;
    }
  }
}
