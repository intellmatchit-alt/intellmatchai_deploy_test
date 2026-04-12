/**
 * Collaborative Matching Domain Entities
 * Enables users to request collaboration from other users to find matches
 * in the collaborator's network while preserving privacy.
 *
 * REFACTORED: Collaboration is now integrated into existing features
 * (Projects, Opportunities, Pitch, Deals) instead of separate missions.
 */

// ============================================================================
// Enums
// ============================================================================

/**
 * Source type for collaboration requests (links to existing features)
 */
export enum CollaborationSourceType {
  PROJECT = 'PROJECT',
  OPPORTUNITY = 'OPPORTUNITY',
  PITCH = 'PITCH',
  DEAL = 'DEAL',
}

export enum CollaborationRequestStatus {
  PENDING = 'PENDING',
  ACCEPTED = 'ACCEPTED',
  REJECTED = 'REJECTED',
  CANCELLED = 'CANCELLED',
  COMPLETED = 'COMPLETED',
}

export enum IntroductionStatus {
  PENDING = 'PENDING',
  SENT = 'SENT',
  ACCEPTED = 'ACCEPTED',
  COMPLETED = 'COMPLETED',
  DECLINED = 'DECLINED',
}

/**
 * Team member role within a feature
 */
export enum TeamMemberRole {
  OWNER = 'OWNER',
  COFOUNDER = 'COFOUNDER',
  PARTNER = 'PARTNER',
  ADVISOR = 'ADVISOR',
  MEMBER = 'MEMBER',
  INVESTOR = 'INVESTOR',
}

/**
 * Team member status
 */
export enum TeamMemberStatus {
  INVITED = 'INVITED',
  ACCEPTED = 'ACCEPTED',
  DECLINED = 'DECLINED',
  REMOVED = 'REMOVED',
}

/**
 * Invitation delivery channel
 */
export enum InvitationChannel {
  EMAIL = 'EMAIL',
  WHATSAPP = 'WHATSAPP',
  SMS = 'SMS',
  IN_APP = 'IN_APP',
}

export enum CollaborationSessionStatus {
  PENDING = 'PENDING',
  RUNNING = 'RUNNING',
  DONE = 'DONE',
  FAILED = 'FAILED',
}

// ============================================================================
// Entities
// ============================================================================

