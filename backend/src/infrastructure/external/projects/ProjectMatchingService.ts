/**
 * Project Matching Service
 *
 * AI-powered service that matches collaboration projects with potential partners.
 * Supports multiple LLM providers: OpenAI, Groq, and Gemini.
 *
 * Pipeline:
 * 1. Extract keywords from project (LLM)
 * 2. Find candidate users/contacts (Database)
 * 3. Score and rank (Deterministic + optional Recombee)
 * 4. Rerank top results (optional Cohere)
 * 5. Generate explanations (LLM)
 *
 * @module infrastructure/external/projects/ProjectMatchingService
 */

import { PrismaClient, Project, User, Contact, ProjectMatch, ProjectStage, ProjectVisibility, ProjectMatchStatus } from '@prisma/client';
import { logger } from '../../../shared/logger';
import { skillTaxonomyService } from '../../services/taxonomy';
import { embeddingService } from '../embedding/EmbeddingService';
import { cosineSimilarity } from '../../../shared/matching';
import { OpenAIExplanationService } from '../explanation/OpenAIExplanationService';
import { RecombeeService } from '../recommendation/RecombeeService';
import { CohereRerankService, formatContactForRerank } from '../rerank/CohereRerankService';
import { cacheService, CACHE_KEYS, CACHE_TTL } from '../../cache/CacheService';
import { neo4jGraphService } from '../../database/neo4j/GraphService';
import { LLMService } from '../../../shared/llm';

const PROJECT_SYSTEM_PROMPT = 'You are a business collaboration assistant that helps match people with project opportunities. Be concise and professional. Always respond with valid JSON.';

/**
 * Candidate for matching
 */
interface MatchCandidate {
  type: 'user' | 'contact';
  id: string;
  name: string;
  company?: string | null;
  jobTitle?: string | null;
  bio?: string | null;
  sectors: string[];
  skills: string[];
  interests: string[];
  hobbies: string[];
}

/**
 * Scoring result for a candidate
 */
interface ScoringResult {
  candidate: MatchCandidate;
  score: number;
  sharedSectors: string[];
  sharedSkills: string[];
  sharedInterests: string[];
  sharedHobbies: string[];
}

/**
 * Match with explanation
 */
interface MatchWithExplanation extends ScoringResult {
  reasons: string[];
  suggestedAction: string;
  suggestedMessage: string;
}

/**
 * Configuration for matching behavior
 */
interface MatchingConfig {
  /** Boost factor for contacts (they're already in user's network). Default: 0.20 (20%) */
  contactBoostFactor: number;
  /** Maximum points a contact can gain from the boost. Default: 10 */
  contactBoostMaxPoints: number;
}

const DEFAULT_MATCHING_CONFIG: MatchingConfig = {
  contactBoostFactor: 0.20,
  contactBoostMaxPoints: 10,
};

/**
 * Project Matching Service
 */
export class ProjectMatchingService {
  private prisma: PrismaClient;
  private llmService: LLMService;
  private explanationService: OpenAIExplanationService;
  private recombeeService: RecombeeService;
  private cohereService: CohereRerankService;
  private useRecombee: boolean = false;
  private useCohere: boolean = false;
  private initPromise: Promise<void>;
  private matchingConfig: MatchingConfig;

  constructor(prisma: PrismaClient, matchingConfig?: Partial<MatchingConfig>) {
    this.prisma = prisma;
    this.matchingConfig = { ...DEFAULT_MATCHING_CONFIG, ...matchingConfig };
    this.llmService = new LLMService(PROJECT_SYSTEM_PROMPT);
    this.explanationService = new OpenAIExplanationService();
    this.recombeeService = new RecombeeService();
    this.cohereService = new CohereRerankService();

    // Check service availability (stored as promise to await before first use)
    this.initPromise = this.initializeOptionalServices();

    const provider = this.llmService.getActiveProvider();
    const providerConfig = this.llmService.getProviderConfig();
    if (provider !== 'none' && providerConfig) {
      logger.info(`Project matching service configured with ${provider}`, {
        provider,
        model: providerConfig.model,
      });
    } else {
      logger.warn('No LLM provider configured for project matching - will use deterministic only');
    }
  }

