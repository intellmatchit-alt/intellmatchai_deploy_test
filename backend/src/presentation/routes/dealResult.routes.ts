/**
 * Deal Result Routes
 * API endpoints for deal match result operations
 */

import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import * as DealController from '../controllers/DealController';

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * @route PATCH /api/v1/deal-results/:resultId
 * @desc Update match status (save/ignore/contacted)
 * @access Private
 */
router.patch('/:resultId', DealController.updateMatchStatus);

/**
 * @route POST /api/v1/deal-results/:resultId/regenerate-message
 * @desc Regenerate opener message
 * @access Private
 */
router.post('/:resultId/regenerate-message', DealController.regenerateMessage);

export default router;
