/**
 * Dashboard Service
 *
 * Aggregates statistics and provides dashboard data including:
 * - Weekly/monthly comparisons
 * - Activity timeline
 * - Network health score
 *
 * Includes Redis caching for improved performance.
 * Supports organization context scoping.
 *
 * @module infrastructure/services/DashboardService
 */

import { PrismaClient, InteractionType } from "@prisma/client";
import { cacheService, CACHE_TTL, CACHE_KEYS } from "../cache/index.js";
import { logger } from "../../shared/logger/index.js";

const prisma = new PrismaClient();

/**
 * Time period for comparison
 */
export type ComparisonPeriod = "week" | "month" | "custom";

/**
 * Stats with comparison to previous period
 */
export interface StatWithComparison {
  current: number;
  previous: number;
  change: number;
  changePercent: number;
}

/**
 * Dashboard stats summary
 */
export interface DashboardStats {
  contacts: StatWithComparison;
  matches: StatWithComparison;
  interactions: StatWithComparison;
  averageMatchScore: number;
  responseRate: number;
}

/**
 * Activity item for timeline
 */
export interface ActivityItem {
  id: string;
  type: InteractionType | "CONTACT_ADDED" | "MATCH_FOUND";
  title: string;
  description: string;
  contactId?: string;
  contactName?: string;
  metadata?: Record<string, unknown>;
  occurredAt: Date;
}

/**
 * Network health metrics
 */
export interface NetworkHealth {
  overallScore: number;
  diversity: {
    score: number;
    sectorCount: number;
    totalSectors: number;
  };
  engagement: {
    score: number;
    activeContactsPercent: number;
    recentInteractionsCount: number;
  };
  growth: {
    score: number;
    weeklyGrowthRate: number;
    monthlyGrowthRate: number;
  };
  quality: {
    score: number;
    highMatchPercent: number;
    enrichedPercent: number;
  };
}

/**
 * Weekly goals progress
 */
export interface GoalsProgress {
  weeklyConnections: { current: number; target: number };
  followUpsCompleted: { current: number; target: number };
  meetingsScheduled: { current: number; target: number };
}

/**
 * Chart data point
 */
export interface ChartDataPoint {
  date: string;
  label: string;
  value: number;
}

/**
 * Dashboard chart data
 */
export interface DashboardCharts {
  contactsOverTime: ChartDataPoint[];
  matchesOverTime: ChartDataPoint[];
  interactionsOverTime: ChartDataPoint[];
  interactionsByType: Array<{ type: string; count: number }>;
  contactsBySector: Array<{
    sector: string;
    count: number;
    nameAr?: string | null;
  }>;
  matchScoreDistribution: Array<{ range: string; count: number }>;
}

export class DashboardService {
  /**
   * Build contact where filter based on org context
   */
  private buildContactWhere(userId: string, orgId: string | null): any {
    return orgId
      ? { organizationId: orgId }
      : { ownerId: userId, organizationId: null };
  }

  /**
   * Build interaction where filter based on org context.
   * In org mode, filter interactions by contacts belonging to the organization.
   */
  private buildInteractionWhere(userId: string, orgId: string | null): any {
    return orgId ? { contact: { organizationId: orgId } } : { userId };
  }

  /**
   * Build match result where filter based on org context
   */
  private buildMatchWhere(userId: string, orgId: string | null): any {
    return orgId
      ? { user: { organizationMembers: { some: { organizationId: orgId } } } }
      : { userId };
  }

