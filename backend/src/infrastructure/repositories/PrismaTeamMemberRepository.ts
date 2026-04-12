/**
 * Prisma Team Member Repository Implementations
 * Data access layer for team members across all feature types
 */

import { prisma } from '../database/prisma/client';
import { randomBytes } from 'crypto';
import {
  CollaborationSourceType,
  TeamMemberRole,
  TeamMemberStatus,
} from '../../domain/entities/Collaboration';
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
  toUnifiedTeamMember,
} from '../../domain/entities/TeamMember';
import {
  IProjectMemberRepository,
  IOpportunityMemberRepository,
  IPitchMemberRepository,
  IDealMemberRepository,
  IUnifiedTeamMemberRepository,
  TeamMemberListOptions,
} from '../../domain/repositories/ITeamMemberRepository';

// ============================================================================
// Helper Functions
// ============================================================================

function generateInvitationToken(): string {
  return randomBytes(32).toString('hex');
}

const userSelect = {
  id: true,
  fullName: true,
  email: true,
  avatarUrl: true,
  company: true,
  jobTitle: true,
};

// ============================================================================
// Project Member Repository
// ============================================================================

export class PrismaProjectMemberRepository implements IProjectMemberRepository {
  async create(input: CreateProjectMemberInput): Promise<ProjectMemberEntity> {
    const member = await prisma.projectMember.create({
      data: {
        projectId: input.projectId,
        userId: input.userId,
        externalName: input.externalName,
        externalEmail: input.externalEmail,
        externalPhone: input.externalPhone,
        role: input.role || TeamMemberRole.MEMBER,
        status: TeamMemberStatus.INVITED,
        invitationToken: generateInvitationToken(),
        invitedAt: new Date(),
      },
    });
    return this.mapToEntity(member);
  }

  async findById(id: string): Promise<ProjectMemberEntity | null> {
    const member = await prisma.projectMember.findUnique({ where: { id } });
    return member ? this.mapToEntity(member) : null;
  }

  async findByIdWithUser(id: string): Promise<TeamMemberWithUser | null> {
    const member = await prisma.projectMember.findUnique({
      where: { id },
      include: { user: { select: userSelect } },
    });
    if (!member) return null;
    return toUnifiedTeamMember(
      this.mapToEntity(member),
      CollaborationSourceType.PROJECT,
      member.user
    );
  }

  async update(id: string, input: UpdateTeamMemberInput): Promise<ProjectMemberEntity> {
    const member = await prisma.projectMember.update({
      where: { id },
      data: {
        role: input.role,
        status: input.status,
        joinedAt: input.joinedAt,
        removedAt: input.removedAt,
      },
    });
    return this.mapToEntity(member);
  }

  async delete(id: string): Promise<void> {
    await prisma.projectMember.delete({ where: { id } });
  }

  async findByProjectId(options: TeamMemberListOptions): Promise<{
    members: TeamMemberWithUser[];
    total: number;
  }> {
    const where: any = { projectId: options.featureId };
    if (options.status) where.status = options.status;
    if (options.role) where.role = options.role;
    if (!options.includeRemoved) {
      where.status = { not: TeamMemberStatus.REMOVED };
    }

    const [members, total] = await Promise.all([
      prisma.projectMember.findMany({
        where,
        include: { user: { select: userSelect } },
        skip: options.page ? (options.page - 1) * (options.limit || 20) : undefined,
        take: options.limit || 20,
        orderBy: { invitedAt: 'desc' },
      }),
      prisma.projectMember.count({ where }),
    ]);

    return {
      members: members.map((m) =>
        toUnifiedTeamMember(this.mapToEntity(m), CollaborationSourceType.PROJECT, m.user)
      ),
      total,
    };
  }

  async findByUserId(userId: string): Promise<ProjectMemberEntity[]> {
    const members = await prisma.projectMember.findMany({
      where: { userId, status: { not: TeamMemberStatus.REMOVED } },
    });
    return members.map((m) => this.mapToEntity(m));
  }

