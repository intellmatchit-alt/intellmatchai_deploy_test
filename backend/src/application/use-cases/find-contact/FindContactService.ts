/**
 * Find Contact Service
 *
 * Orchestrates the Find Contact feature including:
 * - Query parsing and normalization
 * - Candidate retrieval from database
 * - Deterministic scoring and ranking
 * - Opening message generation via LLM
 * - Caching and rate limiting
 * - Async job coordination for OCR/enrichment
 *
 * @module application/use-cases/find-contact/FindContactService
 */

import { PrismaClient, Prisma, SearchIntent, SearchInputType, SearchStatus, CandidateType } from '@prisma/client';
import crypto from 'crypto';
import { QueryParserService, ParsedQuery } from './QueryParserService';
import { CandidateRetrievalService, RawCandidate } from './CandidateRetrievalService';
import { ScoringService, ScoredCandidate, SearchStatus as ScoringStatus } from './ScoringService';
import { logger } from '../../../shared/logger';
import { config } from '../../../config';
import { OpenAIExplanationService } from '../../../infrastructure/external/explanation/OpenAIExplanationService';

const prisma = new PrismaClient();

/**
 * Search request input
 */
export interface FindContactInput {
  query?: string;
  intent: SearchIntent;
  intentNote?: string;
  imageUploadId?: string;
  consentFaceMatch?: boolean;
}

/**
 * Search result output
 */
export interface FindContactResult {
  requestId: string;
  inputType: SearchInputType;
  status: SearchStatus;
  results: SearchResultItem[];
  suggestedActions: string[];
  openingSentences: string[];
  warnings?: string[];
}

/**
 * Individual search result item
 */
export interface SearchResultItem {
  candidateType: CandidateType;
  candidateId: string;
  score: number;
  confidence: number;
  reasons: string[];
  snapshot: {
    name: string;
    title: string | null;
    company: string | null;
    location: string | null;
    avatarUrl: string | null;
    channels: { type: string; value: string }[];
  };
}

/**
 * Feedback input
 */
export interface FeedbackInput {
  requestId: string;
  confirmedCandidateId?: string;
  confirmedType?: CandidateType;
  rejectedCandidateIds?: string[];
  notes?: string;
}

/**
 * Redis cache interface (simplified)
 */
interface CacheService {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds: number): Promise<void>;
  del(key: string): Promise<void>;
}

/**
 * Find Contact Service
 */
export class FindContactService {
  private queryParser: QueryParserService;
  private candidateRetrieval: CandidateRetrievalService;
  private scoringService: ScoringService;
  private aiService: OpenAIExplanationService;
  private cache: CacheService | null = null;

  private readonly CACHE_TTL = 15 * 60; // 15 minutes
  private readonly MAX_RESULTS = 10;

  constructor(cache?: CacheService) {
    this.queryParser = new QueryParserService();
    this.candidateRetrieval = new CandidateRetrievalService();
    this.scoringService = new ScoringService();
    this.aiService = new OpenAIExplanationService();
    this.cache = cache || null;
  }

