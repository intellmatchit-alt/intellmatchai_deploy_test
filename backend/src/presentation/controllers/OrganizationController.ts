/**
 * Organization Controller
 *
 * Handles HTTP requests for organization/team management.
 */

import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../infrastructure/database/prisma/client.js';
import { logger } from '../../shared/logger/index.js';
import {
  AuthenticationError,
  NotFoundError,
  ForbiddenError,
  ValidationError,
  ConflictError,
} from '../../shared/errors/index.js';
import crypto from 'crypto';
import { EmailService } from '../../infrastructure/services/EmailService.js';

export class OrganizationController {
  /**
   * Create a new organization
   * POST /api/v1/organizations
   */
  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new AuthenticationError('Authentication required');

      const { name, website, industry, size } = req.body;

      // Check user has TEAM subscription
      const subscription = await prisma.subscription.findUnique({
        where: { userId: req.user.userId },
      });

      if (!subscription || subscription.plan !== 'TEAM' || subscription.status !== 'ACTIVE') {
        throw new ForbiddenError('A TEAM plan subscription is required to create an organization');
      }

      // Check no existing org for this subscription
      const existingOrg = await prisma.organization.findUnique({
        where: { subscriptionId: subscription.id },
      });

      if (existingOrg) {
        throw new ConflictError('An organization already exists for this subscription');
      }

      // Generate slug from name
      const baseSlug = name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
      let slug = baseSlug;
      let counter = 1;
      while (await prisma.organization.findUnique({ where: { slug } })) {
        slug = `${baseSlug}-${counter++}`;
      }

      // Create org + set user as OWNER
      const org = await prisma.organization.create({
        data: {
          name,
          slug,
          website: website || null,
          industry: industry || null,
          size: size || null,
          subscriptionId: subscription.id,
          members: {
            create: {
              userId: req.user.userId,
              role: 'OWNER',
            },
          },
        },
        include: {
          members: {
            include: {
              user: {
                select: { id: true, fullName: true, email: true, avatarUrl: true, jobTitle: true },
              },
            },
          },
        },
      });

      // Log activity
      await prisma.orgActivityLog.create({
        data: {
          organizationId: org.id,
          userId: req.user.userId,
          action: 'ORG_CREATED',
          resourceType: 'organization',
          resourceId: org.id,
        },
      });

      logger.info('Organization created', { orgId: org.id, userId: req.user.userId });

