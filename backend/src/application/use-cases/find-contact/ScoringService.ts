/**
 * Scoring Service
 *
 * Calculates deterministic scores and confidence levels for search candidates.
 * Uses weighted scoring based on match type and additional context.
 *
 * @module application/use-cases/find-contact/ScoringService
 */

import { RawCandidate, CandidateType } from './CandidateRetrievalService';
import { ParsedQuery, InputType } from './QueryParserService';
import { PrismaClient } from '@prisma/client';
import { logger } from '../../../shared/logger';

const prisma = new PrismaClient();

/**
 * Scored candidate with ranking information
 */
export interface ScoredCandidate {
  type: CandidateType;
  id: string;
  score: number;           // 0-100
  confidence: number;      // 0.00-1.00
  reasons: string[];       // Max 3 human-readable reasons
  snapshot: CandidateSnapshot;
  rank: number;
}

/**
 * Candidate snapshot for display
 */
export interface CandidateSnapshot {
  name: string;
  title: string | null;
  company: string | null;
  location: string | null;
  avatarUrl: string | null;
  channels: Channel[];
}

/**
 * Communication channel
 */
export interface Channel {
  type: 'email' | 'phone' | 'linkedin' | 'twitter' | 'website';
  value: string;
}

/**
 * Search status based on top confidence
 */
export type SearchStatus = 'HIGH_CONFIDENCE' | 'LIKELY' | 'UNCERTAIN' | 'NO_MATCH';

/**
 * Scoring weights configuration
 */
const SCORING_WEIGHTS = {
  // Exact match scores
  linkedinExact: 90,
  emailExact: 85,
  phoneExact: 80,

  // Name and context
  nameExact: 50,
  nameStrong: 35,      // >80% similarity
  nameMedium: 25,      // >60% similarity
  nameWeak: 15,        // >40% similarity

  // Additional context
  sameCompany: 20,
  sameLocation: 10,
  sameJobTitle: 8,

  // Shared attributes
  sharedSkillsBase: 5,
  sharedSkillsMax: 15,
  sharedSectorsBase: 5,
  sharedSectorsMax: 15,
  sharedInterestsBase: 3,
  sharedInterestsMax: 10,

  // Graph boost (if available)
  mutualConnectionsBase: 10,
  mutualConnectionsMax: 25,

  // Feedback boost
  previousConfirmBoost: 10,
};

/**
 * Confidence thresholds
 */
const CONFIDENCE_THRESHOLDS = {
  high: 0.90,
  likely: 0.70,
  uncertain: 0.50,
};

/**
 * Scoring Service
 */
export class ScoringService {
  /**
   * Score candidates and return ranked results
   *
   * @param candidates - Raw candidates from retrieval
   * @param parsedQuery - Parsed search query
   * @param userId - Searching user's ID
   * @returns Scored and ranked candidates
   */
  async scoreCandidates(
    candidates: RawCandidate[],
    parsedQuery: ParsedQuery,
    userId: string
  ): Promise<{ candidates: ScoredCandidate[]; status: SearchStatus }> {
    if (candidates.length === 0) {
      return { candidates: [], status: 'NO_MATCH' };
    }

    // Get user's attributes for comparison
    const userProfile = await this.getUserProfile(userId);

    // Get feedback boost patterns
    const boostPatterns = await this.getBoostPatterns(userId);

    // Score each candidate
    const scoredCandidates: ScoredCandidate[] = [];

    for (const candidate of candidates) {
      const { score, confidence, reasons } = await this.calculateScore(
        candidate,
        parsedQuery,
        userProfile,
        boostPatterns
      );

      const snapshot = this.createSnapshot(candidate);

      scoredCandidates.push({
        type: candidate.type,
        id: candidate.id,
        score,
        confidence,
        reasons: reasons.slice(0, 3), // Max 3 reasons
        snapshot,
        rank: 0, // Will be set after sorting
      });
    }

    // Sort by score descending
    scoredCandidates.sort((a, b) => b.score - a.score);

    // Assign ranks
    scoredCandidates.forEach((c, index) => {
      c.rank = index + 1;
    });

    // Determine overall status based on top result
    const topConfidence = scoredCandidates[0]?.confidence || 0;
    let status: SearchStatus;

    if (topConfidence >= CONFIDENCE_THRESHOLDS.high) {
      status = 'HIGH_CONFIDENCE';
    } else if (topConfidence >= CONFIDENCE_THRESHOLDS.likely) {
      status = 'LIKELY';
    } else if (topConfidence >= CONFIDENCE_THRESHOLDS.uncertain) {
      status = 'UNCERTAIN';
    } else {
      status = 'NO_MATCH';
    }

    return { candidates: scoredCandidates, status };
  }

