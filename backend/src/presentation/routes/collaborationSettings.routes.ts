/**
 * Collaboration Settings Routes
 * API endpoints for Collaboration Settings operations
 */

import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware.js';
import * as CollaborationController from '../controllers/CollaborationController';

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * @route GET /api/v1/collaboration-settings
 * @desc Get user's collaboration settings
 * @access Private
 */
router.get('/', CollaborationController.getSettings);

/**
 * @route PUT /api/v1/collaboration-settings
 * @desc Update user's collaboration settings
 * @access Private
 */
router.put('/', CollaborationController.updateSettings);

export default router;
