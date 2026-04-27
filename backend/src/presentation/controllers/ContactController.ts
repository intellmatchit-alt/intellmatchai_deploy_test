/**
 * Contact Controller
 *
 * Handles HTTP requests for contact management endpoints.
 *
 * @module presentation/controllers/ContactController
 */

import { Request, Response, NextFunction } from "express";
import {
  CreateContactUseCase,
  GetContactsUseCase,
  GetContactUseCase,
  UpdateContactUseCase,
  DeleteContactUseCase,
  AddInteractionUseCase,
  GetRecentContactsUseCase,
  GetFollowUpContactsUseCase,
} from "../../application/use-cases/contact";
import { PrismaContactRepository } from "../../infrastructure/repositories/PrismaContactRepository";
import { AuthenticationError } from "../../shared/errors";
import { logger } from "../../shared/logger";
import { ContactSource } from "../../domain/value-objects";
import { getEnrichmentOrchestrator } from "../../infrastructure/external/enrichment";
import { DeterministicMatchingService } from "../../infrastructure/external/matching/DeterministicMatchingService";
import { prisma } from "../../infrastructure/database/prisma/client";
import { StorageServiceFactory } from "../../infrastructure/external/storage/StorageServiceFactory";
import { randomUUID } from "crypto";
import { config } from "../../config";
import { getContactLimitForUser } from "../../shared/helpers/planLimits.js";

// Initialize repository
const contactRepository = new PrismaContactRepository();

// Initialize matching service
const matchingService = new DeterministicMatchingService();

// Initialize use cases
const createContactUseCase = new CreateContactUseCase(contactRepository);
const getContactsUseCase = new GetContactsUseCase(contactRepository);
const getContactUseCase = new GetContactUseCase(contactRepository);
const updateContactUseCase = new UpdateContactUseCase(contactRepository);
const deleteContactUseCase = new DeleteContactUseCase(contactRepository);
const addInteractionUseCase = new AddInteractionUseCase(contactRepository);
const getRecentContactsUseCase = new GetRecentContactsUseCase(
  contactRepository,
);
const getFollowUpContactsUseCase = new GetFollowUpContactsUseCase(
  contactRepository,
);

/**
 * Contact Controller
 *
 * Provides HTTP handlers for contact CRUD operations.
 */
