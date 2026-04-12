/**
 * PNME Worker: Match Compute
 * Handles computing match scores between sections and contacts
 */

import { Job, Worker } from 'bullmq';
import { container } from 'tsyringe';
import {
  PitchJobStep,
  PitchJobStatus,
  PitchStatus,
  PitchSectionType,
  MatchAngleCategory,
  MatchReasonType,
  MatchReason,
  MatchBreakdown,
} from '../../../domain/entities/Pitch';
import {
  IPitchRepository,
  IPitchJobRepository,
  IPitchSectionRepository,
  IPitchMatchRepository,
  IContactProfileCacheRepository,
} from '../../../domain/repositories/IPitchRepository';
import {
  IEmbeddingService,
  IMatchExplainerService,
} from '../../../application/interfaces/IPitchAIService';
import { IPitchQueueService, MatchComputeJobData } from '../../../application/interfaces/IPitchQueueService';
import { ContactProfileDTO, MatchWeightsDTO } from '../../../application/dto/pitch.dto';
import { STRATEGIC_ROLE_KEYWORDS } from '../../services/pitch/PitchMatchingService';
import { logger } from '../../../shared/logger';
import { redisConnection, getRedisClient } from '../../database/redis/client.js';
import { registerOutreachBatch } from './pitchOutreach.worker.js';

const QUEUE_NAME = 'pitch-match-compute';
const MAX_MATCHES_PER_SECTION = 20;
const MIN_SCORE_THRESHOLD = 30;

const MATCH_TRACKER_PREFIX = 'pitch:match-batch:';
const MATCH_TRACKER_TTL = 3600; // 1 hour TTL

/**
 * Redis-based match batch tracker helper functions
 */
async function getMatchTracker(pitchId: string): Promise<{ total: number; completed: number } | null> {
  const redis = getRedisClient();
  if (!redis) return null;
  const key = `${MATCH_TRACKER_PREFIX}${pitchId}`;
  const data = await redis.get(key);
  return data ? JSON.parse(data) : null;
}

async function setMatchTracker(pitchId: string, data: { total: number; completed: number }): Promise<void> {
  const redis = getRedisClient();
  if (!redis) return;
  const key = `${MATCH_TRACKER_PREFIX}${pitchId}`;
  await redis.setex(key, MATCH_TRACKER_TTL, JSON.stringify(data));
}

async function deleteMatchTracker(pitchId: string): Promise<void> {
  const redis = getRedisClient();
  if (!redis) return;
  const key = `${MATCH_TRACKER_PREFIX}${pitchId}`;
  await redis.del(key);
}

/**
 * Atomically increment match completed count using Lua script
 */
async function incrementMatchCompleted(pitchId: string): Promise<{ total: number; completed: number } | null> {
  const redis = getRedisClient();
  if (!redis) return null;

  const key = `${MATCH_TRACKER_PREFIX}${pitchId}`;

  // Lua script for atomic increment
  const luaScript = `
    local data = redis.call('GET', KEYS[1])
    if not data then return nil end
    local tracker = cjson.decode(data)
    tracker.completed = tracker.completed + 1
    local newData = cjson.encode(tracker)
    redis.call('SETEX', KEYS[1], ARGV[1], newData)
    return newData
  `;

  try {
    const result = await redis.eval(luaScript, 1, key, MATCH_TRACKER_TTL.toString());
    return result ? JSON.parse(result as string) : null;
  } catch (error) {
    logger.error('Failed to increment match tracker', { pitchId, error });
    return null;
  }
}

/**
 * Create the match compute worker
 */
export function createMatchComputeWorker(): Worker {
  const worker = new Worker<MatchComputeJobData>(
    QUEUE_NAME,
    async (job: Job<MatchComputeJobData>) => {
      const { pitchId, sectionId, contactIds, weights } = job.data;

      logger.debug('Computing matches', { pitchId, sectionId, contactCount: contactIds.length });

      try {
        await computeMatches(pitchId, sectionId, contactIds, weights, job);
        await checkSectionCompletion(pitchId, sectionId);
      } catch (error) {
        logger.error('Match compute failed', { pitchId, sectionId, error });
        throw error;
      }
    },
    {
      connection: redisConnection,
      concurrency: 10,
      limiter: {
        max: 10,
        duration: 1000,
      },
    },
  );

  return worker;
}

