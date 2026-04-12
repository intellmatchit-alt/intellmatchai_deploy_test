/**
 * Scheduled Matching Worker
 *
 * Background worker for scheduled re-matching jobs.
 * Runs periodic batch recalculations of match scores for all users.
 *
 * Schedules:
 * - Daily full recalculation (overnight)
 * - Hourly delta recalculation (recently updated contacts)
 * - On-demand batch recalculation
 *
 * @module infrastructure/queue/workers/scheduledMatchingWorker
 */

import { Job } from 'bullmq';
import { prisma } from '../../database/prisma/client';
import { logger } from '../../../shared/logger';
import { queueService, QueueName } from '../QueueService';
import { getMatchingService } from '../../external/matching';
import { matchHistoryService } from '../../external/matching/MatchHistoryService';
import { cacheService, CACHE_KEYS } from '../../cache/CacheService';

/**
 * Scheduled matching job types
 */
export type ScheduledMatchingJobType =
  | 'daily-full'      // Full recalculation for all users
  | 'hourly-delta'    // Delta recalculation for recently updated
  | 'batch-user'      // Batch recalculation for a specific user
  | 'batch-contacts'; // Batch recalculation for specific contacts

/**
 * Scheduled matching job data
 */
export interface ScheduledMatchingJobData {
  type: ScheduledMatchingJobType;
  userId?: string;
  contactIds?: string[];
  batchSize?: number;
  priority?: 'low' | 'normal' | 'high';
}

/**
 * Batch recalculation result
 */
export interface BatchRecalculationResult {
  type: ScheduledMatchingJobType;
  usersProcessed: number;
  contactsProcessed: number;
  averageScore: number;
  errors: number;
  durationMs: number;
}

const matchingService = getMatchingService();

/**
 * Process full daily recalculation
 * Runs for all active users, recalculating all contacts
 */
