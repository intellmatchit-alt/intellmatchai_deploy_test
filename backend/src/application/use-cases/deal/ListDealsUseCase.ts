/**
 * Use Case: List Deals
 * Returns user's deal requests with pagination
 */

import { IDealRequestRepository } from '../../../domain/repositories/IDealRepository';
import { DealMode, DealStatus } from '../../../domain/entities/Deal';

export interface ListDealsQuery {
  mode?: DealMode;
  status?: DealStatus;
  page?: number;
  limit?: number;
}

export interface DealListItemDTO {
  id: string;
  userId: string;
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
  matchCount: number;
  avgScore: number;
  createdAt: string;
}

export interface ListDealsOutput {
  deals: DealListItemDTO[];
  total: number;
  page: number;
  limit: number;
}

export class ListDealsUseCase {
  constructor(private readonly dealRepository: IDealRequestRepository) {}

  async execute(userId: string, query: ListDealsQuery = {}): Promise<ListDealsOutput> {
    const { mode, status, page = 1, limit = 20 } = query;

    const { deals, total } = await this.dealRepository.findByUserId({
      userId,
      mode,
      status,
      page,
      limit,
    });

    return {
      deals: deals.map(deal => ({
        id: deal.id,
        userId: deal.userId,
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
        matchCount: deal.matchCount,
        avgScore: deal.avgScore,
        createdAt: deal.createdAt.toISOString(),
      })),
      total,
      page,
      limit,
    };
  }
}
