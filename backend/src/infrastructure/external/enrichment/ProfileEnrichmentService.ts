/**
 * Profile Enrichment Service
 *
 * Enriches user profiles using multiple data sources:
 * - PDL (People Data Labs) for LinkedIn profile data
 * - Groq AI for CV parsing and bio generation
 * - Database matching for sectors, skills, and interests
 *
 * @module infrastructure/external/enrichment/ProfileEnrichmentService
 */

import { PrismaClient } from '@prisma/client';
import { logger } from '../../../shared/logger';
import { config } from '../../../config';
import { PDLEnrichmentService } from './PDLEnrichmentService';

const prisma = new PrismaClient();

/**
 * Input for profile enrichment
 */
export interface ProfileEnrichmentInput {
  linkedInUrl?: string;
  twitterUrl?: string;
  cvText?: string;
  bio?: string;
  locale?: string; // 'en' or 'ar'
  enhanceWithWebSearch?: boolean; // Enable online search to find more data about the person
}

/**
 * Suggested item with match info
 */
export interface SuggestedItem {
  id: string;
  name: string;
  nameAr?: string;
  isCustom: boolean;
  confidence: number; // 0-1
}

/**
 * Suggested goal with confidence
 */
export interface SuggestedGoal {
  id: string;
  name: string;
  description: string;
  confidence: number;
}

/**
 * Profile enrichment result
 */
export interface ProfileEnrichmentResult {
  success: boolean;
  profile: {
    fullName?: string;
    firstName?: string;
    lastName?: string;
    company?: string;
    jobTitle?: string;
    location?: string;
    city?: string;
    country?: string;
    email?: string;
    phone?: string;
    linkedInUrl?: string;
    twitterUrl?: string;
  };
  generatedBio?: string;
  generatedBioSummary?: string;
  generatedBioFull?: string;
  bioDirection?: 'rtl' | 'ltr';
  detectedLanguage?: string;
  suggestedSectors: SuggestedItem[];
  suggestedSkills: SuggestedItem[];
  suggestedInterests: SuggestedItem[];
  suggestedHobbies: SuggestedItem[];
  suggestedGoals: SuggestedGoal[];
  rawData?: {
    linkedIn?: any;
    cv?: any;
  };
  error?: string;
  processingTimeMs: number;
}

/**
 * Groq API response type
 */
interface GroqResponse {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
}

/**
 * Profile Enrichment Service
 */
export class ProfileEnrichmentService {
  private pdlService: PDLEnrichmentService;
  private groqApiKey: string | undefined;
  private groqModel: string;
  private groqEndpoint = 'https://api.groq.com/openai/v1/chat/completions';
  // OpenAI for better CV analysis
  private openaiApiKey: string | undefined;
  private openaiModel = 'gpt-4o';
  private openaiEndpoint = 'https://api.openai.com/v1/chat/completions';
  // Perplexity for web search enhancement
  private perplexityApiKey: string | undefined;
  private perplexityEndpoint = 'https://api.perplexity.ai/chat/completions';
  // Google Custom Search for additional web search
  private googleCseApiKey: string | undefined;
  private googleCseCx: string | undefined;
  // ScrapIn for LinkedIn scraping
  private scrapInApiKey: string | undefined;
  // Coresignal for LinkedIn scraping fallback
  private coresignalApiKey: string | undefined;

  constructor() {
    this.pdlService = new PDLEnrichmentService();
    this.groqApiKey = config.ai.groq.apiKey;
    this.groqModel = config.ai.groq.model || 'llama-3.3-70b-versatile';
    this.openaiApiKey = config.ai.openai?.apiKey || process.env.OPENAI_API_KEY;
    this.perplexityApiKey = process.env.PERPLEXITY_API_KEY;
    this.googleCseApiKey = config.ai.googleCse?.apiKey;
    this.googleCseCx = config.ai.googleCse?.cx;
    this.scrapInApiKey = process.env.SCRAPIN_API_KEY;
    this.coresignalApiKey = process.env.CORESIGNAL_API_KEY;

    // Log configuration status at construction time
    logger.info('ProfileEnrichmentService initializing', {
      openaiKeyFromConfig: !!config.ai.openai?.apiKey,
      openaiKeyFromEnv: !!process.env.OPENAI_API_KEY,
      openaiKeyLength: this.openaiApiKey?.length || 0,
      groqKeyLength: this.groqApiKey?.length || 0,
      perplexityKeyLength: this.perplexityApiKey?.length || 0,
      googleCseConfigured: !!(this.googleCseApiKey && this.googleCseCx),
      scrapInConfigured: !!this.scrapInApiKey,
      coresignalConfigured: !!this.coresignalApiKey,
    });

    if (this.openaiApiKey) {
      logger.info('Profile Enrichment service configured with OpenAI GPT-4o (primary)');
    } else if (this.groqApiKey) {
      logger.info('Profile Enrichment service configured with Groq (fallback)');
    } else {
      logger.warn('Profile Enrichment service: No AI configured');
    }

    if (this.perplexityApiKey) {
      logger.info('Web search enhancement available via Perplexity');
    }

    if (this.googleCseApiKey && this.googleCseCx) {
      logger.info('Google Custom Search available for web search');
    }
  }

  /**
   * Enrich profile from multiple sources
   */
  async enrichProfile(input: ProfileEnrichmentInput): Promise<ProfileEnrichmentResult> {
    const startTime = Date.now();

    try {
      // Collect data from all sources in parallel
      const [linkedInData, cvAnalysis, existingData] = await Promise.all([
        input.linkedInUrl ? this.getLinkedInData(input.linkedInUrl) : null,
        input.cvText ? this.analyzeCVWithAI(input.cvText) : null,
        this.getExistingSectorsSkillsInterestsHobbies(),
      ]);

      // If no LinkedIn URL was provided but we have CV data, try to discover LinkedIn URL
      // Use Google CSE to find the LinkedIn profile, then scrape with ScrapIn
      let discoveredLinkedInData = linkedInData;
      if (!linkedInData && cvAnalysis?.fullName) {
        const personName = cvAnalysis.fullName;
        const company = cvAnalysis.company;
        let discoveredLinkedInUrl: string | null = null;

        // Use Google CSE to discover LinkedIn URL from person name + company
        if (this.googleCseApiKey && this.googleCseCx) {
          try {
            logger.info('No LinkedIn URL provided - attempting discovery via Google CSE', { personName, company });
            const googleResults = await this.searchWithGoogleCSE(personName, company, cvAnalysis.jobTitle);
            if (googleResults.linkedInUrl) {
              discoveredLinkedInUrl = googleResults.linkedInUrl;
              logger.info('LinkedIn URL discovered via Google CSE', {
                personName,
                discoveredUrl: discoveredLinkedInUrl,
              });
            } else {
              logger.info('Google CSE did not find LinkedIn URL', { personName, company });
            }
          } catch (error) {
            logger.warn('Google CSE LinkedIn discovery failed', { error });
          }
        }

        // Step 3: If we found a LinkedIn URL, scrape it with ScrapIn
        if (discoveredLinkedInUrl) {
          try {
            discoveredLinkedInData = await this.getLinkedInData(discoveredLinkedInUrl);
            if (discoveredLinkedInData) {
              logger.info('LinkedIn data retrieved from auto-discovered URL via ScrapIn', {
                personName,
                discoveredUrl: discoveredLinkedInUrl,
                hasData: true,
              });
            }
          } catch (error) {
            logger.warn('Failed to scrape auto-discovered LinkedIn URL', { error, discoveredLinkedInUrl });
          }
        }
      }

      // If web search enhancement is enabled, search for more data about the person
      let webSearchData: any = null;
      if (input.enhanceWithWebSearch && (cvAnalysis?.fullName || discoveredLinkedInData?.fullName)) {
        const personName = cvAnalysis?.fullName || discoveredLinkedInData?.fullName;
        const company = cvAnalysis?.company || discoveredLinkedInData?.company;
        logger.info('Performing web search enhancement', { personName, company });
        webSearchData = await this.searchPersonOnline(personName, company, cvAnalysis?.jobTitle);
      }

      logger.info('Enrichment data collected', {
        hasLinkedIn: !!discoveredLinkedInData,
        linkedInAutoDiscovered: !linkedInData && !!discoveredLinkedInData,
        hasCV: !!cvAnalysis,
        hasWebSearch: !!webSearchData,
        cvFields: cvAnalysis ? Object.keys(cvAnalysis) : [],
        cvSectors: cvAnalysis?.sectors?.length || 0,
        cvSkills: cvAnalysis?.skills?.length || 0,
        cvHobbies: cvAnalysis?.hobbies?.length || 0,
        dbSectors: existingData.sectors.length,
        dbSkills: existingData.skills.length,
        dbHobbies: existingData.hobbies.length,
      });

      // Merge data from all sources (including web search)
      const mergedProfile = this.mergeProfileData(discoveredLinkedInData, cvAnalysis, input.bio, webSearchData);

      logger.info('Merged profile', {
        company: mergedProfile.company,
        jobTitle: mergedProfile.jobTitle,
        location: mergedProfile.location,
        linkedInUrl: mergedProfile.linkedInUrl,
        twitterUrl: mergedProfile.twitterUrl,
        extractedSectors: mergedProfile.extractedSectors?.length || 0,
        extractedSkills: mergedProfile.extractedSkills?.length || 0,
        webSearchEnhanced: !!webSearchData,
      });

      // Detect language early for use in matching
      const textToCheckForLang = cvAnalysis?.summary || input.cvText || input.bio || '';
      const arabicCharCountEarly = (textToCheckForLang.match(/[\u0600-\u06FF]/g) || []).length;
      const totalCharCountEarly = textToCheckForLang.replace(/\s/g, '').length || 1;
      const isArabicContentEarly = arabicCharCountEarly > totalCharCountEarly * 0.3;
      const detectedLang = isArabicContentEarly ? 'ar' : 'en';

      // Generate bio if not provided (include web search data for richer bio)
      let generatedBio = input.bio;
      let generatedBioSummary: string | undefined;
      let generatedBioFull: string | undefined;
      if (!generatedBio && (discoveredLinkedInData || cvAnalysis || webSearchData)) {
        const bioResult = await this.generateBio(mergedProfile, discoveredLinkedInData, cvAnalysis, input.locale, webSearchData);
        if (bioResult) {
          generatedBioSummary = bioResult.summary;
          generatedBioFull = bioResult.full;
          // For backward compatibility, set generatedBio to full or summary
          generatedBio = bioResult.full || bioResult.summary;
        }
      }

      // Match with existing sectors, skills, interests, hobbies
      // Pass detected language for proper handling of custom items
      let suggestedSectors = await this.matchSectors(
        mergedProfile.extractedSectors || [],
        existingData.sectors,
        detectedLang
      );
      let suggestedSkills = await this.matchSkills(
        mergedProfile.extractedSkills || [],
        existingData.skills,
        detectedLang
      );
      let suggestedInterests = await this.matchInterests(
        mergedProfile.extractedInterests || [],
        existingData.interests,
        detectedLang
      );
      let suggestedHobbies = await this.matchHobbies(
        mergedProfile.extractedHobbies || [],
        existingData.hobbies,
        detectedLang
      );

      // If no matches found, return all database items with moderate confidence for user selection
      if (suggestedSectors.length === 0 && existingData.sectors.length > 0) {
        suggestedSectors = existingData.sectors.map((s: any) => ({
          id: s.id,
          name: s.name,
          nameAr: s.nameAr,
          isCustom: false,
          confidence: 0.5,
        }));
      }
      if (suggestedSkills.length === 0 && existingData.skills.length > 0) {
        suggestedSkills = existingData.skills.slice(0, 30).map((s: any) => ({
          id: s.id,
          name: s.name,
          nameAr: s.nameAr,
          isCustom: false,
          confidence: 0.5,
        }));
      }
      if (suggestedInterests.length === 0 && existingData.interests.length > 0) {
        suggestedInterests = existingData.interests.slice(0, 20).map((i: any) => ({
          id: i.id,
          name: i.name,
          nameAr: i.nameAr,
          isCustom: false,
          confidence: 0.5,
        }));
      }
      if (suggestedHobbies.length === 0 && existingData.hobbies.length > 0) {
        suggestedHobbies = existingData.hobbies.slice(0, 20).map((h: any) => ({
          id: h.id,
          name: h.name,
          nameAr: h.nameAr,
          isCustom: false,
          confidence: 0.5,
        }));
      }

      // Suggest goals based on profile
      const suggestedGoals = await this.suggestGoals(mergedProfile, cvAnalysis);

      // Detect language direction from bio or CV text
      const textToCheck = generatedBio || cvAnalysis?.summary || input.cvText || '';
      const arabicPattern = /[\u0600-\u06FF]/;
      const arabicCharCount = (textToCheck.match(/[\u0600-\u06FF]/g) || []).length;
      const totalCharCount = textToCheck.replace(/\s/g, '').length || 1;
      const isArabicContent = arabicCharCount > totalCharCount * 0.3;
      const bioDirection: 'rtl' | 'ltr' = isArabicContent ? 'rtl' : 'ltr';
      const detectedLanguage = isArabicContent ? 'ar' : 'en';

      return {
        success: true,
        profile: {
          fullName: mergedProfile.fullName,
          firstName: mergedProfile.firstName,
          lastName: mergedProfile.lastName,
          company: mergedProfile.company,
          jobTitle: mergedProfile.jobTitle,
          location: mergedProfile.location,
          city: mergedProfile.city || '',
          country: mergedProfile.country || '',
          email: mergedProfile.email,
          phone: mergedProfile.phone,
          linkedInUrl: mergedProfile.linkedInUrl,
          twitterUrl: mergedProfile.twitterUrl,
        },
        generatedBio,
        generatedBioSummary,
        generatedBioFull,
        bioDirection,
        detectedLanguage,
        suggestedSectors,
        suggestedSkills,
        suggestedInterests,
        suggestedHobbies,
        suggestedGoals,
        rawData: {
          linkedIn: discoveredLinkedInData,
          cv: cvAnalysis,
        },
        processingTimeMs: Date.now() - startTime,
      };
    } catch (error) {
      logger.error('Profile enrichment failed', { error, input });
      return {
        success: false,
        profile: {},
        suggestedSectors: [],
        suggestedSkills: [],
        suggestedInterests: [],
        suggestedHobbies: [],
        suggestedGoals: [],
        error: error instanceof Error ? error.message : 'Unknown error',
        processingTimeMs: Date.now() - startTime,
      };
    }
  }

