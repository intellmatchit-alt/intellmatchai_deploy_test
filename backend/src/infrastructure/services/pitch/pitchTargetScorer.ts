/**
 * Per-Match-Target Scoring for the Pitch Matching Engine.
 *
 * Mirrors the project Looking-For per-type scorer
 * (lookingForEnhancedScorer.ts) but uses the pitch engine's MatchIntent
 * vocabulary (INVESTOR / ADVISOR / STRATEGIC_PARTNER / COFOUNDER /
 * CUSTOMER_BUYER). Each contact selected for evaluation produces ONE
 * matchTargetScores item per Match Target the user selected, and the
 * headline totalScore is the maximum of those per-target final scores.
 *
 * Internally we delegate the per-target keyword tier to the existing
 * `scoreLookingForRoles()` helper because the underlying scorer recognises
 * all five Match Intent vocabulary words (investor, advisor,
 * strategic_partner, cofounder_talent, customer). This lets the pitch
 * engine reuse the lookingFor knowledge base without re-implementing the
 * regex tiers, while keeping the response shape pitch-specific.
 *
 * @module infrastructure/services/pitch/pitchTargetScorer
 */

import {
  scoreLookingForRoles,
  blendWithSemantic,
  type ContactScoringInput,
  type ProjectScoringInput,
} from "../../external/projects/lookingForRoleScorer";
import { MatchIntent } from "./v8/pitch-matching.types";

// ────────────────────────────────────────────────────────────────────────────
// PUBLIC TYPES — pitch Match Target vocabulary
// ────────────────────────────────────────────────────────────────────────────

/**
 * Canonical Match Target type. Identical values to the existing
 * MatchIntent enum so this is a structural alias — callers can pass
 * MatchIntent values where MatchTargetType is expected and vice versa.
 */
export type MatchTargetType = MatchIntent;
export const MatchTargetType = MatchIntent;

/**
 * Map a Match Target to the lookingFor keyword scorer ID (the lookingFor
 * scorer recognises a different set of strings, so each Match Intent
 * is wired to the closest equivalent role scorer).
 */
const TARGET_TO_LOOKING_FOR_ID: Record<MatchTargetType, string> = {
  [MatchTargetType.INVESTOR]: "investor",
  [MatchTargetType.ADVISOR]: "advisor",
  [MatchTargetType.STRATEGIC_PARTNER]: "strategic_partner",
  [MatchTargetType.COFOUNDER]: "cofounder_talent",
  [MatchTargetType.CUSTOMER_BUYER]: "customer",
};

/** Human-readable labels exposed to the frontend. */
export const MATCH_TARGET_LABELS: Record<MatchTargetType, string> = {
  [MatchTargetType.INVESTOR]: "Investor",
  [MatchTargetType.ADVISOR]: "Advisor",
  [MatchTargetType.STRATEGIC_PARTNER]: "Strategic Partner",
  [MatchTargetType.COFOUNDER]: "Co-founder",
  [MatchTargetType.CUSTOMER_BUYER]: "Customer / Buyer",
};

/** Per-target hard filter outcome. WARN does NOT exclude. FAIL forces 0. */
export type MatchTargetHardFilterStatus = "PASS" | "WARN" | "FAIL";

/** Per-target hard filter reason codes. */
export type MatchTargetHardFilterReason =
  | "NONE"
  | "NO_TARGET_SIGNAL"
  | "LIMITED_INVESTOR_EVIDENCE"
  | "LIMITED_ADVISOR_EVIDENCE"
  | "LIMITED_PARTNER_EVIDENCE"
  | "LIMITED_COFOUNDER_EVIDENCE"
  | "LIMITED_CUSTOMER_EVIDENCE"
  | "BLOCKED"
  | "OPT_OUT";

/** Spec-mandated global match bands — different from the v8 pitch bands. */
export type MatchTargetBand =
  | "WEAK"
  | "PARTIAL"
  | "GOOD"
  | "VERY_GOOD"
  | "EXCELLENT";

/** Bounded per-target AI adjustment limit (±15). */
export const MATCH_TARGET_AI_MAX_DELTA = 15;

