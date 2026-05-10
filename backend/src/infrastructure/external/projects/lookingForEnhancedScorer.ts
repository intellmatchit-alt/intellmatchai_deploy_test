/**
 * Enhanced per-Looking-For Scorer for Project Matching.
 *
 * Builds on `lookingForRoleScorer.ts` to produce a fully structured score
 * object for every Looking For type the project owner selected. Each
 * candidate is scored INDEPENDENTLY for every selected Looking For type;
 * the headline score for the match is the maximum of those per-type scores
 * and the bestLookingFor is the type that produced it.
 *
 * Scoring rules (per the IntellMatch spec):
 *   - lookingFor: LookingForType[] is required to surface results.
 *   - For each selected Looking For type:
 *       * runLookingForHardFilters() decides PASS / WARN / FAIL.
 *       * Deterministic per-type score is computed from the keyword tier
 *         (lookingForRoleScorer) blended with semantic similarity, with
 *         skills/sectors overlap bonus (capped at 100).
 *       * Confidence is derived from the magnitude and stability of the
 *         signals available for that type.
 *       * AI/LLM validation may shift the per-type score by at most ±15;
 *         it MUST NEVER override a hard-filter FAIL.
 *       * The per-type final score is mapped to a band (WEAK / PARTIAL /
 *         GOOD / VERY_GOOD / EXCELLENT). Bands are global to the engine.
 *   - totalScore = MAX of all per-type final scores.
 *   - bestLookingFor = the type producing totalScore (highest finalScore,
 *     tie-broken by per-type confidence).
 *   - The match is excluded only if every selected Looking For type fails
 *     hard filters or scores below the minimum return threshold.
 *
 * @module infrastructure/external/projects/lookingForEnhancedScorer
 */

import {
  scoreLookingForRoles,
  blendWithSemantic,
  ROLE_LABELS,
  type ContactScoringInput,
  type ProjectScoringInput,
} from "./lookingForRoleScorer";

// ────────────────────────────────────────────────────────────────────────────
// PUBLIC TYPES
// ────────────────────────────────────────────────────────────────────────────

/** Canonical Looking For types supported by the IntellMatch engine. */
export enum LookingForType {
  INVESTOR = "INVESTOR",
  ADVISOR = "ADVISOR",
  SERVICE_PROVIDER = "SERVICE_PROVIDER",
  STRATEGIC_PARTNER = "STRATEGIC_PARTNER",
  CHANNEL_DISTRIBUTION = "CHANNEL_DISTRIBUTION",
  TECHNICAL_PARTNER = "TECHNICAL_PARTNER",
  CO_FOUNDER_TALENT = "CO_FOUNDER_TALENT",
}

/**
 * Looking For ID used by the persistence layer & frontend (lowercased).
 * The engine accepts either the enum value or the persistence ID.
 */
export const LOOKING_FOR_ID_TO_TYPE: Record<string, LookingForType> = {
  investor: LookingForType.INVESTOR,
  advisor: LookingForType.ADVISOR,
  service_provider: LookingForType.SERVICE_PROVIDER,
  strategic_partner: LookingForType.STRATEGIC_PARTNER,
  channel_distribution: LookingForType.CHANNEL_DISTRIBUTION,
  technical_partner: LookingForType.TECHNICAL_PARTNER,
  cofounder_talent: LookingForType.CO_FOUNDER_TALENT,
};

export const LOOKING_FOR_TYPE_TO_ID: Record<LookingForType, string> = {
  [LookingForType.INVESTOR]: "investor",
  [LookingForType.ADVISOR]: "advisor",
  [LookingForType.SERVICE_PROVIDER]: "service_provider",
  [LookingForType.STRATEGIC_PARTNER]: "strategic_partner",
  [LookingForType.CHANNEL_DISTRIBUTION]: "channel_distribution",
  [LookingForType.TECHNICAL_PARTNER]: "technical_partner",
  [LookingForType.CO_FOUNDER_TALENT]: "cofounder_talent",
};

export const LOOKING_FOR_LABELS: Record<LookingForType, string> = {
  [LookingForType.INVESTOR]: "Investor",
  [LookingForType.ADVISOR]: "Advisor",
  [LookingForType.SERVICE_PROVIDER]: "Service Provider",
  [LookingForType.STRATEGIC_PARTNER]: "Strategic Partner",
  [LookingForType.CHANNEL_DISTRIBUTION]: "Channel / Distribution",
  [LookingForType.TECHNICAL_PARTNER]: "Technical Partner",
  [LookingForType.CO_FOUNDER_TALENT]: "Co-founder / Talent",
};

/** Per-type hard filter outcome. WARN does NOT exclude. FAIL forces score 0. */
export type LookingForHardFilterStatus = "PASS" | "WARN" | "FAIL";

/** Reason codes for the per-type hard filter result. */
export type LookingForHardFilterReason =
  | "NONE"
  | "NO_ROLE_SIGNAL"
  | "LIMITED_INVESTOR_EVIDENCE"
  | "LIMITED_ADVISOR_EVIDENCE"
  | "LIMITED_SERVICE_PROVIDER_EVIDENCE"
  | "LIMITED_PARTNER_EVIDENCE"
  | "LIMITED_TECHNICAL_EVIDENCE"
  | "LIMITED_DISTRIBUTION_EVIDENCE"
  | "LIMITED_COFOUNDER_EVIDENCE"
  | "BLOCKED"
  | "OPT_OUT";

/** Global match bands used across the matching engines. */
export type LookingForMatchBand =
  | "WEAK"
  | "PARTIAL"
  | "GOOD"
  | "VERY_GOOD"
  | "EXCELLENT";

/**
 * Bounded per-type AI adjustment. The engine applies at most ±6 points of
 * delta from a single AI call and clamps the resulting score to [0, 100].
 * Per IntellMatch spec Part 14: AI is a bounded validator, not the main scorer.
 */
export const AI_PER_TYPE_MAX_DELTA = 6;

/** Minimum returned score for a Looking For result to be considered useful. */
export const MIN_RETURN_SCORE = 1;

/**
 * Rich, explainable component-score row. Matches the spec's required shape so
 * the explainer / UI / AI validator never have to recompute weights.
 */
export interface LookingForScoringComponent {
  name: string;
  /** 0..100 raw component score (NOT yet weighted). */
  score: number;
  /** 0..1 weight from the active LookingForType policy. */
  weight: number;
  /** score * weight, rounded to 2 dp. */
  weightedScore: number;
  /** Concrete evidence supporting this component's score. */
  evidence: string[];
  /** Concrete penalty / weakness strings affecting this component. */
  penalties: string[];
}

/** Detailed score for a single Looking For type. */
export interface LookingForScoreDetail {
  /** Canonical Looking For type (UPPER_SNAKE). */
  lookingFor: LookingForType;
  /** Persistence/frontend ID (lowercase). */
  id: string;
  /** Human-readable label. */
  label: string;
  /** Deterministic score before AI adjustment, 0..100. */
  score: number;
  /** Final score after bounded AI adjustment, 0..100. Equals `score` if no AI. */
  finalScore: number;
  /** Match band derived from finalScore and confidence. */
  matchLevel: LookingForMatchBand;
  /** 0..1 confidence in the score. */
  confidence: number;
  /** Per-type hard filter outcome. */
  hardFilterStatus: LookingForHardFilterStatus;
  /** Reason for the hard filter outcome. */
  hardFilterReason: LookingForHardFilterReason;
  /** True if this type produced the match's totalScore. */
  isBestMatchType: boolean;
  /**
   * Component breakdown for transparency.
   *
   * Slice-2 expanded shape: `components` is the spec-mandated rich array of
   * 14 weighted components from LOOKING_FOR_SCORING_POLICIES; the legacy
   * `keywordTier` / `semanticTier` / `overlapBonus` raw signals are kept for
   * transparency and backward compatibility.
   */
  scoreBreakdown: {
    keywordTier: number;
    semanticTier: number;
    overlapBonus: number;
    aiDelta: number;
    components?: LookingForScoringComponent[];
  };
  /** Human-readable strengths for this type. */
  strengths: string[];
  /** Human-readable gaps for this type. */
  gaps: string[];
  /** Concrete signals matched for this type. */
  matchedSignals: string[];
  /** Concrete signals missing for this type. */
  missingSignals: string[];
  /** Positive flags for this type. */
  greenFlags: string[];
  /** Negative flags for this type. */
  redFlags: string[];
  /** Free-form natural-language explanation for this type. */
  explanation: string;
  /**
   * Single business-prose paragraph describing why this profile fits this
   * Looking For type. Composed deterministically from the strengths array and
   * the contact/project context. Frontend renders this as <p>, not bullets.
   */
  whyParagraph: string;
  /**
   * Single business-prose paragraph describing the principal gaps and what
   * the founder should verify before reaching out. Empty when there are no
   * material gaps. Frontend renders this as <p>, not bullets.
   */
  gapsParagraph: string;
}

/** Overall, combined explanation of why this match was ranked. */
export interface OverallLookingForExplanation {
  summary: string;
  bestLookingFor: LookingForType | null;
  totalScoreRule: string;
}

/** Fully-enriched per-Looking-For result for one candidate. */
export interface EnrichedLookingForResult {
  /** Selected Looking For types (canonical form). */
  selectedLookingFor: LookingForType[];
  /** One detail per selected Looking For type. */
  lookingForScores: LookingForScoreDetail[];
  /** MAX of finalScore across selected types (tie-breaker: confidence). */
  totalScore: number;
  /** The Looking For that produced totalScore, or null if all failed. */
  bestLookingFor: LookingForType | null;
  /** Overall explanation summarizing why this match was ranked. */
  overallExplanation: OverallLookingForExplanation;
  /**
   * Backward-compat: simple Record<id, score> shape used by the older
   * frontend MatchCard pill renderer.
   */
  legacyScoresMap: Record<string, number>;
  /** Backward-compat: id → label map used by the older MatchCard. */
  legacyLabelsMap: Record<string, string>;
}