  /**
   * Normalize LinkedIn URL to standard format
   */
  private normalizeLinkedInUrl(url: string): string {
    if (!url) return '';

    let normalized = url.trim();

    // Remove trailing slash
    normalized = normalized.replace(/\/+$/, '');

    // Handle various LinkedIn URL formats
    // linkedin.com/in/username
    // www.linkedin.com/in/username
    // https://linkedin.com/in/username
    // https://www.linkedin.com/in/username
    // m.linkedin.com/in/username (mobile)

    // Extract the path part
    const linkedInMatch = normalized.match(/(?:https?:\/\/)?(?:www\.|m\.)?linkedin\.com\/(in|pub|company)\/([a-zA-Z0-9_-]+)/i);

    if (linkedInMatch) {
      const [, type, username] = linkedInMatch;
      normalized = `https://www.linkedin.com/${type}/${username}`;
    } else if (!normalized.startsWith('http')) {
      // If it's just a username or path
      if (normalized.startsWith('in/') || normalized.startsWith('/in/')) {
        normalized = `https://www.linkedin.com${normalized.startsWith('/') ? '' : '/'}${normalized}`;
      } else if (!normalized.includes('/')) {
        // Just a username
        normalized = `https://www.linkedin.com/in/${normalized}`;
      }
    }

    logger.debug('Normalized LinkedIn URL', { original: url, normalized });
    return normalized;
  }

  /**
   * Extract username from LinkedIn URL
   */
  private extractLinkedInUsername(url: string): string | null {
    const match = url.match(/linkedin\.com\/(?:in|pub)\/([a-zA-Z0-9_-]+)/i);
    return match ? match[1] : null;
  }

  /**
   * Get LinkedIn profile data via PDL with fallback
   */
  private async getLinkedInData(linkedInUrl: string): Promise<any> {
    // Normalize the URL first
    const normalizedUrl = this.normalizeLinkedInUrl(linkedInUrl);

    if (!normalizedUrl) {
      logger.warn('Invalid LinkedIn URL provided', { linkedInUrl });
      return null;
    }

    logger.info('Attempting LinkedIn enrichment via ScrapIn', {
      originalUrl: linkedInUrl,
      normalizedUrl
    });

    try {
      // Use ScrapIn → Coresignal → RapidAPI pipeline (via scrapeLinkedInPage + analyzeLinkedInWithGroq)
      const username = this.extractLinkedInUsername(normalizedUrl);
      const scrapInData = await this.analyzeLinkedInWithGroq(normalizedUrl, username);

      if (scrapInData && (scrapInData.fullName || scrapInData.jobTitle || scrapInData.company)) {
        logger.info('LinkedIn data retrieved via ScrapIn pipeline', {
          linkedInUrl: normalizedUrl,
          fullName: scrapInData.fullName,
          jobTitle: scrapInData.jobTitle,
          company: scrapInData.company,
        });
        return {
          ...scrapInData,
          linkedinUrl: normalizedUrl,
          linkedInUsername: username,
        };
      }

      logger.warn('ScrapIn pipeline returned no useful data for LinkedIn URL', { linkedInUrl: normalizedUrl });
      return scrapInData ? { ...scrapInData, linkedinUrl: normalizedUrl, linkedInUsername: username } : null;
    } catch (error) {
      logger.error('Failed to get LinkedIn data via ScrapIn', { error, linkedInUrl: normalizedUrl });
      return null;
    }
  }