/** Detailed score for a single Match Target. */
export interface MatchTargetScoreDetail {
  matchTarget: MatchTargetType;
  intent: MatchTargetType;
  label: string;
  /** Deterministic-only score (0..100), pre-AI. */
  score: number;
  /** Same value as `score` — kept for explicit naming in API contract. */
  deterministicScore: number;
  /** Final score (deterministic + bounded AI delta), 0..100. */
  finalScore: number;
  /** Match band derived from finalScore. */
  matchLevel: MatchTargetBand;
  /** 0..1 confidence in this target's score. */
  confidence: number;
  hardFilterStatus: MatchTargetHardFilterStatus;
  hardFilterReason: MatchTargetHardFilterReason;
  hardFilterDetails: string;
  isBestMatchTarget: boolean;
  scoreBreakdown: {
    keywordTier: number;
    semanticTier: number;
    overlapBonus: number;
    aiDelta: number;
  };
  strengths: string[];
  gaps: string[];
  matchedSignals: string[];
  missingSignals: string[];
  greenFlags: string[];
  redFlags: string[];
  explanation: string;
  aiScore?: number | null;
  aiReasoning?: string;
  aiAdjustmentBounded?: boolean;
}

/** Overall, combined explanation describing the totalScore. */
export interface MatchTargetOverallExplanation {
  summary: string;
  bestMatchTarget: MatchTargetType | null;
  totalScoreRule: string;
}

/** Fully-enriched per-target result for one contact. */
export interface EnrichedMatchTargetResult {
  selectedMatchTargets: MatchTargetType[];
  matchTargetScores: MatchTargetScoreDetail[];
  totalScore: number;
  bestMatchTarget: MatchTargetType | null;
  overallExplanation: MatchTargetOverallExplanation;
  legacyScoresMap: Record<string, number>;
  legacyLabelsMap: Record<string, string>;
}

/** Optional bounded AI adjustment input per Match Target. */
export interface MatchTargetAIAdjustment {
  matchTarget: MatchTargetType;
  aiScoreDelta: number;
  aiReasoning?: string;
  greenFlags?: string[];
  redFlags?: string[];
}

// ────────────────────────────────────────────────────────────────────────────
// HELPERS
// ────────────────────────────────────────────────────────────────────────────

const VALID_TARGETS = new Set<MatchTargetType>(Object.values(MatchTargetType));

/** Convert any accepted form (canonical UPPER_SNAKE) to the canonical type. */
export function toMatchTargetType(input: string): MatchTargetType | null {
  if (!input) return null;
  const upper = input.toUpperCase();
  return VALID_TARGETS.has(upper as MatchTargetType)
    ? (upper as MatchTargetType)
    : null;
}

/** Normalize a freeform string[] into canonical MatchTargetType[], deduped. */
export function normalizeSelectedMatchTargets(
  input: unknown,
): MatchTargetType[] {
  if (!Array.isArray(input)) return [];
  const out: MatchTargetType[] = [];
  const seen = new Set<MatchTargetType>();
  for (const raw of input) {
    if (typeof raw !== "string") continue;
    const t = toMatchTargetType(raw);
    if (t && !seen.has(t)) {
      seen.add(t);
      out.push(t);
    }
  }
  return out;
}

/** Map a Match Target to its label. */
export function getMatchTargetLabel(t: MatchTargetType): string {
  return MATCH_TARGET_LABELS[t] ?? String(t);
}

/**
 * Map a finalScore in [0,100] to the global Match Target band.
 *
 *   WEAK:      0 – 39
 *   PARTIAL:  40 – 54
 *   GOOD:     55 – 69
 *   VERY_GOOD:70 – 84
 *   EXCELLENT:85 – 100
 *
 * No POOR / STRONG bands — the v8 engine still emits its own MatchLevel
 * for backward-compat fields, but per-target scoring uses the spec bands.
 */
export function getMatchTargetBand(score: number): MatchTargetBand {
  const s = Math.max(0, Math.min(100, Math.round(score)));
  if (s >= 85) return "EXCELLENT";
  if (s >= 70) return "VERY_GOOD";
  if (s >= 55) return "GOOD";
  if (s >= 40) return "PARTIAL";
  return "WEAK";
}

