/**
 * Opportunity Rate Limiter
 *
 * Redis-backed rate limiting for opportunity matching API.
 * Prevents abuse and ensures fair resource allocation.
 *
 * @module middleware/opportunity-rate-limiter
 */

import { Request, Response, NextFunction } from 'express';
import { RateLimiterRedis, RateLimiterMemory, RateLimiterRes } from 'rate-limiter-flexible';
import { Redis } from 'ioredis';
import { logger } from '../../../../shared/logger';
import { config } from '../../../../config';

// ============================================================================
// Types
// ============================================================================

interface RateLimitConfig {
  /** Maximum requests per window */
  points: number;
  /** Window duration in seconds */
  duration: number;
  /** Block duration when limit exceeded (seconds) */
  blockDuration: number;
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
  retryAfter?: number;
}

// ============================================================================
// Configuration
// ============================================================================

const RATE_LIMIT_CONFIGS: Record<string, RateLimitConfig> = {
  // Standard matching requests
  standard: {
    points: 10,
    duration: 60, // 10 requests per minute
    blockDuration: 60,
  },
  // Async job submissions
  async: {
    points: 5,
    duration: 60, // 5 async jobs per minute
    blockDuration: 120,
  },
  // Status checks (more lenient)
  status: {
    points: 60,
    duration: 60, // 60 status checks per minute
    blockDuration: 30,
  },
  // Burst protection (short window)
  burst: {
    points: 5,
    duration: 10, // 5 requests per 10 seconds
    blockDuration: 30,
  },
};

// ============================================================================
// Rate Limiter Factory
// ============================================================================

let redisClient: Redis | null = null;
const limiters: Map<string, RateLimiterRedis | RateLimiterMemory> = new Map();

/**
 * Initialize Redis client for rate limiting
 */
export function initializeRateLimiter(redis?: Redis): void {
  if (redis) {
    redisClient = redis;
    logger.info('Rate limiter initialized with Redis');
  } else if (config.redis?.url) {
    try {
      redisClient = new Redis(config.redis.url, {
        maxRetriesPerRequest: 3,
        enableReadyCheck: true,
        lazyConnect: true,
      });
      redisClient.connect().catch(err => {
        logger.warn('Redis connection failed, falling back to memory', { error: err.message });
        redisClient = null;
      });
      logger.info('Rate limiter Redis client created');
    } catch (error) {
      logger.warn('Failed to create Redis client, using memory limiter', {
        error: error instanceof Error ? error.message : 'Unknown',
      });
    }
  } else {
    logger.info('Rate limiter using in-memory storage (no Redis configured)');
  }
}

/**
 * Get or create rate limiter for a specific config
 */
function getLimiter(configName: string): RateLimiterRedis | RateLimiterMemory {
  if (limiters.has(configName)) {
    return limiters.get(configName)!;
  }

  const limitConfig = RATE_LIMIT_CONFIGS[configName] || RATE_LIMIT_CONFIGS.standard;

  let limiter: RateLimiterRedis | RateLimiterMemory;

  if (redisClient) {
    limiter = new RateLimiterRedis({
      storeClient: redisClient,
      keyPrefix: `opp_rate_${configName}`,
      points: limitConfig.points,
      duration: limitConfig.duration,
      blockDuration: limitConfig.blockDuration,
    });
  } else {
    limiter = new RateLimiterMemory({
      keyPrefix: `opp_rate_${configName}`,
      points: limitConfig.points,
      duration: limitConfig.duration,
      blockDuration: limitConfig.blockDuration,
    });
  }

  limiters.set(configName, limiter);
  return limiter;
}

// ============================================================================
// Rate Limit Check
// ============================================================================

/**
 * Check rate limit for a key
 */
export async function checkRateLimit(
  key: string,
  configName: string = 'standard'
): Promise<RateLimitResult> {
  const limiter = getLimiter(configName);

  try {
    const result = await limiter.consume(key, 1);
    return {
      allowed: true,
      remaining: result.remainingPoints,
      resetAt: new Date(Date.now() + result.msBeforeNext),
    };
  } catch (error) {
    if (error instanceof RateLimiterRes) {
      return {
        allowed: false,
        remaining: 0,
        resetAt: new Date(Date.now() + error.msBeforeNext),
        retryAfter: Math.ceil(error.msBeforeNext / 1000),
      };
    }
    // On error, allow request but log
    logger.warn('Rate limiter error, allowing request', {
      key,
      error: error instanceof Error ? error.message : 'Unknown',
    });
    return {
      allowed: true,
      remaining: -1,
      resetAt: new Date(),
    };
  }
}

/**
 * Get remaining points without consuming
 */
export async function getRateLimitStatus(
  key: string,
  configName: string = 'standard'
): Promise<{ remaining: number; resetAt: Date }> {
  const limiter = getLimiter(configName);

  try {
    const result = await limiter.get(key);
    if (!result) {
      const limitConfig = RATE_LIMIT_CONFIGS[configName] || RATE_LIMIT_CONFIGS.standard;
      return {
        remaining: limitConfig.points,
        resetAt: new Date(Date.now() + limitConfig.duration * 1000),
      };
    }
    return {
      remaining: result.remainingPoints,
      resetAt: new Date(Date.now() + result.msBeforeNext),
    };
  } catch (error) {
    logger.warn('Failed to get rate limit status', {
      key,
      error: error instanceof Error ? error.message : 'Unknown',
    });
    return {
      remaining: -1,
      resetAt: new Date(),
    };
  }
}

// ============================================================================
// Express Middleware
// ============================================================================

/**
 * Rate limit middleware factory
 */
export function rateLimitMiddleware(configName: string = 'standard') {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    // Extract key from user ID or IP
    const userId = (req as any).userId || (req as any).user?.id;
    const key = userId || req.ip || 'anonymous';

    const result = await checkRateLimit(key, configName);

    // Set rate limit headers
    res.setHeader('X-RateLimit-Remaining', result.remaining.toString());
    res.setHeader('X-RateLimit-Reset', result.resetAt.toISOString());

    if (!result.allowed) {
      res.setHeader('Retry-After', result.retryAfter?.toString() || '60');

      logger.warn('Rate limit exceeded', {
        key,
        configName,
        retryAfter: result.retryAfter,
        path: req.path,
      });

      res.status(429).json({
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many requests. Please try again later.',
          retryAfter: result.retryAfter,
          resetAt: result.resetAt.toISOString(),
        },
      });
      return;
    }

    next();
  };
}

/**
 * Standard rate limiter for matching endpoints
 */
export const standardRateLimiter = rateLimitMiddleware('standard');

/**
 * Async job rate limiter
 */
export const asyncRateLimiter = rateLimitMiddleware('async');

/**
 * Status check rate limiter
 */
export const statusRateLimiter = rateLimitMiddleware('status');

/**
 * Burst protection rate limiter
 */
export const burstRateLimiter = rateLimitMiddleware('burst');

// ============================================================================
// Cleanup
// ============================================================================

/**
 * Close Redis connection
 */
export async function closeRateLimiter(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
  }
  limiters.clear();
  logger.info('Rate limiter closed');
}
