/**
 * PNME Pitch Matching Service
 *
 * Implements the hybrid matching algorithm combining:
 * - Semantic similarity (40%) via embeddings
 * - Rule-based scoring (60%) via keyword/expertise matching
 *
 * @module infrastructure/services/pitch/PitchMatchingService
 */

import { embeddingService, ProfileEmbeddingInput } from '../../external/embedding/EmbeddingService';
import { ContactProfileDTO, ComputedMatchDTO, MatchWeightsDTO } from '../../../application/dto/pitch.dto';
import { PitchSectionType, MatchBreakdown, MatchReason, MatchAngleCategory } from '../../../domain/entities/Pitch';
import { matchExplainerService } from './MatchExplainerService';
import { logger } from '../../../shared/logger';
import { cosineSimilarity as sharedCosineSimilarity } from '../../../shared/matching';
import { skillTaxonomyService } from '../taxonomy';

/**
 * Section-specific relevance keywords
 */
const SECTION_RELEVANCE_KEYWORDS: Record<string, string[]> = {
  PROBLEM: ['research', 'analyst', 'consulting', 'industry expert', 'customer insight'],
  SOLUTION: ['product', 'engineering', 'development', 'technical', 'architecture'],
  MARKET: ['market research', 'strategy', 'industry', 'go-to-market', 'sales'],
  BUSINESS_MODEL: ['finance', 'business development', 'pricing', 'monetization', 'revenue'],
  TRACTION: ['growth', 'marketing', 'sales', 'customer success', 'metrics'],
  TECHNOLOGY: ['engineering', 'cto', 'architect', 'ai', 'ml', 'data science', 'devops'],
  TEAM: ['hr', 'recruiting', 'talent', 'leadership', 'coaching', 'mentoring'],
  INVESTMENT_ASK: ['investor', 'vc', 'angel', 'fund', 'capital', 'finance'],
  OTHER: ['general', 'business', 'strategy', 'operations'],
};

/**
 * Strategic value keywords by role
 */
export const STRATEGIC_ROLE_KEYWORDS: Record<string, number> = {
  ceo: 90,
  founder: 85,
  'co-founder': 85,
  cto: 80,
  cfo: 80,
  coo: 80,
  president: 85,
  'managing director': 80,
  'general partner': 90,
  partner: 75,
  director: 70,
  'vp': 70,
  'vice president': 70,
  'head of': 65,
  advisor: 60,
  consultant: 55,
  manager: 50,
};

/** Unified pitch matching defaults */
export const PITCH_MATCHING_DEFAULTS = {
  weights: {
    relevance: 0.40,
    expertise: 0.30,
    strategic: 0.20,
    relationship: 0.10,
  } as MatchWeightsDTO,
  minScore: 30,
  maxMatchesPerSection: 20,
};

/**
 * Pitch Matching Service Implementation
 */
