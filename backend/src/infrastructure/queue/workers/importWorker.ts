/**
 * Import Worker
 *
 * Background worker for contact import pipeline.
 * Processes imports through stages: normalize → dedupe → enrich → tag → summary → match
 *
 * @module infrastructure/queue/workers/importWorker
 */

import { Job } from 'bullmq';
import Redis from 'ioredis';
import { logger } from '../../../shared/logger/index.js';
import { queueService, QueueName, ImportJobData, ImportStage } from '../QueueService.js';
import { prisma } from '../../database/prisma/client.js';
import { config } from '../../../config/index.js';
import {
  normalizationService,
  deduplicationService,
  tagExtractionService,
  profileSummaryService,
  NormalizedContact,
} from '../../services/import/index.js';
import { DeterministicMatchingService } from '../../external/matching/DeterministicMatchingService.js';
import { getEnrichmentOrchestrator } from '../../external/enrichment/EnrichmentOrchestrator.js';
import { getPhoneEnrichmentPipeline } from '../../services/import/PhoneEnrichmentPipeline.js';

/**
 * Import worker result
 */
interface ImportWorkerResult {
  batchId: string;
  stage: ImportStage;
  processed: number;
  status: 'completed' | 'failed';
  error?: string;
}

/**
 * Progress ranges for each stage (out of 100%)
 */
const STAGE_PROGRESS: Record<ImportStage, { start: number; end: number }> = {
  normalize: { start: 0, end: 20 },
  dedupe: { start: 20, end: 35 },
  enrich: { start: 35, end: 55 },
  tag: { start: 55, end: 70 },
  summary: { start: 70, end: 85 },
  match: { start: 85, end: 100 },
};

/**
 * Next stage mapping
 */
const NEXT_STAGE: Record<ImportStage, ImportStage | null> = {
  normalize: 'dedupe',
  dedupe: 'enrich',
  enrich: 'tag',
  tag: 'summary',
  summary: 'match',
  match: null,
};

// Redis client for chunk storage
let redis: Redis | null = null;

function getRedis(): Redis {
  if (!redis) {
    const redisUrl = config.redis?.url || process.env.REDIS_URL || 'redis://localhost:6379';
    redis = new Redis(redisUrl);
  }
  return redis;
}

// Matching service instance
const matchingService = new DeterministicMatchingService();

/**
 * Process import job based on stage
 */
