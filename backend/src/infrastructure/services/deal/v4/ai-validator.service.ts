/**
 * Deal AI Validator (v4.1)
 *
 * Bounded LLM validation that adjusts a deterministic score by ±N (default 10)
 * based on commercial-fit reasoning. The LLM never replaces the deterministic
 * score, never overrides FAIL hard filters, and never invents evidence.
 *
 * Feature-flagged via DEAL_AI_VALIDATION_ENABLED. If the LLM is unavailable
 * or returns malformed JSON, this returns null so the caller keeps the
 * deterministic score and explanation unchanged.
 */

import { logger } from '../../../../shared/logger';
import { LLMService } from '../../../../shared/llm/LLMService';
import { BuyRequest, SellOffering } from './types';
import { ScoreBreakdown, HardFilterResult, HardFilterStatus } from './common';
import { NetworkContext } from './network.utils';

const dealLLM = new LLMService(
  'You are a senior B2B deal-fit evaluator. Always respond with valid JSON.',
);

export type DealMatchMode =
  | 'BUY_TO_NETWORK_SELLERS'
  | 'SELL_TO_NETWORK_BUYERS'
  | 'BUY_TO_SELLER_HELPERS'
  | 'SELL_TO_BUYER_HELPERS';

export interface AIValidationInput {
  matchMode: DealMatchMode;
  buyRequest: BuyRequest;
  sellOffering: SellOffering;
  deterministicScore: number;
  scoreBreakdown: ScoreBreakdown;
  hardFilter: HardFilterResult;
  networkContext: NetworkContext | null;
  maxAdjustment: number;
}

export interface AIValidationResult {
  originalScore: number;
  adjustedScore: number;
  confidence: number;
  reasoning: string;
  greenFlags: string[];
  redFlags: string[];
  commercialFitSummary: string;
  requirementsAssessment: string;
  riskAssessment: string;
}

interface RawValidation {
  targetEntityId?: string;
  originalScore?: number;
  adjustedScore?: number;
  confidence?: number;
  reasoning?: string;
  greenFlags?: string[];
  redFlags?: string[];
  commercialFitSummary?: string;
  requirementsAssessment?: string;
  riskAssessment?: string;
}

export class DealAIValidator {
  isEnabled(): boolean {
    return process.env.DEAL_AI_VALIDATION_ENABLED === 'true' && dealLLM.isAvailable();
  }

  async validateDirectMatch(input: AIValidationInput): Promise<AIValidationResult | null> {
    if (input.hardFilter.status === HardFilterStatus.FAIL) return null;
    if (!dealLLM.isAvailable()) return null;

    const systemPrompt = this.buildDirectSystemPrompt(input.matchMode);
    const userPrompt = this.buildDirectUserPrompt(input);

    let raw: string | null;
    try {
      raw = await dealLLM.callLLM(userPrompt, systemPrompt, { temperature: 0, maxTokens: 800 });
    } catch (err) {
      logger.warn('Deal AI validation LLM call failed', { error: (err as Error).message });
      return null;
    }
    if (!raw) return null;

    const parsed = this.parseValidations(raw);
    if (!parsed.length) return null;
    const v = parsed[0];

    const originalScore = typeof v.originalScore === 'number' ? v.originalScore : input.deterministicScore;
    const proposed = typeof v.adjustedScore === 'number' ? v.adjustedScore : originalScore;
    const adjustedScore = this.boundAdjustment(input.deterministicScore, proposed, input.maxAdjustment);

    return {
      originalScore: input.deterministicScore,
      adjustedScore,
      confidence: this.clampConfidence(v.confidence ?? 0.7),
      reasoning: this.sanitizeText(v.reasoning) || 'No reasoning provided.',
      greenFlags: this.sanitizeStringList(v.greenFlags),
      redFlags: this.sanitizeStringList(v.redFlags),
      commercialFitSummary: this.sanitizeText(v.commercialFitSummary) || '',
      requirementsAssessment: this.sanitizeText(v.requirementsAssessment) || '',
      riskAssessment: this.sanitizeText(v.riskAssessment) || '',
    };
  }

  private boundAdjustment(deterministic: number, proposed: number, max: number): number {
    if (Number.isNaN(proposed) || !Number.isFinite(proposed)) return deterministic;
    const lo = Math.max(0, deterministic - max);
    const hi = Math.min(100, deterministic + max);
    return Math.round(Math.max(lo, Math.min(hi, proposed)));
  }

