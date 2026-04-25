/**
 * Neo4j Graph Service
 *
 * Handles graph operations for relationship management and path finding.
 *
 * @module infrastructure/database/neo4j/GraphService
 */

import { getSession, isNeo4jAvailable, queryRecords } from './client';
import { logger } from '../../../shared/logger/index';

/**
 * Graph node types
 */
export type NodeType = 'User' | 'Contact' | 'Sector' | 'Skill' | 'Project';

/**
 * Relationship types
 */
export type RelationshipType = 'OWNS' | 'KNOWS' | 'WORKS_IN' | 'HAS_SKILL' | 'CONNECTED_TO' | 'CREATED_PROJECT' | 'PROJECT_IN_SECTOR' | 'PROJECT_NEEDS_SKILL' | 'MATCHED_WITH' | 'TEAMMATE';

/**
 * Node data for graph operations
 */
export interface GraphNodeData {
  id: string;
  type: NodeType;
  properties: Record<string, unknown>;
}

/**
 * Relationship data for graph operations
 */
export interface GraphRelationshipData {
  sourceId: string;
  targetId: string;
  type: RelationshipType;
  properties?: Record<string, unknown>;
}

/**
 * Path result from path finding queries
 */
export interface PathResult {
  nodes: Array<{
    id: string;
    type: NodeType;
    name: string;
    properties: Record<string, unknown>;
  }>;
  relationships: Array<{
    type: RelationshipType;
    properties: Record<string, unknown>;
  }>;
  length: number;
}

/**
 * Connection suggestion with mutual contacts
 */
export interface ConnectionSuggestion {
  targetId: string;
  targetName: string;
  mutualConnections: Array<{
    id: string;
    name: string;
  }>;
  score: number;
}

/**
 * Neo4j Graph Service
 *
 * Provides methods for managing graph relationships and finding connections.
 */
export class Neo4jGraphService {
  /**
   * Check if Neo4j is available
   */
  isAvailable(): boolean {
    return isNeo4jAvailable();
  }

  /**
   * Create or update a user node in the graph
   */
  async upsertUser(userId: string, properties: Record<string, unknown>): Promise<void> {
    if (!this.isAvailable()) return;

    const session = getSession();
    if (!session) return;

    try {
      await session.run(
        `
        MERGE (u:User {id: $userId})
        SET u += $properties, u.updatedAt = datetime()
        `,
        { userId, properties }
      );
      logger.debug('Upserted user node', { userId });
    } catch (error) {
      logger.error('Failed to upsert user node:', error);
    } finally {
      await session.close();
    }
  }

  /**
   * Create or update a contact node and relationship to owner
   */
  async upsertContact(
    contactId: string,
    ownerId: string,
    properties: Record<string, unknown>
  ): Promise<void> {
    if (!this.isAvailable()) return;

    const session = getSession();
    if (!session) return;

    try {
      await session.run(
        `
        MERGE (c:Contact {id: $contactId})
        SET c += $properties, c.updatedAt = datetime()
        WITH c
        MATCH (u:User {id: $ownerId})
        MERGE (u)-[r:OWNS]->(c)
        SET r.createdAt = coalesce(r.createdAt, datetime())
        `,
        { contactId, ownerId, properties }
      );
      logger.debug('Upserted contact node', { contactId, ownerId });
    } catch (error) {
      logger.error('Failed to upsert contact node:', error);
    } finally {
      await session.close();
    }
  }

  /**
   * Create or update a sector node
   */
  async upsertSector(sectorId: string, name: string, nameAr?: string): Promise<void> {
    if (!this.isAvailable()) return;

    const session = getSession();
    if (!session) return;

    try {
      await session.run(
        `
        MERGE (s:Sector {id: $sectorId})
        SET s.name = $name, s.nameAr = $nameAr
        `,
        { sectorId, name, nameAr }
      );
    } catch (error) {
      logger.error('Failed to upsert sector node:', error);
    } finally {
      await session.close();
    }
  }

  /**
   * Create relationship between contact and sector
   */
  async linkContactToSector(
    contactId: string,
    sectorId: string,
    confidence: number = 1.0
  ): Promise<void> {
    if (!this.isAvailable()) return;

    const session = getSession();
    if (!session) return;

    try {
      await session.run(
        `
        MATCH (c:Contact {id: $contactId})
        MATCH (s:Sector {id: $sectorId})
        MERGE (c)-[r:WORKS_IN]->(s)
        SET r.confidence = $confidence
        `,
        { contactId, sectorId, confidence }
      );
    } catch (error) {
      logger.error('Failed to link contact to sector:', error);
    } finally {
      await session.close();
    }
  }

