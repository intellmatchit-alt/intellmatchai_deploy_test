/**
 * IntellMatch Job Matching Engine — Service
 *
 * Main orchestration: load job → discover candidates → hard-filter →
 * deterministic score → AI validate → rank → explain → persist.
 *
 * @module job-matching/job-matching.service
 */

import {
  HiringProfile,
  CandidateProfile,
  JobMatchResult,
  JobMatchResponse,
  FindJobMatchesRequest,
  JobMatchFilters,
  JobMatchingConfig,
  DEFAULT_JOB_CONFIG,
  DeterministicScoreBreakdown,
  Seniority,
  MatchLevel,
  HardFilterStatus,
  MatchExplanation,
} from './job-matching.types';

import {
  runJobHardFilters,
  HardFilterResult,
  calculateJobDeterministicScore,
  extractKeyReasons,
  computeSkillOverlap,
  languageProficiencyRank,
} from './job-scoring.utils';

import {
  applyGating,
  applyBoundedAIAdjustment,
  buildExplanation,
  normalizeTag,
  areSectorsRelated,
} from './matching-bands.constants';

import { JobLLMService, createJobLLMService } from './job-llm.service';

// ============================================================================
// SERVICE
// ============================================================================

export class JobMatchingService {
  private readonly prisma: any;
  private readonly config: JobMatchingConfig;
  private readonly llm: JobLLMService;

  constructor(prisma: any, config: JobMatchingConfig = DEFAULT_JOB_CONFIG, llmService?: JobLLMService) {
    this.prisma = prisma;
    this.config = config;
    this.llm = llmService || createJobLLMService();
  }

  // ==========================================================================
  // MAIN PIPELINE
  // ==========================================================================

  async findMatches(request: FindJobMatchesRequest): Promise<JobMatchResponse> {
    const start = Date.now();

    // 1. Load job
    const job = await this.loadJob(request.jobId);
    if (!job) throw new Error(`Job not found: ${request.jobId}`);

    // 2. Discover candidates
    const candidates = await this.discoverCandidates(job, request.filters);
    const totalCandidates = candidates.length;

    // 3. Score all
    const scored = this.scoreAll(job, candidates);

    // 4. Pre-filter for deterministic threshold plus a conservative AI review pool.
    const deterministicThreshold = this.config.thresholds.minDeterministicScore;
    const aiReviewBuffer = 10;
    const eligible = scored.filter((s) => s.hardFilter.status !== HardFilterStatus.FAIL);
    let passed = eligible.filter((s) => s.deterministicScore >= deterministicThreshold);
    const borderline = eligible
      .filter((s) => s.deterministicScore < deterministicThreshold && s.deterministicScore >= deterministicThreshold - aiReviewBuffer)
      .sort((a, b) => b.deterministicScore - a.deterministicScore)
      .slice(0, Math.max(10, this.config.thresholds.maxResults));

    const aiPool = dedupeScoredCandidatesById([...passed, ...borderline]);

    // 5. AI validation (optional)
    if (request.includeAI && this.llm.isAvailable() && this.config.features.enableAIValidation && aiPool.length > 0) {
      passed = await this.applyAI(job, aiPool);
    } else {
      passed = aiPool;
    }

    const postAIThreshold = this.config.thresholds.minPostAIScore;
    passed = passed.filter((s) => s.finalScore >= postAIThreshold);
    const filtered = totalCandidates - passed.length;

    // 6. Sort descending
    passed.sort((a, b) => b.finalScore - a.finalScore);

    // 7. Paginate
    const limit = request.limit ?? this.config.thresholds.maxResults;
    const offset = request.offset ?? 0;
    const page = passed.slice(offset, offset + limit);

    // 8. Build results with explanations
    const matches = page.map((s, i) => this.buildResult(job, s, offset + i, request.includeExplanations ?? true));

    // 9. Persist asynchronously
    this.saveMatches(job.id, matches).catch(e => console.warn('[JobMatching] Persist failed', e));

    return {
      success: true,
      matches,
      jobId: job.id,
      jobTitle: job.title,
      total: passed.length,
      limit,
      offset,
      hasMore: offset + limit < passed.length,
      candidatesEvaluated: totalCandidates,
      candidatesFiltered: filtered,
      processingTimeMs: Date.now() - start,
      generatedAt: new Date(),
    };
  }

