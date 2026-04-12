/**
 * Check Size Criterion Calculator
 *
 * CRITICAL: Calculates match score based on project investment ask vs investor check size.
 * Full overlap = 100% | Partial overlap = 70% | Close range = 40%
 *
 * @module infrastructure/services/itemized-matching/criteria/ItemCriteria/CheckSizeCriterion
 */

import {
  BaseCriterionCalculator,
  MatchingProfile,
  CalculationContext,
  CriterionResult,
} from '../../interfaces/ICriterionCalculator';
import { CriterionImportance, MatchType } from '../../../../../domain/services/IItemizedMatchingService';
import { parseInvestmentRange, doRangesOverlap } from '../../utils/ScoreUtils';

export class CheckSizeCriterion extends BaseCriterionCalculator {
  readonly id = 'check_size';
  readonly name = 'Check Size';
  readonly icon = '💰';
  readonly defaultImportance: CriterionImportance = 'CRITICAL';
  readonly applicableMatchTypes = [
    'PROJECT_TO_INVESTOR',
    'PROJECT_TO_DYNAMIC',
  ];

  /**
   * Extract investor check size from enrichmentData
   */
  private extractInvestorCheckSize(profile: MatchingProfile): { min: number; max: number } | null {
    // Check direct checkSize field
    if (profile.checkSize) {
      const parsed = parseInvestmentRange(profile.checkSize);
      if (parsed) return parsed;
    }

    // Check enrichmentData
    const enrichment = profile.rawData?.enrichmentData;
    if (enrichment) {
      const parsed = typeof enrichment === 'string' ?
        this.safeJsonParse(enrichment) : enrichment;

      if (parsed) {
        const sizePaths = [
          parsed.checkSize,
          parsed.check_size,
          parsed.investmentSize,
          parsed.investment_range,
          parsed.typical_investment,
        ];

        for (const sizeData of sizePaths) {
          if (sizeData) {
            const range = parseInvestmentRange(String(sizeData));
            if (range) return range;
          }
        }

        // Handle min/max separately
        if (parsed.minCheckSize && parsed.maxCheckSize) {
          return {
            min: this.parseAmount(parsed.minCheckSize),
            max: this.parseAmount(parsed.maxCheckSize),
          };
        }
      }
    }

    // Try to infer from bio
    if (profile.bio) {
      const bioPatterns = [
        /\$(\d+(?:\.\d+)?)\s*([km])?(?:\s*[-–to]+\s*\$?(\d+(?:\.\d+)?)\s*([km])?)?\s*(?:check|investment|ticket)/i,
        /invest(?:s|ing)?\s*\$(\d+(?:\.\d+)?)\s*([km])?/i,
      ];

      for (const pattern of bioPatterns) {
        const match = profile.bio.match(pattern);
        if (match) {
          let min = parseFloat(match[1]);
          const minSuffix = match[2]?.toLowerCase();
          if (minSuffix === 'k') min *= 1000;
          else if (minSuffix === 'm') min *= 1000000;

          let max = match[3] ? parseFloat(match[3]) : min * 2;
          const maxSuffix = match[4]?.toLowerCase();
          if (maxSuffix === 'k') max *= 1000;
          else if (maxSuffix === 'm') max *= 1000000;

          return { min, max };
        }
      }
    }

    return null;
  }

  private safeJsonParse(str: string): any {
    try {
      return JSON.parse(str);
    } catch {
      return null;
    }
  }

  private parseAmount(value: any): number {
    if (typeof value === 'number') return value;
    const str = String(value).toLowerCase().replace(/[$,]/g, '');
    let num = parseFloat(str);
    if (str.includes('k')) num *= 1000;
    else if (str.includes('m')) num *= 1000000;
    return num || 0;
  }

  /**
   * Format currency for display
   */
  private formatCurrency(amount: number): string {
    if (amount >= 1000000) {
      return `$${(amount / 1000000).toFixed(1)}M`;
    }
    if (amount >= 1000) {
      return `$${(amount / 1000).toFixed(0)}K`;
    }
    return `$${amount}`;
  }

  /**
   * Calculate overlap percentage between ranges
   */
  private calculateRangeOverlap(range1: { min: number; max: number }, range2: { min: number; max: number }): number {
    const overlapMin = Math.max(range1.min, range2.min);
    const overlapMax = Math.min(range1.max, range2.max);

    if (overlapMin > overlapMax) return 0;

    const overlapSize = overlapMax - overlapMin;
    const smallerRange = Math.min(range1.max - range1.min, range2.max - range2.min);

    if (smallerRange === 0) return overlapMin === overlapMax ? 100 : 0;

    return Math.min(100, (overlapSize / smallerRange) * 100);
  }

