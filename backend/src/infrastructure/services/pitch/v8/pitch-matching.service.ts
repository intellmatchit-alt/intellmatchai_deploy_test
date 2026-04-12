/**
 * IntellMatch Pitch Matching Engine — Service
 * v8.0.0 — production-hardened
 *
 * Changes: auth scoping, effectiveRankScore, multi-phase retrieval,
 * tighter thresholds, AI reasoning exposure, intent-specific minimums.
 */

import {
  PitchProfile, PitchContact, PitchMatchResult, PitchMatchResponse, FindPitchMatchesRequest,
  PitchMatchFilters, PitchMatchingConfig, DEFAULT_PITCH_CONFIG, DeterministicScoreBreakdown,
  PitchStage, BusinessModel, MatchIntent, MatchLevel, HardFilterStatus, MatchExplanation,
  PerIntentEvaluation, AuthContext, PitchAIValidationItem,
} from './pitch-matching.types';

import {
  HardFilterResult, runPitchHardFilters, calculatePitchDeterministicScore,
  extractKeyReasons, inferIntentsFromNeedText,
} from './pitch-scoring.utils';

import {
  applyBoundedAIAdjustment, applyGating, buildExplanation, normalizeTag, clampScore,
} from './matching-bands.constants';

import { PitchLLMService, createPitchLLMService } from './pitch-llm.service';

interface ScoredContact {
  contact: PitchContact;
  selectedIntent: MatchIntent;
  surfacedIntents: PerIntentEvaluation[];
  evaluatedIntents: PerIntentEvaluation[];
  topIntentEvaluations: PerIntentEvaluation[];
  intentSelectionSummary: string;
  alternativeIntentSummaries: string[];
  hardFilter: HardFilterResult;
  breakdown: DeterministicScoreBreakdown;
  deterministicScore: number;
  deterministicConfidence: number;
  aiScore: number | null;
  aiConfidence: number | null;
  aiReasoning: string | null;
  aiGreenFlags: string[];
  aiRedFlags: string[];
  finalScore: number;
  finalConfidence: number;
  effectiveRankScore: number;
  matchLevel: MatchLevel;
  cappedReason: string | null;
  rankPenaltyFactor: number;
  isSparse: boolean;
}

type IntentEvalWorkItem = { intent: MatchIntent; hardFilter: HardFilterResult; breakdown: DeterministicScoreBreakdown };

export class PitchMatchingService {
  private readonly prisma: any;
  private readonly config: PitchMatchingConfig;
  private readonly llm: PitchLLMService;

  constructor(prisma: any, config: PitchMatchingConfig = DEFAULT_PITCH_CONFIG, llm?: PitchLLMService) {
    this.prisma = prisma;
    this.config = config;
    this.llm = llm || createPitchLLMService();
  }

  /** v8: Auth-scoped main entry point */
  async findMatches(auth: AuthContext, request: FindPitchMatchesRequest): Promise<PitchMatchResponse> {
    const startedAt = Date.now();
    const pitch = await this.loadPitch(request.pitchId, auth);
    if (!pitch) throw new Error(`Pitch not found or access denied: ${request.pitchId}`);

    const contacts = await this.discoverContacts(pitch, request.filters);
    const scored = this.scoreAll(pitch, contacts);

    // v8: Apply intent-specific minimums and tighter thresholds
    let passed = scored.filter(item => {
      if (item.hardFilter.status === HardFilterStatus.FAIL) return false;
      if (item.deterministicScore < this.config.thresholds.minDeterministicScore) return false;
      const intentMin = this.config.thresholds.intentMinScores?.[item.selectedIntent];
      if (intentMin && item.deterministicScore < intentMin) return false;
      return true;
    });
    const contactsFiltered = contacts.length - passed.length;

    if (request.includeAI && this.llm.isAvailable() && this.config.features.enableAIValidation && passed.length > 0) {
      passed = await this.applyAI(pitch, passed);
    }

    passed = passed.filter(item => item.finalScore >= this.config.thresholds.minPostAIScore);

    // v8: Sort by effectiveRankScore, not raw finalScore
    passed.sort((a, b) =>
      b.effectiveRankScore - a.effectiveRankScore ||
      b.finalConfidence - a.finalConfidence ||
      b.deterministicScore - a.deterministicScore,
    );

    const limit = Math.min(request.limit ?? this.config.thresholds.maxResults, this.config.thresholds.maxResults);
    const offset = Math.max(request.offset ?? 0, 0);
    const page = passed.slice(offset, offset + limit);

    const matches = page.map((item, index) => this.buildResult(pitch, item, offset + index + 1, request.includeExplanations ?? true));
    this.saveMatches(pitch.id, matches).catch(error => console.warn('[PitchMatching] Persist failed', error));

    return {
      success: true, matches, pitchId: pitch.id, pitchTitle: pitch.pitchTitle,
      total: passed.length, limit, offset, hasMore: offset + limit < passed.length,
      contactsEvaluated: contacts.length, contactsFiltered,
      processingTimeMs: Date.now() - startedAt, generatedAt: new Date(),
    };
  }

