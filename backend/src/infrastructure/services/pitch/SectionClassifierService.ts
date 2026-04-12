/**
 * PNME Section Classifier Service
 *
 * Classifies pitch deck content into predefined sections using:
 * 1. Heading detection and heuristics
 * 2. LLM-based classification (Groq/OpenAI)
 * 3. Rule-based fallback using keyword matching
 *
 * @module infrastructure/services/pitch/SectionClassifierService
 */

import { ISectionClassifierService } from '../../../application/interfaces/IPitchAIService';
import { ClassifiedSectionDTO } from '../../../application/dto/pitch.dto';
import { PitchSectionType } from '../../../domain/entities/Pitch';
import { config } from '../../../config';
import { logger } from '../../../shared/logger';

/**
 * Section detection keywords for rule-based fallback
 */
const SECTION_KEYWORDS: Record<PitchSectionType, string[]> = {
  PROBLEM: [
    'problem', 'challenge', 'pain point', 'issue', 'struggle', 'difficulty',
    'what\'s wrong', 'current state', 'gap', 'limitation', 'obstacle',
  ],
  SOLUTION: [
    'solution', 'how we solve', 'our approach', 'product', 'platform',
    'service', 'offering', 'what we do', 'features', 'benefits',
  ],
  MARKET: [
    'market', 'tam', 'sam', 'som', 'market size', 'opportunity', 'industry',
    'target market', 'addressable market', 'market analysis', 'segment',
  ],
  BUSINESS_MODEL: [
    'business model', 'revenue', 'monetization', 'pricing', 'how we make money',
    'subscription', 'licensing', 'saas', 'unit economics', 'ltv', 'cac',
  ],
  TRACTION: [
    'traction', 'growth', 'metrics', 'milestones', 'customers', 'users',
    'revenue', 'arr', 'mrr', 'pilot', 'case study', 'testimonial', 'progress',
  ],
  TECHNOLOGY: [
    'technology', 'tech stack', 'platform', 'architecture', 'ip', 'patent',
    'proprietary', 'innovation', 'technical', 'engineering', 'algorithm',
  ],
  TEAM: [
    'team', 'founders', 'leadership', 'management', 'advisors', 'board',
    'experience', 'background', 'expertise', 'co-founder', 'ceo', 'cto',
  ],
  INVESTMENT_ASK: [
    'investment', 'ask', 'funding', 'raise', 'round', 'seeking', 'use of funds',
    'allocation', 'runway', 'valuation', 'terms', 'cap table',
  ],
  OTHER: [],
};

/**
 * Heading patterns that indicate section boundaries
 */
const HEADING_PATTERNS: RegExp[] = [
  /^#{1,3}\s+(.+)$/m, // Markdown headings
  /^([A-Z][A-Z\s]+)$/m, // ALL CAPS lines
  /^(\d+\.?\s+[A-Z].+)$/m, // Numbered sections
  /^([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,3}):?\s*$/m, // Title Case lines
];

/**
 * LLM prompt for section classification
 */
const CLASSIFICATION_PROMPT = `You are analyzing a startup pitch deck. Classify the following text into exactly ONE section type.

Section Types:
- PROBLEM: Description of the problem or pain point being solved
- SOLUTION: How the product/service solves the problem
- MARKET: Market size, opportunity, TAM/SAM/SOM
- BUSINESS_MODEL: Revenue model, pricing, monetization
- TRACTION: Growth metrics, customers, milestones
- TECHNOLOGY: Technical details, IP, proprietary tech
- TEAM: Founders, leadership, advisors
- INVESTMENT_ASK: Funding ask, use of funds

Respond with JSON only: {"type": "SECTION_TYPE", "confidence": 0.0-1.0}

Text to classify:
`;

/**
 * Section Classifier Service Implementation
 */
