/**
 * PNME Needs Extractor Service
 *
 * Extracts structured needs from classified pitch sections using:
 * 1. LLM-based extraction
 * 2. Rule-based fallback using keyword patterns
 *
 * @module infrastructure/services/pitch/NeedsExtractorService
 */

import { INeedsExtractorService } from '../../../application/interfaces/IPitchAIService';
import { ClassifiedSectionDTO, ExtractedNeedDTO } from '../../../application/dto/pitch.dto';
import { PitchNeedKey, PitchSectionType } from '../../../domain/entities/Pitch';
import { config } from '../../../config';
import { logger } from '../../../shared/logger';

/**
 * Need detection patterns for rule-based extraction
 * Using PitchNeedKey enum values as keys
 */
const NEED_PATTERNS: Partial<Record<PitchNeedKey, { patterns: RegExp[]; sections: PitchSectionType[] }>> = {
  [PitchNeedKey.FUNDING]: {
    patterns: [
      /(?:seeking|raising|looking for)\s*\$?([\d,.]+[km]?)/i,
      /(?:series|seed|pre-seed|round)\s*(?:of)?\s*\$?([\d,.]+[km]?)/i,
      /\$?([\d,.]+[km]?)\s*(?:funding|investment|raise)/i,
      /(?:investment|funding)\s*(?:of|for|around)?\s*\$?([\d,.]+[km]?)/i,
    ],
    sections: [PitchSectionType.INVESTMENT_ASK, PitchSectionType.TRACTION],
  },
  [PitchNeedKey.TECHNICAL_EXPERTISE]: {
    patterns: [
      /(?:need|looking for|seeking)\s+(?:a\s+)?(?:technical|engineering|tech)\s+(?:expertise|help|advisor)/i,
      /(?:cto|technical lead|engineer)\s+(?:needed|wanted)/i,
      /(?:technical|engineering)\s+(?:gap|challenge)/i,
    ],
    sections: [PitchSectionType.TEAM, PitchSectionType.TECHNOLOGY],
  },
  [PitchNeedKey.SECTOR_EXPERTISE]: {
    patterns: [
      /(?:need|looking for|seeking)\s+(?:industry|domain|sector)\s+(?:expertise|knowledge)/i,
      /(?:advisor|expert)\s+(?:in|with)\s+(?:\w+\s+){0,2}(?:industry|sector|domain)/i,
    ],
    sections: [PitchSectionType.TEAM, PitchSectionType.MARKET],
  },
  [PitchNeedKey.GO_TO_MARKET]: {
    patterns: [
      /(?:need|looking for|seeking)\s+(?:sales|go-to-market|gtm)\s+(?:expertise|help)/i,
      /(?:sales|business development)\s+(?:gap|challenge|needed)/i,
      /(?:vp of sales|sales lead)\s+(?:needed|wanted)/i,
    ],
    sections: [PitchSectionType.TEAM, PitchSectionType.BUSINESS_MODEL, PitchSectionType.TRACTION],
  },
  [PitchNeedKey.OPERATIONS]: {
    patterns: [
      /(?:need|looking for|seeking)\s+(?:operations|operational)\s+(?:expertise|help)/i,
      /(?:coo|operations lead)\s+(?:needed|wanted)/i,
      /(?:operational|operations)\s+(?:gap|challenge)/i,
    ],
    sections: [PitchSectionType.TEAM, PitchSectionType.BUSINESS_MODEL],
  },
  [PitchNeedKey.PARTNERSHIPS]: {
    patterns: [
      /(?:strategic|key)\s+(?:partnership|partner|alliance)/i,
      /(?:looking for|seeking|need)\s+(?:strategic|industry)\s+partner/i,
      /(?:partnership|collaboration)\s+(?:opportunity|needed)/i,
      /(?:distribution|channel)\s+(?:partnership|partner)/i,
      /(?:go-to-market|gtm)\s+(?:partner|channel)/i,
    ],
    sections: [PitchSectionType.MARKET, PitchSectionType.BUSINESS_MODEL, PitchSectionType.SOLUTION],
  },
  [PitchNeedKey.INTRODUCTIONS]: {
    patterns: [
      /(?:customer|client)\s+(?:intro|introduction|referral)/i,
      /(?:looking for|seeking)\s+(?:customers|clients)/i,
      /(?:pilot|beta)\s+(?:customer|program)/i,
      /(?:investor)\s+(?:intro|introduction|referral)/i,
      /(?:looking for|seeking)\s+(?:investors|vc|angel)/i,
      /(?:warm|investor)\s+intro/i,
    ],
    sections: [PitchSectionType.TRACTION, PitchSectionType.SOLUTION, PitchSectionType.MARKET, PitchSectionType.INVESTMENT_ASK],
  },
  [PitchNeedKey.TALENT]: {
    patterns: [
      /(?:hiring|recruiting|looking to hire)/i,
      /(?:talent|team)\s+(?:acquisition|growth)/i,
      /(?:key|critical)\s+(?:hire|role)/i,
    ],
    sections: [PitchSectionType.TEAM],
  },
  [PitchNeedKey.MENTORSHIP]: {
    patterns: [
      /(?:need|looking for|seeking)\s+(?:mentor|mentorship|coaching)/i,
      /(?:advisor|guidance)\s+(?:needed|wanted)/i,
    ],
    sections: [PitchSectionType.TEAM],
  },
  [PitchNeedKey.REGULATORY]: {
    patterns: [
      /(?:regulatory|compliance|legal)\s+(?:help|expertise|guidance)/i,
      /(?:need|looking for)\s+(?:regulatory|compliance)\s+(?:advisor|expert)/i,
    ],
    sections: [PitchSectionType.MARKET, PitchSectionType.BUSINESS_MODEL],
  },
};

