/**
 * Match Routes
 *
 * Routes for matching and recommendations.
 *
 * @module presentation/routes/match
 */

import { Router } from 'express';
import { matchController } from '../controllers/MatchController';
import { authenticate } from '../middleware/auth.middleware';
import { orgContext } from '../middleware/orgContext.middleware';

export const matchRoutes = Router();

// All match routes require authentication + org context
matchRoutes.use(authenticate);
matchRoutes.use(orgContext);

/**
 * GET /api/v1/matches
 * Get ranked list of best matches
 *
 * Returns contacts sorted by match score with the user.
 *
 * Query params:
 * - limit: number of results (default 20, max 100)
 * - minScore: minimum match score 0-100 (default 0)
 * - sector: filter by sector ID
 */
matchRoutes.get('/', matchController.getMatches.bind(matchController));

/**
 * GET /api/v1/matches/intersections/:contactId
 * Get intersection points with a contact
 *
 * Returns shared sectors, skills, interests, etc.
 * Must come before /:contactId to avoid route conflict.
 */
matchRoutes.get(
  '/intersections/:contactId',
  matchController.getIntersections.bind(matchController)
);

/**
 * GET /api/v1/matches/:contactId
 * Get detailed match analysis for a contact
 *
 * Returns:
 * - Overall match score
 * - Score breakdown by category
 * - Intersection points
 * - AI-generated reasons (when available)
 * - Suggested conversation opener
 */
matchRoutes.get('/:contactId', matchController.getMatchDetails.bind(matchController));

/**
 * POST /api/v1/matches/:contactId/recalculate
 * Recalculate match score for a contact
 *
 * Triggers a fresh calculation of the match score.
 * Useful after profile or contact updates.
 */
matchRoutes.post(
  '/:contactId/recalculate',
  matchController.recalculateScore.bind(matchController)
);

/**
 * GET /api/v1/recommendations/daily
 * Get daily recommendations
 *
 * Returns top contacts to reach out to today,
 * excluding recently contacted ones.
 *
 * Query params:
 * - count: number of recommendations (default 3, max 10)
 */
matchRoutes.get('/daily', matchController.getDailyRecommendations.bind(matchController));

/**
 * GET /api/v1/recommendations/followup
 * Get follow-up reminders
 *
 * Returns contacts that haven't been contacted recently.
 *
 * Query params:
 * - days: days threshold (default 30)
 */
matchRoutes.get('/followup', matchController.getFollowUpReminders.bind(matchController));

// ============================================
// FEEDBACK ENDPOINTS
// ============================================

/**
 * GET /api/v1/matches/feedback/summary
 * Get user's overall feedback summary
 *
 * Returns aggregated feedback stats (accept rate, reject rate, etc.)
 */
matchRoutes.get('/feedback/summary', matchController.getFeedbackSummary.bind(matchController));

/**
 * GET /api/v1/matches/analytics
 * Get match analytics and trends
 *
 * Returns analytics and score trends over time.
 *
 * Query params:
 * - days: number of days to analyze (default 30)
 */
matchRoutes.get('/analytics', matchController.getMatchAnalytics.bind(matchController));

/**
 * POST /api/v1/matches/:contactId/feedback
 * Record feedback on a match
 *
 * Body:
 * - action: ACCEPT | REJECT | SAVE | CONNECT | MESSAGE | HIDE (required)
 * - rating: 1-5 stars (optional)
 * - feedbackNote: text note (optional)
 * - source: where feedback was given (optional)
 */
matchRoutes.post('/:contactId/feedback', matchController.recordFeedback.bind(matchController));

/**
 * GET /api/v1/matches/:contactId/feedback
 * Get feedback stats for a contact
 *
 * Returns aggregated feedback score and history for the contact.
 */
matchRoutes.get('/:contactId/feedback', matchController.getFeedbackStats.bind(matchController));

/**
 * GET /api/v1/matches/:contactId/history
 * Get match history for a contact
 *
 * Returns historical match scores for tracking trends.
 *
 * Query params:
 * - limit: number of history entries (default 30)
 */
matchRoutes.get('/:contactId/history', matchController.getMatchHistory.bind(matchController));

export default matchRoutes;
