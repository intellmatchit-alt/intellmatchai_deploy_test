/**
 * PNME Worker: Outreach Generation
 * Handles generating personalized outreach messages
 */

import { Job, Worker } from 'bullmq';
import { container } from 'tsyringe';
import { PitchJobStep, PitchJobStatus, PitchStatus, MatchReason } from '../../../domain/entities/Pitch';
import {
  IPitchRepository,
  IPitchJobRepository,
  IPitchMatchRepository,
} from '../../../domain/repositories/IPitchRepository';
import { IOutreachGeneratorService } from '../../../application/interfaces/IPitchAIService';
import { OutreachGenerateJobData } from '../../../application/interfaces/IPitchQueueService';
import { logger } from '../../../shared/logger';
import { redisConnection, getRedisClient } from '../../database/redis/client';

const QUEUE_NAME = 'pitch-outreach-generate';

const OUTREACH_TRACKER_PREFIX = 'pitch:outreach-batch:';
const OUTREACH_TRACKER_TTL = 3600; // 1 hour TTL

/**
 * Redis-based outreach batch tracker helper functions
 */
async function getOutreachTracker(pitchId: string): Promise<{ total: number; completed: number; pitchId: string } | null> {
  const redis = getRedisClient();
  if (!redis) return null;
  const key = `${OUTREACH_TRACKER_PREFIX}${pitchId}`;
  const data = await redis.get(key);
  return data ? JSON.parse(data) : null;
}

async function setOutreachTracker(pitchId: string, data: { total: number; completed: number; pitchId: string }): Promise<void> {
  const redis = getRedisClient();
  if (!redis) return;
  const key = `${OUTREACH_TRACKER_PREFIX}${pitchId}`;
  await redis.setex(key, OUTREACH_TRACKER_TTL, JSON.stringify(data));
}

async function deleteOutreachTracker(pitchId: string): Promise<void> {
  const redis = getRedisClient();
  if (!redis) return;
  const key = `${OUTREACH_TRACKER_PREFIX}${pitchId}`;
  await redis.del(key);
}

/**
 * Atomically increment outreach completed count using Lua script
 */
async function incrementOutreachCompleted(pitchId: string): Promise<{ total: number; completed: number; pitchId: string } | null> {
  const redis = getRedisClient();
  if (!redis) return null;

  const key = `${OUTREACH_TRACKER_PREFIX}${pitchId}`;

  // Lua script for atomic increment
  const luaScript = `
    local data = redis.call('GET', KEYS[1])
    if not data then return nil end
    local tracker = cjson.decode(data)
    tracker.completed = tracker.completed + 1
    local newData = cjson.encode(tracker)
    redis.call('SETEX', KEYS[1], ARGV[1], newData)
    return newData
  `;

  try {
    const result = await redis.eval(luaScript, 1, key, OUTREACH_TRACKER_TTL.toString());
    return result ? JSON.parse(result as string) : null;
  } catch (error) {
    logger.error('Failed to increment outreach tracker', { pitchId, error });
    return null;
  }
}

/**
 * Create the outreach generation worker
 */
export function createOutreachGenerateWorker(): Worker {
  const worker = new Worker<OutreachGenerateJobData>(
    QUEUE_NAME,
    async (job: Job<OutreachGenerateJobData>) => {
      const { matchId, sectionContent, contactProfile, reasons, tone } = job.data;

      logger.debug('Generating outreach', { matchId, tone });

      try {
        await generateOutreachMessage(matchId, sectionContent, contactProfile, reasons, tone, job);
      } catch (error) {
        logger.error('Outreach generation failed', { matchId, error });
        throw error;
      }
    },
    {
      connection: redisConnection,
      concurrency: 3, // Limited for rate limiting
      limiter: {
        max: 3,
        duration: 1000,
      },
    },
  );

  return worker;
}

/**
 * Generate outreach message for a match
 */
