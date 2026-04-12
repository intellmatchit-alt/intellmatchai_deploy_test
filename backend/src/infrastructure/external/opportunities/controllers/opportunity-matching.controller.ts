/**
 * Opportunity Matching Controller
 *
 * HTTP handlers for opportunity matching API.
 * Features:
 * - Structured error handling
 * - Input validation
 * - Proper HTTP status codes
 * - Consistent response format
 *
 * @module controllers/opportunity-matching.controller
 */

import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { logger } from '../../../../shared/logger';
import { prisma } from '../../../database/prisma/client';
import {
  MatchingConfig,
  DEFAULT_MATCHING_CONFIG,
  MatchResult,
  MatchLevel,
} from '../types/opportunity-matching.types';
import { createOpportunityMatchingService } from '../services/opportunity-matching.service';
import {
  enqueueOpportunityMatching,
  getJobStatus as getWorkerJobStatus,
  cancelJob as cancelWorkerJob,
  getWorkerHealth,
} from '../workers/opportunity-matching.worker';

// ============================================================================
// Types
// ============================================================================

interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;
    email: string;
    id?: string;
    organizationId?: string;
  };
}

interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  meta?: {
    total?: number;
    limit?: number;
    offset?: number;
    processingTime?: number;
  };
}

// ============================================================================
// Controller Class
// ============================================================================

export class OpportunityMatchingController {
  private prisma: PrismaClient;

  constructor() {
    this.prisma = prisma;
  }

  // ============================================================================
  // Matching Endpoints
  // ============================================================================

  /**
   * Find matches for user's active intent
   * POST /api/opportunities/match
   */
  async findMatches(req: AuthenticatedRequest, res: Response): Promise<void> {
    const startTime = Date.now();
    const userId = req.user?.userId;

    if (!userId) {
      this.sendError(res, 401, 'UNAUTHORIZED', 'Authentication required');
      return;
    }

    try {
      const { async: isAsync, config: configOverrides } = req.body;

      // If async requested, submit job instead
      if (isAsync) {
        await this.submitAsyncMatching(req, res);
        return;
      }

      const config: Partial<MatchingConfig> = {
        ...DEFAULT_MATCHING_CONFIG,
        ...configOverrides,
      };

      const service = createOpportunityMatchingService(this.prisma, config);
      const matches = await service.findMatchesForIntent(
        userId,
        undefined,
        req.user?.organizationId
      );

      const processingTime = Date.now() - startTime;

      logger.info('Matches found', {
        userId,
        matchCount: matches.length,
        processingTime,
      });

      this.sendSuccess(res, {
        matches: this.formatMatchResults(matches),
        summary: this.generateMatchSummary(matches),
      }, { processingTime });
    } catch (error) {
      this.handleError(res, error, 'findMatches');
    }
  }

  /**
   * Find matches for a specific intent
   * POST /api/opportunities/match/:intentId
   */
  async findMatchesForIntent(req: AuthenticatedRequest, res: Response): Promise<void> {
    const startTime = Date.now();
    const userId = req.user?.userId;
    const { intentId } = req.params;

    if (!userId) {
      this.sendError(res, 401, 'UNAUTHORIZED', 'Authentication required');
      return;
    }

    try {
      // Verify intent belongs to user
      const intent = await this.prisma.opportunityIntent.findFirst({
        where: { id: intentId, userId },
      });

      if (!intent) {
        this.sendError(res, 404, 'INTENT_NOT_FOUND', 'Intent not found or access denied');
        return;
      }

      const { async: isAsync, config: configOverrides } = req.body;

      if (isAsync) {
        const jobId = await enqueueOpportunityMatching({
          userId,
          intentId,
          organizationId: req.user?.organizationId,
          config: configOverrides,
        });

        this.sendSuccess(res, {
          jobId,
          status: 'PENDING',
          message: 'Matching job submitted',
        });
        return;
      }

      const config: Partial<MatchingConfig> = {
        ...DEFAULT_MATCHING_CONFIG,
        ...configOverrides,
      };

      const service = createOpportunityMatchingService(this.prisma, config);
      const matches = await service.findMatchesForIntent(
        userId,
        intentId,
        req.user?.organizationId
      );

      const processingTime = Date.now() - startTime;

      this.sendSuccess(res, {
        matches: this.formatMatchResults(matches),
        summary: this.generateMatchSummary(matches),
      }, { processingTime });
    } catch (error) {
      this.handleError(res, error, 'findMatchesForIntent');
    }
  }

