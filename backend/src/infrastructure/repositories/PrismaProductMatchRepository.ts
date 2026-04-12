/**
 * Prisma Product Match Repository Implementation
 * Data access layer for product match operations (Sell Smarter feature)
 */

import { PrismaClient, Prisma } from '@prisma/client';
import { prisma } from '../database/prisma/client';
import {
  IProductProfileRepository,
  IProductMatchRunRepository,
  IProductMatchResultRepository,
  IContactMatchingRepository,
  ProductMatchRunListOptions,
  ProductMatchResultListOptions,
  ProductMatchResultStats,
} from '../../domain/repositories/IProductMatchRepository';
import {
  ProductProfileEntity,
  ProductMatchRunEntity,
  ProductMatchResultEntity,
  ProductType,
  ProductMatchRunStatus,
  ProductMatchBadge,
  UpsertProductProfileInput,
  CreateProductMatchRunInput,
  UpdateProductMatchRunInput,
  CreateProductMatchResultInput,
  UpdateProductMatchResultInput,
  ExplanationBullet,
  ProductMatchBreakdown,
  ContactForMatching,
} from '../../domain/entities/ProductMatch';

// ============================================================================
// Product Profile Repository
// ============================================================================

export class PrismaProductProfileRepository implements IProductProfileRepository {
  async upsert(input: UpsertProductProfileInput): Promise<ProductProfileEntity> {
    const profile = await prisma.productProfile.upsert({
      where: { userId: input.userId },
      create: {
        userId: input.userId,
        productType: input.productType,
        productName: input.productName,
        targetIndustry: input.targetIndustry,
        targetCompanySize: input.targetCompanySize,
        problemSolved: input.problemSolved,
        decisionMakerRole: input.decisionMakerRole,
        additionalContext: input.additionalContext,
      },
      update: {
        productType: input.productType,
        productName: input.productName,
        targetIndustry: input.targetIndustry,
        targetCompanySize: input.targetCompanySize,
        problemSolved: input.problemSolved,
        decisionMakerRole: input.decisionMakerRole,
        additionalContext: input.additionalContext,
      },
    });

    return this.mapToEntity(profile);
  }

  async findByUserId(userId: string): Promise<ProductProfileEntity | null> {
    const profile = await prisma.productProfile.findUnique({
      where: { userId },
    });

    return profile ? this.mapToEntity(profile) : null;
  }

  async findById(id: string): Promise<ProductProfileEntity | null> {
    const profile = await prisma.productProfile.findUnique({
      where: { id },
    });

    return profile ? this.mapToEntity(profile) : null;
  }

  async delete(id: string): Promise<void> {
    await prisma.productProfile.delete({
      where: { id },
    });
  }

  private mapToEntity(profile: any): ProductProfileEntity {
    return {
      id: profile.id,
      userId: profile.userId,
      productType: profile.productType as ProductType,
      productName: profile.productName,
      targetIndustry: profile.targetIndustry,
      targetCompanySize: profile.targetCompanySize,
      problemSolved: profile.problemSolved,
      decisionMakerRole: profile.decisionMakerRole,
      additionalContext: profile.additionalContext,
      isActive: profile.isActive,
      createdAt: profile.createdAt,
      updatedAt: profile.updatedAt,
    };
  }
}

// ============================================================================
// Product Match Run Repository
// ============================================================================

export class PrismaProductMatchRunRepository implements IProductMatchRunRepository {
  async create(input: CreateProductMatchRunInput): Promise<ProductMatchRunEntity> {
    const run = await prisma.productMatchRun.create({
      data: {
        userId: input.userId,
        productProfileId: input.productProfileId,
        totalContacts: input.totalContacts || 0,
        bullJobId: input.bullJobId,
      },
    });

    return this.mapToEntity(run);
  }

  async findById(id: string): Promise<ProductMatchRunEntity | null> {
    const run = await prisma.productMatchRun.findUnique({
      where: { id },
    });

    return run ? this.mapToEntity(run) : null;
  }

