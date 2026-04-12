/**
 * AbstractAPI Enrichment Service
 *
 * Enriches contact data using AbstractAPI's Phone and Email validation APIs.
 * Provides phone validation, email validation, and geolocation data.
 *
 * @module infrastructure/external/enrichment/AbstractAPIService
 */

import { logger } from '../../../shared/logger';
import { config } from '../../../config';

/**
 * AbstractAPI Phone Validation Response
 */
interface AbstractAPIPhoneResponse {
  valid: boolean;
  phone: string;
  format: {
    international: string;
    local: string;
  };
  country: {
    code: string;
    name: string;
    prefix: string;
  };
  location: string;
  type: 'mobile' | 'landline' | 'satellite' | 'voip' | 'toll_free' | 'premium_rate' | 'unknown';
  carrier: string;
}

/**
 * AbstractAPI Email Validation Response
 */
interface AbstractAPIEmailResponse {
  email: string;
  autocorrect: string;
  deliverability: 'DELIVERABLE' | 'UNDELIVERABLE' | 'UNKNOWN' | 'RISKY';
  quality_score: number;
  is_valid_format: { value: boolean; text: string };
  is_free_email: { value: boolean; text: string };
  is_disposable_email: { value: boolean; text: string };
  is_role_email: { value: boolean; text: string };
  is_catchall_email: { value: boolean; text: string };
  is_mx_found: { value: boolean; text: string };
  is_smtp_valid: { value: boolean; text: string };
}

/**
 * Phone enrichment result
 */
export interface PhoneEnrichmentResult {
  success: boolean;
  data?: {
    phone: string;
    internationalFormat: string;
    localFormat: string;
    countryCode: string;
    countryName: string;
    location: string;
    carrier: string;
    type: string;
    valid: boolean;
  };
  error?: string;
  processingTimeMs: number;
}

/**
 * Email enrichment result
 */
export interface EmailEnrichmentResult {
  success: boolean;
  data?: {
    email: string;
    deliverability: string;
    qualityScore: number;
    isValidFormat: boolean;
    isFreeEmail: boolean;
    isDisposable: boolean;
    isRoleEmail: boolean;
    isCatchall: boolean;
    hasMxRecord: boolean;
    isSmtpValid: boolean;
    autocorrect?: string;
  };
  error?: string;
  processingTimeMs: number;
}

/**
 * AbstractAPI Enrichment Service
 *
 * Uses AbstractAPI to validate and enrich phone numbers and email addresses.
 */
export class AbstractAPIService {
  private apiKey: string | undefined;
  private phoneBaseUrl = 'https://phonevalidation.abstractapi.com/v1';
  private emailBaseUrl = 'https://emailvalidation.abstractapi.com/v1';

  constructor() {
    this.apiKey = config.ai.abstractapi?.apiKey;

    if (this.apiKey) {
      logger.info('AbstractAPI service configured');
    } else {
      logger.warn('AbstractAPI service not configured - missing API key');
    }
  }

  /**
   * Check if AbstractAPI service is available
   */
  async isAvailable(): Promise<boolean> {
    return !!this.apiKey;
  }

  /**
   * Validate and enrich a phone number
   *
   * @param phone - Phone number to validate
   * @returns Phone enrichment result
   */
  async enrichPhone(phone: string): Promise<PhoneEnrichmentResult> {
    if (!this.apiKey) {
      return {
        success: false,
        error: 'AbstractAPI service not configured',
        processingTimeMs: 0,
      };
    }

    const startTime = Date.now();

    try {
      // Clean phone number
      const cleanPhone = phone.replace(/[\s\-\(\)]/g, '');

      const params = new URLSearchParams({
        api_key: this.apiKey,
        phone: cleanPhone,
      });

      const response = await fetch(`${this.phoneBaseUrl}?${params.toString()}`);

      const processingTimeMs = Date.now() - startTime;

      if (!response.ok) {
        const errorText = await response.text();
        return {
          success: false,
          error: `AbstractAPI error: ${response.status} - ${errorText}`,
          processingTimeMs,
        };
      }

      const result = await response.json() as AbstractAPIPhoneResponse & { error?: { message: string } };

      // Check for API error
      if ('error' in result && result.error) {
        return {
          success: false,
          error: result.error.message || 'AbstractAPI error',
          processingTimeMs,
        };
      }

      return {
        success: true,
        data: {
          phone: result.phone,
          internationalFormat: result.format?.international || cleanPhone,
          localFormat: result.format?.local || cleanPhone,
          countryCode: result.country?.code || '',
          countryName: result.country?.name || '',
          location: result.location || '',
          carrier: result.carrier || '',
          type: result.type || 'unknown',
          valid: result.valid,
        },
        processingTimeMs,
      };
    } catch (error) {
      logger.error('AbstractAPI phone enrichment failed', { error, phone });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        processingTimeMs: Date.now() - startTime,
      };
    }
  }

  /**
   * Validate and enrich an email address
   *
   * @param email - Email address to validate
   * @returns Email enrichment result
   */
  async enrichEmail(email: string): Promise<EmailEnrichmentResult> {
    if (!this.apiKey) {
      return {
        success: false,
        error: 'AbstractAPI service not configured',
        processingTimeMs: 0,
      };
    }

    const startTime = Date.now();

    try {
      const params = new URLSearchParams({
        api_key: this.apiKey,
        email: email.trim().toLowerCase(),
      });

      const response = await fetch(`${this.emailBaseUrl}?${params.toString()}`);

      const processingTimeMs = Date.now() - startTime;

      if (!response.ok) {
        const errorText = await response.text();
        return {
          success: false,
          error: `AbstractAPI error: ${response.status} - ${errorText}`,
          processingTimeMs,
        };
      }

      const result = await response.json() as AbstractAPIEmailResponse & { error?: { message: string } };

      // Check for API error
      if ('error' in result && result.error) {
        return {
          success: false,
          error: result.error.message || 'AbstractAPI error',
          processingTimeMs,
        };
      }

      return {
        success: true,
        data: {
          email: result.email,
          deliverability: result.deliverability,
          qualityScore: result.quality_score,
          isValidFormat: result.is_valid_format?.value ?? false,
          isFreeEmail: result.is_free_email?.value ?? false,
          isDisposable: result.is_disposable_email?.value ?? false,
          isRoleEmail: result.is_role_email?.value ?? false,
          isCatchall: result.is_catchall_email?.value ?? false,
          hasMxRecord: result.is_mx_found?.value ?? false,
          isSmtpValid: result.is_smtp_valid?.value ?? false,
          autocorrect: result.autocorrect || undefined,
        },
        processingTimeMs,
      };
    } catch (error) {
      logger.error('AbstractAPI email enrichment failed', { error, email });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        processingTimeMs: Date.now() - startTime,
      };
    }
  }

  /**
   * Check if an email is deliverable
   */
  async isEmailDeliverable(email: string): Promise<boolean> {
    const result = await this.enrichEmail(email);
    return result.success && result.data?.deliverability === 'DELIVERABLE';
  }

  /**
   * Check if a phone number is valid
   */
  async isPhoneValid(phone: string): Promise<boolean> {
    const result = await this.enrichPhone(phone);
    return result.success && result.data?.valid === true;
  }
}
