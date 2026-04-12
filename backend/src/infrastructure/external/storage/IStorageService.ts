/**
 * Storage Service Interface
 *
 * Defines the contract for file storage operations.
 *
 * @module infrastructure/external/storage/IStorageService
 */

/**
 * Upload options
 */
export interface UploadOptions {
  /** Content type (MIME type) */
  contentType?: string;
  /** Custom metadata */
  metadata?: Record<string, string>;
  /** Make file publicly accessible */
  public?: boolean;
  /** Cache control header */
  cacheControl?: string;
}

/**
 * Upload result
 */
export interface UploadResult {
  /** Storage key/path */
  key: string;
  /** Public URL if available */
  url: string;
  /** File size in bytes */
  size: number;
  /** ETag for cache validation */
  etag?: string;
}

/**
 * Presigned URL options
 */
export interface PresignedUrlOptions {
  /** URL expiry in seconds (default 3600) */
  expiresIn?: number;
  /** Response content type */
  responseContentType?: string;
  /** Response content disposition */
  responseContentDisposition?: string;
}

/**
 * File metadata
 */
export interface FileMetadata {
  key: string;
  size: number;
  lastModified: Date;
  contentType?: string;
  etag?: string;
  metadata?: Record<string, string>;
}

/**
 * Storage Service Interface
 *
 * Abstract interface for file storage operations.
 * Implementations: MinIOStorageService, S3StorageService
 */
export interface IStorageService {
  /**
   * Upload a file
   *
   * @param bucket - Bucket name
   * @param key - File key/path
   * @param data - File data (Buffer or Stream)
   * @param options - Upload options
   * @returns Upload result
   */
  upload(
    bucket: string,
    key: string,
    data: Buffer | NodeJS.ReadableStream,
    options?: UploadOptions
  ): Promise<UploadResult>;

  /**
   * Download a file
   *
   * @param bucket - Bucket name
   * @param key - File key/path
   * @returns File data as Buffer
   */
  download(bucket: string, key: string): Promise<Buffer>;

  /**
   * Delete a file
   *
   * @param bucket - Bucket name
   * @param key - File key/path
   */
  delete(bucket: string, key: string): Promise<void>;

  /**
   * Check if a file exists
   *
   * @param bucket - Bucket name
   * @param key - File key/path
   * @returns True if file exists
   */
  exists(bucket: string, key: string): Promise<boolean>;

  /**
   * Get file metadata
   *
   * @param bucket - Bucket name
   * @param key - File key/path
   * @returns File metadata
   */
  getMetadata(bucket: string, key: string): Promise<FileMetadata>;

  /**
   * Generate a presigned URL for download
   *
   * @param bucket - Bucket name
   * @param key - File key/path
   * @param options - Presigned URL options
   * @returns Presigned URL
   */
  getPresignedUrl(
    bucket: string,
    key: string,
    options?: PresignedUrlOptions
  ): Promise<string>;

  /**
   * Generate a presigned URL for upload
   *
   * @param bucket - Bucket name
   * @param key - File key/path
   * @param options - Presigned URL options
   * @returns Presigned URL
   */
  getPresignedUploadUrl(
    bucket: string,
    key: string,
    options?: PresignedUrlOptions
  ): Promise<string>;

  /**
   * List files in a bucket/prefix
   *
   * @param bucket - Bucket name
   * @param prefix - Key prefix (optional)
   * @param maxKeys - Maximum number of keys to return
   * @returns Array of file metadata
   */
  list(bucket: string, prefix?: string, maxKeys?: number): Promise<FileMetadata[]>;

  /**
   * Create a bucket if it doesn't exist
   *
   * @param bucket - Bucket name
   */
  ensureBucket(bucket: string): Promise<void>;

  /**
   * Check if storage service is available
   *
   * @returns True if service is available
   */
  isAvailable(): Promise<boolean>;
}
