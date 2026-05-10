/**
 * Cohere Rerank Service
 *
 * Semantic reranking service using Cohere's Rerank API.
 * Improves quality of search and recommendation results by
 * reranking based on semantic relevance to user query/goals.
 *
 * @module infrastructure/external/rerank/CohereRerankService
 */

import {
  IRerankService,
  RerankDocument,
  RerankOptions,
  RerankResponse,
  RerankResult,
} from '../../../domain/services/IRerankService';
import { logger } from '../../../shared/logger';
import { config } from '../../../config';

/**
 * Cohere API response types
 */
interface CohereRerankResult {
  index: number;
  relevance_score: number;
}

interface CohereRerankResponse {
  id: string;
  results: CohereRerankResult[];
  meta?: {
    api_version: {
      version: string;
    };
    billed_units?: {
      search_units: number;
    };
  };
}

/**
 * Cohere Rerank Service Implementation
 *
 * Uses Cohere's Rerank API for semantic document reranking.
 * Supports multiple models and configurable options.
 */
export class CohereRerankService implements IRerankService {
  private apiKey: string | undefined;
  private baseUrl = 'https://api.cohere.ai/v1';
  private defaultModel = 'rerank-english-v3.0';

  constructor() {
    this.apiKey = config.ai.cohere.apiKey;

    if (this.apiKey) {
      logger.info('Cohere Rerank service configured');
    } else {
      logger.warn('Cohere Rerank service not configured - missing API key');
    }
  }

  /**
   * Check if Cohere service is available
   */
  async isAvailable(): Promise<boolean> {
    if (!this.apiKey) {
      return false;
    }

    try {
      // Test with a minimal rerank request
      const response = await fetch(`${this.baseUrl}/rerank`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.defaultModel,
          query: 'test',
          documents: ['test document'],
          top_n: 1,
        }),
      });

      return response.ok;
    } catch (error) {
      logger.error('Cohere availability check failed', { error });
      return false;
    }
  }

  /**
   * Rerank documents based on query relevance
   */
  async rerank(
    query: string,
    documents: RerankDocument[],
    options: RerankOptions = {}
  ): Promise<RerankResponse> {
    if (!this.apiKey) {
      throw new Error('Cohere Rerank service not configured');
    }

    if (documents.length === 0) {
      return {
        results: [],
        processingTimeMs: 0,
        model: options.model || this.defaultModel,
      };
    }

    const startTime = Date.now();

    try {
      // Extract text from documents for Cohere API
      const documentTexts = documents.map((doc) => doc.text);

      const requestBody: Record<string, unknown> = {
        model: options.model || this.defaultModel,
        query,
        documents: documentTexts,
        top_n: options.topN || documents.length,
        return_documents: false, // We already have the documents
      };

      if (options.maxTokens) {
        requestBody.max_chunks_per_doc = Math.ceil(options.maxTokens / 256);
      }

      const response = await fetch(`${this.baseUrl}/rerank`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      const processingTimeMs = Date.now() - startTime;

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({})) as { message?: string };
        throw new Error(
          errorData.message || `Cohere API error: ${response.status}`
        );
      }

      const result = await response.json() as CohereRerankResponse;

      // Transform Cohere results to our format
      const rerankResults = this.transformResults(
        result.results,
        documents,
        options.minScore
      );

      return {
        results: rerankResults,
        processingTimeMs,
        model: options.model || this.defaultModel,
        tokensUsed: result.meta?.billed_units?.search_units,
      };
    } catch (error) {
      logger.error('Cohere rerank failed', { error, query });
      throw error;
    }
  }

  /**
   * Transform Cohere results to our format
   */
  private transformResults(
    cohereResults: CohereRerankResult[],
    originalDocuments: RerankDocument[],
    minScore?: number
  ): RerankResult[] {
    return cohereResults
      .map((result) => ({
        id: originalDocuments[result.index].id,
        originalIndex: result.index,
        relevanceScore: result.relevance_score,
        document: originalDocuments[result.index],
      }))
      .filter((r) => !minScore || r.relevanceScore >= minScore)
      .sort((a, b) => b.relevanceScore - a.relevanceScore);
  }
}

/**
 * Contact-specific reranking helper
 *
 * Formats contact data for reranking based on user goals.
 */