  // ==========================================================================
  // SCORING
  // ==========================================================================

  private scoreAll(job: HiringProfile, candidates: CandidateProfile[]): ScoredCandidate[] {
    return candidates.map(c => {
      const hardFilter = runJobHardFilters(job, c, this.config);
      const breakdown = calculateJobDeterministicScore(job, c, this.config);
      const isSparse = c.dataQualityScore < this.config.thresholds.sparseRecordThreshold;
      const { level, capped, reason } = applyGating(
        breakdown.normalizedScore,
        breakdown.confidence,
        hardFilter.status,
        isSparse,
        this.config.confidenceGates,
      );

      return {
        candidate: c,
        hardFilter,
        breakdown,
        deterministicScore: breakdown.normalizedScore,
        aiScore: null,
        finalScore: breakdown.normalizedScore,
        confidence: breakdown.confidence,
        aiValidation: null,
        matchLevel: level,
        cappedReason: reason,
        isSparse,
      };
    });
  }

  // ==========================================================================
  // AI LAYER
  // ==========================================================================


  private async applyAI(job: HiringProfile, candidates: ScoredCandidate[]): Promise<ScoredCandidate[]> {
    try {
      const aiResults = await this.llm.validateMatches({
        job,
        candidates: candidates.map((c) => c.candidate),
        deterministicScores: candidates.map((c) => c.deterministicScore),
      });

      return candidates.map((sc, i) => {
        const ai = aiResults.find((a) => a.candidateId === sc.candidate.id) || aiResults[i];
        if (!ai || ai.confidence === 0) {
          return sc;
        }

        const { adjustedScore } = applyBoundedAIAdjustment(sc.deterministicScore, ai.adjustedScore);
        const mergedConfidence = mergeConfidence(sc.breakdown.confidence, ai.confidence);
        const { level, capped, reason } = applyGating(
          adjustedScore,
          mergedConfidence,
          sc.hardFilter.status,
          sc.isSparse,
          this.config.confidenceGates,
        );

        return {
          ...sc,
          aiScore: adjustedScore,
          finalScore: adjustedScore,
          confidence: mergedConfidence,
          aiValidation: ai,
          matchLevel: level,
          cappedReason: capped ? reason : sc.cappedReason,
        };
      });
    } catch (e) {
      console.error('[JobMatching] AI validation failed', e);
      return candidates;
    }
  }

  // ==========================================================================
  // RESULT BUILDING
  // ==========================================================================


