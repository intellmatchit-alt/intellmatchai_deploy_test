/**
 * Pitch API
 *
 * API functions for pitch deck analysis (PNME) endpoints.
 *
 * @module lib/api/pitch
 */

import { api, getAccessToken, getAuthHeaders, ApiError } from './client';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

/**
 * Pitch status enum
 */
export type PitchStatus =
  | 'UPLOADED'
  | 'EXTRACTING'
  | 'CLASSIFYING'
  | 'ANALYZING'
  | 'BUILDING_PROFILES'
  | 'MATCHING'
  | 'GENERATING_OUTREACH'
  | 'COMPLETED'
  | 'FAILED';

/**
 * Match status enum
 */
export type MatchStatus = 'PENDING' | 'SAVED' | 'IGNORED' | 'CONTACTED' | 'ARCHIVED';

/**
 * Pitch stage
 */
export type PitchStage = 'IDEA' | 'MVP' | 'EARLY' | 'GROWTH' | 'SCALE';

/**
 * Pitch visibility
 */
export type PitchVisibility = 'PUBLIC' | 'PRIVATE' | 'CONNECTIONS_ONLY';

/**
 * Skill importance levels
 */
export type SkillImportance = 'REQUIRED' | 'PREFERRED' | 'NICE_TO_HAVE';

/**
 * Stage options (same as projects)
 */
export const STAGE_OPTIONS = [
  { id: 'IDEA', label: 'Idea' },
  { id: 'MVP', label: 'MVP' },
  { id: 'EARLY', label: 'Early Stage' },
  { id: 'GROWTH', label: 'Growth' },
  { id: 'SCALE', label: 'Scale' },
] as const;

/**
 * Looking for options (same as projects)
 */
export const LOOKING_FOR_OPTIONS = [
  { id: 'cofounder', label: 'Co-founder' },
  { id: 'investor', label: 'Investor' },
  { id: 'technical_partner', label: 'Technical Partner' },
  { id: 'business_partner', label: 'Business Partner' },
  { id: 'advisor', label: 'Advisor/Mentor' },
  { id: 'employee', label: 'Employee/Team Member' },
  { id: 'contractor', label: 'Contractor/Freelancer' },
  { id: 'customer', label: 'Early Customer' },
  { id: 'supplier', label: 'Supplier/Vendor' },
] as const;

/**
 * Match intent options (structured targets for matching engine)
 */
export const MATCH_INTENT_OPTIONS = [
  { value: 'INVESTOR', label: 'Investor' },
  { value: 'ADVISOR', label: 'Advisor' },
  { value: 'STRATEGIC_PARTNER', label: 'Strategic Partner' },
  { value: 'COFOUNDER', label: 'Co-founder' },
  { value: 'CUSTOMER_BUYER', label: 'Customer / Buyer' },
] as const;

/**
 * Support needed tag options (structured tags for matching engine)
 */
export const SUPPORT_NEEDED_OPTIONS = [
  { value: 'funding', label: 'Funding' },
  { value: 'introductions', label: 'Introductions' },
  { value: 'advisor', label: 'Advisor' },
  { value: 'strategic_partner', label: 'Strategic Partner' },
  { value: 'distribution', label: 'Distribution' },
  { value: 'technical_integration', label: 'Technical Integration' },
  { value: 'pilot_customer', label: 'Pilot Customer' },
  { value: 'design_partner', label: 'Design Partner' },
  { value: 'buyer_customer', label: 'Buyer / Customer' },
  { value: 'enterprise_access', label: 'Enterprise Access' },
  { value: 'cofounder', label: 'Co-founder' },
  { value: 'hiring', label: 'Hiring' },
  { value: 'compliance', label: 'Compliance' },
  { value: 'market_access', label: 'Market Access' },
  { value: 'growth_support', label: 'Growth Support' },
] as const;

/**
 * Currency options for funding
 */
