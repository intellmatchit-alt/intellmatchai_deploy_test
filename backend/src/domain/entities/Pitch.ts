/**
 * PNME Domain Entity: Pitch
 * Represents an uploaded pitch deck with its processing state
 */

import { PitchFileType, PitchStatus as PrismaPitchStatus } from '@prisma/client';

// Re-export PitchStatus for convenience - must match Prisma schema exactly
export type PitchStatus = PrismaPitchStatus;
export const PitchStatus = {
  PENDING: 'PENDING' as const,
  EXTRACTING: 'EXTRACTING' as const,
  CLASSIFYING: 'CLASSIFYING' as const,
  ANALYZING: 'ANALYZING' as const,
  MATCHING: 'MATCHING' as const,
  GENERATING: 'GENERATING' as const,
  COMPLETED: 'COMPLETED' as const,
  FAILED: 'FAILED' as const,
  EXPIRED: 'EXPIRED' as const,
};

export interface PitchEntity {
  id: string;
  userId: string;
  fileKey: string;
  fileName: string;
  fileType: PitchFileType;
  fileSize: number;
  language: string;
  status: string;
  title: string | null;
  companyName: string | null;
  rawText: string | null;
  uploadedAt: Date;
  processedAt: Date | null;
  expiresAt: Date | null;
  lastError: string | null;
  deletedAt: Date | null;
}

export interface PitchSectionEntity {
  id: string;
  pitchId: string;
  type: PitchSectionType;
  order: number;
  title: string;
  content: string;
  rawContent: string | null;
  confidence: number;
  embedding: number[] | null;
  embeddingModel: string | null;
  inferredSectors: string[] | null;
  inferredSkills: string[] | null;
  keywords: string[] | null;
  createdAt: Date;
}

export interface PitchNeedEntity {
  id: string;
  pitchId: string;
  key: PitchNeedKey;
  label: string;
  description: string | null;
  confidence: number;
  sourceSectionType: PitchSectionType | null;
  amount: string | null;
  timeline: string | null;
  priority: number;
  createdAt: Date;
}

export interface PitchMatchEntity {
  id: string;
  pitchSectionId: string;
  contactId: string;
  score: number;
  relevanceScore: number;
  expertiseScore: number;
  strategicScore: number;
  relationshipScore: number;
  breakdownJson: MatchBreakdown;
  reasonsJson: MatchReason[];
  angleCategory: MatchAngleCategory | null;
  outreachDraft: string | null;
  outreachEdited: string | null;
  status: PitchMatchStatus;
  savedAt: Date | null;
  ignoredAt: Date | null;
  contactedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PitchJobEntity {
  id: string;
  pitchId: string;
  step: PitchJobStep;
  status: PitchJobStatus;
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

export interface ContactProfileCacheEntity {
  id: string;
  contactId: string;
  userId: string;
  profileSummary: string;
  sectors: string[];
  skills: string[];
  interests: string[];
  keywords: string[] | null;
  investorType: string | null;
  investmentStage: string | null;
  checkSize: string | null;
  geography: string | null;
  previousInvestments: string[] | null;
  expertise: string[] | null;
  embedding: number[] | null;
  embeddingModel: string | null;
  relationshipStrength: number;
  lastInteractionDays: number | null;
  interactionCount: number;
  isStale: boolean;
  builtAt: Date;
  updatedAt: Date;
}

// Enums (matching Prisma schema)
export enum PitchSectionType {
  PROBLEM = 'PROBLEM',
  SOLUTION = 'SOLUTION',
  MARKET = 'MARKET',
  BUSINESS_MODEL = 'BUSINESS_MODEL',
  TRACTION = 'TRACTION',
  TECHNOLOGY = 'TECHNOLOGY',
  TEAM = 'TEAM',
  INVESTMENT_ASK = 'INVESTMENT_ASK',
  OTHER = 'OTHER',
}

export enum PitchNeedKey {
  FUNDING = 'FUNDING',
  SECTOR_EXPERTISE = 'SECTOR_EXPERTISE',
  TECHNICAL_EXPERTISE = 'TECHNICAL_EXPERTISE',
  GO_TO_MARKET = 'GO_TO_MARKET',
  PARTNERSHIPS = 'PARTNERSHIPS',
  TALENT = 'TALENT',
  REGULATORY = 'REGULATORY',
  OPERATIONS = 'OPERATIONS',
  MENTORSHIP = 'MENTORSHIP',
  INTRODUCTIONS = 'INTRODUCTIONS',
}

export enum MatchAngleCategory {
  INVESTOR_FIT = 'INVESTOR_FIT',
  TECHNICAL_ADVISOR = 'TECHNICAL_ADVISOR',
  MARKET_ACCESS = 'MARKET_ACCESS',
  STRATEGIC_PARTNER = 'STRATEGIC_PARTNER',
  DOMAIN_EXPERT = 'DOMAIN_EXPERT',
  TALENT_SOURCE = 'TALENT_SOURCE',
  CUSTOMER_INTRO = 'CUSTOMER_INTRO',
  REGULATORY_HELP = 'REGULATORY_HELP',
}

export enum PitchMatchStatus {
  PENDING = 'PENDING',
  SAVED = 'SAVED',
  IGNORED = 'IGNORED',
  CONTACTED = 'CONTACTED',
  ARCHIVED = 'ARCHIVED',
}

export enum PitchJobStep {
  UPLOAD = 'UPLOAD',
  EXTRACT_TEXT = 'EXTRACT_TEXT',
  CLASSIFY_SECTIONS = 'CLASSIFY_SECTIONS',
  EXTRACT_NEEDS = 'EXTRACT_NEEDS',
  BUILD_PROFILES = 'BUILD_PROFILES',
  COMPUTE_MATCHES = 'COMPUTE_MATCHES',
  GENERATE_OUTREACH = 'GENERATE_OUTREACH',
}

export enum PitchJobStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  RETRYING = 'RETRYING',
}

// Value objects for matching
export interface MatchBreakdown {
  relevance: ComponentScoreBreakdown;
  expertise: ComponentScoreBreakdown;
  strategic: ComponentScoreBreakdown;
  relationship: ComponentScoreBreakdown;
}

export interface ComponentScoreBreakdown {
  score: number;      // 0-100
  weight: number;     // 0-1
  weighted: number;   // score * weight
  breakdown: Record<string, number>;
}

export interface MatchReason {
  type: MatchReasonType;
  text: string;
  evidence: string;
}

export enum MatchReasonType {
  SECTOR_MATCH = 'SECTOR_MATCH',
  SKILL_MATCH = 'SKILL_MATCH',
  EXPERTISE = 'EXPERTISE',
  INVESTOR_FIT = 'INVESTOR_FIT',
  RELATIONSHIP = 'RELATIONSHIP',
  NETWORK = 'NETWORK',
  PREVIOUS_WORK = 'PREVIOUS_WORK',
  GEOGRAPHIC = 'GEOGRAPHIC',
}

// User preferences
export interface UserPNMEPreferencesEntity {
  id: string;
  userId: string;
  relevanceWeight: number;
  expertiseWeight: number;
  strategicWeight: number;
  relationshipWeight: number;
  autoDeletePitchDays: number;
  enableWhatsAppMetadata: boolean;
  defaultLanguage: string;
  minMatchScore: number;
  maxMatchesPerSection: number;
  consentGivenAt: Date | null;
  consentVersion: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// Default matching weights
export const DEFAULT_MATCH_WEIGHTS = {
  relevance: 0.40,
  expertise: 0.30,
  strategic: 0.20,
  relationship: 0.10,
} as const;
