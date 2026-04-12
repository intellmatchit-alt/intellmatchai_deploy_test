/**
 * PNME Repository Interface: Pitch
 * Defines data access contract for pitch-related operations
 */

import {
  PitchEntity,
  PitchSectionEntity,
  PitchNeedEntity,
  PitchMatchEntity,
  PitchJobEntity,
  ContactProfileCacheEntity,
  UserPNMEPreferencesEntity,
  PitchStatus,
  PitchJobStep,
  PitchJobStatus,
  PitchMatchStatus,
  PitchSectionType,
} from '../entities/Pitch';

// ============================================================================
// Pitch Repository
// ============================================================================

export interface CreatePitchInput {
  userId: string;
  fileKey: string;
  fileName: string;
  fileType: 'PDF' | 'PPTX';
  fileSize: number;
  language?: string;
  title?: string;
  companyName?: string;
  expiresAt?: Date;
}

export interface UpdatePitchInput {
  status?: PitchStatus;
  title?: string;
  companyName?: string;
  rawText?: string;
  processedAt?: Date;
  lastError?: string;
}

export interface PitchListOptions {
  userId: string;
  status?: PitchStatus;
  page?: number;
  limit?: number;
  includeDeleted?: boolean;
}

export interface IPitchRepository {
  // CRUD
  create(input: CreatePitchInput): Promise<PitchEntity>;
  findById(id: string): Promise<PitchEntity | null>;
  findByIdWithDetails(id: string): Promise<PitchWithDetails | null>;
  findByUserId(options: PitchListOptions): Promise<{ pitches: PitchEntity[]; total: number }>;
  update(id: string, input: UpdatePitchInput): Promise<PitchEntity>;
  softDelete(id: string): Promise<void>;
  hardDelete(id: string): Promise<void>;

  // Expiration
  findExpiredPitches(beforeDate: Date): Promise<PitchEntity[]>;
  deleteExpiredPitches(beforeDate: Date): Promise<number>;
}

export interface PitchWithDetails extends PitchEntity {
  sections: PitchSectionEntity[];
  needs: PitchNeedEntity[];
  jobs: PitchJobEntity[];
}

// ============================================================================
// Pitch Section Repository
// ============================================================================

export interface CreatePitchSectionInput {
  pitchId: string;
  type: PitchSectionType;
  order: number;
  title: string;
  content: string;
  rawContent?: string;
  confidence?: number;
  embedding?: number[];
  embeddingModel?: string;
  inferredSectors?: string[];
  inferredSkills?: string[];
  keywords?: string[];
}

export interface IPitchSectionRepository {
  create(input: CreatePitchSectionInput): Promise<PitchSectionEntity>;
  createMany(inputs: CreatePitchSectionInput[]): Promise<PitchSectionEntity[]>;
  findByPitchId(pitchId: string): Promise<PitchSectionEntity[]>;
  findById(id: string): Promise<PitchSectionEntity | null>;
  updateEmbedding(id: string, embedding: number[], model: string): Promise<void>;
  deleteByPitchId(pitchId: string): Promise<void>;
}

// ============================================================================
// Pitch Need Repository
// ============================================================================

export interface CreatePitchNeedInput {
  pitchId: string;
  key: string;
  label: string;
  description?: string;
  confidence?: number;
  sourceSectionType?: PitchSectionType;
  amount?: string;
  timeline?: string;
  priority?: number;
}

export interface IPitchNeedRepository {
  create(input: CreatePitchNeedInput): Promise<PitchNeedEntity>;
  createMany(inputs: CreatePitchNeedInput[]): Promise<PitchNeedEntity[]>;
  findByPitchId(pitchId: string): Promise<PitchNeedEntity[]>;
  deleteByPitchId(pitchId: string): Promise<void>;
}

// ============================================================================
// Pitch Match Repository
// ============================================================================

export interface CreatePitchMatchInput {
  pitchSectionId: string;
  contactId: string;
  score: number;
  relevanceScore: number;
  expertiseScore: number;
  strategicScore: number;
  relationshipScore: number;
  breakdownJson: Record<string, unknown>;
  reasonsJson: Record<string, unknown>[];
  angleCategory?: string;
  outreachDraft?: string;
}

export interface UpdatePitchMatchInput {
  status?: PitchMatchStatus;
  outreachDraft?: string;
  outreachEdited?: string;
  savedAt?: Date;
  ignoredAt?: Date;
  contactedAt?: Date;
}

export interface PitchMatchListOptions {
  pitchSectionId?: string;
  contactId?: string;
  minScore?: number;
  status?: PitchMatchStatus;
  limit?: number;
}

