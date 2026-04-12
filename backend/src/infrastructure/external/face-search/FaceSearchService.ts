/**
 * Face Search Service Implementation
 *
 * Provides reverse face search functionality to find social profiles
 * from a photo. Uses PimEyes-style API for face matching.
 *
 * Privacy Notice: This service requires explicit user consent before use.
 * All uploaded images should be deleted after processing.
 *
 * @module infrastructure/external/face-search/FaceSearchService
 */

import { config } from '../../../config';
import { logger } from '../../../shared/logger';
import {
  IFaceSearchService,
  FaceSearchResult,
  FaceSearchMatch,
  SocialProfile,
} from './IFaceSearchService';

/**
 * Face Search Service
 *
 * Implements face search using external APIs.
 * Supports PimEyes API or similar face search services.
 */
export class FaceSearchService implements IFaceSearchService {
  private apiKey: string | null = null;
  private baseUrl = 'https://api.pimeyes.com/v1';

  constructor() {
    const apiKey = config.ai.pimeyes?.apiKey;

    if (apiKey) {
      this.apiKey = apiKey;
      logger.info('Face Search service configured');
    } else {
      logger.warn('Face Search service not configured - missing API key');
    }
  }

  /**
   * Check if service is available
   */
  async isAvailable(): Promise<boolean> {
    if (!this.apiKey) {
      return false;
    }

    // Feature flag check
    if (!config.features.faceSearch) {
      return false;
    }

    return true;
  }

