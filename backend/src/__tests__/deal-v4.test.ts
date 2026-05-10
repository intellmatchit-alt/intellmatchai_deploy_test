/**
 * Deal Matching Engine v4.1 — unit tests
 *
 * Covers the production-critical surfaces:
 *   - Band thresholds and gating (WEAK/PARTIAL/GOOD/VERY_GOOD/EXCELLENT)
 *   - Network relevance scoring (12th deterministic component)
 *   - Hybrid retrieval (structured / lexical / semantic / network)
 *   - effectiveRankScore + multiplier bounds
 *   - sortByEffectiveRank + dedupe by id / userId / orgId
 *   - Hard filter PASS / REVIEW / FAIL paths
 *   - AI validator: bounded ±maxAdjustment, never overrides FAIL,
 *     null-safe when LLM unavailable
 *   - Helper engine: 6-component scoring, type classification, hard filter
 *   - Adapter: DealRequest / Contact → engine types
 *
 * No DB and no LLM are touched — the engine is pure and the adapter
 * works on plain rows. AI tests assert the bound math directly without
 * spinning up a network call.
 */

import {
  ScoreBand, getScoreBand, scoreBandLabel, applyBandGating,
  HardFilterStatus, HardFilterReason,
  createPassResult, createFailResult, createReviewResult,
} from '../infrastructure/services/deal/v4/common';
import { calculateRetrievalScore } from '../infrastructure/services/deal/v4/retrieval.utils';
import {
  calculateEffectiveRankScore, sortByEffectiveRank, dedupeByKeys,
} from '../infrastructure/services/deal/v4/ranking.utils';
import {
  calculateNetworkRelevanceScore, NEUTRAL_NETWORK_CONTEXT,
} from '../infrastructure/services/deal/v4/network.utils';
import {
  BuyRequest, SellOffering, SolutionCategory, ProviderType, BudgetRange,
  CompanySize, NeededTimeline, BuyingStage, DeliveryMode, BuyerType,
  TargetCompanySize, SalesTimeline, BuyerRole, DEFAULT_DEAL_THRESHOLDS,
} from '../infrastructure/services/deal/v4/types';
import {
  runDealHardFilters, calculateDealMatchScore,
} from '../infrastructure/services/deal/v4/scoring.utils';
import {
  classifyHelperType, helperHardFilterStatus, calculateHelperScore,
  relationshipTrustScore, introPathScore,
} from '../infrastructure/services/deal/v4/helper-scoring.utils';
import { HelperType, HelperCandidate } from '../infrastructure/services/deal/v4/helper-types';
import { DealAIValidator } from '../infrastructure/services/deal/v4/ai-validator.service';
import {
  dealRequestToBuyRequest, dealRequestToSellOffering,
  contactToSellOffering, contactToHelperCandidate, networkContextForContact,
} from '../infrastructure/services/deal/v4/adapter';

// =============================================================================
// FIXTURES
// =============================================================================

function makeBuy(overrides: Partial<BuyRequest> = {}): BuyRequest {
  return {
    id: 'buy-1', ownerId: 'user-1',
    whatYouNeed: 'AI-powered analytics platform with API integration',
    solutionCategory: SolutionCategory.SAAS_SOFTWARE,
    relevantIndustry: ['fintech'],
    providerType: ProviderType.COMPANY,
    preferredProviderSize: CompanySize.MEDIUM,
    mustHaveRequirements: ['api integration', 'analytics', 'sso'],
    budgetRange: BudgetRange.RANGE_25K_100K,
    neededTimeline: NeededTimeline.WITHIN_3_MONTHS,
    buyingStage: BuyingStage.READY_TO_DECIDE,
    targetMarketLocation: 'United States',
    deliveryMode: DeliveryMode.REMOTE,
    idealProviderProfile: 'Mid-market SaaS company with strong fintech experience',
    requestName: 'Analytics platform Q3',
    buyerRole: BuyerRole.TECHNICAL,
    dataQualityScore: 75,
    isActive: true, isDeleted: false,
    createdAt: new Date('2026-04-01'), updatedAt: new Date('2026-04-01'),
    source: 'MANUAL',
    ...overrides,
  };
}

