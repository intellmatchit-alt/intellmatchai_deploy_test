/**
 * Deal Matching — Helper Types (v4.1)
 *
 * Types for BUY_TO_SELLER_HELPERS and SELL_TO_BUYER_HELPERS flows.
 *
 * Helper matching answers a different question from direct matching:
 *   "Why can this person help make the deal happen?" — not "is this person
 *   the right buyer/seller". So the data shape, scoring components, and
 *   explanation copy are all distinct from DealMatchResult.
 */

import {
  ScoreBand, SurfacedStatus, HardFilterStatus, HardFilterReason,
  ScoreBreakdown, MatchExplanation, RetrievalBreakdown, RankingFactors,
  NetworkRelationship,
} from './common';

export type HelperMatchMode = 'BUY_TO_SELLER_HELPERS' | 'SELL_TO_BUYER_HELPERS';

/** What kind of help is this person likely to provide? */
export enum HelperType {
  /** Works at the target counterparty organization (highest commercial path) */
  INSIDER = 'INSIDER',
  /** Strong relationship and willing to make a warm intro */
  INTRODUCER = 'INTRODUCER',
  /** Decision-influencer in the buying/selling chain */
  INFLUENCER = 'INFLUENCER',
  /** Industry advocate / recommender (e.g. consultant, analyst) */
  ADVOCATE = 'ADVOCATE',
  /** Professional broker / partner who handles deals in this space */
  BROKER = 'BROKER',
}

export function helperTypeLabel(t: HelperType): string {
  return {
    INSIDER: 'Inside Connection',
    INTRODUCER: 'Warm Introducer',
    INFLUENCER: 'Decision Influencer',
    ADVOCATE: 'Industry Advocate',
    BROKER: 'Professional Broker',
  }[t];
}

/** Human-friendly summary of how the helper is likely to help. */
export function likelyHelpType(t: HelperType, mode: HelperMatchMode): string {
  const counterparty = mode === 'BUY_TO_SELLER_HELPERS' ? 'seller/provider' : 'buyer';
  return {
    INSIDER: `Direct introduction inside the target ${counterparty} organization.`,
    INTRODUCER: `Warm introduction to a relevant ${counterparty}.`,
    INFLUENCER: `Influence over a relevant decision-making process for ${counterparty} selection.`,
    ADVOCATE: `Recommendation or referral toward suitable ${counterparty} options.`,
    BROKER: `Professional brokerage / matchmaking for ${counterparty} engagements.`,
  }[t];
}

/**
 * A candidate helper. Adapter is responsible for assembling this from a
 * Prisma Contact + interaction stats + organization metadata.
 */
export interface HelperCandidate {
  id: string;                  // adapter-stable ID for dedupe
  userId?: string;             // optional — if helper is a registered user
  fullName: string;
  jobTitle?: string | null;
  jobTitleAreas?: string[];    // ["sales", "business development"], normalized
  company?: string | null;
  organizationId?: string | null;
  industries?: string[];
  /** seniority hints for role influence scoring */
  seniorityHints?: ('JUNIOR' | 'MID' | 'SENIOR' | 'EXECUTIVE')[];
  bio?: string | null;
  email?: string | null;
  /** does the helper appear to work at the target counterparty? */
  worksAtTargetOrg?: boolean;
  /** target counterparty role indicators (procurement, engineering, etc.) */
  targetRoleProximity?: 'DIRECT' | 'ADJACENT' | 'NONE';

  // Network signals
  isFirstDegree: boolean;
  isSecondDegree: boolean;
  sameOrganization: boolean;
  mutualConnections: number;
  relationshipStrength: number; // 0..1
  interactionCount: number;
  lastInteractionDays: number | null;

  /** raw notes the explanation can pass through verbatim */
  signals?: string[];
}

/**
 * Output of the helper engine. Mirrors BaseMatchResult so the response shape
 * stays consistent with direct matches.
 */
export interface HelperMatchResult {
  id: string;
  matchMode: HelperMatchMode;
  sourceEntityId: string;       // dealRequestId
  targetEntityId: string;       // helper candidate id
  helperUserId: string | null;
  helperName: string;
  helperTitle: string | null;
  helperRoleArea: string | null;
  helperOrganization: string | null;
  helperType: HelperType;
  helperTypeLabel: string;
  likelyHelpType: string;

  finalScore: number;
  deterministicScore: number;
  aiScore: number | null;
  effectiveRankScore: number;
  scoreBand: ScoreBand;
  matchLevel: ScoreBand;
  surfacedStatus: SurfacedStatus;
  confidence: number;

  hardFilterStatus: HardFilterStatus;
  hardFilterReason: HardFilterReason | null;

  retrievalScore: number;
  retrievalBreakdown: RetrievalBreakdown;
  rankingFactors: RankingFactors;
  scoreBreakdown: ScoreBreakdown;
  explanation: MatchExplanation;
  helperExplanation: string;
  strengths: string[];
  gaps: string[];
  matchedSignals: string[];
  missingOrUncertainFields: string[];
  networkRelationship: NetworkRelationship | null;

  aiReasoning: string | null;
  aiGreenFlags: string[];
  aiRedFlags: string[];

  rank: number;
  createdAt: Date;
  expiresAt: Date;
}

export interface HelperScoringWeights {
  relationshipTrust: number;
  introPath: number;
  roleInfluence: number;
  commercialPathRelevance: number;
  helperNetworkStrength: number;
  requesterNeedFit: number;
}

export const DEFAULT_HELPER_WEIGHTS: HelperScoringWeights = {
  relationshipTrust: 0.22,
  introPath: 0.20,
  roleInfluence: 0.18,
  commercialPathRelevance: 0.18,
  helperNetworkStrength: 0.12,
  requesterNeedFit: 0.10,
};
