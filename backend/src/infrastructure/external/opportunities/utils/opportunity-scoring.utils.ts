/**
 * Opportunity Scoring Utilities
 *
 * Core scoring algorithms with:
 * - NO neutral 50 defaults - conservative fallbacks only
 * - Strict confidence gating
 * - Sparse profile detection and penalty
 * - Recent title window (3-5 years)
 * - Hard filters for CEO/Founder/Board → IC
 *
 * @module utils/opportunity-scoring
 */

import { SeniorityLevel, OpportunityIntentType, GoalType } from '@prisma/client';
import {
  CareerTrack,
  RoleFamily,
  MatchLevel,
  HardFilterStatus,
  HardFilterReason,
  HardFilterResult,
  ConfidenceLevel,
  ScoringComponent,
  MatchResult,
  MatchCandidate,
  IntentWithDetails,
  UserProfile,
  ParsedSeniority,
  ParsedExperience,
  ExperienceEntry,
  ScoringWeights,
  DEFAULT_SCORING_WEIGHTS,
  NETWORKING_SCORING_WEIGHTS,
  ROLE_FAMILY_PATTERNS,
  SENIORITY_PATTERNS,
  INTENT_COMPATIBILITY,
  INTENT_TO_GOALS,
  IC_FAVORABLE_TITLES,
  IC_PENALTY_TITLES,
  FALLBACK_SCORES,
  CONFIDENCE_GATES,
  RECENT_TITLE_WINDOW_YEARS,
  MIN_NON_SPARSE_DATA_POINTS,
  scoreToMatchLevel,
  applyConfidenceCap,
} from '../types/opportunity-matching.types';
import { skillTaxonomyService } from './skill-taxonomy-integration';
import { logger } from '../../../../shared/logger';

// ============================================================================
// SECTION 1: ROLE FAMILY NORMALIZATION
// ============================================================================

export function normalizeToRoleFamily(jobTitle: string | null | undefined): RoleFamily {
  if (!jobTitle) return RoleFamily.UNKNOWN;

  const title = jobTitle.toLowerCase();

  for (const [family, patterns] of Object.entries(ROLE_FAMILY_PATTERNS)) {
    for (const pattern of patterns) {
      if (pattern.test(title)) {
        return family as RoleFamily;
      }
    }
  }

  return RoleFamily.UNKNOWN;
}

export function areRoleFamiliesCompatible(targetFamily: RoleFamily, candidateFamily: RoleFamily): boolean {
  if (targetFamily === candidateFamily) return true;
  if (candidateFamily === RoleFamily.UNKNOWN) return false;
  if (targetFamily === RoleFamily.UNKNOWN) return true;

  const compatibleFamilies: Record<RoleFamily, RoleFamily[]> = {
    [RoleFamily.ENGINEERING]: [RoleFamily.DATA, RoleFamily.DEVOPS, RoleFamily.QA, RoleFamily.SECURITY],
    [RoleFamily.DATA]: [RoleFamily.ENGINEERING, RoleFamily.PRODUCT],
    [RoleFamily.DEVOPS]: [RoleFamily.ENGINEERING, RoleFamily.SECURITY],
    [RoleFamily.PRODUCT]: [RoleFamily.DESIGN, RoleFamily.DATA, RoleFamily.ENGINEERING],
    [RoleFamily.DESIGN]: [RoleFamily.PRODUCT],
    [RoleFamily.QA]: [RoleFamily.ENGINEERING],
    [RoleFamily.SECURITY]: [RoleFamily.ENGINEERING, RoleFamily.DEVOPS],
    [RoleFamily.SALES]: [RoleFamily.MARKETING],
    [RoleFamily.MARKETING]: [RoleFamily.SALES],
    [RoleFamily.HR]: [],
    [RoleFamily.FINANCE]: [RoleFamily.OPERATIONS],
    [RoleFamily.OPERATIONS]: [RoleFamily.FINANCE],
    [RoleFamily.LEGAL]: [],
    [RoleFamily.EXECUTIVE]: [],
    [RoleFamily.FOUNDER]: [],
    [RoleFamily.BOARD]: [],
    [RoleFamily.ADVISORY]: [],
    [RoleFamily.UNKNOWN]: [],
  };

  return compatibleFamilies[targetFamily]?.includes(candidateFamily) ?? false;
}

// ============================================================================
// SECTION 2: CAREER TRACK CLASSIFICATION
// ============================================================================

export function inferCareerTrack(jobTitle: string | null | undefined): CareerTrack {
  if (!jobTitle) return CareerTrack.UNKNOWN;

  const title = jobTitle.toLowerCase();

  if (/\b(founder|co-?founder|owner|entrepreneur)\b/i.test(title)) {
    return CareerTrack.FOUNDER;
  }

  if (/\b(board\s*(member|director|of directors)|chairman|non-?exec)\b/i.test(title) && !/\bonboard/i.test(title)) {
    return CareerTrack.BOARD;
  }

  if (/\b(advisor|adviser|consultant|mentor)\b/i.test(title) && !/\bsenior\b/i.test(title)) {
    return CareerTrack.ADVISOR;
  }

  // Treat investors and partners as advisors/consultants for career track purposes
  if (/\b(investor|partner)\b/i.test(title) && !/\bsenior\b/i.test(title)) {
    return CareerTrack.ADVISOR;
  }

  if (/\b(ceo|cto|cfo|coo|cmo|cio|cpo|ciso|chro|cro|chief)\b/i.test(title)) {
    return CareerTrack.EXECUTIVE;
  }

  if (/\b(vp|vice president|president|evp|svp)\b/i.test(title)) {
    return CareerTrack.EXECUTIVE;
  }

  if (/\b(director|head of|manager|managing|lead|team lead)\b/i.test(title)) {
    return CareerTrack.MANAGEMENT;
  }

  return CareerTrack.INDIVIDUAL_CONTRIBUTOR;
}

