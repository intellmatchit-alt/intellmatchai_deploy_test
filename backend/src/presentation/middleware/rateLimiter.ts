/**
 * Rate Limiter Middleware
 *
 * Protects the API from abuse by limiting request rates.
 *
 * @module presentation/middleware/rateLimiter
 */

import rateLimit from 'express-rate-limit';
import { config } from '../../config/index.js';

/**
 * General API rate limiter
 *
 * Limits requests per IP address to prevent abuse.
 */
export const rateLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.maxRequests,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests, please try again later',
    },
  },
  keyGenerator: (req) => {
    // Extract user ID from JWT token if present (rate limiter runs before auth middleware)
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      try {
        const token = authHeader.substring(7);
        const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
        if (payload.userId) return payload.userId;
      } catch {
        // Fall through to IP-based limiting
      }
    }
    return req.ip || 'anonymous';
  },
});

/**
 * Strict rate limiter for authentication endpoints
 *
 * More restrictive to prevent brute-force attacks.
 */
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per 15 minutes
  skipSuccessfulRequests: true, // Don't count successful logins
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: 'TOO_MANY_LOGIN_ATTEMPTS',
      message: 'Too many login attempts, please try again in 15 minutes',
    },
  },
});

/**
 * OCR/Scan endpoint rate limiter
 *
 * More restrictive since OCR is an expensive operation.
 */
export const scanRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 scans per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: 'SCAN_LIMIT_EXCEEDED',
      message: 'Too many scan requests, please wait a moment',
    },
  },
});

/**
 * Project Matching rate limiter (3.12)
 *
 * Restrictive rate limiter for project matching endpoints.
 * AI matching is expensive - limit to prevent abuse.
 */
export const projectMatchingRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5, // 5 match requests per minute per user
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Rate limit by user ID (authenticated endpoint)
    return (req as any).user?.userId || req.ip || 'anonymous';
  },
  message: {
    success: false,
    error: {
      code: 'MATCHING_LIMIT_EXCEEDED',
      message: 'Too many matching requests, please wait a moment before trying again',
    },
  },
});

/**
 * AI Explanation generation rate limiter
 *
 * Very restrictive since LLM calls are expensive.
 */
export const aiExplanationRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // 30 explanations per minute
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return (req as any).user?.userId || req.ip || 'anonymous';
  },
  message: {
    success: false,
    error: {
      code: 'AI_LIMIT_EXCEEDED',
      message: 'AI explanation limit reached, please wait a moment',
    },
  },
});

/**
 * Public event endpoints rate limiter
 *
 * Moderate limits for public event registration and viewing.
 * Prevents abuse while allowing legitimate event attendees.
 */
export const publicEventRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per 15 minutes per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: 'EVENT_RATE_LIMIT_EXCEEDED',
      message: 'Too many requests, please try again later',
    },
  },
});

/**
 * Public event registration rate limiter
 *
 * Stricter limit for registration to prevent spam.
 */
/**
 * AI Matching rate limiter (opportunities, deals, pitch)
 *
 * Restrictive rate limiter for AI matching endpoints.
 * 5 requests per minute per user.
 */
export const matchingRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5, // 5 match requests per minute per user
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return (req as any).user?.userId || req.ip || 'anonymous';
  },
  message: {
    success: false,
    error: {
      code: 'MATCHING_LIMIT_EXCEEDED',
      message: 'Too many matching requests, please wait a moment before trying again',
    },
  },
});

export const eventRegistrationRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // 10 registrations per hour per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: 'REGISTRATION_LIMIT_EXCEEDED',
      message: 'Too many registration attempts, please try again later',
    },
  },
});
