/**
 * Invite Contact Service
 *
 * Handles creating pre-accounts and sending invitations to contacts.
 *
 * @module application/use-cases/invitation/InviteContactService
 */

import { PrismaClient, UserStatus } from '@prisma/client';
import { randomBytes } from 'crypto';
import { emailService } from '../../../infrastructure/services/EmailService';
import { twilioSmsService } from '../../../infrastructure/external/sms/TwilioSmsService';
import { logger } from '../../../shared/logger';

const prisma = new PrismaClient();

export interface InviteContactInput {
  contactId: string;
  method: 'email' | 'sms';
  message?: string;
}

export interface InviteContactResult {
  success: boolean;
  preAccountId?: string;
  invitationSent: boolean;
  method: 'email' | 'sms';
  error?: string;
}

export interface AcceptInvitationInput {
  token: string;
  password: string;
}

export interface AcceptInvitationResult {
  success: boolean;
  userId?: string;
  connectedWithId?: string;
  error?: string;
}

/**
 * Service for managing contact invitations and pre-accounts
 */
export class InviteContactService {
  private frontendUrl: string;

  constructor() {
    this.frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  }

  /**
   * Generate a secure invitation token
   */
  private generateInvitationToken(): string {
    return randomBytes(32).toString('hex');
  }

  /**
   * Invite a contact to join the platform
   */
  async inviteContact(
    input: InviteContactInput,
    inviterId: string
  ): Promise<InviteContactResult> {
    try {
      // Get the contact details
      const contact = await prisma.contact.findUnique({
        where: { id: input.contactId },
        include: {
          owner: {
            select: { id: true, fullName: true },
          },
        },
      });

      if (!contact) {
        return {
          success: false,
          invitationSent: false,
          method: input.method,
          error: 'Contact not found',
        };
      }

      // Check if contact belongs to the inviter
      if (contact.ownerId !== inviterId) {
        return {
          success: false,
          invitationSent: false,
          method: input.method,
          error: 'Unauthorized to invite this contact',
        };
      }

      // Check if contact has required info for the chosen method
      if (input.method === 'email' && !contact.email) {
        return {
          success: false,
          invitationSent: false,
          method: input.method,
          error: 'Contact does not have an email address',
        };
      }

      if (input.method === 'sms' && !contact.phone) {
        return {
          success: false,
          invitationSent: false,
          method: input.method,
          error: 'Contact does not have a phone number',
        };
      }

      // Check if a user already exists with this email
      if (contact.email) {
        const existingUser = await prisma.user.findUnique({
          where: { email: contact.email },
        });

        if (existingUser && existingUser.status === 'ACTIVE') {
          return {
            success: false,
            invitationSent: false,
            method: input.method,
            error: 'A user with this email already exists',
          };
        }

        // If there's a pending invitation user, resend the invitation
        if (existingUser && existingUser.status === 'PENDING_INVITATION') {
          // Update invitation token
          const newToken = this.generateInvitationToken();
          await prisma.user.update({
            where: { id: existingUser.id },
            data: {
              invitationToken: newToken,
              invitedAt: new Date(),
            },
          });

          // Send the invitation
          const invitationSent = await this.sendInvitation(
            input.method,
            contact.email,
            contact.phone,
            {
              inviterName: contact.owner.fullName,
              inviteeName: contact.fullName,
              token: newToken,
              message: input.message,
            }
          );

          return {
            success: true,
            preAccountId: existingUser.id,
            invitationSent,
            method: input.method,
          };
        }
      }

      // Create a pre-account (user with pending_invitation status)
      const invitationToken = this.generateInvitationToken();

      // Generate a temporary password hash (will be replaced on activation)
      const tempPasswordHash = randomBytes(32).toString('hex');

      const preAccount = await prisma.user.create({
        data: {
          email: contact.email || `pending_${Date.now()}@temp.local`,
          passwordHash: tempPasswordHash,
          fullName: contact.fullName,
          jobTitle: contact.jobTitle,
          company: contact.company,
          phone: contact.phone,
          linkedinUrl: contact.linkedinUrl,
          websiteUrl: contact.website,
          location: contact.location,
          status: UserStatus.PENDING_INVITATION,
          invitedById: inviterId,
          invitationToken,
          invitedAt: new Date(),
          emailVerified: false,
          isActive: false,
        },
      });

      logger.info('Pre-account created for contact invitation', {
        preAccountId: preAccount.id,
        contactId: contact.id,
        inviterId,
        method: input.method,
      });

      // Send the invitation
      const invitationSent = await this.sendInvitation(
        input.method,
        contact.email,
        contact.phone,
        {
          inviterName: contact.owner.fullName,
          inviteeName: contact.fullName,
          token: invitationToken,
          message: input.message,
        }
      );

      // Update status to INVITED if sent successfully
      if (invitationSent) {
        await prisma.user.update({
          where: { id: preAccount.id },
          data: { status: UserStatus.INVITED },
        });
      }

      return {
        success: true,
        preAccountId: preAccount.id,
        invitationSent,
        method: input.method,
      };
    } catch (error) {
      logger.error('Failed to invite contact', { error, input, inviterId });
      return {
        success: false,
        invitationSent: false,
        method: input.method,
        error: 'Failed to send invitation',
      };
    }
  }

