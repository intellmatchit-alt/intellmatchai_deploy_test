/**
 * Candidate Retrieval Service
 *
 * Searches internal database for potential matches across Users, Contacts,
 * and BusinessCard tables. Returns raw candidates for scoring.
 *
 * @module application/use-cases/find-contact/CandidateRetrievalService
 */

import { PrismaClient, Prisma } from '@prisma/client';
import { ParsedQuery, InputType } from './QueryParserService';
import { logger } from '../../../shared/logger';

const prisma = new PrismaClient();

// Type for User with included relations
type UserWithRelations = Prisma.UserGetPayload<{
  include: {
    userSectors: { include: { sector: true } };
    userSkills: { include: { skill: true } };
    userInterests: { include: { interest: true } };
  };
}>;

// Type for Contact with included relations
type ContactWithRelations = Prisma.ContactGetPayload<{
  include: {
    contactSectors: { include: { sector: true } };
    contactSkills: { include: { skill: true } };
    contactInterests: { include: { interest: true } };
  };
}>;

/**
 * Candidate type enum
 */
export type CandidateType = 'USER' | 'CONTACT';

/**
 * Raw candidate from database search
 */
export interface RawCandidate {
  type: CandidateType;
  id: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  jobTitle: string | null;
  location: string | null;
  linkedinUrl: string | null;
  websiteUrl: string | null;
  avatarUrl: string | null;
  bio: string | null;
  // Match metadata
  matchedFields: string[];
  sectorIds: string[];
  skillIds: string[];
  interestIds: string[];
  // Owner info for contacts
  ownerId?: string;
}

/**
 * Candidate Retrieval Service
 */
export class CandidateRetrievalService {
  private maxCandidates = 50;

  /**
   * Retrieve candidates based on parsed query
   *
   * @param parsedQuery - Normalized query from QueryParserService
   * @param userId - Searching user's ID (to include their contacts)
   * @returns Array of raw candidates
   */
  async retrieveCandidates(
    parsedQuery: ParsedQuery,
    userId: string
  ): Promise<RawCandidate[]> {
    const candidates: RawCandidate[] = [];

    switch (parsedQuery.type) {
      case 'phone':
        if (parsedQuery.parsed.phoneE164) {
          candidates.push(
            ...(await this.searchByPhone(parsedQuery.parsed.phoneE164, userId))
          );
        }
        break;

      case 'email':
        if (parsedQuery.parsed.email) {
          candidates.push(
            ...(await this.searchByEmail(parsedQuery.parsed.email, userId))
          );
        }
        break;

      case 'url':
        if (parsedQuery.parsed.urlType === 'linkedin' && parsedQuery.parsed.linkedinUsername) {
          candidates.push(
            ...(await this.searchByLinkedIn(parsedQuery.parsed.url!, userId))
          );
        } else if (parsedQuery.parsed.url) {
          candidates.push(
            ...(await this.searchByWebsite(parsedQuery.parsed.url, userId))
          );
        }
        break;

      case 'name':
        if (parsedQuery.parsed.nameTokens && parsedQuery.parsed.nameTokens.length > 0) {
          candidates.push(
            ...(await this.searchByName(parsedQuery.parsed.nameTokens, userId))
          );
        }
        break;

      case 'image':
        // Image search is handled by OCR/face services before retrieval
        // This would be called after extracting text from OCR
        break;
    }

    // Deduplicate candidates
    return this.deduplicateCandidates(candidates);
  }

  /**
   * Search by phone number (E.164 format)
   */
  private async searchByPhone(phoneE164: string, userId: string): Promise<RawCandidate[]> {
    const candidates: RawCandidate[] = [];

    // Normalize phone for flexible matching
    const phoneDigits = phoneE164.replace(/\D/g, '');
    const phoneLast10 = phoneDigits.slice(-10);

    // Search Users
    const users = await prisma.user.findMany({
      where: {
        phone: {
          contains: phoneLast10,
        },
        isActive: true,
      },
      include: {
        userSectors: { include: { sector: true } },
        userSkills: { include: { skill: true } },
        userInterests: { include: { interest: true } },
      },
      take: this.maxCandidates,
    });

    for (const user of users) {
      candidates.push({
        type: 'USER',
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        phone: user.phone,
        company: user.company,
        jobTitle: user.jobTitle,
        location: user.location,
        linkedinUrl: user.linkedinUrl,
        websiteUrl: user.websiteUrl,
        avatarUrl: user.avatarUrl,
        bio: user.bio,
        matchedFields: ['phone'],
        sectorIds: user.userSectors.map(us => us.sectorId),
        skillIds: user.userSkills.map(us => us.skillId),
        interestIds: user.userInterests.map(ui => ui.interestId),
      });
    }

    // Search Contacts (user's contacts)
    const contacts = await prisma.contact.findMany({
      where: {
        ownerId: userId,
        phone: {
          contains: phoneLast10,
        },
      },
      include: {
        contactSectors: { include: { sector: true } },
        contactSkills: { include: { skill: true } },
        contactInterests: { include: { interest: true } },
      },
      take: this.maxCandidates,
    });

    for (const contact of contacts) {
      candidates.push({
        type: 'CONTACT',
        id: contact.id,
        fullName: contact.fullName,
        email: contact.email,
        phone: contact.phone,
        company: contact.company,
        jobTitle: contact.jobTitle,
        location: contact.location,
        linkedinUrl: contact.linkedinUrl,
        websiteUrl: contact.website,
        avatarUrl: contact.cardImageUrl,
        bio: contact.bio,
        matchedFields: ['phone'],
        sectorIds: contact.contactSectors.map(cs => cs.sectorId),
        skillIds: contact.contactSkills.map(cs => cs.skillId),
        interestIds: contact.contactInterests.map(ci => ci.interestId),
        ownerId: contact.ownerId,
      });
    }

    return candidates;
  }

