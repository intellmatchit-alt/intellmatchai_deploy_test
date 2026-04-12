/**
 * Role Fit Criterion Calculator
 *
 * Calculates match score based on role/area alignment between
 * opportunity requirements and candidate experience.
 *
 * @module infrastructure/services/itemized-matching/criteria/OpportunityCriteria/RoleFitCriterion
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
 * Role category mappings for fuzzy matching
 */
const ROLE_CATEGORIES: Record<string, string[]> = {
  engineering: ['engineer', 'developer', 'programmer', 'software', 'tech lead', 'architect', 'devops', 'sre', 'frontend', 'backend', 'fullstack', 'mobile', 'ios', 'android'],
  product: ['product manager', 'product owner', 'pm', 'product lead', 'product director', 'product'],
  design: ['designer', 'ux', 'ui', 'product designer', 'creative', 'graphic', 'visual'],
  data: ['data scientist', 'data analyst', 'data engineer', 'ml engineer', 'ai', 'machine learning', 'analytics', 'bi'],
  marketing: ['marketing', 'growth', 'brand', 'content', 'seo', 'digital marketing', 'demand gen', 'social media'],
  sales: ['sales', 'account executive', 'ae', 'sdr', 'bdr', 'business development', 'revenue', 'account manager'],
  operations: ['operations', 'ops', 'chief of staff', 'project manager', 'program manager', 'pmo'],
  finance: ['finance', 'accounting', 'cfo', 'controller', 'fp&a', 'financial analyst', 'treasury'],
  hr: ['hr', 'human resources', 'people ops', 'talent', 'recruiting', 'recruiter', 'people'],
  legal: ['legal', 'lawyer', 'attorney', 'counsel', 'compliance', 'regulatory'],
  executive: ['ceo', 'cto', 'cfo', 'coo', 'vp', 'director', 'head of', 'chief', 'president'],
};

export class RoleFitCriterion extends BaseCriterionCalculator {
  readonly id = 'role_fit';
  readonly name = 'Role Fit';
  readonly icon = '🎯';
  readonly defaultImportance: CriterionImportance = 'CRITICAL';
  readonly applicableMatchTypes = [
    'OPPORTUNITY_TO_CANDIDATE',
    'CANDIDATE_TO_OPPORTUNITY',
  ];

  /**
   * Get role category for a role string
   */
  private getRoleCategory(role: string): string | null {
    const normalizedRole = normalizeString(role);
    for (const [category, keywords] of Object.entries(ROLE_CATEGORIES)) {
      if (keywords.some(k => normalizedRole.includes(k))) {
        return category;
      }
    }
    return null;
  }

  async calculate(
    source: MatchingProfile,
    target: MatchingProfile,
    context: CalculationContext
  ): Promise<CriterionResult> {
    // Source is opportunity, target is candidate (or vice versa)
    const opportunityRole = source.rawData?.roleArea || source.rawData?.title || '';
    const candidateRole = target.jobTitle || target.rawData?.roleArea || '';

    // Handle missing data
    if (!opportunityRole) {
      return this.buildResult(
        50,
        'PARTIAL',
        {
          summary: 'Role not specified',
          sourceValue: 'Any role',
          targetValue: candidateRole || 'Unknown',
          matchType: 'PARTIAL',
          details: ['ℹ️ Opportunity open to various roles'],
        },
        context,
        { sourceValues: [], targetValues: [candidateRole], matchedCount: 0, totalCount: 0 }
      );
    }

    if (!candidateRole) {
      return this.buildResult(
        30,
        'PARTIAL',
        {
          summary: 'Candidate role unknown',
          sourceValue: opportunityRole,
          targetValue: 'Not specified',
          matchType: 'PARTIAL',
          details: ['⚠️ Cannot determine candidate role'],
        },
        context,
        { sourceValues: [opportunityRole], targetValues: [], matchedCount: 0, totalCount: 1 }
      );
    }

    const normalizedOpportunity = normalizeString(opportunityRole);
    const normalizedCandidate = normalizeString(candidateRole);

    let score = 0;
    let matchType: MatchType = 'NONE';
    const details: string[] = [];

    // Check for exact/partial match
    if (normalizedCandidate.includes(normalizedOpportunity) ||
        normalizedOpportunity.includes(normalizedCandidate)) {
      score = 100;
      matchType = 'EXACT';
      details.push(`✅ Direct role match: "${candidateRole}" ↔ "${opportunityRole}"`);
    } else {
      // Check category match
      const opportunityCategory = this.getRoleCategory(opportunityRole);
      const candidateCategory = this.getRoleCategory(candidateRole);

      if (opportunityCategory && candidateCategory && opportunityCategory === candidateCategory) {
        score = 80;
        matchType = 'PARTIAL';
        details.push(`✅ Same role category: ${opportunityCategory}`);
        details.push(`📋 Looking for: ${opportunityRole}`);
        details.push(`👤 Candidate: ${candidateRole}`);
      } else if (opportunityCategory || candidateCategory) {
        score = 30;
        matchType = 'PARTIAL';
        details.push(`⚠️ Different role areas`);
        if (opportunityCategory) details.push(`📋 Opportunity: ${opportunityCategory}`);
        if (candidateCategory) details.push(`👤 Candidate: ${candidateCategory}`);
      } else {
        score = 20;
        matchType = 'NONE';
        details.push(`❌ No clear role alignment`);
      }
    }

    const summary = score >= 80 ? `Strong role fit` : score >= 50 ? `Partial role fit` : `Role mismatch`;

    return this.buildResult(
      score,
      matchType,
      {
        summary,
        sourceValue: `Looking for: ${opportunityRole}`,
        targetValue: `${target.name}: ${candidateRole}`,
        matchType,
        details,
      },
      context,
      {
        sourceValues: [opportunityRole],
        targetValues: [candidateRole],
        matchedCount: score >= 80 ? 1 : 0,
        totalCount: 1,
      }
    );
  }
}

export default RoleFitCriterion;
