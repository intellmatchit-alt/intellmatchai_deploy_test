/**
 * Job Matching V3 API
 *
 * API client functions for the v3 job matching engine:
 * hiring profiles, candidate profiles, and matching.
 *
 * @module lib/api/job-matching
 */

import { api } from './client';

// ============================================================================
// ENUMS & TYPES
// ============================================================================

export type JobSeniority = 'INTERN' | 'JUNIOR' | 'MID' | 'SENIOR' | 'LEAD' | 'MANAGER' | 'DIRECTOR' | 'VP' | 'C_LEVEL' | 'FOUNDER';
export type JobWorkMode = 'ONSITE' | 'HYBRID' | 'REMOTE';
export type JobEmploymentType = 'FULL_TIME' | 'PART_TIME' | 'CONTRACT' | 'FREELANCE' | 'INTERNSHIP';
export type JobHiringUrgency = 'LOW' | 'NORMAL' | 'URGENT' | 'CRITICAL';
export type JobAvailability = 'IMMEDIATELY' | 'WITHIN_2_WEEKS' | 'WITHIN_1_MONTH' | 'WITHIN_3_MONTHS' | 'NOT_ACTIVELY_LOOKING';
export type JobMatchLevel = 'POOR' | 'WEAK' | 'GOOD' | 'VERY_GOOD' | 'EXCELLENT';
export type JobHardFilterStatus = 'PASS' | 'FAIL' | 'WARN';
export type LanguageProficiency = 'BASIC' | 'CONVERSATIONAL' | 'FLUENT' | 'NATIVE';

export interface LanguageSkill {
  language: string;
  proficiency: LanguageProficiency;
}

export interface SalaryRange {
  min?: number;
  max?: number;
  currency: string;
}

export interface EducationEntry {
  degree: string;
  field: string;
  institution?: string;
  year?: number;
}

export interface RelevantExperienceEntry {
  roleFamily: string;
  domain?: string;
  skills: string[];
  years: number;
}

// ============================================================================
// HIRING PROFILE
// ============================================================================

export interface HiringProfile {
  id: string;
  userId: string;
  organizationId?: string | null;
  fullName?: string | null;
  title: string;
  roleArea: string;
  seniority: JobSeniority;
  location: string;
  workMode: JobWorkMode;
  employmentType: JobEmploymentType;
  mustHaveSkills: string[];
  preferredSkills: string[];
  jobSummaryRequirements: string;
  minimumYearsExperience?: number | null;
  hiringUrgency?: JobHiringUrgency | null;
  industries: string[];
  requiredLanguages: LanguageSkill[];
  requiredCertifications: string[];
  requiredEducationLevels: string[];
  salaryRange?: SalaryRange | null;
  dataQualityScore: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  _count?: { jobMatches: number };
}

export interface CreateHiringProfileInput {
  title: string;
  roleArea: string;
  seniority: JobSeniority;
  location: string;
  workMode: JobWorkMode;
  employmentType: JobEmploymentType;
  mustHaveSkills: string[];
  preferredSkills?: string[];
  jobSummaryRequirements: string;
  minimumYearsExperience?: number;
  hiringUrgency?: JobHiringUrgency;
  industries?: string[];
  requiredLanguages?: LanguageSkill[];
  requiredCertifications?: string[];
  requiredEducationLevels?: string[];
  salaryRange?: SalaryRange;
  fullName?: string;
}

// ============================================================================
// CANDIDATE PROFILE
// ============================================================================

export interface CandidateProfile {
  id: string;
  userId: string;
  organizationId?: string | null;
  fullName?: string | null;
  title: string;
  roleArea: string;
  seniority: JobSeniority;
  location: string;
  desiredWorkMode: JobWorkMode[];
  desiredEmploymentType: JobEmploymentType[];
  skills: string[];
  profileSummaryPreferences: string;
  yearsOfExperience?: number | null;
  availability?: JobAvailability | null;
  languages: LanguageSkill[];
  certifications: string[];
  industries: string[];
  education: EducationEntry[];
  expectedSalary?: SalaryRange | null;
  noticePeriod?: number | null;
  relevantExperience: RelevantExperienceEntry[];
  dataQualityScore: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  _count?: { jobMatches: number };
}

