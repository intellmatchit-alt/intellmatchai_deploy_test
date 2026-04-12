/**
 * Contact DTOs
 *
 * Data Transfer Objects for contact operations.
 *
 * @module application/dto/contact.dto
 */

import { ContactSource, ProficiencyLevel } from '../../domain/value-objects';

/**
 * Create contact DTO
 */
export interface CreateContactDTO {
  name: string; // Full name (for backward compatibility)
  title?: string;
  firstName?: string;
  middleName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  company?: string;
  jobTitle?: string;
  bio?: string;
  bioSummary?: string;
  bioFull?: string;
  linkedInUrl?: string;
  websiteUrl?: string;
  location?: string;
  sectors?: Array<{ sectorId: string; isPrimary?: boolean }>;
  skills?: Array<{ skillId: string; proficiency?: ProficiencyLevel }>;
  interests?: Array<{ interestId: string }>;
  // Custom values from AI/GPT that need to be created if they don't exist
  customSectors?: string[];
  customSkills?: string[];
  customInterests?: string[];
  notes?: string;
  source?: ContactSource;
  cardImageUrl?: string;
  // Enrichment data from ScrapIn (experience, education, employmentVerification)
  enrichmentData?: Record<string, any>;
}

/**
 * Update contact DTO
 */
export interface UpdateContactDTO {
  name?: string; // Full name
  title?: string;
  firstName?: string;
  middleName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  company?: string;
  jobTitle?: string;
  bio?: string;
  bioSummary?: string;
  bioFull?: string;
  linkedInUrl?: string;
  websiteUrl?: string;
  location?: string;
  notes?: string;
  isFavorite?: boolean;
  sectors?: Array<{ sectorId: string; isPrimary?: boolean }>;
  skills?: Array<{ skillId: string; proficiency?: ProficiencyLevel }>;
  interests?: Array<{ interestId: string }>;
  customSectors?: string[];
  customSkills?: string[];
  customInterests?: string[];
}

/**
 * Contact from scan DTO
 */
export interface CreateContactFromScanDTO {
  name: string; // Full name
  title?: string;
  firstName?: string;
  middleName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  company?: string;
  jobTitle?: string;
  website?: string;
  cardImageUrl: string;
  sectors?: string[];
}

/**
 * Add interaction DTO
 */
export interface AddInteractionDTO {
  type: 'MEETING' | 'CALL' | 'EMAIL' | 'MESSAGE' | 'EVENT' | 'OTHER';
  notes?: string;
  date?: Date;
}

/**
 * Contact response DTO
 */
export interface ContactResponseDTO {
  id: string;
  name: string; // Full name
  fullName?: string; // Alias for name for frontend compatibility (optional for backward compat)
  title?: string;
  firstName?: string;
  middleName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  company?: string;
  jobTitle?: string;
  bio?: string;
  bioSummary?: string;
  bioFull?: string;
  avatarUrl?: string;
  linkedInUrl?: string;
  websiteUrl?: string;
  location?: string;
  cardImageUrl?: string;
  source: string;
  sectors: Array<{
    id: string;
    name: string;
    nameAr?: string | null;
    isPrimary: boolean;
  }>;
  skills: Array<{
    id: string;
    name: string;
    nameAr?: string | null;
    proficiency: string;
  }>;
  interests: Array<{
    id: string;
    name: string;
  }>;
  isFavorite: boolean;
  matchScore?: number;
  lastContactedAt?: string;
  createdAt: string;
  updatedAt: string;
  // Enrichment data from ScrapIn
  enrichmentData?: Record<string, any>;
}

/**
 * Contact list response DTO
 */
export interface ContactListResponseDTO {
  contacts: ContactResponseDTO[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * Contact filters DTO
 */
export interface ContactFiltersDTO {
  search?: string;
  sector?: string;
  favorite?: boolean;
  minScore?: number;
  page?: number;
  limit?: number;
  sort?: 'name' | 'createdAt' | 'matchScore' | 'lastContactedAt';
  order?: 'asc' | 'desc';
  organizationId?: string | null;
}
