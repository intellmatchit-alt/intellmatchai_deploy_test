declare const process: { env: Record<string, string | undefined> };

/**
 * IntellMatch Job Matching Engine — LLM Service
 *
 * AI-powered validation and upload extraction.
 * Provider cascade: Groq → Gemini → OpenAI.
 * Safe fallback: AI failure → score 0, not 50.
 *
 * @module job-matching/job-llm.service
 */

import {
  LLMProvider,
  HiringProfile,
  CandidateProfile,
  JobAIValidationItem,
  JobAIValidationRequest,
  ExtractedHiringFields,
  ExtractedCandidateFields,
  Seniority,
  WorkMode,
  EmploymentType,
  HiringUrgency,
  Availability,
} from './job-matching.types';

import { AI_MAX_SCORE_ADJUSTMENT } from './matching-bands.constants';

// ============================================================================
// PROVIDER CONFIG
// ============================================================================

interface ProviderConfig {
  provider: LLMProvider;
  apiKey: string;
  model: string;
  baseUrl: string;
}

const TIMEOUT_MS = 30_000;

// ============================================================================
// SERVICE
// ============================================================================

export class JobLLMService {
  private primary: ProviderConfig | null = null;
  private fallbacks: ProviderConfig[] = [];

  constructor() {
    this.initProviders();
  }

