/**
 * Prisma Collaboration Repository Implementation
 * Data access layer for collaborative matching operations
 * Updated for feature-based collaboration (no missions)
 */

import { PrismaClient, Prisma } from '@prisma/client';
import { prisma } from '../database/prisma/client';
import {
  ICollaborationRequestRepository,
  ICollaborationSessionRepository,
  ICollaborationMatchResultRepository,
  IIntroductionRepository,
  ICollaborationLedgerRepository,
  ICollaborationSettingsRepository,
  CollaborationRequestListOptions,
  CollaborationMatchResultListOptions,
  IntroductionListOptions,
} from '../../domain/repositories/ICollaborationRepository';
import {
  CollaborationRequestEntity,
  CollaborationSessionEntity,
  CollaborationMatchResultEntity,
  IntroductionEntity,
  CollaborationLedgerEntity,
  CollaborationSettingsEntity,
  CollaborationSourceType,
  CollaborationRequestStatus,
  CollaborationSessionStatus,
  IntroductionStatus,
  CollaborationCriteria,
  CollaborationMatchReason,
  PerTypeOverrides,
  CreateCollaborationRequestInput,
  UpdateCollaborationRequestInput,
  CreateCollaborationSessionInput,
  UpdateCollaborationSessionInput,
  CreateCollaborationMatchResultInput,
  UpdateCollaborationMatchResultInput,
  CreateIntroductionInput,
  UpdateIntroductionInput,
  CreateCollaborationLedgerInput,
  UpdateCollaborationLedgerInput,
  CreateCollaborationSettingsInput,
  UpdateCollaborationSettingsInput,
  CollaborationRequestWithDetails,
  CollaborationRequestForOwner,
  CollaborationRequestForCollaborator,
  CollaborationMatchResultWithContact,
  CollaborationLedgerSummary,
  SourceFeatureInfo,
  DEFAULT_ALLOWED_SOURCE_TYPES,
} from '../../domain/entities/Collaboration';

// ============================================================================
// Collaboration Request Repository
// ============================================================================

export class PrismaCollaborationRequestRepository implements ICollaborationRequestRepository {
  async create(input: CreateCollaborationRequestInput): Promise<CollaborationRequestEntity> {
    // Build polymorphic data based on source type
    const data: Prisma.CollaborationRequestCreateInput = {
      sourceType: input.sourceType,
      fromUser: { connect: { id: input.fromUserId } },
      message: input.message,
      voiceMessageUrl: input.voiceMessageUrl,
    };

    // Connect to either user or contact (one must be provided)
    if (input.toUserId) {
      data.toUser = { connect: { id: input.toUserId } };
    }
    if (input.toContactId) {
      data.toContact = { connect: { id: input.toContactId } };
    }

    // Set the appropriate source relation
    switch (input.sourceType) {
      case CollaborationSourceType.PROJECT:
        data.project = { connect: { id: input.sourceId } };
        break;
      case CollaborationSourceType.OPPORTUNITY:
        data.opportunity = { connect: { id: input.sourceId } };
        break;
      case CollaborationSourceType.PITCH:
        data.pitch = { connect: { id: input.sourceId } };
        break;
      case CollaborationSourceType.DEAL:
        data.deal = { connect: { id: input.sourceId } };
        break;
    }

    const request = await prisma.collaborationRequest.create({
      data,
    });

    return this.mapToEntity(request);
  }

  async findById(id: string): Promise<CollaborationRequestEntity | null> {
    const request = await prisma.collaborationRequest.findUnique({
      where: { id },
    });

    return request ? this.mapToEntity(request) : null;
  }

  async findByIdWithDetails(id: string): Promise<CollaborationRequestWithDetails | null> {
    const request = await prisma.collaborationRequest.findUnique({
      where: { id },
      include: {
        project: {
          include: {
            sectors: { include: { sector: true } },
            skillsNeeded: { include: { skill: true } },
          },
        },
        opportunity: {
          include: {
            sectorPrefs: { include: { sector: true } },
            skillPrefs: { include: { skill: true } },
          },
        },
        pitch: {
          include: {
            sections: true,
            needs: true,
          },
        },
        deal: true,
        fromUser: {
          select: { id: true, fullName: true, avatarUrl: true },
        },
        toUser: {
          select: { id: true, fullName: true, avatarUrl: true },
        },
        session: true,
        introductions: true,
      },
    });

    if (!request) return null;

    // Build source feature info based on type
    const sourceFeature = this.buildSourceFeatureInfo(request);

    return {
      ...this.mapToEntity(request),
      sourceFeature,
      fromUser: request.fromUser,
      toUser: request.toUser,
      session: request.session
        ? {
            id: request.session.id,
            collaborationRequestId: request.session.collaborationRequestId,
            collaboratorUserId: request.session.collaboratorUserId,
            contactsSource: request.session.contactsSource,
            totalContacts: request.session.totalContacts,
            matchCount: request.session.matchCount,
            progress: request.session.progress,
            status: request.session.status as CollaborationSessionStatus,
            bullJobId: request.session.bullJobId,
            error: request.session.error,
            startedAt: request.session.startedAt,
            lastScanAt: request.session.lastScanAt,
            completedAt: request.session.completedAt,
            createdAt: request.session.createdAt,
            updatedAt: request.session.updatedAt,
          }
        : null,
      completedIntroductionsCount: request.introductions.length,
    };
  }

  async update(
    id: string,
    input: UpdateCollaborationRequestInput
  ): Promise<CollaborationRequestEntity> {
    const request = await prisma.collaborationRequest.update({
      where: { id },
      data: input,
    });

    return this.mapToEntity(request);
  }

