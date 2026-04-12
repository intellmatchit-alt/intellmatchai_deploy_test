/**
 * IntellMatch Job Matching Engine — Scoring Utilities
 *
 * Deterministic multi-signal scoring aligned to the Job Form fields.
 * Uses RELEVANT experience, NOT total experience.
 *
 * Core signals include role/title, seniority, must-have skills, preferred
 * skills, relevant experience, work mode, employment type, location, semantic
 * similarity, domain alignment, language, certification, education,
 * availability, and salary compatibility.
 *
 * @module job-matching/job-scoring.utils
 */

import {
  HardFilterStatus,
  HardFilterReason,
  HiringProfile,
  CandidateProfile,
  Seniority,
  WorkMode,
  EmploymentType,
  JobMatchingConfig,
  DEFAULT_JOB_CONFIG,
  DeterministicScoreBreakdown,
  ScoringComponent,
  seniorityRank,
  seniorityDistance,
  RelevantExperienceEntry,
} from './job-matching.types';

import {
  areSectorsRelated,
  calculateCosineSimilarity,
  normalizeTag,
} from './matching-bands.constants';

import { LanguageProficiency } from './job-matching.types';

// ============================================================================
// HARD FILTERS
// ============================================================================

export interface HardFilterResult {
  status: HardFilterStatus;
  reason: HardFilterReason;
  details: string;
  evidence: string[];
}

export function runJobHardFilters(
  job: HiringProfile,
  candidate: CandidateProfile,
  config: JobMatchingConfig = DEFAULT_JOB_CONFIG,
): HardFilterResult {
  if (!config.features.enableHardFilters) {
    return passResult();
  }

  if (candidate.optedOut) {
    return failResult(HardFilterReason.OPT_OUT, 'Candidate opted out of matching.');
  }
  if (candidate.blocked) {
    return failResult(HardFilterReason.BLOCKED, 'Candidate is blocked.');
  }

  if (job.excludedCandidates?.includes(candidate.id)) {
    return failResult(HardFilterReason.EXCLUDED, 'Candidate explicitly excluded.');
  }

  if (candidate.desiredEmploymentType.length > 0 && !candidate.desiredEmploymentType.includes(job.employmentType)) {
    return failResult(
      HardFilterReason.EMPLOYMENT_TYPE_INCOMPATIBLE,
      `Job is ${job.employmentType}; candidate wants ${candidate.desiredEmploymentType.join(', ')}.`,
    );
  }

  if (candidate.desiredWorkMode.length > 0) {
    const compatible = candidate.desiredWorkMode.includes(job.workMode)
      || (candidate.desiredWorkMode.includes(WorkMode.REMOTE) && job.workMode === WorkMode.HYBRID)
      || (candidate.desiredWorkMode.includes(WorkMode.HYBRID) && job.workMode === WorkMode.REMOTE);

    if (!compatible) {
      return failResult(
        HardFilterReason.WORK_MODE_INCOMPATIBLE,
        `Job is ${job.workMode}; candidate wants ${candidate.desiredWorkMode.join(', ')}.`,
      );
    }
  }

  const dist = seniorityDistance(job.seniority, candidate.seniority);
  if (dist > 3) {
    return failResult(
      HardFilterReason.SENIORITY_INCOMPATIBLE,
      `Job is ${job.seniority}; candidate is ${candidate.seniority} (${dist} levels apart).`,
    );
  }

  if (job.mustHaveSkills && job.mustHaveSkills.length > 0) {
    if (!candidate.skills || candidate.skills.length === 0) {
      return failResult(
        HardFilterReason.MISSING_CRITICAL_SKILLS,
        `Candidate has no listed skills but role requires ${job.mustHaveSkills.length} must-have skills.`,
      );
    }

    const overlap = computeSkillOverlap(job.mustHaveSkills, candidate.skills);
    if (overlap.matched === 0) {
      return failResult(
        HardFilterReason.MISSING_CRITICAL_SKILLS,
        `Candidate has none of the ${job.mustHaveSkills.length} must-have skills.`,
      );
    }

    const policy = getMustHavePolicy(job.mustHaveSkills.length);
    const coverage = overlap.matched / Math.max(1, job.mustHaveSkills.length);
    const missingCount = job.mustHaveSkills.length - overlap.matched;

    if (coverage < policy.minCoverage || missingCount > policy.maxMissing) {
      return failResult(
        HardFilterReason.MISSING_CRITICAL_SKILLS,
        `Candidate covers ${overlap.matched}/${job.mustHaveSkills.length} must-have skills; policy requires at least ${(policy.minCoverage * 100).toFixed(0)}% coverage and at most ${policy.maxMissing} missing.`,
      );
    }
  }

  if (job.requiredLanguages && job.requiredLanguages.length > 0) {
    if (!candidate.languages || candidate.languages.length === 0) {
      return failResult(
        HardFilterReason.MISSING_REQUIRED_LANGUAGE,
        `Candidate provided no languages but ${job.requiredLanguages.length} language(s) are required.`,
      );
    }
    const missingLangs = job.requiredLanguages.filter((req) => {
      const cand = candidate.languages!.find((c) => normalizeTag(c.language) === normalizeTag(req.language));
      if (!cand) return true;
      return languageProficiencyRank(cand.proficiency) < languageProficiencyRank(req.proficiency);
    });
    if (missingLangs.length > 0) {
      return failResult(
        HardFilterReason.MISSING_REQUIRED_LANGUAGE,
        `Candidate does not meet proficiency for required language(s): ${missingLangs.map((l) => l.language).join(', ')}`,
      );
    }
  }

  if (job.requiredCertifications && job.requiredCertifications.length > 0) {
    if (!candidate.certifications || candidate.certifications.length === 0) {
      return failResult(
        HardFilterReason.MISSING_REQUIRED_CERTIFICATION,
        `Candidate provided no certifications but ${job.requiredCertifications.length} are required.`,
      );
    }
    const candCertsNorm = candidate.certifications.map((c) => normalizeTag(c));
    const missingCerts = job.requiredCertifications.filter((req) => !candCertsNorm.includes(normalizeTag(req)));
    if (missingCerts.length > 0) {
      return failResult(
        HardFilterReason.MISSING_REQUIRED_CERTIFICATION,
        `Candidate missing required certification(s): ${missingCerts.join(', ')}`,
      );
    }
  }

  if (job.requiredEducationLevels && job.requiredEducationLevels.length > 0) {
    const candidateDegrees = (candidate.education || []).map((entry) => normalizeTag(entry.degree));
    if (candidateDegrees.length === 0) {
      return failResult(
        HardFilterReason.MISSING_REQUIRED_EDUCATION,
        `Candidate provided no education entries but the role requires one of: ${job.requiredEducationLevels.join(', ')}.`,
      );
    }

    const acceptable = normalizeEducationLevels(job.requiredEducationLevels);
    const matchedEducation = candidateDegrees.some((degree) => acceptable.has(canonicalizeEducationLevel(degree)));
    if (!matchedEducation) {
      return failResult(
        HardFilterReason.MISSING_REQUIRED_EDUCATION,
        `Candidate education does not meet required level(s): ${job.requiredEducationLevels.join(', ')}.`,
      );
    }
  }

  const salaryCompatibility = assessSalaryCompatibility(job, candidate);
  if (salaryCompatibility.status === 'FAIL') {
    return failResult(HardFilterReason.SALARY_MISMATCH, salaryCompatibility.reason);
  }
  if (salaryCompatibility.status === 'WARN') {
    return warnResult(HardFilterReason.SALARY_MISMATCH, salaryCompatibility.reason);
  }

  return passResult();
}

