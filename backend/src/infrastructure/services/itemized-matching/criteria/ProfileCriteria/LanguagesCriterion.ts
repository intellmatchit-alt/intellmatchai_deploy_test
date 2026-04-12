/**
 * Languages Criterion Calculator
 *
 * Calculates match score based on common languages spoken.
 * Common languages = higher score for communication potential.
 *
 * Note: Currently returns "data not available" as language data
 * is not stored in the User/Contact schema.
 *
 * @module infrastructure/services/itemized-matching/criteria/ProfileCriteria/LanguagesCriterion
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
 * Common language variations/aliases
 */
const LANGUAGE_ALIASES: Record<string, string[]> = {
  'english': ['en', 'eng'],
  'arabic': ['ar', 'ara', 'عربي'],
  'french': ['fr', 'fra', 'français'],
  'spanish': ['es', 'spa', 'español'],
  'german': ['de', 'deu', 'deutsch'],
  'chinese': ['zh', 'mandarin', 'cantonese', '中文'],
  'japanese': ['ja', 'jpn', '日本語'],
  'hindi': ['hi', 'hin', 'हिंदी'],
  'portuguese': ['pt', 'por', 'português'],
  'russian': ['ru', 'rus', 'русский'],
};

export class LanguagesCriterion extends BaseCriterionCalculator {
  readonly id = 'languages';
  readonly name = 'Languages';
  readonly icon = '🗣️';
  readonly defaultImportance: CriterionImportance = 'LOW';
  readonly applicableMatchTypes = [
    'PROFILE_TO_PROFILE',
    'PROFILE_TO_USER',
    'EVENT_ATTENDEE_MATCH',
  ];

  /**
   * Extract languages from profile
   * Tries multiple sources: languages field, enrichmentData, bio parsing
   */
  private extractLanguages(profile: MatchingProfile): string[] {
    const languages: string[] = [];

    // Check direct languages field
    if (profile.languages && profile.languages.length > 0) {
      languages.push(...profile.languages.map(l => normalizeString(l)));
    }

    // Check enrichmentData
    const enrichment = profile.rawData?.enrichmentData;
    if (enrichment) {
      const parsed = typeof enrichment === 'string' ?
        this.safeJsonParse(enrichment) : enrichment;

      if (parsed) {
        const langPaths = [
          parsed.languages,
          parsed.spoken_languages,
          parsed.language_skills,
        ];

        for (const langData of langPaths) {
          if (Array.isArray(langData)) {
            languages.push(...langData.map((l: any) =>
              normalizeString(typeof l === 'string' ? l : l.name || l.language || '')
            ));
          }
        }
      }
    }

    // Try to infer from location (basic heuristic)
    if (languages.length === 0 && profile.location) {
      const location = normalizeString(profile.location);
      if (location.includes('uae') || location.includes('dubai') || location.includes('saudi') || location.includes('egypt')) {
        languages.push('arabic', 'english');
      } else if (location.includes('usa') || location.includes('uk') || location.includes('australia')) {
        languages.push('english');
      } else if (location.includes('france') || location.includes('paris')) {
        languages.push('french', 'english');
      } else if (location.includes('germany') || location.includes('berlin')) {
        languages.push('german', 'english');
      }
    }

    return [...new Set(languages.filter(Boolean))];
  }

  private safeJsonParse(str: string): any {
    try {
      return JSON.parse(str);
    } catch {
      return null;
    }
  }

  /**
   * Normalize language name using aliases
   */
  private normalizeLanguage(lang: string): string {
    const normalized = normalizeString(lang);

    for (const [canonical, aliases] of Object.entries(LANGUAGE_ALIASES)) {
      if (normalized === canonical || aliases.includes(normalized)) {
        return canonical;
      }
    }

    return normalized;
  }

  async calculate(
    source: MatchingProfile,
    target: MatchingProfile,
    context: CalculationContext
  ): Promise<CriterionResult> {
    const sourceLanguages = this.extractLanguages(source).map(l => this.normalizeLanguage(l));
    const targetLanguages = this.extractLanguages(target).map(l => this.normalizeLanguage(l));

    // Handle missing language data
    if (sourceLanguages.length === 0 || targetLanguages.length === 0) {
      return this.buildResult(
        0,
        'NONE',
        {
          summary: 'Language data not available',
          sourceValue: sourceLanguages.length > 0 ? sourceLanguages.join(', ') : 'Languages not specified',
          targetValue: targetLanguages.length > 0 ? targetLanguages.join(', ') : 'Languages not specified',
          matchType: 'NONE',
          details: ['⚠️ Language information not available in profiles'],
        },
        context,
        {
          sourceValues: sourceLanguages,
          targetValues: targetLanguages,
          matchedCount: 0,
          totalCount: 0,
        }
      );
    }

    // Find common languages
    const commonLanguages = findCommonItems(sourceLanguages, targetLanguages);

    // Calculate score
    let score = 0;
    let matchType: MatchType = 'NONE';
    const details: string[] = [];

    if (commonLanguages.length >= 3) {
      score = 100;
      matchType = 'EXACT';
      details.push(`✅ ${commonLanguages.length} common languages: ${commonLanguages.join(', ')}`);
    } else if (commonLanguages.length === 2) {
      score = 85;
      matchType = 'PARTIAL';
      details.push(`✅ 2 common languages: ${commonLanguages.join(', ')}`);
    } else if (commonLanguages.length === 1) {
      score = 60;
      matchType = 'PARTIAL';
      details.push(`✅ 1 common language: ${commonLanguages[0]}`);
    } else {
      details.push(`❌ No common languages found`);
    }

    const summary = commonLanguages.length > 0
      ? `Common: ${commonLanguages.join(', ')}`
      : 'No common languages';

    return this.buildResult(
      score,
      matchType,
      {
        summary,
        sourceValue: `${source.name}: ${sourceLanguages.join(', ')}`,
        targetValue: `${target.name}: ${targetLanguages.join(', ')}`,
        matchType,
        details,
      },
      context,
      {
        sourceValues: sourceLanguages,
        targetValues: targetLanguages,
        matchedCount: commonLanguages.length,
        totalCount: Math.max(sourceLanguages.length, targetLanguages.length),
        additionalData: { commonLanguages },
      }
    );
  }
}

export default LanguagesCriterion;
