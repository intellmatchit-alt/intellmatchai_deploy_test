/**
 * Stage Fit Criterion Calculator
 *
 * CRITICAL: Calculates match score based on project stage vs investor stage preference.
 * Investors typically focus on specific stages (seed, series A, etc.)
 *
 * @module infrastructure/services/itemized-matching/criteria/ItemCriteria/StageFitCriterion
 */

import {
  BaseCriterionCalculator,
  MatchingProfile,
  CalculationContext,
  CriterionResult,
} from '../../interfaces/ICriterionCalculator';
import { CriterionImportance, MatchType } from '../../../../../domain/services/IItemizedMatchingService';
import { INVESTMENT_STAGES } from '../../constants/CriteriaDefinitions';
import { normalizeString } from '../../utils/ScoreUtils';

/**
 * Stage order for distance calculation
 */
const STAGE_ORDER = [
  'idea',
  'pre-seed',
  'seed',
  'series a',
  'series b',
  'series c',
  'series d+',
  'growth',
  'late stage',
  'ipo',
] as const;

/**
 * Map ProjectStage enum to investment stage
 */
const PROJECT_STAGE_MAP: Record<string, string> = {
  'idea': 'idea',
  'mvp': 'seed',
  'early': 'seed',
  'growth': 'growth',
  'scale': 'series a',
};

export class StageFitCriterion extends BaseCriterionCalculator {
  readonly id = 'stage_fit';
  readonly name = 'Stage Fit';
  readonly icon = '📈';
  readonly defaultImportance: CriterionImportance = 'CRITICAL';
  readonly applicableMatchTypes = [
    'PROJECT_TO_INVESTOR',
    'PROJECT_TO_DYNAMIC',
  ];

  /**
   * Normalize project stage to investment stage
   */
  private normalizeProjectStage(stage: string | undefined): string | null {
    if (!stage) return null;

    const normalized = normalizeString(stage);

    // Check direct mapping
    if (PROJECT_STAGE_MAP[normalized]) {
      return PROJECT_STAGE_MAP[normalized];
    }

    // Check if it's already an investment stage
    if (STAGE_ORDER.includes(normalized as any)) {
      return normalized;
    }

    // Try partial matching
    for (const investStage of STAGE_ORDER) {
      if (normalized.includes(investStage) || investStage.includes(normalized)) {
        return investStage;
      }
    }

    return null;
  }

  /**
   * Extract investor stage preferences from enrichmentData
   */
  private extractInvestorStages(profile: MatchingProfile): string[] {
    const stages: string[] = [];

    // Check enrichmentData
    const enrichment = profile.rawData?.enrichmentData;
    if (enrichment) {
      const parsed = typeof enrichment === 'string' ?
        this.safeJsonParse(enrichment) : enrichment;

      if (parsed) {
        const stagePaths = [
          parsed.investmentStages,
          parsed.stages,
          parsed.stage_preference,
          parsed.preferred_stages,
        ];

        for (const stageData of stagePaths) {
          if (Array.isArray(stageData)) {
            stages.push(...stageData.map((s: any) => normalizeString(typeof s === 'string' ? s : s.name || '')));
          } else if (typeof stageData === 'string') {
            stages.push(normalizeString(stageData));
          }
        }
      }
    }

    // Parse from bio
    if (profile.bio) {
      const bioLower = profile.bio.toLowerCase();
      for (const stage of STAGE_ORDER) {
        if (bioLower.includes(stage)) {
          stages.push(stage);
        }
      }
      // Common patterns
      if (bioLower.includes('early stage') || bioLower.includes('early-stage')) {
        stages.push('seed', 'pre-seed');
      }
      if (bioLower.includes('growth stage') || bioLower.includes('growth-stage')) {
        stages.push('growth', 'series b', 'series c');
      }
    }

    return [...new Set(stages)];
  }

  private safeJsonParse(str: string): any {
    try {
      return JSON.parse(str);
    } catch {
      return null;
    }
  }

