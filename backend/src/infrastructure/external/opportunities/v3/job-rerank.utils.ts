/**
 * IntellMatch Job Matching Engine — Rerank Layer (Phase 7)
 *
 * Computes `effectiveRankScore` from finalScore using a multiplicative
 * formula of penalties and boosts, then provides deterministic tie-break
 * compare functions.
 *
 * Per spec §16:
 *   HIRING_TO_CANDIDATES:
 *     effectiveRankScore = finalScore
 *       * confidencePenalty
 *       * sparseProfilePenalty
 *       * hardFilterWarningPenalty
 *       * networkBoost
 *       * hiringUrgencyBoost
 *
 *   OPEN_TO_OPPORTUNITY_TO_HELPERS:
 *     effectiveRankScore = finalScore
 *       * confidencePenalty
 *       * relationshipTrustBoost
 *       * introPathBoost
 *       * helperTypeBoost
 *
 * Multipliers stay close to 1.0 (range ~0.85..1.15) so finalScore continues
 * to dominate — reranking only re-orders matches within similar score
 * bands. The Cohere semantic signal (Phase 0) is applied BEFORE this
 * function via the blended finalScore-vs-rerankScore step in
 * applyCohereRerank, so this layer composes cleanly on top.
 *
 * effectiveRankScore is a SORT KEY — never displayed to users. The card,
 * detail view, and explanation all show finalScore.
 *
 * @module job-matching/job-rerank.utils
 */

import {
  HardFilterStatus,
  HelperType,
  HiringProfile,
  HiringUrgency,
} from './job-matching.types';
import type { ScoringComponent } from './matching-bands.constants';

// ============================================================================
// PENALTIES (always ≤ 1.0)
// ============================================================================

/**
 * Penalises low-confidence matches. Confidence in [0,1].
 *   confidence ≥ 0.7  → 1.00 (no penalty)
 *   confidence ≥ 0.5  → 0.95
 *   else              → 0.85
 */
export function confidencePenalty(confidence: number): number {
  if (!isFinite(confidence)) return 0.85;
  if (confidence >= 0.7) return 1.0;
  if (confidence >= 0.5) return 0.95;
  return 0.85;
}

/**
 * Penalises sparse profiles further at rank time (gating already capped
 * the band; this nudges them down within the band).
 */
export function sparseProfilePenalty(isSparse: boolean): number {
  return isSparse ? 0.92 : 1.0;
}

/**
 * Hard-filter WARN matches stay in results but rank lower than PASS.
 * FAIL was already dropped from the pool before rerank, so we never see
 * it here.
 */
export function hardFilterWarningPenalty(status: HardFilterStatus): number {
  return status === HardFilterStatus.WARN ? 0.94 : 1.0;
}

// ============================================================================
// BOOSTS (always ≥ 1.0)
// ============================================================================

/**
 * Boost for in-network candidates. The candidate flow doesn't have a real
 * network model yet, but when one exists the relationship strength feeds
 * directly into this multiplier.
 */
export function networkBoost(relationshipStrength: number): number {
  if (!isFinite(relationshipStrength)) return 1.0;
  // 0..1 strength → 1.00..1.10
  return 1.0 + Math.max(0, Math.min(1, relationshipStrength)) * 0.1;
}

/**
 * Hiring urgency boost. Urgent roles surface higher among similar
 * candidates so the requester sees the most actionable matches first.
 */
export function hiringUrgencyBoost(urgency?: HiringUrgency | null): number {
  if (!urgency) return 1.0;
  // Map enum → boost. Unknown values fall back to 1.0.
  switch (String(urgency).toUpperCase()) {
    case 'IMMEDIATE':
    case 'URGENT':
      return 1.08;
    case 'HIGH':
      return 1.05;
    case 'MEDIUM':
    case 'NORMAL':
      return 1.02;
    case 'LOW':
    default:
      return 1.0;
  }
}

// ============================================================================
// HELPER-FLOW BOOSTS
// ============================================================================

/**
 * Helper-flow boost for the relationship trust component (0..100).
 *   ≥ 80 → 1.10
 *   ≥ 60 → 1.06
 *   ≥ 40 → 1.03
 *   else → 1.00
 */