  /**
   * Calculate score and confidence for a single candidate
   */
  private async calculateScore(
    candidate: RawCandidate,
    parsedQuery: ParsedQuery,
    userProfile: UserProfile | null,
    boostPatterns: Map<string, number>
  ): Promise<{ score: number; confidence: number; reasons: string[] }> {
    let score = 0;
    const reasons: string[] = [];

    // Score based on matched fields
    for (const field of candidate.matchedFields) {
      switch (field) {
        case 'linkedin':
          score += SCORING_WEIGHTS.linkedinExact;
          reasons.push('Exact LinkedIn match');
          break;
        case 'email':
          score += SCORING_WEIGHTS.emailExact;
          reasons.push('Exact email match');
          break;
        case 'phone':
          score += SCORING_WEIGHTS.phoneExact;
          reasons.push('Exact phone match');
          break;
        case 'website':
          score += 40; // Website match is good but not as definitive
          reasons.push('Website URL match');
          break;
        case 'name':
          // Calculate name similarity
          const nameSimilarity = this.calculateNameSimilarity(
            parsedQuery.parsed.nameTokens || [],
            candidate.fullName
          );
          if (nameSimilarity >= 0.95) {
            score += SCORING_WEIGHTS.nameExact;
            reasons.push('Exact name match');
          } else if (nameSimilarity >= 0.80) {
            score += SCORING_WEIGHTS.nameStrong;
            reasons.push('Strong name match');
          } else if (nameSimilarity >= 0.60) {
            score += SCORING_WEIGHTS.nameMedium;
            reasons.push('Partial name match');
          } else if (nameSimilarity >= 0.40) {
            score += SCORING_WEIGHTS.nameWeak;
          }
          break;
        case 'company':
          score += SCORING_WEIGHTS.sameCompany;
          reasons.push(`Works at ${candidate.company}`);
          break;
      }
    }

    // Additional context scoring
    if (userProfile) {
      // Shared sectors
      const sharedSectors = this.countShared(userProfile.sectorIds, candidate.sectorIds);
      if (sharedSectors > 0) {
        const sectorScore = Math.min(
          SCORING_WEIGHTS.sharedSectorsBase + sharedSectors * 3,
          SCORING_WEIGHTS.sharedSectorsMax
        );
        score += sectorScore;
        if (sharedSectors >= 2) {
          reasons.push(`${sharedSectors} shared sectors`);
        }
      }

      // Shared skills
      const sharedSkills = this.countShared(userProfile.skillIds, candidate.skillIds);
      if (sharedSkills > 0) {
        const skillScore = Math.min(
          SCORING_WEIGHTS.sharedSkillsBase + sharedSkills * 2,
          SCORING_WEIGHTS.sharedSkillsMax
        );
        score += skillScore;
        if (sharedSkills >= 3) {
          reasons.push(`${sharedSkills} shared skills`);
        }
      }

      // Shared interests
      const sharedInterests = this.countShared(userProfile.interestIds, candidate.interestIds);
      if (sharedInterests > 0) {
        const interestScore = Math.min(
          SCORING_WEIGHTS.sharedInterestsBase + sharedInterests * 2,
          SCORING_WEIGHTS.sharedInterestsMax
        );
        score += interestScore;
      }

      // Same location
      if (userProfile.location && candidate.location) {
        if (this.locationsMatch(userProfile.location, candidate.location)) {
          score += SCORING_WEIGHTS.sameLocation;
          reasons.push(`Same location: ${candidate.location}`);
        }
      }
    }

    // Apply feedback boost
    const boostKey = `${candidate.type}:${candidate.id}`;
    const feedbackBoost = boostPatterns.get(boostKey) || 0;
    if (feedbackBoost > 0) {
      score += Math.min(feedbackBoost, SCORING_WEIGHTS.previousConfirmBoost);
    }

    // Normalize score to 0-100
    score = Math.min(100, Math.max(0, score));

    // Calculate confidence based on score and match type
    const confidence = this.calculateConfidence(score, candidate.matchedFields, parsedQuery.type);

    return { score, confidence, reasons };
  }

  /**
   * Calculate name similarity using token matching
   */
  private calculateNameSimilarity(queryTokens: string[], candidateName: string): number {
    if (queryTokens.length === 0) return 0;

    const candidateTokens = candidateName
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, '')
      .split(/\s+/)
      .filter(t => t.length > 0);

    if (candidateTokens.length === 0) return 0;

    // Count matching tokens
    let matches = 0;
    for (const qt of queryTokens) {
      for (const ct of candidateTokens) {
        if (ct === qt) {
          matches++;
          break;
        } else if (ct.startsWith(qt) || qt.startsWith(ct)) {
          matches += 0.7;
          break;
        } else if (this.levenshteinSimilarity(qt, ct) > 0.8) {
          matches += 0.5;
          break;
        }
      }
    }

