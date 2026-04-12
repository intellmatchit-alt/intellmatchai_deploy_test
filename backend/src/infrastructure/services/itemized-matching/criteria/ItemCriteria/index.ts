/**
 * Item Criteria Index
 *
 * Exports all item-to-contact criterion calculators.
 * Covers PROJECT_TO_INVESTOR, PROJECT_TO_DYNAMIC, DEAL_TO_BUYER, DEAL_TO_PROVIDER matching.
 *
 * @module infrastructure/services/itemized-matching/criteria/ItemCriteria
 */

// Project → Investor criteria
export { IndustryFitCriterion, default as IndustryFitCriterionDefault } from './IndustryFitCriterion';
export { StageFitCriterion, default as StageFitCriterionDefault } from './StageFitCriterion';
export { CheckSizeCriterion, default as CheckSizeCriterionDefault } from './CheckSizeCriterion';
export { GeographyFocusCriterion, default as GeographyFocusCriterionDefault } from './GeographyFocusCriterion';
export { ThesisFitCriterion, default as ThesisFitCriterionDefault } from './ThesisFitCriterion';
export { ProjectSkillsFitCriterion, default as ProjectSkillsFitCriterionDefault } from './ProjectSkillsFitCriterion';

// Deal → Buyer/Provider criteria
export { DealIndustryCriterion, default as DealIndustryCriterionDefault } from './DealIndustryCriterion';
export { RoleCriterion, default as RoleCriterionDefault } from './RoleCriterion';
export { CompanySizeCriterion, default as CompanySizeCriterionDefault } from './CompanySizeCriterion';
export { BudgetCriterion, default as BudgetCriterionDefault } from './BudgetCriterion';
export { ProblemFitCriterion, default as ProblemFitCriterionDefault } from './ProblemFitCriterion';
export { SolutionCriterion, default as SolutionCriterionDefault } from './SolutionCriterion';
export { AvailabilityCriterion, default as AvailabilityCriterionDefault } from './AvailabilityCriterion';
export { CapabilitiesCriterion, default as CapabilitiesCriterionDefault } from './CapabilitiesCriterion';

import { ICriterionCalculator } from '../../interfaces/ICriterionCalculator';

// Project → Investor imports
import { IndustryFitCriterion } from './IndustryFitCriterion';
import { StageFitCriterion } from './StageFitCriterion';
import { CheckSizeCriterion } from './CheckSizeCriterion';
import { GeographyFocusCriterion } from './GeographyFocusCriterion';
import { ThesisFitCriterion } from './ThesisFitCriterion';
import { ProjectSkillsFitCriterion } from './ProjectSkillsFitCriterion';

// Deal → Buyer/Provider imports
import { DealIndustryCriterion } from './DealIndustryCriterion';
import { RoleCriterion } from './RoleCriterion';
import { CompanySizeCriterion } from './CompanySizeCriterion';
import { BudgetCriterion } from './BudgetCriterion';
import { ProblemFitCriterion } from './ProblemFitCriterion';
import { SolutionCriterion } from './SolutionCriterion';
import { AvailabilityCriterion } from './AvailabilityCriterion';
import { CapabilitiesCriterion } from './CapabilitiesCriterion';

// Import profile criteria that also apply to items
import { LocationCriterion } from '../ProfileCriteria/LocationCriterion';
import { NetworkCriterion } from '../ProfileCriteria/NetworkCriterion';
import { ExperienceCriterion } from '../ProfileCriteria/ExperienceCriterion';

// ============================================
// Keyword maps for classifying lookingFor
// ============================================

const INVESTMENT_KEYWORDS = [
  'investment', 'funding', 'investor', 'capital', 'angel', 'vc',
  'venture', 'fundraise', 'seed', 'series', 'raise', 'fund',
];

const TALENT_KEYWORDS = [
  'co-founder', 'cofounder', 'developer', 'engineer', 'designer',
  'manager', 'marketing', 'sales', 'talent', 'hire', 'cto', 'cfo',
  'cmo', 'technical', 'growth', 'team', 'recruit',
];

const PARTNERSHIP_KEYWORDS = [
  'partner', 'strategic', 'advisor', 'mentor', 'distribution',
  'collaboration', 'alliance', 'joint', 'business development',
];

/**
 * Classify a project's lookingFor array into matching categories
 *
 * @param lookingFor - Array of strings describing what the project needs
 * @returns Set of categories: 'INVESTMENT' | 'TALENT' | 'PARTNERSHIP'
 */
export function classifyLookingFor(lookingFor: string[]): Set<string> {
  const categories = new Set<string>();

  for (const entry of lookingFor) {
    const lower = entry.toLowerCase();

    if (INVESTMENT_KEYWORDS.some(kw => lower.includes(kw))) {
      categories.add('INVESTMENT');
    }
    if (TALENT_KEYWORDS.some(kw => lower.includes(kw))) {
      categories.add('TALENT');
    }
    if (PARTNERSHIP_KEYWORDS.some(kw => lower.includes(kw))) {
      categories.add('PARTNERSHIP');
    }
  }

  // Fallback: if nothing matches, use PARTNERSHIP as a generic set
  if (categories.size === 0) {
    categories.add('PARTNERSHIP');
  }

  return categories;
}

