/**
 * Solution Criterion Calculator
 *
 * Calculates match based on whether provider can solve the stated problem.
 * Used for DEAL_TO_PROVIDER matching.
 *
 * @module infrastructure/services/itemized-matching/criteria/ItemCriteria/SolutionCriterion
 */

import {
  BaseCriterionCalculator,
  MatchingProfile,
  CalculationContext,
  CriterionResult,
} from '../../interfaces/ICriterionCalculator';
import { CriterionImportance, MatchType } from '../../../../../domain/services/IItemizedMatchingService';
import { normalizeString, findCommonItems } from '../../utils/ScoreUtils';

/**
 * Solution types and related capabilities
 */
const SOLUTION_TYPES: Record<string, string[]> = {
  'software': ['software', 'saas', 'platform', 'app', 'application', 'system', 'tool'],
  'consulting': ['consulting', 'advisory', 'strategy', 'implementation', 'transformation'],
  'services': ['services', 'managed services', 'outsourcing', 'support', 'maintenance'],
  'integration': ['integration', 'api', 'middleware', 'connector', 'data migration'],
  'analytics': ['analytics', 'bi', 'business intelligence', 'data science', 'reporting'],
  'security': ['security', 'cybersecurity', 'compliance', 'audit', 'risk'],
  'infrastructure': ['infrastructure', 'cloud', 'hosting', 'devops', 'networking'],
  'marketing': ['marketing', 'advertising', 'branding', 'digital marketing', 'content'],
  'development': ['development', 'custom development', 'engineering', 'programming'],
};

export class SolutionCriterion extends BaseCriterionCalculator {
  readonly id = 'solution';
  readonly name = 'Solution Match';
  readonly icon = '🔧';
  readonly defaultImportance: CriterionImportance = 'CRITICAL';
  readonly applicableMatchTypes = [
    'DEAL_TO_PROVIDER',
  ];

  /**
   * Extract deal's solution requirements
   */
  private extractDealRequirements(profile: MatchingProfile): {
    solutionTypes: string[];
    keywords: string[];
    skills: string[];
  } {
    const solutionTypes: string[] = [];
    const keywords: string[] = [];
    const skills: string[] = [];

    // Get solution type
    const rawSolutionType = normalizeString(profile.rawData?.solutionType || '');
    const problemStatement = normalizeString(profile.rawData?.problemStatement || '');
    const targetDescription = normalizeString(profile.rawData?.targetDescription || '');
    const combined = `${rawSolutionType} ${problemStatement} ${targetDescription}`;

    // Identify solution types
    for (const [type, typeKeywords] of Object.entries(SOLUTION_TYPES)) {
      for (const kw of typeKeywords) {
        if (combined.includes(kw)) {
          solutionTypes.push(type);
          keywords.push(...typeKeywords.slice(0, 3));
          break;
        }
      }
    }

    // Get required skills from sectors
    skills.push(...profile.sectors.map(s => normalizeString(s)));

    // Extract keywords from descriptions
    const words = combined.split(/\s+/).filter(w => w.length > 4);
    keywords.push(...words.slice(0, 20));

    return {
      solutionTypes: [...new Set(solutionTypes)],
      keywords: [...new Set(keywords)],
      skills: [...new Set(skills)],
    };
  }

  /**
   * Extract provider's capabilities
   */
  private extractProviderCapabilities(profile: MatchingProfile): {
    solutionTypes: string[];
    skills: string[];
    keywords: string[];
  } {
    const solutionTypes: string[] = [];
    const skills: string[] = [];
    const keywords: string[] = [];

    // Get from sectors
    for (const sector of profile.sectors) {
      const normalized = normalizeString(sector);
      skills.push(normalized);

      // Map sector to solution type
      for (const [type, typeKeywords] of Object.entries(SOLUTION_TYPES)) {
        if (typeKeywords.some(kw => normalized.includes(kw) || kw.includes(normalized))) {
          solutionTypes.push(type);
        }
      }
    }

    // Get from skills
    for (const skill of profile.skills) {
      const normalized = normalizeString(skill);
      skills.push(normalized);
    }

    // Parse from job title
    if (profile.jobTitle) {
      const title = normalizeString(profile.jobTitle);
      for (const [type, typeKeywords] of Object.entries(SOLUTION_TYPES)) {
        if (typeKeywords.some(kw => title.includes(kw))) {
          solutionTypes.push(type);
        }
      }
    }

    // Parse from bio
    if (profile.bio) {
      const bio = normalizeString(profile.bio);
      for (const [type, typeKeywords] of Object.entries(SOLUTION_TYPES)) {
        for (const kw of typeKeywords) {
          if (bio.includes(kw)) {
            solutionTypes.push(type);
            keywords.push(kw);
            break;
          }
        }
      }
    }

    // Parse from company
    if (profile.company) {
      const company = normalizeString(profile.company);
      for (const [type, typeKeywords] of Object.entries(SOLUTION_TYPES)) {
        if (typeKeywords.some(kw => company.includes(kw))) {
          solutionTypes.push(type);
        }
      }
    }

    return {
      solutionTypes: [...new Set(solutionTypes)],
      skills: [...new Set(skills)],
      keywords: [...new Set(keywords)],
    };
  }

