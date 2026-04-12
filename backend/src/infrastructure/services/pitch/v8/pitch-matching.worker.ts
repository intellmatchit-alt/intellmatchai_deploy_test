/**
 * IntellMatch Pitch Matching Engine — Worker
 * v8.0.0 — production-hardened
 *
 * v8: Worker jobs carry AuthContext for tenant-safe execution.
 */

import { PitchMatchingService, createPitchMatchingService } from './pitch-matching.service';
import { FindPitchMatchesRequest, PitchMatchingConfig, AuthContext, PitchMatchWorkerPayload } from './pitch-matching.types';

const STATUS_KEY = 'pitch:match:status:';
const RESULT_KEY = 'pitch:match:result:';
const TTL_SECONDS = 86400;

export class PitchMatchingWorker {
  private readonly queue: any;
  private readonly redis: any;
  private readonly service: PitchMatchingService;
  private readonly concurrency: number;
  private running = false;

  constructor(queue: any, redis: any, prisma: any, options: { concurrency?: number; config?: PitchMatchingConfig } = {}) {
    this.queue = queue;
    this.redis = redis;
    this.concurrency = options.concurrency ?? 3;
    this.service = createPitchMatchingService(prisma, options.config);
  }

  async start(): Promise<void> {
    if (this.running) return;
    this.running = true;

    this.queue.process('findPitchMatches', this.concurrency, async (job: any) => {
      const { jobId, payload } = job.data as { jobId: string; payload: PitchMatchWorkerPayload };

      // v8: Validate auth context exists
      if (!payload?.auth?.userId) {
        await this.setStatus(jobId, { status: 'FAILED', error: 'Missing auth context in worker job' });
        throw new Error('Worker job missing auth context');
      }

      await this.setStatus(jobId, { status: 'PROCESSING', progress: 0 });
      try {
        const result = await this.service.findMatches(payload.auth, payload.request);
        await job.progress(100);
        await this.redis.setex(RESULT_KEY + jobId, TTL_SECONDS, JSON.stringify({
          matchCount: result.matches.length,
          stats: { total: result.total, evaluated: result.contactsEvaluated, filtered: result.contactsFiltered, processingTimeMs: result.processingTimeMs },
        }));
        await this.setStatus(jobId, { status: 'COMPLETED', progress: 100, matchCount: result.matches.length });
        return result;
      } catch (error: any) {
        await this.setStatus(jobId, { status: 'FAILED', error: error?.message || 'Unknown error' });
        throw error;
      }
    });

    this.queue.on('failed', (job: any, error: Error) => {
      console.error(`[PitchWorker] Job ${job?.id} failed: ${error.message}`);
    });
  }

  async stop(): Promise<void> {
    if (!this.running) return;
    this.running = false;
    await this.queue.close();
  }

  /** v8: Enqueue requires AuthContext */
  async enqueue(auth: AuthContext, request: FindPitchMatchesRequest, priority: 'LOW' | 'NORMAL' | 'HIGH' = 'NORMAL'): Promise<string> {
    const id = `pm_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const payload: PitchMatchWorkerPayload = { auth, request };
    await this.queue.add('findPitchMatches', { jobId: id, payload }, {
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

  private async setStatus(jobId: string, status: Record<string, unknown>): Promise<void> {
    await this.redis.setex(STATUS_KEY + jobId, TTL_SECONDS, JSON.stringify({ jobId, ...status, updatedAt: new Date().toISOString() }));
  }
}

export function createPitchMatchingWorker(
  queue: any, redis: any, prisma: any,
  options?: { concurrency?: number; config?: PitchMatchingConfig },
): PitchMatchingWorker {
  return new PitchMatchingWorker(queue, redis, prisma, options);
}
