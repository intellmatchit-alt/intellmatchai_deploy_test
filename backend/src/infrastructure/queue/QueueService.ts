/**
 * Queue Service
 *
 * BullMQ-based job queue for background task processing.
 *
 * @module infrastructure/queue/QueueService
 */

import { Queue, Worker, Job, QueueEvents } from 'bullmq';
import { config } from '../../config/index';
import { logger } from '../../shared/logger/index';
import { CollaborationSourceType } from '../../domain/entities/Collaboration';

/**
 * Queue names
 */
export enum QueueName {
  ENRICHMENT = 'enrichment',
  MATCHING = 'matching',
  EMAIL = 'email',
  EXPORT = 'export',
  SYNC = 'sync',
  PROJECT_MATCHING = 'project-matching',
  PRODUCT_MATCHING = 'product-matching',
  COLLABORATION_MATCHING = 'collaboration-matching',
  EVENT_MATCHING = 'event-matching',
  IMPORT = 'import',
  TASK_REMINDER = 'task-reminder',
  RECURRING_TASK = 'recurring-task',
  OVERDUE_TASK = 'overdue-task',
}

/**
 * Job data types
 */
export interface EnrichmentJobData {
  contactId: string;
  userId: string;
  fields?: string[];
}

export interface MatchingJobData {
  contactId: string;
  userId: string;
  recalculate?: boolean;
}

export interface EmailJobData {
  to: string;
  subject: string;
  template: string;
  data: Record<string, unknown>;
}

export interface ExportJobData {
  userId: string;
  format: 'csv' | 'vcard';
  contactIds?: string[];
  filters?: Record<string, unknown>;
}

export interface SyncJobData {
  userId: string;
  type: 'neo4j' | 'search';
}

export interface ProjectMatchingJobData {
  projectId: string;
  userId: string;
  triggerType: 'manual' | 'scheduled' | 'project_update';
}

export interface ProductMatchJobData {
  runId: string;
  userId: string;
}

export interface CollaborationMatchingJobData {
  sessionId: string;
  collaboratorUserId: string;
  sourceType: CollaborationSourceType;
  sourceId: string;
}

export interface EventMatchingJobData {
  eventId: string;
  attendeeId: string;
  userId?: string;
}

export type ImportStage = 'normalize' | 'dedupe' | 'enrich' | 'tag' | 'summary' | 'match';

export interface ImportJobData {
  batchId: string;
  userId: string;
  stage: ImportStage;
}

/**
 * Job status
 */
export interface JobStatus {
  id: string;
  name: string;
  status: 'waiting' | 'active' | 'completed' | 'failed' | 'delayed';
  progress: number;
  data: unknown;
  result?: unknown;
  error?: string;
  createdAt: Date;
  processedAt?: Date;
  finishedAt?: Date;
}

/**
 * Redis connection options
 */
const getRedisConnection = () => {
  const redisUrl = config.redis?.url || process.env.REDIS_URL || 'redis://localhost:6379';
  const url = new URL(redisUrl);

  return {
    host: url.hostname,
    port: parseInt(url.port || '6379', 10),
    password: url.password || undefined,
  };
};

/**
 * Queue Service
 *
 * Manages job queues and workers.
 */
export class QueueService {
  private queues: Map<QueueName, Queue> = new Map();
  private workers: Map<QueueName, Worker> = new Map();
  private queueEvents: Map<QueueName, QueueEvents> = new Map();
  private isInitialized = false;
  private available = false;

  /**
   * Initialize queues
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      const connection = getRedisConnection();

      // Create queues
      for (const queueName of Object.values(QueueName)) {
        const queue = new Queue(queueName, {
          connection,
          defaultJobOptions: {
            attempts: 3,
            backoff: {
              type: 'exponential',
              delay: 1000,
            },
            removeOnComplete: {
              age: 24 * 60 * 60, // Keep completed jobs for 24 hours
              count: 1000,
            },
            removeOnFail: {
              age: 7 * 24 * 60 * 60, // Keep failed jobs for 7 days
            },
          },
        });

        this.queues.set(queueName as QueueName, queue);

        // Create queue events for monitoring
        const events = new QueueEvents(queueName, { connection });
        this.queueEvents.set(queueName as QueueName, events);
      }

      this.available = true;
      this.isInitialized = true;
      logger.info('Queue service initialized', { queues: Object.values(QueueName) });
    } catch (error) {
      logger.warn('Queue service not available:', error);
      this.available = false;
      this.isInitialized = true;
    }
  }

  /**
   * Check if queue service is available
   */
  isAvailable(): boolean {
    return this.available;
  }