/**
 * Optional AI adjustment input. Each entry's `aiScoreDelta` is clamped to
 * [-AI_PER_TYPE_MAX_DELTA, +AI_PER_TYPE_MAX_DELTA] and is ignored when the
 * matching per-type hardFilterStatus is FAIL.
 */
export interface LookingForAIAdjustment {
  lookingFor: LookingForType;
  aiScoreDelta: number;
  aiNote?: string;
}

// ────────────────────────────────────────────────────────────────────────────
// HELPERS
// ────────────────────────────────────────────────────────────────────────────

/** Convert any accepted form (id or canonical) to the canonical type. */
export function toLookingForType(input: string): LookingForType | null {
  if (!input) return null;
  const direct = (LookingForType as Record<string, LookingForType>)[input];
  if (direct) return direct;
  const lower = input.toLowerCase();
  return LOOKING_FOR_ID_TO_TYPE[lower] ?? null;
}

/** Convert a list of mixed-form Looking For inputs to canonical, deduped. */
export function normalizeSelectedLookingFor(input: string[]): LookingForType[] {
  if (!Array.isArray(input)) return [];
  const out: LookingForType[] = [];
  const seen = new Set<LookingForType>();
  for (const raw of input) {
    const t = toLookingForType(raw);
    if (t && !seen.has(t)) {
      seen.add(t);
      out.push(t);
    }
  }
  return out;
}

/** Map a canonical Looking For type to the persistence/frontend ID. */
export function getLookingForId(type: LookingForType): string {
  return LOOKING_FOR_TYPE_TO_ID[type];
}

/** Map a canonical Looking For type to its label. */
export function getLookingForLabel(type: LookingForType): string {
  return (
    LOOKING_FOR_LABELS[type] ??
    ROLE_LABELS[LOOKING_FOR_TYPE_TO_ID[type]] ??
    String(type)
  );
}

/**
 * Map a finalScore in [0,100] to a global match band.
 *
 *   WEAK:      0 – 39
 *   PARTIAL:  40 – 54
 *   GOOD:     55 – 69
 *   VERY_GOOD:70 – 84
 *   EXCELLENT:85 – 100
 */
export function getLookingForBand(score: number): LookingForMatchBand {
  const s = Math.max(0, Math.min(100, Math.round(score)));
  if (s >= 85) return "EXCELLENT";
  if (s >= 70) return "VERY_GOOD";
  if (s >= 55) return "GOOD";
  if (s >= 40) return "PARTIAL";
  return "WEAK";
}

/** Apply the bounded AI delta. Returns the delta actually applied. */
export function clampAIDelta(
  rawDelta: number,
  maxDelta: number = AI_PER_TYPE_MAX_DELTA,
): number {
  if (!Number.isFinite(rawDelta)) return 0;
  return Math.max(-maxDelta, Math.min(maxDelta, rawDelta));
}

/**
 * Per-type hard filter. Decides whether the candidate has enough evidence to
 * be evaluated for this Looking For type. The rule is intentionally lenient
 * (most checks WARN, never FAIL) so that a strong candidate for one type
 * isn't excluded because of weak evidence for another selected type. Hard
 * blockers (BLOCKED / OPT_OUT) on the candidate as a whole still FAIL.
 */
export function runLookingForHardFilters(
  type: LookingForType,
  contact: ContactScoringInput,
  keywordTierScore: number,
  semanticTierScore: number,
  flags: { blocked?: boolean; optedOut?: boolean } = {},
): { status: LookingForHardFilterStatus; reason: LookingForHardFilterReason } {
  if (flags.blocked) return { status: "FAIL", reason: "BLOCKED" };
  if (flags.optedOut) return { status: "FAIL", reason: "OPT_OUT" };

  const bestSignal = Math.max(keywordTierScore, semanticTierScore);

  if (bestSignal <= 0) {
    return { status: "FAIL", reason: "NO_ROLE_SIGNAL" };
  }

  // Below ~30 we surface as WARN so the match is still returned but the
  // explanation points out the limited evidence for this Looking For.
  if (bestSignal < 30) {
    const reason: LookingForHardFilterReason = (() => {
      switch (type) {
        case LookingForType.INVESTOR:
          return "LIMITED_INVESTOR_EVIDENCE";
        case LookingForType.ADVISOR:
          return "LIMITED_ADVISOR_EVIDENCE";
        case LookingForType.SERVICE_PROVIDER:
          return "LIMITED_SERVICE_PROVIDER_EVIDENCE";
        case LookingForType.STRATEGIC_PARTNER:
          return "LIMITED_PARTNER_EVIDENCE";
        case LookingForType.CHANNEL_DISTRIBUTION:
          return "LIMITED_DISTRIBUTION_EVIDENCE";
        case LookingForType.TECHNICAL_PARTNER:
          return "LIMITED_TECHNICAL_EVIDENCE";
        case LookingForType.CO_FOUNDER_TALENT:
          return "LIMITED_COFOUNDER_EVIDENCE";
      }
    })();
    return { status: "WARN", reason };
  }

  // Note: callers using strictly typed contact info may want to upgrade to
  // FAIL here (e.g. for INVESTOR with no investor profile), but the engine
  // intentionally keeps this lenient to not exclude strong fits for OTHER
  // selected Looking For types from the same candidate.
  void contact;
  return { status: "PASS", reason: "NONE" };
}

/** Confidence is a function of signal magnitude and signal redundancy. */
export function computePerTypeConfidence(
  keywordTier: number,
  semanticTier: number,
  overlapBonus: number,
): number {
  const base = Math.max(keywordTier, semanticTier) / 100; // strongest channel
  const corroboration = Math.min(keywordTier, semanticTier) / 100; // both agree?
  const overlap = Math.min(1, overlapBonus / 50);
  const raw = base * 0.6 + corroboration * 0.25 + overlap * 0.15;
  return Math.max(0, Math.min(1, Number(raw.toFixed(3))));
}

// ────────────────────────────────────────────────────────────────────────────
// EXPLANATION BUILDERS
// ────────────────────────────────────────────────────────────────────────────

interface ExplanationContext {
  type: LookingForType;
  contact: ContactScoringInput;
  project: ProjectScoringInput | undefined;
  keywordTier: number;
  semanticTier: number;
  overlapBonus: number;
  finalScore: number;
  matchLevel: LookingForMatchBand;
  hardFilter: {
    status: LookingForHardFilterStatus;
    reason: LookingForHardFilterReason;
  };
  aiNote?: string;
  /**
   * Spec-weighted components, when available. The explainer uses these to emit
   * Looking-For-specific gap strings (e.g. "No clear investment history" for
   * INVESTOR rather than the generic "No matching skills found").
   */
  components?: LookingForScoringComponent[];
}

function describeMatchedSkills(
  project: ProjectScoringInput | undefined,
  contact: ContactScoringInput,
): string[] {
  if (!project?.skillIds?.length || !contact.skillIds?.length) return [];
  const projSet = new Set(project.skillIds);
  const projectNames = project.skillNames || [];
  const contactNames = contact.skillNames || [];
  const out: string[] = [];
  contact.skillIds.forEach((id, idx) => {
    if (projSet.has(id)) {
      const label = contactNames[idx] || projectNames[project.skillIds!.indexOf(id)] || id;
      out.push(label);
    }
  });
  return out;
}

function describeMatchedSectorsCount(
  project: ProjectScoringInput | undefined,
  contact: ContactScoringInput,
): number {
  if (!project?.sectorIds?.length || !contact.sectorIds?.length) return 0;
  const projSet = new Set(project.sectorIds);
  return contact.sectorIds.filter((id) => projSet.has(id)).length;
}

/**
 * Convert a gap string (the deterministic short phrase emitted by the scorer)
 * into a clause that reads as continuous prose. Examples:
 *   "No sector overlap detected"           → "no sector overlap is detected in the profile"
 *   "No explicit Investor title found"     → "no explicit Investor title is visible in the profile"
 *   "No matching skills found"             → "no overlapping skills are visible in the profile"
 *   "Sector experience does not align"     → "sector experience does not align with the project"
 * Falls back to lowercasing the first letter when no rewrite rule matches.
 */
function normalizeGapClause(raw: string): string {
  const stripped = raw.replace(/^Need not strongly covered:\s*/i, "").trim();
  const lower = stripped.toLowerCase();
  if (/^no sector overlap (detected|found)/.test(lower)) {
    return "no sector overlap is detected in the profile";
  }
  if (/^no matching skills (cover|found)/.test(lower)) {
    return "no overlapping skills are visible in the profile";
  }
  if (/^no precise skill alignment/.test(lower)) {
    return "no precise skill alignment is found";
  }
  const titleMatch = lower.match(/^no explicit (.+?) title (detected|found)/);
  if (titleMatch) {
    return `no explicit ${titleMatch[1]} title is visible in the profile`;
  }
  if (/^few or no matching skills/.test(lower)) {
    return "few or no skills overlap with the project's needs";
  }
  if (/^required capability is not strongly evidenced/.test(lower)) {
    return "the required capability is not strongly evidenced in the profile";
  }
  if (/^limited evidence/.test(lower)) {
    return stripped.charAt(0).toLowerCase() + stripped.slice(1);
  }
  // Default: lowercase the first letter so the clause reads naturally after
  // a connector like "the principal gap is that …".
  return stripped.charAt(0).toLowerCase() + stripped.slice(1);
}

