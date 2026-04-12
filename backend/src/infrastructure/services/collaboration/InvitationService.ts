/**
 * Collaboration Invitation Service
 *
 * Unified service for sending collaboration invitations via Email or WhatsApp.
 * Handles invitation creation, sending, and tracking.
 *
 * @module infrastructure/services/collaboration/InvitationService
 */

import { randomBytes } from 'crypto';
import { prisma } from '../../database/prisma/client';
import { emailService } from '../EmailService';
import { whatsAppService, CollaborationInvitationMessage } from '../WhatsAppService';
import { twilioSmsService } from '../../external/sms/TwilioSmsService';
import { logger } from '../../../shared/logger';
import {
  CollaborationSourceType,
  InvitationChannel,
  TeamMemberStatus,
  CollaborationInvitationEntity,
} from '../../../domain/entities/Collaboration';

// ============================================================================
// Types
// ============================================================================

export interface SendInvitationInput {
  collaborationRequestId: string;
  matchResultId?: string;
  recipientName: string;
  recipientEmail?: string;
  recipientPhone?: string;
  channel: InvitationChannel;
  message?: string;
}

export interface InvitationContext {
  sourceType: CollaborationSourceType;
  sourceTitle: string;
  sourceDescription: string | null;
  ownerName: string;
  ownerCompany: string | null;
  collaboratorName: string;
}

export interface SendInvitationResult {
  success: boolean;
  invitation?: CollaborationInvitationEntity;
  error?: string;
}

// ============================================================================
// Invitation Service Class
// ============================================================================

export class InvitationService {
  private frontendUrl: string;

  constructor() {
    this.frontendUrl = process.env.FRONTEND_URL || 'https://intellmatch.com';
  }

  /**
   * Generate a unique invitation token
   */
  private generateToken(): string {
    return randomBytes(32).toString('hex');
  }

  /**
   * Build invitation URL
   */
  private buildInvitationUrl(token: string): string {
    return `${this.frontendUrl}/invitation/${token}`;
  }

  /**
   * Send a collaboration invitation
   */
  async sendInvitation(
    input: SendInvitationInput,
    context: InvitationContext
  ): Promise<SendInvitationResult> {
    try {
      // Validate input
      if (input.channel === InvitationChannel.EMAIL && !input.recipientEmail) {
        return { success: false, error: 'Email address is required for email invitations' };
      }
      if (input.channel === InvitationChannel.WHATSAPP && !input.recipientPhone) {
        return { success: false, error: 'Phone number is required for WhatsApp invitations' };
      }

      // Generate token
      const token = this.generateToken();
      const invitationUrl = this.buildInvitationUrl(token);

      // Create invitation record
      const invitation = await prisma.collaborationInvitation.create({
        data: {
          collaborationRequestId: input.collaborationRequestId,
          matchResultId: input.matchResultId,
          recipientName: input.recipientName,
          recipientEmail: input.recipientEmail,
          recipientPhone: input.recipientPhone,
          channel: input.channel,
          token,
          message: input.message,
          status: TeamMemberStatus.INVITED,
        },
      });

      logger.info('Collaboration invitation created', {
        invitationId: invitation.id,
        channel: input.channel,
        recipientName: input.recipientName,
      });

      // Send via appropriate channel
      let sendResult: { success: boolean; error?: string };

      switch (input.channel) {
        case InvitationChannel.EMAIL:
          sendResult = await this.sendViaEmail(input, context, invitationUrl);
          break;
        case InvitationChannel.WHATSAPP:
          sendResult = await this.sendViaWhatsApp(input, context, invitationUrl);
          break;
        case InvitationChannel.SMS:
          sendResult = await this.sendViaSms(input, context, invitationUrl);
          break;
        case InvitationChannel.IN_APP:
          // In-app notifications don't need external sending
          sendResult = { success: true };
          break;
        default:
          sendResult = { success: false, error: 'Unknown invitation channel' };
      }

      // Update invitation with send status
      if (sendResult.success) {
        await prisma.collaborationInvitation.update({
          where: { id: invitation.id },
          data: { sentAt: new Date() },
        });
        logger.info('Collaboration invitation sent', {
          invitationId: invitation.id,
          channel: input.channel,
        });
      } else {
        logger.error('Failed to send collaboration invitation', {
          invitationId: invitation.id,
          channel: input.channel,
          error: sendResult.error,
        });
      }

      return {
        success: sendResult.success,
        invitation: this.mapToEntity(invitation),
        error: sendResult.error,
      };
    } catch (error: any) {
      logger.error('Error sending collaboration invitation', {
        error: error.message,
        input,
      });
      return { success: false, error: error.message };
    }
  }

