/**
 * PNME Worker: Profile Build
 * Handles building contact profiles for matching
 */

import { Job, Worker } from 'bullmq';
import { container } from 'tsyringe';
import { PitchJobStep, PitchJobStatus, PitchStatus, DEFAULT_MATCH_WEIGHTS } from '../../../domain/entities/Pitch';
import {
  IPitchRepository,
  IPitchJobRepository,
  IPitchSectionRepository,
  IContactProfileCacheRepository,
  IUserPNMEPreferencesRepository,
} from '../../../domain/repositories/IPitchRepository';
import { IContactRepository } from '../../../domain/repositories/IContactRepository';
import {
  IProfileBuilderService,
  IEmbeddingService,
} from '../../../application/interfaces/IPitchAIService';
import { IPitchQueueService, ProfileBuildJobData } from '../../../application/interfaces/IPitchQueueService';
import { logger } from '../../../shared/logger';
import { redisConnection, getRedisClient } from '../../database/redis/client.js';
import { registerMatchBatch } from './pitchMatch.worker.js';

const QUEUE_NAME = 'pitch-profile-build';
const BATCH_TRACKER_PREFIX = 'pitch:profile-batch:';
const BATCH_TRACKER_TTL = 3600; // 1 hour TTL

/**
 * Redis-based batch tracker helper functions
 */
async function getBatchTracker(pitchId: string): Promise<{ total: number; completed: number; pitchId: string; userId: string } | null> {
  const redis = getRedisClient();
  if (!redis) return null;
  const key = `${BATCH_TRACKER_PREFIX}${pitchId}`;
  const data = await redis.get(key);
  return data ? JSON.parse(data) : null;
}

async function setBatchTracker(pitchId: string, data: { total: number; completed: number; pitchId: string; userId: string }): Promise<void> {
  const redis = getRedisClient();
  if (!redis) return;
  const key = `${BATCH_TRACKER_PREFIX}${pitchId}`;
  await redis.setex(key, BATCH_TRACKER_TTL, JSON.stringify(data));
}

async function deleteBatchTracker(pitchId: string): Promise<void> {
  const redis = getRedisClient();
  if (!redis) return;
  const key = `${BATCH_TRACKER_PREFIX}${pitchId}`;
  await redis.del(key);
}

/**
 * Atomically increment batch completed count using Lua script
 */
async function incrementBatchCompleted(pitchId: string): Promise<{ total: number; completed: number; pitchId: string; userId: string } | null> {
  const redis = getRedisClient();
  if (!redis) return null;

  const key = `${BATCH_TRACKER_PREFIX}${pitchId}`;

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
    const result = await redis.eval(luaScript, 1, key, BATCH_TRACKER_TTL.toString());
    return result ? JSON.parse(result as string) : null;
  } catch (error) {
    logger.error('Failed to increment batch tracker', { pitchId, error });
    return null;
  }
}

/**
 * Create the profile build worker
 */
export function createProfileBuildWorker(): Worker {
  const worker = new Worker<ProfileBuildJobData>(
    QUEUE_NAME,
    async (job: Job<ProfileBuildJobData>) => {
      const { contactId, userId, pitchId } = job.data;

      logger.debug('Building profile', { contactId, pitchId, jobId: job.id });

      try {
        await buildContactProfile(contactId, userId, pitchId, job);

        // Check if batch is complete
        await checkBatchCompletion(pitchId, userId);
      } catch (error) {
        logger.error('Profile build failed', { contactId, pitchId, error });
        throw error;
      }
    },
    {
      connection: redisConnection,
      concurrency: 10,
      limiter: {
        max: 20,
        duration: 1000,
      },
    },
  );

  return worker;
}

/**
 * Build or update a contact's profile cache
 */
