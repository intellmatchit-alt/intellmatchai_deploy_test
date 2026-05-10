/**
 * IntellMatch — Match Band Constants (Job Matching)
 *
 * SINGLE SOURCE OF TRUTH for score bands within the Job Matching engine.
 *
 * Spec-mandated 5-band model (Phase 5 migration):
 *   WEAK:      0–39    (was POOR 0–20 + old WEAK 21–40)
 *   PARTIAL:   40–54   (NEW band — replaces old GOOD's lower half)
 *   GOOD:      55–69   (was old GOOD 41–60 upper + old VERY_GOOD 61–69)
 *   VERY_GOOD: 70–84   (was old VERY_GOOD 61–80 upper + old EXCELLENT 81–84)
 *   EXCELLENT: 85–100  (was old EXCELLENT 81–100 upper)
 *
 * `MatchLevel.POOR` is retained on the enum for backward-compatible
 * hydration of legacy saved rows. New code MUST NOT emit it —
 * `getMatchLevelFromScore` and `applyGating` only emit the 5 spec bands.
 * The Prisma `JobMatchLevel` enum mirrors this: POOR is kept so legacy
 * rows continue to read, PARTIAL is the new value.
 *
 * This file lives inside the job-matching module to ensure that all scoring
 * logic and band definitions remain co-located. Do not import from
 * external shared locations. If you need to reuse these bands elsewhere
 * in the monorepo, re-export them via job-matching/index.ts.
 *
 * @module job-matching/matching-bands.constants
 */

// ============================================================================
// MATCH LEVEL ENUM
// ============================================================================

/**
 * Ordered match levels from worst to best. POOR is retained for legacy
 * hydration only — see file header. PARTIAL is the new low-tier band.
 */
export enum MatchLevel {
  /** @deprecated Legacy band. Retained for hydration of pre-migration rows.
   *  Never emitted by getMatchLevelFromScore() or applyGating() in new code. */
  POOR = 'POOR',
  WEAK = 'WEAK',
  PARTIAL = 'PARTIAL',
  GOOD = 'GOOD',
  VERY_GOOD = 'VERY_GOOD',
  EXCELLENT = 'EXCELLENT',
}

// ============================================================================
// BAND BOUNDARIES
// ============================================================================

/**
 * Numerical boundaries for each match level. Scores are integers in [0,100].
 * A score belongs to a level if it is >= min and <= max of that level.
 *
 * POOR is intentionally excluded from this map — it's a legacy hydration
 * value only. getMatchLevelFromScore() never returns POOR.
 */
export const MATCH_LEVEL_BOUNDARIES = {
  WEAK:       { min: 0,  max: 39 },
  PARTIAL:    { min: 40, max: 54 },
  GOOD:       { min: 55, max: 69 },
  VERY_GOOD:  { min: 70, max: 84 },
  EXCELLENT:  { min: 85, max: 100 },
} as const;

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Derive a MatchLevel from a numeric score (0–100). Hard-filter failures
 * must be handled before calling this. The boundaries are defined by
 * MATCH_LEVEL_BOUNDARIES.
 */
export function getMatchLevelFromScore(score: number): MatchLevel {
  if (score >= MATCH_LEVEL_BOUNDARIES.EXCELLENT.min) return MatchLevel.EXCELLENT;
  if (score >= MATCH_LEVEL_BOUNDARIES.VERY_GOOD.min) return MatchLevel.VERY_GOOD;
  if (score >= MATCH_LEVEL_BOUNDARIES.GOOD.min) return MatchLevel.GOOD;
  if (score >= MATCH_LEVEL_BOUNDARIES.PARTIAL.min) return MatchLevel.PARTIAL;
  return MatchLevel.WEAK;
}

/**
 * Human-readable labels for each match level. Suitable for UI or
 * explanation output.
 */
export function matchLevelLabel(level: MatchLevel): string {
  const labels: Record<MatchLevel, string> = {
    [MatchLevel.POOR]: 'Weak',          // Legacy rows display as "Weak"
    [MatchLevel.WEAK]: 'Weak',
    [MatchLevel.PARTIAL]: 'Partial',
    [MatchLevel.GOOD]: 'Good',
    [MatchLevel.VERY_GOOD]: 'Very Good',
    [MatchLevel.EXCELLENT]: 'Excellent',
  };
  return labels[level];
}

