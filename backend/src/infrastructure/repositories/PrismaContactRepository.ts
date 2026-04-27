/**
 * Prisma Contact Repository
 *
 * Database implementation of IContactRepository using Prisma.
 *
 * @module infrastructure/repositories/PrismaContactRepository
 */

import { prisma, withRetry } from '../database/prisma/client';
import {
  IContactRepository,
  ContactFilters,
  ContactPaginationOptions,
  PaginatedContacts,
} from '../../domain/repositories/IContactRepository';
import {
  Contact,
  ContactId,
  ContactProps,
  ContactSector,
  ContactSkill,
  ContactInterest,
  ContactHobby,
  ContactInteraction,
} from '../../domain/entities/Contact';
import { UserId } from '../../domain/entities/User';
import {
  ContactSource,
  ProficiencyLevel,
  InteractionType,
} from '../../domain/value-objects';
import {
  Prisma,
  ProficiencyLevel as PrismaProficiencyLevel,
  InteractionType as PrismaInteractionType,
} from '@prisma/client';

/**
 * Prisma Contact Repository implementation
 *
 * Provides data access for Contact entities using Prisma ORM.
 * Maps between database models and domain entities.
 */
export class PrismaContactRepository implements IContactRepository {
  /**
   * Find contact by ID
   *
   * @param id - Contact ID
   * @returns Contact entity or null if not found
   */
  async findById(id: ContactId): Promise<Contact | null> {
    const contact = await prisma.contact.findUnique({
      where: { id },
      include: this.getIncludes(),
    });

    if (!contact) return null;
    return this.toDomainEntity(contact);
  }

  /**
   * Find contact by ID and user ID (ownership check)
   *
   * @param id - Contact ID
   * @param userId - Owner user ID
   * @returns Contact entity or null if not found/not owned
   */
  async findByIdAndUserId(id: ContactId, userId: UserId, organizationId?: string | null): Promise<Contact | null> {
    const where: Prisma.ContactWhereInput = organizationId
      ? { id, organizationId }
      : { id, ownerId: userId, organizationId: null };

    const contact = await prisma.contact.findFirst({
      where,
      include: this.getIncludes(),
    });

    if (!contact) return null;
    return this.toDomainEntity(contact);
  }

