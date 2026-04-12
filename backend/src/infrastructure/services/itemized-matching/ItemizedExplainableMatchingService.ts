/**
 * Itemized Explainable Matching Service
 *
 * Main service that orchestrates per-criterion matching with detailed explanations.
 * No total score - each criterion gets its own 0-100% score.
 *
 * @module infrastructure/services/itemized-matching/ItemizedExplainableMatchingService
 */

import { v4 as uuidv4 } from 'uuid';
import { prisma } from '../../database/prisma/client';
import { cacheService, CACHE_TTL } from '../../cache/CacheService';
import { logger } from '../../../shared/logger';
import {
  IItemizedMatchingService,
  ItemizedMatchResult,
  ItemizedMatchListItem,
  ItemizedMatchOptions,
  ItemizedMatchType,
  CriterionMatch,
  MatchSummary,
  EntityRef,
  EntityType,
  SuggestedAction,
  IceBreaker,
} from '../../../domain/services/IItemizedMatchingService';
import {
  ICriterionCalculator,
  MatchingProfile,
  CalculationContext,
  CriterionResult,
} from './interfaces/ICriterionCalculator';
import { createProfileCriteria } from './criteria/ProfileCriteria';
import { createEventCriteria } from './criteria/EventCriteria';
import { getItemCriteria, classifyLookingFor } from './criteria/ItemCriteria';
import { createOpportunityCriteria } from './criteria/OpportunityCriteria';
import { createPitchCriteria } from './criteria/PitchCriteria';
import { sortCriteria, calculateSummary, generateConcerns } from './utils/ScoreUtils';

// Cache key prefix
const CACHE_PREFIX = 'itemized_match:';

/**
 * Itemized Explainable Matching Service
 */
export class ItemizedExplainableMatchingService implements IItemizedMatchingService {
  private profileCriteria: ICriterionCalculator[];
  private eventCriteria: ICriterionCalculator[];
  private opportunityCriteria: ICriterionCalculator[];
  private pitchCriteria: ICriterionCalculator[];

  constructor() {
    this.profileCriteria = createProfileCriteria();
    this.eventCriteria = createEventCriteria();
    this.opportunityCriteria = createOpportunityCriteria();
    this.pitchCriteria = createPitchCriteria();

    logger.info('[ItemizedMatching] Service initialized', {
      profileCriteriaCount: this.profileCriteria.length,
      eventCriteriaCount: this.eventCriteria.length,
      opportunityCriteriaCount: this.opportunityCriteria.length,
      pitchCriteriaCount: this.pitchCriteria.length,
    });
  }

  // ============================================
  // Profile Matching
  // ============================================

