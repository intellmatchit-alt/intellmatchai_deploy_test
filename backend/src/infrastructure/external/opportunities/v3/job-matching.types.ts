/**
 * IntellMatch Job Matching Engine — Types & Configuration
 *
 * Aligned to IntellMatch_Job_Forms.docx (single source of truth).
 *
 * Two-sided matching:
 *   Hiring form       ↔   Open to Opportunities form
 *
 * MANDATORY SCORE BANDS (20‑point system):
 *   POOR 0–20 | WEAK 21–40 | GOOD 41–60 | VERY_GOOD 61–80 | EXCELLENT 81–100
 *
 * @module job-matching/job-matching.types
 */

import {
  MatchLevel,
  HardFilterStatus,
  ConfidenceGates,
  DEFAULT_CONFIDENCE_GATES,
  ScoringComponent,
  MatchExplanation,
} from './matching-bands.constants';

export { MatchLevel, HardFilterStatus } from './matching-bands.constants';
export type { ScoringComponent, MatchExplanation } from './matching-bands.constants';

// ============================================================================
// ENUMS (derived from the form)
// ============================================================================

/** Seniority options (field #3 on both sides). */
export enum Seniority {
  INTERN = 'INTERN',
  JUNIOR = 'JUNIOR',
  MID = 'MID',
  SENIOR = 'SENIOR',
  LEAD = 'LEAD',
  MANAGER = 'MANAGER',
  DIRECTOR = 'DIRECTOR',
  VP = 'VP',
  C_LEVEL = 'C_LEVEL',
  FOUNDER = 'FOUNDER',
}

/** Employment type (field #6). */
export enum EmploymentType {
  FULL_TIME = 'FULL_TIME',
  PART_TIME = 'PART_TIME',
  CONTRACT = 'CONTRACT',
  FREELANCE = 'FREELANCE',
  INTERNSHIP = 'INTERNSHIP',
}

/** Work mode (field #5). */
export enum WorkMode {
  ONSITE = 'ONSITE',
  HYBRID = 'HYBRID',
  REMOTE = 'REMOTE',
}

/** Hiring urgency (field #10 hiring side). */
export enum HiringUrgency {
  LOW = 'LOW',
  NORMAL = 'NORMAL',
  URGENT = 'URGENT',
  CRITICAL = 'CRITICAL',
}

/** Candidate availability (field #10 candidate side). */
export enum Availability {
  IMMEDIATELY = 'IMMEDIATELY',
  WITHIN_2_WEEKS = 'WITHIN_2_WEEKS',
  WITHIN_1_MONTH = 'WITHIN_1_MONTH',
  WITHIN_3_MONTHS = 'WITHIN_3_MONTHS',
  NOT_ACTIVELY_LOOKING = 'NOT_ACTIVELY_LOOKING',
}

/** Hard filter failure reasons. */
export enum HardFilterReason {
  NONE = 'NONE',
  EMPLOYMENT_TYPE_INCOMPATIBLE = 'EMPLOYMENT_TYPE_INCOMPATIBLE',
  WORK_MODE_INCOMPATIBLE = 'WORK_MODE_INCOMPATIBLE',
  SENIORITY_INCOMPATIBLE = 'SENIORITY_INCOMPATIBLE',
  BLOCKED = 'BLOCKED',
  OPT_OUT = 'OPT_OUT',
  EXCLUDED = 'EXCLUDED',
  MISSING_CRITICAL_SKILLS = 'MISSING_CRITICAL_SKILLS',
  MISSING_REQUIRED_LANGUAGE = 'MISSING_REQUIRED_LANGUAGE',
  MISSING_REQUIRED_CERTIFICATION = 'MISSING_REQUIRED_CERTIFICATION',
  MISSING_REQUIRED_EDUCATION = 'MISSING_REQUIRED_EDUCATION',
  SALARY_MISMATCH = 'SALARY_MISMATCH',
}

/** LLM provider type. */
export type LLMProvider = 'groq' | 'gemini' | 'openai';

/** Tag source for provenance tracking. */
export enum TagSource {
  AI_GENERATED = 'AI_GENERATED',
  USER_ADDED = 'USER_ADDED',
  SYSTEM = 'SYSTEM',
}

// ============================================================================
// FORM-ALIGNED ENTITY TYPES
// ============================================================================

/**
 * HIRING-SIDE PROFILE — fields #1-10 from the Hiring table in the Job Form.
 */
export interface HiringProfile {
  id: string;
  userId: string;
  organizationId?: string;

