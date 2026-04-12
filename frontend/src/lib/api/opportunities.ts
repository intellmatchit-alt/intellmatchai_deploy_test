/**
 * Opportunities API
 *
 * API client functions for job opportunity management and matching.
 * Supports multiple opportunities per user with AI-powered matching.
 *
 * @module lib/api/opportunities
 */

import { api, getAuthHeaders } from './client';

/**
 * Opportunity intent type options
 */
export type OpportunityIntentType =
  | 'HIRING'
  | 'OPEN_TO_OPPORTUNITIES'
  | 'ADVISORY_BOARD'
  | 'REFERRALS_ONLY';

/**
 * Opportunity visibility options
 */
export type OpportunityVisibility = 'PRIVATE' | 'LIMITED' | 'TEAM';

/**
 * Seniority level options
 */
export type SeniorityLevel =
  | 'ENTRY'
  | 'MID'
  | 'SENIOR'
  | 'LEAD'
  | 'DIRECTOR'
  | 'VP'
  | 'C_LEVEL'
  | 'BOARD';

/**
 * Match status options
 */
export type OpportunityMatchStatus =
  | 'PENDING'
  | 'CONTACTED'
  | 'INTRODUCED'
  | 'SAVED'
  | 'DISMISSED'
  | 'CONNECTED'
  | 'ARCHIVED';

/**
 * Intent type options for UI
 */
export const INTENT_TYPE_OPTIONS = [
  {
    id: 'HIRING' as OpportunityIntentType,
    label: 'Hiring',
    icon: 'PersonAdd24Regular',
    description: 'Looking to hire talent for your team',
  },
  {
    id: 'OPEN_TO_OPPORTUNITIES' as OpportunityIntentType,
    label: 'Open to Opportunities',
    icon: 'Briefcase24Regular',
    description: 'Exploring new career opportunities',
  },
] as const;

/**
 * Seniority level options for UI
 */
export const SENIORITY_OPTIONS = [
  { id: 'ENTRY' as SeniorityLevel, label: 'Entry Level' },
  { id: 'MID' as SeniorityLevel, label: 'Mid Level' },
  { id: 'SENIOR' as SeniorityLevel, label: 'Senior' },
  { id: 'LEAD' as SeniorityLevel, label: 'Lead / Principal' },
  { id: 'DIRECTOR' as SeniorityLevel, label: 'Director' },
  { id: 'VP' as SeniorityLevel, label: 'VP / Vice President' },
  { id: 'C_LEVEL' as SeniorityLevel, label: 'C-Level Executive' },
  { id: 'BOARD' as SeniorityLevel, label: 'Board Member' },
] as const;

/**
 * Visibility options for UI
 */
export const VISIBILITY_OPTIONS = [
  {
    id: 'PRIVATE' as OpportunityVisibility,
    label: 'Private',
    description: 'Only you can see this opportunity',
  },
  {
    id: 'LIMITED' as OpportunityVisibility,
    label: 'Connections Only',
    description: 'Visible to your existing connections',
  },
  {
    id: 'TEAM' as OpportunityVisibility,
    label: 'Team',
    description: 'Visible to your team members',
  },
] as const;

/**
 * Match status options for UI
 */
export const MATCH_STATUS_OPTIONS = [
  { id: 'PENDING' as OpportunityMatchStatus, label: 'Pending', color: 'gray' },
  { id: 'CONTACTED' as OpportunityMatchStatus, label: 'Contacted', color: 'blue' },
  { id: 'INTRODUCED' as OpportunityMatchStatus, label: 'Intro Requested', color: 'purple' },
  { id: 'SAVED' as OpportunityMatchStatus, label: 'Saved', color: 'yellow' },
  { id: 'DISMISSED' as OpportunityMatchStatus, label: 'Dismissed', color: 'red' },
  { id: 'CONNECTED' as OpportunityMatchStatus, label: 'Connected', color: 'green' },
] as const;

/**
 * Sector interface
 */
export interface Sector {
  id: string;
  name: string;
  nameAr?: string;
}

/**
 * Skill interface
 */
export interface Skill {
  id: string;
  name: string;
  nameAr?: string;
  isRequired?: boolean;
}

/**
 * Opportunity interface (supports multiple per user)
 */
