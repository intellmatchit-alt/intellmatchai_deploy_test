/**
 * Prisma Deal Repository Implementation
 * Data access layer for deal matching operations
 */

import { PrismaClient, Prisma } from '@prisma/client';
import { prisma } from '../database/prisma/client';
import {
  IDealRequestRepository,
  IDealMatchResultRepository,
  IDealJobRepository,
  DealRequestListOptions,
  DealMatchResultListOptions,
} from '../../domain/repositories/IDealRepository';
import {
  DealRequestEntity,
  DealMatchResultEntity,
  DealJobEntity,
  DealMode,
  DealStatus,
  DealMatchCategory,
  DealMatchStatus,
  DealJobStep,
  DealJobStatus,
  CreateDealRequestInput,
  UpdateDealRequestInput,
  CreateDealMatchResultInput,
  UpdateDealMatchResultInput,
  CreateDealJobInput,
  UpdateDealJobInput,
  MatchReason,
  MatchBreakdown,
} from '../../domain/entities/Deal';

// ============================================================================
// Deal Request Repository
// ============================================================================

export class PrismaDealRequestRepository implements IDealRequestRepository {
  async create(input: CreateDealRequestInput): Promise<DealRequestEntity> {
    const deal = await prisma.dealRequest.create({
      data: {
        userId: input.userId,
        mode: input.mode,
        title: input.title,
        domain: input.domain,
        solutionType: input.solutionType,
        companySize: input.companySize,
        problemStatement: input.problemStatement,
        targetEntityType: input.targetEntityType,
        productName: input.productName,
        targetDescription: input.targetDescription,
      },
    });

    return this.mapToEntity(deal);
  }

  async findById(id: string): Promise<DealRequestEntity | null> {
    const deal = await prisma.dealRequest.findUnique({
      where: { id },
    });

    return deal ? this.mapToEntity(deal) : null;
  }

  async findByUserId(options: DealRequestListOptions): Promise<{ deals: DealRequestEntity[]; total: number }> {
    const { userId, mode, status, page = 1, limit = 20 } = options;
    const skip = (page - 1) * limit;

    const where: Prisma.DealRequestWhereInput = {
      userId,
      ...(mode && { mode }),
      ...(status && { status }),
    };

    const [deals, total] = await Promise.all([
      prisma.dealRequest.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.dealRequest.count({ where }),
    ]);

    return {
      deals: deals.map(this.mapToEntity),
      total,
    };
  }

  async update(id: string, input: UpdateDealRequestInput): Promise<DealRequestEntity> {
    const deal = await prisma.dealRequest.update({
      where: { id },
      data: input,
    });

    return this.mapToEntity(deal);
  }

  async delete(id: string): Promise<void> {
    await prisma.dealRequest.delete({
      where: { id },
    });
  }

  async countByUserId(userId: string): Promise<number> {
    return prisma.dealRequest.count({
      where: { userId },
    });
  }

  private mapToEntity(deal: any): DealRequestEntity {
    return {
      id: deal.id,
      userId: deal.userId,
      mode: deal.mode as DealMode,
      title: deal.title,
      domain: deal.domain,
      solutionType: deal.solutionType,
      companySize: deal.companySize,
      problemStatement: deal.problemStatement,
      targetEntityType: deal.targetEntityType,
      productName: deal.productName,
      targetDescription: deal.targetDescription,
      status: deal.status as DealStatus,
      matchCount: deal.matchCount,
      avgScore: deal.avgScore,
      createdAt: deal.createdAt,
      updatedAt: deal.updatedAt,
    };
  }
}

// ============================================================================
// Deal Match Result Repository
// ============================================================================

export class PrismaDealMatchResultRepository implements IDealMatchResultRepository {
  async create(input: CreateDealMatchResultInput): Promise<DealMatchResultEntity> {
    const match = await prisma.dealMatchResult.create({
      data: {
        dealRequestId: input.dealRequestId,
        contactId: input.contactId,
        score: input.score,
        category: input.category,
        reasonsJson: input.reasonsJson as unknown as Prisma.JsonArray,
        breakdownJson: input.breakdownJson as unknown as Prisma.JsonObject,
        openerMessage: input.openerMessage,
      },
    });

    return this.mapToEntity(match);
  }

  async createMany(inputs: CreateDealMatchResultInput[]): Promise<DealMatchResultEntity[]> {
    // Use transaction for batch insert
    const results = await prisma.$transaction(
      inputs.map((input) =>
        prisma.dealMatchResult.create({
          data: {
            dealRequestId: input.dealRequestId,
            contactId: input.contactId,
            score: input.score,
            category: input.category,
            reasonsJson: input.reasonsJson as unknown as Prisma.JsonArray,
            breakdownJson: input.breakdownJson as unknown as Prisma.JsonObject,
            openerMessage: input.openerMessage,
          },
        })
      )
    );

    return results.map(this.mapToEntity);
  }

