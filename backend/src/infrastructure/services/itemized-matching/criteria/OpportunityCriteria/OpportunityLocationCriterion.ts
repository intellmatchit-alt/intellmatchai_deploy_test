/**
 * Opportunity Location Criterion Calculator
 *
 * Calculates match score based on location preferences and remote work compatibility.
 *
 * @module infrastructure/services/itemized-matching/criteria/OpportunityCriteria/OpportunityLocationCriterion
 */

import {
  BaseCriterionCalculator,
  MatchingProfile,
  CalculationContext,
  CriterionResult,
} from '../../interfaces/ICriterionCalculator';
import { CriterionImportance, MatchType } from '../../../../../domain/services/IItemizedMatchingService';
import { normalizeString } from '../../utils/ScoreUtils';

export class OpportunityLocationCriterion extends BaseCriterionCalculator {
  readonly id = 'opportunity_location';
  readonly name = 'Location Match';
  readonly icon = '📍';
  readonly defaultImportance: CriterionImportance = 'MEDIUM';
  readonly applicableMatchTypes = [
    'OPPORTUNITY_TO_CANDIDATE',
    'CANDIDATE_TO_OPPORTUNITY',
  ];

  /**
   * Parse location into city, country components
   */
  private parseLocation(location: string): { city?: string; country?: string; normalized: string } {
    const normalized = normalizeString(location);
    const parts = location.split(',').map(p => p.trim());

    return {
      city: parts[0] || undefined,
      country: parts[parts.length - 1] || undefined,
      normalized,
    };
  }

  async calculate(
    source: MatchingProfile,
    target: MatchingProfile,
    context: CalculationContext
  ): Promise<CriterionResult> {
    const opportunityLocation = source.rawData?.locationPref || '';
    const remoteOk = source.rawData?.remoteOk !== false; // Default to true
    const candidateLocation = target.location || '';

    // If remote is OK, that's always a good match
    if (remoteOk) {
      const details = ['✅ Remote work accepted'];
      if (candidateLocation) {
        details.push(`📍 Candidate location: ${candidateLocation}`);
      }

      return this.buildResult(
        90,
        'EXACT',
        {
          summary: 'Remote friendly',
          sourceValue: opportunityLocation ? `${opportunityLocation} (Remote OK)` : 'Remote OK',
          targetValue: candidateLocation || 'Any location',
          matchType: 'EXACT',
          details,
        },
        context,
        { sourceValues: ['remote'], targetValues: [candidateLocation], matchedCount: 1, totalCount: 1 }
      );
    }

    // No location preference
    if (!opportunityLocation) {
      return this.buildResult(
        60,
        'PARTIAL',
        {
          summary: 'No location preference',
          sourceValue: 'Any location',
          targetValue: candidateLocation || 'Unknown',
          matchType: 'PARTIAL',
          details: ['ℹ️ No specific location requirement'],
        },
        context,
        { sourceValues: [], targetValues: [], matchedCount: 0, totalCount: 0 }
      );
    }

    // Unknown candidate location
    if (!candidateLocation) {
      return this.buildResult(
        30,
        'PARTIAL',
        {
          summary: 'Candidate location unknown',
          sourceValue: opportunityLocation,
          targetValue: 'Not specified',
          matchType: 'PARTIAL',
          details: ['⚠️ Cannot verify location compatibility', `📋 Required: ${opportunityLocation}`],
        },
        context,
        { sourceValues: [opportunityLocation], targetValues: [], matchedCount: 0, totalCount: 1 }
      );
    }

    // Compare locations
    const oppLoc = this.parseLocation(opportunityLocation);
    const candLoc = this.parseLocation(candidateLocation);

    let score = 0;
    let matchType: MatchType = 'NONE';
    const details: string[] = [];

    // Check for exact match
    if (oppLoc.normalized.includes(candLoc.normalized) ||
        candLoc.normalized.includes(oppLoc.normalized)) {
      score = 100;
      matchType = 'EXACT';
      details.push(`✅ Location match: ${candidateLocation}`);
    }
    // Check country match
    else if (oppLoc.country && candLoc.country &&
             normalizeString(oppLoc.country) === normalizeString(candLoc.country)) {
      score = 70;
      matchType = 'PARTIAL';
      details.push(`✅ Same country: ${candLoc.country}`);
      details.push(`📋 Required: ${opportunityLocation}`);
      details.push(`👤 Candidate: ${candidateLocation}`);
    }
    // No match
    else {
      score = 20;
      matchType = 'NONE';
      details.push(`❌ Location mismatch`);
      details.push(`📋 Required: ${opportunityLocation}`);
      details.push(`👤 Candidate: ${candidateLocation}`);
    }

    const summary = score >= 80 ? `Location match` : score >= 50 ? `Same country` : `Location mismatch`;

    return this.buildResult(
      score,
      matchType,
      {
        summary,
        sourceValue: opportunityLocation,
        targetValue: candidateLocation,
        matchType,
        details,
      },
      context,
      {
        sourceValues: [opportunityLocation],
        targetValues: [candidateLocation],
        matchedCount: score >= 70 ? 1 : 0,
        totalCount: 1,
      }
    );
  }
}

export default OpportunityLocationCriterion;