  /**
   * Create a connection between two contacts (mutual introduction)
   */
  async createConnection(
    contact1Id: string,
    contact2Id: string,
    properties?: Record<string, unknown>
  ): Promise<void> {
    if (!this.isAvailable()) return;

    const session = getSession();
    if (!session) return;

    try {
      await session.run(
        `
        MATCH (c1:Contact {id: $contact1Id})
        MATCH (c2:Contact {id: $contact2Id})
        MERGE (c1)-[r:CONNECTED_TO]-(c2)
        SET r += $properties, r.createdAt = coalesce(r.createdAt, datetime())
        `,
        { contact1Id, contact2Id, properties: properties || {} }
      );
    } catch (error) {
      logger.error('Failed to create connection:', error);
    } finally {
      await session.close();
    }
  }

  /**
   * Find shortest path between user and a target contact
   *
   * This finds warm introduction paths through mutual connections.
   */
  async findShortestPath(userId: string, targetContactId: string): Promise<PathResult[]> {
    if (!this.isAvailable()) return [];

    const session = getSession();
    if (!session) return [];

    try {
      const result = await session.run(
        `
        MATCH (start:User {id: $userId})
        MATCH (end:Contact {id: $targetContactId})
        MATCH path = shortestPath((start)-[*..6]-(end))
        RETURN path,
               [n IN nodes(path) | {id: n.id, type: labels(n)[0], name: coalesce(n.fullName, n.name, n.email)}] as nodeList,
               [r IN relationships(path) | {type: type(r), properties: properties(r)}] as relList,
               length(path) as pathLength
        LIMIT 5
        `,
        { userId, targetContactId }
      );

      return result.records.map((record) => ({
        nodes: record.get('nodeList'),
        relationships: record.get('relList'),
        length: record.get('pathLength'),
      }));
    } catch (error) {
      logger.error('Failed to find shortest path:', error);
      return [];
    } finally {
      await session.close();
    }
  }

  /**
   * Find all paths between user and target within given depth
   */
  async findAllPaths(
    userId: string,
    targetContactId: string,
    maxDepth: number = 4
  ): Promise<PathResult[]> {
    if (!this.isAvailable()) return [];

    const session = getSession();
    if (!session) return [];

    try {
      const result = await session.run(
        `
        MATCH (start:User {id: $userId})
        MATCH (end:Contact {id: $targetContactId})
        MATCH path = (start)-[*1..${maxDepth}]-(end)
        WITH path,
             [n IN nodes(path) | {id: n.id, type: labels(n)[0], name: coalesce(n.fullName, n.name)}] as nodeList,
             [r IN relationships(path) | {type: type(r), properties: properties(r)}] as relList,
             length(path) as pathLength
        ORDER BY pathLength
        LIMIT 10
        RETURN nodeList, relList, pathLength
        `,
        { userId, targetContactId }
      );

      return result.records.map((record) => ({
        nodes: record.get('nodeList'),
        relationships: record.get('relList'),
        length: record.get('pathLength'),
      }));
    } catch (error) {
      logger.error('Failed to find all paths:', error);
      return [];
    } finally {
      await session.close();
    }
  }

  /**
   * Get suggested connections based on mutual contacts and sectors
   */
  async getSuggestedConnections(userId: string, limit: number = 10): Promise<ConnectionSuggestion[]> {
    if (!this.isAvailable()) return [];

    const session = getSession();
    if (!session) return [];

    try {
      const result = await session.run(
        `
        MATCH (u:User {id: $userId})-[:OWNS]->(myContact:Contact)
        MATCH (myContact)-[:WORKS_IN]->(s:Sector)<-[:WORKS_IN]-(suggested:Contact)
        WHERE NOT (u)-[:OWNS]->(suggested)
        WITH suggested, collect(DISTINCT s.name) as commonSectors, count(DISTINCT s) as sectorScore

        OPTIONAL MATCH (u)-[:OWNS]->(mutual:Contact)-[:CONNECTED_TO]-(suggested)
        WITH suggested, commonSectors, sectorScore, collect(DISTINCT {id: mutual.id, name: mutual.fullName}) as mutuals

        WITH suggested,
             commonSectors,
             mutuals,
             (sectorScore * 10 + size(mutuals) * 20) as score
        ORDER BY score DESC
        LIMIT $limit

        RETURN suggested.id as targetId,
               suggested.fullName as targetName,
               mutuals as mutualConnections,
               score
        `,
        { userId, limit }
      );

      return result.records.map((record) => ({
        targetId: record.get('targetId'),
        targetName: record.get('targetName'),
        mutualConnections: record.get('mutualConnections').filter((m: any) => m.id),
        score: record.get('score'),
      }));
    } catch (error) {
      logger.error('Failed to get suggested connections:', error);
      return [];
    } finally {
      await session.close();
    }
  }

