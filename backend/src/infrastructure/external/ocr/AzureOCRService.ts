/**
 * Azure Document Intelligence OCR Service
 *
 * Cloud OCR implementation using Azure AI Document Intelligence.
 * Provides enhanced business card extraction compared to Tesseract.
 *
 * @module infrastructure/external/ocr/AzureOCRService
 */

import { IOCRService, OCRResult, ExtractedCardFields } from '../../../domain/services/IOCRService';
import { logger } from '../../../shared/logger';
import { config } from '../../../config';

/**
 * Azure Document Intelligence configuration
 */
interface AzureConfig {
  endpoint: string;
  apiKey: string;
  apiKey2?: string;
}

/**
 * Azure OCR Service Implementation
 *
 * Uses Azure AI Document Intelligence for business card extraction.
 * Supports key rotation with primary and secondary keys.
 */
export class AzureOCRService implements IOCRService {
  private config: AzureConfig | null = null;
  private useSecondaryKey = false;

  constructor() {
    // Load configuration from config module
    const endpoint = config.ai.azure.endpoint;
    const apiKey = config.ai.azure.key;
    const apiKey2 = config.ai.azure.key2;

    if (endpoint && apiKey) {
      this.config = { endpoint, apiKey, apiKey2 };
      logger.info('Azure OCR service configured', {
        endpoint: endpoint.substring(0, 30) + '...',
        hasSecondaryKey: !!apiKey2,
      });
    } else {
      logger.warn('Azure OCR service not configured - missing credentials');
    }
  }

  /**
   * Get the current API key (supports failover to secondary)
   */
  private getApiKey(): string {
    if (!this.config) throw new Error('Azure OCR not configured');
    if (this.useSecondaryKey && this.config.apiKey2) {
      return this.config.apiKey2;
    }
    return this.config.apiKey;
  }

  /**
   * Switch to secondary key on failure
   */
  private switchToSecondaryKey(): boolean {
    if (this.config?.apiKey2 && !this.useSecondaryKey) {
      logger.info('Switching to secondary Azure API key');
      this.useSecondaryKey = true;
      return true;
    }
    return false;
  }

  /**
   * Check if Azure service is available
   */
  async isAvailable(): Promise<boolean> {
    if (!this.config) {
      return false;
    }

    try {
      // Use the operations endpoint to verify connectivity
      // This is a lightweight check that validates the API key
      const response = await fetch(
        `${this.config.endpoint}/formrecognizer/documentModels?api-version=2023-07-31`,
        {
          method: 'GET',
          headers: {
            'Ocp-Apim-Subscription-Key': this.getApiKey(),
          },
        }
      );

      if (response.status === 401 || response.status === 403) {
        // Try secondary key
        if (this.switchToSecondaryKey()) {
          const retryResponse = await fetch(
            `${this.config.endpoint}/formrecognizer/documentModels?api-version=2023-07-31`,
            {
              method: 'GET',
              headers: {
                'Ocp-Apim-Subscription-Key': this.getApiKey(),
              },
            }
          );
          return retryResponse.ok;
        }
        return false;
      }

      return response.ok;
    } catch (error) {
      logger.error('Azure OCR availability check failed', { error });
      return false;
    }
  }

  /**
   * Extract text and fields from a business card image
   */
  async extractFromCard(imageData: string, mimeType: string): Promise<OCRResult> {
    if (!this.config) {
      throw new Error('Azure OCR service not configured');
    }

    const startTime = Date.now();
    const warnings: string[] = [];

    try {
      // Convert base64 to buffer
      const imageBuffer = Buffer.from(imageData, 'base64');

      // Call Azure Document Intelligence API
      let analyzeResponse = await fetch(
        `${this.config.endpoint}/formrecognizer/documentModels/prebuilt-businessCard:analyze?api-version=2023-07-31`,
        {
          method: 'POST',
          headers: {
            'Content-Type': mimeType,
            'Ocp-Apim-Subscription-Key': this.getApiKey(),
          },
          body: imageBuffer,
        }
      );

      // Try secondary key on auth failure
      if ((analyzeResponse.status === 401 || analyzeResponse.status === 403) && this.switchToSecondaryKey()) {
        analyzeResponse = await fetch(
          `${this.config.endpoint}/formrecognizer/documentModels/prebuilt-businessCard:analyze?api-version=2023-07-31`,
          {
            method: 'POST',
            headers: {
              'Content-Type': mimeType,
              'Ocp-Apim-Subscription-Key': this.getApiKey(),
            },
            body: imageBuffer,
          }
        );
      }

      if (!analyzeResponse.ok) {
        const errorBody = await analyzeResponse.text();
        throw new Error(`Azure API error: ${analyzeResponse.status} - ${errorBody}`);
      }

      // Get operation location for polling
      const operationLocation = analyzeResponse.headers.get('Operation-Location');
      if (!operationLocation) {
        throw new Error('No operation location returned');
      }

      // Poll for result
      const result = await this.pollForResult(operationLocation);

      // Extract fields from Azure response
      const fields = this.parseAzureResponse(result);
      fields.rawText = this.extractRawText(result);

      // Calculate confidence
      fields.confidence = this.calculateConfidence(result);

      if (fields.confidence < 0.7) {
        warnings.push('Lower confidence extraction - please verify fields');
      }

      return {
        fields,
        processingTimeMs: Date.now() - startTime,
        engine: 'azure',
        warnings: warnings.length > 0 ? warnings : undefined,
      };
    } catch (error: any) {
      logger.error('Azure OCR extraction failed', {
        message: error?.message || 'Unknown error',
        status: error?.status,
        code: error?.code,
        stack: error?.stack?.split('\n')[0],
      });
      throw error;
    }
  }

