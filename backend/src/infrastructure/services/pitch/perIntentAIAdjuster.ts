/**
 * Per-LookingFor / matchIntent bounded AI adjuster for the pitch matching
 * pipeline.
 *
 * Runs AFTER deterministic scoring + per-target enrichment, and BEFORE the
 * controller responds. For each canonical match it makes ONE LLM call asking
 * the model to validate every selected intent's deterministic score and
 * propose a bounded adjustment per intent. Constraints enforced in code:
 *
 *   - never override hard-filter FAIL (deterministic engine wins)
 *   - never adjust by more than AI_MAX_SCORE_ADJUSTMENT in either direction
 *   - never invent score bands — getMatchTargetBand() runs after adjustment
 *   - LLM failure is non-fatal: scores stay deterministic
 *
 * The adjuster mutates each enriched match's `matchTargetScores` in place:
 * setting `aiScore`, recomputing `finalScore`/`matchLevel`, and appending
 * `aiReasoning`/`aiGreenFlags`/`aiRedFlags` strings. After all intents are
 * adjusted, totalScore + bestMatchTarget are recomputed so the displayed
 * top-line score matches the new max.
 */

import { LLMService } from '../../../shared/llm';
import { logger } from '../../../shared/logger';
import {
  AI_MAX_SCORE_ADJUSTMENT,
} from './v8/matching-bands.constants';
import {
  getMatchTargetBand,
  MATCH_TARGET_LABELS,
  MatchTargetType,
} from './pitchTargetScorer';

const SYSTEM_PROMPT =
  'You are a strict matching auditor for the IntellMatch pitch engine. ' +
  'Your job is to validate deterministic scores per Looking For type and ' +
  'propose bounded adjustments. Always respond with valid JSON only.';

interface PerIntentAdjustment {
  intent: string;
  delta: number;
  confidence: number;
  reasoning: string;
  greenFlags: string[];
  redFlags: string[];
}

interface AdjustmentBatch {
  contactId: string;
  adjustments: PerIntentAdjustment[];
}

let llmServiceSingleton: LLMService | null = null;
function getLlm(): LLMService {
  if (!llmServiceSingleton) {
    llmServiceSingleton = new LLMService(SYSTEM_PROMPT);
  }
  return llmServiceSingleton;
}

/**
 * Apply bounded per-intent AI adjustments to every canonical match in place.
 * Returns the same array for chainability. Best-effort: if AI is unavailable
 * or any single contact prompt fails, that contact keeps deterministic scores.
 */
