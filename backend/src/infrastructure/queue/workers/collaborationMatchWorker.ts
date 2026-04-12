/**
 * Collaboration Match Worker
 *
 * Background worker for collaboration matching jobs.
 * Processes matching asynchronously and notifies users via WebSocket.
 * Updated for feature-based collaboration (no missions).
 *
 * @module infrastructure/queue/workers/collaborationMatchWorker
 */

import { Job } from 'bullmq';
import { logger } from '../../../shared/logger/index.js';
import { queueService, QueueName, CollaborationMatchingJobData } from '../QueueService.js';
import { CollaborationMatchingService, CollaboratorContact } from '../../services/collaboration/CollaborationMatchingService.js';
import {
  PrismaCollaborationRequestRepository,
  PrismaCollaborationSessionRepository,
  PrismaCollaborationMatchResultRepository,
} from '../../repositories/PrismaCollaborationRepository.js';
import { PrismaContactRepository } from '../../repositories/PrismaContactRepository.js';
import {
  CollaborationSessionStatus,
  CollaborationSourceType,
  CollaborationCriteria,
} from '../../../domain/entities/Collaboration.js';
import { prisma } from '../../database/prisma/client.js';

/**
 * Collaboration match result
 */
interface CollaborationMatchWorkerResult {
  sessionId: string;
  matchCount: number;
  status: 'completed' | 'failed';
  error?: string;
}

// Initialize repositories
const requestRepository = new PrismaCollaborationRequestRepository();
const sessionRepository = new PrismaCollaborationSessionRepository();
const matchResultRepository = new PrismaCollaborationMatchResultRepository();
const contactRepository = new PrismaContactRepository();

// Initialize matching service
const matchingService = new CollaborationMatchingService();

/**
 * Get criteria from source feature based on type
 */
async function getSourceFeatureCriteria(
  sourceType: CollaborationSourceType,
  sourceId: string
): Promise<CollaborationCriteria | null> {
  switch (sourceType) {
    case CollaborationSourceType.PROJECT: {
      const project = await prisma.project.findUnique({
        where: { id: sourceId },
        include: {
          sectors: { include: { sector: true } },
          skillsNeeded: { include: { skill: true } },
        },
      });
      if (!project) return null;
      return {
        sectors: project.sectors.map((ps) => ps.sector.name),
        skills: project.skillsNeeded.map((ps) => ps.skill.name),
        keywords: (project.keywords as string[]) || [],
      };
    }

    case CollaborationSourceType.OPPORTUNITY: {
      const opportunity = await prisma.opportunityIntent.findUnique({
        where: { id: sourceId },
        include: {
          sectorPrefs: { include: { sector: true } },
          skillPrefs: { include: { skill: true } },
        },
      });
      if (!opportunity) return null;
      return {
        sectors: opportunity.sectorPrefs.map((sp) => sp.sector.name),
        skills: opportunity.skillPrefs.map((sp) => sp.skill.name),
        locations: opportunity.locationPref ? [opportunity.locationPref] : [],
      };
    }

    case CollaborationSourceType.PITCH: {
      const pitch = await prisma.pitch.findUnique({
        where: { id: sourceId },
        include: {
          sections: true,
          needs: true,
        },
      });
      if (!pitch) return null;

      const allSectors: string[] = [];
      const allSkills: string[] = [];
      const allKeywords: string[] = [];

      for (const section of pitch.sections) {
        if (section.inferredSectors) {
          allSectors.push(...(section.inferredSectors as string[]));
        }
        if (section.inferredSkills) {
          allSkills.push(...(section.inferredSkills as string[]));
        }
        if (section.keywords) {
          allKeywords.push(...(section.keywords as string[]));
        }
      }

      return {
        sectors: [...new Set(allSectors)],
        skills: [...new Set(allSkills)],
        keywords: [...new Set(allKeywords)],
      };
    }

    case CollaborationSourceType.DEAL: {
      const deal = await prisma.dealRequest.findUnique({
        where: { id: sourceId },
      });
      if (!deal) return null;
      return {
        sectors: deal.domain ? [deal.domain] : [],
        keywords: deal.solutionType ? [deal.solutionType] : [],
      };
    }

    default:
      return null;
  }
}

/**
 * Process collaboration match job
 */
