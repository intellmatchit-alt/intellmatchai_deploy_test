/**
 * PNME Controller: Pitch-to-Network Matching Engine
 * Handles HTTP requests for pitch operations
 */

import { Request, Response, NextFunction } from "express";
import { UploadPitchUseCase } from "../../application/use-cases/pitch/UploadPitchUseCase";
import { GetPitchStatusUseCase } from "../../application/use-cases/pitch/GetPitchStatusUseCase";
import { GetPitchResultsUseCase } from "../../application/use-cases/pitch/GetPitchResultsUseCase";
import { UpdateMatchStatusUseCase } from "../../application/use-cases/pitch/UpdateMatchStatusUseCase";
import { GetPNMEPreferencesUseCase } from "../../application/use-cases/pitch/GetPNMEPreferencesUseCase";
import { UpdatePNMEPreferencesUseCase } from "../../application/use-cases/pitch/UpdatePNMEPreferencesUseCase";
import { RegenerateOutreachUseCase } from "../../application/use-cases/pitch/RegenerateOutreachUseCase";
import { RematchPitchUseCase } from "../../application/use-cases/pitch/RematchPitchUseCase";
import { ExportPitchResultsUseCase } from "../../application/use-cases/pitch/ExportPitchResultsUseCase";
import {
  UploadPitchRequestDTO,
  GetPitchResultsQueryDTO,
  UpdateMatchStatusRequestDTO,
  ListPitchesQueryDTO,
  RegenerateOutreachRequestDTO,
  RematchRequestDTO,
  UpdatePNMEPreferencesRequestDTO,
} from "../../application/dto/pitch.dto";
import {
  PitchMatchStatus,
  PitchSectionType,
  PitchStatus,
  MatchAngleCategory,
  MatchBreakdown,
  MatchReason,
  MatchReasonType,
} from "../../domain/entities/Pitch";
import { logger } from "../../shared/logger";
import {
  ContactProfileDTO,
  MatchWeightsDTO,
} from "../../application/dto/pitch.dto";
import {
  pitchMatchingService,
  PITCH_MATCHING_DEFAULTS,
} from "../../infrastructure/services/pitch/PitchMatchingService";
import { prisma } from "../../infrastructure/database/prisma/client.js";
import {
  AuthenticationError,
  NotFoundError,
  ValidationError,
} from "../../shared/errors/index.js";
import {
  ProjectStage,
  ProjectVisibility,
  SkillImportance,
  PitchSectionType as PrismaPitchSectionType,
} from "@prisma/client";

// Import repositories
import {
  PrismaPitchRepository,
  PrismaPitchSectionRepository,
  PrismaPitchNeedRepository,
  PrismaPitchMatchRepository,
  PrismaPitchJobRepository,
  PrismaContactProfileCacheRepository,
  PrismaUserPNMEPreferencesRepository,
} from "../../infrastructure/repositories/PrismaPitchRepository";
import { PrismaContactRepository } from "../../infrastructure/repositories/PrismaContactRepository";

// Import services
import {
  pitchFileStorageService,
  pitchQueueService,
  outreachGeneratorService,
} from "../../infrastructure/services/pitch";

// Initialize repositories
const pitchRepository = new PrismaPitchRepository();
const pitchSectionRepository = new PrismaPitchSectionRepository();
const pitchNeedRepository = new PrismaPitchNeedRepository();
const pitchMatchRepository = new PrismaPitchMatchRepository();
const pitchJobRepository = new PrismaPitchJobRepository();
const contactRepository = new PrismaContactRepository();
const profileCacheRepository = new PrismaContactProfileCacheRepository();
const preferencesRepository = new PrismaUserPNMEPreferencesRepository();

// Initialize use cases
const uploadPitchUseCase = new UploadPitchUseCase(
  pitchRepository,
  pitchJobRepository,
  pitchFileStorageService,
  pitchQueueService,
);
const getPitchStatusUseCase = new GetPitchStatusUseCase(
  pitchRepository,
  pitchJobRepository,
  pitchSectionRepository,
  pitchNeedRepository,
);
const getPitchResultsUseCase = new GetPitchResultsUseCase(
  pitchRepository,
  pitchSectionRepository,
  pitchNeedRepository,
  pitchMatchRepository,
  contactRepository,
);
const updateMatchStatusUseCase = new UpdateMatchStatusUseCase(
  pitchMatchRepository,
  pitchSectionRepository,
  pitchRepository,
);
const getPNMEPreferencesUseCase = new GetPNMEPreferencesUseCase(
  preferencesRepository,
);
const updatePNMEPreferencesUseCase = new UpdatePNMEPreferencesUseCase(
  preferencesRepository,
);
const regenerateOutreachUseCase = new RegenerateOutreachUseCase(
  pitchRepository,
  pitchSectionRepository,
  pitchMatchRepository,
  profileCacheRepository,
  outreachGeneratorService,
);
const rematchPitchUseCase = new RematchPitchUseCase(
  pitchRepository,
  pitchJobRepository,
  pitchMatchRepository,
  pitchSectionRepository,
  pitchQueueService,
);
const exportPitchResultsUseCase = new ExportPitchResultsUseCase(
  pitchRepository,
  pitchSectionRepository,
  pitchNeedRepository,
  pitchMatchRepository,
  contactRepository,
);

/**
 * Upload a new pitch deck
 * POST /api/v1/pitches
 */
export async function uploadPitch(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = req.user!.userId;
    const file = req.file;

    if (!file) {
      res.status(400).json({ error: { message: "No file provided" } });
      return;
    }

    const input: UploadPitchRequestDTO = {
      file,
      title: req.body.title,
      language: req.body.language || "en",
    };

    const result = await uploadPitchUseCase.execute(userId, input);

    // If in org mode, set the organizationId on the pitch
    if (req.orgContext?.organizationId) {
      await prisma.pitch.update({
        where: { id: result.pitch.id },
        data: { organizationId: req.orgContext.organizationId },
      });
    }

    res.status(201).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

/**
 * Safely parse a JSON field that might be double-encoded (string instead of array)
 */
function safeJsonArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      // not valid JSON
    }
  }
  return [];
}

/**
 * Create a new pitch (form-based, no file upload required)
 * POST /api/v1/pitches/create
 */