  /**
   * Get network statistics for a user
   */
  async getNetworkStats(userId: string): Promise<{
    totalContacts: number;
    totalConnections: number;
    sectorsReached: number;
    averagePathLength: number;
  } | null> {
    if (!this.isAvailable()) return null;

    const session = getSession();
    if (!session) return null;

    try {
      const result = await session.run(
        `
        MATCH (u:User {id: $userId})
        OPTIONAL MATCH (u)-[:OWNS]->(c:Contact)
        OPTIONAL MATCH (c)-[:WORKS_IN]->(s:Sector)
        OPTIONAL MATCH (c)-[:CONNECTED_TO]-(other:Contact)
        WITH u,
             count(DISTINCT c) as contacts,
             count(DISTINCT s) as sectors,
             count(DISTINCT other) as connections
        RETURN contacts as totalContacts,
               connections as totalConnections,
               sectors as sectorsReached
        `,
        { userId }
      );

      if (result.records.length === 0) return null;

      const record = result.records[0];
      return {
        totalContacts: record.get('totalContacts') || 0,
        totalConnections: record.get('totalConnections') || 0,
        sectorsReached: record.get('sectorsReached') || 0,
        averagePathLength: 0, // Would require more complex calculation
      };
    } catch (error) {
      logger.error('Failed to get network stats:', error);
      return null;
    } finally {
      await session.close();
    }
  }

  /**
   * Get contacts grouped by their degree of separation from user
   */
  async getContactsByDegree(
    userId: string,
    maxDegree: number = 3
  ): Promise<Map<number, string[]>> {
    if (!this.isAvailable()) return new Map();

    const session = getSession();
    if (!session) return new Map();

    try {
      const result = await session.run(
        `
        MATCH (u:User {id: $userId})
        MATCH path = (u)-[*1..${maxDegree}]-(c:Contact)
        WHERE NOT (u)-[:OWNS]->(c)
        WITH c, min(length(path)) as degree
        RETURN degree, collect(c.id) as contactIds
        ORDER BY degree
        `,
        { userId }
      );

      const degreeMap = new Map<number, string[]>();
      result.records.forEach((record) => {
        degreeMap.set(record.get('degree'), record.get('contactIds'));
      });

      return degreeMap;
    } catch (error) {
      logger.error('Failed to get contacts by degree:', error);
      return new Map();
    } finally {
      await session.close();
    }
  }

  // =====================
  // Project Node Methods
  // =====================

  /**
   * Create or update a project node in the graph
   */
  async upsertProject(
    projectId: string,
    userId: string,
    properties: Record<string, unknown>
  ): Promise<void> {
    if (!this.isAvailable()) return;

    const session = getSession();
    if (!session) return;

    try {
      await session.run(
        `
        MERGE (p:Project {id: $projectId})
        SET p += $properties, p.updatedAt = datetime()
        WITH p
        MATCH (u:User {id: $userId})
        MERGE (u)-[r:CREATED_PROJECT]->(p)
        SET r.createdAt = coalesce(r.createdAt, datetime())
        `,
        { projectId, userId, properties }
      );
      logger.debug('Upserted project node', { projectId, userId });
    } catch (error) {
      logger.error('Failed to upsert project node:', error);
    } finally {
      await session.close();
    }
  }

  /**
   * Link project to a sector
   */
  async linkProjectToSector(
    projectId: string,
    sectorId: string
  ): Promise<void> {
    if (!this.isAvailable()) return;

    const session = getSession();
    if (!session) return;

    try {
      await session.run(
        `
        MATCH (p:Project {id: $projectId})
        MATCH (s:Sector {id: $sectorId})
        MERGE (p)-[r:PROJECT_IN_SECTOR]->(s)
        `,
        { projectId, sectorId }
      );
    } catch (error) {
      logger.error('Failed to link project to sector:', error);
    } finally {
      await session.close();
    }
  }