  // --- Form fields (see IntellMatch_Job_Forms.docx §3 Hiring) ---
  /** Optional display/full name for UI and explanations */
  fullName?: string;
  /** #1 – Title (required) */
  title: string;
  /** #2 – Role / Area (required) */
  roleArea: string;
  /** #3 – Seniority (required) */
  seniority: Seniority;
  /** #4 – Location (required) */
  location: string;
  /** #5 – Work Mode (required) */
  workMode: WorkMode;
  /** #6 – Employment Type (required) */
  employmentType: EmploymentType;
  /** #7 – Required Skills (required, multi-select / tags) */
  /**
   * Critical must-have skills.  All listed skills are treated as mandatory for
   * eligibility and matching.  Candidates missing any must-have skill are
   * either downranked or filtered out depending on configuration.
   */
  mustHaveSkills: string[];

  /**
   * Preferred skills.  These skills are nice-to-have and earn additional
   * credit during matching but are not required for eligibility.  This field
   * replaces the previous `requiredSkills` when distinguishing between
   * mandatory and optional skills.  Leave empty if there are no preferences.
   */
  preferredSkills?: string[];
  /** #8 – Job Summary / Requirements (required, multi-line) */
  jobSummaryRequirements: string;
  /** #9 – Minimum Years of Experience (recommended) */
  minimumYearsExperience?: number;
  /** #10 – Hiring Urgency (recommended) */
  hiringUrgency?: HiringUrgency;

  /**
   * Primary industries or domains relevant to this role.  Used for domain
   * alignment during matching (e.g. fintech, healthtech).  Multiple values
   * are allowed.  Leave empty if not domain-specific.
   */
  industries?: string[];

  /**
   * Required language and proficiency pairs.  Each entry specifies a language
   * and the minimum acceptable proficiency for the role.  Candidates must
   * meet or exceed the proficiency on all required languages to avoid
   * penalties or hard filter failures.
   */
  requiredLanguages?: LanguageSkill[];

  /**
   * Certifications or licenses that are mandatory for the role.  Candidates
   * missing any listed certification will be heavily penalised or filtered
   * out.  Use canonical certification names.
   */
  requiredCertifications?: string[];

  /**
   * Education requirements expressed as degree levels (e.g. "Bachelor",
   * "Master", "PhD").  Candidates must have at least one listed degree to
   * avoid penalties.  Leave empty if no specific education requirement.
   */
  requiredEducationLevels?: string[];

  /**
   * Target salary or compensation range for the role.  This is optional and
   * used for alignment with candidate expectations.  Currency should follow
   * ISO 4217 codes.  Values represent annual compensation in the specified
   * currency.
   */
  salaryRange?: SalaryRange;

  // --- Internal / engineering fields ---
  /** @internal AI-generated + user-edited tags */
  tags: TaggedItem[];
  /** @internal Pre-computed embedding for the job posting */
  embedding?: number[];
  /** @internal Data-quality estimate 0-100 */
  dataQualityScore: number;
  /** @internal Excluded candidate IDs */
  excludedCandidates: string[];

  createdAt: Date;
  updatedAt: Date;
}

/**
 * CANDIDATE-SIDE PROFILE — fields #1-10 from the "Open to Opportunities" table.
 */
export interface CandidateProfile {
  id: string;
  userId: string;
  organizationId?: string;

  // --- Form fields (see IntellMatch_Job_Forms.docx §4 Open to Opportunities) ---
  /** Optional display/full name for UI and explanations */
  fullName?: string;
  /** #1 – Title (required) */
  title: string;
  /** #2 – Role / Area (required) */
  roleArea: string;
  /** #3 – Seniority (required) */
  seniority: Seniority;
  /** #4 – Location (required) */
  location: string;
  /** #5 – Desired Work Mode (required, can be multi) */
  desiredWorkMode: WorkMode[];
  /** #6 – Desired Employment Type (required, can be multi) */
  desiredEmploymentType: EmploymentType[];
  /** #7 – Skills (required, multi-select / tags) */
  /**
   * Candidate skills and technologies.  These should include both must-have
   * skills relevant to the candidate's desired role and any additional
   * proficiencies.  Skills are normalized and deduplicated during matching.
   */
  skills: string[];
  /** #8 – Profile Summary / Preferences (required, multi-line) */
  profileSummaryPreferences: string;
  /** #9 – Years of Experience (recommended) — represents TOTAL years */
  yearsOfExperience?: number;
  /** #10 – Availability (recommended) */
  availability?: Availability;

