/**
 * Notifications API
 * @module lib/api/notifications
 */

import { api } from './client';

export interface Notification {
  id: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  data?: Record<string, any> | null;
  isRead: boolean;
  createdAt: string;
}

export interface NotificationListResponse {
  notifications: Notification[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export async function getNotifications(page?: number, isRead?: boolean): Promise<NotificationListResponse> {
  const params = new URLSearchParams();
  if (page) params.set('page', String(page));
  if (isRead !== undefined) params.set('isRead', String(isRead));
  const query = params.toString();
  const res = await api.get<NotificationListResponse>(`/notifications${query ? `?${query}` : ''}`);
  return res;
}

export async function getUnreadCount(): Promise<number> {
  const res = await api.get<{ count: number }>('/notifications/unread-count');
  return res.count;
}

export async function markNotificationRead(id: string): Promise<void> {
  await api.patch(`/notifications/${id}/read`);
}

export async function markAllNotificationsRead(): Promise<void> {
  await api.patch('/notifications/read-all');
}

export async function deleteNotification(id: string): Promise<void> {
  await api.delete(`/notifications/${id}`);
}