export class SectionClassifierService implements ISectionClassifierService {
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
      logger.info('SectionClassifierService using Gemini', { model: this.model });
    } else if (config.ai.groq.enabled && config.ai.groq.apiKey) {
      this.apiEndpoint = 'https://api.groq.com/openai/v1/chat/completions';
      this.apiKey = config.ai.groq.apiKey;
      this.model = config.ai.groq.model;
      this.isEnabled = true;
      this.provider = 'groq';
      logger.info('SectionClassifierService using Groq', { model: this.model });
    } else if (config.ai.openai.enabled && config.ai.openai.apiKey) {
      this.apiEndpoint = 'https://api.openai.com/v1/chat/completions';
      this.apiKey = config.ai.openai.apiKey;
      this.model = config.ai.openai.model;
      this.isEnabled = true;
      this.provider = 'openai';
      logger.info('SectionClassifierService using OpenAI', { model: this.model });
    } else {
      this.apiEndpoint = '';
      this.apiKey = '';
      this.model = '';
      this.isEnabled = false;
      this.provider = 'none';
      logger.warn('SectionClassifierService disabled - no LLM API key configured');
    }
  }

  /**
   * Classify raw text into pitch sections
   */
  async classifySections(text: string, language: string): Promise<ClassifiedSectionDTO[]> {
    const sections: ClassifiedSectionDTO[] = [];

    // Step 1: Split text into blocks using heading detection
    const blocks = this.splitIntoBlocks(text);

    logger.debug('Split text into blocks', { blockCount: blocks.length });

    // Step 2: Classify each block
    for (const block of blocks) {
      if (block.content.trim().length < 50) {
        // Skip very short blocks
        continue;
      }

      let classification: { type: PitchSectionType; confidence: number };

      // Try rule-based classification first (faster)
      classification = await this.classifySectionType(block.content, block.title);

      // Only use LLM if rule-based confidence is low and LLM is enabled
      if (this.isEnabled && classification.confidence < 0.5) {
        try {
          classification = await this.classifyWithLLM(block.content);
        } catch (error) {
          logger.warn('LLM classification failed, using rule-based result', {
            error: error instanceof Error ? error.message : 'Unknown error',
          });
          // Keep the rule-based classification
        }
      }

      sections.push({
        type: classification.type,
        title: block.title || this.generateTitle(classification.type),
        content: block.content.trim(),
        rawContent: block.rawContent,
        confidence: classification.confidence,
        startPage: block.startPage,
        endPage: block.endPage,
      });
    }

    // Step 3: Merge adjacent sections of the same type
    const mergedSections = this.mergeSections(sections);

    logger.info('Section classification completed', {
      originalBlocks: blocks.length,
      classifiedSections: mergedSections.length,
      sectionTypes: mergedSections.map((s) => s.type),
    });

    return mergedSections;
  }

  /**
   * Classify a single text block into a section type
   */
  async classifySectionType(
    content: string,
    title?: string
  ): Promise<{ type: PitchSectionType; confidence: number }> {
    // Rule-based classification using keyword matching
    const scores: Record<PitchSectionType, number> = {
      PROBLEM: 0,
      SOLUTION: 0,
      MARKET: 0,
      BUSINESS_MODEL: 0,
      TRACTION: 0,
      TECHNOLOGY: 0,
      TEAM: 0,
      INVESTMENT_ASK: 0,
      OTHER: 0,
    };

    const lowerContent = content.toLowerCase();
    const lowerTitle = (title || '').toLowerCase();

    // Score based on title match (higher weight)
    for (const [sectionType, keywords] of Object.entries(SECTION_KEYWORDS)) {
      for (const keyword of keywords) {
        if (lowerTitle.includes(keyword)) {
          scores[sectionType as PitchSectionType] += 3;
        }
        if (lowerContent.includes(keyword)) {
          scores[sectionType as PitchSectionType] += 1;
        }
      }
    }

    // Find the highest scoring section type
    let maxScore = 0;
    let bestType: PitchSectionType = PitchSectionType.SOLUTION; // Default

    for (const [sectionType, score] of Object.entries(scores)) {
      if (score > maxScore) {
        maxScore = score;
        bestType = sectionType as PitchSectionType;
      }
    }

    // Calculate confidence based on score distribution
    const totalScore = Object.values(scores).reduce((a, b) => a + b, 0);
    const confidence = totalScore > 0 ? Math.min(maxScore / totalScore, 1) : 0.3;

    return { type: bestType, confidence };
  }

  /**
   * Split text into blocks based on headings and structure
   */
  private splitIntoBlocks(
    text: string
  ): Array<{
    title: string;
    content: string;
    rawContent: string;
    startPage?: number;
    endPage?: number;
  }> {
    const blocks: Array<{
      title: string;
      content: string;
      rawContent: string;
      startPage?: number;
      endPage?: number;
    }> = [];

    // First, try to split by page markers (common in PDF extraction)
    const pagePattern = /(?:^|\n)(?:Page\s+\d+|\[\d+\]|\-{3,}|\*{3,})/gi;
    const pageMatches = text.split(pagePattern);

    if (pageMatches.length > 1) {
      // Has page markers - process page by page
      let pageNum = 1;
      for (const pageContent of pageMatches) {
        if (pageContent.trim().length < 20) continue;

        const headingMatch = this.extractHeading(pageContent);
        blocks.push({
          title: headingMatch.heading,
          content: headingMatch.content,
          rawContent: pageContent,
          startPage: pageNum,
          endPage: pageNum,
        });
        pageNum++;
      }
    } else {
      // No page markers - split by headings
      const lines = text.split('\n');
      let currentBlock: {
        title: string;
        content: string[];
        rawContent: string[];
      } = {
        title: '',
        content: [],
        rawContent: [],
      };

      for (const line of lines) {
        const isHeading = this.isHeadingLine(line);

        if (isHeading && currentBlock.content.length > 0) {
          // Save current block and start new one
          blocks.push({
            title: currentBlock.title,
            content: currentBlock.content.join('\n'),
            rawContent: currentBlock.rawContent.join('\n'),
          });
          currentBlock = { title: line.trim(), content: [], rawContent: [line] };
        } else if (isHeading) {
          // First heading
          currentBlock.title = line.trim();
          currentBlock.rawContent.push(line);
        } else {
          currentBlock.content.push(line);
          currentBlock.rawContent.push(line);
        }
      }

      // Don't forget the last block
      if (currentBlock.content.length > 0) {
        blocks.push({
          title: currentBlock.title,
          content: currentBlock.content.join('\n'),
          rawContent: currentBlock.rawContent.join('\n'),
        });
      }
    }

    // If no meaningful blocks found, treat entire text as one block
    if (blocks.length === 0) {
      blocks.push({
        title: '',
        content: text,
        rawContent: text,
      });
    }

    return blocks;
  }

  /**
   * Check if a line is likely a heading
   */
  private isHeadingLine(line: string): boolean {
    const trimmed = line.trim();
    if (trimmed.length < 3 || trimmed.length > 100) return false;

    // Check against heading patterns
    for (const pattern of HEADING_PATTERNS) {
      if (pattern.test(trimmed)) return true;
    }

    // Check if it's mostly uppercase
    const upperCount = (trimmed.match(/[A-Z]/g) || []).length;
    const letterCount = (trimmed.match(/[a-zA-Z]/g) || []).length;
    if (letterCount > 3 && upperCount / letterCount > 0.6) return true;

    return false;
  }

  /**
   * Extract heading from page content
   */
  private extractHeading(content: string): { heading: string; content: string } {
    const lines = content.split('\n');
    let headingIndex = -1;

    for (let i = 0; i < Math.min(5, lines.length); i++) {
      if (this.isHeadingLine(lines[i])) {
        headingIndex = i;
        break;
      }
    }

    if (headingIndex >= 0) {
      return {
        heading: lines[headingIndex].trim(),
        content: lines.slice(headingIndex + 1).join('\n'),
      };
    }

    return { heading: '', content };
  }

  /**
   * Classify using LLM API
   */
  private async classifyWithLLM(content: string): Promise<{ type: PitchSectionType; confidence: number }> {
    // Truncate content to avoid token limits
    const truncatedContent = content.slice(0, 2000);

    let response: Response;
    let responseText: string;

    if (this.provider === 'gemini') {
      // Gemini API format
      response = await fetch(this.apiEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: CLASSIFICATION_PROMPT + truncatedContent }] }],
          generationConfig: { temperature: 0.1, maxOutputTokens: 100 },
        }),
      });

      if (!response.ok) {
        throw new Error(`Gemini API error: ${response.status}`);
      }

      const data = await response.json() as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      };
      responseText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
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
          messages: [{ role: 'user', content: CLASSIFICATION_PROMPT + truncatedContent }],
          temperature: 0.1,
          max_tokens: 100,
        }),
      });

      if (!response.ok) {
        throw new Error(`LLM API error: ${response.status}`);
      }

      const data = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      responseText = data.choices?.[0]?.message?.content || '';
    }

    // Parse JSON response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Invalid LLM response format');
    }

    const parsed = JSON.parse(jsonMatch[0]) as {
      type: string;
      confidence: number;
    };

    // Validate section type
    const validTypes = Object.values(PitchSectionType);
    if (!validTypes.includes(parsed.type as PitchSectionType)) {
      throw new Error(`Invalid section type: ${parsed.type}`);
    }

    return {
      type: parsed.type as PitchSectionType,
      confidence: Math.min(Math.max(parsed.confidence, 0), 1),
    };
  }

  /**
   * Merge adjacent sections of the same type
   */
  private mergeSections(sections: ClassifiedSectionDTO[]): ClassifiedSectionDTO[] {
    if (sections.length <= 1) return sections;

    const merged: ClassifiedSectionDTO[] = [];
    let current = { ...sections[0] };

    for (let i = 1; i < sections.length; i++) {
      const next = sections[i];

      if (next.type === current.type) {
        // Merge sections
        current.content += '\n\n' + next.content;
        current.rawContent += '\n\n' + next.rawContent;
        current.confidence = (current.confidence + next.confidence) / 2;
        if (next.endPage) current.endPage = next.endPage;
      } else {
        merged.push(current);
        current = { ...next };
      }
    }

    merged.push(current);
    return merged;
  }

  /**
   * Generate a default title for a section type
   */
  private generateTitle(type: PitchSectionType): string {
    const titles: Record<PitchSectionType, string> = {
      PROBLEM: 'The Problem',
      SOLUTION: 'Our Solution',
      MARKET: 'Market Opportunity',
      BUSINESS_MODEL: 'Business Model',
      TRACTION: 'Traction',
      TECHNOLOGY: 'Technology',
      TEAM: 'Our Team',
      INVESTMENT_ASK: 'Investment Ask',
      OTHER: 'Other',
    };
    return titles[type];
  }
}

// Export singleton instance
export const sectionClassifierService = new SectionClassifierService();
