/**
 * Opportunity Matching Routes v2
 *
 * Express routes for opportunity matching API.
 * Features:
 * - Input validation
 * - Rate limiting
 * - Authentication required
 * - Structured error responses
 *
 * @module routes/opportunity-matching.routes
 */

import { Router } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { OpportunityMatchingController } from '../controllers/opportunity-matching.controller';
import {
  standardRateLimiter,
  asyncRateLimiter,
  statusRateLimiter,
} from '../middleware/opportunity-rate-limiter';
import { authenticate } from '../../../../presentation/middleware/auth.middleware';
import { logger } from '../../../../shared/logger';

// ============================================================================
// Router Setup
// ============================================================================

const router = Router();
const controller = new OpportunityMatchingController();

// ============================================================================
// Validation Middleware
// ============================================================================

/**
 * Handle validation errors
 */
function handleValidationErrors(req: any, res: any, next: any) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    logger.warn('Validation error', {
      path: req.path,
      errors: errors.array(),
    });

    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid request parameters',
        details: errors.array().map(e => ({
          field: (e as any).path || (e as any).param,
          message: e.msg,
        })),
      },
    });
  }
  next();
}

// ============================================================================
// Validators
// ============================================================================

const findMatchesValidation = [
  param('intentId')
    .optional()
    .isUUID()
    .withMessage('intentId must be a valid UUID'),
  body('async')
    .optional()
    .isBoolean()
    .withMessage('async must be a boolean'),
  body('config')
    .optional()
    .isObject()
    .withMessage('config must be an object'),
  body('config.maxContactCandidates')
    .optional()
    .isInt({ min: 1, max: 500 })
    .withMessage('maxContactCandidates must be between 1 and 500'),
  body('config.maxUserCandidates')
    .optional()
    .isInt({ min: 0, max: 200 })
    .withMessage('maxUserCandidates must be between 0 and 200'),
  body('config.enableUserMatching')
    .optional()
    .isBoolean()
    .withMessage('enableUserMatching must be a boolean'),
];

const jobIdValidation = [
  param('jobId')
    .notEmpty()
    .withMessage('jobId is required')
    .isString()
    .withMessage('jobId must be a string'),
];

const intentIdValidation = [
  param('intentId')
    .isUUID()
    .withMessage('intentId must be a valid UUID'),
];

const matchIdValidation = [
  param('matchId')
    .isUUID()
    .withMessage('matchId must be a valid UUID'),
];

const updateMatchValidation = [
  param('matchId')
    .isUUID()
    .withMessage('matchId must be a valid UUID'),
  body('status')
    .optional()
    .isIn(['PENDING', 'CONTACTED', 'RESPONDED', 'SCHEDULED', 'HIRED', 'REJECTED', 'ARCHIVED'])
    .withMessage('Invalid status value'),
  body('notes')
    .optional()
    .isString()
    .isLength({ max: 2000 })
    .withMessage('notes must be a string with max 2000 characters'),
];

const listMatchesValidation = [
  query('intentId')
    .optional()
    .isUUID()
    .withMessage('intentId must be a valid UUID'),
  query('status')
    .optional()
    .isIn(['PENDING', 'CONTACTED', 'RESPONDED', 'SCHEDULED', 'HIRED', 'REJECTED', 'ARCHIVED'])
    .withMessage('Invalid status value'),
  query('matchLevel')
    .optional()
    .isIn(['EXCELLENT', 'VERY_GOOD', 'GOOD', 'WEAK', 'POOR'])
    .withMessage('Invalid matchLevel value'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('limit must be between 1 and 100'),
  query('offset')
    .optional()
    .isInt({ min: 0 })
    .withMessage('offset must be a non-negative integer'),
];

// ============================================================================
// Routes
// ============================================================================

/**
 * @route POST /match
 * @desc Find matches for user's active opportunity intent
 * @access Private
 */
router.post(
  '/match',
  authenticate,
  standardRateLimiter,
  findMatchesValidation,
  handleValidationErrors,
  controller.findMatches.bind(controller)
);

/**
 * @route POST /match/async
 * @desc Submit async matching job
 * @access Private
 */
router.post(
  '/match/async',
  authenticate,
  asyncRateLimiter,
  findMatchesValidation,
  handleValidationErrors,
  controller.submitAsyncMatching.bind(controller)
);

/**
 * @route GET /match/job/:jobId
 * @desc Get async job status
 * @access Private
 */
router.get(
  '/match/job/:jobId',
  authenticate,
  statusRateLimiter,
  jobIdValidation,
  handleValidationErrors,
  controller.getJobStatus.bind(controller)
);

/**
 * @route DELETE /match/job/:jobId
 * @desc Cancel async job
 * @access Private
 */
router.delete(
  '/match/job/:jobId',
  authenticate,
  jobIdValidation,
  handleValidationErrors,
  controller.cancelJob.bind(controller)
);

/**
 * @route POST /match/:intentId
 * @desc Find matches for a specific intent
 * @access Private
 *
 * Defined after fixed literal routes to avoid shadowing.
 */
router.post(
  '/match/:intentId',
  authenticate,
  standardRateLimiter,
  findMatchesValidation,
  handleValidationErrors,
  controller.findMatchesForIntent.bind(controller)
);

/**
 * @route GET /matches
 * @desc List matches for current user
 * @access Private
 */
router.get(
  '/matches',
  authenticate,
  statusRateLimiter,
  listMatchesValidation,
  handleValidationErrors,
  controller.listMatches.bind(controller)
);

/**
 * @route GET /matches/:matchId
 * @desc Get match details
 * @access Private
 */
router.get(
  '/matches/:matchId',
  authenticate,
  matchIdValidation,
  handleValidationErrors,
  controller.getMatch.bind(controller)
);

/**
 * @route PATCH /matches/:matchId
 * @desc Update match status
 * @access Private
 */
router.patch(
  '/matches/:matchId',
  authenticate,
  updateMatchValidation,
  handleValidationErrors,
  controller.updateMatch.bind(controller)
);

/**
 * @route GET /stats/:intentId
 * @desc Get matching statistics for an intent
 * @access Private
 */
router.get(
  '/stats/:intentId',
  authenticate,
  intentIdValidation,
  handleValidationErrors,
  controller.getStats.bind(controller)
);

/**
 * @route GET /health
 * @desc Get matching system health
 * @access Private
 */
router.get(
  '/health',
  authenticate,
  controller.getHealth.bind(controller)
);

export default router;