  /**
   * Submit async matching job
   * POST /api/opportunities/match/async
   */
  async submitAsyncMatching(req: AuthenticatedRequest, res: Response): Promise<void> {
    const userId = req.user?.userId;

    if (!userId) {
      this.sendError(res, 401, 'UNAUTHORIZED', 'Authentication required');
      return;
    }

    try {
      const { intentId, config: configOverrides, priority } = req.body;

      // If intentId provided, verify ownership
      if (intentId) {
        const intent = await this.prisma.opportunityIntent.findFirst({
          where: { id: intentId, userId },
        });

        if (!intent) {
          this.sendError(res, 404, 'INTENT_NOT_FOUND', 'Intent not found or access denied');
          return;
        }
      }

      // Get active intent if not specified
      let targetIntentId = intentId;
      if (!targetIntentId) {
        const activeIntent = await (this.prisma.opportunityIntent as any).findFirst({
          where: { userId, isActive: true },
        });

        if (!activeIntent) {
          this.sendError(res, 400, 'NO_ACTIVE_INTENT', 'No active opportunity intent found');
          return;
        }

        targetIntentId = activeIntent.id;
      }

      const jobId = await enqueueOpportunityMatching({
        userId,
        intentId: targetIntentId,
        organizationId: req.user?.organizationId,
        config: configOverrides,
        priority,
      });

      logger.info('Async matching job submitted', {
        userId,
        intentId: targetIntentId,
        jobId,
      });

      res.status(202).json({
        success: true,
        data: {
          jobId,
          intentId: targetIntentId,
          status: 'PENDING',
          message: 'Matching job submitted successfully',
        },
      });
    } catch (error) {
      this.handleError(res, error, 'submitAsyncMatching');
    }
  }

  /**
   * Get async job status
   * GET /api/opportunities/match/job/:jobId
   */
  async getJobStatus(req: AuthenticatedRequest, res: Response): Promise<void> {
    const userId = req.user?.userId;
    const { jobId } = req.params;

    if (!userId) {
      this.sendError(res, 401, 'UNAUTHORIZED', 'Authentication required');
      return;
    }

    try {
      const status = await getWorkerJobStatus(jobId);

      if (status.status === 'unknown') {
        this.sendError(res, 404, 'JOB_NOT_FOUND', 'Job not found');
        return;
      }

      // Map status to API response
      const mappedStatus = this.mapJobStatus(status.status);

      const response: any = {
        jobId,
        status: mappedStatus,
        progress: status.progress,
      };

      if (status.status === 'completed' && status.result) {
        response.result = {
          matchCount: status.result.matchCount,
          durationMs: status.result.durationMs,
        };
      }

      if (status.status === 'failed' && status.error) {
        response.error = status.error;
      }

      this.sendSuccess(res, response);
    } catch (error) {
      this.handleError(res, error, 'getJobStatus');
    }
  }

  /**
   * Cancel async job
   * DELETE /api/opportunities/match/job/:jobId
   */
  async cancelJob(req: AuthenticatedRequest, res: Response): Promise<void> {
    const userId = req.user?.userId;
    const { jobId } = req.params;

    if (!userId) {
      this.sendError(res, 401, 'UNAUTHORIZED', 'Authentication required');
      return;
    }

    try {
      const cancelled = await cancelWorkerJob(jobId);

      if (!cancelled) {
        this.sendError(res, 400, 'CANNOT_CANCEL', 'Job cannot be cancelled (already processing or completed)');
        return;
      }

      logger.info('Job cancelled', { userId, jobId });

      this.sendSuccess(res, {
        jobId,
        cancelled: true,
        message: 'Job cancelled successfully',
      });
    } catch (error) {
      this.handleError(res, error, 'cancelJob');
    }
  }

  // ============================================================================
  // Match Management Endpoints
  // ============================================================================

