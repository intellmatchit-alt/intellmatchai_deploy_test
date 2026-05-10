/**
 * IntellMatch Job Matching Engine — Controller & Routes
 *
 * HTTP handlers + Express router for the Job Matching API.
 *
 * @module job-matching/job-matching.controller
 */

import { Request, Response, NextFunction, Router } from "express";
import { body, param, query, validationResult } from "express-validator";
import multer from "multer";
import {
  JobMatchingService,
  createJobMatchingService,
} from "./job-matching.service";
import { JobLLMService, createJobLLMService } from "./job-llm.service";
import {
  FindJobMatchesRequest,
  FindHelperMatchesRequest,
  JobMatchingConfig,
  DEFAULT_JOB_CONFIG,
  Seniority,
  WorkMode,
  EmploymentType,
} from "./job-matching.types";

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
  findMatches = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          error: { code: "VALIDATION", details: errors.array() },
        });
        return;
      }

      // Auth middleware attaches { userId, email } — accept either casing
      // for backward-compat with any caller still reading `id`.
      const userId = (req as any).user?.userId || (req as any).user?.id;
      if (!userId) {
        res
          .status(401)
          .json({ success: false, error: { code: "UNAUTHORIZED" } });
        return;
      }

      const { jobId } = req.params as { jobId: string };
      const {
        limit = 50,
        offset = 0,
        includeAI = true,
        includeExplanations = true,
        filters,
      } = req.body;

      const request: FindJobMatchesRequest = {
        jobId,
        limit: Math.min(limit, 100),
        offset,
        includeAI,
        includeExplanations,
        filters,
      };

      const result = await this.service.findMatches(request);
      res.json({
        success: true,
        data: result,
        meta: {
          timestamp: new Date().toISOString(),
          processingTimeMs: result.processingTimeMs,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * POST /jobs/candidates/:candidateProfileId/helpers
   *
   * Find people in the requester's network who can help a candidate reach
   * relevant job opportunities.
   *
   * Body (optional):
   *   - targetJobId: switches mode to TARGET_JOB_TO_HELPERS
   *   - limit, offset, includeAI, includeExplanations, filters
   */
  findHelpers = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          error: { code: "VALIDATION", details: errors.array() },
        });
        return;
      }

      const userId = (req as any).user?.id || (req as any).user?.userId;
      if (!userId) {
        res
          .status(401)
          .json({ success: false, error: { code: "UNAUTHORIZED" } });
        return;
      }

      const { candidateProfileId } = req.params as { candidateProfileId: string };
      const {
        targetJobId,
        limit = 50,
        offset = 0,
        includeAI = true,
        includeExplanations = true,
        filters,
      } = req.body || {};

      const request: FindHelperMatchesRequest = {
        candidateProfileId,
        requesterUserId: userId,
        targetJobId: targetJobId ?? null,
        limit: Math.min(limit, 100),
        offset,
        includeAI,
        includeExplanations,
        filters,
      };

      const result = await this.service.findHelpers(request);
      res.json({
        success: true,
        data: result,
        meta: {
          timestamp: new Date().toISOString(),
          processingTimeMs: result.processingTimeMs,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  /** GET /jobs/:jobId/matches */
  getMatches = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const { jobId } = req.params as { jobId: string };
      const limit = parseInt(req.query.limit as string) || 50;
      const matches = await this.service.getMatches(jobId, limit);
      res.json({ success: true, data: { matches, total: matches.length } });
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /jobs/candidates/:candidateProfileId/helpers
   *
   * Hydrates persisted helper-flow matches. When `targetJobId` query param
   * is omitted → returns OPEN_TO_OPPORTUNITY_TO_HELPERS rows. When present →
   * scopes to TARGET_JOB_TO_HELPERS rows for that job.
   */
  getHelperMatches = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const { candidateProfileId } = req.params as { candidateProfileId: string };
      const targetJobId =
        typeof req.query.targetJobId === "string" && req.query.targetJobId.length > 0
          ? req.query.targetJobId
          : null;
      const limit = parseInt(req.query.limit as string) || 50;
      const matches = await this.service.getHelperMatches(
        candidateProfileId,
        targetJobId,
        limit,
      );
      res.json({
        success: true,
        data: {
          matches,
          total: matches.length,
          candidateProfileId,
          targetJobId,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  /** POST /jobs/extract-hiring — AI extraction from uploaded text */
  extractHiring = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const { text } = req.body;
      if (!text || typeof text !== "string") {
        res
          .status(400)
          .json({ success: false, error: { code: "MISSING_TEXT" } });
        return;
      }
      const fields = await this.llm.extractHiringFields(text);
      res.json({ success: true, data: fields });
    } catch (error) {
      next(error);
    }
  };

  /** POST /jobs/extract-candidate — AI extraction from uploaded CV text */
  extractCandidate = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const { text } = req.body;
      if (!text || typeof text !== "string") {
        res
          .status(400)
          .json({ success: false, error: { code: "MISSING_TEXT" } });
        return;
      }
      const fields = await this.llm.extractCandidateFields(text);
      res.json({ success: true, data: fields });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Parse a multipart-uploaded PDF/DOCX/DOC/TXT file into plain text.
   * Mirrors the parsing used by other extract-document endpoints.
   */
  private async parseDocumentToText(file: Express.Multer.File): Promise<string> {
    let textContent = "";
    if (file.mimetype === "application/pdf") {
      const pdfParse = require("pdf-parse");
      const pdfData = await pdfParse(file.buffer);
      textContent = pdfData.text;
    } else if (
      file.mimetype ===
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      file.mimetype === "application/msword"
    ) {
      const mammoth = require("mammoth");
      const result = await mammoth.extractRawText({ buffer: file.buffer });
      textContent = result.value;
    } else if (file.mimetype === "text/plain") {
      textContent = file.buffer.toString("utf-8");
    } else {
      throw new Error(
        "Unsupported file format. Please upload PDF, DOCX, DOC, or TXT files.",
      );
    }
    return textContent
      .replace(/[ \t]+/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  /** POST /jobs/extract-hiring-document — AI extraction from uploaded job-description file */
  extractHiringDocument = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const file = (req as any).file as Express.Multer.File | undefined;
      if (!file) {
        res
          .status(400)
          .json({ success: false, error: { code: "MISSING_FILE" } });
        return;
      }
      const text = await this.parseDocumentToText(file);
      if (!text || text.length < 30) {
        res.status(400).json({
          success: false,
          error: {
            code: "INSUFFICIENT_TEXT",
            message: "Could not extract sufficient text from document.",
          },
        });
        return;
      }
      const fields = await this.llm.extractHiringFields(text);
      res.json({ success: true, data: fields });
    } catch (error) {
      next(error);
    }
  };

  /** POST /jobs/extract-candidate-document — AI extraction from uploaded CV file */
  extractCandidateDocument = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const file = (req as any).file as Express.Multer.File | undefined;
      if (!file) {
        res
          .status(400)
          .json({ success: false, error: { code: "MISSING_FILE" } });
        return;
      }
      const text = await this.parseDocumentToText(file);
      if (!text || text.length < 30) {
        res.status(400).json({
          success: false,
          error: {
            code: "INSUFFICIENT_TEXT",
            message: "Could not extract sufficient text from document.",
          },
        });
        return;
      }
      const fields = await this.llm.extractCandidateFields(text);
      res.json({ success: true, data: fields });
    } catch (error) {
      next(error);
    }
  };

  /** GET /jobs/health */
  healthCheck = async (_req: Request, res: Response): Promise<void> => {
    // Spec-mandated 5-band layout (Phase 5 migration). POOR is retained on
    // the persistence enum for legacy hydration only — new code never emits
    // it.
    const bandString =
      "WEAK 0-39 | PARTIAL 40-54 | GOOD 55-69 | VERY_GOOD 70-84 | EXCELLENT 85-100";
    res.json({
      success: true,
      data: {
        status: "healthy",
        engine: "job-matching",
        version: "2.3.0",
        bands: bandString,
      },
    });
  };
}

// ============================================================================
// VALIDATION
// ============================================================================

export const findMatchesValidation = [
  param("jobId").isString().notEmpty(),
  body("limit").optional().isInt({ min: 1, max: 100 }),
  body("offset").optional().isInt({ min: 0 }),
  body("includeAI").optional().isBoolean(),
  body("includeExplanations").optional().isBoolean(),
  body("filters").optional().isObject(),
];

export const findHelpersValidation = [
  param("candidateProfileId").isString().notEmpty(),
  body("targetJobId").optional({ nullable: true }).isString(),
  body("limit").optional().isInt({ min: 1, max: 100 }),
  body("offset").optional().isInt({ min: 0 }),
  body("includeAI").optional().isBoolean(),
  body("includeExplanations").optional().isBoolean(),
  body("filters").optional().isObject(),
];

// ============================================================================
// ROUTER FACTORY
// ============================================================================

export interface JobMatchingRouterOptions {
  prisma: any;
  config?: JobMatchingConfig;
  authMiddleware?: any;
}

export function createJobMatchingRoutes(
  options: JobMatchingRouterOptions,
): Router {
  const router = Router();
  const service = createJobMatchingService(options.prisma, options.config);
  const llm = createJobLLMService();
  const controller = new JobMatchingController(service, llm);

  router.get("/health", controller.healthCheck);

  if (options.authMiddleware) router.use(options.authMiddleware);

  router.post(
    "/:jobId/matches",
    ...findMatchesValidation,
    controller.findMatches,
  );
  router.get("/:jobId/matches", controller.getMatches);
  router.post("/extract-hiring", controller.extractHiring);
  router.post("/extract-candidate", controller.extractCandidate);

  // Document upload endpoints (PDF/DOCX/DOC/TXT) — same parsing as
  // /opportunities/extract-document, but routed to the hiring/candidate
  // LLM prompts so the returned shape matches each form's fields.
  const documentUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      const allowed = [
        "application/pdf",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/msword",
        "text/plain",
      ];
      if (allowed.includes(file.mimetype)) cb(null, true);
      else cb(new Error("Invalid file type. Please upload PDF, DOCX, DOC, or TXT files."));
    },
  });
  router.post(
    "/extract-hiring-document",
    documentUpload.single("document"),
    controller.extractHiringDocument,
  );
  router.post(
    "/extract-candidate-document",
    documentUpload.single("document"),
    controller.extractCandidateDocument,
  );

  // OPEN_TO_OPPORTUNITY_TO_HELPERS / TARGET_JOB_TO_HELPERS
  router.post(
    "/candidates/:candidateProfileId/helpers",
    ...findHelpersValidation,
    controller.findHelpers,
  );
  router.get(
    "/candidates/:candidateProfileId/helpers",
    controller.getHelperMatches,
  );

  return router;
}

// ============================================================================
// FACTORY
// ============================================================================

export function createJobMatchingController(
  prisma: any,
  config?: JobMatchingConfig,
): JobMatchingController {
  const service = createJobMatchingService(prisma, config);
  return new JobMatchingController(service);
}