/**
 * LLM prompt for needs extraction
 */
const EXTRACTION_PROMPT = `You are analyzing a startup pitch deck to extract their needs.

Extract ALL needs mentioned in the text. For each need, provide:
- key: One of [FUNDING, EXPERTISE_TECHNICAL, EXPERTISE_DOMAIN, EXPERTISE_SALES, EXPERTISE_OPERATIONS, PARTNERSHIP_STRATEGIC, PARTNERSHIP_DISTRIBUTION, CUSTOMER_INTRO, INVESTOR_INTRO, TALENT_ACQUISITION]
- label: Human-readable short label (e.g., "Seed Funding", "CTO Advisor")
- description: Brief description of the specific need
- confidence: 0.0-1.0 how certain you are this is a real need
- amount: (optional) Any mentioned dollar amounts or quantities
- timeline: (optional) Any mentioned timelines or deadlines

Respond with JSON array only: [{"key": "...", "label": "...", "description": "...", "confidence": 0.0-1.0, "amount": "...", "timeline": "..."}]

If no clear needs are found, return empty array: []

Text to analyze:
`;

/**
 * Needs Extractor Service Implementation
 */
export class NeedsExtractorService implements INeedsExtractorService {
  private apiEndpoint: string;
  private apiKey: string;
  private model: string;
  private isEnabled: boolean;
  private provider: 'groq' | 'gemini' | 'openai' | 'none';

