/**
 * Deal Matching Engine — Types & Configuration
 * v4.0.0 — strict final production
 */

import {
  ScoreBand, HardFilterStatus, HardFilterReason, ScoreBreakdown, MatchExplanation,
  BaseMatchResult, MatchResponse, TagSet, ExtractionResult, SurfacedStatus,
} from './common';

// ============================================================================
// ENUMS
// ============================================================================

export enum SolutionCategory {
  SAAS_SOFTWARE = 'SAAS_SOFTWARE', CONSULTING_ADVISORY = 'CONSULTING_ADVISORY',
  PROFESSIONAL_SERVICES = 'PROFESSIONAL_SERVICES', HARDWARE = 'HARDWARE',
  TRAINING_EDUCATION = 'TRAINING_EDUCATION', MANAGED_SERVICES = 'MANAGED_SERVICES',
  INTEGRATION = 'INTEGRATION', STAFFING = 'STAFFING', MARKETING = 'MARKETING',
  LEGAL = 'LEGAL', FINANCIAL = 'FINANCIAL', OTHER = 'OTHER',
}

export enum ProviderType {
  COMPANY = 'COMPANY', INDIVIDUAL = 'INDIVIDUAL', CONSULTANT = 'CONSULTANT',
  PARTNER = 'PARTNER', AGENCY = 'AGENCY',
}

export enum CompanySize {
  INDIVIDUAL_SOLO = 'INDIVIDUAL_SOLO', SMALL = 'SMALL', MEDIUM = 'MEDIUM',
  ENTERPRISE = 'ENTERPRISE', NO_PREFERENCE = 'NO_PREFERENCE',
}

export enum BudgetRange {
  UNDER_5K = 'UNDER_5K', RANGE_5K_25K = 'RANGE_5K_25K', RANGE_25K_100K = 'RANGE_25K_100K',
  RANGE_100K_500K = 'RANGE_100K_500K', RANGE_500K_PLUS = 'RANGE_500K_PLUS', CUSTOM = 'CUSTOM',
}

export enum NeededTimeline {
  IMMEDIATELY = 'IMMEDIATELY', WITHIN_1_MONTH = 'WITHIN_1_MONTH',
  WITHIN_3_MONTHS = 'WITHIN_3_MONTHS', WITHIN_6_MONTHS = 'WITHIN_6_MONTHS', EXPLORING = 'EXPLORING',
}

export enum BuyingStage {
  EXPLORING = 'EXPLORING', COMPARING = 'COMPARING',
  READY_TO_DECIDE = 'READY_TO_DECIDE', URGENT_NEED = 'URGENT_NEED',
}

export enum DeliveryMode {
  REMOTE = 'REMOTE', ONSITE = 'ONSITE', HYBRID = 'HYBRID', NO_PREFERENCE = 'NO_PREFERENCE',
}

export enum DeliveryModel {
  PRODUCT = 'PRODUCT', SERVICE = 'SERVICE', SUBSCRIPTION = 'SUBSCRIPTION',
  PROJECT_BASED = 'PROJECT_BASED', RETAINER = 'RETAINER', LICENSE = 'LICENSE', NO_PREFERENCE = 'NO_PREFERENCE',
}

export enum TargetCompanySize {
  STARTUP = 'STARTUP', SMALL_BUSINESS = 'SMALL_BUSINESS', MID_MARKET = 'MID_MARKET',
  ENTERPRISE = 'ENTERPRISE', NO_PREFERENCE = 'NO_PREFERENCE',
}

export enum BuyerType {
  C_LEVEL = 'C_LEVEL', BUDGET_HOLDER = 'BUDGET_HOLDER', PROCUREMENT_MANAGER = 'PROCUREMENT_MANAGER',
  SMB_OWNER = 'SMB_OWNER', TECHNICAL_EVALUATOR = 'TECHNICAL_EVALUATOR', DEPARTMENT_HEAD = 'DEPARTMENT_HEAD',
}

export enum SalesTimeline {
  ACTIVELY_SELLING = 'ACTIVELY_SELLING', EXPLORING_MARKET = 'EXPLORING_MARKET',
  BUILDING_PIPELINE = 'BUILDING_PIPELINE', SEASONAL = 'SEASONAL',
}

