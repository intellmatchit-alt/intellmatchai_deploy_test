/**
 * Deal Matching Service
 * Core matching algorithm with Sell/Buy mode support
 */

import {
  DealMode,
  DealMatchCategory,
  DealRequestEntity,
  MatchReason,
  MatchReasonType,
  MatchBreakdown,
  ComponentScore,
  DEFAULT_DEAL_WEIGHTS,
  CreateDealMatchResultInput,
} from '../../../domain/entities/Deal';
import { logger } from '../../../shared/logger';
import {
  DECISION_MAKER_TITLES,
  INFLUENCER_TITLES,
  CONSULTANT_TITLES,
  BROKER_TITLES,
  SOLUTION_TYPE_KEYWORDS,
  titleContainsAny,
  cosineSimilarity,
} from '../../../shared/matching';
import { embeddingService } from '../../external/embedding/EmbeddingService';
import { skillTaxonomyService } from '../taxonomy';

// ============================================================================
// Types
// ============================================================================

export interface ContactProfile {
  id: string;
  fullName: string;
  company: string | null;
  jobTitle: string | null;
  email: string | null;
  sectors: string[];
  skills: string[];
  interests: string[];
  bio: string | null;
  enrichmentData: any;
  relationshipStrength: number;
  lastInteractionDays: number | null;
  interactionCount: number;
}

export interface MatchResult {
  contactId: string;
  score: number;
  category: DealMatchCategory;
  reasons: MatchReason[];
  breakdown: MatchBreakdown;
}

export interface MatchingConfig {
  weights: {
    relevance: number;
    expertise: number;
    strategic: number;
    relationship: number;
  };
  minScore: number;
  maxMatches: number;
}

// ============================================================================
// Main Matching Service
// ============================================================================

export class DealMatchingService {
  private config: MatchingConfig;

  constructor(config?: Partial<MatchingConfig>) {
    this.config = {
      weights: config?.weights || DEFAULT_DEAL_WEIGHTS,
      minScore: config?.minScore || 30,
      maxMatches: config?.maxMatches || 50,
    };
  }

  /**
   * Main matching function - works for both Sell and Buy modes
   */
  async matchContacts(
    deal: DealRequestEntity,
    contacts: ContactProfile[]
  ): Promise<MatchResult[]> {
    logger.info('Starting deal matching', {
      dealId: deal.id,
      mode: deal.mode,
      contactCount: contacts.length,
    });

    const results: MatchResult[] = [];

    for (const contact of contacts) {
      const result = await this.scoreContact(deal, contact);

      if (result.score >= this.config.minScore) {
        results.push(result);
      }
    }

    // Sort by score descending
    results.sort((a, b) => b.score - a.score);

    // Limit to max matches
    const limitedResults = results.slice(0, this.config.maxMatches);

    logger.info('Deal matching complete', {
      dealId: deal.id,
      totalCandidates: contacts.length,
      qualifiedMatches: limitedResults.length,
    });

    return limitedResults;
  }

  /**
   * Score a single contact against a deal
   */
  private async scoreContact(deal: DealRequestEntity, contact: ContactProfile): Promise<MatchResult> {
    const { weights } = this.config;

    // Calculate component scores
    const relevance = await this.calculateRelevanceScore(deal, contact);
    const expertise = this.calculateExpertiseScore(deal, contact);
    const strategic = this.calculateStrategicScore(deal, contact);
    const relationship = this.calculateRelationshipScore(contact);

    // Calculate weighted total
    const totalScore = Math.round(
      relevance.score * weights.relevance +
      expertise.score * weights.expertise +
      strategic.score * weights.strategic +
      relationship.score * weights.relationship
    );

    // Classify category based on mode
    const category = this.classifyMatch(deal.mode, contact, totalScore);

    // Generate reasons
    const reasons = this.generateReasons(deal, contact, relevance, expertise, strategic, relationship);

    // Build breakdown
    const breakdown: MatchBreakdown = {
      relevance: { ...relevance, weight: weights.relevance, weighted: relevance.score * weights.relevance },
      expertise: { ...expertise, weight: weights.expertise, weighted: expertise.score * weights.expertise },
      strategic: { ...strategic, weight: weights.strategic, weighted: strategic.score * weights.strategic },
      relationship: { ...relationship, weight: weights.relationship, weighted: relationship.score * weights.relationship },
    };

    return {
      contactId: contact.id,
      score: Math.min(100, Math.max(0, totalScore)),
      category,
      reasons: reasons.slice(0, 3), // Top 3 reasons
      breakdown,
    };
  }

