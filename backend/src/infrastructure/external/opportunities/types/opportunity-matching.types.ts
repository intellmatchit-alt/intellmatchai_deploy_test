/**
 * Opportunity Matching Types v2
 *
 * Comprehensive type definitions for the Jobs/Opportunities matching system.
 * Implements: Career Tracks, Role Families, Seniority Ladders, Hard Filters,
 * Confidence Scoring, and Match Levels with stricter thresholds.
 *
 * @module infrastructure/external/opportunities/types/opportunity-matching.types
 */

import { OpportunityIntentType, SeniorityLevel, GoalType } from '@prisma/client';

// ============================================================================
// SECTION 1: MATCH LEVELS (20-POINT SCALE)
// ============================================================================

export enum MatchLevel {
  EXCELLENT = 'EXCELLENT',   // >80-100
  VERY_GOOD = 'VERY_GOOD',   // >60-80
  GOOD = 'GOOD',             // >40-60
  WEAK = 'WEAK',             // >20-40
  POOR = 'POOR',             // 0-20
}

export function scoreToMatchLevel(
  score: number,
  hardFilterStatus: HardFilterStatus
): MatchLevel {
  if (hardFilterStatus === HardFilterStatus.FAIL) {
    return MatchLevel.POOR;
  }
  if (score > 80) return MatchLevel.EXCELLENT;
  if (score > 60) return MatchLevel.VERY_GOOD;
  if (score > 40) return MatchLevel.GOOD;
  if (score > 20) return MatchLevel.WEAK;
  return MatchLevel.POOR;
}

// ============================================================================
// SECTION 2: CAREER TRACK MODEL
// ============================================================================

export enum CareerTrack {
  INDIVIDUAL_CONTRIBUTOR = 'INDIVIDUAL_CONTRIBUTOR',
  MANAGEMENT = 'MANAGEMENT',
  EXECUTIVE = 'EXECUTIVE',
  FOUNDER = 'FOUNDER',
  BOARD = 'BOARD',
  ADVISOR = 'ADVISOR',
  UNKNOWN = 'UNKNOWN',
}

// ============================================================================
// SECTION 3: ROLE FAMILY NORMALIZATION
// ============================================================================

export enum RoleFamily {
  ENGINEERING = 'engineering',
  PRODUCT = 'product',
  DESIGN = 'design',
  DATA = 'data',
  DEVOPS = 'devops',
  QA = 'qa',
  SECURITY = 'security',
  SALES = 'sales',
  MARKETING = 'marketing',
  FINANCE = 'finance',
  OPERATIONS = 'operations',
  HR = 'hr',
  LEGAL = 'legal',
  EXECUTIVE = 'executive',
  FOUNDER = 'founder',
  BOARD = 'board',
  ADVISORY = 'advisory',
  UNKNOWN = 'unknown',
}