export interface CreateCandidateProfileInput {
  title: string;
  roleArea: string;
  seniority: JobSeniority;
  location: string;
  desiredWorkMode: JobWorkMode[];
  desiredEmploymentType: JobEmploymentType[];
  skills: string[];
  profileSummaryPreferences: string;
  yearsOfExperience?: number;
  availability?: JobAvailability;
  languages?: LanguageSkill[];
  certifications?: string[];
  industries?: string[];
  education?: EducationEntry[];
  expectedSalary?: SalaryRange;
  noticePeriod?: number;
  relevantExperience?: RelevantExperienceEntry[];
  fullName?: string;
}

// ============================================================================
// MATCH RESULT
// ============================================================================

export interface ScoringComponent {
  name: string;
  rawScore: number;
  weight: number;
  weightedScore: number;
  confidence: number;
  evidence: string[];
  penalties: string[];
  explanation: string;
}

export interface ScoreBreakdown {
  components: ScoringComponent[];
  rawScore: number;
  normalizedScore: number;
  confidence: number;
  totalWeight: number;
  penalties: string[];
}

export interface MatchExplanation {
  summary_explanation: string;
  match_level_label: string;
  band_explanation: string;
  strengths: string[];
  gaps_or_mismatches: string[];
  penalties: string[];
  confidence_note: string;
}

export interface JobMatchResult {
  matchId: string;
  jobId: string;
  candidateId: string;
  candidateName: string;
  candidateTitle: string;
  candidateRoleArea: string;
  candidateSeniority: JobSeniority;
  deterministicScore: number;
  aiScore: number | null;
  finalScore: number;
  confidence: number;
  matchLevel: JobMatchLevel;
  levelCappedReason: string | null;
  hardFilterStatus: JobHardFilterStatus;
  hardFilterReason: string | null;
  scoreBreakdown: ScoreBreakdown;
  explanation: MatchExplanation;
  keyReasons: string[];
  matchedSkills: string[];
  missingSkills: string[];
  matchedLanguages: string[];
  missingLanguages: string[];
  matchedCertifications: string[];
  missingCertifications: string[];
  matchedIndustries: string[];
  missingIndustries: string[];
  relevantExperienceYears: number | null;
  totalExperienceYears: number | null;
  experienceNote: string;
  rank: number;
  createdAt: string;
  expiresAt: string;
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
  generatedAt: string;
}

// ============================================================================
// AI EXTRACTION TYPES
// ============================================================================

export interface ExtractedHiringFields {
  title?: string;
  roleArea?: string;
  seniority?: JobSeniority;
  location?: string;
  workMode?: JobWorkMode;
  employmentType?: JobEmploymentType;
  mustHaveSkills?: string[];
  preferredSkills?: string[];
  jobSummaryRequirements?: string;
  minimumYearsExperience?: number;
  hiringUrgency?: JobHiringUrgency;
  industries?: string[];
  requiredLanguages?: LanguageSkill[];
  requiredCertifications?: string[];
  requiredEducationLevels?: string[];
  salaryRange?: SalaryRange;
}

export interface ExtractedCandidateFields {
  title?: string;
  roleArea?: string;
  seniority?: JobSeniority;
  location?: string;
  desiredWorkMode?: JobWorkMode[];
  desiredEmploymentType?: JobEmploymentType[];
  skills?: string[];
  profileSummaryPreferences?: string;
  yearsOfExperience?: number;
  availability?: JobAvailability;
  languages?: LanguageSkill[];
  certifications?: string[];
  industries?: string[];
  education?: EducationEntry[];
  expectedSalary?: SalaryRange;
  noticePeriod?: number;
}

