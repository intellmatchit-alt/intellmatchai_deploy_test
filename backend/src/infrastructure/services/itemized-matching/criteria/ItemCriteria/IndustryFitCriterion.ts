/**
 * Industry Fit Criterion Calculator
 *
 * CRITICAL: Calculates match score based on project sectors vs investor/contact sector focus.
 * Used for PROJECT_TO_INVESTOR and PROJECT_TO_PARTNER matching.
 *
 * @module infrastructure/services/itemized-matching/criteria/ItemCriteria/IndustryFitCriterion
 */

import {
  BaseCriterionCalculator,
  MatchingProfile,
  CalculationContext,
  CriterionResult,
} from '../../interfaces/ICriterionCalculator';
import { CriterionImportance, MatchType } from '../../../../../domain/services/IItemizedMatchingService';
import { RELATED_INDUSTRIES } from '../../constants/CriteriaDefinitions';
import { findCommonItems, normalizeString } from '../../utils/ScoreUtils';

export class IndustryFitCriterion extends BaseCriterionCalculator {
  readonly id = 'industry_fit';
  readonly name = 'Industry Fit';
  readonly icon = '🏭';
  readonly defaultImportance: CriterionImportance = 'CRITICAL';
  readonly applicableMatchTypes = [
    'PROJECT_TO_INVESTOR',
    'PROJECT_TO_PARTNER',
    'PROJECT_TO_TALENT',
    'PROJECT_TO_DYNAMIC',
    'DEAL_TO_BUYER',
    'DEAL_TO_PROVIDER',
  ];

  getImportance(matchType: string): CriterionImportance {
    if (matchType === 'PROJECT_TO_INVESTOR') return 'CRITICAL';
    return 'HIGH';
  }

  /**
   * Extract investor focus sectors from enrichmentData
   */
  private extractInvestorFocus(profile: MatchingProfile): string[] {
    const sectors = [...profile.sectors];

    // Try to extract from enrichmentData
    const enrichment = profile.rawData?.enrichmentData;
    if (enrichment) {
      const parsed = typeof enrichment === 'string' ?
        this.safeJsonParse(enrichment) : enrichment;

      if (parsed) {
        // Common paths for investor focus data
        const focusPaths = [
          parsed.investmentFocus,
          parsed.sectors,
          parsed.industries,
          parsed.focus_areas,
          parsed.portfolio_industries,
        ];

        for (const focusData of focusPaths) {
          if (Array.isArray(focusData)) {
            sectors.push(...focusData.map((s: any) => typeof s === 'string' ? s : s.name || ''));
          }
        }
      }
    }

    // Also check bio for industry mentions
    if (profile.bio) {
      const bioLower = profile.bio.toLowerCase();
      for (const [industry, related] of Object.entries(RELATED_INDUSTRIES)) {
        if (bioLower.includes(industry) || related.some(r => bioLower.includes(r))) {
          sectors.push(industry);
        }
      }
    }

    return [...new Set(sectors.map(s => normalizeString(s)).filter(Boolean))];
  }

  private safeJsonParse(str: string): any {
    try {
      return JSON.parse(str);
    } catch {
      return null;
    }
  }

  async calculate(
    source: MatchingProfile,
    target: MatchingProfile,
    context: CalculationContext
  ): Promise<CriterionResult> {
    // Source is the project, target is the investor/contact
    const projectSectors = source.sectors.map(s => normalizeString(s));
    const investorSectors = this.extractInvestorFocus(target);

    // Handle missing data
    if (projectSectors.length === 0) {
      return this.buildResult(
        0,
        'NONE',
        {
          summary: 'Project sectors not specified',
          sourceValue: 'No sectors defined',
          targetValue: investorSectors.length > 0 ? investorSectors.join(', ') : 'No focus areas',
          matchType: 'NONE',
          details: ['Cannot evaluate industry fit without project sectors'],
        },
        context,
        { sourceValues: [], targetValues: investorSectors, matchedCount: 0, totalCount: 0 }
      );
    }

    // Find exact matches
    const exactMatches = findCommonItems(projectSectors, investorSectors);

    // Find related industry matches
    const relatedMatches: string[] = [];
    for (const projectSector of projectSectors) {
      if (exactMatches.some(m => normalizeString(m) === projectSector)) continue;

      for (const [industry, related] of Object.entries(RELATED_INDUSTRIES)) {
        const normalizedIndustry = normalizeString(industry);
        const normalizedRelated = related.map(r => normalizeString(r));

        const projectInCategory = projectSector === normalizedIndustry || normalizedRelated.includes(projectSector);
        if (projectInCategory) {
          for (const investorSector of investorSectors) {
            if (investorSector === normalizedIndustry || normalizedRelated.includes(investorSector)) {
              if (!relatedMatches.includes(investorSector)) {
                relatedMatches.push(investorSector);
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
      // Exact matches are highly valued
      score = Math.min(100, 60 + exactMatches.length * 20);
      matchType = exactMatches.length >= 2 ? 'EXACT' : 'PARTIAL';
    }

    if (relatedMatches.length > 0 && score < 100) {
      score = Math.min(100, score + relatedMatches.length * 15);
      if (matchType === 'NONE') matchType = 'PARTIAL';
    }

    // If investor has no stated focus but project has sectors, give partial credit
    if (investorSectors.length === 0 && projectSectors.length > 0) {
      score = 30; // Unknown investor focus
      matchType = 'PARTIAL';
    }

    // Build explanation
    const details: string[] = [];
    for (const match of exactMatches) {
      details.push(`✅ Direct sector match: ${match}`);
    }
    for (const match of relatedMatches) {
      details.push(`🔄 Related sector: ${match}`);
    }
    if (investorSectors.length === 0) {
      details.push(`⚠️ Investor sector focus unknown`);
    }
    if (details.length === 0 && score === 0) {
      details.push(`❌ No industry alignment found`);
    }

    const summary = exactMatches.length > 0
      ? `Strong fit: ${exactMatches.slice(0, 2).join(', ')}`
      : relatedMatches.length > 0
        ? `Related: ${relatedMatches.slice(0, 2).join(', ')}`
        : investorSectors.length === 0
          ? 'Investor focus unknown'
          : 'No industry alignment';

    return this.buildResult(
      score,
      matchType,
      {
        summary,
        sourceValue: `Project: ${projectSectors.join(', ')}`,
        targetValue: investorSectors.length > 0 ? `${target.name}: ${investorSectors.join(', ')}` : 'Focus not specified',
        matchType,
        details,
      },
      context,
      {
        sourceValues: projectSectors,
        targetValues: investorSectors,
        matchedCount: exactMatches.length + relatedMatches.length,
        totalCount: projectSectors.length,
        additionalData: { exactMatches, relatedMatches },
      }
    );
  }
}

export default IndustryFitCriterion;