/** Apply the bounded AI delta. Returns the delta actually applied. */
export function clampMatchTargetAIDelta(
  rawDelta: number,
  maxDelta: number = MATCH_TARGET_AI_MAX_DELTA,
): number {
  if (!Number.isFinite(rawDelta)) return 0;
  return Math.max(-maxDelta, Math.min(maxDelta, rawDelta));
}

/**
 * Per-target hard filter. Lenient by default (most checks WARN, never
 * FAIL) so that a strong fit for ONE selected target isn't dropped because
 * of weak evidence for another. Hard blockers on the contact (BLOCKED /
 * OPT_OUT) FAIL every selected target.
 */
export function runMatchTargetHardFilters(
  target: MatchTargetType,
  keywordTierScore: number,
  semanticTierScore: number,
  flags: { blocked?: boolean; optedOut?: boolean } = {},
): {
  status: MatchTargetHardFilterStatus;
  reason: MatchTargetHardFilterReason;
  details: string;
} {
  if (flags.blocked) {
    return { status: "FAIL", reason: "BLOCKED", details: "Contact is blocked." };
  }
  if (flags.optedOut) {
    return {
      status: "FAIL",
      reason: "OPT_OUT",
      details: "Contact opted out of matching.",
    };
  }

  const bestSignal = Math.max(keywordTierScore, semanticTierScore);

  if (bestSignal <= 0) {
    return {
      status: "FAIL",
      reason: "NO_TARGET_SIGNAL",
      details: `No ${MATCH_TARGET_LABELS[target]} signal in title, company, or bio.`,
    };
  }

  if (bestSignal < 30) {
    const reason: MatchTargetHardFilterReason = (() => {
      switch (target) {
        case MatchTargetType.INVESTOR:
          return "LIMITED_INVESTOR_EVIDENCE";
        case MatchTargetType.ADVISOR:
          return "LIMITED_ADVISOR_EVIDENCE";
        case MatchTargetType.STRATEGIC_PARTNER:
          return "LIMITED_PARTNER_EVIDENCE";
        case MatchTargetType.COFOUNDER:
          return "LIMITED_COFOUNDER_EVIDENCE";
        case MatchTargetType.CUSTOMER_BUYER:
          return "LIMITED_CUSTOMER_EVIDENCE";
      }
    })();
    return {
      status: "WARN",
      reason,
      details: `Limited ${MATCH_TARGET_LABELS[target]} evidence — score is best-effort.`,
    };
  }

  return { status: "PASS", reason: "NONE", details: "" };
}

/** Confidence is a function of signal magnitude and signal corroboration. */
export function computeMatchTargetConfidence(
  keywordTier: number,
  semanticTier: number,
  overlapBonus: number,
): number {
  const base = Math.max(keywordTier, semanticTier) / 100;
  const corroboration = Math.min(keywordTier, semanticTier) / 100;
  const overlap = Math.min(1, overlapBonus / 50);
  const raw = base * 0.6 + corroboration * 0.25 + overlap * 0.15;
  return Math.max(0, Math.min(1, Number(raw.toFixed(3))));
}

// ────────────────────────────────────────────────────────────────────────────
// EXPLANATION BUILDERS
// ────────────────────────────────────────────────────────────────────────────

interface MatchTargetExplanationContext {
  target: MatchTargetType;
  contact: ContactScoringInput;
  pitch?: ProjectScoringInput;
  keywordTier: number;
  semanticTier: number;
  overlapBonus: number;
  finalScore: number;
  matchLevel: MatchTargetBand;
  hardFilter: {
    status: MatchTargetHardFilterStatus;
    reason: MatchTargetHardFilterReason;
  };
  aiReasoning?: string;
  aiGreenFlags?: string[];
  aiRedFlags?: string[];
}

