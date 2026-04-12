/**
 * Deal Matching Engine — Common Types & Utilities
 * v4.0.0 — strict final production
 */

// ============================================================================
// SCORE BANDS
// ============================================================================

export enum ScoreBand {
  STRONG = 'STRONG',
  GOOD = 'GOOD',
  CONDITIONAL = 'CONDITIONAL',
  WEAK = 'WEAK',
}

export function getScoreBand(score: number): ScoreBand {
  if (score >= 75) return ScoreBand.STRONG;
  if (score >= 55) return ScoreBand.GOOD;
  if (score >= 35) return ScoreBand.CONDITIONAL;
  return ScoreBand.WEAK;
}

export function scoreBandLabel(band: ScoreBand): string {
  return { STRONG: 'Strong Match', GOOD: 'Good Match', CONDITIONAL: 'Conditional Match', WEAK: 'Weak Match' }[band];
}

/** v4: Surfaced status — distinct from score band */
export enum SurfacedStatus {
  PASS = 'PASS',
  REVIEW = 'REVIEW',
  SUPPRESSED = 'SUPPRESSED',
}

// ============================================================================
// HARD FILTERS
// ============================================================================

export enum HardFilterStatus {
  PASS = 'PASS',
  FAIL = 'FAIL',
  REVIEW = 'REVIEW',
}

export enum HardFilterReason {
  NONE = 'NONE',
  BLOCKED = 'BLOCKED',
  OPT_OUT = 'OPT_OUT',
  CATEGORY_MISMATCH = 'CATEGORY_MISMATCH',
  BUDGET_MISMATCH = 'BUDGET_MISMATCH',
  REQUIREMENTS_NOT_MET = 'REQUIREMENTS_NOT_MET',
  SPARSE_DATA = 'SPARSE_DATA',
  PROVIDER_TYPE_MISMATCH = 'PROVIDER_TYPE_MISMATCH',
  DELIVERY_MISMATCH = 'DELIVERY_MISMATCH',
  TIMELINE_MISMATCH = 'TIMELINE_MISMATCH',
  LOCATION_MISMATCH = 'LOCATION_MISMATCH',
}

export interface HardFilterResult {
  status: HardFilterStatus;
  reason: HardFilterReason;
  details: string;
  evidence: string[];
}

export function createPassResult(): HardFilterResult {
  return { status: HardFilterStatus.PASS, reason: HardFilterReason.NONE, details: '', evidence: [] };
}
export function createFailResult(reason: HardFilterReason, details: string, evidence: string[]): HardFilterResult {
  return { status: HardFilterStatus.FAIL, reason, details, evidence };
}
export function createReviewResult(reason: HardFilterReason, details: string, evidence: string[]): HardFilterResult {
  return { status: HardFilterStatus.REVIEW, reason, details, evidence };
}
export function combineHardFilterResults(results: HardFilterResult[]): HardFilterResult {
  const fail = results.find(r => r.status === HardFilterStatus.FAIL);
  if (fail) return fail;
  const review = results.find(r => r.status === HardFilterStatus.REVIEW);
  if (review) return review;
  return createPassResult();
}

// ============================================================================
// SCORING
// ============================================================================

export interface ScoringComponent {
  name: string;
  score: number;
  weight: number;
  confidence: number;
  explanation: string;
  matchedItems: string[];
  missingItems: string[];
  penalties: string[];
}

export interface ScoreBreakdown {
  components: ScoringComponent[];
  rawScore: number;
  normalizedScore: number;
  confidence: number;
  totalWeight: number;
  missingComponents: string[];
  penalties: string[];
}

export interface FieldMatch {
  source_field: string;
  target_field: string;
  source_value: unknown;
  target_value: unknown;
  match_type: 'EXACT' | 'PARTIAL' | 'COMPATIBLE' | 'NONE';
  score: number;
}

// ============================================================================
// BAND GATING
// ============================================================================

function rankBand(band: ScoreBand): number {
  return { WEAK: 0, CONDITIONAL: 1, GOOD: 2, STRONG: 3 }[band];
}

export function applyBandGating(
  rawBand: ScoreBand,
  confidence: number,
  isSparse: boolean,
  opts: { strongMinConfidence: number; sparseMaxBand: ScoreBand },
): { effectiveBand: ScoreBand; downgradeReason: string | null } {
  let band = rawBand;
  let reason: string | null = null;

  if (isSparse && rankBand(band) > rankBand(opts.sparseMaxBand)) {
    band = opts.sparseMaxBand;
    reason = `Sparse profile caps band at ${scoreBandLabel(band)}.`;
  }

  if (band === ScoreBand.STRONG && confidence < opts.strongMinConfidence) {
    band = ScoreBand.GOOD;
    reason = `Low confidence (${Math.round(confidence * 100)}%) caps STRONG to GOOD.`;
  }

  return { effectiveBand: band, downgradeReason: reason };
}

