/**
 * Logout Use Case
 *
 * Handles user logout by revoking refresh tokens.
 *
 * @module application/use-cases/auth/LogoutUseCase
 */

import { IRefreshTokenRepository } from '../../../domain/repositories/IRefreshTokenRepository';
import { UserId } from '../../../domain/entities/User';
import { logger } from '../../../shared/logger';

/**
 * Logout use case
 */
export class LogoutUseCase {
  constructor(
    private readonly refreshTokenRepository: IRefreshTokenRepository
  ) {}

  /**
   * Execute logout (revoke single token)
   *
   * @param refreshToken - Token to revoke
   */
  async execute(refreshToken: string): Promise<void> {
    logger.debug('Logout: revoking refresh token');

    await this.refreshTokenRepository.revoke(refreshToken);

    logger.debug('Refresh token revoked');
  }

  /**
   * Execute logout from all devices (revoke all tokens)
   *
   * @param userId - User ID
   */
  async logoutAll(userId: UserId): Promise<void> {
    logger.info('Logout all: revoking all refresh tokens', { userId });

    await this.refreshTokenRepository.revokeAllForUser(userId);

    logger.info('All refresh tokens revoked', { userId });
  }
}
