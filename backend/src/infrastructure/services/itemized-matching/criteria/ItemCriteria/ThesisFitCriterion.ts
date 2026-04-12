/**
 * Thesis Fit Criterion Calculator
 *
 * Calculates match score based on semantic alignment between project and investor thesis.
 * Compares project summary/keywords with investor focus areas.
 *
 * @module infrastructure/services/itemized-matching/criteria/ItemCriteria/ThesisFitCriterion
 */

import {
  BaseCriterionCalculator,
  MatchingProfile,
  CalculationContext,
  CriterionResult,
} from '../../interfaces/ICriterionCalculator';
import { CriterionImportance, MatchType } from '../../../../../domain/services/IItemizedMatchingService';
import { normalizeString, findCommonItems } from '../../utils/ScoreUtils';

/**
 * Thesis-related keywords and themes
 */
const THESIS_THEMES: Record<string, string[]> = {
  'ai/ml': ['artificial intelligence', 'machine learning', 'deep learning', 'nlp', 'computer vision', 'generative ai', 'llm', 'neural network'],
  'fintech': ['financial technology', 'payments', 'banking', 'lending', 'insurance', 'insurtech', 'regtech', 'blockchain', 'crypto', 'defi'],
  'healthtech': ['healthcare', 'medical', 'biotech', 'digital health', 'telemedicine', 'health tech', 'wellness', 'medtech'],
  'edtech': ['education', 'learning', 'training', 'e-learning', 'online courses', 'skill development'],
  'sustainability': ['climate', 'cleantech', 'renewable', 'green', 'sustainable', 'carbon', 'esg', 'circular economy'],
  'b2b saas': ['saas', 'enterprise software', 'b2b', 'software as a service', 'cloud software', 'business software'],
  'marketplace': ['marketplace', 'platform', 'two-sided', 'network effects', 'aggregator'],
  'consumer': ['consumer', 'b2c', 'd2c', 'retail', 'e-commerce', 'direct to consumer'],
  'deep tech': ['deep tech', 'hardware', 'robotics', 'quantum', 'semiconductors', 'iot', 'space tech'],
  'proptech': ['real estate', 'property', 'proptech', 'construction tech', 'smart buildings'],
};

export class ThesisFitCriterion extends BaseCriterionCalculator {
  readonly id = 'thesis_fit';
  readonly name = 'Thesis Fit';
  readonly icon = '📋';
  readonly defaultImportance: CriterionImportance = 'HIGH';
  readonly applicableMatchTypes = [
    'PROJECT_TO_INVESTOR',
    'PROJECT_TO_PARTNER',
    'PROJECT_TO_DYNAMIC',
  ];

  /**
   * Extract project themes from summary and keywords
   */
  private extractProjectThemes(profile: MatchingProfile): {
    keywords: string[];
    themes: string[];
    summary: string;
  } {
    const keywords: string[] = [];
    const themes: string[] = [];

    // Extract from rawData keywords (JSON array)
    const rawKeywords = profile.rawData?.keywords;
    if (rawKeywords) {
      const parsed = typeof rawKeywords === 'string' ?
        this.safeJsonParse(rawKeywords) : rawKeywords;

      if (Array.isArray(parsed)) {
        keywords.push(...parsed.map((k: any) => normalizeString(typeof k === 'string' ? k : k.name || '')));
      }
    }

    // Extract from requiredSkills
    if (profile.requiredSkills) {
      keywords.push(...profile.requiredSkills.map(s => normalizeString(s)));
    }

    // Extract from sectors
    keywords.push(...profile.sectors.map(s => normalizeString(s)));

    // Identify themes from bio/summary
    const textToAnalyze = [profile.bio || '', profile.rawData?.summary || '', profile.rawData?.detailedDesc || '']
      .join(' ').toLowerCase();

    for (const [theme, themeKeywords] of Object.entries(THESIS_THEMES)) {
      for (const kw of themeKeywords) {
        if (textToAnalyze.includes(kw)) {
          themes.push(theme);
          break;
        }
      }
    }

    return {
      keywords: [...new Set(keywords.filter(Boolean))],
      themes: [...new Set(themes)],
      summary: textToAnalyze.slice(0, 500),
    };
  }

  /**
   * Extract investor thesis/focus areas
   */
  private extractInvestorThesis(profile: MatchingProfile): {
    focusAreas: string[];
    themes: string[];
    thesisStatement: string;
  } {
    const focusAreas: string[] = [];
    const themes: string[] = [];
    let thesisStatement = '';

    // Check thesisFocus field
    if (profile.thesisFocus) {
      focusAreas.push(...profile.thesisFocus.map(t => normalizeString(t)));
    }

    // Check enrichmentData
    const enrichment = profile.rawData?.enrichmentData;
    if (enrichment) {
      const parsed = typeof enrichment === 'string' ?
        this.safeJsonParse(enrichment) : enrichment;

      if (parsed) {
        const thesisPaths = [
          parsed.thesis,
          parsed.investmentThesis,
          parsed.investment_thesis,
          parsed.focus_areas,
          parsed.portfolio_themes,
        ];

        for (const thesisData of thesisPaths) {
          if (Array.isArray(thesisData)) {
            focusAreas.push(...thesisData.map((t: any) => normalizeString(typeof t === 'string' ? t : t.name || '')));
          } else if (typeof thesisData === 'string') {
            thesisStatement = thesisData;
            focusAreas.push(normalizeString(thesisData));
          }
        }
      }
    }

    // Add sectors
    focusAreas.push(...profile.sectors.map(s => normalizeString(s)));

    // Extract themes from bio
    const textToAnalyze = [profile.bio || '', thesisStatement].join(' ').toLowerCase();

    for (const [theme, themeKeywords] of Object.entries(THESIS_THEMES)) {
      for (const kw of themeKeywords) {
        if (textToAnalyze.includes(kw)) {
          themes.push(theme);
          break;
        }
      }
    }

    return {
      focusAreas: [...new Set(focusAreas.filter(Boolean))],
      themes: [...new Set(themes)],
      thesisStatement,
    };
  }