export async function applyPerIntentAIAdjustments(
  pitch: {
    title?: string | null;
    summary?: string | null;
    detailedDesc?: string | null;
    stage?: string | null;
    category?: string | null;
    matchIntent?: string[];
  },
  enrichedMatches: any[],
): Promise<any[]> {
  if (!Array.isArray(enrichedMatches) || enrichedMatches.length === 0) {
    return enrichedMatches;
  }

  const llm = getLlm();
  if (!llm.isAvailable()) {
    logger.debug('Per-intent AI adjuster skipped — LLM not available');
    return enrichedMatches;
  }

  const t0 = Date.now();
  let adjustedContacts = 0;
  let totalIntents = 0;

  // Run sequentially with bounded concurrency to avoid spiking provider rate
  // limits. Five at a time is plenty for typical pitch result sizes (≤50).
  const concurrency = 5;
  let i = 0;
  while (i < enrichedMatches.length) {
    const slice = enrichedMatches.slice(i, i + concurrency);
    await Promise.all(
      slice.map(async (m) => {
        const targets: any[] = Array.isArray(m?.matchTargetScores)
          ? m.matchTargetScores
          : [];
        if (targets.length === 0) return;

        // Skip when ALL intents already failed hard filters — AI cannot
        // override hard-filter FAIL anyway, and we save an LLM call.
        const anyAdjustable = targets.some(
          (t) => t?.hardFilterStatus !== 'FAIL',
        );
        if (!anyAdjustable) return;

        try {
          const batch = await requestAdjustmentsForContact(llm, pitch, m, targets);
          if (!batch) return;

          let mutated = false;
          for (const adj of batch.adjustments) {
            const target = targets.find(
              (t) => String(t.matchTarget) === String(adj.intent),
            );
            if (!target) continue;

            // Hard rule: never override hard-filter FAIL.
            if (target.hardFilterStatus === 'FAIL') continue;

            const determ = Number(target.deterministicScore ?? target.score ?? 0);
            const clampedDelta = clamp(
              adj.delta,
              -AI_MAX_SCORE_ADJUSTMENT,
              AI_MAX_SCORE_ADJUSTMENT,
            );
            const newFinal = clamp(determ + clampedDelta, 0, 100);
            const aiScore = clampedDelta; // signed delta, the "AI contribution"

            target.aiScore = aiScore;
            target.finalScore = newFinal;
            target.score = newFinal;
            target.matchLevel = getMatchTargetBand(newFinal);
            target.confidence =
              typeof adj.confidence === 'number' && isFinite(adj.confidence)
                ? clamp(adj.confidence, 0, 1)
                : (target.confidence ?? 0.5);

            target.aiReasoning = sanitizeString(adj.reasoning, 500);
            target.aiGreenFlags = sanitizeStringArray(adj.greenFlags, 5);
            target.aiRedFlags = sanitizeStringArray(adj.redFlags, 5);

            mutated = true;
            totalIntents++;
          }

          if (mutated) {
            // Re-pick the best target and re-stamp the carrier match.
            recomputeBestAndTotal(m, targets);
            adjustedContacts++;
          }
        } catch (err) {
          logger.debug('Per-intent AI adjustment failed for one contact', {
            contactId: m?.contact?.id,
            error: err instanceof Error ? err.message : err,
          });
        }
      }),
    );
    i += concurrency;
  }

  logger.info('Per-intent AI adjustment complete', {
    contacts: enrichedMatches.length,
    adjustedContacts,
    totalIntentsAdjusted: totalIntents,
    elapsedMs: Date.now() - t0,
  });

  return enrichedMatches;
}

async function requestAdjustmentsForContact(
  llm: LLMService,
  pitch: any,
  match: any,
  targets: any[],
): Promise<AdjustmentBatch | null> {
  const contact = match?.contact ?? {};
  const intentList = targets.map((t) => ({
    intent: String(t.matchTarget),
    label: MATCH_TARGET_LABELS[t.matchTarget as MatchTargetType] ?? t.label,
    deterministicScore: Math.round(t.deterministicScore ?? t.score ?? 0),
    hardFilterStatus: t.hardFilterStatus ?? 'PASS',
    hardFilterReason: t.hardFilterReason ?? '',
    matchedSignals: Array.isArray(t.matchedSignals) ? t.matchedSignals.slice(0, 6) : [],
    missingSignals: Array.isArray(t.missingSignals) ? t.missingSignals.slice(0, 6) : [],
    strengths: Array.isArray(t.strengths) ? t.strengths.slice(0, 5) : [],
    gaps: Array.isArray(t.gaps) ? t.gaps.slice(0, 5) : [],
  }));

  const prompt = `Validate per-intent deterministic scores for this pitch-contact pair.

PITCH:
- Title: ${pitch?.title ?? 'Unknown'}
- Stage: ${pitch?.stage ?? 'Unknown'}
- Category: ${pitch?.category ?? 'Unknown'}
- Summary: ${(pitch?.summary ?? '').toString().slice(0, 600)}

CONTACT:
- Name: ${contact?.fullName ?? 'Unknown'}
- Title: ${contact?.jobTitle ?? 'Unknown'}
- Company: ${contact?.company ?? 'Unknown'}

INTENTS TO VALIDATE (each has its own deterministic score):
${JSON.stringify(intentList, null, 2)}

Rules:
- Adjust each intent score by an integer DELTA in the range [-${AI_MAX_SCORE_ADJUSTMENT}, +${AI_MAX_SCORE_ADJUSTMENT}].
- Never propose a delta that would override a FAIL hard filter — set delta to 0 in that case.
- Be conservative when evidence is weak.
- Investor: prioritize traction, stage, ticket fit, sector relevance.
- Advisor: prioritize domain expertise, operator/board experience.
- Strategic Partner: prioritize distribution, integrations, market access.
- Co-founder: prioritize complementary skills, founder/builder evidence, mission fit.
- Customer / Buyer: prioritize ICP overlap, procurement authority, pilot evidence.

Respond ONLY with valid JSON of the shape:
{
  "adjustments": [
    {
      "intent": "INVESTOR",
      "delta": 0,
      "confidence": 0.0,
      "reasoning": "short, grounded explanation",
      "greenFlags": ["..."],
      "redFlags": ["..."]
    }
  ]
}`;

  const raw = await llm.callLLM(prompt, SYSTEM_PROMPT);
  if (!raw) return null;
  const json = raw.match(/\{[\s\S]*\}/)?.[0];
  if (!json) return null;

  let parsed: any;
  try {
    parsed = JSON.parse(json);
  } catch {
    return null;
  }
  if (!parsed?.adjustments || !Array.isArray(parsed.adjustments)) return null;

  const adjustments: PerIntentAdjustment[] = parsed.adjustments
    .map((a: any) => ({
      intent: String(a?.intent ?? '').trim().toUpperCase(),
      delta: Number(a?.delta ?? 0),
      confidence: Number(a?.confidence ?? 0.5),
      reasoning: String(a?.reasoning ?? ''),
      greenFlags: Array.isArray(a?.greenFlags) ? a.greenFlags.map(String) : [],
      redFlags: Array.isArray(a?.redFlags) ? a.redFlags.map(String) : [],
    }))
    .filter((a: PerIntentAdjustment) => a.intent && isFinite(a.delta));

  return { contactId: contact?.id ?? '', adjustments };
}