  /**
   * Main search function
   *
   * @param input - Search input parameters
   * @param userId - Searching user's ID
   * @returns Search results with scoring and opening sentences
   */
  async search(input: FindContactInput, userId: string): Promise<FindContactResult> {
    const startTime = Date.now();

    try {
      // Parse and normalize query
      const parsedQuery = this.queryParser.parse(
        input.query || null,
        input.imageUploadId,
        undefined, // imageHasText - determined by OCR pipeline
        input.consentFaceMatch
      );

      // Check cache
      const cacheKey = `find-contact:${userId}:${parsedQuery.hash}`;
      if (this.cache) {
        const cached = await this.cache.get(cacheKey);
        if (cached) {
          logger.debug('Cache hit for find-contact search', { cacheKey });
          return JSON.parse(cached);
        }
      }

      // Handle image input - requires async OCR
      if (parsedQuery.type === 'image') {
        return this.handleImageSearch(input, userId, parsedQuery);
      }

      // Retrieve candidates from database
      const candidates = await this.candidateRetrieval.retrieveCandidates(parsedQuery, userId);

      // Score and rank candidates
      const { candidates: scoredCandidates, status } = await this.scoringService.scoreCandidates(
        candidates,
        parsedQuery,
        userId
      );

      // Convert scoring status to Prisma enum
      const searchStatus = this.mapScoringStatus(status);

      // Generate opening sentences for top result
      let openingSentences: string[] = [];
      if (scoredCandidates.length > 0) {
        const userProfile = await this.getUserBasicProfile(userId);
        openingSentences = await this.generateOpeningSentences(
          input.intent,
          input.intentNote,
          scoredCandidates[0],
          userProfile
        );
      }

      // Determine suggested actions
      const suggestedActions = this.getSuggestedActions(searchStatus, input.intent, scoredCandidates);

      // Create request record
      const request = await prisma.contactSearchRequest.create({
        data: {
          userId,
          queryHash: parsedQuery.hash,
          inputType: this.mapInputType(parsedQuery.type),
          intent: input.intent,
          intentNote: input.intentNote,
          imageUploadId: input.imageUploadId,
          consentFaceMatch: input.consentFaceMatch || false,
          status: searchStatus,
          processingTimeMs: Date.now() - startTime,
          expiresAt: new Date(Date.now() + this.CACHE_TTL * 1000),
        },
      });

      // Store results
      const resultItems: SearchResultItem[] = [];
      for (const candidate of scoredCandidates.slice(0, this.MAX_RESULTS)) {
        await prisma.contactSearchResult.create({
          data: {
            requestId: request.id,
            candidateType: candidate.type,
            candidateId: candidate.id,
            score: candidate.score,
            confidence: candidate.confidence,
            reasons: candidate.reasons as unknown as Prisma.InputJsonValue,
            snapshot: candidate.snapshot as unknown as Prisma.InputJsonValue,
            rank: candidate.rank,
          },
        });

        resultItems.push({
          candidateType: candidate.type,
          candidateId: candidate.id,
          score: candidate.score,
          confidence: Number(candidate.confidence.toFixed(2)),
          reasons: candidate.reasons,
          snapshot: candidate.snapshot,
        });
      }

      const result: FindContactResult = {
        requestId: request.id,
        inputType: this.mapInputType(parsedQuery.type),
        status: searchStatus,
        results: resultItems,
        suggestedActions,
        openingSentences,
      };

      // Cache result
      if (this.cache) {
        await this.cache.set(cacheKey, JSON.stringify(result), this.CACHE_TTL);
      }

      return result;
    } catch (error) {
      logger.error('Find contact search failed', { error, userId, input });
      throw error;
    }
  }

  /**
   * Handle image-based search (OCR/face)
   */
  private async handleImageSearch(
    input: FindContactInput,
    userId: string,
    parsedQuery: ParsedQuery
  ): Promise<FindContactResult> {
    // Create pending request
    const request = await prisma.contactSearchRequest.create({
      data: {
        userId,
        queryHash: parsedQuery.hash,
        inputType: SearchInputType.IMAGE,
        intent: input.intent,
        intentNote: input.intentNote,
        imageUploadId: input.imageUploadId,
        imageMode: parsedQuery.parsed.imageMode,
        consentFaceMatch: input.consentFaceMatch || false,
        status: SearchStatus.PENDING_OCR,
        expiresAt: new Date(Date.now() + 30 * 60 * 1000), // 30 min for async
      },
    });

    // Queue OCR job (would use BullMQ in production)
    // await this.queueOcrJob(request.id, input.imageUploadId!);

    return {
      requestId: request.id,
      inputType: SearchInputType.IMAGE,
      status: SearchStatus.PENDING_OCR,
      results: [],
      suggestedActions: ['Processing image. Results will be available shortly.'],
      openingSentences: [],
      warnings: ['Image processing is in progress. Please check back in a few seconds.'],
    };
  }

