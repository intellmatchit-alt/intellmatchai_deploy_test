import {
  MatchLevel,
  HardFilterStatus,
  HardFilterReason,
  ConfidenceLevel,
  EntityFamily,
  ExecutionTrack,
  SeniorityLevel,
  DeterministicScoreBreakdown,
  HardFilterResult,
  MatchExplanation,
  BaseMatchResult,
  BaseMatchResponse,
  BaseFilterOptions,
  ThresholdConfig,
  ConfidenceGates,
  FallbackScores,
  FeatureFlags,
  BaseJobPayload,
} from "../common/matching-common.types";

export enum ProjectIntent {
  FIND_INVESTOR = "FIND_INVESTOR",
  FIND_ADVISOR = "FIND_ADVISOR",
  FIND_SERVICE_PROVIDER = "FIND_SERVICE_PROVIDER",
  FIND_PARTNER = "FIND_PARTNER",
  FIND_COFOUNDER = "FIND_COFOUNDER",
  FIND_TALENT = "FIND_TALENT",
}

export enum ProjectStage {
  JUST_AN_IDEA = "JUST_AN_IDEA",
  VALIDATING = "VALIDATING",
  BUILDING_MVP = "BUILDING_MVP",
  LAUNCHED = "LAUNCHED",
  GROWING = "GROWING",
  SCALING = "SCALING",
}

export enum PrimaryCategory {
  AI = "AI",
  FINTECH = "FINTECH",
  HEALTHCARE = "HEALTHCARE",
  EDTECH = "EDTECH",
  ECOMMERCE = "ECOMMERCE",
  SAAS = "SAAS",
  CYBERSECURITY = "CYBERSECURITY",
  IOT = "IOT",
  GOVTECH = "GOVTECH",
  CLEAN_TECH = "CLEAN_TECH",
  AGRITECH = "AGRITECH",
  MEDIA = "MEDIA",
  LOGISTICS = "LOGISTICS",
  REAL_ESTATE = "REAL_ESTATE",
  OTHER = "OTHER",
}

export enum CounterpartType {
  INVESTOR = "INVESTOR",
  ADVISOR = "ADVISOR",
  SERVICE_PROVIDER = "SERVICE_PROVIDER",
  PARTNER = "PARTNER",
  COFOUNDER = "COFOUNDER",
  TALENT = "TALENT",
}

export enum CommitmentLevel {
  LOW = "LOW",
  PART_TIME = "PART_TIME",
  FULL_TIME = "FULL_TIME",
  FLEXIBLE = "FLEXIBLE",
}

export enum EngagementModel {
  EQUITY = "EQUITY",
  CASH = "CASH",
  EQUITY_AND_CASH = "EQUITY_AND_CASH",
  REVENUE_SHARE = "REVENUE_SHARE",
  PARTNERSHIP = "PARTNERSHIP",
  CONTRACT = "CONTRACT",
  ADVISORY = "ADVISORY",
  STRATEGIC = "STRATEGIC",
}

export enum ProviderEvidenceLevel {
  LOW = "LOW",
  MEDIUM = "MEDIUM",
  HIGH = "HIGH",
}

export type NeedCluster =
  | "FUNDING"
  | "GO_TO_MARKET"
  | "CHANNELS"
  | "TECH_BUILD"
  | "PRODUCT"
  | "DATA_AI"
  | "OPERATIONS"
  | "SALES"
  | "DISTRIBUTION"
  | "MANUFACTURING"
  | "PARTNERSHIPS"
  | "COMPLIANCE"
  | "MARKETING"
  | "RESEARCH"
  | "HIRING"
  | "STRATEGY"
  | "UX_DESIGN"
  | "LEGAL"
  | "OTHER";

export interface ProjectNeedSignal {
  raw: string;
  normalized: string;
  phrases: string[];
  clusters: NeedCluster[];
  counterpartHints: CounterpartType[];
  importance: number;
  embedding?: number[];
}

