/**
 * Graph Controller
 *
 * Handles HTTP requests for network graph and visualization endpoints.
 *
 * @module presentation/controllers/GraphController
 */

import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../infrastructure/database/prisma/client.js';
import { AuthenticationError } from '../../shared/errors/index.js';
import { logger } from '../../shared/logger/index.js';
import { neo4jGraphService } from '../../infrastructure/database/neo4j/GraphService.js';

/**
 * Node type for graph visualization
 */
interface GraphNode {
  id: string;
  type: 'user' | 'contact' | 'sector';
  label: string;
  data: {
    name?: string;
    company?: string;
    jobTitle?: string;
    matchScore?: number;
    avatarUrl?: string;
    contactCount?: number;
  };
}

/**
 * Edge type for graph visualization
 */
interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: 'owns' | 'sector' | 'skill';
  weight: number;
}

/**
 * Cluster grouping
 */
interface Cluster {
  id: string;
  label: string;
  type: 'sector' | 'company' | 'location';
  contacts: Array<{
    id: string;
    name: string;
    matchScore?: number;
  }>;
  count: number;
}

/**
 * Graph Controller
 *
 * Provides HTTP handlers for network graph visualization.
 */
export class GraphController {
  /**
   * Get user's relationship network data
   *
   * GET /api/v1/graph/network
   *
   * Returns nodes and edges for graph visualization.
   *
   * Query params:
   * - depth: graph depth (default 1)
   * - sector: filter by sector ID
   * - limit: max contacts (default 100)
   */
  async getNetwork(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AuthenticationError('Authentication required');
      }

      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 100;
      const sectorFilter = req.query.sector as string | undefined;

      // Get user data
      const user = await prisma.user.findUnique({
        where: { id: req.user.userId },
        include: {
          userSectors: { include: { sector: true } },
        },
      });

