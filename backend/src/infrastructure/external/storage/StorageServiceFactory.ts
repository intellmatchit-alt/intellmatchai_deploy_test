/**
 * Storage Service Factory
 *
 * Factory for creating storage service instances.
 *
 * @module infrastructure/external/storage/StorageServiceFactory
 */

import { IStorageService } from './IStorageService';
import { MinIOStorageService } from './MinIOStorageService';
import { logger } from '../../../shared/logger/index';

/**
 * Storage provider types
 */
export type StorageProvider = 'minio' | 's3' | 'local';

/**
 * Storage service factory
 */
export class StorageServiceFactory {
  private static instance: IStorageService | null = null;
  private static provider: StorageProvider = 'minio';

  /**
   * Get storage service instance
   *
   * @param provider - Storage provider type (optional, uses default if not specified)
   * @returns Storage service instance
   */
  static getService(provider?: StorageProvider): IStorageService {
    const useProvider = provider || process.env.STORAGE_PROVIDER as StorageProvider || 'minio';

    if (this.instance && this.provider === useProvider) {
      return this.instance;
    }

    switch (useProvider) {
      case 'minio':
      case 's3':
        // MinIO client is S3-compatible
        this.instance = new MinIOStorageService();
        break;
      case 'local':
        // Fallback to MinIO for now
        logger.warn('Local storage not implemented, using MinIO');
        this.instance = new MinIOStorageService();
        break;
      default:
        logger.warn(`Unknown storage provider: ${useProvider}, using MinIO`);
        this.instance = new MinIOStorageService();
    }

    this.provider = useProvider;
    return this.instance;
  }

  /**
   * Check if storage is available
   */
  static async isAvailable(): Promise<boolean> {
    try {
      const service = this.getService();
      return await service.isAvailable();
    } catch {
      return false;
    }
  }
}

export default StorageServiceFactory;
