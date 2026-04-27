/**
 * Update Contact Use Case
 *
 * Handles updating an existing contact.
 *
 * @module application/use-cases/contact/UpdateContactUseCase
 */

import { IContactRepository } from '../../../domain/repositories/IContactRepository';
import { Contact, ContactSector, ContactSkill, ContactInterest, ContactHobby } from '../../../domain/entities/Contact';
import { UpdateContactDTO, ContactResponseDTO } from '../../dto/contact.dto';
import { NotFoundError, ConflictError } from '../../../shared/errors';
import { logger } from '../../../shared/logger';
import { ProficiencyLevel } from '../../../domain/value-objects';

/**
 * Update contact use case
 *
 * Updates contact information with ownership verification
 * and duplicate email checking.
 */
export class UpdateContactUseCase {
  constructor(private readonly contactRepository: IContactRepository) {}

  /**
   * Execute contact update
   *
   * @param userId - ID of the user updating the contact
   * @param contactId - ID of the contact to update
   * @param dto - Update data
   * @returns Updated contact response
   * @throws NotFoundError if contact doesn't exist or user doesn't own it
   * @throws ConflictError if new email conflicts with existing contact
   */
  async execute(
    userId: string,
    contactId: string,
    dto: UpdateContactDTO,
    organizationId?: string | null
  ): Promise<ContactResponseDTO> {
    logger.info('Updating contact', { userId, contactId });

    // Find contact with ownership check
    const contact = await this.contactRepository.findByIdAndUserId(contactId, userId, organizationId);

    if (!contact) {
      throw new NotFoundError('Contact');
    }

    // Check for email conflict if changing email
    if (dto.email && dto.email !== contact.email) {
      const existingContact = await this.contactRepository.findByEmail(userId, dto.email);
      if (existingContact && existingContact.id !== contactId) {
        throw new ConflictError('A contact with this email already exists');
      }
    }

    // Update contact info
    contact.updateInfo({
      name: dto.name,
      email: dto.email,
      phone: dto.phone,
      company: dto.company,
      jobTitle: dto.jobTitle,
      bio: dto.bio,
      bioSummary: dto.bioSummary,
      bioFull: dto.bioFull,
      linkedInUrl: dto.linkedInUrl,
      websiteUrl: dto.websiteUrl,
      location: dto.location,
      notes: dto.notes,
    });

    // Toggle favorite if specified
    if (dto.isFavorite !== undefined && dto.isFavorite !== contact.isFavorite) {
      contact.toggleFavorite();
    }

    // Update sectors if provided (including empty array to clear all sectors)
    if (dto.sectors !== undefined) {
      const seenSectorIds = new Set<string>();
      const sectors: ContactSector[] = [];
      for (const s of dto.sectors) {
        if (!seenSectorIds.has(s.sectorId)) {
          seenSectorIds.add(s.sectorId);
          sectors.push({
            sectorId: s.sectorId,
            isPrimary: s.isPrimary ?? sectors.length === 0,
          });
        }
      }
      logger.info('Updating contact sectors', { contactId, sectorCount: sectors.length, previousCount: contact.sectors.length });
      contact.updateSectors(sectors);
    }

    // Update skills if provided
    if (dto.skills !== undefined) {
      const seenSkillIds = new Set<string>();
      const skills: ContactSkill[] = [];
      for (const s of dto.skills) {
        if (!seenSkillIds.has(s.skillId)) {
          seenSkillIds.add(s.skillId);
          skills.push({
            skillId: s.skillId,
            proficiency: (s.proficiency || 'INTERMEDIATE') as ProficiencyLevel,
          });
        }
      }
      contact.updateSkills(skills);
    }

    // Update interests if provided
    if (dto.interests !== undefined) {
      const seenInterestIds = new Set<string>();
      const interests: ContactInterest[] = [];
      for (const i of dto.interests) {
        if (!seenInterestIds.has(i.interestId)) {
          seenInterestIds.add(i.interestId);
          interests.push({
            interestId: i.interestId,
          });
        }
      }
      contact.updateInterests(interests);
    }

    // Update hobbies if provided
    if (dto.hobbies !== undefined) {
      const seenHobbyIds = new Set<string>();
      const hobbies: ContactHobby[] = [];
      for (const h of dto.hobbies) {
        if (!seenHobbyIds.has(h.hobbyId)) {
          seenHobbyIds.add(h.hobbyId);
          hobbies.push({
            hobbyId: h.hobbyId,
          });
        }
      }
      contact.updateHobbies(hobbies);
    }

    // Save updated contact
    const savedContact = await this.contactRepository.save(contact);

    logger.info('Contact updated successfully', { userId, contactId });

    return this.toResponseDTO(savedContact);
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