function buildPerLookingForExplanation(
  ctx: ExplanationContext,
): Pick<
  LookingForScoreDetail,
  "strengths" | "gaps" | "matchedSignals" | "missingSignals" | "greenFlags" | "redFlags" | "explanation" | "whyParagraph" | "gapsParagraph"
> {
  const label = getLookingForLabel(ctx.type);
  const matchedSkills = describeMatchedSkills(ctx.project, ctx.contact);
  const matchedSectors = describeMatchedSectorsCount(ctx.project, ctx.contact);

  const strengths: string[] = [];
  const gaps: string[] = [];
  const matchedSignals: string[] = [];
  const missingSignals: string[] = [];
  const greenFlags: string[] = [];
  const redFlags: string[] = [];

  const labelArticle = /^[aeiou]/i.test(label) ? "an" : "a";
  if (ctx.keywordTier >= 80) {
    strengths.push(`Title strongly suggests ${labelArticle} ${label} fit`);
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
  } else if (ctx.project?.skillIds?.length) {
    missingSignals.push("matching skills");
    gaps.push("No matching skills found");
  }

  if (matchedSectors > 0) {
    strengths.push(
      `Matched ${matchedSectors} project sector${matchedSectors > 1 ? "s" : ""}`,
    );
    matchedSignals.push(`${matchedSectors} matched sector(s)`);
    greenFlags.push("Sector overlap");
  } else if (ctx.project?.sectorIds?.length) {
    missingSignals.push("matching sectors");
    gaps.push("No sector overlap detected");
  }

  if (ctx.hardFilter.status === "FAIL") {
    redFlags.push(`Hard filter failed (${ctx.hardFilter.reason})`);
  } else if (ctx.hardFilter.status === "WARN") {
    redFlags.push(`Limited evidence for ${label}`);
  }

  // Emit Looking-For-specific gap strings derived from weak components.
  // Per spec Part 12: gaps must be specific to the Looking For type, not
  // generic. We pull weak components from the spec-weighted breakdown and map
  // each to a per-type gap message via `lookingForSpecificGap`.
  if (ctx.components?.length) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const lf = require("./looking-for.types") as typeof import("./looking-for.types");
    const componentToReason: Record<string, Parameters<typeof lf.lookingForSpecificGap>[1]> = {
      subtypeSpecificFit: "weakSubtype",
      skillFit: "weakSkill",
      sectorFit: "weakSector",
      marketFit: "weakMarket",
      engagementFit: "weakEngagement",
      credibilityFit: "weakCredibility",
      stageFit: "weakStage",
    };
    const seen = new Set(gaps);
    for (const c of ctx.components) {
      const reason = componentToReason[c.name];
      if (!reason) continue;
      if (c.score >= 30) continue; // only emit gaps for genuinely weak components
      const msg = lf.lookingForSpecificGap(ctx.type, reason);
      if (!seen.has(msg)) {
        seen.add(msg);
        gaps.push(msg);
      }
    }
  }

  // Compose a reader-friendly explanation. The numeric score is shown by the
  // UI badge, so the prose omits it. Tone: brief professional analyst.
  // Format:
  //   "{Verdict for this role} {strongest signals} {strengths} {top gaps} {AI note}."
  const article = /^[aeiou]/i.test(label) ? "an" : "a";
  const bandLeadIn: Record<LookingForMatchBand, string> = {
    EXCELLENT: `Profile reads as a strong ${label} fit.`,
    VERY_GOOD: `Profile reads as a clear ${label} fit.`,
    GOOD: `Profile reads as a workable ${label} fit.`,
    PARTIAL: `Profile reads as a partial ${label} fit.`,
    WEAK: `Profile reads as ${article} ${label}; signals for this role are limited.`,
  };
  const sentences: string[] = [];
  sentences.push(bandLeadIn[ctx.matchLevel]);

  // Top contributing components — only surface genuine signals (score >= 60).
  // Drop neutral 50% defaults that contradict the "What to verify" gap line.
  if (ctx.components?.length) {
    const topContribs = [...ctx.components]
      .filter((c) => c.score >= 60)
      .filter((c) => c.weightedScore >= 4)
      .filter((c) => c.name !== "completenessFit")
      .sort((a, b) => b.weightedScore - a.weightedScore)
      .slice(0, 2)
      .map((c) => {
        const human = c.name
          .replace(/Fit$|Coverage$|Precision$/, "")
          .replace(/([A-Z])/g, " $1")
          .trim()
          .toLowerCase();
        return `${human} (${Math.round(c.score)}%)`;
      });
    if (topContribs.length) {
      sentences.push(`Strongest signals: ${topContribs.join(", ")}.`);
    }
  }

  // Concrete strengths — reader-friendly evidence, max 2.
  if (strengths.length) {
    sentences.push(`${strengths.slice(0, 2).join(". ")}.`);
  }

  // Gaps only for non-EXCELLENT matches, max 2, no long-string entries.
  if (gaps.length && ctx.matchLevel !== "EXCELLENT") {
    const concise = gaps.filter((g) => g.length <= 120).slice(0, 2);
    if (concise.length) {
      sentences.push(`What to verify: ${concise.join("; ")}.`);
    }
  }

  if (ctx.aiNote) {
    sentences.push(`AI note: ${ctx.aiNote}.`);
  }

  const explanation = sentences.join(" ");

  // Compose business-prose paragraphs for the modal. The frontend renders
  // these directly as <p>, so they must read as continuous prose, not as
  // joined bullet phrases. Tone: senior analyst describing the candidate to
  // a busy founder.
  const bandPhraseFor: Record<LookingForMatchBand, string> = {
    EXCELLENT: `is a strong fit for the ${label} role`,
    VERY_GOOD: `is a clear fit for the ${label} role`,
    GOOD: `is a workable fit for the ${label} role`,
    PARTIAL: `is a partial fit for the ${label} role`,
    WEAK: `does not yet read as a strong ${label}`,
  };
  const whyOpening = `For this opportunity, the candidate ${bandPhraseFor[ctx.matchLevel]}.`;
  // Translate strengths into noun-phrase clauses suited for joining with
  // commas / "and" inside one sentence. Each clause starts with the subject,
  // not a verb, so the leading "supported by" connector reads naturally.
  const whyEvidence: string[] = [];
  for (const s of strengths.slice(0, 4)) {
    const lower = s.toLowerCase();
    if (lower.startsWith("title strongly suggests")) {
      whyEvidence.push(`a professional title that aligns with the role`);
    } else if (lower.startsWith("title has partial")) {
      whyEvidence.push(`a professional title that partially signals the role`);
    } else if (lower.startsWith("matched skill")) {
      const skills = s.replace(/^matched skills?:?\s*/i, "");
      whyEvidence.push(`relevant skills (${skills})`);
    } else if (lower.startsWith("matched ") && lower.includes("project sector")) {
      whyEvidence.push(`sector experience that overlaps with the project's domain`);
    } else if (lower.length > 0) {
      whyEvidence.push(s.charAt(0).toLowerCase() + s.slice(1));
    }
  }
  // Join clauses with commas + "and" before the last item.
  const joinClauses = (arr: string[]): string => {
    if (arr.length <= 1) return arr.join("");
    if (arr.length === 2) return `${arr[0]} and ${arr[1]}`;
    return `${arr.slice(0, -1).join(", ")}, and ${arr[arr.length - 1]}`;
  };
  let whyParagraph = whyOpening;
  if (whyEvidence.length) {
    whyParagraph += ` Supporting evidence includes ${joinClauses(whyEvidence)}.`;
  } else {
    whyParagraph += ` There is limited concrete evidence in the profile that maps directly to the project's stated needs.`;
  }

  // Gaps paragraph — only when meaningful gaps exist. Filters out long
  // strings (>120 chars) which are likely raw need-text dumps.
  const conciseGaps = gaps.filter((g) => g.length <= 120 && g.length > 0).slice(0, 3);
  let gapsParagraph = "";
  if (conciseGaps.length) {
    const clauses = conciseGaps.map(normalizeGapClause);
    gapsParagraph =
      `The principal items to verify before reaching out are that ${joinClauses(clauses)}. ` +
      `These gaps do not invalidate the match, but they materially affect how confident the engagement model can be without further conversation.`;
  } else if (ctx.matchLevel !== "EXCELLENT" && ctx.matchLevel !== "VERY_GOOD") {
    gapsParagraph =
      `No specific gap stands out in the structured signals, but the overall fit is still imperfect — a short discovery conversation is recommended before committing time on either side.`;
  }

  return {
    strengths,
    gaps,
    matchedSignals,
    missingSignals,
    greenFlags,
    redFlags,
    explanation,
    whyParagraph,
    gapsParagraph,
  };
}

