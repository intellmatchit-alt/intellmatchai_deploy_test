/**
 * Opportunity Skills Criterion Calculator
 *
 * Calculates match score based on required skills vs candidate skills.
 *
 * @module infrastructure/services/itemized-matching/criteria/OpportunityCriteria/OpportunitySkillsCriterion
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

export class OpportunitySkillsCriterion extends BaseCriterionCalculator {
  readonly id = 'opportunity_skills';
  readonly name = 'Skills Match';
  readonly icon = '🛠️';
  readonly defaultImportance: CriterionImportance = 'CRITICAL';
  readonly applicableMatchTypes = [
    'OPPORTUNITY_TO_CANDIDATE',
    'CANDIDATE_TO_OPPORTUNITY',
  ];

  /**
   * Find skill matches including synonyms
   */
  private findSkillMatches(required: string[], available: string[]): {
    exact: string[];
    synonym: string[];
    missing: string[];
  } {
    const exact: string[] = [];
    const synonym: string[] = [];
    const missing: string[] = [];

    for (const req of required) {
      const normalizedReq = normalizeString(req);
      let found = false;

      // Check exact match
      if (available.some(a => normalizeString(a) === normalizedReq)) {
        exact.push(req);
        found = true;
        continue;
      }

      // Check synonym match
      for (const [canonical, synonyms] of Object.entries(SKILL_SYNONYMS)) {
        const allTerms = [normalizeString(canonical), ...synonyms.map(s => normalizeString(s))];
        if (allTerms.includes(normalizedReq)) {
          if (available.some(a => allTerms.includes(normalizeString(a)))) {
            synonym.push(req);
            found = true;
            break;
          }
        }
      }

      if (!found) {
        missing.push(req);
      }
    }

    return { exact, synonym, missing };
  }

  async calculate(
    source: MatchingProfile,
    target: MatchingProfile,
    context: CalculationContext
  ): Promise<CriterionResult> {
    // Get required skills from opportunity
    const requiredSkills = source.skills || [];
    // Get candidate skills
    const candidateSkills = target.skills || [];

    // Handle no requirements
    if (requiredSkills.length === 0) {
      return this.buildResult(
        60,
        'PARTIAL',
        {
          summary: 'No specific skills required',
          sourceValue: 'Open to various skills',
          targetValue: candidateSkills.length > 0 ? candidateSkills.slice(0, 5).join(', ') : 'Unknown',
          matchType: 'PARTIAL',
          details: ['ℹ️ Opportunity open to various skill sets'],
        },
        context,
        { sourceValues: [], targetValues: candidateSkills, matchedCount: 0, totalCount: 0 }
      );
    }

    // Handle no candidate skills
    if (candidateSkills.length === 0) {
      return this.buildResult(
        20,
        'NONE',
        {
          summary: 'Candidate skills unknown',
          sourceValue: `Required: ${requiredSkills.slice(0, 5).join(', ')}`,
          targetValue: 'Skills not specified',
          matchType: 'NONE',
          details: ['⚠️ Cannot determine candidate skills'],
        },
        context,
        { sourceValues: requiredSkills, targetValues: [], matchedCount: 0, totalCount: requiredSkills.length }
      );
    }

    // Find matches
    const matches = this.findSkillMatches(requiredSkills, candidateSkills);
    const totalMatches = matches.exact.length + matches.synonym.length;
    const matchRatio = totalMatches / requiredSkills.length;

    let score = Math.round(matchRatio * 100);
    let matchType: MatchType = 'NONE';
    const details: string[] = [];

    // Add exact matches
    for (const skill of matches.exact.slice(0, 3)) {
      details.push(`✅ ${skill}: Exact match`);
    }
    if (matches.exact.length > 3) {
      details.push(`✅ +${matches.exact.length - 3} more exact matches`);
    }

    // Add synonym matches
    for (const skill of matches.synonym.slice(0, 2)) {
      details.push(`✅ ${skill}: Similar skill`);
    }
    if (matches.synonym.length > 2) {
      details.push(`✅ +${matches.synonym.length - 2} more similar skills`);
    }

    // Add missing (up to 3)
    for (const skill of matches.missing.slice(0, 3)) {
      details.push(`❌ ${skill}: Missing`);
    }
    if (matches.missing.length > 3) {
      details.push(`❌ +${matches.missing.length - 3} more missing`);
    }

    if (matchRatio >= 0.8) {
      matchType = 'EXACT';
    } else if (matchRatio >= 0.5) {
      matchType = 'PARTIAL';
    } else if (matchRatio > 0) {
      matchType = 'PARTIAL';
    }

    const summary = totalMatches > 0
      ? `${totalMatches}/${requiredSkills.length} skills match`
      : 'No matching skills';

    return this.buildResult(
      score,
      matchType,
      {
        summary,
        sourceValue: `Required: ${requiredSkills.slice(0, 5).join(', ')}`,
        targetValue: `${target.name}: ${candidateSkills.slice(0, 5).join(', ')}`,
        matchType,
        details,
      },
      context,
      {
        sourceValues: requiredSkills,
        targetValues: candidateSkills,
        matchedCount: totalMatches,
        totalCount: requiredSkills.length,
        additionalData: { matches },
      }
    );
  }
}

export default OpportunitySkillsCriterion;
