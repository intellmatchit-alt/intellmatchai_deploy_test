/**
 * Deal Matching Service
 * v4.0.0 — strict final production
 *
 * v4 changes from v3:
 * - SurfacedStatus (PASS/REVIEW/SUPPRESSED) computed and passed to explanation
 * - semanticSubScores from scoring passed through to explanation
 * - suppressedByScore tracked in stats
 * - buyerRole passed to buyerPersonaFit
 * - generateMatchExplanation v4 signature (surfacedStatus, semanticSubScores)
 */

import {
  BuyRequest, SellOffering, DealMatchResult, DealMatchResponse, FindDealMatchesRequest,
  DealMatchFilters, DealScoringWeights, DEFAULT_DEAL_WEIGHTS, DEFAULT_DEAL_THRESHOLDS,
  DealThresholdConfig, areBudgetsCompatible, BuyerType, DeliveryMode,
} from './types';
import {
  ScoreBand, getScoreBand, HardFilterStatus, MatchExplanation, MatchingStats, SurfacedStatus,
  generateMatchExplanation, generateMatchId, getExpiryDate, mergeTags, calculateTagOverlap,
  applyBandGating,
} from './common';
import {
  runDealHardFilters, calculateDealMatchScore, sortDealMatches, assignDealRanks,
  inferBuyerPersona,
} from './scoring.utils';

export class DealMatchingService {
  private weights: DealScoringWeights;
  private thresholds: DealThresholdConfig;

  constructor(weights: Partial<DealScoringWeights> = {}, thresholds: Partial<DealThresholdConfig> = {}) {
    this.weights = { ...DEFAULT_DEAL_WEIGHTS, ...weights };
    this.thresholds = { ...DEFAULT_DEAL_THRESHOLDS, ...thresholds };
  }

  // ==========================================================================
  // MAIN MATCHING
  // ==========================================================================