  async findById(id: string): Promise<DealMatchResultEntity | null> {
    const match = await prisma.dealMatchResult.findUnique({
      where: { id },
    });

    return match ? this.mapToEntity(match) : null;
  }

  async findByDealRequestId(
    dealRequestId: string,
    options?: DealMatchResultListOptions
  ): Promise<DealMatchResultEntity[]> {
    const { minScore, status, limit = 50, offset = 0 } = options || {};

    const matches = await prisma.dealMatchResult.findMany({
      where: {
        dealRequestId,
        ...(minScore && { score: { gte: minScore } }),
        ...(status ? { status } : { status: { notIn: ['IGNORED', 'ARCHIVED'] } }),
      },
      orderBy: { score: 'desc' },
      skip: offset,
      take: limit,
    });

    return matches.map(this.mapToEntity);
  }

  async update(id: string, input: UpdateDealMatchResultInput): Promise<DealMatchResultEntity> {
    const match = await prisma.dealMatchResult.update({
      where: { id },
      data: input,
    });

    return this.mapToEntity(match);
  }

  async deleteByDealRequestId(dealRequestId: string): Promise<void> {
    await prisma.dealMatchResult.deleteMany({
      where: { dealRequestId },
    });
  }

  async countByDealRequestId(dealRequestId: string): Promise<number> {
    return prisma.dealMatchResult.count({
      where: { dealRequestId },
    });
  }

  async getAverageScoreByDealRequestId(dealRequestId: string): Promise<number> {
    const result = await prisma.dealMatchResult.aggregate({
      where: { dealRequestId },
      _avg: { score: true },
    });

    return Math.round(result._avg.score || 0);
  }

  private mapToEntity(match: any): DealMatchResultEntity {
    return {
      id: match.id,
      dealRequestId: match.dealRequestId,
      contactId: match.contactId,
      score: match.score,
      category: match.category as DealMatchCategory,
      reasonsJson: match.reasonsJson as MatchReason[],
      breakdownJson: match.breakdownJson as MatchBreakdown,
      openerMessage: match.openerMessage,
      openerEdited: match.openerEdited,
      status: match.status as DealMatchStatus,
      savedAt: match.savedAt,
      ignoredAt: match.ignoredAt,
      contactedAt: match.contactedAt,
      createdAt: match.createdAt,
      updatedAt: match.updatedAt,
    };
  }
}

// ============================================================================
// Deal Job Repository
// ============================================================================

export class PrismaDealJobRepository implements IDealJobRepository {
  async create(input: CreateDealJobInput): Promise<DealJobEntity> {
    const job = await prisma.dealJob.create({
      data: {
        dealRequestId: input.dealRequestId,
        step: input.step,
        maxAttempts: input.maxAttempts || 3,
      },
    });

    return this.mapToEntity(job);
  }

  async createMany(inputs: CreateDealJobInput[]): Promise<DealJobEntity[]> {
    const results = await prisma.$transaction(
      inputs.map((input) =>
        prisma.dealJob.create({
          data: {
            dealRequestId: input.dealRequestId,
            step: input.step,
            maxAttempts: input.maxAttempts || 3,
          },
        })
      )
    );

    return results.map(this.mapToEntity);
  }

  async findByDealRequestId(dealRequestId: string): Promise<DealJobEntity[]> {
    const jobs = await prisma.dealJob.findMany({
      where: { dealRequestId },
      orderBy: { createdAt: 'asc' },
    });

    return jobs.map(this.mapToEntity);
  }

  async findByDealRequestIdAndStep(dealRequestId: string, step: DealJobStep): Promise<DealJobEntity | null> {
    const job = await prisma.dealJob.findUnique({
      where: {
        dealRequestId_step: { dealRequestId, step },
      },
    });

    return job ? this.mapToEntity(job) : null;
  }

  async update(id: string, input: UpdateDealJobInput): Promise<DealJobEntity> {
    const job = await prisma.dealJob.update({
      where: { id },
      data: input,
    });

    return this.mapToEntity(job);
  }

  async updateByDealRequestIdAndStep(
    dealRequestId: string,
    step: DealJobStep,
    input: UpdateDealJobInput
  ): Promise<DealJobEntity> {
    const job = await prisma.dealJob.update({
      where: {
        dealRequestId_step: { dealRequestId, step },
      },
      data: input,
    });

    return this.mapToEntity(job);
  }

  async incrementAttempts(id: string): Promise<DealJobEntity> {
    const job = await prisma.dealJob.update({
      where: { id },
      data: { attempts: { increment: 1 } },
    });

    return this.mapToEntity(job);
  }

  private mapToEntity(job: any): DealJobEntity {
    return {
      id: job.id,
      dealRequestId: job.dealRequestId,
      step: job.step as DealJobStep,
      status: job.status as DealJobStatus,
      progress: job.progress,
      error: job.error,
      attempts: job.attempts,
      maxAttempts: job.maxAttempts,
      startedAt: job.startedAt,
      completedAt: job.completedAt,
      bullJobId: job.bullJobId,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
    };
  }
}