export const ROLE_FAMILY_PATTERNS: Record<RoleFamily, RegExp[]> = {
  [RoleFamily.ENGINEERING]: [
    /\b(software|engineer|developer|programmer|coder|architect|swe|sde)\b/i,
    /\b(frontend|backend|full.?stack|web dev|mobile dev|platform)\b/i,
  ],
  [RoleFamily.PRODUCT]: [
    /\b(product\s*(manager|lead|owner|director|vp))\b/i,
    /\bpm\b/i,
  ],
  [RoleFamily.DESIGN]: [
    /\b(design|ux|ui|user experience|user interface|graphic)\b/i,
    /\b(creative director)\b/i,
  ],
  [RoleFamily.DATA]: [
    /\b(data\s*(scientist|engineer|analyst|analytics))\b/i,
    /\b(machine learning|ml|ai|artificial intelligence)\b/i,
    /\b(business intelligence|bi)\b/i,
  ],
  [RoleFamily.DEVOPS]: [
    /\b(devops|sre|site reliability|infrastructure|platform)\b/i,
    /\b(cloud|aws|gcp|azure)\s*(engineer|architect)\b/i,
  ],
  [RoleFamily.QA]: [
    /\b(qa|quality assurance|test|sdet|automation)\b/i,
  ],
  [RoleFamily.SECURITY]: [
    /\b(security|infosec|cybersecurity)\b/i,
  ],
  [RoleFamily.SALES]: [
    /\b(sales|account\s*(manager|executive)|ae|sdr|bdr)\b/i,
    /\b(business development|bd|revenue(?!\s*officer))\b/i,
  ],
  [RoleFamily.MARKETING]: [
    /\b(marketing|growth|brand|content|seo|sem)\b/i,
    /\b(demand gen|digital marketing|pr|communications)\b/i,
  ],
  [RoleFamily.FINANCE]: [
    /\b(finance|financial|accounting|treasury|audit)\b/i,
    /\b(controller|fp&a|investment)\b/i,
  ],
  [RoleFamily.OPERATIONS]: [
    /\b(operations|ops|supply chain|logistics|procurement)\b/i,
    /\b(manufacturing|facilities)\b/i,
  ],
  [RoleFamily.HR]: [
    /\b(hr|human resources|people ops|talent|recruit)\b/i,
    /\b(ta|talent acquisition)\b/i,
  ],
  [RoleFamily.LEGAL]: [
    /\b(legal|counsel|attorney|lawyer|compliance|regulatory)\b/i,
    /\b(contracts|ip|intellectual property)\b/i,
  ],
  [RoleFamily.EXECUTIVE]: [
    /\b(ceo|cto|cfo|coo|cmo|cio|cpo|ciso|chro|cro)\b/i,
    /\bchief\s+[a-zA-Z]+\b/i,
    /\b(president|vice\s+president|vp|evp|svp)\b/i,
    /\b(managing director|general manager|gm)\b/i,
  ],
  [RoleFamily.FOUNDER]: [
    /\b(founder|co-?founder|owner|entrepreneur)\b/i,
  ],
  [RoleFamily.BOARD]: [
    /\b(board\s*(member|director|of directors))\b/i,
    /\b(non-?executive director|ned)\b/i,
  ],
  [RoleFamily.ADVISORY]: [
    /\b(advisor|adviser|consultant|mentor|investor|partner)\b/i,
  ],
  [RoleFamily.UNKNOWN]: [],
};

// ============================================================================
// SECTION 4: SENIORITY LADDERS
// ============================================================================

export interface ParsedSeniority {
  level: SeniorityLevel | null;
  ladder: 'IC' | 'MANAGEMENT' | 'EXECUTIVE' | null;
  rank: number;
}

export const SENIORITY_PATTERNS: Record<string, { level: SeniorityLevel; ladder: 'IC' | 'MANAGEMENT' | 'EXECUTIVE'; rank: number }> = {
  'intern': { level: 'ENTRY', ladder: 'IC', rank: 0 },
  'junior': { level: 'ENTRY', ladder: 'IC', rank: 1 },
  'jr': { level: 'ENTRY', ladder: 'IC', rank: 1 },
  'associate': { level: 'ENTRY', ladder: 'IC', rank: 1 },
  'entry': { level: 'ENTRY', ladder: 'IC', rank: 1 },
  'mid': { level: 'MID', ladder: 'IC', rank: 2 },
  'intermediate': { level: 'MID', ladder: 'IC', rank: 2 },
  'senior': { level: 'SENIOR', ladder: 'IC', rank: 3 },
  'sr': { level: 'SENIOR', ladder: 'IC', rank: 3 },
  'staff': { level: 'LEAD', ladder: 'IC', rank: 4 },
  'principal': { level: 'LEAD', ladder: 'IC', rank: 5 },
  'distinguished': { level: 'LEAD', ladder: 'IC', rank: 6 },
  'fellow': { level: 'LEAD', ladder: 'IC', rank: 7 },
  'lead': { level: 'LEAD', ladder: 'MANAGEMENT', rank: 3 },
  'manager': { level: 'DIRECTOR', ladder: 'MANAGEMENT', rank: 4 },
  'senior manager': { level: 'DIRECTOR', ladder: 'MANAGEMENT', rank: 5 },
  'director': { level: 'DIRECTOR', ladder: 'MANAGEMENT', rank: 6 },
  'head': { level: 'DIRECTOR', ladder: 'MANAGEMENT', rank: 6 },
  'vp': { level: 'VP', ladder: 'MANAGEMENT', rank: 7 },
  'vice president': { level: 'VP', ladder: 'MANAGEMENT', rank: 7 },
  'ceo': { level: 'C_LEVEL', ladder: 'EXECUTIVE', rank: 10 },
  'cto': { level: 'C_LEVEL', ladder: 'EXECUTIVE', rank: 10 },
  'cfo': { level: 'C_LEVEL', ladder: 'EXECUTIVE', rank: 10 },
  'coo': { level: 'C_LEVEL', ladder: 'EXECUTIVE', rank: 10 },
  'cmo': { level: 'C_LEVEL', ladder: 'EXECUTIVE', rank: 10 },
  'cpo': { level: 'C_LEVEL', ladder: 'EXECUTIVE', rank: 10 },
  'cio': { level: 'C_LEVEL', ladder: 'EXECUTIVE', rank: 10 },
  'ciso': { level: 'C_LEVEL', ladder: 'EXECUTIVE', rank: 10 },
  'chro': { level: 'C_LEVEL', ladder: 'EXECUTIVE', rank: 10 },
  'cro': { level: 'C_LEVEL', ladder: 'EXECUTIVE', rank: 10 },
  'chief': { level: 'C_LEVEL', ladder: 'EXECUTIVE', rank: 10 },
  'president': { level: 'C_LEVEL', ladder: 'EXECUTIVE', rank: 10 },
  'managing director': { level: 'C_LEVEL', ladder: 'EXECUTIVE', rank: 9 },
};

