/**
 * Criterion Calculator Interface
 *
 * Defines the contract for individual criterion calculators.
 * Each criterion (e.g., Education, Skills, Industry) implements this interface.
 *
 * @module infrastructure/services/itemized-matching/interfaces/ICriterionCalculator
 */

import {
  CriterionImportance,
  CriterionMatch,
  MatchStatus,
  MatchType,
  CriterionExplanation,
} from '../../../../domain/services/IItemizedMatchingService';

/**
 * Source and target profile data for matching
 * This is the normalized input for criterion calculators
 */
export interface MatchingProfile {
  id: string;
  type: 'USER' | 'CONTACT' | 'PROJECT' | 'JOB' | 'DEAL' | 'EVENT_ATTENDEE' | 'OPPORTUNITY' | 'PITCH';
  name: string;

  // Common fields
  bio?: string;
  company?: string;
  jobTitle?: string;
  location?: string;
  education?: EducationInfo[];
  experience?: ExperienceInfo[];

  // Normalized arrays of names (lowercase for comparison)
  sectors: string[];
  skills: string[];
  interests: string[];
  hobbies: string[];
  languages?: string[];

  // Goals and intentions
  goals?: string[]; // GoalType values
  lookingFor?: string; // For events - what they're looking for
  canOffer?: string; // For events - what they can offer

  // Project/Job specific
  requiredSkills?: string[];
  preferredSkills?: string[];
  budget?: string;
  investmentRange?: string;
  stage?: string;
  checkSize?: string;
  geographyFocus?: string[];
  thesisFocus?: string[];

  // Network info
  mutualConnections?: number;
  networkDegree?: number;

  // Raw data for detailed explanations
  rawData?: Record<string, any>;
}

/**
 * Education information
 */
export interface EducationInfo {
  school?: string;
  degree?: string;
  field?: string;
  year?: number;
  normalized: string; // Lowercase combined string for comparison
}

/**
 * Work experience information
 */
export interface ExperienceInfo {
  company?: string;
  title?: string;
  industry?: string;
  seniority?: string;
  yearsOfExperience?: number;
  normalized: string; // Lowercase combined string for comparison
}

/**
 * Context for calculation (additional info that might influence scoring)
 */
export interface CalculationContext {
  /** Type of match being performed */
  matchType: string;

  /** Is this a batch calculation (lighter processing) */
  isBatch?: boolean;

  /** Skip LLM enhancements for speed */
  skipLlmEnhancement?: boolean;

  /** Include raw calculation data for debugging */
  includeRawData?: boolean;

  /** User's configured criterion weights (overrides) */
  criterionWeights?: Record<string, number>;
}

/**
 * Result from a criterion calculation
 */
export interface CriterionResult {
  /** Unique identifier for this criterion */
  id: string;

  /** Display name */
  name: string;

  /** Icon/emoji for display */
  icon: string;

  /** Score 0-100 */
  score: number;

  /** Derived status from score */
  status: MatchStatus;

  /** Importance level */
  importance: CriterionImportance;

  /** How the values relate */
  matchType: MatchType;

  /** Explanation with quoted values */
  explanation: CriterionExplanation;

  /** Optional raw calculation data */
  rawData?: {
    sourceValues: string[];
    targetValues: string[];
    matchedCount: number;
    totalCount: number;
    additionalData?: Record<string, any>;
  };
}

/**
 * Criterion Calculator Interface
 *
 * Each criterion type (Education, Skills, etc.) implements this interface.
 */
export interface ICriterionCalculator {
  /**
   * Unique identifier for this criterion
   * e.g., 'education', 'skills', 'industry'
   */
  readonly id: string;

  /**
   * Display name for the criterion
   * e.g., 'Education', 'Technical Skills'
   */
  readonly name: string;

  /**
   * Icon/emoji for display
   * e.g., '🎓', '💼', '🏢'
   */
  readonly icon: string;

  /**
   * Default importance level
   * Can be overridden by context
   */
  readonly defaultImportance: CriterionImportance;

