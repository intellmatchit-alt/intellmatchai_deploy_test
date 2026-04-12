/**
 * Google Cloud Vision OCR Service
 *
 * Cloud OCR implementation using Google Cloud Vision API.
 * Provides high-quality text extraction from business cards.
 *
 * @module infrastructure/external/ocr/GoogleVisionOCRService
 */

import { IOCRService, OCRResult, ExtractedCardFields } from '../../../domain/services/IOCRService';
import { logger } from '../../../shared/logger';
import { config } from '../../../config';

/**
 * Google Vision OCR Service Implementation
 *
 * Uses Google Cloud Vision API for text extraction from images.
 */
export class GoogleVisionOCRService implements IOCRService {
  private apiKey: string | null = null;

  constructor() {
    const apiKey = config.ai.googleVision?.apiKey;

    if (apiKey) {
      this.apiKey = apiKey;
      logger.info('Google Vision OCR service configured');
    } else {
      logger.warn('Google Vision OCR service not configured - missing API key');
    }
  }

  /**
   * Check if Google Vision service is available
   */
  async isAvailable(): Promise<boolean> {
    if (!this.apiKey) {
      return false;
    }

    try {
      // Simple test to verify API key works
      const response = await fetch(
        `https://vision.googleapis.com/v1/images:annotate?key=${this.apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            requests: [{
              image: { content: '' },
              features: [{ type: 'TEXT_DETECTION', maxResults: 1 }],
            }],
          }),
        }
      );
      // Even with empty image, valid API key returns 200 with error in body
      return response.status !== 403 && response.status !== 401;
    } catch (error) {
      logger.error('Google Vision availability check failed', { error });
      return false;
    }
  }

  /**
   * Extract text and fields from a business card image
   */
  async extractFromCard(imageData: string, mimeType: string): Promise<OCRResult> {
    if (!this.apiKey) {
      throw new Error('Google Vision OCR service not configured');
    }

    const startTime = Date.now();
    const warnings: string[] = [];

    try {
      // Call Google Vision API
      const response = await fetch(
        `https://vision.googleapis.com/v1/images:annotate?key=${this.apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            requests: [{
              image: { content: imageData },
              features: [
                { type: 'TEXT_DETECTION' },
                { type: 'DOCUMENT_TEXT_DETECTION' },
              ],
            }],
          }),
        }
      );

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Google Vision API error: ${response.status} - ${error}`);
      }

      const result = await response.json() as { responses: any[] };
      const textAnnotations = result.responses?.[0]?.textAnnotations || [];
      const fullTextAnnotation = result.responses?.[0]?.fullTextAnnotation;

      // Get raw text
      const rawText = textAnnotations[0]?.description || fullTextAnnotation?.text || '';

      // Parse fields from raw text
      const fields = this.parseTextToFields(rawText);
      fields.rawText = rawText;

      // Calculate confidence
      const confidence = this.calculateConfidence(result.responses?.[0]);
      fields.confidence = confidence;

      if (confidence < 0.7) {
        warnings.push('Lower confidence extraction - please verify fields');
      }

      return {
        fields,
        processingTimeMs: Date.now() - startTime,
        engine: 'google',
        warnings: warnings.length > 0 ? warnings : undefined,
      };
    } catch (error) {
      logger.error('Google Vision OCR extraction failed', { error });
      throw error;
    }
  }

  /**
   * Parse raw text into structured fields
   */
  private parseTextToFields(rawText: string): ExtractedCardFields {
    const fields: ExtractedCardFields = {
      rawText: '',
      confidence: 0,
    };

    const lines = rawText.split('\n').map((l) => l.trim()).filter(Boolean);

    // Email pattern
    const emailMatch = rawText.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/i);
    if (emailMatch) {
      fields.email = emailMatch[0].toLowerCase();
    }

    // Phone pattern (various formats)
    const phoneMatch = rawText.match(/(\+?[\d\s\-().]{10,})/);
    if (phoneMatch) {
      fields.phone = phoneMatch[1].replace(/\s+/g, ' ').trim();
    }

    // Website pattern
    const websiteMatch = rawText.match(/(https?:\/\/)?([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}(\/\S*)?/i);
    if (websiteMatch && !websiteMatch[0].includes('@')) {
      fields.website = websiteMatch[0];
      if (!fields.website.startsWith('http')) {
        fields.website = 'https://' + fields.website;
      }
    }

    // Try to find name (usually first line or line with capital letters)
    for (const line of lines.slice(0, 3)) {
      // Skip if line looks like company/title/contact info
      if (
        line.includes('@') ||
        line.match(/^\+?\d/) ||
        line.toLowerCase().includes('www.') ||
        line.toLowerCase().includes('.com')
      ) {
        continue;
      }
      // Check if it looks like a name (mostly letters, possibly with spaces)
      if (line.match(/^[A-Za-z\s.'-]{2,50}$/) && line.includes(' ')) {
        fields.name = line;
        break;
      }
    }

    // Try to find company (often has Inc, LLC, Ltd, Corp, or is in caps)
    for (const line of lines) {
      if (
        line.match(/\b(Inc|LLC|Ltd|Corp|Company|Co\.|Group|Holdings|Partners)\b/i) ||
        (line === line.toUpperCase() && line.length > 3 && !line.match(/^\d/))
      ) {
        if (line !== fields.name) {
          fields.company = line;
          break;
        }
      }
    }

    // Try to find job title (common keywords)
    const titleKeywords = [
      'CEO', 'CTO', 'CFO', 'COO', 'Director', 'Manager', 'Engineer',
      'Developer', 'Designer', 'Analyst', 'Consultant', 'Executive',
      'President', 'Vice President', 'VP', 'Head', 'Lead', 'Senior',
      'Partner', 'Associate', 'Specialist', 'Coordinator', 'Officer',
    ];
    for (const line of lines) {
      for (const keyword of titleKeywords) {
        if (line.toLowerCase().includes(keyword.toLowerCase())) {
          if (line !== fields.name && line !== fields.company) {
            fields.jobTitle = line;
            break;
          }
        }
      }
      if (fields.jobTitle) break;
    }

    return fields;
  }

  /**
   * Calculate confidence from Google Vision response
   */
  private calculateConfidence(response: any): number {
    if (!response) return 0;

    // Use page confidence if available
    const pages = response.fullTextAnnotation?.pages || [];
    if (pages.length > 0 && pages[0].confidence) {
      return pages[0].confidence;
    }

    // Fallback: if we got text, assume decent confidence
    const textAnnotations = response.textAnnotations || [];
    if (textAnnotations.length > 0) {
      return 0.8;
    }

    return 0;
  }
}
