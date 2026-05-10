/**
 * Looking For Scoring Policies
 *
 * The canonical `LookingForType` enum lives in `./lookingForEnhancedScorer` —
 * this module re-exports it and adds the production-grade per-type weight
 * matrix mandated by the IntellMatch spec (Part 8).
 *
 * The matrix is applied by `lookingForEnhancedScorer.computeWeightedLookingForScore`
 * to produce one fully-explainable score per Looking For type per candidate.
 * Keep weights visible and reviewable — any change here changes production
 * scoring.
 *
 * @module infrastructure/external/projects/looking-for.types
 */

import { MatchLevel } from "../common/matching-common.types";
import {
  CounterpartType,
  ProjectIntent,
  ProjectScoringWeights,
} from "./project-matching.types";
import {
  LookingForType,
  LOOKING_FOR_LABELS as ENHANCED_LOOKING_FOR_LABELS,
  LOOKING_FOR_TYPE_TO_ID,
  LOOKING_FOR_ID_TO_TYPE,
  toLookingForType,
} from "./lookingForEnhancedScorer";

// Re-export the canonical enum + label/id maps so callers have a single import path.
export {
  LookingForType,
  LOOKING_FOR_TYPE_TO_ID,
  LOOKING_FOR_ID_TO_TYPE,
  toLookingForType,
};
export const LOOKING_FOR_LABELS = ENHANCED_LOOKING_FOR_LABELS;

export const LOOKING_FOR_VALUES: LookingForType[] = [
  LookingForType.INVESTOR,
  LookingForType.ADVISOR,
  LookingForType.SERVICE_PROVIDER,
  LookingForType.STRATEGIC_PARTNER,
  LookingForType.CHANNEL_DISTRIBUTION,
  LookingForType.TECHNICAL_PARTNER,
  LookingForType.CO_FOUNDER_TALENT,
];

// ============================================================================
// LOOKING FOR <-> LEGACY MAPPINGS
//
// These are required by the v2 module's persistence/prompts. Adding them here
// keeps the scoring layer agnostic of legacy ProjectIntent / CounterpartType
// while still making the mapping discoverable from one place.
// ============================================================================

export function mapLookingForToProjectIntents(
  lookingFor: LookingForType,
): ProjectIntent[] {
  switch (lookingFor) {
    case LookingForType.INVESTOR:
      return [ProjectIntent.FIND_INVESTOR];
    case LookingForType.ADVISOR:
      return [ProjectIntent.FIND_ADVISOR];
    case LookingForType.SERVICE_PROVIDER:
      return [ProjectIntent.FIND_SERVICE_PROVIDER];
    case LookingForType.STRATEGIC_PARTNER:
      return [ProjectIntent.FIND_PARTNER];
    case LookingForType.CHANNEL_DISTRIBUTION:
      return [ProjectIntent.FIND_PARTNER];
    case LookingForType.TECHNICAL_PARTNER:
      return [
        ProjectIntent.FIND_PARTNER,
        ProjectIntent.FIND_TALENT,
        ProjectIntent.FIND_SERVICE_PROVIDER,
      ];
    case LookingForType.CO_FOUNDER_TALENT:
      return [ProjectIntent.FIND_COFOUNDER, ProjectIntent.FIND_TALENT];
  }
}

export function mapLookingForToCounterpartTypes(
  lookingFor: LookingForType,
): CounterpartType[] {
  switch (lookingFor) {
    case LookingForType.INVESTOR:
      return [CounterpartType.INVESTOR];
    case LookingForType.ADVISOR:
      return [CounterpartType.ADVISOR];
    case LookingForType.SERVICE_PROVIDER:
      return [CounterpartType.SERVICE_PROVIDER];
    case LookingForType.STRATEGIC_PARTNER:
      return [CounterpartType.PARTNER];
    case LookingForType.CHANNEL_DISTRIBUTION:
      return [CounterpartType.PARTNER];
    case LookingForType.TECHNICAL_PARTNER:
      return [
        CounterpartType.PARTNER,
        CounterpartType.TALENT,
        CounterpartType.COFOUNDER,
        CounterpartType.SERVICE_PROVIDER,
      ];
    case LookingForType.CO_FOUNDER_TALENT:
      return [CounterpartType.COFOUNDER, CounterpartType.TALENT];
  }
}

