/**
 * Deals API
 *
 * API client functions for Deal Matching feature.
 *
 * @module lib/api/deals
 */

import { api, getAuthHeaders } from './client';

/**
 * Deal mode options
 */
export type DealMode = 'SELL' | 'BUY';

/**
 * Deal status options
 */
export type DealStatus = 'DRAFT' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

/**
 * Company size options
 */
export type DealCompanySize = 'SMALL' | 'MEDIUM' | 'ENTERPRISE';

/**
 * Target entity type options (Buy mode)
 */
export type DealTargetEntityType = 'COMPANY' | 'INDIVIDUAL' | 'CONSULTANT' | 'PARTNER';

/**
 * Match status options
 */
export type DealMatchStatus = 'NEW' | 'SAVED' | 'IGNORED' | 'CONTACTED' | 'ARCHIVED';

/**
 * Match category options
 */
export type DealMatchCategory =
  // Sell mode
  | 'POTENTIAL_CLIENT'
  | 'DECISION_MAKER'
  | 'INFLUENCER'
  // Buy mode
  | 'SOLUTION_PROVIDER'
  | 'CONSULTANT'
  | 'BROKER'
  | 'PARTNER';

/**
 * Company size options for forms
 */
export const COMPANY_SIZE_OPTIONS = [
  { id: 'SMALL', label: 'Small (1-50 employees)' },
  { id: 'MEDIUM', label: 'Medium (51-500 employees)' },
  { id: 'ENTERPRISE', label: 'Enterprise (500+ employees)' },
] as const;

/**
 * Target entity options for Buy mode
 */
export const TARGET_ENTITY_OPTIONS = [
  { id: 'COMPANY', label: 'Company', description: 'A company that provides this solution' },
  { id: 'INDIVIDUAL', label: 'Individual', description: 'A freelancer or independent professional' },
  { id: 'CONSULTANT', label: 'Consultant', description: 'An advisor or consultant' },
  { id: 'PARTNER', label: 'Partner', description: 'A potential business partner' },
] as const;

/**
 * Match reason interface
 */
export interface MatchReason {
  type: string;
  text: string;
  evidence: string;
}

/**
 * Score breakdown interface
 */
export interface MatchBreakdown {
  relevance: { score: number; weight: number; weighted: number; details?: Record<string, number> };
  expertise: { score: number; weight: number; weighted: number; details?: Record<string, number> };
  strategic: { score: number; weight: number; weighted: number; details?: Record<string, number> };
  relationship: { score: number; weight: number; weighted: number; details?: Record<string, number> };
}

/**
 * Contact summary for matches
 */
export interface DealContactSummary {
  id: string;
  fullName: string;
  name?: string; // Fallback for legacy data
  email?: string | null;
  phone?: string | null;
  company?: string | null;
  jobTitle?: string | null;
  avatarUrl?: string | null;
  linkedinUrl?: string | null;
}

/**
 * Deal request interface
 */
export interface Deal {
  id: string;
  userId: string;
  mode: DealMode;
  title?: string | null;
  domain?: string | null;
  solutionType?: string | null;
  companySize?: DealCompanySize | null;
  problemStatement?: string | null;
  targetEntityType?: DealTargetEntityType | null;
  productName?: string | null;
  targetDescription?: string | null;
  status: DealStatus;
  matchCount: number;
  avgScore: number;
  isActive?: boolean;
  metadata?: Record<string, any> | null;
  createdAt: string;
  updatedAt?: string;
  progress?: DealProgress | null;
}

/**
 * Deal progress interface (for async processing)
 */
export interface DealProgress {
  overall: number;
  currentStep: string | null;
  steps: Array<{
    step: string;
    status: string;
    progress: number;
    error?: string | null;
  }>;
}

/**
 * v4.1 match band — single source of truth lives in the backend.
 * The FE displays this string directly; do NOT recompute it from score.
 */
export type DealMatchLevel = 'WEAK' | 'PARTIAL' | 'GOOD' | 'VERY_GOOD' | 'EXCELLENT';

/** v4.1 match mode — direct flows + helper flows */
export type DealMatchMode =
  | 'BUY_TO_NETWORK_SELLERS'
  | 'SELL_TO_NETWORK_BUYERS'
  | 'BUY_TO_SELLER_HELPERS'
  | 'SELL_TO_BUYER_HELPERS';

/** v4.1 hard-filter outcome */
export type DealHardFilterStatus = 'PASS' | 'REVIEW' | 'FAIL';

/** v4.1 retrieval breakdown — sub-scores fed by hybrid retrieval */
export interface DealRetrievalBreakdown {
  structuredScore: number;
  lexicalScore: number;
  semanticScore: number;
  networkScore: number;
  totalScore: number;
  evidence?: string[];
}

