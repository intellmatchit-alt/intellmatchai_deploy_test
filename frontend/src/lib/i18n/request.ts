/**
 * Next-intl Request Configuration
 *
 * Server-side internationalization setup for Next.js.
 *
 * @module lib/i18n/request
 */

import { getRequestConfig } from 'next-intl/server';
import { locales, defaultLocale, type Locale } from './config';

export default getRequestConfig(async ({ locale }) => {
  // Validate that the incoming locale is valid
  // Default to 'en' if no locale provided
  const validLocale = locale && locales.includes(locale as Locale)
    ? (locale as Locale)
    : defaultLocale;

  // Load all translation namespaces
  const messages = {
    ...(await import(`@/locales/${validLocale}/common.json`)).default,
    ...(await import(`@/locales/${validLocale}/auth.json`)).default,
    ...(await import(`@/locales/${validLocale}/contacts.json`)).default,
    ...(await import(`@/locales/${validLocale}/scanning.json`)).default,
    ...(await import(`@/locales/${validLocale}/matching.json`)).default,
    ...(await import(`@/locales/${validLocale}/profile.json`)).default,
    ...(await import(`@/locales/${validLocale}/errors.json`)).default,
  };

  return {
    messages,
    timeZone: 'UTC',
    now: new Date(),
  };
});