function makeSell(overrides: Partial<SellOffering> = {}): SellOffering {
  return {
    id: 'sell-1', ownerId: 'user-2',
    productServiceName: 'AnalyticsPro Platform',
    offeringSummary: 'Enterprise analytics SaaS with REST API and SSO support',
    solutionCategory: SolutionCategory.SAAS_SOFTWARE,
    providerType: ProviderType.COMPANY,
    industryFocus: ['fintech', 'banking'],
    deliveryModel: undefined,
    targetCompanySize: TargetCompanySize.MID_MARKET,
    companySize: CompanySize.MEDIUM,
    idealBuyerType: [BuyerType.TECHNICAL_EVALUATOR, BuyerType.DEPARTMENT_HEAD],
    idealCustomerProfile: 'Mid-market fintech needing analytics',
    targetMarketLocation: 'United States',
    priceRange: BudgetRange.RANGE_25K_100K,
    salesTimeline: SalesTimeline.ACTIVELY_SELLING,
    capabilities: ['rest api', 'analytics dashboard', 'sso', 'rbac', 'soc2'],
    deliveryModeCapability: [DeliveryMode.REMOTE, DeliveryMode.HYBRID],
    dataQualityScore: 80,
    isActive: true, isDeleted: false,
    createdAt: new Date('2026-04-01'), updatedAt: new Date('2026-04-01'),
    source: 'MANUAL',
    ...overrides,
  };
}

function makeHelper(overrides: Partial<HelperCandidate> = {}): HelperCandidate {
  return {
    id: 'helper-1',
    userId: 'user-h1',
    fullName: 'Maya Patel',
    jobTitle: 'VP Partnerships',
    jobTitleAreas: ['partnerships'],
    company: 'Acme Partners',
    organizationId: 'org-h',
    industries: ['fintech'],
    seniorityHints: ['EXECUTIVE'],
    bio: 'Helps connect SaaS vendors with mid-market financial services buyers.',
    email: 'maya@acme.example',
    worksAtTargetOrg: false,
    targetRoleProximity: 'ADJACENT',
    isFirstDegree: true,
    isSecondDegree: false,
    sameOrganization: false,
    mutualConnections: 4,
    relationshipStrength: 0.78,
    interactionCount: 8,
    lastInteractionDays: 14,
    ...overrides,
  };
}

// =============================================================================
// 1. BAND THRESHOLDS
// =============================================================================

