/**
 * Budget Criterion Calculator
 *
 * Calculates match score based on inferred budget/purchasing power.
 * Inferred from role seniority, company size, and available data.
 *
 * @module infrastructure/services/itemized-matching/criteria/ItemCriteria/BudgetCriterion
 */

import {
  BaseCriterionCalculator,
  MatchingProfile,
  CalculationContext,
  CriterionResult,
} from '../../interfaces/ICriterionCalculator';
import { CriterionImportance, MatchType } from '../../../../../domain/services/IItemizedMatchingService';
import { normalizeString, parseInvestmentRange, doRangesOverlap } from '../../utils/ScoreUtils';

/**
 * Budget tiers with typical ranges
 */
const BUDGET_TIERS: Record<string, { min: number; max: number; labels: string[] }> = {
  'small': { min: 0, max: 10000, labels: ['small', 'limited', 'minimal', 'basic'] },
  'medium': { min: 10000, max: 100000, labels: ['medium', 'moderate', 'standard'] },
  'large': { min: 100000, max: 500000, labels: ['large', 'significant', 'substantial'] },
  'enterprise': { min: 500000, max: 10000000, labels: ['enterprise', 'unlimited', 'major'] },
};

/**
 * Role-based budget inference
 */
const ROLE_BUDGET_MAP: Record<string, string> = {
  'ceo': 'enterprise',
  'cfo': 'enterprise',
  'cto': 'enterprise',
  'vp': 'large',
  'director': 'large',
  'head': 'medium',
  'manager': 'medium',
  'senior': 'small',
  'lead': 'medium',
};

export class BudgetCriterion extends BaseCriterionCalculator {
  readonly id = 'budget';
  readonly name = 'Budget Alignment';
  readonly icon = '💵';
  readonly defaultImportance: CriterionImportance = 'HIGH';
  readonly applicableMatchTypes = [
    'DEAL_TO_BUYER',
    'DEAL_TO_PROVIDER',
  ];

  /**
   * Extract deal price/budget expectations
   */
  private getDealPricing(profile: MatchingProfile): { tier: string; range: { min: number; max: number } | null } {
    // Check for explicit pricing in rawData
    const rawBudget = profile.rawData?.budget || profile.rawData?.pricing || profile.budget;
    if (rawBudget) {
      const parsed = parseInvestmentRange(String(rawBudget));
      if (parsed) {
        // Determine tier from range
        for (const [tier, { min, max }] of Object.entries(BUDGET_TIERS)) {
          if (parsed.min >= min && parsed.max <= max * 2) {
            return { tier, range: parsed };
          }
        }
      }
    }

    // Infer from deal type/description
    const targetDesc = normalizeString(profile.rawData?.targetDescription || '');
    const solutionType = normalizeString(profile.rawData?.solutionType || '');
    const combined = `${targetDesc} ${solutionType}`;

    for (const [tier, { labels }] of Object.entries(BUDGET_TIERS)) {
      if (labels.some(label => combined.includes(label))) {
        return { tier, range: BUDGET_TIERS[tier] };
      }
    }

    // Default based on target entity type
    const targetType = profile.rawData?.targetEntityType;
    if (targetType === 'ENTERPRISE') return { tier: 'enterprise', range: BUDGET_TIERS['enterprise'] };
    if (targetType === 'SMB') return { tier: 'medium', range: BUDGET_TIERS['medium'] };

    return { tier: 'medium', range: BUDGET_TIERS['medium'] }; // Default
  }

  /**
   * Infer buyer's budget authority
   */
  private inferBuyerBudget(profile: MatchingProfile): {
    tier: string;
    confidence: number;
    source: string;
  } {
    // Check enrichmentData for budget info
    const enrichment = profile.rawData?.enrichmentData;
    if (enrichment) {
      const parsed = typeof enrichment === 'string' ?
        this.safeJsonParse(enrichment) : enrichment;

      if (parsed?.budget || parsed?.purchasing_power) {
        const budget = parsed.budget || parsed.purchasing_power;
        for (const [tier, { labels }] of Object.entries(BUDGET_TIERS)) {
          if (labels.some(label => String(budget).toLowerCase().includes(label))) {
            return { tier, confidence: 0.9, source: 'Enrichment data' };
          }
        }
      }
    }

    // Infer from job title
    if (profile.jobTitle) {
      const title = normalizeString(profile.jobTitle);
      for (const [roleKey, tier] of Object.entries(ROLE_BUDGET_MAP)) {
        if (title.includes(roleKey)) {
          return { tier, confidence: 0.7, source: `Role: ${roleKey}` };
        }
      }
    }

    // Infer from company (known large companies)
    if (profile.company) {
      const company = normalizeString(profile.company);
      const largeCompanies = ['google', 'microsoft', 'amazon', 'apple', 'meta', 'oracle', 'ibm', 'salesforce'];
      if (largeCompanies.some(c => company.includes(c))) {
        return { tier: 'enterprise', confidence: 0.85, source: 'Enterprise company' };
      }
    }

    return { tier: 'medium', confidence: 0.3, source: 'Default assumption' };
  }

