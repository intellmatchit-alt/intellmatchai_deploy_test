/**
 * Helper Matching Service — v4.1
 *
 * Pipeline for BUY_TO_SELLER_HELPERS / SELL_TO_BUYER_HELPERS:
 *   1. helperHardFilterStatus       → drop candidates with no network path
 *   2. calculateHelperScore         → 6-component deterministic score
 *   3. confidence gate              → drop low-confidence weak signals
 *   4. applyBandGating              → matchLevel from finalScore
 *   5. AI validation (optional)     → bounded ±maxAIAdjustment, never overrides FAIL
 *   6. effectiveRankScore           → ranking only
 *   7. dedupe by helper userId / id / name+org
 *   8. sortByEffectiveRank, paginate
 *
 * Helper explanations describe "why this person can help make the deal happen"
 * — never as if they were a buyer or seller themselves.
 */

import { BuyRequest, SellOffering, DEFAULT_DEAL_THRESHOLDS } from './types';
import {
  HardFilterResult, HardFilterStatus, HardFilterReason, SurfacedStatus,
  ScoreBand, getScoreBand, applyBandGating, generateMatchExplanation,
  generateMatchId, getExpiryDate, NetworkRelationship,
} from './common';
import {
  HelperCandidate, HelperMatchResult, HelperMatchMode, HelperType,
  helperTypeLabel, likelyHelpType,
} from './helper-types';
import {
  calculateHelperScore, classifyHelperType, helperHardFilterStatus,
} from './helper-scoring.utils';
import {
  calculateEffectiveRankScore, sortByEffectiveRank, dedupeByKeys, normalizeFallbackKey,
} from './ranking.utils';
import { DealAIValidator, AIValidationResult } from './ai-validator.service';
import { logger } from '../../../../shared/logger';

const DEFAULT_AI_MAX_ADJUSTMENT = Number(process.env.DEAL_AI_MAX_SCORE_ADJUSTMENT) || 10;

export interface HelperMatchInputs {
  /** override AI for this run; falls back to env */
  enableAIValidation?: boolean;
  maxAIAdjustment?: number;
  limit?: number;
  offset?: number;
}

export interface HelperMatchResponse {
  success: boolean;
  matches: HelperMatchResult[];
  matchMode: HelperMatchMode;
  totalCandidates: number;
  filteredCount: number;
  processingTimeMs: number;
}

export class HelperMatchingService {
  private aiValidator: DealAIValidator;
  constructor(aiValidator?: DealAIValidator) {
    this.aiValidator = aiValidator ?? new DealAIValidator();
  }

  async findHelpersForBuy(
    buy: BuyRequest, candidates: HelperCandidate[], inputs: HelperMatchInputs = {},
  ): Promise<HelperMatchResponse> {
    return this.run(buy.id, candidates, 'BUY_TO_SELLER_HELPERS',
      { industries: buy.relevantIndustry || [], subject: buy.whatYouNeed }, inputs);
  }

  async findHelpersForSell(
    sell: SellOffering, candidates: HelperCandidate[], inputs: HelperMatchInputs = {},
  ): Promise<HelperMatchResponse> {
    return this.run(sell.id, candidates, 'SELL_TO_BUYER_HELPERS',
      { industries: sell.industryFocus || [], subject: sell.offeringSummary || sell.productServiceName }, inputs);
  }