export interface CounterpartOfferSignal {
  raw: string;
  normalized: string;
  phrases: string[];
  clusters: NeedCluster[];
  evidenceLevel: ProviderEvidenceLevel;
  embedding?: number[];
}

export interface TractionSignals {
  users?: number;
  payingCustomers?: number;
  pilots?: number;
  revenueMonthly?: number;
  growthRateMonthly?: number;
  partnerships?: number;
  patents?: number;
  grants?: number;
  waitlist?: number;
  notes?: string[];
}

export interface InvestorProfile {
  thesisSectors?: string[];
  preferredStages?: ProjectStage[];
  checkMin?: number;
  checkMax?: number;
  operatingMarkets?: string[];
  targetCustomerTypes?: string[];
  notablePortfolio?: string[];
  tractionTolerance?: "IDEA" | "EARLY" | "GROWTH" | "ANY";
}

export interface AdvisorProfile {
  advisoryTopics?: string[];
  boardExperienceYears?: number;
  exitedCompanies?: number;
  advisoryFunctions?: string[];
}

export interface TalentProfile {
  desiredRoles?: string[];
  commitmentLevel?: CommitmentLevel;
  seniorityFocus?: SeniorityLevel;
  startupStageComfort?: ProjectStage[];
  leadershipExperienceYears?: number;
}

export interface ServiceProviderProfile {
  serviceCategories?: string[];
  deliveryModes?: string[];
  budgetMin?: number;
  budgetMax?: number;
  minProjectSize?: string;
  maxProjectSize?: string;
  capacityUnits?: number;
  certifications?: string[];
}

export interface PartnerProfile {
  partnerTypes?: string[];
  channels?: string[];
  territories?: string[];
  customerTypes?: string[];
  integrationCapabilities?: string[];
}

