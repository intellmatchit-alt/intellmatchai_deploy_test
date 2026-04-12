/**
 * Use Case: Accept Collaboration Invitation
 * Handles third party accepting an invitation via token
 * Creates a team member record upon acceptance
 */

import {
  CollaborationInvitationEntity,
  TeamMemberStatus,
  CollaborationSourceType,
  PublicInvitationView,
} from '../../../domain/entities/Collaboration';
import { invitationService } from '../../../infrastructure/services/collaboration/InvitationService';
import {
  NotFoundError,
  ValidationError,
  ForbiddenError,
} from '../../../shared/errors/index.js';
import { logger } from '../../../shared/logger';

export interface GetInvitationByTokenInput {
  token: string;
}

export interface GetInvitationByTokenOutput {
  invitation: PublicInvitationView;
}

export interface AcceptInvitationInput {
  token: string;
  acceptedByUserId?: string; // Optional - if accepter has a registered account
}

export interface AcceptInvitationOutput {
  success: boolean;
  teamMemberId?: string;
  redirectUrl?: string;
  error?: string;
}

export interface DeclineInvitationInput {
  token: string;
  reason?: string;
}

export interface DeclineInvitationOutput {
  success: boolean;
  error?: string;
}

export class AcceptInvitationUseCase {
  /**
   * Get invitation details by token (public - no auth required)
   */
  async getInvitation(input: GetInvitationByTokenInput): Promise<GetInvitationByTokenOutput> {
    const result = await invitationService.getInvitationWithDetailsByToken(input.token);
    if (!result) {
      throw new NotFoundError('Invitation not found or has expired');
    }

    const { invitation, context } = result;

    // Mark as opened (tracking)
    await invitationService.markAsOpened(input.token);

    // Build public view (limited info for display)
    const publicView: PublicInvitationView = {
      token: invitation.token,
      recipientName: invitation.recipientName,
      channel: invitation.channel,
      status: invitation.status,
      sourceType: context.sourceType,
      sourceTitle: context.sourceTitle,
      sourceDescription: context.sourceDescription,
      inviterName: context.collaboratorName,
      inviterCompany: null, // Not needed for public view
      ownerName: context.ownerName,
      ownerCompany: context.ownerCompany,
      invitedAt: invitation.createdAt,
    };

    return { invitation: publicView };
  }

  /**
   * Accept an invitation (public - no auth required for basic acceptance)
   */
  async accept(input: AcceptInvitationInput): Promise<AcceptInvitationOutput> {
    // Verify invitation exists and is valid
    const invitation = await invitationService.getInvitationByToken(input.token);
    if (!invitation) {
      throw new NotFoundError('Invitation not found or has expired');
    }

    // Check if already responded
    if (invitation.status !== TeamMemberStatus.INVITED) {
      if (invitation.status === TeamMemberStatus.ACCEPTED) {
        return {
          success: true,
          teamMemberId: invitation.teamMemberId || undefined,
          redirectUrl: '/dashboard',
          error: 'Invitation was already accepted',
        };
      }
      throw new ValidationError(`This invitation has already been ${invitation.status.toLowerCase()}`);
    }

    logger.info('Accepting collaboration invitation', {
      token: input.token,
      acceptedByUserId: input.acceptedByUserId,
    });

    // Accept via InvitationService (creates team member)
    const result = await invitationService.acceptInvitation(input.token, input.acceptedByUserId);

    if (!result.success) {
      return {
        success: false,
        error: result.error || 'Failed to accept invitation',
      };
    }

    logger.info('Collaboration invitation accepted', {
      token: input.token,
      teamMemberId: result.teamMemberId,
    });

    return {
      success: true,
      teamMemberId: result.teamMemberId,
      // Redirect to registration if not logged in, otherwise to the feature page
      redirectUrl: input.acceptedByUserId ? '/dashboard' : '/register',
    };
  }

  /**
   * Decline an invitation (public - no auth required)
   */
  async decline(input: DeclineInvitationInput): Promise<DeclineInvitationOutput> {
    // Verify invitation exists
    const invitation = await invitationService.getInvitationByToken(input.token);
    if (!invitation) {
      throw new NotFoundError('Invitation not found or has expired');
    }

    // Check if already responded
    if (invitation.status !== TeamMemberStatus.INVITED) {
      throw new ValidationError(`This invitation has already been ${invitation.status.toLowerCase()}`);
    }

    logger.info('Declining collaboration invitation', {
      token: input.token,
      reason: input.reason,
    });

    // Decline via InvitationService
    const result = await invitationService.declineInvitation(input.token, input.reason);

    if (!result.success) {
      return {
        success: false,
        error: result.error || 'Failed to decline invitation',
      };
    }

    logger.info('Collaboration invitation declined', {
      token: input.token,
    });

    return { success: true };
  }
}

// Export singleton instance
export const acceptInvitationUseCase = new AcceptInvitationUseCase();
