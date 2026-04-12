/**
 * Shared Matching Utilities - Public API
 *
 * @module shared/matching
 */

export {
  // String similarity
  levenshteinDistance,
  fuzzyMatch,
  areStringsSimilar,
  normalizeString,

  // Set similarity
  jaccardSimilarity,
  overlapPercentage,
  findCommonItems,

  // Vector similarity
  cosineSimilarity,

  // Score classification
  scoreToStatus,

  // Role patterns
  SENIOR_ROLE_PATTERNS,
  INVESTOR_ROLE_PATTERNS,
  HIRING_ROLE_PATTERNS,
  INVESTMENT_COMPANY_PATTERNS,
  DECISION_MAKER_TITLES,
  INFLUENCER_TITLES,
  CONSULTANT_TITLES,
  BROKER_TITLES,
  matchesRolePatterns,
  titleContainsAny,

  // Seniority
  SeniorityLevel,
  SENIORITY_KEYWORDS,
  ARABIC_SENIORITY_KEYWORDS,
  SENIORITY_SCORES,
  SENIORITY_ORDER,
  detectSeniorityLevel,

  // Complementary skills
  COMPLEMENTARY_SKILLS,
  calculateComplementarySkillsScore,
  hasComplementarySkills,

  // Solution types
  SOLUTION_TYPE_KEYWORDS,

  // Investment ranges
  parseInvestmentRange,
  doRangesOverlap,

  // Goal alignment
  COMPLEMENTARY_GOAL_PAIRS,
  calculateGoalAlignment,

  // Confidence
  calculateConfidence,
} from './SharedMatchingUtils';

export type {
  MatchStatus,
  MatchQuality,
  ConfidenceResult,
} from './SharedMatchingUtils';
