/**
 * Use Case: Create Introduction
 * Collaborator creates an introduction for a matched contact.
 * Sends consent email/WhatsApp to the contact before proceeding.
 */

import crypto from "crypto";
import {
  ICollaborationRequestRepository,
  ICollaborationMatchResultRepository,
  IIntroductionRepository,
} from "../../../domain/repositories/ICollaborationRepository";
import {
  CollaborationRequestStatus,
  CollaborationSourceType,
  IntroductionStatus,
  getSourceId,
} from "../../../domain/entities/Collaboration";
import {
  NotFoundError,
  ForbiddenError,
  ValidationError,
} from "../../../shared/errors/index.js";
import { logger } from "../../../shared/logger";
import { prisma } from "../../../infrastructure/database/prisma/client.js";
import { EmailService } from "../../../infrastructure/services/EmailService";

export interface CreateIntroductionInput {
  requestId: string;
  matchResultId: string;
  channel?: "EMAIL" | "WHATSAPP";
  contactEmail?: string;
  contactPhone?: string;
  message?: string;
}

export interface CreateIntroductionOutput {
  id: string;
  collaborationRequestId: string;
  thirdPartyContactRef: string;
  status: string;
  token: string | null;
  channel: string | null;
  emailSent: boolean;
  createdAt: string;
}

export class CreateIntroductionUseCase {
  private emailService: EmailService;

  constructor(
    private readonly requestRepository: ICollaborationRequestRepository,
    private readonly matchResultRepository: ICollaborationMatchResultRepository,
    private readonly introductionRepository: IIntroductionRepository,
  ) {
    this.emailService = new EmailService();
  }