  async findByProjectAndUser(projectId: string, userId: string): Promise<ProjectMemberEntity | null> {
    const member = await prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId } },
    });
    return member ? this.mapToEntity(member) : null;
  }

  async findByProjectAndEmail(projectId: string, email: string): Promise<ProjectMemberEntity | null> {
    const member = await prisma.projectMember.findUnique({
      where: { projectId_externalEmail: { projectId, externalEmail: email } },
    });
    return member ? this.mapToEntity(member) : null;
  }

  async findByInvitationToken(token: string): Promise<ProjectMemberEntity | null> {
    const member = await prisma.projectMember.findUnique({
      where: { invitationToken: token },
    });
    return member ? this.mapToEntity(member) : null;
  }

  async countByProjectId(projectId: string, status?: TeamMemberStatus): Promise<number> {
    const where: any = { projectId };
    if (status) where.status = status;
    else where.status = { not: TeamMemberStatus.REMOVED };
    return prisma.projectMember.count({ where });
  }

  async countByUserId(userId: string): Promise<number> {
    return prisma.projectMember.count({
      where: { userId, status: { not: TeamMemberStatus.REMOVED } },
    });
  }

  private mapToEntity(member: any): ProjectMemberEntity {
    return {
      id: member.id,
      projectId: member.projectId,
      userId: member.userId,
      externalName: member.externalName,
      externalEmail: member.externalEmail,
      externalPhone: member.externalPhone,
      role: member.role as TeamMemberRole,
      status: member.status as TeamMemberStatus,
      invitationToken: member.invitationToken,
      invitedAt: member.invitedAt,
      joinedAt: member.joinedAt,
      removedAt: member.removedAt,
      createdAt: member.createdAt,
      updatedAt: member.updatedAt,
    };
  }
}

// ============================================================================
// Opportunity Member Repository
// ============================================================================

export class PrismaOpportunityMemberRepository implements IOpportunityMemberRepository {
  async create(input: CreateOpportunityMemberInput): Promise<OpportunityMemberEntity> {
    const member = await prisma.opportunityMember.create({
      data: {
        opportunityId: input.opportunityId,
        userId: input.userId,
        externalName: input.externalName,
        externalEmail: input.externalEmail,
        externalPhone: input.externalPhone,
        role: input.role || TeamMemberRole.MEMBER,
        status: TeamMemberStatus.INVITED,
        invitationToken: generateInvitationToken(),
        invitedAt: new Date(),
      },
    });
    return this.mapToEntity(member);
  }

  async findById(id: string): Promise<OpportunityMemberEntity | null> {
    const member = await prisma.opportunityMember.findUnique({ where: { id } });
    return member ? this.mapToEntity(member) : null;
  }

  async findByIdWithUser(id: string): Promise<TeamMemberWithUser | null> {
    const member = await prisma.opportunityMember.findUnique({
      where: { id },
      include: { user: { select: userSelect } },
    });
    if (!member) return null;
    return toUnifiedTeamMember(
      this.mapToEntity(member),
      CollaborationSourceType.OPPORTUNITY,
      member.user
    );
  }

  async update(id: string, input: UpdateTeamMemberInput): Promise<OpportunityMemberEntity> {
    const member = await prisma.opportunityMember.update({
      where: { id },
      data: {
        role: input.role,
        status: input.status,
        joinedAt: input.joinedAt,
        removedAt: input.removedAt,
      },
    });
    return this.mapToEntity(member);
  }

  async delete(id: string): Promise<void> {
    await prisma.opportunityMember.delete({ where: { id } });
  }

