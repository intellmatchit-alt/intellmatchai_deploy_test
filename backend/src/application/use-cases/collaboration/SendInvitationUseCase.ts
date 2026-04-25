/**
 * Use Case: Send Collaboration Invitation
 * Sends an invitation via WhatsApp or Email to a matched contact
 * This is used by the collaborator to invite third parties to join the team
 */

import { PrismaClient } from '@prisma/client';
import {
  ICollaborationRequestRepository,
  ICollaborationMatchResultRepository,
} from '../../../domain/repositories/ICollaborationRepository';
import {
  CollaborationSourceType,
  CollaborationRequestStatus,
  InvitationChannel,
  CollaborationMatchReason,
} from '../../../domain/entities/Collaboration';
import {
  invitationService,
  SendInvitationInput,
  InvitationContext,
  SendInvitationResult,
} from '../../../infrastructure/services/collaboration/InvitationService';
import {
  NotFoundError,
  ForbiddenError,
  ValidationError,
} from '../../../shared/errors/index';
import { logger } from '../../../shared/logger';

export interface SendCollaborationInvitationInput {
  collaborationRequestId: string;
  matchResultId?: string;
  recipientName: string;
  recipientEmail?: string;
  recipientPhone?: string;
  channel: InvitationChannel;
  message?: string;
}

export interface SendCollaborationInvitationOutput {
  success: boolean;
  invitationId?: string;
  invitationUrl?: string;
  error?: string;
}

export class SendInvitationUseCase {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly requestRepository: ICollaborationRequestRepository,
    private readonly matchResultRepository: ICollaborationMatchResultRepository
  ) {}

  async execute(
    userId: string,
    input: SendCollaborationInvitationInput
  ): Promise<SendCollaborationInvitationOutput> {
    // Validate required fields based on channel
    if (input.channel === InvitationChannel.EMAIL && !input.recipientEmail) {
      throw new ValidationError('Email address is required for email invitations');
    }
    if (input.channel === InvitationChannel.WHATSAPP && !input.recipientPhone) {
      throw new ValidationError('Phone number is required for WhatsApp invitations');
    }
    if (input.channel === InvitationChannel.SMS && !input.recipientPhone) {
      throw new ValidationError('Phone number is required for SMS invitations');
    }

    // Get collaboration request
    const request = await this.requestRepository.findByIdWithDetails(input.collaborationRequestId);
    if (!request) {
      throw new NotFoundError('Collaboration request not found');
    }

    // Check authorization - only the collaborator (toUser or toContact's linked user) can send invitations
    const isCollaborator = await this.isCollaboratorUser(request, userId);
    if (!isCollaborator) {
      throw new ForbiddenError('Only the collaborator can send invitations');
    }

    // Verify request is in accepted status (collaborator has agreed to help)
    if (request.status !== CollaborationRequestStatus.ACCEPTED) {
      throw new ValidationError('Collaboration request must be accepted before sending invitations');
    }

    // If matchResultId provided, verify it belongs to this request's session
    if (input.matchResultId) {
      const matchResult = await this.matchResultRepository.findByIdWithContact(input.matchResultId);
      if (!matchResult) {
        throw new NotFoundError('Match result not found');
      }

      // Verify the match result belongs to a session of this request
      const session = await this.prisma.collaborationSession.findFirst({
        where: {
          collaborationRequestId: input.collaborationRequestId,
          id: matchResult.sessionId,
        },
      });
      if (!session) {
        throw new ForbiddenError('Match result does not belong to this collaboration request');
      }
    }

    // Build invitation context
    const context = await this.buildInvitationContext(request);

    logger.info('Sending collaboration invitation', {
      collaborationRequestId: input.collaborationRequestId,
      matchResultId: input.matchResultId,
      channel: input.channel,
      recipientName: input.recipientName,
    });

    // Send invitation via InvitationService
    const sendInput: SendInvitationInput = {
      collaborationRequestId: input.collaborationRequestId,
      matchResultId: input.matchResultId,
      recipientName: input.recipientName,
      recipientEmail: input.recipientEmail,
      recipientPhone: input.recipientPhone,
      channel: input.channel,
      message: input.message,
    };

    const result = await invitationService.sendInvitation(sendInput, context);

    if (result.success) {
      // Mark match result as introduced if applicable
      if (input.matchResultId) {
        await this.matchResultRepository.update(input.matchResultId, {
          isIntroduced: true,
        });
      }

      logger.info('Collaboration invitation sent successfully', {
        invitationId: result.invitation?.id,
        channel: input.channel,
      });
    }

    return {
      success: result.success,
      invitationId: result.invitation?.id,
      invitationUrl: result.invitation ? invitationService['buildInvitationUrl'](result.invitation.token) : undefined,
      error: result.error,
    };
  }

  /**
   * Check if the given user is the collaborator for this request
   */
  private async isCollaboratorUser(
    request: { toUserId: string | null; toContactId: string | null },
    userId: string
  ): Promise<boolean> {
    // If sent to a user directly, check if userId matches
    if (request.toUserId === userId) {
      return true;
    }

    // If sent to a contact, check if the user's email matches the contact's email
    // (contact would have registered with their email)
    if (request.toContactId) {
      const [contact, user] = await Promise.all([
        this.prisma.contact.findUnique({
          where: { id: request.toContactId },
          select: { email: true },
        }),
        this.prisma.user.findUnique({
          where: { id: userId },
          select: { email: true },
        }),
      ]);
      if (contact?.email && user?.email && contact.email.toLowerCase() === user.email.toLowerCase()) {
        return true;
      }
    }

    return false;
  }

  /**
   * Build context for invitation
   */
  private async buildInvitationContext(
    request: {
      sourceType: string;
      sourceFeature: {
        title: string;
        description: string | null;
      };
      fromUser: { id: string; fullName: string };
      toUserId: string | null;
      toContactId: string | null;
    }
  ): Promise<InvitationContext> {
    // Get owner info
    const owner = await this.prisma.user.findUnique({
      where: { id: request.fromUser.id },
      select: { fullName: true, company: true },
    });

    // Get collaborator name
    let collaboratorName = 'Someone';
    if (request.toUserId) {
      const collaborator = await this.prisma.user.findUnique({
        where: { id: request.toUserId },
        select: { fullName: true },
      });
      collaboratorName = collaborator?.fullName || 'Someone';
    } else if (request.toContactId) {
      const contact = await this.prisma.contact.findUnique({
        where: { id: request.toContactId },
        select: { fullName: true },
      });
      collaboratorName = contact?.fullName || 'Someone';
    }

    return {
      sourceType: request.sourceType as CollaborationSourceType,
      sourceTitle: request.sourceFeature.title,
      sourceDescription: request.sourceFeature.description,
      ownerName: owner?.fullName || request.fromUser.fullName,
      ownerCompany: owner?.company || null,
      collaboratorName,
    };
  }
}
