/**
 * Add Interaction Use Case
 *
 * Handles adding an interaction to a contact.
 *
 * @module application/use-cases/contact/AddInteractionUseCase
 */

import crypto from 'crypto';
import { IContactRepository } from '../../../domain/repositories/IContactRepository';
import { Contact, ContactInteraction } from '../../../domain/entities/Contact';
import { AddInteractionDTO, ContactResponseDTO } from '../../dto/contact.dto';
import { NotFoundError } from '../../../shared/errors';
import { logger } from '../../../shared/logger';
import { InteractionType } from '../../../domain/value-objects';

/**
 * Add interaction use case
 *
 * Adds an interaction record to a contact and updates
 * the lastContactedAt timestamp.
 */
export class AddInteractionUseCase {
  constructor(private readonly contactRepository: IContactRepository) {}

  /**
   * Execute add interaction
   *
   * @param userId - ID of the user adding the interaction
   * @param contactId - ID of the contact
   * @param dto - Interaction data
   * @returns Updated contact response
   * @throws NotFoundError if contact doesn't exist or user doesn't own it
   */
  async execute(
    userId: string,
    contactId: string,
    dto: AddInteractionDTO
  ): Promise<ContactResponseDTO> {
    logger.info('Adding interaction to contact', { userId, contactId, type: dto.type });

    // Find contact with ownership check
    const contact = await this.contactRepository.findByIdAndUserId(contactId, userId);

    if (!contact) {
      throw new NotFoundError('Contact');
    }

    // Create interaction
    const interaction: ContactInteraction = {
      id: crypto.randomUUID(),
      type: dto.type as InteractionType,
      notes: dto.notes,
      date: dto.date || new Date(),
      createdAt: new Date(),
    };

    // Add interaction to contact
    contact.addInteraction(interaction);

    // Save updated contact
    const savedContact = await this.contactRepository.save(contact);

    logger.info('Interaction added successfully', {
      userId,
      contactId,
      interactionId: interaction.id,
    });

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