function passResult(): HardFilterResult {
  return { status: HardFilterStatus.PASS, reason: HardFilterReason.NONE, details: '', evidence: [] };
}

function warnResult(reason: HardFilterReason, details: string): HardFilterResult {
  return { status: HardFilterStatus.WARN, reason, details, evidence: [details] };
}

function failResult(reason: HardFilterReason, details: string): HardFilterResult {
  return { status: HardFilterStatus.FAIL, reason, details, evidence: [details] };
}

function getMustHavePolicy(totalRequired: number): { minCoverage: number; maxMissing: number } {
  if (totalRequired <= 3) return { minCoverage: 1, maxMissing: 0 };
  if (totalRequired <= 6) return { minCoverage: 0.75, maxMissing: 1 };
  return { minCoverage: 0.7, maxMissing: 2 };
}

function canonicalizeEducationLevel(value: string): string {
  const degree = normalizeTag(value);
  if (degree.includes('phd') || degree.includes('doctor')) return 'doctorate';
  if (degree.includes('master') || degree.includes('msc') || degree.includes('mba')) return 'master';
  if (degree.includes('bachelor') || degree.includes('bsc') || degree.includes('ba') || degree.includes('bs')) return 'bachelor';
  if (degree.includes('associate') || degree.includes('diploma')) return 'associate';
  return degree;
}

function normalizeEducationLevels(levels: string[]): Set<string> {
  return new Set(levels.map(canonicalizeEducationLevel));
}

function assessSalaryCompatibility(
  job: HiringProfile,
  candidate: CandidateProfile,
): { status: 'PASS' | 'WARN' | 'FAIL'; reason: string } {
  const jobRange = job.salaryRange;
  const candidateRange = candidate.expectedSalary;

  if (!jobRange || !candidateRange) {
    return { status: 'PASS', reason: '' };
  }

  if (normalizeTag(jobRange.currency) !== normalizeTag(candidateRange.currency)) {
    return { status: 'PASS', reason: '' };
  }

  const jobMax = jobRange.max ?? jobRange.min;
  const candidateMin = candidateRange.min ?? candidateRange.max;

  if (jobMax == null || candidateMin == null) {
    return { status: 'PASS', reason: '' };
  }

  if (candidateMin <= jobMax) {
    return { status: 'PASS', reason: '' };
  }

  const overshootRatio = (candidateMin - jobMax) / Math.max(jobMax, 1);
  if (overshootRatio > 0.2) {
    return {
      status: 'FAIL',
      reason: `Candidate minimum salary expectation (${candidateMin} ${candidateRange.currency}) is more than 20% above job maximum (${jobMax} ${jobRange.currency}).`,
    };
  }

  return {
    status: 'WARN',
    reason: `Candidate minimum salary expectation (${candidateMin} ${candidateRange.currency}) is slightly above the job maximum (${jobMax} ${jobRange.currency}).`,
  };
}

// ============================================================================
// SCORING COMPONENTS
// ============================================================================

/**
 * 1. Role / Title alignment
 */