/** v4.1 ranking factors — multipliers used to compute effectiveRankScore */
export interface DealRankingFactors {
  confidencePenalty: number;
  reviewPenalty: number;
  sparseDataPenalty: number;
  networkBoost: number;
  readinessBoost: number;
  retrievalBoost: number;
  multiplier: number;
}

/** v4.1 component-level score breakdown (preferred over legacy MatchBreakdown). */
export interface DealScoreComponent {
  name: string;
  score: number;
  weight: number;
  confidence: number;
  explanation: string;
  matchedItems?: string[];
  missingItems?: string[];
  penalties?: string[];
}

export interface DealScoreBreakdownV4 {
  components: DealScoreComponent[];
  rawScore: number;
  normalizedScore: number;
  confidence: number;
  totalWeight: number;
  missingComponents: string[];
  penalties: string[];
}

export interface DealMatchExplanationV4 {
  summary: string;
  finalScore: number;
  scoreBand: DealMatchLevel;
  surfacedStatus?: 'PASS' | 'REVIEW' | 'SUPPRESSED';
  strengths: string[];
  weaknesses: string[];
  missingFields: string[];
  penalties: string[];
  confidenceNote: string;
  commercialFitSummary: string;
  requirementsCoverageSummary: string;
  semanticFitSummary: string;
  downgradeReason: string | null;
}

/** v4.1 network relationship between requester and counterparty (or helper) */
export interface DealNetworkRelationship {
  degree: 1 | 2 | 3 | null;
  isFirstDegree: boolean;
  isSecondDegree: boolean;
  sameOrganization: boolean;
  mutualConnections: number;
  relationshipStrength: number;
  notes?: string[];
}

/**
 * Deal match result interface (direct buy↔sell flow).
 * Legacy fields (`score`, `breakdown`, `reasons`, `category`) remain so old
 * saved matches still render. v4.1 fields are all OPTIONAL — the FE must
 * tolerate older rows without them. The displayed score everywhere is
 * `finalScore ?? score`.
 */
export interface DealMatchResult {
  id: string;
  dealRequestId: string;
  contact: DealContactSummary;
  score: number;
  category: DealMatchCategory;
  reasons: MatchReason[];
  breakdown: MatchBreakdown;
  openerMessage?: string | null;
  openerEdited?: string | null;
  status: DealMatchStatus;
  savedAt?: string | null;
  ignoredAt?: string | null;
  contactedAt?: string | null;
  createdAt: string;

  // v4.1 production fields — optional for backward compatibility
  finalScore?: number;
  deterministicScore?: number;
  aiScore?: number | null;
  effectiveRankScore?: number;
  matchLevel?: DealMatchLevel;
  matchMode?: DealMatchMode;
  confidence?: number;
  hardFilterStatus?: DealHardFilterStatus;
  hardFilterReason?: string | null;
  retrievalScore?: number;
  retrievalBreakdown?: DealRetrievalBreakdown;
  rankingFactors?: DealRankingFactors;
  scoreBreakdownV4?: DealScoreBreakdownV4;
  explanationV4?: DealMatchExplanationV4;
  aiReasoning?: string | null;
  aiGreenFlags?: string[];
  aiRedFlags?: string[];
  networkRelationship?: DealNetworkRelationship | null;
  rank?: number;
}

/** Helper / introducer match — for BUY_TO_SELLER_HELPERS / SELL_TO_BUYER_HELPERS */
export type DealHelperType = 'INSIDER' | 'INTRODUCER' | 'INFLUENCER' | 'ADVOCATE' | 'BROKER';

export interface DealHelperMatchResult {
  id: string;
  dealRequestId: string;
  matchMode: 'BUY_TO_SELLER_HELPERS' | 'SELL_TO_BUYER_HELPERS';
  helperUserId: string | null;
  helperContactId?: string | null;
  helperName: string;
  helperTitle: string | null;
  helperRoleArea: string | null;
  helperOrganization: string | null;
  helperType: DealHelperType;
  helperTypeLabel: string;
  likelyHelpType: string;

  finalScore: number;
  deterministicScore: number;
  aiScore: number | null;
  effectiveRankScore: number;
  matchLevel: DealMatchLevel;
  confidence: number;

  hardFilterStatus?: DealHardFilterStatus;
  retrievalScore?: number;
  retrievalBreakdown?: DealRetrievalBreakdown;
  rankingFactors?: DealRankingFactors;
  scoreBreakdown: DealScoreBreakdownV4;
  explanation: DealMatchExplanationV4;
  helperExplanation: string;
  strengths?: string[];
  gaps?: string[];
  matchedSignals?: string[];
  missingOrUncertainFields?: string[];
  networkRelationship?: DealNetworkRelationship | null;