/**
 * Compute matches for a section against contacts
 */
async function computeMatches(
  pitchId: string,
  sectionId: string,
  contactIds: string[],
  weights: MatchWeightsDTO,
  job: Job,
): Promise<void> {
  const sectionRepo = container.resolve<IPitchSectionRepository>('PitchSectionRepository');
  const profileCacheRepo = container.resolve<IContactProfileCacheRepository>('ContactProfileCacheRepository');
  const matchRepo = container.resolve<IPitchMatchRepository>('PitchMatchRepository');
  const embeddingService = container.resolve<IEmbeddingService>('EmbeddingService');
  const matchExplainer = container.resolve<IMatchExplainerService>('MatchExplainerService');

  // Get section
  const section = await sectionRepo.findById(sectionId);
  if (!section) throw new Error('Section not found');

  await job.updateProgress(10);

  // Generate section embedding if not exists
  let sectionEmbedding = section.embedding as number[] | null;
  if (!sectionEmbedding) {
    try {
      const embeddingResult = await embeddingService.generateEmbedding(section.content);
      sectionEmbedding = embeddingResult.embedding;
      await sectionRepo.updateEmbedding(sectionId, sectionEmbedding, embeddingResult.model);
    } catch (error) {
      logger.warn('Section embedding failed, using rule-based only', { sectionId });
    }
  }

  await job.updateProgress(30);

  // Get contact profiles
  const profiles = await Promise.all(
    contactIds.map((id) => profileCacheRepo.findByContactId(id)),
  );
  const validProfiles = profiles.filter((p): p is NonNullable<typeof p> => p !== null);

  await job.updateProgress(40);

  // Compute scores for each contact
  const matches: Array<{
    contactId: string;
    score: number;
    relevanceScore: number;
    expertiseScore: number;
    strategicScore: number;
    relationshipScore: number;
    breakdown: MatchBreakdown;
    reasons: MatchReason[];
    angleCategory: MatchAngleCategory;
  }> = [];

  for (let i = 0; i < validProfiles.length; i++) {
    const profile = validProfiles[i];

    // Compute component scores
    const relevanceScore = computeRelevanceScore(
      section,
      profile,
      sectionEmbedding,
      embeddingService,
    );
    const expertiseScore = computeExpertiseScore(section, profile);
    const strategicScore = computeStrategicScore(section, profile);
    const relationshipScore = computeRelationshipScore(profile);

    // Weighted final score
    const finalScore = Math.round(
      relevanceScore * weights.relevance +
      expertiseScore * weights.expertise +
      strategicScore * weights.strategic +
      relationshipScore * weights.relationship,
    );

    if (finalScore < MIN_SCORE_THRESHOLD) continue;

    // Build breakdown
    const breakdown: MatchBreakdown = {
      relevance: {
        score: relevanceScore,
        weight: weights.relevance,
        weighted: relevanceScore * weights.relevance,
        breakdown: {},
      },
      expertise: {
        score: expertiseScore,
        weight: weights.expertise,
        weighted: expertiseScore * weights.expertise,
        breakdown: {},
      },
      strategic: {
        score: strategicScore,
        weight: weights.strategic,
        weighted: strategicScore * weights.strategic,
        breakdown: {},
      },
      relationship: {
        score: relationshipScore,
        weight: weights.relationship,
        weighted: relationshipScore * weights.relationship,
        breakdown: {},
      },
    };

    // Generate reasons
    let reasons: MatchReason[];
    let angleCategory: MatchAngleCategory;

    try {
      const contactProfileDTO: ContactProfileDTO = {
        contactId: profile.contactId,
        userId: profile.userId,
        fullName: '', // Will be filled from contact data
        company: null,
        jobTitle: null,
        profileSummary: profile.profileSummary,
        sectors: profile.sectors,
        skills: profile.skills,
        interests: profile.interests,
        investorType: profile.investorType || undefined,
        investmentStage: profile.investmentStage || undefined,
        checkSize: profile.checkSize || undefined,
        relationshipStrength: profile.relationshipStrength,
        lastInteractionDays: profile.lastInteractionDays,
        interactionCount: profile.interactionCount,
      };

      const explainResult = await matchExplainer.generateMatchReasons(
        section.content,
        section.type,
        contactProfileDTO,
        { relevance: relevanceScore, expertise: expertiseScore, strategic: strategicScore, relationship: relationshipScore },
      );
      reasons = explainResult.reasons;
      angleCategory = explainResult.angleCategory;
    } catch (error) {
      // Fallback to rule-based
      const fallback = matchExplainer.generateMatchReasonsRuleBased(
        section.type,
        {
          contactId: profile.contactId,
          userId: profile.userId,
          fullName: '',
          company: null,
          jobTitle: null,
          profileSummary: profile.profileSummary,
          sectors: profile.sectors,
          skills: profile.skills,
          interests: profile.interests,
          relationshipStrength: profile.relationshipStrength,
          lastInteractionDays: profile.lastInteractionDays,
          interactionCount: profile.interactionCount,
        },
        { relevance: relevanceScore, expertise: expertiseScore, strategic: strategicScore, relationship: relationshipScore },
      );
      reasons = fallback.reasons;
      angleCategory = fallback.angleCategory;
    }

    matches.push({
      contactId: profile.contactId,
      score: finalScore,
      relevanceScore,
      expertiseScore,
      strategicScore,
      relationshipScore,
      breakdown,
      reasons,
      angleCategory,
    });

    // Update progress
    if (i % 10 === 0) {
      await job.updateProgress(40 + Math.floor((i / validProfiles.length) * 40));
    }
  }

  await job.updateProgress(80);

  // Sort by score and take top N
  matches.sort((a, b) => b.score - a.score);
  const topMatches = matches.slice(0, MAX_MATCHES_PER_SECTION);

  // Delete existing matches for this section
  await matchRepo.deleteBySectionId(sectionId);

  // Create match records
  if (topMatches.length > 0) {
    const matchInputs = topMatches.map((m) => ({
      pitchSectionId: sectionId,
      contactId: m.contactId,
      score: m.score,
      relevanceScore: m.relevanceScore,
      expertiseScore: m.expertiseScore,
      strategicScore: m.strategicScore,
      relationshipScore: m.relationshipScore,
      breakdownJson: m.breakdown as unknown as Record<string, unknown>,
      reasonsJson: m.reasons as unknown as Record<string, unknown>[],
      angleCategory: m.angleCategory,
    }));

    await matchRepo.createMany(matchInputs);
  }

  await job.updateProgress(100);
  logger.debug('Matches computed', { sectionId, matchCount: topMatches.length });
}

