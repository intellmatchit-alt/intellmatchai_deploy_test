/**
 * Product Match Domain Entities (Sell Smarter Feature)
 * Represents product profiles and match results for sales lead discovery
 */

// Re-export seniority types from the shared canonical source
export { SeniorityLevel, SENIORITY_SCORES, SENIORITY_KEYWORDS } from '../../shared/matching';

// ============================================================================
// Enums
// ============================================================================

export enum ProductType {
  SAAS = 'SAAS',
  SERVICE = 'SERVICE',
  SOLUTION = 'SOLUTION',
}

export enum ProductMatchRunStatus {
  QUEUED = 'QUEUED',
  RUNNING = 'RUNNING',
  DONE = 'DONE',
  FAILED = 'FAILED',
}

export enum ProductMatchBadge {
  SUITABLE = 'SUITABLE',         // Score >= 70
  INFLUENCER = 'INFLUENCER',     // Score 40-69
  NOT_SUITABLE = 'NOT_SUITABLE', // Score < 40
}

export enum ExplanationType {
  DECISION_POWER = 'DECISION_POWER',
  COMPANY_FIT = 'COMPANY_FIT',
  ROLE_CONTEXT = 'ROLE_CONTEXT',
  RELATIONSHIP = 'RELATIONSHIP',
}

// ============================================================================
// Entities
// ============================================================================

export interface ProductProfileEntity {
  id: string;
  userId: string;
  productType: ProductType;
  productName: string | null;
  targetIndustry: string;
  targetCompanySize: string;
  problemSolved: string;
  decisionMakerRole: string;
  additionalContext: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProductMatchRunEntity {
  id: string;
  userId: string;
  productProfileId: string;
  status: ProductMatchRunStatus;
  progress: number;
  totalContacts: number;
  matchCount: number;
  avgScore: number;
  error: string | null;
  startedAt: Date | null;
  completedAt: Date | null;
  bullJobId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProductMatchResultEntity {
  id: string;
  matchRunId: string;
  contactId: string;
  score: number;
  badge: ProductMatchBadge;
  explanationJson: ExplanationBullet[];
  talkAngle: string | null;
  openerMessage: string | null;
  openerEdited: string | null;
  breakdownJson: ProductMatchBreakdown;
  isSaved: boolean;
  isDismissed: boolean;
  isContacted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// Value Objects
// ============================================================================

export interface ExplanationBullet {
  type: ExplanationType;
  text: string;
}

export interface ProductMatchBreakdown {
  decisionPower: ComponentScore;
  companyFit: ComponentScore;
  roleContext: ComponentScore;
  additional: ComponentScore;
}

export interface ComponentScore {
  score: number;      // 0-100
  weight: number;     // 0-1
  weighted: number;   // score * weight
  details: Record<string, number>;
}

// ============================================================================
// DTOs
// ============================================================================

export interface UpsertProductProfileInput {
  userId: string;
  productType: ProductType;
  productName?: string;
  targetIndustry: string;
  targetCompanySize: string;
  problemSolved: string;
  decisionMakerRole: string;
  additionalContext?: string;
}

export interface CreateProductMatchRunInput {
  userId: string;
  productProfileId: string;
  totalContacts?: number;
  bullJobId?: string;
}

export interface UpdateProductMatchRunInput {
  status?: ProductMatchRunStatus;
  progress?: number;
  totalContacts?: number;
  matchCount?: number;
  avgScore?: number;
  error?: string;
  startedAt?: Date;
  completedAt?: Date;
  bullJobId?: string;
}

export interface CreateProductMatchResultInput {
  matchRunId: string;
  contactId: string;
  score: number;
  badge: ProductMatchBadge;
  explanationJson: ExplanationBullet[];
  talkAngle?: string;
  openerMessage?: string;
  breakdownJson: ProductMatchBreakdown;
}

export interface UpdateProductMatchResultInput {
  isSaved?: boolean;
  isDismissed?: boolean;
  isContacted?: boolean;
  openerEdited?: string;
}

// ============================================================================
// Contact data for matching (slim version for scoring)
// ============================================================================

export interface ContactForMatching {
  id: string;
  fullName: string;
  jobTitle: string | null;
  company: string | null;
  matchScore: number | null; // Relationship strength from contact record
  enrichmentData: {
    industry?: string;
    companySize?: string;
    department?: string;
  } | null;
  lastInteractionAt: Date | null;
  interactionCount: number;
  sectors: string[];
  skills: string[];
}

// ============================================================================
// Scoring result from service
// ============================================================================

export interface ProductMatchScoringResult {
  contactId: string;
  score: number;
  badge: ProductMatchBadge;
  explanations: ExplanationBullet[];
  talkAngle: string;
  openerMessage: string;
  breakdown: ProductMatchBreakdown;
}

// ============================================================================
// Constants
// ============================================================================

// Scoring weights (must sum to 1.0)
export const PRODUCT_MATCH_WEIGHTS = {
  decisionPower: 0.40,
  companyFit: 0.30,
  roleContext: 0.20,
  additional: 0.10,
} as const;

// Badge thresholds
export const BADGE_THRESHOLDS = {
  suitable: 70,     // Score >= 70
  influencer: 40,   // Score 40-69
  notSuitable: 0,   // Score < 40
} as const;

// Sync threshold - above this, use async processing
export const SYNC_CONTACT_THRESHOLD = 200;

// Company size mapping
export const COMPANY_SIZE_MAP: Record<string, string[]> = {
  SMALL: ['small', 'startup', '1-10', '11-50', 'micro', 'early-stage'],
  MEDIUM: ['medium', 'mid-size', '51-200', '201-500', 'growth'],
  ENTERPRISE: ['enterprise', 'large', '500+', '1000+', '5000+', 'corporate', 'fortune'],
  ANY: ['any', 'all'],
};