function describeMatchedSkills(
  pitch: ProjectScoringInput | undefined,
  contact: ContactScoringInput,
): string[] {
  if (!pitch?.skillIds?.length || !contact.skillIds?.length) return [];
  const projSet = new Set(pitch.skillIds);
  const contactNames = contact.skillNames || [];
  const out: string[] = [];
  contact.skillIds.forEach((id, idx) => {
    if (projSet.has(id)) {
      out.push(contactNames[idx] || id);
    }
  });
  return out;
}

function describeMatchedSectorsCount(
  pitch: ProjectScoringInput | undefined,
  contact: ContactScoringInput,
): number {
  if (!pitch?.sectorIds?.length || !contact.sectorIds?.length) return 0;
  const projSet = new Set(pitch.sectorIds);
  return contact.sectorIds.filter((id) => projSet.has(id)).length;
}

export function buildPerMatchTargetExplanation(
  ctx: MatchTargetExplanationContext,
): Pick<
  MatchTargetScoreDetail,
  | "strengths"
  | "gaps"
  | "matchedSignals"
  | "missingSignals"
  | "greenFlags"
  | "redFlags"
  | "explanation"
> {
  const label = getMatchTargetLabel(ctx.target);
  const matchedSkills = describeMatchedSkills(ctx.pitch, ctx.contact);
  const matchedSectors = describeMatchedSectorsCount(ctx.pitch, ctx.contact);

  const strengths: string[] = [];
  const gaps: string[] = [];
  const matchedSignals: string[] = [];
  const missingSignals: string[] = [];
  const greenFlags: string[] = [...(ctx.aiGreenFlags ?? [])];
  const redFlags: string[] = [...(ctx.aiRedFlags ?? [])];

  if (ctx.keywordTier >= 80) {
    strengths.push(`Title strongly suggests a ${label} fit`);
    matchedSignals.push("title fit");
    greenFlags.push("Direct title match");
  } else if (ctx.keywordTier >= 50) {
    strengths.push(`Title has partial ${label} signal`);
    matchedSignals.push("partial title signal");
  } else if (ctx.keywordTier > 0) {
    matchedSignals.push("weak title signal");
    gaps.push(`Title only loosely indicates ${label}`);
  } else {
    missingSignals.push(`explicit ${label.toLowerCase()} title`);
    gaps.push(`No explicit ${label} title found`);
  }

  if (ctx.semanticTier >= 70) {
    strengths.push(`Profile description aligns with the ${label} role`);
    matchedSignals.push("semantic profile alignment");
    greenFlags.push("Profile semantically aligned");
  } else if (ctx.semanticTier >= 40) {
    matchedSignals.push("partial profile alignment");
  } else if (ctx.semanticTier === 0) {
    missingSignals.push("profile description matching the role");
  } else {
    gaps.push("Limited semantic alignment between profile and role");
  }

  if (matchedSkills.length) {
    strengths.push(
      `Matched skill${matchedSkills.length > 1 ? "s" : ""}: ${matchedSkills.slice(0, 4).join(", ")}`,
    );
    matchedSignals.push(`${matchedSkills.length} matched skill(s)`);
  } else if (ctx.pitch?.skillIds?.length) {
    missingSignals.push("matching skills");
    gaps.push("No matching skills found");
  }

  if (matchedSectors > 0) {
    strengths.push(
      `Matched ${matchedSectors} pitch sector${matchedSectors > 1 ? "s" : ""}`,
    );
    matchedSignals.push(`${matchedSectors} matched sector(s)`);
    greenFlags.push("Sector overlap");
  } else if (ctx.pitch?.sectorIds?.length) {
    missingSignals.push("matching sectors");
    gaps.push("No sector overlap detected");
  }

  if (ctx.hardFilter.status === "FAIL") {
    redFlags.push(`Hard filter failed (${ctx.hardFilter.reason})`);
  } else if (ctx.hardFilter.status === "WARN") {
    redFlags.push(`Limited evidence for ${label}`);
  }

  const reasons: string[] = [];
  if (strengths.length) reasons.push(strengths.slice(0, 3).join("; "));
  if (gaps.length && ctx.matchLevel !== "EXCELLENT") {
    reasons.push(
      `gap${gaps.length > 1 ? "s" : ""}: ${gaps.slice(0, 2).join("; ")}`,
    );
  }
  const aiSuffix = ctx.aiReasoning ? ` AI: ${ctx.aiReasoning}` : "";
  const explanation = reasons.length
    ? `${label} fit scored ${ctx.finalScore} (${ctx.matchLevel}) — ${reasons.join("; ")}.${aiSuffix}`
    : `${label} fit scored ${ctx.finalScore} (${ctx.matchLevel}).${aiSuffix}`;

  return {
    strengths,
    gaps,
    matchedSignals,
    missingSignals,
    greenFlags,
    redFlags,
    explanation,
  };
}