/**
 * Section-specific relevance keywords (aligned with PitchMatchingService)
 */
const SECTION_RELEVANCE_KEYWORDS: Record<string, string[]> = {
  PROBLEM: ['research', 'analyst', 'consulting', 'industry expert', 'customer insight'],
  SOLUTION: ['product', 'engineering', 'development', 'technical', 'architecture'],
  MARKET: ['market research', 'strategy', 'industry', 'go-to-market', 'sales'],
  BUSINESS_MODEL: ['finance', 'business development', 'pricing', 'monetization', 'revenue'],
  TRACTION: ['growth', 'marketing', 'sales', 'customer success', 'metrics'],
  TECHNOLOGY: ['engineering', 'cto', 'architect', 'ai', 'ml', 'data science', 'devops'],
  TEAM: ['hr', 'recruiting', 'talent', 'leadership', 'coaching', 'mentoring'],
  INVESTMENT_ASK: ['investor', 'vc', 'angel', 'fund', 'capital', 'finance'],
  EXECUTIVE_SUMMARY: ['investor', 'partner', 'advisor', 'engineering', 'product', 'strategy', 'marketing', 'sales', 'finance', 'development', 'consulting', 'growth', 'technical', 'business development', 'operations', 'industry', 'research', 'data', 'design', 'management'],
  OTHER: ['general', 'business', 'strategy', 'operations'],
};

