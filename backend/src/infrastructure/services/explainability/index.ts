/**
 * Enhanced Explainability Service - Public API
 *
 * @module infrastructure/services/explainability
 */

export {
  EnhancedExplainabilityService,
  enhancedExplainabilityService,
} from './EnhancedExplainabilityService';

export type {
  CriteriaScore,
  ExplainedCriterion,
  ExplainableMatchResult,
  SkillGapReport,
  ImprovementSuggestion,
} from './EnhancedExplainabilityService';

export {
  CriterionType,
  ExplanationTier,
  getTier,
  EXPLANATION_TEMPLATES,
  renderTemplate,
} from './templates';
