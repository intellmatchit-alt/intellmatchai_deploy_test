/**
 * Tasks API
 *
 * API functions for standalone task management.
 *
 * @module lib/api/tasks
 */

import { api } from './client';

// ============================================
// Types
// ============================================

export interface Task {
  id: string;
  contactId?: string | null;
  userId: string;
  title: string;
  description?: string | null;
  voiceNoteUrl?: string | null;
  dueDate?: string | null;
  reminderAt?: string | null;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  completedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  imageUrls?: string[] | null;
  category?: string | null;
  categoryColor?: string | null;
  recurrenceId?: string | null;
  assignedToId?: string | null;
  assignedTo?: {
    id: string;
    fullName: string;
    avatarUrl?: string | null;
  } | null;
  contact?: {
    id: string;
    fullName: string;
    company?: string | null;
  } | null;
  reminders?: TaskReminder[];
  recurrence?: TaskRecurrence | null;
}

export interface TaskReminder {
  id: string;
  taskId: string;
  reminderAt: string;
  type: 'IN_APP' | 'EMAIL' | 'PUSH';
  isSent: boolean;
  snoozeUntil?: string | null;
  createdAt: string;
}

export interface TaskRecurrence {
  id: string;
  pattern: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY' | 'CUSTOM';
  interval: number;
  daysOfWeek?: number[] | null;
  endDate?: string | null;
  maxOccurrences?: number | null;
  occurrenceCount: number;
  isActive: boolean;
}

export interface TaskCategory {
  id: string;
  userId: string;
  name: string;
  color: string;
  createdAt: string;
}

export interface TaskStats {
  total: number;
  pending: number;
  overdue: number;
  today: number;
  thisWeek: number;
  completed: number;
  byStatus: Record<string, number>;
  byPriority: Record<string, number>;
}

export interface TaskListResponse {
  tasks: Task[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface TaskFilters {
  status?: string;
  priority?: string;
  category?: string;
  contactId?: string;
  search?: string;
  sort?: string;
  order?: 'asc' | 'desc';
  page?: number;
  limit?: number;
  dateFrom?: string;
  dateTo?: string;
  filter?: 'today' | 'thisWeek' | 'overdue' | 'noDate' | 'highPriority';
  assignedTo?: string;
}

export interface TaskInput {
  title: string;
  description?: string;
  dueDate?: string | null;
  reminderAt?: string | null;
  priority?: string;
  status?: string;
  contactId?: string | null;
  category?: string | null;
  categoryColor?: string | null;
  imageUrls?: string[];
  assignedToId?: string | null;
  assigneeIds?: string[];
}

export interface TaskAssignee {
  id: string;
  contactId: string;
  contact: {
    id: string;
    fullName: string;
    company?: string | null;
    avatarUrl?: string | null;
  };
}

// ============================================
// Task CRUD
// ============================================

export async function getTasks(filters?: TaskFilters): Promise<TaskListResponse> {
  const params = new URLSearchParams();
  if (filters) {
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params.set(key, String(value));
      }
    });
  }
  const query = params.toString();
  const res = await api.get<TaskListResponse>(`/tasks${query ? `?${query}` : ''}`);
  return res;
}

export async function getTask(id: string): Promise<Task> {
  const res = await api.get<Task>(`/tasks/${id}`);
  return res;
}

export async function createTask(input: TaskInput): Promise<Task> {
  const res = await api.post<Task>('/tasks', { data: input });
  return res;
}

export async function updateTask(id: string, input: Partial<TaskInput>): Promise<Task> {
  const res = await api.put<Task>(`/tasks/${id}`, { data: input });
  return res;
}

export async function deleteTask(id: string): Promise<void> {
  await api.delete(`/tasks/${id}`);
}

export async function updateTaskStatus(id: string, status: string): Promise<Task> {
  const res = await api.patch<Task>(`/tasks/${id}/status`, { data: { status } });
  return res;
}

export async function bulkUpdateTasks(
  taskIds: string[],
  action: 'updateStatus' | 'updatePriority' | 'updateCategory' | 'delete',
  value?: any
): Promise<{ count: number }> {
  const res = await api.patch<{ count: number }>('/tasks/bulk', {
    data: { taskIds, action, value },
  });
  return res;
}

// ============================================
// Search & Stats
// ============================================

export async function searchTasks(q: string, limit?: number): Promise<Task[]> {
  const params = new URLSearchParams({ q });
  if (limit) params.set('limit', String(limit));
  const res = await api.get<Task[]>(`/tasks/search?${params}`);
  return res;
}

export async function getTaskStats(): Promise<TaskStats> {
  const res = await api.get<TaskStats>('/tasks/stats');
  return res;
}

// ============================================
// Categories
// ============================================

export async function getTaskCategories(): Promise<TaskCategory[]> {
  const res = await api.get<TaskCategory[]>('/tasks/categories');
  return res;
}

export async function createTaskCategory(name: string, color: string): Promise<TaskCategory> {
  const res = await api.post<TaskCategory>('/tasks/categories', { data: { name, color } });
  return res;
}

export async function updateTaskCategory(id: string, data: { name?: string; color?: string }): Promise<TaskCategory> {
  const res = await api.put<TaskCategory>(`/tasks/categories/${id}`, { data });
  return res;
}

export async function deleteTaskCategory(id: string): Promise<void> {
  await api.delete(`/tasks/categories/${id}`);
}