  async findMatches(
    buyRequest: BuyRequest, sellOfferings: SellOffering[], request: FindDealMatchesRequest,
  ): Promise<DealMatchResponse> {
    const startTime = Date.now();
    const limit = request.limit || this.thresholds.maxResults;
    const offset = request.offset || 0;
    const filters = request.filters || {};

    const stats: MatchingStats = {
      totalCandidates: sellOfferings.length, passedHardFilters: 0, failedHardFilters: 0,
      reviewCandidates: 0, scoredCandidates: 0,
      suppressedByConfidence: 0, suppressedByScore: 0,
      finalMatches: 0, avgScore: 0, avgConfidence: 0, processingTimeMs: 0,
    };

    const filteredOfferings = this.applyPrefilters(sellOfferings, filters);
    const matchResults: DealMatchResult[] = [];

    for (const offering of filteredOfferings) {
      const hf = runDealHardFilters(buyRequest, offering);
      if (hf.status === HardFilterStatus.FAIL) { stats.failedHardFilters++; continue; }
      if (hf.status === HardFilterStatus.REVIEW) stats.reviewCandidates++;
      stats.passedHardFilters++;

      const { finalScore, breakdown, fieldMatches, semanticSubScores } = calculateDealMatchScore(buyRequest, offering, this.weights);

      if (finalScore < this.thresholds.minScore) { stats.suppressedByScore++; continue; }
      if (breakdown.confidence < this.thresholds.minConfidence) { stats.suppressedByConfidence++; continue; }

      stats.scoredCandidates++;

      const isSparse = Math.min(buyRequest.dataQualityScore || 0, offering.dataQualityScore || 0) < this.thresholds.sparseDataThreshold;
      const { effectiveBand, downgradeReason } = applyBandGating(
        getScoreBand(finalScore), breakdown.confidence, isSparse,
        { strongMinConfidence: this.thresholds.strongMinConfidence, sparseMaxBand: this.thresholds.sparseMaxBand },
      );

      const surfacedStatus = hf.status === HardFilterStatus.REVIEW ? SurfacedStatus.REVIEW : SurfacedStatus.PASS;
      const missingFields = this.getMissingFields(buyRequest, offering);

      const explanation = generateMatchExplanation(
        finalScore, effectiveBand, surfacedStatus,
        breakdown.components, hf, fieldMatches, missingFields,
        downgradeReason, semanticSubScores,
      );

      const result = this.buildMatchResult(
        buyRequest, offering, finalScore, effectiveBand, surfacedStatus,
        breakdown, hf, explanation, request.includeExplanations !== false,
      );
      matchResults.push(result);
    }

    const sorted = sortDealMatches(matchResults);
    const ranked = assignDealRanks(sorted);
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
  // BUILD MATCH RESULT — v4: surfacedStatus, buyerRole
  // ==========================================================================

  private buildMatchResult(
    buy: BuyRequest, sell: SellOffering, finalScore: number,
    effectiveBand: ScoreBand, surfacedStatus: SurfacedStatus,
    breakdown: any, hf: any, explanation: MatchExplanation,
    includeExplanation: boolean,
  ): DealMatchResult {
    const industryFit = this.calculateIndustryFit(buy, sell);
    const requirementsFit = this.calculateRequirementsFit(buy, sell);
    const budgetFit = this.calculateBudgetFit(buy, sell);
    const personaFit = this.calculateBuyerPersonaFit(buy, sell);

    return {
      id: generateMatchId('deal', buy.id, sell.id),
      sourceId: buy.id, targetId: sell.id,
      finalScore, scoreBand: effectiveBand, surfacedStatus,
      confidence: breakdown.confidence,
      hardFilterStatus: hf.status,
      hardFilterReason: hf.reason !== 'NONE' ? hf.reason : null,
      scoreBreakdown: breakdown,
      explanation: includeExplanation ? explanation : {} as MatchExplanation,
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
  // FIT HELPERS
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
  // SINGLE MATCH
  // ==========================================================================

  async calculateSingleMatch(buy: BuyRequest, sell: SellOffering, includeExplanation = true): Promise<DealMatchResult | null> {
    const hf = runDealHardFilters(buy, sell);
    if (hf.status === HardFilterStatus.FAIL) return null;

    const { finalScore, breakdown, fieldMatches, semanticSubScores } = calculateDealMatchScore(buy, sell, this.weights);
    if (finalScore < this.thresholds.minScore) return null;
    if (breakdown.confidence < this.thresholds.minConfidence) return null;

    const isSparse = Math.min(buy.dataQualityScore || 0, sell.dataQualityScore || 0) < this.thresholds.sparseDataThreshold;
    const { effectiveBand, downgradeReason } = applyBandGating(
      getScoreBand(finalScore), breakdown.confidence, isSparse,
      { strongMinConfidence: this.thresholds.strongMinConfidence, sparseMaxBand: this.thresholds.sparseMaxBand },
    );

    const surfacedStatus = hf.status === HardFilterStatus.REVIEW ? SurfacedStatus.REVIEW : SurfacedStatus.PASS;
    const missing = this.getMissingFields(buy, sell);
    const explanation = generateMatchExplanation(
      finalScore, effectiveBand, surfacedStatus,
      breakdown.components, hf, fieldMatches, missing,
      downgradeReason, semanticSubScores,
    );

    return this.buildMatchResult(buy, sell, finalScore, effectiveBand, surfacedStatus, breakdown, hf, explanation, includeExplanation);
  }

  // ==========================================================================
  // REVERSE MATCHING
  // ==========================================================================

  async findBuyersForSeller(sell: SellOffering, buyRequests: BuyRequest[], limit = 50): Promise<DealMatchResponse> {
    const startTime = Date.now();
    const stats: MatchingStats = {
      totalCandidates: buyRequests.length, passedHardFilters: 0, failedHardFilters: 0,
      reviewCandidates: 0, scoredCandidates: 0,
      suppressedByConfidence: 0, suppressedByScore: 0,
      finalMatches: 0, avgScore: 0, avgConfidence: 0, processingTimeMs: 0,
    };
    const results: DealMatchResult[] = [];

    for (const buy of buyRequests) {
      if (!buy.isActive || buy.isDeleted) { stats.failedHardFilters++; continue; }
      const hf = runDealHardFilters(buy, sell);
      if (hf.status === HardFilterStatus.FAIL) { stats.failedHardFilters++; continue; }
      if (hf.status === HardFilterStatus.REVIEW) stats.reviewCandidates++;
      stats.passedHardFilters++;

      const { finalScore, breakdown, fieldMatches, semanticSubScores } = calculateDealMatchScore(buy, sell, this.weights);
      if (finalScore < this.thresholds.minScore) { stats.suppressedByScore++; continue; }
      if (breakdown.confidence < this.thresholds.minConfidence) { stats.suppressedByConfidence++; continue; }
      stats.scoredCandidates++;

      const isSparse = Math.min(buy.dataQualityScore || 0, sell.dataQualityScore || 0) < this.thresholds.sparseDataThreshold;
      const { effectiveBand, downgradeReason } = applyBandGating(
        getScoreBand(finalScore), breakdown.confidence, isSparse,
        { strongMinConfidence: this.thresholds.strongMinConfidence, sparseMaxBand: this.thresholds.sparseMaxBand },
      );

      const surfacedStatus = hf.status === HardFilterStatus.REVIEW ? SurfacedStatus.REVIEW : SurfacedStatus.PASS;
      const missing = this.getMissingFields(buy, sell);
      const explanation = generateMatchExplanation(
        finalScore, effectiveBand, surfacedStatus,
        breakdown.components, hf, fieldMatches, missing,
        downgradeReason, semanticSubScores,
      );
      results.push(this.buildMatchResult(buy, sell, finalScore, effectiveBand, surfacedStatus, breakdown, hf, explanation, true));
    }

    const sorted = sortDealMatches(results);
    const ranked = assignDealRanks(sorted.slice(0, limit));
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
