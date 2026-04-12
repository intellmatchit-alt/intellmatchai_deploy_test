/**
 * Project Skills Fit Criterion
 *
 * Evaluates how well a contact's skills match a project's needed skills,
 * weighted by importance level (REQUIRED > PREFERRED > NICE_TO_HAVE).
 *
 * @module infrastructure/services/itemized-matching/criteria/ItemCriteria/ProjectSkillsFitCriterion
 */

import {
  BaseCriterionCalculator,
  MatchingProfile,
  CalculationContext,
  CriterionResult,
} from '../../interfaces/ICriterionCalculator';
import { CriterionImportance, MatchType } from '../../../../../domain/services/IItemizedMatchingService';
import { SKILL_SYNONYMS } from '../../constants/CriteriaDefinitions';

/**
 * Importance weights for skill matching
 */
const IMPORTANCE_WEIGHTS: Record<string, number> = {
  required: 3,
  preferred: 2,
  niceToHave: 1,
};

/**
 * Project Skills Fit Criterion Calculator
 *
 * Scores contacts based on how well their skills match project needs,
 * respecting the importance level of each skill.
 */
export class ProjectSkillsFitCriterion extends BaseCriterionCalculator {
  readonly id = 'project_skills_fit';
  readonly name = 'Skills Fit';
  readonly icon = '🛠️';
  readonly defaultImportance: CriterionImportance = 'CRITICAL';
  readonly applicableMatchTypes = [
    'PROJECT_TO_DYNAMIC',
    'PROJECT_TO_TALENT',
  ];

  async calculate(
    source: MatchingProfile,
    target: MatchingProfile,
    context: CalculationContext
  ): Promise<CriterionResult> {
    // Extract skills by importance from the project's rawData
    const skillsByImportance = source.rawData?.skillsByImportance || {
      required: [],
      preferred: [],
      niceToHave: [],
    };

    const requiredSkills: string[] = skillsByImportance.required || [];
    const preferredSkills: string[] = skillsByImportance.preferred || [];
    const niceToHaveSkills: string[] = skillsByImportance.niceToHave || [];

    // Also use requiredSkills from the profile if no importance breakdown
    const allProjectSkills = [
      ...requiredSkills,
      ...preferredSkills,
      ...niceToHaveSkills,
    ];

    // Fallback: if no skills by importance, use requiredSkills from profile
    if (allProjectSkills.length === 0 && source.requiredSkills?.length) {
      requiredSkills.push(...source.requiredSkills);
    }

    const totalSkills = [...requiredSkills, ...preferredSkills, ...niceToHaveSkills];

    // Get contact's skills
    const contactSkills = target.skills || [];

    if (totalSkills.length === 0) {
      return this.buildResult(
        0,
        'NONE',
        {
          summary: 'No skills requirements specified for this project',
          sourceValue: 'No skills specified',
          targetValue: contactSkills.length > 0
            ? `Contact skills: ${contactSkills.slice(0, 5).join(', ')}`
            : 'No skills on profile',
          matchType: 'NONE',
          details: ['Project has no specified skill requirements'],
        },
        context
      );
    }

    if (contactSkills.length === 0) {
      return this.buildResult(
        0,
        'NONE',
        {
          summary: 'Contact has no skills on their profile',
          sourceValue: `Project needs: ${totalSkills.slice(0, 5).join(', ')}`,
          targetValue: 'No skills on profile',
          matchType: 'NONE',
          details: ['Contact profile has no skills listed'],
        },
        context
      );
    }

    // Calculate weighted score
    let totalWeight = 0;
    let earnedWeight = 0;
    const matchedDetails: string[] = [];
    const missedDetails: string[] = [];
    const matchedSkills: string[] = [];
    let requiredMissing = false;

    // Check each importance level
    const levels = [
      { name: 'Required', skills: requiredSkills, weight: IMPORTANCE_WEIGHTS.required },
      { name: 'Preferred', skills: preferredSkills, weight: IMPORTANCE_WEIGHTS.preferred },
      { name: 'Nice to have', skills: niceToHaveSkills, weight: IMPORTANCE_WEIGHTS.niceToHave },
    ];

    for (const level of levels) {
      for (const skill of level.skills) {
        totalWeight += level.weight;
        const matched = this.isSkillMatch(skill, contactSkills);
        if (matched) {
          earnedWeight += level.weight;
          matchedSkills.push(skill);
          matchedDetails.push(`✅ ${skill} (${level.name}): Match found`);
        } else {
          if (level.name === 'Required') {
            requiredMissing = true;
          }
          missedDetails.push(`❌ ${skill} (${level.name}): Not found`);
        }
      }
    }

    // Calculate base score
    let score = totalWeight > 0 ? (earnedWeight / totalWeight) * 100 : 0;

    // Apply caps and floors
    if (requiredMissing) {
      // Cap at 60 if any REQUIRED skill is missing
      score = Math.min(score, 60);
    }

    if (requiredSkills.length > 0 && !requiredMissing) {
      // All required skills met → minimum 40
      score = Math.max(score, 40);
    }

    score = Math.round(Math.min(100, Math.max(0, score)));

    // Determine match type
    const matchRatio = totalSkills.length > 0
      ? matchedSkills.length / totalSkills.length
      : 0;
    let matchType: MatchType = 'NONE';
    if (matchRatio >= 0.8) matchType = 'EXACT';
    else if (matchRatio > 0) matchType = 'PARTIAL';

    const details = [...matchedDetails, ...missedDetails];

    return this.buildResult(
      score,
      matchType,
      {
        summary: this.buildSummary(score, matchedSkills.length, totalSkills.length, requiredMissing),
        sourceValue: `Project needs: ${totalSkills.join(', ')}`,
        targetValue: `Contact skills: ${contactSkills.slice(0, 10).join(', ')}`,
        matchType,
        details,
      },
      context,
      {
        sourceValues: totalSkills,
        targetValues: contactSkills,
        matchedCount: matchedSkills.length,
        totalCount: totalSkills.length,
      }
    );
  }

  /**
   * Check if a skill matches any contact skill (exact or synonym)
   */
  private isSkillMatch(skill: string, contactSkills: string[]): boolean {
    const skillLower = skill.toLowerCase().trim();
    const contactLower = contactSkills.map(s => s.toLowerCase().trim());

    // Exact match
    if (contactLower.includes(skillLower)) return true;

    // Check synonyms
    for (const [canonical, synonyms] of Object.entries(SKILL_SYNONYMS)) {
      const allVariants = [canonical, ...synonyms].map(s => s.toLowerCase());
      if (allVariants.includes(skillLower)) {
        // Skill is one of the variants; check if contact has any variant
        if (contactLower.some(cs => allVariants.includes(cs))) return true;
      }
    }

    // Substring match (e.g., "React" matches "React.js Development")
    if (contactLower.some(cs => cs.includes(skillLower) || skillLower.includes(cs))) {
      return true;
    }

    return false;
  }

  private buildSummary(score: number, matched: number, total: number, requiredMissing: boolean): string {
    if (score >= 90) return `Excellent skills fit - ${matched}/${total} skills matched`;
    if (score >= 70) return `Strong skills alignment - ${matched}/${total} skills matched`;
    if (score >= 50) {
      if (requiredMissing) return `Partial fit but missing required skills - ${matched}/${total} matched`;
      return `Good skills overlap - ${matched}/${total} skills matched`;
    }
    if (score >= 30) return `Limited skills match - ${matched}/${total} skills found`;
    return `Weak skills alignment - only ${matched}/${total} skills matched`;
  }
}

export default ProjectSkillsFitCriterion;
