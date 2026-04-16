/**
 * Storage Routes
 *
 * Serves files from MinIO storage.
 * Files are served without authentication since URLs contain
 * hard-to-guess UUIDs and are meant to be embeddable in img/audio tags.
 *
 * @module presentation/routes/storage
 */

import { Router, Request, Response, NextFunction } from "express";
import { authenticate } from "../middleware/auth.middleware.js";
import { logger } from "../../shared/logger/index.js";

export const storageRoutes = Router();

/**
 * GET /api/v1/storage/:bucket/*
 * Stream a file from storage
 *
 * This endpoint proxies requests to MinIO storage.
 * No authentication required since URLs contain UUIDs and
 * need to work in <img> and <audio> tags.
 *
 * CORS headers are set to allow cross-origin access for social media crawlers
 * (WhatsApp, Facebook, Twitter) to fetch OG images.
 */
storageRoutes.get(
  "/:bucket/*",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Allow cross-origin access for social media crawlers (WhatsApp, Facebook, Twitter OG images)
      res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
      res.setHeader("Access-Control-Allow-Origin", "*");

      const bucket = String(req.params.bucket);
      const key = req.params[0]; // Everything after /:bucket/

      if (!bucket || !key) {
        res.status(400).json({
          success: false,
          error: {
            code: "INVALID_PATH",
            message: "Bucket and key are required",
          },
        });
        return;
      }

      // Import storage service
      const { getStorageService } =
        await import("../../infrastructure/external/storage/index.js");
      const storage = getStorageService();

      // Check if storage is available
      const available = await storage.isAvailable();
      if (!available) {
        res.status(503).json({
          success: false,
          error: {
            code: "STORAGE_UNAVAILABLE",
            message: "Storage service is not available",
          },
        });
        return;
      }

      // Check if file exists
      const exists = await storage.exists(bucket, key);
      if (!exists) {
        res.status(404).json({
          success: false,
          error: { code: "NOT_FOUND", message: "File not found" },
        });
        return;
      }

      // Get file metadata for content type
      const metadata = await storage.getMetadata(bucket, key);

      // Download and stream the file
      const data = await storage.download(bucket, key);

      // Set response headers
      const contentType = metadata.contentType || "application/octet-stream";
      res.setHeader("Content-Type", contentType);
      res.setHeader("Content-Length", data.length);
      // Use public cache for OG images so WhatsApp/Facebook crawlers can cache them
      res.setHeader("Cache-Control", "public, max-age=31536000"); // Cache for 1 year

      // Prevent SVG/HTML XSS by forcing download for dangerous content types
      const dangerousTypes = [
        "text/html",
        "application/xhtml+xml",
        "image/svg+xml",
        "text/xml",
        "application/xml",
      ];
      if (dangerousTypes.some((t) => contentType.toLowerCase().startsWith(t))) {
        const filename = key.split("/").pop() || "download";
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="${filename}"`,
        );
      }

      // Prevent content type sniffing
      res.setHeader("X-Content-Type-Options", "nosniff");

      // Send the file
      res.send(data);
    } catch (error) {
      logger.error("Storage file retrieval failed", { error, path: req.path });
      next(error);
    }
  },
);

/**
 * GET /api/v1/storage/url/:bucket/*
 * Get a fresh presigned URL for a file
 */
storageRoutes.get(
  "/url/:bucket/*",
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: { code: "UNAUTHORIZED", message: "Authentication required" },
        });
        return;
      }

      const bucket = String(req.params.bucket);
      const key = req.params[0];

      if (!bucket || !key) {
        res.status(400).json({
          success: false,
          error: {
            code: "INVALID_PATH",
            message: "Bucket and key are required",
          },
        });
        return;
      }

      const { getStorageService } =
        await import("../../infrastructure/external/storage/index.js");
      const storage = getStorageService();

      const available = await storage.isAvailable();
      if (!available) {
        res.status(503).json({
          success: false,
          error: {
            code: "STORAGE_UNAVAILABLE",
            message: "Storage service is not available",
          },
        });
        return;
      }

      // Generate a fresh presigned URL (1 hour expiry)
      const url = await storage.getPresignedUrl(bucket, key, {
        expiresIn: 3600,
      });

      res.json({
        success: true,
        data: { url },
      });
    } catch (error) {
      logger.error("Failed to generate presigned URL", {
        error,
        path: req.path,
      });
      next(error);
    }
  },
);

export default storageRoutes;
