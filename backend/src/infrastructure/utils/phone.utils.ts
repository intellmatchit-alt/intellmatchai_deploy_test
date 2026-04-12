/**
 * Phone Number Utilities
 *
 * Provides utilities for normalizing and parsing phone numbers.
 * Uses E.164 format as the standard storage format.
 */

// Country dial codes mapping
const COUNTRY_DIAL_CODES: Record<string, string> = {
  US: '+1',
  CA: '+1',
  GB: '+44',
  AE: '+971',
  SA: '+966',
  IN: '+91',
  AU: '+61',
  DE: '+49',
  FR: '+33',
  CN: '+86',
  EG: '+20',
  JO: '+962',
  KW: '+965',
  BH: '+973',
  QA: '+974',
  OM: '+968',
  YE: '+967',
  IQ: '+964',
  SY: '+963',
  LB: '+961',
  PS: '+970',
  IL: '+972',
  TR: '+90',
  IR: '+98',
  PK: '+92',
  BD: '+880',
  MY: '+60',
  SG: '+65',
  ID: '+62',
  PH: '+63',
  TH: '+66',
  VN: '+84',
  JP: '+81',
  KR: '+82',
  RU: '+7',
  KZ: '+7',
  UA: '+380',
  PL: '+48',
  IT: '+39',
  ES: '+34',
  PT: '+351',
  NL: '+31',
  BE: '+32',
  CH: '+41',
  AT: '+43',
  SE: '+46',
  NO: '+47',
  DK: '+45',
  FI: '+358',
  IE: '+353',
  GR: '+30',
  CZ: '+420',
  HU: '+36',
  RO: '+40',
  BG: '+359',
  HR: '+385',
  RS: '+381',
  ZA: '+27',
  NG: '+234',
  KE: '+254',
  GH: '+233',
  MA: '+212',
  TN: '+216',
  DZ: '+213',
  LY: '+218',
  SD: '+249',
  ET: '+251',
  TZ: '+255',
  UG: '+256',
  RW: '+250',
  ZM: '+260',
  ZW: '+263',
  MX: '+52',
  BR: '+55',
  AR: '+54',
  CO: '+57',
  CL: '+56',
  PE: '+51',
  VE: '+58',
  EC: '+593',
  NZ: '+64',
};

// Reverse mapping: dial code to country code (longest codes first for proper matching)
const DIAL_CODE_TO_COUNTRY: Array<{ dialCode: string; countryCode: string }> = Object.entries(COUNTRY_DIAL_CODES)
  .map(([countryCode, dialCode]) => ({ dialCode, countryCode }))
  .sort((a, b) => b.dialCode.length - a.dialCode.length);

export interface ParsedPhone {
  normalized: string;      // E.164 format: +966501234567
  countryCode: string;     // ISO country code: SA
  dialCode: string;        // Dial code: +966
  localNumber: string;     // Local number: 501234567
}

/**
 * Normalize a phone number to E.164 format
 *
 * @param phone - The phone number to normalize
 * @param defaultCountryCode - Default country code if not detectable (e.g., 'SA')
 * @returns Normalized phone number or null if invalid
 */
export function normalizePhone(phone: string | null | undefined, defaultCountryCode?: string): string | null {
  if (!phone) return null;

  // Remove all non-digit characters except leading +
  let cleaned = phone.replace(/[^\d+]/g, '');

  // Handle common international prefixes
  if (cleaned.startsWith('00')) {
    cleaned = '+' + cleaned.slice(2);
  }

  // If starts with +, it's already in international format
  if (cleaned.startsWith('+')) {
    // Validate it has enough digits
    const digitsOnly = cleaned.slice(1);
    if (digitsOnly.length >= 7 && digitsOnly.length <= 15) {
      return cleaned;
    }
    return null;
  }

  // Try to detect country code from the number
  for (const { dialCode, countryCode } of DIAL_CODE_TO_COUNTRY) {
    const codeDigits = dialCode.slice(1); // Remove +
    if (cleaned.startsWith(codeDigits)) {
      const localPart = cleaned.slice(codeDigits.length);
      if (localPart.length >= 6 && localPart.length <= 12) {
        return '+' + cleaned;
      }
    }
  }

  // Use default country code if provided
  if (defaultCountryCode && COUNTRY_DIAL_CODES[defaultCountryCode]) {
    const dialCode = COUNTRY_DIAL_CODES[defaultCountryCode];
    // Remove leading 0 if present (common in local formats)
    if (cleaned.startsWith('0')) {
      cleaned = cleaned.slice(1);
    }
    if (cleaned.length >= 6 && cleaned.length <= 12) {
      return dialCode + cleaned;
    }
  }

  return null;
}

/**
 * Parse a phone number into its components
 *
 * @param phone - The phone number to parse
 * @returns Parsed phone components or null if invalid
 */
export function parsePhone(phone: string | null | undefined): ParsedPhone | null {
  if (!phone) return null;

  // First normalize the phone
  const normalized = normalizePhone(phone);
  if (!normalized) return null;

  // Find matching country
  for (const { dialCode, countryCode } of DIAL_CODE_TO_COUNTRY) {
    if (normalized.startsWith(dialCode)) {
      const localNumber = normalized.slice(dialCode.length);
      return {
        normalized,
        countryCode,
        dialCode,
        localNumber,
      };
    }
  }

  return null;
}

/**
 * Extract country code from a phone number
 *
 * @param phone - The phone number
 * @returns ISO country code or null
 */
export function extractCountryCode(phone: string | null | undefined): string | null {
  const parsed = parsePhone(phone);
  return parsed?.countryCode || null;
}

/**
 * Get dial code for a country
 *
 * @param countryCode - ISO country code (e.g., 'SA')
 * @returns Dial code (e.g., '+966') or null
 */
export function getDialCode(countryCode: string): string | null {
  return COUNTRY_DIAL_CODES[countryCode.toUpperCase()] || null;
}

/**
 * Validate a phone number
 *
 * @param phone - The phone number to validate
 * @returns True if valid
 */
export function isValidPhone(phone: string | null | undefined): boolean {
  return normalizePhone(phone) !== null;
}

/**
 * Format phone for display
 *
 * @param phone - E.164 formatted phone number
 * @returns Formatted phone string
 */
export function formatPhoneForDisplay(phone: string | null | undefined): string {
  if (!phone) return '';

  const parsed = parsePhone(phone);
  if (!parsed) return phone;

  // Basic formatting: +966 50 123 4567
  const local = parsed.localNumber;
  if (local.length >= 9) {
    return `${parsed.dialCode} ${local.slice(0, 2)} ${local.slice(2, 5)} ${local.slice(5)}`;
  }
  return `${parsed.dialCode} ${local}`;
}