  /**
   * List matches for current user
   * GET /api/opportunities/matches
   */
  async listMatches(req: AuthenticatedRequest, res: Response): Promise<void> {
    const userId = req.user?.userId;

    if (!userId) {
      this.sendError(res, 401, 'UNAUTHORIZED', 'Authentication required');
      return;
    }

    try {
      const {
        intentId,
        status,
        matchLevel,
        limit = 20,
        offset = 0,
      } = req.query;

      const where: any = {
        intent: { userId },
      };

      if (intentId) where.intentId = intentId;
      if (status) where.status = status;
      if (matchLevel) where.matchLevel = matchLevel;

      const [matches, total] = await Promise.all([
        (this.prisma.opportunityMatch as any).findMany({
          where,
          include: {
            matchedUser: {
              select: {
                id: true,
                fullName: true,
                jobTitle: true,
                company: true,
                location: true,
              },
            },
            matchedContact: {
              select: {
                id: true,
                fullName: true,
                jobTitle: true,
                company: true,
                location: true,
              },
            },
          },
          orderBy: { matchScore: 'desc' },
          take: Number(limit),
          skip: Number(offset),
        }),
        (this.prisma.opportunityMatch as any).count({ where }),
      ]);

      this.sendSuccess(res, {
        matches: matches.map((m: any) => this.formatStoredMatch(m)),
      }, {
        total,
        limit: Number(limit),
        offset: Number(offset),
      });
    } catch (error) {
      this.handleError(res, error, 'listMatches');
    }
  }

  /**
   * Get match details
   * GET /api/opportunities/matches/:matchId
   */
  async getMatch(req: AuthenticatedRequest, res: Response): Promise<void> {
    const userId = req.user?.userId;
    const { matchId } = req.params;

    if (!userId) {
      this.sendError(res, 401, 'UNAUTHORIZED', 'Authentication required');
      return;
    }

    try {
      const match = await (this.prisma.opportunityMatch as any).findFirst({
        where: {
          id: matchId,
          intent: { userId },
        },
        include: {
          matchedUser: true,
          matchedContact: true,
          intent: true,
        },
      });

      if (!match) {
        this.sendError(res, 404, 'MATCH_NOT_FOUND', 'Match not found or access denied');
        return;
      }

      this.sendSuccess(res, { match: this.formatStoredMatch(match) });
    } catch (error) {
      this.handleError(res, error, 'getMatch');
    }
  }

  /**
   * Update match status
   * PATCH /api/opportunities/matches/:matchId
   */
  async updateMatch(req: AuthenticatedRequest, res: Response): Promise<void> {
    const userId = req.user?.userId;
    const { matchId } = req.params;

    if (!userId) {
      this.sendError(res, 401, 'UNAUTHORIZED', 'Authentication required');
      return;
    }

    try {
      // Verify ownership
      const existing = await (this.prisma.opportunityMatch as any).findFirst({
        where: {
          id: matchId,
          intent: { userId },
        },
      });

      if (!existing) {
        this.sendError(res, 404, 'MATCH_NOT_FOUND', 'Match not found or access denied');
        return;
      }

      const { status, notes } = req.body;

      const updated = await (this.prisma.opportunityMatch as any).update({
        where: { id: matchId },
        data: {
          ...(status && { status }),
          ...(notes !== undefined && { notes }),
          updatedAt: new Date(),
        },
      });

      logger.info('Match updated', { userId, matchId, status });

      this.sendSuccess(res, { match: this.formatStoredMatch(updated) });
    } catch (error) {
      this.handleError(res, error, 'updateMatch');
    }
  }

  // ============================================================================
  // Stats & Health Endpoints
  // ============================================================================

  /**
   * Get matching statistics
   * GET /api/opportunities/stats/:intentId
   */
  async getStats(req: AuthenticatedRequest, res: Response): Promise<void> {
    const userId = req.user?.userId;
    const { intentId } = req.params;

    if (!userId) {
      this.sendError(res, 401, 'UNAUTHORIZED', 'Authentication required');
      return;
    }

    try {
      // Verify ownership
      const intent = await this.prisma.opportunityIntent.findFirst({
        where: { id: intentId, userId },
      });

      if (!intent) {
        this.sendError(res, 404, 'INTENT_NOT_FOUND', 'Intent not found or access denied');
        return;
      }

      const service = createOpportunityMatchingService(this.prisma);
      const stats = await service.getMatchingStats(intentId);

      this.sendSuccess(res, { stats });
    } catch (error) {
      this.handleError(res, error, 'getStats');
    }
  }