/** v4: Explicit buyer role field — lean, high-impact */
export enum BuyerRole {
  EXECUTIVE = 'EXECUTIVE',
  TEAM_LEAD = 'TEAM_LEAD',
  PROCUREMENT = 'PROCUREMENT',
  TECHNICAL = 'TECHNICAL',
  FOUNDER_OWNER = 'FOUNDER_OWNER',
  OPERATIONS = 'OPERATIONS',
}

// ============================================================================
// BUY REQUEST — v4: added buyerRole
// ============================================================================

export interface BuyRequest {
  id: string; ownerId: string; organizationId?: string;
  requestDocumentFile?: string;
  whatYouNeed: string; solutionCategory: SolutionCategory;
  relevantIndustry: string[]; providerType: ProviderType;
  preferredProviderSize?: CompanySize; mustHaveRequirements: string[];
  budgetRange: BudgetRange; neededTimeline: NeededTimeline; buyingStage: BuyingStage;
  targetMarketLocation?: string; deliveryMode?: DeliveryMode;
  idealProviderProfile?: string; requestName?: string;
  /** v4: Explicit buyer role — replaces inference-only persona */
  buyerRole?: BuyerRole;
  aiGeneratedTags?: string[]; userTags?: string[]; tags?: TagSet;
  embedding?: number[]; dataQualityScore: number;
  isActive: boolean; isDeleted: boolean;
  createdAt: Date; updatedAt: Date;
  source: 'MANUAL' | 'UPLOAD' | 'API'; uploadedDocumentId?: string;
}

// ============================================================================
// SELL OFFERING (unchanged from v3)
// ============================================================================

export interface SellOffering {
  id: string; ownerId: string; organizationId?: string;
  offeringDocumentFile?: string;
  productServiceName: string; offeringSummary?: string;
  solutionCategory: SolutionCategory; providerType: ProviderType;
  industryFocus: string[]; deliveryModel?: DeliveryModel;
  targetCompanySize: TargetCompanySize; companySize?: CompanySize;
  idealBuyerType: BuyerType[]; idealCustomerProfile: string;
  targetMarketLocation?: string; priceRange: BudgetRange;
  salesTimeline: SalesTimeline; dealName?: string;
  deliveryModeCapability?: DeliveryMode[];
  capabilities: string[];
  aiGeneratedTags?: string[]; userTags?: string[]; tags?: TagSet;
  embedding?: number[]; dataQualityScore: number;
  isActive: boolean; isDeleted: boolean;
  createdAt: Date; updatedAt: Date;
  source: 'MANUAL' | 'UPLOAD' | 'API'; uploadedDocumentId?: string;
}

// ============================================================================
// SCORING WEIGHTS (unchanged from v3)
// ============================================================================

export interface DealScoringWeights {
  categoryScore: number; industryScore: number; providerSizeScore: number;
  budgetScore: number; timelineScore: number; requirementsScore: number;
  locationScore: number; deliveryScore: number; semanticScore: number;
  providerTypeScore: number; buyerPersonaScore: number;
}

export const DEFAULT_DEAL_WEIGHTS: DealScoringWeights = {
  semanticScore: 0.13, requirementsScore: 0.14, categoryScore: 0.12,
  industryScore: 0.12, budgetScore: 0.11, providerTypeScore: 0.07,
  providerSizeScore: 0.07, buyerPersonaScore: 0.06, timelineScore: 0.07,
  locationScore: 0.06, deliveryScore: 0.05,
};

// ============================================================================
// THRESHOLDS — v4 FURTHER TIGHTENED
// ============================================================================

export interface DealThresholdConfig {
  minScore: number;
  minConfidence: number;
  maxResults: number;
  sparseDataThreshold: number;
  strongMinConfidence: number;
  sparseMaxBand: ScoreBand;
}