export function calculateRoleTitleScore(
  job: HiringProfile,
  candidate: CandidateProfile,
  config: JobMatchingConfig,
): ScoringComponent {
  const jTitle = job.title.toLowerCase();
  const jRole = job.roleArea.toLowerCase();
  const cTitle = candidate.title.toLowerCase();
  const cRole = candidate.roleArea.toLowerCase();

  let score = 0;
  const evidence: string[] = [];
  const penalties: string[] = [];

  // Exact role-area match
  if (jRole === cRole) {
    score += 60;
    evidence.push(`Exact role area match: ${job.roleArea}`);
  } else if (jRole.includes(cRole) || cRole.includes(jRole)) {
    score += 45;
    evidence.push(`Partial role area overlap: ${job.roleArea} ↔ ${candidate.roleArea}`);
  } else {
    score += 10;
    penalties.push(`Role areas differ: ${job.roleArea} vs ${candidate.roleArea}`);
  }

  // Title semantic overlap
  const titleOverlap = fuzzyTokenOverlap(jTitle, cTitle);
  score += Math.round(titleOverlap * 40);
  if (titleOverlap > 0.4) evidence.push(`Title overlap: ${(titleOverlap * 100).toFixed(0)}%`);

  return buildComponent('roleTitleScore', Math.min(100, score), config.defaultWeights.roleTitleScore,
    evidence, penalties, evidence.length > 0 ? 0.8 : 0.4);
}

/**
 * 2. Seniority alignment
 */
export function calculateSeniorityScore(
  job: HiringProfile,
  candidate: CandidateProfile,
  config: JobMatchingConfig,
): ScoringComponent {
  const dist = seniorityDistance(job.seniority, candidate.seniority);
  const evidence: string[] = [];
  const penalties: string[] = [];
  let score: number;

  if (dist === 0) {
    score = 100;
    evidence.push(`Exact seniority match: ${job.seniority}`);
  } else if (dist === 1) {
    score = 80;
    evidence.push(`Adjacent seniority: ${candidate.seniority} vs ${job.seniority}`);
  } else if (dist === 2) {
    score = 50;
    penalties.push(`Seniority gap of 2: ${candidate.seniority} vs ${job.seniority}`);
  } else {
    score = Math.max(10, 100 - dist * 25);
    penalties.push(`Large seniority gap: ${candidate.seniority} vs ${job.seniority}`);
  }

  return buildComponent('seniorityScore', score, config.defaultWeights.seniorityScore,
    evidence, penalties, 0.9);
}

/**
 * 3. Skills alignment (STRONGEST signal)
 */
export function calculateSkillsScore(
  job: HiringProfile,
  candidate: CandidateProfile,
  config: JobMatchingConfig,
): ScoringComponent {
  // Must-have skills matching
  const required = job.mustHaveSkills || [];
  const candSkills = candidate.skills || [];
  if (required.length === 0) {
    return buildComponent('skillsScore', config.fallbackScores.missingSkills,
      config.defaultWeights.skillsScore, [], ['No must-have skills specified'], 0.3);
  }
  if (candSkills.length === 0) {
    return buildComponent('skillsScore', config.fallbackScores.missingSkills,
      config.defaultWeights.skillsScore, [], ['Candidate has no skills listed'], 0.3);
  }

  const { matched, missing, matchRatio } = computeSkillOverlap(required, candSkills);
  const score = Math.round(matchRatio * 100);

  const evidence = matched > 0 ? [`${matched}/${required.length} must-have skills matched`] : [];
  const penalties = missing > 0 ? [`Missing ${missing} must-have skills`] : [];

  return buildComponent('skillsScore', score, config.defaultWeights.skillsScore,
    evidence, penalties, Math.min(1, 0.5 + matched * 0.1));
}

/**
 * Preferred skills alignment.  Optional skills earn partial credit but do not
 * block matching.  A higher ratio of matched preferred skills yields a
 * higher score.  If no preferred skills are specified, the fallback score
 * applies and the confidence is moderate.
 */
export function calculatePreferredSkillsScore(
  job: HiringProfile,
  candidate: CandidateProfile,
  config: JobMatchingConfig,
): ScoringComponent {
  const preferred = job.preferredSkills || [];
  if (preferred.length === 0) {
    return buildComponent('preferredSkillsScore', config.fallbackScores.missingPreferredSkills,
      config.defaultWeights.preferredSkillsScore, [], ['No preferred skills specified'], 0.4);
  }
  const candSkills = candidate.skills || [];
  if (candSkills.length === 0) {
    return buildComponent('preferredSkillsScore', 0, config.defaultWeights.preferredSkillsScore,
      [], ['Candidate has no skills listed'], 0.3);
  }
  const { matched, missing, matchRatio } = computeSkillOverlap(preferred, candSkills);
  const score = Math.round(matchRatio * 100);
  const evidence = matched > 0 ? [`${matched}/${preferred.length} preferred skills matched`] : [];
  const penalties = missing === preferred.length ? ['No preferred skills matched'] : [];
  return buildComponent('preferredSkillsScore', score, config.defaultWeights.preferredSkillsScore,
    evidence, penalties, Math.min(1, 0.4 + matched * 0.05));
}

/**
 * Domain / industry alignment.  Measures overlap between job industries and
 * candidate industries.  Uses sector relationships to detect related
 * domains.  If no industries are specified on either side, returns a
 * fallback score.
 */
