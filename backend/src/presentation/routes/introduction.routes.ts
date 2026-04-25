/**
 * Introduction Routes
 * API endpoints for Introduction operations
 */

import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import * as CollaborationController from '../controllers/CollaborationController';

const router = Router();

// ============================================================================
// Public routes (no auth required) - for introduction consent flow
// ============================================================================

/**
 * @route GET /api/v1/introductions/by-token/:token
 * @desc Get introduction details by token (public page)
 * @access Public
 */
router.get('/by-token/:token', CollaborationController.getIntroductionByToken);

/**
 * @route POST /api/v1/introductions/by-token/:token/accept
 * @desc Accept an introduction by token
 * @access Public
 */
router.post('/by-token/:token/accept', CollaborationController.acceptIntroductionByToken);

/**
 * @route POST /api/v1/introductions/by-token/:token/decline
 * @desc Decline an introduction by token
 * @access Public
 */
router.post('/by-token/:token/decline', CollaborationController.declineIntroductionByToken);

// ============================================================================
// Authenticated routes
// ============================================================================

router.use(authenticate);

/**
 * @route POST /api/v1/introductions/:id/complete
 * @desc Mark introduction as completed (updates ledger)
 * @access Private (Collaborator only)
 */
router.post('/:id/complete', CollaborationController.completeIntroduction);

/**
 * @route POST /api/v1/introductions/:id/decline
 * @desc Decline an introduction
 * @access Private (Collaborator only)
 */
router.post('/:id/decline', CollaborationController.declineIntroduction);

/**
 * @route POST /api/v1/introductions/:id/add-contact
 * @desc Add introduced contact to own contact list
 * @access Private (Mission owner only)
 */
router.post('/:id/add-contact', CollaborationController.addContactFromIntroduction);

export default router;