  private safeJsonParse(str: string): any {
    try {
      return JSON.parse(str);
    } catch {
      return null;
    }
  }

  /**
   * Calculate semantic similarity between project and investor
   */
  private calculateThesisMatch(
    project: { keywords: string[]; themes: string[]; summary: string },
    investor: { focusAreas: string[]; themes: string[]; thesisStatement: string }
  ): {
    score: number;
    keywordMatches: string[];
    themeMatches: string[];
  } {
    // Find keyword matches
    const keywordMatches = findCommonItems(project.keywords, investor.focusAreas);

    // Find theme matches
    const themeMatches = findCommonItems(project.themes, investor.themes);

    // Calculate score
    let score = 0;

    // Theme matches are highly valued
    if (themeMatches.length > 0) {
      score += Math.min(50, themeMatches.length * 25);
    }

    // Keyword/focus area matches
    if (keywordMatches.length > 0) {
      score += Math.min(50, keywordMatches.length * 15);
    }

    // Bonus for multiple types of matches
    if (themeMatches.length > 0 && keywordMatches.length > 0) {
      score = Math.min(100, score + 10);
    }

    return {
      score: Math.min(100, score),
      keywordMatches,
      themeMatches,
    };
  }

  async calculate(
    source: MatchingProfile,
    target: MatchingProfile,
    context: CalculationContext
  ): Promise<CriterionResult> {
    // Source is project, target is investor
    const projectData = this.extractProjectThemes(source);
    const investorData = this.extractInvestorThesis(target);

    // Handle insufficient data
    if (projectData.keywords.length === 0 && projectData.themes.length === 0) {
      return this.buildResult(
        20,
        'NONE',
        {
          summary: 'Project details insufficient',
          sourceValue: 'Limited project information',
          targetValue: investorData.focusAreas.length > 0 ? investorData.focusAreas.join(', ') : 'No thesis data',
          matchType: 'NONE',
          details: ['⚠️ Cannot evaluate thesis fit without project keywords/summary'],
        },
        context,
        { sourceValues: [], targetValues: investorData.focusAreas, matchedCount: 0, totalCount: 0 }
      );
    }

    if (investorData.focusAreas.length === 0 && investorData.themes.length === 0) {
      return this.buildResult(
        40,
        'PARTIAL',
        {
          summary: 'Investor thesis unknown',
          sourceValue: `Project themes: ${projectData.themes.join(', ') || projectData.keywords.slice(0, 3).join(', ')}`,
          targetValue: 'Investment thesis not specified',
          matchType: 'PARTIAL',
          details: ['⚠️ Investor investment thesis not available'],
        },
        context,
        { sourceValues: projectData.keywords, targetValues: [], matchedCount: 0, totalCount: 1 }
      );
    }

    const match = this.calculateThesisMatch(projectData, investorData);

    const details: string[] = [];
    let summary = '';
    let matchType: MatchType = 'NONE';

    if (match.score >= 80) {
      matchType = 'EXACT';
      summary = `Strong thesis alignment`;
    } else if (match.score >= 50) {
      matchType = 'PARTIAL';
      summary = `Good thesis fit`;
    } else if (match.score >= 30) {
      matchType = 'PARTIAL';
      summary = `Some thesis overlap`;
    } else {
      summary = `Limited thesis alignment`;
    }

    if (match.themeMatches.length > 0) {
      details.push(`✅ Shared themes: ${match.themeMatches.join(', ')}`);
    }
    if (match.keywordMatches.length > 0) {
      details.push(`✅ Matching focus areas: ${match.keywordMatches.slice(0, 3).join(', ')}`);
    }
    if (details.length === 0) {
      details.push(`❌ No clear thesis alignment found`);
    }

    return this.buildResult(
      match.score,
      matchType,
      {
        summary,
        sourceValue: `Project: ${projectData.themes.concat(projectData.keywords.slice(0, 3)).join(', ')}`,
        targetValue: `${target.name}: ${investorData.themes.concat(investorData.focusAreas.slice(0, 3)).join(', ')}`,
        matchType,
        details,
      },
      context,
      {
        sourceValues: [...projectData.themes, ...projectData.keywords],
        targetValues: [...investorData.themes, ...investorData.focusAreas],
        matchedCount: match.keywordMatches.length + match.themeMatches.length,
        totalCount: Math.max(projectData.themes.length + projectData.keywords.length, 1),
        additionalData: { projectData, investorData, match },
      }
    );
  }
}

export default ThesisFitCriterion;