  private initProviders(): void {
    const candidates: Array<{ provider: LLMProvider; envKey: string; model: string; baseUrl: string }> = [
      { provider: 'groq', envKey: 'GROQ_API_KEY', model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile', baseUrl: 'https://api.groq.com/openai/v1/chat/completions' },
      { provider: 'gemini', envKey: 'GEMINI_API_KEY', model: process.env.GEMINI_MODEL || 'gemini-1.5-flash', baseUrl: 'https://generativelanguage.googleapis.com/v1beta/models' },
      { provider: 'openai', envKey: 'OPENAI_API_KEY', model: process.env.OPENAI_MODEL || 'gpt-4o-mini', baseUrl: 'https://api.openai.com/v1/chat/completions' },
    ];

    for (const c of candidates) {
      const key = process.env[c.envKey];
      if (key) {
        const cfg: ProviderConfig = { provider: c.provider, apiKey: key, model: c.model, baseUrl: c.baseUrl };
        if (!this.primary) this.primary = cfg;
        else this.fallbacks.push(cfg);
      }
    }
  }

  isAvailable(): boolean { return this.primary !== null; }

  // ==========================================================================
  // AI VALIDATION
  // ==========================================================================

  async validateMatches(request: JobAIValidationRequest): Promise<JobAIValidationItem[]> {
    if (!this.primary) return this.fallbackValidations(request.candidates.length, request.candidates);

    const prompt = this.buildValidationPrompt(request);
    try {
      const raw = await this.callWithCascade(prompt);
      return this.parseValidation(raw, request.deterministicScores, request.candidates);
    } catch (e) {
      console.error('[JobLLM] Validation failed', e);
      return this.fallbackValidations(request.candidates.length, request.candidates);
    }
  }

  private buildValidationPrompt(req: JobAIValidationRequest): string {
    const job = req.job;
    const candidateSummaries = req.candidates.map((c, i) => {
      const langSummary = (c.languages && c.languages.length > 0) ? ` | Languages: ${c.languages.map(l => `${l.language}(${l.proficiency})`).slice(0, 3).join(', ')}` : '';
      const certSummary = (c.certifications && c.certifications.length > 0) ? ` | Certifications: ${c.certifications.slice(0, 3).join(', ')}` : '';
      const relevantExperienceSummary = c.relevantExperience && c.relevantExperience.length > 0
        ? ` | Relevant Experience: ${c.relevantExperience.slice(0, 3).map((entry) => `${entry.roleFamily}:${entry.years}y`).join(', ')}`
        : '';
      const educationSummary = c.education && c.education.length > 0
        ? ` | Education: ${c.education.slice(0, 2).map((entry) => entry.degree).join(', ')}`
        : '';
      return `${i}. [${c.id}] ${c.title} — ${c.roleArea} (${c.seniority}) | Skills: ${c.skills.slice(0, 8).join(', ')}${langSummary}${certSummary}${relevantExperienceSummary}${educationSummary} | Score: ${req.deterministicScores[i]}`;
    }).join('\n');

    // Present the job requirements clearly, including must-have and preferred skills and other constraints
    const mustSkills = job.mustHaveSkills && job.mustHaveSkills.length > 0 ? job.mustHaveSkills.join(', ') : 'none';
    const prefSkills = job.preferredSkills && job.preferredSkills.length > 0 ? job.preferredSkills.join(', ') : 'none';
    const jobLangs = job.requiredLanguages && job.requiredLanguages.length > 0 ? job.requiredLanguages.map(l => `${l.language}(${l.proficiency})`).join(', ') : 'none';
    const jobCerts = job.requiredCertifications && job.requiredCertifications.length > 0 ? job.requiredCertifications.join(', ') : 'none';
    const jobEdu = job.requiredEducationLevels && job.requiredEducationLevels.length > 0 ? job.requiredEducationLevels.join(', ') : 'none';
    const jobDomains = job.industries && job.industries.length > 0 ? job.industries.join(', ') : 'none';
    const jobSalary = job.salaryRange ? `${job.salaryRange.min ?? 'NA'}–${job.salaryRange.max ?? 'NA'} ${job.salaryRange.currency}` : 'not specified';

    return `You are evaluating candidate-job matches for the IntellMatch platform.

JOB:
- Title: ${job.title}
- Role/Area: ${job.roleArea}
- Seniority: ${job.seniority}
- Must-have Skills: ${mustSkills}
- Preferred Skills: ${prefSkills}
- Required Languages: ${jobLangs}
- Required Certifications: ${jobCerts}
- Required Education Levels: ${jobEdu}
- Industries/Domains: ${jobDomains}
- Work Mode: ${job.workMode}
- Employment Type: ${job.employmentType}
- Minimum Experience: ${job.minimumYearsExperience ?? 'not specified'}
- Salary Range: ${jobSalary}

CANDIDATES:
${candidateSummaries}

RULES:
- Adjust scores by at most ±${AI_MAX_SCORE_ADJUSTMENT} points.
- Focus on RELEVANT experience, not total career years.
- Executive/founder experience does NOT count for IC roles unless directly relevant.
- Do not override hard filter failures (e.g. missing must-have skills, language, certification, education, or strong salary mismatch).
- Borderline profiles may be nudged slightly upward only when the evidence clearly supports relevant experience and strong semantic fit.
- Penalize role inflation and title mismatch for candidates coming from founder/executive profiles into individual contributor roles unless their recent relevant experience clearly matches.
- Be conservative when uncertain and favour under-adjustment.

Respond ONLY with valid JSON:
{
  "validations": [
    {
      "index": 0,
      "candidateId": "<use the exact candidate id shown in brackets>",
      "originalScore": 75,
      "adjustedScore": 78,
      "confidence": 0.8,
      "reasoning": "...",
      "redFlags": [],
      "greenFlags": []
    }
  ]
}`;
  }

  private parseValidation(raw: string, origScores: number[], candidates: CandidateProfile[]): JobAIValidationItem[] {
    try {
      const json = raw.match(/\{[\s\S]*\}/)?.[0];
      if (!json) return this.fallbackValidations(candidates.length, candidates);
      const parsed = JSON.parse(json);
      const items: JobAIValidationItem[] = [];
      for (const v of parsed.validations || []) {
        const idx = typeof v.index === 'number' ? v.index : -1;
        if (idx < 0 || idx >= candidates.length) continue;
        const orig = origScores[idx] || 0;
        let adj = typeof v.adjustedScore === 'number' ? v.adjustedScore : orig;
        const diff = adj - orig;
        if (Math.abs(diff) > AI_MAX_SCORE_ADJUSTMENT) {
          adj = orig + (diff > 0 ? AI_MAX_SCORE_ADJUSTMENT : -AI_MAX_SCORE_ADJUSTMENT);
        }
        items.push({
          candidateId: candidates[idx].id,
          originalScore: orig,
          adjustedScore: Math.max(0, Math.min(100, Math.round(adj))),
          confidence: typeof v.confidence === 'number' ? Math.max(0, Math.min(1, v.confidence)) : 0.5,
          reasoning: typeof v.reasoning === 'string' ? v.reasoning.slice(0, 500) : '',
          redFlags: Array.isArray(v.redFlags) ? v.redFlags.filter((f: any) => typeof f === 'string').slice(0, 5) : [],
          greenFlags: Array.isArray(v.greenFlags) ? v.greenFlags.filter((f: any) => typeof f === 'string').slice(0, 5) : [],
        });
      }
      return items;
    } catch {
      return this.fallbackValidations(candidates.length, candidates);
    }
  }

  private fallbackValidations(count: number, candidates: CandidateProfile[] = []): JobAIValidationItem[] {
    return Array.from({ length: count }, (_, i) => ({
      candidateId: candidates[i]?.id || '',
      originalScore: 0,
      adjustedScore: 0,
      confidence: 0,
      reasoning: 'AI validation unavailable',
      redFlags: [],
      greenFlags: [],
    }));
  }

  // ==========================================================================
  // UPLOAD EXTRACTION — Job (Hiring)
  // ==========================================================================

  async extractHiringFields(text: string): Promise<ExtractedHiringFields> {
    if (!this.primary) return {};

    const prompt = `Extract structured job posting fields from the following text. Map to EXACTLY these fields:

    - title (string, the job title)
    - roleArea (string, role family: Software Engineering, Product, Sales, Marketing, Operations, etc.)
    - seniority (enum: INTERN, JUNIOR, MID, SENIOR, LEAD, MANAGER, DIRECTOR, VP, C_LEVEL, FOUNDER)
    - location (string, primary location)
    - workMode (enum: ONSITE, HYBRID, REMOTE)
    - employmentType (enum: FULL_TIME, PART_TIME, CONTRACT, FREELANCE, INTERNSHIP)
    - mustHaveSkills (array of strings for mandatory skills)
    - preferredSkills (array of strings for nice-to-have skills)
    - jobSummaryRequirements (string summary of responsibilities and requirements)
    - minimumYearsExperience (number or null)
    - hiringUrgency (enum: LOW, NORMAL, URGENT, CRITICAL or null)
    - industries (array of strings for primary domains or sectors)
    - requiredLanguages (array of objects with fields: language (string), proficiency (BASIC, CONVERSATIONAL, FLUENT, NATIVE))
    - requiredCertifications (array of strings for mandatory certifications)
    - requiredEducationLevels (array of strings for degree levels, e.g. Bachelor, Master)
    - salaryRange (object with min (number or null), max (number or null), currency (string) or null)
    - suggestedTags (array of strings for relevant tags)

    TEXT:
    ${text.slice(0, 8000)}

    Respond with ONLY valid JSON matching the above fields. Use null for fields you cannot determine.`;

    try {
      const raw = await this.callWithCascade(prompt);
      return this.parseExtracted(raw) as ExtractedHiringFields;
    } catch {
      return {};
    }
  }

  // ==========================================================================
  // UPLOAD EXTRACTION — Candidate (Open to Opportunities)
  // ==========================================================================

  async extractCandidateFields(text: string): Promise<ExtractedCandidateFields> {
    if (!this.primary) return {};

    const prompt = `Extract structured candidate/resume fields from the following text. Map to EXACTLY these fields:

    - title (string, candidate headline or desired role)
    - roleArea (string, role family: Software Engineering, Product, Sales, Marketing, Operations, etc.)
    - seniority (enum: INTERN, JUNIOR, MID, SENIOR, LEAD, MANAGER, DIRECTOR, VP, C_LEVEL, FOUNDER)
    - location (string, primary location)
    - desiredWorkMode (string array of: ONSITE, HYBRID, REMOTE)
    - desiredEmploymentType (string array of: FULL_TIME, PART_TIME, CONTRACT, FREELANCE, INTERNSHIP)
    - skills (string array)
    - profileSummaryPreferences (string summary of background, experience, strengths, and preferences)
    - yearsOfExperience (number, total years)
    - availability (enum: IMMEDIATELY, WITHIN_2_WEEKS, WITHIN_1_MONTH, WITHIN_3_MONTHS, NOT_ACTIVELY_LOOKING or null)
    - relevantExperience (array of { roleFamily: string, domain?: string, skills: string[], years: number })
    - languages (array of { language: string, proficiency: BASIC | CONVERSATIONAL | FLUENT | NATIVE } )
    - certifications (array of strings for professional certifications or licenses)
    - industries (array of strings for domains or sectors)
    - education (array of { degree: string, field: string, institution?: string, year?: number })
    - expectedSalary (object with min (number or null), max (number or null), currency (string) or null)
    - noticePeriod (number of weeks before starting a new role or null)
    - suggestedTags (string array)

    TEXT:
    ${text.slice(0, 8000)}

    Respond with ONLY valid JSON matching the above fields. Use null for fields you cannot determine. For relevantExperience, break down the candidate's career into segments by role family.`;

    try {
      const raw = await this.callWithCascade(prompt);
      return this.parseExtracted(raw) as ExtractedCandidateFields;
    } catch {
      return {};
    }
  }

  private parseExtracted(raw: string): Record<string, any> {
    try {
      const json = raw.match(/\{[\s\S]*\}/)?.[0];
      if (!json) return {};
      const parsed = JSON.parse(json) as Record<string, any>;
      return this.deepClean(parsed);
    } catch {
      return {};
    }
  }

  private deepClean(value: unknown): any {
    if (Array.isArray(value)) {
      return value
        .map((item) => this.deepClean(item))
        .filter((item) => item !== null && item !== undefined && item !== '');
    }

    if (value && typeof value === 'object') {
      const cleaned: Record<string, any> = {};
      for (const [key, inner] of Object.entries(value as Record<string, unknown>)) {
        const sanitized = this.deepClean(inner);
        if (sanitized !== null && sanitized !== undefined && sanitized !== '') {
          cleaned[key] = sanitized;
        }
      }
      return cleaned;
    }

    if (typeof value === 'string') {
      return value.trim();
    }

    return value;
  }

  // ==========================================================================
  // LLM CALL WITH CASCADE
  // ==========================================================================

  private async callWithCascade(prompt: string): Promise<string> {
    if (this.primary) {
      try {
        return await this.callLLM(this.primary, prompt);
      } catch (e) {
        console.warn(`[JobLLM] Primary ${this.primary.provider} failed`, e);
      }
    }
    for (const fb of this.fallbacks) {
      try {
        return await this.callLLM(fb, prompt);
      } catch {
        continue;
      }
    }
    throw new Error('All LLM providers failed');
  }

  private async callLLM(cfg: ProviderConfig, prompt: string): Promise<string> {
    const ctrl = new AbortController();
    const tid = setTimeout(() => ctrl.abort(), TIMEOUT_MS);

    try {
      let url: string, headers: Record<string, string>, body: string;

      if (cfg.provider === 'gemini') {
        url = `${cfg.baseUrl}/${cfg.model}:generateContent?key=${cfg.apiKey}`;
        headers = { 'Content-Type': 'application/json' };
        body = JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { maxOutputTokens: 2000 } });
      } else {
        url = cfg.baseUrl;
        headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.apiKey}` };
        body = JSON.stringify({ model: cfg.model, messages: [{ role: 'user', content: prompt }], max_tokens: 2000, temperature: 0.3 });
      }

      const res = await fetch(url, { method: 'POST', headers, body, signal: ctrl.signal });
      if (!res.ok) throw new Error(`LLM ${cfg.provider} error: ${res.status}`);
      const data = await res.json();

      if (cfg.provider === 'gemini') {
        return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      }
      return data.choices?.[0]?.message?.content || '';
    } finally {
      clearTimeout(tid);
    }
  }
}

// ============================================================================
// SINGLETON
// ============================================================================

let _instance: JobLLMService | null = null;
export function getJobLLMService(): JobLLMService {
  if (!_instance) _instance = new JobLLMService();
  return _instance;
}
export function createJobLLMService(): JobLLMService {
  return new JobLLMService();
}
