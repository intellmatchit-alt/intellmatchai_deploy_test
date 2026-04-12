/**
 * Events API
 *
 * API client functions for event QR & matching feature.
 *
 * @module lib/api/events
 */

import { api, getAccessToken, getAuthHeaders } from './client';

/**
 * Match level for event attendees
 */
export type EventMatchLevel = 'HIGH' | 'MEDIUM' | 'LOW';

/**
 * Event interface
 */
export interface Event {
  id: string;
  hostId: string;
  name: string;
  description?: string;
  dateTime: string;
  location?: string;
  locationLat?: number;
  locationLng?: number;
  thumbnailUrl?: string;
  welcomeMessage?: string;
  uniqueCode: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  attendeeCount?: number;
  eventUrl?: string;
}

/**
 * Event Attendee interface
 */
export interface EventAttendee {
  id: string;
  eventId: string;
  userId?: string;
  email: string;
  name: string;
  mobile?: string;
  company?: string;
  role?: string;
  bio?: string;
  lookingFor?: string;
  cvUrl?: string;
  photoUrl?: string;
  isHost: boolean;
  createdAt: string;
  updatedAt: string;
  // Match info (when viewing as another attendee)
  matchLevel?: EventMatchLevel;
  matchScore?: number;
  matchReasons?: string[];
}

/**
 * Create event input
 */
export interface CreateEventInput {
  name: string;
  description?: string;
  dateTime: string;
  location?: string;
  locationLat?: number;
  locationLng?: number;
  thumbnailUrl?: string;
  welcomeMessage?: string;
}

/**
 * Update event input
 */
export interface UpdateEventInput {
  name?: string;
  description?: string;
  dateTime?: string;
  location?: string;
  locationLat?: number;
  locationLng?: number;
  thumbnailUrl?: string;
  welcomeMessage?: string;
  isActive?: boolean;
}

/**
 * Guest registration input
 */
export interface GuestRegistrationInput {
  name: string;
  email: string;
  mobile?: string;
  company?: string;
  role?: string;
  bio?: string;
  lookingFor?: string;
  password?: string;
  confirmPassword?: string;
}

/**
 * Pagination response
 */
export interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

// ===== Host Event Endpoints =====

/**
 * Create a new event
 */
export async function createEvent(data: CreateEventInput): Promise<{ event: Event; eventUrl: string }> {
  return api.post('/events', data);
}

/**
 * Get list of hosted events
 */
export async function getHostedEvents(params?: {
  page?: number;
  limit?: number;
  status?: 'active' | 'inactive' | 'all';
}): Promise<{ events: Event[]; pagination: PaginationInfo }> {
  const query = new URLSearchParams();
  if (params?.page) query.set('page', String(params.page));
  if (params?.limit) query.set('limit', String(params.limit));
  if (params?.status) query.set('status', params.status);

  const queryStr = query.toString();
  return api.get(`/events${queryStr ? `?${queryStr}` : ''}`);
}

/**
 * Get event details
 */
export async function getEvent(id: string): Promise<{ event: Event }> {
  return api.get(`/events/${id}`);
}

/**
 * Update event
 */
export async function updateEvent(id: string, data: UpdateEventInput): Promise<{ event: Event }> {
  return api.put(`/events/${id}`, data);
}

/**
 * Delete event
 */
export async function deleteEvent(id: string): Promise<void> {
  return api.delete(`/events/${id}`);
}

/**
 * Get event attendees
 */
export async function getEventAttendees(
  id: string,
  params?: { page?: number; limit?: number; search?: string }
): Promise<{ attendees: EventAttendee[]; pagination: PaginationInfo }> {
  const query = new URLSearchParams();
  if (params?.page) query.set('page', String(params.page));
  if (params?.limit) query.set('limit', String(params.limit));
  if (params?.search) query.set('search', params.search);

  const queryStr = query.toString();
  return api.get(`/events/${id}/attendees${queryStr ? `?${queryStr}` : ''}`);
}

/**
 * Export attendees
 */
