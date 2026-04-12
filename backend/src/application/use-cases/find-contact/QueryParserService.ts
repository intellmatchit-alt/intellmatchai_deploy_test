/**
 * Query Parser Service
 *
 * Parses and normalizes search input to detect type and extract structured data.
 * Handles phone numbers, emails, URLs, names, and image classification.
 *
 * @module application/use-cases/find-contact/QueryParserService
 */

import { parsePhoneNumber, isValidPhoneNumber, CountryCode } from 'libphonenumber-js';
import crypto from 'crypto';
import { logger } from '../../../shared/logger';

/**
 * Detected input type
 */
export type InputType = 'phone' | 'email' | 'url' | 'name' | 'image';

/**
 * Image processing mode
 */
export type ImageMode = 'ocr' | 'face';

/**
 * Parsed query result
 */
export interface ParsedQuery {
  raw: string | null;
  type: InputType;
  hash: string;
  parsed: {
    phoneE164?: string;
    phoneCountry?: string;
    email?: string;
    emailDomain?: string;
    url?: string;
    urlType?: 'linkedin' | 'twitter' | 'facebook' | 'website' | 'other';
    linkedinUsername?: string;
    nameTokens?: string[];
    nameNormalized?: string;
    imageKey?: string;
    imageMode?: ImageMode;
  };
}

/**
 * Query Parser Service
 *
 * Detects input type and normalizes for consistent database lookup.
 */
export class QueryParserService {
  private defaultCountry: CountryCode = 'US';

  constructor(defaultCountry?: CountryCode) {
    if (defaultCountry) {
      this.defaultCountry = defaultCountry;
    }
  }

  /**
   * Parse and normalize a search query
   *
   * @param query - Raw query string
   * @param imageKey - Optional image upload key
   * @param imageHasText - Whether the image contains text (for OCR vs face decision)
   * @param consentFaceMatch - Whether user consented to face matching
   * @returns Parsed and normalized query
   */
  parse(
    query: string | null,
    imageKey?: string,
    imageHasText?: boolean,
    consentFaceMatch?: boolean
  ): ParsedQuery {
    // Handle image input
    if (imageKey) {
      const imageMode: ImageMode = imageHasText ? 'ocr' : (consentFaceMatch ? 'face' : 'ocr');
      return {
        raw: null,
        type: 'image',
        hash: this.generateHash(`image:${imageKey}`),
        parsed: {
          imageKey,
          imageMode,
        },
      };
    }

    if (!query || query.trim().length === 0) {
      throw new Error('Query is required when no image is provided');
    }

    const trimmedQuery = query.trim();

    // Detect and parse by type
    if (this.isPhoneNumber(trimmedQuery)) {
      return this.parsePhone(trimmedQuery);
    }

    if (this.isEmail(trimmedQuery)) {
      return this.parseEmail(trimmedQuery);
    }

    if (this.isUrl(trimmedQuery)) {
      return this.parseUrl(trimmedQuery);
    }

    // Default to name
    return this.parseName(trimmedQuery);
  }

  /**
   * Check if input looks like a phone number
   */
  private isPhoneNumber(input: string): boolean {
    // Remove common separators and check for digit density
    const digitsOnly = input.replace(/[\s\-\(\)\+\.]/g, '');
    const digitRatio = digitsOnly.replace(/\D/g, '').length / digitsOnly.length;

    // If mostly digits and reasonable length for a phone number
    if (digitRatio > 0.7 && digitsOnly.length >= 7 && digitsOnly.length <= 15) {
      try {
        return isValidPhoneNumber(input, this.defaultCountry);
      } catch {
        // Try with + prefix if not present
        if (!input.startsWith('+')) {
          try {
            return isValidPhoneNumber(`+${input}`, this.defaultCountry);
          } catch {
            return false;
          }
        }
        return false;
      }
    }
    return false;
  }

  /**
   * Parse phone number to E.164 format
   */
  private parsePhone(input: string): ParsedQuery {
    let phoneE164: string | undefined;
    let phoneCountry: string | undefined;

    try {
      const parsed = parsePhoneNumber(input, this.defaultCountry);
      if (parsed) {
        phoneE164 = parsed.format('E.164');
        phoneCountry = parsed.country;
      }
    } catch {
      // Try with + prefix
      try {
        const parsed = parsePhoneNumber(`+${input}`, this.defaultCountry);
        if (parsed) {
          phoneE164 = parsed.format('E.164');
          phoneCountry = parsed.country;
        }
      } catch (e) {
        logger.warn('Failed to parse phone number', { input, error: e });
      }
    }

    return {
      raw: input,
      type: 'phone',
      hash: this.generateHash(`phone:${phoneE164 || input}`),
      parsed: {
        phoneE164,
        phoneCountry,
      },
    };
  }

  /**
   * Check if input is an email address
   */
  private isEmail(input: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(input.toLowerCase());
  }

  /**
   * Parse and normalize email
   */
  private parseEmail(input: string): ParsedQuery {
    const normalized = input.toLowerCase().trim();
    const [, domain] = normalized.split('@');

    return {
      raw: input,
      type: 'email',
      hash: this.generateHash(`email:${normalized}`),
      parsed: {
        email: normalized,
        emailDomain: domain,
      },
    };
  }