export class ContactController {
  /**
   * Get paginated list of contacts
   *
   * GET /api/v1/contacts
   *
   * Query params:
   * - search: text search
   * - sector: filter by sector ID
   * - favorite: filter favorites (true/false)
   * - minScore: minimum match score
   * - page: page number (default 1)
   * - limit: items per page (default 20, max 100)
   * - sort: sort field (name, createdAt, matchScore, lastContactedAt)
   * - order: sort order (asc, desc)
   */
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AuthenticationError("Authentication required");
      }

      const filters = {
        search: req.query.search as string | undefined,
        sector: req.query.sector as string | undefined,
        favorite: req.query.favorite === "true" ? true : undefined,
        minScore: req.query.minScore
          ? parseInt(req.query.minScore as string, 10)
          : undefined,
        page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 20,
        sort: req.query.sort as
          | "name"
          | "createdAt"
          | "matchScore"
          | "lastContactedAt"
          | undefined,
        order: req.query.order as "asc" | "desc" | undefined,
      };

      // Pass organization context to filters
      const orgId = req.orgContext?.organizationId || null;
      const result = await getContactsUseCase.execute(req.user.userId, {
        ...filters,
        organizationId: orgId,
      });

      // Fetch contact limit info
      const planLimit = await getContactLimitForUser(req.user.userId);

      res.status(200).json({
        success: true,
        data: {
          ...result,
          planLimit: {
            limit: planLimit.limit,
            current: planLimit.current,
            remaining: planLimit.remaining,
          },
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Create a new contact
   *
   * POST /api/v1/contacts
   *
   * Returns contact with match data for immediate display.
   * Automatically calculates match score and can trigger enrichment.
   */
  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AuthenticationError("Authentication required");
      }

      // Handle custom sectors/skills/interests/hobbies from AI/GPT
      const {
        customSectors,
        customSkills,
        customInterests,
        customHobbies,
        ...contactData
      } = req.body;

      // Initialize arrays if not present
      if (!contactData.sectors) contactData.sectors = [];
      if (!contactData.skills) contactData.skills = [];
      if (!contactData.interests) contactData.interests = [];
      if (!contactData.hobbies) contactData.hobbies = [];

      // Process custom sectors - create if they don't exist, then add IDs
      if (
        customSectors &&
        Array.isArray(customSectors) &&
        customSectors.length > 0
      ) {
        const seenNames = new Set<string>();
        const allSectors = await prisma.sector.findMany({
          where: { isActive: true },
        });

        for (const name of customSectors) {
          const trimmedName = String(name).trim();
          const normalizedName = trimmedName.toLowerCase();
          if (!trimmedName || seenNames.has(normalizedName)) continue;
          seenNames.add(normalizedName);

          // Check if sector exists (case-insensitive)
          let existingSector = allSectors.find(
            (s) => s.name.toLowerCase() === normalizedName,
          );

          let sectorId: string;
          if (existingSector) {
            sectorId = existingSector.id;
          } else {
            // Create new sector
            const newSector = await prisma.sector.create({
              data: { name: trimmedName, isActive: true },
            });
            sectorId = newSector.id;
            allSectors.push(newSector); // Add to local cache
            logger.info("Created new sector from contact", {
              sectorName: trimmedName,
              sectorId,
            });
          }

          // Add to sectors array if not already present
          if (!contactData.sectors.some((s: any) => s.sectorId === sectorId)) {
            contactData.sectors.push({
              sectorId,
              isPrimary: contactData.sectors.length === 0,
            });
          }
        }
      }

      // Process custom skills - create if they don't exist, then add IDs
      if (
        customSkills &&
        Array.isArray(customSkills) &&
        customSkills.length > 0
      ) {
        const seenNames = new Set<string>();
        const allSkills = await prisma.skill.findMany({
          where: { isActive: true },
        });

        for (const name of customSkills) {
          const trimmedName = String(name).trim();
          const normalizedName = trimmedName.toLowerCase();
          if (!trimmedName || seenNames.has(normalizedName)) continue;
          seenNames.add(normalizedName);

          // Check if skill exists (case-insensitive)
          let existingSkill = allSkills.find(
            (s) => s.name.toLowerCase() === normalizedName,
          );

          let skillId: string;
          if (existingSkill) {
            skillId = existingSkill.id;
          } else {
            // Create new skill
            const newSkill = await prisma.skill.create({
              data: { name: trimmedName, isActive: true },
            });
            skillId = newSkill.id;
            allSkills.push(newSkill); // Add to local cache
            logger.info("Created new skill from contact", {
              skillName: trimmedName,
              skillId,
            });
          }

          // Add to skills array if not already present
          if (!contactData.skills.some((s: any) => s.skillId === skillId)) {
            contactData.skills.push({ skillId, proficiency: "INTERMEDIATE" });
          }
        }
      }

      // Process custom interests - create if they don't exist, then add IDs
      if (
        customInterests &&
        Array.isArray(customInterests) &&
        customInterests.length > 0
      ) {
        const seenNames = new Set<string>();
        const allInterests = await prisma.interest.findMany({
          where: { isActive: true },
        });

        for (const name of customInterests) {
          const trimmedName = String(name).trim();
          const normalizedName = trimmedName.toLowerCase();
          if (!trimmedName || seenNames.has(normalizedName)) continue;
          seenNames.add(normalizedName);

          // Check if interest exists (case-insensitive)
          let existingInterest = allInterests.find(
            (i) => i.name.toLowerCase() === normalizedName,
          );

          let interestId: string;
          if (existingInterest) {
            interestId = existingInterest.id;
          } else {
            // Create new interest
            const newInterest = await prisma.interest.create({
              data: { name: trimmedName, isActive: true },
            });
            interestId = newInterest.id;
            allInterests.push(newInterest); // Add to local cache
            logger.info("Created new interest from contact", {
              interestName: trimmedName,
              interestId,
            });
          }

          // Add to interests array if not already present
          if (
            !contactData.interests.some((i: any) => i.interestId === interestId)
          ) {
            contactData.interests.push({ interestId });
          }
        }
      }

      // Process custom hobbies - create if they don't exist, then add IDs
      if (
        customHobbies &&
        Array.isArray(customHobbies) &&
        customHobbies.length > 0
      ) {
        const seenNames = new Set<string>();
        const allHobbies = await prisma.hobby.findMany({
          where: { isActive: true },
        });

        for (const name of customHobbies) {
          const trimmedName = String(name).trim();
          const normalizedName = trimmedName.toLowerCase();
          if (!trimmedName || seenNames.has(normalizedName)) continue;
          seenNames.add(normalizedName);

          // Check if hobby exists (case-insensitive)
          let existingHobby = allHobbies.find(
            (h) => h.name.toLowerCase() === normalizedName,
          );

          let hobbyId: string;
          if (existingHobby) {
            hobbyId = existingHobby.id;
          } else {
            // Create new hobby
            const newHobby = await prisma.hobby.create({
              data: { name: trimmedName, isActive: true },
            });
            hobbyId = newHobby.id;
            allHobbies.push(newHobby); // Add to local cache
            logger.info("Created new hobby from contact", {
              hobbyName: trimmedName,
              hobbyId,
            });
          }

          // Add to hobbies array if not already present
          if (!contactData.hobbies.some((h: any) => h.hobbyId === hobbyId)) {
            contactData.hobbies.push({ hobbyId });
          }
        }
      }

      const contact = await createContactUseCase.execute(
        req.user.userId,
        contactData,
      );

      // If in org mode, set the organizationId on the contact
      if (req.orgContext?.organizationId) {
        await prisma.contact.update({
          where: { id: contact.id },
          data: { organizationId: req.orgContext.organizationId },
        });
      }

      // Calculate match score for the new contact
      let match = null;
      try {
        match = await matchingService.getMatchDetails(
          req.user.userId,
          contact.id,
        );

        // Update the contact with the calculated match score
        if (match && match.score > 0) {
          await prisma.contact.update({
            where: { id: contact.id },
            data: { matchScore: match.score },
          });
        }
      } catch (matchError) {
        logger.warn("Failed to calculate match score", {
          contactId: contact.id,
          error: matchError,
        });
      }

      // Optionally trigger background enrichment if contact has phone or email
      let enrichmentTriggered = false;
      if (contact.phone || contact.email) {
        try {
          // Don't await - let it run in background
          const orchestrator = getEnrichmentOrchestrator();
          orchestrator
            .enrichContact(contact.id, req.user.userId)
            .then((result) => {
              if (result.success && result.fieldsUpdated.length > 0) {
                logger.info("Background enrichment completed", {
                  contactId: contact.id,
                  fieldsUpdated: result.fieldsUpdated,
                });
              }
            })
            .catch((err) => {
              logger.warn("Background enrichment failed", {
                contactId: contact.id,
                error: err,
              });
            });
          enrichmentTriggered = true;
        } catch (enrichError) {
          logger.warn("Failed to trigger enrichment", {
            contactId: contact.id,
            error: enrichError,
          });
        }
      }

      res.status(201).json({
        success: true,
        data: {
          contact: {
            ...contact,
            matchScore: match?.score ?? undefined,
          },
          match: match
            ? {
                score: match.score,
                scoreBreakdown: match.scoreBreakdown,
                intersections: match.intersections,
                // Keep backward compatibility with simplified arrays
                sharedAttributes: match.intersections.map((i) => i.label),
                sharedSectors: match.intersections
                  .filter((i) => i.type === "sector")
                  .map((i) => i.label),
                sharedSkills: match.intersections
                  .filter((i) => i.type === "skill")
                  .map((i) => i.label),
                sharedInterests: match.intersections
                  .filter((i) => i.type === "interest")
                  .map((i) => i.label),
                sharedHobbies: match.intersections
                  .filter((i) => i.type === "hobby")
                  .map((i) => i.label),
                goalAlignment: match.goalAlignment,
                reasons: match.reasons || [],
                suggestedMessage: match.suggestedMessage,
                networkDegree: match.networkDegree,
              }
            : null,
          enrichmentTriggered,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get a single contact by ID
   *
   * GET /api/v1/contacts/:id
   */
  async get(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AuthenticationError("Authentication required");
      }

      const orgId = req.orgContext?.organizationId || null;
      const contact = await getContactUseCase.execute(
        req.user.userId,
        String(req.params.id),
        orgId,
      );

      res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.status(200).json({
        success: true,
        data: contact,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update a contact
   *
   * PUT /api/v1/contacts/:id
   */
  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AuthenticationError("Authentication required");
      }

      const orgId = req.orgContext?.organizationId || null;
      const contact = await updateContactUseCase.execute(
        req.user.userId,
        String(req.params.id),
        req.body,
        orgId,
      );

      res.status(200).json({
        success: true,
        data: contact,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Delete a contact
   *
   * DELETE /api/v1/contacts/:id
   */
  async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AuthenticationError("Authentication required");
      }

      const orgId = req.orgContext?.organizationId || null;
      await deleteContactUseCase.execute(
        req.user.userId,
        String(req.params.id),
        orgId,
      );

      res.status(200).json({
        success: true,
        message: "Contact deleted successfully",
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Add an interaction to a contact
   *
   * POST /api/v1/contacts/:id/interaction
   */
  async addInteraction(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      if (!req.user) {
        throw new AuthenticationError("Authentication required");
      }

      const contact = await addInteractionUseCase.execute(
        req.user.userId,
        String(req.params.id),
        req.body,
      );

      res.status(201).json({
        success: true,
        data: contact,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get recent contacts
   *
   * GET /api/v1/contacts/recent
   *
   * Query params:
   * - limit: number of contacts (default 10)
   */
  async getRecent(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      if (!req.user) {
        throw new AuthenticationError("Authentication required");
      }

      const limit = req.query.limit
        ? parseInt(req.query.limit as string, 10)
        : 10;
      const orgId = req.orgContext?.organizationId || null;
      const contacts = await getRecentContactsUseCase.execute(
        req.user.userId,
        limit,
        orgId,
      );

      res.status(200).json({
        success: true,
        data: contacts,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get contacts needing follow-up
   *
   * GET /api/v1/contacts/follow-up
   *
   * Query params:
   * - days: days threshold (default 30)
   */
  async getFollowUp(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      if (!req.user) {
        throw new AuthenticationError("Authentication required");
      }

      const days = req.query.days ? parseInt(req.query.days as string, 10) : 30;
      const orgId = req.orgContext?.organizationId || null;
      const contacts = await getFollowUpContactsUseCase.execute(
        req.user.userId,
        days,
        orgId,
      );

      res.status(200).json({
        success: true,
        data: contacts,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Trigger enrichment for a contact
   *
   * POST /api/v1/contacts/:id/enrich
   *
   * Enriches contact data using external services (NumVerify, AbstractAPI, PDL).
   * Returns enriched data and match score.
   */
  async enrich(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AuthenticationError("Authentication required");
      }

      const contactId = String(req.params.id);

      logger.info("Enrichment requested", {
        userId: req.user.userId,
        contactId,
      });

      // Run enrichment using the orchestrator
      const orchestrator = getEnrichmentOrchestrator();
      const enrichmentResult = await orchestrator.enrichContact(
        contactId,
        req.user.userId,
      );

      if (!enrichmentResult.success) {
        res.status(400).json({
          success: false,
          error: {
            code: "ENRICHMENT_FAILED",
            message: enrichmentResult.error || "Failed to enrich contact",
          },
        });
        return;
      }

      // Calculate updated match score
      let match = null;
      try {
        match = await matchingService.getMatchDetails(
          req.user.userId,
          contactId,
        );
      } catch (matchError) {
        logger.warn("Failed to calculate match score after enrichment", {
          contactId,
          error: matchError,
        });
      }

      // Get updated contact data
      const contact = await getContactUseCase.execute(
        req.user.userId,
        contactId,
      );

      res.status(200).json({
        success: true,
        data: {
          contact,
          enrichment: {
            sources: enrichmentResult.sources,
            fieldsUpdated: enrichmentResult.fieldsUpdated,
            phoneValidation: enrichmentResult.phoneValidation,
            emailValidation: enrichmentResult.emailValidation,
            processingTimeMs: enrichmentResult.processingTimeMs,
          },
          match: match
            ? {
                score: match.score,
                breakdown: match.scoreBreakdown,
                sharedAttributes: match.intersections.map((i) => i.label),
                reasons: match.reasons || [],
                suggestedMessage: match.suggestedMessage,
              }
            : null,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Enrich contact data from LinkedIn URL using People Data Labs
   *
   * POST /api/v1/contacts/enrich-linkedin
   *
   * Body:
   * - fullName: string (required)
   * - linkedInUrl: string (required)
   *
   * Returns enriched profile data for user review before creating contact.
   */
  async enrichFromLinkedIn(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      if (!req.user) {
        throw new AuthenticationError("Authentication required");
      }

      const { fullName, linkedInUrl } = req.body;

      if (!fullName || !linkedInUrl) {
        res.status(400).json({
          success: false,
          error: {
            code: "MISSING_FIELDS",
            message: "Both fullName and linkedInUrl are required",
          },
        });
        return;
      }

      // Validate LinkedIn URL format
      const linkedInRegex =
        /^https?:\/\/(www\.)?linkedin\.com\/(in|pub)\/[\w\-]+\/?.*$/i;
      if (!linkedInRegex.test(linkedInUrl)) {
        res.status(400).json({
          success: false,
          error: {
            code: "INVALID_LINKEDIN_URL",
            message: "Please provide a valid LinkedIn profile URL",
          },
        });
        return;
      }

      logger.info("LinkedIn enrichment requested", {
        userId: req.user.userId,
        fullName,
        linkedInUrl,
      });

      // Use PDL service for enrichment
      const { PDLEnrichmentService } =
        await import("../../infrastructure/external/enrichment/PDLEnrichmentService.js");
      const pdlService = new PDLEnrichmentService();

      // Check if PDL is available
      const isAvailable = await pdlService.isAvailable();
      if (!isAvailable) {
        res.status(503).json({
          success: false,
          error: {
            code: "SERVICE_UNAVAILABLE",
            message:
              "LinkedIn enrichment service is not available. Please configure PDL API key.",
          },
        });
        return;
      }

      // Enrich the profile
      const enrichmentResult = await pdlService.enrichPerson({
        name: fullName,
        linkedInUrl: linkedInUrl,
      });

      if (!enrichmentResult.success || !enrichmentResult.data) {
        res.status(404).json({
          success: false,
          error: {
            code: "ENRICHMENT_FAILED",
            message:
              enrichmentResult.error ||
              "Could not find profile data for this LinkedIn URL",
          },
        });
        return;
      }

      const data = enrichmentResult.data;

      // Match skills with database
      let matchedSkills: Array<{ id: string; name: string; nameAr?: string }> =
        [];
      let matchedSectors: Array<{ id: string; name: string; nameAr?: string }> =
        [];

      if (data.skills && data.skills.length > 0) {
        // Find matching skills in database
        const dbSkills = await prisma.skill.findMany({
          where: { isActive: true },
        });

        for (const skillName of data.skills.slice(0, 15)) {
          const match = dbSkills.find(
            (s) =>
              s.name.toLowerCase() === skillName.toLowerCase() ||
              s.name.toLowerCase().includes(skillName.toLowerCase()) ||
              skillName.toLowerCase().includes(s.name.toLowerCase()),
          );
          if (match && !matchedSkills.find((m) => m.id === match.id)) {
            matchedSkills.push({
              id: match.id,
              name: match.name,
              nameAr: match.nameAr || undefined,
            });
          }
        }
      }

      // Match industry to sectors
      if (data.industry) {
        const dbSectors = await prisma.sector.findMany({
          where: { isActive: true },
        });

        const industryMatch = dbSectors.find(
          (s) =>
            s.name.toLowerCase().includes(data.industry!.toLowerCase()) ||
            data.industry!.toLowerCase().includes(s.name.toLowerCase()),
        );
        if (industryMatch) {
          matchedSectors.push({
            id: industryMatch.id,
            name: industryMatch.name,
            nameAr: industryMatch.nameAr || undefined,
          });
        }
      }

      // Calculate match score preview
      let matchPreview = null;
      try {
        // Create a temporary match calculation based on shared attributes
        const userProfile = await prisma.user.findUnique({
          where: { id: req.user.userId },
          include: {
            userSkills: { include: { skill: true } },
            userSectors: { include: { sector: true } },
            userInterests: { include: { interest: true } },
          },
        });

        if (userProfile) {
          const userSkillNames = userProfile.userSkills.map((us) =>
            us.skill.name.toLowerCase(),
          );
          const userSectorNames = userProfile.userSectors.map((us) =>
            us.sector.name.toLowerCase(),
          );

          const sharedSkills = matchedSkills.filter((ms) =>
            userSkillNames.includes(ms.name.toLowerCase()),
          );
          const sharedSectors = matchedSectors.filter((ms) =>
            userSectorNames.includes(ms.name.toLowerCase()),
          );

          // Simple score calculation: base 20 + shared skills (5 each, max 40) + shared sectors (15 each, max 30)
          const skillScore = Math.min(sharedSkills.length * 5, 40);
          const sectorScore = Math.min(sharedSectors.length * 15, 30);
          const baseScore = 20;

          matchPreview = {
            estimatedScore: Math.min(baseScore + skillScore + sectorScore, 100),
            sharedSkills: sharedSkills.map((s) => s.name),
            sharedSectors: sharedSectors.map((s) => s.name),
          };
        }
      } catch (matchError) {
        logger.warn("Failed to calculate match preview", { error: matchError });
      }

      res.status(200).json({
        success: true,
        data: {
          profile: {
            fullName: data.fullName || fullName,
            firstName: data.firstName,
            lastName: data.lastName,
            jobTitle: data.jobTitle,
            company: data.company,
            location: data.location,
            bio: data.bio,
            linkedInUrl: data.linkedInUrl || linkedInUrl,
            twitterUrl: data.twitterUrl,
            email: data.emails?.[0],
            phone: data.phoneNumbers?.[0],
          },
          skills: matchedSkills,
          suggestedSkills: data.skills?.slice(0, 15) || [],
          sectors: matchedSectors,
          industry: data.industry,
          education: data.education?.map((e) => ({
            school: e.school,
            degree: e.degree,
            fieldOfStudy: e.fieldOfStudy,
            graduationYear: e.graduationYear,
          })),
          employmentHistory: data.employmentHistory?.slice(0, 3).map((e) => ({
            company: e.company,
            title: e.title,
            isCurrent: e.isCurrent,
          })),
          matchPreview,
          likelihood: enrichmentResult.likelihood,
          source: "pdl",
        },
      });
    } catch (error) {
      logger.error("LinkedIn enrichment failed", { error });
      next(error);
    }
  }

  /**
   * Search for a person using their photo (face recognition)
   *
   * POST /api/v1/contacts/face-search
   *
   * Body (multipart/form-data):
   * - photo: image file (required)
   * - consent: boolean (required - user must confirm consent)
   *
   * Returns potential matches with social profiles.
   *
   * Privacy Note: This feature requires explicit user consent.
   * Images are deleted after processing.
   */
  async faceSearch(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      if (!req.user) {
        throw new AuthenticationError("Authentication required");
      }

      // Check consent acknowledgment
      const consent = req.body.consent === "true" || req.body.consent === true;
      if (!consent) {
        res.status(400).json({
          success: false,
          error: {
            code: "CONSENT_REQUIRED",
            message:
              "User consent is required for face search. Please acknowledge the privacy policy.",
          },
        });
        return;
      }

      // Get uploaded file
      const file = req.file;
      if (!file) {
        res.status(400).json({
          success: false,
          error: {
            code: "NO_PHOTO",
            message: "Please upload a photo to search",
          },
        });
        return;
      }

      // Validate file type
      if (!file.mimetype.startsWith("image/")) {
        res.status(400).json({
          success: false,
          error: {
            code: "INVALID_FILE_TYPE",
            message: "Please upload an image file (JPEG, PNG, etc.)",
          },
        });
        return;
      }

      // Validate file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        res.status(400).json({
          success: false,
          error: {
            code: "FILE_TOO_LARGE",
            message: "Image file must be less than 10MB",
          },
        });
        return;
      }

      logger.info("Face search requested", {
        userId: req.user.userId,
        fileSize: file.size,
        mimeType: file.mimetype,
      });

      // Import and initialize face search service
      const { FaceSearchService, MockFaceSearchService } =
        await import("../../infrastructure/external/face-search/FaceSearchService.js");

      // Use mock service in development if real service not available
      const realService = new FaceSearchService();
      const isAvailable = await realService.isAvailable();

      if (!isAvailable) {
        // Return service unavailable - in production, we don't use mock
        res.status(503).json({
          success: false,
          error: {
            code: "SERVICE_UNAVAILABLE",
            message:
              "Face search service is not available. Please configure the API key.",
          },
          serviceStatus: {
            available: false,
            message:
              "Configure PIMEYES_API_KEY and FEATURE_FACE_SEARCH=true to enable face search.",
          },
        });
        return;
      }

      // Perform face search
      const imageBase64 = file.buffer.toString("base64");
      const searchResult = await realService.searchFace(
        imageBase64,
        file.mimetype,
      );

      // Note: Image data is not stored - it's processed in memory and discarded

      if (!searchResult.success) {
        res.status(400).json({
          success: false,
          error: {
            code: "SEARCH_FAILED",
            message:
              searchResult.error || "Face search failed. Please try again.",
          },
        });
        return;
      }

      // Transform matches for response
      const matches = searchResult.matches.map((match) => ({
        confidence: match.confidence,
        name: match.name,
        thumbnailUrl: match.thumbnailUrl,
        sourceUrl: match.sourceUrl,
        socialProfiles: match.socialProfiles.map((profile) => ({
          platform: profile.platform,
          url: profile.url,
          username: profile.username,
        })),
      }));

      res.json({
        success: true,
        data: {
          matches,
          matchCount: matches.length,
          processingTimeMs: searchResult.processingTimeMs,
          warnings: searchResult.warnings,
          privacyNotice:
            "Your photo was processed securely and has been deleted. No image data is stored.",
        },
      });
    } catch (error) {
      logger.error("Face search failed", { error });
      next(error);
    }
  }

  /**
   * Import contacts from file
   *
   * POST /api/v1/contacts/import
   *
   * Supports CSV and vCard formats.
   *
   * Body (JSON):
   * - format: 'csv' | 'vcard'
   * - data: string (file content)
   *
   * Or multipart/form-data:
   * - file: uploaded file
   */
  async import(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AuthenticationError("Authentication required");
      }

      let fileContent: string;
      let format: "csv" | "vcard";

      // Handle multipart upload
      if (req.file) {
        fileContent = req.file.buffer.toString("utf-8");
        const filename = req.file.originalname.toLowerCase();
        format =
          filename.endsWith(".vcf") || filename.endsWith(".vcard")
            ? "vcard"
            : "csv";
      } else if (req.body.data) {
        fileContent = req.body.data;
        format = req.body.format || "csv";
      } else {
        res.status(400).json({
          success: false,
          error: { code: "NO_FILE", message: "No file or data provided" },
        });
        return;
      }

      const importedContacts: any[] = [];
      const errors: string[] = [];

      if (format === "csv") {
        // Parse CSV
        const lines = fileContent.split("\n").filter((line) => line.trim());
        if (lines.length < 2) {
          res.status(400).json({
            success: false,
            error: {
              code: "INVALID_CSV",
              message: "CSV file must have headers and at least one row",
            },
          });
          return;
        }

        const headers = this.parseCSVLine(lines[0]).map((h) =>
          h.toLowerCase().trim(),
        );
        const nameIndex = headers.findIndex(
          (h) => h.includes("name") || h === "fullname" || h === "full name",
        );
        const emailIndex = headers.findIndex((h) => h.includes("email"));
        const phoneIndex = headers.findIndex(
          (h) => h.includes("phone") || h.includes("tel"),
        );
        const companyIndex = headers.findIndex(
          (h) => h.includes("company") || h.includes("org"),
        );
        const jobTitleIndex = headers.findIndex(
          (h) =>
            h.includes("title") || h.includes("job") || h.includes("position"),
        );
        const locationIndex = headers.findIndex(
          (h) =>
            h.includes("location") ||
            h.includes("address") ||
            h.includes("city"),
        );
        const websiteIndex = headers.findIndex(
          (h) => h.includes("website") || h.includes("url"),
        );
        const linkedinIndex = headers.findIndex((h) => h.includes("linkedin"));
        const notesIndex = headers.findIndex(
          (h) => h.includes("notes") || h.includes("note"),
        );

        for (let i = 1; i < lines.length; i++) {
          try {
            const values = this.parseCSVLine(lines[i]);
            const fullName = nameIndex >= 0 ? values[nameIndex]?.trim() : "";

            if (!fullName) {
              errors.push(`Row ${i + 1}: Missing name`);
              continue;
            }

            const contactData = {
              name: fullName,
              email:
                emailIndex >= 0
                  ? values[emailIndex]?.trim() || undefined
                  : undefined,
              phone:
                phoneIndex >= 0
                  ? values[phoneIndex]?.trim() || undefined
                  : undefined,
              company:
                companyIndex >= 0
                  ? values[companyIndex]?.trim() || undefined
                  : undefined,
              jobTitle:
                jobTitleIndex >= 0
                  ? values[jobTitleIndex]?.trim() || undefined
                  : undefined,
              location:
                locationIndex >= 0
                  ? values[locationIndex]?.trim() || undefined
                  : undefined,
              websiteUrl:
                websiteIndex >= 0
                  ? values[websiteIndex]?.trim() || undefined
                  : undefined,
              linkedInUrl:
                linkedinIndex >= 0
                  ? values[linkedinIndex]?.trim() || undefined
                  : undefined,
              notes:
                notesIndex >= 0
                  ? values[notesIndex]?.trim() || undefined
                  : undefined,
              source: "IMPORT" as ContactSource,
            };

            const contact = await createContactUseCase.execute(
              req.user.userId,
              contactData,
            );
            importedContacts.push(contact);
          } catch (err: any) {
            errors.push(`Row ${i + 1}: ${err.message}`);
          }
        }
      } else {
        // Parse vCard
        const vcards = fileContent.split("BEGIN:VCARD").filter((v) => v.trim());

        for (let i = 0; i < vcards.length; i++) {
          try {
            const vcard = "BEGIN:VCARD" + vcards[i];
            const parsedData = this.parseVCard(vcard);

            if (!parsedData.fullName) {
              errors.push(`vCard ${i + 1}: Missing name`);
              continue;
            }

            const contact = await createContactUseCase.execute(
              req.user.userId,
              {
                name: parsedData.fullName,
                email: parsedData.email,
                phone: parsedData.phone,
                company: parsedData.company,
                jobTitle: parsedData.jobTitle,
                location: parsedData.location,
                linkedInUrl: parsedData.linkedinUrl,
                websiteUrl: parsedData.website,
                notes: parsedData.notes,
                source: "IMPORT" as ContactSource,
              },
            );
            importedContacts.push(contact);
          } catch (err: any) {
            errors.push(`vCard ${i + 1}: ${err.message}`);
          }
        }
      }

      logger.info("Contact import completed", {
        userId: req.user.userId,
        format,
        imported: importedContacts.length,
        errors: errors.length,
      });

      res.status(200).json({
        success: true,
        data: {
          imported: importedContacts.length,
          errors: errors.length,
          errorDetails: errors.slice(0, 10), // Limit error details
          contacts: importedContacts,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Parse a CSV line handling quoted values
   */
  private parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === "," && !inQuotes) {
        result.push(current);
        current = "";
      } else {
        current += char;
      }
    }
    result.push(current);

    return result;
  }

  /**
   * Parse vCard format to contact data
   */
  private parseVCard(vcard: string): any {
    const lines = vcard.split(/\r?\n/);
    const data: any = {};

    const unescapeVCard = (value: string): string => {
      return value
        .replace(/\\n/g, "\n")
        .replace(/\\,/g, ",")
        .replace(/\\;/g, ";")
        .replace(/\\\\/g, "\\");
    };

    // Helper to strip group prefixes (e.g., "item1.FN" -> "FN")
    const stripGroupPrefix = (key: string): string => {
      const dotIndex = key.indexOf(".");
      return dotIndex !== -1 ? key.substring(dotIndex + 1) : key;
    };

    // Helper to get base property name (e.g., "FN;CHARSET=UTF-8" -> "FN")
    const getBaseProp = (key: string): string => {
      const semiIndex = key.indexOf(";");
      return semiIndex !== -1 ? key.substring(0, semiIndex) : key;
    };

    for (const line of lines) {
      const colonIndex = line.indexOf(":");
      if (colonIndex === -1) continue;

      const rawKey = line.substring(0, colonIndex).toUpperCase();
      const strippedKey = stripGroupPrefix(rawKey);
      const baseProp = getBaseProp(strippedKey);
      const value = unescapeVCard(line.substring(colonIndex + 1));

      if (baseProp === "FN") {
        data.fullName = value;
      } else if (baseProp === "N") {
        if (!data.fullName) {
          const parts = value.split(";");
          // N format: LastName;FirstName;MiddleName;Prefix;Suffix
          const firstName = parts[1] || "";
          const lastName = parts[0] || "";
          const middleName = parts[2] || "";
          data.fullName = [firstName, middleName, lastName]
            .filter((p) => p)
            .join(" ")
            .trim();
        }
      } else if (baseProp === "EMAIL" || strippedKey.includes("EMAIL")) {
        data.email = value;
      } else if (baseProp === "TEL" || strippedKey.includes("TEL")) {
        data.phone = value;
      } else if (baseProp === "ORG") {
        data.company = value.split(";")[0];
      } else if (baseProp === "TITLE") {
        data.jobTitle = value;
      } else if (baseProp === "URL") {
        data.website = value;
      } else if (
        strippedKey.includes("X-SOCIALPROFILE") &&
        strippedKey.includes("LINKEDIN")
      ) {
        data.linkedinUrl = value;
      } else if (baseProp === "ADR") {
        const parts = value.split(";").filter((p) => p);
        data.location = parts.join(", ");
      } else if (baseProp === "NOTE") {
        data.notes = value;
      }
    }

    return data;
  }

  /**
   * Export contacts to CSV or vCard
   *
   * GET /api/v1/contacts/export
   *
   * Query params:
   * - format: 'csv' | 'vcard' (default 'csv')
   * - ids: comma-separated contact IDs (optional)
   * - search: search filter
   * - sector: sector ID filter
   */
  async export(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AuthenticationError("Authentication required");
      }

      const format = (req.query.format as string) || "csv";
      const ids = req.query.ids
        ? (req.query.ids as string).split(",")
        : undefined;
      const search = req.query.search as string | undefined;
      const sector = req.query.sector as string | undefined;

      // Dynamic import to avoid circular dependencies
      const { exportService } =
        await import("../../infrastructure/services/ExportService.js");
      const { prisma } =
        await import("../../infrastructure/database/prisma/client.js");

      // Build query
      const where: any = { ownerId: req.user.userId };

      if (ids && ids.length > 0) {
        where.id = { in: ids };
      }

      if (search) {
        where.OR = [
          { fullName: { contains: search } },
          { email: { contains: search } },
          { company: { contains: search } },
        ];
      }

      if (sector) {
        where.contactSectors = { some: { sectorId: sector } };
      }

      // Fetch contacts
      const contacts = await prisma.contact.findMany({
        where,
        include: {
          contactSectors: { include: { sector: true } },
          contactSkills: { include: { skill: true } },
        },
        orderBy: { fullName: "asc" },
      });

      // Transform to export format
      const exportContacts = contacts.map((c) => ({
        id: c.id,
        fullName: c.fullName,
        email: c.email,
        phone: c.phone,
        company: c.company,
        jobTitle: c.jobTitle,
        website: c.website,
        linkedinUrl: c.linkedinUrl,
        location: c.location,
        notes: c.notes,
        sectors: c.contactSectors.map((cs) => cs.sector.name),
        skills: c.contactSkills.map((cs) => cs.skill.name),
        createdAt: c.createdAt,
      }));

      let content: string;
      let mimeType: string;
      let filename: string;

      if (format === "vcard") {
        content = exportService.exportToVCards(exportContacts);
        mimeType = "text/vcard";
        filename = exportService.generateFilename("vcard", contacts.length);
      } else {
        content = exportService.exportToCSV(exportContacts);
        mimeType = "text/csv";
        filename = exportService.generateFilename("csv", contacts.length);
      }

      logger.info("Contacts exported", {
        userId: req.user.userId,
        format,
        count: contacts.length,
      });

      res.setHeader("Content-Type", mimeType);
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${filename}"`,
      );
      res.status(200).send(content);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Export single contact to vCard
   *
   * GET /api/v1/contacts/:id/export
   */
  async exportSingle(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      if (!req.user) {
        throw new AuthenticationError("Authentication required");
      }

      const { exportService } =
        await import("../../infrastructure/services/ExportService.js");
      const { prisma } =
        await import("../../infrastructure/database/prisma/client.js");

      const contact = await prisma.contact.findFirst({
        where: {
          id: String(req.params.id),
          ownerId: req.user.userId,
        },
        include: {
          contactSectors: { include: { sector: true } },
          contactSkills: { include: { skill: true } },
        },
      });

      if (!contact) {
        res.status(404).json({
          success: false,
          error: { code: "NOT_FOUND", message: "Contact not found" },
        });
        return;
      }

      const exportContact = {
        id: contact.id,
        fullName: contact.fullName,
        email: contact.email,
        phone: contact.phone,
        company: contact.company,
        jobTitle: contact.jobTitle,
        website: contact.website,
        linkedinUrl: contact.linkedinUrl,
        location: contact.location,
        notes: contact.notes,
        sectors: contact.contactSectors.map((cs) => cs.sector.name),
        skills: contact.contactSkills.map((cs) => cs.skill.name),
        createdAt: contact.createdAt,
      };

      const content = exportService.exportToVCard(exportContact);
      const filename = `${contact.fullName.replace(/\s+/g, "_")}.vcf`;

      logger.info("Contact exported", {
        userId: req.user.userId,
        contactId: contact.id,
      });

      res.setHeader("Content-Type", "text/vcard");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${filename}"`,
      );
      res.status(200).send(content);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Analyze contact data and generate AI suggestions
   *
   * POST /api/v1/contacts/analyze
   *
   * Uses AI to suggest sectors, skills, interests, and generate a bio
   * based on the contact's job title, company, and other info.
   */
  async analyze(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      if (!req.user) {
        throw new AuthenticationError("Authentication required");
      }

      const { name, company, jobTitle, email, website } = req.body;

      logger.info("Analyzing contact data", {
        userId: req.user.userId,
        name,
        company,
        jobTitle,
      });

      // Build context for AI
      const contextParts: string[] = [];
      if (name) contextParts.push(`Name: ${name}`);
      if (jobTitle) contextParts.push(`Job Title: ${jobTitle}`);
      if (company) contextParts.push(`Company: ${company}`);
      if (email) {
        const domain = email.split("@")[1];
        if (
          domain &&
          !domain.includes("gmail") &&
          !domain.includes("yahoo") &&
          !domain.includes("hotmail")
        ) {
          contextParts.push(`Work Domain: ${domain}`);
        }
      }
      if (website) contextParts.push(`Website: ${website}`);

      const context = contextParts.join("\n");

      // Try to use Groq for AI suggestions
      let suggestions = {
        sectors: [] as string[],
        skills: [] as string[],
        interests: [] as string[],
        bio: "",
      };

      try {
        const { config } = await import("../../config/index.js");

        if (config.ai.groq.enabled && config.ai.groq.apiKey) {
          logger.info("Using Groq for contact analysis");

          const prompt = `Based on the following contact information, suggest relevant professional attributes.

Contact Information:
${context}

Please provide:
1. 3-5 relevant industry sectors (e.g., Technology, Finance, Healthcare, Marketing)
2. 5-8 likely professional skills based on their role
3. 3-5 potential professional interests
4. A brief 1-2 sentence professional bio

IMPORTANT:
- Each array must contain UNIQUE items only - NO DUPLICATES
- Each sector/skill/interest should appear only ONCE
- Normalize similar items (e.g., "Software Development" and "Software Engineering" should be just one)

Respond in JSON format:
{
  "sectors": ["sector1", "sector2", ...],
  "skills": ["skill1", "skill2", ...],
  "interests": ["interest1", "interest2", ...],
  "bio": "Professional bio here"
}`;

          const response = await fetch(
            "https://api.groq.com/openai/v1/chat/completions",
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${config.ai.groq.apiKey}`,
              },
              body: JSON.stringify({
                model: config.ai.groq.model || "llama-3.3-70b-versatile",
                messages: [
                  {
                    role: "system",
                    content:
                      "You are an expert at analyzing professional profiles and suggesting relevant attributes. Always respond with valid JSON.",
                  },
                  { role: "user", content: prompt },
                ],
                temperature: 0.7,
                max_tokens: 500,
              }),
            },
          );

          if (response.ok) {
            const data = (await response.json()) as {
              choices?: Array<{ message?: { content?: string } }>;
            };
            const content = data.choices?.[0]?.message?.content;

            if (content) {
              logger.debug("Groq response received", {
                content: content.substring(0, 200),
              });

              // Try to parse JSON from response
              const jsonMatch = content.match(/\{[\s\S]*\}/);
              if (jsonMatch) {
                try {
                  const parsed = JSON.parse(jsonMatch[0]);

                  // Deduplicate arrays (case-insensitive)
                  const dedupeArray = (arr: any[]): string[] => {
                    if (!Array.isArray(arr)) return [];
                    const seen = new Set<string>();
                    const result: string[] = [];
                    for (const item of arr) {
                      if (typeof item !== "string" || !item.trim()) continue;
                      const normalized = item.toLowerCase().trim();
                      if (!seen.has(normalized)) {
                        seen.add(normalized);
                        result.push(item.trim());
                      }
                    }
                    return result;
                  };

                  suggestions = {
                    sectors: dedupeArray(parsed.sectors).slice(0, 5),
                    skills: dedupeArray(parsed.skills).slice(0, 8),
                    interests: dedupeArray(parsed.interests).slice(0, 5),
                    bio: typeof parsed.bio === "string" ? parsed.bio : "",
                  };
                  logger.info("AI suggestions generated successfully", {
                    sectors: suggestions.sectors.length,
                    skills: suggestions.skills.length,
                    interests: suggestions.interests.length,
                    hasBio: !!suggestions.bio,
                  });
                } catch (parseError) {
                  logger.warn("Failed to parse AI response JSON", {
                    error: parseError,
                  });
                }
              }
            }
          } else {
            const errorText = await response.text();
            logger.warn("Groq API error", {
              status: response.status,
              error: errorText,
            });
          }
        } else {
          logger.info("Groq not configured, using fallback suggestions");
          // Fallback: Generate basic suggestions based on job title
          suggestions = this.generateFallbackSuggestions(jobTitle, company);
        }
      } catch (aiError) {
        logger.error("AI analysis failed", { error: aiError });
        // Use fallback suggestions
        suggestions = this.generateFallbackSuggestions(jobTitle, company);
      }

      res.json({
        success: true,
        data: suggestions,
      });
    } catch (error) {
      logger.error("Contact analysis failed", { error });
      next(error);
    }
  }

  /**
   * Generate fallback suggestions when AI is not available
   */
  private generateFallbackSuggestions(jobTitle?: string, company?: string) {
    const sectors: string[] = [];
    const skills: string[] = [];
    const interests: string[] = [];
    let bio = "";

    const title = (jobTitle || "").toLowerCase();
    const comp = (company || "").toLowerCase();

    // Sector suggestions based on job title
    if (
      title.includes("tech") ||
      title.includes("engineer") ||
      title.includes("developer") ||
      title.includes("software")
    ) {
      sectors.push("Technology", "Software Development");
      skills.push("Programming", "Problem Solving", "Technical Design");
      interests.push("Innovation", "Tech Trends");
    }
    if (
      title.includes("market") ||
      title.includes("brand") ||
      title.includes("growth")
    ) {
      sectors.push("Marketing", "Digital Marketing");
      skills.push("Marketing Strategy", "Analytics", "Content Creation");
      interests.push("Consumer Behavior", "Branding");
    }
    if (
      title.includes("sales") ||
      title.includes("business development") ||
      title.includes("account")
    ) {
      sectors.push("Sales", "Business Development");
      skills.push("Negotiation", "Relationship Building", "CRM");
      interests.push("Networking", "Deal Making");
    }
    if (
      title.includes("finance") ||
      title.includes("account") ||
      title.includes("cfo")
    ) {
      sectors.push("Finance", "Accounting");
      skills.push("Financial Analysis", "Budgeting", "Reporting");
      interests.push("Investment", "Financial Planning");
    }
    if (
      title.includes("ceo") ||
      title.includes("founder") ||
      title.includes("director") ||
      title.includes("vp")
    ) {
      sectors.push("Executive Leadership", "Strategy");
      skills.push("Leadership", "Strategic Planning", "Team Management");
      interests.push("Business Strategy", "Entrepreneurship");
    }
    if (
      title.includes("design") ||
      title.includes("creative") ||
      title.includes("ux") ||
      title.includes("ui")
    ) {
      sectors.push("Design", "Creative Services");
      skills.push("Design Thinking", "UX/UI", "Visual Design");
      interests.push("User Experience", "Creative Technology");
    }
    if (
      title.includes("hr") ||
      title.includes("human") ||
      title.includes("people") ||
      title.includes("talent")
    ) {
      sectors.push("Human Resources", "Talent Management");
      skills.push("Recruiting", "Employee Relations", "Training");
      interests.push("Organizational Development", "Workplace Culture");
    }
    if (title.includes("product") || title.includes("pm")) {
      sectors.push("Product Management", "Technology");
      skills.push("Product Strategy", "Roadmapping", "User Research");
      interests.push("Product Innovation", "Customer Experience");
    }

    // Default sectors if none matched
    if (sectors.length === 0) {
      sectors.push("Business", "Professional Services");
      skills.push("Communication", "Problem Solving");
      interests.push("Professional Development");
    }

    // Generate bio
    if (jobTitle && company) {
      bio = `${jobTitle} at ${company}. Professional with expertise in ${skills.slice(0, 2).join(" and ").toLowerCase()}.`;
    } else if (jobTitle) {
      bio = `Experienced ${jobTitle} with skills in ${skills.slice(0, 2).join(" and ").toLowerCase()}.`;
    } else if (company) {
      bio = `Professional working at ${company}.`;
    }

    return {
      sectors: [...new Set(sectors)].slice(0, 5),
      skills: [...new Set(skills)].slice(0, 8),
      interests: [...new Set(interests)].slice(0, 5),
      bio,
    };
  }

  // ============================================
  // CONTACT TASKS
  // ============================================

  /**
   * Create a task for a contact
   *
   * POST /api/v1/contacts/:id/tasks
   */
  async createTask(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      if (!req.user) {
        throw new AuthenticationError("Authentication required");
      }

      const contactId = String(req.params.id);
      const {
        title,
        description,
        voiceNoteUrl,
        dueDate,
        reminderAt,
        priority,
      } = req.body;

      // Verify contact ownership
      const contact = await prisma.contact.findFirst({
        where: { id: contactId, ownerId: req.user.userId },
      });

      if (!contact) {
        res.status(404).json({
          success: false,
          error: { code: "NOT_FOUND", message: "Contact not found" },
        });
        return;
      }

      const task = await prisma.contactTask.create({
        data: {
          contactId,
          userId: req.user.userId,
          title,
          description,
          voiceNoteUrl,
          dueDate: dueDate ? new Date(dueDate) : undefined,
          reminderAt: reminderAt ? new Date(reminderAt) : undefined,
          priority: priority || "MEDIUM",
          status: "PENDING",
        },
        include: {
          contact: {
            select: { id: true, fullName: true },
          },
        },
      });

      logger.info("Task created", {
        userId: req.user.userId,
        taskId: task.id,
        contactId,
      });

      res.status(201).json({
        success: true,
        data: task,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * List tasks for a contact
   *
   * GET /api/v1/contacts/:id/tasks
   */
  async listTasks(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      if (!req.user) {
        throw new AuthenticationError("Authentication required");
      }

      const contactId = String(req.params.id);
      const status = req.query.status as string | undefined;

      // Verify contact ownership
      const contact = await prisma.contact.findFirst({
        where: { id: contactId, ownerId: req.user.userId },
      });

      if (!contact) {
        res.status(404).json({
          success: false,
          error: { code: "NOT_FOUND", message: "Contact not found" },
        });
        return;
      }

      const where: any = { contactId, userId: req.user.userId };
      if (status) {
        where.status = status;
      }

      const tasks = await prisma.contactTask.findMany({
        where,
        orderBy: [{ status: "asc" }, { dueDate: "asc" }, { createdAt: "desc" }],
      });

      res.status(200).json({
        success: true,
        data: tasks,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update a task
   *
   * PUT /api/v1/contacts/:id/tasks/:taskId
   */
  async updateTask(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      if (!req.user) {
        throw new AuthenticationError("Authentication required");
      }

      const { taskId } = req.params as { taskId: string };
      const {
        title,
        description,
        voiceNoteUrl,
        dueDate,
        reminderAt,
        priority,
        status,
      } = req.body;

      // Verify task ownership
      const existingTask = await prisma.contactTask.findFirst({
        where: { id: taskId, userId: req.user.userId },
      });

      if (!existingTask) {
        res.status(404).json({
          success: false,
          error: { code: "NOT_FOUND", message: "Task not found" },
        });
        return;
      }

      const updateData: any = {};
      if (title !== undefined) updateData.title = title;
      if (description !== undefined) updateData.description = description;
      if (voiceNoteUrl !== undefined) updateData.voiceNoteUrl = voiceNoteUrl;
      if (dueDate !== undefined)
        updateData.dueDate = dueDate ? new Date(dueDate) : null;
      if (reminderAt !== undefined)
        updateData.reminderAt = reminderAt ? new Date(reminderAt) : null;
      if (priority !== undefined) updateData.priority = priority;
      if (status !== undefined) {
        updateData.status = status;
        if (status === "COMPLETED") {
          updateData.completedAt = new Date();
        } else if (existingTask.status === "COMPLETED") {
          updateData.completedAt = null;
        }
      }

      const task = await prisma.contactTask.update({
        where: { id: taskId },
        data: updateData,
        include: {
          contact: {
            select: { id: true, fullName: true },
          },
        },
      });

      logger.info("Task updated", { userId: req.user.userId, taskId });

      res.status(200).json({
        success: true,
        data: task,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Delete a task
   *
   * DELETE /api/v1/contacts/:id/tasks/:taskId
   */
  async deleteTask(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      if (!req.user) {
        throw new AuthenticationError("Authentication required");
      }

      const { taskId } = req.params as { taskId: string };

      // Verify task ownership
      const task = await prisma.contactTask.findFirst({
        where: { id: taskId, userId: req.user.userId },
      });

      if (!task) {
        res.status(404).json({
          success: false,
          error: { code: "NOT_FOUND", message: "Task not found" },
        });
        return;
      }

      await prisma.contactTask.delete({ where: { id: taskId } });

      logger.info("Task deleted", { userId: req.user.userId, taskId });

      res.status(200).json({
        success: true,
        message: "Task deleted successfully",
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get all tasks for dashboard (across all contacts)
   *
   * GET /api/v1/tasks
   */
  async getAllTasks(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      if (!req.user) {
        throw new AuthenticationError("Authentication required");
      }

      const status = req.query.status as string | undefined;
      const upcoming = req.query.upcoming === "true";
      const limit = req.query.limit
        ? parseInt(req.query.limit as string, 10)
        : 50;

      const where: any = { userId: req.user.userId };

      if (status) {
        where.status = status;
      } else if (upcoming) {
        // Get pending/in-progress tasks with due date in the future or today
        where.status = { in: ["PENDING", "IN_PROGRESS"] };
      }

      const tasks = await prisma.contactTask.findMany({
        where,
        include: {
          contact: {
            select: { id: true, fullName: true, company: true },
          },
        },
        orderBy: [
          { dueDate: "asc" },
          { priority: "desc" },
          { createdAt: "desc" },
        ],
        take: limit,
      });

      res.status(200).json({
        success: true,
        data: tasks,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Send task via email to contact
   *
   * POST /api/v1/contacts/:id/tasks/:taskId/send-email
   */
  async sendTaskEmail(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      if (!req.user) {
        throw new AuthenticationError("Authentication required");
      }

      const { id: contactId, taskId } = req.params as {
        id: string;
        taskId: string;
      };

      // Get task with contact info
      const task = await prisma.contactTask.findFirst({
        where: { id: taskId, contactId, userId: req.user.userId },
        include: {
          contact: {
            select: { id: true, fullName: true, email: true },
          },
        },
      });

      if (!task) {
        res.status(404).json({
          success: false,
          error: { code: "NOT_FOUND", message: "Task not found" },
        });
        return;
      }

      if (!task.contact.email) {
        res.status(400).json({
          success: false,
          error: {
            code: "NO_EMAIL",
            message: "Contact does not have an email address",
          },
        });
        return;
      }

      // Get sender info
      const user = await prisma.user.findUnique({
        where: { id: req.user.userId },
        select: { fullName: true },
      });

      // Import email service
      const { emailService } =
        await import("../../infrastructure/services/EmailService.js");

      // Format due date
      let formattedDueDate: string | undefined;
      if (task.dueDate) {
        formattedDueDate = new Date(task.dueDate).toLocaleDateString("en-US", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        });
      }

      // Send email
      const sent = await emailService.sendTaskEmail(task.contact.email, {
        contactName: task.contact.fullName,
        senderName: user?.fullName || "A user",
        taskTitle: task.title,
        taskDescription: task.description || undefined,
        taskDueDate: formattedDueDate,
        taskPriority: task.priority,
      });

      if (!sent) {
        res.status(500).json({
          success: false,
          error: { code: "EMAIL_FAILED", message: "Failed to send email" },
        });
        return;
      }

      logger.info("Task email sent", {
        userId: req.user.userId,
        taskId,
        contactEmail: task.contact.email,
      });

      res.status(200).json({
        success: true,
        message: "Task sent via email successfully",
      });
    } catch (error) {
      next(error);
    }
  }

  // ============================================
  // CONTACT REMINDERS
  // ============================================

  /**
   * Create a reminder for a contact
   *
   * POST /api/v1/contacts/:id/reminders
   */
  async createReminder(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      if (!req.user) {
        throw new AuthenticationError("Authentication required");
      }

      const contactId = String(req.params.id);
      const { title, description, reminderAt } = req.body;

      if (!reminderAt) {
        res.status(400).json({
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "reminderAt is required",
          },
        });
        return;
      }

      // Verify contact ownership
      const contact = await prisma.contact.findFirst({
        where: { id: contactId, ownerId: req.user.userId },
      });

      if (!contact) {
        res.status(404).json({
          success: false,
          error: { code: "NOT_FOUND", message: "Contact not found" },
        });
        return;
      }

      const reminder = await prisma.contactReminder.create({
        data: {
          contactId,
          userId: req.user.userId,
          title,
          description,
          reminderAt: new Date(reminderAt),
        },
        include: {
          contact: {
            select: { id: true, fullName: true },
          },
        },
      });

      logger.info("Reminder created", {
        userId: req.user.userId,
        reminderId: reminder.id,
        contactId,
      });

      res.status(201).json({
        success: true,
        data: reminder,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * List reminders for a contact
   *
   * GET /api/v1/contacts/:id/reminders
   */
  async listReminders(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      if (!req.user) {
        throw new AuthenticationError("Authentication required");
      }

      const contactId = String(req.params.id);
      const includeCompleted = req.query.includeCompleted === "true";

      // Verify contact ownership
      const contact = await prisma.contact.findFirst({
        where: { id: contactId, ownerId: req.user.userId },
      });

      if (!contact) {
        res.status(404).json({
          success: false,
          error: { code: "NOT_FOUND", message: "Contact not found" },
        });
        return;
      }

      const where: any = { contactId, userId: req.user.userId };
      if (!includeCompleted) {
        where.isCompleted = false;
      }

      const reminders = await prisma.contactReminder.findMany({
        where,
        orderBy: { reminderAt: "asc" },
      });

      res.status(200).json({
        success: true,
        data: reminders,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update a reminder
   *
   * PUT /api/v1/contacts/:id/reminders/:reminderId
   */
  async updateReminder(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      if (!req.user) {
        throw new AuthenticationError("Authentication required");
      }

      const { reminderId } = req.params as { reminderId: string };
      const { title, description, reminderAt, isCompleted } = req.body;

      // Verify reminder ownership
      const existingReminder = await prisma.contactReminder.findFirst({
        where: { id: reminderId, userId: req.user.userId },
      });

      if (!existingReminder) {
        res.status(404).json({
          success: false,
          error: { code: "NOT_FOUND", message: "Reminder not found" },
        });
        return;
      }

      const updateData: any = {};
      if (title !== undefined) updateData.title = title;
      if (description !== undefined) updateData.description = description;
      if (reminderAt !== undefined)
        updateData.reminderAt = new Date(reminderAt);
      if (isCompleted !== undefined) {
        updateData.isCompleted = isCompleted;
        if (isCompleted) {
          updateData.completedAt = new Date();
        } else {
          updateData.completedAt = null;
        }
      }

      const reminder = await prisma.contactReminder.update({
        where: { id: reminderId },
        data: updateData,
        include: {
          contact: {
            select: { id: true, fullName: true },
          },
        },
      });

      logger.info("Reminder updated", { userId: req.user.userId, reminderId });

      res.status(200).json({
        success: true,
        data: reminder,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Delete a reminder
   *
   * DELETE /api/v1/contacts/:id/reminders/:reminderId
   */
  async deleteReminder(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      if (!req.user) {
        throw new AuthenticationError("Authentication required");
      }

      const { reminderId } = req.params as { reminderId: string };

      // Verify reminder ownership
      const reminder = await prisma.contactReminder.findFirst({
        where: { id: reminderId, userId: req.user.userId },
      });

      if (!reminder) {
        res.status(404).json({
          success: false,
          error: { code: "NOT_FOUND", message: "Reminder not found" },
        });
        return;
      }

      await prisma.contactReminder.delete({ where: { id: reminderId } });

      logger.info("Reminder deleted", { userId: req.user.userId, reminderId });

      res.status(200).json({
        success: true,
        message: "Reminder deleted successfully",
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get all reminders for dashboard (across all contacts)
   *
   * GET /api/v1/reminders
   */
  async getAllReminders(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      if (!req.user) {
        throw new AuthenticationError("Authentication required");
      }

      const includeCompleted = req.query.includeCompleted === "true";
      const upcoming = req.query.upcoming === "true";
      const limit = req.query.limit
        ? parseInt(req.query.limit as string, 10)
        : 50;

      const where: any = { userId: req.user.userId };

      if (!includeCompleted) {
        where.isCompleted = false;
      }

      if (upcoming) {
        // Get reminders due today or in the future
        where.reminderAt = { gte: new Date(new Date().setHours(0, 0, 0, 0)) };
      }

      const reminders = await prisma.contactReminder.findMany({
        where,
        include: {
          contact: {
            select: { id: true, fullName: true, company: true },
          },
        },
        orderBy: { reminderAt: "asc" },
        take: limit,
      });

      res.status(200).json({
        success: true,
        data: reminders,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Upload voice note for task
   *
   * POST /api/v1/contacts/:id/tasks/:taskId/voice
   */
  async uploadTaskVoice(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      if (!req.user) {
        throw new AuthenticationError("Authentication required");
      }

      const { taskId } = req.params as { taskId: string };

      // Verify task ownership
      const task = await prisma.contactTask.findFirst({
        where: { id: taskId, userId: req.user.userId },
      });

      if (!task) {
        res.status(404).json({
          success: false,
          error: { code: "NOT_FOUND", message: "Task not found" },
        });
        return;
      }

      // Handle file upload
      if (!req.file) {
        res.status(400).json({
          success: false,
          error: { code: "NO_FILE", message: "No audio file provided" },
        });
        return;
      }

      // Try to save to MinIO/S3, fallback to base64
      let voiceNoteUrl: string;

      try {
        const { getStorageService } =
          await import("../../infrastructure/external/storage/index.js");
        const storage = getStorageService();

        const bucket = "voice-notes";
        const key = `${req.user.userId}/${taskId}-${Date.now()}.webm`;

        // Ensure bucket exists
        await storage.ensureBucket(bucket);

        const result = await storage.upload(bucket, key, req.file.buffer, {
          contentType: req.file.mimetype || "audio/webm",
        });
        voiceNoteUrl = result.url;
      } catch (storageError) {
        // Fallback to base64
        logger.warn("Storage upload failed, using base64", {
          error: storageError,
        });
        const base64 = req.file.buffer.toString("base64");
        voiceNoteUrl = `data:${req.file.mimetype || "audio/webm"};base64,${base64}`;
      }

      // Update task with voice note URL
      const updatedTask = await prisma.contactTask.update({
        where: { id: taskId },
        data: { voiceNoteUrl },
        include: {
          contact: {
            select: { id: true, fullName: true },
          },
        },
      });

      logger.info("Voice note uploaded", { userId: req.user.userId, taskId });

      res.status(200).json({
        success: true,
        data: updatedTask,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Upload images for task
   *
   * POST /api/v1/contacts/:id/tasks/:taskId/images
   */
  async uploadTaskImages(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      if (!req.user) {
        throw new AuthenticationError("Authentication required");
      }

      const { taskId } = req.params as { taskId: string };

      // Verify task ownership
      const task = await prisma.contactTask.findFirst({
        where: { id: taskId, userId: req.user.userId },
      });

      if (!task) {
        res.status(404).json({
          success: false,
          error: { code: "NOT_FOUND", message: "Task not found" },
        });
        return;
      }

      // Handle file upload (multiple files)
      const files = req.files as Express.Multer.File[];
      if (!files || files.length === 0) {
        res.status(400).json({
          success: false,
          error: { code: "NO_FILES", message: "No image files provided" },
        });
        return;
      }

      // Get existing image URLs
      const existingUrls = (task.imageUrls as string[]) || [];
      const newUrls: string[] = [];

      // Upload each image
      for (const file of files) {
        // Validate file type
        if (!file.mimetype.startsWith("image/")) {
          continue;
        }

        try {
          const { getStorageService } =
            await import("../../infrastructure/external/storage/index.js");
          const storage = getStorageService();

          const bucket = "task-images";
          const ext = file.originalname.split(".").pop() || "jpg";
          const key = `${req.user.userId}/${taskId}/${Date.now()}-${Math.random().toString(36).substr(2, 9)}.${ext}`;

          // Ensure bucket exists
          await storage.ensureBucket(bucket);

          const result = await storage.upload(bucket, key, file.buffer, {
            contentType: file.mimetype,
          });
          newUrls.push(result.url);
        } catch (storageError) {
          // Fallback to base64
          logger.warn("Storage upload failed, using base64", {
            error: storageError,
          });
          const base64 = file.buffer.toString("base64");
          newUrls.push(`data:${file.mimetype};base64,${base64}`);
        }
      }

      // Update task with combined image URLs
      const updatedTask = await prisma.contactTask.update({
        where: { id: taskId },
        data: { imageUrls: [...existingUrls, ...newUrls] },
        include: {
          contact: {
            select: { id: true, fullName: true },
          },
        },
      });

      logger.info("Task images uploaded", {
        userId: req.user.userId,
        taskId,
        count: newUrls.length,
      });

      res.status(200).json({
        success: true,
        data: updatedTask,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Delete image from task
   *
   * DELETE /api/v1/contacts/:id/tasks/:taskId/images/:imageIndex
   */
  async deleteTaskImage(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      if (!req.user) {
        throw new AuthenticationError("Authentication required");
      }

      const { taskId, imageIndex } = req.params as {
        taskId: string;
        imageIndex: string;
      };
      const index = parseInt(imageIndex, 10);

      // Verify task ownership
      const task = await prisma.contactTask.findFirst({
        where: { id: taskId, userId: req.user.userId },
      });

      if (!task) {
        res.status(404).json({
          success: false,
          error: { code: "NOT_FOUND", message: "Task not found" },
        });
        return;
      }

      const imageUrls = (task.imageUrls as string[]) || [];
      if (index < 0 || index >= imageUrls.length) {
        res.status(400).json({
          success: false,
          error: { code: "INVALID_INDEX", message: "Invalid image index" },
        });
        return;
      }

      // Remove image at index
      imageUrls.splice(index, 1);

      // Update task
      const updatedTask = await prisma.contactTask.update({
        where: { id: taskId },
        data: { imageUrls: imageUrls.length > 0 ? imageUrls : null },
        include: {
          contact: {
            select: { id: true, fullName: true },
          },
        },
      });

      logger.info("Task image deleted", {
        userId: req.user.userId,
        taskId,
        imageIndex: index,
      });

      res.status(200).json({
        success: true,
        data: updatedTask,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Upload images for reminder
   *
   * POST /api/v1/contacts/:id/reminders/:reminderId/images
   */
  async uploadReminderImages(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      if (!req.user) {
        throw new AuthenticationError("Authentication required");
      }

      const { reminderId } = req.params as { reminderId: string };

      // Verify reminder ownership
      const reminder = await prisma.contactReminder.findFirst({
        where: { id: reminderId, userId: req.user.userId },
      });

      if (!reminder) {
        res.status(404).json({
          success: false,
          error: { code: "NOT_FOUND", message: "Reminder not found" },
        });
        return;
      }

      // Handle file upload (multiple files)
      const files = req.files as Express.Multer.File[];
      if (!files || files.length === 0) {
        res.status(400).json({
          success: false,
          error: { code: "NO_FILES", message: "No image files provided" },
        });
        return;
      }

      // Get existing image URLs
      const existingUrls = (reminder.imageUrls as string[]) || [];
      const newUrls: string[] = [];

      // Upload each image
      for (const file of files) {
        // Validate file type
        if (!file.mimetype.startsWith("image/")) {
          continue;
        }

        try {
          const { getStorageService } =
            await import("../../infrastructure/external/storage/index.js");
          const storage = getStorageService();

          const bucket = "reminder-images";
          const ext = file.originalname.split(".").pop() || "jpg";
          const key = `${req.user.userId}/${reminderId}/${Date.now()}-${Math.random().toString(36).substr(2, 9)}.${ext}`;

          // Ensure bucket exists
          await storage.ensureBucket(bucket);

          const result = await storage.upload(bucket, key, file.buffer, {
            contentType: file.mimetype,
          });
          newUrls.push(result.url);
        } catch (storageError) {
          // Fallback to base64
          logger.warn("Storage upload failed, using base64", {
            error: storageError,
          });
          const base64 = file.buffer.toString("base64");
          newUrls.push(`data:${file.mimetype};base64,${base64}`);
        }
      }

      // Update reminder with combined image URLs
      const updatedReminder = await prisma.contactReminder.update({
        where: { id: reminderId },
        data: { imageUrls: [...existingUrls, ...newUrls] },
        include: {
          contact: {
            select: { id: true, fullName: true },
          },
        },
      });

      logger.info("Reminder images uploaded", {
        userId: req.user.userId,
        reminderId,
        count: newUrls.length,
      });

      res.status(200).json({
        success: true,
        data: updatedReminder,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Delete image from reminder
   *
   * DELETE /api/v1/contacts/:id/reminders/:reminderId/images/:imageIndex
   */
  async deleteReminderImage(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      if (!req.user) {
        throw new AuthenticationError("Authentication required");
      }

      const { reminderId, imageIndex } = req.params as {
        reminderId: string;
        imageIndex: string;
      };
      const index = parseInt(imageIndex, 10);

      // Verify reminder ownership
      const reminder = await prisma.contactReminder.findFirst({
        where: { id: reminderId, userId: req.user.userId },
      });

      if (!reminder) {
        res.status(404).json({
          success: false,
          error: { code: "NOT_FOUND", message: "Reminder not found" },
        });
        return;
      }

      const imageUrls = (reminder.imageUrls as string[]) || [];
      if (index < 0 || index >= imageUrls.length) {
        res.status(400).json({
          success: false,
          error: { code: "INVALID_INDEX", message: "Invalid image index" },
        });
        return;
      }

      // Remove image at index
      imageUrls.splice(index, 1);

      // Update reminder
      const updatedReminder = await prisma.contactReminder.update({
        where: { id: reminderId },
        data: { imageUrls: imageUrls.length > 0 ? imageUrls : null },
        include: {
          contact: {
            select: { id: true, fullName: true },
          },
        },
      });

      logger.info("Reminder image deleted", {
        userId: req.user.userId,
        reminderId,
        imageIndex: index,
      });

      res.status(200).json({
        success: true,
        data: updatedReminder,
      });
    } catch (error) {
      next(error);
    }
  }

  // ============================================
  // CONTACT NOTES (Rich Media Notes)
  // ============================================

  /**
   * List notes for a contact
   *
   * GET /api/v1/contacts/:id/notes
   */
  async listNotes(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      if (!req.user) {
        throw new AuthenticationError("Authentication required");
      }

      const contactId = String(req.params.id);
      const type = req.query.type as string | undefined;
      const limit = req.query.limit
        ? parseInt(req.query.limit as string, 10)
        : 50;

      // Verify contact ownership
      const contact = await prisma.contact.findFirst({
        where: { id: contactId, ownerId: req.user.userId },
      });

      if (!contact) {
        res.status(404).json({
          success: false,
          error: { code: "NOT_FOUND", message: "Contact not found" },
        });
        return;
      }

      const where: any = { contactId, userId: req.user.userId };
      if (type && ["TEXT", "IMAGE", "VOICE"].includes(type)) {
        where.type = type;
      }

      const notes = await prisma.contactNote.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
      });

      res.status(200).json({
        success: true,
        data: notes,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Create a text note for a contact
   *
   * POST /api/v1/contacts/:id/notes
   */
  async createNote(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      if (!req.user) {
        throw new AuthenticationError("Authentication required");
      }

      const contactId = String(req.params.id);
      const { content } = req.body;

      if (!content || !content.trim()) {
        res.status(400).json({
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Content is required for text notes",
          },
        });
        return;
      }

      // Verify contact ownership
      const contact = await prisma.contact.findFirst({
        where: { id: contactId, ownerId: req.user.userId },
      });

      if (!contact) {
        res.status(404).json({
          success: false,
          error: { code: "NOT_FOUND", message: "Contact not found" },
        });
        return;
      }

      const note = await prisma.contactNote.create({
        data: {
          contactId,
          userId: req.user.userId,
          type: "TEXT",
          content: content.trim(),
        },
      });

      logger.info("Text note created", {
        userId: req.user.userId,
        noteId: note.id,
        contactId,
      });

      res.status(201).json({
        success: true,
        data: note,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Create an image note for a contact
   *
   * POST /api/v1/contacts/:id/notes/image
   */
  async createImageNote(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      if (!req.user) {
        throw new AuthenticationError("Authentication required");
      }

      const contactId = String(req.params.id);
      const { content } = req.body; // Optional caption

      // Verify contact ownership
      const contact = await prisma.contact.findFirst({
        where: { id: contactId, ownerId: req.user.userId },
      });

      if (!contact) {
        res.status(404).json({
          success: false,
          error: { code: "NOT_FOUND", message: "Contact not found" },
        });
        return;
      }

      // Handle file upload
      if (!req.file) {
        res.status(400).json({
          success: false,
          error: { code: "NO_FILE", message: "No image file provided" },
        });
        return;
      }

      // Upload image to storage
      let mediaUrl: string;
      const mimeType = req.file.mimetype;
      const fileName = req.file.originalname;
      const fileSize = req.file.size;

      try {
        const { getStorageService } =
          await import("../../infrastructure/external/storage/index.js");
        const storage = getStorageService();

        const bucket = "contact-notes";
        const ext = fileName.split(".").pop() || "jpg";
        const key = `${req.user.userId}/${contactId}/images/${Date.now()}-${Math.random().toString(36).substr(2, 9)}.${ext}`;

        // Ensure bucket exists
        await storage.ensureBucket(bucket);

        const result = await storage.upload(bucket, key, req.file.buffer, {
          contentType: mimeType,
        });
        mediaUrl = result.url;
      } catch (storageError) {
        // Fallback to base64
        logger.warn("Storage upload failed, using base64", {
          error: storageError,
        });
        const base64 = req.file.buffer.toString("base64");
        mediaUrl = `data:${mimeType};base64,${base64}`;
      }

      const note = await prisma.contactNote.create({
        data: {
          contactId,
          userId: req.user.userId,
          type: "IMAGE",
          content: content || null,
          mediaUrl,
          mimeType,
          fileName,
          fileSize,
        },
      });

      logger.info("Image note created", {
        userId: req.user.userId,
        noteId: note.id,
        contactId,
      });

      res.status(201).json({
        success: true,
        data: note,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Create a voice note for a contact
   *
   * POST /api/v1/contacts/:id/notes/voice
   */
  async createVoiceNote(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      if (!req.user) {
        throw new AuthenticationError("Authentication required");
      }

      const contactId = String(req.params.id);
      const { duration } = req.body; // Duration in seconds

      // Verify contact ownership
      const contact = await prisma.contact.findFirst({
        where: { id: contactId, ownerId: req.user.userId },
      });

      if (!contact) {
        res.status(404).json({
          success: false,
          error: { code: "NOT_FOUND", message: "Contact not found" },
        });
        return;
      }

      // Handle file upload
      if (!req.file) {
        res.status(400).json({
          success: false,
          error: { code: "NO_FILE", message: "No audio file provided" },
        });
        return;
      }

      // Upload audio to storage
      let mediaUrl: string;
      const mimeType = req.file.mimetype || "audio/webm";
      const fileName = req.file.originalname || "voice-note.webm";
      const fileSize = req.file.size;

      try {
        const { getStorageService } =
          await import("../../infrastructure/external/storage/index.js");
        const storage = getStorageService();

        const bucket = "contact-notes";
        const ext = fileName.split(".").pop() || "webm";
        const key = `${req.user.userId}/${contactId}/voice/${Date.now()}-${Math.random().toString(36).substr(2, 9)}.${ext}`;

        // Ensure bucket exists
        await storage.ensureBucket(bucket);

        const result = await storage.upload(bucket, key, req.file.buffer, {
          contentType: mimeType,
        });
        mediaUrl = result.url;
      } catch (storageError) {
        // Fallback to base64
        logger.warn("Storage upload failed, using base64", {
          error: storageError,
        });
        const base64 = req.file.buffer.toString("base64");
        mediaUrl = `data:${mimeType};base64,${base64}`;
      }

      const note = await prisma.contactNote.create({
        data: {
          contactId,
          userId: req.user.userId,
          type: "VOICE",
          mediaUrl,
          mimeType,
          fileName,
          fileSize,
          duration: duration ? parseInt(duration, 10) : null,
        },
      });

      logger.info("Voice note created", {
        userId: req.user.userId,
        noteId: note.id,
        contactId,
      });

      res.status(201).json({
        success: true,
        data: note,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Create a file note (PDF, Word, PPT, etc.)
   *
   * POST /api/v1/contacts/:id/notes/file
   */
  async createFileNote(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      if (!req.user) {
        throw new AuthenticationError("Authentication required");
      }

      const contactId = String(req.params.id);
      const { content } = req.body; // Optional description

      // Verify contact ownership
      const contact = await prisma.contact.findFirst({
        where: { id: contactId, ownerId: req.user.userId },
      });

      if (!contact) {
        res.status(404).json({
          success: false,
          error: { code: "NOT_FOUND", message: "Contact not found" },
        });
        return;
      }

      // Handle file upload
      if (!req.file) {
        res.status(400).json({
          success: false,
          error: { code: "NO_FILE", message: "No file provided" },
        });
        return;
      }

      // Upload file to storage
      let mediaUrl: string;
      const mimeType = req.file.mimetype;
      const fileName = req.file.originalname;
      const fileSize = req.file.size;

      try {
        const { getStorageService } =
          await import("../../infrastructure/external/storage/index.js");
        const storage = getStorageService();

        const bucket = "contact-notes";
        const ext = fileName.split(".").pop() || "pdf";
        const key = `${req.user.userId}/${contactId}/files/${Date.now()}-${Math.random().toString(36).substr(2, 9)}.${ext}`;

        // Ensure bucket exists
        await storage.ensureBucket(bucket);

        const result = await storage.upload(bucket, key, req.file.buffer, {
          contentType: mimeType,
        });
        mediaUrl = result.url;
      } catch (storageError) {
        // Fallback to base64 for small files
        logger.warn("Storage upload failed, using base64", {
          error: storageError,
        });
        const base64 = req.file.buffer.toString("base64");
        mediaUrl = `data:${mimeType};base64,${base64}`;
      }

      const note = await prisma.contactNote.create({
        data: {
          contactId,
          userId: req.user.userId,
          type: "FILE",
          content: content?.trim() || null,
          mediaUrl,
          mimeType,
          fileName,
          fileSize,
        },
      });

      logger.info("File note created", {
        userId: req.user.userId,
        noteId: note.id,
        contactId,
        fileName,
      });

      res.status(201).json({
        success: true,
        data: note,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Delete a note
   *
   * DELETE /api/v1/contacts/:id/notes/:noteId
   */
  async deleteNote(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      if (!req.user) {
        throw new AuthenticationError("Authentication required");
      }

      const { noteId } = req.params as { noteId: string };

      // Verify note ownership
      const note = await prisma.contactNote.findFirst({
        where: { id: noteId, userId: req.user.userId },
      });

      if (!note) {
        res.status(404).json({
          success: false,
          error: { code: "NOT_FOUND", message: "Note not found" },
        });
        return;
      }

      // Delete from storage if it's a media note (not base64)
      if (note.mediaUrl && !note.mediaUrl.startsWith("data:")) {
        try {
          const { getStorageService } =
            await import("../../infrastructure/external/storage/index.js");
          const storage = getStorageService();
          // Extract bucket and key from URL
          const url = new URL(note.mediaUrl);
          const pathParts = url.pathname.split("/").filter((p) => p);
          if (pathParts.length >= 2) {
            const bucket = pathParts[0];
            const key = pathParts.slice(1).join("/");
            await storage.delete(bucket, key);
          }
        } catch (deleteError) {
          logger.warn("Failed to delete media from storage", {
            error: deleteError,
          });
        }
      }

      await prisma.contactNote.delete({ where: { id: noteId } });

      logger.info("Note deleted", { userId: req.user.userId, noteId });

      res.status(200).json({
        success: true,
        message: "Note deleted successfully",
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Upload avatar image for contact
   *
   * POST /api/v1/contacts/:id/avatar
   */
  async uploadAvatar(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      if (!req.user) {
        throw new AuthenticationError("Authentication required");
      }

      const { id } = req.params as { id: string };

      if (!req.file) {
        res.status(400).json({
          success: false,
          error: { code: "NO_FILE", message: "No avatar file uploaded" },
        });
        return;
      }

      // Verify contact ownership
      const contact = await prisma.contact.findFirst({
        where: { id, ownerId: req.user.userId },
      });

      if (!contact) {
        res.status(404).json({
          success: false,
          error: { code: "NOT_FOUND", message: "Contact not found" },
        });
        return;
      }

      // Store as base64 data URL
      const avatarUrl = `data:${req.file.mimetype};base64,${req.file.buffer.toString("base64")}`;

      const updatedContact = await prisma.contact.update({
        where: { id },
        data: { avatarUrl },
        select: { id: true, avatarUrl: true },
      });

      logger.info("Contact avatar uploaded", {
        userId: req.user.userId,
        contactId: id,
        size: req.file.size,
      });

      res.status(200).json({
        success: true,
        data: { avatarUrl: updatedContact.avatarUrl },
      });
    } catch (error) {
      next(error);
    }
  }
}

// Export singleton instance
export const contactController = new ContactController();