  /**
   * Get dashboard stats with comparison to previous period (with caching)
   */
  async getStats(
    userId: string,
    period: ComparisonPeriod = "week",
    orgId: string | null = null,
    customFrom?: Date,
    customTo?: Date,
  ): Promise<DashboardStats> {
    const scopeKey = orgId || userId;
    const cacheKeySuffix =
      period === "custom" && customFrom && customTo
        ? `custom:${customFrom.toISOString().split("T")[0]}:${customTo.toISOString().split("T")[0]}`
        : period;
    const cacheKey =
      CACHE_KEYS.DASHBOARD_STATS + scopeKey + ":" + cacheKeySuffix;

    // Try to get from cache
    // if (cacheService.isAvailable()) {
    //   const cached = await cacheService.get<DashboardStats>(cacheKey);
    //   if (cached) {
    //     logger.debug("Dashboard stats served from cache", {
    //       userId,
    //       period,
    //       orgId,
    //     });
    //     return cached;
    //   }
    // }

    const now = new Date();
    let currentStart: Date;
    let currentEnd: Date;
    let previousStart: Date;
    let previousEnd: Date;

    if (period === "custom" && customFrom && customTo) {
      // Custom date range
      currentStart = new Date(customFrom);
      currentStart.setHours(0, 0, 0, 0);
      currentEnd = new Date(customTo);
      currentEnd.setHours(23, 59, 59, 999);

      // Previous period = same duration before the custom range
      const durationMs = currentEnd.getTime() - currentStart.getTime();
      previousEnd = new Date(currentStart);
      previousStart = new Date(currentStart.getTime() - durationMs);
    } else {
      const periodDays = period === "week" ? 7 : 30;
      currentStart = new Date(now);
      currentStart.setDate(currentStart.getDate() - periodDays);
      currentEnd = now;
      previousStart = new Date(currentStart);
      previousStart.setDate(previousStart.getDate() - periodDays);
      previousEnd = new Date(currentStart);
    }

    const contactWhere = this.buildContactWhere(userId, orgId);
    const interactionWhere = this.buildInteractionWhere(userId, orgId);

    // Get contacts stats
    const [currentContacts, previousContacts, totalContacts] =
      await Promise.all([
        prisma.contact.count({
          where: {
            ...contactWhere,
            createdAt: { gte: currentStart, lte: currentEnd },
          },
        }),
        prisma.contact.count({
          where: {
            ...contactWhere,
            createdAt: { gte: previousStart, lt: previousEnd },
          },
        }),
        prisma.contact.count({
          where: contactWhere,
        }),
      ]);

    // Get matches stats - for org mode, count matches for contacts in the org
    let currentMatches: number;
    let previousMatches: number;
    let totalMatchesAbove50: number;
    let avgMatchScoreVal: number;

    if (orgId) {
      // In org mode, count match results where the contact belongs to the org
      [currentMatches, previousMatches, totalMatchesAbove50] =
        await Promise.all([
          prisma.matchResult.count({
            where: {
              createdAt: { gte: currentStart, lte: currentEnd },
              finalScore: { gte: 50 },
              contact: { organizationId: orgId },
            },
          }),
          prisma.matchResult.count({
            where: {
              createdAt: { gte: previousStart, lt: previousEnd },
              finalScore: { gte: 50 },
              contact: { organizationId: orgId },
            },
          }),
          prisma.matchResult.count({
            where: {
              finalScore: { gte: 50 },
              contact: { organizationId: orgId },
            },
          }),
        ]);

      const avgResult = await prisma.matchResult.aggregate({
        where: { contact: { organizationId: orgId } },
        _avg: { finalScore: true },
      });
      avgMatchScoreVal = Number(avgResult._avg.finalScore) || 0;
    } else {
      [currentMatches, previousMatches, totalMatchesAbove50] =
        await Promise.all([
          prisma.matchResult.count({
            where: {
              userId,
              createdAt: { gte: currentStart, lte: currentEnd },
              finalScore: { gte: 50 },
            },
          }),
          prisma.matchResult.count({
            where: {
              userId,
              createdAt: { gte: previousStart, lt: previousEnd },
              finalScore: { gte: 50 },
            },
          }),
          prisma.matchResult.count({
            where: { userId, finalScore: { gte: 50 } },
          }),
        ]);

      const avgResult = await prisma.matchResult.aggregate({
        where: { userId },
        _avg: { finalScore: true },
      });
      avgMatchScoreVal = Number(avgResult._avg.finalScore) || 0;
    }

    // Get interactions stats
    const [currentInteractions, previousInteractions, totalInteractions] =
      await Promise.all([
        prisma.interaction.count({
          where: {
            ...interactionWhere,
            createdAt: { gte: currentStart, lte: currentEnd },
          },
        }),
        prisma.interaction.count({
          where: {
            ...interactionWhere,
            createdAt: { gte: previousStart, lt: previousEnd },
          },
        }),
        prisma.interaction.count({
          where: interactionWhere,
        }),
      ]);

    // Calculate response rate (interactions / contacts viewed)
    const viewedCount = await prisma.interaction.count({
      where: { ...interactionWhere, interactionType: "VIEWED" },
    });
    const responseInteractions = await prisma.interaction.count({
      where: {
        ...interactionWhere,
        interactionType: { in: ["MESSAGE", "EMAILED", "CALLED", "MEETING"] },
      },
    });
    const responseRate =
      viewedCount > 0
        ? Math.round((responseInteractions / viewedCount) * 100)
        : 0;

    const useFiltered = period === "custom";
    const stats: DashboardStats = {
      contacts: this.calculateComparison(
        useFiltered ? currentContacts : totalContacts,
        currentContacts,
        previousContacts,
      ),
      matches: this.calculateComparison(
        useFiltered ? currentMatches : totalMatchesAbove50,
        currentMatches,
        previousMatches,
      ),
      interactions: this.calculateComparison(
        useFiltered ? currentInteractions : totalInteractions,
        currentInteractions,
        previousInteractions,
      ),
      averageMatchScore: avgMatchScoreVal,
      responseRate,
    };

    // Cache the result
    cacheService.set(cacheKey, stats, CACHE_TTL.DASHBOARD).catch(() => {
      // Ignore cache errors
    });

    logger.debug("Dashboard stats fetched from database", {
      userId,
      period,
      orgId,
    });
    return stats;
  }

