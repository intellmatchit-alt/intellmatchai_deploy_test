/**
 * Import Controller
 *
 * Handles HTTP requests for contact import operations.
 *
 * @module presentation/controllers/ImportController
 */

import { Request, Response, NextFunction } from "express";
import { logger } from "../../shared/logger/index.js";
import { InsufficientPointsError } from "../../shared/errors/InsufficientPointsError.js";
import { walletService } from "../../infrastructure/services/WalletService.js";
import { systemConfigService } from "../../infrastructure/services/SystemConfigService.js";
import { prisma } from "../../infrastructure/database/prisma/client.js";
import { getContactLimitForUser } from "../../shared/helpers/planLimits.js";
import {
  CreateImportBatchUseCase,
  UploadChunkUseCase,
  CommitBatchUseCase,
  GetBatchStatusUseCase,
  RollbackBatchUseCase,
  ListBatchesUseCase,
} from "../../application/use-cases/import/index.js";

// Initialize use cases
const createBatchUseCase = new CreateImportBatchUseCase();
const uploadChunkUseCase = new UploadChunkUseCase();
const commitBatchUseCase = new CommitBatchUseCase();
const getBatchStatusUseCase = new GetBatchStatusUseCase();
const rollbackBatchUseCase = new RollbackBatchUseCase();
const listBatchesUseCase = new ListBatchesUseCase();

/**
 * Create a new import batch
 * POST /api/v1/contacts/import/batches
 */
export async function createBatch(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = req.user!.userId;

    const input = {
      source: req.body.source,
      enrichmentEnabled: req.body.enrichmentEnabled,
      aiSummaryEnabled: req.body.aiSummaryEnabled,
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    };

    const result = await createBatchUseCase.execute(userId, input);

    res.status(201).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

/**
 * Upload a chunk of contacts
 * POST /api/v1/contacts/import/batches/:id/chunks
 */
export async function uploadChunk(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = req.user!.userId;
    const batchId = String(req.params.id);

    const input = {
      batchId,
      chunkIndex: req.body.chunkIndex || 0,
      contacts: req.body.contacts,
      isLastChunk: req.body.isLastChunk,
    };

    const result = await uploadChunkUseCase.execute(userId, input);

    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

/**
 * Commit a batch and start processing
 * POST /api/v1/contacts/import/batches/:id/commit
 */
export async function commitBatch(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = req.user!.userId;
    const batchId = String(req.params.id);

    // Check contact limit before committing
    const batch = await prisma.contactImportBatch.findUnique({
      where: { id: batchId },
    });
    if (batch) {
      const { limit, current, remaining } =
        await getContactLimitForUser(userId);
      const contactCount = batch.totalReceived;
      if (contactCount > remaining) {
        res.status(400).json({
          success: false,
          error: {
            code: "CONTACT_LIMIT_EXCEEDED",
            message: `Import would exceed your contact limit. You can import ${remaining} more contacts (${current}/${limit} used).`,
          },
        });
        return;
      }
    }

    // Check points cost before committing
    if (batch) {
      const contactCount = batch.totalReceived;
      const costPerContact = await systemConfigService.getNumber(
        "contact_upload_cost",
        2,
      );
      const totalCost = contactCount * costPerContact;

      if (totalCost > 0) {
        try {
          await walletService.debit(
            userId,
            totalCost,
            `Contact import (${contactCount} contacts)`,
            batchId,
            "IMPORT",
          );
        } catch (error) {
          if (error instanceof InsufficientPointsError) {
            res.status(402).json({
              success: false,
              error: {
                code: "INSUFFICIENT_POINTS",
                message: error.message,
                details: error.details,
              },
            });
            return;
          }
          throw error;
        }
      }
    }

    const result = await commitBatchUseCase.execute(userId, batchId);

    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

/**
 * Get batch status
 * GET /api/v1/contacts/import/batches/:id/status
 */
export async function getBatchStatus(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = req.user!.userId;
    const batchId = String(req.params.id);

    const result = await getBatchStatusUseCase.execute(userId, batchId);

    if (!result) {
      res.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: "Import batch not found" },
      });
      return;
    }

    // Transform to match frontend expected format
    const stages = [
      {
        name: "normalize",
        status: getStageStatus(result.currentStage, "normalize", result.status),
        progress:
          result.currentStage === "normalize"
            ? result.stageProgress
            : isStageComplete("normalize", result.currentStage)
              ? 100
              : 0,
      },
      {
        name: "dedupe",
        status: getStageStatus(result.currentStage, "dedupe", result.status),
        progress:
          result.currentStage === "dedupe"
            ? result.stageProgress
            : isStageComplete("dedupe", result.currentStage)
              ? 100
              : 0,
      },
      {
        name: "enrich",
        status: getStageStatus(result.currentStage, "enrich", result.status),
        progress:
          result.currentStage === "enrich"
            ? result.stageProgress
            : isStageComplete("enrich", result.currentStage)
              ? 100
              : 0,
      },
      {
        name: "tag",
        status: getStageStatus(result.currentStage, "tag", result.status),
        progress:
          result.currentStage === "tag"
            ? result.stageProgress
            : isStageComplete("tag", result.currentStage)
              ? 100
              : 0,
      },
      {
        name: "summary",
        status: getStageStatus(result.currentStage, "summary", result.status),
        progress:
          result.currentStage === "summary"
            ? result.stageProgress
            : isStageComplete("summary", result.currentStage)
              ? 100
              : 0,
      },
      {
        name: "match",
        status: getStageStatus(result.currentStage, "match", result.status),
        progress:
          result.currentStage === "match"
            ? result.stageProgress
            : isStageComplete("match", result.currentStage)
              ? 100
              : 0,
      },
    ];

    const batch = {
      id: result.batchId,
      userId,
      source: result.source,
      status: result.status,
      currentStage: result.currentStage,
      stageProgress: result.stageProgress,
      overallProgress: result.overallProgress,
      totalReceived: result.stats.totalReceived,
      totalImported: result.stats.totalImported,
      duplicatesMerged: result.stats.duplicatesMerged,
      enrichedCount: result.stats.enrichedCount,
      taggedCount: result.stats.taggedCount,
      summarizedCount: result.stats.summarizedCount,
      matchedCount: result.stats.matchedCount,
      failedCount: result.stats.failedCount,
      errorMessage: result.error,
      createdAt: result.createdAt,
      completedAt: result.completedAt,
    };

    res.json({ success: true, data: { batch, stages } });
  } catch (error) {
    next(error);
  }
}