/**
 * After per-intent adjustments mutate `matchTargetScores`, the carrier match
 * needs its top-line totalScore + bestMatchTarget re-derived. We use the same
 * tie-break the read-side scorer uses: max finalScore, then highest confidence.
 */
function recomputeBestAndTotal(match: any, targets: any[]): void {
  if (!targets.length) return;

  // Reset all isBestMatchTarget flags first.
  for (const t of targets) t.isBestMatchTarget = false;

  let best = targets[0];
  for (const t of targets) {
    const tFinal = Number(t.finalScore ?? t.score ?? 0);
    const bFinal = Number(best.finalScore ?? best.score ?? 0);
    if (tFinal > bFinal) {
      best = t;
    } else if (tFinal === bFinal) {
      const tConf = Number(t.confidence ?? 0);
      const bConf = Number(best.confidence ?? 0);
      if (tConf > bConf) best = t;
    }
  }
  best.isBestMatchTarget = true;

  const totalScore = Math.round(Number(best.finalScore ?? best.score ?? 0));
  match.totalScore = totalScore;
  match.score = totalScore;
  match.finalScore = totalScore;
  match.matchLevel = best.matchLevel ?? getMatchTargetBand(totalScore);
  match.bestMatchTarget = best.matchTarget;
  match.selectedIntent = best.matchTarget;

  if (match.overallExplanation && typeof match.overallExplanation === 'object') {
    match.overallExplanation.totalScore = totalScore;
    match.overallExplanation.matchLevel = match.matchLevel;
    match.overallExplanation.bestMatchTarget = best.matchTarget;
    if (best.aiReasoning) {
      match.overallExplanation.aiContribution = best.aiReasoning;
    }
  }
}

function clamp(n: number, lo: number, hi: number): number {
  if (!isFinite(n)) return lo;
  return Math.max(lo, Math.min(hi, Math.round(n)));
}

function sanitizeString(val: unknown, maxLen: number): string {
  if (typeof val !== 'string') return '';
  return val.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, '').slice(0, maxLen);
}

function sanitizeStringArray(val: unknown, maxItems: number): string[] {
  if (!Array.isArray(val)) return [];
  return val
    .filter((i): i is string => typeof i === 'string')
    .map((s) => sanitizeString(s, 200))
    .slice(0, maxItems);
}
