/**
 * Profile API
 *
 * API functions for profile management endpoints.
 *
 * @module lib/api/profile
 */

import { api, getAuthHeaders } from './client';

/**
 * Sector type
 */
export interface Sector {
  id: string;
  name: string;
  description?: string;
}

/**
 * Skill type
 */
export interface Skill {
  id: string;
  name: string;
  category?: string;
}

/**
 * Get all sectors
 */
export function getSectors(): Promise<Sector[]> {
  return api.get<Sector[]>('/sectors?limit=500');
}

/**
 * Get all skills
 */
export function getSkills(): Promise<Skill[]> {
  return api.get<Skill[]>('/skills?limit=1000');
}

/**
 * Full profile data
 */
export interface Profile {
  id: string;
  email: string;
  fullName: string;
  jobTitle?: string;
  company?: string;
  bio?: string;
  avatarUrl?: string;
  linkedinUrl?: string;
  websiteUrl?: string;
  phone?: string;
  phoneCountryCode?: string;
  location?: string;
  timezone?: string;
  emailVerified: boolean;
  consent: {
    enrichment: boolean;
    contacts: boolean;
    analytics: boolean;
  };
  sectors: Array<{
    id: string;
    name: string;
    isPrimary: boolean;
    experienceYears?: number;
  }>;
  skills: Array<{
    id: string;
    name: string;
    proficiencyLevel: string;
  }>;
  interests: Array<{
    id: string;
    name: string;
    intensity: string;
  }>;
  hobbies: Array<{
    id: string;
    name: string;
  }>;
  goals: Array<{
    id: string;
    type: string;
    description?: string;
    priority: number;
  }>;
}

/**
 * Update profile input
 */
export interface UpdateProfileInput {
  fullName?: string;
  jobTitle?: string;
  company?: string;
  bio?: string;
  linkedinUrl?: string;
  websiteUrl?: string;
  phone?: string;
  phoneCountryCode?: string;
  location?: string;
  timezone?: string;
}

/**
 * Get current user's profile
 */
export function getProfile(): Promise<Profile> {
  return api.get<Profile>('/profile');
}

/**
 * Update user profile
 */
export function updateProfile(input: UpdateProfileInput): Promise<Profile> {
  return api.put<Profile>('/profile', input);
}

/**
 * Update user sectors
 */
export function updateSectors(sectors: Array<{ sectorId: string; isPrimary?: boolean; experienceYears?: number }>): Promise<void> {
  return api.put('/profile/sectors', { sectors });
}

/**
 * Update user skills
 */
export function updateSkills(skills: Array<{ skillId: string; proficiencyLevel?: string }>): Promise<void> {
  return api.put('/profile/skills', { skills });
}

/**
 * Update user interests
 */
export function updateInterests(interests: Array<{ interestId: string; intensity?: string }>): Promise<void> {
  return api.put('/profile/interests', { interests });
}

/**
 * Update user goals/objectives
 */
export function updateGoals(goals: Array<{ type: string; description?: string; priority?: number }>): Promise<void> {
  return api.put('/profile/goals', { goals });
}

/**
 * Hobby type
 */
export interface Hobby {
  id: string;
  name: string;
  category?: string;
}

/**
 * Get all hobbies
 */
export function getHobbies(): Promise<Hobby[]> {
  return api.get<Hobby[]>('/hobbies');
}

/**
 * Update user hobbies
 */
export function updateHobbies(hobbies: Array<{ hobbyId: string }>): Promise<void> {
  return api.put('/profile/hobbies', { hobbies });
}

/**
 * Upload avatar
 */
export async function uploadAvatar(file: File): Promise<{ avatarUrl: string }> {
  const formData = new FormData();
  formData.append('avatar', file);

  const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/profile/avatar`, {
    method: 'POST',
    headers: {
      ...getAuthHeaders(),
    },
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Failed to upload avatar');
  }

  const result = await response.json();
  return result.data;
}
