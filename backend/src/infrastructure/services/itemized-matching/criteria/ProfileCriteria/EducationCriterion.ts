/**
 * Education Criterion Calculator
 *
 * Calculates match score based on educational background.
 * Same school = 100% | Same field = 70% | Related field = 40%
 *
 * Parses education data from Contact.enrichmentData JSON field.
 *
 * @module infrastructure/services/itemized-matching/criteria/ProfileCriteria/EducationCriterion
 */

import {
  BaseCriterionCalculator,
  MatchingProfile,
  CalculationContext,
  CriterionResult,
  EducationInfo,
} from '../../interfaces/ICriterionCalculator';
import { CriterionImportance, MatchType } from '../../../../../domain/services/IItemizedMatchingService';
import { normalizeString, areStringSimilar } from '../../utils/ScoreUtils';

/**
 * Related fields of study
 */
const RELATED_FIELDS: Record<string, string[]> = {
  'computer science': ['software engineering', 'information technology', 'it', 'computing', 'data science', 'artificial intelligence', 'cybersecurity'],
  'engineering': ['electrical engineering', 'mechanical engineering', 'civil engineering', 'chemical engineering', 'industrial engineering'],
  'business': ['mba', 'business administration', 'management', 'finance', 'accounting', 'economics', 'marketing'],
  'medicine': ['healthcare', 'nursing', 'pharmacy', 'public health', 'biomedical', 'medical sciences'],
  'law': ['legal studies', 'jurisprudence', 'international law', 'corporate law'],
  'design': ['graphic design', 'ux design', 'ui design', 'industrial design', 'architecture'],
  'science': ['physics', 'chemistry', 'biology', 'mathematics', 'statistics'],
  'arts': ['fine arts', 'liberal arts', 'music', 'theater', 'film', 'media studies'],
};

/**
 * Notable university tiers/groups for prestige matching
 */
const UNIVERSITY_GROUPS: Record<string, string[]> = {
  'ivy league': ['harvard', 'yale', 'princeton', 'columbia', 'brown', 'cornell', 'dartmouth', 'penn', 'upenn', 'university of pennsylvania'],
  'uk top': ['oxford', 'cambridge', 'imperial', 'lse', 'ucl', 'london school of economics'],
  'us top tech': ['mit', 'stanford', 'caltech', 'carnegie mellon', 'georgia tech', 'uc berkeley', 'berkeley'],
  'mena top': ['american university', 'auc', 'aub', 'kaust', 'nyuad', 'khalifa', 'ain shams', 'cairo university'],
};

export class EducationCriterion extends BaseCriterionCalculator {
  readonly id = 'education';
  readonly name = 'Education';
  readonly icon = '🎓';
  readonly defaultImportance: CriterionImportance = 'MEDIUM';
  readonly applicableMatchTypes = [
    'PROFILE_TO_PROFILE',
    'PROFILE_TO_USER',
    'JOB_TO_CANDIDATE',
    'EVENT_ATTENDEE_MATCH',
  ];

  /**
   * Extract education info from profile
   * Handles both structured education array and enrichmentData JSON
   */
  private extractEducation(profile: MatchingProfile): EducationInfo[] {
    // First check if structured education data exists
    if (profile.education && profile.education.length > 0) {
      return profile.education;
    }

    // Try to parse from enrichmentData (stored in rawData)
    const enrichmentData = profile.rawData?.enrichmentData;
    if (enrichmentData) {
      const parsed = typeof enrichmentData === 'string' ?
        this.safeJsonParse(enrichmentData) : enrichmentData;

      if (parsed) {
        return this.parseEducationFromEnrichment(parsed);
      }
    }

    // Try bio field as last resort
    if (profile.bio) {
      return this.parseEducationFromBio(profile.bio);
    }

    return [];
  }

  /**
   * Safely parse JSON
   */
  private safeJsonParse(str: string): any {
    try {
      return JSON.parse(str);
    } catch {
      return null;
    }
  }

