/**
 * Auth Store
 *
 * Zustand store for authentication state management.
 *
 * @module stores/authStore
 */

"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import {
  User,
  register as apiRegister,
  login as apiLogin,
  logout as apiLogout,
  logoutAll as apiLogoutAll,
  getCurrentUser,
  RegisterInput,
  LoginInput,
} from "@/lib/api/auth";
import { getAccessToken, getRefreshToken, clearTokens } from "@/lib/api/client";
import { useOrganizationStore } from "./organizationStore";

/**
 * Auth state interface
 */
export interface AuthState {
  /**
   * Current authenticated user
   */
  user: User | null | any;

  /**
   * Whether auth is being initialized
   */
  isLoading: boolean;

  /**
   * Whether user is authenticated
   */
  isAuthenticated: boolean;

  /**
   * Last error message
   */
  error: string | null;
}

/**
 * Auth actions interface
 */
export interface AuthActions {
  /**
   * Register a new user
   */
  register: (input: RegisterInput) => Promise<void>;

  /**
   * Login user
   */
  login: (input: LoginInput) => Promise<void>;

  /**
   * Logout user
   */
  logout: () => Promise<void>;

  /**
   * Logout from all devices
   */
  logoutAll: () => Promise<void>;

  /**
   * Initialize auth state (check if user is logged in)
   */
  initialize: () => Promise<void>;

  /**
   * Clear error
   */
  clearError: () => void;

  /**
   * Update user data
   */
  setUser: (user: User | null) => void;

  /**
   * Refresh user data from server
   */
  refreshUser: () => Promise<void>;
}

/**
 * Auth store type
 */
export type AuthStore = AuthState & AuthActions;

/**
 * Create auth store
 */
// Track initialization to prevent duplicate /auth/me calls across tabs/components
let initializePromise: Promise<void> | null = null;

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      // Initial state
      user: null,
      isLoading: false, // Start as false for SSR
      isAuthenticated: false,
      error: null,

      // Register
      register: async (input: RegisterInput) => {
        set({ isLoading: true, error: null });

        try {
          const response = await apiRegister(input);
          set({
            user: response.user,
            isAuthenticated: true,
            isLoading: false,
          });
        } catch (error: any) {
          set({
            error: error.message || "Registration failed",
            isLoading: false,
          });
          throw error;
        }
      },

      // Login
      login: async (input: LoginInput) => {
        set({ isLoading: true, error: null });

        try {
          const response = await apiLogin(input);
          set({
            user: response.user,
            isAuthenticated: true,
            isLoading: false,
          });
        } catch (error: any) {
          set({
            error: error.message || "Login failed",
            isLoading: false,
          });
          throw error;
        }
      },

      // Logout
      logout: async () => {
        set({ isLoading: true });

        try {
          await apiLogout();
        } catch {
          // Ignore logout errors
        }

        // Clear organization state to prevent stale org context for next login
        useOrganizationStore.getState().reset();

        set({
          user: null,
          isAuthenticated: false,
          isLoading: false,
          error: null,
        });
      },

      // Logout all
      logoutAll: async () => {
        set({ isLoading: true });

        try {
          await apiLogoutAll();
        } catch {
          // Ignore logout errors
        }

        // Clear organization state to prevent stale org context for next login
        useOrganizationStore.getState().reset();

        set({
          user: null,
          isAuthenticated: false,
          isLoading: false,
          error: null,
        });
      },

      // Initialize - deduplicated to prevent multiple /auth/me calls
      initialize: async () => {
        const state = get();
        const token = getAccessToken();
        const refreshToken = getRefreshToken();

        // If persisted state says authenticated, validate token actually exists
        if (state.isAuthenticated && state.user) {
          if (token) {
            // Token exists — persisted state is valid
            set({ isLoading: false });
            return;
          }
          // Token missing but refresh token exists — let getCurrentUser() trigger refresh
          if (!refreshToken) {
            // No tokens at all — clear stale persisted state
            clearTokens();
            set({ user: null, isAuthenticated: false, isLoading: false });
            return;
          }
          // Fall through to getCurrentUser() which will trigger token refresh via API client
        }

        // Not authenticated and no tokens — nothing to do
        if (!token && !refreshToken) {
          set({
            user: null,
            isAuthenticated: false,
            isLoading: false,
          });
          return;
        }

        // Deduplicate: reuse in-flight request
        if (initializePromise) {
          await initializePromise;
          return;
        }

        initializePromise = (async () => {
          try {
            const user = await getCurrentUser();
            set({
              user,
              isAuthenticated: true,
              isLoading: false,
            });
          } catch {
            // Token invalid or expired
            clearTokens();
            set({
              user: null,
              isAuthenticated: false,
              isLoading: false,
            });
          } finally {
            initializePromise = null;
          }
        })();

        await initializePromise;
      },

      // Clear error
      clearError: () => {
        set({ error: null });
      },

      // Set user
      setUser: (user: User | null) => {
        set({
          user,
          isAuthenticated: !!user,
        });
      },

      // Refresh user
      refreshUser: async () => {
        try {
          const user = await getCurrentUser();
          set({
            user,
            isAuthenticated: true,
          });
        } catch {
          // Silently fail - user might not be logged in
        }
      },
    }),
    {
      name: "p2p-auth",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        // Only persist durable auth data, keep store shape
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    },
  ),
);
