/**
 * Use Case: Rematch Pitch
 * Re-runs the matching pipeline for an existing pitch from a specified step.
 */

import {
  IPitchRepository,
  IPitchJobRepository,
  IPitchMatchRepository,
  IPitchSectionRepository,
} from '../../../domain/repositories/IPitchRepository';
import { IPitchQueueService } from '../../interfaces/IPitchQueueService';
import { RematchRequestDTO } from '../../dto/pitch.dto';
import { PitchStatus, PitchJobStep, PitchJobStatus } from '../../../domain/entities/Pitch';
import { NotFoundError, AuthorizationError, ConflictError, DomainException } from '../../../shared/errors/index';
import { logger } from '../../../shared/logger';

export class RematchPitchUseCase {
  constructor(
    private readonly pitchRepository: IPitchRepository,
    private readonly pitchJobRepository: IPitchJobRepository,
    private readonly pitchMatchRepository: IPitchMatchRepository,
    private readonly sectionRepository: IPitchSectionRepository,
    private readonly queueService: IPitchQueueService,
  ) {}

  async execute(
    userId: string,
    pitchId: string,
    input: RematchRequestDTO,
  ): Promise<{ message: string; pitchId: string }> {
    // Verify pitch ownership
    const pitch = await this.pitchRepository.findById(pitchId);
    if (!pitch) {
      throw new NotFoundError('Pitch');
    }
    if (pitch.userId !== userId) {
      throw new AuthorizationError('Access denied');
    }
    if (pitch.deletedAt) {
      throw new DomainException('Pitch has been deleted');
    }

    // Only allow rematch on completed or failed pitches
    if (pitch.status !== PitchStatus.COMPLETED && pitch.status !== PitchStatus.FAILED) {
      throw new ConflictError(`Cannot rematch pitch with status: ${pitch.status}. Pitch must be completed or failed.`);
    }

    const fromStep = input.fromStep || 'COMPUTE_MATCHES';

    // Delete existing matches if starting from COMPUTE_MATCHES
    if (fromStep === 'COMPUTE_MATCHES') {
      await this.pitchMatchRepository.deleteByPitchId(pitchId);
      logger.info('Deleted existing matches for rematch', { pitchId });
    }

    // Reset pitch status to PROCESSING
    await this.pitchRepository.update(pitchId, {
      status: PitchStatus.MATCHING,
      processedAt: undefined,
      lastError: undefined,
    });

    // Get sections for match computation
    const sections = await this.sectionRepository.findByPitchId(pitchId);
    if (sections.length === 0) {
      throw new DomainException('No sections found. Please re-upload the pitch.');
    }

    // Reset job statuses for ALL steps being re-run (including EXTRACT_NEEDS and BUILD_PROFILES)
    const stepsToReset = fromStep === 'COMPUTE_MATCHES'
      ? [PitchJobStep.EXTRACT_NEEDS, PitchJobStep.BUILD_PROFILES, PitchJobStep.COMPUTE_MATCHES, PitchJobStep.GENERATE_OUTREACH]
      : [PitchJobStep.GENERATE_OUTREACH];

    for (const step of stepsToReset) {
      const job = await this.pitchJobRepository.findByPitchIdAndStep(pitchId, step);
      if (job) {
        await this.pitchJobRepository.update(job.id, {
          status: PitchJobStatus.PENDING,
          progress: 0,
          error: undefined,
          startedAt: undefined,
          completedAt: undefined,
        });
      } else {
        // Create missing job record (for older pitches that may not have all steps)
        await this.pitchJobRepository.create({
          pitchId,
          step,
          maxAttempts: step === PitchJobStep.GENERATE_OUTREACH ? 2 : 3,
        });
      }
    }

    // Enqueue the pipeline starting from the specified step
    if (fromStep === 'COMPUTE_MATCHES') {
      // Start from profile build step (needed before matching)
      await this.queueService.enqueueExtractNeeds(pitchId, userId);
    } else {
      // Just re-generate outreach
      await this.queueService.enqueueExtractNeeds(pitchId, userId);
    }

    logger.info('Pitch rematch initiated', { pitchId, fromStep, userId });

    return {
      message: `Rematch started from step: ${fromStep}`,
      pitchId,
    };
  }
}
