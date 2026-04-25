/**
 * Opportunity LLM Service v2
 *
 * LLM integration with:
 * - Provider cascade (Groq → Gemini → OpenAI)
 * - Strict validation rules
 * - Cannot override hard filter FAIL
 * - Fallback to deterministic on failure
 *
 * @module infrastructure/external/opportunities/services/opportunity-llm.service
 */

import { logger } from '../../../../shared/logger';
import { config } from '../../../../config';
import {
  LLMProvider,
  AIValidationResult,
  MatchResult,
  IntentWithDetails,
  HardFilterStatus,
  FALLBACK_SCORES,
} from '../types/opportunity-matching.types';

// ============================================================================
// Types
// ============================================================================

interface ProviderConfig {
  provider: LLMProvider;
  apiKey: string;
  model: string;
  baseUrl: string;
}

interface ExplanationResult {
  suggestedAction: string;
  suggestedMessage: string;
  nextSteps: string[];
}

// ============================================================================
// Constants
// ============================================================================

const PROVIDER_ENDPOINTS = {
  openai: 'https://api.openai.com/v1/chat/completions',
  groq: 'https://api.groq.com/openai/v1/chat/completions',
  gemini: 'https://generativelanguage.googleapis.com/v1beta/models',
};

const DEFAULT_TIMEOUT_MS = 30000;

// ============================================================================
// Service Class
// ============================================================================

export class OpportunityLLMService {
  private providerConfig: ProviderConfig | null = null;
  private fallbackProviders: ProviderConfig[] = [];

  constructor() {
    this.initializeProviders();
  }

  private initializeProviders(): void {
    const providers: LLMProvider[] = ['groq', 'gemini', 'openai'];

    for (const provider of providers) {
      const providerConfig = this.getProviderConfig(provider);
      if (providerConfig) {
        if (!this.providerConfig) {
          this.providerConfig = providerConfig;
          logger.info(`Opportunity LLM primary provider: ${provider}`, { model: providerConfig.model });
        } else {
          this.fallbackProviders.push(providerConfig);
        }
      }
    }

    if (!this.providerConfig) {
      logger.warn('No LLM providers configured for opportunity matching v2 - will use deterministic only');
    } else {
      logger.info(`Opportunity LLM fallback providers: ${this.fallbackProviders.map(p => p.provider).join(', ') || 'none'}`);
    }
  }

  private getProviderConfig(provider: LLMProvider): ProviderConfig | null {
    switch (provider) {
      case 'groq':
        if (config.ai?.groq?.enabled && config.ai.groq.apiKey) {
          return {
            provider: 'groq',
            apiKey: config.ai.groq.apiKey,
            model: config.ai.groq.model || 'llama-3.3-70b-versatile',
            baseUrl: PROVIDER_ENDPOINTS.groq,
          };
        }
        break;

      case 'gemini':
        if (config.ai?.gemini?.enabled && config.ai.gemini.apiKey) {
          return {
            provider: 'gemini',
            apiKey: config.ai.gemini.apiKey,
            model: config.ai.gemini.model || 'gemini-1.5-flash',
            baseUrl: PROVIDER_ENDPOINTS.gemini,
          };
        }
        break;

      case 'openai':
        if (config.ai?.openai?.enabled && config.ai.openai.apiKey) {
          return {
            provider: 'openai',
            apiKey: config.ai.openai.apiKey,
            model: config.ai.openai.model || 'gpt-4o-mini',
            baseUrl: PROVIDER_ENDPOINTS.openai,
          };
        }
        break;
    }

    return null;
  }

  isAvailable(): boolean {
    return this.providerConfig !== null;
  }

  getActiveProvider(): string {
    return this.providerConfig?.provider || 'none';
  }

  // ============================================================================
  // AI Validation
  // ============================================================================

