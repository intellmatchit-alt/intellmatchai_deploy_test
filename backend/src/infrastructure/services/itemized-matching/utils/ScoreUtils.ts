/**
 * Score Utilities
 *
 * Helper functions for score calculations and status derivation.
 *
 * @module infrastructure/services/itemized-matching/utils/ScoreUtils
 */

import { MatchStatus, MatchSummary, CriterionMatch } from '../../../../domain/services/IItemizedMatchingService';
import { scoreToStatus as sharedScoreToStatus } from '../../../../shared/matching';

/**
 * Convert a score (0-100) to a MatchStatus.
 * Delegates to SharedMatchingUtils for consistency.
 */
export function scoreToStatus(score: number): MatchStatus {
  return sharedScoreToStatus(score) as MatchStatus;
}

/**
 * Convert a MatchStatus to a color for UI display
 */
export function statusToColor(status: MatchStatus): string {
  switch (status) {
    case 'PERFECT': return '#10B981'; // green-500
    case 'EXCELLENT': return '#22C55E'; // green-400
    case 'STRONG': return '#84CC16'; // lime-500
    case 'MODERATE': return '#EAB308'; // yellow-500
    case 'WEAK': return '#F97316'; // orange-500
    case 'NO_MATCH': return '#EF4444'; // red-500
    default: return '#6B7280'; // gray-500
  }
}

/**
 * Get a status badge label
 */
export function statusToLabel(status: MatchStatus): string {
  switch (status) {
    case 'PERFECT': return 'Perfect Match';
    case 'EXCELLENT': return 'Excellent';
    case 'STRONG': return 'Strong';
    case 'MODERATE': return 'Moderate';
    case 'WEAK': return 'Weak';
    case 'NO_MATCH': return 'No Match';
    default: return 'Unknown';
  }
}

/**
 * Calculate summary from criteria array
 */
export function calculateSummary(criteria: CriterionMatch[]): MatchSummary {
  const summary: MatchSummary = {
    perfectMatches: 0,
    excellentMatches: 0,
    strongMatches: 0,
    moderateMatches: 0,
    weakMatches: 0,
    noMatches: 0,
    criticalMet: 0,
    criticalTotal: 0,
  };

  for (const criterion of criteria) {
    // Count by status
    switch (criterion.status) {
      case 'PERFECT':
        summary.perfectMatches++;
        break;
      case 'EXCELLENT':
        summary.excellentMatches++;
        break;
      case 'STRONG':
        summary.strongMatches++;
        break;
      case 'MODERATE':
        summary.moderateMatches++;
        break;
      case 'WEAK':
        summary.weakMatches++;
        break;
      case 'NO_MATCH':
        summary.noMatches++;
        break;
    }

    // Track critical criteria
    if (criterion.importance === 'CRITICAL') {
      summary.criticalTotal++;
      // Critical is "met" if score >= 60 (STRONG or better)
      if (criterion.score >= 60) {
        summary.criticalMet++;
      }
    }
  }

  return summary;
}

/**
 * Sort criteria by importance (CRITICAL first), then by score (highest first)
 */
export function sortCriteria(criteria: CriterionMatch[]): CriterionMatch[] {
  const importanceOrder = {
    CRITICAL: 0,
    HIGH: 1,
    MEDIUM: 2,
    LOW: 3,
  };

  return [...criteria].sort((a, b) => {
    // First by importance
    const importanceDiff = importanceOrder[a.importance] - importanceOrder[b.importance];
    if (importanceDiff !== 0) return importanceDiff;

    // Then by score (descending)
    return b.score - a.score;
  });
}

/**
 * Generate concerns based on criteria analysis
 */
export function generateConcerns(criteria: CriterionMatch[]): string[] {
  const concerns: string[] = [];

  for (const criterion of criteria) {
    // Add concern for CRITICAL criteria that are not met (< 60)
    if (criterion.importance === 'CRITICAL' && criterion.score < 60) {
      concerns.push(
        `${criterion.name}: ${criterion.explanation.summary}`
      );
    }

    // Add concern for HIGH criteria with NO_MATCH or WEAK
    if (criterion.importance === 'HIGH' && criterion.score < 40) {
      concerns.push(
        `${criterion.name}: Limited alignment - ${criterion.explanation.targetValue || 'no data'}`
      );
    }
  }

  return concerns;
}

/**
 * Calculate Jaccard similarity between two sets of strings
 */
