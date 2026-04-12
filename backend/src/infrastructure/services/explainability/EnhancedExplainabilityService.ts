/**
 * Enhanced Explainability Service
 *
 * Provides template-driven, transparent match explanations.
 * Generates per-criterion explanations, skill gap analysis,
 * and profile improvement suggestions.
 *
 * @module infrastructure/services/explainability/EnhancedExplainabilityService
 */

import { scoreToStatus, calculateConfidence, type MatchQuality } from '../../../shared/matching';
import { skillTaxonomyService, type SkillMatchResult, SkillMatchType } from '../taxonomy';
import { experienceParsingService } from '../experience';
import {
  CriterionType,
  getTier,
  EXPLANATION_TEMPLATES,
  renderTemplate,
} from './templates';

// ============================================================================
// Types
// ============================================================================

export interface CriteriaScore {
  type: CriterionType;
  score: number;
  rawData?: Record<string, any>;
}

export interface ExplainedCriterion {
  type: CriterionType;
  score: number;
  status: string;
  explanation: string;
  details?: string[];
}

export interface ExplainableMatchResult {
  overallScore: number;
  confidence: number;
  matchQuality: MatchQuality;
  criteria: ExplainedCriterion[];
  topStrengths: string[];
  topConcerns: string[];
  profileImprovements: ImprovementSuggestion[];
  skillGap?: SkillGapReport;
}

export interface SkillGapReport {
  matchedSkills: Array<{ source: string; target: string; matchType: string; score: number }>;
  missingSkills: string[];
  learnableSkills: string[];
  complementarySkills: string[];
}

export interface ImprovementSuggestion {
  category: string;
  suggestion: string;
  impact: 'HIGH' | 'MEDIUM' | 'LOW';
  estimatedImpact: number; // estimated score increase, 1-25
  effort: 'LOW' | 'MEDIUM' | 'HIGH';
}

// ============================================================================
// Service
// ============================================================================

export class EnhancedExplainabilityService {
  /**
   * Generate a full explainable match result
   */
  generateExplanation(
    criteriaScores: CriteriaScore[],
    sourceProfile: {
      skills?: string[];
      sectors?: string[];
      goals?: string[];
      bio?: string;
      jobTitle?: string;
      interests?: string[];
      hobbies?: string[];
    },
    targetProfile: {
      skills?: string[];
      sectors?: string[];
      goals?: string[];
      bio?: string;
      jobTitle?: string;
      interests?: string[];
      hobbies?: string[];
    }
  ): ExplainableMatchResult {
    // Generate per-criterion explanations
    const criteria = criteriaScores.map(cs => this.explainCriterion(cs));

    // Calculate overall score
    const overallScore = criteriaScores.length > 0
      ? Math.round(criteriaScores.reduce((sum, cs) => sum + cs.score, 0) / criteriaScores.length)
      : 0;

    // Calculate confidence
    const confidenceResult = calculateConfidence(
      {
        hasSectors: (sourceProfile.sectors?.length ?? 0) > 0,
        hasSkills: (sourceProfile.skills?.length ?? 0) > 0,
        hasGoals: (sourceProfile.goals?.length ?? 0) > 0,
        hasBio: !!sourceProfile.bio,
        hasInterests: (sourceProfile.interests?.length ?? 0) > 0,
        hasHobbies: (sourceProfile.hobbies?.length ?? 0) > 0,
      },
      {
        hasSectors: (targetProfile.sectors?.length ?? 0) > 0,
        hasSkills: (targetProfile.skills?.length ?? 0) > 0,
        hasGoals: (targetProfile.goals?.length ?? 0) > 0,
        hasBio: !!targetProfile.bio,
        hasInterests: (targetProfile.interests?.length ?? 0) > 0,
        hasHobbies: (targetProfile.hobbies?.length ?? 0) > 0,
      }
    );

    // Identify strengths and concerns
    const sorted = [...criteria].sort((a, b) => b.score - a.score);
    const topStrengths = sorted
      .filter(c => c.score >= 60)
      .slice(0, 3)
      .map(c => c.explanation);

    const topConcerns = sorted
      .filter(c => c.score < 40)
      .slice(0, 3)
      .map(c => c.explanation);

    // Generate improvement suggestions
    const profileImprovements = this.generateImprovementSuggestions(
      sourceProfile,
      criteria,
      confidenceResult.factors
    );

    // Generate skill gap if skills are available
    let skillGap: SkillGapReport | undefined;
    if (sourceProfile.skills && targetProfile.skills) {
      skillGap = this.generateSkillGapAnalysis(sourceProfile.skills, targetProfile.skills);
    }

    return {
      overallScore,
      confidence: confidenceResult.confidence,
      matchQuality: confidenceResult.matchQuality,
      criteria,
      topStrengths,
      topConcerns,
      profileImprovements,
      skillGap,
    };
  }

