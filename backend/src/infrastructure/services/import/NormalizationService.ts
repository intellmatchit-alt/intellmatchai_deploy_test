/**
 * Normalization Service
 *
 * Handles phone number normalization (E.164 format), email lowercase,
 * and identity key generation for contact deduplication.
 *
 * @module infrastructure/services/import/NormalizationService
 */

import { createHash } from 'crypto';
import { logger } from '../../../shared/logger/index.js';

/**
 * Raw contact data from import
 */
export interface RawContact {
  id?: string;
  name?: string;
  fullName?: string;
  title?: string;      // Name prefix (Mr., Dr., etc.)
  firstName?: string;
  middleName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  company?: string;
  jobTitle?: string;
  location?: string;
  bio?: string;
  notes?: string;
  linkedinUrl?: string;
  twitterUrl?: string;
  websiteUrl?: string;
  // Additional fields from various sources
  [key: string]: string | undefined;
}

/**
 * Normalized contact data
 */
export interface NormalizedContact extends RawContact {
  normalizedPhone?: string;
  normalizedEmail?: string;
  identityKey: string;
  fullName: string;
}

/**
 * Country code to dial code mapping for phone normalization
 */
const COUNTRY_DIAL_CODES: Record<string, string> = {
  US: '+1',
  CA: '+1',
  GB: '+44',
  UK: '+44',
  DE: '+49',
  FR: '+33',
  IT: '+39',
  ES: '+34',
  AU: '+61',
  JP: '+81',
  CN: '+86',
  IN: '+91',
  BR: '+55',
  MX: '+52',
  AE: '+971',
  SA: '+966',
  EG: '+20',
  ZA: '+27',
  NL: '+31',
  BE: '+32',
  CH: '+41',
  AT: '+43',
  SE: '+46',
  NO: '+47',
  DK: '+45',
  FI: '+358',
  PL: '+48',
  PT: '+351',
  GR: '+30',
  TR: '+90',
  RU: '+7',
  KR: '+82',
  SG: '+65',
  MY: '+60',
  TH: '+66',
  ID: '+62',
  PH: '+63',
  VN: '+84',
  NZ: '+64',
  IE: '+353',
  IL: '+972',
  QA: '+974',
  KW: '+965',
  BH: '+973',
  OM: '+968',
  JO: '+962',
  LB: '+961',
};

/**
 * Normalization Service
 */
export class NormalizationService {
  private defaultCountryCode: string;

  constructor(defaultCountryCode: string = 'US') {
    this.defaultCountryCode = defaultCountryCode;
  }

  /**
   * Normalize a phone number to E.164 format or digits-only fallback
   */
  normalizePhone(phone: string | undefined, countryCode?: string): string | undefined {
    if (!phone) return undefined;

    // Remove all non-digit characters except +
    let cleaned = phone.replace(/[^\d+]/g, '');

    if (!cleaned) return undefined;

    // If already starts with +, assume it's already in international format
    if (cleaned.startsWith('+')) {
      // Validate length (E.164 is 8-15 digits after +)
      const digits = cleaned.substring(1);
      if (digits.length >= 7 && digits.length <= 15) {
        return cleaned;
      }
    }

    // Remove leading zeros (common in local formats)
    cleaned = cleaned.replace(/^0+/, '');

    // If we have a country code, try to add the dial code
    const country = countryCode || this.defaultCountryCode;
    const dialCode = COUNTRY_DIAL_CODES[country.toUpperCase()];

    if (dialCode) {
      // Check if the number might already include the dial code without +
      const dialDigits = dialCode.replace('+', '');
      if (cleaned.startsWith(dialDigits)) {
        return '+' + cleaned;
      }

      // For US/CA, handle 10-digit numbers
      if (['US', 'CA'].includes(country.toUpperCase()) && cleaned.length === 10) {
        return `+1${cleaned}`;
      }

      // For other countries, add dial code if reasonable
      if (cleaned.length >= 6 && cleaned.length <= 12) {
        return `${dialCode}${cleaned}`;
      }
    }

    // Fallback: return digits only if we couldn't normalize
    if (cleaned.length >= 6) {
      return cleaned;
    }

    return undefined;
  }

