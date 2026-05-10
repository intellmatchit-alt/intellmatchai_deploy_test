/**
 * IntellMatch Job Matching Engine — Worker
 *
 * Bull-queue async job processor for large-scale matching.
 *
 * @module job-matching/job-matching.worker
 */

import { JobMatchingService, createJobMatchingService } from './job-matching.service';
import {
  FindJobMatchesRequest,
  FindHelperMatchesRequest,
  JobMatchingConfig,
  MatchMode,
} from './job-matching.types';

/**
 * Worker payload — discriminated by matchMode so the same queue can run
 * both flows. HIRING_TO_CANDIDATES is the legacy default; helper modes
 * carry a candidateProfileId (and optionally a targetJobId).
 */
export type FindMatchesQueuePayload =
  | { matchMode: MatchMode.HIRING_TO_CANDIDATES; request: FindJobMatchesRequest }
  | {
      matchMode:
        | MatchMode.OPEN_TO_OPPORTUNITY_TO_HELPERS
        | MatchMode.TARGET_JOB_TO_HELPERS;
      request: FindHelperMatchesRequest;
    };

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
      const { jobId, payload } = job.data as { jobId: string; payload: any };
      await this.setStatus(jobId, { status: 'PROCESSING', progress: 0 });
      try {
        // Backward compat: legacy enqueues sent a bare FindJobMatchesRequest
        // with no matchMode wrapper. Treat those as HIRING_TO_CANDIDATES.
        const matchMode: MatchMode = payload?.matchMode ?? MatchMode.HIRING_TO_CANDIDATES;
        const request = payload?.request ?? payload;

        let result: any;
        if (
          matchMode === MatchMode.OPEN_TO_OPPORTUNITY_TO_HELPERS ||
          matchMode === MatchMode.TARGET_JOB_TO_HELPERS
        ) {
          result = await this.service.findHelpers(request as FindHelperMatchesRequest);
        } else {
          result = await this.service.findMatches(request as FindJobMatchesRequest);
        }

        await job.progress(100);
        await this.redis.setex(
          RESULT_KEY + jobId,
          TTL,
          JSON.stringify({
            matchMode,
            matchCount: result.matches.length,
            stats: { total: result.total },
          }),
        );
        await this.setStatus(jobId, {
          status: 'COMPLETED',
          progress: 100,
          matchMode,
          matchCount: result.matches.length,
        });
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

  /**
   * Enqueue a HIRING_TO_CANDIDATES match run.
   * Backward-compatible: existing callers don't need to pass matchMode.
   */
  async enqueue(
    request: FindJobMatchesRequest,
    priority: 'LOW' | 'NORMAL' | 'HIGH' = 'NORMAL',
  ): Promise<string> {
    return this.enqueuePayload(
      { matchMode: MatchMode.HIRING_TO_CANDIDATES, request },
      priority,
    );
  }

  /** Enqueue a helper-flow match run (OPEN_TO_OPPORTUNITY or TARGET_JOB). */
  async enqueueHelperFlow(
    request: FindHelperMatchesRequest,
    priority: 'LOW' | 'NORMAL' | 'HIGH' = 'NORMAL',
  ): Promise<string> {
    const matchMode = request.targetJobId
      ? MatchMode.TARGET_JOB_TO_HELPERS
      : MatchMode.OPEN_TO_OPPORTUNITY_TO_HELPERS;
    return this.enqueuePayload({ matchMode, request }, priority);
  }

  private async enqueuePayload(
    payload: FindMatchesQueuePayload,
    priority: 'LOW' | 'NORMAL' | 'HIGH',
  ): Promise<string> {
    const id = `jm_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    await this.queue.add(
      'findJobMatches',
      { jobId: id, payload },
      {
        jobId: id,
        priority: { HIGH: 1, NORMAL: 5, LOW: 10 }[priority],
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
      },
    );
    await this.setStatus(id, {
      status: 'PENDING',
      progress: 0,
      matchMode: payload.matchMode,
    });
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
