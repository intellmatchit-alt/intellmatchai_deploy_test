/**
 * Notification Worker
 *
 * Background worker for sending match notifications.
 * Handles:
 * - High-score match alerts
 * - Daily recommendation emails
 * - Weekly digest emails
 *
 * @module infrastructure/queue/workers/notificationWorker
 */

import { Job } from 'bullmq';
import { prisma } from '../../database/prisma/client';
import { logger } from '../../../shared/logger';
import { queueService, QueueName } from '../QueueService';
import { emailService } from '../../services/EmailService';
import { getMatchingService } from '../../external/matching';

/**
 * Notification job types
 */
export type NotificationJobType =
  | 'high-score-match'
  | 'daily-recommendations'
  | 'weekly-digest';

/**
 * Notification job data
 */
export interface NotificationJobData {
  type: NotificationJobType;
  userId?: string;
  contactId?: string;
  matchScore?: number;
}

const matchingService = getMatchingService();
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://app.p2pnetwork.com';

/**
 * Send high-score match notification to a user
 */
async function sendHighScoreMatchNotification(
  job: Job<NotificationJobData>
): Promise<{ sent: boolean }> {
  const { userId, contactId, matchScore } = job.data;

  if (!userId || !contactId || matchScore === undefined) {
    throw new Error('userId, contactId, and matchScore are required for high-score-match');
  }

  logger.info('Sending high-score match notification', { userId, contactId, matchScore });

  try {
    // Get user and contact details
    const [user, contact] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: { email: true, fullName: true },
      }),
      prisma.contact.findUnique({
        where: { id: contactId },
        select: { fullName: true, company: true, jobTitle: true },
      }),
    ]);

    if (!user?.email || !contact) {
      logger.warn('User or contact not found for notification', { userId, contactId });
      return { sent: false };
    }

    // Get match details for reasons
    const matchDetails = await matchingService.getMatchDetails(userId, contactId);
    const reasons = matchDetails?.reasons || ['Strong profile match'];

    const success = await emailService.sendMatchNotification(user.email, {
      userName: user.fullName || 'there',
      contactName: contact.fullName,
      contactCompany: contact.company || undefined,
      contactJobTitle: contact.jobTitle || undefined,
      matchScore,
      matchReasons: reasons,
      viewMatchUrl: `${FRONTEND_URL}/contacts/${contactId}`,
    });

    logger.info('High-score match notification sent', { userId, contactId, success });
    return { sent: success };
  } catch (error) {
    logger.error('Failed to send high-score match notification', { userId, contactId, error });
    throw error;
  }
}

/**
 * Send daily recommendations to all users with enabled notifications
 */
