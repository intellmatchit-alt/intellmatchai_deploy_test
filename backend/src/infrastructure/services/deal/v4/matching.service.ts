/**
 * Deal Matching Service — v4.1
 *
 * Pipeline (per IntellMatch spec):
 *   1. applyPrefilters (structured)
 *   2. for each candidate:
 *      a. calculateRetrievalScore (hybrid: structured + lexical + semantic + network)
 *      b. runDealHardFilters (PASS / REVIEW / FAIL — FAIL excluded)
 *      c. calculateDealMatchScore (deterministic, 12 components incl. network)
 *      d. confidence gate
 *      e. applyBandGating (matchLevel)
 *      f. (optional) AI validation — bounded ±10, never overrides FAIL
 *      g. finalScore = aiScore ?? deterministicScore
 *      h. calculateEffectiveRankScore + rankingFactors
 *   3. dedupe (id / userId / orgId)
 *   4. sort by effectiveRankScore (with deterministic tie-breakers)
 *   5. paginate
 *
 * The displayed score everywhere is `finalScore`. `effectiveRankScore` is
 * for ordering only and never goes on a score badge.
 */

import {
  BuyRequest, SellOffering, DealMatchResult, DealMatchResponse, FindDealMatchesRequest,
  DealMatchFilters, DealScoringWeights, DEFAULT_DEAL_WEIGHTS, DEFAULT_DEAL_THRESHOLDS,
  DealThresholdConfig, areBudgetsCompatible, BuyerType, DeliveryMode,
} from './types';
import {
  ScoreBand, getScoreBand, HardFilterStatus, MatchExplanation, MatchingStats, SurfacedStatus,
  generateMatchExplanation, generateMatchId, getExpiryDate, mergeTags, calculateTagOverlap,
  applyBandGating, ScoreBreakdown, RetrievalBreakdown, RankingFactors, NetworkRelationship,
  HardFilterResult,
} from './common';
import {
  runDealHardFilters, calculateDealMatchScore, inferBuyerPersona,
} from './scoring.utils';
import { NetworkContext } from './network.utils';
import { calculateRetrievalScore } from './retrieval.utils';
import { calculateEffectiveRankScore, sortByEffectiveRank, dedupeByKeys, normalizeFallbackKey } from './ranking.utils';
import { DealAIValidator, AIValidationResult } from './ai-validator.service';

export interface DealMatchInputs {
  /** retrieval-time network context per offering id (optional) */
  networkByTargetId?: Map<string, NetworkContext>;
  /** owner-level metadata for dedupe by userId/orgId */
  targetOwnerByTargetId?: Map<string, { userId?: string; organizationId?: string; fullName?: string; company?: string }>;
  /** override AI validation toggle for this run; falls back to env */
  enableAIValidation?: boolean;
  /** maximum AI score adjustment (±). Defaults to 10. */
  maxAIAdjustment?: number;
  /** retrieval score floor — candidates below are skipped (default 25) */
  retrievalMinScore?: number;
}

const DEFAULT_AI_MAX_ADJUSTMENT = Number(process.env.DEAL_AI_MAX_SCORE_ADJUSTMENT) || 10;
const DEFAULT_RETRIEVAL_MIN = Number(process.env.DEAL_RETRIEVAL_MIN_SCORE) || 25;

export class DealMatchingService {
  private weights: DealScoringWeights;
  private thresholds: DealThresholdConfig;
  private aiValidator: DealAIValidator;

  constructor(
    weights: Partial<DealScoringWeights> = {},
    thresholds: Partial<DealThresholdConfig> = {},
    aiValidator?: DealAIValidator,
  ) {
    this.weights = { ...DEFAULT_DEAL_WEIGHTS, ...weights };
    this.thresholds = { ...DEFAULT_DEAL_THRESHOLDS, ...thresholds };
    this.aiValidator = aiValidator ?? new DealAIValidator();
  }

  // ==========================================================================
  // BUY_TO_NETWORK_SELLERS
  // ==========================================================================

