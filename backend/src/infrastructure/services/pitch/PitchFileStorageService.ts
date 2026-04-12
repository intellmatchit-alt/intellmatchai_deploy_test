/**
 * PNME File Storage Service
 *
 * Adapter that implements IFileStorageService using MinIOStorageService.
 * Provides pitch-specific file storage operations.
 *
 * @module infrastructure/services/pitch/PitchFileStorageService
 */

import { IFileStorageService } from '../../../application/interfaces/IFileStorageService';
import { minioStorageService } from '../../external/storage/MinIOStorageService';
import { config } from '../../../config';
import { logger } from '../../../shared/logger';

/**
 * Pitch bucket name
 */
const PITCH_BUCKET = config.s3?.bucket || 'p2p-uploads';
const PITCH_PREFIX = 'pitches/';

/**
 * Pitch File Storage Service Implementation
 */
export class PitchFileStorageService implements IFileStorageService {
  private bucket: string;

  constructor() {
    this.bucket = PITCH_BUCKET;
  }

  /**
   * Upload a file to storage
   */
  async uploadFile(
    key: string,
    data: Buffer | NodeJS.ReadableStream,
    contentType: string,
    metadata?: Record<string, string>
  ): Promise<void> {
    const fullKey = key.startsWith(PITCH_PREFIX) ? key : `${PITCH_PREFIX}${key}`;

    await minioStorageService.upload(this.bucket, fullKey, data as Buffer, {
      contentType,
      metadata,
    });

    logger.debug('Uploaded pitch file', { key: fullKey, contentType });
  }

  /**
   * Download a file from storage
   */
  async downloadFile(key: string): Promise<Buffer> {
    const fullKey = key.startsWith(PITCH_PREFIX) ? key : `${PITCH_PREFIX}${key}`;

    const buffer = await minioStorageService.download(this.bucket, fullKey);

    logger.debug('Downloaded pitch file', { key: fullKey, size: buffer.length });

    return buffer;
  }

  /**
   * Get a signed URL for temporary access
   */
  async getSignedUrl(key: string, expiresInSeconds?: number): Promise<string> {
    const fullKey = key.startsWith(PITCH_PREFIX) ? key : `${PITCH_PREFIX}${key}`;

    const url = await minioStorageService.getPresignedUrl(this.bucket, fullKey, {
      expiresIn: expiresInSeconds || 3600,
    });

    return url;
  }

  /**
   * Delete a file from storage
   */
  async deleteFile(key: string): Promise<void> {
    const fullKey = key.startsWith(PITCH_PREFIX) ? key : `${PITCH_PREFIX}${key}`;

    await minioStorageService.delete(this.bucket, fullKey);

    logger.debug('Deleted pitch file', { key: fullKey });
  }

  /**
   * Check if a file exists
   */
  async fileExists(key: string): Promise<boolean> {
    const fullKey = key.startsWith(PITCH_PREFIX) ? key : `${PITCH_PREFIX}${key}`;

    return minioStorageService.exists(this.bucket, fullKey);
  }

  /**
   * Get file metadata
   */
  async getFileMetadata(key: string): Promise<{
    size: number;
    contentType: string;
    lastModified: Date;
    metadata: Record<string, string>;
  }> {
    const fullKey = key.startsWith(PITCH_PREFIX) ? key : `${PITCH_PREFIX}${key}`;

    const meta = await minioStorageService.getMetadata(this.bucket, fullKey);

    return {
      size: meta.size,
      contentType: meta.contentType || 'application/octet-stream',
      lastModified: meta.lastModified,
      metadata: meta.metadata || {},
    };
  }

  /**
   * List files with a prefix
   */
  async listFiles(
    prefix: string,
    maxKeys?: number
  ): Promise<{ key: string; size: number; lastModified: Date }[]> {
    const fullPrefix = prefix.startsWith(PITCH_PREFIX) ? prefix : `${PITCH_PREFIX}${prefix}`;

    const files = await minioStorageService.list(this.bucket, fullPrefix, maxKeys);

    return files.map((f) => ({
      key: f.key,
      size: f.size,
      lastModified: f.lastModified,
    }));
  }

  /**
   * Generate a unique key for a pitch file
   */
  generatePitchFileKey(userId: string, fileName: string): string {
    const timestamp = Date.now();
    const sanitizedName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
    return `${PITCH_PREFIX}${userId}/${timestamp}_${sanitizedName}`;
  }
}

// Export singleton instance
export const pitchFileStorageService = new PitchFileStorageService();