  /**
   * Link project to a required skill
   */
  async linkProjectToSkill(
    projectId: string,
    skillId: string,
    importance: string = 'REQUIRED'
  ): Promise<void> {
    if (!this.isAvailable()) return;

    const session = getSession();
    if (!session) return;

    try {
      await session.run(
        `
        MATCH (p:Project {id: $projectId})
        MATCH (sk:Skill {id: $skillId})
        MERGE (p)-[r:PROJECT_NEEDS_SKILL]->(sk)
        SET r.importance = $importance
        `,
        { projectId, skillId, importance }
      );
    } catch (error) {
      logger.error('Failed to link project to skill:', error);
    } finally {
      await session.close();
    }
  }

  /**
   * Create a match relationship between project and user/contact
   */
  async createProjectMatch(
    projectId: string,
    targetId: string,
    targetType: 'User' | 'Contact',
    score: number,
    reasons: string[]
  ): Promise<void> {
    if (!this.isAvailable()) return;

    const session = getSession();
    if (!session) return;

    try {
      await session.run(
        `
        MATCH (p:Project {id: $projectId})
        MATCH (target:${targetType} {id: $targetId})
        MERGE (p)-[r:MATCHED_WITH]->(target)
        SET r.score = $score,
            r.reasons = $reasons,
            r.matchedAt = datetime()
        `,
        { projectId, targetId, score, reasons }
      );
    } catch (error) {
      logger.error('Failed to create project match:', error);
    } finally {
      await session.close();
    }
  }

  /**
   * Find potential collaborators for a project based on graph relationships
   * Uses sector/skill overlap and network proximity
   */
  async findProjectCollaborators(
    projectId: string,
    userId: string,
    limit: number = 50
  ): Promise<Array<{
    id: string;
    type: 'User' | 'Contact';
    name: string;
    score: number;
    sharedSectors: string[];
    sharedSkills: string[];
    pathLength: number;
  }>> {
    if (!this.isAvailable()) return [];

    const session = getSession();
    if (!session) return [];

    try {
      const result = await session.run(
        `
        MATCH (p:Project {id: $projectId})
        MATCH (p)-[:PROJECT_IN_SECTOR]->(s:Sector)<-[:WORKS_IN]-(candidate)
        WHERE candidate.id <> $userId
          AND (candidate:User OR candidate:Contact)
        WITH candidate, collect(DISTINCT s.name) as sharedSectors

        OPTIONAL MATCH (p)-[:PROJECT_NEEDS_SKILL]->(sk:Skill)<-[:HAS_SKILL]-(candidate)
        WITH candidate, sharedSectors, collect(DISTINCT sk.name) as sharedSkills

        // Calculate network distance for owned contacts
        OPTIONAL MATCH (owner:User {id: $userId})-[:OWNS]->(candidate:Contact)
        WITH candidate,
             sharedSectors,
             sharedSkills,
             CASE WHEN owner IS NOT NULL THEN 1 ELSE 2 END as pathLength

        WITH candidate,
             sharedSectors,
             sharedSkills,
             pathLength,
             (size(sharedSectors) * 10 + size(sharedSkills) * 15 + (3 - pathLength) * 5) as graphScore

        WHERE graphScore > 0
        RETURN candidate.id as id,
               labels(candidate)[0] as type,
               coalesce(candidate.fullName, candidate.name) as name,
               graphScore as score,
               sharedSectors,
               sharedSkills,
               pathLength
        ORDER BY graphScore DESC
        LIMIT $limit
        `,
        { projectId, userId, limit }
      );

      return result.records.map((record) => ({
        id: record.get('id'),
        type: record.get('type') as 'User' | 'Contact',
        name: record.get('name'),
        score: record.get('score'),
        sharedSectors: record.get('sharedSectors'),
        sharedSkills: record.get('sharedSkills'),
        pathLength: record.get('pathLength'),
      }));
    } catch (error) {
      logger.error('Failed to find project collaborators:', error);
      return [];
    } finally {
      await session.close();
    }
  }

  /**
   * Delete a project and all its relationships
   */
  async deleteProject(projectId: string): Promise<void> {
    if (!this.isAvailable()) return;

    const session = getSession();
    if (!session) return;

    try {
      await session.run(
        `
        MATCH (p:Project {id: $projectId})
        DETACH DELETE p
        `,
        { projectId }
      );
      logger.debug('Deleted project from graph', { projectId });
    } catch (error) {
      logger.error('Failed to delete project from graph:', error);
    } finally {
      await session.close();
    }
  }

