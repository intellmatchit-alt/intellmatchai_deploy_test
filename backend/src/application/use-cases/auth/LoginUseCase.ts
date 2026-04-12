/**
 * Login Use Case
 *
 * Handles user authentication.
 *
 * @module application/use-cases/auth/LoginUseCase
 */

import { IUserRepository } from '../../../domain/repositories/IUserRepository';
import { IRefreshTokenRepository } from '../../../domain/repositories/IRefreshTokenRepository';
import { User } from '../../../domain/entities/User';
import { verifyPassword } from '../../../infrastructure/auth/password';
import { generateTokenPair } from '../../../infrastructure/auth/jwt';
import { LoginDTO, AuthResponseDTO, UserDTO } from '../../dto/auth.dto';
import { AuthenticationError } from '../../../shared/errors';
import { logger } from '../../../shared/logger';
import { getRedisClient } from '../../../infrastructure/database/redis/client';

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_SECONDS = 15 * 60; // 15 minutes

/**
 * Login use case
 */
export class LoginUseCase {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly refreshTokenRepository: IRefreshTokenRepository
  ) {}

  /**
   * Execute login
   *
   * @param dto - Login credentials
   * @returns Auth response with tokens
   */
  async execute(dto: LoginDTO): Promise<AuthResponseDTO> {
    logger.info('Login attempt', { email: dto.email });

    const email = dto.email.toLowerCase().trim();
    const lockoutKey = `login_lockout:${email}`;
    const attemptsKey = `login_attempts:${email}`;

    // Check account lockout
    try {
      const redis = getRedisClient();
      if (redis) {
        const lockout = await redis.get(lockoutKey);
        if (lockout) {
          const ttl = await redis.ttl(lockoutKey);
          logger.warn('Login blocked: account locked', { email });
          throw new AuthenticationError(
            `Account temporarily locked due to too many failed attempts. Try again in ${Math.ceil(ttl / 60)} minutes.`
          );
        }
      }
    } catch (err) {
      if (err instanceof AuthenticationError) throw err;
      // Redis failure shouldn't block login
      logger.error('Redis lockout check failed', { error: err });
    }

    // Find user by email
    const user = await this.userRepository.findByEmail(email);

    if (!user) {
      logger.warn('Login failed: user not found', { email: dto.email });
      this.incrementFailedAttempts(attemptsKey, lockoutKey, email);
      throw new AuthenticationError('Invalid email or password');
    }

    // Check if user is active
    if (!user.isActive) {
      logger.warn('Login failed: user deactivated', { userId: user.id });
      throw new AuthenticationError('Account has been deactivated');
    }

    // Verify password
    const isPasswordValid = await verifyPassword(dto.password, user.passwordHash);

    if (!isPasswordValid) {
      logger.warn('Login failed: invalid password', { userId: user.id });
      this.incrementFailedAttempts(attemptsKey, lockoutKey, email);
      throw new AuthenticationError('Invalid email or password');
    }

    // Clear failed attempts on successful login
    try {
      const redis = getRedisClient();
      if (redis) await redis.del(attemptsKey);
    } catch { /* ignore */ }

    // Update last login
    await this.userRepository.updateLastLogin(user.id);

    // Generate tokens
    const tokenPair = generateTokenPair(user.id, user.email);

    // Save refresh token
    await this.refreshTokenRepository.create({
      token: tokenPair.refreshToken,
      userId: user.id,
      expiresAt: tokenPair.refreshTokenExpiresAt,
      userAgent: dto.userAgent,
      ipAddress: dto.ipAddress,
    });

    logger.info('User logged in successfully', { userId: user.id });

    return {
      user: this.toUserDTO(user),
      accessToken: tokenPair.accessToken,
      refreshToken: tokenPair.refreshToken,
      expiresAt: tokenPair.accessTokenExpiresAt,
    };
  }

  /**
   * Increment failed login attempts, lock account if threshold exceeded
   */
  private incrementFailedAttempts(attemptsKey: string, lockoutKey: string, email: string): void {
    try {
      const redis = getRedisClient();
      if (!redis) return;
      redis.incr(attemptsKey).then(async (attempts) => {
        if (attempts === 1) {
          await redis.expire(attemptsKey, LOCKOUT_DURATION_SECONDS);
        }
        if (attempts >= MAX_FAILED_ATTEMPTS) {
          await redis.set(lockoutKey, '1', 'EX', LOCKOUT_DURATION_SECONDS);
          await redis.del(attemptsKey);
          logger.warn('Account locked due to failed attempts', { email, attempts });
        }
      }).catch((err) => {
        logger.error('Failed to track login attempts', { error: err });
      });
    } catch { /* ignore Redis failures */ }
  }

  /**
   * Convert User entity to UserDTO
   */
  private toUserDTO(user: User): UserDTO {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      title: user.title,
      firstName: user.firstName,
      middleName: user.middleName,
      lastName: user.lastName,
      phone: user.phone,
      company: user.company,
      jobTitle: user.jobTitle,
      bio: user.bio,
      avatarUrl: user.avatarUrl,
      linkedInUrl: user.linkedInUrl,
      websiteUrl: user.websiteUrl,
      location: user.location,
      preferredLocale: user.preferredLocale,
      isEmailVerified: user.isEmailVerified,
      hasCompletedOnboarding: user.hasCompletedOnboarding(),
      createdAt: user.createdAt,
    };
  }
}
