/**
 * Matching Worker
 *
 * Background worker for match calculation jobs.
 *
 * @module infrastructure/queue/workers/matchingWorker
 */

import { Job } from 'bullmq';
import { prisma } from '../../database/prisma/client.js';
import { logger } from '../../../shared/logger/index.js';
import { emitMatchUpdate } from '../../websocket/index.js';
import { queueService, QueueName, MatchingJobData } from '../QueueService.js';

/**
 * Match result
 */
interface MatchResult {
  contactId: string;
  score: number;
  reasons: string[];
  intersectionTags: Array<{ type: string; label: string }>;
}

/**
 * Calculate match score between user and contact
 */
async function calculateMatchScore(userId: string, contactId: string): Promise<MatchResult> {
  // Get user data
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      userSectors: { include: { sector: true } },
      userSkills: { include: { skill: true } },
      userInterests: { include: { interest: true } },
      userGoals: { where: { isActive: true } },
    },
  });

  if (!user) {
    throw new Error(`User not found: ${userId}`);
  }

  // Get contact data
  const contact = await prisma.contact.findUnique({
    where: { id: contactId },
    include: {
      contactSectors: { include: { sector: true } },
      contactSkills: { include: { skill: true } },
      interactions: {
        where: { userId },
        orderBy: { occurredAt: 'desc' },
        take: 10,
      },
    },
  });

  if (!contact) {
    throw new Error(`Contact not found: ${contactId}`);
  }

  const reasons: string[] = [];
  const intersectionTags: Array<{ type: string; label: string }> = [];
  let score = 0;

  // Weight configuration
  const weights = {
    goalAlignment: 30,
    sectorOverlap: 20,
    skillMatch: 15,
    complementarySkills: 10,
    interestOverlap: 10,
    recency: 8,
    interaction: 7,
  };

  // 1. Goal Alignment (30%)
  const userGoalTypes = user.userGoals.map((g) => g.goalType);
  const contactJobTitle = contact.jobTitle?.toLowerCase() || '';
  const contactCompany = contact.company?.toLowerCase() || '';

  let goalScore = 0;
  if (userGoalTypes.includes('INVESTMENT') && (contactJobTitle.includes('investor') || contactJobTitle.includes('vc') || contactJobTitle.includes('partner'))) {
    goalScore = 100;
    reasons.push('Potential investor connection');
  } else if (userGoalTypes.includes('HIRING') && contactJobTitle.includes('engineer') || contactJobTitle.includes('developer')) {
    goalScore = 80;
    reasons.push('Potential hire candidate');
  } else if (userGoalTypes.includes('MENTORSHIP') && (contactJobTitle.includes('senior') || contactJobTitle.includes('director') || contactJobTitle.includes('vp'))) {
    goalScore = 90;
    reasons.push('Potential mentor');
  } else if (userGoalTypes.includes('PARTNERSHIP')) {
    goalScore = 60;
    reasons.push('Potential partnership opportunity');
  }
  score += (goalScore / 100) * weights.goalAlignment;

  // 2. Sector Overlap (20%)
  const userSectorIds = new Set(user.userSectors.map((s) => s.sectorId));
  const contactSectorIds = contact.contactSectors.map((s) => s.sectorId);
  const sectorOverlap = contactSectorIds.filter((id) => userSectorIds.has(id));

  if (sectorOverlap.length > 0) {
    const sectorScore = Math.min((sectorOverlap.length / userSectorIds.size) * 100, 100);
    score += (sectorScore / 100) * weights.sectorOverlap;

    const overlappingSectors = contact.contactSectors
      .filter((cs) => userSectorIds.has(cs.sectorId))
      .map((cs) => cs.sector.name);

    if (overlappingSectors.length > 0) {
      reasons.push(`Shared sectors: ${overlappingSectors.join(', ')}`);
      overlappingSectors.forEach((s) => intersectionTags.push({ type: 'sector', label: s }));
    }
  }

  // 3. Skill Match (15%)
  const userSkillIds = new Set(user.userSkills.map((s) => s.skillId));
  const contactSkillIds = contact.contactSkills.map((s) => s.skillId);
  const skillOverlap = contactSkillIds.filter((id) => userSkillIds.has(id));

  if (skillOverlap.length > 0) {
    const skillScore = Math.min((skillOverlap.length / Math.max(userSkillIds.size, 1)) * 100, 100);
    score += (skillScore / 100) * weights.skillMatch;

    const overlappingSkills = contact.contactSkills
      .filter((cs) => userSkillIds.has(cs.skillId))
      .map((cs) => cs.skill.name);

    if (overlappingSkills.length > 0) {
      reasons.push(`Shared skills: ${overlappingSkills.join(', ')}`);
      overlappingSkills.forEach((s) => intersectionTags.push({ type: 'skill', label: s }));
    }
  }

  // 4. Complementary Skills (10%)
  const complementaryPairs: Record<string, string[]> = {
    frontend: ['backend', 'design', 'ux'],
    backend: ['frontend', 'devops', 'database'],
    design: ['frontend', 'product', 'marketing'],
    marketing: ['sales', 'design', 'product'],
    sales: ['marketing', 'product', 'business'],
    product: ['engineering', 'design', 'marketing'],
  };

  const userSkillNames = user.userSkills.map((s) => s.skill.name.toLowerCase());
  const contactSkillNames = contact.contactSkills.map((s) => s.skill.name.toLowerCase());

  let complementaryCount = 0;
  for (const userSkill of userSkillNames) {
    const complements = complementaryPairs[userSkill] || [];
    for (const contactSkill of contactSkillNames) {
      if (complements.some((c) => contactSkill.includes(c))) {
        complementaryCount++;
      }
    }
  }

  if (complementaryCount > 0) {
    const complementaryScore = Math.min(complementaryCount * 25, 100);
    score += (complementaryScore / 100) * weights.complementarySkills;
    reasons.push('Has complementary skills');
  }

  // 5. Interest Overlap (10%)
  // Would need contact interests in schema - skip for now
  score += 5; // Base interest score

  // 6. Recency (8%)
  const daysSinceCreated = Math.floor((Date.now() - contact.createdAt.getTime()) / (1000 * 60 * 60 * 24));
  const recencyScore = Math.max(100 - daysSinceCreated * 2, 20);
  score += (recencyScore / 100) * weights.recency;

  // 7. Interaction History (7%)
  if (contact.interactions.length > 0) {
    const interactionScore = Math.min(contact.interactions.length * 15, 100);
    score += (interactionScore / 100) * weights.interaction;
    reasons.push(`${contact.interactions.length} past interactions`);
  }

  // Ensure score is within bounds
  score = Math.min(Math.max(Math.round(score), 0), 100);

  return {
    contactId,
    score,
    reasons,
    intersectionTags,
  };
}

