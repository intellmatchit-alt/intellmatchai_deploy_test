import { saApi, setSAToken, setSAAdmin, clearSASession, getSAToken, getSAAdmin } from './superadmin-client';

// Auth
export async function superAdminLogin(email: string, password: string) {
  const data = await saApi.post<{ token: string; admin: { id: string; email: string; fullName: string; role: string } }>('/auth/login', { email, password });
  setSAToken(data.token);
  setSAAdmin(data.admin);
  return data;
}

export function superAdminLogout() {
  clearSASession();
}

export function isSAAuthenticated() {
  return !!getSAToken();
}

export function getCurrentSAAdmin() {
  return getSAAdmin();
}

export async function getSAMe() {
  return saApi.get<{ id: string; email: string; fullName: string; role: string }>('/auth/me');
}

// Dashboard
export async function getSADashboard() {
  return saApi.get<{
    totalUsers: number;
    activeUsers: number;
    newSignups: number;
    activeSubscriptions: number;
    totalRevenue: number;
    systemHealth: string;
  }>('/dashboard');
}

export async function getSAAnalytics() {
  return saApi.get<unknown>('/analytics');
}

// Users
export async function getSAUsers(params?: string) {
  return saApi.get<{
    users: Array<{
      id: string;
      fullName: string;
      email: string;
      status: string;
      plan: string;
      createdAt: string;
      lastLoginAt: string | null;
    }>;
    total: number;
    page: number;
    totalPages: number;
  }>(`/users${params ? '?' + params : ''}`);
}

export async function getSAUser(id: string) {
  return saApi.get<{
    id: string;
    fullName: string;
    email: string;
    status: string;
    plan: string;
    walletBalance: number;
    contactsCount: number;
    createdAt: string;
    lastLoginAt: string | null;
    avatarUrl: string | null;
    phone: string | null;
    sector: string | null;
  }>(`/users/${id}`);
}

export async function updateSAUser(id: string, data: Record<string, unknown>) {
  return saApi.patch<unknown>(`/users/${id}`, data);
}

export async function banUser(id: string) {
  return saApi.post<unknown>(`/users/${id}/ban`);
}

export async function unbanUser(id: string) {
  return saApi.post<unknown>(`/users/${id}/unban`);
}

export async function deleteSAUser(id: string) {
  return saApi.delete<unknown>(`/users/${id}`);
}

export async function adjustWallet(id: string, amount: number, reason: string) {
  return saApi.post<unknown>(`/users/${id}/wallet`, { amount, description: reason });
}

// Plans
export async function getSAPlans() {
  return saApi.get<Array<{
    id: string;
    name: string;
    monthlyPrice: number;
    yearlyPrice: number;
    features: string[];
    isActive: boolean;
    subscriberCount: number;
  }>>('/plans');
}

export async function createSAPlan(data: {
  name: string;
  monthlyPrice: number;
  yearlyPrice: number;
  features: string[];
}) {
  return saApi.post<unknown>('/plans', data);
}

export async function updateSAPlan(id: string, data: Record<string, unknown>) {
  return saApi.patch<unknown>(`/plans/${id}`, data);
}

export async function deleteSAPlan(id: string) {
  return saApi.delete<unknown>(`/plans/${id}`);
}

// Admins
export async function getSAAdmins() {
  return saApi.get<Array<{
    id: string;
    fullName: string;
    email: string;
    role: string;
    isActive: boolean;
    lastLoginAt: string | null;
    createdAt: string;
  }>>('/admins');
}

export async function createSAAdmin(data: {
  email: string;
  fullName: string;
  password: string;
  role: string;
}) {
  return saApi.post<unknown>('/admins', data);
}

export async function updateSAAdmin(id: string, data: Record<string, unknown>) {
  return saApi.patch<unknown>(`/admins/${id}`, data);
}

export async function deleteSAAdmin(id: string) {
  return saApi.delete<unknown>(`/admins/${id}`);
}

// Config
export async function getSAConfig() {
  return saApi.get<Array<{
    id: string;
    key: string;
    value: string;
    group: string;
    description: string;
  }>>('/config');
}

export async function updateSAConfig(configs: Array<{ key: string; value: string }>) {
  return saApi.patch<unknown>('/config', { configs });
}

// Point Packs
export interface SAPointPack {
  id: string;
  name: string;
  nameAr?: string;
  points: number;
  price: number;
  currency: string;
  isActive: boolean;
  sortOrder: number;
}

export async function getSAPointPacks() {
  return saApi.get<SAPointPack[]>('/point-packs');
}

export async function createSAPointPack(data: Partial<SAPointPack>) {
  return saApi.post<SAPointPack>('/point-packs', data);
}

export async function updateSAPointPack(id: string, data: Partial<SAPointPack>) {
  return saApi.patch<SAPointPack>(`/point-packs/${id}`, data);
}

export async function deleteSAPointPack(id: string) {
  return saApi.delete<unknown>(`/point-packs/${id}`);
}

