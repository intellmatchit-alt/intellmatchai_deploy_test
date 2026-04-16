/**
 * Bug Report Routes
 *
 * User-facing endpoints for submitting and viewing QA/bug reports.
 *
 * @module presentation/routes/bug-report
 */

import { Router, Request, Response, NextFunction } from "express";
import multer from "multer";
import crypto from "crypto";
import { prisma } from "../../infrastructure/database/prisma/client.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { logger } from "../../shared/logger/index.js";

export const bugReportRoutes = Router();

// All routes require authentication
bugReportRoutes.use(authenticate);

// ---------------------------------------------------------------------------
// Multer config for screenshot uploads (10MB, images only)
// ---------------------------------------------------------------------------

const screenshotUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (_req, file, cb) => {
    const allowedMimes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only JPEG, PNG, GIF, and WebP images are allowed"));
    }
  },
});

// ===========================================================================
// POST / — Create a bug report
// ===========================================================================

bugReportRoutes.post(
  "/",
  screenshotUpload.single("screenshot"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        return res
          .status(401)
          .json({ success: false, error: "Authentication required" });
      }

      const {
        description,
        urgency,
        category,
        pagePath,
        pageTitle,
        userAgent,
        appVersion,
        platform,
      } = req.body;

      if (!description || !pagePath) {
        return res.status(400).json({
          success: false,
          error: "description and pagePath are required",
        });
      }

      let screenshotUrl: string | null = null;

      // Upload screenshot to MinIO if provided
      if (req.file) {
        try {
          const { getStorageService } =
            await import("../../infrastructure/external/storage/index.js");
          const storage = getStorageService();
          const available = await storage.isAvailable();

          if (available) {
            const ext = req.file.originalname.split(".").pop() || "png";
            const key = `${req.user.userId}/${crypto.randomUUID()}.${ext}`;

            await storage.upload("bug-reports", key, req.file.buffer, {
              contentType: req.file.mimetype,
            });

            screenshotUrl = `/api/v1/storage/bug-reports/${key}`;
          } else {
            logger.warn("Storage not available, skipping screenshot upload");
          }
        } catch (uploadError) {
          logger.error("Failed to upload bug report screenshot:", uploadError);
          // Continue without screenshot rather than failing the whole report
        }
      }

      const report = await prisma.bugReport.create({
        data: {
          userId: req.user.userId,
          description,
          urgency: urgency || "MEDIUM",
          category: category || "BUG",
          pagePath,
          pageTitle: pageTitle || null,
          screenshotUrl,
          userAgent: userAgent || null,
          appVersion: appVersion || null,
          platform: platform || null,
        },
      });

      return res.status(201).json({ success: true, data: report });
    } catch (error: any) {
      logger.error("Create bug report error:", error);
      return res
        .status(500)
        .json({ success: false, error: "Internal server error" });
    }
  },
);

// ===========================================================================
// GET / — List user's own reports (paginated)
// ===========================================================================

bugReportRoutes.get("/", async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res
        .status(401)
        .json({ success: false, error: "Authentication required" });
    }

    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(
      100,
      Math.max(1, parseInt(req.query.limit as string) || 20),
    );
    const status = req.query.status as string;

    const where: any = { userId: req.user.userId };
    if (status) where.status = status;

    const [reports, total] = await Promise.all([
      prisma.bugReport.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.bugReport.count({ where }),
    ]);

    return res.json({
      success: true,
      data: {
        reports,
        total,
        page,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    logger.error("List bug reports error:", error);
    return res
      .status(500)
      .json({ success: false, error: "Internal server error" });
  }
});

// ===========================================================================
// GET /:id — Get a single report (user's own)
// ===========================================================================

bugReportRoutes.get("/:id", async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res
        .status(401)
        .json({ success: false, error: "Authentication required" });
    }

    const report = await prisma.bugReport.findFirst({
      where: { id: String(req.params.id), userId: req.user.userId },
    });

    if (!report) {
      return res
        .status(404)
        .json({ success: false, error: "Report not found" });
    }

    return res.json({ success: true, data: report });
  } catch (error: any) {
    logger.error("Get bug report error:", error);
    return res
      .status(500)
      .json({ success: false, error: "Internal server error" });
  }
});

export default bugReportRoutes;