export function calculateTrackCompatibility(
  intentType: OpportunityIntentType,
  targetTrack: CareerTrack,
  candidateTrack: CareerTrack,
  hasRecentTechnicalEvidence: boolean
): { score: number; compatible: boolean; reason: string } {
  if (intentType === 'HIRING') {
    if (targetTrack === candidateTrack) {
      return { score: 100, compatible: true, reason: 'Same career track' };
    }

    if (targetTrack === CareerTrack.INDIVIDUAL_CONTRIBUTOR) {
      if (candidateTrack === CareerTrack.EXECUTIVE) {
        if (hasRecentTechnicalEvidence) {
          return { score: 25, compatible: false, reason: 'Executive with recent tech work - unlikely to accept IC role' };
        }
        return { score: 5, compatible: false, reason: 'Executive will not accept IC role' };
      }
      if (candidateTrack === CareerTrack.FOUNDER) {
        if (hasRecentTechnicalEvidence) {
          return { score: 20, compatible: false, reason: 'Founder with tech background - unlikely to accept IC role' };
        }
        return { score: 5, compatible: false, reason: 'Founder will not accept employee IC role' };
      }
      if (candidateTrack === CareerTrack.BOARD) {
        return { score: 0, compatible: false, reason: 'Board member will not accept IC role' };
      }
      if (candidateTrack === CareerTrack.ADVISOR) {
        return { score: 10, compatible: false, reason: 'Advisor typically not seeking full-time IC role' };
      }
      if (candidateTrack === CareerTrack.MANAGEMENT) {
        return { score: 55, compatible: true, reason: 'Manager may transition to senior IC' };
      }
      if (candidateTrack === CareerTrack.UNKNOWN) {
        return { score: FALLBACK_SCORES.MISSING_TRACK, compatible: true, reason: 'Track unclear - conservative score' };
      }
    }

    if (targetTrack === CareerTrack.MANAGEMENT) {
      if (candidateTrack === CareerTrack.INDIVIDUAL_CONTRIBUTOR) {
        return { score: 65, compatible: true, reason: 'IC may be ready for management transition' };
      }
      if (candidateTrack === CareerTrack.EXECUTIVE) {
        return { score: 25, compatible: false, reason: 'Executive unlikely to step down to management' };
      }
      if (candidateTrack === CareerTrack.FOUNDER) {
        return { score: 20, compatible: false, reason: 'Founder unlikely to take management employee role' };
      }
    }

    if (targetTrack === CareerTrack.EXECUTIVE) {
      if (candidateTrack === CareerTrack.INDIVIDUAL_CONTRIBUTOR) {
        return { score: 15, compatible: false, reason: 'IC needs significant growth for executive role' };
      }
      if (candidateTrack === CareerTrack.MANAGEMENT) {
        return { score: 70, compatible: true, reason: 'Manager may be ready for executive transition' };
      }
      if (candidateTrack === CareerTrack.FOUNDER) {
        return { score: 60, compatible: true, reason: 'Founder may take executive role' };
      }
    }

    if (targetTrack === CareerTrack.UNKNOWN || candidateTrack === CareerTrack.UNKNOWN) {
      return { score: FALLBACK_SCORES.MISSING_TRACK, compatible: true, reason: 'Track unclear - conservative score' };
    }

    return { score: 40, compatible: true, reason: 'Track compatibility unclear' };
  }

  if (intentType === 'OPEN_TO_OPPORTUNITIES') {
    if (candidateTrack === CareerTrack.EXECUTIVE || candidateTrack === CareerTrack.FOUNDER) {
      return { score: 95, compatible: true, reason: 'Decision maker who can hire' };
    }
    if (candidateTrack === CareerTrack.MANAGEMENT) {
      return { score: 80, compatible: true, reason: 'Manager who can hire for team' };
    }
    if (candidateTrack === CareerTrack.BOARD || candidateTrack === CareerTrack.ADVISOR) {
      return { score: 60, compatible: true, reason: 'Can make introductions' };
    }
    if (candidateTrack === CareerTrack.INDIVIDUAL_CONTRIBUTOR) {
      return { score: 30, compatible: true, reason: 'Peer - can refer but not hire' };
    }
  }

  if (intentType === 'ADVISORY_BOARD') {
    if (candidateTrack === CareerTrack.EXECUTIVE || candidateTrack === CareerTrack.FOUNDER ||
        candidateTrack === CareerTrack.BOARD || candidateTrack === CareerTrack.ADVISOR) {
      return { score: 90, compatible: true, reason: 'Senior professional for advisory' };
    }
  }

  return { score: 40, compatible: true, reason: 'General compatibility' };
}

// ============================================================================
// SECTION 3: SENIORITY DETECTION
// ============================================================================

export function parseSeniority(jobTitle: string | null | undefined): ParsedSeniority {
  if (!jobTitle) {
    return { level: null, ladder: null, rank: 0 };
  }

  const title = jobTitle.toLowerCase();

  for (const [pattern, info] of Object.entries(SENIORITY_PATTERNS)) {
    const regex = new RegExp(`\\b${pattern}\\b`, 'i');
    if (regex.test(title)) {
      return {
        level: info.level,
        ladder: info.ladder,
        rank: info.rank,
      };
    }
  }

  return { level: 'MID', ladder: 'IC', rank: 2 };
}

export function calculateSeniorityFit(
  intentType: OpportunityIntentType,
  targetSeniority: SeniorityLevel | null,
  candidateSeniority: ParsedSeniority
): number {
  if (!candidateSeniority.level) return FALLBACK_SCORES.MISSING_EXPERIENCE;

  const targetParsed = targetSeniority ? parseSeniority(targetSeniority) : { level: 'SENIOR', ladder: 'IC', rank: 3 };

  if (intentType === 'HIRING') {
    const rankDiff = candidateSeniority.rank - targetParsed.rank;

    if (candidateSeniority.ladder !== targetParsed.ladder && candidateSeniority.ladder !== null) {
      if (candidateSeniority.ladder === 'EXECUTIVE' && targetParsed.ladder === 'IC') {
        return 10;
      }
    }

    if (Math.abs(rankDiff) === 0) return 100;
    if (Math.abs(rankDiff) === 1) return 85;
    if (Math.abs(rankDiff) === 2) return 65;
    if (rankDiff >= 3) return 35;
    if (rankDiff <= -3) return 15;

    return 45;
  }

  if (intentType === 'OPEN_TO_OPPORTUNITIES') {
    const rankDiff = candidateSeniority.rank - targetParsed.rank;

    if (rankDiff >= 4) return 100;
    if (rankDiff >= 2) return 90;
    if (rankDiff === 1) return 75;
    if (rankDiff === 0) return 30;
    if (rankDiff < 0) return 10;

    return 45;
  }

  return 55;
}

// ============================================================================
// SECTION 4: EXPERIENCE PARSING
// ============================================================================

