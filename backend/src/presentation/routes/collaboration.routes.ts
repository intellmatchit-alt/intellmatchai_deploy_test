/**
 * Collaboration Routes
 * API endpoints for Collaborative Matching operations
 */

import { Router } from 'express';
import multer from 'multer';
import { authenticate } from '../middleware/auth.middleware.js';
import * as CollaborationController from '../controllers/CollaborationController';

const router = Router();

// Multer config for voice upload
const voiceUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('audio/')) {
      cb(null, true);
    } else {
      cb(new Error('Only audio files are allowed'));
    }
  },
});

// All routes require authentication
router.use(authenticate);

// ============================================================================
// Collaboration Request Routes
// ============================================================================

/**
 * @route POST /api/v1/collaboration-requests
 * @desc Send a collaboration request
 * @access Private
 */
router.post('/', CollaborationController.sendRequest);

/**
 * @route POST /api/v1/collaboration-requests/bulk
 * @desc Send bulk collaboration requests to multiple contacts
 * @access Private
 */
router.post('/bulk', CollaborationController.sendBulkRequests);

/**
 * @route POST /api/v1/collaboration-requests/upload-voice
 * @desc Upload a voice message for collaboration requests
 * @access Private
 */
router.post('/upload-voice', voiceUpload.single('voice'), CollaborationController.uploadVoice);

/**
 * @route GET /api/v1/collaboration-requests/sent
 * @desc List sent requests (owner view)
 * @access Private
 */
router.get('/sent', CollaborationController.listSentRequests);

/**
 * @route GET /api/v1/collaboration-requests/inbox
 * @desc List received requests (collaborator inbox)
 * @access Private
 */
router.get('/inbox', CollaborationController.listReceivedRequests);

/**
 * @route GET /api/v1/collaboration-requests/:id
 * @desc Get request by ID (filtered by role)
 * @access Private
 */
router.get('/:id', CollaborationController.getRequest);

/**
 * @route POST /api/v1/collaboration-requests/:id/cancel
 * @desc Cancel a pending request (owner only)
 * @access Private
 */
router.post('/:id/cancel', CollaborationController.cancelRequest);

/**
 * @route POST /api/v1/collaboration-requests/:id/accept
 * @desc Accept a request (collaborator only)
 * @access Private
 */
router.post('/:id/accept', CollaborationController.acceptRequest);

/**
 * @route POST /api/v1/collaboration-requests/:id/reject
 * @desc Reject a request (collaborator only)
 * @access Private
 */
router.post('/:id/reject', CollaborationController.rejectRequest);

/**
 * @route POST /api/v1/collaboration-requests/:id/run-matching
 * @desc Start matching process (collaborator only)
 * @access Private
 */
router.post('/:id/run-matching', CollaborationController.runMatching);

/**
 * @route POST /api/v1/collaboration-requests/:id/introductions
 * @desc Create an introduction (collaborator only)
 * @access Private
 */
router.post('/:id/introductions', CollaborationController.createIntroduction);

/**
 * @route GET /api/v1/collaboration-requests/:id/introductions
 * @desc Get introductions for a request (collaborator only)
 * @access Private
 */
router.get('/:id/introductions', CollaborationController.getIntroductions);

export default router;