  aiReasoning?: string | null;
  aiGreenFlags?: string[];
  aiRedFlags?: string[];

  rank?: number;
  status: DealMatchStatus;
  createdAt: string;
}

/**
 * Single source of truth for the displayed score on a direct match.
 * Use this everywhere (card, badge, summary, detail). Do NOT compute
 * the band locally — read `match.matchLevel` instead when present.
 */
export function getDisplayScore(m: Pick<DealMatchResult, 'finalScore' | 'score'>): number {
  return typeof m.finalScore === 'number' ? m.finalScore : m.score;
}

/**
 * Display label for v4.1 match bands. Returns null for legacy rows
 * that don't carry a matchLevel — caller may then derive a fallback
 * label or hide the band chip entirely.
 */
export function getMatchLevelLabel(level?: DealMatchLevel): string | null {
  if (!level) return null;
  return {
    EXCELLENT: 'Excellent Match',
    VERY_GOOD: 'Very Good Match',
    GOOD: 'Good Match',
    PARTIAL: 'Partial Match',
    WEAK: 'Weak Match',
  }[level];
}

/**
 * Create deal input
 */
export interface CreateDealInput {
  mode: DealMode;
  title?: string;
  domain?: string;
  solutionType?: string;
  companySize?: DealCompanySize;
  problemStatement?: string;
  targetEntityType?: DealTargetEntityType;
  productName?: string;
  targetDescription?: string;
  metadata?: Record<string, any>;
}

/**
 * Update deal input
 */
export interface UpdateDealInput {
  title?: string;
  domain?: string;
  solutionType?: string;
  companySize?: DealCompanySize;
  problemStatement?: string;
  targetEntityType?: DealTargetEntityType;
  productName?: string;
  targetDescription?: string;
  isActive?: boolean;
  metadata?: Record<string, any>;
}

/**
 * Pagination info
 */
export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/**
 * List deals response
 */
export interface ListDealsResponse {
  deals: Deal[];
  total: number;
  page: number;
  limit: number;
}

/**
 * Calculate matches response
 */
export interface CalculateMatchesResponse {
  status: DealStatus;
  matchCount?: number;
  processingTime?: number;
  jobId?: string;
  progress?: DealProgress;
}

/**
 * Deal results response.
 *
 * `results` carries direct buyer↔seller matches (existing behaviour).
 * `helperResults` (v4.1) optionally carries helper / introducer matches when
 * the engine ran a helper flow. Older responses won't include it; consumers
 * MUST tolerate its absence.
 */
export interface DealResultsResponse {
  deal: Deal;
  results: DealMatchResult[];
  helperResults?: DealHelperMatchResult[];
  summary: {
    totalMatches: number;
    avgScore: number;
    topCategory: DealMatchCategory | null;
    totalHelperMatches?: number;
    avgHelperScore?: number;
  };
  /** v4.1 engine version, when produced by v4 — useful for FE-side feature gating */
  engineVersion?: string;
}

// ============================================================================
// API Functions
// ============================================================================

/**
 * Get user's deals
 */
export async function getDeals(params?: {
  mode?: DealMode;
  status?: DealStatus;
  page?: number;
  limit?: number;
}): Promise<ListDealsResponse> {
  const query = new URLSearchParams();
  if (params?.mode) query.set('mode', params.mode);
  if (params?.status) query.set('status', params.status);
  if (params?.page) query.set('page', String(params.page));
  if (params?.limit) query.set('limit', String(params.limit));

  const queryStr = query.toString();
  return api.get(`/deals${queryStr ? `?${queryStr}` : ''}`);
}

/**
 * Create a new deal
 */
export async function createDeal(input: CreateDealInput): Promise<Deal> {
  return api.post('/deals', input);
}

/**
 * Get deal by ID
 */
export async function getDeal(id: string): Promise<Deal> {
  return api.get(`/deals/${id}`);
}

/**
 * Update a deal
 */
export async function updateDeal(id: string, input: UpdateDealInput): Promise<Deal> {
  return api.put(`/deals/${id}`, input);
}

/**
 * Delete a deal
 */
export async function deleteDeal(id: string): Promise<{ deleted: boolean }> {
  return api.delete(`/deals/${id}`);
}

/**
 * Archive or unarchive a deal
 */
export async function archiveDeal(id: string, isActive: boolean): Promise<{ id: string; isActive: boolean }> {
  return api.patch(`/deals/${id}/archive`, { isActive });
}

/**
 * Calculate matches for a deal
 */
export async function calculateDealMatches(id: string): Promise<CalculateMatchesResponse> {
  return api.post(`/deals/${id}/calculate`);
}