  async calculate(
    source: MatchingProfile,
    target: MatchingProfile,
    context: CalculationContext
  ): Promise<CriterionResult> {
    // Source is project, target is investor
    const projectRange = source.investmentRange ? parseInvestmentRange(source.investmentRange) : null;
    const investorRange = this.extractInvestorCheckSize(target);

    // Handle missing project investment range
    if (!projectRange) {
      return this.buildResult(
        0,
        'NONE',
        {
          summary: 'Investment ask not specified',
          sourceValue: 'Investment range not defined',
          targetValue: investorRange ? `${this.formatCurrency(investorRange.min)} - ${this.formatCurrency(investorRange.max)}` : 'Check size unknown',
          matchType: 'NONE',
          details: ['Cannot evaluate check size fit without project investment range'],
        },
        context,
        { sourceValues: [], targetValues: [], matchedCount: 0, totalCount: 0 }
      );
    }

    const projectRangeStr = `${this.formatCurrency(projectRange.min)} - ${this.formatCurrency(projectRange.max)}`;

    // If investor check size is unknown, give partial credit
    if (!investorRange) {
      return this.buildResult(
        40,
        'PARTIAL',
        {
          summary: 'Investor check size unknown',
          sourceValue: `Project seeking: ${projectRangeStr}`,
          targetValue: 'Check size not specified',
          matchType: 'PARTIAL',
          details: ['⚠️ Cannot determine investor typical check size', `Project is seeking ${projectRangeStr}`],
        },
        context,
        { sourceValues: [source.investmentRange || ''], targetValues: [], matchedCount: 0, totalCount: 1 }
      );
    }

    const investorRangeStr = `${this.formatCurrency(investorRange.min)} - ${this.formatCurrency(investorRange.max)}`;

    // Calculate overlap
    const hasOverlap = doRangesOverlap(projectRange, investorRange);
    const overlapPct = this.calculateRangeOverlap(projectRange, investorRange);

    let score = 0;
    let matchType: MatchType = 'NONE';
    const details: string[] = [];
    let summary = '';

    if (overlapPct >= 80) {
      score = 100;
      matchType = 'EXACT';
      details.push(`✅ Excellent fit: Project ask (${projectRangeStr}) aligns well with check size (${investorRangeStr})`);
      summary = `Perfect check size fit`;
    } else if (overlapPct >= 50) {
      score = 80;
      matchType = 'PARTIAL';
      details.push(`✅ Good fit: Significant overlap between ask and check size`);
      summary = `Good check size fit`;
    } else if (hasOverlap) {
      score = 60;
      matchType = 'PARTIAL';
      details.push(`🔄 Partial overlap: Some alignment between ranges`);
      summary = `Partial check size overlap`;
    } else {
      // No overlap - check how close they are
      const gap = projectRange.min > investorRange.max
        ? projectRange.min - investorRange.max
        : investorRange.min - projectRange.max;

      const avgProjectSize = (projectRange.min + projectRange.max) / 2;
      const gapPercentage = (gap / avgProjectSize) * 100;

      if (gapPercentage < 50) {
        score = 35;
        matchType = 'PARTIAL';
        details.push(`⚠️ Close but no overlap: Gap of ${this.formatCurrency(gap)}`);
        summary = `Check size gap: ${this.formatCurrency(gap)}`;
      } else {
        score = 10;
        matchType = 'NONE';
        details.push(`❌ Significant mismatch: Project asks ${projectRangeStr}, investor does ${investorRangeStr}`);
        summary = `Check size mismatch`;
      }
    }

    return this.buildResult(
      score,
      matchType,
      {
        summary,
        sourceValue: `Project: ${projectRangeStr}`,
        targetValue: `${target.name}: ${investorRangeStr}`,
        matchType,
        details,
      },
      context,
      {
        sourceValues: [source.investmentRange || ''],
        targetValues: [investorRangeStr],
        matchedCount: hasOverlap ? 1 : 0,
        totalCount: 1,
        additionalData: { projectRange, investorRange, overlapPct, hasOverlap },
      }
    );
  }
}

export default CheckSizeCriterion;
