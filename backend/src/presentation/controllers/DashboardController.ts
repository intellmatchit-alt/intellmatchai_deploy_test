/**
 * Dashboard Controller
 *
 * Handles HTTP requests for dashboard-related endpoints.
 *
 * @module presentation/controllers/DashboardController
 */

import { Request, Response, NextFunction } from 'express';
import { dashboardService, ComparisonPeriod } from '../../infrastructure/services/DashboardService.js';
import { AuthenticationError } from '../../shared/errors/index.js';
import { logger } from '../../shared/logger/index.js';

/**
 * Dashboard Controller
 *
 * Provides HTTP handlers for dashboard operations.
 */
export class DashboardController {
  /**
   * Parse custom date range from query params
   */
  private parseCustomDates(req: Request): { from?: Date; to?: Date } {
    const fromStr = req.query.from as string;
    const toStr = req.query.to as string;
    const from = fromStr ? new Date(fromStr) : undefined;
    const to = toStr ? new Date(toStr) : undefined;
    return {
      from: from && !isNaN(from.getTime()) ? from : undefined,
      to: to && !isNaN(to.getTime()) ? to : undefined,
    };
  }

  /**
   * Get dashboard statistics with comparison
   *
   * GET /api/v1/dashboard/stats
   *
   * Query params:
   * - period: 'week' | 'month' | 'custom' (default: 'week')
   * - from: ISO date string (required when period=custom)
   * - to: ISO date string (required when period=custom)
   */
  async getStats(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AuthenticationError('Authentication required');
      }

      const period = (req.query.period as ComparisonPeriod) || 'week';
      const orgId = req.orgContext?.organizationId || null;
      const { from, to } = this.parseCustomDates(req);

      logger.debug('Fetching dashboard stats', {
        userId: req.user.userId,
        period,
        orgId,
        from,
        to,
      });

      const stats = await dashboardService.getStats(req.user.userId, period, orgId, from, to);

      res.status(200).json({
        success: true,
        data: stats,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get activity timeline
   *
   * GET /api/v1/dashboard/activity
   *
   * Query params:
   * - limit: number (default: 20)
   * - offset: number (default: 0)
   */
  async getActivityTimeline(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AuthenticationError('Authentication required');
      }

      const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
      const offset = parseInt(req.query.offset as string) || 0;
      const orgId = req.orgContext?.organizationId || null;

      logger.debug('Fetching activity timeline', {
        userId: req.user.userId,
        limit,
        offset,
        orgId,
      });

      const activities = await dashboardService.getActivityTimeline(
        req.user.userId,
        limit,
        offset,
        orgId
      );

      res.status(200).json({
        success: true,
        data: activities,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get network health score
   *
   * GET /api/v1/dashboard/health
   */
  async getNetworkHealth(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AuthenticationError('Authentication required');
      }

      const orgId = req.orgContext?.organizationId || null;

      logger.debug('Fetching network health', {
        userId: req.user.userId,
        orgId,
      });

      const health = await dashboardService.getNetworkHealth(req.user.userId, orgId);

      res.status(200).json({
        success: true,
        data: health,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get weekly goals progress
   *
   * GET /api/v1/dashboard/goals
   */
  async getGoalsProgress(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AuthenticationError('Authentication required');
      }

      const orgId = req.orgContext?.organizationId || null;

      logger.debug('Fetching goals progress', {
        userId: req.user.userId,
        orgId,
      });

      const goals = await dashboardService.getGoalsProgress(req.user.userId, orgId);

      res.status(200).json({
        success: true,
        data: goals,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get chart data for visualizations
   *
   * GET /api/v1/dashboard/charts
   *
   * Query params:
   * - days: number (default: 30, max: 90)
   */
  async getChartData(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AuthenticationError('Authentication required');
      }

      const days = Math.min(parseInt(req.query.days as string) || 30, 90);
      const orgId = req.orgContext?.organizationId || null;

      logger.debug('Fetching chart data', {
        userId: req.user.userId,
        days,
        orgId,
      });

      const charts = await dashboardService.getChartData(req.user.userId, days, orgId);

      res.status(200).json({
        success: true,
        data: charts,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get complete dashboard data (combined endpoint)
   *
   * GET /api/v1/dashboard
   *
   * Query params:
   * - period: 'week' | 'month' | 'custom' (default: 'week')
   * - from: ISO date string (required when period=custom)
   * - to: ISO date string (required when period=custom)
   */
  async getDashboard(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AuthenticationError('Authentication required');
      }

      const period = (req.query.period as ComparisonPeriod) || 'week';
      const orgId = req.orgContext?.organizationId || null;
      const { from, to } = this.parseCustomDates(req);

      logger.debug('Fetching complete dashboard', {
        userId: req.user.userId,
        period,
        orgId,
        from,
        to,
      });

      // Fetch all data in parallel
      const [stats, health, goals, recentActivity] = await Promise.all([
        dashboardService.getStats(req.user.userId, period, orgId, from, to),
        dashboardService.getNetworkHealth(req.user.userId, orgId),
        dashboardService.getGoalsProgress(req.user.userId, orgId),
        dashboardService.getActivityTimeline(req.user.userId, 5, 0, orgId),
      ]);

      res.status(200).json({
        success: true,
        data: {
          stats,
          health,
          goals,
          recentActivity,
        },
      });
    } catch (error) {
      next(error);
    }
  }
}

// Export singleton instance
export const dashboardController = new DashboardController();
