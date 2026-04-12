/**
 * Team Member Routes
 * API endpoints for managing team members on Projects, Opportunities, Pitches, and Deals
 */

import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware.js';
import * as CollaborationController from '../controllers/CollaborationController';

const router = Router();

// All routes require authentication
router.use(authenticate);

// ============================================================================
// Project Team Routes
// ============================================================================

/**
 * @route GET /api/v1/projects/:id/team
 * @desc List team members for a project
 * @access Private (owner or team member)
 */
router.get('/projects/:sourceId/team', (req, res, next) => {
  (req.params as any).sourceType = 'project';
  CollaborationController.listTeamMembers(req, res, next);
});

/**
 * @route DELETE /api/v1/projects/:id/team/:memberId
 * @desc Remove a team member from a project
 * @access Private (owner only)
 */
router.delete('/projects/:sourceId/team/:memberId', (req, res, next) => {
  (req.params as any).sourceType = 'project';
  CollaborationController.removeTeamMember(req, res, next);
});

// ============================================================================
// Opportunity Team Routes
// ============================================================================

/**
 * @route GET /api/v1/opportunities/:id/team
 * @desc List team members for an opportunity
 * @access Private (owner or team member)
 */
router.get('/opportunities/:sourceId/team', (req, res, next) => {
  (req.params as any).sourceType = 'opportunity';
  CollaborationController.listTeamMembers(req, res, next);
});

/**
 * @route DELETE /api/v1/opportunities/:id/team/:memberId
 * @desc Remove a team member from an opportunity
 * @access Private (owner only)
 */
router.delete('/opportunities/:sourceId/team/:memberId', (req, res, next) => {
  (req.params as any).sourceType = 'opportunity';
  CollaborationController.removeTeamMember(req, res, next);
});

// ============================================================================
// Pitch Team Routes
// ============================================================================

/**
 * @route GET /api/v1/pitches/:id/team
 * @desc List team members for a pitch
 * @access Private (owner or team member)
 */
router.get('/pitches/:sourceId/team', (req, res, next) => {
  (req.params as any).sourceType = 'pitch';
  CollaborationController.listTeamMembers(req, res, next);
});

/**
 * @route DELETE /api/v1/pitches/:id/team/:memberId
 * @desc Remove a team member from a pitch
 * @access Private (owner only)
 */
router.delete('/pitches/:sourceId/team/:memberId', (req, res, next) => {
  (req.params as any).sourceType = 'pitch';
  CollaborationController.removeTeamMember(req, res, next);
});

// ============================================================================
// Deal Team Routes
// ============================================================================

/**
 * @route GET /api/v1/deals/:id/team
 * @desc List team members for a deal
 * @access Private (owner or team member)
 */
router.get('/deals/:sourceId/team', (req, res, next) => {
  (req.params as any).sourceType = 'deal';
  CollaborationController.listTeamMembers(req, res, next);
});

/**
 * @route DELETE /api/v1/deals/:id/team/:memberId
 * @desc Remove a team member from a deal
 * @access Private (owner only)
 */
router.delete('/deals/:sourceId/team/:memberId', (req, res, next) => {
  (req.params as any).sourceType = 'deal';
  CollaborationController.removeTeamMember(req, res, next);
});

export default router;