  async matchProfiles(
    userId: string,
    contactId: string,
    options?: ItemizedMatchOptions
  ): Promise<ItemizedMatchResult> {
    const matchType: ItemizedMatchType = 'PROFILE_TO_PROFILE';
    const cacheKey = `${CACHE_PREFIX}${matchType}:${userId}:${contactId}`;

    // Check cache
    if (options?.useCache !== false && !options?.forceRecalculate) {
      const cached = await cacheService.get<ItemizedMatchResult>(cacheKey);
      if (cached) {
        logger.debug('[ItemizedMatching] Cache hit', { userId, contactId });
        return cached;
      }
    }

    // Fetch user profile
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        userSectors: { include: { sector: true } },
        userSkills: { include: { skill: true } },
        userInterests: { include: { interest: true } },
        userHobbies: { include: { hobby: true } },
        userGoals: true,
      },
    });

    if (!user) {
      throw new Error(`User not found: ${userId}`);
    }

    // Fetch contact profile
    const contact = await prisma.contact.findFirst({
      where: { id: contactId, ownerId: userId },
      include: {
        contactSectors: { include: { sector: true } },
        contactSkills: { include: { skill: true } },
        contactInterests: { include: { interest: true } },
        contactHobbies: { include: { hobby: true } },
      },
    });

    if (!contact) {
      throw new Error(`Contact not found: ${contactId}`);
    }

    // Build matching profiles
    const sourceProfile = this.buildUserProfile(user);
    const targetProfile = this.buildContactProfile(contact);

    // Calculate criteria
    const context: CalculationContext = {
      matchType,
      isBatch: false,
      skipLlmEnhancement: options?.skipLlmEnhancement,
      includeRawData: options?.includeRawData,
    };

    const criteriaResults = await this.calculateCriteria(
      sourceProfile,
      targetProfile,
      this.profileCriteria.filter(c => c.isApplicable(matchType)),
      context
    );

    // Build result
    const result = this.buildMatchResult(
      matchType,
      { id: userId, name: user.fullName, type: 'USER' },
      { id: contactId, name: contact.fullName, type: 'CONTACT', metadata: { company: contact.company || undefined, jobTitle: contact.jobTitle || undefined } },
      criteriaResults
    );

    // Cache result
    await cacheService.set(cacheKey, result, CACHE_TTL.CONTACT_MATCHES);

    logger.info('[ItemizedMatching] Profile match calculated', {
      userId,
      contactId,
      criteriaCount: criteriaResults.length,
      perfectCount: result.summary.perfectMatches,
    });

    return result;
  }

  async matchUsers(
    userId1: string,
    userId2: string,
    options?: ItemizedMatchOptions
  ): Promise<ItemizedMatchResult> {
    const matchType: ItemizedMatchType = 'PROFILE_TO_USER';
    const cacheKey = `${CACHE_PREFIX}${matchType}:${userId1}:${userId2}`;

    // Check cache
    if (options?.useCache !== false && !options?.forceRecalculate) {
      const cached = await cacheService.get<ItemizedMatchResult>(cacheKey);
      if (cached) return cached;
    }

    // Fetch both user profiles
    const [user1, user2] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId1 },
        include: {
          userSectors: { include: { sector: true } },
          userSkills: { include: { skill: true } },
          userInterests: { include: { interest: true } },
          userHobbies: { include: { hobby: true } },
          userGoals: true,
        },
      }),
      prisma.user.findUnique({
        where: { id: userId2 },
        include: {
          userSectors: { include: { sector: true } },
          userSkills: { include: { skill: true } },
          userInterests: { include: { interest: true } },
          userHobbies: { include: { hobby: true } },
          userGoals: true,
        },
      }),
    ]);

    if (!user1 || !user2) {
      throw new Error('One or both users not found');
    }

    const sourceProfile = this.buildUserProfile(user1);
    const targetProfile = this.buildUserProfile(user2);

    const context: CalculationContext = {
      matchType,
      isBatch: false,
      skipLlmEnhancement: options?.skipLlmEnhancement,
      includeRawData: options?.includeRawData,
    };

    const criteriaResults = await this.calculateCriteria(
      sourceProfile,
      targetProfile,
      this.profileCriteria.filter(c => c.isApplicable(matchType)),
      context
    );

    const result = this.buildMatchResult(
      matchType,
      { id: userId1, name: user1.fullName, type: 'USER' },
      { id: userId2, name: user2.fullName, type: 'USER' },
      criteriaResults
    );

    await cacheService.set(cacheKey, result, CACHE_TTL.CONTACT_MATCHES);

    return result;
  }

  async batchMatchProfiles(
    userId: string,
    contactIds: string[],
    options?: ItemizedMatchOptions
  ): Promise<ItemizedMatchListItem[]> {
    // Fetch user profile once
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        userSectors: { include: { sector: true } },
        userSkills: { include: { skill: true } },
        userInterests: { include: { interest: true } },
        userHobbies: { include: { hobby: true } },
        userGoals: true,
      },
    });

    if (!user) {
      throw new Error(`User not found: ${userId}`);
    }

    // Fetch all contacts
    const contacts = await prisma.contact.findMany({
      where: { id: { in: contactIds }, ownerId: userId },
      include: {
        contactSectors: { include: { sector: true } },
        contactSkills: { include: { skill: true } },
        contactInterests: { include: { interest: true } },
        contactHobbies: { include: { hobby: true } },
      },
    });

    const sourceProfile = this.buildUserProfile(user);
    const applicableCriteria = this.profileCriteria.filter(c => c.isApplicable('PROFILE_TO_PROFILE'));

    const results: ItemizedMatchListItem[] = [];

    for (const contact of contacts) {
      const targetProfile = this.buildContactProfile(contact);

      const context: CalculationContext = {
        matchType: 'PROFILE_TO_PROFILE',
        isBatch: true,
        skipLlmEnhancement: true, // Skip LLM for batch
        includeRawData: false,
      };

      const criteriaResults = await this.calculateCriteria(
        sourceProfile,
        targetProfile,
        applicableCriteria,
        context
      );

      const sortedCriteria = sortCriteria(criteriaResults as CriterionMatch[]);
      const summary = calculateSummary(sortedCriteria);
      const concerns = generateConcerns(sortedCriteria);

      results.push({
        target: {
          id: contact.id,
          name: contact.fullName,
          type: 'CONTACT',
          metadata: {
            company: contact.company || undefined,
            jobTitle: contact.jobTitle || undefined,
          },
        },
        summary,
        topCriteria: sortedCriteria.slice(0, 3).map(c => ({
          id: c.id,
          name: c.name,
          icon: c.icon,
          score: c.score,
          status: c.status,
        })),
        primaryConcern: concerns[0],
        hasFullDetails: false,
      });
    }

    // Sort by number of perfect/excellent matches
    results.sort((a, b) => {
      const scoreA = a.summary.perfectMatches * 100 + a.summary.excellentMatches * 10 + a.summary.strongMatches;
      const scoreB = b.summary.perfectMatches * 100 + b.summary.excellentMatches * 10 + b.summary.strongMatches;
      return scoreB - scoreA;
    });

    return results;
  }

  // ============================================
  // Item Matching
  // ============================================

  async matchProjectToContact(
    projectId: string,
    contactId: string,
    matchType: 'PROJECT_TO_INVESTOR' | 'PROJECT_TO_PARTNER' | 'PROJECT_TO_TALENT' | 'PROJECT_TO_DYNAMIC',
    options?: ItemizedMatchOptions
  ): Promise<ItemizedMatchResult> {
    const cacheKey = `${CACHE_PREFIX}${matchType}:${projectId}:${contactId}`;

    // Check cache
    if (options?.useCache !== false && !options?.forceRecalculate) {
      const cached = await cacheService.get<ItemizedMatchResult>(cacheKey);
      if (cached) return cached;
    }

    // Fetch project
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        sectors: { include: { sector: true } },
        skillsNeeded: { include: { skill: true } },
        user: true,
      },
    });

    if (!project) {
      throw new Error(`Project not found: ${projectId}`);
    }

    // Fetch contact
    const contact = await prisma.contact.findUnique({
      where: { id: contactId },
      include: {
        contactSectors: { include: { sector: true } },
        contactSkills: { include: { skill: true } },
        contactInterests: { include: { interest: true } },
      },
    });

    if (!contact) {
      throw new Error(`Contact not found: ${contactId}`);
    }

    // Build profiles
    const projectProfile = this.buildProjectProfile(project);
    const contactProfile = this.buildContactProfile(contact);

    // Get appropriate criteria
    let criteria: ICriterionCalculator[];
    if (matchType === 'PROJECT_TO_DYNAMIC') {
      // Dynamic: criteria are already hand-picked by createProjectDynamicCriteria
      const lookingFor = projectProfile.rawData?.lookingFor || [];
      criteria = getItemCriteria(matchType, lookingFor);
      // No isApplicable filter needed - criteria were manually selected
    } else {
      criteria = getItemCriteria(matchType).filter(c => c.isApplicable(matchType));
    }

    const context: CalculationContext = {
      matchType,
      isBatch: false,
      skipLlmEnhancement: options?.skipLlmEnhancement,
      includeRawData: options?.includeRawData,
    };

    const criteriaResults = await this.calculateCriteria(
      projectProfile,
      contactProfile,
      criteria,
      context
    );

    // Contextualize criterion names for dynamic matching
    if (matchType === 'PROJECT_TO_DYNAMIC') {
      const lookingFor: string[] = projectProfile.rawData?.lookingFor || [];
      const categories = classifyLookingFor(lookingFor);
      this.contextualizeProjectCriteria(criteriaResults, projectProfile, lookingFor, categories);
    }

    const result = this.buildMatchResult(
      matchType,
      { id: projectId, name: project.title, type: 'PROJECT' },
      { id: contactId, name: contact.fullName, type: 'CONTACT', metadata: { company: contact.company || undefined, jobTitle: contact.jobTitle || undefined } },
      criteriaResults
    );

    await cacheService.set(cacheKey, result, CACHE_TTL.CONTACT_MATCHES);

    logger.info('[ItemizedMatching] Project match calculated', {
      projectId,
      contactId,
      matchType,
      criteriaCount: criteriaResults.length,
    });

    return result;
  }

  async matchJobToCandidate(
    jobId: string,
    contactId: string,
    options?: ItemizedMatchOptions
  ): Promise<ItemizedMatchResult> {
    // Job matching not implemented - no Job model in schema
    throw new Error('Job matching not available - no Job model in schema');
  }

  async matchDealToContact(
    dealId: string,
    contactId: string,
    matchType: 'DEAL_TO_BUYER' | 'DEAL_TO_PROVIDER',
    options?: ItemizedMatchOptions
  ): Promise<ItemizedMatchResult> {
    const cacheKey = `${CACHE_PREFIX}${matchType}:${dealId}:${contactId}`;

    // Check cache
    if (options?.useCache !== false && !options?.forceRecalculate) {
      const cached = await cacheService.get<ItemizedMatchResult>(cacheKey);
      if (cached) return cached;
    }

    // Fetch deal
    const deal = await prisma.dealRequest.findUnique({
      where: { id: dealId },
      include: {
        user: true,
      },
    });

    if (!deal) {
      throw new Error(`Deal not found: ${dealId}`);
    }

    // Fetch contact
    const contact = await prisma.contact.findUnique({
      where: { id: contactId },
      include: {
        contactSectors: { include: { sector: true } },
        contactSkills: { include: { skill: true } },
      },
    });

    if (!contact) {
      throw new Error(`Contact not found: ${contactId}`);
    }

    // Build profiles
    const dealProfile = this.buildDealProfile(deal);
    const contactProfile = this.buildContactProfile(contact);

    // Get appropriate criteria
    const criteria = getItemCriteria(matchType).filter(c => c.isApplicable(matchType));

    const context: CalculationContext = {
      matchType,
      isBatch: false,
      skipLlmEnhancement: options?.skipLlmEnhancement,
      includeRawData: options?.includeRawData,
    };

    const criteriaResults = await this.calculateCriteria(
      dealProfile,
      contactProfile,
      criteria,
      context
    );

    const result = this.buildMatchResult(
      matchType,
      { id: dealId, name: deal.title || 'Deal', type: deal.mode === 'SELL' ? 'DEAL_SELL' : 'DEAL_BUY' },
      { id: contactId, name: contact.fullName, type: 'CONTACT', metadata: { company: contact.company || undefined, jobTitle: contact.jobTitle || undefined } },
      criteriaResults
    );

    await cacheService.set(cacheKey, result, CACHE_TTL.CONTACT_MATCHES);

    logger.info('[ItemizedMatching] Deal match calculated', {
      dealId,
      contactId,
      matchType,
      criteriaCount: criteriaResults.length,
    });

    return result;
  }

  async batchMatchItemToContacts(
    itemId: string,
    itemType: 'PROJECT' | 'JOB' | 'DEAL',
    contactIds: string[],
    options?: ItemizedMatchOptions
  ): Promise<ItemizedMatchListItem[]> {
    if (itemType === 'JOB') {
      throw new Error('Job matching not available');
    }

    const results: ItemizedMatchListItem[] = [];

    // Fetch item and contacts based on type
    if (itemType === 'PROJECT') {
      const project = await prisma.project.findUnique({
        where: { id: itemId },
        include: {
          sectors: { include: { sector: true } },
          skillsNeeded: { include: { skill: true } },
        },
      });

      if (!project) throw new Error(`Project not found: ${itemId}`);

      const contacts = await prisma.contact.findMany({
        where: { id: { in: contactIds } },
        include: {
          contactSectors: { include: { sector: true } },
          contactSkills: { include: { skill: true } },
        },
      });

      const projectProfile = this.buildProjectProfile(project);
      // Use dynamic matching to auto-detect criteria from project's lookingFor
      const lookingFor = projectProfile.rawData?.lookingFor || [];
      const categories = classifyLookingFor(lookingFor);
      const matchType: ItemizedMatchType = 'PROJECT_TO_DYNAMIC';
      const criteria = getItemCriteria(matchType, lookingFor);

      for (const contact of contacts) {
        const contactProfile = this.buildContactProfile(contact);
        const context: CalculationContext = {
          matchType,
          isBatch: true,
          skipLlmEnhancement: true,
          includeRawData: false,
        };

        const criteriaResults = await this.calculateCriteria(projectProfile, contactProfile, criteria, context);
        // Contextualize criterion names for dynamic matching
        this.contextualizeProjectCriteria(criteriaResults, projectProfile, lookingFor, categories);
        const sortedCriteria = sortCriteria(criteriaResults as CriterionMatch[]);
        const summary = calculateSummary(sortedCriteria);
        const concerns = generateConcerns(sortedCriteria);

        results.push({
          target: {
            id: contact.id,
            name: contact.fullName,
            type: 'CONTACT',
            metadata: { company: contact.company || undefined, jobTitle: contact.jobTitle || undefined },
          },
          summary,
          topCriteria: sortedCriteria.slice(0, 3).map(c => ({
            id: c.id,
            name: c.name,
            icon: c.icon,
            score: c.score,
            status: c.status,
          })),
          primaryConcern: concerns[0],
          hasFullDetails: false,
        });
      }
    } else if (itemType === 'DEAL') {
      const deal = await prisma.dealRequest.findUnique({
        where: { id: itemId },
      });

      if (!deal) throw new Error(`Deal not found: ${itemId}`);

      const contacts = await prisma.contact.findMany({
        where: { id: { in: contactIds } },
        include: {
          contactSectors: { include: { sector: true } },
          contactSkills: { include: { skill: true } },
        },
      });

      const dealProfile = this.buildDealProfile(deal);
      const matchType: ItemizedMatchType = deal.mode === 'BUY' ? 'DEAL_TO_PROVIDER' : 'DEAL_TO_BUYER';
      const criteria = getItemCriteria(matchType).filter(c => c.isApplicable(matchType));

      for (const contact of contacts) {
        const contactProfile = this.buildContactProfile(contact);
        const context: CalculationContext = {
          matchType,
          isBatch: true,
          skipLlmEnhancement: true,
          includeRawData: false,
        };

        const criteriaResults = await this.calculateCriteria(dealProfile, contactProfile, criteria, context);
        const sortedCriteria = sortCriteria(criteriaResults as CriterionMatch[]);
        const summary = calculateSummary(sortedCriteria);
        const concerns = generateConcerns(sortedCriteria);

        results.push({
          target: {
            id: contact.id,
            name: contact.fullName,
            type: 'CONTACT',
            metadata: { company: contact.company || undefined, jobTitle: contact.jobTitle || undefined },
          },
          summary,
          topCriteria: sortedCriteria.slice(0, 3).map(c => ({
            id: c.id,
            name: c.name,
            icon: c.icon,
            score: c.score,
            status: c.status,
          })),
          primaryConcern: concerns[0],
          hasFullDetails: false,
        });
      }
    }

    // Sort by critical criteria met, then perfect matches
    results.sort((a, b) => {
      const scoreA = a.summary.criticalMet * 100 + a.summary.perfectMatches * 10 + a.summary.excellentMatches;
      const scoreB = b.summary.criticalMet * 100 + b.summary.perfectMatches * 10 + b.summary.excellentMatches;
      return scoreB - scoreA;
    });

    return results;
  }

  // ============================================
  // Event Matching
  // ============================================

  async matchEventAttendees(
    attendeeId: string,
    otherAttendeeId: string,
    eventId: string,
    options?: ItemizedMatchOptions
  ): Promise<ItemizedMatchResult> {
    const matchType: ItemizedMatchType = 'EVENT_ATTENDEE_MATCH';
    const cacheKey = `${CACHE_PREFIX}${matchType}:${eventId}:${attendeeId}:${otherAttendeeId}`;

    // Check cache
    if (options?.useCache !== false && !options?.forceRecalculate) {
      const cached = await cacheService.get<ItemizedMatchResult>(cacheKey);
      if (cached) return cached;
    }

    // Fetch attendees
    const [attendee, otherAttendee] = await Promise.all([
      prisma.eventAttendee.findUnique({ where: { id: attendeeId } }),
      prisma.eventAttendee.findUnique({ where: { id: otherAttendeeId } }),
    ]);

    if (!attendee || !otherAttendee) {
      throw new Error('One or both attendees not found');
    }

    const sourceProfile = this.buildEventAttendeeProfile(attendee);
    const targetProfile = this.buildEventAttendeeProfile(otherAttendee);

    const context: CalculationContext = {
      matchType,
      isBatch: false,
      skipLlmEnhancement: options?.skipLlmEnhancement,
      includeRawData: options?.includeRawData,
    };

    const criteriaResults = await this.calculateCriteria(
      sourceProfile,
      targetProfile,
      this.eventCriteria.filter(c => c.isApplicable(matchType)),
      context
    );

    const result = this.buildMatchResult(
      matchType,
      { id: attendeeId, name: attendee.name, type: 'EVENT_ATTENDEE', metadata: { company: attendee.company || undefined, jobTitle: attendee.role || undefined } },
      { id: otherAttendeeId, name: otherAttendee.name, type: 'EVENT_ATTENDEE', metadata: { company: otherAttendee.company || undefined, jobTitle: otherAttendee.role || undefined } },
      criteriaResults
    );

    // Generate event-specific ice breakers
    result.iceBreakers = this.generateEventIceBreakers(sourceProfile, targetProfile, criteriaResults);

    await cacheService.set(cacheKey, result, CACHE_TTL.CONTACT_MATCHES);

    return result;
  }

  async getEventAttendeeMatches(
    attendeeId: string,
    eventId: string,
    options?: ItemizedMatchOptions
  ): Promise<ItemizedMatchListItem[]> {
    // Get all other attendees
    const otherAttendees = await prisma.eventAttendee.findMany({
      where: { eventId, id: { not: attendeeId } },
    });

    // Get source attendee
    const attendee = await prisma.eventAttendee.findUnique({ where: { id: attendeeId } });
    if (!attendee) throw new Error('Attendee not found');

    const sourceProfile = this.buildEventAttendeeProfile(attendee);
    const applicableCriteria = this.eventCriteria.filter(c => c.isApplicable('EVENT_ATTENDEE_MATCH'));

    const results: ItemizedMatchListItem[] = [];

    for (const other of otherAttendees) {
      const targetProfile = this.buildEventAttendeeProfile(other);

      const context: CalculationContext = {
        matchType: 'EVENT_ATTENDEE_MATCH',
        isBatch: true,
        skipLlmEnhancement: true,
        includeRawData: false,
      };

      const criteriaResults = await this.calculateCriteria(
        sourceProfile,
        targetProfile,
        applicableCriteria,
        context
      );

      const sortedCriteria = sortCriteria(criteriaResults as CriterionMatch[]);
      const summary = calculateSummary(sortedCriteria);
      const concerns = generateConcerns(sortedCriteria);

      results.push({
        target: {
          id: other.id,
          name: other.name,
          type: 'EVENT_ATTENDEE',
          metadata: {
            company: other.company || undefined,
            jobTitle: other.role || undefined,
          },
        },
        summary,
        topCriteria: sortedCriteria.slice(0, 3).map(c => ({
          id: c.id,
          name: c.name,
          icon: c.icon,
          score: c.score,
          status: c.status,
        })),
        primaryConcern: concerns[0],
        hasFullDetails: false,
      });
    }

    // Sort by complementary goals first (most important for events)
    results.sort((a, b) => {
      const scoreA = a.summary.criticalMet * 100 + a.summary.perfectMatches * 10 + a.summary.excellentMatches;
      const scoreB = b.summary.criticalMet * 100 + b.summary.perfectMatches * 10 + b.summary.excellentMatches;
      return scoreB - scoreA;
    });

    return results;
  }

  // ============================================
  // Opportunity Matching (HIRING <-> OPEN_TO_OPPORTUNITIES)
  // ============================================

  async matchOpportunityToCandidate(
    opportunityId: string,
    candidateId: string,
    candidateType: 'CONTACT' | 'USER',
    options?: ItemizedMatchOptions
  ): Promise<ItemizedMatchResult> {
    const matchType: ItemizedMatchType = 'OPPORTUNITY_TO_CANDIDATE';
    const cacheKey = `${CACHE_PREFIX}${matchType}:${opportunityId}:${candidateId}`;

    // Check cache
    if (options?.useCache !== false && !options?.forceRecalculate) {
      const cached = await cacheService.get<ItemizedMatchResult>(cacheKey);
      if (cached) return cached;
    }

    // Fetch opportunity with relations
    const opportunity = await prisma.opportunityIntent.findUnique({
      where: { id: opportunityId },
      include: {
        sectorPrefs: { include: { sector: true } },
        skillPrefs: { include: { skill: true } },
        user: true,
      },
    });

    if (!opportunity) {
      throw new Error(`Opportunity not found: ${opportunityId}`);
    }

    // Build opportunity profile
    const opportunityProfile = this.buildOpportunityProfile(opportunity);

    // Fetch candidate and build profile
    let candidateProfile: MatchingProfile;
    let candidateName: string;
    let candidateMetadata: { company?: string; jobTitle?: string } = {};

    if (candidateType === 'CONTACT') {
      const contact = await prisma.contact.findUnique({
        where: { id: candidateId },
        include: {
          contactSectors: { include: { sector: true } },
          contactSkills: { include: { skill: true } },
        },
      });

      if (!contact) {
        throw new Error(`Contact not found: ${candidateId}`);
      }

      candidateProfile = this.buildContactProfile(contact);
      candidateName = contact.fullName;
      candidateMetadata = {
        company: contact.company || undefined,
        jobTitle: contact.jobTitle || undefined,
      };
    } else {
      const user = await prisma.user.findUnique({
        where: { id: candidateId },
        include: {
          userSectors: { include: { sector: true } },
          userSkills: { include: { skill: true } },
        },
      });

      if (!user) {
        throw new Error(`User not found: ${candidateId}`);
      }

      candidateProfile = this.buildUserProfile(user);
      candidateName = user.fullName;
      candidateMetadata = {
        company: user.company || undefined,
        jobTitle: user.jobTitle || undefined,
      };
    }

    // Get applicable criteria
    const criteria = this.opportunityCriteria.filter(c => c.isApplicable(matchType));

    const context: CalculationContext = {
      matchType,
      isBatch: false,
      skipLlmEnhancement: options?.skipLlmEnhancement,
      includeRawData: options?.includeRawData,
    };

    const criteriaResults = await this.calculateCriteria(
      opportunityProfile,
      candidateProfile,
      criteria,
      context
    );

    const result = this.buildMatchResult(
      matchType,
      {
        id: opportunityId,
        name: opportunity.title,
        type: 'OPPORTUNITY',
        metadata: { company: opportunity.user.company || undefined, jobTitle: opportunity.roleArea || undefined },
      },
      {
        id: candidateId,
        name: candidateName,
        type: candidateType,
        metadata: candidateMetadata,
      },
      criteriaResults
    );

    await cacheService.set(cacheKey, result, CACHE_TTL.CONTACT_MATCHES);

    logger.info('[ItemizedMatching] Opportunity match calculated', {
      opportunityId,
      candidateId,
      candidateType,
      criteriaCount: criteriaResults.length,
      criticalMet: result.summary.criticalMet,
    });

    return result;
  }

  async getOpportunityCandidates(
    opportunityId: string,
    candidateType: 'CONTACT' | 'USER',
    options?: ItemizedMatchOptions
  ): Promise<ItemizedMatchListItem[]> {
    // Fetch opportunity
    const opportunity = await prisma.opportunityIntent.findUnique({
      where: { id: opportunityId },
      include: {
        sectorPrefs: { include: { sector: true } },
        skillPrefs: { include: { skill: true } },
        user: true,
      },
    });

    if (!opportunity) {
      throw new Error(`Opportunity not found: ${opportunityId}`);
    }

    const opportunityProfile = this.buildOpportunityProfile(opportunity);
    const matchType: ItemizedMatchType = 'OPPORTUNITY_TO_CANDIDATE';
    const applicableCriteria = this.opportunityCriteria.filter(c => c.isApplicable(matchType));

    const results: ItemizedMatchListItem[] = [];

    if (candidateType === 'CONTACT') {
      // Match against user's contacts
      const contacts = await prisma.contact.findMany({
        where: { ownerId: opportunity.userId },
        include: {
          contactSectors: { include: { sector: true } },
          contactSkills: { include: { skill: true } },
        },
        take: 100, // Limit for performance
      });

      for (const contact of contacts) {
        const candidateProfile = this.buildContactProfile(contact);

        const context: CalculationContext = {
          matchType,
          isBatch: true,
          skipLlmEnhancement: true,
          includeRawData: false,
        };

        const criteriaResults = await this.calculateCriteria(
          opportunityProfile,
          candidateProfile,
          applicableCriteria,
          context
        );

        const sortedCriteria = sortCriteria(criteriaResults as CriterionMatch[]);
        const summary = calculateSummary(sortedCriteria);
        const concerns = generateConcerns(sortedCriteria);

        results.push({
          target: {
            id: contact.id,
            name: contact.fullName,
            type: 'CONTACT',
            metadata: {
              company: contact.company || undefined,
              jobTitle: contact.jobTitle || undefined,
            },
          },
          summary,
          topCriteria: sortedCriteria.slice(0, 3).map(c => ({
            id: c.id,
            name: c.name,
            icon: c.icon,
            score: c.score,
            status: c.status,
          })),
          primaryConcern: concerns[0],
          hasFullDetails: false,
        });
      }
    } else {
      // Match against users with OPEN_TO_OPPORTUNITIES intent
      const users = await prisma.user.findMany({
        where: {
          opportunityIntents: {
            some: {
              intentType: 'OPEN_TO_OPPORTUNITIES',
              isActive: true,
            },
          },
        },
        include: {
          userSectors: { include: { sector: true } },
          userSkills: { include: { skill: true } },
        },
        take: 100,
      });

      for (const user of users) {
        const candidateProfile = this.buildUserProfile(user);

        const context: CalculationContext = {
          matchType,
          isBatch: true,
          skipLlmEnhancement: true,
          includeRawData: false,
        };

        const criteriaResults = await this.calculateCriteria(
          opportunityProfile,
          candidateProfile,
          applicableCriteria,
          context
        );

        const sortedCriteria = sortCriteria(criteriaResults as CriterionMatch[]);
        const summary = calculateSummary(sortedCriteria);
        const concerns = generateConcerns(sortedCriteria);

        results.push({
          target: {
            id: user.id,
            name: user.fullName,
            type: 'USER',
            metadata: {
              company: user.company || undefined,
              jobTitle: user.jobTitle || undefined,
            },
          },
          summary,
          topCriteria: sortedCriteria.slice(0, 3).map(c => ({
            id: c.id,
            name: c.name,
            icon: c.icon,
            score: c.score,
            status: c.status,
          })),
          primaryConcern: concerns[0],
          hasFullDetails: false,
        });
      }
    }

    // Sort by critical criteria met, then perfect matches
    results.sort((a, b) => {
      const scoreA = a.summary.criticalMet * 100 + a.summary.perfectMatches * 10 + a.summary.excellentMatches;
      const scoreB = b.summary.criticalMet * 100 + b.summary.perfectMatches * 10 + b.summary.excellentMatches;
      return scoreB - scoreA;
    });

    logger.info('[ItemizedMatching] Opportunity candidates fetched', {
      opportunityId,
      candidateType,
      candidateCount: results.length,
    });

    return results;
  }

  // ============================================
  // Cache Management
  // ============================================

  async invalidateUserCache(userId: string): Promise<void> {
    // Invalidate all matches involving this user
    const pattern = `${CACHE_PREFIX}*:${userId}:*`;
    await cacheService.deletePattern?.(pattern) || Promise.resolve();
    logger.info('[ItemizedMatching] User cache invalidated', { userId });
  }

  async invalidateContactCache(contactId: string): Promise<void> {
    const pattern = `${CACHE_PREFIX}*:*:${contactId}`;
    await cacheService.deletePattern?.(pattern) || Promise.resolve();
    logger.info('[ItemizedMatching] Contact cache invalidated', { contactId });
  }

  async invalidateItemCache(itemId: string, itemType: 'PROJECT' | 'JOB' | 'DEAL'): Promise<void> {
    const pattern = `${CACHE_PREFIX}*:${itemId}:*`;
    await cacheService.deletePattern?.(pattern) || Promise.resolve();
    logger.info('[ItemizedMatching] Item cache invalidated', { itemId, itemType });
  }

  // ============================================
  // Private Helper Methods
  // ============================================

  private buildUserProfile(user: any): MatchingProfile {
    return {
      id: user.id,
      type: 'USER',
      name: user.fullName,
      bio: user.bio || undefined,
      company: user.company || undefined,
      jobTitle: user.jobTitle || undefined,
      location: user.location || undefined,
      sectors: user.userSectors?.map((s: any) => s.sector?.name).filter(Boolean) || [],
      skills: user.userSkills?.map((s: any) => s.skill?.name).filter(Boolean) || [],
      interests: user.userInterests?.map((i: any) => i.interest?.name).filter(Boolean) || [],
      hobbies: user.userHobbies?.map((h: any) => h.hobby?.name).filter(Boolean) || [],
      goals: user.userGoals?.map((g: any) => g.goalType).filter(Boolean) || [],
      rawData: user,
    };
  }

  private buildContactProfile(contact: any): MatchingProfile {
    return {
      id: contact.id,
      type: 'CONTACT',
      name: contact.fullName,
      bio: contact.bio || undefined,
      company: contact.company || undefined,
      jobTitle: contact.jobTitle || undefined,
      location: contact.location || undefined,
      sectors: contact.contactSectors?.map((s: any) => s.sector?.name).filter(Boolean) || [],
      skills: contact.contactSkills?.map((s: any) => s.skill?.name).filter(Boolean) || [],
      interests: contact.contactInterests?.map((i: any) => i.interest?.name).filter(Boolean) || [],
      hobbies: contact.contactHobbies?.map((h: any) => h.hobby?.name).filter(Boolean) || [],
      rawData: contact,
    };
  }

  private buildProjectProfile(project: any): MatchingProfile {
    // Parse lookingFor JSON if it exists
    let lookingFor: string[] = [];
    if (project.lookingFor) {
      const parsed = typeof project.lookingFor === 'string'
        ? JSON.parse(project.lookingFor)
        : project.lookingFor;
      if (Array.isArray(parsed)) {
        lookingFor = parsed;
      }
    }

    // Parse keywords JSON
    let keywords: string[] = [];
    if (project.keywords) {
      const parsed = typeof project.keywords === 'string'
        ? JSON.parse(project.keywords)
        : project.keywords;
      if (Array.isArray(parsed)) {
        keywords = parsed;
      }
    }

    // Build skillsByImportance from ProjectSkill importance levels
    const skillsByImportance: { required: string[]; preferred: string[]; niceToHave: string[] } = {
      required: [],
      preferred: [],
      niceToHave: [],
    };

    if (project.skillsNeeded && Array.isArray(project.skillsNeeded)) {
      for (const ps of project.skillsNeeded) {
        const skillName = ps.skill?.name;
        if (!skillName) continue;
        switch (ps.importance) {
          case 'REQUIRED':
            skillsByImportance.required.push(skillName);
            break;
          case 'PREFERRED':
            skillsByImportance.preferred.push(skillName);
            break;
          case 'NICE_TO_HAVE':
            skillsByImportance.niceToHave.push(skillName);
            break;
          default:
            // Default to preferred if no importance set
            skillsByImportance.preferred.push(skillName);
        }
      }
    }

    return {
      id: project.id,
      type: 'PROJECT',
      name: project.title,
      bio: project.summary || undefined,
      location: project.user?.location || undefined,
      sectors: project.sectors?.map((s: any) => s.sector?.name).filter(Boolean) || [],
      skills: keywords,
      interests: [],
      hobbies: [],
      requiredSkills: project.skillsNeeded?.map((s: any) => s.skill?.name).filter(Boolean) || [],
      stage: project.stage || undefined,
      investmentRange: project.investmentRange || undefined,
      rawData: {
        ...project,
        lookingFor,
        keywords,
        summary: project.summary,
        detailedDesc: project.detailedDesc,
        skillsByImportance,
      },
    };
  }

  private buildDealProfile(deal: any): MatchingProfile {
    return {
      id: deal.id,
      type: 'DEAL',
      name: deal.title || 'Deal Request',
      bio: deal.problemStatement || deal.targetDescription || undefined,
      sectors: deal.domain ? [deal.domain] : [],
      skills: deal.solutionType ? [deal.solutionType] : [],
      interests: [],
      hobbies: [],
      rawData: {
        ...deal,
        domain: deal.domain,
        solutionType: deal.solutionType,
        companySize: deal.companySize,
        problemStatement: deal.problemStatement,
        targetEntityType: deal.targetEntityType,
        targetDescription: deal.targetDescription,
        mode: deal.mode,
      },
    };
  }

  private buildEventAttendeeProfile(attendee: any): MatchingProfile {
    return {
      id: attendee.id,
      type: 'EVENT_ATTENDEE',
      name: attendee.name,
      bio: attendee.bio || undefined,
      company: attendee.company || undefined,
      jobTitle: attendee.role || undefined,
      lookingFor: attendee.lookingFor || undefined,
      sectors: [], // Events don't have sector data typically
      skills: [], // Could parse from bio if needed
      interests: [],
      hobbies: [],
      rawData: attendee,
    };
  }

  private buildPitchProfile(pitch: any): MatchingProfile {
    // Aggregate sectors, skills, keywords from all PitchSections
    const sectors = new Set<string>();
    const skills = new Set<string>();

    if (pitch.sections && Array.isArray(pitch.sections)) {
      for (const section of pitch.sections) {
        // inferredSectors is a JSON field
        const sectorData = typeof section.inferredSectors === 'string'
          ? this.safeJsonParse(section.inferredSectors)
          : section.inferredSectors;
        if (Array.isArray(sectorData)) {
          sectorData.forEach((s: string) => sectors.add(s));
        }

        // inferredSkills is a JSON field
        const skillData = typeof section.inferredSkills === 'string'
          ? this.safeJsonParse(section.inferredSkills)
          : section.inferredSkills;
        if (Array.isArray(skillData)) {
          skillData.forEach((s: string) => skills.add(s));
        }

        // keywords is a JSON field
        const keywordData = typeof section.keywords === 'string'
          ? this.safeJsonParse(section.keywords)
          : section.keywords;
        if (Array.isArray(keywordData)) {
          keywordData.forEach((k: string) => skills.add(k));
        }
      }
    }

    const bio = [pitch.title, pitch.companyName].filter(Boolean).join(' - ');

    return {
      id: pitch.id,
      type: 'PITCH',
      name: pitch.title || 'Pitch Deck',
      bio: bio || undefined,
      company: pitch.companyName || undefined,
      location: pitch.user?.location || undefined,
      sectors: [...sectors],
      skills: [...skills],
      interests: [],
      hobbies: [],
      rawData: {
        ...pitch,
        summary: bio,
      },
    };
  }

  private safeJsonParse(str: string): any {
    try {
      return JSON.parse(str);
    } catch {
      return null;
    }
  }

  /**
   * Match a pitch deck to a contact using itemized criteria
   */
  async matchPitchToContact(
    pitchId: string,
    contactId: string,
    options?: ItemizedMatchOptions
  ): Promise<ItemizedMatchResult> {
    const matchType: ItemizedMatchType = 'PITCH_TO_CONTACT';
    const cacheKey = `${CACHE_PREFIX}${matchType}:${pitchId}:${contactId}`;

    // Check cache
    if (options?.useCache !== false && !options?.forceRecalculate) {
      const cached = await cacheService.get<ItemizedMatchResult>(cacheKey);
      if (cached) return cached;
    }

    // Fetch pitch with sections
    const pitch = await prisma.pitch.findUnique({
      where: { id: pitchId },
      include: {
        sections: true,
        user: true,
      },
    });

    if (!pitch) {
      throw new Error(`Pitch not found: ${pitchId}`);
    }

    // Fetch contact
    const contact = await prisma.contact.findUnique({
      where: { id: contactId },
      include: {
        contactSectors: { include: { sector: true } },
        contactSkills: { include: { skill: true } },
        contactInterests: { include: { interest: true } },
      },
    });

    if (!contact) {
      throw new Error(`Contact not found: ${contactId}`);
    }

    // Build profiles
    const pitchProfile = this.buildPitchProfile(pitch);
    const contactProfile = this.buildContactProfile(contact);

    // Get applicable criteria
    const criteria = this.pitchCriteria.filter(c => c.isApplicable(matchType));

    const context: CalculationContext = {
      matchType,
      isBatch: false,
      skipLlmEnhancement: options?.skipLlmEnhancement,
      includeRawData: options?.includeRawData,
    };

    const criteriaResults = await this.calculateCriteria(
      pitchProfile,
      contactProfile,
      criteria,
      context
    );

    const result = this.buildMatchResult(
      matchType,
      {
        id: pitchId,
        name: pitch.title || 'Pitch Deck',
        type: 'PITCH',
        metadata: { company: pitch.companyName || undefined },
      },
      {
        id: contactId,
        name: contact.fullName,
        type: 'CONTACT',
        metadata: { company: contact.company || undefined, jobTitle: contact.jobTitle || undefined },
      },
      criteriaResults
    );

    await cacheService.set(cacheKey, result, CACHE_TTL.CONTACT_MATCHES);

    logger.info('[ItemizedMatching] Pitch match calculated', {
      pitchId,
      contactId,
      criteriaCount: criteriaResults.length,
      criticalMet: result.summary.criticalMet,
    });

    return result;
  }

  private buildOpportunityProfile(opportunity: any): MatchingProfile {
    return {
      id: opportunity.id,
      type: 'OPPORTUNITY',
      name: opportunity.title,
      bio: opportunity.notes || undefined,
      company: opportunity.user?.company || undefined,
      jobTitle: opportunity.roleArea || undefined,
      location: opportunity.locationPref || undefined,
      sectors: opportunity.sectorPrefs?.map((s: any) => s.sector?.name).filter(Boolean) || [],
      skills: opportunity.skillPrefs?.map((s: any) => s.skill?.name).filter(Boolean) || [],
      interests: [],
      hobbies: [],
      rawData: {
        ...opportunity,
        intentType: opportunity.intentType,
        roleArea: opportunity.roleArea,
        seniority: opportunity.seniority,
        locationPref: opportunity.locationPref,
        remoteOk: opportunity.remoteOk,
      },
    };
  }

  /**
   * Contextualize criterion names for dynamic project matching.
   * Replaces generic names like "Stage Fit" with project-specific names
   * based on lookingFor entries, stage, and skills.
   */
  private contextualizeProjectCriteria(
    results: CriterionResult[],
    projectProfile: MatchingProfile,
    lookingFor: string[],
    categories: Set<string>
  ): void {
    const stage = projectProfile.stage || '';
    const lookingForStr = lookingFor.join(', ');

    // Find talent-related lookingFor entries for naming
    const talentEntry = lookingFor.find(lf => {
      const lower = lf.toLowerCase();
      return ['co-founder', 'cofounder', 'developer', 'engineer', 'designer',
        'cto', 'cfo', 'cmo', 'manager', 'marketing', 'sales', 'technical',
        'growth', 'hire', 'talent', 'team', 'recruit'].some(kw => lower.includes(kw));
    });

    for (const result of results) {
      switch (result.id) {
        case 'industry_fit':
          if (categories.has('INVESTMENT')) {
            result.name = 'Investor Sector Fit';
            result.icon = '🏢';
          } else if (categories.has('TALENT')) {
            result.name = 'Industry Experience';
            result.icon = '🏭';
          } else {
            result.name = 'Sector Alignment';
            result.icon = '🏢';
          }
          break;

        case 'stage_fit':
          if (stage) {
            // Capitalize stage name
            const stageName = stage.charAt(0).toUpperCase() + stage.slice(1).toLowerCase().replace(/_/g, ' ');
            result.name = `${stageName} Stage Readiness`;
          } else {
            result.name = 'Investment Stage Match';
          }
          result.icon = '📈';
          break;

        case 'check_size':
          if (projectProfile.investmentRange) {
            result.name = `${projectProfile.investmentRange} Funding Fit`;
          } else {
            result.name = 'Investment Size Match';
          }
          result.icon = '💰';
          break;

        case 'thesis_fit':
          if (categories.has('INVESTMENT')) {
            result.name = 'Investment Thesis Alignment';
          } else {
            result.name = 'Vision & Strategy Fit';
          }
          result.icon = '🎯';
          break;

        case 'geography':
          if (categories.has('INVESTMENT')) {
            result.name = 'Investor Geo Coverage';
          } else {
            result.name = 'Geographic Reach';
          }
          result.icon = '🌍';
          break;

        case 'project_skills_fit':
          if (talentEntry) {
            // Use the actual looking-for entry: e.g., "CTO Skills Match"
            const shortEntry = talentEntry.length > 25
              ? talentEntry.substring(0, 22) + '...'
              : talentEntry;
            result.name = `${shortEntry} Skills`;
          } else {
            result.name = 'Required Skills Match';
          }
          result.icon = '🛠️';
          break;

        case 'location':
          if (categories.has('TALENT')) {
            result.name = 'Candidate Location';
          } else {
            result.name = 'Location Proximity';
          }
          result.icon = '📍';
          break;

        case 'experience':
          if (talentEntry) {
            result.name = `${talentEntry.length > 20 ? 'Role' : talentEntry} Experience`;
          } else {
            result.name = 'Seniority & Experience';
          }
          result.icon = '📊';
          break;

        case 'network':
          result.name = 'Warm Intro Potential';
          result.icon = '🤝';
          break;
      }
    }
  }

  private async calculateCriteria(
    source: MatchingProfile,
    target: MatchingProfile,
    criteria: ICriterionCalculator[],
    context: CalculationContext
  ): Promise<CriterionResult[]> {
    const results: CriterionResult[] = [];

    for (const criterion of criteria) {
      try {
        const result = await criterion.calculate(source, target, context);
        results.push(result);
      } catch (error) {
        logger.error(`[ItemizedMatching] Criterion calculation failed: ${criterion.id}`, { error });
        // Continue with other criteria
      }
    }

    return results;
  }

  private buildMatchResult(
    matchType: ItemizedMatchType,
    source: EntityRef,
    target: EntityRef,
    criteriaResults: CriterionResult[]
  ): ItemizedMatchResult {
    const criteria = sortCriteria(criteriaResults as CriterionMatch[]);
    const summary = calculateSummary(criteria);
    const concerns = generateConcerns(criteria);

    // Generate suggested action based on match quality
    const suggestedAction = this.generateSuggestedAction(summary, matchType);

    // Generate ice breakers for profile matches
    const iceBreakers = matchType === 'PROFILE_TO_PROFILE' || matchType === 'PROFILE_TO_USER'
      ? this.generateProfileIceBreakers(criteria)
      : [];

    return {
      matchId: uuidv4(),
      matchType,
      source,
      target,
      criteria,
      summary,
      concerns,
      suggestedAction,
      iceBreakers,
      calculatedAt: new Date(),
      expiresAt: new Date(Date.now() + CACHE_TTL.CONTACT_MATCHES * 1000),
    };
  }

  private generateSuggestedAction(summary: MatchSummary, matchType: ItemizedMatchType): SuggestedAction | undefined {
    // Check if critical criteria are met
    if (summary.criticalTotal > 0 && summary.criticalMet < summary.criticalTotal) {
      return {
        action: 'Review carefully',
        reason: `Only ${summary.criticalMet}/${summary.criticalTotal} critical criteria met`,
        priority: 'LOW',
      };
    }

    if (summary.perfectMatches >= 2) {
      return {
        action: 'HIGH PRIORITY: Reach out now',
        reason: `${summary.perfectMatches} perfect matches on key criteria`,
        priority: 'HIGH',
      };
    }

    if (summary.perfectMatches >= 1 || summary.excellentMatches >= 2) {
      return {
        action: 'Strong connection potential',
        reason: 'Multiple strong alignment points',
        priority: 'MEDIUM',
      };
    }

    if (summary.strongMatches >= 2) {
      return {
        action: 'Worth exploring',
        reason: 'Good foundation for connection',
        priority: 'MEDIUM',
      };
    }

    return undefined;
  }

  private generateProfileIceBreakers(criteria: CriterionMatch[]): IceBreaker[] {
    const iceBreakers: IceBreaker[] = [];

    for (const criterion of criteria) {
      if (criterion.score < 60) continue; // Only use strong matches

      switch (criterion.id) {
        case 'industry':
          if (criterion.score >= 80) {
            iceBreakers.push({
              text: `You both work in ${criterion.explanation.details[0]?.replace('✅ ', '').replace(': Exact match', '') || 'the same industry'}!`,
              basedOn: 'Shared industry',
              relevance: criterion.score,
            });
          }
          break;
        case 'skills':
          if (criterion.score >= 60) {
            iceBreakers.push({
              text: `Start by discussing your shared skills in ${criterion.explanation.details[0]?.replace('✅ ', '').replace(': Exact match', '') || 'your field'}`,
              basedOn: 'Common skills',
              relevance: criterion.score,
            });
          }
          break;
        case 'location':
          if (criterion.score >= 80) {
            iceBreakers.push({
              text: 'You are both based in the same area - suggest meeting for coffee!',
              basedOn: 'Same location',
              relevance: criterion.score,
            });
          }
          break;
        case 'goals':
          if (criterion.explanation.matchType === 'COMPLEMENTARY') {
            iceBreakers.push({
              text: 'Your goals align perfectly - mention how you might help each other',
              basedOn: 'Complementary goals',
              relevance: criterion.score,
            });
          }
          break;
      }
    }

    // Sort by relevance and return top 3
    return iceBreakers
      .sort((a, b) => b.relevance - a.relevance)
      .slice(0, 3);
  }

  private generateEventIceBreakers(
    source: MatchingProfile,
    target: MatchingProfile,
    criteria: CriterionResult[]
  ): IceBreaker[] {
    const iceBreakers: IceBreaker[] = [];

    // Find the complementary goals criterion
    const goalsResult = criteria.find(c => c.id === 'complementary_goals');
    if (goalsResult && goalsResult.score >= 60) {
      iceBreakers.push({
        text: `Hi ${target.name.split(' ')[0]}! I noticed you're looking for ${target.lookingFor?.slice(0, 50)}... I might be able to help!`,
        basedOn: 'Complementary goals',
        relevance: goalsResult.score,
      });
    }

    // Company-based ice breaker
    if (source.company && target.company) {
      iceBreakers.push({
        text: `Tell me about ${target.company} - I'd love to hear what you're working on there!`,
        basedOn: 'Company context',
        relevance: 70,
      });
    }

    // Generic but personalized
    iceBreakers.push({
      text: `Hi! What brings you to this event? I'm ${source.name.split(' ')[0]}${source.company ? ` from ${source.company}` : ''}.`,
      basedOn: 'Event context',
      relevance: 50,
    });

    return iceBreakers.slice(0, 3);
  }
}

// Export singleton instance
export const itemizedMatchingService = new ItemizedExplainableMatchingService();

export default ItemizedExplainableMatchingService;
