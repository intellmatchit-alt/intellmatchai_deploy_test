/**
 * Scan Routes
 *
 * Routes for business card scanning.
 *
 * @module presentation/routes/scan
 */

import { Router } from 'express';
import multer from 'multer';
import { scanController } from '../controllers/ScanController';
import { authenticate } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { scanCardSchema } from '../validators/contact.validator';

// Configure multer for image uploads
const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/heic', 'image/heif'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, GIF, WebP, HEIC are allowed.'));
    }
  },
});

export const scanRoutes = Router();

// All scan routes require authentication
scanRoutes.use(authenticate);

/**
 * POST /api/v1/scan/card
 * Upload and scan a business card
 *
 * Performs OCR on the provided image and extracts
 * contact information fields.
 *
 * Body:
 * - imageData: base64 encoded image (required)
 * - mimeType: image MIME type (required)
 *
 * Returns extracted fields for user confirmation.
 */
scanRoutes.post('/card', imageUpload.single('image'), scanController.scanCard.bind(scanController));

/**
 * POST /api/v1/scan/card/stream
 * Upload and scan a business card with real-time progress
 *
 * Same as /card but returns Server-Sent Events with progress updates.
 * Progress stages: ocr (0-40%), gpt (40-70%), analysis (70-95%), complete (100%)
 *
 * Body:
 * - imageData: base64 encoded image (required)
 * - mimeType: image MIME type (required)
 *
 * Returns SSE stream with progress updates and final result.
 */
scanRoutes.post('/card/stream', imageUpload.single('image'), scanController.scanCardStream.bind(scanController));

/**
 * POST /api/v1/scan/confirm
 * Confirm extracted fields and create contact
 *
 * After scanning, user confirms/edits the extracted fields
 * and this endpoint creates the contact.
 *
 * Body:
 * - name: string (required)
 * - email?: string
 * - phone?: string
 * - company?: string
 * - jobTitle?: string
 * - website?: string
 * - cardImageUrl: string (required, URL to stored card image)
 * - sectors?: string[] (sector IDs suggested or selected)
 */
scanRoutes.post(
  '/confirm',
  validate(scanCardSchema),
  scanController.confirmScan.bind(scanController)
);

/**
 * POST /api/v1/scan/upload
 * Upload card image before scanning
 *
 * Optional endpoint to upload image separately.
 * Returns a URL that can be used for cardImageUrl.
 *
 * Supports:
 * - multipart/form-data with 'image' field
 * - JSON with base64 imageData and mimeType
 */
scanRoutes.post(
  '/upload',
  imageUpload.single('image'),
  scanController.uploadImage.bind(scanController)
);

/**
 * POST /api/v1/scan/suggest-sectors
 * Get AI-suggested sectors based on extracted fields
 *
 * Body:
 * - company?: string
 * - jobTitle?: string
 *
 * Returns array of suggested sector IDs with confidence scores.
 */
scanRoutes.post('/suggest-sectors', scanController.suggestSectors.bind(scanController));

export default scanRoutes;