function buildOverallLookingForExplanation(
  selected: LookingForType[],
  scores: LookingForScoreDetail[],
  totalScore: number,
  best: LookingForType | null,
): OverallLookingForExplanation {
  if (!selected.length) {
    return {
      summary: "No Looking For options were selected — no scoring performed.",
      bestLookingFor: null,
      totalScoreRule:
        "totalScore is the maximum score across selected Looking For types.",
    };
  }
  if (!best || totalScore <= 0) {
    return {
      summary:
        "This match did not produce a positive score for any selected Looking For type.",
      bestLookingFor: null,
      totalScoreRule:
        "totalScore is the maximum score across selected Looking For types.",
    };
  }
  const bestDetail = scores.find((s) => s.lookingFor === best);
  const bestLabel = bestDetail ? bestDetail.label : getLookingForLabel(best);
  const altParts = scores
    .filter((s) => s.lookingFor !== best)
    .sort((a, b) => b.finalScore - a.finalScore)
    .slice(0, 3)
    .map((s) => `${s.label} ${s.finalScore} (${s.matchLevel})`);
  const altSentence = altParts.length
    ? ` They also scored across ${altParts.join(", ")}.`
    : "";
  const bandLabel = bestDetail?.matchLevel ?? getLookingForBand(totalScore);
  const bandWord: Record<LookingForMatchBand, string> = {
    EXCELLENT: "excellent",
    VERY_GOOD: "very good",
    GOOD: "good",
    PARTIAL: "partial",
    WEAK: "weak",
  };

  // Build the overall match summary as one continuous business paragraph.
  // The frontend renders this as a single <p> at the top of the modal, so the
  // prose has to read end-to-end without bullets or headings. Tone: senior
  // analyst summarising a match for a busy founder.
  const overallArticle = /^[aeiou]/i.test(bestLabel) ? "an" : "a";

  const bandClause: Record<LookingForMatchBand, string> = {
    EXCELLENT: `is a strong fit`,
    VERY_GOOD: `is a clear fit`,
    GOOD: `is a workable fit`,
    PARTIAL: `is a partial fit`,
    WEAK: `is a limited fit`,
  };

  // Pull the best-detail's strongest evidence and translate it to noun-phrase
  // clauses, mirroring the per-type whyParagraph composer.
  const headlineStrengths = bestDetail?.strengths?.slice(0, 3) ?? [];
  const evidenceClauses: string[] = [];
  for (const s of headlineStrengths) {
    const lower = s.toLowerCase();
    if (lower.startsWith("title strongly suggests")) {
      evidenceClauses.push(`a professional title that aligns with the role`);
    } else if (lower.startsWith("title has partial")) {
      evidenceClauses.push(`a professional title that partially signals the role`);
    } else if (lower.startsWith("matched skill")) {
      const skills = s.replace(/^matched skills?:?\s*/i, "");
      evidenceClauses.push(`relevant skills (${skills})`);
    } else if (lower.startsWith("matched ") && lower.includes("project sector")) {
      evidenceClauses.push(`sector experience that overlaps with the project's domain`);
    } else if (lower.length > 0) {
      evidenceClauses.push(s.charAt(0).toLowerCase() + s.slice(1));
    }
  }
  const joinClauses = (arr: string[]): string => {
    if (arr.length <= 1) return arr.join("");
    if (arr.length === 2) return `${arr[0]} and ${arr[1]}`;
    return `${arr.slice(0, -1).join(", ")}, and ${arr[arr.length - 1]}`;
  };
  const headlineGap = bestLevelGapWorthMentioning(bestDetail) ? bestDetail!.gaps[0] : null;
  const altLabelsOnly = scores
    .filter((s) => s.lookingFor !== best && s.finalScore > 0)
    .sort((a, b) => b.finalScore - a.finalScore)
    .slice(0, 3)
    .map((s) => s.label);

  const parts: string[] = [];
  parts.push(
    `This profile ${bandClause[bandLabel]} for the project, with the strongest alignment as ${overallArticle} ${bestLabel}.`,
  );
  if (evidenceClauses.length) {
    parts.push(
      `Supporting evidence includes ${joinClauses(evidenceClauses)}.`,
    );
  } else {
    parts.push(
      `Concrete signals tying the profile to the project's stated needs are limited.`,
    );
  }
  if (headlineGap) {
    parts.push(
      `The principal gap relative to the role is that ${normalizeGapClause(headlineGap)}; this is worth verifying before reaching out.`,
    );
  }
  if (altLabelsOnly.length) {
    parts.push(
      `The same profile also reads as a partial fit for ${altLabelsOnly.join(", ")}, which gives some flexibility on engagement model.`,
    );
  }

  // Suppress unused legacy variables.
  void altSentence;
  void bandWord;

  return {
    summary: parts.join(" "),
    bestLookingFor: best,
    totalScoreRule:
      "totalScore is the maximum score across selected Looking For types.",
  };
}

function bestLevelGapWorthMentioning(
  best: LookingForScoreDetail | undefined,
): boolean {
  if (!best) return false;
  if (best.matchLevel === "EXCELLENT") return false;
  return Boolean(best.gaps?.length);
}

// ────────────────────────────────────────────────────────────────────────────
// BEST-OF SELECTION & RANKING
// ────────────────────────────────────────────────────────────────────────────

/**
 * Pick the best Looking For type from a list of details. Rule:
 *   1. highest finalScore wins
 *   2. tie → highest confidence wins
 *   3. tie → lowest enum order (stable)
 */
export function getBestLookingForScore(
  scores: LookingForScoreDetail[],
): LookingForScoreDetail | null {
  if (!scores.length) return null;
  let best: LookingForScoreDetail | null = null;
  for (const s of scores) {
    if (s.finalScore <= 0) continue;
    if (!best) {
      best = s;
      continue;
    }
    if (s.finalScore > best.finalScore) {
      best = s;
    } else if (
      s.finalScore === best.finalScore &&
      s.confidence > best.confidence
    ) {
      best = s;
    }
  }
  return best;
}

/**
 * Stable ranking comparator for results enriched with Looking For data.
 *   1. totalScore desc
 *   2. confidence-of-bestLookingFor desc
 *   3. existing matchScore desc (proxy for relationship/network strength
 *      already computed by the deterministic engine)
 *   4. deterministic best score desc
 */
export function rankByTotalLookingForScore<
  T extends {
    totalScore?: number | null;
    bestConfidence?: number | null;
    matchScore?: number | null;
    bestDeterministicScore?: number | null;
  },
>(a: T, b: T): number {
  const at = a.totalScore ?? 0;
  const bt = b.totalScore ?? 0;
  if (bt !== at) return bt - at;
  const ac = a.bestConfidence ?? 0;
  const bc = b.bestConfidence ?? 0;
  if (bc !== ac) return bc - ac;
  const am = a.matchScore ?? 0;
  const bm = b.matchScore ?? 0;
  if (bm !== am) return bm - am;
  const ad = a.bestDeterministicScore ?? 0;
  const bd = b.bestDeterministicScore ?? 0;
  return bd - ad;
}

// ────────────────────────────────────────────────────────────────────────────
// SPEC-WEIGHTED COMPONENT SCORING
//
// Each Looking For type has a 14-component weight matrix
// (LOOKING_FOR_SCORING_POLICIES). The function below derives 0..100 raw values
// for each component from the existing signal layer (keyword tier, semantic
// tier, skill / sector overlap, plus contact bio/title features) and applies
// the matrix to produce the deterministic per-type score.
//
// Components for which we have no direct signal in the live engine fall back
// to neutral or proxy values (documented inline). Those components carry low
// weights for most types, so they don't dominate the score.
// ────────────────────────────────────────────────────────────────────────────

interface PerTypeSignals {
  keywordTier: number;       // 0..100 — output of lookingForRoleScorer
  semanticTier: number;      // 0..100 — output of lookingForSemanticScorer
  matchedSkillCount: number;
  totalProjectSkills: number;
  matchedSectorCount: number;
  totalProjectSectors: number;
  bioPresent: boolean;
  jobTitlePresent: boolean;
  companyPresent: boolean;
  /** Pre-extracted credibility features from bio. Populated when bio exists. */
  bioFeatures?: BioCredibilityFeatures;
}

/**
 * Production-grade credibility features extracted from a contact's free-text
 * bio. These are used to boost the spec components for credibilityFit and
 * subtypeSpecificFit beyond the naive presence-of-bio proxy.
 */
export interface BioCredibilityFeatures {
  /** Years of experience mentioned anywhere in the bio (max found). */
  yearsExperience: number;
  /** Count of portfolio companies / investments mentioned. */
  portfolioCount: number;
  /** Count of boards the person mentions sitting on. */
  boardCount: number;
  /** Count of exits / successful sales mentioned. */
  exitCount: number;
  /** True when bio explicitly mentions investing activity. */
  hasInvestorEvidence: boolean;
  /** True when bio explicitly mentions advisory / board activity. */
  hasAdvisorEvidence: boolean;
  /** True when bio mentions building / shipping technical work. */
  hasBuilderEvidence: boolean;
  /** True when bio mentions partnerships / business development success. */
  hasPartnershipEvidence: boolean;
}