  async findByUserId(options: ProductMatchRunListOptions): Promise<{ runs: ProductMatchRunEntity[]; total: number }> {
    const { userId, status, page = 1, limit = 20 } = options;
    const skip = (page - 1) * limit;

    const where: Prisma.ProductMatchRunWhereInput = {
      userId,
      ...(status && { status }),
    };

    const [runs, total] = await Promise.all([
      prisma.productMatchRun.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.productMatchRun.count({ where }),
    ]);

    return {
      runs: runs.map(this.mapToEntity),
      total,
    };
  }

  async update(id: string, input: UpdateProductMatchRunInput): Promise<ProductMatchRunEntity> {
    const run = await prisma.productMatchRun.update({
      where: { id },
      data: input,
    });

    return this.mapToEntity(run);
  }

  async delete(id: string): Promise<void> {
    await prisma.productMatchRun.delete({
      where: { id },
    });
  }

  async findLatestByUserId(userId: string): Promise<ProductMatchRunEntity | null> {
    const run = await prisma.productMatchRun.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    return run ? this.mapToEntity(run) : null;
  }

  async countByUserId(userId: string): Promise<number> {
    return prisma.productMatchRun.count({
      where: { userId },
    });
  }

  private mapToEntity(run: any): ProductMatchRunEntity {
    return {
      id: run.id,
      userId: run.userId,
      productProfileId: run.productProfileId,
      status: run.status as ProductMatchRunStatus,
      progress: run.progress,
      totalContacts: run.totalContacts,
      matchCount: run.matchCount,
      avgScore: run.avgScore,
      error: run.error,
      startedAt: run.startedAt,
      completedAt: run.completedAt,
      bullJobId: run.bullJobId,
      createdAt: run.createdAt,
      updatedAt: run.updatedAt,
    };
  }
}

// ============================================================================
// Product Match Result Repository
// ============================================================================

export class PrismaProductMatchResultRepository implements IProductMatchResultRepository {
  async create(input: CreateProductMatchResultInput): Promise<ProductMatchResultEntity> {
    const result = await prisma.productMatchResult.create({
      data: {
        matchRunId: input.matchRunId,
        contactId: input.contactId,
        score: input.score,
        badge: input.badge,
        explanationJson: input.explanationJson as unknown as Prisma.JsonArray,
        talkAngle: input.talkAngle,
        openerMessage: input.openerMessage,
        breakdownJson: input.breakdownJson as unknown as Prisma.JsonObject,
      },
    });

    return this.mapToEntity(result);
  }

  async createMany(inputs: CreateProductMatchResultInput[]): Promise<ProductMatchResultEntity[]> {
    // Use transaction for batch insert
    const results = await prisma.$transaction(
      inputs.map((input) =>
        prisma.productMatchResult.create({
          data: {
            matchRunId: input.matchRunId,
            contactId: input.contactId,
            score: input.score,
            badge: input.badge,
            explanationJson: input.explanationJson as unknown as Prisma.JsonArray,
            talkAngle: input.talkAngle,
            openerMessage: input.openerMessage,
            breakdownJson: input.breakdownJson as unknown as Prisma.JsonObject,
          },
        })
      )
    );

    return results.map(this.mapToEntity);
  }

  async findById(id: string): Promise<ProductMatchResultEntity | null> {
    const result = await prisma.productMatchResult.findUnique({
      where: { id },
    });

    return result ? this.mapToEntity(result) : null;
  }

  async findByMatchRunId(options: ProductMatchResultListOptions): Promise<ProductMatchResultEntity[]> {
    const { matchRunId, minScore, badge, excludeDismissed, limit = 50, offset = 0 } = options;

    const results = await prisma.productMatchResult.findMany({
      where: {
        matchRunId,
        ...(minScore !== undefined && { score: { gte: minScore } }),
        ...(badge && { badge }),
        ...(excludeDismissed && { isDismissed: false }),
      },
      orderBy: { score: 'desc' },
      skip: offset,
      take: limit,
    });

    return results.map(this.mapToEntity);
  }