// Payments
export interface SAPaymentEntry {
  id: string;
  userId: string;
  user?: { fullName: string; email: string };
  packId: string;
  pointPack?: { name: string };
  points: number;
  amount: number;
  currency: string;
  status: string;
  cartId: string;
  tranRef?: string;
  createdAt: string;
  paidAt?: string;
}

export async function getSAPayments(page = 1, limit = 20, status?: string) {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (status) params.set('status', status);
  return saApi.get<{ purchases: SAPaymentEntry[]; total: number; page: number; totalPages: number }>(`/payments?${params}`);
}

// Audit
export async function getSAAuditLog(params?: string) {
  return saApi.get<{
    logs: Array<{
      id: string;
      adminName: string;
      action: string;
      target: string;
      details: string;
      ipAddress: string;
      createdAt: string;
    }>;
    total: number;
    page: number;
    totalPages: number;
  }>(`/audit-log${params ? '?' + params : ''}`);
}

// Affiliate Management
export async function getSAAffiliates(params?: { page?: number; limit?: number; status?: string; search?: string }) {
  const query = new URLSearchParams();
  if (params?.page) query.set('page', String(params.page));
  if (params?.limit) query.set('limit', String(params.limit));
  if (params?.status) query.set('status', params.status);
  if (params?.search) query.set('search', params.search);
  const qs = query.toString();
  return saApi.get<unknown>(`/affiliates${qs ? '?' + qs : ''}`);
}

export async function getSAAffiliateDetail(id: string) {
  return saApi.get<unknown>(`/affiliates/${id}`);
}

export async function updateSAAffiliateStatus(id: string, status: string, reason?: string) {
  return saApi.patch<unknown>(`/affiliates/${id}/status`, { status, reason });
}

export async function getSAAffiliateStats() {
  return saApi.get<unknown>('/affiliates/stats');
}

export async function getSAAffiliateCodes(page?: number) {
  return saApi.get<unknown>(`/affiliates/codes${page ? '?page=' + page : ''}`);
}

export async function getSAAffiliateReferrals(page?: number) {
  return saApi.get<unknown>(`/affiliates/referrals${page ? '?page=' + page : ''}`);
}

export async function getSAAffiliatePayouts(page?: number, status?: string) {
  const query = new URLSearchParams();
  if (page) query.set('page', String(page));
  if (status) query.set('status', status);
  const qs = query.toString();
  return saApi.get<unknown>(`/affiliates/payouts${qs ? '?' + qs : ''}`);
}

export async function processSAAffiliatePayout(id: string, action: 'approve' | 'reject', notes?: string) {
  return saApi.patch<unknown>(`/affiliates/payouts/${id}`, { action, notes });
}

// ============================================================
// Video Gallery Management
// ============================================================

export interface SAVideoCategory {
  id: string;
  name: string;
  nameAr?: string;
  slug: string;
  sortOrder: number;
  isActive: boolean;
  _count?: { videos: number };
}

export interface SAVideoTag {
  id: string;
  name: string;
  nameAr?: string;
  isActive: boolean;
  _count?: { videos: number };
}

export interface SAVideo {
  id: string;
  title: string;
  titleAr?: string;
  description?: string;
  descriptionAr?: string;
  videoUrl: string;
  videoType: 'YOUTUBE' | 'VIMEO';
  videoId: string;
  thumbnailUrl?: string;
  duration?: string;
  categoryId: string;
  category?: SAVideoCategory;
  tags?: Array<{ tag: SAVideoTag }>;
  sortOrder: number;
  isActive: boolean;
  isFeatured: boolean;
  viewCount: number;
}

// Video Categories
export async function getSAVideoCategories() { return saApi.get<SAVideoCategory[]>('/video-categories'); }
export async function createSAVideoCategory(data: Partial<SAVideoCategory>) { return saApi.post<SAVideoCategory>('/video-categories', data); }
export async function updateSAVideoCategory(id: string, data: Partial<SAVideoCategory>) { return saApi.patch<SAVideoCategory>(`/video-categories/${id}`, data); }
export async function deleteSAVideoCategory(id: string) { return saApi.delete<unknown>(`/video-categories/${id}`); }

// Video Tags
export async function getSAVideoTags() { return saApi.get<SAVideoTag[]>('/video-tags'); }
export async function createSAVideoTag(data: Partial<SAVideoTag>) { return saApi.post<SAVideoTag>('/video-tags', data); }
export async function updateSAVideoTag(id: string, data: Partial<SAVideoTag>) { return saApi.patch<SAVideoTag>(`/video-tags/${id}`, data); }
export async function deleteSAVideoTag(id: string) { return saApi.delete<unknown>(`/video-tags/${id}`); }

// Videos
export async function getSAVideos(page?: number) { return saApi.get<unknown>(`/videos${page ? '?page=' + page : ''}`); }
export async function createSAVideo(data: Record<string, unknown>) { return saApi.post<SAVideo>('/videos', data); }
export async function getSAVideo(id: string) { return saApi.get<SAVideo>(`/videos/${id}`); }
export async function updateSAVideo(id: string, data: Record<string, unknown>) { return saApi.patch<SAVideo>(`/videos/${id}`, data); }
export async function deleteSAVideo(id: string) { return saApi.delete<unknown>(`/videos/${id}`); }
