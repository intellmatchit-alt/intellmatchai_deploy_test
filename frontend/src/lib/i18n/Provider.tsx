/**
 * Internationalization (i18n) System
 *
 * Provides translations for English and Arabic with RTL support.
 */

'use client';

import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { en, type Translations } from './en';
import { ar } from './ar';

// Available languages
export const languages = {
  en: { code: 'en', name: 'English', flag: '🇺🇸', dir: 'ltr' as const },
  ar: { code: 'ar', name: 'العربية', flag: '🇸🇦', dir: 'rtl' as const },
};

export type LanguageCode = keyof typeof languages;

// Translation map
const translations: Record<LanguageCode, Translations> = {
  en,
  ar,
};

// Context type
interface I18nContextType {
  lang: LanguageCode;
  locale: LanguageCode; // Alias for lang
  t: Translations;
  setLang: (lang: LanguageCode) => void;
  dir: 'ltr' | 'rtl';
  isRTL: boolean;
}

// Create context
const I18nContext = createContext<I18nContextType | null>(null);

// Provider component
export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<LanguageCode>('en');

  const setLang = useCallback((newLang: LanguageCode) => {
    setLangState(newLang);
    // Update document direction, language, and font
    if (typeof document !== 'undefined') {
      const html = document.documentElement;
      const body = document.body;

      // Set direction and language
      html.dir = languages[newLang].dir;
      html.lang = newLang;

      // Update font classes on body
      if (newLang === 'ar') {
        body.classList.add('font-arabic', 'rtl');
        body.classList.remove('font-sans');
        html.classList.add('font-arabic');
      } else {
        body.classList.remove('font-arabic', 'rtl');
        body.classList.add('font-sans');
        html.classList.remove('font-arabic');
      }
    }
    // Save preference
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('preferred-language', newLang);
    }
  }, []);

  // Load saved language preference
  useEffect(() => {
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem('preferred-language') as LanguageCode | null;
      if (saved && languages[saved]) {
        setLang(saved);
      }
    }
  }, [setLang]);

  const value: I18nContextType = {
    lang,
    locale: lang, // Alias for lang
    t: translations[lang],
    setLang,
    dir: languages[lang].dir,
    isRTL: languages[lang].dir === 'rtl',
  };

  return (
    <I18nContext.Provider value={value}>
      {children}
    </I18nContext.Provider>
  );
}

// Hook to use translations
export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  return context;
}

// Export types and translations
export { en, ar };
export type { Translations };