  async findByContactIdAndRunId(contactId: string, runId: string): Promise<ProductMatchResultEntity | null> {
    const result = await prisma.productMatchResult.findUnique({
      where: {
        matchRunId_contactId: { matchRunId: runId, contactId },
      },
    });

    return result ? this.mapToEntity(result) : null;
  }

  async update(id: string, input: UpdateProductMatchResultInput): Promise<ProductMatchResultEntity> {
    const result = await prisma.productMatchResult.update({
      where: { id },
      data: input,
    });

    return this.mapToEntity(result);
  }

  async deleteByMatchRunId(matchRunId: string): Promise<void> {
    await prisma.productMatchResult.deleteMany({
      where: { matchRunId },
    });
  }

  async countByMatchRunId(matchRunId: string): Promise<number> {
    return prisma.productMatchResult.count({
      where: { matchRunId },
    });
  }

  async getStatsByMatchRunId(matchRunId: string): Promise<ProductMatchResultStats> {
    const [avgResult, countsByBadge, total] = await Promise.all([
      prisma.productMatchResult.aggregate({
        where: { matchRunId },
        _avg: { score: true },
      }),
      prisma.productMatchResult.groupBy({
        by: ['badge'],
        where: { matchRunId },
        _count: { badge: true },
      }),
      prisma.productMatchResult.count({
        where: { matchRunId },
      }),
    ]);

    const badgeCounts = countsByBadge.reduce(
      (acc, item) => {
        acc[item.badge] = item._count.badge;
        return acc;
      },
      {} as Record<string, number>
    );

    return {
      totalMatches: total,
      avgScore: Math.round(avgResult._avg.score || 0),
      suitableCount: badgeCounts['SUITABLE'] || 0,
      influencerCount: badgeCounts['INFLUENCER'] || 0,
      notSuitableCount: badgeCounts['NOT_SUITABLE'] || 0,
    };
  }

  private mapToEntity(result: any): ProductMatchResultEntity {
    return {
      id: result.id,
      matchRunId: result.matchRunId,
      contactId: result.contactId,
      score: result.score,
      badge: result.badge as ProductMatchBadge,
      explanationJson: result.explanationJson as ExplanationBullet[],
      talkAngle: result.talkAngle,
      openerMessage: result.openerMessage,
      openerEdited: result.openerEdited,
      breakdownJson: result.breakdownJson as ProductMatchBreakdown,
      isSaved: result.isSaved,
      isDismissed: result.isDismissed,
      isContacted: result.isContacted,
      createdAt: result.createdAt,
      updatedAt: result.updatedAt,
    };
  }
}

// ============================================================================
// Contact Matching Repository
// ============================================================================

export class PrismaContactMatchingRepository implements IContactMatchingRepository {
  async findContactsForMatching(userId: string): Promise<ContactForMatching[]> {
    const contacts = await prisma.contact.findMany({
      where: { ownerId: userId },
      include: {
        contactSectors: {
          include: { sector: true },
        },
        contactSkills: {
          include: { skill: true },
        },
        _count: {
          select: { interactions: true },
        },
      },
    });

    return contacts.map((contact) => ({
      id: contact.id,
      fullName: contact.fullName,
      jobTitle: contact.jobTitle,
      company: contact.company,
      matchScore: contact.matchScore ? Number(contact.matchScore) : null,
      enrichmentData: contact.enrichmentData as {
        industry?: string;
        companySize?: string;
        department?: string;
      } | null,
      lastInteractionAt: contact.lastInteractionAt,
      interactionCount: contact._count.interactions,
      sectors: contact.contactSectors.map((cs) => cs.sector.name),
      skills: contact.contactSkills.map((cs) => cs.skill.name),
    }));
  }

  async countContactsForMatching(userId: string): Promise<number> {
    return prisma.contact.count({
      where: { ownerId: userId },
    });
  }
}
