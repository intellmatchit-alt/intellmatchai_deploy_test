/**
 * Industry/Sector Criterion Calculator
 *
 * Calculates match score based on shared industry/sector experience.
 * Same industry = 100% | Related industries = 60% | No overlap = 0%
 *
 * @module infrastructure/services/itemized-matching/criteria/ProfileCriteria/IndustryCriterion
 */

import {
  BaseCriterionCalculator,
  MatchingProfile,
  CalculationContext,
  CriterionResult,
} from '../../interfaces/ICriterionCalculator';
import { CriterionImportance, MatchType } from '../../../../../domain/services/IItemizedMatchingService';
import { RELATED_INDUSTRIES, getCriterionImportance } from '../../constants/CriteriaDefinitions';
import { findCommonItems, normalizeString } from '../../utils/ScoreUtils';

export class IndustryCriterion extends BaseCriterionCalculator {
  readonly id = 'industry';
  readonly name = 'Industry/Sector';
  readonly icon = '🏢';
  readonly defaultImportance: CriterionImportance = 'HIGH';
  readonly applicableMatchTypes = [
    'PROFILE_TO_PROFILE',
    'PROFILE_TO_USER',
    'PROJECT_TO_INVESTOR',
    'PROJECT_TO_PARTNER',
    'JOB_TO_CANDIDATE',
    'DEAL_TO_BUYER',
    'DEAL_TO_PROVIDER',
    'EVENT_ATTENDEE_MATCH',
  ];

  getImportance(matchType: string): CriterionImportance {
    return getCriterionImportance(this.id, matchType as any);
  }

  async calculate(
    source: MatchingProfile,
    target: MatchingProfile,
    context: CalculationContext
  ): Promise<CriterionResult> {
    const sourceSectors = source.sectors.map(s => normalizeString(s));
    const targetSectors = target.sectors.map(s => normalizeString(s));

    // Find exact matches
    const exactMatches = findCommonItems(sourceSectors, targetSectors);

    // Find related industry matches
    const relatedMatches: string[] = [];
    for (const sourceSector of sourceSectors) {
      if (exactMatches.some(m => normalizeString(m) === sourceSector)) continue;

      for (const [industry, related] of Object.entries(RELATED_INDUSTRIES)) {
        const normalizedIndustry = normalizeString(industry);
        const normalizedRelated = related.map(r => normalizeString(r));

        // Check if source is the main industry and target has a related one
        if (sourceSector === normalizedIndustry || normalizedRelated.includes(sourceSector)) {
          for (const targetSector of targetSectors) {
            if (targetSector === normalizedIndustry || normalizedRelated.includes(targetSector)) {
              if (!relatedMatches.includes(targetSector)) {
                relatedMatches.push(targetSector);
              }
            }
          }
        }
      }
    }

    // Calculate score
    let score = 0;
    let matchType: MatchType = 'NONE';

    if (exactMatches.length > 0) {
      // Each exact match adds significant points
      const exactScore = Math.min(100, exactMatches.length * 40);
      score = exactScore;
      matchType = exactMatches.length >= 2 ? 'EXACT' : 'PARTIAL';
    }

    if (relatedMatches.length > 0 && score < 100) {
      // Related matches add bonus points
      const relatedScore = relatedMatches.length * 20;
      score = Math.min(100, score + relatedScore);
      if (matchType === 'NONE') matchType = 'PARTIAL';
    }

    // Build explanation
    const details: string[] = [];
    for (const match of exactMatches) {
      details.push(`✅ ${match}: Exact match`);
    }
    for (const match of relatedMatches) {
      details.push(`🔄 ${match}: Related industry`);
    }

    if (details.length === 0 && sourceSectors.length > 0 && targetSectors.length > 0) {
      details.push(`❌ No industry overlap found`);
    }

    const summary = exactMatches.length > 0
      ? `${exactMatches.length === 1 ? 'Shared' : 'Multiple shared'} industry${exactMatches.length > 1 ? 'ies' : ''}: ${exactMatches.slice(0, 3).join(', ')}`
      : relatedMatches.length > 0
        ? `Related industries: ${relatedMatches.slice(0, 3).join(', ')}`
        : sourceSectors.length === 0 || targetSectors.length === 0
          ? 'Industry data not available'
          : 'No industry overlap';

    return this.buildResult(
      score,
      matchType,
      {
        summary,
        sourceValue: sourceSectors.length > 0 ? `${source.name}: ${sourceSectors.join(', ')}` : 'No industry specified',
        targetValue: targetSectors.length > 0 ? `${target.name}: ${targetSectors.join(', ')}` : 'No industry specified',
        matchType,
        details,
      },
      context,
      {
        sourceValues: sourceSectors,
        targetValues: targetSectors,
        matchedCount: exactMatches.length + relatedMatches.length,
        totalCount: Math.max(sourceSectors.length, targetSectors.length),
        additionalData: { exactMatches, relatedMatches },
      }
    );
  }
}

export default IndustryCriterion;
