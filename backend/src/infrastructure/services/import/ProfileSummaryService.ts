/**
 * Profile Summary Service
 *
 * Generates professional summaries for contacts using
 * deterministic templates with optional LLM enhancement.
 *
 * @module infrastructure/services/import/ProfileSummaryService
 */

import { prisma } from '../../database/prisma/client';
import { logger } from '../../../shared/logger/index';
import { config } from '../../../config/index';
import OpenAI from 'openai';

/**
 * Contact data for summary generation
 */
export interface ContactForSummary {
  id: string;
  fullName: string;
  jobTitle?: string | null;
  company?: string | null;
  bio?: string | null;
  location?: string | null;
}

/**
 * Computed profile data for summary
 */
export interface ComputedProfileData {
  sectorsJson?: Array<{ id: string; name: string; confidence: number }>;
  skillsJson?: Array<{ id: string; name: string; confidence: number }>;
  interestsJson?: Array<{ id: string; name: string; confidence: number }>;
  keywordsJson?: string[];
}

/**
 * Summary generation result
 */
export interface SummaryResult {
  contactId: string;
  summary: string;
  source: 'deterministic' | 'llm';
}

/**
 * Profile Summary Service
 */
export class ProfileSummaryService {
  private openai: OpenAI | null = null;
  private llmEnabled: boolean = false;

  constructor() {
    // Initialize OpenAI client if API key is available
    const apiKey = config.ai?.openai?.apiKey;
    if (apiKey) {
      this.openai = new OpenAI({ apiKey });
      this.llmEnabled = true;
      logger.debug('ProfileSummaryService: LLM enhancement enabled');
    } else {
      logger.debug('ProfileSummaryService: LLM enhancement disabled (no API key)');
    }
  }

  /**
   * Generate a deterministic summary using templates
   */
  generateDeterministicSummary(
    contact: ContactForSummary,
    profile?: ComputedProfileData
  ): string {
    const parts: string[] = [];

    // Part 1: Name + Title + Company
    if (contact.jobTitle && contact.company) {
      parts.push(`${contact.fullName} — ${contact.jobTitle} at ${contact.company}`);
    } else if (contact.jobTitle) {
      parts.push(`${contact.fullName} — ${contact.jobTitle}`);
    } else if (contact.company) {
      parts.push(`${contact.fullName} at ${contact.company}`);
    } else {
      parts.push(contact.fullName);
    }

    // Part 2: Location
    if (contact.location) {
      parts.push(`Based in ${contact.location}`);
    }

    // Part 3: Focus areas (sectors)
    const sectors = profile?.sectorsJson || [];
    if (sectors.length > 0) {
      const sectorNames = sectors
        .slice(0, 3)
        .map(s => s.name)
        .join(', ');
      parts.push(`Focus: ${sectorNames}`);
    }

    // Part 4: Skills
    const skills = profile?.skillsJson || [];
    if (skills.length > 0) {
      const skillNames = skills
        .slice(0, 5)
        .map(s => s.name)
        .join(', ');
      parts.push(`Skills: ${skillNames}`);
    }

    // Part 5: Interests
    const interests = profile?.interestsJson || [];
    if (interests.length > 0) {
      const interestNames = interests
        .slice(0, 3)
        .map(i => i.name)
        .join(', ');
      parts.push(`Interests: ${interestNames}`);
    }

    return parts.join('. ') + '.';
  }