export function parseExperience(
  workHistory: ExperienceEntry[] | undefined,
  targetRoleFamily: RoleFamily
): ParsedExperience {
  if (!workHistory || workHistory.length === 0) {
    return {
      totalExperienceMonths: 0,
      relevantExperienceMonths: 0,
      recentRelevantExperienceMonths: 0,
      technicalExperienceMonths: 0,
      managementExperienceMonths: 0,
      currentRoleFamily: RoleFamily.UNKNOWN,
      hasRecentTechnicalEvidence: false,
      careerTrajectory: 'UNKNOWN',
    };
  }

  const now = new Date();
  const recentYearsAgo = new Date(now.getTime() - RECENT_TITLE_WINDOW_YEARS * 365 * 24 * 60 * 60 * 1000);
  const fiveYearsAgo = new Date(now.getTime() - 5 * 365 * 24 * 60 * 60 * 1000);

  const sorted = [...workHistory].sort((a, b) => a.startDate.getTime() - b.startDate.getTime());

  const mergedPeriods: { start: Date; end: Date }[] = [];
  for (const entry of sorted) {
    const end = entry.endDate || now;
    const start = entry.startDate;

    if (mergedPeriods.length === 0) {
      mergedPeriods.push({ start, end });
    } else {
      const last = mergedPeriods[mergedPeriods.length - 1];
      if (start <= last.end) {
        last.end = new Date(Math.max(last.end.getTime(), end.getTime()));
      } else {
        mergedPeriods.push({ start, end });
      }
    }
  }

  let totalExperienceMonths = 0;
  for (const period of mergedPeriods) {
    const months = (period.end.getTime() - period.start.getTime()) / (30 * 24 * 60 * 60 * 1000);
    totalExperienceMonths += months;
  }
  totalExperienceMonths = Math.round(totalExperienceMonths);

  let relevantExperienceMonths = 0;
  let recentRelevantExperienceMonths = 0;
  let technicalExperienceMonths = 0;
  let managementExperienceMonths = 0;
  let hasRecentTechnicalEvidence = false;

  const technicalFamilies = [RoleFamily.ENGINEERING, RoleFamily.DATA, RoleFamily.DEVOPS, RoleFamily.QA, RoleFamily.SECURITY];
  const managementTracks = ['MANAGEMENT', 'EXECUTIVE'];

  for (const entry of sorted) {
    const roleFamily = normalizeToRoleFamily(entry.title);
    const track = inferCareerTrack(entry.title);
    const end = entry.endDate || now;
    const start = entry.startDate;
    const months = Math.round((end.getTime() - start.getTime()) / (30 * 24 * 60 * 60 * 1000));

    if (roleFamily === targetRoleFamily || areRoleFamiliesCompatible(targetRoleFamily, roleFamily)) {
      relevantExperienceMonths += months;

      if (end >= fiveYearsAgo) {
        const effectiveStart = new Date(Math.max(start.getTime(), fiveYearsAgo.getTime()));
        const recentMonths = Math.round((end.getTime() - effectiveStart.getTime()) / (30 * 24 * 60 * 60 * 1000));
        recentRelevantExperienceMonths += recentMonths;
      }
    }

    if (technicalFamilies.includes(roleFamily) || track === CareerTrack.INDIVIDUAL_CONTRIBUTOR) {
      technicalExperienceMonths += months;

      if (end >= recentYearsAgo && track === CareerTrack.INDIVIDUAL_CONTRIBUTOR) {
        hasRecentTechnicalEvidence = true;
      }
    }

    if (managementTracks.includes(track)) {
      managementExperienceMonths += months;
    }
  }

  const mostRecent = sorted[sorted.length - 1];
  const currentRoleFamily = normalizeToRoleFamily(mostRecent?.title);

  let careerTrajectory: ParsedExperience['careerTrajectory'] = 'UNKNOWN';
  if (sorted.length >= 2) {
    const firstTrack = inferCareerTrack(sorted[0].title);
    const lastTrack = inferCareerTrack(sorted[sorted.length - 1].title);
    const firstSeniority = parseSeniority(sorted[0].title);
    const lastSeniority = parseSeniority(sorted[sorted.length - 1].title);

    if (lastSeniority.rank > firstSeniority.rank) {
      careerTrajectory = 'ASCENDING';
    } else if (lastSeniority.rank < firstSeniority.rank) {
      careerTrajectory = 'DESCENDING';
    } else if (firstTrack !== lastTrack) {
      careerTrajectory = 'PIVOTING';
    } else {
      careerTrajectory = 'LATERAL';
    }
  }

  return {
    totalExperienceMonths,
    relevantExperienceMonths,
    recentRelevantExperienceMonths,
    technicalExperienceMonths,
    managementExperienceMonths,
    currentRoleFamily,
    hasRecentTechnicalEvidence,
    careerTrajectory,
  };
}

// ============================================================================
// SECTION 5: SPARSE PROFILE DETECTION
// ============================================================================

export function isSparseProfile(candidate: MatchCandidate): boolean {
  let dataPoints = 0;

  if (candidate.skills && candidate.skills.length > 0) dataPoints++;
  if (candidate.workHistory && candidate.workHistory.length > 0) dataPoints++;
  if (candidate.jobTitle && candidate.jobTitle.trim().length > 0) dataPoints++;
  if (candidate.careerTrack !== CareerTrack.UNKNOWN) dataPoints++;
  if (candidate.experience?.hasRecentTechnicalEvidence) dataPoints++;
  if (candidate.roleFamily !== RoleFamily.UNKNOWN) dataPoints++;
  if (candidate.bio && candidate.bio.length > 20) dataPoints++;
  if (candidate.location && candidate.location.trim().length > 0) dataPoints++;

  return dataPoints < MIN_NON_SPARSE_DATA_POINTS;
}

export function countDataPoints(candidate: MatchCandidate): number {
  let dataPoints = 0;

  if (candidate.skills && candidate.skills.length > 0) dataPoints++;
  if (candidate.skills && candidate.skills.length >= 3) dataPoints++;
  if (candidate.workHistory && candidate.workHistory.length > 0) dataPoints++;
  if (candidate.jobTitle && candidate.jobTitle.trim().length > 0) dataPoints++;
  if (candidate.careerTrack !== CareerTrack.UNKNOWN) dataPoints++;
  if (candidate.experience?.hasRecentTechnicalEvidence) dataPoints++;
  if (candidate.roleFamily !== RoleFamily.UNKNOWN) dataPoints++;
  if (candidate.bio && candidate.bio.length > 50) dataPoints++;
  if (candidate.location && candidate.location.trim().length > 0) dataPoints++;
  if (candidate.sectors && candidate.sectors.length > 0) dataPoints++;
  if (candidate.goals && candidate.goals.length > 0) dataPoints++;

  return dataPoints;
}

