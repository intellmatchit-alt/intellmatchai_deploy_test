/**
 * Complementary Goals Criterion Calculator (Event-Specific)
 *
 * CRITICAL criterion for event matching.
 * Matches what one attendee is "looking for" with what another can "offer".
 *
 * This is the most important criterion for event networking.
 * A seeking what B offers = 100% PERFECT MATCH
 *
 * @module infrastructure/services/itemized-matching/criteria/EventCriteria/ComplementaryGoalsCriterion
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
 * Keywords that indicate what someone is looking for
 */
const LOOKING_FOR_KEYWORDS: Record<string, string[]> = {
  investor: ['investor', 'investment', 'funding', 'capital', 'angel', 'vc', 'seed', 'series'],
  cofounder: ['cofounder', 'co-founder', 'partner', 'founding team', 'founding partner'],
  mentor: ['mentor', 'mentorship', 'advisor', 'guidance', 'advice'],
  talent: ['hiring', 'talent', 'developer', 'engineer', 'designer', 'marketer', 'recruit'],
  job: ['job', 'opportunity', 'position', 'role', 'employment', 'career'],
  client: ['client', 'customer', 'buyer', 'sales', 'business'],
  partner: ['partner', 'partnership', 'collaboration', 'joint venture', 'strategic partner'],
  networking: ['network', 'connect', 'meet', 'people', 'professionals'],
  learning: ['learn', 'knowledge', 'insights', 'experience', 'understand'],
};

/**
 * Mapping of what someone looking for X would value in a match
 */
const COMPLEMENT_MAPPING: Record<string, string[]> = {
  investor: ['startup', 'founder', 'fundraising', 'business', 'entrepreneur', 'pitch'],
  cofounder: ['technical', 'developer', 'business', 'marketing', 'operations', 'startup'],
  mentor: ['mentor', 'experienced', 'advisor', 'senior', 'founder', 'leader'],
  talent: ['job', 'looking', 'developer', 'designer', 'available', 'freelance'],
  job: ['hiring', 'opportunities', 'positions', 'recruiting', 'team'],
  client: ['service', 'product', 'solution', 'agency', 'consulting', 'provider'],
  partner: ['business', 'company', 'startup', 'service', 'product', 'looking'],
  networking: ['connect', 'networking', 'meet', 'people'],
  learning: ['expert', 'experienced', 'knowledge', 'teach', 'share'],
};

export class ComplementaryGoalsCriterion extends BaseCriterionCalculator {
  readonly id = 'complementary_goals';
  readonly name = 'Complementary Goals';
  readonly icon = '🤝';
  readonly defaultImportance: CriterionImportance = 'CRITICAL';
  readonly applicableMatchTypes = ['EVENT_ATTENDEE_MATCH'];

  /**
   * Extract keywords and identify what the person is looking for
   */
  private extractLookingFor(text: string | undefined): {
    keywords: string[];
    categories: string[];
  } {
    if (!text) return { keywords: [], categories: [] };

    const normalized = normalizeString(text);
    const words = normalized.split(/[\s,;.]+/).filter(w => w.length > 2);

    const categories: string[] = [];

    for (const [category, keywordList] of Object.entries(LOOKING_FOR_KEYWORDS)) {
      for (const keyword of keywordList) {
        if (normalized.includes(keyword)) {
          if (!categories.includes(category)) {
            categories.push(category);
          }
        }
      }
    }

    // Remove common stop words
    const stopWords = new Set(['looking', 'find', 'want', 'need', 'someone', 'for', 'who', 'can', 'help', 'the', 'and', 'with', 'about']);
    const keywords = words.filter(w => !stopWords.has(w));

    return { keywords, categories };
  }

  /**
   * Check if target's profile complements source's looking for
   */
  private findComplements(
    sourceCategories: string[],
    targetText: string | undefined,
    targetProfile: MatchingProfile
  ): { matches: string[]; score: number } {
    const matches: string[] = [];
    let score = 0;

    const targetNormalized = normalizeString(targetText || '');
    const targetBio = normalizeString(targetProfile.bio || '');
    const targetTitle = normalizeString(targetProfile.jobTitle || '');
    const combinedTarget = `${targetNormalized} ${targetBio} ${targetTitle}`;

    for (const category of sourceCategories) {
      const complementKeywords = COMPLEMENT_MAPPING[category] || [];

      for (const keyword of complementKeywords) {
        if (combinedTarget.includes(keyword)) {
          const matchDesc = `"${category}" ↔ "${keyword}"`;
          if (!matches.includes(matchDesc)) {
            matches.push(matchDesc);
            score += 25; // Each complement is worth 25 points
          }
        }
      }
    }

    return { matches, score: Math.min(100, score) };
  }