  /**
   * Check if input is a URL
   */
  private isUrl(input: string): boolean {
    // Check for common URL patterns
    const urlPatterns = [
      /^https?:\/\//i,
      /^www\./i,
      /linkedin\.com/i,
      /twitter\.com/i,
      /x\.com/i,
      /facebook\.com/i,
      /\.com\/in\//i,
    ];

    return urlPatterns.some(pattern => pattern.test(input));
  }

  /**
   * Parse and normalize URL
   */
  private parseUrl(input: string): ParsedQuery {
    let normalizedUrl = input.trim();

    // Add https:// if missing
    if (!normalizedUrl.match(/^https?:\/\//i)) {
      normalizedUrl = `https://${normalizedUrl}`;
    }

    // Remove trailing slash and query params for canonical form
    try {
      const urlObj = new URL(normalizedUrl);
      const hostname = urlObj.hostname.toLowerCase();

      // Detect URL type and extract username
      let urlType: 'linkedin' | 'twitter' | 'facebook' | 'website' | 'other' = 'other';
      let linkedinUsername: string | undefined;

      if (hostname.includes('linkedin.com')) {
        urlType = 'linkedin';
        // Extract LinkedIn username from /in/username or /pub/username
        const linkedinMatch = urlObj.pathname.match(/\/(in|pub)\/([^/?]+)/);
        if (linkedinMatch) {
          linkedinUsername = linkedinMatch[2].toLowerCase();
          // Create canonical LinkedIn URL
          normalizedUrl = `https://linkedin.com/in/${linkedinUsername}`;
        }
      } else if (hostname.includes('twitter.com') || hostname.includes('x.com')) {
        urlType = 'twitter';
      } else if (hostname.includes('facebook.com')) {
        urlType = 'facebook';
      } else if (hostname.match(/\.(com|org|net|io|co)$/)) {
        urlType = 'website';
      }

      return {
        raw: input,
        type: 'url',
        hash: this.generateHash(`url:${normalizedUrl}`),
        parsed: {
          url: normalizedUrl,
          urlType,
          linkedinUsername,
        },
      };
    } catch {
      // If URL parsing fails, treat as-is
      return {
        raw: input,
        type: 'url',
        hash: this.generateHash(`url:${normalizedUrl}`),
        parsed: {
          url: normalizedUrl,
          urlType: 'other',
        },
      };
    }
  }

  /**
   * Parse name input
   */
  private parseName(input: string): ParsedQuery {
    // Tokenize and normalize
    const tokens = input
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, ' ') // Remove punctuation, keep letters and numbers (Unicode aware)
      .split(/\s+/)
      .filter(token => token.length > 0);

    // Create normalized form (sorted tokens for better matching)
    const nameNormalized = tokens.join(' ');

    return {
      raw: input,
      type: 'name',
      hash: this.generateHash(`name:${nameNormalized}`),
      parsed: {
        nameTokens: tokens,
        nameNormalized,
      },
    };
  }

  /**
   * Generate SHA-256 hash for query (privacy-preserving)
   */
  private generateHash(input: string): string {
    return crypto.createHash('sha256').update(input).digest('hex');
  }

  /**
   * Extract potential search terms from OCR result
   */
  extractFromOcrText(ocrText: string): {
    emails: string[];
    phones: string[];
    names: string[];
    companies: string[];
    urls: string[];
  } {
    const result = {
      emails: [] as string[],
      phones: [] as string[],
      names: [] as string[],
      companies: [] as string[],
      urls: [] as string[],
    };

    const lines = ocrText.split('\n').map(l => l.trim()).filter(l => l);

    for (const line of lines) {
      // Check for email
      const emailMatch = line.match(/[^\s@]+@[^\s@]+\.[^\s@]+/gi);
      if (emailMatch) {
        result.emails.push(...emailMatch.map(e => e.toLowerCase()));
      }

      // Check for phone numbers
      const phoneMatch = line.match(/[\+]?[\d\s\-\(\)\.]{7,20}/g);
      if (phoneMatch) {
        for (const phone of phoneMatch) {
          if (this.isPhoneNumber(phone)) {
            const parsed = this.parsePhone(phone);
            if (parsed.parsed.phoneE164) {
              result.phones.push(parsed.parsed.phoneE164);
            }
          }
        }
      }

      // Check for URLs
      const urlMatch = line.match(/(?:https?:\/\/)?(?:www\.)?[^\s]+\.[a-z]{2,}/gi);
      if (urlMatch) {
        result.urls.push(...urlMatch);
      }
    }

    // First non-email, non-phone line is likely the name
    for (const line of lines) {
      if (
        !line.includes('@') &&
        !line.match(/[\d\-\(\)\+]{7,}/) &&
        !line.match(/^www\./i) &&
        line.length > 2 &&
        line.length < 50
      ) {
        // Looks like a name
        if (result.names.length === 0) {
          result.names.push(line);
        } else if (result.companies.length === 0 && result.names.length === 1) {
          // Second name-like line might be company
          result.companies.push(line);
        }
      }
    }

    return result;
  }
}

export default QueryParserService;
