/**
 * PNME Match Explainer Service
 *
 * Generates explanations for why a contact matches a pitch section.
 * Uses LLM for detailed explanations, rule-based for fallback.
 *
 * @module infrastructure/services/pitch/MatchExplainerService
 */

import { IMatchExplainerService } from '../../../application/interfaces/IPitchAIService';
import { ContactProfileDTO } from '../../../application/dto/pitch.dto';
import { PitchSectionType, MatchAngleCategory, MatchReason, MatchReasonType } from '../../../domain/entities/Pitch';
import { config } from '../../../config';
import { logger } from '../../../shared/logger';
import { cacheService } from '../../cache';

/**
 * LLM prompt for match reason generation
 */
const MATCH_REASON_PROMPT = `You are analyzing why a contact is a good match for a specific part of a startup pitch deck.

Your job is to explain HOW this contact can DIRECTLY help with what the pitch section describes. Be specific about the pitch's needs and the contact's abilities.

Rules:
- Each reason must reference something from the PITCH SECTION (the problem, solution, market, need, etc.)
- Each reason must explain what the CONTACT brings that is relevant to that specific pitch need
- Do NOT give generic reasons like "has experience in X sector" - instead say HOW that experience helps this specific pitch
- Evidence should combine pitch details + contact profile data

Respond with JSON only:
{
  "reasons": [
    {"type": "...", "text": "...", "evidence": "..."}
  ],
  "angleCategory": "INVESTOR_FIT" | "TECHNICAL_ADVISOR" | "MARKET_ACCESS" | "STRATEGIC_PARTNER" | "DOMAIN_EXPERT" | "CUSTOMER_INTRO" | "TALENT_SOURCE" | "REGULATORY_HELP"
}

reason.type: SECTOR_MATCH, SKILL_MATCH, EXPERIENCE_MATCH, INVESTOR_FIT, STRATEGIC_VALUE, NETWORK_VALUE
reason.text: 1 sentence explaining how this contact helps with this specific pitch need
reason.evidence: specific data from the pitch section + contact profile that supports this

Section Type: {{sectionType}}
Section Content (excerpt): {{sectionContent}}

Contact Profile:
{{profile}}

Match Scores:
- Relevance: {{relevance}}%
- Expertise: {{expertise}}%
- Strategic: {{strategic}}%
- Relationship: {{relationship}}%
`;

/**
 * Match Explainer Service Implementation
 */
export class MatchExplainerService implements IMatchExplainerService {
  private apiEndpoint: string;
  private apiKey: string;
  private model: string;
  private isEnabled: boolean;

  constructor() {
    if (config.ai.groq.enabled && config.ai.groq.apiKey) {
      this.apiEndpoint = 'https://api.groq.com/openai/v1/chat/completions';
      this.apiKey = config.ai.groq.apiKey;
      this.model = config.ai.groq.model;
      this.isEnabled = true;
    } else if (config.ai.openai.enabled && config.ai.openai.apiKey) {
      this.apiEndpoint = 'https://api.openai.com/v1/chat/completions';
      this.apiKey = config.ai.openai.apiKey;
      this.model = config.ai.openai.model;
      this.isEnabled = true;
    } else {
      this.apiEndpoint = '';
      this.apiKey = '';
      this.model = '';
      this.isEnabled = false;
    }
  }

