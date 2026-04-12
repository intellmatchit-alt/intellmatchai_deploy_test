/**
 * Deal Matching Domain Entities
 * Represents deal requests and match results
 */

// ============================================================================
// Enums
// ============================================================================

export enum DealMode {
  SELL = 'SELL',
  BUY = 'BUY',
}

export enum DealCompanySize {
  SMALL = 'SMALL',
  MEDIUM = 'MEDIUM',
  ENTERPRISE = 'ENTERPRISE',
}

export enum DealTargetEntityType {
  COMPANY = 'COMPANY',
  INDIVIDUAL = 'INDIVIDUAL',
  CONSULTANT = 'CONSULTANT',
  PARTNER = 'PARTNER',
}

export enum DealStatus {
  DRAFT = 'DRAFT',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

export enum DealMatchCategory {
  // Sell Mode categories
  POTENTIAL_CLIENT = 'POTENTIAL_CLIENT',
  DECISION_MAKER = 'DECISION_MAKER',
  INFLUENCER = 'INFLUENCER',
  // Buy Mode categories
  SOLUTION_PROVIDER = 'SOLUTION_PROVIDER',
  CONSULTANT = 'CONSULTANT',
  BROKER = 'BROKER',
  PARTNER = 'PARTNER',
}

export enum DealMatchStatus {
  NEW = 'NEW',
  SAVED = 'SAVED',
  IGNORED = 'IGNORED',
  CONTACTED = 'CONTACTED',
  ARCHIVED = 'ARCHIVED',
}

export enum DealJobStep {
  BUILD_CANDIDATES = 'BUILD_CANDIDATES',
  SCORE_CANDIDATES = 'SCORE_CANDIDATES',
  CLASSIFY_MATCHES = 'CLASSIFY_MATCHES',
  GENERATE_MESSAGES = 'GENERATE_MESSAGES',
}

export enum DealJobStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  RETRYING = 'RETRYING',
}

// ============================================================================
// Entities
// ============================================================================

export interface DealRequestEntity {
  id: string;
  userId: string;
  mode: DealMode;
  title: string | null;
  domain: string | null;
  solutionType: string | null;
  companySize: DealCompanySize | null;
  problemStatement: string | null;
  targetEntityType: DealTargetEntityType | null;
  productName: string | null;
  targetDescription: string | null;
  status: DealStatus;
  matchCount: number;
  avgScore: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface DealMatchResultEntity {
  id: string;
  dealRequestId: string;
  contactId: string;
  score: number;
  category: DealMatchCategory;
  reasonsJson: MatchReason[];
  breakdownJson: MatchBreakdown;
  openerMessage: string | null;
  openerEdited: string | null;
  status: DealMatchStatus;
  savedAt: Date | null;
  ignoredAt: Date | null;
  contactedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface DealJobEntity {
  id: string;
  dealRequestId: string;
  step: DealJobStep;
  status: DealJobStatus;
  progress: number;
  error: string | null;
  attempts: number;
  maxAttempts: number;
  startedAt: Date | null;
  completedAt: Date | null;
  bullJobId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// Value Objects
// ============================================================================

export interface MatchReason {
  type: MatchReasonType;
  text: string;
  evidence: string;
}

export enum MatchReasonType {
  // Sell mode reasons
  COMPANY_FIT = 'COMPANY_FIT',
  ROLE_FIT = 'ROLE_FIT',
  INDUSTRY_MATCH = 'INDUSTRY_MATCH',
  SIZE_MATCH = 'SIZE_MATCH',
  PAIN_ALIGNMENT = 'PAIN_ALIGNMENT',
  // Buy mode reasons
  PROVIDER_COMPANY = 'PROVIDER_COMPANY',
  EXPERTISE_ROLE = 'EXPERTISE_ROLE',
  DOMAIN_EXPERIENCE = 'DOMAIN_EXPERIENCE',
  SERVICE_MATCH = 'SERVICE_MATCH',
  // Shared reasons
  RELATIONSHIP_STRENGTH = 'RELATIONSHIP_STRENGTH',
  RECENT_INTERACTION = 'RECENT_INTERACTION',
  SECTOR_OVERLAP = 'SECTOR_OVERLAP',
  SKILL_MATCH = 'SKILL_MATCH',
}

export interface MatchBreakdown {
  relevance: ComponentScore;
  expertise: ComponentScore;
  strategic: ComponentScore;
  relationship: ComponentScore;
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

export interface CreateDealRequestInput {
  userId: string;
  mode: DealMode;
  title?: string;
  domain?: string;
  solutionType?: string;
  companySize?: DealCompanySize;
  problemStatement?: string;
  targetEntityType?: DealTargetEntityType;
  productName?: string;
  targetDescription?: string;
}

export interface UpdateDealRequestInput {
  title?: string;
  domain?: string;
  solutionType?: string;
  companySize?: DealCompanySize;
  problemStatement?: string;
  targetEntityType?: DealTargetEntityType;
  productName?: string;
  targetDescription?: string;
  status?: DealStatus;
  matchCount?: number;
  avgScore?: number;
}

export interface CreateDealMatchResultInput {
  dealRequestId: string;
  contactId: string;
  score: number;
  category: DealMatchCategory;
  reasonsJson: MatchReason[];
  breakdownJson: MatchBreakdown;
  openerMessage?: string;
}

export interface UpdateDealMatchResultInput {
  status?: DealMatchStatus;
  openerMessage?: string;
  openerEdited?: string;
  savedAt?: Date;
  ignoredAt?: Date;
  contactedAt?: Date;
}

export interface CreateDealJobInput {
  dealRequestId: string;
  step: DealJobStep;
  maxAttempts?: number;
}

export interface UpdateDealJobInput {
  status?: DealJobStatus;
  progress?: number;
  error?: string;
  attempts?: number;
  startedAt?: Date;
  completedAt?: Date;
  bullJobId?: string;
}

// ============================================================================
// Default weights for scoring
// ============================================================================

export const DEFAULT_DEAL_WEIGHTS = {
  relevance: 0.40,
  expertise: 0.30,
  strategic: 0.20,
  relationship: 0.10,
} as const;

// Sync threshold - above this, use async processing
export const SYNC_CONTACT_THRESHOLD = 200;