  /**
   * Generate explanation for a single criterion
   */
  private explainCriterion(cs: CriteriaScore): ExplainedCriterion {
    const tier = getTier(cs.score);
    const status = scoreToStatus(cs.score);
    const template = EXPLANATION_TEMPLATES[cs.type]?.[tier] || '';
    const vars = cs.rawData || {};

    return {
      type: cs.type,
      score: cs.score,
      status,
      explanation: renderTemplate(template, vars),
      details: vars.details as string[] | undefined,
    };
  }

  /**
   * Generate skill gap analysis between two skill sets
   */
  generateSkillGapAnalysis(
    sourceSkills: string[],
    targetSkills: string[]
  ): SkillGapReport {
    const result = skillTaxonomyService.calculateSkillScore(sourceSkills, targetSkills);

    const matchedSkills = result.matches.map(m => ({
      source: m.sourceSkill,
      target: m.targetSkill,
      matchType: m.matchType,
      score: m.score,
    }));

    // Missing skills = target skills not matched at all
    const missingSkills = result.unmatchedTarget;

    // Learnable skills = related to existing source skills
    const learnableSkills: string[] = [];
    for (const missing of missingSkills) {
      const related = skillTaxonomyService.getRelatedSkills(missing);
      const hasRelated = related.some(r =>
        sourceSkills.some(s => s.toLowerCase() === r.toLowerCase())
      );
      if (hasRelated) {
        learnableSkills.push(missing);
      }
    }

    // Complementary skills = would enhance the source profile
    const complementarySkills: string[] = [];
    for (const sourceSkill of sourceSkills) {
      const complements = skillTaxonomyService.getComplementarySkills(sourceSkill);
      for (const comp of complements) {
        if (
          !sourceSkills.some(s => s.toLowerCase() === comp.toLowerCase()) &&
          !complementarySkills.includes(comp)
        ) {
          complementarySkills.push(comp);
        }
      }
    }

    return {
      matchedSkills,
      missingSkills,
      learnableSkills,
      complementarySkills: complementarySkills.slice(0, 10),
    };
  }

  /**
   * Generate profile improvement suggestions
   */
  generateImprovementSuggestions(
    profile: {
      skills?: string[];
      sectors?: string[];
      goals?: string[];
      bio?: string;
      jobTitle?: string;
    },
    criteria: ExplainedCriterion[],
    confidenceFactors: string[]
  ): ImprovementSuggestion[] {
    const suggestions: ImprovementSuggestion[] = [];

    // Check for missing profile data
    if (!profile.bio || profile.bio.length < 50) {
      suggestions.push({
        category: 'Profile',
        suggestion: 'Add a detailed bio (at least 50 characters) to improve AI semantic matching by up to 25%',
        impact: 'HIGH',
        estimatedImpact: 15,
        effort: 'LOW',
      });
    }

    if (!profile.skills || profile.skills.length < 3) {
      suggestions.push({
        category: 'Skills',
        suggestion: 'Add at least 3 skills to your profile for better skill-based matching',
        impact: 'HIGH',
        estimatedImpact: 20,
        effort: 'LOW',
      });
    }

    if (!profile.sectors || profile.sectors.length === 0) {
      suggestions.push({
        category: 'Sectors',
        suggestion: 'Select your industry sectors to find contacts in similar fields',
        impact: 'HIGH',
        estimatedImpact: 12,
        effort: 'LOW',
      });
    }

    if (!profile.goals || profile.goals.length === 0) {
      suggestions.push({
        category: 'Goals',
        suggestion: 'Set your professional goals to match with people who can help you achieve them',
        impact: 'MEDIUM',
        estimatedImpact: 8,
        effort: 'LOW',
      });
    }

    // Criterion-based suggestions
    const weakCriteria = criteria.filter(c => c.score < 30);
    for (const weak of weakCriteria.slice(0, 2)) {
      if (weak.type === CriterionType.SKILL_MATCH) {
        suggestions.push({
          category: 'Skills',
          suggestion: 'Expand your skills list to include related technologies and methodologies',
          impact: 'MEDIUM',
          estimatedImpact: 10,
          effort: 'MEDIUM',
        });
      }
      if (weak.type === CriterionType.SECTOR_MATCH) {
        suggestions.push({
          category: 'Sectors',
          suggestion: 'Consider adding adjacent industry sectors to broaden your matching',
          impact: 'MEDIUM',
          estimatedImpact: 8,
          effort: 'MEDIUM',
        });
      }
    }

    // Deduplicate by category
    const seen = new Set<string>();
    return suggestions.filter(s => {
      const key = `${s.category}:${s.suggestion.substring(0, 30)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
}

// Export singleton instance
export const enhancedExplainabilityService = new EnhancedExplainabilityService();
