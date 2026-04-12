/**
 * Suggestions Controller
 *
 * Handles profile improvement suggestions and skill gap analysis.
 *
 * @module presentation/controllers/SuggestionsController
 */

import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../infrastructure/database/prisma/client';
import { AuthenticationError, NotFoundError } from '../../shared/errors';
import { enhancedExplainabilityService } from '../../infrastructure/services/explainability';
import { logger } from '../../shared/logger';

export class SuggestionsController {
  /**
   * GET /api/v1/suggestions/profile-improvements
   * Analyze user profile and suggest improvements to get better matches
   */
  async getProfileImprovements(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AuthenticationError('Authentication required');
      }

      const userId = req.user.userId;
      const organizationId = (req as any).organizationId;

      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
          userSectors: { include: { sector: true } },
          userSkills: { include: { skill: true } },
          userGoals: { where: { isActive: true } },
          userInterests: { include: { interest: true } },
          userHobbies: { include: { hobby: true } },
        },
      });

      if (!user) {
        throw new NotFoundError('User not found');
      }

      const profile = {
        skills: user.userSkills.map(us => us.skill.name),
        sectors: user.userSectors.map(us => us.sector.name),
        goals: user.userGoals.map(ug => ug.goalType),
        bio: user.bio || undefined,
        jobTitle: user.jobTitle || undefined,
        interests: user.userInterests.map(ui => ui.interest.name),
        hobbies: user.userHobbies.map(uh => uh.hobby.name),
      };

      // Generate suggestions based on profile completeness and matching performance
      const suggestions = enhancedExplainabilityService.generateImprovementSuggestions(
        profile,
        [], // No criteria scores needed for profile-only analysis
        []
      );

      // Add profile completeness score
      let completeness = 0;
      if (user.bio && user.bio.length >= 50) completeness += 20;
      if (user.userSkills.length >= 3) completeness += 20;
      if (user.userSectors.length > 0) completeness += 15;
      if (user.userGoals.length > 0) completeness += 15;
      if (user.userInterests.length > 0) completeness += 10;
      if (user.userHobbies.length > 0) completeness += 10;
      if (user.jobTitle) completeness += 5;
      if (user.company) completeness += 5;

      res.json({
        success: true,
        data: {
          completeness,
          suggestions,
          profile: {
            skillCount: user.userSkills.length,
            sectorCount: user.userSectors.length,
            goalCount: user.userGoals.length,
            interestCount: user.userInterests.length,
            hobbyCount: user.userHobbies.length,
            hasBio: !!(user.bio && user.bio.length >= 50),
            hasJobTitle: !!user.jobTitle,
            hasCompany: !!user.company,
          },
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/suggestions/skill-gap/:contactId
   * Get skill gap analysis between user and a contact
   */
  async getSkillGap(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AuthenticationError('Authentication required');
      }

      const userId = req.user.userId;
      const { contactId } = req.params;
      const organizationId = (req as any).organizationId;

      // Get user skills
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
          userSkills: { include: { skill: true } },
        },
      });

      if (!user) {
        throw new NotFoundError('User not found');
      }

      // Get contact skills
      const whereClause: any = { id: contactId };
      if (organizationId) {
        whereClause.organizationId = organizationId;
      } else {
        whereClause.ownerId = userId;
      }

      const contact = await prisma.contact.findFirst({
        where: whereClause,
        include: {
          contactSkills: { include: { skill: true } },
        },
      });

      if (!contact) {
        throw new NotFoundError('Contact not found');
      }

      const userSkills = user.userSkills.map(us => us.skill.name);
      const contactSkills = contact.contactSkills.map(cs => cs.skill.name);

      const skillGap = enhancedExplainabilityService.generateSkillGapAnalysis(
        userSkills,
        contactSkills
      );

      res.json({
        success: true,
        data: {
          contactId,
          contactName: contact.fullName,
          userSkillCount: userSkills.length,
          contactSkillCount: contactSkills.length,
          ...skillGap,
        },
      });
    } catch (error) {
      next(error);
    }
  }
}

export const suggestionsController = new SuggestionsController();
