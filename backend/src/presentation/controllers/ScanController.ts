/**
 * Scan Controller
 *
 * Handles HTTP requests for business card scanning endpoints.
 * Combines OCR extraction with real web search for complete contact data.
 *
 * Features:
 * - Redis caching for consistent results
 * - Multiple search providers (OpenAI + Google Custom Search)
 * - Improved search queries
 *
 * @module presentation/controllers/ScanController
 */

import { Request, Response, NextFunction } from 'express';
import { ScanCardUseCase } from '../../application/use-cases/scan/ScanCardUseCase';
import { CreateContactFromScanUseCase } from '../../application/use-cases/scan/CreateContactFromScanUseCase';
import { getOCRService } from '../../infrastructure/external/ocr/index';
import { PrismaContactRepository } from '../../infrastructure/repositories/PrismaContactRepository';
import { StorageServiceFactory } from '../../infrastructure/external/storage/StorageServiceFactory';
import { AuthenticationError } from '../../shared/errors/index';
import { InsufficientPointsError } from '../../shared/errors/InsufficientPointsError';
import { logger } from '../../shared/logger/index';
import { walletService } from '../../infrastructure/services/WalletService';
import { systemConfigService } from '../../infrastructure/services/SystemConfigService';
import { randomUUID, createHash } from 'crypto';
import { config } from '../../config/index';

/**
 * ScrapIn Enrichment Response Types
 */
interface ScrapInEnrichmentResult {
  experience?: Array<{
    company?: string;
    title?: string;
    startDate?: string;
    endDate?: string;
    isCurrent?: boolean;
    description?: string;
  }>;
  education?: Array<{
    school?: string;
    degree?: string;
    field?: string;
    startYear?: number;
    endYear?: number;
  }>;
  pictureUrl?: string;
  iceBreakers?: string[];
  employmentVerification?: {
    status: 'CURRENT' | 'CHANGED' | 'UNKNOWN' | 'UNVERIFIED';
    cardData?: { company?: string; jobTitle?: string };
    verifiedData?: { company?: string; jobTitle?: string; source: string };
    changeDetails?: {
      previousCompany?: string;
      newCompany?: string;
      previousTitle?: string;
      newTitle?: string;
      changeDetectedVia: string;
    };
    confidence: { overall: number; level: 'HIGH' | 'MEDIUM' | 'LOW'; reasons: string[] };
  };
  warnings?: string[];
}
import Redis from 'ioredis';

// Initialize services and repositories (using factory for OCR)
const ocrService = getOCRService();
const contactRepository = new PrismaContactRepository();

// Initialize Redis for caching
let redis: Redis | null = null;
try {
  redis = new Redis(config.redis.url, { maxRetriesPerRequest: 1 });
  redis.on('error', () => { redis = null; });
} catch {
  logger.warn('Redis not available for search caching');
}

// Cache TTL: 24 hours
const CACHE_TTL = 3600; // 1 hour cache for search results (reduced from 24h for fresher data)

// Initialize use cases
const scanCardUseCase = new ScanCardUseCase(ocrService);
const createContactFromScanUseCase = new CreateContactFromScanUseCase(contactRepository);

/**
 * AI Search Result type
 */
interface AISearchResult {
  bio?: string;           // Short summary (2-3 sentences)
  bioFull?: string;       // Full detailed bio (5-8 sentences with career highlights)
  skills: string[];
  sectors: string[];
  interests: string[];
  linkedInUrl?: string;
  location?: string;
  sources: string[];
  confidence: 'high' | 'medium' | 'low';
}

/**
 * GPT-extracted fields from OCR text
 */
interface GPTExtractedFields {
  name?: string;
  title?: string;
  firstName?: string;
  middleName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  company?: string;
  jobTitle?: string;
  website?: string;
  linkedInUrl?: string;
  location?: string;
}

/**
 * Scan Controller
 *
 * Provides HTTP handlers for business card scanning operations.
 */
export class ScanController {
  /**
   * Generate cache key for search results
   */
  private getCacheKey(name: string, company?: string): string {
    const input = `${name.toLowerCase().trim()}|${(company || '').toLowerCase().trim()}`;
    return `scan:search:${createHash('md5').update(input).digest('hex')}`;
  }