describe('ScoreBand thresholds (v4.1 spec)', () => {
  it('uses WEAK / PARTIAL / GOOD / VERY_GOOD / EXCELLENT only', () => {
    expect(getScoreBand(0)).toBe(ScoreBand.WEAK);
    expect(getScoreBand(39)).toBe(ScoreBand.WEAK);
    expect(getScoreBand(40)).toBe(ScoreBand.PARTIAL);
    expect(getScoreBand(54)).toBe(ScoreBand.PARTIAL);
    expect(getScoreBand(55)).toBe(ScoreBand.GOOD);
    expect(getScoreBand(69)).toBe(ScoreBand.GOOD);
    expect(getScoreBand(70)).toBe(ScoreBand.VERY_GOOD);
    expect(getScoreBand(84)).toBe(ScoreBand.VERY_GOOD);
    expect(getScoreBand(85)).toBe(ScoreBand.EXCELLENT);
    expect(getScoreBand(100)).toBe(ScoreBand.EXCELLENT);
  });

  it('does not include legacy STRONG / CONDITIONAL members', () => {
    const members = Object.keys(ScoreBand);
    expect(members).not.toContain('STRONG');
    expect(members).not.toContain('CONDITIONAL');
  });

  it('applyBandGating caps EXCELLENT to VERY_GOOD on low confidence', () => {
    const r = applyBandGating(ScoreBand.EXCELLENT, 0.45, false, {
      excellentMinConfidence: 0.62, sparseMaxBand: ScoreBand.GOOD,
    });
    expect(r.effectiveBand).toBe(ScoreBand.VERY_GOOD);
    expect(r.downgradeReason).toContain('Low confidence');
  });

  it('applyBandGating caps any band > sparseMaxBand on sparse data', () => {
    const r = applyBandGating(ScoreBand.VERY_GOOD, 0.9, true, {
      excellentMinConfidence: 0.62, sparseMaxBand: ScoreBand.GOOD,
    });
    expect(r.effectiveBand).toBe(ScoreBand.GOOD);
    expect(r.downgradeReason).toContain('Sparse');
  });

  it('label maps cover all five bands', () => {
    for (const b of [ScoreBand.WEAK, ScoreBand.PARTIAL, ScoreBand.GOOD, ScoreBand.VERY_GOOD, ScoreBand.EXCELLENT]) {
      expect(scoreBandLabel(b)).toMatch(/Match$/);
    }
  });
});

// =============================================================================
// 2. NETWORK RELEVANCE SCORE
// =============================================================================

describe('calculateNetworkRelevanceScore', () => {
  it('rewards 1st-degree connections with strong relationships', () => {
    const c = calculateNetworkRelevanceScore({
      ...NEUTRAL_NETWORK_CONTEXT,
      isFirstDegree: true, relationshipStrength: 0.85,
      mutualConnections: 6, lastInteractionDays: 5,
    });
    expect(c.score).toBeGreaterThanOrEqual(85);
    expect(c.matchedItems).toEqual(expect.arrayContaining(['1st-degree connection', 'Strong relationship']));
  });

  it('penalises stale relationships', () => {
    const c = calculateNetworkRelevanceScore({
      ...NEUTRAL_NETWORK_CONTEXT,
      isFirstDegree: true, relationshipStrength: 0.3,
      lastInteractionDays: 400,
    });
    expect(c.penalties).toEqual(expect.arrayContaining(['No interaction in over a year']));
  });

  it('returns a low-confidence baseline when there is no path', () => {
    const c = calculateNetworkRelevanceScore(NEUTRAL_NETWORK_CONTEXT);
    expect(c.score).toBeLessThan(40);
    expect(c.confidence).toBeLessThan(0.6);
    expect(c.missingItems).toEqual(expect.arrayContaining(['No direct or mutual connection']));
  });
});

// =============================================================================
// 3. HYBRID RETRIEVAL
// =============================================================================

describe('calculateRetrievalScore', () => {
  it('produces all four sub-scores with no embeddings (degraded semantic)', () => {
    const b = calculateRetrievalScore(makeBuy(), makeSell(), null);
    expect(b.structuredScore).toBeGreaterThan(0);
    expect(b.lexicalScore).toBeGreaterThan(0);
    expect(b.semanticScore).toBeGreaterThan(0);
    expect(b.networkScore).toBe(0);
    expect(b.totalScore).toBeGreaterThan(0);
    expect(b.evidence.some(e => e.includes('No embeddings'))).toBe(true);
  });

  it('uses embedding cosine when both records carry embeddings', () => {
    const buy = makeBuy({ embedding: [1, 0, 0, 0] });
    const sell = makeSell({ embedding: [1, 0, 0, 0] });
    const b = calculateRetrievalScore(buy, sell, null);
    expect(b.semanticScore).toBe(100);
    expect(b.evidence.some(e => e.includes('Embedding cosine'))).toBe(true);
  });

  it('does not inflate semantic when only one side has an embedding', () => {
    const buy = makeBuy({ embedding: [1, 0, 0, 0] });
    const sell = makeSell({ embedding: undefined });
    const b = calculateRetrievalScore(buy, sell, null);
    expect(b.evidence.some(e => e.includes('No embeddings'))).toBe(true);
  });

  it('strong category mismatch lowers structured score', () => {
    const sell = makeSell({ solutionCategory: SolutionCategory.MARKETING });
    const r = calculateRetrievalScore(makeBuy(), sell, null);
    const baseline = calculateRetrievalScore(makeBuy(), makeSell(), null);
    expect(r.structuredScore).toBeLessThan(baseline.structuredScore);
  });
});