export const CURRENCY_OPTIONS = [
  { value: 'USD', label: 'USD ($)' },
  { value: 'EUR', label: 'EUR (€)' },
  { value: 'GBP', label: 'GBP (£)' },
  { value: 'JOD', label: 'JOD' },
  { value: 'SAR', label: 'SAR' },
  { value: 'AED', label: 'AED' },
] as const;

/**
 * Pitch job progress
 */
export interface PitchJobProgress {
  step: string;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  progress: number;
  error?: string;
}

/**
 * Pitch response
 */
export interface Pitch {
  id: string;
  status: PitchStatus;
  fileName: string;
  fileType: string;
  title: string | null;
  companyName: string | null;
  summary?: string | null;
  detailedDesc?: string | null;
  category?: string | null;
  stage?: PitchStage | null;
  investmentRange?: string | null;
  timeline?: string | null;
  lookingFor?: string[];
  visibility?: PitchVisibility;
  isActive?: boolean;
  language: string;
  uploadedAt: string;
  processedAt: string | null;
  sectionsCount?: number;
  needsCount?: number;
  matchCount?: number;
  sectors?: Array<{ id: string; name: string }>;
  skillsNeeded?: Array<{ id: string; name: string; importance?: SkillImportance }>;
  problemStatement?: string | null;
  whatYouNeed?: string | null;
  metadata?: Record<string, any> | null;
  user?: {
    id: string;
    fullName: string;
    email?: string;
    company?: string | null;
    jobTitle?: string | null;
    avatarUrl?: string | null;
  };
}

/**
 * Upload pitch response
 */
export interface UploadPitchResponse {
  pitch: Pitch;
  jobs: PitchJobProgress[];
}

/**
 * Pitch status response
 */
export interface PitchStatusResponse extends Pitch {
  progress: {
    overall: number;
    currentStep: string | null;
    steps: PitchJobProgress[];
  };
}

/**
 * Contact summary in match
 */
export interface MatchContact {
  id: string;
  fullName: string;
  email?: string | null;
  phone?: string | null;
  company: string | null;
  jobTitle: string | null;
  avatarUrl: string | null;
  linkedinUrl?: string | null;
  matchScore: number | null;
}

/**
 * Match breakdown
 */
export interface MatchBreakdown {
  relevance: { score: number; weight: number; weighted: number };
  expertise: { score: number; weight: number; weighted: number };
  strategic: { score: number; weight: number; weighted: number };
  relationship: { score: number; weight: number; weighted: number };
}

/**
 * Match reason
 */
export interface MatchReason {
  type: string;
  text: string;
  evidence: string;
}

/**
 * Pitch match
 */
export interface PitchMatch {
  id: string;
  contact: MatchContact;
  score: number;
  breakdown: MatchBreakdown;
  reasons: MatchReason[];
  angleCategory: string | null;
  outreachDraft: string | null;
  status: MatchStatus;
}

/**
 * Pitch section with matches
 */
export interface PitchSection {
  id: string;
  type: string;
  order: number;
  title: string;
  content: string;
  confidence: number;
  matches: PitchMatch[];
}

/**
 * Pitch need
 */
export interface PitchNeed {
  key: string;
  label: string;
  description: string | null;
  confidence: number;
  amount: string | null;
  timeline: string | null;
}

/**
 * Pitch results response
 */
export interface PitchResultsResponse {
  pitch: Pitch;
  sections: PitchSection[];
  needs: PitchNeed[];
  summary: {
    totalMatches: number;
    avgScore: number;
    topAngle: string | null;
  };
}

/**
 * Create pitch input (form-based, no file)
 */
export interface CreatePitchInput {
  title: string;
  summary: string;
  companyName?: string;
  detailedDesc?: string;
  category?: string;
  stage?: PitchStage;
  investmentRange?: string;
  timeline?: string;
  lookingFor?: string[];
  sectorIds?: string[];
  skills?: Array<{ skillId: string; importance?: SkillImportance }>;
  visibility?: PitchVisibility;
  problemStatement?: string;
  whatYouNeed?: string;
  metadata?: Record<string, any>;
}

