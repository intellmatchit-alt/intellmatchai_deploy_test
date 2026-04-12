/**
 * Cache Service
 *
 * Provides Redis-based caching for frequently accessed data.
 * Falls back gracefully when Redis is unavailable.
 *
 * @module infrastructure/cache/CacheService
 */

import Redis from "ioredis";
import { logger } from "../../shared/logger";

// Cache TTL constants (in seconds)
export const CACHE_TTL = {
  SECTORS: 3600, // 1 hour
  SKILLS: 3600, // 1 hour
  INTERESTS: 3600, // 1 hour
  HOBBIES: 3600, // 1 hour
  LOOKUP_LIST: 1800, // 30 minutes
  DASHBOARD: 300, // 5 minutes
  USER_PROFILE: 600, // 10 minutes
  // Matching cache TTLs
  CONTACT_MATCHES: 900, // 15 minutes - contact matching results
  PROJECT_MATCHES: 600, // 10 minutes - project matching results
  OPPORTUNITY_MATCHES: 600, // 10 minutes - opportunity matching results
  MATCH_DETAILS: 1800, // 30 minutes - detailed match info
};

// Cache key prefixes
export const CACHE_KEYS = {
  SECTORS_LIST: "lookup:sectors:list",
  SKILLS_LIST: "lookup:skills:list",
  INTERESTS_LIST: "lookup:interests:list",
  HOBBIES_LIST: "lookup:hobbies:list",
  SECTOR_BY_ID: "lookup:sector:",
  SKILL_BY_ID: "lookup:skill:",
  INTEREST_BY_ID: "lookup:interest:",
  HOBBY_BY_ID: "lookup:hobby:",
  DASHBOARD_STATS: "dashboard:stats:",
  DASHBOARD_HEALTH: "dashboard:health:",
  USER_PROFILE: "user:profile:",
  // Matching cache keys
  CONTACT_MATCHES: "matching:contacts:", // matching:contacts:{userId}
  CONTACT_MATCH_DETAIL: "matching:detail:", // matching:detail:{userId}:{contactId}
  PROJECT_MATCHES: "matching:project:", // matching:project:{projectId}
  OPPORTUNITY_MATCHES: "matching:opportunity:", // matching:opportunity:{intentId}
};

class CacheService {
  private redis: Redis | null = null;
  private isConnected: boolean = false;

  constructor() {
    this.initializeRedis();
  }

  /**
   * Initialize Redis connection
   */
  private initializeRedis(): void {
    const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";

    try {
      this.redis = new Redis(redisUrl, {
        maxRetriesPerRequest: 3,
        retryStrategy: (times) => {
          if (times > 3) {
            logger.warn("Redis connection failed, caching disabled", {
              service: "p2p-api",
              component: "CacheService",
            });
            return null; // Stop retrying
          }
          return Math.min(times * 100, 3000);
        },
        lazyConnect: true,
      });

      this.redis.on("connect", () => {
        this.isConnected = true;
        logger.info("Redis connected", {
          service: "p2p-api",
          component: "CacheService",
        });
      });

      this.redis.on("error", (error) => {
        this.isConnected = false;
        logger.warn("Redis error", {
          service: "p2p-api",
          component: "CacheService",
          error: error.message,
        });
      });

      this.redis.on("close", () => {
        this.isConnected = false;
      });

      // Attempt connection
      this.redis.connect().catch(() => {
        this.isConnected = false;
      });
    } catch (error) {
      logger.warn("Failed to initialize Redis", {
        service: "p2p-api",
        component: "CacheService",
        error,
      });
    }
  }

  /**
   * Check if cache is available
   */
  isAvailable(): boolean {
    return this.isConnected && this.redis !== null;
  }

  /**
   * Get value from cache
   */
  async get<T>(key: string): Promise<T | null> {
    if (!this.isAvailable()) return null;

    try {
      const value = await this.redis!.get(key);
      if (value) {
        return JSON.parse(value) as T;
      }
      return null;
    } catch (error) {
      logger.debug("Cache get error", {
        service: "p2p-api",
        component: "CacheService",
        key,
        error,
      });
      return null;
    }
  }

