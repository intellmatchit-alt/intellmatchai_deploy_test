/**
 * Deal Matching — Hybrid Retrieval (v4.1)
 *
 * Computes a retrievalScore + retrievalBreakdown for each candidate BEFORE
 * deterministic scoring. Composition (per spec):
 *   retrievalScore = 0.40 * structured + 0.20 * lexical + 0.25 * semantic + 0.15 * network
 *
 * - structured: hard structured filters (category/industry/budget/delivery/location/data quality)
 * - lexical:   token overlap on free-text fields (whatYouNeed ↔ offering, requirements ↔ capabilities, profile ↔ ICP)
 * - semantic:  embedding cosine if both records have embeddings, else degraded to lexical
 * - network:   NetworkContext-derived path strength
 *
 * If embeddings are missing on either side, the semantic sub-score falls
 * back to a damped lexical signal (no fake neutral 50). The breakdown
 * exposes which sub-scores actually fired.
 */

import { BuyRequest, SellOffering, areBudgetsCompatible } from './types';
import { RetrievalBreakdown, calculateTagOverlap, textSimilarity } from './common';
import { NetworkContext } from './network.utils';

const W_STRUCTURED = 0.40;
const W_LEXICAL = 0.20;
const W_SEMANTIC = 0.25;
const W_NETWORK = 0.15;

function clamp01to100(x: number): number {
  if (Number.isNaN(x) || !Number.isFinite(x)) return 0;
  return Math.max(0, Math.min(100, Math.round(x)));
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (!a?.length || !b?.length || a.length !== b.length) return 0;
  let dot = 0; let nA = 0; let nB = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; nA += a[i] * a[i]; nB += b[i] * b[i]; }
  if (nA === 0 || nB === 0) return 0;
  return dot / (Math.sqrt(nA) * Math.sqrt(nB));
}

// ---------------------------------------------------------------------------
// Structured sub-score
// ---------------------------------------------------------------------------

function structuredSubScore(buy: BuyRequest, sell: SellOffering): { score: number; evidence: string[] } {
  const evidence: string[] = [];
  let pts = 0; let max = 0;

  // Active / not deleted (gate)
  max += 10;
  if (buy.isActive && sell.isActive && !buy.isDeleted && !sell.isDeleted) {
    pts += 10;
    evidence.push('Both records active');
  }

  // Solution category
  max += 25;
  if (buy.solutionCategory === sell.solutionCategory) {
    pts += 25;
    evidence.push('Exact solutionCategory match');
  }

  // Provider type
  max += 10;
  if (buy.providerType === sell.providerType) {
    pts += 10;
    evidence.push('providerType matches');
  }

  // Industry overlap
  max += 15;
  const indOverlap = calculateTagOverlap(buy.relevantIndustry, sell.industryFocus);
  if (indOverlap.score >= 50) { pts += 15; evidence.push('Strong industry overlap'); }
  else if (indOverlap.score >= 25) { pts += 8; evidence.push('Partial industry overlap'); }

  // Delivery mode
  max += 10;
  const caps = sell.deliveryModeCapability || [];
  if (!buy.deliveryMode || !caps.length || caps.includes(buy.deliveryMode)) {
    pts += 10;
    if (buy.deliveryMode && caps.includes(buy.deliveryMode)) evidence.push(`Delivery mode ${buy.deliveryMode} supported`);
  }

  // Budget compatibility
  max += 15;
  const budget = areBudgetsCompatible(buy.budgetRange, sell.priceRange);
  if (budget.compatible && budget.gap === 'EXACT') { pts += 15; evidence.push('Exact budget band'); }
  else if (budget.compatible) { pts += 10; evidence.push(`Budget compatible (${budget.gap})`); }

  // Capabilities vs requirements (header-level, full match check happens later)
  max += 10;
  const reqs = buy.mustHaveRequirements || [];
  const caps2 = sell.capabilities || [];
  if (!reqs.length) { pts += 5; }
  else if (caps2.length) {
    const overlap = calculateTagOverlap(reqs, caps2);
    if (overlap.score >= 50) { pts += 10; evidence.push('Capability list covers requirements'); }
    else if (overlap.score >= 25) { pts += 5; }
  }

  // Data quality threshold
  max += 5;
  if ((buy.dataQualityScore || 0) >= 30 && (sell.dataQualityScore || 0) >= 30) {
    pts += 5;
  }

  return { score: clamp01to100((pts / max) * 100), evidence };
}

// ---------------------------------------------------------------------------
// Lexical sub-score (token-overlap on free text)
// ---------------------------------------------------------------------------

