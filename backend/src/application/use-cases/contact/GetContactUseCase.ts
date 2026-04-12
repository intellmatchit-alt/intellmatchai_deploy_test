/**
 * Get Contact Use Case
 *
 * Handles retrieving a single contact by ID.
 *
 * @module application/use-cases/contact/GetContactUseCase
 */

import { IContactRepository } from '../../../domain/repositories/IContactRepository';
import { Contact } from '../../../domain/entities/Contact';
import { ContactResponseDTO } from '../../dto/contact.dto';
import { NotFoundError } from '../../../shared/errors';
import { logger } from '../../../shared/logger';

/**
 * Get contact use case
 *
 * Retrieves a single contact with ownership verification.
 */
export class GetContactUseCase {
  constructor(private readonly contactRepository: IContactRepository) {}

  /**
   * Execute get contact
   *
   * @param userId - ID of the user requesting the contact
   * @param contactId - ID of the contact to retrieve
   * @returns Contact response
   * @throws NotFoundError if contact doesn't exist or user doesn't own it
   */
  async execute(userId: string, contactId: string, organizationId?: string | null): Promise<ContactResponseDTO> {
    logger.debug('Getting contact', { userId, contactId });

    const contact = await this.contactRepository.findByIdAndUserId(contactId, userId, organizationId);

    if (!contact) {
      throw new NotFoundError('Contact');
    }

    logger.debug('Contact retrieved', { userId, contactId });

    return this.toResponseDTO(contact);
  }

  /**
   * Convert Contact entity to response DTO
   */
  private toResponseDTO(contact: Contact): ContactResponseDTO {
    return {
      id: contact.id,
      name: contact.name,
      email: contact.email,
      phone: contact.phone,
      company: contact.company,
      jobTitle: contact.jobTitle,
      bio: contact.bio,
      avatarUrl: contact.avatarUrl,
      linkedInUrl: contact.linkedInUrl,
      websiteUrl: contact.websiteUrl,
      location: contact.location,
      cardImageUrl: contact.cardImageUrl,
      source: contact.source,
      sectors: contact.sectors.map((s) => ({
        id: s.sectorId,
        name: s.sectorName || '',
        nameAr: s.sectorNameAr || null,
        isPrimary: s.isPrimary,
      })),
      skills: contact.skills.map((s) => ({
        id: s.skillId,
        name: s.skillName || '',
        nameAr: s.skillNameAr || null,
        proficiency: s.proficiency,
      })),
      interests: contact.interests.map((i) => ({
        id: i.interestId,
        name: i.interestName || '',
      })),
      isFavorite: contact.isFavorite,
      matchScore: contact.matchScore,
      lastContactedAt: contact.lastContactedAt?.toISOString(),
      createdAt: contact.createdAt.toISOString(),
      updatedAt: contact.updatedAt.toISOString(),
      enrichmentData: contact.enrichmentData,
    };
  }
}