  /**
   * Get a queue instance
   */
  getQueue(name: QueueName): Queue | null {
    return this.queues.get(name) || null;
  }

  /**
   * Add a job to a queue
   */
  async addJob<T>(
    queueName: QueueName,
    jobName: string,
    data: T,
    options?: {
      delay?: number;
      priority?: number;
      jobId?: string;
    }
  ): Promise<Job<T> | null> {
    if (!this.available) {
      logger.warn(`Queue not available, skipping job: ${queueName}/${jobName}`);
      return null;
    }

    const queue = this.queues.get(queueName);
    if (!queue) {
      logger.error(`Queue not found: ${queueName}`);
      return null;
    }

    try {
      const job = await queue.add(jobName, data, {
        delay: options?.delay,
        priority: options?.priority,
        jobId: options?.jobId,
      });

      logger.debug(`Job added: ${queueName}/${jobName}`, { jobId: job.id });
      return job;
    } catch (error) {
      logger.error(`Failed to add job: ${queueName}/${jobName}`, error);
      return null;
    }
  }

  /**
   * Add an enrichment job
   */
  async addEnrichmentJob(data: EnrichmentJobData, options?: { delay?: number }): Promise<Job | null> {
    return this.addJob(QueueName.ENRICHMENT, 'enrich-contact', data, {
      ...options,
      jobId: `enrich-${data.contactId}`,
    });
  }

  /**
   * Add a matching job
   */
  async addMatchingJob(data: MatchingJobData, options?: { delay?: number }): Promise<Job | null> {
    return this.addJob(QueueName.MATCHING, 'calculate-match', data, {
      ...options,
      jobId: `match-${data.contactId}`,
    });
  }

  /**
   * Add an email job
   */
  async addEmailJob(data: EmailJobData, options?: { delay?: number }): Promise<Job | null> {
    return this.addJob(QueueName.EMAIL, 'send-email', data, options);
  }

  /**
   * Add an export job
   */
  async addExportJob(data: ExportJobData): Promise<Job | null> {
    return this.addJob(QueueName.EXPORT, `export-${data.format}`, data, {
      jobId: `export-${data.userId}-${Date.now()}`,
    });
  }

  /**
   * Add a sync job
   */
  async addSyncJob(data: SyncJobData): Promise<Job | null> {
    return this.addJob(QueueName.SYNC, `sync-${data.type}`, data, {
      jobId: `sync-${data.type}-${data.userId}`,
    });
  }

  /**
   * Add a project matching job
   */
  async addProjectMatchingJob(data: ProjectMatchingJobData, options?: { delay?: number; priority?: number }): Promise<Job | null> {
    return this.addJob(QueueName.PROJECT_MATCHING, 'find-project-matches', data, {
      ...options,
      jobId: `project-match-${data.projectId}-${Date.now()}`,
    });
  }

  /**
   * Add a product match job
   */
  async addProductMatchJob(data: ProductMatchJobData, options?: { delay?: number; priority?: number }): Promise<Job | null> {
    return this.addJob(QueueName.PRODUCT_MATCHING, 'product-match', data, {
      ...options,
      jobId: `product-match-${data.runId}`,
    });
  }

  /**
   * Add a collaboration matching job
   */
  async addCollaborationMatchingJob(data: CollaborationMatchingJobData, options?: { delay?: number; priority?: number }): Promise<Job | null> {
    return this.addJob(QueueName.COLLABORATION_MATCHING, 'collaboration-match', data, {
      ...options,
      jobId: `collab-match-${data.sessionId}`,
    });
  }

  /**
   * Add an import job
   */
  async addImportJob(data: ImportJobData, options?: { delay?: number; priority?: number }): Promise<Job | null> {
    return this.addJob(QueueName.IMPORT, `import-${data.stage}`, data, {
      ...options,
      jobId: `import-${data.stage}-${data.batchId}`,
    });
  }