// ============================================================================
// ENUM OPTION ARRAYS (for dropdowns/selectors)
// ============================================================================

export const JOB_SENIORITY_OPTIONS = [
  { id: 'INTERN', label: 'Intern', labelAr: 'متدرب' },
  { id: 'JUNIOR', label: 'Junior', labelAr: 'مبتدئ' },
  { id: 'MID', label: 'Mid-Level', labelAr: 'متوسط' },
  { id: 'SENIOR', label: 'Senior', labelAr: 'أقدم' },
  { id: 'LEAD', label: 'Lead', labelAr: 'قائد' },
  { id: 'MANAGER', label: 'Manager', labelAr: 'مدير' },
  { id: 'DIRECTOR', label: 'Director', labelAr: 'مدير تنفيذي' },
  { id: 'VP', label: 'VP', labelAr: 'نائب رئيس' },
  { id: 'C_LEVEL', label: 'C-Level', labelAr: 'مستوى تنفيذي' },
  { id: 'FOUNDER', label: 'Founder', labelAr: 'مؤسس' },
] as const;

export const JOB_WORK_MODE_OPTIONS = [
  { id: 'ONSITE', label: 'On-site', labelAr: 'في الموقع' },
  { id: 'HYBRID', label: 'Hybrid', labelAr: 'هجين' },
  { id: 'REMOTE', label: 'Remote', labelAr: 'عن بعد' },
] as const;

export const JOB_EMPLOYMENT_TYPE_OPTIONS = [
  { id: 'FULL_TIME', label: 'Full-time', labelAr: 'دوام كامل' },
  { id: 'PART_TIME', label: 'Part-time', labelAr: 'دوام جزئي' },
  { id: 'CONTRACT', label: 'Contract', labelAr: 'عقد' },
  { id: 'FREELANCE', label: 'Freelance', labelAr: 'عمل حر' },
  { id: 'INTERNSHIP', label: 'Internship', labelAr: 'تدريب' },
] as const;

export const JOB_HIRING_URGENCY_OPTIONS = [
  { id: 'LOW', label: 'Low', labelAr: 'منخفض' },
  { id: 'NORMAL', label: 'Normal', labelAr: 'عادي' },
  { id: 'URGENT', label: 'Urgent', labelAr: 'عاجل' },
  { id: 'CRITICAL', label: 'Critical', labelAr: 'حرج' },
] as const;

export const JOB_AVAILABILITY_OPTIONS = [
  { id: 'IMMEDIATELY', label: 'Immediately', labelAr: 'فوراً' },
  { id: 'WITHIN_2_WEEKS', label: 'Within 2 Weeks', labelAr: 'خلال أسبوعين' },
  { id: 'WITHIN_1_MONTH', label: 'Within 1 Month', labelAr: 'خلال شهر' },
  { id: 'WITHIN_3_MONTHS', label: 'Within 3 Months', labelAr: 'خلال 3 أشهر' },
  { id: 'NOT_ACTIVELY_LOOKING', label: 'Not Actively Looking', labelAr: 'غير باحث حالياً' },
] as const;

export const LANGUAGE_PROFICIENCY_OPTIONS = [
  { id: 'BASIC', label: 'Basic', labelAr: 'أساسي' },
  { id: 'CONVERSATIONAL', label: 'Conversational', labelAr: 'محادثة' },
  { id: 'FLUENT', label: 'Fluent', labelAr: 'طلاقة' },
  { id: 'NATIVE', label: 'Native', labelAr: 'لغة أم' },
] as const;

export const MATCH_LEVEL_COLORS: Record<JobMatchLevel, string> = {
  POOR: 'text-red-400 bg-red-500/10',
  WEAK: 'text-orange-400 bg-orange-500/10',
  GOOD: 'text-yellow-400 bg-yellow-500/10',
  VERY_GOOD: 'text-blue-400 bg-blue-500/10',
  EXCELLENT: 'text-green-400 bg-green-500/10',
};

