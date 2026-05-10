/**
 * Deal Matching — Helper Scoring (v4.1)
 *
 * Six-component scorer for helper matches. All components return a
 * ScoringComponent so they slot into the same scoreBreakdown shape used by
 * the direct engine. Helper score answers "can this person help make this
 * deal happen?" — NOT "is this person the buyer/seller". Components:
 *
 *   - relationshipTrustScore  : how solid is the requester ↔ helper bond
 *   - introPathScore          : how plausible is a warm intro
 *   - roleInfluenceScore      : helper's seniority / decision influence
 *   - commercialPathRelevance : helper's role in the deal pipeline
 *   - helperNetworkStrength   : breadth and reachability of helper's network
 *   - requesterNeedFit        : helper's domain alignment with the deal request
 */

import { BuyRequest, SellOffering } from './types';
import { ScoringComponent, ScoreBreakdown, FieldMatch, clampScore } from './common';
import {
  HelperCandidate, HelperType, HelperMatchMode, DEFAULT_HELPER_WEIGHTS,
  HelperScoringWeights,
} from './helper-types';

const ROLE_AREA_PIPELINE = new Set([
  'sales', 'business development', 'partnerships', 'procurement', 'sourcing',
  'vendor management', 'account management', 'channel', 'alliances', 'marketing',
]);

const ROLE_AREA_BUYER_SIDE = new Set([
  'procurement', 'sourcing', 'vendor management', 'finance', 'operations',
  'it', 'engineering', 'product', 'cto office',
]);

const ROLE_AREA_SELLER_SIDE = new Set([
  'sales', 'business development', 'partnerships', 'channel', 'alliances',
  'pre-sales', 'solutions', 'customer success',
]);

function scoringComponent(
  name: string, score: number, weight: number, confidence: number,
  explanation: string, matched: string[] = [], missing: string[] = [], penalties: string[] = [],
): ScoringComponent {
  return { name, score: clampScore(score), weight, confidence, explanation, matchedItems: matched, missingItems: missing, penalties };
}

// ---------------------------------------------------------------------------
// Relationship trust — interaction count, recency, mutuals, same-org boost
// ---------------------------------------------------------------------------

export function relationshipTrustScore(c: HelperCandidate): ScoringComponent {
  const matched: string[] = [];
  const missing: string[] = [];
  const penalties: string[] = [];

  let s = 0;
  if (c.isFirstDegree) { s += 50; matched.push('1st-degree connection'); }
  else if (c.isSecondDegree) { s += 25; matched.push('2nd-degree via mutual'); }
  else { missing.push('No direct or mutual path'); }

  s += Math.round(c.relationshipStrength * 30);
  if (c.relationshipStrength >= 0.8) matched.push('Strong relationship');
  else if (c.relationshipStrength >= 0.5) matched.push('Moderate relationship');

  if (c.interactionCount >= 5) { s += 8; matched.push(`${c.interactionCount} interactions`); }
  else if (c.interactionCount >= 1) s += 4;

  if (c.lastInteractionDays === null) { penalties.push('No recorded interaction'); s -= 5; }
  else if (c.lastInteractionDays > 365) { penalties.push('No interaction in over a year'); s -= 6; }
  else if (c.lastInteractionDays <= 30) s += 5;

  const explanation = c.isFirstDegree
    ? `Direct connection${c.relationshipStrength >= 0.6 ? ' with strong relationship history' : ''}.`
    : c.isSecondDegree
      ? `2nd-degree connection via ${c.mutualConnections || 'shared'} mutual${c.mutualConnections === 1 ? '' : 's'}.`
      : 'No direct relationship — trust signal is low.';

  const confidence = c.isFirstDegree ? 0.85 : c.isSecondDegree ? 0.72 : 0.5;
  return scoringComponent('relationshipTrustScore', s, DEFAULT_HELPER_WEIGHTS.relationshipTrust, confidence, explanation, matched, missing, penalties);
}

// ---------------------------------------------------------------------------
// Intro path — likelihood of a warm intro working
// ---------------------------------------------------------------------------

export function introPathScore(c: HelperCandidate, mode: HelperMatchMode): ScoringComponent {
  const matched: string[] = [];
  const missing: string[] = [];
  let s = 0;

  if (c.worksAtTargetOrg) { s += 70; matched.push('Works at target counterparty organization'); }
  else if (c.targetRoleProximity === 'DIRECT') { s += 55; matched.push('Direct role proximity to counterparty'); }
  else if (c.targetRoleProximity === 'ADJACENT') { s += 40; matched.push('Adjacent role proximity'); }
  else missing.push('No identified path to a specific counterparty');

  if (c.mutualConnections >= 5) { s += 15; matched.push(`${c.mutualConnections} mutual connections`); }
  else if (c.mutualConnections >= 1) s += 8;

  if (c.relationshipStrength >= 0.7) s += 10;

  const counterparty = mode === 'BUY_TO_SELLER_HELPERS' ? 'seller/provider' : 'buyer';
  const explanation = c.worksAtTargetOrg
    ? `Inside the target ${counterparty} organization — likely to make an effective intro.`
    : c.targetRoleProximity === 'DIRECT'
      ? `Direct role proximity to typical ${counterparty} contacts.`
      : c.targetRoleProximity === 'ADJACENT'
        ? `Adjacent to ${counterparty}-side roles.`
        : `Could potentially route via ${c.mutualConnections} mutual${c.mutualConnections === 1 ? '' : 's'}, but no direct path.`;

  const confidence = c.worksAtTargetOrg ? 0.85 : c.targetRoleProximity === 'DIRECT' ? 0.72 : 0.5;
  return scoringComponent('introPathScore', s, DEFAULT_HELPER_WEIGHTS.introPath, confidence, explanation, matched, missing);
}

