/**
 * JWT Utilities
 *
 * JSON Web Token generation and verification.
 *
 * @module infrastructure/auth/jwt
 */

import jwt, { SignOptions } from 'jsonwebtoken';
import crypto from 'crypto';
import { config } from '../../config';
import { UserId } from '../../domain/entities/User';

/**
 * Access token payload
 */
export interface AccessTokenPayload {
  userId: UserId;
  email: string;
  type: 'access';
}

/**
 * Refresh token payload
 */
export interface RefreshTokenPayload {
  userId: UserId;
  tokenId: string;
  type: 'refresh';
}

/**
 * Token pair
 */
export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: Date;
  refreshTokenExpiresAt: Date;
}

/**
 * Generate an access token
 *
 * @param payload - Token payload
 * @returns JWT access token
 */
export function generateAccessToken(
  payload: Omit<AccessTokenPayload, 'type'>
): string {
  return jwt.sign(
    { ...payload, type: 'access' },
    config.jwt.secret,
    { expiresIn: config.jwt.accessExpiry } as SignOptions
  );
}

/**
 * Generate a refresh token
 *
 * @param payload - Token payload
 * @returns JWT refresh token
 */
export function generateRefreshToken(
  payload: Omit<RefreshTokenPayload, 'type'>
): string {
  return jwt.sign(
    { ...payload, type: 'refresh' },
    config.jwt.refreshSecret,
    { expiresIn: config.jwt.refreshExpiry } as SignOptions
  );
}

/**
 * Generate a token pair (access + refresh)
 *
 * @param userId - User ID
 * @param email - User email
 * @returns Token pair with expiration times
 */
export function generateTokenPair(userId: UserId, email: string): TokenPair {
  const tokenId = crypto.randomUUID();

  const accessToken = generateAccessToken({ userId, email });
  const refreshToken = generateRefreshToken({ userId, tokenId });

  // Calculate expiration times
  const accessTokenExpiresAt = new Date(
    Date.now() + parseExpiresIn(config.jwt.accessExpiry)
  );
  const refreshTokenExpiresAt = new Date(
    Date.now() + parseExpiresIn(config.jwt.refreshExpiry)
  );

  return {
    accessToken,
    refreshToken,
    accessTokenExpiresAt,
    refreshTokenExpiresAt,
  };
}

/**
 * Verify an access token
 *
 * @param token - JWT token
 * @returns Decoded payload or null if invalid
 */
export function verifyAccessToken(token: string): AccessTokenPayload | null {
  try {
    const payload = jwt.verify(token, config.jwt.secret) as AccessTokenPayload;

    if (payload.type !== 'access') {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

/**
 * Verify a refresh token
 *
 * @param token - JWT token
 * @returns Decoded payload or null if invalid
 */
export function verifyRefreshToken(token: string): RefreshTokenPayload | null {
  try {
    const payload = jwt.verify(
      token,
      config.jwt.refreshSecret
    ) as RefreshTokenPayload;

    if (payload.type !== 'refresh') {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

/**
 * Decode a token without verification (for getting payload from expired tokens)
 *
 * @param token - JWT token
 * @returns Decoded payload or null
 */
export function decodeToken<T>(token: string): T | null {
  try {
    const decoded = jwt.decode(token);
    return decoded as T;
  } catch {
    return null;
  }
}

/**
 * Parse expires in string to milliseconds
 *
 * @param expiresIn - Expiration string (e.g., '15m', '7d')
 * @returns Milliseconds
 */
function parseExpiresIn(expiresIn: string): number {
  const match = expiresIn.match(/^(\d+)([smhd])$/);

  if (!match) {
    throw new Error(`Invalid expiresIn format: ${expiresIn}`);
  }

  const value = parseInt(match[1], 10);
  const unit = match[2];

  switch (unit) {
    case 's':
      return value * 1000;
    case 'm':
      return value * 60 * 1000;
    case 'h':
      return value * 60 * 60 * 1000;
    case 'd':
      return value * 24 * 60 * 60 * 1000;
    default:
      throw new Error(`Invalid expiresIn unit: ${unit}`);
  }
}

/**
 * Get expiration date from expires in string
 *
 * @param expiresIn - Expiration string
 * @returns Expiration date
 */
export function getExpirationDate(expiresIn: string): Date {
  return new Date(Date.now() + parseExpiresIn(expiresIn));
}