  /** v8: Auth-scoped match retrieval */
  async getMatches(auth: AuthContext, pitchId: string, limit = 50): Promise<PitchMatchResult[]> {
    // Verify ownership before returning matches
    const pitch = await this.prisma.pitchProfile.findFirst({
      where: { id: pitchId, ...(auth.organizationId ? { organizationId: auth.organizationId } : { userId: auth.userId }) },
      select: { id: true },
    });
    if (!pitch) throw new Error(`Pitch not found or access denied: ${pitchId}`);

    const stored = await this.prisma.pitchMatch.findMany({
      where: { pitchId, archived: false },
      orderBy: { rank: 'asc' }, take: limit,
    });
    return stored.map((r: any) => ({
      ...r,
      scoreBreakdown: typeof r.scoreBreakdown === 'string' ? JSON.parse(r.scoreBreakdown) : r.scoreBreakdown,
      explanation: r.explanation ? (typeof r.explanation === 'string' ? JSON.parse(r.explanation) : r.explanation) : null,
    }));
  }

  // ==========================================================================
  // SCORING
  // ==========================================================================

  private scoreAll(pitch: PitchProfile, contacts: PitchContact[]): ScoredContact[] {
    return contacts.map(contact => {
      const candidateIntents = new Set<MatchIntent>();
      if (pitch.matchIntent?.length) for (const i of pitch.matchIntent) candidateIntents.add(i);
      if (contact.contactTypes?.length) for (const i of contact.contactTypes) candidateIntents.add(i);
      const inferred = inferIntentsFromNeedText(pitch.whatYouNeed, [pitch.elevatorPitch, pitch.problemStatement, pitch.solutionSummary, pitch.tractionSummary || '', pitch.founderBackgroundSummary || '']);
      for (const i of inferred) candidateIntents.add(i);
      if (candidateIntents.size === 0) candidateIntents.add(MatchIntent.STRATEGIC_PARTNER);

      const evaluations: IntentEvalWorkItem[] = Array.from(candidateIntents).map(intent => ({
        intent,
        hardFilter: runPitchHardFilters(pitch, contact, intent, this.config),
        breakdown: calculatePitchDeterministicScore(pitch, contact, intent, this.config),
      }));

      const best = this.selectBestIntentEvaluation(evaluations);
      const ranked = this.rankIntentEvaluations(evaluations, best.intent);
      const surfaced = this.selectSurfacedIntents(ranked);
      const isSparse = Math.min(pitch.dataQualityScore || 0, contact.dataQualityScore || 0) < this.config.thresholds.sparseRecordThreshold;
      const gating = applyGating(best.breakdown.normalizedScore, best.breakdown.confidence, best.hardFilter.status, isSparse, this.config.confidenceGates);

      // v8: effectiveRankScore = finalScore * gating penalty
      const effectiveRankScore = clampScore(best.breakdown.normalizedScore * gating.rankPenaltyFactor);

      return {
        contact, selectedIntent: best.intent, surfacedIntents: surfaced,
        evaluatedIntents: ranked, topIntentEvaluations: ranked.slice(0, 3),
        intentSelectionSummary: this.buildIntentSelectionSummary(ranked),
        alternativeIntentSummaries: surfaced.filter(i => i.intent !== best.intent).map(i => i.surfaceLabel || `${i.intent}: ${i.weightedScore}/100`),
        hardFilter: best.hardFilter,
        breakdown: { ...best.breakdown, perIntentEvaluations: ranked },
        deterministicScore: best.breakdown.normalizedScore,
        deterministicConfidence: best.breakdown.confidence,
        aiScore: null, aiConfidence: null,
        aiReasoning: null, aiGreenFlags: [], aiRedFlags: [],
        finalScore: best.breakdown.normalizedScore,
        finalConfidence: best.breakdown.confidence,
        effectiveRankScore,
        matchLevel: gating.level, cappedReason: gating.reason,
        rankPenaltyFactor: gating.rankPenaltyFactor,
        isSparse,
      };
    });
  }