  async findByOpportunityId(options: TeamMemberListOptions): Promise<{
    members: TeamMemberWithUser[];
    total: number;
  }> {
    const where: any = { opportunityId: options.featureId };
    if (options.status) where.status = options.status;
    if (options.role) where.role = options.role;
    if (!options.includeRemoved) {
      where.status = { not: TeamMemberStatus.REMOVED };
    }

    const [members, total] = await Promise.all([
      prisma.opportunityMember.findMany({
        where,
        include: { user: { select: userSelect } },
        skip: options.page ? (options.page - 1) * (options.limit || 20) : undefined,
        take: options.limit || 20,
        orderBy: { invitedAt: 'desc' },
      }),
      prisma.opportunityMember.count({ where }),
    ]);

    return {
      members: members.map((m) =>
        toUnifiedTeamMember(this.mapToEntity(m), CollaborationSourceType.OPPORTUNITY, m.user)
      ),
      total,
    };
  }

  async findByUserId(userId: string): Promise<OpportunityMemberEntity[]> {
    const members = await prisma.opportunityMember.findMany({
      where: { userId, status: { not: TeamMemberStatus.REMOVED } },
    });
    return members.map((m) => this.mapToEntity(m));
  }

  async findByOpportunityAndUser(opportunityId: string, userId: string): Promise<OpportunityMemberEntity | null> {
    const member = await prisma.opportunityMember.findUnique({
      where: { opportunityId_userId: { opportunityId, userId } },
    });
    return member ? this.mapToEntity(member) : null;
  }

  async findByOpportunityAndEmail(opportunityId: string, email: string): Promise<OpportunityMemberEntity | null> {
    const member = await prisma.opportunityMember.findUnique({
      where: { opportunityId_externalEmail: { opportunityId, externalEmail: email } },
    });
    return member ? this.mapToEntity(member) : null;
  }

  async findByInvitationToken(token: string): Promise<OpportunityMemberEntity | null> {
    const member = await prisma.opportunityMember.findUnique({
      where: { invitationToken: token },
    });
    return member ? this.mapToEntity(member) : null;
  }

  async countByOpportunityId(opportunityId: string, status?: TeamMemberStatus): Promise<number> {
    const where: any = { opportunityId };
    if (status) where.status = status;
    else where.status = { not: TeamMemberStatus.REMOVED };
    return prisma.opportunityMember.count({ where });
  }

  async countByUserId(userId: string): Promise<number> {
    return prisma.opportunityMember.count({
      where: { userId, status: { not: TeamMemberStatus.REMOVED } },
    });
  }

  private mapToEntity(member: any): OpportunityMemberEntity {
    return {
      id: member.id,
      opportunityId: member.opportunityId,
      userId: member.userId,
      externalName: member.externalName,
      externalEmail: member.externalEmail,
      externalPhone: member.externalPhone,
      role: member.role as TeamMemberRole,
      status: member.status as TeamMemberStatus,
      invitationToken: member.invitationToken,
      invitedAt: member.invitedAt,
      joinedAt: member.joinedAt,
      removedAt: member.removedAt,
      createdAt: member.createdAt,
      updatedAt: member.updatedAt,
    };
  }
}

// ============================================================================
// Pitch Member Repository
// ============================================================================

export class PrismaPitchMemberRepository implements IPitchMemberRepository {
  async create(input: CreatePitchMemberInput): Promise<PitchMemberEntity> {
    const member = await prisma.pitchMember.create({
      data: {
        pitchId: input.pitchId,
        userId: input.userId,
        externalName: input.externalName,
        externalEmail: input.externalEmail,
        externalPhone: input.externalPhone,
        role: input.role || TeamMemberRole.MEMBER,
        status: TeamMemberStatus.INVITED,
        invitationToken: generateInvitationToken(),
        invitedAt: new Date(),
      },
    });
    return this.mapToEntity(member);
  }

  async findById(id: string): Promise<PitchMemberEntity | null> {
    const member = await prisma.pitchMember.findUnique({ where: { id } });
    return member ? this.mapToEntity(member) : null;
  }

  async findByIdWithUser(id: string): Promise<TeamMemberWithUser | null> {
    const member = await prisma.pitchMember.findUnique({
      where: { id },
      include: { user: { select: userSelect } },
    });
    if (!member) return null;
    return toUnifiedTeamMember(
      this.mapToEntity(member),
      CollaborationSourceType.PITCH,
      member.user
    );
  }

