/**
 * Deal Matching — effectiveRankScore + dedupe (v4.1)
 *
 * effectiveRankScore is used for ordering only. The displayed score is always
 * finalScore. Multipliers are tuned to keep effectiveRankScore close to
 * finalScore in the typical case so charts stay intuitive.
 *
 *   effectiveRankScore =
 *     finalScore
 *     * confidencePenalty
 *     * reviewPenalty
 *     * sparseDataPenalty
 *     * networkBoost
 *     * readinessBoost
 *     * retrievalBoost
 */

import { ScoreBand, HardFilterStatus, RankingFactors } from './common';
import { BuyRequest, SellOffering, NeededTimeline, BuyingStage, SalesTimeline } from './types';
import { NetworkContext } from './network.utils';

export interface RankInputs {
  finalScore: number;
  confidence: number;
  hardFilterStatus: HardFilterStatus;
  isSparse: boolean;
  retrievalScore: number;
  network: NetworkContext | null;
  buy?: BuyRequest;
  sell?: SellOffering;
}

function confidencePenalty(c: number): number {
  if (c >= 0.80) return 1.00;
  if (c >= 0.60) return 0.96;
  if (c >= 0.40) return 0.90;
  return 0.82;
}

function reviewPenalty(s: HardFilterStatus): number {
  if (s === HardFilterStatus.PASS) return 1.00;
  if (s === HardFilterStatus.REVIEW) return 0.92;
  return 0.5; // FAIL — should usually be excluded entirely; this is a safety net
}

function sparseDataPenalty(isSparse: boolean): number {
  return isSparse ? 0.88 : 1.00;
}

function networkBoost(ctx: NetworkContext | null): number {
  if (!ctx) return 1.00;
  if (ctx.isFirstDegree && ctx.relationshipStrength >= 0.7) return 1.06;
  if (ctx.isFirstDegree) return 1.03;
  if (ctx.isSecondDegree) return 1.00;
  return 0.94; // no path; penalize ranking but don't exclude
}

function readinessBoost(buy?: BuyRequest, sell?: SellOffering): number {
  if (!buy || !sell) return 1.00;
  const urgent = buy.neededTimeline === NeededTimeline.IMMEDIATELY || buy.buyingStage === BuyingStage.URGENT_NEED;
  const ready = buy.buyingStage === BuyingStage.READY_TO_DECIDE || urgent;
  const active = sell.salesTimeline === SalesTimeline.ACTIVELY_SELLING;
  if (urgent && active) return 1.04;
  if (ready && active) return 1.03;
  if (buy.buyingStage === BuyingStage.EXPLORING && sell.salesTimeline === SalesTimeline.EXPLORING_MARKET) return 1.00;
  if (urgent && !active) return 0.96;
  return 1.00;
}

function retrievalBoost(retrievalScore: number): number {
  if (retrievalScore >= 80) return 1.04;
  if (retrievalScore >= 60) return 1.02;
  return 1.00;
}

/**
 * Compute effectiveRankScore + the multipliers that produced it.
 * Caller is expected to clamp + use this for ordering only.
 */
export function calculateEffectiveRankScore(input: RankInputs): { effectiveRankScore: number; rankingFactors: RankingFactors } {
  const cp = confidencePenalty(input.confidence);
  const rp = reviewPenalty(input.hardFilterStatus);
  const sp = sparseDataPenalty(input.isSparse);
  const nb = networkBoost(input.network);
  const rb = readinessBoost(input.buy, input.sell);
  const tb = retrievalBoost(input.retrievalScore);
  const multiplier = cp * rp * sp * nb * rb * tb;
  const effective = input.finalScore * multiplier;

  return {
    effectiveRankScore: Math.max(0, Math.min(120, Number(effective.toFixed(2)))),
    rankingFactors: {
      confidencePenalty: cp,
      reviewPenalty: rp,
      sparseDataPenalty: sp,
      networkBoost: nb,
      readinessBoost: rb,
      retrievalBoost: tb,
      multiplier: Number(multiplier.toFixed(3)),
    },
  };
}

// ---------------------------------------------------------------------------
// Sort and dedupe (in-pipeline; fed to pagination)
// ---------------------------------------------------------------------------

interface Sortable {
  id: string;
  effectiveRankScore: number;
  finalScore: number;
  confidence: number;
  scoreBreakdown: { components: { name: string; score: number }[] };
  retrievalScore: number;
  /** for stable tie-break when everything else is equal */
}

function tieBreakValue<T extends Sortable>(m: T, name: string): number {
  return m.scoreBreakdown.components.find(c => c.name === name)?.score ?? 0;
}

/**
 * Direct-match sort order per spec:
 * 1. effectiveRankScore desc
 * 2. finalScore desc
 * 3. confidence desc
 * 4. requirementsScore desc
 * 5. semanticScore desc
 * 6. networkRelevanceScore desc
 * 7. retrievalScore desc
 */
export function sortByEffectiveRank<T extends Sortable>(matches: T[]): T[] {
  return [...matches].sort((a, b) =>
    b.effectiveRankScore - a.effectiveRankScore
    || b.finalScore - a.finalScore
    || b.confidence - a.confidence
    || tieBreakValue(b, 'requirementsScore') - tieBreakValue(a, 'requirementsScore')
    || tieBreakValue(b, 'semanticScore') - tieBreakValue(a, 'semanticScore')
    || tieBreakValue(b, 'networkRelevanceScore') - tieBreakValue(a, 'networkRelevanceScore')
    || b.retrievalScore - a.retrievalScore
    || a.id.localeCompare(b.id),
  );
}

// ---------------------------------------------------------------------------
// Dedupe — by stable IDs, preserving first occurrence (highest-ranked).
// Caller MUST sort first. Last-resort fuzzy match on normalized name+org.
// ---------------------------------------------------------------------------

export interface DedupeKeys {
  primary?: string;
  userId?: string;
  organizationId?: string;
  /** normalized "name|org" — only used if primary/userId/orgId are both unset */
  fallback?: string;
}

export function dedupeByKeys<T>(items: T[], keyer: (x: T) => DedupeKeys): T[] {
  const seenPrimary = new Set<string>();
  const seenUser = new Set<string>();
  const seenOrg = new Set<string>();
  const seenFallback = new Set<string>();
  const out: T[] = [];
  for (const it of items) {
    const k = keyer(it);
    if (k.primary && seenPrimary.has(k.primary)) continue;
    if (k.userId && seenUser.has(k.userId)) continue;
    // org dedupe is opt-in; only apply when no userId is present
    if (!k.userId && k.organizationId && seenOrg.has(k.organizationId)) continue;
    if (!k.primary && !k.userId && !k.organizationId && k.fallback && seenFallback.has(k.fallback)) continue;
    if (k.primary) seenPrimary.add(k.primary);
    if (k.userId) seenUser.add(k.userId);
    if (k.organizationId) seenOrg.add(k.organizationId);
    if (k.fallback) seenFallback.add(k.fallback);
    out.push(it);
  }
  return out;
}

export function normalizeFallbackKey(name: string, org?: string | null): string {
  const n = (name || '').toLowerCase().trim().replace(/\s+/g, ' ');
  const o = (org || '').toLowerCase().trim().replace(/\s+/g, ' ');
  return `${n}|${o}`;
}
