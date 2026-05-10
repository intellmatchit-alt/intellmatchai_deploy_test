/**
 * Tests for the Job Matching rerank layer (Phase 7 spec multipliers).
 *
 * These cover the spec §16 contract:
 *   - effectiveRankScore = finalScore × penalties × boosts
 *   - finalScore is NEVER mutated by this layer (display-untouched contract)
 *   - Multipliers compose multiplicatively, in the [~0.85, ~1.15] range so
 *     finalScore continues to dominate ordering.
 *   - Tie-break sequences (compareCandidateRank, compareHelperRank) follow
 *     the spec's documented fallthrough order exactly.
 *
 * @module __tests__/job-rerank.utils
 */

import {
  compareCandidateRank,
  compareHelperRank,
  computeCandidateEffectiveRankScore,
  computeHelperEffectiveRankScore,
  confidencePenalty,
  hardFilterWarningPenalty,
  helperTypeBoost,
  hiringUrgencyBoost,
  introPathBoost,
  networkBoost,
  relationshipTrustBoost,
  sparseProfilePenalty,
} from '../infrastructure/external/opportunities/v3/job-rerank.utils';
import {
  HardFilterStatus,
  HelperType,
  HiringUrgency,
} from '../infrastructure/external/opportunities/v3/job-matching.types';

// ============================================================================
// PENALTIES — always ≤ 1.0
// ============================================================================

describe('confidencePenalty', () => {
  it.each([
    [0.9, 1.0],
    [0.7, 1.0],
    [0.69, 0.95],
    [0.5, 0.95],
    [0.49, 0.85],
    [0.0, 0.85],
  ])('confidence=%s → %s', (conf, expected) => {
    expect(confidencePenalty(conf)).toBe(expected);
  });

  it('treats non-finite confidence as worst case', () => {
    expect(confidencePenalty(NaN)).toBe(0.85);
    expect(confidencePenalty(Infinity)).toBe(0.85);
  });
});

describe('sparseProfilePenalty', () => {
  it('penalises sparse profiles within their band', () => {
    expect(sparseProfilePenalty(true)).toBe(0.92);
  });
  it('does nothing for non-sparse profiles', () => {
    expect(sparseProfilePenalty(false)).toBe(1.0);
  });
});

describe('hardFilterWarningPenalty', () => {
  it('PASS does not penalise', () => {
    expect(hardFilterWarningPenalty(HardFilterStatus.PASS)).toBe(1.0);
  });
  it('WARN gets a gentle penalty so PASS ranks above WARN at the same score', () => {
    expect(hardFilterWarningPenalty(HardFilterStatus.WARN)).toBe(0.94);
  });
});

// ============================================================================
// CANDIDATE-FLOW BOOSTS
// ============================================================================

describe('networkBoost', () => {
  it('returns 1.0 with no relationship strength', () => {
    expect(networkBoost(0)).toBe(1.0);
  });
  it('caps at 1.10 for full relationship strength', () => {
    expect(networkBoost(1)).toBeCloseTo(1.1, 5);
  });
  it('clamps inputs out of [0,1]', () => {
    expect(networkBoost(-5)).toBe(1.0);
    expect(networkBoost(2)).toBeCloseTo(1.1, 5);
  });
  it('treats non-finite as 1.0', () => {
    expect(networkBoost(NaN)).toBe(1.0);
  });
});

describe('hiringUrgencyBoost', () => {
  it.each([
    [HiringUrgency.URGENT, 1.08],
    [HiringUrgency.NORMAL, 1.02],
    [HiringUrgency.LOW, 1.0],
  ])('urgency=%s → %s', (urgency, expected) => {
    expect(hiringUrgencyBoost(urgency)).toBe(expected);
  });
  it('treats unknown urgency strings (e.g. CRITICAL) as no boost (default branch)', () => {
    expect(hiringUrgencyBoost(HiringUrgency.CRITICAL)).toBe(1.0);
  });
  it('treats null/undefined urgency as no boost', () => {
    expect(hiringUrgencyBoost(null)).toBe(1.0);
    expect(hiringUrgencyBoost(undefined)).toBe(1.0);
  });
});

// ============================================================================
// HELPER-FLOW BOOSTS
// ============================================================================

describe('relationshipTrustBoost', () => {
  it.each([
    [85, 1.10],
    [80, 1.10],
    [60, 1.06],
    [40, 1.03],
    [39, 1.0],
    [0, 1.0],
  ])('trust=%s → %s', (trust, expected) => {
    expect(relationshipTrustBoost(trust)).toBe(expected);
  });
});

