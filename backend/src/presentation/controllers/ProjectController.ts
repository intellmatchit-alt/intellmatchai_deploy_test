/**
 * Project Controller
 *
 * Handles HTTP requests for collaboration project endpoints.
 *
 * @module presentation/controllers/ProjectController
 */

import { Request, Response, NextFunction } from "express";
import { prisma } from "../../infrastructure/database/prisma/client";
import { ProjectMatchingService } from "../../infrastructure/external/projects/ProjectMatchingService";
import { advancedFindMatches } from "../../infrastructure/external/projects/advanced-matching.adapter";
import {
  triggerProjectMatching,
  getProjectMatchingJobStatus,
} from "../../infrastructure/queue";
import {
  AuthenticationError,
  NotFoundError,
  ValidationError,
} from "../../shared/errors";
import { logger } from "../../shared/logger";
import {
  ProjectStage,
  ProjectVisibility,
  ProjectMatchStatus,
  SkillImportance,
} from "@prisma/client";
import type {
  ContactScoringInput,
  ProjectScoringInput,
} from "../../infrastructure/external/projects/lookingForRoleScorer";
import { semanticScoreManyContacts } from "../../infrastructure/external/projects/lookingForSemanticScorer";
import {
  enrichLookingForResult,
  rankByTotalLookingForScore,
  dedupeMatchesByTarget,
  type LookingForType,
  type EnrichedLookingForResult,
} from "../../infrastructure/external/projects/lookingForEnhancedScorer";

/**
 * Extra fields appended to every match result returned to the frontend.
 * They form the contract for the per-Looking-For matching feature.
 */
interface LookingForMatchEnrichment {
  /** Selected Looking For types in canonical UPPER_SNAKE form. */
  selectedLookingFor: LookingForType[];
  /** Per-Looking-For score detail objects (one per selected type). */
  lookingForScoreDetails: EnrichedLookingForResult["lookingForScores"];
  /** MAX of all per-type finalScores. */
  totalScore: number;
  /** The Looking For type that produced totalScore (or null). */
  bestLookingFor: LookingForType | null;
  /** Overall explanation. */
  overallExplanation: EnrichedLookingForResult["overallExplanation"];
  /**
   * Backward-compat: legacy Record<id, score> shape used by the older
   * MatchCard pill renderer; preserved so the UI does not crash.
   */
  lookingForScores: Record<string, number>;
  /** Backward-compat: id → label map. */
  lookingForLabels: Record<string, string>;
  /** Backward-compat: same as totalScore (older field name). */
  lookingForTotalScore: number | null;
  /** Backward-compat: top-level overall score (mirrors totalScore). */
  score: number;
  /** Backward-compat: top-level final score (mirrors totalScore). */
  finalScore: number;
  /** Match band of totalScore. */
  matchLevel: string;
}

/**
 * Compute the Looking For enrichment for a single match.
 *
 * `selected` is the project's persisted lookingFor IDs (or canonical types).
 * `semantic` is the per-id semantic score map (or null when unavailable).
 *
 * Returns `null` when no Looking For types were selected — caller decides
 * whether to fall back to the legacy headline matchScore.
 */
function buildLookingForEnrichment(
  selected: string[],
  contact: ContactScoringInput,
  project: ProjectScoringInput | undefined,
  semantic: Record<string, number> | null,
  flags?: { blocked?: boolean; optedOut?: boolean },
): { fields: LookingForMatchEnrichment; raw: EnrichedLookingForResult } | null {
  if (!Array.isArray(selected) || selected.length === 0) return null;
  const enriched = enrichLookingForResult({
    selected,
    contact,
    project,
    semanticScores: semantic,
    flags,
  });
  if (!enriched.selectedLookingFor.length) return null;
  return { fields: enrichmentToFields(enriched), raw: enriched };
}

/**
 * Project an `EnrichedLookingForResult` onto the response field shape.
 * Extracted so the dedupe step can re-derive the same response shape from a
 * merged enrichment object.
 */
function enrichmentToFields(
  enriched: EnrichedLookingForResult,
): LookingForMatchEnrichment {
  const bestDetail = enriched.lookingForScores.find((d) => d.isBestMatchType);
  return {
    selectedLookingFor: enriched.selectedLookingFor,
    lookingForScoreDetails: enriched.lookingForScores,
    totalScore: enriched.totalScore,
    bestLookingFor: enriched.bestLookingFor,
    overallExplanation: enriched.overallExplanation,
    lookingForScores: enriched.legacyScoresMap,
    lookingForLabels: enriched.legacyLabelsMap,
    lookingForTotalScore: enriched.totalScore || null,
    score: enriched.totalScore,
    finalScore: enriched.totalScore,
    matchLevel: bestDetail ? bestDetail.matchLevel : "WEAK",
  };
}

/**
 * Identity payload extracted from a match row's matchedUser / matchedContact.
 * Used by `dedupeMatchesByTarget` to collapse the same person across rows.
 */
interface MatchRowIdentity {
  matchedUser?: {
    id?: string;
    email?: string | null;
    linkedinUrl?: string | null;
    fullName?: string | null;
    company?: string | null;
  } | null;
  matchedContact?: {
    id?: string;
    email?: string | null;
    linkedinUrl?: string | null;
    fullName?: string | null;
    company?: string | null;
  } | null;
}

function getMatchTargetIdentity(row: MatchRowIdentity) {
  return {
    userId: row.matchedUser?.id ?? null,
    contactId: row.matchedContact?.id ?? null,
    email: row.matchedUser?.email ?? row.matchedContact?.email ?? null,
    linkedinUrl: row.matchedUser?.linkedinUrl ?? row.matchedContact?.linkedinUrl ?? null,
    fullName: row.matchedUser?.fullName ?? row.matchedContact?.fullName ?? null,
    // The `name|company` fingerprint is what catches the
    // "registered-user vs added-as-contact" duplicate when emails diverge.
    company: row.matchedUser?.company ?? row.matchedContact?.company ?? null,
  };
}

/**
 * Pick the canonical row when two duplicates collide. We prefer the User row
 * over the Contact row (richer, system-authoritative profile), and if both
 * sides are the same kind we keep the higher-scoring one.
 */
function pickCanonicalMatch<T extends { matchedUser?: any; matchedContact?: any; matchScore?: number }>(
  a: T,
  b: T,
): T {
  const aHasUser = !!a.matchedUser?.id;
  const bHasUser = !!b.matchedUser?.id;
  if (aHasUser !== bHasUser) return aHasUser ? a : b;
  const aScore = a.matchScore ?? 0;
  const bScore = b.matchScore ?? 0;
  return aScore >= bScore ? a : b;
}

/**
 * Run the canonical "dedupe by target identity then re-stamp Looking For
 * fields from the merged enrichment" pipeline that's used by every endpoint
 * which returns enriched matches. Sorting/pagination happens AFTER this.
 */
function dedupeAndRestampMatches<
  T extends LookingForMatchEnrichment & {
    id: string;
    matchScore: number;
    matchedUser?: any;
    matchedContact?: any;
  },
>(items: Array<T & { __rawEnrichment?: EnrichedLookingForResult | null }>): T[] {
  const grouped = dedupeMatchesByTarget(items, {
    getIdentity: getMatchTargetIdentity,
    getEnrichment: (item) => item.__rawEnrichment ?? null,
    pickCanonical: pickCanonicalMatch,
  });

  return grouped.map(({ canonical, merged }) => {
    const out: any = { ...canonical };
    delete out.__rawEnrichment;
    if (merged) {
      Object.assign(out, enrichmentToFields(merged));
      out.__rawEnrichment = undefined;
    }
    return out as T;
  });
}


// Initialize matching service
const matchingService = new ProjectMatchingService(prisma);

/**
 * Readable category names for project classification.
 * The LLM is given these names directly and returns one.
 */
const READABLE_CATEGORIES = [
  "HealthTech",
  "FinTech",
  "EdTech",
  "SaaS",
  "E-Commerce",
  "AI/ML",
  "CleanTech",
  "PropTech",
  "AgriTech",
  "FoodTech",
  "LegalTech",
  "HR Tech",
  "Marketing",
  "InsurTech",
  "Logistics",
  "Gaming",
  "Social",
  "Media & Entertainment",
  "Cybersecurity",
  "IoT",
  "Blockchain",
];

/** Maps old coded keys to readable display names (for backwards compat) */
const KEY_TO_READABLE: Record<string, string> = {
  healthtech: "HealthTech",
  fintech: "FinTech",
  edtech: "EdTech",
  saas: "SaaS",
  ecommerce: "E-Commerce",
  aiml: "AI/ML",
  cleantech: "CleanTech",
  proptech: "PropTech",
  agritech: "AgriTech",
  foodtech: "FoodTech",
  legaltech: "LegalTech",
  hrtech: "HR Tech",
  martech: "Marketing",
  insurtech: "InsurTech",
  logistics: "Logistics",
  gaming: "Gaming",
  social: "Social",
  media: "Media & Entertainment",
  cybersecurity: "Cybersecurity",
  iot: "IoT",
  blockchain: "Blockchain",
  other: "Other",
};

/**
 * Clean an AI-returned category into a readable display name.
 * Returns the value as-is if it already matches a known name, or title-cases it.
 */
