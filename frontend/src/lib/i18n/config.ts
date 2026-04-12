/**
 * Internationalization Configuration
 *
 * Configuration for supported locales and default settings.
 *
 * @module lib/i18n/config
 */

/**
 * Supported locales
 */
export const locales = ['en', 'ar'] as const;

/**
 * Locale type
 */
export type Locale = (typeof locales)[number];

/**
 * Default locale
 */
export const defaultLocale: Locale = 'en';

/**
 * Locale configuration
 */
export const localeConfig: Record<Locale, {
  name: string;
  nativeName: string;
  dir: 'ltr' | 'rtl';
  dateFormat: string;
  numberFormat: Intl.NumberFormatOptions;
}> = {
  en: {
    name: 'English',
    nativeName: 'English',
    dir: 'ltr',
    dateFormat: 'MM/dd/yyyy',
    numberFormat: { style: 'decimal' },
  },
  ar: {
    name: 'Arabic',
    nativeName: 'العربية',
    dir: 'rtl',
    dateFormat: 'dd/MM/yyyy',
    numberFormat: { style: 'decimal' },
  },
};

/**
 * Get locale direction
 *
 * @param locale - Locale code
 * @returns 'ltr' or 'rtl'
 */
export const getDirection = (locale: Locale): 'ltr' | 'rtl' => {
  return localeConfig[locale]?.dir || 'ltr';
};

/**
 * Check if locale is RTL
 *
 * @param locale - Locale code
 * @returns True if RTL
 */
export const isRTL = (locale: Locale): boolean => {
  return getDirection(locale) === 'rtl';
};

/**
 * Get font family for locale
 *
 * @param locale - Locale code
 * @returns Font family string
 */
export const getFontFamily = (locale: Locale): string => {
  if (locale === 'ar') {
    return 'var(--font-arabic), IBM Plex Sans Arabic, Tahoma, system-ui, sans-serif';
  }
  return 'var(--font-inter), Inter, system-ui, sans-serif';
};

/**
 * Namespace types for translations
 */
export type TranslationNamespace =
  | 'common'
  | 'auth'
  | 'contacts'
  | 'scanning'
  | 'matching'
  | 'profile'
  | 'errors';

/**
 * All available namespaces
 */
export const namespaces: TranslationNamespace[] = [
  'common',
  'auth',
  'contacts',
  'scanning',
  'matching',
  'profile',
  'errors',
];

export default {
  locales,
  defaultLocale,
  localeConfig,
  getDirection,
  isRTL,
  getFontFamily,
  namespaces,
};
