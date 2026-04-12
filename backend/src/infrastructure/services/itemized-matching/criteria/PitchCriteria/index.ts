/**
 * Pitch Criteria Index
 *
 * Exports all pitch-specific criterion calculators.
 * Used for PITCH_TO_CONTACT matching (pitch deck vs contact expertise).
 *
 * Criteria (5 total, 4 reused from other modules):
 * 1. IndustryFitCriterion (CRITICAL) - pitch sectors vs contact sectors
 * 2. PitchRelevanceCriterion (CRITICAL) - pitch keywords vs contact expertise
 * 3. ThesisFitCriterion (HIGH) - problem/solution alignment
 * 4. GeographyFocusCriterion (MEDIUM) - location matching
 * 5. NetworkCriterion (MEDIUM) - network proximity
 *
 * @module infrastructure/services/itemized-matching/criteria/PitchCriteria
 */

import { ICriterionCalculator } from '../../interfaces/ICriterionCalculator';
import { IndustryFitCriterion } from '../ItemCriteria/IndustryFitCriterion';
import { ThesisFitCriterion } from '../ItemCriteria/ThesisFitCriterion';
import { GeographyFocusCriterion } from '../ItemCriteria/GeographyFocusCriterion';
import { NetworkCriterion } from '../ProfileCriteria/NetworkCriterion';
import { PitchRelevanceCriterion } from './PitchRelevanceCriterion';

export { PitchRelevanceCriterion } from './PitchRelevanceCriterion';

/**
 * Create instances of all Pitch → Contact criteria calculators.
 *
 * We extend applicableMatchTypes on the reused criteria at runtime
 * so they pass the isApplicable('PITCH_TO_CONTACT') check.
 */
export function createPitchCriteria(): ICriterionCalculator[] {
  const industryFit = new IndustryFitCriterion();
  const thesisFit = new ThesisFitCriterion();
  const geographyFocus = new GeographyFocusCriterion();
  const network = new NetworkCriterion();
  const pitchRelevance = new PitchRelevanceCriterion();

  // Extend applicableMatchTypes to include PITCH_TO_CONTACT
  (industryFit as any).applicableMatchTypes = [...industryFit.applicableMatchTypes, 'PITCH_TO_CONTACT'];
  (thesisFit as any).applicableMatchTypes = [...thesisFit.applicableMatchTypes, 'PITCH_TO_CONTACT'];
  (geographyFocus as any).applicableMatchTypes = [...geographyFocus.applicableMatchTypes, 'PITCH_TO_CONTACT'];
  (network as any).applicableMatchTypes = [...network.applicableMatchTypes, 'PITCH_TO_CONTACT'];

  return [
    industryFit,       // 1. CRITICAL - Sector matching
    pitchRelevance,    // 2. CRITICAL - Pitch keywords vs contact expertise
    thesisFit,         // 3. HIGH - Problem/solution alignment
    geographyFocus,    // 4. MEDIUM - Geography
    network,           // 5. MEDIUM - Network proximity
  ];
}

export default { createPitchCriteria };
