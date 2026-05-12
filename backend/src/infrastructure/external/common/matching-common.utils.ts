/**
 * Shared Matching Common Utilities
 *
 * Utility functions shared across all matching engines.
 *
 * @module common/matching-common.utils
 */

import {
  ConfidenceGates,
  HardFilterStatus,
  MatchLevel,
  MatchingStats,
} from './matching-common.types';

// ============================================================================
// MATCH LEVEL BOUNDARIES
// ============================================================================

const MATCH_LEVEL_BOUNDARIES = {
  POOR:      { min: 0,  max: 20 },
  WEAK:      { min: 21, max: 40 },
  GOOD:      { min: 41, max: 60 },
  VERY_GOOD: { min: 61, max: 80 },
  EXCELLENT: { min: 81, max: 100 },
} as const;

function levelRank(level: MatchLevel): number {
  const ranks: Record<MatchLevel, number> = {
    [MatchLevel.POOR]: 0,
    [MatchLevel.WEAK]: 1,
    [MatchLevel.GOOD]: 2,
    [MatchLevel.VERY_GOOD]: 3,
    [MatchLevel.EXCELLENT]: 4,
  };
  return ranks[level];
}

function getMatchLevelFromScore(score: number): MatchLevel {
  if (score >= MATCH_LEVEL_BOUNDARIES.EXCELLENT.min) return MatchLevel.EXCELLENT;
  if (score >= MATCH_LEVEL_BOUNDARIES.VERY_GOOD.min) return MatchLevel.VERY_GOOD;
  if (score >= MATCH_LEVEL_BOUNDARIES.GOOD.min) return MatchLevel.GOOD;
  if (score >= MATCH_LEVEL_BOUNDARIES.WEAK.min) return MatchLevel.WEAK;
  return MatchLevel.POOR;
}

// ============================================================================
// determineMatchLevel
// ============================================================================

/**
 * Determines the final match level from a numeric score, applying confidence
 * gates, hard-filter status, and sparse-profile caps.
 *
 * Returns both the resolved level and a human-readable reason when the level
 * was capped or downgraded.
 */
export function determineMatchLevel(
  score: number,
  confidence: number,
  hardFilterStatus: HardFilterStatus,
  isSparse: boolean,
  gates: ConfidenceGates,
): { level: MatchLevel; reason: string | null } {
  // Hard-filter FAIL always forces POOR
  if (hardFilterStatus === HardFilterStatus.FAIL) {
    return { level: MatchLevel.POOR, reason: 'Hard filter failed — forced to POOR.' };
  }

  let level = getMatchLevelFromScore(score);

  // Sparse profile cap
  if (isSparse && levelRank(level) > levelRank(gates.sparseProfileCap)) {
    return {
      level: gates.sparseProfileCap,
      reason: `Sparse profile caps match at ${gates.sparseProfileCap}.`,
    };
  }

  // Low data quality cap (if configured)
  if (gates.lowDataQualityCap && hardFilterStatus === HardFilterStatus.REVIEW) {
    if (levelRank(level) > levelRank(gates.lowDataQualityCap)) {
      return {
        level: gates.lowDataQualityCap,
        reason: `Low data quality caps match at ${gates.lowDataQualityCap}.`,
      };
    }
  }

  // Confidence gates: EXCELLENT -> VERY_GOOD
  if (level === MatchLevel.EXCELLENT && confidence < gates.excellentMinConfidence) {
    return {
      level: MatchLevel.VERY_GOOD,
      reason: `Low confidence (${(confidence * 100).toFixed(0)}%) caps EXCELLENT to VERY_GOOD.`,
    };
  }

  // Confidence gates: VERY_GOOD -> GOOD
  if (level === MatchLevel.VERY_GOOD && confidence < gates.veryGoodMinConfidence) {
    return {
      level: MatchLevel.GOOD,
      reason: `Low confidence (${(confidence * 100).toFixed(0)}%) caps VERY_GOOD to GOOD.`,
    };
  }

  // Confidence gates: GOOD -> WEAK
  if (level === MatchLevel.GOOD && confidence < gates.goodMinConfidence) {
    return {
      level: MatchLevel.WEAK,
      reason: `Low confidence (${(confidence * 100).toFixed(0)}%) caps GOOD to WEAK.`,
    };
  }

  // Hard filter REVIEW caps EXCELLENT -> VERY_GOOD
  if (hardFilterStatus === HardFilterStatus.REVIEW && level === MatchLevel.EXCELLENT) {
    return {
      level: MatchLevel.VERY_GOOD,
      reason: 'Hard filter review caps EXCELLENT to VERY_GOOD.',
    };
  }

  return { level, reason: null };
}