  private selectBestIntentEvaluation(evaluations: IntentEvalWorkItem[]): IntentEvalWorkItem {
    const passing = evaluations.filter(i => i.hardFilter.status !== HardFilterStatus.FAIL);
    const pool = passing.length ? passing : evaluations;
    return [...pool].sort((a, b) => {
      const fd = Number(a.hardFilter.status === HardFilterStatus.FAIL) - Number(b.hardFilter.status === HardFilterStatus.FAIL);
      if (fd !== 0) return fd;
      if (b.breakdown.normalizedScore !== a.breakdown.normalizedScore) return b.breakdown.normalizedScore - a.breakdown.normalizedScore;
      return b.breakdown.confidence - a.breakdown.confidence;
    })[0];
  }

  private rankIntentEvaluations(evaluations: IntentEvalWorkItem[], selectedIntent: MatchIntent): PerIntentEvaluation[] {
    const sorted = [...evaluations].sort((a, b) => {
      const fd = Number(a.hardFilter.status === HardFilterStatus.FAIL) - Number(b.hardFilter.status === HardFilterStatus.FAIL);
      if (fd !== 0) return fd;
      return b.breakdown.normalizedScore - a.breakdown.normalizedScore || b.breakdown.confidence - a.breakdown.confidence;
    });
    const winner = sorted[0];
    return sorted.map((item, index) => {
      const delta = Number((winner.breakdown.normalizedScore - item.breakdown.normalizedScore).toFixed(2));
      const isSurf = item.hardFilter.status !== HardFilterStatus.FAIL && (index === 0 || delta <= 10 || (item.breakdown.normalizedScore >= 65 && item.breakdown.confidence >= 0.62));
      return {
        intent: item.intent, weightedScore: item.breakdown.normalizedScore, confidence: item.breakdown.confidence,
        hardFilterStatus: item.hardFilter.status, hardFilterReason: item.hardFilter.reason, details: item.hardFilter.details,
        rank: index + 1,
        selectionReason: item.intent === selectedIntent
          ? `Selected: ${item.intent} (${item.breakdown.normalizedScore}/100, ${Math.round(item.breakdown.confidence * 100)}% conf).`
          : item.hardFilter.status === HardFilterStatus.FAIL
            ? `${item.intent} rejected by hard filter.`
            : `${item.intent} trailed by ${delta} points.`,
        scoreDeltaFromWinner: delta,
        surfaceAsAlternative: isSurf,
        surfaceLabel: index === 0 ? `Primary: ${item.intent}` : delta <= 5 ? `Also strong: ${item.intent}` : delta <= 10 ? `Secondary: ${item.intent}` : undefined,
      };
    });
  }

  private selectSurfacedIntents(evals: PerIntentEvaluation[]): PerIntentEvaluation[] {
    const s = evals.filter(i => i.surfaceAsAlternative && i.hardFilterStatus !== HardFilterStatus.FAIL).slice(0, 3);
    return s.length ? s : evals.slice(0, 1);
  }

  private buildIntentSelectionSummary(evals: PerIntentEvaluation[]): string {
    if (!evals.length) return 'No intent evaluations.';
    const w = evals[0]; const r = evals[1];
    if (!r) return `${w.intent} selected as only viable intent.`;
    if (r.hardFilterStatus === HardFilterStatus.FAIL) return `${w.intent} won; ${r.intent} failed hard filter.`;
    return `${w.intent} won over ${r.intent} by ${Math.abs(r.scoreDeltaFromWinner ?? 0).toFixed(1)} points.`;
  }

  // ==========================================================================
  // AI VALIDATION — v8: preserves reasoning, safe fallback
  // ==========================================================================

