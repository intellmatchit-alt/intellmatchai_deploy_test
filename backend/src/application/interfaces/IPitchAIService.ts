/**
 * Interface: Pitch AI Service
 * Defines contract for AI operations in PNME
 */

import {
  PitchSectionType,
  PitchNeedKey,
  MatchAngleCategory,
  MatchReason,
} from '../../domain/entities/Pitch';
import { ExtractedTextDTO, ClassifiedSectionDTO, ExtractedNeedDTO, ContactProfileDTO } from '../dto/pitch.dto';

/**
 * PDF/Document parsing service
 */
export interface IDocumentParserService {
  /**
   * Extract text from a PDF file
   */
  extractTextFromPDF(buffer: Buffer): Promise<ExtractedTextDTO>;

  /**
   * Extract text from a PPTX file (Phase 2)
   */
  extractTextFromPPTX(buffer: Buffer): Promise<ExtractedTextDTO>;
}

/**
 * Section classification service
 */
export interface ISectionClassifierService {
  /**
   * Classify raw text into pitch sections
   * Uses headings detection + LLM fallback
   */
  classifySections(text: string, language: string): Promise<ClassifiedSectionDTO[]>;

  /**
   * Classify a single text block into a section type
   * Rule-based fallback when LLM fails
   */
  classifySectionType(content: string, title?: string): Promise<{
    type: PitchSectionType;
    confidence: number;
  }>;
}

/**
 * Needs extraction service
 */
export interface INeedsExtractorService {
  /**
   * Extract structured needs from classified sections
   */
  extractNeeds(sections: ClassifiedSectionDTO[]): Promise<ExtractedNeedDTO[]>;

  /**
   * Extract needs using rule-based approach (fallback)
   */
  extractNeedsRuleBased(sections: ClassifiedSectionDTO[]): Promise<ExtractedNeedDTO[]>;
}

/**
 * Embedding service for semantic matching
 */
export interface IEmbeddingService {
  /**
   * Generate embedding for a text
   */
  generateEmbedding(text: string): Promise<{
    embedding: number[];
    model: string;
    tokensUsed: number;
  }>;

  /**
   * Generate embeddings for multiple texts (batch)
   */
  generateEmbeddings(texts: string[]): Promise<{
    embeddings: number[][];
    model: string;
    tokensUsed: number;
  }>;

  /**
   * Calculate cosine similarity between two embeddings
   */
  cosineSimilarity(a: number[], b: number[]): number;
}

/**
 * Profile builder service
 */
export interface IProfileBuilderService {
  /**
   * Build a profile summary from contact data
   */
  buildProfileSummary(contact: {
    fullName: string;
    company?: string | null;
    jobTitle?: string | null;
    bio?: string | null;
    sectors: string[];
    skills: string[];
    interests: string[];
    notes?: string | null;
    enrichmentData?: Record<string, unknown> | null;
  }): Promise<string>;

  /**
   * Build a simple profile summary (rule-based fallback)
   */
  buildProfileSummaryRuleBased(contact: {
    fullName: string;
    company?: string | null;
    jobTitle?: string | null;
    sectors: string[];
    skills: string[];
  }): string;

  /**
   * Extract investor-specific fields from enrichment data
   */
  extractInvestorFields(enrichmentData?: Record<string, unknown> | null): {
    investorType?: string;
    investmentStage?: string;
    checkSize?: string;
    previousInvestments?: string[];
  };
}

/**
 * Match explanation service
 */
export interface IMatchExplainerService {
  /**
   * Generate match reasons and explanation
   */
  generateMatchReasons(
    sectionContent: string,
    sectionType: PitchSectionType,
    contactProfile: ContactProfileDTO,
    scores: {
      relevance: number;
      expertise: number;
      strategic: number;
      relationship: number;
    },
  ): Promise<{
    reasons: MatchReason[];
    angleCategory: MatchAngleCategory;
  }>;

  /**
   * Generate match reasons using rules (fallback)
   */
  generateMatchReasonsRuleBased(
    sectionType: PitchSectionType,
    contactProfile: ContactProfileDTO,
    scores: {
      relevance: number;
      expertise: number;
      strategic: number;
      relationship: number;
    },
  ): {
    reasons: MatchReason[];
    angleCategory: MatchAngleCategory;
  };
}

/**
 * Outreach message generator service
 */
export interface IOutreachGeneratorService {
  /**
   * Generate a personalized outreach message
   */
  generateOutreachMessage(
    sectionContent: string,
    contactProfile: ContactProfileDTO,
    reasons: MatchReason[],
    tone: 'professional' | 'casual' | 'warm',
    language: string,
  ): Promise<string>;

  /**
   * Generate a template-based outreach message (fallback)
   */
  generateOutreachMessageTemplate(
    contactProfile: ContactProfileDTO,
    reasons: MatchReason[],
    tone: 'professional' | 'casual' | 'warm',
  ): string;
}