  private async run(
    sourceEntityId: string,
    candidates: HelperCandidate[],
    mode: HelperMatchMode,
    deal: { industries: string[]; subject: string },
    inputs: HelperMatchInputs,
  ): Promise<HelperMatchResponse> {
    const start = Date.now();
    const limit = inputs.limit ?? 50;
    const offset = inputs.offset ?? 0;
    const aiEnabled = inputs.enableAIValidation ?? this.aiValidator.isEnabled();
    const maxAdjustment = inputs.maxAIAdjustment ?? DEFAULT_AI_MAX_ADJUSTMENT;

    const built: HelperMatchResult[] = [];

    for (const c of candidates) {
      // 1. Hard filter
      const hf = helperHardFilterStatus(c);
      const hardFilterStatus = hf.ok ? HardFilterStatus.PASS : HardFilterStatus.FAIL;
      if (!hf.ok) continue;
      const hardFilterResult: HardFilterResult = {
        status: hardFilterStatus,
        reason: HardFilterReason.NONE,
        details: '',
        evidence: [],
      };

      // 2. Deterministic score
      const { deterministicScore, breakdown, fieldMatches } =
        calculateHelperScore(c, mode, deal);

      // 3. Confidence gate (mirrors direct engine)
      if (breakdown.confidence < DEFAULT_DEAL_THRESHOLDS.minConfidence) continue;
      if (deterministicScore < DEFAULT_DEAL_THRESHOLDS.minScore) continue;

      // 4. AI validation (optional)
      let aiResult: AIValidationResult | null = null;
      if (aiEnabled) {
        try {
          // Helper validation reuses the same prompt scaffolding for now;
          // the validator currently exposes only validateDirectMatch — we
          // pass a synthetic context tailored to the helper question.
          aiResult = await this.aiValidator.validateDirectMatch({
            matchMode: mode,
            // synthesized stand-ins so the prompt has structure;
            // the validator's bounds + JSON parsing apply unchanged.
            buyRequest: synthBuyForHelperPrompt(deal, mode),
            sellOffering: synthSellForHelperPrompt(c, deal),
            deterministicScore,
            scoreBreakdown: breakdown,
            hardFilter: hardFilterResult,
            networkContext: {
              isFirstDegree: c.isFirstDegree, isSecondDegree: c.isSecondDegree,
              sameOrganization: c.sameOrganization, mutualConnections: c.mutualConnections,
              relationshipStrength: c.relationshipStrength, interactionCount: c.interactionCount,
              lastInteractionDays: c.lastInteractionDays,
            },
            maxAdjustment,
          });
        } catch (err) {
          logger.warn('Helper AI validation failed', { error: (err as Error).message });
        }
      }
      const aiScore = aiResult?.adjustedScore ?? null;
      const finalScore = aiScore !== null ? aiScore : deterministicScore;

      const isSparse = (c.bio || '').length === 0 && !c.jobTitle;
      const { effectiveBand, downgradeReason } = applyBandGating(
        getScoreBand(finalScore), breakdown.confidence, isSparse,
        { excellentMinConfidence: DEFAULT_DEAL_THRESHOLDS.excellentMinConfidence, sparseMaxBand: DEFAULT_DEAL_THRESHOLDS.sparseMaxBand },
      );

      const surfacedStatus = SurfacedStatus.PASS;
      const explanation = generateMatchExplanation(
        finalScore, effectiveBand, surfacedStatus,
        breakdown.components, hardFilterResult, fieldMatches,
        getMissingHelperFields(c), downgradeReason, [],
      );

      const helperType = classifyHelperType(c, mode);
      const helperExplanation = buildHelperExplanation(c, helperType, mode, breakdown, finalScore, effectiveBand);

      // Retrieval+ranking adapted for helpers — retrieval reuses network
      // strength as proxy. effectiveRankScore uses helper-specific multipliers
      // by passing PASS / no buy+sell context.
      const retrievalProxy = approxRetrievalForHelper(c, deal);

      const { effectiveRankScore, rankingFactors } = calculateEffectiveRankScore({
        finalScore,
        confidence: breakdown.confidence,
        hardFilterStatus,
        isSparse,
        retrievalScore: retrievalProxy,
        network: {
          isFirstDegree: c.isFirstDegree, isSecondDegree: c.isSecondDegree,
          sameOrganization: c.sameOrganization, mutualConnections: c.mutualConnections,
          relationshipStrength: c.relationshipStrength, interactionCount: c.interactionCount,
          lastInteractionDays: c.lastInteractionDays,
        },
        // helper has no buy+sell readiness signal; readinessBoost defaults to 1
      });

      const networkRelationship: NetworkRelationship = {
        degree: c.isFirstDegree ? 1 : c.isSecondDegree ? 2 : null,
        isFirstDegree: c.isFirstDegree,
        isSecondDegree: c.isSecondDegree,
        sameOrganization: c.sameOrganization,
        mutualConnections: c.mutualConnections,
        relationshipStrength: c.relationshipStrength,
        notes: c.signals ?? [],
      };

      const strengths = breakdown.components.filter(c2 => c2.score >= 70).map(c2 => c2.explanation).slice(0, 4);
      const gaps = breakdown.components.filter(c2 => c2.score < 45).map(c2 => c2.explanation).slice(0, 3);
      const matchedSignals = breakdown.components.flatMap(c2 => c2.matchedItems).slice(0, 8);
      const missingOrUncertain = [...getMissingHelperFields(c), ...breakdown.components.flatMap(c2 => c2.missingItems)].slice(0, 6);

      built.push({
        id: generateMatchId('helper', sourceEntityId, c.id),
        matchMode: mode,
        sourceEntityId, targetEntityId: c.id,
        helperUserId: c.userId ?? null,
        helperName: c.fullName,
        helperTitle: c.jobTitle ?? null,
        helperRoleArea: (c.jobTitleAreas && c.jobTitleAreas[0]) ?? null,
        helperOrganization: c.company ?? null,
        helperType,
        helperTypeLabel: helperTypeLabel(helperType),
        likelyHelpType: likelyHelpType(helperType, mode),
        finalScore,
        deterministicScore,
        aiScore,
        effectiveRankScore,
        scoreBand: effectiveBand,
        matchLevel: effectiveBand,
        surfacedStatus,
        confidence: breakdown.confidence,
        hardFilterStatus,
        hardFilterReason: null,
        retrievalScore: retrievalProxy,
        retrievalBreakdown: {
          structuredScore: 0, lexicalScore: 0, semanticScore: 0, networkScore: retrievalProxy,
          totalScore: retrievalProxy, evidence: ['Helper retrieval = network strength proxy'],
        },
        rankingFactors,
        scoreBreakdown: breakdown,
        explanation,
        helperExplanation,
        strengths,
        gaps,
        matchedSignals,
        missingOrUncertainFields: missingOrUncertain,
        networkRelationship,
        aiReasoning: aiResult?.reasoning ?? null,
        aiGreenFlags: aiResult?.greenFlags ?? [],
        aiRedFlags: aiResult?.redFlags ?? [],
        rank: 0,
        createdAt: new Date(),
        expiresAt: getExpiryDate(7),
      });
    }

    // Dedupe by helper userId, then id, then name+org
    const deduped = dedupeByKeys(built, m => ({
      primary: m.targetEntityId,
      userId: m.helperUserId ?? undefined,
      fallback: normalizeFallbackKey(m.helperName, m.helperOrganization),
    }));

    const sorted = sortByEffectiveRank(deduped);
    const ranked = sorted.map((m, i) => ({ ...m, rank: i + 1 }));
    const page = ranked.slice(offset, offset + limit);

    return {
      success: true,
      matches: page,
      matchMode: mode,
      totalCandidates: candidates.length,
      filteredCount: ranked.length,
      processingTimeMs: Date.now() - start,
    };
  }
}

