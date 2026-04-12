/**
 * Skills Criterion Calculator
 *
 * Calculates match score based on overlapping skills.
 * Includes synonym matching (e.g., "JS" = "JavaScript").
 * Score = (Matched skills / Total unique skills) × 100
 *
 * @module infrastructure/services/itemized-matching/criteria/ProfileCriteria/SkillsCriterion
 */

import {
  BaseCriterionCalculator,
  MatchingProfile,
  CalculationContext,
  CriterionResult,
} from '../../interfaces/ICriterionCalculator';
import { CriterionImportance, MatchType } from '../../../../../domain/services/IItemizedMatchingService';
import { SKILL_SYNONYMS, getCriterionImportance } from '../../constants/CriteriaDefinitions';
import { normalizeString, jaccardSimilarity } from '../../utils/ScoreUtils';

export class SkillsCriterion extends BaseCriterionCalculator {
  readonly id = 'skills';
  readonly name = 'Skills';
  readonly icon = '🛠️';
  readonly defaultImportance: CriterionImportance = 'HIGH';
  readonly applicableMatchTypes = [
    'PROFILE_TO_PROFILE',
    'PROFILE_TO_USER',
    'PROJECT_TO_TALENT',
    'JOB_TO_CANDIDATE',
    'EVENT_ATTENDEE_MATCH',
  ];

  getImportance(matchType: string): CriterionImportance {
    return getCriterionImportance(this.id, matchType as any);
  }

  /**
   * Normalize a skill name and get its canonical form
   */
  private normalizeSkill(skill: string): string {
    const normalized = normalizeString(skill);

    // Check if this is a synonym
    for (const [canonical, synonyms] of Object.entries(SKILL_SYNONYMS)) {
      if (normalized === canonical || synonyms.includes(normalized)) {
        return canonical;
      }
    }

    return normalized;
  }

  /**
   * Find matching skills between two arrays
   */
  private findSkillMatches(
    sourceSkills: string[],
    targetSkills: string[]
  ): { exact: string[]; synonym: string[]; normalizedSource: Set<string>; normalizedTarget: Set<string> } {
    const normalizedSource = new Set(sourceSkills.map(s => this.normalizeSkill(s)));
    const normalizedTarget = new Set(targetSkills.map(s => this.normalizeSkill(s)));

    const exactMatches: string[] = [];
    const synonymMatches: string[] = [];

    for (const sourceSkill of sourceSkills) {
      const normalizedSourceSkill = this.normalizeSkill(sourceSkill);

      for (const targetSkill of targetSkills) {
        const normalizedTargetSkill = this.normalizeSkill(targetSkill);

        if (normalizedSourceSkill === normalizedTargetSkill) {
          // Check if it's an exact match or synonym match
          if (normalizeString(sourceSkill) === normalizeString(targetSkill)) {
            if (!exactMatches.includes(sourceSkill)) {
              exactMatches.push(sourceSkill);
            }
          } else {
            if (!synonymMatches.includes(sourceSkill) && !exactMatches.includes(sourceSkill)) {
              synonymMatches.push(`${sourceSkill} ≈ ${targetSkill}`);
            }
          }
        }
      }
    }

    return { exact: exactMatches, synonym: synonymMatches, normalizedSource, normalizedTarget };
  }

  async calculate(
    source: MatchingProfile,
    target: MatchingProfile,
    context: CalculationContext
  ): Promise<CriterionResult> {
    const sourceSkills = source.skills || [];
    const targetSkills = target.skills || [];

    // Handle empty cases
    if (sourceSkills.length === 0 || targetSkills.length === 0) {
      return this.buildResult(
        0,
        'NONE',
        {
          summary: sourceSkills.length === 0 && targetSkills.length === 0
            ? 'No skills data available'
            : sourceSkills.length === 0
              ? `${source.name} has no skills listed`
              : `${target.name} has no skills listed`,
          sourceValue: sourceSkills.length > 0 ? `${source.name}: ${sourceSkills.join(', ')}` : 'No skills specified',
          targetValue: targetSkills.length > 0 ? `${target.name}: ${targetSkills.join(', ')}` : 'No skills specified',
          matchType: 'NONE',
          details: ['No skill comparison possible'],
        },
        context,
        {
          sourceValues: sourceSkills,
          targetValues: targetSkills,
          matchedCount: 0,
          totalCount: 0,
        }
      );
    }

    const { exact, synonym, normalizedSource, normalizedTarget } = this.findSkillMatches(sourceSkills, targetSkills);

    // Calculate score using Jaccard similarity on normalized skills
    const score = jaccardSimilarity(normalizedSource, normalizedTarget);

    // Determine match type
    const totalMatches = exact.length + synonym.length;
    let matchType: MatchType = 'NONE';
    if (totalMatches > 0) {
      matchType = exact.length > 0 && score >= 50 ? 'EXACT' : 'PARTIAL';
    }

    // Build explanation details
    const details: string[] = [];
    for (const skill of exact.slice(0, 5)) {
      details.push(`✅ ${skill}: Exact match`);
    }
    for (const match of synonym.slice(0, 3)) {
      details.push(`🔄 ${match}: Synonym match`);
    }
    if (totalMatches === 0) {
      details.push('❌ No skill overlap found');
    }
    if (exact.length > 5) {
      details.push(`... and ${exact.length - 5} more exact matches`);
    }

    const summary = totalMatches > 0
      ? `${totalMatches} shared skill${totalMatches > 1 ? 's' : ''}: ${exact.slice(0, 3).join(', ')}${exact.length > 3 ? '...' : ''}`
      : 'No overlapping skills';

    return this.buildResult(
      score,
      matchType,
      {
        summary,
        sourceValue: `${source.name}: ${sourceSkills.slice(0, 5).join(', ')}${sourceSkills.length > 5 ? '...' : ''}`,
        targetValue: `${target.name}: ${targetSkills.slice(0, 5).join(', ')}${targetSkills.length > 5 ? '...' : ''}`,
        matchType,
        details,
      },
      context,
      {
        sourceValues: sourceSkills,
        targetValues: targetSkills,
        matchedCount: totalMatches,
        totalCount: new Set([...normalizedSource, ...normalizedTarget]).size,
        additionalData: { exactMatches: exact, synonymMatches: synonym },
      }
    );
  }
}

export default SkillsCriterion;
