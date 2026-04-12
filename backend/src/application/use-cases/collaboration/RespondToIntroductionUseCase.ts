/**
 * Use Case: Respond to Introduction
 * Handles public token-based responses (accept/decline) from the introduced contact.
 */

import {
  ICollaborationRequestRepository,
  IIntroductionRepository,
  ICollaborationLedgerRepository,
} from '../../../domain/repositories/ICollaborationRepository';
import {
  IntroductionStatus,
  PublicIntroductionView,
  CollaborationSourceType,
  TeamMemberStatus,
  getSourceId,
} from '../../../domain/entities/Collaboration';
import { NotFoundError, ValidationError } from '../../../shared/errors/index.js';
import { logger } from '../../../shared/logger';
import { prisma } from '../../../infrastructure/database/prisma/client.js';

export class RespondToIntroductionUseCase {
  constructor(
    private readonly introductionRepository: IIntroductionRepository,
    private readonly requestRepository: ICollaborationRequestRepository,
    private readonly ledgerRepository: ICollaborationLedgerRepository
  ) {}

  /**
   * Get introduction details by token (for public page)
   */
  async getByToken(token: string): Promise<PublicIntroductionView> {
    const introduction = await this.introductionRepository.findByToken(token);
    if (!introduction) {
      throw new NotFoundError('Introduction not found');
    }

    // Get the collaboration request
    const request = await this.requestRepository.findById(introduction.collaborationRequestId);
    if (!request) {
      throw new NotFoundError('Collaboration request not found');
    }

    // Get source feature details
    const sourceId = getSourceId(request);
    const sourceFeature = await this.getSourceFeature(request.sourceType, sourceId);

    // Get owner (User A) info
    const ownerUser = await prisma.user.findUnique({
      where: { id: request.fromUserId },
      select: { fullName: true, company: true },
    });

    // Get collaborator (User B) info
    const collaboratorUser = await prisma.user.findUnique({
      where: { id: introduction.collaboratorUserId },
      select: { fullName: true },
    });

    return {
      token: introduction.token!,
      contactName: introduction.contactName || 'Contact',
      status: introduction.status,
      sourceType: request.sourceType,
      sourceTitle: sourceFeature?.title || 'Collaboration',
      sourceDescription: sourceFeature?.description || null,
      ownerName: ownerUser?.fullName || 'Unknown',
      ownerCompany: ownerUser?.company || null,
      collaboratorName: collaboratorUser?.fullName || 'Unknown',
      message: introduction.message,
      sentAt: introduction.sentAt,
    };
  }

