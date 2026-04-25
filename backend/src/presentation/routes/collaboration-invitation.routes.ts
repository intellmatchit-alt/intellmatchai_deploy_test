/**
 * Collaboration Invitation Routes
 * API endpoints for WhatsApp/Email invitations to third parties
 */

import { Router } from 'express';
import { authenticate, optionalAuth } from '../middleware/auth.middleware';
import * as CollaborationController from '../controllers/CollaborationController';

const router = Router();

// ============================================================================
// Protected Routes (require authentication)
// ============================================================================

/**
 * @route POST /api/v1/collaboration-requests/:id/send-invitation
 * @desc Send invitation via WhatsApp/Email to a matched contact
 * @access Private (collaborator only)
 */
router.post(
  '/collaboration-requests/:id/send-invitation',
  authenticate,
  CollaborationController.sendInvitation
);

// ============================================================================
// Public Routes (no authentication required)
// ============================================================================

/**
 * @route GET /api/v1/invitations/:token
 * @desc Get invitation details by token (for third party landing page)
 * @access Public
 */
router.get('/invitations/:token', CollaborationController.getInvitationByToken);

/**
 * @route POST /api/v1/invitations/:token/accept
 * @desc Accept invitation (can optionally include userId if authenticated)
 * @access Public (optional auth)
 */
router.post(
  '/invitations/:token/accept',
  optionalAuth,
  CollaborationController.acceptInvitation
);

/**
 * @route POST /api/v1/invitations/:token/decline
 * @desc Decline invitation
 * @access Public
 */
router.post('/invitations/:token/decline', CollaborationController.declineInvitationByToken);

export default router;