  /**
   * Find all contacts for a user with filtering and pagination
   *
   * @param userId - Owner user ID
   * @param filters - Optional query filters
   * @param pagination - Optional pagination options
   * @returns Paginated contacts result
   */
  async findByUserId(
    userId: UserId,
    filters?: ContactFilters,
    pagination?: ContactPaginationOptions
  ): Promise<PaginatedContacts> {
    const page = pagination?.page ?? 1;
    const limit = pagination?.limit ?? 20;
    const skip = (page - 1) * limit;

    // Build where clause - org context scoping
    const where: Prisma.ContactWhereInput = filters?.organizationId
      ? { organizationId: filters.organizationId }
      : { ownerId: userId, organizationId: null };

    // Apply filters
    if (filters?.search) {
      where.OR = [
        { fullName: { contains: filters.search } },
        { email: { contains: filters.search } },
        { company: { contains: filters.search } },
        { notes: { contains: filters.search } },
        { phone: { contains: filters.search } },
      ];
    }

    if (filters?.sectorId) {
      where.contactSectors = {
        some: { sectorId: filters.sectorId },
      };
    }

    if (filters?.isFavorite !== undefined) {
      where.isFavorite = filters.isFavorite;
    }

    if (filters?.minMatchScore !== undefined) {
      where.matchScore = { gte: filters.minMatchScore };
    }

    if (filters?.hasInteraction !== undefined) {
      if (filters.hasInteraction) {
        where.interactions = { some: {} };
      } else {
        where.interactions = { none: {} };
      }
    }

    // Build order by
    const orderBy: Prisma.ContactOrderByWithRelationInput = {};
    const sortBy = pagination?.sortBy ?? 'createdAt';
    const sortOrder = pagination?.sortOrder ?? 'desc';

    switch (sortBy) {
      case 'name':
        orderBy.fullName = sortOrder;
        break;
      case 'matchScore':
        orderBy.matchScore = sortOrder;
        break;
      case 'lastContactedAt':
        orderBy.lastInteractionAt = sortOrder;
        break;
      default:
        orderBy.createdAt = sortOrder;
    }

    // Execute queries in parallel with automatic retry on connection failure
    const [contacts, total] = await withRetry(() =>
      Promise.all([
        prisma.contact.findMany({
          where,
          include: this.getIncludes(),
          orderBy,
          skip,
          take: limit,
        }),
        prisma.contact.count({ where }),
      ])
    );

    return {
      contacts: contacts.map((c) => this.toDomainEntity(c)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Find contact by email for a specific user
   *
   * @param userId - Owner user ID
   * @param email - Contact email
   * @returns Contact entity or null if not found
   */
  async findByEmail(userId: UserId, email: string): Promise<Contact | null> {
    const contact = await prisma.contact.findFirst({
      where: {
        ownerId: userId,
        email: email.toLowerCase(),
      },
      include: this.getIncludes(),
    });

    if (!contact) return null;
    return this.toDomainEntity(contact);
  }

  /**
   * Find contact by phone number for a specific user
   * Normalizes phone numbers by stripping all non-digit characters (except leading +)
   *
   * @param userId - Owner user ID
   * @param phone - Contact phone number
   * @returns Contact entity or null if not found
   */
  async findByPhone(userId: UserId, phone: string): Promise<Contact | null> {
    const normalizedPhone = this.normalizePhone(phone);
    if (!normalizedPhone) return null;

    // Fetch all contacts with a phone number for this user
    const contacts = await prisma.contact.findMany({
      where: {
        ownerId: userId,
        phone: { not: null },
      },
      include: this.getIncludes(),
    });

    // Compare normalized phone numbers
    const match = contacts.find(
      (c) => c.phone && this.normalizePhone(c.phone) === normalizedPhone
    );

    if (!match) return null;
    return this.toDomainEntity(match);
  }

  /**
   * Normalize a phone number by stripping all non-digit characters except leading +
   */
  private normalizePhone(phone: string): string {
    const trimmed = phone.trim();
    if (!trimmed) return '';
    const hasPlus = trimmed.startsWith('+');
    const digits = trimmed.replace(/\D/g, '');
    return hasPlus ? `+${digits}` : digits;
  }

  /**
   * Find recent contacts for a user
   *
   * @param userId - Owner user ID
   * @param limit - Maximum number of contacts to return
   * @returns Array of recent contacts
   */
  async findRecent(userId: UserId, limit: number = 10, organizationId?: string | null): Promise<Contact[]> {
    const where: Prisma.ContactWhereInput = organizationId
      ? { organizationId }
      : { ownerId: userId, organizationId: null };

    const contacts = await prisma.contact.findMany({
      where,
      include: this.getIncludes(),
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return contacts.map((c) => this.toDomainEntity(c));
  }

  /**
   * Find favorite contacts for a user
   *
   * @param userId - Owner user ID
   * @returns Array of favorite contacts
   */
  async findFavorites(userId: UserId): Promise<Contact[]> {
    const contacts = await prisma.contact.findMany({
      where: {
        ownerId: userId,
        isFavorite: true,
      },
      include: this.getIncludes(),
      orderBy: { matchScore: 'desc' },
    });

    return contacts.map((c) => this.toDomainEntity(c));
  }

  /**
   * Find contacts needing follow-up
   *
   * @param userId - Owner user ID
   * @param daysThreshold - Days since last interaction to consider as needing follow-up
   * @returns Array of contacts needing follow-up
   */
  async findNeedingFollowUp(userId: UserId, daysThreshold: number = 30, organizationId?: string | null): Promise<Contact[]> {
    const thresholdDate = new Date();
    thresholdDate.setDate(thresholdDate.getDate() - daysThreshold);

    const baseWhere: Prisma.ContactWhereInput = organizationId
      ? { organizationId }
      : { ownerId: userId, organizationId: null };

    const contacts = await prisma.contact.findMany({
      where: {
        ...baseWhere,
        OR: [
          { lastInteractionAt: null },
          { lastInteractionAt: { lt: thresholdDate } },
        ],
      },
      include: this.getIncludes(),
      orderBy: { lastInteractionAt: 'asc' },
    });

    return contacts.map((c) => this.toDomainEntity(c));
  }

  /**
   * Save contact (create or update)
   *
   * @param contact - Contact entity to save
   * @returns Saved contact entity
   */
  async save(contact: Contact): Promise<Contact> {
    const props = contact.toObject();

    // Check if contact exists
    const existing = await prisma.contact.findUnique({
      where: { id: props.id },
    });

    if (existing) {
      // Update existing contact
      await prisma.$transaction(async (tx) => {
        // Update main contact record
        await tx.contact.update({
          where: { id: props.id },
          data: {
            fullName: props.name,
            title: props.title || null,
            firstName: props.firstName || null,
            middleName: props.middleName || null,
            lastName: props.lastName || null,
            email: props.email?.toLowerCase() || null,
            phone: props.phone || null,
            company: props.company || null,
            jobTitle: props.jobTitle || null,
            website: props.websiteUrl || null,
            linkedinUrl: props.linkedInUrl || null,
            location: props.location || null,
            bio: props.bio || null,
            bioSummary: props.bioSummary || null,
            bioFull: props.bioFull || null,
            notes: props.notes || null,
            cardImageUrl: props.cardImageUrl || null,
            source: props.source,
            isFavorite: props.isFavorite ?? false,
            matchScore: props.matchScore ?? null,
            lastInteractionAt: props.lastContactedAt || null,
            enrichmentData: props.enrichmentData ?? null,
            updatedAt: new Date(),
          },
        });

        // Update sectors
        await tx.contactSector.deleteMany({ where: { contactId: props.id } });
        if (props.sectors.length > 0) {
          await tx.contactSector.createMany({
            data: props.sectors.map((s) => ({
              contactId: props.id,
              sectorId: s.sectorId,
              confidence: s.isPrimary ? 1.0 : 0.8,
              source: 'USER',
            })),
          });
        }

        // Update skills
        await tx.contactSkill.deleteMany({ where: { contactId: props.id } });
        if (props.skills.length > 0) {
          await tx.contactSkill.createMany({
            data: props.skills.map((s) => ({
              contactId: props.id,
              skillId: s.skillId,
              confidence: this.proficiencyToConfidence(s.proficiency),
              source: 'USER',
            })),
          });
        }

        // Update interests
        await tx.contactInterest.deleteMany({ where: { contactId: props.id } });
        if (props.interests && props.interests.length > 0) {
          await tx.contactInterest.createMany({
            data: props.interests.map((i) => ({
              contactId: props.id,
              interestId: i.interestId,
              confidence: 1.0,
              source: 'USER',
            })),
          });
        }

        // Update hobbies
        await tx.contactHobby.deleteMany({ where: { contactId: props.id } });
        if (props.hobbies && props.hobbies.length > 0) {
          await tx.contactHobby.createMany({
            data: props.hobbies.map((h) => ({
              contactId: props.id,
              hobbyId: h.hobbyId,
              confidence: 1.0,
              source: 'USER',
            })),
          });
        }

        // Add new interactions (existing ones are immutable)
        for (const interaction of props.interactions) {
          const existingInteraction = await tx.interaction.findUnique({
            where: { id: interaction.id },
          });

          if (!existingInteraction) {
            await tx.interaction.create({
              data: {
                id: interaction.id,
                userId: props.userId,
                contactId: props.id,
                interactionType: this.mapInteractionType(interaction.type),
                metadata: interaction.notes ? { notes: interaction.notes } : null,
                occurredAt: interaction.date,
              },
            });
          }
        }
      });
    } else {
      // Create new contact
      await prisma.$transaction(async (tx) => {
        await tx.contact.create({
          data: {
            id: props.id,
            ownerId: props.userId,
            fullName: props.name,
            title: props.title || null,
            firstName: props.firstName || null,
            middleName: props.middleName || null,
            lastName: props.lastName || null,
            email: props.email?.toLowerCase() || null,
            phone: props.phone || null,
            company: props.company || null,
            jobTitle: props.jobTitle || null,
            website: props.websiteUrl || null,
            linkedinUrl: props.linkedInUrl || null,
            location: props.location || null,
            bio: props.bio || null,
            bioSummary: props.bioSummary || null,
            bioFull: props.bioFull || null,
            notes: props.notes || null,
            cardImageUrl: props.cardImageUrl || null,
            source: props.source,
            matchScore: props.matchScore ?? null,
            lastInteractionAt: props.lastContactedAt || null,
            enrichmentData: props.enrichmentData ?? null,
            rawSources: [], // Required field - empty array by default
          },
        });

        // Create sectors
        if (props.sectors.length > 0) {
          await tx.contactSector.createMany({
            data: props.sectors.map((s) => ({
              contactId: props.id,
              sectorId: s.sectorId,
              confidence: s.isPrimary ? 1.0 : 0.8,
              source: 'USER',
            })),
          });
        }

        // Create skills
        if (props.skills.length > 0) {
          await tx.contactSkill.createMany({
            data: props.skills.map((s) => ({
              contactId: props.id,
              skillId: s.skillId,
              confidence: this.proficiencyToConfidence(s.proficiency),
              source: 'USER',
            })),
          });
        }

        // Create interests
        if (props.interests && props.interests.length > 0) {
          await tx.contactInterest.createMany({
            data: props.interests.map((i) => ({
              contactId: props.id,
              interestId: i.interestId,
              confidence: 1.0,
              source: 'USER',
            })),
          });
        }

        // Create hobbies
        if (props.hobbies && props.hobbies.length > 0) {
          await tx.contactHobby.createMany({
            data: props.hobbies.map((h) => ({
              contactId: props.id,
              hobbyId: h.hobbyId,
              confidence: 1.0,
              source: 'USER',
            })),
          });
        }

        // Create initial interactions
        if (props.interactions.length > 0) {
          await tx.interaction.createMany({
            data: props.interactions.map((i) => ({
              id: i.id,
              userId: props.userId,
              contactId: props.id,
              interactionType: this.mapInteractionType(i.type),
              metadata: i.notes ? { notes: i.notes } : null,
              occurredAt: i.date,
            })),
          });
        }
      });
    }

    // Return the saved contact
    const savedContact = await this.findById(props.id);
    if (!savedContact) {
      throw new Error('Failed to save contact');
    }
    return savedContact;
  }

  /**
   * Delete contact
   *
   * @param id - Contact ID to delete
   */
  async delete(id: ContactId): Promise<void> {
    await prisma.contact.delete({
      where: { id },
    });
  }

  /**
   * Count contacts for user
   *
   * @param userId - Owner user ID
   * @returns Contact count
   */
  async count(userId: UserId, organizationId?: string | null): Promise<number> {
    const where: Prisma.ContactWhereInput = organizationId
      ? { organizationId }
      : { ownerId: userId, organizationId: null };
    return prisma.contact.count({ where });
  }

  /**
   * Get sector distribution for user's contacts
   *
   * @param userId - Owner user ID
   * @returns Array of sector IDs with contact counts
   */
  async getSectorDistribution(userId: UserId, organizationId?: string | null): Promise<Array<{ sectorId: string; count: number }>> {
    const contactWhere: Prisma.ContactWhereInput = organizationId
      ? { organizationId }
      : { ownerId: userId, organizationId: null };

    const distribution = await prisma.contactSector.groupBy({
      by: ['sectorId'],
      where: {
        contact: contactWhere,
      },
      _count: true,
    });

    return distribution.map((d) => ({
      sectorId: d.sectorId,
      count: d._count,
    }));
  }

  // ============================================
  // Private Helper Methods
  // ============================================

  /**
   * Get standard includes for contact queries
   */
  private getIncludes() {
    return {
      contactSectors: {
        include: { sector: true },
      },
      contactSkills: {
        include: { skill: true },
      },
      contactInterests: {
        include: { interest: true },
      },
      contactHobbies: {
        include: { hobby: true },
      },
      interactions: {
        orderBy: { occurredAt: 'desc' as const },
        take: 50, // Limit interactions to prevent large responses
      },
    };
  }

  /**
   * Convert Prisma model to domain entity
   */
  private toDomainEntity(prismaContact: any): Contact {
    // Map sectors (include name from joined sector table)
    const sectors: ContactSector[] = prismaContact.contactSectors?.map((cs: any) => ({
      sectorId: cs.sectorId,
      sectorName: cs.sector?.name || '',
      sectorNameAr: cs.sector?.nameAr || null,
      isPrimary: Number(cs.confidence) >= 1.0,
    })) || [];

    // Map skills (include name from joined skill table)
    const skills: ContactSkill[] = prismaContact.contactSkills?.map((cs: any) => ({
      skillId: cs.skillId,
      skillName: cs.skill?.name || '',
      skillNameAr: cs.skill?.nameAr || null,
      proficiency: this.confidenceToProficiency(Number(cs.confidence)),
    })) || [];

    // Map interests (include name from joined interest table)
    const interests: ContactInterest[] = prismaContact.contactInterests?.map((ci: any) => ({
      interestId: ci.interestId,
      interestName: ci.interest?.name || '',
    })) || [];

    // Map hobbies (include name from joined hobby table)
    const hobbies: ContactHobby[] = prismaContact.contactHobbies?.map((ch: any) => ({
      hobbyId: ch.hobbyId,
      hobbyName: ch.hobby?.name || '',
    })) || [];

    // Map interactions
    const interactions: ContactInteraction[] = prismaContact.interactions?.map((i: any) => ({
      id: i.id,
      type: this.mapPrismaInteractionType(i.interactionType) as InteractionType,
      notes: i.metadata?.notes,
      date: i.occurredAt,
      createdAt: i.createdAt,
    })) || [];

    const props: ContactProps = {
      id: prismaContact.id,
      userId: prismaContact.ownerId,
      name: prismaContact.fullName,
      title: prismaContact.title || undefined,
      firstName: prismaContact.firstName || undefined,
      middleName: prismaContact.middleName || undefined,
      lastName: prismaContact.lastName || undefined,
      email: prismaContact.email || undefined,
      phone: prismaContact.phone || undefined,
      company: prismaContact.company || undefined,
      jobTitle: prismaContact.jobTitle || undefined,
      bio: prismaContact.bio || undefined,
      bioSummary: prismaContact.bioSummary || undefined,
      bioFull: prismaContact.bioFull || undefined,
      avatarUrl: prismaContact.avatarUrl || undefined,
      linkedInUrl: prismaContact.linkedinUrl || undefined,
      websiteUrl: prismaContact.website || undefined,
      location: prismaContact.location || undefined,
      cardImageUrl: prismaContact.cardImageUrl || undefined,
      source: prismaContact.source as ContactSource,
      sectors,
      skills,
      interests,
      hobbies,
      interactions,
      notes: prismaContact.notes || undefined,
      isFavorite: prismaContact.isFavorite ?? false,
      matchScore: prismaContact.matchScore ? Number(prismaContact.matchScore) : undefined,
      lastContactedAt: prismaContact.lastInteractionAt || undefined,
      enrichmentData: prismaContact.enrichmentData as Record<string, any> | undefined,
      createdAt: prismaContact.createdAt,
      updatedAt: prismaContact.updatedAt,
    };

    return Contact.fromPersistence(props);
  }

  /**
   * Convert proficiency level to confidence score
   */
  private proficiencyToConfidence(proficiency: ProficiencyLevel): number {
    switch (proficiency) {
      case 'BEGINNER':
        return 0.25;
      case 'INTERMEDIATE':
        return 0.5;
      case 'ADVANCED':
        return 0.75;
      case 'EXPERT':
        return 1.0;
      default:
        return 0.5;
    }
  }

  /**
   * Convert confidence score to proficiency level
   */
  private confidenceToProficiency(confidence: number): PrismaProficiencyLevel {
    if (confidence >= 0.9) return PrismaProficiencyLevel.EXPERT;
    if (confidence >= 0.65) return PrismaProficiencyLevel.ADVANCED;
    if (confidence >= 0.4) return PrismaProficiencyLevel.INTERMEDIATE;
    return PrismaProficiencyLevel.BEGINNER;
  }

  /**
   * Map domain interaction type to Prisma enum
   */
  private mapInteractionType(type: InteractionType): PrismaInteractionType {
    switch (type) {
      case InteractionType.MEETING:
        return PrismaInteractionType.MEETING;
      case InteractionType.CALL:
        return PrismaInteractionType.CALLED;
      case InteractionType.EMAIL:
        return PrismaInteractionType.EMAILED;
      case InteractionType.MESSAGE:
        return PrismaInteractionType.MESSAGE;
      case InteractionType.EVENT:
        return PrismaInteractionType.MEETING;
      case InteractionType.OTHER:
      default:
        return PrismaInteractionType.NOTED;
    }
  }

  /**
   * Map Prisma interaction type to domain type
   */
  private mapPrismaInteractionType(type: PrismaInteractionType): InteractionType {
    switch (type) {
      case PrismaInteractionType.MEETING:
        return InteractionType.MEETING;
      case PrismaInteractionType.MESSAGE:
        return InteractionType.MESSAGE;
      case PrismaInteractionType.CALLED:
        return InteractionType.CALL;
      case PrismaInteractionType.EMAILED:
        return InteractionType.EMAIL;
      case PrismaInteractionType.SCANNED:
      case PrismaInteractionType.SAVED:
      case PrismaInteractionType.VIEWED:
      case PrismaInteractionType.NOTED:
      case PrismaInteractionType.FOLLOW_UP:
      case PrismaInteractionType.INTRODUCED:
      default:
        return InteractionType.OTHER;
    }
  }
}