function lexicalSubScore(buy: BuyRequest, sell: SellOffering): { score: number; evidence: string[] } {
  const evidence: string[] = [];
  const a = textSimilarity(buy.whatYouNeed, [sell.productServiceName, sell.offeringSummary || '', sell.idealCustomerProfile || ''].join(' '));
  if (a >= 0.4) evidence.push('whatYouNeed strongly matches offering text');
  else if (a >= 0.2) evidence.push('whatYouNeed partially matches offering text');

  const reqs = (buy.mustHaveRequirements || []).join(' ');
  const caps = (sell.capabilities || []).join(' ') + ' ' + (sell.tags?.merged || []).join(' ');
  const b = reqs && caps ? textSimilarity(reqs, caps) : 0;
  if (b >= 0.4) evidence.push('Requirements strongly overlap capabilities');
  else if (b >= 0.2) evidence.push('Requirements partially overlap capabilities');

  let c = 0;
  if (buy.idealProviderProfile) {
    c = textSimilarity(buy.idealProviderProfile, [sell.offeringSummary || '', sell.productServiceName, sell.idealCustomerProfile || ''].join(' '));
    if (c >= 0.3) evidence.push('idealProviderProfile aligns with seller profile text');
  }

  // industry tag overlap
  const ind = calculateTagOverlap(buy.relevantIndustry, sell.industryFocus);
  if (ind.score >= 50) evidence.push(`Industry overlap (${ind.matched.join(', ')})`);

  const denom = buy.idealProviderProfile ? 4 : 3;
  const raw = (a + b + (buy.idealProviderProfile ? c : 0) + ind.score / 100) / denom;
  return { score: clamp01to100(raw * 100), evidence };
}

// ---------------------------------------------------------------------------
// Semantic sub-score (embedding cosine; fall back to damped lexical)
// ---------------------------------------------------------------------------

function semanticSubScore(buy: BuyRequest, sell: SellOffering): { score: number; usedEmbedding: boolean; evidence: string[] } {
  const evidence: string[] = [];
  if (Array.isArray(buy.embedding) && Array.isArray(sell.embedding) && buy.embedding.length === sell.embedding.length && buy.embedding.length > 0) {
    const cos = cosineSimilarity(buy.embedding, sell.embedding);
    // Cosine in [-1, 1]; map to [0, 100], clamp.
    const score = clamp01to100(((cos + 1) / 2) * 100);
    evidence.push(`Embedding cosine ${cos.toFixed(3)}`);
    return { score, usedEmbedding: true, evidence };
  }
  // Fallback: damped lexical similarity over the most semantic-looking field pair.
  const a = textSimilarity(buy.whatYouNeed, [sell.productServiceName, sell.offeringSummary || ''].join(' '));
  const b = buy.mustHaveRequirements?.length
    ? textSimilarity(buy.mustHaveRequirements.join(' '), (sell.capabilities || []).join(' '))
    : 0;
  const damped = ((a * 0.6) + (b * 0.4)) * 0.85; // damping so missing-embedding doesn't inflate
  evidence.push('No embeddings; degraded to lexical (damped 0.85)');
  return { score: clamp01to100(damped * 100), usedEmbedding: false, evidence };
}

// ---------------------------------------------------------------------------
// Network sub-score
// ---------------------------------------------------------------------------

function networkSubScore(ctx: NetworkContext | null): { score: number; evidence: string[] } {
  if (!ctx) return { score: 0, evidence: ['No network context provided'] };
  const evidence: string[] = [];
  let s = 0;
  if (ctx.isFirstDegree) { s += 60; evidence.push('1st-degree path'); }
  else if (ctx.isSecondDegree) { s += 35; evidence.push('2nd-degree path'); }
  if (ctx.sameOrganization) { s += 12; evidence.push('Same organization'); }
  if (ctx.mutualConnections >= 3) { s += 12; evidence.push(`${ctx.mutualConnections} mutuals`); }
  else if (ctx.mutualConnections >= 1) { s += 6; }
  s += Math.round(ctx.relationshipStrength * 16);
  if (ctx.relationshipStrength >= 0.8) evidence.push('Strong relationship');
  return { score: clamp01to100(s), evidence };
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

export function calculateRetrievalScore(
  buy: BuyRequest,
  sell: SellOffering,
  network: NetworkContext | null,
): RetrievalBreakdown {
  const struct = structuredSubScore(buy, sell);
  const lex = lexicalSubScore(buy, sell);
  const sem = semanticSubScore(buy, sell);
  const net = networkSubScore(network);

  const total =
    struct.score * W_STRUCTURED +
    lex.score * W_LEXICAL +
    sem.score * W_SEMANTIC +
    net.score * W_NETWORK;

  const evidence: string[] = [];
  for (const e of struct.evidence) evidence.push(`Structured: ${e}`);
  for (const e of lex.evidence) evidence.push(`Lexical: ${e}`);
  for (const e of sem.evidence) evidence.push(`Semantic: ${e}`);
  for (const e of net.evidence) evidence.push(`Network: ${e}`);

  return {
    structuredScore: struct.score,
    lexicalScore: lex.score,
    semanticScore: sem.score,
    networkScore: net.score,
    totalScore: clamp01to100(total),
    evidence,
  };
}

export const RETRIEVAL_WEIGHTS = {
  structured: W_STRUCTURED,
  lexical: W_LEXICAL,
  semantic: W_SEMANTIC,
  network: W_NETWORK,
};