/**
 * Return a descriptive explanation for the band assignment. Indicates the
 * numeric score and the corresponding band range.
 *
 * Legacy POOR rows render the WEAK band range since POOR is collapsed into
 * WEAK on display.
 */
export function bandExplanation(score: number, level: MatchLevel): string {
  const effective = level === MatchLevel.POOR ? MatchLevel.WEAK : level;
  const b = (MATCH_LEVEL_BOUNDARIES as Record<string, { min: number; max: number }>)[effective];
  if (!b) return `Score ${score} falls in the ${matchLevelLabel(level)} band.`;
  return `Score ${score} falls in the ${matchLevelLabel(level)} band (${b.min}–${b.max}).`;
}

// ============================================================================
// HARD FILTER STATUS
// ============================================================================

/**
 * The outcome of the hard filter step. A FAIL caps the match level to
 * WEAK (the new low band) and prevents AI/confidence adjustments from
 * elevating it. WARN may down-grade the final match level in gating.
 */
export enum HardFilterStatus {
  PASS = 'PASS',
  FAIL = 'FAIL',
  WARN = 'WARN',
}

// ============================================================================
// CONFIDENCE GATING
// ============================================================================

/**
 * Configuration for confidence‑based gating.  If the confidence of a match
 * is below a threshold, the level may be reduced.  Note that the legacy
 * property name `strongMinConfidence` is retained for backward
 * compatibility but now applies to the VERY_GOOD→GOOD transition.
 */
export interface ConfidenceGates {
  /** Minimum confidence required to retain an EXCELLENT rating; otherwise
   *  the level is demoted to VERY_GOOD. */
  excellentMinConfidence: number;
  /** Minimum confidence required to retain a VERY_GOOD rating; otherwise
   *  the level is demoted to GOOD.  Property name kept for compatibility. */
  strongMinConfidence: number;
  /** Maximum level for sparse profiles; matches above this level are capped. */
  sparseProfileCap: MatchLevel;
}

export const DEFAULT_CONFIDENCE_GATES: ConfidenceGates = {
  excellentMinConfidence: 0.75,
  strongMinConfidence: 0.60,
  sparseProfileCap: MatchLevel.GOOD,
};

/**
 * Apply confidence and hard-filter gating to a raw match level. This function
 * enforces the following rules:
 *   • Hard-filter FAIL → always WEAK (no POOR in the spec band system)
 *   • Sparse profiles cannot exceed the configured cap
 *   • Low confidence demotes EXCELLENT→VERY_GOOD and VERY_GOOD→GOOD
 *   • Hard filter WARN demotes EXCELLENT→VERY_GOOD
 */
export function applyGating(
  rawScore: number,
  confidence: number,
  hardFilterStatus: HardFilterStatus,
  isSparse: boolean,
  gates: ConfidenceGates = DEFAULT_CONFIDENCE_GATES,
): { level: MatchLevel; capped: boolean; reason: string | null } {
  // Hard-filter FAIL → forced to WEAK (lowest spec band)
  if (hardFilterStatus === HardFilterStatus.FAIL) {
    return { level: MatchLevel.WEAK, capped: true, reason: 'Hard filter failed — forced to WEAK.' };
  }

  let level = getMatchLevelFromScore(rawScore);

  // Sparse profile cap
  if (isSparse && levelRank(level) > levelRank(gates.sparseProfileCap)) {
    return {
      level: gates.sparseProfileCap,
      capped: true,
      reason: `Sparse profile caps match at ${matchLevelLabel(gates.sparseProfileCap)}.`,
    };
  }

  // Low confidence caps EXCELLENT → VERY_GOOD
  if (level === MatchLevel.EXCELLENT && confidence < gates.excellentMinConfidence) {
    return {
      level: MatchLevel.VERY_GOOD,
      capped: true,
      reason: `Low confidence (${(confidence * 100).toFixed(0)}%) caps EXCELLENT → VERY_GOOD.`,
    };
  }

  // Low confidence caps VERY_GOOD → GOOD
  if (level === MatchLevel.VERY_GOOD && confidence < gates.strongMinConfidence) {
    return {
      level: MatchLevel.GOOD,
      capped: true,
      reason: `Low confidence (${(confidence * 100).toFixed(0)}%) caps VERY_GOOD → GOOD.`,
    };
  }

  // Hard filter WARN caps EXCELLENT → VERY_GOOD
  if (hardFilterStatus === HardFilterStatus.WARN && level === MatchLevel.EXCELLENT) {
    return {
      level: MatchLevel.VERY_GOOD,
      capped: true,
      reason: 'Hard filter warning caps EXCELLENT → VERY_GOOD.',
    };
  }

  return { level, capped: false, reason: null };
}

