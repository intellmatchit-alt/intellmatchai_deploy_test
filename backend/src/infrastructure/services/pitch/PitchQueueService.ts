/**
 * PNME Queue Service
 *
 * Manages BullMQ queues for pitch processing pipeline.
 * Handles job creation, progress tracking, and error handling.
 *
 * @module infrastructure/services/pitch/PitchQueueService
 */

import { Queue, QueueEvents, Job, JobsOptions } from 'bullmq';
import { config } from '../../../config';
import {
  IPitchQueueService,
  PitchProcessingJobData,
  ProfileBuildJobData,
  MatchComputeJobData,
  OutreachGenerateJobData,
} from '../../../application/interfaces/IPitchQueueService';
import { MatchWeightsDTO, ContactProfileDTO } from '../../../application/dto/pitch.dto';
import { PitchJobStep, MatchReason } from '../../../domain/entities/Pitch';
import { logger } from '../../../shared/logger';

/**
 * Queue names
 */
const QUEUE_NAMES = {
  PITCH_PROCESSING: 'pitch-processing',
  PROFILE_BUILD: 'pitch-profile-build',
  MATCH_COMPUTE: 'pitch-match-compute',
  OUTREACH_GENERATE: 'pitch-outreach-generate',
} as const;

/**
 * Default job options
 */
const DEFAULT_JOB_OPTIONS: JobsOptions = {
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 5000,
  },
  removeOnComplete: {
    age: 86400, // 24 hours
    count: 1000,
  },
  removeOnFail: {
    age: 604800, // 7 days
  },
};

/**
 * Get Redis connection from URL
 */
function getRedisConnection() {
  const redisUrl = new URL(config.redis.url);
  return {
    host: redisUrl.hostname,
    port: parseInt(redisUrl.port, 10) || 6379,
    password: redisUrl.password || undefined,
    db: parseInt(redisUrl.pathname.slice(1), 10) || 0,
  };
}

/**
 * Pitch Queue Service Implementation
 */
export class PitchQueueService implements IPitchQueueService {
  private pitchProcessingQueue: Queue;
  private profileBuildQueue: Queue;
  private matchComputeQueue: Queue;
  private outreachGenerateQueue: Queue;
  private queueEvents: Map<string, QueueEvents> = new Map();
  private isInitialized = false;

  constructor() {
    const connection = getRedisConnection();

    // Initialize queues
    this.pitchProcessingQueue = new Queue(QUEUE_NAMES.PITCH_PROCESSING, {
      connection,
      defaultJobOptions: DEFAULT_JOB_OPTIONS,
    });

    this.profileBuildQueue = new Queue(QUEUE_NAMES.PROFILE_BUILD, {
      connection,
      defaultJobOptions: DEFAULT_JOB_OPTIONS,
    });

    this.matchComputeQueue = new Queue(QUEUE_NAMES.MATCH_COMPUTE, {
      connection,
      defaultJobOptions: DEFAULT_JOB_OPTIONS,
    });

    this.outreachGenerateQueue = new Queue(QUEUE_NAMES.OUTREACH_GENERATE, {
      connection,
      defaultJobOptions: DEFAULT_JOB_OPTIONS,
    });
  }

  /**
   * Initialize queue events for progress tracking
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    const connection = getRedisConnection();

    // Set up queue events for each queue
    for (const queueName of Object.values(QUEUE_NAMES)) {
      const events = new QueueEvents(queueName, { connection });
      this.queueEvents.set(queueName, events);

      events.on('completed', ({ jobId }) => {
        logger.debug('Job completed', { queue: queueName, jobId });
      });

      events.on('failed', ({ jobId, failedReason }) => {
        logger.error('Job failed', { queue: queueName, jobId, reason: failedReason });
      });
    }

    this.isInitialized = true;
    logger.info('PitchQueueService initialized');
  }

  /**
   * Enqueue text extraction job
   */
  async enqueueExtractText(pitchId: string, userId: string): Promise<string> {
    const job = await this.pitchProcessingQueue.add(
      'extract-text',
      {
        pitchId,
        userId,
        step: PitchJobStep.EXTRACT_TEXT,
      } as PitchProcessingJobData,
      {
        jobId: `extract-text-${pitchId}`,
      }
    );

    logger.info('Enqueued extract text job', { pitchId, jobId: job.id });
    return job.id!;
  }

