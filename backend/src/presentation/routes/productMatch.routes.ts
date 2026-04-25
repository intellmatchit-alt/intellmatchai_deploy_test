/**
 * Product Match Routes (Sell Smarter Feature)
 * API endpoints for product profile and match operations
 */

import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import * as ProductMatchController from '../controllers/ProductMatchController';

const router = Router();

// All routes require authentication
router.use(authenticate);

// ============================================================================
// Product Profile Routes
// ============================================================================

/**
 * @route GET /api/v1/product-profile
 * @desc Get current user's product profile
 * @access Private
 */
router.get('/', ProductMatchController.getProductProfile);

/**
 * @route POST /api/v1/product-profile
 * @desc Create or update product profile
 * @access Private
 */
router.post('/', ProductMatchController.upsertProductProfile);

export const productProfileRoutes = router;

// ============================================================================
// Product Match Run Routes
// ============================================================================

const matchRouter = Router();

matchRouter.use(authenticate);

/**
 * @route POST /api/v1/product-match/runs
 * @desc Start a new match run
 * @access Private
 */
matchRouter.post('/runs', ProductMatchController.startMatchRun);

/**
 * @route GET /api/v1/product-match/runs/latest
 * @desc Get latest match run for current user
 * @access Private
 */
matchRouter.get('/runs/latest', ProductMatchController.getLatestMatchRun);

/**
 * @route GET /api/v1/product-match/runs/:runId
 * @desc Get match run status
 * @access Private
 */
matchRouter.get('/runs/:runId', ProductMatchController.getMatchRun);

/**
 * @route GET /api/v1/product-match/runs/:runId/results
 * @desc Get match results for a run
 * @access Private
 */
matchRouter.get('/runs/:runId/results', ProductMatchController.getMatchResults);

/**
 * @route GET /api/v1/product-match/contacts/:contactId
 * @desc Get detailed match result for a contact
 * @access Private
 * @query runId - Required run ID
 */
matchRouter.get('/contacts/:contactId', ProductMatchController.getContactMatchDetail);

/**
 * @route PATCH /api/v1/product-match/results/:resultId
 * @desc Update match result (save, dismiss, contacted, edit message)
 * @access Private
 */
matchRouter.patch('/results/:resultId', ProductMatchController.updateMatchResult);

export const productMatchRoutes = matchRouter;

export default matchRouter;