export interface CollaborationRequestEntity {
  id: string;
  sourceType: CollaborationSourceType;
  projectId: string | null;
  opportunityId: string | null;
  pitchId: string | null;
  dealId: string | null;
  fromUserId: string;
  // Can be sent to either a User or a Contact (one must be set)
  toUserId: string | null;
  toContactId: string | null;
  message: string | null;
  voiceMessageUrl: string | null;
  status: CollaborationRequestStatus;
  respondedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CollaborationSessionEntity {
  id: string;
  collaborationRequestId: string;
  collaboratorUserId: string;
  contactsSource: string;
  totalContacts: number;
  matchCount: number;
  progress: number;
  status: CollaborationSessionStatus;
  bullJobId: string | null;
  error: string | null;
  startedAt: Date | null;
  lastScanAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CollaborationMatchResultEntity {
  id: string;
  sessionId: string;
  contactId: string;
  score: number;
  reasonsJson: CollaborationMatchReason[];
  isIntroduced: boolean;
  isDismissed: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface IntroductionEntity {
  id: string;
  collaborationRequestId: string;
  collaboratorUserId: string;
  thirdPartyContactRef: string;
  status: IntroductionStatus;
  completedAt: Date | null;
  token: string | null;
  channel: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  contactName: string | null;
  message: string | null;
  sentAt: Date | null;
  respondedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CollaborationLedgerEntity {
  id: string;
  fromUserId: string;
  toUserId: string;
  sourceType: CollaborationSourceType;
  sourceId: string;
  introductionsCount: number;
  lastIntroductionAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CollaborationSettingsEntity {
  id: string;
  userId: string;
  globalCollaborationEnabled: boolean;
  allowedSourceTypesJson: CollaborationSourceType[];
  blockedUserIdsJson: string[];
  allowedUserIdsJson: string[] | null;
  perTypeOverridesJson: PerTypeOverrides | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Invitation sent to third party (matched contact) via WhatsApp/Email
 */
export interface CollaborationInvitationEntity {
  id: string;
  collaborationRequestId: string;
  matchResultId: string | null;
  recipientName: string;
  recipientEmail: string | null;
  recipientPhone: string | null;
  channel: InvitationChannel;
  token: string;
  message: string | null;
  sentAt: Date | null;
  deliveredAt: Date | null;
  openedAt: Date | null;
  respondedAt: Date | null;
  status: TeamMemberStatus;
  declineReason: string | null;
  teamMemberId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Generic team member entity (used across Project, Opportunity, Pitch, Deal)
 */
export interface TeamMemberEntity {
  id: string;
  // The feature ID (projectId, opportunityId, pitchId, or dealId)
  featureId: string;
  featureType: CollaborationSourceType;
  // Member can be a registered user OR external
  userId: string | null;
  externalName: string | null;
  externalEmail: string | null;
  externalPhone: string | null;
  role: TeamMemberRole;
  status: TeamMemberStatus;
  invitationToken: string | null;
  invitedAt: Date;
  joinedAt: Date | null;
  removedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Team member with user details (for display)
 */
export interface TeamMemberWithDetails extends TeamMemberEntity {
  user?: {
    id: string;
    fullName: string;
    email: string;
    avatarUrl: string | null;
    company: string | null;
    jobTitle: string | null;
  } | null;
}

// ============================================================================
// Source Feature Info (returned with collaboration requests)
// ============================================================================

export interface SourceFeatureInfo {
  type: CollaborationSourceType;
  id: string;
  title: string;
  description: string | null;
  criteria: CollaborationCriteria;
  ownerUserId: string;
}

// ============================================================================
// Value Objects
// ============================================================================

export interface CollaborationCriteria {
  sectors?: string[];
  skills?: string[];
  locations?: string[];
  experienceYears?: { min?: number; max?: number };
  keywords?: string[];
  customFields?: Record<string, unknown>;
}

export interface CollaborationMatchReason {
  type: CollaborationMatchReasonType;
  text: string;
  evidence?: string;
  score?: number;
}

export enum CollaborationMatchReasonType {
  SECTOR_MATCH = 'SECTOR_MATCH',
  SKILL_MATCH = 'SKILL_MATCH',
  LOCATION_MATCH = 'LOCATION_MATCH',
  EXPERIENCE_MATCH = 'EXPERIENCE_MATCH',
  KEYWORD_MATCH = 'KEYWORD_MATCH',
  COMPANY_MATCH = 'COMPANY_MATCH',
  ROLE_MATCH = 'ROLE_MATCH',
}

export interface PerTypeOverrides {
  [key: string]: {
    enabled: boolean;
    blockedUserIds?: string[];
    allowedUserIds?: string[];
  };
}

// ============================================================================
// DTOs - Collaboration Request
// ============================================================================

export interface CreateCollaborationRequestInput {
  sourceType: CollaborationSourceType;
  sourceId: string;
  fromUserId: string;
  // Can send to either a user or a contact
  toUserId?: string;
  toContactId?: string;
  message?: string;
  voiceMessageUrl?: string;
}

export interface UpdateCollaborationRequestInput {
  status?: CollaborationRequestStatus;
  respondedAt?: Date;
}

export interface CollaborationRequestWithDetails extends CollaborationRequestEntity {
  sourceFeature: SourceFeatureInfo;
  fromUser: { id: string; fullName: string; avatarUrl: string | null };
  toUser: { id: string; fullName: string; avatarUrl: string | null };
  session?: CollaborationSessionEntity | null;
  completedIntroductionsCount: number;
}

// Introduction status summary
export interface IntroductionsSummary {
  total: number;
  pending: number;
  sent: number;
  accepted: number;
  completed: number;
  declined: number;
}

// Owner view - privacy enforced (no contact data)
export interface CollaborationRequestForOwner {
  id: string;
  sourceType: CollaborationSourceType;
  sourceId: string;
  sourceTitle: string;
  status: CollaborationRequestStatus;
  message: string | null;
  createdAt: Date;
  respondedAt: Date | null;
  toUser: { id: string; fullName: string; avatarUrl: string | null } | null;
  toContact?: { id: string; fullName: string; company: string | null; jobTitle: string | null; avatarUrl: string | null } | null;
  session?: { id: string; status: string; matchCount: number; progress: number } | null;
  completedIntroductionsCount: number;
  introductionsSummary: IntroductionsSummary;
}

// Collaborator view - full access
export interface CollaborationRequestForCollaborator extends CollaborationRequestEntity {
  sourceFeature: SourceFeatureInfo;
  fromUser: { id: string; fullName: string; avatarUrl: string | null };
  session: CollaborationSessionEntity | null;
  introductions: IntroductionEntity[];
  previousCollaborationsCount: number;
}

// ============================================================================
// DTOs - Collaboration Session
// ============================================================================

export interface CreateCollaborationSessionInput {
  collaborationRequestId: string;
  collaboratorUserId: string;
  contactsSource?: string;
}

export interface UpdateCollaborationSessionInput {
  totalContacts?: number;
  matchCount?: number;
  progress?: number;
  status?: CollaborationSessionStatus;
  bullJobId?: string;
  error?: string;
  startedAt?: Date;
  lastScanAt?: Date;
  completedAt?: Date;
}

export interface CollaborationSessionWithResults extends CollaborationSessionEntity {
  matchResults: CollaborationMatchResultWithContact[];
}

// ============================================================================
// DTOs - Match Results
// ============================================================================

export interface CreateCollaborationMatchResultInput {
  sessionId: string;
  contactId: string;
  score: number;
  reasonsJson: CollaborationMatchReason[];
}

export interface UpdateCollaborationMatchResultInput {
  isIntroduced?: boolean;
  isDismissed?: boolean;
}

export interface CollaborationMatchResultWithContact extends CollaborationMatchResultEntity {
  contact: {
    id: string;
    fullName: string;
    company: string | null;
    jobTitle: string | null;
    avatarUrl: string | null;
    email?: string | null;
    phone?: string | null;
  };
}

// ============================================================================
// DTOs - Introduction
// ============================================================================

export interface CreateIntroductionInput {
  collaborationRequestId: string;
  collaboratorUserId: string;
  thirdPartyContactRef: string;
  token?: string;
  channel?: string;
  contactEmail?: string;
  contactPhone?: string;
  contactName?: string;
  message?: string;
  status?: IntroductionStatus;
  sentAt?: Date;
}

export interface UpdateIntroductionInput {
  status?: IntroductionStatus;
  completedAt?: Date;
  respondedAt?: Date;
}

// ============================================================================
// DTOs - Ledger
// ============================================================================

export interface CreateCollaborationLedgerInput {
  fromUserId: string;
  toUserId: string;
  sourceType: CollaborationSourceType;
  sourceId: string;
}

export interface UpdateCollaborationLedgerInput {
  introductionsCount?: number;
  lastIntroductionAt?: Date;
}

export interface CollaborationLedgerSummary {
  userId: string;
  fullName: string;
  avatarUrl: string | null;
  totalCollaborations: number;
  totalIntroductions: number;
  lastCollaborationAt: Date | null;
}

// ============================================================================
// DTOs - Settings
// ============================================================================

export interface CreateCollaborationSettingsInput {
  userId: string;
  globalCollaborationEnabled?: boolean;
  allowedSourceTypesJson?: CollaborationSourceType[];
  blockedUserIdsJson?: string[];
  allowedUserIdsJson?: string[];
  perTypeOverridesJson?: PerTypeOverrides;
}

export interface UpdateCollaborationSettingsInput {
  globalCollaborationEnabled?: boolean;
  allowedSourceTypesJson?: CollaborationSourceType[];
  blockedUserIdsJson?: string[];
  allowedUserIdsJson?: string[];
  perTypeOverridesJson?: PerTypeOverrides;
}

// ============================================================================
// DTOs - Collaboration Invitation
// ============================================================================

export interface CreateCollaborationInvitationInput {
  collaborationRequestId: string;
  matchResultId?: string;
  recipientName: string;
  recipientEmail?: string;
  recipientPhone?: string;
  channel: InvitationChannel;
  message?: string;
}

export interface UpdateCollaborationInvitationInput {
  status?: TeamMemberStatus;
  sentAt?: Date;
  deliveredAt?: Date;
  openedAt?: Date;
  respondedAt?: Date;
  declineReason?: string;
  teamMemberId?: string;
}

export interface CollaborationInvitationWithDetails extends CollaborationInvitationEntity {
  collaborationRequest: {
    id: string;
    sourceType: CollaborationSourceType;
    sourceFeature: SourceFeatureInfo;
    fromUser: { id: string; fullName: string; avatarUrl: string | null };
  };
  matchResult?: CollaborationMatchResultWithContact | null;
}

// ============================================================================
// DTOs - Team Members
// ============================================================================

export interface CreateTeamMemberInput {
  featureType: CollaborationSourceType;
  featureId: string;
  userId?: string;
  externalName?: string;
  externalEmail?: string;
  externalPhone?: string;
  role?: TeamMemberRole;
}

export interface UpdateTeamMemberInput {
  role?: TeamMemberRole;
  status?: TeamMemberStatus;
  joinedAt?: Date;
  removedAt?: Date;
}

export interface TeamMemberSummary {
  total: number;
  byRole: Record<TeamMemberRole, number>;
  byStatus: Record<TeamMemberStatus, number>;
}

// ============================================================================
// Public Invitation View (for third party landing page)
// ============================================================================

export interface PublicInvitationView {
  token: string;
  recipientName: string;
  channel: InvitationChannel;
  status: TeamMemberStatus;
  // Source feature info (limited)
  sourceType: CollaborationSourceType;
  sourceTitle: string;
  sourceDescription: string | null;
  // Who sent the invitation
  inviterName: string;
  inviterCompany: string | null;
  // Owner info
  ownerName: string;
  ownerCompany: string | null;
  // Timestamps
  invitedAt: Date;
  expiresAt?: Date;
}

// ============================================================================
// Public Introduction View (for third party consent page)
// ============================================================================

export interface PublicIntroductionView {
  token: string;
  contactName: string;
  status: IntroductionStatus;
  // Source feature info
  sourceType: CollaborationSourceType;
  sourceTitle: string;
  sourceDescription: string | null;
  // Who is requesting (User A / feature owner)
  ownerName: string;
  ownerCompany: string | null;
  // Who introduced (User B / collaborator)
  collaboratorName: string;
  // Optional message from collaborator
  message: string | null;
  // Timestamps
  sentAt: Date | null;
}

// ============================================================================
// Matching Job Data
// ============================================================================

export interface CollaborationMatchingJobData {
  sessionId: string;
  collaboratorUserId: string;
  sourceType: CollaborationSourceType;
  sourceId: string;
}

// ============================================================================
// Constants
// ============================================================================

export const COLLABORATION_MATCHING_WEIGHTS = {
  sector: 25,
  skills: 25,
  location: 15,
  experience: 15,
} as const;

// Lowered from 30 to 15 to be more inclusive - any partial match qualifies
export const COLLABORATION_MATCH_THRESHOLD = 15;

export const DEFAULT_ALLOWED_SOURCE_TYPES: CollaborationSourceType[] = [
  CollaborationSourceType.PROJECT,
  CollaborationSourceType.OPPORTUNITY,
  CollaborationSourceType.PITCH,
  CollaborationSourceType.DEAL,
];

// Helper function to get source ID from request entity
export function getSourceId(request: CollaborationRequestEntity): string {
  switch (request.sourceType) {
    case CollaborationSourceType.PROJECT:
      return request.projectId!;
    case CollaborationSourceType.OPPORTUNITY:
      return request.opportunityId!;
    case CollaborationSourceType.PITCH:
      return request.pitchId!;
    case CollaborationSourceType.DEAL:
      return request.dealId!;
    default:
      throw new Error(`Unknown source type: ${request.sourceType}`);
  }
}
