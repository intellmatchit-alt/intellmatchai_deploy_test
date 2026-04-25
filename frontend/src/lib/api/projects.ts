/**
 * Projects API
 *
 * API client functions for collaboration projects.
 *
 * @module lib/api/projects
 */

import { api, getAuthHeaders } from "./client";

/**
 * Project stage options
 */
export type ProjectStage = "IDEA" | "MVP" | "EARLY" | "GROWTH" | "SCALE";

/**
 * Project visibility options
 */
export type ProjectVisibility = "PUBLIC" | "PRIVATE" | "CONNECTIONS_ONLY";

/**
 * Skill importance levels
 */
export type SkillImportance = "REQUIRED" | "PREFERRED" | "NICE_TO_HAVE";

/**
 * Match status options
 */
export type MatchStatus =
  | "PENDING"
  | "CONTACTED"
  | "SAVED"
  | "DISMISSED"
  | "CONNECTED"
  | "ARCHIVED";

/**
 * Looking for options
 */
export const LOOKING_FOR_OPTIONS = [
  { id: "investor", label: "Investor" },
  { id: "advisor", label: "Advisor" },
  { id: "service_provider", label: "Service Provider" },
  { id: "strategic_partner", label: "Strategic Partner" },
  { id: "channel_distribution", label: "Channel / Distribution" },
  { id: "technical_partner", label: "Technical Partner" },
  { id: "cofounder_talent", label: "Co-founder / Talent" },
] as const;

/**
 * Stage options
 */
export const STAGE_OPTIONS = [
  { id: "IDEA", label: "Idea" },
  { id: "MVP", label: "MVP" },
  { id: "EARLY", label: "Early Stage" },
  { id: "GROWTH", label: "Growth" },
  { id: "SCALE", label: "Scale" },
] as const;

/**
 * Partner type options
 */
export const PARTNER_TYPE_OPTIONS = [
  { value: "strategic", label: "Strategic" },
  { value: "channel", label: "Channel" },
  { value: "distribution", label: "Distribution" },
  { value: "tech", label: "Tech" },
  { value: "sales", label: "Sales" },
  { value: "marketing", label: "Marketing" },
];

/**
 * Commitment level options
 */
export const COMMITMENT_LEVEL_OPTIONS = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "full_time", label: "Full Time" },
];

/**
 * Target customer type options
 */
export const TARGET_CUSTOMER_OPTIONS = [
  { value: "b2b", label: "B2B" },
  { value: "b2c", label: "B2C" },
  { value: "gov", label: "Government" },
  { value: "enterprise", label: "Enterprise" },
  { value: "sme", label: "SME" },
];

/**
 * Engagement model options
 */
export const ENGAGEMENT_MODEL_OPTIONS = [
  { value: "advisory", label: "Advisory" },
  { value: "execution", label: "Execution" },
  { value: "equity", label: "Equity" },
  { value: "paid", label: "Paid" },
  { value: "hybrid", label: "Hybrid" },
];

/**
 * Market / region options
 */
export const MARKET_OPTIONS = [
  { value: "mena", label: "MENA" },
  { value: "gcc", label: "GCC" },
  { value: "north_america", label: "North America" },
  { value: "europe", label: "Europe" },
  { value: "asia_pacific", label: "Asia Pacific" },
  { value: "latin_america", label: "Latin America" },
  { value: "africa", label: "Africa" },
  { value: "saudi_arabia", label: "Saudi Arabia" },
  { value: "uae", label: "UAE" },
  { value: "usa", label: "USA" },
  { value: "uk", label: "UK" },
  { value: "india", label: "India" },
  { value: "china", label: "China" },
  { value: "egypt", label: "Egypt" },
  { value: "jordan", label: "Jordan" },
  { value: "bahrain", label: "Bahrain" },
  { value: "kuwait", label: "Kuwait" },
  { value: "qatar", label: "Qatar" },
  { value: "oman", label: "Oman" },
  { value: "turkey", label: "Turkey" },
  { value: "germany", label: "Germany" },
  { value: "france", label: "France" },
  { value: "canada", label: "Canada" },
  { value: "australia", label: "Australia" },
  { value: "singapore", label: "Singapore" },
  { value: "japan", label: "Japan" },
  { value: "south_korea", label: "South Korea" },
  { value: "brazil", label: "Brazil" },
  { value: "nigeria", label: "Nigeria" },
  { value: "south_africa", label: "South Africa" },
  { value: "global", label: "Global" },
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
  importance?: SkillImportance;
}

/**
 * Project interface
 */
