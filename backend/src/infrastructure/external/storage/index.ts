/**
 * Storage Module
 *
 * Exports storage services and utilities.
 *
 * @module infrastructure/external/storage
 */

export * from './IStorageService.js';
export * from './MinIOStorageService.js';
export * from './StorageServiceFactory.js';

import { StorageServiceFactory } from './StorageServiceFactory.js';

/**
 * Get storage service instance
 * Convenience function for getting the storage service
 */
export function getStorageService() {
  return StorageServiceFactory.getService();
}