/**
 * Update pitch input (full update)
 */
export interface UpdatePitchInput {
  title?: string;
  companyName?: string;
  summary?: string;
  detailedDesc?: string;
  category?: string;
  stage?: PitchStage;
  investmentRange?: string;
  timeline?: string;
  lookingFor?: string[];
  sectorIds?: string[];
  skills?: Array<{ skillId: string; importance?: SkillImportance }>;
  visibility?: PitchVisibility;
  language?: string;
  isActive?: boolean;
  problemStatement?: string;
  whatYouNeed?: string;
  metadata?: Record<string, any>;
}

/**
 * AI-analyzed pitch suggestions
 */
export interface AnalyzedPitchData {
  category: string;
  stage: string;
  companyName?: string;
  lookingFor: string[];
  sectorIds: string[];
  skills: Array<{ skillId: string; importance: SkillImportance }>;
  whatYouNeed: string;
  matchIntent?: string[];
  supportNeededTags?: string[];
  tractionSummary?: string;
  founderBackgroundSummary?: string;
  fundingAmountRequested?: number | null;
  fundingCurrency?: string | null;
  confidence?: Record<string, number>;
}

/**
 * Upload a pitch deck file
 */
export async function uploadPitch(
  file: File,
  title?: string,
  language?: string
): Promise<UploadPitchResponse> {
  const formData = new FormData();
  formData.append('file', file);
  if (title) formData.append('title', title);
  if (language) formData.append('language', language);

  const response = await fetch(`${API_BASE_URL}/pitches`, {
    method: 'POST',
    headers: {
      ...getAuthHeaders(),
    },
    body: formData,
  });

  const data = await response.json();

  if (!response.ok || !data.success) {
    throw new ApiError(
      data.error?.code || 'UPLOAD_FAILED',
      data.error?.message || 'Failed to upload pitch',
      response.status
    );
  }

  return data.data;
}

/**
 * Create pitch from form (no file required)
 */
export async function createPitch(input: CreatePitchInput): Promise<Pitch> {
  return api.post('/pitches/create', input);
}

/**
 * Get pitch status and progress
 */
export function getPitchStatus(pitchId: string): Promise<PitchStatusResponse> {
  return api.get<PitchStatusResponse>(`/pitches/${pitchId}`);
}

/**
 * Get pitch results (sections with matches)
 */
export function getPitchResults(
  pitchId: string,
  options?: { sectionType?: string; minScore?: number; limit?: number }
): Promise<PitchResultsResponse> {
  const params = new URLSearchParams();
  if (options?.sectionType) params.append('sectionType', options.sectionType);
  if (options?.minScore) params.append('minScore', options.minScore.toString());
  if (options?.limit) params.append('limit', options.limit.toString());

  const query = params.toString() ? `?${params.toString()}` : '';
  return api.get<PitchResultsResponse>(`/pitches/${pitchId}/results${query}`);
}

/**
 * Update match status
 */
export function updateMatchStatus(
  matchId: string,
  status: MatchStatus,
  outreachEdited?: string
): Promise<{ id: string; status: MatchStatus }> {
  return api.patch<{ id: string; status: MatchStatus }>(`/pitch-matches/${matchId}`, {
    status,
    outreachEdited,
  });
}

/**
 * List user's pitches
 */
export function listPitches(options?: {
  status?: string;
  page?: number;
  limit?: number;
}): Promise<{ pitches: Pitch[]; total: number }> {
  const params = new URLSearchParams();
  if (options?.status) params.append('status', options.status);
  if (options?.page) params.append('page', options.page.toString());
  if (options?.limit) params.append('limit', options.limit.toString());

  const query = params.toString() ? `?${params.toString()}` : '';
  return api.get<{ pitches: Pitch[]; total: number }>(`/pitches${query}`);
}

/**
 * Regenerate outreach message for a contact match
 */
