/**
 * Enrichment Service Interface
 *
 * Defines the contract for contact/profile enrichment services.
 * Implementations can use People Data Labs or other enrichment providers.
 *
 * @module domain/services/IEnrichmentService
 */

/**
 * Person enrichment input
 */
export interface EnrichmentInput {
  /** Email address (most reliable identifier) */
  email?: string;

  /** Full name */
  name?: string;

  /** Company name */
  company?: string;

  /** LinkedIn URL */
  linkedInUrl?: string;

  /** Phone number */
  phone?: string;

  /** Location */
  location?: string;
}

/**
 * Employment history entry
 */
export interface EmploymentEntry {
  /** Company name */
  company: string;

  /** Job title */
  title?: string;

  /** Start date */
  startDate?: string;

  /** End date (null if current) */
  endDate?: string | null;

  /** Is current position */
  isCurrent: boolean;

  /** Company size */
  companySize?: string;

  /** Company industry */
  companyIndustry?: string;

  /** Company LinkedIn URL */
  companyLinkedInUrl?: string;
}

/**
 * Education entry
 */
export interface EducationEntry {
  /** School name */
  school: string;

  /** Degree */
  degree?: string;

  /** Field of study */
  fieldOfStudy?: string;

  /** Graduation year */
  graduationYear?: number;
}

/**
 * Social profile link
 */
export interface SocialProfile {
  /** Platform name */
  platform: 'linkedin' | 'twitter' | 'facebook' | 'github' | 'other';

  /** Profile URL */
  url: string;

  /** Username/handle */
  username?: string;
}

/**
 * Enriched person data
 */
export interface EnrichedPersonData {
  /** Full name */
  fullName?: string;

  /** First name */
  firstName?: string;

  /** Last name */
  lastName?: string;

  /** Current job title */
  jobTitle?: string;

  /** Current company */
  company?: string;

  /** Industry */
  industry?: string;

  /** Job title level (e.g., 'director', 'vp', 'c_suite') */
  jobTitleLevel?: string;

  /** Location */
  location?: string;

  /** Country */
  country?: string;

  /** Skills list */
  skills?: string[];

  /** Interests */
  interests?: string[];

  /** Employment history */
  employmentHistory?: EmploymentEntry[];

  /** Education history */
  education?: EducationEntry[];

  /** Social profiles */
  socialProfiles?: SocialProfile[];

  /** LinkedIn URL */
  linkedInUrl?: string;

  /** Twitter URL */
  twitterUrl?: string;

  /** GitHub URL */
  githubUrl?: string;

  /** Personal website */
  websiteUrl?: string;

  /** Phone numbers */
  phoneNumbers?: string[];

  /** Email addresses */
  emails?: string[];

  /** Bio/summary */
  bio?: string;

  /** Profile picture URL */
  profilePictureUrl?: string;

  /** Gender */
  gender?: string;

  /** Birth year */
  birthYear?: number;
}

/**
 * Enrichment result
 */
export interface EnrichmentResult {
  /** Whether enrichment was successful */
  success: boolean;

  /** Enriched data (if successful) */
  data?: EnrichedPersonData;

  /** Match likelihood score (0-10) */
  likelihood?: number;

  /** Source of enrichment */
  source: 'pdl' | 'clearbit' | 'fullcontact' | 'manual';

  /** Error message (if failed) */
  error?: string;

  /** Processing time in milliseconds */
  processingTimeMs: number;

  /** Credits/cost used for this enrichment */
  creditsUsed?: number;
}

/**
 * Company enrichment data
 */
export interface EnrichedCompanyData {
  /** Company name */
  name: string;

  /** Industry */
  industry?: string;

  /** Company size (employee count range) */
  size?: string;

  /** Founded year */
  foundedYear?: number;

  /** Headquarters location */
  location?: string;

  /** Company website */
  website?: string;

  /** LinkedIn URL */
  linkedInUrl?: string;

  /** Description */
  description?: string;

  /** Company type (public, private, nonprofit) */
  type?: string;

  /** Specialties/tags */
  specialties?: string[];
}

/**
 * Enrichment Service Interface
 *
 * Strategy pattern interface for enrichment implementations.
 * Allows swapping between different enrichment providers.
 */
export interface IEnrichmentService {
  /**
   * Enrich a person's profile with public data
   *
   * @param input - Input data for enrichment
   * @returns Enriched person data
   */
  enrichPerson(input: EnrichmentInput): Promise<EnrichmentResult>;

  /**
   * Enrich a company's profile
   *
   * @param companyName - Company name to enrich
   * @param website - Optional website for better matching
   * @returns Enriched company data
   */
  enrichCompany(companyName: string, website?: string): Promise<{
    success: boolean;
    data?: EnrichedCompanyData;
    error?: string;
  }>;

  /**
   * Check if the service is available and configured
   *
   * @returns True if service can process requests
   */
  isAvailable(): Promise<boolean>;

  /**
   * Get remaining API credits
   *
   * @returns Credits remaining or null if unlimited/unknown
   */
  getRemainingCredits(): Promise<number | null>;
}