  /**
   * Which match types this criterion applies to
   * e.g., ['PROFILE_TO_PROFILE', 'JOB_TO_CANDIDATE']
   */
  readonly applicableMatchTypes: string[];

  /**
   * Calculate the criterion score between source and target
   *
   * @param source - Source profile (e.g., user, project)
   * @param target - Target profile (e.g., contact, candidate)
   * @param context - Calculation context
   * @returns CriterionResult with score, explanation, etc.
   */
  calculate(
    source: MatchingProfile,
    target: MatchingProfile,
    context: CalculationContext
  ): Promise<CriterionResult>;

  /**
   * Check if this criterion is applicable for the given match type
   */
  isApplicable(matchType: string): boolean;

  /**
   * Get the importance level for a specific match type
   * (may vary by match type)
   */
  getImportance(matchType: string): CriterionImportance;
}

/**
 * Abstract base class providing common functionality for criterion calculators
 */
export abstract class BaseCriterionCalculator implements ICriterionCalculator {
  abstract readonly id: string;
  abstract readonly name: string;
  abstract readonly icon: string;
  abstract readonly defaultImportance: CriterionImportance;
  abstract readonly applicableMatchTypes: string[];

  abstract calculate(
    source: MatchingProfile,
    target: MatchingProfile,
    context: CalculationContext
  ): Promise<CriterionResult>;

  isApplicable(matchType: string): boolean {
    return this.applicableMatchTypes.includes(matchType) ||
           this.applicableMatchTypes.includes('ALL');
  }

  getImportance(matchType: string): CriterionImportance {
    // Subclasses can override for match-type-specific importance
    return this.defaultImportance;
  }

  /**
   * Convert score to status
   */
  protected scoreToStatus(score: number): MatchStatus {
    if (score >= 95) return 'PERFECT';
    if (score >= 80) return 'EXCELLENT';
    if (score >= 60) return 'STRONG';
    if (score >= 40) return 'MODERATE';
    if (score >= 20) return 'WEAK';
    return 'NO_MATCH';
  }

  /**
   * Calculate Jaccard similarity between two sets
   */
  protected calculateJaccard(set1: Set<string>, set2: Set<string>): number {
    if (set1.size === 0 && set2.size === 0) return 0;
    if (set1.size === 0 || set2.size === 0) return 0;

    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);

    return (intersection.size / union.size) * 100;
  }

  /**
   * Calculate overlap percentage (intersection / min size)
   */
  protected calculateOverlapPercentage(arr1: string[], arr2: string[]): number {
    if (arr1.length === 0 || arr2.length === 0) return 0;

    const set1 = new Set(arr1.map(s => s.toLowerCase()));
    const set2 = new Set(arr2.map(s => s.toLowerCase()));

    const intersection = [...set1].filter(x => set2.has(x));
    const minSize = Math.min(set1.size, set2.size);

    return (intersection.length / minSize) * 100;
  }

  /**
   * Find matching items between two arrays
   */
  protected findMatches(arr1: string[], arr2: string[]): string[] {
    const set2 = new Set(arr2.map(s => s.toLowerCase()));
    return arr1.filter(item => set2.has(item.toLowerCase()));
  }

  /**
   * Determine match type based on similarity
   */
  protected determineMatchType(score: number, hasExactMatches: boolean): MatchType {
    if (hasExactMatches && score >= 95) return 'EXACT';
    if (score >= 40) return 'PARTIAL';
    return 'NONE';
  }

  /**
   * Build a standard criterion result
   */
  protected buildResult(
    score: number,
    matchType: MatchType,
    explanation: CriterionExplanation,
    context: CalculationContext,
    rawData?: CriterionResult['rawData']
  ): CriterionResult {
    return {
      id: this.id,
      name: this.name,
      icon: this.icon,
      score: Math.round(score),
      status: this.scoreToStatus(score),
      importance: this.getImportance(context.matchType),
      matchType,
      explanation,
      rawData: context.includeRawData ? rawData : undefined,
    };
  }
}

export default ICriterionCalculator;
