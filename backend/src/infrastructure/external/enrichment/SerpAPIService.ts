/**
 * SerpAPI LinkedIn Discovery Service
 *
 * Uses SerpAPI Google Search to find LinkedIn profile URLs
 * for contacts based on name, company, and job title.
 *
 * @module infrastructure/external/enrichment/SerpAPIService
 */

import { logger } from '../../../shared/logger/index.js';
import { config } from '../../../config/index.js';

/**
 * SerpAPI search result
 */
export interface SerpAPISearchResult {
  success: boolean;
  linkedInUrl?: string;
  snippets: string[];
  processingTimeMs: number;
}

/**
 * SerpAPI LinkedIn Discovery Service
 *
 * Searches Google via SerpAPI to find LinkedIn profile URLs
 * for contacts when no LinkedIn URL is available.
 */
export class SerpAPIService {
  private apiKey: string | undefined;
  private baseUrl = 'https://serpapi.com/search';

  constructor() {
    this.apiKey = config.ai.serpapi?.apiKey;

    if (this.apiKey) {
      logger.info('SerpAPI service configured');
    } else {
      logger.warn('SerpAPI service not configured - missing API key');
    }
  }

  /**
   * Check if SerpAPI service is available
   */
  async isAvailable(): Promise<boolean> {
    return config.features.serpapi && !!this.apiKey;
  }

  /**
   * Search for a LinkedIn profile URL
   *
   * @param name - Person's name
   * @param company - Optional company name
   * @param jobTitle - Optional job title
   * @returns Search result with LinkedIn URL if found
   */
  async searchLinkedInUrl(
    name: string,
    company?: string,
    jobTitle?: string
  ): Promise<SerpAPISearchResult> {
    if (!this.apiKey) {
      return {
        success: false,
        snippets: [],
        processingTimeMs: 0,
      };
    }

    const startTime = Date.now();

    // Try multiple query variations
    const queries = [
      `"${name}" ${company || ''} site:linkedin.com/in/`.trim(),
      company ? `"${name}" "${company}" linkedin` : null,
      jobTitle ? `"${name}" ${jobTitle} linkedin` : null,
    ].filter(Boolean) as string[];

    for (const query of queries) {
      try {
        const params = new URLSearchParams({
          engine: 'google',
          q: query,
          api_key: this.apiKey,
          num: '5',
        });

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15000);

        const response = await fetch(`${this.baseUrl}?${params.toString()}`, {
          signal: controller.signal,
        });

        clearTimeout(timeout);

        if (!response.ok) {
          logger.warn('SerpAPI request failed', { status: response.status, query });
          continue;
        }

        const result = await response.json() as any;
        const organicResults = result.organic_results || [];

        // Find first LinkedIn /in/ URL
        for (const item of organicResults) {
          const url = item.link || '';
          if (url.match(/linkedin\.com\/in\/[a-zA-Z0-9\-]+/)) {
            const processingTimeMs = Date.now() - startTime;
            logger.info('SerpAPI found LinkedIn URL', {
              name,
              linkedInUrl: url,
              query,
              processingTimeMs,
            });

            return {
              success: true,
              linkedInUrl: url.split('?')[0], // Remove query params
              snippets: organicResults.map((r: any) => r.snippet || '').filter(Boolean),
              processingTimeMs,
            };
          }
        }

        logger.debug('SerpAPI no LinkedIn URL in results', { query, resultCount: organicResults.length });
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          logger.warn('SerpAPI request timed out', { query });
        } else {
          logger.error('SerpAPI search failed', { error, query });
        }
      }
    }

    return {
      success: false,
      snippets: [],
      processingTimeMs: Date.now() - startTime,
    };
  }
}