  async update(id: string, input: UpdateTeamMemberInput): Promise<PitchMemberEntity> {
    const member = await prisma.pitchMember.update({
      where: { id },
      data: {
        role: input.role,
        status: input.status,
        joinedAt: input.joinedAt,
        removedAt: input.removedAt,
      },
    });
    return this.mapToEntity(member);
  }

  async delete(id: string): Promise<void> {
    await prisma.pitchMember.delete({ where: { id } });
  }

  async findByPitchId(options: TeamMemberListOptions): Promise<{
    members: TeamMemberWithUser[];
    total: number;
  }> {
    const where: any = { pitchId: options.featureId };
    if (options.status) where.status = options.status;
    if (options.role) where.role = options.role;
    if (!options.includeRemoved) {
      where.status = { not: TeamMemberStatus.REMOVED };
    }

    const [members, total] = await Promise.all([
      prisma.pitchMember.findMany({
        where,
        include: { user: { select: userSelect } },
        skip: options.page ? (options.page - 1) * (options.limit || 20) : undefined,
        take: options.limit || 20,
        orderBy: { invitedAt: 'desc' },
      }),
      prisma.pitchMember.count({ where }),
    ]);

    return {
      members: members.map((m) =>
        toUnifiedTeamMember(this.mapToEntity(m), CollaborationSourceType.PITCH, m.user)
      ),
      total,
    };
  }

  async findByUserId(userId: string): Promise<PitchMemberEntity[]> {
    const members = await prisma.pitchMember.findMany({
      where: { userId, status: { not: TeamMemberStatus.REMOVED } },
    });
    return members.map((m) => this.mapToEntity(m));
  }

  async findByPitchAndUser(pitchId: string, userId: string): Promise<PitchMemberEntity | null> {
    const member = await prisma.pitchMember.findUnique({
      where: { pitchId_userId: { pitchId, userId } },
    });
    return member ? this.mapToEntity(member) : null;
  }

  async findByPitchAndEmail(pitchId: string, email: string): Promise<PitchMemberEntity | null> {
    const member = await prisma.pitchMember.findUnique({
      where: { pitchId_externalEmail: { pitchId, externalEmail: email } },
    });
    return member ? this.mapToEntity(member) : null;
  }

  async findByInvitationToken(token: string): Promise<PitchMemberEntity | null> {
    const member = await prisma.pitchMember.findUnique({
      where: { invitationToken: token },
    });
    return member ? this.mapToEntity(member) : null;
  }

  async countByPitchId(pitchId: string, status?: TeamMemberStatus): Promise<number> {
    const where: any = { pitchId };
    if (status) where.status = status;
    else where.status = { not: TeamMemberStatus.REMOVED };
    return prisma.pitchMember.count({ where });
  }

  async countByUserId(userId: string): Promise<number> {
    return prisma.pitchMember.count({
      where: { userId, status: { not: TeamMemberStatus.REMOVED } },
    });
  }

  private mapToEntity(member: any): PitchMemberEntity {
    return {
      id: member.id,
      pitchId: member.pitchId,
      userId: member.userId,
      externalName: member.externalName,
      externalEmail: member.externalEmail,
      externalPhone: member.externalPhone,
      role: member.role as TeamMemberRole,
      status: member.status as TeamMemberStatus,
      invitationToken: member.invitationToken,
      invitedAt: member.invitedAt,
      joinedAt: member.joinedAt,
      removedAt: member.removedAt,
      createdAt: member.createdAt,
      updatedAt: member.updatedAt,
    };
  }
}

// ============================================================================
// Deal Member Repository
// ============================================================================

