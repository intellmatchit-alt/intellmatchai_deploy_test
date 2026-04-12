/**
 * OCR Service Interface
 *
 * Defines the contract for optical character recognition services.
 * Implementations can use Tesseract.js (local) or cloud services like Azure.
 *
 * @module domain/services/IOCRService
 */

/**
 * Extracted business card fields
 */
export interface ExtractedCardFields {
  /** Full name extracted from card */
  name?: string;

  /** Email address */
  email?: string;

  /** Phone number(s) */
  phone?: string;

  /** Company/organization name */
  company?: string;

  /** Job title/position */
  jobTitle?: string;

  /** Website URL */
  website?: string;

  /** Physical address */
  address?: string;

  /** LinkedIn URL */
  linkedInUrl?: string;

  /** Raw OCR text for reference */
  rawText: string;

  /** Confidence score (0-1) */
  confidence: number;
}

/**
 * OCR result with extracted fields and metadata
 */
export interface OCRResult {
  /** Extracted and parsed fields */
  fields: ExtractedCardFields;

  /** Processing time in milliseconds */
  processingTimeMs: number;

  /** OCR engine used */
  engine: 'tesseract' | 'azure' | 'google' | 'openai';

  /** Any warnings or issues during extraction */
  warnings?: string[];
}

/**
 * OCR Service Interface
 *
 * Strategy pattern interface for OCR implementations.
 * Allows swapping between local (Tesseract) and cloud (Azure) services.
 */
export interface IOCRService {
  /**
   * Extract text and fields from a business card image
   *
   * @param imageData - Base64 encoded image data or file path
   * @param mimeType - Image MIME type (image/jpeg, image/png)
   * @returns Extracted fields and metadata
   */
  extractFromCard(imageData: string, mimeType: string): Promise<OCRResult>;

  /**
   * Check if the service is available and configured
   *
   * @returns True if service can process requests
   */
  isAvailable(): Promise<boolean>;
}