  /**
   * Send invitation via email or SMS
   */
  private async sendInvitation(
    method: 'email' | 'sms',
    email: string | null,
    phone: string | null,
    data: {
      inviterName: string;
      inviteeName: string;
      token: string;
      message?: string;
    }
  ): Promise<boolean> {
    const inviteUrl = `${this.frontendUrl}/invite/${data.token}`;

    if (method === 'email' && email) {
      return emailService.sendInvitationEmail(email, {
        inviterName: data.inviterName,
        inviteeName: data.inviteeName,
        inviteUrl,
        message: data.message,
      });
    }

    if (method === 'sms' && phone) {
      const smsBody =
        `${data.inviterName} has invited you to join IntellMatch! ` +
        `Sign up here: ${inviteUrl}`;
      const result = await twilioSmsService.sendSms(phone, smsBody);
      return result.success;
    }

    return false;
  }

  /**
   * Verify an invitation token
   */
  async verifyInvitationToken(token: string): Promise<{
    valid: boolean;
    preAccount?: {
      id: string;
      fullName: string;
      email: string;
      company?: string;
      jobTitle?: string;
      inviterName?: string;
    };
  }> {
    try {
      const preAccount = await prisma.user.findUnique({
        where: { invitationToken: token },
        include: {
          invitedBy: {
            select: { fullName: true },
          },
        },
      });

      if (!preAccount) {
        return { valid: false };
      }

      if (preAccount.status === 'ACTIVE') {
        return { valid: false };
      }

      return {
        valid: true,
        preAccount: {
          id: preAccount.id,
          fullName: preAccount.fullName,
          email: preAccount.email,
          company: preAccount.company || undefined,
          jobTitle: preAccount.jobTitle || undefined,
          inviterName: preAccount.invitedBy?.fullName,
        },
      };
    } catch (error) {
      logger.error('Failed to verify invitation token', { error, token });
      return { valid: false };
    }
  }

  /**
   * Accept an invitation and activate the account
   */
  async acceptInvitation(
    input: AcceptInvitationInput
  ): Promise<AcceptInvitationResult> {
    try {
      // Find the pre-account by token
      const preAccount = await prisma.user.findUnique({
        where: { invitationToken: input.token },
      });

      if (!preAccount) {
        return {
          success: false,
          error: 'Invalid invitation token',
        };
      }

      if (preAccount.status === 'ACTIVE') {
        return {
          success: false,
          error: 'This invitation has already been used',
        };
      }

      // Hash the new password
      const bcrypt = await import('bcryptjs');
      const passwordHash = await bcrypt.hash(input.password, 12);

      // Activate the account
      const activatedUser = await prisma.user.update({
        where: { id: preAccount.id },
        data: {
          passwordHash,
          status: UserStatus.ACTIVE,
          emailVerified: true,
          isActive: true,
          invitationToken: null, // Clear the token
        },
      });

      // If there's an inviter, create a connection between them
      if (preAccount.invitedById) {
        // Check if contact already exists
        const existingContact = await prisma.contact.findFirst({
          where: {
            ownerId: preAccount.invitedById,
            email: activatedUser.email,
          },
        });

        if (existingContact) {
          // Update the contact to link to the new user (if we had a linkedUserId field)
          // For now, just log the connection
          logger.info('Activated user from contact invitation', {
            activatedUserId: activatedUser.id,
            inviterId: preAccount.invitedById,
            contactId: existingContact.id,
          });
        }

        // Create mutual contacts/connections
        // The inviter should have the new user as a contact connection
        // This could be expanded to use a proper Connection model
      }

      logger.info('Invitation accepted and account activated', {
        userId: activatedUser.id,
        inviterId: preAccount.invitedById,
      });

      return {
        success: true,
        userId: activatedUser.id,
        connectedWithId: preAccount.invitedById || undefined,
      };
    } catch (error) {
      logger.error('Failed to accept invitation', { error });
      return {
        success: false,
        error: 'Failed to activate account',
      };
    }
  }

  /**
   * Get pending invitations sent by a user
   */
  async getPendingInvitations(userId: string) {
    return prisma.user.findMany({
      where: {
        invitedById: userId,
        status: {
          in: [UserStatus.PENDING_INVITATION, UserStatus.INVITED],
        },
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        company: true,
        jobTitle: true,
        status: true,
        invitedAt: true,
      },
      orderBy: {
        invitedAt: 'desc',
      },
    });
  }

  /**
   * Cancel a pending invitation
   */
  async cancelInvitation(invitationId: string, userId: string): Promise<boolean> {
    try {
      const invitation = await prisma.user.findUnique({
        where: { id: invitationId },
      });

      if (!invitation || invitation.invitedById !== userId) {
        return false;
      }

      if (invitation.status === 'ACTIVE') {
        return false; // Can't cancel an accepted invitation
      }

      // Delete the pre-account
      await prisma.user.delete({
        where: { id: invitationId },
      });

      logger.info('Invitation cancelled', { invitationId, userId });
      return true;
    } catch (error) {
      logger.error('Failed to cancel invitation', { error, invitationId, userId });
      return false;
    }
  }
}

export const inviteContactService = new InviteContactService();
