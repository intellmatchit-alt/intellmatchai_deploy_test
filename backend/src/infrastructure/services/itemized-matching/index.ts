/**
 * Itemized Matching Service Index
 *
 * Exports the main service and supporting types.
 *
 * @module infrastructure/services/itemized-matching
 */

// Main service
export {
  ItemizedExplainableMatchingService,
  itemizedMatchingService,
  default as ItemizedExplainableMatchingServiceDefault,
} from './ItemizedExplainableMatchingService';

// Interfaces
export { BaseCriterionCalculator } from './interfaces/ICriterionCalculator';
export type {
  ICriterionCalculator,
  MatchingProfile,
  CalculationContext,
  CriterionResult,
  EducationInfo,
  ExperienceInfo,
} from './interfaces/ICriterionCalculator';

// Utils
export {
  scoreToStatus,
  statusToColor,
  statusToLabel,
  calculateSummary,
  sortCriteria,
  generateConcerns,
  jaccardSimilarity,
  overlapPercentage,
  findCommonItems,
  normalizeString,
  areStringSimilar,
  parseInvestmentRange,
  doRangesOverlap,
} from './utils/ScoreUtils';

// Constants
export {
  PROFILE_CRITERIA,
  ITEM_CRITERIA,
  EVENT_CRITERIA,
  ALL_CRITERIA,
  getCriterionById,
  getCriteriaForMatchType,
  getCriterionImportance,
  SKILL_SYNONYMS,
  RELATED_INDUSTRIES,
  INVESTMENT_STAGES,
  SENIORITY_LEVELS,
} from './constants/CriteriaDefinitions';

// Criteria
export { createProfileCriteria } from './criteria/ProfileCriteria';
export { createEventCriteria } from './criteria/EventCriteria';

// Individual criteria for extension
export { IndustryCriterion } from './criteria/ProfileCriteria/IndustryCriterion';
export { SkillsCriterion } from './criteria/ProfileCriteria/SkillsCriterion';
export { GoalsCriterion } from './criteria/ProfileCriteria/GoalsCriterion';
export { LocationCriterion } from './criteria/ProfileCriteria/LocationCriterion';
export { InterestsCriterion } from './criteria/ProfileCriteria/InterestsCriterion';
export { ComplementaryGoalsCriterion } from './criteria/EventCriteria/ComplementaryGoalsCriterion';