  /**
   * Calculate relevance score (sector/industry overlap + keyword similarity)
   */
  private async calculateRelevanceScore(deal: DealRequestEntity, contact: ContactProfile): Promise<ComponentScore> {
    let score = 0;
    const details: Record<string, number> = {};

    // Sector/industry matching
    const dealDomain = deal.domain?.toLowerCase() || '';
    const dealSolutionType = deal.solutionType?.toLowerCase() || '';

    const contactSectors = contact.sectors.map(s => s.toLowerCase());
    const contactSkills = contact.skills.map(s => s.toLowerCase());
    const contactInterests = contact.interests.map(s => s.toLowerCase());
    const contactCompany = contact.company?.toLowerCase() || '';

    // Direct sector match
    if (dealDomain && contactSectors.some(s => dealDomain.includes(s) || s.includes(dealDomain))) {
      score += 30;
      details.sectorMatch = 30;
    }

    // Solution type keyword matching (bidirectional)
    for (const [type, keywords] of Object.entries(SOLUTION_TYPE_KEYWORDS)) {
      const dealMatchesType = dealSolutionType.includes(type) ||
        keywords.some(kw => dealSolutionType.includes(kw));

      if (dealMatchesType) {
        const companyMatch = keywords.some(kw => contactCompany.includes(kw));
        const sectorMatch = contactSectors.some(s => keywords.some(kw => s.includes(kw) || kw.includes(s)));
        const skillMatch = contactSkills.some(s => keywords.some(kw => s.includes(kw) || kw.includes(s)));

        if (companyMatch && !details.companyTypeMatch) {
          score += 25;
          details.companyTypeMatch = 25;
        }
        if (sectorMatch && !details.sectorTypeMatch) {
          score += 15;
          details.sectorTypeMatch = 15;
        }
        if (skillMatch && !details.skillTypeMatch) {
          score += 10;
          details.skillTypeMatch = 10;
        }
      }
    }

    // Contact skills/interests matching against deal fields
    const dealText = [dealDomain, dealSolutionType, deal.productName || '', deal.problemStatement || '', deal.targetDescription || '']
      .join(' ').toLowerCase();

    const skillRelevance = contactSkills.filter(skill => dealText.includes(skill) || skill.split(' ').some(w => w.length > 3 && dealText.includes(w))).length;
    if (skillRelevance > 0 && !details.skillTypeMatch) {
      const skillScore = Math.min(15, skillRelevance * 5);
      score += skillScore;
      details.skillRelevance = skillScore;
    }

    const interestRelevance = contactInterests.filter(interest => dealText.includes(interest) || interest.split(' ').some(w => w.length > 3 && dealText.includes(w))).length;
    if (interestRelevance > 0) {
      const interestScore = Math.min(10, interestRelevance * 5);
      score += interestScore;
      details.interestMatch = interestScore;
    }

    // Bio/enrichment keyword matching
    const bioText = (contact.bio || '').toLowerCase();
    const enrichmentText = JSON.stringify(contact.enrichmentData || {}).toLowerCase();

    const searchText = `${bioText} ${enrichmentText} ${contactSkills.join(' ')} ${contactInterests.join(' ')}`;
    const dealKeywords = [dealDomain, dealSolutionType, deal.productName || '', deal.problemStatement || '']
      .join(' ')
      .toLowerCase()
      .split(/\s+/)
      .filter(w => w.length > 3);

    // Deduplicate keywords
    const uniqueKeywords = [...new Set(dealKeywords)];
    const keywordMatches = uniqueKeywords.filter(kw => searchText.includes(kw)).length;
    const keywordScore = Math.min(30, keywordMatches * 5);
    if (keywordScore > 0) {
      score += keywordScore;
      details.keywordMatch = keywordScore;
    }

    // Semantic similarity via embeddings (blend: 60% keyword + 40% semantic)
    if (embeddingService.isAvailable()) {
      try {
        const dealEmbeddingText = [deal.productName || '', deal.problemStatement || '', deal.targetDescription || '', dealDomain]
          .filter(Boolean).join('. ');
        const contactEmbeddingText = [contact.bio || '', contact.company || '', contact.jobTitle || '', ...contact.sectors, ...contact.skills]
          .filter(Boolean).join('. ');

        if (dealEmbeddingText.length > 10 && contactEmbeddingText.length > 10) {
          const [dealEmbed, contactEmbed] = await Promise.all([
            embeddingService.generateProfileEmbedding({ id: `deal:${deal.id}`, type: 'user', bio: dealEmbeddingText }),
            embeddingService.generateProfileEmbedding({ id: contact.id, type: 'contact', bio: contactEmbeddingText }),
          ]);

          if (dealEmbed && contactEmbed) {
            const similarity = cosineSimilarity(dealEmbed.embedding, contactEmbed.embedding);
            const semanticScore = Math.max(0, similarity) * 100;
            // Blend: keep 60% of keyword-based score, add 40% semantic
            score = Math.round(score * 0.6 + semanticScore * 0.4);
            details.semanticSimilarity = Math.round(semanticScore);
          }
        }
      } catch (error) {
        logger.debug('Semantic similarity failed in deal relevance, using keyword score only', { error });
      }
    }

    return { score: Math.min(100, score), weight: 0, weighted: 0, details };
  }