  async calculate(
    source: MatchingProfile,
    target: MatchingProfile,
    context: CalculationContext
  ): Promise<CriterionResult> {
    // Source is deal, target is provider
    const dealReqs = this.extractDealRequirements(source);
    const providerCaps = this.extractProviderCapabilities(target);

    // Handle missing deal requirements
    if (dealReqs.solutionTypes.length === 0 && dealReqs.skills.length === 0) {
      return this.buildResult(
        30,
        'PARTIAL',
        {
          summary: 'Solution requirements unclear',
          sourceValue: 'Requirements not specified',
          targetValue: providerCaps.solutionTypes.length > 0 ? providerCaps.solutionTypes.join(', ') : 'Capabilities unknown',
          matchType: 'PARTIAL',
          details: ['⚠️ Deal solution requirements not clear'],
        },
        context,
        { sourceValues: [], targetValues: providerCaps.solutionTypes, matchedCount: 0, totalCount: 0 }
      );
    }

    // Find matches
    const solutionTypeMatches = findCommonItems(dealReqs.solutionTypes, providerCaps.solutionTypes);
    const skillMatches = findCommonItems(dealReqs.skills, providerCaps.skills);
    const keywordMatches = findCommonItems(dealReqs.keywords, providerCaps.keywords);

    // Calculate score
    let score = 0;
    let matchType: MatchType = 'NONE';
    const details: string[] = [];

    if (solutionTypeMatches.length >= 2) {
      score = 100;
      matchType = 'EXACT';
      details.push(`✅ Strong solution match: ${solutionTypeMatches.join(', ')}`);
    } else if (solutionTypeMatches.length === 1) {
      score = 80;
      matchType = 'PARTIAL';
      details.push(`✅ Solution type match: ${solutionTypeMatches[0]}`);
    } else if (skillMatches.length >= 2) {
      score = 65;
      matchType = 'PARTIAL';
      details.push(`🔄 Skill alignment: ${skillMatches.slice(0, 3).join(', ')}`);
    } else if (skillMatches.length === 1 || keywordMatches.length >= 3) {
      score = 45;
      matchType = 'PARTIAL';
      details.push(`🔄 Partial capability match`);
    } else {
      score = 15;
      details.push(`❌ No clear solution alignment`);
    }

    // Add skill match details
    if (skillMatches.length > 0 && solutionTypeMatches.length === 0) {
      details.push(`Skills: ${skillMatches.slice(0, 3).join(', ')}`);
    }

    const summary = solutionTypeMatches.length > 0
      ? `Provides: ${solutionTypeMatches[0]}`
      : skillMatches.length > 0
        ? `Has skills: ${skillMatches[0]}`
        : 'Unclear solution fit';

    return this.buildResult(
      score,
      matchType,
      {
        summary,
        sourceValue: `Need: ${dealReqs.solutionTypes.join(', ') || dealReqs.skills.slice(0, 3).join(', ')}`,
        targetValue: `${target.name}: ${providerCaps.solutionTypes.join(', ') || providerCaps.skills.slice(0, 3).join(', ')}`,
        matchType,
        details,
      },
      context,
      {
        sourceValues: [...dealReqs.solutionTypes, ...dealReqs.skills],
        targetValues: [...providerCaps.solutionTypes, ...providerCaps.skills],
        matchedCount: solutionTypeMatches.length + skillMatches.length,
        totalCount: dealReqs.solutionTypes.length + dealReqs.skills.length,
        additionalData: { dealReqs, providerCaps, solutionTypeMatches, skillMatches },
      }
    );
  }
}

export default SolutionCriterion;
