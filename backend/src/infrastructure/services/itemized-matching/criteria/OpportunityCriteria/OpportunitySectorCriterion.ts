/**
 * Opportunity Sector Criterion Calculator
 *
 * Calculates match score based on industry/sector alignment.
 *
 * @module infrastructure/services/itemized-matching/criteria/OpportunityCriteria/OpportunitySectorCriterion
 */

import {
  BaseCriterionCalculator,
  MatchingProfile,
  CalculationContext,
  CriterionResult,
} from '../../interfaces/ICriterionCalculator';
import { CriterionImportance, MatchType } from '../../../../../domain/services/IItemizedMatchingService';
import { normalizeString, findCommonItems } from '../../utils/ScoreUtils';
import { RELATED_INDUSTRIES } from '../../constants/CriteriaDefinitions';

export class OpportunitySectorCriterion extends BaseCriterionCalculator {
  readonly id = 'opportunity_sector';
  readonly name = 'Sector Match';
  readonly icon = '🏢';
  readonly defaultImportance: CriterionImportance = 'HIGH';
  readonly applicableMatchTypes = [
    'OPPORTUNITY_TO_CANDIDATE',
    'CANDIDATE_TO_OPPORTUNITY',
  ];

  /**
   * Check if two sectors are related
   */
  private areSectorsRelated(sector1: string, sector2: string): boolean {
    const norm1 = normalizeString(sector1);
    const norm2 = normalizeString(sector2);

    for (const [category, related] of Object.entries(RELATED_INDUSTRIES)) {
      const normalizedCategory = normalizeString(category);
      const normalizedRelated = related.map(s => normalizeString(s));
      const allTerms = [normalizedCategory, ...normalizedRelated];

      if (allTerms.some(s => norm1.includes(s) || s.includes(norm1)) &&
          allTerms.some(s => norm2.includes(s) || s.includes(norm2))) {
        return true;
      }
    }
    return false;
  }

  async calculate(
    source: MatchingProfile,
    target: MatchingProfile,
    context: CalculationContext
  ): Promise<CriterionResult> {
    const opportunitySectors = source.sectors || [];
    const candidateSectors = target.sectors || [];

    // Handle no sector preference
    if (opportunitySectors.length === 0) {
      return this.buildResult(
        60,
        'PARTIAL',
        {
          summary: 'No sector preference',
          sourceValue: 'Any industry',
          targetValue: candidateSectors.length > 0 ? candidateSectors.slice(0, 5).join(', ') : 'Unknown',
          matchType: 'PARTIAL',
          details: ['ℹ️ Open to all industries'],
        },
        context,
        { sourceValues: [], targetValues: candidateSectors, matchedCount: 0, totalCount: 0 }
      );
    }

    // Handle no candidate sectors
    if (candidateSectors.length === 0) {
      return this.buildResult(
        30,
        'PARTIAL',
        {
          summary: 'Candidate sectors unknown',
          sourceValue: `Focus: ${opportunitySectors.slice(0, 5).join(', ')}`,
          targetValue: 'Industry not specified',
          matchType: 'PARTIAL',
          details: ['⚠️ Cannot determine candidate industry experience'],
        },
        context,
        { sourceValues: opportunitySectors, targetValues: [], matchedCount: 0, totalCount: opportunitySectors.length }
      );
    }

    // Find exact matches
    const exactMatches = findCommonItems(opportunitySectors, candidateSectors);

    // Find related matches (excluding exact matches)
    const relatedMatches: string[] = [];
    for (const oppSector of opportunitySectors) {
      if (exactMatches.includes(oppSector)) continue;
      for (const candSector of candidateSectors) {
        if (this.areSectorsRelated(oppSector, candSector) && !relatedMatches.includes(oppSector)) {
          relatedMatches.push(oppSector);
          break;
        }
      }
    }

    const totalMatches = exactMatches.length + relatedMatches.length;
    const matchRatio = totalMatches / opportunitySectors.length;

    let score = Math.round(matchRatio * 100);
    let matchType: MatchType = 'NONE';
    const details: string[] = [];

    // Add exact matches
    for (const sector of exactMatches.slice(0, 3)) {
      details.push(`✅ ${sector}: Exact match`);
    }
    if (exactMatches.length > 3) {
      details.push(`✅ +${exactMatches.length - 3} more exact`);
    }

    // Add related matches
    for (const sector of relatedMatches.slice(0, 2)) {
      details.push(`🔄 ${sector}: Related industry`);
    }
    if (relatedMatches.length > 2) {
      details.push(`🔄 +${relatedMatches.length - 2} more related`);
    }

    // Determine match type
    if (matchRatio >= 0.7 || exactMatches.length >= 2) {
      matchType = 'EXACT';
      score = Math.max(score, 85);
    } else if (matchRatio >= 0.4 || exactMatches.length >= 1) {
      matchType = 'PARTIAL';
      score = Math.max(score, 60);
    } else if (relatedMatches.length > 0) {
      matchType = 'PARTIAL';
      score = Math.max(score, 40);
    }

    const summary = exactMatches.length > 0
      ? `${exactMatches.length} sector${exactMatches.length > 1 ? 's' : ''} match`
      : relatedMatches.length > 0
        ? `${relatedMatches.length} related sector${relatedMatches.length > 1 ? 's' : ''}`
        : 'No sector match';

    return this.buildResult(
      score,
      matchType,
      {
        summary,
        sourceValue: `Focus: ${opportunitySectors.slice(0, 4).join(', ')}`,
        targetValue: `${target.name}: ${candidateSectors.slice(0, 4).join(', ')}`,
        matchType,
        details,
      },
      context,
      {
        sourceValues: opportunitySectors,
        targetValues: candidateSectors,
        matchedCount: totalMatches,
        totalCount: opportunitySectors.length,
        additionalData: { exactMatches, relatedMatches },
      }
    );
  }
}

export default OpportunitySectorCriterion;
