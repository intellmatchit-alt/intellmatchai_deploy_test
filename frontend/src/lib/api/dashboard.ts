/**
 * Dashboard API
 *
 * API functions for dashboard statistics and analytics endpoints.
 *
 * @module lib/api/dashboard
 */

import { api } from "./client";

/**
 * Comparison period type
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
 * Activity item type
 */
export type ActivityType =
  | "SCANNED"
  | "SAVED"
  | "VIEWED"
  | "NOTED"
  | "MEETING"
  | "MESSAGE"
  | "FOLLOW_UP"
  | "INTRODUCED"
  | "CALLED"
  | "EMAILED"
  | "CONTACT_ADDED"
  | "MATCH_FOUND";

/**
 * Activity item for timeline
 */
export interface ActivityItem {
  id: string;
  type: ActivityType;
  title: string;
  description: string;
  contactId?: string;
  contactName?: string;
  metadata?: Record<string, unknown>;
  occurredAt: string;
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
 * Goal progress item
 */
export interface GoalProgress {
  current: number;
  target: number;
}

/**
 * Weekly goals progress
 */
export interface GoalsProgress {
  weeklyConnections: GoalProgress;
  followUpsCompleted: GoalProgress;
  meetingsScheduled: GoalProgress;
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
 * Interaction type count
 */
export interface InteractionTypeCount {
  type: string;
  count: number;
}

/**
 * Sector count
 */
export interface SectorCount {
  sector: string;
  count: number;
  nameAr?: string | null;
}

/**
 * Score range count
 */
export interface ScoreRangeCount {
  range: string;
  count: number;
}

/**
 * Dashboard chart data
 */
export interface DashboardCharts {
  contactsOverTime: ChartDataPoint[];
  matchesOverTime: ChartDataPoint[];
  interactionsOverTime: ChartDataPoint[];
  interactionsByType: InteractionTypeCount[];
  contactsBySector: SectorCount[];
  matchScoreDistribution: ScoreRangeCount[];
}

/**
 * Complete dashboard data
 */
export interface DashboardData {
  stats: DashboardStats;
  health: NetworkHealth;
  goals: GoalsProgress;
  recentActivity: ActivityItem[];
}

/**
 * Get complete dashboard data
 */
export function getDashboard(
  period: ComparisonPeriod = "week",
  from?: string,
  to?: string,
): Promise<DashboardData> {
  const params = new URLSearchParams({ period });
  if (period === "custom" && from) params.set("from", from);
  if (period === "custom" && to) params.set("to", to);
  return api.get<DashboardData>(`/dashboard?${params.toString()}`);
}

/**
 * Get dashboard statistics with comparison
 */
export function getStats(
  period: ComparisonPeriod = "week",
  from?: string,
  to?: string,
): Promise<DashboardStats> {
  const params = new URLSearchParams({ period });
  if (period === "custom" && from) params.set("from", from);
  if (period === "custom" && to) params.set("to", to);
  return api.get<DashboardStats>(`/dashboard/stats?${params.toString()}`);
}

/**
 * Get activity timeline
 */
export function getActivityTimeline(options?: {
  limit?: number;
  offset?: number;
}): Promise<ActivityItem[]> {
  const params = new URLSearchParams();

  if (options?.limit) params.set("limit", String(options.limit));
  if (options?.offset) params.set("offset", String(options.offset));

  const query = params.toString();
  return api.get<ActivityItem[]>(
    `/dashboard/activity${query ? `?${query}` : ""}`,
  );
}

/**
 * Get network health score
 */
export function getNetworkHealth(): Promise<NetworkHealth> {
  return api.get<NetworkHealth>("/dashboard/health");
}

/**
 * Get weekly goals progress
 */
export function getGoalsProgress(): Promise<GoalsProgress> {
  return api.get<GoalsProgress>("/dashboard/goals");
}

/**
 * Get chart data for visualizations
 */
export function getChartData(days: number = 30): Promise<DashboardCharts> {
  return api.get<DashboardCharts>(`/dashboard/charts?days=${days}`);
}