  /**
   * Parse education from enrichment data JSON
   * Handles various enrichment provider formats
   */
  private parseEducationFromEnrichment(data: any): EducationInfo[] {
    const education: EducationInfo[] = [];

    // Common paths for education data in enrichment providers
    const eduPaths = [
      data.education,
      data.educations,
      data.schools,
      data.academic,
      data.profile?.education,
    ];

    for (const eduArray of eduPaths) {
      if (Array.isArray(eduArray)) {
        for (const edu of eduArray) {
          const info: EducationInfo = {
            school: edu.school || edu.schoolName || edu.institution || edu.university || edu.name,
            degree: edu.degree || edu.degreeName || edu.qualification,
            field: edu.field || edu.fieldOfStudy || edu.major || edu.subject || edu.specialization,
            year: edu.year || edu.endYear || edu.graduationYear,
            normalized: '',
          };

          // Build normalized string for comparison
          const parts = [info.school, info.degree, info.field].filter(Boolean);
          info.normalized = normalizeString(parts.join(' '));

          if (info.school || info.field) {
            education.push(info);
          }
        }
        break;
      }
    }

    return education;
  }

  /**
   * Parse education from bio text using heuristics
   */
  private parseEducationFromBio(bio: string): EducationInfo[] {
    const education: EducationInfo[] = [];
    const normalized = normalizeString(bio);

    // Look for degree mentions
    const degreePatterns = [
      /\b(phd|ph\.d|doctorate)\b.*?(?:in|from)?\s*(\w+(?:\s+\w+)*)/i,
      /\b(mba|master|masters|m\.s\.|ms|m\.a\.)\b.*?(?:in|from)?\s*(\w+(?:\s+\w+)*)/i,
      /\b(bachelor|b\.s\.|bs|b\.a\.)\b.*?(?:in|from)?\s*(\w+(?:\s+\w+)*)/i,
    ];

    for (const pattern of degreePatterns) {
      const match = bio.match(pattern);
      if (match) {
        education.push({
          degree: match[1],
          field: match[2],
          normalized: normalizeString(`${match[1]} ${match[2]}`),
        });
      }
    }

    // Look for university mentions
    for (const [, universities] of Object.entries(UNIVERSITY_GROUPS)) {
      for (const uni of universities) {
        if (normalized.includes(normalizeString(uni))) {
          education.push({
            school: uni,
            normalized: normalizeString(uni),
          });
        }
      }
    }

    return education;
  }

  /**
   * Check if two schools are the same or in same group
   */
  private compareSchools(school1: string | undefined, school2: string | undefined): {
    score: number;
    type: 'EXACT' | 'SAME_GROUP' | 'NONE';
    group?: string;
  } {
    if (!school1 || !school2) {
      return { score: 0, type: 'NONE' };
    }

    const n1 = normalizeString(school1);
    const n2 = normalizeString(school2);

    // Exact match
    if (areStringSimilar(n1, n2, 0.85)) {
      return { score: 100, type: 'EXACT' };
    }

    // Check if both are in same group
    for (const [group, universities] of Object.entries(UNIVERSITY_GROUPS)) {
      const normalizedUnis = universities.map(u => normalizeString(u));
      const inGroup1 = normalizedUnis.some(u => n1.includes(u) || u.includes(n1));
      const inGroup2 = normalizedUnis.some(u => n2.includes(u) || u.includes(n2));

      if (inGroup1 && inGroup2) {
        return { score: 80, type: 'SAME_GROUP', group };
      }
    }

    return { score: 0, type: 'NONE' };
  }

  /**
   * Check if two fields of study are related
   */
  private compareFields(field1: string | undefined, field2: string | undefined): {
    score: number;
    type: 'EXACT' | 'RELATED' | 'NONE';
  } {
    if (!field1 || !field2) {
      return { score: 0, type: 'NONE' };
    }

    const n1 = normalizeString(field1);
    const n2 = normalizeString(field2);

    // Exact match
    if (areStringSimilar(n1, n2, 0.8)) {
      return { score: 100, type: 'EXACT' };
    }

    // Check related fields
    for (const [mainField, related] of Object.entries(RELATED_FIELDS)) {
      const normalizedMain = normalizeString(mainField);
      const normalizedRelated = related.map(r => normalizeString(r));
      const allInCategory = [normalizedMain, ...normalizedRelated];

      const inCategory1 = allInCategory.some(f => n1.includes(f) || f.includes(n1));
      const inCategory2 = allInCategory.some(f => n2.includes(f) || f.includes(n2));

      if (inCategory1 && inCategory2) {
        return { score: 70, type: 'RELATED' };
      }
    }

    return { score: 0, type: 'NONE' };
  }

