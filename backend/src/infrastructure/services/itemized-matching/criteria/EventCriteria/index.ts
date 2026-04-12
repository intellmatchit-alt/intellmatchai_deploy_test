/**
 * Event Criteria Index
 *
 * Exports all event-specific criterion calculators.
 * Spec: 6 criteria for EVENT_ATTENDEE matching
 *
 * @module infrastructure/services/itemized-matching/criteria/EventCriteria
 */

export { ComplementaryGoalsCriterion, default as ComplementaryGoalsCriterionDefault } from './ComplementaryGoalsCriterion';
export { TopicsCriterion, default as TopicsCriterionDefault } from './TopicsCriterion';

import { ICriterionCalculator } from '../../interfaces/ICriterionCalculator';
import { ComplementaryGoalsCriterion } from './ComplementaryGoalsCriterion';
import { TopicsCriterion } from './TopicsCriterion';

// Import profile criteria that also apply to events
import { IndustryCriterion } from '../ProfileCriteria/IndustryCriterion';
import { SkillsCriterion } from '../ProfileCriteria/SkillsCriterion';
import { EducationCriterion } from '../ProfileCriteria/EducationCriterion';
import { NetworkCriterion } from '../ProfileCriteria/NetworkCriterion';

/**
 * Create instances of all event criteria calculators
 * Spec: 6 criteria for Event Matching
 */
export function createEventCriteria(): ICriterionCalculator[] {
  return [
    new ComplementaryGoalsCriterion(), // 1. CRITICAL - A wants what B offers
    new IndustryCriterion(),           // 2. HIGH - Same or related industries
    new SkillsCriterion(),             // 3. HIGH - Shared/complementary skills
    new EducationCriterion(),          // 4. MEDIUM - Same university connection
    new NetworkCriterion(),            // 5. HIGH - Mutual connections for warm intro
    new TopicsCriterion(),             // 6. MEDIUM - Shared event topics
  ];
}

export default createEventCriteria;
