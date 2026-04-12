/**
 * Use Case: Upload Pitch
 * Handles pitch file upload, validation, and initiates processing pipeline
 */

import { IPitchRepository, IPitchJobRepository } from '../../../domain/repositories/IPitchRepository';
import { PitchJobStep, PitchJobStatus } from '../../../domain/entities/Pitch';
import { UploadPitchRequestDTO, PitchResponseDTO, PitchJobProgressDTO } from '../../dto/pitch.dto';
import { IFileStorageService } from '../../interfaces/IFileStorageService';
import { IPitchQueueService } from '../../interfaces/IPitchQueueService';
import { ValidationError } from '../../../shared/errors/index.js';
import { logger } from '../../../shared/logger';

// Supported file types
const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
];
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

interface UploadPitchResult {
  pitch: PitchResponseDTO;
  jobs: PitchJobProgressDTO[];
}

export class UploadPitchUseCase {
  constructor(
    private readonly pitchRepository: IPitchRepository,
    private readonly pitchJobRepository: IPitchJobRepository,
    private readonly fileStorage: IFileStorageService,
    private readonly pitchQueue: IPitchQueueService,
  ) {}

  async execute(userId: string, input: UploadPitchRequestDTO): Promise<UploadPitchResult> {
    const { file, title, language = 'en' } = input;

    // Validate file
    this.validateFile(file);

    // Determine file type
    const fileType = this.getFileType(file.mimetype);

    // Generate unique file key
    const timestamp = Date.now();
    const sanitizedName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    const fileKey = `pitches/${userId}/${timestamp}-${sanitizedName}`;

    logger.info('Uploading pitch file', { userId, fileKey, fileSize: file.size });

    try {
      // Upload to MinIO
      await this.fileStorage.uploadFile(fileKey, file.buffer, file.mimetype);

      // Calculate expiration (30 days default)
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30);

      // Create pitch record
      const pitch = await this.pitchRepository.create({
        userId,
        fileKey,
        fileName: file.originalname,
        fileType,
        fileSize: file.size,
        language,
        title: title || null,
        expiresAt,
      });

      // Create all job records
      const jobSteps: PitchJobStep[] = [
        PitchJobStep.UPLOAD,
        PitchJobStep.EXTRACT_TEXT,
        PitchJobStep.CLASSIFY_SECTIONS,
        PitchJobStep.EXTRACT_NEEDS,
        PitchJobStep.BUILD_PROFILES,
        PitchJobStep.COMPUTE_MATCHES,
        PitchJobStep.GENERATE_OUTREACH,
      ];

      const jobInputs = jobSteps.map((step) => ({
        pitchId: pitch.id,
        step,
        maxAttempts: step === PitchJobStep.GENERATE_OUTREACH ? 2 : 3, // LLM jobs get fewer retries
      }));

      await this.pitchJobRepository.createMany(jobInputs);

      // Mark upload job as completed
      await this.pitchJobRepository.updateByPitchIdAndStep(pitch.id, PitchJobStep.UPLOAD, {
        status: PitchJobStatus.COMPLETED,
        progress: 100,
        completedAt: new Date(),
      });

      // Enqueue first processing step
      await this.pitchQueue.enqueueExtractText(pitch.id, userId);

      logger.info('Pitch upload complete, processing started', { pitchId: pitch.id });

      // Build response
      const jobs = await this.pitchJobRepository.findByPitchId(pitch.id);
      const jobsResponse: PitchJobProgressDTO[] = jobs.map((job) => ({
        step: job.step,
        status: job.status,
        progress: job.progress,
        error: job.error || undefined,
      }));

      return {
        pitch: {
          id: pitch.id,
          status: pitch.status,
          fileName: pitch.fileName,
          fileType: pitch.fileType,
          title: pitch.title,
          companyName: pitch.companyName,
          language: pitch.language,
          uploadedAt: pitch.uploadedAt.toISOString(),
          processedAt: null,
        },
        jobs: jobsResponse,
      };
    } catch (error) {
      // Cleanup on failure
      try {
        await this.fileStorage.deleteFile(fileKey);
      } catch (cleanupError) {
        logger.warn('Failed to cleanup file after upload error', { fileKey, error: cleanupError });
      }
      throw error;
    }
  }

  private validateFile(file: Express.Multer.File): void {
    if (!file) {
      throw new ValidationError('No file provided');
    }

    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      throw new ValidationError(
        `Invalid file type: ${file.mimetype}. Only PDF and PPTX files are supported.`,
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      throw new ValidationError(
        `File too large: ${Math.round(file.size / 1024 / 1024)}MB. Maximum size is 50MB.`,
      );
    }

    // Validate magic bytes for PDF
    if (file.mimetype === 'application/pdf') {
      const pdfMagic = Buffer.from([0x25, 0x50, 0x44, 0x46]); // %PDF
      if (!file.buffer.slice(0, 4).equals(pdfMagic)) {
        throw new ValidationError('Invalid PDF file: magic bytes mismatch');
      }
    }

    // Validate magic bytes for PPTX (ZIP archive)
    if (file.mimetype === 'application/vnd.openxmlformats-officedocument.presentationml.presentation') {
      const zipMagic = Buffer.from([0x50, 0x4B, 0x03, 0x04]); // PK..
      if (!file.buffer.slice(0, 4).equals(zipMagic)) {
        throw new ValidationError('Invalid PPTX file: magic bytes mismatch');
      }
    }
  }

  private getFileType(mimetype: string): 'PDF' | 'PPTX' {
    if (mimetype === 'application/pdf') return 'PDF';
    if (mimetype === 'application/vnd.openxmlformats-officedocument.presentationml.presentation') {
      return 'PPTX';
    }
    throw new ValidationError(`Unsupported file type: ${mimetype}`);
  }
}
