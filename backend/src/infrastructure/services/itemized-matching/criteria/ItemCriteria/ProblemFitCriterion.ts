/**
 * Problem Fit Criterion Calculator
 *
 * Calculates semantic match between deal's problem statement and buyer's likely pain points.
 * Used for DEAL_TO_BUYER matching.
 *
 * @module infrastructure/services/itemized-matching/criteria/ItemCriteria/ProblemFitCriterion
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
 * Problem categories and related keywords
 */
const PROBLEM_CATEGORIES: Record<string, string[]> = {
  'efficiency': ['efficiency', 'productivity', 'automation', 'time-saving', 'streamline', 'optimize', 'reduce costs', 'manual process'],
  'growth': ['growth', 'scale', 'expand', 'revenue', 'sales', 'market share', 'customer acquisition', 'lead generation'],
  'compliance': ['compliance', 'regulation', 'legal', 'audit', 'risk management', 'security', 'gdpr', 'privacy'],
  'integration': ['integration', 'connect', 'unify', 'consolidate', 'silos', 'interoperability', 'api'],
  'analytics': ['analytics', 'data', 'insights', 'reporting', 'visibility', 'dashboards', 'metrics', 'kpis'],
  'customer_experience': ['customer experience', 'cx', 'satisfaction', 'retention', 'support', 'service', 'engagement'],
  'talent': ['talent', 'hiring', 'recruitment', 'retention', 'skills gap', 'training', 'workforce'],
  'digital_transformation': ['digital transformation', 'modernization', 'legacy', 'cloud migration', 'digital'],
};

/**
 * Role to likely problems mapping
 */
const ROLE_PROBLEMS: Record<string, string[]> = {
  'ceo': ['growth', 'efficiency', 'digital_transformation'],
  'cfo': ['efficiency', 'compliance', 'analytics'],
  'cto': ['integration', 'digital_transformation', 'efficiency'],
  'coo': ['efficiency', 'integration', 'compliance'],
  'cmo': ['growth', 'customer_experience', 'analytics'],
  'hr': ['talent', 'efficiency', 'compliance'],
  'sales': ['growth', 'efficiency', 'analytics'],
  'it': ['integration', 'efficiency', 'digital_transformation'],
};

export class ProblemFitCriterion extends BaseCriterionCalculator {
  readonly id = 'problem_fit';
  readonly name = 'Problem Fit';
  readonly icon = '🎯';
  readonly defaultImportance: CriterionImportance = 'HIGH';
  readonly applicableMatchTypes = [
    'DEAL_TO_BUYER',
  ];

  /**
   * Extract problems from deal
   */
  private extractDealProblems(profile: MatchingProfile): {
    keywords: string[];
    categories: string[];
  } {
    const keywords: string[] = [];
    const categories: string[] = [];

    // Get problem statement
    const problemStatement = normalizeString(profile.rawData?.problemStatement || '');
    const targetDescription = normalizeString(profile.rawData?.targetDescription || '');
    const combined = `${problemStatement} ${targetDescription}`;

    // Extract keywords
    const words = combined.split(/\s+/).filter(w => w.length > 3);
    keywords.push(...words);

    // Identify categories
    for (const [category, categoryKeywords] of Object.entries(PROBLEM_CATEGORIES)) {
      for (const kw of categoryKeywords) {
        if (combined.includes(kw)) {
          categories.push(category);
          keywords.push(...categoryKeywords.slice(0, 3));
          break;
        }
      }
    }

    return {
      keywords: [...new Set(keywords)],
      categories: [...new Set(categories)],
    };
  }

