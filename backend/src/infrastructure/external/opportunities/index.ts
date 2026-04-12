/**
 * Opportunity Matching Module v2
 *
 * @module intellmatch-jobs-matching
 *
 * Main entry point for Jobs/Opportunities matching system.
 */

// ============================================================================
// Types
// ============================================================================

export * from './types/opportunity-matching.types';

// ============================================================================
// Services
// ============================================================================

export {
  OpportunityMatchingService,
  createOpportunityMatchingService,
} from './services/opportunity-matching.service';

export {
  OpportunityLLMService,
  opportunityLLMService,
} from './services/opportunity-llm.service';

// ============================================================================
// Utils
// ============================================================================

export {
  scoreCandidate,
  normalizeToRoleFamily,
  inferCareerTrack,
  parseSeniority,
  parseExperience,
  applyHardFilters,
  calculateTrackCompatibility,
  calculateRoleAreaMatch,
  calculateTitleRelevance,
  calculateConfidence,
  calculateConfidenceScore,
  confidenceScoreToLevel,
  isSparseProfile,
  countDataPoints,
  areRoleFamiliesCompatible,
  calculateSeniorityFit,
} from './utils/opportunity-scoring.utils';

export {
  skillTaxonomyService,
} from './utils/skill-taxonomy-integration';

// ============================================================================
// Middleware
// ============================================================================

export {
  initializeRateLimiter,
  closeRateLimiter,
  checkRateLimit,
  getRateLimitStatus,
  rateLimitMiddleware,
  standardRateLimiter,
  asyncRateLimiter,
  statusRateLimiter,
  burstRateLimiter,
} from './middleware/opportunity-rate-limiter';

// ============================================================================
// Worker
// ============================================================================

export {
  getOpportunityMatchingQueue,
  getQueueEvents,
  enqueueOpportunityMatching,
  getJobStatus,
  cancelJob,
  getUserJobs,
  startOpportunityMatchingWorker,
  stopOpportunityMatchingWorker,
  getWorkerHealth,
  scheduleRecurringMatching,
  cleanupOldJobs,
} from './workers/opportunity-matching.worker';

// ============================================================================
// Controller & Routes
// ============================================================================

export { OpportunityMatchingController } from './controllers/opportunity-matching.controller';
export { default as opportunityMatchingRoutes } from './routes/opportunity-matching.routes';
