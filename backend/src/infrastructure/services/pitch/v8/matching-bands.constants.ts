/**
 * IntellMatch Pitch Matching Engine — Shared Matching Constants
 * v8.0.0 — production-hardened
 */

export enum MatchLevel {
  WEAK = 'WEAK',
  GOOD = 'GOOD',
  VERY_GOOD = 'VERY_GOOD',
  STRONG = 'STRONG',
  EXCELLENT = 'EXCELLENT',
}

export const MATCH_LEVEL_BOUNDARIES = {
  WEAK: { min: 0, max: 39 },
  GOOD: { min: 40, max: 59 },
  VERY_GOOD: { min: 60, max: 74 },
  STRONG: { min: 75, max: 89 },
  EXCELLENT: { min: 90, max: 100 },
} as const;

export function getMatchLevelFromScore(score: number): MatchLevel {
  if (score >= 90) return MatchLevel.EXCELLENT;
  if (score >= 75) return MatchLevel.STRONG;
  if (score >= 60) return MatchLevel.VERY_GOOD;
  if (score >= 40) return MatchLevel.GOOD;
  return MatchLevel.WEAK;
}

export function matchLevelLabel(level: MatchLevel): string {
  return { WEAK: 'Weak', GOOD: 'Good', VERY_GOOD: 'Very Good', STRONG: 'Strong', EXCELLENT: 'Excellent' }[level];
}

export function bandExplanation(score: number, level: MatchLevel): string {
  const band = MATCH_LEVEL_BOUNDARIES[level];
  return `Score ${score} falls in the ${matchLevelLabel(level)} band (${band.min}-${band.max}).`;
}

export enum HardFilterStatus {
  PASS = 'PASS',
  FAIL = 'FAIL',
  WARN = 'WARN',
}

export interface ConfidenceGates {
  excellentMinConfidence: number;
  strongMinConfidence: number;
  sparseProfileCap: MatchLevel;
  /** v8: max rank-score multiplier for sparse profiles */
  sparseRankPenalty: number;
  /** v8: max rank-score multiplier for low-confidence */
  lowConfidenceRankPenalty: number;
}

export const DEFAULT_CONFIDENCE_GATES: ConfidenceGates = {
  excellentMinConfidence: 0.78,
  strongMinConfidence: 0.62,
  sparseProfileCap: MatchLevel.GOOD,
  sparseRankPenalty: 0.78,
  lowConfidenceRankPenalty: 0.85,
};

export function rankLevel(level: MatchLevel): number {
  return { WEAK: 1, GOOD: 2, VERY_GOOD: 3, STRONG: 4, EXCELLENT: 5 }[level];
}

export function applyGating(
  rawScore: number,
  confidence: number,
  hardFilterStatus: HardFilterStatus,
  isSparse: boolean,
  gates: ConfidenceGates = DEFAULT_CONFIDENCE_GATES,
): { level: MatchLevel; capped: boolean; reason: string | null; rankPenaltyFactor: number } {
  let rankPenaltyFactor = 1.0;

  if (hardFilterStatus === HardFilterStatus.FAIL) {
    return { level: MatchLevel.WEAK, capped: true, reason: 'Hard filter failed - forced to WEAK.', rankPenaltyFactor: 0 };
  }

  let level = getMatchLevelFromScore(rawScore);

  if (isSparse) {
    rankPenaltyFactor *= gates.sparseRankPenalty;
    if (rankLevel(level) > rankLevel(gates.sparseProfileCap)) {
      return { level: gates.sparseProfileCap, capped: true, reason: `Sparse profile caps match at ${matchLevelLabel(gates.sparseProfileCap)}.`, rankPenaltyFactor };
    }
  }

  if (level === MatchLevel.EXCELLENT && confidence < gates.excellentMinConfidence) {
    rankPenaltyFactor *= gates.lowConfidenceRankPenalty;
    return { level: MatchLevel.STRONG, capped: true, reason: `Low confidence (${Math.round(confidence * 100)}%) caps EXCELLENT to STRONG.`, rankPenaltyFactor };
  }

  if (level === MatchLevel.STRONG && confidence < gates.strongMinConfidence) {
    rankPenaltyFactor *= gates.lowConfidenceRankPenalty;
    return { level: MatchLevel.VERY_GOOD, capped: true, reason: `Low confidence (${Math.round(confidence * 100)}%) caps STRONG to VERY_GOOD.`, rankPenaltyFactor };
  }

  if (hardFilterStatus === HardFilterStatus.WARN && level === MatchLevel.EXCELLENT) {
    return { level: MatchLevel.STRONG, capped: true, reason: 'Hard filter warning caps EXCELLENT to STRONG.', rankPenaltyFactor: 0.95 };
  }

  return { level, capped: false, reason: null, rankPenaltyFactor };
}