async function processDailyFullRecalculation(
  job: Job<ScheduledMatchingJobData>
): Promise<BatchRecalculationResult> {
  const startTime = Date.now();
  let usersProcessed = 0;
  let contactsProcessed = 0;
  let totalScore = 0;
  let errors = 0;

  logger.info('Starting daily full match recalculation', { jobId: job.id });

  try {
    // Get all active users
    const users = await prisma.user.findMany({
      where: { isActive: true },
      select: { id: true },
    });

    const totalUsers = users.length;
    await job.updateProgress(5);

    // Process each user
    for (let i = 0; i < users.length; i++) {
      const user = users[i];

      try {
        // Invalidate cache before recalculation
        await cacheService.delete(`${CACHE_KEYS.CONTACT_MATCHES}${user.id}`);

        // Get matches (this triggers recalculation)
        const matches = await matchingService.getMatches(user.id, {
          limit: 500,
          minScore: 0,
        });

        // Count results
        contactsProcessed += matches.length;
        totalScore += matches.reduce((sum, m) => sum + m.score, 0);
        usersProcessed++;

        // Update progress
        const progress = Math.round(5 + (i / totalUsers) * 90);
        await job.updateProgress(progress);

        // Log progress every 10 users
        if ((i + 1) % 10 === 0) {
          logger.debug('Daily recalculation progress', {
            processed: i + 1,
            total: totalUsers,
            contacts: contactsProcessed,
          });
        }
      } catch (error) {
        errors++;
        logger.warn('Failed to recalculate matches for user', {
          userId: user.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    await job.updateProgress(100);

    const result: BatchRecalculationResult = {
      type: 'daily-full',
      usersProcessed,
      contactsProcessed,
      averageScore: contactsProcessed > 0 ? Math.round(totalScore / contactsProcessed) : 0,
      errors,
      durationMs: Date.now() - startTime,
    };

    logger.info('Daily full recalculation completed', result);
    return result;
  } catch (error) {
    logger.error('Daily full recalculation failed', error);
    throw error;
  }
}

/**
 * Process hourly delta recalculation
 * Only recalculates for users with recently updated contacts
 */
async function processHourlyDeltaRecalculation(
  job: Job<ScheduledMatchingJobData>
): Promise<BatchRecalculationResult> {
  const startTime = Date.now();
  let usersProcessed = 0;
  let contactsProcessed = 0;
  let totalScore = 0;
  let errors = 0;

  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

  logger.info('Starting hourly delta match recalculation', { jobId: job.id });

  try {
    // Get users with recently updated contacts
    const usersWithUpdates = await prisma.contact.groupBy({
      by: ['ownerId'],
      where: {
        updatedAt: { gte: oneHourAgo },
      },
    });

    const userIds = usersWithUpdates.map((u) => u.ownerId);

    if (userIds.length === 0) {
      logger.info('No users with updated contacts in the last hour');
      return {
        type: 'hourly-delta',
        usersProcessed: 0,
        contactsProcessed: 0,
        averageScore: 0,
        errors: 0,
        durationMs: Date.now() - startTime,
      };
    }

    await job.updateProgress(10);

    // Process each user
    for (let i = 0; i < userIds.length; i++) {
      const userId = userIds[i];

      try {
        // Invalidate cache before recalculation
        await cacheService.delete(`${CACHE_KEYS.CONTACT_MATCHES}${userId}`);

        // Get matches (this triggers recalculation)
        const matches = await matchingService.getMatches(userId, {
          limit: 200,
          minScore: 0,
        });

        // Count results
        contactsProcessed += matches.length;
        totalScore += matches.reduce((sum, m) => sum + m.score, 0);
        usersProcessed++;

        // Update progress
        const progress = Math.round(10 + (i / userIds.length) * 85);
        await job.updateProgress(progress);
      } catch (error) {
        errors++;
        logger.warn('Failed to recalculate matches for user', {
          userId,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    await job.updateProgress(100);

    const result: BatchRecalculationResult = {
      type: 'hourly-delta',
      usersProcessed,
      contactsProcessed,
      averageScore: contactsProcessed > 0 ? Math.round(totalScore / contactsProcessed) : 0,
      errors,
      durationMs: Date.now() - startTime,
    };

    logger.info('Hourly delta recalculation completed', result);
    return result;
  } catch (error) {
    logger.error('Hourly delta recalculation failed', error);
    throw error;
  }
}

/**
 * Process batch recalculation for a specific user
 */
async function processBatchUserRecalculation(
  job: Job<ScheduledMatchingJobData>
): Promise<BatchRecalculationResult> {
  const startTime = Date.now();
  const { userId } = job.data;

  if (!userId) {
    throw new Error('userId is required for batch-user job');
  }

  logger.info('Starting batch user match recalculation', { jobId: job.id, userId });

  try {
    await job.updateProgress(10);

    // Invalidate cache
    await cacheService.delete(`${CACHE_KEYS.CONTACT_MATCHES}${userId}`);

    // Get matches (this triggers recalculation)
    const matches = await matchingService.getMatches(userId, {
      limit: 500,
      minScore: 0,
    });

    await job.updateProgress(100);

    const totalScore = matches.reduce((sum, m) => sum + m.score, 0);

    const result: BatchRecalculationResult = {
      type: 'batch-user',
      usersProcessed: 1,
      contactsProcessed: matches.length,
      averageScore: matches.length > 0 ? Math.round(totalScore / matches.length) : 0,
      errors: 0,
      durationMs: Date.now() - startTime,
    };

    logger.info('Batch user recalculation completed', result);
    return result;
  } catch (error) {
    logger.error('Batch user recalculation failed', { userId, error });
    throw error;
  }
}

/**
 * Process batch recalculation for specific contacts
 */
async function processBatchContactsRecalculation(
  job: Job<ScheduledMatchingJobData>
): Promise<BatchRecalculationResult> {
  const startTime = Date.now();
  const { contactIds, userId } = job.data;
  let contactsProcessed = 0;
  let totalScore = 0;
  let errors = 0;

  if (!contactIds || contactIds.length === 0) {
    throw new Error('contactIds is required for batch-contacts job');
  }
  if (!userId) {
    throw new Error('userId is required for batch-contacts job');
  }

  logger.info('Starting batch contacts match recalculation', {
    jobId: job.id,
    userId,
    contactCount: contactIds.length,
  });

  try {
    await job.updateProgress(10);

    // Process each contact
    for (let i = 0; i < contactIds.length; i++) {
      const contactId = contactIds[i];

      try {
        const match = await matchingService.getMatchDetails(userId, contactId);
        if (match) {
          contactsProcessed++;
          totalScore += match.score;
        }
      } catch (error) {
        errors++;
        logger.warn('Failed to recalculate match for contact', {
          contactId,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }

      // Update progress
      const progress = Math.round(10 + (i / contactIds.length) * 85);
      await job.updateProgress(progress);
    }

    // Invalidate cache after recalculation
    await cacheService.delete(`${CACHE_KEYS.CONTACT_MATCHES}${userId}`);

    await job.updateProgress(100);

    const result: BatchRecalculationResult = {
      type: 'batch-contacts',
      usersProcessed: 1,
      contactsProcessed,
      averageScore: contactsProcessed > 0 ? Math.round(totalScore / contactsProcessed) : 0,
      errors,
      durationMs: Date.now() - startTime,
    };

    logger.info('Batch contacts recalculation completed', result);
    return result;
  } catch (error) {
    logger.error('Batch contacts recalculation failed', { userId, error });
    throw error;
  }
}

/**
 * Process scheduled matching job (router)
 */
async function processScheduledMatchingJob(
  job: Job<ScheduledMatchingJobData>
): Promise<BatchRecalculationResult> {
  const { type } = job.data;

  switch (type) {
    case 'daily-full':
      return processDailyFullRecalculation(job);
    case 'hourly-delta':
      return processHourlyDeltaRecalculation(job);
    case 'batch-user':
      return processBatchUserRecalculation(job);
    case 'batch-contacts':
      return processBatchContactsRecalculation(job);
    default:
      throw new Error(`Unknown scheduled matching job type: ${type}`);
  }
}

/**
 * Schedule recurring jobs
 * Should be called once during app initialization
 */
export async function scheduleRecurringMatchingJobs(): Promise<void> {
  if (!queueService.isAvailable()) {
    logger.warn('Queue service not available, skipping scheduled matching jobs');
    return;
  }

  const queue = queueService.getQueue(QueueName.MATCHING);
  if (!queue) {
    logger.warn('Matching queue not found, skipping scheduled jobs');
    return;
  }

  try {
    // Remove existing repeatable jobs first
    const existingJobs = await queue.getRepeatableJobs();
    for (const job of existingJobs) {
      if (job.name.startsWith('scheduled-')) {
        await queue.removeRepeatableByKey(job.key);
      }
    }

    // Schedule daily full recalculation at 3 AM
    await queue.add(
      'scheduled-daily-full',
      { type: 'daily-full' } as ScheduledMatchingJobData,
      {
        repeat: {
          pattern: '0 3 * * *', // Every day at 3 AM
        },
        jobId: 'scheduled-daily-full',
      }
    );
    logger.info('Scheduled daily full match recalculation at 3 AM');

    // Schedule hourly delta recalculation
    await queue.add(
      'scheduled-hourly-delta',
      { type: 'hourly-delta' } as ScheduledMatchingJobData,
      {
        repeat: {
          pattern: '0 * * * *', // Every hour on the hour
        },
        jobId: 'scheduled-hourly-delta',
      }
    );
    logger.info('Scheduled hourly delta match recalculation');

    logger.info('Recurring matching jobs scheduled successfully');
  } catch (error) {
    logger.error('Failed to schedule recurring matching jobs', error);
  }
}

/**
 * Trigger manual batch recalculation for a user
 */
export async function triggerUserRecalculation(userId: string): Promise<string | null> {
  const job = await queueService.addJob<ScheduledMatchingJobData>(
    QueueName.MATCHING,
    'batch-user-recalculation',
    { type: 'batch-user', userId },
    { jobId: `batch-user-${userId}-${Date.now()}` }
  );

  return job?.id || null;
}

/**
 * Trigger manual batch recalculation for specific contacts
 */
export async function triggerContactsRecalculation(
  userId: string,
  contactIds: string[]
): Promise<string | null> {
  const job = await queueService.addJob<ScheduledMatchingJobData>(
    QueueName.MATCHING,
    'batch-contacts-recalculation',
    { type: 'batch-contacts', userId, contactIds },
    { jobId: `batch-contacts-${userId}-${Date.now()}` }
  );

  return job?.id || null;
}

/**
 * Start scheduled matching worker
 */
export function startScheduledMatchingWorker(): void {
  const worker = queueService.registerWorker<ScheduledMatchingJobData, BatchRecalculationResult>(
    QueueName.MATCHING,
    processScheduledMatchingJob,
    {
      concurrency: 2, // Lower concurrency for batch jobs
      limiter: {
        max: 5,
        duration: 60000, // 5 jobs per minute max
      },
    }
  );

  if (worker) {
    logger.info('Scheduled matching worker started');
  }
}

export default {
  startScheduledMatchingWorker,
  scheduleRecurringMatchingJobs,
  triggerUserRecalculation,
  triggerContactsRecalculation,
};
