/**
 * IntellMatch Job Matching Engine — Worker
 *
 * Bull-queue async job processor for large-scale matching.
 *
 * @module job-matching/job-matching.worker
 */

import { JobMatchingService, createJobMatchingService } from './job-matching.service';
import { FindJobMatchesRequest, JobMatchingConfig } from './job-matching.types';

const STATUS_KEY = 'job:match:status:';
const RESULT_KEY = 'job:match:result:';
const TTL = 86400;

export class JobMatchingWorker {
  private readonly queue: any;
  private readonly redis: any;
  private readonly service: JobMatchingService;
  private readonly concurrency: number;
  private running = false;

  constructor(queue: any, redis: any, prisma: any, opts: { concurrency?: number; config?: JobMatchingConfig } = {}) {
    this.queue = queue;
    this.redis = redis;
    this.concurrency = opts.concurrency ?? 3;
    this.service = createJobMatchingService(prisma, opts.config);
  }

  async start(): Promise<void> {
    if (this.running) return;
    this.running = true;

    this.queue.process('findJobMatches', this.concurrency, async (job: any) => {
      const { jobId, payload } = job.data;
      await this.setStatus(jobId, { status: 'PROCESSING', progress: 0 });
      try {
        const result = await this.service.findMatches(payload as FindJobMatchesRequest);
        await job.progress(100);
        await this.redis.setex(RESULT_KEY + jobId, TTL, JSON.stringify({ matchCount: result.matches.length, stats: { total: result.total } }));
        await this.setStatus(jobId, { status: 'COMPLETED', progress: 100, matchCount: result.matches.length });
        return result;
      } catch (e: any) {
        await this.setStatus(jobId, { status: 'FAILED', error: e.message });
        throw e;
      }
    });

    this.queue.on('failed', (job: any, err: Error) => console.error(`[JobWorker] Job ${job.id} failed: ${err.message}`));
  }

  async stop(): Promise<void> {
    if (!this.running) return;
    this.running = false;
    await this.queue.close();
  }

  async enqueue(request: FindJobMatchesRequest, priority: 'LOW' | 'NORMAL' | 'HIGH' = 'NORMAL'): Promise<string> {
    const id = `jm_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    await this.queue.add('findJobMatches', { jobId: id, payload: request }, {
      jobId: id,
      priority: { HIGH: 1, NORMAL: 5, LOW: 10 }[priority],
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
    });
    await this.setStatus(id, { status: 'PENDING', progress: 0 });
    return id;
  }

  async getStatus(jobId: string): Promise<any> {
    const raw = await this.redis.get(STATUS_KEY + jobId);
    return raw ? JSON.parse(raw) : null;
  }

  private async setStatus(jobId: string, data: any): Promise<void> {
    await this.redis.setex(STATUS_KEY + jobId, TTL, JSON.stringify({ jobId, ...data, updatedAt: new Date().toISOString() }));
  }
}

export function createJobMatchingWorker(queue: any, redis: any, prisma: any, opts?: { concurrency?: number; config?: JobMatchingConfig }): JobMatchingWorker {
  return new JobMatchingWorker(queue, redis, prisma, opts);
}
