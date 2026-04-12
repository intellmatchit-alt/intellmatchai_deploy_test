/**
 * Organization API Client
 *
 * Functions for organization/team management.
 */

import { api } from './client';

// Types
export interface Organization {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  website: string | null;
  industry: string | null;
  size: 'SMALL' | 'MEDIUM' | 'LARGE' | 'ENTERPRISE' | null;
  subscriptionId: string;
  contactLimit: number;
  createdAt: string;
  updatedAt: string;
  myRole: 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER';
  subscription?: {
    plan: string;
    status: string;
    seats: number;
    billingInterval: string | null;
    currentPeriodEnd: string | null;
  };
  members?: OrgMember[];
  _count?: {
    sharedContacts: number;
    invitations: number;
  };
}

export interface OrgMember {
  id: string;
  organizationId: string;
  userId: string;
  role: 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER';
  joinedAt: string;
  user: {
    id: string;
    fullName: string;
    email: string;
    avatarUrl: string | null;
    jobTitle: string | null;
    company?: string | null;
  };
}

export interface OrgInvitation {
  id: string;
  organizationId: string;
  email: string;
  role: 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER';
  token: string;
  status: 'PENDING' | 'ACCEPTED' | 'EXPIRED' | 'CANCELLED';
  expiresAt: string;
  createdAt: string;
  organization: {
    id: string;
    name: string;
    logoUrl: string | null;
  };
  invitedBy: {
    fullName: string;
    avatarUrl: string | null;
  };
}

export interface OrgActivityLog {
  id: string;
  userId: string;
  action: string;
  resourceType: string | null;
  resourceId: string | null;
  metadata: Record<string, any> | null;
  createdAt: string;
  user: {
    id: string;
    fullName: string;
    avatarUrl: string | null;
  };
}

export interface SharedContact {
  id: string;
  contactId: string;
  organizationId: string;
  sharedById: string;
  visibility: 'FULL' | 'BASIC' | 'NAME_ONLY';
  createdAt: string;
  contact: {
    id: string;
    fullName: string;
    email: string | null;
    phone: string | null;
    company: string | null;
    jobTitle: string | null;
    avatarUrl: string | null;
    location: string | null;
    linkedinUrl: string | null;
  };
  sharedBy: {
    id: string;
    fullName: string;
    avatarUrl: string | null;
  };
}