export async function createPitch(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = req.user!.userId;
    const {
      title,
      summary,
      detailedDesc,
      companyName,
      category,
      stage = "IDEA",
      investmentRange,
      timeline,
      lookingFor = [],
      sectorIds = [],
      skills = [],
      visibility = "PUBLIC",
      problemStatement,
      whatYouNeed,
      metadata,
      documentUrl,
      documentName,
    } = req.body;

    if (!title || !summary) {
      throw new ValidationError("Title and summary are required");
    }

    // Create pitch with related data in a transaction
    const pitch = await prisma.$transaction(async (tx) => {
      // Create the pitch record
      const newPitch = await tx.pitch.create({
        data: {
          userId,
          title,
          summary,
          detailedDesc,
          companyName,
          category,
          stage: stage as ProjectStage,
          investmentRange,
          timeline,
          lookingFor,
          keywords: [],
          visibility: "PRIVATE" as ProjectVisibility,
          status: "COMPLETED",
          fileKey: null,
          fileName: null,
          fileSize: null,
          ...(documentUrl && { documentUrl }),
          ...(documentName && { documentName }),
          language: "en",
          ...(problemStatement !== undefined && { problemStatement }),
          ...(whatYouNeed !== undefined && { whatYouNeed }),
          ...(metadata !== undefined && { metadata }),
        },
      });

      // Create PitchSector records
      if (sectorIds.length > 0) {
        await tx.pitchSector.createMany({
          data: sectorIds.map((sectorId: string) => ({
            pitchId: newPitch.id,
            sectorId,
          })),
        });
      }

      // Create PitchSkill records
      if (skills.length > 0) {
        await tx.pitchSkill.createMany({
          data: skills.map((s: { skillId: string; importance?: string }) => ({
            pitchId: newPitch.id,
            skillId: s.skillId,
            importance: (s.importance || "REQUIRED") as SkillImportance,
          })),
        });
      }

      // Auto-create one PitchSection with EXECUTIVE_SUMMARY so matching works
      // Include ALL pitch data for better matching quality
      const sectionParts: string[] = [];
      if (title) sectionParts.push(`Title: ${title}`);
      if (companyName) sectionParts.push(`Company: ${companyName}`);
      if (summary) sectionParts.push(summary);
      if (detailedDesc) sectionParts.push(detailedDesc);
      if (investmentRange) sectionParts.push(`Investment: ${investmentRange}`);
      if (timeline) sectionParts.push(`Timeline: ${timeline}`);
      if (lookingFor?.length)
        sectionParts.push(`Looking for: ${lookingFor.join(", ")}`);
      const sectionContent = sectionParts.join("\n\n");
      await tx.pitchSection.create({
        data: {
          pitchId: newPitch.id,
          type: PrismaPitchSectionType.EXECUTIVE_SUMMARY,
          order: 0,
          title: title,
          content: sectionContent,
          confidence: 1.0,
        },
      });

      return newPitch;
    });

    // If in org mode, set the organizationId
    if (req.orgContext?.organizationId) {
      await prisma.pitch.update({
        where: { id: pitch.id },
        data: { organizationId: req.orgContext.organizationId },
      });
    }

    // Fetch the full pitch with relations
    const fullPitch = await prisma.pitch.findUnique({
      where: { id: pitch.id },
      include: {
        pitchSectors: { include: { sector: true } },
        pitchSkills: { include: { skill: true } },
        sections: true,
      },
    });

    logger.info("Pitch created (form-based)", {
      userId,
      pitchId: pitch.id,
      title: pitch.title,
    });

    res.status(201).json({
      success: true,
      data: {
        ...fullPitch,
        lookingFor: safeJsonArray(fullPitch?.lookingFor),
        keywords: safeJsonArray(fullPitch?.keywords),
        sectors: fullPitch?.pitchSectors.map((ps) => ps.sector) || [],
        skillsNeeded:
          fullPitch?.pitchSkills.map((ps) => ({
            ...ps.skill,
            importance: ps.importance,
          })) || [],
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get pitch status and progress
 * GET /api/v1/pitches/:id
 */
export async function getPitchStatus(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = req.user!.userId;
    const pitchId = req.params.id;

    // Scope by organization context
    const orgId = req.orgContext?.organizationId || null;
    if (orgId) {
      const rawPitch = await prisma.pitch.findUnique({
        where: { id: String(pitchId) },
        select: { organizationId: true },
      });
      if (rawPitch?.organizationId !== orgId) {
        res.status(403).json({ error: { message: "Access denied" } });
        return;
      }
    }

    const result = await getPitchStatusUseCase.execute(userId, String(pitchId));

    // Fetch additional relations (new fields)
    const pitchExtra = await prisma.pitch.findUnique({
      where: { id: String(pitchId) },
      select: {
        summary: true,
        detailedDesc: true,
        category: true,
        stage: true,
        investmentRange: true,
        timeline: true,
        lookingFor: true,
        keywords: true,
        visibility: true,
        documentUrl: true,
        documentName: true,
        pitchSectors: { include: { sector: true } },
        pitchSkills: { include: { skill: true } },
      },
    });

    res.json({
      success: true,
      data: {
        ...result,
        summary: pitchExtra?.summary,
        detailedDesc: pitchExtra?.detailedDesc,
        category: pitchExtra?.category,
        stage: pitchExtra?.stage,
        investmentRange: pitchExtra?.investmentRange,
        timeline: pitchExtra?.timeline,
        lookingFor: safeJsonArray(pitchExtra?.lookingFor),
        keywords: safeJsonArray(pitchExtra?.keywords),
        visibility: pitchExtra?.visibility,
        documentUrl: pitchExtra?.documentUrl || null,
        documentName: pitchExtra?.documentName || null,
        sectors: pitchExtra?.pitchSectors.map((ps) => ps.sector) || [],
        skillsNeeded:
          pitchExtra?.pitchSkills.map((ps) => ({
            ...ps.skill,
            importance: ps.importance,
          })) || [],
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get pitch results (sections with matches)
 * GET /api/v1/pitches/:id/results
 */
export async function getPitchResults(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = req.user!.userId;
    const pitchId = req.params.id;

    // Scope by organization context
    const orgId = req.orgContext?.organizationId || null;
    if (orgId) {
      const rawPitch = await prisma.pitch.findUnique({
        where: { id: String(pitchId) },
        select: { organizationId: true },
      });
      if (rawPitch?.organizationId !== orgId) {
        res.status(403).json({ error: { message: "Access denied" } });
        return;
      }
    }

    const query: GetPitchResultsQueryDTO = {
      sectionType: req.query.sectionType as PitchSectionType | undefined,
      minScore: req.query.minScore
        ? parseInt(req.query.minScore as string, 10)
        : undefined,
      limit: req.query.limit
        ? parseInt(req.query.limit as string, 10)
        : undefined,
    };

    const result = await getPitchResultsUseCase.execute(
      userId,
      String(pitchId),
      query,
    );

    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

/**
 * Update match status (save/ignore/contacted)
 * PATCH /api/v1/pitch-matches/:matchId
 */
export async function updateMatchStatus(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = req.user!.userId;
    const matchId = String(req.params.matchId);

    // Scope by organization context
    const orgId = req.orgContext?.organizationId || null;
    if (orgId) {
      const match = await prisma.pitchMatch.findUnique({
        where: { id: String(matchId) },
        include: {
          pitchSection: {
            include: { pitch: { select: { organizationId: true } } },
          },
        },
      });
      if (match?.pitchSection?.pitch?.organizationId !== orgId) {
        res.status(403).json({ error: { message: "Access denied" } });
        return;
      }
    }

    const input: UpdateMatchStatusRequestDTO = {
      status: req.body.status as PitchMatchStatus,
      outreachEdited: req.body.outreachEdited,
    };

    const result = await updateMatchStatusUseCase.execute(
      userId,
      matchId,
      input,
    );

    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

/**
 * Regenerate outreach message
 * POST /api/v1/pitches/:pitchId/sections/:sectionId/contacts/:contactId/outreach
 */
export async function regenerateOutreach(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = req.user!.userId;
    const { pitchId, sectionId, contactId } = req.params as {
      pitchId: string;
      sectionId: string;
      contactId: string;
    };

    // Scope by organization context
    const orgId = req.orgContext?.organizationId || null;
    if (orgId) {
      const rawPitch = await prisma.pitch.findUnique({
        where: { id: pitchId },
        select: { organizationId: true },
      });
      if (rawPitch?.organizationId !== orgId) {
        res.status(403).json({ error: { message: "Access denied" } });
        return;
      }
    }

    const input: RegenerateOutreachRequestDTO = {
      tone: req.body.tone || "professional",
      focus: req.body.focus,
    };

    const result = await regenerateOutreachUseCase.execute(
      userId,
      pitchId,
      sectionId,
      contactId,
      input,
    );

    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

/**
 * Re-run matching for a pitch
 * POST /api/v1/pitches/:id/rematch
 */
export async function rematchPitch(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = req.user!.userId;
    const pitchId = String(req.params.id);

    // Scope by organization context
    const orgId = req.orgContext?.organizationId || null;
    if (orgId) {
      const rawPitch = await prisma.pitch.findUnique({
        where: { id: pitchId },
        select: { organizationId: true },
      });
      if (rawPitch?.organizationId !== orgId) {
        res.status(403).json({ error: { message: "Access denied" } });
        return;
      }
    }

    const input: RematchRequestDTO = {
      fromStep: req.body.fromStep || "COMPUTE_MATCHES",
    };

    const result = await rematchPitchUseCase.execute(userId, pitchId, input);

    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

/**
 * Delete a pitch
 * DELETE /api/v1/pitches/:id
 */
export async function updatePitch(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = req.user!.userId;
    const pitchId = String(req.params.id);

    const pitch = await pitchRepository.findById(pitchId);
    if (!pitch) {
      res.status(404).json({ error: { message: "Pitch not found" } });
      return;
    }

    const orgId = req.orgContext?.organizationId || null;
    if (orgId) {
      const rawPitch = await prisma.pitch.findUnique({
        where: { id: pitchId },
        select: { organizationId: true },
      });
      if (rawPitch?.organizationId !== orgId) {
        res
          .status(403)
          .json({ error: { message: "Not authorized to update this pitch" } });
        return;
      }
    } else if (pitch.userId !== userId) {
      res
        .status(403)
        .json({ error: { message: "Not authorized to update this pitch" } });
      return;
    }

    const {
      title,
      companyName,
      language,
      summary,
      detailedDesc,
      category,
      stage,
      investmentRange,
      timeline,
      lookingFor,
      sectorIds,
      skills,
      visibility,
      problemStatement,
      whatYouNeed,
      metadata,
      documentUrl,
      documentName,
    } = req.body;

    // Build update data
    const updateData: any = {};
    if (title !== undefined) updateData.title = title;
    if (companyName !== undefined) updateData.companyName = companyName;
    if (language !== undefined) updateData.language = language;
    if (summary !== undefined) updateData.summary = summary;
    if (detailedDesc !== undefined) updateData.detailedDesc = detailedDesc;
    if (category !== undefined) updateData.category = category;
    if (stage !== undefined) updateData.stage = stage as ProjectStage;
    if (investmentRange !== undefined)
      updateData.investmentRange = investmentRange;
    if (timeline !== undefined) updateData.timeline = timeline;
    if (lookingFor !== undefined) updateData.lookingFor = lookingFor;
    if (visibility !== undefined)
      updateData.visibility = visibility as ProjectVisibility;
    if (problemStatement !== undefined)
      updateData.problemStatement = problemStatement;
    if (whatYouNeed !== undefined) updateData.whatYouNeed = whatYouNeed;
    if (metadata !== undefined) updateData.metadata = metadata;
    if (documentUrl !== undefined) updateData.documentUrl = documentUrl;
    if (documentName !== undefined) updateData.documentName = documentName;

    // Update sectors if provided
    if (sectorIds !== undefined) {
      await prisma.pitchSector.deleteMany({ where: { pitchId } });
      if (sectorIds.length > 0) {
        await prisma.pitchSector.createMany({
          data: sectorIds.map((sectorId: string) => ({
            pitchId,
            sectorId,
          })),
        });
      }
    }

    // Update skills if provided
    if (skills !== undefined) {
      await prisma.pitchSkill.deleteMany({ where: { pitchId } });
      if (skills.length > 0) {
        await prisma.pitchSkill.createMany({
          data: skills.map((s: { skillId: string; importance?: string }) => ({
            pitchId,
            skillId: s.skillId,
            importance: (s.importance || "REQUIRED") as SkillImportance,
          })),
        });
      }
    }

    // Clear keywords to force re-extraction on next match
    if (title || summary || detailedDesc) {
      updateData.keywords = [];
    }

    // Update the auto-generated PitchSection if summary/detailedDesc changed
    if (summary !== undefined || detailedDesc !== undefined) {
      const existingSection = await prisma.pitchSection.findFirst({
        where: { pitchId, type: "EXECUTIVE_SUMMARY" },
        orderBy: { order: "asc" },
      });
      if (existingSection) {
        const newSummary =
          summary !== undefined ? summary : (pitch as any).summary || "";
        const newDetailed =
          detailedDesc !== undefined
            ? detailedDesc
            : (pitch as any).detailedDesc || "";
        const sectionContent = [newSummary, newDetailed]
          .filter(Boolean)
          .join("\n\n");
        await prisma.pitchSection.update({
          where: { id: existingSection.id },
          data: {
            content: sectionContent,
            ...(title !== undefined && { title }),
          },
        });
      }
    }

    const updated = await prisma.pitch.update({
      where: { id: pitchId },
      data: updateData,
      include: {
        pitchSectors: { include: { sector: true } },
        pitchSkills: { include: { skill: true } },
      },
    });

    res.json({
      success: true,
      data: {
        ...updated,
        lookingFor: safeJsonArray(updated.lookingFor),
        keywords: safeJsonArray(updated.keywords),
        sectors: updated.pitchSectors.map((ps) => ps.sector),
        skillsNeeded: updated.pitchSkills.map((ps) => ({
          ...ps.skill,
          importance: ps.importance,
        })),
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function updatePitchSection(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = req.user!.userId;
    const { id: pitchId, sectionId } = req.params as {
      id: string;
      sectionId: string;
    };
    const { title, content } = req.body;

    const pitch = await pitchRepository.findById(pitchId);
    if (!pitch) {
      res.status(404).json({ error: { message: "Pitch not found" } });
      return;
    }

    const orgId = req.orgContext?.organizationId || null;
    if (orgId) {
      const rawPitch = await prisma.pitch.findUnique({
        where: { id: pitchId },
        select: { organizationId: true },
      });
      if (rawPitch?.organizationId !== orgId) {
        res.status(403).json({ error: { message: "Not authorized" } });
        return;
      }
    } else if (pitch.userId !== userId) {
      res.status(403).json({ error: { message: "Not authorized" } });
      return;
    }

    const section = await prisma.pitchSection.findFirst({
      where: { id: sectionId, pitchId },
    });
    if (!section) {
      res.status(404).json({ error: { message: "Section not found" } });
      return;
    }

    const updated = await prisma.pitchSection.update({
      where: { id: sectionId },
      data: {
        ...(title !== undefined && { title }),
        ...(content !== undefined && { content }),
      },
    });

    res.json({
      success: true,
      data: { id: updated.id, title: updated.title, content: updated.content },
    });
  } catch (error) {
    next(error);
  }
}

export async function archivePitch(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = req.user!.userId;
    const pitchId = String(req.params.id);
    const { isActive } = req.body;

    const pitch = await pitchRepository.findById(pitchId);
    if (!pitch) {
      res.status(404).json({ error: { message: "Pitch not found" } });
      return;
    }

    const orgId = req.orgContext?.organizationId || null;
    if (orgId) {
      const rawPitch = await prisma.pitch.findUnique({
        where: { id: pitchId },
        select: { organizationId: true },
      });
      if (rawPitch?.organizationId !== orgId) {
        res.status(403).json({ error: { message: "Not authorized" } });
        return;
      }
    } else if (pitch.userId !== userId) {
      res.status(403).json({ error: { message: "Not authorized" } });
      return;
    }

    const updated = await prisma.pitch.update({
      where: { id: pitchId },
      data: { isActive },
    });
    res.json({
      success: true,
      data: { id: updated.id, isActive: updated.isActive },
    });
  } catch (error) {
    next(error);
  }
}

export async function deletePitch(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = req.user!.userId;
    const pitchId = String(req.params.id);

    logger.info("Delete pitch requested", { userId, pitchId });

    // Scope by organization context
    const orgId = req.orgContext?.organizationId || null;

    // Verify pitch belongs to user/org
    const pitch = await pitchRepository.findById(pitchId);
    if (!pitch) {
      res.status(404).json({ error: { message: "Pitch not found" } });
      return;
    }

    if (orgId) {
      const rawPitch = await prisma.pitch.findUnique({
        where: { id: pitchId },
        select: { organizationId: true },
      });
      if (rawPitch?.organizationId !== orgId) {
        res
          .status(403)
          .json({ error: { message: "Not authorized to delete this pitch" } });
        return;
      }
    } else if (pitch.userId !== userId) {
      res
        .status(403)
        .json({ error: { message: "Not authorized to delete this pitch" } });
      return;
    }

    // Soft delete the pitch
    await pitchRepository.softDelete(pitchId);

    logger.info("Pitch deleted", { userId, pitchId });
    res.json({ success: true, message: "Pitch deleted successfully" });
  } catch (error) {
    next(error);
  }
}

/**
 * List user's pitches
 * GET /api/v1/pitches
 */
export async function listPitches(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = req.user!.userId;

    const query: ListPitchesQueryDTO = {
      status: req.query.status as string | undefined,
      page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
      limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 10,
    };

    logger.info("List pitches requested", { userId, query });

    // Scope by organization context
    const orgId = req.orgContext?.organizationId || null;
    const where: any = orgId
      ? { organizationId: orgId, deletedAt: null }
      : { userId, organizationId: null, deletedAt: null };

    if (query.status) where.status = query.status;

    const page = query.page || 1;
    const limit = query.limit || 10;

    const [pitches, total] = await Promise.all([
      prisma.pitch.findMany({
        where,
        include: {
          pitchSectors: { include: { sector: true } },
          pitchSkills: { include: { skill: true } },
          sections: {
            select: {
              _count: { select: { pitchMatches: true } },
            },
          },
        },
        orderBy: { uploadedAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.pitch.count({ where }),
    ]);

    res.json({
      success: true,
      data: {
        pitches: pitches.map((pitch) => ({
          id: pitch.id,
          status: pitch.status,
          fileName: pitch.fileName,
          fileType: pitch.fileType,
          title: pitch.title,
          companyName: pitch.companyName,
          summary: pitch.summary,
          category: pitch.category,
          stage: pitch.stage,
          lookingFor: safeJsonArray(pitch.lookingFor),
          visibility: pitch.visibility,
          language: pitch.language,
          uploadedAt: pitch.uploadedAt,
          processedAt: pitch.processedAt,
          isActive: pitch.isActive,
          sectors: pitch.pitchSectors.map((ps) => ps.sector),
          skillsNeeded: pitch.pitchSkills.map((ps) => ({
            ...ps.skill,
            importance: ps.importance,
          })),
          matchCount: pitch.sections.reduce(
            (sum, s) => sum + s._count.pitchMatches,
            0,
          ),
        })),
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
 * Discover public pitches from other users
 * GET /api/v1/pitches/discover/all
 */
export async function discoverPitches(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = req.user!.userId;

    const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
    const limit = req.query.limit
      ? parseInt(req.query.limit as string, 10)
      : 20;
    const category = req.query.category as string | undefined;
    const stage = req.query.stage as string | undefined;

    const where: any = {
      userId: { not: userId },
      visibility: "PUBLIC",
      isActive: true,
      deletedAt: null,
      status: "COMPLETED",
    };

    if (category) where.category = category;
    if (stage) where.stage = stage;

    const [pitches, total] = await Promise.all([
      prisma.pitch.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              company: true,
              jobTitle: true,
              avatarUrl: true,
            },
          },
          pitchSectors: { include: { sector: true } },
          pitchSkills: { include: { skill: true } },
        },
        orderBy: { uploadedAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.pitch.count({ where }),
    ]);

    res.json({
      success: true,
      data: {
        pitches: pitches.map((pitch) => ({
          id: pitch.id,
          title: pitch.title,
          companyName: pitch.companyName,
          summary: pitch.summary,
          detailedDesc: pitch.detailedDesc,
          category: pitch.category,
          stage: pitch.stage,
          lookingFor: safeJsonArray(pitch.lookingFor),
          visibility: pitch.visibility,
          investmentRange: pitch.investmentRange,
          timeline: pitch.timeline,
          uploadedAt: pitch.uploadedAt,
          sectors: pitch.pitchSectors.map((ps) => ps.sector),
          skillsNeeded: pitch.pitchSkills.map((ps) => ({
            ...ps.skill,
            importance: ps.importance,
          })),
          user: pitch.user
            ? {
                id: pitch.user.id,
                fullName:
                  `${pitch.user.firstName || ""} ${pitch.user.lastName || ""}`.trim(),
                email: pitch.user.email,
                company: pitch.user.company,
                jobTitle: pitch.user.jobTitle,
                avatarUrl: pitch.user.avatarUrl,
              }
            : null,
        })),
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
 * Export pitch results
 * GET /api/v1/pitches/:id/export
 */
export async function exportPitchResults(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = req.user!.userId;
    const pitchId = String(req.params.id);

    // Scope by organization context
    const orgId = req.orgContext?.organizationId || null;
    if (orgId) {
      const rawPitch = await prisma.pitch.findUnique({
        where: { id: pitchId },
        select: { organizationId: true },
      });
      if (rawPitch?.organizationId !== orgId) {
        res.status(403).json({ error: { message: "Access denied" } });
        return;
      }
    }

    const format = (req.query.format as "json" | "csv" | "pdf") || "json";

    const validFormat = format === "csv" ? "csv" : "json";
    const result = await exportPitchResultsUseCase.execute(
      userId,
      pitchId,
      validFormat,
    );

    res.setHeader("Content-Type", result.contentType);
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${result.filename}"`,
    );
    res.send(result.data);
  } catch (error) {
    next(error);
  }
}

/**
 * Get PNME preferences
 * GET /api/v1/pitches/preferences
 */
export async function getPNMEPreferences(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = req.user!.userId;

    const result = await getPNMEPreferencesUseCase.execute(userId);

    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

/**
 * Update PNME preferences
 * PUT /api/v1/pitches/preferences
 */
export async function updatePNMEPreferences(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = req.user!.userId;

    const input: UpdatePNMEPreferencesRequestDTO = {
      relevanceWeight: req.body.relevanceWeight,
      expertiseWeight: req.body.expertiseWeight,
      strategicWeight: req.body.strategicWeight,
      relationshipWeight: req.body.relationshipWeight,
      autoDeletePitchDays: req.body.autoDeletePitchDays,
      enableWhatsAppMetadata: req.body.enableWhatsAppMetadata,
      defaultLanguage: req.body.defaultLanguage,
      minMatchScore: req.body.minMatchScore,
      maxMatchesPerSection: req.body.maxMatchesPerSection,
    };

    const result = await updatePNMEPreferencesUseCase.execute(userId, input);

    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

/**
 * Find matches for a pitch (synchronous, like project matching)
 * POST /api/v1/pitches/:id/find-matches
 */
export async function findMatches(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) {
      throw new AuthenticationError("Authentication required");
    }

    const userId = req.user.userId;
    const pitchId = String(req.params.id);

    // Scope by organization context
    const orgId = req.orgContext?.organizationId || null;

    // Verify pitch ownership
    const pitchWhere: any = { id: pitchId, deletedAt: null };
    if (orgId) {
      pitchWhere.organizationId = orgId;
    } else {
      pitchWhere.userId = userId;
    }

    const pitch = await prisma.pitch.findFirst({
      where: pitchWhere,
    });

    if (!pitch) {
      throw new NotFoundError("Pitch not found");
    }

    logger.info("Starting pitch matching (sync)", { userId, pitchId });

    // Get pitch sections + pitch sectors/skills for context enrichment
    const [sections, pitchSectors, pitchSkills] = await Promise.all([
      prisma.pitchSection.findMany({
        where: { pitchId },
        orderBy: { order: "asc" },
      }),
      prisma.pitchSector.findMany({
        where: { pitchId },
        include: { sector: { select: { name: true } } },
      }),
      prisma.pitchSkill.findMany({
        where: { pitchId },
        include: { skill: { select: { name: true } } },
      }),
    ]);

    if (sections.length === 0) {
      res.status(400).json({
        success: false,
        error: { message: "No sections found for this pitch" },
      });
      return;
    }

    // Enrich section content with pitch sectors/skills for better matching
    const sectorNames = pitchSectors.map((ps: any) => ps.sector.name);
    const skillNames = pitchSkills.map((ps: any) => ps.skill.name);
    const enrichmentContext = [
      sectorNames.length ? `Sectors: ${sectorNames.join(", ")}` : "",
      skillNames.length ? `Skills needed: ${skillNames.join(", ")}` : "",
      pitch.category ? `Category: ${pitch.category}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    // Get contacts scoped by org context
    const contactWhere: any = orgId
      ? { organizationId: orgId }
      : { ownerId: userId };

    const contacts = await prisma.contact.findMany({
      where: contactWhere,
      include: {
        contactSkills: { include: { skill: true } },
        contactSectors: { include: { sector: true } },
        contactInterests: { include: { interest: true } },
      },
    });

    if (contacts.length === 0) {
      res.status(400).json({
        success: false,
        error: {
          message: "No contacts in your network. Add contacts first.",
        },
      });
      return;
    }

    // Get interaction counts for all contacts in one query
    const contactIds = contacts.map((c) => c.id);
    const interactionCounts = await prisma.interaction.groupBy({
      by: ["contactId"],
      where: { contactId: { in: contactIds } },
      _count: { id: true },
    });
    const interactionCountMap = new Map(
      interactionCounts.map((ic) => [ic.contactId, ic._count.id]),
    );

    // Build ContactProfileDTO from contacts (on the fly, no cache needed)
    const contactProfiles: ContactProfileDTO[] = contacts.map((contact) => ({
      contactId: contact.id,
      userId,
      fullName: contact.fullName,
      company: contact.company,
      jobTitle: contact.jobTitle,
      profileSummary: [
        contact.bioSummary || contact.bio || "",
        contact.jobTitle ? `Works as ${contact.jobTitle}` : "",
        contact.company ? `at ${contact.company}` : "",
      ]
        .filter(Boolean)
        .join(". "),
      sectors: contact.contactSectors.map((cs: any) => cs.sector.name),
      skills: contact.contactSkills.map((cs: any) => cs.skill.name),
      interests: contact.contactInterests.map((ci: any) => ci.interest.name),
      investorType: undefined,
      investmentStage: undefined,
      checkSize: undefined,
      relationshipStrength: 50, // Default
      lastInteractionDays: contact.lastInteractionAt
        ? Math.floor(
            (Date.now() - new Date(contact.lastInteractionAt).getTime()) /
              (1000 * 60 * 60 * 24),
          )
        : null,
      interactionCount: interactionCountMap.get(contact.id) || 0,
    }));

    // Default weights
    const weights: MatchWeightsDTO = PITCH_MATCHING_DEFAULTS.weights;

    // Delete existing matches for this pitch
    for (const section of sections) {
      await prisma.pitchMatch.deleteMany({
        where: { pitchSectionId: section.id },
      });
    }

    let totalMatchCount = 0;

    // Compute matches for each section
    for (const section of sections) {
      // Append pitch context to section content for better matching
      const enrichedContent = enrichmentContext
        ? `${section.content}\n\n${enrichmentContext}`
        : section.content;

      const computed = await pitchMatchingService.computeMatches(
        section.id,
        section.type as PitchSectionType,
        enrichedContent,
        null, // No embedding for sync mode
        contactProfiles,
        weights,
        PITCH_MATCHING_DEFAULTS.minScore,
      );

      // Save top matches per section
      const topMatches = computed.slice(
        0,
        PITCH_MATCHING_DEFAULTS.maxMatchesPerSection,
      );

      if (topMatches.length > 0) {
        await prisma.$transaction(
          topMatches.map((m) =>
            prisma.pitchMatch.create({
              data: {
                pitchSectionId: section.id,
                contactId: m.contactId,
                score: m.score,
                relevanceScore: m.relevanceScore,
                expertiseScore: m.expertiseScore,
                strategicScore: m.strategicScore,
                relationshipScore: m.relationshipScore,
                breakdownJson: m.breakdown as any,
                reasonsJson: m.reasons as any,
                angleCategory: m.angleCategory || undefined,
                status: "PENDING",
              },
            }),
          ),
        );
        totalMatchCount += topMatches.length;
      }

      logger.info("Section matching complete", {
        sectionId: section.id,
        sectionType: section.type,
        matchCount: topMatches.length,
      });
    }

    // Update pitch status to COMPLETED
    await prisma.pitch.update({
      where: { id: String(pitchId) },
      data: { status: "COMPLETED", processedAt: new Date() },
    });

    logger.info("Pitch matching completed (sync)", {
      userId,
      pitchId,
      totalMatches: totalMatchCount,
      sectionCount: sections.length,
    });

    // Fetch results in the same format as getPitchResults
    const results = await getPitchResultsUseCase.execute(
      userId,
      String(pitchId),
      {},
    );

    res.json({
      success: true,
      data: {
        matchCount: totalMatchCount,
        ...results,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Helper: clean extracted text from PDFs (remove single-char line artifacts)
 */
function cleanExtractedText(text: string): string {
  let cleaned = text;
  const lines = cleaned.split("\n");
  const processedLines: string[] = [];
  let charBuffer = "";

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.length <= 2 && line.length > 0 && !/[\u0600-\u06FF]/.test(line)) {
      let isPartOfSequence = false;
      if (i > 0 && i < lines.length - 1) {
        const prevLine = lines[i - 1].trim();
        const nextLine = lines[i + 1].trim();
        if (
          (prevLine.length <= 2 && prevLine.length > 0) ||
          (nextLine.length <= 2 && nextLine.length > 0)
        ) {
          isPartOfSequence = true;
        }
      }
      if (isPartOfSequence) {
        charBuffer += line;
        continue;
      }
    }
    if (charBuffer) {
      processedLines.push(charBuffer);
      charBuffer = "";
    }
    if (line) processedLines.push(line);
  }
  if (charBuffer) processedLines.push(charBuffer);

  cleaned = processedLines.join("\n");
  cleaned = cleaned
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return cleaned;
}

/**
 * Analyze pitch text and suggest category, sectors, skills, lookingFor using AI
 * POST /api/v1/pitches/analyze-text
 */
export async function analyzePitchText(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) {
      throw new AuthenticationError("Authentication required");
    }

    const { title, summary, detailedDesc } = req.body;

    if (!title && !summary) {
      throw new ValidationError("Title or summary is required for analysis");
    }

    const pitchText = [title, summary, detailedDesc]
      .filter(Boolean)
      .join("\n\n");

    if (pitchText.trim().length < 10) {
      throw new ValidationError("Please provide more details for AI analysis");
    }

    const openaiApiKey = process.env.OPENAI_API_KEY;
    const groqApiKey = process.env.GROQ_API_KEY;
    const useOpenAI = !!openaiApiKey;
    const aiApiKey = useOpenAI ? openaiApiKey : groqApiKey;
    const aiEndpoint = useOpenAI
      ? "https://api.openai.com/v1/chat/completions"
      : "https://api.groq.com/openai/v1/chat/completions";
    const aiModel = useOpenAI ? "gpt-4o" : "llama-3.3-70b-versatile";

    if (!aiApiKey) {
      throw new ValidationError("AI service not configured");
    }

    // Get available sectors and skills for matching
    const [sectors, skills] = await Promise.all([
      prisma.sector.findMany({
        where: { isActive: true },
        select: { id: true, name: true },
        take: 200,
      }),
      prisma.skill.findMany({
        where: { isActive: true },
        select: { id: true, name: true },
        take: 200,
      }),
    ]);

    const validCategories = [
      "healthtech",
      "fintech",
      "edtech",
      "saas",
      "ecommerce",
      "aiml",
      "cleantech",
      "proptech",
      "agritech",
      "foodtech",
      "legaltech",
      "hrtech",
      "martech",
      "insurtech",
      "logistics",
      "gaming",
      "social",
      "media",
      "cybersecurity",
      "iot",
      "blockchain",
      "other",
    ];

    const lookingForOptions = [
      "cofounder",
      "investor",
      "technical_partner",
      "business_partner",
      "advisor",
      "employee",
      "contractor",
      "customer",
      "supplier",
    ];

    const prompt = `You are a world-class startup analyst. Analyze this pitch and suggest the BEST matching options for each field. Be specific and relevant to THIS pitch.

PITCH:
Title: ${title || ""}
Summary: ${summary || ""}
${detailedDesc ? `Details: ${detailedDesc.substring(0, 3000)}` : ""}

CATEGORY OPTIONS: ${validCategories.join(", ")}
LOOKING FOR OPTIONS: ${lookingForOptions.join(", ")}
STAGE OPTIONS: IDEA, MVP, EARLY, GROWTH, SCALE

MATCH INTENT OPTIONS: INVESTOR, ADVISOR, STRATEGIC_PARTNER, COFOUNDER, CUSTOMER_BUYER
SUPPORT NEEDED TAG OPTIONS: funding, introductions, advisor, strategic_partner, distribution, technical_integration, pilot_customer, design_partner, buyer_customer, enterprise_access, cofounder, hiring, compliance, market_access, growth_support

Return JSON:
{
  "category": "Best matching category from CATEGORY OPTIONS",
  "stage": "Best stage based on evidence in the pitch",
  "companyName": "Company or startup name if identifiable from the text, otherwise empty string",
  "lookingFor": ["Select 2-5 MOST relevant from LOOKING FOR OPTIONS based on what this pitch actually needs"],
  "sectors": ["List 4-8 specific industry sectors/domains relevant to this pitch. Use descriptive names like 'Healthcare Technology', 'Digital Marketing', 'Artificial Intelligence', etc."],
  "skills": ["List 6-12 specific skills needed for this pitch to succeed. Use names like 'Machine Learning', 'Product Management', 'Financial Analysis', etc."],
  "whatYouNeed": "3-5 specific sentences about what this pitch needs - funding, expertise, partnerships, talent gaps, market access.",
  "matchIntent": ["Select 1-3 MOST relevant from MATCH INTENT OPTIONS based on what this pitch is seeking"],
  "supportNeededTags": ["Select ALL applicable from SUPPORT NEEDED TAG OPTIONS"],
  "tractionSummary": "Any traction metrics or milestones mentioned (users, revenue, pilots, partnerships). Empty string if none.",
  "founderBackgroundSummary": "Any founder/team background info mentioned. Empty string if none.",
  "fundingAmountRequested": null,
  "fundingCurrency": "USD",
  "confidence": {"category": 0.9, "stage": 0.8, "matchIntent": 0.7, "supportNeededTags": 0.7}
}

RULES:
- For sectors and skills: Write the most accurate, descriptive names (they will be matched to a database). Be specific to this pitch.
- For whatYouNeed: Be SPECIFIC to this pitch, not generic advice.
- For fundingAmountRequested: Extract as a plain number (e.g. 500000 for $500K). Return null if not mentioned.
- For fundingCurrency: One of USD, EUR, GBP, JOD, SAR, AED. Default USD.
- For confidence: Rate your confidence 0.0-1.0 per field based on how clearly the pitch text supports your answer.
- Return ONLY valid JSON`;

    const aiResponse = await fetch(aiEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${aiApiKey}`,
      },
      body: JSON.stringify({
        model: aiModel,
        messages: [
          {
            role: "system",
            content:
              "You are a startup expert. Analyze pitches and suggest the best matching categories, sectors, and skills. Output ONLY valid JSON.",
          },
          { role: "user", content: prompt },
        ],
        temperature: 0.3,
        max_tokens: 2500,
        ...(useOpenAI ? {} : { response_format: { type: "json_object" } }),
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      logger.error("AI API error during pitch analysis", {
        status: aiResponse.status,
        error: errorText,
        provider: useOpenAI ? "OpenAI" : "Groq",
      });
      if (aiResponse.status === 429 || aiResponse.status === 413) {
        throw new ValidationError(
          "AI service is busy. Please wait a moment and try again.",
        );
      }
      throw new ValidationError("AI analysis failed. Please try again.");
    }

    const aiData = (await aiResponse.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = aiData.choices?.[0]?.message?.content;

    if (!content) {
      throw new ValidationError("AI analysis returned no content");
    }

    let extractedData: any;
    try {
      let cleanContent = content.trim();
      const jsonMatch = cleanContent.match(/```json\s*([\s\S]*?)```/) ||
        cleanContent.match(/```\s*([\s\S]*?)```/) || [
          null,
          cleanContent.match(/\{[\s\S]*\}/)?.[0],
        ];
      cleanContent = (jsonMatch[1] || cleanContent).trim();
      extractedData = JSON.parse(cleanContent);
    } catch (e) {
      logger.error("Failed to parse pitch analysis response", {
        content,
        error: e,
      });
      throw new ValidationError("Failed to parse AI analysis");
    }

    // Validate category
    const analysisCategory = validCategories.includes(extractedData.category)
      ? extractedData.category
      : "other";

    // Validate stage
    const validStages = ["IDEA", "MVP", "EARLY", "GROWTH", "SCALE"];
    let analysisStage = (extractedData.stage || "").toUpperCase().trim();
    if (!validStages.includes(analysisStage)) {
      const stageMap: Record<string, string> = {
        "EARLY REVENUE": "EARLY",
        REVENUE: "EARLY",
        SEED: "EARLY",
        "PRE-SEED": "IDEA",
        BETA: "MVP",
        PROTOTYPE: "MVP",
        CONCEPT: "IDEA",
        VALIDATION: "EARLY",
        LAUNCHED: "EARLY",
        SCALING: "SCALE",
        "SERIES A": "GROWTH",
        "SERIES B": "SCALE",
      };
      analysisStage = stageMap[analysisStage] || "IDEA";
    }

    // Validate lookingFor
    const analysisLookingFor = (extractedData.lookingFor || []).filter(
      (l: string) => lookingForOptions.includes(l),
    );

    // Smart fuzzy match with word overlap scoring
    const smartMatch = (
      query: string,
      items: Array<{ id: string; name: string }>,
    ): { id: string; name: string; score: number } | null => {
      const queryLower = query.toLowerCase().trim();
      const queryWords = queryLower
        .split(/[\s/&,\-()]+/)
        .filter((w) => w.length > 2);
      let best: { id: string; name: string; score: number } | null = null;
      for (const item of items) {
        const nameLower = item.name.toLowerCase();
        if (nameLower === queryLower) return { ...item, score: 100 };
        if (nameLower.includes(queryLower) || queryLower.includes(nameLower)) {
          if (!best || 80 > best.score) best = { ...item, score: 80 };
          continue;
        }
        const nameWords = nameLower
          .split(/[\s/&,\-()]+/)
          .filter((w) => w.length > 2);
        let matched = 0;
        for (const qw of queryWords) {
          if (nameWords.some((nw) => nw.includes(qw) || qw.includes(nw)))
            matched++;
        }
        const score =
          queryWords.length > 0 ? (matched / queryWords.length) * 60 : 0;
        if (score > 0 && (!best || score > best.score))
          best = { ...item, score };
      }
      return best && best.score >= 30 ? best : null;
    };

    // Match sectors: fuzzy match or create new
    const sectorIds: string[] = [];
    if (extractedData.sectors && Array.isArray(extractedData.sectors)) {
      for (const name of extractedData.sectors.slice(0, 8)) {
        const trimmedName = name.trim();
        if (!trimmedName) continue;
        const match = smartMatch(trimmedName, sectors);
        if (match && match.score >= 60 && !sectorIds.includes(match.id)) {
          sectorIds.push(match.id);
        } else {
          try {
            const newSector = await prisma.sector.create({
              data: { name: trimmedName, isActive: true },
            });
            sectorIds.push(newSector.id);
            sectors.push({ id: newSector.id, name: trimmedName });
          } catch {
            const existing = sectors.find(
              (s) => s.name.toLowerCase() === trimmedName.toLowerCase(),
            );
            if (existing && !sectorIds.includes(existing.id))
              sectorIds.push(existing.id);
          }
        }
      }
    }

    // Match skills: fuzzy match or create new
    const skillItems: Array<{ skillId: string; importance: string }> = [];
    const addedSkillIds = new Set<string>();
    if (extractedData.skills && Array.isArray(extractedData.skills)) {
      let idx = 0;
      for (const name of extractedData.skills.slice(0, 12)) {
        const trimmedName = name.trim();
        if (!trimmedName) continue;
        const importance =
          idx < 3 ? "REQUIRED" : idx < 6 ? "PREFERRED" : "NICE_TO_HAVE";
        const match = smartMatch(trimmedName, skills);
        if (match && match.score >= 60 && !addedSkillIds.has(match.id)) {
          skillItems.push({ skillId: match.id, importance });
          addedSkillIds.add(match.id);
          idx++;
        } else {
          try {
            const newSkill = await prisma.skill.create({
              data: { name: trimmedName, isActive: true },
            });
            skillItems.push({ skillId: newSkill.id, importance });
            addedSkillIds.add(newSkill.id);
            skills.push({ id: newSkill.id, name: trimmedName });
            idx++;
          } catch {
            const existing = skills.find(
              (s) => s.name.toLowerCase() === trimmedName.toLowerCase(),
            );
            if (existing && !addedSkillIds.has(existing.id)) {
              skillItems.push({ skillId: existing.id, importance });
              addedSkillIds.add(existing.id);
              idx++;
            }
          }
        }
      }
    }

    logger.info("Pitch text analyzed", {
      userId: req.user.userId,
      category: analysisCategory,
      stage: analysisStage,
      sectorsFound: sectorIds.length,
      skillsFound: skillItems.length,
      lookingFor: analysisLookingFor,
    });

    // Validate new structured fields from analysis
    const VALID_MATCH_INTENTS_A = [
      "INVESTOR",
      "ADVISOR",
      "STRATEGIC_PARTNER",
      "COFOUNDER",
      "CUSTOMER_BUYER",
    ];
    const VALID_SUPPORT_TAGS_A = [
      "funding",
      "introductions",
      "advisor",
      "strategic_partner",
      "distribution",
      "technical_integration",
      "pilot_customer",
      "design_partner",
      "buyer_customer",
      "enterprise_access",
      "cofounder",
      "hiring",
      "compliance",
      "market_access",
      "growth_support",
    ];
    const VALID_CURRENCIES_A = ["USD", "EUR", "GBP", "JOD", "SAR", "AED"];

    const analysisMatchIntent = (extractedData.matchIntent || []).filter(
      (v: string) => VALID_MATCH_INTENTS_A.includes(v),
    );
    const analysisSupportTags = (extractedData.supportNeededTags || []).filter(
      (v: string) => VALID_SUPPORT_TAGS_A.includes(v),
    );

    let analysisFundingAmount: number | null = null;
    const rawFundingA = extractedData.fundingAmountRequested;
    if (rawFundingA != null) {
      if (typeof rawFundingA === "number" && !isNaN(rawFundingA)) {
        analysisFundingAmount = rawFundingA;
      } else if (typeof rawFundingA === "string") {
        const cleaned = rawFundingA.replace(/[$€£,\s]/g, "");
        const multiplierMatch = cleaned.match(/^([\d.]+)([KkMmBb])?$/);
        if (multiplierMatch) {
          const num = parseFloat(multiplierMatch[1]);
          const suffix = (multiplierMatch[2] || "").toUpperCase();
          const multipliers: Record<string, number> = {
            K: 1_000,
            M: 1_000_000,
            B: 1_000_000_000,
          };
          analysisFundingAmount = num * (multipliers[suffix] || 1);
        } else {
          const num = parseFloat(cleaned);
          if (!isNaN(num)) analysisFundingAmount = num;
        }
      }
    }
    const analysisCurrency = VALID_CURRENCIES_A.includes(
      extractedData.fundingCurrency,
    )
      ? extractedData.fundingCurrency
      : analysisFundingAmount
        ? "USD"
        : null;

    // Validate confidence
    const rawConfidenceA = extractedData.confidence || {};
    const analysisConfidence: Record<string, number> = {};
    for (const [key, val] of Object.entries(rawConfidenceA)) {
      if (typeof val === "number" && val >= 0 && val <= 1) {
        analysisConfidence[key] = val;
      }
    }

    res.status(200).json({
      success: true,
      data: {
        category: analysisCategory,
        stage: analysisStage,
        companyName: extractedData.companyName || "",
        lookingFor: analysisLookingFor,
        sectorIds,
        skills: skillItems,
        whatYouNeed: extractedData.whatYouNeed || "",
        matchIntent: analysisMatchIntent,
        supportNeededTags: analysisSupportTags,
        tractionSummary: extractedData.tractionSummary || "",
        founderBackgroundSummary: extractedData.founderBackgroundSummary || "",
        fundingAmountRequested: analysisFundingAmount,
        fundingCurrency: analysisCurrency,
        confidence: analysisConfidence,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Extract pitch data from uploaded document using AI
 * POST /api/v1/pitches/extract-document
 */
export async function extractPitchFromDocument(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = req.user!.userId;
    const file = req.file;

    if (!file) {
      res.status(400).json({ success: false, error: { code: 'VALIDATION', message: 'Document file is required' } });
      return;
    }

    logger.info('Extracting pitch data from document', {
      userId,
      fileName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
    });

    // Save document to storage for later retrieval
    let pitchDocumentUrl: string | null = null;
    let pitchDocumentName = file.originalname;
    try {
      const { getStorageService } = require('../../infrastructure/external/storage');
      const storage = getStorageService();
      const key = `pitches/documents/${userId}/${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
      const result = await storage.upload('p2p-uploads', key, file.buffer, {
        contentType: file.mimetype,
        metadata: { userId, originalName: file.originalname },
      });
      pitchDocumentUrl = result.url || `/${key}`;
      logger.info("Pitch document saved to storage", { key, pitchDocumentUrl });
    } catch (storageErr: any) {
      logger.warn("Failed to save pitch document to storage", { error: storageErr.message });
    }

    let textContent = '';

    if (file.mimetype === 'application/pdf') {
      try {
        const pdfParse = require('pdf-parse');
        const pdfData = await pdfParse(file.buffer);
        textContent = cleanExtractedText(pdfData.text);
      } catch (pdfError: any) {
        logger.warn('Failed to parse PDF file', { error: pdfError.message, fileName: file.originalname });
        res.status(400).json({ success: false, error: { code: 'PDF_ERROR', message: 'Could not read the PDF file. It may be corrupted or not a valid PDF. Please try a different file.' } });
        return;
      }
    } else if (
      file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      file.mimetype === 'application/msword'
    ) {
      try {
        const mammoth = require('mammoth');
        const result = await mammoth.extractRawText({ buffer: file.buffer });
        textContent = cleanExtractedText(result.value);
      } catch (docError: any) {
        logger.warn('Failed to parse DOCX file', { error: docError.message, fileName: file.originalname });
        res.status(400).json({ success: false, error: { code: 'DOC_ERROR', message: 'Could not read the document file. It may be corrupted or not a valid DOCX/DOC file.' } });
        return;
      }
    } else if (file.mimetype === 'text/plain') {
      textContent = file.buffer.toString('utf-8');
    } else {
      res.status(400).json({ success: false, error: { code: 'VALIDATION', message: 'Unsupported file format. Please upload PDF, DOCX, DOC, or TXT files.' } });
      return;
    }

    if (!textContent || textContent.trim().length < 30) {
      res.status(400).json({ success: false, error: { code: 'VALIDATION', message: 'Could not extract sufficient text from document.' } });
      return;
    }

    logger.info('Text extracted from pitch document', { textLength: textContent.length });

    const openaiApiKey = process.env.OPENAI_API_KEY;
    const groqApiKey = process.env.GROQ_API_KEY;
    const useOpenAI = !!openaiApiKey;
    const aiApiKey = useOpenAI ? openaiApiKey : groqApiKey;
    const aiEndpoint = useOpenAI
      ? 'https://api.openai.com/v1/chat/completions'
      : 'https://api.groq.com/openai/v1/chat/completions';
    const aiModel = useOpenAI ? 'gpt-4o' : 'llama-3.3-70b-versatile';

    if (!aiApiKey) {
      res.status(500).json({ success: false, error: { code: 'CONFIG', message: 'AI extraction service not configured' } });
      return;
    }

    // Get available sectors and skills for matching
    const [dbSectors, dbSkills] = await Promise.all([
      prisma.sector.findMany({ where: { isActive: true }, select: { id: true, name: true }, take: 200 }),
      prisma.skill.findMany({ where: { isActive: true }, select: { id: true, name: true }, take: 200 }),
    ]);

    const maxDocLength = 8000;
    const truncatedContent = textContent.substring(0, maxDocLength);

    const validCategories = [
      'healthtech', 'fintech', 'edtech', 'saas', 'ecommerce', 'aiml',
      'cleantech', 'proptech', 'agritech', 'foodtech', 'legaltech',
      'hrtech', 'martech', 'insurtech', 'logistics', 'gaming',
      'social', 'media', 'cybersecurity', 'iot', 'blockchain', 'other',
    ];

    const lookingForOptions = [
      'cofounder', 'investor', 'technical_partner', 'business_partner',
      'advisor', 'employee', 'contractor', 'customer', 'supplier',
    ];

    const prompt = `You are a world-class startup analyst and venture capital expert. Read this entire document VERY carefully, extract EVERY piece of information, and produce a comprehensive structured analysis. ALL OUTPUT IN ENGLISH (translate if needed).

DOCUMENT:
${truncatedContent}

INSTRUCTIONS:
1. Read the ENTIRE document word by word. Do NOT skim.
2. Look for the company/startup name in: page headers, footers, "About Us" sections, team bios, legal text, domain names, email addresses (e.g. info@companyname.com), copyright notices (© 2024 CompanyName), slide titles, logo text.
3. Look for funding asks in: "Investment", "Fundraising", "Use of Funds", "Financial Projections", tables with dollar amounts, "seeking $X", "raising $X", "round size".
4. Determine the business stage from concrete evidence: revenue numbers → EARLY/GROWTH, user/customer counts → MVP+, "prototype"/"beta" → MVP, "concept"/"idea" → IDEA, "pilot"/"testing" → EARLY, growth metrics/KPIs → GROWTH, multi-market expansion → SCALE.
5. For sectors and skills, think about what INDUSTRY this company operates in and what EXPERTISE they need. Be specific and relevant.

CATEGORY OPTIONS: ${validCategories.join(', ')}
LOOKING FOR OPTIONS: ${lookingForOptions.join(', ')}

Return this EXACT JSON structure (fill EVERY field as best as possible):
{
  "title": "A compelling 3-8 word title that captures WHAT the company does (not just the company name)",
  "companyName": "The exact company/startup/project name as written in the document",
  "description": "A powerful 2-4 sentence elevator pitch covering: what the product is, what problem it solves, what makes it unique, who benefits from it",
  "detailedDesc": "A thorough 4-8 sentence analysis covering: THE PROBLEM (specific pain point), THE SOLUTION (how this product addresses it), THE APPROACH (technology/methodology/business model), KEY DIFFERENTIATORS (competitive advantages), and TRACTION (any metrics, users, revenue mentioned)",
  "whatYouNeed": "3-5 detailed, specific sentences about what this company needs. Examples: 'Seeking $500K seed funding to hire 3 engineers and launch in Q3 2025. Needs a CTO with experience in distributed systems. Looking for strategic partnerships with healthcare providers in the MENA region to accelerate customer acquisition. Would benefit from an advisor with FDA regulatory experience.'",
  "stage": "EXACTLY one of: IDEA, MVP, EARLY, GROWTH, SCALE",
  "category": "EXACTLY one of: ${validCategories.join(', ')}",
  "targetMarket": "Specific target market with details: geography, demographics, industry vertical, estimated market size if mentioned",
  "fundingAsk": "Exact amount or range with context (e.g. '$2M Series A for product development and market expansion', '$500K seed round'). If not explicitly mentioned, write empty string.",
  "timeline": "Key milestones and dates from the document. If a roadmap exists, summarize it. If not explicit, infer 2-3 logical next milestones based on current stage.",
  "lookingFor": ["Select 2-5 MOST relevant from: cofounder, investor, technical_partner, business_partner, advisor, employee, contractor, customer, supplier"],
  "sectors": ["List 4-8 specific industry sectors/domains this company operates in. Use descriptive names like 'Healthcare Technology', 'Digital Marketing', 'Supply Chain Management', 'Artificial Intelligence', 'E-commerce', 'Financial Services', etc."],
  "skills": ["List 6-12 specific professional skills needed. Use names like 'Machine Learning', 'Product Management', 'Digital Marketing', 'Financial Analysis', 'Software Engineering', 'Sales Management', 'UI/UX Design', 'Data Science', 'Business Development', 'Cloud Computing', etc."],
  "matchIntent": ["Select 1-3 MOST relevant from: INVESTOR, ADVISOR, STRATEGIC_PARTNER, COFOUNDER, CUSTOMER_BUYER. Based on what the pitch is actively seeking."],
  "supportNeededTags": ["Select ALL applicable from: funding, introductions, advisor, strategic_partner, distribution, technical_integration, pilot_customer, design_partner, buyer_customer, enterprise_access, cofounder, hiring, compliance, market_access, growth_support"],
  "fundingAmountRequested": "A NUMBER only (no currency symbol). Extract from any dollar/currency amounts related to fundraising. E.g. 500000 for '$500K'. Return null if not found.",
  "fundingCurrency": "EXACTLY one of: USD, EUR, GBP, JOD, SAR, AED. Detect from the document currency context. Default USD if unclear.",
  "businessModel": ["Select applicable from: B2B, B2C, B2B2C, Marketplace, SaaS, Subscription, Freemium, Pay-per-use, Licensing, Other"],
  "targetCustomerType": ["Select applicable from: Enterprise, SMB, Startup, Consumer, Government, Non-profit"],
  "operatingMarkets": ["List geographic markets/regions mentioned, e.g. MENA, North America, Europe, Global"],
  "tractionSummary": "Summary of traction metrics: users, revenue, pilots, LOIs, partnerships. If no traction mentioned, write empty string.",
  "founderBackgroundSummary": "Summary of founder/team backgrounds, experience, previous exits. If not mentioned, write empty string.",
  "problemStatement": "The core problem being solved, 2-3 sentences.",
  "confidence": {"title": 0.9, "companyName": 0.8, "stage": 0.7, "category": 0.8, "fundingAmountRequested": 0.6, "matchIntent": 0.7, "supportNeededTags": 0.7, "tractionSummary": 0.5, "founderBackgroundSummary": 0.5}
}

CRITICAL RULES:
- NEVER leave companyName empty if the document has ANY reference to a company, project, or brand name.
- NEVER default stage to IDEA - look for evidence of actual progress first.
- whatYouNeed must be SPECIFIC to THIS company, not generic startup advice.
- sectors and skills should be FREE-FORM descriptive names (they will be matched to a database later). Write the most accurate, specific names.
- fundingAsk: search the entire document for ANY dollar/currency amounts related to fundraising.
- Return ONLY valid JSON, no markdown, no explanation.`;

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
              { role: 'system', content: 'You are a world-class startup analyst. Extract comprehensive structured pitch information from documents. Be thorough - read the entire document carefully and extract every detail. Output ONLY valid JSON in English.' },
              { role: 'user', content: prompt },
            ],
            temperature: 0.2,
            max_tokens: 4000,
            ...(useOpenAI ? {} : { response_format: { type: 'json_object' } }),
          }),
        });

        if (response.ok) return response;

        if (response.status === 429 && attempt < maxRetries) {
          const errorText = await response.text();
          logger.warn('AI rate limit hit for pitch extraction, retrying...', { attempt, error: errorText });
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
      logger.error('AI API error during pitch extraction', { status: aiResponse.status, error: errorText, provider: useOpenAI ? 'OpenAI' : 'Groq' });
      if (aiResponse.status === 429 || aiResponse.status === 413) {
        res.status(429).json({ success: false, error: { code: 'RATE_LIMIT', message: 'AI service is busy. Please wait a moment and try again.' } });
        return;
      }
      res.status(500).json({ success: false, error: { code: 'AI_ERROR', message: 'AI extraction failed. Please try again.' } });
      return;
    }

    const aiData = await aiResponse.json() as { choices?: Array<{ message?: { content?: string } }> };
    const content = aiData.choices?.[0]?.message?.content;

    if (!content) {
      res.status(500).json({ success: false, error: { code: 'AI_ERROR', message: 'AI extraction returned no content' } });
      return;
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
      logger.error('Failed to parse Groq pitch extraction response', { content, error: e });
      res.status(500).json({ success: false, error: { code: 'PARSE_ERROR', message: 'Failed to parse extracted data' } });
      return;
    }

    logger.info('Pitch data extracted from document (raw AI response)', {
      userId,
      title: extractedData.title,
      companyName: extractedData.companyName,
      stage: extractedData.stage,
      category: extractedData.category,
      fundingAsk: extractedData.fundingAsk,
      lookingFor: extractedData.lookingFor,
      sectors: extractedData.sectors,
      skills: extractedData.skills,
    });

    // Validate stage
    const validStages = ['IDEA', 'MVP', 'EARLY', 'GROWTH', 'SCALE'];
    let extractedStage = (extractedData.stage || '').toUpperCase().trim();
    if (!validStages.includes(extractedStage)) {
      // Try to map common variations
      const stageMap: Record<string, string> = {
        'EARLY REVENUE': 'EARLY', 'REVENUE': 'EARLY', 'SEED': 'EARLY',
        'PRE-SEED': 'IDEA', 'PRESEED': 'IDEA', 'BETA': 'MVP', 'PROTOTYPE': 'MVP',
        'ALPHA': 'EARLY', 'CONCEPT': 'IDEA', 'GROWTH STAGE': 'GROWTH',
        'VALIDATION': 'EARLY', 'LAUNCHED': 'EARLY', 'SCALING': 'SCALE',
        'SERIES A': 'GROWTH', 'SERIES B': 'SCALE',
      };
      extractedStage = stageMap[extractedStage] || 'IDEA';
    }

    // Validate category
    const extractedCategory = validCategories.includes(extractedData.category) ? extractedData.category : 'other';

    // Validate lookingFor
    const extractedLookingFor = (extractedData.lookingFor || []).filter((l: string) => lookingForOptions.includes(l));

    // Smart fuzzy match: exact → contains → word overlap scoring
    const smartFuzzyMatch = (query: string, items: Array<{ id: string; name: string }>, maxResults: number): Array<{ id: string; name: string; score: number }> => {
      const queryLower = query.toLowerCase().trim();
      const queryWords = queryLower.split(/[\s/&,\-()]+/).filter(w => w.length > 2);

      const scored = items.map(item => {
        const nameLower = item.name.toLowerCase();
        const nameWords = nameLower.split(/[\s/&,\-()]+/).filter(w => w.length > 2);

        // Exact match
        if (nameLower === queryLower) return { ...item, score: 100 };

        // One contains the other
        if (nameLower.includes(queryLower) || queryLower.includes(nameLower)) return { ...item, score: 80 };

        // Word overlap scoring
        let matchedWords = 0;
        for (const qw of queryWords) {
          if (nameWords.some(nw => nw.includes(qw) || qw.includes(nw))) {
            matchedWords++;
          }
        }
        const overlapScore = queryWords.length > 0 ? (matchedWords / queryWords.length) * 60 : 0;

        return { ...item, score: overlapScore };
      });

      return scored.filter(s => s.score >= 30).sort((a, b) => b.score - a.score).slice(0, maxResults);
    };

    // Match sectors: try fuzzy match first, create new sector if no good match
    const sectorIds: string[] = [];
    if (extractedData.sectors && Array.isArray(extractedData.sectors)) {
      for (const name of extractedData.sectors.slice(0, 8)) {
        const trimmedName = name.trim();
        if (!trimmedName) continue;
        const matches = smartFuzzyMatch(trimmedName, dbSectors, 1);
        if (matches.length > 0 && matches[0].score >= 60) {
          // Good match found in DB
          if (!sectorIds.includes(matches[0].id)) {
            sectorIds.push(matches[0].id);
          }
        } else {
          // No good match — create new sector in DB
          try {
            const newSector = await prisma.sector.create({
              data: { name: trimmedName, isActive: true },
            });
            sectorIds.push(newSector.id);
            dbSectors.push({ id: newSector.id, name: trimmedName });
            logger.info('Created new sector from AI extraction', { name: trimmedName, id: newSector.id });
          } catch (createErr: any) {
            // If duplicate name, find existing
            const existing = dbSectors.find(s => s.name.toLowerCase() === trimmedName.toLowerCase());
            if (existing && !sectorIds.includes(existing.id)) {
              sectorIds.push(existing.id);
            }
          }
        }
      }
    }

    // Match skills: try fuzzy match first, create new skill if no good match
    const skillItems: Array<{ skillId: string; importance: string }> = [];
    const addedSkillIds = new Set<string>();
    if (extractedData.skills && Array.isArray(extractedData.skills)) {
      let idx = 0;
      for (const name of extractedData.skills.slice(0, 12)) {
        const trimmedName = name.trim();
        if (!trimmedName) continue;
        const matches = smartFuzzyMatch(trimmedName, dbSkills, 1);
        const importance = idx < 3 ? 'REQUIRED' : idx < 6 ? 'PREFERRED' : 'NICE_TO_HAVE';
        if (matches.length > 0 && matches[0].score >= 60) {
          // Good match found in DB
          if (!addedSkillIds.has(matches[0].id)) {
            skillItems.push({ skillId: matches[0].id, importance });
            addedSkillIds.add(matches[0].id);
            idx++;
          }
        } else {
          // No good match — create new skill in DB
          try {
            const newSkill = await prisma.skill.create({
              data: { name: trimmedName, isActive: true },
            });
            skillItems.push({ skillId: newSkill.id, importance });
            addedSkillIds.add(newSkill.id);
            dbSkills.push({ id: newSkill.id, name: trimmedName });
            idx++;
            logger.info('Created new skill from AI extraction', { name: trimmedName, id: newSkill.id });
          } catch (createErr: any) {
            // If duplicate name, find existing
            const existing = dbSkills.find(s => s.name.toLowerCase() === trimmedName.toLowerCase());
            if (existing && !addedSkillIds.has(existing.id)) {
              skillItems.push({ skillId: existing.id, importance });
              addedSkillIds.add(existing.id);
              idx++;
            }
          }
        }
      }
    }

    // Use investmentRange as fallback for fundingAsk
    const fundingAsk = extractedData.fundingAsk || extractedData.investmentRange || '';

    logger.info('Pitch extraction matching results', {
      userId,
      aiSectors: extractedData.sectors,
      matchedSectorCount: sectorIds.length,
      matchedSectorNames: sectorIds.map(id => dbSectors.find(s => s.id === id)?.name),
      aiSkills: extractedData.skills,
      matchedSkillCount: skillItems.length,
      matchedSkillNames: skillItems.map(s => dbSkills.find(sk => sk.id === s.skillId)?.name),
      lookingFor: extractedLookingFor,
    });

    // Validate new structured fields
    const VALID_MATCH_INTENTS = ['INVESTOR', 'ADVISOR', 'STRATEGIC_PARTNER', 'COFOUNDER', 'CUSTOMER_BUYER'];
    const VALID_SUPPORT_TAGS = ['funding', 'introductions', 'advisor', 'strategic_partner', 'distribution', 'technical_integration', 'pilot_customer', 'design_partner', 'buyer_customer', 'enterprise_access', 'cofounder', 'hiring', 'compliance', 'market_access', 'growth_support'];
    const VALID_CURRENCIES = ['USD', 'EUR', 'GBP', 'JOD', 'SAR', 'AED'];
    const VALID_BUSINESS_MODELS = ['B2B', 'B2C', 'B2B2C', 'Marketplace', 'SaaS', 'Subscription', 'Freemium', 'Pay-per-use', 'Licensing', 'Other'];
    const VALID_CUSTOMER_TYPES = ['Enterprise', 'SMB', 'Startup', 'Consumer', 'Government', 'Non-profit'];

    const validatedMatchIntent = (extractedData.matchIntent || []).filter((v: string) => VALID_MATCH_INTENTS.includes(v));
    const validatedSupportTags = (extractedData.supportNeededTags || []).filter((v: string) => VALID_SUPPORT_TAGS.includes(v));
    const validatedBusinessModel = (extractedData.businessModel || []).filter((v: string) => VALID_BUSINESS_MODELS.includes(v));
    const validatedCustomerType = (extractedData.targetCustomerType || []).filter((v: string) => VALID_CUSTOMER_TYPES.includes(v));
    const validatedMarkets = Array.isArray(extractedData.operatingMarkets) ? extractedData.operatingMarkets.filter((v: string) => typeof v === 'string' && v.trim()) : [];

    // Parse funding amount: strip currency symbols, commas, K/M/B suffixes
    let parsedFundingAmount: number | null = null;
    const rawFunding = extractedData.fundingAmountRequested;
    if (rawFunding != null) {
      if (typeof rawFunding === 'number' && !isNaN(rawFunding)) {
        parsedFundingAmount = rawFunding;
      } else if (typeof rawFunding === 'string') {
        const cleaned = rawFunding.replace(/[$€£,\s]/g, '');
        const multiplierMatch = cleaned.match(/^([\d.]+)([KkMmBb])?$/);
        if (multiplierMatch) {
          const num = parseFloat(multiplierMatch[1]);
          const suffix = (multiplierMatch[2] || '').toUpperCase();
          const multipliers: Record<string, number> = { K: 1_000, M: 1_000_000, B: 1_000_000_000 };
          parsedFundingAmount = num * (multipliers[suffix] || 1);
        } else {
          const num = parseFloat(cleaned);
          if (!isNaN(num)) parsedFundingAmount = num;
        }
      }
    }

    const validatedCurrency = VALID_CURRENCIES.includes(extractedData.fundingCurrency) ? extractedData.fundingCurrency : (parsedFundingAmount ? 'USD' : null);

    // Validate confidence object
    const rawConfidence = extractedData.confidence || {};
    const validatedConfidence: Record<string, number> = {};
    for (const [key, val] of Object.entries(rawConfidence)) {
      if (typeof val === 'number' && val >= 0 && val <= 1) {
        validatedConfidence[key] = val;
      }
    }

    res.status(200).json({
      success: true,
      data: {
        title: extractedData.title || '',
        companyName: extractedData.companyName || '',
        industry: extractedData.industry || '',
        description: extractedData.description || '',
        detailedDesc: extractedData.detailedDesc || '',
        whatYouNeed: extractedData.whatYouNeed || '',
        stage: extractedStage,
        category: extractedCategory,
        targetMarket: extractedData.targetMarket || '',
        fundingAsk: fundingAsk,
        timeline: extractedData.timeline || '',
        lookingFor: extractedLookingFor,
        sectorIds,
        skills: skillItems,
        matchIntent: validatedMatchIntent,
        supportNeededTags: validatedSupportTags,
        fundingAmountRequested: parsedFundingAmount,
        fundingCurrency: validatedCurrency,
        businessModel: validatedBusinessModel,
        targetCustomerType: validatedCustomerType,
        operatingMarkets: validatedMarkets,
        tractionSummary: extractedData.tractionSummary || '',
        founderBackgroundSummary: extractedData.founderBackgroundSummary || '',
        problemStatement: extractedData.problemStatement || '',
        confidence: validatedConfidence,
        documentUrl: pitchDocumentUrl,
        documentName: pitchDocumentName,
      },
    });
  } catch (error) {
    next(error);
  }
}
