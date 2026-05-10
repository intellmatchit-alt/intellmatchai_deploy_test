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
  MatchMode,
  HelperMatchResponse,
  HelperMatchResult,
  HelperMatchFilters,
  FindHelperMatchesRequest,
  HelperType,
  HELPER_TYPE_LABELS,
} from './job-matching.types';

import {
  HelperRecord,
  calculateHelperDeterministicScore,
  runHelperHardFilters,
  dedupeHelpersByIdentity,
  deriveHelperType,
  deriveLikelyHelpType,
  buildHelperExplanationSummary,
} from './job-helper-scoring.utils';

import {
  computeCandidateRetrievalScore,
  computeHelperRetrievalScore,
  RetrievalBreakdown,
} from './job-retrieval.utils';

import {
  computeCandidateEffectiveRankScore,
  computeHelperEffectiveRankScore,
  compareCandidateRank,
  compareHelperRank,
} from './job-rerank.utils';

/** Pool size at which the retrieval prefilter kicks in. Below this,
 *  every retrieved record runs through full scoring. Above it, the top
 *  RETRIEVAL_PREFILTER_TOP_N by retrievalScore are kept. */
const RETRIEVAL_PREFILTER_THRESHOLD = 200;
const RETRIEVAL_PREFILTER_TOP_N = 200;

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
  AI_MAX_SCORE_ADJUSTMENT,
  buildExplanation,
  normalizeTag,
  areSectorsRelated,
} from './matching-bands.constants';

import { JobLLMService, createJobLLMService } from './job-llm.service';
import {
  CohereRerankService,
  formatJobCandidateForRerank,
  buildJobRerankQuery,
} from '../../rerank/CohereRerankService';

// ============================================================================
// SERVICE
// ============================================================================

export class JobMatchingService {
  private readonly prisma: any;
  private readonly config: JobMatchingConfig;
  private readonly llm: JobLLMService;
  private readonly cohere: CohereRerankService;
  private cohereProbe: Promise<boolean> | null = null;

  constructor(prisma: any, config: JobMatchingConfig = DEFAULT_JOB_CONFIG, llmService?: JobLLMService) {
    this.prisma = prisma;
    this.config = config;
    this.llm = llmService || createJobLLMService();
    this.cohere = new CohereRerankService();
  }