  async findMatches(
    buyRequest: BuyRequest,
    sellOfferings: SellOffering[],
    request: FindDealMatchesRequest,
    inputs: DealMatchInputs = {},
  ): Promise<DealMatchResponse> {
    const startTime = Date.now();
    const limit = request.limit || this.thresholds.maxResults;
    const offset = request.offset || 0;
    const filters = request.filters || {};
    const retrievalMin = inputs.retrievalMinScore ?? DEFAULT_RETRIEVAL_MIN;

    const stats: MatchingStats = {
      totalCandidates: sellOfferings.length, passedHardFilters: 0, failedHardFilters: 0,
      reviewCandidates: 0, scoredCandidates: 0,
      suppressedByConfidence: 0, suppressedByScore: 0,
      finalMatches: 0, avgScore: 0, avgConfidence: 0, processingTimeMs: 0,
    };

    const filteredOfferings = this.applyPrefilters(sellOfferings, filters);
    const matchResults: DealMatchResult[] = [];

    for (const offering of filteredOfferings) {
      const network = inputs.networkByTargetId?.get(offering.id) ?? null;

      // 2a. Hybrid retrieval score
      const retrieval = calculateRetrievalScore(buyRequest, offering, network);
      if (retrieval.totalScore < retrievalMin) {
        stats.suppressedByScore++;
        continue;
      }

      // 2b. Hard filters
      const hf = runDealHardFilters(buyRequest, offering);
      if (hf.status === HardFilterStatus.FAIL) { stats.failedHardFilters++; continue; }
      if (hf.status === HardFilterStatus.REVIEW) stats.reviewCandidates++;
      stats.passedHardFilters++;

      // 2c. Deterministic score (with network component)
      const { finalScore: deterministicScore, breakdown, fieldMatches, semanticSubScores } =
        calculateDealMatchScore(buyRequest, offering, this.weights, network);

      if (deterministicScore < this.thresholds.minScore) { stats.suppressedByScore++; continue; }
      if (breakdown.confidence < this.thresholds.minConfidence) { stats.suppressedByConfidence++; continue; }

      stats.scoredCandidates++;

      // 2d. Sparse data + band gating
      const isSparse = Math.min(buyRequest.dataQualityScore || 0, offering.dataQualityScore || 0) < this.thresholds.sparseDataThreshold;

      // 2e. AI validation (bounded ±maxAIAdjustment, never overrides FAIL)
      let aiResult: AIValidationResult | null = null;
      const aiEnabled = inputs.enableAIValidation ?? this.aiValidator.isEnabled();
      if (aiEnabled) {
        // hf.status cannot be FAIL here (filtered above) — AI never overrides FAIL.
        aiResult = await this.aiValidator.validateDirectMatch({
          matchMode: 'BUY_TO_NETWORK_SELLERS',
          buyRequest, sellOffering: offering,
          deterministicScore, scoreBreakdown: breakdown, hardFilter: hf,
          networkContext: network,
          maxAdjustment: inputs.maxAIAdjustment ?? DEFAULT_AI_MAX_ADJUSTMENT,
        });
      }

      const aiScore = aiResult?.adjustedScore ?? null;
      const finalScore = aiScore !== null ? aiScore : deterministicScore;

      const { effectiveBand, downgradeReason } = applyBandGating(
        getScoreBand(finalScore), breakdown.confidence, isSparse,
        { excellentMinConfidence: this.thresholds.excellentMinConfidence, sparseMaxBand: this.thresholds.sparseMaxBand },
      );

      const surfacedStatus = hf.status === HardFilterStatus.REVIEW ? SurfacedStatus.REVIEW : SurfacedStatus.PASS;
      const missingFields = this.getMissingFields(buyRequest, offering);

      const explanation = generateMatchExplanation(
        finalScore, effectiveBand, surfacedStatus,
        breakdown.components, hf, fieldMatches, missingFields,
        downgradeReason, semanticSubScores,
      );

      // 2f. effectiveRankScore + rankingFactors
      const { effectiveRankScore, rankingFactors } = calculateEffectiveRankScore({
        finalScore, confidence: breakdown.confidence, hardFilterStatus: hf.status,
        isSparse, retrievalScore: retrieval.totalScore, network,
        buy: buyRequest, sell: offering,
      });

      const result = this.buildMatchResult({
        buyRequest, offering, finalScore, deterministicScore, aiScore,
        effectiveRankScore, retrievalBreakdown: retrieval, rankingFactors,
        effectiveBand, surfacedStatus, breakdown, hf, explanation,
        aiResult, network,
        includeExplanation: request.includeExplanations !== false,
      });
      matchResults.push(result);
    }

    // 3. Dedupe
    const deduped = dedupeByKeys(matchResults, m => {
      const owner = inputs.targetOwnerByTargetId?.get(m.sellOfferingId);
      return {
        primary: m.sellOfferingId,
        userId: owner?.userId,
        organizationId: owner?.organizationId,
        fallback: normalizeFallbackKey(m.sellerName, owner?.company),
      };
    });

    // 4. Rerank — effectiveRankScore primary, with deterministic tiebreakers
    const sorted = sortByEffectiveRank(deduped);

    // 5. Assign rank, then paginate (rerank-then-paginate, NEVER paginate then rerank)
    const ranked = sorted.map((m, i) => ({ ...m, rank: i + 1 }));
    const page = ranked.slice(offset, offset + limit);

    stats.finalMatches = page.length;
    stats.avgScore = page.length > 0 ? page.reduce((s, m) => s + m.finalScore, 0) / page.length : 0;
    stats.avgConfidence = page.length > 0 ? page.reduce((s, m) => s + m.confidence, 0) / page.length : 0;
    stats.processingTimeMs = Date.now() - startTime;

    return {
      success: true, matches: page, buyRequestId: buyRequest.id,
      buyRequestName: buyRequest.requestName || buyRequest.whatYouNeed.substring(0, 50),
      totalCandidates: sellOfferings.length, filteredCount: ranked.length,
      processingTimeMs: stats.processingTimeMs, stats,
    };
  }