  /**
   * Scrape LinkedIn profile page and extract data using Groq
   */
  private async analyzeLinkedInWithGroq(linkedInUrl: string, username: string | null): Promise<any> {
    if (!this.groqApiKey) {
      logger.warn('Groq not configured for LinkedIn scraping');
      return {};
    }

    try {
      logger.info('Scraping LinkedIn profile', { linkedInUrl });

      // Fetch the LinkedIn page with browser-like headers
      const pageContent = await this.scrapeLinkedInPage(linkedInUrl);

      if (!pageContent) {
        logger.warn('Could not fetch LinkedIn page content');
        return {};
      }

      // Check if we got structured JSON data (Coresignal, Proxycurl, RapidAPI, etc.)
      if (pageContent.startsWith('{') && pageContent.includes('"_source":')) {
        try {
          const data = JSON.parse(pageContent);
          logger.info('Using structured API data directly', {
            source: data._source,
            fullName: data.fullName,
            jobTitle: data.jobTitle,
            company: data.company,
            location: data.location,
            hasExperiences: !!data.experiences?.length,
            skillsCount: data.skills?.length || 0,
            companyIndustry: data.companyInfo?.industry,
          });

          // Extract sectors from industry/department/companyInfo
          const sectors: string[] = [];
          if (data.industry) sectors.push(data.industry);
          if (data.department) sectors.push(data.department);
          if (data.companyInfo?.industry && !sectors.includes(data.companyInfo.industry)) {
            sectors.push(data.companyInfo.industry);
          }
          data.experiences?.forEach((exp: any) => {
            if (exp.industry && !sectors.includes(exp.industry)) {
              sectors.push(exp.industry);
            }
          });

          // Find the CURRENT experience (where endDate is null/empty, meaning still employed)
          const currentExperience = data.experiences?.find((exp: any) => !exp.endDate) ||
            data.experiences?.sort((a: any, b: any) => {
              // Fallback: sort by start date descending to get most recent
              const dateA = a.startDate ? new Date(a.startDate).getTime() : 0;
              const dateB = b.startDate ? new Date(b.startDate).getTime() : 0;
              return dateB - dateA;
            })?.[0];

          // Use Groq to infer sectors, interests, and hobbies from the rich profile data
          let inferredSectors: string[] = [];
          let inferredInterests: string[] = [];
          let inferredHobbies: string[] = [];

          if (this.groqApiKey) {
            try {
              const profileSummary = [
                data.headline ? `Headline: ${data.headline}` : '',
                data.summary ? `About: ${data.summary}` : '',
                data.companyInfo?.industry ? `Company Industry: ${data.companyInfo.industry}` : '',
                data.companyInfo?.description ? `Company: ${data.companyInfo.description}` : '',
                data.skills?.length ? `Skills: ${data.skills.join(', ')}` : '',
                data.experiences?.length ? `Experience: ${data.experiences.map((e: any) => `${e.title || ''} at ${e.company || ''}${e.description ? ' - ' + e.description.substring(0, 200) : ''}`).join('; ')}` : '',
                data.education?.length ? `Education: ${data.education.map((e: any) => `${e.degree || ''} ${e.field || ''} at ${e.school || ''}`).join('; ')}` : '',
              ].filter(Boolean).join('\n');

              // Get existing sector names for better matching
              const existingData = await this.getExistingSectorsSkillsInterestsHobbies();
              const dbSectorNames = existingData.sectors.map((s: any) => s.name).slice(0, 80);

              const inferResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${this.groqApiKey}`,
                },
                body: JSON.stringify({
                  model: 'llama-3.3-70b-versatile',
                  messages: [
                    {
                      role: 'system',
                      content: 'You extract structured professional profile data. Return ONLY valid JSON. All values must be in ENGLISH.',
                    },
                    {
                      role: 'user',
                      content: `Analyze this person's LinkedIn profile and select the most relevant sectors, interests, and hobbies.

${profileSummary}

AVAILABLE SECTORS IN OUR DATABASE (pick from these when possible):
${JSON.stringify(dbSectorNames)}

Return JSON:
{
  "sectors": ["Pick 3-6 sectors from the available list above that BEST match this person's actual job, skills, and experience. Only add custom sectors if nothing in the list fits."],
  "interests": ["3-8 professional interests based on their actual skills, job title, and experience"],
  "hobbies": ["personal hobbies ONLY if explicitly mentioned in their about/summary. If none mentioned, return empty array."]
}

RULES:
- For sectors: Focus on what THIS PERSON actually does based on their job title, skills, and experience
- A software developer should get "Software Development", "Information Technology", etc.
- DO NOT pick sectors just because they sound vaguely related to the company industry
- Interests should be specific to their actual work (e.g. a Laravel developer → "Web Development", "API Development", "Database Design")
- All values MUST be in English
- Return ONLY valid JSON`,
                    },
                  ],
                  temperature: 0.2,
                  max_tokens: 500,
                  response_format: { type: 'json_object' },
                }),
              });

              if (inferResponse.ok) {
                const inferResult = await inferResponse.json() as { choices?: Array<{ message?: { content?: string } }> };
                const inferContent = inferResult.choices?.[0]?.message?.content;
                if (inferContent) {
                  const inferred = JSON.parse(inferContent);
                  inferredSectors = Array.isArray(inferred.sectors) ? inferred.sectors : [];
                  inferredInterests = Array.isArray(inferred.interests) ? inferred.interests : [];
                  inferredHobbies = Array.isArray(inferred.hobbies) ? inferred.hobbies : [];
                  logger.info('Inferred sectors/interests/hobbies from LinkedIn data via Groq', {
                    sectors: inferredSectors.length,
                    interests: inferredInterests.length,
                    hobbies: inferredHobbies.length,
                  });
                }
              }
            } catch (inferError) {
              logger.warn('Failed to infer sectors/interests from LinkedIn data', { error: inferError });
            }
          }

          // Combine directly extracted sectors with AI-inferred ones
          const allSectors = [...sectors, ...inferredSectors];
          const uniqueSectors = allSectors.filter((s, i) => allSectors.findIndex(x => x.toLowerCase() === s.toLowerCase()) === i);

          // Return the data with properly extracted fields
          return {
            fullName: data.fullName,
            firstName: data.firstName,
            lastName: data.lastName,
            jobTitle: data.jobTitle || currentExperience?.title || data.headline || data.occupation,
            company: data.company || currentExperience?.company,
            location: data.location,
            country: data.country,
            city: data.city,
            bio: data.summary,
            skills: data.skills || [],
            interests: inferredInterests,
            hobbies: inferredHobbies,
            _sectors: uniqueSectors,
            experience: data.experiences,
            education: data.education,
            totalExperience: data.totalExperience,
            connections: data.connections,
            followers: data.followers,
            pictureUrl: data.pictureUrl,
            linkedInUrl: data.linkedInUrl,
          };
        } catch (e) {
          logger.warn('Failed to parse structured API data', { error: e });
        }
      }

      logger.info('LinkedIn page fetched, sending to Groq for extraction', {
        contentLength: pageContent.length,
        linkedInUrl
      });

      // Use Groq to extract structured data from the HTML
      // Send more content for better extraction (skills/interests are often further down)
      const prompt = `Extract ALL professional information from this LinkedIn profile HTML content.

HTML Content:
${pageContent.substring(0, 30000)}

Extract the following information from the HTML. Look carefully for:
- Name: Usually in <h1> tags or title
- Headline/Job Title: Usually below the name
- Company: Current workplace
- Location: Geographic location (city, country)
- About/Summary: Profile description
- Experience: Job history with companies and titles
- Skills: Listed skills (look for skill tags, endorsements section)
- Education: Schools attended
- Interests/Hobbies: Any personal interests mentioned

Return a JSON object with ONLY the data you can actually find in the HTML:
{
  "fullName": "Exact name found",
  "firstName": "First name",
  "lastName": "Last name",
  "jobTitle": "Current job title/headline",
  "company": "Current company",
  "location": "Full location string",
  "city": "City name",
  "country": "Country name",
  "summary": "About section text",
  "skills": ["skill1", "skill2", "skill3"],
  "sectors": ["industry sectors based on their job, company, and experience"],
  "interests": ["professional interests based on their work and skills"],
  "hobbies": ["personal hobbies if mentioned in about section"],
  "experience": [{"company": "Company", "title": "Title", "description": "Role description if available"}],
  "education": [{"school": "School name", "degree": "Degree", "field": "Field of study"}]
}

IMPORTANT:
- Only include fields where you found ACTUAL data in the HTML
- Do NOT make up or guess any information
- For skills: look for ANY skill mentions throughout the profile, including in experience descriptions
- For sectors: infer 2-5 industry sectors from their job title, company, and experience (e.g. Technology, Finance, Healthcare)
- For interests: infer 3-5 professional interests from their skills and experience
- For city/country: parse from the location string (e.g. "Amman, Jordan" → city: "Amman", country: "Jordan")
- If a field is not found, omit it from the response
- Return ONLY valid JSON`;

      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.groqApiKey}`,
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [
            {
              role: 'system',
              content: 'You are an expert HTML parser. Extract professional profile data from LinkedIn HTML. Only extract data that is actually present in the HTML - never make up information. Return valid JSON only.',
            },
            { role: 'user', content: prompt },
          ],
          temperature: 0.1,
          max_tokens: 3000,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error('Groq API error for LinkedIn scraping', { status: response.status, error: errorText });
        return {};
      }

      const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
      const content = data.choices?.[0]?.message?.content;

      if (!content) {
        logger.warn('No content from Groq for LinkedIn scraping');
        return {};
      }

      // Parse JSON from response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        logger.warn('Could not parse JSON from Groq LinkedIn response', { content: content.substring(0, 500) });
        return {};
      }

      const parsed = JSON.parse(jsonMatch[0]);

      logger.info('LinkedIn data extracted via scraping + Groq', {
        linkedInUrl,
        fullName: parsed.fullName,
        jobTitle: parsed.jobTitle,
        company: parsed.company,
        skillsCount: parsed.skills?.length || 0,
      });

      return {
        fullName: parsed.fullName,
        firstName: parsed.firstName,
        lastName: parsed.lastName,
        jobTitle: parsed.jobTitle,
        company: parsed.company,
        location: parsed.location,
        city: parsed.city,
        country: parsed.country,
        bio: parsed.summary,
        industry: parsed.sectors?.[0],
        skills: parsed.skills || [],
        interests: parsed.interests || [],
        hobbies: parsed.hobbies || [],
        _sectors: parsed.sectors || [],
        experience: parsed.experience,
        education: parsed.education,
      };
    } catch (error) {
      logger.error('LinkedIn scraping failed', { error, linkedInUrl });
      return {};
    }
  }

  /**
   * Fetch LinkedIn data using ScrapIn API
   * Returns structured JSON data
   */
  private async scrapeLinkedInPage(url: string): Promise<string | null> {
    // 1. Try ScrapIn (primary)
    const scrapInData = await this.scrapeViaScrapIn(url);
    if (scrapInData) {
      logger.info('LinkedIn data retrieved via ScrapIn');
      return scrapInData;
    }
    logger.warn('ScrapIn failed, falling back to direct scraping', { url });

    // 2. Direct scraping fallback (when ScrapIn is unavailable)
    const directData = await this.scrapeDirectly(url);
    if (directData) {
      logger.info('LinkedIn data retrieved via direct scraping fallback');
      return directData;
    }

    logger.warn('All LinkedIn scraping methods failed', { url });
    return null;
  }

  /**
   * Scrape via Coresignal API (primary LinkedIn scraper)
   * https://docs.coresignal.com/employee-api/clean-employee-api/endpoints/collect
   */
  private async scrapeViaCoresignal(url: string): Promise<string | null> {
    const apiKey = this.coresignalApiKey;
    if (!apiKey) {
      logger.info('Coresignal not configured - skipping LinkedIn scraping via Coresignal');
      return null;
    }

    try {
      // Extract username from LinkedIn URL
      const username = this.extractLinkedInUsername(url);
      if (!username) {
        logger.warn('Could not extract LinkedIn username from URL', { url });
        return null;
      }

      logger.info('Trying Coresignal API for LinkedIn', { url, username });

      // Coresignal accepts the LinkedIn username/shorthand directly
      const apiUrl = `https://api.coresignal.com/cdapi/v2/employee_clean/collect/${encodeURIComponent(username)}`;

      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'accept': 'application/json',
          'apikey': apiKey,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.warn('Coresignal request failed', { status: response.status, error: errorText });
        return null;
      }

      const data = await response.json() as any;

      if (!data || data.error) {
        logger.warn('Coresignal returned error or empty data', { data });
        return null;
      }

      // Find the CURRENT job (where date_to is null/empty, meaning still employed)
      // Coresignal doesn't guarantee experiences are sorted by date, so we must find it explicitly
      const experiences = data.experience || [];
      const currentExp = experiences.find((exp: any) => !exp.date_to) ||
                         experiences.sort((a: any, b: any) => {
                           // Fallback: sort by start date descending to get most recent
                           const dateA = a.date_from ? new Date(a.date_from).getTime() : 0;
                           const dateB = b.date_from ? new Date(b.date_from).getTime() : 0;
                           return dateB - dateA;
                         })[0];
      const currentCompany = currentExp?.company_name;
      const currentJobTitle = data.job_title || currentExp?.title || data.headline;

      logger.info('LinkedIn data retrieved via Coresignal', {
        fullName: data.full_name,
        headline: data.headline,
        jobTitle: currentJobTitle,
        company: currentCompany,
        location: data.location_raw_address,
        hasExperience: !!data.experience?.length,
        experienceCount: data.experience?.length || 0,
      });

      // Convert Coresignal response to standard format
      const education = data.education || [];

      // Build location string
      const location = data.location_raw_address ||
        [data.location_city, data.location_state, data.location_country].filter(Boolean).join(', ');

      return JSON.stringify({
        _source: 'coresignal',
        fullName: data.full_name,
        firstName: data.name_first,
        lastName: data.name_last,
        headline: data.headline,
        jobTitle: currentJobTitle,
        company: currentCompany,
        summary: data.description, // Coresignal uses 'description' for bio
        location: location,
        country: data.location_country,
        city: data.location_city,
        occupation: currentJobTitle,
        industry: currentExp?.company_industry || data.department,
        department: data.department,
        totalExperience: data.total_experience_duration,
        experiences: experiences.map((exp: any) => ({
          company: exp.company_name,
          title: exp.title,
          description: exp.description,
          location: exp.location,
          industry: exp.company_industry,
          companySize: exp.company_size_range,
          startDate: exp.date_from,
          endDate: exp.date_to,
          duration: exp.duration,
          isCurrent: !exp.date_to,
        })),
        education: education.map((edu: any) => ({
          school: edu.school_name || edu.title,
          degree: edu.degree || edu.subtitle,
          field: edu.field_of_study,
          startDate: edu.date_from,
          endDate: edu.date_to,
        })),
        skills: data.skills || [],
        languages: data.languages || [],
        certifications: data.certifications || [],
        connections: data.connections_count,
        followers: data.follower_count,
        pictureUrl: data.picture_url,
        linkedInUrl: data.websites_linkedin,
      });
    } catch (error) {
      logger.error('Coresignal LinkedIn scraping failed', { error });
      return null;
    }
  }

  /**
   * Scrape via RapidAPI LinkedIn Data API (backup)
   * https://rapidapi.com/rockapis-rockapis-default/api/linkedin-data-api
   */
  private async scrapeViaRapidAPI(url: string): Promise<string | null> {
    const apiKey = process.env.RAPIDAPI_KEY;
    if (!apiKey) {
      logger.debug('RapidAPI not configured');
      return null;
    }

    try {
      // Extract username from LinkedIn URL
      const username = this.extractLinkedInUsername(url);
      if (!username) {
        logger.warn('Could not extract LinkedIn username from URL', { url });
        return null;
      }

      logger.info('Trying RapidAPI LinkedIn Data API', { url, username });

      const apiUrl = `https://linkedin-data-api.p.rapidapi.com/get-profile-data-by-url?url=${encodeURIComponent(url)}`;

      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'X-RapidAPI-Key': apiKey,
          'X-RapidAPI-Host': 'linkedin-data-api.p.rapidapi.com',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.warn('RapidAPI LinkedIn request failed', { status: response.status, error: errorText });
        return null;
      }

      const data = await response.json() as any;

      if (!data || data.error) {
        logger.warn('RapidAPI returned error or empty data', { data });
        return null;
      }

      // Find the CURRENT job (where end is null/empty, meaning still employed)
      const positions = data.position || [];
      const currentPosition = positions.find((exp: any) => !exp.end) ||
                              positions.sort((a: any, b: any) => {
                                const dateA = a.start ? new Date(a.start).getTime() : 0;
                                const dateB = b.start ? new Date(b.start).getTime() : 0;
                                return dateB - dateA;
                              })[0];
      const currentCompany = currentPosition?.companyName;
      const currentJobTitle = currentPosition?.title || data.headline;

      logger.info('LinkedIn data retrieved via RapidAPI', {
        fullName: data.fullName || data.firstName + ' ' + data.lastName,
        headline: data.headline,
        jobTitle: currentJobTitle,
        company: currentCompany,
        hasExperience: !!data.position?.length,
        experienceCount: data.position?.length || 0,
      });

      // Convert RapidAPI response to standard format
      return JSON.stringify({
        _source: 'rapidapi',
        fullName: data.fullName || `${data.firstName || ''} ${data.lastName || ''}`.trim(),
        firstName: data.firstName,
        lastName: data.lastName,
        headline: data.headline,
        jobTitle: currentJobTitle,
        company: currentCompany,
        summary: data.summary || data.about,
        location: data.geo?.full || data.location,
        occupation: currentJobTitle,
        experiences: positions.map((exp: any) => ({
          company: exp.companyName,
          title: exp.title,
          description: exp.description,
          location: exp.location,
          startDate: exp.start,
          endDate: exp.end,
          isCurrent: !exp.end,
        })),
        education: data.educations?.map((edu: any) => ({
          school: edu.schoolName,
          degree: edu.degreeName,
          field: edu.fieldOfStudy,
          startDate: edu.start,
          endDate: edu.end,
        })),
        skills: data.skills?.map((s: any) => s.name || s) || [],
        languages: data.languages,
        certifications: data.certifications,
      });
    } catch (error) {
      logger.error('RapidAPI LinkedIn scraping failed', { error });
      return null;
    }
  }