export interface ProjectProfile {
  id: string;
  ownerId: string;
  organizationId?: string;
  projectTitle: string;
  summary: string;
  detailedDescription: string;
  projectNeeds: string;
  projectStage: ProjectStage;
  primaryCategory: PrimaryCategory | string;
  timeline?: string;
  lookingFor: CounterpartType[];
  industrySectors: string[];
  skillsNeeded: string[];
  operatingMarkets: string[];
  fundingAskMin?: number;
  fundingAskMax?: number;
  tractionSignals?: TractionSignals;
  advisoryTopics?: string[];
  partnerTypeNeeded?: string[];
  commitmentLevelNeeded?: CommitmentLevel;
  idealCounterpartProfile?: string;
  engagementModel?: EngagementModel[];
  targetCustomerTypes?: string[];
  normalizedNeedSignals?: ProjectNeedSignal[];
  keywords: string[];
  embedding?: number[];
  fieldEmbeddings?: Partial<Record<ProjectSemanticField, number[]>>;
  dataQualityScore: number;
  strictLookingFor?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProviderProfile {
  id: string;
  userId?: string;
  organizationId?: string;
  name: string;
  title?: string;
  description: string;
  counterpartType: CounterpartType;
  entityFamily: EntityFamily;
  executionTrack: ExecutionTrack;
  seniority?: SeniorityLevel;
  sectors: string[];
  skills: string[];
  capabilities: string[];
  operatingMarkets: string[];
  keywords: string[];
  embedding?: number[];
  fieldEmbeddings?: Partial<Record<ProviderSemanticField, number[]>>;
  offerSignals?: CounterpartOfferSignal[];
  yearsExperience?: number;
  recentRelevantProjects?: Array<{
    name?: string;
    sector?: string;
    stage?: ProjectStage;
    role?: string;
    success?: boolean;
    summary?: string;
    year?: number;
  }>;
  verified?: boolean;
  evidenceLevel?: ProviderEvidenceLevel;
  available?: boolean;
  blocked?: boolean;
  optedOut?: boolean;
  dataQualityScore: number;
  investorProfile?: InvestorProfile;
  advisorProfile?: AdvisorProfile;
  talentProfile?: TalentProfile;
  serviceProviderProfile?: ServiceProviderProfile;
  partnerProfile?: PartnerProfile;
  createdAt: Date;
  updatedAt: Date;
}

export type ProjectSemanticField =
  | "summary"
  | "detailedDescription"
  | "projectNeeds"
  | "skillsNeeded"
  | "industrySectors"
  | "operatingMarkets"
  | "idealCounterpartProfile";

export type ProviderSemanticField =
  | "description"
  | "skills"
  | "capabilities"
  | "sectors"
  | "operatingMarkets"
  | "investorThesis"
  | "advisorTopics"
  | "serviceCategories"
  | "partnerTypes"
  | "desiredRoles";

export interface SemanticFieldComparison {
  field: string;
  weight: number;
  score: number;
  evidence: string[];
}

export interface CandidateRetrievalDebug {
  providerId: string;
  structuredFilterScore: number;
  lexicalScore: number;
  semanticScore: number;
  retrievalScore: number;
  matchedFilters: string[];
}

export interface ProjectScoringWeights {
  lookingForFit: number;
  counterpartFit: number;
  needCoverage: number;
  needPrecision: number;
  capabilityFit: number;
  skillFit: number;
  sectorFit: number;
  marketFit: number;
  stageFit: number;
  engagementFit: number;
  subtypeSpecificFit: number;
  credibilityFit: number;
  semanticFit: number;
  completenessFit: number;
}

export interface CounterpartScoringPolicy {
  counterpartType: CounterpartType;
  weights: ProjectScoringWeights;
  minDeterministicScore: number;
  minPostAIScore: number;
  minConfidence: number;
  hardRequirements: {
    requireCounterpartTypeMatch: boolean;
    requireLookingForAlignment: boolean;
    requireMarketFitForStrictCases: boolean;
    requireFundingRangeForInvestor?: boolean;
  };
}

export interface ProjectMatchingConfig {
  defaultThresholds: ThresholdConfig & {
    maxCandidatesToScore: number;
    retrievalTake: number;
    retrievalMinScore: number;
  };
  confidenceGates: ConfidenceGates;
  fallbackScores: FallbackScores;
  features: FeatureFlags & {
    enableCounterpartSpecificScoring: boolean;
    enableNeedOntology: boolean;
    enableComparativeExplainability: boolean;
    enablePersistedExplanationHydration: boolean;
    enableHybridRetrieval: boolean;
    enableFieldEmbeddings: boolean;
  };
  counterpartPolicies: Record<CounterpartType, CounterpartScoringPolicy>;
}

export interface DeterministicProjectScoreBreakdown extends DeterministicScoreBreakdown {
  policyType: CounterpartType;
  componentScores: Record<string, number>;
  matchedNeeds: string[];
  matchedSkills: string[];
  matchedSectors: string[];
  matchedMarkets: string[];
  strongestSignals: string[];
  gaps: string[];
  semanticFieldComparisons: SemanticFieldComparison[];
  retrievalScore?: number;
}

export interface StructuredMatchExplanation extends MatchExplanation {
  passedHardFilters: string[];
  rankingDrivers: string[];
  strongestSignals: string[];
  missingCriticalSignals: string[];
  cautionFlags: string[];
  whySelectedIntentWon: string[];
  comparativeNotes?: string[];
  confidenceLabel: ConfidenceLevel | string;
  scoreBreakdown: Array<{ label: string; score: number }>;
}

export interface ProjectMatchResult extends BaseMatchResult {
  projectId: string;
  providerId: string;
  providerName: string;
  providerType: CounterpartType;
  intent: ProjectIntent;
  matchedNeeds: string[];
  matchedSkills: string[];
  matchedSectors: string[];
  matchedMarkets: string[];
  scoreBreakdown: DeterministicProjectScoreBreakdown;
  retrieval?: CandidateRetrievalDebug;
  explanation?: StructuredMatchExplanation;
  aiSummary?: string;
  hydrationSnapshot?: Record<string, unknown>;
  isVerified?: boolean;
  alternativeIntentScores?: Array<{
    intent: ProjectIntent;
    deterministicScore: number;
    confidence: number;
    whyNotSelected: string[];
  }>;
}

export interface ProjectMatchResponse extends BaseMatchResponse<ProjectMatchResult> {
  projectId: string;
  projectTitle: string;
  intent: ProjectIntent;
}

export interface ProjectFilterOptions extends BaseFilterOptions {
  counterpartTypes?: CounterpartType[];
  sectors?: string[];
  markets?: string[];
  minDataQualityScore?: number;
  requireVerified?: boolean;
}

export interface FindProjectMatchesRequest {
  projectId: string;
  intent: ProjectIntent;
  limit?: number;
  offset?: number;
  filters?: ProjectFilterOptions;
  includeAI?: boolean;
  includeExplanations?: boolean;
}

export interface ProjectMatchingJobPayload extends BaseJobPayload {
  projectId: string;
  intent: ProjectIntent;
  filters?: ProjectFilterOptions;
  includeAI?: boolean;
  includeExplanations?: boolean;
}

export interface StoredProjectMatch {
  id: string;
  projectId: string;
  providerId: string;
  intent: ProjectIntent;
  deterministicScore: number;
  aiScore?: number | null;
  finalScore: number;
  matchLevel: MatchLevel;
  confidence: number;
  explanationJson?: Record<string, unknown> | null;
  hydrationSnapshot?: Record<string, unknown> | null;
  createdAt: Date;
  expiresAt?: Date | null;
}

export interface ProjectAIValidationItem {
  providerId: string;
  aiScoreDelta: number;
  aiExplanation?: string;
  warnings?: string[];
  aiEvidenceFor?: string[];
  aiEvidenceAgainst?: string[];
}

export const DEFAULT_PROJECT_THRESHOLDS: ProjectMatchingConfig["defaultThresholds"] =
  {
    minDeterministicScore: 35,
    minPostAIScore: 35,
    minConfidence: 0.45,
    maxResults: 50,
    sparseRecordThreshold: 28,
    dataQualityThreshold: 25,
    maxCandidatesToScore: 250,
    retrievalTake: 300,
    retrievalMinScore: 0.12,
  };

const BASE_WEIGHTS: ProjectScoringWeights = {
  lookingForFit: 0.1,
  counterpartFit: 0.07,
  needCoverage: 0.14,
  needPrecision: 0.08,
  capabilityFit: 0.08,
  skillFit: 0.08,
  sectorFit: 0.08,
  marketFit: 0.06,
  stageFit: 0.06,
  engagementFit: 0.06,
  subtypeSpecificFit: 0.1,
  credibilityFit: 0.07,
  semanticFit: 0.08,
  completenessFit: 0.04,
};

export const COUNTERPART_SCORING_POLICIES: Record<
  CounterpartType,
  CounterpartScoringPolicy
> = {
  [CounterpartType.INVESTOR]: {
    counterpartType: CounterpartType.INVESTOR,
    weights: {
      ...BASE_WEIGHTS,
      needCoverage: 0.12,
      skillFit: 0.03,
      sectorFit: 0.13,
      marketFit: 0.08,
      stageFit: 0.12,
      engagementFit: 0.12,
      subtypeSpecificFit: 0.16,
      credibilityFit: 0.09,
      semanticFit: 0.04,
    },
    minDeterministicScore: 30,
    minPostAIScore: 30,
    minConfidence: 0.3,
    hardRequirements: {
      requireCounterpartTypeMatch: true,
      requireLookingForAlignment: true,
      requireMarketFitForStrictCases: true,
      requireFundingRangeForInvestor: false,
    },
  },
  [CounterpartType.ADVISOR]: {
    counterpartType: CounterpartType.ADVISOR,
    weights: {
      ...BASE_WEIGHTS,
      needCoverage: 0.12,
      needPrecision: 0.1,
      skillFit: 0.05,
      subtypeSpecificFit: 0.17,
      credibilityFit: 0.12,
      semanticFit: 0.05,
    },
    minDeterministicScore: 25,
    minPostAIScore: 25,
    minConfidence: 0.3,
    hardRequirements: {
      requireCounterpartTypeMatch: true,
      requireLookingForAlignment: true,
      requireMarketFitForStrictCases: false,
    },
  },
  [CounterpartType.SERVICE_PROVIDER]: {
    counterpartType: CounterpartType.SERVICE_PROVIDER,
    weights: {
      ...BASE_WEIGHTS,
      needCoverage: 0.16,
      needPrecision: 0.1,
      capabilityFit: 0.1,
      marketFit: 0.08,
      engagementFit: 0.1,
      subtypeSpecificFit: 0.14,
      semanticFit: 0.05,
    },
    minDeterministicScore: 28,
    minPostAIScore: 28,
    minConfidence: 0.3,
    hardRequirements: {
      requireCounterpartTypeMatch: true,
      requireLookingForAlignment: true,
      requireMarketFitForStrictCases: true,
    },
  },
  [CounterpartType.PARTNER]: {
    counterpartType: CounterpartType.PARTNER,
    weights: {
      ...BASE_WEIGHTS,
      needCoverage: 0.14,
      sectorFit: 0.1,
      marketFit: 0.1,
      subtypeSpecificFit: 0.16,
      engagementFit: 0.08,
      credibilityFit: 0.08,
      semanticFit: 0.05,
    },
    minDeterministicScore: 25,
    minPostAIScore: 25,
    minConfidence: 0.3,
    hardRequirements: {
      requireCounterpartTypeMatch: true,
      requireLookingForAlignment: true,
      requireMarketFitForStrictCases: true,
    },
  },
  [CounterpartType.COFOUNDER]: {
    counterpartType: CounterpartType.COFOUNDER,
    weights: {
      ...BASE_WEIGHTS,
      needCoverage: 0.12,
      capabilityFit: 0.06,
      skillFit: 0.14,
      stageFit: 0.08,
      engagementFit: 0.1,
      subtypeSpecificFit: 0.16,
      credibilityFit: 0.05,
      semanticFit: 0.06,
    },
    minDeterministicScore: 25,
    minPostAIScore: 25,
    minConfidence: 0.3,
    hardRequirements: {
      requireCounterpartTypeMatch: true,
      requireLookingForAlignment: true,
      requireMarketFitForStrictCases: false,
    },
  },
  [CounterpartType.TALENT]: {
    counterpartType: CounterpartType.TALENT,
    weights: {
      ...BASE_WEIGHTS,
      needCoverage: 0.11,
      skillFit: 0.17,
      engagementFit: 0.1,
      subtypeSpecificFit: 0.14,
      credibilityFit: 0.04,
      semanticFit: 0.08,
    },
    minDeterministicScore: 22,
    minPostAIScore: 22,
    minConfidence: 0.3,
    hardRequirements: {
      requireCounterpartTypeMatch: true,
      requireLookingForAlignment: true,
      requireMarketFitForStrictCases: false,
    },
  },
};

export const DEFAULT_PROJECT_CONFIG: ProjectMatchingConfig = {
  defaultThresholds: DEFAULT_PROJECT_THRESHOLDS,
  confidenceGates: {
    excellentMinConfidence: 0.78,
    veryGoodMinConfidence: 0.62,
    goodMinConfidence: 0.46,
    sparseProfileCap: MatchLevel.GOOD,
    lowDataQualityCap: MatchLevel.WEAK,
  },
  fallbackScores: {
    missingCapability: 12,
    missingSector: 18,
    missingExperience: 14,
    missingBudget: 20,
    missingTimeline: 22,
    sparseRecord: 10,
    aiFailure: 0,
  },
  features: {
    enableAIValidation: true,
    enableSemanticMatching: true,
    enableGeographyFilter: true,
    enableBudgetFilter: true,
    enableStrictMode: false,
    enablePrefilter: true,
    enableCounterpartSpecificScoring: true,
    enableNeedOntology: true,
    enableComparativeExplainability: true,
    enablePersistedExplanationHydration: true,
    enableHybridRetrieval: true,
    enableFieldEmbeddings: true,
  },
  counterpartPolicies: COUNTERPART_SCORING_POLICIES,
};

export function mapIntentToCounterpart(intent: ProjectIntent): CounterpartType {
  switch (intent) {
    case ProjectIntent.FIND_INVESTOR:
      return CounterpartType.INVESTOR;
    case ProjectIntent.FIND_ADVISOR:
      return CounterpartType.ADVISOR;
    case ProjectIntent.FIND_SERVICE_PROVIDER:
      return CounterpartType.SERVICE_PROVIDER;
    case ProjectIntent.FIND_COFOUNDER:
      return CounterpartType.COFOUNDER;
    case ProjectIntent.FIND_TALENT:
      return CounterpartType.TALENT;
    case ProjectIntent.FIND_PARTNER:
    default:
      return CounterpartType.PARTNER;
  }
}

export function getPolicyForIntent(
  intent: ProjectIntent,
  config: ProjectMatchingConfig = DEFAULT_PROJECT_CONFIG,
): CounterpartScoringPolicy {
  return config.counterpartPolicies[mapIntentToCounterpart(intent)];
}

export function getAlternativeIntentsForCounterpart(
  type: CounterpartType,
): ProjectIntent[] {
  switch (type) {
    case CounterpartType.INVESTOR:
      return [ProjectIntent.FIND_INVESTOR];
    case CounterpartType.ADVISOR:
      return [ProjectIntent.FIND_ADVISOR, ProjectIntent.FIND_PARTNER];
    case CounterpartType.SERVICE_PROVIDER:
      return [ProjectIntent.FIND_SERVICE_PROVIDER, ProjectIntent.FIND_PARTNER];
    case CounterpartType.PARTNER:
      return [ProjectIntent.FIND_PARTNER, ProjectIntent.FIND_ADVISOR];
    case CounterpartType.COFOUNDER:
      return [ProjectIntent.FIND_COFOUNDER, ProjectIntent.FIND_TALENT];
    case CounterpartType.TALENT:
      return [ProjectIntent.FIND_TALENT, ProjectIntent.FIND_COFOUNDER];
    default:
      return [ProjectIntent.FIND_PARTNER];
  }
}

// ============================================================================
// AUTH / NETWORK SCOPE
// ============================================================================

export interface AuthContext {
  userId: string;
  organizationId?: string;
}
export interface NetworkScopeConfig {
  maxDegree: number;
  includeOrganization: boolean;
}
export const DEFAULT_NETWORK_SCOPE: NetworkScopeConfig = {
  maxDegree: 1,
  includeOrganization: true,
};

export interface ProjectMatchWorkerPayload extends BaseJobPayload {
  auth: AuthContext;
  request: FindProjectMatchesRequest;
}

export interface ExtractedProjectFields {
  projectTitle?: string;
  summary?: string;
  detailedDescription?: string;
  projectNeeds?: string;
  projectStage?: string;
  primaryCategory?: string;
  timeline?: string;
  lookingFor?: CounterpartType[];
  industrySectors?: string[];
  skillsNeeded?: string[];
  operatingMarkets?: string[];
  fundingAskMin?: number;
  fundingAskMax?: number;
  tractionSignals?: string;
  advisoryTopics?: string[];
  partnerTypeNeeded?: string[];
  targetCustomerTypes?: string[];
  suggestedTags?: string[];
  fieldConfidence?: Record<string, number>;
}

