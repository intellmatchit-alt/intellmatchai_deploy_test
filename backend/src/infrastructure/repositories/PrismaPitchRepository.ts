/**
 * PNME Repository Implementation: Pitch
 * Prisma-based data access for pitch operations
 */

import { prisma, withRetry } from '../database/prisma/client';
import {
  IPitchRepository,
  IPitchSectionRepository,
  IPitchNeedRepository,
  IPitchMatchRepository,
  IPitchJobRepository,
  IContactProfileCacheRepository,
  IUserPNMEPreferencesRepository,
  CreatePitchInput,
  UpdatePitchInput,
  PitchListOptions,
  PitchWithDetails,
  CreatePitchSectionInput,
  CreatePitchNeedInput,
  CreatePitchMatchInput,
  UpdatePitchMatchInput,
  PitchMatchListOptions,
  CreatePitchJobInput,
  UpdatePitchJobInput,
  CreateContactProfileCacheInput,
  UpdateContactProfileCacheInput,
  CreateUserPNMEPreferencesInput,
  UpdateUserPNMEPreferencesInput,
} from '../../domain/repositories/IPitchRepository';
import {
  PitchEntity,
  PitchSectionEntity,
  PitchNeedEntity,
  PitchMatchEntity,
  PitchJobEntity,
  ContactProfileCacheEntity,
  UserPNMEPreferencesEntity,
  PitchJobStep,
  PitchJobStatus,
  PitchMatchStatus,
  PitchSectionType,
  MatchBreakdown,
  MatchReason,
} from '../../domain/entities/Pitch';
import { logger } from '../../shared/logger';

// ============================================================================
// Pitch Repository
// ============================================================================

export class PrismaPitchRepository implements IPitchRepository {
  async create(input: CreatePitchInput): Promise<PitchEntity> {
    return withRetry(async () => {
      const pitch = await prisma.pitch.create({
        data: {
          userId: input.userId,
          fileKey: input.fileKey,
          fileName: input.fileName,
          fileType: input.fileType,
          fileSize: input.fileSize,
          language: input.language || 'en',
          title: input.title || null,
          expiresAt: input.expiresAt || null,
        },
      });
      return this.mapToEntity(pitch);
    });
  }

  async findById(id: string): Promise<PitchEntity | null> {
    return withRetry(async () => {
      const pitch = await prisma.pitch.findUnique({ where: { id } });
      return pitch ? this.mapToEntity(pitch) : null;
    });
  }

  async findByIdWithDetails(id: string): Promise<PitchWithDetails | null> {
    return withRetry(async () => {
      const pitch = await prisma.pitch.findUnique({
        where: { id },
        include: {
          sections: { orderBy: { order: 'asc' } },
          needs: { orderBy: { priority: 'asc' } },
          pitchJobs: { orderBy: { step: 'asc' } },
        },
      });
      if (!pitch) return null;

      return {
        ...this.mapToEntity(pitch),
        sections: pitch.sections.map((s) => this.mapSectionToEntity(s)),
        needs: pitch.needs.map((n) => this.mapNeedToEntity(n)),
        jobs: pitch.pitchJobs.map((j) => this.mapJobToEntity(j)),
      };
    });
  }

