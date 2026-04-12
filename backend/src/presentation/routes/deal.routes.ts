/**
 * Deal Matching Routes
 * API endpoints for deal matching operations
 */

import { Router } from 'express';
import multer from 'multer';
import { authenticate } from '../middleware/auth.middleware.js';
import { orgContext } from '../middleware/orgContext.middleware';
import * as DealController from '../controllers/DealController';
import { itemizedMatchController } from '../controllers/ItemizedMatchController';
import { matchingRateLimiter } from '../middleware/rateLimiter';

const router = Router();

// Configure multer for document uploads
const documentUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
      'text/plain',
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Please upload PDF, DOCX, DOC, or TXT files.'));
    }
  },
});

// All routes require authentication + org context
router.use(authenticate);
router.use(orgContext);

/**
 * @route POST /api/v1/deals
 * @desc Create a new deal request
 * @access Private
 */
router.post('/', DealController.createDeal);

/**
 * @route GET /api/v1/deals
 * @desc List user's deals
 * @access Private
 */
router.get('/', DealController.listDeals);

/**
 * @route POST /api/v1/deals/extract-document
 * @desc Extract deal data from uploaded document using AI
 * @access Private
 */
router.post('/extract-document', documentUpload.single('document'), DealController.extractDealFromDocument);

/**
 * @route GET /api/v1/deals/:id
 * @desc Get deal by ID with status
 * @access Private
 */
router.get('/:id', DealController.getDeal);

/**
 * @route PUT /api/v1/deals/:id
 * @desc Update deal
 * @access Private
 */
router.put('/:id', DealController.updateDeal);

/**
 * @route PATCH /api/v1/deals/:id/archive
 * @desc Archive or unarchive a deal
 * @access Private
 */
router.patch('/:id/archive', DealController.archiveDeal);

/**
 * @route DELETE /api/v1/deals/:id
 * @desc Delete deal
 * @access Private
 */
router.delete('/:id', DealController.deleteDeal);

/**
 * @route POST /api/v1/deals/:id/calculate
 * @desc Calculate matches for a deal (sync or async)
 * @access Private
 */
router.post('/:id/calculate', matchingRateLimiter, DealController.calculateMatches);

/**
 * @route GET /api/v1/deals/:id/results
 * @desc Get deal results (ranked matches)
 * @access Private
 */
router.get('/:id/results', DealController.getDealResults);

/**
 * @route GET /api/v1/deals/:dealId/matches/itemized/:contactId
 * @desc Get itemized explainable match between deal and contact
 * @query type - 'buyer' | 'provider' (optional, inferred from deal mode if not provided)
 * @access Private
 *
 * Returns per-criterion scores with detailed explanations.
 */
router.get(
  '/:dealId/matches/itemized/:contactId',
  itemizedMatchController.getDealMatch.bind(itemizedMatchController)
);

export default router;