  /**
   * Scrape via ScrapIn API (GDPR compliant alternative)
   * https://www.scrapin.io/
   */
  private async scrapeViaScrapIn(url: string): Promise<string | null> {
    const apiKey = this.scrapInApiKey;
    if (!apiKey) {
      logger.warn('ScrapIn not configured - no API key');
      return null;
    }

    try {
      logger.info('Trying ScrapIn for LinkedIn', { url });

      // ScrapIn v1 API - POST with JSON body, apikey as query parameter
      const apiUrl = `https://api.scrapin.io/v1/enrichment/profile?apikey=${apiKey}`;

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          linkedInUrl: url,
          includes: {
            includeCompany: true,
            includeSummary: true,
            includeFollowersCount: true,
            includeCreationDate: true,
            includeSkills: true,
            includeLanguages: true,
            includeExperience: true,
            includeEducation: true,
            includeRecommendations: true,
            includeCertifications: true,
            includeTestScores: true,
            includeVolunteeringExperiences: true,
          },
          cacheDuration: '7d',
        }),
      });

      const result = await response.json() as any;

      if (!result.success) {
        logger.warn('ScrapIn API error', { msg: result.msg, title: result.title });
        return null;
      }

      const data = result.person;
      if (!data) {
        logger.warn('ScrapIn returned empty data');
        return null;
      }

      // Log cache and credits info
      logger.info('ScrapIn response metadata', {
        creditsLeft: result.credits_left,
        cacheSource: result.metadata?.source,
        requestId: result.metadata?.request_id,
      });

      // Extract position history and current position
      const positionHistory = data.positions?.positionHistory || [];
      // ScrapIn provides currentPosition separately when positionHistory is empty
      const currentPosition = positionHistory[0] || data.currentPosition;
      const currentCompany = currentPosition?.companyName || result.company?.name;
      const currentJobTitle = currentPosition?.title || data.headline;

      // Format location from object
      let locationStr = '';
      if (data.location) {
        locationStr = [data.location.city, data.location.state, data.location.country]
          .filter(Boolean)
          .join(', ');
      }

      logger.info('LinkedIn data retrieved via ScrapIn', {
        fullName: `${data.firstName} ${data.lastName}`,
        headline: data.headline,
        jobTitle: currentJobTitle,
        company: currentCompany,
        hasPositions: positionHistory.length > 0,
        positionsCount: positionHistory.length,
      });

      return JSON.stringify({
        _source: 'scrapin',
        fullName: `${data.firstName || ''} ${data.lastName || ''}`.trim(),
        firstName: data.firstName,
        lastName: data.lastName,
        headline: data.headline,
        jobTitle: currentJobTitle,
        company: currentCompany,
        summary: data.summary,
        location: locationStr,
        occupation: currentJobTitle,
        photoUrl: data.photoUrl,
        linkedInUrl: data.linkedInUrl || url,
        connections: data.connectionsCount,
        followers: data.followerCount,
        city: data.location?.city,
        country: data.location?.country,
        experiences: (() => {
          // Build experiences from positionHistory, or from currentPosition if history is empty
          const allPositions = positionHistory.length > 0 ? positionHistory : (data.currentPosition ? [data.currentPosition] : []);
          return allPositions.map((exp: any) => {
            // Format dates from {month, year} objects
            let startDate: string | undefined;
            let endDate: string | undefined;
            if (exp.startEndDate?.start) {
              const s = exp.startEndDate.start;
              startDate = s.year ? (s.month ? `${s.year}-${String(s.month).padStart(2, '0')}` : String(s.year)) : undefined;
            }
            if (exp.startEndDate?.end) {
              const e = exp.startEndDate.end;
              endDate = e.year ? (e.month ? `${e.year}-${String(e.month).padStart(2, '0')}` : String(e.year)) : undefined;
            }
            return {
              company: exp.companyName,
              title: exp.title,
              description: exp.description,
              startDate,
              endDate,
              isCurrent: !exp.startEndDate?.end,
            };
          });
        })(),
        education: data.schools?.educationHistory?.map((edu: any) => ({
          school: edu.schoolName,
          degree: edu.degreeName,
          field: edu.fieldOfStudy,
          startYear: edu.startEndDate?.start?.year,
          endYear: edu.startEndDate?.end?.year,
        })),
        skills: data.skills || [],
        companyInfo: result.company ? {
          name: result.company.name,
          industry: result.company.industry,
          employeeCount: result.company.employeeCount,
          websiteUrl: result.company.websiteUrl,
          description: result.company.description,
        } : undefined,
      });
    } catch (error) {
      logger.error('ScrapIn scraping failed', { error });
      return null;
    }
  }

  /**
   * Scrape via ScrapingBee API (if configured)
   */
  private async scrapeViaScrapingBee(url: string): Promise<string | null> {
    const apiKey = process.env.SCRAPINGBEE_API_KEY;
    if (!apiKey) {
      logger.debug('ScrapingBee not configured');
      return null;
    }

    try {
      logger.info('Trying ScrapingBee for LinkedIn', { url });
      const apiUrl = `https://app.scrapingbee.com/api/v1/?api_key=${apiKey}&url=${encodeURIComponent(url)}&render_js=true&premium_proxy=true`;

      const response = await fetch(apiUrl, { method: 'GET' });

      if (!response.ok) {
        logger.warn('ScrapingBee request failed', { status: response.status });
        return null;
      }

      const html = await response.text();
      logger.info('LinkedIn scraped via ScrapingBee', { contentLength: html.length });
      return this.cleanHtml(html);
    } catch (error) {
      logger.error('ScrapingBee scraping failed', { error });
      return null;
    }
  }

  /**
   * Scrape via web scraper proxy
   */
  private async scrapeViaWebScraper(url: string): Promise<string | null> {
    try {
      // Try using a CORS proxy or web scraper service
      const proxyUrls = [
        `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
        `https://corsproxy.io/?${encodeURIComponent(url)}`,
      ];

      for (const proxyUrl of proxyUrls) {
        try {
          const response = await fetch(proxyUrl, {
            method: 'GET',
            headers: {
              'Accept': 'text/html',
            },
          });

          if (response.ok) {
            const html = await response.text();
            if (html.length > 1000 && !html.includes('authwall')) {
              logger.info('LinkedIn scraped via proxy', { proxy: proxyUrl.split('?')[0], contentLength: html.length });
              return this.cleanHtml(html);
            }
          }
        } catch (e) {
          continue;
        }
      }

      return null;
    } catch (error) {
      logger.error('Proxy scraping failed', { error });
      return null;
    }
  }

  /**
   * Direct scraping with enhanced headers
   */
  private async scrapeDirectly(url: string): Promise<string | null> {
    // Try multiple user agents in order (Facebook bot is most reliable for LinkedIn)
    const userAgents = [
      'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
      'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
      'Twitterbot/1.0',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    ];

    for (const userAgent of userAgents) {
      try {
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'User-Agent': userAgent,
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache',
          },
          redirect: 'follow',
        });

        if (!response.ok) {
          logger.warn('Direct LinkedIn fetch failed with agent', { status: response.status, userAgent: userAgent.substring(0, 30), url });
          continue;
        }

        const html = await response.text();

        // Check if we got blocked or redirected to auth wall
        if (html.includes('authwall') || (html.includes('login') && html.length < 5000)) {
          logger.warn('LinkedIn returned auth wall', { userAgent: userAgent.substring(0, 30) });
          continue;
        }

        if (html.length < 2000) {
          logger.warn('LinkedIn response too small, likely blocked', { contentLength: html.length, userAgent: userAgent.substring(0, 30) });
          continue;
        }

        logger.info('LinkedIn scraped directly', { contentLength: html.length, userAgent: userAgent.substring(0, 30) });
        return this.cleanHtml(html);
      } catch (error) {
        logger.warn('Direct scraping attempt failed', { error, userAgent: userAgent.substring(0, 30), url });
        continue;
      }
    }

    logger.error('Direct scraping failed with all user agents', { url });
    return null;
  }

  /**
   * Extract structured data from LinkedIn HTML (JSON-LD, meta tags, embedded JSON)
   * and prepend it to cleaned HTML for better AI extraction
   */
  private cleanHtml(html: string): string {
    const structuredParts: string[] = [];

    // 1. Extract JSON-LD data (contains rich profile info)
    const jsonLdMatches = html.match(/<script[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
    if (jsonLdMatches) {
      for (const match of jsonLdMatches) {
        const content = match.replace(/<script[^>]*>/i, '').replace(/<\/script>/i, '').trim();
        if (content.includes('Person') || content.includes('name') || content.includes('jobTitle')) {
          structuredParts.push(`[JSON-LD DATA]: ${content}`);
        }
      }
    }

    // 2. Extract Open Graph meta tags
    const ogMatches = html.match(/<meta[^>]*property\s*=\s*["']og:[^"']*["'][^>]*>/gi);
    if (ogMatches) {
      const ogData: string[] = [];
      for (const match of ogMatches) {
        const propMatch = match.match(/property\s*=\s*["']([^"']*)["']/i);
        const contentMatch = match.match(/content\s*=\s*["']([^"']*)["']/i);
        if (propMatch && contentMatch) {
          ogData.push(`${propMatch[1]}: ${contentMatch[1]}`);
        }
      }
      if (ogData.length > 0) {
        structuredParts.push(`[META TAGS]: ${ogData.join(' | ')}`);
      }
    }

    // 3. Extract title tag
    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    if (titleMatch) {
      structuredParts.push(`[PAGE TITLE]: ${titleMatch[1].trim()}`);
    }

    // 4. Clean the HTML body
    const cleaned = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, '')
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/<svg[^>]*>[\s\S]*?<\/svg>/gi, '')
      .replace(/\s+/g, ' ')
      .trim();

    // Prepend structured data so AI sees it first
    if (structuredParts.length > 0) {
      return structuredParts.join('\n\n') + '\n\n[HTML CONTENT]:\n' + cleaned;
    }

    return cleaned;
  }

  /**
   * Analyze CV text with AI (OpenAI GPT-4o preferred, Groq as fallback)
   */
  private async analyzeCVWithAI(cvText: string): Promise<any> {
    // Use OpenAI GPT-4o if available (better quality), otherwise fall back to Groq
    const useOpenAI = !!this.openaiApiKey;
    const apiKey = useOpenAI ? this.openaiApiKey : this.groqApiKey;
    const endpoint = useOpenAI ? this.openaiEndpoint : this.groqEndpoint;
    const model = useOpenAI ? this.openaiModel : this.groqModel;

    logger.info('CV analysis starting', {
      openaiKeyAvailable: !!this.openaiApiKey,
      groqKeyAvailable: !!this.groqApiKey,
      useOpenAI,
      selectedModel: model,
      apiKeyLength: apiKey?.length || 0,
    });

    if (!apiKey) {
      logger.warn('No AI API configured, skipping CV analysis');
      return null;
    }

    logger.info(`Analyzing CV with ${useOpenAI ? 'OpenAI GPT-4o' : 'Groq'}`);

    // Detect language of the CV
    const arabicPattern = /[\u0600-\u06FF]/;
    const hasArabic = arabicPattern.test(cvText);
    const arabicCharCount = (cvText.match(/[\u0600-\u06FF]/g) || []).length;
    const totalCharCount = cvText.replace(/\s/g, '').length;
    const isArabicCV = arabicCharCount > totalCharCount * 0.3; // More than 30% Arabic characters

    // Log the CV text being analyzed
    logger.info('Analyzing CV with AI', {
      cvTextLength: cvText.length,
      cvTextPreview: cvText.substring(0, 500),
      cvTextEnd: cvText.substring(Math.max(0, cvText.length - 200)),
      detectedLanguage: isArabicCV ? 'Arabic' : 'English',
      arabicCharRatio: arabicCharCount / totalCharCount,
    });

    try {
      // For summary/bio: keep original language
      // For sectors, skills, interests, hobbies: ALWAYS use English for database matching
      const summaryLanguageInstruction = isArabicCV
        ? `For the "summary" field: Write in Arabic (same language as the CV).`
        : `For the "summary" field: Write in the same language as the CV.`;

      const prompt = `Analyze this CV/resume and extract ONLY information that is EXPLICITLY stated in the document.

LANGUAGE RULES:
${summaryLanguageInstruction}
CRITICAL: For "sectors", "skills", "interests", and "hobbies" arrays - ALWAYS write in ENGLISH, even if the CV is in Arabic. Translate these items to English for standardization.

STRICT RULES:
1. ONLY extract information that is DIRECTLY written in the CV - DO NOT invent, assume, or add ANYTHING
2. If a field is not found in the CV, set it to null or empty array []
3. For sectors/skills/interests/hobbies: TRANSLATE to English if CV is in another language
4. Do NOT add skills, interests, or hobbies that are not explicitly mentioned
5. Do NOT make assumptions about the person's interests or hobbies

Return a JSON object:
{
  "fullName": "Exact full name as written in CV, or null if not found",
  "firstName": "First name, or null",
  "lastName": "Last name, or null",
  "company": "Current/most recent company EXACTLY as written, or null",
  "jobTitle": "Current/most recent job title EXACTLY as written, or null",
  "location": "Full location as written in CV, or null",
  "city": "City name extracted from location, or null",
  "country": "Country name extracted from location, or null",
  "email": "Email if found, or null",
  "phone": "Phone if found, or null",
  "linkedInUrl": "LinkedIn URL if found, or null",
  "twitterUrl": "Twitter/X URL if found, or null",
  "summary": "Create a DETAILED professional summary (4-6 sentences) based ONLY on what's in the CV. Include: current role, years of experience, key achievements, main skills, education highlights, and career focus. Use the SAME LANGUAGE as the CV.",
  "sectors": ["Sectors/industries in ENGLISH - translate if CV is not in English"],
  "skills": ["Skills in ENGLISH - translate if CV is not in English"],
  "interests": ["Professional interests in ENGLISH - translate if CV is not in English"],
  "hobbies": ["Hobbies in ENGLISH - translate if CV is not in English"],
  "experience": [{"company": "Company name", "title": "Job title", "duration": "Duration", "description": "Key responsibilities if mentioned"}],
  "education": [{"school": "School name", "degree": "Degree", "field": "Field of study"}],
  "certifications": ["List any certifications mentioned"],
  "languages": ["Languages mentioned with proficiency if stated"],
  "achievements": ["Key achievements or awards mentioned"]
}

IMPORTANT FOR SUMMARY:
- Write a comprehensive bio (4-6 sentences) summarizing the person's career
- Include specific details: job title, company, years of experience, key skills
- Mention notable achievements, certifications, or education
- Use the SAME LANGUAGE as the CV (Arabic if CV is Arabic)
- Base it ONLY on actual CV content - do not add generic phrases

IMPORTANT FOR SECTORS/SKILLS/INTERESTS/HOBBIES:
- MUST be in English for database matching
- If CV is in Arabic, translate these items to their English equivalents
- Example: "تكنولوجيا المعلومات" → "Information Technology"
- Example: "إدارة المشاريع" → "Project Management"

CV Text:
${cvText.substring(0, 10000)}

Return ONLY valid JSON.`;

      logger.info('Making AI request for CV analysis', {
        provider: useOpenAI ? 'OpenAI' : 'Groq',
        model: model,
        endpoint: endpoint,
        promptLength: prompt.length,
      });

      // Add timeout controller for the fetch request
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 120000); // 2 minute timeout

      let response;
      try {
        response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: model,
            messages: [
              {
                role: 'system',
                content: `You are an expert CV/resume parser. Extract ONLY information that is EXPLICITLY written in the CV. NEVER invent or assume information. ${isArabicCV ? 'The CV is in Arabic - write the summary in Arabic, but ALWAYS write sectors, skills, interests, and hobbies in ENGLISH for database matching.' : 'Respond in the same language as the CV.'} Always respond with valid JSON only.`,
              },
              {
                role: 'user',
                content: prompt,
              },
            ],
            temperature: 0.1, // Lower temperature for more accurate extraction
            max_tokens: 4000,
            ...(useOpenAI ? {} : { response_format: { type: 'json_object' } }),
          }),
          signal: controller.signal,
        });
      } catch (fetchError: any) {
        clearTimeout(timeoutId);
        if (fetchError.name === 'AbortError') {
          logger.error('AI request timed out after 2 minutes');
          throw new Error('AI request timed out');
        }
        logger.error('Fetch error during AI request', {
          name: fetchError.name,
          message: fetchError.message,
          cause: fetchError.cause?.message || fetchError.cause,
        });
        throw fetchError;
      }
      clearTimeout(timeoutId);

      logger.info('AI response received', {
        provider: useOpenAI ? 'OpenAI' : 'Groq',
        status: response.status,
        ok: response.ok,
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error('AI API error response', { status: response.status, error: errorText });
        throw new Error(`${useOpenAI ? 'OpenAI' : 'Groq'} API error: ${response.status} - ${errorText}`);
      }

      const responseText = await response.text();
      logger.info('AI response text received', { responseLength: responseText.length, preview: responseText.substring(0, 200) });

      let data: GroqResponse;
      try {
        data = JSON.parse(responseText) as GroqResponse;
      } catch (parseError) {
        logger.error('Failed to parse AI response as JSON', { responseText: responseText.substring(0, 500) });
        throw new Error('Failed to parse AI response as JSON');
      }

      const content = data.choices?.[0]?.message?.content;

      if (!content) {
        logger.error('No content in AI response', { data: JSON.stringify(data).substring(0, 500) });
        throw new Error(`No content in ${useOpenAI ? 'OpenAI' : 'Groq'} response`);
      }

      logger.info('AI content extracted', { contentLength: content.length, preview: content.substring(0, 300) });

      // Parse JSON from response content
      let parsed;
      // First, try to remove markdown code blocks if present
      let cleanedContent = content.trim();
      // Remove ```json and ``` markers
      if (cleanedContent.startsWith('```')) {
        cleanedContent = cleanedContent.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
      }

      try {
        // Try to parse the cleaned content directly
        parsed = JSON.parse(cleanedContent);
        logger.info('JSON parsed successfully from cleaned content');
      } catch (e) {
        // If parsing fails, try to extract JSON from the content
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          try {
            parsed = JSON.parse(jsonMatch[0]);
            logger.info('JSON parsed successfully using regex extraction');
          } catch (e2) {
            logger.error('Failed to parse extracted JSON', {
              extracted: jsonMatch[0].substring(0, 500),
              error: e2 instanceof Error ? e2.message : String(e2)
            });
            throw new Error('Failed to parse CV analysis content as JSON');
          }
        } else {
          logger.error('Failed to parse content as JSON and no JSON object found', { content: content.substring(0, 500) });
          throw new Error('Failed to parse CV analysis content as JSON');
        }
      }
      logger.info('CV analyzed with AI - full result', {
        rawContent: content.substring(0, 1000),
        fullName: parsed.fullName,
        company: parsed.company,
        jobTitle: parsed.jobTitle,
        location: parsed.location,
        email: parsed.email,
        phone: parsed.phone,
        summary: parsed.summary?.substring(0, 200),
        sectors: parsed.sectors,
        skills: parsed.skills?.slice(0, 10),
        detectedLanguage: isArabicCV ? 'Arabic' : 'English',
      });
      return parsed;
    } catch (error) {
      // Properly serialize the error for logging
      const errorDetails = error instanceof Error
        ? { message: error.message, name: error.name, stack: error.stack?.split('\n').slice(0, 3).join('\n') }
        : String(error);
      logger.error('CV analysis with AI failed', { error: errorDetails });
      return null;
    }
  }

  /**
   * Get existing sectors, skills, interests, and hobbies from database
   */
  private async getExistingSectorsSkillsInterestsHobbies() {
    const [sectors, skills, interests, hobbies] = await Promise.all([
      prisma.sector.findMany({ where: { isActive: true } }),
      prisma.skill.findMany({ where: { isActive: true } }),
      prisma.interest.findMany({ where: { isActive: true } }),
      prisma.hobby.findMany({ where: { isActive: true } }),
    ]);

    return { sectors, skills, interests, hobbies };
  }

  /**
   * Deduplicate array with case-insensitive comparison
   */
  private deduplicateArray(arr: string[]): string[] {
    const seen = new Set<string>();
    const result: string[] = [];
    for (const item of arr) {
      if (!item) continue;
      const normalized = item.toLowerCase().trim();
      if (!seen.has(normalized)) {
        seen.add(normalized);
        result.push(item.trim()); // Keep original case but trimmed
      }
    }
    return result;
  }

  /**
   * Parse a location string into city and country components.
   * Handles formats: "City, Country", "City - Country", "City / Country", or single token.
   */
  private parseLocationComponents(location: string): { city: string; country: string } {
    if (!location) return { city: '', country: '' };

    const trimmed = location.trim();

    // Try splitting on common delimiters: ", " then " - " then " / "
    for (const delimiter of [', ', ' - ', ' / ']) {
      if (trimmed.includes(delimiter)) {
        const parts = trimmed.split(delimiter).map(p => p.trim()).filter(Boolean);
        if (parts.length >= 2) {
          return { city: parts[0], country: parts[parts.length - 1] };
        }
      }
    }

    // Single token — assign to city as default (more common in CVs)
    return { city: trimmed, country: '' };
  }

  /**
   * Merge profile data from multiple sources
   */
  /**
   * Check if a web search value is actually valid (not a "not found" placeholder)
   */
  private isValidWebSearchValue(value: any): boolean {
    if (!value || typeof value !== 'string') return false;
    const lower = value.toLowerCase().trim();
    const invalidPatterns = [
      'not found', 'n/a', 'null', 'undefined', 'unknown', 'none',
      'not available', 'not specified', 'not provided', 'no data',
      'unverified', 'cv info unverified', 'no verifiable', 'no information',
      'unable to verify', 'unable to determine', 'unable to find',
      'could not be verified', 'could not be determined', 'could not find',
      'no public', 'no reliable', 'no specific', 'not publicly',
      'cannot be confirmed', 'cannot confirm', 'no confirmed',
      'no verified', 'no matching', 'not confirmed', 'not verified',
    ];
    return !invalidPatterns.some(pattern => lower.includes(pattern));
  }

  private mergeProfileData(linkedInData: any, cvData: any, userBio?: string, webSearchData?: any) {
    // Priority: Web Search (most current) > LinkedIn > CV > User provided
    // But only use web search values if they are actually valid (not "Not found" placeholders)
    const validWebCompany = this.isValidWebSearchValue(webSearchData?.currentCompany) ? webSearchData.currentCompany : undefined;
    const validWebTitle = this.isValidWebSearchValue(webSearchData?.currentTitle) ? webSearchData.currentTitle : undefined;
    const validWebLocation = this.isValidWebSearchValue(webSearchData?.location) ? webSearchData.location : undefined;
    const validWebName = this.isValidWebSearchValue(webSearchData?.verifiedName) ? webSearchData.verifiedName : undefined;
    const validWebLinkedIn = this.isValidWebSearchValue(webSearchData?.linkedInUrl) ? webSearchData.linkedInUrl : undefined;
    const validWebTwitter = this.isValidWebSearchValue(webSearchData?.twitterUrl) ? webSearchData.twitterUrl : undefined;
    const validWebWebsite = this.isValidWebSearchValue(webSearchData?.websiteUrl) ? webSearchData.websiteUrl : undefined;
    const validWebBio = this.isValidWebSearchValue(webSearchData?.bio) ? webSearchData.bio : undefined;

    // Collect all sectors from multiple sources
    const linkedInSectors = [
      ...(linkedInData?._sectors || []),
      ...(linkedInData?.industry ? [linkedInData.industry] : []),
    ];

    const allSectors = [
      ...linkedInSectors,
      ...(cvData?.sectors || []),
    ];
    const allSkills = [
      ...(linkedInData?.skills || []),
      ...(cvData?.skills || []),
      ...(webSearchData?.additionalSkills || []),
    ];
    const allInterests = [
      ...(linkedInData?.interests || []),
      ...(cvData?.interests || []),
    ];
    const allHobbies = [
      ...(linkedInData?.hobbies || []),
      ...(cvData?.hobbies || []),
    ];

    // Merge location fields
    const mergedLocation = validWebLocation || linkedInData?.location || cvData?.location;
    let mergedCity = linkedInData?.city || cvData?.city;
    let mergedCountry = linkedInData?.country || cvData?.country;

    // Fallback: if city/country are empty but location exists, parse the location string
    if (!mergedCity && !mergedCountry && mergedLocation) {
      const parsed = this.parseLocationComponents(mergedLocation);
      mergedCity = parsed.city;
      mergedCountry = parsed.country;
    }

    return {
      fullName: validWebName || linkedInData?.fullName || cvData?.fullName,
      firstName: linkedInData?.firstName || cvData?.firstName,
      lastName: linkedInData?.lastName || cvData?.lastName,
      // Web search data is most current, so prioritize it for company/title
      // But only if the web search actually found valid data (not "Not found" placeholders)
      company: validWebCompany || linkedInData?.company || cvData?.company,
      jobTitle: validWebTitle || linkedInData?.jobTitle || cvData?.jobTitle,
      location: mergedLocation,
      country: mergedCountry,
      city: mergedCity,
      email: cvData?.email || linkedInData?.emails?.[0],
      phone: cvData?.phone || linkedInData?.phoneNumbers?.[0],
      bio: userBio || validWebBio || linkedInData?.bio || cvData?.summary,
      // LinkedIn URL - use web search if found
      linkedInUrl: validWebLinkedIn || linkedInData?.linkedinUrl || linkedInData?.linkedInUrl || cvData?.linkedInUrl,
      twitterUrl: validWebTwitter || cvData?.twitterUrl || linkedInData?.twitterUrl,
      websiteUrl: validWebWebsite,
      // Additional fields from LinkedIn
      pictureUrl: linkedInData?.pictureUrl,
      totalExperience: linkedInData?.totalExperience,
      connections: linkedInData?.connections,
      followers: linkedInData?.followers,
      experience: linkedInData?.experience || cvData?.experience,
      education: linkedInData?.education || cvData?.education || webSearchData?.education,
      certifications: cvData?.certifications,
      achievements: cvData?.achievements || webSearchData?.achievements,
      languages: cvData?.languages,
      recentNews: webSearchData?.recentNews,
      webSources: webSearchData?.sources,
      // Deduplicate all arrays
      extractedSectors: this.deduplicateArray(allSectors),
      extractedSkills: this.deduplicateArray(allSkills),
      extractedInterests: this.deduplicateArray(allInterests),
      extractedHobbies: this.deduplicateArray(allHobbies),
    };
  }

  /**
   * Generate professional bio using AI (OpenAI preferred, Groq fallback)
   */
  private async generateBio(
    profile: any,
    linkedInData: any,
    cvData: any,
    locale?: string,
    webSearchData?: any
  ): Promise<{ summary?: string; full?: string } | undefined> {
    // Use OpenAI if available for better quality bios
    const useOpenAI = !!this.openaiApiKey;
    const apiKey = useOpenAI ? this.openaiApiKey : this.groqApiKey;
    const endpoint = useOpenAI ? this.openaiEndpoint : this.groqEndpoint;
    const model = useOpenAI ? this.openaiModel : this.groqModel;

    if (!apiKey) {
      return undefined;
    }

    try {
      // Detect language from CV summary or profile data
      const textToCheck = cvData?.summary || profile.fullName || '';
      const arabicPattern = /[\u0600-\u06FF]/;
      const hasArabicContent = arabicPattern.test(textToCheck);
      const isArabic = locale === 'ar' || hasArabicContent;

      // Build VERY comprehensive context with ALL available data including web search
      const context = {
        name: profile.fullName,
        company: profile.company,
        jobTitle: profile.jobTitle,
        location: profile.location,
        email: profile.email,
        phone: profile.phone,
        skills: profile.extractedSkills || cvData?.skills,
        sectors: profile.extractedSectors || cvData?.sectors,
        interests: profile.extractedInterests || cvData?.interests,
        hobbies: cvData?.hobbies,
        experience: cvData?.experience,
        education: cvData?.education || webSearchData?.education,
        certifications: cvData?.certifications,
        achievements: cvData?.achievements || webSearchData?.achievements,
        languages: cvData?.languages,
        summary: linkedInData?.bio || cvData?.summary,
        // Web search enhancements
        linkedInUrl: profile.linkedInUrl,
        twitterUrl: profile.twitterUrl,
        websiteUrl: profile.websiteUrl,
        recentNews: webSearchData?.recentNews,
        additionalSkillsFromWeb: webSearchData?.additionalSkills,
        webBio: webSearchData?.bio,
      };

      // Generate FULL comprehensive bio - include EVERYTHING
      const fullPrompt = isArabic
        ? `قم بإنشاء نبذة مهنية شاملة ومفصلة جداً لهذا الشخص للتواصل المهني.

الملف الشخصي الكامل مع كل البيانات المتاحة:
${JSON.stringify(context, null, 2)}

أنشئ نبذة مهنية شاملة ومفصلة جداً (15-25 جملة) تتضمن كل ما يلي:

1. **المقدمة**: الاسم الكامل والمنصب الحالي والشركة والموقع
2. **ملخص الخبرة**: سنوات الخبرة الإجمالية ومجالات التخصص الرئيسية
3. **الخبرة المهنية الكاملة**: وصف تفصيلي لكل خبرة عمل - اسم الشركة، المسمى الوظيفي، الفترة، والمسؤوليات الرئيسية
4. **المهارات التقنية**: قائمة شاملة بجميع المهارات التقنية (البرمجة، الأدوات، التقنيات)
5. **المهارات الإدارية والقيادية**: مهارات الإدارة والقيادة والتواصل
6. **التعليم الكامل**: جميع الدرجات العلمية، الجامعات، التخصصات، سنوات التخرج
7. **الشهادات المهنية**: كل الشهادات والدورات التدريبية المعتمدة
8. **الإنجازات والجوائز**: أبرز الإنجازات المهنية والجوائز والتكريمات
9. **اللغات**: اللغات التي يتقنها مع مستوى الإتقان
10. **القطاعات والصناعات**: جميع القطاعات التي عمل بها
11. **الاهتمامات المهنية**: المجالات التي يهتم بها والتطوير المستقبلي
12. **الهوايات**: الهوايات والاهتمامات الشخصية إن وجدت
${context.recentNews ? '13. **الأخبار الحديثة**: أي أخبار أو إنجازات حديثة' : ''}

هام جداً:
- استخدم جميع المعلومات المتوفرة بدون استثناء
- اذكر أسماء الشركات والمؤسسات التعليمية بالتحديد
- اذكر المهارات والشهادات بأسمائها الكاملة
- اجعل النبذة غنية جداً بالتفاصيل والمعلومات
- أعد النبذة باللغة العربية فقط، بدون علامات اقتباس أو تنسيق`
        : `Generate a VERY COMPREHENSIVE and EXTREMELY DETAILED professional bio for this person.

ALL Available Profile Data:
${JSON.stringify(context, null, 2)}

Create an EXTENSIVE professional bio (15-25 sentences) that includes EVERYTHING from the following:

1. **Introduction**: Full name, current role, company, and location
2. **Experience Summary**: Total years of experience and main areas of expertise
3. **Complete Work History**: Detailed description of EACH work experience - company name, job title, duration, and key responsibilities/achievements
4. **Technical Skills**: Complete list of ALL technical skills (programming, tools, technologies)
5. **Management & Leadership**: Management, leadership, and soft skills
6. **Complete Education**: ALL degrees, universities, fields of study, graduation years
7. **Professional Certifications**: ALL certifications and accredited training courses
8. **Achievements & Awards**: Notable professional achievements, awards, and recognitions
9. **Languages**: Languages spoken/written with proficiency levels
10. **Industries & Sectors**: ALL industries and domains of expertise
11. **Professional Interests**: Areas of interest and future career goals
12. **Hobbies & Personal Interests**: Any hobbies or personal interests if available
${context.recentNews ? '13. **Recent News**: Any recent news or achievements found online' : ''}

CRITICAL REQUIREMENTS:
- Include EVERY piece of information provided - leave NOTHING out
- Mention SPECIFIC company names, educational institutions, dates
- List skills, certifications, and achievements BY NAME
- Include ALL work experience entries with details
- Make it EXTREMELY rich with details and information
- This bio should be comprehensive enough to fully introduce this person professionally

Return ONLY the bio text, no quotes or markdown formatting.`;

      const fullResponse = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: model,
          messages: [
            {
              role: 'system',
              content: isArabic
                ? 'أنت خبير في كتابة النبذات المهنية الشاملة والمفصلة. اكتب نبذة تفصيلية جداً تتضمن كل المعلومات المتاحة بدون استثناء باللغة العربية.'
                : 'You are an expert at writing comprehensive, detailed professional bios. Your job is to include EVERY piece of information provided to create the most complete and detailed biography possible.',
            },
            {
              role: 'user',
              content: fullPrompt,
            },
          ],
          temperature: 0.4,
          max_tokens: 2500,
        }),
      });

      if (!fullResponse.ok) {
        throw new Error(`${useOpenAI ? 'OpenAI' : 'Groq'} API error: ${fullResponse.status}`);
      }

      const fullData = await fullResponse.json() as GroqResponse;
      const fullBio = fullData.choices?.[0]?.message?.content?.trim();

      // Generate MEDIUM summary bio (longer than before - 4-6 sentences)
      const summaryPrompt = isArabic
        ? `قم بإنشاء ملخص مهني لهذا الشخص (4-6 جمل، حوالي 400-500 حرف).

الملف الشخصي:
${JSON.stringify({
  name: context.name,
  company: context.company,
  jobTitle: context.jobTitle,
  skills: context.skills?.slice(0, 8),
  experience: context.experience?.slice(0, 2),
  education: context.education?.slice(0, 1),
  certifications: context.certifications?.slice(0, 3),
  summary: context.summary
}, null, 2)}

أنشئ ملخصاً مهنياً يتضمن:
- المنصب الحالي والشركة والموقع
- أهم المهارات والتخصصات (4-5 مهارات)
- أبرز الخبرات السابقة إن وجدت
- المؤهلات التعليمية أو الشهادات المهمة
- سنوات الخبرة إن ذكرت

استخدم المعلومات المتوفرة فقط.
أعد الملخص باللغة العربية فقط، 4-6 جمل.`
        : `Generate a professional summary for this person (4-6 sentences, about 400-500 characters).

Profile:
${JSON.stringify({
  name: context.name,
  company: context.company,
  jobTitle: context.jobTitle,
  skills: context.skills?.slice(0, 8),
  experience: context.experience?.slice(0, 2),
  education: context.education?.slice(0, 1),
  certifications: context.certifications?.slice(0, 3),
  summary: context.summary
}, null, 2)}

Create a professional summary including:
- Current role, company, and location
- Key skills and expertise (4-5 skills)
- Notable previous experience if available
- Important education or certifications
- Years of experience if mentioned

Use ONLY the information provided.
Return ONLY the summary text, 4-6 sentences.`;

      const summaryResponse = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: model,
          messages: [
            {
              role: 'system',
              content: isArabic
                ? 'أنت خبير في كتابة الملخصات المهنية. اكتب ملخصاً مهنياً شاملاً ولكن موجزاً.'
                : 'You are an expert at writing professional summaries. Create a comprehensive but concise summary.',
            },
            {
              role: 'user',
              content: summaryPrompt,
            },
          ],
          temperature: 0.5,
          max_tokens: 200,
        }),
      });

      let summaryBio: string | undefined;
      if (summaryResponse.ok) {
        const summaryData = await summaryResponse.json() as GroqResponse;
        summaryBio = summaryData.choices?.[0]?.message?.content?.trim();
      }

      if (fullBio || summaryBio) {
        logger.info('Bio generated with AI', {
          isArabic,
          fullBioLength: fullBio?.length || 0,
          summaryBioLength: summaryBio?.length || 0
        });
        return {
          summary: summaryBio,
          full: fullBio,
        };
      }
    } catch (error) {
      logger.error('Bio generation failed', { error });
    }

    return undefined;
  }

  /**
   * Match extracted sectors with existing database sectors
   */
  private async matchSectors(
    extractedSectors: string[],
    existingSectors: any[],
    detectedLang: string = 'en'
  ): Promise<SuggestedItem[]> {
    const useOpenAI = !!this.openaiApiKey;
    const apiKey = useOpenAI ? this.openaiApiKey : this.groqApiKey;
    const endpoint = useOpenAI ? this.openaiEndpoint : this.groqEndpoint;
    const model = useOpenAI ? this.openaiModel : this.groqModel;

    if (!apiKey || extractedSectors.length === 0) {
      return [];
    }

    try {
      const existingSectorNames = existingSectors.map(s => s.name);

      const prompt = `Match these extracted sectors with the EXACT or very close options from our database.

Extracted sectors: ${JSON.stringify(extractedSectors)}

Available database options: ${JSON.stringify(existingSectorNames)}

For each extracted sector:
1. Find the EXACT match or very close match (>80% similar) from the available list
2. If the extracted sector name already exists in the database list (exact or near-exact match), use it with high confidence
3. If no good match exists, mark it as custom with isCustom: true
4. Do NOT force-match to unrelated sectors. It's better to mark as custom than to pick a wrong match.

Return a JSON object with a "matches" array:
{
  "matches": [
    {"extracted": "original text", "matched": "exact database option name or null if custom", "isCustom": false, "confidence": 0.95}
  ]
}

CRITICAL RULES:
- The matches array must contain NO DUPLICATES in the "matched" field
- Only match if the sector names are genuinely the same concept (e.g. "Software Development" matches "Software Development")
- Do NOT match "Software Development" to "Animation" or other unrelated sectors`;

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: model,
          messages: [
            {
              role: 'system',
              content: 'You are an expert at matching industry sectors. Always respond with valid JSON.',
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
          temperature: 0.2,
          max_tokens: 1000,
          ...(useOpenAI ? {} : { response_format: { type: 'json_object' } }),
        }),
      });

      if (!response.ok) {
        throw new Error(`Groq API error: ${response.status}`);
      }

      const data = await response.json() as GroqResponse;
      const content = data.choices?.[0]?.message?.content;

      if (!content) {
        return [];
      }

      const parsed = JSON.parse(content);
      const matches = parsed.matches || [];

      logger.info('Sector matching result', {
        extractedCount: extractedSectors.length,
        matchedCount: matches.length,
        matches: matches.slice(0, 5),
      });

      // Deduplicate matches by both name AND ID to prevent duplicates
      const seenIds = new Set<string>();
      const seenNames = new Set<string>();
      const deduplicatedMatches: any[] = [];

      for (const match of matches) {
        // Find the existing sector for this match
        const existing = match.matched ? existingSectors.find((s: any) =>
          s.name.toLowerCase() === match.matched.toLowerCase()
        ) : null;

        // Determine the ID and standardized name
        const isCustom = match.isCustom || !match.matched || !existing;
        const id = isCustom
          ? `custom_${match.extracted.toLowerCase().replace(/\s+/g, '_')}`
          : existing.id;
        const name = isCustom ? match.extracted.trim() : existing.name; // Use DB name for standardization
        const nameKey = name.toLowerCase().trim();

        // Skip if we've already seen this ID or name
        if (seenIds.has(id) || seenNames.has(nameKey)) {
          continue;
        }

        seenIds.add(id);
        seenNames.add(nameKey);

        deduplicatedMatches.push({
          ...match,
          _existing: existing,
          _isCustom: isCustom,
          _id: id,
          _name: name,
        });
      }

      const result = deduplicatedMatches.map((match: any) => {
        if (match._isCustom) {
          // For custom items, set both name and nameAr based on detected language
          return {
            id: match._id,
            name: match._name,
            nameAr: undefined, // Custom items are extracted in English for database matching
            isCustom: true,
            confidence: match.confidence || 0.85,
          };
        }

        return {
          id: match._existing.id,
          name: match._existing.name, // Use standardized DB name
          nameAr: match._existing.nameAr,
          isCustom: false,
          confidence: match.confidence || 0.9,
        };
      });

      logger.info('Sector matching complete', {
        originalCount: matches.length,
        deduplicatedCount: result.length
      });
      return result;
    } catch (error) {
      logger.error('Sector matching failed', { error });
      return [];
    }
  }

  /**
   * Match extracted skills with existing database skills
   */
  private async matchSkills(
    extractedSkills: string[],
    existingSkills: any[],
    detectedLang: string = 'en'
  ): Promise<SuggestedItem[]> {
    const useOpenAI = !!this.openaiApiKey;
    const apiKey = useOpenAI ? this.openaiApiKey : this.groqApiKey;
    const endpoint = useOpenAI ? this.openaiEndpoint : this.groqEndpoint;
    const model = useOpenAI ? this.openaiModel : this.groqModel;

    if (!apiKey || extractedSkills.length === 0) {
      return [];
    }

    try {
      const existingSkillNames = existingSkills.map(s => s.name);

      const prompt = `Match these extracted skills with the closest options from our database.

Extracted skills: ${JSON.stringify(extractedSkills.slice(0, 30))}

Available options: ${JSON.stringify(existingSkillNames)}

For each extracted skill:
1. Find the best matching option from the available list
2. If no good match exists, mark it as custom
3. IMPORTANT: Do NOT return duplicate matches - if multiple extracted skills match the same database option, only include it ONCE

Return a JSON object with a "matches" array:
{
  "matches": [
    {"extracted": "original text", "matched": "matched option or null", "isCustom": false, "confidence": 0.95}
  ]
}

CRITICAL: The matches array must contain NO DUPLICATES in the "matched" field. Each database skill should appear at most once.`;

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: model,
          messages: [
            {
              role: 'system',
              content: 'You are an expert at matching professional skills. Always respond with valid JSON.',
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
          temperature: 0.2,
          max_tokens: 2000,
          ...(useOpenAI ? {} : { response_format: { type: 'json_object' } }),
        }),
      });

      if (!response.ok) {
        throw new Error(`AI API error: ${response.status}`);
      }

      const data = await response.json() as GroqResponse;
      const content = data.choices?.[0]?.message?.content;

      if (!content) {
        return [];
      }

      const parsed = JSON.parse(content);
      const matches = parsed.matches || [];

      // Deduplicate matches by both name AND ID to prevent duplicates
      const seenIds = new Set<string>();
      const seenNames = new Set<string>();
      const deduplicatedMatches: any[] = [];

      for (const match of matches) {
        const existing = match.matched ? existingSkills.find((s: any) =>
          s.name.toLowerCase() === match.matched.toLowerCase()
        ) : null;

        const isCustom = match.isCustom || !match.matched || !existing;
        const id = isCustom
          ? `custom_${match.extracted.toLowerCase().replace(/\s+/g, '_')}`
          : existing.id;
        const name = isCustom ? match.extracted.trim() : existing.name;
        const nameKey = name.toLowerCase().trim();

        if (seenIds.has(id) || seenNames.has(nameKey)) {
          continue;
        }

        seenIds.add(id);
        seenNames.add(nameKey);

        deduplicatedMatches.push({
          ...match,
          _existing: existing,
          _isCustom: isCustom,
          _id: id,
          _name: name,
        });
      }

      return deduplicatedMatches.map((match: any) => {
        if (match._isCustom) {
          // Custom items are now always extracted in English for database matching
          return {
            id: match._id,
            name: match._name,
            nameAr: undefined, // No Arabic name for custom items (extracted in English)
            isCustom: true,
            confidence: match.confidence || 0.85,
          };
        }

        return {
          id: match._existing.id,
          name: match._existing.name,
          nameAr: match._existing.nameAr,
          isCustom: false,
          confidence: match.confidence || 0.9,
        };
      }).slice(0, 20); // Limit to 20 skills
    } catch (error) {
      logger.error('Skill matching failed', { error });
      return [];
    }
  }

  /**
   * Match extracted interests with existing database interests
   */
  private async matchInterests(
    extractedInterests: string[],
    existingInterests: any[],
    detectedLang: string = 'en'
  ): Promise<SuggestedItem[]> {
    const useOpenAI = !!this.openaiApiKey;
    const apiKey = useOpenAI ? this.openaiApiKey : this.groqApiKey;
    const endpoint = useOpenAI ? this.openaiEndpoint : this.groqEndpoint;
    const model = useOpenAI ? this.openaiModel : this.groqModel;

    if (!apiKey || extractedInterests.length === 0) {
      return [];
    }

    try {
      const existingInterestNames = existingInterests.map(i => i.name);

      const prompt = `Match these extracted professional interests with the closest options from our database.

Extracted interests: ${JSON.stringify(extractedInterests.slice(0, 20))}

Available options: ${JSON.stringify(existingInterestNames)}

For each extracted interest:
1. Find the best matching option from the available list
2. If no good match exists, mark it as custom
3. IMPORTANT: Do NOT return duplicate matches - if multiple extracted interests match the same database option, only include it ONCE

Return a JSON object with a "matches" array:
{
  "matches": [
    {"extracted": "original text", "matched": "matched option or null", "isCustom": false, "confidence": 0.95}
  ]
}

CRITICAL: The matches array must contain NO DUPLICATES in the "matched" field. Each database interest should appear at most once.`;

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: model,
          messages: [
            {
              role: 'system',
              content: 'You are an expert at matching professional interests. Always respond with valid JSON.',
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
          temperature: 0.2,
          max_tokens: 1000,
          ...(useOpenAI ? {} : { response_format: { type: 'json_object' } }),
        }),
      });

      if (!response.ok) {
        throw new Error(`AI API error: ${response.status}`);
      }

      const data = await response.json() as GroqResponse;
      const content = data.choices?.[0]?.message?.content;

      if (!content) {
        return [];
      }

      const parsed = JSON.parse(content);
      const matches = parsed.matches || [];

      // Deduplicate matches by both name AND ID to prevent duplicates
      const seenIds = new Set<string>();
      const seenNames = new Set<string>();
      const deduplicatedMatches: any[] = [];

      for (const match of matches) {
        const existing = match.matched ? existingInterests.find((i: any) =>
          i.name.toLowerCase() === match.matched.toLowerCase()
        ) : null;

        const isCustom = match.isCustom || !match.matched || !existing;
        const id = isCustom
          ? `custom_${match.extracted.toLowerCase().replace(/\s+/g, '_')}`
          : existing.id;
        const name = isCustom ? match.extracted.trim() : existing.name;
        const nameKey = name.toLowerCase().trim();

        if (seenIds.has(id) || seenNames.has(nameKey)) {
          continue;
        }

        seenIds.add(id);
        seenNames.add(nameKey);

        deduplicatedMatches.push({
          ...match,
          _existing: existing,
          _isCustom: isCustom,
          _id: id,
          _name: name,
        });
      }

      return deduplicatedMatches.map((match: any) => {
        if (match._isCustom) {
          return {
            id: match._id,
            name: match._name,
            nameAr: undefined, // Custom items are extracted in English for database matching
            isCustom: true,
            confidence: match.confidence || 0.85,
          };
        }

        return {
          id: match._existing.id,
          name: match._existing.name,
          nameAr: match._existing.nameAr,
          isCustom: false,
          confidence: match.confidence || 0.9,
        };
      }).slice(0, 15); // Limit to 15 interests
    } catch (error) {
      logger.error('Interest matching failed', { error });
      return [];
    }
  }

  /**
   * Match extracted hobbies with existing database hobbies
   */
  private async matchHobbies(
    extractedHobbies: string[],
    existingHobbies: any[],
    detectedLang: string = 'en'
  ): Promise<SuggestedItem[]> {
    const useOpenAI = !!this.openaiApiKey;
    const apiKey = useOpenAI ? this.openaiApiKey : this.groqApiKey;
    const endpoint = useOpenAI ? this.openaiEndpoint : this.groqEndpoint;
    const model = useOpenAI ? this.openaiModel : this.groqModel;

    if (!apiKey || extractedHobbies.length === 0) {
      return [];
    }

    try {
      const existingHobbyNames = existingHobbies.map(h => h.name);

      const prompt = `Match these extracted hobbies with the closest options from our database.

Extracted hobbies: ${JSON.stringify(extractedHobbies.slice(0, 20))}

Available options: ${JSON.stringify(existingHobbyNames)}

For each extracted hobby:
1. Find the best matching option from the available list
2. If no good match exists, mark it as custom
3. IMPORTANT: Do NOT return duplicate matches - if multiple extracted hobbies match the same database option, only include it ONCE

Return a JSON object with a "matches" array:
{
  "matches": [
    {"extracted": "original text", "matched": "matched option or null", "isCustom": false, "confidence": 0.95}
  ]
}

CRITICAL: The matches array must contain NO DUPLICATES in the "matched" field. Each database hobby should appear at most once.`;

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: model,
          messages: [
            {
              role: 'system',
              content: 'You are an expert at matching hobbies and leisure activities. Always respond with valid JSON.',
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
          temperature: 0.2,
          max_tokens: 1000,
          ...(useOpenAI ? {} : { response_format: { type: 'json_object' } }),
        }),
      });

      if (!response.ok) {
        throw new Error(`AI API error: ${response.status}`);
      }

      const data = await response.json() as GroqResponse;
      const content = data.choices?.[0]?.message?.content;

      if (!content) {
        return [];
      }

      const parsed = JSON.parse(content);
      const matches = parsed.matches || [];

      // Deduplicate matches by both name AND ID to prevent duplicates
      const seenIds = new Set<string>();
      const seenNames = new Set<string>();
      const deduplicatedMatches: any[] = [];

      for (const match of matches) {
        const existing = match.matched ? existingHobbies.find((h: any) =>
          h.name.toLowerCase() === match.matched.toLowerCase()
        ) : null;

        const isCustom = match.isCustom || !match.matched || !existing;
        const id = isCustom
          ? `custom_${match.extracted.toLowerCase().replace(/\s+/g, '_')}`
          : existing.id;
        const name = isCustom ? match.extracted.trim() : existing.name;
        const nameKey = name.toLowerCase().trim();

        if (seenIds.has(id) || seenNames.has(nameKey)) {
          continue;
        }

        seenIds.add(id);
        seenNames.add(nameKey);

        deduplicatedMatches.push({
          ...match,
          _existing: existing,
          _isCustom: isCustom,
          _id: id,
          _name: name,
        });
      }

      return deduplicatedMatches.map((match: any) => {
        if (match._isCustom) {
          return {
            id: match._id,
            name: match._name,
            nameAr: undefined, // Custom items are extracted in English for database matching
            isCustom: true,
            confidence: match.confidence || 0.85,
          };
        }

        return {
          id: match._existing.id,
          name: match._existing.name,
          nameAr: match._existing.nameAr,
          isCustom: false,
          confidence: match.confidence || 0.9,
        };
      }).slice(0, 15); // Limit to 15 hobbies
    } catch (error) {
      logger.error('Hobby matching failed', { error });
      return [];
    }
  }

  /**
   * Suggest networking goals based on profile and CV
   */
  private async suggestGoals(profile: any, cvData: any): Promise<SuggestedGoal[]> {
    // Available goals
    const GOALS = [
      { id: 'FIND_MENTOR', name: 'Find a Mentor', description: 'Connect with experienced professionals' },
      { id: 'FIND_PARTNER', name: 'Find Business Partners', description: 'Collaborate on projects or ventures' },
      { id: 'FIND_INVESTOR', name: 'Find Investors', description: 'Secure funding for your projects' },
      { id: 'FIND_TALENT', name: 'Find Talent', description: 'Recruit skilled professionals' },
      { id: 'EXPAND_NETWORK', name: 'Expand Network', description: 'Grow your professional connections' },
      { id: 'FIND_CLIENTS', name: 'Find Clients', description: 'Acquire new business opportunities' },
    ];

    const useOpenAI = !!this.openaiApiKey;
    const apiKey = useOpenAI ? this.openaiApiKey : this.groqApiKey;
    const endpoint = useOpenAI ? this.openaiEndpoint : this.groqEndpoint;
    const model = useOpenAI ? this.openaiModel : this.groqModel;

    if (!apiKey || (!profile.jobTitle && !cvData)) {
      // Return all goals with low confidence if no data
      return GOALS.map(g => ({ ...g, confidence: 0.3 }));
    }

    try {
      const context = {
        jobTitle: profile.jobTitle,
        company: profile.company,
        skills: profile.extractedSkills?.slice(0, 10),
        experience: cvData?.experience?.slice(0, 3),
        summary: cvData?.summary,
      };

      const prompt = `Based on this professional profile, suggest the most relevant networking goals.

Profile:
${JSON.stringify(context, null, 2)}

Available goals:
${GOALS.map(g => `- ${g.id}: ${g.name} - ${g.description}`).join('\n')}

For each goal, assign a confidence score (0-1) based on how relevant it is for this person.
Consider:
- Senior roles often seek talent/clients
- Junior roles often seek mentors/network expansion
- Entrepreneurs seek investors/partners
- Sales/BD roles seek clients

Return a JSON object:
{
  "goals": [
    {"id": "GOAL_ID", "confidence": 0.9}
  ]
}

Return ALL goals with their confidence scores.`;

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: model,
          messages: [
            {
              role: 'system',
              content: 'You are an expert at understanding professional networking needs. Always respond with valid JSON.',
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
          temperature: 0.3,
          max_tokens: 500,
          ...(useOpenAI ? {} : { response_format: { type: 'json_object' } }),
        }),
      });

      if (!response.ok) {
        throw new Error(`AI API error: ${response.status}`);
      }

      const data = await response.json() as GroqResponse;
      const content = data.choices?.[0]?.message?.content;

      if (!content) {
        return GOALS.map(g => ({ ...g, confidence: 0.3 }));
      }

      const parsed = JSON.parse(content);
      const goalScores = parsed.goals || [];

      logger.info('Goal suggestion result', { goalScores });

      // Map scores to goals
      return GOALS.map(goal => {
        const score = goalScores.find((g: any) => g.id === goal.id);
        return {
          ...goal,
          confidence: score?.confidence || 0.3,
        };
      }).sort((a, b) => b.confidence - a.confidence);
    } catch (error) {
      logger.error('Goal suggestion failed', { error });
      return GOALS.map(g => ({ ...g, confidence: 0.3 }));
    }
  }

  /**
   * Search using Google Custom Search API
   * Returns snippets and URLs from Google search results
   */
  private async searchWithGoogleCSE(
    name: string,
    company?: string,
    jobTitle?: string
  ): Promise<{ snippets: string[]; urls: string[]; linkedInUrl?: string }> {
    if (!this.googleCseApiKey || !this.googleCseCx) {
      return { snippets: [], urls: [] };
    }

    const snippets: string[] = [];
    const urls: string[] = [];

    try {
      // Build search queries - prioritize LinkedIn and Wikipedia
      const queries = [
        `"${name}" site:linkedin.com/in/`,
        company ? `"${name}" "${company}" site:linkedin.com` : null,
        `"${name}" site:wikipedia.org`,
        company ? `"${name}" "${company}" profile` : `"${name}" professional profile`,
        jobTitle ? `"${name}" "${jobTitle}" LinkedIn` : null,
        company ? `"${name}" "${company}" CEO OR founder OR director` : null,
      ].filter(Boolean) as string[];

      logger.info('Starting Google CSE search for enrichment', { name, company, queriesCount: queries.length });

      // Google CSE response type
      interface GoogleCSEItem {
        title?: string;
        link?: string;
        snippet?: string;
      }
      interface GoogleCSEResponse {
        items?: GoogleCSEItem[];
      }

      // Run queries in parallel (up to 5 for better coverage)
      const searchPromises = queries.slice(0, 5).map(async (query): Promise<GoogleCSEResponse> => {
        const url = `https://www.googleapis.com/customsearch/v1?key=${this.googleCseApiKey}&cx=${this.googleCseCx}&q=${encodeURIComponent(query)}&num=10`;
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

      // Find LinkedIn URL - prioritize exact profile URLs
      const linkedInUrl = linkedInUrls[0] || urls.find(u => u.includes('linkedin.com/in/'));

      logger.info('Google CSE search completed for enrichment', {
        name,
        snippetsFound: snippets.length,
        urlsFound: urls.length,
        linkedInUrlsFound: linkedInUrls.length,
        wikipediaUrlsFound: wikipediaUrls.length,
        linkedInUrl: linkedInUrl || 'not found',
      });

      return { snippets, urls, linkedInUrl };
    } catch (error) {
      logger.error('Google CSE search error', { error });
      return { snippets: [], urls: [] };
    }
  }

  /**
   * Analyze Google search results with GPT to extract profile data
   */
  private async analyzeGoogleResultsWithAI(
    name: string,
    company: string | undefined,
    jobTitle: string | undefined,
    googleSnippets: string[],
    googleUrls: string[]
  ): Promise<any> {
    if (!this.openaiApiKey || googleSnippets.length === 0) {
      return null;
    }

    const linkedInUrl = googleUrls.find(u => u.includes('linkedin.com/in/'));

    // Identify LinkedIn and Wikipedia snippets for prioritization
    const linkedInSnippets = googleSnippets.filter((s, i) =>
      googleUrls[i]?.includes('linkedin.com')
    );
    const wikipediaSnippets = googleSnippets.filter((s, i) =>
      googleUrls[i]?.includes('wikipedia.org')
    );

    const prompt = `Analyze these search results and extract a COMPREHENSIVE profile. PRIORITIZE LinkedIn and Wikipedia data.

PERSON:
Name: ${name}
${company ? `Company: ${company}` : ''}
${jobTitle ? `Job Title: ${jobTitle}` : ''}

=== LINKEDIN DATA (PRIMARY SOURCE - USE THIS FIRST) ===
${linkedInSnippets.length > 0 ? linkedInSnippets.slice(0, 4).join('\n') : 'No LinkedIn snippets found'}

=== WIKIPEDIA DATA (SECONDARY SOURCE) ===
${wikipediaSnippets.length > 0 ? wikipediaSnippets.slice(0, 3).join('\n') : 'No Wikipedia snippets found'}

=== OTHER SEARCH RESULTS ===
${googleSnippets.filter((s, i) => !googleUrls[i]?.includes('linkedin.com') && !googleUrls[i]?.includes('wikipedia.org')).slice(0, 5).map((s, i) => `${i + 1}. ${s}`).join('\n')}

=== URLS FOUND ===
${googleUrls.slice(0, 8).join('\n')}

EXTRACT:
1. **Bio**: 3-4 sentences from LinkedIn about/summary OR Wikipedia. Include their role, company, expertise. NO URLs, NO citations.
2. **Sectors**: Specific industries based on ${company || 'their company'} (NOT generic like "Business")
3. **Skills**: From LinkedIn skills section if found, otherwise based on their role
4. **Interests**: Professional topics they follow based on their work
5. **LinkedIn URL**: EXACT profile URL (linkedin.com/in/username) from URLs above
6. **Location**: City, Country from LinkedIn or Wikipedia

Return ONLY valid JSON:
{
  "bio": "3-4 sentence professional bio from LinkedIn/Wikipedia. NO URLs, NO citations, NO employee counts.",
  "sectors": ["4-5 SPECIFIC industry sectors"],
  "skills": ["8-10 skills, prioritize LinkedIn skills if found"],
  "interests": ["5-6 professional interests"],
  "linkedInUrl": "${linkedInUrl || 'exact URL from above or null'}",
  "location": "City, Country or null",
  "additionalSkills": ["Additional skills from search results"]
}`;

    try {
      const response = await fetch(this.openaiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.openaiApiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: 'You are a professional researcher. Extract factual information from search results. Always respond with valid JSON only.' },
            { role: 'user', content: prompt },
          ],
          temperature: 0.2,
          max_tokens: 1000,
        }),
      });

      if (!response.ok) {
        return null;
      }

      const data = await response.json() as GroqResponse;
      let content = data.choices?.[0]?.message?.content;

      if (!content) return null;

      // Remove markdown code blocks
      content = content.trim();
      if (content.startsWith('```json')) content = content.slice(7);
      if (content.startsWith('```')) content = content.slice(3);
      if (content.endsWith('```')) content = content.slice(0, -3);

      const parsed = JSON.parse(content.trim());
      logger.info('Google results analyzed with AI', {
        name,
        hasBio: !!parsed.bio,
        sectorsCount: parsed.sectors?.length || 0,
        skillsCount: parsed.skills?.length || 0,
      });

      return parsed;
    } catch (error) {
      logger.error('Failed to analyze Google results', { error });
      return null;
    }
  }

  /**
   * Search for a person online using Perplexity web search + Google CSE
   * This provides real-time data from the internet to enhance CV data
   */
  private async searchPersonOnline(
    name: string,
    company?: string,
    jobTitle?: string
  ): Promise<any> {
    // First try Google CSE search (faster, more reliable)
    const googleResults = await this.searchWithGoogleCSE(name, company, jobTitle);

    // Analyze Google results with AI if we have snippets
    let googleAnalysis = null;
    if (googleResults.snippets.length > 0) {
      googleAnalysis = await this.analyzeGoogleResultsWithAI(
        name,
        company,
        jobTitle,
        googleResults.snippets,
        googleResults.urls
      );
    }

    // If Perplexity is not configured, return Google analysis
    if (!this.perplexityApiKey) {
      if (googleAnalysis) {
        logger.info('Using Google CSE analysis (Perplexity not configured)', { name });
        return {
          ...googleAnalysis,
          linkedInUrl: googleAnalysis.linkedInUrl || googleResults.linkedInUrl,
          sources: googleResults.urls.slice(0, 5),
        };
      }
      logger.warn('No web search configured, skipping web search enhancement');
      return null;
    }

    try {
      const searchQuery = [name, company, jobTitle].filter(Boolean).join(' ');

      const prompt = `Search the internet for the LATEST information about this person (as of today, January 2025):

Name: ${name}
${company ? `Company: ${company}` : ''}
${jobTitle ? `Job Title: ${jobTitle}` : ''}

Find and return:
1. Their CURRENT job and company (verify if the CV info is up-to-date)
2. LinkedIn profile URL
3. Twitter/X profile URL
4. Company website
5. Recent news, articles, or mentions
6. Additional skills or expertise mentioned online
7. Recent achievements or awards
8. Professional interests and activities

Return a JSON object:
{
  "verifiedName": "Full name as found online",
  "currentCompany": "Their current company (may differ from CV)",
  "currentTitle": "Their current job title",
  "location": "Location if found",
  "linkedInUrl": "LinkedIn URL if found",
  "twitterUrl": "Twitter/X URL if found",
  "websiteUrl": "Personal or company website",
  "additionalSkills": ["Skills mentioned online not in CV"],
  "recentNews": ["Recent news or mentions"],
  "achievements": ["Awards, recognitions, notable achievements"],
  "education": ["Education details found online"],
  "bio": "Brief bio from their online profiles",
  "sources": ["URLs where info was found"]
}

Return ONLY valid JSON.`;

      const response = await fetch(this.perplexityEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.perplexityApiKey}`,
        },
        body: JSON.stringify({
          model: 'sonar-pro',
          messages: [
            {
              role: 'system',
              content: 'You are a professional researcher with web search access. Search the internet for current, verified information about people. Return only factual data you find online.',
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
          temperature: 0.1,
          max_tokens: 2000,
          return_citations: true,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error('Perplexity web search failed', { status: response.status, error: errorText });
        // Fall back to Google analysis if Perplexity fails
        if (googleAnalysis) {
          logger.info('Falling back to Google CSE analysis', { name });
          return {
            ...googleAnalysis,
            linkedInUrl: googleAnalysis.linkedInUrl || googleResults.linkedInUrl,
            sources: googleResults.urls.slice(0, 5),
          };
        }
        return null;
      }

      const data = await response.json() as GroqResponse;
      const content = data.choices?.[0]?.message?.content;

      if (!content) {
        // Fall back to Google analysis
        if (googleAnalysis) {
          return {
            ...googleAnalysis,
            linkedInUrl: googleAnalysis.linkedInUrl || googleResults.linkedInUrl,
            sources: googleResults.urls.slice(0, 5),
          };
        }
        return null;
      }

      // Parse JSON from response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);

        // Merge Perplexity results with Google results for best coverage
        const mergedResult = {
          ...parsed,
          // Prefer Perplexity LinkedIn, fall back to Google
          linkedInUrl: parsed.linkedInUrl || googleResults.linkedInUrl || googleAnalysis?.linkedInUrl,
          // Merge additional skills from both sources
          additionalSkills: [
            ...(parsed.additionalSkills || []),
            ...(googleAnalysis?.additionalSkills || []),
            ...(googleAnalysis?.skills || []),
          ].filter((v, i, a) => a.indexOf(v) === i).slice(0, 10),
          // Merge sources
          sources: [
            ...(parsed.sources || []),
            ...googleResults.urls.slice(0, 3),
          ].filter((v, i, a) => a.indexOf(v) === i),
          // Use bio from Perplexity or Google
          bio: parsed.bio || googleAnalysis?.bio,
        };

        logger.info('Web search enhancement completed (Perplexity + Google)', {
          name,
          foundLinkedIn: !!mergedResult.linkedInUrl,
          foundTwitter: !!mergedResult.twitterUrl,
          additionalSkills: mergedResult.additionalSkills?.length || 0,
          sources: mergedResult.sources?.length || 0,
        });
        return mergedResult;
      }
    } catch (error) {
      logger.error('Web search enhancement failed', { error });
      // Fall back to Google analysis on error
      if (googleAnalysis) {
        return {
          ...googleAnalysis,
          linkedInUrl: googleAnalysis.linkedInUrl || googleResults.linkedInUrl,
          sources: googleResults.urls.slice(0, 5),
        };
      }
    }

    return null;
  }

  /**
   * Check if service is available
   */
  async isAvailable(): Promise<boolean> {
    return !!(this.openaiApiKey || this.groqApiKey || await this.pdlService.isAvailable());
  }
}