export function buildOverallMatchTargetExplanation(
  selected: MatchTargetType[],
  scores: MatchTargetScoreDetail[],
  totalScore: number,
  best: MatchTargetType | null,
): MatchTargetOverallExplanation {
  if (!selected.length) {
    return {
      summary: "No Match Targets were selected — no scoring performed.",
      bestMatchTarget: null,
      totalScoreRule:
        "totalScore is the maximum score across selected Match Target types.",
    };
  }
  if (!best || totalScore <= 0) {
    return {
      summary:
        "This contact did not produce a positive score for any selected Match Target.",
      bestMatchTarget: null,
      totalScoreRule:
        "totalScore is the maximum score across selected Match Target types.",
    };
  }
  const bestDetail = scores.find((s) => s.matchTarget === best);
  const bestLabel = bestDetail ? bestDetail.label : getMatchTargetLabel(best);
  const altParts = scores
    .filter((s) => s.matchTarget !== best)
    .sort((a, b) => b.finalScore - a.finalScore)
    .slice(0, 3)
    .map((s) => `${s.label} ${s.finalScore} (${s.matchLevel})`);
  const altSentence = altParts.length
    ? ` Other selected: ${altParts.join(", ")}.`
    : "";
  const bandLabel = bestDetail?.matchLevel ?? getMatchTargetBand(totalScore);
  return {
    summary: `This match is ranked ${bandLabel} because the ${bestLabel} score (${totalScore}) is the strongest among selected Match Targets.${altSentence}`,
    bestMatchTarget: best,
    totalScoreRule:
      "totalScore is the maximum score across selected Match Target types.",
  };
}

// ────────────────────────────────────────────────────────────────────────────
// BEST-OF SELECTION & RANKING
// ────────────────────────────────────────────────────────────────────────────

/** Pick the best Match Target detail (highest finalScore, tie-break confidence). */
export function getBestMatchTargetScore(
  scores: MatchTargetScoreDetail[],
): MatchTargetScoreDetail | null {
  let best: MatchTargetScoreDetail | null = null;
  for (const s of scores) {
    if (s.finalScore <= 0) continue;
    if (
      !best ||
      s.finalScore > best.finalScore ||
      (s.finalScore === best.finalScore && s.confidence > best.confidence)
    ) {
      best = s;
    }
  }
  return best;
}

/** Stable comparator for ranking enriched matches by totalScore desc. */
export function rankByTotalMatchTargetScore<
  T extends {
    totalScore?: number | null;
    bestConfidence?: number | null;
    effectiveRankScore?: number | null;
    deterministicScore?: number | null;
  },
>(a: T, b: T): number {
  const at = a.totalScore ?? 0;
  const bt = b.totalScore ?? 0;
  if (bt !== at) return bt - at;
  const ac = a.bestConfidence ?? 0;
  const bc = b.bestConfidence ?? 0;
  if (bc !== ac) return bc - ac;
  const ae = a.effectiveRankScore ?? 0;
  const be = b.effectiveRankScore ?? 0;
  if (be !== ae) return be - ae;
  const ad = a.deterministicScore ?? 0;
  const bd = b.deterministicScore ?? 0;
  return bd - ad;
}

// ────────────────────────────────────────────────────────────────────────────
// PRIMARY ENRICHMENT FUNCTION
// ────────────────────────────────────────────────────────────────────────────

