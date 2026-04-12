/**
 * IntellMatch Pitch Matching Engine — Controller & Routes
 * v8.0.0 — production-hardened
 */

import { Request, Response, NextFunction, Router } from 'express';
import { body, param, validationResult } from 'express-validator';
import { PitchMatchingService, createPitchMatchingService } from './pitch-matching.service';
import { PitchLLMService, createPitchLLMService } from './pitch-llm.service';
import {
  BusinessModel, DEFAULT_PITCH_CONFIG, FindPitchMatchesRequest, MatchIntent,
  PitchMatchingConfig, PitchStage, AuthContext,
} from './pitch-matching.types';

const VALID_INTENTS = new Set(Object.values(MatchIntent));
const VALID_STAGES = new Set(Object.values(PitchStage));
const VALID_MODELS = new Set(Object.values(BusinessModel));

function extractAuth(req: Request): AuthContext | null {
  const userId = (req as any).user?.id;
  if (!userId) return null;
  return { userId, organizationId: (req as any).user?.organizationId };
}

export class PitchMatchingController {
  private readonly service: PitchMatchingService;
  private readonly llm: PitchLLMService;

  constructor(service: PitchMatchingService, llm?: PitchLLMService) {
    this.service = service;
    this.llm = llm || createPitchLLMService();
  }

  findMatches = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) { res.status(400).json({ success: false, error: { code: 'VALIDATION', details: errors.array() } }); return; }

      const auth = extractAuth(req);
      if (!auth) { res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED' } }); return; }

      const request: FindPitchMatchesRequest = {
        pitchId: req.params.pitchId,
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
      const limit = Number(req.query.limit ?? 50);
      const matches = await this.service.getMatches(auth, req.params.pitchId, Math.min(limit, 100));
      res.json({ success: true, data: { matches, total: matches.length } });
    } catch (error) { next(error); }
  };

  extractPitch = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const text = req.body?.text;
      if (!text || typeof text !== 'string') { res.status(400).json({ success: false, error: { code: 'MISSING_TEXT', message: 'Provide pitch deck text.' } }); return; }
      const fields = await this.llm.extractPitchFields(text);
      res.json({ success: true, data: fields });
    } catch (error) { next(error); }
  };

  getStages = async (_req: Request, res: Response): Promise<void> => {
    res.json({ success: true, data: Object.values(PitchStage).map(v => ({ value: v, label: v.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) })) });
  };

  getBusinessModels = async (_req: Request, res: Response): Promise<void> => {
    res.json({ success: true, data: Object.values(BusinessModel).map(v => ({ value: v, label: v })) });
  };

  getMatchIntents = async (_req: Request, res: Response): Promise<void> => {
    const labels: Record<MatchIntent, string> = {
      [MatchIntent.INVESTOR]: 'Investor', [MatchIntent.ADVISOR]: 'Advisor',
      [MatchIntent.STRATEGIC_PARTNER]: 'Strategic Partner', [MatchIntent.COFOUNDER]: 'Co-founder',
      [MatchIntent.CUSTOMER_BUYER]: 'Customer / Buyer',
    };
    res.json({ success: true, data: Object.values(MatchIntent).map(v => ({ value: v, label: labels[v] })) });
  };

  healthCheck = async (_req: Request, res: Response): Promise<void> => {
    res.json({
      success: true, data: {
        status: 'healthy', engine: 'pitch-matching', version: '8.0.0',
        bands: 'WEAK<40 | GOOD 40-59 | VERY_GOOD 60-74 | STRONG 75-89 | EXCELLENT 90-100',
        features: [
          'auth-scoped matching', 'effectiveRankScore gating', 'soft intent filtering',
          'multi-phase hybrid retrieval', 'bounded AI validation', 'per-intent scoring',
          'field-level semantic need-offer reranking', 'supportNeededTags integration',
          'AI reasoning exposure', 'tightened production thresholds',
        ],
      },
    });
  };
}

export const findPitchMatchesValidation = [
  param('pitchId').isString().notEmpty(),
  body('limit').optional().isInt({ min: 1, max: 100 }),
  body('offset').optional().isInt({ min: 0 }),
  body('includeAI').optional().isBoolean(),
  body('includeExplanations').optional().isBoolean(),
  body('filters').optional().isObject(),
  body('filters.intents').optional().isArray().custom((v: unknown[]) => { if (!Array.isArray(v)) return true; for (const i of v) if (!VALID_INTENTS.has(i as MatchIntent)) throw new Error(`Invalid intent: ${i}`); return true; }),
  body('filters.stages').optional().isArray().custom((v: unknown[]) => { if (!Array.isArray(v)) return true; for (const i of v) if (!VALID_STAGES.has(i as PitchStage)) throw new Error(`Invalid stage: ${i}`); return true; }),
  body('filters.businessModels').optional().isArray().custom((v: unknown[]) => { if (!Array.isArray(v)) return true; for (const i of v) if (!VALID_MODELS.has(i as BusinessModel)) throw new Error(`Invalid model: ${i}`); return true; }),
  body('filters.sectors').optional().isArray(),
  body('filters.geographies').optional().isArray(),
  body('filters.categories').optional().isArray(),
  body('filters.excludeContactIds').optional().isArray(),
];

export interface PitchMatchingRouterOptions { prisma: any; config?: PitchMatchingConfig; authMiddleware?: any; }

export function createPitchMatchingRoutes(options: PitchMatchingRouterOptions): Router {
  const router = Router();
  const service = createPitchMatchingService(options.prisma, options.config || DEFAULT_PITCH_CONFIG);
  const llm = createPitchLLMService();
  const controller = new PitchMatchingController(service, llm);

  router.get('/health', controller.healthCheck);
  router.get('/stages', controller.getStages);
  router.get('/business-models', controller.getBusinessModels);
  router.get('/match-intents', controller.getMatchIntents);

  if (options.authMiddleware) router.use(options.authMiddleware);
  router.post('/extract', controller.extractPitch);
  router.post('/:pitchId/matches', ...findPitchMatchesValidation, controller.findMatches);
  router.get('/:pitchId/matches', controller.getMatches);

  return router;
}

export function createPitchMatchingController(prisma: any, config?: PitchMatchingConfig): PitchMatchingController {
  return new PitchMatchingController(createPitchMatchingService(prisma, config || DEFAULT_PITCH_CONFIG));
}