  /**
   * Languages known by the candidate and their proficiency levels.  Each
   * entry specifies a language and a proficiency on a common scale.  Used
   * for matching against job `requiredLanguages`.  An empty list means
   * unknown or no languages provided.
   */
  languages?: LanguageSkill[];

  /**
   * Certifications held by the candidate.  These are normalized before
   * matching and compared against job `requiredCertifications`.  Include any
   * relevant professional licenses or credentials.
   */
  certifications?: string[];

  /**
   * Domains or industries in which the candidate has experience.  Used for
   * domain alignment with job `industries`.  Multiple values allowed.
   */
  industries?: string[];

  /**
   * Education history.  Each entry records a degree, optional field of
   * study, institution and graduation year.  Used for education matching.
   */
  education?: EducationEntry[];

  /**
   * Candidate's expected salary range.  This field is optional and used to
   * align with the job salary range.  Currency should follow ISO 4217 codes.
   */
  expectedSalary?: SalaryRange;

  /**
   * Notice period in weeks before the candidate can start a new role.  This
   * influences availability scoring.  If undefined, the availability field
   * provides a coarse estimate.
   */
  noticePeriod?: number;

  // --- Internal / engineering fields ---
  /** @internal Structured relevant-experience breakdown (AI-extracted or user-provided) */
  relevantExperience?: RelevantExperienceEntry[];
  /** @internal AI-generated + user-edited tags */
  tags: TaggedItem[];
  /** @internal Pre-computed embedding for the profile */
  embedding?: number[];
  /** @internal Data-quality estimate 0-100 */
  dataQualityScore: number;
  /** @internal Is the candidate blocked/opted-out? */
  optedOut: boolean;
  blocked: boolean;

  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// SUPPORTING TYPES
// ============================================================================

export interface TaggedItem {
  value: string;
  normalized: string;
  source: TagSource;
}

// ============================================================================
// NEW COMPLEX FIELD TYPES
//

/**
 * Level of proficiency for a language.  The values progress from BASIC to
 * NATIVE and are used to compare candidate language skills against job
 * requirements.  Proficiency levels are ordinal.
 */
export enum LanguageProficiency {
  BASIC = 'BASIC',               // limited working proficiency
  CONVERSATIONAL = 'CONVERSATIONAL', // able to converse on everyday topics
  FLUENT = 'FLUENT',             // comfortable in professional contexts
  NATIVE = 'NATIVE',             // native or near-native fluency
}

/**
 * Represents a language and a proficiency level.  Used in both job
 * requirements and candidate profiles.  Additional metadata (e.g. dialect)
 * could be added in future iterations.
 */
export interface LanguageSkill {
  language: string;
  proficiency: LanguageProficiency;
}

/**
 * Represents a range of compensation.  All values should be in the same
 * currency.  Min or max may be undefined if only one bound is known.
 */
export interface SalaryRange {
  min?: number;
  max?: number;
  currency: string;
}

/**
 * Represents a single education entry for a candidate.  Degree (level) and
 * field are required; institution and graduation year are optional.  This
 * structure allows matching based on degree level and domain relevance.
 */
export interface EducationEntry {
  degree: string;
  field: string;
  institution?: string;
  year?: number;
}

/**
 * Represents a segment of relevant experience so the engine can distinguish
 * total years from actually relevant years.
 */
export interface RelevantExperienceEntry {
  /** Role family / area, e.g. "Backend Engineering" */
  roleFamily: string;
  /** Domain / industry */
  domain?: string;
  /** Key skills exercised */
  skills: string[];
  /** Number of years in this segment */
  years: number;
}

// ============================================================================
// SCORING CONFIGURATION
// ============================================================================

/**
 * Weights for the 8 scoring components.
 * Must sum to 1.0.
 */
export interface JobScoringWeights {
  roleTitleScore: number;
  seniorityScore: number;
  skillsScore: number;
  workModeScore: number;
  employmentTypeScore: number;
  experienceScore: number;
  locationScore: number;
  semanticScore: number;

  // Additional weights for extended matching dimensions
  preferredSkillsScore: number;
  domainScore: number;
  languageScore: number;
  certificationScore: number;
  educationScore: number;
  availabilityScore: number;
  salaryScore: number;
}

export interface JobThresholds {
  minDeterministicScore: number;
  minPostAIScore: number;
  maxResults: number;
  sparseRecordThreshold: number;
}

export interface JobFallbackScores {
  missingSkills: number;
  missingExperience: number;
  missingSeniority: number;
  missingLocation: number;
  missingSemantic: number;
  aiFailure: number;       // ALWAYS 0

