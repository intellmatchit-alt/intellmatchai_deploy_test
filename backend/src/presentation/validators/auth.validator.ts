/**
 * Authentication Validators
 *
 * Request validation schemas for auth endpoints.
 *
 * @module presentation/validators/auth.validator
 */

import { z } from 'zod';

/**
 * Title options for names
 */
export const TITLE_OPTIONS = ['Mr.', 'Mrs.', 'Ms.', 'Miss', 'Dr.', 'Prof.', 'Sir', 'Madam', 'Sheikh', 'Eng.', 'Capt.', 'Rev.'] as const;

/**
 * Register request schema
 */
export const registerSchema = z.object({
  body: z.object({
    email: z
      .string()
      .email('Invalid email address')
      .max(255, 'Email must be less than 255 characters'),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .max(128, 'Password must be less than 128 characters'),
    name: z
      .string()
      .min(2, 'Name must be at least 2 characters')
      .max(100, 'Name must be less than 100 characters')
      .trim(),
    title: z
      .string()
      .max(20, 'Title must be less than 20 characters')
      .optional()
      .nullable(),
    firstName: z
      .string()
      .max(100, 'First name must be less than 100 characters')
      .trim()
      .optional()
      .nullable(),
    middleName: z
      .string()
      .max(100, 'Middle name must be less than 100 characters')
      .trim()
      .optional()
      .nullable(),
    lastName: z
      .string()
      .max(100, 'Last name must be less than 100 characters')
      .trim()
      .optional()
      .nullable(),
    preferredLocale: z
      .enum(['en', 'ar'])
      .optional()
      .default('en'),
    referralCode: z
      .string()
      .max(50, 'Referral code must be less than 50 characters')
      .optional()
      .nullable(),
  }),
});

/**
 * Login request schema
 */
export const loginSchema = z.object({
  body: z.object({
    email: z
      .string()
      .email('Invalid email address')
      .max(255),
    password: z
      .string()
      .min(1, 'Password is required')
      .max(128),
  }),
});

/**
 * Refresh token request schema
 */
export const refreshTokenSchema = z.object({
  body: z.object({
    refreshToken: z
      .string()
      .min(1, 'Refresh token is required'),
  }),
});

/**
 * Logout request schema
 */
export const logoutSchema = z.object({
  body: z.object({
    refreshToken: z
      .string()
      .min(1, 'Refresh token is required'),
  }),
});

/**
 * Forgot password request schema
 */
export const forgotPasswordSchema = z.object({
  body: z.object({
    email: z
      .string()
      .email('Invalid email address')
      .max(255),
  }),
});

/**
 * Reset password request schema
 */
export const resetPasswordSchema = z.object({
  body: z.object({
    token: z
      .string()
      .min(1, 'Reset token is required'),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .max(128, 'Password must be less than 128 characters'),
  }),
});

/**
 * Export types
 */
export type RegisterInput = z.infer<typeof registerSchema>['body'];
export type LoginInput = z.infer<typeof loginSchema>['body'];
export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>['body'];
export type LogoutInput = z.infer<typeof logoutSchema>['body'];
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>['body'];
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>['body'];