  /**
   * Initialize optional services (Recombee, Cohere)
   */
  private async initializeOptionalServices(): Promise<void> {
    try {
      this.useRecombee = await this.recombeeService.isAvailable();
      if (this.useRecombee) {
        logger.info('Recombee service available for project matching');
      }
    } catch {
      this.useRecombee = false;
    }

    try {
      this.useCohere = await this.cohereService.isAvailable();
      if (this.useCohere) {
        logger.info('Cohere rerank service available for project matching');
      }
    } catch {
      this.useCohere = false;
    }
  }

  /**
   * Get the currently active provider name
   */
  getActiveProvider(): string {
    return this.llmService.getActiveProvider();
  }

  /**
   * Main matching function - finds and scores matches for a project
   */
  async findMatchesForProject(projectId: string, userId: string, organizationId?: string): Promise<ProjectMatch[]> {
    // Ensure optional services (Recombee, Cohere) have finished initializing
    await this.initPromise;

    logger.info('Starting project matching', { projectId, userId, organizationId });

    // 1. Get the project with sectors and skills
    const project = await this.getProjectWithDetails(projectId);
    if (!project) {
      throw new Error('Project not found');
    }

    if (project.userId !== userId) {
      throw new Error('Unauthorized access to project');
    }

    // 2. Extract keywords if not already done
    if (!project.keywords || (project.keywords as string[]).length === 0) {
      const keywords = await this.extractProjectKeywords(project);
      await this.prisma.project.update({
        where: { id: projectId },
        data: { keywords },
      });
      (project as any).keywords = keywords;
    }

    // 2.5. Sync project to Neo4j (non-blocking)
    this.syncProjectToNeo4j(project).catch(err => {
      logger.warn('Failed to sync project to Neo4j', { projectId, error: err });
    });

    // 3. Find candidates
    const userCandidates = await this.findUserCandidates(project, userId);
    const contactCandidates = await this.findContactCandidates(project, userId, organizationId);
    const allCandidates = [...userCandidates, ...contactCandidates];

    logger.info('Found candidates', {
      projectId,
      userCandidates: userCandidates.length,
      contactCandidates: contactCandidates.length,
    });

    // 4. Score candidates (deterministic + semantic)
    let scoredCandidates = await this.scoreAllCandidates(project, allCandidates);

    // 4.5. Enhance scores with Recombee ML (3.5) - if available
    scoredCandidates = await this.scoreWithRecombee(project, userId, scoredCandidates);

    // 4.6. Rerank with Cohere (3.6) - if available
    scoredCandidates = await this.rerankWithCohere(project, scoredCandidates, 30);

    // 5. Take top candidates and generate explanations
    const topCandidates = scoredCandidates.slice(0, 30);
    const matchesWithExplanations = await this.generateMatchExplanations(project, topCandidates);

    // 6. Save matches to database
    const savedMatches = await this.saveMatches(projectId, matchesWithExplanations);

    // 6.5. Invalidate cached project matches
    await cacheService.invalidateProjectMatchCache(projectId);

    logger.info('Project matching completed', {
      projectId,
      totalMatches: savedMatches.length,
      usedRecombee: this.useRecombee,
      usedCohere: this.useCohere,
    });

    return savedMatches;
  }

  /**
   * Sync project to Neo4j graph database
   */
  private async syncProjectToNeo4j(
    project: Awaited<ReturnType<typeof this.getProjectWithDetails>>
  ): Promise<void> {
    if (!project) return;

    // Upsert project node
    await neo4jGraphService.upsertProject(project.id, project.userId, {
      title: project.title,
      summary: project.summary,
      category: project.category,
      stage: project.stage,
    });

    // Link to sectors
    for (const ps of project.sectors) {
      await neo4jGraphService.linkProjectToSector(project.id, ps.sectorId);
    }

    // Link to skills
    for (const ps of project.skillsNeeded) {
      await neo4jGraphService.linkProjectToSkill(project.id, ps.skillId, ps.importance);
    }

    logger.debug('Project synced to Neo4j', { projectId: project.id });
  }

  /**
   * Get project with all related data
   */
  private async getProjectWithDetails(projectId: string) {
    return this.prisma.project.findUnique({
      where: { id: projectId },
      include: {
        sectors: {
          include: { sector: true },
        },
        skillsNeeded: {
          include: { skill: true },
        },
        user: {
          include: {
            userSectors: { include: { sector: true } },
            userSkills: { include: { skill: true } },
            userInterests: { include: { interest: true } },
            userHobbies: { include: { hobby: true } },
          },
        },
      },
    });
  }