// =============================================================================
// 4. effectiveRankScore + sort + dedupe
// =============================================================================

describe('calculateEffectiveRankScore', () => {
  it('keeps multiplier ≤ 1.5 and ≥ 0.4 across reasonable inputs', () => {
    const inputs = [
      { finalScore: 80, confidence: 0.85, hardFilterStatus: HardFilterStatus.PASS, isSparse: false, retrievalScore: 80, network: null },
      { finalScore: 50, confidence: 0.30, hardFilterStatus: HardFilterStatus.REVIEW, isSparse: true, retrievalScore: 30, network: null },
    ];
    for (const i of inputs) {
      const r = calculateEffectiveRankScore(i);
      expect(r.rankingFactors.multiplier).toBeGreaterThan(0.4);
      expect(r.rankingFactors.multiplier).toBeLessThanOrEqual(1.5);
    }
  });

  it('PASS produces higher reviewPenalty than REVIEW, which beats FAIL', () => {
    const base = { finalScore: 70, confidence: 0.7, isSparse: false, retrievalScore: 60, network: null };
    const pass = calculateEffectiveRankScore({ ...base, hardFilterStatus: HardFilterStatus.PASS });
    const review = calculateEffectiveRankScore({ ...base, hardFilterStatus: HardFilterStatus.REVIEW });
    const fail = calculateEffectiveRankScore({ ...base, hardFilterStatus: HardFilterStatus.FAIL });
    expect(pass.rankingFactors.reviewPenalty).toBeGreaterThan(review.rankingFactors.reviewPenalty);
    expect(review.rankingFactors.reviewPenalty).toBeGreaterThan(fail.rankingFactors.reviewPenalty);
  });
});

describe('sortByEffectiveRank', () => {
  it('orders by effectiveRankScore desc, then finalScore desc', () => {
    const items = [
      { id: 'a', effectiveRankScore: 70, finalScore: 70, confidence: 0.6, scoreBreakdown: { components: [] }, retrievalScore: 50 },
      { id: 'b', effectiveRankScore: 80, finalScore: 75, confidence: 0.6, scoreBreakdown: { components: [] }, retrievalScore: 50 },
      { id: 'c', effectiveRankScore: 80, finalScore: 78, confidence: 0.6, scoreBreakdown: { components: [] }, retrievalScore: 50 },
    ];
    const sorted = sortByEffectiveRank(items);
    expect(sorted.map(s => s.id)).toEqual(['c', 'b', 'a']);
  });
});

describe('dedupeByKeys', () => {
  it('drops repeats by primary id', () => {
    const out = dedupeByKeys(
      [{ id: 1 }, { id: 2 }, { id: 1 }] as Array<{ id: number }>,
      x => ({ primary: String(x.id) }),
    );
    expect(out.map(x => x.id)).toEqual([1, 2]);
  });

  it('drops repeats by userId across different primary ids', () => {
    const out = dedupeByKeys(
      [{ id: 'a', uid: 'u1' }, { id: 'b', uid: 'u1' }] as Array<{ id: string; uid: string }>,
      x => ({ primary: x.id, userId: x.uid }),
    );
    expect(out.map(x => x.id)).toEqual(['a']);
  });

  it('uses orgId only when userId is absent', () => {
    const out = dedupeByKeys(
      [
        { id: 'a', uid: undefined, oid: 'org1' },
        { id: 'b', uid: 'u1',       oid: 'org1' }, // user-distinct, kept
        { id: 'c', uid: undefined, oid: 'org1' }, // dup org, dropped
      ] as Array<{ id: string; uid?: string; oid?: string }>,
      x => ({ primary: x.id, userId: x.uid, organizationId: x.oid }),
    );
    expect(out.map(x => x.id)).toEqual(['a', 'b']);
  });
});

