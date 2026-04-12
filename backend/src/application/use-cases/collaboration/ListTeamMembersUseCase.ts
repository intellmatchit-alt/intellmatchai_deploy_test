/**
 * Use Case: List Team Members
 * Retrieves team members for a feature (Project, Opportunity, Pitch, Deal)
 */

import { PrismaClient } from '@prisma/client';
import {
  CollaborationSourceType,
  TeamMemberStatus,
  TeamMemberRole,
} from '../../../domain/entities/Collaboration';
import { TeamMemberWithUser } from '../../../domain/entities/TeamMember';
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
} from '../../../shared/errors/index.js';
import { logger } from '../../../shared/logger';

export interface ListTeamMembersInput {
  sourceType: CollaborationSourceType;
  sourceId: string;
  status?: TeamMemberStatus;
}

export interface ListTeamMembersOutput {
  members: TeamMemberWithUser[];
  total: number;
  summary: {
    invited: number;
    accepted: number;
    declined: number;
    removed: number;
  };
}

export class ListTeamMembersUseCase {
  constructor(private readonly prisma: PrismaClient) {}

  async execute(
    userId: string,
    input: ListTeamMembersInput
  ): Promise<ListTeamMembersOutput> {
    // Verify user has access to this feature (must be owner or team member)
    const hasAccess = await this.checkAccess(userId, input.sourceType, input.sourceId);
    if (!hasAccess) {
      throw new ForbiddenError('You do not have access to view this team');
    }

    let members: TeamMemberWithUser[] = [];
    let summary = { invited: 0, accepted: 0, declined: 0, removed: 0 };

    const listOptions = {
      featureId: input.sourceId,
      status: input.status,
      includeRemoved: true, // Include all for summary calculation
      limit: 1000,
    };

    switch (input.sourceType) {
      case CollaborationSourceType.PROJECT:
        const projectResult = await projectMemberRepository.findByProjectId(listOptions);
        members = projectResult.members;
        summary = await this.calculateSummary(projectResult.members);
        break;

      case CollaborationSourceType.OPPORTUNITY:
        const oppResult = await opportunityMemberRepository.findByOpportunityId(listOptions);
        members = oppResult.members;
        summary = await this.calculateSummary(oppResult.members);
        break;

      case CollaborationSourceType.PITCH:
        const pitchResult = await pitchMemberRepository.findByPitchId(listOptions);
        members = pitchResult.members;
        summary = await this.calculateSummary(pitchResult.members);
        break;

      case CollaborationSourceType.DEAL:
        const dealResult = await dealMemberRepository.findByDealId(listOptions);
        members = dealResult.members;
        summary = await this.calculateSummary(dealResult.members);
        break;

      default:
        throw new ValidationError(`Unknown source type: ${input.sourceType}`);
    }

    // Filter by status if specified (since we fetched all for summary)
    if (input.status) {
      members = members.filter(m => m.status === input.status);
    } else {
      // By default, exclude removed members from the list
      members = members.filter(m => m.status !== TeamMemberStatus.REMOVED);
    }

    logger.debug('Listed team members', {
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      count: members.length,
    });

    return {
      members,
      total: members.length,
      summary,
    };
  }

  /**
   * Calculate summary statistics from team members
   */
  private async calculateSummary(members: TeamMemberWithUser[]): Promise<{
    invited: number;
    accepted: number;
    declined: number;
    removed: number;
  }> {
    const summary = { invited: 0, accepted: 0, declined: 0, removed: 0 };

    for (const member of members) {
      switch (member.status) {
        case TeamMemberStatus.INVITED:
          summary.invited++;
          break;
        case TeamMemberStatus.ACCEPTED:
          summary.accepted++;
          break;
        case TeamMemberStatus.DECLINED:
          summary.declined++;
          break;
        case TeamMemberStatus.REMOVED:
          summary.removed++;
          break;
      }
    }

    return summary;
  }

  /**
   * Check if user has access to view the feature's team
   */
  private async checkAccess(
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
        if (project?.userId === userId) return true;
        // Also allow if user is a team member
        const projectMember = await this.prisma.projectMember.findFirst({
          where: {
            projectId: sourceId,
            userId: userId,
            status: TeamMemberStatus.ACCEPTED,
          },
        });
        return !!projectMember;

      case CollaborationSourceType.OPPORTUNITY:
        const opportunity = await this.prisma.opportunityIntent.findUnique({
          where: { id: sourceId },
          select: { userId: true },
        });
        if (opportunity?.userId === userId) return true;
        const oppMember = await this.prisma.opportunityMember.findFirst({
          where: {
            opportunityId: sourceId,
            userId: userId,
            status: TeamMemberStatus.ACCEPTED,
          },
        });
        return !!oppMember;

      case CollaborationSourceType.PITCH:
        const pitch = await this.prisma.pitch.findUnique({
          where: { id: sourceId },
          select: { userId: true },
        });
        if (pitch?.userId === userId) return true;
        const pitchMember = await this.prisma.pitchMember.findFirst({
          where: {
            pitchId: sourceId,
            userId: userId,
            status: TeamMemberStatus.ACCEPTED,
          },
        });
        return !!pitchMember;

      case CollaborationSourceType.DEAL:
        const deal = await this.prisma.dealRequest.findUnique({
          where: { id: sourceId },
          select: { userId: true },
        });
        if (deal?.userId === userId) return true;
        const dealMember = await this.prisma.dealMember.findFirst({
          where: {
            dealId: sourceId,
            userId: userId,
            status: TeamMemberStatus.ACCEPTED,
          },
        });
        return !!dealMember;

      default:
        return false;
    }
  }
}
