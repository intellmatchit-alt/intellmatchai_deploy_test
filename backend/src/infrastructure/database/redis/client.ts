/**
 * Redis Client
 *
 * Redis client for caching and queue management.
 *
 * @module infrastructure/database/redis/client
 */

import Redis from 'ioredis';
import { config } from '../../../config/index.js';
import { logger } from '../../../shared/logger/index.js';

/**
 * Redis client instance
 */
let redis: Redis | null = null;
let redisAvailable = false;
let redisChecked = false;

/**
 * Get or create Redis client instance
 *
 * @returns Redis client singleton or null if not available
 */
export const getRedisClient = (): Redis | null => {
  if (redisChecked && !redisAvailable) {
    return null;
  }

  if (!redis) {
    redis = new Redis(config.redis.url, {
      maxRetriesPerRequest: 1,
      retryStrategy(times) {
        // Stop retrying after 3 attempts
        if (times > 3) {
          redisAvailable = false;
          redisChecked = true;
          return null; // Stop retrying
        }
        return Math.min(times * 100, 1000);
      },
      reconnectOnError() {
        return false; // Don't auto-reconnect
      },
      lazyConnect: true, // Don't connect until first command
    });

    redis.on('connect', () => {
      redisAvailable = true;
      logger.info('Redis connected');
    });

    redis.on('error', () => {
      // Silently ignore errors - Redis is optional
    });

    redis.on('close', () => {
      if (redisAvailable) {
        logger.warn('Redis connection closed');
        redisAvailable = false;
      }
    });
  }

  return redis;
};

/**
 * Initialize Redis connection
 *
 * Tests the Redis connection and logs the result.
 * Redis is optional - the app will continue without it.
 */
export const initializeRedis = async (): Promise<void> => {
  try {
    const client = getRedisClient();
    if (!client) {
      logger.info('Redis not configured - continuing without cache');
      redisChecked = true;
      return;
    }
    await client.connect();
    const pong = await client.ping();
    if (pong === 'PONG') {
      redisAvailable = true;
      redisChecked = true;
      logger.info('Redis connection verified');
    }
  } catch (error) {
    redisChecked = true;
    redisAvailable = false;
    logger.info('Redis not available - continuing without cache');
    // Disconnect to stop retry attempts
    if (redis) {
      try {
        redis.disconnect();
      } catch {
        // Ignore disconnect errors
      }
    }
  }
};

/**
 * Disconnect from Redis
 *
 * Should be called during graceful shutdown.
 */
export const disconnectRedis = async (): Promise<void> => {
  if (redis) {
    await redis.quit();
    redis = null;
    logger.info('Redis disconnected');
  }
};

/**
 * Cache service for common operations
 * All methods gracefully handle Redis being unavailable
 */
export const cacheService = {
  /**
   * Get a value from cache
   *
   * @param key - Cache key
   * @returns Cached value or null
   */
  async get<T>(key: string): Promise<T | null> {
    if (!redisAvailable) return null;
    const client = getRedisClient();
    if (!client) return null;
    try {
      const value = await client.get(key);
      if (!value) return null;
      return JSON.parse(value) as T;
    } catch {
      return null;
    }
  },

  /**
   * Set a value in cache
   *
   * @param key - Cache key
   * @param value - Value to cache
   * @param ttlSeconds - Time to live in seconds (default: 1 hour)
   */
  async set(key: string, value: unknown, ttlSeconds: number = 3600): Promise<void> {
    if (!redisAvailable) return;
    const client = getRedisClient();
    if (!client) return;
    try {
      const serialized = typeof value === 'string' ? value : JSON.stringify(value);
      await client.setex(key, ttlSeconds, serialized);
    } catch {
      // Silently fail - caching is optional
    }
  },

  /**
   * Delete a value from cache
   *
   * @param key - Cache key
   */
  async delete(key: string): Promise<void> {
    if (!redisAvailable) return;
    const client = getRedisClient();
    if (!client) return;
    try {
      await client.del(key);
    } catch {
      // Silently fail
    }
  },

  /**
   * Delete multiple values matching a pattern
   *
   * @param pattern - Key pattern (e.g., "user:*")
   */
  async deletePattern(pattern: string): Promise<void> {
    if (!redisAvailable) return;
    const client = getRedisClient();
    if (!client) return;
    try {
      const keys = await client.keys(pattern);
      if (keys.length > 0) {
        await client.del(...keys);
      }
    } catch {
      // Silently fail
    }
  },

  /**
   * Check if a key exists
   *
   * @param key - Cache key
   * @returns True if key exists
   */
  async exists(key: string): Promise<boolean> {
    if (!redisAvailable) return false;
    const client = getRedisClient();
    if (!client) return false;
    try {
      const result = await client.exists(key);
      return result === 1;
    } catch {
      return false;
    }
  },

  /**
   * Get remaining TTL for a key
   *
   * @param key - Cache key
   * @returns TTL in seconds, -1 if no TTL, -2 if key doesn't exist
   */
  async ttl(key: string): Promise<number> {
    if (!redisAvailable) return -2;
    const client = getRedisClient();
    if (!client) return -2;
    try {
      return await client.ttl(key);
    } catch {
      return -2;
    }
  },
};

export { redis };
export default getRedisClient;

/**
 * Redis connection configuration for BullMQ
 * BullMQ requires connection options or an IORedis instance
 */
const redisUrl = new URL(config.redis.url);
export const redisConnection = {
  host: redisUrl.hostname || 'localhost',
  port: parseInt(redisUrl.port || '6379', 10),
  password: redisUrl.password || undefined,
  maxRetriesPerRequest: null, // Required for BullMQ
};