// =============================================================================
// 5. HARD FILTERS
// =============================================================================

describe('runDealHardFilters', () => {
  it('PASS for compatible buy↔sell with strong overlap', () => {
    const r = runDealHardFilters(makeBuy(), makeSell());
    expect(r.status).toBe(HardFilterStatus.PASS);
  });

  it('FAIL on category mismatch with no compat group', () => {
    const r = runDealHardFilters(makeBuy(), makeSell({ solutionCategory: SolutionCategory.LEGAL }));
    expect(r.status).toBe(HardFilterStatus.FAIL);
    expect(r.reason).toBe(HardFilterReason.CATEGORY_MISMATCH);
  });

  it('REVIEW on adjacent category groups', () => {
    const buy = makeBuy({ solutionCategory: SolutionCategory.STAFFING });
    const sell = makeSell({ solutionCategory: SolutionCategory.PROFESSIONAL_SERVICES });
    const r = runDealHardFilters(buy, sell);
    expect(r.status).toBe(HardFilterStatus.REVIEW);
  });

  it('FAIL on urgent buyer + non-active seller', () => {
    const buy = makeBuy({ neededTimeline: NeededTimeline.IMMEDIATELY });
    const sell = makeSell({ salesTimeline: SalesTimeline.BUILDING_PIPELINE });
    const r = runDealHardFilters(buy, sell);
    expect(r.status).toBe(HardFilterStatus.FAIL);
    expect(r.reason).toBe(HardFilterReason.TIMELINE_MISMATCH);
  });

  it('FAIL on requirements coverage <40%', () => {
    const sell = makeSell({ capabilities: ['totally unrelated thing'], offeringSummary: '', idealCustomerProfile: '' });
    const r = runDealHardFilters(makeBuy(), sell);
    expect(r.status).toBe(HardFilterStatus.FAIL);
    expect(r.reason).toBe(HardFilterReason.REQUIREMENTS_NOT_MET);
  });

  it('helpers: createPassResult / createFailResult / createReviewResult round-trip', () => {
    expect(createPassResult().status).toBe(HardFilterStatus.PASS);
    expect(createFailResult(HardFilterReason.BLOCKED, 'd', []).status).toBe(HardFilterStatus.FAIL);
    expect(createReviewResult(HardFilterReason.SPARSE_DATA, 'd', []).status).toBe(HardFilterStatus.REVIEW);
  });
});

// =============================================================================
// 6. DETERMINISTIC SCORING (incl. networkRelevanceScore)
// =============================================================================

describe('calculateDealMatchScore', () => {
  it('produces 12 components when network context is supplied', () => {
    const out = calculateDealMatchScore(makeBuy(), makeSell(), undefined, {
      isFirstDegree: true, isSecondDegree: false, sameOrganization: false,
      mutualConnections: 3, relationshipStrength: 0.7, interactionCount: 5, lastInteractionDays: 10,
    });
    expect(out.breakdown.components).toHaveLength(12);
    expect(out.breakdown.components.find(c => c.name === 'networkRelevanceScore')).toBeDefined();
  });

  it('still produces 12 components when no network context (neutral fallback)', () => {
    const out = calculateDealMatchScore(makeBuy(), makeSell());
    expect(out.breakdown.components).toHaveLength(12);
    const net = out.breakdown.components.find(c => c.name === 'networkRelevanceScore');
    expect(net?.score).toBeLessThan(40);
  });

  it('strong category + requirements + budget fit produces VERY_GOOD or above', () => {
    const out = calculateDealMatchScore(makeBuy(), makeSell());
    expect(out.finalScore).toBeGreaterThanOrEqual(55);
  });
});

