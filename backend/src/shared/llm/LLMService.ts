/**
 * Shared LLM Service
 *
 * Provides a unified interface for calling LLM providers (OpenAI, Groq, Gemini).
 * Eliminates duplication across OpportunityMatchingService, ProjectMatchingService,
 * and OpenAIExplanationService.
 *
 * @module shared/llm/LLMService
 */

import { logger } from '../logger';
import { config } from '../../config';

/**
 * LLM Provider types
 */
export type LLMProvider = 'openai' | 'groq' | 'gemini' | 'none';

/**
 * Provider configuration
 */
export interface ProviderConfig {
  provider: LLMProvider;
  apiKey: string;
  model: string;
  baseUrl: string;
}

/**
 * Options for LLM calls
 */
export interface LLMCallOptions {
  maxTokens?: number;
  temperature?: number;
}

/**
 * Provider endpoints
 */
export const PROVIDER_ENDPOINTS = {
  openai: 'https://api.openai.com/v1/chat/completions',
  groq: 'https://api.groq.com/openai/v1/chat/completions',
  gemini: 'https://generativelanguage.googleapis.com/v1beta/models',
};

/**
 * Shared LLM Service
 *
 * Handles provider selection, configuration, and API calls for all LLM consumers.
 * Each consumer provides its own system prompt to customize behavior.
 */
export class LLMService {
  private providerConfig: ProviderConfig | null = null;
  private defaultSystemPrompt: string;

  constructor(defaultSystemPrompt?: string) {
    this.defaultSystemPrompt = defaultSystemPrompt || 'You are a helpful assistant. Always respond with valid JSON.';
    this.providerConfig = this.selectProvider();
  }

  /**
   * Get the currently active provider configuration (read-only)
   */
  getProviderConfig(): ProviderConfig | null {
    return this.providerConfig;
  }

  /**
   * Get the currently active provider name
   */
  getActiveProvider(): string {
    return this.providerConfig?.provider || 'none';
  }

  /**
   * Check if LLM service is available
   */
  isAvailable(): boolean {
    return this.providerConfig !== null && this.providerConfig.provider !== 'none';
  }

  /**
   * Call the configured LLM provider with a system prompt and user prompt.
   * Returns the raw text response from the LLM.
   *
   * @param userPrompt - The user/task prompt
   * @param systemPrompt - Optional system prompt override (uses default if not provided)
   * @param options - Optional max tokens and temperature
   * @returns The raw text response, or null if no provider is available or the call fails
   */
  async callLLM(
    userPrompt: string,
    systemPrompt?: string,
    options?: LLMCallOptions,
  ): Promise<string | null> {
    if (!this.providerConfig) {
      return null;
    }

    const resolvedSystemPrompt = systemPrompt || this.defaultSystemPrompt;
    const maxTokens = options?.maxTokens ?? 500;
    const temperature = options?.temperature ?? 0.7;

    try {
      if (this.providerConfig.provider === 'gemini') {
        return await this.callGeminiAPI(resolvedSystemPrompt, userPrompt, maxTokens, temperature);
      } else {
        return await this.callOpenAICompatibleAPI(resolvedSystemPrompt, userPrompt, maxTokens, temperature);
      }
    } catch (error) {
      logger.error('LLM call failed', {
        error,
        provider: this.providerConfig.provider,
      });
      throw error;
    }
  }

  /**
   * Select the best available provider based on configuration
   */
  private selectProvider(): ProviderConfig | null {
    const requestedProvider = config.ai.provider;

    // If a specific provider is requested, try to use it
    if (requestedProvider !== 'auto') {
      const providerConfig = this.getProviderConfigFor(requestedProvider as LLMProvider);
      if (providerConfig) {
        return providerConfig;
      }
      logger.warn(`Requested provider ${requestedProvider} not available, trying auto-select`);
    }

    // Auto-select: try providers in order of preference (free first)
    const providerOrder: LLMProvider[] = ['groq', 'gemini', 'openai'];

    for (const provider of providerOrder) {
      const providerConfig = this.getProviderConfigFor(provider);
      if (providerConfig) {
        return providerConfig;
      }
    }

    return null;
  }

  /**
   * Get configuration for a specific provider
   */
  private getProviderConfigFor(provider: LLMProvider): ProviderConfig | null {
    switch (provider) {
      case 'groq':
        if (config.ai.groq.enabled && config.ai.groq.apiKey) {
          return {
            provider: 'groq',
            apiKey: config.ai.groq.apiKey,
            model: config.ai.groq.model || 'llama-3.3-70b-versatile',
            baseUrl: PROVIDER_ENDPOINTS.groq,
          };
        }
        break;

      case 'gemini':
        if (config.ai.gemini.enabled && config.ai.gemini.apiKey) {
          return {
            provider: 'gemini',
            apiKey: config.ai.gemini.apiKey,
            model: config.ai.gemini.model || 'gemini-1.5-flash',
            baseUrl: PROVIDER_ENDPOINTS.gemini,
          };
        }
        break;

      case 'openai':
        if (config.ai.openai.enabled && config.ai.openai.apiKey) {
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

  /**
   * Call OpenAI-compatible API (works for OpenAI and Groq)
   */
  private async callOpenAICompatibleAPI(
    systemPrompt: string,
    userPrompt: string,
    maxTokens: number,
    temperature: number,
  ): Promise<string> {
    if (!this.providerConfig) {
      throw new Error('No provider configured');
    }

    const response = await fetch(this.providerConfig.baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.providerConfig.apiKey}`,
      },
      body: JSON.stringify({
        model: this.providerConfig.model,
        messages: [
          {
            role: 'system',
            content: systemPrompt,
          },
          {
            role: 'user',
            content: userPrompt,
          },
        ],
        temperature,
        max_tokens: maxTokens,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`${this.providerConfig.provider} API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('No content in response');
    }

    return content;
  }

  /**
   * Call Google Gemini API
   */
  private async callGeminiAPI(
    systemPrompt: string,
    userPrompt: string,
    maxTokens: number,
    temperature: number,
  ): Promise<string> {
    if (!this.providerConfig) {
      throw new Error('No provider configured');
    }

    const url = `${this.providerConfig.baseUrl}/${this.providerConfig.model}:generateContent?key=${this.providerConfig.apiKey}`;

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
                text: `${systemPrompt}\n\n${userPrompt}`,
              },
            ],
          },
        ],
        generationConfig: {
          temperature,
          maxOutputTokens: maxTokens,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json() as {
      candidates?: Array<{
        content?: {
          parts?: Array<{ text?: string }>
        }
      }>
    };

    const content = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!content) {
      throw new Error('No content in Gemini response');
    }

    return content;
  }
}
