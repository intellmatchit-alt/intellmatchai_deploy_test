/**
 * Find Contact Routes
 *
 * API endpoints for the Find Contact feature.
 *
 * @module presentation/routes/find-contact
 */

import { Router, Request, Response, NextFunction } from "express";
import multer from "multer";
import { authenticate } from "../middleware/auth.middleware";
import {
  FindContactService,
  FindContactInput,
  FeedbackInput,
} from "../../application/use-cases/find-contact";
import { SearchIntent } from "@prisma/client";
import { logger } from "../../shared/logger";

export const findContactRoutes = Router();

// Initialize service
const findContactService = new FindContactService();

// All routes require authentication
findContactRoutes.use(authenticate);

// Multer configuration for image upload
const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
  fileFilter: (_req, file, cb) => {
    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only JPEG, PNG, WebP, and GIF images are allowed"));
    }
  },
});

/**
 * POST /api/v1/find-contact/search
 *
 * Search for a contact using various input types:
 * - Text query (name, phone, email, URL)
 * - Image upload (business card, screenshot, face photo)
 *
 * Body (JSON or multipart/form-data):
 * - query?: string - Text search query
 * - intent: SearchIntent - MEETING | COLLABORATION | FOLLOW_UP | SALES | SUPPORT | OTHER
 * - intentNote?: string - Additional context
 * - image?: File - Optional image for OCR/face search
 * - consentFaceMatch?: boolean - Required true for face matching
 *
 * Response:
 * - requestId: string - Unique request ID for polling/feedback
 * - inputType: string - Detected input type
 * - status: string - HIGH_CONFIDENCE | LIKELY | UNCERTAIN | NO_MATCH | PENDING_OCR
 * - results: Array of candidates with scores and snapshots
 * - suggestedActions: Array of recommended next steps
 * - openingSentences: Array of 3 opening sentences for top result
 */
findContactRoutes.post(
  "/search",
  imageUpload.single("image"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: { code: "UNAUTHORIZED", message: "Authentication required" },
        });
        return;
      }

      const { query, intent, intentNote, consentFaceMatch } = req.body;

      // Validate intent
      const validIntents: SearchIntent[] = [
        "MEETING",
        "COLLABORATION",
        "FOLLOW_UP",
        "SALES",
        "SUPPORT",
        "OTHER",
      ];
      if (!intent || !validIntents.includes(intent as SearchIntent)) {
        res.status(400).json({
          success: false,
          error: {
            code: "INVALID_INTENT",
            message: `Intent must be one of: ${validIntents.join(", ")}`,
          },
        });
        return;
      }

      // Validate at least query or image is provided
      if (!query && !req.file) {
        res.status(400).json({
          success: false,
          error: {
            code: "MISSING_INPUT",
            message: "Either query text or image is required",
          },
        });
        return;
      }

      // Handle image upload if present
      let imageUploadId: string | undefined;
      if (req.file) {
        // In production, this would upload to S3/MinIO and return the key
        // For now, we'll generate a temporary ID
        imageUploadId = `img_${Date.now()}_${Math.random().toString(36).substring(7)}`;
        logger.info("Image uploaded for find-contact", {
          userId: req.user.userId,
          imageId: imageUploadId,
          size: req.file.size,
          mimeType: req.file.mimetype,
        });
      }

      const input: FindContactInput = {
        query: query?.toString(),
        intent: intent as SearchIntent,
        intentNote: intentNote?.toString(),
        imageUploadId,
        consentFaceMatch:
          consentFaceMatch === "true" || consentFaceMatch === true,
      };

      const result = await findContactService.search(input, req.user.userId);

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      logger.error("Find contact search failed", { error });
      next(error);
    }
  },
);

/**
 * GET /api/v1/find-contact/request/:id
 *
 * Get status and results of a search request.
 * Use for polling when image processing is in progress.
 *
 * Response:
 * - Same structure as search response
 */
findContactRoutes.get(
  "/request/:id",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: { code: "UNAUTHORIZED", message: "Authentication required" },
        });
        return;
      }

      const { id } = req.params;

      const result = await findContactService.getRequestStatus(String(id));

      if (!result) {
        res.status(404).json({
          success: false,
          error: { code: "NOT_FOUND", message: "Request not found" },
        });
        return;
      }

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      logger.error("Get request status failed", { error });
      next(error);
    }
  },
);

/**
 * POST /api/v1/find-contact/feedback
 *
 * Submit feedback on search results to improve future ranking.
 *
 * Body:
 * - requestId: string (required)
 * - confirmedCandidateId?: string - ID of the correct match
 * - confirmedType?: CandidateType - USER or CONTACT
 * - rejectedCandidateIds?: string[] - IDs of incorrect matches
 * - notes?: string - Additional feedback
 */
findContactRoutes.post(
  "/feedback",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: { code: "UNAUTHORIZED", message: "Authentication required" },
        });
        return;
      }

      const {
        requestId,
        confirmedCandidateId,
        confirmedType,
        rejectedCandidateIds,
        notes,
      } = req.body;

      if (!requestId) {
        res.status(400).json({
          success: false,
          error: {
            code: "MISSING_REQUEST_ID",
            message: "requestId is required",
          },
        });
        return;
      }

      const input: FeedbackInput = {
        requestId,
        confirmedCandidateId,
        confirmedType,
        rejectedCandidateIds,
        notes,
      };

      await findContactService.submitFeedback(input, req.user.userId);

      res.json({
        success: true,
        message: "Feedback submitted successfully",
      });
    } catch (error) {
      logger.error("Submit feedback failed", { error });
      next(error);
    }
  },
);

/**
 * POST /api/v1/find-contact/enrich
 *
 * Trigger enrichment for a candidate using external data sources.
 *
 * Body:
 * - requestId: string (required)
 * - candidateId: string (required)
 * - candidateType: CandidateType (required)
 */
findContactRoutes.post(
  "/enrich",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: { code: "UNAUTHORIZED", message: "Authentication required" },
        });
        return;
      }

      const { requestId, candidateId, candidateType } = req.body;

      if (!requestId || !candidateId || !candidateType) {
        res.status(400).json({
          success: false,
          error: {
            code: "MISSING_FIELDS",
            message: "requestId, candidateId, and candidateType are required",
          },
        });
        return;
      }

      // TODO: Implement enrichment trigger
      // This would queue a job to enrich the candidate using PDL or other services

      logger.info("Enrichment requested", {
        userId: req.user.userId,
        requestId,
        candidateId,
        candidateType,
      });

      res.json({
        success: true,
        message: "Enrichment queued. Check back shortly for updated results.",
      });
    } catch (error) {
      logger.error("Enrich request failed", { error });
      next(error);
    }
  },
);

export default findContactRoutes;
