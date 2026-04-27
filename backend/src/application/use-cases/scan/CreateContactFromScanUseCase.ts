/**
 * Create Contact From Scan Use Case
 *
 * Handles creating a contact from scanned card data.
 *
 * @module application/use-cases/scan/CreateContactFromScanUseCase
 */

import crypto from 'crypto';
import { IContactRepository } from '../../../domain/repositories/IContactRepository';
import { Contact, ContactSector, ContactInteraction } from '../../../domain/entities/Contact';
import { CreateContactFromScanDTO, ContactResponseDTO } from '../../dto/contact.dto';
import { ConflictError } from '../../../shared/errors';
import { logger } from '../../../shared/logger';
import { ContactSource, InteractionType } from '../../../domain/value-objects';

/**
 * Create contact from scan use case
 *
 * Creates a contact from confirmed scan data.
 * Includes automatic interaction logging and sector assignment.
 */
export class CreateContactFromScanUseCase {
  constructor(private readonly contactRepository: IContactRepository) {}

  /**
   * Execute contact creation from scan
   *
   * @param userId - ID of the user creating the contact
   * @param dto - Scan confirmation data
   * @returns Created contact response
   */
  async execute(userId: string, dto: CreateContactFromScanDTO): Promise<ContactResponseDTO> {
    logger.info('Creating contact from scan', { userId, contactName: dto.name });

    // Check for duplicate email if provided
    if (dto.email) {
      const existingContact = await this.contactRepository.findByEmail(userId, dto.email);
      if (existingContact) {
        throw new ConflictError('A contact with this email already exists');
      }
    }

    // Map sectors if provided
    const sectors: ContactSector[] = (dto.sectors || []).map((sectorId, index) => ({
      sectorId,
      isPrimary: index === 0,
    }));

    // Create initial "scanned" interaction
    const scanInteraction: ContactInteraction = {
      id: crypto.randomUUID(),
      type: 'OTHER' as InteractionType,
      notes: 'Contact created via business card scan',
      date: new Date(),
      createdAt: new Date(),
    };

    // Create contact entity
    const contactId = crypto.randomUUID();
    const now = new Date();

    const contact = Contact.create({
      id: contactId,
      userId,
      name: dto.name.trim(),
      email: dto.email?.toLowerCase().trim(),
      phone: dto.phone?.trim(),
      company: dto.company?.trim(),
      jobTitle: dto.jobTitle?.trim(),
      websiteUrl: dto.website?.trim(),
      cardImageUrl: dto.cardImageUrl,
      source: 'CARD_SCAN' as ContactSource,
      sectors,
      skills: [],
      interests: [],
      hobbies: [],
      interactions: [scanInteraction],
      isFavorite: false,
      lastContactedAt: now,
      createdAt: now,
      updatedAt: now,
    });

    // Save contact
    const savedContact = await this.contactRepository.save(contact);

    logger.info('Contact created from scan successfully', {
      userId,
      contactId: savedContact.id,
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
      avatarUrl: contact.avatarUrl,
      linkedInUrl: contact.linkedInUrl,
      websiteUrl: contact.websiteUrl,
      location: contact.location,
      cardImageUrl: contact.cardImageUrl,
      source: contact.source,
      sectors: contact.sectors.map((s) => ({
        id: s.sectorId,
        name: '',
        isPrimary: s.isPrimary,
      })),
      skills: contact.skills.map((s) => ({
        id: s.skillId,
        name: '',
        proficiency: s.proficiency,
      })),
      interests: contact.interests.map((i) => ({
        id: i.interestId,
        name: '',
      })),
      hobbies: contact.hobbies.map((h) => ({
        id: h.hobbyId,
        name: '',
      })),
      isFavorite: contact.isFavorite,
      matchScore: contact.matchScore,
      lastContactedAt: contact.lastContactedAt?.toISOString(),
      createdAt: contact.createdAt.toISOString(),
      updatedAt: contact.updatedAt.toISOString(),
    };
  }
}