  /**
   * Delete a contact and all its relationships
   */
  async deleteContact(contactId: string): Promise<void> {
    if (!this.isAvailable()) return;

    const session = getSession();
    if (!session) return;

    try {
      await session.run(
        `
        MATCH (c:Contact {id: $contactId})
        DETACH DELETE c
        `,
        { contactId }
      );
      logger.debug('Deleted contact from graph', { contactId });
    } catch (error) {
      logger.error('Failed to delete contact from graph:', error);
    } finally {
      await session.close();
    }
  }

  /**
   * Sync all data from MySQL to Neo4j
   *
   * This should be called during initial setup or for data recovery.
   */
  async syncFromMySQL(
    users: Array<{ id: string; fullName: string; email: string; company?: string }>,
    contacts: Array<{
      id: string;
      ownerId: string;
      fullName: string;
      company?: string;
      sectors: Array<{ sectorId: string; name: string }>;
    }>,
    sectors: Array<{ id: string; name: string; nameAr?: string }>
  ): Promise<void> {
    if (!this.isAvailable()) {
      logger.warn('Neo4j not available for sync');
      return;
    }

    logger.info('Starting Neo4j sync from MySQL...');

    // Sync sectors first
    for (const sector of sectors) {
      await this.upsertSector(sector.id, sector.name, sector.nameAr);
    }
    logger.info(`Synced ${sectors.length} sectors`);

    // Sync users
    for (const user of users) {
      await this.upsertUser(user.id, {
        fullName: user.fullName,
        email: user.email,
        company: user.company,
      });
    }
    logger.info(`Synced ${users.length} users`);

    // Sync contacts
    for (const contact of contacts) {
      await this.upsertContact(contact.id, contact.ownerId, {
        fullName: contact.fullName,
        company: contact.company,
        ownerId: contact.ownerId,
      });

      // Link to sectors
      for (const sector of contact.sectors) {
        await this.linkContactToSector(contact.id, sector.sectorId);
      }
    }
    logger.info(`Synced ${contacts.length} contacts`);

    logger.info('Neo4j sync completed');
  }

  // =====================
  // Team Graph Methods
  // =====================

  /**
   * Create TEAMMATE relationship between two users in the same org
   */
  async createTeammateRelationship(
    userId1: string,
    userId2: string,
    organizationId: string
  ): Promise<void> {
    if (!this.isAvailable()) return;

    const session = getSession();
    if (!session) return;

    try {
      await session.run(
        `
        MATCH (u1:User {id: $userId1})
        MATCH (u2:User {id: $userId2})
        MERGE (u1)-[r:TEAMMATE]-(u2)
        SET r.organizationId = $organizationId, r.createdAt = coalesce(r.createdAt, datetime())
        `,
        { userId1, userId2, organizationId }
      );
    } catch (error) {
      logger.error('Failed to create teammate relationship:', error);
    } finally {
      await session.close();
    }
  }