export interface Opportunity {
  id: string;
  userId: string;
  title: string;
  intentType: OpportunityIntentType;
  roleArea?: string | null;
  seniority?: SeniorityLevel | null;
  locationPref?: string | null;
  remoteOk: boolean;
  notes?: string | null;
  visibility: OpportunityVisibility;
  isActive: boolean;
  lastMatchedAt?: string | null;
  sectors: Sector[];
  skills: Skill[];
  matchCount?: number;
  workMode?: string | null;
  employmentType?: string | null;
  urgencyOrAvailability?: string | null;
  minExperienceYears?: number | null;
  languages?: string[] | null;
  certifications?: string[] | null;
  educationLevels?: string[] | null;
  industries?: string[] | null;
  salaryMin?: number | null;
  salaryMax?: number | null;
  salaryCurrency?: string | null;
  noticePeriod?: string | null;
  relevantExperience?: string | null;
  createdAt: string;
  updatedAt?: string;
}

/**
 * Match candidate interface
 */
export interface MatchCandidate {
  type: 'user' | 'contact';
  id: string;
  fullName: string;
  jobTitle?: string | null;
  company?: string | null;
  avatarUrl?: string | null;
  location?: string | null;
  bio?: string | null;
  email?: string | null;
  phone?: string | null;
  linkedinUrl?: string | null;
}

/**
 * Opportunity match interface
 */
export interface OpportunityMatch {
  id: string;
  opportunityId: string;
  opportunityTitle?: string;
  matchScore: number;
  matchType: 'user' | 'contact';
  status: OpportunityMatchStatus;
  reasons: string[];
  suggestedAction?: string | null;
  suggestedMessage?: string | null;
  nextSteps?: string[] | null;
  sharedSectors: string[];
  sharedSkills: string[];
  intentAlignment?: string | null;
  contactedAt?: string | null;
  createdAt: string;
  candidate: MatchCandidate;
  // V3 fields
  explanation?: string | null;
  matchLevel?: string | null;
  confidence?: string | null;
  confidenceScore?: number | null;
  hardFilterStatus?: string | null;
  missingSkills?: string[];
  risks?: string[];
  scoreBreakdown?: Array<{
    name: string;
    score: number;
    weight: number;
    weightedScore: number;
    explanation: string;
    confidence: number;
    evidence: string[];
    penalties: string[];
  }> | null;
}

/**
 * Create opportunity input
 */
export interface CreateOpportunityInput {
  title: string;
  intentType: OpportunityIntentType;
  roleArea?: string;
  seniority?: SeniorityLevel;
  locationPref?: string;
  remoteOk?: boolean;
  notes?: string;
  visibility?: OpportunityVisibility;
  sectorIds?: string[];
  skillIds?: string[];
  mustHaveSkillIds?: string[];
  preferredSkillIds?: string[];
  workMode?: string;
  employmentType?: string;
  urgencyOrAvailability?: string;
  minExperienceYears?: number;
  languages?: string[];
  certifications?: string[];
  educationLevels?: string[];
  industries?: string[];
  salaryMin?: number;
  salaryMax?: number;
  salaryCurrency?: string;
  noticePeriod?: string;
  relevantExperience?: string;
}

/**
 * Update opportunity input
 */
export interface UpdateOpportunityInput {
  title?: string;
  intentType?: OpportunityIntentType;
  roleArea?: string;
  seniority?: SeniorityLevel;
  locationPref?: string;
  remoteOk?: boolean;
  notes?: string;
  visibility?: OpportunityVisibility;
  isActive?: boolean;
  sectorIds?: string[];
  skillIds?: string[];
  mustHaveSkillIds?: string[];
  preferredSkillIds?: string[];
  workMode?: string;
  employmentType?: string;
  urgencyOrAvailability?: string;
  minExperienceYears?: number;
  languages?: string[];
  certifications?: string[];
  educationLevels?: string[];
  industries?: string[];
  salaryMin?: number;
  salaryMax?: number;
  salaryCurrency?: string;
  noticePeriod?: string;
  relevantExperience?: string;
}

/**
 * List opportunities query params
 */
export interface ListOpportunitiesParams {
  page?: number;
  limit?: number;
  status?: 'active' | 'inactive' | 'all';
}

/**
 * Match query parameters
 */
export interface MatchQueryParams {
  status?: OpportunityMatchStatus;
  minScore?: number;
  limit?: number;
}

/**
 * All matches query parameters
 */
