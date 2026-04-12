/**
 * Collaboration Repository Interfaces
 * Defines data access contracts for collaborative matching operations
 *
 * REFACTORED: Removed IMatchMissionRepository - collaboration is now
 * integrated into existing features (Projects, Opportunities, Pitch, Deals)
 */

import {
  CollaborationSourceType,
  CollaborationRequestEntity,
  CollaborationSessionEntity,
  CollaborationMatchResultEntity,
  IntroductionEntity,
  CollaborationLedgerEntity,
  CollaborationSettingsEntity,
  CollaborationInvitationEntity,
  CollaborationRequestStatus,
  CollaborationSessionStatus,
  IntroductionStatus,
  TeamMemberStatus,
  InvitationChannel,
  CreateCollaborationRequestInput,
  UpdateCollaborationRequestInput,
  CreateCollaborationSessionInput,
  UpdateCollaborationSessionInput,
  CreateCollaborationMatchResultInput,
  UpdateCollaborationMatchResultInput,
  CreateIntroductionInput,
  UpdateIntroductionInput,
  CreateCollaborationLedgerInput,
  UpdateCollaborationLedgerInput,
  CreateCollaborationSettingsInput,
  UpdateCollaborationSettingsInput,
  CreateCollaborationInvitationInput,
  UpdateCollaborationInvitationInput,
  CollaborationRequestWithDetails,
  CollaborationRequestForOwner,
  CollaborationRequestForCollaborator,
  CollaborationMatchResultWithContact,
  CollaborationLedgerSummary,
  CollaborationInvitationWithDetails,
} from '../entities/Collaboration';

// ============================================================================
// Collaboration Request Repository
// ============================================================================

export interface CollaborationRequestListOptions {
  userId: string;
  role: 'sender' | 'receiver';
  status?: CollaborationRequestStatus;
  sourceType?: CollaborationSourceType;
  sourceId?: string;
  page?: number;
  limit?: number;
}

export interface ICollaborationRequestRepository {
  // CRUD
  create(input: CreateCollaborationRequestInput): Promise<CollaborationRequestEntity>;
  findById(id: string): Promise<CollaborationRequestEntity | null>;
  findByIdWithDetails(id: string): Promise<CollaborationRequestWithDetails | null>;
  update(id: string, input: UpdateCollaborationRequestInput): Promise<CollaborationRequestEntity>;

  // List queries
  findSentByUserId(options: CollaborationRequestListOptions): Promise<{ requests: CollaborationRequestForOwner[]; total: number }>;
  findReceivedByUserId(options: CollaborationRequestListOptions): Promise<{ requests: CollaborationRequestForCollaborator[]; total: number }>;

  // Specific queries - by source feature
  findBySourceAndToUserId(
    sourceType: CollaborationSourceType,
    sourceId: string,
    toUserId: string
  ): Promise<CollaborationRequestEntity | null>;
  findBySourceAndToContactId(
    sourceType: CollaborationSourceType,
    sourceId: string,
    toContactId: string
  ): Promise<CollaborationRequestEntity | null>;
  findBySourceId(
    sourceType: CollaborationSourceType,
    sourceId: string
  ): Promise<CollaborationRequestEntity[]>;
  findPendingByToUserId(toUserId: string): Promise<CollaborationRequestForCollaborator[]>;
  findPendingByToContactId(toContactId: string): Promise<CollaborationRequestForCollaborator[]>;

  // Counts
  countBySourceId(sourceType: CollaborationSourceType, sourceId: string): Promise<number>;
  countPendingByToUserId(toUserId: string): Promise<number>;
  countCompletedIntroductionsByRequestId(requestId: string): Promise<number>;
}

// ============================================================================
// Collaboration Session Repository
// ============================================================================

export interface ICollaborationSessionRepository {
  // CRUD
  create(input: CreateCollaborationSessionInput): Promise<CollaborationSessionEntity>;
  findById(id: string): Promise<CollaborationSessionEntity | null>;
  findByCollaborationRequestId(requestId: string): Promise<CollaborationSessionEntity | null>;
  update(id: string, input: UpdateCollaborationSessionInput): Promise<CollaborationSessionEntity>;

  // Queries
  findByCollaboratorUserId(userId: string, status?: CollaborationSessionStatus): Promise<CollaborationSessionEntity[]>;
  findPendingOrRunning(): Promise<CollaborationSessionEntity[]>;
}

// ============================================================================
// Collaboration Match Result Repository
// ============================================================================

export interface CollaborationMatchResultListOptions {
  sessionId: string;
  minScore?: number;
  isIntroduced?: boolean;
  isDismissed?: boolean;
  limit?: number;
  offset?: number;
}

export interface ICollaborationMatchResultRepository {
  // CRUD
  create(input: CreateCollaborationMatchResultInput): Promise<CollaborationMatchResultEntity>;
  createMany(inputs: CreateCollaborationMatchResultInput[]): Promise<CollaborationMatchResultEntity[]>;
  findById(id: string): Promise<CollaborationMatchResultEntity | null>;
  findByIdWithContact(id: string): Promise<CollaborationMatchResultWithContact | null>;
  findBySessionId(options: CollaborationMatchResultListOptions): Promise<CollaborationMatchResultWithContact[]>;
  update(id: string, input: UpdateCollaborationMatchResultInput): Promise<CollaborationMatchResultEntity>;