// ---------------------------------------------------------------------------
// Helper explanation builder
// ---------------------------------------------------------------------------

function buildHelperExplanation(
  c: HelperCandidate, t: HelperType, mode: HelperMatchMode,
  breakdown: { components: { name: string; score: number; explanation: string }[] },
  finalScore: number, band: ScoreBand,
): string {
  const counterparty = mode === 'BUY_TO_SELLER_HELPERS' ? 'seller/provider' : 'buyer';
  const top = [...breakdown.components].sort((a, b) => b.score - a.score).slice(0, 2)
    .map(c2 => c2.explanation)
    .join(' ');
  const verb = c.worksAtTargetOrg ? 'directly introduce' : c.isFirstDegree ? 'introduce or recommend' : 'route to';
  const pathQual = c.relationshipStrength >= 0.7 ? 'a strong, trusted relationship' : c.isFirstDegree ? 'a direct connection' : `${c.mutualConnections} mutual connection${c.mutualConnections === 1 ? '' : 's'}`;

  return [
    `Score ${finalScore}/100 (${band.replace('_', ' ').toLowerCase()}).`,
    `This person may help the deal happen because they can ${verb} a relevant ${counterparty} via ${pathQual}.`,
    top,
    c.worksAtTargetOrg ? '' : 'Note: helper is not inside the target organization, so the path runs through their network.',
  ].filter(Boolean).join(' ');
}