  async calculate(
    source: MatchingProfile,
    target: MatchingProfile,
    context: CalculationContext
  ): Promise<CriterionResult> {
    const sourceEducation = this.extractEducation(source);
    const targetEducation = this.extractEducation(target);

    // Handle missing education data
    if (sourceEducation.length === 0 || targetEducation.length === 0) {
      return this.buildResult(
        0,
        'NONE',
        {
          summary: 'Education data not available',
          sourceValue: sourceEducation.length > 0 ?
            `${source.name}: ${sourceEducation.map(e => e.school || e.field).filter(Boolean).join(', ')}` :
            'Education not specified',
          targetValue: targetEducation.length > 0 ?
            `${target.name}: ${targetEducation.map(e => e.school || e.field).filter(Boolean).join(', ')}` :
            'Education not specified',
          matchType: 'NONE',
          details: ['No education data available for comparison'],
        },
        context,
        {
          sourceValues: sourceEducation.map(e => e.normalized),
          targetValues: targetEducation.map(e => e.normalized),
          matchedCount: 0,
          totalCount: Math.max(sourceEducation.length, targetEducation.length),
        }
      );
    }

    // Compare all education entries
    let bestSchoolMatch: { score: number; type: 'EXACT' | 'SAME_GROUP' | 'NONE'; details: string } = { score: 0, type: 'NONE', details: '' };
    let bestFieldMatch: { score: number; type: 'EXACT' | 'RELATED' | 'NONE'; details: string } = { score: 0, type: 'NONE', details: '' };

    for (const srcEdu of sourceEducation) {
      for (const tgtEdu of targetEducation) {
        // Compare schools
        const schoolMatch = this.compareSchools(srcEdu.school, tgtEdu.school);
        if (schoolMatch.score > bestSchoolMatch.score) {
          bestSchoolMatch = {
            score: schoolMatch.score,
            type: schoolMatch.type,
            details: schoolMatch.type === 'EXACT' ?
              `Same school: ${srcEdu.school}` :
              schoolMatch.type === 'SAME_GROUP' ?
                `Same university group: ${schoolMatch.group}` : '',
          };
        }

        // Compare fields
        const fieldMatch = this.compareFields(srcEdu.field, tgtEdu.field);
        if (fieldMatch.score > bestFieldMatch.score) {
          bestFieldMatch = {
            score: fieldMatch.score,
            type: fieldMatch.type,
            details: fieldMatch.type === 'EXACT' ?
              `Same field: ${srcEdu.field}` :
              fieldMatch.type === 'RELATED' ?
                `Related fields: ${srcEdu.field} & ${tgtEdu.field}` : '',
          };
        }
      }
    }

    // Calculate overall score (school match weighted higher)
    const score = Math.max(
      bestSchoolMatch.score,
      bestFieldMatch.score * 0.7
    );

    const matchType: MatchType = score >= 80 ? 'EXACT' :
                                  score >= 40 ? 'PARTIAL' : 'NONE';

    const details: string[] = [];
    if (bestSchoolMatch.score > 0) {
      details.push(bestSchoolMatch.type === 'EXACT' ?
        `✅ ${bestSchoolMatch.details}` : `🔄 ${bestSchoolMatch.details}`);
    }
    if (bestFieldMatch.score > 0 && bestFieldMatch.type !== 'NONE') {
      details.push(bestFieldMatch.type === 'EXACT' ?
        `✅ ${bestFieldMatch.details}` : `🔄 ${bestFieldMatch.details}`);
    }
    if (details.length === 0) {
      details.push('❌ No education overlap found');
    }

    const summary = bestSchoolMatch.score >= 80 ? bestSchoolMatch.details :
                    bestFieldMatch.score >= 70 ? bestFieldMatch.details :
                    score > 0 ? 'Some educational overlap' : 'No education overlap';

    return this.buildResult(
      Math.round(score),
      matchType,
      {
        summary,
        sourceValue: `${source.name}: ${sourceEducation.map(e => [e.school, e.field].filter(Boolean).join(' - ')).join('; ')}`,
        targetValue: `${target.name}: ${targetEducation.map(e => [e.school, e.field].filter(Boolean).join(' - ')).join('; ')}`,
        matchType,
        details,
      },
      context,
      {
        sourceValues: sourceEducation.map(e => e.normalized),
        targetValues: targetEducation.map(e => e.normalized),
        matchedCount: (bestSchoolMatch.score > 0 ? 1 : 0) + (bestFieldMatch.score > 0 ? 1 : 0),
        totalCount: 2,
        additionalData: {
          sourceEducation,
          targetEducation,
          bestSchoolMatch,
          bestFieldMatch,
        },
      }
    );
  }
}

export default EducationCriterion;