  // Batch operations
  deleteBySessionId(sessionId: string): Promise<void>;
  deleteNonIntroducedBySessionId(sessionId: string): Promise<number>;

  // Stats
  countBySessionId(sessionId: string): Promise<number>;
  countIntroducedBySessionId(sessionId: string): Promise<number>;
}

// ============================================================================
// Introduction Repository
// ============================================================================

export interface IntroductionListOptions {
  collaborationRequestId?: string;
  collaboratorUserId?: string;
  status?: IntroductionStatus;
  page?: number;
  limit?: number;
}

export interface IIntroductionRepository {
  // CRUD
  create(input: CreateIntroductionInput): Promise<IntroductionEntity>;
  findById(id: string): Promise<IntroductionEntity | null>;
  findByToken(token: string): Promise<IntroductionEntity | null>;
  findByCollaborationRequestId(requestId: string): Promise<IntroductionEntity[]>;
  update(id: string, input: UpdateIntroductionInput): Promise<IntroductionEntity>;

  // Queries
  findByCollaboratorUserId(options: IntroductionListOptions): Promise<{ introductions: IntroductionEntity[]; total: number }>;
  findByThirdPartyContactRef(contactRef: string): Promise<IntroductionEntity[]>;

  // Counts
  countByCollaborationRequestId(requestId: string): Promise<number>;
  countCompletedByCollaborationRequestId(requestId: string): Promise<number>;
}

// ============================================================================
// Collaboration Ledger Repository
// ============================================================================

export interface ICollaborationLedgerRepository {
  // CRUD
  create(input: CreateCollaborationLedgerInput): Promise<CollaborationLedgerEntity>;
  findById(id: string): Promise<CollaborationLedgerEntity | null>;
  findBySourceKey(
    fromUserId: string,
    toUserId: string,
    sourceType: CollaborationSourceType,
    sourceId: string
  ): Promise<CollaborationLedgerEntity | null>;
  update(id: string, input: UpdateCollaborationLedgerInput): Promise<CollaborationLedgerEntity>;
  upsert(input: CreateCollaborationLedgerInput): Promise<CollaborationLedgerEntity>;

  // Increment introduction count
  incrementIntroductionsCount(
    fromUserId: string,
    toUserId: string,
    sourceType: CollaborationSourceType,
    sourceId: string
  ): Promise<CollaborationLedgerEntity>;

  // Summary queries
  getCollaboratorSummaries(userId: string): Promise<CollaborationLedgerSummary[]>;
  getHistoryWithUser(userId: string, otherUserId: string): Promise<CollaborationLedgerEntity[]>;

  // Stats
  countTotalCollaborations(userId: string): Promise<number>;
  countTotalIntroductions(userId: string): Promise<number>;
}

// ============================================================================
// Collaboration Settings Repository
// ============================================================================

export interface ICollaborationSettingsRepository {
  // CRUD
  create(input: CreateCollaborationSettingsInput): Promise<CollaborationSettingsEntity>;
  findByUserId(userId: string): Promise<CollaborationSettingsEntity | null>;
  update(userId: string, input: UpdateCollaborationSettingsInput): Promise<CollaborationSettingsEntity>;
  upsert(input: CreateCollaborationSettingsInput): Promise<CollaborationSettingsEntity>;

  // Validation helpers
  canReceiveRequest(
    toUserId: string,
    fromUserId: string,
    sourceType: CollaborationSourceType
  ): Promise<{ allowed: boolean; reason?: string }>;
}

// ============================================================================
// Collaboration Invitation Repository
// ============================================================================

export interface CollaborationInvitationListOptions {
  collaborationRequestId?: string;
  status?: TeamMemberStatus;
  channel?: InvitationChannel;
  page?: number;
  limit?: number;
}

export interface ICollaborationInvitationRepository {
  // CRUD
  create(input: CreateCollaborationInvitationInput): Promise<CollaborationInvitationEntity>;
  findById(id: string): Promise<CollaborationInvitationEntity | null>;
  findByToken(token: string): Promise<CollaborationInvitationEntity | null>;
  findByTokenWithDetails(token: string): Promise<CollaborationInvitationWithDetails | null>;
  update(id: string, input: UpdateCollaborationInvitationInput): Promise<CollaborationInvitationEntity>;

  // Queries
  findByCollaborationRequestId(requestId: string): Promise<CollaborationInvitationEntity[]>;
  findByMatchResultId(matchResultId: string): Promise<CollaborationInvitationEntity | null>;
  findByRecipientEmail(email: string): Promise<CollaborationInvitationEntity[]>;
  findByRecipientPhone(phone: string): Promise<CollaborationInvitationEntity[]>;

  // List
  list(options: CollaborationInvitationListOptions): Promise<{
    invitations: CollaborationInvitationEntity[];
    total: number;
  }>;

  // Stats
  countByCollaborationRequestId(requestId: string): Promise<number>;
  countByStatus(collaborationRequestId: string, status: TeamMemberStatus): Promise<number>;
}
