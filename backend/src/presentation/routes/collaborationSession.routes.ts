/**
 * Collaboration Session Routes
 * API endpoints for Collaboration Session operations
 */

import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import * as CollaborationController from '../controllers/CollaborationController';

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * @route GET /api/v1/collaboration-sessions/:sessionId
 * @desc Get session status
 * @access Private (Collaborator only)
 */
router.get('/:sessionId', CollaborationController.getSessionStatus);

/**
 * @route GET /api/v1/collaboration-sessions/:sessionId/results
 * @desc Get match results for a session
 * @access Private (Collaborator only)
 */
router.get('/:sessionId/results', CollaborationController.getMatchResults);

export default router;