describe('introPathBoost', () => {
  it.each([
    [80, 1.08],
    [60, 1.04],
    [40, 1.02],
    [39, 1.0],
  ])('intro=%s → %s', (intro, expected) => {
    expect(introPathBoost(intro)).toBe(expected);
  });
});

describe('helperTypeBoost', () => {
  it('rewards recruiter / hiring-path strongest', () => {
    expect(helperTypeBoost(HelperType.RECRUITER_CONTACT)).toBe(1.10);
    expect(helperTypeBoost(HelperType.HIRING_PATH_CONTACT)).toBe(1.10);
  });
  it('mid-tier helpers get smaller boosts', () => {
    expect(helperTypeBoost(HelperType.DIRECT_REFERRAL_CONTACT)).toBe(1.06);
    expect(helperTypeBoost(HelperType.WARM_INTRO_CONTACT)).toBe(1.03);
    expect(helperTypeBoost(HelperType.ADVISORY_CONTACT)).toBe(1.0);
  });
  it('weak paths get gently penalised so they do not crowd stronger options', () => {
    expect(helperTypeBoost(HelperType.WEAK_PATH)).toBe(0.92);
  });
});

// ============================================================================
// effectiveRankScore composition
// ============================================================================

describe('computeCandidateEffectiveRankScore', () => {
  it('reduces to finalScore when every multiplier = 1.0', () => {
    const r = computeCandidateEffectiveRankScore({
      baseScore: 80,
      finalScore: 80,
      confidence: 0.9, // → cp = 1.0
      isSparse: false,
      hardFilterStatus: HardFilterStatus.PASS,
      relationshipStrength: 0,
      hiringUrgency: HiringUrgency.LOW,
    });
    expect(r.effectiveRankScore).toBe(80);
    expect(r.multipliers.combined).toBeCloseTo(1.0, 5);
  });

  it('applies all four candidate multipliers', () => {
    const r = computeCandidateEffectiveRankScore({
      baseScore: 80,
      finalScore: 80,
      confidence: 0.4,    // 0.85
      isSparse: true,     // 0.92
      hardFilterStatus: HardFilterStatus.WARN, // 0.94
      relationshipStrength: 1,                  // 1.10
      hiringUrgency: HiringUrgency.URGENT,   // 1.08
    });
    const expectedCombined = 0.85 * 0.92 * 0.94 * 1.10 * 1.08;
    expect(r.multipliers.combined).toBeCloseTo(expectedCombined, 5);
    expect(r.effectiveRankScore).toBeCloseTo(80 * expectedCombined, 1);
  });

  it('clamps to [0, 100]', () => {
    const r = computeCandidateEffectiveRankScore({
      baseScore: 200,
      finalScore: 200,
      confidence: 1.0,
      isSparse: false,
      hardFilterStatus: HardFilterStatus.PASS,
      relationshipStrength: 1.0,
      hiringUrgency: HiringUrgency.URGENT,
    });
    expect(r.effectiveRankScore).toBeLessThanOrEqual(100);
  });
});

describe('computeHelperEffectiveRankScore', () => {
  it('composes confidence × trust × intro × helperType multiplicatively', () => {
    const r = computeHelperEffectiveRankScore({
      finalScore: 70,
      confidence: 0.9,                         // 1.0
      helperType: HelperType.RECRUITER_CONTACT, // 1.10
      relationshipTrustScore: 80,              // 1.10
      introPathScore: 60,                      // 1.04
    });
    const expectedCombined = 1.0 * 1.10 * 1.04 * 1.10;
    expect(r.multipliers.combined).toBeCloseTo(expectedCombined, 5);
  });

  it('weak paths drop below finalScore', () => {
    const r = computeHelperEffectiveRankScore({
      finalScore: 70,
      confidence: 0.9,
      helperType: HelperType.WEAK_PATH, // 0.92
      relationshipTrustScore: 0,
      introPathScore: 0,
    });
    expect(r.effectiveRankScore).toBeLessThan(70);
  });
});

// ============================================================================
// TIE-BREAK SEQUENCES (spec §16)
// ============================================================================

const components = (entries: Record<string, number>) =>
  Object.entries(entries).map(([name, score]) => ({
    name,
    score,
    weight: 0.1,
    weightedScore: score * 0.1,
    confidence: 0.8,
    explanation: '',
    evidence: [] as string[],
    penalties: [] as string[],
  }));

