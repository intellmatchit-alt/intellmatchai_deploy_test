/**
 * Get Follow-Up Contacts Use Case
 *
 * Handles retrieving contacts that need follow-up.
 *
 * @module application/use-cases/contact/GetFollowUpContactsUseCase
 */

import { IContactRepository } from '../../../domain/repositories/IContactRepository';
import { Contact } from '../../../domain/entities/Contact';
import { ContactResponseDTO } from '../../dto/contact.dto';
import { logger } from '../../../shared/logger';

/**
 * Get follow-up contacts use case
 *
 * Retrieves contacts that haven't been interacted with recently.
 */
export class GetFollowUpContactsUseCase {
  constructor(private readonly contactRepository: IContactRepository) {}

  /**
   * Execute get follow-up contacts
   *
   * @param userId - ID of the user
   * @param daysThreshold - Days since last interaction to consider as needing follow-up
   * @returns Array of contacts needing follow-up
   */
  async execute(userId: string, daysThreshold: number = 30, organizationId?: string | null): Promise<ContactResponseDTO[]> {
    logger.debug('Getting follow-up contacts', { userId, daysThreshold });

    const contacts = await this.contactRepository.findNeedingFollowUp(userId, daysThreshold, organizationId);

    logger.debug('Follow-up contacts retrieved', {
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