export interface EnrichMatchTargetOptions {
  /** Selected Match Targets the user picked on the pitch form. */
  selected: MatchTargetType[] | string[];
  /** Contact's profile fields used for scoring. */
  contact: ContactScoringInput;
  /** Pitch's skills/sectors used for the overlap bonus. */
  pitch?: ProjectScoringInput;
  /** Optional pre-computed per-target semantic similarity (0..100). */
  semanticScores?: Record<MatchTargetType, number> | null;
  /** Contact-level flags. BLOCKED / OPT_OUT FAIL all selected targets. */
  flags?: { blocked?: boolean; optedOut?: boolean };
  /** Optional per-target AI adjustments (clamped to ±15). */
  aiAdjustments?: MatchTargetAIAdjustment[];
}

/**
 * Compute the full per-Match-Target enrichment for one contact.
 *
 * Returns one detail per selected target plus the overall totalScore /
 * bestMatchTarget / overallExplanation. Backward-compatible Record<id,
 * score> maps are also returned for legacy renderers.
 */
export function enrichPitchMatchTargets(
  options: EnrichMatchTargetOptions,
): EnrichedMatchTargetResult {
  const selected = normalizeSelectedMatchTargets(options.selected);
  if (!selected.length) {
    return {
      selectedMatchTargets: [],
      matchTargetScores: [],
      totalScore: 0,
      bestMatchTarget: null,
      overallExplanation: buildOverallMatchTargetExplanation([], [], 0, null),
      legacyScoresMap: {},
      legacyLabelsMap: {},
    };
  }

  // Map targets to lookingFor IDs once.
  const lookingForIds = selected.map((t) => TARGET_TO_LOOKING_FOR_ID[t]);

  // Keyword tier (with overlap bonus baked in by scoreLookingForRoles).
  const keywordRaw = scoreLookingForRoles(
    lookingForIds,
    options.contact,
    options.pitch,
  );

  // Compute the overlap bonus separately so we can decompose the tier.
  const projSkills = new Set(options.pitch?.skillIds || []);
  const projSectors = new Set(options.pitch?.sectorIds || []);
  const matchedSkillCount = (options.contact.skillIds || []).filter((id) =>
    projSkills.has(id),
  ).length;
  const matchedSectorCount = (options.contact.sectorIds || []).filter((id) =>
    projSectors.has(id),
  ).length;
  const overlapBonusValue =
    Math.min(30, matchedSkillCount * 5) + Math.min(20, matchedSectorCount * 10);

  // Pre-compute pure keyword tier (without overlap) for explanation.
  const keywordTierPerId: Record<string, number> = {};
  for (const id of lookingForIds) {
    const blended = keywordRaw[id] ?? 0;
    keywordTierPerId[id] = blended > 0
      ? Math.max(0, Math.min(100, blended - overlapBonusValue))
      : 0;
  }

  // Semantic blend: max(keyword+bonus, semantic).
  const semanticById: Record<string, number> = {};
  if (options.semanticScores) {
    for (const t of selected) {
      const id = TARGET_TO_LOOKING_FOR_ID[t];
      const v = options.semanticScores[t];
      if (typeof v === "number") semanticById[id] = v;
    }
  }
  const blendedScores = blendWithSemantic(
    keywordRaw,
    Object.keys(semanticById).length ? semanticById : null,
  );

  // AI adjustments map.
  const aiMap = new Map<MatchTargetType, MatchTargetAIAdjustment>();
  for (const adj of options.aiAdjustments ?? []) {
    aiMap.set(adj.matchTarget, adj);
  }

  // Build per-target detail objects.
  const details: MatchTargetScoreDetail[] = selected.map((target) => {
    const id = TARGET_TO_LOOKING_FOR_ID[target];
    const keywordTier = keywordTierPerId[id] ?? 0;
    const semanticTier = semanticById[id] ?? 0;
    const baseScore = Math.max(0, Math.min(100, blendedScores[id] ?? 0));

    const hardFilter = runMatchTargetHardFilters(
      target,
      keywordTier,
      semanticTier,
      options.flags,
    );

    const adj = aiMap.get(target);
    const safeDeltaRaw = clampMatchTargetAIDelta(adj?.aiScoreDelta ?? 0);
    const aiDelta = hardFilter.status === "FAIL" ? 0 : safeDeltaRaw;
    const aiAdjustmentBounded =
      adj && Math.abs(adj.aiScoreDelta) > MATCH_TARGET_AI_MAX_DELTA;

    const finalScoreRaw =
      hardFilter.status === "FAIL" ? 0 : baseScore + aiDelta;
    const finalScore = Math.max(0, Math.min(100, Math.round(finalScoreRaw)));
    const matchLevel = getMatchTargetBand(finalScore);

    const confidence = computeMatchTargetConfidence(
      keywordTier,
      semanticTier,
      overlapBonusValue,
    );

    const explanation = buildPerMatchTargetExplanation({
      target,
      contact: options.contact,
      pitch: options.pitch,
      keywordTier,
      semanticTier,
      overlapBonus: overlapBonusValue,
      finalScore,
      matchLevel,
      hardFilter,
      aiReasoning: adj?.aiReasoning,
      aiGreenFlags: adj?.greenFlags,
      aiRedFlags: adj?.redFlags,
    });

    return {
      matchTarget: target,
      intent: target,
      label: getMatchTargetLabel(target),
      score: Math.round(baseScore),
      deterministicScore: Math.round(baseScore),
      finalScore,
      matchLevel,
      confidence,
      hardFilterStatus: hardFilter.status,
      hardFilterReason: hardFilter.reason,
      hardFilterDetails: hardFilter.details,
      isBestMatchTarget: false, // populated below
      scoreBreakdown: {
        keywordTier: Math.round(keywordTier),
        semanticTier: Math.round(semanticTier),
        overlapBonus: Math.round(overlapBonusValue),
        aiDelta: aiDelta,
      },
      ...explanation,
      aiScore: adj ? Math.round(baseScore + aiDelta) : null,
      aiReasoning: adj?.aiReasoning,
      aiAdjustmentBounded,
    };
  });

  const best = getBestMatchTargetScore(details);
  const totalScore = best ? best.finalScore : 0;
  const bestType = best ? best.matchTarget : null;
  if (best) best.isBestMatchTarget = true;

  const legacyScoresMap: Record<string, number> = {};
  const legacyLabelsMap: Record<string, string> = {};
  for (const d of details) {
    legacyScoresMap[d.matchTarget] = d.finalScore;
    legacyLabelsMap[d.matchTarget] = d.label;
  }

  return {
    selectedMatchTargets: selected,
    matchTargetScores: details,
    totalScore,
    bestMatchTarget: bestType,
    overallExplanation: buildOverallMatchTargetExplanation(
      selected,
      details,
      totalScore,
      bestType,
    ),
    legacyScoresMap,
    legacyLabelsMap,
  };
}