export function jaccardSimilarity(set1: Set<string>, set2: Set<string>): number {
  if (set1.size === 0 && set2.size === 0) return 0;
  if (set1.size === 0 || set2.size === 0) return 0;

  const intersection = new Set([...set1].filter(x => set2.has(x)));
  const union = new Set([...set1, ...set2]);

  return (intersection.size / union.size) * 100;
}

/**
 * Calculate overlap percentage (intersection / smaller set)
 */
export function overlapPercentage(arr1: string[], arr2: string[]): number {
  if (arr1.length === 0 || arr2.length === 0) return 0;

  const set1 = new Set(arr1.map(s => s.toLowerCase()));
  const set2 = new Set(arr2.map(s => s.toLowerCase()));

  const intersection = [...set1].filter(x => set2.has(x));
  const minSize = Math.min(set1.size, set2.size);

  return (intersection.length / minSize) * 100;
}

/**
 * Find common items between two arrays (case-insensitive)
 */
export function findCommonItems(arr1: string[], arr2: string[]): string[] {
  const set2Lower = new Set(arr2.map(s => s.toLowerCase()));
  const found = new Set<string>();

  for (const item of arr1) {
    if (set2Lower.has(item.toLowerCase())) {
      found.add(item);
    }
  }

  return [...found];
}

/**
 * Normalize a string for comparison (lowercase, trim, remove extra spaces)
 */
export function normalizeString(str: string): string {
  return str.toLowerCase().trim().replace(/\s+/g, ' ');
}

/**
 * Check if two strings are similar (Levenshtein distance)
 */
export function areStringSimilar(str1: string, str2: string, threshold: number = 0.8): boolean {
  const s1 = normalizeString(str1);
  const s2 = normalizeString(str2);

  if (s1 === s2) return true;
  if (s1.includes(s2) || s2.includes(s1)) return true;

  const distance = levenshteinDistance(s1, s2);
  const maxLength = Math.max(s1.length, s2.length);
  const similarity = 1 - distance / maxLength;

  return similarity >= threshold;
}

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(str1: string, str2: string): number {
  const m = str1.length;
  const n = str2.length;

  if (m === 0) return n;
  if (n === 0) return m;

  const dp: number[][] = Array(m + 1)
    .fill(null)
    .map(() => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,      // deletion
        dp[i][j - 1] + 1,      // insertion
        dp[i - 1][j - 1] + cost // substitution
      );
    }
  }

  return dp[m][n];
}

/**
 * Parse investment range to min/max values
 */
export function parseInvestmentRange(range: string): { min: number; max: number } | null {
  if (!range) return null;

  // Remove currency symbols and normalize
  const cleaned = range.replace(/[$€£,]/g, '').toLowerCase();

  // Try to parse "X-Y" format
  const rangeMatch = cleaned.match(/(\d+(?:\.\d+)?)\s*[km]?\s*[-–to]\s*(\d+(?:\.\d+)?)\s*[km]?/i);
  if (rangeMatch) {
    let min = parseFloat(rangeMatch[1]);
    let max = parseFloat(rangeMatch[2]);

    // Handle K/M suffixes
    if (cleaned.includes('k')) {
      min *= 1000;
      max *= 1000;
    } else if (cleaned.includes('m')) {
      min *= 1000000;
      max *= 1000000;
    }

    return { min, max };
  }

  // Try single value
  const singleMatch = cleaned.match(/(\d+(?:\.\d+)?)\s*([km])?/i);
  if (singleMatch) {
    let value = parseFloat(singleMatch[1]);
    const suffix = singleMatch[2];

    if (suffix?.toLowerCase() === 'k') value *= 1000;
    else if (suffix?.toLowerCase() === 'm') value *= 1000000;

    return { min: value, max: value };
  }

  return null;
}

/**
 * Check if investment ranges overlap
 */
export function doRangesOverlap(
  range1: { min: number; max: number },
  range2: { min: number; max: number }
): boolean {
  return range1.min <= range2.max && range2.min <= range1.max;
}

export default {
  scoreToStatus,
  statusToColor,
  statusToLabel,
  calculateSummary,
  sortCriteria,
  generateConcerns,
  jaccardSimilarity,
  overlapPercentage,
  findCommonItems,
  normalizeString,
  areStringSimilar,
  parseInvestmentRange,
  doRangesOverlap,
};
