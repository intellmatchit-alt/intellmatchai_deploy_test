/**
 * Import Routes
 *
 * API routes for contact import operations.
 *
 * @module presentation/routes/import.routes
 */

import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { importController } from '../controllers/ImportController';

const router = Router();

/**
 * @route POST /api/v1/contacts/import/batches
 * @desc Create a new import batch
 * @access Private
 */
router.post('/batches', authenticate, importController.createBatch);

/**
 * @route POST /api/v1/contacts/import/batches/:id/chunks
 * @desc Upload a chunk of contacts
 * @access Private
 */
router.post('/batches/:id/chunks', authenticate, importController.uploadChunk);

/**
 * @route POST /api/v1/contacts/import/batches/:id/commit
 * @desc Commit a batch and start processing
 * @access Private
 */
router.post('/batches/:id/commit', authenticate, importController.commitBatch);

/**
 * @route GET /api/v1/contacts/import/batches/:id/status
 * @desc Get batch status
 * @access Private
 */
router.get('/batches/:id/status', authenticate, importController.getBatchStatus);

/**
 * @route POST /api/v1/contacts/import/batches/:id/rollback
 * @desc Rollback a batch
 * @access Private
 */
router.post('/batches/:id/rollback', authenticate, importController.rollbackBatch);

/**
 * @route GET /api/v1/contacts/import/batches
 * @desc List all batches
 * @access Private
 */
router.get('/batches', authenticate, importController.listBatches);

export const importRoutes = router;
export default importRoutes;