export function calculateDomainScore(
  job: HiringProfile,
  candidate: CandidateProfile,
  config: JobMatchingConfig,
): ScoringComponent {
  const jDomains = job.industries || [];
  const cDomains = candidate.industries || [];
  if (jDomains.length === 0 || cDomains.length === 0) {
    return buildComponent('domainScore', config.fallbackScores.missingDomain,
      config.defaultWeights.domainScore, [], ['No industries specified on one or both sides'], 0.4);
  }
  let matched = 0;
  for (const jd of jDomains) {
    const normJ = normalizeTag(jd);
    const found = cDomains.some(cd => {
      const normC = normalizeTag(cd);
      return normJ === normC || areSectorsRelated(normJ, normC);
    });
    if (found) matched++;
  }
  const matchRatio = matched / jDomains.length;
  const score = Math.round(matchRatio * 100);
  const evidence = matched > 0 ? [`${matched}/${jDomains.length} industries matched`] : [];
  const penalties = matched === 0 ? ['No domain overlap'] : [];
  return buildComponent('domainScore', score, config.defaultWeights.domainScore,
    evidence, penalties, Math.min(1, 0.4 + matched * 0.1));
}

/**
 * Language alignment.  Compares candidate language skills with job
 * requirements.  Candidates receive full credit when they meet or exceed
 * the required proficiency for all languages.  Partial credit is given
 * when some languages are met.  If no languages are required, returns
 * fallback score.
 */
export function calculateLanguageScore(
  job: HiringProfile,
  candidate: CandidateProfile,
  config: JobMatchingConfig,
): ScoringComponent {
  const req = job.requiredLanguages || [];
  if (req.length === 0) {
    return buildComponent('languageScore', config.fallbackScores.missingLanguages,
      config.defaultWeights.languageScore, [], ['No required languages specified'], 0.4);
  }
  const cand = candidate.languages || [];
  if (cand.length === 0) {
    return buildComponent('languageScore', 0, config.defaultWeights.languageScore,
      [], ['Candidate provided no languages'], 0.2);
  }
  let matched = 0;
  for (const r of req) {
    const c = cand.find(l => normalizeTag(l.language) === normalizeTag(r.language));
    if (c && languageProficiencyRank(c.proficiency) >= languageProficiencyRank(r.proficiency)) {
      matched++;
    }
  }
  const matchRatio = matched / req.length;
  const score = Math.round(matchRatio * 100);
  const evidence = matched > 0 ? [`${matched}/${req.length} required languages satisfied`] : [];
  const penalties = matched < req.length ? [`Missing ${req.length - matched} required languages`] : [];
  return buildComponent('languageScore', score, config.defaultWeights.languageScore,
    evidence, penalties, Math.min(1, 0.4 + matched * 0.15));
}

/**
 * Certification alignment.  Measures overlap between job required
 * certifications and candidate certifications.  All required certifications
 * must be present for a high score.  Partial matches yield moderate
 * scores.  If no certifications are required, returns fallback score.
 */
export function calculateCertificationScore(
  job: HiringProfile,
  candidate: CandidateProfile,
  config: JobMatchingConfig,
): ScoringComponent {
  const req = job.requiredCertifications || [];
  if (req.length === 0) {
    return buildComponent('certificationScore', config.fallbackScores.missingCertifications,
      config.defaultWeights.certificationScore, [], ['No required certifications specified'], 0.4);
  }
  const cand = candidate.certifications || [];
  if (cand.length === 0) {
    return buildComponent('certificationScore', 0, config.defaultWeights.certificationScore,
      [], ['Candidate provided no certifications'], 0.2);
  }
  const candNorm = cand.map(normalizeTag);
  let matched = 0;
  for (const r of req) {
    if (candNorm.includes(normalizeTag(r))) matched++;
  }
  const matchRatio = matched / req.length;
  const score = Math.round(matchRatio * 100);
  const evidence = matched > 0 ? [`${matched}/${req.length} certifications matched`] : [];
  const penalties = matched < req.length ? [`Missing ${req.length - matched} certifications`] : [];
  return buildComponent('certificationScore', score, config.defaultWeights.certificationScore,
    evidence, penalties, Math.min(1, 0.4 + matched * 0.2));
}

/**
 * Education alignment.  Compares candidate education levels with job
 * requirements.  If the job specifies required education levels, the
 * candidate must possess at least one of them.  Partial credit is given
 * based on degree level proximity (e.g. Master meets Bachelor
 * requirement).  If no education requirements, returns fallback score.
 */
export function calculateEducationScore(
  job: HiringProfile,
  candidate: CandidateProfile,
  config: JobMatchingConfig,
): ScoringComponent {
  const req = job.requiredEducationLevels || [];
  if (req.length === 0) {
    return buildComponent('educationScore', config.fallbackScores.missingEducation,
      config.defaultWeights.educationScore, [], ['No education requirements specified'], 0.4);
  }
  const cand = candidate.education || [];
  if (cand.length === 0) {
    return buildComponent('educationScore', 0, config.defaultWeights.educationScore,
      [], ['Candidate provided no education history'], 0.2);
  }
  // Simple degree hierarchy: PhD > Master > Bachelor > Associate > Diploma > High School
  const degreeRank: Record<string, number> = {
    phd: 5,
    doctor: 5,
    doctorate: 5,
    master: 4,
    masters: 4,
    bachelor: 3,
    bsc: 3,
    ba: 3,
    associate: 2,
    diploma: 1,
    'high school': 0,
  };
  const reqRanks = req.map(r => degreeRank[normalizeTag(r)] ?? 0);
  let bestMatch = 0;
  for (const edu of cand) {
    const candRank = degreeRank[normalizeTag(edu.degree)] ?? 0;
    // Candidate meets requirement if candRank >= any required rank
    const meets = reqRanks.some(rRank => candRank >= rRank);
    if (meets) {
      // Score proportional to how far candidate exceeds minimum requirement
      const minRequired = Math.min(...reqRanks);
      const diff = candRank - minRequired;
      const candidateScore = diff >= 0 ? Math.min(100, 70 + diff * 10) : 30;
      if (candidateScore > bestMatch) bestMatch = candidateScore;
    }
  }
  if (bestMatch > 0) {
    return buildComponent('educationScore', bestMatch, config.defaultWeights.educationScore,
      ['Candidate meets education requirement'], [], 0.6);
  }
  return buildComponent('educationScore', 20, config.defaultWeights.educationScore,
    [], ['Education requirement not met'], 0.4);
}