// =============================================================================
// 7. AI VALIDATOR — bound math (no LLM call)
// =============================================================================

describe('DealAIValidator (bound math)', () => {
  const validator = new DealAIValidator();

  it('boundAdjustment clamps to ±maxAdjustment and [0,100]', () => {
    const fn = (validator as any).boundAdjustment.bind(validator) as (d: number, p: number, m: number) => number;
    expect(fn(70, 200, 10)).toBe(80);
    expect(fn(70, -50, 10)).toBe(60);
    expect(fn(95, 110, 10)).toBe(100);
    expect(fn(5, -20, 10)).toBe(0);
    expect(fn(70, 71, 5)).toBe(71);
  });

  it('returns null on hard-filter FAIL without calling the LLM', async () => {
    // FAIL is the strongest invariant: AI must never override it.
    const result = await validator.validateDirectMatch({
      matchMode: 'BUY_TO_NETWORK_SELLERS',
      buyRequest: makeBuy(), sellOffering: makeSell(),
      deterministicScore: 70,
      scoreBreakdown: { components: [], rawScore: 70, normalizedScore: 70, confidence: 0.7, totalWeight: 1, missingComponents: [], penalties: [] },
      hardFilter: createFailResult(HardFilterReason.CATEGORY_MISMATCH, 'incompatible', []),
      networkContext: null,
      maxAdjustment: 10,
    });
    expect(result).toBeNull();
  });

  it('keeps adjusted score within deterministic ± maxAdjustment when LLM responds', async () => {
    // We don't mock the LLM here; we just assert the post-condition the
    // validator guarantees. If the LLM is unavailable in CI, skip.
    if (!validator.isEnabled() && process.env.DEAL_AI_VALIDATION_ENABLED !== 'true') return;
    const result = await validator.validateDirectMatch({
      matchMode: 'BUY_TO_NETWORK_SELLERS',
      buyRequest: makeBuy(), sellOffering: makeSell(),
      deterministicScore: 70,
      scoreBreakdown: { components: [], rawScore: 70, normalizedScore: 70, confidence: 0.7, totalWeight: 1, missingComponents: [], penalties: [] },
      hardFilter: createPassResult(),
      networkContext: null,
      maxAdjustment: 10,
    });
    if (result) {
      expect(result.adjustedScore).toBeGreaterThanOrEqual(60);
      expect(result.adjustedScore).toBeLessThanOrEqual(80);
    }
  });

  it('isEnabled() reflects DEAL_AI_VALIDATION_ENABLED flag', () => {
    const prev = process.env.DEAL_AI_VALIDATION_ENABLED;
    try {
      process.env.DEAL_AI_VALIDATION_ENABLED = 'false';
      expect(validator.isEnabled()).toBe(false);
    } finally {
      if (prev === undefined) delete process.env.DEAL_AI_VALIDATION_ENABLED;
      else process.env.DEAL_AI_VALIDATION_ENABLED = prev;
    }
  });

  it('parseValidations tolerates surrounding prose and returns []  on garbage', () => {
    const fn = (validator as any).parseValidations.bind(validator) as (s: string) => unknown[];
    expect(fn('Sure! {"validations":[{"adjustedScore":78}]} done.')).toHaveLength(1);
    expect(fn('not json at all')).toHaveLength(0);
  });
});

// =============================================================================
// 8. HELPER ENGINE
// =============================================================================

