/**
 * OpenAI Vision OCR Service
 *
 * Uses GPT-4o vision to extract business card fields directly from images.
 * Replaces Azure OCR by sending the image to OpenAI's multimodal model.
 *
 * @module infrastructure/external/ocr/OpenAIVisionOCRService
 */

import { IOCRService, OCRResult, ExtractedCardFields } from '../../../domain/services/IOCRService';
import { logger } from '../../../shared/logger';
import { config } from '../../../config';

/**
 * OpenAI Vision OCR Service
 *
 * Sends business card images directly to GPT-4o for field extraction.
 */
export class OpenAIVisionOCRService implements IOCRService {
  private apiKey: string | null = null;

  constructor() {
    this.apiKey = config.ai?.openai?.apiKey || null;
    if (this.apiKey) {
      logger.info('OpenAI Vision OCR service configured');
    } else {
      logger.warn('OpenAI Vision OCR service not configured - missing API key');
    }
  }

  /**
   * Check if OpenAI API is available
   */
  async isAvailable(): Promise<boolean> {
    return !!this.apiKey;
  }

  /**
   * Extract text and fields from a business card image using GPT-4o vision
   */
  async extractFromCard(imageData: string, mimeType: string): Promise<OCRResult> {
    if (!this.apiKey) {
      throw new Error('OpenAI Vision OCR not configured');
    }

    const startTime = Date.now();
    const warnings: string[] = [];

    try {
      const dataUrl = `data:${mimeType};base64,${imageData}`;

      const prompt = `You are an expert at reading business cards. Extract ALL text and contact information from this business card image.

RESPOND WITH ONLY A JSON OBJECT - NO OTHER TEXT:
{
  "rawText": "ALL text visible on the card, preserving layout as much as possible",
  "name": "Full name of the person",
  "email": "email@domain.com",
  "phone": "Phone number in international format like +962 79 XXX XXXX",
  "company": "Company/organization name",
  "jobTitle": "Job title/position",
  "website": "Website URL",
  "linkedInUrl": "LinkedIn profile URL if visible (format: https://linkedin.com/in/username)",
  "address": "Physical address if shown",
  "confidence": 0.95
}

IMPORTANT:
- Extract EVERY piece of text visible on the card
- For Arabic text, keep it in original script
- Fix common OCR-like issues (bullet points that look like letters)
- LinkedIn URLs: look for any linkedin.com text, fix variations like "linkedln"
- Phone numbers: include country code if visible
- If a field is not present on the card, use null
- confidence should be 0.0-1.0 based on image clarity`;

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: prompt },
                {
                  type: 'image_url',
                  image_url: { url: dataUrl, detail: 'high' },
                },
              ],
            },
          ],
          temperature: 0.1,
          max_tokens: 1000,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error('OpenAI Vision API error', { status: response.status, error: errorText });
        throw new Error(`OpenAI Vision API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json() as any;
      const content = data.choices?.[0]?.message?.content || '';

      // Parse the JSON response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        logger.error('OpenAI Vision returned non-JSON response', { content: content.substring(0, 200) });
        throw new Error('Failed to parse OpenAI Vision response');
      }

      const parsed = JSON.parse(jsonMatch[0]);

      const fields: ExtractedCardFields = {
        name: parsed.name || undefined,
        email: parsed.email || undefined,
        phone: parsed.phone || undefined,
        company: parsed.company || undefined,
        jobTitle: parsed.jobTitle || undefined,
        website: parsed.website || undefined,
        address: parsed.address || undefined,
        linkedInUrl: parsed.linkedInUrl || undefined,
        rawText: parsed.rawText || '',
        confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.9,
      };

      if (fields.confidence < 0.7) {
        warnings.push('Lower confidence extraction - please verify fields');
      }

      return {
        fields,
        processingTimeMs: Date.now() - startTime,
        engine: 'openai',
        warnings: warnings.length > 0 ? warnings : undefined,
      };
    } catch (error: any) {
      logger.error('OpenAI Vision OCR extraction failed', {
        message: error?.message || 'Unknown error',
        stack: error?.stack?.split('\n')[0],
      });
      throw error;
    }
  }
}