export function counterpartTypeToCandidateLookingFor(
  counterpartType: CounterpartType,
): LookingForType[] {
  switch (counterpartType) {
    case CounterpartType.INVESTOR:
      return [LookingForType.INVESTOR];
    case CounterpartType.ADVISOR:
      return [LookingForType.ADVISOR];
    case CounterpartType.SERVICE_PROVIDER:
      return [
        LookingForType.SERVICE_PROVIDER,
        LookingForType.TECHNICAL_PARTNER,
      ];
    case CounterpartType.PARTNER:
      return [
        LookingForType.STRATEGIC_PARTNER,
        LookingForType.CHANNEL_DISTRIBUTION,
        LookingForType.TECHNICAL_PARTNER,
      ];
    case CounterpartType.COFOUNDER:
      return [
        LookingForType.CO_FOUNDER_TALENT,
        LookingForType.TECHNICAL_PARTNER,
      ];
    case CounterpartType.TALENT:
      return [
        LookingForType.CO_FOUNDER_TALENT,
        LookingForType.TECHNICAL_PARTNER,
      ];
    default:
      return [];
  }
}

export function mapLegacyLookingForToTypes(
  legacy: CounterpartType[] | undefined,
): LookingForType[] {
  if (!legacy?.length) return [];
  const out = new Set<LookingForType>();
  for (const cpt of legacy) {
    for (const lf of counterpartTypeToCandidateLookingFor(cpt)) {
      out.add(lf);
    }
  }
  return Array.from(out);
}

export function mapProjectIntentToLookingFor(
  intent: ProjectIntent,
): LookingForType {
  switch (intent) {
    case ProjectIntent.FIND_INVESTOR:
      return LookingForType.INVESTOR;
    case ProjectIntent.FIND_ADVISOR:
      return LookingForType.ADVISOR;
    case ProjectIntent.FIND_SERVICE_PROVIDER:
      return LookingForType.SERVICE_PROVIDER;
    case ProjectIntent.FIND_PARTNER:
      return LookingForType.STRATEGIC_PARTNER;
    case ProjectIntent.FIND_COFOUNDER:
      return LookingForType.CO_FOUNDER_TALENT;
    case ProjectIntent.FIND_TALENT:
      return LookingForType.CO_FOUNDER_TALENT;
  }
}

export function primaryProjectIntentForLookingFor(
  lookingFor: LookingForType,
): ProjectIntent {
  return mapLookingForToProjectIntents(lookingFor)[0];
}

// ============================================================================
// HARD REQUIREMENTS PER LOOKING FOR
// ============================================================================

export interface LookingForHardRequirements {
  requireCounterpartTypeMatch: boolean;
  requireLookingForAlignment: boolean;
  requireMarketFitForStrictCases: boolean;
  requireFundingRangeForInvestor?: boolean;
  requireBudgetRangeForServiceProvider?: boolean;
  requireSkillEvidenceForTechnicalPartner?: boolean;
  requireChannelEvidenceForChannelDistribution?: boolean;
  requireCommitmentEvidenceForCoFounderTalent?: boolean;
}

// ============================================================================
// SCORING POLICY PER LOOKING FOR
// ============================================================================

export interface LookingForScoringPolicy {
  lookingFor: LookingForType;
  label: string;
  relatedProjectIntents: ProjectIntent[];
  allowedCounterpartTypes: CounterpartType[];
  weights: ProjectScoringWeights;
  minDeterministicScore: number;
  minPostAIScore: number;
  minConfidence: number;
  hardRequirements: LookingForHardRequirements;
  /** Free-form list of focus areas the explanation generator should emphasise. */
  explanationFocus: string[];
}

/**
 * Production weight matrix per Looking For type (IntellMatch spec, Part 8).
 *
 * The weighted-sum result is normalised by totalWeight at runtime, so small
 * rounding drift in any row does not silently distort scores.
 */
export const LOOKING_FOR_SCORING_POLICIES: Record<
  LookingForType,
  LookingForScoringPolicy
