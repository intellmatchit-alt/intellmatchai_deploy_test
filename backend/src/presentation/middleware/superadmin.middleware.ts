/**
 * Superadmin Authentication Middleware
 *
 * Completely separate middleware from regular user authentication.
 * Validates superadmin JWT tokens and enforces role-based access.
 *
 * @module presentation/middleware/superadmin
 */

import { Request, Response, NextFunction } from 'express';
import { verifySuperAdminToken } from '../../infrastructure/auth/superadmin-jwt.js';

declare global {
  namespace Express {
    interface Request {
      superAdmin?: {
        adminId: string;
        email: string;
        role: string;
      };
    }
  }
}

/**
 * Authenticate superadmin from Bearer token
 */
export function authenticateSuperAdmin(req: Request, res: Response, next: NextFunction): void {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;

    if (!token) {
      res.status(401).json({ success: false, error: 'No authentication token provided' });
      return;
    }

    const payload = verifySuperAdminToken(token);
    if (!payload) {
      res.status(401).json({ success: false, error: 'Invalid or expired token' });
      return;
    }

    req.superAdmin = {
      adminId: payload.adminId,
      email: payload.email,
      role: payload.role,
    };

    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Require specific admin role(s)
 */
export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.superAdmin) {
      res.status(401).json({ success: false, error: 'Authentication required' });
      return;
    }
    if (!roles.includes(req.superAdmin.role)) {
      res.status(403).json({ success: false, error: `Required role: ${roles.join(' or ')}` });
      return;
    }
    next();
  };
}
