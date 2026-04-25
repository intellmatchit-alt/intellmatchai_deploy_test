/**
 * Storage Module
 *
 * Exports storage services and utilities.
 *
 * @module infrastructure/external/storage
 */

export * from './IStorageService';
export * from './MinIOStorageService';
export * from './StorageServiceFactory';

import { StorageServiceFactory } from './StorageServiceFactory';

/**
 * Get storage service instance
 * Convenience function for getting the storage service
 */
export function getStorageService() {
  return StorageServiceFactory.getService();
}