export interface IPitchMatchRepository {
  create(input: CreatePitchMatchInput): Promise<PitchMatchEntity>;
  createMany(inputs: CreatePitchMatchInput[]): Promise<PitchMatchEntity[]>;
  findById(id: string): Promise<PitchMatchEntity | null>;
  findByPitchSectionId(sectionId: string, options?: PitchMatchListOptions): Promise<PitchMatchEntity[]>;
  findByContactId(contactId: string): Promise<PitchMatchEntity[]>;
  update(id: string, input: UpdatePitchMatchInput): Promise<PitchMatchEntity>;
  deleteBySectionId(sectionId: string): Promise<void>;
  deleteByPitchId(pitchId: string): Promise<void>;
}

// ============================================================================
// Pitch Job Repository
// ============================================================================

export interface CreatePitchJobInput {
  pitchId: string;
  step: PitchJobStep;
  maxAttempts?: number;
}

export interface UpdatePitchJobInput {
  status?: PitchJobStatus;
  progress?: number;
  error?: string;
  attempts?: number;
  startedAt?: Date;
  completedAt?: Date;
  bullJobId?: string;
}

export interface IPitchJobRepository {
  create(input: CreatePitchJobInput): Promise<PitchJobEntity>;
  createMany(inputs: CreatePitchJobInput[]): Promise<PitchJobEntity[]>;
  findByPitchId(pitchId: string): Promise<PitchJobEntity[]>;
  findByPitchIdAndStep(pitchId: string, step: PitchJobStep): Promise<PitchJobEntity | null>;
  update(id: string, input: UpdatePitchJobInput): Promise<PitchJobEntity>;
  updateByPitchIdAndStep(pitchId: string, step: PitchJobStep, input: UpdatePitchJobInput): Promise<PitchJobEntity>;
  incrementAttempts(id: string): Promise<PitchJobEntity>;
}

// ============================================================================
// Contact Profile Cache Repository
// ============================================================================

export interface CreateContactProfileCacheInput {
  contactId: string;
  userId: string;
  profileSummary: string;
  sectors: string[];
  skills: string[];
  interests: string[];
  keywords?: string[];
  investorType?: string;
  investmentStage?: string;
  checkSize?: string;
  geography?: string;
  previousInvestments?: string[];
  expertise?: string[];
  embedding?: number[];
  embeddingModel?: string;
  relationshipStrength?: number;
  lastInteractionDays?: number;
  interactionCount?: number;
}

export interface UpdateContactProfileCacheInput {
  profileSummary?: string;
  sectors?: string[];
  skills?: string[];
  interests?: string[];
  keywords?: string[];
  investorType?: string;
  investmentStage?: string;
  checkSize?: string;
  geography?: string;
  previousInvestments?: string[];
  expertise?: string[];
  embedding?: number[];
  embeddingModel?: string;
  relationshipStrength?: number;
  lastInteractionDays?: number;
  interactionCount?: number;
  isStale?: boolean;
}

export interface IContactProfileCacheRepository {
  upsert(input: CreateContactProfileCacheInput): Promise<ContactProfileCacheEntity>;
  findByContactId(contactId: string): Promise<ContactProfileCacheEntity | null>;
  findByUserId(userId: string): Promise<ContactProfileCacheEntity[]>;
  findStaleByUserId(userId: string): Promise<ContactProfileCacheEntity[]>;
  update(contactId: string, input: UpdateContactProfileCacheInput): Promise<ContactProfileCacheEntity>;
  markStale(contactId: string): Promise<void>;
  markAllStaleByUserId(userId: string): Promise<void>;
  deleteByContactId(contactId: string): Promise<void>;
}

// ============================================================================
// User PNME Preferences Repository
// ============================================================================

export interface CreateUserPNMEPreferencesInput {
  userId: string;
  relevanceWeight?: number;
  expertiseWeight?: number;
  strategicWeight?: number;
  relationshipWeight?: number;
  autoDeletePitchDays?: number;
  enableWhatsAppMetadata?: boolean;
  defaultLanguage?: string;
  minMatchScore?: number;
  maxMatchesPerSection?: number;
}

export interface UpdateUserPNMEPreferencesInput {
  relevanceWeight?: number;
  expertiseWeight?: number;
  strategicWeight?: number;
  relationshipWeight?: number;
  autoDeletePitchDays?: number;
  enableWhatsAppMetadata?: boolean;
  defaultLanguage?: string;
  minMatchScore?: number;
  maxMatchesPerSection?: number;
  consentGivenAt?: Date;
  consentVersion?: string;
}

export interface IUserPNMEPreferencesRepository {
  findByUserId(userId: string): Promise<UserPNMEPreferencesEntity | null>;
  upsert(input: CreateUserPNMEPreferencesInput): Promise<UserPNMEPreferencesEntity>;
  update(userId: string, input: UpdateUserPNMEPreferencesInput): Promise<UserPNMEPreferencesEntity>;
  recordConsent(userId: string, version: string): Promise<void>;
}