export interface WarmIntroRequest {
  id: string;
  organizationId: string;
  requesterId: string;
  connectorId: string;
  targetContactId: string;
  message: string | null;
  context: string | null;
  status: 'PENDING' | 'APPROVED' | 'DECLINED' | 'COMPLETED' | 'CANCELLED';
  connectorNote: string | null;
  completedAt: string | null;
  declinedAt: string | null;
  declinedReason: string | null;
  createdAt: string;
  requester?: {
    id: string;
    fullName: string;
    avatarUrl: string | null;
    jobTitle?: string | null;
  };
  connector?: {
    id: string;
    fullName: string;
    avatarUrl: string | null;
  };
  targetContact?: {
    id: string;
    fullName: string;
    company: string | null;
    jobTitle: string | null;
    avatarUrl?: string | null;
  };
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// ---- Organization CRUD ----

export async function createOrganization(data: {
  name: string;
  website?: string;
  industry?: string;
  size?: string;
}): Promise<Organization> {
  return api.post<Organization>('/organizations', data);
}

export async function getMyOrganization(): Promise<Organization | null> {
  return api.get<Organization | null>('/organizations/mine');
}

export async function updateOrganization(
  id: string,
  data: Partial<{
    name: string;
    logoUrl: string;
    website: string;
    industry: string;
    size: string;
  }>
): Promise<Organization> {
  return api.patch<Organization>(`/organizations/${id}`, data);
}

export async function deleteOrganization(id: string): Promise<void> {
  return api.delete(`/organizations/${id}`);
}

// ---- Members ----

export async function getMembers(orgId: string): Promise<OrgMember[]> {
  return api.get<OrgMember[]>(`/organizations/${orgId}/members`);
}

export async function inviteMember(
  orgId: string,
  data: { email: string; role?: string; message?: string }
): Promise<OrgInvitation> {
  return api.post<OrgInvitation>(`/organizations/${orgId}/members/invite`, data);
}

export async function updateMemberRole(
  orgId: string,
  userId: string,
  role: string
): Promise<OrgMember> {
  return api.patch<OrgMember>(`/organizations/${orgId}/members/${userId}`, { role });
}

export async function removeMember(orgId: string, userId: string): Promise<void> {
  return api.delete(`/organizations/${orgId}/members/${userId}`);
}

// ---- Invitations ----

export async function getPendingInvitations(): Promise<OrgInvitation[]> {
  return api.get<OrgInvitation[]>('/organizations/invitations/pending');
}

export async function acceptInvitation(token: string): Promise<{
  organizationId: string;
  organizationName: string;
  role: string;
}> {
  return api.post(`/organizations/invitations/${token}/accept`);
}

export async function declineInvitation(token: string): Promise<void> {
  return api.post(`/organizations/invitations/${token}/decline`);
}

// ---- Org Invitations (admin view) ----

export async function getOrgInvitations(orgId: string): Promise<OrgInvitation[]> {
  return api.get<OrgInvitation[]>(`/organizations/${orgId}/invitations`);
}

export async function cancelOrgInvitation(orgId: string, invitationId: string): Promise<void> {
  return api.delete(`/organizations/${orgId}/invitations/${invitationId}`);
}

// ---- Activity Log ----

export async function getActivityLog(
  orgId: string,
  params?: { page?: number; limit?: number; action?: string; userId?: string }
): Promise<PaginatedResponse<OrgActivityLog>> {
  const queryParams = new URLSearchParams();
  if (params?.page) queryParams.set('page', String(params.page));
  if (params?.limit) queryParams.set('limit', String(params.limit));
  if (params?.action) queryParams.set('action', params.action);
  if (params?.userId) queryParams.set('userId', params.userId);
  const qs = queryParams.toString();
  return api.get(`/organizations/${orgId}/activity${qs ? `?${qs}` : ''}`);
}

// ---- Shared Contacts ----

export async function getOrgContacts(
  orgId: string,
  params?: { page?: number; limit?: number; search?: string; sharedById?: string }
): Promise<PaginatedResponse<SharedContact>> {
  const queryParams = new URLSearchParams();
  if (params?.page) queryParams.set('page', String(params.page));
  if (params?.limit) queryParams.set('limit', String(params.limit));
  if (params?.search) queryParams.set('search', params.search);
  if (params?.sharedById) queryParams.set('sharedById', params.sharedById);
  const qs = queryParams.toString();
  return api.get(`/organizations/${orgId}/contacts${qs ? `?${qs}` : ''}`);
}

export async function getOrgContactStats(orgId: string): Promise<{
  totalShared: number;
  contactLimit: number;
  memberCount: number;
}> {
  return api.get(`/organizations/${orgId}/contacts/stats`);
}

export async function shareContacts(
  orgId: string,
  contactIds: string[],
  visibility?: string
): Promise<{ shared: number }> {
  return api.post(`/organizations/${orgId}/contacts/share`, { contactIds, visibility });
}

export async function unshareContacts(
  orgId: string,
  contactIds: string[]
): Promise<{ removed: number }> {
  return api.delete(`/organizations/${orgId}/contacts/unshare`, { body: { contactIds } });
}

export async function updateContactVisibility(
  orgId: string,
  contactId: string,
  visibility: string
): Promise<SharedContact> {
  return api.patch(`/organizations/${orgId}/contacts/${contactId}/visibility`, { visibility });
}

// ---- Privacy ----

export async function getPrivacySettings(orgId: string): Promise<{
  id: string;
  shareMode: 'ALL' | 'MANUAL' | 'NONE';
}> {
  return api.get(`/organizations/${orgId}/privacy`);
}

export async function updatePrivacySettings(
  orgId: string,
  shareMode: string
): Promise<{ id: string; shareMode: string }> {
  return api.patch(`/organizations/${orgId}/privacy`, { shareMode });
}

// ---- Warm Intros ----

export async function requestIntro(
  orgId: string,
  data: {
    connectorId: string;
    targetContactId: string;
    message?: string;
    context?: string;
  }
): Promise<WarmIntroRequest> {
  return api.post<WarmIntroRequest>(`/organizations/${orgId}/intros`, data);
}

export async function getSentIntros(orgId: string): Promise<WarmIntroRequest[]> {
  return api.get<WarmIntroRequest[]>(`/organizations/${orgId}/intros/sent`);
}

export async function getReceivedIntros(orgId: string): Promise<WarmIntroRequest[]> {
  return api.get<WarmIntroRequest[]>(`/organizations/${orgId}/intros/received`);
}

export async function respondToIntro(
  orgId: string,
  introId: string,
  data: { status: string; connectorNote?: string; declinedReason?: string }
): Promise<WarmIntroRequest> {
  return api.patch<WarmIntroRequest>(`/organizations/${orgId}/intros/${introId}`, data);
}

export async function getIntroStats(orgId: string): Promise<{
  total: number;
  pending: number;
  approved: number;
  completed: number;
  declined: number;
}> {
  return api.get(`/organizations/${orgId}/intros/stats`);
}

// ---- Shared Workspaces ----

export interface TeamProject {
  id: string;
  title: string;
  summary: string;
  category: string | null;
  stage: string;
  visibility: string;
  isActive: boolean;
  sectors: Array<{ id: string; name: string }>;
  matchCount: number;
  user: { id: string; fullName: string; avatarUrl: string | null };
  createdAt: string;
}

export interface TeamDeal {
  id: string;
  title: string | null;
  mode: 'SELL' | 'BUY';
  domain: string | null;
  solutionType: string | null;
  productName: string | null;
  targetDescription: string | null;
  problemStatement: string | null;
  status: string;
  matchCount: number;
  avgScore: number;
  user: { id: string; fullName: string; avatarUrl: string | null };
  createdAt: string;
}

export function getTeamProjects(orgId: string, options?: { page?: number; limit?: number }): Promise<{
  projects: TeamProject[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}> {
  const params = new URLSearchParams();
  if (options?.page) params.set('page', String(options.page));
  if (options?.limit) params.set('limit', String(options.limit));
  const query = params.toString();
  return api.get(`/organizations/${orgId}/projects${query ? `?${query}` : ''}`);
}

export function shareProjectWithTeam(orgId: string, projectId: string): Promise<{ message: string }> {
  return api.post(`/organizations/${orgId}/projects/${projectId}/share`, {});
}

export function unshareProjectFromTeam(orgId: string, projectId: string): Promise<{ message: string }> {
  return api.delete(`/organizations/${orgId}/projects/${projectId}/share`);
}

export function getTeamDeals(orgId: string, options?: { page?: number; limit?: number }): Promise<{
  deals: TeamDeal[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}> {
  const params = new URLSearchParams();
  if (options?.page) params.set('page', String(options.page));
  if (options?.limit) params.set('limit', String(options.limit));
  const query = params.toString();
  return api.get(`/organizations/${orgId}/deals${query ? `?${query}` : ''}`);
}

export function shareDealWithTeam(orgId: string, dealId: string): Promise<{ message: string }> {
  return api.post(`/organizations/${orgId}/deals/${dealId}/share`, {});
}

export function unshareDealFromTeam(orgId: string, dealId: string): Promise<{ message: string }> {
  return api.delete(`/organizations/${orgId}/deals/${dealId}/share`);
}

// ---- Copy Contacts to Org ----

export function copyContactsToOrg(orgId: string, contactIds: string[]): Promise<{ copied: number }> {
  return api.post(`/organizations/${orgId}/contacts/copy`, { contactIds });
}

// Export as namespace
export const organizationApi = {
  createOrganization,
  getMyOrganization,
  updateOrganization,
  deleteOrganization,
  getMembers,
  inviteMember,
  updateMemberRole,
  removeMember,
  getOrgInvitations,
  cancelOrgInvitation,
  getPendingInvitations,
  acceptInvitation,
  declineInvitation,
  getActivityLog,
  getOrgContacts,
  getOrgContactStats,
  shareContacts,
  unshareContacts,
  updateContactVisibility,
  getPrivacySettings,
  updatePrivacySettings,
  requestIntro,
  getSentIntros,
  getReceivedIntros,
  respondToIntro,
  getIntroStats,
  getTeamProjects,
  shareProjectWithTeam,
  unshareProjectFromTeam,
  getTeamDeals,
  shareDealWithTeam,
  unshareDealFromTeam,
  copyContactsToOrg,
};
