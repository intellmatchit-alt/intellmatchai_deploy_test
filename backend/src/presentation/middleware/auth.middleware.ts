/**
 * Authentication Middleware
 *
 * Protects routes by verifying JWT access tokens.
 *
 * @module presentation/middleware/auth.middleware
 */

import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken, AccessTokenPayload } from '../../infrastructure/auth/jwt';
import { AuthenticationError } from '../../shared/errors';
import { logger } from '../../shared/logger';

/**
 * Extend Express Request with user info
 */
declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        email: string;
      };
    }
  }
}

/**
 * Extract token from Authorization header
 */
function extractToken(req: Request): string | null {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return null;
  }

  // Support both "Bearer token" and just "token"
  if (authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }

  return authHeader;
}

/**
 * Authentication middleware
 *
 * Verifies JWT access token and attaches user info to request.
 * Throws AuthenticationError if token is invalid or missing.
 */
export function authenticate(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  try {
    const token = extractToken(req);

    if (!token) {
      throw new AuthenticationError('No authentication token provided');
    }

    const payload = verifyAccessToken(token);

    if (!payload) {
      throw new AuthenticationError('Invalid or expired access token');
    }

    // Attach user info to request
    req.user = {
      userId: payload.userId,
      email: payload.email,
    };

    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Optional authentication middleware
 *
 * Same as authenticate but doesn't throw if token is missing.
 * Useful for routes that work for both authenticated and anonymous users.
 */
export function optionalAuth(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  try {
    const token = extractToken(req);

    if (!token) {
      // No token - continue without user
      return next();
    }

    const payload = verifyAccessToken(token);

    if (payload) {
      req.user = {
        userId: payload.userId,
        email: payload.email,
      };
    }

    next();
  } catch (error) {
    // Log but don't throw - continue without user
    logger.debug('Optional auth failed', { error });
    next();
  }
}

/**
 * Require specific user
 *
 * Middleware factory that ensures the authenticated user matches a specific user ID.
 * Useful for routes that should only be accessible by the resource owner.
 *
 * @param getUserId - Function to extract user ID from request
 */
export function requireUser(
  getUserId: (req: Request) => string
): (req: Request, res: Response, next: NextFunction) => void {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      if (!req.user) {
        throw new AuthenticationError('Authentication required');
      }

      const targetUserId = getUserId(req);

      if (req.user.userId !== targetUserId) {
        throw new AuthenticationError('Not authorized to access this resource');
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}