  /**
   * Search by email address
   */
  private async searchByEmail(email: string, userId: string): Promise<RawCandidate[]> {
    const candidates: RawCandidate[] = [];
    const normalizedEmail = email.toLowerCase();

    // Search Users - exact match
    const users = await prisma.user.findMany({
      where: {
        email: normalizedEmail,
        isActive: true,
      },
      include: {
        userSectors: { include: { sector: true } },
        userSkills: { include: { skill: true } },
        userInterests: { include: { interest: true } },
      },
      take: this.maxCandidates,
    });

    for (const user of users) {
      candidates.push({
        type: 'USER',
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        phone: user.phone,
        company: user.company,
        jobTitle: user.jobTitle,
        location: user.location,
        linkedinUrl: user.linkedinUrl,
        websiteUrl: user.websiteUrl,
        avatarUrl: user.avatarUrl,
        bio: user.bio,
        matchedFields: ['email'],
        sectorIds: user.userSectors.map(us => us.sectorId),
        skillIds: user.userSkills.map(us => us.skillId),
        interestIds: user.userInterests.map(ui => ui.interestId),
      });
    }

    // Search Contacts
    const contacts = await prisma.contact.findMany({
      where: {
        ownerId: userId,
        email: normalizedEmail,
      },
      include: {
        contactSectors: { include: { sector: true } },
        contactSkills: { include: { skill: true } },
        contactInterests: { include: { interest: true } },
      },
      take: this.maxCandidates,
    });

    for (const contact of contacts) {
      candidates.push({
        type: 'CONTACT',
        id: contact.id,
        fullName: contact.fullName,
        email: contact.email,
        phone: contact.phone,
        company: contact.company,
        jobTitle: contact.jobTitle,
        location: contact.location,
        linkedinUrl: contact.linkedinUrl,
        websiteUrl: contact.website,
        avatarUrl: contact.cardImageUrl,
        bio: contact.bio,
        matchedFields: ['email'],
        sectorIds: contact.contactSectors.map(cs => cs.sectorId),
        skillIds: contact.contactSkills.map(cs => cs.skillId),
        interestIds: contact.contactInterests.map(ci => ci.interestId),
        ownerId: contact.ownerId,
      });
    }

    return candidates;
  }

  /**
   * Search by LinkedIn URL
   */
  private async searchByLinkedIn(linkedinUrl: string, userId: string): Promise<RawCandidate[]> {
    const candidates: RawCandidate[] = [];

    // Extract username for flexible matching
    const usernameMatch = linkedinUrl.match(/linkedin\.com\/(in|pub)\/([^/?]+)/i);
    const username = usernameMatch?.[2]?.toLowerCase();

    // Search Users
    const users = await prisma.user.findMany({
      where: {
        linkedinUrl: {
          contains: username || linkedinUrl,
        },
        isActive: true,
      },
      include: {
        userSectors: { include: { sector: true } },
        userSkills: { include: { skill: true } },
        userInterests: { include: { interest: true } },
      },
      take: this.maxCandidates,
    });

    for (const user of users) {
      candidates.push({
        type: 'USER',
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        phone: user.phone,
        company: user.company,
        jobTitle: user.jobTitle,
        location: user.location,
        linkedinUrl: user.linkedinUrl,
        websiteUrl: user.websiteUrl,
        avatarUrl: user.avatarUrl,
        bio: user.bio,
        matchedFields: ['linkedin'],
        sectorIds: user.userSectors.map(us => us.sectorId),
        skillIds: user.userSkills.map(us => us.skillId),
        interestIds: user.userInterests.map(ui => ui.interestId),
      });
    }

    // Search Contacts
    const contacts = await prisma.contact.findMany({
      where: {
        ownerId: userId,
        linkedinUrl: {
          contains: username || linkedinUrl,
        },
      },
      include: {
        contactSectors: { include: { sector: true } },
        contactSkills: { include: { skill: true } },
        contactInterests: { include: { interest: true } },
      },
      take: this.maxCandidates,
    });

    for (const contact of contacts) {
      candidates.push({
        type: 'CONTACT',
        id: contact.id,
        fullName: contact.fullName,
        email: contact.email,
        phone: contact.phone,
        company: contact.company,
        jobTitle: contact.jobTitle,
        location: contact.location,
        linkedinUrl: contact.linkedinUrl,
        websiteUrl: contact.website,
        avatarUrl: contact.cardImageUrl,
        bio: contact.bio,
        matchedFields: ['linkedin'],
        sectorIds: contact.contactSectors.map(cs => cs.sectorId),
        skillIds: contact.contactSkills.map(cs => cs.skillId),
        interestIds: contact.contactInterests.map(ci => ci.interestId),
        ownerId: contact.ownerId,
      });
    }

    return candidates;
  }

