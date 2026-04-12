/**
 * Geography Focus Criterion Calculator
 *
 * Calculates match score based on project location vs investor geographic focus.
 * Used for PROJECT_TO_INVESTOR matching.
 *
 * @module infrastructure/services/itemized-matching/criteria/ItemCriteria/GeographyFocusCriterion
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
 * Region definitions for geographic matching
 */
const REGIONS: Record<string, string[]> = {
  'mena': ['uae', 'united arab emirates', 'dubai', 'abu dhabi', 'saudi arabia', 'ksa', 'egypt', 'jordan', 'qatar', 'kuwait', 'bahrain', 'oman', 'morocco', 'tunisia', 'lebanon', 'middle east', 'north africa'],
  'gcc': ['uae', 'united arab emirates', 'dubai', 'abu dhabi', 'saudi arabia', 'ksa', 'qatar', 'kuwait', 'bahrain', 'oman'],
  'north america': ['usa', 'united states', 'america', 'us', 'canada', 'mexico'],
  'europe': ['uk', 'united kingdom', 'england', 'germany', 'france', 'spain', 'italy', 'netherlands', 'belgium', 'switzerland', 'sweden', 'norway', 'denmark', 'finland', 'ireland', 'portugal', 'austria', 'poland'],
  'asia pacific': ['singapore', 'malaysia', 'indonesia', 'thailand', 'vietnam', 'philippines', 'china', 'japan', 'south korea', 'korea', 'taiwan', 'hong kong', 'india', 'australia', 'new zealand'],
  'latam': ['brazil', 'argentina', 'chile', 'colombia', 'peru', 'mexico', 'latin america', 'south america'],
  'africa': ['nigeria', 'kenya', 'south africa', 'ghana', 'rwanda', 'ethiopia', 'tanzania', 'sub-saharan'],
  'global': ['global', 'worldwide', 'international', 'any region'],
};

export class GeographyFocusCriterion extends BaseCriterionCalculator {
  readonly id = 'geography_focus';
  readonly name = 'Geography Focus';
  readonly icon = '🌍';
  readonly defaultImportance: CriterionImportance = 'MEDIUM';
  readonly applicableMatchTypes = [
    'PROJECT_TO_INVESTOR',
    'PROJECT_TO_DYNAMIC',
    'DEAL_TO_BUYER',
    'DEAL_TO_PROVIDER',
  ];

  /**
   * Extract investor geography focus from enrichmentData and bio
   */
  private extractInvestorGeography(profile: MatchingProfile): string[] {
    const geographies: string[] = [];

    // Check geographyFocus field
    if (profile.geographyFocus) {
      geographies.push(...profile.geographyFocus.map(g => normalizeString(g)));
    }

    // Check location
    if (profile.location) {
      geographies.push(normalizeString(profile.location));
    }

    // Check enrichmentData
    const enrichment = profile.rawData?.enrichmentData;
    if (enrichment) {
      const parsed = typeof enrichment === 'string' ?
        this.safeJsonParse(enrichment) : enrichment;

      if (parsed) {
        const geoPaths = [
          parsed.geographyFocus,
          parsed.geography_focus,
          parsed.regions,
          parsed.markets,
          parsed.target_markets,
          parsed.investment_regions,
        ];

        for (const geoData of geoPaths) {
          if (Array.isArray(geoData)) {
            geographies.push(...geoData.map((g: any) => normalizeString(typeof g === 'string' ? g : g.name || '')));
          } else if (typeof geoData === 'string') {
            geographies.push(normalizeString(geoData));
          }
        }
      }
    }

    // Parse from bio
    if (profile.bio) {
      const bioLower = profile.bio.toLowerCase();
      for (const [region, countries] of Object.entries(REGIONS)) {
        if (bioLower.includes(region)) {
          geographies.push(region);
        }
        for (const country of countries) {
          if (bioLower.includes(country)) {
            geographies.push(country);
          }
        }
      }
    }

    return [...new Set(geographies.filter(Boolean))];
  }

  private safeJsonParse(str: string): any {
    try {
      return JSON.parse(str);
    } catch {
      return null;
    }
  }

  /**
   * Get regions a location belongs to
   */
  private getRegionsForLocation(location: string): string[] {
    const normalized = normalizeString(location);
    const matchedRegions: string[] = [];

    for (const [region, countries] of Object.entries(REGIONS)) {
      if (normalized.includes(region) || region.includes(normalized)) {
        matchedRegions.push(region);
      }
      for (const country of countries) {
        if (normalized.includes(country) || country.includes(normalized)) {
          matchedRegions.push(region);
          break;
        }
      }
    }

    return [...new Set(matchedRegions)];
  }