export function formatContactForRerank(contact: {
  id: string;
  name: string;
  company?: string;
  jobTitle?: string;
  sectors?: string[];
  skills?: string[];
  interests?: string[];
  bio?: string;
}): RerankDocument {
  const parts: string[] = [];

  parts.push(`${contact.name}`);

  if (contact.jobTitle) {
    parts.push(`- ${contact.jobTitle}`);
  }

  if (contact.company) {
    parts.push(`at ${contact.company}`);
  }

  if (contact.sectors && contact.sectors.length > 0) {
    parts.push(`Sectors: ${contact.sectors.join(', ')}`);
  }

  if (contact.skills && contact.skills.length > 0) {
    parts.push(`Skills: ${contact.skills.join(', ')}`);
  }

  if (contact.interests && contact.interests.length > 0) {
    parts.push(`Interests: ${contact.interests.join(', ')}`);
  }

  if (contact.bio) {
    parts.push(contact.bio);
  }

  return {
    id: contact.id,
    text: parts.join('. '),
    metadata: {
      name: contact.name,
      company: contact.company,
      jobTitle: contact.jobTitle,
    },
  };
}

/**
 * Build rerank query from user goals
 */
export function buildRerankQuery(user: {
  goals?: string[];
  sectors?: string[];
  skills?: string[];
  interests?: string[];
}): string {
  const parts: string[] = [];

  if (user.goals && user.goals.length > 0) {
    parts.push(`Looking for: ${user.goals.join(', ')}`);
  }

  if (user.sectors && user.sectors.length > 0) {
    parts.push(`Working in: ${user.sectors.join(', ')}`);
  }

  if (user.skills && user.skills.length > 0) {
    parts.push(`With expertise in: ${user.skills.join(', ')}`);
  }

  if (user.interests && user.interests.length > 0) {
    parts.push(`Interested in: ${user.interests.join(', ')}`);
  }

  return parts.join('. ') || 'Professional networking connection';
}

/**
 * Expand short partnership-type codes into natural language phrases
 * so Cohere has rich semantic context (e.g. `technical_partner` ->
 * "technical co-founder, engineering lead, or hands-on technology partner").
 */
const LOOKING_FOR_EXPANSIONS: Record<string, string> = {
  cofounder:
    'co-founder who can commit equity-level time and share strategic ownership',
  investor:
    'investor, venture capitalist, angel, or financier able to fund the next stage',
  technical_partner:
    'technical co-founder, CTO, engineering lead, or hands-on technology partner who can build, integrate, or pilot the product',
  business_partner:
    'business co-founder, commercial lead, founder, or operator who can drive growth, partnerships, and go-to-market',
  strategic_partner:
    'strategic partner, advisor, founder, or executive who can open doors, support pilots, and align long-term partnerships',
  advisor:
    'advisor, mentor, board member, or experienced operator who can guide strategy and decisions',
  employee:
    'full-time hire or team member with relevant skills',
  contractor:
    'contractor, freelancer, or consultant for project-based work',
  customer:
    'pilot customer, design partner, or early adopter willing to evaluate the product',
  supplier:
    'supplier, vendor, or service provider in the relevant space',
};

export function expandLookingForCodes(codes: string[]): string[] {
  if (!Array.isArray(codes) || codes.length === 0) return [];
  return codes
    .map((c) => (typeof c === 'string' ? c.trim() : ''))
    .filter(Boolean)
    .map((c) => LOOKING_FOR_EXPANSIONS[c.toLowerCase()] || c);
}

/**
 * Project-specific rerank document formatter.
 *
 * Builds a richer, partnership-aware text representation than the contact
 * formatter — includes hobbies and role-authority signals (founder/CEO/CTO/etc.)
 * which are critical for ranking strategic / technical partner candidates.
 */
const SENIOR_ROLE_KEYWORDS = [
  'founder',
  'co-founder',
  'cofounder',
  'ceo',
  'cto',
  'coo',
  'cfo',
  'cmo',
  'chief',
  'owner',
  'partner',
  'managing director',
  'managing partner',
  'president',
  'vp',
  'vice president',
  'head of',
  'director',
  'principal',
];

function detectSeniorityTags(jobTitle?: string | null, bio?: string | null): string[] {
  const text = `${jobTitle || ''} ${bio || ''}`.toLowerCase();
  const tags: string[] = [];
  for (const kw of SENIOR_ROLE_KEYWORDS) {
    if (text.includes(kw)) {
      tags.push(kw);
      // First match is enough to mark "decision authority"
      break;
    }
  }
  if (tags.length > 0) {
    tags.push('decision-maker / partnership authority');
  }
  return tags;
}

