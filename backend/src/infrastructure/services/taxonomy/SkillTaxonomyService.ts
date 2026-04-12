/**
 * Skill Taxonomy Service
 *
 * Provides hierarchical skill matching using a taxonomy of 100+ skills.
 * Supports exact, synonym, child, implied, related, parent, and semantic fallback matching.
 *
 * Match types and scores:
 * - EXACT (100): Identical skill
 * - SYNONYM (95): Known synonym (e.g., "JS" = "JavaScript")
 * - CHILD (90): Child skill (e.g., "React" is a child of "JavaScript")
 * - IMPLIED (80): Implied by the skill (e.g., "React" implies "Frontend Development")
 * - RELATED (75): Related skill (e.g., "React" is related to "Vue.js")
 * - PARENT (70): Parent skill (e.g., "JavaScript" is parent of "React")
 * - SEMANTIC_FALLBACK (variable): Cosine similarity of embeddings
 *
 * @module infrastructure/services/taxonomy/SkillTaxonomyService
 */

import { logger } from '../../../shared/logger';
import { normalizeString, areStringsSimilar } from '../../../shared/matching';
import taxonomyData from './skill-taxonomy.json';

// ============================================================================
// Types
// ============================================================================

export enum SkillMatchType {
  EXACT = 'EXACT',
  SYNONYM = 'SYNONYM',
  CHILD = 'CHILD',
  IMPLIED = 'IMPLIED',
  RELATED = 'RELATED',
  PARENT = 'PARENT',
  SEMANTIC_FALLBACK = 'SEMANTIC_FALLBACK',
}

/** Default scores for each match type */
export const MATCH_TYPE_SCORES: Record<SkillMatchType, number> = {
  [SkillMatchType.EXACT]: 100,
  [SkillMatchType.SYNONYM]: 95,
  [SkillMatchType.CHILD]: 90,
  [SkillMatchType.IMPLIED]: 80,
  [SkillMatchType.RELATED]: 75,
  [SkillMatchType.PARENT]: 70,
  [SkillMatchType.SEMANTIC_FALLBACK]: 50, // default for semantic fallback
};

export interface SkillMatchResult {
  sourceSkill: string;
  targetSkill: string;
  matchType: SkillMatchType;
  score: number;
  explanation: string;
}

export interface SkillScoreResult {
  score: number; // 0-100
  matches: SkillMatchResult[];
  unmatchedSource: string[];
  unmatchedTarget: string[];
}

interface SkillNode {
  canonical: string;
  synonyms: string[];
  children: string[];
  parent: string;
  related: string[];
  implies: string[];
}

interface SkillFindOptions {
  includeSemanticFallback?: boolean;
}

// ============================================================================
// Service
// ============================================================================

export class SkillTaxonomyService {
  private skills: Map<string, SkillNode> = new Map();
  private normalizedIndex: Map<string, string> = new Map(); // normalized name -> canonical key
  private loaded: boolean = false;

  constructor() {
    this.loadTaxonomy();
  }

  /**
   * Load taxonomy from JSON into in-memory maps
   */
  private loadTaxonomy(): void {
    try {
      const data = taxonomyData as { skills: Record<string, SkillNode> };

      for (const [key, node] of Object.entries(data.skills)) {
        this.skills.set(key, node);

        // Index by canonical name (lowercased)
        this.normalizedIndex.set(this.normalize(node.canonical), key);

        // Index by synonyms
        for (const synonym of node.synonyms) {
          this.normalizedIndex.set(this.normalize(synonym), key);
        }
      }

      this.loaded = true;
      logger.info('Skill taxonomy loaded', {
        skillCount: this.skills.size,
        indexEntries: this.normalizedIndex.size,
      });
    } catch (error) {
      logger.error('Failed to load skill taxonomy', { error });
      this.loaded = false;
    }
  }

