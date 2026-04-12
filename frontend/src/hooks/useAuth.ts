/**
 * useAuth Hook
 *
 * Hook for accessing authentication state and actions.
 *
 * @module hooks/useAuth
 */

"use client";

import { useEffect, useState } from "react";
import { useAuthStore } from "@/stores/authStore";
import { setTokens as storeTokens } from "@/lib/api/client";

/**
 * useAuth hook
 *
 * Provides access to auth state and actions.
 * Automatically initializes auth on first use.
 *
 * @example
 * ```tsx
 * const { user, isAuthenticated, login, logout } = useAuth();
 *
 * if (isAuthenticated) {
 *   return <p>Welcome, {user?.name}</p>;
 * }
 * ```
 */
export function useAuth() {
  const store = useAuthStore();
  const [isHydrated, setIsHydrated] = useState(false);

  // Handle hydration and initialization
  useEffect(() => {
    // Mark as hydrated once we're on the client
    setIsHydrated(true);
    // Initialize auth state
    store.initialize();
  }, []);

  /**
   * Set tokens and initialize auth state
   * Used for guest-to-user conversion
   */
  const setTokens = async (accessToken: string, refreshToken: string) => {
    storeTokens(accessToken, refreshToken);
    await store.initialize();
  };

  return {
    // State - show loading during hydration
    // user: store.user,
    user: store.user?.user ? store.user.user : store.user,
    isLoading: !isHydrated || store.isLoading,
    isAuthenticated: store.isAuthenticated,
    error: store.error,

    // Actions
    register: store.register,
    login: store.login,
    logout: store.logout,
    logoutAll: store.logoutAll,
    clearError: store.clearError,
    setUser: store.setUser,
    refreshUser: store.refreshUser,
    setTokens,
  };
}

/**
 * useRequireAuth hook
 *
 * Ensures user is authenticated.
 * Redirects to login if not.
 *
 * @param redirectTo - Path to redirect to if not authenticated
 *
 * @example
 * ```tsx
 * // In a protected page
 * const { user, isLoading } = useRequireAuth();
 *
 * if (isLoading) return <Loading />;
 *
 * return <Dashboard user={user} />;
 * ```
 */
export function useRequireAuth(redirectTo = "/login") {
  const auth = useAuth();

  useEffect(() => {
    if (!auth.isLoading && !auth.isAuthenticated) {
      // Redirect to login
      if (typeof window !== "undefined") {
        const currentPath = window.location.pathname;
        window.location.href = `${redirectTo}?redirect=${encodeURIComponent(currentPath)}`;
      }
    }
  }, [auth.isLoading, auth.isAuthenticated, redirectTo]);

  return auth;
}

/**
 * useGuest hook
 *
 * Ensures user is NOT authenticated.
 * Redirects to dashboard if authenticated.
 *
 * @param redirectTo - Path to redirect to if authenticated
 *
 * @example
 * ```tsx
 * // In login page
 * const { isLoading } = useGuest();
 *
 * if (isLoading) return <Loading />;
 *
 * return <LoginForm />;
 * ```
 */
export function useGuest(redirectTo = "/dashboard") {
  const auth = useAuth();

  useEffect(() => {
    if (!auth.isLoading && auth.isAuthenticated) {
      // Redirect to dashboard
      if (typeof window !== "undefined") {
        window.location.href = redirectTo;
      }
    }
  }, [auth.isLoading, auth.isAuthenticated, redirectTo]);

  return auth;
}
