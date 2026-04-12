/**
 * Refresh Token Repository Interface
 *
 * Defines the contract for refresh token data access.
 *
 * @module domain/repositories/IRefreshTokenRepository
 */

import { UserId } from '../entities/User';

/**
 * Refresh token entity
 */
export interface RefreshToken {
  id: string;
  token: string;
  userId: UserId;
  expiresAt: Date;
  createdAt: Date;
  revokedAt?: Date;
  userAgent?: string;
  ipAddress?: string;
}

/**
 * Refresh token repository interface
 */
export interface IRefreshTokenRepository {
  /**
   * Find refresh token by token string
   */
  findByToken(token: string): Promise<RefreshToken | null>;

  /**
   * Find all active tokens for a user
   */
  findActiveByUserId(userId: UserId): Promise<RefreshToken[]>;

  /**
   * Create a new refresh token
   */
  create(data: {
    token: string;
    userId: UserId;
    expiresAt: Date;
    userAgent?: string;
    ipAddress?: string;
  }): Promise<RefreshToken>;

  /**
   * Revoke a refresh token
   */
  revoke(token: string, replacedByToken?: string): Promise<void>;

  /**
   * Revoke all tokens for a user
   */
  revokeAllForUser(userId: UserId): Promise<void>;

  /**
   * Delete expired tokens (cleanup)
   */
  deleteExpired(): Promise<number>;
}