/**
 * Compute relevance score (semantic + keyword matching)
 * Unified with PitchMatchingService.calculateRelevanceScore:
 *   - When embeddings available: 30% semantic + 70% combined keyword
 *   - Combined keyword = 40% section keywords + 60% content-based matching
 */
function computeRelevanceScore(
  section: { content: string; type: PitchSectionType; inferredSectors?: string[] | null; keywords?: string[] | null },
  profile: { embedding?: number[] | null; sectors: string[]; skills?: string[]; keywords?: string[] | null; profileSummary?: string },
  sectionEmbedding: number[] | null,
  embeddingService: IEmbeddingService,
): number {
  let semanticScore = 0;
  let keywordScore = 0;

  // Semantic similarity (if embeddings available)
  if (sectionEmbedding && profile.embedding) {
    const similarity = embeddingService.cosineSimilarity(sectionEmbedding, profile.embedding);
    semanticScore = Math.max(0, similarity) * 100;
  }

  // Keyword matching (static section keywords)
  const sectionKeywords = SECTION_RELEVANCE_KEYWORDS[section.type] || SECTION_RELEVANCE_KEYWORDS['OTHER'];
  const profileText = `${profile.profileSummary || ''} ${profile.sectors.join(' ')} ${(profile.skills || []).join(' ')}`.toLowerCase();

  let keywordMatches = 0;
  for (const keyword of sectionKeywords) {
    if (profileText.includes(keyword.toLowerCase())) {
      keywordMatches++;
    }
  }
  keywordScore = Math.min(100, (keywordMatches / sectionKeywords.length) * 150);

  // Content-based matching: extract significant words from section content
  const stopWords = ['this', 'that', 'with', 'from', 'have', 'will', 'what', 'your', 'they', 'their', 'been', 'more', 'also', 'into', 'than', 'each', 'make', 'like', 'just', 'over', 'such', 'some', 'when', 'very', 'need', 'looking', 'title', 'company', 'investment', 'timeline'];
  const contentWords = section.content.toLowerCase()
    .split(/[\s,.\-;:!?()/]+/)
    .filter(w => w.length > 3)
    .filter(w => !stopWords.includes(w));
  const uniqueContentWords = [...new Set(contentWords)];
  let contentMatches = 0;
  for (const word of uniqueContentWords.slice(0, 50)) {
    if (profileText.includes(word)) {
      contentMatches++;
    }
  }
  const contentScore = uniqueContentWords.length > 0
    ? Math.min(100, (contentMatches / Math.min(uniqueContentWords.length, 50)) * 200)
    : 0;

  // Combine: keyword (40%) + content (60%)
  const combinedKeywordScore = Math.round(keywordScore * 0.4 + contentScore * 0.6);

  // Combine with semantic if available
  if (sectionEmbedding && profile.embedding) {
    return Math.round(semanticScore * 0.3 + combinedKeywordScore * 0.7);
  }

  return combinedKeywordScore;
}

/**
 * Compute expertise score
 */
function computeExpertiseScore(
  section: { type: PitchSectionType; inferredSkills?: string[] | null },
  profile: { skills: string[]; investorType?: string | null },
): number {
  let score = 0;

  // Skill match (50%)
  const requiredSkills = section.inferredSkills || [];
  const skillOverlap = computeOverlap(requiredSkills, profile.skills);
  score += skillOverlap * 0.5;

  // Section-specific expertise (50%)
  const sectionRelevance = getSectionExpertiseRelevance(section.type, profile);
  score += sectionRelevance * 0.5;

  return Math.min(100, score);
}

