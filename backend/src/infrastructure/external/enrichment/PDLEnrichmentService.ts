/**
 * People Data Labs Enrichment Service
 *
 * Enriches contact profiles with public professional data using PDL API.
 * Provides employment history, social profiles, skills, and more.
 *
 * @module infrastructure/external/enrichment/PDLEnrichmentService
 */

import {
  IEnrichmentService,
  EnrichmentInput,
  EnrichmentResult,
  EnrichedPersonData,
  EnrichedCompanyData,
  EmploymentEntry,
  EducationEntry,
  SocialProfile,
} from '../../../domain/services/IEnrichmentService';
import { logger } from '../../../shared/logger';
import { config } from '../../../config';

/**
 * PDL API Response types
 */
interface PDLPersonResponse {
  status: number;
  likelihood: number;
  data: {
    id?: string;
    full_name?: string;
    first_name?: string;
    last_name?: string;
    middle_name?: string;
    gender?: string;
    birth_year?: number;
    birth_date?: string;
    linkedin_url?: string;
    linkedin_username?: string;
    twitter_url?: string;
    twitter_username?: string;
    github_url?: string;
    github_username?: string;
    facebook_url?: string;
    facebook_username?: string;
    work_email?: string;
    personal_emails?: string[];
    mobile_phone?: string;
    industry?: string;
    job_title?: string;
    job_title_role?: string;
    job_title_sub_role?: string;
    job_title_levels?: string[];
    job_company_name?: string;
    job_company_size?: string;
    job_company_industry?: string;
    job_company_linkedin_url?: string;
    job_company_website?: string;
    job_start_date?: string;
    location_name?: string;
    location_country?: string;
    location_region?: string;
    location_locality?: string;
    skills?: string[];
    interests?: string[];
    experience?: Array<{
      company?: {
        name?: string;
        size?: string;
        industry?: string;
        linkedin_url?: string;
        website?: string;
      };
      title?: {
        name?: string;
        role?: string;
        levels?: string[];
      };
      start_date?: string;
      end_date?: string;
      is_primary?: boolean;
    }>;
    education?: Array<{
      school?: {
        name?: string;
        type?: string;
        linkedin_url?: string;
      };
      degrees?: string[];
      majors?: string[];
      start_date?: string;
      end_date?: string;
    }>;
    profiles?: Array<{
      network?: string;
      url?: string;
      username?: string;
    }>;
    summary?: string;
  };
}

interface PDLCompanyResponse {
  status: number;
  data: {
    name?: string;
    display_name?: string;
    size?: string;
    employee_count?: number;
    industry?: string;
    founded?: number;
    location?: {
      name?: string;
      country?: string;
    };
    website?: string;
    linkedin_url?: string;
    twitter_url?: string;
    facebook_url?: string;
    summary?: string;
    tags?: string[];
    type?: string;
  };
}

/**
 * People Data Labs Enrichment Service
 *
 * Uses PDL's Person Enrichment API for contact data enrichment.
 * Requires PDL API key configured in environment.
 */
export class PDLEnrichmentService implements IEnrichmentService {
  private apiKey: string | undefined;
  private baseUrl = 'https://api.peopledatalabs.com/v5';

  constructor() {
    this.apiKey = config.ai.pdl.apiKey;

    if (this.apiKey) {
      logger.info('PDL Enrichment service configured');
    } else {
      logger.warn('PDL Enrichment service not configured - missing API key');
    }
  }

  /**
   * Check if PDL service is available
   */
  async isAvailable(): Promise<boolean> {
    if (!this.apiKey) {
      logger.warn('PDL service not available - no API key configured');
      return false;
    }

    try {
      // Test with a simple API call to the enrich endpoint
      // Without required params, it returns 400 which confirms API key is valid
      const response = await fetch(`${this.baseUrl}/person/enrich`, {
        method: 'GET',
        headers: {
          'X-Api-Key': this.apiKey,
        },
      });

      // 400 = API working, missing params (expected)
      // 401 = Invalid API key
      // 200 = Unexpected but valid
      if (response.status === 400 || response.ok) {
        logger.info('PDL service is available');
        return true;
      }

      if (response.status === 401) {
        logger.error('PDL API key is invalid');
        return false;
      }

      const errorText = await response.text();
      logger.error('PDL availability check unexpected response', {
        status: response.status,
        error: errorText,
      });
      return false;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('PDL availability check failed', { error: errorMessage });
      return false;
    }
  }

  /**
   * Get remaining API credits
   */
  async getRemainingCredits(): Promise<number | null> {
    // PDL doesn't provide a simple credits endpoint
    // Would need to check dashboard or billing API
    return null;
  }

  /**
   * Enrich a person's profile with PDL data
   */
  async enrichPerson(input: EnrichmentInput): Promise<EnrichmentResult> {
    if (!this.apiKey) {
      return {
        success: false,
        error: 'PDL service not configured',
        source: 'pdl',
        processingTimeMs: 0,
      };
    }

    const startTime = Date.now();

    try {
      // Build query parameters
      const params = new URLSearchParams();

      if (input.email) {
        params.append('email', input.email);
      }
      if (input.linkedInUrl) {
        params.append('profile', input.linkedInUrl);
      }
      if (input.name && input.company) {
        params.append('name', input.name);
        params.append('company', input.company);
      }
      if (input.phone) {
        params.append('phone', input.phone);
      }

      // Minimum likelihood threshold
      params.append('min_likelihood', '6');

      // Request all available data
      params.append('required', 'full_name');

      const response = await fetch(
        `${this.baseUrl}/person/enrich?${params.toString()}`,
        {
          method: 'GET',
          headers: {
            'X-Api-Key': this.apiKey,
            'Content-Type': 'application/json',
          },
        }
      );

      const processingTimeMs = Date.now() - startTime;

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({})) as { error?: { message?: string } };

        if (response.status === 404) {
          return {
            success: false,
            error: 'No matching profile found',
            source: 'pdl',
            processingTimeMs,
          };
        }

        return {
          success: false,
          error: errorData.error?.message || `PDL API error: ${response.status}`,
          source: 'pdl',
          processingTimeMs,
        };
      }

