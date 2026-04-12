/**
 * Opportunity Criteria Index
 *
 * Exports all opportunity-specific criterion calculators.
 * Used for HIRING ↔ OPEN_TO_OPPORTUNITIES matching.
 *
 * @module infrastructure/services/itemized-matching/criteria/OpportunityCriteria
 */

export { RoleFitCriterion, default as RoleFitCriterionDefault } from './RoleFitCriterion';
export { OpportunitySeniorityCriterion, default as OpportunitySeniorityCriterionDefault } from './OpportunitySeniorityCriterion';
export { OpportunityLocationCriterion, default as OpportunityLocationCriterionDefault } from './OpportunityLocationCriterion';
export { OpportunitySkillsCriterion, default as OpportunitySkillsCriterionDefault } from './OpportunitySkillsCriterion';
export { OpportunitySectorCriterion, default as OpportunitySectorCriterionDefault } from './OpportunitySectorCriterion';

import { ICriterionCalculator } from '../../interfaces/ICriterionCalculator';
import { RoleFitCriterion } from './RoleFitCriterion';
import { OpportunitySeniorityCriterion } from './OpportunitySeniorityCriterion';
import { OpportunityLocationCriterion } from './OpportunityLocationCriterion';
import { OpportunitySkillsCriterion } from './OpportunitySkillsCriterion';
import { OpportunitySectorCriterion } from './OpportunitySectorCriterion';

// Import profile criteria that also apply to opportunities
import { NetworkCriterion } from '../ProfileCriteria/NetworkCriterion';

/**
 * Create instances of all Opportunity → Candidate criteria calculators
 * Spec: 6 criteria for Opportunity Matching (HIRING → Candidates)
 */
export function createOpportunityCriteria(): ICriterionCalculator[] {
  return [
    new RoleFitCriterion(),              // 1. CRITICAL - Role/area match
    new OpportunitySkillsCriterion(),    // 2. CRITICAL - Skills match
    new OpportunitySeniorityCriterion(), // 3. HIGH - Seniority level match
    new OpportunitySectorCriterion(),    // 4. HIGH - Industry/sector match
    new OpportunityLocationCriterion(),  // 5. MEDIUM - Location/remote compatibility
    new NetworkCriterion(),              // 6. MEDIUM - Network connections
  ];
}

/**
 * Get criteria for opportunity matching
 */
export function getOpportunityCriteria(matchType: string): ICriterionCalculator[] {
  switch (matchType) {
    case 'OPPORTUNITY_TO_CANDIDATE':
    case 'CANDIDATE_TO_OPPORTUNITY':
      return createOpportunityCriteria();
    default:
      return [];
  }
}

export default {
  createOpportunityCriteria,
  getOpportunityCriteria,
};
