/**
 * Candidate Profile Controller
 *
 * CRUD operations for v3 Job Matching candidate profiles.
 */

import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../infrastructure/database/prisma/client';
import { AuthenticationError, NotFoundError, ValidationError } from '../../shared/errors';
import { logger } from '../../shared/logger';

export class CandidateProfileController {
  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new AuthenticationError('Authentication required');

      const {
        title, roleArea, seniority, location, desiredWorkMode, desiredEmploymentType,
        skills, profileSummaryPreferences, yearsOfExperience, availability,
        languages, certifications, industries, education, expectedSalary,
        noticePeriod, relevantExperience, fullName,
      } = req.body;

      if (!title || !roleArea || !seniority || !location || !profileSummaryPreferences) {
        throw new ValidationError('Missing required fields: title, roleArea, seniority, location, profileSummaryPreferences');
      }

      if (!skills || !Array.isArray(skills) || skills.length === 0) {
        throw new ValidationError('At least one skill is required');
      }

      if (!desiredWorkMode || !Array.isArray(desiredWorkMode) || desiredWorkMode.length === 0) {
        throw new ValidationError('At least one desired work mode is required');
      }

      if (!desiredEmploymentType || !Array.isArray(desiredEmploymentType) || desiredEmploymentType.length === 0) {
        throw new ValidationError('At least one desired employment type is required');
      }

      const orgId = req.orgContext?.organizationId || null;
      const dataQualityScore = computeCandidateDataQuality(req.body);

      const profile = await prisma.candidateProfile.create({
        data: {
          userId: req.user.userId,
          organizationId: orgId,
          fullName: fullName || null,
          title,
          roleArea,
          seniority,
          location,
          desiredWorkMode,
          desiredEmploymentType,
          skills,
          profileSummaryPreferences,
          yearsOfExperience: yearsOfExperience ?? null,
          availability: availability || null,
          languages: languages || [],
          certifications: certifications || [],
          industries: industries || [],
          education: education || [],
          expectedSalary: expectedSalary || null,
          noticePeriod: noticePeriod ?? null,
          relevantExperience: relevantExperience || [],
          tags: [],
          dataQualityScore,
        },
      });

      logger.info('Candidate profile created', { profileId: profile.id, userId: req.user.userId });
      res.status(201).json({ success: true, data: profile });
    } catch (error) {
      next(error);
    }
  }

  async getAll(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new AuthenticationError('Authentication required');

      const orgId = req.orgContext?.organizationId || null;
      const where: any = orgId
        ? { organizationId: orgId, isActive: true }
        : { userId: req.user.userId, isActive: true };

      const profiles = await prisma.candidateProfile.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        include: {
          _count: { select: { jobMatches: { where: { archived: false } } } },
        },
      });

      res.json({ success: true, data: profiles });
    } catch (error) {
      next(error);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new AuthenticationError('Authentication required');

      const profile = await prisma.candidateProfile.findUnique({
        where: { id: req.params.id },
        include: {
          jobMatches: {
            where: { archived: false },
            orderBy: { rank: 'asc' },
            take: 50,
          },
          _count: { select: { jobMatches: { where: { archived: false } } } },
        },
      });

      if (!profile) throw new NotFoundError('Candidate profile not found');
      if (profile.userId !== req.user.userId && profile.organizationId !== req.orgContext?.organizationId) {
        throw new AuthenticationError('Access denied');
      }

      res.json({ success: true, data: profile });
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new AuthenticationError('Authentication required');

      const existing = await prisma.candidateProfile.findUnique({ where: { id: req.params.id } });
      if (!existing) throw new NotFoundError('Candidate profile not found');
      if (existing.userId !== req.user.userId && existing.organizationId !== req.orgContext?.organizationId) {
        throw new AuthenticationError('Access denied');
      }

      const {
        title, roleArea, seniority, location, desiredWorkMode, desiredEmploymentType,
        skills, profileSummaryPreferences, yearsOfExperience, availability,
        languages, certifications, industries, education, expectedSalary,
        noticePeriod, relevantExperience, fullName, isActive,
      } = req.body;

      const updateData: any = {};
      if (title !== undefined) updateData.title = title;
      if (roleArea !== undefined) updateData.roleArea = roleArea;
      if (seniority !== undefined) updateData.seniority = seniority;
      if (location !== undefined) updateData.location = location;
      if (desiredWorkMode !== undefined) updateData.desiredWorkMode = desiredWorkMode;
      if (desiredEmploymentType !== undefined) updateData.desiredEmploymentType = desiredEmploymentType;
      if (skills !== undefined) updateData.skills = skills;
      if (profileSummaryPreferences !== undefined) updateData.profileSummaryPreferences = profileSummaryPreferences;
      if (yearsOfExperience !== undefined) updateData.yearsOfExperience = yearsOfExperience;
      if (availability !== undefined) updateData.availability = availability;
      if (languages !== undefined) updateData.languages = languages;
      if (certifications !== undefined) updateData.certifications = certifications;
      if (industries !== undefined) updateData.industries = industries;
      if (education !== undefined) updateData.education = education;
      if (expectedSalary !== undefined) updateData.expectedSalary = expectedSalary;
      if (noticePeriod !== undefined) updateData.noticePeriod = noticePeriod;
      if (relevantExperience !== undefined) updateData.relevantExperience = relevantExperience;
      if (fullName !== undefined) updateData.fullName = fullName;
      if (isActive !== undefined) updateData.isActive = isActive;

      const merged = { ...existing, ...updateData };
      updateData.dataQualityScore = computeCandidateDataQuality(merged);

      const profile = await prisma.candidateProfile.update({
        where: { id: req.params.id },
        data: updateData,
      });

      res.json({ success: true, data: profile });
    } catch (error) {
      next(error);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new AuthenticationError('Authentication required');

      const existing = await prisma.candidateProfile.findUnique({ where: { id: req.params.id } });
      if (!existing) throw new NotFoundError('Candidate profile not found');
      if (existing.userId !== req.user.userId && existing.organizationId !== req.orgContext?.organizationId) {
        throw new AuthenticationError('Access denied');
      }

      await prisma.candidateProfile.update({
        where: { id: req.params.id },
        data: { isActive: false },
      });

      res.json({ success: true, message: 'Candidate profile deleted' });
    } catch (error) {
      next(error);
    }
  }
}

function computeCandidateDataQuality(data: any): number {
  let score = 0;
  // Required fields (base 50)
  if (data.title) score += 7;
  if (data.roleArea) score += 7;
  if (data.seniority) score += 6;
  if (data.location) score += 6;
  if (data.desiredWorkMode?.length > 0) score += 6;
  if (data.desiredEmploymentType?.length > 0) score += 6;
  if (data.skills?.length > 0) score += 6;
  if (data.profileSummaryPreferences) score += 6;
  // Optional fields (up to 50 more)
  if (data.yearsOfExperience != null) score += 6;
  if (data.availability) score += 5;
  if (data.languages?.length > 0) score += 7;
  if (data.certifications?.length > 0) score += 5;
  if (data.industries?.length > 0) score += 6;
  if (data.education?.length > 0) score += 6;
  if (data.expectedSalary) score += 4;
  if (data.noticePeriod != null) score += 3;
  if (data.relevantExperience?.length > 0) score += 5;
  if (data.fullName) score += 3;
  return Math.min(100, score);
}