  /**
   * Enqueue section classification job
   */
  async enqueueClassifySections(pitchId: string, userId: string): Promise<string> {
    const job = await this.pitchProcessingQueue.add(
      'classify-sections',
      {
        pitchId,
        userId,
        step: PitchJobStep.CLASSIFY_SECTIONS,
      } as PitchProcessingJobData,
      {
        jobId: `classify-sections-${pitchId}`,
      }
    );

    logger.info('Enqueued classify sections job', { pitchId, jobId: job.id });
    return job.id!;
  }

  /**
   * Enqueue needs extraction job
   */
  async enqueueExtractNeeds(pitchId: string, userId: string): Promise<string> {
    const job = await this.pitchProcessingQueue.add(
      'extract-needs',
      {
        pitchId,
        userId,
        step: PitchJobStep.EXTRACT_NEEDS,
      } as PitchProcessingJobData,
      {
        jobId: `extract-needs-${pitchId}`,
      }
    );

    logger.info('Enqueued extract needs job', { pitchId, jobId: job.id });
    return job.id!;
  }

  /**
   * Enqueue profile build jobs for all contacts
   */
  async enqueueBuildProfiles(
    pitchId: string,
    userId: string,
    contactIds: string[]
  ): Promise<string[]> {
    const jobs = contactIds.map((contactId) => ({
      name: 'build-profile',
      data: {
        pitchId,
        userId,
        contactId,
      } as ProfileBuildJobData,
      opts: {
        jobId: `build-profile-${pitchId}-${contactId}`,
      },
    }));

    const addedJobs = await this.profileBuildQueue.addBulk(jobs);

    logger.info('Enqueued build profiles jobs', {
      pitchId,
      count: addedJobs.length,
    });

    return addedJobs.map((j) => j.id!);
  }

  /**
   * Enqueue match computation for a section
   */
  async enqueueComputeMatches(
    pitchId: string,
    sectionId: string,
    contactIds: string[],
    weights: MatchWeightsDTO
  ): Promise<string> {
    const job = await this.matchComputeQueue.add(
      'compute-matches',
      {
        pitchId,
        sectionId,
        contactIds,
        weights,
      } as MatchComputeJobData,
      {
        jobId: `compute-matches-${pitchId}-${sectionId}`,
      }
    );

    logger.info('Enqueued compute matches job', { pitchId, sectionId, jobId: job.id });
    return job.id!;
  }

  /**
   * Enqueue outreach generation for a match
   */
  async enqueueGenerateOutreach(
    matchId: string,
    sectionContent: string,
    contactProfile: ContactProfileDTO,
    reasons: MatchReason[],
    tone: 'professional' | 'casual' | 'warm' = 'professional'
  ): Promise<string> {
    const job = await this.outreachGenerateQueue.add(
      'generate-outreach',
      {
        matchId,
        sectionContent,
        contactProfile,
        reasons,
        tone,
      } as OutreachGenerateJobData,
      {
        jobId: `generate-outreach-${matchId}`,
      }
    );

    logger.info('Enqueued generate outreach job', { matchId, jobId: job.id });
    return job.id!;
  }

  /**
   * Get job status
   */
  async getJobStatus(jobId: string): Promise<{
    status: 'waiting' | 'active' | 'completed' | 'failed';
    progress: number;
    error?: string;
  }> {
    // Try to find the job in any queue
    for (const queue of [
      this.pitchProcessingQueue,
      this.profileBuildQueue,
      this.matchComputeQueue,
      this.outreachGenerateQueue,
    ]) {
      const job = await queue.getJob(jobId);
      if (job) {
        const state = await job.getState();
        let status: 'waiting' | 'active' | 'completed' | 'failed' = 'waiting';

        if (state === 'completed') status = 'completed';
        else if (state === 'failed') status = 'failed';
        else if (state === 'active') status = 'active';
        else status = 'waiting';

        return {
          status,
          progress: job.progress as number || 0,
          error: job.failedReason,
        };
      }
    }

    throw new Error(`Job ${jobId} not found`);
  }

