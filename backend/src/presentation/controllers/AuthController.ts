/**
 * Authentication Controller
 *
 * Handles HTTP requests for authentication endpoints.
 *
 * @module presentation/controllers/AuthController
 */

import { Request, Response, NextFunction } from 'express';
import { randomBytes } from 'crypto';
import {
  RegisterUseCase,
  LoginUseCase,
  RefreshTokenUseCase,
  LogoutUseCase,
} from '../../application/use-cases/auth';
import { PrismaUserRepository } from '../../infrastructure/repositories/PrismaUserRepository';
import { PrismaRefreshTokenRepository } from '../../infrastructure/repositories/PrismaRefreshTokenRepository';
import { emailService } from '../../infrastructure/services/EmailService';
import { logger } from '../../shared/logger';
import { prisma } from '../../infrastructure/database/prisma/client';
import { hashPassword, validatePassword } from '../../infrastructure/auth/password';

// Initialize repositories
const userRepository = new PrismaUserRepository();
const refreshTokenRepository = new PrismaRefreshTokenRepository();

// Initialize use cases
const registerUseCase = new RegisterUseCase(userRepository, refreshTokenRepository);
const loginUseCase = new LoginUseCase(userRepository, refreshTokenRepository);
const refreshTokenUseCase = new RefreshTokenUseCase(userRepository, refreshTokenRepository);
const logoutUseCase = new LogoutUseCase(refreshTokenRepository);

/**
 * Authentication Controller
 */
export class AuthController {
  /**
   * Register a new user
   *
   * POST /api/v1/auth/register
   */
  async register(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, password, name, title, firstName, middleName, lastName, preferredLocale, referralCode } = req.body;

      const result = await registerUseCase.execute({
        email,
        password,
        name,
        title,
        firstName,
        middleName,
        lastName,
        preferredLocale,
        referralCode,
      });

      // Send welcome email first, then verification email
      this.sendWelcomeAndVerificationEmails(result.user.id, email, name).catch((err) => {
        logger.error('Failed to send registration emails', { error: err });
      });

