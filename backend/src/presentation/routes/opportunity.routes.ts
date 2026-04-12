/**
 * Opportunity Routes
 *
 * Routes for job opportunity management and matching.
 * Supports multiple opportunities per user (like Projects).
 *
 * @module presentation/routes/opportunity
 */

import { Router } from 'express';
import multer from 'multer';
import { OpportunityController } from '../controllers/OpportunityController';
import { itemizedMatchController } from '../controllers/ItemizedMatchController';
import { authenticate } from '../middleware/auth.middleware';
import { orgContext } from '../middleware/orgContext.middleware';
import { matchingRateLimiter } from '../middleware/rateLimiter';

export const opportunityRoutes = Router();

// Create controller instance
const opportunityController = new OpportunityController();

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

// All opportunity routes require authentication + org context
opportunityRoutes.use(authenticate);
opportunityRoutes.use(orgContext);

/**
 * GET /api/v1/opportunities/stats
 * Get statistics for all user opportunities
 * NOTE: Must be before /:id to avoid conflict
 */
opportunityRoutes.get('/stats', opportunityController.getStats.bind(opportunityController));

/**
 * GET /api/v1/opportunities
 * List all user's opportunities
 *
 * Query params:
 * - page: page number (default 1)
 * - limit: items per page (default 20)
 * - status: filter by isActive (active, inactive, all)
 */
opportunityRoutes.get('/', opportunityController.list.bind(opportunityController));

/**
 * POST /api/v1/opportunities
 * Create a new opportunity
 *
 * Body:
 * - title: string (required)
 * - intentType: 'HIRING' | 'OPEN_TO_OPPORTUNITIES' | 'ADVISORY_BOARD' | 'REFERRALS_ONLY' (required)
 * - roleArea?: string
 * - seniority?: 'ENTRY' | 'MID' | 'SENIOR' | 'LEAD' | 'DIRECTOR' | 'VP' | 'C_LEVEL' | 'BOARD'
 * - locationPref?: string
 * - remoteOk?: boolean (default: true)
 * - notes?: string
 * - visibility?: 'PRIVATE' | 'LIMITED' | 'TEAM' (default: 'PRIVATE')
 * - sectorIds?: string[]
 * - skillIds?: string[]
 */
opportunityRoutes.post('/', opportunityController.create.bind(opportunityController));

/**
 * POST /api/v1/opportunities/extract-document
 * Extract opportunity data from uploaded document using AI
 */
opportunityRoutes.post(
  '/extract-document',
  documentUpload.single('document'),
  opportunityController.extractFromDocument.bind(opportunityController)
);

/**
 * GET /api/v1/opportunities/matches/all
 * Get all matches across all user's opportunities
 *
 * Query params:
 * - status: filter by status
 * - minScore: minimum match score (default: 0)
 * - limit: number of results (default: 100, max: 100)
 * - sortBy: 'score' | 'date' (default: 'score')
 * - sortOrder: 'asc' | 'desc' (default: 'desc')
 */
opportunityRoutes.get('/matches/all', opportunityController.getAllMatches.bind(opportunityController));

/**
 * GET /api/v1/opportunities/:id
 * Get single opportunity by ID
 */
opportunityRoutes.get('/:id', opportunityController.get.bind(opportunityController));

/**
 * PUT /api/v1/opportunities/:id
 * Update opportunity
 *
 * Body: (all optional)
 * - title?: string
 * - intentType?: OpportunityIntentType
 * - roleArea?: string
 * - seniority?: SeniorityLevel
 * - locationPref?: string
 * - remoteOk?: boolean
 * - notes?: string
 * - visibility?: OpportunityVisibility
 * - isActive?: boolean
 * - sectorIds?: string[]
 * - skillIds?: string[]
 */
opportunityRoutes.put('/:id', opportunityController.update.bind(opportunityController));

/**
 * DELETE /api/v1/opportunities/:id
 * Delete opportunity (cascades to matches)
 */
opportunityRoutes.delete('/:id', opportunityController.delete.bind(opportunityController));

/**
 * POST /api/v1/opportunities/:id/find-matches
 * Trigger AI matching pipeline for specific opportunity
 */
opportunityRoutes.post('/:id/find-matches', matchingRateLimiter, opportunityController.findMatches.bind(opportunityController));

/**
 * GET /api/v1/opportunities/:id/matches
 * Get matches for specific opportunity
 *
 * Query params:
 * - status: filter by status (PENDING, CONTACTED, SAVED, DISMISSED, CONNECTED, INTRODUCED)
 * - minScore: minimum match score (default: 0)
 * - limit: number of results (default: 30, max: 100)
 */
opportunityRoutes.get('/:id/matches', opportunityController.getMatches.bind(opportunityController));

/**
 * PUT /api/v1/opportunities/:id/matches/:matchId/status
 * Update match status
 *
 * Body:
 * - status: 'PENDING' | 'CONTACTED' | 'INTRODUCED' | 'SAVED' | 'DISMISSED' | 'CONNECTED'
 */
opportunityRoutes.put(
  '/:id/matches/:matchId/status',
  opportunityController.updateMatchStatus.bind(opportunityController)
);

// ============================================
// Itemized Matching Routes
// ============================================

/**
 * GET /api/v1/opportunities/:opportunityId/matches/itemized
 * Get all itemized candidate matches for an opportunity
 *
 * Query params:
 * - type: 'contact' | 'user' (default: 'contact')
 */
opportunityRoutes.get(
  '/:opportunityId/matches/itemized',
  itemizedMatchController.getOpportunityMatches.bind(itemizedMatchController)
);

/**
 * GET /api/v1/opportunities/:opportunityId/matches/itemized/:candidateId
 * Get itemized match between opportunity and specific candidate
 *
 * Query params:
 * - type: 'contact' | 'user' (default: 'contact')
 */
opportunityRoutes.get(
  '/:opportunityId/matches/itemized/:candidateId',
  itemizedMatchController.getOpportunityMatch.bind(itemizedMatchController)
);

export default opportunityRoutes;
