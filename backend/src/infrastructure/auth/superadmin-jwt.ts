/**
 * Superadmin JWT Authentication
 *
 * Completely separate JWT system for superadmin accounts.
 * Uses a different secret and token type from regular user auth.
 *
 * @module infrastructure/auth/superadmin-jwt
 */

import jwt, { SignOptions } from 'jsonwebtoken';
import { config } from '../../config/index';

export interface SuperAdminTokenPayload {
  adminId: string;
  email: string;
  role: string;
  type: 'superadmin_access';
}

/**
 * Generate a JWT token for a superadmin
 */
export function generateSuperAdminToken(payload: Omit<SuperAdminTokenPayload, 'type'>): string {
  return jwt.sign(
    { ...payload, type: 'superadmin_access' },
    config.superadmin.jwtSecret,
    { expiresIn: config.superadmin.jwtExpiry } as SignOptions
  );
}

/**
 * Verify a superadmin JWT token
 */
export function verifySuperAdminToken(token: string): SuperAdminTokenPayload | null {
  try {
    const payload = jwt.verify(token, config.superadmin.jwtSecret) as SuperAdminTokenPayload;
    if (payload.type !== 'superadmin_access') return null;
    return payload;
  } catch {
    return null;
  }
}
