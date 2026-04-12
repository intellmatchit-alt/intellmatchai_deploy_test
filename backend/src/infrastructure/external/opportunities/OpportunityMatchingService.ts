/**
 * Opportunity Matching Service
 *
 * AI-powered service that matches users with job opportunities based on their career intent.
 * Follows the Intent → Match → Action UX pattern.
 *
 * Pipeline:
 * 1. Analyze user's intent (type, role, seniority, location)
 * 2. Find candidate users/contacts (Database)
 * 3. Score and rank (Deterministic algorithm)
 * 4. Generate explanations (LLM: Groq > Gemini > OpenAI)
 * 5. Save matches to database
 *
 * @module infrastructure/external/opportunities/OpportunityMatchingService
 */

import {
  PrismaClient,
  OpportunityIntent,
  OpportunityMatch,
  OpportunityIntentType,
  OpportunityMatchStatus,
  SeniorityLevel,
  GoalType,
} from '@prisma/client';
import { logger } from '../../../shared/logger';
import { skillTaxonomyService } from '../../services/taxonomy';
import { experienceParsingService } from '../../services/experience';
import { cacheService } from '../../cache';
import { detectSeniorityLevel, SENIORITY_ORDER } from '../../../shared/matching';
import { LLMService } from '../../../shared/llm';

const OPPORTUNITY_SYSTEM_PROMPT = 'You are a career opportunity matching assistant that helps connect professionals with relevant opportunities. Be concise and professional. Always respond with valid JSON.';

/**
 * Intent compatibility matrix - defines which intents complement each other
 */
const INTENT_COMPATIBILITY: Record<OpportunityIntentType, OpportunityIntentType[]> = {
  HIRING: ['OPEN_TO_OPPORTUNITIES', 'REFERRALS_ONLY'],
  OPEN_TO_OPPORTUNITIES: ['HIRING', 'REFERRALS_ONLY', 'ADVISORY_BOARD'],
  ADVISORY_BOARD: ['OPEN_TO_OPPORTUNITIES', 'HIRING'],
  REFERRALS_ONLY: ['HIRING', 'OPEN_TO_OPPORTUNITIES'],
};

/**
 * Goal types that align with opportunity intents
 */
const INTENT_TO_GOALS: Record<OpportunityIntentType, GoalType[]> = {
  HIRING: ['JOB_SEEKING', 'COLLABORATION'],
  OPEN_TO_OPPORTUNITIES: ['HIRING', 'MENTORSHIP', 'COLLABORATION'],
  ADVISORY_BOARD: ['MENTORSHIP', 'COLLABORATION', 'LEARNING'],
  REFERRALS_ONLY: ['PARTNERSHIP', 'COLLABORATION', 'HIRING', 'JOB_SEEKING'],
};

// SENIORITY_ORDER imported from shared/matching

/**
 * Role patterns for detecting job titles
 */
const SENIOR_ROLE_PATTERNS = [
  /\b(ceo|cto|cfo|coo|cmo|cio|cpo)\b/i,
  /\bchief\b/i,
  /\b(vp|vice president)\b/i,
  /\bdirector\b/i,
  /\b(head of|lead)\b/i,
  /\bpartner\b/i,
  /\bfounder\b/i,
];

const RECRUITER_PATTERNS = [
  /\brecruit/i,
  /\btalent\b/i,
  /\bhuman resources\b/i,
  /\bhr\b/i,
  /\bpeople\s*(ops|operations)\b/i,
  /\bhiring\b/i,
];

const BOARD_PATTERNS = [
  /\bboard\b/i,
  /\badvisor/i,
  /\bmentor\b/i,
  /\bconsultant\b/i,
  /\bexecutive\b/i,
];

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
  location?: string | null;
  sectors: string[];
  skills: string[];
  interests: string[];
  hobbies: string[];
  goals: GoalType[];
  opportunityIntent?: OpportunityIntentType | null;
  seniority?: SeniorityLevel | null;
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
  intentAlignment: string;
}

/**
 * Match with explanation
 */
interface MatchWithExplanation extends ScoringResult {
  reasons: string[];
  suggestedAction: string;
  suggestedMessage: string;
  nextSteps: string[];
}

/**
 * Opportunity Matching Service
 */
export class OpportunityMatchingService {
  private prisma: PrismaClient;
  private llmService: LLMService;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
    this.llmService = new LLMService(OPPORTUNITY_SYSTEM_PROMPT);