  constructor() {
    // Priority: Gemini (fastest) -> Groq -> OpenAI
    if (config.ai.gemini?.enabled && config.ai.gemini?.apiKey) {
      this.apiEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/${config.ai.gemini.model}:generateContent?key=${config.ai.gemini.apiKey}`;
      this.apiKey = config.ai.gemini.apiKey;
      this.model = config.ai.gemini.model;
      this.isEnabled = true;
      this.provider = 'gemini';
    } else if (config.ai.groq.enabled && config.ai.groq.apiKey) {
      this.apiEndpoint = 'https://api.groq.com/openai/v1/chat/completions';
      this.apiKey = config.ai.groq.apiKey;
      this.model = config.ai.groq.model;
      this.isEnabled = true;
      this.provider = 'groq';
    } else if (config.ai.openai.enabled && config.ai.openai.apiKey) {
      this.apiEndpoint = 'https://api.openai.com/v1/chat/completions';
      this.apiKey = config.ai.openai.apiKey;
      this.model = config.ai.openai.model;
      this.isEnabled = true;
      this.provider = 'openai';
    } else {
      this.apiEndpoint = '';
      this.apiKey = '';
      this.model = '';
      this.isEnabled = false;
      this.provider = 'none';
      logger.warn('NeedsExtractorService disabled - no LLM API key configured');
    }
  }

  /**
   * Extract structured needs from classified sections
   * Uses rule-based extraction first, only calls LLM if no needs found
   */
  async extractNeeds(sections: ClassifiedSectionDTO[]): Promise<ExtractedNeedDTO[]> {
    const allNeeds: ExtractedNeedDTO[] = [];
    const seenNeedKeys = new Set<string>();

    // First pass: try rule-based extraction for all sections (fast)
    for (const section of sections) {
      const sectionNeeds = this.extractNeedsFromSection(section);
      for (const need of sectionNeeds) {
        const needKey = `${need.key}:${need.label}`;
        if (!seenNeedKeys.has(needKey)) {
          seenNeedKeys.add(needKey);
          allNeeds.push(need);
        }
      }
    }

    // If rule-based found needs, skip LLM (for speed)
    if (allNeeds.length >= 2) {
      logger.info('Needs extraction completed (rule-based)', {
        sectionsProcessed: sections.length,
        needsExtracted: allNeeds.length,
        needTypes: [...new Set(allNeeds.map((n) => n.key))],
      });
      return allNeeds;
    }

    // Second pass: use LLM only for sections that need deeper analysis
    if (this.isEnabled) {
      // Only process INVESTMENT_ASK and key sections with LLM
      const prioritySections = sections.filter(s =>
        s.type === 'INVESTMENT_ASK' || s.type === 'TEAM' || s.type === 'MARKET'
      );

      for (const section of prioritySections) {
        try {
          const sectionNeeds = await this.extractNeedsWithLLM(section);
          for (const need of sectionNeeds) {
            const needKey = `${need.key}:${need.label}`;
            if (!seenNeedKeys.has(needKey)) {
              seenNeedKeys.add(needKey);
              allNeeds.push(need);
            }
          }
        } catch (error) {
          logger.warn('LLM needs extraction failed', {
            error: error instanceof Error ? error.message : 'Unknown error',
            sectionType: section.type,
          });
        }
      }
    }

    logger.info('Needs extraction completed', {
      sectionsProcessed: sections.length,
      needsExtracted: allNeeds.length,
      needTypes: [...new Set(allNeeds.map((n) => n.key))],
    });

    return allNeeds;
  }

  /**
   * Extract needs using rule-based approach (fallback)
   */
  extractNeedsRuleBased(sections: ClassifiedSectionDTO[]): Promise<ExtractedNeedDTO[]> {
    const allNeeds: ExtractedNeedDTO[] = [];
    const seenNeedKeys = new Set<string>();

    for (const section of sections) {
      const sectionNeeds = this.extractNeedsFromSection(section);

      for (const need of sectionNeeds) {
        const needKey = `${need.key}:${need.label}`;
        if (!seenNeedKeys.has(needKey)) {
          seenNeedKeys.add(needKey);
          allNeeds.push(need);
        }
      }
    }

    return Promise.resolve(allNeeds);
  }

  /**
   * Extract needs from a single section using rules
   */
  private extractNeedsFromSection(section: ClassifiedSectionDTO): ExtractedNeedDTO[] {
    const needs: ExtractedNeedDTO[] = [];
    const content = section.content;

    for (const [needKey, config] of Object.entries(NEED_PATTERNS)) {
      if (!config) continue;

      // Skip if this need type isn't typically found in this section type
      if (!config.sections.includes(section.type)) {
        continue;
      }

      for (const pattern of config.patterns) {
        const match = content.match(pattern);
        if (match) {
          const need = this.createNeedFromMatch(
            needKey as PitchNeedKey,
            match,
            section.type
          );
          needs.push(need);
          break; // Only match once per need type per section
        }
      }
    }

    // Special handling for funding amounts in INVESTMENT_ASK sections
    if (section.type === PitchSectionType.INVESTMENT_ASK) {
      const fundingNeed = this.extractFundingNeed(content, section.type);
      if (fundingNeed && !needs.some((n) => n.key === PitchNeedKey.FUNDING)) {
        needs.push(fundingNeed);
      }
    }

    return needs;
  }

  /**
   * Create a need DTO from a regex match
   */
  private createNeedFromMatch(
    key: PitchNeedKey,
    match: RegExpMatchArray,
    sectionType: PitchSectionType
  ): ExtractedNeedDTO {
    const labels: Record<PitchNeedKey, string> = {
      [PitchNeedKey.FUNDING]: 'Funding',
      [PitchNeedKey.SECTOR_EXPERTISE]: 'Domain Expertise',
      [PitchNeedKey.TECHNICAL_EXPERTISE]: 'Technical Expertise',
      [PitchNeedKey.GO_TO_MARKET]: 'Go-to-Market',
      [PitchNeedKey.PARTNERSHIPS]: 'Partnerships',
      [PitchNeedKey.TALENT]: 'Talent Acquisition',
      [PitchNeedKey.REGULATORY]: 'Regulatory Help',
      [PitchNeedKey.OPERATIONS]: 'Operations',
      [PitchNeedKey.MENTORSHIP]: 'Mentorship',
      [PitchNeedKey.INTRODUCTIONS]: 'Introductions',
    };

    return {
      key,
      label: labels[key] || key,
      description: match[0].trim(),
      confidence: 0.7,
      sourceSectionType: sectionType,
      amount: key === PitchNeedKey.FUNDING ? this.extractAmount(match[0]) : undefined,
      timeline: this.extractTimeline(match[0]),
    };
  }

  /**
   * Extract funding need from text
   */
  private extractFundingNeed(
    content: string,
    sectionType: PitchSectionType
  ): ExtractedNeedDTO | null {
    // Look for dollar amounts
    const amountPattern = /\$\s*([\d,.]+)\s*(m|mm|million|k|thousand|b|billion)?/gi;
    const matches = content.matchAll(amountPattern);

    for (const match of matches) {
      const amount = this.normalizeAmount(match[1], match[2]);
      if (amount) {
        return {
          key: PitchNeedKey.FUNDING,
          label: 'Funding',
          description: `Seeking ${amount} in funding`,
          confidence: 0.8,
          sourceSectionType: sectionType,
          amount,
          timeline: this.extractTimeline(content),
        };
      }
    }

    return null;
  }

  /**
   * Extract amount from text
   */
  private extractAmount(text: string): string | undefined {
    const match = text.match(/\$?\s*([\d,.]+)\s*(m|mm|million|k|thousand|b|billion)?/i);
    if (!match) return undefined;

    return this.normalizeAmount(match[1], match[2]);
  }

  /**
   * Normalize amount to standard format
   */
  private normalizeAmount(value: string, suffix?: string): string | undefined {
    const num = parseFloat(value.replace(/,/g, ''));
    if (isNaN(num)) return undefined;

    const suffixLower = (suffix || '').toLowerCase();
    let multiplier = 1;

    if (['m', 'mm', 'million'].includes(suffixLower)) {
      multiplier = 1000000;
    } else if (['k', 'thousand'].includes(suffixLower)) {
      multiplier = 1000;
    } else if (['b', 'billion'].includes(suffixLower)) {
      multiplier = 1000000000;
    }

    const total = num * multiplier;

    if (total >= 1000000000) {
      return `$${(total / 1000000000).toFixed(1)}B`;
    } else if (total >= 1000000) {
      return `$${(total / 1000000).toFixed(1)}M`;
    } else if (total >= 1000) {
      return `$${(total / 1000).toFixed(0)}K`;
    }

    return `$${total.toFixed(0)}`;
  }

  /**
   * Extract timeline from text
   */
  private extractTimeline(text: string): string | undefined {
    const patterns = [
      /(?:within|in|by)\s+(\d+)\s*(months?|weeks?|years?|days?)/i,
      /(?:Q[1-4])\s*(\d{2,4})/i,
      /(?:by|before)\s+(\w+\s+\d{4})/i,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        return match[0].trim();
      }
    }

    return undefined;
  }

  /**
   * Extract needs using LLM
   */
  private async extractNeedsWithLLM(section: ClassifiedSectionDTO): Promise<ExtractedNeedDTO[]> {
    // Truncate content to avoid token limits
    const truncatedContent = section.content.slice(0, 3000);

    let response: Response;
    let responseText: string;

    if (this.provider === 'gemini') {
      // Gemini API format
      response = await fetch(this.apiEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: EXTRACTION_PROMPT + truncatedContent }] }],
          generationConfig: { temperature: 0.2, maxOutputTokens: 500 },
        }),
      });

      if (!response.ok) {
        throw new Error(`Gemini API error: ${response.status}`);
      }

      const data = await response.json() as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      };
      responseText = data.candidates?.[0]?.content?.parts?.[0]?.text || '[]';
    } else {
      // OpenAI/Groq API format
      response = await fetch(this.apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          messages: [{ role: 'user', content: EXTRACTION_PROMPT + truncatedContent }],
          temperature: 0.2,
          max_tokens: 500,
        }),
      });

      if (!response.ok) {
        throw new Error(`LLM API error: ${response.status}`);
      }

      const data = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      responseText = data.choices?.[0]?.message?.content || '[]';
    }

    // Parse JSON response
    const jsonMatch = responseText.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      return [];
    }

    const parsed = JSON.parse(jsonMatch[0]) as Array<{
      key: string;
      label: string;
      description: string;
      confidence: number;
      amount?: string;
      timeline?: string;
    }>;

    // Validate and convert to DTOs
    const validKeys = Object.values(PitchNeedKey);
    return parsed
      .filter((n) => validKeys.includes(n.key as PitchNeedKey))
      .map((n) => ({
        key: n.key as PitchNeedKey,
        label: n.label,
        description: n.description,
        confidence: Math.min(Math.max(n.confidence, 0), 1),
        sourceSectionType: section.type,
        amount: n.amount,
        timeline: n.timeline,
      }));
  }
}

// Export singleton instance
export const needsExtractorService = new NeedsExtractorService();