  /**
   * Calculate stage distance (0 = same, higher = further apart)
   */
  private getStageDistance(stage1: string, stage2: string): number {
    const idx1 = STAGE_ORDER.indexOf(stage1 as any);
    const idx2 = STAGE_ORDER.indexOf(stage2 as any);

    if (idx1 === -1 || idx2 === -1) return -1;
    return Math.abs(idx1 - idx2);
  }

  async calculate(
    source: MatchingProfile,
    target: MatchingProfile,
    context: CalculationContext
  ): Promise<CriterionResult> {
    // Source is project, target is investor
    const projectStage = this.normalizeProjectStage(source.stage);
    const investorStages = this.extractInvestorStages(target);

    // Handle missing project stage
    if (!projectStage) {
      return this.buildResult(
        0,
        'NONE',
        {
          summary: 'Project stage not specified',
          sourceValue: 'Stage not defined',
          targetValue: investorStages.length > 0 ? investorStages.join(', ') : 'No preference',
          matchType: 'NONE',
          details: ['Cannot evaluate stage fit without project stage'],
        },
        context,
        { sourceValues: [], targetValues: investorStages, matchedCount: 0, totalCount: 0 }
      );
    }

    // If investor has no stated preference, give partial credit
    if (investorStages.length === 0) {
      return this.buildResult(
        50,
        'PARTIAL',
        {
          summary: 'Investor stage preference unknown',
          sourceValue: `Project: ${projectStage}`,
          targetValue: 'Stage preference not specified',
          matchType: 'PARTIAL',
          details: ['⚠️ Cannot determine investor stage preference', `Project is at ${projectStage} stage`],
        },
        context,
        { sourceValues: [projectStage], targetValues: [], matchedCount: 0, totalCount: 1 }
      );
    }

    // Check for exact match
    const exactMatch = investorStages.includes(projectStage);

    // Find closest stage if no exact match
    let closestDistance = Infinity;
    let closestStage = '';
    for (const investorStage of investorStages) {
      const distance = this.getStageDistance(projectStage, investorStage);
      if (distance >= 0 && distance < closestDistance) {
        closestDistance = distance;
        closestStage = investorStage;
      }
    }

    let score = 0;
    let matchType: MatchType = 'NONE';
    const details: string[] = [];
    let summary = '';

    if (exactMatch) {
      score = 100;
      matchType = 'EXACT';
      details.push(`✅ Perfect stage match: ${projectStage}`);
      summary = `Perfect fit: ${projectStage}`;
    } else if (closestDistance === 1) {
      score = 70;
      matchType = 'PARTIAL';
      details.push(`🔄 Adjacent stage: Project is ${projectStage}, investor prefers ${closestStage}`);
      summary = `Close fit: ${projectStage} vs ${closestStage}`;
    } else if (closestDistance === 2) {
      score = 40;
      matchType = 'PARTIAL';
      details.push(`⚠️ Stage gap: Project is ${projectStage}, investor prefers ${closestStage}`);
      summary = `Stage gap: ${projectStage} vs ${closestStage}`;
    } else if (closestDistance > 2) {
      score = 15;
      matchType = 'NONE';
      details.push(`❌ Significant stage mismatch: Project is ${projectStage}, investor focuses on ${investorStages.join(', ')}`);
      summary = `Stage mismatch`;
    }

    return this.buildResult(
      score,
      matchType,
      {
        summary,
        sourceValue: `Project: ${projectStage}`,
        targetValue: `${target.name}: ${investorStages.join(', ')}`,
        matchType,
        details,
      },
      context,
      {
        sourceValues: [projectStage],
        targetValues: investorStages,
        matchedCount: exactMatch ? 1 : 0,
        totalCount: 1,
        additionalData: { projectStage, investorStages, closestDistance, closestStage },
      }
    );
  }
}

export default StageFitCriterion;