> = {
  [LookingForType.INVESTOR]: {
    lookingFor: LookingForType.INVESTOR,
    label: LOOKING_FOR_LABELS[LookingForType.INVESTOR],
    relatedProjectIntents: [ProjectIntent.FIND_INVESTOR],
    allowedCounterpartTypes: [CounterpartType.INVESTOR],
    weights: {
      lookingForFit: 0.08,
      counterpartFit: 0.10,
      needCoverage: 0.08,
      needPrecision: 0.05,
      capabilityFit: 0.03,
      skillFit: 0.02,
      sectorFit: 0.13,
      marketFit: 0.08,
      stageFit: 0.10,
      engagementFit: 0.12,
      subtypeSpecificFit: 0.13,
      credibilityFit: 0.05,
      semanticFit: 0.02,
      completenessFit: 0.01,
    },
    minDeterministicScore: 30,
    minPostAIScore: 30,
    minConfidence: 0.30,
    hardRequirements: {
      requireCounterpartTypeMatch: true,
      requireLookingForAlignment: true,
      requireMarketFitForStrictCases: true,
      requireFundingRangeForInvestor: false,
    },
    explanationFocus: [
      "investment stage fit",
      "funding / ticket-size fit",
      "sector thesis fit",
      "market / geography fit",
      "investor profile evidence",
      "traction compatibility",
      "credibility and evidence",
      "ability to fund or introduce funding",
    ],
  },

  [LookingForType.ADVISOR]: {
    lookingFor: LookingForType.ADVISOR,
    label: LOOKING_FOR_LABELS[LookingForType.ADVISOR],
    relatedProjectIntents: [ProjectIntent.FIND_ADVISOR],
    allowedCounterpartTypes: [CounterpartType.ADVISOR],
    weights: {
      lookingForFit: 0.08,
      counterpartFit: 0.10,
      needCoverage: 0.10,
      needPrecision: 0.10,
      capabilityFit: 0.07,
      skillFit: 0.06,
      sectorFit: 0.07,
      marketFit: 0.03,
      stageFit: 0.04,
      engagementFit: 0.06,
      subtypeSpecificFit: 0.14,
      credibilityFit: 0.12,
      semanticFit: 0.02,
      completenessFit: 0.01,
    },
    minDeterministicScore: 25,
    minPostAIScore: 25,
    minConfidence: 0.30,
    hardRequirements: {
      requireCounterpartTypeMatch: true,
      requireLookingForAlignment: true,
      requireMarketFitForStrictCases: false,
    },
    explanationFocus: [
      "advisory topic fit",
      "domain expertise",
      "seniority and credibility",
      "startup / business experience",
      "functional guidance fit",
      "mentoring value",
      "relevance to project's needs",
    ],
  },

  [LookingForType.SERVICE_PROVIDER]: {
    lookingFor: LookingForType.SERVICE_PROVIDER,
    label: LOOKING_FOR_LABELS[LookingForType.SERVICE_PROVIDER],
    relatedProjectIntents: [ProjectIntent.FIND_SERVICE_PROVIDER],
    allowedCounterpartTypes: [CounterpartType.SERVICE_PROVIDER],
    weights: {
      lookingForFit: 0.08,
      counterpartFit: 0.10,
      needCoverage: 0.14,
      needPrecision: 0.10,
      capabilityFit: 0.12,
      skillFit: 0.08,
      sectorFit: 0.06,
      marketFit: 0.05,
      stageFit: 0.02,
      engagementFit: 0.09,
      subtypeSpecificFit: 0.12,
      credibilityFit: 0.03,
      semanticFit: 0.01,
      completenessFit: 0.00,
    },
    minDeterministicScore: 28,
    minPostAIScore: 28,
    minConfidence: 0.30,
    hardRequirements: {
      requireCounterpartTypeMatch: true,
      requireLookingForAlignment: true,
      requireMarketFitForStrictCases: true,
      requireBudgetRangeForServiceProvider: false,
    },
    explanationFocus: [
      "required service category",
      "capability fit",
      "delivery experience",
      "budget fit",
      "certifications / reliability evidence",
      "market / time-zone fit",
      "proven execution",
    ],
  },

  [LookingForType.STRATEGIC_PARTNER]: {
    lookingFor: LookingForType.STRATEGIC_PARTNER,
    label: LOOKING_FOR_LABELS[LookingForType.STRATEGIC_PARTNER],
    relatedProjectIntents: [ProjectIntent.FIND_PARTNER],
    allowedCounterpartTypes: [CounterpartType.PARTNER],
    weights: {
      lookingForFit: 0.08,
      counterpartFit: 0.10,
      needCoverage: 0.12,
      needPrecision: 0.08,
      capabilityFit: 0.08,
      skillFit: 0.04,
      sectorFit: 0.12,
      marketFit: 0.10,
      stageFit: 0.03,
      engagementFit: 0.09,
      subtypeSpecificFit: 0.14,
      credibilityFit: 0.01,
      semanticFit: 0.01,
      completenessFit: 0.00,
    },
    minDeterministicScore: 25,
    minPostAIScore: 25,
    minConfidence: 0.30,
    hardRequirements: {
      requireCounterpartTypeMatch: true,
      requireLookingForAlignment: true,
      requireMarketFitForStrictCases: true,
    },
    explanationFocus: [
      "strategic alignment",
      "complementary business model",
      "sector fit",
      "market access",
      "mutual benefit",
      "organization relevance",
      "partnership / integration potential",
    ],
  },

  [LookingForType.CHANNEL_DISTRIBUTION]: {
    lookingFor: LookingForType.CHANNEL_DISTRIBUTION,
    label: LOOKING_FOR_LABELS[LookingForType.CHANNEL_DISTRIBUTION],
    relatedProjectIntents: [ProjectIntent.FIND_PARTNER],
    allowedCounterpartTypes: [CounterpartType.PARTNER],
    weights: {
      lookingForFit: 0.08,
      counterpartFit: 0.10,
      needCoverage: 0.10,
      needPrecision: 0.08,
      capabilityFit: 0.08,
      skillFit: 0.04,
      sectorFit: 0.08,
      marketFit: 0.14,
      stageFit: 0.02,
      engagementFit: 0.08,
      subtypeSpecificFit: 0.16,
      credibilityFit: 0.02,
      semanticFit: 0.02,
      completenessFit: 0.00,
    },
    minDeterministicScore: 25,
    minPostAIScore: 25,
    minConfidence: 0.30,
    hardRequirements: {
      requireCounterpartTypeMatch: true,
      requireLookingForAlignment: true,
      requireMarketFitForStrictCases: true,
      requireChannelEvidenceForChannelDistribution: false,
    },
    explanationFocus: [
      "customer access",
      "distribution channels",
      "reseller / channel evidence",
      "territory fit",
      "market reach",
      "business development ability",
      "ability to open doors",
    ],
  },

  [LookingForType.TECHNICAL_PARTNER]: {
    lookingFor: LookingForType.TECHNICAL_PARTNER,
    label: LOOKING_FOR_LABELS[LookingForType.TECHNICAL_PARTNER],
    relatedProjectIntents: [
      ProjectIntent.FIND_PARTNER,
      ProjectIntent.FIND_TALENT,
      ProjectIntent.FIND_SERVICE_PROVIDER,
    ],
    allowedCounterpartTypes: [
      CounterpartType.PARTNER,
      CounterpartType.TALENT,
      CounterpartType.COFOUNDER,
      CounterpartType.SERVICE_PROVIDER,
    ],
    weights: {
      lookingForFit: 0.08,
      counterpartFit: 0.09,
      needCoverage: 0.12,
      needPrecision: 0.08,
      capabilityFit: 0.13,
      skillFit: 0.14,
      sectorFit: 0.05,
      marketFit: 0.02,
      stageFit: 0.04,
      engagementFit: 0.06,
      subtypeSpecificFit: 0.14,
      credibilityFit: 0.03,
      semanticFit: 0.02,
      completenessFit: 0.00,
    },
    minDeterministicScore: 25,
    minPostAIScore: 25,
    minConfidence: 0.30,
    hardRequirements: {
      requireCounterpartTypeMatch: false,
      requireLookingForAlignment: true,
      requireMarketFitForStrictCases: false,
      requireSkillEvidenceForTechnicalPartner: false,
    },
    explanationFocus: [
      "technical skill fit",
      "software / AI / data / product build capability",
      "architecture / integration capability",
      "delivery evidence",
      "relevant technical seniority",
      "ability to build or integrate the project",
    ],
  },

  [LookingForType.CO_FOUNDER_TALENT]: {
    lookingFor: LookingForType.CO_FOUNDER_TALENT,
    label: LOOKING_FOR_LABELS[LookingForType.CO_FOUNDER_TALENT],
    relatedProjectIntents: [
      ProjectIntent.FIND_COFOUNDER,
      ProjectIntent.FIND_TALENT,
    ],
    allowedCounterpartTypes: [CounterpartType.COFOUNDER, CounterpartType.TALENT],
    weights: {
      lookingForFit: 0.08,
      counterpartFit: 0.10,
      needCoverage: 0.10,
      needPrecision: 0.06,
      capabilityFit: 0.08,
      skillFit: 0.16,
      sectorFit: 0.05,
      marketFit: 0.02,
      stageFit: 0.08,
      engagementFit: 0.12,
      subtypeSpecificFit: 0.14,
      credibilityFit: 0.01,
      semanticFit: 0.00,
      completenessFit: 0.00,
    },
    minDeterministicScore: 22,
    minPostAIScore: 22,
    minConfidence: 0.30,
    hardRequirements: {
      requireCounterpartTypeMatch: true,
      requireLookingForAlignment: true,
      requireMarketFitForStrictCases: false,
      requireCommitmentEvidenceForCoFounderTalent: false,
    },
    explanationFocus: [
      "role / skill fit",
      "commitment and availability",
      "startup stage comfort",
      "execution capability",
      "seniority",
      "long-term collaboration fit",
      "domain relevance",
    ],
  },
};