// Helper function to determine stage status
function getStageStatus(
  currentStage: string | null,
  stageName: string,
  batchStatus: string,
): "pending" | "processing" | "completed" | "failed" {
  if (batchStatus === "FAILED") return "failed";
  if (batchStatus === "COMPLETED") return "completed";
  if (currentStage === stageName) return "processing";
  if (isStageComplete(stageName, currentStage)) return "completed";
  return "pending";
}

// Helper function to check if a stage is complete
function isStageComplete(
  stageName: string,
  currentStage: string | null,
): boolean {
  const stageOrder = [
    "normalize",
    "dedupe",
    "enrich",
    "tag",
    "summary",
    "match",
  ];
  if (!currentStage) return false;
  const stageIndex = stageOrder.indexOf(stageName);
  const currentIndex = stageOrder.indexOf(currentStage);
  return stageIndex < currentIndex;
}

/**
 * Rollback a batch
 * POST /api/v1/contacts/import/batches/:id/rollback
 */
export async function rollbackBatch(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = req.user!.userId;
    const batchId = String(req.params.id);

    const result = await rollbackBatchUseCase.execute(userId, batchId);

    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

/**
 * List all batches
 * GET /api/v1/contacts/import/batches
 */
export async function listBatches(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = req.user!.userId;

    const input = {
      page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
      limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 20,
      status: req.query.status as string | undefined,
    };

    const result = await listBatchesUseCase.execute(userId, input);

    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

export const importController = {
  createBatch,
  uploadChunk,
  commitBatch,
  getBatchStatus,
  rollbackBatch,
  listBatches,
};

export default importController;