  // ==========================================================================
  // SELL_TO_NETWORK_BUYERS
  // ==========================================================================

  async findBuyersForSeller(
    sell: SellOffering,
    buyRequests: BuyRequest[],
    limit = 50,
    inputs: DealMatchInputs = {},
  ): Promise<DealMatchResponse> {
    const startTime = Date.now();
    const retrievalMin = inputs.retrievalMinScore ?? DEFAULT_RETRIEVAL_MIN;
    const stats: MatchingStats = {
      totalCandidates: buyRequests.length, passedHardFilters: 0, failedHardFilters: 0,
      reviewCandidates: 0, scoredCandidates: 0,
      suppressedByConfidence: 0, suppressedByScore: 0,
      finalMatches: 0, avgScore: 0, avgConfidence: 0, processingTimeMs: 0,
    };
    const results: DealMatchResult[] = [];

    for (const buy of buyRequests) {
      if (!buy.isActive || buy.isDeleted) { stats.failedHardFilters++; continue; }
      const network = inputs.networkByTargetId?.get(buy.id) ?? null;

      const retrieval = calculateRetrievalScore(buy, sell, network);
      if (retrieval.totalScore < retrievalMin) { stats.suppressedByScore++; continue; }

      const hf = runDealHardFilters(buy, sell);
      if (hf.status === HardFilterStatus.FAIL) { stats.failedHardFilters++; continue; }
      if (hf.status === HardFilterStatus.REVIEW) stats.reviewCandidates++;
      stats.passedHardFilters++;

      const { finalScore: deterministicScore, breakdown, fieldMatches, semanticSubScores } =
        calculateDealMatchScore(buy, sell, this.weights, network);
      if (deterministicScore < this.thresholds.minScore) { stats.suppressedByScore++; continue; }
      if (breakdown.confidence < this.thresholds.minConfidence) { stats.suppressedByConfidence++; continue; }
      stats.scoredCandidates++;

      const isSparse = Math.min(buy.dataQualityScore || 0, sell.dataQualityScore || 0) < this.thresholds.sparseDataThreshold;

      let aiResult: AIValidationResult | null = null;
      const aiEnabled = inputs.enableAIValidation ?? this.aiValidator.isEnabled();
      if (aiEnabled) {
        // hf.status cannot be FAIL here (filtered above) — AI never overrides FAIL.
        aiResult = await this.aiValidator.validateDirectMatch({
          matchMode: 'SELL_TO_NETWORK_BUYERS',
          buyRequest: buy, sellOffering: sell,
          deterministicScore, scoreBreakdown: breakdown, hardFilter: hf,
          networkContext: network,
          maxAdjustment: inputs.maxAIAdjustment ?? DEFAULT_AI_MAX_ADJUSTMENT,
        });
      }
      const aiScore = aiResult?.adjustedScore ?? null;
      const finalScore = aiScore !== null ? aiScore : deterministicScore;

      const { effectiveBand, downgradeReason } = applyBandGating(
        getScoreBand(finalScore), breakdown.confidence, isSparse,
        { excellentMinConfidence: this.thresholds.excellentMinConfidence, sparseMaxBand: this.thresholds.sparseMaxBand },
      );

      const surfacedStatus = hf.status === HardFilterStatus.REVIEW ? SurfacedStatus.REVIEW : SurfacedStatus.PASS;
      const missing = this.getMissingFields(buy, sell);
      const explanation = generateMatchExplanation(
        finalScore, effectiveBand, surfacedStatus,
        breakdown.components, hf, fieldMatches, missing,
        downgradeReason, semanticSubScores,
      );
      const { effectiveRankScore, rankingFactors } = calculateEffectiveRankScore({
        finalScore, confidence: breakdown.confidence, hardFilterStatus: hf.status,
        isSparse, retrievalScore: retrieval.totalScore, network,
        buy, sell,
      });

      results.push(this.buildMatchResult({
        buyRequest: buy, offering: sell, finalScore, deterministicScore, aiScore,
        effectiveRankScore, retrievalBreakdown: retrieval, rankingFactors,
        effectiveBand, surfacedStatus, breakdown, hf, explanation, aiResult, network,
        includeExplanation: true,
      }));
    }

    const deduped = dedupeByKeys(results, m => {
      const owner = inputs.targetOwnerByTargetId?.get(m.buyRequestId);
      return {
        primary: m.buyRequestId,
        userId: owner?.userId,
        organizationId: owner?.organizationId,
        fallback: normalizeFallbackKey(m.buyerNeed, owner?.company),
      };
    });
    const sorted = sortByEffectiveRank(deduped);
    const ranked = sorted.slice(0, limit).map((m, i) => ({ ...m, rank: i + 1 }));
    stats.finalMatches = ranked.length;
    stats.avgScore = ranked.length > 0 ? ranked.reduce((s, m) => s + m.finalScore, 0) / ranked.length : 0;
    stats.avgConfidence = ranked.length > 0 ? ranked.reduce((s, m) => s + m.confidence, 0) / ranked.length : 0;
    stats.processingTimeMs = Date.now() - startTime;

    return {
      success: true, matches: ranked, buyRequestId: 'N/A',
      buyRequestName: `Buyers for ${sell.productServiceName}`,
      totalCandidates: buyRequests.length, filteredCount: ranked.length,
      processingTimeMs: stats.processingTimeMs, stats,
    };
  }

