/**
 * Project Routes
 *
 * Routes for collaboration project management and matching.
 *
 * @module presentation/routes/project
 */

import { Router } from 'express';
import multer from 'multer';
import { projectController } from '../controllers/ProjectController';
import { itemizedMatchController } from '../controllers/ItemizedMatchController';
import { authenticate } from '../middleware/auth.middleware';
import { orgContext } from '../middleware/orgContext.middleware';
import { validate } from '../middleware/validate.middleware';
import { projectMatchingRateLimiter } from '../middleware/rateLimiter';
import {
  createProjectSchema,
  updateProjectSchema,
  listProjectsSchema,
  getProjectSchema,
  deleteProjectSchema,
  findMatchesSchema,
  getMatchesSchema,
  updateMatchStatusSchema,
  discoverProjectsSchema,
} from '../schemas/project.schemas';

export const projectRoutes = Router();

// Configure multer for document uploads
const documentUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit for documents
  },
  fileFilter: (req, file, cb) => {
    // Accept PDF, Word, and text files
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

// All project routes require authentication
projectRoutes.use(authenticate);
projectRoutes.use(orgContext);

/**
 * GET /api/v1/projects/discover/all
 * Discover public projects from other users
 *
 * Query params:
 * - page: page number (default 1)
 * - limit: items per page (default 20)
 * - category: filter by category
 * - stage: filter by stage
 * - sector: filter by sector ID
 */
projectRoutes.get(
  '/discover/all',
  validate(discoverProjectsSchema),
  projectController.discover.bind(projectController)
);

/**
 * GET /api/v1/projects
 * Get paginated list of user's projects
 *
 * Query params:
 * - page: page number (default 1)
 * - limit: items per page (default 20, max 100)
 * - status: filter by isActive (active, inactive, all)
 */
projectRoutes.get(
  '/',
  validate(listProjectsSchema),
  projectController.list.bind(projectController)
);

/**
 * POST /api/v1/projects/analyze-text
 * AI-analyze project text and suggest category, sectors, skills, lookingFor
 *
 * Body: { title, summary, detailedDesc? }
 */
projectRoutes.post(
  '/analyze-text',
  projectController.analyzeText.bind(projectController)
);

/**
 * POST /api/v1/projects/extract-document
 * Extract project data from uploaded document using AI
 *
 * Body: multipart/form-data
 * - document: File (PDF, DOCX, DOC, or TXT)
 *
 * Returns extracted project fields that can be used to prefill the form
 */
projectRoutes.post(
  '/extract-document',
  documentUpload.single('document'),
  projectController.extractFromDocument.bind(projectController)
);

/**
 * POST /api/v1/projects
 * Create a new project
 *
 * Body:
 * - title: string (required)
 * - summary: string (required)
 * - detailedDesc?: string
 * - category?: string
 * - stage?: 'IDEA' | 'VALIDATION' | 'MVP' | 'LAUNCHED' | 'GROWTH' | 'SCALING'
 * - investmentRange?: string
 * - timeline?: string
 * - lookingFor?: string[] (e.g., ['cofounder', 'investor', 'technical_partner'])
 * - sectorIds?: string[]
 * - skills?: Array<{ skillId: string, importance?: 'REQUIRED' | 'PREFERRED' | 'NICE_TO_HAVE' }>
 * - visibility?: 'PUBLIC' | 'PRIVATE' | 'CONNECTIONS_ONLY'
 */
projectRoutes.post(
  '/',
  validate(createProjectSchema),
  projectController.create.bind(projectController)
);

/**
 * GET /api/v1/projects/:id
 * Get project details with matches
 */
projectRoutes.get(
  '/:id',
  validate(getProjectSchema),
  projectController.get.bind(projectController)
);

/**
 * PUT /api/v1/projects/:id
 * Update project
 *
 * Body: (all optional)
 * - title?: string
 * - summary?: string
 * - detailedDesc?: string
 * - category?: string
 * - stage?: ProjectStage
 * - investmentRange?: string
 * - timeline?: string
 * - lookingFor?: string[]
 * - sectorIds?: string[]
 * - skills?: Array<{ skillId: string, importance?: SkillImportance }>
 * - visibility?: ProjectVisibility
 * - isActive?: boolean
 */
projectRoutes.put(
  '/:id',
  validate(updateProjectSchema),
  projectController.update.bind(projectController)
);

/**
 * DELETE /api/v1/projects/:id
 * Delete project (cascades to matches)
 */
projectRoutes.delete(
  '/:id',
  validate(deleteProjectSchema),
  projectController.delete.bind(projectController)
);

/**
 * POST /api/v1/projects/:id/find-matches
 * Trigger AI matching process for project
 *
 * Query params:
 * - async: 'true' to run matching in background (returns job ID)
 *
 * Runs the full matching pipeline:
 * 1. Extract keywords from project (LLM)
 * 2. Find candidate users and contacts
 * 3. Score and rank candidates (enhanced with Recombee ML - 3.5)
 * 4. Rerank results with Cohere (3.6)
 * 5. Generate explanations (LLM) with caching (3.11)
 * 6. Save matches to database
 *
 * In async mode, returns 202 with jobId.
 * Use GET /projects/:id/match-status/:jobId to check status.
 * WebSocket events 'project:match:progress' and 'project:match:complete' are emitted.
 *
 * Rate limited to 5 requests per minute per user (3.12)
 */
projectRoutes.post(
  '/:id/find-matches',
  projectMatchingRateLimiter, // 3.12 Rate limiting for AI matching
  validate(findMatchesSchema),
  projectController.findMatches.bind(projectController)
);

/**
 * GET /api/v1/projects/:id/match-status/:jobId
 * Get the status of an async matching job
 *
 * Returns:
 * - id: job ID
 * - status: 'waiting' | 'active' | 'completed' | 'failed'
 * - progress: 0-100
 * - result: match results if completed
 * - error: error message if failed
 */
projectRoutes.get(
  '/:id/match-status/:jobId',
  projectController.getMatchJobStatus.bind(projectController)
);

/**
 * GET /api/v1/projects/:id/matches
 * Get matches for a project
 *
 * Query params:
 * - type: filter by matchType (user, contact, all)
 * - status: filter by status (pending, contacted, saved, dismissed, connected)
 * - minScore: minimum match score (0-100)
 */
projectRoutes.get(
  '/:id/matches',
  validate(getMatchesSchema),
  projectController.getMatches.bind(projectController)
);

/**
 * PUT /api/v1/projects/:id/matches/:matchId/status
 * Update match status
 *
 * Body:
 * - status: 'pending' | 'contacted' | 'saved' | 'dismissed' | 'connected'
 */
projectRoutes.put(
  '/:id/matches/:matchId/status',
  validate(updateMatchStatusSchema),
  projectController.updateMatchStatus.bind(projectController)
);

/**
 * GET /api/v1/projects/:projectId/matches/itemized
 * Get all itemized matches for a project against user's contacts
 *
 * Query params:
 * - type: 'investor' | 'partner' | 'talent' (default: 'investor')
 *
 * Returns list view of all contact matches scored against the project.
 */
projectRoutes.get(
  '/:projectId/matches/itemized',
  itemizedMatchController.getProjectMatches.bind(itemizedMatchController)
);

/**
 * GET /api/v1/projects/:id/matches/itemized/:targetId
 * Get itemized explainable match between project and potential collaborator
 *
 * Query params:
 * - type: 'investor' | 'partner' | 'talent' (default: 'investor')
 *
 * Returns per-criterion scores with detailed explanations.
 */
projectRoutes.get(
  '/:projectId/matches/itemized/:targetId',
  itemizedMatchController.getProjectMatch.bind(itemizedMatchController)
);

export default projectRoutes;
