/**
 * Bug Reports API
 *
 * API module for the QA/Bug Reporting system.
 *
 * @module lib/api/bug-reports
 */

import { api, getAuthHeaders, getAccessToken } from './client';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

export interface BugReport {
  id: string;
  userId: string;
  description: string;
  urgency: 'LOW' | 'MEDIUM' | 'HIGH';
  category: 'BUG' | 'UI_ISSUE' | 'PERFORMANCE' | 'FEATURE_REQUEST' | 'OTHER';
  status: 'OPEN' | 'IN_PROGRESS' | 'DONE' | 'WONT_FIX';
  pagePath: string;
  pageTitle: string | null;
  screenshotUrl: string | null;
  platform: string | null;
  adminNotes: string | null;
  createdAt: string;
  updatedAt: string;
  user?: { fullName: string; email: string };
}

export interface BugReportListResponse {
  bugReports: BugReport[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

/**
 * Create a bug report (multipart/form-data for screenshot upload)
 */
export async function createBugReport(data: FormData): Promise<BugReport> {
  let headers = getAuthHeaders();
  // Do NOT set Content-Type for FormData — browser sets it with boundary
  let res = await fetch(`${API_BASE_URL}/bug-reports`, {
    method: 'POST',
    headers,
    body: data,
  });

  // If 401, try refreshing token and retry
  if (res.status === 401) {
    const { getRefreshToken, setTokens, clearTokens } = await import('./client');
    const refreshToken = getRefreshToken();
    if (refreshToken) {
      try {
        const refreshRes = await fetch(`${API_BASE_URL}/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken }),
        });
        const refreshData = await refreshRes.json();
        if (refreshRes.ok && refreshData.success) {
          setTokens(refreshData.data.accessToken, refreshData.data.refreshToken);
          headers = getAuthHeaders();
          res = await fetch(`${API_BASE_URL}/bug-reports`, {
            method: 'POST',
            headers,
            body: data,
          });
        } else {
          clearTokens();
        }
      } catch {
        clearTokens();
      }
    }
  }

  const json = await res.json();

  if (!res.ok || !json.success) {
    throw new Error(json.error?.message || 'Failed to submit bug report');
  }

  return json.data as BugReport;
}

/**
 * Get the current user's bug reports
 */
export async function getMyBugReports(params?: {
  status?: string;
  page?: number;
  limit?: number;
}): Promise<BugReportListResponse> {
  const query = new URLSearchParams();
  if (params?.status) query.set('status', params.status);
  if (params?.page) query.set('page', String(params.page));
  if (params?.limit) query.set('limit', String(params.limit));

  const qs = query.toString();
  return api.get<BugReportListResponse>(`/bug-reports/my${qs ? `?${qs}` : ''}`);
}

/**
 * Get a single bug report by ID
 */
export async function getBugReport(id: string): Promise<BugReport> {
  return api.get<BugReport>(`/bug-reports/${id}`);
}

/**
 * Get app config (public endpoint, no auth needed)
 */
export async function getAppConfig(): Promise<Record<string, string>> {
  const res = await fetch(`${API_BASE_URL}/app-config`);
  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.error?.message || 'Failed to fetch app config');
  }
  return json.data as Record<string, string>;
}
