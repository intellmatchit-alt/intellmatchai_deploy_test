/**
 * Collaboration API
 *
 * API client functions for Collaborative Matching feature.
 * Updated for feature-based collaboration (Projects, Opportunities, Pitch, Deals).
 *
 * @module lib/api/collaboration
 */

import { api, getAuthHeaders } from './client';

// ============================================================================
// Types
// ============================================================================

/**
 * Collaboration source type options
 */
export type CollaborationSourceType = 'PROJECT' | 'OPPORTUNITY' | 'PITCH' | 'DEAL';

/**
 * Collaboration request status options
 */
export type CollaborationRequestStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'CANCELLED' | 'COMPLETED';

/**
 * Collaboration session status options
 */
export type CollaborationSessionStatus = 'PENDING' | 'RUNNING' | 'DONE' | 'FAILED';

/**
 * Introduction status options
 */
export type IntroductionStatus = 'PENDING' | 'SENT' | 'ACCEPTED' | 'COMPLETED' | 'DECLINED';

/**
 * Collaboration match reason type options
 */
export type CollaborationMatchReasonType = 'SECTOR_MATCH' | 'SKILL_MATCH' | 'LOCATION_MATCH' | 'KEYWORD_MATCH';

/**
 * Source type form options
 */
export const SOURCE_TYPE_OPTIONS = [
  { id: 'PROJECT' as CollaborationSourceType, label: 'Project', description: 'Collaboration on a project' },
  { id: 'OPPORTUNITY' as CollaborationSourceType, label: 'Opportunity', description: 'Business opportunity collaboration' },
  { id: 'PITCH' as CollaborationSourceType, label: 'Pitch', description: 'Pitch deck collaboration' },
  { id: 'DEAL' as CollaborationSourceType, label: 'Deal', description: 'Deal collaboration' },
] as const;

/**
 * Collaboration match threshold
 */
export const COLLABORATION_MATCH_THRESHOLD = 30;

// ============================================================================
// Interfaces
// ============================================================================

/**
 * Collaboration criteria interface
 */
export interface CollaborationCriteria {
  sectors?: string[];
  skills?: string[];
  locations?: string[];
  keywords?: string[];
}

/**
 * Source feature info
 */
export interface SourceFeatureInfo {
  id: string;
  type: CollaborationSourceType;
  title: string;
  description: string | null;
  criteria: CollaborationCriteria | null;
}

/**
 * User summary for collaboration
 */
export interface CollaborationUserSummary {
  id: string;
  fullName: string;
  avatarUrl: string | null;
  company?: string | null;
  jobTitle?: string | null;
}

/**
 * Collaboration request interface
 */
export interface IntroductionsSummary {
  total: number;
  pending: number;
  sent: number;
  accepted: number;
  completed: number;
  declined: number;
}

export interface CollaborationRequest {
  id: string;
  sourceType: CollaborationSourceType;
  sourceId: string;
  sourceTitle?: string | null;
  fromUserId: string;
  toUserId: string;
  toContactId?: string | null;
  message: string | null;
  voiceMessageUrl: string | null;
  status: CollaborationRequestStatus;
  respondedAt: string | null;
  createdAt: string;
  updatedAt: string;
  // Populated fields
  sourceFeature?: SourceFeatureInfo;
  fromUser?: CollaborationUserSummary;
  toUser?: CollaborationUserSummary | null;
  toContact?: CollaborationUserSummary | null;
  session?: CollaborationSession | { id: string; status: string; matchCount: number; progress: number } | null;
  completedIntroductionsCount?: number;
  introductionsSummary?: IntroductionsSummary;
}

/**
 * Collaboration session interface
 */