// ============================================================================
// SECTION 6: HARD FILTERS
// ============================================================================

export function applyHardFilters(
  intent: IntentWithDetails,
  candidate: MatchCandidate,
  config: { minRequiredSkillCoverage: number; strictLocationMatching: boolean }
): HardFilterResult {
  const reasons: HardFilterReason[] = [];
  const details: string[] = [];

  const targetRoleFamily = normalizeToRoleFamily(intent.roleArea);
  const targetTrack = inferCareerTrack(intent.roleArea || '');

  if (intent.intentType === 'HIRING' && intent.roleArea) {
    if (!areRoleFamiliesCompatible(targetRoleFamily, candidate.roleFamily)) {
      reasons.push(HardFilterReason.ROLE_FAMILY_INCOMPATIBLE);
      details.push(`Target role: ${targetRoleFamily}, Candidate: ${candidate.roleFamily}`);
    }
  }

  if (intent.intentType === 'HIRING') {
    if (targetTrack === CareerTrack.INDIVIDUAL_CONTRIBUTOR) {
      if (candidate.careerTrack === CareerTrack.EXECUTIVE && !candidate.experience?.hasRecentTechnicalEvidence) {
        reasons.push(HardFilterReason.EXECUTIVE_FOR_IC_ROLE);
        details.push('Executive without recent technical work cannot fill IC role');
      }
      if (candidate.careerTrack === CareerTrack.FOUNDER && !candidate.experience?.hasRecentTechnicalEvidence) {
        reasons.push(HardFilterReason.FOUNDER_FOR_EMPLOYEE_ROLE);
        details.push('Founder without recent technical work will not accept IC employee role');
      }
      if (candidate.careerTrack === CareerTrack.BOARD) {
        reasons.push(HardFilterReason.TRACK_INCOMPATIBLE);
        details.push('Board member will not accept IC role');
      }
      // Treat advisors and similar as incompatible for IC roles
      if (candidate.careerTrack === CareerTrack.ADVISOR) {
        reasons.push(HardFilterReason.TRACK_INCOMPATIBLE);
        details.push('Advisor/investor/partner unlikely to accept IC role');
      }
    }
  }

  const requiredSkills = intent.skillPrefs
    .filter(sp => sp.isRequired)
    .map(sp => sp.skill.name.toLowerCase());

  if (requiredSkills.length > 0) {
    const candidateSkills = new Set(candidate.skills.map(s => s.toLowerCase()));
    const matched = requiredSkills.filter(s => candidateSkills.has(s));
    const coverage = matched.length / requiredSkills.length;

    if (coverage < config.minRequiredSkillCoverage) {
      reasons.push(HardFilterReason.MISSING_REQUIRED_SKILLS);
      const missing = requiredSkills.filter(s => !candidateSkills.has(s));
      details.push(`Missing required skills: ${missing.join(', ')}`);
    }
  }

  if (config.strictLocationMatching && intent.locationPref && !intent.remoteOk) {
    if (!candidate.location || !locationMatches(intent.locationPref, candidate.location)) {
      reasons.push(HardFilterReason.LOCATION_INCOMPATIBLE);
      details.push(`Required: ${intent.locationPref}, Candidate: ${candidate.location || 'Unknown'}`);
    }
  }

  if (intent.minExperienceYears && intent.minExperienceYears > 0) {
    const hasExperienceData = candidate.experience && candidate.experience.totalExperienceMonths > 0;
    if (hasExperienceData) {
      const candidateYears = candidate.experience!.relevantExperienceMonths / 12;
      if (candidateYears < intent.minExperienceYears * 0.7) {
        reasons.push(HardFilterReason.INSUFFICIENT_EXPERIENCE);
        details.push(`Required: ${intent.minExperienceYears}+ years, Candidate: ~${Math.round(candidateYears)} years`);
      }
    }
    // When experience data is unknown (no work history), skip the hard filter.
    // The scoring stage will still penalise missing experience with a low score.
  }

  if (intent.intentType === 'HIRING' && isSparseProfile(candidate)) {
    reasons.push(HardFilterReason.SPARSE_PROFILE);
    details.push(`Sparse profile with only ${countDataPoints(candidate)} data points`);
  }

  let status: HardFilterStatus;
  if (reasons.length === 0) {
    status = HardFilterStatus.PASS;
  } else if (
    reasons.includes(HardFilterReason.EXECUTIVE_FOR_IC_ROLE) ||
    reasons.includes(HardFilterReason.FOUNDER_FOR_EMPLOYEE_ROLE) ||
    reasons.includes(HardFilterReason.TRACK_INCOMPATIBLE)
  ) {
    status = HardFilterStatus.FAIL;
  } else if (reasons.length >= 2) {
    status = HardFilterStatus.FAIL;
  } else {
    status = HardFilterStatus.REVIEW;
  }

  return { status, reasons, details };
}

function locationMatches(required: string, candidate: string): boolean {
  const reqLower = required.toLowerCase();
  const candLower = candidate.toLowerCase();

  if (candLower.includes(reqLower) || reqLower.includes(candLower)) {
    return true;
  }

  if (candLower.includes('remote') || reqLower.includes('remote')) {
    return true;
  }

  const reqCity = required.split(',')[0].trim().toLowerCase();
  const candCity = candidate.split(',')[0].trim().toLowerCase();

  return reqCity === candCity;
}

// ============================================================================
// SECTION 7: TITLE RELEVANCE (WITH RECENT WINDOW)
// ============================================================================