export class PrismaDealMemberRepository implements IDealMemberRepository {
  async create(input: CreateDealMemberInput): Promise<DealMemberEntity> {
    const member = await prisma.dealMember.create({
      data: {
        dealId: input.dealId,
        userId: input.userId,
        externalName: input.externalName,
        externalEmail: input.externalEmail,
        externalPhone: input.externalPhone,
        role: input.role || TeamMemberRole.MEMBER,
        status: TeamMemberStatus.INVITED,
        invitationToken: generateInvitationToken(),
        invitedAt: new Date(),
      },
    });
    return this.mapToEntity(member);
  }

  async findById(id: string): Promise<DealMemberEntity | null> {
    const member = await prisma.dealMember.findUnique({ where: { id } });
    return member ? this.mapToEntity(member) : null;
  }

  async findByIdWithUser(id: string): Promise<TeamMemberWithUser | null> {
    const member = await prisma.dealMember.findUnique({
      where: { id },
      include: { user: { select: userSelect } },
    });
    if (!member) return null;
    return toUnifiedTeamMember(
      this.mapToEntity(member),
      CollaborationSourceType.DEAL,
      member.user
    );
  }

  async update(id: string, input: UpdateTeamMemberInput): Promise<DealMemberEntity> {
    const member = await prisma.dealMember.update({
      where: { id },
      data: {
        role: input.role,
        status: input.status,
        joinedAt: input.joinedAt,
        removedAt: input.removedAt,
      },
    });
    return this.mapToEntity(member);
  }

  async delete(id: string): Promise<void> {
    await prisma.dealMember.delete({ where: { id } });
  }

  async findByDealId(options: TeamMemberListOptions): Promise<{
    members: TeamMemberWithUser[];
    total: number;
  }> {
    const where: any = { dealId: options.featureId };
    if (options.status) where.status = options.status;
    if (options.role) where.role = options.role;
    if (!options.includeRemoved) {
      where.status = { not: TeamMemberStatus.REMOVED };
    }

    const [members, total] = await Promise.all([
      prisma.dealMember.findMany({
        where,
        include: { user: { select: userSelect } },
        skip: options.page ? (options.page - 1) * (options.limit || 20) : undefined,
        take: options.limit || 20,
        orderBy: { invitedAt: 'desc' },
      }),
      prisma.dealMember.count({ where }),
    ]);

    return {
      members: members.map((m) =>
        toUnifiedTeamMember(this.mapToEntity(m), CollaborationSourceType.DEAL, m.user)
      ),
      total,
    };
  }

  async findByUserId(userId: string): Promise<DealMemberEntity[]> {
    const members = await prisma.dealMember.findMany({
      where: { userId, status: { not: TeamMemberStatus.REMOVED } },
    });
    return members.map((m) => this.mapToEntity(m));
  }

  async findByDealAndUser(dealId: string, userId: string): Promise<DealMemberEntity | null> {
    const member = await prisma.dealMember.findUnique({
      where: { dealId_userId: { dealId, userId } },
    });
    return member ? this.mapToEntity(member) : null;
  }

  async findByDealAndEmail(dealId: string, email: string): Promise<DealMemberEntity | null> {
    const member = await prisma.dealMember.findUnique({
      where: { dealId_externalEmail: { dealId, externalEmail: email } },
    });
    return member ? this.mapToEntity(member) : null;
  }

  async findByInvitationToken(token: string): Promise<DealMemberEntity | null> {
    const member = await prisma.dealMember.findUnique({
      where: { invitationToken: token },
    });
    return member ? this.mapToEntity(member) : null;
  }

  async countByDealId(dealId: string, status?: TeamMemberStatus): Promise<number> {
    const where: any = { dealId };
    if (status) where.status = status;
    else where.status = { not: TeamMemberStatus.REMOVED };
    return prisma.dealMember.count({ where });
  }

  async countByUserId(userId: string): Promise<number> {
    return prisma.dealMember.count({
      where: { userId, status: { not: TeamMemberStatus.REMOVED } },
    });
  }

