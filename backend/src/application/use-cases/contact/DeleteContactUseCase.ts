/**
 * Delete Contact Use Case
 *
 * Handles deleting a contact.
 *
 * @module application/use-cases/contact/DeleteContactUseCase
 */

import { IContactRepository } from '../../../domain/repositories/IContactRepository';
import { NotFoundError } from '../../../shared/errors';
import { logger } from '../../../shared/logger';

/**
 * Delete contact use case
 *
 * Deletes a contact with ownership verification.
 */
export class DeleteContactUseCase {
  constructor(private readonly contactRepository: IContactRepository) {}

  /**
   * Execute contact deletion
   *
   * @param userId - ID of the user deleting the contact
   * @param contactId - ID of the contact to delete
   * @throws NotFoundError if contact doesn't exist or user doesn't own it
   */
  async execute(userId: string, contactId: string, organizationId?: string | null): Promise<void> {
    logger.info('Deleting contact', { userId, contactId });

    // Find contact with ownership check
    const contact = await this.contactRepository.findByIdAndUserId(contactId, userId, organizationId);

    if (!contact) {
      throw new NotFoundError('Contact');
    }

    // Delete contact
    await this.contactRepository.delete(contactId);

    logger.info('Contact deleted successfully', { userId, contactId });
  }
}