async function processImportJob(job: Job<ImportJobData>): Promise<ImportWorkerResult> {
  const { batchId, userId, stage } = job.data;

  logger.info('Processing import job', {
    jobId: job.id,
    batchId,
    userId,
    stage,
  });

  try {
    // Update batch status
    await prisma.contactImportBatch.update({
      where: { id: batchId },
      data: {
        status: 'PROCESSING',
        currentStage: stage,
        stageProgress: 0,
        currentJobId: job.id?.toString(),
      },
    });

    let processed = 0;

    // Process based on stage
    switch (stage) {
      case 'normalize':
        processed = await processNormalization(job, batchId, userId);
        break;
      case 'dedupe':
        processed = await processDeduplication(job, batchId, userId);
        break;
      case 'enrich':
        processed = await processEnrichment(job, batchId, userId);
        break;
      case 'tag':
        processed = await processTagging(job, batchId, userId);
        break;
      case 'summary':
        processed = await processSummary(job, batchId, userId);
        break;
      case 'match':
        processed = await processMatching(job, batchId, userId);
        break;
    }

    // Queue next stage or complete
    const nextStage = NEXT_STAGE[stage];
    if (nextStage) {
      await queueService.addImportJob({ batchId, userId, stage: nextStage });
    } else {
      // All stages complete
      await prisma.contactImportBatch.update({
        where: { id: batchId },
        data: {
          status: 'COMPLETED',
          overallProgress: 100,
          completedAt: new Date(),
        },
      });

      // Clean up Redis data
      await cleanupRedisData(batchId);
    }

    return {
      batchId,
      stage,
      processed,
      status: 'completed',
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    logger.error('Import job failed', {
      jobId: job.id,
      batchId,
      stage,
      error: errorMessage,
    });

    // Update batch with error
    await prisma.contactImportBatch.update({
      where: { id: batchId },
      data: {
        status: 'FAILED',
        errorMessage,
        errorDetails: { stage, jobId: job.id },
        completedAt: new Date(),
      },
    });

    throw error;
  }
}

/**
 * Stage 1: Normalize contacts
 */
async function processNormalization(
  job: Job<ImportJobData>,
  batchId: string,
  userId: string
): Promise<number> {
  const redisClient = getRedis();
  const progressRange = STAGE_PROGRESS.normalize;

  // Get all chunk keys
  const chunkKeys = await redisClient.keys(`import:chunk:${batchId}:*`);
  let totalContacts = 0;
  let processedContacts = 0;

  // Count total contacts
  for (const key of chunkKeys) {
    const chunk = await redisClient.get(key);
    if (chunk) {
      const contacts = JSON.parse(chunk);
      totalContacts += contacts.length;
    }
  }

  logger.info('Normalizing contacts', { batchId, chunkCount: chunkKeys.length, totalContacts });

  // Process each chunk
  for (const chunkKey of chunkKeys) {
    const chunk = await redisClient.get(chunkKey);
    if (!chunk) continue;

    const contacts = JSON.parse(chunk);
    const normalizedContacts = normalizationService.normalizeBatch(contacts);

    // Store normalized contacts
    for (const contact of normalizedContacts) {
      const contactKey = `import:normalized:${batchId}:${contact.identityKey}`;
      await redisClient.set(contactKey, JSON.stringify(contact), 'EX', 3600); // 1 hour TTL
      processedContacts++;

      // Update progress
      const progress = progressRange.start + Math.floor(
        (processedContacts / totalContacts) * (progressRange.end - progressRange.start)
      );
      await updateProgress(job, batchId, progress);
    }

    // Delete processed chunk
    await redisClient.del(chunkKey);
  }

  // Update batch stats
  await prisma.contactImportBatch.update({
    where: { id: batchId },
    data: {
      totalReceived: totalContacts,
      stageProgress: 100,
      overallProgress: progressRange.end,
    },
  });

  return processedContacts;
}

/**
 * Stage 2: Deduplicate contacts
 */
async function processDeduplication(
  job: Job<ImportJobData>,
  batchId: string,
  userId: string
): Promise<number> {
  const redisClient = getRedis();
  const progressRange = STAGE_PROGRESS.dedupe;

  // Get all normalized contact keys
  const normalizedKeys = await redisClient.keys(`import:normalized:${batchId}:*`);
  const totalContacts = normalizedKeys.length;
  let processedContacts = 0;

  // Get batch info for source
  const batch = await prisma.contactImportBatch.findUnique({
    where: { id: batchId },
    select: { source: true },
  });
  const source = batch?.source || 'IMPORT';

  logger.info('Deduplicating contacts', { batchId, totalContacts });

  // Process in batches of 200
  const batchSize = 200;
  let totalImported = 0;
  let duplicatesMerged = 0;

  for (let i = 0; i < normalizedKeys.length; i += batchSize) {
    const batchKeys = normalizedKeys.slice(i, i + batchSize);
    const contacts: NormalizedContact[] = [];

    for (const key of batchKeys) {
      const data = await redisClient.get(key);
      if (data) {
        contacts.push(JSON.parse(data));
      }
    }

    // Process batch
    const { results, stats } = await deduplicationService.processBatch(
      userId,
      contacts,
      batchId,
      source
    );

    totalImported += stats.newContacts + stats.updatedContacts;
    duplicatesMerged += stats.mergedContacts;

    // Store contact IDs for subsequent stages
    for (const result of results) {
      await redisClient.sadd(`import:contacts:${batchId}`, result.contactId);
    }

    processedContacts += contacts.length;

    // Update progress
    const progress = progressRange.start + Math.floor(
      (processedContacts / totalContacts) * (progressRange.end - progressRange.start)
    );
    await updateProgress(job, batchId, progress);

    // Clean up processed keys
    for (const key of batchKeys) {
      await redisClient.del(key);
    }
  }

  // Update batch stats
  await prisma.contactImportBatch.update({
    where: { id: batchId },
    data: {
      totalImported,
      duplicatesMerged,
      stageProgress: 100,
      overallProgress: progressRange.end,
    },
  });

  return processedContacts;
}

/**
 * Stage 3: Enrich contacts (optional - rate limited)
 */
async function processEnrichment(
  job: Job<ImportJobData>,
  batchId: string,
  userId: string
): Promise<number> {
  const redisClient = getRedis();
  const progressRange = STAGE_PROGRESS.enrich;

  // Get batch settings
  const batch = await prisma.contactImportBatch.findUnique({
    where: { id: batchId },
    select: { enrichmentEnabled: true, phoneEnrichmentEnabled: true },
  });

  // Get contact IDs
  const contactIds = await redisClient.smembers(`import:contacts:${batchId}`);
  let processedContacts = 0;
  let enrichedCount = 0;

  logger.info('Enrichment stage', {
    batchId,
    totalContacts: contactIds.length,
    enrichmentEnabled: batch?.enrichmentEnabled,
    phoneEnrichmentEnabled: batch?.phoneEnrichmentEnabled,
  });

  // Enrichment is mandatory - always run for all imported contacts

  // Use PhoneEnrichmentPipeline if phone enrichment is enabled and CallerKit feature is on
  if (batch?.phoneEnrichmentEnabled && config.features.callerKit) {
    const pipeline = getPhoneEnrichmentPipeline();
    const consentId = `batch-${batchId}`;

    const batchResult = await pipeline.enrichBatch(contactIds, {
      userId,
      batchId,
      consentId,
      delayMs: 1000,
      onProgress: async (processed, total) => {
        const progress = progressRange.start + Math.floor(
          (processed / total) * (progressRange.end - progressRange.start)
        );
        await updateProgress(job, batchId, progress);
      },
    });

    enrichedCount = batchResult.enrichedCount;
    processedContacts = batchResult.totalProcessed;

    logger.info('Phone enrichment pipeline completed', {
      batchId,
      enrichedCount: batchResult.enrichedCount,
      failedCount: batchResult.failedCount,
      totalTimeMs: batchResult.totalTimeMs,
    });
  } else {
    // Fallback to existing EnrichmentOrchestrator
    const orchestrator = getEnrichmentOrchestrator();
    const ENRICHMENT_DELAY_MS = 1000;

    for (const contactId of contactIds) {
      try {
        const result = await orchestrator.enrichContact(contactId, userId);
        if (result.success && result.fieldsUpdated.length > 0) {
          enrichedCount++;
          logger.debug('Contact enriched during import', {
            batchId,
            contactId,
            fieldsUpdated: result.fieldsUpdated,
          });
        }
      } catch (error) {
        logger.warn('Failed to enrich contact during import', {
          batchId,
          contactId,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }

      processedContacts++;

      const progress = progressRange.start + Math.floor(
        (processedContacts / contactIds.length) * (progressRange.end - progressRange.start)
      );
      await updateProgress(job, batchId, progress);

      if (processedContacts < contactIds.length) {
        await new Promise(resolve => setTimeout(resolve, ENRICHMENT_DELAY_MS));
      }
    }
  }

  // Update batch stats
  await prisma.contactImportBatch.update({
    where: { id: batchId },
    data: {
      enrichedCount,
      stageProgress: 100,
      overallProgress: progressRange.end,
    },
  });

  return processedContacts;
}

/**
 * Stage 4: Extract tags (sectors, skills, interests)
 */
async function processTagging(
  job: Job<ImportJobData>,
  batchId: string,
  userId: string
): Promise<number> {
  const redisClient = getRedis();
  const progressRange = STAGE_PROGRESS.tag;

  // Get contact IDs
  const contactIds = await redisClient.smembers(`import:contacts:${batchId}`);
  let processedContacts = 0;
  let taggedCount = 0;

  logger.info('Tagging contacts', { batchId, totalContacts: contactIds.length });

  // Process in batches of 100
  const batchSize = 100;

  for (let i = 0; i < contactIds.length; i += batchSize) {
    const batchIds = contactIds.slice(i, i + batchSize);

    // Get contacts
    const contacts = await prisma.contact.findMany({
      where: { id: { in: batchIds } },
      select: {
        id: true,
        fullName: true,
        jobTitle: true,
        company: true,
        bio: true,
        location: true,
        email: true,
      },
    });

    // Extract tags
    const results = await tagExtractionService.extractTagsBatch(contacts);

    // Save tags
    for (const result of results) {
      try {
        await tagExtractionService.saveTags(result.contactId, result);
        if (result.sectors.length > 0 || result.skills.length > 0) {
          taggedCount++;
        }
      } catch (error) {
        logger.warn('Failed to save tags for contact', {
          contactId: result.contactId,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    processedContacts += contacts.length;

    // Update progress
    const progress = progressRange.start + Math.floor(
      (processedContacts / contactIds.length) * (progressRange.end - progressRange.start)
    );
    await updateProgress(job, batchId, progress);
  }

  // Update batch stats
  await prisma.contactImportBatch.update({
    where: { id: batchId },
    data: {
      taggedCount,
      stageProgress: 100,
      overallProgress: progressRange.end,
    },
  });

  return processedContacts;
}

/**
 * Stage 5: Generate profile summaries
 */
async function processSummary(
  job: Job<ImportJobData>,
  batchId: string,
  userId: string
): Promise<number> {
  const redisClient = getRedis();
  const progressRange = STAGE_PROGRESS.summary;

  // Get batch settings
  const batch = await prisma.contactImportBatch.findUnique({
    where: { id: batchId },
    select: { aiSummaryEnabled: true },
  });

  // Get contact IDs
  const contactIds = await redisClient.smembers(`import:contacts:${batchId}`);
  let processedContacts = 0;
  let summarizedCount = 0;

  logger.info('Generating summaries', {
    batchId,
    totalContacts: contactIds.length,
    llmEnabled: batch?.aiSummaryEnabled,
  });

  // Process in batches of 100
  const batchSize = 100;

  for (let i = 0; i < contactIds.length; i += batchSize) {
    const batchIds = contactIds.slice(i, i + batchSize);

    // Get contacts with computed profiles
    const contacts = await prisma.contact.findMany({
      where: { id: { in: batchIds } },
      select: {
        id: true,
        fullName: true,
        jobTitle: true,
        company: true,
        bio: true,
        location: true,
      },
    });

    const computedProfiles = await prisma.contactComputedProfile.findMany({
      where: { contactId: { in: batchIds } },
      select: {
        contactId: true,
        sectorsJson: true,
        skillsJson: true,
        interestsJson: true,
        keywordsJson: true,
      },
    });

    // Build profiles map
    const profilesMap = new Map(
      computedProfiles.map(cp => [cp.contactId, cp])
    );

    // Generate summaries
    const results = await profileSummaryService.generateSummariesBatch(
      contacts,
      profilesMap as any,
      true
    );

    // Save summaries
    for (const result of results) {
      try {
        await profileSummaryService.saveSummary(result.contactId, result);
        summarizedCount++;
      } catch (error) {
        logger.warn('Failed to save summary for contact', {
          contactId: result.contactId,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    processedContacts += contacts.length;

    // Update progress
    const progress = progressRange.start + Math.floor(
      (processedContacts / contactIds.length) * (progressRange.end - progressRange.start)
    );
    await updateProgress(job, batchId, progress);
  }

  // Update batch stats
  await prisma.contactImportBatch.update({
    where: { id: batchId },
    data: {
      summarizedCount,
      stageProgress: 100,
      overallProgress: progressRange.end,
    },
  });

  return processedContacts;
}

/**
 * Stage 6: Calculate match scores
 */
async function processMatching(
  job: Job<ImportJobData>,
  batchId: string,
  userId: string
): Promise<number> {
  const redisClient = getRedis();
  const progressRange = STAGE_PROGRESS.match;

  // Get contact IDs
  const contactIds = await redisClient.smembers(`import:contacts:${batchId}`);
  let processedContacts = 0;
  let matchedCount = 0;

  logger.info('Calculating match scores', { batchId, totalContacts: contactIds.length });

  // Get user data for matching
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      userSectors: { include: { sector: true } },
      userSkills: { include: { skill: true } },
      userInterests: { include: { interest: true } },
      userHobbies: { include: { hobby: true } },
      userGoals: true,
    },
  });

  if (!user) {
    logger.warn('User not found for matching', { userId });
    return 0;
  }

  // Process in batches of 50
  const batchSize = 50;

  for (let i = 0; i < contactIds.length; i += batchSize) {
    const batchIds = contactIds.slice(i, i + batchSize);

    // Get contacts with all data needed for matching
    const contacts = await prisma.contact.findMany({
      where: { id: { in: batchIds } },
      include: {
        contactSectors: { include: { sector: true } },
        contactSkills: { include: { skill: true } },
        contactInterests: { include: { interest: true } },
        contactHobbies: { include: { hobby: true } },
        interactions: {
          orderBy: { occurredAt: 'desc' },
          take: 10,
        },
      },
    });

    // Calculate match scores for each contact
    for (const contact of contacts) {
      try {
        // Use the matching service to calculate score
        const score = await matchingService.recalculateScore(userId, contact.id);

        // Store in ContactMatchCache
        await prisma.contactMatchCache.upsert({
          where: {
            userId_contactId: { userId, contactId: contact.id },
          },
          create: {
            userId,
            contactId: contact.id,
            score,
            breakdownJson: {},
            reasonsJson: [],
            computedAt: new Date(),
            version: 1,
          },
          update: {
            score,
            computedAt: new Date(),
            version: { increment: 1 },
          },
        });

        matchedCount++;
      } catch (error) {
        logger.warn('Failed to calculate match score', {
          contactId: contact.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    processedContacts += contacts.length;

    // Update progress
    const progress = progressRange.start + Math.floor(
      (processedContacts / contactIds.length) * (progressRange.end - progressRange.start)
    );
    await updateProgress(job, batchId, progress);
  }

  // Update batch stats
  await prisma.contactImportBatch.update({
    where: { id: batchId },
    data: {
      matchedCount,
      stageProgress: 100,
      overallProgress: progressRange.end,
    },
  });

  return processedContacts;
}

/**
 * Update progress in job and database
 */
async function updateProgress(
  job: Job<ImportJobData>,
  batchId: string,
  progress: number
): Promise<void> {
  await job.updateProgress(progress);
  await prisma.contactImportBatch.update({
    where: { id: batchId },
    data: { overallProgress: progress },
  });
}

/**
 * Clean up Redis data after completion
 */
async function cleanupRedisData(batchId: string): Promise<void> {
  const redisClient = getRedis();

  try {
    // Delete contact set
    await redisClient.del(`import:contacts:${batchId}`);

    // Delete any remaining keys
    const keys = await redisClient.keys(`import:*:${batchId}:*`);
    if (keys.length > 0) {
      await redisClient.del(...keys);
    }

    logger.debug('Cleaned up Redis data', { batchId, keysDeleted: keys.length + 1 });
  } catch (error) {
    logger.warn('Failed to clean up Redis data', {
      batchId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Start import worker
 */
export function startImportWorker(): void {
  queueService.registerWorker<ImportJobData, ImportWorkerResult>(
    QueueName.IMPORT,
    processImportJob,
    {
      concurrency: 3, // Process up to 3 batches at a time
      limiter: {
        max: 10,
        duration: 60000, // 10 jobs per minute
      },
    }
  );

  logger.info('Import worker started');
}

/**
 * Get import job status
 */
export async function getImportJobStatus(jobId: string) {
  return queueService.getJobStatus(QueueName.IMPORT, jobId);
}

export default startImportWorker;