  /**
   * Check if two locations match (same country or same region)
   */
  private checkGeographyMatch(projectLocation: string, investorGeographies: string[]): {
    score: number;
    matchType: 'EXACT' | 'REGION' | 'GLOBAL' | 'NONE';
    matchedOn?: string;
  } {
    const projectNorm = normalizeString(projectLocation);
    const projectRegions = this.getRegionsForLocation(projectLocation);

    // Check for global investors
    for (const geo of investorGeographies) {
      if (REGIONS['global'].some(g => geo.includes(g))) {
        return { score: 80, matchType: 'GLOBAL', matchedOn: 'Global focus' };
      }
    }

    // Check for exact location match
    for (const geo of investorGeographies) {
      if (areStringSimilar(projectNorm, geo, 0.8) || projectNorm.includes(geo) || geo.includes(projectNorm)) {
        return { score: 100, matchType: 'EXACT', matchedOn: projectLocation };
      }
    }

    // Check for region match
    for (const projectRegion of projectRegions) {
      for (const geo of investorGeographies) {
        // Direct region match
        if (geo === projectRegion) {
          return { score: 85, matchType: 'REGION', matchedOn: projectRegion.toUpperCase() };
        }
        // Check if investor geography is in same region
        const investorRegions = this.getRegionsForLocation(geo);
        if (investorRegions.includes(projectRegion)) {
          return { score: 80, matchType: 'REGION', matchedOn: projectRegion.toUpperCase() };
        }
      }
    }

    return { score: 0, matchType: 'NONE' };
  }

  async calculate(
    source: MatchingProfile,
    target: MatchingProfile,
    context: CalculationContext
  ): Promise<CriterionResult> {
    // Source is project, target is investor
    const projectLocation = source.location;
    const investorGeographies = this.extractInvestorGeography(target);

    // Handle missing project location
    if (!projectLocation) {
      return this.buildResult(
        30,
        'PARTIAL',
        {
          summary: 'Project location not specified',
          sourceValue: 'Location not defined',
          targetValue: investorGeographies.length > 0 ? investorGeographies.join(', ') : 'No geographic focus',
          matchType: 'PARTIAL',
          details: ['⚠️ Cannot evaluate geography fit without project location'],
        },
        context,
        { sourceValues: [], targetValues: investorGeographies, matchedCount: 0, totalCount: 0 }
      );
    }

    // If investor has no stated geography focus, assume global
    if (investorGeographies.length === 0) {
      return this.buildResult(
        60,
        'PARTIAL',
        {
          summary: 'Investor geography focus unknown',
          sourceValue: `Project: ${projectLocation}`,
          targetValue: 'Geography focus not specified (assumed flexible)',
          matchType: 'PARTIAL',
          details: ['⚠️ Investor geographic focus not specified', 'Assuming flexible/global interest'],
        },
        context,
        { sourceValues: [projectLocation], targetValues: [], matchedCount: 0, totalCount: 1 }
      );
    }

    const match = this.checkGeographyMatch(projectLocation, investorGeographies);
    const details: string[] = [];
    let summary = '';

    switch (match.matchType) {
      case 'EXACT':
        details.push(`✅ Direct location match: ${match.matchedOn}`);
        summary = `Same location: ${match.matchedOn}`;
        break;
      case 'REGION':
        details.push(`✅ Same region: ${match.matchedOn}`);
        summary = `Same region: ${match.matchedOn}`;
        break;
      case 'GLOBAL':
        details.push(`🌍 Investor has global focus`);
        summary = 'Global investor';
        break;
      default:
        details.push(`❌ Geographic mismatch: Project in ${projectLocation}, investor focuses on ${investorGeographies.slice(0, 3).join(', ')}`);
        summary = 'Different geographic focus';
    }

    return this.buildResult(
      match.score,
      match.matchType === 'EXACT' ? 'EXACT' : match.matchType === 'NONE' ? 'NONE' : 'PARTIAL',
      {
        summary,
        sourceValue: `Project: ${projectLocation}`,
        targetValue: `${target.name}: ${investorGeographies.join(', ')}`,
        matchType: match.matchType === 'EXACT' ? 'EXACT' : match.matchType === 'NONE' ? 'NONE' : 'PARTIAL',
        details,
      },
      context,
      {
        sourceValues: [projectLocation],
        targetValues: investorGeographies,
        matchedCount: match.score > 0 ? 1 : 0,
        totalCount: 1,
        additionalData: { projectLocation, investorGeographies, match },
      }
    );
  }
}

export default GeographyFocusCriterion;