/**
 * Create dynamic criteria based on a project's lookingFor field.
 * Uses a Map for deduplication so the same criterion isn't added twice.
 *
 * @param lookingFor - Array of strings from project.lookingFor
 * @returns Array of deduplicated criterion calculators
 */
export function createProjectDynamicCriteria(lookingFor: string[]): ICriterionCalculator[] {
  const categories = classifyLookingFor(lookingFor);
  const criteriaMap = new Map<string, ICriterionCalculator>();

  // Always include IndustryFit + Network (universal for project matching)
  const industryFit = new IndustryFitCriterion();
  const network = new NetworkCriterion();
  criteriaMap.set(industryFit.id, industryFit);
  criteriaMap.set(network.id, network);

  if (categories.has('INVESTMENT')) {
    const stageFit = new StageFitCriterion();
    const checkSize = new CheckSizeCriterion();
    const thesisFit = new ThesisFitCriterion();
    const geoFocus = new GeographyFocusCriterion();
    criteriaMap.set(stageFit.id, stageFit);
    criteriaMap.set(checkSize.id, checkSize);
    criteriaMap.set(thesisFit.id, thesisFit);
    criteriaMap.set(geoFocus.id, geoFocus);
  }

  if (categories.has('TALENT')) {
    const skillsFit = new ProjectSkillsFitCriterion();
    const location = new LocationCriterion();
    const experience = new ExperienceCriterion();
    criteriaMap.set(skillsFit.id, skillsFit);
    criteriaMap.set(location.id, location);
    criteriaMap.set(experience.id, experience);
  }

  if (categories.has('PARTNERSHIP')) {
    const thesisFit = new ThesisFitCriterion();
    const geoFocus = new GeographyFocusCriterion();
    const location = new LocationCriterion();
    criteriaMap.set(thesisFit.id, thesisFit);
    criteriaMap.set(geoFocus.id, geoFocus);
    criteriaMap.set(location.id, location);
  }

  return Array.from(criteriaMap.values());
}

/**
 * Create instances of all Project → Investor criteria calculators
 */
export function createProjectInvestorCriteria(): ICriterionCalculator[] {
  return [
    new IndustryFitCriterion(),    // 1. CRITICAL - Sector/industry fit
    new StageFitCriterion(),       // 2. CRITICAL - Stage match
    new CheckSizeCriterion(),      // 3. CRITICAL - Check size alignment
    new ThesisFitCriterion(),      // 4. HIGH - Thesis/problem fit
    new GeographyFocusCriterion(), // 5. MEDIUM - Geographic focus
    new NetworkCriterion(),        // 6. MEDIUM - Network proximity for warm intro
  ];
}

/**
 * Create instances of all Project → Partner criteria calculators
 */
export function createProjectPartnerCriteria(): ICriterionCalculator[] {
  return [
    new IndustryFitCriterion(),   // HIGH
    new ThesisFitCriterion(),     // HIGH
    new GeographyFocusCriterion(), // MEDIUM
    new LocationCriterion(),      // MEDIUM
    new NetworkCriterion(),       // MEDIUM
  ];
}

/**
 * Create instances of all Deal → Buyer criteria calculators
 */
export function createDealBuyerCriteria(): ICriterionCalculator[] {
  return [
    new DealIndustryCriterion(),  // CRITICAL
    new RoleCriterion(),          // CRITICAL
    new CompanySizeCriterion(),   // HIGH
    new BudgetCriterion(),        // HIGH
    new ProblemFitCriterion(),    // HIGH
    new GeographyFocusCriterion(), // MEDIUM
  ];
}

/**
 * Create instances of all Deal → Provider criteria calculators
 * Spec: 5 criteria for Deal → Provider matching
 */
export function createDealProviderCriteria(): ICriterionCalculator[] {
  return [
    new SolutionCriterion(),       // 1. CRITICAL - Provider solves stated problem
    new CapabilitiesCriterion(),   // 2. HIGH - Provider capabilities vs deal requirements
    new DealIndustryCriterion(),   // 3. HIGH - Industry domain match
    new AvailabilityCriterion(),   // 4. MEDIUM - Provider availability for timeline
    new NetworkCriterion(),        // 5. MEDIUM - Warm intro potential
  ];
}

/**
 * Get criteria for a specific item match type
 */
export function getItemCriteria(matchType: string, lookingFor?: string[]): ICriterionCalculator[] {
  switch (matchType) {
    case 'PROJECT_TO_INVESTOR':
      return createProjectInvestorCriteria();
    case 'PROJECT_TO_PARTNER':
    case 'PROJECT_TO_TALENT':
      return createProjectPartnerCriteria();
    case 'PROJECT_TO_DYNAMIC':
      return createProjectDynamicCriteria(lookingFor || []);
    case 'DEAL_TO_BUYER':
      return createDealBuyerCriteria();
    case 'DEAL_TO_PROVIDER':
      return createDealProviderCriteria();
    default:
      return [];
  }
}

export default {
  createProjectInvestorCriteria,
  createProjectPartnerCriteria,
  createProjectDynamicCriteria,
  classifyLookingFor,
  createDealBuyerCriteria,
  createDealProviderCriteria,
  getItemCriteria,
};
