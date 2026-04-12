/**
 * PNME Profile Builder Service
 *
 * Builds profile summaries from contact data for matching.
 * Uses LLM for rich summaries, rule-based for fallback.
 *
 * @module infrastructure/services/pitch/ProfileBuilderService
 */

import { IProfileBuilderService } from '../../../application/interfaces/IPitchAIService';
import { config } from '../../../config';
import { logger } from '../../../shared/logger';

/**
 * LLM prompt for profile summary generation
 */
const PROFILE_SUMMARY_PROMPT = `Generate a professional profile summary for matching with startup pitch decks.
Focus on:
- Professional expertise and background
- Industry/sector knowledge
- Investment or advisory experience (if any)
- Skills that could help a startup

Keep it concise (2-3 sentences). No generic statements. Be specific.

Profile data:
`;

/**
 * Profile Builder Service Implementation
 */
export class ProfileBuilderService implements IProfileBuilderService {
  private apiEndpoint: string;
  private apiKey: string;
  private model: string;
  private isEnabled: boolean;

  constructor() {
    // Use Groq by default, fallback to OpenAI
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
   * Build a profile summary from contact data
   * Uses rule-based summary for most contacts (fast), LLM only for complex profiles
   */
  async buildProfileSummary(contact: {
    fullName: string;
    company?: string | null;
    jobTitle?: string | null;
    bio?: string | null;
    sectors: string[];
    skills: string[];
    interests: string[];
    notes?: string | null;
    enrichmentData?: Record<string, unknown> | null;
  }): Promise<string> {
    // Always use rule-based for speed - LLM adds little value for profile summaries
    // Rule-based is ~100x faster and produces good enough results for matching
    return this.buildProfileSummaryRuleBased(contact);
  }

  /**
   * Build a simple profile summary (rule-based fallback)
   */
  buildProfileSummaryRuleBased(contact: {
    fullName: string;
    company?: string | null;
    jobTitle?: string | null;
    sectors: string[];
    skills: string[];
  }): string {
    const parts: string[] = [];

    // Name and role
    if (contact.jobTitle && contact.company) {
      parts.push(`${contact.fullName} is ${contact.jobTitle} at ${contact.company}.`);
    } else if (contact.jobTitle) {
      parts.push(`${contact.fullName} is a ${contact.jobTitle}.`);
    } else if (contact.company) {
      parts.push(`${contact.fullName} works at ${contact.company}.`);
    } else {
      parts.push(`${contact.fullName} is a professional contact.`);
    }

    // Sectors
    if (contact.sectors.length > 0) {
      const sectorsList = contact.sectors.slice(0, 3).join(', ');
      parts.push(`Active in ${sectorsList}.`);
    }

    // Skills
    if (contact.skills.length > 0) {
      const skillsList = contact.skills.slice(0, 5).join(', ');
      parts.push(`Skills: ${skillsList}.`);
    }

    return parts.join(' ');
  }

  /**
   * Extract investor-specific fields from enrichment data
   */
  extractInvestorFields(enrichmentData?: Record<string, unknown> | null): {
    investorType?: string;
    investmentStage?: string;
    checkSize?: string;
    previousInvestments?: string[];
  } {
    if (!enrichmentData) {
      return {};
    }

    const result: {
      investorType?: string;
      investmentStage?: string;
      checkSize?: string;
      previousInvestments?: string[];
    } = {};

    // Extract investor type
    if (typeof enrichmentData.investor_type === 'string') {
      result.investorType = enrichmentData.investor_type;
    } else if (typeof enrichmentData.investorType === 'string') {
      result.investorType = enrichmentData.investorType;
    }

    // Extract investment stage
    if (typeof enrichmentData.investment_stage === 'string') {
      result.investmentStage = enrichmentData.investment_stage;
    } else if (Array.isArray(enrichmentData.investment_stages)) {
      result.investmentStage = enrichmentData.investment_stages.join(', ');
    }

    // Extract check size
    if (typeof enrichmentData.check_size === 'string') {
      result.checkSize = enrichmentData.check_size;
    } else if (enrichmentData.min_check_size && enrichmentData.max_check_size) {
      result.checkSize = `$${enrichmentData.min_check_size} - $${enrichmentData.max_check_size}`;
    }

    // Extract previous investments
    if (Array.isArray(enrichmentData.investments)) {
      result.previousInvestments = enrichmentData.investments
        .slice(0, 10)
        .map((inv: unknown) => {
          if (typeof inv === 'string') return inv;
          if (typeof inv === 'object' && inv !== null) {
            const i = inv as Record<string, unknown>;
            return (i.company || i.name || i.startup) as string || '';
          }
          return '';
        })
        .filter(Boolean);
    } else if (Array.isArray(enrichmentData.portfolio)) {
      result.previousInvestments = enrichmentData.portfolio
        .slice(0, 10)
        .map((p: unknown) => (typeof p === 'string' ? p : ''))
        .filter(Boolean);
    }

    return result;
  }

  /**
   * Format profile data for LLM
   */
  private formatProfileForLLM(contact: {
    fullName: string;
    company?: string | null;
    jobTitle?: string | null;
    bio?: string | null;
    sectors: string[];
    skills: string[];
    interests: string[];
    notes?: string | null;
    enrichmentData?: Record<string, unknown> | null;
  }): string {
    const lines: string[] = [];

    lines.push(`Name: ${contact.fullName}`);

    if (contact.jobTitle) {
      lines.push(`Title: ${contact.jobTitle}`);
    }

    if (contact.company) {
      lines.push(`Company: ${contact.company}`);
    }

    if (contact.bio) {
      lines.push(`Bio: ${contact.bio.slice(0, 500)}`);
    }

    if (contact.sectors.length > 0) {
      lines.push(`Sectors: ${contact.sectors.join(', ')}`);
    }

    if (contact.skills.length > 0) {
      lines.push(`Skills: ${contact.skills.join(', ')}`);
    }

    if (contact.interests.length > 0) {
      lines.push(`Interests: ${contact.interests.join(', ')}`);
    }

    // Add investor-specific data if available
    const investorFields = this.extractInvestorFields(contact.enrichmentData);
    if (investorFields.investorType) {
      lines.push(`Investor Type: ${investorFields.investorType}`);
    }
    if (investorFields.investmentStage) {
      lines.push(`Investment Stage: ${investorFields.investmentStage}`);
    }
    if (investorFields.checkSize) {
      lines.push(`Check Size: ${investorFields.checkSize}`);
    }
    if (investorFields.previousInvestments && investorFields.previousInvestments.length > 0) {
      lines.push(`Previous Investments: ${investorFields.previousInvestments.join(', ')}`);
    }

    return lines.join('\n');
  }
}

// Export singleton instance
export const profileBuilderService = new ProfileBuilderService();