export function formatProjectCandidateForRerank(candidate: {
  id: string;
  name: string;
  company?: string | null;
  jobTitle?: string | null;
  sectors?: string[];
  skills?: string[];
  interests?: string[];
  hobbies?: string[];
  bio?: string | null;
}): RerankDocument {
  const parts: string[] = [];

  parts.push(candidate.name);

  if (candidate.jobTitle) {
    parts.push(`- ${candidate.jobTitle}`);
  }

  if (candidate.company) {
    parts.push(`at ${candidate.company}`);
  }

  const seniorityTags = detectSeniorityTags(candidate.jobTitle, candidate.bio);
  if (seniorityTags.length > 0) {
    parts.push(`Role signals: ${seniorityTags.join(', ')}`);
  }

  if (candidate.sectors && candidate.sectors.length > 0) {
    parts.push(`Sectors: ${candidate.sectors.join(', ')}`);
  }

  if (candidate.skills && candidate.skills.length > 0) {
    parts.push(`Skills: ${candidate.skills.join(', ')}`);
  }

  if (candidate.interests && candidate.interests.length > 0) {
    parts.push(`Interests: ${candidate.interests.join(', ')}`);
  }

  if (candidate.hobbies && candidate.hobbies.length > 0) {
    parts.push(`Hobbies: ${candidate.hobbies.join(', ')}`);
  }

  if (candidate.bio) {
    parts.push(candidate.bio);
  }

  return {
    id: candidate.id,
    text: parts.join('. '),
    metadata: {
      name: candidate.name,
      company: candidate.company,
      jobTitle: candidate.jobTitle,
      seniorityTags,
    },
  };
}

/**
 * Build a rerank query for project matching.
 *
 * Expands lookingFor codes into natural language, includes project stage,
 * and a trimmed detailed description so Cohere can reason about partnership
 * intent (pilot vs. fundraise vs. hiring, etc.).
 */
/**
 * Job-specific rerank document formatter.
 *
 * The candidate document is built from fields that the JobMatchingService
 * already loads (CandidateProfile shape). The text leans on signals Cohere
 * is good at weighing semantically: title, role area, must-have/preferred
 * skills, industries, languages, education, and the freeform profile
 * summary. Hobbies/interests are intentionally excluded — for jobs they're
 * noise, not signal.
 */
export function formatJobCandidateForRerank(candidate: {
  id: string;
  title?: string | null;
  fullName?: string | null;
  roleArea?: string | null;
  seniority?: string | null;
  yearsOfExperience?: number | null;
  skills?: string[] | null;
  preferredSkills?: string[] | null;
  industries?: string[] | null;
  languages?: Array<{ language: string; proficiency?: string }> | null;
  education?: Array<{ degree?: string; field?: string; institution?: string }> | null;
  certifications?: string[] | null;
  desiredEmploymentType?: string[] | null;
  desiredWorkMode?: string[] | null;
  location?: string | null;
  profileSummary?: string | null;
  bio?: string | null;
}): RerankDocument {
  const parts: string[] = [];

  if (candidate.fullName) parts.push(candidate.fullName);
  if (candidate.title) parts.push(`- ${candidate.title}`);
  if (candidate.roleArea) parts.push(`Role area: ${candidate.roleArea}`);
  if (candidate.seniority) parts.push(`Seniority: ${candidate.seniority}`);
  if (typeof candidate.yearsOfExperience === 'number') {
    parts.push(`Experience: ${candidate.yearsOfExperience} years`);
  }
  if (candidate.skills && candidate.skills.length > 0) {
    parts.push(`Skills: ${candidate.skills.join(', ')}`);
  }
  if (candidate.industries && candidate.industries.length > 0) {
    parts.push(`Industries: ${candidate.industries.join(', ')}`);
  }
  if (candidate.languages && candidate.languages.length > 0) {
    const langs = candidate.languages
      .map((l) => (l.proficiency ? `${l.language} (${l.proficiency})` : l.language))
      .join(', ');
    parts.push(`Languages: ${langs}`);
  }
  if (candidate.education && candidate.education.length > 0) {
    const edu = candidate.education
      .map((e) =>
        [e.degree, e.field, e.institution].filter(Boolean).join(' '),
      )
      .filter(Boolean)
      .join('; ');
    if (edu) parts.push(`Education: ${edu}`);
  }
  if (candidate.certifications && candidate.certifications.length > 0) {
    parts.push(`Certifications: ${candidate.certifications.join(', ')}`);
  }
  if (candidate.desiredEmploymentType && candidate.desiredEmploymentType.length > 0) {
    parts.push(`Open to: ${candidate.desiredEmploymentType.join(', ')}`);
  }
  if (candidate.desiredWorkMode && candidate.desiredWorkMode.length > 0) {
    parts.push(`Work mode preference: ${candidate.desiredWorkMode.join(', ')}`);
  }
  if (candidate.location) parts.push(`Location: ${candidate.location}`);
  const summary = candidate.profileSummary || candidate.bio;
  if (summary) parts.push(summary);

  return {
    id: candidate.id,
    text: parts.join('. '),
    metadata: {
      title: candidate.title,
      roleArea: candidate.roleArea,
      seniority: candidate.seniority,
    },
  };
}

