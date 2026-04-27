/**
 * Get Recent Contacts Use Case
 *
 * Handles retrieving recently added contacts.
 *
 * @module application/use-cases/contact/GetRecentContactsUseCase
 */

import { IContactRepository } from '../../../domain/repositories/IContactRepository';
import { Contact } from '../../../domain/entities/Contact';
import { ContactResponseDTO } from '../../dto/contact.dto';
import { logger } from '../../../shared/logger';

/**
 * Get recent contacts use case
 *
 * Retrieves the most recently added contacts for a user.
 */
export class GetRecentContactsUseCase {
  constructor(private readonly contactRepository: IContactRepository) {}

  /**
   * Execute get recent contacts
   *
   * @param userId - ID of the user
   * @param limit - Maximum number of contacts to return
   * @returns Array of recent contacts
   */
  async execute(userId: string, limit: number = 10, organizationId?: string | null): Promise<ContactResponseDTO[]> {
    logger.debug('Getting recent contacts', { userId, limit });

    const contacts = await this.contactRepository.findRecent(userId, limit, organizationId);

    logger.debug('Recent contacts retrieved', {
      userId,
      count: contacts.length,
    });

    return contacts.map((c) => this.toResponseDTO(c));
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
      bioSummary: contact.bioSummary,
      bioFull: contact.bioFull,
      notes: contact.notes,
      avatarUrl: contact.avatarUrl,
      linkedInUrl: contact.linkedInUrl,
      websiteUrl: contact.websiteUrl,
      location: contact.location,
      cardImageUrl: contact.cardImageUrl,
      source: contact.source,
      sectors: contact.sectors.map((s) => ({
        id: s.sectorId,
        name: s.sectorName || '',
        isPrimary: s.isPrimary,
      })),
      skills: contact.skills.map((s) => ({
        id: s.skillId,
        name: s.skillName || '',
        proficiency: s.proficiency,
      })),
      interests: contact.interests.map((i) => ({
        id: i.interestId,
        name: i.interestName || '',
      })),
      hobbies: contact.hobbies.map((h) => ({
        id: h.hobbyId,
        name: h.hobbyName || '',
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
