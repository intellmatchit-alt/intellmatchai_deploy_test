/**
 * Graph API
 *
 * API functions for network graph and visualization endpoints.
 *
 * @module lib/api/graph
 */

import { api } from './client';

/**
 * Graph node
 */
export interface GraphNode {
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
 * Graph edge
 */
export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: 'owns' | 'sector' | 'skill';
  weight: number;
}

/**
 * Network data response
 */
export interface NetworkData {
  nodes: GraphNode[];
  edges: GraphEdge[];
  stats: {
    totalNodes: number;
    totalEdges: number;
    contactCount: number;
    sectorCount: number;
  };
}

/**
 * Cluster data
 */
export interface Cluster {
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
 * Clusters response
 */
export interface ClustersResponse {
  clusters: Cluster[];
  groupBy: string;
  totalClusters: number;
}

/**
 * Underutilized contact
 */
export interface UnderutilizedContact {
  id: string;
  name: string;
  company?: string;
  jobTitle?: string;
  matchScore?: number;
  lastInteractionAt?: string;
  daysSinceContact?: number;
}

/**
 * Underutilized response
 */
export interface UnderutilizedResponse {
  contacts: UnderutilizedContact[];
  criteria: {
    days: number;
    minScore: number;
  };
}

/**
 * Network stats response
 */
export interface NetworkStats {
  summary: {
    totalContacts: number;
    contactsThisMonth: number;
    totalInteractions: number;
    averageMatchScore: number;
    uniqueSectors: number;
  };
  topSectors: Array<{
    id: string;
    name: string;
    count: number;
  }>;
  sourceBreakdown: Array<{
    source: string;
    count: number;
  }>;
}

/**
 * Get network graph data
 */
export function getNetwork(options?: {
  sector?: string;
  limit?: number;
}): Promise<NetworkData> {
  const params = new URLSearchParams();

  if (options?.sector) params.set('sector', options.sector);
  if (options?.limit) params.set('limit', String(options.limit));

  const query = params.toString();
  return api.get<NetworkData>(`/graph/network${query ? `?${query}` : ''}`);
}

/**
 * Get contact clusters
 */
export function getClusters(
  groupBy?: 'sector' | 'company' | 'location'
): Promise<ClustersResponse> {
  const query = groupBy ? `?groupBy=${groupBy}` : '';
  return api.get<ClustersResponse>(`/graph/clusters${query}`);
}

/**
 * Get underutilized high-value contacts
 */
export function getUnderutilized(options?: {
  days?: number;
  minScore?: number;
  limit?: number;
}): Promise<UnderutilizedResponse> {
  const params = new URLSearchParams();

  if (options?.days) params.set('days', String(options.days));
  if (options?.minScore) params.set('minScore', String(options.minScore));
  if (options?.limit) params.set('limit', String(options.limit));

  const query = params.toString();
  return api.get<UnderutilizedResponse>(`/graph/underutilized${query ? `?${query}` : ''}`);
}

/**
 * Get network statistics
 */
export function getStats(): Promise<NetworkStats> {
  return api.get<NetworkStats>('/graph/stats');
}

/**
 * Find path to target (warm introductions)
 */
export function findPath(
  targetId: string
): Promise<{ targetId: string; paths: unknown[]; message?: string }> {
  return api.get<{ targetId: string; paths: unknown[]; message?: string }>(
    `/graph/path/${targetId}`
  );
}

// =====================
// Team Graph API
// =====================

/**
 * Team graph node
 */
export interface TeamGraphNode {
  id: string;
  type: 'User' | 'Contact';
  name: string;
  ownerId?: string;
  properties: {
    company?: string;
    avatarUrl?: string;
    jobTitle?: string;
    matchScore?: number;
  };
}

/**
 * Team graph edge
 */
export interface TeamGraphEdge {
  source: string;
  target: string;
  type: 'OWNS' | 'TEAMMATE';
  properties: Record<string, unknown>;
}

/**
 * Team member info
 */
export interface TeamMember {
  userId: string;
  fullName: string;
  company?: string;
  avatarUrl?: string;
}

/**
 * Team network response
 */
export interface TeamNetworkData {
  nodes: TeamGraphNode[];
  edges: TeamGraphEdge[];
  members: TeamMember[];
  stats: {
    totalNodes: number;
    totalEdges: number;
    memberCount: number;
  };
  source: string;
}

/**
 * Team stats response
 */
export interface TeamNetworkStats {
  totalUniqueContacts: number;
  sectorsReached: number;
  memberCount: number;
  topSectors: Array<{ id: string; name: string }>;
  memberStats: Array<{
    userId: string;
    fullName: string;
    avatarUrl?: string;
    contactCount: number;
  }>;
}

/**
 * Team overlap response
 */
export interface TeamOverlapData {
  overlaps: Array<{
    email: string;
    contactName: string;
    company?: string;
    owners: Array<{ userId: string; userName: string }>;
  }>;
}

/**
 * Get team network graph data
 */
export function getTeamNetwork(options?: { limit?: number }): Promise<TeamNetworkData> {
  const params = new URLSearchParams();
  if (options?.limit) params.set('limit', String(options.limit));
  const query = params.toString();
  return api.get<TeamNetworkData>(`/graph/team/network${query ? `?${query}` : ''}`);
}

/**
 * Get team network statistics
 */
export function getTeamStats(): Promise<TeamNetworkStats> {
  return api.get<TeamNetworkStats>('/graph/team/stats');
}

/**
 * Get team contact overlap
 */
export function getTeamOverlap(): Promise<TeamOverlapData> {
  return api.get<TeamOverlapData>('/graph/team/overlap');
}