  /**
   * Get combined team network graph
   * Returns nodes and edges for all team members' contacts (respects visibility)
   */
  async getTeamNetwork(
    memberUserIds: string[],
    limit: number = 200
  ): Promise<{
    nodes: Array<{ id: string; type: string; name: string; ownerId?: string; properties: Record<string, unknown> }>;
    edges: Array<{ source: string; target: string; type: string; properties: Record<string, unknown> }>;
  }> {
    if (!this.isAvailable() || memberUserIds.length === 0) return { nodes: [], edges: [] };

    const session = getSession();
    if (!session) return { nodes: [], edges: [] };

    try {
      const result = await session.run(
        `
        // Get team member nodes
        UNWIND $memberIds AS memberId
        MATCH (u:User {id: memberId})
        WITH collect(u) AS teamMembers

        // Get contacts owned by team members
        UNWIND teamMembers AS u
        OPTIONAL MATCH (u)-[:OWNS]->(c:Contact)
        WITH teamMembers, u, collect(c)[0..$limit] AS contacts

        // Build return
        WITH teamMembers,
             collect({user: u, contacts: contacts}) AS memberData

        // Return nodes and edges
        UNWIND memberData AS md
        WITH teamMembers, md.user AS u, md.contacts AS contacts
        UNWIND contacts AS c
        OPTIONAL MATCH (c)-[:WORKS_IN]->(s:Sector)
        WITH teamMembers, u, c, collect(DISTINCT s) AS sectors

        RETURN
          u.id AS userId,
          u.fullName AS userName,
          c.id AS contactId,
          c.fullName AS contactName,
          c.company AS contactCompany,
          [s IN sectors | {id: s.id, name: s.name}] AS contactSectors
        LIMIT $limit
        `,
        { memberIds: memberUserIds, limit }
      );

      const nodesMap = new Map<string, any>();
      const edges: any[] = [];

      // Add team member nodes
      for (const memberId of memberUserIds) {
        if (!nodesMap.has(memberId)) {
          nodesMap.set(memberId, { id: memberId, type: 'User', name: '', properties: {} });
        }
      }

      for (const record of result.records) {
        const userId = record.get('userId');
        const userName = record.get('userName');
        const contactId = record.get('contactId');
        const contactName = record.get('contactName');
        const contactCompany = record.get('contactCompany');

        // Update user node name
        if (nodesMap.has(userId)) {
          nodesMap.get(userId).name = userName;
        }

        if (contactId) {
          // Add contact node
          if (!nodesMap.has(contactId)) {
            nodesMap.set(contactId, {
              id: contactId,
              type: 'Contact',
              name: contactName,
              ownerId: userId,
              properties: { company: contactCompany },
            });
          }

          // Add owns edge
          edges.push({
            source: userId,
            target: contactId,
            type: 'OWNS',
            properties: {},
          });
        }
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

      return {
        nodes: Array.from(nodesMap.values()),
        edges,
      };
    } catch (error) {
      logger.error('Failed to get team network:', error);
      return { nodes: [], edges: [] };
    } finally {
      await session.close();
    }
  }

  /**
   * Get team network statistics
   */
  async getTeamStats(memberUserIds: string[]): Promise<{
    totalUniqueContacts: number;
    totalConnections: number;
    sectorsReached: number;
    mutualContacts: number;
  } | null> {
    if (!this.isAvailable() || memberUserIds.length === 0) return null;

    const session = getSession();
    if (!session) return null;

    try {
      const result = await session.run(
        `
        UNWIND $memberIds AS memberId
        MATCH (u:User {id: memberId})-[:OWNS]->(c:Contact)
        WITH collect(DISTINCT c) AS allContacts

        // Count unique contacts
        WITH allContacts, size(allContacts) AS totalContacts

        // Count sectors
        UNWIND allContacts AS c
        OPTIONAL MATCH (c)-[:WORKS_IN]->(s:Sector)
        WITH totalContacts, allContacts, count(DISTINCT s) AS sectors

        // Count mutual contacts (owned by 2+ members)
        UNWIND allContacts AS c
        MATCH (u:User)-[:OWNS]->(c) WHERE u.id IN $memberIds
        WITH totalContacts, sectors, c, count(u) AS ownerCount
        WHERE ownerCount >= 2
        WITH totalContacts, sectors, count(c) AS mutuals

        RETURN totalContacts, sectors AS sectorsReached, mutuals AS mutualContacts
        `,
        { memberIds: memberUserIds }
      );

      if (result.records.length === 0) return null;

      const record = result.records[0];
      return {
        totalUniqueContacts: record.get('totalContacts') || 0,
        totalConnections: 0,
        sectorsReached: record.get('sectorsReached') || 0,
        mutualContacts: record.get('mutualContacts') || 0,
      };
    } catch (error) {
      logger.error('Failed to get team stats:', error);
      return null;
    } finally {
      await session.close();
    }
  }

  /**
   * Get mutual contact overlap between team members
   */
  async getTeamOverlap(memberUserIds: string[]): Promise<Array<{
    contactId: string;
    contactName: string;
    owners: Array<{ userId: string; userName: string }>;
  }>> {
    if (!this.isAvailable() || memberUserIds.length < 2) return [];

    const session = getSession();
    if (!session) return [];

    try {
      const result = await session.run(
        `
        UNWIND $memberIds AS memberId
        MATCH (u:User {id: memberId})-[:OWNS]->(c:Contact)
        WITH c, collect({userId: u.id, userName: u.fullName}) AS owners
        WHERE size(owners) >= 2
        RETURN c.id AS contactId, c.fullName AS contactName, owners
        ORDER BY size(owners) DESC
        LIMIT 50
        `,
        { memberIds: memberUserIds }
      );

      return result.records.map((record) => ({
        contactId: record.get('contactId'),
        contactName: record.get('contactName'),
        owners: record.get('owners'),
      }));
    } catch (error) {
      logger.error('Failed to get team overlap:', error);
      return [];
    } finally {
      await session.close();
    }
  }
}

// Export singleton instance
export const neo4jGraphService = new Neo4jGraphService();
export default neo4jGraphService;