export function getLookingForPolicy(
  lookingFor: LookingForType,
): LookingForScoringPolicy {
  return LOOKING_FOR_SCORING_POLICIES[lookingFor];
}

export function isAllowedCounterpartFor(
  lookingFor: LookingForType,
  counterpartType: CounterpartType,
): boolean {
  return getLookingForPolicy(lookingFor).allowedCounterpartTypes.includes(
    counterpartType,
  );
}

// ============================================================================
// PER-LOOKING-FOR-TYPE GAP STRINGS
//
// The spec (Part 12) requires gaps to be specific to the Looking For type, not
// generic. These strings are surfaced when the corresponding component score
// is weak — overrides the generic "No matching skills" / "No sector overlap"
// language.
// ============================================================================

interface GapBundle {
  fundingEvidence: string;
  ticketSizeFit: string;
  stageFit: string;
  marketFit: string;
  channelEvidence: string;
  technicalEvidence: string;
  commitmentEvidence: string;
  capabilityEvidence: string;
  budgetCompatibility: string;
  advisoryEvidence: string;
}

const COMMON_GAPS: GapBundle = {
  fundingEvidence: "No clear evidence of direct investment activity",
  ticketSizeFit: "Ticket-size compatibility with funding ask is unknown",
  stageFit: "Investment stage preference is unclear",
  marketFit: "No market overlap with the project's target geography",
  channelEvidence: "No clear channel / distribution network",
  technicalEvidence: "No evidence of technical delivery capability",
  commitmentEvidence: "Availability or commitment level is not confirmed",
  capabilityEvidence: "Required capability is not strongly evidenced",
  budgetCompatibility: "Budget compatibility is unknown",
  advisoryEvidence: "No formal advisory background detected",
};

