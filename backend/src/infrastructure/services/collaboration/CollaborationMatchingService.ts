/**
 * Collaboration Matching Service
 * Scores contacts against feature criteria for collaborative matching
 * Updated for feature-based collaboration (no missions)
 */

import {
  CollaborationCriteria,
  CollaborationMatchReason,
  CollaborationMatchReasonType,
  COLLABORATION_MATCHING_WEIGHTS,
  COLLABORATION_MATCH_THRESHOLD,
} from '../../../domain/entities/Collaboration';
import { logger } from '../../../shared/logger';
import { levenshteinDistance as sharedLevenshteinDistance, fuzzyMatch as sharedFuzzyMatch } from '../../../shared/matching';
import { skillTaxonomyService } from '../taxonomy';

// ============================================================================
// Types
// ============================================================================

export interface CollaboratorContact {
  id: string;
  fullName: string;
  company: string | null;
  jobTitle: string | null;
  location: string | null;
  sectors: string[];
  skills: string[];
  bio: string | null;
}

export interface CollaborationMatchResult {
  contactId: string;
  score: number;
  reasons: CollaborationMatchReason[];
}

export interface MatchingConfig {
  weights: {
    sector: number;
    skills: number;
    location: number;
    experience: number;
  };
  minScore: number;
  maxMatches: number;
}

// ============================================================================
// Main Matching Service
// ============================================================================

export class CollaborationMatchingService {
  private config: MatchingConfig;

  constructor(config?: Partial<MatchingConfig>) {
    this.config = {
      weights: config?.weights || COLLABORATION_MATCHING_WEIGHTS,
      minScore: config?.minScore || COLLABORATION_MATCH_THRESHOLD,
      maxMatches: config?.maxMatches || 100,
    };
  }

  /**
   * Score contacts against feature criteria
   */
  async matchContacts(
    criteria: CollaborationCriteria,
    contacts: CollaboratorContact[]
  ): Promise<CollaborationMatchResult[]> {
    logger.info('Starting collaboration matching', {
      criteriaKeys: Object.keys(criteria),
      criteriaSectors: criteria.sectors || [],
      criteriaSkills: criteria.skills || [],
      criteriaLocations: criteria.locations || [],
      criteriaKeywords: criteria.keywords || [],
      contactCount: contacts.length,
      minScore: this.config.minScore,
    });

    const results: CollaborationMatchResult[] = [];
    let contactsWithNoData = 0;
    let contactsBelowThreshold = 0;

    for (const contact of contacts) {
      const result = this.scoreContact(criteria, contact);

      // Track contacts with no matching data
      if (contact.sectors.length === 0 && contact.skills.length === 0 && !contact.location && !contact.bio) {
        contactsWithNoData++;
      }

      if (result.score >= this.config.minScore) {
        results.push(result);
      } else if (result.score > 0) {
        contactsBelowThreshold++;
        logger.debug('Contact below threshold', {
          contactId: contact.id,
          contactName: contact.fullName,
          score: result.score,
          minScore: this.config.minScore,
          reasons: result.reasons,
        });
      }
    }

    // Sort by score descending
    results.sort((a, b) => b.score - a.score);

    // Limit to max matches
    const limitedResults = results.slice(0, this.config.maxMatches);

    logger.info('Collaboration matching complete', {
      totalCandidates: contacts.length,
      contactsWithNoData,
      contactsBelowThreshold,
      qualifiedMatches: limitedResults.length,
      minScore: this.config.minScore,
    });

    // If no matches found above threshold, try to include best partial matches
    if (limitedResults.length === 0 && contacts.length > 0) {
      logger.warn('No matches above threshold - checking for partial matches', {
        hasCriteria: !!(criteria.sectors?.length || criteria.skills?.length || criteria.locations?.length || criteria.keywords?.length),
        criteriaEmpty: !criteria.sectors?.length && !criteria.skills?.length && !criteria.locations?.length && !criteria.keywords?.length,
        contactsLackData: contactsWithNoData,
        contactsBelowThreshold,
      });

      // Fallback: Include any contacts with score > 0, up to 10 results
      const allScored: CollaborationMatchResult[] = [];
      for (const contact of contacts) {
        const result = this.scoreContact(criteria, contact);
        if (result.score > 0) {
          allScored.push(result);
        }
      }

      if (allScored.length > 0) {
        allScored.sort((a, b) => b.score - a.score);
        const fallbackResults = allScored.slice(0, 10);
        logger.info('Returning partial matches as fallback', {
          fallbackCount: fallbackResults.length,
          topScore: fallbackResults[0]?.score || 0,
        });
        return fallbackResults;
      }

      logger.warn('No matches found even with fallback - contacts may lack matching data');
    }

    return limitedResults;
  }

