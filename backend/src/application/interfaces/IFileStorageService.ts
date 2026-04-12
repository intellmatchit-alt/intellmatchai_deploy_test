/**
 * Interface: File Storage Service
 * Defines contract for S3-compatible file storage (MinIO)
 */

export interface IFileStorageService {
  /**
   * Upload a file to storage
   * @param key Object key (path in bucket)
   * @param data File buffer or stream
   * @param contentType MIME type
   * @param metadata Optional metadata
   */
  uploadFile(
    key: string,
    data: Buffer | NodeJS.ReadableStream,
    contentType: string,
    metadata?: Record<string, string>,
  ): Promise<void>;

  /**
   * Download a file from storage
   * @param key Object key
   * @returns File buffer
   */
  downloadFile(key: string): Promise<Buffer>;

  /**
   * Get a signed URL for temporary access
   * @param key Object key
   * @param expiresInSeconds URL validity period
   */
  getSignedUrl(key: string, expiresInSeconds?: number): Promise<string>;

  /**
   * Delete a file from storage
   * @param key Object key
   */
  deleteFile(key: string): Promise<void>;

  /**
   * Check if a file exists
   * @param key Object key
   */
  fileExists(key: string): Promise<boolean>;

  /**
   * Get file metadata
   * @param key Object key
   */
  getFileMetadata(key: string): Promise<{
    size: number;
    contentType: string;
    lastModified: Date;
    metadata: Record<string, string>;
  }>;

  /**
   * List files with a prefix
   * @param prefix Key prefix
   * @param maxKeys Maximum number of keys to return
   */
  listFiles(prefix: string, maxKeys?: number): Promise<{
    key: string;
    size: number;
    lastModified: Date;
  }[]>;
}