async function buildContactProfile(
  contactId: string,
  userId: string,
  pitchId: string,
  job: Job,
): Promise<void> {
  const contactRepo = container.resolve<IContactRepository>('ContactRepository');
  const profileCacheRepo = container.resolve<IContactProfileCacheRepository>('ContactProfileCacheRepository');
  const profileBuilder = container.resolve<IProfileBuilderService>('ProfileBuilderService');
  const embeddingService = container.resolve<IEmbeddingService>('EmbeddingService');

  // Get contact with related data
  const contact = await contactRepo.findById(contactId);
  if (!contact) {
    logger.warn('Contact not found, skipping', { contactId });
    return;
  }

  await job.updateProgress(10);

  // Check if we have a valid cache
  const existingCache = await profileCacheRepo.findByContactId(contactId);
  if (existingCache && !existingCache.isStale) {
    logger.debug('Using cached profile', { contactId });
    await job.updateProgress(100);
    return;
  }

  await job.updateProgress(30);

  // Build profile summary
  // Extract sector/skill/interest names from the contact
  const sectorNames = contact.sectors.map((s) => s.sectorName || s.sectorId);
  const skillNames = contact.skills.map((s) => s.skillName || s.skillId);
  const interestNames = contact.interests.map((i) => i.interestName || i.interestId);

  let profileSummary: string;
  try {
    profileSummary = await profileBuilder.buildProfileSummary({
      fullName: contact.name,
      company: contact.company,
      jobTitle: contact.jobTitle,
      bio: contact.bio,
      sectors: sectorNames,
      skills: skillNames,
      interests: interestNames,
      notes: contact.notes,
      enrichmentData: null,
    });
  } catch (error) {
    // Fallback to rule-based
    profileSummary = profileBuilder.buildProfileSummaryRuleBased({
      fullName: contact.name,
      company: contact.company,
      jobTitle: contact.jobTitle,
      sectors: sectorNames,
      skills: skillNames,
    });
  }

  await job.updateProgress(50);

  // Generate embedding
  let embedding: number[] | undefined;
  let embeddingModel: string | undefined;
  try {
    const embeddingResult = await embeddingService.generateEmbedding(profileSummary);
    embedding = embeddingResult.embedding;
    embeddingModel = embeddingResult.model;
  } catch (error) {
    logger.warn('Embedding generation failed, continuing without', { contactId, error });
  }

  await job.updateProgress(70);

  // Extract investor fields if available (would come from enrichment data)
  const investorFields = profileBuilder.extractInvestorFields(null);

  // Calculate relationship strength based on interactions
  const interactionCount = contact.interactions.length;
  const lastInteraction = contact.interactions.length > 0
    ? contact.interactions.reduce((latest, i) => i.date > latest.date ? i : latest)
    : null;
  const lastInteractionDays = lastInteraction
    ? Math.floor((Date.now() - new Date(lastInteraction.date).getTime()) / (1000 * 60 * 60 * 24))
    : null;

  // Calculate relationship strength (0-100)
  let relationshipStrength = 0;
  if (lastInteractionDays !== null) {
    // Recency component (max 50 points, decays over 60 days)
    relationshipStrength += Math.max(0, 50 - (lastInteractionDays * 50 / 60));
  }
  // Frequency component (max 50 points, caps at 20 interactions)
  relationshipStrength += Math.min(50, interactionCount * 2.5);

  await job.updateProgress(90);

  // Upsert profile cache
  await profileCacheRepo.upsert({
    contactId,
    userId,
    profileSummary,
    sectors: sectorNames,
    skills: skillNames,
    interests: interestNames,
    keywords: extractKeywords(profileSummary),
    ...investorFields,
    embedding,
    embeddingModel,
    relationshipStrength,
    lastInteractionDays,
    interactionCount,
  });

  await job.updateProgress(100);
  logger.debug('Profile built successfully', { contactId });
}

/**
 * Check if all profiles in the batch are complete
 */
async function checkBatchCompletion(pitchId: string, userId: string): Promise<void> {
  const tracker = await incrementBatchCompleted(pitchId);

  if (!tracker) return;

  if (tracker.completed >= tracker.total) {
    // All profiles complete, trigger matching
    const jobRepo = container.resolve<IPitchJobRepository>('PitchJobRepository');
    const pitchRepo = container.resolve<IPitchRepository>('PitchRepository');
    const sectionRepo = container.resolve<IPitchSectionRepository>('PitchSectionRepository');
    const profileCacheRepo = container.resolve<IContactProfileCacheRepository>('ContactProfileCacheRepository');
    const preferencesRepo = container.resolve<IUserPNMEPreferencesRepository>('UserPNMEPreferencesRepository');
    const pitchQueue = container.resolve<IPitchQueueService>('PitchQueueService');

    // Mark profile build complete
    await jobRepo.updateByPitchIdAndStep(pitchId, PitchJobStep.BUILD_PROFILES, {
      status: PitchJobStatus.COMPLETED,
      progress: 100,
      completedAt: new Date(),
    });

    // Get sections and contacts for matching
    const sections = await sectionRepo.findByPitchId(pitchId);
    const profiles = await profileCacheRepo.findByUserId(userId);
    const contactIds = profiles.map((p) => p.contactId);

    // Get user preferences for weights
    const preferences = await preferencesRepo.findByUserId(userId);
    const weights = preferences
      ? {
          relevance: preferences.relevanceWeight,
          expertise: preferences.expertiseWeight,
          strategic: preferences.strategicWeight,
          relationship: preferences.relationshipWeight,
        }
      : DEFAULT_MATCH_WEIGHTS;

    // Update pitch status
    await pitchRepo.update(pitchId, { status: PitchStatus.MATCHING });

    // Update COMPUTE_MATCHES job status to PROCESSING
    await jobRepo.updateByPitchIdAndStep(pitchId, PitchJobStep.COMPUTE_MATCHES, {
      status: PitchJobStatus.PROCESSING,
      startedAt: new Date(),
    });

    // Register match batch tracker before enqueuing jobs
    await registerMatchBatch(pitchId, sections.length);

    // Enqueue matching for each section
    for (const section of sections) {
      await pitchQueue.enqueueComputeMatches(pitchId, section.id, contactIds, weights);
    }

    // Cleanup tracker
    await deleteBatchTracker(pitchId);

    logger.info('All profiles built, matching started', {
      pitchId,
      sectionsCount: sections.length,
      contactsCount: contactIds.length,
    });
  }
}

/**
 * Register batch for tracking (uses Redis for persistence)
 */
export async function registerProfileBatch(pitchId: string, userId: string, total: number): Promise<void> {
  await setBatchTracker(pitchId, { total, completed: 0, pitchId, userId });
  logger.debug('Registered profile batch tracker', { pitchId, total });
}

/**
 * Extract keywords from text (simple tokenization)
 */
function extractKeywords(text: string): string[] {
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 3);

  // Remove common words
  const stopWords = new Set([
    'that', 'this', 'with', 'from', 'they', 'have', 'been', 'were', 'will',
    'would', 'could', 'should', 'their', 'there', 'about', 'which', 'when',
  ]);

  return [...new Set(words.filter((w) => !stopWords.has(w)))].slice(0, 50);
}
