/**
 * Use Case: Remove Team Member
 * Removes a member from a feature's team (Project, Opportunity, Pitch, Deal)
 * Only the feature owner can remove members
 */

import { PrismaClient } from '@prisma/client';
import {
  CollaborationSourceType,
  TeamMemberStatus,
} from '../../../domain/entities/Collaboration';
import {
  projectMemberRepository,
  opportunityMemberRepository,
  pitchMemberRepository,
  dealMemberRepository,
} from '../../../infrastructure/repositories/PrismaTeamMemberRepository';
import {
  NotFoundError,
  ForbiddenError,
  ValidationError,
} from '../../../shared/errors/index';
import { logger } from '../../../shared/logger';

export interface RemoveTeamMemberInput {
  sourceType: CollaborationSourceType;
  sourceId: string;
  memberId: string;
  reason?: string;
}

export interface RemoveTeamMemberOutput {
  success: boolean;
  removedMemberId: string;
}

export class RemoveTeamMemberUseCase {
  constructor(private readonly prisma: PrismaClient) {}

  async execute(
    userId: string,
    input: RemoveTeamMemberInput
  ): Promise<RemoveTeamMemberOutput> {
    // Verify user is the owner of the feature
    const isOwner = await this.checkOwnership(userId, input.sourceType, input.sourceId);
    if (!isOwner) {
      throw new ForbiddenError('Only the owner can remove team members');
    }

    // Remove the member based on source type
    switch (input.sourceType) {
      case CollaborationSourceType.PROJECT:
        await this.removeProjectMember(input.sourceId, input.memberId);
        break;

      case CollaborationSourceType.OPPORTUNITY:
        await this.removeOpportunityMember(input.sourceId, input.memberId);
        break;

      case CollaborationSourceType.PITCH:
        await this.removePitchMember(input.sourceId, input.memberId);
        break;

      case CollaborationSourceType.DEAL:
        await this.removeDealMember(input.sourceId, input.memberId);
        break;

      default:
        throw new ValidationError(`Unknown source type: ${input.sourceType}`);
    }

    logger.info('Team member removed', {
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      memberId: input.memberId,
      removedBy: userId,
      reason: input.reason,
    });

    return {
      success: true,
      removedMemberId: input.memberId,
    };
  }

  /**
   * Check if user owns the feature
   */
  private async checkOwnership(
    userId: string,
    sourceType: CollaborationSourceType,
    sourceId: string
  ): Promise<boolean> {
    switch (sourceType) {
      case CollaborationSourceType.PROJECT:
        const project = await this.prisma.project.findUnique({
          where: { id: sourceId },
          select: { userId: true },
        });
        return project?.userId === userId;

      case CollaborationSourceType.OPPORTUNITY:
        const opportunity = await this.prisma.opportunityIntent.findUnique({
          where: { id: sourceId },
          select: { userId: true },
        });
        return opportunity?.userId === userId;

      case CollaborationSourceType.PITCH:
        const pitch = await this.prisma.pitch.findUnique({
          where: { id: sourceId },
          select: { userId: true },
        });
        return pitch?.userId === userId;

      case CollaborationSourceType.DEAL:
        const deal = await this.prisma.dealRequest.findUnique({
          where: { id: sourceId },
          select: { userId: true },
        });
        return deal?.userId === userId;

      default:
        return false;
    }
  }

  /**
   * Remove project member
   */
  private async removeProjectMember(projectId: string, memberId: string): Promise<void> {
    const member = await this.prisma.projectMember.findFirst({
      where: {
        id: memberId,
        projectId: projectId,
      },
    });

    if (!member) {
      throw new NotFoundError('Team member not found');
    }

    if (member.status === TeamMemberStatus.REMOVED) {
      throw new ValidationError('Team member has already been removed');
    }

    await projectMemberRepository.update(memberId, {
      status: TeamMemberStatus.REMOVED,
      removedAt: new Date(),
    });
  }

  /**
   * Remove opportunity member
   */
  private async removeOpportunityMember(opportunityId: string, memberId: string): Promise<void> {
    const member = await this.prisma.opportunityMember.findFirst({
      where: {
        id: memberId,
        opportunityId: opportunityId,
      },
    });

    if (!member) {
      throw new NotFoundError('Team member not found');
    }

    if (member.status === TeamMemberStatus.REMOVED) {
      throw new ValidationError('Team member has already been removed');
    }

    await opportunityMemberRepository.update(memberId, {
      status: TeamMemberStatus.REMOVED,
      removedAt: new Date(),
    });
  }

  /**
   * Remove pitch member
   */
  private async removePitchMember(pitchId: string, memberId: string): Promise<void> {
    const member = await this.prisma.pitchMember.findFirst({
      where: {
        id: memberId,
        pitchId: pitchId,
      },
    });

    if (!member) {
      throw new NotFoundError('Team member not found');
    }

    if (member.status === TeamMemberStatus.REMOVED) {
      throw new ValidationError('Team member has already been removed');
    }

    await pitchMemberRepository.update(memberId, {
      status: TeamMemberStatus.REMOVED,
      removedAt: new Date(),
    });
  }

  /**
   * Remove deal member
   */
  private async removeDealMember(dealId: string, memberId: string): Promise<void> {
    const member = await this.prisma.dealMember.findFirst({
      where: {
        id: memberId,
        dealId: dealId,
      },
    });

    if (!member) {
      throw new NotFoundError('Team member not found');
    }

    if (member.status === TeamMemberStatus.REMOVED) {
      throw new ValidationError('Team member has already been removed');
    }

    await dealMemberRepository.update(memberId, {
      status: TeamMemberStatus.REMOVED,
      removedAt: new Date(),
    });
  }
}