  /**
   * Score a single contact against criteria
   */
  private scoreContact(
    criteria: CollaborationCriteria,
    contact: CollaboratorContact
  ): CollaborationMatchResult {
    const reasons: CollaborationMatchReason[] = [];
    let totalScore = 0;

    // Sector matching (30 points max)
    if (criteria.sectors && criteria.sectors.length > 0 && contact.sectors.length > 0) {
      const sectorScore = this.calculateSectorScore(criteria.sectors, contact.sectors);
      totalScore += sectorScore.score;
      if (sectorScore.reasons.length > 0) {
        reasons.push(...sectorScore.reasons);
      }
    }

    // Skills matching (30 points max)
    if (criteria.skills && criteria.skills.length > 0 && contact.skills.length > 0) {
      const skillScore = this.calculateSkillScore(criteria.skills, contact.skills);
      totalScore += skillScore.score;
      if (skillScore.reasons.length > 0) {
        reasons.push(...skillScore.reasons);
      }
    }

    // Location matching (20 points max)
    if (criteria.locations && criteria.locations.length > 0 && contact.location) {
      const locationScore = this.calculateLocationScore(criteria.locations, contact.location);
      totalScore += locationScore.score;
      if (locationScore.reasons.length > 0) {
        reasons.push(...locationScore.reasons);
      }
    }

    // Keyword matching (15 points max) - searches in bio, job title, company
    if (criteria.keywords && criteria.keywords.length > 0) {
      const keywordScore = this.calculateKeywordScore(criteria.keywords, contact);
      totalScore += keywordScore.score;
      if (keywordScore.reasons.length > 0) {
        reasons.push(...keywordScore.reasons);
      }
    }

    // Semantic-like word overlap scoring (20 points max)
    // Combines all criteria text and contact text, calculates word overlap ratio
    {
      const semanticScore = this.calculateSemanticLikeScore(criteria, contact);
      totalScore += semanticScore.score;
      if (semanticScore.reasons.length > 0) {
        reasons.push(...semanticScore.reasons);
      }
    }

    // Cap score at 100
    totalScore = Math.min(totalScore, 100);

    return {
      contactId: contact.id,
      score: Math.round(totalScore),
      reasons,
    };
  }

  /**
   * Calculate sector matching score
   */
  private calculateSectorScore(
    criteriaSectors: string[],
    contactSectors: string[]
  ): { score: number; reasons: CollaborationMatchReason[] } {
    const normalizedCriteria = criteriaSectors.map((s) => s.toLowerCase().trim());
    const normalizedContact = contactSectors.map((s) => s.toLowerCase().trim());

    const matches = normalizedContact.filter((s) =>
      normalizedCriteria.some(
        (cs) => s.includes(cs) || cs.includes(s) || this.fuzzyMatch(s, cs)
      )
    );

    if (matches.length === 0) {
      return { score: 0, reasons: [] };
    }

    // Score based on match percentage
    const matchPercentage = matches.length / normalizedCriteria.length;
    const score = Math.min(matchPercentage * this.config.weights.sector, this.config.weights.sector);

    const matchedSectors = contactSectors.filter((s) =>
      matches.includes(s.toLowerCase().trim())
    );

    return {
      score,
      reasons: [
        {
          type: CollaborationMatchReasonType.SECTOR_MATCH,
          text: `Matches sectors: ${matchedSectors.slice(0, 3).join(', ')}`,
          score: Math.round(score),
        },
      ],
    };
  }

  /**
   * Calculate skill matching score (taxonomy-enhanced)
   */
  private calculateSkillScore(
    criteriaSkills: string[],
    contactSkills: string[]
  ): { score: number; reasons: CollaborationMatchReason[] } {
    // Try taxonomy-based matching first
    if (skillTaxonomyService.isAvailable()) {
      const taxonomyResult = skillTaxonomyService.calculateSkillScore(
        criteriaSkills.map(s => s.toLowerCase().trim()),
        contactSkills.map(s => s.toLowerCase().trim())
      );

      if (taxonomyResult.matches.length === 0) {
        return { score: 0, reasons: [] };
      }

      const score = Math.min(
        (taxonomyResult.score / 100) * this.config.weights.skills,
        this.config.weights.skills
      );

      const matchedSkills = taxonomyResult.matches.map(m => m.targetSkill).slice(0, 3);

      return {
        score,
        reasons: [
          {
            type: CollaborationMatchReasonType.SKILL_MATCH,
            text: `Matches skills: ${matchedSkills.join(', ')}`,
            score: Math.round(score),
          },
        ],
      };
    }

    // Fallback to fuzzy matching
    const normalizedCriteria = criteriaSkills.map((s) => s.toLowerCase().trim());
    const normalizedContact = contactSkills.map((s) => s.toLowerCase().trim());

    const matches = normalizedContact.filter((s) =>
      normalizedCriteria.some(
        (cs) => s.includes(cs) || cs.includes(s) || this.fuzzyMatch(s, cs)
      )
    );

    if (matches.length === 0) {
      return { score: 0, reasons: [] };
    }

    const matchPercentage = matches.length / normalizedCriteria.length;
    const score = Math.min(matchPercentage * this.config.weights.skills, this.config.weights.skills);

    const matchedSkills = contactSkills.filter((s) =>
      matches.includes(s.toLowerCase().trim())
    );

    return {
      score,
      reasons: [
        {
          type: CollaborationMatchReasonType.SKILL_MATCH,
          text: `Matches skills: ${matchedSkills.slice(0, 3).join(', ')}`,
          score: Math.round(score),
        },
      ],
    };
  }