  /**
   * Search for faces in the provided image
   *
   * @param imageData - Base64 encoded image
   * @param mimeType - Image MIME type
   * @returns Face search results
   */
  async searchFace(imageData: string, mimeType: string): Promise<FaceSearchResult> {
    const startTime = Date.now();
    const warnings: string[] = [];

    if (!this.apiKey) {
      return {
        success: false,
        matches: [],
        processingTimeMs: Date.now() - startTime,
        error: 'Face search service not configured',
      };
    }

    try {
      // Validate image
      const imageBuffer = Buffer.from(imageData, 'base64');
      if (imageBuffer.length > 10 * 1024 * 1024) {
        return {
          success: false,
          matches: [],
          processingTimeMs: Date.now() - startTime,
          error: 'Image too large (max 10MB)',
        };
      }

      // Call face search API
      const searchResponse = await fetch(`${this.baseUrl}/search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          image: imageData,
          mimeType: mimeType,
          options: {
            maxResults: 10,
            includeProfiles: true,
          },
        }),
      });

      if (!searchResponse.ok) {
        const errorText = await searchResponse.text();
        logger.error('Face search API error', {
          status: searchResponse.status,
          error: errorText,
        });

        // Handle specific error codes
        if (searchResponse.status === 401 || searchResponse.status === 403) {
          return {
            success: false,
            matches: [],
            processingTimeMs: Date.now() - startTime,
            error: 'Invalid API key or access denied',
          };
        }

        if (searchResponse.status === 429) {
          return {
            success: false,
            matches: [],
            processingTimeMs: Date.now() - startTime,
            error: 'Rate limit exceeded. Please try again later.',
          };
        }

        return {
          success: false,
          matches: [],
          processingTimeMs: Date.now() - startTime,
          error: 'Face search service temporarily unavailable',
        };
      }

      const result = (await searchResponse.json()) as {
        success: boolean;
        faces_detected: number;
        results: Array<{
          confidence: number;
          name?: string;
          thumbnail_url?: string;
          source_url: string;
          profiles?: Array<{
            platform: string;
            url: string;
            username?: string;
          }>;
        }>;
      };

      // Check for multiple faces
      if (result.faces_detected > 1) {
        warnings.push('Multiple faces detected. Results are for the primary face.');
      }

      if (result.faces_detected === 0) {
        return {
          success: false,
          matches: [],
          processingTimeMs: Date.now() - startTime,
          error: 'No face detected in the image. Please upload a clear photo with a visible face.',
        };
      }

      // Transform results
      const matches: FaceSearchMatch[] = result.results.map((r) => ({
        confidence: Math.round(r.confidence * 100),
        name: r.name,
        thumbnailUrl: r.thumbnail_url,
        sourceUrl: r.source_url,
        socialProfiles: this.extractSocialProfiles(r.source_url, r.profiles),
      }));

      // Sort by confidence
      matches.sort((a, b) => b.confidence - a.confidence);

      // Add warning for low confidence matches
      if (matches.length > 0 && matches[0].confidence < 70) {
        warnings.push('Top match has lower confidence. Please verify the identity carefully.');
      }

      return {
        success: true,
        matches,
        processingTimeMs: Date.now() - startTime,
        warnings: warnings.length > 0 ? warnings : undefined,
      };
    } catch (error) {
      logger.error('Face search failed', { error });
      return {
        success: false,
        matches: [],
        processingTimeMs: Date.now() - startTime,
        error: 'Face search service error. Please try again.',
      };
    }
  }

  /**
   * Extract social profiles from search result
   */
  private extractSocialProfiles(
    sourceUrl: string,
    profiles?: Array<{ platform: string; url: string; username?: string }>
  ): SocialProfile[] {
    const socialProfiles: SocialProfile[] = [];

    // Add profiles from API response
    if (profiles) {
      for (const profile of profiles) {
        socialProfiles.push({
          platform: this.normalizePlatform(profile.platform),
          url: profile.url,
          username: profile.username,
        });
      }
    }

    // Try to extract platform from source URL
    const urlProfile = this.extractProfileFromUrl(sourceUrl);
    if (urlProfile && !socialProfiles.some((p) => p.url === urlProfile.url)) {
      socialProfiles.push(urlProfile);
    }

    return socialProfiles;
  }

  /**
   * Normalize platform name
   */
  private normalizePlatform(
    platform: string
  ): 'linkedin' | 'twitter' | 'facebook' | 'instagram' | 'other' {
    const normalized = platform.toLowerCase();
    if (normalized.includes('linkedin')) return 'linkedin';
    if (normalized.includes('twitter') || normalized.includes('x.com')) return 'twitter';
    if (normalized.includes('facebook') || normalized.includes('fb')) return 'facebook';
    if (normalized.includes('instagram') || normalized.includes('ig')) return 'instagram';
    return 'other';
  }

  /**
   * Extract social profile from URL
   */
  private extractProfileFromUrl(url: string): SocialProfile | null {
    try {
      const urlObj = new URL(url);
      const hostname = urlObj.hostname.toLowerCase();

      if (hostname.includes('linkedin.com')) {
        const match = url.match(/linkedin\.com\/(in|pub)\/([^/?]+)/);
        return {
          platform: 'linkedin',
          url: url,
          username: match?.[2],
        };
      }

      if (hostname.includes('twitter.com') || hostname.includes('x.com')) {
        const match = url.match(/(?:twitter|x)\.com\/([^/?]+)/);
        return {
          platform: 'twitter',
          url: url,
          username: match?.[1],
        };
      }

      if (hostname.includes('facebook.com')) {
        const match = url.match(/facebook\.com\/([^/?]+)/);
        return {
          platform: 'facebook',
          url: url,
          username: match?.[1],
        };
      }

      if (hostname.includes('instagram.com')) {
        const match = url.match(/instagram\.com\/([^/?]+)/);
        return {
          platform: 'instagram',
          url: url,
          username: match?.[1],
        };
      }

      return null;
    } catch {
      return null;
    }
  }
}

/**
 * Mock Face Search Service for development/testing
 *
 * Returns simulated results when the real service is not available.
 */
export class MockFaceSearchService implements IFaceSearchService {
  async isAvailable(): Promise<boolean> {
    return true;
  }

  async searchFace(_imageData: string, _mimeType: string): Promise<FaceSearchResult> {
    // Simulate processing time
    await new Promise((resolve) => setTimeout(resolve, 1500));

    // Return mock results
    return {
      success: true,
      matches: [
        {
          confidence: 92,
          name: 'Sample Match',
          thumbnailUrl: undefined,
          sourceUrl: 'https://linkedin.com/in/sample-user',
          socialProfiles: [
            {
              platform: 'linkedin',
              url: 'https://linkedin.com/in/sample-user',
              username: 'sample-user',
            },
          ],
        },
      ],
      processingTimeMs: 1500,
      warnings: ['This is a mock result for development purposes.'],
    };
  }
}
