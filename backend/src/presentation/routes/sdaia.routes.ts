/**
 * SDAIA Data Subject Rights Routes
 *
 * API routes for SDAIA PDPL compliance.
 * All routes require authentication.
 *
 * @module presentation/routes/sdaia.routes
 */

import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { sdaiaController } from '../controllers/SdaiaController';

const router = Router();

// All routes require authentication
router.use(authenticate);

// GET /subjects/processing-records - List all processing records
// NOTE: This must be before /:contactId routes to avoid matching "processing-records" as contactId
router.get('/processing-records', sdaiaController.listProcessingRecords.bind(sdaiaController));

// GET /subjects/:contactId/data - Right to Access
router.get('/:contactId/data', sdaiaController.getSubjectData.bind(sdaiaController));

// DELETE /subjects/:contactId - Right to Deletion
router.delete('/:contactId', sdaiaController.deleteSubjectData.bind(sdaiaController));

export const sdaiaRoutes = router;
export default sdaiaRoutes;
