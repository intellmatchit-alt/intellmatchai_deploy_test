/**
 * Capabilities Criterion Calculator
 *
 * Calculates match score based on provider's capabilities vs deal requirements.
 * Separate from Solution criterion - focuses on specific skill/tool capabilities.
 *
 * @module infrastructure/services/itemized-matching/criteria/ItemCriteria/CapabilitiesCriterion
 */

import {
  BaseCriterionCalculator,
  MatchingProfile,
  CalculationContext,
  CriterionResult,
} from '../../interfaces/ICriterionCalculator';
import { CriterionImportance, MatchType } from '../../../../../domain/services/IItemizedMatchingService';
import { normalizeString, findCommonItems } from '../../utils/ScoreUtils';
import { SKILL_SYNONYMS } from '../../constants/CriteriaDefinitions';

export class CapabilitiesCriterion extends BaseCriterionCalculator {
  readonly id = 'capabilities';
  readonly name = 'Capabilities';
  readonly icon = '💡';
  readonly defaultImportance: CriterionImportance = 'HIGH';
  readonly applicableMatchTypes = [
    'DEAL_TO_PROVIDER',
  ];

  /**
   * Extract required capabilities from deal
   */
  private extractDealCapabilities(profile: MatchingProfile): string[] {
    const capabilities: string[] = [];

    // Get from skills array
    capabilities.push(...profile.skills.map(s => normalizeString(s)));

    // Parse from problem statement
    if (profile.rawData?.problemStatement) {
      const problem = normalizeString(profile.rawData.problemStatement);
      // Extract technology/skill mentions
      for (const [skill, synonyms] of Object.entries(SKILL_SYNONYMS)) {
        const allTerms = [normalizeString(skill), ...synonyms.map(s => normalizeString(s))];
        if (allTerms.some(term => problem.includes(term))) {
          capabilities.push(skill);
        }
      }
    }

    // Parse from target description
    if (profile.rawData?.targetDescription) {
      const desc = normalizeString(profile.rawData.targetDescription);
      for (const [skill, synonyms] of Object.entries(SKILL_SYNONYMS)) {
        const allTerms = [normalizeString(skill), ...synonyms.map(s => normalizeString(s))];
        if (allTerms.some(term => desc.includes(term))) {
          capabilities.push(skill);
        }
      }
    }

    // Parse from solution type
    if (profile.rawData?.solutionType) {
      capabilities.push(normalizeString(profile.rawData.solutionType));
    }

    return [...new Set(capabilities.filter(Boolean))];
  }

  /**
   * Extract provider capabilities
   */
  private extractProviderCapabilities(profile: MatchingProfile): string[] {
    const capabilities: string[] = [];

    // Get from skills
    capabilities.push(...profile.skills.map(s => normalizeString(s)));

    // Get from sectors (industry expertise)
    capabilities.push(...profile.sectors.map(s => normalizeString(s)));

    // Parse from bio
    if (profile.bio) {
      const bio = normalizeString(profile.bio);
      for (const [skill, synonyms] of Object.entries(SKILL_SYNONYMS)) {
        const allTerms = [normalizeString(skill), ...synonyms.map(s => normalizeString(s))];
        if (allTerms.some(term => bio.includes(term))) {
          capabilities.push(skill);
        }
      }
    }

    // Parse from job title
    if (profile.jobTitle) {
      const title = normalizeString(profile.jobTitle);
      for (const [skill, synonyms] of Object.entries(SKILL_SYNONYMS)) {
        const allTerms = [normalizeString(skill), ...synonyms.map(s => normalizeString(s))];
        if (allTerms.some(term => title.includes(term))) {
          capabilities.push(skill);
        }
      }
    }

    return [...new Set(capabilities.filter(Boolean))];
  }