export function extractBioCredibility(
  bio: string | null | undefined,
): BioCredibilityFeatures {
  const empty: BioCredibilityFeatures = {
    yearsExperience: 0,
    portfolioCount: 0,
    boardCount: 0,
    exitCount: 0,
    hasInvestorEvidence: false,
    hasAdvisorEvidence: false,
    hasBuilderEvidence: false,
    hasPartnershipEvidence: false,
  };
  if (!bio) return empty;
  const b = bio.toLowerCase();

  // "15+ years", "20 years of experience", "over 10 years"
  const yearsMatches = [
    ...b.matchAll(/\b(\d{1,2})\+?\s*(?:years?|yrs?)\s*(?:of\s*)?(?:experience|exp\b)?/g),
    ...b.matchAll(/\b(?:over|more\s*than)\s*(\d{1,2})\s*(?:years?|yrs?)/g),
  ];
  let years = 0;
  for (const m of yearsMatches) {
    const n = Number(m[1]);
    if (Number.isFinite(n) && n > years && n <= 60) years = n;
  }

  // "invested in 15 startups", "portfolio of 30 companies", "backed 12"
  const portfolioMatches = [
    ...b.matchAll(/\b(?:invested\s*in|portfolio\s*of|backed)\s*(\d{1,3})\b/g),
    ...b.matchAll(/\b(\d{1,3})\+?\s*(?:portfolio\s*compan(?:y|ies)|investments?)\b/g),
  ];
  let portfolio = 0;
  for (const m of portfolioMatches) {
    const n = Number(m[1]);
    if (Number.isFinite(n) && n > portfolio && n <= 500) portfolio = n;
  }

  // "sit on 4 boards", "3 advisory boards", "board member at 2"
  const boardMatches = [
    ...b.matchAll(/\b(?:sit\s*on|serves?\s*on|chair(?:s|ed)?|advise[sd]?)\s*(\d{1,2})\s*(?:advisory\s*)?boards?\b/g),
    ...b.matchAll(/\b(\d{1,2})\s*(?:advisory\s*)?boards?\b/g),
  ];
  let boards = 0;
  for (const m of boardMatches) {
    const n = Number(m[1]);
    if (Number.isFinite(n) && n > boards && n <= 30) boards = n;
  }

  // "successful exit", "1 exit", "exited 3 companies"
  const exitMatches = [
    ...b.matchAll(/\b(\d{1,2})\s*(?:successful\s*)?exits?\b/g),
    ...b.matchAll(/\bexited\s*(\d{1,2})\s*(?:compan(?:y|ies)|startups?)\b/g),
  ];
  let exits = 0;
  for (const m of exitMatches) {
    const n = Number(m[1]);
    if (Number.isFinite(n) && n > exits && n <= 30) exits = n;
  }
  // "successful exit" without a count → at least 1.
  if (!exits && /\bsuccessful\s*exit\b/.test(b)) exits = 1;

  const hasInvestorEvidence =
    /\b(angel\s*investor|venture\s*capital|business\s*angel|active\s*investor|invest(ed|ing)|portfolio\s*compan|deal\s*flow|due\s*diligence|cap\s*table|term\s*sheet|first\s*check|lead\s*investor)\b/.test(b);
  const hasAdvisorEvidence =
    /\b(advise[sd]?|advising|advisor|board\s*member|board\s*director|sit\s*on\s*\w*\s*board|chair(?:s|ed|man)?)\b/.test(b);
  const hasBuilderEvidence =
    /\b(built|building|shipped|launched|architected|engineered|deployed|developed|coded|programmed)\b/.test(b);
  const hasPartnershipEvidence =
    /\b(partnerships?|alliances?|joint\s*venture|business\s*development|closed\s*deals?|signed\s*deals?|landed\s*deals?)\b/.test(b);

  return {
    yearsExperience: years,
    portfolioCount: portfolio,
    boardCount: boards,
    exitCount: exits,
    hasInvestorEvidence,
    hasAdvisorEvidence,
    hasBuilderEvidence,
    hasPartnershipEvidence,
  };
}

interface ComponentDerivation {
  score: number; // 0..100
  evidence: string[];
  penalties: string[];
}

/** Round a 0..100 value to one decimal place to keep the breakdown readable. */
function r1(v: number): number {
  return Math.max(0, Math.min(100, Number(v.toFixed(1))));
}

/**
 * Subtype scoring with bio-evidence boosts. Reads the type-specific bio
 * signals (e.g. portfolio count for INVESTOR, board count for ADVISOR,
 * builder evidence for TECHNICAL_PARTNER) and adds them on top of the
 * keyword-tier base. The boost is bounded so an unverified bio claim can't
 * dominate a candidate without a matching title.
 */
function subtypeWithBioBoost(
  type: LookingForType,
  titleStrength: number,
  bio?: BioCredibilityFeatures,
): ComponentDerivation {
  let score = titleStrength;
  const evidence: string[] = [];
  const penalties: string[] = [];
  if (titleStrength >= 70) {
    evidence.push(`Strong ${LOOKING_FOR_LABELS[type]} subtype match`);
  } else if (titleStrength >= 40) {
    evidence.push(`Partial ${LOOKING_FOR_LABELS[type]} subtype signal`);
  }

  if (bio) {
    let bioBoost = 0;
    switch (type) {
      case LookingForType.INVESTOR: {
        if (bio.portfolioCount >= 5) {
          bioBoost += 25;
          evidence.push(`Bio mentions ${bio.portfolioCount} portfolio companies`);
        } else if (bio.portfolioCount >= 1) {
          bioBoost += 12;
          evidence.push(`Bio mentions investments`);
        }
        if (bio.hasInvestorEvidence) {
          bioBoost += 10;
          evidence.push("Bio shows investor-language evidence");
        }
        if (bio.exitCount >= 1) {
          bioBoost += 8;
          evidence.push(`Bio mentions ${bio.exitCount} exit${bio.exitCount > 1 ? "s" : ""}`);
        }
        break;
      }
      case LookingForType.ADVISOR: {
        if (bio.boardCount >= 3) {
          bioBoost += 25;
          evidence.push(`Bio mentions sitting on ${bio.boardCount} boards`);
        } else if (bio.boardCount >= 1) {
          bioBoost += 12;
          evidence.push(`Bio mentions board involvement`);
        }
        if (bio.hasAdvisorEvidence) {
          bioBoost += 10;
          evidence.push("Bio shows advisory evidence");
        }
        break;
      }
      case LookingForType.TECHNICAL_PARTNER: {
        if (bio.hasBuilderEvidence) {
          bioBoost += 18;
          evidence.push("Bio shows hands-on building / shipping evidence");
        }
        break;
      }
      case LookingForType.STRATEGIC_PARTNER:
      case LookingForType.CHANNEL_DISTRIBUTION: {
        if (bio.hasPartnershipEvidence) {
          bioBoost += 18;
          evidence.push("Bio shows partnership / BD evidence");
        }
        break;
      }
      case LookingForType.CO_FOUNDER_TALENT: {
        if (bio.hasBuilderEvidence) {
          bioBoost += 12;
          evidence.push("Bio shows hands-on building evidence");
        }
        if (bio.exitCount >= 1) {
          bioBoost += 8;
          evidence.push(`Bio mentions prior exit`);
        }
        break;
      }
      case LookingForType.SERVICE_PROVIDER: {
        if (bio.yearsExperience >= 5) {
          bioBoost += 10;
          evidence.push(`Bio mentions ${bio.yearsExperience}+ years experience`);
        }
        break;
      }
    }
    score = Math.min(100, score + bioBoost);
  }

  if (titleStrength < 30 && (!bio || (
    bio.portfolioCount === 0 && bio.boardCount === 0 && bio.exitCount === 0 &&
    !bio.hasInvestorEvidence && !bio.hasAdvisorEvidence && !bio.hasBuilderEvidence && !bio.hasPartnershipEvidence
  ))) {
    penalties.push(`No ${LOOKING_FOR_LABELS[type]} subtype evidence`);
  }

  return { score: r1(score), evidence, penalties };
}

/**
 * Credibility scoring with bio depth + extracted features. A long bio with
 * "20 years experience, 3 exits, sit on 4 boards" should produce a much
 * stronger credibility score than a one-line bio with no claims.
 */
function credibilityWithBioBoost(signals: PerTypeSignals): ComponentDerivation {
  const evidence: string[] = [];
  const penalties: string[] = [];

  // Base presence score (0-100): bio matters most.
  let score =
    (signals.bioPresent ? 40 : 0) +
    (signals.jobTitlePresent ? 25 : 0) +
    (signals.companyPresent ? 15 : 0);

  if (signals.bioFeatures) {
    const bf = signals.bioFeatures;

    // Years of experience.
    if (bf.yearsExperience >= 15) {
      score += 15;
      evidence.push(`${bf.yearsExperience}+ years of experience`);
    } else if (bf.yearsExperience >= 8) {
      score += 10;
      evidence.push(`${bf.yearsExperience} years of experience`);
    } else if (bf.yearsExperience >= 3) {
      score += 5;
    }

    // Exits — strong credibility signal.
    if (bf.exitCount >= 1) {
      score += 8;
      evidence.push(
        bf.exitCount === 1
          ? "Bio mentions a successful exit"
          : `Bio mentions ${bf.exitCount} exits`,
      );
    }

    // Portfolio / boards — credibility for investor / advisor profiles.
    if (bf.portfolioCount >= 5) {
      score += 6;
      evidence.push(`Active investor (${bf.portfolioCount} companies)`);
    }
    if (bf.boardCount >= 2) {
      score += 6;
      evidence.push(`Sits on ${bf.boardCount} boards`);
    }
  } else if (!signals.bioPresent) {
    penalties.push("No bio available to corroborate credibility");
  }

  if (signals.bioPresent && signals.jobTitlePresent) {
    evidence.unshift("Profile has bio and title");
  }

  return {
    score: r1(Math.min(100, score)),
    evidence,
    penalties,
  };
}

/**
 * Map the existing signal layer to spec-weighted component values for one
 * Looking For type. Components for which the live engine has no direct signal
 * fall back to neutral 50 (so they contribute "average" weight rather than
 * dragging the score). Penalties are emitted whenever a component is < 30.
 */
