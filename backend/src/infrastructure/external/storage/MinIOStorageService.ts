/**
 * MinIO Storage Service
 *
 * MinIO/S3-compatible storage implementation.
 *
 * @module infrastructure/external/storage/MinIOStorageService
 */

import { Client } from 'minio';
import { Readable } from 'stream';
import { config } from '../../../config/index';
import { logger } from '../../../shared/logger/index';
import {
  IStorageService,
  UploadOptions,
  UploadResult,
  PresignedUrlOptions,
  FileMetadata,
} from './IStorageService';

/**
 * MinIO Storage Service
 *
 * Implements file storage using MinIO/S3-compatible API.
 */
export class MinIOStorageService implements IStorageService {
  private client: Client;
  private isInitialized = false;
  private available = false;

  constructor() {
    // Parse endpoint URL to get host, port, and SSL setting
    const endpointUrl = config.s3?.endpoint || process.env.MINIO_ENDPOINT || 'http://localhost:9000';
    const parsedUrl = new URL(endpointUrl);

    const storageConfig = {
      endpoint: parsedUrl.hostname,
      port: parsedUrl.port ? parseInt(parsedUrl.port, 10) : (parsedUrl.protocol === 'https:' ? 443 : 9000),
      accessKey: config.s3?.accessKey || process.env.MINIO_ACCESS_KEY || 'minioadmin',
      secretKey: config.s3?.secretKey || process.env.MINIO_SECRET_KEY || 'minioadmin',
      useSSL: parsedUrl.protocol === 'https:',
      region: config.s3?.region || process.env.MINIO_REGION || 'us-east-1',
    };

    this.client = new Client({
      endPoint: storageConfig.endpoint,
      port: storageConfig.port,
      useSSL: storageConfig.useSSL,
      accessKey: storageConfig.accessKey,
      secretKey: storageConfig.secretKey,
      region: storageConfig.region,
    });
  }

  /**
   * Initialize and verify connection
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Test connection by listing buckets
      await this.client.listBuckets();
      this.available = true;
      this.isInitialized = true;
      logger.info('MinIO storage service initialized');
    } catch (error) {
      logger.warn('MinIO storage service not available:', error);
      this.available = false;
      this.isInitialized = true;
    }
  }

  /**
   * Check if storage service is available
   */
  async isAvailable(): Promise<boolean> {
    if (!this.isInitialized) {
      await this.initialize();
    }
    return this.available;
  }

  /**
   * Create a bucket if it doesn't exist
   */
  async ensureBucket(bucket: string): Promise<void> {
    if (!(await this.isAvailable())) {
      throw new Error('Storage service not available');
    }

    try {
      const exists = await this.client.bucketExists(bucket);
      if (!exists) {
        await this.client.makeBucket(bucket);
        logger.info(`Created bucket: ${bucket}`);
      }
    } catch (error) {
      logger.error(`Failed to ensure bucket ${bucket}:`, error);
      throw error;
    }
  }

  /**
   * Upload a file
   */
  async upload(
    bucket: string,
    key: string,
    data: Buffer | Readable,
    options?: UploadOptions
  ): Promise<UploadResult> {
    if (!(await this.isAvailable())) {
      throw new Error('Storage service not available');
    }

    try {
      await this.ensureBucket(bucket);

      const metaData: Record<string, string> = {
        'Content-Type': options?.contentType || 'application/octet-stream',
        ...(options?.cacheControl && { 'Cache-Control': options.cacheControl }),
        ...options?.metadata,
      };

      let size: number;
      if (Buffer.isBuffer(data)) {
        size = data.length;
        await this.client.putObject(bucket, key, data, size, metaData);
      } else {
        // For streams, we need to calculate size differently
        await this.client.putObject(bucket, key, data, undefined, metaData);
        size = 0; // Size unknown for streams
      }

      // Return URL pointing to our storage endpoint (simpler path for social media)
      // Using /storage/ instead of /api/v1/storage/ for better WhatsApp compatibility
      const siteUrl = process.env.SITE_URL || 'https://intellmatch.com';
      const url = `${siteUrl}/storage/${bucket}/${key}`;

      logger.debug(`Uploaded file: ${bucket}/${key}`, { size });

      return {
        key,
        url,
        size,
      };
    } catch (error) {
      logger.error(`Failed to upload ${bucket}/${key}:`, error);
      throw error;
    }
  }