  /**
   * Check for skill matches including synonyms
   */
  private findCapabilityMatches(required: string[], available: string[]): {
    exact: string[];
    synonym: string[];
  } {
    const exact: string[] = [];
    const synonym: string[] = [];

    for (const req of required) {
      const normalizedReq = normalizeString(req);

      // Check exact match
      if (available.some(a => normalizeString(a) === normalizedReq)) {
        exact.push(req);
        continue;
      }

      // Check synonym match
      for (const [canonical, synonyms] of Object.entries(SKILL_SYNONYMS)) {
        const allTerms = [normalizeString(canonical), ...synonyms.map(s => normalizeString(s))];
        if (allTerms.includes(normalizedReq)) {
          // Check if provider has canonical or any synonym
          if (available.some(a => allTerms.includes(normalizeString(a)))) {
            synonym.push(req);
            break;
          }
        }
      }
    }

    return { exact, synonym };
  }

  async calculate(
    source: MatchingProfile,
    target: MatchingProfile,
    context: CalculationContext
  ): Promise<CriterionResult> {
    // Source is deal, target is provider
    const dealCapabilities = this.extractDealCapabilities(source);
    const providerCapabilities = this.extractProviderCapabilities(target);

    // Handle missing data
    if (dealCapabilities.length === 0) {
      return this.buildResult(
        50,
        'PARTIAL',
        {
          summary: 'Requirements not specified',
          sourceValue: 'Capabilities not defined',
          targetValue: providerCapabilities.length > 0 ? providerCapabilities.slice(0, 5).join(', ') : 'Capabilities unknown',
          matchType: 'PARTIAL',
          details: ['⚠️ Deal does not specify required capabilities'],
        },
        context,
        { sourceValues: [], targetValues: providerCapabilities, matchedCount: 0, totalCount: 0 }
      );
    }

    if (providerCapabilities.length === 0) {
      return this.buildResult(
        20,
        'NONE',
        {
          summary: 'Provider capabilities unknown',
          sourceValue: `Required: ${dealCapabilities.slice(0, 5).join(', ')}`,
          targetValue: 'Capabilities not specified',
          matchType: 'NONE',
          details: ['⚠️ Cannot determine provider capabilities'],
        },
        context,
        { sourceValues: dealCapabilities, targetValues: [], matchedCount: 0, totalCount: dealCapabilities.length }
      );
    }

    const matches = this.findCapabilityMatches(dealCapabilities, providerCapabilities);
    const totalMatches = matches.exact.length + matches.synonym.length;
    const matchRatio = totalMatches / dealCapabilities.length;

    let score = Math.round(matchRatio * 100);
    let matchType: MatchType = 'NONE';
    const details: string[] = [];

    // Add exact matches
    for (const match of matches.exact) {
      details.push(`✅ ${match}: Exact match`);
    }

    // Add synonym matches
    for (const match of matches.synonym) {
      details.push(`✅ ${match}: Equivalent skill`);
    }

    // Add missing
    const missing = dealCapabilities.filter(c =>
      !matches.exact.includes(c) && !matches.synonym.includes(c)
    );
    for (const miss of missing.slice(0, 3)) {
      details.push(`❌ ${miss}: Not found`);
    }
    if (missing.length > 3) {
      details.push(`❌ +${missing.length - 3} more missing`);
    }

    if (matchRatio >= 0.8) {
      matchType = 'EXACT';
    } else if (matchRatio >= 0.5) {
      matchType = 'PARTIAL';
    } else if (matchRatio > 0) {
      matchType = 'PARTIAL';
    }

    const summary = totalMatches > 0
      ? `${totalMatches}/${dealCapabilities.length} capabilities match`
      : 'No matching capabilities';

    return this.buildResult(
      score,
      matchType,
      {
        summary,
        sourceValue: `Required: ${dealCapabilities.slice(0, 5).join(', ')}`,
        targetValue: `${target.name}: ${providerCapabilities.slice(0, 5).join(', ')}`,
        matchType,
        details,
      },
      context,
      {
        sourceValues: dealCapabilities,
        targetValues: providerCapabilities,
        matchedCount: totalMatches,
        totalCount: dealCapabilities.length,
        additionalData: { matches, missing },
      }
    );
  }
}

export default CapabilitiesCriterion;
