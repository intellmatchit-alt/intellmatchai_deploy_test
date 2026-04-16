/**
 * Hiring Profile Controller
 *
 * CRUD operations for v3 Job Matching hiring profiles.
 */

import { Request, Response, NextFunction } from "express";
import { prisma } from "../../infrastructure/database/prisma/client";
import {
  AuthenticationError,
  NotFoundError,
  ValidationError,
} from "../../shared/errors";
import { logger } from "../../shared/logger";

export class HiringProfileController {
  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new AuthenticationError("Authentication required");

      const {
        title,
        roleArea,
        seniority,
        location,
        workMode,
        employmentType,
        mustHaveSkills,
        preferredSkills,
        jobSummaryRequirements,
        minimumYearsExperience,
        hiringUrgency,
        industries,
        requiredLanguages,
        requiredCertifications,
        requiredEducationLevels,
        salaryRange,
        fullName,
      } = req.body;

      if (
        !title ||
        !roleArea ||
        !seniority ||
        !location ||
        !workMode ||
        !employmentType ||
        !jobSummaryRequirements
      ) {
        throw new ValidationError(
          "Missing required fields: title, roleArea, seniority, location, workMode, employmentType, jobSummaryRequirements",
        );
      }

      if (
        !mustHaveSkills ||
        !Array.isArray(mustHaveSkills) ||
        mustHaveSkills.length === 0
      ) {
        throw new ValidationError("At least one must-have skill is required");
      }

      const orgId = req.orgContext?.organizationId || null;
      const dataQualityScore = computeHiringDataQuality(req.body);

      const profile = await prisma.hiringProfile.create({
        data: {
          userId: req.user.userId,
          organizationId: orgId,
          fullName: fullName || null,
          title,
          roleArea,
          seniority,
          location,
          workMode,
          employmentType,
          mustHaveSkills: mustHaveSkills || [],
          preferredSkills: preferredSkills || [],
          jobSummaryRequirements,
          minimumYearsExperience: minimumYearsExperience ?? null,
          hiringUrgency: hiringUrgency || null,
          industries: industries || [],
          requiredLanguages: requiredLanguages || [],
          requiredCertifications: requiredCertifications || [],
          requiredEducationLevels: requiredEducationLevels || [],
          salaryRange: salaryRange || null,
          tags: [],
          excludedCandidates: [],
          dataQualityScore,
        },
      });