/**
 * Availability / timing alignment.  Compares job hiring urgency with
 * candidate availability and notice period.  Candidates available sooner
 * than the urgency are rewarded.  Those available much later are
 * penalised.  If either side is missing, returns a fallback score.
 */
export function calculateAvailabilityScore(
  job: HiringProfile,
  candidate: CandidateProfile,
  config: JobMatchingConfig,
): ScoringComponent {
  if (!job.hiringUrgency) {
    return buildComponent('availabilityScore', config.fallbackScores.missingAvailability,
      config.defaultWeights.availabilityScore, [], ['Hiring urgency not specified'], 0.3);
  }
  if (!candidate.availability && candidate.noticePeriod == null) {
    return buildComponent('availabilityScore', config.fallbackScores.missingAvailability,
      config.defaultWeights.availabilityScore, [], ['Candidate availability unknown'], 0.3);
  }
  // Map urgencies and availability to numeric weeks
  const urgencyWeeks: Record<string, number> = {
    LOW: 12,
    NORMAL: 8,
    URGENT: 4,
    CRITICAL: 2,
  };
  const availWeeks: Record<string, number> = {
    IMMEDIATELY: 0,
    WITHIN_2_WEEKS: 2,
    WITHIN_1_MONTH: 4,
    WITHIN_3_MONTHS: 12,
    NOT_ACTIVELY_LOOKING: 16,
  };
  const jobWeeks = urgencyWeeks[job.hiringUrgency] ?? 8;
  let candWeeks = candidate.noticePeriod ?? 0;
  if (!candidate.noticePeriod && candidate.availability) {
    candWeeks = availWeeks[candidate.availability] ?? 8;
  }
  const diff = candWeeks - jobWeeks;
  let score: number;
  const evidence: string[] = [];
  const penalties: string[] = [];
  if (diff <= 0) {
    score = 100;
    evidence.push(`Candidate available within ${candWeeks} weeks, matches urgency ${job.hiringUrgency}`);
  } else if (diff <= 2) {
    score = 70;
    evidence.push(`Candidate available within ${candWeeks} weeks (slightly after desired ${jobWeeks} weeks)`);
  } else if (diff <= 4) {
    score = 40;
    penalties.push(`Candidate availability (${candWeeks} weeks) later than desired ${jobWeeks} weeks`);
  } else {
    score = 20;
    penalties.push(`Candidate availability (${candWeeks} weeks) significantly later than desired ${jobWeeks} weeks`);
  }
  return buildComponent('availabilityScore', score, config.defaultWeights.availabilityScore,
    evidence, penalties, 0.6);
}

/**
 * Salary expectation alignment.  Compares job salary range with candidate
 * expected salary.  Returns high scores if candidate expectations fall
 * within or below the job range, moderate if slightly above, and low if
 * significantly above.  If no salary data is provided on either side,
 * returns the fallback score.
 */
export function calculateSalaryScore(
  job: HiringProfile,
  candidate: CandidateProfile,
  config: JobMatchingConfig,
): ScoringComponent {
  const jRange = job.salaryRange;
  const cRange = candidate.expectedSalary;
  if (!jRange || !cRange || !jRange.currency || !cRange.currency || jRange.currency !== cRange.currency) {
    return buildComponent('salaryScore', config.fallbackScores.missingSalary,
      config.defaultWeights.salaryScore, [], ['Salary data missing or currency mismatch'], 0.3);
  }
  // Define ranges.  We treat undefined min or max as unbounded.
  const jobMin = jRange.min ?? 0;
  const jobMax = jRange.max ?? Number.MAX_SAFE_INTEGER;
  const candMin = cRange.min ?? 0;
  const candMax = cRange.max ?? Number.MAX_SAFE_INTEGER;
  let score: number;
  const evidence: string[] = [];
  const penalties: string[] = [];
  if (candMin >= jobMin && candMax <= jobMax) {
    score = 100;
    evidence.push(`Candidate expected salary within job range`);
  } else if (candMin <= jobMax * 1.05) {
    score = 70;
    evidence.push(`Candidate salary slightly above job max`);
  } else {
    score = 30;
    penalties.push(`Candidate salary expectations exceed job range`);
  }
  return buildComponent('salaryScore', score, config.defaultWeights.salaryScore,
    evidence, penalties, 0.5);
}

/**
 * 4. Work mode compatibility
 */