  /**
   * Generate an LLM-enhanced summary
   */
  async generateLLMSummary(
    contact: ContactForSummary,
    deterministicSummary: string
  ): Promise<string> {
    if (!this.openai || !this.llmEnabled) {
      return deterministicSummary;
    }

    try {
      // Build context from contact data
      const context = [
        deterministicSummary,
        contact.bio ? `Bio: ${contact.bio}` : null,
      ].filter(Boolean).join('\n\n');

      const response = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: 'You are a professional networking assistant. Rewrite the following contact summary into 1-2 engaging, professional sentences. Keep it concise and focus on what makes this person interesting for networking. Do not make up information not in the original.',
          },
          {
            role: 'user',
            content: context,
          },
        ],
        max_tokens: 150,
        temperature: 0.7,
      });

      const enhancedSummary = response.choices[0]?.message?.content?.trim();

      if (enhancedSummary && enhancedSummary.length > 20) {
        return enhancedSummary;
      }

      return deterministicSummary;
    } catch (error) {
      logger.warn('LLM summary generation failed, using deterministic fallback', {
        contactId: contact.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return deterministicSummary;
    }
  }

  /**
   * Generate summary for a single contact
   */
  async generateSummary(
    contact: ContactForSummary,
    profile?: ComputedProfileData,
    useLLM: boolean = true
  ): Promise<SummaryResult> {
    // Always start with deterministic summary
    const deterministicSummary = this.generateDeterministicSummary(contact, profile);

    // Try LLM enhancement if enabled and requested
    if (useLLM && this.llmEnabled) {
      try {
        const llmSummary = await this.generateLLMSummary(contact, deterministicSummary);
        if (llmSummary !== deterministicSummary) {
          return {
            contactId: contact.id,
            summary: llmSummary,
            source: 'llm',
          };
        }
      } catch {
        // Fall through to deterministic
      }
    }

    return {
      contactId: contact.id,
      summary: deterministicSummary,
      source: 'deterministic',
    };
  }

  /**
   * Generate summaries for a batch of contacts
   */
  async generateSummariesBatch(
    contacts: ContactForSummary[],
    profiles?: Map<string, ComputedProfileData>,
    useLLM: boolean = true
  ): Promise<SummaryResult[]> {
    const results: SummaryResult[] = [];

    for (const contact of contacts) {
      try {
        const profile = profiles?.get(contact.id);
        const result = await this.generateSummary(contact, profile, useLLM);
        results.push(result);
      } catch (error) {
        logger.warn('Failed to generate summary for contact', {
          contactId: contact.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        // Return deterministic fallback
        results.push({
          contactId: contact.id,
          summary: this.generateDeterministicSummary(contact, profiles?.get(contact.id)),
          source: 'deterministic',
        });
      }
    }

    return results;
  }

  /**
   * Save summary to database
   */
  async saveSummary(contactId: string, result: SummaryResult): Promise<void> {
    await prisma.contactComputedProfile.upsert({
      where: { contactId },
      create: {
        contactId,
        sectorsJson: [],
        skillsJson: [],
        interestsJson: [],
        keywordsJson: [],
        profileSummary: result.summary,
        summarySource: result.source,
        lastSummarizedAt: new Date(),
      },
      update: {
        profileSummary: result.summary,
        summarySource: result.source,
        lastSummarizedAt: new Date(),
      },
    });
  }

  /**
   * Get summary for a contact (generate if not exists)
   */
  async getSummary(contactId: string, regenerate: boolean = false): Promise<string | null> {
    // Check existing profile
    const existingProfile = await prisma.contactComputedProfile.findUnique({
      where: { contactId },
      select: { profileSummary: true, lastSummarizedAt: true },
    });

    // Return existing if available and not forcing regeneration
    if (existingProfile?.profileSummary && !regenerate) {
      return existingProfile.profileSummary;
    }

    // Get contact data
    const contact = await prisma.contact.findUnique({
      where: { id: contactId },
      select: {
        id: true,
        fullName: true,
        jobTitle: true,
        company: true,
        bio: true,
        location: true,
      },
    });

    if (!contact) return null;

    // Get computed profile for sectors/skills
    const profile = await prisma.contactComputedProfile.findUnique({
      where: { contactId },
      select: {
        sectorsJson: true,
        skillsJson: true,
        interestsJson: true,
        keywordsJson: true,
      },
    });

    // Generate and save
    const result = await this.generateSummary(
      contact,
      profile as ComputedProfileData | undefined,
      true
    );
    await this.saveSummary(contactId, result);

    return result.summary;
  }

  /**
   * Check if LLM enhancement is available
   */
  isLLMEnabled(): boolean {
    return this.llmEnabled;
  }
}

// Export singleton instance
export const profileSummaryService = new ProfileSummaryService();
export default ProfileSummaryService;
