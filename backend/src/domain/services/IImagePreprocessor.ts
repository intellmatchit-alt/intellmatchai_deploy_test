/**
 * Image Preprocessor Service Interface
 *
 * Defines the contract for business card image preprocessing services.
 * Handles card detection, quality assessment, and image enhancement
 * before OCR processing.
 *
 * @module domain/services/IImagePreprocessor
 */

/**
 * Input for preprocessing
 */
export interface PreprocessInput {
  /** Base64 encoded image data */
  imageData: string;

  /** Image MIME type */
  mimeType: string;
}

/**
 * Boundary coordinates for detected card
 */
export interface CardBoundaries {
  topLeft: { x: number; y: number };
  topRight: { x: number; y: number };
  bottomLeft: { x: number; y: number };
  bottomRight: { x: number; y: number };
}

/**
 * Card detection result
 */
export interface CardDetectionResult {
  /** Whether the image appears to be a business card */
  isBusinessCard: boolean;

  /** Confidence score (0-1) */
  confidence: number;

  /** Detected card boundaries if found */
  boundaries?: CardBoundaries;

  /** Reason for classification */
  reason?: string;
}

/**
 * Image quality issue types
 */
export type QualityIssueType = 'blur' | 'low_contrast' | 'low_brightness' | 'high_brightness' | 'low_resolution';

/**
 * Individual quality issue
 */
export interface QualityIssue {
  /** Type of quality issue */
  type: QualityIssueType;

  /** Severity: low, medium, high */
  severity: 'low' | 'medium' | 'high';

  /** Human-readable description */
  description: string;
}

/**
 * Image quality assessment result
 */
export interface ImageQualityResult {
  /** Overall quality score (0-1) */
  score: number;

  /** Whether the image is usable for OCR */
  isUsable: boolean;

  /** List of detected quality issues */
  issues: QualityIssue[];

  /** Suggestions for improvement */
  suggestions: string[];

  /** Quality metrics */
  metrics: {
    brightness: number;
    contrast: number;
    sharpness: number;
    resolution: { width: number; height: number };
  };
}

/**
 * Image size dimensions
 */
export interface ImageSize {
  width: number;
  height: number;
}

/**
 * Preprocessing metadata
 */
export interface PreprocessMetadata {
  /** Original image dimensions */
  originalSize: ImageSize;

  /** Processed image dimensions */
  processedSize: ImageSize;

  /** Total processing time in milliseconds */
  processingTimeMs: number;

  /** List of transformations applied */
  transformationsApplied: string[];
}

/**
 * Complete preprocessing result
 */
export interface PreprocessResult {
  /** Processed base64 image data */
  processedImageData: string;

  /** Output MIME type */
  mimeType: string;

  /** Card detection results */
  cardDetection: CardDetectionResult;

  /** Quality assessment results */
  quality: ImageQualityResult;

  /** Processing metadata */
  metadata: PreprocessMetadata;

  /** Warnings generated during processing */
  warnings: string[];
}

/**
 * Image Preprocessor Service Interface
 *
 * Strategy pattern interface for image preprocessing implementations.
 * Provides card classification, quality assessment, and image enhancement
 * to improve OCR accuracy.
 */
export interface IImagePreprocessor {
  /**
   * Process an image through the full preprocessing pipeline
   *
   * Pipeline steps:
   * 1. Classify if image is a business card
   * 2. Assess image quality
   * 3. Detect card borders (if applicable)
   * 4. Crop to card region
   * 5. Correct perspective/skew
   * 6. Enhance image quality
   *
   * @param input - Image data and MIME type
   * @returns Processed image with metadata
   */
  process(input: PreprocessInput): Promise<PreprocessResult>;

  /**
   * Classify whether an image is a business card
   *
   * Uses aspect ratio analysis and edge detection to determine
   * if the image contains a business card.
   *
   * @param imageData - Base64 encoded image data
   * @param mimeType - Image MIME type
   * @returns Classification result with confidence
   */
  classifyCard(imageData: string, mimeType: string): Promise<CardDetectionResult>;

  /**
   * Assess the quality of an image for OCR
   *
   * Checks brightness, contrast, sharpness, and resolution
   * to determine if the image is suitable for text extraction.
   *
   * @param imageData - Base64 encoded image data
   * @param mimeType - Image MIME type
   * @returns Quality assessment with issues and suggestions
   */
  assessQuality(imageData: string, mimeType: string): Promise<ImageQualityResult>;

  /**
   * Check if the preprocessor service is available
   *
   * @returns True if service can process requests
   */
  isAvailable(): Promise<boolean>;
}