  /**
   * Validate candidate roles using AI
   * IMPORTANT: AI CANNOT override hard filter FAIL
   */
  async validateCandidateRoles(
    intent: IntentWithDetails,
    candidates: MatchResult[],
    timeoutMs: number = DEFAULT_TIMEOUT_MS
  ): Promise<AIValidationResult | null> {
    if (!this.providerConfig || candidates.length === 0) {
      return null;
    }

    // Only validate for HIRING and OPEN_TO_OPPORTUNITIES
    if (intent.intentType !== 'HIRING' && intent.intentType !== 'OPEN_TO_OPPORTUNITIES') {
      return null;
    }

    const startTime = Date.now();
    const roleArea = intent.roleArea || 'general';
    const seniority = intent.seniority || 'any level';

    // Build list of candidates to validate (exclude FAIL)
    const validatedInfo: Array<{ originalIndex: number; candidate: MatchResult }> = [];
    for (let i = 0; i < candidates.length; i++) {
      const c = candidates[i];
      if (c.hardFilterStatus !== HardFilterStatus.FAIL) {
        validatedInfo.push({ originalIndex: i, candidate: c });
      }
    }

    if (validatedInfo.length === 0) {
      logger.info('No candidates passed hard filters for AI validation');
      return {
        scores: candidates.map(() => 0),
        provider: 'none',
        latencyMs: 0,
        notes: candidates.map(() => 'Excluded by hard filter'),
        fallbackUsed: false,
      };
    }

    const candidateList = validatedInfo.map((info, idx) => ({
      idx,
      name: info.candidate.candidateName,
      jobTitle: info.candidate.candidateTitle || 'Unknown',
      company: info.candidate.candidateCompany || 'Unknown',
      skills: info.candidate.sharedSkills.slice(0, 5).join(', '),
      matchLevel: info.candidate.matchLevel,
    }));

    const validatedIndices = validatedInfo.map(info => info.originalIndex);
    const prompt = this.buildValidationPrompt(intent.intentType as any, roleArea, seniority as string, candidateList);

    // Try providers in cascade
    const allProviders = [this.providerConfig, ...this.fallbackProviders];

    for (const providerCfg of allProviders) {
      try {
        const content = await this.callLLM(providerCfg, prompt, timeoutMs);
        const validation = this.parseValidationResponse(content, candidates.length, validatedIndices);

        if (validation) {
          return {
            scores: validation.scores,
            provider: providerCfg.provider,
            latencyMs: Date.now() - startTime,
            notes: validation.notes,
            fallbackUsed: false,
          };
        }
      } catch (error) {
        logger.warn(`LLM validation failed with ${providerCfg.provider}`, {
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    logger.error('All LLM providers failed for validation');
    return {
      scores: candidates.map(() => FALLBACK_SCORES.MISSING_AI_RESULT),
      provider: 'none',
      latencyMs: Date.now() - startTime,
      notes: candidates.map(() => 'LLM validation unavailable - using deterministic score only'),
      fallbackUsed: true,
      fallbackReason: 'All LLM providers failed or timed out',
    };
  }

  private buildValidationPrompt(
    intentType: 'HIRING' | 'OPEN_TO_OPPORTUNITIES',
    roleArea: string,
    seniority: string,
    candidateList: Array<{ idx: number; name: string; jobTitle: string; company: string; skills: string; matchLevel: string }>
  ): string {
    if (intentType === 'HIRING') {
      return `
You are validating candidates for a HIRING opportunity. Be STRICT.

Role: "${roleArea}" at ${seniority} level.

CRITICAL RULES:
1. C-suite executives (CEO, CTO, CFO) are NOT hirable for individual contributor roles. Score 0-15.
2. Founders are NOT hirable for employee positions. Score 0-10.
3. VPs/Directors are NOT hirable for non-leadership roles below them. Score 0-20.
4. Candidate's functional area MUST match the role. Cross-field candidates score 0-10.
5. Only candidates at SIMILAR or SLIGHTLY LOWER level in SAME functional area should score 70+.

Candidates to validate:
${candidateList.map(c => `${c.idx}. ${c.name} | ${c.jobTitle} @ ${c.company} | Skills: ${c.skills}`).join('\n')}

Rate each 0-100. Respond ONLY with valid JSON:
{"scores":[n,n,n],"notes":["note1","note2","note3"]}

Where each note explains your reasoning in 10 words or less.`;
    }

    return `
You are validating candidates for someone seeking opportunities.

The person is looking for: "${roleArea}" at ${seniority} level.

Candidates who can HIRE or REFER should score higher:
- Executives/Founders who hire: 80-100
- Managers in relevant field: 60-80
- HR/Recruiters: 70-90
- Peers: 30-50

Candidates:
${candidateList.map(c => `${c.idx}. ${c.name} | ${c.jobTitle} @ ${c.company}`).join('\n')}

Rate each 0-100. Respond ONLY with valid JSON:
{"scores":[n,n,n],"notes":["note1","note2","note3"]}`;
  }

  private parseValidationResponse(
    content: string,
    totalCandidates: number,
    validatedIndices: number[]
  ): { scores: number[]; notes: string[] } | null {
    try {
      let jsonStr = content;
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        jsonStr = jsonMatch[0];
      }

      const parsed = JSON.parse(jsonStr.trim());

      if (!Array.isArray(parsed.scores) || parsed.scores.length !== validatedIndices.length) {
        return null;
      }

      const notesArray: string[] = Array.isArray(parsed.notes) ? parsed.notes : [];

      const fullScores: number[] = new Array(totalCandidates).fill(0);
      const fullNotes: string[] = new Array(totalCandidates).fill('Excluded by hard filter');

      for (let i = 0; i < validatedIndices.length; i++) {
        const originalIndex = validatedIndices[i];
        const rawScore = parsed.scores[i];
        const clamped = typeof rawScore === 'number'
          ? Math.min(100, Math.max(0, rawScore))
          : 0;
        fullScores[originalIndex] = clamped;
        fullNotes[originalIndex] = notesArray[i] ?? '';
      }

      return { scores: fullScores, notes: fullNotes };
    } catch (error) {
      logger.warn('Failed to parse AI validation response', { content: content.slice(0, 200) });
      return null;
    }
  }

  // ============================================================================
  // Explanation Generation
  // ============================================================================

  async generateExplanationsBatch(
    intent: IntentWithDetails,
    candidates: MatchResult[],
    maxConcurrent: number = 5,
    timeoutMs: number = DEFAULT_TIMEOUT_MS
  ): Promise<Map<string, ExplanationResult>> {
    const results = new Map<string, ExplanationResult>();

    if (!this.providerConfig || candidates.length === 0) {
      return results;
    }

    const batches: MatchResult[][] = [];
    for (let i = 0; i < candidates.length; i += maxConcurrent) {
      batches.push(candidates.slice(i, i + maxConcurrent));
    }

    for (const batch of batches) {
      const promises = batch.map(async (candidate) => {
        try {
          const explanation = await this.generateSingleExplanation(intent, candidate, timeoutMs);
          if (explanation) {
            results.set(candidate.candidateId, explanation);
          }
        } catch (error) {
          logger.warn('Failed to generate explanation', {
            candidateId: candidate.candidateId,
            error: error instanceof Error ? error.message : 'Unknown',
          });
        }
      });

      await Promise.all(promises);
    }

    return results;
  }

  private async generateSingleExplanation(
    intent: IntentWithDetails,
    candidate: MatchResult,
    timeoutMs: number
  ): Promise<ExplanationResult | null> {
    if (!this.providerConfig) return null;

    const prompt = this.buildExplanationPrompt(intent, candidate);

    try {
      const content = await this.callLLM(this.providerConfig, prompt, timeoutMs);
      return this.parseExplanationResponse(content);
    } catch (error) {
      for (const fallback of this.fallbackProviders) {
        try {
          const content = await this.callLLM(fallback, prompt, timeoutMs);
          return this.parseExplanationResponse(content);
        } catch {
          continue;
        }
      }
      return null;
    }
  }

  private buildExplanationPrompt(intent: IntentWithDetails, candidate: MatchResult): string {
    const firstName = candidate.candidateName.split(' ')[0];

    return `
Generate a personalized outreach for ${intent.intentType}:

Candidate: ${candidate.candidateName}
Title: ${candidate.candidateTitle || 'Unknown'}
Company: ${candidate.candidateCompany || 'Unknown'}
Match strengths: ${candidate.keyStrengths.slice(0, 3).join(', ')}
Shared skills: ${candidate.sharedSkills.slice(0, 3).join(', ')}

Role being discussed: ${intent.roleArea || 'career opportunity'}

Generate JSON with:
- suggestedAction: one of "Send Message", "Connect", "Request Intro", "Schedule Call"
- suggestedMessage: personalized 2-3 sentence message to ${firstName}
- nextSteps: array of 3 short action items

Respond ONLY with valid JSON:
{"suggestedAction":"...","suggestedMessage":"...","nextSteps":["...","..",".."]}`;
  }

  private parseExplanationResponse(content: string): ExplanationResult | null {
    try {
      let jsonStr = content;
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        jsonStr = jsonMatch[0];
      }

      const parsed = JSON.parse(jsonStr.trim());

      return {
        suggestedAction: parsed.suggestedAction || 'Connect',
        suggestedMessage: parsed.suggestedMessage || '',
        nextSteps: Array.isArray(parsed.nextSteps) ? parsed.nextSteps.slice(0, 3) : [],
      };
    } catch {
      return null;
    }
  }

  // ============================================================================
  // LLM API Calls
  // ============================================================================

  private async callLLM(
    providerCfg: ProviderConfig,
    prompt: string,
    timeoutMs: number
  ): Promise<string> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      let content: string;

      if (providerCfg.provider === 'gemini') {
        content = await this.callGeminiAPI(providerCfg, prompt, (controller.signal as AbortSignal));
      } else {
        content = await this.callOpenAICompatibleAPI(providerCfg, prompt, (controller.signal as AbortSignal));
      }

      return content;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private async callOpenAICompatibleAPI(
    providerCfg: ProviderConfig,
    prompt: string,
    signal: AbortSignal
  ): Promise<string> {
    const response = await fetch(providerCfg.baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${providerCfg.apiKey}`,
      },
      body: JSON.stringify({
        model: providerCfg.model,
        messages: [
          {
            role: 'system',
            content: 'You are a hiring validation assistant. Be strict and accurate. Always respond with valid JSON when requested.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.3,
        max_tokens: 500,
      }),
      signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`${providerCfg.provider} API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('No content in response');
    }

    return content;
  }

  private async callGeminiAPI(
    providerCfg: ProviderConfig,
    prompt: string,
    signal: AbortSignal
  ): Promise<string> {
    const url = `${providerCfg.baseUrl}/${providerCfg.model}:generateContent?key=${providerCfg.apiKey}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: `You are a hiring validation assistant. Be strict and accurate. Always respond with valid JSON when requested.\n\n${prompt}`,
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 500,
        },
      }),
      signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json() as {
      candidates?: Array<{
        content?: {
          parts?: Array<{ text?: string }>;
        };
      }>;
    };

    const content = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!content) {
      throw new Error('No content in Gemini response');
    }

    return content;
  }
}

// Export singleton
export const opportunityLLMService = new OpportunityLLMService();