  /**
   * Calculate comparison stats
   */
  private calculateComparison(
    total: number,
    current: number,
    previous: number,
  ): StatWithComparison {
    const change = current - previous;
    const rawPercent =
      previous > 0
        ? Math.round((change / previous) * 100)
        : current > 0
          ? 100
          : 0;
    const changePercent = Math.max(-999, Math.min(999, rawPercent));

    return {
      current: total,
      previous,
      change,
      changePercent,
    };
  }

  /**
   * Get activity timeline
   */
  async getActivityTimeline(
    userId: string,
    limit: number = 20,
    offset: number = 0,
    orgId: string | null = null,
  ): Promise<ActivityItem[]> {
    const interactionWhere = this.buildInteractionWhere(userId, orgId);
    const contactWhere = this.buildContactWhere(userId, orgId);

    // Get recent interactions with contact info
    const interactions = await prisma.interaction.findMany({
      where: interactionWhere,
      include: {
        contact: {
          select: { id: true, fullName: true, company: true },
        },
      },
      orderBy: { occurredAt: "desc" },
      take: limit,
      skip: offset,
    });

    // Get recent contacts added
    const recentContacts = await prisma.contact.findMany({
      where: contactWhere,
      orderBy: { createdAt: "desc" },
      take: Math.ceil(limit / 3),
      select: { id: true, fullName: true, company: true, createdAt: true },
    });

    // Combine and sort activities
    const activities: ActivityItem[] = [
      ...interactions.map((int) => ({
        id: int.id,
        type: int.interactionType as InteractionType,
        title: this.getInteractionTitle(int.interactionType),
        description: `${int.contact.fullName}${int.contact.company ? ` at ${int.contact.company}` : ""}`,
        contactId: int.contactId,
        contactName: int.contact.fullName,
        metadata: int.metadata as Record<string, unknown> | undefined,
        occurredAt: int.occurredAt,
      })),
      ...recentContacts.map((contact) => ({
        id: `contact-${contact.id}`,
        type: "CONTACT_ADDED" as const,
        title: "Added new contact",
        description: `${contact.fullName}${contact.company ? ` at ${contact.company}` : ""}`,
        contactId: contact.id,
        contactName: contact.fullName,
        occurredAt: contact.createdAt,
      })),
    ];

    // Sort by date and apply limit
    return activities
      .sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime())
      .slice(0, limit);
  }

  /**
   * Get interaction title based on type
   */
  private getInteractionTitle(type: InteractionType): string {
    const titles: Record<InteractionType, string> = {
      SCANNED: "Scanned business card",
      SAVED: "Saved contact",
      VIEWED: "Viewed contact",
      NOTED: "Added notes",
      MEETING: "Had a meeting",
      MESSAGE: "Sent message",
      FOLLOW_UP: "Completed follow-up",
      INTRODUCED: "Made introduction",
      CALLED: "Made a call",
      EMAILED: "Sent email",
    };
    return titles[type] || type;
  }

  /**
   * Calculate network health score (with caching)
   */
  async getNetworkHealth(
    userId: string,
    orgId: string | null = null,
  ): Promise<NetworkHealth> {
    const scopeKey = orgId || userId;
    const cacheKey = CACHE_KEYS.DASHBOARD_HEALTH + scopeKey;

    // Try to get from cache
    if (cacheService.isAvailable()) {
      const cached = await cacheService.get<NetworkHealth>(cacheKey);
      if (cached) {
        logger.debug("Network health served from cache", { userId, orgId });
        return cached;
      }
    }

    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const twoMonthsAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

    const contactWhere = this.buildContactWhere(userId, orgId);

    // Get all contacts in scope
    const contacts = await prisma.contact.findMany({
      where: contactWhere,
      include: {
        contactSectors: true,
        interactions: {
          where: { occurredAt: { gte: monthAgo } },
        },
      },
    });

    const totalContacts = contacts.length;

    // Diversity: Count unique sectors
    const uniqueSectorIds = new Set<string>();
    contacts.forEach((c) =>
      c.contactSectors.forEach((cs) => uniqueSectorIds.add(cs.sectorId)),
    );
    const totalAvailableSectors = await prisma.sector.count({
      where: { isActive: true },
    });
    const diversityScore =
      totalAvailableSectors > 0
        ? Math.min(
            100,
            Math.round(
              (uniqueSectorIds.size / Math.min(totalAvailableSectors, 10)) *
                100,
            ),
          )
        : 0;

    // Engagement: Active contacts (interacted with in last 30 days)
    const activeContacts = contacts.filter(
      (c) => c.interactions.length > 0,
    ).length;
    const activeContactsPercent =
      totalContacts > 0
        ? Math.round((activeContacts / totalContacts) * 100)
        : 0;
    const recentInteractionsCount = contacts.reduce(
      (sum, c) => sum + c.interactions.length,
      0,
    );
    const engagementScore = Math.min(
      100,
      Math.round(
        activeContactsPercent * 0.6 +
          Math.min(recentInteractionsCount, 50) * 0.8,
      ),
    );

    // Growth: Compare contacts added this month vs last month
    const contactsThisMonth = await prisma.contact.count({
      where: { ...contactWhere, createdAt: { gte: monthAgo } },
    });
    const contactsLastMonth = await prisma.contact.count({
      where: {
        ...contactWhere,
        createdAt: { gte: twoMonthsAgo, lt: monthAgo },
      },
    });
    const contactsThisWeek = await prisma.contact.count({
      where: { ...contactWhere, createdAt: { gte: weekAgo } },
    });
    const contactsLastWeek = await prisma.contact.count({
      where: {
        ...contactWhere,
        createdAt: {
          gte: new Date(weekAgo.getTime() - 7 * 24 * 60 * 60 * 1000),
          lt: weekAgo,
        },
      },
    });

    const weeklyGrowthRate =
      contactsLastWeek > 0
        ? Math.round(
            ((contactsThisWeek - contactsLastWeek) / contactsLastWeek) * 100,
          )
        : contactsThisWeek > 0
          ? 100
          : 0;
    const monthlyGrowthRate =
      contactsLastMonth > 0
        ? Math.round(
            ((contactsThisMonth - contactsLastMonth) / contactsLastMonth) * 100,
          )
        : contactsThisMonth > 0
          ? 100
          : 0;
    const growthScore = Math.min(
      100,
      Math.max(0, 50 + weeklyGrowthRate + Math.round(monthlyGrowthRate / 2)),
    );

    // Quality: High matches and enriched contacts
    let highMatches: number;
    let totalMatches: number;

    if (orgId) {
      highMatches = await prisma.matchResult.count({
        where: { finalScore: { gte: 70 }, contact: { organizationId: orgId } },
      });
      totalMatches = await prisma.matchResult.count({
        where: { contact: { organizationId: orgId } },
      });
    } else {
      highMatches = await prisma.matchResult.count({
        where: { userId, finalScore: { gte: 70 } },
      });
      totalMatches = await prisma.matchResult.count({ where: { userId } });
    }

    const highMatchPercent =
      totalMatches > 0 ? Math.round((highMatches / totalMatches) * 100) : 0;

    const enrichedContacts = contacts.filter((c) => c.isEnriched).length;
    const enrichedPercent =
      totalContacts > 0
        ? Math.round((enrichedContacts / totalContacts) * 100)
        : 0;
    const qualityScore = Math.round(
      highMatchPercent * 0.6 + enrichedPercent * 0.4,
    );

    // Overall score: weighted average
    const overallScore = Math.round(
      diversityScore * 0.25 +
        engagementScore * 0.3 +
        growthScore * 0.25 +
        qualityScore * 0.2,
    );

    const health: NetworkHealth = {
      overallScore,
      diversity: {
        score: diversityScore,
        sectorCount: uniqueSectorIds.size,
        totalSectors: totalAvailableSectors,
      },
      engagement: {
        score: engagementScore,
        activeContactsPercent,
        recentInteractionsCount,
      },
      growth: {
        score: growthScore,
        weeklyGrowthRate,
        monthlyGrowthRate,
      },
      quality: {
        score: qualityScore,
        highMatchPercent,
        enrichedPercent,
      },
    };

    // Cache the result
    cacheService.set(cacheKey, health, CACHE_TTL.DASHBOARD).catch(() => {
      // Ignore cache errors
    });

    logger.debug("Network health fetched from database", { userId, orgId });
    return health;
  }

  /**
   * Get weekly goals progress
   */
  async getGoalsProgress(
    userId: string,
    orgId: string | null = null,
  ): Promise<GoalsProgress> {
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay()); // Sunday
    startOfWeek.setHours(0, 0, 0, 0);

    const contactWhere = this.buildContactWhere(userId, orgId);
    const interactionWhere = this.buildInteractionWhere(userId, orgId);

    // Contacts added this week
    const weeklyConnections = await prisma.contact.count({
      where: { ...contactWhere, createdAt: { gte: startOfWeek } },
    });

    // Follow-ups completed this week
    const followUpsCompleted = await prisma.interaction.count({
      where: {
        ...interactionWhere,
        interactionType: "FOLLOW_UP",
        createdAt: { gte: startOfWeek },
      },
    });

    // Meetings scheduled this week
    const meetingsScheduled = await prisma.interaction.count({
      where: {
        ...interactionWhere,
        interactionType: "MEETING",
        createdAt: { gte: startOfWeek },
      },
    });

    return {
      weeklyConnections: { current: weeklyConnections, target: 25 },
      followUpsCompleted: { current: followUpsCompleted, target: 15 },
      meetingsScheduled: { current: meetingsScheduled, target: 8 },
    };
  }

  /**
   * Get chart data for dashboard visualizations
   */
  async getChartData(
    userId: string,
    days: number = 30,
    orgId: string | null = null,
  ): Promise<DashboardCharts> {
    const now = new Date();
    const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

    const contactWhere = this.buildContactWhere(userId, orgId);
    const interactionWhere = this.buildInteractionWhere(userId, orgId);

    // Generate date range
    const dateLabels: Date[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);
      dateLabels.push(date);
    }

    // Get contacts over time
    const contacts = await prisma.contact.findMany({
      where: { ...contactWhere, createdAt: { gte: startDate } },
      select: { createdAt: true },
    });

    const contactsOverTime = this.groupByDate(
      contacts,
      dateLabels,
      "createdAt",
    );

    // Get matches over time from real match tables (ProjectMatch, PitchMatch, DealMatchResult, OpportunityMatch)
    const userProjectIds = (
      await prisma.project.findMany({
        where: orgId ? { organizationId: orgId } : { userId },
        select: { id: true },
      })
    ).map((p) => p.id);
    const userPitchSectionIds = (
      await prisma.pitchSection.findMany({
        where: { pitch: orgId ? { organizationId: orgId } : { userId } },
        select: { id: true },
      })
    ).map((s) => s.id);
    const userDealIds = (
      await prisma.dealRequest.findMany({
        where: orgId ? { organizationId: orgId } : { userId },
        select: { id: true },
      })
    ).map((d) => d.id);
    const userIntentIds = (
      await prisma.opportunityIntent.findMany({
        where: orgId ? { organizationId: orgId } : { userId },
        select: { id: true },
      })
    ).map((i) => i.id);

    const [projectMatches, pitchMatches, dealMatches, oppMatches] =
      await Promise.all([
        userProjectIds.length > 0
          ? prisma.projectMatch.findMany({
              where: {
                projectId: { in: userProjectIds },
                createdAt: { gte: startDate },
                matchedContactId: { not: null },
              },
              select: { createdAt: true, matchScore: true },
            })
          : Promise.resolve([]),
        userPitchSectionIds.length > 0
          ? prisma.pitchMatch.findMany({
              where: {
                pitchSectionId: { in: userPitchSectionIds },
                createdAt: { gte: startDate },
              },
              select: { createdAt: true, score: true },
            })
          : Promise.resolve([]),
        userDealIds.length > 0
          ? prisma.dealMatchResult.findMany({
              where: {
                dealRequestId: { in: userDealIds },
                createdAt: { gte: startDate },
              },
              select: { createdAt: true, score: true },
            })
          : Promise.resolve([]),
        userIntentIds.length > 0
          ? prisma.opportunityMatch.findMany({
              where: {
                intentId: { in: userIntentIds },
                createdAt: { gte: startDate },
                matchedContactId: { not: null },
              },
              select: { createdAt: true, matchScore: true },
            })
          : Promise.resolve([]),
      ]);

    const allMatchDates = [
      ...projectMatches.map((m) => ({ createdAt: m.createdAt })),
      ...pitchMatches.map((m) => ({ createdAt: m.createdAt })),
      ...dealMatches.map((m) => ({ createdAt: m.createdAt })),
      ...oppMatches.map((m) => ({ createdAt: m.createdAt })),
    ];

    const matchesOverTime = this.groupByDate(
      allMatchDates,
      dateLabels,
      "createdAt",
    );

    // Get interactions over time
    const interactions = await prisma.interaction.findMany({
      where: { ...interactionWhere, occurredAt: { gte: startDate } },
      select: { occurredAt: true, interactionType: true },
    });

    const interactionsOverTime = this.groupByDate(
      interactions,
      dateLabels,
      "occurredAt",
    );

    // Interactions by type
    const interactionsByType = await prisma.interaction.groupBy({
      by: ["interactionType"],
      where: interactionWhere,
      _count: true,
    });

    // Contacts by sector
    const contactSectors = await prisma.contactSector.findMany({
      where: { contact: contactWhere },
      include: { sector: { select: { name: true, nameAr: true } } },
    });

    const sectorCounts: Record<
      string,
      { count: number; nameAr: string | null }
    > = {};
    contactSectors.forEach((cs) => {
      if (!sectorCounts[cs.sector.name]) {
        sectorCounts[cs.sector.name] = { count: 0, nameAr: cs.sector.nameAr };
      }
      // Prefer non-null nameAr from any duplicate sector
      if (!sectorCounts[cs.sector.name].nameAr && cs.sector.nameAr) {
        sectorCounts[cs.sector.name].nameAr = cs.sector.nameAr;
      }
      sectorCounts[cs.sector.name].count += 1;
    });

    const contactsBySector = Object.entries(sectorCounts)
      .map(([sector, { count, nameAr }]) => ({
        sector,
        count,
        nameAr: nameAr || null,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Match score distribution from real match tables
    const allScores = [
      ...projectMatches.map((m) => Number(m.matchScore)),
      ...pitchMatches.map((m) => Number(m.score)),
      ...dealMatches.map((m) => Number(m.score)),
      ...oppMatches.map((m) => Number(m.matchScore)),
    ];

    const scoreRanges = [
      { range: "90-100", min: 90, max: 100 },
      { range: "80-89", min: 80, max: 89 },
      { range: "70-79", min: 70, max: 79 },
      { range: "60-69", min: 60, max: 69 },
      { range: "50-59", min: 50, max: 59 },
      { range: "<50", min: 0, max: 49 },
    ];

    const matchScoreDistribution = scoreRanges.map((range) => ({
      range: range.range,
      count: allScores.filter(
        (score) => score >= range.min && score <= range.max,
      ).length,
    }));

    return {
      contactsOverTime,
      matchesOverTime,
      interactionsOverTime,
      interactionsByType: interactionsByType.map((i) => ({
        type: i.interactionType,
        count: i._count,
      })),
      contactsBySector,
      matchScoreDistribution,
    };
  }

  /**
   * Group records by date
   */
  private groupByDate<T extends { [key: string]: Date | unknown }>(
    records: T[],
    dateLabels: Date[],
    dateField: keyof T,
  ): ChartDataPoint[] {
    const counts: Record<string, number> = {};

    // Initialize all dates with 0
    dateLabels.forEach((date) => {
      const key = date.toISOString().split("T")[0];
      counts[key] = 0;
    });

    // Count records per date
    records.forEach((record) => {
      const date = record[dateField] as Date;
      const key = date.toISOString().split("T")[0];
      if (counts[key] !== undefined) {
        counts[key]++;
      }
    });

    // Convert to chart data format
    return dateLabels.map((date) => {
      const key = date.toISOString().split("T")[0];
      return {
        date: key,
        label: date.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        }),
        value: counts[key] || 0,
      };
    });
  }
}

// Export singleton instance
export const dashboardService = new DashboardService();