  /**
   * Poll Azure API for operation result
   */
  private async pollForResult(operationLocation: string): Promise<any> {
    const maxAttempts = 30;
    const pollInterval = 1000; // 1 second

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const response = await fetch(operationLocation, {
        method: 'GET',
        headers: {
          'Ocp-Apim-Subscription-Key': this.getApiKey(),
        },
      });

      if (!response.ok) {
        throw new Error(`Polling failed: ${response.status}`);
      }

      const result = await response.json() as { status: string; analyzeResult?: any };

      if (result.status === 'succeeded') {
        return result.analyzeResult;
      }

      if (result.status === 'failed') {
        throw new Error('Analysis failed');
      }

      // Wait before next poll
      await new Promise((resolve) => setTimeout(resolve, pollInterval));
    }

    throw new Error('Polling timeout');
  }

  /**
   * Parse Azure response into ExtractedCardFields
   */
  private parseAzureResponse(result: any): ExtractedCardFields {
    const fields: ExtractedCardFields = {
      rawText: '',
      confidence: 0,
    };

    const documents = result.documents || [];
    if (documents.length === 0) {
      return fields;
    }

    const doc = documents[0];
    const docFields = doc.fields || {};

    // Extract name (ContactNames field)
    if (docFields.ContactNames?.valueArray?.[0]) {
      const nameField = docFields.ContactNames.valueArray[0].valueObject;
      const firstName = nameField?.FirstName?.content || '';
      const lastName = nameField?.LastName?.content || '';
      fields.name = this.cleanName(`${firstName} ${lastName}`.trim());
    }

    // Extract company names
    if (docFields.CompanyNames?.valueArray?.[0]) {
      fields.company = this.cleanGenericField(docFields.CompanyNames.valueArray[0].content);
    }

    // Extract job titles
    if (docFields.JobTitles?.valueArray?.[0]) {
      fields.jobTitle = this.cleanGenericField(docFields.JobTitles.valueArray[0].content);
    }

    // Extract emails - with bullet point cleaning
    if (docFields.Emails?.valueArray?.[0]) {
      fields.email = this.cleanEmail(docFields.Emails.valueArray[0].content);
    }

    // Extract phone numbers - with bullet point cleaning
    if (docFields.WorkPhones?.valueArray?.[0]) {
      fields.phone = this.cleanPhone(docFields.WorkPhones.valueArray[0].content);
    } else if (docFields.MobilePhones?.valueArray?.[0]) {
      fields.phone = this.cleanPhone(docFields.MobilePhones.valueArray[0].content);
    }

    // Extract websites
    if (docFields.Websites?.valueArray?.[0]) {
      fields.website = this.cleanWebsite(docFields.Websites.valueArray[0].content);
    }

    // Extract addresses
    if (docFields.Addresses?.valueArray?.[0]) {
      fields.address = this.cleanGenericField(docFields.Addresses.valueArray[0].content);
    }

    return fields;
  }

  /**
   * Clean email - remove bullet points and OCR artifacts
   */
  private cleanEmail(raw: string | undefined): string | undefined {
    if (!raw) return undefined;

    let email = raw.toLowerCase().trim();

    // Remove bullet characters
    email = email.replace(/[•·●○▪▫◦◉◎■□★☆►▶→⁃‣⦿⦾©®™]/g, '');

    // Remove leading/trailing non-alphanumeric (except @, ., -, _)
    email = email.replace(/^[^a-z0-9]+/, '').replace(/[^a-z0-9]+$/, '');

    // Known good email prefixes - don't strip from these
    const knownPrefixes = ['ceo', 'cto', 'cfo', 'coo', 'cio', 'cmo', 'info', 'admin', 'hello', 'sales', 'support', 'contact', 'hr', 'marketing', 'office', 'team', 'mail', 'enquiry', 'service', 'help'];

    // Check if email already starts with a known prefix - don't modify it
    const [currentLocal] = email.split('@');
    const startsWithKnown = knownPrefixes.some(p => currentLocal === p || currentLocal?.startsWith(p + '.') || currentLocal?.startsWith(p + '_'));

    if (!startsWithKnown && email.length > 4) {
      // OCR often reads bullet ● as: d, o, 9, 0, a, e, O, D
      // Only remove if first char is suspicious AND removing it gives a known prefix
      const firstChar = email[0];
      const suspiciousChars = ['d', 'o', '9', '0', 'a', 'e', 'q', 'g'];

      if (suspiciousChars.includes(firstChar)) {
        const rest = email.slice(1);
        const [restLocal] = rest.split('@');

        // Only remove if the rest matches a known prefix exactly
        const restMatchesKnown = knownPrefixes.some(p => restLocal === p || restLocal?.startsWith(p + '.') || restLocal?.startsWith(p + '_'));

        if (restMatchesKnown) {
          email = rest;
        }
      }
    }

    return email || undefined;
  }

  /**
   * Clean phone - remove bullet points and format properly
   */
  private cleanPhone(raw: string | undefined): string | undefined {
    if (!raw) return undefined;

    let phone = raw.trim();

    // Remove bullet characters
    phone = phone.replace(/[•·●○▪▫◦◉◎■□★☆►▶→⁃‣⦿⦾©®™]/g, '');

    // Remove leading characters that might be misread bullets (but keep + for intl)
    phone = phone.replace(/^[doODaecqlj]+\s*/i, '');

    // Extract digits
    const hasPlus = phone.includes('+');
    let digits = phone.replace(/\D/g, '');

    // Bullet ● is often read as 9, 0, o, d by OCR
    // Pattern: 9 + 00 + country code (like 900962...) - remove leading 9
    // Common country codes: 962 (Jordan), 971 (UAE), 966 (Saudi), 20 (Egypt), etc.
    const bulletAs9Pattern = /^9(00(?:962|971|966|974|973|968|965|964|963|961|20|212|216|218))/;
    const match9 = digits.match(bulletAs9Pattern);
    if (match9) {
      digits = digits.slice(1); // Remove the leading 9 (it was a bullet)
    }

    // Also check for 0 + 00 + country code (bullet read as 0)
    if (digits.startsWith('000') && digits.length > 13) {
      // Check if removing first 0 gives valid intl format
      const withoutFirst = digits.slice(1);
      if (/^00(962|971|966|974|973|968|965|964|963|961|20|212|216|218)/.test(withoutFirst)) {
        digits = withoutFirst;
      }
    }

    // Validate length
    if (digits.length < 7 || digits.length > 15) {
      return raw.trim(); // Return original if can't parse
    }

    // Format international numbers starting with 00
    if (digits.startsWith('00') && digits.length >= 12) {
      const countryCode = digits.slice(2, 5);
      const rest = digits.slice(5);
      if (rest.length >= 9) {
        return '+' + countryCode + ' ' + rest.slice(0, 2) + ' ' + rest.slice(2, 5) + ' ' + rest.slice(5);
      }
      return '+' + countryCode + ' ' + rest;
    }

    // Format with + if originally had it
    if (hasPlus && !digits.startsWith('00')) {
      return '+' + digits;
    }

    return phone.replace(/\s+/g, ' ').trim();
  }

  /**
   * Clean website URL
   */
  private cleanWebsite(raw: string | undefined): string | undefined {
    if (!raw) return undefined;

    let url = raw.trim();

    // Remove bullet characters
    url = url.replace(/[•·●○▪▫◦◉◎■□★☆►▶→⁃‣⦿⦾]/g, '');

    // Remove leading suspicious chars before www or http
    url = url.replace(/^[doODaecqlj]+\s*(?=www\.|http)/i, '');

    return url.trim() || undefined;
  }

  /**
   * Clean name field
   */
  private cleanName(raw: string | undefined): string | undefined {
    if (!raw) return undefined;

    let name = raw.trim();

    // Remove bullet characters
    name = name.replace(/[•·●○▪▫◦◉◎■□★☆►▶→⁃‣⦿⦾]/g, '');

    // Remove leading/trailing non-letter chars
    name = name.replace(/^[^a-zA-Z\u0600-\u06FF]+/, '').replace(/[^a-zA-Z\u0600-\u06FF]+$/, '');

    return name.trim() || undefined;
  }

  /**
   * Clean generic field
   */
  private cleanGenericField(raw: string | undefined): string | undefined {
    if (!raw) return undefined;

    let value = raw.trim();

    // Remove bullet characters
    value = value.replace(/[•·●○▪▫◦◉◎■□★☆►▶→⁃‣⦿⦾]/g, '');

    // Remove leading non-alphanumeric
    value = value.replace(/^[^a-zA-Z0-9\u0600-\u06FF]+/, '');

    return value.trim() || undefined;
  }

  /**
   * Extract raw text from Azure response
   */
  private extractRawText(result: any): string {
    const content = result.content || '';
    return content;
  }

  /**
   * Calculate overall confidence from Azure response
   */
  private calculateConfidence(result: any): number {
    const documents = result.documents || [];
    if (documents.length === 0) {
      return 0;
    }

    const doc = documents[0];
    return doc.confidence || 0.5;
  }
}
