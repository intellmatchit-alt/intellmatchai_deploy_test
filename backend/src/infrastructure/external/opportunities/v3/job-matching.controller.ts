/**
 * IntellMatch Job Matching Engine — Controller & Routes
 *
 * HTTP handlers + Express router for the Job Matching API.
 *
 * @module job-matching/job-matching.controller
 */

import { Request, Response, NextFunction, Router } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { JobMatchingService, createJobMatchingService } from './job-matching.service';
import { JobLLMService, createJobLLMService } from './job-llm.service';
import {
  FindJobMatchesRequest,
  JobMatchingConfig,
  DEFAULT_JOB_CONFIG,
  Seniority,
  WorkMode,
  EmploymentType,
} from './job-matching.types';

// ============================================================================
// CONTROLLER
// ============================================================================

export class JobMatchingController {
  private readonly service: JobMatchingService;
  private readonly llm: JobLLMService;

  constructor(service: JobMatchingService, llm?: JobLLMService) {
    this.service = service;
    this.llm = llm || createJobLLMService();
  }

  /** POST /jobs/:jobId/matches */
  findMatches = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) { res.status(400).json({ success: false, error: { code: 'VALIDATION', details: errors.array() } }); return; }

      const userId = (req as any).user?.id;
      if (!userId) { res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED' } }); return; }

      const { jobId } = req.params;
      const { limit = 50, offset = 0, includeAI = true, includeExplanations = true, filters } = req.body;

      const request: FindJobMatchesRequest = {
        jobId,
        limit: Math.min(limit, 100),
        offset,
        includeAI,
        includeExplanations,
        filters,
      };

      const result = await this.service.findMatches(request);
      res.json({ success: true, data: result, meta: { timestamp: new Date().toISOString(), processingTimeMs: result.processingTimeMs } });
    } catch (error) { next(error); }
  };

  /** GET /jobs/:jobId/matches */
  getMatches = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { jobId } = req.params;
      const limit = parseInt(req.query.limit as string) || 50;
      const matches = await this.service.getMatches(jobId, limit);
      res.json({ success: true, data: { matches, total: matches.length } });
    } catch (error) { next(error); }
  };

  /** POST /jobs/extract-hiring — AI extraction from uploaded text */
  extractHiring = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { text } = req.body;
      if (!text || typeof text !== 'string') { res.status(400).json({ success: false, error: { code: 'MISSING_TEXT' } }); return; }
      const fields = await this.llm.extractHiringFields(text);
      res.json({ success: true, data: fields });
    } catch (error) { next(error); }
  };

  /** POST /jobs/extract-candidate — AI extraction from uploaded CV text */
  extractCandidate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { text } = req.body;
      if (!text || typeof text !== 'string') { res.status(400).json({ success: false, error: { code: 'MISSING_TEXT' } }); return; }
      const fields = await this.llm.extractCandidateFields(text);
      res.json({ success: true, data: fields });
    } catch (error) { next(error); }
  };

  /** GET /jobs/health */
  healthCheck = async (_req: Request, res: Response): Promise<void> => {
    // Expose the new 20-point band system for monitoring and health checks.
    const bandString = 'POOR 0-20 | WEAK 21-40 | GOOD 41-60 | VERY_GOOD 61-80 | EXCELLENT 81-100';
    res.json({ success: true, data: { status: 'healthy', engine: 'job-matching', version: '2.2.0', bands: bandString } });
  };
}

// ============================================================================
// VALIDATION
// ============================================================================

export const findMatchesValidation = [
  param('jobId').isString().notEmpty(),
  body('limit').optional().isInt({ min: 1, max: 100 }),
  body('offset').optional().isInt({ min: 0 }),
  body('includeAI').optional().isBoolean(),
  body('includeExplanations').optional().isBoolean(),
  body('filters').optional().isObject(),
];

// ============================================================================
// ROUTER FACTORY
// ============================================================================

export interface JobMatchingRouterOptions {
  prisma: any;
  config?: JobMatchingConfig;
  authMiddleware?: any;
}

export function createJobMatchingRoutes(options: JobMatchingRouterOptions): Router {
  const router = Router();
  const service = createJobMatchingService(options.prisma, options.config);
  const llm = createJobLLMService();
  const controller = new JobMatchingController(service, llm);

  router.get('/health', controller.healthCheck);

  if (options.authMiddleware) router.use(options.authMiddleware);

  router.post('/:jobId/matches', ...findMatchesValidation, controller.findMatches);
  router.get('/:jobId/matches', controller.getMatches);
  router.post('/extract-hiring', controller.extractHiring);
  router.post('/extract-candidate', controller.extractCandidate);

  return router;
}

// ============================================================================
// FACTORY
// ============================================================================

export function createJobMatchingController(prisma: any, config?: JobMatchingConfig): JobMatchingController {
  const service = createJobMatchingService(prisma, config);
  return new JobMatchingController(service);
}