  /**
   * Get system health
   * GET /api/opportunities/health
   */
  async getHealth(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const workerHealth = await getWorkerHealth();

      this.sendSuccess(res, {
        status: workerHealth.isRunning ? 'healthy' : 'degraded',
        worker: workerHealth,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      this.handleError(res, error, 'getHealth');
    }
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  private formatMatchResults(matches: MatchResult[]): any[] {
    return matches.map(m => ({
      candidateId: m.candidateId,
      candidateType: m.candidateType,
      candidateName: m.candidateName,
      candidateTitle: m.candidateTitle,
      candidateCompany: m.candidateCompany,
      score: m.score,
      confidence: m.confidence,
      matchLevel: m.matchLevel,
      hardFilterStatus: m.hardFilterStatus,
      keyStrengths: m.keyStrengths,
      keyRisks: m.keyRisks,
      missingRequiredSkills: m.missingRequiredSkills,
      explanation: m.explanation,
      suggestedAction: m.suggestedAction,
      suggestedMessage: m.suggestedMessage,
      nextSteps: m.nextSteps,
      sharedSectors: m.sharedSectors,
      sharedSkills: m.sharedSkills,
      aiValidated: m.aiValidated,
    }));
  }

  private formatStoredMatch(match: any): any {
    const candidate = match.matchedUser || match.matchedContact;

    return {
      id: match.id,
      candidateId: candidate?.id,
      candidateName: candidate?.fullName,
      candidateTitle: candidate?.jobTitle,
      candidateCompany: candidate?.company,
      score: match.matchScore,
      matchLevel: match.matchLevel,
      confidence: match.confidence,
      status: match.status,
      reasons: match.reasons,
      suggestedAction: match.suggestedAction,
      suggestedMessage: match.suggestedMessage,
      nextSteps: match.nextSteps,
      sharedSectors: match.sharedSectors,
      sharedSkills: match.sharedSkills,
      createdAt: match.createdAt,
      updatedAt: match.updatedAt,
    };
  }

  private generateMatchSummary(matches: MatchResult[]): any {
    const byLevel: Record<MatchLevel, number> = {
      [MatchLevel.EXCELLENT]: 0,
      [MatchLevel.VERY_GOOD]: 0,
      [MatchLevel.GOOD]: 0,
      [MatchLevel.WEAK]: 0,
      [MatchLevel.POOR]: 0,
    };

    let totalScore = 0;
    for (const match of matches) {
      byLevel[match.matchLevel]++;
      totalScore += match.score;
    }

    return {
      total: matches.length,
      byMatchLevel: byLevel,
      averageScore: matches.length > 0 ? Math.round(totalScore / matches.length) : 0,
      topScore: matches.length > 0 ? matches[0].score : 0,
    };
  }

  private mapJobStatus(status: string): string {
    const mapping: Record<string, string> = {
      waiting: 'PENDING',
      delayed: 'PENDING',
      active: 'PROCESSING',
      completed: 'COMPLETED',
      failed: 'FAILED',
    };
    return mapping[status] || 'UNKNOWN';
  }

  private sendSuccess(res: Response, data: any, meta?: any): void {
    const response: ApiResponse = { success: true, data };
    if (meta) response.meta = meta;
    res.json(response);
  }

  private sendError(res: Response, status: number, code: string, message: string, details?: any): void {
    const response: ApiResponse = {
      success: false,
      error: { code, message },
    };
    if (details) response.error!.details = details;
    res.status(status).json(response);
  }

  private handleError(res: Response, error: unknown, operation: string): void {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;

    logger.error(`Controller error: ${operation}`, {
      operation,
      error: errorMessage,
      stack: errorStack,
    });

    if (errorMessage.includes('not found')) {
      this.sendError(res, 404, 'NOT_FOUND', errorMessage);
    } else if (errorMessage.includes('unauthorized') || errorMessage.includes('access denied')) {
      this.sendError(res, 403, 'FORBIDDEN', errorMessage);
    } else {
      this.sendError(res, 500, 'INTERNAL_ERROR', 'An unexpected error occurred');
    }
  }
}