export const AI_MAX_SCORE_ADJUSTMENT = 15;

export function applyBoundedAIAdjustment(
  deterministicScore: number,
  aiScore: number,
): { adjustedScore: number; bounded: boolean } {
  const delta = aiScore - deterministicScore;
  if (Math.abs(delta) <= AI_MAX_SCORE_ADJUSTMENT) {
    return { adjustedScore: clampScore(aiScore), bounded: false };
  }
  return {
    adjustedScore: clampScore(deterministicScore + (delta > 0 ? AI_MAX_SCORE_ADJUSTMENT : -AI_MAX_SCORE_ADJUSTMENT)),
    bounded: true,
  };
}

export interface ScoringComponent {
  name: string;
  score: number;
  weight: number;
  weightedScore: number;
  explanation: string;
  confidence: number;
  evidence: string[];
  penalties: string[];
}

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
  intent_selection_summary?: string;
  alternative_intents?: string[];
  /** v8: AI reasoning exposed safely */
  ai_reasoning?: string;
  ai_green_flags?: string[];
  ai_red_flags?: string[];
  deterministic_contribution: string;
  ai_contribution: string;
}

export function buildExplanation(
  finalScore: number,
  finalLevel: MatchLevel,
  components: ScoringComponent[],
  hardFilterPenalties: string[],
  cappedReason: string | null,
  overallConfidence: number,
  intentSelectionSummary?: string,
  alternativeIntents: string[] = [],
  aiReasoning?: string,
  aiGreenFlags: string[] = [],
  aiRedFlags: string[] = [],
  deterministicScore?: number,
  aiScore?: number | null,
): MatchExplanation {
  const sorted = [...components].sort((a, b) => b.weightedScore - a.weightedScore);
  const strengths = sorted.filter(c => c.score >= 65).map(c => c.explanation).slice(0, 6);
  const gaps = sorted.filter(c => c.score < 40).map(c => c.explanation).slice(0, 6);
  const penalties = [
    ...hardFilterPenalties,
    ...sorted.flatMap(c => c.penalties),
    ...(cappedReason ? [cappedReason] : []),
  ];
  const matchedFields = sorted.filter(c => c.score >= 55).map(c => c.name);
  const uncertain = sorted.filter(c => c.confidence < 0.45).map(c => c.name);

  const summary = strengths.length > 0
    ? `This match scored ${finalScore}/100 (${matchLevelLabel(finalLevel)}). Strongest reasons: ${strengths.slice(0, 3).join('; ')}.${gaps.length ? ` Main gaps: ${gaps.slice(0, 2).join('; ')}.` : ''}${intentSelectionSummary ? ` ${intentSelectionSummary}` : ''}`
    : `This match scored ${finalScore}/100 (${matchLevelLabel(finalLevel)}). Limited strategic overlap was found.${intentSelectionSummary ? ` ${intentSelectionSummary}` : ''}`;

  const detContrib = deterministicScore != null ? `Deterministic score: ${deterministicScore}/100.` : 'Deterministic scoring only.';
  const aiContrib = aiScore != null ? `AI adjusted to ${aiScore}/100 (bounded ±${AI_MAX_SCORE_ADJUSTMENT}).` : 'No AI adjustment applied.';

  return {
    final_score: finalScore,
    final_band: finalLevel,
    band_explanation: bandExplanation(finalScore, finalLevel),
    summary_explanation: summary,
    strengths,
    gaps_or_mismatches: gaps,
    penalties,
    matched_fields: matchedFields,
    missing_or_uncertain_fields: uncertain,
    confidence_note: `Overall confidence: ${Math.round(overallConfidence * 100)}%.${uncertain.length ? ` Lower-confidence fields: ${uncertain.join(', ')}.` : ''}`,
    intent_selection_summary: intentSelectionSummary,
    alternative_intents: alternativeIntents,
    ai_reasoning: aiReasoning?.slice(0, 500),
    ai_green_flags: aiGreenFlags.slice(0, 5),
    ai_red_flags: aiRedFlags.slice(0, 5),
    deterministic_contribution: detContrib,
    ai_contribution: aiContrib,
  };
}