// ============================================================================
// SECTION 5: HARD FILTERS
// ============================================================================

export enum HardFilterStatus {
  PASS = 'PASS',
  FAIL = 'FAIL',
  REVIEW = 'REVIEW',
}

export enum HardFilterReason {
  ROLE_FAMILY_INCOMPATIBLE = 'ROLE_FAMILY_INCOMPATIBLE',
  TRACK_INCOMPATIBLE = 'TRACK_INCOMPATIBLE',
  MISSING_REQUIRED_SKILLS = 'MISSING_REQUIRED_SKILLS',
  LOCATION_INCOMPATIBLE = 'LOCATION_INCOMPATIBLE',
  LANGUAGE_INCOMPATIBLE = 'LANGUAGE_INCOMPATIBLE',
  INSUFFICIENT_EXPERIENCE = 'INSUFFICIENT_EXPERIENCE',
  EXECUTIVE_FOR_IC_ROLE = 'EXECUTIVE_FOR_IC_ROLE',
  FOUNDER_FOR_EMPLOYEE_ROLE = 'FOUNDER_FOR_EMPLOYEE_ROLE',
  SPARSE_PROFILE = 'SPARSE_PROFILE',
}

export interface HardFilterResult {
  status: HardFilterStatus;
  reasons: HardFilterReason[];
  details: string[];
}

// ============================================================================
// SECTION 6: EXPERIENCE PARSING
// ============================================================================

export interface ParsedExperience {
  totalExperienceMonths: number;
  relevantExperienceMonths: number;
  recentRelevantExperienceMonths: number;
  technicalExperienceMonths: number;
  managementExperienceMonths: number;
  currentRoleFamily: RoleFamily;
  hasRecentTechnicalEvidence: boolean;
  careerTrajectory: 'ASCENDING' | 'LATERAL' | 'DESCENDING' | 'PIVOTING' | 'UNKNOWN';
}

export interface ExperienceEntry {
  title: string;
  company: string;
  startDate: Date;
  endDate: Date | null;
  description?: string;
}

// ============================================================================
// SECTION 7: SKILL CLASSIFICATION
// ============================================================================

export enum SkillRequirementType {
  REQUIRED = 'REQUIRED',
  PREFERRED = 'PREFERRED',
  INFERRED = 'INFERRED',
}

export interface ClassifiedSkill {
  name: string;
  requirementType: SkillRequirementType;
  proficiencyRequired?: 'BASIC' | 'INTERMEDIATE' | 'ADVANCED' | 'EXPERT';
}

export interface SkillMatchResult {
  skill: string;
  requirementType: SkillRequirementType;
  matched: boolean;
  matchType?: 'EXACT' | 'SYNONYM' | 'CHILD' | 'RELATED' | 'PARENT' | 'SEMANTIC';
  matchedWith?: string;
  score: number;
}

// ============================================================================
// SECTION 8: CONFIDENCE SCORING
// ============================================================================

export enum ConfidenceLevel {
  HIGH = 'HIGH',
  MEDIUM = 'MEDIUM',
  LOW = 'LOW',
}

export const CONFIDENCE_VALUES: Record<ConfidenceLevel, number> = {
  [ConfidenceLevel.HIGH]: 90,
  [ConfidenceLevel.MEDIUM]: 65,
  [ConfidenceLevel.LOW]: 30,
};

export interface ScoringComponent {
  name: string;
  rawScore: number;
  weight: number;
  weightedScore: number;
  confidence: ConfidenceLevel;
  explanation: string;
  evidence: string[];
}

// ============================================================================
// SECTION 9: SCORING WEIGHTS
// ============================================================================

