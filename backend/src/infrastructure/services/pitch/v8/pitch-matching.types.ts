/**
 * IntellMatch Pitch Matching Engine — Types & Configuration
 * v8.0.0 — production-hardened
 */

import {
  MatchLevel, HardFilterStatus, ConfidenceGates, DEFAULT_CONFIDENCE_GATES,
  ScoringComponent, MatchExplanation,
} from './matching-bands.constants';

export { MatchLevel, HardFilterStatus } from './matching-bands.constants';
export type { ScoringComponent, MatchExplanation } from './matching-bands.constants';

// ============================================================================
// AUTH CONTEXT — threaded through all service calls
// ============================================================================

export interface AuthContext {
  userId: string;
  organizationId?: string;
}

// ============================================================================
// ENUMS
// ============================================================================

export enum PitchStage {
  JUST_AN_IDEA = 'JUST_AN_IDEA',
  VALIDATING = 'VALIDATING',
  BUILDING_MVP = 'BUILDING_MVP',
  LAUNCHED = 'LAUNCHED',
  GROWING = 'GROWING',
  SCALING = 'SCALING',
}

export enum BusinessModel {
  B2B = 'B2B', B2C = 'B2C', B2B2C = 'B2B2C', SAAS = 'SAAS',
  MARKETPLACE = 'MARKETPLACE', SERVICES = 'SERVICES', SUBSCRIPTION = 'SUBSCRIPTION',
  HARDWARE = 'HARDWARE', LICENSING = 'LICENSING',
}

export enum MatchIntent {
  INVESTOR = 'INVESTOR', ADVISOR = 'ADVISOR', STRATEGIC_PARTNER = 'STRATEGIC_PARTNER',
  COFOUNDER = 'COFOUNDER', CUSTOMER_BUYER = 'CUSTOMER_BUYER',
}

export type LLMProvider = 'groq' | 'gemini' | 'openai';

export enum TagSource { AI_GENERATED = 'AI_GENERATED', USER_ADDED = 'USER_ADDED', SYSTEM = 'SYSTEM' }

export enum HardFilterReason {
  NONE = 'NONE', BLOCKED = 'BLOCKED', OPT_OUT = 'OPT_OUT', EXCLUDED = 'EXCLUDED',
  STAGE_INCOMPATIBLE = 'STAGE_INCOMPATIBLE', TYPE_MISMATCH = 'TYPE_MISMATCH',
  GEOGRAPHY_REQUIRED_MISMATCH = 'GEOGRAPHY_REQUIRED_MISMATCH',
  CATEGORY_REQUIRED_MISMATCH = 'CATEGORY_REQUIRED_MISMATCH',
  CUSTOMER_FIT_REQUIRED_MISMATCH = 'CUSTOMER_FIT_REQUIRED_MISMATCH',
  OFFER_CAPABILITY_REQUIRED_MISMATCH = 'OFFER_CAPABILITY_REQUIRED_MISMATCH',
}

/** v8: Support/need type tags for structured need classification */
export enum SupportNeededTag {
  FUNDING = 'funding', INTRODUCTIONS = 'introductions', ADVISOR = 'advisor',
  BOARD_GOVERNANCE = 'board_governance', STRATEGIC_PARTNER = 'strategic_partner',
  DISTRIBUTION_CHANNEL = 'distribution_channel', TECHNICAL_INTEGRATION = 'technical_integration',
  PILOT_CUSTOMER = 'pilot_customer', DESIGN_PARTNER = 'design_partner',
  BUYER_CUSTOMER = 'buyer_customer', ENTERPRISE_ACCESS = 'enterprise_access',
  COFOUNDER = 'cofounder', HIRING_TALENT = 'hiring_talent',
  COMPLIANCE_REGULATORY = 'compliance_regulatory', MARKET_ACCESS = 'market_access',
  GROWTH_SUPPORT = 'growth_support',
}

export interface TaggedItem { value: string; normalized: string; source: TagSource; }

// ============================================================================
// PITCH PROFILE — v8 adds supportNeededTags
// ============================================================================