// ============================================================================
// MATCH EXPLANATION — v4: includes surfacedStatus, semantic sub-scores
// ============================================================================

export interface MatchExplanation {
  summary: string;
  finalScore: number;
  scoreBand: ScoreBand;
  surfacedStatus: SurfacedStatus;
  strengths: string[];
  weaknesses: string[];
  missingFields: string[];
  penalties: string[];
  confidenceNote: string;
  fieldMatches: FieldMatch[];
  commercialFitSummary: string;
  requirementsCoverageSummary: string;
  semanticFitSummary: string;
  downgradeReason: string | null;
  /** v4: per-field semantic sub-score evidence */
  semanticSubScores: { field: string; score: number; explanation: string }[];
}

export function generateMatchExplanation(
  finalScore: number,
  effectiveBand: ScoreBand,
  surfacedStatus: SurfacedStatus,
  components: ScoringComponent[],
  hardFilter: HardFilterResult,
  fieldMatches: FieldMatch[],
  missingFields: string[],
  downgradeReason: string | null,
  semanticSubScores: { field: string; score: number; explanation: string }[] = [],
): MatchExplanation {
  const sorted = [...components].sort((a, b) => b.score * b.weight - a.score * a.weight);
  const strengths = sorted.filter(c => c.score >= 65).map(c => c.explanation).slice(0, 5);
  const weaknesses = sorted.filter(c => c.score < 40).map(c => c.explanation).slice(0, 5);
  const penalties = [
    ...sorted.flatMap(c => c.penalties),
    ...(hardFilter.status === HardFilterStatus.REVIEW ? [`Review: ${hardFilter.details}`] : []),
    ...(downgradeReason ? [downgradeReason] : []),
  ];
  const avgConfidence = components.length ? components.reduce((s, c) => s + c.confidence, 0) / components.length : 0;

  const category = components.find(c => c.name === 'categoryScore');
  const budget = components.find(c => c.name === 'budgetScore');
  const timeline = components.find(c => c.name === 'timelineScore');
  const reqs = components.find(c => c.name === 'requirementsScore');
  const semantic = components.find(c => c.name === 'semanticScore');

  const commercialFitSummary = [category ? `Category: ${category.explanation}` : '', budget ? `Budget: ${budget.explanation}` : '', timeline ? `Timeline: ${timeline.explanation}` : ''].filter(Boolean).join('. ');
  const requirementsCoverageSummary = reqs ? `${reqs.explanation}. Matched: ${reqs.matchedItems.join(', ') || 'none'}. Missing: ${reqs.missingItems.join(', ') || 'none'}.` : 'No requirements data.';
  const semanticFitSummary = semantic ? semantic.explanation : 'No semantic comparison.';
  const bandLabel = scoreBandLabel(effectiveBand);

  let summary: string;
  if (surfacedStatus === SurfacedStatus.SUPPRESSED) {
    summary = `Score ${finalScore}/100 — SUPPRESSED. ${downgradeReason || 'Below confidence threshold.'}`;
  } else {
    summary = strengths.length
      ? `Score ${finalScore}/100 (${bandLabel}). Top: ${strengths.slice(0, 3).join('; ')}.${weaknesses.length ? ` Gaps: ${weaknesses.slice(0, 2).join('; ')}.` : ''}${downgradeReason ? ` Note: ${downgradeReason}` : ''}`
      : `Score ${finalScore}/100 (${bandLabel}). Limited alignment.${downgradeReason ? ` Note: ${downgradeReason}` : ''}`;
  }

  return {
    summary, finalScore, scoreBand: effectiveBand, surfacedStatus, strengths, weaknesses,
    missingFields, penalties,
    confidenceNote: `Confidence: ${Math.round(avgConfidence * 100)}%.${missingFields.length ? ` Missing: ${missingFields.slice(0, 3).join(', ')}.` : ''}`,
    fieldMatches, commercialFitSummary, requirementsCoverageSummary, semanticFitSummary,
    downgradeReason, semanticSubScores,
  };
}

// ============================================================================
// MATCH RESULT & RESPONSE
// ============================================================================

export interface BaseMatchResult {
  id: string; sourceId: string; targetId: string;
  finalScore: number; scoreBand: ScoreBand; surfacedStatus: SurfacedStatus;
  confidence: number;
  hardFilterStatus: HardFilterStatus; hardFilterReason: HardFilterReason | null;
  scoreBreakdown: ScoreBreakdown; explanation: MatchExplanation;
  rank: number; createdAt: Date; expiresAt: Date;
}

