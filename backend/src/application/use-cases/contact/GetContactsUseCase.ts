/**
 * Get Contacts Use Case
 *
 * Handles retrieving a paginated list of contacts with filtering.
 *
 * @module application/use-cases/contact/GetContactsUseCase
 */

import { IContactRepository, ContactFilters, ContactPaginationOptions } from '../../../domain/repositories/IContactRepository';
import { Contact } from '../../../domain/entities/Contact';
import { ContactFiltersDTO, ContactListResponseDTO, ContactResponseDTO } from '../../dto/contact.dto';
import { logger } from '../../../shared/logger';
import { prisma } from '../../../infrastructure/database/prisma/client';

/**
 * Get contacts use case
 *
 * Retrieves contacts with support for:
 * - Text search across name, email, company, notes
 * - Sector filtering
 * - Favorite filtering
 * - Match score filtering
 * - Pagination
 * - Sorting
 */
export class GetContactsUseCase {
  constructor(private readonly contactRepository: IContactRepository) {}

  /**
   * Execute contacts query
   *
   * @param userId - ID of the user whose contacts to retrieve
   * @param filtersDTO - Query filters
   * @returns Paginated contacts list
   */
  async execute(userId: string, filtersDTO: ContactFiltersDTO): Promise<ContactListResponseDTO> {
    logger.debug('Getting contacts', { userId, filters: filtersDTO });

    // Map DTO filters to repository filters
    const filters: ContactFilters = {};

    if (filtersDTO.search) {
      filters.search = filtersDTO.search.trim();
    }

    if (filtersDTO.sector) {
      filters.sectorId = filtersDTO.sector;
    }

    if (filtersDTO.favorite !== undefined) {
      filters.isFavorite = filtersDTO.favorite;
    }

    if (filtersDTO.minScore !== undefined) {
      filters.minMatchScore = filtersDTO.minScore;
    }

    // Pass organization context for scoping
    if (filtersDTO.organizationId !== undefined) {
      filters.organizationId = filtersDTO.organizationId;
    }

    // Map pagination options
    const pagination: ContactPaginationOptions = {
      page: filtersDTO.page ?? 1,
      limit: filtersDTO.limit ?? 20,
      sortBy: filtersDTO.sort ?? 'createdAt',
      sortOrder: filtersDTO.order ?? 'desc',
    };

    // Execute query
    const result = await this.contactRepository.findByUserId(userId, filters, pagination);

    // Fetch sector and skill names for lookup
    const sectorIds = [...new Set(result.contacts.flatMap(c => c.sectors.map(s => s.sectorId)))];
    const skillIds = [...new Set(result.contacts.flatMap(c => c.skills.map(s => s.skillId)))];

    const [sectors, skills] = await Promise.all([
      sectorIds.length > 0 ? prisma.sector.findMany({ where: { id: { in: sectorIds } } }) : [],
      skillIds.length > 0 ? prisma.skill.findMany({ where: { id: { in: skillIds } } }) : [],
    ]);

    const sectorMap = new Map<string, { name: string; nameAr: string | null }>();
    sectors.forEach(s => sectorMap.set(s.id, { name: s.name, nameAr: s.nameAr }));
    const skillMap = new Map<string, { name: string; nameAr: string | null }>();
    skills.forEach(s => skillMap.set(s.id, { name: s.name, nameAr: s.nameAr }));

    logger.debug('Contacts retrieved', {
      userId,
      total: result.total,
      page: result.page,
      returned: result.contacts.length,
    });

    return {
      contacts: result.contacts.map((c) => this.toResponseDTO(c, sectorMap, skillMap)),
      total: result.total,
      page: result.page,
      limit: result.limit,
      totalPages: result.totalPages,
    };
  }

  /**
   * Convert Contact entity to response DTO
   */
  private toResponseDTO(
    contact: Contact,
    sectorMap: Map<string, { name: string; nameAr: string | null }>,
    skillMap: Map<string, { name: string; nameAr: string | null }>
  ): ContactResponseDTO {
    return {
      id: contact.id,
      name: contact.name,
      fullName: contact.name, // Also include fullName for frontend compatibility
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
        name: sectorMap.get(s.sectorId)?.name || '',
        nameAr: sectorMap.get(s.sectorId)?.nameAr || null,
        isPrimary: s.isPrimary,
      })),
      skills: contact.skills.map((s) => ({
        id: s.skillId,
        name: skillMap.get(s.skillId)?.name || '',
        nameAr: skillMap.get(s.skillId)?.nameAr || null,
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