  // Additional fallback scores for extended dimensions
  missingPreferredSkills: number;
  missingDomain: number;
  missingLanguages: number;
  missingCertifications: number;
  missingEducation: number;
  missingAvailability: number;
  missingSalary: number;
}

export interface JobFeatureFlags {
  enableAIValidation: boolean;
  enableSemanticMatching: boolean;
  enableHardFilters: boolean;
  enableRelevantExperienceLogic: boolean;
}

export interface JobMatchingConfig {
  defaultWeights: JobScoringWeights;
  thresholds: JobThresholds;
  fallbackScores: JobFallbackScores;
  confidenceGates: ConfidenceGates;
  features: JobFeatureFlags;
}

// ============================================================================
// DEFAULT CONFIGURATION
// ============================================================================

export const DEFAULT_JOB_WEIGHTS: JobScoringWeights = {
  // Must-have skills carry the strongest weight
  skillsScore: 0.20,
  // Role / title and area alignment
  roleTitleScore: 0.10,
  // Seniority alignment
  seniorityScore: 0.08,
  // Relevant experience
  experienceScore: 0.14,
  // Work mode compatibility
  workModeScore: 0.04,
  // Employment type compatibility
  employmentTypeScore: 0.03,
  // Location / geography
  locationScore: 0.05,
  // Semantic similarity between summaries
  semanticScore: 0.05,
  // Preferred (nice-to-have) skills
  preferredSkillsScore: 0.05,
  // Domain / industry alignment
  domainScore: 0.05,
  // Language alignment
  languageScore: 0.05,
  // Certification alignment
  certificationScore: 0.04,
  // Education alignment
  educationScore: 0.04,
  // Availability / timing alignment
  availabilityScore: 0.05,
  // Salary expectation alignment
  salaryScore: 0.03,
};

export const DEFAULT_JOB_THRESHOLDS: JobThresholds = {
  minDeterministicScore: 30,
  minPostAIScore: 25,
  maxResults: 100,
  sparseRecordThreshold: 30,
};

export const DEFAULT_JOB_FALLBACK_SCORES: JobFallbackScores = {
  missingSkills: 10,
  missingExperience: 15,
  missingSeniority: 20,
  missingLocation: 25,
  missingSemantic: 20,
  aiFailure: 0,
  // New fallback penalties for missing or unknown optional fields
  missingPreferredSkills: 5,
  missingDomain: 5,
  missingLanguages: 10,
  missingCertifications: 10,
  missingEducation: 10,
  missingAvailability: 10,
  missingSalary: 5,
};

export const DEFAULT_JOB_CONFIG: JobMatchingConfig = {
  defaultWeights: DEFAULT_JOB_WEIGHTS,
  thresholds: DEFAULT_JOB_THRESHOLDS,
  fallbackScores: DEFAULT_JOB_FALLBACK_SCORES,
  confidenceGates: DEFAULT_CONFIDENCE_GATES,
  features: {
    enableAIValidation: true,
    enableSemanticMatching: true,
    enableHardFilters: true,
    enableRelevantExperienceLogic: true,
  },
};

// ============================================================================
// SCORE BREAKDOWN
// ============================================================================

export interface DeterministicScoreBreakdown {
  components: ScoringComponent[];
  rawScore: number;
  normalizedScore: number;       // 0-100
  confidence: number;            // 0-1
  totalWeight: number;
  penalties: string[];
}

// ============================================================================
// MATCH RESULT
// ============================================================================

export interface JobMatchResult {
  matchId: string;
  jobId: string;
  candidateId: string;

  // Candidate summary
  candidateName: string;
  candidateTitle: string;
  candidateRoleArea: string;
  candidateSeniority: Seniority;

  // Scores
  deterministicScore: number;
  aiScore: number | null;
  finalScore: number;
  confidence: number;

  // Level
  matchLevel: MatchLevel;
  levelCappedReason: string | null;

  // Hard filter
  hardFilterStatus: HardFilterStatus;
  hardFilterReason: HardFilterReason;

  // Breakdown
  scoreBreakdown: DeterministicScoreBreakdown;

  // Explanation
  explanation: MatchExplanation;

  // Highlights
  keyReasons: string[];
  matchedSkills: string[];
  missingSkills: string[];

  /** Languages that meet or exceed the required proficiency */
  matchedLanguages: string[];
  /** Required languages that were missing or below proficiency */
  missingLanguages: string[];

  /** Certifications matched */
  matchedCertifications: string[];
  /** Certifications required but missing */
  missingCertifications: string[];

  /** Industries/domains matched */
  matchedIndustries: string[];
  /** Industries/domains missing */
  missingIndustries: string[];

