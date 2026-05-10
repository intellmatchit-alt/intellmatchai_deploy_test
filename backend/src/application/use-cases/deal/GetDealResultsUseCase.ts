/**
 * Use Case: Get Deal Results
 * Returns deal with ranked matches
 */

import { IDealRequestRepository, IDealMatchResultRepository } from '../../../domain/repositories/IDealRepository';
import { IContactRepository } from '../../../domain/repositories/IContactRepository';
import {
  DealMode,
  DealStatus,
  DealMatchCategory,
  DealMatchStatus,
  MatchReason,
  MatchBreakdown,
} from '../../../domain/entities/Deal';
import { NotFoundError, AuthorizationError, ConflictError } from '../../../shared/errors/index';
import { prisma } from '../../../infrastructure/database/prisma/client';

// ============================================================================
// DTOs
// ============================================================================

export interface ContactSummaryDTO {
  id: string;
  fullName: string;
  company: string | null;
  jobTitle: string | null;
  avatarUrl: string | null;
  email: string | null;
  phone?: string | null;
  linkedinUrl?: string | null;
}

export interface MatchResultDTO {
  id: string;
  contact: ContactSummaryDTO;
  score: number;
  category: DealMatchCategory;
  reasons: MatchReason[];
  breakdown: MatchBreakdown;
  openerMessage: string | null;
  openerEdited: string | null;
  status: DealMatchStatus;

  // v4.1 fields — present only when the row was scored by the v4 engine.
  // Frontend MUST tolerate their absence on legacy rows.
  finalScore?: number | null;
  deterministicScore?: number | null;
  aiScore?: number | null;
  effectiveRankScore?: number | null;
  matchLevel?: string | null;
  matchMode?: string | null;
  confidence?: number | null;
  hardFilterStatus?: string | null;
  hardFilterReason?: string | null;
  retrievalScore?: number | null;
  retrievalBreakdown?: any;
  rankingFactors?: any;
  scoreBreakdownV4?: any;
  explanationV4?: any;
  aiReasoning?: string | null;
  aiGreenFlags?: any;
  aiRedFlags?: any;
  networkRelationship?: any;
  rank?: number | null;
}

export interface HelperMatchResultDTO {
  id: string;
  matchMode: 'BUY_TO_SELLER_HELPERS' | 'SELL_TO_BUYER_HELPERS';
  helperUserId: string | null;
  helperContactId: string | null;
  helperName: string;
  helperTitle: string | null;
  helperRoleArea: string | null;
  helperOrganization: string | null;
  helperType: string;
  helperTypeLabel: string | null;
  likelyHelpType: string | null;

  finalScore: number;
  deterministicScore: number;
  aiScore: number | null;
  effectiveRankScore: number;
  matchLevel: string;
  confidence: number;

  hardFilterStatus?: string | null;
  retrievalScore?: number | null;
  retrievalBreakdown?: any;
  rankingFactors?: any;
  scoreBreakdown: any;
  explanation: any;
  helperExplanation: string | null;
  strengths?: any;
  gaps?: any;
  matchedSignals?: any;
  missingFields?: any;
  networkRelationship?: any;

  aiReasoning?: string | null;
  aiGreenFlags?: any;
  aiRedFlags?: any;

  rank: number | null;
  status: DealMatchStatus;
  createdAt: string;
}

export interface DealDTO {
  id: string;
  mode: DealMode;
  title: string | null;
  domain: string | null;
  solutionType: string | null;
  companySize: string | null;
  problemStatement: string | null;
  targetEntityType: string | null;
  productName: string | null;
  targetDescription: string | null;
  status: DealStatus;
  createdAt: string;
}

export interface DealResultsResponseDTO {
  deal: DealDTO;
  results: MatchResultDTO[];
  /** Helper / introducer matches when the v4.1 engine produced them. */
  helperResults?: HelperMatchResultDTO[];
  summary: {
    totalMatches: number;
    avgScore: number;
    topCategory: DealMatchCategory | null;
    totalHelperMatches?: number;
    avgHelperScore?: number;
  };
  /** Engine version that produced these rows ('4.1.0' for v4 rows, undefined for legacy). */
  engineVersion?: string;
}

