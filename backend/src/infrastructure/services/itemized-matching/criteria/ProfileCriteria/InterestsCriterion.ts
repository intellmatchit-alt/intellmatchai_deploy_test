/**
 * Interests Criterion Calculator
 *
 * Calculates match score based on shared professional interests.
 * Score = (Shared interests / Max interests) × 100
 *
 * @module infrastructure/services/itemized-matching/criteria/ProfileCriteria/InterestsCriterion
 */

import {
  BaseCriterionCalculator,
  MatchingProfile,
  CalculationContext,
  CriterionResult,
} from '../../interfaces/ICriterionCalculator';
import { CriterionImportance, MatchType } from '../../../../../domain/services/IItemizedMatchingService';
import { findCommonItems, jaccardSimilarity, normalizeString } from '../../utils/ScoreUtils';

export class InterestsCriterion extends BaseCriterionCalculator {
  readonly id = 'interests';
  readonly name = 'Interests';
  readonly icon = '💡';
  readonly defaultImportance: CriterionImportance = 'LOW';
  readonly applicableMatchTypes = [
    'PROFILE_TO_PROFILE',
    'PROFILE_TO_USER',
    'EVENT_ATTENDEE_MATCH',
  ];

  async calculate(
    source: MatchingProfile,
    target: MatchingProfile,
    context: CalculationContext
  ): Promise<CriterionResult> {
    const sourceInterests = source.interests || [];
    const targetInterests = target.interests || [];

    // Handle empty cases
    if (sourceInterests.length === 0 || targetInterests.length === 0) {
      return this.buildResult(
        0,
        'NONE',
        {
          summary: 'Interests not specified',
          sourceValue: sourceInterests.length > 0 ? `${source.name}: ${sourceInterests.join(', ')}` : 'No interests listed',
          targetValue: targetInterests.length > 0 ? `${target.name}: ${targetInterests.join(', ')}` : 'No interests listed',
          matchType: 'NONE',
          details: ['No interests data available'],
        },
        context,
        {
          sourceValues: sourceInterests,
          targetValues: targetInterests,
          matchedCount: 0,
          totalCount: 0,
        }
      );
    }

    // Find shared interests (case-insensitive)
    const sharedInterests = findCommonItems(sourceInterests, targetInterests);

    // Calculate score using Jaccard similarity
    const sourceSet = new Set(sourceInterests.map(i => normalizeString(i)));
    const targetSet = new Set(targetInterests.map(i => normalizeString(i)));
    const score = jaccardSimilarity(sourceSet, targetSet);

    // Determine match type
    let matchType: MatchType = 'NONE';
    if (sharedInterests.length > 0) {
      matchType = score >= 50 ? 'EXACT' : 'PARTIAL';
    }

    // Build explanation
    const details: string[] = [];
    for (const interest of sharedInterests.slice(0, 5)) {
      details.push(`✅ ${interest}: Shared interest`);
    }
    if (sharedInterests.length === 0) {
      details.push('❌ No shared interests found');
    }
    if (sharedInterests.length > 5) {
      details.push(`... and ${sharedInterests.length - 5} more shared interests`);
    }

    const summary = sharedInterests.length > 0
      ? `${sharedInterests.length} shared interest${sharedInterests.length > 1 ? 's' : ''}: ${sharedInterests.slice(0, 3).join(', ')}`
      : 'No shared interests';

    return this.buildResult(
      score,
      matchType,
      {
        summary,
        sourceValue: `${source.name}: ${sourceInterests.slice(0, 5).join(', ')}${sourceInterests.length > 5 ? '...' : ''}`,
        targetValue: `${target.name}: ${targetInterests.slice(0, 5).join(', ')}${targetInterests.length > 5 ? '...' : ''}`,
        matchType,
        details,
      },
      context,
      {
        sourceValues: sourceInterests,
        targetValues: targetInterests,
        matchedCount: sharedInterests.length,
        totalCount: new Set([...sourceSet, ...targetSet]).size,
      }
    );
  }
}

export default InterestsCriterion;
