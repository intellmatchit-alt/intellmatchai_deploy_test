/**
 * API Module
 *
 * @module lib/api
 */

export * from './client';
export * from './auth';
export * from './contacts';
export * from './scan';
export * from './matches';
export {
  getNetwork,
  getClusters,
  getUnderutilized,
  getStats as getGraphStats,
  findPath,
  type GraphNode,
  type GraphEdge,
  type NetworkData,
  type Cluster,
  type ClustersResponse,
  type UnderutilizedContact,
  type UnderutilizedResponse,
  type NetworkStats,
} from './graph';
export {
  getDashboard,
  getStats as getDashboardStats,
  getActivityTimeline,
  getNetworkHealth,
  getGoalsProgress,
  getChartData,
  type ComparisonPeriod,
  type StatWithComparison,
  type DashboardStats,
  type ActivityType,
  type ActivityItem,
  type NetworkHealth,
  type GoalProgress,
  type GoalsProgress,
  type ChartDataPoint,
  type InteractionTypeCount,
  type SectorCount,
  type ScoreRangeCount,
  type DashboardCharts,
  type DashboardData,
} from './dashboard';
export * from './projects';
export * from './productMatch';
export * from './import';
