/**
 * Organization Routes
 *
 * API endpoints for organization/team management.
 */

import { Router } from 'express';
import { organizationController } from '../controllers/OrganizationController';
import { authenticate } from '../middleware/auth.middleware';
import {
  attachSubscriptionContext,
  requirePlan,
  requireOrgRole,
  requireOrgMatch,
} from '../middleware/featureGate.middleware';

export const organizationRoutes = Router();

// ---- Public routes (no auth) ----

// Get invitation info by token (public)
organizationRoutes.get(
  '/invitations/:token/info',
  organizationController.getInvitationInfo.bind(organizationController)
);

// All routes below require authentication + subscription context
organizationRoutes.use(authenticate, attachSubscriptionContext);

// ---- Organization CRUD ----

// Create organization (requires TEAM plan)
organizationRoutes.post(
  '/',
  requirePlan('TEAM'),
  organizationController.create.bind(organizationController)
);

// Get current user's organization
organizationRoutes.get(
  '/mine',
  organizationController.getMine.bind(organizationController)
);

// Update organization (requires ADMIN+ role)
organizationRoutes.patch(
  '/:id',
  requireOrgMatch,
  requireOrgRole('ADMIN'),
  organizationController.update.bind(organizationController)
);

// Delete organization (requires OWNER role)
organizationRoutes.delete(
  '/:id',
  requireOrgMatch,
  requireOrgRole('OWNER'),
  organizationController.delete.bind(organizationController)
);

// ---- Invitations (token-based, no org match needed) ----

// Get my pending invitations
organizationRoutes.get(
  '/invitations/pending',
  organizationController.getPendingInvitations.bind(organizationController)
);

// Accept invitation
organizationRoutes.post(
  '/invitations/:token/accept',
  organizationController.acceptInvitation.bind(organizationController)
);

// Decline invitation
organizationRoutes.post(
  '/invitations/:token/decline',
  organizationController.declineInvitation.bind(organizationController)
);

// ---- Members ----

// List members
organizationRoutes.get(
  '/:id/members',
  requireOrgMatch,
  organizationController.listMembers.bind(organizationController)
);

// Invite member (requires ADMIN+)
organizationRoutes.post(
  '/:id/members/invite',
  requireOrgMatch,
  requireOrgRole('ADMIN'),
  organizationController.inviteMember.bind(organizationController)
);

// Update member role (requires ADMIN+)
organizationRoutes.patch(
  '/:id/members/:userId',
  requireOrgMatch,
  requireOrgRole('ADMIN'),
  organizationController.updateMemberRole.bind(organizationController)
);

// Remove member (requires ADMIN+)
organizationRoutes.delete(
  '/:id/members/:userId',
  requireOrgMatch,
  requireOrgRole('ADMIN'),
  organizationController.removeMember.bind(organizationController)
);

// ---- Org Invitations (admin view) ----

// List pending invitations for the org
organizationRoutes.get(
  '/:id/invitations',
  requireOrgMatch,
  requireOrgRole('ADMIN'),
  organizationController.getOrgInvitations.bind(organizationController)
);

// Cancel a pending invitation
organizationRoutes.delete(
  '/:id/invitations/:invitationId',
  requireOrgMatch,
  requireOrgRole('ADMIN'),
  organizationController.cancelInvitation.bind(organizationController)
);

// ---- Activity Log ----

organizationRoutes.get(
  '/:id/activity',
  requireOrgMatch,
  requireOrgRole('ADMIN'),
  organizationController.getActivityLog.bind(organizationController)
);

// ---- Shared Contacts ----

organizationRoutes.get(
  '/:id/contacts',
  requireOrgMatch,
  organizationController.getOrgContacts.bind(organizationController)
);

organizationRoutes.get(
  '/:id/contacts/stats',
  requireOrgMatch,
  organizationController.getOrgContactStats.bind(organizationController)
);

organizationRoutes.post(
  '/:id/contacts/share',
  requireOrgMatch,
  organizationController.shareContacts.bind(organizationController)
);

organizationRoutes.delete(
  '/:id/contacts/unshare',
  requireOrgMatch,
  organizationController.unshareContacts.bind(organizationController)
);

// ---- Privacy ----

organizationRoutes.get(
  '/:id/privacy',
  requireOrgMatch,
  organizationController.getPrivacySettings.bind(organizationController)
);

organizationRoutes.patch(
  '/:id/privacy',
  requireOrgMatch,
  organizationController.updatePrivacySettings.bind(organizationController)
);

// ---- Per-contact visibility ----

organizationRoutes.patch(
  '/:id/contacts/:contactId/visibility',
  requireOrgMatch,
  organizationController.updateContactVisibility.bind(organizationController)
);

// ---- Warm Intros ----

organizationRoutes.post(
  '/:id/intros',
  requireOrgMatch,
  organizationController.requestIntro.bind(organizationController)
);

organizationRoutes.get(
  '/:id/intros/sent',
  requireOrgMatch,
  organizationController.getSentIntros.bind(organizationController)
);

organizationRoutes.get(
  '/:id/intros/received',
  requireOrgMatch,
  organizationController.getReceivedIntros.bind(organizationController)
);

organizationRoutes.get(
  '/:id/intros/stats',
  requireOrgMatch,
  organizationController.getIntroStats.bind(organizationController)
);

organizationRoutes.patch(
  '/:id/intros/:introId',
  requireOrgMatch,
  organizationController.respondToIntro.bind(organizationController)
);

// ---- Shared Workspaces: Projects ----

organizationRoutes.get(
  '/:id/projects',
  requireOrgMatch,
  organizationController.getTeamProjects.bind(organizationController)
);

organizationRoutes.post(
  '/:id/projects/:projectId/share',
  requireOrgMatch,
  organizationController.shareProject.bind(organizationController)
);

organizationRoutes.delete(
  '/:id/projects/:projectId/share',
  requireOrgMatch,
  organizationController.unshareProject.bind(organizationController)
);

// ---- Shared Workspaces: Deals ----

organizationRoutes.get(
  '/:id/deals',
  requireOrgMatch,
  organizationController.getTeamDeals.bind(organizationController)
);

organizationRoutes.post(
  '/:id/deals/:dealId/share',
  requireOrgMatch,
  organizationController.shareDeal.bind(organizationController)
);

organizationRoutes.delete(
  '/:id/deals/:dealId/share',
  requireOrgMatch,
  organizationController.unshareDeal.bind(organizationController)
);

// ---- Copy Contacts to Org ----

organizationRoutes.post(
  '/:id/contacts/copy',
  requireOrgMatch,
  organizationController.copyContactsToOrg.bind(organizationController)
);

export default organizationRoutes;