export interface ScoringWeights {
  titleRelevance: number;
  skillMatch: number;
  trackAlignment: number;
  recentExperience: number;
  seniorityFit: number;
  roleAreaMatch: number;
  intentAlignment: number;
  sectorOverlap: number;
  locationMatch: number;
  interestOverlap: number;
}

export const DEFAULT_SCORING_WEIGHTS: ScoringWeights = {
  titleRelevance: 0.18,
  skillMatch: 0.18,
  trackAlignment: 0.16,
  recentExperience: 0.14,
  seniorityFit: 0.12,
  roleAreaMatch: 0.10,
  intentAlignment: 0.05,
  sectorOverlap: 0.04,
  locationMatch: 0.02,
  interestOverlap: 0.01,
};

export const NETWORKING_SCORING_WEIGHTS: ScoringWeights = {
  titleRelevance: 0.10,
  skillMatch: 0.12,
  trackAlignment: 0.15,
  recentExperience: 0.08,
  seniorityFit: 0.10,
  roleAreaMatch: 0.10,
  intentAlignment: 0.15,
  sectorOverlap: 0.10,
  locationMatch: 0.05,
  interestOverlap: 0.05,
};

// Validate weights sum to 1.0
const weightSum = Object.values(DEFAULT_SCORING_WEIGHTS).reduce((a, b) => a + b, 0);
if (Math.abs(weightSum - 1.0) > 0.001) {
  throw new Error(`Scoring weights must sum to 1.0, got ${weightSum}`);
}

// ============================================================================
// SECTION 10: FINAL RESULT STRUCTURE
// ============================================================================

export interface MatchResult {
  candidateId: string;
  candidateType: 'user' | 'contact';
  candidateName: string;
  candidateTitle: string | null;
  candidateCompany: string | null;
  score: number;
  confidence: ConfidenceLevel;
  confidenceScore: number;
  matchLevel: MatchLevel;
  hardFilterStatus: HardFilterStatus;
  hardFilterReasons: HardFilterReason[];
  componentScores: ScoringComponent[];
  keyStrengths: string[];
  keyRisks: string[];
  missingRequiredSkills: string[];
  explanation: string;
  levelCappedReason: string | null;
  suggestedAction: string;
  suggestedMessage: string;
  nextSteps: string[];
  aiValidated: boolean;
  aiNotes: string | null;
  isSparseProfile: boolean;
  sharedSectors: string[];
  sharedSkills: string[];
}

// ============================================================================
// SECTION 11: CANDIDATE TYPES
// ============================================================================

export interface MatchCandidate {
  type: 'user' | 'contact';
  id: string;
  name: string;
  company: string | null;
  jobTitle: string | null;
  bio: string | null;
  location: string | null;
  sectors: string[];
  skills: string[];
  interests: string[];
  hobbies: string[];
  goals: GoalType[];
  opportunityIntent: OpportunityIntentType | null;
  roleFamily: RoleFamily;
  careerTrack: CareerTrack;
  seniority: ParsedSeniority;
  experience: ParsedExperience | null;
  workHistory?: ExperienceEntry[];
  updatedAt: Date | null;
}

export interface IntentWithDetails {
  id: string;
  userId: string;
  intentType: OpportunityIntentType;
  roleArea: string | null;
  seniority: SeniorityLevel | null;
  locationPref: string | null;
  remoteOk: boolean;
  isActive: boolean;
  sectorPrefs: Array<{ sectorId: string; sector: { name: string } }>;
  skillPrefs: Array<{
    skillId: string;
    skill: { name: string };
    isRequired?: boolean;
  }>;
  languageReqs?: string[];
  minExperienceYears?: number;
  lastMatchedAt: Date | null;
}

export interface UserProfile {
  id: string;
  fullName: string;
  company: string | null;
  jobTitle: string | null;
  bio: string | null;
  location: string | null;
  userSectors: Array<{ sector: { name: string } }>;
  userSkills: Array<{ skill: { name: string } }>;
  userGoals: Array<{ goalType: GoalType; isActive: boolean }>;
  userInterests: Array<{ interest: { name: string } }>;
  userHobbies: Array<{ hobby: { name: string } }>;
}

// ============================================================================
// SECTION 12: CONFIGURATION
// ============================================================================

export interface MatchingConfig {
  maxContactCandidates: number;
  maxUserCandidates: number;
  minDeterministicScore: number;
  minPostAIScore: number;
  aiValidationBatchSize: number;
  explanationBatchSize: number;
  enableUserMatching: boolean;
  llmTimeoutMs: number;
  maxConcurrentLLMCalls: number;
  minRequiredSkillCoverage: number;
  strictLocationMatching: boolean;
  sparseProfileThreshold: number;
}

