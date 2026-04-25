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
  summary: {
    totalMatches: number;
    avgScore: number;
    topCategory: DealMatchCategory | null;
  };
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

    // Get contact details for each match
    const results: MatchResultDTO[] = [];
    const categoryCount = new Map<DealMatchCategory, number>();

    for (const match of matches) {
      const contact = await this.contactRepository.findById(match.contactId);
      if (!contact) continue;

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
      });

      // Track category counts
      categoryCount.set(match.category, (categoryCount.get(match.category) || 0) + 1);
    }

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
      summary: {
        totalMatches: deal.matchCount,
        avgScore: deal.avgScore,
        topCategory,
      },
    };
  }
}
