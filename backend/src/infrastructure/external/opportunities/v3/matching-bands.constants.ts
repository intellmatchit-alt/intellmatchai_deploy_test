/**
 * IntellMatch — Match Band Constants (Job Matching)
 *
 * SINGLE SOURCE OF TRUTH for score bands within the Job Matching engine.
 *
 * Production-ready 20‑point bands:
 *   POOR:       0–20
 *   WEAK:      >20–40
 *   GOOD:      >40–60
 *   VERY_GOOD: >60–80
 *   EXCELLENT: >80–100
 *
 * These boundaries are inclusive on the lower end and exclusive on the upper end
 * except for the final band which includes 100.  They replace the previous
 * five‑band model (WEAK, GOOD, VERY_GOOD, STRONG, EXCELLENT).  There is no
 * longer a separate STRONG band.  See getMatchLevelFromScore() for exact
 * mapping behaviour.
 *
 * This file lives inside the job‑matching module to ensure that all scoring
 * logic and band definitions remain co‑located.  Do not import from
 * external shared locations.  If you need to reuse these bands elsewhere
 * in the monorepo, re‑export them via job‑matching/index.ts.
 *
 * @module job-matching/matching-bands.constants
 */

// ============================================================================
// MATCH LEVEL ENUM
// ============================================================================

/**
 * Ordered match levels from worst (POOR) to best (EXCELLENT).
 */
export enum MatchLevel {
  POOR = 'POOR',
  WEAK = 'WEAK',
  GOOD = 'GOOD',
  VERY_GOOD = 'VERY_GOOD',
  EXCELLENT = 'EXCELLENT',
}

// ============================================================================
// BAND BOUNDARIES
// ============================================================================

/**
 * Numerical boundaries for each match level.  Scores are integers in [0,100].
 * A score belongs to a level if it is >= min and <= max of that level.
 * The "greater than" notation in the documentation translates to exclusive
 * lower bounds on subsequent levels.
 */
export const MATCH_LEVEL_BOUNDARIES = {
  POOR:       { min: 0,  max: 20 },  // 0–20 inclusive
  WEAK:       { min: 21, max: 40 },  // >20–40
  GOOD:       { min: 41, max: 60 },  // >40–60
  VERY_GOOD:  { min: 61, max: 80 },  // >60–80
  EXCELLENT:  { min: 81, max: 100 }, // >80–100
} as const;

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Derive a MatchLevel from a numeric score (0–100).  Hard‑filter failures
 * must be handled before calling this.  The boundaries are defined by
 * MATCH_LEVEL_BOUNDARIES.  If a score falls outside 0–100, it will be
 * clamped internally by callers.
 */
export function getMatchLevelFromScore(score: number): MatchLevel {
  if (score >= MATCH_LEVEL_BOUNDARIES.EXCELLENT.min) return MatchLevel.EXCELLENT;
  if (score >= MATCH_LEVEL_BOUNDARIES.VERY_GOOD.min) return MatchLevel.VERY_GOOD;
  if (score >= MATCH_LEVEL_BOUNDARIES.GOOD.min) return MatchLevel.GOOD;
  if (score >= MATCH_LEVEL_BOUNDARIES.WEAK.min) return MatchLevel.WEAK;
  return MatchLevel.POOR;
}

/**
 * Human‑readable labels for each match level.  Suitable for UI or
 * explanation output.
 */
export function matchLevelLabel(level: MatchLevel): string {
  const labels: Record<MatchLevel, string> = {
    [MatchLevel.POOR]: 'Poor',
    [MatchLevel.WEAK]: 'Weak',
    [MatchLevel.GOOD]: 'Good',
    [MatchLevel.VERY_GOOD]: 'Very Good',
    [MatchLevel.EXCELLENT]: 'Excellent',
  };
  return labels[level];
}

/**
 * Return a descriptive explanation for the band assignment.  Indicates the
 * numeric score and the corresponding band range.
 */
export function bandExplanation(score: number, level: MatchLevel): string {
  const b = MATCH_LEVEL_BOUNDARIES[level];
  return `Score ${score} falls in the ${matchLevelLabel(level)} band (${b.min}–${b.max}).`;
}

// ============================================================================
// HARD FILTER STATUS
// ============================================================================

/**
 * The outcome of the hard filter step.  A FAIL will always reduce the
 * match level to POOR and prevent any AI or confidence adjustments from
 * elevating it.  WARN may down‑grade the final match level in gating.
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
 * Apply confidence and hard‑filter gating to a raw match level.  This function
 * enforces the following rules:
 *   • Hard‑filter FAIL → always POOR
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
  // Hard‑filter FAIL → always POOR
  if (hardFilterStatus === HardFilterStatus.FAIL) {
    return { level: MatchLevel.POOR, capped: true, reason: 'Hard filter failed — forced to POOR.' };
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
    [MatchLevel.POOR]: 1,
    [MatchLevel.WEAK]: 2,
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
