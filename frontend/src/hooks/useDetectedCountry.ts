/**
 * useDetectedCountry Hook
 *
 * Detects the user's country based on their IP address.
 * Returns the ISO country code (e.g., 'US', 'GB', 'AE').
 */

'use client';

import { useState, useEffect } from 'react';

const DEFAULT_COUNTRY = 'AE';

// Cache the detected country to avoid multiple API calls
let cachedCountry: string | null = null;
let detectionPromise: Promise<string> | null = null;

async function detectCountryFromIP(): Promise<string> {
  // Return cached result if available
  if (cachedCountry) {
    return cachedCountry;
  }

  // If detection is already in progress, wait for it
  if (detectionPromise) {
    return detectionPromise;
  }

  // Start detection
  detectionPromise = (async () => {
    try {
      // Use ipapi.co - free, no key needed, returns ISO country code
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch('https://ipapi.co/json/', {
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        if (data.country_code) {
          cachedCountry = data.country_code;
          return data.country_code;
        }
      }
    } catch (error) {
      // Silently fail and use default
      console.log('Could not detect country, using default');
    }

    cachedCountry = DEFAULT_COUNTRY;
    return DEFAULT_COUNTRY;
  })();

  return detectionPromise;
}

/**
 * Hook to detect user's country from IP address
 * @returns The detected country code (ISO 2-letter code like 'US', 'GB', 'AE')
 */
export function useDetectedCountry(): string {
  const [country, setCountry] = useState<string>(cachedCountry || DEFAULT_COUNTRY);

  useEffect(() => {
    // If already cached, use it immediately
    if (cachedCountry) {
      setCountry(cachedCountry);
      return;
    }

    // Otherwise, detect
    detectCountryFromIP().then(setCountry);
  }, []);

  return country;
}

export default useDetectedCountry;