  /**
   * Calculate location matching score
   */
  private calculateLocationScore(
    criteriaLocations: string[],
    contactLocation: string
  ): { score: number; reasons: CollaborationMatchReason[] } {
    const normalizedCriteria = criteriaLocations.map((l) => l.toLowerCase().trim());
    const normalizedContact = contactLocation.toLowerCase().trim();

    const isMatch = normalizedCriteria.some(
      (cl) =>
        normalizedContact.includes(cl) ||
        cl.includes(normalizedContact) ||
        this.fuzzyMatch(normalizedContact, cl)
    );

    if (!isMatch) {
      return { score: 0, reasons: [] };
    }

    return {
      score: this.config.weights.location,
      reasons: [
        {
          type: CollaborationMatchReasonType.LOCATION_MATCH,
          text: `Located in: ${contactLocation}`,
          score: this.config.weights.location,
        },
      ],
    };
  }

  /**
   * Calculate keyword matching score
   */
  private calculateKeywordScore(
    keywords: string[],
    contact: CollaboratorContact
  ): { score: number; reasons: CollaborationMatchReason[] } {
    const searchText = [contact.bio, contact.jobTitle, contact.company]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    const normalizedKeywords = keywords.map((k) => k.toLowerCase().trim());
    const matches = normalizedKeywords.filter((k) => searchText.includes(k));

    if (matches.length === 0) {
      return { score: 0, reasons: [] };
    }

    // Score based on keyword match percentage
    const matchPercentage = matches.length / normalizedKeywords.length;
    const score = Math.min(
      matchPercentage * this.config.weights.experience,
      this.config.weights.experience
    );

    return {
      score,
      reasons: [
        {
          type: CollaborationMatchReasonType.KEYWORD_MATCH,
          text: `Matches keywords: ${matches.slice(0, 3).join(', ')}`,
          score: Math.round(score),
        },
      ],
    };
  }

  /**
   * Calculate semantic-like score using word overlap ratio (20 points max)
   * Combines all criteria text and contact text, then measures unique word overlap
   * as a lightweight proxy for semantic similarity without requiring embeddings.
   */
  private calculateSemanticLikeScore(
    criteria: CollaborationCriteria,
    contact: CollaboratorContact
  ): { score: number; reasons: CollaborationMatchReason[] } {
    // Build criteria text from all available fields
    const criteriaWords = this.extractSignificantWords(
      [
        ...(criteria.sectors || []),
        ...(criteria.skills || []),
        ...(criteria.keywords || []),
        ...(criteria.locations || []),
      ].join(' ')
    );

    // Build contact text from all available fields
    const contactWords = this.extractSignificantWords(
      [
        contact.bio || '',
        contact.jobTitle || '',
        contact.company || '',
        ...contact.sectors,
        ...contact.skills,
      ].join(' ')
    );

    if (criteriaWords.size === 0 || contactWords.size === 0) {
      return { score: 0, reasons: [] };
    }

    // Calculate bidirectional word overlap
    const overlapWords: string[] = [];
    for (const word of criteriaWords) {
      if (contactWords.has(word)) {
        overlapWords.push(word);
      } else {
        // Partial match: check if any contact word contains this criteria word or vice versa
        for (const cw of contactWords) {
          if ((cw.length > 3 && word.includes(cw)) || (word.length > 3 && cw.includes(word))) {
            overlapWords.push(word);
            break;
          }
        }
      }
    }

    if (overlapWords.length === 0) {
      return { score: 0, reasons: [] };
    }

    // Overlap ratio relative to criteria size (how much of the criteria is covered)
    const overlapRatio = overlapWords.length / criteriaWords.size;
    const score = Math.min(Math.round(overlapRatio * 20), 20);

    return {
      score,
      reasons: [
        {
          type: CollaborationMatchReasonType.KEYWORD_MATCH,
          text: `Semantic relevance: ${overlapWords.slice(0, 3).join(', ')}`,
          score,
        },
      ],
    };
  }

  /**
   * Extract significant words (length > 2, lowercased, deduplicated)
   */
  private extractSignificantWords(text: string): Set<string> {
    const stopWords = new Set(['the', 'and', 'for', 'with', 'from', 'this', 'that', 'are', 'was', 'were', 'been', 'have', 'has', 'had', 'not', 'but', 'can', 'will']);
    return new Set(
      text.toLowerCase()
        .split(/[\s,;.]+/)
        .map(w => w.replace(/[^a-z0-9]/g, ''))
        .filter(w => w.length > 2 && !stopWords.has(w))
    );
  }

  /**
   * Simple fuzzy matching for similar words.
   * Delegates to shared utility.
   */
  private fuzzyMatch(a: string, b: string): boolean {
    return sharedFuzzyMatch(a, b);
  }
}