  /**
   * Search by website URL
   */
  private async searchByWebsite(websiteUrl: string, userId: string): Promise<RawCandidate[]> {
    const candidates: RawCandidate[] = [];

    // Extract domain for matching
    let domain: string;
    try {
      const urlObj = new URL(websiteUrl.startsWith('http') ? websiteUrl : `https://${websiteUrl}`);
      domain = urlObj.hostname.replace(/^www\./, '');
    } catch {
      domain = websiteUrl;
    }

    // Search Users
    const users = await prisma.user.findMany({
      where: {
        websiteUrl: {
          contains: domain,
        },
        isActive: true,
      },
      include: {
        userSectors: { include: { sector: true } },
        userSkills: { include: { skill: true } },
        userInterests: { include: { interest: true } },
      },
      take: this.maxCandidates,
    });

    for (const user of users) {
      candidates.push({
        type: 'USER',
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        phone: user.phone,
        company: user.company,
        jobTitle: user.jobTitle,
        location: user.location,
        linkedinUrl: user.linkedinUrl,
        websiteUrl: user.websiteUrl,
        avatarUrl: user.avatarUrl,
        bio: user.bio,
        matchedFields: ['website'],
        sectorIds: user.userSectors.map(us => us.sectorId),
        skillIds: user.userSkills.map(us => us.skillId),
        interestIds: user.userInterests.map(ui => ui.interestId),
      });
    }

    // Search Contacts
    const contacts = await prisma.contact.findMany({
      where: {
        ownerId: userId,
        website: {
          contains: domain,
        },
      },
      include: {
        contactSectors: { include: { sector: true } },
        contactSkills: { include: { skill: true } },
        contactInterests: { include: { interest: true } },
      },
      take: this.maxCandidates,
    });

    for (const contact of contacts) {
      candidates.push({
        type: 'CONTACT',
        id: contact.id,
        fullName: contact.fullName,
        email: contact.email,
        phone: contact.phone,
        company: contact.company,
        jobTitle: contact.jobTitle,
        location: contact.location,
        linkedinUrl: contact.linkedinUrl,
        websiteUrl: contact.website,
        avatarUrl: contact.cardImageUrl,
        bio: contact.bio,
        matchedFields: ['website'],
        sectorIds: contact.contactSectors.map(cs => cs.sectorId),
        skillIds: contact.contactSkills.map(cs => cs.skillId),
        interestIds: contact.contactInterests.map(ci => ci.interestId),
        ownerId: contact.ownerId,
      });
    }

    return candidates;
  }