  // ==========================================================================
  // PREFILTERING
  // ==========================================================================

  private applyPrefilters(offerings: SellOffering[], filters: DealMatchFilters): SellOffering[] {
    return offerings.filter(o => {
      if (!o.isActive || o.isDeleted) return false;
      if (filters.categories?.length && !filters.categories.includes(o.solutionCategory)) return false;
      if (filters.industries?.length) {
        if (!filters.industries.some(ind => o.industryFocus.some(f => f.toLowerCase().includes(ind.toLowerCase())))) return false;
      }
      if (filters.budgetRanges?.length && !filters.budgetRanges.includes(o.priceRange)) return false;
      if (filters.locations?.length && o.targetMarketLocation) {
        if (!filters.locations.some(l => o.targetMarketLocation!.toLowerCase().includes(l.toLowerCase()))) return false;
      }
      if (filters.providerSizes?.length && o.companySize) {
        if (!filters.providerSizes.includes(o.companySize)) return false;
      }
      if (filters.deliveryModes?.length && o.deliveryModeCapability?.length) {
        if (!filters.deliveryModes.some(m => o.deliveryModeCapability!.includes(m))) return false;
      }
      return true;
    });
  }

  // ==========================================================================
  // BUILD MATCH RESULT — populates v4.1 BaseMatchResult fields
  // ==========================================================================

