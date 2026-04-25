/**
 * Use Case: Calculate Deal Matches
 * Runs matching algorithm synchronously for small networks,
 * or enqueues async job for large networks
 */

import { IDealRequestRepository, IDealMatchResultRepository, IDealJobRepository } from '../../../domain/repositories/IDealRepository';
import { IContactRepository } from '../../../domain/repositories/IContactRepository';
import {
  DealStatus,
  DealJobStep,
  DealJobStatus,
  SYNC_CONTACT_THRESHOLD,
} from '../../../domain/entities/Deal';
import { DealMatchingService, ContactProfile } from '../../../infrastructure/services/deal/DealMatchingService';
import { NotFoundError, AuthorizationError, ConflictError } from '../../../shared/errors/index';
import { logger } from '../../../shared/logger';
import { prisma } from '../../../infrastructure/database/prisma/client';

export interface CalculateMatchesOutput {
  status: 'COMPLETED' | 'PROCESSING';
  matchCount?: number;
  avgScore?: number;
  processingTime?: number;
  jobId?: string;
  progress?: {
    overall: number;
    currentStep: string;
  };
}

export class CalculateDealMatchesUseCase {
  constructor(
    private readonly dealRepository: IDealRequestRepository,
    private readonly matchRepository: IDealMatchResultRepository,
    private readonly jobRepository: IDealJobRepository,
    private readonly contactRepository: IContactRepository,
    private readonly matchingService: DealMatchingService,
    private readonly dealQueue?: any, // Optional queue service for async
  ) {}

  async execute(userId: string, dealId: string, organizationId?: string): Promise<CalculateMatchesOutput> {
    const startTime = Date.now();

    // Fetch deal
    const deal = await this.dealRepository.findById(dealId);
    if (!deal) {
      throw new NotFoundError('Deal');
    }

    if (deal.userId !== userId) {
      throw new AuthorizationError('Access denied');
    }

    if (deal.status === DealStatus.PROCESSING) {
      throw new ConflictError('Deal is already being processed');
    }

    logger.info('Calculating deal matches', { dealId, mode: deal.mode, userId, organizationId });

    // Get contact count to decide sync vs async
    // Scope by organization context when in org mode
    const contactFilters = organizationId ? { organizationId } : undefined;
    const { contacts, total } = await this.contactRepository.findByUserId(userId, contactFilters, {
      page: 1,
      limit: SYNC_CONTACT_THRESHOLD + 1,
    });

    if (total > SYNC_CONTACT_THRESHOLD && this.dealQueue) {
      // Async processing for large networks
      return this.enqueueAsyncProcessing(deal.id);
    }

    // Sync processing for small networks
    return this.processSynchronously(deal, contacts, startTime);
  }

  /**
   * Process matches synchronously (small networks)
   */
  private async processSynchronously(
    deal: any,
    contacts: any[],
    startTime: number
  ): Promise<CalculateMatchesOutput> {
    // Update deal status
    await this.dealRepository.update(deal.id, { status: DealStatus.PROCESSING });

    try {
      // Delete existing matches
      await this.matchRepository.deleteByDealRequestId(deal.id);

      // Build contact profiles
      const contactProfiles = await this.buildContactProfiles(contacts);
      const profileMap = new Map(contactProfiles.map(p => [p.id, p]));

      // Run matching algorithm
      const matchResults = await this.matchingService.matchContacts(deal, contactProfiles);

      // Convert to repository inputs
      const matchInputs = this.matchingService.toRepositoryInputs(
        deal.id,
        matchResults,
        deal,
        profileMap
      );

      // Save matches
      if (matchInputs.length > 0) {
        await this.matchRepository.createMany(matchInputs);
      }

      // Calculate stats
      const matchCount = matchInputs.length;
      const avgScore = matchCount > 0
        ? Math.round(matchResults.reduce((sum, m) => sum + m.score, 0) / matchCount)
        : 0;

      // Update deal with results
      await this.dealRepository.update(deal.id, {
        status: DealStatus.COMPLETED,
        matchCount,
        avgScore,
      });

      const processingTime = Date.now() - startTime;

      logger.info('Deal matching complete (sync)', {
        dealId: deal.id,
        matchCount,
        avgScore,
        processingTime,
      });

      return {
        status: 'COMPLETED',
        matchCount,
        avgScore,
        processingTime,
      };
    } catch (error) {
      // Mark as failed
      await this.dealRepository.update(deal.id, {
        status: DealStatus.FAILED,
      });
      throw error;
    }
  }

  /**
   * Enqueue async processing (large networks)
   */
  private async enqueueAsyncProcessing(dealId: string): Promise<CalculateMatchesOutput> {
    // Update deal status
    await this.dealRepository.update(dealId, { status: DealStatus.PROCESSING });

    // Create job records
    const jobSteps = [
      DealJobStep.BUILD_CANDIDATES,
      DealJobStep.SCORE_CANDIDATES,
      DealJobStep.CLASSIFY_MATCHES,
      DealJobStep.GENERATE_MESSAGES,
    ];

    await this.jobRepository.createMany(
      jobSteps.map(step => ({
        dealRequestId: dealId,
        step,
        maxAttempts: step === DealJobStep.GENERATE_MESSAGES ? 2 : 3,
      }))
    );

    // Enqueue first job
    if (this.dealQueue) {
      await this.dealQueue.enqueueBuildCandidates(dealId);
    }

    logger.info('Deal matching enqueued (async)', { dealId });

    return {
      status: 'PROCESSING',
      progress: {
        overall: 0,
        currentStep: DealJobStep.BUILD_CANDIDATES,
      },
    };
  }

  /**
   * Build contact profiles from contact data
   */
  private async buildContactProfiles(contacts: any[]): Promise<ContactProfile[]> {
    // Get interaction counts for all contacts in one query
    const contactIds = contacts.map(c => c.id);
    const interactionCounts = await prisma.interaction.groupBy({
      by: ['contactId'],
      where: { contactId: { in: contactIds } },
      _count: { id: true },
    });
    const countMap = new Map(interactionCounts.map(ic => [ic.contactId, ic._count.id]));

    return contacts.map(contact => ({
      id: contact.id,
      fullName: contact.name || contact.fullName || '',
      company: contact.company,
      jobTitle: contact.jobTitle,
      email: contact.email,
      sectors: contact.sectors?.map((s: any) => s.sectorName || s.name || s.sectorId) || [],
      skills: contact.skills?.map((s: any) => s.skillName || s.name || s.skillId) || [],
      interests: contact.interests?.map((i: any) => i.interestName || i.name || i.interestId) || [],
      bio: contact.bio || contact.notes,
      enrichmentData: contact.enrichmentData,
      relationshipStrength: contact.matchScore ? Number(contact.matchScore) : 0,
      lastInteractionDays: contact.lastInteractionAt
        ? Math.floor((Date.now() - new Date(contact.lastInteractionAt).getTime()) / (1000 * 60 * 60 * 24))
        : null,
      interactionCount: countMap.get(contact.id) || 0,
    }));
  }
}