export function relationshipTrustBoost(trustScore: number): number {
  if (!isFinite(trustScore)) return 1.0;
  if (trustScore >= 80) return 1.10;
  if (trustScore >= 60) return 1.06;
  if (trustScore >= 40) return 1.03;
  return 1.0;
}

/**
 * Helper-flow boost for intro-path quality (0..100).
 *   ≥ 80 → 1.08
 *   ≥ 60 → 1.04
 *   ≥ 40 → 1.02
 *   else → 1.00
 */
export function introPathBoost(introScore: number): number {
  if (!isFinite(introScore)) return 1.0;
  if (introScore >= 80) return 1.08;
  if (introScore >= 60) return 1.04;
  if (introScore >= 40) return 1.02;
  return 1.0;
}

/**
 * Helper-type boost: prefer recruiters / hiring decision-makers over
 * advisory-only contacts when finalScores are similar. Weak paths get a
 * gentle penalty so they don't crowd out stronger options.
 */
export function helperTypeBoost(type: HelperType): number {
  switch (type) {
    case HelperType.RECRUITER_CONTACT:
      return 1.10;
    case HelperType.HIRING_PATH_CONTACT:
      return 1.10;
    case HelperType.DIRECT_REFERRAL_CONTACT:
      return 1.06;
    case HelperType.WARM_INTRO_CONTACT:
      return 1.03;
    case HelperType.ADVISORY_CONTACT:
      return 1.0;
    case HelperType.WEAK_PATH:
      return 0.92;
    default:
      return 1.0;
  }
}

// ============================================================================
// EFFECTIVE RANK SCORE COMPUTATION
// ============================================================================

export interface CandidateRerankInput {
  /** Score AFTER Cohere blend (or = finalScore when Cohere not used). */
  baseScore: number;
  finalScore: number;
  confidence: number;
  isSparse: boolean;
  hardFilterStatus: HardFilterStatus;
  /** 0..1 — defaults to 0 when no network model exists yet. */
  relationshipStrength?: number;
  hiringUrgency?: HiringUrgency | null;
}

export interface CandidateRerankResult {
  effectiveRankScore: number;
  multipliers: {
    confidencePenalty: number;
    sparseProfilePenalty: number;
    hardFilterWarningPenalty: number;
    networkBoost: number;
    hiringUrgencyBoost: number;
    combined: number;
  };
}

export function computeCandidateEffectiveRankScore(
  input: CandidateRerankInput,
): CandidateRerankResult {
  const cp = confidencePenalty(input.confidence);
  const sp = sparseProfilePenalty(input.isSparse);
  const wp = hardFilterWarningPenalty(input.hardFilterStatus);
  const nb = networkBoost(input.relationshipStrength ?? 0);
  const ub = hiringUrgencyBoost(input.hiringUrgency ?? null);
  const combined = cp * sp * wp * nb * ub;
  const effectiveRankScore = Math.max(0, Math.min(100, input.baseScore * combined));
  return {
    effectiveRankScore,
    multipliers: {
      confidencePenalty: cp,
      sparseProfilePenalty: sp,
      hardFilterWarningPenalty: wp,
      networkBoost: nb,
      hiringUrgencyBoost: ub,
      combined,
    },
  };
}

export interface HelperRerankInput {
  finalScore: number;
  confidence: number;
  helperType: HelperType;
  relationshipTrustScore: number;
  introPathScore: number;
}

export interface HelperRerankResult {
  effectiveRankScore: number;
  multipliers: {
    confidencePenalty: number;
    relationshipTrustBoost: number;
    introPathBoost: number;
    helperTypeBoost: number;
    combined: number;
  };
}

export function computeHelperEffectiveRankScore(
  input: HelperRerankInput,
): HelperRerankResult {
  const cp = confidencePenalty(input.confidence);
  const rb = relationshipTrustBoost(input.relationshipTrustScore);
  const ib = introPathBoost(input.introPathScore);
  const tb = helperTypeBoost(input.helperType);
  const combined = cp * rb * ib * tb;
  const effectiveRankScore = Math.max(
    0,
    Math.min(100, input.finalScore * combined),
  );
  return {
    effectiveRankScore,
    multipliers: {
      confidencePenalty: cp,
      relationshipTrustBoost: rb,
      introPathBoost: ib,
      helperTypeBoost: tb,
      combined,
    },
  };
}