export const MATCH_LEVEL_LABELS: Record<JobMatchLevel, string> = {
  POOR: 'Poor',
  WEAK: 'Weak',
  GOOD: 'Good',
  VERY_GOOD: 'Very Good',
  EXCELLENT: 'Excellent',
};

// ============================================================================
// API FUNCTIONS — Hiring Profiles
// ============================================================================

const BASE = '/job-matching';

export async function createHiringProfile(data: CreateHiringProfileInput): Promise<HiringProfile> {
  return api.post<HiringProfile>(`${BASE}/hiring-profiles`, data);
}

export async function listHiringProfiles(): Promise<HiringProfile[]> {
  const res = await api.get<HiringProfile[]>(`${BASE}/hiring-profiles`);
  return res;
}

export async function getHiringProfile(id: string): Promise<HiringProfile> {
  return api.get<HiringProfile>(`${BASE}/hiring-profiles/${id}`);
}

export async function updateHiringProfile(id: string, data: Partial<CreateHiringProfileInput>): Promise<HiringProfile> {
  return api.patch<HiringProfile>(`${BASE}/hiring-profiles/${id}`, data);
}

export async function deleteHiringProfile(id: string): Promise<void> {
  await api.delete(`${BASE}/hiring-profiles/${id}`);
}

// ============================================================================
// API FUNCTIONS — Candidate Profiles
// ============================================================================

export async function createCandidateProfile(data: CreateCandidateProfileInput): Promise<CandidateProfile> {
  return api.post<CandidateProfile>(`${BASE}/candidate-profiles`, data);
}

export async function listCandidateProfiles(): Promise<CandidateProfile[]> {
  return api.get<CandidateProfile[]>(`${BASE}/candidate-profiles`);
}

export async function getCandidateProfile(id: string): Promise<CandidateProfile> {
  return api.get<CandidateProfile>(`${BASE}/candidate-profiles/${id}`);
}

export async function updateCandidateProfile(id: string, data: Partial<CreateCandidateProfileInput>): Promise<CandidateProfile> {
  return api.patch<CandidateProfile>(`${BASE}/candidate-profiles/${id}`, data);
}

export async function deleteCandidateProfile(id: string): Promise<void> {
  await api.delete(`${BASE}/candidate-profiles/${id}`);
}

// ============================================================================
// API FUNCTIONS — Matching
// ============================================================================

export interface FindMatchesOptions {
  limit?: number;
  offset?: number;
  includeAI?: boolean;
  includeExplanations?: boolean;
  filters?: {
    locations?: string[];
    workModes?: JobWorkMode[];
    employmentTypes?: JobEmploymentType[];
    seniorities?: JobSeniority[];
    minExperience?: number;
    skills?: string[];
    excludeCandidateIds?: string[];
  };
}

export async function findJobMatches(jobId: string, options?: FindMatchesOptions): Promise<JobMatchResponse> {
  const res = await api.post<{ data: JobMatchResponse }>(`${BASE}/jobs/${jobId}/matches`, options || {});
  return (res as any).data || res;
}

export async function getJobMatches(jobId: string, limit = 50): Promise<JobMatchResult[]> {
  const res = await api.get<{ matches: JobMatchResult[] }>(`${BASE}/jobs/${jobId}/matches?limit=${limit}`);
  return (res as any).matches || [];
}

// ============================================================================
// API FUNCTIONS — AI Extraction
// ============================================================================

export async function extractHiringFromText(text: string): Promise<ExtractedHiringFields> {
  return api.post<ExtractedHiringFields>(`${BASE}/jobs/extract-hiring`, { text });
}

export async function extractCandidateFromText(text: string): Promise<ExtractedCandidateFields> {
  return api.post<ExtractedCandidateFields>(`${BASE}/jobs/extract-candidate`, { text });
}