  async findByUserId(options: PitchListOptions): Promise<{ pitches: PitchEntity[]; total: number }> {
    return withRetry(async () => {
      const { userId, status, page = 1, limit = 10, includeDeleted = false } = options;

      const where: any = { userId };
      if (status) where.status = status;
      if (!includeDeleted) where.deletedAt = null;

      const [pitches, total] = await Promise.all([
        prisma.pitch.findMany({
          where,
          orderBy: { uploadedAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.pitch.count({ where }),
      ]);

      return {
        pitches: pitches.map((p) => this.mapToEntity(p)),
        total,
      };
    });
  }

  async update(id: string, input: UpdatePitchInput): Promise<PitchEntity> {
    return withRetry(async () => {
      const pitch = await prisma.pitch.update({
        where: { id },
        data: input,
      });
      return this.mapToEntity(pitch);
    });
  }

  async softDelete(id: string): Promise<void> {
    await withRetry(async () => {
      await prisma.pitch.update({
        where: { id },
        data: { deletedAt: new Date() },
      });
    });
  }

  async hardDelete(id: string): Promise<void> {
    await withRetry(async () => {
      await prisma.pitch.delete({ where: { id } });
    });
  }

  async findExpiredPitches(beforeDate: Date): Promise<PitchEntity[]> {
    return withRetry(async () => {
      const pitches = await prisma.pitch.findMany({
        where: {
          expiresAt: { lte: beforeDate },
          deletedAt: null,
        },
      });
      return pitches.map((p) => this.mapToEntity(p));
    });
  }

  async deleteExpiredPitches(beforeDate: Date): Promise<number> {
    return withRetry(async () => {
      const result = await prisma.pitch.deleteMany({
        where: {
          expiresAt: { lte: beforeDate },
        },
      });
      return result.count;
    });
  }

  private mapToEntity(pitch: any): PitchEntity {
    return {
      id: pitch.id,
      userId: pitch.userId,
      fileKey: pitch.fileKey,
      fileName: pitch.fileName,
      fileType: pitch.fileType,
      fileSize: pitch.fileSize,
      language: pitch.language,
      status: pitch.status,
      title: pitch.title,
      companyName: pitch.companyName,
      rawText: pitch.rawText,
      uploadedAt: pitch.uploadedAt,
      processedAt: pitch.processedAt,
      expiresAt: pitch.expiresAt,
      lastError: pitch.lastError,
      deletedAt: pitch.deletedAt,
    };
  }

  private mapSectionToEntity(section: any): PitchSectionEntity {
    return {
      id: section.id,
      pitchId: section.pitchId,
      type: section.type as PitchSectionType,
      order: section.order,
      title: section.title,
      content: section.content,
      rawContent: section.rawContent,
      confidence: section.confidence,
      embedding: section.embedding as number[] | null,
      embeddingModel: section.embeddingModel,
      inferredSectors: section.inferredSectors as string[] | null,
      inferredSkills: section.inferredSkills as string[] | null,
      keywords: section.keywords as string[] | null,
      createdAt: section.createdAt,
    };
  }

  private mapNeedToEntity(need: any): PitchNeedEntity {
    return {
      id: need.id,
      pitchId: need.pitchId,
      key: need.key,
      label: need.label,
      description: need.description,
      confidence: need.confidence,
      sourceSectionType: need.sourceSectionType,
      amount: need.amount,
      timeline: need.timeline,
      priority: need.priority,
      createdAt: need.createdAt,
    };
  }

  private mapJobToEntity(job: any): PitchJobEntity {
    return {
      id: job.id,
      pitchId: job.pitchId,
      step: job.step as PitchJobStep,
      status: job.status as PitchJobStatus,
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

// ============================================================================
// Pitch Section Repository
// ============================================================================

export class PrismaPitchSectionRepository implements IPitchSectionRepository {
  async create(input: CreatePitchSectionInput): Promise<PitchSectionEntity> {
    return withRetry(async () => {
      const section = await prisma.pitchSection.create({
        data: {
          pitchId: input.pitchId,
          type: input.type,
          order: input.order,
          title: input.title,
          content: input.content,
          rawContent: input.rawContent || null,
          confidence: input.confidence || 0,
          embedding: input.embedding || null,
          embeddingModel: input.embeddingModel || null,
          inferredSectors: input.inferredSectors || null,
          inferredSkills: input.inferredSkills || null,
          keywords: input.keywords || null,
        },
      });
      return this.mapToEntity(section);
    });
  }

  async createMany(inputs: CreatePitchSectionInput[]): Promise<PitchSectionEntity[]> {
    return withRetry(async () => {
      // Prisma doesn't return created records on createMany, so we create one by one
      const sections = await Promise.all(
        inputs.map((input) =>
          prisma.pitchSection.create({
            data: {
              pitchId: input.pitchId,
              type: input.type,
              order: input.order,
              title: input.title,
              content: input.content,
              rawContent: input.rawContent || null,
              confidence: input.confidence || 0,
              embedding: input.embedding || null,
              embeddingModel: input.embeddingModel || null,
              inferredSectors: input.inferredSectors || null,
              inferredSkills: input.inferredSkills || null,
              keywords: input.keywords || null,
            },
          }),
        ),
      );
      return sections.map((s) => this.mapToEntity(s));
    });
  }

  async findByPitchId(pitchId: string): Promise<PitchSectionEntity[]> {
    return withRetry(async () => {
      const sections = await prisma.pitchSection.findMany({
        where: { pitchId },
        orderBy: { order: 'asc' },
      });
      return sections.map((s) => this.mapToEntity(s));
    });
  }

  async findById(id: string): Promise<PitchSectionEntity | null> {
    return withRetry(async () => {
      const section = await prisma.pitchSection.findUnique({ where: { id } });
      return section ? this.mapToEntity(section) : null;
    });
  }

  async updateEmbedding(id: string, embedding: number[], model: string): Promise<void> {
    await withRetry(async () => {
      await prisma.pitchSection.update({
        where: { id },
        data: { embedding, embeddingModel: model },
      });
    });
  }

  async deleteByPitchId(pitchId: string): Promise<void> {
    await withRetry(async () => {
      await prisma.pitchSection.deleteMany({ where: { pitchId } });
    });
  }

  private mapToEntity(section: any): PitchSectionEntity {
    return {
      id: section.id,
      pitchId: section.pitchId,
      type: section.type as PitchSectionType,
      order: section.order,
      title: section.title,
      content: section.content,
      rawContent: section.rawContent,
      confidence: section.confidence,
      embedding: section.embedding as number[] | null,
      embeddingModel: section.embeddingModel,
      inferredSectors: section.inferredSectors as string[] | null,
      inferredSkills: section.inferredSkills as string[] | null,
      keywords: section.keywords as string[] | null,
      createdAt: section.createdAt,
    };
  }
}

// ============================================================================
// Pitch Need Repository
// ============================================================================

export class PrismaPitchNeedRepository implements IPitchNeedRepository {
  async create(input: CreatePitchNeedInput): Promise<PitchNeedEntity> {
    return withRetry(async () => {
      const need = await prisma.pitchNeed.create({
        data: {
          pitchId: input.pitchId,
          key: input.key as any,
          label: input.label,
          description: input.description || null,
          confidence: input.confidence || 0,
          sourceSectionType: input.sourceSectionType || null,
          amount: input.amount || null,
          timeline: input.timeline || null,
          priority: input.priority || 1,
        },
      });
      return this.mapToEntity(need);
    });
  }

  async createMany(inputs: CreatePitchNeedInput[]): Promise<PitchNeedEntity[]> {
    return withRetry(async () => {
      const needs = await Promise.all(
        inputs.map((input) =>
          prisma.pitchNeed.create({
            data: {
              pitchId: input.pitchId,
              key: input.key as any,
              label: input.label,
              description: input.description || null,
              confidence: input.confidence || 0,
              sourceSectionType: input.sourceSectionType || null,
              amount: input.amount || null,
              timeline: input.timeline || null,
              priority: input.priority || 1,
            },
          }),
        ),
      );
      return needs.map((n) => this.mapToEntity(n));
    });
  }

  async findByPitchId(pitchId: string): Promise<PitchNeedEntity[]> {
    return withRetry(async () => {
      const needs = await prisma.pitchNeed.findMany({
        where: { pitchId },
        orderBy: { priority: 'asc' },
      });
      return needs.map((n) => this.mapToEntity(n));
    });
  }

  async deleteByPitchId(pitchId: string): Promise<void> {
    await withRetry(async () => {
      await prisma.pitchNeed.deleteMany({ where: { pitchId } });
    });
  }

  private mapToEntity(need: any): PitchNeedEntity {
    return {
      id: need.id,
      pitchId: need.pitchId,
      key: need.key,
      label: need.label,
      description: need.description,
      confidence: need.confidence,
      sourceSectionType: need.sourceSectionType,
      amount: need.amount,
      timeline: need.timeline,
      priority: need.priority,
      createdAt: need.createdAt,
    };
  }
}

// ============================================================================
// Pitch Match Repository
// ============================================================================

export class PrismaPitchMatchRepository implements IPitchMatchRepository {
  async create(input: CreatePitchMatchInput): Promise<PitchMatchEntity> {
    return withRetry(async () => {
      const match = await prisma.pitchMatch.create({
        data: {
          pitchSectionId: input.pitchSectionId,
          contactId: input.contactId,
          score: input.score,
          relevanceScore: input.relevanceScore,
          expertiseScore: input.expertiseScore,
          strategicScore: input.strategicScore,
          relationshipScore: input.relationshipScore,
          breakdownJson: input.breakdownJson as object,
          reasonsJson: input.reasonsJson as object[],
          angleCategory: input.angleCategory as any || null,
          outreachDraft: input.outreachDraft || null,
        },
      });
      return this.mapToEntity(match);
    });
  }

  async createMany(inputs: CreatePitchMatchInput[]): Promise<PitchMatchEntity[]> {
    return withRetry(async () => {
      const matches = await Promise.all(
        inputs.map((input) =>
          prisma.pitchMatch.create({
            data: {
              pitchSectionId: input.pitchSectionId,
              contactId: input.contactId,
              score: input.score,
              relevanceScore: input.relevanceScore,
              expertiseScore: input.expertiseScore,
              strategicScore: input.strategicScore,
              relationshipScore: input.relationshipScore,
              breakdownJson: input.breakdownJson as object,
              reasonsJson: input.reasonsJson as object[],
              angleCategory: input.angleCategory as any || null,
              outreachDraft: input.outreachDraft || null,
            },
          }),
        ),
      );
      return matches.map((m) => this.mapToEntity(m));
    });
  }

  async findById(id: string): Promise<PitchMatchEntity | null> {
    return withRetry(async () => {
      const match = await prisma.pitchMatch.findUnique({ where: { id } });
      return match ? this.mapToEntity(match) : null;
    });
  }

  async findByPitchSectionId(sectionId: string, options?: PitchMatchListOptions): Promise<PitchMatchEntity[]> {
    return withRetry(async () => {
      const where: any = { pitchSectionId: sectionId };
      if (options?.minScore) where.score = { gte: options.minScore };
      if (options?.status) {
        where.status = options.status;
      } else {
        where.status = { notIn: ['IGNORED', 'ARCHIVED'] };
      }

      const matches = await prisma.pitchMatch.findMany({
        where,
        orderBy: { score: 'desc' },
        take: options?.limit || 20,
      });
      return matches.map((m) => this.mapToEntity(m));
    });
  }

  async findByContactId(contactId: string): Promise<PitchMatchEntity[]> {
    return withRetry(async () => {
      const matches = await prisma.pitchMatch.findMany({
        where: { contactId },
        orderBy: { score: 'desc' },
      });
      return matches.map((m) => this.mapToEntity(m));
    });
  }

  async update(id: string, input: UpdatePitchMatchInput): Promise<PitchMatchEntity> {
    return withRetry(async () => {
      const match = await prisma.pitchMatch.update({
        where: { id },
        data: input,
      });
      return this.mapToEntity(match);
    });
  }

  async deleteBySectionId(sectionId: string): Promise<void> {
    await withRetry(async () => {
      await prisma.pitchMatch.deleteMany({ where: { pitchSectionId: sectionId } });
    });
  }

  async deleteByPitchId(pitchId: string): Promise<void> {
    await withRetry(async () => {
      const sections = await prisma.pitchSection.findMany({
        where: { pitchId },
        select: { id: true },
      });
      const sectionIds = sections.map((s) => s.id);
      if (sectionIds.length > 0) {
        await prisma.pitchMatch.deleteMany({
          where: { pitchSectionId: { in: sectionIds } },
        });
      }
    });
  }

  private mapToEntity(match: any): PitchMatchEntity {
    return {
      id: match.id,
      pitchSectionId: match.pitchSectionId,
      contactId: match.contactId,
      score: match.score,
      relevanceScore: match.relevanceScore,
      expertiseScore: match.expertiseScore,
      strategicScore: match.strategicScore,
      relationshipScore: match.relationshipScore,
      breakdownJson: match.breakdownJson as MatchBreakdown,
      reasonsJson: match.reasonsJson as MatchReason[],
      angleCategory: match.angleCategory,
      outreachDraft: match.outreachDraft,
      outreachEdited: match.outreachEdited,
      status: match.status as PitchMatchStatus,
      savedAt: match.savedAt,
      ignoredAt: match.ignoredAt,
      contactedAt: match.contactedAt,
      createdAt: match.createdAt,
      updatedAt: match.updatedAt,
    };
  }
}

// ============================================================================
// Pitch Job Repository
// ============================================================================

export class PrismaPitchJobRepository implements IPitchJobRepository {
  async create(input: CreatePitchJobInput): Promise<PitchJobEntity> {
    return withRetry(async () => {
      const job = await prisma.pitchJob.create({
        data: {
          pitchId: input.pitchId,
          step: input.step,
          maxAttempts: input.maxAttempts || 3,
        },
      });
      return this.mapToEntity(job);
    });
  }

  async createMany(inputs: CreatePitchJobInput[]): Promise<PitchJobEntity[]> {
    return withRetry(async () => {
      const jobs = await Promise.all(
        inputs.map((input) =>
          prisma.pitchJob.create({
            data: {
              pitchId: input.pitchId,
              step: input.step,
              maxAttempts: input.maxAttempts || 3,
            },
          }),
        ),
      );
      return jobs.map((j) => this.mapToEntity(j));
    });
  }

  async findByPitchId(pitchId: string): Promise<PitchJobEntity[]> {
    return withRetry(async () => {
      const jobs = await prisma.pitchJob.findMany({
        where: { pitchId },
        orderBy: { step: 'asc' },
      });
      return jobs.map((j) => this.mapToEntity(j));
    });
  }

  async findByPitchIdAndStep(pitchId: string, step: PitchJobStep): Promise<PitchJobEntity | null> {
    return withRetry(async () => {
      const job = await prisma.pitchJob.findUnique({
        where: { pitchId_step: { pitchId, step } },
      });
      return job ? this.mapToEntity(job) : null;
    });
  }

  async update(id: string, input: UpdatePitchJobInput): Promise<PitchJobEntity> {
    return withRetry(async () => {
      const job = await prisma.pitchJob.update({
        where: { id },
        data: input,
      });
      return this.mapToEntity(job);
    });
  }

  async updateByPitchIdAndStep(pitchId: string, step: PitchJobStep, input: UpdatePitchJobInput): Promise<PitchJobEntity> {
    return withRetry(async () => {
      const job = await prisma.pitchJob.update({
        where: { pitchId_step: { pitchId, step } },
        data: input,
      });
      return this.mapToEntity(job);
    });
  }

  async incrementAttempts(id: string): Promise<PitchJobEntity> {
    return withRetry(async () => {
      const job = await prisma.pitchJob.update({
        where: { id },
        data: { attempts: { increment: 1 } },
      });
      return this.mapToEntity(job);
    });
  }

  private mapToEntity(job: any): PitchJobEntity {
    return {
      id: job.id,
      pitchId: job.pitchId,
      step: job.step as PitchJobStep,
      status: job.status as PitchJobStatus,
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

// ============================================================================
// Contact Profile Cache Repository
// ============================================================================

export class PrismaContactProfileCacheRepository implements IContactProfileCacheRepository {
  async upsert(input: CreateContactProfileCacheInput): Promise<ContactProfileCacheEntity> {
    return withRetry(async () => {
      const cache = await prisma.contactProfileCache.upsert({
        where: { contactId: input.contactId },
        create: {
          contactId: input.contactId,
          userId: input.userId,
          profileSummary: input.profileSummary,
          sectors: input.sectors,
          skills: input.skills,
          interests: input.interests,
          keywords: input.keywords || null,
          investorType: input.investorType || null,
          investmentStage: input.investmentStage || null,
          checkSize: input.checkSize || null,
          geography: input.geography || null,
          previousInvestments: input.previousInvestments || null,
          expertise: input.expertise || null,
          embedding: input.embedding || null,
          embeddingModel: input.embeddingModel || null,
          relationshipStrength: input.relationshipStrength || 0,
          lastInteractionDays: input.lastInteractionDays || null,
          interactionCount: input.interactionCount || 0,
          isStale: false,
        },
        update: {
          profileSummary: input.profileSummary,
          sectors: input.sectors,
          skills: input.skills,
          interests: input.interests,
          keywords: input.keywords || null,
          investorType: input.investorType || null,
          investmentStage: input.investmentStage || null,
          checkSize: input.checkSize || null,
          geography: input.geography || null,
          previousInvestments: input.previousInvestments || null,
          expertise: input.expertise || null,
          embedding: input.embedding || null,
          embeddingModel: input.embeddingModel || null,
          relationshipStrength: input.relationshipStrength || 0,
          lastInteractionDays: input.lastInteractionDays || null,
          interactionCount: input.interactionCount || 0,
          isStale: false,
        },
      });
      return this.mapToEntity(cache);
    });
  }

  async findByContactId(contactId: string): Promise<ContactProfileCacheEntity | null> {
    return withRetry(async () => {
      const cache = await prisma.contactProfileCache.findUnique({ where: { contactId } });
      return cache ? this.mapToEntity(cache) : null;
    });
  }

  async findByUserId(userId: string): Promise<ContactProfileCacheEntity[]> {
    return withRetry(async () => {
      const caches = await prisma.contactProfileCache.findMany({
        where: { userId, isStale: false },
      });
      return caches.map((c) => this.mapToEntity(c));
    });
  }

  async findStaleByUserId(userId: string): Promise<ContactProfileCacheEntity[]> {
    return withRetry(async () => {
      const caches = await prisma.contactProfileCache.findMany({
        where: { userId, isStale: true },
      });
      return caches.map((c) => this.mapToEntity(c));
    });
  }

  async update(contactId: string, input: UpdateContactProfileCacheInput): Promise<ContactProfileCacheEntity> {
    return withRetry(async () => {
      const cache = await prisma.contactProfileCache.update({
        where: { contactId },
        data: input,
      });
      return this.mapToEntity(cache);
    });
  }

  async markStale(contactId: string): Promise<void> {
    await withRetry(async () => {
      await prisma.contactProfileCache.update({
        where: { contactId },
        data: { isStale: true },
      });
    });
  }

  async markAllStaleByUserId(userId: string): Promise<void> {
    await withRetry(async () => {
      await prisma.contactProfileCache.updateMany({
        where: { userId },
        data: { isStale: true },
      });
    });
  }

  async deleteByContactId(contactId: string): Promise<void> {
    await withRetry(async () => {
      await prisma.contactProfileCache.delete({ where: { contactId } });
    });
  }

  private mapToEntity(cache: any): ContactProfileCacheEntity {
    return {
      id: cache.id,
      contactId: cache.contactId,
      userId: cache.userId,
      profileSummary: cache.profileSummary,
      sectors: cache.sectors as string[],
      skills: cache.skills as string[],
      interests: cache.interests as string[],
      keywords: cache.keywords as string[] | null,
      investorType: cache.investorType,
      investmentStage: cache.investmentStage,
      checkSize: cache.checkSize,
      geography: cache.geography,
      previousInvestments: cache.previousInvestments as string[] | null,
      expertise: cache.expertise as string[] | null,
      embedding: cache.embedding as number[] | null,
      embeddingModel: cache.embeddingModel,
      relationshipStrength: cache.relationshipStrength,
      lastInteractionDays: cache.lastInteractionDays,
      interactionCount: cache.interactionCount,
      isStale: cache.isStale,
      builtAt: cache.builtAt,
      updatedAt: cache.updatedAt,
    };
  }
}

// ============================================================================
// User PNME Preferences Repository
// ============================================================================

export class PrismaUserPNMEPreferencesRepository implements IUserPNMEPreferencesRepository {
  async findByUserId(userId: string): Promise<UserPNMEPreferencesEntity | null> {
    return withRetry(async () => {
      const prefs = await prisma.userPNMEPreferences.findUnique({ where: { userId } });
      return prefs ? this.mapToEntity(prefs) : null;
    });
  }

  async upsert(input: CreateUserPNMEPreferencesInput): Promise<UserPNMEPreferencesEntity> {
    return withRetry(async () => {
      const prefs = await prisma.userPNMEPreferences.upsert({
        where: { userId: input.userId },
        create: {
          userId: input.userId,
          relevanceWeight: input.relevanceWeight ?? 0.40,
          expertiseWeight: input.expertiseWeight ?? 0.30,
          strategicWeight: input.strategicWeight ?? 0.20,
          relationshipWeight: input.relationshipWeight ?? 0.10,
          autoDeletePitchDays: input.autoDeletePitchDays ?? 30,
          enableWhatsAppMetadata: input.enableWhatsAppMetadata ?? false,
          defaultLanguage: input.defaultLanguage ?? 'en',
          minMatchScore: input.minMatchScore ?? 50,
          maxMatchesPerSection: input.maxMatchesPerSection ?? 10,
        },
        update: {
          relevanceWeight: input.relevanceWeight,
          expertiseWeight: input.expertiseWeight,
          strategicWeight: input.strategicWeight,
          relationshipWeight: input.relationshipWeight,
          autoDeletePitchDays: input.autoDeletePitchDays,
          enableWhatsAppMetadata: input.enableWhatsAppMetadata,
          defaultLanguage: input.defaultLanguage,
          minMatchScore: input.minMatchScore,
          maxMatchesPerSection: input.maxMatchesPerSection,
        },
      });
      return this.mapToEntity(prefs);
    });
  }

  async update(userId: string, input: UpdateUserPNMEPreferencesInput): Promise<UserPNMEPreferencesEntity> {
    return withRetry(async () => {
      const prefs = await prisma.userPNMEPreferences.update({
        where: { userId },
        data: input,
      });
      return this.mapToEntity(prefs);
    });
  }

  async recordConsent(userId: string, version: string): Promise<void> {
    await withRetry(async () => {
      await prisma.userPNMEPreferences.upsert({
        where: { userId },
        create: {
          userId,
          consentGivenAt: new Date(),
          consentVersion: version,
        },
        update: {
          consentGivenAt: new Date(),
          consentVersion: version,
        },
      });
    });
  }

  private mapToEntity(prefs: any): UserPNMEPreferencesEntity {
    return {
      id: prefs.id,
      userId: prefs.userId,
      relevanceWeight: prefs.relevanceWeight,
      expertiseWeight: prefs.expertiseWeight,
      strategicWeight: prefs.strategicWeight,
      relationshipWeight: prefs.relationshipWeight,
      autoDeletePitchDays: prefs.autoDeletePitchDays,
      enableWhatsAppMetadata: prefs.enableWhatsAppMetadata,
      defaultLanguage: prefs.defaultLanguage,
      minMatchScore: prefs.minMatchScore,
      maxMatchesPerSection: prefs.maxMatchesPerSection,
      consentGivenAt: prefs.consentGivenAt,
      consentVersion: prefs.consentVersion,
      createdAt: prefs.createdAt,
      updatedAt: prefs.updatedAt,
    };
  }
}
