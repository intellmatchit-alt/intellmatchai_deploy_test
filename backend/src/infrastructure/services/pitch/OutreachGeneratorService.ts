/**
 * PNME Outreach Generator Service
 *
 * Generates personalized outreach messages for pitch matches.
 * Uses LLM for custom messages, template-based for fallback.
 *
 * @module infrastructure/services/pitch/OutreachGeneratorService
 */

import { IOutreachGeneratorService } from '../../../application/interfaces/IPitchAIService';
import { ContactProfileDTO } from '../../../application/dto/pitch.dto';
import { MatchReason } from '../../../domain/entities/Pitch';
import { config } from '../../../config';
import { logger } from '../../../shared/logger';

/**
 * LLM prompt for outreach message generation
 */
const OUTREACH_PROMPT = `Generate a personalized outreach message for a startup founder reaching out to a potential contact.

Tone: {{tone}}
Language: {{language}}

DO NOT include any email subject line - just the message body.
Keep it concise (3-4 sentences).
Be specific about why you're reaching out based on the match reasons.
Include a clear call to action.

Contact Profile:
Name: {{contactName}}
Title: {{jobTitle}}
Company: {{company}}
Summary: {{profileSummary}}

Why they're a match:
{{reasons}}

Startup Context (from pitch):
{{sectionContent}}

Generate ONLY the message body, no subject line, no salutation prefix like "Subject:".
`;

/**
 * Outreach message templates for fallback
 */
const TEMPLATES: Record<
  'professional' | 'casual' | 'warm',
  {
    greeting: string;
    opener: string;
    body: string;
    close: string;
  }
> = {
  professional: {
    greeting: 'Dear {{name}},',
    opener:
      'I hope this message finds you well. I came across your profile and was impressed by your experience in {{sectors}}.',
    body: 'I am reaching out because {{reason}}. Given your background, I believe there could be a valuable opportunity for us to connect.',
    close:
      'Would you be open to a brief conversation to explore potential synergies? I would greatly appreciate the opportunity to share more about what we are building.',
  },
  casual: {
    greeting: 'Hi {{name}},',
    opener:
      "I hope you're doing well! I noticed your work in {{sectors}} and thought we might have some interesting synergies.",
    body: "I'm reaching out because {{reason}}. With your experience, I think you'd find what we're working on quite relevant.",
    close:
      "Would you be up for a quick chat? I'd love to tell you more about what we're building and hear your thoughts.",
  },
  warm: {
    greeting: 'Hello {{name}},',
    opener:
      'I hope this finds you well. Your experience in {{sectors}} really caught my attention, and I thought we could have a great conversation.',
    body: "I wanted to reach out because {{reason}}. Your background seems like a perfect fit for what we're doing.",
    close:
      "I'd really value the chance to connect and share more about our work. Would you have time for a brief chat this week?",
  },
};

/**
 * Outreach Generator Service Implementation
 */
export class OutreachGeneratorService implements IOutreachGeneratorService {
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
   * Generate a personalized outreach message
   */
  async generateOutreachMessage(
    sectionContent: string,
    contactProfile: ContactProfileDTO,
    reasons: MatchReason[],
    tone: 'professional' | 'casual' | 'warm',
    language: string
  ): Promise<string> {
    if (!this.isEnabled) {
      return this.generateOutreachMessageTemplate(contactProfile, reasons, tone);
    }

    try {
      const prompt = this.buildPrompt(sectionContent, contactProfile, reasons, tone, language);

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
          temperature: 0.7,
          max_tokens: 300,
        }),
      });

      if (!response.ok) {
        throw new Error(`LLM API error: ${response.status}`);
      }

      const data = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };

      const message = data.choices?.[0]?.message?.content?.trim();

      if (!message || message.length < 50) {
        throw new Error('Invalid LLM response');
      }

      // Clean up the message (remove any accidental subject lines)
      const cleanedMessage = this.cleanMessage(message);

      return cleanedMessage;
    } catch (error) {
      logger.warn('LLM outreach generation failed, using template fallback', {
        error: error instanceof Error ? error.message : 'Unknown error',
        contactId: contactProfile.contactId,
      });
      return this.generateOutreachMessageTemplate(contactProfile, reasons, tone);
    }
  }

  /**
   * Generate a template-based outreach message (fallback)
   */
  generateOutreachMessageTemplate(
    contactProfile: ContactProfileDTO,
    reasons: MatchReason[],
    tone: 'professional' | 'casual' | 'warm'
  ): string {
    const template = TEMPLATES[tone];

    // Get first name
    const firstName = contactProfile.fullName.split(' ')[0];

    // Get sectors for opener
    const sectors =
      contactProfile.sectors.length > 0
        ? contactProfile.sectors.slice(0, 2).join(' and ')
        : 'your industry';

    // Get primary reason
    const primaryReason =
      reasons.length > 0 ? reasons[0].text.toLowerCase() : 'I believe we have synergies';

    // Build message
    const greeting = template.greeting.replace('{{name}}', firstName);
    const opener = template.opener.replace('{{sectors}}', sectors);
    const body = template.body.replace('{{reason}}', primaryReason);
    const close = template.close;

    return [greeting, '', opener, '', body, '', close].join('\n');
  }

  /**
   * Build prompt for LLM
   */
  private buildPrompt(
    sectionContent: string,
    contactProfile: ContactProfileDTO,
    reasons: MatchReason[],
    tone: 'professional' | 'casual' | 'warm',
    language: string
  ): string {
    const reasonsText = reasons.map((r) => `- ${r.text}: ${r.evidence}`).join('\n');

    return OUTREACH_PROMPT.replace('{{tone}}', tone)
      .replace('{{language}}', language === 'ar' ? 'Arabic' : 'English')
      .replace('{{contactName}}', contactProfile.fullName)
      .replace('{{jobTitle}}', contactProfile.jobTitle || 'Professional')
      .replace('{{company}}', contactProfile.company || 'their organization')
      .replace('{{profileSummary}}', contactProfile.profileSummary.slice(0, 300))
      .replace('{{reasons}}', reasonsText)
      .replace('{{sectionContent}}', sectionContent.slice(0, 500));
  }

  /**
   * Clean up generated message
   */
  private cleanMessage(message: string): string {
    // Remove any subject line that might have been generated
    let cleaned = message.replace(/^subject:.*\n/gi, '');
    cleaned = cleaned.replace(/^re:.*\n/gi, '');

    // Trim whitespace
    cleaned = cleaned.trim();

    // Ensure it starts with a greeting
    if (
      !cleaned.match(/^(hi|hello|dear|hey|good morning|good afternoon|good evening)/i)
    ) {
      // Add a generic greeting if missing
      cleaned = 'Hi,\n\n' + cleaned;
    }

    return cleaned;
  }
}

// Export singleton instance
export const outreachGeneratorService = new OutreachGeneratorService();