  /**
   * Process OCR result and continue search
   */
  async processOcrResult(
    requestId: string,
    ocrText: string
  ): Promise<FindContactResult> {
    const request = await prisma.contactSearchRequest.findUnique({
      where: { id: requestId },
    });

    if (!request) {
      throw new Error('Request not found');
    }

    // Extract data from OCR text
    const extracted = this.queryParser.extractFromOcrText(ocrText);

    // Try to find matches with extracted data
    let candidates: RawCandidate[] = [];

    // Priority: email > phone > name
    if (extracted.emails.length > 0) {
      const emailQuery = this.queryParser.parse(extracted.emails[0]);
      candidates = await this.candidateRetrieval.retrieveCandidates(emailQuery, request.userId);
    }

    if (candidates.length === 0 && extracted.phones.length > 0) {
      const phoneQuery = this.queryParser.parse(extracted.phones[0]);
      candidates = await this.candidateRetrieval.retrieveCandidates(phoneQuery, request.userId);
    }

    if (candidates.length === 0 && extracted.names.length > 0) {
      const nameQuery = this.queryParser.parse(extracted.names[0]);
      candidates = await this.candidateRetrieval.retrieveCandidates(nameQuery, request.userId);
    }

    // Score candidates
    const { candidates: scoredCandidates, status } = await this.scoringService.scoreCandidates(
      candidates,
      this.queryParser.parse(extracted.names[0] || 'unknown'),
      request.userId
    );

    const searchStatus = this.mapScoringStatus(status);

    // Update request status
    await prisma.contactSearchRequest.update({
      where: { id: requestId },
      data: { status: searchStatus },
    });

    // Store results
    const resultItems: SearchResultItem[] = [];
    for (const candidate of scoredCandidates.slice(0, this.MAX_RESULTS)) {
      await prisma.contactSearchResult.create({
        data: {
          requestId,
          candidateType: candidate.type,
          candidateId: candidate.id,
          score: candidate.score,
          confidence: candidate.confidence,
          reasons: candidate.reasons as unknown as Prisma.InputJsonValue,
          snapshot: candidate.snapshot as unknown as Prisma.InputJsonValue,
          rank: candidate.rank,
        },
      });

      resultItems.push({
        candidateType: candidate.type,
        candidateId: candidate.id,
        score: candidate.score,
        confidence: Number(candidate.confidence.toFixed(2)),
        reasons: candidate.reasons,
        snapshot: candidate.snapshot,
      });
    }

    return {
      requestId,
      inputType: SearchInputType.IMAGE,
      status: searchStatus,
      results: resultItems,
      suggestedActions: this.getSuggestedActions(searchStatus, request.intent, scoredCandidates),
      openingSentences: [],
    };
  }

  /**
   * Get request status (for polling)
   */
  async getRequestStatus(requestId: string): Promise<FindContactResult | null> {
    const request = await prisma.contactSearchRequest.findUnique({
      where: { id: requestId },
    });

    if (!request) return null;

    const results = await prisma.contactSearchResult.findMany({
      where: { requestId },
      orderBy: { rank: 'asc' },
    });

    return {
      requestId: request.id,
      inputType: request.inputType,
      status: request.status,
      results: results.map(r => ({
        candidateType: r.candidateType,
        candidateId: r.candidateId,
        score: r.score,
        confidence: Number(r.confidence),
        reasons: r.reasons as string[],
        snapshot: r.snapshot as any,
      })),
      suggestedActions: [],
      openingSentences: [],
    };
  }