export async function exportAttendees(
  id: string,
  format: 'csv' | 'json' = 'csv'
): Promise<{ attendees: EventAttendee[] } | string> {
  // For CSV, we get back raw text data
  // For JSON, we get structured data
  return api.post(`/events/${id}/attendees/export?format=${format}`, {});
}

/**
 * Add attendees to contacts
 */
export async function addAttendeesToContacts(
  id: string,
  attendeeIds?: string[]
): Promise<{ added: number; skipped: number; total: number }> {
  return api.post(`/events/${id}/attendees/add-to-contacts`, { attendeeIds });
}

/**
 * Invite attendees to IntellMatch
 */
export async function inviteAttendees(
  id: string,
  data?: { attendeeIds?: string[]; message?: string }
): Promise<{ toInvite: number; alreadyUsers: number; emailsSent: number; emailsFailed: number }> {
  return api.post(`/events/${id}/invite-all`, data || {});
}

/**
 * Get QR code for event
 */
export async function getEventQRCode(
  id: string,
  format: 'png' | 'svg' | 'base64' = 'base64',
  size = 300
): Promise<string> {
  const result = await api.get<{ qrCode: string; eventUrl: string }>(
    `/events/${id}/qr?format=${format}&size=${size}`
  );
  return result.qrCode;
}

/**
 * Upload event thumbnail
 */
export async function uploadEventThumbnail(
  id: string,
  file: File
): Promise<{ thumbnailUrl: string }> {
  const formData = new FormData();
  formData.append('thumbnail', file);

  const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/events/${id}/thumbnail`, {
    method: 'POST',
    body: formData,
    headers: {
      ...getAuthHeaders(),
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Failed to upload thumbnail');
  }

  const data = await response.json();
  return data.data;
}

/**
 * Get my matches for an event
 */
export async function getMyEventMatches(id: string): Promise<{ matches: EventAttendee[] }> {
  return api.get(`/events/${id}/my-matches`);
}

/**
 * Get attended events
 */
export async function getAttendedEvents(params?: {
  page?: number;
  limit?: number;
}): Promise<{
  events: Array<{
    event: Event;
    myRegistration: { id: string; createdAt: string };
    highMatches: number;
  }>;
  pagination: PaginationInfo;
}> {
  const query = new URLSearchParams();
  if (params?.page) query.set('page', String(params.page));
  if (params?.limit) query.set('limit', String(params.limit));

  const queryStr = query.toString();
  return api.get(`/events/attended${queryStr ? `?${queryStr}` : ''}`);
}

// ===== Public Event Endpoints (No Auth) =====

/**
 * Get public event info
 */
export async function getPublicEvent(code: string): Promise<{
  event: {
    id: string;
    name: string;
    description?: string;
    dateTime: string;
    location?: string;
    locationLat?: number;
    locationLng?: number;
    thumbnailUrl?: string;
    welcomeMessage?: string;
    attendeeCount: number;
  };
}> {
  return api.get(`/events/public/${code}`, { requireAuth: false });
}

/**
 * Register as guest for an event
 * If password is provided, also creates a user account
 */
export async function registerForEvent(
  code: string,
  data: GuestRegistrationInput
): Promise<{
  attendee: EventAttendee;
  accessToken: string;
  userCreated?: boolean;
  authToken?: string;
  refreshToken?: string;
}> {
  return api.post(`/events/public/${code}/register`, data, { requireAuth: false });
}

/**
 * Join event as authenticated user
 * Uses profile data for matching instead of manual form
 */
export async function joinEvent(code: string): Promise<{
  attendee: EventAttendee;
}> {
  return api.post(`/events/public/${code}/join`, {});
}

/**
 * Get public attendees list with matches
 */
export async function getPublicAttendees(
  code: string,
  token?: string
): Promise<{
  attendees: EventAttendee[];
  myInfo: { id: string; name: string };
  total: number;
}> {
  if (token) {
    return api.get(`/events/public/${code}/attendees?token=${encodeURIComponent(token)}`, { requireAuth: false });
  }
  // When no guest token, use authenticated request so backend picks up req.user
  return api.get(`/events/public/${code}/attendees`);
}
