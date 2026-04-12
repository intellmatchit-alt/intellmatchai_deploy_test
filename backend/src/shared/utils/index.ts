/**
 * Utility Functions
 *
 * Common utility functions used throughout the application.
 *
 * @module shared/utils
 */

import { v4 as uuidv4 } from 'uuid';

/**
 * Generate a unique UUID
 *
 * @returns A new UUID v4 string
 *
 * @example
 * ```typescript
 * const id = generateUUID();
 * // "550e8400-e29b-41d4-a716-446655440000"
 * ```
 */
export const generateUUID = (): string => {
  return uuidv4();
};

/**
 * Generate a unique request ID
 *
 * @returns A prefixed request ID
 *
 * @example
 * ```typescript
 * const requestId = generateRequestId();
 * // "req_550e8400-e29b-41d4-a716-446655440000"
 * ```
 */
export const generateRequestId = (): string => {
  return `req_${uuidv4()}`;
};

/**
 * Sleep for a specified duration
 *
 * @param ms - Milliseconds to sleep
 * @returns Promise that resolves after the duration
 *
 * @example
 * ```typescript
 * await sleep(1000); // Wait 1 second
 * ```
 */
export const sleep = (ms: number): Promise<void> => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

/**
 * Safely parse JSON string
 *
 * @param json - JSON string to parse
 * @param defaultValue - Default value if parsing fails
 * @returns Parsed value or default
 *
 * @example
 * ```typescript
 * const data = safeJsonParse('{"name": "John"}', {});
 * ```
 */
export const safeJsonParse = <T>(json: string, defaultValue: T): T => {
  try {
    return JSON.parse(json) as T;
  } catch {
    return defaultValue;
  }
};

/**
 * Remove undefined and null values from object
 *
 * @param obj - Object to clean
 * @returns Object without null/undefined values
 *
 * @example
 * ```typescript
 * const clean = removeNullish({ a: 1, b: null, c: undefined });
 * // { a: 1 }
 * ```
 */
export const removeNullish = <T extends Record<string, unknown>>(
  obj: T
): Partial<T> => {
  return Object.fromEntries(
    Object.entries(obj).filter(([_, v]) => v != null)
  ) as Partial<T>;
};

/**
 * Truncate string to specified length
 *
 * @param str - String to truncate
 * @param length - Maximum length
 * @param suffix - Suffix to add if truncated (default: '...')
 * @returns Truncated string
 *
 * @example
 * ```typescript
 * truncate('Hello World', 8); // "Hello..."
 * ```
 */
export const truncate = (
  str: string,
  length: number,
  suffix: string = '...'
): string => {
  if (str.length <= length) return str;
  return str.slice(0, length - suffix.length) + suffix;
};

/**
 * Extract email domain
 *
 * @param email - Email address
 * @returns Domain part of email
 *
 * @example
 * ```typescript
 * getEmailDomain('user@example.com'); // "example.com"
 * ```
 */
export const getEmailDomain = (email: string): string | null => {
  const match = email.match(/@([^@]+)$/);
  return match ? match[1] : null;
};

/**
 * Normalize string for comparison
 *
 * @param str - String to normalize
 * @returns Normalized lowercase string without extra whitespace
 */
export const normalizeString = (str: string): string => {
  return str.toLowerCase().trim().replace(/\s+/g, ' ');
};

/**
 * Calculate overlap between two arrays
 *
 * @param arr1 - First array
 * @param arr2 - Second array
 * @returns Number of common elements
 */
export const calculateOverlap = <T>(arr1: T[], arr2: T[]): number => {
  const set1 = new Set(arr1);
  return arr2.filter((item) => set1.has(item)).length;
};

/**
 * Calculate Jaccard similarity between two arrays
 *
 * @param arr1 - First array
 * @param arr2 - Second array
 * @returns Similarity score between 0 and 1
 */
export const jaccardSimilarity = <T>(arr1: T[], arr2: T[]): number => {
  if (arr1.length === 0 && arr2.length === 0) return 1;

  const set1 = new Set(arr1);
  const set2 = new Set(arr2);

  const intersection = new Set([...set1].filter((x) => set2.has(x)));
  const union = new Set([...set1, ...set2]);

  return intersection.size / union.size;
};

/**
 * Format date to ISO string without timezone
 *
 * @param date - Date to format
 * @returns Formatted date string
 */
export const formatDateISO = (date: Date): string => {
  return date.toISOString().split('T')[0] || '';
};

/**
 * Calculate days since a date
 *
 * @param date - Date to calculate from
 * @returns Number of days since the date
 */
export const daysSince = (date: Date): number => {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
};

/**
 * Chunk array into smaller arrays
 *
 * @param array - Array to chunk
 * @param size - Chunk size
 * @returns Array of chunks
 */
export const chunk = <T>(array: T[], size: number): T[][] => {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
};

/**
 * Retry an async function with exponential backoff
 *
 * @param fn - Function to retry
 * @param maxRetries - Maximum number of retries
 * @param baseDelay - Base delay in milliseconds
 * @returns Result of the function
 */
export const retry = async <T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> => {
  let lastError: Error;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      if (attempt < maxRetries - 1) {
        const delay = baseDelay * Math.pow(2, attempt);
        await sleep(delay);
      }
    }
  }

  throw lastError!;
};