      res.status(201).json({ success: true, data: org });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get current user's organization
   * GET /api/v1/organizations/mine
   */
  async getMine(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new AuthenticationError('Authentication required');

      const membership = await prisma.organizationMember.findFirst({
        where: { userId: req.user.userId },
        include: {
          organization: {
            include: {
              subscription: {
                select: { plan: true, status: true, seats: true, billingInterval: true, currentPeriodEnd: true },
              },
              members: {
                include: {
                  user: {
                    select: { id: true, fullName: true, email: true, avatarUrl: true, jobTitle: true },
                  },
                },
                orderBy: { joinedAt: 'asc' },
              },
              _count: {
                select: { sharedContacts: true, invitations: true },
              },
            },
          },
        },
      });

      if (!membership) {
        res.status(200).json({ success: true, data: null });
        return;
      }

      res.status(200).json({
        success: true,
        data: {
          ...membership.organization,
          myRole: membership.role,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update organization
   * PATCH /api/v1/organizations/:id
   */
  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new AuthenticationError('Authentication required');

      const { id } = req.params;
      const { name, logoUrl, website, industry, size } = req.body;

      const org = await prisma.organization.update({
        where: { id },
        data: {
          ...(name !== undefined && { name }),
          ...(logoUrl !== undefined && { logoUrl }),
          ...(website !== undefined && { website }),
          ...(industry !== undefined && { industry }),
          ...(size !== undefined && { size }),
        },
      });

      await prisma.orgActivityLog.create({
        data: {
          organizationId: id,
          userId: req.user.userId,
          action: 'ORG_UPDATED',
          resourceType: 'organization',
          resourceId: id,
          metadata: { fields: Object.keys(req.body) },
        },
      });

      res.status(200).json({ success: true, data: org });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Delete organization
   * DELETE /api/v1/organizations/:id
   */
  async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new AuthenticationError('Authentication required');

      const { id } = req.params;

      // Verify OWNER role
      if (req.organization?.role !== 'OWNER') {
        throw new ForbiddenError('Only the organization owner can delete it');
      }

      await prisma.organization.delete({ where: { id } });

      logger.info('Organization deleted', { orgId: id, userId: req.user.userId });

      res.status(200).json({ success: true, message: 'Organization deleted' });
    } catch (error) {
      next(error);
    }
  }

  /**
   * List organization members
   * GET /api/v1/organizations/:id/members
   */
  async listMembers(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new AuthenticationError('Authentication required');

      const { id } = req.params;

      const members = await prisma.organizationMember.findMany({
        where: { organizationId: id },
        include: {
          user: {
            select: {
              id: true,
              fullName: true,
              email: true,
              avatarUrl: true,
              jobTitle: true,
              company: true,
            },
          },
        },
        orderBy: { joinedAt: 'asc' },
      });

      res.status(200).json({ success: true, data: members });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Invite a member by email
   * POST /api/v1/organizations/:id/members/invite
   */
  async inviteMember(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new AuthenticationError('Authentication required');

      const { id } = req.params;
      const { email, role, message: personalMessage } = req.body;

      // Check seat limit
      const org = await prisma.organization.findUnique({
        where: { id },
        include: {
          subscription: { select: { seats: true } },
          _count: { select: { members: true } },
        },
      });

      if (!org) throw new NotFoundError('Organization not found');

      if (org._count.members >= org.subscription.seats) {
        throw new ValidationError(
          `Seat limit reached (${org.subscription.seats}). Please add more seats in billing settings.`
        );
      }

      // Check if already a member
      const existingUser = await prisma.user.findUnique({ where: { email } });
      if (existingUser) {
        const existingMember = await prisma.organizationMember.findUnique({
          where: { organizationId_userId: { organizationId: id, userId: existingUser.id } },
        });
        if (existingMember) {
          throw new ConflictError('This user is already a member of the organization');
        }
      }

      // Check for pending invite
      const existingInvite = await prisma.orgInvitation.findFirst({
        where: { organizationId: id, email, status: 'PENDING' },
      });
      if (existingInvite) {
        throw new ConflictError('A pending invitation already exists for this email');
      }

      // Prevent inviting with OWNER role
      const assignRole = role === 'OWNER' ? 'ADMIN' : (role || 'MEMBER');

      // Create invitation
      const token = crypto.randomBytes(32).toString('hex');
      const invitation = await prisma.orgInvitation.create({
        data: {
          organizationId: id,
          email,
          role: assignRole,
          token,
          invitedById: req.user.userId,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        },
        include: {
          organization: { select: { name: true } },
          invitedBy: { select: { fullName: true } },
        },
      });

      await prisma.orgActivityLog.create({
        data: {
          organizationId: id,
          userId: req.user.userId,
          action: 'MEMBER_INVITED',
          resourceType: 'invitation',
          resourceId: invitation.id,
          metadata: { email, role: assignRole },
        },
      });

      // Send invitation email
      const emailService = new EmailService();
      const inviteUrl = `${process.env.FRONTEND_URL || 'https://intellmatch.com'}/invite/org/${token}`;
      emailService.sendOrganizationInvitationEmail(email, {
        recipientEmail: email,
        inviterName: invitation.invitedBy?.fullName || 'A team member',
        organizationName: invitation.organization?.name || 'your team',
        role: assignRole,
        inviteUrl,
      }).catch((err) => {
        logger.error('Failed to send organization invitation email', { error: err, email, orgId: id });
      });

      logger.info('Organization invitation sent', { orgId: id, email, role: assignRole });

      res.status(201).json({ success: true, data: invitation });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update member role
   * PATCH /api/v1/organizations/:id/members/:userId
   */
  async updateMemberRole(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new AuthenticationError('Authentication required');

      const { id, userId } = req.params;
      const { role } = req.body;

      // Can't change OWNER's role unless you're the OWNER transferring
      const targetMember = await prisma.organizationMember.findUnique({
        where: { organizationId_userId: { organizationId: id, userId } },
      });

      if (!targetMember) throw new NotFoundError('Member not found');

      if (targetMember.role === 'OWNER' && req.organization?.role !== 'OWNER') {
        throw new ForbiddenError('Only the owner can change the owner role');
      }

      // If transferring ownership
      if (role === 'OWNER') {
        if (req.organization?.role !== 'OWNER') {
          throw new ForbiddenError('Only the current owner can transfer ownership');
        }
        // Demote current owner to ADMIN
        await prisma.organizationMember.update({
          where: { organizationId_userId: { organizationId: id, userId: req.user.userId } },
          data: { role: 'ADMIN' },
        });
      }

      const updated = await prisma.organizationMember.update({
        where: { organizationId_userId: { organizationId: id, userId } },
        data: { role },
        include: {
          user: {
            select: { id: true, fullName: true, email: true, avatarUrl: true },
          },
        },
      });

      await prisma.orgActivityLog.create({
        data: {
          organizationId: id,
          userId: req.user.userId,
          action: 'ROLE_CHANGED',
          resourceType: 'member',
          resourceId: userId,
          metadata: { newRole: role, previousRole: targetMember.role },
        },
      });

      res.status(200).json({ success: true, data: updated });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Remove a member
   * DELETE /api/v1/organizations/:id/members/:userId
   */
  async removeMember(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new AuthenticationError('Authentication required');

      const { id, userId } = req.params;

      const targetMember = await prisma.organizationMember.findUnique({
        where: { organizationId_userId: { organizationId: id, userId } },
      });

      if (!targetMember) throw new NotFoundError('Member not found');

      if (targetMember.role === 'OWNER') {
        throw new ForbiddenError('Cannot remove the organization owner');
      }

      await prisma.organizationMember.delete({
        where: { organizationId_userId: { organizationId: id, userId } },
      });

      // Also remove their shared contacts
      await prisma.sharedContact.deleteMany({
        where: { organizationId: id, sharedById: userId },
      });

      await prisma.orgActivityLog.create({
        data: {
          organizationId: id,
          userId: req.user.userId,
          action: 'MEMBER_REMOVED',
          resourceType: 'member',
          resourceId: userId,
        },
      });

      logger.info('Organization member removed', { orgId: id, removedUserId: userId });

      res.status(200).json({ success: true, message: 'Member removed' });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get invitation info (PUBLIC - no auth required)
   * GET /api/v1/organizations/invitations/:token/info
   */
  async getInvitationInfo(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { token } = req.params;

      const invitation = await prisma.orgInvitation.findUnique({
        where: { token },
        include: {
          organization: { select: { id: true, name: true, logoUrl: true } },
          invitedBy: { select: { fullName: true, avatarUrl: true } },
        },
      });

      if (!invitation) throw new NotFoundError('Invitation not found');

      const isExpired = invitation.expiresAt < new Date();
      const isValid = invitation.status === 'PENDING' && !isExpired;

      res.json({
        success: true,
        data: {
          email: invitation.email,
          role: invitation.role,
          status: isExpired ? 'EXPIRED' : invitation.status,
          isValid,
          organization: invitation.organization,
          invitedBy: invitation.invitedBy,
          expiresAt: invitation.expiresAt,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Accept an invitation
   * POST /api/v1/organizations/invitations/:token/accept
   */
  async acceptInvitation(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new AuthenticationError('Authentication required');

      const { token } = req.params;

      const invitation = await prisma.orgInvitation.findUnique({
        where: { token },
        include: { organization: { select: { id: true, name: true } } },
      });

      if (!invitation) throw new NotFoundError('Invitation not found');

      if (invitation.status !== 'PENDING') {
        throw new ValidationError(`Invitation is ${invitation.status.toLowerCase()}`);
      }

      if (invitation.expiresAt < new Date()) {
        await prisma.orgInvitation.update({
          where: { id: invitation.id },
          data: { status: 'EXPIRED' },
        });
        throw new ValidationError('Invitation has expired');
      }

      // Verify email matches (case-insensitive)
      const user = await prisma.user.findUnique({ where: { id: req.user.userId } });
      if (!user || user.email.toLowerCase() !== invitation.email.toLowerCase()) {
        throw new ForbiddenError('This invitation was sent to a different email address');
      }

      // Check not already a member
      const existingMembership = await prisma.organizationMember.findUnique({
        where: {
          organizationId_userId: {
            organizationId: invitation.organizationId,
            userId: req.user.userId,
          },
        },
      });

      if (existingMembership) {
        // Update invitation status and return
        await prisma.orgInvitation.update({
          where: { id: invitation.id },
          data: { status: 'ACCEPTED' },
        });
        throw new ConflictError('You are already a member of this organization');
      }

      // Create membership and update invitation
      await prisma.$transaction([
        prisma.organizationMember.create({
          data: {
            organizationId: invitation.organizationId,
            userId: req.user.userId,
            role: invitation.role,
          },
        }),
        prisma.orgInvitation.update({
          where: { id: invitation.id },
          data: { status: 'ACCEPTED' },
        }),
        prisma.orgActivityLog.create({
          data: {
            organizationId: invitation.organizationId,
            userId: req.user.userId,
            action: 'MEMBER_JOINED',
            resourceType: 'member',
            resourceId: req.user.userId,
            metadata: { role: invitation.role, invitationId: invitation.id },
          },
        }),
      ]);

      logger.info('Invitation accepted', {
        orgId: invitation.organizationId,
        userId: req.user.userId,
      });

      res.status(200).json({
        success: true,
        data: {
          organizationId: invitation.organizationId,
          organizationName: invitation.organization.name,
          role: invitation.role,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Decline an invitation
   * POST /api/v1/organizations/invitations/:token/decline
   */
  async declineInvitation(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new AuthenticationError('Authentication required');

      const { token } = req.params;

      const invitation = await prisma.orgInvitation.findUnique({ where: { token } });

      if (!invitation) throw new NotFoundError('Invitation not found');

      if (invitation.status !== 'PENDING') {
        throw new ValidationError(`Invitation is ${invitation.status.toLowerCase()}`);
      }

      await prisma.orgInvitation.update({
        where: { id: invitation.id },
        data: { status: 'CANCELLED' },
      });

      res.status(200).json({ success: true, message: 'Invitation declined' });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get pending invitations for current user
   * GET /api/v1/organizations/invitations/pending
   */
  async getPendingInvitations(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new AuthenticationError('Authentication required');

      const user = await prisma.user.findUnique({
        where: { id: req.user.userId },
        select: { email: true },
      });

      if (!user) throw new NotFoundError('User not found');

      const invitations = await prisma.orgInvitation.findMany({
        where: {
          email: user.email,
          status: 'PENDING',
          expiresAt: { gt: new Date() },
        },
        include: {
          organization: { select: { id: true, name: true, logoUrl: true } },
          invitedBy: { select: { fullName: true, avatarUrl: true } },
        },
        orderBy: { createdAt: 'desc' },
      });

      res.status(200).json({ success: true, data: invitations });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get activity log
   * GET /api/v1/organizations/:id/activity
   */
  async getActivityLog(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new AuthenticationError('Authentication required');

      const { id } = req.params;
      const { page = '1', limit = '20', action, userId: filterUserId } = req.query;

      const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
      const take = Math.min(parseInt(limit as string), 50);

      const where: any = { organizationId: id };
      if (action) where.action = action;
      if (filterUserId) where.userId = filterUserId;

      const [logs, total] = await Promise.all([
        prisma.orgActivityLog.findMany({
          where,
          include: {
            user: {
              select: { id: true, fullName: true, avatarUrl: true },
            },
          },
          orderBy: { createdAt: 'desc' },
          skip,
          take,
        }),
        prisma.orgActivityLog.count({ where }),
      ]);

      res.status(200).json({
        success: true,
        data: {
          data: logs,
          pagination: {
            page: parseInt(page as string),
            limit: take,
            total,
            totalPages: Math.ceil(total / take),
          },
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Share contacts with organization
   * POST /api/v1/organizations/:id/contacts/share
   */
  async shareContacts(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new AuthenticationError('Authentication required');

      const { id } = req.params;
      const { contactIds, visibility = 'FULL' } = req.body;

      if (!contactIds || !Array.isArray(contactIds) || contactIds.length === 0) {
        throw new ValidationError('contactIds must be a non-empty array');
      }

      // Verify contacts belong to user
      const contacts = await prisma.contact.findMany({
        where: { id: { in: contactIds }, ownerId: req.user.userId },
        select: { id: true },
      });

      const validIds = contacts.map((c) => c.id);

      // Check contact limit
      const org = await prisma.organization.findUnique({
        where: { id },
        include: { _count: { select: { sharedContacts: true } } },
      });

      if (!org) throw new NotFoundError('Organization not found');

      const newTotal = org._count.sharedContacts + validIds.length;
      if (newTotal > org.contactLimit) {
        throw new ValidationError(
          `Sharing these contacts would exceed the org limit of ${org.contactLimit}`
        );
      }

      // Upsert shared contacts
      const results = await Promise.all(
        validIds.map((contactId) =>
          prisma.sharedContact.upsert({
            where: {
              contactId_organizationId: { contactId, organizationId: id },
            },
            create: {
              contactId,
              organizationId: id,
              sharedById: req.user!.userId,
              visibility,
            },
            update: { visibility },
          })
        )
      );

      await prisma.orgActivityLog.create({
        data: {
          organizationId: id,
          userId: req.user.userId,
          action: 'CONTACT_SHARED',
          metadata: { count: results.length, visibility },
        },
      });

      res.status(200).json({ success: true, data: { shared: results.length } });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Unshare contacts from organization
   * DELETE /api/v1/organizations/:id/contacts/unshare
   */
  async unshareContacts(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new AuthenticationError('Authentication required');

      const { id } = req.params;
      const { contactIds } = req.body;

      if (!contactIds || !Array.isArray(contactIds)) {
        throw new ValidationError('contactIds must be an array');
      }

      // Only unshare contacts the user shared (or admin can unshare any)
      const isAdmin = req.organization?.role === 'ADMIN' || req.organization?.role === 'OWNER';

      const where: any = {
        organizationId: id,
        contactId: { in: contactIds },
      };

      if (!isAdmin) {
        where.sharedById = req.user.userId;
      }

      const result = await prisma.sharedContact.deleteMany({ where });

      res.status(200).json({ success: true, data: { removed: result.count } });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get organization contacts pool
   * GET /api/v1/organizations/:id/contacts
   */
  async getOrgContacts(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new AuthenticationError('Authentication required');

      const { id } = req.params;
      const {
        page = '1',
        limit = '20',
        search,
        sharedById,
      } = req.query;

      const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
      const take = Math.min(parseInt(limit as string), 50);

      const where: any = { organizationId: id };
      if (sharedById) where.sharedById = sharedById;

      // Search on the related contact
      const contactWhere: any = {};
      if (search) {
        contactWhere.OR = [
          { fullName: { contains: search as string } },
          { email: { contains: search as string } },
          { company: { contains: search as string } },
        ];
      }

      if (Object.keys(contactWhere).length > 0) {
        where.contact = contactWhere;
      }

      const [sharedContacts, total] = await Promise.all([
        prisma.sharedContact.findMany({
          where,
          include: {
            contact: {
              select: {
                id: true,
                fullName: true,
                email: true,
                phone: true,
                company: true,
                jobTitle: true,
                avatarUrl: true,
                location: true,
                linkedinUrl: true,
              },
            },
            sharedBy: {
              select: { id: true, fullName: true, avatarUrl: true },
            },
          },
          orderBy: { createdAt: 'desc' },
          skip,
          take,
        }),
        prisma.sharedContact.count({ where }),
      ]);

      res.status(200).json({
        success: true,
        data: {
          data: sharedContacts,
          pagination: {
            page: parseInt(page as string),
            limit: take,
            total,
            totalPages: Math.ceil(total / take),
          },
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get org contact stats
   * GET /api/v1/organizations/:id/contacts/stats
   */
  async getOrgContactStats(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new AuthenticationError('Authentication required');

      const { id } = req.params;

      const org = await prisma.organization.findUnique({
        where: { id },
        select: {
          contactLimit: true,
          _count: { select: { sharedContacts: true, members: true } },
        },
      });

      if (!org) throw new NotFoundError('Organization not found');

      res.status(200).json({
        success: true,
        data: {
          totalShared: org._count.sharedContacts,
          contactLimit: org.contactLimit,
          memberCount: org._count.members,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get or update sharing preferences
   * GET /api/v1/organizations/:id/privacy
   */
  async getPrivacySettings(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new AuthenticationError('Authentication required');

      const { id } = req.params;

      let pref = await prisma.contactSharingPreference.findUnique({
        where: {
          userId_organizationId: { userId: req.user.userId, organizationId: id },
        },
      });

      if (!pref) {
        pref = await prisma.contactSharingPreference.create({
          data: {
            userId: req.user.userId,
            organizationId: id,
            shareMode: 'MANUAL',
          },
        });
      }

      res.status(200).json({ success: true, data: pref });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update sharing preferences
   * PATCH /api/v1/organizations/:id/privacy
   */
  async updatePrivacySettings(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new AuthenticationError('Authentication required');

      const { id } = req.params;
      const { shareMode } = req.body;

      const pref = await prisma.contactSharingPreference.upsert({
        where: {
          userId_organizationId: { userId: req.user.userId, organizationId: id },
        },
        create: {
          userId: req.user.userId,
          organizationId: id,
          shareMode,
        },
        update: { shareMode },
      });

      res.status(200).json({ success: true, data: pref });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update per-contact visibility
   * PATCH /api/v1/organizations/:id/contacts/:contactId/visibility
   */
  async updateContactVisibility(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new AuthenticationError('Authentication required');

      const { id, contactId } = req.params;
      const { visibility } = req.body;

      const shared = await prisma.sharedContact.findUnique({
        where: {
          contactId_organizationId: { contactId, organizationId: id },
        },
      });

      if (!shared) throw new NotFoundError('Shared contact not found');

      // Only the sharer or admin can change visibility
      const isAdmin = req.organization?.role === 'ADMIN' || req.organization?.role === 'OWNER';
      if (shared.sharedById !== req.user.userId && !isAdmin) {
        throw new ForbiddenError('Only the contact sharer or an admin can change visibility');
      }

      const updated = await prisma.sharedContact.update({
        where: { contactId_organizationId: { contactId, organizationId: id } },
        data: { visibility },
      });

      res.status(200).json({ success: true, data: updated });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Request a warm intro
   * POST /api/v1/organizations/:id/intros
   */
  async requestIntro(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new AuthenticationError('Authentication required');

      const { id } = req.params;
      const { connectorId, targetContactId, message, context } = req.body;

      // Verify connector is a member
      const connectorMember = await prisma.organizationMember.findUnique({
        where: {
          organizationId_userId: { organizationId: id, userId: connectorId },
        },
      });

      if (!connectorMember) {
        throw new ValidationError('Connector is not a member of this organization');
      }

      // Verify the target contact is shared by the connector
      const sharedContact = await prisma.sharedContact.findFirst({
        where: {
          contactId: targetContactId,
          organizationId: id,
          sharedById: connectorId,
        },
      });

      if (!sharedContact) {
        throw new ValidationError('Target contact is not shared by this connector');
      }

      const intro = await prisma.warmIntroRequest.create({
        data: {
          organizationId: id,
          requesterId: req.user.userId,
          connectorId,
          targetContactId,
          message,
          context,
        },
        include: {
          requester: {
            select: { id: true, fullName: true, avatarUrl: true },
          },
          connector: {
            select: { id: true, fullName: true, avatarUrl: true },
          },
          targetContact: {
            select: { id: true, fullName: true, company: true, jobTitle: true },
          },
        },
      });

      await prisma.orgActivityLog.create({
        data: {
          organizationId: id,
          userId: req.user.userId,
          action: 'INTRO_REQUESTED',
          resourceType: 'warmIntro',
          resourceId: intro.id,
          metadata: { connectorId, targetContactId },
        },
      });

      res.status(201).json({ success: true, data: intro });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get sent intro requests
   * GET /api/v1/organizations/:id/intros/sent
   */
  async getSentIntros(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new AuthenticationError('Authentication required');

      const { id } = req.params;

      const intros = await prisma.warmIntroRequest.findMany({
        where: { organizationId: id, requesterId: req.user.userId },
        include: {
          connector: {
            select: { id: true, fullName: true, avatarUrl: true },
          },
          targetContact: {
            select: { id: true, fullName: true, company: true, jobTitle: true, avatarUrl: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      res.status(200).json({ success: true, data: intros });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get received intro requests (to facilitate)
   * GET /api/v1/organizations/:id/intros/received
   */
  async getReceivedIntros(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new AuthenticationError('Authentication required');

      const { id } = req.params;

      const intros = await prisma.warmIntroRequest.findMany({
        where: { organizationId: id, connectorId: req.user.userId },
        include: {
          requester: {
            select: { id: true, fullName: true, avatarUrl: true, jobTitle: true },
          },
          targetContact: {
            select: { id: true, fullName: true, company: true, jobTitle: true, avatarUrl: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      res.status(200).json({ success: true, data: intros });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Respond to intro request (approve/decline/complete)
   * PATCH /api/v1/organizations/:id/intros/:introId
   */
  async respondToIntro(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new AuthenticationError('Authentication required');

      const { id, introId } = req.params;
      const { status, connectorNote, declinedReason } = req.body;

      const intro = await prisma.warmIntroRequest.findFirst({
        where: { id: introId, organizationId: id },
      });

      if (!intro) throw new NotFoundError('Intro request not found');

      // Only connector or admin can respond
      const isAdmin = req.organization?.role === 'ADMIN' || req.organization?.role === 'OWNER';
      if (intro.connectorId !== req.user.userId && !isAdmin) {
        throw new ForbiddenError('Only the connector can respond to this intro request');
      }

      const updateData: any = { status };
      if (status === 'APPROVED' && connectorNote) updateData.connectorNote = connectorNote;
      if (status === 'DECLINED') {
        updateData.declinedAt = new Date();
        if (declinedReason) updateData.declinedReason = declinedReason;
      }
      if (status === 'COMPLETED') updateData.completedAt = new Date();

      const updated = await prisma.warmIntroRequest.update({
        where: { id: introId },
        data: updateData,
        include: {
          requester: {
            select: { id: true, fullName: true, avatarUrl: true },
          },
          connector: {
            select: { id: true, fullName: true, avatarUrl: true },
          },
          targetContact: {
            select: { id: true, fullName: true, company: true },
          },
        },
      });

      res.status(200).json({ success: true, data: updated });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get intro stats
   * GET /api/v1/organizations/:id/intros/stats
   */
  async getIntroStats(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new AuthenticationError('Authentication required');

      const { id } = req.params;

      const [total, pending, approved, completed, declined] = await Promise.all([
        prisma.warmIntroRequest.count({ where: { organizationId: id } }),
        prisma.warmIntroRequest.count({ where: { organizationId: id, status: 'PENDING' } }),
        prisma.warmIntroRequest.count({ where: { organizationId: id, status: 'APPROVED' } }),
        prisma.warmIntroRequest.count({ where: { organizationId: id, status: 'COMPLETED' } }),
        prisma.warmIntroRequest.count({ where: { organizationId: id, status: 'DECLINED' } }),
      ]);

      res.status(200).json({
        success: true,
        data: { total, pending, approved, completed, declined },
      });
    } catch (error) {
      next(error);
    }
  }

  // =====================
  // Shared Workspaces
  // =====================

  /**
   * Share a project with team
   * POST /api/v1/organizations/:id/projects/:projectId/share
   */
  async shareProject(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new AuthenticationError('Authentication required');

      const { id: orgId, projectId } = req.params;

      const project = await prisma.project.findFirst({
        where: { id: projectId, userId: req.user.userId },
      });

      if (!project) throw new NotFoundError('Project not found');

      await prisma.project.update({
        where: { id: projectId },
        data: { organizationId: orgId, isTeamShared: true },
      });

      res.status(200).json({ success: true, message: 'Project shared with team' });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Unshare a project from team
   * DELETE /api/v1/organizations/:id/projects/:projectId/share
   */
  async unshareProject(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new AuthenticationError('Authentication required');

      const { projectId } = req.params;

      const project = await prisma.project.findFirst({
        where: { id: projectId, userId: req.user.userId },
      });

      if (!project) throw new NotFoundError('Project not found');

      await prisma.project.update({
        where: { id: projectId },
        data: { organizationId: null, isTeamShared: false },
      });

      res.status(200).json({ success: true, message: 'Project unshared from team' });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get team projects
   * GET /api/v1/organizations/:id/projects
   */
  async getTeamProjects(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new AuthenticationError('Authentication required');

      const { id: orgId } = req.params;
      const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 20));

      const where = { organizationId: orgId, isTeamShared: true };

      const [projects, total] = await Promise.all([
        prisma.project.findMany({
          where,
          include: {
            user: { select: { id: true, fullName: true, avatarUrl: true } },
            sectors: { include: { sector: true } },
            _count: { select: { matches: true } },
          },
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.project.count({ where }),
      ]);

      res.status(200).json({
        success: true,
        data: {
          projects: projects.map((p) => ({
            id: p.id,
            title: p.title,
            summary: p.summary,
            category: p.category,
            stage: p.stage,
            visibility: p.visibility,
            isActive: p.isActive,
            sectors: p.sectors.map((ps) => ps.sector),
            matchCount: p._count.matches,
            user: p.user,
            createdAt: p.createdAt,
          })),
          pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Share a deal with team
   * POST /api/v1/organizations/:id/deals/:dealId/share
   */
  async shareDeal(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new AuthenticationError('Authentication required');

      const { id: orgId, dealId } = req.params;

      const deal = await prisma.dealRequest.findFirst({
        where: { id: dealId, userId: req.user.userId },
      });

      if (!deal) throw new NotFoundError('Deal not found');

      await prisma.dealRequest.update({
        where: { id: dealId },
        data: { organizationId: orgId, isTeamShared: true },
      });

      res.status(200).json({ success: true, message: 'Deal shared with team' });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Unshare a deal from team
   * DELETE /api/v1/organizations/:id/deals/:dealId/share
   */
  async unshareDeal(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new AuthenticationError('Authentication required');

      const { dealId } = req.params;

      const deal = await prisma.dealRequest.findFirst({
        where: { id: dealId, userId: req.user.userId },
      });

      if (!deal) throw new NotFoundError('Deal not found');

      await prisma.dealRequest.update({
        where: { id: dealId },
        data: { organizationId: null, isTeamShared: false },
      });

      res.status(200).json({ success: true, message: 'Deal unshared from team' });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get team deals
   * GET /api/v1/organizations/:id/deals
   */
  async getTeamDeals(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new AuthenticationError('Authentication required');

      const { id: orgId } = req.params;
      const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 20));

      const where = { organizationId: orgId, isTeamShared: true };

      const [deals, total] = await Promise.all([
        prisma.dealRequest.findMany({
          where,
          include: {
            user: { select: { id: true, fullName: true, avatarUrl: true } },
          },
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.dealRequest.count({ where }),
      ]);

      res.status(200).json({
        success: true,
        data: {
          deals: deals.map((d) => ({
            id: d.id,
            title: d.title,
            mode: d.mode,
            domain: d.domain,
            solutionType: d.solutionType,
            productName: d.productName,
            targetDescription: d.targetDescription,
            problemStatement: d.problemStatement,
            status: d.status,
            matchCount: d.matchCount,
            avgScore: d.avgScore,
            user: d.user,
            createdAt: d.createdAt,
          })),
          pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
        },
      });
    } catch (error) {
      next(error);
    }
  }
  /**
   * Copy personal contacts to organization
   *
   * POST /api/v1/organizations/:id/contacts/copy
   */
  async copyContactsToOrg(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new AuthenticationError('Authentication required');

      const orgId = req.params.id;
      const { contactIds } = req.body;

      if (!Array.isArray(contactIds) || contactIds.length === 0) {
        throw new ValidationError('contactIds must be a non-empty array');
      }

      // Fetch the personal contacts owned by this user
      const contacts = await prisma.contact.findMany({
        where: {
          id: { in: contactIds },
          ownerId: req.user.userId,
          organizationId: null, // Only personal contacts
        },
        include: {
          contactSectors: true,
          contactSkills: true,
          contactInterests: true,
          contactHobbies: true,
        },
      });

      if (contacts.length === 0) {
        res.json({ success: true, data: { copied: 0 } });
        return;
      }

      let copied = 0;
      for (const contact of contacts) {
        const newId = crypto.randomUUID();
        await prisma.$transaction(async (tx) => {
          // Create new contact in org
          await tx.contact.create({
            data: {
              id: newId,
              ownerId: req.user!.userId,
              organizationId: orgId,
              fullName: contact.fullName,
              title: contact.title,
              firstName: contact.firstName,
              middleName: contact.middleName,
              lastName: contact.lastName,
              email: contact.email,
              phone: contact.phone,
              phoneCountryCode: contact.phoneCountryCode,
              company: contact.company,
              jobTitle: contact.jobTitle,
              website: contact.website,
              linkedinUrl: contact.linkedinUrl,
              notes: contact.notes,
              source: contact.source,
              bio: contact.bio,
              bioSummary: contact.bioSummary,
              bioFull: contact.bioFull,
              location: contact.location,
              avatarUrl: contact.avatarUrl,
              rawSources: contact.rawSources || [],
            },
          });

          // Copy sectors
          if (contact.contactSectors.length > 0) {
            await tx.contactSector.createMany({
              data: contact.contactSectors.map((cs) => ({
                contactId: newId,
                sectorId: cs.sectorId,
                confidence: cs.confidence,
                source: cs.source,
              })),
            });
          }

          // Copy skills
          if (contact.contactSkills.length > 0) {
            await tx.contactSkill.createMany({
              data: contact.contactSkills.map((cs) => ({
                contactId: newId,
                skillId: cs.skillId,
                confidence: cs.confidence,
                source: cs.source,
              })),
            });
          }

          // Copy interests
          if (contact.contactInterests.length > 0) {
            await tx.contactInterest.createMany({
              data: contact.contactInterests.map((ci) => ({
                contactId: newId,
                interestId: ci.interestId,
                confidence: ci.confidence,
                source: ci.source,
              })),
            });
          }

          // Copy hobbies
          if (contact.contactHobbies.length > 0) {
            await tx.contactHobby.createMany({
              data: contact.contactHobbies.map((ch) => ({
                contactId: newId,
                hobbyId: ch.hobbyId,
              })),
            });
          }
        });
        copied++;
      }

      // Log activity
      await prisma.orgActivityLog.create({
        data: {
          organizationId: orgId,
          userId: req.user.userId,
          action: 'COPY_CONTACTS',
          resourceType: 'contact',
          metadata: { count: copied, contactIds: contacts.map(c => c.id) },
        },
      });

      res.json({ success: true, data: { copied } });
    } catch (error) {
      next(error);
    }
  }
  /**
   * Get pending invitations for an organization
   * GET /api/v1/organizations/:id/invitations
   */
  async getOrgInvitations(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new AuthenticationError('Authentication required');

      const { id } = req.params;

      const invitations = await prisma.orgInvitation.findMany({
        where: {
          organizationId: id,
          status: 'PENDING',
          expiresAt: { gt: new Date() },
        },
        include: {
          invitedBy: { select: { fullName: true, avatarUrl: true } },
        },
        orderBy: { createdAt: 'desc' },
      });

      res.json({ success: true, data: invitations });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Cancel a pending invitation
   * DELETE /api/v1/organizations/:id/invitations/:invitationId
   */
  async cancelInvitation(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new AuthenticationError('Authentication required');

      const { id, invitationId } = req.params;

      const invitation = await prisma.orgInvitation.findUnique({
        where: { id: invitationId },
      });

      if (!invitation) throw new NotFoundError('Invitation not found');
      if (invitation.organizationId !== id) throw new ForbiddenError('Invitation does not belong to this organization');
      if (invitation.status !== 'PENDING') throw new ValidationError('Only pending invitations can be cancelled');

      await prisma.orgInvitation.update({
        where: { id: invitationId },
        data: { status: 'CANCELLED' },
      });

      await prisma.orgActivityLog.create({
        data: {
          organizationId: id,
          userId: req.user.userId,
          action: 'INVITATION_CANCELLED',
          resourceType: 'invitation',
          resourceId: invitationId,
          metadata: { email: invitation.email },
        },
      });

      logger.info('Organization invitation cancelled', { orgId: id, invitationId, email: invitation.email });

      res.json({ success: true, message: 'Invitation cancelled' });
    } catch (error) {
      next(error);
    }
  }
}

export const organizationController = new OrganizationController();