    const provider = this.llmService.getActiveProvider();
    const providerConfig = this.llmService.getProviderConfig();
    if (provider !== 'none' && providerConfig) {
      logger.info(`Opportunity matching service configured with ${provider}`, {
        provider,
        model: providerConfig.model,
      });
    } else {
      logger.warn('No LLM provider configured for opportunity matching - will use deterministic only');
    }
  }

  /**
   * Get the currently active provider name
   */
  getActiveProvider(): string {
    return this.llmService.getActiveProvider();
  }

  /**
   * Main matching function - finds and scores matches for a user's opportunity intent
   * @param userId - The user ID
   * @param intentId - Optional specific intent ID (for multiple opportunities support)
   */
  async findMatchesForIntent(userId: string, intentId?: string, organizationId?: string): Promise<OpportunityMatch[]> {
    logger.info('Starting opportunity matching', { userId, intentId, organizationId });

    // 1. Get user's intent with preferences
    const intent = await this.getIntentWithDetails(userId, intentId);
    if (!intent) {
      throw new Error('No active opportunity intent found');
    }

    // 2. Get user's profile data for context
    const user = await this.getUserProfile(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // 3. Find candidates from user's contacts and other users (scoped by org if provided)
    const contactCandidates = await this.findContactCandidates(intent, userId, organizationId);
    const userCandidates = await this.findUserCandidates(intent, user, organizationId);
    const allCandidates = [...contactCandidates, ...userCandidates];

    logger.info('Found candidates', {
      userId,
      intentType: intent.intentType,
      contactCandidates: contactCandidates.length,
      userCandidates: userCandidates.length,
    });

    // 4. Score candidates (deterministic)
    const scoredCandidates = this.scoreAllCandidates(intent, user, allCandidates);

    // 5. AI-validate top candidates' job titles against the opportunity role
    //    This is the critical step: LLM checks if each contact's current job is relevant
    const aiValidated = await this.aiValidateCandidateRoles(intent, scoredCandidates.slice(0, 50));

    // 6. Take top candidates and generate explanations
    const topCandidates = aiValidated.slice(0, 30);
    const matchesWithExplanations = await this.generateMatchExplanations(intent, user, topCandidates);

    // 6. Save matches to database
    const savedMatches = await this.saveMatches(intent.id, matchesWithExplanations);

    // 7. Update lastMatchedAt
    await this.prisma.opportunityIntent.update({
      where: { id: intent.id },
      data: { lastMatchedAt: new Date() },
    });

    logger.info('Opportunity matching completed', {
      userId,
      intentType: intent.intentType,
      totalMatches: savedMatches.length,
    });

    return savedMatches;
  }

  /**
   * Get user's intent with sector and skill preferences
   */
  private async getIntentWithDetails(userId: string, intentId?: string) {
    const where: any = {
      userId,
      isActive: true,
    };

    // If specific intentId provided, use it
    if (intentId) {
      where.id = intentId;
    }

    return this.prisma.opportunityIntent.findFirst({
      where,
      include: {
        sectorPrefs: {
          include: { sector: true },
        },
        skillPrefs: {
          include: { skill: true },
        },
      },
    });
  }

  /**
   * Get user's profile with sectors, skills, goals, interests, and hobbies
   */
  private async getUserProfile(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        userSectors: { include: { sector: true } },
        userSkills: { include: { skill: true } },
        userGoals: true,
        userInterests: { include: { interest: true } },
        userHobbies: { include: { hobby: true } },
      },
    });
  }

  /**
   * Find user candidates based on intent type
   */
  private async findUserCandidates(
    intent: Awaited<ReturnType<typeof this.getIntentWithDetails>>,
    currentUser: Awaited<ReturnType<typeof this.getUserProfile>>,
    organizationId?: string
  ): Promise<MatchCandidate[]> {
    if (!intent || !currentUser) return [];

    const intentSectorIds = intent.sectorPrefs.map((sp) => sp.sectorId);
    const intentSkillIds = intent.skillPrefs.map((sp) => sp.skillId);
    const userSectorIds = currentUser.userSectors.map((us) => us.sectorId);
    const userSkillIds = currentUser.userSkills.map((us) => us.skillId);

    // Combine intent preferences with user's own profile for broader matching
    const sectorIds = [...new Set([...intentSectorIds, ...userSectorIds])];
    const skillIds = [...new Set([...intentSkillIds, ...userSkillIds])];

    // Build query based on intent type
    const whereClause: any = {
      id: { not: currentUser.id },
      isActive: true,
    };

    if (organizationId) {
      whereClause.organizationId = organizationId;
    }

    // For HIRING: Find job seekers
    // For OPEN_TO_OPPORTUNITIES: Find hiring managers/recruiters
    // For ADVISORY_BOARD: Find experienced professionals
    // For REFERRALS_ONLY: Find well-connected people

    if (sectorIds.length > 0 || skillIds.length > 0) {
      whereClause.OR = [];
      if (sectorIds.length > 0) {
        whereClause.OR.push({ userSectors: { some: { sectorId: { in: sectorIds } } } });
      }
      if (skillIds.length > 0) {
        whereClause.OR.push({ userSkills: { some: { skillId: { in: skillIds } } } });
      }
    }

    // Find users with compatible intents or goals
    const compatibleGoals = INTENT_TO_GOALS[intent.intentType];
    if (compatibleGoals.length > 0) {
      if (!whereClause.OR) whereClause.OR = [];
      whereClause.OR.push({ userGoals: { some: { goalType: { in: compatibleGoals }, isActive: true } } });
    }

    const users = await this.prisma.user.findMany({
      where: whereClause,
      include: {
        userSectors: { include: { sector: true } },
        userSkills: { include: { skill: true } },
        userInterests: { include: { interest: true } },
        userHobbies: { include: { hobby: true } },
        userGoals: { where: { isActive: true } },
        opportunityIntents: true,
      },
      take: 100,
    });

    return users.map((user) => ({
      type: 'user' as const,
      id: user.id,
      name: user.fullName,
      company: user.company,
      jobTitle: user.jobTitle,
      bio: user.bio,
      location: user.location,
      sectors: user.userSectors.map((us) => us.sector.name),
      skills: user.userSkills.map((us) => us.skill.name),
      interests: user.userInterests.map((ui) => ui.interest.name),
      hobbies: user.userHobbies.map((uh) => uh.hobby.name),
      goals: user.userGoals.map((ug) => ug.goalType),
      opportunityIntent: user.opportunityIntents?.[0]?.intentType || null,
      seniority: this.inferSeniority(user.jobTitle),
    }));
  }

  /**
   * Find contact candidates from user's network
   * Fetches ALL contacts and lets the scoring algorithm determine relevance
   */
  private async findContactCandidates(
    intent: Awaited<ReturnType<typeof this.getIntentWithDetails>>,
    userId: string,
    organizationId?: string
  ): Promise<MatchCandidate[]> {
    if (!intent) return [];

    // Scope by organization context when in org mode - fetch ALL contacts, scoring handles relevance
    const whereClause: any = organizationId
      ? { organizationId }
      : { ownerId: userId };

    const contacts = await this.prisma.contact.findMany({
      where: whereClause,
      include: {
        contactSectors: { include: { sector: true } },
        contactSkills: { include: { skill: true } },
        contactInterests: { include: { interest: true } },
        contactHobbies: { include: { hobby: true } },
      },
      take: 200,
    });

    return contacts.map((contact) => ({
      type: 'contact' as const,
      id: contact.id,
      name: contact.fullName,
      company: contact.company,
      jobTitle: contact.jobTitle,
      bio: contact.bio,
      location: contact.location,
      sectors: contact.contactSectors.map((cs) => cs.sector.name),
      skills: contact.contactSkills.map((cs) => cs.skill.name),
      interests: contact.contactInterests.map((ci) => ci.interest.name),
      hobbies: contact.contactHobbies.map((ch) => ch.hobby.name),
      goals: [],
      opportunityIntent: null,
      seniority: this.inferSeniority(contact.jobTitle),
    }));
  }

  /**
   * Infer seniority level from job title (delegates to shared implementation)
   */
  private inferSeniority(jobTitle: string | null | undefined): SeniorityLevel | null {
    if (!jobTitle) return null;
    return detectSeniorityLevel(jobTitle) as SeniorityLevel;
  }

  /**
   * Score all candidates using deterministic algorithm
   *
   * Weights:
   * - Role-area match: 25% (CRITICAL - exact role/title matching, most important factor)
   * - Skill match: 20% (taxonomy-enhanced)
   * - Seniority fit: 15% (critical for HIRING/OPEN_TO_OPPORTUNITIES)
   * - Intent alignment: 10%
   * - Sector overlap: 8%
   * - Location match: 6%
   * - Experience years: 6%
   * - Skill proficiency: 4%
   * - Interest overlap: 3%
   * - Hobby overlap: 1%
   * - Career trajectory: 2%
   */
  private scoreAllCandidates(
    intent: Awaited<ReturnType<typeof this.getIntentWithDetails>>,
    user: Awaited<ReturnType<typeof this.getUserProfile>>,
    candidates: MatchCandidate[]
  ): ScoringResult[] {
    if (!intent || !user) return [];

    const intentSectors = new Set(intent.sectorPrefs.map((sp) => sp.sector.name.toLowerCase()));
    const userSectors = new Set(user.userSectors.map((us) => us.sector.name.toLowerCase()));
    const allTargetSectors = new Set([...intentSectors, ...userSectors]);

    const intentSkills = new Set(intent.skillPrefs.map((sp) => sp.skill.name.toLowerCase()));
    const userSkills = new Set(user.userSkills.map((us) => us.skill.name.toLowerCase()));
    const allTargetSkills = new Set([...intentSkills, ...userSkills]);

    // Get user's interests and hobbies for matching
    const userInterests = new Set(user.userInterests.map((ui: any) => ui.interest.name.toLowerCase()));
    const userHobbies = new Set(user.userHobbies.map((uh: any) => uh.hobby.name.toLowerCase()));

    return candidates
      .map((candidate) => {
        let score = 0;
        let intentAlignmentDesc = '';

        // 1. Role-Area Match (25 points max) - MOST IMPORTANT: does the candidate's role match?
        const roleScore = this.calculateRoleAreaMatch(
          intent.intentType,
          intent.roleArea,
          candidate.jobTitle,
          candidate.bio
        );
        score += Math.round(roleScore * 0.25);

        // 2. Skill Match (20 points max) - enhanced with taxonomy
        let sharedSkills: string[];
        if (skillTaxonomyService.isAvailable() && allTargetSkills.size > 0 && candidate.skills.length > 0) {
          const taxonomyResult = skillTaxonomyService.calculateSkillScore(
            [...allTargetSkills],
            candidate.skills.map(s => s.toLowerCase())
          );
          score += Math.min(Math.round(taxonomyResult.score * 0.20), 20);
          sharedSkills = taxonomyResult.matches.map(m => m.targetSkill);
        } else {
          const candidateSkills = new Set(candidate.skills.map((s) => s.toLowerCase()));
          sharedSkills = [...allTargetSkills].filter((s) => candidateSkills.has(s));
          score += Math.min(sharedSkills.length * 5, 20);
        }

        // 3. Seniority Fit (15 points max) - critical for HIRING/OPEN_TO_OPPORTUNITIES
        const seniorityScore = this.calculateSeniorityFit(
          intent.intentType,
          intent.seniority,
          candidate.seniority
        );
        score += Math.round(seniorityScore * 0.15);

        // 4. Intent Alignment (10 points max)
        const intentAlignmentResult = this.calculateIntentAlignment(intent.intentType, candidate);
        score += Math.round(intentAlignmentResult.score * 0.10);
        intentAlignmentDesc = intentAlignmentResult.description;

        // 5. Sector Overlap (8 points max)
        const candidateSectors = new Set(candidate.sectors.map((s) => s.toLowerCase()));
        const sharedSectors = [...allTargetSectors].filter((s) => candidateSectors.has(s));
        score += Math.min(sharedSectors.length * 3, 8);

        // 6. Location Match (6 points max)
        const locationScore = this.calculateLocationMatch(
          intent.locationPref,
          intent.remoteOk,
          candidate.location
        );
        score += Math.round(locationScore * 0.06);

        // 7. Experience Years Match (6 points max)
        if (candidate.jobTitle) {
          const requiredSeniority = intent.seniority || (user.jobTitle ? this.inferSeniority(user.jobTitle) : 'MID');
          const requiredYears = experienceParsingService.estimateYearsOfExperience({
            jobTitle: requiredSeniority || 'MID',
          });
          const experienceResult = experienceParsingService.matchExperienceLevel(
            { minYears: Math.max(0, requiredYears - 3), maxYears: requiredYears + 5, seniority: requiredSeniority as any },
            { jobTitle: candidate.jobTitle }
          );
          score += Math.round(experienceResult.score * 0.06);
        } else {
          score += Math.round(50 * 0.06); // Neutral when no title
        }

        // 8. Skill Proficiency (4 points max) - inferred from seniority + skill depth
        if (candidate.skills.length > 0 && allTargetSkills.size > 0) {
          const candidateSkillsLower = candidate.skills.map(s => s.toLowerCase());
          const matchedSkillCount = [...allTargetSkills].filter(s => candidateSkillsLower.includes(s)).length;
          const seniorityBonus = candidate.seniority
            ? SENIORITY_ORDER.indexOf(candidate.seniority) * 5
            : 10;
          const proficiency = Math.min(100,
            (matchedSkillCount / allTargetSkills.size) * 60 + seniorityBonus
          );
          score += Math.round(proficiency * 0.04);
        } else {
          score += Math.round(50 * 0.04); // Neutral
        }

        // 9. Interest Overlap (3 points max)
        const candidateInterests = new Set(candidate.interests.map((i) => i.toLowerCase()));
        const sharedInterests = [...userInterests].filter((i) => candidateInterests.has(i));
        score += Math.min(sharedInterests.length * 2, 3);

        // 10. Hobby Overlap (1 point max)
        const candidateHobbies = new Set(candidate.hobbies.map((h) => h.toLowerCase()));
        const sharedHobbies = [...userHobbies].filter((h) => candidateHobbies.has(h));
        score += Math.min(sharedHobbies.length, 1);

        // 11. Career Trajectory (2 points max)
        if (candidate.jobTitle) {
          const seniorityIdx = SENIORITY_ORDER.indexOf(candidate.seniority || 'MID');
          const trajectoryScore = Math.min(100, 30 + seniorityIdx * 10);
          score += Math.round(trajectoryScore * 0.02);
        } else {
          score += Math.round(50 * 0.02); // Neutral
        }

        // Normalize to 0-100
        score = Math.min(Math.round(score), 100);

        // Apply role mismatch penalty for HIRING/OPEN_TO_OPPORTUNITIES
        // If the role area doesn't match at all, the candidate is much less relevant
        if (intent.roleArea && (intent.intentType === 'HIRING' || intent.intentType === 'OPEN_TO_OPPORTUNITIES')) {
          if (roleScore <= 20) {
            // No role match at all - significantly reduce score
            score = Math.round(score * 0.45);
          } else if (roleScore <= 40) {
            // Weak role match - moderately reduce score
            score = Math.round(score * 0.65);
          }
        }

        return {
          candidate,
          score,
          sharedSectors,
          sharedSkills,
          sharedInterests,
          sharedHobbies,
          intentAlignment: intentAlignmentDesc,
        };
      })
      .filter((result) => result.score > 15) // Lower threshold to include more candidates
      .sort((a, b) => b.score - a.score);
  }

  /**
   * Calculate intent alignment score
   */
  private calculateIntentAlignment(
    userIntent: OpportunityIntentType,
    candidate: MatchCandidate
  ): { score: number; description: string } {
    let score = 0;
    let description = '';

    // 1. Direct intent match (if candidate has an opportunity intent)
    if (candidate.opportunityIntent) {
      const compatibleIntents = INTENT_COMPATIBILITY[userIntent];
      if (compatibleIntents.includes(candidate.opportunityIntent)) {
        score += 100;
        description = `Intent match: ${this.formatIntentType(candidate.opportunityIntent)}`;
        return { score, description };
      }
    }

    // 2. Goal-based inference
    const relevantGoals = INTENT_TO_GOALS[userIntent];
    const matchedGoals = candidate.goals.filter((g) => relevantGoals.includes(g));
    if (matchedGoals.length > 0) {
      score += Math.min(matchedGoals.length * 40, 80);
      description = `Goals: ${matchedGoals.map(this.formatGoalType).join(', ')}`;
      return { score, description };
    }

    // 3. Job title-based inference
    const jobTitle = candidate.jobTitle?.toLowerCase() || '';

    switch (userIntent) {
      case 'HIRING':
        // Looking for people who might be job seekers or have matching expertise
        if (candidate.goals.includes('JOB_SEEKING')) {
          score += 90;
          description = 'Open to opportunities';
        } else if (candidate.opportunityIntent === 'OPEN_TO_OPPORTUNITIES') {
          score += 85;
          description = 'Seeking new role';
        } else if (candidate.skills.length > 0 && candidate.jobTitle) {
          score += 50;
          description = `${candidate.jobTitle}`;
        } else if (candidate.skills.length > 0) {
          score += 30;
          description = 'Has relevant skills';
        }
        break;

      case 'OPEN_TO_OPPORTUNITIES':
        // Looking for hiring managers, recruiters, or senior decision makers
        if (candidate.goals.includes('HIRING')) {
          score += 95;
          description = 'Actively hiring';
        } else if (RECRUITER_PATTERNS.some((p) => p.test(jobTitle))) {
          score += 90;
          description = 'Recruiter/Talent professional';
        } else if (SENIOR_ROLE_PATTERNS.some((p) => p.test(jobTitle))) {
          score += 75;
          description = 'Decision maker';
        } else if (candidate.opportunityIntent === 'HIRING') {
          score += 85;
          description = 'Looking to hire';
        } else {
          // Peers at same level get low intent score
          score += 20;
          description = 'Professional contact';
        }
        break;

      case 'ADVISORY_BOARD':
        // Looking for experienced professionals
        if (BOARD_PATTERNS.some((p) => p.test(jobTitle))) {
          score += 90;
          description = 'Advisory experience';
        } else if (SENIOR_ROLE_PATTERNS.some((p) => p.test(jobTitle))) {
          score += 70;
          description = 'Senior professional';
        }
        break;

      case 'REFERRALS_ONLY':
        // Looking for well-connected people
        if (SENIOR_ROLE_PATTERNS.some((p) => p.test(jobTitle))) {
          score += 60;
          description = 'Well-connected professional';
        } else {
          score += 30;
          description = 'Network connection';
        }
        break;
    }

    return { score, description };
  }

  /**
   * Calculate role-area match score
   * For HIRING: checks if candidate's title matches the exact role being hired for (CFO ≠ CEO)
   * For OPEN_TO_OPPORTUNITIES: checks if candidate is in a position to hire for the user's role area
   */
  private calculateRoleAreaMatch(
    intentType: OpportunityIntentType,
    roleArea: string | null | undefined,
    candidateTitle: string | null | undefined,
    candidateBio: string | null | undefined
  ): number {
    if (!roleArea || !candidateTitle) return 30; // Neutral when no data

    const role = roleArea.toLowerCase().trim();
    const title = candidateTitle.toLowerCase().trim();
    const bio = (candidateBio || '').toLowerCase();

    // Extract key role tokens (e.g., "cfo" from "Chief Financial Officer", "marketing" from "Marketing Manager")
    const roleTokens = this.extractRoleTokens(role);
    const titleTokens = this.extractRoleTokens(title);

    // Check for C-suite abbreviation match (exact: CFO must match CFO, not CEO/CTO)
    const roleCSuite = this.extractCSuiteRole(role);
    const titleCSuite = this.extractCSuiteRole(title);

    if (intentType === 'HIRING') {
      // HIRING: we want candidates whose title/experience matches the EXACT role we're hiring for
      // CFO hiring should find finance people, NOT CEO/CTO
      if (roleCSuite && titleCSuite) {
        // Both are C-suite: must be same role
        if (roleCSuite === titleCSuite) return 100;
        // Different C-suite roles: low score (CEO ≠ CFO)
        return 15;
      }

      // Check for exact functional area match
      const commonTokens = roleTokens.filter(t => titleTokens.includes(t));
      if (commonTokens.length > 0) {
        // Strong match - same functional area
        return Math.min(100, 60 + commonTokens.length * 20);
      }

      // Check bio for role relevance
      const bioRelevance = roleTokens.filter(t => bio.includes(t));
      if (bioRelevance.length > 0) {
        return Math.min(80, 40 + bioRelevance.length * 15);
      }

      // No role match
      return 20;
    }

    if (intentType === 'OPEN_TO_OPPORTUNITIES') {
      // OPEN_TO_OPPORTUNITIES: we want people who could hire or manage the user's desired role
      // e.g., if user wants marketing role, match with CMO, Marketing Director, etc.

      // Check if candidate is in a leadership/hiring position for this area
      const isLeaderInArea = roleTokens.some(t => title.includes(t)) &&
        (SENIOR_ROLE_PATTERNS.some(p => p.test(title)) || RECRUITER_PATTERNS.some(p => p.test(title)));
      if (isLeaderInArea) return 100;

      // Check if candidate is a recruiter/HR (they hire for any role)
      if (RECRUITER_PATTERNS.some(p => p.test(title))) return 80;

      // Check if candidate is a senior leader (can make hiring decisions)
      if (SENIOR_ROLE_PATTERNS.some(p => p.test(title))) {
        // Check if same functional area
        const sameArea = roleTokens.some(t => titleTokens.includes(t));
        return sameArea ? 90 : 50;
      }

      // Same functional area but not a leader - they might know about opportunities
      const commonTokens = roleTokens.filter(t => titleTokens.includes(t));
      if (commonTokens.length > 0) return 40;

      return 20;
    }

    // For ADVISORY_BOARD and REFERRALS_ONLY, role area is less critical
    const commonTokens = roleTokens.filter(t => titleTokens.includes(t));
    return commonTokens.length > 0 ? 70 : 40;
  }

  /**
   * Extract functional role tokens from a title/role string
   * Uses word boundary matching to avoid false positives (e.g., "it" matching "Executive")
   */
  private extractRoleTokens(text: string): string[] {
    const tokens: string[] = [];
    const lower = ` ${text.toLowerCase()} `; // pad with spaces for word boundary matching

    // Map common titles to functional areas - use regex for word boundary matching
    const functionalAreas: Record<string, RegExp[]> = {
      'finance': [/\bcfo\b/, /\bfinance\b/, /\bfinancial\b/, /\baccounting\b/, /\btreasury\b/, /\bcontroller\b/, /\baudit\b/, /\binvestment\b/, /\bbanking\b/],
      'technology': [/\bcto\b/, /\btechnology\b/, /\btech\b/, /\bengineering\b/, /\bsoftware\b/, /\bdeveloper\b/, /\barchitect\b/, /\bdevops\b/, /\bprogramm/, /\bfull.?stack\b/, /\bfrontend\b/, /\bbackend\b/, /\bweb dev/],
      'marketing': [/\bcmo\b/, /\bmarketing\b/, /\bbrand\b/, /\bgrowth\b/, /\bcontent\b/, /\bseo\b/, /\bsem\b/, /\bdigital market/],
      'operations': [/\bcoo\b/, /\boperations\b/, /\bsupply chain\b/, /\blogistics\b/, /\bprocurement\b/],
      'product': [/\bcpo\b/, /\bproduct\s*(manag|lead|own|direct)/, /\bproduct\b/],
      'sales': [/\bsales\b/, /\brevenue\b/, /\bbusiness develop/, /\baccount\s*(manag|exec)/, /\bcommercial\b/],
      'hr': [/\bhr\b/, /\bhuman resources\b/, /\bpeople ops\b/, /\btalent\b/, /\brecruit/],
      'legal': [/\blegal\b/, /\bcounsel\b/, /\bcompliance\b/, /\bregulatory\b/],
      'design': [/\bdesign\b/, /\bux\b/, /\bui\b/, /\bcreative\b/, /\bart direct/],
      'data': [/\bdata\b/, /\banalytics\b/, /\bdata scien/, /\bmachine learn/, /\b(?:^|\s)ai\b/],
      'executive': [/\bceo\b/, /\bpresident\b/, /\bmanaging director\b/, /\bgeneral manager\b/, /\bfounder\b/, /\bco-founder\b/],
    };

    for (const [area, patterns] of Object.entries(functionalAreas)) {
      if (patterns.some(p => p.test(lower))) {
        tokens.push(area);
      }
    }

    return tokens;
  }

  /**
   * Extract C-suite role abbreviation if present
   */
  private extractCSuiteRole(text: string): string | null {
    const lower = text.toLowerCase();
    const cSuiteMap: Record<string, string> = {
      'ceo': 'ceo', 'chief executive': 'ceo',
      'cto': 'cto', 'chief technology': 'cto', 'chief technical': 'cto',
      'cfo': 'cfo', 'chief financial': 'cfo', 'chief finance': 'cfo',
      'coo': 'coo', 'chief operating': 'coo', 'chief operations': 'coo',
      'cmo': 'cmo', 'chief marketing': 'cmo',
      'cpo': 'cpo', 'chief product': 'cpo',
      'cio': 'cio', 'chief information': 'cio',
    };

    for (const [pattern, role] of Object.entries(cSuiteMap)) {
      if (lower.includes(pattern)) return role;
    }
    return null;
  }

  /**
   * Calculate seniority fit score
   * HIRING: match candidates at/near the exact seniority level being hired for
   * OPEN_TO_OPPORTUNITIES: strongly prefer people ABOVE the user's level who can hire
   */
  private calculateSeniorityFit(
    userIntent: OpportunityIntentType,
    userSeniority: SeniorityLevel | null | undefined,
    candidateSeniority: SeniorityLevel | null | undefined
  ): number {
    if (!candidateSeniority) return 40; // Below neutral if unknown

    const candidateIdx = SENIORITY_ORDER.indexOf(candidateSeniority);
    const userIdx = userSeniority ? SENIORITY_ORDER.indexOf(userSeniority) : 3; // Default to LEAD

    switch (userIntent) {
      case 'HIRING': {
        // For hiring: candidates at the target seniority level are ideal
        // People ABOVE the target level are still relevant (they could be hiring managers or overqualified candidates)
        // People far BELOW the target level are less relevant
        if (userSeniority) {
          const diff = candidateIdx - userIdx; // positive = candidate is more senior
          if (diff === 0) return 100; // Exact match
          if (diff === 1) return 80;  // Slightly above - still very relevant
          if (diff === -1) return 75; // Slightly below - acceptable
          if (diff >= 2) return 60;   // Well above - could be hiring manager/overqualified
          if (diff === -2) return 40; // Two below
          return Math.max(10, 30 + diff * 10); // Far below = low
        }
        return 60; // No preference specified
      }

      case 'OPEN_TO_OPPORTUNITIES': {
        // Strongly prefer people ABOVE the user's current level (they can hire)
        // Same level = low score (they're peers, not potential employers)
        // Below level = very low score
        const diff = candidateIdx - userIdx;
        if (diff >= 3) return 100; // Much higher = great (VP, C-level, Board)
        if (diff === 2) return 95;  // 2 levels above = excellent
        if (diff === 1) return 80;  // 1 level above = good
        if (diff === 0) return 25;  // Same level = poor (they're peers)
        if (diff === -1) return 10; // 1 below = very poor
        return 0;                   // Much below = no value
      }

      case 'ADVISORY_BOARD':
        // Strongly prefer senior candidates
        if (candidateIdx >= 5) return 100; // VP+
        if (candidateIdx >= 4) return 80; // Director
        return candidateIdx * 15;

      case 'REFERRALS_ONLY':
        // Any level works, slight preference for experienced
        return 60 + candidateIdx * 5;
    }
  }

  /**
   * Calculate location match score
   */
  private calculateLocationMatch(
    userLocation: string | null | undefined,
    remoteOk: boolean,
    candidateLocation: string | null | undefined
  ): number {
    if (!userLocation) return 70; // No preference

    if (remoteOk) {
      if (candidateLocation?.toLowerCase().includes('remote')) return 100;
      if (candidateLocation?.toLowerCase().includes(userLocation.toLowerCase())) return 100;
      return 70; // Remote ok, so location doesn't matter much
    }

    // Location matters
    if (!candidateLocation) return 40;

    const userCity = this.extractCity(userLocation);
    const candidateCity = this.extractCity(candidateLocation);

    if (userCity && candidateCity && userCity.toLowerCase() === candidateCity.toLowerCase()) {
      return 100;
    }

    // Same country check (simple)
    if (userLocation.toLowerCase() === candidateLocation.toLowerCase()) {
      return 90;
    }

    return 30;
  }

  /**
   * Extract city from location string
   */
  private extractCity(location: string): string {
    // Simple extraction - take first part before comma
    const parts = location.split(',');
    return parts[0].trim();
  }

  /**
   * AI-validate candidate roles against the opportunity
   * Uses a single batch LLM call for speed.
   * For HIRING: checks if candidate's current job is relevant to the role being hired for
   * For OPEN_TO_OPPORTUNITIES: checks if candidate is in a position to help (hire, mentor, refer)
   */
  private async aiValidateCandidateRoles(
    intent: Awaited<ReturnType<typeof this.getIntentWithDetails>>,
    scoredCandidates: ScoringResult[]
  ): Promise<ScoringResult[]> {
    if (!intent || scoredCandidates.length === 0) return scoredCandidates;

    // Only validate for HIRING and OPEN_TO_OPPORTUNITIES where role relevance is critical
    if (intent.intentType !== 'HIRING' && intent.intentType !== 'OPEN_TO_OPPORTUNITIES') {
      return scoredCandidates;
    }

    // Skip if no LLM provider configured
    if (!this.llmService.isAvailable()) {
      logger.warn('No LLM provider configured, skipping AI role validation');
      return scoredCandidates;
    }

    const roleArea = intent.roleArea || 'general';
    const seniority = intent.seniority || 'any level';

    // Build candidate list for the prompt
    const candidateList = scoredCandidates.map((sc, idx) => ({
      idx,
      name: sc.candidate.name,
      jobTitle: sc.candidate.jobTitle || 'Unknown',
      company: sc.candidate.company || 'Unknown',
    }));

    let prompt: string;

    if (intent.intentType === 'HIRING') {
      prompt = `
You are validating candidates for a HIRING opportunity. Be VERY strict.

The company is hiring for: "${roleArea}" at ${seniority} level.

For each candidate, rate how realistic it is to HIRE them for this EXACT role.
Think about it literally: would you reach out to this person with a job offer for "${roleArea}" (${seniority})?

CRITICAL RULES:
- C-suite executives (CEO, CTO, CFO, COO) are NOT hirable for individual contributor roles. A CTO will NOT accept a "Senior Developer" position. Score them 0-15.
- Founders/Co-founders are NOT hirable for employee positions. Score them 0-10.
- VPs and Directors are NOT hirable for non-leadership roles below their level. Score them 0-20.
- The candidate's functional area MUST match. A "Marketing Director" cannot be hired as a "Software Engineer". Score cross-field 0-10.
- Only candidates whose current role is at a SIMILAR or SLIGHTLY LOWER level AND in the SAME functional area should score 70+.

Examples:
- Hiring "Senior Full Stack Developer": "Software Engineer" → 90, "Frontend Developer" → 85, "CTO" → 5, "CEO" → 0, "Investment Manager" → 0, "Program Director" → 5
- Hiring "CFO": "Finance Director" → 90, "Senior Accountant" → 75, "CEO" → 5, "CTO" → 0, "Marketing VP" → 0
- Hiring "Marketing Manager": "Digital Marketing Lead" → 90, "Content Strategist" → 80, "Software Engineer" → 0, "CEO" → 5

Rate each candidate 0-100:
- 80-100: Same functional area, realistic seniority level for this hire
- 50-79: Related area, could potentially be hired with some stretch
- 20-49: Weak match, different area or wildly different seniority
- 0-19: Not hirable for this role (wrong field, too senior, executive/founder)

Candidates:
${candidateList.map(c => `${c.idx}. "${c.jobTitle}" at ${c.company} (${c.name})`).join('\n')}

Respond ONLY with a JSON array of scores in order, e.g. [85, 10, 60, ...]
No explanations, just the array.
      `.trim();
    } else {
      // OPEN_TO_OPPORTUNITIES
      prompt = `
You are validating candidates for someone who is OPEN TO OPPORTUNITIES.

The person is looking for opportunities in: "${roleArea}" at ${seniority} level.
They need people who can HELP them find opportunities - hiring managers, senior leaders in their field, recruiters, or well-connected professionals.

For each candidate below, rate how likely they are to help this person find a "${roleArea}" opportunity:
- A senior person in the SAME field can hire them or refer them
- A recruiter/HR person can connect them to roles
- A very senior executive (CEO, VP) might have hiring authority
- A peer at the same level in an unrelated field is unlikely to help

Rate each candidate 0-100:
- 80-100: Senior leader in same field, recruiter, or decision-maker who could directly help
- 50-79: In a related position, could potentially refer or connect
- 20-49: Loosely connected, unlikely to directly help with this specific role area
- 0-19: No relevance to this opportunity search

Candidates:
${candidateList.map(c => `${c.idx}. "${c.jobTitle}" at ${c.company} (${c.name})`).join('\n')}

Respond ONLY with a JSON array of scores in order, e.g. [85, 10, 60, ...]
No explanations, just the array.
      `.trim();
    }

    try {
      let content: string;
      content = await this.callLLM(prompt);

      // Parse the JSON array from the response
      const arrayMatch = content.match(/\[[\s\S]*?\]/);
      if (!arrayMatch) {
        logger.warn('AI role validation: could not parse response, skipping', { content: content.substring(0, 200) });
        return scoredCandidates;
      }

      const aiScores: number[] = JSON.parse(arrayMatch[0]);

      if (aiScores.length !== scoredCandidates.length) {
        logger.warn('AI role validation: score count mismatch', {
          expected: scoredCandidates.length,
          got: aiScores.length,
        });
        // Use what we have, pad with 50 (neutral) for missing
        while (aiScores.length < scoredCandidates.length) {
          aiScores.push(50);
        }
      }

      // Apply AI scores as a multiplier on the existing score
      const validated = scoredCandidates.map((sc, idx) => {
        const aiScore = Math.max(0, Math.min(100, aiScores[idx] || 50));

        // AI score becomes a multiplier: 0-19 → 0.2x, 20-49 → 0.5x, 50-79 → 0.8x, 80-100 → 1.0x
        let multiplier: number;
        if (aiScore >= 80) {
          multiplier = 1.0;
        } else if (aiScore >= 50) {
          multiplier = 0.7 + (aiScore - 50) * 0.01; // 0.7 to 0.99
        } else if (aiScore >= 20) {
          multiplier = 0.35 + (aiScore - 20) * 0.0117; // 0.35 to 0.7
        } else {
          multiplier = 0.15 + aiScore * 0.01; // 0.15 to 0.34
        }

        const adjustedScore = Math.round(sc.score * multiplier);

        logger.info('AI role validation result', {
          candidate: sc.candidate.name,
          jobTitle: sc.candidate.jobTitle,
          originalScore: sc.score,
          aiScore,
          multiplier: multiplier.toFixed(2),
          adjustedScore,
        });

        return {
          ...sc,
          score: adjustedScore,
        };
      });

      // Re-sort by adjusted score and filter out very low scores
      const result = validated
        .filter(sc => sc.score > 10)
        .sort((a, b) => b.score - a.score);

      logger.info('AI role validation completed', {
        intentType: intent.intentType,
        roleArea,
        candidatesIn: scoredCandidates.length,
        candidatesOut: result.length,
      });

      return result;
    } catch (error) {
      logger.error('AI role validation failed, using original scores', { error });
      return scoredCandidates;
    }
  }

  /**
   * Generate explanations for top matches using LLM
   */
  private async generateMatchExplanations(
    intent: Awaited<ReturnType<typeof this.getIntentWithDetails>>,
    user: Awaited<ReturnType<typeof this.getUserProfile>>,
    scoredCandidates: ScoringResult[]
  ): Promise<MatchWithExplanation[]> {
    if (!intent || !user) return [];

    const results: MatchWithExplanation[] = [];
    const batchSize = 5;

    for (let i = 0; i < scoredCandidates.length; i += batchSize) {
      const batch = scoredCandidates.slice(i, i + batchSize);
      const batchResults = await Promise.allSettled(
        batch.map(async (scored) => {
          let reasons: string[];
          let suggestedMessage: string;
          let suggestedAction = 'Connect';
          let nextSteps: string[] = [];

          if (this.llmService.isAvailable()) {
            try {
              const explanation = await this.getCachedExplanation(
                intent!.id,
                scored.candidate.id,
                () => this.generateSingleExplanation(intent!, user!, scored)
              );
              reasons = explanation.reasons;
              suggestedMessage = explanation.suggestedMessage;
              suggestedAction = explanation.suggestedAction;
              nextSteps = explanation.nextSteps;
            } catch (error) {
              logger.warn('Failed to generate LLM explanation, using fallback', { error });
              const fallback = this.generateFallbackExplanation(intent!, scored);
              reasons = fallback.reasons;
              suggestedMessage = fallback.suggestedMessage;
              suggestedAction = fallback.suggestedAction;
              nextSteps = fallback.nextSteps;
            }
          } else {
            const fallback = this.generateFallbackExplanation(intent!, scored);
            reasons = fallback.reasons;
            suggestedMessage = fallback.suggestedMessage;
            suggestedAction = fallback.suggestedAction;
            nextSteps = fallback.nextSteps;
          }

          return {
            ...scored,
            reasons,
            suggestedAction,
            suggestedMessage,
            nextSteps,
          } as MatchWithExplanation;
        })
      );

      for (const result of batchResults) {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        }
      }
    }

    return results;
  }

  /**
   * Get cached explanation or generate and cache it
   */
  private async getCachedExplanation(
    intentId: string,
    candidateId: string,
    generator: () => Promise<{ reasons: string[]; suggestedAction: string; suggestedMessage: string; nextSteps: string[] }>
  ): Promise<{ reasons: string[]; suggestedAction: string; suggestedMessage: string; nextSteps: string[] }> {
    const cacheKey = `opportunity:explanation:${intentId}:${candidateId}`;
    const cached = await cacheService.get<{ reasons: string[]; suggestedAction: string; suggestedMessage: string; nextSteps: string[] }>(cacheKey);
    if (cached) {
      return cached;
    }
    const result = await generator();
    await cacheService.set(cacheKey, result, 1800); // 30 min TTL
    return result;
  }

  /**
   * Generate a single explanation using LLM
   */
  private async generateSingleExplanation(
    intent: Awaited<ReturnType<typeof this.getIntentWithDetails>>,
    user: Awaited<ReturnType<typeof this.getUserProfile>>,
    scored: ScoringResult
  ): Promise<{ reasons: string[]; suggestedMessage: string; suggestedAction: string; nextSteps: string[] }> {
    if (!intent || !user) {
      throw new Error('Intent or user not found');
    }

    const prompt = `
Analyze why this person would be a good match for the user's career opportunity.

User Intent: ${this.formatIntentType(intent.intentType)}
User is looking for: ${intent.roleArea || 'general opportunities'}
Target seniority: ${intent.seniority || 'any'}
Location preference: ${intent.locationPref || 'any'} ${intent.remoteOk ? '(remote OK)' : ''}
User's current role: ${user.jobTitle || 'Not specified'} at ${user.company || 'Not specified'}

Potential Match:
- Name: ${scored.candidate.name}
- Current Role: ${scored.candidate.jobTitle || 'Unknown'}
- Company: ${scored.candidate.company || 'Unknown'}
- Location: ${scored.candidate.location || 'Unknown'}
- Sectors: ${scored.candidate.sectors.join(', ') || 'None listed'}
- Skills: ${scored.candidate.skills.join(', ') || 'None listed'}
- Match score: ${scored.score}%

Shared sectors: ${scored.sharedSectors.join(', ') || 'None'}
Shared skills: ${scored.sharedSkills.join(', ') || 'None'}
Intent alignment: ${scored.intentAlignment}

Provide:
1. 3 specific reasons why this is a promising career opportunity match
2. A suggested action: "Connect" | "Request Intro" | "Schedule Call" | "Send Message"
3. A personalized outreach message (2-3 sentences, professional but warm tone)
4. 2-3 suggested next steps

Respond in JSON:
{
  "reasons": ["reason1", "reason2", "reason3"],
  "suggestedAction": "Connect",
  "suggestedMessage": "Your message here",
  "nextSteps": ["step1", "step2"]
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
        nextSteps: parsed.nextSteps || [],
      };
    }

    throw new Error('Failed to parse LLM response');
  }

  /**
   * Generate fallback explanation without LLM
   */
  private generateFallbackExplanation(
    intent: Awaited<ReturnType<typeof this.getIntentWithDetails>>,
    scored: ScoringResult
  ): { reasons: string[]; suggestedMessage: string; suggestedAction: string; nextSteps: string[] } {
    const reasons: string[] = [];

    // Add intent alignment reason
    if (scored.intentAlignment) {
      reasons.push(scored.intentAlignment);
    }

    // Add sector reason
    if (scored.sharedSectors.length > 0) {
      reasons.push(`Works in ${scored.sharedSectors.slice(0, 2).join(' and ')}`);
    }

    // Add skills reason
    if (scored.sharedSkills.length > 0) {
      reasons.push(`Has skills in ${scored.sharedSkills.slice(0, 3).join(', ')}`);
    }

    // Add company reason if available
    if (scored.candidate.company && reasons.length < 3) {
      reasons.push(`${scored.candidate.company} connection`);
    }

    // Ensure we have at least one reason
    if (reasons.length === 0) {
      reasons.push('Potential career opportunity based on profile');
    }

    const firstName = scored.candidate.name.split(' ')[0];
    const intentType = intent?.intentType || 'OPEN_TO_OPPORTUNITIES';

    // Generate appropriate message based on intent type
    let suggestedMessage: string;
    let suggestedAction: string;
    let nextSteps: string[];

    switch (intentType) {
      case 'HIRING':
        suggestedAction = 'Send Message';
        suggestedMessage = `Hi ${firstName}! I came across your profile and was impressed by your background${scored.sharedSkills.length > 0 ? ` in ${scored.sharedSkills[0]}` : ''}. We have an opportunity that might interest you. Would you be open to a brief chat?`;
        nextSteps = ['Review their full profile', 'Prepare role details', 'Schedule intro call'];
        break;

      case 'OPEN_TO_OPPORTUNITIES':
        suggestedAction = 'Connect';
        suggestedMessage = `Hi ${firstName}! I noticed you're ${scored.intentAlignment.toLowerCase() || 'in a great position'}. I'm exploring new opportunities and would love to connect and learn more about your work at ${scored.candidate.company || 'your company'}.`;
        nextSteps = ['Send connection request', 'Research their company', 'Prepare your pitch'];
        break;

      case 'ADVISORY_BOARD':
        suggestedAction = 'Request Intro';
        suggestedMessage = `Hi ${firstName}! Your experience ${scored.sharedSectors.length > 0 ? `in ${scored.sharedSectors[0]}` : 'is impressive'}. I'm looking for advisory guidance and believe your insights would be invaluable. Would you be open to a conversation?`;
        nextSteps = ['Prepare specific questions', 'Research their background', 'Propose meeting format'];
        break;

      case 'REFERRALS_ONLY':
        suggestedAction = 'Connect';
        suggestedMessage = `Hi ${firstName}! I'm always looking to expand my professional network with talented people${scored.sharedSectors.length > 0 ? ` in ${scored.sharedSectors[0]}` : ''}. Would love to connect and see if we can help each other out.`;
        nextSteps = ['Build relationship first', 'Identify mutual connections', 'Offer value before asking'];
        break;

      default:
        suggestedAction = 'Connect';
        suggestedMessage = `Hi ${firstName}! I came across your profile and thought we might have some interesting synergies. Would you be open to connecting?`;
        nextSteps = ['Send connection request', 'Engage with their content', 'Find common ground'];
    }

    return {
      reasons: reasons.slice(0, 3),
      suggestedAction,
      suggestedMessage,
      nextSteps,
    };
  }

  /**
   * Save matches to database
   */
  private async saveMatches(intentId: string, matches: MatchWithExplanation[]): Promise<OpportunityMatch[]> {
    // Use transaction to ensure old matches are only deleted if new ones save successfully
    return this.prisma.$transaction(async (tx) => {
      // Delete existing matches
      await tx.opportunityMatch.deleteMany({
        where: { intentId },
      });

      // Create new matches
      const savedMatches: OpportunityMatch[] = [];

      for (const match of matches) {
        try {
          const data: any = {
            intentId,
            matchScore: match.score,
            matchType: match.candidate.type,
            reasons: match.reasons,
            suggestedAction: match.suggestedAction,
            suggestedMessage: match.suggestedMessage,
            nextSteps: match.nextSteps,
            sharedSectors: match.sharedSectors,
            sharedSkills: match.sharedSkills,
            intentAlignment: match.intentAlignment,
            status: 'PENDING',
          };

          if (match.candidate.type === 'user') {
            data.matchedUserId = match.candidate.id;
          } else {
            data.matchedContactId = match.candidate.id;
          }

          const saved = await tx.opportunityMatch.create({ data });
          savedMatches.push(saved);
        } catch (error) {
          logger.warn('Failed to save opportunity match', { error, candidateId: match.candidate.id });
        }
      }

      return savedMatches;
    });
  }

  /**
   * Format intent type for display
   */
  private formatIntentType(intentType: OpportunityIntentType): string {
    const map: Record<OpportunityIntentType, string> = {
      HIRING: 'Hiring',
      OPEN_TO_OPPORTUNITIES: 'Open to Opportunities',
      ADVISORY_BOARD: 'Advisory/Board Roles',
      REFERRALS_ONLY: 'Referrals Only',
    };
    return map[intentType] || intentType;
  }

  /**
   * Format goal type for display
   */
  private formatGoalType(goalType: GoalType): string {
    const map: Record<GoalType, string> = {
      MENTORSHIP: 'Mentorship',
      INVESTMENT: 'Investment',
      PARTNERSHIP: 'Partnership',
      HIRING: 'Hiring',
      JOB_SEEKING: 'Job Seeking',
      COLLABORATION: 'Collaboration',
      LEARNING: 'Learning',
      SALES: 'Sales',
      OTHER: 'Other',
    };
    return map[goalType] || goalType;
  }

  /**
   * Call the LLM provider via shared service
   */
  private async callLLM(prompt: string): Promise<string> {
    const content = await this.llmService.callLLM(prompt, OPPORTUNITY_SYSTEM_PROMPT);
    if (!content) {
      throw new Error('No content in LLM response');
    }
    return content;
  }
}