  private async applyAI(pitch: PitchProfile, candidates: ScoredContact[]): Promise<ScoredContact[]> {
    try {
      const aiResults = await this.llm.validateMatches({
        pitch, contacts: candidates.map(c => c.contact),
        deterministicScores: candidates.map(c => c.deterministicScore),
      });
      const aiMap = new Map(aiResults.map(i => [i.contactId, i]));

      return candidates.map(candidate => {
        const ai = aiMap.get(candidate.contact.id);
        if (!ai) return candidate;

        const adjusted = applyBoundedAIAdjustment(candidate.deterministicScore, ai.adjustedScore);
        const finalScore = clampScore(adjusted.adjustedScore);
        const finalConfidence = this.combineConfidence(candidate.deterministicConfidence, ai.confidence, candidate.deterministicScore, finalScore);
        const gating = applyGating(finalScore, finalConfidence, candidate.hardFilter.status, candidate.isSparse, this.config.confidenceGates);

        return {
          ...candidate,
          breakdown: {
            ...candidate.breakdown,
            penalties: [
              ...candidate.breakdown.penalties,
              ...(adjusted.bounded ? ['AI adjustment bounded.'] : []),
              ...(ai.redFlags || []).slice(0, 3).map(f => `AI red flag: ${f}`),
            ],
          },
          aiScore: ai.adjustedScore,
          aiConfidence: ai.confidence,
          aiReasoning: (ai.reasoning || '').slice(0, 500),
          aiGreenFlags: (ai.greenFlags || []).slice(0, 5),
          aiRedFlags: (ai.redFlags || []).slice(0, 5),
          finalScore, finalConfidence,
          effectiveRankScore: clampScore(finalScore * gating.rankPenaltyFactor),
          matchLevel: gating.level, cappedReason: gating.reason,
          rankPenaltyFactor: gating.rankPenaltyFactor,
        };
      });
    } catch (error) {
      console.error('[PitchMatching] AI validation failed', error);
      return candidates.map(c => ({ ...c, aiScore: null, aiConfidence: null }));
    }
  }

  private combineConfidence(detConf: number, aiConf: number, detScore: number, finalScore: number): number {
    const delta = Math.abs(finalScore - detScore);
    const pen = delta >= 15 ? 0.14 : delta >= 10 ? 0.1 : delta >= 6 ? 0.06 : delta >= 3 ? 0.03 : 0;
    return Math.max(0, Math.min(1, Number((detConf * 0.72 + aiConf * 0.28 - pen).toFixed(4))));
  }

  // ==========================================================================
  // BUILD RESULT — v8: effectiveRankScore, AI reasoning
  // ==========================================================================

  private buildResult(pitch: PitchProfile, scored: ScoredContact, rank: number, includeExplanation: boolean): PitchMatchResult {
    const contact = scored.contact;
    const matchedSectors = pitch.industrySectors.filter(s => contact.sectors.some(c => normalizeTag(c) === normalizeTag(s)));
    const matchedModels = pitch.businessModel.filter(m => contact.businessModels.includes(m)).map(String);
    const matchedIntent = scored.surfacedIntents.map(i => i.intent);

    const explanation: MatchExplanation = includeExplanation
      ? buildExplanation(
          scored.finalScore, scored.matchLevel, scored.breakdown.components,
          scored.hardFilter.status === HardFilterStatus.FAIL ? [scored.hardFilter.details] : scored.breakdown.penalties,
          scored.cappedReason, scored.finalConfidence,
          scored.intentSelectionSummary, scored.alternativeIntentSummaries,
          scored.aiReasoning || undefined, scored.aiGreenFlags, scored.aiRedFlags,
          scored.deterministicScore, scored.aiScore,
        )
      : null as any;

    return {
      matchId: `pm_${pitch.id}_${contact.id}_${Date.now()}_${rank}`,
      pitchId: pitch.id, contactId: contact.id,
      contactName: contact.fullName, contactTitle: contact.title, contactCompany: contact.company,
      contactTypes: contact.contactTypes,
      deterministicScore: round2(scored.deterministicScore),
      aiScore: scored.aiScore != null ? round2(scored.aiScore) : null,
      finalScore: round2(scored.finalScore),
      effectiveRankScore: round2(scored.effectiveRankScore),
      confidence: Number(scored.finalConfidence.toFixed(4)),
      aiConfidence: scored.aiConfidence != null ? Number(scored.aiConfidence.toFixed(4)) : null,
      deterministicConfidence: Number(scored.deterministicConfidence.toFixed(4)),
      selectedIntent: scored.selectedIntent,
      topIntentEvaluations: scored.topIntentEvaluations,
      surfacedIntents: scored.surfacedIntents,
      matchLevel: scored.matchLevel, levelCappedReason: scored.cappedReason,
      hardFilterStatus: scored.hardFilter.status, hardFilterReason: scored.hardFilter.reason,
      scoreBreakdown: scored.breakdown, explanation,
      keyReasons: extractKeyReasons(scored.breakdown.components),
      matchedSectors, matchedBusinessModels: matchedModels, matchedIntent,
      aiReasoning: scored.aiReasoning || undefined,
      aiGreenFlags: scored.aiGreenFlags.length ? scored.aiGreenFlags : undefined,
      aiRedFlags: scored.aiRedFlags.length ? scored.aiRedFlags : undefined,
      rank, createdAt: new Date(), expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    };
  }

