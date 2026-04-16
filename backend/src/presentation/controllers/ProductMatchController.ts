/**
 * Product Match Controller (Sell Smarter Feature)
 * Handles HTTP requests for Product Match operations
 */

import { Request, Response, NextFunction } from "express";
import { logger } from "../../shared/logger";

// Import repositories
import {
  PrismaProductProfileRepository,
  PrismaProductMatchRunRepository,
  PrismaProductMatchResultRepository,
  PrismaContactMatchingRepository,
} from "../../infrastructure/repositories/PrismaProductMatchRepository";

// Import services
import { ProductMatchingService } from "../../infrastructure/services/product/ProductMatchingService";
import {
  queueService,
  QueueName,
} from "../../infrastructure/queue/QueueService";

// Import use cases
import {
  UpsertProductProfileUseCase,
  GetProductProfileUseCase,
  StartProductMatchRunUseCase,
  GetProductMatchRunUseCase,
  GetProductMatchResultsUseCase,
  GetProductMatchContactDetailUseCase,
  UpdateProductMatchResultUseCase,
} from "../../application/use-cases/product-match";

import {
  ProductType,
  ProductMatchBadge,
} from "../../domain/entities/ProductMatch";

// Initialize repositories
const profileRepository = new PrismaProductProfileRepository();
const runRepository = new PrismaProductMatchRunRepository();
const resultRepository = new PrismaProductMatchResultRepository();
const contactMatchingRepository = new PrismaContactMatchingRepository();

// Initialize services
const productMatchingService = new ProductMatchingService();

// Initialize use cases
const upsertProfileUseCase = new UpsertProductProfileUseCase(profileRepository);
const getProfileUseCase = new GetProductProfileUseCase(profileRepository);
// Get the product matching queue for async processing
const productMatchQueue = queueService.getQueue(QueueName.PRODUCT_MATCHING);

const startMatchRunUseCase = new StartProductMatchRunUseCase(
  profileRepository,
  runRepository,
  resultRepository,
  contactMatchingRepository,
  productMatchingService,
  productMatchQueue, // Pass queue for async processing of large networks
);
const getMatchRunUseCase = new GetProductMatchRunUseCase(runRepository);
const getResultsUseCase = new GetProductMatchResultsUseCase(
  runRepository,
  resultRepository,
);
const getContactDetailUseCase = new GetProductMatchContactDetailUseCase(
  runRepository,
  resultRepository,
);
const updateResultUseCase = new UpdateProductMatchResultUseCase(
  runRepository,
  resultRepository,
);

/**
 * Get or create product profile
 * GET /api/v1/product-profile
 */
export async function getProductProfile(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = req.user!.userId;

    const profile = await getProfileUseCase.execute(userId);

    res.json({
      success: true,
      data: profile,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Upsert product profile
 * POST /api/v1/product-profile
 */
export async function upsertProductProfile(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = req.user!.userId;

    const input = {
      productType: req.body.productType as ProductType,
      productName: req.body.productName,
      targetIndustry: req.body.targetIndustry,
      targetCompanySize: req.body.targetCompanySize,
      problemSolved: req.body.problemSolved,
      decisionMakerRole: req.body.decisionMakerRole,
      additionalContext: req.body.additionalContext,
    };

    const profile = await upsertProfileUseCase.execute(userId, input);

    res.status(201).json({
      success: true,
      data: profile,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Start a new match run
 * POST /api/v1/product-match/runs
 */
export async function startMatchRun(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = req.user!.userId;

    const result = await startMatchRunUseCase.execute(userId);

    res.status(201).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get match run status
 * GET /api/v1/product-match/runs/:runId
 */
export async function getMatchRun(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = req.user!.userId;
    const runId = String(req.params.runId);

    const run = await getMatchRunUseCase.execute(userId, runId);

    res.json({
      success: true,
      data: {
        id: run.id,
        status: run.status,
        progress: run.progress,
        totalContacts: run.totalContacts,
        matchCount: run.matchCount,
        avgScore: run.avgScore,
        error: run.error,
        startedAt: run.startedAt?.toISOString() || null,
        completedAt: run.completedAt?.toISOString() || null,
        createdAt: run.createdAt.toISOString(),
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get latest match run for current user
 * GET /api/v1/product-match/runs/latest
 */
export async function getLatestMatchRun(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = req.user!.userId;

    const run = await getMatchRunUseCase.getLatest(userId);

    if (!run) {
      res.json({
        success: true,
        data: null,
      });
      return;
    }

    res.json({
      success: true,
      data: {
        id: run.id,
        status: run.status,
        progress: run.progress,
        totalContacts: run.totalContacts,
        matchCount: run.matchCount,
        avgScore: run.avgScore,
        error: run.error,
        startedAt: run.startedAt?.toISOString() || null,
        completedAt: run.completedAt?.toISOString() || null,
        createdAt: run.createdAt.toISOString(),
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get match results for a run
 * GET /api/v1/product-match/runs/:runId/results
 */
export async function getMatchResults(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = req.user!.userId;
    const runId = String(req.params.runId);

    const options = {
      badge: req.query.badge as ProductMatchBadge | undefined,
      minScore: req.query.minScore
        ? parseInt(req.query.minScore as string, 10)
        : undefined,
      excludeDismissed: req.query.excludeDismissed === "true",
      limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 20,
      offset: req.query.offset ? parseInt(req.query.offset as string, 10) : 0,
    };

    const result = await getResultsUseCase.execute(userId, runId, options);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get detailed match result for a contact
 * GET /api/v1/product-match/contacts/:contactId
 */
export async function getContactMatchDetail(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = req.user!.userId;
    const contactId = String(req.params.contactId);
    const runId = req.query.runId as string;

    if (!runId) {
      res.status(400).json({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "runId query parameter is required",
        },
      });
      return;
    }

    const result = await getContactDetailUseCase.execute(
      userId,
      contactId,
      runId,
    );

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Update match result (save, dismiss, contacted, edit message)
 * PATCH /api/v1/product-match/results/:resultId
 */
export async function updateMatchResult(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = req.user!.userId;
    const resultId = String(req.params.resultId);

    const input = {
      isSaved: req.body.isSaved,
      isDismissed: req.body.isDismissed,
      isContacted: req.body.isContacted,
      openerEdited: req.body.openerEdited,
    };

    const result = await updateResultUseCase.execute(userId, resultId, input);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}