export interface IntentThresholds {
  minDeterministicScore: number;
  minPostAIScore: number;
  minRequiredSkillCoverage: number;
}

export const INTENT_THRESHOLDS: Record<OpportunityIntentType, IntentThresholds> = {
  HIRING: {
    minDeterministicScore: 30,
    minPostAIScore: 25,
    minRequiredSkillCoverage: 0.6,
  },
  OPEN_TO_OPPORTUNITIES: {
    minDeterministicScore: 20,
    minPostAIScore: 15,
    minRequiredSkillCoverage: 0.4,
  },
  ADVISORY_BOARD: {
    minDeterministicScore: 15,
    minPostAIScore: 12,
    minRequiredSkillCoverage: 0.3,
  },
  REFERRALS_ONLY: {
    minDeterministicScore: 15,
    minPostAIScore: 12,
    minRequiredSkillCoverage: 0.3,
  },
};

export const DEFAULT_MATCHING_CONFIG: MatchingConfig = {
  maxContactCandidates: 200,
  maxUserCandidates: 100,
  minDeterministicScore: 30,
  minPostAIScore: 25,
  aiValidationBatchSize: 50,
  explanationBatchSize: 30,
  enableUserMatching: false,
  llmTimeoutMs: 30000,
  maxConcurrentLLMCalls: 5,
  minRequiredSkillCoverage: 0.6,
  strictLocationMatching: false,
  sparseProfileThreshold: 4,
};

// ============================================================================
// SECTION 13: CONFIDENCE GATING RULES
// ============================================================================

export const CONFIDENCE_GATES = {
  EXCELLENT_MIN: 80,
  VERY_GOOD_MIN: 65,
  WEAK_MAX: 45,
} as const;

export function applyConfidenceCap(
  matchLevel: MatchLevel,
  confidenceScore: number,
  isSparseProfile: boolean
): { level: MatchLevel; reason: string | null } {
  let cappedLevel = matchLevel;
  let reason: string | null = null;

  if (isSparseProfile && (matchLevel === MatchLevel.EXCELLENT ||
      matchLevel === MatchLevel.VERY_GOOD || matchLevel === MatchLevel.GOOD)) {
    cappedLevel = MatchLevel.WEAK;
    reason = 'Sparse profile capped at WEAK';
  }

  if (confidenceScore < CONFIDENCE_GATES.WEAK_MAX &&
      (cappedLevel === MatchLevel.EXCELLENT ||
       cappedLevel === MatchLevel.VERY_GOOD ||
       cappedLevel === MatchLevel.GOOD)) {
    cappedLevel = MatchLevel.WEAK;
    reason = reason || `Low confidence (${confidenceScore}) capped at WEAK`;
  }

  if (confidenceScore < CONFIDENCE_GATES.VERY_GOOD_MIN &&
      (cappedLevel === MatchLevel.EXCELLENT || cappedLevel === MatchLevel.VERY_GOOD)) {
    cappedLevel = MatchLevel.GOOD;
    reason = reason || `Confidence (${confidenceScore}) below threshold for VERY_GOOD`;
  }

  if (confidenceScore < CONFIDENCE_GATES.EXCELLENT_MIN && cappedLevel === MatchLevel.EXCELLENT) {
    cappedLevel = MatchLevel.VERY_GOOD;
    reason = reason || `Confidence (${confidenceScore}) below threshold for EXCELLENT`;
  }

  return { level: cappedLevel, reason };
}

// ============================================================================
// SECTION 14: CONSERVATIVE FALLBACK SCORES
// ============================================================================

export const FALLBACK_SCORES = {
  MISSING_SKILLS: 15,
  MISSING_TITLE: 20,
  MISSING_ROLE_FAMILY: 15,
  MISSING_TRACK: 20,
  MISSING_EXPERIENCE: 15,
  MISSING_AI_RESULT: 0,
  UNKNOWN_LOCATION: 25,
  SPARSE_PROFILE_BASE: 20,
} as const;

// ============================================================================
// SECTION 15: JOB QUEUE TYPES
// ============================================================================

export interface OpportunityMatchingJobData {
  userId: string;
  intentId: string;
  organizationId?: string;
  config?: Partial<MatchingConfig>;
  priority?: number;
}

