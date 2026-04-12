/**
 * Goals Criterion Calculator
 *
 * Calculates match score based on networking goals alignment.
 * COMPLEMENTARY goals (A seeks what B offers) = 100%
 * Same goals = 70% | Related goals = 50%
 *
 * @module infrastructure/services/itemized-matching/criteria/ProfileCriteria/GoalsCriterion
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
 * Goal complementarity matrix
 * Maps goals to what they complement (seeker -> provider)
 */
const GOAL_COMPLEMENTS: Record<string, string[]> = {
  INVESTMENT: ['MENTORSHIP', 'SALES', 'PARTNERSHIP'], // Investors complement founders seeking funding
  MENTORSHIP: ['LEARNING', 'COLLABORATION'], // Mentors complement learners
  HIRING: ['JOB_SEEKING'], // Hiring managers complement job seekers
  JOB_SEEKING: ['HIRING'], // Job seekers complement hiring managers
  PARTNERSHIP: ['COLLABORATION', 'SALES'], // Partners complement collaborators
  COLLABORATION: ['PARTNERSHIP', 'MENTORSHIP'], // Collaborators complement partners
  LEARNING: ['MENTORSHIP'], // Learners complement mentors
  SALES: ['PARTNERSHIP', 'INVESTMENT'], // Sales complement buyers/investors
};

/**
 * Goals that indicate similar interests (not complementary but aligned)
 */
const RELATED_GOALS: Record<string, string[]> = {
  INVESTMENT: ['PARTNERSHIP', 'COLLABORATION'],
  MENTORSHIP: ['LEARNING', 'COLLABORATION'],
  PARTNERSHIP: ['COLLABORATION', 'INVESTMENT'],
  HIRING: ['PARTNERSHIP'],
  JOB_SEEKING: ['LEARNING', 'MENTORSHIP'],
  COLLABORATION: ['PARTNERSHIP', 'MENTORSHIP'],
  LEARNING: ['COLLABORATION', 'JOB_SEEKING'],
  SALES: ['PARTNERSHIP', 'COLLABORATION'],
};

export class GoalsCriterion extends BaseCriterionCalculator {
  readonly id = 'goals';
  readonly name = 'Goals Alignment';
  readonly icon = '🎯';
  readonly defaultImportance: CriterionImportance = 'HIGH';
  readonly applicableMatchTypes = [
    'PROFILE_TO_PROFILE',
    'PROFILE_TO_USER',
    'EVENT_ATTENDEE_MATCH',
  ];

  async calculate(
    source: MatchingProfile,
    target: MatchingProfile,
    context: CalculationContext
  ): Promise<CriterionResult> {
    const sourceGoals = (source.goals || []).map(g => g.toUpperCase());
    const targetGoals = (target.goals || []).map(g => g.toUpperCase());

    // Handle empty goals
    if (sourceGoals.length === 0 || targetGoals.length === 0) {
      return this.buildResult(
        0,
        'NONE',
        {
          summary: 'Goals not specified',
          sourceValue: sourceGoals.length > 0 ? `${source.name}: ${sourceGoals.join(', ')}` : 'No goals set',
          targetValue: targetGoals.length > 0 ? `${target.name}: ${targetGoals.join(', ')}` : 'No goals set',
          matchType: 'NONE',
          details: ['Unable to assess goal alignment without goal data'],
        },
        context,
        {
          sourceValues: sourceGoals,
          targetValues: targetGoals,
          matchedCount: 0,
          totalCount: 0,
        }
      );
    }

    const complementaryPairs: string[] = [];
    const matchingGoals: string[] = [];
    const relatedGoals: string[] = [];

    // Check for complementary goals (most valuable)
    for (const sourceGoal of sourceGoals) {
      const complements = GOAL_COMPLEMENTS[sourceGoal] || [];

      for (const targetGoal of targetGoals) {
        // Source seeks what target offers
        if (complements.includes(targetGoal)) {
          complementaryPairs.push(`${sourceGoal} → ${targetGoal}`);
        }

        // Check reverse direction too
        const targetComplements = GOAL_COMPLEMENTS[targetGoal] || [];
        if (targetComplements.includes(sourceGoal)) {
          const pair = `${targetGoal} → ${sourceGoal}`;
          if (!complementaryPairs.includes(pair)) {
            complementaryPairs.push(pair);
          }
        }

        // Check for exact match
        if (sourceGoal === targetGoal && !matchingGoals.includes(sourceGoal)) {
          matchingGoals.push(sourceGoal);
        }

        // Check for related goals
        const related = RELATED_GOALS[sourceGoal] || [];
        if (related.includes(targetGoal) && !relatedGoals.includes(targetGoal)) {
          relatedGoals.push(`${sourceGoal} ↔ ${targetGoal}`);
        }
      }
    }

    // Calculate score based on matches
    let score = 0;
    let matchType: MatchType = 'NONE';

    if (complementaryPairs.length > 0) {
      // Complementary goals are the best - score 80-100
      score = Math.min(100, 80 + complementaryPairs.length * 10);
      matchType = 'COMPLEMENTARY';
    } else if (matchingGoals.length > 0) {
      // Same goals are good - score 60-80
      score = Math.min(80, 60 + matchingGoals.length * 10);
      matchType = 'EXACT';
    } else if (relatedGoals.length > 0) {
      // Related goals are okay - score 40-60
      score = Math.min(60, 40 + relatedGoals.length * 10);
      matchType = 'PARTIAL';
    }

    // Build explanation
    const details: string[] = [];
    for (const pair of complementaryPairs.slice(0, 3)) {
      details.push(`✨ ${pair}: Complementary goals`);
    }
    for (const goal of matchingGoals.slice(0, 3)) {
      details.push(`✅ ${goal}: Shared goal`);
    }
    for (const pair of relatedGoals.slice(0, 2)) {
      details.push(`🔄 ${pair}: Related goals`);
    }
    if (details.length === 0) {
      details.push('❌ No goal alignment found');
    }

    const summary = complementaryPairs.length > 0
      ? `Complementary goals: ${complementaryPairs[0].replace(' → ', ' seeks / offers ')}`
      : matchingGoals.length > 0
        ? `Shared goal${matchingGoals.length > 1 ? 's' : ''}: ${matchingGoals.join(', ')}`
        : relatedGoals.length > 0
          ? `Related goals: ${relatedGoals[0].replace(' ↔ ', ' and ')}`
          : 'Different networking objectives';

    return this.buildResult(
      score,
      matchType,
      {
        summary,
        sourceValue: `${source.name} seeks: ${sourceGoals.join(', ').toLowerCase().replace(/_/g, ' ')}`,
        targetValue: `${target.name} seeks: ${targetGoals.join(', ').toLowerCase().replace(/_/g, ' ')}`,
        matchType,
        details,
      },
      context,
      {
        sourceValues: sourceGoals,
        targetValues: targetGoals,
        matchedCount: complementaryPairs.length + matchingGoals.length,
        totalCount: new Set([...sourceGoals, ...targetGoals]).size,
        additionalData: { complementaryPairs, matchingGoals, relatedGoals },
      }
    );
  }
}

export default GoalsCriterion;