  /**
   * Generate match reasons and explanation
   */
  async generateMatchReasons(
    sectionContent: string,
    sectionType: PitchSectionType,
    contactProfile: ContactProfileDTO,
    scores: {
      relevance: number;
      expertise: number;
      strategic: number;
      relationship: number;
    }
  ): Promise<{
    reasons: MatchReason[];
    angleCategory: MatchAngleCategory;
  }> {
    // Check cache first
    const cacheKey = `pitch:explanation:${sectionType}:${contactProfile.contactId}`;
    const cached = await cacheService.get<{ reasons: MatchReason[]; angleCategory: MatchAngleCategory }>(cacheKey);
    if (cached) return cached;

    if (!this.isEnabled) {
      const result = this.generateMatchReasonsRuleBased(sectionType, contactProfile, scores, sectionContent);
      await cacheService.set(cacheKey, result, 1800); // 30 min TTL
      return result;
    }

    try {
      const prompt = this.buildPrompt(sectionContent, sectionType, contactProfile, scores);

      const response = await fetch(this.apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            {
              role: 'user',
              content: prompt,
            },
          ],
          temperature: 0.3,
          max_tokens: 400,
        }),
      });

      if (!response.ok) {
        throw new Error(`LLM API error: ${response.status}`);
      }

      const data = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };

      const responseText = data.choices?.[0]?.message?.content || '';
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);

      if (!jsonMatch) {
        throw new Error('Invalid LLM response format');
      }

      const parsed = JSON.parse(jsonMatch[0]) as {
        reasons: Array<{ type: string; text: string; evidence: string }>;
        angleCategory: string;
      };

      // Validate angle category
      const validAngles = Object.values(MatchAngleCategory);
      const angleCategory = validAngles.includes(parsed.angleCategory as MatchAngleCategory)
        ? (parsed.angleCategory as MatchAngleCategory)
        : this.inferAngleCategory(contactProfile, scores);

      const result = {
        reasons: parsed.reasons.slice(0, 3) as MatchReason[],
        angleCategory,
      };

      await cacheService.set(cacheKey, result, 1800); // 30 min TTL
      return result;
    } catch (error) {
      logger.warn('LLM match explanation failed, using rule-based fallback', {
        error: error instanceof Error ? error.message : 'Unknown error',
        contactId: contactProfile.contactId,
      });
      return this.generateMatchReasonsRuleBased(sectionType, contactProfile, scores, sectionContent);
    }
  }

  /**
   * Generate match reasons using rules (fallback)
   * Now accepts sectionContent to make reasons pitch-specific
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
    sectionContent?: string
  ): {
    reasons: MatchReason[];
    angleCategory: MatchAngleCategory;
  } {
    const reasons: MatchReason[] = [];
    const sectionLabel = this.getSectionLabel(sectionType);
    const contentSnippet = sectionContent ? sectionContent.slice(0, 150).trim() : '';

    // Sector match — tie to pitch section
    if (contactProfile.sectors.length > 0 && scores.relevance >= 50) {
      const sectors = contactProfile.sectors.slice(0, 2).join(' and ');
      reasons.push({
        type: MatchReasonType.SECTOR_MATCH,
        text: `Their ${sectors} background is directly relevant to your ${sectionLabel.toLowerCase()} section`,
        evidence: contentSnippet
          ? `Your pitch discusses: "${contentSnippet}..." — ${contactProfile.fullName} has ${contactProfile.sectors.length} related sector(s): ${contactProfile.sectors.join(', ')}`
          : `Profile sectors: ${contactProfile.sectors.join(', ')}`,
      });
    }

    // Skill match — explain how skills help the pitch need
    if (contactProfile.skills.length > 0 && scores.expertise >= 50) {
      const relevantSkills = this.getRelevantSkillsForSection(contactProfile.skills, sectionType);
      if (relevantSkills.length > 0) {
        reasons.push({
          type: MatchReasonType.SKILL_MATCH,
          text: `Can contribute ${relevantSkills.slice(0, 3).join(', ')} expertise to help with your ${sectionLabel.toLowerCase()}`,
          evidence: `${contactProfile.fullName}'s skills (${relevantSkills.join(', ')}) align with what's needed for this pitch section`,
        });
      }
    }

    // Investor-specific — tie to funding ask
    if (contactProfile.investorType && sectionType === PitchSectionType.INVESTMENT_ASK) {
      reasons.push({
        type: MatchReasonType.INVESTOR_FIT,
        text: `${contactProfile.investorType} investor who could help fund your venture`,
        evidence: [
          contactProfile.investmentStage ? `Focuses on ${contactProfile.investmentStage} stage companies` : null,
          contactProfile.checkSize ? `Typical check size: ${contactProfile.checkSize}` : null,
          contentSnippet ? `Your ask: "${contentSnippet}..."` : null,
        ].filter(Boolean).join('. ') || 'Active investor with relevant focus',
      });
    }

    // Role/strategic — explain how their position helps
    if (scores.strategic >= 50 && contactProfile.company) {
      const roleDesc = contactProfile.jobTitle
        ? `${contactProfile.jobTitle} at ${contactProfile.company}`
        : `Works at ${contactProfile.company}`;
      reasons.push({
        type: MatchReasonType.NETWORK,
        text: `As ${roleDesc}, can provide strategic value for your ${sectionLabel.toLowerCase()}`,
        evidence: `Their position gives them access to networks, decisions, and insights relevant to what your pitch needs`,
      });
    }

    // Relationship strength — emphasize warm intro
    if (scores.relationship >= 60) {
      reasons.push({
        type: MatchReasonType.RELATIONSHIP,
        text: `You already have a strong relationship — making it easier to discuss your pitch`,
        evidence: `${contactProfile.interactionCount} past interactions. Warm connections are ${scores.relationship >= 80 ? '3x' : '2x'} more likely to lead to successful outcomes`,
      });
    }

    // Ensure at least one reason
    if (reasons.length === 0) {
      reasons.push({
        type: MatchReasonType.EXPERTISE,
        text: `${contactProfile.fullName}'s professional background aligns with your ${sectionLabel.toLowerCase()} needs`,
        evidence: contactProfile.profileSummary.slice(0, 150),
      });
    }

    const angleCategory = this.inferAngleCategory(contactProfile, scores);

    return { reasons: reasons.slice(0, 3), angleCategory };
  }

  /**
   * Get human-readable section label
   */
  private getSectionLabel(sectionType: PitchSectionType): string {
    const labels: Record<PitchSectionType, string> = {
      PROBLEM: 'Problem',
      SOLUTION: 'Solution',
      MARKET: 'Market',
      BUSINESS_MODEL: 'Business Model',
      TRACTION: 'Traction',
      TECHNOLOGY: 'Technology',
      TEAM: 'Team',
      INVESTMENT_ASK: 'Investment Ask',
      OTHER: 'Pitch',
    };
    return labels[sectionType] || 'Pitch';
  }

  /**
   * Build prompt for LLM
   */
  private buildPrompt(
    sectionContent: string,
    sectionType: PitchSectionType,
    contactProfile: ContactProfileDTO,
    scores: {
      relevance: number;
      expertise: number;
      strategic: number;
      relationship: number;
    }
  ): string {
    const profileText = [
      `Name: ${contactProfile.fullName}`,
      contactProfile.jobTitle ? `Title: ${contactProfile.jobTitle}` : null,
      contactProfile.company ? `Company: ${contactProfile.company}` : null,
      `Summary: ${contactProfile.profileSummary}`,
      contactProfile.sectors.length > 0 ? `Sectors: ${contactProfile.sectors.join(', ')}` : null,
      contactProfile.skills.length > 0 ? `Skills: ${contactProfile.skills.join(', ')}` : null,
      contactProfile.investorType ? `Investor Type: ${contactProfile.investorType}` : null,
      contactProfile.investmentStage ? `Investment Stage: ${contactProfile.investmentStage}` : null,
      contactProfile.checkSize ? `Check Size: ${contactProfile.checkSize}` : null,
    ]
      .filter(Boolean)
      .join('\n');

    return MATCH_REASON_PROMPT.replace('{{sectionType}}', sectionType)
      .replace('{{sectionContent}}', sectionContent.slice(0, 1000))
      .replace('{{profile}}', profileText)
      .replace('{{relevance}}', Math.round(scores.relevance).toString())
      .replace('{{expertise}}', Math.round(scores.expertise).toString())
      .replace('{{strategic}}', Math.round(scores.strategic).toString())
      .replace('{{relationship}}', Math.round(scores.relationship).toString());
  }

  /**
   * Get skills relevant to a section type
   */
  private getRelevantSkillsForSection(skills: string[], sectionType: PitchSectionType): string[] {
    const sectionSkillKeywords: Partial<Record<PitchSectionType, string[]>> = {
      [PitchSectionType.PROBLEM]: ['research', 'analysis', 'consulting', 'strategy'],
      [PitchSectionType.SOLUTION]: ['product', 'engineering', 'design', 'development'],
      [PitchSectionType.MARKET]: ['marketing', 'sales', 'market research', 'strategy'],
      [PitchSectionType.BUSINESS_MODEL]: ['business development', 'finance', 'strategy', 'operations'],
      [PitchSectionType.TRACTION]: ['growth', 'marketing', 'sales', 'analytics'],
      [PitchSectionType.TECHNOLOGY]: ['engineering', 'development', 'architecture', 'ai', 'machine learning'],
      [PitchSectionType.TEAM]: ['leadership', 'management', 'hr', 'recruiting'],
      [PitchSectionType.INVESTMENT_ASK]: ['finance', 'investment', 'venture capital', 'fundraising'],
      [PitchSectionType.OTHER]: ['general', 'business', 'strategy'],
    };

    const keywords = sectionSkillKeywords[sectionType] || [];
    return skills.filter((skill) =>
      keywords.some((keyword) => skill.toLowerCase().includes(keyword))
    );
  }

  /**
   * Infer angle category from profile and scores
   */
  private inferAngleCategory(
    contactProfile: ContactProfileDTO,
    scores: {
      relevance: number;
      expertise: number;
      strategic: number;
      relationship: number;
    }
  ): MatchAngleCategory {
    // Check if investor
    if (contactProfile.investorType) {
      return MatchAngleCategory.INVESTOR_FIT;
    }

    // Check job title for advisor/executive patterns
    const title = (contactProfile.jobTitle || '').toLowerCase();
    if (
      title.includes('advisor') ||
      title.includes('consultant') ||
      title.includes('mentor')
    ) {
      return MatchAngleCategory.TECHNICAL_ADVISOR;
    }

    // Check for potential customer
    if (
      title.includes('buyer') ||
      title.includes('procurement') ||
      title.includes('head of') ||
      title.includes('director')
    ) {
      return MatchAngleCategory.CUSTOMER_INTRO;
    }

    // Check for partner potential
    if (
      title.includes('partnership') ||
      title.includes('business development') ||
      title.includes('bd')
    ) {
      return MatchAngleCategory.STRATEGIC_PARTNER;
    }

    // Default based on relationship strength
    if (scores.relationship >= 70) {
      return MatchAngleCategory.MARKET_ACCESS;
    }

    // Default to advisor if high expertise
    if (scores.expertise >= 60) {
      return MatchAngleCategory.DOMAIN_EXPERT;
    }

    return MatchAngleCategory.DOMAIN_EXPERT;
  }
}

// Export singleton instance
export const matchExplainerService = new MatchExplainerService();
