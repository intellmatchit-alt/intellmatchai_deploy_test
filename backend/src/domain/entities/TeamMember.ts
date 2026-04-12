/**
 * Team Member Domain Entity
 * Represents members of Projects, Opportunities, Pitches, and Deals
 *
 * This is a unified interface for all feature types. The actual database
 * models are separate (ProjectMember, OpportunityMember, etc.) but they
 * share this common structure.
 */

import {
  CollaborationSourceType,
  TeamMemberRole,
  TeamMemberStatus,
} from './Collaboration';

// ============================================================================
// Feature-Specific Team Member Entities
// ============================================================================

export interface ProjectMemberEntity {
  id: string;
  projectId: string;
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

export interface OpportunityMemberEntity {
  id: string;
  opportunityId: string;
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

export interface PitchMemberEntity {
  id: string;
  pitchId: string;
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

export interface DealMemberEntity {
  id: string;
  dealId: string;
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

// ============================================================================
// Unified Team Member Interface
// ============================================================================

/**
 * Unified team member with user details
 * Used for API responses across all feature types
 */
export interface TeamMemberWithUser {
  id: string;
  featureType: CollaborationSourceType;
  featureId: string;
  role: TeamMemberRole;
  status: TeamMemberStatus;
  invitedAt: Date;
  joinedAt: Date | null;
  // User info (if registered user)
  user: {
    id: string;
    fullName: string;
    email: string;
    avatarUrl: string | null;
    company: string | null;
    jobTitle: string | null;
  } | null;
  // External info (if not registered)
  externalName: string | null;
  externalEmail: string | null;
  externalPhone: string | null;
}

// ============================================================================
// Create/Update DTOs
// ============================================================================

export interface CreateProjectMemberInput {
  projectId: string;
  userId?: string;
  externalName?: string;
  externalEmail?: string;
  externalPhone?: string;
  role?: TeamMemberRole;
}

export interface CreateOpportunityMemberInput {
  opportunityId: string;
  userId?: string;
  externalName?: string;
  externalEmail?: string;
  externalPhone?: string;
  role?: TeamMemberRole;
}

export interface CreatePitchMemberInput {
  pitchId: string;
  userId?: string;
  externalName?: string;
  externalEmail?: string;
  externalPhone?: string;
  role?: TeamMemberRole;
}

export interface CreateDealMemberInput {
  dealId: string;
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

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Convert feature-specific member to unified format
 */
export function toUnifiedTeamMember(
  member: ProjectMemberEntity | OpportunityMemberEntity | PitchMemberEntity | DealMemberEntity,
  featureType: CollaborationSourceType,
  user?: {
    id: string;
    fullName: string;
    email: string;
    avatarUrl: string | null;
    company: string | null;
    jobTitle: string | null;
  } | null
): TeamMemberWithUser {
  // Get feature ID based on type
  let featureId: string;
  if ('projectId' in member) featureId = member.projectId;
  else if ('opportunityId' in member) featureId = member.opportunityId;
  else if ('pitchId' in member) featureId = member.pitchId;
  else if ('dealId' in member) featureId = member.dealId;
  else throw new Error('Unknown member type');

  return {
    id: member.id,
    featureType,
    featureId,
    role: member.role,
    status: member.status,
    invitedAt: member.invitedAt,
    joinedAt: member.joinedAt,
    user: user || null,
    externalName: member.externalName,
    externalEmail: member.externalEmail,
    externalPhone: member.externalPhone,
  };
}

/**
 * Check if member is a registered user
 */
export function isRegisteredMember(
  member: ProjectMemberEntity | OpportunityMemberEntity | PitchMemberEntity | DealMemberEntity
): boolean {
  return member.userId !== null;
}

/**
 * Get display name for member
 */
export function getMemberDisplayName(
  member: TeamMemberWithUser
): string {
  if (member.user) {
    return member.user.fullName;
  }
  return member.externalName || member.externalEmail || 'Unknown';
}