export function normalizeTag(value: string): string {
  return (value || '').toLowerCase().trim().replace(/[\u2010-\u2015]/g, '-').replace(/[^a-z0-9+/#&\s-]/g, ' ').replace(/\s+/g, ' ');
}

export function normalizeTags(values: string[]): string[] {
  const output: string[] = [];
  const seen = new Set<string>();
  for (const value of values || []) {
    const normalized = normalizeTag(value);
    if (normalized && !seen.has(normalized)) { seen.add(normalized); output.push(normalized); }
  }
  return output;
}

export function mergeTags(aiTags: string[], userTags: string[]): string[] {
  const user = normalizeTags(userTags);
  const userSet = new Set(user);
  const ai = normalizeTags(aiTags).filter(tag => !userSet.has(tag));
  return [...user, ...ai];
}

export const SECTOR_RELATIONSHIPS: Record<string, string[]> = {
  fintech: ['finance', 'banking', 'payments', 'insurance', 'regtech', 'wealth management'],
  regtech: ['compliance', 'banking', 'legaltech', 'fintech'],
  healthtech: ['healthcare', 'pharma', 'biotech', 'medical devices', 'digital health'],
  edtech: ['education', 'e-learning', 'training', 'academic'],
  saas: ['software', 'cloud', 'enterprise', 'b2b'],
  ecommerce: ['retail', 'consumer', 'marketplace', 'd2c', 'dtc'],
  ai: ['machine learning', 'data science', 'automation', 'nlp', 'deep learning'],
  cybersecurity: ['security', 'privacy', 'compliance', 'identity'],
  logistics: ['supply chain', 'transportation', 'shipping', 'fulfillment'],
  proptech: ['real estate', 'construction', 'property'],
  agritech: ['agriculture', 'farming', 'food'],
  cleantech: ['sustainability', 'energy', 'climate'],
  media: ['content', 'entertainment', 'publishing', 'gaming'],
};

export function areSectorsRelated(a: string, b: string): boolean {
  const na = normalizeTag(a);
  const nb = normalizeTag(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  for (const [primary, related] of Object.entries(SECTOR_RELATIONSHIPS)) {
    const variants = [primary, ...related].map(normalizeTag);
    if (variants.some(v => na.includes(v) || v.includes(na)) && variants.some(v => nb.includes(v) || v.includes(nb))) return true;
  }
  return false;
}

export function calculateCosineSimilarity(a: number[], b: number[]): number {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length === 0 || a.length !== b.length) return 0;
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; normA += a[i] * a[i]; normB += b[i] * b[i]; }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

export function clampScore(score: number): number {
  if (Number.isNaN(score) || !Number.isFinite(score)) return 0;
  return Math.max(0, Math.min(100, Math.round(score)));
}
