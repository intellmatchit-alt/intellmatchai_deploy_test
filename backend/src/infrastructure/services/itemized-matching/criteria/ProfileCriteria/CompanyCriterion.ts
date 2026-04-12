/**
 * Company Criterion Calculator
 *
 * Calculates match score based on company overlap.
 * Same company = 100% | Similar company name = 70% | Same industry context = 40%
 *
 * @module infrastructure/services/itemized-matching/criteria/ProfileCriteria/CompanyCriterion
 */

import {
  BaseCriterionCalculator,
  MatchingProfile,
  CalculationContext,
  CriterionResult,
} from '../../interfaces/ICriterionCalculator';
import { CriterionImportance, MatchType } from '../../../../../domain/services/IItemizedMatchingService';
import { normalizeString, areStringSimilar } from '../../utils/ScoreUtils';

/**
 * Common company name variations to normalize
 */
const COMPANY_SUFFIXES = [
  'inc', 'inc.', 'incorporated',
  'llc', 'l.l.c.', 'limited liability company',
  'ltd', 'ltd.', 'limited',
  'corp', 'corp.', 'corporation',
  'co', 'co.', 'company',
  'plc', 'p.l.c.',
  'gmbh', 'ag', 'sa', 'bv', 'nv',
  'pvt', 'pvt.', 'private',
  'group', 'holding', 'holdings',
  'international', 'intl', 'intl.',
];

/**
 * Known company parent-subsidiary relationships (simplified)
 */
const COMPANY_FAMILIES: Record<string, string[]> = {
  'alphabet': ['google', 'youtube', 'waymo', 'deepmind', 'verily'],
  'meta': ['facebook', 'instagram', 'whatsapp', 'oculus'],
  'amazon': ['aws', 'amazon web services', 'twitch', 'whole foods', 'ring', 'audible'],
  'microsoft': ['linkedin', 'github', 'azure', 'xbox', 'activision'],
  'apple': ['beats', 'shazam'],
};

export class CompanyCriterion extends BaseCriterionCalculator {
  readonly id = 'company';
  readonly name = 'Company';
  readonly icon = '💼';
  readonly defaultImportance: CriterionImportance = 'MEDIUM';
  readonly applicableMatchTypes = [
    'PROFILE_TO_PROFILE',
    'PROFILE_TO_USER',
  ];

  /**
   * Normalize company name for comparison
   */
  private normalizeCompanyName(company: string): string {
    let normalized = normalizeString(company);

    // Remove common suffixes
    for (const suffix of COMPANY_SUFFIXES) {
      const suffixPattern = new RegExp(`\\s*,?\\s*${suffix}\\s*$`, 'i');
      normalized = normalized.replace(suffixPattern, '');
    }

    // Remove trailing punctuation
    normalized = normalized.replace(/[,.\s]+$/, '').trim();

    return normalized;
  }

  /**
   * Check if two companies are in the same family
   */
  private areSameFamily(company1: string, company2: string): string | null {
    const n1 = this.normalizeCompanyName(company1);
    const n2 = this.normalizeCompanyName(company2);

    for (const [parent, subsidiaries] of Object.entries(COMPANY_FAMILIES)) {
      const family = [parent, ...subsidiaries].map(c => normalizeString(c));
      const inFamily1 = family.some(c => n1.includes(c) || c.includes(n1));
      const inFamily2 = family.some(c => n2.includes(c) || c.includes(n2));

      if (inFamily1 && inFamily2) {
        return parent.charAt(0).toUpperCase() + parent.slice(1);
      }
    }

    return null;
  }

  async calculate(
    source: MatchingProfile,
    target: MatchingProfile,
    context: CalculationContext
  ): Promise<CriterionResult> {
    const sourceCompany = source.company;
    const targetCompany = target.company;

    // Handle missing company data
    if (!sourceCompany || !targetCompany) {
      return this.buildResult(
        0,
        'NONE',
        {
          summary: 'Company not specified',
          sourceValue: sourceCompany ? `${source.name}: ${sourceCompany}` : 'Company not provided',
          targetValue: targetCompany ? `${target.name}: ${targetCompany}` : 'Company not provided',
          matchType: 'NONE',
          details: ['Unable to compare companies'],
        },
        context,
        {
          sourceValues: sourceCompany ? [sourceCompany] : [],
          targetValues: targetCompany ? [targetCompany] : [],
          matchedCount: 0,
          totalCount: 0,
        }
      );
    }

    const normalizedSource = this.normalizeCompanyName(sourceCompany);
    const normalizedTarget = this.normalizeCompanyName(targetCompany);

    let score = 0;
    let matchType: MatchType = 'NONE';
    const details: string[] = [];
    let summary = '';

    // Check exact match (after normalization)
    if (normalizedSource === normalizedTarget) {
      score = 100;
      matchType = 'EXACT';
      details.push(`✅ Same company: ${sourceCompany}`);
      summary = `Same company: ${sourceCompany}`;
    }
    // Check similar names (fuzzy match)
    else if (areStringSimilar(normalizedSource, normalizedTarget, 0.85)) {
      score = 90;
      matchType = 'EXACT';
      details.push(`✅ Same company (variant): ${sourceCompany} ≈ ${targetCompany}`);
      summary = `Same company: ${sourceCompany}`;
    }
    // Check if one contains the other (partial match)
    else if (normalizedSource.includes(normalizedTarget) || normalizedTarget.includes(normalizedSource)) {
      score = 80;
      matchType = 'PARTIAL';
      details.push(`🔄 Related company names: ${sourceCompany} / ${targetCompany}`);
      summary = `Related companies`;
    }
    // Check company family relationships
    else {
      const familyName = this.areSameFamily(sourceCompany, targetCompany);
      if (familyName) {
        score = 70;
        matchType = 'PARTIAL';
        details.push(`🔄 Same company family: ${familyName}`);
        summary = `Same company group: ${familyName}`;
      } else {
        // No match
        details.push(`❌ Different companies`);
        summary = 'Different companies';
      }
    }

    return this.buildResult(
      score,
      matchType,
      {
        summary,
        sourceValue: `${source.name}: ${sourceCompany}`,
        targetValue: `${target.name}: ${targetCompany}`,
        matchType,
        details,
      },
      context,
      {
        sourceValues: [sourceCompany],
        targetValues: [targetCompany],
        matchedCount: score > 0 ? 1 : 0,
        totalCount: 1,
        additionalData: { normalizedSource, normalizedTarget },
      }
    );
  }
}

export default CompanyCriterion;