      res.status(201).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Login user
   *
   * POST /api/v1/auth/login
   */
  async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, password } = req.body;

      const result = await loginUseCase.execute({
        email,
        password,
        userAgent: req.headers['user-agent'],
        ipAddress: req.ip,
      });

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Refresh access token
   *
   * POST /api/v1/auth/refresh
   */
  async refresh(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { refreshToken } = req.body;

      const result = await refreshTokenUseCase.execute({
        refreshToken,
        userAgent: req.headers['user-agent'],
        ipAddress: req.ip,
      });

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Logout user (revoke refresh token)
   *
   * POST /api/v1/auth/logout
   */
  async logout(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { refreshToken } = req.body;

      await logoutUseCase.execute(refreshToken);

      res.status(200).json({
        success: true,
        message: 'Logged out successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Logout from all devices
   *
   * POST /api/v1/auth/logout-all
   */
  async logoutAll(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: 'Authentication required',
        });
        return;
      }

      await logoutUseCase.logoutAll(req.user.userId);

      res.status(200).json({
        success: true,
        message: 'Logged out from all devices',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get current user
   *
   * GET /api/v1/auth/me
   */
  async me(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: 'Authentication required',
        });
        return;
      }

      const user = await userRepository.findById(req.user.userId);

      if (!user) {
        res.status(404).json({
          success: false,
          error: 'User not found',
        });
        return;
      }

      // Check isAdmin and isPremium from DB (not on domain entity)
      const dbUser = await prisma.user.findUnique({
        where: { id: req.user.userId },
        select: { isAdmin: true, title: true, firstName: true, middleName: true, lastName: true, subscription: { select: { plan: true, status: true } } },
      });

      res.status(200).json({
        success: true,
        data: {
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            title: dbUser?.title || null,
            firstName: dbUser?.firstName || null,
            middleName: dbUser?.middleName || null,
            lastName: dbUser?.lastName || null,
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
            isAdmin: dbUser?.isAdmin || false,
            isPremium: dbUser?.subscription?.status === 'ACTIVE' && dbUser?.subscription?.plan !== 'FREE',
            createdAt: user.createdAt,
          },
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Forgot password (request reset)
   *
   * POST /api/v1/auth/forgot-password
   */
  async forgotPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email } = req.body;

      // Find user by email
      const user = await userRepository.findByEmail(email);

      if (user) {
        // Generate password reset token
        const token = randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

        // Delete any existing password reset tokens for this user
        await prisma.verificationToken.deleteMany({
          where: {
            userId: user.id,
            type: 'PASSWORD_RESET',
          },
        });

        // Create new password reset token
        await prisma.verificationToken.create({
          data: {
            userId: user.id,
            token,
            type: 'PASSWORD_RESET',
            expiresAt,
          },
        });

        // Send password reset email
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
        const resetUrl = `${frontendUrl}/reset-password?token=${token}`;

        await emailService.sendPasswordResetEmail(user.email, {
          name: user.name,
          resetUrl,
          expiresIn: '1 hour',
        });

        logger.info('Password reset email sent', {
          userId: user.id,
          email: user.email,
        });
      } else {
        // Log for monitoring but don't reveal if email exists
        logger.info('Password reset requested for non-existent email', { email });
      }

      // Always return success to prevent email enumeration
      res.status(200).json({
        success: true,
        message: 'If an account exists with this email, a password reset link will be sent',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Reset password
   *
   * POST /api/v1/auth/reset-password
   */
  async resetPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { token, password } = req.body;

      // Validate password strength
      const validation = validatePassword(password);
      if (!validation.isValid) {
        res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_PASSWORD',
            message: validation.errors.join('. '),
          },
        });
        return;
      }

      // Find the reset token
      const resetToken = await prisma.verificationToken.findUnique({
        where: { token },
        include: { user: true },
      });

      if (!resetToken) {
        res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_TOKEN',
            message: 'The password reset link is invalid.',
          },
        });
        return;
      }

      if (resetToken.usedAt) {
        res.status(400).json({
          success: false,
          error: {
            code: 'TOKEN_ALREADY_USED',
            message: 'This password reset link has already been used.',
          },
        });
        return;
      }

      if (resetToken.expiresAt < new Date()) {
        res.status(400).json({
          success: false,
          error: {
            code: 'TOKEN_EXPIRED',
            message: 'The password reset link has expired. Please request a new one.',
          },
        });
        return;
      }

      if (resetToken.type !== 'PASSWORD_RESET') {
        res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_TOKEN_TYPE',
            message: 'Invalid token type.',
          },
        });
        return;
      }

      // Hash the new password
      const passwordHash = await hashPassword(password);

      // Update password and mark token as used
      await prisma.$transaction([
        prisma.verificationToken.update({
          where: { id: resetToken.id },
          data: { usedAt: new Date() },
        }),
        prisma.user.update({
          where: { id: resetToken.userId },
          data: { passwordHash },
        }),
      ]);

      // Revoke all existing refresh tokens for security
      await prisma.refreshToken.updateMany({
        where: {
          userId: resetToken.userId,
          revokedAt: null,
        },
        data: { revokedAt: new Date() },
      });

      logger.info('Password reset successfully', {
        userId: resetToken.userId,
        email: resetToken.user.email,
      });

      res.status(200).json({
        success: true,
        message: 'Password reset successfully. Please login with your new password.',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * LinkedIn OAuth authentication
   * Register new user or login existing user with LinkedIn
   */
  async linkedInAuth(data: {
    linkedinId: string;
    email: string;
    name: string;
    avatarUrl?: string;
    userAgent?: string;
    ipAddress?: string;
  }): Promise<any> {
    const { linkedinId, email, name, avatarUrl } = data;

    // Check if user already exists with this email
    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      include: {
        userSectors: true,
        userSkills: true,
        userInterests: true,
      },
    });

    if (existingUser) {
      // User exists, update LinkedIn info if not set
      if (!existingUser.linkedinUrl) {
        await prisma.user.update({
          where: { id: existingUser.id },
          data: {
            linkedinUrl: `https://linkedin.com/in/${linkedinId}`,
            avatarUrl: avatarUrl || existingUser.avatarUrl,
          },
        });
      }

      // Generate tokens for existing user
      const { generateTokenPair } = await import('../../infrastructure/auth/jwt.js');
      const tokenPair = generateTokenPair(existingUser.id, existingUser.email);

      // Save refresh token
      await prisma.refreshToken.create({
        data: {
          token: tokenPair.refreshToken,
          userId: existingUser.id,
          expiresAt: tokenPair.refreshTokenExpiresAt,
        },
      });

      // Calculate onboarding status
      const hasCompletedOnboarding = existingUser.userSectors.length > 0 &&
        existingUser.userSkills.length > 0 &&
        existingUser.userInterests.length > 0;

      return {
        user: {
          id: existingUser.id,
          email: existingUser.email,
          name: existingUser.fullName,
          avatarUrl: existingUser.avatarUrl,
          isEmailVerified: existingUser.emailVerified,
          hasCompletedOnboarding,
        },
        accessToken: tokenPair.accessToken,
        refreshToken: tokenPair.refreshToken,
        expiresAt: tokenPair.accessTokenExpiresAt,
      };
    } else {
      // Create new user with LinkedIn data
      const crypto = await import('crypto');
      const userId = crypto.randomUUID();

      // Generate a random password hash for OAuth users (they won't use it)
      const randomPassword = crypto.randomBytes(32).toString('hex');
      const hashedPassword = await hashPassword(randomPassword);

      const newUser = await prisma.user.create({
        data: {
          id: userId,
          email: email.toLowerCase(),
          fullName: name,
          passwordHash: hashedPassword,
          linkedinUrl: `https://linkedin.com/in/${linkedinId}`,
          avatarUrl: avatarUrl || null,
          emailVerified: true, // LinkedIn emails are verified
          isActive: true,
        },
      });

      // Generate tokens
      const { generateTokenPair } = await import('../../infrastructure/auth/jwt.js');
      const tokenPair = generateTokenPair(newUser.id, newUser.email);

      // Save refresh token
      await prisma.refreshToken.create({
        data: {
          token: tokenPair.refreshToken,
          userId: newUser.id,
          expiresAt: tokenPair.refreshTokenExpiresAt,
        },
      });

      logger.info('User registered via LinkedIn', { userId: newUser.id });

      return {
        user: {
          id: newUser.id,
          email: newUser.email,
          name: newUser.fullName,
          avatarUrl: newUser.avatarUrl,
          isEmailVerified: newUser.emailVerified,
          hasCompletedOnboarding: false, // New users haven't completed onboarding
        },
        accessToken: tokenPair.accessToken,
        refreshToken: tokenPair.refreshToken,
        expiresAt: tokenPair.accessTokenExpiresAt,
      };
    }
  }

  /**
   * Verify email with token
   */
  async verifyEmail(token: string): Promise<{ success: boolean; error?: string }> {
    try {
      // Find the verification token
      const verificationToken = await prisma.verificationToken.findUnique({
        where: { token },
        include: { user: true },
      });

      if (!verificationToken) {
        return { success: false, error: 'invalid_token' };
      }

      if (verificationToken.usedAt) {
        return { success: false, error: 'token_already_used' };
      }

      if (verificationToken.expiresAt < new Date()) {
        return { success: false, error: 'token_expired' };
      }

      if (verificationToken.type !== 'EMAIL_VERIFICATION') {
        return { success: false, error: 'invalid_token_type' };
      }

      // Mark token as used and verify email
      await prisma.$transaction([
        prisma.verificationToken.update({
          where: { id: verificationToken.id },
          data: { usedAt: new Date() },
        }),
        prisma.user.update({
          where: { id: verificationToken.userId },
          data: { emailVerified: true },
        }),
      ]);

      logger.info('Email verified successfully', {
        userId: verificationToken.userId,
        email: verificationToken.user.email,
      });

      return { success: true };
    } catch (error) {
      logger.error('Email verification failed', { error });
      return { success: false, error: 'verification_failed' };
    }
  }

  /**
   * Resend verification email
   */
  async resendVerificationEmail(email: string): Promise<void> {
    try {
      const user = await userRepository.findByEmail(email);

      if (!user) {
        // Don't reveal if email exists
        return;
      }

      if (user.isEmailVerified) {
        // Already verified, do nothing
        return;
      }

      // Generate new verification token
      const token = randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

      // Delete any existing verification tokens for this user
      await prisma.verificationToken.deleteMany({
        where: {
          userId: user.id,
          type: 'EMAIL_VERIFICATION',
        },
      });

      // Create new verification token
      await prisma.verificationToken.create({
        data: {
          userId: user.id,
          token,
          type: 'EMAIL_VERIFICATION',
          expiresAt,
        },
      });

      // Send verification email
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      const verificationUrl = `${process.env.API_URL || 'http://localhost:3001/api/v1'}/auth/verify-email/${token}`;

      await emailService.sendVerificationEmail(user.email, {
        name: user.name,
        verificationUrl,
        expiresIn: '24 hours',
      });

      logger.info('Verification email sent', {
        userId: user.id,
        email: user.email,
      });
    } catch (error) {
      logger.error('Failed to resend verification email', { email, error });
    }
  }

  /**
   * Send welcome email and verification email after registration
   */
  async sendWelcomeAndVerificationEmails(userId: string, email: string, name: string): Promise<void> {
    try {
      const frontendUrl = process.env.FRONTEND_URL || 'https://intellmatch.com';

      // 1. Send welcome email first
      await emailService.sendWelcomeEmail(email, {
        name,
        loginUrl: `${frontendUrl}/login`,
      });

      logger.info('Welcome email sent to new user', { userId, email });

      // 2. Then send verification email
      const token = randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

      await prisma.verificationToken.create({
        data: {
          userId,
          token,
          type: 'EMAIL_VERIFICATION',
          expiresAt,
        },
      });

      const verificationUrl = `${process.env.API_URL || 'http://localhost:3001/api/v1'}/auth/verify-email/${token}`;

      await emailService.sendVerificationEmail(email, {
        name,
        verificationUrl,
        expiresIn: '24 hours',
      });

      logger.info('Verification email sent to new user', { userId, email });
    } catch (error) {
      logger.error('Failed to send registration emails', { userId, email, error });
    }
  }

  /**
   * Send verification email only (for resend)
   */
  async sendVerificationEmailForNewUser(userId: string, email: string, name: string): Promise<void> {
    try {
      // Generate verification token
      const token = randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

      // Create verification token
      await prisma.verificationToken.create({
        data: {
          userId,
          token,
          type: 'EMAIL_VERIFICATION',
          expiresAt,
        },
      });

      // Send verification email
      const verificationUrl = `${process.env.API_URL || 'http://localhost:3001/api/v1'}/auth/verify-email/${token}`;

      await emailService.sendVerificationEmail(email, {
        name,
        verificationUrl,
        expiresIn: '24 hours',
      });

      logger.info('Verification email sent to new user', {
        userId,
        email,
      });
    } catch (error) {
      logger.error('Failed to send verification email to new user', { userId, email, error });
    }
  }
}

// Export singleton instance
export const authController = new AuthController();