  /**
   * Get job status
   */
  async getJobStatus(queueName: QueueName, jobId: string): Promise<JobStatus | null> {
    const queue = this.queues.get(queueName);
    if (!queue) return null;

    try {
      const job = await queue.getJob(jobId);
      if (!job) return null;

      const state = await job.getState();

      return {
        id: job.id || '',
        name: job.name,
        status: state as JobStatus['status'],
        progress: job.progress as number || 0,
        data: job.data,
        result: job.returnvalue,
        error: job.failedReason,
        createdAt: new Date(job.timestamp),
        processedAt: job.processedOn ? new Date(job.processedOn) : undefined,
        finishedAt: job.finishedOn ? new Date(job.finishedOn) : undefined,
      };
    } catch (error) {
      logger.error(`Failed to get job status: ${queueName}/${jobId}`, error);
      return null;
    }
  }

  /**
   * Register a worker for a queue
   */
  registerWorker<T, R>(
    queueName: QueueName,
    processor: (job: Job<T>) => Promise<R>,
    options?: {
      concurrency?: number;
      limiter?: { max: number; duration: number };
    }
  ): Worker<T, R> | null {
    if (!this.available) {
      logger.warn(`Queue not available, skipping worker registration: ${queueName}`);
      return null;
    }

    const connection = getRedisConnection();

    const worker = new Worker<T, R>(queueName, processor, {
      connection,
      concurrency: options?.concurrency || 5,
      limiter: options?.limiter,
    });

    // Set up event handlers
    worker.on('completed', (job) => {
      logger.debug(`Job completed: ${queueName}/${job.id}`);
    });

    worker.on('failed', (job, error) => {
      logger.error(`Job failed: ${queueName}/${job?.id}`, error);
    });

    worker.on('error', (error) => {
      logger.error(`Worker error: ${queueName}`, error);
    });

    this.workers.set(queueName, worker);
    logger.info(`Worker registered: ${queueName}`, { concurrency: options?.concurrency || 5 });

    return worker;
  }

  /**
   * Get queue statistics
   */
  async getQueueStats(queueName: QueueName): Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
  } | null> {
    const queue = this.queues.get(queueName);
    if (!queue) return null;

    try {
      const [waiting, active, completed, failed, delayed] = await Promise.all([
        queue.getWaitingCount(),
        queue.getActiveCount(),
        queue.getCompletedCount(),
        queue.getFailedCount(),
        queue.getDelayedCount(),
      ]);

      return { waiting, active, completed, failed, delayed };
    } catch (error) {
      logger.error(`Failed to get queue stats: ${queueName}`, error);
      return null;
    }
  }

  /**
   * Pause a queue
   */
  async pauseQueue(queueName: QueueName): Promise<void> {
    const queue = this.queues.get(queueName);
    if (queue) {
      await queue.pause();
      logger.info(`Queue paused: ${queueName}`);
    }
  }

  /**
   * Resume a queue
   */
  async resumeQueue(queueName: QueueName): Promise<void> {
    const queue = this.queues.get(queueName);
    if (queue) {
      await queue.resume();
      logger.info(`Queue resumed: ${queueName}`);
    }
  }

  /**
   * Clean up old jobs
   */
  async cleanQueue(queueName: QueueName, grace: number = 24 * 60 * 60 * 1000): Promise<void> {
    const queue = this.queues.get(queueName);
    if (queue) {
      await queue.clean(grace, 1000, 'completed');
      await queue.clean(grace * 7, 1000, 'failed');
      logger.info(`Queue cleaned: ${queueName}`);
    }
  }

  /**
   * Close all queues and workers
   */
  async close(): Promise<void> {
    // Close workers
    for (const [name, worker] of this.workers) {
      await worker.close();
      logger.debug(`Worker closed: ${name}`);
    }

    // Close queue events
    for (const [name, events] of this.queueEvents) {
      await events.close();
    }

    // Close queues
    for (const [name, queue] of this.queues) {
      await queue.close();
      logger.debug(`Queue closed: ${name}`);
    }

    this.workers.clear();
    this.queueEvents.clear();
    this.queues.clear();
    this.isInitialized = false;
    this.available = false;

    logger.info('Queue service closed');
  }
}

// Export singleton instance
export const queueService = new QueueService();
export default queueService;
