/**
 * Deal Industry Criterion Calculator
 *
 * CRITICAL: Calculates match score based on deal domain vs buyer/provider sector expertise.
 * Used for DEAL_TO_BUYER and DEAL_TO_PROVIDER matching.
 *
 * @module infrastructure/services/itemized-matching/criteria/ItemCriteria/DealIndustryCriterion
 */

import {
  BaseCriterionCalculator,
  MatchingProfile,
  CalculationContext,
  CriterionResult,
} from '../../interfaces/ICriterionCalculator';
import { CriterionImportance, MatchType } from '../../../../../domain/services/IItemizedMatchingService';
import { RELATED_INDUSTRIES } from '../../constants/CriteriaDefinitions';
import { normalizeString, findCommonItems } from '../../utils/ScoreUtils';

export class DealIndustryCriterion extends BaseCriterionCalculator {
  readonly id = 'deal_industry';
  readonly name = 'Industry Match';
  readonly icon = '🏭';
  readonly defaultImportance: CriterionImportance = 'CRITICAL';
  readonly applicableMatchTypes = [
    'DEAL_TO_BUYER',
    'DEAL_TO_PROVIDER',
  ];

  /**
   * Extract deal domain/industry from profile
   */
  private extractDealIndustry(profile: MatchingProfile): string[] {
    const industries: string[] = [];

    // Get from rawData.domain
    if (profile.rawData?.domain) {
      industries.push(normalizeString(profile.rawData.domain));
    }

    // Get from sectors
    industries.push(...profile.sectors.map(s => normalizeString(s)));

    // Parse from solutionType
    if (profile.rawData?.solutionType) {
      industries.push(normalizeString(profile.rawData.solutionType));
    }

    return [...new Set(industries.filter(Boolean))];
  }

  /**
   * Extract contact industry expertise
   */
  private extractContactIndustry(profile: MatchingProfile): string[] {
    const industries = [...profile.sectors.map(s => normalizeString(s))];

    // Check job title for industry hints
    if (profile.jobTitle) {
      const title = normalizeString(profile.jobTitle);
      for (const [industry, related] of Object.entries(RELATED_INDUSTRIES)) {
        const allTerms = [normalizeString(industry), ...related.map(r => normalizeString(r))];
        if (allTerms.some(term => title.includes(term))) {
          industries.push(industry);
        }
      }
    }

    // Check company for industry hints
    if (profile.company) {
      const company = normalizeString(profile.company);
      for (const [industry, related] of Object.entries(RELATED_INDUSTRIES)) {
        const allTerms = [normalizeString(industry), ...related.map(r => normalizeString(r))];
        if (allTerms.some(term => company.includes(term))) {
          industries.push(industry);
        }
      }
    }

    return [...new Set(industries.filter(Boolean))];
  }

  async calculate(
    source: MatchingProfile,
    target: MatchingProfile,
    context: CalculationContext
  ): Promise<CriterionResult> {
    // Source is deal, target is buyer/provider
    const dealIndustries = this.extractDealIndustry(source);
    const contactIndustries = this.extractContactIndustry(target);

    // Handle missing deal domain
    if (dealIndustries.length === 0) {
      return this.buildResult(
        0,
        'NONE',
        {
          summary: 'Deal domain not specified',
          sourceValue: 'Domain not defined',
          targetValue: contactIndustries.length > 0 ? contactIndustries.join(', ') : 'No sector data',
          matchType: 'NONE',
          details: ['Cannot evaluate industry match without deal domain'],
        },
        context,
        { sourceValues: [], targetValues: contactIndustries, matchedCount: 0, totalCount: 0 }
      );
    }

    // Find exact matches
    const exactMatches = findCommonItems(dealIndustries, contactIndustries);

    // Find related matches
    const relatedMatches: string[] = [];
    for (const dealIndustry of dealIndustries) {
      if (exactMatches.some(m => normalizeString(m) === dealIndustry)) continue;

      for (const [industry, related] of Object.entries(RELATED_INDUSTRIES)) {
        const normalizedIndustry = normalizeString(industry);
        const normalizedRelated = related.map(r => normalizeString(r));

        const dealInCategory = dealIndustry === normalizedIndustry || normalizedRelated.includes(dealIndustry);
        if (dealInCategory) {
          for (const contactIndustry of contactIndustries) {
            if (contactIndustry === normalizedIndustry || normalizedRelated.includes(contactIndustry)) {
              if (!relatedMatches.includes(contactIndustry)) {
                relatedMatches.push(contactIndustry);
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
      score = Math.min(100, 70 + exactMatches.length * 15);
      matchType = 'EXACT';
    } else if (relatedMatches.length > 0) {
      score = Math.min(70, 40 + relatedMatches.length * 15);
      matchType = 'PARTIAL';
    } else if (contactIndustries.length === 0) {
      score = 30; // Unknown contact industry
      matchType = 'PARTIAL';
    }

    const details: string[] = [];
    for (const match of exactMatches) {
      details.push(`✅ Industry match: ${match}`);
    }
    for (const match of relatedMatches) {
      details.push(`🔄 Related industry: ${match}`);
    }
    if (contactIndustries.length === 0) {
      details.push(`⚠️ Contact industry expertise unknown`);
    }
    if (details.length === 0) {
      details.push(`❌ No industry alignment`);
    }

    const summary = exactMatches.length > 0
      ? `Strong fit: ${exactMatches[0]}`
      : relatedMatches.length > 0
        ? `Related: ${relatedMatches[0]}`
        : contactIndustries.length === 0
          ? 'Industry unknown'
          : 'No industry match';

    return this.buildResult(
      score,
      matchType,
      {
        summary,
        sourceValue: `Deal: ${dealIndustries.join(', ')}`,
        targetValue: contactIndustries.length > 0 ? `${target.name}: ${contactIndustries.join(', ')}` : 'Industry not specified',
        matchType,
        details,
      },
      context,
      {
        sourceValues: dealIndustries,
        targetValues: contactIndustries,
        matchedCount: exactMatches.length + relatedMatches.length,
        totalCount: dealIndustries.length,
        additionalData: { exactMatches, relatedMatches },
      }
    );
  }
}

export default DealIndustryCriterion;
