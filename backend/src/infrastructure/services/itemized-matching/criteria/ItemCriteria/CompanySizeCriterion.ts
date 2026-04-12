/**
 * Company Size Criterion Calculator
 *
 * Calculates match score based on deal target company size vs contact's company size.
 * Used for DEAL_TO_BUYER matching.
 *
 * @module infrastructure/services/itemized-matching/criteria/ItemCriteria/CompanySizeCriterion
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
 * Company size tiers
 */
const COMPANY_SIZE_ORDER = [
  'startup',
  'small',
  'medium',
  'large',
  'enterprise',
] as const;

type CompanySize = typeof COMPANY_SIZE_ORDER[number];

/**
 * Map deal company size enum to tier
 */
const DEAL_SIZE_MAP: Record<string, CompanySize> = {
  'startup': 'startup',
  'smb': 'small',
  'small': 'small',
  'mid_market': 'medium',
  'medium': 'medium',
  'enterprise': 'enterprise',
  'large': 'large',
};

/**
 * Company size indicators for inference
 */
const SIZE_INDICATORS: Record<CompanySize, { employees: [number, number]; keywords: string[] }> = {
  'startup': { employees: [1, 50], keywords: ['startup', 'early stage', 'seed', 'founded 202'] },
  'small': { employees: [51, 200], keywords: ['small business', 'smb', 'growing'] },
  'medium': { employees: [201, 1000], keywords: ['mid-market', 'mid market', 'regional'] },
  'large': { employees: [1001, 5000], keywords: ['large', 'multinational', 'publicly traded'] },
  'enterprise': { employees: [5001, Infinity], keywords: ['enterprise', 'fortune', 'global', 'f500', 'fortune 500'] },
};

export class CompanySizeCriterion extends BaseCriterionCalculator {
  readonly id = 'company_size';
  readonly name = 'Company Size';
  readonly icon = '🏢';
  readonly defaultImportance: CriterionImportance = 'HIGH';
  readonly applicableMatchTypes = [
    'DEAL_TO_BUYER',
  ];

  /**
   * Extract target company size from deal
   */
  private getDealTargetSize(profile: MatchingProfile): CompanySize | null {
    const rawSize = profile.rawData?.companySize;
    if (rawSize) {
      const normalized = normalizeString(String(rawSize));
      if (DEAL_SIZE_MAP[normalized]) {
        return DEAL_SIZE_MAP[normalized];
      }
    }

    // Try to infer from target description
    const description = normalizeString(profile.rawData?.targetDescription || '');
    for (const [size, { keywords }] of Object.entries(SIZE_INDICATORS)) {
      if (keywords.some(kw => description.includes(kw))) {
        return size as CompanySize;
      }
    }

    return null;
  }

  /**
   * Infer company size from contact data
   */
  private inferContactCompanySize(profile: MatchingProfile): {
    size: CompanySize | null;
    confidence: number;
    source: string;
  } {
    // Check enrichmentData for employee count
    const enrichment = profile.rawData?.enrichmentData;
    if (enrichment) {
      const parsed = typeof enrichment === 'string' ?
        this.safeJsonParse(enrichment) : enrichment;

      if (parsed) {
        const employeeCount = parsed.employees || parsed.employee_count || parsed.companySize;
        if (typeof employeeCount === 'number') {
          for (const [size, { employees }] of Object.entries(SIZE_INDICATORS)) {
            if (employeeCount >= employees[0] && employeeCount <= employees[1]) {
              return { size: size as CompanySize, confidence: 0.9, source: 'Employee count' };
            }
          }
        }
      }
    }

    // Infer from company name
    if (profile.company) {
      const company = normalizeString(profile.company);

      // Known large companies
      const knownEnterprises = ['google', 'microsoft', 'amazon', 'apple', 'meta', 'facebook', 'oracle', 'ibm', 'salesforce', 'sap'];
      if (knownEnterprises.some(e => company.includes(e))) {
        return { size: 'enterprise', confidence: 0.95, source: 'Known enterprise' };
      }

      // Check for size indicators in company name
      for (const [size, { keywords }] of Object.entries(SIZE_INDICATORS)) {
        if (keywords.some(kw => company.includes(kw))) {
          return { size: size as CompanySize, confidence: 0.6, source: 'Company name' };
        }
      }
    }

    // Infer from job title complexity
    if (profile.jobTitle) {
      const title = normalizeString(profile.jobTitle);
      if (title.includes('global') || title.includes('regional') || title.includes('group')) {
        return { size: 'large', confidence: 0.5, source: 'Job title scope' };
      }
    }

    return { size: null, confidence: 0, source: 'Unknown' };
  }