  /**
   * Submit feedback on search results
   */
  async submitFeedback(input: FeedbackInput, userId: string): Promise<void> {
    // Verify request belongs to user
    const request = await prisma.contactSearchRequest.findFirst({
      where: { id: input.requestId, userId },
    });

    if (!request) {
      throw new Error('Request not found');
    }

    // Create feedback record
    await prisma.contactSearchFeedback.create({
      data: {
        requestId: input.requestId,
        confirmedCandidateId: input.confirmedCandidateId,
        confirmedType: input.confirmedType,
        rejectedCandidates: input.rejectedCandidateIds,
        notes: input.notes,
      },
    });

    // Update boost patterns for confirmed match
    if (input.confirmedCandidateId && input.confirmedType) {
      const patternKey = `${input.confirmedType}:${input.confirmedCandidateId}`;

      await prisma.searchPatternBoost.upsert({
        where: {
          userId_patternType_patternValue: {
            userId,
            patternType: input.confirmedType,
            patternValue: input.confirmedCandidateId,
          },
        },
        update: {
          boostScore: { increment: 5 },
          confirmCount: { increment: 1 },
          lastUsedAt: new Date(),
        },
        create: {
          userId,
          patternType: input.confirmedType,
          patternValue: input.confirmedCandidateId,
          boostScore: 5,
          confirmCount: 1,
          lastUsedAt: new Date(),
        },
      });
    }
  }

  /**
   * Generate opening sentences using LLM
   */
  private async generateOpeningSentences(
    intent: SearchIntent,
    intentNote: string | undefined,
    candidate: ScoredCandidate,
    userProfile: { fullName: string; company: string | null; jobTitle: string | null } | null
  ): Promise<string[]> {
    try {
      const aiAvailable = await this.aiService.isAvailable();
      if (!aiAvailable) {
        return this.getFallbackOpeningSentences(intent, candidate);
      }

      const intentDescriptions: Record<SearchIntent, string> = {
        MEETING: 'schedule a meeting',
        COLLABORATION: 'explore collaboration opportunities',
        FOLLOW_UP: 'follow up on a previous conversation',
        SALES: 'discuss a business opportunity',
        SUPPORT: 'offer assistance or support',
        OTHER: 'connect professionally',
      };

      const prompt = `Generate 3 short, professional opening sentences for a networking message.

Context:
- Sender: ${userProfile?.fullName || 'A professional'}${userProfile?.jobTitle ? `, ${userProfile.jobTitle}` : ''}${userProfile?.company ? ` at ${userProfile.company}` : ''}
- Recipient: ${candidate.snapshot.name}${candidate.snapshot.title ? `, ${candidate.snapshot.title}` : ''}${candidate.snapshot.company ? ` at ${candidate.snapshot.company}` : ''}
- Intent: ${intentDescriptions[intent]}
${intentNote ? `- Additional context: ${intentNote}` : ''}
${candidate.reasons.length > 0 ? `- Connection points: ${candidate.reasons.join(', ')}` : ''}

Requirements:
- Each sentence should be 1-2 lines max
- Professional but friendly tone
- Reference shared context if available
- Do not make assumptions about the recipient beyond provided info
- If recipient name is unknown, use a generic greeting

Return exactly 3 sentences, one per line.`;

      const response = await this.aiService.generateText(prompt, {
        maxTokens: 200,
        temperature: 0.7,
      });

      if (!response) {
        return this.getFallbackOpeningSentences(intent, candidate);
      }

      // Parse response into sentences
      const sentences = response
        .split('\n')
        .map(s => s.trim())
        .filter(s => s.length > 0 && s.length < 200)
        .slice(0, 3);

      return sentences.length > 0 ? sentences : this.getFallbackOpeningSentences(intent, candidate);
    } catch (error) {
      logger.error('Failed to generate opening sentences', { error });
      return this.getFallbackOpeningSentences(intent, candidate);
    }
  }

