/**
 * Dashboard Routes
 *
 * Routes for dashboard statistics and data.
 *
 * @module presentation/routes/dashboard
 */

import { Router } from 'express';
import { dashboardController } from '../controllers/DashboardController.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { orgContext } from '../middleware/orgContext.middleware';

export const dashboardRoutes = Router();

// All dashboard routes require authentication + org context
dashboardRoutes.use(authenticate);
dashboardRoutes.use(orgContext);

/**
 * GET /api/v1/dashboard
 * Get complete dashboard data
 *
 * Query:
 * - period: 'week' | 'month' (default: 'week')
 *
 * Returns combined stats, health, goals, and recent activity.
 */
dashboardRoutes.get('/', dashboardController.getDashboard.bind(dashboardController));

/**
 * GET /api/v1/dashboard/stats
 * Get dashboard statistics with comparison
 *
 * Query:
 * - period: 'week' | 'month' (default: 'week')
 *
 * Returns contacts, matches, interactions stats with
 * comparison to previous period.
 */
dashboardRoutes.get('/stats', dashboardController.getStats.bind(dashboardController));

/**
 * GET /api/v1/dashboard/activity
 * Get activity timeline
 *
 * Query:
 * - limit: number (default: 20, max: 100)
 * - offset: number (default: 0)
 *
 * Returns recent activities including interactions
 * and contact additions.
 */
dashboardRoutes.get('/activity', dashboardController.getActivityTimeline.bind(dashboardController));

/**
 * GET /api/v1/dashboard/health
 * Get network health score
 *
 * Returns overall score and breakdown by:
 * - Diversity (sector coverage)
 * - Engagement (active contacts)
 * - Growth (weekly/monthly rates)
 * - Quality (match scores, enrichment)
 */
dashboardRoutes.get('/health', dashboardController.getNetworkHealth.bind(dashboardController));

/**
 * GET /api/v1/dashboard/goals
 * Get weekly goals progress
 *
 * Returns progress on:
 * - Weekly connections
 * - Follow-ups completed
 * - Meetings scheduled
 */
dashboardRoutes.get('/goals', dashboardController.getGoalsProgress.bind(dashboardController));

/**
 * GET /api/v1/dashboard/charts
 * Get chart data for visualizations
 *
 * Query:
 * - days: number (default: 30, max: 90)
 *
 * Returns data for:
 * - Contacts over time
 * - Matches over time
 * - Interactions over time
 * - Interactions by type
 * - Contacts by sector
 * - Match score distribution
 */
dashboardRoutes.get('/charts', dashboardController.getChartData.bind(dashboardController));

export default dashboardRoutes;
