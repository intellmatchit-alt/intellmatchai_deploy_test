/**
 * Use Case: Send Collaboration Request
 * Sends a collaboration request to another user for an existing feature
 * (Project, Opportunity, Pitch, or Deal)
 */

import { PrismaClient } from '@prisma/client';
import {
  ICollaborationRequestRepository,
  ICollaborationSettingsRepository,
} from '../../../domain/repositories/ICollaborationRepository';
import {
  CollaborationSourceType,
  CollaborationRequestStatus,
  SourceFeatureInfo,
  CollaborationCriteria,
} from '../../../domain/entities/Collaboration';
import {
  NotFoundError,
  ForbiddenError,
  ValidationError,
  ConflictError,
} from '../../../shared/errors/index.js';
import { logger } from '../../../shared/logger';

export interface SendCollaborationRequestInput {
  sourceType: CollaborationSourceType;
  sourceId: string;
  // Can send to either a user or a contact (one must be provided)
  toUserId?: string;
  toContactId?: string;
  message?: string;
  voiceMessageUrl?: string;
}

export interface SendCollaborationRequestOutput {
  id: string;
  sourceType: CollaborationSourceType;
  sourceId: string;
  toUserId?: string;
  toContactId?: string;
  status: string;
  createdAt: string;
}

export class SendCollaborationRequestUseCase {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly requestRepository: ICollaborationRequestRepository,
    private readonly settingsRepository: ICollaborationSettingsRepository
  ) {}

  async execute(
    userId: string,
    input: SendCollaborationRequestInput
  ): Promise<SendCollaborationRequestOutput> {
    // Validate that either toUserId or toContactId is provided
    if (!input.toUserId && !input.toContactId) {
      throw new ValidationError('Either toUserId or toContactId must be provided');
    }
    if (input.toUserId && input.toContactId) {
      throw new ValidationError('Cannot send to both a user and a contact');
    }

    // Validate source feature exists and belongs to user
    const sourceFeature = await this.getSourceFeature(input.sourceType, input.sourceId);
    if (!sourceFeature) {
      throw new NotFoundError(`${input.sourceType} not found`);
    }

    if (sourceFeature.ownerUserId !== userId) {
      throw new ForbiddenError(`You can only send requests for your own ${input.sourceType.toLowerCase()}s`);
    }

    // Cannot send request to yourself (only applicable if sending to user)
    if (input.toUserId && input.toUserId === userId) {
      throw new ValidationError('Cannot send collaboration request to yourself');
    }

    // Handle sending to a USER
    if (input.toUserId) {
      // Check if request already exists for this source and recipient
      const existingRequest = await this.requestRepository.findBySourceAndToUserId(
        input.sourceType,
        input.sourceId,
        input.toUserId
      );
      if (existingRequest) {
        throw new ConflictError('A collaboration request already exists for this feature and user');
      }

      // CRITICAL: Check recipient's collaboration settings BEFORE creating request
      const { allowed, reason } = await this.settingsRepository.canReceiveRequest(
        input.toUserId,
        userId,
        input.sourceType
      );

      if (!allowed) {
        throw new ForbiddenError(reason || 'User cannot receive collaboration requests');
      }
    }

    // Handle sending to a CONTACT
    if (input.toContactId) {
      // Verify contact exists and belongs to the user
      const contact = await this.prisma.contact.findUnique({
        where: { id: input.toContactId },
      });
      if (!contact) {
        throw new NotFoundError('Contact not found');
      }
      if (contact.ownerId !== userId) {
        throw new ForbiddenError('You can only send collaboration requests to your own contacts');
      }

      // Check if contact has a matching user account (by email)
      // If so, send to the user instead of the contact
      if (contact.email) {
        const matchingUser = await this.prisma.user.findUnique({
          where: { email: contact.email.toLowerCase() },
        });
        if (matchingUser) {
          logger.info('Contact has matching user account, converting to user request', {
            contactId: input.toContactId,
            contactEmail: contact.email,
            matchingUserId: matchingUser.id,
          });
          // Convert to user request
          input.toUserId = matchingUser.id;
          input.toContactId = undefined;

          // Now check for existing user request
          const existingUserRequest = await this.requestRepository.findBySourceAndToUserId(
            input.sourceType,
            input.sourceId,
            matchingUser.id
          );
          if (existingUserRequest) {
            throw new ConflictError('A collaboration request already exists for this feature and user');
          }

          // Check recipient's collaboration settings
          const { allowed, reason } = await this.settingsRepository.canReceiveRequest(
            matchingUser.id,
            userId,
            input.sourceType
          );
          if (!allowed) {
            throw new ForbiddenError(reason || 'User cannot receive collaboration requests');
          }
        }
      }

      // If still sending to contact (no matching user found), check for existing request
      if (input.toContactId) {
        const existingRequest = await this.prisma.collaborationRequest.findFirst({
          where: {
            sourceType: input.sourceType,
            toContactId: input.toContactId,
            ...(input.sourceType === 'PROJECT' ? { projectId: input.sourceId } : {}),
            ...(input.sourceType === 'OPPORTUNITY' ? { opportunityId: input.sourceId } : {}),
            ...(input.sourceType === 'PITCH' ? { pitchId: input.sourceId } : {}),
            ...(input.sourceType === 'DEAL' ? { dealId: input.sourceId } : {}),
          },
        });
        if (existingRequest) {
          throw new ConflictError('A collaboration request already exists for this feature and contact');
        }
      }
    }

    logger.info('Sending collaboration request', {
      fromUserId: userId,
      toUserId: input.toUserId,
      toContactId: input.toContactId,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
    });

    const request = await this.requestRepository.create({
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      fromUserId: userId,
      toUserId: input.toUserId,
      toContactId: input.toContactId,
      message: input.message,
      voiceMessageUrl: input.voiceMessageUrl,
    });

    logger.info('Collaboration request created', { requestId: request.id });

    // Get the sourceId from the created request
    const sourceId = this.getSourceIdFromRequest(request, input.sourceType);

    return {
      id: request.id,
      sourceType: input.sourceType,
      sourceId: sourceId,
      toUserId: request.toUserId || undefined,
      toContactId: request.toContactId || undefined,
      status: request.status,
      createdAt: request.createdAt.toISOString(),
    };
  }

  /**
   * Get source feature info based on type
   */
  private async getSourceFeature(
    sourceType: CollaborationSourceType,
    sourceId: string
  ): Promise<SourceFeatureInfo | null> {
    switch (sourceType) {
      case CollaborationSourceType.PROJECT:
        return this.getProjectInfo(sourceId);
      case CollaborationSourceType.OPPORTUNITY:
        return this.getOpportunityInfo(sourceId);
      case CollaborationSourceType.PITCH:
        return this.getPitchInfo(sourceId);
      case CollaborationSourceType.DEAL:
        return this.getDealInfo(sourceId);
      default:
        throw new ValidationError(`Unknown source type: ${sourceType}`);
    }
  }

  private async getProjectInfo(projectId: string): Promise<SourceFeatureInfo | null> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: {
        sectors: { include: { sector: true } },
        skillsNeeded: { include: { skill: true } },
      },
    });

    if (!project || !project.isActive) return null;

    const criteria: CollaborationCriteria = {
      sectors: project.sectors.map((ps) => ps.sector.name),
      skills: project.skillsNeeded.map((ps) => ps.skill.name),
      keywords: (project.keywords as string[]) || [],
    };

    return {
      type: CollaborationSourceType.PROJECT,
      id: project.id,
      title: project.title,
      description: project.summary,
      criteria,
      ownerUserId: project.userId,
    };
  }

  private async getOpportunityInfo(opportunityId: string): Promise<SourceFeatureInfo | null> {
    const opportunity = await this.prisma.opportunityIntent.findUnique({
      where: { id: opportunityId },
      include: {
        sectorPrefs: { include: { sector: true } },
        skillPrefs: { include: { skill: true } },
      },
    });

    if (!opportunity || !opportunity.isActive) return null;

    const criteria: CollaborationCriteria = {
      sectors: opportunity.sectorPrefs.map((sp) => sp.sector.name),
      skills: opportunity.skillPrefs.map((sp) => sp.skill.name),
      locations: opportunity.locationPref ? [opportunity.locationPref] : [],
    };

    return {
      type: CollaborationSourceType.OPPORTUNITY,
      id: opportunity.id,
      title: opportunity.title,
      description: opportunity.notes,
      criteria,
      ownerUserId: opportunity.userId,
    };
  }

  private async getPitchInfo(pitchId: string): Promise<SourceFeatureInfo | null> {
    const pitch = await this.prisma.pitch.findUnique({
      where: { id: pitchId },
      include: {
        sections: true,
        needs: true,
      },
    });

    if (!pitch || pitch.deletedAt) return null;

    // Extract criteria from pitch sections
    const allSectors: string[] = [];
    const allSkills: string[] = [];
    const allKeywords: string[] = [];

    for (const section of pitch.sections) {
      if (section.inferredSectors) {
        allSectors.push(...(section.inferredSectors as string[]));
      }
      if (section.inferredSkills) {
        allSkills.push(...(section.inferredSkills as string[]));
      }
      if (section.keywords) {
        allKeywords.push(...(section.keywords as string[]));
      }
    }

    const criteria: CollaborationCriteria = {
      sectors: [...new Set(allSectors)],
      skills: [...new Set(allSkills)],
      keywords: [...new Set(allKeywords)],
    };

    return {
      type: CollaborationSourceType.PITCH,
      id: pitch.id,
      title: pitch.title || pitch.fileName,
      description: pitch.companyName,
      criteria,
      ownerUserId: pitch.userId,
    };
  }

  private async getDealInfo(dealId: string): Promise<SourceFeatureInfo | null> {
    const deal = await this.prisma.dealRequest.findUnique({
      where: { id: dealId },
    });

    if (!deal) return null;

    const criteria: CollaborationCriteria = {
      sectors: deal.domain ? [deal.domain] : [],
      keywords: deal.solutionType ? [deal.solutionType] : [],
    };

    return {
      type: CollaborationSourceType.DEAL,
      id: deal.id,
      title: deal.title || `${deal.mode} Deal`,
      description: deal.problemStatement || deal.targetDescription,
      criteria,
      ownerUserId: deal.userId,
    };
  }

  /**
   * Get the source ID from a request based on type
   */
  private getSourceIdFromRequest(
    request: { projectId: string | null; opportunityId: string | null; pitchId: string | null; dealId: string | null },
    sourceType: CollaborationSourceType
  ): string {
    switch (sourceType) {
      case CollaborationSourceType.PROJECT:
        return request.projectId!;
      case CollaborationSourceType.OPPORTUNITY:
        return request.opportunityId!;
      case CollaborationSourceType.PITCH:
        return request.pitchId!;
      case CollaborationSourceType.DEAL:
        return request.dealId!;
      default:
        throw new Error(`Unknown source type: ${sourceType}`);
    }
  }
}
