import { api } from './client';

// Dashboard
export interface AdminDashboard {
  totalUsers: number;
  subscriptionsByPlan: Array<{ plan: string; count: number }>;
  totalPointsInCirculation: number;
}

export function getDashboard() {
  return api.get<AdminDashboard>('/admin/dashboard');
}

// Plans
export interface PlanConfig {
  id: string;
  name: string;
  displayName: string;
  displayNameAr?: string;
  description?: string;
  descriptionAr?: string;
  monthlyPrice: string;
  yearlyPrice: string;
  pointsAllocation: number;
  contactLimit: number;
  features?: string;
  featuresAr?: string;
  minSeats: number;
  maxSeats?: number;
  isActive: boolean;
  sortOrder: number;
}

export function getPlans() {
  return api.get<PlanConfig[]>('/admin/plans');
}

export function createPlan(data: Partial<PlanConfig>) {
  return api.post<PlanConfig>('/admin/plans', data);
}

export function updatePlan(id: string, data: Partial<PlanConfig>) {
  return api.patch<PlanConfig>(`/admin/plans/${id}`, data);
}

export function deletePlan(id: string) {
  return api.delete(`/admin/plans/${id}`);
}

// System Config
export interface SystemConfigItem {
  id: string;
  key: string;
  value: string;
  type: string;
  label?: string;
  groupName?: string;
}

export function getConfig(group?: string) {
  return api.get<SystemConfigItem[]>(`/admin/config${group ? `?group=${group}` : ''}`);
}

export function updateConfig(configs: Array<{ key: string; value: string }>) {
  return api.patch('/admin/config', { configs });
}

// Users
export interface AdminUser {
  id: string;
  email: string;
  fullName: string;
  isAdmin: boolean;
  isActive: boolean;
  createdAt: string;
  subscription?: { plan: string; status: string };
  wallet?: { balance: number };
}

export interface AdminUserList {
  users: AdminUser[];
  total: number;
  page: number;
  totalPages: number;
}

export function getUsers(page = 1, limit = 20, search = '') {
  return api.get<AdminUserList>(`/admin/users?page=${page}&limit=${limit}&search=${encodeURIComponent(search)}`);
}

export function getUser(id: string) {
  return api.get<any>(`/admin/users/${id}`);
}

export function adjustUserWallet(userId: string, amount: number, reason: string) {
  return api.post<{ balance: number }>(`/admin/users/${userId}/wallet`, { amount, reason });
}

// Point Packs
export interface PointPackAdmin {
  id: string;
  name: string;
  nameAr?: string;
  points: number;
  price: string;
  currency: string;
  isActive: boolean;
  sortOrder: number;
}

export function getPointPacks() {
  return api.get<PointPackAdmin[]>('/admin/point-packs');
}

export function createPointPack(data: Partial<PointPackAdmin>) {
  return api.post<PointPackAdmin>('/admin/point-packs', data);
}

export function updatePointPack(id: string, data: Partial<PointPackAdmin>) {
  return api.patch<PointPackAdmin>(`/admin/point-packs/${id}`, data);
}

export function deletePointPack(id: string) {
  return api.delete(`/admin/point-packs/${id}`);
}
