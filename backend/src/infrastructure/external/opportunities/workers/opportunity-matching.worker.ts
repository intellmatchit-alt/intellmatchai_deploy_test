/**
 * Opportunity Matching Worker
 *
 * BullMQ worker for async opportunity matching.
 * Features:
 * - Retry with exponential backoff
 * - Progress reporting
 * - Redis pub/sub for real-time updates
 * - Graceful shutdown
 *
 * @module workers/opportunity-matching.worker
 */

import { Job, Worker, Queue, QueueEvents } from 'bullmq';
import { logger } from '../../../../shared/logger';
import { prisma } from '../../../database/prisma/client';
import { redisConnection } from '../../../database/redis/client';
import {
  OpportunityMatchingJobData,
  MatchingProgressEvent,
  MatchingJobResult,
  MatchingConfig,
  DEFAULT_MATCHING_CONFIG,
} from '../types/opportunity-matching.types';
import { createOpportunityMatchingService } from '../services/opportunity-matching.service';

// ============================================================================
// Constants
// ============================================================================

const QUEUE_NAME = 'opportunity-matching-v2';
const WORKER_CONCURRENCY = 3;
const MAX_ATTEMPTS = 3;
const BACKOFF_DELAY = 5000;

// ============================================================================
// Queue Setup
// ============================================================================

let matchingQueue: Queue<OpportunityMatchingJobData> | null = null;
let queueEvents: QueueEvents | null = null;

/**
 * Get or create the matching queue
 */
export function getOpportunityMatchingQueue(): Queue<OpportunityMatchingJobData> {
  if (!matchingQueue) {
    matchingQueue = new Queue<OpportunityMatchingJobData>(QUEUE_NAME, {
      connection: redisConnection,
      defaultJobOptions: {
        attempts: MAX_ATTEMPTS,
        backoff: {
          type: 'exponential',
          delay: BACKOFF_DELAY,
        },
        removeOnComplete: {
          age: 24 * 3600,
          count: 1000,
        },
        removeOnFail: {
          age: 7 * 24 * 3600,
        },
      },
    });

    logger.info('Opportunity matching queue initialized', { queueName: QUEUE_NAME });
  }

  return matchingQueue;
}

/**
 * Get queue events for monitoring
 */
export function getQueueEvents(): QueueEvents {
  if (!queueEvents) {
    queueEvents = new QueueEvents(QUEUE_NAME, {
      connection: redisConnection,
    });
  }
  return queueEvents;
}

// ============================================================================
// Job Scheduling
// ============================================================================

/**
 * Enqueue an opportunity matching job
 */
export async function enqueueOpportunityMatching(
  data: OpportunityMatchingJobData
): Promise<string> {
  const queue = getOpportunityMatchingQueue();

  const job = await queue.add('match', data, {
    priority: data.priority || 5,
    jobId: `opp-match-v2-${data.intentId}-${Date.now()}`,
  });

  logger.info('Opportunity matching job enqueued', {
    jobId: job.id,
    userId: data.userId,
    intentId: data.intentId,
    priority: data.priority || 5,
  });

  return job.id!;
}

/**
 * Get job status
 */
export async function getJobStatus(jobId: string): Promise<{
  status: 'waiting' | 'active' | 'completed' | 'failed' | 'delayed' | 'unknown';
  progress: number;
  result?: MatchingJobResult;
  error?: string;
}> {
  const queue = getOpportunityMatchingQueue();
  const job = await queue.getJob(jobId);

  if (!job) {
    return { status: 'unknown', progress: 0 };
  }

  const state = await job.getState();
  const progress = typeof job.progress === 'number' ? job.progress : 0;

  return {
    status: state as any,
    progress,
    result: job.returnvalue as MatchingJobResult | undefined,
    error: job.failedReason,
  };
}

/**
 * Cancel a pending job
 */
export async function cancelJob(jobId: string): Promise<boolean> {
  const queue = getOpportunityMatchingQueue();
  const job = await queue.getJob(jobId);

  if (!job) return false;

  const state = await job.getState();
  if (state === 'waiting' || state === 'delayed') {
    await job.remove();
    logger.info('Opportunity matching job cancelled', { jobId });
    return true;
  }

  return false;
}

/**
 * Get jobs for a user
 */
export async function getUserJobs(userId: string): Promise<Array<{
  jobId: string;
  status: string;
  progress: number;
  createdAt: Date;
}>> {
  const queue = getOpportunityMatchingQueue();
  const jobs = await queue.getJobs(['waiting', 'active', 'completed', 'failed']);

  const userJobs = jobs.filter(job => job.data.userId === userId);

  return Promise.all(
    userJobs.map(async job => ({
      jobId: job.id!,
      status: await job.getState(),
      progress: typeof job.progress === 'number' ? job.progress : 0,
      createdAt: new Date(job.timestamp),
    }))
  );
}