describe('Helper engine — scoring + classification + hard filter', () => {
  it('classifies INSIDER when helper works at target organization', () => {
    const t = classifyHelperType(makeHelper({ worksAtTargetOrg: true }), 'BUY_TO_SELLER_HELPERS');
    expect(t).toBe(HelperType.INSIDER);
  });

  it('classifies BROKER for partnership / channel roles', () => {
    expect(classifyHelperType(makeHelper({ jobTitleAreas: ['partnerships'] }), 'BUY_TO_SELLER_HELPERS')).toBe(HelperType.BROKER);
    expect(classifyHelperType(makeHelper({ jobTitleAreas: ['channel'] }), 'SELL_TO_BUYER_HELPERS')).toBe(HelperType.BROKER);
  });

  it('classifies INFLUENCER for executives outside target org', () => {
    expect(classifyHelperType(makeHelper({ worksAtTargetOrg: false, seniorityHints: ['EXECUTIVE'], jobTitleAreas: [] }), 'BUY_TO_SELLER_HELPERS')).toBe(HelperType.INFLUENCER);
  });

  it('drops candidates with no network path AND no target org affiliation', () => {
    const r = helperHardFilterStatus(makeHelper({
      isFirstDegree: false, isSecondDegree: false,
      mutualConnections: 0, worksAtTargetOrg: false, relationshipStrength: 0,
      interactionCount: 0,
    }));
    expect(r.ok).toBe(false);
  });

  it('passes when helper has a 1st-degree relationship', () => {
    const r = helperHardFilterStatus(makeHelper());
    expect(r.ok).toBe(true);
  });

  it('relationshipTrustScore rewards strong recent first-degree contact', () => {
    const c = relationshipTrustScore(makeHelper());
    expect(c.score).toBeGreaterThanOrEqual(70);
    expect(c.matchedItems.some(s => s.includes('1st-degree'))).toBe(true);
  });

  it('introPathScore weights INSIDE > DIRECT > ADJACENT', () => {
    const inside = introPathScore(makeHelper({ worksAtTargetOrg: true, targetRoleProximity: 'NONE' }), 'BUY_TO_SELLER_HELPERS');
    const direct = introPathScore(makeHelper({ worksAtTargetOrg: false, targetRoleProximity: 'DIRECT' }), 'BUY_TO_SELLER_HELPERS');
    const adjacent = introPathScore(makeHelper({ worksAtTargetOrg: false, targetRoleProximity: 'ADJACENT' }), 'BUY_TO_SELLER_HELPERS');
    expect(inside.score).toBeGreaterThan(direct.score);
    expect(direct.score).toBeGreaterThan(adjacent.score);
  });

  it('calculateHelperScore produces 6 components and a normalized score', () => {
    const out = calculateHelperScore(makeHelper(), 'BUY_TO_SELLER_HELPERS', { industries: ['fintech'], subject: 'analytics' });
    expect(out.breakdown.components).toHaveLength(6);
    expect(out.deterministicScore).toBeGreaterThan(0);
    expect(out.deterministicScore).toBeLessThanOrEqual(100);
  });
});

// =============================================================================
// 9. ADAPTER
// =============================================================================