  /**
   * Fallback opening sentences when LLM is unavailable
   */
  private getFallbackOpeningSentences(
    intent: SearchIntent,
    candidate: ScoredCandidate
  ): string[] {
    const name = candidate.snapshot.name || 'there';
    const firstName = name.split(' ')[0];

    const templates: Record<SearchIntent, string[]> = {
      MEETING: [
        `Hi ${firstName}, I'd love to schedule a brief call to connect.`,
        `Hello ${firstName}, would you be available for a quick meeting this week?`,
        `Hi ${firstName}, I'm reaching out to see if we could find time to chat.`,
      ],
      COLLABORATION: [
        `Hi ${firstName}, I came across your profile and see potential for collaboration.`,
        `Hello ${firstName}, I believe there might be synergies between our work.`,
        `Hi ${firstName}, I'd love to explore how we might work together.`,
      ],
      FOLLOW_UP: [
        `Hi ${firstName}, I wanted to follow up on our previous conversation.`,
        `Hello ${firstName}, I hope this message finds you well. Following up from before.`,
        `Hi ${firstName}, just circling back on our earlier discussion.`,
      ],
      SALES: [
        `Hi ${firstName}, I have a solution that might interest your team.`,
        `Hello ${firstName}, I'd like to share an opportunity that could benefit you.`,
        `Hi ${firstName}, I believe we can add value to your work.`,
      ],
      SUPPORT: [
        `Hi ${firstName}, I wanted to reach out to see how I can help.`,
        `Hello ${firstName}, I noticed we might have shared interests and wanted to connect.`,
        `Hi ${firstName}, please let me know if there's anything I can assist with.`,
      ],
      OTHER: [
        `Hi ${firstName}, I'd like to connect with you professionally.`,
        `Hello ${firstName}, I came across your profile and wanted to reach out.`,
        `Hi ${firstName}, I hope you don't mind me reaching out.`,
      ],
    };

    return templates[intent] || templates.OTHER;
  }

  /**
   * Get suggested actions based on search results
   */
  private getSuggestedActions(
    status: SearchStatus,
    intent: SearchIntent,
    candidates: ScoredCandidate[]
  ): string[] {
    const actions: string[] = [];

    switch (status) {
      case SearchStatus.HIGH_CONFIDENCE:
        actions.push('Review the top match and send a connection request');
        actions.push('Use the suggested opening to start the conversation');
        break;
      case SearchStatus.LIKELY:
        actions.push('Review the top 3 matches to identify the right person');
        actions.push('Consider providing additional details to narrow down results');
        break;
      case SearchStatus.UNCERTAIN:
        actions.push('Try adding company name or location to improve results');
        actions.push('Consider enriching the data with external sources');
        break;
      case SearchStatus.NO_MATCH:
        actions.push('Try a different search query');
        actions.push('Add this person as a new contact');
        break;
      default:
        actions.push('Please wait while we process your request');
    }

    return actions;
  }

  /**
   * Map scoring status to Prisma enum
   */
  private mapScoringStatus(status: ScoringStatus): SearchStatus {
    const mapping: Record<ScoringStatus, SearchStatus> = {
      HIGH_CONFIDENCE: SearchStatus.HIGH_CONFIDENCE,
      LIKELY: SearchStatus.LIKELY,
      UNCERTAIN: SearchStatus.UNCERTAIN,
      NO_MATCH: SearchStatus.NO_MATCH,
    };
    return mapping[status];
  }

  /**
   * Map input type to Prisma enum
   */
  private mapInputType(type: string): SearchInputType {
    const mapping: Record<string, SearchInputType> = {
      phone: SearchInputType.PHONE,
      email: SearchInputType.EMAIL,
      url: SearchInputType.URL,
      name: SearchInputType.NAME,
      image: SearchInputType.IMAGE,
    };
    return mapping[type] || SearchInputType.NAME;
  }

  /**
   * Get user's basic profile for context
   */
  private async getUserBasicProfile(userId: string): Promise<{
    fullName: string;
    company: string | null;
    jobTitle: string | null;
  } | null> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { fullName: true, company: true, jobTitle: true },
    });
    return user;
  }
}

export default FindContactService;
