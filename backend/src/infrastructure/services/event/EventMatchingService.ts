/**
 * Event Matching Service
 *
 * Extracted from EventController for testability and reuse.
 * Calculates match scores between event attendees based on:
 * - Goal alignment (30%)
 * - Sector overlap (20%)
 * - Skill overlap (18%)
 * - Complementary skills (12%)
 * - Interest overlap (10%)
 * - Hobby overlap (10%)
 *
 * @module infrastructure/services/event/EventMatchingService
 */

import { EventMatchLevel } from '@prisma/client';
import {
  jaccardSimilarity,
  calculateComplementarySkillsScore,
  hasComplementarySkills,
  matchesRolePatterns,
  SENIOR_ROLE_PATTERNS,
  INVESTOR_ROLE_PATTERNS,
  HIRING_ROLE_PATTERNS,
} from '../../../shared/matching';
import { skillTaxonomyService } from '../taxonomy';
import { logger } from '../../../shared/logger';

// ============================================================================
// Types
// ============================================================================

export interface EventAttendeeProfile {
  id: string;
  jobTitle?: string;
  userSectors?: Array<{ sectorId: string; sector?: { name: string } }>;
  userSkills?: Array<{ skillId: string; skill?: { name: string } }>;
  userInterests?: Array<{ interestId: string; interest?: { name: string } }>;
  userHobbies?: Array<{ hobbyId: string; hobby?: { name: string } }>;
  userGoals?: Array<{ goalType: string }>;
}

export interface EventMatchResult {
  score: number;
  level: EventMatchLevel;
  reasons: string[];
}

// ============================================================================
// Weights
// ============================================================================

const EVENT_MATCH_WEIGHTS = {
  goalAlignment: 0.30,
  sector: 0.20,
  skill: 0.18,
  complementarySkills: 0.12,
  interest: 0.10,
  hobby: 0.10,
};

// ============================================================================
// Goal Alignment
// ============================================================================

/** Define goal pairs once; reverse pairs are auto-generated */
const BASE_GOAL_PAIRS: Array<{ goal1: string; goal2: string; score: number; reason: string }> = [
  { goal1: 'HIRING', goal2: 'JOB_SEEKING', score: 80, reason: 'Hiring meets Job Seeker' },
  { goal1: 'INVESTMENT', goal2: 'PARTNERSHIP', score: 70, reason: 'Investor meets Entrepreneur' },
  { goal1: 'MENTORSHIP', goal2: 'LEARNING', score: 60, reason: 'Mentor meets Learner' },
  { goal1: 'COLLABORATION', goal2: 'COLLABORATION', score: 60, reason: 'Both seeking collaboration' },
  { goal1: 'SALES', goal2: 'PARTNERSHIP', score: 50, reason: 'Sales meets Business Partner' },
];

/** Auto-generate symmetric lookup map from base pairs */
const COMPLEMENTARY_GOAL_MAP = new Map<string, { score: number; reason: string }>();
for (const pair of BASE_GOAL_PAIRS) {
  const fwdKey = `${pair.goal1}::${pair.goal2}`;
  COMPLEMENTARY_GOAL_MAP.set(fwdKey, { score: pair.score, reason: pair.reason });
  if (pair.goal1 !== pair.goal2) {
    const revKey = `${pair.goal2}::${pair.goal1}`;
    COMPLEMENTARY_GOAL_MAP.set(revKey, { score: pair.score, reason: pair.reason });
  }
}

// ============================================================================
// Service
// ============================================================================

