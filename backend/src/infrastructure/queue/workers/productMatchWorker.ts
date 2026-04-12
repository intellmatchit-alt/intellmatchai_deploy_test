/**
 * Product Match Worker
 *
 * Background worker for product match jobs (Sell Smarter feature).
 * Processes matching asynchronously for large contact lists (>200 contacts)
 * and notifies users via WebSocket.
 *
 * @module infrastructure/queue/workers/productMatchWorker
 */

import { Job } from 'bullmq';
import { logger } from '../../../shared/logger/index.js';
import { emitProductMatchProgress, emitProductMatchComplete } from '../../websocket/index.js';
import { queueService, QueueName, ProductMatchJobData } from '../QueueService.js';
import { ProductMatchingService } from '../../services/product/ProductMatchingService.js';
import { PrismaProductMatchRunRepository, PrismaProductMatchResultRepository, PrismaContactMatchingRepository, PrismaProductProfileRepository } from '../../repositories/PrismaProductMatchRepository.js';
import { ProductMatchRunStatus, ProductMatchScoringResult } from '../../../domain/entities/ProductMatch.js';

/**
 * Product match result
 */
interface ProductMatchWorkerResult {
  runId: string;
  matchCount: number;
  avgScore: number;
  status: 'completed' | 'failed';
  error?: string;
}

// Initialize repositories (they use the singleton prisma internally)
const profileRepository = new PrismaProductProfileRepository();
const runRepository = new PrismaProductMatchRunRepository();
const resultRepository = new PrismaProductMatchResultRepository();
const contactRepository = new PrismaContactMatchingRepository();

// Initialize matching service
const matchingService = new ProductMatchingService();

/**
 * Process product match job
 */
async function processProductMatchJob(job: Job<ProductMatchJobData>): Promise<ProductMatchWorkerResult> {
  const { runId, userId } = job.data;

  logger.info('Processing product match job', {
    jobId: job.id,
    runId,
    userId,
  });

  try {
    await job.updateProgress(5);

    // Update run status to RUNNING
    await runRepository.update(runId, {
      status: ProductMatchRunStatus.RUNNING,
      progress: 5,
      startedAt: new Date(),
    });

    // Emit progress to user
    emitProductMatchProgress(userId, runId, 5, 'Starting match analysis...');

    // Get the run to find profile ID
    const run = await runRepository.findById(runId);
    if (!run) {
      throw new Error(`Match run not found: ${runId}`);
    }

    // Get product profile
    const profile = await profileRepository.findById(run.productProfileId);
    if (!profile) {
      throw new Error(`Product profile not found: ${run.productProfileId}`);
    }

    await job.updateProgress(10);
    await runRepository.update(runId, { progress: 10 });
    emitProductMatchProgress(userId, runId, 10, 'Loading contacts...');

    // Get all contacts for user
    const contacts = await contactRepository.findContactsForMatching(userId);
    const totalContacts = contacts.length;

    if (totalContacts === 0) {
      throw new Error('No contacts found to match');
    }

    await runRepository.update(runId, {
      totalContacts,
      progress: 15,
    });

    await job.updateProgress(15);
    emitProductMatchProgress(userId, runId, 15, `Analyzing ${totalContacts} contacts...`);

    // Process contacts in batches
    const batchSize = 50;
    const results: ProductMatchScoringResult[] = [];

    let processedCount = 0;

    for (let i = 0; i < contacts.length; i += batchSize) {
      const batch = contacts.slice(i, Math.min(i + batchSize, contacts.length));

      // Process batch
      const batchResults = await matchingService.matchContacts(profile, batch);
      results.push(...batchResults);

      processedCount += batch.length;
      const progress = Math.min(15 + Math.floor((processedCount / totalContacts) * 70), 85);

      await job.updateProgress(progress);
      await runRepository.update(runId, { progress });
      emitProductMatchProgress(userId, runId, progress, `Scored ${processedCount} of ${totalContacts} contacts...`);
    }

    await job.updateProgress(85);
    emitProductMatchProgress(userId, runId, 85, 'Saving results...');

    // Save all results
    for (const result of results) {
      await resultRepository.create({
        matchRunId: runId,
        contactId: result.contactId,
        score: result.score,
        badge: result.badge,
        explanationJson: result.explanations,
        talkAngle: result.talkAngle,
        openerMessage: result.openerMessage,
        breakdownJson: result.breakdown,
      });
    }

    // Calculate stats
    const matchCount = results.length;
    const avgScore = matchCount > 0
      ? Math.round(results.reduce((sum, r) => sum + r.score, 0) / matchCount)
      : 0;

    await job.updateProgress(95);
    await runRepository.update(runId, {
      progress: 95,
      matchCount,
      avgScore,
    });
    emitProductMatchProgress(userId, runId, 95, 'Finalizing...');

    // Mark as complete
    await runRepository.update(runId, {
      status: ProductMatchRunStatus.DONE,
      progress: 100,
      completedAt: new Date(),
    });

    await job.updateProgress(100);

    // Emit completion to user
    emitProductMatchComplete(userId, runId, matchCount, avgScore, 'completed');

    logger.info('Product match job completed', {
      jobId: job.id,
      runId,
      matchCount,
      avgScore,
    });

    return {
      runId,
      matchCount,
      avgScore,
      status: 'completed',
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    logger.error('Product match job failed', {
      jobId: job.id,
      runId,
      error: errorMessage,
    });

    // Update run status to FAILED
    await runRepository.update(runId, {
      status: ProductMatchRunStatus.FAILED,
      error: errorMessage,
      completedAt: new Date(),
    });

    // Emit failure to user
    emitProductMatchComplete(userId, runId, 0, 0, 'failed', errorMessage);

    throw error;
  }
}

/**
 * Start product match worker
 */
export function startProductMatchWorker(): void {
  queueService.registerWorker<ProductMatchJobData, ProductMatchWorkerResult>(
    QueueName.PRODUCT_MATCHING,
    processProductMatchJob,
    {
      concurrency: 3, // Process up to 3 runs at a time
      limiter: {
        max: 10,
        duration: 60000, // 10 jobs per minute to avoid overload
      },
    }
  );

  logger.info('Product match worker started');
}

/**
 * Trigger async product matching
 * Returns the job ID for status tracking
 */
export async function triggerProductMatchAsync(
  runId: string,
  userId: string
): Promise<{ jobId: string | null; queued: boolean }> {
  if (!queueService.isAvailable()) {
    logger.warn('Queue not available, product matching must run synchronously');
    return { jobId: null, queued: false };
  }

  const job = await queueService.addProductMatchJob({
    runId,
    userId,
  });

  if (job) {
    // Update run with bull job ID
    await runRepository.update(runId, {
      bullJobId: job.id || undefined,
    });

    logger.info('Product match job queued', { jobId: job.id, runId });
    return { jobId: job.id || null, queued: true };
  }

  return { jobId: null, queued: false };
}

/**
 * Get product match job status
 */
export async function getProductMatchJobStatus(jobId: string) {
  return queueService.getJobStatus(QueueName.PRODUCT_MATCHING, jobId);
}

export default startProductMatchWorker;