// ---------------------------------------------------------------------------
// Role influence — seniority + decision power in the buying/selling chain
// ---------------------------------------------------------------------------

export function roleInfluenceScore(c: HelperCandidate): ScoringComponent {
  const seniority = c.seniorityHints || [];
  const matched: string[] = [];
  let s = 30;
  if (seniority.includes('EXECUTIVE')) { s = 90; matched.push('Executive seniority'); }
  else if (seniority.includes('SENIOR')) { s = 75; matched.push('Senior seniority'); }
  else if (seniority.includes('MID')) { s = 55; matched.push('Mid-level seniority'); }

  if ((c.jobTitleAreas || []).some(a => ROLE_AREA_PIPELINE.has(a))) { s += 6; matched.push('Pipeline role'); }

  const explanation = seniority.includes('EXECUTIVE')
    ? 'Executive-level helper — strong influence over deal decisions.'
    : seniority.includes('SENIOR')
      ? 'Senior helper — meaningful influence in the decision chain.'
      : 'Limited evidence of direct decision-making influence.';
  return scoringComponent('roleInfluenceScore', s, DEFAULT_HELPER_WEIGHTS.roleInfluence, 0.62, explanation, matched);
}

// ---------------------------------------------------------------------------
// Commercial path relevance — does the helper sit on the deal pipeline?
// ---------------------------------------------------------------------------

export function commercialPathRelevanceScore(c: HelperCandidate, mode: HelperMatchMode): ScoringComponent {
  const areas = (c.jobTitleAreas || []).map(a => a.toLowerCase());
  const isBuyerSearch = mode === 'BUY_TO_SELLER_HELPERS';
  // For BUY_TO_SELLER_HELPERS, helper should be near seller-side or pipeline roles.
  // For SELL_TO_BUYER_HELPERS, helper should be near buyer-side or pipeline roles.
  const targetSet = isBuyerSearch ? ROLE_AREA_SELLER_SIDE : ROLE_AREA_BUYER_SIDE;
  const matched: string[] = [];
  let s = 30;
  for (const a of areas) {
    if (targetSet.has(a)) { s += 18; matched.push(`Role: ${a}`); }
    else if (ROLE_AREA_PIPELINE.has(a)) { s += 8; matched.push(`Role: ${a}`); }
  }
  if (c.worksAtTargetOrg) { s += 12; matched.push('Inside target organization'); }
  s = Math.min(s, 100);
  const counterparty = isBuyerSearch ? 'seller-side' : 'buyer-side';
  const explanation = matched.length
    ? `Sits on the ${counterparty} commercial path.`
    : `No clear ${counterparty} commercial-path role evidence.`;
  return scoringComponent('commercialPathRelevanceScore', s, DEFAULT_HELPER_WEIGHTS.commercialPathRelevance, 0.6, explanation, matched);
}

// ---------------------------------------------------------------------------
// Helper network strength — does the helper's network breadth matter?
// ---------------------------------------------------------------------------

export function helperNetworkStrengthScore(c: HelperCandidate): ScoringComponent {
  let s = 40;
  const matched: string[] = [];
  if (c.mutualConnections >= 10) { s = 90; matched.push(`${c.mutualConnections} mutual connections`); }
  else if (c.mutualConnections >= 5) { s = 75; matched.push(`${c.mutualConnections} mutual connections`); }
  else if (c.mutualConnections >= 2) { s = 60; matched.push(`${c.mutualConnections} mutual connections`); }
  if ((c.industries || []).length >= 3) { s += 4; matched.push('Active in multiple industries'); }
  s = Math.min(s, 100);
  const explanation = c.mutualConnections >= 5
    ? 'Helper has strong network breadth — good route to introductions.'
    : 'Limited network signal for this helper.';
  return scoringComponent('helperNetworkStrengthScore', s, DEFAULT_HELPER_WEIGHTS.helperNetworkStrength, 0.55, explanation, matched);
}

// ---------------------------------------------------------------------------
// Requester need fit — helper domain alignment with the deal subject
// ---------------------------------------------------------------------------

