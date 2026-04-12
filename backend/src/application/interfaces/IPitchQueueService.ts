/**
 * Interface: Pitch Queue Service
 * Defines contract for BullMQ queue operations for PNME
 */

import { PitchJobStep, MatchReason } from '../../domain/entities/Pitch';
import { MatchWeightsDTO, ContactProfileDTO } from '../dto/pitch.dto';

export interface IPitchQueueService {
  /**
   * Enqueue text extraction job
   */
  enqueueExtractText(pitchId: string, userId: string): Promise<string>;

  /**
   * Enqueue section classification job
   */
  enqueueClassifySections(pitchId: string, userId: string): Promise<string>;

  /**
   * Enqueue needs extraction job
   */
  enqueueExtractNeeds(pitchId: string, userId: string): Promise<string>;

  /**
   * Enqueue profile build jobs for all contacts
   */
  enqueueBuildProfiles(pitchId: string, userId: string, contactIds: string[]): Promise<string[]>;

  /**
   * Enqueue match computation for a section
   */
  enqueueComputeMatches(
    pitchId: string,
    sectionId: string,
    contactIds: string[],
    weights: MatchWeightsDTO,
  ): Promise<string>;

  /**
   * Enqueue outreach generation for a match
   */
  enqueueGenerateOutreach(
    matchId: string,
    sectionContent: string,
    contactProfile: ContactProfileDTO,
    reasons: MatchReason[],
    tone?: 'professional' | 'casual' | 'warm',
  ): Promise<string>;

  /**
   * Get job status
   */
  getJobStatus(jobId: string): Promise<{
    status: 'waiting' | 'active' | 'completed' | 'failed';
    progress: number;
    error?: string;
  }>;

  /**
   * Cancel a job
   */
  cancelJob(jobId: string): Promise<void>;

  /**
   * Get queue health metrics
   */
  getQueueMetrics(): Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
  }>;
}

/**
 * Job data types for BullMQ processors
 */
export interface PitchProcessingJobData {
  pitchId: string;
  userId: string;
  step: PitchJobStep;
}

export interface ProfileBuildJobData {
  contactId: string;
  userId: string;
  pitchId: string;
}

export interface MatchComputeJobData {
  pitchId: string;
  sectionId: string;
  contactIds: string[];
  weights: MatchWeightsDTO;
}

export interface OutreachGenerateJobData {
  matchId: string;
  sectionContent: string;
  contactProfile: ContactProfileDTO;
  reasons: MatchReason[];
  tone: 'professional' | 'casual' | 'warm';
}
