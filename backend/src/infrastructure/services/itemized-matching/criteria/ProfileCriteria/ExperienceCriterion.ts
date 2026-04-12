/**
 * Experience/Seniority Criterion Calculator
 *
 * Calculates match score based on professional seniority level.
 * Same level = 100% | Adjacent level = 70% | 2+ levels apart = 40%
 *
 * @module infrastructure/services/itemized-matching/criteria/ProfileCriteria/ExperienceCriterion
 */

import {
  BaseCriterionCalculator,
  MatchingProfile,
  CalculationContext,
  CriterionResult,
} from '../../interfaces/ICriterionCalculator';
import { CriterionImportance, MatchType } from '../../../../../domain/services/IItemizedMatchingService';
import { SENIORITY_LEVELS, getCriterionImportance } from '../../constants/CriteriaDefinitions';
import { normalizeString } from '../../utils/ScoreUtils';

/**
 * Seniority level order for distance calculation
 */
const LEVEL_ORDER = [
  'ENTRY',
  'MID',
  'SENIOR',
  'LEAD',
  'DIRECTOR',
  'VP',
  'C_LEVEL',
  'BOARD',
] as const;

type SeniorityLevel = typeof LEVEL_ORDER[number];

export class ExperienceCriterion extends BaseCriterionCalculator {
  readonly id = 'experience';
  readonly name = 'Experience Level';
  readonly icon = '📊';
  readonly defaultImportance: CriterionImportance = 'MEDIUM';
  readonly applicableMatchTypes = [
    'PROFILE_TO_PROFILE',
    'PROFILE_TO_USER',
    'JOB_TO_CANDIDATE',
    'PROJECT_TO_DYNAMIC',
  ];

  getImportance(matchType: string): CriterionImportance {
    return getCriterionImportance(this.id, matchType as any);
  }

  /**
   * Parse job title to extract seniority level
   */
  private parseSeniorityFromTitle(jobTitle: string | undefined): {
    level: SeniorityLevel | null;
    confidence: number;
  } {
    if (!jobTitle) {
      return { level: null, confidence: 0 };
    }

    const normalized = normalizeString(jobTitle);

    // Check each seniority level
    for (const { level, labels } of SENIORITY_LEVELS) {
      for (const label of labels) {
        const normalizedLabel = normalizeString(label);

        // Check if title contains the label
        if (normalized.includes(normalizedLabel)) {
          // Higher confidence for more specific matches
          const confidence = normalized.startsWith(normalizedLabel) ? 0.95 :
                            normalized.endsWith(normalizedLabel) ? 0.9 : 0.8;
          return { level: level as SeniorityLevel, confidence };
        }
      }
    }

    // Heuristics for titles without clear seniority markers
    if (normalized.includes('intern') || normalized.includes('trainee')) {
      return { level: 'ENTRY', confidence: 0.9 };
    }
    if (normalized.includes('consultant') || normalized.includes('specialist')) {
      return { level: 'MID', confidence: 0.6 };
    }
    if (normalized.includes('manager')) {
      return { level: 'LEAD', confidence: 0.7 };
    }
    if (normalized.includes('owner') || normalized.includes('entrepreneur')) {
      return { level: 'BOARD', confidence: 0.7 };
    }

    // Default to MID if we can't determine
    return { level: 'MID', confidence: 0.3 };
  }

  /**
   * Calculate distance between two seniority levels
   */
  private getLevelDistance(level1: SeniorityLevel, level2: SeniorityLevel): number {
    const idx1 = LEVEL_ORDER.indexOf(level1);
    const idx2 = LEVEL_ORDER.indexOf(level2);
    return Math.abs(idx1 - idx2);
  }

  /**
   * Get human-readable label for seniority level
   */
  private getLevelLabel(level: SeniorityLevel): string {
    const labels: Record<SeniorityLevel, string> = {
      'ENTRY': 'Entry Level',
      'MID': 'Mid Level',
      'SENIOR': 'Senior',
      'LEAD': 'Lead/Manager',
      'DIRECTOR': 'Director',
      'VP': 'VP/Executive',
      'C_LEVEL': 'C-Level',
      'BOARD': 'Board/Founder',
    };
    return labels[level] || level;
  }