// ============================================================================
// applyBoundedAIAdjustment
// ============================================================================

/**
 * Applies a bounded AI score delta to a deterministic score.
 * The delta is clamped to [-maxDelta, +maxDelta] and the result is
 * clamped to [0, 100].
 *
 * @param deterministicScore - The base deterministic score (0-100)
 * @param aiDelta - The AI adjustment delta (can be negative)
 * @param maxDelta - Maximum absolute delta allowed (default 15)
 * @returns The adjusted final score, clamped to [0, 100]
 */
export function applyBoundedAIAdjustment(
  deterministicScore: number,
  aiDelta: number,
  maxDelta: number = 15,
): number {
  if (!Number.isFinite(aiDelta)) return deterministicScore;
  const clampedDelta = Math.max(-maxDelta, Math.min(maxDelta, aiDelta));
  const adjusted = deterministicScore + clampedDelta;
  return Math.max(0, Math.min(100, Math.round(adjusted)));
}

// ============================================================================
// assignRanks
// ============================================================================

/**
 * Assigns sequential 1-based rank numbers to an array of match results.
 * Assumes the array is already sorted in descending score order.
 * Mutates items in-place and also returns the array.
 */
export function assignRanks<T extends { rank?: number }>(items: T[]): T[] {
  for (let i = 0; i < items.length; i++) {
    items[i].rank = i + 1;
  }
  return items;
}

// ============================================================================
// createEmptyStats
// ============================================================================

/**
 * Creates a zeroed-out MatchingStats object for accumulation during
 * the matching pipeline.
 */
export function createEmptyStats(): MatchingStats {
  return {
    totalCandidates: 0,
    passedHardFilters: 0,
    failedHardFilters: 0,
    reviewCandidates: 0,
    scoredCandidates: 0,
    filteredOutDeterministic: 0,
    filteredOutPostAI: 0,
    finalMatches: 0,
    avgScore: 0,
    avgConfidence: 0,
    processingTimeMs: 0,
  };
}

// ============================================================================
// generateMatchId
// ============================================================================

/**
 * Generates a unique match ID from source, target, and context.
 * Appends a timestamp and random suffix to ensure uniqueness.
 */
export function generateMatchId(
  sourceId: string,
  targetId: string,
  context: string = '',
): string {
  const suffix = Math.random().toString(36).slice(2, 8);
  const ts = Date.now();
  const parts = [sourceId, targetId, context, String(ts), suffix].filter(Boolean);
  return parts.join('_');
}

// ============================================================================
// getExpiryDate
// ============================================================================

/**
 * Returns a Date that is `days` days from now.
 */
export function getExpiryDate(days: number): Date {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

// ============================================================================
// isSparseRecord
// ============================================================================

/**
 * Determines whether a record should be considered "sparse" based on
 * its data quality score relative to a threshold.
 *
 * @param dataQualityScore - The record's data quality score (0-100)
 * @param threshold - The sparse-record threshold from config
 * @returns true if the record is sparse
 */
export function isSparseRecord(
  dataQualityScore: number,
  threshold: number,
): boolean {
  return (dataQualityScore || 0) < threshold;
}