  /**
   * Set value in cache
   */
  async set(
    key: string,
    value: unknown,
    ttlSeconds: number = 3600,
  ): Promise<boolean> {
    if (!this.isAvailable()) return false;

    try {
      await this.redis!.setex(key, ttlSeconds, JSON.stringify(value));
      return true;
    } catch (error) {
      logger.debug("Cache set error", {
        service: "p2p-api",
        component: "CacheService",
        key,
        error,
      });
      return false;
    }
  }

  /**
   * Delete value from cache
   */
  async delete(key: string): Promise<boolean> {
    if (!this.isAvailable()) return false;

    try {
      await this.redis!.del(key);
      return true;
    } catch (error) {
      logger.debug("Cache delete error", {
        service: "p2p-api",
        component: "CacheService",
        key,
        error,
      });
      return false;
    }
  }

  /**
   * Delete all keys matching a pattern
   */
  async deletePattern(pattern: string): Promise<boolean> {
    if (!this.isAvailable()) return false;

    try {
      const keys = await this.redis!.keys(pattern);
      if (keys.length > 0) {
        await this.redis!.del(...keys);
      }
      return true;
    } catch (error) {
      logger.debug("Cache deletePattern error", {
        service: "p2p-api",
        component: "CacheService",
        pattern,
        error,
      });
      return false;
    }
  }

  /**
   * Invalidate lookup caches
   */
  async invalidateLookupCache(
    type: "sectors" | "skills" | "interests" | "hobbies",
  ): Promise<void> {
    const patterns = {
      sectors: [CACHE_KEYS.SECTORS_LIST + "*", CACHE_KEYS.SECTOR_BY_ID + "*"],
      skills: [CACHE_KEYS.SKILLS_LIST + "*", CACHE_KEYS.SKILL_BY_ID + "*"],
      interests: [
        CACHE_KEYS.INTERESTS_LIST + "*",
        CACHE_KEYS.INTEREST_BY_ID + "*",
      ],
      hobbies: [CACHE_KEYS.HOBBIES_LIST + "*", CACHE_KEYS.HOBBY_BY_ID + "*"],
    };

    for (const pattern of patterns[type]) {
      await this.deletePattern(pattern);
    }
  }

  /**
   * Invalidate user-specific caches
   */
  async invalidateUserCache(userId: string): Promise<void> {
    await this.deletePattern(CACHE_KEYS.DASHBOARD_STATS + userId + "*");
    await this.deletePattern(CACHE_KEYS.DASHBOARD_HEALTH + userId + "*");
    await this.delete(CACHE_KEYS.USER_PROFILE + userId);
  }

  /**
   * Invalidate contact matching caches for a user
   */
  async invalidateContactMatchCache(userId: string): Promise<void> {
    await this.deletePattern(CACHE_KEYS.CONTACT_MATCHES + userId + "*");
    await this.deletePattern(CACHE_KEYS.CONTACT_MATCH_DETAIL + userId + ":*");
  }

  /**
   * Invalidate project matching caches
   */
  async invalidateProjectMatchCache(projectId: string): Promise<void> {
    await this.deletePattern(CACHE_KEYS.PROJECT_MATCHES + projectId + "*");
  }

  /**
   * Invalidate opportunity matching caches
   */
  async invalidateOpportunityMatchCache(intentId: string): Promise<void> {
    await this.deletePattern(CACHE_KEYS.OPPORTUNITY_MATCHES + intentId + "*");
  }

  /**
   * Invalidate all matching caches for a user (when profile changes)
   */
  async invalidateAllMatchingCaches(userId: string): Promise<void> {
    await this.invalidateContactMatchCache(userId);
    // Project and opportunity caches will be invalidated separately when needed
  }

  /**
   * Get or set pattern - returns cached value or fetches and caches new value
   */
  async getOrSet<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttlSeconds: number = 3600,
  ): Promise<T> {
    // Try to get from cache first
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    // Fetch fresh data
    const fresh = await fetcher();

    // Cache the result (don't await to avoid blocking)
    this.set(key, fresh, ttlSeconds).catch(() => {
      // Ignore cache set errors
    });

    return fresh;
  }

  /**
   * Close Redis connection
   */
  async close(): Promise<void> {
    if (this.redis) {
      await this.redis.quit();
      this.isConnected = false;
    }
  }
}

// Export singleton instance
export const cacheService = new CacheService();