  /**
   * Calculate expertise score (role/title relevance)
   */
  private calculateExpertiseScore(deal: DealRequestEntity, contact: ContactProfile): ComponentScore {
    let score = 0;
    const details: Record<string, number> = {};
    const title = contact.jobTitle?.toLowerCase() || '';

    if (deal.mode === DealMode.SELL) {
      // Sell mode: look for decision makers and influencers
      if (this.titleContainsAny(title, DECISION_MAKER_TITLES)) {
        score += 40;
        details.decisionMaker = 40;
      } else if (this.titleContainsAny(title, INFLUENCER_TITLES)) {
        score += 30;
        details.influencer = 30;
      }

      // Relevant function keywords
      const functionKeywords = ['procurement', 'purchasing', 'buying', 'operations', 'it', 'technology'];
      if (functionKeywords.some(kw => title.includes(kw))) {
        score += 20;
        details.relevantFunction = 20;
      }
    } else {
      // Buy mode: look for expertise and delivery capability
      if (this.titleContainsAny(title, CONSULTANT_TITLES)) {
        score += 35;
        details.consultant = 35;
      }

      // Technical/delivery roles
      const deliveryRoles = ['engineer', 'developer', 'architect', 'specialist', 'lead', 'manager', 'director'];
      if (deliveryRoles.some(r => title.includes(r))) {
        score += 25;
        details.deliveryRole = 25;
      }

      // Solution-specific expertise
      const solutionType = deal.solutionType?.toLowerCase() || '';
      if (solutionType && title.includes(solutionType.split(' ')[0])) {
        score += 30;
        details.solutionExpertise = 30;
      }
    }

    // Skills match (bidirectional: skill in deal text OR deal keywords in skill)
    const dealKeywords = [deal.solutionType || '', deal.domain || '', deal.productName || '', deal.problemStatement || ''].join(' ').toLowerCase();
    const dealWords = dealKeywords.split(/\s+/).filter(w => w.length > 3);

    const skillMatches = contact.skills.filter(skill => {
      const skillLower = skill.toLowerCase();
      // Check if skill name appears in deal text
      if (dealKeywords.includes(skillLower)) return true;
      // Check if any significant deal word appears in skill name
      if (dealWords.some(w => skillLower.includes(w))) return true;
      // Check if skill words appear in deal text
      const skillWords = skillLower.split(/\s+/).filter(w => w.length > 3);
      return skillWords.some(sw => dealKeywords.includes(sw));
    }).length;

    if (skillMatches > 0) {
      const skillScore = Math.min(25, skillMatches * 8);
      score += skillScore;
      details.skillMatch = skillScore;
    }

    return { score: Math.min(100, score), weight: 0, weighted: 0, details };
  }