export function calculateWorkModeScore(
  job: HiringProfile,
  candidate: CandidateProfile,
  config: JobMatchingConfig,
): ScoringComponent {
  if (candidate.desiredWorkMode.length === 0) {
    return buildComponent('workModeScore', 50, config.defaultWeights.workModeScore,
      [], ['No desired work mode specified'], 0.4);
  }

  const exact = candidate.desiredWorkMode.includes(job.workMode);
  const partialCompat =
    (job.workMode === WorkMode.HYBRID && (candidate.desiredWorkMode.includes(WorkMode.REMOTE) || candidate.desiredWorkMode.includes(WorkMode.ONSITE))) ||
    (job.workMode === WorkMode.REMOTE && candidate.desiredWorkMode.includes(WorkMode.HYBRID)) ||
    (job.workMode === WorkMode.ONSITE && candidate.desiredWorkMode.includes(WorkMode.HYBRID));

  if (exact) {
    return buildComponent('workModeScore', 100, config.defaultWeights.workModeScore,
      [`Work mode match: ${job.workMode}`], [], 1.0);
  }
  if (partialCompat) {
    return buildComponent('workModeScore', 65, config.defaultWeights.workModeScore,
      ['Partially compatible work modes'], [], 0.7);
  }
  return buildComponent('workModeScore', 15, config.defaultWeights.workModeScore,
    [], [`Work mode mismatch: job=${job.workMode}, candidate=${candidate.desiredWorkMode.join(',')}`], 0.9);
}

/**
 * 5. Employment type compatibility
 */
export function calculateEmploymentTypeScore(
  job: HiringProfile,
  candidate: CandidateProfile,
  config: JobMatchingConfig,
): ScoringComponent {
  if (candidate.desiredEmploymentType.length === 0) {
    return buildComponent('employmentTypeScore', 50, config.defaultWeights.employmentTypeScore,
      [], ['No desired employment type specified'], 0.4);
  }

  if (candidate.desiredEmploymentType.includes(job.employmentType)) {
    return buildComponent('employmentTypeScore', 100, config.defaultWeights.employmentTypeScore,
      [`Employment type match: ${job.employmentType}`], [], 1.0);
  }

  // Partial compatibility: freelance ↔ contract
  const partial =
    (job.employmentType === EmploymentType.CONTRACT && candidate.desiredEmploymentType.includes(EmploymentType.FREELANCE)) ||
    (job.employmentType === EmploymentType.FREELANCE && candidate.desiredEmploymentType.includes(EmploymentType.CONTRACT));

  if (partial) {
    return buildComponent('employmentTypeScore', 60, config.defaultWeights.employmentTypeScore,
      ['Close employment type match (contract/freelance)'], [], 0.7);
  }

  return buildComponent('employmentTypeScore', 10, config.defaultWeights.employmentTypeScore,
    [], [`Employment type mismatch: job=${job.employmentType}`], 0.9);
}

/**
 * 6. RELEVANT experience fit — the most important experience component.
 * Uses relevant experience entries when available, otherwise falls back to
 * conservative estimation from total years.
 */
export function calculateExperienceScore(
  job: HiringProfile,
  candidate: CandidateProfile,
  config: JobMatchingConfig,
): ScoringComponent {
  const requiredYears = job.minimumYearsExperience;
  const totalYears = candidate.yearsOfExperience;

  // No requirement → neutral
  if (requiredYears == null) {
    return buildComponent('experienceScore', 50, config.defaultWeights.experienceScore,
      ['No minimum experience specified by job'], [], 0.4);
  }

  // No candidate data
  if (totalYears == null) {
    return buildComponent('experienceScore', config.fallbackScores.missingExperience,
      config.defaultWeights.experienceScore,
      [], ['Candidate experience unknown'], 0.3);
  }

  const evidence: string[] = [];
  const penalties: string[] = [];

  // --- Compute relevant years ---
  let relevantYears: number;
  let relevanceConfidence: number;

  if (config.features.enableRelevantExperienceLogic && candidate.relevantExperience && candidate.relevantExperience.length > 0) {
    // Sum relevant segments that match the job's role/skills/domain
    relevantYears = computeRelevantYears(job, candidate.relevantExperience);
    relevanceConfidence = 0.85;
    evidence.push(`Relevant experience computed: ${relevantYears} years (from ${candidate.relevantExperience.length} segments)`);
    if (relevantYears < totalYears) {
      evidence.push(`Total experience: ${totalYears} years, but only ${relevantYears} relevant`);
    }
  } else {
    // Fallback: estimate relevance from skill overlap using all job skills (must-have + preferred)
    const allJobSkills: string[] = [];
    if (job.mustHaveSkills) allJobSkills.push(...job.mustHaveSkills);
    if (job.preferredSkills) allJobSkills.push(...job.preferredSkills);
    const { matchRatio } = computeSkillOverlap(allJobSkills, candidate.skills);
    // If skill overlap is high, more of total experience is likely relevant
    const relevanceFactor = Math.min(1, 0.3 + matchRatio * 0.7);
    relevantYears = Math.round(totalYears * relevanceFactor * 10) / 10;
    relevanceConfidence = 0.5;
    evidence.push(`Estimated relevant experience: ~${relevantYears} years (from ${totalYears} total × ${(relevanceFactor * 100).toFixed(0)}% relevance estimate)`);
    penalties.push('Relevant experience estimated — could not determine precisely');
  }

  // --- Score based on relevant years vs required ---
  let score: number;
  if (relevantYears >= requiredYears) {
    // Meets or exceeds
    score = Math.min(100, 70 + Math.min(30, (relevantYears - requiredYears) * 5));
    evidence.push(`Meets required ${requiredYears} years with ${relevantYears} relevant years`);
  } else if (relevantYears >= requiredYears * 0.75) {
    score = 55;
    penalties.push(`Slightly under: ${relevantYears} relevant vs ${requiredYears} required`);
  } else if (relevantYears >= requiredYears * 0.5) {
    score = 35;
    penalties.push(`Under-qualified: ${relevantYears} relevant vs ${requiredYears} required`);
  } else {
    score = 15;
    penalties.push(`Significantly under: ${relevantYears} relevant vs ${requiredYears} required`);
  }

  // If candidate has high total but low relevant, add explanatory penalty
  if (totalYears >= requiredYears && relevantYears < requiredYears) {
    penalties.push(`Total experience (${totalYears}y) meets threshold but relevant experience (${relevantYears}y) does not — unrelated experience not counted`);
  }

  return buildComponent('experienceScore', score, config.defaultWeights.experienceScore,
    evidence, penalties, relevanceConfidence);
}