export function calculateTitleRelevance(
  intentType: OpportunityIntentType,
  roleArea: string | null,
  candidateTitle: string | null,
  hasRecentTechnicalEvidence: boolean
): { score: number; penalty: boolean; reason: string; confidence: ConfidenceLevel } {
  if (!candidateTitle) {
    return {
      score: FALLBACK_SCORES.MISSING_TITLE,
      penalty: false,
      reason: 'No title data - conservative score',
      confidence: ConfidenceLevel.LOW,
    };
  }

  if (!roleArea) {
    return {
      score: FALLBACK_SCORES.MISSING_ROLE_FAMILY,
      penalty: false,
      reason: 'No role specified - conservative score',
      confidence: ConfidenceLevel.LOW,
    };
  }

  const targetRoleFamily = normalizeToRoleFamily(roleArea);

  if (intentType !== 'HIRING') {
    return { score: 55, penalty: false, reason: 'Title relevance less critical for this intent', confidence: ConfidenceLevel.MEDIUM };
  }

  if (targetRoleFamily === RoleFamily.ENGINEERING || targetRoleFamily === RoleFamily.DATA ||
      targetRoleFamily === RoleFamily.DEVOPS || targetRoleFamily === RoleFamily.QA ||
      targetRoleFamily === RoleFamily.DESIGN || targetRoleFamily === RoleFamily.PRODUCT) {

    for (const pattern of IC_PENALTY_TITLES) {
      if (pattern.test(candidateTitle)) {
        if (hasRecentTechnicalEvidence) {
          return {
            score: 30,
            penalty: true,
            reason: `${candidateTitle} - has recent tech work but unlikely to accept IC role`,
            confidence: ConfidenceLevel.MEDIUM,
          };
        }
        return {
          score: 5,
          penalty: true,
          reason: `${candidateTitle} will not accept IC role`,
          confidence: ConfidenceLevel.HIGH,
        };
      }
    }

    for (const pattern of IC_FAVORABLE_TITLES) {
      if (pattern.test(candidateTitle)) {
        return {
          score: 95,
          penalty: false,
          reason: 'Title matches IC role requirements',
          confidence: ConfidenceLevel.HIGH,
        };
      }
    }
  }

  const candidateFamily = normalizeToRoleFamily(candidateTitle);
  if (candidateFamily === targetRoleFamily) {
    return { score: 85, penalty: false, reason: 'Title in same role family', confidence: ConfidenceLevel.HIGH };
  }

  if (areRoleFamiliesCompatible(targetRoleFamily, candidateFamily)) {
    return { score: 60, penalty: false, reason: 'Title in adjacent role family', confidence: ConfidenceLevel.MEDIUM };
  }

  return { score: 25, penalty: false, reason: 'Title in different role family', confidence: ConfidenceLevel.MEDIUM };
}

// ============================================================================
// SECTION 8: ROLE AREA MATCHING
// ============================================================================

export function calculateRoleAreaMatch(
  intentType: OpportunityIntentType,
  roleArea: string | null,
  candidateTitle: string | null,
  candidateBio: string | null
): { score: number; confidence: ConfidenceLevel; evidence: string[] } {
  const evidence: string[] = [];

  if (!roleArea) {
    return { score: FALLBACK_SCORES.MISSING_ROLE_FAMILY, confidence: ConfidenceLevel.LOW, evidence: ['No role specified - conservative score'] };
  }

  if (!candidateTitle) {
    return { score: FALLBACK_SCORES.MISSING_TITLE, confidence: ConfidenceLevel.LOW, evidence: ['No candidate title - conservative score'] };
  }

  const targetFamily = normalizeToRoleFamily(roleArea);
  const candidateFamily = normalizeToRoleFamily(candidateTitle);

  if (targetFamily === candidateFamily && targetFamily !== RoleFamily.UNKNOWN) {
    evidence.push(`Both in ${targetFamily} role family`);
    return { score: 100, confidence: ConfidenceLevel.HIGH, evidence };
  }

  if (areRoleFamiliesCompatible(targetFamily, candidateFamily)) {
    evidence.push(`Compatible role families: ${targetFamily} ↔ ${candidateFamily}`);
    return { score: 70, confidence: ConfidenceLevel.MEDIUM, evidence };
  }

  if (candidateFamily === RoleFamily.UNKNOWN) {
    evidence.push('Cannot determine candidate role family');
    return { score: FALLBACK_SCORES.MISSING_ROLE_FAMILY, confidence: ConfidenceLevel.LOW, evidence };
  }

  if (candidateBio) {
    const bioLower = candidateBio.toLowerCase();
    const roleKeywords = roleArea.toLowerCase().split(/\s+/);
    const matchedKeywords = roleKeywords.filter(k => k.length > 3 && bioLower.includes(k));

    if (matchedKeywords.length >= 2) {
      evidence.push(`Bio mentions: ${matchedKeywords.join(', ')}`);
      return { score: 55, confidence: ConfidenceLevel.MEDIUM, evidence };
    }
  }

  evidence.push(`Role families don't match: ${targetFamily} vs ${candidateFamily}`);
  return { score: 15, confidence: ConfidenceLevel.HIGH, evidence };
}

// ============================================================================
// SECTION 9: CONFIDENCE CALCULATION
// ============================================================================

export function calculateConfidenceScore(candidate: MatchCandidate): number {
  const dataPoints = countDataPoints(candidate);
  const maxPoints = 11;

  const rawScore = Math.round((dataPoints / maxPoints) * 100);

  return Math.min(100, Math.max(10, rawScore));
}

export function confidenceScoreToLevel(score: number): ConfidenceLevel {
  if (score >= CONFIDENCE_GATES.EXCELLENT_MIN) return ConfidenceLevel.HIGH;
  if (score >= CONFIDENCE_GATES.WEAK_MAX) return ConfidenceLevel.MEDIUM;
  return ConfidenceLevel.LOW;
}

export function calculateConfidence(candidate: MatchCandidate): ConfidenceLevel {
  const score = calculateConfidenceScore(candidate);
  return confidenceScoreToLevel(score);
}

// ============================================================================
// SECTION 10: MAIN SCORING FUNCTION
// ============================================================================

function getWeightsForIntent(intentType: OpportunityIntentType): ScoringWeights {
  if (intentType === 'HIRING') {
    return DEFAULT_SCORING_WEIGHTS;
  }
  return NETWORKING_SCORING_WEIGHTS;
}

