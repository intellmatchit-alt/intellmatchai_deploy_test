/**
 * Authentication API
 *
 * API functions for authentication endpoints.
 *
 * @module lib/api/auth
 */

import { api, setTokens, clearTokens, getRefreshToken } from './client';

/**
 * User data from API
 */
export interface User {
  id: string;
  email: string;
  name: string;
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
  isAdmin?: boolean;
  createdAt: string;
}

/**
 * Auth response from API
 */
export interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
}

/**
 * Token response from API
 */
export interface TokenResponse {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
}

/**
 * Register input
 */
export interface RegisterInput {
  email: string;
  password: string;
  name: string;
  title?: string;
  firstName?: string;
  middleName?: string;
  lastName?: string;
  preferredLocale?: string;
  referralCode?: string;
}

/**
 * Login input
 */
export interface LoginInput {
  email: string;
  password: string;
}

/**
 * Register a new user
 */
export async function register(input: RegisterInput): Promise<AuthResponse> {
  const response = await api.post<AuthResponse>('/auth/register', input, {
    requireAuth: false,
  });

  // Store tokens
  setTokens(response.accessToken, response.refreshToken);

  return response;
}

/**
 * Login user
 */
export async function login(input: LoginInput): Promise<AuthResponse> {
  const response = await api.post<AuthResponse>('/auth/login', input, {
    requireAuth: false,
  });

  // Store tokens
  setTokens(response.accessToken, response.refreshToken);

  return response;
}

/**
 * Logout user
 */
export async function logout(): Promise<void> {
  const refreshToken = getRefreshToken();

  if (refreshToken) {
    try {
      await api.post('/auth/logout', { refreshToken }, { requireAuth: false });
    } catch {
      // Ignore logout errors
    }
  }

  clearTokens();
}

/**
 * Logout from all devices
 */
export async function logoutAll(): Promise<void> {
  try {
    await api.post('/auth/logout-all');
  } catch {
    // Ignore errors
  }

  clearTokens();
}

/**
 * Get current user
 */
export async function getCurrentUser(): Promise<User> {
  return api.get<User>('/auth/me');
}

/**
 * Forgot password
 */
export async function forgotPassword(email: string): Promise<void> {
  await api.post('/auth/forgot-password', { email }, { requireAuth: false });
}

/**
 * Reset password
 */
export async function resetPassword(token: string, password: string): Promise<void> {
  await api.post('/auth/reset-password', { token, password }, { requireAuth: false });
}