// ============================================================================
// Worker Implementation
// ============================================================================

/**
 * Process an opportunity matching job
 */
async function processMatchingJob(
  job: Job<OpportunityMatchingJobData>
): Promise<MatchingJobResult> {
  const { userId, intentId, organizationId, config: jobConfig } = job.data;
  const startTime = Date.now();

  logger.info('Processing opportunity matching job', {
    jobId: job.id,
    userId,
    intentId,
    attempt: job.attemptsMade + 1,
    maxAttempts: MAX_ATTEMPTS,
  });

  try {
    // Stage 1: Loading (5%)
    await updateProgress(job, 'LOADING', 5, 'Loading user intent and profile...');

    // Validate input
    if (!userId || !intentId) {
      throw new Error('Missing required job data: userId or intentId');
    }

    // Create service with custom config
    const matchingConfig: Partial<MatchingConfig> = {
      ...DEFAULT_MATCHING_CONFIG,
      ...jobConfig,
    };
    const service = createOpportunityMatchingService(prisma, matchingConfig);

    // Stage 2: Filtering (15%)
    await updateProgress(job, 'FILTERING', 15, 'Finding and filtering candidates...');

    // Stage 3: Scoring (40%)
    await updateProgress(job, 'SCORING', 40, 'Scoring candidates...');

    // Run matching
    const matches = await service.findMatchesForIntent(userId, intentId, organizationId);

    // Stage 4: Complete (100%)
    await updateProgress(job, 'COMPLETE', 100, `Found ${matches.length} matches`);

    const durationMs = Date.now() - startTime;

    logger.info('Opportunity matching job completed', {
      jobId: job.id,
      userId,
      intentId,
      matchCount: matches.length,
      durationMs,
    });
    // Retrieve pipeline statistics from the service
    const stats = service.getLastMatchStats();
    // Compute combined filteredOut for backward compatibility
    const filteredOut = stats
      ? stats.filteredOutDeterministic + stats.filteredOutPostAI
      : 0;

    return {
      success: true,
      intentId,
      matchCount: matches.length,
      filteredOut,
      sparseProfilesFiltered: 0,
      durationMs,
      stats,
    };
  } catch (error) {
    const durationMs = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    logger.error('Opportunity matching job failed', {
      jobId: job.id,
      userId,
      intentId,
      error: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
      durationMs,
      attempt: job.attemptsMade + 1,
    });

    await updateProgress(job, 'FAILED', 0, `Matching failed: ${errorMessage}`);

    throw error;
  }
}

/**
 * Update job progress
 */
async function updateProgress(
  job: Job<OpportunityMatchingJobData>,
  stage: MatchingProgressEvent['stage'],
  progress: number,
  message: string
): Promise<void> {
  const event: MatchingProgressEvent = {
    jobId: job.id!,
    intentId: job.data.intentId,
    stage,
    progress,
    message,
  };

  try {
    await job.updateProgress(progress);

    // Publish to Redis for real-time updates
    if (redisConnection && typeof (redisConnection as any).publish === 'function') {
      await (redisConnection as any).publish(
        `opportunity:match:progress:${job.data.userId}`,
        JSON.stringify(event)
      );
    }
  } catch (error) {
    logger.warn('Failed to update job progress', {
      jobId: job.id,
      stage,
      error: error instanceof Error ? error.message : 'Unknown',
    });
  }
}

// ============================================================================
// Worker Lifecycle
// ============================================================================

let worker: Worker<OpportunityMatchingJobData, MatchingJobResult> | null = null;

/**
 * Start the opportunity matching worker
 */
export function startOpportunityMatchingWorker(): Worker<OpportunityMatchingJobData, MatchingJobResult> {
  if (worker) {
    logger.warn('Opportunity matching worker already running');
    return worker;
  }

  worker = new Worker<OpportunityMatchingJobData, MatchingJobResult>(
    QUEUE_NAME,
    processMatchingJob,
    {
      connection: redisConnection,
      concurrency: WORKER_CONCURRENCY,
      limiter: {
        max: 10,
        duration: 60000, // 10 jobs per minute max
      },
    }
  );

  // Event handlers
  worker.on('completed', (job, result) => {
    logger.debug('Job completed', {
      jobId: job.id,
      matchCount: result.matchCount,
      durationMs: result.durationMs,
    });
  });

  worker.on('failed', (job, error) => {
    logger.error('Job failed', {
      jobId: job?.id,
      error: error.message,
      attempts: job?.attemptsMade,
      maxAttempts: MAX_ATTEMPTS,
    });
  });

  worker.on('error', (error) => {
    logger.error('Worker error', { error: error.message });
  });

  worker.on('stalled', (jobId) => {
    logger.warn('Job stalled', { jobId });
  });

  worker.on('progress', (job, progress) => {
    logger.debug('Job progress', { jobId: job.id, progress });
  });

  logger.info('Opportunity matching worker started', {
    queueName: QUEUE_NAME,
    concurrency: WORKER_CONCURRENCY,
    maxAttempts: MAX_ATTEMPTS,
  });

  return worker;
}

