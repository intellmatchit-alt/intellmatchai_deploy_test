/**
 * LLM Explanation Service
 *
 * Supports multiple LLM providers: OpenAI, Groq (FREE), and Google Gemini (FREE).
 * Uses the shared LLMService for provider selection and API calls.
 *
 * @module infrastructure/external/explanation/OpenAIExplanationService
 */

import { logger } from '../../../shared/logger';
import { LLMService } from '../../../shared/llm';

const EXPLANATION_SYSTEM_PROMPT =
  'You are a professional networking assistant that helps people understand why they should connect with someone and how to start a conversation. Be concise, professional, and actionable. Always respond with valid JSON.';

/**
 * Match context for generating explanations
 */
export interface MatchContext {
  userName: string;
  userCompany?: string;
  userJobTitle?: string;
  userSectors: string[];
  userSkills: string[];
  contactName: string;
  contactCompany?: string;
  contactJobTitle?: string;
  contactSectors: string[];
  contactSkills: string[];
  matchScore: number;
  sharedSectors: string[];
  sharedSkills: string[];
}

/**
 * Generated explanation result
 */
export interface ExplanationResult {
  reasons: string[];
  suggestedMessage: string;
  conversationTopics: string[];
}

/**
 * LLM Explanation Service
 *
 * Generates AI-powered match explanations and conversation starters.
 * Supports multiple providers with automatic fallback.
 */
export class OpenAIExplanationService {
  private llmService: LLMService;

  constructor() {
    this.llmService = new LLMService(EXPLANATION_SYSTEM_PROMPT);

    const provider = this.llmService.getActiveProvider();
    const providerConfig = this.llmService.getProviderConfig();
    if (provider !== 'none' && providerConfig) {
      logger.info(`LLM explanation service configured with ${provider}`, {
        provider,
        model: providerConfig.model,
      });
    } else {
      logger.warn('No LLM provider configured - will use template fallback');
    }
  }

  /**
   * Get the currently active provider name
   */
  getActiveProvider(): string {
    return this.llmService.getActiveProvider();
  }

  /**
   * Check if LLM service is available
   */
  async isAvailable(): Promise<boolean> {
    return this.llmService.isAvailable();
  }

  /**
   * Generate raw text from a prompt using the configured LLM provider.
   * Returns null if no provider is available or if the call fails.
   */
  async generateText(prompt: string, opts?: { maxTokens?: number; temperature?: number }): Promise<string | null> {
    if (!this.llmService.isAvailable()) {
      return null;
    }

    try {
      // For generateText, use the prompt directly as user content (no system prompt override)
      return await this.llmService.callLLM(prompt, undefined, {
        maxTokens: opts?.maxTokens,
        temperature: opts?.temperature,
      });
    } catch (error) {
      logger.error('LLM generateText failed', {
        error,
        provider: this.llmService.getActiveProvider(),
      });
      return null;
    }
  }

  /**
   * Generate match explanation and conversation starters
   */
  async generateExplanation(context: MatchContext): Promise<ExplanationResult> {
    if (!this.llmService.isAvailable()) {
      return this.generateFallbackExplanation(context);
    }

    try {
      const prompt = this.buildPrompt(context);
      const content = await this.llmService.callLLM(prompt, EXPLANATION_SYSTEM_PROMPT);

      if (!content) {
        return this.generateFallbackExplanation(context);
      }

      return this.parseResponse(content);
    } catch (error) {
      logger.error('LLM explanation generation failed', {
        error,
        provider: this.llmService.getActiveProvider(),
      });
      return this.generateFallbackExplanation(context);
    }
  }

  /**
   * Build prompt for LLM
   */
  private buildPrompt(context: MatchContext): string {
    return `
Analyze this professional match and provide:
1. 3 specific reasons why ${context.userName} should connect with ${context.contactName}
2. A personalized conversation opener message
3. 3 potential conversation topics

User Profile:
- Name: ${context.userName}
- Company: ${context.userCompany || 'Not specified'}
- Role: ${context.userJobTitle || 'Not specified'}
- Industries: ${context.userSectors.join(', ') || 'Not specified'}
- Skills: ${context.userSkills.join(', ') || 'Not specified'}

Contact Profile:
- Name: ${context.contactName}
- Company: ${context.contactCompany || 'Not specified'}
- Role: ${context.contactJobTitle || 'Not specified'}
- Industries: ${context.contactSectors.join(', ') || 'Not specified'}
- Skills: ${context.contactSkills.join(', ') || 'Not specified'}

Shared:
- Common industries: ${context.sharedSectors.join(', ') || 'None identified'}
- Common skills: ${context.sharedSkills.join(', ') || 'None identified'}
- Match score: ${context.matchScore}%

Respond in JSON format:
{
  "reasons": ["reason1", "reason2", "reason3"],
  "suggestedMessage": "Your personalized message here",
  "conversationTopics": ["topic1", "topic2", "topic3"]
}
    `.trim();
  }

  /**
   * Parse LLM response
   */
  private parseResponse(content: string): ExplanationResult {
    try {
      // Try to extract JSON from response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          reasons: parsed.reasons || [],
          suggestedMessage: parsed.suggestedMessage || '',
          conversationTopics: parsed.conversationTopics || [],
        };
      }
    } catch {
      logger.warn('Failed to parse LLM response as JSON');
    }

    // Fallback to extracting text patterns
    return {
      reasons: ['Analysis generated based on profile similarity'],
      suggestedMessage: content.substring(0, 200),
      conversationTopics: ['Professional background', 'Industry trends', 'Shared interests'],
    };
  }

  /**
   * Generate fallback explanation without AI
   */
  private generateFallbackExplanation(context: MatchContext): ExplanationResult {
    const reasons: string[] = [];

    if (context.sharedSectors.length > 0) {
      reasons.push(`Both work in ${context.sharedSectors.join(' and ')}`);
    }

    if (context.sharedSkills.length > 0) {
      reasons.push(`Share expertise in ${context.sharedSkills.join(', ')}`);
    }

    if (context.contactCompany) {
      reasons.push(`${context.contactName} works at ${context.contactCompany}`);
    }

    if (reasons.length === 0) {
      reasons.push('Potential networking opportunity based on professional profile');
    }

    const firstName = context.contactName.split(' ')[0];

    return {
      reasons: reasons.slice(0, 3),
      suggestedMessage: `Hi ${firstName}! I noticed we have some professional overlap and thought it would be great to connect. Would you be open to a brief chat?`,
      conversationTopics: [
        'Industry trends and insights',
        'Professional experiences',
        'Potential collaboration opportunities',
      ],
    };
  }
}