  async findSentByUserId(
    options: CollaborationRequestListOptions
  ): Promise<{ requests: CollaborationRequestForOwner[]; total: number }> {
    const { userId, status, sourceType, sourceId, page = 1, limit = 20 } = options;
    const skip = (page - 1) * limit;

    const where: Prisma.CollaborationRequestWhereInput = {
      fromUserId: userId,
      ...(status && { status }),
      ...(sourceType && { sourceType }),
    };

    // Add sourceId filter using sourceType→column mapping
    if (sourceId && sourceType) {
      const sourceColumnMap: Record<string, string> = {
        PROJECT: 'projectId',
        OPPORTUNITY: 'opportunityId',
        PITCH: 'pitchId',
        DEAL: 'dealId',
      };
      const column = sourceColumnMap[sourceType];
      if (column) {
        (where as any)[column] = sourceId;
      }
    }

    const [requests, total] = await Promise.all([
      prisma.collaborationRequest.findMany({
        where,
        include: {
          project: { select: { id: true, title: true } },
          opportunity: { select: { id: true, title: true } },
          pitch: { select: { id: true, title: true, companyName: true } },
          deal: { select: { id: true, title: true } },
          toUser: {
            select: { id: true, fullName: true, avatarUrl: true },
          },
          toContact: {
            select: { id: true, fullName: true, company: true, jobTitle: true, avatarUrl: true },
          },
          session: {
            select: { id: true, status: true, matchCount: true, progress: true },
          },
          introductions: true,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.collaborationRequest.count({ where }),
    ]);

    return {
      requests: requests.map((r) => {
        const introSummary = { total: 0, pending: 0, sent: 0, accepted: 0, completed: 0, declined: 0 };
        for (const intro of r.introductions) {
          introSummary.total++;
          const status = intro.status as string;
          if (status === 'PENDING') introSummary.pending++;
          else if (status === 'SENT') introSummary.sent++;
          else if (status === 'ACCEPTED') introSummary.accepted++;
          else if (status === 'COMPLETED') introSummary.completed++;
          else if (status === 'DECLINED') introSummary.declined++;
        }
        return {
          id: r.id,
          sourceType: r.sourceType as CollaborationSourceType,
          sourceId: this.getSourceIdFromRecord(r),
          sourceTitle: this.getSourceTitle(r) || 'Unknown',
          status: r.status as CollaborationRequestStatus,
          message: r.message,
          createdAt: r.createdAt,
          respondedAt: r.respondedAt,
          toUser: r.toUser,
          toContact: r.toContact || null,
          session: r.session ? {
            id: r.session.id,
            status: r.session.status,
            matchCount: r.session.matchCount,
            progress: r.session.progress,
          } : null,
          completedIntroductionsCount: introSummary.completed,
          introductionsSummary: introSummary,
        };
      }),
      total,
    };
  }

  /**
   * Get source ID from a request record
   */
  private getSourceIdFromRecord(request: any): string {
    return request.projectId || request.opportunityId || request.pitchId || request.dealId || '';
  }

  async findReceivedByUserId(
    options: CollaborationRequestListOptions
  ): Promise<{ requests: CollaborationRequestForCollaborator[]; total: number }> {
    const { userId, status, sourceType, page = 1, limit = 20 } = options;
    const skip = (page - 1) * limit;

    const where: Prisma.CollaborationRequestWhereInput = {
      toUserId: userId,
      ...(status && { status }),
      ...(sourceType && { sourceType }),
    };

    const [requests, total] = await Promise.all([
      prisma.collaborationRequest.findMany({
        where,
        include: {
          project: {
            include: {
              sectors: { include: { sector: true } },
              skillsNeeded: { include: { skill: true } },
            },
          },
          opportunity: {
            include: {
              sectorPrefs: { include: { sector: true } },
              skillPrefs: { include: { skill: true } },
            },
          },
          pitch: {
            include: {
              sections: true,
              needs: true,
            },
          },
          deal: true,
          fromUser: {
            select: { id: true, fullName: true, avatarUrl: true },
          },
          session: true,
          introductions: true,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.collaborationRequest.count({ where }),
    ]);

    // Get previous collaborations count for each sender
    const fromUserIds = [...new Set(requests.map((r) => r.fromUserId))];
    const previousCollabs = await prisma.collaborationLedger.groupBy({
      by: ['fromUserId'],
      where: {
        toUserId: userId,
        fromUserId: { in: fromUserIds },
      },
      _sum: { introductionsCount: true },
    });

    const prevCollabMap = new Map(
      previousCollabs.map((p) => [p.fromUserId, p._sum.introductionsCount || 0])
    );

    return {
      requests: requests.map((r) => ({
        ...this.mapToEntity(r),
        sourceFeature: this.buildSourceFeatureInfo(r),
        fromUser: r.fromUser,
        session: r.session
          ? {
              id: r.session.id,
              collaborationRequestId: r.session.collaborationRequestId,
              collaboratorUserId: r.session.collaboratorUserId,
              contactsSource: r.session.contactsSource,
              totalContacts: r.session.totalContacts,
              matchCount: r.session.matchCount,
              progress: r.session.progress,
              status: r.session.status as CollaborationSessionStatus,
              bullJobId: r.session.bullJobId,
              error: r.session.error,
              startedAt: r.session.startedAt,
              lastScanAt: r.session.lastScanAt,
              completedAt: r.session.completedAt,
              createdAt: r.session.createdAt,
              updatedAt: r.session.updatedAt,
            }
          : null,
        introductions: r.introductions.map((i) => ({
          id: i.id,
          collaborationRequestId: i.collaborationRequestId,
          collaboratorUserId: i.collaboratorUserId,
          thirdPartyContactRef: i.thirdPartyContactRef,
          status: i.status as IntroductionStatus,
          completedAt: i.completedAt,
          token: i.token,
          channel: i.channel,
          contactEmail: i.contactEmail,
          contactPhone: i.contactPhone,
          contactName: i.contactName,
          message: i.message,
          sentAt: i.sentAt,
          respondedAt: i.respondedAt,
          createdAt: i.createdAt,
          updatedAt: i.updatedAt,
        })),
        previousCollaborationsCount: prevCollabMap.get(r.fromUserId) || 0,
      })),
      total,
    };
  }

  async findBySourceAndToUserId(
    sourceType: CollaborationSourceType,
    sourceId: string,
    toUserId: string
  ): Promise<CollaborationRequestEntity | null> {
    let where: Prisma.CollaborationRequestWhereUniqueInput;

    switch (sourceType) {
      case CollaborationSourceType.PROJECT:
        where = { projectId_toUserId: { projectId: sourceId, toUserId } };
        break;
      case CollaborationSourceType.OPPORTUNITY:
        where = { opportunityId_toUserId: { opportunityId: sourceId, toUserId } };
        break;
      case CollaborationSourceType.PITCH:
        where = { pitchId_toUserId: { pitchId: sourceId, toUserId } };
        break;
      case CollaborationSourceType.DEAL:
        where = { dealId_toUserId: { dealId: sourceId, toUserId } };
        break;
      default:
        return null;
    }

    const request = await prisma.collaborationRequest.findUnique({
      where,
    });

    return request ? this.mapToEntity(request) : null;
  }

  async findBySourceId(
    sourceType: CollaborationSourceType,
    sourceId: string
  ): Promise<CollaborationRequestEntity[]> {
    let where: Prisma.CollaborationRequestWhereInput;

    switch (sourceType) {
      case CollaborationSourceType.PROJECT:
        where = { projectId: sourceId };
        break;
      case CollaborationSourceType.OPPORTUNITY:
        where = { opportunityId: sourceId };
        break;
      case CollaborationSourceType.PITCH:
        where = { pitchId: sourceId };
        break;
      case CollaborationSourceType.DEAL:
        where = { dealId: sourceId };
        break;
      default:
        return [];
    }

    const requests = await prisma.collaborationRequest.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    return requests.map((r) => this.mapToEntity(r));
  }

  async findPendingByToUserId(toUserId: string): Promise<CollaborationRequestForCollaborator[]> {
    const requests = await prisma.collaborationRequest.findMany({
      where: {
        toUserId,
        status: 'PENDING',
      },
      include: {
        project: {
          include: {
            sectors: { include: { sector: true } },
            skillsNeeded: { include: { skill: true } },
          },
        },
        opportunity: {
          include: {
            sectorPrefs: { include: { sector: true } },
            skillPrefs: { include: { skill: true } },
          },
        },
        pitch: {
          include: {
            sections: true,
            needs: true,
          },
        },
        deal: true,
        fromUser: {
          select: { id: true, fullName: true, avatarUrl: true },
        },
        session: true,
        introductions: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    const fromUserIds = [...new Set(requests.map((r) => r.fromUserId))];
    const previousCollabs = await prisma.collaborationLedger.groupBy({
      by: ['fromUserId'],
      where: {
        toUserId,
        fromUserId: { in: fromUserIds },
      },
      _sum: { introductionsCount: true },
    });

    const prevCollabMap = new Map(
      previousCollabs.map((p) => [p.fromUserId, p._sum.introductionsCount || 0])
    );

    return requests.map((r) => ({
      ...this.mapToEntity(r),
      sourceFeature: this.buildSourceFeatureInfo(r),
      fromUser: r.fromUser,
      session: r.session
        ? {
            id: r.session.id,
            collaborationRequestId: r.session.collaborationRequestId,
            collaboratorUserId: r.session.collaboratorUserId,
            contactsSource: r.session.contactsSource,
            totalContacts: r.session.totalContacts,
            matchCount: r.session.matchCount,
            progress: r.session.progress,
            status: r.session.status as CollaborationSessionStatus,
            bullJobId: r.session.bullJobId,
            error: r.session.error,
            startedAt: r.session.startedAt,
            lastScanAt: r.session.lastScanAt,
            completedAt: r.session.completedAt,
            createdAt: r.session.createdAt,
            updatedAt: r.session.updatedAt,
          }
        : null,
      introductions: r.introductions.map((i) => ({
        id: i.id,
        collaborationRequestId: i.collaborationRequestId,
        collaboratorUserId: i.collaboratorUserId,
        thirdPartyContactRef: i.thirdPartyContactRef,
        status: i.status as IntroductionStatus,
        completedAt: i.completedAt,
        token: i.token,
        channel: i.channel,
        contactEmail: i.contactEmail,
        contactPhone: i.contactPhone,
        contactName: i.contactName,
        message: i.message,
        sentAt: i.sentAt,
        respondedAt: i.respondedAt,
        createdAt: i.createdAt,
        updatedAt: i.updatedAt,
      })),
      previousCollaborationsCount: prevCollabMap.get(r.fromUserId) || 0,
    }));
  }

  async countBySourceId(sourceType: CollaborationSourceType, sourceId: string): Promise<number> {
    let where: Prisma.CollaborationRequestWhereInput;

    switch (sourceType) {
      case CollaborationSourceType.PROJECT:
        where = { projectId: sourceId };
        break;
      case CollaborationSourceType.OPPORTUNITY:
        where = { opportunityId: sourceId };
        break;
      case CollaborationSourceType.PITCH:
        where = { pitchId: sourceId };
        break;
      case CollaborationSourceType.DEAL:
        where = { dealId: sourceId };
        break;
      default:
        return 0;
    }

    return prisma.collaborationRequest.count({ where });
  }

  async countPendingByToUserId(toUserId: string): Promise<number> {
    return prisma.collaborationRequest.count({
      where: { toUserId, status: 'PENDING' },
    });
  }

  async countCompletedIntroductionsByRequestId(requestId: string): Promise<number> {
    return prisma.introduction.count({
      where: { collaborationRequestId: requestId, status: 'COMPLETED' },
    });
  }

  /**
   * Build source feature info from request with relations
   */
  private buildSourceFeatureInfo(request: any): SourceFeatureInfo {
    const sourceType = request.sourceType as CollaborationSourceType;

    switch (sourceType) {
      case CollaborationSourceType.PROJECT:
        if (request.project) {
          return {
            id: request.project.id,
            type: CollaborationSourceType.PROJECT,
            title: request.project.title,
            description: request.project.summary || null,
            criteria: {
              sectors: request.project.sectors?.map((ps: any) => ps.sector.name) || [],
              skills: request.project.skillsNeeded?.map((ps: any) => ps.skill.name) || [],
              keywords: (request.project.keywords as string[]) || [],
            },
            ownerUserId: request.project.userId,
          };
        }
        break;

      case CollaborationSourceType.OPPORTUNITY:
        if (request.opportunity) {
          return {
            id: request.opportunity.id,
            type: CollaborationSourceType.OPPORTUNITY,
            title: request.opportunity.title,
            description: request.opportunity.notes || null,
            criteria: {
              sectors: request.opportunity.sectorPrefs?.map((sp: any) => sp.sector.name) || [],
              skills: request.opportunity.skillPrefs?.map((sp: any) => sp.skill.name) || [],
              locations: request.opportunity.locationPref ? [request.opportunity.locationPref] : [],
            },
            ownerUserId: request.opportunity.userId,
          };
        }
        break;

      case CollaborationSourceType.PITCH:
        if (request.pitch) {
          const allSectors: string[] = [];
          const allSkills: string[] = [];
          const allKeywords: string[] = [];

          for (const section of request.pitch.sections || []) {
            if (section.inferredSectors) {
              allSectors.push(...(section.inferredSectors as string[]));
            }
            if (section.inferredSkills) {
              allSkills.push(...(section.inferredSkills as string[]));
            }
            if (section.keywords) {
              allKeywords.push(...(section.keywords as string[]));
            }
          }

          return {
            id: request.pitch.id,
            type: CollaborationSourceType.PITCH,
            title: request.pitch.title || request.pitch.companyName || 'Untitled Pitch',
            description: request.pitch.companyName || null,
            criteria: {
              sectors: [...new Set(allSectors)],
              skills: [...new Set(allSkills)],
              keywords: [...new Set(allKeywords)],
            },
            ownerUserId: request.pitch.userId,
          };
        }
        break;

      case CollaborationSourceType.DEAL:
        if (request.deal) {
          return {
            id: request.deal.id,
            type: CollaborationSourceType.DEAL,
            title: request.deal.title || `${request.deal.mode} Deal`,
            description: request.deal.problemStatement || request.deal.targetDescription || null,
            criteria: {
              sectors: request.deal.domain ? [request.deal.domain] : [],
              keywords: request.deal.solutionType ? [request.deal.solutionType] : [],
            },
            ownerUserId: request.deal.userId,
          };
        }
        break;
    }

    // Fallback for unknown source type - use fromUserId as owner
    return {
      id: request.projectId || request.opportunityId || request.pitchId || request.dealId || '',
      type: sourceType,
      title: 'Unknown',
      description: null,
      criteria: {},
      ownerUserId: request.fromUserId,
    };
  }

  /**
   * Get source title for list views
   */
  private getSourceTitle(request: any): string | null {
    if (request.project) return request.project.title;
    if (request.opportunity) return request.opportunity.title;
    if (request.pitch) return request.pitch.title || request.pitch.companyName;
    if (request.deal) return request.deal.title;
    return null;
  }

  private mapToEntity(request: any): CollaborationRequestEntity {
    return {
      id: request.id,
      sourceType: request.sourceType as CollaborationSourceType,
      projectId: request.projectId,
      opportunityId: request.opportunityId,
      pitchId: request.pitchId,
      dealId: request.dealId,
      fromUserId: request.fromUserId,
      toUserId: request.toUserId,
      toContactId: request.toContactId,
      message: request.message,
      voiceMessageUrl: request.voiceMessageUrl || null,
      status: request.status as CollaborationRequestStatus,
      respondedAt: request.respondedAt,
      createdAt: request.createdAt,
      updatedAt: request.updatedAt,
    };
  }

  /**
   * Find by source and toContactId
   */
  async findBySourceAndToContactId(
    sourceType: CollaborationSourceType,
    sourceId: string,
    toContactId: string
  ): Promise<CollaborationRequestEntity | null> {
    const whereClause: any = {
      sourceType,
      toContactId,
    };

    // Add source-specific ID
    switch (sourceType) {
      case CollaborationSourceType.PROJECT:
        whereClause.projectId = sourceId;
        break;
      case CollaborationSourceType.OPPORTUNITY:
        whereClause.opportunityId = sourceId;
        break;
      case CollaborationSourceType.PITCH:
        whereClause.pitchId = sourceId;
        break;
      case CollaborationSourceType.DEAL:
        whereClause.dealId = sourceId;
        break;
    }

    const request = await prisma.collaborationRequest.findFirst({
      where: whereClause,
    });

    return request ? this.mapToEntity(request) : null;
  }

  /**
   * Find pending requests by toContactId
   */
  async findPendingByToContactId(toContactId: string): Promise<CollaborationRequestForCollaborator[]> {
    const requests = await prisma.collaborationRequest.findMany({
      where: {
        toContactId,
        status: CollaborationRequestStatus.PENDING,
      },
      include: {
        fromUser: {
          select: { id: true, fullName: true, avatarUrl: true },
        },
        project: true,
        opportunity: true,
        pitch: true,
        deal: true,
        session: true,
        introductions: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return requests.map((request: any) => ({
      ...this.mapToEntity(request),
      sourceFeature: this.buildSourceFeatureInfo(request),
      fromUser: request.fromUser,
      session: request.session,
      introductions: request.introductions,
      previousCollaborationsCount: 0, // Would need a separate query to calculate
    }));
  }
}

// ============================================================================
// Collaboration Session Repository
// ============================================================================

export class PrismaCollaborationSessionRepository implements ICollaborationSessionRepository {
  async create(input: CreateCollaborationSessionInput): Promise<CollaborationSessionEntity> {
    const session = await prisma.collaborationSession.create({
      data: {
        collaborationRequestId: input.collaborationRequestId,
        collaboratorUserId: input.collaboratorUserId,
        contactsSource: input.contactsSource || 'internal_contacts',
      },
    });

    return this.mapToEntity(session);
  }

  async findById(id: string): Promise<CollaborationSessionEntity | null> {
    const session = await prisma.collaborationSession.findUnique({
      where: { id },
    });

    return session ? this.mapToEntity(session) : null;
  }

  async findByCollaborationRequestId(
    requestId: string
  ): Promise<CollaborationSessionEntity | null> {
    const session = await prisma.collaborationSession.findUnique({
      where: { collaborationRequestId: requestId },
    });

    return session ? this.mapToEntity(session) : null;
  }

  async update(id: string, input: UpdateCollaborationSessionInput): Promise<CollaborationSessionEntity> {
    const session = await prisma.collaborationSession.update({
      where: { id },
      data: input,
    });

    return this.mapToEntity(session);
  }

  async findByCollaboratorUserId(
    userId: string,
    status?: CollaborationSessionStatus
  ): Promise<CollaborationSessionEntity[]> {
    const sessions = await prisma.collaborationSession.findMany({
      where: {
        collaboratorUserId: userId,
        ...(status && { status }),
      },
      orderBy: { createdAt: 'desc' },
    });

    return sessions.map(this.mapToEntity);
  }

  async findPendingOrRunning(): Promise<CollaborationSessionEntity[]> {
    const sessions = await prisma.collaborationSession.findMany({
      where: {
        status: { in: ['PENDING', 'RUNNING'] },
      },
    });

    return sessions.map(this.mapToEntity);
  }

  private mapToEntity(session: any): CollaborationSessionEntity {
    return {
      id: session.id,
      collaborationRequestId: session.collaborationRequestId,
      collaboratorUserId: session.collaboratorUserId,
      contactsSource: session.contactsSource,
      totalContacts: session.totalContacts,
      matchCount: session.matchCount,
      progress: session.progress,
      status: session.status as CollaborationSessionStatus,
      bullJobId: session.bullJobId,
      error: session.error,
      startedAt: session.startedAt,
      lastScanAt: session.lastScanAt,
      completedAt: session.completedAt,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
    };
  }
}

// ============================================================================
// Collaboration Match Result Repository
// ============================================================================

export class PrismaCollaborationMatchResultRepository
  implements ICollaborationMatchResultRepository
{
  async create(input: CreateCollaborationMatchResultInput): Promise<CollaborationMatchResultEntity> {
    const result = await prisma.collaborationMatchResult.create({
      data: {
        sessionId: input.sessionId,
        contactId: input.contactId,
        score: input.score,
        reasonsJson: input.reasonsJson as unknown as Prisma.JsonArray,
      },
    });

    return this.mapToEntity(result);
  }

  async createMany(
    inputs: CreateCollaborationMatchResultInput[]
  ): Promise<CollaborationMatchResultEntity[]> {
    const results = await prisma.$transaction(
      inputs.map((input) =>
        prisma.collaborationMatchResult.create({
          data: {
            sessionId: input.sessionId,
            contactId: input.contactId,
            score: input.score,
            reasonsJson: input.reasonsJson as unknown as Prisma.JsonArray,
          },
        })
      )
    );

    return results.map(this.mapToEntity);
  }

  async findById(id: string): Promise<CollaborationMatchResultEntity | null> {
    const result = await prisma.collaborationMatchResult.findUnique({
      where: { id },
    });

    return result ? this.mapToEntity(result) : null;
  }

  async findByIdWithContact(id: string): Promise<CollaborationMatchResultWithContact | null> {
    const result = await prisma.collaborationMatchResult.findUnique({
      where: { id },
      include: {
        contact: {
          select: {
            id: true,
            fullName: true,
            company: true,
            jobTitle: true,
            avatarUrl: true,
            email: true,
            phone: true,
          },
        },
      },
    });

    if (!result) return null;

    return {
      ...this.mapToEntity(result),
      contact: result.contact,
    };
  }

  async findBySessionId(
    options: CollaborationMatchResultListOptions
  ): Promise<CollaborationMatchResultWithContact[]> {
    const { sessionId, minScore, isIntroduced, isDismissed, limit = 50, offset = 0 } = options;

    const results = await prisma.collaborationMatchResult.findMany({
      where: {
        sessionId,
        ...(minScore !== undefined && { score: { gte: minScore } }),
        ...(isIntroduced !== undefined && { isIntroduced }),
        ...(isDismissed !== undefined && { isDismissed }),
      },
      include: {
        contact: {
          select: {
            id: true,
            fullName: true,
            company: true,
            jobTitle: true,
            avatarUrl: true,
            email: true,
            phone: true,
          },
        },
      },
      orderBy: { score: 'desc' },
      skip: offset,
      take: limit,
    });

    return results.map((r) => ({
      ...this.mapToEntity(r),
      contact: r.contact,
    }));
  }

  async update(
    id: string,
    input: UpdateCollaborationMatchResultInput
  ): Promise<CollaborationMatchResultEntity> {
    const result = await prisma.collaborationMatchResult.update({
      where: { id },
      data: input,
    });

    return this.mapToEntity(result);
  }

  async deleteBySessionId(sessionId: string): Promise<void> {
    await prisma.collaborationMatchResult.deleteMany({
      where: { sessionId },
    });
  }

  async deleteNonIntroducedBySessionId(sessionId: string): Promise<number> {
    const result = await prisma.collaborationMatchResult.deleteMany({
      where: { sessionId, isIntroduced: false },
    });
    return result.count;
  }

  async countBySessionId(sessionId: string): Promise<number> {
    return prisma.collaborationMatchResult.count({
      where: { sessionId },
    });
  }

  async countIntroducedBySessionId(sessionId: string): Promise<number> {
    return prisma.collaborationMatchResult.count({
      where: { sessionId, isIntroduced: true },
    });
  }

  private mapToEntity(result: any): CollaborationMatchResultEntity {
    return {
      id: result.id,
      sessionId: result.sessionId,
      contactId: result.contactId,
      score: result.score,
      reasonsJson: result.reasonsJson as CollaborationMatchReason[],
      isIntroduced: result.isIntroduced,
      isDismissed: result.isDismissed,
      createdAt: result.createdAt,
      updatedAt: result.updatedAt,
    };
  }
}

// ============================================================================
// Introduction Repository
// ============================================================================

export class PrismaIntroductionRepository implements IIntroductionRepository {
  async create(input: CreateIntroductionInput): Promise<IntroductionEntity> {
    const introduction = await prisma.introduction.create({
      data: {
        collaborationRequestId: input.collaborationRequestId,
        collaboratorUserId: input.collaboratorUserId,
        thirdPartyContactRef: input.thirdPartyContactRef,
        token: input.token,
        channel: input.channel,
        contactEmail: input.contactEmail,
        contactPhone: input.contactPhone,
        contactName: input.contactName,
        message: input.message,
        status: input.status || 'PENDING',
        sentAt: input.sentAt,
      },
    });

    return this.mapToEntity(introduction);
  }

  async findById(id: string): Promise<IntroductionEntity | null> {
    const introduction = await prisma.introduction.findUnique({
      where: { id },
    });

    return introduction ? this.mapToEntity(introduction) : null;
  }

  async findByToken(token: string): Promise<IntroductionEntity | null> {
    const introduction = await prisma.introduction.findUnique({
      where: { token },
    });

    return introduction ? this.mapToEntity(introduction) : null;
  }

  async findByCollaborationRequestId(requestId: string): Promise<IntroductionEntity[]> {
    const introductions = await prisma.introduction.findMany({
      where: { collaborationRequestId: requestId },
      orderBy: { createdAt: 'desc' },
    });

    return introductions.map(this.mapToEntity);
  }

  async update(id: string, input: UpdateIntroductionInput): Promise<IntroductionEntity> {
    const introduction = await prisma.introduction.update({
      where: { id },
      data: input,
    });

    return this.mapToEntity(introduction);
  }

  async findByCollaboratorUserId(
    options: IntroductionListOptions
  ): Promise<{ introductions: IntroductionEntity[]; total: number }> {
    const { collaboratorUserId, status, page = 1, limit = 20 } = options;
    const skip = (page - 1) * limit;

    const where: Prisma.IntroductionWhereInput = {
      ...(collaboratorUserId && { collaboratorUserId }),
      ...(status && { status }),
    };

    const [introductions, total] = await Promise.all([
      prisma.introduction.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.introduction.count({ where }),
    ]);

    return {
      introductions: introductions.map(this.mapToEntity),
      total,
    };
  }

  async findByThirdPartyContactRef(contactRef: string): Promise<IntroductionEntity[]> {
    const introductions = await prisma.introduction.findMany({
      where: { thirdPartyContactRef: contactRef },
    });

    return introductions.map(this.mapToEntity);
  }

  async countByCollaborationRequestId(requestId: string): Promise<number> {
    return prisma.introduction.count({
      where: { collaborationRequestId: requestId },
    });
  }

  async countCompletedByCollaborationRequestId(requestId: string): Promise<number> {
    return prisma.introduction.count({
      where: { collaborationRequestId: requestId, status: 'COMPLETED' },
    });
  }

  private mapToEntity(introduction: any): IntroductionEntity {
    return {
      id: introduction.id,
      collaborationRequestId: introduction.collaborationRequestId,
      collaboratorUserId: introduction.collaboratorUserId,
      thirdPartyContactRef: introduction.thirdPartyContactRef,
      status: introduction.status as IntroductionStatus,
      completedAt: introduction.completedAt,
      token: introduction.token,
      channel: introduction.channel,
      contactEmail: introduction.contactEmail,
      contactPhone: introduction.contactPhone,
      contactName: introduction.contactName,
      message: introduction.message,
      sentAt: introduction.sentAt,
      respondedAt: introduction.respondedAt,
      createdAt: introduction.createdAt,
      updatedAt: introduction.updatedAt,
    };
  }
}

// ============================================================================
// Collaboration Ledger Repository
// ============================================================================

export class PrismaCollaborationLedgerRepository implements ICollaborationLedgerRepository {
  async create(input: CreateCollaborationLedgerInput): Promise<CollaborationLedgerEntity> {
    const ledger = await prisma.collaborationLedger.create({
      data: {
        fromUserId: input.fromUserId,
        toUserId: input.toUserId,
        sourceType: input.sourceType,
        sourceId: input.sourceId,
      },
    });

    return this.mapToEntity(ledger);
  }

  async findById(id: string): Promise<CollaborationLedgerEntity | null> {
    const ledger = await prisma.collaborationLedger.findUnique({
      where: { id },
    });

    return ledger ? this.mapToEntity(ledger) : null;
  }

  async findBySourceKey(
    fromUserId: string,
    toUserId: string,
    sourceType: CollaborationSourceType,
    sourceId: string
  ): Promise<CollaborationLedgerEntity | null> {
    const ledger = await prisma.collaborationLedger.findUnique({
      where: {
        fromUserId_toUserId_sourceType_sourceId: { fromUserId, toUserId, sourceType, sourceId },
      },
    });

    return ledger ? this.mapToEntity(ledger) : null;
  }

  async update(id: string, input: UpdateCollaborationLedgerInput): Promise<CollaborationLedgerEntity> {
    const ledger = await prisma.collaborationLedger.update({
      where: { id },
      data: input,
    });

    return this.mapToEntity(ledger);
  }

  async upsert(input: CreateCollaborationLedgerInput): Promise<CollaborationLedgerEntity> {
    const ledger = await prisma.collaborationLedger.upsert({
      where: {
        fromUserId_toUserId_sourceType_sourceId: {
          fromUserId: input.fromUserId,
          toUserId: input.toUserId,
          sourceType: input.sourceType,
          sourceId: input.sourceId,
        },
      },
      update: {},
      create: {
        fromUserId: input.fromUserId,
        toUserId: input.toUserId,
        sourceType: input.sourceType,
        sourceId: input.sourceId,
      },
    });

    return this.mapToEntity(ledger);
  }

  async incrementIntroductionsCount(
    fromUserId: string,
    toUserId: string,
    sourceType: CollaborationSourceType,
    sourceId: string
  ): Promise<CollaborationLedgerEntity> {
    const ledger = await prisma.collaborationLedger.upsert({
      where: {
        fromUserId_toUserId_sourceType_sourceId: { fromUserId, toUserId, sourceType, sourceId },
      },
      update: {
        introductionsCount: { increment: 1 },
        lastIntroductionAt: new Date(),
      },
      create: {
        fromUserId,
        toUserId,
        sourceType,
        sourceId,
        introductionsCount: 1,
        lastIntroductionAt: new Date(),
      },
    });

    return this.mapToEntity(ledger);
  }

  async getCollaboratorSummaries(userId: string): Promise<CollaborationLedgerSummary[]> {
    // Get all collaborators who have helped this user
    const ledgers = await prisma.collaborationLedger.findMany({
      where: { fromUserId: userId },
      include: {
        toUser: {
          select: { id: true, fullName: true, avatarUrl: true },
        },
      },
    });

    // Group by collaborator
    const summaryMap = new Map<string, CollaborationLedgerSummary>();

    for (const ledger of ledgers) {
      const existing = summaryMap.get(ledger.toUserId);
      if (existing) {
        existing.totalCollaborations += 1;
        existing.totalIntroductions += ledger.introductionsCount;
        if (
          ledger.lastIntroductionAt &&
          (!existing.lastCollaborationAt ||
            ledger.lastIntroductionAt > existing.lastCollaborationAt)
        ) {
          existing.lastCollaborationAt = ledger.lastIntroductionAt;
        }
      } else {
        summaryMap.set(ledger.toUserId, {
          userId: ledger.toUser.id,
          fullName: ledger.toUser.fullName,
          avatarUrl: ledger.toUser.avatarUrl,
          totalCollaborations: 1,
          totalIntroductions: ledger.introductionsCount,
          lastCollaborationAt: ledger.lastIntroductionAt,
        });
      }
    }

    return Array.from(summaryMap.values()).sort(
      (a, b) => b.totalIntroductions - a.totalIntroductions
    );
  }

  async getHistoryWithUser(userId: string, otherUserId: string): Promise<CollaborationLedgerEntity[]> {
    const ledgers = await prisma.collaborationLedger.findMany({
      where: {
        OR: [
          { fromUserId: userId, toUserId: otherUserId },
          { fromUserId: otherUserId, toUserId: userId },
        ],
      },
      orderBy: { createdAt: 'desc' },
    });

    return ledgers.map(this.mapToEntity);
  }

  async countTotalCollaborations(userId: string): Promise<number> {
    return prisma.collaborationLedger.count({
      where: { fromUserId: userId },
    });
  }

  async countTotalIntroductions(userId: string): Promise<number> {
    const result = await prisma.collaborationLedger.aggregate({
      where: { fromUserId: userId },
      _sum: { introductionsCount: true },
    });

    return result._sum.introductionsCount || 0;
  }

  private mapToEntity(ledger: any): CollaborationLedgerEntity {
    return {
      id: ledger.id,
      fromUserId: ledger.fromUserId,
      toUserId: ledger.toUserId,
      sourceType: ledger.sourceType as CollaborationSourceType,
      sourceId: ledger.sourceId,
      introductionsCount: ledger.introductionsCount,
      lastIntroductionAt: ledger.lastIntroductionAt,
      createdAt: ledger.createdAt,
      updatedAt: ledger.updatedAt,
    };
  }
}

// ============================================================================
// Collaboration Settings Repository
// ============================================================================

export class PrismaCollaborationSettingsRepository implements ICollaborationSettingsRepository {
  async create(input: CreateCollaborationSettingsInput): Promise<CollaborationSettingsEntity> {
    const settings = await prisma.collaborationSettings.create({
      data: {
        userId: input.userId,
        globalCollaborationEnabled: input.globalCollaborationEnabled ?? true,
        allowedSourceTypesJson:
          (input.allowedSourceTypesJson as unknown as Prisma.JsonArray) ||
          DEFAULT_ALLOWED_SOURCE_TYPES,
        blockedUserIdsJson: (input.blockedUserIdsJson as unknown as Prisma.JsonArray) || [],
        allowedUserIdsJson: input.allowedUserIdsJson as unknown as Prisma.JsonArray,
        perTypeOverridesJson: input.perTypeOverridesJson as unknown as Prisma.JsonObject,
      },
    });

    return this.mapToEntity(settings);
  }

  async findByUserId(userId: string): Promise<CollaborationSettingsEntity | null> {
    const settings = await prisma.collaborationSettings.findUnique({
      where: { userId },
    });

    return settings ? this.mapToEntity(settings) : null;
  }

  async update(
    userId: string,
    input: UpdateCollaborationSettingsInput
  ): Promise<CollaborationSettingsEntity> {
    const data: Prisma.CollaborationSettingsUpdateInput = {};
    if (input.globalCollaborationEnabled !== undefined)
      data.globalCollaborationEnabled = input.globalCollaborationEnabled;
    if (input.allowedSourceTypesJson !== undefined)
      data.allowedSourceTypesJson = input.allowedSourceTypesJson as unknown as Prisma.JsonArray;
    if (input.blockedUserIdsJson !== undefined)
      data.blockedUserIdsJson = input.blockedUserIdsJson as unknown as Prisma.JsonArray;
    if (input.allowedUserIdsJson !== undefined)
      data.allowedUserIdsJson = input.allowedUserIdsJson as unknown as Prisma.JsonArray;
    if (input.perTypeOverridesJson !== undefined)
      data.perTypeOverridesJson = input.perTypeOverridesJson as unknown as Prisma.JsonObject;

    const settings = await prisma.collaborationSettings.update({
      where: { userId },
      data,
    });

    return this.mapToEntity(settings);
  }

  async upsert(input: CreateCollaborationSettingsInput): Promise<CollaborationSettingsEntity> {
    const settings = await prisma.collaborationSettings.upsert({
      where: { userId: input.userId },
      update: {
        globalCollaborationEnabled: input.globalCollaborationEnabled ?? true,
        allowedSourceTypesJson:
          (input.allowedSourceTypesJson as unknown as Prisma.JsonArray) ||
          DEFAULT_ALLOWED_SOURCE_TYPES,
        blockedUserIdsJson: (input.blockedUserIdsJson as unknown as Prisma.JsonArray) || [],
        allowedUserIdsJson: input.allowedUserIdsJson as unknown as Prisma.JsonArray,
        perTypeOverridesJson: input.perTypeOverridesJson as unknown as Prisma.JsonObject,
      },
      create: {
        userId: input.userId,
        globalCollaborationEnabled: input.globalCollaborationEnabled ?? true,
        allowedSourceTypesJson:
          (input.allowedSourceTypesJson as unknown as Prisma.JsonArray) ||
          DEFAULT_ALLOWED_SOURCE_TYPES,
        blockedUserIdsJson: (input.blockedUserIdsJson as unknown as Prisma.JsonArray) || [],
        allowedUserIdsJson: input.allowedUserIdsJson as unknown as Prisma.JsonArray,
        perTypeOverridesJson: input.perTypeOverridesJson as unknown as Prisma.JsonObject,
      },
    });

    return this.mapToEntity(settings);
  }

  async canReceiveRequest(
    toUserId: string,
    fromUserId: string,
    sourceType: CollaborationSourceType
  ): Promise<{ allowed: boolean; reason?: string }> {
    const settings = await this.findByUserId(toUserId);

    // If no settings exist, allow by default
    if (!settings) {
      return { allowed: true };
    }

    // Check global enabled
    if (!settings.globalCollaborationEnabled) {
      return { allowed: false, reason: 'User has disabled collaboration requests' };
    }

    // Check blocked users
    if (settings.blockedUserIdsJson.includes(fromUserId)) {
      return { allowed: false, reason: 'You are blocked from sending requests to this user' };
    }

    // Check allowed users (if set, only those users can send)
    if (settings.allowedUserIdsJson && settings.allowedUserIdsJson.length > 0) {
      if (!settings.allowedUserIdsJson.includes(fromUserId)) {
        return { allowed: false, reason: 'User only accepts requests from specific users' };
      }
    }

    // Check allowed source types
    if (!settings.allowedSourceTypesJson.includes(sourceType)) {
      return {
        allowed: false,
        reason: `User does not accept ${sourceType.toLowerCase()} collaboration requests`,
      };
    }

    // Check per-type overrides
    if (settings.perTypeOverridesJson) {
      const typeOverride = settings.perTypeOverridesJson[sourceType];
      if (typeOverride) {
        if (!typeOverride.enabled) {
          return {
            allowed: false,
            reason: `User has disabled ${sourceType.toLowerCase()} collaboration requests`,
          };
        }
        if (typeOverride.blockedUserIds?.includes(fromUserId)) {
          return {
            allowed: false,
            reason: `You are blocked from sending ${sourceType.toLowerCase()} requests to this user`,
          };
        }
        if (
          typeOverride.allowedUserIds &&
          typeOverride.allowedUserIds.length > 0 &&
          !typeOverride.allowedUserIds.includes(fromUserId)
        ) {
          return {
            allowed: false,
            reason: `User only accepts ${sourceType.toLowerCase()} requests from specific users`,
          };
        }
      }
    }

    return { allowed: true };
  }

  private mapToEntity(settings: any): CollaborationSettingsEntity {
    return {
      id: settings.id,
      userId: settings.userId,
      globalCollaborationEnabled: settings.globalCollaborationEnabled,
      allowedSourceTypesJson: settings.allowedSourceTypesJson as CollaborationSourceType[],
      blockedUserIdsJson: settings.blockedUserIdsJson as string[],
      allowedUserIdsJson: settings.allowedUserIdsJson as string[] | null,
      perTypeOverridesJson: settings.perTypeOverridesJson as PerTypeOverrides | null,
      createdAt: settings.createdAt,
      updatedAt: settings.updatedAt,
    };
  }
}