/**
 * Get deal results (matches)
 */
export async function getDealResults(
  id: string,
  params?: {
    minScore?: number;
    status?: DealMatchStatus;
    limit?: number;
  }
): Promise<DealResultsResponse> {
  const query = new URLSearchParams();
  if (params?.minScore) query.set('minScore', String(params.minScore));
  if (params?.status) query.set('status', params.status);
  if (params?.limit) query.set('limit', String(params.limit));

  const queryStr = query.toString();
  return api.get(`/deals/${id}/results${queryStr ? `?${queryStr}` : ''}`);
}

/**
 * Update match status
 */
export async function updateDealMatchStatus(
  resultId: string,
  input: {
    status: DealMatchStatus;
    openerEdited?: string;
  }
): Promise<DealMatchResult> {
  return api.patch(`/deal-results/${resultId}`, input);
}

/**
 * Extracted deal data from a document upload.
 *
 * v4.1 widened the contract: the backend now returns every field the
 * BUY/SELL forms collect, including the previously-missing required ones
 * (`buyingStage`, `relevantIndustry`, `industryFocus`, `idealBuyerType`).
 *
 * - Legacy fields (`requirements`, `priceRange`, `timeline`, `metadata.*`)
 *   are kept verbatim so older clients keep working.
 * - New top-level arrays + the same data under `metadata.*` are populated
 *   so either consumer pattern works.
 */
export interface ExtractedDealData {
  mode: DealMode;
  title: string;
  solutionType: string;
  domain: string;
  companySize: string;
  productName: string;
  targetDescription: string;
  problemStatement: string;
  targetEntityType: string;
  priceRange?: string;
  timeline?: string;

  /** v4.1: array form (preferred). Legacy `requirements` stays as a comma string. */
  requirementTags?: string[];
  requirements?: string;

  /** BUY only — must match exactly one of the BUYING_STAGES labels. */
  buyingStage?: string;
  /** BUY only — array of industry tags relevant to the request. */
  relevantIndustry?: string[];
  /** SELL only — array of industries the offering targets. */
  industryFocus?: string[];
  /** SELL only — buyer-persona labels (e.g. 'Budget Holder', 'C-Level'). */
  idealBuyerType?: string[];

  idealCustomerProfile?: string;
  idealProviderProfile?: string;
  targetMarketLocation?: string;
  deliveryMode?: string;
  deliveryModel?: string;

  metadata?: Record<string, any>;
}

/**
 * Extract deal data from uploaded document using AI
 */
export async function extractDealFromDocument(file: File): Promise<ExtractedDealData> {
  const formData = new FormData();
  formData.append('document', file);

  const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/deals/extract-document`, {
    method: 'POST',
    headers: {
      ...getAuthHeaders(),
    },
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Failed to extract data from document');
  }

  const result = await response.json();
  return result.data;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get category label
 */
export function getCategoryLabel(category: DealMatchCategory): string {
  const labels: Record<DealMatchCategory, string> = {
    POTENTIAL_CLIENT: 'Potential Client',
    DECISION_MAKER: 'Decision Maker',
    INFLUENCER: 'Influencer',
    SOLUTION_PROVIDER: 'Solution Provider',
    CONSULTANT: 'Consultant',
    BROKER: 'Broker',
    PARTNER: 'Partner',
  };
  return labels[category] || category;
}

/**
 * Get category color classes
 */
export function getCategoryColor(category: DealMatchCategory): string {
  const colors: Record<DealMatchCategory, string> = {
    POTENTIAL_CLIENT: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    DECISION_MAKER: 'bg-green-500/20 text-green-400 border-green-500/30',
    INFLUENCER: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    SOLUTION_PROVIDER: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    CONSULTANT: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
    BROKER: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    PARTNER: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  };
  return colors[category] || 'bg-neutral-500/20 text-th-text-t border-neutral-500/30';
}

/**
 * Get mode color classes
 */
export function getModeColor(mode: DealMode): string {
  return mode === 'SELL'
    ? 'bg-green-500/20 text-green-400 border-green-500/30'
    : 'bg-blue-500/20 text-blue-400 border-blue-500/30';
}

/**
 * Get status color classes
 */
export function getStatusColor(status: DealStatus): string {
  const colors: Record<DealStatus, string> = {
    DRAFT: 'bg-neutral-500/20 text-th-text-t border-neutral-500/30',
    PROCESSING: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    COMPLETED: 'bg-green-500/20 text-green-400 border-green-500/30',
    FAILED: 'bg-red-500/20 text-red-400 border-red-500/30',
  };
  return colors[status] || 'bg-neutral-500/20 text-th-text-t border-neutral-500/30';
}
