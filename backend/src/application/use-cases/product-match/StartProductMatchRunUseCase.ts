/**
 * Use Case: Start Product Match Run
 * Runs matching algorithm synchronously for small networks,
 * or enqueues async job for large networks
 */

import {
  IProductProfileRepository,
  IProductMatchRunRepository,
  IProductMatchResultRepository,
  IContactMatchingRepository,
} from '../../../domain/repositories/IProductMatchRepository';
import {
  ProductMatchRunStatus,
  SYNC_CONTACT_THRESHOLD,
  CreateProductMatchResultInput,
} from '../../../domain/entities/ProductMatch';
import { ProductMatchingService } from '../../../infrastructure/services/product/ProductMatchingService';
import { NotFoundError, ConflictError } from '../../../shared/errors/index.js';
import { logger } from '../../../shared/logger';

export interface StartMatchRunOutput {
  runId: string;
  status: 'DONE' | 'RUNNING';
  matchCount?: number;
  avgScore?: number;
  totalContacts?: number;
  processingTime?: number;
}

export class StartProductMatchRunUseCase {
  constructor(
    private readonly profileRepository: IProductProfileRepository,
    private readonly runRepository: IProductMatchRunRepository,
    private readonly resultRepository: IProductMatchResultRepository,
    private readonly contactRepository: IContactMatchingRepository,
    private readonly matchingService: ProductMatchingService,
    private readonly productMatchQueue?: any, // Optional queue service for async
  ) {}

  async execute(userId: string): Promise<StartMatchRunOutput> {
    const startTime = Date.now();

    // Fetch user's product profile
    const profile = await this.profileRepository.findByUserId(userId);
    if (!profile) {
      throw new NotFoundError('Product profile not found. Please create a product profile first.');
    }

    // Check if there's already a running match
    const latestRun = await this.runRepository.findLatestByUserId(userId);
    if (latestRun && latestRun.status === ProductMatchRunStatus.RUNNING) {
      throw new ConflictError('A match run is already in progress');
    }

    logger.info('Starting product match run', { userId, profileId: profile.id });

    // Get contact count to decide sync vs async
    const totalContacts = await this.contactRepository.countContactsForMatching(userId);

    if (totalContacts === 0) {
      throw new NotFoundError('No contacts found. Please add contacts to your network first.');
    }

    // Create match run record
    const run = await this.runRepository.create({
      userId,
      productProfileId: profile.id,
      totalContacts,
    });

    if (totalContacts > SYNC_CONTACT_THRESHOLD && this.productMatchQueue) {
      // Async processing for large networks
      return this.enqueueAsyncProcessing(run.id, userId);
    }

    // Sync processing for small networks
    return this.processSynchronously(run.id, profile, userId, totalContacts, startTime);
  }

  /**
   * Process matches synchronously (small networks)
   */
  private async processSynchronously(
    runId: string,
    profile: any,
    userId: string,
    totalContacts: number,
    startTime: number
  ): Promise<StartMatchRunOutput> {
    // Update run status to RUNNING
    await this.runRepository.update(runId, {
      status: ProductMatchRunStatus.RUNNING,
      startedAt: new Date(),
    });

    try {
      // Fetch all contacts for matching
      const contacts = await this.contactRepository.findContactsForMatching(userId);

      // Run matching algorithm
      const matchResults = await this.matchingService.matchContacts(profile, contacts);

      // Convert to repository inputs
      const resultInputs: CreateProductMatchResultInput[] = matchResults.map(result => ({
        matchRunId: runId,
        contactId: result.contactId,
        score: result.score,
        badge: result.badge,
        explanationJson: result.explanations,
        talkAngle: result.talkAngle,
        openerMessage: result.openerMessage,
        breakdownJson: result.breakdown,
      }));

      // Save results
      if (resultInputs.length > 0) {
        await this.resultRepository.createMany(resultInputs);
      }

      // Calculate stats
      const matchCount = resultInputs.length;
      const avgScore = matchCount > 0
        ? Math.round(matchResults.reduce((sum, m) => sum + m.score, 0) / matchCount)
        : 0;

      // Update run with results
      await this.runRepository.update(runId, {
        status: ProductMatchRunStatus.DONE,
        progress: 100,
        matchCount,
        avgScore,
        completedAt: new Date(),
      });

      const processingTime = Date.now() - startTime;

      logger.info('Product match run complete (sync)', {
        runId,
        matchCount,
        avgScore,
        processingTime,
      });

      return {
        runId,
        status: 'DONE',
        matchCount,
        avgScore,
        totalContacts,
        processingTime,
      };
    } catch (error) {
      // Mark as failed
      await this.runRepository.update(runId, {
        status: ProductMatchRunStatus.FAILED,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Enqueue async processing (large networks)
   */
  private async enqueueAsyncProcessing(runId: string, userId: string): Promise<StartMatchRunOutput> {
    // Update run status
    await this.runRepository.update(runId, {
      status: ProductMatchRunStatus.QUEUED,
    });

    // Enqueue job
    if (this.productMatchQueue) {
      const job = await this.productMatchQueue.add('product-match', {
        runId,
        userId,
      });

      await this.runRepository.update(runId, {
        bullJobId: job.id,
      });
    }

    logger.info('Product match run enqueued (async)', { runId });

    return {
      runId,
      status: 'RUNNING',
    };
  }
}