export class EventMatchingService {
  /**
   * Calculate match score between two event attendees
   */
  calculateMatchScore(user1: EventAttendeeProfile, user2: EventAttendeeProfile): EventMatchResult {
    // Extract data
    const u1SectorIds = new Set<string>((user1.userSectors || []).map(s => s.sectorId));
    const u2SectorIds = new Set<string>((user2.userSectors || []).map(s => s.sectorId));
    const u1SkillIds = new Set<string>((user1.userSkills || []).map(s => s.skillId));
    const u2SkillIds = new Set<string>((user2.userSkills || []).map(s => s.skillId));
    const u1InterestIds = new Set<string>((user1.userInterests || []).map(i => i.interestId));
    const u2InterestIds = new Set<string>((user2.userInterests || []).map(i => i.interestId));
    const u1HobbyIds = new Set<string>((user1.userHobbies || []).map(h => h.hobbyId));
    const u2HobbyIds = new Set<string>((user2.userHobbies || []).map(h => h.hobbyId));

    const u1SkillNames = (user1.userSkills || []).map(s => s.skill?.name || '').filter(Boolean);
    const u2SkillNames = (user2.userSkills || []).map(s => s.skill?.name || '').filter(Boolean);
    const u1Goals = (user1.userGoals || []).map(g => g.goalType);
    const u2Goals = (user2.userGoals || []).map(g => g.goalType);

    // 1. Goal alignment (30%)
    const goalResult = this.calculateGoalAlignment(
      u1Goals, u2Goals,
      user1.jobTitle || '', user2.jobTitle || '',
      u1SectorIds, u2SectorIds,
      u1SkillNames, u2SkillNames,
    );

    // 2. Sector overlap (20%) - using shared jaccardSimilarity
    const sectorScore = jaccardSimilarity(u1SectorIds, u2SectorIds);

    // 3. Skill overlap (18%) - use taxonomy for enhanced matching
    let skillScore: number;
    if (skillTaxonomyService.isAvailable() && u1SkillNames.length > 0 && u2SkillNames.length > 0) {
      const taxonomyResult = skillTaxonomyService.calculateSkillScore(u1SkillNames, u2SkillNames);
      skillScore = taxonomyResult.score;
    } else {
      skillScore = jaccardSimilarity(u1SkillIds, u2SkillIds);
    }

    // 4. Complementary skills (12%)
    const compSkillScore = calculateComplementarySkillsScore(u1SkillNames, u2SkillNames);

    // 5. Interest overlap (10%)
    const interestScore = jaccardSimilarity(u1InterestIds, u2InterestIds);

    // 6. Hobby overlap (10%)
    const hobbyScore = jaccardSimilarity(u1HobbyIds, u2HobbyIds);

    // Weighted total
    const totalScore = Math.min(100, Math.round(
      goalResult.score * EVENT_MATCH_WEIGHTS.goalAlignment +
      sectorScore * EVENT_MATCH_WEIGHTS.sector +
      skillScore * EVENT_MATCH_WEIGHTS.skill +
      compSkillScore * EVENT_MATCH_WEIGHTS.complementarySkills +
      interestScore * EVENT_MATCH_WEIGHTS.interest +
      hobbyScore * EVENT_MATCH_WEIGHTS.hobby
    ));

    // Build reasons
    const reasons = [...goalResult.reasons];
    if (sectorScore > 0) {
      const sharedSectors = (user1.userSectors || [])
        .filter(s => u2SectorIds.has(s.sectorId))
        .map(s => s.sector?.name)
        .filter(Boolean)
        .slice(0, 3);
      if (sharedSectors.length > 0) reasons.push(`Shared sectors: ${sharedSectors.join(', ')}`);
    }
    if (skillScore > 0) {
      const sharedSkills = (user1.userSkills || [])
        .filter(s => u2SkillIds.has(s.skillId))
        .map(s => s.skill?.name)
        .filter(Boolean)
        .slice(0, 3);
      if (sharedSkills.length > 0) reasons.push(`Shared skills: ${sharedSkills.join(', ')}`);
    }
    if (interestScore > 0) {
      const sharedInterests = (user1.userInterests || [])
        .filter(i => u2InterestIds.has(i.interestId))
        .map(i => i.interest?.name)
        .filter(Boolean)
        .slice(0, 3);
      if (sharedInterests.length > 0) reasons.push(`Shared interests: ${sharedInterests.join(', ')}`);
    }

    // Determine level
    let level: EventMatchLevel;
    if (totalScore >= 40) {
      level = EventMatchLevel.HIGH;
    } else if (totalScore >= 20) {
      level = EventMatchLevel.MEDIUM;
    } else {
      level = EventMatchLevel.LOW;
    }

    return { score: totalScore, level, reasons: reasons.slice(0, 5) };
  }

