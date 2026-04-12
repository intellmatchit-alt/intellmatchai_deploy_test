/**
 * PNME Worker: Main Pitch Processing Pipeline
 * Handles text extraction, section classification, and needs extraction
 */

import { Job, Worker } from 'bullmq';
import { container } from 'tsyringe';
import { PitchJobStep, PitchJobStatus, PitchStatus } from '../../../domain/entities/Pitch';
import {
  IPitchRepository,
  IPitchJobRepository,
  IPitchSectionRepository,
  IPitchNeedRepository,
} from '../../../domain/repositories/IPitchRepository';
import { IFileStorageService } from '../../../application/interfaces/IFileStorageService';
import {
  IDocumentParserService,
  ISectionClassifierService,
  INeedsExtractorService,
} from '../../../application/interfaces/IPitchAIService';
import { IPitchQueueService, PitchProcessingJobData } from '../../../application/interfaces/IPitchQueueService';
import { IContactRepository } from '../../../domain/repositories/IContactRepository';
import { logger } from '../../../shared/logger';
import { redisConnection } from '../../database/redis/client.js';
import { registerProfileBatch } from './pitchProfile.worker.js';

const QUEUE_NAME = 'pitch-processing';

/**
 * Create the pitch processing worker
 */
export function createPitchProcessingWorker(): Worker {
  const worker = new Worker<PitchProcessingJobData>(
    QUEUE_NAME,
    async (job: Job<PitchProcessingJobData>) => {
      const { pitchId, userId, step } = job.data;

      logger.info('Processing pitch job', { pitchId, step, jobId: job.id });

      try {
        switch (step) {
          case PitchJobStep.EXTRACT_TEXT:
            await processExtractText(pitchId, userId, job);
            break;
          case PitchJobStep.CLASSIFY_SECTIONS:
            await processClassifySections(pitchId, userId, job);
            break;
          case PitchJobStep.EXTRACT_NEEDS:
            await processExtractNeeds(pitchId, userId, job);
            break;
          default:
            throw new Error(`Unknown step: ${step}`);
        }

        logger.info('Pitch job completed', { pitchId, step, jobId: job.id });
      } catch (error) {
        logger.error('Pitch job failed', { pitchId, step, jobId: job.id, error });
        throw error;
      }
    },
    {
      connection: redisConnection,
      concurrency: 5,
      limiter: {
        max: 5,
        duration: 1000,
      },
    },
  );

  worker.on('completed', (job) => {
    logger.debug('Job completed', { jobId: job.id, step: job.data.step });
  });

  worker.on('failed', (job, error) => {
    logger.error('Job failed', { jobId: job?.id, step: job?.data.step, error: error.message });
  });

  return worker;
}

/**
 * Step 1: Extract text from PDF
 */
