/**
 * Team Member Repository Interfaces
 * Defines data access contracts for team member operations across all feature types
 */

import {
  CollaborationSourceType,
  TeamMemberRole,
  TeamMemberStatus,
} from '../entities/Collaboration';
import {
  ProjectMemberEntity,
  OpportunityMemberEntity,
  PitchMemberEntity,
  DealMemberEntity,
  TeamMemberWithUser,
  CreateProjectMemberInput,
  CreateOpportunityMemberInput,
  CreatePitchMemberInput,
  CreateDealMemberInput,
  UpdateTeamMemberInput,
} from '../entities/TeamMember';

// ============================================================================
// List Options
// ============================================================================

export interface TeamMemberListOptions {
  featureId: string;
  status?: TeamMemberStatus;
  role?: TeamMemberRole;
  includeRemoved?: boolean;
  page?: number;
  limit?: number;
}

// ============================================================================
// Project Member Repository
// ============================================================================

export interface IProjectMemberRepository {
  // CRUD
  create(input: CreateProjectMemberInput): Promise<ProjectMemberEntity>;
  findById(id: string): Promise<ProjectMemberEntity | null>;
  findByIdWithUser(id: string): Promise<TeamMemberWithUser | null>;
  update(id: string, input: UpdateTeamMemberInput): Promise<ProjectMemberEntity>;
  delete(id: string): Promise<void>;

  // Queries
  findByProjectId(options: TeamMemberListOptions): Promise<{
    members: TeamMemberWithUser[];
    total: number;
  }>;
  findByUserId(userId: string): Promise<ProjectMemberEntity[]>;
  findByProjectAndUser(projectId: string, userId: string): Promise<ProjectMemberEntity | null>;
  findByProjectAndEmail(projectId: string, email: string): Promise<ProjectMemberEntity | null>;
  findByInvitationToken(token: string): Promise<ProjectMemberEntity | null>;

  // Stats
  countByProjectId(projectId: string, status?: TeamMemberStatus): Promise<number>;
  countByUserId(userId: string): Promise<number>;
}

// ============================================================================
// Opportunity Member Repository
// ============================================================================

export interface IOpportunityMemberRepository {
  // CRUD
  create(input: CreateOpportunityMemberInput): Promise<OpportunityMemberEntity>;
  findById(id: string): Promise<OpportunityMemberEntity | null>;
  findByIdWithUser(id: string): Promise<TeamMemberWithUser | null>;
  update(id: string, input: UpdateTeamMemberInput): Promise<OpportunityMemberEntity>;
  delete(id: string): Promise<void>;

  // Queries
  findByOpportunityId(options: TeamMemberListOptions): Promise<{
    members: TeamMemberWithUser[];
    total: number;
  }>;
  findByUserId(userId: string): Promise<OpportunityMemberEntity[]>;
  findByOpportunityAndUser(opportunityId: string, userId: string): Promise<OpportunityMemberEntity | null>;
  findByOpportunityAndEmail(opportunityId: string, email: string): Promise<OpportunityMemberEntity | null>;
  findByInvitationToken(token: string): Promise<OpportunityMemberEntity | null>;

  // Stats
  countByOpportunityId(opportunityId: string, status?: TeamMemberStatus): Promise<number>;
  countByUserId(userId: string): Promise<number>;
}

// ============================================================================
// Pitch Member Repository
// ============================================================================

export interface IPitchMemberRepository {
  // CRUD
  create(input: CreatePitchMemberInput): Promise<PitchMemberEntity>;
  findById(id: string): Promise<PitchMemberEntity | null>;
  findByIdWithUser(id: string): Promise<TeamMemberWithUser | null>;
  update(id: string, input: UpdateTeamMemberInput): Promise<PitchMemberEntity>;
  delete(id: string): Promise<void>;

  // Queries
  findByPitchId(options: TeamMemberListOptions): Promise<{
    members: TeamMemberWithUser[];
    total: number;
  }>;
  findByUserId(userId: string): Promise<PitchMemberEntity[]>;
  findByPitchAndUser(pitchId: string, userId: string): Promise<PitchMemberEntity | null>;
  findByPitchAndEmail(pitchId: string, email: string): Promise<PitchMemberEntity | null>;
  findByInvitationToken(token: string): Promise<PitchMemberEntity | null>;

  // Stats
  countByPitchId(pitchId: string, status?: TeamMemberStatus): Promise<number>;
  countByUserId(userId: string): Promise<number>;
}

// ============================================================================
// Deal Member Repository
// ============================================================================

export interface IDealMemberRepository {
  // CRUD
  create(input: CreateDealMemberInput): Promise<DealMemberEntity>;
  findById(id: string): Promise<DealMemberEntity | null>;
  findByIdWithUser(id: string): Promise<TeamMemberWithUser | null>;
  update(id: string, input: UpdateTeamMemberInput): Promise<DealMemberEntity>;
  delete(id: string): Promise<void>;

  // Queries
  findByDealId(options: TeamMemberListOptions): Promise<{
    members: TeamMemberWithUser[];
    total: number;
  }>;
  findByUserId(userId: string): Promise<DealMemberEntity[]>;
  findByDealAndUser(dealId: string, userId: string): Promise<DealMemberEntity | null>;
  findByDealAndEmail(dealId: string, email: string): Promise<DealMemberEntity | null>;
  findByInvitationToken(token: string): Promise<DealMemberEntity | null>;

  // Stats
  countByDealId(dealId: string, status?: TeamMemberStatus): Promise<number>;
  countByUserId(userId: string): Promise<number>;
}

// ============================================================================
// Unified Team Member Repository (Factory Pattern)
// ============================================================================

/**
 * Unified interface for accessing team members across all feature types
 * Uses the feature type to route to the correct repository
 */
export interface IUnifiedTeamMemberRepository {
  // CRUD operations by feature type
  create(
    featureType: CollaborationSourceType,
    featureId: string,
    input: {
      userId?: string;
      externalName?: string;
      externalEmail?: string;
      externalPhone?: string;
      role?: TeamMemberRole;
    }
  ): Promise<TeamMemberWithUser>;

  findById(
    featureType: CollaborationSourceType,
    memberId: string
  ): Promise<TeamMemberWithUser | null>;

  update(
    featureType: CollaborationSourceType,
    memberId: string,
    input: UpdateTeamMemberInput
  ): Promise<TeamMemberWithUser>;

  remove(
    featureType: CollaborationSourceType,
    memberId: string
  ): Promise<void>;

  // List by feature
  listByFeature(
    featureType: CollaborationSourceType,
    featureId: string,
    options?: {
      status?: TeamMemberStatus;
      role?: TeamMemberRole;
      includeRemoved?: boolean;
    }
  ): Promise<TeamMemberWithUser[]>;

  // Find by invitation token (searches all feature types)
  findByInvitationToken(token: string): Promise<{
    featureType: CollaborationSourceType;
    member: TeamMemberWithUser;
  } | null>;

  // Count members
  countByFeature(
    featureType: CollaborationSourceType,
    featureId: string,
    status?: TeamMemberStatus
  ): Promise<number>;
}