  /**
   * Infer buyer's likely problems
   */
  private inferBuyerProblems(profile: MatchingProfile): {
    categories: string[];
    keywords: string[];
    confidence: number;
  } {
    const categories: string[] = [];
    const keywords: string[] = [];

    // Infer from job title/role
    if (profile.jobTitle) {
      const title = normalizeString(profile.jobTitle);

      for (const [role, problems] of Object.entries(ROLE_PROBLEMS)) {
        if (title.includes(role)) {
          categories.push(...problems);
          for (const problem of problems) {
            keywords.push(...(PROBLEM_CATEGORIES[problem] || []).slice(0, 3));
          }
        }
      }
    }

    // Infer from sectors
    for (const sector of profile.sectors) {
      const normalizedSector = normalizeString(sector);
      if (normalizedSector.includes('tech') || normalizedSector.includes('software')) {
        categories.push('integration', 'digital_transformation');
      }
      if (normalizedSector.includes('finance') || normalizedSector.includes('banking')) {
        categories.push('compliance', 'analytics', 'efficiency');
      }
      if (normalizedSector.includes('retail') || normalizedSector.includes('commerce')) {
        categories.push('customer_experience', 'growth', 'analytics');
      }
    }

    // Check bio for pain point indicators
    if (profile.bio) {
      const bio = normalizeString(profile.bio);
      for (const [category, categoryKeywords] of Object.entries(PROBLEM_CATEGORIES)) {
        for (const kw of categoryKeywords) {
          if (bio.includes(kw)) {
            categories.push(category);
            keywords.push(kw);
            break;
          }
        }
      }
    }

    const uniqueCategories = [...new Set(categories)];
    const uniqueKeywords = [...new Set(keywords)];
    const confidence = uniqueCategories.length > 0 ? Math.min(0.8, 0.3 + uniqueCategories.length * 0.15) : 0.2;

    return {
      categories: uniqueCategories,
      keywords: uniqueKeywords,
      confidence,
    };
  }

  async calculate(
    source: MatchingProfile,
    target: MatchingProfile,
    context: CalculationContext
  ): Promise<CriterionResult> {
    // Source is deal, target is buyer
    const dealProblems = this.extractDealProblems(source);
    const buyerProblems = this.inferBuyerProblems(target);

    // Handle missing deal problem statement
    if (dealProblems.categories.length === 0 && dealProblems.keywords.length < 3) {
      return this.buildResult(
        30,
        'PARTIAL',
        {
          summary: 'Problem statement unclear',
          sourceValue: 'Limited problem description',
          targetValue: buyerProblems.categories.length > 0 ? buyerProblems.categories.join(', ') : 'Pain points unknown',
          matchType: 'PARTIAL',
          details: ['⚠️ Deal problem statement not clear enough for matching'],
        },
        context,
        { sourceValues: dealProblems.keywords, targetValues: buyerProblems.keywords, matchedCount: 0, totalCount: 0 }
      );
    }

    // Find matches
    const categoryMatches = findCommonItems(dealProblems.categories, buyerProblems.categories);
    const keywordMatches = findCommonItems(dealProblems.keywords, buyerProblems.keywords);

    // Calculate score
    let score = 0;
    let matchType: MatchType = 'NONE';
    const details: string[] = [];

    if (categoryMatches.length >= 2) {
      score = 100;
      matchType = 'EXACT';
      details.push(`✅ Strong problem alignment: ${categoryMatches.join(', ')}`);
    } else if (categoryMatches.length === 1) {
      score = 75;
      matchType = 'PARTIAL';
      details.push(`✅ Problem category match: ${categoryMatches[0]}`);
    } else if (keywordMatches.length >= 3) {
      score = 60;
      matchType = 'PARTIAL';
      details.push(`🔄 Related keywords: ${keywordMatches.slice(0, 3).join(', ')}`);
    } else if (keywordMatches.length > 0) {
      score = 40;
      matchType = 'PARTIAL';
      details.push(`🔄 Some keyword overlap: ${keywordMatches.join(', ')}`);
    } else {
      score = 15;
      details.push(`❌ No clear problem alignment`);
    }

    // Adjust for buyer inference confidence
    score = Math.round(score * Math.max(0.6, buyerProblems.confidence));

    if (buyerProblems.confidence < 0.5) {
      details.push(`⚠️ Buyer pain points inferred with low confidence`);
    }

    const summary = categoryMatches.length > 0
      ? `Addresses: ${categoryMatches[0]}`
      : keywordMatches.length > 0
        ? `Related: ${keywordMatches[0]}`
        : 'Unclear problem fit';

    return this.buildResult(
      score,
      matchType,
      {
        summary,
        sourceValue: `Deal: ${dealProblems.categories.join(', ') || dealProblems.keywords.slice(0, 3).join(', ')}`,
        targetValue: `${target.name}: ${buyerProblems.categories.join(', ') || 'Inferred pain points'}`,
        matchType,
        details,
      },
      context,
      {
        sourceValues: [...dealProblems.categories, ...dealProblems.keywords],
        targetValues: [...buyerProblems.categories, ...buyerProblems.keywords],
        matchedCount: categoryMatches.length + keywordMatches.length,
        totalCount: dealProblems.categories.length + dealProblems.keywords.length,
        additionalData: { dealProblems, buyerProblems, categoryMatches, keywordMatches },
      }
    );
  }
}

export default ProblemFitCriterion;