async function processExtractText(pitchId: string, userId: string, job: Job): Promise<void> {
  const pitchRepo = container.resolve<IPitchRepository>('PitchRepository');
  const jobRepo = container.resolve<IPitchJobRepository>('PitchJobRepository');
  const fileStorage = container.resolve<IFileStorageService>('FileStorageService');
  const documentParser = container.resolve<IDocumentParserService>('DocumentParserService');
  const pitchQueue = container.resolve<IPitchQueueService>('PitchQueueService');

  // Update job status
  await jobRepo.updateByPitchIdAndStep(pitchId, PitchJobStep.EXTRACT_TEXT, {
    status: PitchJobStatus.PROCESSING,
    startedAt: new Date(),
    bullJobId: job.id,
  });

  // Update pitch status
  await pitchRepo.update(pitchId, { status: PitchStatus.EXTRACTING });

  try {
    // Get pitch details
    const pitch = await pitchRepo.findById(pitchId);
    if (!pitch) throw new Error('Pitch not found');

    await job.updateProgress(10);

    // Download file from MinIO
    const fileBuffer = await fileStorage.downloadFile(pitch.fileKey);
    await job.updateProgress(30);

    // Extract text based on file type
    let extracted;
    if (pitch.fileType === 'PDF') {
      extracted = await documentParser.extractTextFromPDF(fileBuffer);
    } else {
      extracted = await documentParser.extractTextFromPPTX(fileBuffer);
    }
    await job.updateProgress(80);

    // Update pitch with raw text and metadata
    await pitchRepo.update(pitchId, {
      rawText: extracted.text,
      title: pitch.title || extracted.metadata?.title || null,
    });

    // Mark job complete
    await jobRepo.updateByPitchIdAndStep(pitchId, PitchJobStep.EXTRACT_TEXT, {
      status: PitchJobStatus.COMPLETED,
      progress: 100,
      completedAt: new Date(),
    });

    await job.updateProgress(100);

    // Enqueue next step
    await pitchQueue.enqueueClassifySections(pitchId, userId);
  } catch (error: any) {
    await jobRepo.updateByPitchIdAndStep(pitchId, PitchJobStep.EXTRACT_TEXT, {
      status: PitchJobStatus.FAILED,
      error: error.message,
    });
    await pitchRepo.update(pitchId, {
      status: PitchStatus.FAILED,
      lastError: `Text extraction failed: ${error.message}`,
    });
    throw error;
  }
}

/**
 * Step 2: Classify sections
 */
async function processClassifySections(pitchId: string, userId: string, job: Job): Promise<void> {
  const pitchRepo = container.resolve<IPitchRepository>('PitchRepository');
  const jobRepo = container.resolve<IPitchJobRepository>('PitchJobRepository');
  const sectionRepo = container.resolve<IPitchSectionRepository>('PitchSectionRepository');
  const sectionClassifier = container.resolve<ISectionClassifierService>('SectionClassifierService');
  const pitchQueue = container.resolve<IPitchQueueService>('PitchQueueService');

  await jobRepo.updateByPitchIdAndStep(pitchId, PitchJobStep.CLASSIFY_SECTIONS, {
    status: PitchJobStatus.PROCESSING,
    startedAt: new Date(),
    bullJobId: job.id,
  });

  await pitchRepo.update(pitchId, { status: PitchStatus.CLASSIFYING });

  try {
    const pitch = await pitchRepo.findById(pitchId);
    if (!pitch) throw new Error('Pitch not found');
    if (!pitch.rawText) throw new Error('No text extracted');

    await job.updateProgress(10);

    // Classify sections
    const classifiedSections = await sectionClassifier.classifySections(
      pitch.rawText,
      pitch.language,
    );
    await job.updateProgress(70);

    // Delete existing sections (for reprocessing)
    await sectionRepo.deleteByPitchId(pitchId);

    // Create section records
    const sectionInputs = classifiedSections.map((section, index) => ({
      pitchId,
      type: section.type,
      order: index + 1,
      title: section.title,
      content: section.content,
      rawContent: section.rawContent,
      confidence: section.confidence,
    }));

    await sectionRepo.createMany(sectionInputs);
    await job.updateProgress(90);

    // Mark job complete
    await jobRepo.updateByPitchIdAndStep(pitchId, PitchJobStep.CLASSIFY_SECTIONS, {
      status: PitchJobStatus.COMPLETED,
      progress: 100,
      completedAt: new Date(),
    });

    await job.updateProgress(100);

    // Enqueue next step
    await pitchQueue.enqueueExtractNeeds(pitchId, userId);
  } catch (error: any) {
    await jobRepo.updateByPitchIdAndStep(pitchId, PitchJobStep.CLASSIFY_SECTIONS, {
      status: PitchJobStatus.FAILED,
      error: error.message,
    });
    await pitchRepo.update(pitchId, {
      status: PitchStatus.FAILED,
      lastError: `Section classification failed: ${error.message}`,
    });
    throw error;
  }
}

/**
 * Step 3: Extract needs
 */