      const result = await response.json() as PDLPersonResponse;

      if (result.status !== 200 || !result.data) {
        return {
          success: false,
          error: 'No data returned from PDL',
          source: 'pdl',
          processingTimeMs,
        };
      }

      // Transform PDL response to our format
      const enrichedData = this.transformPersonData(result.data);

      return {
        success: true,
        data: enrichedData,
        likelihood: result.likelihood,
        source: 'pdl',
        processingTimeMs,
        creditsUsed: 1,
      };
    } catch (error) {
      logger.error('PDL person enrichment failed', { error, input });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        source: 'pdl',
        processingTimeMs: Date.now() - startTime,
      };
    }
  }

  /**
   * Enrich a company's profile with PDL data
   */
  async enrichCompany(
    companyName: string,
    website?: string
  ): Promise<{
    success: boolean;
    data?: EnrichedCompanyData;
    error?: string;
  }> {
    if (!this.apiKey) {
      return {
        success: false,
        error: 'PDL service not configured',
      };
    }

    try {
      const params = new URLSearchParams();
      params.append('name', companyName);
      if (website) {
        params.append('website', website);
      }

      const response = await fetch(
        `${this.baseUrl}/company/enrich?${params.toString()}`,
        {
          method: 'GET',
          headers: {
            'X-Api-Key': this.apiKey,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        if (response.status === 404) {
          return {
            success: false,
            error: 'No matching company found',
          };
        }
        return {
          success: false,
          error: `PDL API error: ${response.status}`,
        };
      }

      const result = await response.json() as PDLCompanyResponse;

      if (result.status !== 200 || !result.data) {
        return {
          success: false,
          error: 'No data returned from PDL',
        };
      }

      return {
        success: true,
        data: this.transformCompanyData(result.data),
      };
    } catch (error) {
      logger.error('PDL company enrichment failed', { error, companyName });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Transform PDL person data to our format
   */
  private transformPersonData(data: PDLPersonResponse['data']): EnrichedPersonData {
    const enriched: EnrichedPersonData = {
      fullName: data.full_name,
      firstName: data.first_name,
      lastName: data.last_name,
      jobTitle: data.job_title,
      company: data.job_company_name,
      industry: data.industry || data.job_company_industry,
      jobTitleLevel: data.job_title_levels?.[0],
      location: data.location_name,
      country: data.location_country,
      skills: data.skills,
      interests: data.interests,
      linkedInUrl: data.linkedin_url,
      twitterUrl: data.twitter_url,
      githubUrl: data.github_url,
      phoneNumbers: data.mobile_phone ? [data.mobile_phone] : undefined,
      emails: [
        ...(data.work_email ? [data.work_email] : []),
        ...(data.personal_emails || []),
      ].filter(Boolean),
      bio: data.summary,
      gender: data.gender,
      birthYear: data.birth_year,
    };

    // Transform employment history
    if (data.experience && data.experience.length > 0) {
      enriched.employmentHistory = data.experience.map((exp): EmploymentEntry => ({
        company: exp.company?.name || 'Unknown',
        title: exp.title?.name,
        startDate: exp.start_date,
        endDate: exp.end_date || null,
        isCurrent: !exp.end_date,
        companySize: exp.company?.size,
        companyIndustry: exp.company?.industry,
        companyLinkedInUrl: exp.company?.linkedin_url,
      }));
    }

    // Transform education
    if (data.education && data.education.length > 0) {
      enriched.education = data.education.map((edu): EducationEntry => ({
        school: edu.school?.name || 'Unknown',
        degree: edu.degrees?.[0],
        fieldOfStudy: edu.majors?.[0],
        graduationYear: edu.end_date ? parseInt(edu.end_date.split('-')[0]) : undefined,
      }));
    }

    // Transform social profiles
    if (data.profiles && data.profiles.length > 0) {
      enriched.socialProfiles = data.profiles
        .filter((p) => p.url)
        .map((profile): SocialProfile => ({
          platform: this.mapNetworkToPlatform(profile.network || ''),
          url: profile.url!,
          username: profile.username,
        }));
    }

    return enriched;
  }

  /**
   * Transform PDL company data to our format
   */
  private transformCompanyData(data: PDLCompanyResponse['data']): EnrichedCompanyData {
    return {
      name: data.display_name || data.name || 'Unknown',
      industry: data.industry,
      size: data.size,
      foundedYear: data.founded,
      location: data.location?.name,
      website: data.website,
      linkedInUrl: data.linkedin_url,
      description: data.summary,
      type: data.type,
      specialties: data.tags,
    };
  }

  /**
   * Map PDL network name to our platform type
   */
  private mapNetworkToPlatform(network: string): SocialProfile['platform'] {
    const lowerNetwork = network.toLowerCase();
    if (lowerNetwork.includes('linkedin')) return 'linkedin';
    if (lowerNetwork.includes('twitter')) return 'twitter';
    if (lowerNetwork.includes('facebook')) return 'facebook';
    if (lowerNetwork.includes('github')) return 'github';
    return 'other';
  }
}