  async calculate(
    source: MatchingProfile,
    target: MatchingProfile,
    context: CalculationContext
  ): Promise<CriterionResult> {
    const sourceTitle = source.jobTitle;
    const targetTitle = target.jobTitle;

    // Handle missing job titles
    if (!sourceTitle || !targetTitle) {
      return this.buildResult(
        0,
        'NONE',
        {
          summary: 'Job title not specified',
          sourceValue: sourceTitle ? `${source.name}: ${sourceTitle}` : 'Job title not provided',
          targetValue: targetTitle ? `${target.name}: ${targetTitle}` : 'Job title not provided',
          matchType: 'NONE',
          details: ['Unable to compare experience levels'],
        },
        context,
        {
          sourceValues: sourceTitle ? [sourceTitle] : [],
          targetValues: targetTitle ? [targetTitle] : [],
          matchedCount: 0,
          totalCount: 0,
        }
      );
    }

    const sourceSeniority = this.parseSeniorityFromTitle(sourceTitle);
    const targetSeniority = this.parseSeniorityFromTitle(targetTitle);

    // Handle cases where seniority couldn't be determined
    if (!sourceSeniority.level || !targetSeniority.level) {
      return this.buildResult(
        30,
        'PARTIAL',
        {
          summary: 'Experience level unclear',
          sourceValue: `${source.name}: ${sourceTitle}`,
          targetValue: `${target.name}: ${targetTitle}`,
          matchType: 'PARTIAL',
          details: ['Could not determine seniority from job titles'],
        },
        context,
        {
          sourceValues: [sourceTitle],
          targetValues: [targetTitle],
          matchedCount: 0,
          totalCount: 1,
          additionalData: { sourceSeniority, targetSeniority },
        }
      );
    }

    const distance = this.getLevelDistance(sourceSeniority.level, targetSeniority.level);
    const sourceLabel = this.getLevelLabel(sourceSeniority.level);
    const targetLabel = this.getLevelLabel(targetSeniority.level);

    let score = 0;
    let matchType: MatchType = 'NONE';
    const details: string[] = [];
    let summary = '';

    // Scoring based on distance
    if (distance === 0) {
      // Same level
      score = 100;
      matchType = 'EXACT';
      details.push(`✅ Same seniority level: ${sourceLabel}`);
      summary = `Same level: ${sourceLabel}`;
    } else if (distance === 1) {
      // Adjacent levels
      score = 70;
      matchType = 'PARTIAL';
      details.push(`🔄 Adjacent levels: ${sourceLabel} ↔ ${targetLabel}`);
      summary = `Adjacent levels: ${sourceLabel} & ${targetLabel}`;
    } else if (distance === 2) {
      // Two levels apart
      score = 40;
      matchType = 'PARTIAL';
      details.push(`🔄 Two levels apart: ${sourceLabel} ↔ ${targetLabel}`);
      summary = `Different levels: ${sourceLabel} vs ${targetLabel}`;
    } else {
      // More than 2 levels apart
      score = 20;
      matchType = 'PARTIAL';
      details.push(`⚠️ Significant gap: ${sourceLabel} → ${targetLabel} (${distance} levels)`);
      summary = `Significant level gap`;
    }

    // Adjust score based on confidence
    const avgConfidence = (sourceSeniority.confidence + targetSeniority.confidence) / 2;
    if (avgConfidence < 0.6) {
      details.push(`⚠️ Low confidence in seniority detection`);
    }

    return this.buildResult(
      Math.round(score * Math.max(0.7, avgConfidence)),
      matchType,
      {
        summary,
        sourceValue: `${source.name}: ${sourceTitle} (${sourceLabel})`,
        targetValue: `${target.name}: ${targetTitle} (${targetLabel})`,
        matchType,
        details,
      },
      context,
      {
        sourceValues: [sourceTitle],
        targetValues: [targetTitle],
        matchedCount: distance <= 1 ? 1 : 0,
        totalCount: 1,
        additionalData: {
          sourceSeniority,
          targetSeniority,
          distance,
        },
      }
    );
  }
}

export default ExperienceCriterion;