  async calculate(
    source: MatchingProfile,
    target: MatchingProfile,
    context: CalculationContext
  ): Promise<CriterionResult> {
    const sourceLookingFor = source.lookingFor;
    const targetLookingFor = target.lookingFor;

    // Handle missing data
    if (!sourceLookingFor && !targetLookingFor) {
      return this.buildResult(
        0,
        'NONE',
        {
          summary: 'Neither attendee specified what they are looking for',
          sourceValue: 'Not specified',
          targetValue: 'Not specified',
          matchType: 'NONE',
          details: ['Complete the "Looking for" field to find better matches'],
        },
        context,
        {
          sourceValues: [],
          targetValues: [],
          matchedCount: 0,
          totalCount: 0,
        }
      );
    }

    const sourceExtracted = this.extractLookingFor(sourceLookingFor);
    const targetExtracted = this.extractLookingFor(targetLookingFor);

    // Check bidirectional complements
    const sourceToTarget = this.findComplements(sourceExtracted.categories, targetLookingFor, target);
    const targetToSource = this.findComplements(targetExtracted.categories, sourceLookingFor, source);

    // Also check if their "looking for" keywords overlap (both want the same thing = networking opportunity)
    const sharedKeywords = sourceExtracted.keywords.filter(k =>
      targetExtracted.keywords.some(tk => tk.includes(k) || k.includes(tk))
    );

    // Calculate combined score
    let score = 0;
    let matchType: MatchType = 'NONE';
    const allMatches: string[] = [];

    // Bidirectional complements are most valuable
    if (sourceToTarget.matches.length > 0 || targetToSource.matches.length > 0) {
      // Average the bidirectional scores, with bonus for mutual complementarity
      const avgScore = (sourceToTarget.score + targetToSource.score) / 2;
      const mutualBonus = (sourceToTarget.matches.length > 0 && targetToSource.matches.length > 0) ? 20 : 0;
      score = Math.min(100, avgScore + mutualBonus);
      matchType = 'COMPLEMENTARY';
      allMatches.push(...sourceToTarget.matches, ...targetToSource.matches);
    }

    // Shared keywords add some value
    if (sharedKeywords.length > 0 && score < 100) {
      score = Math.min(100, score + sharedKeywords.length * 10);
      if (matchType === 'NONE') matchType = 'PARTIAL';
    }

    // Build explanation
    const details: string[] = [];

    if (sourceToTarget.matches.length > 0) {
      details.push(`✨ ${source.name} seeks → ${target.name} offers:`);
      for (const match of sourceToTarget.matches.slice(0, 3)) {
        details.push(`   ${match}`);
      }
    }

    if (targetToSource.matches.length > 0) {
      details.push(`✨ ${target.name} seeks → ${source.name} offers:`);
      for (const match of targetToSource.matches.slice(0, 3)) {
        details.push(`   ${match}`);
      }
    }

    if (sharedKeywords.length > 0) {
      details.push(`🔄 Shared interests: ${sharedKeywords.slice(0, 5).join(', ')}`);
    }

    if (details.length === 0) {
      details.push('❌ No complementary goals identified');
      details.push('💡 They may still be a good connection for general networking');
    }

    // Generate summary
    let summary = '';
    if (sourceToTarget.matches.length > 0 && targetToSource.matches.length > 0) {
      summary = 'Mutually beneficial: Both can help each other!';
    } else if (sourceToTarget.matches.length > 0) {
      summary = `${target.name} can help with what ${source.name} is looking for`;
    } else if (targetToSource.matches.length > 0) {
      summary = `${source.name} can help with what ${target.name} is looking for`;
    } else if (sharedKeywords.length > 0) {
      summary = `Both interested in: ${sharedKeywords.slice(0, 3).join(', ')}`;
    } else {
      summary = 'Different networking objectives';
    }

    return this.buildResult(
      score,
      matchType,
      {
        summary,
        sourceValue: sourceLookingFor ? `${source.name} looking for: ${sourceLookingFor}` : 'Not specified',
        targetValue: targetLookingFor ? `${target.name} looking for: ${targetLookingFor}` : 'Not specified',
        matchType,
        details,
      },
      context,
      {
        sourceValues: sourceExtracted.keywords,
        targetValues: targetExtracted.keywords,
        matchedCount: allMatches.length + sharedKeywords.length,
        totalCount: Math.max(sourceExtracted.keywords.length, targetExtracted.keywords.length),
        additionalData: {
          sourceCategories: sourceExtracted.categories,
          targetCategories: targetExtracted.categories,
          sourceToTargetMatches: sourceToTarget.matches,
          targetToSourceMatches: targetToSource.matches,
          sharedKeywords,
        },
      }
    );
  }
}

export default ComplementaryGoalsCriterion;