function levelRank(l: MatchLevel): number {
  const ranks: Record<MatchLevel, number> = {
    // Legacy POOR ranks alongside WEAK for ordering purposes — they're
    // the same tier on display.
    [MatchLevel.POOR]: 1,
    [MatchLevel.WEAK]: 1,
    [MatchLevel.PARTIAL]: 2,
    [MatchLevel.GOOD]: 3,
    [MatchLevel.VERY_GOOD]: 4,
    [MatchLevel.EXCELLENT]: 5,
  };
  return ranks[l];
}

// ============================================================================
// AI SCORE ADJUSTMENT BOUNDS
// ============================================================================

/**
 * Maximum absolute difference between deterministic and AI‑adjusted scores.
 * This prevents the AI layer from overly inflating or deflating scores.
 */
export const AI_MAX_SCORE_ADJUSTMENT = 15;

export function applyBoundedAIAdjustment(
  deterministicScore: number,
  aiScore: number,
): { adjustedScore: number; bounded: boolean } {
  const diff = aiScore - deterministicScore;
  if (Math.abs(diff) <= AI_MAX_SCORE_ADJUSTMENT) {
    return { adjustedScore: Math.max(0, Math.min(100, aiScore)), bounded: false };
  }
  const clamped = deterministicScore + (diff > 0 ? AI_MAX_SCORE_ADJUSTMENT : -AI_MAX_SCORE_ADJUSTMENT);
  return { adjustedScore: Math.max(0, Math.min(100, Math.round(clamped))), bounded: true };
}

// ============================================================================
// TAG UTILITIES
// ============================================================================

/** Normalize a tag: lowercase, trim whitespace, collapse internal spaces. */
export function normalizeTag(tag: string): string {
  return tag.toLowerCase().trim().replace(/\s+/g, ' ');
}

/** Deduplicate and normalize a list of tags. */
export function normalizeTags(tags: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of tags) {
    const n = normalizeTag(raw);
    if (n && !seen.has(n)) {
      seen.add(n);
      result.push(n);
    }
  }
  return result;
}

/** Merge AI‑generated tags with user‑supplied tags.  User tags take priority; duplicates (after normalization) are removed. */
export function mergeTags(aiTags: string[], userTags: string[]): string[] {
  const userNormalized = normalizeTags(userTags);
  const userSet = new Set(userNormalized);
  const aiNormalized = normalizeTags(aiTags).filter(t => !userSet.has(t));
  return [...userNormalized, ...aiNormalized];
}

// ============================================================================
// SECTOR RELATIONSHIPS (shared logic)
// ============================================================================

/**
 * Basic domain relationships used for domain/industry matching.  Keys are
 * canonical sector names; values are arrays of related keywords.  Feel free to
 * extend this list to improve matching across similar domains.
 */
