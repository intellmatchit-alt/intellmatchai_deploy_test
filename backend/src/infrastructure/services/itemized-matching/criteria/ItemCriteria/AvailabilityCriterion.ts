/**
 * Availability Criterion Calculator
 *
 * Calculates match score based on provider's availability to meet timeline.
 * Used for DEAL_TO_PROVIDER matching.
 *
 * Note: Currently limited data available - infers from profile activity.
 *
 * @module infrastructure/services/itemized-matching/criteria/ItemCriteria/AvailabilityCriterion
 */

import {
  BaseCriterionCalculator,
  MatchingProfile,
  CalculationContext,
  CriterionResult,
} from '../../interfaces/ICriterionCalculator';
import { CriterionImportance, MatchType } from '../../../../../domain/services/IItemizedMatchingService';
import { normalizeString } from '../../utils/ScoreUtils';

/**
 * Availability indicators from job titles
 */
const AVAILABILITY_INDICATORS = {
  HIGH: ['freelance', 'consultant', 'independent', 'available', 'contractor', 'for hire'],
  MEDIUM: ['founder', 'owner', 'partner', 'self-employed'],
  LOW: ['director', 'vp', 'head of', 'manager', 'lead'],
  VERY_LOW: ['ceo', 'cto', 'cfo', 'coo', 'c-level', 'chief'],
};

export class AvailabilityCriterion extends BaseCriterionCalculator {
  readonly id = 'availability';
  readonly name = 'Availability';
  readonly icon = '📅';
  readonly defaultImportance: CriterionImportance = 'MEDIUM';
  readonly applicableMatchTypes = [
    'DEAL_TO_PROVIDER',
  ];

  /**
   * Infer availability from profile
   */
  private inferAvailability(profile: MatchingProfile): {
    level: 'HIGH' | 'MEDIUM' | 'LOW' | 'UNKNOWN';
    score: number;
    reason: string;
  } {
    // Check job title for availability indicators
    if (profile.jobTitle) {
      const title = normalizeString(profile.jobTitle);

      for (const indicator of AVAILABILITY_INDICATORS.HIGH) {
        if (title.includes(indicator)) {
          return { level: 'HIGH', score: 90, reason: `Likely available: ${indicator}` };
        }
      }

      for (const indicator of AVAILABILITY_INDICATORS.MEDIUM) {
        if (title.includes(indicator)) {
          return { level: 'MEDIUM', score: 70, reason: `May have capacity: ${indicator}` };
        }
      }

      for (const indicator of AVAILABILITY_INDICATORS.LOW) {
        if (title.includes(indicator)) {
          return { level: 'LOW', score: 40, reason: `Limited availability: ${indicator} role` };
        }
      }

      for (const indicator of AVAILABILITY_INDICATORS.VERY_LOW) {
        if (title.includes(indicator)) {
          return { level: 'LOW', score: 25, reason: `Very limited: ${indicator} role` };
        }
      }
    }

    // Check bio for availability mentions
    if (profile.bio) {
      const bio = normalizeString(profile.bio);
      if (bio.includes('available') || bio.includes('open to') || bio.includes('looking for')) {
        return { level: 'HIGH', score: 85, reason: 'Indicates availability in bio' };
      }
      if (bio.includes('busy') || bio.includes('not available') || bio.includes('fully booked')) {
        return { level: 'LOW', score: 20, reason: 'Indicates limited availability' };
      }
    }

    return { level: 'UNKNOWN', score: 50, reason: 'Availability not specified' };
  }

  /**
   * Extract deal timeline requirements
   */
  private getDealTimeline(profile: MatchingProfile): {
    urgency: 'URGENT' | 'NORMAL' | 'FLEXIBLE' | 'UNKNOWN';
    description: string;
  } {
    const rawData = profile.rawData || {};
    const targetDesc = normalizeString(rawData.targetDescription || '');
    const problemStatement = normalizeString(rawData.problemStatement || '');
    const combined = `${targetDesc} ${problemStatement}`;

    if (combined.includes('urgent') || combined.includes('asap') || combined.includes('immediately')) {
      return { urgency: 'URGENT', description: 'Urgent timeline' };
    }
    if (combined.includes('flexible') || combined.includes('no rush') || combined.includes('whenever')) {
      return { urgency: 'FLEXIBLE', description: 'Flexible timeline' };
    }
    if (combined.includes('within') || combined.includes('deadline') || combined.includes('by')) {
      return { urgency: 'NORMAL', description: 'Standard timeline' };
    }

    return { urgency: 'UNKNOWN', description: 'Timeline not specified' };
  }

  async calculate(
    source: MatchingProfile,
    target: MatchingProfile,
    context: CalculationContext
  ): Promise<CriterionResult> {
    // Source is deal, target is provider
    const dealTimeline = this.getDealTimeline(source);
    const providerAvailability = this.inferAvailability(target);

    let score = providerAvailability.score;
    let matchType: MatchType = 'NONE';
    const details: string[] = [];

    // Adjust based on urgency match
    if (dealTimeline.urgency === 'URGENT' && providerAvailability.level === 'HIGH') {
      score = Math.min(100, score + 10);
      matchType = 'EXACT';
      details.push(`✅ Provider likely available for urgent work`);
    } else if (dealTimeline.urgency === 'URGENT' && providerAvailability.level === 'LOW') {
      score = Math.max(10, score - 20);
      matchType = 'PARTIAL';
      details.push(`⚠️ Urgent timeline but provider has limited availability`);
    } else if (dealTimeline.urgency === 'FLEXIBLE') {
      score = Math.min(100, score + 15);
      matchType = score >= 60 ? 'PARTIAL' : 'NONE';
      details.push(`✅ Flexible timeline accommodates provider schedule`);
    } else {
      matchType = score >= 70 ? 'PARTIAL' : score >= 40 ? 'PARTIAL' : 'NONE';
    }

    // Add availability reason
    details.push(`📅 ${providerAvailability.reason}`);

    if (providerAvailability.level === 'UNKNOWN') {
      details.push(`⚠️ Could not determine provider availability`);
    }

    const summary = providerAvailability.level === 'UNKNOWN'
      ? 'Availability unknown'
      : `${providerAvailability.level} availability`;

    return this.buildResult(
      score,
      matchType,
      {
        summary,
        sourceValue: `Deal: ${dealTimeline.description}`,
        targetValue: `${target.name}: ${providerAvailability.level} availability`,
        matchType,
        details,
      },
      context,
      {
        sourceValues: [dealTimeline.urgency],
        targetValues: [providerAvailability.level],
        matchedCount: providerAvailability.level !== 'LOW' ? 1 : 0,
        totalCount: 1,
        additionalData: { dealTimeline, providerAvailability },
      }
    );
  }
}

export default AvailabilityCriterion;