  private buildResult(job: HiringProfile, sc: ScoredCandidate, rank: number, withExplanation: boolean): JobMatchResult {
    const c = sc.candidate;
    const mustHave = job.mustHaveSkills || [];
    const preferred = job.preferredSkills || [];
    const { matchedSkills: matchedMHSkills, missingSkills: missingMH } = computeSkillOverlap(mustHave, c.skills);
    const { matchedSkills: matchedPrefSkills, missingSkills: missingPref } = computeSkillOverlap(preferred, c.skills);
    const matchedSkills = [...matchedMHSkills, ...matchedPrefSkills];
    const missingSkills = [...missingMH, ...missingPref];

    let relevantYears: number | null = null;
    const totalYears = c.yearsOfExperience ?? null;
    let experienceNote = '';

    const expComp = sc.breakdown.components.find((x) => x.name === 'experienceScore');
    if (expComp) {
      const relevantMatch = expComp.evidence.find((e) => e.toLowerCase().includes('relevant'));
      if (relevantMatch) {
        const m = relevantMatch.match(/([\d.]+)\s*(?:relevant\s*)?year/i);
        if (m) relevantYears = parseFloat(m[1]);
      }
      experienceNote = expComp.explanation;
    }

    let explanation: MatchExplanation;
    if (withExplanation) {
      explanation = buildExplanation(
        sc.finalScore,
        sc.matchLevel,
        sc.breakdown.components,
        sc.hardFilter.status !== HardFilterStatus.PASS && sc.hardFilter.details ? [sc.hardFilter.details] : [],
        sc.cappedReason,
        sc.confidence,
      );

      if (totalYears != null && relevantYears != null && relevantYears < totalYears) {
        explanation.penalties.push(
          `Total experience (${totalYears}y) was not fully counted because only ${relevantYears}y is relevant to this role.`,
        );
      }

      if (sc.aiValidation?.reasoning) {
        explanation.strengths.push(`AI validation: ${sc.aiValidation.reasoning}`);
      }
      if (sc.aiValidation?.greenFlags?.length) {
        explanation.strengths.push(...sc.aiValidation.greenFlags.map((flag) => `AI green flag: ${flag}`));
      }
      if (sc.aiValidation?.redFlags?.length) {
        explanation.penalties.push(...sc.aiValidation.redFlags.map((flag) => `AI red flag: ${flag}`));
      }
      explanation.confidence_note = `${explanation.confidence_note} Deterministic ${(sc.breakdown.confidence * 100).toFixed(0)}%, AI ${(sc.aiValidation?.confidence != null ? (sc.aiValidation.confidence * 100).toFixed(0) : '0')}%, merged ${(sc.confidence * 100).toFixed(0)}%.`;
    } else {
      explanation = {} as MatchExplanation;
    }

    const jobLangs = job.requiredLanguages || [];
    const candLangs = c.languages || [];
    const matchedLanguages: string[] = [];
    const missingLanguages: string[] = [];
    for (const jl of jobLangs) {
      const cand = candLangs.find((cl) => normalizeTag(cl.language) === normalizeTag(jl.language));
      if (cand && languageProficiencyRank(cand.proficiency) >= languageProficiencyRank(jl.proficiency)) {
        matchedLanguages.push(jl.language);
      } else {
        missingLanguages.push(jl.language);
      }
    }

    const jobCerts = job.requiredCertifications || [];
    const candCertsNorm = (c.certifications || []).map(normalizeTag);
    const matchedCertifications: string[] = [];
    const missingCertifications: string[] = [];
    for (const jc of jobCerts) {
      if (candCertsNorm.includes(normalizeTag(jc))) {
        matchedCertifications.push(jc);
      } else {
        missingCertifications.push(jc);
      }
    }

    const jobInds = job.industries || [];
    const candInds = c.industries || [];
    const matchedIndustries: string[] = [];
    const missingIndustries: string[] = [];
    for (const ji of jobInds) {
      const found = candInds.some((ci) => normalizeTag(ci) === normalizeTag(ji) || areSectorsRelated(ji, ci));
      if (found) matchedIndustries.push(ji);
      else missingIndustries.push(ji);
    }

    const candidateName = resolveCandidateName(c);
    const keyReasons = extractKeyReasons(sc.breakdown.components);
    if (sc.aiValidation?.greenFlags?.length) {
      keyReasons.push(...sc.aiValidation.greenFlags.map((flag) => `AI: ${flag}`));
    }

    return {
      matchId: `jm_${job.id}_${c.id}_${Date.now()}`,
      jobId: job.id,
      candidateId: c.id,
      candidateName,
      candidateTitle: c.title,
      candidateRoleArea: c.roleArea,
      candidateSeniority: c.seniority,
      deterministicScore: sc.deterministicScore,
      aiScore: sc.aiScore,
      finalScore: sc.finalScore,
      confidence: sc.confidence,
      matchLevel: sc.matchLevel,
      levelCappedReason: sc.cappedReason,
      hardFilterStatus: sc.hardFilter.status,
      hardFilterReason: sc.hardFilter.reason,
      scoreBreakdown: sc.breakdown,
      explanation,
      keyReasons: dedupeStrings(keyReasons).slice(0, 8),
      matchedSkills,
      missingSkills,
      matchedLanguages,
      missingLanguages,
      matchedCertifications,
      missingCertifications,
      matchedIndustries,
      missingIndustries,
      relevantExperienceYears: relevantYears,
      totalExperienceYears: totalYears,
      experienceNote,
      rank: rank + 1,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    };
  }

  // ==========================================================================
  // DATA ACCESS
  // ==========================================================================