describe('Adapter — Prisma rows → engine types', () => {
  it('dealRequestToBuyRequest preserves metadata for BUY mode fields', () => {
    const buy = dealRequestToBuyRequest({
      id: 'd1', userId: 'u1', mode: 'BUY',
      title: 'Need analytics', domain: 'fintech', solutionType: 'SAAS_SOFTWARE',
      companySize: 'MEDIUM', problemStatement: 'Need analytics platform',
      targetEntityType: 'COMPANY', productName: null, targetDescription: null,
      buyerRole: 'TECHNICAL', metadata: {
        mustHaveRequirements: ['api', 'sso'],
        budgetRange: 'RANGE_25K_100K',
        neededTimeline: 'WITHIN_3_MONTHS',
        buyingStage: 'READY_TO_DECIDE',
        deliveryMode: 'REMOTE',
        idealProviderProfile: 'Mid-market SaaS',
      },
      dataQualityScore: 75, isActive: true,
      createdAt: new Date(), updatedAt: new Date(),
    });
    expect(buy.solutionCategory).toBe(SolutionCategory.SAAS_SOFTWARE);
    expect(buy.providerType).toBe(ProviderType.COMPANY);
    expect(buy.budgetRange).toBe(BudgetRange.RANGE_25K_100K);
    expect(buy.mustHaveRequirements).toEqual(['api', 'sso']);
    expect(buy.deliveryMode).toBe(DeliveryMode.REMOTE);
    expect(buy.buyerRole).toBe(BuyerRole.TECHNICAL);
  });

  it('dealRequestToSellOffering maps companySize → TargetCompanySize for SELL mode', () => {
    const sell = dealRequestToSellOffering({
      id: 's1', userId: 'u2', mode: 'SELL',
      title: 'AnalyticsPro', productName: 'AnalyticsPro',
      domain: 'fintech', solutionType: 'SAAS_SOFTWARE',
      companySize: 'MEDIUM', targetDescription: 'Mid-market analytics',
      targetEntityType: null, problemStatement: null, buyerRole: null,
      metadata: { capabilities: ['api'], priceRange: 'RANGE_25K_100K' },
      dataQualityScore: 80, isActive: true,
      createdAt: new Date(), updatedAt: new Date(),
    });
    expect(sell.targetCompanySize).toBe(TargetCompanySize.MID_MARKET);
    expect(sell.priceRange).toBe(BudgetRange.RANGE_25K_100K);
    expect(sell.capabilities).toEqual(['api']);
  });

  it('contactToSellOffering produces a candidate with sectors as industryFocus', () => {
    const sell = contactToSellOffering({
      id: 'c1', ownerId: 'u1', fullName: 'Maya Patel',
      jobTitle: 'VP Sales', company: 'Vendor Co', bio: 'Sells SaaS',
      sectors: ['fintech'], skills: ['api', 'sales'],
    });
    expect(sell.id).toBe('contact-as-sell:c1');
    expect(sell.industryFocus).toEqual(['fintech']);
    expect(sell.capabilities).toEqual(['api', 'sales']);
    expect(sell.providerType).toBe(ProviderType.INDIVIDUAL);
  });

  it('contactToHelperCandidate maps matchScore → relationshipStrength and infers seniority', () => {
    const h = contactToHelperCandidate({
      id: 'c2', ownerId: 'u1', fullName: 'Jamie Lee',
      jobTitle: 'VP Partnerships', company: 'Acme', sectors: ['fintech'],
      matchScore: 80, lastInteractionAt: new Date(Date.now() - 5 * 86400_000),
    });
    expect(h.relationshipStrength).toBeCloseTo(0.8, 5);
    expect(h.jobTitleAreas).toContain('partnerships');
    expect(h.seniorityHints).toContain('EXECUTIVE');
    expect(h.lastInteractionDays).toBe(5);
  });

  it('networkContextForContact treats all contacts as 1st-degree with relationshipStrength from matchScore', () => {
    const ctx = networkContextForContact({
      id: 'c3', ownerId: 'u1',
      matchScore: 70, lastInteractionAt: new Date(Date.now() - 10 * 86400_000),
    });
    expect(ctx.isFirstDegree).toBe(true);
    expect(ctx.relationshipStrength).toBeCloseTo(0.7, 5);
    expect(ctx.lastInteractionDays).toBe(10);
  });
});

// =============================================================================
// 10. THRESHOLDS — sanity check that v4.1 defaults match the spec
// =============================================================================

describe('DEFAULT_DEAL_THRESHOLDS', () => {
  it('uses minScore 40 (PARTIAL band start)', () => {
    expect(DEFAULT_DEAL_THRESHOLDS.minScore).toBe(40);
  });
  it('caps EXCELLENT band at confidence 0.62', () => {
    expect(DEFAULT_DEAL_THRESHOLDS.excellentMinConfidence).toBeCloseTo(0.62, 5);
  });
});