  /**
   * Calculate strategic score (company size alignment, strategic fit)
   */
  private calculateStrategicScore(deal: DealRequestEntity, contact: ContactProfile): ComponentScore {
    let score = 0;
    const details: Record<string, number> = {};

    // Parse structured context from deal fields
    const dealContext = this.parseStructuredContext(
      deal.mode === DealMode.SELL ? (deal.targetDescription || '') : (deal.problemStatement || '')
    );
    const timelineStr = dealContext['Timeline'] || '';
    const requirementsStr = dealContext['Requirements'] || '';

    // Urgency bonus: if deal is urgent, boost contacts with recent interactions
    if (timelineStr && ['urgent', 'actively selling', 'this week', 'need it yesterday'].some(t => timelineStr.toLowerCase().includes(t))) {
      if (contact.lastInteractionDays !== null && contact.lastInteractionDays <= 30) {
        score += 15;
        details.urgencyFit = 15;
      }
    }

    // Requirements matching: check if contact skills/bio match stated requirements
    if (requirementsStr) {
      const requirements = requirementsStr.split(',').map(r => r.trim().toLowerCase()).filter(Boolean);
      const contactText = [...contact.skills, ...(contact.bio ? [contact.bio] : [])].join(' ').toLowerCase();
      const reqMatches = requirements.filter(req =>
        contactText.includes(req) || req.split(' ').some(w => w.length > 3 && contactText.includes(w))
      ).length;
      if (reqMatches > 0) {
        const reqScore = Math.min(20, reqMatches * 10);
        score += reqScore;
        details.requirementsMatch = reqScore;
      }
    }

    // Company size alignment (if available in enrichment)
    const enrichment = contact.enrichmentData || {};
    const companySize = enrichment.companySize || enrichment.employees || '';

    if (deal.companySize && companySize) {
      const sizeMatch = this.matchCompanySize(deal.companySize, companySize);
      if (sizeMatch) {
        score += 30;
        details.sizeMatch = 30;
      }
    }

    // Geographic/market alignment
    const dealDomain = deal.domain?.toLowerCase() || '';
    let companyIndustry = (enrichment.industry || enrichment.sector || '').toLowerCase();

    // Fallback: use contact's sectors when enrichment industry is missing
    if (!companyIndustry && contact.sectors.length > 0) {
      companyIndustry = contact.sectors.map(s => s.toLowerCase()).join(' ');
    }

    if (companyIndustry && dealDomain.includes(companyIndustry)) {
      score += 25;
      details.industryMatch = 25;
    }

    // Company size fallback: infer from job title when enrichment data is missing
    if (deal.companySize && !companySize) {
      const title = contact.jobTitle?.toLowerCase() || '';
      // Founders/owners likely small companies; VPs/Directors likely medium+; C-suite at enterprises
      let inferredSize = '';
      if (['founder', 'co-founder', 'owner', 'self-employed', 'freelance'].some(kw => title.includes(kw))) {
        inferredSize = 'SMALL';
      } else if (['vp', 'vice president', 'senior director', 'evp'].some(kw => title.includes(kw))) {
        inferredSize = 'ENTERPRISE';
      }
      if (inferredSize && inferredSize === deal.companySize) {
        score += 15;
        details.inferredSizeMatch = 15;
      }
    }

    // Company reputation/funding signals
    if (enrichment.funding || enrichment.revenue) {
      score += 15;
      details.establishedCompany = 15;
    }

    // Target entity type match (Buy mode)
    if (deal.mode === DealMode.BUY && deal.targetEntityType) {
      const entityMatch = this.matchEntityType(deal.targetEntityType, contact);
      if (entityMatch) {
        score += 30;
        details.entityTypeMatch = 30;
      }
    }

    return { score: Math.min(100, score), weight: 0, weighted: 0, details };
  }

