/**
 * Pitch Relevance Criterion Calculator
 *
 * CRITICAL: Compares pitch keywords/skills against contact expertise.
 * Aggregates inferred skills and keywords from pitch sections,
 * then matches against contact skills and sectors.
 *
 * @module infrastructure/services/itemized-matching/criteria/PitchCriteria/PitchRelevanceCriterion
 */

import {
  BaseCriterionCalculator,
  MatchingProfile,
  CalculationContext,
  CriterionResult,
} from '../../interfaces/ICriterionCalculator';
import { CriterionImportance, MatchType } from '../../../../../domain/services/IItemizedMatchingService';
import { normalizeString, findCommonItems } from '../../utils/ScoreUtils';

export class PitchRelevanceCriterion extends BaseCriterionCalculator {
  readonly id = 'pitch_relevance';
  readonly name = 'Pitch Relevance';
  readonly icon = '🎯';
  readonly defaultImportance: CriterionImportance = 'CRITICAL';
  readonly applicableMatchTypes = ['PITCH_TO_CONTACT'];

  async calculate(
    source: MatchingProfile,
    target: MatchingProfile,
    context: CalculationContext
  ): Promise<CriterionResult> {
    // Source is pitch profile, target is contact
    const pitchSkills = source.skills.map(s => normalizeString(s));
    const contactSkills = target.skills.map(s => normalizeString(s));
    const contactSectors = target.sectors.map(s => normalizeString(s));

    // Combine contact skills + sectors for broader matching
    const contactExpertise = [...new Set([...contactSkills, ...contactSectors])];

    if (pitchSkills.length === 0) {
      return this.buildResult(
        0,
        'NONE',
        {
          summary: 'Pitch keywords not available',
          sourceValue: 'No keywords extracted',
          targetValue: contactExpertise.length > 0 ? contactExpertise.join(', ') : 'No expertise data',
          matchType: 'NONE',
          details: ['Cannot evaluate pitch relevance without keywords'],
        },
        context,
        { sourceValues: [], targetValues: contactExpertise, matchedCount: 0, totalCount: 0 }
      );
    }

    if (contactExpertise.length === 0) {
      return this.buildResult(
        20,
        'PARTIAL',
        {
          summary: 'Contact expertise unknown',
          sourceValue: `Pitch: ${pitchSkills.slice(0, 5).join(', ')}`,
          targetValue: 'No skills/sectors on contact',
          matchType: 'PARTIAL',
          details: ['Contact has no skills or sectors to compare against'],
        },
        context,
        { sourceValues: pitchSkills, targetValues: [], matchedCount: 0, totalCount: pitchSkills.length }
      );
    }

    // Find exact matches
    const exactMatches = findCommonItems(pitchSkills, contactExpertise);

    // Find partial matches (substring matching)
    const partialMatches: string[] = [];
    for (const pitchSkill of pitchSkills) {
      if (exactMatches.some(m => normalizeString(m) === pitchSkill)) continue;
      for (const expertise of contactExpertise) {
        if (pitchSkill.includes(expertise) || expertise.includes(pitchSkill)) {
          if (!partialMatches.includes(pitchSkill)) {
            partialMatches.push(pitchSkill);
          }
        }
      }
    }

    // Calculate score
    let score = 0;
    let matchType: MatchType = 'NONE';

    if (exactMatches.length > 0) {
      const matchRatio = exactMatches.length / Math.min(pitchSkills.length, contactExpertise.length);
      score = Math.min(100, 50 + matchRatio * 50);
      matchType = matchRatio >= 0.5 ? 'EXACT' : 'PARTIAL';
    }

    if (partialMatches.length > 0 && score < 100) {
      score = Math.min(100, score + partialMatches.length * 10);
      if (matchType === 'NONE') matchType = 'PARTIAL';
    }

    // Build details
    const details: string[] = [];
    for (const match of exactMatches.slice(0, 5)) {
      details.push(`\u2705 Pitch keyword matches: ${match}`);
    }
    for (const match of partialMatches.slice(0, 3)) {
      details.push(`\ud83d\udd04 Related keyword: ${match}`);
    }
    if (details.length === 0) {
      details.push('\u274c No keyword overlap between pitch and contact expertise');
    }

    const summary = exactMatches.length > 0
      ? `${exactMatches.length} keyword${exactMatches.length > 1 ? 's' : ''} match: ${exactMatches.slice(0, 3).join(', ')}`
      : partialMatches.length > 0
        ? `Related keywords found`
        : 'No keyword relevance';

    return this.buildResult(
      score,
      matchType,
      {
        summary,
        sourceValue: `Pitch: ${pitchSkills.slice(0, 5).join(', ')}`,
        targetValue: `${target.name}: ${contactExpertise.slice(0, 5).join(', ')}`,
        matchType,
        details,
      },
      context,
      {
        sourceValues: pitchSkills,
        targetValues: contactExpertise,
        matchedCount: exactMatches.length + partialMatches.length,
        totalCount: pitchSkills.length,
        additionalData: { exactMatches, partialMatches },
      }
    );
  }
}

export default PitchRelevanceCriterion;