  /**
   * Extract semantic keywords from project description using LLM
   */
  async extractProjectKeywords(project: { title: string; summary: string; detailedDesc?: string | null }): Promise<string[]> {
    if (!this.llmService.isAvailable()) {
      return this.extractKeywordsFallback(project);
    }

    const prompt = `
Extract 5-10 semantic keywords/phrases from this business project that would help find relevant collaborators.
Focus on: industry terms, skills needed, business activities, target markets.

Project Title: ${project.title}
Summary: ${project.summary}
${project.detailedDesc ? `Details: ${project.detailedDesc}` : ''}

Respond with a JSON array of keywords only:
["keyword1", "keyword2", ...]
    `.trim();

    try {
      let content: string;
      content = await this.callLLM(prompt);

      // Parse keywords from response
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const keywords = JSON.parse(jsonMatch[0]);
        return Array.isArray(keywords) ? keywords.slice(0, 10) : [];
      }
    } catch (error) {
      logger.error('Failed to extract keywords with LLM', { error });
    }

    return this.extractKeywordsFallback(project);
  }

  /**
   * Fallback keyword extraction without LLM
   */
  private extractKeywordsFallback(project: { title: string; summary: string; detailedDesc?: string | null }): string[] {
    const text = `${project.title} ${project.summary} ${project.detailedDesc || ''}`.toLowerCase();
    const words = text.split(/\s+/);
    const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must', 'can', 'this', 'that', 'these', 'those', 'i', 'we', 'you', 'he', 'she', 'it', 'they', 'my', 'our', 'your', 'his', 'her', 'its', 'their']);

    const wordFreq: Record<string, number> = {};
    for (const word of words) {
      const cleaned = word.replace(/[^a-z]/g, '');
      if (cleaned.length > 3 && !stopWords.has(cleaned)) {
        wordFreq[cleaned] = (wordFreq[cleaned] || 0) + 1;
      }
    }

    return Object.entries(wordFreq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([word]) => word);
  }

  /**
   * Find user candidates based on overlapping sectors/skills
   */
  private async findUserCandidates(
    project: Awaited<ReturnType<typeof this.getProjectWithDetails>>,
    excludeUserId: string
  ): Promise<MatchCandidate[]> {
    if (!project) return [];

    const projectSectorIds = project.sectors.map(ps => ps.sectorId);
    const projectSkillIds = project.skillsNeeded.map(ps => ps.skillId);

    // Find users with overlapping sectors or skills
    const users = await this.prisma.user.findMany({
      where: {
        id: { not: excludeUserId },
        isActive: true,
        OR: [
          { userSectors: { some: { sectorId: { in: projectSectorIds } } } },
          { userSkills: { some: { skillId: { in: projectSkillIds } } } },
        ],
      },
      include: {
        userSectors: { include: { sector: true } },
        userSkills: { include: { skill: true } },
        userInterests: { include: { interest: true } },
        userHobbies: { include: { hobby: true } },
      },
      take: 100,
    });

    return users.map(user => ({
      type: 'user' as const,
      id: user.id,
      name: user.fullName,
      company: user.company,
      jobTitle: user.jobTitle,
      bio: user.bio,
      sectors: user.userSectors.map(us => us.sector.name),
      skills: user.userSkills.map(us => us.skill.name),
      interests: user.userInterests.map(ui => ui.interest.name),
      hobbies: user.userHobbies.map(uh => uh.hobby.name),
    }));
  }

  /**
   * Find contact candidates from user's network
   * Now searches ALL contacts and uses flexible matching based on:
   * - Sector/skill database matches
   * - Custom sectors/skills stored as text
   * - Bio, job title, and company keyword matching
   */
  private async findContactCandidates(
    project: Awaited<ReturnType<typeof this.getProjectWithDetails>>,
    userId: string,
    organizationId?: string
  ): Promise<MatchCandidate[]> {
    if (!project) return [];

    // Get ALL contacts from the user's network
    // Scope by organization context when organizationId is provided
    const contactWhere = organizationId
      ? { organizationId }
      : { ownerId: userId };

    const contacts = await this.prisma.contact.findMany({
      where: contactWhere,
      include: {
        contactSectors: { include: { sector: true } },
        contactSkills: { include: { skill: true } },
        contactInterests: { include: { interest: true } },
        contactHobbies: { include: { hobby: true } },
      },
      take: 200, // Increased limit to get more contacts
    });

    logger.info('Found contacts for project matching', {
      userId,
      organizationId,
      totalContacts: contacts.length,
    });

    return contacts.map(contact => ({
      type: 'contact' as const,
      id: contact.id,
      name: contact.fullName,
      company: contact.company,
      jobTitle: contact.jobTitle,
      bio: contact.bio,
      sectors: contact.contactSectors.map(cs => cs.sector.name),
      skills: contact.contactSkills.map(cs => cs.skill.name),
      interests: contact.contactInterests.map(ci => ci.interest.name),
      hobbies: contact.contactHobbies.map(ch => ch.hobby.name),
    }));
  }

  /**
   * Score all candidates using deterministic algorithm
   *
   * Weights:
   * - Skill overlap: 25 points max (most important for collaboration)
   * - Sector overlap: 15 points max
   * - Semantic embedding similarity: 15 points max
   * - Interest overlap with owner: 10 points max (rapport building)
   * - Hobby overlap with owner: 5 points max (rapport building)
   * - Bio/title keyword match: ~20 points
   * - Looking-for type match: 10 points
   */
  private async scoreAllCandidates(
    project: Awaited<ReturnType<typeof this.getProjectWithDetails>>,
    candidates: MatchCandidate[]
  ): Promise<ScoringResult[]> {
    if (!project) return [];

    const projectSectors = new Set(project.sectors.map(ps => ps.sector.name.toLowerCase()));
    const projectSkills = new Set(project.skillsNeeded.map(ps => ps.skill.name.toLowerCase()));
    const rawKeywords = project.keywords;
    const parsedKeywords: string[] = Array.isArray(rawKeywords) ? rawKeywords : typeof rawKeywords === 'string' ? (() => { try { const p = JSON.parse(rawKeywords); return Array.isArray(p) ? p : []; } catch { return []; } })() : [];
    const projectKeywords = new Set(parsedKeywords.map(k => typeof k === 'string' ? k.toLowerCase() : ''));
    const rawLookingFor = project.lookingFor;
    const lookingFor: string[] = Array.isArray(rawLookingFor) ? rawLookingFor : typeof rawLookingFor === 'string' ? (() => { try { const p = JSON.parse(rawLookingFor); return Array.isArray(p) ? p : []; } catch { return []; } })() : [];

    // Get project owner's interests and hobbies for rapport matching
    const ownerInterests = new Set(
      (project.user?.userInterests || []).map((ui: any) => ui.interest.name.toLowerCase())
    );
    const ownerHobbies = new Set(
      (project.user?.userHobbies || []).map((uh: any) => uh.hobby.name.toLowerCase())
    );

    // Pre-generate project embedding for semantic scoring (if available)
    let projectEmbedding: number[] | null = null;
    if (embeddingService.isAvailable() && project) {
      try {
        const projectText = [project.title, project.summary, project.detailedDesc || '', ...(project.keywords as string[] || [])].filter(Boolean).join('. ');
        const embedResult = await embeddingService.generateProfileEmbedding({
          id: `project:${project.id}`,
          type: 'user',
          bio: projectText,
          skills: project.skillsNeeded.map(ps => ps.skill.name),
          sectors: project.sectors.map(ps => ps.sector.name),
        });
        projectEmbedding = embedResult?.embedding || null;
      } catch (error) {
        logger.debug('Failed to generate project embedding for semantic scoring', { error });
      }
    }

    const scoredResults: ScoringResult[] = [];

    for (const candidate of candidates) {
      let score = 0;

      // Sector overlap (15 points max)
      const candidateSectors = new Set(candidate.sectors.map(s => s.toLowerCase()));
      const sharedSectors = [...projectSectors].filter(s => candidateSectors.has(s));
      score += Math.min(sharedSectors.length * 5, 15);

      // Skill overlap (25 points max) - enhanced with taxonomy
      let sharedSkills: string[];
      if (skillTaxonomyService.isAvailable() && projectSkills.size > 0 && candidate.skills.length > 0) {
        const projectSkillArr = [...projectSkills];
        const taxonomyResult = skillTaxonomyService.calculateSkillScore(
          projectSkillArr,
          candidate.skills.map(s => s.toLowerCase())
        );
        // Use taxonomy score scaled to 25 points
        score += Math.min(Math.round(taxonomyResult.score * 0.25), 25);
        sharedSkills = taxonomyResult.matches.map(m => m.targetSkill);
      } else {
        const candidateSkills = new Set(candidate.skills.map(s => s.toLowerCase()));
        sharedSkills = [...projectSkills].filter(s => candidateSkills.has(s));
        score += Math.min(sharedSkills.length * 7, 25);
      }

      // Semantic embedding similarity (15 points max)
      if (projectEmbedding) {
        try {
          const semanticText = [candidate.bio || '', candidate.jobTitle || '', candidate.company || '', ...candidate.skills, ...candidate.sectors, ...candidate.interests].filter(Boolean).join('. ');
          if (semanticText.length > 10) {
            const candidateEmbed = await embeddingService.generateProfileEmbedding({
              id: candidate.id,
              type: candidate.type === 'user' ? 'user' : 'contact',
              bio: semanticText,
              skills: candidate.skills,
              sectors: candidate.sectors,
            });
            if (candidateEmbed) {
              const similarity = cosineSimilarity(projectEmbedding, candidateEmbed.embedding);
              const semanticPoints = Math.round(Math.max(0, similarity) * 15);
              score += Math.min(semanticPoints, 15);
            }
          }
        } catch (error) {
          logger.debug('Failed to calculate semantic similarity for candidate', { candidateId: candidate.id, error });
        }
      }

      // Interest overlap with project owner (10 points max) - rapport building
      const candidateInterests = new Set(candidate.interests.map(i => i.toLowerCase()));
      const sharedInterests = [...ownerInterests].filter(i => candidateInterests.has(i));
      score += Math.min(sharedInterests.length * 5, 10);

      // Hobby overlap with project owner (5 points max) - rapport building
      const candidateHobbies = new Set(candidate.hobbies.map(h => h.toLowerCase()));
      const sharedHobbies = [...ownerHobbies].filter(h => candidateHobbies.has(h));
      score += Math.min(sharedHobbies.length * 5, 5);

      // Bio/job title/company keyword match (~20 points) - Increased for better contact matching
      const candidateText = `${candidate.bio || ''} ${candidate.jobTitle || ''} ${candidate.company || ''} ${candidate.sectors.join(' ')} ${candidate.skills.join(' ')}`.toLowerCase();
      let keywordBonus = 0;
      for (const keyword of projectKeywords) {
        if (candidateText.includes(keyword)) {
          keywordBonus += 3;
        }
      }
      // Also match project title and summary words
      const projectWords = `${project?.title || ''} ${project?.summary || ''}`.toLowerCase().split(/\s+/);
      for (const word of projectWords) {
        if (word.length > 4 && candidateText.includes(word)) {
          keywordBonus += 1;
        }
      }
      score += Math.min(keywordBonus, 20);

      // Looking for type match (10 points)
      if (lookingFor.length > 0 && candidate.jobTitle) {
        const jobTitleLower = candidate.jobTitle.toLowerCase();
        if (lookingFor.includes('investor') && (jobTitleLower.includes('investor') || jobTitleLower.includes('venture'))) {
          score += 10;
        }
        if (lookingFor.includes('technical_partner') && (jobTitleLower.includes('engineer') || jobTitleLower.includes('developer') || jobTitleLower.includes('technical'))) {
          score += 10;
        }
        if (lookingFor.includes('advisor') && (jobTitleLower.includes('advisor') || jobTitleLower.includes('mentor') || jobTitleLower.includes('consultant'))) {
          score += 10;
        }
      }

      // Contacts get a graduated boost proportional to their score (they're already in user's network)
      if (candidate.type === 'contact' && score > 0) {
        score += Math.min(
          Math.round(score * this.matchingConfig.contactBoostFactor),
          this.matchingConfig.contactBoostMaxPoints
        );
      }

      // Normalize to 0-100
      score = Math.min(Math.round(score), 100);

      // Log scoring for debugging
      logger.debug('Candidate scoring', {
        candidateName: candidate.name,
        candidateType: candidate.type,
        score,
        sharedSectors: sharedSectors.length,
        sharedSkills: sharedSkills.length,
      });

      const result = {
        candidate,
        score,
        sharedSectors,
        sharedSkills,
        sharedInterests,
        sharedHobbies,
      };

      const passed = result.score >= 20; // Minimum threshold for meaningful matches
      logger.info('Candidate filter result', {
        name: result.candidate.name,
        score: result.score,
        passed,
      });

      if (passed) {
        scoredResults.push(result);
      }
    }

    return scoredResults.sort((a, b) => b.score - a.score);
  }

  /**
   * Score candidates using Recombee ML recommendations (3.5)
   * Enhances deterministic scores with ML-based collaborative filtering
   */
  private async scoreWithRecombee(
    project: Awaited<ReturnType<typeof this.getProjectWithDetails>>,
    userId: string,
    scoredCandidates: ScoringResult[]
  ): Promise<ScoringResult[]> {
    if (!this.useRecombee || !project) {
      return scoredCandidates;
    }

    try {
      logger.info('Enhancing scores with Recombee ML', {
        projectId: project.id,
        candidateCount: scoredCandidates.length,
      });

      // Sync project to Recombee as an item
      await this.recombeeService.setItemProperties(`project:${project.id}`, {
        title: project.title,
        summary: project.summary,
        category: project.category,
        stage: project.stage,
        sectors: project.sectors.map(ps => ps.sector.name),
        skills: project.skillsNeeded.map(ps => ps.skill.name),
        lookingFor: project.lookingFor as string[],
      });

      // Get Recombee recommendations for this user
      const recommendations = await this.recombeeService.getRecommendations(userId, {
        count: 100,
        scenario: 'project_match',
        filter: undefined,
      });

      // Create a map of Recombee scores
      const recombeeScores = new Map<string, number>();
      recommendations.forEach(rec => {
        recombeeScores.set(rec.itemId, rec.score);
      });

      // Enhance scores with Recombee data (weighted blend: 70% deterministic, 30% ML)
      return scoredCandidates.map(scored => {
        const recombeeScore = recombeeScores.get(scored.candidate.id);
        if (recombeeScore !== undefined) {
          const blendedScore = Math.round(scored.score * 0.7 + recombeeScore * 100 * 0.3);
          return {
            ...scored,
            score: Math.min(blendedScore, 100),
          };
        }
        return scored;
      }).sort((a, b) => b.score - a.score);
    } catch (error) {
      logger.warn('Recombee scoring failed, using deterministic scores', { error });
      return scoredCandidates;
    }
  }

  /**
   * Rerank top candidates using Cohere semantic search (3.6)
   * Improves relevance ranking using AI understanding of project needs
   */
  private async rerankWithCohere(
    project: Awaited<ReturnType<typeof this.getProjectWithDetails>>,
    scoredCandidates: ScoringResult[],
    topN: number = 30
  ): Promise<ScoringResult[]> {
    if (!this.useCohere || !project || scoredCandidates.length === 0) {
      return scoredCandidates;
    }

    try {
      logger.info('Reranking with Cohere', {
        projectId: project.id,
        candidateCount: scoredCandidates.length,
      });

      // Build query from project details
      const query = `
        Project: ${project.title}
        Description: ${project.summary}
        Looking for: ${(project.lookingFor as string[] || []).join(', ') || 'collaborators'}
        Sectors: ${project.sectors.map(ps => ps.sector.name).join(', ')}
        Skills needed: ${project.skillsNeeded.map(ps => ps.skill.name).join(', ')}
      `.trim();

      // Format candidates as documents for reranking
      const documents = scoredCandidates.slice(0, topN).map(scored =>
        formatContactForRerank({
          id: scored.candidate.id,
          name: scored.candidate.name,
          company: scored.candidate.company || undefined,
          jobTitle: scored.candidate.jobTitle || undefined,
          sectors: scored.candidate.sectors,
          skills: scored.candidate.skills,
          interests: scored.candidate.interests,
          bio: scored.candidate.bio || undefined,
        })
      );

      // Call Cohere rerank
      const rerankResult = await this.cohereService.rerank(query, documents, {
        topN,
        minScore: 0.1,
      });

      // Map reranked results back to scored candidates
      const idToCandidate = new Map(scoredCandidates.map(s => [s.candidate.id, s]));
      const rerankedCandidates: ScoringResult[] = [];

      // Add reranked candidates in order
      for (const result of rerankResult.results) {
        const candidate = idToCandidate.get(result.id);
        if (candidate) {
          // Blend original score with Cohere relevance (60% original, 40% Cohere)
          const blendedScore = Math.round(
            candidate.score * 0.6 + result.relevanceScore * 100 * 0.4
          );
          rerankedCandidates.push({
            ...candidate,
            score: Math.min(blendedScore, 100),
          });
          idToCandidate.delete(result.id);
        }
      }

      // Add remaining candidates not in top N
      const remaining = scoredCandidates.filter(s => idToCandidate.has(s.candidate.id));
      rerankedCandidates.push(...remaining);

      logger.info('Cohere reranking completed', {
        projectId: project.id,
        rerankedCount: rerankResult.results.length,
        processingTimeMs: rerankResult.processingTimeMs,
      });

      return rerankedCandidates;
    } catch (error) {
      logger.warn('Cohere reranking failed, using original order', { error });
      return scoredCandidates;
    }
  }

  /**
   * Get cached explanation or generate new one (3.11)
   */
  private async getCachedExplanation(
    projectId: string,
    candidateId: string,
    generator: () => Promise<{ reasons: string[]; suggestedMessage: string; suggestedAction: string }>
  ): Promise<{ reasons: string[]; suggestedMessage: string; suggestedAction: string }> {
    const cacheKey = `${CACHE_KEYS.PROJECT_MATCHES}explanation:${projectId}:${candidateId}`;

    // Try cache first
    const cached = await cacheService.get<{
      reasons: string[];
      suggestedMessage: string;
      suggestedAction: string;
    }>(cacheKey);

    if (cached) {
      logger.debug('Using cached explanation', { projectId, candidateId });
      return cached;
    }

    // Generate new explanation
    const explanation = await generator();

    // Cache the result (30 minutes TTL)
    await cacheService.set(cacheKey, explanation, CACHE_TTL.MATCH_DETAILS);

    return explanation;
  }

  /**
   * Generate explanations for top matches using LLM (with caching - 3.11)
   */
  private async generateMatchExplanations(
    project: Awaited<ReturnType<typeof this.getProjectWithDetails>>,
    scoredCandidates: ScoringResult[]
  ): Promise<MatchWithExplanation[]> {
    if (!project) return [];

    const results: MatchWithExplanation[] = [];
    const lookingFor = project.lookingFor as string[] || [];

    // Process explanations in parallel batches for performance (8.5)
    const batchSize = 5;
    for (let i = 0; i < scoredCandidates.length; i += batchSize) {
      const batch = scoredCandidates.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map(async (scored) => {
          // Use caching for explanations (3.11)
          const explanation = await this.getCachedExplanation(
            project.id,
            scored.candidate.id,
            async () => {
              if (this.llmService.isAvailable()) {
                try {
                  return await this.generateSingleExplanation(project, scored);
                } catch (error) {
                  logger.warn('Failed to generate LLM explanation, using fallback', { error });
                  return this.generateFallbackExplanation(project, scored, lookingFor);
                }
              } else {
                return this.generateFallbackExplanation(project, scored, lookingFor);
              }
            }
          );

          return {
            ...scored,
            reasons: explanation.reasons,
            suggestedAction: explanation.suggestedAction,
            suggestedMessage: explanation.suggestedMessage,
          };
        })
      );
      results.push(...batchResults);
    }

    return results;
  }

  /**
   * Generate explanations for top matches using LLM (legacy - kept for reference)
   */
  private async generateMatchExplanationsLegacy(
    project: Awaited<ReturnType<typeof this.getProjectWithDetails>>,
    scoredCandidates: ScoringResult[]
  ): Promise<MatchWithExplanation[]> {
    if (!project) return [];

    const results: MatchWithExplanation[] = [];
    const lookingFor = project.lookingFor as string[] || [];

    for (const scored of scoredCandidates) {
      let reasons: string[];
      let suggestedMessage: string;
      let suggestedAction = 'Connect';

      if (this.llmService.isAvailable()) {
        try {
          const explanation = await this.generateSingleExplanation(project, scored);
          reasons = explanation.reasons;
          suggestedMessage = explanation.suggestedMessage;
          suggestedAction = explanation.suggestedAction;
        } catch (error) {
          logger.warn('Failed to generate LLM explanation, using fallback', { error });
          const fallback = this.generateFallbackExplanation(project, scored, lookingFor);
          reasons = fallback.reasons;
          suggestedMessage = fallback.suggestedMessage;
          suggestedAction = fallback.suggestedAction;
        }
      } else {
        const fallback = this.generateFallbackExplanation(project, scored, lookingFor);
        reasons = fallback.reasons;
        suggestedMessage = fallback.suggestedMessage;
        suggestedAction = fallback.suggestedAction;
      }

      results.push({
        ...scored,
        reasons,
        suggestedAction,
        suggestedMessage,
      });
    }

    return results;
  }

  /**
   * Generate a single explanation using LLM
   */
  private async generateSingleExplanation(
    project: Awaited<ReturnType<typeof this.getProjectWithDetails>>,
    scored: ScoringResult
  ): Promise<{ reasons: string[]; suggestedMessage: string; suggestedAction: string }> {
    if (!project) {
      throw new Error('Project not found');
    }

    const lookingFor = project.lookingFor as string[] || [];

    const prompt = `
Analyze why this person would be a good match for this collaboration project.

Project: ${project.title}
Description: ${project.summary}
Looking for: ${lookingFor.join(', ') || 'collaborators'}
Project sectors: ${project.sectors.map(ps => ps.sector.name).join(', ')}
Project skills needed: ${project.skillsNeeded.map(ps => ps.skill.name).join(', ')}

Potential Match:
- Name: ${scored.candidate.name}
- Company: ${scored.candidate.company || 'Unknown'}
- Role: ${scored.candidate.jobTitle || 'Unknown'}
- Sectors: ${scored.candidate.sectors.join(', ')}
- Skills: ${scored.candidate.skills.join(', ')}
- Match score: ${scored.score}%

Shared sectors: ${scored.sharedSectors.join(', ') || 'None'}
Shared skills: ${scored.sharedSkills.join(', ') || 'None'}

Provide:
1. 3 specific reasons why they're a good match
2. A suggested action (Connect, Meet, Message, Introduce)
3. A personalized outreach message (2-3 sentences)

Respond in JSON:
{
  "reasons": ["reason1", "reason2", "reason3"],
  "suggestedAction": "Connect",
  "suggestedMessage": "Your message here"
}
    `.trim();

    let content: string;
    content = await this.callLLM(prompt);

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        reasons: parsed.reasons || [],
        suggestedAction: parsed.suggestedAction || 'Connect',
        suggestedMessage: parsed.suggestedMessage || '',
      };
    }

    throw new Error('Failed to parse LLM response');
  }

  /**
   * Generate fallback explanation without LLM
   */
  private generateFallbackExplanation(
    project: Awaited<ReturnType<typeof this.getProjectWithDetails>>,
    scored: ScoringResult,
    lookingFor: string[]
  ): { reasons: string[]; suggestedMessage: string; suggestedAction: string } {
    const reasons: string[] = [];

    if (scored.sharedSectors.length > 0) {
      reasons.push(`Works in ${scored.sharedSectors.join(' and ')}`);
    }

    if (scored.sharedSkills.length > 0) {
      reasons.push(`Has skills in ${scored.sharedSkills.join(', ')}`);
    }

    if (scored.candidate.company) {
      reasons.push(`${scored.candidate.company} could be a valuable connection`);
    }

    if (reasons.length === 0) {
      reasons.push('Potential collaboration opportunity based on professional profile');
    }

    const firstName = scored.candidate.name.split(' ')[0];
    const projectTitle = project?.title || 'my project';

    return {
      reasons: reasons.slice(0, 3),
      suggestedAction: 'Connect',
      suggestedMessage: `Hi ${firstName}! I'm working on ${projectTitle} and noticed your background in ${scored.sharedSectors[0] || scored.sharedSkills[0] || 'this field'}. Would you be interested in connecting to discuss potential collaboration?`,
    };
  }

  /**
   * Save matches to database
   */
  private async saveMatches(projectId: string, matches: MatchWithExplanation[]): Promise<ProjectMatch[]> {
    // Delete existing matches for this project
    await this.prisma.projectMatch.deleteMany({
      where: { projectId },
    });

    // Create new matches
    const savedMatches: ProjectMatch[] = [];

    for (const match of matches) {
      try {
        const data: any = {
          projectId,
          matchScore: match.score,
          matchType: match.candidate.type,
          reasons: match.reasons,
          suggestedAction: match.suggestedAction,
          suggestedMessage: match.suggestedMessage,
          sharedSectors: match.sharedSectors,
          sharedSkills: match.sharedSkills,
          sharedInterests: match.sharedInterests,
          sharedHobbies: match.sharedHobbies,
          status: 'PENDING',
        };

        if (match.candidate.type === 'user') {
          data.matchedUserId = match.candidate.id;
        } else {
          data.matchedContactId = match.candidate.id;
        }

        const saved = await this.prisma.projectMatch.create({ data });
        savedMatches.push(saved);
      } catch (error) {
        logger.warn('Failed to save match', { error, candidateId: match.candidate.id });
      }
    }

    return savedMatches;
  }

  /**
   * Call the LLM provider via shared service
   */
  private async callLLM(prompt: string): Promise<string> {
    const content = await this.llmService.callLLM(prompt, PROJECT_SYSTEM_PROMPT);
    if (!content) {
      throw new Error('No content in LLM response');
    }
    return content;
  }
}
