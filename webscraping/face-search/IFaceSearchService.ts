/**
 * Face Search Service Interface
 *
 * Defines the contract for face search/recognition services.
 *
 * @module infrastructure/external/face-search/IFaceSearchService
 */

/**
 * Social profile found from face search
 */
export interface SocialProfile {
  platform: 'linkedin' | 'twitter' | 'facebook' | 'instagram' | 'other';
  url: string;
  username?: string;
}

/**
 * Face search result - a potential identity match
 */
export interface FaceSearchMatch {
  /** Confidence score (0-100) */
  confidence: number;
  /** Name if detected */
  name?: string;
  /** Profile image URL */
  thumbnailUrl?: string;
  /** Source URL where face was found */
  sourceUrl: string;
  /** Social profiles associated with this match */
  socialProfiles: SocialProfile[];
}

/**
 * Result from face search operation
 */
export interface FaceSearchResult {
  /** Whether the search was successful */
  success: boolean;
  /** Array of potential matches */
  matches: FaceSearchMatch[];
  /** Processing time in milliseconds */
  processingTimeMs: number;
  /** Error message if search failed */
  error?: string;
  /** Warnings (e.g., low confidence, multiple faces detected) */
  warnings?: string[];
}

/**
 * Face Search Service Interface
 */
export interface IFaceSearchService {
  /**
   * Check if the service is available and configured
   */
  isAvailable(): Promise<boolean>;

  /**
   * Search for faces matching the provided image
   *
   * @param imageData - Base64 encoded image data
   * @param mimeType - Image MIME type (image/jpeg, image/png, etc.)
   * @returns Face search results with potential matches
   */
  searchFace(imageData: string, mimeType: string): Promise<FaceSearchResult>;
}