  private safeJsonParse(str: string): any {
    try {
      return JSON.parse(str);
    } catch {
      return null;
    }
  }

  /**
   * Get tier distance
   */
  private getTierDistance(tier1: string, tier2: string): number {
    const tiers = ['small', 'medium', 'large', 'enterprise'];
    const idx1 = tiers.indexOf(tier1);
    const idx2 = tiers.indexOf(tier2);
    if (idx1 === -1 || idx2 === -1) return 2;
    return Math.abs(idx1 - idx2);
  }

  /**
   * Format budget tier for display
   */
  private formatTier(tier: string): string {
    const tierInfo = BUDGET_TIERS[tier];
    if (!tierInfo) return tier;

    if (tier === 'small') return 'Small (<$10K)';
    if (tier === 'medium') return 'Medium ($10K-$100K)';
    if (tier === 'large') return 'Large ($100K-$500K)';
    if (tier === 'enterprise') return 'Enterprise ($500K+)';
    return tier;
  }

  async calculate(
    source: MatchingProfile,
    target: MatchingProfile,
    context: CalculationContext
  ): Promise<CriterionResult> {
    // Source is deal, target is buyer
    const dealPricing = this.getDealPricing(source);
    const buyerBudget = this.inferBuyerBudget(target);

    const distance = this.getTierDistance(dealPricing.tier, buyerBudget.tier);

    let score = 0;
    let matchType: MatchType = 'NONE';
    const details: string[] = [];
    let summary = '';

    // Calculate based on tier alignment
    if (distance === 0) {
      score = 100;
      matchType = 'EXACT';
      details.push(`✅ Budget aligned: ${this.formatTier(dealPricing.tier)}`);
      summary = `Budget match: ${this.formatTier(dealPricing.tier)}`;
    } else if (distance === 1) {
      // Adjacent tier - buyer has more budget is better
      const buyerIdx = ['small', 'medium', 'large', 'enterprise'].indexOf(buyerBudget.tier);
      const dealIdx = ['small', 'medium', 'large', 'enterprise'].indexOf(dealPricing.tier);

      if (buyerIdx > dealIdx) {
        // Buyer has more budget than needed - good
        score = 85;
        matchType = 'PARTIAL';
        details.push(`✅ Buyer has higher budget capacity`);
        summary = 'Buyer budget exceeds need';
      } else {
        // Deal may be at upper end of buyer's budget
        score = 60;
        matchType = 'PARTIAL';
        details.push(`⚠️ Deal may stretch buyer's budget`);
        summary = 'Possible budget stretch';
      }
    } else if (distance === 2) {
      score = 35;
      matchType = 'PARTIAL';
      details.push(`⚠️ Budget gap: Deal is ${this.formatTier(dealPricing.tier)}, buyer at ${this.formatTier(buyerBudget.tier)}`);
      summary = 'Budget tier gap';
    } else {
      score = 10;
      details.push(`❌ Significant budget mismatch`);
      summary = 'Budget mismatch';
    }

    // Adjust for confidence
    const adjustedScore = Math.round(score * Math.max(0.6, buyerBudget.confidence));

    if (buyerBudget.confidence < 0.6) {
      details.push(`⚠️ Budget inferred from: ${buyerBudget.source}`);
    }

    return this.buildResult(
      adjustedScore,
      matchType,
      {
        summary,
        sourceValue: `Deal: ${this.formatTier(dealPricing.tier)}`,
        targetValue: `${target.name}: ${this.formatTier(buyerBudget.tier)} (inferred)`,
        matchType,
        details,
      },
      context,
      {
        sourceValues: [dealPricing.tier],
        targetValues: [buyerBudget.tier],
        matchedCount: distance <= 1 ? 1 : 0,
        totalCount: 1,
        additionalData: { dealPricing, buyerBudget, distance },
      }
    );
  }
}

export default BudgetCriterion;