async function processCollaborationMatchJob(
  job: Job<CollaborationMatchingJobData>
): Promise<CollaborationMatchWorkerResult> {
  const { sessionId, collaboratorUserId, sourceType, sourceId } = job.data;

  logger.info('Processing collaboration match job', {
    jobId: job.id,
    sessionId,
    collaboratorUserId,
    sourceType,
    sourceId,
  });

  try {
    // 5% - Update session status to RUNNING
    await job.updateProgress(5);
    await sessionRepository.update(sessionId, {
      status: CollaborationSessionStatus.RUNNING,
      progress: 5,
      startedAt: new Date(),
    });

    // 10% - Fetch source feature criteria
    await job.updateProgress(10);
    const criteria = await getSourceFeatureCriteria(sourceType, sourceId);
    if (!criteria) {
      throw new Error(`Source feature not found: ${sourceType} ${sourceId}`);
    }

    await sessionRepository.update(sessionId, { progress: 10 });

    // 15% - Fetch collaborator's contacts
    await job.updateProgress(15);
    const contactsResult = await contactRepository.findByUserId(collaboratorUserId, {}, {
      page: 1,
      limit: 10000, // Get all contacts
    });

    // Get IDs of contacts that already have introduced match results (preserved from previous run)
    const existingIntroducedResults = await prisma.collaborationMatchResult.findMany({
      where: { sessionId, isIntroduced: true },
      select: { contactId: true },
    });
    const introducedContactIds = new Set(existingIntroducedResults.map((r) => r.contactId));

    // Filter out contacts that already have introduced results to avoid duplicate key errors
    const contacts = contactsResult.contacts.filter((c) => !introducedContactIds.has(c.id));
    const totalContacts = contacts.length + introducedContactIds.size;

    logger.info('Fetched contacts for matching', {
      sessionId,
      totalContacts,
      collaboratorUserId,
    });

    if (totalContacts === 0) {
      logger.warn('No contacts found for collaborator', {
        sessionId,
        collaboratorUserId,
      });

      await sessionRepository.update(sessionId, {
        status: CollaborationSessionStatus.DONE,
        totalContacts: 0,
        matchCount: 0,
        progress: 100,
        completedAt: new Date(),
      });

      return {
        sessionId,
        matchCount: 0,
        status: 'completed',
      };
    }

    // Log contact data summary for debugging
    const contactsWithSectors = contacts.filter((c: any) => c.sectors && c.sectors.length > 0).length;
    const contactsWithSkills = contacts.filter((c: any) => c.skills && c.skills.length > 0).length;
    const contactsWithLocation = contacts.filter((c: any) => c.location).length;
    const contactsWithBio = contacts.filter((c: any) => c.bio).length;

    logger.info('Contact data summary for matching', {
      sessionId,
      totalContacts,
      contactsWithSectors,
      contactsWithSkills,
      contactsWithLocation,
      contactsWithBio,
      criteria: {
        sectors: criteria.sectors || [],
        skills: criteria.skills || [],
        locations: criteria.locations || [],
        keywords: criteria.keywords || [],
      },
    });

    await sessionRepository.update(sessionId, {
      totalContacts,
      progress: 15,
    });

    // 15-85% - Score contacts in batches of 50
    const batchSize = 50;
    const allResults: Array<{
      contactId: string;
      score: number;
      reasons: any[];
    }> = [];

    let processedCount = 0;

    for (let i = 0; i < contacts.length; i += batchSize) {
      const batch = contacts.slice(i, Math.min(i + batchSize, contacts.length));

      // Transform contacts to CollaboratorContact format
      const collaboratorContacts: CollaboratorContact[] = batch.map((c) => ({
        id: c.id,
        fullName: c.name,
        company: c.company || null,
        jobTitle: c.jobTitle || null,
        location: c.location || null,
        sectors: c.sectors?.map((s: any) => s.sectorName || s.name || s) || [],
        skills: c.skills?.map((s: any) => s.skillName || s.name || s) || [],
        bio: c.bio || null,
      }));

      // Score batch
      const batchResults = await matchingService.matchContacts(
        criteria,
        collaboratorContacts
      );

      allResults.push(...batchResults);

      processedCount += batch.length;
      const progress = Math.min(15 + Math.floor((processedCount / totalContacts) * 70), 85);

      await job.updateProgress(progress);
      await sessionRepository.update(sessionId, {
        progress,
        lastScanAt: new Date(),
      });
    }

    // 85-95% - Save results to database
    await job.updateProgress(85);
    await sessionRepository.update(sessionId, { progress: 85 });

    // Delete old non-introduced results to prevent duplicates on re-run
    await prisma.collaborationMatchResult.deleteMany({
      where: { sessionId, isIntroduced: false },
    });

    // Deduplicate results by contactId (keep highest score)
    const deduped = new Map<string, typeof allResults[0]>();
    for (const result of allResults) {
      const existing = deduped.get(result.contactId);
      if (!existing || result.score > existing.score) {
        deduped.set(result.contactId, result);
      }
    }

    // Save all qualified results
    for (const result of deduped.values()) {
      // Skip contacts that already have introduced results
      if (introducedContactIds.has(result.contactId)) continue;
      await matchResultRepository.create({
        sessionId,
        contactId: result.contactId,
        score: result.score,
        reasonsJson: result.reasons,
      });
    }

    const matchCount = deduped.size + introducedContactIds.size;

    // 95% - Update session with final stats
    await job.updateProgress(95);
    await sessionRepository.update(sessionId, {
      matchCount,
      progress: 95,
    });

    // 100% - Mark session DONE
    await job.updateProgress(100);
    await sessionRepository.update(sessionId, {
      status: CollaborationSessionStatus.DONE,
      progress: 100,
      completedAt: new Date(),
    });

    logger.info('Collaboration match job completed', {
      jobId: job.id,
      sessionId,
      totalContacts,
      matchCount,
    });

    return {
      sessionId,
      matchCount,
      status: 'completed',
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    logger.error('Collaboration match job failed', {
      jobId: job.id,
      sessionId,
      error: errorMessage,
    });

    // Update session status to FAILED
    await sessionRepository.update(sessionId, {
      status: CollaborationSessionStatus.FAILED,
      error: errorMessage,
      completedAt: new Date(),
    });

    throw error;
  }
}

/**
 * Start collaboration match worker
 */
export function startCollaborationMatchWorker(): void {
  queueService.registerWorker<CollaborationMatchingJobData, CollaborationMatchWorkerResult>(
    QueueName.COLLABORATION_MATCHING,
    processCollaborationMatchJob,
    {
      concurrency: 3, // Process up to 3 sessions at a time
      limiter: {
        max: 10,
        duration: 60000, // 10 jobs per minute
      },
    }
  );

  logger.info('Collaboration match worker started');
}

/**
 * Get collaboration match job status
 */
export async function getCollaborationMatchJobStatus(jobId: string) {
  return queueService.getJobStatus(QueueName.COLLABORATION_MATCHING, jobId);
}

export default startCollaborationMatchWorker;
