/**
 * Contact Repository Interface
 *
 * Defines the contract for contact data access.
 *
 * @module domain/repositories/IContactRepository
 */

import { Contact, ContactId } from '../entities/Contact';
import { UserId } from '../entities/User';

/**
 * Contact query filters
 */
export interface ContactFilters {
  search?: string;
  sectorId?: string;
  isFavorite?: boolean;
  hasInteraction?: boolean;
  minMatchScore?: number;
  organizationId?: string | null;
}

/**
 * Contact pagination options
 */
export interface ContactPaginationOptions {
  page: number;
  limit: number;
  sortBy?: 'name' | 'createdAt' | 'matchScore' | 'lastContactedAt';
  sortOrder?: 'asc' | 'desc';
}

/**
 * Paginated contact result
 */
export interface PaginatedContacts {
  contacts: Contact[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * Contact repository interface
 */
export interface IContactRepository {
  /**
   * Find contact by ID
   */
  findById(id: ContactId): Promise<Contact | null>;

  /**
   * Find contact by ID and user ID (for ownership check)
   */
  findByIdAndUserId(id: ContactId, userId: UserId, organizationId?: string | null): Promise<Contact | null>;

  /**
   * Find all contacts for a user
   */
  findByUserId(
    userId: UserId,
    filters?: ContactFilters,
    pagination?: ContactPaginationOptions
  ): Promise<PaginatedContacts>;

  /**
   * Find contacts by email
   */
  findByEmail(userId: UserId, email: string): Promise<Contact | null>;

  /**
   * Find contacts by phone number (normalized comparison)
   */
  findByPhone(userId: UserId, phone: string): Promise<Contact | null>;

  /**
   * Find recent contacts
   */
  findRecent(userId: UserId, limit?: number, organizationId?: string | null): Promise<Contact[]>;

  /**
   * Find favorite contacts
   */
  findFavorites(userId: UserId): Promise<Contact[]>;

  /**
   * Find contacts needing follow-up
   */
  findNeedingFollowUp(userId: UserId, daysThreshold?: number, organizationId?: string | null): Promise<Contact[]>;

  /**
   * Save contact (create or update)
   */
  save(contact: Contact): Promise<Contact>;

  /**
   * Delete contact
   */
  delete(id: ContactId): Promise<void>;

  /**
   * Count contacts for user
   */
  count(userId: UserId, organizationId?: string | null): Promise<number>;

  /**
   * Get sector distribution for user
   */
  getSectorDistribution(userId: UserId, organizationId?: string | null): Promise<Array<{ sectorId: string; count: number }>>;
}