export interface MatchingProgressEvent {
  jobId: string;
  intentId: string;
  stage: 'LOADING' | 'FILTERING' | 'SCORING' | 'VALIDATING' | 'EXPLAINING' | 'SAVING' | 'COMPLETE' | 'FAILED';
  progress: number;
  message: string;
  candidatesProcessed?: number;
  totalCandidates?: number;
}

export interface MatchingJobResult {
  success: boolean;
  intentId: string;
  matchCount: number;
  filteredOut: number;
  sparseProfilesFiltered: number;
  durationMs: number;
  stats?: MatchingStats;
  error?: string;
}

export interface MatchingStats {
  totalCandidates: number;
  passedHardFilters: number;
  reviewCandidates: number;
  failedHardFilters: number;
  scoredCandidates: number;
  filteredOutDeterministic: number;
  filteredOutPostAI: number;
  finalMatches: number;
}

// ============================================================================
// SECTION 16: API TYPES
// ============================================================================

export interface FindMatchesRequest {
  async?: boolean;
  config?: Partial<MatchingConfig>;
}

export interface FindMatchesResponse {
  success: boolean;
  data: {
    matches?: MatchResult[];
    jobId?: string;
    message?: string;
  };
}

// ============================================================================
// SECTION 17: LLM TYPES
// ============================================================================

export type LLMProvider = 'groq' | 'gemini' | 'openai' | 'none';

export interface AIValidationResult {
  scores: number[];
  provider: LLMProvider;
  latencyMs: number;
  notes?: string[];
  fallbackUsed: boolean;
  fallbackReason?: string;
}

// ============================================================================
// SECTION 18: INTENT COMPATIBILITY
// ============================================================================

export const INTENT_COMPATIBILITY: Record<OpportunityIntentType, OpportunityIntentType[]> = {
  HIRING: ['OPEN_TO_OPPORTUNITIES', 'REFERRALS_ONLY'],
  OPEN_TO_OPPORTUNITIES: ['HIRING', 'REFERRALS_ONLY', 'ADVISORY_BOARD'],
  ADVISORY_BOARD: ['OPEN_TO_OPPORTUNITIES', 'HIRING'],
  REFERRALS_ONLY: ['HIRING', 'OPEN_TO_OPPORTUNITIES'],
};

export const INTENT_TO_GOALS: Record<OpportunityIntentType, GoalType[]> = {
  HIRING: ['JOB_SEEKING', 'COLLABORATION'],
  OPEN_TO_OPPORTUNITIES: ['HIRING', 'MENTORSHIP', 'COLLABORATION'],
  ADVISORY_BOARD: ['MENTORSHIP', 'COLLABORATION', 'LEARNING'],
  REFERRALS_ONLY: ['PARTNERSHIP', 'COLLABORATION', 'HIRING', 'JOB_SEEKING'],
};

// ============================================================================
// SECTION 19: TITLE RELEVANCE
// ============================================================================

export const RECENT_TITLE_WINDOW_YEARS = 3;

export const IC_FAVORABLE_TITLES: RegExp[] = [
  /\b(software|engineer|developer|programmer|architect)\b/i,
  /\b(frontend|backend|full.?stack|platform|sre|devops)\b/i,
  /\b(data scientist|ml engineer|data engineer)\b/i,
  /\b(designer|ux|ui)\b/i,
  /\b(analyst|qa|tester)\b/i,
];

export const IC_PENALTY_TITLES: RegExp[] = [
  /\bceo\b/i,
  /\bfounder\b/i,
  /\bco-?founder\b/i,
  /\bboard\b/i,
  /\binvestor\b/i,
  /\badvisor\b/i,
  /\bpartner\b/i,
  /\bchairman\b/i,
  /\bcto\b/i,
  /\bcfo\b/i,
  /\bcoo\b/i,
  /\bcmo\b/i,
  /\bcio\b/i,
  /\bcpo\b/i,
  /\bciso\b/i,
  /\bchro\b/i,
  /\bcro\b/i,
  /\bvice\s+president\b/i,
  /\bvp\b/i,
  /\bpresident\b/i,
  /\bchief\b/i,
  /\bdirector\b/i,
  /\bhead\s+of\b/i,
];

// ============================================================================
// SECTION 20: SPARSE PROFILE DETECTION
// ============================================================================

export const SPARSE_PROFILE_CHECKS = [
  'hasSkills',
  'hasWorkHistory',
  'hasTitle',
  'hasCareerTrack',
  'hasRecentEvidence',
  'hasRoleFamily',
  'hasBio',
  'hasLocation',
] as const;

export const MIN_NON_SPARSE_DATA_POINTS = 4;