// ============================================================================
// TIE-BREAKERS (spec §16)
// ============================================================================

export interface CandidateRankRow {
  effectiveRankScore: number;
  finalScore: number;
  confidence: number;
  scoreBreakdown: { components: ScoringComponent[] };
  relationshipStrength?: number;
}

/**
 * Spec tie-break for HIRING_TO_CANDIDATES:
 *   1. effectiveRankScore desc
 *   2. finalScore desc
 *   3. confidence desc
 *   4. requiredSkills coverage desc  (skillsScore component)
 *   5. relevantExperience score desc (experienceScore component)
 *   6. semanticScore desc
 *   7. network relationship strength desc
 */
export function compareCandidateRank(
  a: CandidateRankRow,
  b: CandidateRankRow,
): number {
  if (b.effectiveRankScore !== a.effectiveRankScore) {
    return b.effectiveRankScore - a.effectiveRankScore;
  }
  if (b.finalScore !== a.finalScore) return b.finalScore - a.finalScore;
  if (b.confidence !== a.confidence) return b.confidence - a.confidence;

  const aSkill = componentScore(a.scoreBreakdown.components, 'skillsScore');
  const bSkill = componentScore(b.scoreBreakdown.components, 'skillsScore');
  if (bSkill !== aSkill) return bSkill - aSkill;

  const aExp = componentScore(a.scoreBreakdown.components, 'experienceScore');
  const bExp = componentScore(b.scoreBreakdown.components, 'experienceScore');
  if (bExp !== aExp) return bExp - aExp;

  const aSem = componentScore(a.scoreBreakdown.components, 'semanticScore');
  const bSem = componentScore(b.scoreBreakdown.components, 'semanticScore');
  if (bSem !== aSem) return bSem - aSem;

  const aRs = a.relationshipStrength ?? 0;
  const bRs = b.relationshipStrength ?? 0;
  return bRs - aRs;
}

export interface HelperRankRow {
  effectiveRankScore: number;
  finalScore: number;
  scoreBreakdown: { components: ScoringComponent[] };
  networkRelationshipStrength?: number;
}

/**
 * Spec tie-break for OPEN_TO_OPPORTUNITY_TO_HELPERS:
 *   1. effectiveRankScore desc
 *   2. finalScore desc
 *   3. relationshipTrustScore desc
 *   4. hiringInfluenceScore desc
 *   5. introPathScore desc
 *   6. functionalRelevanceScore desc
 *   7. networkRelationship strength desc
 */
export function compareHelperRank(a: HelperRankRow, b: HelperRankRow): number {
  if (b.effectiveRankScore !== a.effectiveRankScore) {
    return b.effectiveRankScore - a.effectiveRankScore;
  }
  if (b.finalScore !== a.finalScore) return b.finalScore - a.finalScore;

  const aTrust = componentScore(a.scoreBreakdown.components, 'relationshipTrustScore');
  const bTrust = componentScore(b.scoreBreakdown.components, 'relationshipTrustScore');
  if (bTrust !== aTrust) return bTrust - aTrust;

  const aHire = componentScore(a.scoreBreakdown.components, 'hiringInfluenceScore');
  const bHire = componentScore(b.scoreBreakdown.components, 'hiringInfluenceScore');
  if (bHire !== aHire) return bHire - aHire;

  const aIntro = componentScore(a.scoreBreakdown.components, 'introPathScore');
  const bIntro = componentScore(b.scoreBreakdown.components, 'introPathScore');
  if (bIntro !== aIntro) return bIntro - aIntro;

  const aFunc = componentScore(a.scoreBreakdown.components, 'functionalRelevanceScore');
  const bFunc = componentScore(b.scoreBreakdown.components, 'functionalRelevanceScore');
  if (bFunc !== aFunc) return bFunc - aFunc;

  return (b.networkRelationshipStrength ?? 0) - (a.networkRelationshipStrength ?? 0);
}

function componentScore(components: ScoringComponent[], name: string): number {
  return components.find((c) => c.name === name)?.score ?? 0;
}
