const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';
const SA_TOKEN_KEY = 'p2p_sa_token';
const SA_ADMIN_KEY = 'p2p_sa_admin';

export function getSAToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(SA_TOKEN_KEY);
}

export function setSAToken(token: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(SA_TOKEN_KEY, token);
}

export function clearSASession(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(SA_TOKEN_KEY);
  localStorage.removeItem(SA_ADMIN_KEY);
}

export function getSAAdmin(): { id: string; email: string; fullName: string; role: string } | null {
  if (typeof window === 'undefined') return null;
  const data = localStorage.getItem(SA_ADMIN_KEY);
  if (!data) return null;
  try {
    return JSON.parse(data);
  } catch {
    return null;
  }
}

export function setSAAdmin(admin: { id: string; email: string; fullName: string; role: string }): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(SA_ADMIN_KEY, JSON.stringify(admin));
}

async function saRequest<T>(endpoint: string, method: string, body?: unknown): Promise<T> {
  const token = getSAToken();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE_URL}/superadmin${endpoint}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json();

  if (!res.ok || !data.success) {
    if (res.status === 401) {
      clearSASession();
      if (typeof window !== 'undefined') window.location.href = '/superadmin/login';
    }
    throw new Error(data.error?.message || data.error || 'Request failed');
  }

  return data.data as T;
}

export const saApi = {
  get: <T>(endpoint: string) => saRequest<T>(endpoint, 'GET'),
  post: <T>(endpoint: string, body?: unknown) => saRequest<T>(endpoint, 'POST', body),
  patch: <T>(endpoint: string, body?: unknown) => saRequest<T>(endpoint, 'PATCH', body),
  delete: <T>(endpoint: string) => saRequest<T>(endpoint, 'DELETE'),
};
