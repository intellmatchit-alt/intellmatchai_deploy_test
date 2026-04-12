/**
 * Use Case: Get Product Match Results
 * Retrieves paginated results for a match run
 */

import {
  IProductMatchRunRepository,
  IProductMatchResultRepository,
  ProductMatchResultStats,
} from '../../../domain/repositories/IProductMatchRepository';
import { ProductMatchResultEntity, ProductMatchBadge } from '../../../domain/entities/ProductMatch';
import { NotFoundError, AuthorizationError } from '../../../shared/errors/index.js';
import { prisma } from '../../../infrastructure/database/prisma/client';

export interface GetResultsOptions {
  badge?: ProductMatchBadge;
  minScore?: number;
  excludeDismissed?: boolean;
  limit?: number;
  offset?: number;
}

export interface GetResultsOutput {
  run: {
    id: string;
    status: string;
    matchCount: number;
    avgScore: number;
    totalContacts: number;
    completedAt: Date | null;
  };
  results: Array<ProductMatchResultEntity & {
    contact: {
      id: string;
      fullName: string;
      company: string | null;
      jobTitle: string | null;
      avatarUrl: string | null;
    };
  }>;
  summary: ProductMatchResultStats;
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

export class GetProductMatchResultsUseCase {
  constructor(
    private readonly runRepository: IProductMatchRunRepository,
    private readonly resultRepository: IProductMatchResultRepository
  ) {}

  async execute(userId: string, runId: string, options: GetResultsOptions = {}): Promise<GetResultsOutput> {
    // Verify run exists and belongs to user
    const run = await this.runRepository.findById(runId);

    if (!run) {
      throw new NotFoundError('Match run not found');
    }

    if (run.userId !== userId) {
      throw new AuthorizationError('Access denied');
    }

    const limit = options.limit || 20;
    const offset = options.offset || 0;

    // Get results with contact info
    const results = await this.resultRepository.findByMatchRunId({
      matchRunId: runId,
      badge: options.badge,
      minScore: options.minScore,
      excludeDismissed: options.excludeDismissed,
      limit,
      offset,
    });

    // Fetch contact details for results
    const contactIds = results.map(r => r.contactId);
    const contacts = await prisma.contact.findMany({
      where: { id: { in: contactIds } },
      select: {
        id: true,
        fullName: true,
        company: true,
        jobTitle: true,
        avatarUrl: true,
      },
    });

    const contactMap = new Map(contacts.map(c => [c.id, c]));

    // Combine results with contact info
    const resultsWithContacts = results.map(result => ({
      ...result,
      contact: contactMap.get(result.contactId) || {
        id: result.contactId,
        fullName: 'Unknown',
        company: null,
        jobTitle: null,
        avatarUrl: null,
      },
    }));

    // Get summary stats
    const summary = await this.resultRepository.getStatsByMatchRunId(runId);

    return {
      run: {
        id: run.id,
        status: run.status,
        matchCount: run.matchCount,
        avgScore: run.avgScore,
        totalContacts: run.totalContacts,
        completedAt: run.completedAt,
      },
      results: resultsWithContacts,
      summary,
      pagination: {
        total: summary.totalMatches,
        limit,
        offset,
        hasMore: offset + results.length < summary.totalMatches,
      },
    };
  }
}
