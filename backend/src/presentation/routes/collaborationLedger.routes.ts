/**
 * Collaboration Ledger Routes
 * API endpoints for Collaboration Ledger/History operations
 */

import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import * as CollaborationController from '../controllers/CollaborationController';

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * @route GET /api/v1/collaboration-ledger
 * @desc Get collaboration ledger (history of collaborations)
 * @access Private
 */
router.get('/', CollaborationController.getLedger);

/**
 * @route GET /api/v1/collaboration-ledger/with/:userId
 * @desc Get collaboration history with a specific user
 * @access Private
 */
router.get('/with/:userId', CollaborationController.getLedgerWithUser);

export default router;