export interface MatchingStats {
  totalCandidates: number; passedHardFilters: number; failedHardFilters: number;
  reviewCandidates: number; scoredCandidates: number;
  suppressedByConfidence: number; suppressedByScore: number;
  finalMatches: number;
  avgScore: number; avgConfidence: number; processingTimeMs: number;
}

export interface MatchResponse<T> {
  success: boolean; matches: T[]; totalCandidates: number;
  filteredCount: number; processingTimeMs: number; stats: MatchingStats;
}

// ============================================================================
// AUTH CONTEXT
// ============================================================================

export interface AuthContext {
  userId: string;
  organizationId?: string;
}

// ============================================================================
// TAGS
// ============================================================================

export interface TagSet { ai: string[]; user: string[]; merged: string[]; }

export function normalizeTag(tag: string): string {
  return (tag || '').toLowerCase().trim().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-');
}

export function mergeTags(aiTags: string[], userTags: string[], existing: string[]): TagSet {
  const userNorm = userTags.map(normalizeTag).filter(Boolean);
  const aiNorm = aiTags.map(normalizeTag).filter(Boolean);
  const all = new Set([...userNorm, ...aiNorm, ...existing.map(normalizeTag).filter(Boolean)]);
  return { ai: aiNorm, user: userNorm, merged: Array.from(all) };
}

export function extractTagsFromText(text: string, maxTags = 5): string[] {
  const stop = new Set(['the', 'and', 'for', 'with', 'from', 'that', 'this', 'our', 'your', 'are', 'can', 'will', 'need', 'help', 'want']);
  const words = text.toLowerCase().replace(/[^a-z0-9\s-]/g, ' ').split(/\s+/).filter(w => w.length > 3 && !stop.has(w));
  const freq = new Map<string, number>();
  for (const w of words) freq.set(w, (freq.get(w) || 0) + 1);
  return [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, maxTags).map(([w]) => w);
}

// ============================================================================
// EXTRACTION
// ============================================================================

export interface ExtractionResult<T> {
  success: boolean; data: Partial<T>; confidence: Record<string, number>;
  extractedFields: string[]; missingFields: string[]; uncertainFields: string[];
  provenance: Record<string, string>; errors: string[];
}

export interface ExtractionConfig {
  llmProvider: string; maxRetries: number; confidenceThreshold: number; fallbackBehavior: string;
}

// ============================================================================
// API
// ============================================================================

export interface ApiResponse<T> {
  success: boolean; data?: T;
  error?: { code: string; message: string; details?: unknown };
  meta?: { timestamp: string; requestId?: string; processingTimeMs?: number };
}

export interface ValidationError { field: string; message: string; code: string; }

// ============================================================================
// UTILITIES
// ============================================================================

export function generateMatchId(prefix: string, sourceId: string, targetId: string): string {
  return `${prefix}_${sourceId}_${targetId}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

export function getExpiryDate(days: number): Date {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

export function clampScore(score: number): number {
  if (Number.isNaN(score) || !Number.isFinite(score)) return 0;
  return Math.max(0, Math.min(100, Math.round(score)));
}

export function calculateTagOverlap(source: string[], target: string[]): { score: number; matched: string[]; unmatched: string[] } {
  if (!source.length || !target.length) return { score: 0, matched: [], unmatched: [...source] };
  const tNorm = target.map(t => t.toLowerCase().trim());
  const matched: string[] = []; const unmatched: string[] = [];
  for (const s of source) {
    const sn = s.toLowerCase().trim();
    if (tNorm.some(t => t === sn || t.includes(sn) || sn.includes(t))) matched.push(s); else unmatched.push(s);
  }
  return { score: source.length ? Math.round((matched.length / source.length) * 100) : 0, matched, unmatched };
}

export function textSimilarity(a: string, b: string): number {
  const stop = new Set(['the', 'and', 'for', 'with', 'from', 'that', 'this', 'our', 'your', 'are', 'can', 'will', 'need', 'help', 'want', 'looking', 'seeking']);
  const tokenize = (t: string) => t.toLowerCase().replace(/[^a-z0-9\s-]/g, ' ').split(/\s+/).filter(w => w.length > 2 && !stop.has(w));
  const tA = new Set(tokenize(a)); const tB = new Set(tokenize(b));
  if (!tA.size || !tB.size) return 0;
  let overlap = 0; for (const t of tA) if (tB.has(t)) overlap++;
  return overlap / Math.max(tA.size, tB.size);
}
