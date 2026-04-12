/**
 * Product Match API (Sell Smarter Feature)
 *
 * API client functions for Product Match feature.
 *
 * @module lib/api/productMatch
 */

import { api } from './client';

// ============================================================================
// Types
// ============================================================================

/**
 * Product type options
 */
export type ProductType = 'SAAS' | 'SERVICE' | 'SOLUTION';

/**
 * Match run status options
 */
export type ProductMatchRunStatus = 'QUEUED' | 'RUNNING' | 'DONE' | 'FAILED';

/**
 * Match badge options
 */
export type ProductMatchBadge = 'SUITABLE' | 'INFLUENCER' | 'NOT_SUITABLE';

/**
 * Explanation type options
 */
export type ExplanationType = 'DECISION_POWER' | 'COMPANY_FIT' | 'ROLE_CONTEXT' | 'RELATIONSHIP';

/**
 * Product type form options
 */
export const PRODUCT_TYPE_OPTIONS = [
  { id: 'SAAS' as ProductType, label: 'SaaS', description: 'Software as a Service product' },
  { id: 'SERVICE' as ProductType, label: 'Service', description: 'Professional or consulting service' },
  { id: 'SOLUTION' as ProductType, label: 'Solution', description: 'Complete business solution' },
] as const;

/**
 * Company size form options
 */
export const COMPANY_SIZE_OPTIONS = [
  { id: 'SMALL', label: 'Small', description: '1-50 employees' },
  { id: 'MEDIUM', label: 'Medium', description: '51-500 employees' },
  { id: 'ENTERPRISE', label: 'Enterprise', description: '500+ employees' },
  { id: 'ANY', label: 'Any Size', description: 'All company sizes' },
] as const;

/**
 * Badge thresholds
 */
export const BADGE_THRESHOLDS = {
  suitable: 70,
  influencer: 40,
} as const;

// ============================================================================
// Interfaces
// ============================================================================

/**
 * Product profile interface
 */