export function lookingForSpecificGap(
  lookingFor: LookingForType,
  reason:
    | "weakSubtype"
    | "weakSkill"
    | "weakSector"
    | "weakMarket"
    | "weakEngagement"
    | "weakCredibility"
    | "weakStage",
): string {
  switch (lookingFor) {
    case LookingForType.INVESTOR:
      switch (reason) {
        case "weakSubtype":
          return COMMON_GAPS.fundingEvidence;
        case "weakSkill":
          return "Sector / domain expertise is not strongly evidenced";
        case "weakSector":
          return "No alignment with the investor's typical sector thesis";
        case "weakMarket":
          return COMMON_GAPS.marketFit;
        case "weakEngagement":
          return COMMON_GAPS.ticketSizeFit;
        case "weakCredibility":
          return "Investor credibility / portfolio evidence is limited";
        case "weakStage":
          return COMMON_GAPS.stageFit;
      }
      break;
    case LookingForType.ADVISOR:
      switch (reason) {
        case "weakSubtype":
          return COMMON_GAPS.advisoryEvidence;
        case "weakSkill":
          return "Skills relevant to advisory topics are missing";
        case "weakSector":
          return "Advisor's sector exposure does not match the project";
        case "weakMarket":
          return "Advisor's geography is unclear";
        case "weakEngagement":
          return "Advisory engagement model is not confirmed";
        case "weakCredibility":
          return "Limited evidence of seniority or board/advisory experience";
        case "weakStage":
          return "Stage fit for advisory engagement is unclear";
      }
      break;
    case LookingForType.SERVICE_PROVIDER:
      switch (reason) {
        case "weakSubtype":
          return "No clear evidence of delivering this service category";
        case "weakSkill":
          return "Skills required for the service are not evidenced";
        case "weakSector":
          return "Service provider's sector experience does not align";
        case "weakMarket":
          return COMMON_GAPS.marketFit;
        case "weakEngagement":
          return COMMON_GAPS.budgetCompatibility;
        case "weakCredibility":
          return "Provider credibility / certifications are limited";
        case "weakStage":
          return "Provider's typical client stage is unclear";
      }
      break;
    case LookingForType.STRATEGIC_PARTNER:
      switch (reason) {
        case "weakSubtype":
          return "Strategic partnership relevance is not strongly evidenced";
        case "weakSkill":
          return "Skills needed for partnership integration are missing";
        case "weakSector":
          return "Partner's sector does not complement the project";
        case "weakMarket":
          return COMMON_GAPS.marketFit;
        case "weakEngagement":
          return "Partnership engagement model is unclear";
        case "weakCredibility":
          return "Strategic partnership track record is limited";
        case "weakStage":
          return "Partner's typical engagement stage is unclear";
      }
      break;
    case LookingForType.CHANNEL_DISTRIBUTION:
      switch (reason) {
        case "weakSubtype":
          return COMMON_GAPS.channelEvidence;
        case "weakSkill":
          return "Channel-specific skills (BD, partnerships) are not evidenced";
        case "weakSector":
          return "Distribution sector does not match the project";
        case "weakMarket":
          return "Territory / geographic reach does not match the project";
        case "weakEngagement":
          return "Channel engagement model is not confirmed";
        case "weakCredibility":
          return "Reseller / distribution credibility is limited";
        case "weakStage":
          return "Stage fit for channel engagement is unclear";
      }
      break;
    case LookingForType.TECHNICAL_PARTNER:
      switch (reason) {
        case "weakSubtype":
          return COMMON_GAPS.technicalEvidence;
        case "weakSkill":
          return "Required technical skills are not strongly evidenced";
        case "weakSector":
          return "Technical sector experience does not align";
        case "weakMarket":
          return "Technical partner's geography is unclear";
        case "weakEngagement":
          return "Engagement / commitment model is not confirmed";
        case "weakCredibility":
          return "Technical seniority or delivery evidence is limited";
        case "weakStage":
          return "Comfort with the project stage is unclear";
      }
      break;
    case LookingForType.CO_FOUNDER_TALENT:
      switch (reason) {
        case "weakSubtype":
          return "No strong evidence of cofounder or founding-team experience";
        case "weakSkill":
          return "Required role skills are not evidenced";
        case "weakSector":
          return "Sector relevance to the project is unclear";
        case "weakMarket":
          return "Geographic alignment is unclear";
        case "weakEngagement":
          return COMMON_GAPS.commitmentEvidence;
        case "weakCredibility":
          return "Leadership / execution track record is limited";
        case "weakStage":
          return "Comfort with this project stage is unclear";
      }
      break;
  }
  return COMMON_GAPS.capabilityEvidence;
}

