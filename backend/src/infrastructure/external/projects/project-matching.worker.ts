/**
 * IntellMatch Project Matching Engine — Worker
 *
 * Bull-queue async processor. Carries AuthContext for tenant-safe execution.
 *
 * @module project-matching/project-matching.worker
 */

import { ProjectMatchingService } from './project-matching.service';
import { ProjectMatchingConfig, DEFAULT_PROJECT_CONFIG, AuthContext, ProjectMatchWorkerPayload, FindProjectMatchesRequest } from './project-matching.types';

const STATUS_KEY = 'project:match:status:';
const RESULT_KEY = 'project:match:result:';
const TTL = 86400;

export class ProjectMatchingWorker {
  private readonly queue: any;
  private readonly redis: any;
  private readonly service: ProjectMatchingService;
  private readonly concurrency: number;
  private running = false;

  constructor(queue: any, redis: any, prisma: any, opts: { concurrency?: number; config?: ProjectMatchingConfig } = {}) {
    this.queue = queue;
    this.redis = redis;
    this.concurrency = opts.concurrency ?? 3;
    this.service = new ProjectMatchingService(prisma, opts.config || DEFAULT_PROJECT_CONFIG);
  }

  async start(): Promise<void> {
    if (this.running) return;
    this.running = true;

    this.queue.process('projectMatching', this.concurrency, async (job: any) => {
      const { jobId, payload } = job.data as { jobId: string; payload: ProjectMatchWorkerPayload };

      if (!payload?.auth?.userId) {
        await this.setStatus(jobId, { status: 'FAILED', error: 'Missing auth context' });
        throw new Error('Worker job missing auth context');
      }

      await this.setStatus(jobId, { status: 'PROCESSING', progress: 0 });
      try {
        const result = await this.service.findMatches(payload.auth, payload.request);
        await job.progress(100);
        await this.redis.setex(RESULT_KEY + jobId, TTL, JSON.stringify({
          matchCount: result.matches.length, total: result.stats.finalMatches,
          processingTimeMs: result.processingTimeMs,
        }));
        await this.setStatus(jobId, { status: 'COMPLETED', progress: 100, matchCount: result.matches.length });
        return result;
      } catch (e: any) {
        await this.setStatus(jobId, { status: 'FAILED', error: e.message });
        throw e;
      }
    });

    this.queue.on('failed', (job: any, err: Error) => console.error(`[ProjectWorker] Job ${job?.id} failed: ${err.message}`));
  }

  async stop(): Promise<void> { if (!this.running) return; this.running = false; await this.queue.close(); }

  async enqueue(auth: AuthContext, request: FindProjectMatchesRequest, priority: 'LOW' | 'NORMAL' | 'HIGH' = 'NORMAL'): Promise<string> {
    const id = `prm_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const payload: ProjectMatchWorkerPayload = { auth, request };
    await this.queue.add('projectMatching', { jobId: id, payload }, {
      jobId: id, priority: { HIGH: 1, NORMAL: 5, LOW: 10 }[priority],
      attempts: 3, backoff: { type: 'exponential', delay: 2000 },
    });
    await this.setStatus(id, { status: 'PENDING', progress: 0 });
    return id;
  }

  async getStatus(jobId: string): Promise<any> { const raw = await this.redis.get(STATUS_KEY + jobId); return raw ? JSON.parse(raw) : null; }

  private async setStatus(jobId: string, data: any): Promise<void> {
    await this.redis.setex(STATUS_KEY + jobId, TTL, JSON.stringify({ jobId, ...data, updatedAt: new Date().toISOString() }));
  }
}

export function createProjectMatchingWorker(queue: any, redis: any, prisma: any, opts?: { concurrency?: number; config?: ProjectMatchingConfig }): ProjectMatchingWorker {
  return new ProjectMatchingWorker(queue, redis, prisma, opts);
}