  // Relevant experience detail
  relevantExperienceYears: number | null;
  totalExperienceYears: number | null;
  experienceNote: string;

  // Metadata
  rank: number;
  createdAt: Date;
  expiresAt: Date;
}

// ============================================================================
// REQUEST / RESPONSE
// ============================================================================

export interface FindJobMatchesRequest {
  jobId: string;
  limit?: number;
  offset?: number;
  includeAI?: boolean;
  includeExplanations?: boolean;
  filters?: JobMatchFilters;
}

export interface JobMatchFilters {
  locations?: string[];
  workModes?: WorkMode[];
  employmentTypes?: EmploymentType[];
  seniorities?: Seniority[];
  minExperience?: number;
  skills?: string[];
  excludeCandidateIds?: string[];
}

export interface JobMatchResponse {
  success: boolean;
  matches: JobMatchResult[];
  jobId: string;
  jobTitle: string;
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
  candidatesEvaluated: number;
  candidatesFiltered: number;
  processingTimeMs: number;
  generatedAt: Date;
}

// ============================================================================
// AI EXTRACTION (upload → form)
// ============================================================================

/**
 * Output shape from the AI when extracting a Job (Hiring) from an uploaded document.
 */
export interface ExtractedHiringFields {
  title?: string;
  roleArea?: string;
  seniority?: Seniority;
  location?: string;
  workMode?: WorkMode;
  employmentType?: EmploymentType;
  mustHaveSkills?: string[];
  preferredSkills?: string[];
  jobSummaryRequirements?: string;
  minimumYearsExperience?: number;
  hiringUrgency?: HiringUrgency;
  /** @internal raw tags suggested by AI */
  suggestedTags?: string[];
  /** @internal confidence 0-1 per field */
  fieldConfidence?: Record<string, number>;

  industries?: string[];
  requiredLanguages?: LanguageSkill[];
  requiredCertifications?: string[];
  requiredEducationLevels?: string[];
  salaryRange?: SalaryRange;
}

/**
 * Output shape from the AI when extracting a Candidate profile from an uploaded CV/resume.
 */
export interface ExtractedCandidateFields {
  title?: string;
  roleArea?: string;
  seniority?: Seniority;
  location?: string;
  desiredWorkMode?: WorkMode[];
  desiredEmploymentType?: EmploymentType[];
  skills?: string[];
  profileSummaryPreferences?: string;
  yearsOfExperience?: number;
  availability?: Availability;
  relevantExperience?: RelevantExperienceEntry[];
  suggestedTags?: string[];
  fieldConfidence?: Record<string, number>;

  languages?: LanguageSkill[];
  certifications?: string[];
  industries?: string[];
  education?: EducationEntry[];
  expectedSalary?: SalaryRange;
  noticePeriod?: number;
}

// ============================================================================
// AI VALIDATION ITEM
// ============================================================================

export interface JobAIValidationItem {
  candidateId: string;
  originalScore: number;
  adjustedScore: number;
  confidence: number;
  reasoning: string;
  redFlags: string[];
  greenFlags: string[];
}

export interface JobAIValidationRequest {
  job: HiringProfile;
  candidates: CandidateProfile[];
  deterministicScores: number[];
}

// ============================================================================
// STORED MATCH (for persistence)
// ============================================================================

export interface StoredJobMatch {
  id: string;
  jobId: string;
  candidateId: string;
  deterministicScore: number;
  aiScore: number | null;
  finalScore: number;
  confidence: number;
  matchLevel: MatchLevel;
  hardFilterStatus: HardFilterStatus;
  hardFilterReason: HardFilterReason | null;
  scoreBreakdown: string;   // JSON
  explanation: string | null;
  keyReasons: string[];
  rank: number;
  version: number;
  archived: boolean;
  createdAt: Date;
  expiresAt: Date;
}

// ============================================================================
// SENIORITY HELPERS
// ============================================================================

const SENIORITY_ORDER: Seniority[] = [
  Seniority.INTERN,
  Seniority.JUNIOR,
  Seniority.MID,
  Seniority.SENIOR,
  Seniority.LEAD,
  Seniority.MANAGER,
  Seniority.DIRECTOR,
  Seniority.VP,
  Seniority.C_LEVEL,
  Seniority.FOUNDER,
];

export function seniorityRank(s: Seniority): number {
  const idx = SENIORITY_ORDER.indexOf(s);
  return idx >= 0 ? idx : 2; // default to MID
}

export function seniorityDistance(a: Seniority, b: Seniority): number {
  return Math.abs(seniorityRank(a) - seniorityRank(b));
}
