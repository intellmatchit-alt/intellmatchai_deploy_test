/**
 * Suggestions Routes
 *
 * Routes for profile improvement suggestions and skill gap analysis.
 *
 * @module presentation/routes/suggestions
 */

import { Router } from 'express';
import { suggestionsController } from '../controllers/SuggestionsController';
import { authenticate } from '../middleware/auth.middleware';
import { orgContext } from '../middleware/orgContext.middleware';

export const suggestionsRoutes = Router();

suggestionsRoutes.use(authenticate);
suggestionsRoutes.use(orgContext);

/**
 * GET /api/v1/suggestions/profile-improvements
 * Get profile improvement suggestions based on matching analysis
 */
suggestionsRoutes.get(
  '/profile-improvements',
  suggestionsController.getProfileImprovements.bind(suggestionsController)
);

/**
 * GET /api/v1/suggestions/skill-gap/:contactId
 * Get skill gap analysis between user and a contact
 */
suggestionsRoutes.get(
  '/skill-gap/:contactId',
  suggestionsController.getSkillGap.bind(suggestionsController)
);

export default suggestionsRoutes;