/**
 * 7. Location compatibility
 */
export function calculateLocationScore(
  job: HiringProfile,
  candidate: CandidateProfile,
  config: JobMatchingConfig,
): ScoringComponent {
  // If fully remote, location is irrelevant
  if (job.workMode === WorkMode.REMOTE) {
    return buildComponent('locationScore', 90, config.defaultWeights.locationScore,
      ['Remote job — location flexible'], [], 0.9);
  }

  if (!job.location || !candidate.location) {
    return buildComponent('locationScore', config.fallbackScores.missingLocation,
      config.defaultWeights.locationScore, [], ['Location data missing'], 0.3);
  }

  const jLoc = job.location.toLowerCase().trim();
  const cLoc = candidate.location.toLowerCase().trim();

  // Exact city/region match
  if (jLoc === cLoc || jLoc.includes(cLoc) || cLoc.includes(jLoc)) {
    return buildComponent('locationScore', 100, config.defaultWeights.locationScore,
      [`Location match: ${candidate.location}`], [], 0.9);
  }

  // Same country heuristic
  const jCountry = extractCountry(jLoc);
  const cCountry = extractCountry(cLoc);
  if (jCountry && cCountry && jCountry === cCountry) {
    const score = job.workMode === WorkMode.HYBRID ? 70 : 50;
    return buildComponent('locationScore', score, config.defaultWeights.locationScore,
      [`Same country: ${jCountry}`], [], 0.6);
  }

  return buildComponent('locationScore', 20, config.defaultWeights.locationScore,
    [], [`Location mismatch: ${job.location} vs ${candidate.location}`], 0.7);
}

/**
 * 8. Semantic / summary similarity
 */
export function calculateSemanticScore(
  job: HiringProfile,
  candidate: CandidateProfile,
  config: JobMatchingConfig,
): ScoringComponent {
  if (!config.features.enableSemanticMatching) {
    return buildComponent('semanticScore', 50, config.defaultWeights.semanticScore,
      ['Semantic matching disabled'], [], 0.5);
  }

  // Embedding similarity
  if (job.embedding && candidate.embedding && job.embedding.length > 0 && candidate.embedding.length > 0) {
    const sim = calculateCosineSimilarity(job.embedding, candidate.embedding);
    const score = Math.round(Math.max(0, sim) * 100);
    return buildComponent('semanticScore', score, config.defaultWeights.semanticScore,
      [`Embedding similarity: ${(sim * 100).toFixed(0)}%`], [], 0.8);
  }

  // Keyword fallback: token overlap between summaries
  const jTokens = tokenize(job.jobSummaryRequirements);
  const cTokens = tokenize(candidate.profileSummaryPreferences);
  if (jTokens.length === 0 || cTokens.length === 0) {
    return buildComponent('semanticScore', config.fallbackScores.missingSemantic,
      config.defaultWeights.semanticScore, [], ['Summary text missing or too short'], 0.3);
  }

  const overlap = fuzzyTokenOverlap(job.jobSummaryRequirements, candidate.profileSummaryPreferences);
  const score = Math.round(overlap * 100);
  return buildComponent('semanticScore', score, config.defaultWeights.semanticScore,
    [`Text similarity: ${(overlap * 100).toFixed(0)}%`], [], 0.5);
}

// ============================================================================
// MAIN DETERMINISTIC SCORER
// ============================================================================

export function calculateJobDeterministicScore(
  job: HiringProfile,
  candidate: CandidateProfile,
  config: JobMatchingConfig = DEFAULT_JOB_CONFIG,
): DeterministicScoreBreakdown {
  const w = config.defaultWeights;

  const components: ScoringComponent[] = [
    calculateRoleTitleScore(job, candidate, config),
    calculateSeniorityScore(job, candidate, config),
    calculateSkillsScore(job, candidate, config),
    calculateWorkModeScore(job, candidate, config),
    calculateEmploymentTypeScore(job, candidate, config),
    calculateExperienceScore(job, candidate, config),
    calculateLocationScore(job, candidate, config),
    calculateSemanticScore(job, candidate, config),
    // Extended scoring dimensions
    calculatePreferredSkillsScore(job, candidate, config),
    calculateDomainScore(job, candidate, config),
    calculateLanguageScore(job, candidate, config),
    calculateCertificationScore(job, candidate, config),
    calculateEducationScore(job, candidate, config),
    calculateAvailabilityScore(job, candidate, config),
    calculateSalaryScore(job, candidate, config),
  ];

  // Apply weights
  for (const c of components) {
    c.weight = (w as any)[c.name] ?? c.weight;
    c.weightedScore = c.score * c.weight;
  }

  const totalWeight = components.reduce((s, c) => s + c.weight, 0);
  const rawScore = components.reduce((s, c) => s + c.weightedScore, 0);
  const normalizedScore = totalWeight > 0 ? Math.round(rawScore / totalWeight) : 0;
  const confidence = components.reduce((s, c) => s + c.confidence * c.weight, 0) / (totalWeight || 1);
  const allPenalties = components.flatMap(c => c.penalties);

  return {
    components,
    rawScore: Math.round(rawScore),
    normalizedScore: Math.max(0, Math.min(100, normalizedScore)),
    confidence,
    totalWeight,
    penalties: allPenalties,
  };
}