/**
 * Process matching job
 */
async function processMatchingJob(job: Job<MatchingJobData>): Promise<MatchResult> {
  const { contactId, userId, recalculate } = job.data;

  logger.info(`Processing matching job: ${contactId}`, { jobId: job.id });

  try {
    await job.updateProgress(10);

    // Check for existing match result
    if (!recalculate) {
      const existing = await prisma.matchResult.findUnique({
        where: {
          userId_contactId: { userId, contactId },
        },
      });

      if (existing && existing.expiresAt && existing.expiresAt > new Date()) {
        logger.debug(`Using cached match result: ${contactId}`);
        return {
          contactId,
          score: Number(existing.finalScore),
          reasons: (existing.aiReasons as string[]) || [],
          intersectionTags: (existing.intersectionTags as Array<{ type: string; label: string }>) || [],
        };
      }
    }

    await job.updateProgress(30);

    // Calculate match score
    const result = await calculateMatchScore(userId, contactId);

    await job.updateProgress(70);

    // Save match result
    await prisma.matchResult.upsert({
      where: {
        userId_contactId: { userId, contactId },
      },
      create: {
        userId,
        contactId,
        finalScore: result.score,
        aiReasons: result.reasons,
        intersectionTags: result.intersectionTags,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      },
      update: {
        finalScore: result.score,
        aiReasons: result.reasons,
        intersectionTags: result.intersectionTags,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });

    // Update contact's match score
    await prisma.contact.update({
      where: { id: contactId },
      data: { matchScore: result.score },
    });

    await job.updateProgress(100);

    // Emit update via WebSocket
    emitMatchUpdate(userId, contactId, result.score, result.reasons);

    logger.info(`Matching completed: ${contactId}`, {
      jobId: job.id,
      score: result.score,
    });

    return result;
  } catch (error) {
    logger.error(`Matching failed: ${contactId}`, error);
    throw error;
  }
}

/**
 * Start matching worker
 */
export function startMatchingWorker(): void {
  queueService.registerWorker<MatchingJobData, MatchResult>(
    QueueName.MATCHING,
    processMatchingJob,
    {
      concurrency: 5,
      limiter: {
        max: 20,
        duration: 60000, // 20 jobs per minute
      },
    }
  );

  logger.info('Matching worker started');
}

export default startMatchingWorker;