export function requesterNeedFitScore(c: HelperCandidate, deal: { industries: string[]; subject: string }): ScoringComponent {
  const helperIndustries = (c.industries || []).map(i => i.toLowerCase());
  const dealIndustries = (deal.industries || []).map(i => i.toLowerCase());
  const matched: string[] = [];
  let overlap = 0;
  for (const di of dealIndustries) if (helperIndustries.includes(di)) { overlap++; matched.push(di); }
  let s = dealIndustries.length === 0
    ? 50
    : Math.round((overlap / dealIndustries.length) * 100);
  // Bio/title text alignment
  const text = `${c.bio || ''} ${c.jobTitle || ''}`.toLowerCase();
  if (deal.subject && text.includes(deal.subject.toLowerCase().slice(0, 40))) { s += 8; matched.push('Profile mentions subject area'); }
  s = Math.min(s, 100);
  const explanation = overlap > 0
    ? `Helper's industries include ${matched.slice(0, 3).join(', ')}.`
    : 'No clear industry overlap with the deal request.';
  return scoringComponent('requesterNeedFitScore', s, DEFAULT_HELPER_WEIGHTS.requesterNeedFit, overlap > 0 ? 0.7 : 0.45, explanation, matched);
}

// ---------------------------------------------------------------------------
// Helper type classification — pick label based on signals
// ---------------------------------------------------------------------------

export function classifyHelperType(c: HelperCandidate, mode: HelperMatchMode): HelperType {
  const areas = (c.jobTitleAreas || []).map(a => a.toLowerCase());
  const seniority = c.seniorityHints || [];
  if (c.worksAtTargetOrg) return HelperType.INSIDER;
  if (areas.includes('partnerships') || areas.includes('channel') || areas.includes('alliances')) return HelperType.BROKER;
  if (areas.includes('consulting') || areas.includes('advisory')) return HelperType.ADVOCATE;
  if (seniority.includes('EXECUTIVE') || seniority.includes('SENIOR')) return HelperType.INFLUENCER;
  return HelperType.INTRODUCER;
}

// ---------------------------------------------------------------------------
// Aggregator — combines components into a finalScore + breakdown
// ---------------------------------------------------------------------------

export function calculateHelperScore(
  c: HelperCandidate,
  mode: HelperMatchMode,
  deal: { industries: string[]; subject: string },
  weights: HelperScoringWeights = DEFAULT_HELPER_WEIGHTS,
): { deterministicScore: number; breakdown: ScoreBreakdown; fieldMatches: FieldMatch[] } {
  const components: ScoringComponent[] = [
    relationshipTrustScore(c),
    introPathScore(c, mode),
    roleInfluenceScore(c),
    commercialPathRelevanceScore(c, mode),
    helperNetworkStrengthScore(c),
    requesterNeedFitScore(c, deal),
  ];

  let totalScore = 0; let totalWeight = 0;
  const allPenalties: string[] = [];
  for (const comp of components) {
    const w = weights[componentNameToKey(comp.name)] ?? comp.weight;
    totalScore += comp.score * w; totalWeight += w;
    for (const p of comp.penalties) allPenalties.push(p);
  }
  const raw = totalWeight > 0 ? totalScore / totalWeight : 0;
  const deterministicScore = clampScore(raw);
  const confidence = components.length ? components.reduce((s, c2) => s + c2.confidence, 0) / components.length : 0;

  const fieldMatches: FieldMatch[] = [
    { source_field: 'requester', target_field: 'helper.relationship', source_value: 'requester', target_value: c.relationshipStrength, match_type: c.isFirstDegree ? 'EXACT' : 'PARTIAL', score: components[0].score },
    { source_field: 'targetCounterparty', target_field: 'helper.organization', source_value: c.worksAtTargetOrg ? 'INSIDE' : 'OUTSIDE', target_value: c.company, match_type: c.worksAtTargetOrg ? 'EXACT' : 'PARTIAL', score: components[1].score },
  ];

  return {
    deterministicScore,
    breakdown: {
      components, rawScore: raw, normalizedScore: deterministicScore,
      confidence, totalWeight, missingComponents: [], penalties: allPenalties,
    },
    fieldMatches,
  };
}

function componentNameToKey(name: string): keyof HelperScoringWeights {
  switch (name) {
    case 'relationshipTrustScore': return 'relationshipTrust';
    case 'introPathScore': return 'introPath';
    case 'roleInfluenceScore': return 'roleInfluence';
    case 'commercialPathRelevanceScore': return 'commercialPathRelevance';
    case 'helperNetworkStrengthScore': return 'helperNetworkStrength';
    case 'requesterNeedFitScore': return 'requesterNeedFit';
    default: return 'relationshipTrust';
  }
}

// ---------------------------------------------------------------------------
// Helper-specific hard filters
// ---------------------------------------------------------------------------

export function helperHardFilterStatus(c: HelperCandidate): { ok: boolean; reason: string | null } {
  if (!c.isFirstDegree && !c.isSecondDegree && c.mutualConnections === 0 && !c.worksAtTargetOrg) {
    return { ok: false, reason: 'No identifiable network path to the counterparty.' };
  }
  if (c.relationshipStrength === 0 && c.interactionCount === 0 && !c.worksAtTargetOrg) {
    return { ok: false, reason: 'No interaction history and no target-org affiliation.' };
  }
  return { ok: true, reason: null };
}