  private mapToEntity(member: any): DealMemberEntity {
    return {
      id: member.id,
      dealId: member.dealId,
      userId: member.userId,
      externalName: member.externalName,
      externalEmail: member.externalEmail,
      externalPhone: member.externalPhone,
      role: member.role as TeamMemberRole,
      status: member.status as TeamMemberStatus,
      invitationToken: member.invitationToken,
      invitedAt: member.invitedAt,
      joinedAt: member.joinedAt,
      removedAt: member.removedAt,
      createdAt: member.createdAt,
      updatedAt: member.updatedAt,
    };
  }
}

// ============================================================================
// Unified Team Member Repository (uses all above repositories)
// ============================================================================

export class PrismaUnifiedTeamMemberRepository implements IUnifiedTeamMemberRepository {
  private projectRepo = new PrismaProjectMemberRepository();
  private opportunityRepo = new PrismaOpportunityMemberRepository();
  private pitchRepo = new PrismaPitchMemberRepository();
  private dealRepo = new PrismaDealMemberRepository();

  async create(
    featureType: CollaborationSourceType,
    featureId: string,
    input: {
      userId?: string;
      externalName?: string;
      externalEmail?: string;
      externalPhone?: string;
      role?: TeamMemberRole;
    }
  ): Promise<TeamMemberWithUser> {
    let member;
    switch (featureType) {
      case CollaborationSourceType.PROJECT:
        member = await this.projectRepo.create({ projectId: featureId, ...input });
        return (await this.projectRepo.findByIdWithUser(member.id))!;
      case CollaborationSourceType.OPPORTUNITY:
        member = await this.opportunityRepo.create({ opportunityId: featureId, ...input });
        return (await this.opportunityRepo.findByIdWithUser(member.id))!;
      case CollaborationSourceType.PITCH:
        member = await this.pitchRepo.create({ pitchId: featureId, ...input });
        return (await this.pitchRepo.findByIdWithUser(member.id))!;
      case CollaborationSourceType.DEAL:
        member = await this.dealRepo.create({ dealId: featureId, ...input });
        return (await this.dealRepo.findByIdWithUser(member.id))!;
      default:
        throw new Error(`Unknown feature type: ${featureType}`);
    }
  }

  async findById(
    featureType: CollaborationSourceType,
    memberId: string
  ): Promise<TeamMemberWithUser | null> {
    switch (featureType) {
      case CollaborationSourceType.PROJECT:
        return this.projectRepo.findByIdWithUser(memberId);
      case CollaborationSourceType.OPPORTUNITY:
        return this.opportunityRepo.findByIdWithUser(memberId);
      case CollaborationSourceType.PITCH:
        return this.pitchRepo.findByIdWithUser(memberId);
      case CollaborationSourceType.DEAL:
        return this.dealRepo.findByIdWithUser(memberId);
      default:
        throw new Error(`Unknown feature type: ${featureType}`);
    }
  }

  async update(
    featureType: CollaborationSourceType,
    memberId: string,
    input: UpdateTeamMemberInput
  ): Promise<TeamMemberWithUser> {
    switch (featureType) {
      case CollaborationSourceType.PROJECT:
        await this.projectRepo.update(memberId, input);
        return (await this.projectRepo.findByIdWithUser(memberId))!;
      case CollaborationSourceType.OPPORTUNITY:
        await this.opportunityRepo.update(memberId, input);
        return (await this.opportunityRepo.findByIdWithUser(memberId))!;
      case CollaborationSourceType.PITCH:
        await this.pitchRepo.update(memberId, input);
        return (await this.pitchRepo.findByIdWithUser(memberId))!;
      case CollaborationSourceType.DEAL:
        await this.dealRepo.update(memberId, input);
        return (await this.dealRepo.findByIdWithUser(memberId))!;
      default:
        throw new Error(`Unknown feature type: ${featureType}`);
    }
  }

