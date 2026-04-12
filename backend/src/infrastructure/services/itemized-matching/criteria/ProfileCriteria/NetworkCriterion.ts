/**
 * Network Proximity Criterion Calculator
 *
 * Calculates match score based on network connections and mutual relationships.
 * 1st degree (direct) = 100% | 2nd degree (1-3 mutual) = 70% | 3rd degree (indirect) = 40%
 *
 * @module infrastructure/services/itemized-matching/criteria/ProfileCriteria/NetworkCriterion
 */

import {
  BaseCriterionCalculator,
  MatchingProfile,
  CalculationContext,
  CriterionResult,
} from '../../interfaces/ICriterionCalculator';
import { CriterionImportance, MatchType } from '../../../../../domain/services/IItemizedMatchingService';

/**
 * Network degree definitions
 */
const NETWORK_DEGREES = {
  FIRST: 1,   // Direct connection
  SECOND: 2,  // One connection away (mutual connections)
  THIRD: 3,   // Two connections away
  NONE: 0,    // No connection path found
} as const;

export class NetworkCriterion extends BaseCriterionCalculator {
  readonly id = 'network';
  readonly name = 'Network Proximity';
  readonly icon = '🔗';
  readonly defaultImportance: CriterionImportance = 'MEDIUM';
  readonly applicableMatchTypes = [
    'PROFILE_TO_PROFILE',
    'PROFILE_TO_USER',
    'PROJECT_TO_DYNAMIC',
  ];

  /**
   * Determine network degree from mutual connections count
   */
  private getNetworkDegree(mutualConnections: number | undefined, networkDegree: number | undefined): {
    degree: number;
    label: string;
  } {
    // If explicit network degree is provided, use it
    if (networkDegree !== undefined && networkDegree > 0) {
      if (networkDegree === 1) return { degree: 1, label: '1st degree' };
      if (networkDegree === 2) return { degree: 2, label: '2nd degree' };
      if (networkDegree === 3) return { degree: 3, label: '3rd degree' };
      return { degree: networkDegree, label: `${networkDegree}th degree` };
    }

    // Infer from mutual connections
    if (mutualConnections === undefined || mutualConnections === 0) {
      return { degree: 0, label: 'No connections' };
    }

    // Mutual connections imply at least 2nd degree
    if (mutualConnections >= 10) {
      return { degree: 2, label: '2nd degree (strong)' };
    }
    if (mutualConnections >= 5) {
      return { degree: 2, label: '2nd degree' };
    }
    if (mutualConnections >= 1) {
      return { degree: 2, label: '2nd degree (weak)' };
    }

    return { degree: 0, label: 'No connections' };
  }

  /**
   * Calculate score based on network degree and mutual connections
   */
  private calculateNetworkScore(
    mutualConnections: number | undefined,
    networkDegree: number | undefined
  ): { score: number; matchType: MatchType } {
    const { degree } = this.getNetworkDegree(mutualConnections, networkDegree);

    if (degree === 1) {
      // Direct connection
      return { score: 100, matchType: 'EXACT' };
    }
    if (degree === 2) {
      // 2nd degree - score varies by mutual connection count
      const mutuals = mutualConnections || 0;
      if (mutuals >= 10) return { score: 85, matchType: 'PARTIAL' };
      if (mutuals >= 5) return { score: 75, matchType: 'PARTIAL' };
      if (mutuals >= 3) return { score: 65, matchType: 'PARTIAL' };
      return { score: 55, matchType: 'PARTIAL' };
    }
    if (degree === 3) {
      // 3rd degree
      return { score: 40, matchType: 'PARTIAL' };
    }

    // No known connection
    return { score: 0, matchType: 'NONE' };
  }

  async calculate(
    source: MatchingProfile,
    target: MatchingProfile,
    context: CalculationContext
  ): Promise<CriterionResult> {
    // Extract network data from target profile (contact)
    // The data is typically computed and stored with the contact
    const mutualConnections = target.mutualConnections;
    const networkDegree = target.networkDegree;

    // Check if we have any network data
    const hasNetworkData = mutualConnections !== undefined || networkDegree !== undefined;

    if (!hasNetworkData) {
      return this.buildResult(
        0,
        'NONE',
        {
          summary: 'Network data not available',
          sourceValue: source.name,
          targetValue: target.name,
          matchType: 'NONE',
          details: ['No network proximity data available'],
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

    const { score, matchType } = this.calculateNetworkScore(mutualConnections, networkDegree);
    const { degree, label } = this.getNetworkDegree(mutualConnections, networkDegree);
    const details: string[] = [];
    let summary = '';

    if (degree === 1) {
      details.push(`✅ Direct connection (1st degree)`);
      summary = 'Direct connection';
    } else if (degree === 2) {
      const mutuals = mutualConnections || 0;
      details.push(`🔄 ${label} connection`);
      if (mutuals > 0) {
        details.push(`👥 ${mutuals} mutual connection${mutuals > 1 ? 's' : ''}`);
      }
      summary = mutuals > 0 ? `${mutuals} mutual connection${mutuals > 1 ? 's' : ''}` : '2nd degree connection';
    } else if (degree === 3) {
      details.push(`🔗 ${label} connection`);
      summary = '3rd degree connection';
    } else {
      details.push(`❌ No network connection found`);
      summary = 'No shared network';
    }

    return this.buildResult(
      score,
      matchType,
      {
        summary,
        sourceValue: source.name,
        targetValue: target.name,
        matchType,
        details,
      },
      context,
      {
        sourceValues: [],
        targetValues: [],
        matchedCount: score > 0 ? 1 : 0,
        totalCount: 1,
        additionalData: {
          mutualConnections,
          networkDegree,
          inferredDegree: degree,
        },
      }
    );
  }
}

export default NetworkCriterion;