  /**
   * Accept an introduction (contact agrees to be introduced)
   */
  async accept(token: string): Promise<{ success: boolean }> {
    const introduction = await this.introductionRepository.findByToken(token);
    if (!introduction) {
      throw new NotFoundError('Introduction not found');
    }

    if (introduction.status !== IntroductionStatus.SENT) {
      throw new ValidationError(`Introduction has already been ${introduction.status.toLowerCase()}`);
    }

    logger.info('Accepting introduction', { introductionId: introduction.id, token });

    // Update status to ACCEPTED
    await this.introductionRepository.update(introduction.id, {
      status: IntroductionStatus.ACCEPTED,
      respondedAt: new Date(),
    });

    // Increment ledger and create team member
    const request = await this.requestRepository.findById(introduction.collaborationRequestId);
    if (request) {
      const sourceId = getSourceId(request);
      await this.ledgerRepository.incrementIntroductionsCount(
        request.fromUserId,
        request.toUserId,
        request.sourceType,
        sourceId
      );

      // Create team member so the introduced contact appears in the project/deal team
      // Use upsert to handle cases where the same email already exists on the team
      const contactEmail = introduction.contactEmail || undefined;
      const contactName = introduction.contactName || undefined;
      const contactPhone = introduction.contactPhone || undefined;
      const memberUpdateData = {
        externalName: contactName,
        externalPhone: contactPhone,
        status: TeamMemberStatus.ACCEPTED,
        joinedAt: new Date(),
      };

      try {
        switch (request.sourceType) {
          case CollaborationSourceType.PROJECT:
            if (contactEmail) {
              await prisma.projectMember.upsert({
                where: { projectId_externalEmail: { projectId: request.projectId!, externalEmail: contactEmail } },
                update: memberUpdateData,
                create: { projectId: request.projectId!, externalEmail: contactEmail, ...memberUpdateData },
              });
            } else {
              await prisma.projectMember.create({
                data: { projectId: request.projectId!, externalName: contactName, externalPhone: contactPhone, status: TeamMemberStatus.ACCEPTED, joinedAt: new Date() },
              });
            }
            break;
          case CollaborationSourceType.OPPORTUNITY:
            if (contactEmail) {
              await prisma.opportunityMember.upsert({
                where: { opportunityId_externalEmail: { opportunityId: request.opportunityId!, externalEmail: contactEmail } },
                update: memberUpdateData,
                create: { opportunityId: request.opportunityId!, externalEmail: contactEmail, ...memberUpdateData },
              });
            } else {
              await prisma.opportunityMember.create({
                data: { opportunityId: request.opportunityId!, externalName: contactName, externalPhone: contactPhone, status: TeamMemberStatus.ACCEPTED, joinedAt: new Date() },
              });
            }
            break;
          case CollaborationSourceType.PITCH:
            if (contactEmail) {
              await prisma.pitchMember.upsert({
                where: { pitchId_externalEmail: { pitchId: request.pitchId!, externalEmail: contactEmail } },
                update: memberUpdateData,
                create: { pitchId: request.pitchId!, externalEmail: contactEmail, ...memberUpdateData },
              });
            } else {
              await prisma.pitchMember.create({
                data: { pitchId: request.pitchId!, externalName: contactName, externalPhone: contactPhone, status: TeamMemberStatus.ACCEPTED, joinedAt: new Date() },
              });
            }
            break;
          case CollaborationSourceType.DEAL:
            if (contactEmail) {
              await prisma.dealMember.upsert({
                where: { dealId_externalEmail: { dealId: request.dealId!, externalEmail: contactEmail } },
                update: memberUpdateData,
                create: { dealId: request.dealId!, externalEmail: contactEmail, ...memberUpdateData },
              });
            } else {
              await prisma.dealMember.create({
                data: { dealId: request.dealId!, externalName: contactName, externalPhone: contactPhone, status: TeamMemberStatus.ACCEPTED, joinedAt: new Date() },
              });
            }
            break;
        }
        logger.info('Team member created from introduction acceptance', {
          introductionId: introduction.id,
          sourceType: request.sourceType,
          sourceId,
        });
      } catch (err) {
        logger.error('Failed to create team member from introduction', { err, introductionId: introduction.id });
      }
    }

    logger.info('Introduction accepted', { introductionId: introduction.id });

    return { success: true };
  }

  /**
   * Decline an introduction (contact declines to be introduced)
   */
  async decline(token: string, reason?: string): Promise<{ success: boolean }> {
    const introduction = await this.introductionRepository.findByToken(token);
    if (!introduction) {
      throw new NotFoundError('Introduction not found');
    }

    if (introduction.status !== IntroductionStatus.SENT) {
      throw new ValidationError(`Introduction has already been ${introduction.status.toLowerCase()}`);
    }

    logger.info('Declining introduction', { introductionId: introduction.id, token });

    // Update status to DECLINED
    await this.introductionRepository.update(introduction.id, {
      status: IntroductionStatus.DECLINED,
      respondedAt: new Date(),
    });

    logger.info('Introduction declined', { introductionId: introduction.id });

    return { success: true };
  }

  private async getSourceFeature(
    sourceType: CollaborationSourceType,
    sourceId: string
  ): Promise<{ title: string; description: string | null } | null> {
    switch (sourceType) {
      case CollaborationSourceType.PROJECT: {
        const project = await prisma.project.findUnique({
          where: { id: sourceId },
          select: { title: true, summary: true },
        });
        return project ? { title: project.title, description: project.summary } : null;
      }
      case CollaborationSourceType.OPPORTUNITY: {
        const opp = await prisma.opportunityIntent.findUnique({
          where: { id: sourceId },
          select: { title: true, notes: true },
        });
        return opp ? { title: opp.title, description: opp.notes } : null;
      }
      case CollaborationSourceType.PITCH: {
        const pitch = await prisma.pitch.findUnique({
          where: { id: sourceId },
          select: { title: true },
        });
        return pitch ? { title: pitch.title, description: null } : null;
      }
      case CollaborationSourceType.DEAL: {
        const deal = await prisma.dealRequest.findUnique({
          where: { id: sourceId },
          select: { title: true, problemStatement: true },
        });
        return deal ? { title: deal.title || 'Deal', description: deal.problemStatement } : null;
      }
      default:
        return null;
    }
  }
}
