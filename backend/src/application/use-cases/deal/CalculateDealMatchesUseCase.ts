/**
 * Use Case: Calculate Deal Matches
 * Runs matching algorithm synchronously for small networks,
 * or enqueues async job for large networks
 */

import { IDealRequestRepository, IDealMatchResultRepository, IDealJobRepository } from '../../../domain/repositories/IDealRepository';
import { IContactRepository } from '../../../domain/repositories/IContactRepository';
import {
  DealStatus,
  DealMode,
  DealJobStep,
  DealJobStatus,
  SYNC_CONTACT_THRESHOLD,
} from '../../../domain/entities/Deal';
import { DealMatchingService, ContactProfile } from '../../../infrastructure/services/deal/DealMatchingService';
import { NotFoundError, AuthorizationError, ConflictError } from '../../../shared/errors/index';
import { logger } from '../../../shared/logger';
import { prisma } from '../../../infrastructure/database/prisma/client';
import {
  DealMatchingService as V4DealMatchingService,
  HelperMatchingService as V4HelperMatchingService,
} from '../../../infrastructure/services/deal/v4';
import {
  dealRequestToBuyRequest, dealRequestToSellOffering,
  contactToSellOffering, contactToBuyRequest, contactToHelperCandidate,
  networkContextForContact, ContactRow, DealRequestRow,
} from '../../../infrastructure/services/deal/v4/adapter';
import type { NetworkContext } from '../../../infrastructure/services/deal/v4/network.utils';

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
      // Async processing for large networks (legacy worker path).
      // v4.1 helper / direct flows currently run synchronously even when the
      // flag is on; large-network v4 work will land via a worker step later.
      return this.enqueueAsyncProcessing(deal.id);
    }

    // v4.1 cutover: when DEAL_ENGINE_V4=true, route through the new engine
    // and persist v4.1 columns + helper matches. Legacy path is preserved
    // verbatim when the flag is off.
    if (process.env.DEAL_ENGINE_V4 === 'true') {
      return this.processV4(deal, contacts, startTime, organizationId);
    }

    // Sync processing for small networks
    return this.processSynchronously(deal, contacts, startTime);
  }

  /**
   * v4.1 sync path. Bypasses the legacy 4-component scorer; routes the
   * current deal through DealMatchingService (12-component) and the
   * HelperMatchingService greenfield engine. Both write directly to Prisma.
   *
   * @internal
   */
  private async processV4(
    deal: any,
    contacts: any[],
    startTime: number,
    _organizationId?: string,
  ): Promise<CalculateMatchesOutput> {
    await this.dealRepository.update(deal.id, { status: DealStatus.PROCESSING });

    try {
      // Re-fetch the deal raw — DealRequestEntity strips metadata + buyerRole
      // which v4 needs for budget / requirements / role-aware persona scoring.
      const rawDeal = await prisma.dealRequest.findUnique({ where: { id: deal.id } });
      if (!rawDeal) throw new NotFoundError('Deal');
      const dealRow = rawDeal as unknown as DealRequestRow;

      // Build contact profile rows with sectors / interactions populated,
      // since v4's adapter expects them. Reuse the existing helper.
      const profiles = await this.buildContactProfiles(contacts);
      const profileById = new Map(profiles.map(p => [p.id, p]));
      const contactRows: ContactRow[] = contacts.map(c => {
        const p = profileById.get(c.id);
        return {
          id: c.id, ownerId: c.ownerId, fullName: c.name ?? p?.fullName ?? '',
          firstName: c.firstName, lastName: c.lastName, email: c.email,
          company: c.company, jobTitle: c.jobTitle,
          bio: c.bio, bioFull: c.bioFull, bioSummary: c.bioSummary,
          organizationId: c.organizationId, matchScore: c.matchScore,
          lastInteractionAt: c.lastInteractionAt, enrichmentData: c.enrichmentData,
          sectors: p?.sectors ?? [], skills: p?.skills ?? [], interests: p?.interests ?? [],
          interactionCount: p?.interactionCount ?? 0,
        };
      });

      // Build per-contact NetworkContext map keyed by the SellOffering /
      // BuyRequest id we'll synthesize next.
      const networkByTargetId = new Map<string, NetworkContext>();
      const ownerByTargetId = new Map<string, { userId?: string; organizationId?: string; fullName?: string; company?: string }>();

      const directMatcher = new V4DealMatchingService();
      const helperMatcher = new V4HelperMatchingService();

      // ---- Direct flow ----
      let directMatches: Awaited<ReturnType<V4DealMatchingService['findMatches']>>['matches'] = [];
      let directMode: 'BUY_TO_NETWORK_SELLERS' | 'SELL_TO_NETWORK_BUYERS';

      if (deal.mode === DealMode.BUY) {
        directMode = 'BUY_TO_NETWORK_SELLERS';
        const buyRequest = dealRequestToBuyRequest(dealRow);
        const sellCandidates = contactRows.map(c => {
          const sell = contactToSellOffering(c, { fallbackCategory: buyRequest.solutionCategory, fallbackIndustry: buyRequest.relevantIndustry });
          networkByTargetId.set(sell.id, networkContextForContact(c));
          ownerByTargetId.set(sell.id, { userId: c.ownerId, organizationId: c.organizationId ?? undefined, fullName: c.fullName ?? undefined, company: c.company ?? undefined });
          return sell;
        });
        const resp = await directMatcher.findMatches(
          buyRequest, sellCandidates,
          { buyRequestId: buyRequest.id, includeExplanations: true, limit: 50 },
          { networkByTargetId, targetOwnerByTargetId: ownerByTargetId },
        );
        directMatches = resp.matches;
      } else {
        directMode = 'SELL_TO_NETWORK_BUYERS';
        const sellOffering = dealRequestToSellOffering(dealRow);
        const buyCandidates = contactRows.map(c => {
          const buy = contactToBuyRequest(c, { fallbackCategory: sellOffering.solutionCategory, fallbackIndustry: sellOffering.industryFocus });
          networkByTargetId.set(buy.id, networkContextForContact(c));
          ownerByTargetId.set(buy.id, { userId: c.ownerId, organizationId: c.organizationId ?? undefined, fullName: c.fullName ?? undefined, company: c.company ?? undefined });
          return buy;
        });
        const resp = await directMatcher.findBuyersForSeller(
          sellOffering, buyCandidates, 50,
          { networkByTargetId, targetOwnerByTargetId: ownerByTargetId },
        );
        directMatches = resp.matches;
      }

      // ---- Helper flow ----
      const helperCandidates = contactRows.map(contactToHelperCandidate);
      const helperResp = deal.mode === DealMode.BUY
        ? await helperMatcher.findHelpersForBuy(dealRequestToBuyRequest(dealRow), helperCandidates, { limit: 50 })
        : await helperMatcher.findHelpersForSell(dealRequestToSellOffering(dealRow), helperCandidates, { limit: 50 });

      // ---- Persist ----
      // Wipe + bulk-insert. We bypass the repository because it doesn't yet
      // know v4.1 columns; this is intentional and isolated to the flag path.
      await prisma.dealMatchResult.deleteMany({ where: { dealRequestId: deal.id } });
      await prisma.dealHelperMatchResult.deleteMany({ where: { dealRequestId: deal.id } });

      const directRows = directMatches
        .filter(m => contactIdFromTargetId(m.targetId) !== null)
        .map(m => {
          const contactId = contactIdFromTargetId(m.targetId)!;
          return {
            dealRequestId: deal.id,
            contactId,
            score: m.finalScore,
            category: deal.mode === DealMode.BUY ? 'SOLUTION_PROVIDER' as const : 'POTENTIAL_CLIENT' as const,
            reasonsJson: m.explanation?.strengths?.map(s => ({ type: 'strength', text: s, evidence: '' })) ?? [],
            breakdownJson: m.scoreBreakdown as any,
            // v4.1 columns
            finalScore: m.finalScore,
            deterministicScore: m.deterministicScore,
            aiScore: m.aiScore ?? null,
            effectiveRankScore: m.effectiveRankScore,
            confidence: m.confidence,
            rank: m.rank,
            matchLevel: m.matchLevel,
            matchMode: directMode,
            hardFilterStatus: m.hardFilterStatus,
            hardFilterReason: m.hardFilterReason ?? null,
            surfacedStatus: m.surfacedStatus,
            scoreBreakdownV4: m.scoreBreakdown as any,
            explanationV4: m.explanation as any,
            retrievalScore: m.retrievalScore,
            retrievalBreakdown: m.retrievalBreakdown as any,
            rankingFactors: m.rankingFactors as any,
            aiReasoning: m.aiReasoning ?? null,
            aiGreenFlags: m.aiGreenFlags as any,
            aiRedFlags: m.aiRedFlags as any,
            networkRelationship: m.networkRelationship as any,
          };
        });

      if (directRows.length) {
        await prisma.dealMatchResult.createMany({ data: directRows, skipDuplicates: true });
      }

      const helperRows = helperResp.matches.map(m => ({
        dealRequestId: deal.id,
        helperContactId: m.targetEntityId,
        helperUserId: m.helperUserId,
        matchMode: m.matchMode,
        helperType: m.helperType,
        helperTypeLabel: m.helperTypeLabel,
        likelyHelpType: m.likelyHelpType,
        helperName: m.helperName,
        helperTitle: m.helperTitle,
        helperRoleArea: m.helperRoleArea,
        helperOrganization: m.helperOrganization,
        finalScore: m.finalScore,
        deterministicScore: m.deterministicScore,
        aiScore: m.aiScore ?? null,
        effectiveRankScore: m.effectiveRankScore,
        confidence: m.confidence,
        matchLevel: m.matchLevel,
        surfacedStatus: m.surfacedStatus,
        hardFilterStatus: m.hardFilterStatus,
        hardFilterReason: m.hardFilterReason ?? null,
        retrievalScore: m.retrievalScore,
        retrievalBreakdown: m.retrievalBreakdown as any,
        rankingFactors: m.rankingFactors as any,
        scoreBreakdown: m.scoreBreakdown as any,
        explanation: m.explanation as any,
        helperExplanation: m.helperExplanation,
        strengths: m.strengths as any,
        gaps: m.gaps as any,
        matchedSignals: m.matchedSignals as any,
        missingFields: m.missingOrUncertainFields as any,
        networkRelationship: m.networkRelationship as any,
        aiReasoning: m.aiReasoning ?? null,
        aiGreenFlags: m.aiGreenFlags as any,
        aiRedFlags: m.aiRedFlags as any,
        rank: m.rank,
      }));

      if (helperRows.length) {
        await prisma.dealHelperMatchResult.createMany({ data: helperRows, skipDuplicates: true });
      }

      const matchCount = directRows.length;
      const avgScore = matchCount > 0
        ? Math.round(directRows.reduce((acc, r) => acc + r.score, 0) / matchCount)
        : 0;

      await this.dealRepository.update(deal.id, {
        status: DealStatus.COMPLETED, matchCount, avgScore,
      });
      const processingTime = Date.now() - startTime;
      logger.info('Deal matching complete (v4.1 sync)', {
        dealId: deal.id, matchCount, helperCount: helperRows.length, avgScore, processingTime,
      });
      return { status: 'COMPLETED', matchCount, avgScore, processingTime };
    } catch (err) {
      await this.dealRepository.update(deal.id, { status: DealStatus.FAILED });
      throw err;
    }
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

/**
 * Strip the synthesized prefix from a v4 candidate id back to a Contact.id.
 * Synthesized ids are produced by adapter.contactToSellOffering /
 * contactToBuyRequest as `contact-as-sell:<id>` / `contact-as-buy:<id>`.
 */
function contactIdFromTargetId(targetId: string): string | null {
  if (targetId.startsWith('contact-as-sell:')) return targetId.slice('contact-as-sell:'.length);
  if (targetId.startsWith('contact-as-buy:')) return targetId.slice('contact-as-buy:'.length);
  return null;
}