  // ==========================================================================
  // LOAD PITCH — v8: auth-scoped
  // ==========================================================================

  private async loadPitch(pitchId: string, auth: AuthContext): Promise<PitchProfile | null> {
    const where: any = { id: pitchId };
    if (auth.organizationId) where.organizationId = auth.organizationId;
    else where.userId = auth.userId;

    const raw = await this.prisma.pitchProfile.findFirst({ where });
    if (!raw) return null;

    return {
      id: raw.id, userId: raw.userId, organizationId: raw.organizationId,
      pitchDeckFileUrl: raw.pitchDeckFileUrl || raw.pitchDeckFile,
      pitchTitle: raw.pitchTitle || '', companyName: raw.companyName,
      elevatorPitch: raw.elevatorPitch || '', problemStatement: raw.problemStatement || '',
      solutionSummary: raw.solutionSummary || '', whatYouNeed: raw.whatYouNeed || '',
      matchIntent: normalizeIntentList(raw.matchIntent),
      pitchStage: raw.pitchStage || PitchStage.JUST_AN_IDEA,
      primaryCategory: raw.primaryCategory || '',
      industrySectors: ensureStringArray(raw.industrySectors),
      businessModel: ensureEnumArray<BusinessModel>(raw.businessModel, BusinessModel),
      targetCustomerType: ensureStringArray(raw.targetCustomerType),
      operatingMarkets: ensureStringArray(raw.operatingMarkets),
      tractionSummary: raw.tractionSummary || undefined,
      founderBackgroundSummary: raw.founderBackgroundSummary || undefined,
      tags: Array.isArray(raw.tags) ? raw.tags : [],
      embedding: ensureNumberArray(raw.embedding),
      needEmbedding: ensureNumberArray(raw.needEmbedding),
      dataQualityScore: typeof raw.dataQualityScore === 'number' ? raw.dataQualityScore : 50,
      excludedEntities: ensureStringArray(raw.excludedEntities),
      requiredGeographies: ensureStringArray(raw.requiredGeographies),
      strictCategoryMatch: Boolean(raw.strictCategoryMatch),
      requireCustomerTypeFit: Boolean(raw.requireCustomerTypeFit),
      requireOfferCapabilityFit: Boolean(raw.requireOfferCapabilityFit),
      fundingAmountRequested: typeof raw.fundingAmountRequested === 'number' ? raw.fundingAmountRequested : undefined,
      fundingCurrency: typeof raw.fundingCurrency === 'string' ? raw.fundingCurrency.trim().toUpperCase() : undefined,
      supportNeededTags: Array.isArray(raw.supportNeededTags) ? raw.supportNeededTags : undefined,
      createdAt: raw.createdAt, updatedAt: raw.updatedAt,
    };
  }

  // ==========================================================================
  // DISCOVER CONTACTS — v8: multi-phase hybrid retrieval
  // ==========================================================================

