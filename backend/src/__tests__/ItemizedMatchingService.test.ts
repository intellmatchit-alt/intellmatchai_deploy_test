/**
 * ItemizedExplainableMatchingService Unit Tests
 *
 * Tests the itemized matching service utilities and basic functionality
 */

// Mock all dependencies before imports
jest.mock('../infrastructure/database/prisma/client', () => ({
  prisma: {
    user: { findUnique: jest.fn() },
    contact: { findMany: jest.fn(), findFirst: jest.fn(), findUnique: jest.fn() },
    eventAttendee: { findUnique: jest.fn(), findMany: jest.fn() },
  },
}));

jest.mock('../shared/logger/index.js', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
  },
}));

import { scoreToStatus } from '../infrastructure/services/itemized-matching/utils/ScoreUtils';
import { SkillsCriterion } from '../infrastructure/services/itemized-matching/criteria/ProfileCriteria/SkillsCriterion';
import { IndustryCriterion } from '../infrastructure/services/itemized-matching/criteria/ProfileCriteria/IndustryCriterion';
import { GoalsCriterion } from '../infrastructure/services/itemized-matching/criteria/ProfileCriteria/GoalsCriterion';
import { LocationCriterion } from '../infrastructure/services/itemized-matching/criteria/ProfileCriteria/LocationCriterion';

