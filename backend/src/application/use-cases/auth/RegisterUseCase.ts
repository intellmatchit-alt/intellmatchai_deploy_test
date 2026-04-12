/**
 * Register Use Case
 *
 * Handles user registration.
 *
 * @module application/use-cases/auth/RegisterUseCase
 */

import crypto from 'crypto';
import { IUserRepository } from '../../../domain/repositories/IUserRepository';
import { IRefreshTokenRepository } from '../../../domain/repositories/IRefreshTokenRepository';
import { User } from '../../../domain/entities/User';
import { createDefaultConsent } from '../../../domain/value-objects';
import { hashPassword, validatePassword } from '../../../infrastructure/auth/password';
import { generateTokenPair } from '../../../infrastructure/auth/jwt';
import { RegisterDTO, AuthResponseDTO, UserDTO } from '../../dto/auth.dto';
import { ValidationError, ConflictError } from '../../../shared/errors';
import { logger } from '../../../shared/logger';
import { prisma } from '../../../infrastructure/database/prisma/client';
import { affiliateService } from '../../../infrastructure/services/AffiliateService';

/**
 * Register use case
 */
export class RegisterUseCase {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly refreshTokenRepository: IRefreshTokenRepository
  ) {}

  /**
   * Execute registration
   *
   * @param dto - Registration data
   * @returns Auth response with tokens
   */
  async execute(dto: RegisterDTO): Promise<AuthResponseDTO> {
    logger.info('Registering new user', { email: dto.email });

    // Validate password
    const passwordValidation = validatePassword(dto.password);
    if (!passwordValidation.isValid) {
      throw new ValidationError('Invalid password', { errors: passwordValidation.errors });
    }

    // Check if email already exists
    const emailExists = await this.userRepository.emailExists(dto.email);
    if (emailExists) {
      throw new ConflictError('Email already registered');
    }

    // Hash password
    const passwordHash = await hashPassword(dto.password);

    // Create user entity
    const userId = crypto.randomUUID();
    const user = User.create({
      id: userId,
      email: dto.email.toLowerCase().trim(),
      passwordHash,
      name: dto.name.trim(),
      title: dto.title?.trim() || undefined,
      firstName: dto.firstName?.trim() || undefined,
      middleName: dto.middleName?.trim() || undefined,
      lastName: dto.lastName?.trim() || undefined,
      preferredLocale: dto.preferredLocale || 'en',
      consent: createDefaultConsent(),
      sectors: [],
      skills: [],
      interests: [],
      goals: [],
      isEmailVerified: false,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Save user
    const savedUser = await this.userRepository.save(user);

    // Link any existing event attendee records to this user
    await this.linkAttendeeRecords(savedUser.id, savedUser.email);

    // Track affiliate referral if code provided
    if (dto.referralCode) {
      try {
        await affiliateService.trackRegistration(dto.referralCode, savedUser.id, savedUser.email);
        logger.info('Affiliate referral tracked', { userId: savedUser.id, code: dto.referralCode });
      } catch (error) {
        logger.error('Failed to track affiliate referral', {
          userId: savedUser.id,
          code: dto.referralCode,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    // Generate tokens
    const tokenPair = generateTokenPair(savedUser.id, savedUser.email);

    // Save refresh token
    await this.refreshTokenRepository.create({
      token: tokenPair.refreshToken,
      userId: savedUser.id,
      expiresAt: tokenPair.refreshTokenExpiresAt,
    });

    logger.info('User registered successfully', { userId: savedUser.id });

    return {
      user: this.toUserDTO(savedUser),
      accessToken: tokenPair.accessToken,
      refreshToken: tokenPair.refreshToken,
      expiresAt: tokenPair.accessTokenExpiresAt,
    };
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

  /**
   * Link existing EventAttendee records to the newly registered user
   *
   * This allows users who attended events as guests (before creating an account)
   * to see their event history after registration.
   *
   * @param userId - The new user's ID
   * @param email - The user's email address
   */
  private async linkAttendeeRecords(userId: string, email: string): Promise<void> {
    try {
      const result = await prisma.eventAttendee.updateMany({
        where: {
          email: email.toLowerCase(),
          userId: null, // Only link unlinked records
        },
        data: {
          userId: userId,
        },
      });

      if (result.count > 0) {
        logger.info('Linked event attendee records to new user', {
          userId,
          email,
          linkedCount: result.count,
        });
      }
    } catch (error) {
      // Don't fail registration if linking fails
      logger.error('Failed to link event attendee records', {
        userId,
        email,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}
