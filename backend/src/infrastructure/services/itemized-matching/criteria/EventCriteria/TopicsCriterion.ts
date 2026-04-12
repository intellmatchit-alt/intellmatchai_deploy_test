/**
 * Topics Criterion Calculator
 *
 * Calculates match score based on shared event topics/interests.
 * Shared event topics = conversation starters at networking events.
 *
 * @module infrastructure/services/itemized-matching/criteria/EventCriteria/TopicsCriterion
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
 * Common networking event topics
 */
const TOPIC_CATEGORIES: Record<string, string[]> = {
  'technology': ['ai', 'ml', 'blockchain', 'cloud', 'saas', 'fintech', 'cybersecurity', 'data', 'software'],
  'business': ['startup', 'entrepreneurship', 'investment', 'funding', 'venture capital', 'growth', 'strategy'],
  'leadership': ['leadership', 'management', 'ceo', 'founder', 'executive', 'team building'],
  'innovation': ['innovation', 'disruption', 'digital transformation', 'future', 'trends'],
  'sustainability': ['sustainability', 'esg', 'climate', 'green', 'impact', 'social enterprise'],
  'marketing': ['marketing', 'branding', 'growth hacking', 'sales', 'customer', 'product'],
};

export class TopicsCriterion extends BaseCriterionCalculator {
  readonly id = 'topics';
  readonly name = 'Shared Topics';
  readonly icon = '💬';
  readonly defaultImportance: CriterionImportance = 'MEDIUM';
  readonly applicableMatchTypes = [
    'EVENT_ATTENDEE_MATCH',
  ];

  /**
   * Extract topics from attendee profile
   * Parses from bio, lookingFor, interests, and sectors
   */
  private extractTopics(profile: MatchingProfile): string[] {
    const topics: string[] = [];

    // Get from interests
    topics.push(...profile.interests.map(i => normalizeString(i)));

    // Get from sectors
    topics.push(...profile.sectors.map(s => normalizeString(s)));

    // Parse from bio
    if (profile.bio) {
      const bio = normalizeString(profile.bio);
      for (const [category, keywords] of Object.entries(TOPIC_CATEGORIES)) {
        for (const keyword of keywords) {
          if (bio.includes(keyword)) {
            topics.push(category);
            topics.push(keyword);
          }
        }
      }
    }

    // Parse from lookingFor
    if (profile.lookingFor) {
      const lookingFor = normalizeString(profile.lookingFor);
      for (const [category, keywords] of Object.entries(TOPIC_CATEGORIES)) {
        for (const keyword of keywords) {
          if (lookingFor.includes(keyword)) {
            topics.push(category);
          }
        }
      }
    }

    // Parse from canOffer
    if (profile.canOffer) {
      const canOffer = normalizeString(profile.canOffer);
      for (const [category, keywords] of Object.entries(TOPIC_CATEGORIES)) {
        for (const keyword of keywords) {
          if (canOffer.includes(keyword)) {
            topics.push(category);
          }
        }
      }
    }

    return [...new Set(topics.filter(Boolean))];
  }

  async calculate(
    source: MatchingProfile,
    target: MatchingProfile,
    context: CalculationContext
  ): Promise<CriterionResult> {
    const sourceTopics = this.extractTopics(source);
    const targetTopics = this.extractTopics(target);

    // Handle missing topic data
    if (sourceTopics.length === 0 || targetTopics.length === 0) {
      return this.buildResult(
        0,
        'NONE',
        {
          summary: 'Topic data not available',
          sourceValue: sourceTopics.length > 0 ? sourceTopics.slice(0, 5).join(', ') : 'Topics not specified',
          targetValue: targetTopics.length > 0 ? targetTopics.slice(0, 5).join(', ') : 'Topics not specified',
          matchType: 'NONE',
          details: ['⚠️ Not enough topic information for matching'],
        },
        context,
        {
          sourceValues: sourceTopics,
          targetValues: targetTopics,
          matchedCount: 0,
          totalCount: 0,
        }
      );
    }

    // Find common topics
    const commonTopics = findCommonItems(sourceTopics, targetTopics);

    // Calculate score based on overlap
    const overlapRatio = commonTopics.length / Math.min(sourceTopics.length, targetTopics.length);
    let score = Math.min(100, Math.round(overlapRatio * 100));
    let matchType: MatchType = 'NONE';
    const details: string[] = [];

    if (score >= 80 || commonTopics.length >= 5) {
      score = Math.max(score, 90);
      matchType = 'EXACT';
      details.push(`✅ Strong topic alignment: ${commonTopics.slice(0, 5).join(', ')}`);
    } else if (score >= 50 || commonTopics.length >= 3) {
      matchType = 'PARTIAL';
      details.push(`✅ Shared topics: ${commonTopics.slice(0, 4).join(', ')}`);
    } else if (commonTopics.length >= 1) {
      score = Math.max(score, 40);
      matchType = 'PARTIAL';
      details.push(`🔄 Some common interests: ${commonTopics.join(', ')}`);
    } else {
      details.push(`❌ No shared topics found`);
    }

    // Add conversation starter suggestion
    if (commonTopics.length > 0) {
      details.push(`💬 Conversation starter: Discuss ${commonTopics[0]}`);
    }

    const summary = commonTopics.length > 0
      ? `${commonTopics.length} shared topic${commonTopics.length > 1 ? 's' : ''}: ${commonTopics.slice(0, 3).join(', ')}`
      : 'No shared topics';

    return this.buildResult(
      score,
      matchType,
      {
        summary,
        sourceValue: `${source.name}: ${sourceTopics.slice(0, 5).join(', ')}`,
        targetValue: `${target.name}: ${targetTopics.slice(0, 5).join(', ')}`,
        matchType,
        details,
      },
      context,
      {
        sourceValues: sourceTopics,
        targetValues: targetTopics,
        matchedCount: commonTopics.length,
        totalCount: Math.max(sourceTopics.length, targetTopics.length),
        additionalData: { commonTopics },
      }
    );
  }
}

export default TopicsCriterion;
