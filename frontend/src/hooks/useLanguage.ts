/**
 * useLanguage Hook
 *
 * Wrapper around useI18n for backward compatibility.
 * Provides translation function and language utilities.
 */

import { useI18n } from '@/lib/i18n';

export function useLanguage() {
  const { t, locale, setLang, dir } = useI18n();

  return {
    t,
    locale,
    setLocale: setLang,
    dir,
    // Alias for compatibility
    language: locale,
    setLanguage: setLang,
    isRTL: dir === 'rtl',
  };
}

export default useLanguage;
