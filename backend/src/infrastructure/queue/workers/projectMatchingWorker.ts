/**
 * Project Matching Worker
 *
 * Background worker for project collaboration matching jobs.
 * Processes matching asynchronously and notifies users via WebSocket.
 *
 * @module infrastructure/queue/workers/projectMatchingWorker
 */

import { Job } from 'bullmq';
import { prisma } from '../../database/prisma/client.js';
import { logger } from '../../../shared/logger/index.js';
import { emitProjectMatchComplete, emitProjectMatchProgress } from '../../websocket/index.js';
import { queueService, QueueName, ProjectMatchingJobData } from '../QueueService.js';
import { ProjectMatchingService } from '../../external/projects/ProjectMatchingService.js';

/**
 * Project matching result
 */
interface ProjectMatchingResult {
  projectId: string;
  matchCount: number;
  status: 'completed' | 'failed';
  error?: string;
}

// Initialize matching service
const matchingService = new ProjectMatchingService(prisma);

/**
 * Process project matching job
 */
async function processProjectMatchingJob(job: Job<ProjectMatchingJobData>): Promise<ProjectMatchingResult> {
  const { projectId, userId, triggerType } = job.data;

  logger.info('Processing project matching job', {
    jobId: job.id,
    projectId,
    userId,
    triggerType,
  });

  try {
    await job.updateProgress(5);

    // Verify project exists and belongs to user
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        userId,
      },
    });

    if (!project) {
      throw new Error(`Project not found or unauthorized: ${projectId}`);
    }

    await job.updateProgress(10);

    // Emit progress to user
    emitProjectMatchProgress(userId, projectId, 10, 'Starting match search...');

    // Run the matching service
    await job.updateProgress(20);
    emitProjectMatchProgress(userId, projectId, 20, 'Extracting project keywords...');

    const matches = await matchingService.findMatchesForProject(projectId, userId);

    await job.updateProgress(90);
    emitProjectMatchProgress(userId, projectId, 90, 'Saving matches...');

    // Update project with last matched timestamp
    await prisma.project.update({
      where: { id: projectId },
      data: { updatedAt: new Date() },
    });

    await job.updateProgress(100);

    // Emit completion to user
    emitProjectMatchComplete(userId, projectId, matches.length, 'completed');

    logger.info('Project matching job completed', {
      jobId: job.id,
      projectId,
      matchCount: matches.length,
    });

    return {
      projectId,
      matchCount: matches.length,
      status: 'completed',
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    logger.error('Project matching job failed', {
      jobId: job.id,
      projectId,
      error: errorMessage,
    });

    // Emit failure to user
    emitProjectMatchComplete(userId, projectId, 0, 'failed', errorMessage);

    throw error;
  }
}

/**
 * Start project matching worker
 */
export function startProjectMatchingWorker(): void {
  queueService.registerWorker<ProjectMatchingJobData, ProjectMatchingResult>(
    QueueName.PROJECT_MATCHING,
    processProjectMatchingJob,
    {
      concurrency: 3, // Process up to 3 projects at a time
      limiter: {
        max: 10,
        duration: 60000, // 10 jobs per minute to avoid API rate limits
      },
    }
  );

  logger.info('Project matching worker started');
}

/**
 * Schedule daily rematch for all active projects
 * Runs every day at 3 AM
 */
export async function scheduleProjectRematchJobs(): Promise<void> {
  if (!queueService.isAvailable()) {
    logger.warn('Queue not available, skipping project rematch scheduling');
    return;
  }

  try {
    // Find all active projects that haven't been matched in the last 24 hours
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const projects = await prisma.project.findMany({
      where: {
        isActive: true,
        updatedAt: { lt: oneDayAgo },
      },
      select: {
        id: true,
        userId: true,
      },
      take: 100, // Limit batch size
    });

    logger.info('Scheduling project rematch jobs', { projectCount: projects.length });

    for (let i = 0; i < projects.length; i++) {
      const project = projects[i];
      await queueService.addProjectMatchingJob(
        {
          projectId: project.id,
          userId: project.userId,
          triggerType: 'scheduled',
        },
        {
          delay: i * 30000, // Stagger jobs 30 seconds apart
          priority: 10, // Lower priority than manual triggers
        }
      );
    }

    logger.info('Project rematch jobs scheduled', { scheduled: projects.length });
  } catch (error) {
    logger.error('Failed to schedule project rematch jobs', error);
  }
}

/**
 * Trigger manual project matching
 * Returns the job ID for status tracking
 */
export async function triggerProjectMatching(
  projectId: string,
  userId: string
): Promise<{ jobId: string | null; queued: boolean }> {
  if (!queueService.isAvailable()) {
    logger.warn('Queue not available, project matching will run synchronously');
    return { jobId: null, queued: false };
  }

  const job = await queueService.addProjectMatchingJob({
    projectId,
    userId,
    triggerType: 'manual',
  });

  if (job) {
    logger.info('Project matching job queued', { jobId: job.id, projectId });
    return { jobId: job.id || null, queued: true };
  }

  return { jobId: null, queued: false };
}

/**
 * Get project matching job status
 */
export async function getProjectMatchingJobStatus(jobId: string) {
  return queueService.getJobStatus(QueueName.PROJECT_MATCHING, jobId);
}

export default startProjectMatchingWorker;
