/**
 * Itemized Match Routes
 *
 * Routes for itemized explainable matching endpoints.
 *
 * @module presentation/routes/itemizedMatch
 */

import { Router } from 'express';
import { itemizedMatchController } from '../controllers/ItemizedMatchController';
import { authenticate } from '../middleware/auth.middleware';

export const itemizedMatchRoutes = Router();

// ============================================
// Profile Matching (requires auth)
// ============================================

/**
 * GET /api/v1/matches/itemized/:contactId
 * Get itemized match between user and a contact
 *
 * Returns per-criterion scores with detailed explanations.
 * NO total score - each criterion has its own 0-100% score.
 *
 * Query params:
 * - skipLlm: boolean - Skip LLM-enhanced explanations
 * - includeRaw: boolean - Include raw calculation data
 * - force: boolean - Force recalculation (bypass cache)
 */
itemizedMatchRoutes.get(
  '/:contactId',
  authenticate,
  itemizedMatchController.getProfileMatch.bind(itemizedMatchController)
);

/**
 * POST /api/v1/matches/itemized/batch
 * Get batch itemized matches for multiple contacts
 *
 * Body: { contactIds: string[] }
 *
 * Returns summary data for list views (lighter weight).
 * Maximum 50 contacts per request.
 */
itemizedMatchRoutes.post(
  '/batch',
  authenticate,
  itemizedMatchController.getBatchProfileMatches.bind(itemizedMatchController)
);

/**
 * POST /api/v1/matches/itemized/invalidate/:contactId
 * Invalidate cached matches for a contact
 *
 * Call this after a contact is updated to clear stale data.
 */
itemizedMatchRoutes.post(
  '/invalidate/:contactId',
  authenticate,
  itemizedMatchController.invalidateCache.bind(itemizedMatchController)
);

export default itemizedMatchRoutes;
