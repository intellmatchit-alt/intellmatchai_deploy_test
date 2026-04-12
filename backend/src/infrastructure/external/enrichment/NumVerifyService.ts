/**
 * NumVerify Phone Validation Service
 *
 * Validates and enriches phone numbers using the NumVerify API.
 * Provides phone validation, carrier info, and location data.
 *
 * @module infrastructure/external/enrichment/NumVerifyService
 */

import { logger } from '../../../shared/logger';
import { config } from '../../../config';

/**
 * NumVerify API response
 */
interface NumVerifyResponse {
  valid: boolean;
  number: string;
  local_format: string;
  international_format: string;
  country_prefix: string;
  country_code: string;
  country_name: string;
  location: string;
  carrier: string;
  line_type: 'mobile' | 'landline' | 'special_services' | 'toll_free' | 'premium_rate' | null;
}

/**
 * Validation result
 */
export interface PhoneValidationResult {
  success: boolean;
  valid: boolean;
  data?: {
    number: string;
    localFormat: string;
    internationalFormat: string;
    countryCode: string;
    countryName: string;
    location: string;
    carrier: string;
    lineType: string | null;
  };
  error?: string;
  processingTimeMs: number;
}

/**
 * NumVerify Phone Validation Service
 *
 * Uses NumVerify API to validate phone numbers and get carrier/location info.
 */
export class NumVerifyService {
  private apiKey: string | undefined;
  private baseUrl = 'http://apilayer.net/api/validate';

  constructor() {
    this.apiKey = config.ai.numverify?.apiKey;

    if (this.apiKey) {
      logger.info('NumVerify service configured');
    } else {
      logger.warn('NumVerify service not configured - missing API key');
    }
  }

  /**
   * Check if NumVerify service is available
   */
  async isAvailable(): Promise<boolean> {
    return !!this.apiKey;
  }

  /**
   * Validate a phone number
   *
   * @param phone - Phone number to validate (with or without country code)
   * @param countryCode - Optional ISO country code (e.g., 'US', 'SA')
   * @returns Validation result with phone details
   */
  async validatePhone(phone: string, countryCode?: string): Promise<PhoneValidationResult> {
    if (!this.apiKey) {
      return {
        success: false,
        valid: false,
        error: 'NumVerify service not configured',
        processingTimeMs: 0,
      };
    }

    const startTime = Date.now();

    try {
      // Clean phone number (remove spaces, dashes, parentheses)
      const cleanPhone = phone.replace(/[\s\-\(\)]/g, '');

      // Build URL with parameters
      const params = new URLSearchParams({
        access_key: this.apiKey,
        number: cleanPhone,
        format: '1',
      });

      if (countryCode) {
        params.append('country_code', countryCode);
      }

      const response = await fetch(`${this.baseUrl}?${params.toString()}`);

      const processingTimeMs = Date.now() - startTime;

      if (!response.ok) {
        return {
          success: false,
          valid: false,
          error: `NumVerify API error: ${response.status}`,
          processingTimeMs,
        };
      }

      const result = await response.json() as NumVerifyResponse & { error?: { code: number; info: string } };

      // Check for API error response
      if ('error' in result && result.error) {
        return {
          success: false,
          valid: false,
          error: result.error.info || 'NumVerify API error',
          processingTimeMs,
        };
      }

      return {
        success: true,
        valid: result.valid,
        data: {
          number: result.number,
          localFormat: result.local_format,
          internationalFormat: result.international_format,
          countryCode: result.country_code,
          countryName: result.country_name,
          location: result.location,
          carrier: result.carrier,
          lineType: result.line_type,
        },
        processingTimeMs,
      };
    } catch (error) {
      logger.error('NumVerify validation failed', { error, phone });
      return {
        success: false,
        valid: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        processingTimeMs: Date.now() - startTime,
      };
    }
  }

  /**
   * Check if a phone number is valid (simple boolean check)
   */
  async isValidPhone(phone: string): Promise<boolean> {
    const result = await this.validatePhone(phone);
    return result.valid;
  }

  /**
   * Get formatted international phone number
   */
  async getFormattedPhone(phone: string, countryCode?: string): Promise<string | null> {
    const result = await this.validatePhone(phone, countryCode);
    return result.valid && result.data ? result.data.internationalFormat : null;
  }
}