// ============================================
// Task Recurrence
// ============================================

export async function setTaskRecurrence(
  taskId: string,
  pattern: string,
  interval?: number,
  daysOfWeek?: number[],
  endDate?: string,
  maxOccurrences?: number
): Promise<Task> {
  const res = await api.post<Task>(`/tasks/${taskId}/recurrence`, {
    data: { pattern, interval, daysOfWeek, endDate, maxOccurrences },
  });
  return res;
}

export async function removeTaskRecurrence(taskId: string): Promise<void> {
  await api.delete(`/tasks/${taskId}/recurrence`);
}

export async function getTaskRecurrence(taskId: string): Promise<TaskRecurrence | null> {
  const res = await api.get<TaskRecurrence | null>(`/tasks/${taskId}/recurrence`);
  return res;
}

// ============================================
// Task Reminders
// ============================================

export async function addTaskReminder(
  taskId: string,
  reminderAt: string,
  type?: string
): Promise<TaskReminder> {
  const res = await api.post<TaskReminder>(`/tasks/${taskId}/reminders`, {
    data: { reminderAt, type },
  });
  return res;
}

export async function deleteTaskReminder(taskId: string, reminderId: string): Promise<void> {
  await api.delete(`/tasks/${taskId}/reminders/${reminderId}`);
}

export async function snoozeTaskReminder(
  taskId: string,
  reminderId: string,
  snoozeUntil: string
): Promise<TaskReminder> {
  const res = await api.patch<TaskReminder>(
    `/tasks/${taskId}/reminders/${reminderId}/snooze`,
    { data: { snoozeUntil } }
  );
  return res;
}

// ============================================
// Task Sharing
// ============================================

export interface TaskShare {
  id: string;
  taskId: string;
  sharedById: string;
  sharedWithId?: string | null;
  sharedEmail?: string | null;
  shareToken?: string | null;
  permission: 'VIEW' | 'EDIT';
  createdAt: string;
  sharedBy?: { id: string; fullName: string } | null;
  sharedWith?: { id: string; fullName: string } | null;
}

export async function shareTask(taskId: string, data: { userId?: string; email?: string; permission?: string }): Promise<TaskShare> {
  const res = await api.post<TaskShare>(`/tasks/${taskId}/share`, { data });
  return res;
}

export async function revokeTaskShare(taskId: string, shareId: string): Promise<void> {
  await api.delete(`/tasks/${taskId}/share/${shareId}`);
}

export async function getTaskShares(taskId: string): Promise<TaskShare[]> {
  const res = await api.get<TaskShare[]>(`/tasks/${taskId}/shares`);
  return res;
}

export async function getSharedWithMe(): Promise<TaskShare[]> {
  const res = await api.get<TaskShare[]>('/tasks/shared');
  return res;
}

// ============================================
// Task Comments
// ============================================

export interface TaskComment {
  id: string;
  taskId: string;
  userId: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  user?: { id: string; fullName: string; avatarUrl?: string | null };
}

export async function getTaskComments(taskId: string): Promise<TaskComment[]> {
  const res = await api.get<TaskComment[]>(`/tasks/${taskId}/comments`);
  return res;
}

export async function addTaskComment(taskId: string, content: string): Promise<TaskComment> {
  const res = await api.post<TaskComment>(`/tasks/${taskId}/comments`, { data: { content } });
  return res;
}

export async function updateTaskComment(taskId: string, commentId: string, content: string): Promise<TaskComment> {
  const res = await api.put<TaskComment>(`/tasks/${taskId}/comments/${commentId}`, { data: { content } });
  return res;
}

export async function deleteTaskComment(taskId: string, commentId: string): Promise<void> {
  await api.delete(`/tasks/${taskId}/comments/${commentId}`);
}

// ============================================
// Task Activity
// ============================================

export interface TaskActivityEntry {
  id: string;
  taskId: string;
  userId: string;
  action: string;
  details?: Record<string, any> | null;
  createdAt: string;
  user?: { id: string; fullName: string; avatarUrl?: string | null };
}

export async function getTaskActivity(taskId: string): Promise<TaskActivityEntry[]> {
  const res = await api.get<TaskActivityEntry[]>(`/tasks/${taskId}/activity`);
  return res;
}

// ============================================
// Task Assignees
// ============================================

export async function getTaskAssignees(taskId: string): Promise<TaskAssignee[]> {
  return api.get(`/tasks/${taskId}/assignees`);
}

export async function addTaskAssignee(taskId: string, contactId: string): Promise<TaskAssignee> {
  return api.post(`/tasks/${taskId}/assignees`, { contactId });
}

export async function removeTaskAssignee(taskId: string, contactId: string): Promise<void> {
  return api.delete(`/tasks/${taskId}/assignees/${contactId}`);
}

// ============================================
// Task Attachments (Voice & Image)
// ============================================

export async function uploadTaskVoice(taskId: string, blob: Blob): Promise<{ url: string }> {
  const formData = new FormData();
  formData.append('voice', blob, 'voice.webm');
  return api.post(`/tasks/${taskId}/attachments/voice`, formData);
}

export async function uploadTaskImage(taskId: string, file: File): Promise<{ url: string }> {
  const formData = new FormData();
  formData.append('image', file);
  return api.post(`/tasks/${taskId}/attachments/image`, formData);
}