export const SECTOR_RELATIONSHIPS: Record<string, string[]> = {
  fintech: ['finance', 'banking', 'payments', 'insurance', 'crypto', 'wealth management'],
  healthtech: ['healthcare', 'pharma', 'biotech', 'medical devices', 'digital health'],
  edtech: ['education', 'e-learning', 'training', 'academic'],
  saas: ['software', 'cloud', 'enterprise', 'b2b'],
  ecommerce: ['retail', 'consumer', 'marketplace', 'dtc', 'd2c'],
  ai: ['machine learning', 'data science', 'automation', 'nlp', 'deep learning'],
  cybersecurity: ['security', 'privacy', 'compliance', 'infosec'],
  cleantech: ['sustainability', 'energy', 'climate', 'green'],
  proptech: ['real estate', 'construction', 'property'],
  agritech: ['agriculture', 'farming', 'food tech'],
  legaltech: ['legal', 'law', 'compliance'],
  logistics: ['supply chain', 'transportation', 'shipping', 'fulfilment'],
  media: ['entertainment', 'content', 'publishing', 'gaming'],
  telecom: ['telecommunications', 'connectivity', '5g', 'iot'],
};

/**
 * Determine whether two sector/domain strings are related.  Performs a
 * case‑insensitive substring match against the sector relationships map.  If
 * both input strings fall under the same primary sector or its related
 * keywords, they are considered related.
 */
export function areSectorsRelated(a: string, b: string): boolean {
  const na = a.toLowerCase().trim();
  const nb = b.toLowerCase().trim();
  if (na === nb) return true;
  for (const [primary, related] of Object.entries(SECTOR_RELATIONSHIPS)) {
    const all = [primary, ...related];
    const matchA = all.some(s => na.includes(s) || s.includes(na));
    const matchB = all.some(s => nb.includes(s) || s.includes(nb));
    if (matchA && matchB) return true;
  }
  return false;
}

// ============================================================================
// COSINE SIMILARITY
// ============================================================================

export function calculateCosineSimilarity(a: number[], b: number[]): number {
  if (!a || !b || a.length !== b.length || a.length === 0) return 0;
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

// ============================================================================
// EXPLANATION BUILDER
// ============================================================================

export interface MatchExplanation {
  final_score: number;
  final_band: MatchLevel;
  band_explanation: string;
  summary_explanation: string;
  strengths: string[];
  gaps_or_mismatches: string[];
  penalties: string[];
  matched_fields: string[];
  missing_or_uncertain_fields: string[];
  confidence_note: string;
}

export interface ScoringComponent {
  name: string;
  score: number;       // 0‑100
  weight: number;      // 0–1
  weightedScore: number;
  explanation: string;
  confidence: number;  // 0–1
  evidence: string[];
  penalties: string[];
}

export function buildExplanation(
  finalScore: number,
  finalLevel: MatchLevel,
  components: ScoringComponent[],
  hardFilterPenalties: string[],
  cappedReason: string | null,
  overallConfidence: number,
): MatchExplanation {
  const sorted = [...components].sort((a, b) => b.weightedScore - a.weightedScore);
  const strengths = sorted.filter(c => c.score >= 60).map(c => c.explanation);
  const gaps = sorted.filter(c => c.score < 40).map(c => c.explanation);
  const penalties = [
    ...hardFilterPenalties,
    ...components.flatMap(c => c.penalties),
    ...(cappedReason ? [cappedReason] : []),
  ];
  const matched = sorted.filter(c => c.score >= 50).map(c => c.name);
  const missing = sorted.filter(c => c.confidence < 0.4).map(c => c.name);

  const summary = strengths.length > 0
    ? `This match scored ${finalScore}/100 (${matchLevelLabel(finalLevel)}). Top strengths: ${strengths.slice(0, 3).join('; ')}. ${gaps.length > 0 ? `Key gaps: ${gaps.slice(0, 2).join('; ')}.` : ''}`
    : `This match scored ${finalScore}/100 (${matchLevelLabel(finalLevel)}). Limited overlap was detected across scored fields.`;

  return {
    final_score: finalScore,
    final_band: finalLevel,
    band_explanation: bandExplanation(finalScore, finalLevel),
    summary_explanation: summary,
    strengths,
    gaps_or_mismatches: gaps,
    penalties,
    matched_fields: matched,
    missing_or_uncertain_fields: missing,
    confidence_note: `Overall confidence: ${(overallConfidence * 100).toFixed(0)}%.${missing.length > 0 ? ` Uncertain fields: ${missing.join(', ')}.` : ''}`,
  };
}
