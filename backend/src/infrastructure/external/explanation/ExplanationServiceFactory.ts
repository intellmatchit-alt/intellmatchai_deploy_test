/**
 * Explanation Service Factory
 *
 * Creates the appropriate explanation service based on configuration.
 * Uses OpenAI when available, falls back to template-based.
 *
 * @module infrastructure/external/explanation/ExplanationServiceFactory
 */

import { OpenAIExplanationService, MatchContext, ExplanationResult } from './OpenAIExplanationService';
import { logger } from '../../../shared/logger';
import { config } from '../../../config';

/**
 * Explanation service interface
 */
export interface IExplanationService {
  isAvailable(): Promise<boolean>;
  generateExplanation(context: MatchContext): Promise<ExplanationResult>;
}

/**
 * Explanation service type
 */
export type ExplanationServiceType = 'openai' | 'template' | 'auto';

/**
 * Template-based Explanation Service
 *
 * Generates explanations using templates when OpenAI is not available.
 */
class TemplateExplanationService implements IExplanationService {
  async isAvailable(): Promise<boolean> {
    return true;
  }

  async generateExplanation(context: MatchContext): Promise<ExplanationResult> {
    const reasons: string[] = [];

    if (context.sharedSectors.length > 0) {
      reasons.push(`Both work in ${context.sharedSectors.slice(0, 2).join(' and ')}`);
    }

    if (context.sharedSkills.length > 0) {
      reasons.push(`Share expertise in ${context.sharedSkills.slice(0, 3).join(', ')}`);
    }

    if (context.contactCompany) {
      reasons.push(`${context.contactName} works at ${context.contactCompany}`);
    }

    if (context.contactJobTitle) {
      reasons.push(`Holds position: ${context.contactJobTitle}`);
    }

    if (reasons.length === 0) {
      reasons.push('Potential networking opportunity based on professional profile');
    }

    const firstName = context.contactName.split(' ')[0];

    return {
      reasons: reasons.slice(0, 3),
      suggestedMessage: this.generateMessage(context, firstName),
      conversationTopics: this.generateTopics(context),
    };
  }

  private generateMessage(context: MatchContext, firstName: string): string {
    if (context.sharedSectors.length > 0) {
      return `Hi ${firstName}! I noticed we're both in the ${context.sharedSectors[0]} space. Would love to connect and exchange insights. Are you open to a brief chat?`;
    }

    if (context.sharedSkills.length > 0) {
      return `Hi ${firstName}! I saw we both have experience with ${context.sharedSkills[0]}. I'd love to hear about your work in this area. Would you be up for connecting?`;
    }

    return `Hi ${firstName}! I came across your profile and thought we might have some interesting synergies. Would you be open to connecting?`;
  }

  private generateTopics(context: MatchContext): string[] {
    const topics: string[] = [];

    if (context.sharedSectors.length > 0) {
      topics.push(`Trends in ${context.sharedSectors[0]}`);
    }

    if (context.sharedSkills.length > 0) {
      topics.push(`Best practices for ${context.sharedSkills[0]}`);
    }

    topics.push('Career paths and experiences');
    topics.push('Industry challenges and opportunities');
    topics.push('Potential collaboration areas');

    return topics.slice(0, 3);
  }
}

/**
 * Explanation Service Factory
 *
 * Creates explanation service instances based on configuration.
 */
export class ExplanationServiceFactory {
  private static openaiInstance: OpenAIExplanationService | null = null;
  private static templateInstance: TemplateExplanationService | null = null;

  /**
   * Create an explanation service instance
   */
  static create(type: ExplanationServiceType = 'auto'): IExplanationService {
    switch (type) {
      case 'openai':
        return this.getOpenAIService();

      case 'template':
        return this.getTemplateService();

      case 'auto':
      default:
        return this.getBestAvailable();
    }
  }

  private static getOpenAIService(): OpenAIExplanationService {
    if (!this.openaiInstance) {
      this.openaiInstance = new OpenAIExplanationService();
      logger.info('Created OpenAI explanation service instance');
    }
    return this.openaiInstance;
  }

  private static getTemplateService(): TemplateExplanationService {
    if (!this.templateInstance) {
      this.templateInstance = new TemplateExplanationService();
      logger.info('Created template explanation service instance');
    }
    return this.templateInstance;
  }

  private static getBestAvailable(): IExplanationService {
    const useOpenAI = config.features.openaiExplanations;
    const openaiConfigured = !!config.ai.openai.apiKey;

    if (useOpenAI && openaiConfigured) {
      logger.info('Using OpenAI explanation service (cloud)');
      return this.getOpenAIService();
    }

    logger.info('Using template explanation service (local)');
    return this.getTemplateService();
  }

  static async checkAvailability(): Promise<{
    openai: boolean;
    template: boolean;
    recommended: ExplanationServiceType;
  }> {
    const openai = await this.getOpenAIService().isAvailable();
    const template = await this.getTemplateService().isAvailable();

    return {
      openai,
      template,
      recommended: openai ? 'openai' : 'template',
    };
  }
}

/**
 * Get default explanation service instance
 */
export function getExplanationService(): IExplanationService {
  return ExplanationServiceFactory.create('auto');
}