export interface CollaborationSession {
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
  startedAt: string | null;
  lastScanAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Match reason interface
 */
export interface CollaborationMatchReason {
  type: CollaborationMatchReasonType;
  text: string;
  score: number;
}

/**
 * Contact summary for match results
 */
export interface MatchContactSummary {
  id: string;
  fullName: string;
  company: string | null;
  jobTitle: string | null;
  avatarUrl: string | null;
  location: string | null;
  email?: string | null;
  phone?: string | null;
}

/**
 * Collaboration match result interface
 */
export interface CollaborationMatchResult {
  id: string;
  sessionId: string;
  contactId: string;
  score: number;
  reasonsJson: CollaborationMatchReason[];
  isIntroduced: boolean;
  isDismissed: boolean;
  createdAt: string;
  updatedAt: string;
  contact?: MatchContactSummary;
}

/**
 * Introduction interface
 */
export interface Introduction {
  id: string;
  collaborationRequestId?: string;
  collaboratorUserId?: string;
  thirdPartyContactRef?: string;
  status: IntroductionStatus;
  completedAt: string | null;
  createdAt: string;
  updatedAt?: string;
  token?: string | null;
  channel?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  contactName?: string | null;
  message?: string | null;
  sentAt?: string | null;
  respondedAt?: string | null;
  emailSent?: boolean;
  // For feature owner view
  contact?: {
    fullName: string;
    company: string | null;
    jobTitle: string | null;
  };
  collaborator?: {
    id: string;
    fullName: string;
    avatarUrl: string | null;
  };
  // Track if already added as contact
  addedAsContact?: boolean;
}

/**
 * Collaboration ledger entry interface
 */
export interface CollaborationLedgerEntry {
  id: string;
  sourceType: CollaborationSourceType;
  sourceId: string;
  introductionsCount: number;
  lastIntroductionAt: string | null;
  createdAt: string;
}

/**
 * Collaboration ledger summary
 */
export interface CollaborationLedgerSummary {
  userId: string;
  fullName: string;
  avatarUrl: string | null;
  totalCollaborations: number;
  totalIntroductions: number;
  lastCollaborationAt: Date | null;
}

/**
 * Collaboration settings interface
 */
export interface CollaborationSettings {
  globalCollaborationEnabled: boolean;
  allowedSourceTypes: CollaborationSourceType[];
  blockedUserIds: string[];
  allowedUserIds: string[] | null;
  perTypeOverrides: Record<CollaborationSourceType, { enabled: boolean; blockedUserIds?: string[]; allowedUserIds?: string[] }> | null;
}

/**
 * Update collaboration settings input
 */
export interface UpdateCollaborationSettingsInput {
  globalCollaborationEnabled?: boolean;
  allowedSourceTypes?: CollaborationSourceType[];
  blockedUserIds?: string[];
  allowedUserIds?: string[] | null;
  perTypeOverrides?: Record<CollaborationSourceType, { enabled: boolean; blockedUserIds?: string[]; allowedUserIds?: string[] }> | null;
}

/**
 * Send collaboration request input
 * NOTE: Either toUserId or toContactId must be provided (not both)
 */
export interface SendCollaborationRequestInput {
  sourceType: CollaborationSourceType;
  sourceId: string;
  toUserId?: string;
  toContactId?: string;
  message?: string;
  voiceMessageUrl?: string;
}

export interface BulkSendCollaborationRequestInput {
  sourceType: CollaborationSourceType;
  sourceId: string;
  contactIds: string[];
  message?: string;
  voiceMessageUrl?: string;
}

export interface BulkSendResult {
  results: Array<{ contactId: string; success: boolean; requestId?: string; error?: string; emailSent?: boolean }>;
  summary: { total: number; sent: number; failed: number; emailsSent?: number };
}

// ============================================================================
// V2: Invitation Types
// ============================================================================

/**
 * Invitation channel options
 */
export type InvitationChannel = 'EMAIL' | 'WHATSAPP' | 'SMS' | 'IN_APP';

/**
 * Team member status options
 */
export type TeamMemberStatus = 'INVITED' | 'ACCEPTED' | 'DECLINED' | 'REMOVED';

/**
 * Team member role options
 */
export type TeamMemberRole = 'OWNER' | 'COFOUNDER' | 'PARTNER' | 'ADVISOR' | 'MEMBER' | 'INVESTOR';

/**
 * Send invitation input
 */
export interface SendInvitationInput {
  matchResultId?: string;
  recipientName: string;
  recipientEmail?: string;
  recipientPhone?: string;
  channel: InvitationChannel;
  message?: string;
}

/**
 * Send invitation response
 */
export interface SendInvitationResponse {
  success: boolean;
  invitationId?: string;
  invitationUrl?: string;
  error?: string;
}

/**
 * Public invitation view (for third party landing page)
 */
export interface PublicInvitationView {
  token: string;
  recipientName: string;
  channel: InvitationChannel;
  status: TeamMemberStatus;
  sourceType: CollaborationSourceType;
  sourceTitle: string;
  sourceDescription: string | null;
  inviterName: string;
  inviterCompany: string | null;
  ownerName: string;
  ownerCompany: string | null;
  invitedAt: string;
  expiresAt?: string;
}

/**
 * Accept invitation response
 */
export interface AcceptInvitationResponse {
  success: boolean;
  teamMemberId?: string;
  redirectUrl?: string;
  error?: string;
}

/**
 * Team member interface
 */
export interface TeamMember {
  id: string;
  featureId: string;
  featureType: CollaborationSourceType;
  userId: string | null;
  externalName: string | null;
  externalEmail: string | null;
  externalPhone: string | null;
  role: TeamMemberRole;
  status: TeamMemberStatus;
  invitedAt: string;
  joinedAt: string | null;
  user?: {
    id: string;
    fullName: string;
    email: string;
    avatarUrl: string | null;
    company: string | null;
    jobTitle: string | null;
  } | null;
}

/**
 * List team members response
 */
export interface ListTeamMembersResponse {
  members: TeamMember[];
  total: number;
  summary: {
    invited: number;
    accepted: number;
    declined: number;
    removed: number;
  };
}

/**
 * List requests query
 */
export interface ListRequestsQuery {
  status?: CollaborationRequestStatus;
  sourceType?: CollaborationSourceType;
  sourceId?: string;
  page?: number;
  limit?: number;
}

/**
 * List requests response
 */
export interface ListRequestsResponse {
  requests: CollaborationRequest[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * Get match results query
 */
export interface GetMatchResultsQuery {
  minScore?: number;
  isIntroduced?: boolean;
  isDismissed?: boolean;
  limit?: number;
  offset?: number;
}

/**
 * Get match results response
 */
export interface GetMatchResultsResponse {
  results: CollaborationMatchResult[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

/**
 * Run matching response
 */
export interface RunMatchingResponse {
  session: CollaborationSession;
  jobId: string | null;
}

/**
 * Ledger response
 */
export interface LedgerResponse {
  totalCollaborators: number;
  totalIntroductions: number;
  collaborators: CollaborationLedgerSummary[];
}

// ============================================================================
// Collaboration Request API Functions
// ============================================================================

/**
 * Send collaboration request
 */
export async function sendCollaborationRequest(input: SendCollaborationRequestInput): Promise<CollaborationRequest> {
  return api.post('/collaboration-requests', input);
}

/**
 * Send bulk collaboration requests to multiple contacts
 */
export async function bulkSendCollaborationRequests(input: BulkSendCollaborationRequestInput): Promise<BulkSendResult> {
  return api.post('/collaboration-requests/bulk', input);
}

/**
 * Upload a voice message for collaboration and get back a URL
 */
export async function uploadCollaborationVoice(blob: Blob): Promise<string> {
  const formData = new FormData();
  formData.append('voice', blob, 'voice-message.webm');

  const response = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL}/collaboration-requests/upload-voice`,
    {
      method: 'POST',
      headers: {
        ...getAuthHeaders(),
      },
      body: formData,
    }
  );

  if (!response.ok) {
    throw new Error('Failed to upload voice message');
  }

  const data = await response.json();
  return data.data.url;
}

/**
 * List sent requests (owner view)
 */
export async function listSentRequests(query?: ListRequestsQuery): Promise<ListRequestsResponse> {
  const params = new URLSearchParams();
  if (query?.status) params.set('status', query.status);
  if (query?.sourceType) params.set('sourceType', query.sourceType);
  if (query?.sourceId) params.set('sourceId', query.sourceId);
  if (query?.page) params.set('page', String(query.page));
  if (query?.limit) params.set('limit', String(query.limit));

  const queryStr = params.toString();
  return api.get(`/collaboration-requests/sent${queryStr ? `?${queryStr}` : ''}`);
}

/**
 * List received requests (collaborator inbox)
 */
export async function listReceivedRequests(query?: ListRequestsQuery): Promise<ListRequestsResponse> {
  const params = new URLSearchParams();
  if (query?.status) params.set('status', query.status);
  if (query?.sourceType) params.set('sourceType', query.sourceType);
  if (query?.page) params.set('page', String(query.page));
  if (query?.limit) params.set('limit', String(query.limit));

  const queryStr = params.toString();
  return api.get(`/collaboration-requests/inbox${queryStr ? `?${queryStr}` : ''}`);
}

/**
 * Get request by ID
 */
export async function getCollaborationRequest(requestId: string): Promise<CollaborationRequest> {
  return api.get(`/collaboration-requests/${requestId}`);
}

/**
 * Cancel request (owner only)
 */
export async function cancelCollaborationRequest(requestId: string): Promise<CollaborationRequest> {
  return api.post(`/collaboration-requests/${requestId}/cancel`);
}

/**
 * Accept request (collaborator only)
 */
export async function acceptCollaborationRequest(requestId: string): Promise<CollaborationRequest> {
  return api.post(`/collaboration-requests/${requestId}/accept`);
}

/**
 * Reject request (collaborator only)
 */
export async function rejectCollaborationRequest(requestId: string): Promise<CollaborationRequest> {
  return api.post(`/collaboration-requests/${requestId}/reject`);
}

// ============================================================================
// Collaboration Session API Functions
// ============================================================================

/**
 * Run matching for a request
 */
export async function runMatching(requestId: string): Promise<RunMatchingResponse> {
  return api.post(`/collaboration-requests/${requestId}/run-matching`);
}

/**
 * Get session status
 */
export async function getSessionStatus(sessionId: string): Promise<CollaborationSession> {
  return api.get(`/collaboration-sessions/${sessionId}`);
}

/**
 * Get match results for a session
 */
export async function getMatchResults(
  sessionId: string,
  query?: GetMatchResultsQuery
): Promise<GetMatchResultsResponse> {
  const params = new URLSearchParams();
  if (query?.minScore !== undefined) params.set('minScore', String(query.minScore));
  if (query?.isIntroduced !== undefined) params.set('isIntroduced', String(query.isIntroduced));
  if (query?.isDismissed !== undefined) params.set('isDismissed', String(query.isDismissed));
  if (query?.limit) params.set('limit', String(query.limit));
  if (query?.offset) params.set('offset', String(query.offset));

  const queryStr = params.toString();
  return api.get(`/collaboration-sessions/${sessionId}/results${queryStr ? `?${queryStr}` : ''}`);
}

// ============================================================================
// Introduction API Functions
// ============================================================================

/**
 * Create introduction (with consent flow)
 */
export async function createIntroduction(
  requestId: string,
  matchResultId: string,
  options?: {
    channel?: 'EMAIL' | 'WHATSAPP';
    contactEmail?: string;
    contactPhone?: string;
    message?: string;
  }
): Promise<Introduction> {
  return api.post(`/collaboration-requests/${requestId}/introductions`, {
    matchResultId,
    ...options,
  });
}

/**
 * Get introductions for a request
 */
export async function getIntroductions(requestId: string): Promise<{ introductions: Introduction[] }> {
  return api.get(`/collaboration-requests/${requestId}/introductions`);
}

/**
 * Complete introduction
 */
export async function completeIntroduction(introductionId: string): Promise<Introduction> {
  return api.post(`/introductions/${introductionId}/complete`);
}

/**
 * Decline introduction
 */
export async function declineIntroduction(introductionId: string): Promise<Introduction> {
  return api.post(`/introductions/${introductionId}/decline`);
}

// ============================================================================
// Public Introduction Consent API Functions
// ============================================================================

/**
 * Public introduction view (for consent page)
 */
export interface PublicIntroductionView {
  token: string;
  contactName: string;
  status: IntroductionStatus;
  sourceType: CollaborationSourceType;
  sourceTitle: string;
  sourceDescription: string | null;
  ownerName: string;
  ownerCompany: string | null;
  collaboratorName: string;
  message: string | null;
  sentAt: string | null;
}

/**
 * Get introduction by token (public - no auth)
 */
export async function getIntroductionByToken(token: string): Promise<PublicIntroductionView> {
  return api.get(`/introductions/by-token/${token}`);
}

/**
 * Accept introduction by token (public - no auth)
 */
export async function acceptIntroductionByToken(token: string): Promise<{ success: boolean }> {
  return api.post(`/introductions/by-token/${token}/accept`);
}

/**
 * Decline introduction by token (public - no auth)
 */
export async function declineIntroductionByToken(token: string): Promise<{ success: boolean }> {
  return api.post(`/introductions/by-token/${token}/decline`);
}

/**
 * Add contact from introduction
 * Creates a contact in the feature owner's contact list from an introduced contact
 */
export async function addContactFromIntroduction(introductionId: string): Promise<{
  contact: {
    id: string;
    fullName: string;
    company: string | null;
    jobTitle: string | null;
  };
  message: string;
}> {
  return api.post(`/introductions/${introductionId}/add-contact`);
}

// ============================================================================
// Collaboration Settings API Functions
// ============================================================================

/**
 * Get collaboration settings
 */
export async function getCollaborationSettings(): Promise<CollaborationSettings> {
  return api.get('/collaboration-settings');
}

/**
 * Update collaboration settings
 */
export async function updateCollaborationSettings(
  input: UpdateCollaborationSettingsInput
): Promise<CollaborationSettings> {
  return api.put('/collaboration-settings', input);
}

// ============================================================================
// Collaboration Ledger API Functions
// ============================================================================

/**
 * Get collaboration ledger
 */
export async function getCollaborationLedger(): Promise<LedgerResponse> {
  return api.get('/collaboration-ledger');
}

/**
 * Get ledger with specific user
 */
export async function getLedgerWithUser(userId: string): Promise<{
  userId: string;
  entries: CollaborationLedgerEntry[];
}> {
  return api.get(`/collaboration-ledger/with/${userId}`);
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get source type label
 */
export function getSourceTypeLabel(type: CollaborationSourceType): string {
  const labels: Record<CollaborationSourceType, string> = {
    PROJECT: 'Project',
    OPPORTUNITY: 'Opportunity',
    PITCH: 'Pitch',
    DEAL: 'Deal',
  };
  return labels[type] || type;
}

/**
 * Get source type icon name
 */
export function getSourceTypeIcon(type: CollaborationSourceType): string {
  const icons: Record<CollaborationSourceType, string> = {
    PROJECT: 'Lightbulb',
    OPPORTUNITY: 'Briefcase',
    PITCH: 'Presentation',
    DEAL: 'Handshake',
  };
  return icons[type] || 'Circle';
}

/**
 * Get source type color classes
 */
export function getSourceTypeColor(type: CollaborationSourceType): string {
  const colors: Record<CollaborationSourceType, string> = {
    PROJECT: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    OPPORTUNITY: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    PITCH: 'bg-green-500/20 text-green-400 border-green-500/30',
    DEAL: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  };
  return colors[type] || 'bg-neutral-500/20 text-th-text-t border-neutral-500/30';
}

/**
 * Get request status label
 */
export function getRequestStatusLabel(status: CollaborationRequestStatus): string {
  const labels: Record<CollaborationRequestStatus, string> = {
    PENDING: 'Pending',
    ACCEPTED: 'Accepted',
    REJECTED: 'Rejected',
    CANCELLED: 'Cancelled',
    COMPLETED: 'Completed',
  };
  return labels[status] || status;
}

/**
 * Get request status color classes
 */
export function getRequestStatusColor(status: CollaborationRequestStatus): string {
  const colors: Record<CollaborationRequestStatus, string> = {
    PENDING: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    ACCEPTED: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    REJECTED: 'bg-red-500/20 text-red-400 border-red-500/30',
    CANCELLED: 'bg-neutral-500/20 text-th-text-t border-neutral-500/30',
    COMPLETED: 'bg-green-500/20 text-green-400 border-green-500/30',
  };
  return colors[status] || 'bg-neutral-500/20 text-th-text-t border-neutral-500/30';
}

/**
 * Get session status label
 */
export function getSessionStatusLabel(status: CollaborationSessionStatus): string {
  const labels: Record<CollaborationSessionStatus, string> = {
    PENDING: 'Pending',
    RUNNING: 'Running',
    DONE: 'Completed',
    FAILED: 'Failed',
  };
  return labels[status] || status;
}

/**
 * Get session status color classes
 */
export function getSessionStatusColor(status: CollaborationSessionStatus): string {
  const colors: Record<CollaborationSessionStatus, string> = {
    PENDING: 'bg-neutral-500/20 text-th-text-t border-neutral-500/30',
    RUNNING: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    DONE: 'bg-green-500/20 text-green-400 border-green-500/30',
    FAILED: 'bg-red-500/20 text-red-400 border-red-500/30',
  };
  return colors[status] || 'bg-neutral-500/20 text-th-text-t border-neutral-500/30';
}

/**
 * Get introduction status label
 */
export function getIntroductionStatusLabel(status: IntroductionStatus): string {
  const labels: Record<IntroductionStatus, string> = {
    PENDING: 'Pending',
    SENT: 'Awaiting Response',
    ACCEPTED: 'Accepted',
    COMPLETED: 'Completed',
    DECLINED: 'Declined',
  };
  return labels[status] || status;
}

/**
 * Get introduction status color classes
 */
export function getIntroductionStatusColor(status: IntroductionStatus): string {
  const colors: Record<IntroductionStatus, string> = {
    PENDING: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    SENT: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    ACCEPTED: 'bg-green-500/20 text-green-400 border-green-500/30',
    COMPLETED: 'bg-green-500/20 text-green-400 border-green-500/30',
    DECLINED: 'bg-red-500/20 text-red-400 border-red-500/30',
  };
  return colors[status] || 'bg-neutral-500/20 text-th-text-t border-neutral-500/30';
}

/**
 * Get score color based on value
 */
export function getScoreColor(score: number): string {
  if (score >= 90) return 'text-[#22C55E]';
  if (score >= 75) return 'text-[#84CC16]';
  if (score >= 60) return 'text-[#FACC15]';
  if (score >= 40) return 'text-[#FB923C]';
  return 'text-[#EF4444]';
}

/**
 * Get score bar color based on value
 */
export function getScoreBarColor(score: number): string {
  if (score >= 90) return 'bg-[#22C55E]';
  if (score >= 75) return 'bg-[#84CC16]';
  if (score >= 60) return 'bg-[#FACC15]';
  if (score >= 40) return 'bg-[#FB923C]';
  return 'bg-[#EF4444]';
}

/**
 * Get match reason type label
 */
export function getMatchReasonTypeLabel(type: CollaborationMatchReasonType): string {
  const labels: Record<CollaborationMatchReasonType, string> = {
    SECTOR_MATCH: 'Sector',
    SKILL_MATCH: 'Skills',
    LOCATION_MATCH: 'Location',
    KEYWORD_MATCH: 'Keywords',
  };
  return labels[type] || type;
}

/**
 * Format score as percentage text
 */
export function formatScore(score: number): string {
  return `${score}%`;
}

/**
 * Get initials from name
 */
export function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .substring(0, 2);
}

/**
 * Format date for display
 */
export function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Format relative time
 */
export function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays > 30) {
    return formatDate(dateStr);
  } else if (diffDays > 0) {
    return `${diffDays}d ago`;
  } else if (diffHours > 0) {
    return `${diffHours}h ago`;
  } else if (diffMins > 0) {
    return `${diffMins}m ago`;
  }
  return 'Just now';
}

// ============================================================================
// V2: Invitation API Functions
// ============================================================================

/**
 * Send invitation via Email/WhatsApp to a matched contact
 */
export async function sendInvitation(
  requestId: string,
  input: SendInvitationInput
): Promise<SendInvitationResponse> {
  return api.post(`/collaboration-requests/${requestId}/send-invitation`, input);
}

/**
 * Get invitation by token (public - no auth)
 */
export async function getInvitationByToken(token: string): Promise<{ invitation: PublicInvitationView }> {
  return api.get(`/invitations/${token}`);
}

/**
 * Accept invitation (public - optional auth)
 */
export async function acceptInvitation(
  token: string,
  acceptedByUserId?: string
): Promise<AcceptInvitationResponse> {
  return api.post(`/invitations/${token}/accept`, { acceptedByUserId });
}

/**
 * Decline invitation (public - no auth)
 */
export async function declineInvitation(token: string, reason?: string): Promise<{ success: boolean }> {
  return api.post(`/invitations/${token}/decline`, { reason });
}

// ============================================================================
// V2: Team Member API Functions
// ============================================================================

/**
 * List team members for a feature
 */
export async function listTeamMembers(
  sourceType: CollaborationSourceType,
  sourceId: string,
  status?: TeamMemberStatus
): Promise<ListTeamMembersResponse> {
  const typeMap: Record<CollaborationSourceType, string> = {
    PROJECT: 'projects',
    OPPORTUNITY: 'opportunities',
    PITCH: 'pitches',
    DEAL: 'deals',
  };
  const params = status ? `?status=${status}` : '';
  return api.get(`/${typeMap[sourceType]}/${sourceId}/team${params}`);
}

/**
 * Remove team member
 */
export async function removeTeamMember(
  sourceType: CollaborationSourceType,
  sourceId: string,
  memberId: string,
  reason?: string
): Promise<{ success: boolean; removedMemberId: string }> {
  const typeMap: Record<CollaborationSourceType, string> = {
    PROJECT: 'projects',
    OPPORTUNITY: 'opportunities',
    PITCH: 'pitches',
    DEAL: 'deals',
  };
  return api.delete(`/${typeMap[sourceType]}/${sourceId}/team/${memberId}`, { body: { reason } });
}

// ============================================================================
// V2: Helper Functions
// ============================================================================

/**
 * Get invitation channel label
 */
export function getInvitationChannelLabel(channel: InvitationChannel): string {
  const labels: Record<InvitationChannel, string> = {
    EMAIL: 'Email',
    WHATSAPP: 'WhatsApp',
    SMS: 'SMS',
    IN_APP: 'In-App',
  };
  return labels[channel] || channel;
}

/**
 * Get team member status label
 */
export function getTeamMemberStatusLabel(status: TeamMemberStatus): string {
  const labels: Record<TeamMemberStatus, string> = {
    INVITED: 'Invited',
    ACCEPTED: 'Accepted',
    DECLINED: 'Declined',
    REMOVED: 'Removed',
  };
  return labels[status] || status;
}

/**
 * Get team member role label
 */
export function getTeamMemberRoleLabel(role: TeamMemberRole): string {
  const labels: Record<TeamMemberRole, string> = {
    OWNER: 'Owner',
    COFOUNDER: 'Co-Founder',
    PARTNER: 'Partner',
    ADVISOR: 'Advisor',
    MEMBER: 'Member',
    INVESTOR: 'Investor',
  };
  return labels[role] || role;
}

/**
 * Get team member status color classes
 */
export function getTeamMemberStatusColor(status: TeamMemberStatus): string {
  const colors: Record<TeamMemberStatus, string> = {
    INVITED: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    ACCEPTED: 'bg-green-500/20 text-green-400 border-green-500/30',
    DECLINED: 'bg-red-500/20 text-red-400 border-red-500/30',
    REMOVED: 'bg-neutral-500/20 text-th-text-t border-neutral-500/30',
  };
  return colors[status] || 'bg-neutral-500/20 text-th-text-t border-neutral-500/30';
}

/**
 * Get team member display name
 */
export function getTeamMemberDisplayName(member: TeamMember): string {
  if (member.user?.fullName) {
    return member.user.fullName;
  }
  return member.externalName || 'Unknown';
}
