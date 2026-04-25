/**
 * Upload Chunk Use Case
 *
 * Handles uploading a chunk of contacts for import.
 * Stores chunks in Redis for async processing.
 *
 * @module application/use-cases/import/UploadChunkUseCase
 */

import Redis from 'ioredis';
import { prisma } from '../../../infrastructure/database/prisma/client';
import { config } from '../../../config/index';
import { logger } from '../../../shared/logger/index';

/**
 * Raw contact data in a chunk
 */
export interface RawContactData {
  name?: string;
  fullName?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  company?: string;
  jobTitle?: string;
  location?: string;
  bio?: string;
  notes?: string;
  linkedinUrl?: string;
  twitterUrl?: string;
  websiteUrl?: string;
  [key: string]: string | undefined;
}

/**
 * Input for uploading a chunk
 */
export interface UploadChunkInput {
  batchId: string;
  chunkIndex: number;
  contacts: RawContactData[];
  isLastChunk?: boolean;
}

/**
 * Result of uploading a chunk
 */
export interface UploadChunkResult {
  chunkIndex: number;
  contactCount: number;
  totalReceived: number;
}

// Redis client
let redis: Redis | null = null;

function getRedis(): Redis {
  if (!redis) {
    const redisUrl = config.redis?.url || process.env.REDIS_URL || 'redis://localhost:6379';
    redis = new Redis(redisUrl);
  }
  return redis;
}

/**
 * Upload Chunk Use Case
 */
export class UploadChunkUseCase {
  /**
   * Execute the use case
   */
  async execute(userId: string, input: UploadChunkInput): Promise<UploadChunkResult> {
    const { batchId, chunkIndex, contacts, isLastChunk } = input;

    logger.info('Uploading chunk', {
      userId,
      batchId,
      chunkIndex,
      contactCount: contacts.length,
      isLastChunk,
    });

    // Verify batch exists and belongs to user
    const batch = await prisma.contactImportBatch.findFirst({
      where: {
        id: batchId,
        userId,
        status: { in: ['PENDING', 'UPLOADING'] },
      },
    });

    if (!batch) {
      throw new Error('Import batch not found or not in valid state');
    }

    // Store chunk in Redis
    const redisClient = getRedis();
    const chunkKey = `import:chunk:${batchId}:${chunkIndex}`;

    await redisClient.set(
      chunkKey,
      JSON.stringify(contacts),
      'EX',
      3600 // 1 hour TTL
    );

    // Update batch status and stats
    const currentTotal = batch.totalReceived + contacts.length;

    await prisma.contactImportBatch.update({
      where: { id: batchId },
      data: {
        status: 'UPLOADING',
        totalReceived: currentTotal,
      },
    });

    logger.info('Chunk uploaded', {
      batchId,
      chunkIndex,
      contactCount: contacts.length,
      totalReceived: currentTotal,
    });

    return {
      chunkIndex,
      contactCount: contacts.length,
      totalReceived: currentTotal,
    };
  }
}

export default UploadChunkUseCase;
