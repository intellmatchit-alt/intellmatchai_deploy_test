/**
 * Itemized Matching Types
 *
 * TypeScript interfaces for itemized explainable matching components.
 *
 * @module components/features/itemized-matching/types
 */

/**
 * Criterion importance levels
 */
export type CriterionImportance = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

/**
 * Match status thresholds
 */
export type MatchStatus =
  | 'PERFECT'    // 95-100%
  | 'EXCELLENT'  // 80-94%
  | 'STRONG'     // 60-79%
  | 'MODERATE'   // 40-59%
  | 'WEAK'       // 20-39%
  | 'NO_MATCH';  // 0-19%

/**
 * Match type indicating relationship
 */
export type MatchType = 'EXACT' | 'PARTIAL' | 'COMPLEMENTARY' | 'NONE';

/**
 * Entity reference
 */
export interface EntityRef {
  id: string;
  type: 'USER' | 'CONTACT' | 'PROJECT' | 'JOB' | 'DEAL' | 'EVENT_ATTENDEE';
  name: string;
  avatarUrl?: string;
}

/**
 * Explanation with source/target value quoting
 */
export interface CriterionExplanation {
  summary: string;
  sourceValue?: string;
  targetValue?: string;
  details?: string[];
  matchedItems?: string[];
  complementaryNote?: string;
}

/**
 * Single criterion match result
 */
export interface CriterionMatch {
  id: string;
  name: string;
  importance: CriterionImportance;
  score: number;
  status: MatchStatus;
  matchType: MatchType;
  explanation: CriterionExplanation;
  icon?: string;
  color?: string;
}

/**
 * Suggested action for follow-up
 */
export interface SuggestedAction {
  type: 'APPROACH' | 'CONNECT' | 'MESSAGE' | 'SCHEDULE' | 'SHARE';
  label: string;
  description?: string;
  priority: 'high' | 'medium' | 'low';
}

/**
 * Match summary statistics
 */
export interface MatchSummary {
  perfectMatches: number;
  excellentMatches: number;
  strongMatches: number;
  moderateMatches: number;
  weakMatches: number;
  noMatches: number;
  criticalMet: number;
  criticalTotal: number;
  totalCriteria?: number;
}

/**
 * Ice breaker suggestion
 */
export interface IceBreaker {
  text: string;
  basedOn: string;
  relevance: number;
}

/**
 * Suggested action (backend format)
 */
export interface BackendSuggestedAction {
  action: string;
  reason: string;
  messageTemplate?: string;
  priority?: 'HIGH' | 'MEDIUM' | 'LOW';
}

/**
 * Full itemized match result
 */
export interface ItemizedMatchResult {
  matchId: string;
  matchType: 'PROFILE_TO_PROFILE' | 'PROFILE_TO_USER' | 'PROJECT_TO_INVESTOR' | 'PROJECT_TO_PARTNER' | 'PROJECT_TO_TALENT' | 'PROJECT_TO_DYNAMIC' | 'JOB_TO_CANDIDATE' | 'DEAL_TO_BUYER' | 'DEAL_TO_PROVIDER' | 'EVENT_ATTENDEE_MATCH' | 'OPPORTUNITY_TO_CANDIDATE' | 'PITCH_TO_CONTACT';
  source: EntityRef;
  target: EntityRef;
  criteria: CriterionMatch[];
  summary: MatchSummary;
  concerns: string[];
  suggestedAction?: BackendSuggestedAction;
  iceBreakers: IceBreaker[];
  calculatedAt: string | Date;
  expiresAt?: string | Date;
  confidence?: number;
  matchQuality?: 'HIGH' | 'MEDIUM' | 'LOW';
}

/**
 * Batch match result (lighter weight for list views)
 */
export interface BatchMatchResult {
  contactId: string;
  contactName: string;
  avatarUrl?: string;
  company?: string;
  jobTitle?: string;
  summary: MatchSummary;
  topCriteria: Array<{
    name: string;
    status: MatchStatus;
    score: number;
  }>;
}

/**
 * Props for CriterionScoreItem component
 */
export interface CriterionScoreItemProps {
  criterion: CriterionMatch;
  expanded?: boolean;
  onToggle?: () => void;
  showDetails?: boolean;
}

/**
 * Props for ItemizedMatchCard component
 */
export interface ItemizedMatchCardProps {
  match: ItemizedMatchResult;
  compact?: boolean;
  showActions?: boolean;
  onViewProfile?: (targetId: string) => void;
  onConnect?: (targetId: string) => void;
  onMessage?: (targetId: string) => void;
}

/**
 * Props for MatchSummaryBadges component
 */
export interface MatchSummaryBadgesProps {
  summary: MatchSummary;
  matchQuality?: 'HIGH' | 'MEDIUM' | 'LOW';
  compact?: boolean;
}

/**
 * Status configuration for UI
 */
export interface StatusConfig {
  color: string;
  bgColor: string;
  borderColor: string;
  label: string;
  icon: string;
}

/**
 * Status color/label mapping
 */
export const STATUS_CONFIG: Record<MatchStatus, StatusConfig> = {
  PERFECT: {
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-500/20',
    borderColor: 'border-emerald-500/30',
    label: 'Perfect',
    icon: '✓✓',
  },
  EXCELLENT: {
    color: 'text-green-400',
    bgColor: 'bg-green-500/20',
    borderColor: 'border-green-500/30',
    label: 'Excellent',
    icon: '✓',
  },
  STRONG: {
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/20',
    borderColor: 'border-blue-500/30',
    label: 'Strong',
    icon: '◆',
  },
  MODERATE: {
    color: 'text-yellow-400',
    bgColor: 'bg-yellow-500/20',
    borderColor: 'border-yellow-500/30',
    label: 'Moderate',
    icon: '○',
  },
  WEAK: {
    color: 'text-red-400',
    bgColor: 'bg-red-500/20',
    borderColor: 'border-red-500/30',
    label: 'Weak',
    icon: '△',
  },
  NO_MATCH: {
    color: 'text-red-400',
    bgColor: 'bg-red-500/15',
    borderColor: 'border-red-500/25',
    label: 'No Match',
    icon: '✗',
  },
};

/**
 * Importance color mapping
 */
export const IMPORTANCE_CONFIG: Record<CriterionImportance, { color: string; label: string }> = {
  CRITICAL: { color: 'text-red-400', label: 'Critical' },
  HIGH: { color: 'text-yellow-400', label: 'High' },
  MEDIUM: { color: 'text-yellow-400', label: 'Medium' },
  LOW: { color: 'text-th-text-t', label: 'Low' },
};
