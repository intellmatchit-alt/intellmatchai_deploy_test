/**
 * PNME Routes: Pitch-to-Network Matching Engine
 * API endpoints for pitch operations
 */

import { Router } from "express";
import multer from "multer";
import { authenticate } from "../middleware/auth.middleware.js";
import { orgContext } from "../middleware/orgContext.middleware";
import { validate as validateRequest } from "../middleware/validate.middleware.js";
import { pitchValidators } from "../validators/pitch.validators";
import * as PitchController from "../controllers/PitchController";
import { itemizedMatchController } from "../controllers/ItemizedMatchController";
import { matchingRateLimiter } from "../middleware/rateLimiter";

const router = Router();

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(
        new Error("Invalid file type. Only PDF and PPTX files are supported."),
      );
    }
  },
});

// Configure multer for document extraction (PDF, DOCX, DOC, TXT)
const documentUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/msword",
      "text/plain",
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(
        new Error(
          "Invalid file type. Please upload PDF, DOCX, DOC, or TXT files.",
        ),
      );
    }
  },
});

// All routes require authentication + org context
router.use(authenticate);
router.use(orgContext);

/**
 * @route GET /api/v1/pitches/preferences
 * @desc Get PNME preferences
 * @access Private
 */
router.get("/preferences", PitchController.getPNMEPreferences);

/**
 * @route PUT /api/v1/pitches/preferences
 * @desc Update PNME preferences
 * @access Private
 */
router.put(
  "/preferences",
  validateRequest(pitchValidators.updatePreferences),
  PitchController.updatePNMEPreferences,
);

/**
 * @route POST /api/v1/pitches/extract-document
 * @desc Extract pitch data from uploaded document using AI
 * @access Private
 */
// router.post(
//   '/extract-document',
//   documentUpload.single('document'),
//   PitchController.extractPitchFromDocument,
// );

/**
 * @route POST /api/v1/pitches/analyze-text
 * @desc Analyze pitch text and suggest category, sectors, skills using AI
 * @access Private
 */
router.post("/analyze-text", PitchController.analyzePitchText);

/**
 * @route POST /api/v1/pitches/create
 * @desc Create a new pitch (form-based, no file upload)
 * @access Private
 */
router.post("/create", PitchController.createPitch);

/**
 * @route POST /api/v1/pitches
 * @desc Upload a new pitch deck
 * @access Private
 */
router.post(
  "/",
  upload.single("file"),
  validateRequest(pitchValidators.upload),
  PitchController.uploadPitch,
);

/**
 * @route GET /api/v1/pitches
 * @desc List user's pitches
 * @access Private
 */
router.get(
  "/",
  validateRequest(pitchValidators.list),
  PitchController.listPitches,
);

/**
 * @route GET /api/v1/pitches/discover/all
 * @desc Discover public pitches from other users
 * @access Private
 */
router.get("/discover/all", PitchController.discoverPitches);

/**
 * @route GET /api/v1/pitches/:id
 * @desc Get pitch status and progress
 * @access Private
 */
router.get(
  "/:id",
  validateRequest(pitchValidators.getById),
  PitchController.getPitchStatus,
);

/**
 * @route GET /api/v1/pitches/:id/results
 * @desc Get pitch results (sections with matches)
 * @access Private
 */
router.get(
  "/:id/results",
  validateRequest(pitchValidators.getResults),
  PitchController.getPitchResults,
);

/**
 * @route POST /api/v1/pitches/:id/find-matches
 * @desc Find matches for a pitch (synchronous, like project matching)
 * @access Private
 */
router.post(
  "/:id/find-matches",
  matchingRateLimiter,
  PitchController.findMatches,
);

/**
 * @route POST /api/v1/pitches/:id/rematch
 * @desc Re-run matching for a pitch
 * @access Private
 */
router.post(
  "/:id/rematch",
  matchingRateLimiter,
  validateRequest(pitchValidators.rematch),
  PitchController.rematchPitch,
);

/**
 * @route PUT /api/v1/pitches/:id
 * @desc Update pitch title/companyName
 * @access Private
 */
router.put(
  "/:id",
  validateRequest(pitchValidators.getById),
  PitchController.updatePitch,
);

/**
 * @route PUT /api/v1/pitches/:id/sections/:sectionId
 * @desc Update a pitch section's title and/or content
 * @access Private
 */
router.put("/:id/sections/:sectionId", PitchController.updatePitchSection);

/**
 * @route PATCH /api/v1/pitches/:id/archive
 * @desc Archive/unarchive a pitch
 * @access Private
 */
router.patch(
  "/:id/archive",
  validateRequest(pitchValidators.getById),
  PitchController.archivePitch,
);

/**
 * @route DELETE /api/v1/pitches/:id
 * @desc Delete a pitch
 * @access Private
 */
router.delete(
  "/:id",
  validateRequest(pitchValidators.getById),
  PitchController.deletePitch,
);

/**
 * @route GET /api/v1/pitches/:id/export
 * @desc Export pitch results
 * @access Private
 */
router.get(
  "/:id/export",
  validateRequest(pitchValidators.export),
  PitchController.exportPitchResults,
);

/**
 * @route POST /api/v1/pitches/:pitchId/sections/:sectionId/contacts/:contactId/outreach
 * @desc Regenerate outreach message
 * @access Private
 */
router.post(
  "/:pitchId/sections/:sectionId/contacts/:contactId/outreach",
  validateRequest(pitchValidators.regenerateOutreach),
  PitchController.regenerateOutreach,
);

/**
 * @route GET /api/v1/pitches/:pitchId/matches/itemized/:contactId
 * @desc Get itemized match between a pitch and a contact
 * @access Private
 */
router.get(
  "/:pitchId/matches/itemized/:contactId",
  itemizedMatchController.getPitchMatch.bind(itemizedMatchController),
);

export default router;