export interface AllMatchesQueryParams extends MatchQueryParams {
  opportunityId?: string;
  intentType?: OpportunityIntentType;
  sortBy?: 'score' | 'date';
  sortOrder?: 'asc' | 'desc';
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
 * Match statistics
 */
export interface MatchStats {
  totalOpportunities: number;
  totalMatches: number;
  averageScore: number;
  byStatus: {
    pending: number;
    contacted: number;
    introduced: number;
    saved: number;
    dismissed: number;
    connected: number;
  };
}

/**
 * Extracted opportunity data from document
 */
export interface ExtractedOpportunityData {
  title: string;
  intentType: string;
  roleArea: string;
  seniority: string;
  locationPref: string;
  remoteOk: boolean;
  notes: string;
  sectorIds: string[];
  skillIds: string[];
  mustHaveSkillIds?: string[];
  preferredSkillIds?: string[];
  workMode?: string;
  employmentType?: string;
  urgencyOrAvailability?: string;
  minExperienceYears?: number;
  languages?: string[];
  certifications?: string[];
  educationLevels?: string[];
  industries?: string[];
  salaryMin?: number | null;
  salaryMax?: number | null;
  salaryCurrency?: string | null;
  salaryPeriod?: string | null;
  noticePeriod?: string | null;
  relevantExperience?: string | null;
  fieldSources?: Record<string, string>;
}

/**
 * Extract opportunity data from uploaded document using AI
 */
export async function extractJobFromDocument(file: File): Promise<ExtractedOpportunityData> {
  const formData = new FormData();
  formData.append('document', file);

  const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/opportunities/extract-document`, {
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
// OPPORTUNITY CRUD OPERATIONS
// ============================================================================

/**
 * List all user's opportunities
 */
export async function listOpportunities(
  params?: ListOpportunitiesParams
): Promise<{
  opportunities: Opportunity[];
  pagination: Pagination;
}> {
  const queryParams = params
    ? `?${new URLSearchParams(
        Object.entries(params)
          .filter(([, v]) => v !== undefined)
          .map(([k, v]) => [k, String(v)])
      ).toString()}`
    : '';
  return api.get<{
    opportunities: Opportunity[];
    pagination: Pagination;
  }>(`/opportunities${queryParams}`);
}

/**
 * Get single opportunity by ID
 */
export async function getOpportunity(id: string): Promise<Opportunity> {
  return api.get<Opportunity>(`/opportunities/${id}`);
}

/**
 * Create a new opportunity
 */
export async function createOpportunity(input: CreateOpportunityInput): Promise<Opportunity> {
  return api.post<Opportunity>('/opportunities', input);
}

/**
 * Update an opportunity
 */
export async function updateOpportunity(
  id: string,
  input: UpdateOpportunityInput
): Promise<Opportunity> {
  return api.put<Opportunity>(`/opportunities/${id}`, input);
}

/**
 * Delete an opportunity
 */
export async function deleteOpportunity(id: string): Promise<{ message: string }> {
  return api.delete<{ message: string }>(`/opportunities/${id}`);
}

// ============================================================================
// MATCHING OPERATIONS
// ============================================================================

/**
 * Find matches for a specific opportunity
 */
export async function findOpportunityMatches(
  opportunityId: string
): Promise<{ matchCount: number; matches: OpportunityMatch[] }> {
  return api.post<{ matchCount: number; matches: OpportunityMatch[] }>(
    `/opportunities/${opportunityId}/find-matches`
  );
}

/**
 * Get matches for a specific opportunity
 */
export async function getOpportunityMatches(
  opportunityId: string,
  params?: MatchQueryParams
): Promise<{
  matches: OpportunityMatch[];
  opportunity: {
    id: string;
    title: string;
    intentType: OpportunityIntentType;
    lastMatchedAt: string | null;
  };
}> {
  const queryParams = params
    ? `?${new URLSearchParams(
        Object.entries(params)
          .filter(([, v]) => v !== undefined)
          .map(([k, v]) => [k, String(v)])
      ).toString()}`
    : '';
  return api.get<{
    matches: OpportunityMatch[];
    opportunity: {
      id: string;
      title: string;
      intentType: OpportunityIntentType;
      lastMatchedAt: string | null;
    };
  }>(`/opportunities/${opportunityId}/matches${queryParams}`);
}

/**
 * Get all matches across all opportunities
 */
export async function getAllMatches(
  params?: AllMatchesQueryParams
): Promise<{
  matches: OpportunityMatch[];
  pagination: Pagination;
  stats: {
    total: number;
    byStatus: Record<OpportunityMatchStatus, number>;
    byIntentType: Record<OpportunityIntentType, number>;
  };
}> {
  const queryParams = params
    ? `?${new URLSearchParams(
        Object.entries(params)
          .filter(([, v]) => v !== undefined)
          .map(([k, v]) => [k, String(v)])
      ).toString()}`
    : '';
  return api.get<{
    matches: OpportunityMatch[];
    pagination: Pagination;
    stats: {
      total: number;
      byStatus: Record<OpportunityMatchStatus, number>;
      byIntentType: Record<OpportunityIntentType, number>;
    };
  }>(`/opportunities/matches/all${queryParams}`);
}

/**
 * Update match status
 */
export async function updateMatchStatus(
  opportunityId: string,
  matchId: string,
  status: OpportunityMatchStatus
): Promise<OpportunityMatch> {
  return api.put<OpportunityMatch>(`/opportunities/${opportunityId}/matches/${matchId}/status`, {
    status,
  });
}

/**
 * Save edited ice breakers for an opportunity match
 */
export async function updateMatchIceBreakers(
  opportunityId: string,
  matchId: string,
  suggestedMessageEdited: string
): Promise<OpportunityMatch> {
  return api.put<OpportunityMatch>(`/opportunities/${opportunityId}/matches/${matchId}/status`, {
    suggestedMessageEdited,
  });
}

/**
 * Request warm introduction for a match
 */
export async function requestWarmIntro(
  opportunityId: string,
  matchId: string,
  message?: string
): Promise<{ message: string; matchId: string; status: string }> {
  return api.post<{ message: string; matchId: string; status: string }>(
    `/opportunities/${opportunityId}/matches/${matchId}/request-intro`,
    { message }
  );
}

// ============================================================================
// STATISTICS
// ============================================================================

/**
 * Get overall stats for all user's opportunities
 */
export async function getOpportunitiesStats(): Promise<MatchStats> {
  return api.get<MatchStats>('/opportunities/stats');
}

// ============================================================================
// LEGACY SUPPORT (for backward compatibility)
// ============================================================================

/** @deprecated Use listOpportunities instead */
export async function getIntent(): Promise<Opportunity | null> {
  const result = await listOpportunities({ status: 'active', limit: 1 });
  return result.opportunities[0] || null;
}

/** @deprecated Use createOpportunity instead */
export async function createOrUpdateIntent(input: CreateOpportunityInput): Promise<Opportunity> {
  return createOpportunity(input);
}

/** @deprecated Use deleteOpportunity instead */
export async function deactivateIntent(): Promise<{ message: string }> {
  const active = await getIntent();
  if (active) {
    return deleteOpportunity(active.id);
  }
  return { message: 'No active opportunity found' };
}

/** @deprecated Use findOpportunityMatches instead */
export async function findMatches(): Promise<{ matchCount: number; matches: OpportunityMatch[] }> {
  const active = await getIntent();
  if (active) {
    return findOpportunityMatches(active.id);
  }
  return { matchCount: 0, matches: [] };
}

/** @deprecated Use getOpportunityMatches or getAllMatches instead */
export async function getMatches(
  params?: MatchQueryParams
): Promise<{
  matches: OpportunityMatch[];
  hasIntent: boolean;
  intentType?: OpportunityIntentType;
  lastMatchedAt?: string | null;
}> {
  const active = await getIntent();
  if (!active) {
    return { matches: [], hasIntent: false };
  }
  const result = await getOpportunityMatches(active.id, params);
  return {
    matches: result.matches,
    hasIntent: true,
    intentType: result.opportunity.intentType,
    lastMatchedAt: result.opportunity.lastMatchedAt,
  };
}

/** @deprecated Use getOpportunitiesStats instead */
export async function getStats(): Promise<{
  hasIntent: boolean;
  intentType?: OpportunityIntentType;
  lastMatchedAt?: string | null;
  stats: MatchStats | null;
}> {
  const active = await getIntent();
  const stats = await getOpportunitiesStats();
  return {
    hasIntent: !!active,
    intentType: active?.intentType,
    lastMatchedAt: active?.lastMatchedAt,
    stats,
  };
}

// Re-export for backward compatibility
export type OpportunityIntent = Opportunity;