/**
 * Build a Cohere rerank query for a hiring profile / job posting.
 *
 * Includes the structured asks (must-have skills, role area, seniority,
 * employment type, work mode) and the freeform requirements text so Cohere
 * can weigh both keyword overlap and semantic similarity against candidate
 * documents formatted by `formatJobCandidateForRerank`.
 */
export function buildJobRerankQuery(job: {
  title: string;
  roleArea?: string | null;
  seniority?: string | null;
  employmentType?: string | null;
  workMode?: string | null;
  minimumYearsExperience?: number | null;
  mustHaveSkills?: string[] | null;
  preferredSkills?: string[] | null;
  industries?: string[] | null;
  requiredLanguages?: Array<{ language: string; proficiency?: string }> | null;
  location?: string | null;
  jobSummaryRequirements?: string | null;
  summary?: string | null;
}): string {
  const parts: string[] = [];

  parts.push(`Hiring for: ${job.title}`);
  if (job.roleArea) parts.push(`Role area: ${job.roleArea}`);
  if (job.seniority) parts.push(`Seniority required: ${job.seniority}`);
  if (job.employmentType) parts.push(`Employment type: ${job.employmentType}`);
  if (job.workMode) parts.push(`Work mode: ${job.workMode}`);
  if (typeof job.minimumYearsExperience === 'number') {
    parts.push(`Minimum experience: ${job.minimumYearsExperience} years`);
  }
  if (job.mustHaveSkills && job.mustHaveSkills.length > 0) {
    parts.push(`Must-have skills: ${job.mustHaveSkills.join(', ')}`);
  }
  if (job.preferredSkills && job.preferredSkills.length > 0) {
    parts.push(`Preferred skills: ${job.preferredSkills.join(', ')}`);
  }
  if (job.industries && job.industries.length > 0) {
    parts.push(`Industries: ${job.industries.join(', ')}`);
  }
  if (job.requiredLanguages && job.requiredLanguages.length > 0) {
    const langs = job.requiredLanguages
      .map((l) => (l.proficiency ? `${l.language} (${l.proficiency})` : l.language))
      .join(', ');
    parts.push(`Required languages: ${langs}`);
  }
  if (job.location) parts.push(`Location: ${job.location}`);

  const requirements = job.jobSummaryRequirements || job.summary;
  if (requirements) {
    const trimmed = requirements.length > 1500 ? `${requirements.slice(0, 1500)}...` : requirements;
    parts.push(`Requirements: ${trimmed}`);
  }

  parts.push(
    'Rank candidates by alignment with the role, evidenced experience, skill match, and partnership/hiring readiness.',
  );

  return parts.join('\n');
}

export function buildProjectRerankQuery(project: {
  title: string;
  summary?: string | null;
  detailedDesc?: string | null;
  stage?: string | null;
  category?: string | null;
  lookingFor?: string[];
  sectors?: string[];
  skills?: string[];
  keywords?: string[];
}): string {
  const parts: string[] = [];

  parts.push(`Project: ${project.title}`);

  if (project.summary) {
    parts.push(`Summary: ${project.summary}`);
  }

  if (project.detailedDesc) {
    const trimmed = project.detailedDesc.length > 1500
      ? `${project.detailedDesc.slice(0, 1500)}...`
      : project.detailedDesc;
    parts.push(`Details: ${trimmed}`);
  }

  if (project.stage) {
    parts.push(`Stage: ${project.stage}`);
  }

  if (project.category) {
    parts.push(`Category: ${project.category}`);
  }

  const expanded = expandLookingForCodes(project.lookingFor || []);
  if (expanded.length > 0) {
    parts.push(`Looking for: ${expanded.join('; ')}`);
  } else {
    parts.push('Looking for: collaborators');
  }

  if (project.sectors && project.sectors.length > 0) {
    parts.push(`Sectors: ${project.sectors.join(', ')}`);
  }

  if (project.skills && project.skills.length > 0) {
    parts.push(`Skills needed: ${project.skills.join(', ')}`);
  }

  if (project.keywords && project.keywords.length > 0) {
    parts.push(`Keywords: ${project.keywords.join(', ')}`);
  }

  parts.push(
    'Rank candidates by how well their experience, role authority, sector fit, and partnership readiness match this project.'
  );

  return parts.join('\n');
}
