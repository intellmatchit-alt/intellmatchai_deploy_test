/**
 * PNME DTOs: Data Transfer Objects for Pitch-to-Network Matching Engine
 */

import {
  PitchSectionType,
  PitchNeedKey,
  MatchAngleCategory,
  PitchMatchStatus,
  PitchJobStep,
  PitchJobStatus,
  MatchBreakdown,
  MatchReason,
} from '../../domain/entities/Pitch';

// ============================================================================
// Request DTOs
// ============================================================================

export interface UploadPitchRequestDTO {
  file: Express.Multer.File;
  title?: string;
  language?: string; // 'en' | 'ar'
}

export interface RegenerateOutreachRequestDTO {
  tone?: 'professional' | 'casual' | 'warm';
  focus?: string; // Specific angle to emphasize
}

export interface UpdateMatchStatusRequestDTO {
  status: PitchMatchStatus;
  outreachEdited?: string;
}

export interface RematchRequestDTO {
  fromStep?: 'COMPUTE_MATCHES' | 'GENERATE_OUTREACH';
}

export interface ExportPitchRequestDTO {
  format: 'json' | 'csv' | 'pdf';
}

export interface UpdatePNMEPreferencesRequestDTO {
  relevanceWeight?: number;
  expertiseWeight?: number;
  strategicWeight?: number;
  relationshipWeight?: number;
  autoDeletePitchDays?: number;
  enableWhatsAppMetadata?: boolean;
  defaultLanguage?: string;
  minMatchScore?: number;
  maxMatchesPerSection?: number;
}

export interface GetPitchResultsQueryDTO {
  sectionType?: PitchSectionType;
  minScore?: number;
  limit?: number;
}

export interface ListPitchesQueryDTO {
  status?: string;
  page?: number;
  limit?: number;
}

// ============================================================================
// Response DTOs
// ============================================================================

export interface PitchResponseDTO {
  id: string;
  status: string;
  fileName: string;
  fileType: string;
  title: string | null;
  companyName: string | null;
  language: string;
  uploadedAt: string;
  processedAt: string | null;
  sectionsCount?: number;
  needsCount?: number;
}

export interface PitchProgressDTO {
  overall: number; // 0-100
  currentStep: PitchJobStep | null;
  steps: PitchJobProgressDTO[];
}

export interface PitchJobProgressDTO {
  step: PitchJobStep;
  status: PitchJobStatus;
  progress: number;
  error?: string;
}

export interface PitchStatusResponseDTO extends PitchResponseDTO {
  progress: PitchProgressDTO;
}

export interface PitchSectionDTO {
  id: string;
  type: PitchSectionType;
  order: number;
  title: string;
  content: string;
  confidence: number;
}

export interface PitchNeedDTO {
  key: PitchNeedKey;
  label: string;
  description: string | null;
  confidence: number;
  amount?: string | null;
  timeline?: string | null;
}

export interface ContactSummaryDTO {
  id: string;
  fullName: string;
  company: string | null;
  jobTitle: string | null;
  avatarUrl: string | null;
  matchScore: number | null; // Existing IntellMatch score
  email?: string | null;
  phone?: string | null;
  linkedinUrl?: string | null;
}

export interface MatchReasonDTO {
  type: string;
  text: string;
  evidence: string;
}

export interface MatchBreakdownDTO {
  relevance: ComponentScoreDTO;
  expertise: ComponentScoreDTO;
  strategic: ComponentScoreDTO;
  relationship: ComponentScoreDTO;
}

export interface ComponentScoreDTO {
  score: number;
  weight: number;
  weighted: number;
}

export interface PitchMatchDTO {
  id: string;
  contact: ContactSummaryDTO;
  score: number;
  breakdown: MatchBreakdownDTO;
  reasons: MatchReasonDTO[];
  angleCategory: MatchAngleCategory | null;
  outreachDraft: string | null;
  status: PitchMatchStatus;
}

export interface PitchSectionWithMatchesDTO extends PitchSectionDTO {
  matches: PitchMatchDTO[];
}

export interface PitchResultsSummaryDTO {
  totalMatches: number;
  avgScore: number;
  topAngle: MatchAngleCategory | null;
}

export interface PitchResultsResponseDTO {
  pitch: PitchResponseDTO;
  sections: PitchSectionWithMatchesDTO[];
  needs: PitchNeedDTO[];
  summary: PitchResultsSummaryDTO;
}

export interface OutreachRegenerateResponseDTO {
  outreachDraft: string;
}

export interface MatchStatusUpdateResponseDTO {
  id: string;
  status: PitchMatchStatus;
  savedAt?: string;
  ignoredAt?: string;
  contactedAt?: string;
}

export interface PitchListResponseDTO {
  pitches: PitchResponseDTO[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface PNMEPreferencesResponseDTO {
  relevanceWeight: number;
  expertiseWeight: number;
  strategicWeight: number;
  relationshipWeight: number;
  autoDeletePitchDays: number;
  enableWhatsAppMetadata: boolean;
  defaultLanguage: string;
  minMatchScore: number;
  maxMatchesPerSection: number;
  consentGiven: boolean;
}

// ============================================================================
// Internal DTOs (for service layer)
// ============================================================================

export interface ExtractedTextDTO {
  text: string;
  pageCount: number;
  metadata?: {
    title?: string;
    author?: string;
    creationDate?: string;
  };
}

export interface ClassifiedSectionDTO {
  type: PitchSectionType;
  title: string;
  content: string;
  rawContent: string;
  confidence: number;
  startPage?: number;
  endPage?: number;
}

export interface ExtractedNeedDTO {
  key: PitchNeedKey;
  label: string;
  description: string;
  confidence: number;
  sourceSectionType: PitchSectionType;
  amount?: string;
  timeline?: string;
}

export interface ContactProfileDTO {
  contactId: string;
  userId: string;
  fullName: string;
  company: string | null;
  jobTitle: string | null;
  profileSummary: string;
  sectors: string[];
  skills: string[];
  interests: string[];
  investorType?: string;
  investmentStage?: string;
  checkSize?: string;
  relationshipStrength: number;
  lastInteractionDays: number | null;
  interactionCount: number;
  embedding?: number[];
}

export interface ComputedMatchDTO {
  contactId: string;
  score: number;
  relevanceScore: number;
  expertiseScore: number;
  strategicScore: number;
  relationshipScore: number;
  breakdown: MatchBreakdown;
  reasons: MatchReason[];
  angleCategory: MatchAngleCategory;
}

export interface MatchWeightsDTO {
  relevance: number;
  expertise: number;
  strategic: number;
  relationship: number;
}

// ============================================================================
// Event DTOs (for BullMQ jobs)
// ============================================================================

export interface PitchProcessingJobDTO {
  pitchId: string;
  step: PitchJobStep;
  userId: string;
}

export interface ProfileBuildJobDTO {
  contactId: string;
  userId: string;
  pitchId: string;
}

export interface MatchComputeJobDTO {
  pitchId: string;
  sectionId: string;
  contactIds: string[];
  weights: MatchWeightsDTO;
}

export interface OutreachGenerateJobDTO {
  matchId: string;
  sectionContent: string;
  contactProfile: ContactProfileDTO;
  reasons: MatchReason[];
  tone: 'professional' | 'casual' | 'warm';
}