export class PitchMatchingService {
  /**
   * Compute matches for a section against all contacts
   */
  async computeMatches(
    sectionId: string,
    sectionType: PitchSectionType,
    sectionContent: string,
    sectionEmbedding: number[] | null,
    contactProfiles: ContactProfileDTO[],
    weights: MatchWeightsDTO,
    minScore: number = 30
  ): Promise<ComputedMatchDTO[]> {
    const matches: ComputedMatchDTO[] = [];

    for (const contact of contactProfiles) {
      try {
        // Calculate component scores
        const relevanceScore = await this.calculateRelevanceScore(
          sectionType,
          sectionContent,
          sectionEmbedding,
          contact
        );

        const expertiseScore = this.calculateExpertiseScore(sectionType, contact);
        const strategicScore = this.calculateStrategicScore(sectionType, contact);
        const relationshipScore = this.calculateRelationshipScore(contact);

        // Calculate weighted total
        const totalScore = this.calculateWeightedTotal(
          {
            relevance: relevanceScore,
            expertise: expertiseScore,
            strategic: strategicScore,
            relationship: relationshipScore,
          },
          weights
        );

        // Skip if below threshold
        if (totalScore < minScore) {
          continue;
        }

        // Generate match explanation
        const { reasons, angleCategory } = await matchExplainerService.generateMatchReasons(
          sectionContent,
          sectionType,
          contact,
          {
            relevance: relevanceScore,
            expertise: expertiseScore,
            strategic: strategicScore,
            relationship: relationshipScore,
          }
        );

        // Build breakdown
        const breakdown: MatchBreakdown = {
          relevance: {
            score: relevanceScore,
            weight: weights.relevance,
            weighted: relevanceScore * weights.relevance,
            breakdown: {},
          },
          expertise: {
            score: expertiseScore,
            weight: weights.expertise,
            weighted: expertiseScore * weights.expertise,
            breakdown: {},
          },
          strategic: {
            score: strategicScore,
            weight: weights.strategic,
            weighted: strategicScore * weights.strategic,
            breakdown: {},
          },
          relationship: {
            score: relationshipScore,
            weight: weights.relationship,
            weighted: relationshipScore * weights.relationship,
            breakdown: {},
          },
        };

        matches.push({
          contactId: contact.contactId,
          score: Math.round(totalScore),
          relevanceScore,
          expertiseScore,
          strategicScore,
          relationshipScore,
          breakdown,
          reasons,
          angleCategory,
        });
      } catch (error) {
        logger.error('Failed to compute match for contact', {
          contactId: contact.contactId,
          sectionId,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    // Sort by score descending
    matches.sort((a, b) => b.score - a.score);

    logger.info('Match computation completed', {
      sectionId,
      sectionType,
      totalContacts: contactProfiles.length,
      matchesAboveThreshold: matches.length,
    });

    return matches;
  }

  /**
   * Calculate relevance score (semantic + keyword matching)
   */
  private async calculateRelevanceScore(
    sectionType: PitchSectionType,
    sectionContent: string,
    sectionEmbedding: number[] | null,
    contact: ContactProfileDTO
  ): Promise<number> {
    let semanticScore = 0;
    let keywordScore = 0;

    // Semantic similarity (if embeddings available)
    if (sectionEmbedding && contact.embedding && embeddingService.isAvailable()) {
      const similarity = this.cosineSimilarity(sectionEmbedding, contact.embedding);
      // Convert from -1..1 to 0..100
      semanticScore = Math.max(0, similarity) * 100;
    }

    // Keyword matching (static section keywords)
    const sectionKeywords = SECTION_RELEVANCE_KEYWORDS[sectionType] || SECTION_RELEVANCE_KEYWORDS['OTHER'];
    const profileText = `${contact.profileSummary} ${contact.sectors.join(' ')} ${contact.skills.join(' ')}`.toLowerCase();

    let keywordMatches = 0;
    for (const keyword of sectionKeywords) {
      if (profileText.includes(keyword.toLowerCase())) {
        keywordMatches++;
      }
    }
    keywordScore = Math.min(100, (keywordMatches / sectionKeywords.length) * 150);

    // Content-based matching: extract significant words from section content
    // and check if they appear in the contact's profile
    const SHORT_DOMAIN_TERMS = new Set([
      'ai', 'ml', 'ar', 'vr', 'ui', 'ux', 'qa', 'it', 'hr', 'pr', 'db',
      'ci', 'cd', 'iot', 'api', 'saas', 'paas', 'iaas', 'b2b', 'b2c',
    ]);
    const contentWords = sectionContent.toLowerCase()
      .split(/[\s,.\-;:!?()/]+/)
      .filter(w => w.length > 3 || SHORT_DOMAIN_TERMS.has(w))
      .filter(w => !['this', 'that', 'with', 'from', 'have', 'will', 'what', 'your', 'they', 'their', 'been', 'more', 'also', 'into', 'than', 'each', 'make', 'like', 'just', 'over', 'such', 'some', 'when', 'very', 'need', 'looking', 'title', 'company', 'investment', 'timeline'].includes(w));
    const uniqueContentWords = [...new Set(contentWords)];
    let contentMatches = 0;
    for (const word of uniqueContentWords.slice(0, 50)) {
      if (profileText.includes(word)) {
        contentMatches++;
      }
    }
    const contentScore = uniqueContentWords.length > 0
      ? Math.min(100, (contentMatches / Math.min(uniqueContentWords.length, 50)) * 200)
      : 0;

    // Combine: keyword (40%) + content (60%)
    const combinedKeywordScore = Math.round(keywordScore * 0.4 + contentScore * 0.6);

    // Combine with semantic if available
    if (sectionEmbedding && contact.embedding) {
      return Math.round(semanticScore * 0.3 + combinedKeywordScore * 0.7);
    }

    return combinedKeywordScore;
  }

  /**
   * Calculate expertise score based on skills and experience
   */
  private calculateExpertiseScore(
    sectionType: PitchSectionType,
    contact: ContactProfileDTO
  ): number {
    let score = 0;

    // Skill match scoring
    const relevantKeywords = SECTION_RELEVANCE_KEYWORDS[sectionType] || SECTION_RELEVANCE_KEYWORDS['OTHER'];
    const skillsLower = contact.skills.map((s) => s.toLowerCase());

    let skillMatches = 0;
    for (const skill of skillsLower) {
      for (const keyword of relevantKeywords) {
        if (skill.includes(keyword.toLowerCase())) {
          skillMatches++;
          break;
        }
      }
    }

    score += Math.min(50, skillMatches * 15);

    // Sector relevance
    const sectorBoosts: Record<string, string[]> = {
      PROBLEM: ['consulting', 'research', 'analytics'],
      SOLUTION: ['technology', 'software', 'product'],
      MARKET: ['marketing', 'sales', 'strategy'],
      BUSINESS_MODEL: ['finance', 'strategy', 'consulting'],
      TRACTION: ['marketing', 'sales', 'growth'],
      TECHNOLOGY: ['technology', 'software', 'ai', 'data'],
      TEAM: ['hr', 'recruiting', 'consulting'],
      INVESTMENT_ASK: ['finance', 'investment', 'venture capital'],
      EXECUTIVE_SUMMARY: ['technology', 'software', 'finance', 'marketing', 'consulting', 'investment', 'strategy', 'product', 'ai', 'data', 'sales', 'growth'],
      OTHER: ['business', 'general', 'operations'],
    };

    const boostSectors = sectorBoosts[sectionType] || sectorBoosts['OTHER'];
    for (const sector of contact.sectors) {
      const sectorLower = sector.toLowerCase();
      if (boostSectors.some((b) => sectorLower.includes(b))) {
        score += 15;
        break;
      }
    }

    // Investor-specific boost for INVESTMENT_ASK
    if (sectionType === 'INVESTMENT_ASK' && contact.investorType) {
      score += 25;
      if (contact.checkSize) {
        score += 10;
      }
    }

    return Math.min(100, Math.round(score));
  }

  /**
   * Calculate strategic score based on position and company
   */
  private calculateStrategicScore(
    sectionType: PitchSectionType,
    contact: ContactProfileDTO
  ): number {
    let score = 30; // Base score

    // Job title scoring
    if (contact.jobTitle) {
      const titleLower = contact.jobTitle.toLowerCase();

      for (const [keyword, value] of Object.entries(STRATEGIC_ROLE_KEYWORDS)) {
        if (titleLower.includes(keyword)) {
          score = Math.max(score, value);
          break;
        }
      }
    }

    // Company presence boost
    if (contact.company) {
      score += 10;
    }

    // Investor type boost for funding sections
    if (sectionType === 'INVESTMENT_ASK' && contact.investorType) {
      const investorBoosts: Record<string, number> = {
        'vc partner': 95,
        'angel investor': 85,
        'fund manager': 90,
        family_office: 80,
        corporate_vc: 85,
      };

      for (const [type, boost] of Object.entries(investorBoosts)) {
        if (contact.investorType?.toLowerCase().includes(type)) {
          score = Math.max(score, boost);
          break;
        }
      }
    }

    return Math.min(100, Math.round(score));
  }

  /**
   * Calculate relationship score based on interaction history
   */
  private calculateRelationshipScore(contact: ContactProfileDTO): number {
    let score = contact.relationshipStrength;

    // Boost for recent interaction
    if (contact.lastInteractionDays !== null) {
      if (contact.lastInteractionDays <= 7) {
        score += 20;
      } else if (contact.lastInteractionDays <= 30) {
        score += 15;
      } else if (contact.lastInteractionDays <= 90) {
        score += 10;
      } else if (contact.lastInteractionDays <= 180) {
        score += 5;
      }
    }

    // Boost for interaction count
    if (contact.interactionCount > 10) {
      score += 15;
    } else if (contact.interactionCount > 5) {
      score += 10;
    } else if (contact.interactionCount > 2) {
      score += 5;
    }

    return Math.min(100, Math.round(score));
  }

  /**
   * Calculate weighted total score
   */
  private calculateWeightedTotal(
    scores: {
      relevance: number;
      expertise: number;
      strategic: number;
      relationship: number;
    },
    weights: MatchWeightsDTO
  ): number {
    const total =
      scores.relevance * weights.relevance +
      scores.expertise * weights.expertise +
      scores.strategic * weights.strategic +
      scores.relationship * weights.relationship;

    // Normalize to 0-100
    return Math.min(100, Math.round(total));
  }

  /**
   * Calculate cosine similarity between two vectors.
   * Delegates to shared utility.
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    return sharedCosineSimilarity(a, b);
  }

  /**
   * Generate section embedding
   */
  async generateSectionEmbedding(content: string): Promise<number[] | null> {
    if (!embeddingService.isAvailable()) {
      return null;
    }

    try {
      // Create a pseudo profile for the section
      const sectionProfile: ProfileEmbeddingInput = {
        id: `section-${Date.now()}`,
        type: 'contact', // Use contact type for cache key format
        bio: content.slice(0, 2000),
      };

      const result = await embeddingService.generateProfileEmbedding(sectionProfile);
      return result?.embedding || null;
    } catch (error) {
      logger.warn('Failed to generate section embedding', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return null;
    }
  }
}

// Export singleton instance
export const pitchMatchingService = new PitchMatchingService();