  /**
   * Normalize an email address (lowercase + trim)
   */
  normalizeEmail(email: string | undefined): string | undefined {
    if (!email) return undefined;

    const normalized = email.toLowerCase().trim();

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalized)) {
      logger.debug('Invalid email format, skipping normalization', { email });
      return undefined;
    }

    return normalized;
  }

  /**
   * Generate a full name from first/last name or name field
   */
  generateFullName(contact: RawContact): string {
    // Debug logging to trace name resolution
    logger.info('[NormalizationService] generateFullName input:', {
      fullName: contact.fullName,
      name: contact.name,
      title: contact.title,
      firstName: contact.firstName,
      middleName: contact.middleName,
      lastName: contact.lastName,
      email: contact.email,
      allKeys: Object.keys(contact),
    });

    if (contact.fullName) {
      logger.info('[NormalizationService] Using fullName:', contact.fullName);
      return contact.fullName.trim();
    }

    if (contact.firstName || contact.lastName) {
      const result = [contact.title, contact.firstName, contact.middleName, contact.lastName]
        .filter(Boolean)
        .map(n => n?.trim())
        .join(' ');
      logger.info('[NormalizationService] Using name parts:', result);
      return result;
    }

    if (contact.name) {
      logger.info('[NormalizationService] Using name:', contact.name);
      return contact.name.trim();
    }

    // Fallback to email prefix or unknown
    if (contact.email) {
      const emailPrefix = contact.email.split('@')[0];
      const result = emailPrefix
        .replace(/[._-]/g, ' ')
        .replace(/\b\w/g, c => c.toUpperCase());
      logger.info('[NormalizationService] Fallback to email prefix:', result);
      return result;
    }

    logger.warn('[NormalizationService] No name found, using Unknown Contact');
    return 'Unknown Contact';
  }

  /**
   * Generate an identity key for deduplication
   * Priority: phone > email > hash(name + company)
   */
  generateIdentityKey(contact: NormalizedContact): string {
    // Priority 1: Normalized phone
    if (contact.normalizedPhone) {
      return `phone:${contact.normalizedPhone}`;
    }

    // Priority 2: Normalized email
    if (contact.normalizedEmail) {
      return `email:${contact.normalizedEmail}`;
    }

    // Priority 3: Hash of name + company
    const hashInput = `${contact.fullName || ''}:${contact.company || ''}`.toLowerCase();
    const hash = createHash('sha256').update(hashInput).digest('hex').substring(0, 16);
    return `hash:${hash}`;
  }

  /**
   * Normalize a single contact
   */
  normalize(contact: RawContact, countryCode?: string): NormalizedContact {
    const fullName = this.generateFullName(contact);
    const normalizedPhone = this.normalizePhone(contact.phone, countryCode);
    const normalizedEmail = this.normalizeEmail(contact.email);

    const normalized: NormalizedContact = {
      ...contact,
      fullName,
      normalizedPhone,
      normalizedEmail,
      identityKey: '', // Will be set below
    };

    normalized.identityKey = this.generateIdentityKey(normalized);

    return normalized;
  }

  /**
   * Normalize a batch of contacts
   */
  normalizeBatch(contacts: RawContact[], countryCode?: string): NormalizedContact[] {
    const results: NormalizedContact[] = [];

    for (const contact of contacts) {
      try {
        const normalized = this.normalize(contact, countryCode);
        results.push(normalized);
      } catch (error) {
        logger.warn('Failed to normalize contact', {
          contact: { name: contact.name, email: contact.email },
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return results;
  }
}

// Export singleton instance
export const normalizationService = new NormalizationService();
export default NormalizationService;