      if (!user) {
        res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'User not found' },
        });
        return;
      }

      // Build contact query
      const contactWhere: any = { ownerId: req.user.userId };
      if (sectorFilter) {
        contactWhere.contactSectors = {
          some: { sectorId: sectorFilter },
        };
      }

      // Get contacts
      const contacts = await prisma.contact.findMany({
        where: contactWhere,
        include: {
          contactSectors: { include: { sector: true } },
        },
        orderBy: { matchScore: 'desc' },
        take: limit,
      });

      // Build graph nodes
      const nodes: GraphNode[] = [];
      const edges: GraphEdge[] = [];
      const sectorNodes = new Map<string, GraphNode>();

      // Add user node
      nodes.push({
        id: user.id,
        type: 'user',
        label: user.fullName,
        data: {
          name: user.fullName,
          company: user.company || undefined,
          jobTitle: user.jobTitle || undefined,
          avatarUrl: user.avatarUrl || undefined,
        },
      });

      // Add sector nodes from user
      for (const us of user.userSectors) {
        if (!sectorNodes.has(us.sectorId)) {
          sectorNodes.set(us.sectorId, {
            id: `sector-${us.sectorId}`,
            type: 'sector',
            label: us.sector.name,
            data: {
              contactCount: 0,
            },
          });
        }
      }

      // Add contact nodes and edges
      for (const contact of contacts) {
        // Add contact node
        nodes.push({
          id: contact.id,
          type: 'contact',
          label: contact.fullName,
          data: {
            name: contact.fullName,
            company: contact.company || undefined,
            jobTitle: contact.jobTitle || undefined,
            matchScore: contact.matchScore ? Number(contact.matchScore) : undefined,
          },
        });

        // Add edge from user to contact
        edges.push({
          id: `edge-${user.id}-${contact.id}`,
          source: user.id,
          target: contact.id,
          type: 'owns',
          weight: contact.matchScore ? Number(contact.matchScore) / 100 : 0.5,
        });

        // Process contact sectors
        for (const cs of contact.contactSectors) {
          // Add sector node if not exists
          if (!sectorNodes.has(cs.sectorId)) {
            sectorNodes.set(cs.sectorId, {
              id: `sector-${cs.sectorId}`,
              type: 'sector',
              label: cs.sector.name,
              data: {
                contactCount: 0,
              },
            });
          }

          // Update contact count
          const sectorNode = sectorNodes.get(cs.sectorId)!;
          sectorNode.data.contactCount = (sectorNode.data.contactCount || 0) + 1;

          // Add edge from contact to sector
          edges.push({
            id: `edge-${contact.id}-sector-${cs.sectorId}`,
            source: contact.id,
            target: `sector-${cs.sectorId}`,
            type: 'sector',
            weight: Number(cs.confidence) || 0.8,
          });
        }
      }

      // Add sector nodes to main nodes array
      nodes.push(...sectorNodes.values());

      res.status(200).json({
        success: true,
        data: {
          nodes,
          edges,
          stats: {
            totalNodes: nodes.length,
            totalEdges: edges.length,
            contactCount: contacts.length,
            sectorCount: sectorNodes.size,
          },
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get contact clusters by sector/company
   *
   * GET /api/v1/graph/clusters
   *
   * Query params:
   * - groupBy: 'sector' | 'company' | 'location' (default 'sector')
   */
  async getClusters(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AuthenticationError('Authentication required');
      }

      const groupBy = (req.query.groupBy as string) || 'sector';

      let clusters: Cluster[] = [];

      if (groupBy === 'sector') {
        // Get sector distribution
        const sectorGroups = await prisma.contactSector.groupBy({
          by: ['sectorId'],
          where: {
            contact: { ownerId: req.user.userId },
          },
          _count: true,
        });

        // Get sector details and contacts for each
        for (const group of sectorGroups) {
          const sector = await prisma.sector.findUnique({
            where: { id: group.sectorId },
          });

          const contacts = await prisma.contact.findMany({
            where: {
              ownerId: req.user.userId,
              contactSectors: { some: { sectorId: group.sectorId } },
            },
            select: {
              id: true,
              fullName: true,
              matchScore: true,
            },
            orderBy: { matchScore: 'desc' },
            take: 10,
          });

          if (sector) {
            clusters.push({
              id: group.sectorId,
              label: sector.name,
              type: 'sector',
              contacts: contacts.map((c) => ({
                id: c.id,
                name: c.fullName,
                matchScore: c.matchScore ? Number(c.matchScore) : undefined,
              })),
              count: group._count,
            });
          }
        }
      } else if (groupBy === 'company') {
        // Get company distribution
        const companyGroups = await prisma.contact.groupBy({
          by: ['company'],
          where: {
            ownerId: req.user.userId,
            company: { not: null },
          },
          _count: true,
        });

        for (const group of companyGroups) {
          if (!group.company) continue;

          const contacts = await prisma.contact.findMany({
            where: {
              ownerId: req.user.userId,
              company: group.company,
            },
            select: {
              id: true,
              fullName: true,
              matchScore: true,
            },
            orderBy: { matchScore: 'desc' },
            take: 10,
          });

          clusters.push({
            id: `company-${group.company}`,
            label: group.company,
            type: 'company',
            contacts: contacts.map((c) => ({
              id: c.id,
              name: c.fullName,
              matchScore: c.matchScore ? Number(c.matchScore) : undefined,
            })),
            count: group._count,
          });
        }
      }

      // Sort by count descending
      clusters.sort((a, b) => b.count - a.count);

      res.status(200).json({
        success: true,
        data: {
          clusters,
          groupBy,
          totalClusters: clusters.length,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get underutilized connections
   *
   * GET /api/v1/graph/underutilized
   *
   * Returns high-value contacts that haven't been engaged recently.
   *
   * Query params:
   * - days: days since last interaction (default 30)
   * - minScore: minimum match score (default 50)
   * - limit: max results (default 20)
   */
  async getUnderutilized(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AuthenticationError('Authentication required');
      }

      const days = req.query.days ? parseInt(req.query.days as string, 10) : 30;
      const minScore = req.query.minScore ? parseInt(req.query.minScore as string, 10) : 50;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;

      const thresholdDate = new Date();
      thresholdDate.setDate(thresholdDate.getDate() - days);

      const contacts = await prisma.contact.findMany({
        where: {
          ownerId: req.user.userId,
          matchScore: { gte: minScore },
          OR: [
            { lastInteractionAt: null },
            { lastInteractionAt: { lt: thresholdDate } },
          ],
        },
        select: {
          id: true,
          fullName: true,
          company: true,
          jobTitle: true,
          matchScore: true,
          lastInteractionAt: true,
        },
        orderBy: { matchScore: 'desc' },
        take: limit,
      });

      res.status(200).json({
        success: true,
        data: {
          contacts: contacts.map((c) => ({
            id: c.id,
            name: c.fullName,
            company: c.company,
            jobTitle: c.jobTitle,
            matchScore: c.matchScore ? Number(c.matchScore) : undefined,
            lastInteractionAt: c.lastInteractionAt?.toISOString(),
            daysSinceContact: c.lastInteractionAt
              ? Math.floor((Date.now() - c.lastInteractionAt.getTime()) / (1000 * 60 * 60 * 24))
              : null,
          })),
          criteria: { days, minScore },
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get network statistics
   *
   * GET /api/v1/graph/stats
   *
   * Returns summary statistics about the user's network.
   */
  async getStats(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AuthenticationError('Authentication required');
      }

      // Get total contact count
      const totalContacts = await prisma.contact.count({
        where: { ownerId: req.user.userId },
      });

      // Get contacts added this month
      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);

      const contactsThisMonth = await prisma.contact.count({
        where: {
          ownerId: req.user.userId,
          createdAt: { gte: monthStart },
        },
      });

      // Get interaction count
      const totalInteractions = await prisma.interaction.count({
        where: { userId: req.user.userId },
      });

      // Get average match score
      const avgScore = await prisma.contact.aggregate({
        where: { ownerId: req.user.userId },
        _avg: { matchScore: true },
      });

      // Get sector distribution
      const sectorDistribution = await prisma.contactSector.groupBy({
        by: ['sectorId'],
        where: {
          contact: { ownerId: req.user.userId },
        },
        _count: true,
      });

      // Get top sectors with names
      const topSectorIds = sectorDistribution
        .sort((a, b) => b._count - a._count)
        .slice(0, 5)
        .map((s) => s.sectorId);

      const topSectors = await prisma.sector.findMany({
        where: { id: { in: topSectorIds } },
      });

      const topSectorsWithCount = topSectorIds.map((sectorId) => {
        const sector = topSectors.find((s) => s.id === sectorId);
        const distribution = sectorDistribution.find((d) => d.sectorId === sectorId);
        return {
          id: sectorId,
          name: sector?.name || 'Unknown',
          count: distribution?._count || 0,
        };
      });

      // Get contacts by source
      const sourceDistribution = await prisma.contact.groupBy({
        by: ['source'],
        where: { ownerId: req.user.userId },
        _count: true,
      });

      res.status(200).json({
        success: true,
        data: {
          summary: {
            totalContacts,
            contactsThisMonth,
            totalInteractions,
            averageMatchScore: avgScore._avg.matchScore
              ? Math.round(Number(avgScore._avg.matchScore))
              : 0,
            uniqueSectors: sectorDistribution.length,
          },
          topSectors: topSectorsWithCount,
          sourceBreakdown: sourceDistribution.map((s) => ({
            source: s.source,
            count: s._count,
          })),
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Find warm introduction paths
   *
   * GET /api/v1/graph/path/:targetId
   *
   * Uses Neo4j for efficient path finding when available.
   * Falls back to basic connection check when Neo4j is not available.
   */
  async findPath(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AuthenticationError('Authentication required');
      }

      const targetId = req.params.targetId;

      logger.info('Path finding requested', {
        userId: req.user.userId,
        targetId,
      });

      // Check if Neo4j is available
      if (neo4jGraphService.isAvailable()) {
        // Use Neo4j for path finding
        const paths = await neo4jGraphService.findShortestPath(req.user.userId, targetId);

        if (paths.length > 0) {
          res.status(200).json({
            success: true,
            data: {
              targetId,
              paths: paths.map((p) => ({
                nodes: p.nodes,
                relationships: p.relationships,
                length: p.length,
                degreesOfSeparation: p.length - 1,
              })),
              source: 'neo4j',
            },
          });
          return;
        }
      }

      // Fallback: Check if target is a direct contact
      const directContact = await prisma.contact.findFirst({
        where: {
          id: targetId,
          ownerId: req.user.userId,
        },
        select: {
          id: true,
          fullName: true,
          company: true,
        },
      });

      if (directContact) {
        res.status(200).json({
          success: true,
          data: {
            targetId,
            paths: [
              {
                nodes: [
                  { id: req.user.userId, type: 'User', name: 'You' },
                  { id: directContact.id, type: 'Contact', name: directContact.fullName },
                ],
                relationships: [{ type: 'OWNS' }],
                length: 1,
                degreesOfSeparation: 0,
              },
            ],
            source: 'direct',
          },
        });
        return;
      }

      // No path found
      res.status(200).json({
        success: true,
        data: {
          targetId,
          paths: [],
          message: 'No connection path found to this contact',
          source: neo4jGraphService.isAvailable() ? 'neo4j' : 'fallback',
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get suggested connections
   *
   * GET /api/v1/graph/suggestions
   *
   * Returns potential connections based on mutual contacts and shared sectors.
   */
  async getSuggestions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AuthenticationError('Authentication required');
      }

      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 10;

      if (neo4jGraphService.isAvailable()) {
        const suggestions = await neo4jGraphService.getSuggestedConnections(req.user.userId, limit);

        res.status(200).json({
          success: true,
          data: {
            suggestions,
            source: 'neo4j',
          },
        });
        return;
      }

      // Fallback: Return empty suggestions
      res.status(200).json({
        success: true,
        data: {
          suggestions: [],
          message: 'Connection suggestions require Neo4j',
          source: 'fallback',
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Sync contact to Neo4j graph
   *
   * POST /api/v1/graph/sync/:contactId
   *
   * Manually triggers syncing a contact to the Neo4j graph database.
   */
  async syncContact(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AuthenticationError('Authentication required');
      }

      if (!neo4jGraphService.isAvailable()) {
        res.status(503).json({
          success: false,
          error: { code: 'SERVICE_UNAVAILABLE', message: 'Neo4j is not available' },
        });
        return;
      }

      const contactId = req.params.contactId;

      // Get contact with sectors
      const contact = await prisma.contact.findFirst({
        where: {
          id: contactId,
          ownerId: req.user.userId,
        },
        include: {
          contactSectors: { include: { sector: true } },
        },
      });

      if (!contact) {
        res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Contact not found' },
        });
        return;
      }

      // Sync to Neo4j
      await neo4jGraphService.upsertContact(contact.id, req.user.userId, {
        fullName: contact.fullName,
        company: contact.company,
        ownerId: contact.ownerId,
      });

      // Sync sectors
      for (const cs of contact.contactSectors) {
        await neo4jGraphService.upsertSector(cs.sectorId, cs.sector.name, cs.sector.nameAr || undefined);
        await neo4jGraphService.linkContactToSector(contact.id, cs.sectorId, Number(cs.confidence));
      }

      logger.info('Contact synced to Neo4j', { contactId });

      res.status(200).json({
        success: true,
        message: 'Contact synced to graph database',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get team network graph data
   *
   * GET /api/v1/graph/team/network
   *
   * Returns combined graph data for all team members.
   * Requires TEAM plan and org membership.
   */
  async getTeamNetwork(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AuthenticationError('Authentication required');
      }

      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 200;

      // Get user's organization
      const membership = await prisma.organizationMember.findFirst({
        where: { userId: req.user.userId },
        include: {
          organization: {
            include: {
              members: {
                select: { userId: true, user: { select: { id: true, fullName: true, company: true, avatarUrl: true } } },
              },
            },
          },
        },
      });

      if (!membership) {
        res.status(403).json({
          success: false,
          error: { code: 'NO_ORG', message: 'Not a member of any organization' },
        });
        return;
      }

      const memberUserIds = membership.organization.members.map((m) => m.userId);
      const memberMap = new Map(
        membership.organization.members.map((m) => [m.userId, m.user])
      );

      // Try Neo4j first
      if (neo4jGraphService.isAvailable()) {
        const graphData = await neo4jGraphService.getTeamNetwork(memberUserIds, limit);

        // Enrich user nodes with member data
        for (const node of graphData.nodes) {
          if (node.type === 'User' && memberMap.has(node.id)) {
            const member = memberMap.get(node.id)!;
            node.name = member.fullName;
            node.properties = {
              ...node.properties,
              company: member.company,
              avatarUrl: member.avatarUrl,
            };
          }
        }

        res.status(200).json({
          success: true,
          data: {
            nodes: graphData.nodes,
            edges: graphData.edges,
            members: membership.organization.members.map((m) => ({
              userId: m.userId,
              fullName: m.user.fullName,
              company: m.user.company,
              avatarUrl: m.user.avatarUrl,
            })),
            stats: {
              totalNodes: graphData.nodes.length,
              totalEdges: graphData.edges.length,
              memberCount: memberUserIds.length,
            },
            source: 'neo4j',
          },
        });
        return;
      }

      // Fallback: Use MySQL data
      const contacts = await prisma.contact.findMany({
        where: { ownerId: { in: memberUserIds } },
        include: {
          contactSectors: { include: { sector: true } },
        },
        orderBy: { matchScore: 'desc' },
        take: limit,
      });

      const nodes: any[] = [];
      const edges: any[] = [];

      // Add team member nodes
      for (const member of membership.organization.members) {
        nodes.push({
          id: member.userId,
          type: 'User',
          name: member.user.fullName,
          properties: {
            company: member.user.company,
            avatarUrl: member.user.avatarUrl,
          },
        });
      }

      // Add contact nodes and edges
      for (const contact of contacts) {
        nodes.push({
          id: contact.id,
          type: 'Contact',
          name: contact.fullName,
          ownerId: contact.ownerId,
          properties: {
            company: contact.company,
            jobTitle: contact.jobTitle,
            matchScore: contact.matchScore ? Number(contact.matchScore) : undefined,
          },
        });

        edges.push({
          source: contact.ownerId,
          target: contact.id,
          type: 'OWNS',
          properties: {},
        });
      }

      // Add teammate edges
      for (let i = 0; i < memberUserIds.length; i++) {
        for (let j = i + 1; j < memberUserIds.length; j++) {
          edges.push({
            source: memberUserIds[i],
            target: memberUserIds[j],
            type: 'TEAMMATE',
            properties: {},
          });
        }
      }

      res.status(200).json({
        success: true,
        data: {
          nodes,
          edges,
          members: membership.organization.members.map((m) => ({
            userId: m.userId,
            fullName: m.user.fullName,
            company: m.user.company,
            avatarUrl: m.user.avatarUrl,
          })),
          stats: {
            totalNodes: nodes.length,
            totalEdges: edges.length,
            memberCount: memberUserIds.length,
          },
          source: 'mysql',
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get team network statistics
   *
   * GET /api/v1/graph/team/stats
   */
  async getTeamStats(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AuthenticationError('Authentication required');
      }

      const membership = await prisma.organizationMember.findFirst({
        where: { userId: req.user.userId },
        include: {
          organization: {
            include: { members: { select: { userId: true } } },
          },
        },
      });

      if (!membership) {
        res.status(403).json({
          success: false,
          error: { code: 'NO_ORG', message: 'Not a member of any organization' },
        });
        return;
      }

      const memberUserIds = membership.organization.members.map((m) => m.userId);

      // Get total unique contacts
      const totalUniqueContacts = await prisma.contact.count({
        where: { ownerId: { in: memberUserIds } },
      });

      // Get sectors reached
      const sectorGroups = await prisma.contactSector.groupBy({
        by: ['sectorId'],
        where: {
          contact: { ownerId: { in: memberUserIds } },
        },
      });

      // Get top sectors
      const topSectorIds = sectorGroups.slice(0, 10).map((s) => s.sectorId);
      const topSectors = await prisma.sector.findMany({
        where: { id: { in: topSectorIds } },
      });

      // Per-member stats
      const memberStats = await Promise.all(
        memberUserIds.map(async (userId) => {
          const count = await prisma.contact.count({ where: { ownerId: userId } });
          const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { fullName: true, avatarUrl: true },
          });
          return { userId, fullName: user?.fullName || '', avatarUrl: user?.avatarUrl, contactCount: count };
        })
      );

      res.status(200).json({
        success: true,
        data: {
          totalUniqueContacts,
          sectorsReached: sectorGroups.length,
          memberCount: memberUserIds.length,
          topSectors: topSectors.map((s) => ({ id: s.id, name: s.name })),
          memberStats,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get mutual contact overlap between team members
   *
   * GET /api/v1/graph/team/overlap
   */
  async getTeamOverlap(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AuthenticationError('Authentication required');
      }

      const membership = await prisma.organizationMember.findFirst({
        where: { userId: req.user.userId },
        include: {
          organization: {
            include: { members: { select: { userId: true } } },
          },
        },
      });

      if (!membership) {
        res.status(403).json({
          success: false,
          error: { code: 'NO_ORG', message: 'Not a member of any organization' },
        });
        return;
      }

      const memberUserIds = membership.organization.members.map((m) => m.userId);

      // Find contacts that share the same email across multiple team members
      // This is the MySQL fallback for mutual contacts detection
      const contacts = await prisma.contact.findMany({
        where: {
          ownerId: { in: memberUserIds },
          email: { not: null },
        },
        select: {
          id: true,
          fullName: true,
          email: true,
          company: true,
          ownerId: true,
          owner: { select: { fullName: true } },
        },
      });

      // Group by email
      const emailMap = new Map<string, typeof contacts>();
      for (const contact of contacts) {
        if (!contact.email) continue;
        const existing = emailMap.get(contact.email) || [];
        existing.push(contact);
        emailMap.set(contact.email, existing);
      }

      // Filter to only shared (2+ owners)
      const overlaps = Array.from(emailMap.entries())
        .filter(([_, contacts]) => {
          const uniqueOwners = new Set(contacts.map((c) => c.ownerId));
          return uniqueOwners.size >= 2;
        })
        .map(([email, contacts]) => ({
          email,
          contactName: contacts[0].fullName,
          company: contacts[0].company,
          owners: [...new Set(contacts.map((c) => c.ownerId))].map((ownerId) => {
            const contact = contacts.find((c) => c.ownerId === ownerId)!;
            return { userId: ownerId, userName: contact.owner.fullName };
          }),
        }))
        .slice(0, 50);

      res.status(200).json({
        success: true,
        data: { overlaps },
      });
    } catch (error) {
      next(error);
    }
  }
}

// Export singleton instance
export const graphController = new GraphController();
