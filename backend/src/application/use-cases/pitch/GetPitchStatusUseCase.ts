/**
 * Use Case: Get Pitch Status
 * Returns current processing status and progress for a pitch
 */

import { IPitchRepository, IPitchJobRepository, IPitchSectionRepository, IPitchNeedRepository } from '../../../domain/repositories/IPitchRepository';
import { PitchJobStep, PitchJobStatus } from '../../../domain/entities/Pitch';
import { PitchStatusResponseDTO, PitchProgressDTO, PitchJobProgressDTO } from '../../dto/pitch.dto';
import { NotFoundError, AuthorizationError, DomainException } from '../../../shared/errors/index';

// Step weights for overall progress calculation
const STEP_WEIGHTS: Record<PitchJobStep, number> = {
  [PitchJobStep.UPLOAD]: 5,
  [PitchJobStep.EXTRACT_TEXT]: 15,
  [PitchJobStep.CLASSIFY_SECTIONS]: 15,
  [PitchJobStep.EXTRACT_NEEDS]: 10,
  [PitchJobStep.BUILD_PROFILES]: 20,
  [PitchJobStep.COMPUTE_MATCHES]: 25,
  [PitchJobStep.GENERATE_OUTREACH]: 10,
};

export class GetPitchStatusUseCase {
  constructor(
    private readonly pitchRepository: IPitchRepository,
    private readonly pitchJobRepository: IPitchJobRepository,
    private readonly sectionRepository: IPitchSectionRepository,
    private readonly needRepository: IPitchNeedRepository,
  ) {}

  async execute(userId: string, pitchId: string): Promise<PitchStatusResponseDTO> {
    // Fetch pitch
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

    // Fetch jobs
    const jobs = await this.pitchJobRepository.findByPitchId(pitchId);

    // Calculate progress
    const progress = this.calculateProgress(jobs);

    // Get counts if available
    const sections = await this.sectionRepository.findByPitchId(pitchId);
    const needs = await this.needRepository.findByPitchId(pitchId);

    return {
      id: pitch.id,
      status: pitch.status,
      fileName: pitch.fileName,
      fileType: pitch.fileType,
      title: pitch.title,
      companyName: pitch.companyName,
      language: pitch.language,
      uploadedAt: pitch.uploadedAt.toISOString(),
      processedAt: pitch.processedAt?.toISOString() || null,
      sectionsCount: sections.length,
      needsCount: needs.length,
      progress,
    };
  }

  private calculateProgress(jobs: { step: PitchJobStep; status: PitchJobStatus; progress: number; error?: string | null }[]): PitchProgressDTO {
    // Order jobs by step
    const stepOrder: PitchJobStep[] = [
      PitchJobStep.UPLOAD,
      PitchJobStep.EXTRACT_TEXT,
      PitchJobStep.CLASSIFY_SECTIONS,
      PitchJobStep.EXTRACT_NEEDS,
      PitchJobStep.BUILD_PROFILES,
      PitchJobStep.COMPUTE_MATCHES,
      PitchJobStep.GENERATE_OUTREACH,
    ];

    const jobMap = new Map(jobs.map((j) => [j.step, j]));

    // Build steps response
    const steps: PitchJobProgressDTO[] = stepOrder.map((step) => {
      const job = jobMap.get(step);
      return {
        step,
        status: job?.status || PitchJobStatus.PENDING,
        progress: job?.progress || 0,
        error: job?.error || undefined,
      };
    });

    // Find current step
    let currentStep: PitchJobStep | null = null;
    for (const step of stepOrder) {
      const job = jobMap.get(step);
      if (job && job.status === PitchJobStatus.PROCESSING) {
        currentStep = step;
        break;
      }
    }

    // If no processing step, find last completed
    if (!currentStep) {
      for (let i = stepOrder.length - 1; i >= 0; i--) {
        const job = jobMap.get(stepOrder[i]);
        if (job && job.status === PitchJobStatus.COMPLETED) {
          // Next step is current (if exists)
          if (i < stepOrder.length - 1) {
            currentStep = stepOrder[i + 1];
          }
          break;
        }
      }
    }

    // Calculate overall progress
    let totalWeight = 0;
    let completedWeight = 0;

    for (const step of stepOrder) {
      const weight = STEP_WEIGHTS[step];
      totalWeight += weight;

      const job = jobMap.get(step);
      if (job) {
        if (job.status === PitchJobStatus.COMPLETED) {
          completedWeight += weight;
        } else if (job.status === PitchJobStatus.PROCESSING) {
          completedWeight += (weight * job.progress) / 100;
        }
      }
    }

    const overall = Math.round((completedWeight / totalWeight) * 100);

    return {
      overall,
      currentStep,
      steps,
    };
  }
}
