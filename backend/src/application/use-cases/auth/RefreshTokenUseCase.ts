/**
 * Refresh Token Use Case
 *
 * Handles access token refresh using refresh tokens.
 *
 * @module application/use-cases/auth/RefreshTokenUseCase
 */

import { IUserRepository } from '../../../domain/repositories/IUserRepository';
import { IRefreshTokenRepository } from '../../../domain/repositories/IRefreshTokenRepository';
import { verifyRefreshToken, generateTokenPair } from '../../../infrastructure/auth/jwt';
import { RefreshTokenDTO, TokenResponseDTO } from '../../dto/auth.dto';
import { AuthenticationError } from '../../../shared/errors';
import { logger } from '../../../shared/logger';

/**
 * Refresh token use case
 */
export class RefreshTokenUseCase {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly refreshTokenRepository: IRefreshTokenRepository
  ) {}

  /**
   * Execute token refresh
   *
   * @param dto - Refresh token data
   * @returns New token pair
   */
  async execute(dto: RefreshTokenDTO): Promise<TokenResponseDTO> {
    logger.debug('Token refresh attempt');

    // Verify the JWT refresh token
    const payload = verifyRefreshToken(dto.refreshToken);

    if (!payload) {
      logger.warn('Token refresh failed: invalid token');
      throw new AuthenticationError('Invalid refresh token');
    }

    // Check if refresh token exists in database and is not revoked
    const storedToken = await this.refreshTokenRepository.findByToken(dto.refreshToken);

    if (!storedToken) {
      logger.warn('Token refresh failed: token not found in database');
      throw new AuthenticationError('Invalid refresh token');
    }

    if (storedToken.revokedAt) {
      // Token was revoked - possible token theft
      // Revoke all tokens for this user as a security measure
      logger.warn('Token refresh failed: token was revoked, revoking all user tokens', {
        userId: payload.userId,
      });
      await this.refreshTokenRepository.revokeAllForUser(payload.userId);
      throw new AuthenticationError('Refresh token has been revoked');
    }

    if (storedToken.expiresAt < new Date()) {
      logger.warn('Token refresh failed: token expired');
      throw new AuthenticationError('Refresh token has expired');
    }

    // Verify user exists and is active
    const user = await this.userRepository.findById(payload.userId);

    if (!user) {
      logger.warn('Token refresh failed: user not found', { userId: payload.userId });
      throw new AuthenticationError('User not found');
    }

    if (!user.isActive) {
      logger.warn('Token refresh failed: user deactivated', { userId: payload.userId });
      throw new AuthenticationError('Account has been deactivated');
    }

    // Generate new token pair
    const tokenPair = generateTokenPair(user.id, user.email);

    // Revoke old refresh token and create new one (rotation)
    await this.refreshTokenRepository.revoke(dto.refreshToken, tokenPair.refreshToken);

    // Save new refresh token
    await this.refreshTokenRepository.create({
      token: tokenPair.refreshToken,
      userId: user.id,
      expiresAt: tokenPair.refreshTokenExpiresAt,
      userAgent: dto.userAgent,
      ipAddress: dto.ipAddress,
    });

    logger.debug('Token refreshed successfully', { userId: user.id });

    return {
      accessToken: tokenPair.accessToken,
      refreshToken: tokenPair.refreshToken,
      expiresAt: tokenPair.accessTokenExpiresAt,
    };
  }
}