async function generateOutreachMessage(
  matchId: string,
  sectionContent: string,
  contactProfile: OutreachGenerateJobData['contactProfile'],
  reasons: MatchReason[],
  tone: 'professional' | 'casual' | 'warm',
  job: Job,
): Promise<void> {
  const matchRepo = container.resolve<IPitchMatchRepository>('PitchMatchRepository');
  const outreachGenerator = container.resolve<IOutreachGeneratorService>('OutreachGeneratorService');

  // Get match to verify it exists and get pitchId
  const match = await matchRepo.findById(matchId);
  if (!match) {
    logger.warn('Match not found, skipping outreach', { matchId });
    return;
  }

  // Resolve pitch language from the match's section → pitch chain
  let pitchLanguage = 'en';
  try {
    const pitchRepo = container.resolve<IPitchRepository>('PitchRepository');
    // match.pitchSectionId links to a section which has a pitchId
    const { prisma } = await import('../../database/prisma/client.js');
    const section = await prisma.pitchSection.findUnique({
      where: { id: match.pitchSectionId },
      select: { pitchId: true },
    });
    if (section) {
      const pitch = await pitchRepo.findById(section.pitchId);
      if (pitch?.language) {
        pitchLanguage = pitch.language;
      }
    }
  } catch (langError) {
    logger.warn('Failed to resolve pitch language, defaulting to en', { matchId, error: langError });
  }

  await job.updateProgress(20);

  let outreachDraft: string;

  try {
    // Generate personalized message using LLM
    outreachDraft = await outreachGenerator.generateOutreachMessage(
      sectionContent,
      contactProfile,
      reasons,
      tone,
      pitchLanguage,
    );
  } catch (error) {
    logger.warn('LLM outreach generation failed, using template', { matchId, error });

    // Fallback to template-based message
    outreachDraft = outreachGenerator.generateOutreachMessageTemplate(
      contactProfile,
      reasons,
      tone,
    );
  }

  await job.updateProgress(80);

  // Update match with outreach draft
  await matchRepo.update(matchId, { outreachDraft });

  await job.updateProgress(100);
  logger.debug('Outreach generated', { matchId });

  // Check if all outreach for the pitch is complete
  await checkOutreachCompletion(matchId);
}

/**
 * Check if all outreach messages for a pitch are complete
 */
async function checkOutreachCompletion(matchId: string): Promise<void> {
  // Find the pitch this match belongs to
  const matchRepo = container.resolve<IPitchMatchRepository>('PitchMatchRepository');
  const match = await matchRepo.findById(matchId);
  if (!match) return;

  // Get section to find pitch
  const sectionRepo = container.resolve('PitchSectionRepository') as any;
  const section = await sectionRepo.findById(match.pitchSectionId);
  if (!section) return;

  const pitchId = section.pitchId;
  const tracker = await incrementOutreachCompleted(pitchId);

  if (!tracker) return;

  if (tracker.completed >= tracker.total) {
    // All outreach complete, mark pitch as done
    const jobRepo = container.resolve<IPitchJobRepository>('PitchJobRepository');
    const pitchRepo = container.resolve<IPitchRepository>('PitchRepository');

    // Mark outreach generation complete
    await jobRepo.updateByPitchIdAndStep(pitchId, PitchJobStep.GENERATE_OUTREACH, {
      status: PitchJobStatus.COMPLETED,
      progress: 100,
      completedAt: new Date(),
    });

    // Mark pitch as complete
    await pitchRepo.update(pitchId, {
      status: PitchStatus.COMPLETED,
      processedAt: new Date(),
    });

    // Cleanup tracker
    await deleteOutreachTracker(pitchId);

    logger.info('Pitch processing complete', { pitchId });
  }
}

/**
 * Register outreach batch for tracking (uses Redis for persistence)
 */
export async function registerOutreachBatch(pitchId: string, total: number): Promise<void> {
  await setOutreachTracker(pitchId, { total, completed: 0, pitchId });
  logger.debug('Registered outreach batch tracker', { pitchId, total });
}