async function sendDailyRecommendations(
  job: Job<NotificationJobData>
): Promise<{ usersSent: number }> {
  logger.info('Starting daily recommendations notification job');

  let usersSent = 0;

  try {
    // Get all active users (in future, filter by notification preferences)
    const users = await prisma.user.findMany({
      where: { isActive: true },
      select: { id: true, email: true, fullName: true },
    });

    await job.updateProgress(5);

    for (let i = 0; i < users.length; i++) {
      const user = users[i];

      try {
        // Get daily recommendations
        const recommendations = await matchingService.getDailyRecommendations(user.id, 3);

        if (recommendations.length === 0) continue;

        const success = await emailService.sendDailyRecommendation(user.email, {
          userName: user.fullName || 'there',
          recommendations: recommendations.map((rec) => ({
            name: rec.contact.name,
            company: rec.contact.company,
            reason: rec.recommendationReason,
            viewUrl: `${FRONTEND_URL}/contacts/${rec.contact.id}`,
          })),
          dashboardUrl: `${FRONTEND_URL}/dashboard`,
        });

        if (success) usersSent++;
      } catch (error) {
        logger.warn('Failed to send daily recommendation to user', {
          userId: user.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }

      // Update progress
      if (i % 10 === 0) {
        await job.updateProgress(5 + Math.round((i / users.length) * 90));
      }
    }

    await job.updateProgress(100);
    logger.info('Daily recommendations sent', { usersSent, totalUsers: users.length });
    return { usersSent };
  } catch (error) {
    logger.error('Failed to send daily recommendations', error);
    throw error;
  }
}

/**
 * Send weekly digest to all users
 */
async function sendWeeklyDigest(
  job: Job<NotificationJobData>
): Promise<{ usersSent: number }> {
  logger.info('Starting weekly digest notification job');

  let usersSent = 0;
  const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  try {
    const users = await prisma.user.findMany({
      where: { isActive: true },
      select: { id: true, email: true, fullName: true },
    });

    await job.updateProgress(5);

    for (let i = 0; i < users.length; i++) {
      const user = users[i];

      try {
        // Get top matches
        const matches = await matchingService.getMatches(user.id, { limit: 5, minScore: 50 });

        // Get new connections count
        const newConnections = await prisma.contact.count({
          where: {
            ownerId: user.id,
            createdAt: { gte: oneWeekAgo },
          },
        });

        if (matches.length === 0 && newConnections === 0) continue;

        // Get contact details for top matches
        const topMatches = await Promise.all(
          matches.slice(0, 5).map(async (match) => {
            const contact = await prisma.contact.findUnique({
              where: { id: match.contactId },
              select: { fullName: true, company: true },
            });
            return {
              name: contact?.fullName || 'Unknown',
              company: contact?.company || undefined,
              score: match.score,
              reason: match.reasons?.[0] || 'Strong match',
            };
          })
        );

        const success = await emailService.sendWeeklyDigest(user.email, {
          userName: user.fullName || 'there',
          topMatches,
          newConnectionsCount: newConnections,
          viewAllUrl: `${FRONTEND_URL}/matches`,
        });

        if (success) usersSent++;
      } catch (error) {
        logger.warn('Failed to send weekly digest to user', {
          userId: user.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }

      if (i % 10 === 0) {
        await job.updateProgress(5 + Math.round((i / users.length) * 90));
      }
    }

    await job.updateProgress(100);
    logger.info('Weekly digest sent', { usersSent, totalUsers: users.length });
    return { usersSent };
  } catch (error) {
    logger.error('Failed to send weekly digest', error);
    throw error;
  }
}

/**
 * Process notification job
 */
async function processNotificationJob(
  job: Job<NotificationJobData>
): Promise<{ sent?: boolean; usersSent?: number }> {
  const { type } = job.data;

  switch (type) {
    case 'high-score-match':
      return sendHighScoreMatchNotification(job);
    case 'daily-recommendations':
      return sendDailyRecommendations(job);
    case 'weekly-digest':
      return sendWeeklyDigest(job);
    default:
      throw new Error(`Unknown notification job type: ${type}`);
  }
}

/**
 * Schedule recurring notification jobs
 */
export async function scheduleRecurringNotificationJobs(): Promise<void> {
  if (!queueService.isAvailable()) {
    logger.warn('Queue service not available, skipping scheduled notification jobs');
    return;
  }

  const queue = queueService.getQueue(QueueName.EMAIL);
  if (!queue) {
    logger.warn('Email queue not found, skipping scheduled notification jobs');
    return;
  }

  try {
    // Remove existing repeatable jobs
    const existingJobs = await queue.getRepeatableJobs();
    for (const job of existingJobs) {
      if (job.name.startsWith('scheduled-notification-')) {
        await queue.removeRepeatableByKey(job.key);
      }
    }

    // Schedule daily recommendations at 8 AM
    await queue.add(
      'scheduled-notification-daily',
      { type: 'daily-recommendations' } as NotificationJobData,
      {
        repeat: {
          pattern: '0 8 * * *', // Every day at 8 AM
        },
        jobId: 'scheduled-notification-daily',
      }
    );
    logger.info('Scheduled daily recommendation notifications at 8 AM');

    // Schedule weekly digest on Monday at 9 AM
    await queue.add(
      'scheduled-notification-weekly',
      { type: 'weekly-digest' } as NotificationJobData,
      {
        repeat: {
          pattern: '0 9 * * 1', // Every Monday at 9 AM
        },
        jobId: 'scheduled-notification-weekly',
      }
    );
    logger.info('Scheduled weekly digest notifications on Mondays at 9 AM');

    logger.info('Recurring notification jobs scheduled successfully');
  } catch (error) {
    logger.error('Failed to schedule recurring notification jobs', error);
  }
}

/**
 * Trigger high-score match notification
 */
export async function triggerMatchNotification(
  userId: string,
  contactId: string,
  matchScore: number
): Promise<string | null> {
  // Only send for high scores (80+)
  if (matchScore < 80) return null;

  const job = await queueService.addJob<NotificationJobData>(
    QueueName.EMAIL,
    'high-score-match-notification',
    { type: 'high-score-match', userId, contactId, matchScore },
    { jobId: `match-notification-${userId}-${contactId}` }
  );

  return job?.id || null;
}

/**
 * Start notification worker
 */
export function startNotificationWorker(): void {
  const worker = queueService.registerWorker<NotificationJobData, { sent?: boolean; usersSent?: number }>(
    QueueName.EMAIL,
    processNotificationJob,
    {
      concurrency: 5,
      limiter: {
        max: 50,
        duration: 60000, // 50 emails per minute
      },
    }
  );

  if (worker) {
    logger.info('Notification worker started');
  }
}

export default {
  startNotificationWorker,
  scheduleRecurringNotificationJobs,
  triggerMatchNotification,
};
