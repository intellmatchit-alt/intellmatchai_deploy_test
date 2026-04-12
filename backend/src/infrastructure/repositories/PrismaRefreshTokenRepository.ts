/**
 * Prisma Refresh Token Repository
 *
 * Database implementation of IRefreshTokenRepository using Prisma.
 *
 * @module infrastructure/repositories/PrismaRefreshTokenRepository
 */

import { prisma } from '../database/prisma/client';
import {
  IRefreshTokenRepository,
  RefreshToken,
} from '../../domain/repositories/IRefreshTokenRepository';
import { UserId } from '../../domain/entities/User';

/**
 * Prisma Refresh Token Repository implementation
 */
export class PrismaRefreshTokenRepository implements IRefreshTokenRepository {
  /**
   * Find refresh token by token string
   */
  async findByToken(token: string): Promise<RefreshToken | null> {
    const refreshToken = await prisma.refreshToken.findUnique({
      where: { token },
    });

    if (!refreshToken) return null;

    return this.toDomainEntity(refreshToken);
  }

  /**
   * Find all active tokens for a user
   */
  async findActiveByUserId(userId: UserId): Promise<RefreshToken[]> {
    const tokens = await prisma.refreshToken.findMany({
      where: {
        userId,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    return tokens.map(this.toDomainEntity);
  }

  /**
   * Create a new refresh token
   */
  async create(data: {
    token: string;
    userId: UserId;
    expiresAt: Date;
    userAgent?: string;
    ipAddress?: string;
  }): Promise<RefreshToken> {
    const refreshToken = await prisma.refreshToken.create({
      data: {
        token: data.token,
        userId: data.userId,
        expiresAt: data.expiresAt,
        userAgent: data.userAgent,
        ipAddress: data.ipAddress,
      },
    });

    return this.toDomainEntity(refreshToken);
  }

  /**
   * Revoke a refresh token
   */
  async revoke(token: string, _replacedByToken?: string): Promise<void> {
    await prisma.refreshToken.update({
      where: { token },
      data: {
        revokedAt: new Date(),
      },
    });
  }

  /**
   * Revoke all tokens for a user
   */
  async revokeAllForUser(userId: UserId): Promise<void> {
    await prisma.refreshToken.updateMany({
      where: {
        userId,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });
  }

  /**
   * Delete expired tokens (cleanup)
   */
  async deleteExpired(): Promise<number> {
    const result = await prisma.refreshToken.deleteMany({
      where: {
        OR: [
          { expiresAt: { lt: new Date() } },
          { revokedAt: { not: null } },
        ],
      },
    });

    return result.count;
  }

  /**
   * Convert Prisma model to domain entity
   */
  private toDomainEntity(prismaToken: any): RefreshToken {
    return {
      id: prismaToken.id,
      token: prismaToken.token,
      userId: prismaToken.userId,
      expiresAt: prismaToken.expiresAt,
      createdAt: prismaToken.createdAt,
      revokedAt: prismaToken.revokedAt || undefined,
      userAgent: prismaToken.userAgent || undefined,
      ipAddress: prismaToken.ipAddress || undefined,
    };
  }
}
