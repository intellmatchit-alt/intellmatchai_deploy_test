/**
 * Use Case: Get Product Match Contact Detail
 * Retrieves detailed match result for a specific contact
 */

import {
  IProductMatchRunRepository,
  IProductMatchResultRepository,
} from '../../../domain/repositories/IProductMatchRepository';
import { ProductMatchResultEntity } from '../../../domain/entities/ProductMatch';
import { NotFoundError, AuthorizationError } from '../../../shared/errors/index';
import { prisma } from '../../../infrastructure/database/prisma/client';

export interface ContactDetailOutput {
  result: ProductMatchResultEntity;
  contact: {
    id: string;
    fullName: string;
    company: string | null;
    jobTitle: string | null;
    avatarUrl: string | null;
    email: string | null;
    phone: string | null;
    linkedinUrl: string | null;
    bio: string | null;
    sectors: string[];
    skills: string[];
  };
}

export class GetProductMatchContactDetailUseCase {
  constructor(
    private readonly runRepository: IProductMatchRunRepository,
    private readonly resultRepository: IProductMatchResultRepository
  ) {}

  async execute(userId: string, contactId: string, runId: string): Promise<ContactDetailOutput> {
    // Verify run exists and belongs to user
    const run = await this.runRepository.findById(runId);

    if (!run) {
      throw new NotFoundError('Match run not found');
    }

    if (run.userId !== userId) {
      throw new AuthorizationError('Access denied');
    }

    // Get the match result
    const result = await this.resultRepository.findByContactIdAndRunId(contactId, runId);

    if (!result) {
      throw new NotFoundError('Match result not found for this contact');
    }

    // Fetch full contact details
    const contact = await prisma.contact.findUnique({
      where: { id: contactId },
      include: {
        contactSectors: {
          include: { sector: true },
        },
        contactSkills: {
          include: { skill: true },
        },
      },
    });

    if (!contact) {
      throw new NotFoundError('Contact not found');
    }

    // Verify contact belongs to user
    if (contact.ownerId !== userId) {
      throw new AuthorizationError('Access denied');
    }

    return {
      result,
      contact: {
        id: contact.id,
        fullName: contact.fullName,
        company: contact.company,
        jobTitle: contact.jobTitle,
        avatarUrl: contact.avatarUrl,
        email: contact.email,
        phone: contact.phone,
        linkedinUrl: contact.linkedinUrl,
        bio: contact.bio,
        sectors: contact.contactSectors.map(cs => cs.sector.name),
        skills: contact.contactSkills.map(cs => cs.skill.name),
      },
    };
  }
}