  async remove(featureType: CollaborationSourceType, memberId: string): Promise<void> {
    // Soft delete by updating status
    const input: UpdateTeamMemberInput = {
      status: TeamMemberStatus.REMOVED,
      removedAt: new Date(),
    };
    switch (featureType) {
      case CollaborationSourceType.PROJECT:
        await this.projectRepo.update(memberId, input);
        break;
      case CollaborationSourceType.OPPORTUNITY:
        await this.opportunityRepo.update(memberId, input);
        break;
      case CollaborationSourceType.PITCH:
        await this.pitchRepo.update(memberId, input);
        break;
      case CollaborationSourceType.DEAL:
        await this.dealRepo.update(memberId, input);
        break;
      default:
        throw new Error(`Unknown feature type: ${featureType}`);
    }
  }

  async listByFeature(
    featureType: CollaborationSourceType,
    featureId: string,
    options?: {
      status?: TeamMemberStatus;
      role?: TeamMemberRole;
      includeRemoved?: boolean;
    }
  ): Promise<TeamMemberWithUser[]> {
    const listOptions: TeamMemberListOptions = {
      featureId,
      status: options?.status,
      role: options?.role,
      includeRemoved: options?.includeRemoved,
      limit: 1000, // Get all members
    };

    switch (featureType) {
      case CollaborationSourceType.PROJECT:
        return (await this.projectRepo.findByProjectId(listOptions)).members;
      case CollaborationSourceType.OPPORTUNITY:
        return (await this.opportunityRepo.findByOpportunityId(listOptions)).members;
      case CollaborationSourceType.PITCH:
        return (await this.pitchRepo.findByPitchId(listOptions)).members;
      case CollaborationSourceType.DEAL:
        return (await this.dealRepo.findByDealId(listOptions)).members;
      default:
        throw new Error(`Unknown feature type: ${featureType}`);
    }
  }

  async findByInvitationToken(token: string): Promise<{
    featureType: CollaborationSourceType;
    member: TeamMemberWithUser;
  } | null> {
    // Check each feature type
    let member;

    member = await this.projectRepo.findByInvitationToken(token);
    if (member) {
      const withUser = await this.projectRepo.findByIdWithUser(member.id);
      if (withUser) return { featureType: CollaborationSourceType.PROJECT, member: withUser };
    }

    member = await this.opportunityRepo.findByInvitationToken(token);
    if (member) {
      const withUser = await this.opportunityRepo.findByIdWithUser(member.id);
      if (withUser) return { featureType: CollaborationSourceType.OPPORTUNITY, member: withUser };
    }

    member = await this.pitchRepo.findByInvitationToken(token);
    if (member) {
      const withUser = await this.pitchRepo.findByIdWithUser(member.id);
      if (withUser) return { featureType: CollaborationSourceType.PITCH, member: withUser };
    }

    member = await this.dealRepo.findByInvitationToken(token);
    if (member) {
      const withUser = await this.dealRepo.findByIdWithUser(member.id);
      if (withUser) return { featureType: CollaborationSourceType.DEAL, member: withUser };
    }

    return null;
  }

  async countByFeature(
    featureType: CollaborationSourceType,
    featureId: string,
    status?: TeamMemberStatus
  ): Promise<number> {
    switch (featureType) {
      case CollaborationSourceType.PROJECT:
        return this.projectRepo.countByProjectId(featureId, status);
      case CollaborationSourceType.OPPORTUNITY:
        return this.opportunityRepo.countByOpportunityId(featureId, status);
      case CollaborationSourceType.PITCH:
        return this.pitchRepo.countByPitchId(featureId, status);
      case CollaborationSourceType.DEAL:
        return this.dealRepo.countByDealId(featureId, status);
      default:
        throw new Error(`Unknown feature type: ${featureType}`);
    }
  }
}

// Export singleton instances
export const projectMemberRepository = new PrismaProjectMemberRepository();
export const opportunityMemberRepository = new PrismaOpportunityMemberRepository();
export const pitchMemberRepository = new PrismaPitchMemberRepository();
export const dealMemberRepository = new PrismaDealMemberRepository();
export const unifiedTeamMemberRepository = new PrismaUnifiedTeamMemberRepository();