  private async discoverContacts(pitch: PitchProfile, filters?: PitchMatchFilters): Promise<PitchContact[]> {
    const where: any = { optedOut: false, blocked: false };

    // Phase 1: Broad intent-based eligibility
    const intents = new Set<MatchIntent>();
    if (filters?.intents?.length) for (const i of filters.intents) intents.add(i);
    else if (pitch.matchIntent?.length) for (const i of pitch.matchIntent) intents.add(i);
    const inferred = inferIntentsFromNeedText(pitch.whatYouNeed, [pitch.elevatorPitch, pitch.problemStatement, pitch.solutionSummary, pitch.tractionSummary || '', pitch.founderBackgroundSummary || '']);
    for (const i of inferred) intents.add(i);

    // v8: Don't restrict contactTypes in the DB query — we use soft intent filtering now
    // Instead, use OR conditions across multiple axes for broader retrieval
    const orConditions: any[] = [];
    if (intents.size > 0) orConditions.push({ contactTypes: { hasSome: Array.from(intents) } });
    if (pitch.industrySectors.length) orConditions.push({ sectors: { hasSome: pitch.industrySectors.slice(0, 5) } });
    if (pitch.primaryCategory) orConditions.push({ categories: { has: pitch.primaryCategory } });
    if (pitch.operatingMarkets.length) orConditions.push({ geographies: { hasSome: pitch.operatingMarkets.slice(0, 5) } });
    if (pitch.businessModel.length) orConditions.push({ businessModels: { hasSome: pitch.businessModel.slice(0, 3) } });

    if (orConditions.length > 0) where.OR = orConditions;

    // Apply explicit filters
    if (filters?.sectors?.length) where.sectors = { hasSome: filters.sectors };
    if (filters?.stages?.length) where.preferredStages = { hasSome: filters.stages };
    if (filters?.businessModels?.length) where.businessModels = { hasSome: filters.businessModels };
    if (filters?.geographies?.length) where.geographies = { hasSome: filters.geographies };
    if (filters?.categories?.length) where.categories = { hasSome: filters.categories };
    if (filters?.excludeContactIds?.length) where.id = { notIn: filters.excludeContactIds };
    if (pitch.excludedEntities?.length) {
      where.id = { ...(where.id || {}), notIn: [...(where.id?.notIn || []), ...pitch.excludedEntities] };
    }

    const records = await this.prisma.pitchContact.findMany({
      where, take: 500,
      orderBy: [{ dataQualityScore: 'desc' }, { updatedAt: 'desc' }],
    });

    return records.map((r: any) => ({
      id: r.id, userId: r.userId,
      fullName: r.fullName || `${r.firstName || ''} ${r.lastName || ''}`.trim(),
      title: r.title || '', company: r.company || '',
      contactTypes: normalizeIntentList(r.contactTypes || r.contactType),
      sectors: ensureStringArray(r.sectors),
      businessModels: ensureEnumArray<BusinessModel>(r.businessModels, BusinessModel),
      customerTypes: ensureStringArray(r.customerTypes),
      geographies: ensureStringArray(r.geographies),
      preferredStages: ensureEnumArray<PitchStage>(r.preferredStages, PitchStage),
      categories: ensureStringArray(r.categories),
      canOffer: ensureStringArray(r.canOffer),
      keywords: ensureStringArray(r.keywords),
      expertise: ensureStringArray(r.expertise),
      embedding: ensureNumberArray(r.embedding),
      needOfferEmbedding: ensureNumberArray(r.needOfferEmbedding),
      dataQualityScore: typeof r.dataQualityScore === 'number' ? r.dataQualityScore : 50,
      investmentProfile: normalizeSubProfile(r.investmentProfile || r.investorProfile, ['investorTypes', 'portfolioFocus', 'deploymentGeographies'], ['ticketMinUsd', 'ticketMaxUsd'], ['checkSizeNotes'], ['leadPreference']),
      advisorProfile: r.advisorProfile && typeof r.advisorProfile === 'object' ? { advisorRoles: ensureStringArray(r.advisorProfile.advisorRoles), functionalExpertise: ensureStringArray(r.advisorProfile.functionalExpertise), operatorBackground: ensureStringArray(r.advisorProfile.operatorBackground), boardExperience: Boolean(r.advisorProfile.boardExperience) } : undefined,
      partnerProfile: r.partnerProfile && typeof r.partnerProfile === 'object' ? { partnerCapabilities: ensureStringArray(r.partnerProfile.partnerCapabilities), partnershipTypes: ensureStringArray(r.partnerProfile.partnershipTypes), distributionMarkets: ensureStringArray(r.partnerProfile.distributionMarkets), integrationCapabilities: ensureStringArray(r.partnerProfile.integrationCapabilities) } : undefined,
      buyerProfile: r.buyerProfile && typeof r.buyerProfile === 'object' ? { buyerSeniority: ensureStringArray(r.buyerProfile.buyerSeniority), buyerIndustries: ensureStringArray(r.buyerProfile.buyerIndustries), buyingRoles: ensureStringArray(r.buyerProfile.buyingRoles), procurementAuthority: Boolean(r.buyerProfile.procurementAuthority) } : undefined,
      founderProfile: r.founderProfile && typeof r.founderProfile === 'object' ? { founderRoles: ensureStringArray(r.founderProfile.founderRoles), builderFunctions: ensureStringArray(r.founderProfile.builderFunctions), startupExperience: ensureStringArray(r.founderProfile.startupExperience), cofounderStyle: ensureStringArray(r.founderProfile.cofounderStyle) } : undefined,
      optedOut: Boolean(r.optedOut), blocked: Boolean(r.blocked),
      createdAt: r.createdAt, updatedAt: r.updatedAt,
    }));
  }