/**
 * Compute strategic value score
 */
function computeStrategicScore(
  section: { type: PitchSectionType },
  profile: { investorType?: string | null; investmentStage?: string | null; checkSize?: string | null; jobTitle?: string | null },
): number {
  let score = 30; // Base score (aligned with service)

  // Job title scoring using STRATEGIC_ROLE_KEYWORDS
  if (profile.jobTitle) {
    const titleLower = profile.jobTitle.toLowerCase();
    for (const [keyword, value] of Object.entries(STRATEGIC_ROLE_KEYWORDS)) {
      if (titleLower.includes(keyword)) {
        score = Math.max(score, value);
        break;
      }
    }
  }

  // Investor fit bonus for Investment Ask section
  if (section.type === PitchSectionType.INVESTMENT_ASK) {
    if (profile.investorType) score += 30;
    if (profile.investmentStage) score += 15;
    if (profile.checkSize) score += 15;
  }

  // Market/Business section bonus
  if (
    section.type === PitchSectionType.MARKET ||
    section.type === PitchSectionType.BUSINESS_MODEL
  ) {
    score += 20;
  }

  return Math.min(100, score);
}

/**
 * Compute relationship strength score
 */
function computeRelationshipScore(
  profile: { relationshipStrength: number; lastInteractionDays?: number | null; interactionCount: number },
): number {
  let score = profile.relationshipStrength;

  // Boost for recent interaction
  if (profile.lastInteractionDays !== null && profile.lastInteractionDays !== undefined) {
    if (profile.lastInteractionDays <= 7) {
      score += 20;
    } else if (profile.lastInteractionDays <= 30) {
      score += 15;
    } else if (profile.lastInteractionDays <= 90) {
      score += 10;
    } else if (profile.lastInteractionDays <= 180) {
      score += 5;
    }
  }

  // Boost for interaction count
  if (profile.interactionCount > 10) {
    score += 15;
  } else if (profile.interactionCount > 5) {
    score += 10;
  } else if (profile.interactionCount > 2) {
    score += 5;
  }

  return Math.min(100, Math.round(score));
}

/**
 * Compute overlap percentage between two arrays
 */
function computeOverlap(arr1: string[], arr2: string[]): number {
  if (arr1.length === 0 || arr2.length === 0) return 0;

  const set1 = new Set(arr1.map((s) => s.toLowerCase()));
  const set2 = new Set(arr2.map((s) => s.toLowerCase()));

  let matches = 0;
  for (const item of set1) {
    if (set2.has(item)) matches++;
  }

  return (matches / Math.max(set1.size, set2.size)) * 100;
}

/**
 * Compute Jaccard similarity
 */
function computeJaccardSimilarity(set1: Set<string>, set2: Set<string>): number {
  const intersection = new Set([...set1].filter((x) => set2.has(x)));
  const union = new Set([...set1, ...set2]);

  if (union.size === 0) return 0;
  return (intersection.size / union.size) * 100;
}

/**
 * Get expertise relevance for a section type
 */
function getSectionExpertiseRelevance(
  sectionType: PitchSectionType,
  profile: { investorType?: string | null },
): number {
  const typeScores: Record<PitchSectionType, number> = {
    [PitchSectionType.PROBLEM]: 60,
    [PitchSectionType.SOLUTION]: 70,
    [PitchSectionType.MARKET]: 65,
    [PitchSectionType.BUSINESS_MODEL]: 70,
    [PitchSectionType.TRACTION]: 75,
    [PitchSectionType.TECHNOLOGY]: 80,
    [PitchSectionType.TEAM]: 60,
    [PitchSectionType.INVESTMENT_ASK]: profile.investorType ? 90 : 50,
    [PitchSectionType.OTHER]: 40,
  };

  return typeScores[sectionType] || 50;
}

/**
 * Check if all sections for a pitch are complete
 */