  private clampConfidence(c: number): number {
    if (Number.isNaN(c) || !Number.isFinite(c)) return 0.5;
    return Math.max(0, Math.min(1, c));
  }

  private sanitizeText(s: unknown): string {
    if (typeof s !== 'string') return '';
    return s.trim().slice(0, 1000);
  }

  private sanitizeStringList(s: unknown): string[] {
    if (!Array.isArray(s)) return [];
    return s.filter((x): x is string => typeof x === 'string').map(x => x.trim()).filter(Boolean).slice(0, 6);
  }

  private parseValidations(raw: string): RawValidation[] {
    // Tolerate leading/trailing prose; pull out the first JSON object.
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start === -1 || end === -1 || end <= start) return [];
    const slice = raw.slice(start, end + 1);
    try {
      const obj = JSON.parse(slice);
      if (Array.isArray(obj?.validations)) return obj.validations as RawValidation[];
      // Some LLM outputs return a bare validation object — wrap it.
      if (obj && typeof obj === 'object' && ('adjustedScore' in obj || 'reasoning' in obj)) return [obj as RawValidation];
      return [];
    } catch {
      return [];
    }
  }

  // -----------------------------------------------------------------------
  // Prompt builders
  // -----------------------------------------------------------------------

  private buildDirectSystemPrompt(mode: DealMatchMode): string {
    const focus = mode === 'BUY_TO_NETWORK_SELLERS'
      ? 'Assess whether this seller/provider is commercially suitable for the buyer\'s request.'
      : 'Assess whether this buyer is commercially suitable for the seller\'s offering.';
    return [
      'You are a senior B2B deal-fit evaluator validating a deterministic match score.',
      focus,
      'Rules you MUST follow:',
      '- Return ONLY valid JSON. No prose, no markdown fences.',
      '- Stay within ±10 of the deterministic score. Be conservative.',
      '- Never invent evidence. If a field is missing, say so in redFlags.',
      '- Never override hard-filter FAIL (caller already excluded those).',
      '- adjustedScore is an integer 0..100.',
      '- Output schema: {"validations":[{"targetEntityId","originalScore","adjustedScore","confidence","reasoning","greenFlags","redFlags","commercialFitSummary","requirementsAssessment","riskAssessment"}]}',
    ].join('\n');
  }

  private buildDirectUserPrompt(input: AIValidationInput): string {
    const { buyRequest: b, sellOffering: s, deterministicScore, scoreBreakdown, hardFilter, networkContext, matchMode } = input;
    const components = scoreBreakdown.components.map(c => ({ name: c.name, score: c.score, matched: c.matchedItems.slice(0, 4), missing: c.missingItems.slice(0, 4) }));

    return JSON.stringify({
      mode: matchMode,
      deterministicScore,
      maxAdjustment: input.maxAdjustment,
      buyer: {
        whatYouNeed: b.whatYouNeed,
        solutionCategory: b.solutionCategory,
        relevantIndustry: b.relevantIndustry,
        providerType: b.providerType,
        mustHaveRequirements: b.mustHaveRequirements,
        budgetRange: b.budgetRange,
        neededTimeline: b.neededTimeline,
        buyingStage: b.buyingStage,
        deliveryMode: b.deliveryMode,
        targetMarketLocation: b.targetMarketLocation,
        idealProviderProfile: b.idealProviderProfile,
        buyerRole: b.buyerRole,
      },
      seller: {
        productServiceName: s.productServiceName,
        offeringSummary: s.offeringSummary,
        solutionCategory: s.solutionCategory,
        industryFocus: s.industryFocus,
        providerType: s.providerType,
        capabilities: (s.capabilities || []).slice(0, 25),
        priceRange: s.priceRange,
        deliveryModel: s.deliveryModel,
        deliveryModeCapability: s.deliveryModeCapability,
        targetCompanySize: s.targetCompanySize,
        idealBuyerType: s.idealBuyerType,
        idealCustomerProfile: s.idealCustomerProfile,
        salesTimeline: s.salesTimeline,
        targetMarketLocation: s.targetMarketLocation,
      },
      hardFilter: { status: hardFilter.status, reason: hardFilter.reason, details: hardFilter.details },
      components,
      network: networkContext ? {
        firstDegree: networkContext.isFirstDegree,
        secondDegree: networkContext.isSecondDegree,
        sameOrganization: networkContext.sameOrganization,
        mutuals: networkContext.mutualConnections,
        relationshipStrength: networkContext.relationshipStrength,
      } : null,
      instruction: 'Return JSON now.',
    });
  }
}

export const dealAIValidator = new DealAIValidator();
