/**
 * Location Criterion Calculator
 *
 * Calculates match score based on geographic proximity.
 * Same city = 100% | Same country = 80% | Same region = 50%
 *
 * @module infrastructure/services/itemized-matching/criteria/ProfileCriteria/LocationCriterion
 */

import {
  BaseCriterionCalculator,
  MatchingProfile,
  CalculationContext,
  CriterionResult,
} from '../../interfaces/ICriterionCalculator';
import { CriterionImportance, MatchType } from '../../../../../domain/services/IItemizedMatchingService';
import { normalizeString, areStringSimilar } from '../../utils/ScoreUtils';

/**
 * Region mappings for geographic proximity
 */
const REGIONS: Record<string, string[]> = {
  'mena': ['uae', 'united arab emirates', 'dubai', 'abu dhabi', 'saudi arabia', 'ksa', 'egypt', 'jordan', 'qatar', 'kuwait', 'bahrain', 'oman', 'morocco', 'tunisia', 'lebanon'],
  'gcc': ['uae', 'united arab emirates', 'dubai', 'abu dhabi', 'saudi arabia', 'ksa', 'qatar', 'kuwait', 'bahrain', 'oman'],
  'north america': ['usa', 'united states', 'america', 'us', 'canada'],
  'western europe': ['uk', 'united kingdom', 'england', 'germany', 'france', 'spain', 'italy', 'netherlands', 'belgium', 'switzerland'],
  'northern europe': ['sweden', 'norway', 'denmark', 'finland', 'iceland'],
  'southeast asia': ['singapore', 'malaysia', 'indonesia', 'thailand', 'vietnam', 'philippines'],
  'south asia': ['india', 'pakistan', 'bangladesh', 'sri lanka'],
  'east asia': ['china', 'japan', 'south korea', 'korea', 'taiwan', 'hong kong'],
};

/**
 * Country aliases
 */
const COUNTRY_ALIASES: Record<string, string> = {
  'uae': 'united arab emirates',
  'us': 'united states',
  'usa': 'united states',
  'uk': 'united kingdom',
  'ksa': 'saudi arabia',
  'emirates': 'united arab emirates',
};

export class LocationCriterion extends BaseCriterionCalculator {
  readonly id = 'location';
  readonly name = 'Location';
  readonly icon = '📍';
  readonly defaultImportance: CriterionImportance = 'MEDIUM';
  readonly applicableMatchTypes = [
    'PROFILE_TO_PROFILE',
    'PROFILE_TO_USER',
    'JOB_TO_CANDIDATE',
    'PROJECT_TO_INVESTOR',
    'PROJECT_TO_DYNAMIC',
    'EVENT_ATTENDEE_MATCH',
  ];

  /**
   * Normalize location string and extract components
   */
  private parseLocation(location: string | undefined): {
    city?: string;
    country?: string;
    normalized: string;
  } {
    if (!location) return { normalized: '' };

    const normalized = normalizeString(location);
    const parts = normalized.split(/[,\s]+/).filter(p => p.length > 1);

    // Try to identify city and country
    // Common patterns: "City, Country" or "City, State, Country"
    let city: string | undefined;
    let country: string | undefined;

    if (parts.length >= 2) {
      city = parts[0];
      country = parts[parts.length - 1];

      // Check if last part is a country alias
      if (COUNTRY_ALIASES[country]) {
        country = COUNTRY_ALIASES[country];
      }
    } else if (parts.length === 1) {
      // Single part - could be city or country
      const part = parts[0];
      if (COUNTRY_ALIASES[part]) {
        country = COUNTRY_ALIASES[part];
      } else {
        // Check if it's a known country
        for (const [, countries] of Object.entries(REGIONS)) {
          if (countries.includes(part)) {
            country = part;
            break;
          }
        }
        if (!country) {
          city = part;
        }
      }
    }

    return { city, country, normalized };
  }

  /**
   * Check if two locations are in the same region
   */
  private isSameRegion(loc1: string, loc2: string): string | null {
    const n1 = normalizeString(loc1);
    const n2 = normalizeString(loc2);

    for (const [region, countries] of Object.entries(REGIONS)) {
      const inRegion1 = countries.some(c => n1.includes(c));
      const inRegion2 = countries.some(c => n2.includes(c));
      if (inRegion1 && inRegion2) {
        return region;
      }
    }

    return null;
  }

  async calculate(
    source: MatchingProfile,
    target: MatchingProfile,
    context: CalculationContext
  ): Promise<CriterionResult> {
    const sourceLocation = source.location;
    const targetLocation = target.location;

    // Handle missing locations
    if (!sourceLocation || !targetLocation) {
      return this.buildResult(
        0,
        'NONE',
        {
          summary: 'Location not specified',
          sourceValue: sourceLocation ? `${source.name}: ${sourceLocation}` : 'Location not provided',
          targetValue: targetLocation ? `${target.name}: ${targetLocation}` : 'Location not provided',
          matchType: 'NONE',
          details: ['Unable to compare locations'],
        },
        context,
        {
          sourceValues: sourceLocation ? [sourceLocation] : [],
          targetValues: targetLocation ? [targetLocation] : [],
          matchedCount: 0,
          totalCount: 0,
        }
      );
    }

    const sourceParsed = this.parseLocation(sourceLocation);
    const targetParsed = this.parseLocation(targetLocation);

    let score = 0;
    let matchType: MatchType = 'NONE';
    const details: string[] = [];
    let summary = '';

    // Check exact match (same city)
    if (sourceParsed.city && targetParsed.city &&
        areStringSimilar(sourceParsed.city, targetParsed.city, 0.8)) {
      score = 100;
      matchType = 'EXACT';
      details.push(`✅ Same city: ${sourceParsed.city}`);
      summary = `Same city: ${sourceParsed.city}`;
    }
    // Check same country
    else if (sourceParsed.country && targetParsed.country &&
             areStringSimilar(sourceParsed.country, targetParsed.country, 0.8)) {
      score = 80;
      matchType = 'PARTIAL';
      details.push(`✅ Same country: ${sourceParsed.country}`);
      summary = `Same country: ${sourceParsed.country}`;
    }
    // Check same region
    else {
      const region = this.isSameRegion(sourceLocation, targetLocation);
      if (region) {
        score = 50;
        matchType = 'PARTIAL';
        details.push(`🔄 Same region: ${region.toUpperCase()}`);
        summary = `Same region: ${region.toUpperCase()}`;
      } else {
        details.push(`❌ Different geographic regions`);
        summary = 'Different locations';
      }
    }

    return this.buildResult(
      score,
      matchType,
      {
        summary,
        sourceValue: `${source.name}: ${sourceLocation}`,
        targetValue: `${target.name}: ${targetLocation}`,
        matchType,
        details,
      },
      context,
      {
        sourceValues: [sourceLocation],
        targetValues: [targetLocation],
        matchedCount: score > 0 ? 1 : 0,
        totalCount: 1,
        additionalData: { sourceParsed, targetParsed },
      }
    );
  }
}

export default LocationCriterion;