export function scoreCandidate(
  intent: IntentWithDetails,
  user: UserProfile,
  candidate: MatchCandidate,
  weights?: ScoringWeights
): MatchResult {
  const effectiveWeights = weights || getWeightsForIntent(intent.intentType);
  const componentScores: ScoringComponent[] = [];
  const keyStrengths: string[] = [];
  const keyRisks: string[] = [];
  const missingRequiredSkills: string[] = [];

  const sparseProfile = isSparseProfile(candidate);
  if (sparseProfile) {
    keyRisks.push('Sparse profile - limited data available');
  }

  const intentSkills = new Set(intent.skillPrefs.map(sp => sp.skill.name.toLowerCase()));
  const userSkills = new Set(user.userSkills.map(us => us.skill.name.toLowerCase()));
  const allTargetSkills = new Set([...intentSkills, ...userSkills]);

  const intentSectors = new Set(intent.sectorPrefs.map(sp => sp.sector.name.toLowerCase()));
  const userSectors = new Set(user.userSectors.map(us => us.sector.name.toLowerCase()));
  const allTargetSectors = new Set([...intentSectors, ...userSectors]);

  // 1. Title Relevance
  const titleResult = calculateTitleRelevance(
    intent.intentType,
    intent.roleArea,
    candidate.jobTitle,
    candidate.experience?.hasRecentTechnicalEvidence ?? false
  );

  componentScores.push({
    name: 'titleRelevance',
    rawScore: titleResult.score,
    weight: effectiveWeights.titleRelevance,
    weightedScore: Math.round(titleResult.score * effectiveWeights.titleRelevance),
    confidence: titleResult.confidence,
    explanation: titleResult.reason,
    evidence: [`Current title: ${candidate.jobTitle || 'Unknown'}`],
  });

  if (titleResult.penalty) {
    keyRisks.push(titleResult.reason);
  } else if (titleResult.score >= 80) {
    keyStrengths.push('Title strongly matches role requirements');
  }

  // 2. Skill Match
  const candidateSkillsSet = new Set(candidate.skills.map(s => s.toLowerCase()));
  const requiredSkills = intent.skillPrefs.filter(sp => sp.isRequired).map(sp => sp.skill.name.toLowerCase());
  const preferredSkills = intent.skillPrefs.filter(sp => !sp.isRequired).map(sp => sp.skill.name.toLowerCase());

  let skillMatchScore = 0;
  let skillConfidence = ConfidenceLevel.LOW;

  if (candidate.skills.length === 0) {
    skillMatchScore = FALLBACK_SCORES.MISSING_SKILLS;
    skillConfidence = ConfidenceLevel.LOW;
    keyRisks.push('No skills listed on profile');
  } else {
    const matchedRequired = requiredSkills.filter(s => candidateSkillsSet.has(s));
    const matchedPreferred = preferredSkills.filter(s => candidateSkillsSet.has(s));

    for (const skill of requiredSkills) {
      if (!candidateSkillsSet.has(skill)) {
        missingRequiredSkills.push(skill);
      }
    }

    const requiredScore = requiredSkills.length > 0
      ? (matchedRequired.length / requiredSkills.length) * 100
      : 70;

    const preferredScore = preferredSkills.length > 0
      ? (matchedPreferred.length / preferredSkills.length) * 100
      : 70;

    skillMatchScore = Math.round((requiredScore * 2 + preferredScore) / 3);
    skillConfidence = candidate.skills.length >= 3 ? ConfidenceLevel.HIGH : ConfidenceLevel.MEDIUM;

    if (matchedRequired.length === requiredSkills.length && requiredSkills.length > 0) {
      keyStrengths.push(`All ${requiredSkills.length} required skills matched`);
    } else if (missingRequiredSkills.length > 0) {
      keyRisks.push(`Missing required skills: ${missingRequiredSkills.slice(0, 3).join(', ')}`);
    }
  }

  const sharedSkills = [...candidateSkillsSet].filter(s => allTargetSkills.has(s));

  componentScores.push({
    name: 'skillMatch',
    rawScore: skillMatchScore,
    weight: effectiveWeights.skillMatch,
    weightedScore: Math.round(skillMatchScore * effectiveWeights.skillMatch),
    confidence: skillConfidence,
    explanation: `Matched ${sharedSkills.length} of ${allTargetSkills.size} target skills`,
    evidence: sharedSkills.slice(0, 5),
  });

  // 3. Track Alignment
  const targetTrack = inferCareerTrack(intent.roleArea || '');
  const trackResult = calculateTrackCompatibility(
    intent.intentType,
    targetTrack,
    candidate.careerTrack,
    candidate.experience?.hasRecentTechnicalEvidence ?? false
  );

  componentScores.push({
    name: 'trackAlignment',
    rawScore: trackResult.score,
    weight: effectiveWeights.trackAlignment,
    weightedScore: Math.round(trackResult.score * effectiveWeights.trackAlignment),
    confidence: candidate.careerTrack !== CareerTrack.UNKNOWN ? ConfidenceLevel.HIGH : ConfidenceLevel.LOW,
    explanation: trackResult.reason,
    evidence: [`Target: ${targetTrack}`, `Candidate: ${candidate.careerTrack}`],
  });

  if (!trackResult.compatible) {
    keyRisks.push(trackResult.reason);
  } else if (trackResult.score >= 80) {
    keyStrengths.push('Career track aligns well');
  }

  // 4. Recent Experience
  let recentExpScore: number = FALLBACK_SCORES.MISSING_EXPERIENCE;
  let expConfidence = ConfidenceLevel.LOW;

  if (candidate.experience) {
    const recentMonths = candidate.experience.recentRelevantExperienceMonths;
    const totalRelevant = candidate.experience.relevantExperienceMonths;

    if (recentMonths >= 36) {
      recentExpScore = 100;
    } else if (recentMonths >= 24) {
      recentExpScore = 85;
    } else if (recentMonths >= 12) {
      recentExpScore = 70;
    } else if (totalRelevant >= 24) {
      recentExpScore = 55;
    } else if (totalRelevant > 0) {
      recentExpScore = 40;
    } else {
      recentExpScore = 20;
    }

    expConfidence = candidate.workHistory && candidate.workHistory.length > 0
      ? ConfidenceLevel.HIGH
      : ConfidenceLevel.MEDIUM;

    if (recentMonths >= 24) {
      keyStrengths.push(`${Math.round(recentMonths / 12)}+ years recent relevant experience`);
    }
  } else {
    keyRisks.push('No work history available');
  }

  componentScores.push({
    name: 'recentExperience',
    rawScore: recentExpScore,
    weight: effectiveWeights.recentExperience,
    weightedScore: Math.round(recentExpScore * effectiveWeights.recentExperience),
    confidence: expConfidence,
    explanation: candidate.experience
      ? `${Math.round(candidate.experience.recentRelevantExperienceMonths / 12)} years recent relevant experience`
      : 'No experience data available',
    evidence: candidate.experience
      ? [`Total: ${Math.round(candidate.experience.totalExperienceMonths / 12)}y`, `Relevant: ${Math.round(candidate.experience.relevantExperienceMonths / 12)}y`]
      : ['No work history'],
  });

  // 5. Seniority Fit
  const seniorityScore = calculateSeniorityFit(intent.intentType, intent.seniority, candidate.seniority);

  componentScores.push({
    name: 'seniorityFit',
    rawScore: seniorityScore,
    weight: effectiveWeights.seniorityFit,
    weightedScore: Math.round(seniorityScore * effectiveWeights.seniorityFit),
    confidence: candidate.seniority.level ? ConfidenceLevel.HIGH : ConfidenceLevel.LOW,
    explanation: `Seniority: ${candidate.seniority.level || 'Unknown'} (${candidate.seniority.ladder || 'Unknown'} ladder)`,
    evidence: [
      `Target: ${intent.seniority || 'Any'}`,
      `Candidate: ${candidate.seniority.level || 'Unknown'}`,
    ],
  });

  // 6. Role-Area Match
  const roleAreaResult = calculateRoleAreaMatch(
    intent.intentType,
    intent.roleArea,
    candidate.jobTitle,
    candidate.bio
  );

  componentScores.push({
    name: 'roleAreaMatch',
    rawScore: roleAreaResult.score,
    weight: effectiveWeights.roleAreaMatch,
    weightedScore: Math.round(roleAreaResult.score * effectiveWeights.roleAreaMatch),
    confidence: roleAreaResult.confidence,
    explanation: `Role family: ${normalizeToRoleFamily(intent.roleArea)} vs ${candidate.roleFamily}`,
    evidence: roleAreaResult.evidence,
  });

  if (roleAreaResult.score >= 80) {
    keyStrengths.push('Role area matches well');
  }

  // 7. Intent Alignment
  const intentResult = calculateIntentAlignment(intent.intentType, candidate);

  componentScores.push({
    name: 'intentAlignment',
    rawScore: intentResult.score,
    weight: effectiveWeights.intentAlignment,
    weightedScore: Math.round(intentResult.score * effectiveWeights.intentAlignment),
    confidence: intentResult.confidence,
    explanation: intentResult.description,
    evidence: intentResult.evidence,
  });

  // 8. Sector Overlap
  const candidateSectors = new Set(candidate.sectors.map(s => s.toLowerCase()));
  const sharedSectors = [...candidateSectors].filter(s => allTargetSectors.has(s));
  const sectorScore = allTargetSectors.size > 0
    ? Math.min(sharedSectors.length * 35, 100)
    : 40;

  componentScores.push({
    name: 'sectorOverlap',
    rawScore: sectorScore,
    weight: effectiveWeights.sectorOverlap,
    weightedScore: Math.round(sectorScore * effectiveWeights.sectorOverlap),
    confidence: candidateSectors.size > 0 ? ConfidenceLevel.MEDIUM : ConfidenceLevel.LOW,
    explanation: `Shared ${sharedSectors.length} industry sectors`,
    evidence: sharedSectors.slice(0, 3),
  });

  // 9. Location Match
  let locationScore: number = FALLBACK_SCORES.UNKNOWN_LOCATION;

  if (intent.remoteOk) {
    locationScore = 80;
  } else if (!intent.locationPref) {
    locationScore = 70;
  } else if (candidate.location && locationMatches(intent.locationPref, candidate.location)) {
    locationScore = 100;
  } else if (!candidate.location) {
    locationScore = FALLBACK_SCORES.UNKNOWN_LOCATION;
  } else {
    locationScore = 20;
  }

  componentScores.push({
    name: 'locationMatch',
    rawScore: locationScore,
    weight: effectiveWeights.locationMatch,
    weightedScore: Math.round(locationScore * effectiveWeights.locationMatch),
    confidence: candidate.location ? ConfidenceLevel.HIGH : ConfidenceLevel.LOW,
    explanation: intent.remoteOk ? 'Remote OK - location flexible' : 'Location-specific role',
    evidence: [
      `Target: ${intent.locationPref || 'Any'}`,
      `Candidate: ${candidate.location || 'Unknown'}`,
    ],
  });

  // 10. Interest Overlap
  const userInterests = new Set(user.userInterests.map(ui => ui.interest.name.toLowerCase()));
  const candidateInterests = new Set(candidate.interests.map(i => i.toLowerCase()));
  const sharedInterests = [...userInterests].filter(i => candidateInterests.has(i));
  const interestScore = Math.min(sharedInterests.length * 40, 100);

  componentScores.push({
    name: 'interestOverlap',
    rawScore: interestScore,
    weight: effectiveWeights.interestOverlap,
    weightedScore: Math.round(interestScore * effectiveWeights.interestOverlap),
    confidence: candidate.interests.length > 0 ? ConfidenceLevel.MEDIUM : ConfidenceLevel.LOW,
    explanation: `Shared interests: ${sharedInterests.length}`,
    evidence: sharedInterests.slice(0, 3),
  });

  // Calculate weighted total
  let rawTotal = 0;
  for (const component of componentScores) {
    rawTotal += component.weightedScore;
  }

  // Apply penalties
  let finalScore = rawTotal;

  if (trackResult.score <= 15) {
    finalScore = Math.round(finalScore * 0.3);
  } else if (trackResult.score <= 30) {
    finalScore = Math.round(finalScore * 0.5);
  } else if (trackResult.score <= 50) {
    finalScore = Math.round(finalScore * 0.7);
  }

  if (roleAreaResult.score <= 15) {
    finalScore = Math.round(finalScore * 0.4);
  } else if (roleAreaResult.score <= 30) {
    finalScore = Math.round(finalScore * 0.6);
  }

  if (titleResult.penalty && titleResult.score <= 15) {
    finalScore = Math.round(finalScore * 0.4);
  } else if (titleResult.penalty && titleResult.score <= 30) {
    finalScore = Math.round(finalScore * 0.6);
  }

  if (missingRequiredSkills.length > 0 && intent.intentType === 'HIRING') {
    const requiredSkillCount = intent.skillPrefs.filter(sp => sp.isRequired).length;
    const missingRatio = missingRequiredSkills.length / requiredSkillCount;
    if (missingRatio > 0.5) {
      finalScore = Math.round(finalScore * 0.6);
    } else if (missingRatio > 0.3) {
      finalScore = Math.round(finalScore * 0.8);
    }
  }

  if (sparseProfile && intent.intentType === 'HIRING') {
    finalScore = Math.round(finalScore * 0.7);
  }

  finalScore = Math.min(100, Math.max(0, finalScore));

  const confidenceScore = calculateConfidenceScore(candidate);
  const confidence = confidenceScoreToLevel(confidenceScore);

  const hardFilterResult = applyHardFilters(intent, candidate, {
    minRequiredSkillCoverage: 0.6,
    strictLocationMatching: false,
  });

  let matchLevel = scoreToMatchLevel(finalScore, hardFilterResult.status);

  const cappedResult = applyConfidenceCap(matchLevel, confidenceScore, sparseProfile);
  matchLevel = cappedResult.level;
  const levelCappedReason = cappedResult.reason;

  if (missingRequiredSkills.length > 0 && intent.intentType === 'HIRING') {
    if (matchLevel === MatchLevel.EXCELLENT || matchLevel === MatchLevel.VERY_GOOD) {
      matchLevel = MatchLevel.GOOD;
    }
  }

  // Apply final caps for overqualified tracks when hiring for IC roles
  if (intent.intentType === 'HIRING' && targetTrack === CareerTrack.INDIVIDUAL_CONTRIBUTOR) {
    // Executives, founders, board members and advisors should be capped at POOR
    if (
      candidate.careerTrack === CareerTrack.EXECUTIVE ||
      candidate.careerTrack === CareerTrack.FOUNDER ||
      candidate.careerTrack === CareerTrack.BOARD ||
      candidate.careerTrack === CareerTrack.ADVISOR
    ) {
      matchLevel = MatchLevel.POOR;
    } else if (candidate.careerTrack === CareerTrack.MANAGEMENT) {
      // Management (e.g., directors, VPs) should not rank above WEAK
      if (matchLevel === MatchLevel.EXCELLENT || matchLevel === MatchLevel.VERY_GOOD || matchLevel === MatchLevel.GOOD) {
        matchLevel = MatchLevel.WEAK;
      }
    }
  }

  return {
    candidateId: candidate.id,
    candidateType: candidate.type,
    candidateName: candidate.name,
    candidateTitle: candidate.jobTitle,
    candidateCompany: candidate.company,
    score: finalScore,
    confidence,
    confidenceScore,
    matchLevel,
    hardFilterStatus: hardFilterResult.status,
    hardFilterReasons: hardFilterResult.reasons,
    componentScores,
    keyStrengths: keyStrengths.slice(0, 5),
    keyRisks: keyRisks.slice(0, 5),
    missingRequiredSkills,
    explanation: generateExplanation(componentScores, keyStrengths, keyRisks, levelCappedReason),
    levelCappedReason,
    suggestedAction: 'Connect',
    suggestedMessage: '',
    nextSteps: [],
    aiValidated: false,
    aiNotes: null,
    isSparseProfile: sparseProfile,
    sharedSectors,
    sharedSkills,
  };
}