export interface GetDealResultsQuery {
  minScore?: number;
  status?: DealMatchStatus;
  limit?: number;
}

// ============================================================================
// Use Case
// ============================================================================

export class GetDealResultsUseCase {
  constructor(
    private readonly dealRepository: IDealRequestRepository,
    private readonly matchRepository: IDealMatchResultRepository,
    private readonly contactRepository: IContactRepository,
  ) {}

  async execute(
    userId: string,
    dealId: string,
    query: GetDealResultsQuery = {}
  ): Promise<DealResultsResponseDTO> {
    const { minScore = 0, status, limit = 50 } = query;

    // Fetch deal
    const deal = await this.dealRepository.findById(dealId);
    if (!deal) {
      throw new NotFoundError('Deal');
    }

    if (deal.userId !== userId) {
      throw new AuthorizationError('Access denied');
    }

    // If still processing, return deal with empty results
    if (deal.status === DealStatus.PROCESSING) {
      return {
        deal: {
          id: deal.id,
          mode: deal.mode,
          title: deal.title,
          domain: deal.domain,
          solutionType: deal.solutionType,
          companySize: deal.companySize,
          problemStatement: deal.problemStatement,
          targetEntityType: deal.targetEntityType,
          productName: deal.productName,
          targetDescription: deal.targetDescription,
          status: deal.status,
          createdAt: deal.createdAt.toISOString(),
        },
        results: [],
        summary: {
          totalMatches: 0,
          avgScore: 0,
          topCategory: null,
        },
      };
    }

    // Fetch matches
    const matches = await this.matchRepository.findByDealRequestId(dealId, {
      minScore,
      status,
      limit,
    });

    // Side-channel fetch for v4.1 columns the legacy entity strips out.
    // Optional and additive — if these are missing the response degrades to
    // legacy fields, exactly like older deals.
    const matchIds = matches.map(m => m.id);
    const v4Rows = matchIds.length
      ? await prisma.dealMatchResult.findMany({
          where: { id: { in: matchIds } },
          select: {
            id: true, finalScore: true, deterministicScore: true, aiScore: true,
            effectiveRankScore: true, matchLevel: true, matchMode: true,
            confidence: true, hardFilterStatus: true, hardFilterReason: true,
            retrievalScore: true, retrievalBreakdown: true, rankingFactors: true,
            scoreBreakdownV4: true, explanationV4: true,
            aiReasoning: true, aiGreenFlags: true, aiRedFlags: true,
            networkRelationship: true, rank: true, surfacedStatus: true,
          },
        })
      : [];
    const v4ById = new Map(v4Rows.map(r => [r.id, r]));
    let anyV4 = false;

    // Get contact details for each match
    const results: MatchResultDTO[] = [];
    const categoryCount = new Map<DealMatchCategory, number>();

    for (const match of matches) {
      const contact = await this.contactRepository.findById(match.contactId);
      if (!contact) continue;
      const v4 = v4ById.get(match.id);
      if (v4 && (v4.finalScore !== null || v4.matchLevel !== null)) anyV4 = true;

      results.push({
        id: match.id,
        contact: {
          id: contact.id,
          fullName: contact.name,
          company: contact.company,
          jobTitle: contact.jobTitle,
          avatarUrl: contact.avatarUrl,
          email: contact.email,
          phone: contact.phone,
          linkedinUrl: contact.linkedInUrl,
        },
        score: match.score,
        category: match.category,
        reasons: match.reasonsJson,
        breakdown: match.breakdownJson,
        openerMessage: match.openerMessage,
        openerEdited: match.openerEdited,
        status: match.status,
        // v4.1 passthrough (null on legacy rows)
        finalScore: v4?.finalScore ?? null,
        deterministicScore: v4?.deterministicScore ?? null,
        aiScore: v4?.aiScore ?? null,
        effectiveRankScore: v4?.effectiveRankScore ?? null,
        matchLevel: v4?.matchLevel ?? null,
        matchMode: v4?.matchMode ?? null,
        confidence: v4?.confidence ?? null,
        hardFilterStatus: v4?.hardFilterStatus ?? null,
        hardFilterReason: v4?.hardFilterReason ?? null,
        retrievalScore: v4?.retrievalScore ?? null,
        retrievalBreakdown: v4?.retrievalBreakdown ?? null,
        rankingFactors: v4?.rankingFactors ?? null,
        scoreBreakdownV4: v4?.scoreBreakdownV4 ?? null,
        explanationV4: v4?.explanationV4 ?? null,
        aiReasoning: v4?.aiReasoning ?? null,
        aiGreenFlags: v4?.aiGreenFlags ?? null,
        aiRedFlags: v4?.aiRedFlags ?? null,
        networkRelationship: v4?.networkRelationship ?? null,
        rank: v4?.rank ?? null,
      });

      // Track category counts
      categoryCount.set(match.category, (categoryCount.get(match.category) || 0) + 1);
    }

    // Helper matches (only present when v4.1 engine ran).
    const helperRows = await prisma.dealHelperMatchResult.findMany({
      where: { dealRequestId: dealId, ...(status ? { status } : {}) },
      orderBy: [{ effectiveRankScore: 'desc' }, { finalScore: 'desc' }],
      take: limit,
    });
    const helperResults: HelperMatchResultDTO[] = helperRows.map(r => ({
      id: r.id,
      matchMode: r.matchMode as HelperMatchResultDTO['matchMode'],
      helperUserId: r.helperUserId,
      helperContactId: r.helperContactId,
      helperName: r.helperName,
      helperTitle: r.helperTitle,
      helperRoleArea: r.helperRoleArea,
      helperOrganization: r.helperOrganization,
      helperType: r.helperType,
      helperTypeLabel: r.helperTypeLabel,
      likelyHelpType: r.likelyHelpType,
      finalScore: r.finalScore,
      deterministicScore: r.deterministicScore,
      aiScore: r.aiScore,
      effectiveRankScore: r.effectiveRankScore,
      matchLevel: r.matchLevel,
      confidence: r.confidence,
      hardFilterStatus: r.hardFilterStatus,
      retrievalScore: r.retrievalScore,
      retrievalBreakdown: r.retrievalBreakdown,
      rankingFactors: r.rankingFactors,
      scoreBreakdown: r.scoreBreakdown,
      explanation: r.explanation,
      helperExplanation: r.helperExplanation,
      strengths: r.strengths,
      gaps: r.gaps,
      matchedSignals: r.matchedSignals,
      missingFields: r.missingFields,
      networkRelationship: r.networkRelationship,
      aiReasoning: r.aiReasoning,
      aiGreenFlags: r.aiGreenFlags,
      aiRedFlags: r.aiRedFlags,
      rank: r.rank,
      // Prisma enum and domain enum share string values — cast across boundary.
      status: r.status as DealMatchStatus,
      createdAt: r.createdAt.toISOString(),
    }));
    const totalHelperMatches = helperResults.length;
    const avgHelperScore = totalHelperMatches
      ? Math.round(helperResults.reduce((s, m) => s + m.finalScore, 0) / totalHelperMatches)
      : 0;

    // Find top category
    let topCategory: DealMatchCategory | null = null;
    let maxCount = 0;
    for (const [category, count] of categoryCount) {
      if (count > maxCount) {
        maxCount = count;
        topCategory = category;
      }
    }

    return {
      deal: {
        id: deal.id,
        mode: deal.mode,
        title: deal.title,
        domain: deal.domain,
        solutionType: deal.solutionType,
        companySize: deal.companySize,
        problemStatement: deal.problemStatement,
        targetEntityType: deal.targetEntityType,
        productName: deal.productName,
        targetDescription: deal.targetDescription,
        status: deal.status,
        createdAt: deal.createdAt.toISOString(),
      },
      results,
      helperResults: helperResults.length ? helperResults : undefined,
      summary: {
        totalMatches: deal.matchCount,
        avgScore: deal.avgScore,
        topCategory,
        totalHelperMatches: totalHelperMatches || undefined,
        avgHelperScore: totalHelperMatches ? avgHelperScore : undefined,
      },
      engineVersion: anyV4 || helperRows.length > 0 ? '4.1.0' : undefined,
    };
  }
}
