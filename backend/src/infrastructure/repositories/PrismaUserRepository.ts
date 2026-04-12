/**
 * Prisma User Repository
 *
 * Database implementation of IUserRepository using Prisma.
 *
 * @module infrastructure/repositories/PrismaUserRepository
 */

import { prisma } from '../database/prisma/client';
import { IUserRepository } from '../../domain/repositories/IUserRepository';
import { User, UserId, UserProps } from '../../domain/entities/User';
import { createDefaultConsent } from '../../domain/value-objects';
import { ProficiencyLevel, Intensity, GoalType } from '../../domain/value-objects';

/**
 * Prisma User Repository implementation
 */
export class PrismaUserRepository implements IUserRepository {
  /**
   * Find user by ID
   */
  async findById(id: UserId): Promise<User | null> {
    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        userSectors: {
          include: { sector: true },
        },
        userSkills: {
          include: { skill: true },
        },
        userInterests: {
          include: { interest: true },
        },
        consentLogs: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!user) return null;

    return this.toDomainEntity(user);
  }

  /**
   * Find user by email
   */
  async findByEmail(email: string): Promise<User | null> {
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      include: {
        userSectors: {
          include: { sector: true },
        },
        userSkills: {
          include: { skill: true },
        },
        userInterests: {
          include: { interest: true },
        },
        consentLogs: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!user) return null;

    return this.toDomainEntity(user);
  }

  /**
   * Check if email exists
   */
  async emailExists(email: string): Promise<boolean> {
    const count = await prisma.user.count({
      where: { email: email.toLowerCase() },
    });
    return count > 0;
  }

  /**
   * Save user (create or update)
   */
  async save(user: User): Promise<User> {
    const props = user.toObject();

    // Check if user exists
    const existing = await prisma.user.findUnique({
      where: { id: props.id },
    });

    if (existing) {
      // Update existing user
      await prisma.$transaction(async (tx) => {
        // Update main user record
        await tx.user.update({
          where: { id: props.id },
          data: {
            email: props.email.toLowerCase(),
            passwordHash: props.passwordHash,
            fullName: props.name,
            title: props.title,
            firstName: props.firstName,
            middleName: props.middleName,
            lastName: props.lastName,
            phone: props.phone,
            company: props.company,
            jobTitle: props.jobTitle,
            bio: props.bio,
            avatarUrl: props.avatarUrl,
            linkedinUrl: props.linkedInUrl,
            websiteUrl: props.websiteUrl,
            location: props.location,
            timezone: props.preferredLocale,
            emailVerified: props.isEmailVerified,
            isActive: props.isActive,
            lastLoginAt: props.lastLoginAt,
            updatedAt: new Date(),
          },
        });

        // Update sectors
        await tx.userSector.deleteMany({ where: { userId: props.id } });
        if (props.sectors.length > 0) {
          await tx.userSector.createMany({
            data: props.sectors.map((s) => ({
              userId: props.id,
              sectorId: s.sectorId,
              isPrimary: s.isPrimary,
            })),
          });
        }

        // Update skills
        await tx.userSkill.deleteMany({ where: { userId: props.id } });
        if (props.skills.length > 0) {
          await tx.userSkill.createMany({
            data: props.skills.map((s) => ({
              userId: props.id,
              skillId: s.skillId,
              proficiencyLevel: s.proficiency as any,
            })),
          });
        }

        // Update interests
        await tx.userInterest.deleteMany({ where: { userId: props.id } });
        if (props.interests.length > 0) {
          await tx.userInterest.createMany({
            data: props.interests.map((i) => ({
              userId: props.id,
              interestId: i.interestId,
              intensity: i.intensity,
            })),
          });
        }

        // Update consent flags on user
        await tx.user.update({
          where: { id: props.id },
          data: {
            consentEnrichment: props.consent.allowEnrichment,
            consentAnalytics: props.consent.allowAnalytics,
          },
        });
      });
    } else {
      // Create new user
      await prisma.$transaction(async (tx) => {
        await tx.user.create({
          data: {
            id: props.id,
            email: props.email.toLowerCase(),
            passwordHash: props.passwordHash,
            fullName: props.name,
            title: props.title,
            firstName: props.firstName,
            middleName: props.middleName,
            lastName: props.lastName,
            phone: props.phone,
            company: props.company,
            jobTitle: props.jobTitle,
            bio: props.bio,
            avatarUrl: props.avatarUrl,
            linkedinUrl: props.linkedInUrl,
            websiteUrl: props.websiteUrl,
            location: props.location,
            timezone: props.preferredLocale,
            emailVerified: props.isEmailVerified,
            isActive: props.isActive,
          },
        });

        // Create sectors
        if (props.sectors.length > 0) {
          await tx.userSector.createMany({
            data: props.sectors.map((s) => ({
              userId: props.id,
              sectorId: s.sectorId,
              isPrimary: s.isPrimary,
            })),
          });
        }

        // Create skills
        if (props.skills.length > 0) {
          await tx.userSkill.createMany({
            data: props.skills.map((s) => ({
              userId: props.id,
              skillId: s.skillId,
              proficiencyLevel: s.proficiency as any,
            })),
          });
        }

        // Create interests
        if (props.interests.length > 0) {
          await tx.userInterest.createMany({
            data: props.interests.map((i) => ({
              userId: props.id,
              interestId: i.interestId,
              intensity: i.intensity,
            })),
          });
        }

        // Update consent flags on user
        await tx.user.update({
          where: { id: props.id },
          data: {
            consentEnrichment: props.consent.allowEnrichment,
            consentAnalytics: props.consent.allowAnalytics,
          },
        });
      });
    }

    // Return the saved user
    const savedUser = await this.findById(props.id);
    if (!savedUser) {
      throw new Error('Failed to save user');
    }
    return savedUser;
  }

  /**
   * Delete user
   */
  async delete(id: UserId): Promise<void> {
    await prisma.user.delete({
      where: { id },
    });
  }

  /**
   * Update user's last login timestamp
   */
  async updateLastLogin(id: UserId): Promise<void> {
    await prisma.user.update({
      where: { id },
      data: { lastLoginAt: new Date() },
    });
  }

  /**
   * Convert Prisma model to domain entity
   */
  private toDomainEntity(prismaUser: any): User {
    // Get consent from user flags
    const consent = {
      allowMatching: true, // Default to true, not stored in DB
      allowEnrichment: prismaUser.consentEnrichment ?? false,
      allowAnalytics: prismaUser.consentAnalytics ?? false,
      allowMarketing: false, // Not stored in current schema
      consentDate: prismaUser.updatedAt || prismaUser.createdAt,
    };

    const props: UserProps = {
      id: prismaUser.id,
      email: prismaUser.email,
      passwordHash: prismaUser.passwordHash,
      name: prismaUser.fullName,
      title: prismaUser.title || undefined,
      firstName: prismaUser.firstName || undefined,
      middleName: prismaUser.middleName || undefined,
      lastName: prismaUser.lastName || undefined,
      phone: prismaUser.phone || undefined,
      company: prismaUser.company || undefined,
      jobTitle: prismaUser.jobTitle || undefined,
      bio: prismaUser.bio || undefined,
      avatarUrl: prismaUser.avatarUrl || undefined,
      linkedInUrl: prismaUser.linkedinUrl || undefined,
      websiteUrl: prismaUser.websiteUrl || undefined,
      location: prismaUser.location || undefined,
      preferredLocale: prismaUser.timezone || 'en',
      consent,
      sectors: prismaUser.userSectors?.map((s: any) => ({
        sectorId: s.sectorId,
        isPrimary: s.isPrimary,
      })) || [],
      skills: prismaUser.userSkills?.map((s: any) => ({
        skillId: s.skillId,
        proficiency: s.proficiencyLevel as ProficiencyLevel,
      })) || [],
      interests: prismaUser.userInterests?.map((i: any) => ({
        interestId: i.interestId,
        intensity: i.intensity as Intensity,
      })) || [],
      goals: [], // Goals are stored separately
      isEmailVerified: prismaUser.emailVerified,
      isActive: prismaUser.isActive,
      lastLoginAt: prismaUser.lastLoginAt || undefined,
      createdAt: prismaUser.createdAt,
      updatedAt: prismaUser.updatedAt,
    };

    return User.fromPersistence(props);
  }
}