async function processExtractNeeds(pitchId: string, userId: string, job: Job): Promise<void> {
  const pitchRepo = container.resolve<IPitchRepository>('PitchRepository');
  const jobRepo = container.resolve<IPitchJobRepository>('PitchJobRepository');
  const sectionRepo = container.resolve<IPitchSectionRepository>('PitchSectionRepository');
  const needRepo = container.resolve<IPitchNeedRepository>('PitchNeedRepository');
  const needsExtractor = container.resolve<INeedsExtractorService>('NeedsExtractorService');
  const contactRepo = container.resolve<IContactRepository>('ContactRepository');
  const pitchQueue = container.resolve<IPitchQueueService>('PitchQueueService');

  await jobRepo.updateByPitchIdAndStep(pitchId, PitchJobStep.EXTRACT_NEEDS, {
    status: PitchJobStatus.PROCESSING,
    startedAt: new Date(),
    bullJobId: job.id,
  });

  await pitchRepo.update(pitchId, { status: PitchStatus.ANALYZING });

  try {
    // Get classified sections
    const sections = await sectionRepo.findByPitchId(pitchId);
    if (sections.length === 0) throw new Error('No sections found');

    await job.updateProgress(10);

    // Convert to classifier format
    const classifiedSections = sections.map((s) => ({
      type: s.type,
      title: s.title,
      content: s.content,
      rawContent: s.rawContent || s.content,
      confidence: s.confidence,
    }));

    // Extract needs
    const extractedNeeds = await needsExtractor.extractNeeds(classifiedSections);
    await job.updateProgress(50);

    // Delete existing needs (for reprocessing)
    await needRepo.deleteByPitchId(pitchId);

    // Create need records
    const needInputs = extractedNeeds.map((need, index) => ({
      pitchId,
      key: need.key,
      label: need.label,
      description: need.description,
      confidence: need.confidence,
      sourceSectionType: need.sourceSectionType,
      amount: need.amount,
      timeline: need.timeline,
      priority: index + 1,
    }));

    await needRepo.createMany(needInputs);
    await job.updateProgress(70);

    // Mark job complete
    await jobRepo.updateByPitchIdAndStep(pitchId, PitchJobStep.EXTRACT_NEEDS, {
      status: PitchJobStatus.COMPLETED,
      progress: 100,
      completedAt: new Date(),
    });

    await job.updateProgress(100);

    // Get user's contacts for profile building
    const result = await contactRepo.findByUserId(userId, undefined, { page: 1, limit: 500 });
    const contactIds = result.contacts.map((c) => c.id);

    // Enqueue profile building for contacts
    if (contactIds.length > 0) {
      // Update BUILD_PROFILES job status to PROCESSING
      await jobRepo.updateByPitchIdAndStep(pitchId, PitchJobStep.BUILD_PROFILES, {
        status: PitchJobStatus.PROCESSING,
        startedAt: new Date(),
      });

      // Register batch tracker before enqueuing jobs
      await registerProfileBatch(pitchId, userId, contactIds.length);

      await pitchQueue.enqueueBuildProfiles(pitchId, userId, contactIds);
    } else {
      // No contacts, skip to matching
      await jobRepo.updateByPitchIdAndStep(pitchId, PitchJobStep.BUILD_PROFILES, {
        status: PitchJobStatus.COMPLETED,
        progress: 100,
        completedAt: new Date(),
      });
      // Mark pitch as complete (no matches possible)
      await pitchRepo.update(pitchId, {
        status: PitchStatus.COMPLETED,
        processedAt: new Date(),
      });
    }
  } catch (error: any) {
    await jobRepo.updateByPitchIdAndStep(pitchId, PitchJobStep.EXTRACT_NEEDS, {
      status: PitchJobStatus.FAILED,
      error: error.message,
    });
    await pitchRepo.update(pitchId, {
      status: PitchStatus.FAILED,
      lastError: `Needs extraction failed: ${error.message}`,
    });
    throw error;
  }
}