/**
 * Stop the worker gracefully
 */
export async function stopOpportunityMatchingWorker(): Promise<void> {
  if (!worker) return;

  logger.info('Stopping opportunity matching worker...');

  try {
    // Close worker (waits for active jobs)
    await worker.close();
    worker = null;

    // Close queue
    if (matchingQueue) {
      await matchingQueue.close();
      matchingQueue = null;
    }

    // Close queue events
    if (queueEvents) {
      await queueEvents.close();
      queueEvents = null;
    }

    logger.info('Opportunity matching worker stopped');
  } catch (error) {
    logger.error('Error stopping worker', {
      error: error instanceof Error ? error.message : 'Unknown',
    });
    throw error;
  }
}

/**
 * Get worker health status
 */
export async function getWorkerHealth(): Promise<{
  isRunning: boolean;
  queueName: string;
  queueSize: number;
  activeJobs: number;
  completedToday: number;
  failedToday: number;
  workers: number;
}> {
  const queue = getOpportunityMatchingQueue();

  const [waiting, active, completed, failed] = await Promise.all([
    queue.getWaitingCount(),
    queue.getActiveCount(),
    queue.getCompletedCount(),
    queue.getFailedCount(),
  ]);

  return {
    isRunning: worker !== null,
    queueName: QUEUE_NAME,
    queueSize: waiting,
    activeJobs: active,
    completedToday: completed,
    failedToday: failed,
    workers: worker ? WORKER_CONCURRENCY : 0,
  };
}

// ============================================================================
// Scheduled Jobs
// ============================================================================

/**
 * Schedule recurring matching for stale intents
 */
export async function scheduleRecurringMatching(options: {
  maxStaleHours?: number;
  batchSize?: number;
} = {}): Promise<number> {
  const { maxStaleHours = 24, batchSize = 100 } = options;

  logger.info('Starting scheduled opportunity matching...', { maxStaleHours, batchSize });

  try {
    const staleThreshold = new Date(Date.now() - maxStaleHours * 60 * 60 * 1000);

    const staleIntents = await prisma.opportunityIntent.findMany({
      where: {
        isActive: true,
        OR: [
          { lastMatchedAt: null },
          { lastMatchedAt: { lt: staleThreshold } },
        ],
      },
      select: {
        id: true,
        userId: true,
        organizationId: true,
      },
      take: batchSize,
      orderBy: { lastMatchedAt: 'asc' },
    });

    logger.info(`Found ${staleIntents.length} stale intents for scheduled matching`);

    let enqueued = 0;
    for (const intent of staleIntents) {
      const orgId = intent.organizationId ?? undefined;

      await enqueueOpportunityMatching({
        userId: intent.userId,
        intentId: intent.id,
        organizationId: orgId,
        priority: 10, // Lower priority for scheduled jobs
      });

      enqueued++;

      // Small delay to avoid overwhelming queue
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    logger.info('Scheduled matching jobs enqueued', { count: enqueued });
    return enqueued;
  } catch (error) {
    logger.error('Failed to schedule recurring matching', {
      error: error instanceof Error ? error.message : 'Unknown',
    });
    throw error;
  }
}

/**
 * Clean up old completed/failed jobs
 */
export async function cleanupOldJobs(options: {
  completedMaxAge?: number; // hours
  failedMaxAge?: number; // hours
} = {}): Promise<{ cleaned: number }> {
  const { completedMaxAge = 24, failedMaxAge = 168 } = options; // 1 day, 7 days

  const queue = getOpportunityMatchingQueue();

  const completedBefore = Date.now() - completedMaxAge * 60 * 60 * 1000;
  const failedBefore = Date.now() - failedMaxAge * 60 * 60 * 1000;

  const [completed, failed] = await Promise.all([
    queue.clean(completedMaxAge * 60 * 60 * 1000, 1000, 'completed'),
    queue.clean(failedMaxAge * 60 * 60 * 1000, 1000, 'failed'),
  ]);

  const cleaned = completed.length + failed.length;

  logger.info('Cleaned up old jobs', {
    completed: completed.length,
    failed: failed.length,
    total: cleaned,
  });

  return { cleaned };
}