  /**
   * Send invitation via Email
   */
  private async sendViaEmail(
    input: SendInvitationInput,
    context: InvitationContext,
    invitationUrl: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const success = await emailService.sendCollaborationInvitationEmail(input.recipientEmail!, {
        recipientName: input.recipientName,
        inviterName: context.collaboratorName,
        ownerName: context.ownerName,
        ownerCompany: context.ownerCompany || undefined,
        sourceType: context.sourceType,
        sourceTitle: context.sourceTitle,
        sourceDescription: context.sourceDescription || undefined,
        invitationUrl,
        customMessage: input.message,
      });

      return { success };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Send invitation via WhatsApp
   */
  private async sendViaWhatsApp(
    input: SendInvitationInput,
    context: InvitationContext,
    invitationUrl: string
  ): Promise<{ success: boolean; error?: string }> {
    const messageData: CollaborationInvitationMessage = {
      recipientPhone: input.recipientPhone!,
      recipientName: input.recipientName,
      inviterName: context.collaboratorName,
      ownerName: context.ownerName,
      projectTitle: context.sourceTitle,
      projectDescription: context.sourceDescription || undefined,
      invitationUrl,
      customMessage: input.message,
    };

    const result = await whatsAppService.sendCollaborationInvitation(messageData);
    return { success: result.success, error: result.error };
  }

  /**
   * Send invitation via SMS (Twilio)
   */
  private async sendViaSms(
    input: SendInvitationInput,
    context: InvitationContext,
    invitationUrl: string
  ): Promise<{ success: boolean; error?: string }> {
    if (!input.recipientPhone) {
      return { success: false, error: 'Phone number is required for SMS invitations' };
    }

    const result = await twilioSmsService.sendInvitation(
      input.recipientPhone,
      context.collaboratorName,
      context.sourceTitle,
      invitationUrl
    );

    return { success: result.success, error: result.error };
  }

  /**
   * Get invitation by token
   */
  async getInvitationByToken(token: string): Promise<CollaborationInvitationEntity | null> {
    const invitation = await prisma.collaborationInvitation.findUnique({
      where: { token },
    });
    return invitation ? this.mapToEntity(invitation) : null;
  }

  /**
   * Get invitation with full details by token
   */
  async getInvitationWithDetailsByToken(token: string): Promise<{
    invitation: CollaborationInvitationEntity;
    context: InvitationContext;
  } | null> {
    const invitation = await prisma.collaborationInvitation.findUnique({
      where: { token },
      include: {
        collaborationRequest: {
          include: {
            project: true,
            opportunity: true,
            pitch: true,
            deal: true,
            fromUser: {
              select: { id: true, fullName: true, company: true },
            },
            toUser: {
              select: { id: true, fullName: true },
            },
            toContact: {
              select: { id: true, fullName: true },
            },
          },
        },
      },
    });

    if (!invitation) return null;

    const request = invitation.collaborationRequest;
    let sourceTitle = 'Untitled';
    let sourceDescription: string | null = null;

    switch (request.sourceType) {
      case 'PROJECT':
        sourceTitle = request.project?.title || sourceTitle;
        sourceDescription = request.project?.summary || null;
        break;
      case 'OPPORTUNITY':
        sourceTitle = request.opportunity?.title || sourceTitle;
        sourceDescription = request.opportunity?.notes || null;
        break;
      case 'PITCH':
        sourceTitle = request.pitch?.title || request.pitch?.fileName || sourceTitle;
        sourceDescription = request.pitch?.companyName || null;
        break;
      case 'DEAL':
        sourceTitle = request.deal?.title || sourceTitle;
        sourceDescription = request.deal?.problemStatement || request.deal?.targetDescription || null;
        break;
    }

    // Collaborator is whoever the request was sent to
    const collaboratorName = request.toUser?.fullName || request.toContact?.fullName || 'Someone';

    return {
      invitation: this.mapToEntity(invitation),
      context: {
        sourceType: request.sourceType as CollaborationSourceType,
        sourceTitle,
        sourceDescription,
        ownerName: request.fromUser.fullName,
        ownerCompany: request.fromUser.company,
        collaboratorName,
      },
    };
  }

  /**
   * Mark invitation as opened
   */
  async markAsOpened(token: string): Promise<void> {
    await prisma.collaborationInvitation.update({
      where: { token },
      data: { openedAt: new Date() },
    });
  }

  /**
   * Accept invitation
   */
  async acceptInvitation(
    token: string,
    acceptedByUserId?: string
  ): Promise<{ success: boolean; teamMemberId?: string; error?: string }> {
    const invitation = await prisma.collaborationInvitation.findUnique({
      where: { token },
      include: {
        collaborationRequest: true,
      },
    });

    if (!invitation) {
      return { success: false, error: 'Invitation not found' };
    }

    if (invitation.status !== TeamMemberStatus.INVITED) {
      return { success: false, error: 'Invitation has already been responded to' };
    }

    // Create team member based on source type
    const request = invitation.collaborationRequest;
    let teamMemberId: string | undefined;

    const memberData = {
      userId: acceptedByUserId,
      externalName: acceptedByUserId ? undefined : invitation.recipientName,
      externalEmail: acceptedByUserId ? undefined : invitation.recipientEmail,
      externalPhone: acceptedByUserId ? undefined : invitation.recipientPhone,
      status: TeamMemberStatus.ACCEPTED,
      joinedAt: new Date(),
    };

    switch (request.sourceType) {
      case 'PROJECT':
        const projectMember = await prisma.projectMember.create({
          data: {
            projectId: request.projectId!,
            ...memberData,
          },
        });
        teamMemberId = projectMember.id;
        break;
      case 'OPPORTUNITY':
        const oppMember = await prisma.opportunityMember.create({
          data: {
            opportunityId: request.opportunityId!,
            ...memberData,
          },
        });
        teamMemberId = oppMember.id;
        break;
      case 'PITCH':
        const pitchMember = await prisma.pitchMember.create({
          data: {
            pitchId: request.pitchId!,
            ...memberData,
          },
        });
        teamMemberId = pitchMember.id;
        break;
      case 'DEAL':
        const dealMember = await prisma.dealMember.create({
          data: {
            dealId: request.dealId!,
            ...memberData,
          },
        });
        teamMemberId = dealMember.id;
        break;
    }

    // Update invitation
    await prisma.collaborationInvitation.update({
      where: { token },
      data: {
        status: TeamMemberStatus.ACCEPTED,
        respondedAt: new Date(),
        teamMemberId,
      },
    });

    logger.info('Collaboration invitation accepted', {
      invitationId: invitation.id,
      teamMemberId,
      acceptedByUserId,
    });

    return { success: true, teamMemberId };
  }

  /**
   * Decline invitation
   */
  async declineInvitation(
    token: string,
    reason?: string
  ): Promise<{ success: boolean; error?: string }> {
    const invitation = await prisma.collaborationInvitation.findUnique({
      where: { token },
    });

    if (!invitation) {
      return { success: false, error: 'Invitation not found' };
    }

    if (invitation.status !== TeamMemberStatus.INVITED) {
      return { success: false, error: 'Invitation has already been responded to' };
    }

    await prisma.collaborationInvitation.update({
      where: { token },
      data: {
        status: TeamMemberStatus.DECLINED,
        respondedAt: new Date(),
        declineReason: reason,
      },
    });

    logger.info('Collaboration invitation declined', {
      invitationId: invitation.id,
      reason,
    });

    return { success: true };
  }

  /**
   * Map Prisma model to entity
   */
  private mapToEntity(invitation: any): CollaborationInvitationEntity {
    return {
      id: invitation.id,
      collaborationRequestId: invitation.collaborationRequestId,
      matchResultId: invitation.matchResultId,
      recipientName: invitation.recipientName,
      recipientEmail: invitation.recipientEmail,
      recipientPhone: invitation.recipientPhone,
      channel: invitation.channel as InvitationChannel,
      token: invitation.token,
      message: invitation.message,
      sentAt: invitation.sentAt,
      deliveredAt: invitation.deliveredAt,
      openedAt: invitation.openedAt,
      respondedAt: invitation.respondedAt,
      status: invitation.status as TeamMemberStatus,
      declineReason: invitation.declineReason,
      teamMemberId: invitation.teamMemberId,
      createdAt: invitation.createdAt,
      updatedAt: invitation.updatedAt,
    };
  }
}

// Export singleton instance
export const invitationService = new InvitationService();
