/**
 * PNME Match Routes
 * API endpoints for pitch match operations
 */

import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { validate as validateRequest } from '../middleware/validate.middleware';
import { pitchMatchValidators } from '../validators/pitchMatch.validators';
import * as PitchController from '../controllers/PitchController';

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * @route PATCH /api/v1/pitch-matches/:matchId
 * @desc Update match status (save/ignore/contacted)
 * @access Private
 */
router.patch(
  '/:matchId',
  validateRequest(pitchMatchValidators.updateStatus),
  PitchController.updateMatchStatus,
);

export default router;
