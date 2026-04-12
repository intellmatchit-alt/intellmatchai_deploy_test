/**
 * User Repository Interface
 *
 * Defines the contract for user data access.
 *
 * @module domain/repositories/IUserRepository
 */

import { User, UserId } from '../entities/User';

/**
 * User repository interface
 */
export interface IUserRepository {
  /**
   * Find user by ID
   */
  findById(id: UserId): Promise<User | null>;

  /**
   * Find user by email
   */
  findByEmail(email: string): Promise<User | null>;

  /**
   * Check if email exists
   */
  emailExists(email: string): Promise<boolean>;

  /**
   * Save user (create or update)
   */
  save(user: User): Promise<User>;

  /**
   * Delete user
   */
  delete(id: UserId): Promise<void>;

  /**
   * Update user's last login timestamp
   */
  updateLastLogin(id: UserId): Promise<void>;
}