  /**
   * Search by name tokens using full-text search and fuzzy matching
   */
  private async searchByName(nameTokens: string[], userId: string): Promise<RawCandidate[]> {
    const candidates: RawCandidate[] = [];
    const searchTerm = nameTokens.join(' ');

    // Search on Users (no fulltext index, use contains only)
    try {
      const users = await prisma.user.findMany({
        where: {
          OR: [
            // Search by first name token
            {
              fullName: {
                contains: nameTokens[0],
              },
            },
            // Also search by last name token if available
            ...(nameTokens.length > 1
              ? [
                  {
                    fullName: {
                      contains: nameTokens[nameTokens.length - 1],
                    },
                  },
                ]
              : []),
            // Also search by company if multiple tokens
            ...(nameTokens.length > 1
              ? [
                  {
                    company: {
                      contains: nameTokens[nameTokens.length - 1],
                    },
                  },
                ]
              : []),
          ],
          isActive: true,
        },
        include: {
          userSectors: { include: { sector: true } },
          userSkills: { include: { skill: true } },
          userInterests: { include: { interest: true } },
        },
        take: this.maxCandidates,
      });

      for (const user of users) {
        const matchedFields: string[] = [];
        const userNameLower = user.fullName.toLowerCase();

        for (const token of nameTokens) {
          if (userNameLower.includes(token)) {
            if (!matchedFields.includes('name')) matchedFields.push('name');
          }
        }

        if (user.company && nameTokens.some(t => user.company!.toLowerCase().includes(t))) {
          matchedFields.push('company');
        }

        candidates.push({
          type: 'USER',
          id: user.id,
          fullName: user.fullName,
          email: user.email,
          phone: user.phone,
          company: user.company,
          jobTitle: user.jobTitle,
          location: user.location,
          linkedinUrl: user.linkedinUrl,
          websiteUrl: user.websiteUrl,
          avatarUrl: user.avatarUrl,
          bio: user.bio,
          matchedFields: matchedFields.length > 0 ? matchedFields : ['name'],
          sectorIds: user.userSectors.map(us => us.sectorId),
          skillIds: user.userSkills.map(us => us.skillId),
          interestIds: user.userInterests.map(ui => ui.interestId),
        });
      }
    } catch (error) {
      logger.error('User name search failed', { error, nameTokens });
    }

    // Full-text search on Contacts (Contact model has fulltext index)
    try {
      // Build search conditions - use fulltext only if search term is long enough
      const useFulltext = searchTerm.length >= 3;

      const contacts = await prisma.contact.findMany({
        where: {
          ownerId: userId,
          OR: [
            // Fulltext search (only if term is long enough for MySQL ft_min_word_len)
            ...(useFulltext
              ? [
                  {
                    fullName: {
                      search: searchTerm,
                    },
                  },
                ]
              : []),
            // Fallback: contains search on first token
            {
              fullName: {
                contains: nameTokens[0],
              },
            },
            // Search last token if multiple tokens provided
            ...(nameTokens.length > 1
              ? [
                  {
                    fullName: {
                      contains: nameTokens[nameTokens.length - 1],
                    },
                  },
                  {
                    company: {
                      contains: nameTokens[nameTokens.length - 1],
                    },
                  },
                ]
              : []),
          ],
        },
        include: {
          contactSectors: { include: { sector: true } },
          contactSkills: { include: { skill: true } },
          contactInterests: { include: { interest: true } },
        },
        take: this.maxCandidates,
      });

      for (const contact of contacts) {
        const matchedFields: string[] = [];
        const contactNameLower = contact.fullName.toLowerCase();

        for (const token of nameTokens) {
          if (contactNameLower.includes(token)) {
            if (!matchedFields.includes('name')) matchedFields.push('name');
          }
        }

        if (contact.company && nameTokens.some(t => contact.company!.toLowerCase().includes(t))) {
          matchedFields.push('company');
        }

        candidates.push({
          type: 'CONTACT',
          id: contact.id,
          fullName: contact.fullName,
          email: contact.email,
          phone: contact.phone,
          company: contact.company,
          jobTitle: contact.jobTitle,
          location: contact.location,
          linkedinUrl: contact.linkedinUrl,
          websiteUrl: contact.website,
          avatarUrl: contact.cardImageUrl,
          bio: contact.bio,
          matchedFields: matchedFields.length > 0 ? matchedFields : ['name'],
          sectorIds: contact.contactSectors.map(cs => cs.sectorId),
          skillIds: contact.contactSkills.map(cs => cs.skillId),
          interestIds: contact.contactInterests.map(ci => ci.interestId),
          ownerId: contact.ownerId,
        });
      }
    } catch (error) {
      logger.error('Contact name search failed', { error, nameTokens });
    }

    return candidates;
  }

  /**
   * Remove duplicate candidates (same person appearing as both User and Contact)
   */
  private deduplicateCandidates(candidates: RawCandidate[]): RawCandidate[] {
    const seen = new Map<string, RawCandidate>();

    for (const candidate of candidates) {
      // Create a dedup key based on email or linkedin
      const dedupKey = candidate.email?.toLowerCase() ||
                       candidate.linkedinUrl?.toLowerCase() ||
                       `${candidate.type}:${candidate.id}`;

      const existing = seen.get(dedupKey);
      if (!existing) {
        seen.set(dedupKey, candidate);
      } else {
        // Prefer USER over CONTACT
        if (candidate.type === 'USER' && existing.type === 'CONTACT') {
          // Merge matched fields
          const mergedFields = [...new Set([...existing.matchedFields, ...candidate.matchedFields])];
          candidate.matchedFields = mergedFields;
          seen.set(dedupKey, candidate);
        } else {
          // Merge matched fields into existing
          existing.matchedFields = [...new Set([...existing.matchedFields, ...candidate.matchedFields])];
        }
      }
    }

    return Array.from(seen.values());
  }
}

export default CandidateRetrievalService;
