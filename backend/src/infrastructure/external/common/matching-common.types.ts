/**
 * Shared Matching Common Types
 *
 * Single source of truth for types, enums, and interfaces shared across
 * all matching engines (project, job, deal, pitch).
 *
 * @module common/matching-common.types
 */

// ============================================================================
// MATCH LEVEL
// ============================================================================

export enum MatchLevel {
  POOR = 'POOR',
  WEAK = 'WEAK',
  GOOD = 'GOOD',
  VERY_GOOD = 'VERY_GOOD',
  EXCELLENT = 'EXCELLENT',
}

// ============================================================================
// HARD FILTER
// ============================================================================

export enum HardFilterStatus {
  PASS = 'PASS',
  FAIL = 'FAIL',
  REVIEW = 'REVIEW',
}

export enum HardFilterReason {
  NONE = 'NONE',
  BLOCKED = 'BLOCKED',
  OPT_OUT = 'OPT_OUT',
  FAMILY_INCOMPATIBLE = 'FAMILY_INCOMPATIBLE',
  GEOGRAPHY_INCOMPATIBLE = 'GEOGRAPHY_INCOMPATIBLE',
  BUDGET_INCOMPATIBLE = 'BUDGET_INCOMPATIBLE',
  TIMELINE_INCOMPATIBLE = 'TIMELINE_INCOMPATIBLE',
  CATEGORY_MISMATCH = 'CATEGORY_MISMATCH',
  REQUIREMENTS_NOT_MET = 'REQUIREMENTS_NOT_MET',
  SPARSE_DATA = 'SPARSE_DATA',
  LOW_DATA_QUALITY = 'LOW_DATA_QUALITY',
  PROVIDER_TYPE_MISMATCH = 'PROVIDER_TYPE_MISMATCH',
  DELIVERY_MISMATCH = 'DELIVERY_MISMATCH',
  LOCATION_MISMATCH = 'LOCATION_MISMATCH',
}

// ============================================================================
// CONFIDENCE LEVEL
// ============================================================================

export enum ConfidenceLevel {
  HIGH = 'HIGH',
  MEDIUM = 'MEDIUM',
  LOW = 'LOW',
}

// ============================================================================
// ENTITY FAMILY & EXECUTION TRACK
// ============================================================================

export enum EntityFamily {
  INDIVIDUAL = 'INDIVIDUAL',
  ORGANIZATION = 'ORGANIZATION',
  TEAM = 'TEAM',
  FUND = 'FUND',
  AGENCY = 'AGENCY',
  INSTITUTION = 'INSTITUTION',
}

export enum ExecutionTrack {
  HANDS_ON = 'HANDS_ON',
  ADVISORY = 'ADVISORY',
  STRATEGIC = 'STRATEGIC',
  OPERATIONAL = 'OPERATIONAL',
  FINANCIAL = 'FINANCIAL',
  TECHNICAL = 'TECHNICAL',
}

// ============================================================================
// SENIORITY LEVEL
// ============================================================================

export enum SeniorityLevel {
  JUNIOR = 'JUNIOR',
  MID = 'MID',
  SENIOR = 'SENIOR',
  LEAD = 'LEAD',
  PRINCIPAL = 'PRINCIPAL',
  EXECUTIVE = 'EXECUTIVE',
  C_LEVEL = 'C_LEVEL',
}

// ============================================================================
// SCORE BREAKDOWN
// ============================================================================

export interface DeterministicScoreBreakdown {
  totalScore: number;
  normalizedScore: number;
  confidence: number;
}

// ============================================================================
// HARD FILTER RESULT
// ============================================================================

export interface HardFilterResult {
  status: HardFilterStatus;
  reason: HardFilterReason;
  message?: string;
  details: string[];
}

// ============================================================================
// MATCH EXPLANATION
// ============================================================================

export interface MatchExplanation {
  summary: string;
}

// ============================================================================
// BASE MATCH RESULT
// ============================================================================

export interface BaseMatchResult {
  id: string;
  deterministicScore: number;
  aiScore: number | null;
  finalScore: number;
  confidence: number;
  matchLevel: MatchLevel;
  hardFilterStatus: HardFilterStatus;
  hardFilterReason?: HardFilterReason | null;
  rank?: number;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// BASE MATCH RESPONSE
// ============================================================================

export interface BaseMatchResponse<T extends BaseMatchResult = BaseMatchResult> {
  success: boolean;
  matches: T[];
  stats: MatchingStats;
  processingTimeMs: number;
}

// ============================================================================
// BASE FILTER OPTIONS
// ============================================================================

export interface BaseFilterOptions {
  includeReview?: boolean;
  maxResults?: number;
  minScore?: number;
  minConfidence?: number;
}

// ============================================================================
// THRESHOLD CONFIG
// ============================================================================

export interface ThresholdConfig {
  minDeterministicScore: number;
  minPostAIScore: number;
  minConfidence: number;
  maxResults: number;
  sparseRecordThreshold: number;
  dataQualityThreshold: number;
}

// ============================================================================
// CONFIDENCE GATES
// ============================================================================

export interface ConfidenceGates {
  excellentMinConfidence: number;
  veryGoodMinConfidence: number;
  goodMinConfidence: number;
  sparseProfileCap: MatchLevel;
  lowDataQualityCap: MatchLevel;
}

// ============================================================================
// FALLBACK SCORES
// ============================================================================

export interface FallbackScores {
  missingCapability: number;
  missingSector: number;
  missingExperience: number;
  missingBudget: number;
  missingTimeline: number;
  sparseRecord: number;
  aiFailure: number;
}

// ============================================================================
// FEATURE FLAGS
// ============================================================================

export interface FeatureFlags {
  enableAIValidation: boolean;
  enableSemanticMatching: boolean;
  enableGeographyFilter: boolean;
  enableBudgetFilter: boolean;
  enableStrictMode: boolean;
  enablePrefilter: boolean;
}

// ============================================================================
// BASE JOB PAYLOAD
// ============================================================================

export interface BaseJobPayload {
  userId?: string;
  organizationId?: string;
  limit?: number;
  offset?: number;
  includeAI?: boolean;
  includeExplanations?: boolean;
  priority?: 'LOW' | 'NORMAL' | 'HIGH';
  callbackUrl?: string;
}

// ============================================================================
// MATCHING STATS
// ============================================================================

export interface MatchingStats {
  totalCandidates: number;
  passedHardFilters: number;
  failedHardFilters: number;
  reviewCandidates: number;
  scoredCandidates: number;
  filteredOutDeterministic: number;
  filteredOutPostAI: number;
  finalMatches: number;
  avgScore: number;
  avgConfidence: number;
  processingTimeMs: number;
}