export function regenerateOutreach(
  pitchId: string,
  sectionId: string,
  contactId: string,
  options: { tone: 'professional' | 'casual' | 'warm'; focus?: string }
): Promise<{ outreachDraft: string }> {
  return api.post<{ outreachDraft: string }>(
    `/pitches/${pitchId}/sections/${sectionId}/contacts/${contactId}/outreach`,
    options
  );
}

/**
 * Extracted pitch data from document
 */
export interface ExtractedPitchData {
  title: string;
  companyName: string;
  industry: string;
  description: string;
  detailedDesc: string;
  whatYouNeed: string;
  stage: string;
  category: string;
  targetMarket: string;
  fundingAsk: string;
  timeline: string;
  lookingFor: string[];
  sectorIds: string[];
  skills: Array<{ skillId: string; importance: SkillImportance }>;
  problemStatement?: string;
  businessModel?: string[];
  targetCustomerType?: string[];
  operatingMarkets?: string[];
  matchIntent?: string[];
  supportNeededTags?: string[];
  fundingAmountRequested?: number | null;
  fundingCurrency?: string | null;
  tractionSummary?: string;
  founderBackgroundSummary?: string;
  confidence?: Record<string, number>;
}

/**
 * Extract pitch data from uploaded document using AI
 */
export async function extractPitchFromDocument(file: File): Promise<ExtractedPitchData> {
  const formData = new FormData();
  formData.append('document', file);

  const response = await fetch(`${API_BASE_URL}/pitches/extract-document`, {
    method: 'POST',
    headers: {
      ...getAuthHeaders(),
    },
    body: formData,
  });

  const data = await response.json();

  if (!response.ok || !data.success) {
    throw new ApiError(
      data.error?.code || 'EXTRACTION_FAILED',
      data.error?.message || 'Failed to extract data from document',
      response.status
    );
  }

  return data.data;
}

/**
 * Analyze pitch text with AI to suggest category, sectors, skills, lookingFor
 */
export async function analyzePitchText(input: {
  title: string;
  summary: string;
  detailedDesc?: string;
}): Promise<AnalyzedPitchData> {
  return api.post('/pitches/analyze-text', input);
}

/**
 * Find matches for a pitch (synchronous, like project matching)
 */
export function findPitchMatches(
  pitchId: string
): Promise<PitchResultsResponse & { matchCount: number }> {
  return api.post(`/pitches/${pitchId}/find-matches`, {});
}

/**
 * Update a pitch section's title and/or content
 */
export function updatePitchSection(
  pitchId: string,
  sectionId: string,
  data: { title?: string; content?: string }
): Promise<{ id: string; title: string; content: string }> {
  return api.put(`/pitches/${pitchId}/sections/${sectionId}`, data);
}

/**
 * Archive/unarchive a pitch
 */
export function archivePitch(pitchId: string, isActive: boolean): Promise<{ id: string; isActive: boolean }> {
  return api.patch(`/pitches/${pitchId}/archive`, { isActive });
}

/**
 * Delete a pitch
 */
export function deletePitch(pitchId: string): Promise<void> {
  return api.delete(`/pitches/${pitchId}`);
}

/**
 * Update pitch (full update with all fields)
 */
export function updatePitch(pitchId: string, data: UpdatePitchInput): Promise<Pitch> {
  return api.put(`/pitches/${pitchId}`, data);
}

/**
 * Discover public pitches from other users
 */
export async function discoverPitches(params?: {
  page?: number;
  limit?: number;
  category?: string;
  stage?: PitchStage;
  sector?: string;
}): Promise<{
  pitches: Pitch[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}> {
  const query = new URLSearchParams();
  if (params?.page) query.set('page', String(params.page));
  if (params?.limit) query.set('limit', String(params.limit));
  if (params?.category) query.set('category', params.category);
  if (params?.stage) query.set('stage', params.stage);
  if (params?.sector) query.set('sector', params.sector);

  const queryStr = query.toString();
  return api.get(`/pitches/discover/all${queryStr ? `?${queryStr}` : ''}`);
}