  private buildMatchResult(args: {
    buyRequest: BuyRequest; offering: SellOffering;
    finalScore: number; deterministicScore: number; aiScore: number | null;
    effectiveRankScore: number;
    retrievalBreakdown: RetrievalBreakdown;
    rankingFactors: RankingFactors;
    effectiveBand: ScoreBand; surfacedStatus: SurfacedStatus;
    breakdown: ScoreBreakdown; hf: HardFilterResult;
    explanation: MatchExplanation;
    aiResult: AIValidationResult | null;
    network: NetworkContext | null;
    includeExplanation: boolean;
  }): DealMatchResult {
    const {
      buyRequest: buy, offering: sell, finalScore, deterministicScore, aiScore,
      effectiveRankScore, retrievalBreakdown, rankingFactors,
      effectiveBand, surfacedStatus, breakdown, hf, explanation, aiResult, network, includeExplanation,
    } = args;

    const industryFit = this.calculateIndustryFit(buy, sell);
    const requirementsFit = this.calculateRequirementsFit(buy, sell);
    const budgetFit = this.calculateBudgetFit(buy, sell);
    const personaFit = this.calculateBuyerPersonaFit(buy, sell);

    const networkRelationship: NetworkRelationship | null = network ? {
      degree: network.isFirstDegree ? 1 : network.isSecondDegree ? 2 : null,
      isFirstDegree: network.isFirstDegree,
      isSecondDegree: network.isSecondDegree,
      sameOrganization: network.sameOrganization,
      mutualConnections: network.mutualConnections,
      relationshipStrength: network.relationshipStrength,
      notes: network.notes ?? [],
    } : null;

    return {
      id: generateMatchId('deal', buy.id, sell.id),
      sourceId: buy.id, targetId: sell.id,
      finalScore, deterministicScore, aiScore,
      effectiveRankScore,
      scoreBand: effectiveBand,
      matchLevel: effectiveBand,
      surfacedStatus,
      confidence: breakdown.confidence,
      hardFilterStatus: hf.status,
      hardFilterReason: hf.reason !== 'NONE' ? hf.reason : null,
      retrievalScore: retrievalBreakdown.totalScore,
      retrievalBreakdown,
      rankingFactors,
      scoreBreakdown: breakdown,
      explanation: includeExplanation ? explanation : {} as MatchExplanation,
      aiReasoning: aiResult?.reasoning ?? null,
      aiGreenFlags: aiResult?.greenFlags ?? [],
      aiRedFlags: aiResult?.redFlags ?? [],
      networkRelationship,
      rank: 0, createdAt: new Date(), expiresAt: getExpiryDate(7),
      buyRequestId: buy.id, sellOfferingId: sell.id,
      sellerName: sell.productServiceName,
      buyerNeed: buy.whatYouNeed.substring(0, 100),
      categoryFit: { buyerCategory: buy.solutionCategory, sellerCategory: sell.solutionCategory, match: buy.solutionCategory === sell.solutionCategory },
      industryFit, budgetFit, requirementsFit,
      sizeFit: { preferredSize: buy.preferredProviderSize, providerSize: sell.companySize, sellerTargetSize: sell.targetCompanySize, compatible: this.isSizeCompatible(buy.preferredProviderSize, sell.companySize) },
      locationFit: { buyerLocation: buy.targetMarketLocation, sellerLocation: sell.targetMarketLocation, compatible: this.isLocationCompatible(buy.targetMarketLocation, sell.targetMarketLocation) },
      deliveryFit: { buyerMode: buy.deliveryMode, sellerCapability: sell.deliveryModeCapability || [], compatible: this.isDeliveryCompatible(buy.deliveryMode, sell.deliveryModeCapability) },
      timelineFit: { buyerTimeline: buy.neededTimeline, buyerStage: buy.buyingStage, sellerTimeline: sell.salesTimeline, aligned: this.isTimelineAligned(buy, sell) },
      providerTypeFit: { buyerProviderType: buy.providerType, sellerProviderType: sell.providerType, match: buy.providerType === sell.providerType },
      buyerPersonaFit: personaFit,
    };
  }

