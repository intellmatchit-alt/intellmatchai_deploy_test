/**
 * IntellMatch Pitch Matching Engine — LLM Service
 * v8.0.0 — production-hardened
 */

import {
  LLMProvider, PitchAIValidationItem, PitchAIValidationRequest, PitchContact,
  ExtractedPitchFields, PitchProfile, MatchIntent, PitchStage, BusinessModel, SupportNeededTag,
} from './pitch-matching.types';
import { AI_MAX_SCORE_ADJUSTMENT } from './matching-bands.constants';

interface ProviderConfig { provider: LLMProvider; apiKey: string; model: string; baseUrl: string; }
const TIMEOUT_MS = 30_000;

export class PitchLLMService {
  private primary: ProviderConfig | null = null;
  private fallbacks: ProviderConfig[] = [];

  constructor() { this.initProviders(); }

  private initProviders(): void {
    const candidates: Array<{ provider: LLMProvider; envKey: string; model: string; baseUrl: string }> = [
      { provider: 'groq', envKey: 'GROQ_API_KEY', model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile', baseUrl: 'https://api.groq.com/openai/v1/chat/completions' },
      { provider: 'gemini', envKey: 'GEMINI_API_KEY', model: process.env.GEMINI_MODEL || 'gemini-1.5-flash', baseUrl: 'https://generativelanguage.googleapis.com/v1beta/models' },
      { provider: 'openai', envKey: 'OPENAI_API_KEY', model: process.env.OPENAI_MODEL || 'gpt-4o-mini', baseUrl: 'https://api.openai.com/v1/chat/completions' },
    ];
    for (const c of candidates) {
      const apiKey = process.env[c.envKey];
      if (!apiKey) continue;
      const config: ProviderConfig = { provider: c.provider, apiKey, model: c.model, baseUrl: c.baseUrl };
      if (!this.primary) this.primary = config; else this.fallbacks.push(config);
    }
  }

  isAvailable(): boolean { return this.primary !== null; }

  async validateMatches(request: PitchAIValidationRequest): Promise<PitchAIValidationItem[]> {
    if (!this.primary) return this.fallbackValidations(request.contacts, request.deterministicScores);
    const prompt = this.buildValidationPrompt(request);
    try {
      const raw = await this.callWithCascade(prompt);
      return this.parseValidation(raw, request.deterministicScores, request.contacts);
    } catch (error) {
      console.error('[PitchLLM] Validation failed', error);
      return this.fallbackValidations(request.contacts, request.deterministicScores);
    }
  }

  async extractPitchFields(text: string): Promise<ExtractedPitchFields> {
    if (!this.primary) return {};
    const prompt = `Extract structured pitch fields from the following pitch deck / one-pager text.
Map to EXACTLY these fields for the IntellMatch Pitch Form.

Fields:
- pitchTitle (string)
- companyName (string | null)
- elevatorPitch (string)
- problemStatement (string)
- solutionSummary (string)
- whatYouNeed (string)
- matchIntent (array of: INVESTOR, ADVISOR, STRATEGIC_PARTNER, COFOUNDER, CUSTOMER_BUYER)
- pitchStage (enum: JUST_AN_IDEA, VALIDATING, BUILDING_MVP, LAUNCHED, GROWING, SCALING)
- primaryCategory (string)
- industrySectors (string array)
- businessModel (array of: B2B, B2C, B2B2C, SAAS, MARKETPLACE, SERVICES, SUBSCRIPTION, HARDWARE, LICENSING)
- targetCustomerType (string array)
- operatingMarkets (string array)
- tractionSummary (string | null)
- founderBackgroundSummary (string | null)
- suggestedTags (string array)
- fundingAmountRequested (number | null)
- fundingCurrency (string | null)
- supportNeededTags (array of: funding, introductions, advisor, board_governance, strategic_partner, distribution_channel, technical_integration, pilot_customer, design_partner, buyer_customer, enterprise_access, cofounder, hiring_talent, compliance_regulatory, market_access, growth_support)
- fieldConfidence (object with 0..1 confidence per field)

Rules:
- Use only facts grounded in the text.
- If uncertain, prefer empty arrays or null.
- matchIntent must be inferable from the stated ask or need.
- supportNeededTags should capture the types of support/partnerships being sought.
- Suggested values must be editable by the user later.

TEXT:
${text.slice(0, 12000)}

Respond with ONLY valid JSON.`;

    try {
      const raw = await this.callWithCascade(prompt);
      return this.parseExtracted(raw) as ExtractedPitchFields;
    } catch (error) {
      console.error('[PitchLLM] Extraction failed', error);
      return {};
    }
  }

  private buildValidationPrompt(request: PitchAIValidationRequest): string {
    const pitch = request.pitch;
    const contactSummaries = request.contacts.map((c, i) =>
      `${i}. ${c.fullName} | Types: ${c.contactTypes.join(', ')} | ${c.title} @ ${c.company} | Sectors: ${c.sectors.slice(0, 5).join(', ')} | Can offer: ${c.canOffer.slice(0, 6).join(', ')} | Score: ${request.deterministicScores[i]}`
    ).join('\n');

    return `You are evaluating pitch-contact matches for the IntellMatch platform.

PITCH:
- Title: ${pitch.pitchTitle}
- Intent: ${pitch.matchIntent.join(', ') || 'N/A'}
- Stage: ${pitch.pitchStage}
- Category: ${pitch.primaryCategory}
- Sectors: ${pitch.industrySectors.join(', ')}
- Need: ${pitch.whatYouNeed}
- Elevator: ${pitch.elevatorPitch.slice(0, 300)}
- Traction: ${(pitch.tractionSummary || 'N/A').slice(0, 200)}
- Team: ${(pitch.founderBackgroundSummary || 'N/A').slice(0, 200)}

CONTACTS:
${contactSummaries}

Rules:
- Adjust scores by at most +/-${AI_MAX_SCORE_ADJUSTMENT} points.
- Be conservative when uncertain.
- Penalize wrong-type, wrong-stage, weak strategic fit.
- For INVESTOR: prioritize traction, stage, team.
- For ADVISOR: prioritize expertise, domain fit.
- For STRATEGIC_PARTNER: prioritize distribution, go-to-market.
- For COFOUNDER: prioritize complementary skills, mission.
- For CUSTOMER_BUYER: prioritize ICP, pain, geography.

Respond ONLY with valid JSON:
{
  "validations": [
    { "index": 0, "contactId": "...", "originalScore": 70, "adjustedScore": 73, "confidence": 0.8, "reasoning": "...", "redFlags": ["..."], "greenFlags": ["..."] }
  ]
}`;
  }

  /** v8: Improved parse validation with schema checks */
  private parseValidation(raw: string, originalScores: number[], contacts: PitchContact[]): PitchAIValidationItem[] {
    try {
      const json = raw.match(/\{[\s\S]*\}/)?.[0];
      if (!json) return this.fallbackValidations(contacts, originalScores);
      const parsed = JSON.parse(json);
      if (!parsed.validations || !Array.isArray(parsed.validations)) return this.fallbackValidations(contacts, originalScores);

      const items: PitchAIValidationItem[] = [];
      for (const v of parsed.validations) {
        const index = typeof v.index === 'number' ? v.index : -1;
        if (index < 0 || index >= contacts.length) continue;
        const orig = originalScores[index] ?? 0;
        let adj = typeof v.adjustedScore === 'number' ? v.adjustedScore : orig;
        const delta = adj - orig;
        if (Math.abs(delta) > AI_MAX_SCORE_ADJUSTMENT) adj = orig + (delta > 0 ? AI_MAX_SCORE_ADJUSTMENT : -AI_MAX_SCORE_ADJUSTMENT);

        items.push({
          contactId: contacts[index].id, originalScore: orig,
          adjustedScore: Math.max(0, Math.min(100, Math.round(adj))),
          confidence: typeof v.confidence === 'number' ? Math.max(0, Math.min(1, v.confidence)) : 0.5,
          reasoning: sanitizeString(v.reasoning, 500),
          redFlags: sanitizeStringArray(v.redFlags, 5),
          greenFlags: sanitizeStringArray(v.greenFlags, 5),
        });
      }
      return items.length ? items : this.fallbackValidations(contacts, originalScores);
    } catch { return this.fallbackValidations(contacts, originalScores); }
  }

  private parseExtracted(raw: string): Record<string, unknown> {
    try {
      const json = raw.match(/\{[\s\S]*\}/)?.[0];
      if (!json) return {};
      const parsed = JSON.parse(json);
      // Validate enums
      if (Array.isArray(parsed.matchIntent)) parsed.matchIntent = parsed.matchIntent.filter((v: unknown) => Object.values(MatchIntent).includes(v as MatchIntent));
      if (parsed.pitchStage && !Object.values(PitchStage).includes(parsed.pitchStage as PitchStage)) delete parsed.pitchStage;
      if (Array.isArray(parsed.businessModel)) parsed.businessModel = parsed.businessModel.filter((v: unknown) => Object.values(BusinessModel).includes(v as BusinessModel));
      if (Array.isArray(parsed.supportNeededTags)) parsed.supportNeededTags = parsed.supportNeededTags.filter((v: unknown) => Object.values(SupportNeededTag).includes(v as SupportNeededTag));
      // Normalize funding
      if (parsed.fundingAmountRequested != null) {
        const num = typeof parsed.fundingAmountRequested === 'number' ? parsed.fundingAmountRequested : Number(String(parsed.fundingAmountRequested).replace(/[^0-9.]/g, ''));
        if (!isNaN(num) && num > 0) parsed.fundingAmountRequested = num; else delete parsed.fundingAmountRequested;
      }
      if (parsed.fundingCurrency != null) {
        if (typeof parsed.fundingCurrency === 'string' && parsed.fundingCurrency.trim()) parsed.fundingCurrency = parsed.fundingCurrency.trim().toUpperCase();
        else delete parsed.fundingCurrency;
      }
      return parsed;
    } catch { return {}; }
  }

  /** v8 FIX: Fallback preserves original deterministic scores */
  private fallbackValidations(contacts: PitchContact[], deterministicScores: number[] = []): PitchAIValidationItem[] {
    return contacts.map((c, i) => ({
      contactId: c.id, originalScore: deterministicScores[i] ?? 0,
      adjustedScore: deterministicScores[i] ?? 0, confidence: 0,
      reasoning: 'AI validation unavailable', redFlags: [], greenFlags: [],
    }));
  }

  private async callWithCascade(prompt: string): Promise<string> {
    if (this.primary) { try { return await this.callLLM(this.primary, prompt); } catch (e) { console.warn(`[PitchLLM] Primary ${this.primary.provider} failed`, e); } }
    for (const fb of this.fallbacks) { try { return await this.callLLM(fb, prompt); } catch { /* continue */ } }
    throw new Error('All LLM providers failed');
  }

  private async callLLM(config: ProviderConfig, prompt: string): Promise<string> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      let url: string, headers: Record<string, string>, body: string;
      if (config.provider === 'gemini') {
        url = `${config.baseUrl}/${config.model}:generateContent?key=${config.apiKey}`;
        headers = { 'Content-Type': 'application/json' };
        body = JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { maxOutputTokens: 2500, temperature: 0.2 } });
      } else {
        url = config.baseUrl;
        headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${config.apiKey}` };
        body = JSON.stringify({ model: config.model, messages: [{ role: 'user', content: prompt }], max_tokens: 2500, temperature: 0.2 });
      }
      const response = await fetch(url, { method: 'POST', headers, body, signal: controller.signal });
      if (!response.ok) throw new Error(`LLM ${config.provider} error: ${response.status}`);
      const data: any = await response.json();
      if (config.provider === 'gemini') return data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
      return data?.choices?.[0]?.message?.content || '';
    } finally { clearTimeout(timeoutId); }
  }
}

/** Sanitize a string from LLM output */
function sanitizeString(val: unknown, maxLen: number): string {
  if (typeof val !== 'string') return '';
  return val.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, '').slice(0, maxLen);
}

function sanitizeStringArray(val: unknown, maxItems: number): string[] {
  if (!Array.isArray(val)) return [];
  return val.filter((i): i is string => typeof i === 'string').map(s => sanitizeString(s, 200)).slice(0, maxItems);
}

let singleton: PitchLLMService | null = null;
export function getPitchLLMService(): PitchLLMService { if (!singleton) singleton = new PitchLLMService(); return singleton; }
export function createPitchLLMService(): PitchLLMService { return new PitchLLMService(); }