function deriveSpecComponents(
  type: LookingForType,
  signals: PerTypeSignals,
  matchedSkillNames: string[],
): Record<string, ComponentDerivation> {
  // When the project has no skills / sectors specified, *we* have no basis to
  // judge the candidate on those axes — treat as neutral 50 rather than 0 so
  // a strong-title candidate isn't punished for the project's missing data.
  // (The skill/sector ratio is only a meaningful signal when the project
  // actually defined skills/sectors to match against.)
  const NEUTRAL = 0.5;
  const skillRatio = signals.totalProjectSkills > 0
    ? signals.matchedSkillCount / signals.totalProjectSkills
    : NEUTRAL;
  const sectorRatio = signals.totalProjectSectors > 0
    ? signals.matchedSectorCount / signals.totalProjectSectors
    : NEUTRAL;
  const hasProjectSkills = signals.totalProjectSkills > 0;
  const hasProjectSectors = signals.totalProjectSectors > 0;

  // Available evidence we can attach to component rows.
  const matchedSkillEvidence = matchedSkillNames.length
    ? [`Matched skills: ${matchedSkillNames.slice(0, 4).join(", ")}`]
    : [];
  const sectorEvidence = signals.matchedSectorCount > 0
    ? [`Matched ${signals.matchedSectorCount} project sector${signals.matchedSectorCount > 1 ? "s" : ""}`]
    : [];

  // High keyword tier means the candidate's title/company aligns with the
  // Looking For type — strong evidence for lookingForFit / counterpartFit /
  // subtypeSpecificFit.
  const titleStrength = signals.keywordTier;
  const semanticStrength = signals.semanticTier;
  // Capability is the practical, hands-on inference — title, semantic, skills.
  const capabilityRaw = Math.max(
    titleStrength * 0.6 + semanticStrength * 0.25 + skillRatio * 100 * 0.15,
    skillRatio * 100,
  );

  // Completeness — proxy for "we have enough data to score this candidate".
  const completenessRaw =
    (signals.bioPresent ? 40 : 0) +
    (signals.jobTitlePresent ? 30 : 0) +
    (signals.companyPresent ? 20 : 0) +
    (signals.totalProjectSkills > 0 ? 5 : 0) +
    (signals.totalProjectSectors > 0 ? 5 : 0);

  // Recall floors: when a contact has no title-keyword match for the role
  // but has strong sector/skill or semantic overlap, surface a partial fit
  // instead of zeroing the score. Strict-keyword matches still dominate so
  // there's no regression for explicit-title cases.
  const titleFitFloor = Math.max(
    titleStrength,
    semanticStrength * 0.7,
    skillRatio * 100 * 0.4,
    sectorRatio * 100 * 0.3,
  );
  const counterpartFitFloor = Math.max(
    titleStrength * 0.85 + semanticStrength * 0.15,
    semanticStrength * 0.6,
    skillRatio * 100 * 0.3,
  );

  const components: Record<string, ComponentDerivation> = {
    lookingForFit: {
      score: r1(titleFitFloor),
      evidence: titleStrength >= 70
        ? [`Title strongly indicates ${LOOKING_FOR_LABELS[type]}`]
        : titleStrength >= 40
          ? [`Title partially indicates ${LOOKING_FOR_LABELS[type]}`]
          : titleFitFloor >= 25
            ? [`Inferred from sector/skill alignment, not title`]
            : [],
      penalties: titleStrength < 30 && titleFitFloor < 25
        ? [`No explicit ${LOOKING_FOR_LABELS[type]} title detected`]
        : [],
    },
    counterpartFit: {
      score: r1(counterpartFitFloor),
      evidence: titleStrength >= 70
        ? ["Counterpart type aligned"]
        : counterpartFitFloor >= 25
          ? ["Counterpart type inferred from skill/semantic signals"]
          : [],
      penalties: titleStrength < 30 && semanticStrength < 30 && counterpartFitFloor < 25
        ? ["Counterpart type alignment is weak"]
        : [],
    },
    needCoverage: {
      score: r1(skillRatio * 100),
      evidence: matchedSkillEvidence,
      penalties: hasProjectSkills && signals.matchedSkillCount === 0
        ? ["No matching skills cover the project's needs"]
        : [],
    },
    needPrecision: {
      score: r1(
        hasProjectSkills
          ? (signals.matchedSkillCount / Math.max(signals.matchedSkillCount + 1, signals.totalProjectSkills)) * 100
          : NEUTRAL * 100,
      ),
      evidence: matchedSkillEvidence,
      penalties: hasProjectSkills && signals.matchedSkillCount === 0
        ? ["No precise skill alignment found"]
        : [],
    },
    capabilityFit: {
      score: r1(capabilityRaw),
      evidence: titleStrength >= 60 || (hasProjectSkills && skillRatio > 0)
        ? [
            ...(titleStrength >= 60 ? ["Title indicates relevant capability"] : []),
            ...matchedSkillEvidence,
          ]
        : [],
      penalties: capabilityRaw < 30 ? ["Required capability is not strongly evidenced"] : [],
    },
    skillFit: {
      score: r1(skillRatio * 100),
      evidence: matchedSkillEvidence,
      penalties: hasProjectSkills && skillRatio < 0.2
        ? ["Few or no matching skills"]
        : [],
    },
    sectorFit: {
      score: r1(sectorRatio * 100),
      evidence: sectorEvidence,
      penalties: hasProjectSectors && sectorRatio === 0
        ? ["No sector overlap detected"]
        : [],
    },
    // Market fit — the live engine doesn't model markets directly. Use sector
    // ratio as a proxy (sector and market often correlate) at half-strength so
    // it doesn't dominate. This keeps weighted output stable when no data.
    marketFit: {
      score: r1(50 + (sectorRatio - 0.5) * 50),
      evidence: [],
      penalties: [],
    },
    // Stage fit — no signal in the live engine; neutral.
    stageFit: { score: 50, evidence: [], penalties: [] },
    // Engagement fit — proxy with title strength: a strong title signal
    // implies the candidate is professionally engaged in this kind of role.
    engagementFit: {
      score: r1(40 + titleStrength * 0.4),
      evidence: titleStrength >= 60 ? ["Active in a relevant role"] : [],
      penalties: titleStrength < 30 ? ["Engagement model is unclear"] : [],
    },
    // Subtype-specific fit — keyword tier + bio-extracted role evidence.
    subtypeSpecificFit: subtypeWithBioBoost(type, titleStrength, signals.bioFeatures),
    // Credibility — bio quality, years of experience, portfolio/board/exit
    // counts. A presence-only proxy isn't enough for production; this reads
    // the bio for concrete credibility signals.
    credibilityFit: credibilityWithBioBoost(signals),
    semanticFit: {
      score: r1(semanticStrength),
      evidence: semanticStrength >= 70
        ? ["Profile description semantically aligned"]
        : [],
      penalties: semanticStrength < 30
        ? ["Profile description is not semantically aligned"]
        : [],
    },
    completenessFit: {
      score: r1(Math.min(100, completenessRaw)),
      evidence: [],
      penalties: completenessRaw < 30 ? ["Sparse candidate profile"] : [],
    },
  };

  return components;
}

export interface WeightedLookingForScoreResult {
  /** Final 0..100 deterministic score for this Looking For type. */
  score: number;
  /** Rich array of weighted component contributions. */
  components: LookingForScoringComponent[];
  /** Sum of weights actually applied (used for normalisation). */
  totalWeight: number;
  /**
   * Map of component name → 0..100 raw value. Convenience for callers that
   * want a quick lookup; identical data is in `components`.
   */
  componentScoreMap: Record<string, number>;
}

/**
 * Compute the spec-weighted deterministic score for one candidate against
 * one Looking For type. Returns the 0..100 score plus the rich component
 * breakdown the explainer/UI can render.
 */
export function computeWeightedLookingForScore(
  type: LookingForType,
  signals: PerTypeSignals,
  matchedSkillNames: string[],
): WeightedLookingForScoreResult {
  // Lazy import to avoid a circular import at module-load time. The policy
  // file imports types from project-matching.types which doesn't depend on
  // this module — but the ./looking-for.types module re-exports our enum,
  // so we resolve it lazily.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { LOOKING_FOR_SCORING_POLICIES } = require("./looking-for.types") as typeof import("./looking-for.types");

  const policy = LOOKING_FOR_SCORING_POLICIES[type];
  const weights = policy.weights as unknown as Record<string, number>;
  const derived = deriveSpecComponents(type, signals, matchedSkillNames);

  const components: LookingForScoringComponent[] = [];
  const componentScoreMap: Record<string, number> = {};
  let weightedSum = 0;
  let totalWeight = 0;

  for (const [name, weight] of Object.entries(weights)) {
    const der = derived[name] || { score: 50, evidence: [], penalties: [] };
    const score = der.score;
    componentScoreMap[name] = score;
    components.push({
      name,
      score,
      weight,
      weightedScore: Number((score * weight).toFixed(2)),
      evidence: der.evidence,
      penalties: der.penalties,
    });
    weightedSum += score * weight;
    totalWeight += weight;
  }

  const score = totalWeight > 0
    ? Math.max(0, Math.min(100, Math.round(weightedSum / totalWeight)))
    : 0;

  return { score, components, totalWeight, componentScoreMap };
}

// ────────────────────────────────────────────────────────────────────────────
// PRIMARY ENRICHMENT FUNCTION
// ────────────────────────────────────────────────────────────────────────────

export interface EnrichLookingForOptions {
  /** Selected Looking For types (canonical or persistence form). */
  selected: string[];
  /** The candidate's profile fields used for scoring. */
  contact: ContactScoringInput;
  /** Project skills/sectors used for the overlap bonus. */
  project?: ProjectScoringInput;
  /**
   * Optional pre-computed semantic similarity scores (per id, 0..100).
   * If omitted, semantic tier is treated as 0.
   */
  semanticScores?: Record<string, number> | null;
  /**
   * Optional candidate-level flags. BLOCKED / OPT_OUT FAIL all selected types.
   */
  flags?: { blocked?: boolean; optedOut?: boolean };
  /** Optional bounded AI adjustments per Looking For type. */
  aiAdjustments?: LookingForAIAdjustment[];
}

/**
 * Compute the full per-Looking-For enrichment for one candidate.
 *
 * The result includes per-type detail objects, the overall totalScore,
 * the bestLookingFor, an overall explanation, and a backward-compatible
 * Record<id, score> map for the legacy MatchCard renderer.
 */