export interface ProductProfile {
  id: string;
  userId: string;
  productType: ProductType;
  productName: string | null;
  targetIndustry: string;
  targetCompanySize: string;
  problemSolved: string;
  decisionMakerRole: string;
  additionalContext: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Product profile input
 */
export interface ProductProfileInput {
  productType: ProductType;
  productName?: string;
  targetIndustry: string;
  targetCompanySize: string;
  problemSolved: string;
  decisionMakerRole: string;
  additionalContext?: string;
}

/**
 * Match run interface
 */
export interface ProductMatchRun {
  id: string;
  status: ProductMatchRunStatus;
  progress: number;
  totalContacts: number;
  matchCount: number;
  avgScore: number;
  error: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

/**
 * Start match run response
 */
export interface StartMatchRunResponse {
  runId: string;
  status: 'DONE' | 'RUNNING';
  matchCount?: number;
  avgScore?: number;
  totalContacts?: number;
  processingTime?: number;
}

/**
 * Explanation bullet
 */
export interface ExplanationBullet {
  type: ExplanationType;
  text: string;
}

/**
 * Component score breakdown
 */
export interface ComponentScore {
  score: number;
  weight: number;
  weighted: number;
  details: Record<string, number>;
}

/**
 * Match breakdown
 */
export interface ProductMatchBreakdown {
  decisionPower: ComponentScore;
  companyFit: ComponentScore;
  roleContext: ComponentScore;
  additional: ComponentScore;
}

/**
 * Contact summary for match results
 */
export interface MatchContactSummary {
  id: string;
  fullName: string;
  company: string | null;
  jobTitle: string | null;
  avatarUrl: string | null;
}

/**
 * Match result interface
 */
export interface ProductMatchResult {
  id: string;
  matchRunId: string;
  contactId: string;
  score: number;
  badge: ProductMatchBadge;
  explanationJson: ExplanationBullet[];
  talkAngle: string | null;
  openerMessage: string | null;
  openerEdited: string | null;
  breakdownJson: ProductMatchBreakdown;
  isSaved: boolean;
  isDismissed: boolean;
  isContacted: boolean;
  createdAt: string;
  updatedAt: string;
  contact: MatchContactSummary;
}

/**
 * Result stats summary
 */
export interface ResultStats {
  totalMatches: number;
  avgScore: number;
  suitableCount: number;
  influencerCount: number;
  notSuitableCount: number;
}

/**
 * Get results response
 */
export interface GetResultsResponse {
  run: {
    id: string;
    status: ProductMatchRunStatus;
    matchCount: number;
    avgScore: number;
    totalContacts: number;
    completedAt: string | null;
  };
  results: ProductMatchResult[];
  summary: ResultStats;
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

/**
 * Contact detail interface
 */
export interface ContactDetail {
  id: string;
  fullName: string;
  company: string | null;
  jobTitle: string | null;
  avatarUrl: string | null;
  email: string | null;
  phone: string | null;
  linkedinUrl: string | null;
  bio: string | null;
  sectors: string[];
  skills: string[];
}

/**
 * Contact detail response
 */
export interface ContactDetailResponse {
  result: ProductMatchResult;
  contact: ContactDetail;
}

/**
 * Update result input
 */
export interface UpdateResultInput {
  isSaved?: boolean;
  isDismissed?: boolean;
  isContacted?: boolean;
  openerEdited?: string;
}

// ============================================================================
// API Functions
// ============================================================================

/**
 * Get user's product profile
 */
export async function getProductProfile(): Promise<ProductProfile | null> {
  return api.get('/product-profile');
}

/**
 * Create or update product profile
 */
export async function upsertProductProfile(input: ProductProfileInput): Promise<ProductProfile> {
  return api.post('/product-profile', input);
}

/**
 * Start a new match run
 */
export async function startMatchRun(): Promise<StartMatchRunResponse> {
  return api.post('/product-match/runs');
}

/**
 * Get match run status
 */
export async function getMatchRun(runId: string): Promise<ProductMatchRun> {
  return api.get(`/product-match/runs/${runId}`);
}

/**
 * Get latest match run
 */
export async function getLatestMatchRun(): Promise<ProductMatchRun | null> {
  return api.get('/product-match/runs/latest');
}

/**
 * Get match results for a run
 */
export async function getMatchResults(
  runId: string,
  params?: {
    badge?: ProductMatchBadge;
    minScore?: number;
    excludeDismissed?: boolean;
    limit?: number;
    offset?: number;
  }
): Promise<GetResultsResponse> {
  const query = new URLSearchParams();
  if (params?.badge) query.set('badge', params.badge);
  if (params?.minScore !== undefined) query.set('minScore', String(params.minScore));
  if (params?.excludeDismissed) query.set('excludeDismissed', 'true');
  if (params?.limit) query.set('limit', String(params.limit));
  if (params?.offset) query.set('offset', String(params.offset));

  const queryStr = query.toString();
  return api.get(`/product-match/runs/${runId}/results${queryStr ? `?${queryStr}` : ''}`);
}

/**
 * Get contact match detail
 */
export async function getContactMatchDetail(contactId: string, runId: string): Promise<ContactDetailResponse> {
  return api.get(`/product-match/contacts/${contactId}?runId=${runId}`);
}

/**
 * Update match result (save, dismiss, contacted, edit message)
 */
export async function updateMatchResult(resultId: string, input: UpdateResultInput): Promise<ProductMatchResult> {
  return api.patch(`/product-match/results/${resultId}`, input);
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get badge label
 */
export function getBadgeLabel(badge: ProductMatchBadge): string {
  const labels: Record<ProductMatchBadge, string> = {
    SUITABLE: 'Suitable',
    INFLUENCER: 'Influencer',
    NOT_SUITABLE: 'Not Suitable',
  };
  return labels[badge] || badge;
}

/**
 * Get badge color classes
 */
export function getBadgeColor(badge: ProductMatchBadge): string {
  const colors: Record<ProductMatchBadge, string> = {
    SUITABLE: 'bg-green-500/20 text-green-400 border-green-500/30',
    INFLUENCER: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    NOT_SUITABLE: 'bg-neutral-500/20 text-th-text-t border-neutral-500/30',
  };
  return colors[badge] || 'bg-neutral-500/20 text-th-text-t border-neutral-500/30';
}

/**
 * Get score color based on value
 */
export function getScoreColor(score: number): string {
  if (score >= BADGE_THRESHOLDS.suitable) {
    return 'text-green-400';
  } else if (score >= BADGE_THRESHOLDS.influencer) {
    return 'text-yellow-400';
  }
  return 'text-th-text-t';
}

/**
 * Get score bar color based on value
 */
export function getScoreBarColor(score: number): string {
  if (score >= BADGE_THRESHOLDS.suitable) {
    return 'bg-green-500';
  } else if (score >= BADGE_THRESHOLDS.influencer) {
    return 'bg-yellow-500';
  }
  return 'bg-neutral-500';
}

/**
 * Get status color classes
 */
export function getStatusColor(status: ProductMatchRunStatus): string {
  const colors: Record<ProductMatchRunStatus, string> = {
    QUEUED: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    RUNNING: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    DONE: 'bg-green-500/20 text-green-400 border-green-500/30',
    FAILED: 'bg-red-500/20 text-red-400 border-red-500/30',
  };
  return colors[status] || 'bg-neutral-500/20 text-th-text-t border-neutral-500/30';
}

/**
 * Get explanation type label
 */
export function getExplanationTypeLabel(type: ExplanationType): string {
  const labels: Record<ExplanationType, string> = {
    DECISION_POWER: 'Decision Power',
    COMPANY_FIT: 'Company Fit',
    ROLE_CONTEXT: 'Role Context',
    RELATIONSHIP: 'Relationship',
  };
  return labels[type] || type;
}

/**
 * Get product type label
 */
export function getProductTypeLabel(type: ProductType): string {
  const labels: Record<ProductType, string> = {
    SAAS: 'SaaS',
    SERVICE: 'Service',
    SOLUTION: 'Solution',
  };
  return labels[type] || type;
}

/**
 * Format score as percentage text
 */
export function formatScore(score: number): string {
  return `${score}%`;
}

/**
 * Get initials from name
 */
export function getInitials(name: string): string {
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .substring(0, 2);
}
