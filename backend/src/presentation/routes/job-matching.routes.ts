/**
 * Job Matching V3 Routes
 *
 * Routes for hiring profiles, candidate profiles, and the v3 matching engine.
 */

import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { HiringProfileController } from '../controllers/HiringProfileController';
import { CandidateProfileController } from '../controllers/CandidateProfileController';
import { createJobMatchingRoutes } from '../../infrastructure/external/opportunities/v3';
import { prisma } from '../../infrastructure/database/prisma/client';

const router = Router();

// All routes require authentication
router.use(authenticate);

// --------------------------------------------------------------------------
// Hiring Profile CRUD
// --------------------------------------------------------------------------
const hiringCtrl = new HiringProfileController();
router.post('/hiring-profiles', hiringCtrl.create.bind(hiringCtrl));
router.get('/hiring-profiles', hiringCtrl.getAll.bind(hiringCtrl));
router.get('/hiring-profiles/:id', hiringCtrl.getById.bind(hiringCtrl));
router.patch('/hiring-profiles/:id', hiringCtrl.update.bind(hiringCtrl));
router.delete('/hiring-profiles/:id', hiringCtrl.delete.bind(hiringCtrl));

// --------------------------------------------------------------------------
// Candidate Profile CRUD
// --------------------------------------------------------------------------
const candidateCtrl = new CandidateProfileController();
router.post('/candidate-profiles', candidateCtrl.create.bind(candidateCtrl));
router.get('/candidate-profiles', candidateCtrl.getAll.bind(candidateCtrl));
router.get('/candidate-profiles/:id', candidateCtrl.getById.bind(candidateCtrl));
router.patch('/candidate-profiles/:id', candidateCtrl.update.bind(candidateCtrl));
router.delete('/candidate-profiles/:id', candidateCtrl.delete.bind(candidateCtrl));

// --------------------------------------------------------------------------
// V3 Matching Engine (POST /:jobId/matches, GET /:jobId/matches, extract, health)
// --------------------------------------------------------------------------
const v3MatchingRoutes = createJobMatchingRoutes({ prisma, authMiddleware: authenticate });
router.use('/jobs', v3MatchingRoutes);

export const jobMatchingRoutes = router;
export default router;
