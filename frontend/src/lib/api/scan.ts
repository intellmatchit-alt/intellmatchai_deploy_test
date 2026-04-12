/**
 * Scan API
 *
 * API functions for business card scanning endpoints.
 *
 * @module lib/api/scan
 */

import { api } from './client';
import { Contact } from './contacts';

/**
 * Preprocessing information
 */
export interface PreprocessingInfo {
  applied: boolean;
  processingTimeMs?: number;
  cardConfidence?: number;
  qualityScore?: number;
  transformations?: string[];
  rotationAngle?: number;
  originalSize?: { width: number; height: number };
  processedSize?: { width: number; height: number };
  /** Cleaned/processed image as base64 for saving */
  processedImageData?: string;
  processedMimeType?: string;
}

/**
 * OCR scan result
 */
export interface ScanResult {
  fields: {
    name?: string;
    email?: string;
    phone?: string;
    company?: string;
    jobTitle?: string;
    website?: string;
    linkedInUrl?: string;
  };
  rawText: string;
  confidence: number;
  processingTimeMs: number;
  warnings?: string[];
  preprocessing?: PreprocessingInfo;
}

/**
 * Confirm scan input
 */
export interface ConfirmScanInput {
  name: string;
  email?: string;
  phone?: string;
  company?: string;
  jobTitle?: string;
  website?: string;
  cardImageUrl: string;
  sectors?: string[];
}

/**
 * Sector suggestion result
 */
export interface SectorSuggestion {
  suggestedSectors: string[];
  message?: string;
}

/**
 * Scan a business card image
 *
 * @param imageData - Base64 encoded image data
 * @param mimeType - Image MIME type (image/jpeg, image/png)
 */
export function scanCard(imageData: string, mimeType: string): Promise<ScanResult> {
  return api.post<ScanResult>('/scan/card', { imageData, mimeType });
}

/**
 * Confirm scanned fields and create contact
 */
export function confirmScan(input: ConfirmScanInput): Promise<Contact> {
  return api.post<Contact>('/scan/confirm', input);
}

/**
 * Get AI-suggested sectors based on company/job title
 */
export function suggestSectors(
  company?: string,
  jobTitle?: string
): Promise<SectorSuggestion> {
  return api.post<SectorSuggestion>('/scan/suggest-sectors', {
    company,
    jobTitle,
  });
}

/**
 * Upload card image (returns URL)
 */
export function uploadCardImage(
  imageData: string,
  mimeType: string
): Promise<{ url: string }> {
  return api.post<{ url: string }>('/scan/upload', { imageData, mimeType });
}

/**
 * Convert file to base64
 */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Remove data URL prefix to get pure base64
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
