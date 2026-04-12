/**
 * Profile Criteria Index
 *
 * Exports all profile-to-profile criterion calculators.
 *
 * @module infrastructure/services/itemized-matching/criteria/ProfileCriteria
 */

export { IndustryCriterion, default as IndustryCriterionDefault } from './IndustryCriterion';
export { SkillsCriterion, default as SkillsCriterionDefault } from './SkillsCriterion';
export { GoalsCriterion, default as GoalsCriterionDefault } from './GoalsCriterion';
export { LocationCriterion, default as LocationCriterionDefault } from './LocationCriterion';
export { InterestsCriterion, default as InterestsCriterionDefault } from './InterestsCriterion';
export { CompanyCriterion, default as CompanyCriterionDefault } from './CompanyCriterion';
export { ExperienceCriterion, default as ExperienceCriterionDefault } from './ExperienceCriterion';
export { NetworkCriterion, default as NetworkCriterionDefault } from './NetworkCriterion';
export { EducationCriterion, default as EducationCriterionDefault } from './EducationCriterion';
export { LanguagesCriterion, default as LanguagesCriterionDefault } from './LanguagesCriterion';

import { ICriterionCalculator } from '../../interfaces/ICriterionCalculator';
import { IndustryCriterion } from './IndustryCriterion';
import { SkillsCriterion } from './SkillsCriterion';
import { GoalsCriterion } from './GoalsCriterion';
import { LocationCriterion } from './LocationCriterion';
import { InterestsCriterion } from './InterestsCriterion';
import { CompanyCriterion } from './CompanyCriterion';
import { ExperienceCriterion } from './ExperienceCriterion';
import { NetworkCriterion } from './NetworkCriterion';
import { EducationCriterion } from './EducationCriterion';
import { LanguagesCriterion } from './LanguagesCriterion';

/**
 * Create instances of all profile criteria calculators
 * Spec: 10 criteria for Profile ↔ Profile matching
 */
export function createProfileCriteria(): ICriterionCalculator[] {
  return [
    new EducationCriterion(),     // 1. Education
    new SkillsCriterion(),        // 2. Skills
    new IndustryCriterion(),      // 3. Industry
    new GoalsCriterion(),         // 4. Goals
    new LocationCriterion(),      // 5. Location
    new NetworkCriterion(),       // 6. Network
    new ExperienceCriterion(),    // 7. Experience
    new CompanyCriterion(),       // 8. Company
    new InterestsCriterion(),     // 9. Interests
    new LanguagesCriterion(),     // 10. Languages
  ];
}

export default createProfileCriteria;