  /**
   * Normalize a skill name for lookup
   */
  normalize(skill: string): string {
    return normalizeString(skill)
      .replace(/[.\-\/]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Look up a skill in the taxonomy
   */
  private lookupSkill(skill: string): SkillNode | null {
    const normalized = this.normalize(skill);
    const key = this.normalizedIndex.get(normalized);
    if (key) {
      return this.skills.get(key) || null;
    }
    return null;
  }

  /**
   * Find best match between a single source skill and a set of target skills
   */
  findBestMatch(sourceSkill: string, targetSkills: string[], options: SkillFindOptions = {}): SkillMatchResult | null {
    if (!this.loaded || targetSkills.length === 0) return null;

    const normalizedSource = this.normalize(sourceSkill);
    const sourceNode = this.lookupSkill(sourceSkill);

    let bestMatch: SkillMatchResult | null = null;

    for (const targetSkill of targetSkills) {
      const normalizedTarget = this.normalize(targetSkill);

      // 1. EXACT match
      if (normalizedSource === normalizedTarget) {
        return {
          sourceSkill,
          targetSkill,
          matchType: SkillMatchType.EXACT,
          score: MATCH_TYPE_SCORES[SkillMatchType.EXACT],
          explanation: `Exact match: ${sourceSkill}`,
        };
      }

      const targetNode = this.lookupSkill(targetSkill);

      // 2. SYNONYM match - both resolve to same taxonomy key
      if (sourceNode && targetNode) {
        const sourceKey = this.normalizedIndex.get(normalizedSource);
        const targetKey = this.normalizedIndex.get(normalizedTarget);

        if (sourceKey && targetKey && sourceKey === targetKey) {
          return {
            sourceSkill,
            targetSkill,
            matchType: SkillMatchType.SYNONYM,
            score: MATCH_TYPE_SCORES[SkillMatchType.SYNONYM],
            explanation: `${sourceSkill} is a synonym for ${targetSkill}`,
          };
        }
      }

      if (!sourceNode) continue;

      const targetCanonical = targetNode?.canonical || targetSkill;
      const targetNorm = this.normalize(targetCanonical);

      // 3. CHILD match - target is a child of source
      if (sourceNode.children.some(c => this.normalize(c) === normalizedTarget || this.normalize(c) === targetNorm)) {
        const match: SkillMatchResult = {
          sourceSkill,
          targetSkill,
          matchType: SkillMatchType.CHILD,
          score: MATCH_TYPE_SCORES[SkillMatchType.CHILD],
          explanation: `${targetSkill} is a specialization of ${sourceSkill}`,
        };
        if (!bestMatch || match.score > bestMatch.score) bestMatch = match;
        continue;
      }

      // 4. IMPLIED match - source implies target
      if (sourceNode.implies.some(i => this.normalize(i) === normalizedTarget || this.normalize(i) === targetNorm)) {
        const match: SkillMatchResult = {
          sourceSkill,
          targetSkill,
          matchType: SkillMatchType.IMPLIED,
          score: MATCH_TYPE_SCORES[SkillMatchType.IMPLIED],
          explanation: `${sourceSkill} implies knowledge of ${targetSkill}`,
        };
        if (!bestMatch || match.score > bestMatch.score) bestMatch = match;
        continue;
      }

      // 5. RELATED match - skills are related
      if (sourceNode.related.some(r => this.normalize(r) === normalizedTarget || this.normalize(r) === targetNorm)) {
        const match: SkillMatchResult = {
          sourceSkill,
          targetSkill,
          matchType: SkillMatchType.RELATED,
          score: MATCH_TYPE_SCORES[SkillMatchType.RELATED],
          explanation: `${sourceSkill} is related to ${targetSkill}`,
        };
        if (!bestMatch || match.score > bestMatch.score) bestMatch = match;
        continue;
      }

      // 6. PARENT match - target is the parent of source
      if (this.normalize(sourceNode.parent) === normalizedTarget || this.normalize(sourceNode.parent) === targetNorm) {
        const match: SkillMatchResult = {
          sourceSkill,
          targetSkill,
          matchType: SkillMatchType.PARENT,
          score: MATCH_TYPE_SCORES[SkillMatchType.PARENT],
          explanation: `${sourceSkill} is a specialization within ${targetSkill}`,
        };
        if (!bestMatch || match.score > bestMatch.score) bestMatch = match;
        continue;
      }

      // Check if target has source as a child (reverse child = parent from target's perspective)
      if (targetNode?.children.some(c => this.normalize(c) === normalizedSource)) {
        const match: SkillMatchResult = {
          sourceSkill,
          targetSkill,
          matchType: SkillMatchType.PARENT,
          score: MATCH_TYPE_SCORES[SkillMatchType.PARENT],
          explanation: `${sourceSkill} is a part of ${targetSkill}`,
        };
        if (!bestMatch || match.score > bestMatch.score) bestMatch = match;
        continue;
      }

      // Check reverse: target implies source
      if (targetNode?.implies.some(i => this.normalize(i) === normalizedSource)) {
        const match: SkillMatchResult = {
          sourceSkill,
          targetSkill,
          matchType: SkillMatchType.IMPLIED,
          score: MATCH_TYPE_SCORES[SkillMatchType.IMPLIED],
          explanation: `${targetSkill} implies knowledge of ${sourceSkill}`,
        };
        if (!bestMatch || match.score > bestMatch.score) bestMatch = match;
        continue;
      }

      // Check reverse: target related to source
      if (targetNode?.related.some(r => this.normalize(r) === normalizedSource)) {
        const match: SkillMatchResult = {
          sourceSkill,
          targetSkill,
          matchType: SkillMatchType.RELATED,
          score: MATCH_TYPE_SCORES[SkillMatchType.RELATED],
          explanation: `${targetSkill} is related to ${sourceSkill}`,
        };
        if (!bestMatch || match.score > bestMatch.score) bestMatch = match;
      }
    }

    // 7. SEMANTIC_FALLBACK - multi-strategy lightweight semantic matching
    // Uses string similarity + substring containment as a proxy for semantic closeness
    // (Full embedding-based matching is handled at the service layer via EmbeddingService)
    if (!bestMatch && options.includeSemanticFallback) {
      let bestFallbackScore = 0;
      for (const targetSkill of targetSkills) {
        const normalizedTarget = this.normalize(targetSkill);

        // Strategy A: High string similarity (e.g., "Machine Learning" vs "Machine Learn")
        if (areStringsSimilar(sourceSkill, targetSkill, 0.75)) {
          const score = Math.round(MATCH_TYPE_SCORES[SkillMatchType.SEMANTIC_FALLBACK] * 1.0);
          if (score > bestFallbackScore) {
            bestFallbackScore = score;
            bestMatch = {
              sourceSkill,
              targetSkill,
              matchType: SkillMatchType.SEMANTIC_FALLBACK,
              score,
              explanation: `${sourceSkill} is semantically similar to ${targetSkill}`,
            };
          }
          continue;
        }

        // Strategy B: One skill contains the other (e.g., "Data Science" contains "Data")
        if (normalizedSource.length > 3 && normalizedTarget.length > 3) {
          if (normalizedTarget.includes(normalizedSource) || normalizedSource.includes(normalizedTarget)) {
            const score = Math.round(MATCH_TYPE_SCORES[SkillMatchType.SEMANTIC_FALLBACK] * 0.8);
            if (score > bestFallbackScore) {
              bestFallbackScore = score;
              bestMatch = {
                sourceSkill,
                targetSkill,
                matchType: SkillMatchType.SEMANTIC_FALLBACK,
                score,
                explanation: `${sourceSkill} partially matches ${targetSkill}`,
              };
            }
          }
        }

        // Strategy C: Significant word overlap (e.g., "Project Management" vs "Product Management")
        const sourceWords = new Set(normalizedSource.split(' ').filter(w => w.length > 2));
        const targetWords = new Set(normalizedTarget.split(' ').filter(w => w.length > 2));
        if (sourceWords.size >= 2 && targetWords.size >= 2) {
          let overlap = 0;
          for (const w of sourceWords) {
            if (targetWords.has(w)) overlap++;
          }
          const overlapRatio = overlap / Math.max(sourceWords.size, targetWords.size);
          if (overlapRatio >= 0.5) {
            const score = Math.round(MATCH_TYPE_SCORES[SkillMatchType.SEMANTIC_FALLBACK] * overlapRatio);
            if (score > bestFallbackScore) {
              bestFallbackScore = score;
              bestMatch = {
                sourceSkill,
                targetSkill,
                matchType: SkillMatchType.SEMANTIC_FALLBACK,
                score,
                explanation: `${sourceSkill} shares keywords with ${targetSkill}`,
              };
            }
          }
        }
      }
    }

    return bestMatch;
  }

  /**
   * Find all skill matches between two sets of skills
   */
  findSkillMatches(
    sourceSkills: string[],
    targetSkills: string[],
    options: SkillFindOptions = {}
  ): SkillMatchResult[] {
    if (!this.loaded || sourceSkills.length === 0 || targetSkills.length === 0) {
      return [];
    }

    const matches: SkillMatchResult[] = [];
    const matchedTargets = new Set<string>();

    for (const sourceSkill of sourceSkills) {
      const match = this.findBestMatch(sourceSkill, targetSkills, options);
      if (match && !matchedTargets.has(this.normalize(match.targetSkill))) {
        matches.push(match);
        matchedTargets.add(this.normalize(match.targetSkill));
      }
    }

    // Sort by score descending
    matches.sort((a, b) => b.score - a.score);

    return matches;
  }

  /**
   * Calculate an overall skill score based on matches
   */
  calculateSkillScore(
    sourceSkills: string[],
    targetSkills: string[],
    options: SkillFindOptions = {}
  ): SkillScoreResult {
    const matches = this.findSkillMatches(sourceSkills, targetSkills, options);

    // Calculate score as weighted average of match scores
    if (matches.length === 0) {
      return {
        score: 0,
        matches: [],
        unmatchedSource: sourceSkills,
        unmatchedTarget: targetSkills,
      };
    }

    const totalRequired = Math.max(sourceSkills.length, targetSkills.length);
    const matchScoreSum = matches.reduce((sum, m) => sum + m.score, 0);
    const maxPossible = totalRequired * 100;
    const score = Math.round((matchScoreSum / maxPossible) * 100);

    // Find unmatched skills
    const matchedSourceNorms = new Set(matches.map(m => this.normalize(m.sourceSkill)));
    const matchedTargetNorms = new Set(matches.map(m => this.normalize(m.targetSkill)));

    const unmatchedSource = sourceSkills.filter(s => !matchedSourceNorms.has(this.normalize(s)));
    const unmatchedTarget = targetSkills.filter(s => !matchedTargetNorms.has(this.normalize(s)));

    return {
      score: Math.min(100, score),
      matches,
      unmatchedSource,
      unmatchedTarget,
    };
  }

  /**
   * Get related skills for a given skill (useful for suggestions)
   */
  getRelatedSkills(skill: string): string[] {
    const node = this.lookupSkill(skill);
    if (!node) return [];

    return [
      ...node.related,
      ...node.children,
      ...(node.parent ? [node.parent] : []),
    ];
  }

  /**
   * Get complementary skills (from the COMPLEMENTARY_SKILLS matrix + taxonomy relations)
   */
  getComplementarySkills(skill: string): string[] {
    const node = this.lookupSkill(skill);
    if (!node) return [];

    // Taxonomy-defined related skills serve as complementary too
    return node.related;
  }

  /**
   * Check if taxonomy is loaded and available
   */
  isAvailable(): boolean {
    return this.loaded;
  }
}

// Export singleton instance
export const skillTaxonomyService = new SkillTaxonomyService();