  /**
   * Calculate relationship score (existing relationship strength)
   */
  private calculateRelationshipScore(contact: ContactProfile): ComponentScore {
    let score = 0;
    const details: Record<string, number> = {};

    // Base relationship strength (0-100 from IntellMatch)
    if (contact.relationshipStrength > 0) {
      score += Math.min(50, contact.relationshipStrength / 2);
      details.relationshipStrength = Math.min(50, contact.relationshipStrength / 2);
    }

    // Recent interaction bonus
    if (contact.lastInteractionDays !== null) {
      if (contact.lastInteractionDays <= 7) {
        score += 30;
        details.recentInteraction = 30;
      } else if (contact.lastInteractionDays <= 30) {
        score += 20;
        details.recentInteraction = 20;
      } else if (contact.lastInteractionDays <= 90) {
        score += 10;
        details.recentInteraction = 10;
      }
    }

    // Interaction frequency
    if (contact.interactionCount > 0) {
      const frequencyScore = Math.min(20, contact.interactionCount * 2);
      score += frequencyScore;
      details.interactionFrequency = frequencyScore;
    }

    return { score: Math.min(100, score), weight: 0, weighted: 0, details };
  }

  /**
   * Classify match into category based on mode
   */
  private classifyMatch(mode: DealMode, contact: ContactProfile, score: number): DealMatchCategory {
    const title = contact.jobTitle?.toLowerCase() || '';

    if (mode === DealMode.SELL) {
      // Sell mode classification - prioritize title-based classification
      if (this.titleContainsAny(title, DECISION_MAKER_TITLES)) {
        return DealMatchCategory.DECISION_MAKER;
      }
      if (this.titleContainsAny(title, INFLUENCER_TITLES)) {
        return DealMatchCategory.INFLUENCER;
      }
      return DealMatchCategory.POTENTIAL_CLIENT;
    } else {
      // Buy mode classification
      // Check if company seems to be a provider first
      const company = contact.company?.toLowerCase() || '';
      const enrichment = contact.enrichmentData || {};
      const isServiceProvider = this.isLikelyServiceProvider(company, enrichment);

      if (this.titleContainsAny(title, CONSULTANT_TITLES)) {
        return DealMatchCategory.CONSULTANT;
      }
      if (this.titleContainsAny(title, BROKER_TITLES)) {
        return DealMatchCategory.BROKER;
      }
      if (isServiceProvider) {
        return DealMatchCategory.SOLUTION_PROVIDER;
      }

      return DealMatchCategory.PARTNER;
    }
  }

  /**
   * Generate human-readable reasons for match
   */
  private generateReasons(
    deal: DealRequestEntity,
    contact: ContactProfile,
    relevance: ComponentScore,
    expertise: ComponentScore,
    strategic: ComponentScore,
    relationship: ComponentScore
  ): MatchReason[] {
    const reasons: MatchReason[] = [];

    // Relevance reasons
    if (relevance.details.sectorMatch) {
      reasons.push({
        type: MatchReasonType.SECTOR_OVERLAP,
        text: `Works in ${deal.domain || 'relevant'} sector`,
        evidence: contact.sectors.slice(0, 2).join(', ') || contact.company || '',
      });
    }
    if (relevance.details.companyTypeMatch) {
      reasons.push({
        type: deal.mode === DealMode.SELL ? MatchReasonType.COMPANY_FIT : MatchReasonType.PROVIDER_COMPANY,
        text: deal.mode === DealMode.SELL
          ? 'Company is a potential customer'
          : 'Works at a company providing this solution',
        evidence: contact.company || '',
      });
    }

    // Expertise reasons
    if (expertise.details.decisionMaker) {
      reasons.push({
        type: MatchReasonType.ROLE_FIT,
        text: 'Decision-making authority',
        evidence: contact.jobTitle || '',
      });
    }
    if (expertise.details.consultant) {
      reasons.push({
        type: MatchReasonType.EXPERTISE_ROLE,
        text: 'Advisory/consulting expertise',
        evidence: contact.jobTitle || '',
      });
    }
    if (expertise.details.skillMatch) {
      reasons.push({
        type: MatchReasonType.SKILL_MATCH,
        text: 'Has relevant skills',
        evidence: contact.skills.slice(0, 3).join(', '),
      });
    }

    // Interest/relevance reasons
    if (relevance.details.interestMatch) {
      reasons.push({
        type: MatchReasonType.SECTOR_OVERLAP,
        text: 'Interested in relevant areas',
        evidence: contact.interests.slice(0, 3).join(', '),
      });
    }
    if (relevance.details.skillRelevance || relevance.details.skillTypeMatch) {
      reasons.push({
        type: MatchReasonType.SKILL_MATCH,
        text: 'Skills align with deal requirements',
        evidence: contact.skills.slice(0, 3).join(', '),
      });
    }

    // Strategic reasons
    if (strategic.details.sizeMatch) {
      reasons.push({
        type: MatchReasonType.SIZE_MATCH,
        text: 'Company size aligns with target',
        evidence: contact.company || '',
      });
    }

    // Relationship reasons
    if (relationship.details.recentInteraction && relationship.details.recentInteraction >= 20) {
      reasons.push({
        type: MatchReasonType.RECENT_INTERACTION,
        text: 'Recent interaction',
        evidence: `${contact.lastInteractionDays} days ago`,
      });
    }
    if (relationship.details.relationshipStrength && relationship.details.relationshipStrength >= 25) {
      reasons.push({
        type: MatchReasonType.RELATIONSHIP_STRENGTH,
        text: 'Strong existing relationship',
        evidence: `${Math.round(contact.relationshipStrength)}% strength`,
      });
    }

    return reasons;
  }