function calculateIntentAlignment(
  userIntent: OpportunityIntentType,
  candidate: MatchCandidate
): { score: number; description: string; confidence: ConfidenceLevel; evidence: string[] } {
  const evidence: string[] = [];

  if (candidate.opportunityIntent) {
    const compatibleIntents = INTENT_COMPATIBILITY[userIntent];
    if (compatibleIntents.includes(candidate.opportunityIntent)) {
      evidence.push(`Has compatible intent: ${candidate.opportunityIntent}`);
      return {
        score: 100,
        description: `Intent match: ${candidate.opportunityIntent}`,
        confidence: ConfidenceLevel.HIGH,
        evidence,
      };
    }
  }

  const relevantGoals = INTENT_TO_GOALS[userIntent];
  const matchedGoals = candidate.goals.filter(g => relevantGoals.includes(g));
  if (matchedGoals.length > 0) {
    evidence.push(`Has relevant goals: ${matchedGoals.join(', ')}`);
    return {
      score: Math.min(matchedGoals.length * 30, 75),
      description: `Goals align: ${matchedGoals.join(', ')}`,
      confidence: ConfidenceLevel.MEDIUM,
      evidence,
    };
  }

  const jobTitle = candidate.jobTitle?.toLowerCase() || '';

  if (userIntent === 'HIRING' && candidate.goals.includes('JOB_SEEKING')) {
    return { score: 90, description: 'Open to opportunities', confidence: ConfidenceLevel.HIGH, evidence: ['Actively job seeking'] };
  }

  if (userIntent === 'OPEN_TO_OPPORTUNITIES') {
    if (/\b(recruit|talent|hr|hiring)\b/i.test(jobTitle)) {
      return { score: 85, description: 'Recruiter/HR professional', confidence: ConfidenceLevel.HIGH, evidence: ['In recruiting role'] };
    }
    if (candidate.careerTrack === CareerTrack.EXECUTIVE || candidate.careerTrack === CareerTrack.FOUNDER) {
      return { score: 75, description: 'Decision maker', confidence: ConfidenceLevel.MEDIUM, evidence: ['Senior position'] };
    }
  }

  return {
    score: 30,
    description: 'No explicit intent signals',
    confidence: ConfidenceLevel.LOW,
    evidence: ['No matching goals or intent'],
  };
}

function generateExplanation(
  components: ScoringComponent[],
  strengths: string[],
  risks: string[],
  levelCappedReason: string | null
): string {
  const parts: string[] = [];

  if (strengths.length > 0) {
    parts.push(`Strengths: ${strengths.slice(0, 2).join(', ')}.`);
  }

  if (risks.length > 0) {
    parts.push(`Concerns: ${risks.slice(0, 2).join(', ')}.`);
  }

  if (levelCappedReason) {
    parts.push(`Note: ${levelCappedReason}.`);
  }

  const topComponents = [...components]
    .sort((a, b) => b.rawScore - a.rawScore)
    .slice(0, 2)
    .map(c => c.name);

  if (topComponents.length > 0) {
    parts.push(`Best scores in: ${topComponents.join(', ')}.`);
  }

  const lowConfidenceComponents = components.filter(c => c.confidence === ConfidenceLevel.LOW);
  if (lowConfidenceComponents.length >= 3) {
    parts.push('Limited data available for accurate scoring.');
  }

  return parts.join(' ') || 'Match based on profile analysis.';
}

export { skillTaxonomyService };