function getMissingHelperFields(c: HelperCandidate): string[] {
  const m: string[] = [];
  if (!c.jobTitle) m.push('helper.jobTitle');
  if (!c.company) m.push('helper.company');
  if (!c.industries?.length) m.push('helper.industries');
  if (!c.bio) m.push('helper.bio');
  return m;
}

function approxRetrievalForHelper(c: HelperCandidate, deal: { industries: string[]; subject: string }): number {
  let s = 0;
  if (c.isFirstDegree) s += 50;
  else if (c.isSecondDegree) s += 30;
  if (c.worksAtTargetOrg) s += 20;
  s += Math.round(c.relationshipStrength * 15);
  if (c.industries?.some(i => deal.industries.includes(i))) s += 10;
  return Math.max(0, Math.min(100, s));
}

// ---------------------------------------------------------------------------
// Synthesized prompt stand-ins (helper AI validation re-uses direct prompt)
// ---------------------------------------------------------------------------

import { SolutionCategory, ProviderType, BudgetRange, NeededTimeline, BuyingStage, BuyerType, TargetCompanySize, SalesTimeline } from './types';

function synthBuyForHelperPrompt(deal: { industries: string[]; subject: string }, _mode: HelperMatchMode): BuyRequest {
  return {
    id: 'helper-context',
    ownerId: 'helper',
    whatYouNeed: deal.subject || 'Helper-introduction request',
    solutionCategory: SolutionCategory.OTHER,
    relevantIndustry: deal.industries,
    providerType: ProviderType.COMPANY,
    mustHaveRequirements: [],
    budgetRange: BudgetRange.CUSTOM,
    neededTimeline: NeededTimeline.EXPLORING,
    buyingStage: BuyingStage.EXPLORING,
    dataQualityScore: 50,
    isActive: true,
    isDeleted: false,
    createdAt: new Date(), updatedAt: new Date(),
    source: 'API',
  };
}

function synthSellForHelperPrompt(c: HelperCandidate, deal: { industries: string[]; subject: string }): SellOffering {
  return {
    id: c.id,
    ownerId: c.userId ?? c.id,
    productServiceName: c.fullName,
    offeringSummary: [c.jobTitle, c.company, c.bio].filter(Boolean).join(' — '),
    solutionCategory: SolutionCategory.OTHER,
    providerType: ProviderType.INDIVIDUAL,
    industryFocus: c.industries || deal.industries,
    targetCompanySize: TargetCompanySize.NO_PREFERENCE,
    idealBuyerType: [BuyerType.DEPARTMENT_HEAD],
    idealCustomerProfile: c.bio || '',
    priceRange: BudgetRange.CUSTOM,
    salesTimeline: SalesTimeline.EXPLORING_MARKET,
    capabilities: c.jobTitleAreas || [],
    dataQualityScore: 50,
    isActive: true, isDeleted: false,
    createdAt: new Date(), updatedAt: new Date(),
    source: 'API',
  };
}

export const helperMatchingService = new HelperMatchingService();