export const DEFAULT_DEAL_THRESHOLDS: DealThresholdConfig = {
  minScore: 36,               // v4: from 35
  minConfidence: 0.40,        // v4: from 0.38
  maxResults: 50,
  sparseDataThreshold: 32,    // v4: from 30
  strongMinConfidence: 0.58,  // v4: from 0.55
  sparseMaxBand: ScoreBand.GOOD,
};

// ============================================================================
// BUDGET COMPATIBILITY (unchanged from v3)
// ============================================================================

export const BUDGET_ORDER: Record<BudgetRange, number> = {
  [BudgetRange.UNDER_5K]: 1, [BudgetRange.RANGE_5K_25K]: 2,
  [BudgetRange.RANGE_25K_100K]: 3, [BudgetRange.RANGE_100K_500K]: 4,
  [BudgetRange.RANGE_500K_PLUS]: 5, [BudgetRange.CUSTOM]: 0,
};

export function areBudgetsCompatible(
  buyerBudget: BudgetRange, sellerPrice: BudgetRange,
): { compatible: boolean; gap: 'EXACT' | 'CLOSE' | 'GAP' | 'LARGE_GAP' | 'UNKNOWN'; direction: 'EXACT' | 'BUYER_CAN_AFFORD' | 'SELLER_TOO_EXPENSIVE' | 'UNKNOWN' } {
  const bL = BUDGET_ORDER[buyerBudget]; const sL = BUDGET_ORDER[sellerPrice];
  if (bL === 0 || sL === 0) return { compatible: true, gap: 'UNKNOWN', direction: 'UNKNOWN' };
  const diff = sL - bL;
  if (diff === 0) return { compatible: true, gap: 'EXACT', direction: 'EXACT' };
  if (diff === -1) return { compatible: true, gap: 'CLOSE', direction: 'BUYER_CAN_AFFORD' };
  if (diff === 1) return { compatible: true, gap: 'CLOSE', direction: 'SELLER_TOO_EXPENSIVE' };
  if (diff <= -2) return { compatible: true, gap: 'GAP', direction: 'BUYER_CAN_AFFORD' };
  if (diff === 2) return { compatible: false, gap: 'GAP', direction: 'SELLER_TOO_EXPENSIVE' };
  return { compatible: false, gap: 'LARGE_GAP', direction: 'SELLER_TOO_EXPENSIVE' };
}

// ============================================================================
// MATCH RESULT — v4: surfacedStatus added
// ============================================================================

export interface DealMatchResult extends BaseMatchResult {
  buyRequestId: string; sellOfferingId: string;
  sellerName: string; buyerNeed: string;
  categoryFit: { buyerCategory: SolutionCategory; sellerCategory: SolutionCategory; match: boolean };
  industryFit: { buyerIndustries: string[]; sellerIndustries: string[]; matched: string[]; overlapScore: number };
  budgetFit: { buyerBudget: BudgetRange; sellerPrice: BudgetRange; compatible: boolean; budgetGap: string; direction: string };
  requirementsFit: { buyerRequirements: string[]; sellerCapabilities: string[]; matched: string[]; missing: string[]; satisfactionScore: number };
  sizeFit: { preferredSize?: CompanySize; providerSize?: CompanySize; sellerTargetSize?: TargetCompanySize; compatible: boolean };
  providerTypeFit: { buyerProviderType: ProviderType; sellerProviderType: ProviderType; match: boolean };
  buyerPersonaFit: { inferredPersona: BuyerType[]; sellerIdealBuyerType: BuyerType[]; matched: BuyerType[]; coverageScore: number; buyerRole?: BuyerRole };
  locationFit: { buyerLocation?: string; sellerLocation?: string; compatible: boolean };
  deliveryFit: { buyerMode?: DeliveryMode; sellerCapability: DeliveryMode[]; compatible: boolean };
  timelineFit: { buyerTimeline: NeededTimeline; buyerStage: BuyingStage; sellerTimeline: SalesTimeline; aligned: boolean };
}

export interface DealMatchResponse extends MatchResponse<DealMatchResult> {
  buyRequestId: string; buyRequestName: string;
}

// ============================================================================
// REQUEST / FILTER / EXTRACTION / DTO TYPES
// ============================================================================

