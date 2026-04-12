/**
 * Profile Controller
 *
 * Handles HTTP requests for user profile management.
 *
 * @module presentation/controllers/ProfileController
 */

import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../infrastructure/database/prisma/client.js';
import { AuthenticationError, ValidationError } from '../../shared/errors/index.js';
import { logger } from '../../shared/logger/index.js';
import { GoalType, ProficiencyLevel, Intensity, ConsentType, ConsentAction } from '@prisma/client';
import { normalizePhone, extractCountryCode } from '../../infrastructure/utils/phone.utils.js';

/**
 * Profile Controller
 *
 * Provides HTTP handlers for user profile operations.
 */
export class ProfileController {
  /**
   * Get current user's profile
   *
   * GET /api/v1/profile
   */
  async getProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AuthenticationError('Authentication required');
      }

      const user = await prisma.user.findUnique({
        where: { id: req.user.userId },
        select: {
          id: true,
          email: true,
          fullName: true,
          jobTitle: true,
          company: true,
          bio: true,
          avatarUrl: true,
          linkedinUrl: true,
          websiteUrl: true,
          phone: true,
          phoneCountryCode: true,
          location: true,
          timezone: true,
          consentEnrichment: true,
          consentContacts: true,
          consentAnalytics: true,
          emailVerified: true,
          createdAt: true,
          updatedAt: true,
          userSectors: {
            include: { sector: true },
            orderBy: { isPrimary: 'desc' },
          },
          userSkills: {
            include: { skill: true },
          },
          userInterests: {
            include: { interest: true },
          },
          userHobbies: {
            include: { hobby: true },
          },
          userGoals: {
            where: { isActive: true },
            orderBy: { priority: 'asc' },
          },
        },
      });

      if (!user) {
        res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'User not found' },
        });
        return;
      }

      // Transform the data for response
      const profile = {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        jobTitle: user.jobTitle,
        company: user.company,
        bio: user.bio,
        avatarUrl: user.avatarUrl,
        linkedinUrl: user.linkedinUrl,
        websiteUrl: user.websiteUrl,
        phone: user.phone,
        phoneCountryCode: user.phoneCountryCode,
        location: user.location,
        timezone: user.timezone,
        emailVerified: user.emailVerified,
        consent: {
          enrichment: user.consentEnrichment,
          contacts: user.consentContacts,
          analytics: user.consentAnalytics,
        },
        sectors: user.userSectors.map((us) => ({
          id: us.sector.id,
          name: us.sector.name,
          nameAr: us.sector.nameAr,
          isPrimary: us.isPrimary,
          experienceYears: us.experienceYears,
        })),
        skills: user.userSkills.map((us) => ({
          id: us.skill.id,
          name: us.skill.name,
          nameAr: us.skill.nameAr,
          category: us.skill.category,
          proficiencyLevel: us.proficiencyLevel,
          isVerified: us.isVerified,
        })),
        interests: user.userInterests.map((ui) => ({
          id: ui.interest.id,
          name: ui.interest.name,
          nameAr: ui.interest.nameAr,
          category: ui.interest.category,
          intensity: ui.intensity,
        })),
        hobbies: user.userHobbies.map((uh) => ({
          id: uh.hobby.id,
          name: uh.hobby.name,
          nameAr: uh.hobby.nameAr,
          category: uh.hobby.category,
          icon: uh.hobby.icon,
        })),
        goals: user.userGoals.map((ug) => ({
          id: ug.id,
          type: ug.goalType,
          description: ug.description,
          priority: ug.priority,
        })),
        createdAt: user.createdAt.toISOString(),
        updatedAt: user.updatedAt.toISOString(),
      };

      res.status(200).json({
        success: true,
        data: profile,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update user profile
   *
   * PUT /api/v1/profile
   */
  async updateProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AuthenticationError('Authentication required');
      }

      const {
        fullName,
        jobTitle,
        company,
        bio,
        linkedinUrl,
        websiteUrl,
        phone,
        phoneCountryCode,
        location,
        timezone,
      } = req.body;

      // Normalize phone number if provided
      let normalizedPhone = phone;
      let detectedCountryCode = phoneCountryCode;

      if (phone !== undefined && phone) {
        // Normalize to E.164 format
        normalizedPhone = normalizePhone(phone, phoneCountryCode) || phone;
        // Extract country code if not provided
        if (!detectedCountryCode) {
          detectedCountryCode = extractCountryCode(normalizedPhone);
        }
      }

      const user = await prisma.user.update({
        where: { id: req.user.userId },
        data: {
          ...(fullName && { fullName }),
          ...(jobTitle !== undefined && { jobTitle }),
          ...(company !== undefined && { company }),
          ...(bio !== undefined && { bio }),
          ...(linkedinUrl !== undefined && { linkedinUrl }),
          ...(websiteUrl !== undefined && { websiteUrl }),
          ...(phone !== undefined && { phone: normalizedPhone }),
          ...(detectedCountryCode !== undefined && { phoneCountryCode: detectedCountryCode }),
          ...(location !== undefined && { location }),
          ...(timezone !== undefined && { timezone }),
        },
        select: {
          id: true,
          email: true,
          fullName: true,
          jobTitle: true,
          company: true,
          bio: true,
          avatarUrl: true,
          linkedinUrl: true,
          websiteUrl: true,
          phone: true,
          phoneCountryCode: true,
          location: true,
          timezone: true,
        },
      });

      logger.info('Profile updated', { userId: req.user.userId });

      res.status(200).json({
        success: true,
        data: user,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update user sectors
   *
   * PUT /api/v1/profile/sectors
   *
   * Body: { sectors: [{ sectorId: string, isPrimary?: boolean, experienceYears?: number }] }
   */
  async updateSectors(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AuthenticationError('Authentication required');
      }

      const { sectors } = req.body;

      if (!Array.isArray(sectors)) {
        throw new ValidationError('sectors must be an array');
      }

      // Delete existing sectors
      await prisma.userSector.deleteMany({
        where: { userId: req.user.userId },
      });

      // Create new sector relationships
      if (sectors.length > 0) {
        await prisma.userSector.createMany({
          data: sectors.map((s: { sectorId: string; isPrimary?: boolean; experienceYears?: number }) => ({
            userId: req.user!.userId,
            sectorId: s.sectorId,
            isPrimary: s.isPrimary || false,
            experienceYears: s.experienceYears,
          })),
        });
      }

      // Fetch updated sectors
      const userSectors = await prisma.userSector.findMany({
        where: { userId: req.user.userId },
        include: { sector: true },
        orderBy: { isPrimary: 'desc' },
      });

      logger.info('User sectors updated', { userId: req.user.userId, count: sectors.length });

      res.status(200).json({
        success: true,
        data: {
          sectors: userSectors.map((us) => ({
            id: us.sector.id,
            name: us.sector.name,
            nameAr: us.sector.nameAr,
            isPrimary: us.isPrimary,
            experienceYears: us.experienceYears,
          })),
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update user skills
   *
   * PUT /api/v1/profile/skills
   *
   * Body: { skills: [{ skillId: string, proficiencyLevel?: string }] }
   */
  async updateSkills(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AuthenticationError('Authentication required');
      }

      const { skills } = req.body;

      if (!Array.isArray(skills)) {
        throw new ValidationError('skills must be an array');
      }

      // Delete existing skills
      await prisma.userSkill.deleteMany({
        where: { userId: req.user.userId },
      });

      // Create new skill relationships
      if (skills.length > 0) {
        await prisma.userSkill.createMany({
          data: skills.map((s: { skillId: string; proficiencyLevel?: ProficiencyLevel }) => ({
            userId: req.user!.userId,
            skillId: s.skillId,
            proficiencyLevel: s.proficiencyLevel,
          })),
        });
      }

      // Fetch updated skills
      const userSkills = await prisma.userSkill.findMany({
        where: { userId: req.user.userId },
        include: { skill: true },
      });

      logger.info('User skills updated', { userId: req.user.userId, count: skills.length });

      res.status(200).json({
        success: true,
        data: {
          skills: userSkills.map((us) => ({
            id: us.skill.id,
            name: us.skill.name,
            nameAr: us.skill.nameAr,
            category: us.skill.category,
            proficiencyLevel: us.proficiencyLevel,
            isVerified: us.isVerified,
          })),
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update user interests
   *
   * PUT /api/v1/profile/interests
   *
   * Body: { interests: [{ interestId: string, intensity?: string }] }
   */
  async updateInterests(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AuthenticationError('Authentication required');
      }

      const { interests } = req.body;

      if (!Array.isArray(interests)) {
        throw new ValidationError('interests must be an array');
      }

      // Delete existing interests
      await prisma.userInterest.deleteMany({
        where: { userId: req.user.userId },
      });

      // Create new interest relationships
      if (interests.length > 0) {
        await prisma.userInterest.createMany({
          data: interests.map((i: { interestId: string; intensity?: Intensity }) => ({
            userId: req.user!.userId,
            interestId: i.interestId,
            intensity: i.intensity || 'MODERATE',
          })),
        });
      }

      // Fetch updated interests
      const userInterests = await prisma.userInterest.findMany({
        where: { userId: req.user.userId },
        include: { interest: true },
      });

      logger.info('User interests updated', { userId: req.user.userId, count: interests.length });

      res.status(200).json({
        success: true,
        data: {
          interests: userInterests.map((ui) => ({
            id: ui.interest.id,
            name: ui.interest.name,
            nameAr: ui.interest.nameAr,
            category: ui.interest.category,
            intensity: ui.intensity,
          })),
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update user hobbies
   *
   * PUT /api/v1/profile/hobbies
   *
   * Body: { hobbies: [{ hobbyId: string }] }
   */
  async updateHobbies(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AuthenticationError('Authentication required');
      }

      const { hobbies } = req.body;

      if (!Array.isArray(hobbies)) {
        throw new ValidationError('hobbies must be an array');
      }

      // Delete existing hobbies
      await prisma.userHobby.deleteMany({
        where: { userId: req.user.userId },
      });

      // Create new hobby relationships
      if (hobbies.length > 0) {
        await prisma.userHobby.createMany({
          data: hobbies.map((h: { hobbyId: string }) => ({
            userId: req.user!.userId,
            hobbyId: h.hobbyId,
          })),
        });
      }

      // Fetch updated hobbies
      const userHobbies = await prisma.userHobby.findMany({
        where: { userId: req.user.userId },
        include: { hobby: true },
      });

      logger.info('User hobbies updated', { userId: req.user.userId, count: hobbies.length });

      res.status(200).json({
        success: true,
        data: {
          hobbies: userHobbies.map((uh) => ({
            id: uh.hobby.id,
            name: uh.hobby.name,
            nameAr: uh.hobby.nameAr,
            category: uh.hobby.category,
            icon: uh.hobby.icon,
          })),
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update networking goals
   *
   * PUT /api/v1/profile/goals
   *
   * Body: { goals: [{ type: GoalType, description?: string, priority?: number }] }
   */
  async updateGoals(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AuthenticationError('Authentication required');
      }

      const { goals } = req.body;

      if (!Array.isArray(goals)) {
        throw new ValidationError('goals must be an array');
      }

      // Deactivate existing goals
      await prisma.userGoal.updateMany({
        where: { userId: req.user.userId },
        data: { isActive: false },
      });

      // Create new goals
      if (goals.length > 0) {
        await prisma.userGoal.createMany({
          data: goals.map((g: { type: GoalType; description?: string; priority?: number }, index: number) => ({
            userId: req.user!.userId,
            goalType: g.type,
            description: g.description,
            priority: g.priority || index + 1,
            isActive: true,
          })),
        });
      }

      // Fetch updated goals
      const userGoals = await prisma.userGoal.findMany({
        where: { userId: req.user.userId, isActive: true },
        orderBy: { priority: 'asc' },
      });

      logger.info('User goals updated', { userId: req.user.userId, count: goals.length });

      res.status(200).json({
        success: true,
        data: {
          goals: userGoals.map((ug) => ({
            id: ug.id,
            type: ug.goalType,
            description: ug.description,
            priority: ug.priority,
          })),
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update consent settings
   *
   * PUT /api/v1/profile/consent
   *
   * Body: { enrichment?: boolean, contacts?: boolean, analytics?: boolean }
   */
  async updateConsent(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AuthenticationError('Authentication required');
      }

      const { enrichment, contacts, analytics } = req.body;

      // Get current consent values
      const currentUser = await prisma.user.findUnique({
        where: { id: req.user.userId },
        select: {
          consentEnrichment: true,
          consentContacts: true,
          consentAnalytics: true,
        },
      });

      if (!currentUser) {
        throw new AuthenticationError('User not found');
      }

      // Update user consent
      const user = await prisma.user.update({
        where: { id: req.user.userId },
        data: {
          ...(enrichment !== undefined && { consentEnrichment: enrichment }),
          ...(contacts !== undefined && { consentContacts: contacts }),
          ...(analytics !== undefined && { consentAnalytics: analytics }),
        },
        select: {
          consentEnrichment: true,
          consentContacts: true,
          consentAnalytics: true,
        },
      });

      // Log consent changes for GDPR compliance
      const ipAddress = req.ip || req.connection.remoteAddress;
      const userAgent = req.get('user-agent');
      const consentLogs: Array<{
        userId: string;
        consentType: ConsentType;
        action: ConsentAction;
        ipAddress: string | null;
        userAgent: string | null;
      }> = [];

      if (enrichment !== undefined && enrichment !== currentUser.consentEnrichment) {
        consentLogs.push({
          userId: req.user.userId,
          consentType: 'ENRICHMENT',
          action: enrichment ? 'GRANTED' : 'REVOKED',
          ipAddress: ipAddress || null,
          userAgent: userAgent || null,
        });
      }

      if (contacts !== undefined && contacts !== currentUser.consentContacts) {
        consentLogs.push({
          userId: req.user.userId,
          consentType: 'CONTACTS',
          action: contacts ? 'GRANTED' : 'REVOKED',
          ipAddress: ipAddress || null,
          userAgent: userAgent || null,
        });
      }

      if (analytics !== undefined && analytics !== currentUser.consentAnalytics) {
        consentLogs.push({
          userId: req.user.userId,
          consentType: 'ANALYTICS',
          action: analytics ? 'GRANTED' : 'REVOKED',
          ipAddress: ipAddress || null,
          userAgent: userAgent || null,
        });
      }

      if (consentLogs.length > 0) {
        await prisma.consentLog.createMany({ data: consentLogs });
      }

      logger.info('User consent updated', { userId: req.user.userId, changes: consentLogs.length });

      res.status(200).json({
        success: true,
        data: {
          consent: {
            enrichment: user.consentEnrichment,
            contacts: user.consentContacts,
            analytics: user.consentAnalytics,
          },
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Upload avatar image
   *
   * POST /api/v1/profile/avatar
   *
   * Expects multipart form with 'avatar' file field
   */
  async uploadAvatar(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AuthenticationError('Authentication required');
      }

      if (!req.file) {
        res.status(400).json({
          success: false,
          error: { code: 'NO_FILE', message: 'No avatar file uploaded' },
        });
        return;
      }

      // For now, store as base64 data URL (until storage service is implemented)
      // In production, this would use MinIO/S3
      const avatarUrl = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;

      const user = await prisma.user.update({
        where: { id: req.user.userId },
        data: { avatarUrl },
        select: { avatarUrl: true },
      });

      logger.info('Avatar uploaded', { userId: req.user.userId, size: req.file.size });

      res.status(200).json({
        success: true,
        data: { avatarUrl: user.avatarUrl },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Complete onboarding with all profile data
   *
   * POST /api/v1/profile/onboarding
   */
  async completeOnboarding(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AuthenticationError('Authentication required');
      }

      const {
        profile,
        company,
        jobTitle,
        location,
        sectors,
        customSectors,
        skills,
        customSkills,
        interests,
        customInterests,
        hobbies,
        customHobbies,
        goals,
        customGoals,
        bio,
        linkedInUrl,
        twitterUrl,
      } = req.body;

      // Start a transaction with extended timeout
      await prisma.$transaction(async (tx) => {
        // 1. Update profile info (support both nested profile object and top-level fields)
        const hasProfileData = profile || bio || company || jobTitle || location || linkedInUrl || twitterUrl;
        if (hasProfileData) {
          // Normalize phone number if provided
          let normalizedPhone = profile?.phone;
          let phoneCountryCodeValue = profile?.phoneCountryCode;
          if (profile?.phone) {
            normalizedPhone = normalizePhone(profile.phone, profile.phoneCountryCode) || profile.phone;
            if (!phoneCountryCodeValue) {
              phoneCountryCodeValue = extractCountryCode(normalizedPhone);
            }
          }

          await tx.user.update({
            where: { id: req.user!.userId },
            data: {
              ...(profile?.fullName && { fullName: profile.fullName }),
              ...((profile?.jobTitle !== undefined || jobTitle !== undefined) && { jobTitle: profile?.jobTitle || jobTitle }),
              ...((profile?.company !== undefined || company !== undefined) && { company: profile?.company || company }),
              ...(normalizedPhone !== undefined && { phone: normalizedPhone }),
              ...(phoneCountryCodeValue && { phoneCountryCode: phoneCountryCodeValue }),
              ...((profile?.location !== undefined || location !== undefined) && { location: profile?.location || location }),
              ...(bio !== undefined && { bio }),
              ...(linkedInUrl !== undefined && { linkedinUrl: linkedInUrl }),
              ...(twitterUrl !== undefined && { twitterUrl }),
            },
          });
        }

        // 2. Create custom sectors if provided (case-insensitive deduplication)
        const sectorIds = [...(sectors || [])];
        if (customSectors && customSectors.length > 0) {
          // Deduplicate custom sector names first
          const seenNames = new Set<string>();
          const uniqueCustomSectors = customSectors.filter((name: string) => {
            const normalized = name.toLowerCase().trim();
            if (seenNames.has(normalized)) return false;
            seenNames.add(normalized);
            return true;
          });

          for (const name of uniqueCustomSectors) {
            const trimmedName = name.trim();
            // Check if sector already exists (case-insensitive)
            const allSectors = await tx.sector.findMany({ where: { isActive: true } });
            let sector = allSectors.find(s => s.name.toLowerCase() === trimmedName.toLowerCase());
            if (!sector) {
              sector = await tx.sector.create({
                data: { name: trimmedName, isActive: true },
              });
            }
            // Only add if not already in the list
            if (!sectorIds.includes(sector.id)) {
              sectorIds.push(sector.id);
            }
          }
        }

        // 3. Update user sectors (deduplicate IDs first)
        const uniqueSectorIds = [...new Set(sectorIds)];
        if (uniqueSectorIds.length > 0) {
          await tx.userSector.deleteMany({ where: { userId: req.user!.userId } });
          await tx.userSector.createMany({
            data: uniqueSectorIds.map((sectorId: string, index: number) => ({
              userId: req.user!.userId,
              sectorId,
              isPrimary: index === 0,
            })),
            skipDuplicates: true,
          });
        }

        // 4. Create custom skills if provided (case-insensitive deduplication)
        const skillIds = [...(skills || [])];
        if (customSkills && customSkills.length > 0) {
          // Deduplicate custom skill names first
          const seenNames = new Set<string>();
          const uniqueCustomSkills = customSkills.filter((name: string) => {
            const normalized = name.toLowerCase().trim();
            if (seenNames.has(normalized)) return false;
            seenNames.add(normalized);
            return true;
          });

          for (const name of uniqueCustomSkills) {
            const trimmedName = name.trim();
            // Check if skill already exists (case-insensitive)
            const allSkills = await tx.skill.findMany({ where: { isActive: true } });
            let skill = allSkills.find(s => s.name.toLowerCase() === trimmedName.toLowerCase());
            if (!skill) {
              skill = await tx.skill.create({
                data: { name: trimmedName, isActive: true },
              });
            }
            // Only add if not already in the list
            if (!skillIds.includes(skill.id)) {
              skillIds.push(skill.id);
            }
          }
        }

        // 5. Update user skills (deduplicate IDs first)
        const uniqueSkillIds = [...new Set(skillIds)];
        if (uniqueSkillIds.length > 0) {
          await tx.userSkill.deleteMany({ where: { userId: req.user!.userId } });
          await tx.userSkill.createMany({
            data: uniqueSkillIds.map((skillId: string) => ({
              userId: req.user!.userId,
              skillId,
            })),
            skipDuplicates: true,
          });
        }

        // 6. Create custom interests if provided (case-insensitive deduplication)
        const interestIds = [...(interests || [])];
        if (customInterests && customInterests.length > 0) {
          // Deduplicate custom interest names first
          const seenNames = new Set<string>();
          const uniqueCustomInterests = customInterests.filter((name: string) => {
            const normalized = name.toLowerCase().trim();
            if (seenNames.has(normalized)) return false;
            seenNames.add(normalized);
            return true;
          });

          for (const name of uniqueCustomInterests) {
            const trimmedName = name.trim();
            // Check if interest already exists (case-insensitive)
            const allInterests = await tx.interest.findMany({ where: { isActive: true } });
            let interest = allInterests.find(i => i.name.toLowerCase() === trimmedName.toLowerCase());
            if (!interest) {
              interest = await tx.interest.create({
                data: { name: trimmedName, isActive: true },
              });
            }
            // Only add if not already in the list
            if (!interestIds.includes(interest.id)) {
              interestIds.push(interest.id);
            }
          }
        }

        // 7. Update user interests (deduplicate IDs first)
        const uniqueInterestIds = [...new Set(interestIds)];
        if (uniqueInterestIds.length > 0) {
          await tx.userInterest.deleteMany({ where: { userId: req.user!.userId } });
          await tx.userInterest.createMany({
            data: uniqueInterestIds.map((interestId: string) => ({
              userId: req.user!.userId,
              interestId,
              intensity: 'MODERATE' as Intensity,
            })),
            skipDuplicates: true,
          });
        }

        // 8. Create custom hobbies if provided (case-insensitive deduplication)
        const hobbyIds = [...(hobbies || [])];
        if (customHobbies && customHobbies.length > 0) {
          // Deduplicate custom hobby names first
          const seenNames = new Set<string>();
          const uniqueCustomHobbies = customHobbies.filter((name: string) => {
            const normalized = name.toLowerCase().trim();
            if (seenNames.has(normalized)) return false;
            seenNames.add(normalized);
            return true;
          });

          for (const name of uniqueCustomHobbies) {
            const trimmedName = name.trim();
            // Check if hobby already exists (case-insensitive)
            const allHobbies = await tx.hobby.findMany({ where: { isActive: true } });
            let hobby = allHobbies.find(h => h.name.toLowerCase() === trimmedName.toLowerCase());
            if (!hobby) {
              hobby = await tx.hobby.create({
                data: { name: trimmedName, isActive: true },
              });
            }
            // Only add if not already in the list
            if (!hobbyIds.includes(hobby.id)) {
              hobbyIds.push(hobby.id);
            }
          }
        }

        // 9. Update user hobbies (deduplicate IDs first)
        const uniqueHobbyIds = [...new Set(hobbyIds)];
        if (uniqueHobbyIds.length > 0) {
          await tx.userHobby.deleteMany({ where: { userId: req.user!.userId } });
          await tx.userHobby.createMany({
            data: uniqueHobbyIds.map((hobbyId: string) => ({
              userId: req.user!.userId,
              hobbyId,
            })),
            skipDuplicates: true,
          });
        }

        // 10. Update user goals (deduplicate goal types)
        // Map old goal IDs to new GoalType enum values for backwards compatibility
        const goalTypeMapping: Record<string, GoalType> = {
          'FIND_JOB': GoalType.JOB_SEEKING,
          'HIRE_TALENT': GoalType.HIRING,
          'FIND_COFOUNDER': GoalType.COLLABORATION,
          'FIND_INVESTOR': GoalType.INVESTMENT,
          'PITCH_PROJECT': GoalType.PARTNERSHIP,
          'FIND_CLIENTS': GoalType.SALES,
          'FIND_MENTOR': GoalType.MENTORSHIP,
          'EXPLORE_PARTNERSHIPS': GoalType.LEARNING,
        };

        const rawGoalTypes = goals || [];
        if (customGoals && customGoals.length > 0) {
          rawGoalTypes.push(...customGoals.map(() => 'OTHER'));
        }

        // Map old goal IDs to valid GoalType enum values
        const goalTypes = rawGoalTypes.map((g: string) => goalTypeMapping[g] || g);

        if (goalTypes.length > 0) {
          // Deduplicate goal types
          const seenGoals = new Set<string>();
          const uniqueGoalTypes: GoalType[] = [];
          const uniqueGoalDescriptions: (string | null)[] = [];

          goalTypes.forEach((goalType: GoalType, index: number) => {
            if (!seenGoals.has(goalType)) {
              seenGoals.add(goalType);
              uniqueGoalTypes.push(goalType);
              uniqueGoalDescriptions.push(customGoals?.[index - (goals?.length || 0)] || null);
            }
          });

          await tx.userGoal.updateMany({
            where: { userId: req.user!.userId },
            data: { isActive: false },
          });
          await tx.userGoal.createMany({
            data: uniqueGoalTypes.map((goalType: GoalType, index: number) => ({
              userId: req.user!.userId,
              goalType,
              description: uniqueGoalDescriptions[index],
              priority: index + 1,
              isActive: true,
            })),
          });
        }

        // Mark onboarding as completed
        await tx.user.update({
          where: { id: req.user!.userId },
          data: {
            onboardingStep: 6, // All steps completed
            onboardingCompletedAt: new Date(),
            onboardingData: null, // Clear partial progress data
          },
        });
      }, {
        maxWait: 30000, // 30 seconds max wait for transaction
        timeout: 60000, // 60 seconds timeout for transaction
      });

      logger.info('Onboarding completed', {
        userId: req.user.userId,
        sectorsCount: sectors?.length + (customSectors?.length || 0),
        skillsCount: skills?.length + (customSkills?.length || 0),
        interestsCount: interests?.length + (customInterests?.length || 0),
        hobbiesCount: hobbies?.length + (customHobbies?.length || 0),
        goalsCount: goals?.length + (customGoals?.length || 0),
      });

      res.status(200).json({
        success: true,
        message: 'Onboarding completed successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get onboarding progress
   *
   * GET /api/v1/profile/onboarding-progress
   *
   * Returns the user's current onboarding step and saved data
   */
  async getOnboardingProgress(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AuthenticationError('Authentication required');
      }

      const user = await prisma.user.findUnique({
        where: { id: req.user.userId },
        select: {
          onboardingStep: true,
          onboardingData: true,
          onboardingCompletedAt: true,
          // Also get current profile data to merge with saved progress
          fullName: true,
          company: true,
          jobTitle: true,
          location: true,
          phone: true,
          bio: true,
          linkedinUrl: true,
          twitterUrl: true,
          userSectors: {
            include: { sector: true },
          },
          userSkills: {
            include: { skill: true },
          },
          userInterests: {
            include: { interest: true },
          },
          userHobbies: {
            include: { hobby: true },
          },
          userGoals: {
            where: { isActive: true },
          },
        },
      });

      if (!user) {
        res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'User not found' },
        });
        return;
      }

      // Check what's already completed based on existing data
      const hasSocialOrCV = !!(user.phone || user.linkedinUrl || user.twitterUrl);
      const hasProfile = !!(user.company || user.jobTitle);
      const hasSectors = user.userSectors.length > 0;
      const hasSkillsOrInterests = user.userSkills.length > 0 || user.userInterests.length > 0;
      const hasHobbies = user.userHobbies.length > 0;
      const hasGoals = user.userGoals.length > 0;

      // Calculate completion percentage based on actual data (6 steps total)
      // Step 0: Social/CV, Step 1: Profile, Step 2: Sectors, Step 3: Skills/Interests, Step 4: Projects/Hobbies, Step 5: Goals
      const totalSteps = 6;
      let completedStepsCount = 0;
      if (hasSocialOrCV) completedStepsCount++;
      if (hasProfile) completedStepsCount++;
      if (hasSectors) completedStepsCount++;
      if (hasSkillsOrInterests) completedStepsCount++;
      if (hasHobbies) completedStepsCount++;
      if (hasGoals) completedStepsCount++;

      // Use the higher of: actual onboarding step vs calculated from data
      const calculatedStep = completedStepsCount;
      const currentStep = user.onboardingCompletedAt ? totalSteps : Math.max(user.onboardingStep, calculatedStep);
      const completionPercentage = Math.round((currentStep / totalSteps) * 100);

      // Consider completed if all steps done based on data OR marked as completed
      const isCompleted = !!user.onboardingCompletedAt || completedStepsCount >= totalSteps;

      res.status(200).json({
        success: true,
        data: {
          currentStep,
          completionPercentage,
          isCompleted,
          completedAt: user.onboardingCompletedAt,
          savedData: user.onboardingData,
          // Current profile state
          profile: {
            fullName: user.fullName,
            company: user.company,
            jobTitle: user.jobTitle,
            location: user.location,
            phone: user.phone,
            bio: user.bio,
            linkedinUrl: user.linkedinUrl,
            twitterUrl: user.twitterUrl,
          },
          sectors: user.userSectors.map(us => ({
            id: us.sectorId,
            name: us.sector.name,
          })),
          skills: user.userSkills.map(us => ({
            id: us.skillId,
            name: us.skill.name,
          })),
          interests: user.userInterests.map(ui => ({
            id: ui.interestId,
            name: ui.interest.name,
          })),
          hobbies: user.userHobbies.map(uh => ({
            id: uh.hobbyId,
            name: uh.hobby.name,
          })),
          goals: user.userGoals.map(ug => ug.goalType),
          // Step completion status
          stepStatus: {
            social: hasSocialOrCV,
            profile: hasProfile,
            sectors: hasSectors,
            skills: hasSkillsOrInterests,
            projects: hasHobbies, // Hobbies/Projects step
            objectives: hasGoals,
          },
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Save onboarding progress (partial save)
   *
   * POST /api/v1/profile/onboarding-progress
   *
   * Saves partial onboarding data when user clicks "Skip for now"
   * or navigates away from onboarding
   */
  async saveOnboardingProgress(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AuthenticationError('Authentication required');
      }

      const {
        currentStep,
        socialData,
        profile,
        bio,
        enrichmentData,
        selectedSectors,
        selectedSkills,
        selectedInterests,
        selectedHobbies,
        selectedGoals,
        customSectors,
        customSkills,
        customInterests,
        customHobbies,
        customGoals,
        projects,
      } = req.body;

      // Save the current step and all partial data
      const onboardingData = {
        socialData,
        profile,
        bio,
        enrichmentData,
        selectedSectors,
        selectedSkills,
        selectedInterests,
        selectedHobbies,
        selectedGoals,
        customSectors,
        customSkills,
        customInterests,
        customHobbies,
        customGoals,
        projects,
        savedAt: new Date().toISOString(),
      };

      // Also save some profile fields immediately
      const profileUpdates: Record<string, any> = {
        onboardingStep: currentStep || 0,
        onboardingData,
      };

      // Save basic profile data if provided
      if (profile?.company) profileUpdates.company = profile.company;
      if (profile?.jobTitle) profileUpdates.jobTitle = profile.jobTitle;
      if (profile?.location) profileUpdates.location = profile.location;
      if (socialData?.phone) profileUpdates.phone = socialData.phone;
      if (socialData?.linkedinUrl) profileUpdates.linkedinUrl = socialData.linkedinUrl;
      if (socialData?.twitterUrl) profileUpdates.twitterUrl = socialData.twitterUrl;
      if (bio) profileUpdates.bio = bio;

      await prisma.user.update({
        where: { id: req.user.userId },
        data: profileUpdates,
      });

      logger.info('Onboarding progress saved', {
        userId: req.user.userId,
        step: currentStep,
      });

      res.status(200).json({
        success: true,
        message: 'Progress saved',
        data: {
          currentStep,
          savedAt: onboardingData.savedAt,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Delete user account
   *
   * DELETE /api/v1/profile
   */
  async deleteAccount(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AuthenticationError('Authentication required');
      }

      // Soft delete by deactivating the account
      await prisma.user.update({
        where: { id: req.user.userId },
        data: { isActive: false },
      });

      // Revoke all refresh tokens
      await prisma.refreshToken.updateMany({
        where: { userId: req.user.userId },
        data: { revokedAt: new Date() },
      });

      logger.info('Account deactivated', { userId: req.user.userId });

      res.status(200).json({
        success: true,
        message: 'Account has been deactivated',
      });
    } catch (error) {
      next(error);
    }
  }
}

// Export singleton instance
export const profileController = new ProfileController();