  private async cohereAvailable(): Promise<boolean> {
    if (!this.cohereProbe) {
      this.cohereProbe = this.cohere.isAvailable().catch(() => false);
    }
    return this.cohereProbe;
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
    let candidates = await this.discoverCandidates(job, request.filters);
    const totalCandidates = candidates.length;

    // 2.5. Hybrid retrieval scoring (Phase 6). Cheap signal computed BEFORE
    // the expensive deterministic + AI + Cohere layers. Used as a soft
    // prefilter when the pool exceeds RETRIEVAL_PREFILTER_THRESHOLD.
    // Each candidate carries its retrievalScore + breakdown through to
    // the result envelope for diagnostics.
    const candRetrieval = new Map<string, RetrievalBreakdown>();
    for (const c of candidates) {
      candRetrieval.set(c.id, computeCandidateRetrievalScore(job, c));
    }
    if (candidates.length > RETRIEVAL_PREFILTER_THRESHOLD) {
      const before = candidates.length;
      candidates = [...candidates]
        .sort(
          (a, b) =>
            (candRetrieval.get(b.id)?.normalizedScore ?? 0) -
            (candRetrieval.get(a.id)?.normalizedScore ?? 0),
        )
        .slice(0, RETRIEVAL_PREFILTER_TOP_N);
      console.info('[JobMatching] Candidate retrieval prefilter applied', {
        before,
        after: candidates.length,
        threshold: RETRIEVAL_PREFILTER_THRESHOLD,
        keepTop: RETRIEVAL_PREFILTER_TOP_N,
      });
    }

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

    // 5.5. Cohere semantic reranking — rank-only signal.
    // Modifies effectiveRankScore (the sort key); does NOT modify finalScore
    // so the deterministic-first / bounded-AI contract is preserved.
    passed = await this.applyCohereRerank(job, passed, 50);

    // 5.6. Phase 7 spec multipliers compose ON TOP of the Cohere blend.
    // The Cohere step produced an effectiveRankScore that's a 50/50 blend of
    // finalScore and Cohere relevance — that becomes the `baseScore` we
    // apply confidence/sparse/warning/network/urgency multipliers to.
    // finalScore stays untouched (display contract).
    passed = passed.map((sc) => {
      const baseScore = sc.effectiveRankScore ?? sc.finalScore;
      const { effectiveRankScore } = computeCandidateEffectiveRankScore({
        baseScore,
        finalScore: sc.finalScore,
        confidence: sc.confidence,
        isSparse: sc.isSparse,
        hardFilterStatus: sc.hardFilter.status,
        // No requester-side network model wired into hiring flow yet.
        relationshipStrength: 0,
        hiringUrgency: (job as any).hiringUrgency ?? null,
      });
      return { ...sc, effectiveRankScore };
    });

    // 6. Sort with spec tie-break sequence (§16):
    //    effectiveRankScore → finalScore → confidence → skillsScore →
    //    experienceScore → semanticScore → relationshipStrength
    passed.sort((a, b) =>
      compareCandidateRank(
        {
          effectiveRankScore: a.effectiveRankScore ?? a.finalScore,
          finalScore: a.finalScore,
          confidence: a.confidence,
          scoreBreakdown: a.breakdown,
        },
        {
          effectiveRankScore: b.effectiveRankScore ?? b.finalScore,
          finalScore: b.finalScore,
          confidence: b.confidence,
          scoreBreakdown: b.breakdown,
        },
      ),
    );

    // 7. Paginate
    const limit = request.limit ?? this.config.thresholds.maxResults;
    const offset = request.offset ?? 0;
    const page = passed.slice(offset, offset + limit);

    // 8. Build results with explanations
    const matches = page.map((s, i) =>
      this.buildResult(
        job,
        s,
        offset + i,
        request.includeExplanations ?? true,
        candRetrieval.get(s.candidate.id) ?? null,
      ),
    );

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
  // SEMANTIC RERANK (Cohere)
  // ==========================================================================

  /**
   * Cohere semantic reranking layer — RANK-ONLY.
   *
   * Sends the top-N candidates to Cohere's rerank API with a job-aware query
   * and rich candidate documents. The returned relevance score does NOT
   * modify finalScore (which must stay deterministic + bounded-AI per the
   * spec). Instead it influences `effectiveRankScore`, the sort key used
   * to order results.
   *
   * Blend: 50% deterministic-or-AI finalScore, 50% Cohere relevance scaled
   * to 0..100. Tie-break by raw finalScore. Best-effort: failure leaves the
   * deterministic order in place.
   */
  private async applyCohereRerank(
    job: HiringProfile,
    candidates: ScoredCandidate[],
    topN: number,
  ): Promise<ScoredCandidate[]> {
    if (candidates.length === 0) return candidates;
    if (!(await this.cohereAvailable())) {
      // No Cohere → effectiveRankScore = finalScore so sort still works.
      return candidates.map((sc) => ({ ...sc, effectiveRankScore: sc.finalScore }));
    }

    try {
      const query = buildJobRerankQuery({
        title: job.title,
        roleArea: (job as any).roleArea ?? null,
        seniority: (job as any).seniority ?? null,
        employmentType: (job as any).employmentType ?? null,
        workMode: (job as any).workMode ?? null,
        minimumYearsExperience: (job as any).minimumYearsExperience ?? null,
        mustHaveSkills: job.mustHaveSkills ?? [],
        preferredSkills: job.preferredSkills ?? [],
        industries: (job as any).industries ?? [],
        requiredLanguages: (job as any).requiredLanguages ?? [],
        location: (job as any).location ?? null,
        jobSummaryRequirements:
          (job as any).jobSummaryRequirements ?? (job as any).summary ?? null,
      });

      // Pre-sort by deterministic finalScore so topN are the strongest
      // pre-rerank candidates; the rest pass through unchanged.
      const sortedByFinal = [...candidates].sort((a, b) => b.finalScore - a.finalScore);
      const head = sortedByFinal.slice(0, topN);
      const tail = sortedByFinal.slice(topN);

      const documents = head.map((sc) =>
        formatJobCandidateForRerank({
          id: sc.candidate.id,
          fullName: resolveCandidateName(sc.candidate),
          title: sc.candidate.title,
          roleArea: (sc.candidate as any).roleArea ?? null,
          seniority: (sc.candidate as any).seniority ?? null,
          yearsOfExperience: (sc.candidate as any).yearsOfExperience ?? null,
          skills: sc.candidate.skills ?? [],
          preferredSkills: (sc.candidate as any).preferredSkills ?? [],
          industries: (sc.candidate as any).industries ?? [],
          languages: (sc.candidate as any).languages ?? [],
          education: (sc.candidate as any).education ?? [],
          certifications: (sc.candidate as any).certifications ?? [],
          desiredEmploymentType: (sc.candidate as any).desiredEmploymentType ?? [],
          desiredWorkMode: (sc.candidate as any).desiredWorkMode ?? [],
          location: (sc.candidate as any).location ?? null,
          profileSummary:
            (sc.candidate as any).profileSummary ?? (sc.candidate as any).bio ?? null,
        }),
      );

      const result = await this.cohere.rerank(query, documents, {
        topN: documents.length,
        minScore: 0.05,
      });

      const rerankById = new Map(result.results.map((r) => [r.id, r.relevanceScore]));

      const headOut = head.map((sc) => {
        const rerank = rerankById.get(sc.candidate.id);
        if (typeof rerank !== 'number') {
          return { ...sc, effectiveRankScore: sc.finalScore };
        }
        // 50/50 blend, capped at 100. finalScore left untouched.
        const blended = Math.min(100, Math.round(sc.finalScore * 0.5 + rerank * 100 * 0.5));
        return {
          ...sc,
          rerankScore: rerank,
          effectiveRankScore: blended,
        };
      });

      const tailOut = tail.map((sc) => ({ ...sc, effectiveRankScore: sc.finalScore }));

      return [...headOut, ...tailOut];
    } catch (err) {
      console.warn('[JobMatching] Cohere rerank failed; using deterministic order', err);
      return candidates.map((sc) => ({ ...sc, effectiveRankScore: sc.finalScore }));
    }
  }

  // ==========================================================================
  // RESULT BUILDING
  // ==========================================================================


  private buildResult(
    job: HiringProfile,
    sc: ScoredCandidate,
    rank: number,
    withExplanation: boolean,
    retrieval: RetrievalBreakdown | null = null,
  ): JobMatchResult {
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
      rerankScore: sc.rerankScore ?? null,
      effectiveRankScore: sc.effectiveRankScore ?? null,
      retrievalScore: retrieval ? retrieval.normalizedScore : null,
      retrievalBreakdown: retrieval
        ? {
            components: retrieval.components.map((c) => ({
              name: c.name,
              score: c.score,
              weight: c.weight,
              available: c.available,
              evidence: c.evidence,
            })),
            weightedSum: retrieval.weightedSum,
            availableWeight: retrieval.availableWeight,
            normalizedScore: retrieval.normalizedScore,
          }
        : null,
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
        // Archive only HIRING_TO_CANDIDATES rows for this job — never touch
        // helper-flow rows that happen to share a target_job_id.
        await tx.jobMatch.updateMany({
          where: {
            jobId,
            archived: false,
            matchMode: 'HIRING_TO_CANDIDATES',
          },
          data: { archived: true, archivedAt: new Date() },
        });
        await tx.jobMatch.createMany({
          data: matches.map(m => ({
            id: m.matchId,
            matchMode: 'HIRING_TO_CANDIDATES',
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
            // Phase 0/6/7 diagnostic fields — now persisted so GET hydrates
            // the same shape without recomputing.
            effectiveRankScore: m.effectiveRankScore ?? null,
            rerankScore: m.rerankScore ?? null,
            retrievalScore: m.retrievalScore ?? null,
          })),
          skipDuplicates: true,
        });
      });
    } catch (err) {
      console.error('[JobMatching] Save failed', err);
    }
  }

  /**
   * Persist helper-flow matches under the same JobMatch table using the
   * matchMode discriminator. The JSON columns (scoreBreakdown, explanation,
   * keyReasons) carry the rich helper detail (strengths, gaps, AI flags,
   * retrieval breakdown). Dedicated columns hold helper identity + the
   * spec-mandated headline fields.
   *
   * Best-effort. Failure logs and returns; the in-memory response still
   * goes back to the caller.
   */
  private async saveHelperMatches(
    candidateProfileId: string,
    targetJobId: string | null,
    matches: HelperMatchResult[],
  ): Promise<void> {
    if (matches.length === 0) return;
    try {
      await this.prisma.$transaction(async (tx: any) => {
        // Archive prior helper-flow rows for THIS candidate profile + target
        // job (or null target). Hiring-flow rows untouched.
        await tx.jobMatch.updateMany({
          where: {
            candidateProfileId,
            targetJobId: targetJobId ?? null,
            archived: false,
            matchMode: { in: ['OPEN_TO_OPPORTUNITY_TO_HELPERS', 'TARGET_JOB_TO_HELPERS'] },
          },
          data: { archived: true, archivedAt: new Date() },
        });

        await tx.jobMatch.createMany({
          data: matches.map((m) => ({
            id: m.matchId,
            matchMode: m.matchMode,
            // Hiring-flow FKs left null for helper rows.
            jobId: null,
            candidateId: null,
            // Helper-flow identity.
            candidateProfileId: m.candidateProfileId,
            targetJobId: m.targetJobId ?? null,
            helperUserId: m.helperUserId ?? null,
            helperContactId: m.helperContactId ?? null,
            helperType: m.helperType,
            helperTypeLabel: m.helperTypeLabel,
            likelyHelpType: m.likelyHelpType,
            helperExplanation: m.helperExplanation,
            networkRelationship: m.networkRelationship,
            // Scores
            deterministicScore: m.deterministicScore,
            aiScore: m.aiScore,
            finalScore: m.finalScore,
            confidence: m.confidence,
            effectiveRankScore: m.effectiveRankScore ?? null,
            rerankScore: null, // Cohere helper rerank not yet wired
            retrievalScore:
              typeof m.retrievalScore === 'number' ? Math.round(m.retrievalScore) : null,
            // Bands + filter
            matchLevel: m.matchLevel,
            hardFilterStatus: m.hardFilterStatus,
            hardFilterReason: m.hardFilterReason,
            // Rich JSON — preserve the full breakdown for later hydration.
            scoreBreakdown: JSON.stringify(m.scoreBreakdown),
            // Stash helper display fields inside the JSON blob so the GET
            // path can hydrate them without a join. There's no dedicated
            // column for name/title/org on JobMatch — these are denormalized
            // identity strings, not relations.
            explanation: JSON.stringify({
              ...(m.explanation || {}),
              helperName: m.helperName,
              helperTitle: m.helperTitle,
              helperRoleArea: m.helperRoleArea,
              helperOrganization: m.helperOrganization,
              strengths: m.strengths,
              gaps: m.gaps,
              matchedSignals: m.matchedSignals,
              missingOrUncertainFields: m.missingOrUncertainFields,
              cautionFlags: m.cautionFlags,
              retrievalBreakdown: m.retrievalBreakdown ?? null,
            }),
            keyReasons: m.strengths.slice(0, 8),
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
      console.error('[JobMatching] Helper save failed', err);
    }
  }

  // ==========================================================================
  // PUBLIC HELPERS
  // ==========================================================================

  async getMatches(jobId: string, limit = 50): Promise<JobMatchResult[]> {
    const stored = await this.prisma.jobMatch.findMany({
      where: {
        jobId,
        archived: false,
        matchMode: 'HIRING_TO_CANDIDATES',
      },
      orderBy: { rank: 'asc' },
      take: limit,
    });
    return stored.map((s: any) => ({
      ...s,
      scoreBreakdown:
        typeof s.scoreBreakdown === 'string'
          ? JSON.parse(s.scoreBreakdown)
          : s.scoreBreakdown,
      explanation:
        s.explanation
          ? typeof s.explanation === 'string'
            ? JSON.parse(s.explanation)
            : s.explanation
          : null,
    }));
  }

  /**
   * Read saved helper-flow matches for a candidate profile.
   * Optionally scoped to a specific targetJobId (TARGET_JOB_TO_HELPERS rows).
   *
   * Hydrates the rich shape from JSON columns so the API returns the same
   * envelope POST returned, without re-running the pipeline.
   */
  async getHelperMatches(
    candidateProfileId: string,
    targetJobId: string | null = null,
    limit = 50,
  ): Promise<HelperMatchResult[]> {
    const where: any = {
      candidateProfileId,
      archived: false,
    };
    if (targetJobId === null) {
      where.matchMode = 'OPEN_TO_OPPORTUNITY_TO_HELPERS';
    } else {
      where.matchMode = 'TARGET_JOB_TO_HELPERS';
      where.targetJobId = targetJobId;
    }

    const stored = await this.prisma.jobMatch.findMany({
      where,
      orderBy: { rank: 'asc' },
      take: limit,
    });

    return stored.map((s: any) => {
      const breakdown =
        typeof s.scoreBreakdown === 'string'
          ? JSON.parse(s.scoreBreakdown)
          : s.scoreBreakdown;
      const explanationFull =
        s.explanation
          ? typeof s.explanation === 'string'
            ? JSON.parse(s.explanation)
            : s.explanation
          : null;
      // The JSON column carries the helper-specific surfaces appended at
      // save time. Pull them back out into top-level fields so the
      // HelperMatchResult shape matches what POST returned.
      const strengths = explanationFull?.strengths ?? [];
      const gaps = explanationFull?.gaps ?? [];
      const matchedSignals = explanationFull?.matchedSignals ?? [];
      const missingOrUncertainFields = explanationFull?.missingOrUncertainFields ?? [];
      const cautionFlags = explanationFull?.cautionFlags ?? [];
      const retrievalBreakdown = explanationFull?.retrievalBreakdown ?? null;

      const result: HelperMatchResult = {
        matchId: s.id,
        matchMode: s.matchMode,
        candidateProfileId: s.candidateProfileId,
        targetJobId: s.targetJobId ?? null,
        helperUserId: s.helperUserId ?? null,
        helperContactId: s.helperContactId ?? null,
        // Display fields are denormalized into the JSON blob at save time;
        // pull them back out here so the card has a name without a join.
        helperName: explanationFull?.helperName ?? '',
        helperTitle: explanationFull?.helperTitle ?? null,
        helperRoleArea: explanationFull?.helperRoleArea ?? null,
        helperOrganization: explanationFull?.helperOrganization ?? null,
        helperType: s.helperType,
        helperTypeLabel: s.helperTypeLabel,
        likelyHelpType: s.likelyHelpType,
        deterministicScore: s.deterministicScore,
        aiScore: s.aiScore ?? null,
        finalScore: s.finalScore,
        confidence: s.confidence,
        effectiveRankScore: s.effectiveRankScore ?? null,
        matchLevel: s.matchLevel,
        levelCappedReason: null,
        hardFilterStatus: s.hardFilterStatus,
        hardFilterReason: s.hardFilterReason ?? 'NONE',
        scoreBreakdown: breakdown,
        explanation: explanationFull,
        helperExplanation: s.helperExplanation ?? '',
        strengths,
        gaps,
        matchedSignals,
        missingOrUncertainFields,
        cautionFlags,
        networkRelationship: s.networkRelationship ?? null,
        retrievalScore: s.retrievalScore ?? null,
        retrievalBreakdown,
        rank: s.rank,
        createdAt: s.createdAt,
        expiresAt: s.expiresAt,
      };

      return result;
    });
  }

  // ==========================================================================
  // HELPER FLOW (Phase 1 skeleton — real scoring lands in Phase 2)
  // ==========================================================================

  /**
   * Find people in the requester's network who can help a candidate reach
   * relevant job opportunities.
   *
   * Mode selection:
   *   - request.targetJobId present → TARGET_JOB_TO_HELPERS
   *   - otherwise                   → OPEN_TO_OPPORTUNITY_TO_HELPERS
   *
   * PHASE 1: returns an empty match list with the correct envelope shape.
   * Real helper scoring (10-component deterministic, hard filters,
   * AI validation, reranking) is implemented in Phase 2.
   */
  async findHelpers(request: FindHelperMatchesRequest): Promise<HelperMatchResponse> {
    const start = Date.now();

    const candidate = await this.loadCandidateProfile(request.candidateProfileId);
    if (!candidate) {
      throw new Error(`Candidate profile not found: ${request.candidateProfileId}`);
    }

    const matchMode = request.targetJobId
      ? MatchMode.TARGET_JOB_TO_HELPERS
      : MatchMode.OPEN_TO_OPPORTUNITY_TO_HELPERS;

    const limit = Math.min(request.limit ?? this.config.thresholds.maxResults, 100);
    const offset = request.offset ?? 0;

    // Search the requester's network. Falls back to the candidate's own
    // userId so a candidate searching for themselves "just works".
    const requesterUserId = request.requesterUserId || (candidate as any).userId;

    // 1. Retrieve helpers from the requester's contact list.
    // Phase 6 will add accepted-Connection User retrieval and second-degree
    // expansion. For Phase 2 we keep the search space focused.
    const retrieved = await this.retrieveHelpers(
      requesterUserId,
      request.filters,
    );
    const retrievedCount = retrieved.length;

    // 1.5. Dedupe by stable identity BEFORE scoring (avoids double-scoring
    // and matches the spec §18 dedupe contract).
    const dedupedHelpers = dedupeHelpersByIdentity(retrieved);
    if (retrievedCount !== dedupedHelpers.length) {
      console.info('[JobMatching] Helper dedupe collapsed', {
        retrieved: retrievedCount,
        afterDedupe: dedupedHelpers.length,
        collapsed: retrievedCount - dedupedHelpers.length,
      });
    }

    // 1.7. Hybrid retrieval scoring (Phase 6). Cheap signal computed BEFORE
    // the expensive deterministic + AI layers. Used:
    //   - as a soft prefilter when the pool exceeds RETRIEVAL_PREFILTER_THRESHOLD
    //   - as a diagnostic surfaced on each result via retrievalScore /
    //     retrievalBreakdown
    // The headline displayed score remains finalScore.
    const withRetrieval: Array<{ helper: HelperRecord; retrieval: RetrievalBreakdown }> =
      dedupedHelpers.map((helper) => ({
        helper,
        retrieval: computeHelperRetrievalScore(candidate, helper),
      }));

    let prefiltered = withRetrieval;
    if (withRetrieval.length > RETRIEVAL_PREFILTER_THRESHOLD) {
      prefiltered = [...withRetrieval]
        .sort(
          (a, b) => b.retrieval.normalizedScore - a.retrieval.normalizedScore,
        )
        .slice(0, RETRIEVAL_PREFILTER_TOP_N);
      console.info('[JobMatching] Helper retrieval prefilter applied', {
        before: withRetrieval.length,
        after: prefiltered.length,
        threshold: RETRIEVAL_PREFILTER_THRESHOLD,
        keepTop: RETRIEVAL_PREFILTER_TOP_N,
      });
    }

    const helpersEvaluated = prefiltered.length;

    // 2. Score every helper. Hard filters are intentionally minimal here
    // (opt-out / blocked / explicitly excluded / self-match / unreachable).
    // A non-recruiter senior operator can still be a useful warm-intro.
    const excludeUserIds = request.filters?.excludeUserIds;
    const candidateUserId = (candidate as any).userId ?? null;
    const scored = prefiltered
      .map(({ helper, retrieval }) => {
        const hardFilter = runHelperHardFilters(helper, {
          candidateUserId,
          excludeUserIds,
        });
        const breakdown = calculateHelperDeterministicScore(helper, candidate);
        const isSparse = false; // Contacts don't have a dataQualityScore field
        const { level, capped, reason } = applyGating(
          breakdown.normalizedScore,
          breakdown.confidence,
          hardFilter.status,
          isSparse,
          this.config.confidenceGates,
        );
        return { helper, retrieval, hardFilter, breakdown, matchLevel: level, capped, cappedReason: reason };
      })
      // Drop only hard-FAILed helpers — keep WARN through to the response.
      .filter((s) => s.hardFilter.status !== HardFilterStatus.FAIL);

    const helpersFiltered = helpersEvaluated - scored.length;

    // 2.5. Pre-compute helperType per scored helper — needed both to feed the
    // LLM (so it can refine likelyHelpType) and for downstream display.
    const enriched = scored.map((s) => {
      const compScore = (n: string) =>
        s.breakdown.components.find((c) => c.name === n)?.score ?? 0;
      const helperType = deriveHelperType({
        recruiterScore: compScore('recruiterTalentSignalScore'),
        hiringInfluenceScore: compScore('hiringInfluenceScore'),
        functionalRelevanceScore: compScore('functionalRelevanceScore'),
        relationshipTrustScore: compScore('relationshipTrustScore'),
        introPathScore: compScore('introPathScore'),
        advocacyLikelihoodScore: compScore('advocacyLikelihoodScore'),
      });
      return {
        ...s,
        // s.retrieval comes from the prefilter pass — keep it on the
        // enriched record so the result builder can surface it.
        retrieval: s.retrieval,
        helperType,
        deterministicScore: s.breakdown.normalizedScore,
        finalScore: s.breakdown.normalizedScore,
        aiScore: null as number | null,
        aiReasoning: '' as string,
        aiGreenFlags: [] as string[],
        aiRedFlags: [] as string[],
        confidence: s.breakdown.confidence,
      };
    });

    // 3. Sort by deterministic finalScore so AI sees the strongest first.
    enriched.sort((a, b) => b.finalScore - a.finalScore);

    // 3.5. Bounded LLM helper validation (Phase 4).
    // - Only runs when caller asked for AI AND the LLM is configured.
    // - Helper-framed prompt: "Can this person help the candidate?"
    // - Bounded by AI_MAX_SCORE_ADJUSTMENT (±15) per helper.
    // - Hard-filter FAIL helpers were already dropped above, so the LLM
    //   never sees them — it physically cannot override a FAIL.
    // - Best-effort: failure leaves deterministic scores intact.
    if (
      request.includeAI !== false &&
      this.llm.isAvailable() &&
      enriched.length > 0
    ) {
      const aiWindow = enriched.slice(0, 30);
      try {
        const aiResults = await this.llm.validateHelperMatches({
          candidate,
          helpers: aiWindow.map((e) => ({
            id: e.helper.id,
            fullName: e.helper.fullName,
            jobTitle: e.helper.jobTitle,
            company: e.helper.company,
            bio: e.helper.bio,
            skills: e.helper.skills,
            sectors: e.helper.sectors,
            helperType: e.helperType,
            network: {
              degree: e.helper.network.degree,
              sameOrganization: e.helper.network.sameOrganization,
            },
          })),
          deterministicScores: aiWindow.map((e) => e.deterministicScore),
        });

        for (const ai of aiResults) {
          if (!ai || ai.confidence === 0) continue;
          const target = aiWindow.find((e) => e.helper.id === ai.helperId);
          if (!target) continue;

          // Apply bounded delta. The LLM's adjustedScore was already
          // clamped to ±AI_MAX_SCORE_ADJUSTMENT in parseHelperValidation,
          // but we re-clamp defensively.
          const orig = target.deterministicScore;
          const delta = Math.max(
            -AI_MAX_SCORE_ADJUSTMENT,
            Math.min(AI_MAX_SCORE_ADJUSTMENT, ai.adjustedScore - orig),
          );
          const newFinal = Math.max(0, Math.min(100, Math.round(orig + delta)));

          target.aiScore = newFinal;
          target.finalScore = newFinal;
          target.aiReasoning = ai.reasoning || '';
          target.aiGreenFlags = ai.greenFlags || [];
          target.aiRedFlags = ai.redFlags || [];

          // Merge confidences the same way candidate-flow AI does.
          target.confidence = Math.max(
            0,
            Math.min(
              1,
              target.breakdown.confidence * 0.75 + ai.confidence * 0.25,
            ),
          );

          // Re-gate matchLevel against the AI-adjusted score.
          const regated = applyGating(
            newFinal,
            target.confidence,
            target.hardFilter.status,
            false,
            this.config.confidenceGates,
          );
          target.matchLevel = regated.level;
          target.capped = regated.capped;
          target.cappedReason = regated.reason;
        }

      } catch (err) {
        console.warn('[JobMatching] Helper AI validation failed', err);
      }
    }

    // 3.7. Phase 7: compute helper effectiveRankScore using spec multipliers
    // (confidencePenalty × relationshipTrustBoost × introPathBoost ×
    //  helperTypeBoost). Display finalScore stays untouched.
    const ranked = enriched.map((e) => {
      const compScore = (n: string) =>
        e.breakdown.components.find((c) => c.name === n)?.score ?? 0;
      const { effectiveRankScore } = computeHelperEffectiveRankScore({
        finalScore: e.finalScore,
        confidence: e.confidence,
        helperType: e.helperType,
        relationshipTrustScore: compScore('relationshipTrustScore'),
        introPathScore: compScore('introPathScore'),
      });
      return { ...e, effectiveRankScore };
    });

    // 3.8. Sort with the spec tie-break sequence (§16) — effectiveRankScore
    // → finalScore → trust → hiringInfluence → introPath → functional →
    // network strength.
    ranked.sort((a, b) =>
      compareHelperRank(
        {
          effectiveRankScore: a.effectiveRankScore,
          finalScore: a.finalScore,
          scoreBreakdown: a.breakdown,
          networkRelationshipStrength: a.helper.network.relationshipStrength,
        },
        {
          effectiveRankScore: b.effectiveRankScore,
          finalScore: b.finalScore,
          scoreBreakdown: b.breakdown,
          networkRelationshipStrength: b.helper.network.relationshipStrength,
        },
      ),
    );

    // 4. Paginate
    const page = ranked.slice(offset, offset + limit);

    // 5. Build HelperMatchResult per kept helper.
    const matches: HelperMatchResult[] = page.map((s, i) => {
      const helperType = s.helperType;
      const likelyHelpType = deriveLikelyHelpType(helperType);

      const helperExplanation = buildHelperExplanationSummary(
        s.helper,
        helperType,
        likelyHelpType,
        s.breakdown,
      );

      const matchExplanation = request.includeExplanations !== false
        ? buildExplanation(
            s.finalScore,
            s.matchLevel,
            s.breakdown.components,
            s.hardFilter.status !== HardFilterStatus.PASS && s.hardFilter.details
              ? [s.hardFilter.details]
              : [],
            s.capped ? s.cappedReason : null,
            s.confidence,
          )
        : ({} as MatchExplanation);

      // AI reasoning attaches to strengths/penalties so the UI shows it
      // alongside deterministic signals (matches the candidate-flow pattern).
      if (request.includeExplanations !== false && s.aiReasoning) {
        matchExplanation.strengths = matchExplanation.strengths || [];
        matchExplanation.strengths.push(`AI validation: ${s.aiReasoning}`);
        if (s.aiGreenFlags.length) {
          matchExplanation.strengths.push(
            ...s.aiGreenFlags.map((f) => `AI green flag: ${f}`),
          );
        }
        if (s.aiRedFlags.length) {
          matchExplanation.penalties = matchExplanation.penalties || [];
          matchExplanation.penalties.push(
            ...s.aiRedFlags.map((f) => `AI red flag: ${f}`),
          );
        }
      }

      const strengths = s.breakdown.components
        .filter((c) => c.score >= 60)
        .sort((a, b) => b.weightedScore - a.weightedScore)
        .map((c) => c.explanation)
        .slice(0, 5);
      // Append AI green flags to user-visible strengths so they appear on
      // the card without the user having to expand the breakdown.
      if (s.aiGreenFlags.length) {
        for (const flag of s.aiGreenFlags) {
          if (!strengths.some((str) => str.toLowerCase().includes(flag.toLowerCase()))) {
            strengths.push(flag);
          }
        }
      }
      const gaps = s.breakdown.components
        .filter((c) => c.score < 40)
        .sort((a, b) => a.weightedScore - b.weightedScore)
        .map((c) => c.explanation)
        .slice(0, 5);
      const matchedSignals = s.breakdown.components
        .filter((c) => c.score >= 50)
        .flatMap((c) => c.evidence)
        .slice(0, 8);
      const missingOrUncertainFields = s.breakdown.components
        .filter((c) => c.confidence < 0.5)
        .map((c) => c.name);
      const cautionFlags = [
        ...s.breakdown.components.flatMap((c) => c.penalties),
        ...s.aiRedFlags,
      ].slice(0, 5);

      return {
        matchId: `hm_${candidate.id}_${s.helper.id}_${Date.now()}`,
        matchMode,
        candidateProfileId: candidate.id,
        targetJobId: request.targetJobId ?? null,
        helperUserId: s.helper.userId,
        helperContactId: s.helper.contactId,
        helperName: s.helper.fullName,
        helperTitle: s.helper.jobTitle,
        helperRoleArea: null,
        helperOrganization: s.helper.company,
        helperType,
        helperTypeLabel: HELPER_TYPE_LABELS[helperType],
        likelyHelpType,
        deterministicScore: s.deterministicScore,
        aiScore: s.aiScore,
        finalScore: s.finalScore,
        confidence: s.confidence,
        // Phase 7: Spec multipliers compose with finalScore. Used for sort
        // order. Display layer must show finalScore, not this.
        effectiveRankScore: Math.round(s.effectiveRankScore ?? s.finalScore),
        matchLevel: s.matchLevel,
        levelCappedReason: s.capped ? s.cappedReason : null,
        hardFilterStatus: s.hardFilter.status,
        hardFilterReason: s.hardFilter.reason,
        scoreBreakdown: s.breakdown,
        explanation: matchExplanation,
        helperExplanation,
        strengths,
        gaps,
        matchedSignals,
        missingOrUncertainFields,
        cautionFlags,
        networkRelationship:
          s.helper.network.degree === 1
            ? 'Direct connection'
            : s.helper.network.degree === 2
              ? '2nd-degree connection'
              : 'Distant connection',
        retrievalScore: s.retrieval ? s.retrieval.normalizedScore : null,
        retrievalBreakdown: s.retrieval
          ? {
              components: s.retrieval.components.map((c) => ({
                name: c.name,
                score: c.score,
                weight: c.weight,
                available: c.available,
                evidence: c.evidence,
              })),
              weightedSum: s.retrieval.weightedSum,
              availableWeight: s.retrieval.availableWeight,
              normalizedScore: s.retrieval.normalizedScore,
            }
          : null,
        rank: offset + i + 1,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      };
    });

    // 6. Persist asynchronously — same fire-and-forget pattern as findMatches.
    this.saveHelperMatches(
      candidate.id,
      request.targetJobId ?? null,
      matches,
    ).catch((e) => console.warn('[JobMatching] Helper persist failed', e));

    return {
      success: true,
      matchMode,
      matches,
      candidateProfileId: candidate.id,
      candidateTitle: candidate.title || '',
      targetJobId: request.targetJobId ?? null,
      total: scored.length,
      limit,
      offset,
      hasMore: offset + limit < scored.length,
      helpersEvaluated,
      helpersFiltered,
      processingTimeMs: Date.now() - start,
      generatedAt: new Date(),
    };
  }

  private async loadCandidateProfile(profileId: string): Promise<CandidateProfile | null> {
    const raw = await this.prisma.candidateProfile.findUnique({ where: { id: profileId } });
    if (!raw) return null;
    return raw as CandidateProfile;
  }

  /**
   * Retrieve helpers from the requester's network and normalise them into
   * the {@link HelperRecord} shape the helper scorer expects. For Phase 2
   * we source from Contact rows owned by the requester. Phase 6 will add
   * accepted-Connection User retrieval and second-degree expansion.
   */
  private async retrieveHelpers(
    requesterUserId: string,
    filters?: HelperMatchFilters,
  ): Promise<HelperRecord[]> {
    const contacts = await this.prisma.contact.findMany({
      where: { ownerId: requesterUserId },
      include: {
        contactSectors: { include: { sector: { select: { name: true } } } },
        contactSkills: { include: { skill: { select: { name: true } } } },
        contactInterests: { include: { interest: { select: { name: true } } } },
      },
      take: 500,
    });

    return contacts.map((c: any): HelperRecord => ({
      id: c.id,
      userId: null, // Contact-sourced helpers don't have a userId by default
      contactId: c.id,
      fullName: c.fullName || '',
      jobTitle: c.jobTitle || null,
      company: c.company || null,
      bio: c.bioSummary || c.bio || null,
      email: c.email || null,
      linkedinUrl: c.linkedinUrl || null,
      sectors: (c.contactSectors || [])
        .map((cs: any) => cs.sector?.name)
        .filter(Boolean),
      skills: (c.contactSkills || [])
        .map((cs: any) => cs.skill?.name)
        .filter(Boolean),
      interests: (c.contactInterests || [])
        .map((ci: any) => ci.interest?.name)
        .filter(Boolean),
      // Direct contacts in the requester's network are degree-1 by definition.
      // Mutual connections / strength can be wired up later from the graph.
      network: {
        degree: 1,
        mutualConnections: 0,
        sameOrganization: false,
        relationshipStrength: 0,
      },
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
  /** Cohere semantic relevance, 0..1. Populated when rerank ran. */
  rerankScore?: number;
  /** Sort key. finalScore + Cohere blend; falls back to finalScore. */
  effectiveRankScore?: number;
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