export interface FindDealMatchesRequest {
  buyRequestId: string; limit?: number; offset?: number;
  filters?: DealMatchFilters; includeExplanations?: boolean;
}

export interface DealMatchFilters {
  categories?: SolutionCategory[]; industries?: string[];
  budgetRanges?: BudgetRange[]; providerSizes?: CompanySize[];
  deliveryModes?: DeliveryMode[]; locations?: string[];
}

export type BuyRequestExtractionResult = ExtractionResult<BuyRequest>;
export type SellOfferingExtractionResult = ExtractionResult<SellOffering>;

/** v4: added buyerRole to DTO */
export interface CreateBuyRequestDTO {
  whatYouNeed: string; solutionCategory: SolutionCategory;
  relevantIndustry: string[]; providerType: ProviderType;
  preferredProviderSize?: CompanySize; mustHaveRequirements: string[];
  budgetRange: BudgetRange; neededTimeline: NeededTimeline; buyingStage: BuyingStage;
  targetMarketLocation?: string; deliveryMode?: DeliveryMode;
  idealProviderProfile?: string; requestName?: string;
  buyerRole?: BuyerRole;
  userTags?: string[];
}

export interface UpdateBuyRequestDTO extends Partial<CreateBuyRequestDTO> { aiGeneratedTags?: string[]; }

export interface CreateSellOfferingDTO {
  productServiceName: string; offeringSummary?: string;
  solutionCategory: SolutionCategory; industryFocus: string[];
  deliveryModel?: DeliveryModel; targetCompanySize: TargetCompanySize;
  idealBuyerType: BuyerType[]; idealCustomerProfile: string;
  targetMarketLocation?: string; priceRange: BudgetRange;
  salesTimeline: SalesTimeline; dealName?: string;
  capabilities: string[]; providerType: ProviderType;
  companySize?: CompanySize; deliveryModeCapability?: DeliveryMode[];
  userTags?: string[];
}

export interface UpdateSellOfferingDTO extends Partial<CreateSellOfferingDTO> { aiGeneratedTags?: string[]; }

// ============================================================================
// VALIDATION / DATA QUALITY
// ============================================================================

export function isBuyRequestComplete(r: Partial<BuyRequest>): boolean {
  return !!(r.whatYouNeed && r.solutionCategory && r.relevantIndustry?.length && r.providerType && r.mustHaveRequirements?.length && r.budgetRange && r.neededTimeline && r.buyingStage);
}

export function isSellOfferingComplete(o: Partial<SellOffering>): boolean {
  return !!(o.productServiceName && o.solutionCategory && o.industryFocus?.length && o.targetCompanySize && o.idealBuyerType?.length && o.idealCustomerProfile && o.priceRange && o.salesTimeline && o.providerType);
}

export function calculateBuyRequestDataQuality(r: Partial<BuyRequest>): number {
  let s = 0;
  if (r.whatYouNeed) s += 15; if (r.solutionCategory) s += 12; if (r.relevantIndustry?.length) s += 12;
  if (r.providerType) s += 8; if (r.preferredProviderSize) s += 3; if (r.mustHaveRequirements?.length) s += 15;
  if (r.budgetRange) s += 10; if (r.neededTimeline) s += 8; if (r.buyingStage) s += 8;
  if (r.targetMarketLocation) s += 3; if (r.deliveryMode) s += 3; if (r.idealProviderProfile) s += 3;
  if (r.buyerRole) s += 2;
  return s;
}

export function calculateSellOfferingDataQuality(o: Partial<SellOffering>): number {
  let s = 0;
  if (o.productServiceName) s += 12; if (o.offeringSummary) s += 8; if (o.solutionCategory) s += 12;
  if (o.industryFocus?.length) s += 12; if (o.deliveryModel) s += 3; if (o.targetCompanySize) s += 6;
  if (o.idealBuyerType?.length) s += 8; if (o.idealCustomerProfile) s += 12; if (o.targetMarketLocation) s += 3;
  if (o.priceRange) s += 10; if (o.salesTimeline) s += 4; if (o.capabilities?.length) s += 6;
  if (o.deliveryModeCapability?.length) s += 2; if (o.providerType) s += 2;
  return s;
}