// ────────────────────────────────────────────────────────────────────────────
// AI VALIDATION HOOK (engine-side bounded clamp)
// ────────────────────────────────────────────────────────────────────────────

/**
 * Apply per-Match-Target AI validations. Each delta is clamped to ±15.
 * Adjustments to FAIL targets are dropped — AI MUST NEVER override hard
 * filter failures. Returns a NEW EnrichedMatchTargetResult.
 */
export function applyMatchTargetAIValidation(
  result: EnrichedMatchTargetResult,
  adjustments: MatchTargetAIAdjustment[],
): EnrichedMatchTargetResult {
  if (!adjustments?.length) return result;

  const adjMap = new Map<MatchTargetType, MatchTargetAIAdjustment>();
  for (const adj of adjustments) adjMap.set(adj.matchTarget, adj);

  const updated = result.matchTargetScores.map((d) => {
    const adj = adjMap.get(d.matchTarget);
    if (!adj || d.hardFilterStatus === "FAIL") return d;
    const safeDelta = clampMatchTargetAIDelta(adj.aiScoreDelta);
    if (!safeDelta && !adj.aiReasoning && !adj.greenFlags?.length && !adj.redFlags?.length) {
      return d;
    }
    const finalScore = Math.max(
      0,
      Math.min(100, Math.round(d.score + safeDelta)),
    );
    const matchLevel = getMatchTargetBand(finalScore);
    const aiAdjustmentBounded = Math.abs(adj.aiScoreDelta) > MATCH_TARGET_AI_MAX_DELTA;
    const greenFlagsAdded = (adj.greenFlags ?? []).filter(
      (g) => !d.greenFlags.includes(g),
    );
    const redFlagsAdded = (adj.redFlags ?? []).filter(
      (g) => !d.redFlags.includes(g),
    );
    return {
      ...d,
      finalScore,
      matchLevel,
      isBestMatchTarget: false,
      scoreBreakdown: { ...d.scoreBreakdown, aiDelta: safeDelta },
      greenFlags: [...d.greenFlags, ...greenFlagsAdded],
      redFlags: [...d.redFlags, ...redFlagsAdded],
      aiScore: finalScore,
      aiReasoning: adj.aiReasoning ?? d.aiReasoning,
      aiAdjustmentBounded,
      explanation: adj.aiReasoning
        ? `${d.explanation} AI: ${adj.aiReasoning}`
        : d.explanation,
    };
  });

  const best = getBestMatchTargetScore(updated);
  const totalScore = best ? best.finalScore : 0;
  const bestType = best ? best.matchTarget : null;
  if (best) best.isBestMatchTarget = true;

  const legacyScoresMap: Record<string, number> = {};
  const legacyLabelsMap: Record<string, string> = {};
  for (const d of updated) {
    legacyScoresMap[d.matchTarget] = d.finalScore;
    legacyLabelsMap[d.matchTarget] = d.label;
  }

  return {
    selectedMatchTargets: result.selectedMatchTargets,
    matchTargetScores: updated,
    totalScore,
    bestMatchTarget: bestType,
    overallExplanation: buildOverallMatchTargetExplanation(
      result.selectedMatchTargets,
      updated,
      totalScore,
      bestType,
    ),
    legacyScoresMap,
    legacyLabelsMap,
  };
}