  /**
   * Download a file
   */
  async download(bucket: string, key: string): Promise<Buffer> {
    if (!(await this.isAvailable())) {
      throw new Error('Storage service not available');
    }

    try {
      const stream = await this.client.getObject(bucket, key);
      const chunks: Buffer[] = [];

      return new Promise((resolve, reject) => {
        stream.on('data', (chunk: Buffer) => chunks.push(chunk));
        stream.on('end', () => resolve(Buffer.concat(chunks)));
        stream.on('error', reject);
      });
    } catch (error) {
      logger.error(`Failed to download ${bucket}/${key}:`, error);
      throw error;
    }
  }

  /**
   * Delete a file
   */
  async delete(bucket: string, key: string): Promise<void> {
    if (!(await this.isAvailable())) {
      throw new Error('Storage service not available');
    }

    try {
      await this.client.removeObject(bucket, key);
      logger.debug(`Deleted file: ${bucket}/${key}`);
    } catch (error) {
      logger.error(`Failed to delete ${bucket}/${key}:`, error);
      throw error;
    }
  }

  /**
   * Check if a file exists
   */
  async exists(bucket: string, key: string): Promise<boolean> {
    if (!(await this.isAvailable())) {
      return false;
    }

    try {
      await this.client.statObject(bucket, key);
      return true;
    } catch (error: any) {
      if (error.code === 'NotFound') {
        return false;
      }
      throw error;
    }
  }

  /**
   * Get file metadata
   */
  async getMetadata(bucket: string, key: string): Promise<FileMetadata> {
    if (!(await this.isAvailable())) {
      throw new Error('Storage service not available');
    }

    try {
      const stat = await this.client.statObject(bucket, key);
      return {
        key,
        size: stat.size,
        lastModified: stat.lastModified,
        contentType: stat.metaData?.['content-type'],
        etag: stat.etag,
        metadata: stat.metaData as Record<string, string>,
      };
    } catch (error) {
      logger.error(`Failed to get metadata for ${bucket}/${key}:`, error);
      throw error;
    }
  }

  /**
   * Generate a presigned URL for download
   */
  async getPresignedUrl(
    bucket: string,
    key: string,
    options?: PresignedUrlOptions
  ): Promise<string> {
    if (!(await this.isAvailable())) {
      throw new Error('Storage service not available');
    }

    try {
      const expiresIn = options?.expiresIn || 3600; // Default 1 hour
      let url = await this.client.presignedGetObject(bucket, key, expiresIn);

      // Replace internal localhost URL with public URL
      // localhost:9000/bucket/key -> intellmatch.com/storage/bucket/key
      url = url.replace('http://localhost:9000/', 'https://intellmatch.com/storage/');

      return url;
    } catch (error) {
      logger.error(`Failed to generate presigned URL for ${bucket}/${key}:`, error);
      throw error;
    }
  }

  /**
   * Generate a presigned URL for upload
   */
  async getPresignedUploadUrl(
    bucket: string,
    key: string,
    options?: PresignedUrlOptions
  ): Promise<string> {
    if (!(await this.isAvailable())) {
      throw new Error('Storage service not available');
    }

    try {
      await this.ensureBucket(bucket);
      const expiresIn = options?.expiresIn || 3600; // Default 1 hour
      const url = await this.client.presignedPutObject(bucket, key, expiresIn);
      return url;
    } catch (error) {
      logger.error(`Failed to generate presigned upload URL for ${bucket}/${key}:`, error);
      throw error;
    }
  }

  /**
   * List files in a bucket/prefix
   */
  async list(bucket: string, prefix?: string, maxKeys?: number): Promise<FileMetadata[]> {
    if (!(await this.isAvailable())) {
      return [];
    }

    try {
      const files: FileMetadata[] = [];
      const stream = this.client.listObjects(bucket, prefix, true);

      return new Promise((resolve, reject) => {
        let count = 0;
        stream.on('data', (obj) => {
          if (maxKeys && count >= maxKeys) return;
          files.push({
            key: obj.name || '',
            size: obj.size,
            lastModified: obj.lastModified,
            etag: obj.etag,
          });
          count++;
        });
        stream.on('end', () => resolve(files));
        stream.on('error', reject);
      });
    } catch (error) {
      logger.error(`Failed to list files in ${bucket}/${prefix}:`, error);
      throw error;
    }
  }
}

// Export singleton instance
export const minioStorageService = new MinIOStorageService();
export default minioStorageService;