  // ==========================================================================
  // FIT HELPERS (preserved from v4.0)
  // ==========================================================================

  private calculateIndustryFit(buy: BuyRequest, sell: SellOffering) {
    const { score, matched } = calculateTagOverlap(buy.relevantIndustry, sell.industryFocus);
    return { buyerIndustries: buy.relevantIndustry, sellerIndustries: sell.industryFocus, matched, overlapScore: score };
  }

  private calculateRequirementsFit(buy: BuyRequest, sell: SellOffering) {
    const reqs = buy.mustHaveRequirements || [];
    const caps = sell.capabilities || [];
    const capSet = new Set(caps.map(c => c.toLowerCase()));
    const corpus = [sell.offeringSummary || '', sell.idealCustomerProfile || '', sell.productServiceName || '', ...(sell.tags?.merged || [])].join(' ').toLowerCase();
    const matched: string[] = []; const missing: string[] = [];
    for (const req of reqs) { if (capSet.has(req.toLowerCase()) || corpus.includes(req.toLowerCase())) matched.push(req); else missing.push(req); }
    return { buyerRequirements: reqs, sellerCapabilities: caps, matched, missing, satisfactionScore: reqs.length > 0 ? Math.round((matched.length / reqs.length) * 100) : 100 };
  }

  private calculateBudgetFit(buy: BuyRequest, sell: SellOffering) {
    const { compatible, gap, direction } = areBudgetsCompatible(buy.budgetRange, sell.priceRange);
    return { buyerBudget: buy.budgetRange, sellerPrice: sell.priceRange, compatible, budgetGap: gap, direction };
  }

  private calculateBuyerPersonaFit(buy: BuyRequest, sell: SellOffering) {
    const inferred = inferBuyerPersona(buy);
    const targets = sell.idealBuyerType || [];
    const matched = inferred.filter(p => targets.includes(p));
    return {
      inferredPersona: inferred, sellerIdealBuyerType: targets, matched,
      coverageScore: inferred.length > 0 ? Math.round((matched.length / inferred.length) * 100) : 100,
      buyerRole: buy.buyerRole,
    };
  }

  private isSizeCompatible(pref: any, prov: any): boolean {
    if (!pref || pref === 'NO_PREFERENCE' || !prov || prov === 'NO_PREFERENCE') return true;
    const order: Record<string, number> = { INDIVIDUAL_SOLO: 1, SMALL: 2, MEDIUM: 3, ENTERPRISE: 4 };
    return Math.abs((order[pref] || 0) - (order[prov] || 0)) <= 1;
  }

  private isLocationCompatible(bL?: string, sL?: string): boolean {
    if (!bL || !sL) return true;
    return bL.toLowerCase().includes(sL.toLowerCase()) || sL.toLowerCase().includes(bL.toLowerCase());
  }

  private isDeliveryCompatible(mode?: DeliveryMode, caps?: DeliveryMode[]): boolean {
    if (!mode || mode === DeliveryMode.NO_PREFERENCE || !caps?.length) return true;
    return caps.includes(mode) || caps.includes(DeliveryMode.HYBRID) || caps.includes(DeliveryMode.NO_PREFERENCE);
  }

  private isTimelineAligned(buy: BuyRequest, sell: SellOffering): boolean {
    const urgent = buy.neededTimeline === 'IMMEDIATELY' || buy.buyingStage === 'URGENT_NEED';
    return !(urgent && sell.salesTimeline !== 'ACTIVELY_SELLING');
  }

  private getMissingFields(buy: BuyRequest, sell: SellOffering): string[] {
    const m: string[] = [];
    if (!buy.preferredProviderSize) m.push('buyRequest.preferredProviderSize');
    if (!buy.deliveryMode) m.push('buyRequest.deliveryMode');
    if (!buy.targetMarketLocation) m.push('buyRequest.targetMarketLocation');
    if (!buy.idealProviderProfile) m.push('buyRequest.idealProviderProfile');
    if (!sell.offeringSummary) m.push('sellOffering.offeringSummary');
    if (!sell.deliveryModel) m.push('sellOffering.deliveryModel');
    if (!sell.targetMarketLocation) m.push('sellOffering.targetMarketLocation');
    if (!sell.capabilities?.length) m.push('sellOffering.capabilities');
    if (!sell.companySize) m.push('sellOffering.companySize');
    if (!sell.deliveryModeCapability?.length) m.push('sellOffering.deliveryModeCapability');
    return m;
  }