function cleanCategory(raw: string | undefined | null): string {
  if (!raw) return "Other";
  const trimmed = raw.trim();

  // 1. Already a readable category name (case-insensitive)?
  const match = READABLE_CATEGORIES.find(
    (c) => c.toLowerCase() === trimmed.toLowerCase(),
  );
  if (match) return match;

  // 2. Old coded key? Convert to readable name
  const lower = trimmed.toLowerCase().replace(/[\s/\-]+/g, "");
  if (KEY_TO_READABLE[lower]) return KEY_TO_READABLE[lower];

  // 3. Title-case the value as-is (capitalize first letter of each word)
  return trimmed.replace(/\b\w/g, (c) => c.toUpperCase());
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
 * Clean up extracted PDF/DOC text
 * Handles common extraction issues like character-per-line, bad spacing, etc.
 */
function cleanExtractedText(text: string): string {
  let cleaned = text;

  // Fix character-per-line issue (common in PDFs from presentations)
  const lines = cleaned.split("\n");
  const processedLines: string[] = [];
  let charBuffer = "";

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // If line is very short (1-2 chars) and not Arabic, check for sequence
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

    if (line) {
      processedLines.push(line);
    }
  }

  if (charBuffer) {
    processedLines.push(charBuffer);
  }

  cleaned = processedLines.join("\n");

  // Clean up whitespace
  cleaned = cleaned
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/(\S)\n(\S)/g, "$1 $2")
    .trim();

  // Fix punctuation
  cleaned = cleaned
    .replace(/\s+([.,;:!?])/g, "$1")
    .replace(/([.,;:!?])(\w)/g, "$1 $2");

  return cleaned;
}

/**
 * Project Controller
 *
 * Provides HTTP handlers for project CRUD and matching operations.
 */
