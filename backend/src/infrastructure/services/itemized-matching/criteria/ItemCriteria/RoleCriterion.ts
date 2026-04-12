/**
 * Role Criterion Calculator
 *
 * CRITICAL: Determines if contact is a decision maker relevant to the deal.
 * Analyzes job title to assess purchasing authority.
 *
 * @module infrastructure/services/itemized-matching/criteria/ItemCriteria/RoleCriterion
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
 * Decision maker indicators by category
 */
const DECISION_MAKER_ROLES: Record<string, { patterns: string[]; score: number }> = {
  'C-Level': {
    patterns: ['ceo', 'cto', 'cfo', 'coo', 'cmo', 'cio', 'cpo', 'chief', 'c-level'],
    score: 100,
  },
  'VP/Executive': {
    patterns: ['vp', 'vice president', 'svp', 'evp', 'avp', 'executive'],
    score: 95,
  },
  'Director': {
    patterns: ['director', 'head of', 'head', 'global head'],
    score: 90,
  },
  'Founder/Owner': {
    patterns: ['founder', 'co-founder', 'owner', 'partner', 'principal', 'managing partner'],
    score: 100,
  },
  'Manager': {
    patterns: ['manager', 'lead', 'team lead', 'senior manager', 'general manager', 'gm'],
    score: 75,
  },
  'Senior': {
    patterns: ['senior', 'sr', 'principal', 'staff'],
    score: 60,
  },
};

/**
 * Function-specific roles that indicate relevance
 */
const FUNCTION_ROLES: Record<string, string[]> = {
  'technology': ['cto', 'vp engineering', 'engineering', 'developer', 'architect', 'it', 'technical'],
  'sales': ['sales', 'business development', 'bd', 'commercial', 'revenue'],
  'marketing': ['marketing', 'cmo', 'growth', 'brand', 'communications'],
  'finance': ['finance', 'cfo', 'accounting', 'treasury', 'controller'],
  'operations': ['operations', 'coo', 'supply chain', 'logistics', 'procurement'],
  'hr': ['hr', 'human resources', 'people', 'talent', 'recruiting'],
  'product': ['product', 'cpo', 'pm', 'product manager'],
};

export class RoleCriterion extends BaseCriterionCalculator {
  readonly id = 'role';
  readonly name = 'Decision Maker';
  readonly icon = '👔';
  readonly defaultImportance: CriterionImportance = 'CRITICAL';
  readonly applicableMatchTypes = [
    'DEAL_TO_BUYER',
  ];

  /**
   * Analyze role to determine decision-making authority
   */
  private analyzeRole(jobTitle: string | undefined): {
    isDecisionMaker: boolean;
    level: string;
    score: number;
    functions: string[];
  } {
    if (!jobTitle) {
      return { isDecisionMaker: false, level: 'Unknown', score: 0, functions: [] };
    }

    const normalized = normalizeString(jobTitle);
    let highestScore = 0;
    let matchedLevel = 'Individual Contributor';
    const functions: string[] = [];

    // Check decision maker roles
    for (const [level, { patterns, score }] of Object.entries(DECISION_MAKER_ROLES)) {
      for (const pattern of patterns) {
        if (normalized.includes(pattern)) {
          if (score > highestScore) {
            highestScore = score;
            matchedLevel = level;
          }
        }
      }
    }

    // Check function roles
    for (const [func, patterns] of Object.entries(FUNCTION_ROLES)) {
      for (const pattern of patterns) {
        if (normalized.includes(pattern)) {
          functions.push(func);
          break;
        }
      }
    }

    return {
      isDecisionMaker: highestScore >= 75,
      level: matchedLevel,
      score: highestScore,
      functions: [...new Set(functions)],
    };
  }

  /**
   * Get deal's target function from domain/solutionType
   */
  private getDealTargetFunction(profile: MatchingProfile): string[] {
    const targets: string[] = [];
    const domain = normalizeString(profile.rawData?.domain || '');
    const solutionType = normalizeString(profile.rawData?.solutionType || '');
    const combined = `${domain} ${solutionType}`;

    for (const [func, patterns] of Object.entries(FUNCTION_ROLES)) {
      for (const pattern of patterns) {
        if (combined.includes(pattern)) {
          targets.push(func);
          break;
        }
      }
    }

    return [...new Set(targets)];
  }

  async calculate(
    source: MatchingProfile,
    target: MatchingProfile,
    context: CalculationContext
  ): Promise<CriterionResult> {
    // Source is deal, target is buyer contact
    const roleAnalysis = this.analyzeRole(target.jobTitle);
    const dealFunctions = this.getDealTargetFunction(source);

    // Handle missing job title
    if (!target.jobTitle) {
      return this.buildResult(
        20,
        'NONE',
        {
          summary: 'Role unknown',
          sourceValue: source.rawData?.domain || 'Deal',
          targetValue: 'Job title not specified',
          matchType: 'NONE',
          details: ['⚠️ Cannot assess decision-making authority without job title'],
        },
        context,
        { sourceValues: dealFunctions, targetValues: [], matchedCount: 0, totalCount: 1 }
      );
    }

    let score = roleAnalysis.score;
    let matchType: MatchType = 'NONE';
    const details: string[] = [];
    let summary = '';

    // Check function alignment
    const functionMatches = roleAnalysis.functions.filter(f => dealFunctions.includes(f));
    const hasFunctionMatch = functionMatches.length > 0 || dealFunctions.length === 0;

    if (roleAnalysis.isDecisionMaker) {
      if (hasFunctionMatch) {
        score = Math.min(100, score + 10);
        matchType = 'EXACT';
        details.push(`✅ Decision maker: ${roleAnalysis.level}`);
        if (functionMatches.length > 0) {
          details.push(`✅ Relevant function: ${functionMatches.join(', ')}`);
        }
        summary = `${roleAnalysis.level} - Key decision maker`;
      } else {
        score = Math.max(50, score - 20);
        matchType = 'PARTIAL';
        details.push(`✅ Decision maker: ${roleAnalysis.level}`);
        details.push(`⚠️ Different function: ${roleAnalysis.functions.join(', ') || 'General'}`);
        summary = `${roleAnalysis.level} - Different department`;
      }
    } else if (score >= 50) {
      matchType = 'PARTIAL';
      details.push(`🔄 ${roleAnalysis.level} level`);
      if (hasFunctionMatch) {
        details.push(`✅ Relevant function: ${functionMatches.join(', ') || roleAnalysis.functions.join(', ')}`);
        score = Math.min(80, score + 10);
      }
      summary = `${roleAnalysis.level} - May influence decisions`;
    } else {
      score = Math.max(20, score);
      details.push(`⚠️ ${roleAnalysis.level} - Limited authority`);
      summary = 'Not a key decision maker';
    }

    return this.buildResult(
      score,
      matchType,
      {
        summary,
        sourceValue: dealFunctions.length > 0 ? `Deal targets: ${dealFunctions.join(', ')}` : 'General business',
        targetValue: `${target.name}: ${target.jobTitle}`,
        matchType,
        details,
      },
      context,
      {
        sourceValues: dealFunctions,
        targetValues: roleAnalysis.functions,
        matchedCount: functionMatches.length,
        totalCount: Math.max(dealFunctions.length, 1),
        additionalData: { roleAnalysis, dealFunctions, functionMatches },
      }
    );
  }
}

export default RoleCriterion;