// ============================================================================
// PROJECT MATCH BANDS
//
// Spec-mandated bands. The same boundaries are used inside
// `lookingForEnhancedScorer.getLookingForBand`; this helper exists for callers
// that need to consume MatchLevel directly.
// ============================================================================

export const PROJECT_BAND_BOUNDARIES = {
  WEAK: { min: 0, max: 39 },
  PARTIAL: { min: 40, max: 54 },
  GOOD: { min: 55, max: 69 },
  VERY_GOOD: { min: 70, max: 84 },
  EXCELLENT: { min: 85, max: 100 },
} as const;

export function getProjectMatchLevel(score: number): MatchLevel {
  if (score >= PROJECT_BAND_BOUNDARIES.EXCELLENT.min) return MatchLevel.EXCELLENT;
  if (score >= PROJECT_BAND_BOUNDARIES.VERY_GOOD.min) return MatchLevel.VERY_GOOD;
  if (score >= PROJECT_BAND_BOUNDARIES.GOOD.min) return MatchLevel.GOOD;
  if (score >= PROJECT_BAND_BOUNDARIES.PARTIAL.min) return MatchLevel.PARTIAL;
  return MatchLevel.WEAK;
}

export function getProjectMatchLevelLabel(level: MatchLevel): string {
  switch (level) {
    case MatchLevel.EXCELLENT:
      return "Excellent";
    case MatchLevel.VERY_GOOD:
      return "Very Good";
    case MatchLevel.GOOD:
      return "Good";
    case MatchLevel.PARTIAL:
      return "Partial";
    case MatchLevel.WEAK:
      return "Weak";
    case MatchLevel.POOR:
      return "Weak";
    default:
      return "Weak";
  }
}