// ────────────────────────────────────────────────────────────────────────────
// MERGE — used to collapse the same contact across pitch sections
// ────────────────────────────────────────────────────────────────────────────

/**
 * Merge two enriched per-target results into one. For every Match Target
 * present in either side we keep the BETTER detail (higher finalScore;
 * ties broken by confidence). totalScore / bestMatchTarget /
 * overallExplanation are recomputed from the merged details.
 */
export function mergeEnrichedMatchTargetResults(
  primary: EnrichedMatchTargetResult,
  other: EnrichedMatchTargetResult,
): EnrichedMatchTargetResult {
  const byTarget = new Map<MatchTargetType, MatchTargetScoreDetail>();
  for (const d of primary.matchTargetScores) byTarget.set(d.matchTarget, d);
  for (const d of other.matchTargetScores) {
    const existing = byTarget.get(d.matchTarget);
    if (
      !existing ||
      d.finalScore > existing.finalScore ||
      (d.finalScore === existing.finalScore && d.confidence > existing.confidence)
    ) {
      byTarget.set(d.matchTarget, d);
    }
  }

  const selected = primary.selectedMatchTargets.length
    ? primary.selectedMatchTargets
    : other.selectedMatchTargets;

  const merged = selected
    .map((t) => byTarget.get(t))
    .filter((d): d is MatchTargetScoreDetail => Boolean(d))
    .map((d) => ({ ...d, isBestMatchTarget: false }));

  const best = getBestMatchTargetScore(merged);
  if (best) best.isBestMatchTarget = true;
  const totalScore = best ? best.finalScore : 0;
  const bestType = best ? best.matchTarget : null;

  const legacyScoresMap: Record<string, number> = {};
  const legacyLabelsMap: Record<string, string> = {};
  for (const d of merged) {
    legacyScoresMap[d.matchTarget] = d.finalScore;
    legacyLabelsMap[d.matchTarget] = d.label;
  }

  return {
    selectedMatchTargets: selected,
    matchTargetScores: merged,
    totalScore,
    bestMatchTarget: bestType,
    overallExplanation: buildOverallMatchTargetExplanation(
      selected,
      merged,
      totalScore,
      bestType,
    ),
    legacyScoresMap,
    legacyLabelsMap,
  };
}