// ============================================================================
// RELEVANT EXPERIENCE COMPUTATION
// ============================================================================

/**
 * Compute total relevant years from structured experience entries.
 * Only counts segments where role family, skills, or domain overlap with the job.
 */
function computeRelevantYears(job: HiringProfile, entries: RelevantExperienceEntry[]): number {
  const jobRoleNorm = normalizeTag(job.roleArea);
  // Combine must-have and preferred skills for relevance computation
  const jobSkills: string[] = [];
  if (job.mustHaveSkills) jobSkills.push(...job.mustHaveSkills);
  if (job.preferredSkills) jobSkills.push(...job.preferredSkills);
  const jobSkillsNorm = new Set(jobSkills.map(normalizeTag));
  let total = 0;

  for (const entry of entries) {
    const roleMatch = normalizeTag(entry.roleFamily).includes(jobRoleNorm) ||
      jobRoleNorm.includes(normalizeTag(entry.roleFamily));
    const skillOverlap = entry.skills.some(s => jobSkillsNorm.has(normalizeTag(s)));

    if (roleMatch || skillOverlap) {
      total += entry.years;
    } else {
      // Partial credit: 25% if domain is related
      if (entry.domain && areSectorsRelated(entry.domain, job.roleArea)) {
        total += entry.years * 0.25;
      }
    }
  }

  return Math.round(total * 10) / 10;
}

// ============================================================================
// SKILL OVERLAP UTILITY
// ============================================================================

export function computeSkillOverlap(
  required: string[],
  candidate: string[],
): { matched: number; missing: number; matchRatio: number; matchedSkills: string[]; missingSkills: string[] } {
  const candNorm = new Set(candidate.map(normalizeTag));
  const matchedSkills: string[] = [];
  const missingSkills: string[] = [];

  for (const req of required) {
    const rn = normalizeTag(req);
    // Check exact or substring match
    const found = [...candNorm].some(c => c === rn || c.includes(rn) || rn.includes(c));
    if (found) {
      matchedSkills.push(req);
    } else {
      missingSkills.push(req);
    }
  }

  const matched = matchedSkills.length;
  const missing = missingSkills.length;
  const matchRatio = required.length > 0 ? matched / required.length : 0;

  return { matched, missing, matchRatio, matchedSkills, missingSkills };
}

// ============================================================================
// HELPERS
// ============================================================================

function buildComponent(
  name: string,
  score: number,
  weight: number,
  evidence: string[],
  penalties: string[],
  confidence: number,
): ScoringComponent {
  const explanation = evidence.length > 0
    ? evidence.join('; ')
    : penalties.length > 0
      ? penalties.join('; ')
      : `${name}: score ${score}`;
  return {
    name,
    score: Math.max(0, Math.min(100, Math.round(score))),
    weight,
    weightedScore: 0, // set later
    explanation,
    confidence,
    evidence,
    penalties,
  };
}

function tokenize(text: string): string[] {
  if (!text) return [];
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(t => t.length > 2);
}

function fuzzyTokenOverlap(a: string, b: string): number {
  const tokensA = new Set(tokenize(a));
  const tokensB = new Set(tokenize(b));
  if (tokensA.size === 0 || tokensB.size === 0) return 0;
  let overlap = 0;
  for (const t of tokensA) {
    if (tokensB.has(t)) overlap++;
  }
  return overlap / Math.max(tokensA.size, tokensB.size);
}

function extractCountry(location: string): string | null {
  // Very basic heuristic — would use a geocoding service in production
  const countries = ['us', 'usa', 'united states', 'uk', 'united kingdom', 'canada', 'germany',
    'france', 'australia', 'india', 'jordan', 'uae', 'saudi arabia', 'egypt',
    'netherlands', 'singapore', 'japan', 'brazil', 'spain', 'italy'];
  const loc = location.toLowerCase();
  for (const c of countries) {
    if (loc.includes(c)) return c;
  }
  return null;
}

/**
 * Maps LanguageProficiency enum values to an ordinal rank for comparison.
 * Higher rank indicates greater proficiency.  Used for determining if a
 * candidate's language proficiency meets or exceeds job requirements.
 */
export function languageProficiencyRank(p: LanguageProficiency): number {
  switch (p) {
    case LanguageProficiency.NATIVE: return 4;
    case LanguageProficiency.FLUENT: return 3;
    case LanguageProficiency.CONVERSATIONAL: return 2;
    case LanguageProficiency.BASIC: return 1;
    default: return 0;
  }
}

/**
 * Extract key reasons from scoring breakdown (top components).
 */
export function extractKeyReasons(components: ScoringComponent[]): string[] {
  return [...components]
    .filter(c => c.score >= 50)
    .sort((a, b) => b.weightedScore - a.weightedScore)
    .slice(0, 5)
    .map(c => c.explanation);
}
