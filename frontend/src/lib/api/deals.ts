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
 * Deal match result interface
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
 * Deal results response
 */
export interface DealResultsResponse {
  deal: Deal;
  results: DealMatchResult[];
  summary: {
    totalMatches: number;
    avgScore: number;
    topCategory: DealMatchCategory | null;
  };
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
 * Extracted deal data from document
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
  requirements?: string;
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