  private safeJsonParse(str: string): any {
    try {
      return JSON.parse(str);
    } catch {
      return null;
    }
  }

  /**
   * Calculate size distance
   */
  private getSizeDistance(size1: CompanySize, size2: CompanySize): number {
    const idx1 = COMPANY_SIZE_ORDER.indexOf(size1);
    const idx2 = COMPANY_SIZE_ORDER.indexOf(size2);
    return Math.abs(idx1 - idx2);
  }

  /**
   * Get human-readable label
   */
  private getSizeLabel(size: CompanySize): string {
    const labels: Record<CompanySize, string> = {
      'startup': 'Startup (1-50)',
      'small': 'Small (51-200)',
      'medium': 'Mid-Market (201-1000)',
      'large': 'Large (1001-5000)',
      'enterprise': 'Enterprise (5000+)',
    };
    return labels[size];
  }

  async calculate(
    source: MatchingProfile,
    target: MatchingProfile,
    context: CalculationContext
  ): Promise<CriterionResult> {
    // Source is deal, target is buyer contact
    const dealTargetSize = this.getDealTargetSize(source);
    const contactSize = this.inferContactCompanySize(target);

    // Handle missing deal target size
    if (!dealTargetSize) {
      return this.buildResult(
        50,
        'PARTIAL',
        {
          summary: 'Target company size not specified',
          sourceValue: 'No size preference',
          targetValue: contactSize.size ? this.getSizeLabel(contactSize.size) : 'Size unknown',
          matchType: 'PARTIAL',
          details: ['⚠️ Deal does not specify target company size'],
        },
        context,
        { sourceValues: [], targetValues: contactSize.size ? [contactSize.size] : [], matchedCount: 0, totalCount: 0 }
      );
    }

    // Handle unknown contact company size
    if (!contactSize.size) {
      return this.buildResult(
        30,
        'PARTIAL',
        {
          summary: 'Contact company size unknown',
          sourceValue: `Target: ${this.getSizeLabel(dealTargetSize)}`,
          targetValue: 'Company size could not be determined',
          matchType: 'PARTIAL',
          details: ['⚠️ Cannot determine contact\'s company size'],
        },
        context,
        { sourceValues: [dealTargetSize], targetValues: [], matchedCount: 0, totalCount: 1 }
      );
    }

    const distance = this.getSizeDistance(dealTargetSize, contactSize.size);

    let score = 0;
    let matchType: MatchType = 'NONE';
    const details: string[] = [];
    let summary = '';

    if (distance === 0) {
      score = 100;
      matchType = 'EXACT';
      details.push(`✅ Perfect size match: ${this.getSizeLabel(dealTargetSize)}`);
      summary = `Perfect match: ${this.getSizeLabel(dealTargetSize)}`;
    } else if (distance === 1) {
      score = 70;
      matchType = 'PARTIAL';
      details.push(`🔄 Adjacent size: Deal targets ${this.getSizeLabel(dealTargetSize)}, contact at ${this.getSizeLabel(contactSize.size)}`);
      summary = `Close fit: ${contactSize.size}`;
    } else if (distance === 2) {
      score = 40;
      matchType = 'PARTIAL';
      details.push(`⚠️ Size gap: Deal targets ${this.getSizeLabel(dealTargetSize)}, contact at ${this.getSizeLabel(contactSize.size)}`);
      summary = `Size gap: ${distance} tiers apart`;
    } else {
      score = 15;
      details.push(`❌ Significant mismatch: Deal targets ${this.getSizeLabel(dealTargetSize)}, contact at ${this.getSizeLabel(contactSize.size)}`);
      summary = `Size mismatch`;
    }

    // Adjust for confidence
    if (contactSize.confidence < 0.7) {
      details.push(`⚠️ Size inference: ${contactSize.source} (${Math.round(contactSize.confidence * 100)}% confidence)`);
    }

    return this.buildResult(
      Math.round(score * Math.max(0.7, contactSize.confidence)),
      matchType,
      {
        summary,
        sourceValue: `Target: ${this.getSizeLabel(dealTargetSize)}`,
        targetValue: `${target.name}: ${this.getSizeLabel(contactSize.size)}`,
        matchType,
        details,
      },
      context,
      {
        sourceValues: [dealTargetSize],
        targetValues: [contactSize.size],
        matchedCount: distance <= 1 ? 1 : 0,
        totalCount: 1,
        additionalData: { dealTargetSize, contactSize, distance },
      }
    );
  }
}

export default CompanySizeCriterion;