describe('ItemizedExplainableMatchingService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('ScoreUtils - scoreToStatus', () => {
    it('should return PERFECT for scores 95-100', () => {
      expect(scoreToStatus(100)).toBe('PERFECT');
      expect(scoreToStatus(95)).toBe('PERFECT');
    });

    it('should return EXCELLENT for scores 80-94', () => {
      expect(scoreToStatus(94)).toBe('EXCELLENT');
      expect(scoreToStatus(80)).toBe('EXCELLENT');
    });

    it('should return STRONG for scores 60-79', () => {
      expect(scoreToStatus(79)).toBe('STRONG');
      expect(scoreToStatus(60)).toBe('STRONG');
    });

    it('should return MODERATE for scores 40-59', () => {
      expect(scoreToStatus(59)).toBe('MODERATE');
      expect(scoreToStatus(40)).toBe('MODERATE');
    });

    it('should return WEAK for scores 20-39', () => {
      expect(scoreToStatus(39)).toBe('WEAK');
      expect(scoreToStatus(20)).toBe('WEAK');
    });

    it('should return NO_MATCH for scores 0-19', () => {
      expect(scoreToStatus(19)).toBe('NO_MATCH');
      expect(scoreToStatus(0)).toBe('NO_MATCH');
    });

    it('should handle boundary cases correctly', () => {
      // Test all boundaries
      const testCases = [
        { score: 100, expected: 'PERFECT' },
        { score: 95, expected: 'PERFECT' },
        { score: 94, expected: 'EXCELLENT' },
        { score: 80, expected: 'EXCELLENT' },
        { score: 79, expected: 'STRONG' },
        { score: 60, expected: 'STRONG' },
        { score: 59, expected: 'MODERATE' },
        { score: 40, expected: 'MODERATE' },
        { score: 39, expected: 'WEAK' },
        { score: 20, expected: 'WEAK' },
        { score: 19, expected: 'NO_MATCH' },
        { score: 0, expected: 'NO_MATCH' },
      ];

      testCases.forEach(({ score, expected }) => {
        expect(scoreToStatus(score)).toBe(expected);
      });
    });
  });

  describe('Criterion Metadata', () => {
    describe('SkillsCriterion', () => {
      const criterion = new SkillsCriterion();

      it('should have correct id', () => {
        expect(criterion.id).toBe('skills');
      });

      it('should have correct name', () => {
        expect(criterion.name).toBe('Skills');
      });

      it('should have correct default importance', () => {
        expect(criterion.defaultImportance).toBe('HIGH');
      });

      it('should have applicable match types', () => {
        expect(criterion.applicableMatchTypes).toContain('PROFILE_TO_PROFILE');
        expect(criterion.applicableMatchTypes).toContain('JOB_TO_CANDIDATE');
      });
    });

    describe('IndustryCriterion', () => {
      const criterion = new IndustryCriterion();

      it('should have correct id', () => {
        expect(criterion.id).toBe('industry');
      });

      it('should have correct name', () => {
        expect(criterion.name).toBe('Industry/Sector');
      });

      it('should have HIGH importance', () => {
        expect(criterion.defaultImportance).toBe('HIGH');
      });
    });

    describe('GoalsCriterion', () => {
      const criterion = new GoalsCriterion();

      it('should have correct id', () => {
        expect(criterion.id).toBe('goals');
      });

      it('should have correct name', () => {
        expect(criterion.name).toBe('Goals Alignment');
      });

      it('should have HIGH importance', () => {
        expect(criterion.defaultImportance).toBe('HIGH');
      });
    });

    describe('LocationCriterion', () => {
      const criterion = new LocationCriterion();

      it('should have correct id', () => {
        expect(criterion.id).toBe('location');
      });

      it('should have correct name', () => {
        expect(criterion.name).toBe('Location');
      });

      it('should have MEDIUM importance', () => {
        expect(criterion.defaultImportance).toBe('MEDIUM');
      });
    });
  });

  describe('Match Status Configuration', () => {
    it('should cover all score ranges 0-100', () => {
      // Test that every score from 0-100 maps to a valid status
      for (let score = 0; score <= 100; score++) {
        const status = scoreToStatus(score);
        expect(['PERFECT', 'EXCELLENT', 'STRONG', 'MODERATE', 'WEAK', 'NO_MATCH']).toContain(status);
      }
    });

    it('should have consistent status hierarchy', () => {
      // Higher scores should map to "better" statuses
      const statusOrder = ['NO_MATCH', 'WEAK', 'MODERATE', 'STRONG', 'EXCELLENT', 'PERFECT'];

      expect(statusOrder.indexOf(scoreToStatus(100))).toBeGreaterThan(statusOrder.indexOf(scoreToStatus(50)));
      expect(statusOrder.indexOf(scoreToStatus(80))).toBeGreaterThan(statusOrder.indexOf(scoreToStatus(30)));
      expect(statusOrder.indexOf(scoreToStatus(95))).toBeGreaterThan(statusOrder.indexOf(scoreToStatus(80)));
    });
  });

  describe('Importance Levels', () => {
    it('should have defined importance levels for criteria', () => {
      const skillsCriterion = new SkillsCriterion();
      const industryCriterion = new IndustryCriterion();
      const goalsCriterion = new GoalsCriterion();
      const locationCriterion = new LocationCriterion();

      // All criteria should have defined importance
      expect(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']).toContain(skillsCriterion.defaultImportance);
      expect(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']).toContain(industryCriterion.defaultImportance);
      expect(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']).toContain(goalsCriterion.defaultImportance);
      expect(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']).toContain(locationCriterion.defaultImportance);
    });

    it('should have industry as HIGH importance', () => {
      const industryCriterion = new IndustryCriterion();
      expect(industryCriterion.defaultImportance).toBe('HIGH');
    });
  });

  describe('Criterion Applicability', () => {
    it('should include PROFILE_TO_PROFILE for all profile criteria', () => {
      const criteria = [
        new SkillsCriterion(),
        new IndustryCriterion(),
        new GoalsCriterion(),
        new LocationCriterion(),
      ];

      criteria.forEach(criterion => {
        expect(criterion.applicableMatchTypes).toContain('PROFILE_TO_PROFILE');
      });
    });

    it('should include EVENT_ATTENDEE_MATCH for relevant criteria', () => {
      const skillsCriterion = new SkillsCriterion();
      const locationCriterion = new LocationCriterion();

      expect(skillsCriterion.applicableMatchTypes).toContain('EVENT_ATTENDEE_MATCH');
      expect(locationCriterion.applicableMatchTypes).toContain('EVENT_ATTENDEE_MATCH');
    });
  });
});