  /**
   * Calculate goal alignment between two users
   */
  private calculateGoalAlignment(
    user1Goals: string[],
    user2Goals: string[],
    user1JobTitle: string,
    user2JobTitle: string,
    user1SectorIds: Set<string>,
    user2SectorIds: Set<string>,
    user1SkillNames: string[],
    user2SkillNames: string[],
  ): { score: number; reasons: string[] } {
    if (user1Goals.length === 0 && user2Goals.length === 0) {
      return { score: 0, reasons: [] };
    }

    let totalScore = 0;
    const reasons: string[] = [];

    const hasSameSector = [...user1SectorIds].some(id => user2SectorIds.has(id));
    const isSenior1 = matchesRolePatterns(user1JobTitle, SENIOR_ROLE_PATTERNS);
    const isSenior2 = matchesRolePatterns(user2JobTitle, SENIOR_ROLE_PATTERNS);
    const isInvestor1 = matchesRolePatterns(user1JobTitle, INVESTOR_ROLE_PATTERNS);
    const isInvestor2 = matchesRolePatterns(user2JobTitle, INVESTOR_ROLE_PATTERNS);
    const isHiring1 = matchesRolePatterns(user1JobTitle, HIRING_ROLE_PATTERNS);
    const isHiring2 = matchesRolePatterns(user2JobTitle, HIRING_ROLE_PATTERNS);
    const hasCompSkills = hasComplementarySkills(user1SkillNames, user2SkillNames);

    for (const goal1 of user1Goals) {
      for (const goal2 of user2Goals) {
        const match = COMPLEMENTARY_GOAL_MAP.get(`${goal1}::${goal2}`);
        if (match) {
          totalScore = Math.max(totalScore, match.score);
          reasons.push(match.reason);
        }
        if (goal1 === goal2 && !match) {
          totalScore = Math.max(totalScore, 40);
          reasons.push(`Shared goal: ${goal1.replace(/_/g, ' ')}`);
        }
      }
    }

    // Context bonuses
    if (totalScore > 0 && hasSameSector) {
      totalScore = Math.min(100, totalScore + 15);
      reasons.push('Same industry');
    }
    if (totalScore > 0 && hasCompSkills) {
      totalScore = Math.min(100, totalScore + 10);
      reasons.push('Complementary skills');
    }

    // Role-based matching without explicit goals
    if (totalScore === 0) {
      if ((isSenior1 && !isSenior2) || (!isSenior1 && isSenior2)) {
        if (hasSameSector) { totalScore = 30; reasons.push('Senior professional in same industry'); }
      }
      if ((isInvestor1 && !isInvestor2) || (!isInvestor1 && isInvestor2)) {
        totalScore = Math.max(totalScore, 35); reasons.push('Potential investor connection');
      }
      if ((isHiring1 && !isHiring2) || (!isHiring1 && isHiring2)) {
        totalScore = Math.max(totalScore, 25); reasons.push('Potential hiring connection');
      }
    }

    return { score: totalScore, reasons: [...new Set(reasons)].slice(0, 3) };
  }

  /**
   * Match all attendees against each other in a batch
   */
  calculateBatchMatches(
    attendees: EventAttendeeProfile[]
  ): Array<{ user1Id: string; user2Id: string; result: EventMatchResult }> {
    const results: Array<{ user1Id: string; user2Id: string; result: EventMatchResult }> = [];

    for (let i = 0; i < attendees.length; i++) {
      for (let j = i + 1; j < attendees.length; j++) {
        const result = this.calculateMatchScore(attendees[i], attendees[j]);
        results.push({
          user1Id: attendees[i].id,
          user2Id: attendees[j].id,
          result,
        });
      }
    }

    return results;
  }
}

// Export singleton instance
export const eventMatchingService = new EventMatchingService();