  /**
   * Get cached search result
   */
  private async getCachedResult(cacheKey: string): Promise<AISearchResult | null> {
    if (!redis) return null;
    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        logger.info('Search cache hit', { cacheKey });
        return JSON.parse(cached);
      }
    } catch (error) {
      logger.warn('Cache read error', { error });
    }
    return null;
  }

  /**
   * Cache search result
   */
  private async cacheResult(cacheKey: string, result: AISearchResult): Promise<void> {
    if (!redis) return;
    try {
      await redis.setex(cacheKey, CACHE_TTL, JSON.stringify(result));
      logger.info('Search result cached', { cacheKey, ttl: CACHE_TTL });
    } catch (error) {
      logger.warn('Cache write error', { error });
    }
  }

  /**
   * Enrich profile with ScrapIn for experience, education, and employment verification
   */
  private async enrichWithScrapIn(
    linkedInUrl: string | undefined,
    cardCompany?: string,
    cardJobTitle?: string
  ): Promise<ScrapInEnrichmentResult | null> {
    const scrapInApiKey = process.env.SCRAPIN_API_KEY;
    if (!scrapInApiKey || !linkedInUrl) {
      return null;
    }

    try {
      logger.info('Enriching with ScrapIn', { linkedInUrl });

      const apiUrl = `https://api.scrapin.io/v1/enrichment/profile?apikey=${scrapInApiKey}`;
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          linkedInUrl,
          includes: {
            includeCompany: true,
            includeSummary: true,
            includeSkills: true,
            includeExperience: true,
            includeEducation: true,
          },
          cacheDuration: '7d',
        }),
      });

      const data = await response.json() as {
        success: boolean;
        msg?: string;
        credits_left?: number;
        metadata?: { source?: string };
        person?: any;
        company?: any;
      };

      if (!data.success || !data.person) {
        logger.warn('ScrapIn returned no data', { msg: data.msg });
        return null;
      }

      logger.info('ScrapIn enrichment successful', {
        creditsLeft: data.credits_left,
        cacheSource: data.metadata?.source,
      });

      const person = data.person;
      const positionHistory = person.positions?.positionHistory || [];
      const currentPosition = positionHistory[0];

      // Extract experience
      const experience = positionHistory.map((pos: any) => {
        let startDate: string | undefined;
        let endDate: string | undefined;
        if (pos.startEndDate?.start) {
          const s = pos.startEndDate.start;
          startDate = s.year ? (s.month ? `${s.year}-${String(s.month).padStart(2, '0')}` : String(s.year)) : undefined;
        }
        if (pos.startEndDate?.end) {
          const e = pos.startEndDate.end;
          endDate = e.year ? (e.month ? `${e.year}-${String(e.month).padStart(2, '0')}` : String(e.year)) : undefined;
        }
        return {
          company: pos.companyName,
          title: pos.title,
          startDate,
          endDate,
          isCurrent: !pos.startEndDate?.end,
          description: pos.description,
        };
      });

      // Extract education
      const education = person.schools?.educationHistory?.map((edu: any) => ({
        school: edu.schoolName,
        degree: edu.degreeName,
        field: edu.fieldOfStudy,
        startYear: edu.startEndDate?.start?.year,
        endYear: edu.startEndDate?.end?.year,
      })) || [];

      // Employment verification
      const linkedInCompany = currentPosition?.companyName || data.company?.name;
      const linkedInTitle = currentPosition?.title || person.headline;

      let employmentVerification: ScrapInEnrichmentResult['employmentVerification'];
      const warnings: string[] = [];

      // Normalize company names for comparison
      const normalizeCompany = (c?: string) => c?.toLowerCase().replace(/\s*(inc\.?|llc\.?|ltd\.?|corp\.?|co\.?)\s*$/i, '').trim() || '';
      const cardCompanyNorm = normalizeCompany(cardCompany);
      const linkedInCompanyNorm = normalizeCompany(linkedInCompany);

      const companiesMatch = cardCompanyNorm === linkedInCompanyNorm ||
        cardCompanyNorm.includes(linkedInCompanyNorm) ||
        linkedInCompanyNorm.includes(cardCompanyNorm);

      if (cardCompany && linkedInCompany && !companiesMatch) {
        // Employment change detected!
        employmentVerification = {
          status: 'CHANGED',
          cardData: { company: cardCompany, jobTitle: cardJobTitle },
          verifiedData: { company: linkedInCompany, jobTitle: linkedInTitle, source: 'scrapin' },
          changeDetails: {
            previousCompany: cardCompany,
            newCompany: linkedInCompany,
            previousTitle: cardJobTitle,
            newTitle: linkedInTitle,
            changeDetectedVia: 'scrapin',
          },
          confidence: { overall: 85, level: 'HIGH', reasons: ['LinkedIn profile verified via ScrapIn'] },
        };
        warnings.push(`EMPLOYMENT CHANGED: No longer at ${cardCompany}. Now at ${linkedInCompany} as ${linkedInTitle}.`);
      } else if (linkedInCompany) {
        employmentVerification = {
          status: 'CURRENT',
          cardData: cardCompany ? { company: cardCompany, jobTitle: cardJobTitle } : undefined,
          verifiedData: { company: linkedInCompany, jobTitle: linkedInTitle, source: 'scrapin' },
          confidence: { overall: 90, level: 'HIGH', reasons: ['Employment confirmed via LinkedIn'] },
        };
      } else {
        employmentVerification = {
          status: 'UNKNOWN',
          cardData: { company: cardCompany, jobTitle: cardJobTitle },
          confidence: { overall: 50, level: 'MEDIUM', reasons: ['Could not verify current employment'] },
        };
      }

      // Generate ice breakers
      const firstName = person.firstName || 'there';
      const iceBreakers = [];
      if (linkedInCompany) {
        iceBreakers.push(`Hi ${firstName}! I've been following ${linkedInCompany}'s work - would love to learn more about what your team is focused on.`);
      }
      if (person.skills?.length > 0) {
        iceBreakers.push(`Hi ${firstName}! I noticed your expertise in ${person.skills[0]} - I'm curious about how you've applied this in your current work.`);
      }
      if (linkedInTitle) {
        iceBreakers.push(`Hi ${firstName}! Your role as ${linkedInTitle} sounds fascinating - what's been the most exciting project you've worked on recently?`);
      }
      if (employmentVerification.status === 'CHANGED') {
        iceBreakers.unshift(`Hi ${firstName}! Congratulations on joining ${linkedInCompany}! I'd love to hear about what drew you to this new role.`);
      }

      return {
        experience,
        education,
        pictureUrl: person.photoUrl,
        iceBreakers: iceBreakers.slice(0, 5),
        employmentVerification,
        warnings: warnings.length > 0 ? warnings : undefined,
      };
    } catch (error) {
      logger.error('ScrapIn enrichment failed', { error });
      return null;
    }
  }

  /**
   * Extract business card fields using GPT
   * This is much smarter than regex - handles bullet points, OCR errors, etc.
   */
  private async extractFieldsWithGPT(rawText: string): Promise<GPTExtractedFields | null> {
    const openaiKey = config.ai?.openai?.apiKey;
    if (!openaiKey) {
      logger.warn('OpenAI not configured for GPT field extraction');
      return null;
    }

    const prompt = `You are an expert at reading business cards. Extract contact information from this OCR text.

OCR TEXT FROM BUSINESS CARD:
"""
${rawText}
"""

IMPORTANT INSTRUCTIONS:
1. The OCR may have errors - bullet points (●) are often misread as letters like "d", "o", "9", "0", "c", "a"
2. If you see patterns like "dcto@" or "9cto@" or "octo@", the first character is likely a bullet point - the email is probably "cto@..."
3. If a phone number starts with "900" followed by a country code (like 900962...), the leading "9" is likely a bullet point
4. Common country codes: 962 (Jordan), 971 (UAE), 966 (Saudi Arabia), 20 (Egypt)
5. Phone numbers starting with "00" are international format (e.g., 00962 = +962)
6. Extract the ACTUAL information, fixing OCR errors intelligently
7. For Arabic names, keep them in their original script if present, otherwise use the English transliteration

LINKEDIN URL EXTRACTION (CRITICAL):
- Look for ANY text containing "linkedin" or similar OCR variations
- Common OCR mistakes: "linkedln" (l instead of i), "l1nked1n" (1 instead of i), "Linkedin" (capital L)
- Look for patterns like: linkedin.com/in/username, www.linkedin.com/in/username, ae.linkedin.com/in/username
- The URL might be split across lines or have extra characters - extract just the valid URL
- If you see text like "linkedln.com/ln/username", fix it to "linkedin.com/in/username"
- Output format should be: https://linkedin.com/in/username (clean, without country subdomains)
- Also look for company pages: linkedin.com/company/companyname
- IMPORTANT: If there's ANY LinkedIn-related text on the card, extract and fix it!

RESPOND WITH ONLY A JSON OBJECT - NO OTHER TEXT:
{
  "name": "Full name of the person (complete name as shown)",
  "title": "Title/honorific like Mr., Mrs., Ms., Dr., Prof., Eng., Sheikh, Sir, etc. (null if not present)",
  "firstName": "First/given name only",
  "middleName": "Middle name if present (null if not)",
  "lastName": "Last/family name",
  "email": "email@domain.com (cleaned, without bullet artifacts)",
  "phone": "Phone number in international format like +962 79 XXX XXXX",
  "company": "Company name",
  "jobTitle": "Job title/position",
  "website": "Website URL (without bullet artifacts)",
  "linkedInUrl": "LinkedIn profile URL in format https://linkedin.com/in/username - MUST extract if ANY linkedin text is present, fix OCR errors",
  "location": "City, Country if mentioned"
}

IMPORTANT FOR NAMES:
- "name" should be the COMPLETE full name as shown on the card
- Parse the name into parts: title, firstName, middleName, lastName
- Common titles: Mr., Mrs., Ms., Miss, Dr., Prof., Eng., Sheikh, Sir, Madam, Capt., Rev.
- For Arabic names, the structure is usually: [Title] FirstName MiddleName FamilyName
- If unsure about middle name, put remaining parts in lastName

Use null for any field you cannot determine. Be smart about fixing OCR errors!`;

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${openaiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: 'You are a business card OCR expert. Always respond with valid JSON only.' },
            { role: 'user', content: prompt }
          ],
          temperature: 0.1,
          max_tokens: 500,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error('GPT field extraction API error', { status: response.status, error: errorText });
        return null;
      }

      const data = await response.json() as {
        choices?: Array<{ message?: { content?: string } }>;
      };

      const content = data.choices?.[0]?.message?.content;
      if (!content) {
        logger.warn('GPT returned empty content for field extraction');
        return null;
      }

      // Parse JSON from response (handle markdown code blocks)
      let jsonStr = content.trim();
      if (jsonStr.startsWith('```json')) {
        jsonStr = jsonStr.slice(7);
      }
      if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.slice(3);
      }
      if (jsonStr.endsWith('```')) {
        jsonStr = jsonStr.slice(0, -3);
      }
      jsonStr = jsonStr.trim();

      const extracted = JSON.parse(jsonStr) as GPTExtractedFields;
      logger.info('GPT field extraction successful', {
        hasName: !!extracted.name,
        hasEmail: !!extracted.email,
        hasPhone: !!extracted.phone,
        hasLinkedIn: !!extracted.linkedInUrl,
        linkedInUrl: extracted.linkedInUrl || 'not found',
      });

      return extracted;
    } catch (error) {
      logger.error('GPT field extraction failed', { error });
      return null;
    }
  }

  /**
   * Build improved search queries for better results
   * Priority: LinkedIn > Wikipedia > Company site > Other
   */
  private buildSearchQueries(data: { name: string; company?: string; jobTitle?: string; email?: string }): string[] {
    const queries: string[] = [];
    const name = data.name.trim();

    // Query 1: PRIORITY - LinkedIn profile search with exact name
    queries.push(`"${name}" site:linkedin.com/in/`);

    // Query 2: LinkedIn with company context (helps find the right person)
    if (data.company) {
      queries.push(`"${name}" "${data.company}" site:linkedin.com`);
    }

    // Query 3: Wikipedia search (authoritative source for well-known people)
    queries.push(`"${name}" site:wikipedia.org`);

    // Query 4: LinkedIn profile with job title context
    if (data.jobTitle) {
      queries.push(`"${name}" "${data.jobTitle}" LinkedIn profile`);
    }

    // Query 5: Company website search (if available from email domain)
    if (data.email) {
      const domain = data.email.split('@')[1];
      if (domain && !domain.includes('gmail') && !domain.includes('yahoo') && !domain.includes('hotmail') && !domain.includes('outlook')) {
        queries.push(`"${name}" site:${domain}`);
      }
    }

    // Query 6: General professional search with company
    if (data.company) {
      queries.push(`"${name}" "${data.company}" CEO OR founder OR director OR manager`);
    }

    // Query 7: News and recent mentions
    queries.push(`"${name}" ${data.company || ''} news OR interview OR announcement`.trim());

    return queries;
  }

  /**
   * Search using Google Custom Search API
   */
  private async searchWithGoogle(queries: string[]): Promise<{ snippets: string[]; urls: string[] }> {
    const apiKey = config.ai?.googleCse?.apiKey;
    const cx = config.ai?.googleCse?.cx;

    if (!apiKey || !cx) {
      logger.debug('Google CSE not configured');
      return { snippets: [], urls: [] };
    }

    const snippets: string[] = [];
    const urls: string[] = [];

    try {
      // Google CSE response type
      interface GoogleCSEItem {
        title?: string;
        link?: string;
        snippet?: string;
      }
      interface GoogleCSEResponse {
        items?: GoogleCSEItem[];
      }

      // Run first 5 queries in parallel for better coverage
      const searchPromises = queries.slice(0, 5).map(async (query): Promise<GoogleCSEResponse> => {
        const url = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${cx}&q=${encodeURIComponent(query)}&num=10`;
        const response = await fetch(url);
        if (!response.ok) {
          logger.warn('Google CSE request failed', { status: response.status, query });
          return { items: [] };
        }
        return response.json() as Promise<GoogleCSEResponse>;
      });

      const results = await Promise.all(searchPromises);

      // Prioritize LinkedIn and Wikipedia URLs
      const linkedInUrls: string[] = [];
      const wikipediaUrls: string[] = [];
      const otherUrls: string[] = [];

      for (const result of results) {
        if (result.items && Array.isArray(result.items)) {
          for (const item of result.items) {
            if (item.snippet) snippets.push(item.snippet);
            if (item.link) {
              if (item.link.includes('linkedin.com/in/')) {
                linkedInUrls.push(item.link);
              } else if (item.link.includes('wikipedia.org')) {
                wikipediaUrls.push(item.link);
              } else {
                otherUrls.push(item.link);
              }
            }
          }
        }
      }

      // Combine URLs with priority: LinkedIn first, then Wikipedia, then others
      urls.push(...linkedInUrls, ...wikipediaUrls, ...otherUrls);

      logger.info('Google CSE search completed', {
        queriesRun: Math.min(queries.length, 5),
        snippetsFound: snippets.length,
        urlsFound: urls.length,
        linkedInFound: linkedInUrls.length,
        wikipediaFound: wikipediaUrls.length,
        snippetPreviews: snippets.slice(0, 2).map(s => s.substring(0, 100)),
        urlList: urls.slice(0, 5)
      });
    } catch (error) {
      logger.error('Google CSE error', { error });
    }

    return { snippets, urls };
  }

  /**
   * Analyze Google search results using GPT to extract comprehensive profile data
   * Uses advanced prompt engineering to extract maximum information
   */
  private async analyzeGoogleResults(
    data: {
      name: string;
      company?: string;
      jobTitle?: string;
      email?: string;
      website?: string;
      location?: string;
    },
    googleSnippets: string[],
    googleUrls: string[],
    linkedInUrl?: string
  ): Promise<AISearchResult | null> {
    const openaiKey = config.ai?.openai?.apiKey;
    if (!openaiKey) return null;

    const cleanCompany = data.company?.replace(/\n/g, ' ').trim();
    const cleanTitle = data.jobTitle?.trim();
    const cleanLocation = data.location?.trim();

    // Find LinkedIn URL from Google results if not provided
    const detectedLinkedIn = linkedInUrl || googleUrls.find(u => u.includes('linkedin.com/in/'));

    // Extract domain from email for company research
    const emailDomain = data.email?.split('@')[1];
    const websiteDomain = data.website?.replace(/^(https?:\/\/)?(www\.)?/, '').split('/')[0];

    const prompt = `You are an elite professional researcher and profile creator. Your task is to create an IMPRESSIVE, COMPREHENSIVE profile that will make the user say "Wow, how did it know all this about me!"

=== BUSINESS CARD DATA ===
Full Name: ${data.name}
${cleanTitle ? `Job Title: ${cleanTitle}` : ''}
${cleanCompany ? `Company: ${cleanCompany}` : ''}
${cleanLocation ? `Location: ${cleanLocation}` : ''}
${data.email ? `Email: ${data.email}` : ''}
${data.website ? `Website: ${data.website}` : ''}
${detectedLinkedIn ? `LinkedIn Found: ${detectedLinkedIn}` : ''}

=== GOOGLE SEARCH RESULTS ===
${googleSnippets.length > 0 ? googleSnippets.slice(0, 8).map((s, i) => `${i + 1}. ${s}`).join('\n') : 'No search results available'}

=== URLS FOUND ===
${googleUrls.slice(0, 6).join('\n')}

=== YOUR TASK ===
Create a RICH, DETAILED profile. PRIORITIZE data from LinkedIn and Wikipedia if available in the search results.

1. **BIO (SHORT SUMMARY)**: Write 2-3 compelling sentences as a quick overview.
   - Current role and company
   - Key expertise area
   ${cleanLocation ? `- Mention ${cleanLocation}` : ''}

2. **BIO FULL (DETAILED)**: Write 6-10 sentences with comprehensive details:
   - PRIORITY: Use LinkedIn about/summary section if found in search results
   - Current role, responsibilities, and what they do day-to-day
   - Career journey and progression (previous notable roles if found)
   - Key achievements, awards, or recognition
   - Educational background if found
   - Areas of expertise and specialization
   - What their company "${cleanCompany || 'their company'}" does
   - Notable projects or contributions
   - Speaking engagements, publications, or thought leadership
   ${cleanLocation ? `- Mention they are based in ${cleanLocation}` : ''}

   IMPORTANT BIO RULES:
   - Do NOT include any URLs or citations in the bio (no "[source](url)" or "(website.com)")
   - Do NOT mention employee counts or company size (no "leads a team of X employees")
   - Do NOT include markdown links or references
   - Write it as a clean, professional narrative that flows well
   - Make it sound impressive and professional, like a LinkedIn "About" section

3. **SECTORS**: What industries does "${cleanCompany || 'their company'}" operate in?
   - Look at company name keywords (tech, solutions, consulting, etc.)
   - Consider the job title context
   - Be specific (not just "Business" - use "Technology", "IT Services", "Software Development", etc.)

4. **SKILLS**: Extract skills for ${cleanTitle || 'professional'} at ${cleanCompany || 'this company'}
   - PRIORITY: Use skills listed in LinkedIn profile if found
   - Leadership/Management skills
   - Technical/Domain skills
   - Soft skills
   - Industry-specific skills

5. **INTERESTS**: What professional topics would they follow?
   - Industry trends
   - Technologies
   - Business topics
   - Think: What conferences would they attend?

6. **LINKEDIN**: Extract the EXACT LinkedIn profile URL if found in the URLs above.
   Look for URLs containing "linkedin.com/in/" - that's their personal profile.

7. **LOCATION**: ${cleanLocation ? `Confirm: ${cleanLocation}` : 'Extract from search results or infer from company/email domain'}

=== RESPOND WITH THIS JSON ONLY ===
{
  "bio": "2-3 sentence summary. Quick overview of role, company, and expertise.",
  "bioFull": "6-10 sentence detailed bio. Include: career journey, achievements, education, expertise areas, what the company does, notable work. Make it impressive and comprehensive. ${cleanLocation ? `Mention ${cleanLocation}.` : ''} NO URLs, NO citations, NO employee counts.",
  "sectors": ["4-5 specific industry sectors - be precise, not generic"],
  "skills": ["8-10 impressive, relevant skills - mix of leadership, technical, and soft skills"],
  "interests": ["5-6 professional interests and topics they'd follow"],
  "linkedInUrl": "${detectedLinkedIn || 'Extract from URLs above or null'}",
  "location": "${cleanLocation || 'Extract from data or null'}"
}

IMPORTANT:
- bioFull should be MUCH more detailed than bio - include career history, achievements, education
- Both bios MUST BE CLEAN: No URLs, no citations like ([source](url)), no employee counts like "leads X employees"
- Skills should be SPECIFIC to their role (${cleanTitle || 'professional'})
- Sectors should match what "${cleanCompany || 'their company'}" actually does
- If company has "Tech/Solutions/Digital" → include Technology, IT Services, Software
- If title has "CEO/Founder" → include Strategic Leadership, Business Development, Vision
- If title has "CTO/Engineer" → include Technical Architecture, Engineering, Innovation`;

    try {
      const startTime = Date.now();
      logger.info('Analyzing Google results with GPT', { name: data.name, snippetsCount: googleSnippets.length });

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${openaiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: 'You are an elite professional researcher who creates impressive, detailed profiles. You analyze business cards and search results to build comprehensive professional profiles that make users say "Wow, how did it know all this about me!" Always respond with valid JSON only. Be specific, detailed, and impressive.' },
            { role: 'user', content: prompt }
          ],
          temperature: 0.4,
          max_tokens: 1800,
        }),
      });

      if (!response.ok) {
        logger.warn('Google results analysis API error', { status: response.status });
        return null;
      }

      const result = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
      const content = result.choices?.[0]?.message?.content;

      if (!content) {
        logger.warn('No content from Google results analysis');
        return null;
      }

      // Parse JSON
      let jsonStr = content.trim();
      if (jsonStr.startsWith('```json')) jsonStr = jsonStr.slice(7);
      if (jsonStr.startsWith('```')) jsonStr = jsonStr.slice(3);
      if (jsonStr.endsWith('```')) jsonStr = jsonStr.slice(0, -3);

      const parsed = JSON.parse(jsonStr.trim());
      const elapsed = Date.now() - startTime;

      // Helper function to clean bio text
      const cleanBioText = (text: string): string => {
        let cleaned = text || '';
        // Remove markdown links like [text](url)
        cleaned = cleaned.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1');
        // Remove parenthetical citations like (website.com) or (source)
        cleaned = cleaned.replace(/\s*\([^)]*\.(com|co|org|net|io)[^)]*\)/gi, '');
        // Remove "leads a team of X employees" variations
        cleaned = cleaned.replace(/\s*(He|She|They)\s+leads?\s+a\s+team\s+of\s+[\d–-]+\s*(employees?|people|staff)?\.?/gi, '');
        // Remove standalone URLs
        cleaned = cleaned.replace(/https?:\/\/[^\s)]+/g, '');
        // Clean up extra spaces
        cleaned = cleaned.replace(/\s+/g, ' ').trim();
        return cleaned;
      };

      // Clean both bio and bioFull
      const cleanBio = cleanBioText(parsed.bio);
      const cleanBioFull = cleanBioText(parsed.bioFull);

      // Extract LinkedIn URL - prefer parsed, then detected, then from URLs
      let finalLinkedIn = parsed.linkedInUrl && parsed.linkedInUrl !== 'null' && parsed.linkedInUrl.includes('linkedin.com/in/')
        ? parsed.linkedInUrl
        : detectedLinkedIn;

      // Extract location - prefer parsed, then from input data
      const finalLocation = parsed.location && parsed.location !== 'null'
        ? parsed.location
        : cleanLocation;

      logger.info('Google results analysis completed', {
        name: data.name,
        bio: !!parsed.bio,
        bioLength: parsed.bio?.length || 0,
        bioFullLength: parsed.bioFull?.length || 0,
        sectors: parsed.sectors?.length || 0,
        skills: parsed.skills?.length || 0,
        interests: parsed.interests?.length || 0,
        linkedInUrl: !!finalLinkedIn,
        location: finalLocation || 'not found',
        timeMs: elapsed,
      });

      return {
        bio: cleanBio || undefined,
        bioFull: cleanBioFull || undefined,
        skills: Array.isArray(parsed.skills) ? parsed.skills.slice(0, 10) : [],
        sectors: Array.isArray(parsed.sectors) ? parsed.sectors.slice(0, 5) : [],
        interests: Array.isArray(parsed.interests) ? parsed.interests.slice(0, 6) : [],
        linkedInUrl: finalLinkedIn,
        location: finalLocation,
        sources: googleUrls.slice(0, 5),
        confidence: finalLinkedIn ? 'high' : googleSnippets.length >= 3 ? 'high' : 'medium',
      };
    } catch (error) {
      logger.error('Google results analysis error', { error });
      return null;
    }
  }

  /**
   * Search using OpenAI GPT-4o with web_search tool
   * Performs deep research about the person from their business card
   */
  private async searchWithOpenAI(data: { name: string; company?: string; jobTitle?: string }, googleContext: string): Promise<AISearchResult | null> {
    const openaiKey = config.ai?.openai?.apiKey;
    if (!openaiKey) return null;

    // Clean company name (remove newlines)
    const cleanCompany = data.company?.replace(/\n/g, ' ').trim();
    const cleanTitle = data.jobTitle?.trim();

    const prompt = `You are an expert professional researcher with web search capability. Your task is to find REAL, CURRENT information about this person.

PERSON FROM BUSINESS CARD:
- Full Name: ${data.name}
${cleanCompany ? `- Company: ${cleanCompany}` : ''}
${cleanTitle ? `- Job Title: ${cleanTitle}` : ''}

${googleContext ? `PRELIMINARY SEARCH CONTEXT:\n${googleContext}\n` : ''}

=== MANDATORY SEARCH SEQUENCE (DO ALL IN ORDER) ===

**STEP 1 - LINKEDIN (CRITICAL - PRIMARY SOURCE):**
Search: "${data.name}" site:linkedin.com/in/
${cleanCompany ? `Also search: "${data.name}" "${cleanCompany}" LinkedIn profile` : ''}
- MUST find their exact LinkedIn URL (linkedin.com/in/username)
- Extract: headline, current company, about/summary section
- Extract: ALL skills listed on their LinkedIn
- Extract: work experience, education
- LinkedIn is the MOST IMPORTANT source - use it for bio and skills

**STEP 2 - WIKIPEDIA (SECONDARY SOURCE):**
Search: "${data.name}" site:wikipedia.org
- Check if they have a Wikipedia page (important/notable people)
- Extract: biography, career highlights, achievements
- Use Wikipedia data to enrich the bio

**STEP 3 - COMPANY WEBSITE:**
${cleanCompany ? `Search: "${data.name}" site:${cleanCompany.toLowerCase().replace(/[^a-z0-9]/g, '')}.com OR "${data.name}" "${cleanCompany}" team` : 'Skip'}
- Find their bio on company "About" or "Team" page
- Understand what the company does (for sectors)

**STEP 4 - NEWS & ACHIEVEMENTS:**
Search: "${data.name}" ${cleanCompany || ''} interview OR news OR award OR speaker
- Find recent news, interviews, awards
- Speaking engagements, publications, achievements

=== RESPONSE FORMAT ===
Return ONLY this JSON:
{
  "bio": "2-3 sentence summary. Quick overview of their current role and key expertise.",
  "bioFull": "6-10 sentence DETAILED bio using REAL facts from LinkedIn/Wikipedia. Include: current role at ${cleanCompany || 'their company'}, career journey and previous notable positions, achievements and awards, educational background, areas of expertise and specialization, what the company does, notable projects or contributions, speaking engagements or thought leadership. Make it comprehensive and impressive. NO URLs, NO citations, NO employee counts.",
  "sectors": ["4-5 SPECIFIC industry sectors based on ${cleanCompany || 'their company'}'s actual business - NOT generic like 'Business'"],
  "skills": ["8-12 skills from LinkedIn if found, otherwise based on their ${cleanTitle || 'role'}. Include: leadership, technical, industry-specific skills"],
  "interests": ["5-6 professional interests based on their work, LinkedIn interests, or speaking topics"],
  "linkedInUrl": "EXACT LinkedIn URL (linkedin.com/in/username) - THIS IS REQUIRED if found",
  "location": "City, Country from LinkedIn or card data",
  "sources": ["All URLs where you found real information"]
}

=== STRICT RULES ===
1. LinkedIn URL is CRITICAL - you MUST find it if it exists
2. bioFull must be DETAILED and COMPREHENSIVE - include career history, achievements, education
3. bio is just a short summary, bioFull should be much longer with more details
4. Skills should be from LinkedIn "Skills" section if found
5. Sectors must match what ${cleanCompany || 'their company'} actually does
6. NO fabricated information - only use what you actually find
7. Both bios MUST be clean: no URLs, no citations like [source], no markdown links
8. If you find Wikipedia, USE that authoritative information
9. Current data matters - prefer recent information (2024-2025)

RESPOND WITH ONLY THE JSON:`;

    try {
      const startTime = Date.now();
      logger.info('Calling OpenAI GPT-4o with web search', { name: data.name });

      const response = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${openaiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          tools: [{ type: 'web_search' }],
          input: prompt,
        }),
      });

      const responseText = await response.text();
      logger.info('OpenAI raw response status', { status: response.status, length: responseText.length });

      if (!response.ok) {
        logger.error('OpenAI web search API error', { status: response.status, error: responseText.substring(0, 500) });
        return null;
      }

      const result = JSON.parse(responseText);
      logger.info('OpenAI response structure', {
        hasOutput: !!result.output,
        outputLength: result.output?.length,
        keys: Object.keys(result)
      });

      // Extract content from OpenAI Responses API format
      let content = '';
      if (result.output && Array.isArray(result.output)) {
        for (const item of result.output) {
          if (item.type === 'message' && item.content) {
            for (const block of item.content) {
              if ((block.type === 'output_text' || block.type === 'text') && block.text) {
                content = block.text;
                break;
              }
            }
          }
        }
      }

      if (!content) {
        logger.warn('No content extracted from OpenAI response');
        return null;
      }

      logger.info('OpenAI content extracted', { contentLength: content.length, preview: content.substring(0, 300) });

      // Parse JSON from response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        logger.warn('No JSON found in OpenAI response content');
        return null;
      }

      const parsed = JSON.parse(jsonMatch[0]);
      const elapsed = Date.now() - startTime;
      const sources = Array.isArray(parsed.sources) ? parsed.sources.filter((s: string) => s?.startsWith('http')) : [];

      // Helper function to clean bio text
      const cleanBioText = (text: string): string => {
        let cleaned = text || '';
        // Remove markdown links like [text](url)
        cleaned = cleaned.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1');
        // Remove parenthetical citations like (website.com) or (clutch.co)
        cleaned = cleaned.replace(/\s*\([^)]*\.(com|co|org|net|io)[^)]*\)/gi, '');
        // Remove "leads a team of X employees" variations
        cleaned = cleaned.replace(/\s*(He|She|They)\s+leads?\s+a\s+team\s+of\s+[\d–-]+\s*(employees?|people|staff)?\.?/gi, '');
        // Remove standalone URLs
        cleaned = cleaned.replace(/https?:\/\/[^\s)]+/g, '');
        // Clean up extra spaces
        cleaned = cleaned.replace(/\s+/g, ' ').trim();
        return cleaned;
      };

      // Clean both bio and bioFull
      const cleanBio = cleanBioText(parsed.bio);
      const cleanBioFull = cleanBioText(parsed.bioFull);

      logger.info('OpenAI web search completed', {
        name: data.name,
        bio: !!cleanBio,
        bioFullLength: cleanBioFull?.length || 0,
        sectors: parsed.sectors?.length || 0,
        skills: parsed.skills?.length || 0,
        interests: parsed.interests?.length || 0,
        sources: sources.length,
        timeMs: elapsed,
      });

      return {
        bio: cleanBio || undefined,
        bioFull: cleanBioFull || undefined,
        skills: Array.isArray(parsed.skills) ? parsed.skills.slice(0, 8) : [],
        sectors: Array.isArray(parsed.sectors) ? parsed.sectors.slice(0, 5) : [],
        interests: Array.isArray(parsed.interests) ? parsed.interests.slice(0, 5) : [],
        linkedInUrl: parsed.linkedInUrl || undefined,
        sources,
        confidence: sources.length >= 2 ? 'high' : sources.length >= 1 ? 'medium' : 'low',
      };
    } catch (error) {
      logger.error('OpenAI web search error', { error });
      return null;
    }
  }

  /**
   * Combined web search using multiple providers with caching
   */
  private async performAIAnalysis(data: {
    name: string;
    company?: string;
    jobTitle?: string;
    email?: string;
    website?: string;
    location?: string;
  }): Promise<AISearchResult | null> {
    if (!data.name) {
      logger.warn('No name provided for AI analysis');
      return null;
    }

    const startTime = Date.now();

    // Check cache first
    const cacheKey = this.getCacheKey(data.name, data.company);
    const cached = await this.getCachedResult(cacheKey);
    if (cached) {
      return cached;
    }

    logger.info('Starting combined search', { name: data.name, company: data.company });

    // Step 1: Build improved search queries
    const queries = this.buildSearchQueries(data);
    logger.info('Search queries built', { queries });

    // Step 2: Search Google Custom Search (fast, provides context)
    const googleResults = await this.searchWithGoogle(queries);

    // Build context from Google results for OpenAI
    const googleContext = googleResults.snippets.length > 0
      ? `Google search results:\n${googleResults.snippets.slice(0, 5).join('\n')}`
      : '';

    // Step 3: Search with OpenAI GPT-4o (uses Google context for better results)
    const openaiResult = await this.searchWithOpenAI(data, googleContext);

    // Check if OpenAI returned useful data
    const openaiHasData = openaiResult && (
      openaiResult.bio ||
      openaiResult.skills.length > 0 ||
      openaiResult.sectors.length > 0 ||
      openaiResult.linkedInUrl
    );

    logger.info('Search results analysis', {
      openaiHasData,
      googleSnippets: googleResults.snippets.length,
      googleUrls: googleResults.urls.length
    });

    // Merge results
    let finalResult: AISearchResult | null = null;

    // Collect all sources from Google
    const allSources = new Set<string>();
    for (const url of googleResults.urls.slice(0, 5)) {
      allSources.add(url);
    }

    // Find LinkedIn URL from Google results
    const googleLinkedIn = googleResults.urls.find(u => u.includes('linkedin.com/in/'));

    if (openaiHasData && openaiResult) {
      // OpenAI found useful data - use it and merge with Google sources
      for (const src of openaiResult.sources) {
        allSources.add(src);
      }

      // Always include location from input data if not in OpenAI result
      const finalLinkedIn = openaiResult.linkedInUrl || googleLinkedIn;
      const finalLocation = openaiResult.location || data.location;

      finalResult = {
        ...openaiResult,
        linkedInUrl: finalLinkedIn,
        location: finalLocation,
        sources: Array.from(allSources),
        confidence: finalLinkedIn ? 'high' : allSources.size >= 3 ? 'high' : 'medium',
      };

      logger.info('Using OpenAI web_search results', {
        hasBio: !!openaiResult.bio,
        sectors: openaiResult.sectors.length,
        skills: openaiResult.skills.length,
        linkedInUrl: finalLinkedIn,
        location: finalLocation,
      });
    } else {
      // OpenAI web_search didn't return useful data
      // Try analyzing Google results directly with GPT before falling back to keyword inference
      logger.info('OpenAI web_search returned limited results, trying Google results analysis');

      const googleAnalysis = await this.analyzeGoogleResults(
        data,
        googleResults.snippets,
        googleResults.urls,
        googleLinkedIn
      );

      if (googleAnalysis && (googleAnalysis.bio || googleAnalysis.sectors.length > 0 || googleAnalysis.skills.length > 0)) {
        logger.info('Google results analysis successful', {
          hasBio: !!googleAnalysis.bio,
          sectors: googleAnalysis.sectors.length,
          skills: googleAnalysis.skills.length,
        });

        // Use Google analysis result
        finalResult = {
          ...googleAnalysis,
          sources: Array.from(allSources),
        };
      } else {
        // Final fallback: Generate profile from card data using keyword inference
        logger.info('Using keyword-based profile (all AI analysis returned limited results)');

        // Clean the data
        const cleanCompany = data.company?.replace(/\n/g, ' ').trim();
        const cleanTitle = data.jobTitle?.trim();

        // Generate bio from card data (no snippet appending to avoid pollution)
        let bio = `${data.name}`;
        if (cleanTitle && cleanCompany) {
          bio = `${data.name} serves as ${cleanTitle} at ${cleanCompany}.`;
        } else if (cleanTitle) {
          bio = `${data.name} is a ${cleanTitle} professional.`;
        } else if (cleanCompany) {
          bio = `${data.name} works at ${cleanCompany}.`;
        }

      // Infer sectors from company name and job title - more comprehensive
      const detectedSectors: string[] = [];
      const searchText = `${cleanCompany || ''} ${cleanTitle || ''}`.toLowerCase();

      const sectorInferences: Record<string, string[]> = {
        'Technology': ['tech', 'software', 'digital', 'it ', 'it-', 'cyber', 'data', 'cloud', 'ai', 'app', 'solutions', 'systems', 'computing', 'developer', 'engineering'],
        'IT Services': ['solutions', 'consulting', 'services', 'systems', 'integration'],
        'Media & Entertainment': ['studio', 'media', 'entertainment', 'film', 'video', 'production', 'broadcast', 'creative', 'content'],
        'Finance & Banking': ['bank', 'finance', 'financial', 'investment', 'capital', 'fund', 'trading', 'insurance', 'fintech'],
        'Healthcare': ['health', 'medical', 'pharma', 'hospital', 'clinic', 'biotech', 'care'],
        'Real Estate': ['real estate', 'property', 'realty', 'development', 'construction', 'building'],
        'Consulting': ['consult', 'advisory', 'strategy', 'management consulting'],
        'E-commerce': ['ecommerce', 'e-commerce', 'online', 'marketplace', 'retail'],
        'Manufacturing': ['manufactur', 'industrial', 'factory', 'production'],
        'Education': ['education', 'school', 'university', 'academy', 'training', 'learning'],
        'Telecommunications': ['telecom', 'mobile', 'network', 'communications'],
        'Energy': ['energy', 'oil', 'gas', 'power', 'renewable', 'solar'],
        'Logistics': ['logistics', 'shipping', 'transport', 'supply chain', 'delivery'],
      };

      for (const [sector, keywords] of Object.entries(sectorInferences)) {
        if (keywords.some(kw => searchText.includes(kw))) {
          detectedSectors.push(sector);
        }
      }

      // Infer skills from job title - more comprehensive and role-specific
      const detectedSkills: string[] = [];
      const titleLower = (cleanTitle || '').toLowerCase();
      const companyLower = (cleanCompany || '').toLowerCase();

      // C-suite skills - expanded
      if (/\b(ceo|chief executive|founder|co-founder)\b/i.test(titleLower)) {
        detectedSkills.push('Executive Leadership', 'Strategic Vision', 'Business Development', 'Stakeholder Management', 'Corporate Strategy', 'Team Building');
      }
      if (/\b(coo|chief operating)\b/i.test(titleLower)) {
        detectedSkills.push('Operations Management', 'Process Optimization', 'Team Leadership', 'Operational Strategy', 'Performance Management', 'Efficiency Improvement');
      }
      if (/\b(cfo|chief financial)\b/i.test(titleLower)) {
        detectedSkills.push('Financial Management', 'Strategic Planning', 'Risk Management', 'Financial Analysis', 'Budgeting', 'Investment Strategy');
      }
      if (/\b(cto|chief technology|technical director)\b/i.test(titleLower)) {
        detectedSkills.push('Technology Strategy', 'Software Architecture', 'Technical Leadership', 'Innovation Management', 'System Design', 'Engineering Management');
      }
      if (/\b(cio|chief information)\b/i.test(titleLower)) {
        detectedSkills.push('IT Strategy', 'Digital Transformation', 'Information Security', 'Enterprise Architecture', 'IT Governance');
      }
      if (/\b(cmo|chief marketing)\b/i.test(titleLower)) {
        detectedSkills.push('Marketing Strategy', 'Brand Management', 'Digital Marketing', 'Market Analysis', 'Growth Strategy', 'Customer Acquisition');
      }

      // Tech-specific roles
      if (/\b(developer|engineer|programmer)\b/i.test(titleLower)) {
        detectedSkills.push('Software Development', 'Problem Solving', 'Code Review', 'Technical Documentation');
        if (companyLower.includes('tech') || companyLower.includes('software') || companyLower.includes('solutions')) {
          detectedSkills.push('Agile Development', 'System Integration');
        }
      }
      if (/\b(architect)\b/i.test(titleLower)) {
        detectedSkills.push('System Architecture', 'Technical Design', 'Solution Design', 'Technology Evaluation');
      }
      if (/\b(devops|sre|infrastructure)\b/i.test(titleLower)) {
        detectedSkills.push('DevOps', 'CI/CD', 'Cloud Infrastructure', 'Automation', 'Monitoring');
      }
      if (/\b(data|analytics|scientist)\b/i.test(titleLower)) {
        detectedSkills.push('Data Analysis', 'Machine Learning', 'Statistical Analysis', 'Data Visualization');
      }

      // Management roles
      if (/\b(director|head|vp|vice president)\b/i.test(titleLower)) {
        detectedSkills.push('Leadership', 'Team Management', 'Strategic Planning', 'Budget Management');
      }
      if (/\b(manager|lead|supervisor)\b/i.test(titleLower)) {
        detectedSkills.push('Project Management', 'Team Coordination', 'Performance Reviews', 'Resource Planning');
      }

      // Sales & Business
      if (/\b(sales|account|business development|bd)\b/i.test(titleLower)) {
        detectedSkills.push('Sales Strategy', 'Client Relations', 'Negotiation', 'Business Development', 'Pipeline Management');
      }

      // Marketing
      if (/\b(marketing|brand|growth|digital)\b/i.test(titleLower)) {
        detectedSkills.push('Marketing', 'Brand Strategy', 'Campaign Management', 'Analytics', 'Content Strategy');
      }

      // HR/People
      if (/\b(hr|human resources|people|talent)\b/i.test(titleLower)) {
        detectedSkills.push('Talent Acquisition', 'Employee Relations', 'Performance Management', 'HR Strategy');
      }

      // Product
      if (/\b(product)\b/i.test(titleLower)) {
        detectedSkills.push('Product Management', 'Product Strategy', 'User Research', 'Roadmap Planning', 'Stakeholder Management');
      }

      // Design
      if (/\b(design|ux|ui|creative)\b/i.test(titleLower)) {
        detectedSkills.push('Design Thinking', 'User Experience', 'Visual Design', 'Prototyping');
      }

      // Add industry-specific skills based on company type
      if (companyLower.includes('tech') || companyLower.includes('software') || companyLower.includes('solutions')) {
        if (!detectedSkills.includes('Technology')) detectedSkills.push('Technology Solutions');
        if (!detectedSkills.includes('Digital Transformation')) detectedSkills.push('Digital Transformation');
      }

      // Default skills if none detected
      if (detectedSkills.length === 0) {
        detectedSkills.push('Professional Expertise', 'Communication', 'Collaboration');
      }

      // Remove duplicates and limit
      const uniqueSkills = [...new Set(detectedSkills)];

      // Remove duplicates from sectors
      const uniqueSectors = [...new Set(detectedSectors)];

      finalResult = {
        bio,
        skills: uniqueSkills.slice(0, 8),
        sectors: uniqueSectors.length > 0 ? uniqueSectors.slice(0, 4) : ['Business Services'],
        interests: [],
        linkedInUrl: googleLinkedIn,
        sources: Array.from(allSources),
        confidence: allSources.size >= 1 ? 'medium' : 'low',
      };
      }
    }

    // Cache the result
    if (finalResult) {
      await this.cacheResult(cacheKey, finalResult);
    }

    const elapsed = Date.now() - startTime;
    logger.info('Combined search completed', {
      name: data.name,
      hasResult: !!finalResult,
      totalTimeMs: elapsed
    });

    return finalResult;
  }

  /**
   * Scan a business card image
   *
   * POST /api/v1/scan/card
   *
   * Performs OCR extraction AND fast AI analysis in one call.
   * Returns combined data: OCR fields + AI-suggested sectors/skills
   *
   * Body:
   * - imageData: base64 encoded image
   * - mimeType: image MIME type
   */
  async scanCard(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AuthenticationError('Authentication required');
      }

      // Deduct points for scan
      const scanCost = await systemConfigService.getNumber('scan_cost', 5);
      try {
        await walletService.debit(req.user.userId, scanCost, 'Business card scan', null, 'SCAN');
      } catch (error) {
        if (error instanceof InsufficientPointsError) {
          res.status(402).json({
            success: false,
            error: { code: 'INSUFFICIENT_POINTS', message: error.message, details: error.details },
          });
          return;
        }
        throw error;
      }

      // Support both multipart file upload and base64 JSON body
      let imageData: string;
      let mimeType: string;

      if (req.file) {
        // Multipart upload: convert buffer to base64
        imageData = req.file.buffer.toString('base64');
        mimeType = req.file.mimetype;
      } else {
        // JSON body with base64 imageData
        imageData = req.body.imageData;
        mimeType = req.body.mimeType;
      }

      const startTime = Date.now();

      // Step 1: OCR extraction
      const ocrResult = await scanCardUseCase.execute(req.user.userId, {
        imageData,
        mimeType,
      });

      const ocrTime = Date.now() - startTime;

      // Step 2: GPT-based field extraction (smarter than regex)
      let finalFields = ocrResult.fields;
      let gptExtracted = false;

      if (ocrResult.rawText && ocrResult.rawText.length > 10) {
        try {
          const gptFields = await this.extractFieldsWithGPT(ocrResult.rawText);
          if (gptFields) {
            // Use GPT fields, falling back to OCR fields if GPT returns null
            finalFields = {
              name: gptFields.name || ocrResult.fields.name,
              title: gptFields.title || undefined,
              firstName: gptFields.firstName || undefined,
              middleName: gptFields.middleName || undefined,
              lastName: gptFields.lastName || undefined,
              email: gptFields.email || ocrResult.fields.email,
              phone: gptFields.phone || ocrResult.fields.phone,
              company: gptFields.company || ocrResult.fields.company,
              jobTitle: gptFields.jobTitle || ocrResult.fields.jobTitle,
              website: gptFields.website || ocrResult.fields.website,
              linkedInUrl: gptFields.linkedInUrl || ocrResult.fields.linkedInUrl,
              location: gptFields.location || ocrResult.fields.location,
            };
            gptExtracted = true;
            logger.info('Using GPT-extracted fields', { gptFields });
          }
        } catch (gptError) {
          logger.warn('GPT extraction failed, using OCR fields', { error: gptError });
        }
      }

      const gptTime = Date.now() - startTime - ocrTime;

      // Step 3: AI analysis for sectors/skills
      let aiData: {
        bio?: string;
        bioFull?: string;
        skills: string[];
        sectors: string[];
        interests: string[];
        linkedInUrl?: string;
        location?: string;
        confidence: 'high' | 'medium' | 'low';
      } | null = null;

      if (finalFields?.name || finalFields?.jobTitle || finalFields?.company) {
        try {
          aiData = await this.performAIAnalysis({
            name: finalFields.name || '',
            company: finalFields.company,
            jobTitle: finalFields.jobTitle,
            email: finalFields.email,
            website: finalFields.website,
            location: finalFields.location,
          });
        } catch (aiError) {
          logger.warn('AI analysis failed, continuing without it', { error: aiError });
        }
      }

      const totalTime = Date.now() - startTime;
      logger.info('Scan completed', {
        ocrTime,
        gptTime,
        totalTime,
        hasAI: !!aiData,
        gptExtracted,
        preprocessed: ocrResult.preprocessing?.applied,
        aiLinkedIn: aiData?.linkedInUrl || 'not found',
        aiLocation: aiData?.location || 'not found',
        aiSectors: aiData?.sectors?.length || 0,
        aiSkills: aiData?.skills?.length || 0,
      });

      // ScrapIn Enrichment for experience, education, and employment verification
      const linkedInUrl = aiData?.linkedInUrl || finalFields.linkedInUrl;
      const scrapInData = await this.enrichWithScrapIn(
        linkedInUrl,
        finalFields.company,
        finalFields.jobTitle
      );

      // Combine all data
      const result = {
        extractedFields: finalFields,
        rawText: ocrResult.rawText,
        confidence: gptExtracted ? 0.95 : ocrResult.confidence,
        processingTimeMs: totalTime,
        warnings: [...(ocrResult.warnings || []), ...(scrapInData?.warnings || [])],
        preprocessing: ocrResult.preprocessing ? {
          applied: ocrResult.preprocessing.applied,
          processingTimeMs: ocrResult.preprocessing.processingTimeMs,
          cardConfidence: ocrResult.preprocessing.cardConfidence,
          qualityScore: ocrResult.preprocessing.qualityScore,
          transformations: ocrResult.preprocessing.transformations,
          originalSize: ocrResult.preprocessing.originalSize,
          processedSize: ocrResult.preprocessing.processedSize,
          processedImageData: ocrResult.preprocessing.processedImageData,
          processedMimeType: ocrResult.preprocessing.processedMimeType,
        } : null,
        aiSuggestions: aiData ? {
          bio: aiData.bio,
          bioFull: aiData.bioFull,
          skills: aiData.skills,
          sectors: aiData.sectors,
          interests: aiData.interests,
          linkedInUrl: aiData.linkedInUrl,
          location: aiData.location,
          confidence: aiData.confidence,
        } : null,
        // ScrapIn enrichment data (NEW!)
        enrichment: scrapInData ? {
          experience: scrapInData.experience,
          education: scrapInData.education,
          pictureUrl: scrapInData.pictureUrl,
          iceBreakers: scrapInData.iceBreakers,
          employmentVerification: scrapInData.employmentVerification,
        } : null,
        extraction: {
          method: gptExtracted ? 'gpt' : 'ocr-regex',
          ocrTimeMs: ocrTime,
          gptTimeMs: gptExtracted ? gptTime : 0,
        },
      };

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Scan a business card with real-time progress updates (Server-Sent Events)
   *
   * GET /api/v1/scan/card/stream
   * Then POST image data
   *
   * This endpoint streams progress updates as the scan proceeds.
   */
  async scanCardStream(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AuthenticationError('Authentication required');
      }

      // Deduct points for scan
      const scanCost = await systemConfigService.getNumber('scan_cost', 5);
      try {
        await walletService.debit(req.user.userId, scanCost, 'Business card scan', null, 'SCAN');
      } catch (error) {
        if (error instanceof InsufficientPointsError) {
          res.status(402).json({
            success: false,
            error: { code: 'INSUFFICIENT_POINTS', message: error.message, details: error.details },
          });
          return;
        }
        throw error;
      }

      // Support both multipart file upload and base64 JSON body
      let imageData: string;
      let mimeType: string;

      if (req.file) {
        imageData = req.file.buffer.toString('base64');
        mimeType = req.file.mimetype;
      } else {
        imageData = req.body.imageData;
        mimeType = req.body.mimeType;
      }

      // Set up SSE headers
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.flushHeaders();

      const sendProgress = (stage: string, progress: number, message: string) => {
        res.write(`data: ${JSON.stringify({ stage, progress, message })}\n\n`);
      };

      const startTime = Date.now();

      // Stage 1: OCR (0-40%)
      sendProgress('ocr', 10, 'Starting OCR...');

      const ocrResult = await scanCardUseCase.execute(req.user.userId, {
        imageData,
        mimeType,
      });

      sendProgress('ocr', 40, 'OCR complete');
      const ocrTime = Date.now() - startTime;

      // Stage 2: GPT Field Extraction (40-70%)
      sendProgress('gpt', 45, 'Analyzing with AI...');

      let finalFields = ocrResult.fields;
      let gptExtracted = false;

      if (ocrResult.rawText && ocrResult.rawText.length > 10) {
        try {
          sendProgress('gpt', 50, 'Extracting fields with GPT...');
          const gptFields = await this.extractFieldsWithGPT(ocrResult.rawText);

          if (gptFields) {
            finalFields = {
              name: gptFields.name || ocrResult.fields.name,
              title: gptFields.title || undefined,
              firstName: gptFields.firstName || undefined,
              middleName: gptFields.middleName || undefined,
              lastName: gptFields.lastName || undefined,
              email: gptFields.email || ocrResult.fields.email,
              phone: gptFields.phone || ocrResult.fields.phone,
              company: gptFields.company || ocrResult.fields.company,
              jobTitle: gptFields.jobTitle || ocrResult.fields.jobTitle,
              website: gptFields.website || ocrResult.fields.website,
              linkedInUrl: gptFields.linkedInUrl || ocrResult.fields.linkedInUrl,
              location: gptFields.location || ocrResult.fields.location,
            };
            gptExtracted = true;
          }
          sendProgress('gpt', 70, 'Field extraction complete');
        } catch (gptError) {
          logger.warn('GPT extraction failed in stream', { error: gptError });
          sendProgress('gpt', 70, 'Using OCR results');
        }
      } else {
        sendProgress('gpt', 70, 'Using OCR results');
      }

      const gptTime = Date.now() - startTime - ocrTime;

      // Stage 3: AI Analysis (70-95%)
      sendProgress('analysis', 75, 'Analyzing profile...');

      let aiData: {
        bio?: string;
        bioFull?: string;
        skills: string[];
        sectors: string[];
        interests: string[];
        linkedInUrl?: string;
        location?: string;
        confidence: 'high' | 'medium' | 'low';
      } | null = null;

      if (finalFields?.name || finalFields?.jobTitle || finalFields?.company) {
        try {
          sendProgress('analysis', 80, 'Searching for profile info...');
          aiData = await this.performAIAnalysis({
            name: finalFields.name || '',
            company: finalFields.company,
            jobTitle: finalFields.jobTitle,
            email: finalFields.email,
            website: finalFields.website,
            location: finalFields.location,
          });
          sendProgress('analysis', 95, 'Profile analysis complete');
        } catch (aiError) {
          sendProgress('analysis', 95, 'Basic analysis complete');
        }
      } else {
        sendProgress('analysis', 95, 'Analysis complete');
      }

      // ScrapIn Enrichment for experience, education, and employment verification
      sendProgress('enrichment', 96, 'Enriching profile with LinkedIn data...');
      const linkedInUrl = aiData?.linkedInUrl || finalFields?.linkedInUrl;
      const scrapInData = await this.enrichWithScrapIn(
        linkedInUrl,
        finalFields?.company,
        finalFields?.jobTitle
      );

      // Stage 4: Complete (100%)
      sendProgress('complete', 100, 'Scan complete!');

      const totalTime = Date.now() - startTime;

      // Send final result
      const result = {
        extractedFields: finalFields,
        rawText: ocrResult.rawText,
        confidence: gptExtracted ? 0.95 : ocrResult.confidence,
        processingTimeMs: totalTime,
        warnings: [...(ocrResult.warnings || []), ...(scrapInData?.warnings || [])],
        preprocessing: ocrResult.preprocessing,
        aiSuggestions: aiData ? {
          bio: aiData.bio,
          bioFull: aiData.bioFull,
          skills: aiData.skills,
          sectors: aiData.sectors,
          interests: aiData.interests,
          linkedInUrl: aiData.linkedInUrl,
          location: aiData.location,
          confidence: aiData.confidence,
        } : null,
        // ScrapIn enrichment data (NEW!)
        enrichment: scrapInData ? {
          experience: scrapInData.experience,
          education: scrapInData.education,
          pictureUrl: scrapInData.pictureUrl,
          iceBreakers: scrapInData.iceBreakers,
          employmentVerification: scrapInData.employmentVerification,
        } : null,
        extraction: {
          method: gptExtracted ? 'gpt' : 'ocr-regex',
          ocrTimeMs: ocrTime,
          gptTimeMs: gptExtracted ? gptTime : 0,
        },
      };

      res.write(`data: ${JSON.stringify({ stage: 'result', progress: 100, result })}\n\n`);
      res.end();
    } catch (error) {
      // Send error via SSE
      res.write(`data: ${JSON.stringify({ stage: 'error', error: (error as Error).message })}\n\n`);
      res.end();
    }
  }

  /**
   * Confirm scanned fields and create contact
   *
   * POST /api/v1/scan/confirm
   *
   * Body:
   * - name: string (required)
   * - email?: string
   * - phone?: string
   * - company?: string
   * - jobTitle?: string
   * - website?: string
   * - cardImageUrl: string (required)
   * - sectors?: string[] (sector IDs)
   */
  async confirmScan(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AuthenticationError('Authentication required');
      }

      const contact = await createContactFromScanUseCase.execute(req.user.userId, req.body);

      res.status(201).json({
        success: true,
        data: contact,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Upload card image and get URL
   *
   * POST /api/v1/scan/upload
   *
   * This endpoint handles image upload before scanning.
   * Returns a URL that can be used for the card image.
   *
   * Body (multipart/form-data):
   * - image: file
   *
   * Or Body (JSON):
   * - imageData: base64 encoded image
   * - mimeType: image MIME type (e.g., 'image/jpeg')
   */
  async uploadImage(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AuthenticationError('Authentication required');
      }

      let imageBuffer: Buffer;
      let mimeType: string;
      let fileName: string;

      // Handle multipart upload
      if (req.file) {
        imageBuffer = req.file.buffer;
        mimeType = req.file.mimetype;
        fileName = req.file.originalname;
      }
      // Handle base64 upload
      else if (req.body.imageData) {
        const base64Data = req.body.imageData.replace(/^data:image\/\w+;base64,/, '');
        imageBuffer = Buffer.from(base64Data, 'base64');
        mimeType = req.body.mimeType || 'image/jpeg';
        fileName = `card_${Date.now()}.${mimeType.split('/')[1] || 'jpg'}`;
      } else {
        res.status(400).json({
          success: false,
          error: { code: 'NO_IMAGE', message: 'No image provided' },
        });
        return;
      }

      // Check if storage is available
      const storageAvailable = await StorageServiceFactory.isAvailable();

      if (!storageAvailable) {
        // Fallback: Return base64 data URL
        const dataUrl = `data:${mimeType};base64,${imageBuffer.toString('base64')}`;

        logger.info('Card image stored as base64 (storage not available)', {
          userId: req.user.userId,
          size: imageBuffer.length,
        });

        res.status(200).json({
          success: true,
          data: {
            url: dataUrl,
            key: `base64_${Date.now()}`,
            size: imageBuffer.length,
            storage: 'base64',
          },
        });
        return;
      }

      // Upload to storage service
      const storage = StorageServiceFactory.getService();
      const bucket = 'business-cards';
      const key = `${req.user.userId}/${randomUUID()}_${fileName}`;

      const result = await storage.upload(bucket, key, imageBuffer, {
        contentType: mimeType,
        metadata: {
          userId: req.user.userId,
          uploadedAt: new Date().toISOString(),
        },
      });

      logger.info('Card image uploaded to storage', {
        userId: req.user.userId,
        key: result.key,
        size: result.size,
      });

      res.status(200).json({
        success: true,
        data: {
          url: result.url,
          key: result.key,
          size: result.size,
          storage: 'minio',
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get suggested sectors based on extracted fields
   *
   * POST /api/v1/scan/suggest-sectors
   *
   * Body:
   * - company?: string
   * - jobTitle?: string
   *
   * Returns suggested sector IDs based on company/job title.
   */
  async suggestSectors(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AuthenticationError('Authentication required');
      }

      const { company, jobTitle } = req.body;
      const { prisma } = await import('../../infrastructure/database/prisma/client.js');

      // Keyword mapping for sector suggestions
      const sectorKeywords: Record<string, string[]> = {
        'Technology': ['tech', 'software', 'it', 'developer', 'engineer', 'data', 'cyber', 'cloud', 'ai', 'ml', 'digital', 'saas', 'platform', 'app', 'web', 'mobile', 'devops', 'backend', 'frontend', 'fullstack', 'architect', 'cto', 'vp engineering'],
        'Finance': ['bank', 'financial', 'investment', 'capital', 'fund', 'asset', 'wealth', 'cfo', 'finance', 'accounting', 'audit', 'tax', 'treasury', 'risk', 'compliance', 'fintech', 'insurance', 'actuary'],
        'Healthcare': ['health', 'medical', 'hospital', 'clinic', 'pharma', 'biotech', 'doctor', 'nurse', 'physician', 'therapist', 'dental', 'wellness', 'healthcare', 'patient', 'clinical'],
        'Education': ['school', 'university', 'college', 'education', 'teacher', 'professor', 'academic', 'training', 'learning', 'tutor', 'instructor', 'dean', 'principal', 'edtech'],
        'Real Estate': ['real estate', 'property', 'realty', 'housing', 'mortgage', 'broker', 'agent', 'development', 'construction', 'architect', 'builder', 'landlord'],
        'Manufacturing': ['manufacturing', 'factory', 'production', 'industrial', 'assembly', 'plant', 'operations', 'supply chain', 'logistics', 'warehouse', 'procurement'],
        'Retail': ['retail', 'store', 'shop', 'ecommerce', 'e-commerce', 'merchandise', 'buyer', 'sales associate', 'store manager', 'fashion', 'apparel', 'consumer'],
        'Consulting': ['consulting', 'consultant', 'advisory', 'strategy', 'mckinsey', 'bcg', 'bain', 'deloitte', 'pwc', 'kpmg', 'ey', 'accenture', 'management consulting'],
        'Marketing': ['marketing', 'advertising', 'brand', 'creative', 'agency', 'media', 'pr', 'public relations', 'communications', 'digital marketing', 'seo', 'content', 'social media', 'cmo'],
        'Legal': ['law', 'legal', 'attorney', 'lawyer', 'counsel', 'paralegal', 'litigation', 'corporate law', 'ip', 'patent', 'trademark', 'compliance'],
        'Energy': ['energy', 'oil', 'gas', 'petroleum', 'renewable', 'solar', 'wind', 'power', 'utility', 'electricity', 'nuclear', 'mining', 'sustainability'],
        'Transportation': ['transport', 'logistics', 'shipping', 'freight', 'airline', 'aviation', 'automotive', 'trucking', 'fleet', 'supply chain', 'delivery', 'distribution'],
      };

      // Combine company and job title for analysis
      const searchText = `${company || ''} ${jobTitle || ''}`.toLowerCase();

      // Find matching sectors
      const matchedSectors: { name: string; confidence: number }[] = [];

      for (const [sectorName, keywords] of Object.entries(sectorKeywords)) {
        let matchCount = 0;
        for (const keyword of keywords) {
          if (searchText.includes(keyword)) {
            matchCount++;
          }
        }
        if (matchCount > 0) {
          const confidence = Math.min(matchCount * 20, 100); // 20% per match, max 100%
          matchedSectors.push({ name: sectorName, confidence });
        }
      }

      // Sort by confidence and take top 3
      matchedSectors.sort((a, b) => b.confidence - a.confidence);
      const topSectors = matchedSectors.slice(0, 3);

      // Fetch actual sector IDs from database
      const suggestedSectors: { id: string; name: string; confidence: number }[] = [];

      for (const match of topSectors) {
        const sector = await prisma.sector.findFirst({
          where: { name: { equals: match.name } },
        });
        if (sector) {
          suggestedSectors.push({
            id: sector.id,
            name: sector.name,
            confidence: match.confidence,
          });
        }
      }

      logger.debug('Sector suggestions generated', {
        userId: req.user.userId,
        company,
        jobTitle,
        suggestions: suggestedSectors.length,
      });

      res.status(200).json({
        success: true,
        data: {
          suggestedSectors,
          searchText: searchText.trim(),
        },
      });
    } catch (error) {
      next(error);
    }
  }
}

// Export singleton instance
export const scanController = new ScanController();