  private async loadJob(jobId: string): Promise<HiringProfile | null> {
    const raw = await this.prisma.hiringProfile.findUnique({ where: { id: jobId } });
    if (!raw) return null;
    return {
      id: raw.id,
      userId: raw.userId,
      organizationId: raw.organizationId,
      title: raw.title || '',
      roleArea: raw.roleArea || '',
      seniority: raw.seniority || Seniority.MID,
      location: raw.location || '',
      workMode: raw.workMode || 'REMOTE',
      employmentType: raw.employmentType || 'FULL_TIME',
      // Migrate legacy requiredSkills to mustHaveSkills if present
      mustHaveSkills: raw.mustHaveSkills || raw.requiredSkills || [],
      preferredSkills: raw.preferredSkills || [],
      jobSummaryRequirements: raw.jobSummaryRequirements || '',
      minimumYearsExperience: raw.minimumYearsExperience,
      hiringUrgency: raw.hiringUrgency,
      industries: raw.industries || [],
      requiredLanguages: raw.requiredLanguages || [],
      requiredCertifications: raw.requiredCertifications || [],
      requiredEducationLevels: raw.requiredEducationLevels || [],
      salaryRange: raw.salaryRange || undefined,
      tags: raw.tags || [],
      embedding: raw.embedding || [],
      dataQualityScore: raw.dataQualityScore ?? 50,
      excludedCandidates: raw.excludedCandidates || [],
      createdAt: raw.createdAt,
      updatedAt: raw.updatedAt,
    };
  }

  private async discoverCandidates(job: HiringProfile, filters?: JobMatchFilters): Promise<CandidateProfile[]> {
    // Build a Prisma where clause applying both global and request-level filters.
    const where: any = { optedOut: false, blocked: false };

    // Apply declared filters.  These filters reduce the candidate pool before scoring.
    if (filters?.workModes?.length) {
      where.desiredWorkMode = { hasSome: filters.workModes };
    }
    if (filters?.employmentTypes?.length) {
      where.desiredEmploymentType = { hasSome: filters.employmentTypes };
    }
    if (filters?.seniorities?.length) {
      where.seniority = { in: filters.seniorities };
    }
    if (filters?.locations?.length) {
      // simple inclusion match on location string; production geocoding could improve this
      where.location = { in: filters.locations };
    }
    if (filters?.minExperience != null) {
      where.yearsOfExperience = { gte: filters.minExperience };
    }
    if (filters?.skills?.length) {
      // require at least one of the requested skills to be present on the candidate
      where.skills = { hasSome: filters.skills };
    }
    if (filters?.excludeCandidateIds?.length) {
      where.id = { notIn: filters.excludeCandidateIds };
    }
    // Always respect the job's own excluded candidates
    if (job.excludedCandidates.length > 0) {
      where.id = { ...(where.id || {}), notIn: [...(where.id?.notIn || []), ...job.excludedCandidates] };
    }

    // Expand the prefetch limit relative to the number of results we intend to return.  This helps avoid
    // prematurely excluding strong candidates when ordering by dataQualityScore.
    const prefetchLimit = (this.config.thresholds?.maxResults || 100) * 2;
    const raws = await this.prisma.candidateProfile.findMany({ where, take: prefetchLimit, orderBy: { dataQualityScore: 'desc' } });

    return raws.map((r: any) => ({
      id: r.id,
      userId: r.userId,
      organizationId: r.organizationId,
      fullName: r.fullName || r.name || r.displayName || undefined,
      title: r.title || '',
      roleArea: r.roleArea || '',
      seniority: r.seniority || Seniority.MID,
      location: r.location || '',
      desiredWorkMode: r.desiredWorkMode || [],
      desiredEmploymentType: r.desiredEmploymentType || [],
      skills: r.skills || [],
      profileSummaryPreferences: r.profileSummaryPreferences || '',
      yearsOfExperience: r.yearsOfExperience,
      availability: r.availability,
      languages: r.languages || [],
      certifications: r.certifications || [],
      industries: r.industries || [],
      education: r.education || [],
      expectedSalary: r.expectedSalary || undefined,
      noticePeriod: r.noticePeriod,
      relevantExperience: r.relevantExperience || [],
      tags: r.tags || [],
      embedding: r.embedding || [],
      dataQualityScore: r.dataQualityScore ?? 50,
      optedOut: r.optedOut ?? false,
      blocked: r.blocked ?? false,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }));
  }

