/**
 * Deal Matching — Network Relevance (v4.1)
 *
 * Captures the requester ↔ candidate relationship as a structured context
 * and turns it into a deterministic scoring component + a NetworkRelationship
 * object for the response. Pure functions — no DB access. Adapter layer is
 * responsible for filling NetworkContext from CRM/contact data.
 */

import { ScoringComponent } from './common';
import { DEFAULT_DEAL_WEIGHTS } from './types';

export interface NetworkContext {
  isFirstDegree: boolean;
  isSecondDegree: boolean;
  sameOrganization: boolean;
  mutualConnections: number;
  /** 0..1, derived externally from interactions/recency */
  relationshipStrength: number;
  interactionCount: number;
  lastInteractionDays: number | null;
  /** Pre-baked notes the explanation can pass through verbatim */
  notes?: string[];
}

export const NEUTRAL_NETWORK_CONTEXT: NetworkContext = {
  isFirstDegree: false,
  isSecondDegree: false,
  sameOrganization: false,
  mutualConnections: 0,
  relationshipStrength: 0,
  interactionCount: 0,
  lastInteractionDays: null,
  notes: [],
};

/**
 * Score a candidate's network position relative to the requester.
 * Returns a ScoringComponent for the deterministic engine and an
 * explanation string for the UI.
 */
export function calculateNetworkRelevanceScore(ctx: NetworkContext): ScoringComponent {
  const matched: string[] = [];
  const missing: string[] = [];
  const penalties: string[] = [];

  let base = 0;
  if (ctx.isFirstDegree) {
    base = 78;
    matched.push('1st-degree connection');
  } else if (ctx.isSecondDegree) {
    base = 58;
    matched.push('2nd-degree connection');
  } else {
    base = 30;
    missing.push('No direct or mutual connection');
  }

  if (ctx.sameOrganization) {
    base += 8;
    matched.push('Same organization');
  }

  if (ctx.mutualConnections >= 5) {
    base += 6;
    matched.push(`${ctx.mutualConnections} mutual connections`);
  } else if (ctx.mutualConnections >= 1) {
    base += 3;
    matched.push(`${ctx.mutualConnections} mutual connection${ctx.mutualConnections === 1 ? '' : 's'}`);
  }

  if (ctx.relationshipStrength >= 0.8) {
    base += 8;
    matched.push('Strong relationship');
  } else if (ctx.relationshipStrength >= 0.5) {
    base += 4;
  } else if (ctx.relationshipStrength > 0 && ctx.isFirstDegree) {
    matched.push('Direct connection, weak interaction history');
  }

  if (ctx.lastInteractionDays !== null) {
    if (ctx.lastInteractionDays <= 30) base += 3;
    else if (ctx.lastInteractionDays > 365) {
      base -= 4;
      penalties.push('No interaction in over a year');
    }
  }

  const score = Math.max(0, Math.min(100, Math.round(base)));
  const explanation = ctx.isFirstDegree
    ? `Direct (1st-degree) network match${ctx.relationshipStrength >= 0.5 ? ' with strong relationship' : ''}.`
    : ctx.isSecondDegree
      ? `2nd-degree network match via ${ctx.mutualConnections || 'shared'} mutual connection${ctx.mutualConnections === 1 ? '' : 's'}.`
      : 'No identified network path; surfaced via content match only.';

  // Confidence is high when we have explicit graph signals; low when we
  // had to fall back to "no path" defaults.
  const confidence = ctx.isFirstDegree ? 0.85 : ctx.isSecondDegree ? 0.7 : 0.45;

  return {
    name: 'networkRelevanceScore',
    score,
    weight: DEFAULT_DEAL_WEIGHTS.networkRelevanceScore,
    confidence,
    explanation,
    matchedItems: matched,
    missingItems: missing,
    penalties,
  };
}