    // Calculate similarity as ratio of matched tokens
    const maxTokens = Math.max(queryTokens.length, candidateTokens.length);
    return matches / maxTokens;
  }

  /**
   * Levenshtein-based string similarity (0-1)
   */
  private levenshteinSimilarity(a: string, b: string): number {
    if (a === b) return 1;
    if (a.length === 0 || b.length === 0) return 0;

    const matrix: number[][] = [];

    for (let i = 0; i <= b.length; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= a.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        const cost = a[j - 1] === b[i - 1] ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j - 1] + cost
        );
      }
    }

    const distance = matrix[b.length][a.length];
    const maxLen = Math.max(a.length, b.length);
    return 1 - distance / maxLen;
  }

  /**
   * Calculate confidence level based on score and match type
   */
  private calculateConfidence(
    score: number,
    matchedFields: string[],
    queryType: InputType
  ): number {
    // Exact identifier matches get high confidence regardless of score
    const hasExactMatch = matchedFields.some(f =>
      ['email', 'phone', 'linkedin'].includes(f)
    );

    if (hasExactMatch) {
      // Exact match confidence: 0.90-0.99 based on score
      return Math.min(0.99, 0.90 + (score / 1000));
    }

    // For name searches, confidence is lower and depends more on context
    if (queryType === 'name') {
      if (score >= 70) return Math.min(0.89, 0.70 + (score - 70) / 100);
      if (score >= 50) return Math.min(0.69, 0.50 + (score - 50) / 100);
      if (score >= 30) return Math.min(0.49, 0.30 + (score - 30) / 100);
      return Math.max(0.10, score / 100);
    }

    // URL matches (non-LinkedIn)
    if (queryType === 'url') {
      if (score >= 60) return Math.min(0.85, 0.70 + (score - 60) / 100);
      return Math.min(0.69, score / 100);
    }

    // Default confidence calculation
    return Math.min(0.95, score / 100);
  }

  /**
   * Check if two locations match (city or country)
   */
  private locationsMatch(loc1: string, loc2: string): boolean {
    const normalize = (s: string) => s.toLowerCase().replace(/[^a-z\s]/g, '');
    const parts1 = normalize(loc1).split(/[,\s]+/).filter(p => p.length > 2);
    const parts2 = normalize(loc2).split(/[,\s]+/).filter(p => p.length > 2);

    return parts1.some(p1 => parts2.some(p2 => p1 === p2 || p1.includes(p2) || p2.includes(p1)));
  }

  /**
   * Count shared items between two arrays
   */
  private countShared(arr1: string[], arr2: string[]): number {
    const set2 = new Set(arr2);
    return arr1.filter(id => set2.has(id)).length;
  }

  /**
   * Create candidate snapshot for display
   */
  private createSnapshot(candidate: RawCandidate): CandidateSnapshot {
    const channels: Channel[] = [];

    if (candidate.email) {
      channels.push({ type: 'email', value: candidate.email });
    }
    if (candidate.phone) {
      channels.push({ type: 'phone', value: candidate.phone });
    }
    if (candidate.linkedinUrl) {
      channels.push({ type: 'linkedin', value: candidate.linkedinUrl });
    }
    if (candidate.websiteUrl) {
      channels.push({ type: 'website', value: candidate.websiteUrl });
    }

    return {
      name: candidate.fullName,
      title: candidate.jobTitle,
      company: candidate.company,
      location: candidate.location,
      avatarUrl: candidate.avatarUrl,
      channels,
    };
  }

  /**
   * Get user's profile for comparison
   */
  private async getUserProfile(userId: string): Promise<UserProfile | null> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
          userSectors: true,
          userSkills: true,
          userInterests: true,
        },
      });

      if (!user) return null;

      return {
        id: user.id,
        location: user.location,
        company: user.company,
        sectorIds: user.userSectors.map(us => us.sectorId),
        skillIds: user.userSkills.map(us => us.skillId),
        interestIds: user.userInterests.map(ui => ui.interestId),
      };
    } catch (error) {
      logger.error('Failed to get user profile', { error, userId });
      return null;
    }
  }

  /**
   * Get feedback boost patterns for user
   */
  private async getBoostPatterns(userId: string): Promise<Map<string, number>> {
    const boostMap = new Map<string, number>();

    try {
      const boosts = await prisma.searchPatternBoost.findMany({
        where: { userId },
        orderBy: { boostScore: 'desc' },
        take: 100,
      });

      for (const boost of boosts) {
        boostMap.set(`${boost.patternType}:${boost.patternValue}`, boost.boostScore);
      }
    } catch (error) {
      logger.error('Failed to get boost patterns', { error, userId });
    }

    return boostMap;
  }
}

/**
 * User profile for scoring context
 */
interface UserProfile {
  id: string;
  location: string | null;
  company: string | null;
  sectorIds: string[];
  skillIds: string[];
  interestIds: string[];
}

export default ScoringService;