export function enrichLookingForResult(
  options: EnrichLookingForOptions,
): EnrichedLookingForResult {
  const selected = normalizeSelectedLookingFor(options.selected);
  if (!selected.length) {
    return {
      selectedLookingFor: [],
      lookingForScores: [],
      totalScore: 0,
      bestLookingFor: null,
      overallExplanation: buildOverallLookingForExplanation([], [], 0, null),
      legacyScoresMap: {},
      legacyLabelsMap: {},
    };
  }

  // Compute keyword-tier scores (per persistence id) ────────────────────────
  const persistenceIds = selected.map((t) => LOOKING_FOR_TYPE_TO_ID[t]);
  // Two scores per role:
  //   `keywordBase`: title/company/bio scorer alone (no overlap bonus). This
  //     is the "title tier" signal used by the explanation builder so a
  //     candidate with a strong title isn't downgraded to "partial" purely
  //     because the bonus inflates the blended score past the cap.
  //   `keywordRaw`:  base + bonus, capped at 100. This drives downstream
  //     blending with semantic and the overlap bonus tracking.
  const keywordBase = scoreLookingForRoles(persistenceIds, options.contact);
  const keywordRaw = scoreLookingForRoles(persistenceIds, options.contact, options.project);

  // Strip the overlap bonus to learn the pure keyword tier; we keep both
  // numbers because explanations need the underlying components.
  // Overlap counts use MAX(ID-overlap, synonym-aware-name-overlap) so
  // "AI" matches "Artificial Intelligence", "Big Data & Analytics" matches
  // "Data Analytics", and Arabic ↔ English pairs collapse correctly.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { countSynonymOverlap: countSyn } = require("./synonyms") as typeof import("./synonyms");

  const overlapBonusPerId: Record<string, number> = {};
  const projSkills = new Set(options.project?.skillIds || []);
  const projSectors = new Set(options.project?.sectorIds || []);

  const idMatchedSkillCount = (options.contact.skillIds || []).filter((id) =>
    projSkills.has(id),
  ).length;
  const idMatchedSectorCount = (options.contact.sectorIds || []).filter((id) =>
    projSectors.has(id),
  ).length;
  const synSkill = countSyn(options.project?.skillNames, options.contact.skillNames);
  const synSector = countSyn(options.project?.sectorNames, options.contact.sectorNames);
  const matchedSkillCount = Math.max(idMatchedSkillCount, synSkill.count);
  const matchedSectorCount = Math.max(idMatchedSectorCount, synSector.count);

  const overlapBonusValue =
    Math.min(30, matchedSkillCount * 5) + Math.min(20, matchedSectorCount * 10);
  for (const id of persistenceIds) overlapBonusPerId[id] = overlapBonusValue;

  // Pure title-tier (no overlap bonus). Use `keywordBase` directly so a
  // candidate whose title alone scores 100 isn't downgraded by the cap-then-
  // subtract math when bonus pushes the blended score past 100.
  const keywordTierPerId: Record<string, number> = {};
  for (const id of persistenceIds) {
    keywordTierPerId[id] = keywordBase[id] ?? 0;
  }

  // Blend keyword + semantic tier (max) ─────────────────────────────────────
  const semantic = options.semanticScores ?? null;
  const blendedScores = blendWithSemantic(keywordRaw, semantic);

  // AI adjustments map (canonical type → adjustment) ────────────────────────
  const aiMap = new Map<LookingForType, LookingForAIAdjustment>();
  for (const adj of options.aiAdjustments ?? []) {
    aiMap.set(adj.lookingFor, adj);
  }

  // Pre-compute matched skill names (for spec-component evidence). Combines
  // ID-matched names with synonym-matched names, deduped.
  const matchedSkillNamesSet = new Set<string>();
  (options.contact.skillIds || []).forEach((id, idx) => {
    if (projSkills.has(id)) {
      const label =
        options.contact.skillNames?.[idx] ||
        options.project?.skillNames?.[
          (options.project?.skillIds || []).indexOf(id)
        ] ||
        id;
      matchedSkillNamesSet.add(label);
    }
  });
  for (const name of synSkill.matchedNames) matchedSkillNamesSet.add(name);
  const matchedSkillNames = Array.from(matchedSkillNamesSet);

  // Per-type detail objects ─────────────────────────────────────────────────
  const details: LookingForScoreDetail[] = selected.map((type) => {
    const id = LOOKING_FOR_TYPE_TO_ID[type];
    const keywordTier = keywordTierPerId[id] ?? 0;
    const semanticTier = semantic?.[id] ?? 0;
    const overlapBonus = overlapBonusPerId[id] ?? 0;

    // Apply the spec's per-LookingFor weight matrix to derive the
    // deterministic 0..100 score for this type. Components are derived from
    // the existing signal layer + contact metadata + bio-extracted credibility.
    const weightedResult = computeWeightedLookingForScore(
      type,
      {
        keywordTier,
        semanticTier,
        matchedSkillCount,
        totalProjectSkills: options.project?.skillIds?.length ?? 0,
        matchedSectorCount,
        totalProjectSectors: options.project?.sectorIds?.length ?? 0,
        bioPresent: !!options.contact.bio,
        jobTitlePresent: !!options.contact.jobTitle,
        companyPresent: !!options.contact.company,
        bioFeatures: options.contact.bio
          ? extractBioCredibility(options.contact.bio)
          : undefined,
      },
      matchedSkillNames,
    );
    const baseScore = weightedResult.score;

    const hardFilter = runLookingForHardFilters(
      type,
      options.contact,
      keywordTier,
      semanticTier,
      options.flags,
    );

    const adj = aiMap.get(type);
    const safeDelta = clampAIDelta(adj?.aiScoreDelta ?? 0);
    const aiDelta = hardFilter.status === "FAIL" ? 0 : safeDelta;

    const finalScoreRaw = hardFilter.status === "FAIL" ? 0 : baseScore + aiDelta;
    const finalScore = Math.max(0, Math.min(100, Math.round(finalScoreRaw)));
    const matchLevel = getLookingForBand(finalScore);

    const confidence = computePerTypeConfidence(
      keywordTier,
      semanticTier,
      overlapBonus,
    );

    const explanation = buildPerLookingForExplanation({
      type,
      contact: options.contact,
      project: options.project,
      keywordTier,
      semanticTier,
      overlapBonus,
      finalScore,
      matchLevel,
      hardFilter,
      aiNote: adj?.aiNote,
      components: weightedResult.components,
    });

    return {
      lookingFor: type,
      id,
      label: getLookingForLabel(type),
      score: Math.round(baseScore),
      finalScore,
      matchLevel,
      confidence,
      hardFilterStatus: hardFilter.status,
      hardFilterReason: hardFilter.reason,
      isBestMatchType: false, // populated below
      scoreBreakdown: {
        keywordTier: Math.round(keywordTier),
        semanticTier: Math.round(semanticTier),
        overlapBonus: Math.round(overlapBonus),
        aiDelta: aiDelta,
        components: weightedResult.components,
      },
      ...explanation,
    };
  });

  const best = getBestLookingForScore(details);
  const totalScore = best ? best.finalScore : 0;
  const bestType = best ? best.lookingFor : null;
  if (best) best.isBestMatchType = true;

  const legacyScoresMap: Record<string, number> = {};
  const legacyLabelsMap: Record<string, string> = {};
  for (const d of details) {
    legacyScoresMap[d.id] = d.finalScore;
    legacyLabelsMap[d.id] = d.label;
  }

  return {
    selectedLookingFor: selected,
    lookingForScores: details,
    totalScore,
    bestLookingFor: bestType,
    overallExplanation: buildOverallLookingForExplanation(
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
 * Apply per-Looking-For AI validations, clamping each delta to ±15 and
 * dropping any adjustments for types whose hard filter status is FAIL.
 *
 * The engine calls this when an LLM has produced suggested deltas for one
 * candidate. The function is pure: it returns a new EnrichedLookingForResult
 * without mutating the input. AI MUST NEVER override hard filter failures
 * and must remain conservative.
 */
export function applyLookingForAIValidation(
  result: EnrichedLookingForResult,
  adjustments: LookingForAIAdjustment[],
): EnrichedLookingForResult {
  if (!adjustments?.length) return result;

  const adjMap = new Map<LookingForType, LookingForAIAdjustment>();
  for (const adj of adjustments) adjMap.set(adj.lookingFor, adj);

  const updatedDetails = result.lookingForScores.map((d) => {
    const adj = adjMap.get(d.lookingFor);
    if (!adj || d.hardFilterStatus === "FAIL") return d;
    const safeDelta = clampAIDelta(adj.aiScoreDelta);
    if (!safeDelta) return d;
    const finalScore = Math.max(
      0,
      Math.min(100, Math.round(d.score + safeDelta)),
    );
    return {
      ...d,
      finalScore,
      matchLevel: getLookingForBand(finalScore),
      isBestMatchType: false,
      // Preserve the deterministic component breakdown — AI delta is layered
      // on top of the deterministic score and tracked separately.
      scoreBreakdown: { ...d.scoreBreakdown, aiDelta: safeDelta },
      explanation: adj.aiNote
        ? `${d.explanation} AI note: ${adj.aiNote}.`
        : d.explanation,
    };
  });

  const best = getBestLookingForScore(updatedDetails);
  const totalScore = best ? best.finalScore : 0;
  const bestType = best ? best.lookingFor : null;
  if (best) best.isBestMatchType = true;

  const legacyScoresMap: Record<string, number> = {};
  const legacyLabelsMap: Record<string, string> = {};
  for (const d of updatedDetails) {
    legacyScoresMap[d.id] = d.finalScore;
    legacyLabelsMap[d.id] = d.label;
  }

  return {
    selectedLookingFor: result.selectedLookingFor,
    lookingForScores: updatedDetails,
    totalScore,
    bestLookingFor: bestType,
    overallExplanation: buildOverallLookingForExplanation(
      result.selectedLookingFor,
      updatedDetails,
      totalScore,
      bestType,
    ),
    legacyScoresMap,
    legacyLabelsMap,
  };
}

// ────────────────────────────────────────────────────────────────────────────
// MATCH DEDUPLICATION
// ────────────────────────────────────────────────────────────────────────────

/**
 * Identity payload extracted from a stored match row. Used to compute the
 * dedupe keys across (User, Contact, duplicate-Contact) variants of the
 * same person.
 */
export interface TargetIdentityFields {
  userId?: string | null;
  contactId?: string | null;
  email?: string | null;
  linkedinUrl?: string | null;
  fullName?: string | null;
  company?: string | null;
}

/** Lowercase + collapse whitespace. */
function normName(name?: string | null): string {
  return (name || "").trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Strip company-name boilerplate so "TOKEN MASTERS FOR SOFTWARE" and
 * "Token Masters" collapse to the same fingerprint. Order of operations:
 *
 *   1. lower-case + trim
 *   2. drop legal-form suffixes (LLC, Inc, Ltd, …)
 *   3. drop common stopwords ("for software", "co", "company")
 *   4. drop punctuation
 *   5. collapse whitespace
 *
 * We keep the first 3 tokens to make "TOKEN MASTERS" a prefix match for
 * "TOKEN MASTERS FOR SOFTWARE" — both fingerprints become "token masters".
 */
function normCompany(company?: string | null): string {
  if (!company) return "";
  let s = company.toLowerCase().trim();
  s = s.replace(/[^a-z0-9& ]+/g, " ");
  s = s
    .split(/\s+/)
    .filter(
      (tok) =>
        tok &&
        ![
          "llc",
          "inc",
          "ltd",
          "co",
          "company",
          "corp",
          "corporation",
          "gmbh",
          "sa",
          "sas",
          "sarl",
          "lp",
          "llp",
          "for",
          "software",
          "tech",
          "technologies",
          "technology",
          "&",
          "and",
        ].includes(tok),
    )
    .slice(0, 3)
    .join(" ");
  return s;
}

/**
 * Build EVERY identifier the row exposes for dedupe. Cards are merged
 * whenever they share *any* identifier (union-find), so a User row with
 * email `a@b.com` collapses with a Contact row that has the same email,
 * the same LinkedIn URL, or the same `name|company` fingerprint — even
 * if the two records happen to disagree on email (which is the case the
 * user keeps hitting in the wild: Murad Abu Jamous as both a registered
 * User and a manually-entered Contact).
 *
 * High-trust keys (email, linkedin) are always included. The
 * `name|company` fingerprint is included whenever both fields are
 * present (~zero collision risk in practice). The bare-name key is the
 * last resort — only used when no email / linkedin / fingerprint exists.
 */
export function targetDedupeKeys(t: TargetIdentityFields): string[] {
  const keys: string[] = [];
  const email = (t.email || "").trim().toLowerCase();
  if (email) keys.push(`email:${email}`);
  const linkedin = (t.linkedinUrl || "")
    .trim()
    .toLowerCase()
    .replace(/\/+$/, "");
  if (linkedin) keys.push(`linkedin:${linkedin}`);
  const name = normName(t.fullName);
  const company = normCompany(t.company);
  if (name && company) keys.push(`namco:${name}|${company}`);
  // The high-trust ID lookups go AFTER the cross-record keys so that a
  // duplicate row sharing email/linkedin/namco wins over the per-row id.
  if (t.userId) keys.push(`user:${t.userId}`);
  if (t.contactId) keys.push(`contact:${t.contactId}`);
  // Bare-name only when nothing better was emitted, to avoid merging two
  // distinct people who share a common name.
  if (!email && !linkedin && !(name && company) && name) {
    keys.push(`name:${name}`);
  }
  if (!keys.length) keys.push(`anon:${Math.random().toString(36).slice(2, 10)}`);
  return keys;
}

/**
 * Backward-compatible single-key form. Returns the strongest available key.
 *
 * Prefer `targetDedupeKeys` (multi-key) for actual dedupe — see
 * `dedupeMatchesByTarget`, which now uses union-find under the hood.
 */
export function targetDedupeKey(t: TargetIdentityFields): string {
  return targetDedupeKeys(t)[0];
}

/**
 * Merge two enriched per-Looking-For results into one. For every Looking For
 * type present in either side we keep the BETTER detail object (higher
 * finalScore wins; ties broken by confidence). The merged result's
 * totalScore / bestLookingFor / overallExplanation are recomputed.
 *
 * Only `selectedLookingFor` from `primary` is preserved (both sides are
 * expected to share the same selection).
 */
export function mergeEnrichedLookingForResults(
  primary: EnrichedLookingForResult,
  other: EnrichedLookingForResult,
): EnrichedLookingForResult {
  const byType = new Map<LookingForType, LookingForScoreDetail>();
  for (const d of primary.lookingForScores) byType.set(d.lookingFor, d);
  for (const d of other.lookingForScores) {
    const existing = byType.get(d.lookingFor);
    if (
      !existing ||
      d.finalScore > existing.finalScore ||
      (d.finalScore === existing.finalScore && d.confidence > existing.confidence)
    ) {
      byType.set(d.lookingFor, d);
    }
  }

  const selected = primary.selectedLookingFor.length
    ? primary.selectedLookingFor
    : other.selectedLookingFor;

  // Re-stamp isBestMatchType after the merge so only the real winner has it.
  const merged = selected
    .map((t) => byType.get(t))
    .filter((d): d is LookingForScoreDetail => Boolean(d))
    .map((d) => ({ ...d, isBestMatchType: false }));

  const best = getBestLookingForScore(merged);
  if (best) best.isBestMatchType = true;
  const totalScore = best ? best.finalScore : 0;
  const bestType = best ? best.lookingFor : null;

  const legacyScoresMap: Record<string, number> = {};
  const legacyLabelsMap: Record<string, string> = {};
  for (const d of merged) {
    legacyScoresMap[d.id] = d.finalScore;
    legacyLabelsMap[d.id] = d.label;
  }

  return {
    selectedLookingFor: selected,
    lookingForScores: merged,
    totalScore,
    bestLookingFor: bestType,
    overallExplanation: buildOverallLookingForExplanation(
      selected,
      merged,
      totalScore,
      bestType,
    ),
    legacyScoresMap,
    legacyLabelsMap,
  };
}

/**
 * Group an array of enriched matches by canonical target identity, merging
 * per-Looking-For score details across rows that point at the same person.
 *
 * Uses MULTI-KEY UNION-FIND so two rows merge whenever they share *any*
 * dedupe key (email, LinkedIn URL, or `name|company` fingerprint), not
 * just one. This collapses the common pattern where the same person is
 * present as both a registered User and a manually-entered Contact whose
 * email and other fields disagree.
 *
 * `getIdentity(item)` extracts the identity payload from each item.
 * `getEnrichment(item)` extracts that item's per-Looking-For result.
 * `pickCanonical(a, b)` selects which of two duplicate items to keep as the
 * carrier of the merged enrichment (e.g. prefer the User over the Contact).
 *
 * Returns an array of `{ canonical, merged }` pairs in the order each group
 * was first encountered. Sorting/pagination should run AFTER this call.
 */
export function dedupeMatchesByTarget<T, E = EnrichedLookingForResult>(
  items: T[],
  opts: {
    getIdentity: (item: T) => TargetIdentityFields;
    getEnrichment: (item: T) => E | null | undefined;
    pickCanonical?: (a: T, b: T) => T;
    /**
     * Optional enrichment merger. When provided, two enrichments from the
     * same dedupe group are combined into one. When omitted the lookingFor
     * merger is used (the historical default — keeps project pages working).
     */
    mergeEnrichments?: (a: E, b: E) => E;
  },
): Array<{ canonical: T; merged: E | null }> {
  const pick = opts.pickCanonical ?? ((a) => a);
  const merge =
    opts.mergeEnrichments ??
    ((a: E, b: E) =>
      mergeEnrichedLookingForResults(
        a as unknown as EnrichedLookingForResult,
        b as unknown as EnrichedLookingForResult,
      ) as unknown as E);

  // ── Union-find on dedupe keys ────────────────────────────────────────────
  const parent = new Map<string, string>();
  const find = (k: string): string => {
    const p = parent.get(k);
    if (!p || p === k) {
      parent.set(k, k);
      return k;
    }
    const root = find(p);
    parent.set(k, root); // path compression
    return root;
  };
  const union = (a: string, b: string) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent.set(ra, rb);
  };

  // Per-row keys, kept in insertion order so the canonical row is stable.
  const itemKeys: string[][] = items.map((item) =>
    targetDedupeKeys(opts.getIdentity(item)),
  );

  // Register every key in union-find and union them within each row.
  for (const keys of itemKeys) {
    if (!keys.length) continue;
    for (const k of keys) find(k);
    for (let i = 1; i < keys.length; i++) union(keys[0], keys[i]);
  }

  // ── Group by root, preserving first-seen order ───────────────────────────
  const order: string[] = [];
  const groups = new Map<
    string,
    { canonical: T; merged: E | null }
  >();

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const keys = itemKeys[i];
    const root = keys.length ? find(keys[0]) : `anon:${i}`;
    const enrichment = (opts.getEnrichment(item) ?? null) as E | null;
    const existing = groups.get(root);
    if (!existing) {
      order.push(root);
      groups.set(root, { canonical: item, merged: enrichment });
      continue;
    }
    const canonical = pick(existing.canonical, item);
    const merged = existing.merged && enrichment
      ? merge(existing.merged, enrichment)
      : (enrichment ?? existing.merged);
    groups.set(root, { canonical, merged });
  }

  return order.map((k) => groups.get(k)!);
}

// ────────────────────────────────────────────────────────────────────────────
// EXPORTS for explanation builders (used by tests / reporting)
// ────────────────────────────────────────────────────────────────────────────

export {
  buildPerLookingForExplanation,
  buildOverallLookingForExplanation,
};