  // ==========================================================================
  // PERSISTENCE
  // ==========================================================================

  private async saveMatches(jobId: string, matches: JobMatchResult[]): Promise<void> {
    if (matches.length === 0) return;
    try {
      await this.prisma.$transaction(async (tx: any) => {
        await tx.jobMatch.updateMany({ where: { jobId, archived: false }, data: { archived: true, archivedAt: new Date() } });
        await tx.jobMatch.createMany({
          data: matches.map(m => ({
            id: m.matchId,
            jobId: m.jobId,
            candidateId: m.candidateId,
            deterministicScore: m.deterministicScore,
            aiScore: m.aiScore,
            finalScore: m.finalScore,
            confidence: m.confidence,
            matchLevel: m.matchLevel,
            hardFilterStatus: m.hardFilterStatus,
            hardFilterReason: m.hardFilterReason,
            scoreBreakdown: JSON.stringify(m.scoreBreakdown),
            explanation: m.explanation ? JSON.stringify(m.explanation) : null,
            keyReasons: m.keyReasons,
            rank: m.rank,
            version: 1,
            archived: false,
            createdAt: m.createdAt,
            expiresAt: m.expiresAt,
          })),
          skipDuplicates: true,
        });
      });
    } catch (err) {
      console.error('[JobMatching] Save failed', err);
    }
  }

  // ==========================================================================
  // PUBLIC HELPERS
  // ==========================================================================

  async getMatches(jobId: string, limit = 50): Promise<JobMatchResult[]> {
    const stored = await this.prisma.jobMatch.findMany({ where: { jobId, archived: false }, orderBy: { rank: 'asc' }, take: limit });
    return stored.map((s: any) => ({
      ...s,
      scoreBreakdown: JSON.parse(s.scoreBreakdown),
      explanation: s.explanation ? JSON.parse(s.explanation) : null,
    }));
  }
}

// ============================================================================
// INTERNAL TYPE
// ============================================================================

interface ScoredCandidate {
  candidate: CandidateProfile;
  hardFilter: HardFilterResult;
  breakdown: DeterministicScoreBreakdown;
  deterministicScore: number;
  aiScore: number | null;
  finalScore: number;
  confidence: number;
  aiValidation: { confidence: number; reasoning: string; redFlags: string[]; greenFlags: string[] } | null;
  matchLevel: MatchLevel;
  cappedReason: string | null;
  isSparse: boolean;
}

function mergeConfidence(deterministicConfidence: number, aiConfidence: number): number {
  return Math.max(0, Math.min(1, deterministicConfidence * 0.75 + aiConfidence * 0.25));
}

function resolveCandidateName(candidate: CandidateProfile): string {
  const name = (candidate as CandidateProfile & { fullName?: string; name?: string; displayName?: string }).fullName
    || (candidate as CandidateProfile & { fullName?: string; name?: string; displayName?: string }).name
    || (candidate as CandidateProfile & { fullName?: string; name?: string; displayName?: string }).displayName;
  return typeof name === 'string' && name.trim().length > 0 ? name.trim() : candidate.title;
}

function dedupeStrings(values: string[]): string[] {
  return [...new Set(values.filter((value) => typeof value === 'string' && value.trim().length > 0))];
}


function dedupeScoredCandidatesById(values: ScoredCandidate[]): ScoredCandidate[] {
  const seen = new Set<string>();
  const result: ScoredCandidate[] = [];
  for (const value of values) {
    if (!seen.has(value.candidate.id)) {
      seen.add(value.candidate.id);
      result.push(value);
    }
  }
  return result;
}

// ============================================================================
// FACTORY
// ============================================================================

export function createJobMatchingService(prisma: any, config?: JobMatchingConfig, llm?: JobLLMService): JobMatchingService {
  return new JobMatchingService(prisma, config, llm);
}