  // ==========================================================================
  // SINGLE MATCH (preserved API)
  // ==========================================================================

  async calculateSingleMatch(
    buy: BuyRequest, sell: SellOffering, includeExplanation = true,
    inputs: DealMatchInputs = {},
  ): Promise<DealMatchResult | null> {
    const network = inputs.networkByTargetId?.get(sell.id) ?? null;

    const retrieval = calculateRetrievalScore(buy, sell, network);
    const hf = runDealHardFilters(buy, sell);
    if (hf.status === HardFilterStatus.FAIL) return null;

    const { finalScore: deterministicScore, breakdown, fieldMatches, semanticSubScores } =
      calculateDealMatchScore(buy, sell, this.weights, network);
    if (deterministicScore < this.thresholds.minScore) return null;
    if (breakdown.confidence < this.thresholds.minConfidence) return null;

    const isSparse = Math.min(buy.dataQualityScore || 0, sell.dataQualityScore || 0) < this.thresholds.sparseDataThreshold;

    let aiResult: AIValidationResult | null = null;
    const aiEnabled = inputs.enableAIValidation ?? this.aiValidator.isEnabled();
    if (aiEnabled) {
      // hf.status cannot be FAIL here (filtered above) — AI never overrides FAIL.
      aiResult = await this.aiValidator.validateDirectMatch({
        matchMode: 'BUY_TO_NETWORK_SELLERS',
        buyRequest: buy, sellOffering: sell,
        deterministicScore, scoreBreakdown: breakdown, hardFilter: hf,
        networkContext: network,
        maxAdjustment: inputs.maxAIAdjustment ?? DEFAULT_AI_MAX_ADJUSTMENT,
      });
    }
    const aiScore = aiResult?.adjustedScore ?? null;
    const finalScore = aiScore !== null ? aiScore : deterministicScore;

    const { effectiveBand, downgradeReason } = applyBandGating(
      getScoreBand(finalScore), breakdown.confidence, isSparse,
      { excellentMinConfidence: this.thresholds.excellentMinConfidence, sparseMaxBand: this.thresholds.sparseMaxBand },
    );

    const surfacedStatus = hf.status === HardFilterStatus.REVIEW ? SurfacedStatus.REVIEW : SurfacedStatus.PASS;
    const missing = this.getMissingFields(buy, sell);
    const explanation = generateMatchExplanation(
      finalScore, effectiveBand, surfacedStatus,
      breakdown.components, hf, fieldMatches, missing,
      downgradeReason, semanticSubScores,
    );

    const { effectiveRankScore, rankingFactors } = calculateEffectiveRankScore({
      finalScore, confidence: breakdown.confidence, hardFilterStatus: hf.status,
      isSparse, retrievalScore: retrieval.totalScore, network,
      buy, sell,
    });

    return this.buildMatchResult({
      buyRequest: buy, offering: sell, finalScore, deterministicScore, aiScore,
      effectiveRankScore, retrievalBreakdown: retrieval, rankingFactors,
      effectiveBand, surfacedStatus, breakdown, hf, explanation,
      aiResult, network, includeExplanation,
    });
  }

  // ==========================================================================
  // TAG MANAGEMENT
  // ==========================================================================

  mergeBuyRequestTags(buy: BuyRequest, userTags: string[]): BuyRequest {
    return { ...buy, userTags, tags: mergeTags(buy.aiGeneratedTags || [], userTags, buy.tags?.merged || []) };
  }

  mergeSellOfferingTags(sell: SellOffering, userTags: string[]): SellOffering {
    return { ...sell, userTags, tags: mergeTags(sell.aiGeneratedTags || [], userTags, sell.tags?.merged || []) };
  }
}

export const dealMatchingService = new DealMatchingService();