  /**
   * Cancel a job
   */
  async cancelJob(jobId: string): Promise<void> {
    for (const queue of [
      this.pitchProcessingQueue,
      this.profileBuildQueue,
      this.matchComputeQueue,
      this.outreachGenerateQueue,
    ]) {
      const job = await queue.getJob(jobId);
      if (job) {
        const state = await job.getState();
        if (state === 'waiting' || state === 'delayed') {
          await job.remove();
        } else if (state === 'active') {
          await job.moveToFailed(new Error('Cancelled'), 'cancelled');
        }
        return;
      }
    }

    logger.warn('Job not found for cancellation', { jobId });
  }

  /**
   * Get queue health metrics
   */
  async getQueueMetrics(): Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
  }> {
    const metrics = {
      waiting: 0,
      active: 0,
      completed: 0,
      failed: 0,
    };

    for (const queue of [
      this.pitchProcessingQueue,
      this.profileBuildQueue,
      this.matchComputeQueue,
      this.outreachGenerateQueue,
    ]) {
      const counts = await queue.getJobCounts();
      metrics.waiting += counts.waiting;
      metrics.active += counts.active;
      metrics.completed += counts.completed;
      metrics.failed += counts.failed;
    }

    return metrics;
  }

  /**
   * Get job by ID
   */
  async getJob(queueName: string, jobId: string): Promise<Job | null> {
    const queueMap: Record<string, Queue> = {
      [QUEUE_NAMES.PITCH_PROCESSING]: this.pitchProcessingQueue,
      [QUEUE_NAMES.PROFILE_BUILD]: this.profileBuildQueue,
      [QUEUE_NAMES.MATCH_COMPUTE]: this.matchComputeQueue,
      [QUEUE_NAMES.OUTREACH_GENERATE]: this.outreachGenerateQueue,
    };

    const queue = queueMap[queueName];
    if (!queue) return null;

    return queue.getJob(jobId);
  }

  /**
   * Get queue counts (detailed by queue)
   */
  async getQueueCounts(): Promise<Record<string, { waiting: number; active: number; completed: number; failed: number }>> {
    const counts: Record<string, { waiting: number; active: number; completed: number; failed: number }> = {};

    for (const [name, queue] of [
      [QUEUE_NAMES.PITCH_PROCESSING, this.pitchProcessingQueue],
      [QUEUE_NAMES.PROFILE_BUILD, this.profileBuildQueue],
      [QUEUE_NAMES.MATCH_COMPUTE, this.matchComputeQueue],
      [QUEUE_NAMES.OUTREACH_GENERATE, this.outreachGenerateQueue],
    ] as const) {
      const jobCounts = await queue.getJobCounts();
      counts[name] = {
        waiting: jobCounts.waiting,
        active: jobCounts.active,
        completed: jobCounts.completed,
        failed: jobCounts.failed,
      };
    }

    return counts;
  }

  /**
   * Cancel all jobs for a pitch
   */
  async cancelPitchJobs(pitchId: string): Promise<void> {
    const queues = [
      this.pitchProcessingQueue,
      this.profileBuildQueue,
      this.matchComputeQueue,
      this.outreachGenerateQueue,
    ];

    for (const queue of queues) {
      // Get waiting jobs
      const waitingJobs = await queue.getWaiting();
      for (const job of waitingJobs) {
        if (job.data.pitchId === pitchId) {
          await job.remove();
        }
      }

      // Get active jobs
      const activeJobs = await queue.getActive();
      for (const job of activeJobs) {
        if (job.data.pitchId === pitchId) {
          await job.moveToFailed(new Error('Cancelled by user'), 'cancelled');
        }
      }
    }

    logger.info('Cancelled all jobs for pitch', { pitchId });
  }

  /**
   * Close all connections
   */
  async close(): Promise<void> {
    await Promise.all([
      this.pitchProcessingQueue.close(),
      this.profileBuildQueue.close(),
      this.matchComputeQueue.close(),
      this.outreachGenerateQueue.close(),
    ]);

    for (const events of this.queueEvents.values()) {
      await events.close();
    }

    this.queueEvents.clear();
    this.isInitialized = false;
    logger.info('PitchQueueService closed');
  }

  /**
   * Get queue names
   */
  getQueueNames() {
    return QUEUE_NAMES;
  }
}

// Export singleton instance
export const pitchQueueService = new PitchQueueService();
