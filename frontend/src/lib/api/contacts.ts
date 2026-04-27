/**
 * Contacts API
 *
 * API functions for contact management endpoints.
 *
 * @module lib/api/contacts
 */

import { api, getAuthHeaders } from './client';

/**
 * Contact data
 */
export interface Contact {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  company?: string;
  jobTitle?: string;
  bio?: string;
  bioSummary?: string;
  bioFull?: string;
  notes?: string;
  avatarUrl?: string;
  linkedInUrl?: string;
  websiteUrl?: string;
  location?: string;
  cardImageUrl?: string;
  source: 'MANUAL' | 'CARD_SCAN' | 'IMPORT' | 'LINKEDIN';
  sectors: Array<{ id: string; name: string; isPrimary: boolean }>;
  skills: Array<{ id: string; name: string; proficiency: string }>;
  interests: Array<{ id: string; name: string; intensity?: string }>;
  hobbies?: Array<{ id: string; name: string }>;
  isFavorite: boolean;
  matchScore?: number;
  lastContactedAt?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Contact list response
 */
export interface ContactListResponse {
  contacts: Contact[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * Contact list filters
 */
export interface ContactFilters {
  search?: string;
  sector?: string;
  favorite?: boolean;
  minScore?: number;
  page?: number;
  limit?: number;
  sort?: 'name' | 'createdAt' | 'matchScore' | 'lastContactedAt';
  order?: 'asc' | 'desc';
}

/**
 * Create contact input
 */
export interface CreateContactInput {
  name: string;
  email?: string;
  phone?: string;
  company?: string;
  jobTitle?: string;
  bio?: string;
  linkedInUrl?: string;
  websiteUrl?: string;
  location?: string;
  sectors?: Array<{ sectorId: string; isPrimary?: boolean }>;
  skills?: Array<{ skillId: string; proficiency?: string }>;
  notes?: string;
  source?: 'MANUAL' | 'CARD_SCAN' | 'IMPORT' | 'LINKEDIN';
}

/**
 * Update contact input
 */
export interface UpdateContactInput {
  name?: string;
  email?: string | null;
  phone?: string | null;
  company?: string | null;
  jobTitle?: string | null;
  bio?: string | null;
  bioSummary?: string | null;
  bioFull?: string | null;
  linkedInUrl?: string | null;
  websiteUrl?: string | null;
  location?: string | null;
  notes?: string | null;
  isFavorite?: boolean;
  sectors?: Array<{ sectorId: string; isPrimary?: boolean }>;
  skills?: Array<{ skillId: string; proficiency?: string }>;
  interests?: Array<{ interestId: string; intensity?: string }>;
  hobbies?: Array<{ hobbyId: string }>;
  customSectors?: string[];
  customSkills?: string[];
  customInterests?: string[];
  customHobbies?: string[];
}

/**
 * Interaction input
 */
export interface InteractionInput {
  type: 'MEETING' | 'CALL' | 'EMAIL' | 'MESSAGE' | 'EVENT' | 'OTHER';
  notes?: string;
  date?: string;
}

/**
 * Get contacts list
 */
export function getContacts(filters?: ContactFilters): Promise<ContactListResponse> {
  const params = new URLSearchParams();

  if (filters?.search) params.set('search', filters.search);
  if (filters?.sector) params.set('sector', filters.sector);
  if (filters?.favorite !== undefined) params.set('favorite', String(filters.favorite));
  if (filters?.minScore) params.set('minScore', String(filters.minScore));
  if (filters?.page) params.set('page', String(filters.page));
  if (filters?.limit) params.set('limit', String(filters.limit));
  if (filters?.sort) params.set('sort', filters.sort);
  if (filters?.order) params.set('order', filters.order);

  const query = params.toString();
  return api.get<ContactListResponse>(`/contacts${query ? `?${query}` : ''}`);
}

/**
 * Get single contact
 */
export function getContact(id: string): Promise<Contact> {
  return api.get<Contact>(`/contacts/${id}`);
}

/**
 * Create contact
 */
export function createContact(input: CreateContactInput): Promise<Contact> {
  return api.post<Contact>('/contacts', input);
}

/**
 * Update contact
 */
export function updateContact(id: string, input: UpdateContactInput): Promise<Contact> {
  return api.put<Contact>(`/contacts/${id}`, input);
}

/**
 * Delete contact
 */
export function deleteContact(id: string): Promise<void> {
  return api.delete<void>(`/contacts/${id}`);
}

/**
 * Add interaction to contact
 */
export function addInteraction(contactId: string, input: InteractionInput): Promise<Contact> {
  return api.post<Contact>(`/contacts/${contactId}/interaction`, input);
}

/**
 * Get recent contacts
 */
export function getRecentContacts(limit?: number): Promise<Contact[]> {
  const query = limit ? `?limit=${limit}` : '';
  return api.get<Contact[]>(`/contacts/recent${query}`);
}

/**
 * Get contacts needing follow-up
 */
export function getFollowUpContacts(days?: number): Promise<Contact[]> {
  const query = days ? `?days=${days}` : '';
  return api.get<Contact[]>(`/contacts/follow-up${query}`);
}

/**
 * Trigger contact enrichment
 */
export function enrichContact(id: string): Promise<{ contactId: string; status: string }> {
  return api.post<{ contactId: string; status: string }>(`/contacts/${id}/enrich`);
}

// ============================================
// CONTACT TASKS
// ============================================

/**
 * Task priority levels
 */
export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

/**
 * Task status
 */
export type TaskStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

/**
 * Contact task data
 */
export interface ContactTask {
  id: string;
  contactId: string;
  userId: string;
  title: string;
  description?: string;
  imageUrls?: string[];
  voiceNoteUrl?: string;
  dueDate?: string;
  reminderAt?: string;
  priority: TaskPriority;
  status: TaskStatus;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
  contact?: {
    id: string;
    fullName: string;
    company?: string;
  };
}

/**
 * Create task input
 */
export interface CreateTaskInput {
  title: string;
  description?: string;
  voiceNoteUrl?: string;
  dueDate?: string;
  reminderAt?: string;
  priority?: TaskPriority;
}

/**
 * Update task input
 */
export interface UpdateTaskInput {
  title?: string;
  description?: string;
  voiceNoteUrl?: string;
  dueDate?: string | null;
  reminderAt?: string | null;
  priority?: TaskPriority;
  status?: TaskStatus;
}

/**
 * Get tasks for a contact
 */
export function getContactTasks(contactId: string, status?: TaskStatus): Promise<ContactTask[]> {
  const query = status ? `?status=${status}` : '';
  return api.get<ContactTask[]>(`/contacts/${contactId}/tasks${query}`);
}

/**
 * Create a task for a contact
 */
export function createContactTask(contactId: string, input: CreateTaskInput): Promise<ContactTask> {
  return api.post<ContactTask>(`/contacts/${contactId}/tasks`, input);
}

/**
 * Update a task
 */
export function updateContactTask(contactId: string, taskId: string, input: UpdateTaskInput): Promise<ContactTask> {
  return api.put<ContactTask>(`/contacts/${contactId}/tasks/${taskId}`, input);
}

/**
 * Delete a task
 */
export function deleteContactTask(contactId: string, taskId: string): Promise<void> {
  return api.delete<void>(`/contacts/${contactId}/tasks/${taskId}`);
}

/**
 * Upload voice note for a task
 */
export async function uploadTaskVoiceNote(contactId: string, taskId: string, audioBlob: Blob): Promise<ContactTask> {
  const formData = new FormData();
  formData.append('voice', audioBlob, 'voice-note.webm');

  const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/contacts/${contactId}/tasks/${taskId}/voice`, {
    method: 'POST',
    headers: {
      ...getAuthHeaders(),
    },
    body: formData,
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error('Failed to upload voice note');
  }

  const data = await response.json();
  return data.data;
}

/**
 * Get all tasks (dashboard view)
 */
export async function getAllTasks(options?: { status?: TaskStatus; upcoming?: boolean; limit?: number }): Promise<ContactTask[]> {
  const params = new URLSearchParams();
  if (options?.status) params.set('status', options.status);
  if (options?.upcoming) params.set('upcoming', 'true');
  if (options?.limit) params.set('limit', String(options.limit));

  const query = params.toString();
  const result = await api.get<{ tasks: ContactTask[]; total: number } | ContactTask[]>(`/tasks${query ? `?${query}` : ''}`);
  return Array.isArray(result) ? result : (result as any).tasks || [];
}

// ============================================
// CONTACT REMINDERS
// ============================================

/**
 * Contact reminder data
 */
export interface ContactReminder {
  id: string;
  contactId: string;
  userId: string;
  title: string;
  description?: string;
  imageUrls?: string[];
  reminderAt: string;
  isCompleted: boolean;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
  contact?: {
    id: string;
    fullName: string;
    company?: string;
  };
}

/**
 * Create reminder input
 */
export interface CreateReminderInput {
  title: string;
  description?: string;
  reminderAt: string;
}

/**
 * Update reminder input
 */
export interface UpdateReminderInput {
  title?: string;
  description?: string;
  reminderAt?: string;
  isCompleted?: boolean;
}

/**
 * Get reminders for a contact
 */
export function getContactReminders(contactId: string, includeCompleted?: boolean): Promise<ContactReminder[]> {
  const query = includeCompleted ? '?includeCompleted=true' : '';
  return api.get<ContactReminder[]>(`/contacts/${contactId}/reminders${query}`);
}

/**
 * Create a reminder for a contact
 */
export function createContactReminder(contactId: string, input: CreateReminderInput): Promise<ContactReminder> {
  return api.post<ContactReminder>(`/contacts/${contactId}/reminders`, input);
}

/**
 * Update a reminder
 */
export function updateContactReminder(contactId: string, reminderId: string, input: UpdateReminderInput): Promise<ContactReminder> {
  return api.put<ContactReminder>(`/contacts/${contactId}/reminders/${reminderId}`, input);
}

/**
 * Delete a reminder
 */
export function deleteContactReminder(contactId: string, reminderId: string): Promise<void> {
  return api.delete<void>(`/contacts/${contactId}/reminders/${reminderId}`);
}

/**
 * Get all reminders (dashboard view)
 */
export function getAllReminders(options?: { includeCompleted?: boolean; upcoming?: boolean; limit?: number }): Promise<ContactReminder[]> {
  const params = new URLSearchParams();
  if (options?.includeCompleted) params.set('includeCompleted', 'true');
  if (options?.upcoming) params.set('upcoming', 'true');
  if (options?.limit) params.set('limit', String(options.limit));

  const query = params.toString();
  return api.get<ContactReminder[]>(`/reminders${query ? `?${query}` : ''}`);
}

// ============================================
// IMAGE UPLOADS
// ============================================

/**
 * Upload images for a task
 */
export async function uploadTaskImages(contactId: string, taskId: string, images: File[]): Promise<ContactTask> {
  const formData = new FormData();
  images.forEach((image) => {
    formData.append('images', image);
  });

  const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/contacts/${contactId}/tasks/${taskId}/images`, {
    method: 'POST',
    headers: {
      ...getAuthHeaders(),
    },
    body: formData,
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error('Failed to upload task images');
  }

  const data = await response.json();
  return data.data;
}

/**
 * Delete an image from a task
 */
export function deleteTaskImage(contactId: string, taskId: string, imageIndex: number): Promise<ContactTask> {
  return api.delete<ContactTask>(`/contacts/${contactId}/tasks/${taskId}/images/${imageIndex}`);
}

/**
 * Send task details to contact via email
 */
export function sendTaskEmail(contactId: string, taskId: string): Promise<void> {
  return api.post(`/contacts/${contactId}/tasks/${taskId}/send-email`);
}

/**
 * Upload images for a reminder
 */
export async function uploadReminderImages(contactId: string, reminderId: string, images: File[]): Promise<ContactReminder> {
  const formData = new FormData();
  images.forEach((image) => {
    formData.append('images', image);
  });

  const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/contacts/${contactId}/reminders/${reminderId}/images`, {
    method: 'POST',
    headers: {
      ...getAuthHeaders(),
    },
    body: formData,
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error('Failed to upload reminder images');
  }

  const data = await response.json();
  return data.data;
}

/**
 * Delete an image from a reminder
 */
export function deleteReminderImage(contactId: string, reminderId: string, imageIndex: number): Promise<ContactReminder> {
  return api.delete<ContactReminder>(`/contacts/${contactId}/reminders/${reminderId}/images/${imageIndex}`);
}