async function checkSectionCompletion(pitchId: string, sectionId: string): Promise<void> {
  const tracker = await incrementMatchCompleted(pitchId);

  if (!tracker) return;

  if (tracker.completed >= tracker.total) {
    // All sections matched, trigger outreach generation
    const jobRepo = container.resolve<IPitchJobRepository>('PitchJobRepository');
    const pitchRepo = container.resolve<IPitchRepository>('PitchRepository');
    const sectionRepo = container.resolve<IPitchSectionRepository>('PitchSectionRepository');
    const matchRepo = container.resolve<IPitchMatchRepository>('PitchMatchRepository');
    const profileCacheRepo = container.resolve<IContactProfileCacheRepository>('ContactProfileCacheRepository');
    const pitchQueue = container.resolve<IPitchQueueService>('PitchQueueService');

    // Mark matching complete
    await jobRepo.updateByPitchIdAndStep(pitchId, PitchJobStep.COMPUTE_MATCHES, {
      status: PitchJobStatus.COMPLETED,
      progress: 100,
      completedAt: new Date(),
    });

    // Update pitch status
    await pitchRepo.update(pitchId, { status: PitchStatus.GENERATING });

    // Get all matches for outreach generation
    const sections = await sectionRepo.findByPitchId(pitchId);

    // First pass: collect all matches and profiles
    const outreachJobs: Array<{
      matchId: string;
      sectionContent: string;
      profile: ContactProfileDTO;
      reasons: MatchReason[];
    }> = [];

    for (const section of sections) {
      const matches = await matchRepo.findByPitchSectionId(section.id, { limit: 10 });

      for (const match of matches) {
        const profile = await profileCacheRepo.findByContactId(match.contactId);
        if (!profile) continue;

        outreachJobs.push({
          matchId: match.id,
          sectionContent: section.content,
          profile: {
            contactId: profile.contactId,
            userId: profile.userId,
            fullName: '',
            company: null,
            jobTitle: null,
            profileSummary: profile.profileSummary,
            sectors: profile.sectors,
            skills: profile.skills,
            interests: profile.interests,
            relationshipStrength: profile.relationshipStrength,
            lastInteractionDays: profile.lastInteractionDays,
            interactionCount: profile.interactionCount,
          },
          reasons: match.reasonsJson as MatchReason[],
        });
      }
    }

    // Update GENERATE_OUTREACH job status to PROCESSING
    await jobRepo.updateByPitchIdAndStep(pitchId, PitchJobStep.GENERATE_OUTREACH, {
      status: PitchJobStatus.PROCESSING,
      startedAt: new Date(),
    });

    // Register outreach batch tracker before enqueuing jobs
    if (outreachJobs.length > 0) {
      await registerOutreachBatch(pitchId, outreachJobs.length);

      // Second pass: enqueue all outreach jobs
      for (const job of outreachJobs) {
        await pitchQueue.enqueueGenerateOutreach(
          job.matchId,
          job.sectionContent,
          job.profile,
          job.reasons,
          'professional',
        );
      }
    } else {
      // No matches to generate outreach for, mark as complete
      await jobRepo.updateByPitchIdAndStep(pitchId, PitchJobStep.GENERATE_OUTREACH, {
        status: PitchJobStatus.COMPLETED,
        progress: 100,
        completedAt: new Date(),
      });
      await pitchRepo.update(pitchId, {
        status: PitchStatus.COMPLETED,
        processedAt: new Date(),
      });
    }

    // Cleanup tracker
    await deleteMatchTracker(pitchId);

    logger.info('All matches computed, outreach generation started', {
      pitchId,
      outreachJobCount: outreachJobs.length,
    });
  }
}

/**
 * Register section batch for tracking (uses Redis for persistence)
 */
export async function registerMatchBatch(pitchId: string, total: number): Promise<void> {
  await setMatchTracker(pitchId, { total, completed: 0 });
  logger.debug('Registered match batch tracker', { pitchId, total });
}