describe('compareCandidateRank', () => {
  const baseRow = (overrides: Partial<{
    effectiveRankScore: number;
    finalScore: number;
    confidence: number;
    skills: number;
    experience: number;
    semantic: number;
    relationship: number;
  }>) => ({
    effectiveRankScore: overrides.effectiveRankScore ?? 50,
    finalScore: overrides.finalScore ?? 50,
    confidence: overrides.confidence ?? 0.5,
    relationshipStrength: overrides.relationship ?? 0,
    scoreBreakdown: {
      components: components({
        skillsScore: overrides.skills ?? 0,
        experienceScore: overrides.experience ?? 0,
        semanticScore: overrides.semantic ?? 0,
      }),
    },
  });

  it('ranks higher effectiveRankScore first', () => {
    const a = baseRow({ effectiveRankScore: 90 });
    const b = baseRow({ effectiveRankScore: 50 });
    expect(compareCandidateRank(a, b)).toBeLessThan(0);
  });

  it('falls through to finalScore when effective ties', () => {
    const a = baseRow({ effectiveRankScore: 70, finalScore: 80 });
    const b = baseRow({ effectiveRankScore: 70, finalScore: 60 });
    expect(compareCandidateRank(a, b)).toBeLessThan(0);
  });

  it('falls through to confidence', () => {
    const a = baseRow({ effectiveRankScore: 70, finalScore: 70, confidence: 0.9 });
    const b = baseRow({ effectiveRankScore: 70, finalScore: 70, confidence: 0.5 });
    expect(compareCandidateRank(a, b)).toBeLessThan(0);
  });

  it('falls through to skills coverage', () => {
    const a = baseRow({ skills: 90 });
    const b = baseRow({ skills: 30 });
    expect(compareCandidateRank(a, b)).toBeLessThan(0);
  });

  it('falls through to experience', () => {
    const a = baseRow({ experience: 80 });
    const b = baseRow({ experience: 40 });
    expect(compareCandidateRank(a, b)).toBeLessThan(0);
  });

  it('falls through to semantic last (before relationship)', () => {
    const a = baseRow({ semantic: 90 });
    const b = baseRow({ semantic: 30 });
    expect(compareCandidateRank(a, b)).toBeLessThan(0);
  });

  it('finally falls through to relationship strength', () => {
    const a = baseRow({ relationship: 0.9 });
    const b = baseRow({ relationship: 0.0 });
    expect(compareCandidateRank(a, b)).toBeLessThan(0);
  });
});

describe('compareHelperRank', () => {
  const helperRow = (overrides: Partial<{
    effectiveRankScore: number;
    finalScore: number;
    trust: number;
    influence: number;
    intro: number;
    functional: number;
    network: number;
  }>) => ({
    effectiveRankScore: overrides.effectiveRankScore ?? 50,
    finalScore: overrides.finalScore ?? 50,
    networkRelationshipStrength: overrides.network ?? 0,
    scoreBreakdown: {
      components: components({
        relationshipTrustScore: overrides.trust ?? 0,
        hiringInfluenceScore: overrides.influence ?? 0,
        introPathScore: overrides.intro ?? 0,
        functionalRelevanceScore: overrides.functional ?? 0,
      }),
    },
  });

  it('uses spec sequence: effective → final → trust → influence → intro → functional → network', () => {
    // All other signals equal except trust
    const a = helperRow({ trust: 90 });
    const b = helperRow({ trust: 10 });
    expect(compareHelperRank(a, b)).toBeLessThan(0);

    // Trust ties → influence breaks
    const c = helperRow({ trust: 50, influence: 90 });
    const d = helperRow({ trust: 50, influence: 10 });
    expect(compareHelperRank(c, d)).toBeLessThan(0);

    // Up to intro
    const e = helperRow({ trust: 50, influence: 50, intro: 90 });
    const f = helperRow({ trust: 50, influence: 50, intro: 10 });
    expect(compareHelperRank(e, f)).toBeLessThan(0);

    // Network is final tie-break
    const g = helperRow({ network: 0.9 });
    const h = helperRow({ network: 0.0 });
    expect(compareHelperRank(g, h)).toBeLessThan(0);
  });

  it('returns 0 only when every signal ties', () => {
    expect(compareHelperRank(helperRow({}), helperRow({}))).toBe(0);
  });
});
