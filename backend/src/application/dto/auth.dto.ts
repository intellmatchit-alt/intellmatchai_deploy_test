/**
 * Authentication DTOs
 *
 * Data Transfer Objects for authentication operations.
 *
 * @module application/dto/auth.dto
 */

/**
 * Register request DTO
 */
export interface RegisterDTO {
  email: string;
  password: string;
  name: string; // Full name (for backward compatibility)
  title?: string;
  firstName?: string;
  middleName?: string;
  lastName?: string;
  preferredLocale?: string;
  referralCode?: string;
}

/**
 * Login request DTO
 */
export interface LoginDTO {
  email: string;
  password: string;
  userAgent?: string;
  ipAddress?: string;
}

/**
 * Refresh token request DTO
 */
export interface RefreshTokenDTO {
  refreshToken: string;
  userAgent?: string;
  ipAddress?: string;
}

/**
 * Authentication response DTO
 */
export interface AuthResponseDTO {
  user: UserDTO;
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
}

/**
 * User DTO (public profile)
 */
export interface UserDTO {
  id: string;
  email: string;
  name: string; // Full name
  title?: string;
  firstName?: string;
  middleName?: string;
  lastName?: string;
  phone?: string;
  company?: string;
  jobTitle?: string;
  bio?: string;
  avatarUrl?: string;
  linkedInUrl?: string;
  websiteUrl?: string;
  location?: string;
  preferredLocale: string;
  isEmailVerified: boolean;
  hasCompletedOnboarding: boolean;
  createdAt: Date;
}

/**
 * Token response DTO
 */
export interface TokenResponseDTO {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
}