      logger.info("Hiring profile created", {
        profileId: profile.id,
        userId: req.user.userId,
      });
      res.status(201).json({ success: true, data: profile });
    } catch (error) {
      next(error);
    }
  }

  async getAll(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new AuthenticationError("Authentication required");

      const orgId = req.orgContext?.organizationId || null;
      const where: any = orgId
        ? { organizationId: orgId, isActive: true }
        : { userId: req.user.userId, isActive: true };

      const profiles = await prisma.hiringProfile.findMany({
        where,
        orderBy: { updatedAt: "desc" },
        include: {
          _count: { select: { jobMatches: { where: { archived: false } } } },
        },
      });

      res.json({ success: true, data: profiles });
    } catch (error) {
      next(error);
    }
  }

  async getById(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      if (!req.user) throw new AuthenticationError("Authentication required");

      const profile = await prisma.hiringProfile.findUnique({
        where: { id: String(req.params.id) },
        include: {
          jobMatches: {
            where: { archived: false },
            orderBy: { rank: "asc" },
            take: 50,
          },
          _count: { select: { jobMatches: { where: { archived: false } } } },
        },
      });

      if (!profile) throw new NotFoundError("Hiring profile not found");
      if (
        profile.userId !== req.user.userId &&
        profile.organizationId !== req.orgContext?.organizationId
      ) {
        throw new AuthenticationError("Access denied");
      }

      res.json({ success: true, data: profile });
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new AuthenticationError("Authentication required");

      const existing = await prisma.hiringProfile.findUnique({
        where: { id: String(req.params.id) },
      });
      if (!existing) throw new NotFoundError("Hiring profile not found");
      if (
        existing.userId !== req.user.userId &&
        existing.organizationId !== req.orgContext?.organizationId
      ) {
        throw new AuthenticationError("Access denied");
      }

      const {
        title,
        roleArea,
        seniority,
        location,
        workMode,
        employmentType,
        mustHaveSkills,
        preferredSkills,
        jobSummaryRequirements,
        minimumYearsExperience,
        hiringUrgency,
        industries,
        requiredLanguages,
        requiredCertifications,
        requiredEducationLevels,
        salaryRange,
        fullName,
        isActive,
      } = req.body;

      const updateData: any = {};
      if (title !== undefined) updateData.title = title;
      if (roleArea !== undefined) updateData.roleArea = roleArea;
      if (seniority !== undefined) updateData.seniority = seniority;
      if (location !== undefined) updateData.location = location;
      if (workMode !== undefined) updateData.workMode = workMode;
      if (employmentType !== undefined)
        updateData.employmentType = employmentType;
      if (mustHaveSkills !== undefined)
        updateData.mustHaveSkills = mustHaveSkills;
      if (preferredSkills !== undefined)
        updateData.preferredSkills = preferredSkills;
      if (jobSummaryRequirements !== undefined)
        updateData.jobSummaryRequirements = jobSummaryRequirements;
      if (minimumYearsExperience !== undefined)
        updateData.minimumYearsExperience = minimumYearsExperience;
      if (hiringUrgency !== undefined) updateData.hiringUrgency = hiringUrgency;
      if (industries !== undefined) updateData.industries = industries;
      if (requiredLanguages !== undefined)
        updateData.requiredLanguages = requiredLanguages;
      if (requiredCertifications !== undefined)
        updateData.requiredCertifications = requiredCertifications;
      if (requiredEducationLevels !== undefined)
        updateData.requiredEducationLevels = requiredEducationLevels;
      if (salaryRange !== undefined) updateData.salaryRange = salaryRange;
      if (fullName !== undefined) updateData.fullName = fullName;
      if (isActive !== undefined) updateData.isActive = isActive;

      // Recompute data quality
      const merged = { ...existing, ...updateData };
      updateData.dataQualityScore = computeHiringDataQuality(merged);

      const profile = await prisma.hiringProfile.update({
        where: { id: String(req.params.id) },
        data: updateData,
      });

      res.json({ success: true, data: profile });
    } catch (error) {
      next(error);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new AuthenticationError("Authentication required");

      const existing = await prisma.hiringProfile.findUnique({
        where: { id: String(req.params.id) },
      });
      if (!existing) throw new NotFoundError("Hiring profile not found");
      if (
        existing.userId !== req.user.userId &&
        existing.organizationId !== req.orgContext?.organizationId
      ) {
        throw new AuthenticationError("Access denied");
      }

      await prisma.hiringProfile.update({
        where: { id: String(req.params.id) },
        data: { isActive: false },
      });

      res.json({ success: true, message: "Hiring profile deleted" });
    } catch (error) {
      next(error);
    }
  }
}

function computeHiringDataQuality(data: any): number {
  let score = 0;
  // Required fields (base 50)
  if (data.title) score += 7;
  if (data.roleArea) score += 7;
  if (data.seniority) score += 6;
  if (data.location) score += 6;
  if (data.workMode) score += 6;
  if (data.employmentType) score += 6;
  if (data.mustHaveSkills?.length > 0) score += 6;
  if (data.jobSummaryRequirements) score += 6;
  // Optional fields (up to 50 more)
  if (data.preferredSkills?.length > 0) score += 7;
  if (data.minimumYearsExperience != null) score += 6;
  if (data.hiringUrgency) score += 5;
  if (data.industries?.length > 0) score += 6;
  if (data.requiredLanguages?.length > 0) score += 7;
  if (data.requiredCertifications?.length > 0) score += 5;
  if (data.requiredEducationLevels?.length > 0) score += 5;
  if (data.salaryRange) score += 5;
  if (data.fullName) score += 4;
  return Math.min(100, score);
}