  // ==========================================================================
  // PERSISTENCE — v8: includes effectiveRankScore, AI reasoning, version 80
  // ==========================================================================

  private async saveMatches(pitchId: string, matches: PitchMatchResult[]): Promise<void> {
    if (!matches.length) return;
    try {
      await this.prisma.$transaction(async (tx: any) => {
        await tx.pitchMatch.updateMany({ where: { pitchId, archived: false }, data: { archived: true, archivedAt: new Date() } });
        await tx.pitchMatch.createMany({
          data: matches.map(m => ({
            id: m.matchId, pitchId: m.pitchId, contactId: m.contactId,
            deterministicScore: m.deterministicScore, aiScore: m.aiScore,
            finalScore: m.finalScore, effectiveRankScore: m.effectiveRankScore,
            confidence: m.confidence, matchLevel: m.matchLevel,
            hardFilterStatus: m.hardFilterStatus, hardFilterReason: m.hardFilterReason,
            selectedIntent: m.selectedIntent ?? null,
            scoreBreakdown: JSON.stringify(m.scoreBreakdown),
            explanation: JSON.stringify(m.explanation),
            keyReasons: m.keyReasons,
            matchedSectors: m.matchedSectors, matchedBusinessModels: m.matchedBusinessModels,
            matchedIntent: m.matchedIntent,
            aiReasoning: m.aiReasoning || null,
            aiGreenFlags: m.aiGreenFlags || [], aiRedFlags: m.aiRedFlags || [],
            rank: m.rank, version: 80, archived: false,
            createdAt: m.createdAt, expiresAt: m.expiresAt,
          })),
          skipDuplicates: true,
        });
      });
    } catch (error) { console.error('[PitchMatching] Save failed', error); }
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function round2(v: number): number { return Number(v.toFixed(2)); }
function ensureStringArray(v: unknown): string[] { if (Array.isArray(v)) return v.filter((i): i is string => typeof i === 'string' && i.trim().length > 0); if (typeof v === 'string' && v.trim()) { try { return ensureStringArray(JSON.parse(v)); } catch { return v.split(',').map(i => i.trim()).filter(Boolean); } } return []; }
function ensureNumberArray(v: unknown): number[] | undefined { if (Array.isArray(v)) return v.filter((i): i is number => typeof i === 'number'); return undefined; }
function ensureEnumArray<T extends string>(v: unknown, enumObj: Record<string, T>): T[] { const a = new Set(Object.values(enumObj)); return ensureStringArray(v).filter((i): i is T => a.has(i as T)); }
function normalizeIntentList(v: unknown): MatchIntent[] { return ensureEnumArray<MatchIntent>(v, MatchIntent); }
function normalizeSubProfile(v: any, arrFields: string[], numFields: string[], strFields: string[], enumFields: string[]): any {
  if (!v || typeof v !== 'object') return undefined;
  const out: any = {};
  for (const f of arrFields) out[f] = ensureStringArray(v[f]);
  for (const f of numFields) out[f] = typeof v[f] === 'number' ? v[f] : undefined;
  for (const f of strFields) out[f] = typeof v[f] === 'string' ? v[f] : undefined;
  for (const f of enumFields) out[f] = typeof v[f] === 'string' ? v[f] : undefined;
  return out;
}

export function createPitchMatchingService(prisma: any, config?: PitchMatchingConfig, llm?: PitchLLMService): PitchMatchingService {
  return new PitchMatchingService(prisma, config, llm);
}