export class ProjectController {
  /**
   * Get paginated list of user's projects
   *
   * GET /api/v1/projects
   *
   * Query params:
   * - page: page number (default 1)
   * - limit: items per page (default 20, max 100)
   * - status: filter by isActive (active, inactive, all)
   */
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AuthenticationError("Authentication required");
      }

      const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
      const limit = Math.min(
        100,
        Math.max(1, parseInt(req.query.limit as string, 10) || 20),
      );
      const status = req.query.status as string;

      // Scope by organization context
      const orgId = req.orgContext?.organizationId || null;
      const where: any = orgId
        ? { organizationId: orgId }
        : { userId: req.user.userId, organizationId: null };

      if (status === "active") {
        where.isActive = true;
      } else if (status === "inactive") {
        where.isActive = false;
      }

      const [projects, total] = await Promise.all([
        prisma.project.findMany({
          where,
          include: {
            sectors: { include: { sector: true } },
            skillsNeeded: { include: { skill: true } },
            _count: { select: { matches: true } },
          },
          orderBy: { createdAt: "desc" },
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.project.count({ where }),
      ]);

      res.status(200).json({
        success: true,
        data: {
          projects: projects.map((p) => ({
            ...p,
            lookingFor: safeJsonArray(p.lookingFor),
            keywords: safeJsonArray(p.keywords),
            needs: safeJsonArray(p.needs),
            markets: safeJsonArray(p.markets),
            tractionSignals: safeJsonArray(p.tractionSignals),
            advisoryTopics: safeJsonArray(p.advisoryTopics),
            partnerTypeNeeded: safeJsonArray(p.partnerTypeNeeded),
            targetCustomerTypes: safeJsonArray(p.targetCustomerTypes),
            engagementModel: safeJsonArray(p.engagementModel),
            sectors: p.sectors.map((ps) => ps.sector),
            skillsNeeded: p.skillsNeeded.map((ps) => ({
              ...ps.skill,
              importance: ps.importance,
            })),
            matchCount: p._count.matches,
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
   * Create a new project
   *
   * POST /api/v1/projects
   *
   * Body:
   * - title: string (required)
   * - summary: string (required)
   * - detailedDesc?: string
   * - category?: string
   * - stage?: ProjectStage
   * - investmentRange?: string
   * - timeline?: string
   * - lookingFor?: string[]
   * - sectorIds?: string[]
   * - skills?: Array<{ skillId: string, importance?: SkillImportance }>
   * - visibility?: ProjectVisibility
   */
  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AuthenticationError("Authentication required");
      }

      const {
        title,
        summary,
        detailedDesc,
        category,
        stage = "IDEA",
        investmentRange,
        timeline,
        lookingFor = [],
        sectorIds = [],
        skills = [],
        visibility = "PUBLIC",
        metadata,
        needs,
        markets,
        fundingAskMin,
        fundingAskMax,
        tractionSignals,
        advisoryTopics,
        partnerTypeNeeded,
        commitmentLevelNeeded,
        idealCounterpartProfile,
        targetCustomerTypes,
        engagementModel,
        strictLookingFor,
        documentUrl,
        documentName,
      } = req.body;

      logger.info("Create project request body keys", {
        hasDocumentUrl: documentUrl !== undefined,
        documentUrl: documentUrl || null,
        documentName: documentName || null,
        bodyKeys: Object.keys(req.body),
      });

      if (!title || !summary) {
        throw new ValidationError("Title and summary are required");
      }

      // Create project with related data
      const project = await prisma.project.create({
        data: {
          user: { connect: { id: req.user.userId } },
          title,
          summary,
          detailedDesc,
          category,
          stage: stage as ProjectStage,
          investmentRange,
          timeline,
          lookingFor,
          keywords: [],
          visibility: visibility as ProjectVisibility,
          ...(metadata !== undefined && { metadata }),
          ...(needs !== undefined && { needs }),
          ...(markets !== undefined && { markets }),
          ...(fundingAskMin !== undefined && {
            fundingAskMin:
              fundingAskMin != null
                ? parseInt(String(fundingAskMin), 10) || null
                : null,
          }),
          ...(fundingAskMax !== undefined && {
            fundingAskMax:
              fundingAskMax != null
                ? parseInt(String(fundingAskMax), 10) || null
                : null,
          }),
          ...(tractionSignals !== undefined && { tractionSignals }),
          ...(advisoryTopics !== undefined && { advisoryTopics }),
          ...(partnerTypeNeeded !== undefined && { partnerTypeNeeded }),
          ...(commitmentLevelNeeded !== undefined && { commitmentLevelNeeded }),
          ...(idealCounterpartProfile !== undefined && {
            idealCounterpartProfile,
          }),
          ...(targetCustomerTypes !== undefined && { targetCustomerTypes }),
          ...(engagementModel !== undefined && { engagementModel }),
          ...(strictLookingFor !== undefined && { strictLookingFor }),
          ...(documentUrl !== undefined && { documentUrl }),
          ...(documentName !== undefined && { documentName }),
          sectors: {
            create: sectorIds.map((sectorId: string) => ({ sectorId })),
          },
          skillsNeeded: {
            create: skills.map(
              (s: { skillId: string; importance?: string }) => ({
                skillId: s.skillId,
                importance: (s.importance || "REQUIRED") as SkillImportance,
              }),
            ),
          },
        },
        include: {
          sectors: { include: { sector: true } },
          skillsNeeded: { include: { skill: true } },
        },
      });

      // If in org mode, set the organizationId on the project
      if (req.orgContext?.organizationId) {
        await prisma.project.update({
          where: { id: project.id },
          data: { organizationId: req.orgContext.organizationId },
        });
      }

      logger.info("Project created", {
        userId: req.user.userId,
        projectId: project.id,
        title: project.title,
      });

      res.status(201).json({
        success: true,
        data: {
          ...project,
          sectors: project.sectors.map((ps) => ps.sector),
          skillsNeeded: project.skillsNeeded.map((ps) => ({
            ...ps.skill,
            importance: ps.importance,
          })),
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get a single project by ID
   *
   * GET /api/v1/projects/:id
   */
  async get(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AuthenticationError("Authentication required");
      }

      // Scope by organization context
      const orgId = req.orgContext?.organizationId || null;
      const ownerFilter = orgId
        ? { organizationId: orgId }
        : { userId: req.user.userId };

      const project = await prisma.project.findFirst({
        where: {
          id: String(req.params.id),
          ...ownerFilter,
        },
        include: {
          sectors: { include: { sector: true } },
          skillsNeeded: { include: { skill: true } },
          matches: {
            include: {
              matchedUser: {
                select: {
                  id: true,
                  fullName: true,
                  email: true,
                  linkedinUrl: true,
                  company: true,
                  jobTitle: true,
                  avatarUrl: true,
                  bio: true,
                  userSkills: { select: { skillId: true, skill: { select: { name: true } } } },
                  userSectors: { select: { sectorId: true, sector: { select: { name: true } } } },
                },
              },
              matchedContact: {
                select: {
                  id: true,
                  fullName: true,
                  email: true,
                  company: true,
                  jobTitle: true,
                  phone: true,
                  linkedinUrl: true,
                  bio: true,
                  contactSkills: { select: { skillId: true, skill: { select: { name: true } } } },
                  contactSectors: { select: { sectorId: true, sector: { select: { name: true } } } },
                },
              },
            },
            orderBy: { matchScore: "desc" },
            take: 50,
          },
        },
      });

      if (!project) {
        throw new NotFoundError("Project not found");
      }

      // Per-role lookingFor scoring for the embedded matches.
      const projectLookingFor = safeJsonArray(project.lookingFor) as string[];

      // Build the project-side scoring input once (skills + sectors needed).
      const projectInput: ProjectScoringInput = {
        skillIds: project.skillsNeeded.map((ps) => ps.skillId),
        skillNames: project.skillsNeeded.map((ps) => ps.skill?.name).filter(Boolean) as string[],
        sectorIds: project.sectors.map((ps) => ps.sectorId),
        sectorNames: project.sectors
          .map((ps: any) => ps.sector?.name ?? null)
          .filter(Boolean) as string[],
      };

      // Build each match's contact-side scoring input.
      const matchInputs: Array<{ m: typeof project.matches[number]; ci: ContactScoringInput }> = project.matches.map((m) => {
        const u = m.matchedUser as any;
        const c = m.matchedContact as any;
        const person = u || c;
        const skills = (u?.userSkills || c?.contactSkills || []) as Array<{ skillId: string; skill?: { name: string } }>;
        const sectorRows = (u?.userSectors || c?.contactSectors || []) as Array<{ sectorId: string; sector?: { name: string } }>;
        return {
          m,
          ci: {
            jobTitle: person?.jobTitle,
            company: person?.company,
            bio: person?.bio ?? null,
            skillIds: skills.map((s) => s.skillId),
            skillNames: skills.map((s) => s.skill?.name).filter(Boolean) as string[],
            sectorIds: sectorRows.map((s) => s.sectorId),
            sectorNames: sectorRows
              .map((s) => s.sector?.name ?? null)
              .filter(Boolean) as string[],
          },
        };
      });

      // Tier 3 + 4: semantic blend (best-effort; null on failure → keyword-only).
      let semanticPerMatch: Array<Record<string, number> | null> = matchInputs.map(() => null);
      if (projectLookingFor.length && matchInputs.length) {
        try {
          semanticPerMatch = await semanticScoreManyContacts(
            projectLookingFor,
            matchInputs.map((mi) => mi.ci),
          );
        } catch {
          // Already logged inside the scorer; treat as no-semantic.
        }
      }

      const scoredMatches = matchInputs.map(({ m, ci }, idx) => {
        const semScores = semanticPerMatch[idx];
        const lf = buildLookingForEnrichment(
          projectLookingFor,
          ci,
          projectInput,
          semScores,
        );
        const baseRecord = {
          id: m.id,
          matchScore: m.matchScore,
          matchType: m.matchType,
          reasons: safeJsonArray(m.reasons),
          suggestedAction: m.suggestedAction,
          suggestedMessage: m.suggestedMessage,
          sharedSectors: safeJsonArray(m.sharedSectors),
          sharedSkills: safeJsonArray(m.sharedSkills),
          status: m.status,
          matchedUser: m.matchedUser,
          matchedContact: m.matchedContact,
          createdAt: m.createdAt,
        };
        if (!lf) {
          return {
            ...baseRecord,
            selectedLookingFor: [] as LookingForType[],
            lookingForScoreDetails: [],
            lookingForScores: null,
            lookingForLabels: null,
            lookingForTotalScore: null,
            totalScore: m.matchScore,
            bestLookingFor: null,
            overallExplanation: null,
            score: m.matchScore,
            finalScore: m.matchScore,
            matchLevel: undefined,
            __rawEnrichment: null as EnrichedLookingForResult | null,
          };
        }
        return { ...baseRecord, ...lf.fields, __rawEnrichment: lf.raw };
      });

      // Dedupe by canonical target identity (collapses same person across
      // user + contact + multiple-contact rows). Then sort, then filter.
      const enrichedMatches = dedupeAndRestampMatches(scoredMatches as any);

      enrichedMatches.sort((a, b) =>
        rankByTotalLookingForScore(
          {
            totalScore: a.totalScore ?? a.matchScore,
            bestConfidence:
              a.lookingForScoreDetails?.find((d) => d.isBestMatchType)
                ?.confidence ?? 0,
            matchScore: a.matchScore,
            bestDeterministicScore:
              a.lookingForScoreDetails?.find((d) => d.isBestMatchType)?.score ??
              0,
          },
          {
            totalScore: b.totalScore ?? b.matchScore,
            bestConfidence:
              b.lookingForScoreDetails?.find((d) => d.isBestMatchType)
                ?.confidence ?? 0,
            matchScore: b.matchScore,
            bestDeterministicScore:
              b.lookingForScoreDetails?.find((d) => d.isBestMatchType)?.score ??
              0,
          },
        ),
      );

      const visibleMatches = projectLookingFor.length
        ? enrichedMatches.filter((m) => (m.lookingForTotalScore ?? 0) > 0)
        : enrichedMatches;

      res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.status(200).json({
        success: true,
        data: {
          ...project,
          lookingFor: projectLookingFor,
          keywords: safeJsonArray(project.keywords),
          needs: safeJsonArray(project.needs),
          markets: safeJsonArray(project.markets),
          tractionSignals: safeJsonArray(project.tractionSignals),
          advisoryTopics: safeJsonArray(project.advisoryTopics),
          partnerTypeNeeded: safeJsonArray(project.partnerTypeNeeded),
          targetCustomerTypes: safeJsonArray(project.targetCustomerTypes),
          engagementModel: safeJsonArray(project.engagementModel),
          sectors: project.sectors.map((ps) => ps.sector),
          skillsNeeded: project.skillsNeeded.map((ps) => ({
            ...ps.skill,
            importance: ps.importance,
          })),
          matches: visibleMatches,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update a project
   *
   * PUT /api/v1/projects/:id
   */
  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AuthenticationError("Authentication required");
      }

      // Scope by organization context
      const orgId = req.orgContext?.organizationId || null;
      const ownerFilter = orgId
        ? { organizationId: orgId }
        : { userId: req.user.userId };

      const existingProject = await prisma.project.findFirst({
        where: {
          id: String(req.params.id),
          ...ownerFilter,
        },
      });

      if (!existingProject) {
        throw new NotFoundError("Project not found");
      }

      const {
        title,
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
        isActive,
        metadata,
        needs,
        markets,
        fundingAskMin,
        fundingAskMax,
        tractionSignals,
        advisoryTopics,
        partnerTypeNeeded,
        commitmentLevelNeeded,
        idealCounterpartProfile,
        targetCustomerTypes,
        engagementModel,
        strictLookingFor,
        documentUrl,
        documentName,
      } = req.body;

      // Update project
      const updateData: any = {};
      if (title !== undefined) updateData.title = title;
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
      if (isActive !== undefined) updateData.isActive = isActive;
      if (metadata !== undefined) updateData.metadata = metadata;
      if (needs !== undefined) updateData.needs = needs;
      if (markets !== undefined) updateData.markets = markets;
      if (fundingAskMin !== undefined)
        updateData.fundingAskMin =
          fundingAskMin != null
            ? parseInt(String(fundingAskMin), 10) || null
            : null;
      if (fundingAskMax !== undefined)
        updateData.fundingAskMax =
          fundingAskMax != null
            ? parseInt(String(fundingAskMax), 10) || null
            : null;
      if (tractionSignals !== undefined)
        updateData.tractionSignals = tractionSignals;
      if (advisoryTopics !== undefined)
        updateData.advisoryTopics = advisoryTopics;
      if (partnerTypeNeeded !== undefined)
        updateData.partnerTypeNeeded = partnerTypeNeeded;
      if (commitmentLevelNeeded !== undefined)
        updateData.commitmentLevelNeeded = commitmentLevelNeeded;
      if (idealCounterpartProfile !== undefined)
        updateData.idealCounterpartProfile = idealCounterpartProfile;
      if (targetCustomerTypes !== undefined)
        updateData.targetCustomerTypes = targetCustomerTypes;
      if (engagementModel !== undefined)
        updateData.engagementModel = engagementModel;
      if (strictLookingFor !== undefined)
        updateData.strictLookingFor = strictLookingFor;
      if (documentUrl !== undefined) {
        updateData.documentUrl = documentUrl;
        // Delete old document from storage if being replaced
        if (existingProject.documentUrl && documentUrl !== existingProject.documentUrl) {
          try {
            const { getStorageService } = require('../../infrastructure/external/storage');
            const oldKey = existingProject.documentUrl.replace(/^.*\/p2p-uploads\//, '');
            if (oldKey) {
              await getStorageService().delete('p2p-uploads', oldKey);
              logger.info("Old document deleted from storage", { oldKey });
            }
          } catch (delErr: any) {
            logger.warn("Failed to delete old document", { error: delErr.message });
          }
        }
      }
      if (documentName !== undefined)
        updateData.documentName = documentName;

      logger.info("Update project data", {
        projectId: String(req.params.id),
        hasDocumentUrl: documentUrl !== undefined,
        documentUrl: documentUrl || null,
        documentName: documentName || null,
        updateKeys: Object.keys(updateData),
      });

      // Clear keywords to force re-extraction on next match
      if (title || summary || detailedDesc) {
        updateData.keywords = [];
      }

      // Run all updates in a transaction to prevent partial updates
      const project = await prisma.$transaction(async (tx) => {
        // Update sectors if provided
        if (sectorIds !== undefined) {
          await tx.projectSector.deleteMany({
            where: { projectId: String(req.params.id) },
          });
          if (sectorIds.length > 0) {
            await tx.projectSector.createMany({
              data: sectorIds.map((sectorId: string) => ({
                projectId: req.params.id,
                sectorId,
              })),
            });
          }
        }

        // Update skills if provided
        if (skills !== undefined) {
          await tx.projectSkill.deleteMany({
            where: { projectId: String(req.params.id) },
          });
          if (skills.length > 0) {
            await tx.projectSkill.createMany({
              data: skills.map((s: { skillId: string; importance?: string }) => ({
                projectId: req.params.id,
                skillId: s.skillId,
                importance: (s.importance || "REQUIRED") as SkillImportance,
              })),
            });
          }
        }

        // Update main project record
        return tx.project.update({
          where: { id: String(req.params.id) },
          data: updateData,
          include: {
            sectors: { include: { sector: true } },
            skillsNeeded: { include: { skill: true } },
          },
        });
      });

      logger.info("Project updated", {
        userId: req.user.userId,
        projectId: project.id,
      });

      res.status(200).json({
        success: true,
        data: {
          ...project,
          lookingFor: safeJsonArray(project.lookingFor),
          keywords: safeJsonArray(project.keywords),
          needs: safeJsonArray(project.needs),
          markets: safeJsonArray(project.markets),
          tractionSignals: safeJsonArray(project.tractionSignals),
          advisoryTopics: safeJsonArray(project.advisoryTopics),
          partnerTypeNeeded: safeJsonArray(project.partnerTypeNeeded),
          targetCustomerTypes: safeJsonArray(project.targetCustomerTypes),
          engagementModel: safeJsonArray(project.engagementModel),
          sectors: project.sectors.map((ps) => ps.sector),
          skillsNeeded: project.skillsNeeded.map((ps) => ({
            ...ps.skill,
            importance: ps.importance,
          })),
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Delete a project
   *
   * DELETE /api/v1/projects/:id
   */
  async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AuthenticationError("Authentication required");
      }

      // Scope by organization context
      const orgId = req.orgContext?.organizationId || null;
      const ownerFilter = orgId
        ? { organizationId: orgId }
        : { userId: req.user.userId };

      const existingProject = await prisma.project.findFirst({
        where: {
          id: String(req.params.id),
          ...ownerFilter,
        },
      });

      if (!existingProject) {
        throw new NotFoundError("Project not found");
      }

      await prisma.project.delete({ where: { id: String(req.params.id) } });

      logger.info("Project deleted", {
        userId: req.user.userId,
        projectId: req.params.id,
      });

      res.status(200).json({
        success: true,
        message: "Project deleted successfully",
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Trigger matching process for a project
   *
   * POST /api/v1/projects/:id/find-matches
   *
   * Query params:
   * - async: boolean - If true, run matching in background and return job ID
   */
  async findMatches(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      if (!req.user) {
        throw new AuthenticationError("Authentication required");
      }

      const projectId = String(req.params.id);
      const useAsync = req.query.async === "true";

      // Verify project ownership - scope by organization context
      const orgId = req.orgContext?.organizationId || null;
      const ownerFilter = orgId
        ? { organizationId: orgId }
        : { userId: req.user.userId };

      const project = await prisma.project.findFirst({
        where: {
          id: projectId,
          ...ownerFilter,
        },
      });

      if (!project) {
        throw new NotFoundError("Project not found");
      }

      logger.info("Starting project matching", {
        userId: req.user.userId,
        projectId,
        async: useAsync,
      });

      // If async mode, queue the job and return immediately
      if (useAsync) {
        const { jobId, queued } = await triggerProjectMatching(
          projectId,
          req.user.userId,
        );

        if (queued && jobId) {
          res.status(202).json({
            success: true,
            data: {
              jobId,
              status: "queued",
              message:
                "Project matching job queued. You will be notified when complete.",
            },
          });
          return;
        }

        // If queue not available, fall through to sync mode
        logger.info("Queue not available, falling back to sync mode", {
          projectId,
        });
      }

      // Validate that at least one Looking For type can be resolved before we
      // run matching. The user must select chips OR the project must have a
      // persisted lookingFor. Per spec Part 6 (1) and Part 17 (3).
      const reqSelectedRawTop = (req.body?.selectedLookingFor ?? req.body?.lookingFor) as
        | string[]
        | undefined;
      const reqSelectedTop = Array.isArray(reqSelectedRawTop)
        ? reqSelectedRawTop.filter((v): v is string => typeof v === "string")
        : [];
      const persistedLookingFor = Array.isArray(project.lookingFor)
        ? (project.lookingFor as string[])
        : [];
      if (!reqSelectedTop.length && !persistedLookingFor.length) {
        res.status(400).json({
          success: false,
          error: {
            code: "MISSING_LOOKING_FOR",
            message:
              "At least one Looking For option must be selected to run matching.",
          },
        });
        return;
      }

      // Synchronous mode (default) - use advanced matching engine
      const matchOrgId = req.orgContext?.organizationId || undefined;
      const matches = await advancedFindMatches(
        prisma,
        projectId,
        req.user.userId,
        matchOrgId,
      );

      logger.info("Project matching completed", {
        userId: req.user.userId,
        projectId,
        matchCount: matches.length,
      });

      // Fetch full match data with skills/sectors so the new scorer can use them.
      const fullMatches = await prisma.projectMatch.findMany({
        where: { projectId },
        include: {
          matchedUser: {
            select: {
              id: true,
              fullName: true,
              email: true,
              company: true,
              jobTitle: true,
              avatarUrl: true,
              phone: true,
              linkedinUrl: true,
              bio: true,
              userSkills: { select: { skillId: true, skill: { select: { name: true } } } },
              userSectors: { select: { sectorId: true, sector: { select: { name: true } } } },
            },
          },
          matchedContact: {
            select: {
              id: true,
              fullName: true,
              email: true,
              company: true,
              jobTitle: true,
              phone: true,
              linkedinUrl: true,
              bio: true,
              contactSkills: { select: { skillId: true, skill: { select: { name: true } } } },
              contactSectors: { select: { sectorId: true, sector: { select: { name: true } } } },
            },
          },
        },
        orderBy: { matchScore: "desc" },
      });

      // Pull project skills/sectors for the bonus (include sector NAMES so
      // the synonym layer can collapse cross-source label variants).
      const projectFM = await prisma.project.findUnique({
        where: { id: projectId },
        include: {
          skillsNeeded: { include: { skill: true } },
          sectors: { include: { sector: true } },
        },
      });
      // Resolve which Looking For types to score against, in priority order:
      //   1. `selectedLookingFor` (canonical, multi-select from the chip UI)
      //   2. `lookingFor` (alias accepted in the request body)
      //   3. `project.lookingFor` (persisted on the project)
      // The matching engine requires at least one — a 400 is returned upstream
      // when none can be resolved (Slice 2 plan).
      const reqSelectedRaw = (req.body?.selectedLookingFor ?? req.body?.lookingFor) as
        | string[]
        | undefined;
      const reqSelected = Array.isArray(reqSelectedRaw)
        ? reqSelectedRaw.filter((v): v is string => typeof v === "string")
        : [];
      const fmLookingFor: string[] = reqSelected.length
        ? reqSelected
        : projectFM
          ? (Array.isArray(projectFM.lookingFor) ? (projectFM.lookingFor as string[]) : [])
          : [];
      // Persist the request-supplied chip selection so subsequent GETs render
      // the same per-Looking-For enrichment without the user having to also
      // edit the project. We only write when the user explicitly supplied a
      // chip selection — otherwise leave the stored value untouched.
      if (reqSelected.length) {
        try {
          await prisma.project.update({
            where: { id: projectId },
            data: { lookingFor: reqSelected },
          });
        } catch (err) {
          logger.warn("Failed to persist selectedLookingFor on project", {
            projectId,
            error: err,
          });
        }
      }
      const fmProjectInput: ProjectScoringInput = {
        skillIds: projectFM?.skillsNeeded?.map((ps) => ps.skillId) || [],
        skillNames: (projectFM?.skillsNeeded?.map((ps) => ps.skill?.name).filter(Boolean) as string[]) || [],
        sectorIds: projectFM?.sectors?.map((ps) => ps.sectorId) || [],
        sectorNames: ((projectFM?.sectors as any[] | undefined)
          ?.map((ps: any) => ps.sector?.name ?? null)
          .filter(Boolean) as string[]) || [],
      };

      const fmInputs = fullMatches.map((m) => {
        const u = m.matchedUser as any;
        const c = m.matchedContact as any;
        const person = u || c;
        const skills = (u?.userSkills || c?.contactSkills || []) as Array<{ skillId: string; skill?: { name: string } }>;
        const sectorRows = (u?.userSectors || c?.contactSectors || []) as Array<{ sectorId: string; sector?: { name: string } }>;
        return {
          m,
          ci: {
            jobTitle: person?.jobTitle,
            company: person?.company,
            bio: person?.bio ?? null,
            skillIds: skills.map((s) => s.skillId),
            skillNames: skills.map((s) => s.skill?.name).filter(Boolean) as string[],
            sectorIds: sectorRows.map((s) => s.sectorId),
            sectorNames: sectorRows
              .map((s) => s.sector?.name ?? null)
              .filter(Boolean) as string[],
          } as ContactScoringInput,
        };
      });

      let fmSemantic: Array<Record<string, number> | null> = fmInputs.map(() => null);
      if (fmLookingFor.length && fmInputs.length) {
        try {
          fmSemantic = await semanticScoreManyContacts(
            fmLookingFor,
            fmInputs.map((mi) => mi.ci),
          );
        } catch {
          // semantic best-effort
        }
      }

      const fmScored = fmInputs.map(({ m, ci }, idx) => {
        const lf = buildLookingForEnrichment(
          fmLookingFor,
          ci,
          fmProjectInput,
          fmSemantic[idx],
        );
        const baseRecord = {
          id: m.id,
          matchScore: m.matchScore,
          matchType: m.matchType,
          reasons: m.reasons,
          suggestedAction: m.suggestedAction,
          suggestedMessage: m.suggestedMessage,
          suggestedMessageEdited: m.suggestedMessageEdited,
          sharedSectors: m.sharedSectors,
          sharedSkills: m.sharedSkills,
          status: m.status,
          matchedUser: m.matchedUser,
          matchedContact: m.matchedContact,
          createdAt: m.createdAt,
          deterministicScore: m.deterministicScore,
          confidence: m.confidence,
          scoreBreakdown: m.scoreBreakdown,
          explanation: m.explanation,
          intent: m.intent,
          rank: m.rank,
        };
        if (!lf) {
          return {
            ...baseRecord,
            matchLevel: m.matchLevel,
            selectedLookingFor: [] as LookingForType[],
            lookingForScoreDetails: [],
            lookingForScores: null,
            lookingForLabels: null,
            lookingForTotalScore: null,
            totalScore: m.matchScore,
            bestLookingFor: null,
            overallExplanation: null,
            score: m.matchScore,
            finalScore: m.matchScore,
            __rawEnrichment: null as EnrichedLookingForResult | null,
          };
        }
        return { ...baseRecord, ...lf.fields, __rawEnrichment: lf.raw };
      });

      // Dedupe across user + contact rows for the same person, then sort.
      const fmEnriched = dedupeAndRestampMatches(fmScored as any);

      fmEnriched.sort((a, b) =>
        rankByTotalLookingForScore(
          {
            totalScore: a.totalScore ?? a.matchScore,
            bestConfidence:
              a.lookingForScoreDetails?.find((d) => d.isBestMatchType)
                ?.confidence ?? 0,
            matchScore: a.matchScore,
            bestDeterministicScore:
              a.lookingForScoreDetails?.find((d) => d.isBestMatchType)?.score ??
              0,
          },
          {
            totalScore: b.totalScore ?? b.matchScore,
            bestConfidence:
              b.lookingForScoreDetails?.find((d) => d.isBestMatchType)
                ?.confidence ?? 0,
            matchScore: b.matchScore,
            bestDeterministicScore:
              b.lookingForScoreDetails?.find((d) => d.isBestMatchType)?.score ??
              0,
          },
        ),
      );

      const fmVisible = fmLookingFor.length
        ? fmEnriched.filter((m) => (m.lookingForTotalScore ?? 0) > 0)
        : fmEnriched;

      // Keep `_count.matches` in sync with what the UI actually shows. Rows
      // that scored 0 across every selected Looking For type are invisible to
      // the user but still inflate the project header's match count — delete
      // them now so the next project-list query agrees with the find-match
      // response. Best-effort: failure here only loses the cosmetic alignment.
      if (fmLookingFor.length && fmVisible.length < fmEnriched.length) {
        const visibleIds = new Set(fmVisible.map((m) => m.id));
        const staleIds = fmEnriched
          .map((m) => m.id)
          .filter((id) => !visibleIds.has(id));
        if (staleIds.length) {
          try {
            await prisma.projectMatch.deleteMany({
              where: { id: { in: staleIds } },
            });
          } catch (err) {
            logger.warn(
              "Failed to prune zero-scoring matches; project count may overstate",
              { projectId, count: staleIds.length, error: err },
            );
          }
        }
      }

      res.status(200).json({
        success: true,
        data: {
          matchCount: fmVisible.length,
          matches: fmVisible,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get matching job status
   *
   * GET /api/v1/projects/:id/match-status/:jobId
   */
  async getMatchJobStatus(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      if (!req.user) {
        throw new AuthenticationError("Authentication required");
      }

      const { id: projectId, jobId } = req.params;

      // Verify project ownership - scope by organization context
      const orgId = req.orgContext?.organizationId || null;
      const ownerFilter = orgId
        ? { organizationId: orgId }
        : { userId: req.user.userId };

      const project = await prisma.project.findFirst({
        where: {
          id: String(projectId),
          ...ownerFilter,
        },
      });

      if (!project) {
        throw new NotFoundError("Project not found");
      }

      const status = await getProjectMatchingJobStatus(String(jobId));

      if (!status) {
        throw new NotFoundError("Job not found");
      }

      res.status(200).json({
        success: true,
        data: status,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get matches for a project
   *
   * GET /api/v1/projects/:id/matches
   *
   * Query params:
   * - type: filter by matchType (user, contact, all)
   * - status: filter by status (pending, contacted, saved, dismissed)
   * - minScore: minimum match score
   */
  async getMatches(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      if (!req.user) {
        throw new AuthenticationError("Authentication required");
      }

      const projectId = req.params.id;

      // Verify ownership - scope by organization context
      const orgId = req.orgContext?.organizationId || null;
      const ownerFilter = orgId
        ? { organizationId: orgId }
        : { userId: req.user.userId };

      const project = await prisma.project.findFirst({
        where: {
          id: String(projectId),
          ...ownerFilter,
        },
      });

      if (!project) {
        throw new NotFoundError("Project not found");
      }

      const where: any = { projectId };

      const matchType = req.query.type as string;
      if (matchType && matchType !== "all") {
        where.matchType = matchType;
      }

      const status = req.query.status as string;
      if (status) {
        where.status = status.toUpperCase() as ProjectMatchStatus;
      } else {
        where.status = {
          notIn: ["DISMISSED", "ARCHIVED"] as ProjectMatchStatus[],
        };
      }

      const minScore = req.query.minScore
        ? parseFloat(req.query.minScore as string)
        : undefined;
      if (minScore !== undefined) {
        where.matchScore = { gte: minScore };
      }

      const matches = await prisma.projectMatch.findMany({
        where,
        include: {
          matchedUser: {
            select: {
              id: true,
              fullName: true,
              email: true,
              company: true,
              jobTitle: true,
              avatarUrl: true,
              phone: true,
              linkedinUrl: true,
              bio: true,
            },
          },
          matchedContact: {
            select: {
              id: true,
              fullName: true,
              email: true,
              company: true,
              jobTitle: true,
              phone: true,
              linkedinUrl: true,
              bio: true,
            },
          },
        },
        orderBy: { matchScore: "desc" },
      });

      // Per-role lookingFor scoring: for each match, compute a 0-100 score
      // for every role the project is looking for. The match's "total" for the
      // UI is the maximum of those role scores. Re-sort by that total so the
      // best fit-for-any-role surfaces first.
      const projectLookingFor = Array.isArray((project as any).lookingFor)
        ? ((project as any).lookingFor as string[])
        : [];

      const scored = matches.map((m) => {
        const person = m.matchedUser || m.matchedContact;
        const lf = buildLookingForEnrichment(
          projectLookingFor,
          {
            jobTitle: person?.jobTitle,
            company: person?.company,
            bio: (person as any)?.bio ?? null,
          },
          undefined,
          null,
        );
        const baseRecord = {
          id: m.id,
          matchScore: m.matchScore,
          matchType: m.matchType,
          reasons: m.reasons,
          suggestedAction: m.suggestedAction,
          suggestedMessage: m.suggestedMessage,
          suggestedMessageEdited: m.suggestedMessageEdited,
          sharedSectors: m.sharedSectors,
          sharedSkills: m.sharedSkills,
          status: m.status,
          matchedUser: m.matchedUser,
          matchedContact: m.matchedContact,
          createdAt: m.createdAt,
          // v2 advanced matching fields
          deterministicScore: m.deterministicScore,
          confidence: m.confidence,
          scoreBreakdown: m.scoreBreakdown,
          explanation: m.explanation,
          intent: m.intent,
          rank: m.rank,
        };
        if (!lf) {
          return {
            ...baseRecord,
            matchLevel: m.matchLevel,
            selectedLookingFor: [] as LookingForType[],
            lookingForScoreDetails: [],
            lookingForScores: null,
            lookingForLabels: null,
            lookingForTotalScore: null,
            totalScore: m.matchScore,
            bestLookingFor: null,
            overallExplanation: null,
            score: m.matchScore,
            finalScore: m.matchScore,
            __rawEnrichment: null as EnrichedLookingForResult | null,
          };
        }
        return { ...baseRecord, ...lf.fields, __rawEnrichment: lf.raw };
      });

      // Dedupe by canonical target identity. Sorting / pagination happen
      // AFTER deduplication so the same person never produces multiple cards.
      const enriched = dedupeAndRestampMatches(scored as any);

      // Re-sort by totalScore (max of selected Looking For scores). Fall back
      // to legacy matchScore when no Looking For is configured.
      enriched.sort((a, b) =>
        rankByTotalLookingForScore(
          {
            totalScore: a.totalScore ?? a.matchScore,
            bestConfidence:
              a.lookingForScoreDetails?.find((d) => d.isBestMatchType)
                ?.confidence ?? 0,
            matchScore: a.matchScore,
            bestDeterministicScore:
              a.lookingForScoreDetails?.find((d) => d.isBestMatchType)?.score ??
              0,
          },
          {
            totalScore: b.totalScore ?? b.matchScore,
            bestConfidence:
              b.lookingForScoreDetails?.find((d) => d.isBestMatchType)
                ?.confidence ?? 0,
            matchScore: b.matchScore,
            bestDeterministicScore:
              b.lookingForScoreDetails?.find((d) => d.isBestMatchType)?.score ??
              0,
          },
        ),
      );

      res.status(200).json({
        success: true,
        data: { matches: enriched },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update match status
   *
   * PUT /api/v1/projects/:id/matches/:matchId/status
   *
   * Body:
   * - status: 'pending' | 'contacted' | 'saved' | 'dismissed' | 'connected'
   */
  async updateMatchStatus(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      if (!req.user) {
        throw new AuthenticationError("Authentication required");
      }

      const { id: projectId, matchId } = req.params;
      const { status, suggestedMessageEdited } = req.body;

      // Verify ownership - scope by organization context
      const orgId = req.orgContext?.organizationId || null;
      const ownerFilter = orgId
        ? { organizationId: orgId }
        : { userId: req.user.userId };

      const project = await prisma.project.findFirst({
        where: {
          id: String(projectId),
          ...ownerFilter,
        },
      });

      if (!project) {
        throw new NotFoundError("Project not found");
      }

      const updateData: any = {};

      if (status) {
        const validStatuses = [
          "PENDING",
          "CONTACTED",
          "SAVED",
          "DISMISSED",
          "CONNECTED",
          "ARCHIVED",
        ];
        const normalizedStatus = status?.toUpperCase();
        if (!validStatuses.includes(normalizedStatus)) {
          throw new ValidationError(
            `Invalid status. Must be one of: ${validStatuses.join(", ")}`,
          );
        }
        updateData.status = normalizedStatus as ProjectMatchStatus;
        if (normalizedStatus === "ARCHIVED") {
          updateData.archivedAt = new Date();
        }
      }

      if (suggestedMessageEdited !== undefined) {
        updateData.suggestedMessageEdited = suggestedMessageEdited;
      }

      const match = await prisma.projectMatch.update({
        where: { id: String(matchId) },
        data: updateData,
      });

      logger.info("Match status updated", {
        userId: req.user.userId,
        projectId,
        matchId,
        status: updateData.status || "unchanged",
      });

      res.status(200).json({
        success: true,
        data: match,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Discover public projects from other users
   *
   * GET /api/v1/projects/discover/all
   *
   * Query params:
   * - page: page number (default 1)
   * - limit: items per page (default 20)
   * - category: filter by category
   * - stage: filter by stage
   * - sector: filter by sector ID
   */
  async discover(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      if (!req.user) {
        throw new AuthenticationError("Authentication required");
      }

      const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
      const limit = Math.min(
        100,
        Math.max(1, parseInt(req.query.limit as string, 10) || 20),
      );

      const where: any = {
        userId: { not: req.user.userId },
        visibility: "PUBLIC",
        isActive: true,
      };

      if (req.query.category) {
        where.category = req.query.category as string;
      }

      if (req.query.stage) {
        where.stage = req.query.stage as ProjectStage;
      }

      if (req.query.sector) {
        where.sectors = {
          some: { sectorId: req.query.sector as string },
        };
      }

      const [projects, total] = await Promise.all([
        prisma.project.findMany({
          where,
          include: {
            user: {
              select: {
                id: true,
                fullName: true,
                company: true,
                avatarUrl: true,
              },
            },
            sectors: { include: { sector: true } },
            skillsNeeded: { include: { skill: true } },
          },
          orderBy: { createdAt: "desc" },
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.project.count({ where }),
      ]);

      res.status(200).json({
        success: true,
        data: {
          projects: projects.map((p) => ({
            id: p.id,
            title: p.title,
            summary: p.summary,
            category: p.category,
            stage: p.stage,
            lookingFor: safeJsonArray(p.lookingFor),
            sectors: p.sectors.map((ps) => ps.sector),
            skillsNeeded: p.skillsNeeded.map((ps) => ({
              ...ps.skill,
              importance: ps.importance,
            })),
            user: p.user,
            createdAt: p.createdAt,
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
   * Analyze project text and suggest category, sectors, skills, lookingFor using AI
   *
   * POST /api/v1/projects/analyze-text
   *
   * Body: { title, summary, detailedDesc? }
   * Returns AI-suggested category, sectorIds, skills, lookingFor, stage, whatYouNeed
   */
  async analyzeText(
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

      const projectText = [title, summary, detailedDesc]
        .filter(Boolean)
        .join("\n\n");

      if (projectText.trim().length < 10) {
        throw new ValidationError(
          "Please provide more details for AI analysis",
        );
      }

      const groqApiKey = process.env.GROQ_API_KEY;
      if (!groqApiKey) {
        throw new ValidationError("AI service not configured");
      }

      // Get available sectors and skills
      const [sectors, skills] = await Promise.all([
        prisma.sector.findMany({
          where: { isActive: true },
          select: { id: true, name: true },
          take: 100,
        }),
        prisma.skill.findMany({
          where: { isActive: true },
          select: { id: true, name: true },
          take: 100,
        }),
      ]);

      const readableCategories = READABLE_CATEGORIES;

      const lookingForOptions = [
        "investor",
        "advisor",
        "service_provider",
        "strategic_partner",
        "channel_distribution",
        "technical_partner",
        "cofounder_talent",
      ];

      const prompt = `You are a startup and business expert. Analyze this project idea and suggest the BEST matching options.

PROJECT:
Title: ${title || ""}
Summary: ${summary || ""}
${detailedDesc ? `Details: ${detailedDesc.substring(0, 3000)}` : ""}

CATEGORY OPTIONS: ${readableCategories.join(", ")}
LOOKING FOR OPTIONS: ${lookingForOptions.join(", ")}
STAGE OPTIONS: IDEA, MVP, EARLY, GROWTH, SCALE
AVAILABLE SECTORS (use EXACT names): ${sectors.map((s) => s.name).join(", ")}
AVAILABLE SKILLS (use EXACT names): ${skills.map((s) => s.name).join(", ")}
MARKET OPTIONS (use EXACT values): mena, gcc, north_america, europe, asia_pacific, latin_america, africa, saudi_arabia, uae, usa, uk, india, china, egypt, jordan, bahrain, kuwait, qatar, oman, turkey, germany, france, canada, australia, singapore, japan, south_korea, brazil, nigeria, south_africa, global

Return JSON:
{
  "category": "Best matching category from CATEGORY OPTIONS",
  "stage": "Best matching stage",
  "lookingFor": ["Select only 2-4 MOST relevant from LOOKING FOR OPTIONS. Be selective."],
  "sectors": ["Select 3-5 MOST relevant from AVAILABLE SECTORS. EXACT names only."],
  "skills": ["Select 4-6 MOST critical from AVAILABLE SKILLS. EXACT names only."],
  "whatYouNeed": "2-3 sentences describing what this project needs to succeed",
  "needs": ["4-6 specific project needs as tags"],
  "markets": ["GEOGRAPHIC REGIONS only — select 2-3 codes from MARKET OPTIONS. Examples: mena, north_america, global. NOT customer types."],
  "idealCounterpartProfile": "2-3 sentences describing the ideal partner/advisor/investor",
  "partnerTypeNeeded": ["Partner types needed if applicable"],
  "commitmentLevelNeeded": "LOW | PART_TIME | FULL_TIME | FLEXIBLE",
  "engagementModel": ["1-3 from: EQUITY, CASH, REVENUE_SHARE, PARTNERSHIP, CONTRACT, ADVISORY"],
  "targetCustomerTypes": ["Target customers: SMEs, Enterprise, B2C, B2B, Government, Startups, etc."],
  "tractionSignals": ["relevant traction indicators if mentioned"],
  "advisoryTopics": ["areas where advice is needed"]
}

RULES:
- Use ONLY exact values from the provided option lists.
- markets = GEOGRAPHIC REGIONS (mena, north_america, europe, etc.) NOT customer segments.
- Be SELECTIVE — pick only the 2-4 most relevant, NOT all.
- Return ONLY valid JSON.`;

      const groqResponse = await fetch(
        "https://api.groq.com/openai/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${groqApiKey}`,
          },
          body: JSON.stringify({
            model: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
            messages: [
              {
                role: "system",
                content:
                  "You are a startup expert. Analyze projects and suggest the best matching categories, sectors, and skills. Output ONLY valid JSON.",
              },
              { role: "user", content: prompt },
            ],
            temperature: 0.3,
            max_tokens: 1500,
          }),
        },
      );

      if (!groqResponse.ok) {
        const errorText = await groqResponse.text();
        logger.error("Groq API error during project analysis", {
          status: groqResponse.status,
          error: errorText,
        });
        if (groqResponse.status === 429) {
          throw new ValidationError(
            "AI service is busy. Please wait a moment and try again.",
          );
        }
        throw new ValidationError("AI analysis failed. Please try again.");
      }

      const groqData = (await groqResponse.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const content = groqData.choices?.[0]?.message?.content;

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
        logger.error("Failed to parse project analysis response", {
          content,
          error: e,
        });
        throw new ValidationError("Failed to parse AI analysis");
      }

      // Clean category to a readable display name
      const category = cleanCategory(extractedData.category);

      // Validate stage
      const validStages = ["IDEA", "MVP", "EARLY", "GROWTH", "SCALE"];
      const stage = validStages.includes(extractedData.stage)
        ? extractedData.stage
        : "IDEA";

      // Validate lookingFor (limit to 4)
      const lookingFor = (extractedData.lookingFor || [])
        .filter((l: string) => lookingForOptions.includes(l))
        .slice(0, 4);

      // Fuzzy match sectors
      const fuzzyMatch = (
        name: string,
        items: Array<{ id: string; name: string }>,
      ) => {
        const lower = name.toLowerCase().trim();
        return (
          items.find((s) => s.name.toLowerCase() === lower) ||
          items.find(
            (s) =>
              s.name.toLowerCase().includes(lower) ||
              lower.includes(s.name.toLowerCase()),
          ) ||
          null
        );
      };

      const sectorIds: string[] = [];
      if (extractedData.sectors && Array.isArray(extractedData.sectors)) {
        for (const name of extractedData.sectors.slice(0, 10)) {
          const sector = fuzzyMatch(name, sectors);
          if (sector && !sectorIds.includes(sector.id)) {
            sectorIds.push(sector.id);
            if (sectorIds.length >= 6) break;
          }
        }
      }

      // Fuzzy match skills
      const skillItems: Array<{ skillId: string; importance: string }> = [];
      const addedSkillIds = new Set<string>();
      if (extractedData.skills && Array.isArray(extractedData.skills)) {
        for (const name of extractedData.skills.slice(0, 12)) {
          const skill = fuzzyMatch(name, skills);
          if (skill && !addedSkillIds.has(skill.id)) {
            skillItems.push({
              skillId: skill.id,
              importance: skillItems.length < 3 ? "REQUIRED" : "PREFERRED",
            });
            addedSkillIds.add(skill.id);
            if (skillItems.length >= 8) break;
          }
        }
      }

      logger.info("Project text analyzed", {
        userId: req.user.userId,
        category,
        sectorsFound: sectorIds.length,
        skillsFound: skillItems.length,
      });

      res.status(200).json({
        success: true,
        data: {
          category,
          stage,
          lookingFor,
          sectorIds,
          skills: skillItems,
          whatYouNeed: extractedData.whatYouNeed || "",
          needs: extractedData.needs || [],
          markets: extractedData.markets || [],
          idealCounterpartProfile: extractedData.idealCounterpartProfile || "",
          partnerTypeNeeded: extractedData.partnerTypeNeeded || [],
          commitmentLevelNeeded: extractedData.commitmentLevelNeeded || "",
          engagementModel: extractedData.engagementModel || [],
          targetCustomerTypes: extractedData.targetCustomerTypes || [],
          tractionSignals: extractedData.tractionSignals || [],
          advisoryTopics: extractedData.advisoryTopics || [],
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Extract project data from uploaded document
   *
   * POST /api/v1/projects/extract-document
   *
   * Body: multipart/form-data with 'document' file
   * Supported formats: PDF, DOCX, DOC, TXT
   *
   * Returns extracted project fields
   */
  async extractFromDocument(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      if (!req.user) {
        throw new AuthenticationError("Authentication required");
      }

      const file = req.file;
      if (!file) {
        throw new ValidationError("Document file is required");
      }

      logger.info("Extracting project data from document", {
        userId: req.user.userId,
        fileName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
      });

      // Save document to storage for later retrieval
      let documentUrl: string | null = null;
      let documentName = file.originalname;
      try {
        const { getStorageService } = require('../../infrastructure/external/storage');
        const storage = getStorageService();
        const ext = file.originalname.split('.').pop() || 'pdf';
        const key = `projects/documents/${req.user.userId}/${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
        const result = await storage.upload('p2p-uploads', key, file.buffer, {
          contentType: file.mimetype,
          metadata: { userId: req.user.userId, originalName: file.originalname },
        });
        documentUrl = result.url || `/${key}`;
        logger.info("Document saved to storage", { key, documentUrl });
      } catch (storageErr: any) {
        logger.warn("Failed to save document to storage, continuing with extraction", { error: storageErr.message });
      }

      // Extract text from document based on type
      let textContent = "";

      if (file.mimetype === "application/pdf") {
        // Use pdf-parse for PDF files
        const pdfParse = require("pdf-parse");
        const pdfData = await pdfParse(file.buffer);
        textContent = cleanExtractedText(pdfData.text);
      } else if (
        file.mimetype ===
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
        file.mimetype === "application/msword"
      ) {
        // Use mammoth for Word documents
        const mammoth = require("mammoth");
        const result = await mammoth.extractRawText({ buffer: file.buffer });
        textContent = cleanExtractedText(result.value);
      } else if (file.mimetype === "text/plain") {
        textContent = file.buffer.toString("utf-8");
      } else {
        throw new ValidationError(
          "Unsupported file format. Please upload PDF, DOCX, DOC, or TXT files.",
        );
      }

      if (!textContent || textContent.trim().length < 50) {
        throw new ValidationError(
          "Could not extract sufficient text from document. Please ensure the document contains readable text.",
        );
      }

      logger.info("Text extracted from document", {
        textLength: textContent.length,
        preview: textContent.substring(0, 200),
      });

      // Get all sectors and skills from database for matching (load all, no limit)
      const [sectors, skills] = await Promise.all([
        prisma.sector.findMany({
          where: { isActive: true },
          select: { id: true, name: true },
        }),
        prisma.skill.findMany({
          where: { isActive: true },
          select: { id: true, name: true },
        }),
      ]);

      // Use OpenAI (primary) or Groq (fallback) to extract project data
      const openaiApiKey = process.env.OPENAI_API_KEY;
      const groqApiKey = process.env.GROQ_API_KEY;
      const useOpenAI = !!openaiApiKey;
      const aiApiKey = useOpenAI ? openaiApiKey : groqApiKey;
      const aiEndpoint = useOpenAI
        ? "https://api.openai.com/v1/chat/completions"
        : "https://api.groq.com/openai/v1/chat/completions";
      const aiModel = useOpenAI ? "gpt-4o" : "llama-3.3-70b-versatile";

      if (!aiApiKey) {
        throw new ValidationError("AI extraction service not configured");
      }

      // Allow more document content for better analysis
      const maxDocLength = 8000;
      const truncatedContent = textContent.substring(0, maxDocLength);

      const prompt = `You are an expert business analyst. Carefully analyze this project document and extract comprehensive, context-aware information. ALL OUTPUT MUST BE IN ENGLISH (translate if the document is in another language).

DOCUMENT:
${truncatedContent}

AVAILABLE SECTORS (use EXACT names): ${sectors.map((s) => s.name).join(", ")}
AVAILABLE SKILLS (use EXACT names): ${skills.map((s) => s.name).join(", ")}

LOOKING FOR OPTIONS: investor, advisor, service_provider, strategic_partner, channel_distribution, technical_partner, cofounder_talent

CATEGORY OPTIONS: ${READABLE_CATEGORIES.join(", ")}

MARKET OPTIONS (use EXACT values): mena, gcc, north_america, europe, asia_pacific, latin_america, africa, saudi_arabia, uae, usa, uk, india, china, egypt, jordan, bahrain, kuwait, qatar, oman, turkey, germany, france, canada, australia, singapore, japan, south_korea, brazil, nigeria, south_africa, global

Return a JSON object with these fields:

{
  "title": "A clear, concise project title (3-8 words). If the document has a project/company name, use it. Otherwise, create a descriptive title based on the core offering.",
  "summary": "A compelling 2-4 sentence summary that captures: what the project does, who it serves, and what makes it unique. Focus on the value proposition.",
  "detailedDesc": "A thorough description (3-6 sentences) covering: the problem being solved, the proposed solution, target market, business model, competitive advantages, and any traction or milestones mentioned.",
  "whatYouNeed": "A clear 2-4 sentence paragraph analyzing what this project needs to succeed. Consider: funding requirements, technical expertise gaps, team roles to fill, partnerships needed, market access, mentorship, infrastructure, and any other critical resources. Be specific and actionable based on the document content.",
  "category": "Pick the BEST matching category from CATEGORY OPTIONS. Analyze the core business domain, not just mentioned technologies. NEVER leave empty - always pick the closest match, default to 'other' if truly unclear.",
  "stage": "Determine the project stage based on evidence in the document: IDEA (just a concept), MVP (has a working prototype), EARLY (early stage with initial users/validation), GROWTH (scaling existing product), SCALE (established and expanding). Look for clues like revenue, users, team size, product status.",
  "timeline": "Create a realistic phased timeline. Format as 'Phase 1 (Month 1-3): ...\\nPhase 2 (Month 4-6): ...\\nPhase 3 (Month 7-12): ...' Include concrete milestones based on the document content.",
  "lookingFor": ["Select only the 2-4 MOST relevant from LOOKING FOR OPTIONS. Be selective — only pick the types the project truly needs based on the document. Do NOT select all."],
  "sectors": ["Select the 3-5 MOST relevant sectors from AVAILABLE SECTORS. Use EXACT names. Be selective — only pick sectors directly related to the project domain."],
  "skills": ["Select the 4-6 MOST critical skills from AVAILABLE SKILLS. Use EXACT names. Focus on skills the project actually requires."],
  "keywords": ["Extract 5-10 key terms: technologies, methodologies, platforms, frameworks, and domain-specific terms"],
  "needs": ["4-6 specific project needs as tags"],
  "markets": ["GEOGRAPHIC REGIONS only — select 2-3 codes from MARKET OPTIONS. Examples: mena, north_america, europe, global, saudi_arabia. Do NOT put customer types or business segments here — those go in targetCustomerTypes."],
  "fundingAskMin": "Estimated minimum funding in USD (number or null). Use document amounts if mentioned, otherwise estimate from project scope.",
  "fundingAskMax": "Estimated maximum funding in USD (number or null).",
  "idealCounterpartProfile": "2-3 sentences describing the ideal partner, advisor, investor, or collaborator. Consider expertise, network, industry experience, and resources that complement the project.",
  "partnerTypeNeeded": ["If project needs partners, specify types: Distribution Partner, Integration Partner, Reseller, Channel Partner, Technology Partner, etc. Empty array if not applicable."],
  "commitmentLevelNeeded": "What commitment level is needed from counterparts: LOW, PART_TIME, FULL_TIME, or FLEXIBLE. Pick one.",
  "engagementModel": ["How to engage counterparts. Pick 1-3 from: EQUITY, CASH, EQUITY_AND_CASH, REVENUE_SHARE, PARTNERSHIP, CONTRACT, ADVISORY, STRATEGIC"],
  "targetCustomerTypes": ["Who are the target customers: e.g. SMEs, Enterprise, B2C, B2B, Government, Startups, Brands"],
  "tractionSignals": ["relevant traction indicators if mentioned"],
  "advisoryTopics": ["areas where advice is needed"]
}

IMPORTANT RULES:
- Use ONLY exact names from AVAILABLE SECTORS and AVAILABLE SKILLS lists.
- Use ONLY exact values from MARKET OPTIONS and LOOKING FOR OPTIONS.
- markets = GEOGRAPHIC REGIONS (mena, north_america, europe, etc.) NOT customer segments. Customer segments go in targetCustomerTypes.
- Be SELECTIVE — do NOT select all options. Pick only the most relevant 2-4 for each field.
- If the document is vague, make intelligent inferences but stay conservative.
- Return ONLY valid JSON, no markdown or extra text.`;

      // Helper function to make AI API call with retry logic
      const callAIWithRetry = async (
        maxRetries = 3,
      ): Promise<globalThis.Response> => {
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
          const response = await fetch(aiEndpoint, {
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
                    "You are an expert business analyst who extracts comprehensive, context-aware structured data from project documents. You understand business models, market dynamics, and startup ecosystems. Output ONLY valid JSON in English. Be thorough and intelligent in your analysis - infer what is needed even when not explicitly stated.",
                },
                { role: "user", content: prompt },
              ],
              temperature: 0.2,
              max_tokens: 3000,
              ...(useOpenAI
                ? {}
                : { response_format: { type: "json_object" } }),
            }),
          });

          if (response.ok) {
            return response;
          }

          // Check for rate limit error (429)
          if (response.status === 429 && attempt < maxRetries) {
            const errorText = await response.text();
            logger.warn("Groq API rate limit hit, retrying...", {
              attempt,
              error: errorText,
            });

            // Parse retry delay from error or use exponential backoff
            let waitTime = Math.pow(2, attempt) * 5000; // 10s, 20s, 40s
            try {
              const errorData = JSON.parse(errorText);
              const retryMatch = errorData.error?.message?.match(
                /try again in ([\d.]+)s/,
              );
              if (retryMatch) {
                waitTime = Math.ceil(parseFloat(retryMatch[1]) * 1000) + 1000; // Add 1s buffer
              }
            } catch (e) {
              // Use default backoff
            }

            logger.info(`Waiting ${waitTime}ms before retry...`);
            await new Promise((resolve) => setTimeout(resolve, waitTime));
            continue;
          }

          // Non-429 error or final attempt
          return response;
        }
        throw new Error("Max retries exceeded");
      };

      const aiResponse = await callAIWithRetry();

      if (!aiResponse.ok) {
        const errorText = await aiResponse.text();
        logger.error("AI API error during document extraction", {
          status: aiResponse.status,
          error: errorText,
          provider: useOpenAI ? "OpenAI" : "Groq",
        });

        // Provide more helpful error message for rate limits
        if (aiResponse.status === 429 || aiResponse.status === 413) {
          throw new ValidationError(
            "AI service is busy. Please wait a moment and try again.",
          );
        }
        throw new ValidationError("AI extraction failed. Please try again.");
      }

      const aiData = (await aiResponse.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const content = aiData.choices?.[0]?.message?.content;

      if (!content) {
        throw new ValidationError("AI extraction returned no content");
      }

      // Parse the JSON response
      let extractedData: any;
      try {
        // Clean up the response - handle various AI response formats
        let cleanContent = content.trim();

        // Try to extract JSON from markdown code blocks anywhere in the response
        const jsonCodeBlockMatch = cleanContent.match(
          /```json\s*([\s\S]*?)```/,
        );
        const genericCodeBlockMatch = cleanContent.match(/```\s*([\s\S]*?)```/);

        if (jsonCodeBlockMatch && jsonCodeBlockMatch[1]) {
          cleanContent = jsonCodeBlockMatch[1].trim();
        } else if (genericCodeBlockMatch && genericCodeBlockMatch[1]) {
          cleanContent = genericCodeBlockMatch[1].trim();
        } else {
          // Fallback: try to find JSON object directly
          const jsonMatch = cleanContent.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            cleanContent = jsonMatch[0];
          }
        }

        extractedData = JSON.parse(cleanContent.trim());
      } catch (e) {
        logger.error("Failed to parse Groq extraction response", {
          content,
          error: e,
        });
        throw new ValidationError("Failed to parse extracted data");
      }

      // Clean AI category to a readable display name
      const mappedCategory = cleanCategory(extractedData.category);

      // Valid lookingFor IDs
      const validLookingForIds = [
        "investor",
        "advisor",
        "service_provider",
        "strategic_partner",
        "channel_distribution",
        "technical_partner",
        "cofounder_talent",
      ];

      // Filter and validate lookingFor (limit to 4)
      let lookingFor: string[] = [];
      if (extractedData.lookingFor && Array.isArray(extractedData.lookingFor)) {
        lookingFor = extractedData.lookingFor
          .map((id: string) => id.toLowerCase().trim())
          .filter((id: string) => validLookingForIds.includes(id))
          .slice(0, 4);
      }

      // Build lookup maps for fast matching
      const sectorsByLower = new Map<string, { id: string; name: string }>();
      for (const s of sectors) sectorsByLower.set(s.name.toLowerCase(), s);
      const skillsByLower = new Map<string, { id: string; name: string }>();
      for (const s of skills) skillsByLower.set(s.name.toLowerCase(), s);

      // Helper: fuzzy match a name to available items (map-based O(1) exact, then substring)
      const fuzzyMatch = (
        name: string,
        items: Array<{ id: string; name: string }>,
        lookupMap: Map<string, { id: string; name: string }>,
      ) => {
        const lower = name.toLowerCase().trim();
        if (!lower || lower.length < 1) return null;

        // 1. Exact match (O(1) via map)
        const exact = lookupMap.get(lower);
        if (exact) return exact;

        // 2. For short names (< 4 chars), only allow exact matches
        if (lower.length < 4) return null;

        // 3. Substring match, pick closest by length
        let bestMatch: { id: string; name: string } | null = null;
        let bestDiff = Infinity;
        for (const item of items) {
          const itemLower = item.name.toLowerCase();
          if (itemLower.length < 4) continue;
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
          if (typeof sectorName !== "string" || !sectorName.trim()) continue;
          const trimmed = sectorName.trim();
          let sector = fuzzyMatch(trimmed, sectors, sectorsByLower);
          if (!sector) {
            try {
              const created = await prisma.sector.create({
                data: { name: trimmed, isActive: true },
              });
              sector = { id: created.id, name: created.name };
              sectors.push(sector);
              sectorsByLower.set(trimmed.toLowerCase(), sector);
            } catch (e: any) {
              const existing = await prisma.sector.findFirst({
                where: { name: trimmed },
                select: { id: true, name: true },
              });
              if (existing) sector = existing;
            }
          }
          if (sector && !sectorIds.includes(sector.id)) {
            sectorIds.push(sector.id);
            if (sectorIds.length >= 10) break;
          }
        }
      }

      // Map skill names to IDs with importance — auto-create unmatched skills
      const skillsWithImportance: Array<{
        skillId: string;
        importance: string;
      }> = [];
      if (extractedData.skills && Array.isArray(extractedData.skills)) {
        const addedSkillIds = new Set<string>();
        for (const skillName of extractedData.skills.slice(0, 20)) {
          if (typeof skillName !== "string" || !skillName.trim()) continue;
          const trimmed = skillName.trim();
          let skill = fuzzyMatch(trimmed, skills, skillsByLower);
          if (!skill) {
            try {
              const created = await prisma.skill.create({
                data: { name: trimmed, isActive: true },
              });
              skill = { id: created.id, name: created.name };
              skills.push(skill);
              skillsByLower.set(trimmed.toLowerCase(), skill);
            } catch (e: any) {
              const existing = await prisma.skill.findFirst({
                where: { name: trimmed },
                select: { id: true, name: true },
              });
              if (existing) skill = existing;
            }
          }
          if (skill && !addedSkillIds.has(skill.id)) {
            const importance =
              skillsWithImportance.length < 3 ? "REQUIRED" : "PREFERRED";
            skillsWithImportance.push({ skillId: skill.id, importance });
            addedSkillIds.add(skill.id);
            if (skillsWithImportance.length >= 10) break;
          }
        }
      }

      // Validate stage - map old values to new ones
      const validExtractStages = ["IDEA", "MVP", "EARLY", "GROWTH", "SCALE"];
      const stageMap: Record<string, string> = {
        VALIDATION: "EARLY",
        LAUNCHED: "EARLY",
        SCALING: "SCALE",
      };
      let extractedStage = extractedData.stage || "IDEA";
      if (stageMap[extractedStage]) {
        extractedStage = stageMap[extractedStage];
      }
      if (!validExtractStages.includes(extractedStage)) {
        extractedStage = "IDEA";
      }

      logger.info("Project data extracted from document", {
        userId: req.user.userId,
        title: extractedData.title,
        lookingForFound: lookingFor.length,
        sectorsFound: sectorIds.length,
        skillsFound: skillsWithImportance.length,
      });

      res.status(200).json({
        success: true,
        data: {
          title: extractedData.title || "",
          summary: extractedData.summary || "",
          detailedDesc: extractedData.detailedDesc || "",
          whatYouNeed: extractedData.whatYouNeed || "",
          category: mappedCategory || "Other",
          stage: extractedStage,
          timeline: extractedData.timeline || "",
          lookingFor,
          sectorIds,
          skills: skillsWithImportance,
          keywords: extractedData.keywords || [],
          needs: extractedData.needs || [],
          markets: extractedData.markets || [],
          fundingAskMin: extractedData.fundingAskMin
            ? Number(extractedData.fundingAskMin)
            : null,
          fundingAskMax: extractedData.fundingAskMax
            ? Number(extractedData.fundingAskMax)
            : null,
          idealCounterpartProfile: extractedData.idealCounterpartProfile || "",
          partnerTypeNeeded: extractedData.partnerTypeNeeded || [],
          commitmentLevelNeeded: extractedData.commitmentLevelNeeded || "",
          engagementModel: extractedData.engagementModel || [],
          targetCustomerTypes: extractedData.targetCustomerTypes || [],
          tractionSignals: extractedData.tractionSignals || [],
          advisoryTopics: extractedData.advisoryTopics || [],
          documentUrl,
          documentName,
          // Also return the raw extracted data for debugging/display
          _extracted: {
            sectors: extractedData.sectors || [],
            skills: extractedData.skills || [],
            lookingFor: extractedData.lookingFor || [],
          },
        },
      });
    } catch (error) {
      next(error);
    }
  }
}

// Export singleton instance
export const projectController = new ProjectController();
