/**
 * Opportunity Seniority Criterion Calculator
 *
 * Calculates match score based on seniority level alignment.
 *
 * @module infrastructure/services/itemized-matching/criteria/OpportunityCriteria/OpportunitySeniorityCriterion
 */

import {
  BaseCriterionCalculator,
  MatchingProfile,
  CalculationContext,
  CriterionResult,
} from '../../interfaces/ICriterionCalculator';
import { CriterionImportance, MatchType } from '../../../../../domain/services/IItemizedMatchingService';
import { SENIORITY_LEVELS } from '../../constants/CriteriaDefinitions';
import { normalizeString } from '../../utils/ScoreUtils';

/**
 * Seniority level order for distance calculation
 */
const LEVEL_ORDER = ['ENTRY', 'MID', 'SENIOR', 'LEAD', 'DIRECTOR', 'VP', 'C_LEVEL', 'BOARD'] as const;
type SeniorityLevel = typeof LEVEL_ORDER[number];

export class OpportunitySeniorityCriterion extends BaseCriterionCalculator {
  readonly id = 'opportunity_seniority';
  readonly name = 'Seniority Match';
  readonly icon = '📊';
  readonly defaultImportance: CriterionImportance = 'HIGH';
  readonly applicableMatchTypes = [
    'OPPORTUNITY_TO_CANDIDATE',
    'CANDIDATE_TO_OPPORTUNITY',
  ];

  /**
   * Parse seniority level from job title
   */
  private parseSeniorityFromTitle(jobTitle: string): SeniorityLevel | null {
    const normalized = normalizeString(jobTitle);

    for (const { level, labels } of SENIORITY_LEVELS) {
      for (const label of labels) {
        if (normalized.includes(normalizeString(label))) {
          return level as SeniorityLevel;
        }
      }
    }

    return null;
  }

  /**
   * Get level index for distance calculation
   */
  private getLevelIndex(level: SeniorityLevel): number {
    return LEVEL_ORDER.indexOf(level);
  }

  async calculate(
    source: MatchingProfile,
    target: MatchingProfile,
    context: CalculationContext
  ): Promise<CriterionResult> {
    // Get required seniority from opportunity
    const requiredSeniority = source.rawData?.seniority as SeniorityLevel | undefined;

    // Get candidate seniority from job title
    const candidateTitle = target.jobTitle || '';
    const candidateSeniority = this.parseSeniorityFromTitle(candidateTitle);

    // Handle no requirement
    if (!requiredSeniority) {
      return this.buildResult(
        70,
        'PARTIAL',
        {
          summary: 'Open to all levels',
          sourceValue: 'Any seniority',
          targetValue: candidateSeniority || 'Unknown',
          matchType: 'PARTIAL',
          details: ['ℹ️ No specific seniority requirement'],
        },
        context,
        { sourceValues: [], targetValues: [], matchedCount: 0, totalCount: 0 }
      );
    }

    // Handle unknown candidate seniority
    if (!candidateSeniority) {
      return this.buildResult(
        40,
        'PARTIAL',
        {
          summary: 'Candidate level unknown',
          sourceValue: `Requires: ${requiredSeniority}`,
          targetValue: candidateTitle || 'Not specified',
          matchType: 'PARTIAL',
          details: ['⚠️ Cannot determine candidate seniority level'],
        },
        context,
        { sourceValues: [requiredSeniority], targetValues: [], matchedCount: 0, totalCount: 1 }
      );
    }

    // Calculate level difference
    const requiredIndex = this.getLevelIndex(requiredSeniority);
    const candidateIndex = this.getLevelIndex(candidateSeniority);
    const levelDiff = Math.abs(requiredIndex - candidateIndex);

    let score = 0;
    let matchType: MatchType = 'NONE';
    const details: string[] = [];

    if (levelDiff === 0) {
      score = 100;
      matchType = 'EXACT';
      details.push(`✅ Exact seniority match: ${requiredSeniority}`);
    } else if (levelDiff === 1) {
      score = 80;
      matchType = 'PARTIAL';
      const direction = candidateIndex > requiredIndex ? 'above' : 'below';
      details.push(`✅ Close match: candidate is one level ${direction}`);
      details.push(`📋 Required: ${requiredSeniority}`);
      details.push(`👤 Candidate: ${candidateSeniority}`);
    } else if (levelDiff === 2) {
      score = 50;
      matchType = 'PARTIAL';
      details.push(`⚠️ Moderate seniority gap (${levelDiff} levels)`);
      details.push(`📋 Required: ${requiredSeniority}`);
      details.push(`👤 Candidate: ${candidateSeniority}`);
    } else {
      score = Math.max(20, 60 - levelDiff * 10);
      matchType = 'NONE';
      details.push(`❌ Significant seniority gap (${levelDiff} levels)`);
      details.push(`📋 Required: ${requiredSeniority}`);
      details.push(`👤 Candidate: ${candidateSeniority}`);
    }

    const summary = score >= 80 ? `Seniority match` : score >= 50 ? `Seniority gap: ${levelDiff}` : `Seniority mismatch`;

    return this.buildResult(
      score,
      matchType,
      {
        summary,
        sourceValue: `Requires: ${requiredSeniority}`,
        targetValue: `${target.name}: ${candidateSeniority}`,
        matchType,
        details,
      },
      context,
      {
        sourceValues: [requiredSeniority],
        targetValues: [candidateSeniority],
        matchedCount: levelDiff <= 1 ? 1 : 0,
        totalCount: 1,
      }
    );
  }
}

export default OpportunitySeniorityCriterion;
