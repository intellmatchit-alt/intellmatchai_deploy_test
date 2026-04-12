/**
 * Explanation Templates
 *
 * Template-driven explanations per criterion type with 6 tiers.
 *
 * @module infrastructure/services/explainability/templates
 */

export enum CriterionType {
  SKILL_MATCH = 'SKILL_MATCH',
  EXPERIENCE_MATCH = 'EXPERIENCE_MATCH',
  SECTOR_MATCH = 'SECTOR_MATCH',
  GOAL_ALIGNMENT = 'GOAL_ALIGNMENT',
  SEMANTIC_SIMILARITY = 'SEMANTIC_SIMILARITY',
  COMPLEMENTARY_SKILLS = 'COMPLEMENTARY_SKILLS',
  NETWORK_PROXIMITY = 'NETWORK_PROXIMITY',
}

export enum ExplanationTier {
  PERFECT = 'PERFECT',     // 95-100
  EXCELLENT = 'EXCELLENT', // 80-94
  STRONG = 'STRONG',       // 60-79
  MODERATE = 'MODERATE',   // 40-59
  WEAK = 'WEAK',           // 20-39
  NONE = 'NONE',           // 0-19
}

export function getTier(score: number): ExplanationTier {
  if (score >= 95) return ExplanationTier.PERFECT;
  if (score >= 80) return ExplanationTier.EXCELLENT;
  if (score >= 60) return ExplanationTier.STRONG;
  if (score >= 40) return ExplanationTier.MODERATE;
  if (score >= 20) return ExplanationTier.WEAK;
  return ExplanationTier.NONE;
}

type TemplateMap = Record<ExplanationTier, string>;

export const EXPLANATION_TEMPLATES: Record<CriterionType, TemplateMap> = {
  [CriterionType.SKILL_MATCH]: {
    [ExplanationTier.PERFECT]: 'Exceptional skill alignment - {matchCount} exact or near-exact skill matches including {topSkills}',
    [ExplanationTier.EXCELLENT]: 'Strong skill overlap with {matchCount} matching skills: {topSkills}',
    [ExplanationTier.STRONG]: 'Good skill compatibility - {matchCount} skills align, including related skills like {topSkills}',
    [ExplanationTier.MODERATE]: 'Some skill overlap - {matchCount} related skills found: {topSkills}',
    [ExplanationTier.WEAK]: 'Limited skill alignment - only {matchCount} loosely related skills detected',
    [ExplanationTier.NONE]: 'No overlapping or related skills found between profiles',
  },
  [CriterionType.EXPERIENCE_MATCH]: {
    [ExplanationTier.PERFECT]: 'Ideal experience level - {seniorityLevel} with approximately {years} years of experience',
    [ExplanationTier.EXCELLENT]: 'Very strong experience fit - {seniorityLevel} level aligns well with requirements',
    [ExplanationTier.STRONG]: 'Good experience alignment - {seniorityLevel} with relevant background',
    [ExplanationTier.MODERATE]: 'Acceptable experience level - {seniorityLevel}, though not an exact fit',
    [ExplanationTier.WEAK]: 'Experience gap - {seniorityLevel} level may not fully meet requirements',
    [ExplanationTier.NONE]: 'Significant experience mismatch for this role',
  },
  [CriterionType.SECTOR_MATCH]: {
    [ExplanationTier.PERFECT]: 'Identical industry focus - both operate in {sharedSectors}',
    [ExplanationTier.EXCELLENT]: 'Strong industry alignment across {count} shared sectors: {sharedSectors}',
    [ExplanationTier.STRONG]: 'Good sector overlap in {sharedSectors}',
    [ExplanationTier.MODERATE]: 'Some industry commonality in {sharedSectors}',
    [ExplanationTier.WEAK]: 'Limited sector overlap - only peripheral industry connections',
    [ExplanationTier.NONE]: 'No shared industry sectors between profiles',
  },
  [CriterionType.GOAL_ALIGNMENT]: {
    [ExplanationTier.PERFECT]: 'Perfectly complementary goals - {goalDetails}',
    [ExplanationTier.EXCELLENT]: 'Highly aligned objectives - {goalDetails}',
    [ExplanationTier.STRONG]: 'Compatible professional goals - {goalDetails}',
    [ExplanationTier.MODERATE]: 'Partially aligned goals with some shared interests',
    [ExplanationTier.WEAK]: 'Goals have limited alignment',
    [ExplanationTier.NONE]: 'No discernible goal alignment between profiles',
  },
  [CriterionType.SEMANTIC_SIMILARITY]: {
    [ExplanationTier.PERFECT]: 'AI analysis shows exceptional profile similarity - backgrounds are highly compatible',
    [ExplanationTier.EXCELLENT]: 'AI detects strong semantic alignment between professional profiles',
    [ExplanationTier.STRONG]: 'Good semantic similarity - AI finds meaningful connections in backgrounds',
    [ExplanationTier.MODERATE]: 'AI finds moderate thematic overlap between profiles',
    [ExplanationTier.WEAK]: 'Low semantic similarity - profiles have few common themes',
    [ExplanationTier.NONE]: 'AI finds no significant similarity between professional profiles',
  },
  [CriterionType.COMPLEMENTARY_SKILLS]: {
    [ExplanationTier.PERFECT]: 'Exceptionally complementary skill sets - {details}',
    [ExplanationTier.EXCELLENT]: 'Highly complementary skills that fill each other\'s gaps - {details}',
    [ExplanationTier.STRONG]: 'Good skill complementarity - {details}',
    [ExplanationTier.MODERATE]: 'Some complementary skills found - {details}',
    [ExplanationTier.WEAK]: 'Limited skill complementarity',
    [ExplanationTier.NONE]: 'No complementary skills detected',
  },
  [CriterionType.NETWORK_PROXIMITY]: {
    [ExplanationTier.PERFECT]: 'Direct 1st-degree connection in your network',
    [ExplanationTier.EXCELLENT]: 'Close 2nd-degree connection - you share mutual contacts',
    [ExplanationTier.STRONG]: '3rd-degree connection - reachable through your extended network',
    [ExplanationTier.MODERATE]: 'Connected through extended professional network',
    [ExplanationTier.WEAK]: 'Distant network connection',
    [ExplanationTier.NONE]: 'No known network connections',
  },
};

/**
 * Render a template with variables
 */
export function renderTemplate(template: string, vars: Record<string, string | number>): string {
  let result = template;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), String(value));
  }
  return result;
}
