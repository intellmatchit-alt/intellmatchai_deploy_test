/**
 * Opportunity Controller
 *
 * Handles HTTP requests for job opportunity matching endpoints.
 * Supports multiple opportunities per user (like Projects).
 *
 * @module presentation/controllers/OpportunityController
 */

import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../infrastructure/database/prisma/client';
import { createOpportunityMatchingService } from '../../infrastructure/external/opportunities/services/opportunity-matching.service';
import { runV3MatchingForOpportunity } from '../../infrastructure/external/opportunities/services/opportunity-v3-bridge';
import { AuthenticationError, NotFoundError, ValidationError } from '../../shared/errors';
import { logger } from '../../shared/logger';
import {
  OpportunityIntentType,
  OpportunityVisibility,
  OpportunityMatchStatus,
  SeniorityLevel,
} from '@prisma/client';

/**
 * Opportunity Controller
 *
 * Provides HTTP handlers for opportunity CRUD and matching operations.
 */
export class OpportunityController {
  /**
   * List all user's opportunities
   *
   * GET /api/v1/opportunities
   *
   * Query params:
   * - page: page number (default 1)
   * - limit: items per page (default 20)
   * - status: filter by isActive (active, inactive, all)
   */
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AuthenticationError('Authentication required');
      }

      const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 20));
      const status = req.query.status as string;

      // Scope by organization context
      const orgId = req.orgContext?.organizationId || null;
      const where: any = orgId
        ? { organizationId: orgId }
        : { userId: req.user.userId, organizationId: null };

      if (status === 'active') {
        where.isActive = true;
      } else if (status === 'inactive') {
        where.isActive = false;
      }

      const [opportunities, total] = await Promise.all([
        prisma.opportunityIntent.findMany({
          where,
          include: {
            sectorPrefs: { include: { sector: true } },
            skillPrefs: { include: { skill: true } },
            _count: { select: { matches: true } },
          },
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.opportunityIntent.count({ where }),
      ]);

      const formattedOpportunities = opportunities.map((opp) => ({
        id: opp.id,
        title: opp.title,
        intentType: opp.intentType,
        roleArea: opp.roleArea,
        seniority: opp.seniority,
        locationPref: opp.locationPref,
        remoteOk: opp.remoteOk,
        visibility: opp.visibility,
        isActive: opp.isActive,
        matchCount: opp._count.matches,
        lastMatchedAt: opp.lastMatchedAt,
        createdAt: opp.createdAt,
        sectors: opp.sectorPrefs.map((sp) => sp.sector),
        skills: opp.skillPrefs.map((sp) => ({ ...sp.skill, isRequired: sp.isRequired })),
      }));

      res.status(200).json({
        success: true,
        data: {
          opportunities: formattedOpportunities,
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
          },
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Create a new opportunity
   *
   * POST /api/v1/opportunities
   *
   * Body:
   * - title: string (required)
   * - intentType: OpportunityIntentType (required)
   * - roleArea?: string
   * - seniority?: SeniorityLevel
   * - locationPref?: string
   * - remoteOk?: boolean
   * - notes?: string
   * - visibility?: OpportunityVisibility
   * - sectorIds?: string[]
   * - skillIds?: string[]
   */
  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AuthenticationError('Authentication required');
      }

      const {
        title,
        intentType,
        roleArea,
        seniority,
        locationPref,
        remoteOk = true,
        notes,
        visibility = 'PRIVATE',
        sectorIds = [],
        skillIds = [],
        mustHaveSkillIds = [],
        preferredSkillIds = [],
        workMode,
        employmentType,
        urgencyOrAvailability,
        minExperienceYears,
        languages,
        certifications,
        educationLevels,
        industries,
        salaryMin,
        salaryMax,
        salaryCurrency,
        noticePeriod,
        relevantExperience,
      } = req.body;

      if (!title) {
        throw new ValidationError('Title is required');
      }

      if (!intentType) {
        throw new ValidationError('Intent type is required');
      }

      // Validate intent type
      const validIntentTypes: OpportunityIntentType[] = [
        'HIRING',
        'OPEN_TO_OPPORTUNITIES',
        'ADVISORY_BOARD',
        'REFERRALS_ONLY',
      ];
      if (!validIntentTypes.includes(intentType)) {
        throw new ValidationError(`Invalid intent type. Must be one of: ${validIntentTypes.join(', ')}`);
      }

      // Validate visibility
      const validVisibilities: OpportunityVisibility[] = ['PRIVATE', 'LIMITED', 'TEAM'];
      if (visibility && !validVisibilities.includes(visibility)) {
        throw new ValidationError(`Invalid visibility. Must be one of: ${validVisibilities.join(', ')}`);
      }

      // Validate seniority if provided
      if (seniority) {
        const validSeniorities: SeniorityLevel[] = [
          'ENTRY', 'MID', 'SENIOR', 'LEAD', 'DIRECTOR', 'VP', 'C_LEVEL', 'BOARD',
        ];
        if (!validSeniorities.includes(seniority)) {
          throw new ValidationError(`Invalid seniority. Must be one of: ${validSeniorities.join(', ')}`);
        }
      }

      // Resolve skills: support split (mustHave + preferred) or legacy flat skillIds
      const resolvedMustHave: string[] = mustHaveSkillIds.length > 0 ? mustHaveSkillIds : skillIds;
      const resolvedPreferred: string[] = mustHaveSkillIds.length > 0 ? preferredSkillIds : [];

      // Create opportunity
      const opportunity = await prisma.opportunityIntent.create({
        data: {
          userId: req.user.userId,
          title,
          intentType: intentType as OpportunityIntentType,
          roleArea,
          seniority: seniority as SeniorityLevel | null,
          locationPref,
          remoteOk,
          notes,
          visibility: visibility as OpportunityVisibility,
          workMode,
          employmentType,
          urgencyOrAvailability,
          minExperienceYears: minExperienceYears !== undefined ? parseInt(minExperienceYears, 10) || null : undefined,
          languages: languages || undefined,
          certifications: certifications || undefined,
          educationLevels: educationLevels || undefined,
          industries: industries || undefined,
          salaryMin: salaryMin != null ? parseInt(String(salaryMin), 10) || null : undefined,
          salaryMax: salaryMax != null ? parseInt(String(salaryMax), 10) || null : undefined,
          salaryCurrency: salaryCurrency || undefined,
          noticePeriod: noticePeriod || undefined,
          relevantExperience: relevantExperience || undefined,
          sectorPrefs: {
            create: sectorIds.map((sectorId: string) => ({ sectorId })),
          },
          skillPrefs: {
            create: [
              ...resolvedMustHave.map((skillId: string) => ({ skillId, isRequired: true })),
              ...resolvedPreferred.map((skillId: string) => ({ skillId, isRequired: false })),
            ],
          },
        },
        include: {
          sectorPrefs: { include: { sector: true } },
          skillPrefs: { include: { skill: true } },
        },
      });

      // If in org mode, set the organizationId on the opportunity
      if (req.orgContext?.organizationId) {
        await prisma.opportunityIntent.update({
          where: { id: opportunity.id },
          data: { organizationId: req.orgContext.organizationId },
        });
      }

      logger.info('Opportunity created', {
        userId: req.user.userId,
        opportunityId: opportunity.id,
        intentType: opportunity.intentType,
      });

      res.status(201).json({
        success: true,
        data: {
          ...opportunity,
          sectors: opportunity.sectorPrefs.map((sp) => sp.sector),
          skills: opportunity.skillPrefs.map((sp) => ({ ...sp.skill, isRequired: sp.isRequired })),
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get single opportunity by ID
   *
   * GET /api/v1/opportunities/:id
   */
  async get(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AuthenticationError('Authentication required');
      }

      // Scope by organization context
      const orgId = req.orgContext?.organizationId || null;
      const ownerFilter = orgId
        ? { organizationId: orgId }
        : { userId: req.user.userId };

      const opportunity = await prisma.opportunityIntent.findFirst({
        where: {
          id: req.params.id,
          ...ownerFilter,
        },
        include: {
          sectorPrefs: { include: { sector: true } },
          skillPrefs: { include: { skill: true } },
          _count: { select: { matches: true } },
        },
      });

      if (!opportunity) {
        throw new NotFoundError('Opportunity not found');
      }

      res.status(200).json({
        success: true,
        data: {
          ...opportunity,
          sectors: opportunity.sectorPrefs.map((sp) => sp.sector),
          skills: opportunity.skillPrefs.map((sp) => ({ ...sp.skill, isRequired: sp.isRequired })),
          matchCount: opportunity._count.matches,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update opportunity
   *
   * PUT /api/v1/opportunities/:id
   */
  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AuthenticationError('Authentication required');
      }

      // Scope by organization context
      const orgId = req.orgContext?.organizationId || null;
      const ownerFilter = orgId
        ? { organizationId: orgId }
        : { userId: req.user.userId };

      const existing = await prisma.opportunityIntent.findFirst({
        where: {
          id: req.params.id,
          ...ownerFilter,
        },
      });

      if (!existing) {
        throw new NotFoundError('Opportunity not found');
      }

      const {
        title,
        intentType,
        roleArea,
        seniority,
        locationPref,
        remoteOk,
        notes,
        visibility,
        isActive,
        sectorIds,
        skillIds,
        mustHaveSkillIds,
        preferredSkillIds,
        workMode,
        employmentType,
        urgencyOrAvailability,
        minExperienceYears,
        languages,
        certifications,
        educationLevels,
        industries,
        salaryMin,
        salaryMax,
        salaryCurrency,
        noticePeriod,
        relevantExperience,
      } = req.body;

      // Determine if skills are being updated (new split or legacy flat)
      const hasNewSkills = mustHaveSkillIds !== undefined || skillIds !== undefined;

      // Delete old preferences if new ones provided
      if (sectorIds !== undefined) {
        await prisma.opportunityIntentSector.deleteMany({
          where: { intentId: req.params.id },
        });
      }
      if (hasNewSkills) {
        await prisma.opportunityIntentSkill.deleteMany({
          where: { intentId: req.params.id },
        });
      }

      // Resolve skills: support split (mustHave + preferred) or legacy flat skillIds
      let skillCreateData: Array<{ skillId: string; isRequired: boolean }> | undefined;
      if (hasNewSkills) {
        const resolvedMustHave: string[] = mustHaveSkillIds?.length > 0 ? mustHaveSkillIds : (skillIds || []);
        const resolvedPreferred: string[] = mustHaveSkillIds?.length > 0 ? (preferredSkillIds || []) : [];
        skillCreateData = [
          ...resolvedMustHave.map((skillId: string) => ({ skillId, isRequired: true })),
          ...resolvedPreferred.map((skillId: string) => ({ skillId, isRequired: false })),
        ];
      }

      const opportunity = await prisma.opportunityIntent.update({
        where: { id: req.params.id },
        data: {
          ...(title !== undefined && { title }),
          ...(intentType !== undefined && { intentType: intentType as OpportunityIntentType }),
          ...(roleArea !== undefined && { roleArea }),
          ...(seniority !== undefined && { seniority: seniority as SeniorityLevel }),
          ...(locationPref !== undefined && { locationPref }),
          ...(remoteOk !== undefined && { remoteOk }),
          ...(notes !== undefined && { notes }),
          ...(visibility !== undefined && { visibility: visibility as OpportunityVisibility }),
          ...(isActive !== undefined && { isActive }),
          ...(workMode !== undefined && { workMode }),
          ...(employmentType !== undefined && { employmentType }),
          ...(urgencyOrAvailability !== undefined && { urgencyOrAvailability }),
          ...(minExperienceYears !== undefined && { minExperienceYears: parseInt(minExperienceYears, 10) || null }),
          ...(languages !== undefined && { languages }),
          ...(certifications !== undefined && { certifications }),
          ...(educationLevels !== undefined && { educationLevels }),
          ...(industries !== undefined && { industries }),
          ...(salaryMin !== undefined && { salaryMin: salaryMin != null ? parseInt(String(salaryMin), 10) || null : null }),
          ...(salaryMax !== undefined && { salaryMax: salaryMax != null ? parseInt(String(salaryMax), 10) || null : null }),
          ...(salaryCurrency !== undefined && { salaryCurrency: salaryCurrency || null }),
          ...(noticePeriod !== undefined && { noticePeriod: noticePeriod || null }),
          ...(relevantExperience !== undefined && { relevantExperience: relevantExperience || null }),
          ...(sectorIds !== undefined && {
            sectorPrefs: { create: sectorIds.map((sectorId: string) => ({ sectorId })) },
          }),
          ...(skillCreateData && {
            skillPrefs: { create: skillCreateData },
          }),
        },
        include: {
          sectorPrefs: { include: { sector: true } },
          skillPrefs: { include: { skill: true } },
        },
      });

      logger.info('Opportunity updated', {
        userId: req.user.userId,
        opportunityId: opportunity.id,
      });

      res.status(200).json({
        success: true,
        data: {
          ...opportunity,
          sectors: opportunity.sectorPrefs.map((sp) => sp.sector),
          skills: opportunity.skillPrefs.map((sp) => ({ ...sp.skill, isRequired: sp.isRequired })),
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Delete opportunity
   *
   * DELETE /api/v1/opportunities/:id
   */
  async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AuthenticationError('Authentication required');
      }

      // Scope by organization context
      const orgId = req.orgContext?.organizationId || null;
      const ownerFilter = orgId
        ? { organizationId: orgId }
        : { userId: req.user.userId };

      const existing = await prisma.opportunityIntent.findFirst({
        where: {
          id: req.params.id,
          ...ownerFilter,
        },
      });

      if (!existing) {
        throw new NotFoundError('Opportunity not found');
      }

      await prisma.opportunityIntent.delete({
        where: { id: req.params.id },
      });

      logger.info('Opportunity deleted', {
        userId: req.user.userId,
        opportunityId: req.params.id,
      });

      res.status(200).json({
        success: true,
        message: 'Opportunity deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Find matches for a specific opportunity
   *
   * POST /api/v1/opportunities/:id/find-matches
   */
  async findMatches(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AuthenticationError('Authentication required');
      }

      // Scope by organization context
      const orgId = req.orgContext?.organizationId || null;
      const ownerFilter = orgId
        ? { organizationId: orgId }
        : { userId: req.user.userId };

      const opportunity = await prisma.opportunityIntent.findFirst({
        where: {
          id: req.params.id,
          ...ownerFilter,
          isActive: true,
        },
      });

      if (!opportunity) {
        throw new NotFoundError('Active opportunity not found');
      }

      // Run v3 matching pipeline via bridge (converts old data model → v3 engine)
      const matchOrgId = req.orgContext?.organizationId || undefined;
      await runV3MatchingForOpportunity(prisma, req.user.userId, req.params.id, matchOrgId);

      // Fetch the saved matches with full candidate info
      const savedMatches = await prisma.opportunityMatch.findMany({
        where: { intentId: opportunity.id },
        include: {
          matchedUser: {
            select: {
              id: true,
              fullName: true,
              jobTitle: true,
              company: true,
              avatarUrl: true,
              location: true,
              bio: true,
              linkedinUrl: true,
            },
          },
          matchedContact: {
            select: {
              id: true,
              fullName: true,
              jobTitle: true,
              company: true,
              location: true,
              email: true,
              phone: true,
            },
          },
        },
        orderBy: { matchScore: 'desc' },
        take: 30,
      });

      const formattedMatches = savedMatches.map((match) => ({
        id: match.id,
        opportunityId: opportunity.id,
        matchScore: match.matchScore,
        matchType: match.matchType,
        matchLevel: (match as any).matchLevel || null,
        confidence: (match as any).confidence || null,
        hardFilterStatus: (match as any).hardFilterStatus || null,
        isSparseProfile: (match as any).isSparseProfile || false,
        status: match.status,
        reasons: match.reasons,
        risks: (match as any).risks || [],
        missingSkills: (match as any).missingSkills || [],
        explanation: (match as any).explanation || null,
        suggestedAction: match.suggestedAction,
        suggestedMessage: match.suggestedMessage,
        nextSteps: match.nextSteps,
        sharedSectors: match.sharedSectors,
        sharedSkills: match.sharedSkills,
        intentAlignment: match.intentAlignment,
        aiValidated: (match as any).aiValidated || false,
        aiNotes: (match as any).aiNotes || null,
        contactedAt: match.contactedAt,
        createdAt: match.createdAt,
        candidate:
          match.matchType === 'user'
            ? { type: 'user', ...match.matchedUser }
            : { type: 'contact', ...match.matchedContact },
      }));

      logger.info('Opportunity matches found', {
        userId: req.user.userId,
        opportunityId: opportunity.id,
        matchCount: formattedMatches.length,
      });

      res.status(200).json({
        success: true,
        data: {
          matchCount: formattedMatches.length,
          matches: formattedMatches,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get matches for a specific opportunity
   *
   * GET /api/v1/opportunities/:id/matches
   *
   * Query params:
   * - status: filter by status
   * - minScore: minimum match score
   * - limit: number of results
   */
  async getMatches(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AuthenticationError('Authentication required');
      }

      const status = req.query.status as string;
      const minScore = parseFloat(req.query.minScore as string) || 0;
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 30));

      // Scope by organization context
      const orgId = req.orgContext?.organizationId || null;
      const ownerFilter = orgId
        ? { organizationId: orgId }
        : { userId: req.user.userId };

      const opportunity = await prisma.opportunityIntent.findFirst({
        where: {
          id: req.params.id,
          ...ownerFilter,
        },
      });

      if (!opportunity) {
        throw new NotFoundError('Opportunity not found');
      }

      const where: any = {
        intentId: opportunity.id,
        matchScore: { gte: minScore },
      };

      if (status) {
        where.status = status as OpportunityMatchStatus;
      } else {
        where.status = { notIn: ['DISMISSED', 'ARCHIVED'] as OpportunityMatchStatus[] };
      }

      const matches = await prisma.opportunityMatch.findMany({
        where,
        include: {
          matchedUser: {
            select: {
              id: true,
              fullName: true,
              jobTitle: true,
              company: true,
              avatarUrl: true,
              location: true,
              bio: true,
              email: true,
              phone: true,
              linkedinUrl: true,
            },
          },
          matchedContact: {
            select: {
              id: true,
              fullName: true,
              jobTitle: true,
              company: true,
              location: true,
              email: true,
              phone: true,
              linkedinUrl: true,
            },
          },
        },
        orderBy: { matchScore: 'desc' },
        take: limit,
      });

      const formattedMatches = matches.map((match) => ({
        id: match.id,
        opportunityId: opportunity.id,
        matchScore: match.matchScore,
        matchType: match.matchType,
        matchLevel: (match as any).matchLevel || null,
        confidence: (match as any).confidence || null,
        confidenceScore: (match as any).confidenceScore || null,
        hardFilterStatus: (match as any).hardFilterStatus || null,
        status: match.status,
        reasons: match.reasons,
        risks: (match as any).risks || [],
        missingSkills: (match as any).missingSkills || [],
        explanation: (match as any).explanation || null,
        scoreBreakdown: (match as any).scoreBreakdown || null,
        suggestedAction: match.suggestedAction,
        suggestedMessage: match.suggestedMessage,
        nextSteps: match.nextSteps,
        sharedSectors: match.sharedSectors,
        sharedSkills: match.sharedSkills,
        intentAlignment: match.intentAlignment,
        contactedAt: match.contactedAt,
        createdAt: match.createdAt,
        candidate:
          match.matchType === 'user'
            ? { type: 'user', ...match.matchedUser }
            : { type: 'contact', ...match.matchedContact },
      }));

      res.status(200).json({
        success: true,
        data: {
          matches: formattedMatches,
          opportunity: {
            id: opportunity.id,
            title: opportunity.title,
            intentType: opportunity.intentType,
            lastMatchedAt: opportunity.lastMatchedAt,
          },
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update match status
   *
   * PUT /api/v1/opportunities/:id/matches/:matchId/status
   */
  async updateMatchStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AuthenticationError('Authentication required');
      }

      const { matchId } = req.params;
      const { status, suggestedMessageEdited } = req.body;

      if (!status && suggestedMessageEdited === undefined) {
        throw new ValidationError('Status or suggestedMessageEdited is required');
      }

      const existingMatch = await prisma.opportunityMatch.findUnique({
        where: { id: matchId },
        include: { intent: true },
      });

      if (!existingMatch) {
        throw new NotFoundError('Match not found');
      }

      // Verify ownership - scope by organization context
      const orgId = req.orgContext?.organizationId || null;
      if (orgId) {
        if (existingMatch.intent.organizationId !== orgId) {
          throw new AuthenticationError('Not authorized to update this match');
        }
      } else {
        if (existingMatch.intent.userId !== req.user.userId) {
          throw new AuthenticationError('Not authorized to update this match');
        }
      }

      const updateData: any = {};

      if (status) {
        const validStatuses: OpportunityMatchStatus[] = [
          'PENDING', 'CONTACTED', 'INTRODUCED', 'SAVED', 'DISMISSED', 'CONNECTED', 'ARCHIVED',
        ];
        if (!validStatuses.includes(status)) {
          throw new ValidationError(`Invalid status. Must be one of: ${validStatuses.join(', ')}`);
        }
        updateData.status = status as OpportunityMatchStatus;
        if (status === 'CONTACTED') {
          updateData.contactedAt = new Date();
        }
        if (status === 'ARCHIVED') {
          updateData.archivedAt = new Date();
        }
      }

      if (suggestedMessageEdited !== undefined) {
        updateData.suggestedMessageEdited = suggestedMessageEdited;
      }

      const updatedMatch = await prisma.opportunityMatch.update({
        where: { id: matchId },
        data: updateData,
      });

      logger.info('Opportunity match status updated', {
        userId: req.user.userId,
        matchId,
        newStatus: status,
      });

      res.status(200).json({
        success: true,
        data: updatedMatch,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get all matches across all user's opportunities
   *
   * GET /api/v1/opportunities/matches/all
   */
  async getAllMatches(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AuthenticationError('Authentication required');
      }

      const status = req.query.status as string;
      const minScore = parseFloat(req.query.minScore as string) || 0;
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 100));
      const sortBy = (req.query.sortBy as string) || 'score';
      const sortOrder = (req.query.sortOrder as string) || 'desc';

      // Scope by organization context
      const orgId = req.orgContext?.organizationId || null;
      const ownerFilter = orgId
        ? { organizationId: orgId }
        : { userId: req.user.userId, organizationId: null };

      // Get all user's opportunities
      const opportunities = await prisma.opportunityIntent.findMany({
        where: ownerFilter,
        select: { id: true, title: true, intentType: true },
      });

      const intentIds = opportunities.map((o) => o.id);

      if (intentIds.length === 0) {
        res.status(200).json({
          success: true,
          data: {
            matches: [],
            pagination: { page: 1, limit, total: 0, totalPages: 0 },
            stats: { total: 0, byStatus: {}, byIntentType: {} },
          },
        });
        return;
      }

      const matchWhere: any = {
        intentId: { in: intentIds },
        matchScore: { gte: minScore },
      };

      if (status) {
        matchWhere.status = status as OpportunityMatchStatus;
      } else {
        matchWhere.status = { notIn: ['DISMISSED', 'ARCHIVED'] as OpportunityMatchStatus[] };
      }

      const [matches, total] = await Promise.all([
        prisma.opportunityMatch.findMany({
          where: matchWhere,
          include: {
            intent: { select: { id: true, title: true, intentType: true } },
            matchedUser: {
              select: {
                id: true, fullName: true, jobTitle: true, company: true,
                avatarUrl: true, location: true, bio: true, email: true,
                phone: true, linkedinUrl: true,
              },
            },
            matchedContact: {
              select: {
                id: true, fullName: true, jobTitle: true, company: true,
                location: true, email: true, phone: true, linkedinUrl: true,
              },
            },
          },
          orderBy: sortBy === 'date' ? { createdAt: sortOrder as 'asc' | 'desc' } : { matchScore: sortOrder as 'asc' | 'desc' },
          take: limit,
        }),
        prisma.opportunityMatch.count({ where: matchWhere }),
      ]);

      const intentMap = new Map(opportunities.map((o) => [o.id, o]));

      const formattedMatches = matches.map((match) => {
        const opp = intentMap.get(match.intentId);
        return {
          id: match.id,
          opportunityId: match.intentId,
          opportunityTitle: opp?.title || '',
          matchScore: match.matchScore,
          matchType: match.matchType,
          status: match.status,
          reasons: match.reasons,
          suggestedAction: match.suggestedAction,
          suggestedMessage: match.suggestedMessage,
          nextSteps: match.nextSteps,
          sharedSectors: match.sharedSectors,
          sharedSkills: match.sharedSkills,
          intentAlignment: match.intentAlignment,
          contactedAt: match.contactedAt,
          createdAt: match.createdAt,
          candidate:
            match.matchType === 'user'
              ? { type: 'user', ...match.matchedUser }
              : { type: 'contact', ...match.matchedContact },
        };
      });

      // Build stats
      const statusCounts = await prisma.opportunityMatch.groupBy({
        by: ['status'],
        where: { intentId: { in: intentIds } },
        _count: true,
      });
      const byStatus = statusCounts.reduce((acc, item) => {
        acc[item.status] = item._count;
        return acc;
      }, {} as Record<string, number>);

      const intentTypeCounts = opportunities.reduce((acc, o) => {
        acc[o.intentType] = (acc[o.intentType] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      res.status(200).json({
        success: true,
        data: {
          matches: formattedMatches,
          pagination: { page: 1, limit, total, totalPages: Math.ceil(total / limit) },
          stats: { total, byStatus, byIntentType: intentTypeCounts },
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get stats for all user opportunities
   *
   * GET /api/v1/opportunities/stats
   */
  async getStats(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AuthenticationError('Authentication required');
      }

      // Scope by organization context
      const orgId = req.orgContext?.organizationId || null;
      const statsWhere = orgId
        ? { organizationId: orgId }
        : { userId: req.user.userId, organizationId: null };

      const opportunities = await prisma.opportunityIntent.findMany({
        where: statsWhere,
        select: { id: true },
      });

      const intentIds = opportunities.map((o) => o.id);

      if (intentIds.length === 0) {
        res.status(200).json({
          success: true,
          data: {
            totalOpportunities: 0,
            totalMatches: 0,
            stats: null,
          },
        });
        return;
      }

      const [totalMatches, statusCounts, avgScore] = await Promise.all([
        prisma.opportunityMatch.count({
          where: { intentId: { in: intentIds } },
        }),
        prisma.opportunityMatch.groupBy({
          by: ['status'],
          where: { intentId: { in: intentIds } },
          _count: true,
        }),
        prisma.opportunityMatch.aggregate({
          where: { intentId: { in: intentIds } },
          _avg: { matchScore: true },
        }),
      ]);

      const statusMap = statusCounts.reduce(
        (acc, item) => {
          acc[item.status] = item._count;
          return acc;
        },
        {} as Record<string, number>
      );

      res.status(200).json({
        success: true,
        data: {
          totalOpportunities: opportunities.length,
          totalMatches,
          averageScore: Math.round((avgScore._avg.matchScore || 0) * 10) / 10,
          byStatus: {
            pending: statusMap['PENDING'] || 0,
            contacted: statusMap['CONTACTED'] || 0,
            introduced: statusMap['INTRODUCED'] || 0,
            saved: statusMap['SAVED'] || 0,
            dismissed: statusMap['DISMISSED'] || 0,
            connected: statusMap['CONNECTED'] || 0,
          },
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Extract opportunity data from uploaded document
   *
   * POST /api/v1/opportunities/extract-document
   *
   * Body: multipart/form-data with 'document' file
   * Supported formats: PDF, DOCX, DOC, TXT
   */
  async extractFromDocument(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AuthenticationError('Authentication required');
      }

      const file = req.file;
      if (!file) {
        throw new ValidationError('Document file is required');
      }

      logger.info('Extracting opportunity data from document', {
        userId: req.user.userId,
        fileName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
      });

      // Extract text from document
      let textContent = '';

      if (file.mimetype === 'application/pdf') {
        const pdfParse = require('pdf-parse');
        const pdfData = await pdfParse(file.buffer);
        textContent = pdfData.text;
      } else if (
        file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
        file.mimetype === 'application/msword'
      ) {
        const mammoth = require('mammoth');
        const result = await mammoth.extractRawText({ buffer: file.buffer });
        textContent = result.value;
      } else if (file.mimetype === 'text/plain') {
        textContent = file.buffer.toString('utf-8');
      } else {
        throw new ValidationError('Unsupported file format. Please upload PDF, DOCX, DOC, or TXT files.');
      }

      // Clean text
      textContent = textContent.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();

      if (!textContent || textContent.trim().length < 30) {
        throw new ValidationError('Could not extract sufficient text from document.');
      }

      logger.info('Text extracted from opportunity document', { textLength: textContent.length });

      const openaiApiKey = process.env.OPENAI_API_KEY;
      const groqApiKey = process.env.GROQ_API_KEY;
      const useOpenAI = !!openaiApiKey;
      const aiApiKey = useOpenAI ? openaiApiKey : groqApiKey;
      const aiEndpoint = useOpenAI ? 'https://api.openai.com/v1/chat/completions' : 'https://api.groq.com/openai/v1/chat/completions';
      const aiModel = useOpenAI ? 'gpt-4o' : 'llama-3.3-70b-versatile';

      if (!aiApiKey) {
        throw new ValidationError('AI extraction service not configured');
      }

      // Get available sectors and skills for smart matching (load all, no limit)
      const [sectors, skills] = await Promise.all([
        prisma.sector.findMany({ where: { isActive: true }, select: { id: true, name: true } }),
        prisma.skill.findMany({ where: { isActive: true }, select: { id: true, name: true } }),
      ]);

      const maxDocLength = 12000;
      const truncatedContent = textContent.substring(0, maxDocLength);

      const prompt = `You are an expert HR analyst. Analyze this document and extract opportunity data. ALL OUTPUT IN ENGLISH (translate if needed).

Carefully read the document and identify:
- The person's job role or the job title being posted
- ALL specific technologies, tools, frameworks, programming languages, and skills mentioned
- The industries/domains referenced
- Languages spoken/required, certifications, education levels
- Salary information if mentioned
- Notice period or availability
- Work mode (onsite/hybrid/remote) and employment type (full-time/part-time/contract etc.)
- Years of experience required or held

DOCUMENT:
${truncatedContent}

INTENT TYPE (IMPORTANT - classify correctly):
- HIRING: job posting, job description, hiring request, vacancy announcement, "we are looking for", "responsibilities include"
- OPEN_TO_OPPORTUNITIES: CV, resume, portfolio, career profile, someone seeking work, lists personal experience/achievements, written in first person or about a specific person's career history

SENIORITY: ENTRY (0-2yr), MID (2-5yr), SENIOR (5-8yr), LEAD (8-12yr), DIRECTOR (12-15yr), VP (15+yr), C_LEVEL, BOARD

Return JSON:
{
  "title": "For CVs: '[Role] - [Name]'. For job postings: the job title.",
  "intentType": "HIRING or OPEN_TO_OPPORTUNITIES",
  "roleArea": "The primary functional area (e.g., Software Engineering, Finance, Marketing)",
  "seniority": "One of the seniority options above",
  "locationPref": "Location from document, or 'Remote'",
  "remoteOk": true/false,
  "workMode": "One of: Onsite, Hybrid, Remote. For candidates with multiple preferences, comma-separate them e.g. 'Remote,Hybrid'",
  "employmentType": "One of: Full-time, Part-time, Contract, Freelance, Internship. For candidates with multiple preferences, comma-separate them e.g. 'Full-time,Contract'",
  "urgencyOrAvailability": "For HIRING: one of 'Immediate', 'Within 1 month', 'Within 3 months', 'No rush'. For OPEN_TO_OPPORTUNITIES: one of 'Immediately available', 'Within 2 weeks', 'Within 1 month', 'Within 3 months', 'Open to future', 'Not actively looking'. null if not mentioned.",
  "minExperienceYears": "Number of minimum years of experience required or held. Must be a number or null.",
  "notes": "3-5 sentence professional summary of qualifications and experience",
  "sectors": ["List ALL relevant industry sectors, e.g. Technology, Software Development, E-commerce"],
  "skills": ["List EVERY specific technology, tool, framework, language, and skill mentioned. Be thorough."],
  "languages": ["Spoken/written languages mentioned, e.g. English, Arabic, French"],
  "certifications": ["Professional certifications, e.g. PMP, AWS Solutions Architect, CPA"],
  "educationLevels": ["Education requirements or qualifications, e.g. Bachelor's in CS, MBA, PhD"],
  "industries": ["Specific industries beyond sectors, e.g. FinTech, EdTech, SaaS, Cybersecurity"],
  "salaryMin": "Numeric salary minimum. If from document, use exact value. If not mentioned, estimate based on role, seniority, location, and industry. Must be a number.",
  "salaryMax": "Numeric salary maximum. If from document, use exact value. If not mentioned, estimate based on role, seniority, location, and industry. Must be a number.",
  "salaryCurrency": "Currency code (USD, EUR, SAR, AED, etc.). Infer from location if not stated.",
  "salaryPeriod": "MONTHLY or YEARLY. Use MONTHLY for Middle East (SAR, AED). Use YEARLY for US/EU (USD, EUR, GBP).",
  "noticePeriod": "One of: 'Immediately', '2 weeks', '1 month', '2 months', '3 months'. Extract from document or estimate based on seniority (Entry/Mid: '2 weeks', Senior/Lead: '1 month', Director/VP/C-Level: '2 months').",
  "relevantExperience": "2-3 sentence summary of relevant experience or ideal candidate experience",
  "fieldSources": {
    "salary": "DOCUMENT if salary numbers are explicitly in the document. AI_ESTIMATE if estimated.",
    "workMode": "DOCUMENT if work mode is mentioned. AI_ESTIMATE if inferred.",
    "employmentType": "DOCUMENT if employment type is mentioned. AI_ESTIMATE if inferred.",
    "urgencyOrAvailability": "DOCUMENT if mentioned. AI_ESTIMATE if inferred.",
    "noticePeriod": "DOCUMENT if mentioned. AI_ESTIMATE if estimated.",
    "minExperienceYears": "DOCUMENT if years are mentioned. AI_ESTIMATE if inferred.",
    "languages": "DOCUMENT if languages are mentioned. AI_ESTIMATE if inferred.",
    "certifications": "DOCUMENT if certifications are mentioned. AI_ESTIMATE if inferred.",
    "educationLevels": "DOCUMENT if education is mentioned. AI_ESTIMATE if inferred.",
    "industries": "DOCUMENT if industries are mentioned. AI_ESTIMATE if inferred."
  }
}

CRITICAL RULES:
- For skills: extract EVERY specific technology, programming language, framework, tool, and competency mentioned in the document. Be exhaustive. For example, if the document mentions "Laravel, PHP, Vue.js", ALL THREE must appear in the skills array. Include short-named skills like Go, R, C, C++, SQL, AWS, GCP, Git, Vue etc.
- For sectors: extract the relevant industries (e.g. Software Development, Technology, E-commerce)
- DO NOT combine multiple skills into one (e.g. "Laravel/PHP" should be two separate entries: "Laravel" and "PHP")
- For languages: extract all spoken/written languages mentioned (not programming languages)
- For certifications: extract all professional certifications (PMP, CPA, AWS certs, etc.)
- For education: extract degree requirements or qualifications held
- For salary: If the document mentions specific salary numbers, extract them and set fieldSources.salary to "DOCUMENT". If NO salary is mentioned, you MUST estimate a realistic salary range based on role, seniority, location, and industry — set fieldSources.salary to "AI_ESTIMATE". salaryMin/salaryMax must always be numbers. Use MONTHLY for Middle East (SAR, AED), YEARLY for US/EU (USD, EUR, GBP).
- For noticePeriod: extract if mentioned (set fieldSources.noticePeriod to "DOCUMENT"). If not mentioned, estimate based on seniority level (set to "AI_ESTIMATE"). Must be one of: 'Immediately', '2 weeks', '1 month', '2 months', '3 months'.
- For fieldSources: For EVERY field in fieldSources, set to "DOCUMENT" if the value was explicitly found in the document, or "AI_ESTIMATE" if you inferred/estimated it. This is critical for user transparency.
- For relevantExperience: summarize the candidate's key experience or the ideal candidate profile
- For workMode: extract or infer from context (e.g. "remote position" → "Remote", "office-based" → "Onsite", "hybrid" → "Hybrid"). If not mentioned, estimate based on role/industry. Set fieldSources.workMode accordingly.
- For employmentType: extract or infer from context (e.g. "full-time role" → "Full-time", "contract position" → "Contract"). If not mentioned, estimate. Set fieldSources.employmentType accordingly.
- For urgencyOrAvailability: extract hiring urgency or candidate availability if mentioned. Use the exact values listed above.
- For minExperienceYears: extract the minimum years of experience (e.g. "5+ years" → 5, "3-5 years experience" → 3). Must be a number or null.
- Return ONLY valid JSON, no markdown`;


      // AI API call with retry (OpenAI primary, Groq fallback)
      const callAIWithRetry = async (maxRetries = 3): Promise<globalThis.Response> => {
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
          const response = await fetch(aiEndpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${aiApiKey}`,
            },
            body: JSON.stringify({
              model: aiModel,
              messages: [
                { role: 'system', content: 'You are an expert HR analyst. Extract structured data from documents. List EVERY specific technology, framework, programming language, tool, and skill mentioned in the document - be thorough and exhaustive. Output ONLY valid JSON in English.' },
                { role: 'user', content: prompt },
              ],
              temperature: 0.2,
              max_tokens: 3000,
              ...(useOpenAI ? {} : { response_format: { type: 'json_object' } }),
            }),
          });

          if (response.ok) return response;

          if (response.status === 429 && attempt < maxRetries) {
            const errorText = await response.text();
            logger.warn('Groq API rate limit hit for opportunity extraction, retrying...', { attempt });
            let waitTime = Math.pow(2, attempt) * 5000;
            try {
              const errorData = JSON.parse(errorText);
              const retryMatch = errorData.error?.message?.match(/try again in ([\d.]+)s/);
              if (retryMatch) waitTime = Math.ceil(parseFloat(retryMatch[1]) * 1000) + 1000;
            } catch (e) {}
            await new Promise(resolve => setTimeout(resolve, waitTime));
            continue;
          }
          return response;
        }
        throw new Error('Max retries exceeded');
      };

      const aiResponse = await callAIWithRetry();

      if (!aiResponse.ok) {
        const errorText = await aiResponse.text();
        logger.error('AI API error during opportunity extraction', { status: aiResponse.status, error: errorText, provider: useOpenAI ? 'OpenAI' : 'Groq' });
        if (aiResponse.status === 429 || aiResponse.status === 413) {
          throw new ValidationError('AI service is busy. Please wait a moment and try again.');
        }
        throw new ValidationError('AI extraction failed. Please try again.');
      }

      const aiData = await aiResponse.json() as { choices?: Array<{ message?: { content?: string } }> };
      const content = aiData.choices?.[0]?.message?.content;

      if (!content) {
        throw new ValidationError('AI extraction returned no content');
      }

      let extractedData: any;
      try {
        let cleanContent = content.trim();
        const jsonCodeBlockMatch = cleanContent.match(/```json\s*([\s\S]*?)```/);
        const genericCodeBlockMatch = cleanContent.match(/```\s*([\s\S]*?)```/);
        if (jsonCodeBlockMatch && jsonCodeBlockMatch[1]) {
          cleanContent = jsonCodeBlockMatch[1].trim();
        } else if (genericCodeBlockMatch && genericCodeBlockMatch[1]) {
          cleanContent = genericCodeBlockMatch[1].trim();
        } else {
          const jsonMatch = cleanContent.match(/\{[\s\S]*\}/);
          if (jsonMatch) cleanContent = jsonMatch[0];
        }
        extractedData = JSON.parse(cleanContent.trim());
      } catch (e) {
        logger.error('Failed to parse Groq opportunity extraction response', { content, error: e });
        throw new ValidationError('Failed to parse extracted data');
      }

      logger.info('LLM raw extraction result', {
        userId: req.user.userId,
        llmSectors: extractedData.sectors,
        llmSkills: extractedData.skills,
        title: extractedData.title,
      });

      // Validate intentType
      const validIntentTypes = ['HIRING', 'OPEN_TO_OPPORTUNITIES', 'ADVISORY_BOARD', 'REFERRALS_ONLY'];
      const intentType = validIntentTypes.includes((extractedData.intentType || '').toUpperCase())
        ? (extractedData.intentType || '').toUpperCase()
        : '';

      // Validate seniority
      const validSeniorities = ['ENTRY', 'MID', 'SENIOR', 'LEAD', 'DIRECTOR', 'VP', 'C_LEVEL', 'BOARD'];
      const seniority = validSeniorities.includes((extractedData.seniority || '').toUpperCase())
        ? (extractedData.seniority || '').toUpperCase()
        : '';

      // Build lookup maps for fast matching
      const sectorsByLower = new Map<string, { id: string; name: string }>();
      for (const s of sectors) sectorsByLower.set(s.name.toLowerCase(), s);
      const skillsByLower = new Map<string, { id: string; name: string }>();
      for (const s of skills) skillsByLower.set(s.name.toLowerCase(), s);

      // Fuzzy match helper - prefers exact, then closest length match
      const fuzzyMatch = (name: string, items: Array<{ id: string; name: string }>, lookupMap: Map<string, { id: string; name: string }>) => {
        const lower = name.toLowerCase().trim();
        if (!lower || lower.length < 1) return null;

        // 1. Exact match (O(1) via map)
        const exact = lookupMap.get(lower);
        if (exact) return exact;

        // 2. For short names (< 4 chars), only allow exact matches (already checked above)
        //    This prevents false positives like "Go" matching "Google"
        if (lower.length < 4) return null;

        // 3. Collect contains-matches, pick closest by length
        //    Both the search term and DB item must be >= 4 chars for substring matching
        //    to prevent "R" or "C" from matching inside "AutoCAD", "Revit", etc.
        let bestMatch: { id: string; name: string } | null = null;
        let bestDiff = Infinity;
        for (const item of items) {
          const itemLower = item.name.toLowerCase();
          if (itemLower.length < 4) continue; // Skip short DB items for substring matching
          if (itemLower.includes(lower) || lower.includes(itemLower)) {
            const diff = Math.abs(itemLower.length - lower.length);
            if (diff < bestDiff) {
              bestDiff = diff;
              bestMatch = item;
            }
          }
        }

        return bestMatch;
      };

      // Map sector names to IDs — auto-create unmatched sectors
      const sectorIds: string[] = [];
      if (extractedData.sectors && Array.isArray(extractedData.sectors)) {
        for (const sectorName of extractedData.sectors.slice(0, 20)) {
          if (typeof sectorName !== 'string' || !sectorName.trim()) continue;
          const trimmed = sectorName.trim();
          let sector = fuzzyMatch(trimmed, sectors, sectorsByLower);
          if (!sector) {
            // Auto-create the sector so it appears in the form
            try {
              const created = await prisma.sector.create({
                data: { name: trimmed, isActive: true },
              });
              sector = { id: created.id, name: created.name };
              // Add to lookup maps for subsequent matches
              sectors.push(sector);
              sectorsByLower.set(trimmed.toLowerCase(), sector);
            } catch (e: any) {
              // Unique constraint — another request created it; look it up
              const existing = await prisma.sector.findFirst({ where: { name: trimmed }, select: { id: true, name: true } });
              if (existing) sector = existing;
            }
          }
          if (sector && !sectorIds.includes(sector.id)) {
            sectorIds.push(sector.id);
            if (sectorIds.length >= 10) break;
          }
        }
      }

      // Map skill names to IDs — auto-create unmatched skills
      const skillIds: string[] = [];
      if (extractedData.skills && Array.isArray(extractedData.skills)) {
        const addedSkillIds = new Set<string>();
        for (const skillName of extractedData.skills.slice(0, 30)) {
          if (typeof skillName !== 'string' || !skillName.trim()) continue;
          const trimmed = skillName.trim();
          let skill = fuzzyMatch(trimmed, skills, skillsByLower);
          if (!skill) {
            // Auto-create the skill so it appears in the form
            try {
              const created = await prisma.skill.create({
                data: { name: trimmed, isActive: true },
              });
              skill = { id: created.id, name: created.name };
              skills.push(skill);
              skillsByLower.set(trimmed.toLowerCase(), skill);
            } catch (e: any) {
              // Unique constraint — another request created it; look it up
              const existing = await prisma.skill.findFirst({ where: { name: trimmed }, select: { id: true, name: true } });
              if (existing) skill = existing;
            }
          }
          if (skill && !addedSkillIds.has(skill.id)) {
            skillIds.push(skill.id);
            addedSkillIds.add(skill.id);
            if (skillIds.length >= 20) break;
          }
        }
      }

      logger.info('Opportunity data extracted from document', {
        userId: req.user.userId,
        title: extractedData.title,
        intentType,
        sectorsFound: sectorIds.length,
        skillsFound: skillIds.length,
      });

      // Normalize array fields: lowercase + deduplicate
      const normalizeArray = (arr: any): string[] => {
        if (!Array.isArray(arr)) return [];
        const seen = new Set<string>();
        return arr
          .filter((v: any) => typeof v === 'string' && v.trim())
          .map((v: string) => v.trim())
          .filter((v: string) => {
            const lower = v.toLowerCase();
            if (seen.has(lower)) return false;
            seen.add(lower);
            return true;
          });
      };

      // Validate workMode — frontend expects lowercase values
      const validWorkModes = ['onsite', 'hybrid', 'remote'];
      let workMode: string | null = null;
      if (typeof extractedData.workMode === 'string' && extractedData.workMode.trim()) {
        const parts = extractedData.workMode.split(',').map((s: string) => s.trim()).filter(Boolean);
        const validParts = parts.filter((p: string) => validWorkModes.includes(p.toLowerCase()));
        if (validParts.length > 0) {
          workMode = validParts.map((p: string) => p.toLowerCase()).join(',');
        }
      }

      // Validate employmentType — frontend expects lowercase values
      const validEmploymentTypes = ['full-time', 'part-time', 'contract', 'freelance', 'internship'];
      let employmentType: string | null = null;
      if (typeof extractedData.employmentType === 'string' && extractedData.employmentType.trim()) {
        const parts = extractedData.employmentType.split(',').map((s: string) => s.trim()).filter(Boolean);
        const validParts = parts.filter((p: string) => validEmploymentTypes.includes(p.toLowerCase()));
        if (validParts.length > 0) {
          employmentType = validParts.map((p: string) => p.toLowerCase()).join(',');
        }
      }

      // Validate urgencyOrAvailability — must match frontend exact strings
      const urgencyMap: Record<string, string> = {
        'immediate': 'Immediate',
        'within 1 month': 'Within 1 month',
        'within 3 months': 'Within 3 months',
        'no rush': 'No rush',
        'immediately available': 'Immediately available',
        'within 2 weeks': 'Within 2 weeks',
        'open to future': 'Open to future opportunities',
        'open to future opportunities': 'Open to future opportunities',
        'not actively looking': 'Not actively looking',
      };
      let urgencyOrAvailability: string | null = null;
      if (typeof extractedData.urgencyOrAvailability === 'string' && extractedData.urgencyOrAvailability.trim() && extractedData.urgencyOrAvailability !== 'null') {
        const valLower = extractedData.urgencyOrAvailability.trim().toLowerCase();
        urgencyOrAvailability = urgencyMap[valLower] || null;
      }

      // Validate minExperienceYears
      let minExperienceYears: number | null = null;
      if (extractedData.minExperienceYears != null) {
        const parsed = typeof extractedData.minExperienceYears === 'number'
          ? extractedData.minExperienceYears
          : parseInt(String(extractedData.minExperienceYears), 10);
        if (!isNaN(parsed) && parsed >= 0 && parsed <= 50) {
          minExperienceYears = parsed;
        }
      }

      res.status(200).json({
        success: true,
        data: {
          title: extractedData.title || '',
          intentType,
          roleArea: extractedData.roleArea || '',
          seniority,
          locationPref: extractedData.locationPref || '',
          remoteOk: extractedData.remoteOk === true,
          workMode,
          employmentType,
          urgencyOrAvailability,
          minExperienceYears,
          notes: extractedData.notes || '',
          sectorIds,
          skillIds,
          mustHaveSkillIds: skillIds,
          preferredSkillIds: [],
          languages: normalizeArray(extractedData.languages),
          certifications: normalizeArray(extractedData.certifications),
          educationLevels: normalizeArray(extractedData.educationLevels),
          industries: normalizeArray(extractedData.industries),
          salaryMin: typeof extractedData.salaryMin === 'number' ? extractedData.salaryMin : (typeof extractedData.salaryMin === 'string' ? parseInt(extractedData.salaryMin, 10) || null : null),
          salaryMax: typeof extractedData.salaryMax === 'number' ? extractedData.salaryMax : (typeof extractedData.salaryMax === 'string' ? parseInt(extractedData.salaryMax, 10) || null : null),
          salaryCurrency: extractedData.salaryCurrency || null,
          salaryPeriod: extractedData.salaryPeriod === 'YEARLY' ? 'yearly' : 'monthly',
          noticePeriod: (() => {
            const validPeriods: Record<string, string> = { 'immediately': 'Immediately', '2 weeks': '2 weeks', '1 month': '1 month', '2 months': '2 months', '3 months': '3 months' };
            if (typeof extractedData.noticePeriod === 'string' && extractedData.noticePeriod !== 'null') {
              return validPeriods[extractedData.noticePeriod.toLowerCase().trim()] || null;
            }
            return null;
          })(),
          relevantExperience: (typeof extractedData.relevantExperience === 'string' && extractedData.relevantExperience !== 'null') ? extractedData.relevantExperience : null,
          fieldSources: (() => {
            const fs = extractedData.fieldSources || {};
            const normalize = (v: any) => v === 'DOCUMENT' ? 'DOCUMENT' : 'AI_ESTIMATE';
            return {
              salary: normalize(fs.salary),
              workMode: normalize(fs.workMode),
              employmentType: normalize(fs.employmentType),
              urgencyOrAvailability: normalize(fs.urgencyOrAvailability),
              noticePeriod: normalize(fs.noticePeriod),
              minExperienceYears: normalize(fs.minExperienceYears),
              languages: normalize(fs.languages),
              certifications: normalize(fs.certifications),
              educationLevels: normalize(fs.educationLevels),
              industries: normalize(fs.industries),
            };
          })(),
        },
      });
    } catch (error) {
      next(error);
    }
  }
}