export interface Project {
  id: string;
  userId: string;
  title: string;
  summary: string;
  detailedDesc?: string | null;
  category?: string | null;
  stage: ProjectStage;
  investmentRange?: string | null;
  timeline?: string | null;
  lookingFor: string[];
  keywords: string[];
  sectors: Sector[];
  skillsNeeded: Skill[];
  visibility: ProjectVisibility;
  isActive: boolean;
  matchCount?: number;
  metadata?: Record<string, any> | null;
  needs?: string[] | null;
  markets?: string[] | null;
  fundingAskMin?: number | null;
  fundingAskMax?: number | null;
  tractionSignals?: string[] | null;
  advisoryTopics?: string[] | null;
  partnerTypeNeeded?: string[] | null;
  commitmentLevelNeeded?: string | null;
  idealCounterpartProfile?: string | null;
  targetCustomerTypes?: string[] | null;
  engagementModel?: string[] | null;
  strictLookingFor?: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * User summary for matches
 */
export interface UserSummary {
  id: string;
  fullName: string;
  email?: string;
  phone?: string | null;
  company?: string | null;
  jobTitle?: string | null;
  avatarUrl?: string | null;
  linkedinUrl?: string | null;
}

/**
 * Contact summary for matches
 */
export interface ContactSummary {
  id: string;
  fullName: string;
  email?: string | null;
  phone?: string | null;
  company?: string | null;
  jobTitle?: string | null;
  linkedinUrl?: string | null;
}

/**
 * Project match interface
 */
export interface ProjectMatch {
  id: string;
  matchScore: number;
  matchType: "user" | "contact";
  reasons: string[];
  suggestedAction?: string | null;
  suggestedMessage?: string | null;
  suggestedMessageEdited?: string | null;
  sharedSectors: string[];
  sharedSkills: string[];
  status: MatchStatus;
  matchedUser?: UserSummary | null;
  matchedContact?: ContactSummary | null;
  createdAt: string;
  // v2 advanced matching fields
  deterministicScore?: number;
  confidence?: number;
  matchLevel?: string;
  explanation?: {
    summary?: string;
    rankingDrivers?: string[];
    strongestSignals?: string[];
    missingCriticalSignals?: string[];
    cautionFlags?: string[];
    confidenceLabel?: string;
    scoreBreakdown?: Array<{ label: string; score: number }>;
  };
  scoreBreakdown?:
    | Array<{
        name: string;
        score: number;
        weight: number;
        weightedScore: number;
        explanation: string;
        confidence: number;
        evidence: string[];
        penalties: string[];
      }>
    | Record<string, number>;
  intent?: string;
  rank?: number;
}

/**
 * Create project input
 */
export interface CreateProjectInput {
  title: string;
  summary: string;
  detailedDesc?: string;
  category?: string;
  stage?: ProjectStage;
  investmentRange?: string;
  timeline?: string;
  lookingFor?: string[];
  sectorIds?: string[];
  skills?: Array<{ skillId: string; importance?: SkillImportance }>;
  visibility?: ProjectVisibility;
  metadata?: Record<string, any>;
  needs?: string[];
  markets?: string[];
  fundingAskMin?: number;
  fundingAskMax?: number;
  tractionSignals?: string[];
  advisoryTopics?: string[];
  partnerTypeNeeded?: string[];
  commitmentLevelNeeded?: string;
  idealCounterpartProfile?: string;
  targetCustomerTypes?: string[];
  engagementModel?: string[];
  strictLookingFor?: boolean;
}

/**
 * Update project input
 */
export interface UpdateProjectInput {
  title?: string;
  summary?: string;
  detailedDesc?: string;
  category?: string;
  stage?: ProjectStage;
  investmentRange?: string;
  timeline?: string;
  lookingFor?: string[];
  sectorIds?: string[];
  skills?: Array<{ skillId: string; importance?: SkillImportance }>;
  visibility?: ProjectVisibility;
  isActive?: boolean;
  metadata?: Record<string, any>;
  needs?: string[];
  markets?: string[];
  fundingAskMin?: number;
  fundingAskMax?: number;
  tractionSignals?: string[];
  advisoryTopics?: string[];
  partnerTypeNeeded?: string[];
  commitmentLevelNeeded?: string;
  idealCounterpartProfile?: string;
  targetCustomerTypes?: string[];
  engagementModel?: string[];
  strictLookingFor?: boolean;
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
 * Get user's projects
 */
export async function getProjects(params?: {
  page?: number;
  limit?: number;
  status?: "active" | "inactive" | "all";
}): Promise<{ projects: Project[]; pagination: Pagination }> {
  const query = new URLSearchParams();
  if (params?.page) query.set("page", String(params.page));
  if (params?.limit) query.set("limit", String(params.limit));
  if (params?.status) query.set("status", params.status);

  const queryStr = query.toString();
  return api.get(`/projects${queryStr ? `?${queryStr}` : ""}`);
}

/**
 * Create a new project
 */
export async function createProject(
  input: CreateProjectInput,
): Promise<Project> {
  return api.post("/projects", input);
}

/**
 * Get project by ID
 */
export async function getProject(
  id: string,
): Promise<Project & { matches: ProjectMatch[] }> {
  return api.get(`/projects/${id}`);
}

/**
 * Update a project
 */
export async function updateProject(
  id: string,
  input: UpdateProjectInput,
): Promise<Project> {
  return api.put(`/projects/${id}`, input);
}

/**
 * Delete a project
 */
export async function deleteProject(id: string): Promise<{ message: string }> {
  return api.delete(`/projects/${id}`);
}

/**
 * Async job response
 */
export interface AsyncJobResponse {
  jobId: string;
  status: "queued";
  message: string;
}

/**
 * Job status response
 */
export interface JobStatusResponse {
  id: string;
  name: string;
  status: "waiting" | "active" | "completed" | "failed" | "delayed";
  progress: number;
  data: unknown;
  result?: unknown;
  error?: string;
  createdAt: string;
  processedAt?: string;
  finishedAt?: string;
}

/**
 * Find matches for a project (trigger AI matching)
 * @param projectId - Project ID
 * @param async - If true, run matching in background and return job ID
 */
export async function findProjectMatches(
  projectId: string,
  async?: boolean,
): Promise<{ matchCount: number; matches: ProjectMatch[] } | AsyncJobResponse> {
  const query = async ? "?async=true" : "";
  return api.post(`/projects/${projectId}/find-matches${query}`);
}

/**
 * Get project match job status
 */
export async function getProjectMatchJobStatus(
  projectId: string,
  jobId: string,
): Promise<JobStatusResponse> {
  return api.get(`/projects/${projectId}/match-status/${jobId}`);
}

/**
 * Get matches for a project
 */
export async function getProjectMatches(
  projectId: string,
  params?: {
    type?: "user" | "contact" | "all";
    status?: MatchStatus;
    minScore?: number;
  },
): Promise<{ matches: ProjectMatch[] }> {
  const query = new URLSearchParams();
  if (params?.type) query.set("type", params.type);
  if (params?.status) query.set("status", params.status);
  if (params?.minScore) query.set("minScore", String(params.minScore));

  const queryStr = query.toString();
  return api.get(
    `/projects/${projectId}/matches${queryStr ? `?${queryStr}` : ""}`,
  );
}

/**
 * Update match status
 */
export async function updateMatchStatus(
  projectId: string,
  matchId: string,
  status: MatchStatus,
): Promise<ProjectMatch> {
  return api.put(`/projects/${projectId}/matches/${matchId}/status`, {
    status,
  });
}

/**
 * Save edited ice breakers for a project match
 */
export async function updateMatchIceBreakers(
  projectId: string,
  matchId: string,
  suggestedMessageEdited: string,
): Promise<ProjectMatch> {
  return api.put(`/projects/${projectId}/matches/${matchId}/status`, {
    suggestedMessageEdited,
  });
}

/**
 * AI-analyzed project suggestions
 */
export interface AnalyzedProjectData {
  category: string;
  stage: string;
  idealCounterpartProfile?: string;
  lookingFor: string[];
  sectorIds: string[];
  skills: Array<{ skillId: string; importance: SkillImportance }>;
  whatYouNeed: string;
  needs?: string[];
  markets?: string[];
  partnerTypeNeeded?: string[];
  commitmentLevelNeeded?: string;
  engagementModel?: string[];
  targetCustomerTypes?: string[];
  tractionSignals?: string[];
  advisoryTopics?: string[];
}

export async function analyzeProjectText(input: {
  title: string;
  summary: string;
  detailedDesc?: string;
}): Promise<AnalyzedProjectData> {
  return api.post("/projects/analyze-text", input);
}

/**
 * Extract project data from document
 */
export interface ExtractedProjectData {
  title: string;
  summary: string;
  detailedDesc: string;
  whatYouNeed: string;
  category: string;
  stage: ProjectStage;
  investmentRange?: string;
  timeline: string;
  lookingFor: string[];
  sectorIds: string[];
  skills: Array<{ skillId: string; importance: SkillImportance }>;
  keywords: string[];
  operatingMarkets?: string[];
  needs?: string[];
  markets?: string[];
  tractionSignals?: string[];
  advisoryTopics?: string[];
  fundingAskMin?: number | null;
  fundingAskMax?: number | null;
  idealCounterpartProfile?: string;
  partnerTypeNeeded?: string[];
  commitmentLevelNeeded?: string;
  engagementModel?: string[];
  targetCustomerTypes?: string[];
  _extracted: {
    sectors: string[];
    skills: string[];
  };
}

export async function extractFromDocument(
  file: File,
): Promise<ExtractedProjectData> {
  const formData = new FormData();
  formData.append("document", file);

  const response = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL}/projects/extract-document`,
    {
      method: "POST",
      headers: {
        ...getAuthHeaders(),
      },
      body: formData,
    },
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(
      error.error?.message || "Failed to extract data from document",
    );
  }

  const result = await response.json();
  return result.data;
}

/**
 * Discover public projects from other users
 */
export async function discoverProjects(params?: {
  page?: number;
  limit?: number;
  category?: string;
  stage?: ProjectStage;
  sector?: string;
}): Promise<{
  projects: Array<Project & { user: UserSummary }>;
  pagination: Pagination;
}> {
  const query = new URLSearchParams();
  if (params?.page) query.set("page", String(params.page));
  if (params?.limit) query.set("limit", String(params.limit));
  if (params?.category) query.set("category", params.category);
  if (params?.stage) query.set("stage", params.stage);
  if (params?.sector) query.set("sector", params.sector);

  const queryStr = query.toString();
  return api.get(`/projects/discover/all${queryStr ? `?${queryStr}` : ""}`);
}