  async execute(
    userId: string,
    input: CreateIntroductionInput,
  ): Promise<CreateIntroductionOutput> {
    // Verify request exists and user is the collaborator
    const request = await this.requestRepository.findById(input.requestId);
    if (!request) {
      throw new NotFoundError("Collaboration request not found");
    }

    if (request.toUserId !== userId) {
      throw new ForbiddenError(
        "Only the collaborator can create introductions",
      );
    }

    if (request.status !== CollaborationRequestStatus.ACCEPTED) {
      throw new ValidationError(
        "Request must be accepted to create introductions",
      );
    }

    // Verify match result exists
    const matchResult = await this.matchResultRepository.findByIdWithContact(
      input.matchResultId,
    );
    if (!matchResult) {
      throw new NotFoundError("Match result not found");
    }

    if (matchResult.isIntroduced) {
      throw new ValidationError("This contact has already been introduced");
    }

    if (matchResult.isDismissed) {
      throw new ValidationError("Cannot introduce a dismissed contact");
    }

    // Determine channel and contact info
    const channel = input.channel || "EMAIL";
    const contactEmail =
      input.contactEmail || matchResult.contact?.email || null;
    const contactPhone =
      input.contactPhone || matchResult.contact?.phone || null;
    const contactName = matchResult.contact?.fullName || "Contact";

    if (channel === "EMAIL" && !contactEmail) {
      throw new ValidationError(
        "Contact email is required for email introduction",
      );
    }
    if (channel === "WHATSAPP" && !contactPhone) {
      throw new ValidationError(
        "Contact phone is required for WhatsApp introduction",
      );
    }

    // Generate secure token
    const token = crypto.randomBytes(32).toString("hex");
    const frontendUrl = process.env.FRONTEND_URL || "https://intellmatch.com";
    const introductionUrl = `${frontendUrl}/introduce/${token}`;

    // Fetch source feature details
    const sourceId = getSourceId(request);
    const sourceFeature = await this.getSourceFeature(
      request.sourceType,
      sourceId,
    );

    // Fetch User A (owner) info
    const ownerUser = await prisma.user.findUnique({
      where: { id: request.fromUserId },
      select: { id: true, fullName: true, company: true },
    });

    // Fetch collaborator (User B) info
    const collaboratorUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, fullName: true },
    });

    logger.info("Creating introduction with consent flow", {
      requestId: input.requestId,
      matchResultId: input.matchResultId,
      channel,
      userId,
    });

    // Create introduction with status=SENT
    const introduction = await this.introductionRepository.create({
      collaborationRequestId: input.requestId,
      collaboratorUserId: userId,
      thirdPartyContactRef: matchResult.contactId,
      token,
      channel,
      contactEmail: contactEmail,
      contactPhone: contactPhone,
      contactName: contactName,
      message: input.message || null,
      status: IntroductionStatus.SENT,
      sentAt: new Date(),
    });

    // Mark match result as introduced
    await this.matchResultRepository.update(input.matchResultId, {
      isIntroduced: true,
    });

    // Send notification via chosen channel
    let emailSent = false;
    if (channel === "EMAIL" && contactEmail) {
      try {
        logger.info("Attempting to send introduction consent email", {
          introductionId: introduction.id,
          to: contactEmail,
          collaboratorName: collaboratorUser?.fullName,
          ownerName: ownerUser?.fullName,
          sourceTitle: sourceFeature?.title,
        });
        const sent = await this.emailService.sendIntroductionConsentEmail(
          contactEmail,
          {
            contactName,
            collaboratorName: collaboratorUser?.fullName || "A collaborator",
            ownerName: ownerUser?.fullName || "Someone",
            ownerCompany: ownerUser?.company || undefined,
            sourceType: request.sourceType,
            sourceTitle: sourceFeature?.title || "Collaboration",
            sourceDescription: sourceFeature?.description || undefined,
            introductionUrl,
            customMessage: input.message || undefined,
          },
        );
        emailSent = sent;
        if (sent) {
          logger.info("Introduction consent email sent successfully", {
            introductionId: introduction.id,
            to: contactEmail,
          });
        } else {
          logger.warn(
            "Introduction consent email returned false (SendGrid not configured or failed)",
            { introductionId: introduction.id, to: contactEmail },
          );
        }
      } catch (err: any) {
        logger.error("Failed to send introduction consent email", {
          introductionId: introduction.id,
          to: contactEmail,
          error: err?.message || err,
          stack: err?.stack,
        });
      }
    } else if (channel === "WHATSAPP" && contactPhone) {
      // WhatsApp sending - generate link for manual send for now
      logger.info("WhatsApp introduction - manual send required", {
        introductionId: introduction.id,
        introductionUrl,
      });
    }

    logger.info("Introduction created with consent flow", {
      introductionId: introduction.id,
      emailSent,
      channel,
    });

    return {
      id: introduction.id,
      collaborationRequestId: introduction.collaborationRequestId,
      thirdPartyContactRef: introduction.thirdPartyContactRef,
      status: introduction.status,
      token: introduction.token,
      channel: introduction.channel,
      emailSent,
      createdAt: introduction.createdAt.toISOString(),
    };
  }

  private async getSourceFeature(
    sourceType: CollaborationSourceType,
    sourceId: string,
  ): Promise<{ title: string; description: string | null } | null> {
    switch (sourceType) {
      case CollaborationSourceType.PROJECT: {
        const project = await prisma.project.findUnique({
          where: { id: sourceId },
          select: { title: true, summary: true },
        });
        return project
          ? { title: project.title, description: project.summary }
          : null;
      }
      case CollaborationSourceType.OPPORTUNITY: {
        const opp = await prisma.opportunityIntent.findUnique({
          where: { id: sourceId },
          select: { title: true, notes: true },
        });
        return opp ? { title: opp.title, description: opp.notes } : null;
      }
      case CollaborationSourceType.PITCH: {
        const pitch = await prisma.pitch.findUnique({
          where: { id: sourceId },
          select: { title: true },
        });
        return pitch ? { title: pitch.title, description: null } : null;
      }
      case CollaborationSourceType.DEAL: {
        const deal = await prisma.dealRequest.findUnique({
          where: { id: sourceId },
          select: { title: true, problemStatement: true },
        });
        return deal
          ? { title: deal.title || "Deal", description: deal.problemStatement }
          : null;
      }
      default:
        return null;
    }
  }
}
