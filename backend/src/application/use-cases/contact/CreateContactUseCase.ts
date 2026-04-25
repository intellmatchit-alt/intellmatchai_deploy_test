/**
 * Create Contact Use Case
 *
 * Handles creating a new contact for a user.
 *
 * @module application/use-cases/contact/CreateContactUseCase
 */

import crypto from 'crypto';
import { IContactRepository } from '../../../domain/repositories/IContactRepository';
import { Contact, ContactSector, ContactSkill, ContactInterest } from '../../../domain/entities/Contact';
import { CreateContactDTO, ContactResponseDTO } from '../../dto/contact.dto';
import { ConflictError, ValidationError } from '../../../shared/errors';
import { logger } from '../../../shared/logger';
import { ContactSource, ProficiencyLevel } from '../../../domain/value-objects';
import { getContactLimitForUser } from '../../../shared/helpers/planLimits';

/**
 * Create contact use case
 *
 * Creates a new contact in the user's network.
 * Validates for duplicate emails and enforces business rules.
 */
export class CreateContactUseCase {
  constructor(private readonly contactRepository: IContactRepository) {}

  /**
   * Sanitize a string value by normalizing Unicode, stripping invalid surrogates,
   * trimming whitespace, and collapsing multiple spaces.
   */
  private sanitizeString(val: string): string {
    return val
      .normalize('NFC')
      .replace(/[\uD800-\uDFFF]/g, '')
      .trim()
      .replace(/\s{2,}/g, ' ');
  }

  /**
   * Execute contact creation
   *
   * @param userId - ID of the user creating the contact
   * @param dto - Contact creation data
   * @returns Created contact response
   * @throws ConflictError if contact with same email exists
   * @throws ValidationError if data is invalid
   */
  async execute(userId: string, dto: CreateContactDTO): Promise<ContactResponseDTO> {
    logger.info('Creating new contact', { userId, contactName: dto.name });

    // Check contact limit
    const { limit, remaining } = await getContactLimitForUser(userId);
    if (remaining <= 0) {
      throw new ValidationError(`Contact limit reached. Your plan allows ${limit} contacts. Upgrade your plan to add more.`);
    }

    // Check for duplicate email if provided
    if (dto.email) {
      const existingContact = await this.contactRepository.findByEmail(userId, dto.email);
      if (existingContact) {
        throw new ConflictError('A contact with this email already exists');
      }
    }

    // Check for duplicate phone if provided
    if (dto.phone) {
      const existingContact = await this.contactRepository.findByPhone(userId, dto.phone);
      if (existingContact) {
        throw new ConflictError('A contact with this phone number already exists');
      }
    }

    // Map sectors with isPrimary logic and deduplicate by sectorId
    const seenSectorIds = new Set<string>();
    const sectors: ContactSector[] = [];
    for (const s of (dto.sectors || [])) {
      if (!seenSectorIds.has(s.sectorId)) {
        seenSectorIds.add(s.sectorId);
        sectors.push({
          sectorId: s.sectorId,
          isPrimary: s.isPrimary ?? sectors.length === 0, // First sector is primary by default
        });
      }
    }

    // Ensure at least one sector is primary
    if (sectors.length > 0 && !sectors.some((s) => s.isPrimary)) {
      sectors[0].isPrimary = true;
    }

    // Map skills and deduplicate by skillId
    const seenSkillIds = new Set<string>();
    const skills: ContactSkill[] = [];
    for (const s of (dto.skills || [])) {
      if (!seenSkillIds.has(s.skillId)) {
        seenSkillIds.add(s.skillId);
        skills.push({
          skillId: s.skillId,
          proficiency: (s.proficiency || 'INTERMEDIATE') as ProficiencyLevel,
        });
      }
    }

    // Map interests and deduplicate by interestId
    const seenInterestIds = new Set<string>();
    const interests: ContactInterest[] = [];
    for (const i of (dto.interests || [])) {
      if (!seenInterestIds.has(i.interestId)) {
        seenInterestIds.add(i.interestId);
        interests.push({
          interestId: i.interestId,
        });
      }
    }

    // Create contact entity
    const contactId = crypto.randomUUID();
    const now = new Date();

    const contact = Contact.create({
      id: contactId,
      userId,
      name: this.sanitizeString(dto.name),
      title: dto.title?.trim() || undefined,
      firstName: dto.firstName ? this.sanitizeString(dto.firstName) : undefined,
      middleName: dto.middleName ? this.sanitizeString(dto.middleName) : undefined,
      lastName: dto.lastName ? this.sanitizeString(dto.lastName) : undefined,
      email: dto.email ? this.sanitizeString(dto.email.toLowerCase()) : undefined,
      phone: dto.phone ? this.sanitizeString(dto.phone) : undefined,
      company: dto.company ? this.sanitizeString(dto.company) : undefined,
      jobTitle: dto.jobTitle ? this.sanitizeString(dto.jobTitle) : undefined,
      bio: dto.bio ? this.sanitizeString(dto.bio) : undefined,
      bioSummary: dto.bioSummary?.trim() || undefined,
      bioFull: dto.bioFull?.trim() || undefined,
      linkedInUrl: dto.linkedInUrl?.trim() || undefined,
      websiteUrl: dto.websiteUrl?.trim() || undefined,
      location: dto.location ? this.sanitizeString(dto.location) : undefined,
      cardImageUrl: dto.cardImageUrl || undefined,
      source: (dto.source || 'MANUAL') as ContactSource,
      sectors,
      skills,
      interests,
      interactions: [],
      notes: dto.notes ? this.sanitizeString(dto.notes) : undefined,
      isFavorite: false,
      enrichmentData: dto.enrichmentData || undefined,
      createdAt: now,
      updatedAt: now,
    });

    // Save contact
    const savedContact = await this.contactRepository.save(contact);

    logger.info('Contact created successfully', {
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
      title: contact.title || undefined,
      firstName: contact.firstName || undefined,
      middleName: contact.middleName || undefined,
      lastName: contact.lastName || undefined,
      email: contact.email || undefined,
      phone: contact.phone || undefined,
      company: contact.company || undefined,
      jobTitle: contact.jobTitle || undefined,
      bio: contact.bio || undefined,
      bioSummary: contact.bioSummary || undefined,
      bioFull: contact.bioFull || undefined,
      avatarUrl: contact.avatarUrl || undefined,
      linkedInUrl: contact.linkedInUrl || undefined,
      websiteUrl: contact.websiteUrl || undefined,
      location: contact.location || undefined,
      cardImageUrl: contact.cardImageUrl || undefined,
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
      isFavorite: contact.isFavorite,
      matchScore: contact.matchScore,
      lastContactedAt: contact.lastContactedAt?.toISOString(),
      createdAt: contact.createdAt.toISOString(),
      updatedAt: contact.updatedAt.toISOString(),
      enrichmentData: contact.enrichmentData,
    };
  }
}