export interface PitchProfile {
  id: string;
  userId: string;
  organizationId?: string;

  pitchDeckFileUrl?: string;
  pitchTitle: string;
  companyName?: string;
  elevatorPitch: string;
  problemStatement: string;
  solutionSummary: string;
  whatYouNeed: string;
  matchIntent: MatchIntent[];
  pitchStage: PitchStage;
  primaryCategory: string;
  industrySectors: string[];
  businessModel: BusinessModel[];
  targetCustomerType: string[];
  operatingMarkets: string[];
  tractionSummary?: string;
  founderBackgroundSummary?: string;
  fundingAmountRequested?: number;
  fundingCurrency?: string;

  /** v8: Structured support/need type tags — complements whatYouNeed */
  supportNeededTags?: SupportNeededTag[];

  tags: TaggedItem[];
  embedding?: number[];
  needEmbedding?: number[];
  dataQualityScore: number;
  excludedEntities: string[];
  requiredGeographies?: string[];
  strictCategoryMatch?: boolean;
  requireCustomerTypeFit?: boolean;
  requireOfferCapabilityFit?: boolean;

  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// CONTACT PROFILES (unchanged from v7)
// ============================================================================

export interface ContactInvestmentProfile {
  investorTypes?: string[]; ticketMinUsd?: number; ticketMaxUsd?: number;
  checkSizeNotes?: string; portfolioFocus?: string[];
  leadPreference?: 'LEAD' | 'FOLLOW' | 'BOTH' | 'UNKNOWN'; deploymentGeographies?: string[];
}

export interface ContactAdvisorProfile {
  advisorRoles?: string[]; functionalExpertise?: string[];
  operatorBackground?: string[]; boardExperience?: boolean;
}

export interface ContactPartnerProfile {
  partnerCapabilities?: string[]; partnershipTypes?: string[];
  distributionMarkets?: string[]; integrationCapabilities?: string[];
}

export interface ContactBuyerProfile {
  buyerSeniority?: string[]; buyerIndustries?: string[];
  buyingRoles?: string[]; procurementAuthority?: boolean;
}

export interface ContactFounderProfile {
  founderRoles?: string[]; builderFunctions?: string[];
  startupExperience?: string[]; cofounderStyle?: string[];
}

export interface PitchContact {
  id: string; userId?: string; fullName: string; title: string; company: string;
  contactTypes: MatchIntent[];
  sectors: string[]; businessModels: BusinessModel[]; customerTypes: string[];
  geographies: string[]; preferredStages: PitchStage[]; categories: string[];
  canOffer: string[]; keywords: string[]; expertise: string[];
  embedding?: number[]; needOfferEmbedding?: number[]; dataQualityScore: number;
  investmentProfile?: ContactInvestmentProfile; advisorProfile?: ContactAdvisorProfile;
  partnerProfile?: ContactPartnerProfile; buyerProfile?: ContactBuyerProfile;
  founderProfile?: ContactFounderProfile;
  optedOut: boolean; blocked: boolean; createdAt: Date; updatedAt: Date;
}

// ============================================================================
// SCORING WEIGHTS
// ============================================================================

export interface PitchScoringWeights {
  intentScore: number; categoryScore: number; sectorScore: number;
  businessModelScore: number; stageScore: number; customerTypeScore: number;
  geographyScore: number; needOfferScore: number; tractionScore: number;
  teamScore: number; semanticScore: number; counterpartFitScore: number;
}

export interface IntentScoringPolicy {
  intent: MatchIntent;
  weights: PitchScoringWeights;
  stageHardFilterMode: 'STRICT' | 'RELAXED' | 'NONE';
  requireNeedOfferEvidence: boolean;
  requireCustomerTypeFit: boolean;
  description: string;
}

export interface PitchThresholds {
  /** v8 TIGHTENED: minimum deterministic score to proceed */
  minDeterministicScore: number;
  /** v8 TIGHTENED: minimum final score after AI */
  minPostAIScore: number;
  maxResults: number;
  /** v8 TIGHTENED: sparse data quality threshold */
  sparseRecordThreshold: number;
  /** v8 NEW: per-intent minimum overrides */
  intentMinScores?: Partial<Record<MatchIntent, number>>;
}

export interface PitchFallbackScores {
  missingIntent: number; missingCategory: number; missingSector: number;
  missingModel: number; missingStage: number; missingCustomerType: number;
  missingGeography: number; missingNeedOffer: number; missingTraction: number;
  missingTeam: number; missingSemantic: number; missingCounterpartFit: number;
  aiFailure: number;
}

export interface PitchFeatureFlags {
  enableAIValidation: boolean; enableSemanticMatching: boolean;
  enableHardFilters: boolean;
  /** v8: renamed from enableStrictIntentFiltering — now soft by default */
  enableSoftIntentFiltering: boolean;
  enableIntentPolicies: boolean;
}

export interface PitchMatchingConfig {
  defaultWeights: PitchScoringWeights;
  thresholds: PitchThresholds;
  fallbackScores: PitchFallbackScores;
  confidenceGates: ConfidenceGates;
  features: PitchFeatureFlags;
  intentPolicies: Record<MatchIntent, IntentScoringPolicy>;
}

// Default weights (sum = 1.00)
export const DEFAULT_PITCH_WEIGHTS: PitchScoringWeights = {
  intentScore: 0.07, categoryScore: 0.08, sectorScore: 0.12,
  businessModelScore: 0.07, stageScore: 0.07, customerTypeScore: 0.07,
  geographyScore: 0.07, needOfferScore: 0.14, tractionScore: 0.07,
  teamScore: 0.06, semanticScore: 0.10, counterpartFitScore: 0.08,
};

// Intent policies (unchanged weights from v7)
const INVESTOR_POLICY: IntentScoringPolicy = {
  intent: MatchIntent.INVESTOR,
  weights: { intentScore: 0.08, categoryScore: 0.07, sectorScore: 0.12, businessModelScore: 0.05, stageScore: 0.10, customerTypeScore: 0.04, geographyScore: 0.06, needOfferScore: 0.12, tractionScore: 0.11, teamScore: 0.08, semanticScore: 0.05, counterpartFitScore: 0.12 },
  stageHardFilterMode: 'STRICT', requireNeedOfferEvidence: true, requireCustomerTypeFit: false,
  description: 'Investor matching prioritizes stage, traction, founder quality, and investment-fit evidence.',
};

const ADVISOR_POLICY: IntentScoringPolicy = {
  intent: MatchIntent.ADVISOR,
  weights: { intentScore: 0.08, categoryScore: 0.08, sectorScore: 0.14, businessModelScore: 0.05, stageScore: 0.07, customerTypeScore: 0.05, geographyScore: 0.05, needOfferScore: 0.12, tractionScore: 0.06, teamScore: 0.09, semanticScore: 0.09, counterpartFitScore: 0.12 },
  stageHardFilterMode: 'RELAXED', requireNeedOfferEvidence: true, requireCustomerTypeFit: false,
  description: 'Advisor matching prioritizes functional expertise, domain relevance, and founder-support capability.',
};

const STRATEGIC_PARTNER_POLICY: IntentScoringPolicy = {
  intent: MatchIntent.STRATEGIC_PARTNER,
  weights: { intentScore: 0.08, categoryScore: 0.07, sectorScore: 0.13, businessModelScore: 0.07, stageScore: 0.06, customerTypeScore: 0.08, geographyScore: 0.08, needOfferScore: 0.15, tractionScore: 0.05, teamScore: 0.04, semanticScore: 0.07, counterpartFitScore: 0.12 },
  stageHardFilterMode: 'RELAXED', requireNeedOfferEvidence: true, requireCustomerTypeFit: true,
  description: 'Strategic partner matching prioritizes distribution, integration, market access, and commercial fit.',
};

const COFOUNDER_POLICY: IntentScoringPolicy = {
  intent: MatchIntent.COFOUNDER,
  weights: { intentScore: 0.09, categoryScore: 0.06, sectorScore: 0.08, businessModelScore: 0.04, stageScore: 0.04, customerTypeScore: 0.04, geographyScore: 0.07, needOfferScore: 0.12, tractionScore: 0.05, teamScore: 0.14, semanticScore: 0.10, counterpartFitScore: 0.17 },
  stageHardFilterMode: 'NONE', requireNeedOfferEvidence: true, requireCustomerTypeFit: false,
  description: 'Co-founder matching prioritizes complementary strengths, founder experience, and mission fit.',
};

const CUSTOMER_BUYER_POLICY: IntentScoringPolicy = {
  intent: MatchIntent.CUSTOMER_BUYER,
  weights: { intentScore: 0.08, categoryScore: 0.08, sectorScore: 0.11, businessModelScore: 0.07, stageScore: 0.03, customerTypeScore: 0.13, geographyScore: 0.10, needOfferScore: 0.14, tractionScore: 0.03, teamScore: 0.02, semanticScore: 0.08, counterpartFitScore: 0.13 },
  stageHardFilterMode: 'NONE', requireNeedOfferEvidence: true, requireCustomerTypeFit: true,
  description: 'Customer/buyer matching prioritizes ICP fit, pain relevance, buying authority, and geographic fit.',
};

export const DEFAULT_INTENT_POLICIES: Record<MatchIntent, IntentScoringPolicy> = {
  [MatchIntent.INVESTOR]: INVESTOR_POLICY, [MatchIntent.ADVISOR]: ADVISOR_POLICY,
  [MatchIntent.STRATEGIC_PARTNER]: STRATEGIC_PARTNER_POLICY, [MatchIntent.COFOUNDER]: COFOUNDER_POLICY,
  [MatchIntent.CUSTOMER_BUYER]: CUSTOMER_BUYER_POLICY,
};

/** v8 TIGHTENED thresholds */
export const DEFAULT_PITCH_CONFIG: PitchMatchingConfig = {
  defaultWeights: DEFAULT_PITCH_WEIGHTS,
  thresholds: {
    minDeterministicScore: 38,   // was 30
    minPostAIScore: 32,          // was 25
    maxResults: 100,
    sparseRecordThreshold: 45,   // was 40
    intentMinScores: {
      [MatchIntent.INVESTOR]: 42,
      [MatchIntent.CUSTOMER_BUYER]: 40,
    },
  },
  fallbackScores: {
    missingIntent: 6, missingCategory: 6, missingSector: 6, missingModel: 8,
    missingStage: 6, missingCustomerType: 6, missingGeography: 8,
    missingNeedOffer: 4, missingTraction: 6, missingTeam: 8,
    missingSemantic: 6, missingCounterpartFit: 6, aiFailure: 0,
  },
  confidenceGates: DEFAULT_CONFIDENCE_GATES,
  features: {
    enableAIValidation: true, enableSemanticMatching: true, enableHardFilters: true,
    enableSoftIntentFiltering: true,  // v8: soft instead of strict
    enableIntentPolicies: true,
  },
  intentPolicies: DEFAULT_INTENT_POLICIES,
};

// ============================================================================
// PER-INTENT EVALUATION
// ============================================================================

export interface PerIntentEvaluation {
  intent: MatchIntent; weightedScore: number; confidence: number;
  hardFilterStatus: HardFilterStatus; hardFilterReason: HardFilterReason;
  details: string; rank?: number; selectionReason?: string;
  scoreDeltaFromWinner?: number; surfaceAsAlternative?: boolean; surfaceLabel?: string;
}

export interface DeterministicScoreBreakdown {
  intent: MatchIntent; components: ScoringComponent[];
  rawScore: number; normalizedScore: number; confidence: number;
  totalWeight: number; penalties: string[];
  perIntentEvaluations?: PerIntentEvaluation[];
}

// ============================================================================
// MATCH RESULT — v8 adds effectiveRankScore, AI reasoning
// ============================================================================

export interface PitchMatchResult {
  matchId: string; pitchId: string; contactId: string;
  contactName: string; contactTitle: string; contactCompany: string;
  contactTypes: MatchIntent[];
  deterministicScore: number; aiScore: number | null; finalScore: number;
  /** v8: ranking-safe score that accounts for gating/confidence/sparse penalties */
  effectiveRankScore: number;
  confidence: number; aiConfidence?: number | null; deterministicConfidence?: number;
  selectedIntent?: MatchIntent;
  topIntentEvaluations?: PerIntentEvaluation[];
  surfacedIntents?: PerIntentEvaluation[];
  matchLevel: MatchLevel; levelCappedReason: string | null;
  hardFilterStatus: HardFilterStatus; hardFilterReason: HardFilterReason;
  scoreBreakdown: DeterministicScoreBreakdown;
  explanation: MatchExplanation;
  keyReasons: string[];
  matchedSectors: string[]; matchedBusinessModels: string[]; matchedIntent: MatchIntent[];
  /** v8: AI reasoning exposed */
  aiReasoning?: string; aiGreenFlags?: string[]; aiRedFlags?: string[];
  rank: number; createdAt: Date; expiresAt: Date;
}

export interface PitchMatchFilters {
  intents?: MatchIntent[]; sectors?: string[]; stages?: PitchStage[];
  businessModels?: BusinessModel[]; geographies?: string[];
  categories?: string[]; excludeContactIds?: string[];
}

export interface FindPitchMatchesRequest {
  pitchId: string; limit?: number; offset?: number;
  includeAI?: boolean; includeExplanations?: boolean;
  filters?: PitchMatchFilters;
}

export interface PitchMatchResponse {
  success: boolean; matches: PitchMatchResult[];
  pitchId: string; pitchTitle: string;
  total: number; limit: number; offset: number; hasMore: boolean;
  contactsEvaluated: number; contactsFiltered: number;
  processingTimeMs: number; generatedAt: Date;
}

// ============================================================================
// EXTRACTION
// ============================================================================

export interface ExtractedPitchFields {
  pitchTitle?: string; companyName?: string; elevatorPitch?: string;
  problemStatement?: string; solutionSummary?: string; whatYouNeed?: string;
  matchIntent?: MatchIntent[]; pitchStage?: PitchStage; primaryCategory?: string;
  industrySectors?: string[]; businessModel?: BusinessModel[];
  targetCustomerType?: string[]; operatingMarkets?: string[];
  tractionSummary?: string; founderBackgroundSummary?: string;
  suggestedTags?: string[]; fieldConfidence?: Record<string, number>;
  fundingAmountRequested?: number; fundingCurrency?: string;
  supportNeededTags?: SupportNeededTag[];
}

export interface PitchAIValidationItem {
  contactId: string; originalScore: number; adjustedScore: number;
  confidence: number; reasoning: string; redFlags: string[]; greenFlags: string[];
}

export interface PitchAIValidationRequest {
  pitch: PitchProfile; contacts: PitchContact[]; deterministicScores: number[];
}

// ============================================================================
// PERSISTENCE
// ============================================================================

export interface StoredPitchMatch {
  id: string; pitchId: string; contactId: string;
  deterministicScore: number; aiScore: number | null; finalScore: number;
  effectiveRankScore: number;
  confidence: number; matchLevel: MatchLevel;
  hardFilterStatus: HardFilterStatus; hardFilterReason: HardFilterReason | null;
  selectedIntent: MatchIntent | null;
  scoreBreakdown: string; explanation: string | null;
  keyReasons: string[];
  matchedSectors: string[]; matchedBusinessModels: string[]; matchedIntent: MatchIntent[];
  aiReasoning: string | null; aiGreenFlags: string[]; aiRedFlags: string[];
  rank: number; version: number; archived: boolean; expiresAt: Date;
}

// ============================================================================
// WORKER — v8 includes auth context
// ============================================================================

export interface PitchMatchWorkerPayload {
  auth: AuthContext;
  request: FindPitchMatchesRequest;
}
