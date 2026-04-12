/**
 * API Client
 *
 * HTTP client for communicating with the backend API.
 * Handles authentication, token refresh, and error handling.
 *
 * @module lib/api/client
 */

/**
 * API configuration
 */
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

/**
 * API response interface
 */
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: string[];
  };
}

/**
 * API error class
 */
export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number,
    public details?: string[]
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Token storage keys
 */
const ACCESS_TOKEN_KEY = 'p2p_access_token';
const REFRESH_TOKEN_KEY = 'p2p_refresh_token';

/**
 * Get stored access token
 */
export function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

/**
 * Get stored refresh token
 */
export function getRefreshToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

/**
 * Store tokens
 */
export function setTokens(accessToken: string, refreshToken: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
}

/**
 * Clear tokens
 */
export function clearTokens(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

/**
 * Token refresh state
 */
let isRefreshing = false;
let refreshSubscribers: ((token: string) => void)[] = [];

/**
 * Subscribe to token refresh
 */
function subscribeToRefresh(callback: (token: string) => void): void {
  refreshSubscribers.push(callback);
}

/**
 * Notify subscribers of new token
 */
function notifyRefreshSubscribers(token: string): void {
  refreshSubscribers.forEach((callback) => callback(token));
  refreshSubscribers = [];
}

/**
 * Refresh the access token
 */
async function refreshAccessToken(): Promise<string> {
  const refreshToken = getRefreshToken();

  if (!refreshToken) {
    throw new ApiError('NO_REFRESH_TOKEN', 'No refresh token available', 401);
  }

  const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ refreshToken }),
  });

  const data = await response.json();

  if (!response.ok || !data.success) {
    clearTokens();
    throw new ApiError(
      data.error?.code || 'REFRESH_FAILED',
      data.error?.message || 'Token refresh failed',
      response.status
    );
  }

  setTokens(data.data.accessToken, data.data.refreshToken);
  return data.data.accessToken;
}

/**
 * API request options
 */
export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  headers?: Record<string, string>;
  requireAuth?: boolean;
}

/**
 * Make an API request
 */
export async function apiRequest<T>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<T> {
  const {
    method = 'GET',
    body,
    headers = {},
    requireAuth = true,
  } = options;

  const url = `${API_BASE_URL}${endpoint}`;

  // Build headers
  const requestHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...headers,
  };

  // Add auth header if required
  if (requireAuth) {
    const accessToken = getAccessToken();
    if (accessToken) {
      requestHeaders['Authorization'] = `Bearer ${accessToken}`;
    }
  }

  // Add organization context header if in org mode
  if (typeof window !== 'undefined') {
    const activeOrgId = localStorage.getItem('p2p_active_org');
    if (activeOrgId) {
      requestHeaders['X-Organization-Id'] = activeOrgId;
    }
  }

  // Make request
  let response = await fetch(url, {
    method,
    headers: requestHeaders,
    body: body ? JSON.stringify(body) : undefined,
  });

  // Handle 429 - rate limited, don't trigger token refresh or logout
  if (response.status === 429) {
    throw new ApiError('RATE_LIMIT_EXCEEDED', 'Too many requests, please try again later', 429);
  }

  // Handle 401 - try to refresh token
  if (response.status === 401 && requireAuth) {
    const refreshToken = getRefreshToken();

    // Try to refresh if we have a refresh token (access token may have expired/been cleared)
    if (refreshToken) {
      if (!isRefreshing) {
        isRefreshing = true;

        try {
          const newToken = await refreshAccessToken();
          isRefreshing = false;
          notifyRefreshSubscribers(newToken);

          // Retry original request with new token
          requestHeaders['Authorization'] = `Bearer ${newToken}`;
          response = await fetch(url, {
            method,
            headers: requestHeaders,
            body: body ? JSON.stringify(body) : undefined,
          });
        } catch {
          isRefreshing = false;
          clearTokens();
          throw new ApiError('SESSION_EXPIRED', 'Session has expired', 401);
        }
      } else {
        // Wait for ongoing refresh
        const newToken = await new Promise<string>((resolve) => {
          subscribeToRefresh(resolve);
        });

        // Retry with new token
        requestHeaders['Authorization'] = `Bearer ${newToken}`;
        response = await fetch(url, {
          method,
          headers: requestHeaders,
          body: body ? JSON.stringify(body) : undefined,
        });
      }
    }
  }

  // Parse response
  const data: ApiResponse<T> = await response.json();

  // Handle errors
  if (!response.ok || !data.success) {
    throw new ApiError(
      data.error?.code || 'UNKNOWN_ERROR',
      data.error?.message || 'An error occurred',
      response.status,
      data.error?.details
    );
  }

  return data.data as T;
}

/**
 * Get common headers including auth and org context.
 * Use this for raw fetch calls (FormData uploads) that bypass apiRequest.
 */
export function getAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  const accessToken = getAccessToken();
  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }
  if (typeof window !== 'undefined') {
    const activeOrgId = localStorage.getItem('p2p_active_org');
    if (activeOrgId) {
      headers['X-Organization-Id'] = activeOrgId;
    }
  }
  return headers;
}

/**
 * Shorthand methods
 */
export const api = {
  get: <T>(endpoint: string, options?: Omit<RequestOptions, 'method'>) =>
    apiRequest<T>(endpoint, { ...options, method: 'GET' }),

  post: <T>(endpoint: string, body?: unknown, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    apiRequest<T>(endpoint, { ...options, method: 'POST', body }),

  put: <T>(endpoint: string, body?: unknown, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    apiRequest<T>(endpoint, { ...options, method: 'PUT', body }),

  patch: <T>(endpoint: string, body?: unknown, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    apiRequest<T>(endpoint, { ...options, method: 'PATCH', body }),

  delete: <T>(endpoint: string, options?: Omit<RequestOptions, 'method'>) =>
    apiRequest<T>(endpoint, { ...options, method: 'DELETE' }),
};
