/**
 * IntellMatch Project Matching Engine — Controller & Routes
 *
 * Routes:
 *   POST /projects/:projectId/matches    — Find counterpart contacts
 *   GET  /projects/:projectId/matches    — Retrieve saved matches
 *   POST /projects/extract               — AI extraction from project doc
 *   GET  /projects/health                — Health check
 *   GET  /projects/meta/stages           — List project stages
 *   GET  /projects/meta/counterpart-types — List counterpart types
 *   GET  /projects/meta/intents          — List project intents
 */

import { Request, Response, NextFunction, Router } from 'express';
import { body, param, validationResult } from 'express-validator';
import { ProjectMatchingService } from './project-matching.service';
import { ProjectLLMService } from './project-llm.service';
import {
  AuthContext, FindProjectMatchesRequest, ProjectMatchingConfig,
  DEFAULT_PROJECT_CONFIG, ProjectIntent, ProjectStage, CounterpartType,
} from './project-matching.types';

function extractAuth(req: Request): AuthContext | null {
  const userId = (req as any).user?.id;
  return userId ? { userId, organizationId: (req as any).user?.organizationId } : null;
}

export class ProjectMatchingController {
  constructor(
    private readonly service: ProjectMatchingService,
    private readonly llm?: ProjectLLMService,
  ) {}

  findMatches = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) { res.status(400).json({ success: false, error: { code: 'VALIDATION', details: errors.array() } }); return; }
      const auth = extractAuth(req);
      if (!auth) { res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED' } }); return; }

      const request: FindProjectMatchesRequest = {
        projectId: req.params.projectId,
        intent: req.body.intent,
        limit: Math.min(Number(req.body.limit ?? 50), 100),
        offset: Math.max(Number(req.body.offset ?? 0), 0),
        includeAI: req.body.includeAI ?? true,
        includeExplanations: req.body.includeExplanations ?? true,
        filters: req.body.filters,
      };
      const result = await this.service.findMatches(auth, request);
      res.json({ success: true, data: result, meta: { timestamp: new Date().toISOString(), processingTimeMs: result.processingTimeMs } });
    } catch (error) { next(error); }
  };

  getMatches = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const auth = extractAuth(req);
      if (!auth) { res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED' } }); return; }
      const limit = Math.min(Number(req.query.limit ?? 50), 100);
      const matches = await this.service.getMatches(auth, req.params.projectId, limit);
      res.json({ success: true, data: { matches, total: matches.length } });
    } catch (error) { next(error); }
  };

  extractProject = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { text } = req.body;
      if (!text || typeof text !== 'string') { res.status(400).json({ success: false, error: { code: 'MISSING_TEXT', message: 'text field required' } }); return; }
      if (this.llm) {
        const fields = await this.llm.extractProjectFields(text);
        res.json({ success: true, data: fields });
      } else {
        res.json({ success: true, data: {} });
      }
    } catch (error) { next(error); }
  };

  getStages = async (_req: Request, res: Response): Promise<void> => {
    res.json({ success: true, data: Object.values(ProjectStage).map(v => ({ value: v, label: v.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) })) });
  };

  getCounterpartTypes = async (_req: Request, res: Response): Promise<void> => {
    const labels: Record<string, string> = {
      INVESTOR: 'Investor', ADVISOR: 'Advisor', SERVICE_PROVIDER: 'Service Provider',
      PARTNER: 'Partner', COFOUNDER: 'Co-founder', TALENT: 'Talent / Team Member',
    };
    res.json({ success: true, data: Object.values(CounterpartType).map(v => ({ value: v, label: labels[v] || v })) });
  };

  getIntents = async (_req: Request, res: Response): Promise<void> => {
    const labels: Record<string, string> = {
      FIND_INVESTOR: 'Find Investor', FIND_ADVISOR: 'Find Advisor',
      FIND_SERVICE_PROVIDER: 'Find Service Provider', FIND_PARTNER: 'Find Partner',
      FIND_COFOUNDER: 'Find Co-founder', FIND_TALENT: 'Find Talent',
    };
    res.json({ success: true, data: Object.values(ProjectIntent).map(v => ({ value: v, label: labels[v] || v })) });
  };

  healthCheck = async (_req: Request, res: Response): Promise<void> => {
    res.json({
      success: true, data: {
        status: 'healthy', engine: 'project-matching', version: '2.0.0',
        bands: 'WEAK 0-39 | PARTIAL 40-54 | GOOD 55-69 | VERY_GOOD 70-84 | EXCELLENT 85-100',
        flow: 'PROJECT_TO_COUNTERPART_CONTACTS',
        intents: ['FIND_INVESTOR', 'FIND_ADVISOR', 'FIND_SERVICE_PROVIDER', 'FIND_PARTNER', 'FIND_COFOUNDER', 'FIND_TALENT'],
        networkScoped: true,
      },
    });
  };
}

const matchBodyValidation = [
  param('projectId').isString().notEmpty(),
  body('intent').isString().notEmpty(),
  body('limit').optional().isInt({ min: 1, max: 100 }),
  body('offset').optional().isInt({ min: 0 }),
  body('includeAI').optional().isBoolean(),
  body('includeExplanations').optional().isBoolean(),
  body('filters').optional().isObject(),
];

export interface ProjectMatchingRouterOptions { prisma: any; config?: ProjectMatchingConfig; authMiddleware?: any; llmService?: ProjectLLMService; }

export function createProjectMatchingRoutes(options: ProjectMatchingRouterOptions): Router {
  const router = Router();
  const service = new ProjectMatchingService(options.prisma, options.config || DEFAULT_PROJECT_CONFIG, options.llmService);
  const controller = new ProjectMatchingController(service, options.llmService);

  router.get('/health', controller.healthCheck);
  router.get('/meta/stages', controller.getStages);
  router.get('/meta/counterpart-types', controller.getCounterpartTypes);
  router.get('/meta/intents', controller.getIntents);

  if (options.authMiddleware) router.use(options.authMiddleware);

  router.post('/:projectId/matches', ...matchBodyValidation, controller.findMatches);
  router.get('/:projectId/matches', controller.getMatches);
  router.post('/extract', controller.extractProject);

  return router;
}

export function createProjectMatchingController(prisma: any, config?: ProjectMatchingConfig): ProjectMatchingController {
  return new ProjectMatchingController(new ProjectMatchingService(prisma, config || DEFAULT_PROJECT_CONFIG));
}