  /**
   * Generate opener message for a match
   */
  generateOpenerMessage(deal: DealRequestEntity, contact: ContactProfile, category: DealMatchCategory): string {
    const firstName = contact.fullName.split(' ')[0];

    // Parse context for optional budget/timeline info
    const context = this.parseStructuredContext(
      deal.mode === DealMode.SELL ? (deal.targetDescription || '') : (deal.problemStatement || '')
    );
    const budget = context['Price Range'] || context['Budget'] || '';
    const timeline = context['Timeline'] || '';
    const budgetLine = budget ? `\nOur investment range is around ${budget}.` : '';
    const urgencyLine = timeline && ['urgent', 'this week', 'need it yesterday'].some(t => timeline.toLowerCase().includes(t))
      ? '\nThis is time-sensitive — we\'re hoping to move quickly.' : '';

    if (deal.mode === DealMode.SELL) {
      switch (category) {
        case DealMatchCategory.DECISION_MAKER:
          return `Hi ${firstName},\n\nI noticed you're leading ${contact.company ? `${contact.company}'s` : 'your company\'s'} initiatives in ${deal.domain || 'your industry'}. We've developed ${deal.productName || 'a solution'} that's helping similar organizations ${deal.targetDescription || 'achieve better results'}.${budgetLine}\n\nWould you be open to a brief conversation about how this might benefit your team?\n\nBest regards`;

        case DealMatchCategory.INFLUENCER:
          return `Hi ${firstName},\n\nGiven your role at ${contact.company || 'your organization'}, I thought you might be interested in ${deal.productName || 'our solution'} for ${deal.domain || 'your industry'}.\n\nI'd love to share some insights on how companies like yours are ${deal.targetDescription || 'improving their operations'}.\n\nWould you have 15 minutes for a quick chat?\n\nBest`;

        default:
          return `Hi ${firstName},\n\nI came across your profile and thought ${deal.productName || 'our solution'} might be relevant to ${contact.company || 'your work'}.\n\nWould you be interested in learning more about how we're helping in the ${deal.domain || 'industry'} space?\n\nBest`;
      }
    } else {
      switch (category) {
        case DealMatchCategory.SOLUTION_PROVIDER:
          return `Hi ${firstName},\n\nI'm looking for a ${deal.solutionType || 'solution'} provider and noticed ${contact.company || 'your company'} works in this space.\n\n${deal.problemStatement ? `Our challenge: ${deal.problemStatement}\n\n` : ''}${budgetLine ? `Budget context: ${budget}.\n` : ''}${urgencyLine ? urgencyLine + '\n' : ''}Could we schedule a call to discuss how you might be able to help?\n\nThanks`;

        case DealMatchCategory.CONSULTANT:
          return `Hi ${firstName},\n\nI noticed your expertise in ${deal.domain || 'this area'} and am looking for guidance on ${deal.solutionType || 'a solution'}.\n\n${deal.problemStatement ? `Specifically: ${deal.problemStatement}\n\n` : ''}Would you be open to a brief consultation?\n\nBest regards`;

        case DealMatchCategory.BROKER:
          return `Hi ${firstName},\n\nGiven your network in ${deal.domain || 'the industry'}, I'm hoping you might know someone who provides ${deal.solutionType || 'the solution I need'}.\n\n${deal.problemStatement ? `We're trying to: ${deal.problemStatement}\n\n` : ''}Any introductions would be greatly appreciated!\n\nThanks`;

        default:
          return `Hi ${firstName},\n\nI'm exploring partnerships in ${deal.domain || 'the industry'} around ${deal.solutionType || 'this solution area'}.\n\n${deal.problemStatement ? `Our focus: ${deal.problemStatement}\n\n` : ''}Would you be interested in exploring potential collaboration?\n\nBest`;
      }
    }
  }

  /**
   * Convert match results to repository input format
   */
  toRepositoryInputs(
    dealRequestId: string,
    results: MatchResult[],
    deal: DealRequestEntity,
    contactProfiles: Map<string, ContactProfile>
  ): CreateDealMatchResultInput[] {
    return results.map(result => {
      const contact = contactProfiles.get(result.contactId);
      const openerMessage = contact
        ? this.generateOpenerMessage(deal, contact, result.category)
        : null;

      return {
        dealRequestId,
        contactId: result.contactId,
        score: result.score,
        category: result.category,
        reasonsJson: result.reasons,
        breakdownJson: result.breakdown,
        openerMessage: openerMessage || undefined,
      };
    });
  }

  // ============================================================================
  // Helper Functions
  // ============================================================================

  /**
   * Parse structured context metadata from text fields
   * Extracts [Key: Value] patterns appended by the frontend
   */
  private parseStructuredContext(text: string): Record<string, string> {
    const context: Record<string, string> = {};
    const pattern = /\[([^:]+):\s*([^\]]+)\]/g;
    let match;
    while ((match = pattern.exec(text)) !== null) {
      context[match[1].trim()] = match[2].trim();
    }
    return context;
  }

  private titleContainsAny(title: string, keywords: string[]): boolean {
    return keywords.some(kw => title.includes(kw));
  }

  private matchCompanySize(targetSize: string, actualSize: string): boolean {
    const sizeMap: Record<string, string[]> = {
      SMALL: ['1-10', '11-50', 'small', 'startup', '<50'],
      MEDIUM: ['51-200', '201-500', 'medium', 'mid-size', '50-500'],
      ENTERPRISE: ['501-1000', '1001-5000', '5000+', 'enterprise', 'large', '>500'],
    };

    const targetKeywords = sizeMap[targetSize] || [];
    return targetKeywords.some(kw => actualSize.toLowerCase().includes(kw));
  }

  private matchEntityType(targetType: string, contact: ContactProfile): boolean {
    const title = contact.jobTitle?.toLowerCase() || '';
    const company = contact.company?.toLowerCase() || '';

    switch (targetType) {
      case 'COMPANY':
        return !!contact.company;
      case 'INDIVIDUAL':
        return this.titleContainsAny(title, ['freelance', 'independent', 'self-employed']);
      case 'CONSULTANT':
        return this.titleContainsAny(title, CONSULTANT_TITLES);
      case 'PARTNER':
        return this.titleContainsAny(title, BROKER_TITLES);
      default:
        return false;
    }
  }

  private isLikelyServiceProvider(company: string, enrichment: any): boolean {
    const providerKeywords = [
      'solutions', 'services', 'consulting', 'technologies', 'systems',
      'software', 'platforms', 'agency', 'partners', 'group',
    ];

    if (providerKeywords.some(kw => company.includes(kw))) {
      return true;
    }

    const industry = (enrichment.industry || enrichment.sector || '').toLowerCase();
    const serviceIndustries = ['consulting', 'technology', 'software', 'services', 'agency'];

    return serviceIndustries.some(ind => industry.includes(ind));
  }
}

// Export singleton instance
export const dealMatchingService = new DealMatchingService();
