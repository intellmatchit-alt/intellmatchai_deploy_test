/**
 * ScrapIn Enrichment Service
 *
 * PRIMARY enrichment pipeline using ScrapIn for LinkedIn data.
 * Includes employment verification and change detection.
 *
 * Pipeline:
 * 1. GPT-4o Vision -> Extract card data (done in route)
 * 2. Google CSE -> Discover LinkedIn URL (if not on card)
 * 3. ScrapIn -> Scrape LinkedIn profile (PRIMARY SOURCE)
 * 4. Perplexity sonar-pro -> Verify ONLY IF card != LinkedIn
 * 5. Cross-validation -> Detect job changes, confidence score
 * 6. Cache (7 days) -> Same person = FREE on repeat
 *
 * @module lib/services/enrichment/ScrapInEnrichmentService
 */

// Types
export interface EnrichmentInput {
  name?: string;
  company?: string;
  jobTitle?: string;
  email?: string;
  phone?: string;
  linkedInUrl?: string;
  location?: string;
}

export interface EmploymentVerification {
  status: 'CURRENT' | 'CHANGED' | 'UNKNOWN' | 'UNVERIFIED';
  cardData?: {
    company?: string;
    jobTitle?: string;
  };
  verifiedData?: {
    company?: string;
    jobTitle?: string;
    source: string;
  };
  changeDetails?: {
    previousCompany?: string;
    newCompany?: string;
    previousTitle?: string;
    newTitle?: string;
    changeDetectedVia: string;
  };
  confidence: {
    overall: number;
    level: 'HIGH' | 'MEDIUM' | 'LOW';
    reasons: string[];
  };
}

export interface EnrichedProfile {
  name?: string;
  company?: string;
  jobTitle?: string;
  email?: string;
  phone?: string;
  linkedInUrl?: string;
  location?: string;
  bio?: string;
  pictureUrl?: string;
  skills?: string[];
  education?: Array<{
    school?: string;
    degree?: string;
    field?: string;
    startYear?: number;
    endYear?: number;
  }>;
  experience?: Array<{
    company?: string;
    title?: string;
    startDate?: string;
    endDate?: string;
    isCurrent?: boolean;
    description?: string;
  }>;
  iceBreakers?: string[];
  employmentVerification: EmploymentVerification;
  warnings?: string[];
  sourcesUsed: string[];
  processingTimeMs: number;
  cacheHit: boolean;
}

// Simple in-memory cache (7 days TTL)
const cache = new Map<string, { data: EnrichedProfile; expiry: number }>();
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/**
 * Generate cache key from input
 */
function generateCacheKey(input: EnrichmentInput): string {
  const normalized = [
    input.name?.toLowerCase().trim(),
    input.email?.toLowerCase().trim(),
    input.linkedInUrl?.toLowerCase().trim(),
    input.company?.toLowerCase().trim(),
  ].filter(Boolean).join('|');
  return `scrapin:${normalized}`;
}

/**
 * Check cache for existing result
 */
function getFromCache(key: string): EnrichedProfile | null {
  const cached = cache.get(key);
  if (cached && cached.expiry > Date.now()) {
    return { ...cached.data, cacheHit: true };
  }
  cache.delete(key);
  return null;
}

/**
 * Store result in cache
 */
function setInCache(key: string, data: EnrichedProfile): void {
  cache.set(key, {
    data,
    expiry: Date.now() + CACHE_TTL_MS,
  });
}

/**
 * Search Google CSE for LinkedIn URL
 */
async function discoverLinkedInUrl(name: string, company?: string): Promise<string | null> {
  const googleApiKey = process.env.GOOGLE_CSE_API_KEY;
  const googleCx = process.env.GOOGLE_CSE_CX;

  if (!googleApiKey || !googleCx) {
    console.log('[ScrapIn] Google CSE not configured, skipping LinkedIn discovery');
    return null;
  }

  try {
    const query = `${name} ${company || ''} site:linkedin.com/in`;
    const url = `https://www.googleapis.com/customsearch/v1?key=${googleApiKey}&cx=${googleCx}&q=${encodeURIComponent(query)}&num=5`;

    const response = await fetch(url);
    if (!response.ok) {
      console.error('[ScrapIn] Google CSE error:', response.status);
      return null;
    }

    const data = await response.json();
    const linkedInItem = data.items?.find((item: any) =>
      item.link?.includes('linkedin.com/in/')
    );

    if (linkedInItem) {
      console.log('[ScrapIn] Found LinkedIn URL via Google CSE:', linkedInItem.link);
      return linkedInItem.link;
    }

    return null;
  } catch (error) {
    console.error('[ScrapIn] Google CSE discovery failed:', error);
    return null;
  }
}

/**
 * Generate Arabic name spelling variations for better search coverage.
 * Arabic names have many valid English transliterations.
 * e.g. "Abedalrhman Habashneh" → "Abdulrahman Habashneh", "Abdelrahman Habashna", etc.
 */
function generateNameVariations(name: string): string[] {
  const variations = new Set<string>();
  variations.add(name);

  const parts = name.split(/\s+/);

  // === Arabic compound first name expansions ===
  // عبد (Abd) compounds: Abedalrhman, Abdulrahman, Abdelrahman, etc.
  const abdPrefixes = ['abd', 'abed', 'abid', 'abdul', 'abdel', 'abdur', 'abdal'];
  const firstLower = parts[0].toLowerCase();
  const rest = parts.slice(1).join(' ');

  // Check if first name starts with an abd- prefix (compound name like Abdulrahman)
  let abdRoot = '';
  for (const prefix of abdPrefixes) {
    if (firstLower.startsWith(prefix) && firstLower.length > prefix.length) {
      abdRoot = parts[0].substring(prefix.length);
      // Remove leading al/el connectors
      abdRoot = abdRoot.replace(/^(al|el)/i, '');
      break;
    }
  }

  if (abdRoot) {
    // Generate variations with different abd- prefixes + the root
    const roots = [abdRoot];
    // Also try with al- connector
    const rootCapitalized = abdRoot.charAt(0).toUpperCase() + abdRoot.slice(1);

    const prefixVariations = [
      `Abdul${rootCapitalized}`,
      `Abdel${rootCapitalized}`,
      `Abd Al-${rootCapitalized}`,
      `Abdal${rootCapitalized}`,
      `Abd ${rootCapitalized}`,
      `Abdul ${rootCapitalized}`,
      `Abdel ${rootCapitalized}`,
    ];

    for (const pv of prefixVariations) {
      const variant = rest ? `${pv} ${rest}` : pv;
      if (variant !== name) variations.add(variant);
    }
  }

  // === Handle "Al" family name prefixes ===
  // Arabic names like Alasasfeh can be written as "Al Asasfeh", "Al-Asasfeh"
  // Try splitting/merging Al prefix in last name parts
  if (parts.length >= 2) {
    const lastName = parts[parts.length - 1];
    const lastLower = lastName.toLowerCase();
    const firstName = parts.slice(0, -1).join(' ');

    // If last name starts with "al" followed by more letters, try splitting it
    if (lastLower.startsWith('al') && lastLower.length > 3) {
      const suffix = lastName.substring(2);
      const suffixCap = suffix.charAt(0).toUpperCase() + suffix.slice(1).toLowerCase();
      variations.add(`${firstName} Al ${suffixCap}`);        // Osama Al Asasfeh
      variations.add(`${firstName} Al-${suffixCap}`);        // Osama Al-Asasfeh
      variations.add(`${firstName} al-${suffix.toLowerCase()}`); // Osama al-asasfeh
    }

    // If last name starts with "el" (Egyptian variant), also try splitting
    if (lastLower.startsWith('el') && lastLower.length > 3) {
      const suffix = lastName.substring(2);
      const suffixCap = suffix.charAt(0).toUpperCase() + suffix.slice(1).toLowerCase();
      variations.add(`${firstName} El ${suffixCap}`);        // Mohamed El Sayed
      variations.add(`${firstName} El-${suffixCap}`);        // Mohamed El-Sayed
    }
  }

  // === Simple letter swaps for last name parts ===
  const swaps: [RegExp, string][] = [
    [/eh\b/gi, 'ah'],   // Asasfeh -> Asasfah
    [/ah\b/gi, 'eh'],   // Asasfah -> Asasfeh
    [/ou/gi, 'u'],       // Moustafa -> Mustafa
    [/u(?=[^aeiou])/gi, 'ou'], // Mustafa -> Moustafa
    [/ee/gi, 'i'],       // Ameen -> Amin
    [/(?<=[^aeiou])i(?=[^aeiou])/gi, 'ee'], // Amin -> Ameen
    [/ph/gi, 'f'],       // not common but handle
    [/q/gi, 'k'],        // Qasem -> Kasem
    [/k(?=[ae])/gi, 'q'], // Kasem -> Qasem
  ];

  // Apply swaps to the full name
  for (const [pattern, replacement] of swaps) {
    const variant = name.replace(pattern, replacement);
    if (variant !== name) variations.add(variant);
  }

  // Also apply swaps to each variation we generated
  const currentVariations = Array.from(variations);
  for (const v of currentVariations) {
    for (const [pattern, replacement] of swaps) {
      const variant = v.replace(pattern, replacement);
      if (variant !== v) variations.add(variant);
    }
  }

  // Limit variations (Jina has better rate limits than Google CSE)
  return Array.from(variations).slice(0, 8);
}

/**
 * Run a single Google CSE query and collect LinkedIn URLs
 */
async function searchCSE(
  query: string,
  googleApiKey: string,
  googleCx: string,
  seen: Set<string>
): Promise<string[]> {
  const url = `https://www.googleapis.com/customsearch/v1?key=${googleApiKey}&cx=${googleCx}&q=${encodeURIComponent(query)}&num=10`;
  const response = await fetch(url);
  if (!response.ok) return [];

  const data = await response.json();
  const urls: string[] = [];

  for (const item of data.items || []) {
    if (item.link?.includes('linkedin.com/in/')) {
      const normalized = item.link.split('?')[0].replace(/\/$/, '');
      if (!seen.has(normalized)) {
        seen.add(normalized);
        urls.push(item.link);
      }
    }
  }
  return urls;
}

/**
 * Search using Jina AI Search API for LinkedIn URLs
 * Free tier available, more reliable than Google CSE
 * Get API key: https://jina.ai/?sui=apikey
 */
async function searchWithJina(
  query: string,
  seen: Set<string>,
  searchPosts: boolean = false
): Promise<string[]> {
  const jinaApiKey = process.env.JINA_API_KEY;
  if (!jinaApiKey) return [];

  try {
    // Search /in/ for profiles, or broader linkedin.com for posts
    const siteFilter = searchPosts ? 'site:linkedin.com' : 'site:linkedin.com/in';
    const fullQuery = `${query} ${siteFilter}`;

    const response = await fetch('https://s.jina.ai/', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${jinaApiKey}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-Respond-With': 'no-content',
      },
      body: JSON.stringify({ q: fullQuery, num: 10 }),
    });

    if (!response.ok) {
      console.error('[Jina] Search API error:', response.status);
      return [];
    }

    const data = await response.json();
    const urls: string[] = [];

    for (const item of data.data || []) {
      const url = item.url;
      if (!url) continue;

      // Direct profile URL
      if (url.includes('linkedin.com/in/')) {
        const normalized = url.split('?')[0].replace(/\/$/, '');
        if (!seen.has(normalized.toLowerCase())) {
          seen.add(normalized.toLowerCase());
          urls.push(normalized);
        }
      }
      // Extract profile from post/article URL
      // e.g., /posts/ali-rodan-phd-fhea-smieee-3852a718_topic... → /in/ali-rodan-phd-fhea-smieee-3852a718
      // Pattern: {username}_{post-details} or {username}-activity-{id}
      else if (url.includes('linkedin.com/posts/') || url.includes('linkedin.com/pulse/')) {
        // Match username up to underscore or -activity
        const match = url.match(/linkedin\.com\/(?:posts|pulse)\/([a-z0-9][a-z0-9-]*[a-z0-9])(?:_|-activity)/i);
        if (match) {
          const profileSlug = match[1];
          const profileUrl = `https://www.linkedin.com/in/${profileSlug}`;
          if (!seen.has(profileUrl.toLowerCase())) {
            seen.add(profileUrl.toLowerCase());
            urls.push(profileUrl);
            console.log(`[Jina] Extracted profile from post: ${profileSlug}`);
          }
        }
      }
    }

    return urls;
  } catch (error) {
    console.error('[Jina] Search failed:', error);
    return [];
  }
}

/**
 * Generate credential-aware search queries for academics/professionals
 */
function generateCredentialQueries(name: string, keywords?: string): string[] {
  const queries: string[] = [name];

  // Common credential patterns to try
  const credentialPatterns = [
    'PhD', 'Dr.', 'Prof.', 'Professor',
    'MD', 'MBA', 'CPA', 'PMP',
    'FHEA', 'SMIEEE', 'IEEE', 'CAIO',
    'Eng.', 'P.Eng', 'PE',
  ];

  // If keywords provided (e.g., "PhD SMIEEE"), add them directly
  if (keywords) {
    queries.push(`${name} ${keywords}`);
  }

  // Try common patterns (limited to avoid too many queries)
  for (const cred of credentialPatterns.slice(0, 3)) {
    queries.push(`${name} ${cred}`);
  }

  return queries;
}

/**
 * Search Google CSE for multiple LinkedIn URLs (up to 5)
 * Tries the original name plus spelling variations for Arabic names.
 */
async function discoverWithGoogleCSE(name: string, company?: string): Promise<{ urls: string[]; error?: string }> {
  const googleApiKey = process.env.GOOGLE_CSE_API_KEY;
  const googleCx = process.env.GOOGLE_CSE_CX;

  if (!googleApiKey || !googleCx) {
    return { urls: [], error: 'not_configured' };
  }

  try {
    const seen = new Set<string>();
    const allUrls: string[] = [];

    // Primary search: quoted name for precision
    const primaryQuery = `"${name}" ${company || ''} site:linkedin.com/in`;
    const primaryUrls = await searchCSE(primaryQuery, googleApiKey, googleCx, seen);
    allUrls.push(...primaryUrls);

    // If not enough results, try unquoted
    if (allUrls.length < 3) {
      const unquotedQuery = `${name} ${company || ''} site:linkedin.com/in`;
      const moreUrls = await searchCSE(unquotedQuery, googleApiKey, googleCx, seen);
      allUrls.push(...moreUrls);
    }

    // If still not enough, try spelling variations
    if (allUrls.length < 2) {
      const variations = generateNameVariations(name);
      for (const variant of variations) {
        if (variant === name) continue;
        if (allUrls.length >= 5) break;
        const variantQuery = `"${variant}" ${company || ''} site:linkedin.com/in`;
        const variantUrls = await searchCSE(variantQuery, googleApiKey, googleCx, seen);
        allUrls.push(...variantUrls);
      }
    }

    return { urls: allUrls.slice(0, 5) };
  } catch (error) {
    console.error('[GoogleCSE] Discovery failed:', error);
    return { urls: [], error: 'exception' };
  }
}

/**
 * Discover LinkedIn URLs using multiple search providers
 * Priority: Jina AI Search (primary) → Google CSE (fallback)
 *
 * Jina AI is preferred because:
 * - Higher rate limits (100 RPM free, 1000 RPM premium)
 * - No daily quota limit like Google CSE (100/day)
 * - Free tier available
 */
export async function discoverLinkedInUrls(name: string, company?: string, keywords?: string, location?: string): Promise<{ urls: string[]; error?: string }> {
  // Try Jina AI Search first (primary)
  const jinaApiKey = process.env.JINA_API_KEY;
  if (jinaApiKey) {
    console.log(`[Discovery] Searching with Jina AI for "${name}"${keywords ? ` (keywords: ${keywords})` : ''}${location ? ` in ${location}` : ''}`);

    const seen = new Set<string>();
    const allUrls: string[] = [];

    // Build context string for search (company + location)
    const contextParts = [company, location].filter(Boolean);
    const contextStr = contextParts.join(' ');

    // PHASE 1: Search with credentials/keywords (high priority)
    if (keywords) {
      const keywordQuery = `${name} ${keywords} ${contextStr}`.trim();
      // Search both profiles and posts (credentials often appear in posts)
      const [profileUrls, postUrls] = await Promise.all([
        searchWithJina(keywordQuery, new Set(), false),
        searchWithJina(keywordQuery, new Set(), true),
      ]);

      // Add keyword results first (higher priority)
      for (const url of [...profileUrls, ...postUrls]) {
        const normalized = url.toLowerCase();
        if (!seen.has(normalized)) {
          seen.add(normalized);
          allUrls.push(url);
        }
      }
      if (allUrls.length > 0) {
        console.log(`[Jina] Keyword search found ${allUrls.length} URLs`);
      }
    }

    // PHASE 2: Generate name variations and credential queries
    const variations = generateNameVariations(name);
    const keyVariations = variations.filter(v => v !== name).slice(0, 2);
    const credentialQueries = generateCredentialQueries(name).slice(1, 3); // Skip first (it's the raw name)

    // Combine all search queries (include location in each)
    const searchQueries = [
      `${name} ${contextStr}`.trim(),
      ...keyVariations.map(v => `${v} ${contextStr}`.trim()),
      ...credentialQueries.map(q => `${q} ${contextStr}`.trim()),
    ];

    // Search in parallel
    const searchPromises = searchQueries.map(query => searchWithJina(query, new Set()));
    const results = await Promise.all(searchPromises);

    // PHASE 3: If we have keywords but few results, search posts for credential matches
    if (keywords && allUrls.length < 3) {
      const postSearch = await searchWithJina(`${name} ${keywords}`, new Set(), true);
      for (const url of postSearch) {
        const normalized = url.toLowerCase();
        if (!seen.has(normalized)) {
          seen.add(normalized);
          allUrls.push(url);
        }
      }
    }

    // Interleave results from different searches
    const maxLen = Math.max(...results.map(r => r.length));
    for (let i = 0; i < maxLen; i++) {
      for (const urls of results) {
        if (i < urls.length) {
          const url = urls[i];
          const normalized = url.toLowerCase();
          if (!seen.has(normalized)) {
            seen.add(normalized);
            allUrls.push(url);
          }
        }
      }
    }

    if (allUrls.length > 0) {
      console.log(`[Discovery] Jina found ${allUrls.length} LinkedIn URLs for "${name}"`);
      return { urls: allUrls.slice(0, 10) };
    }
  }

  // Fallback to Google CSE
  const googleResult = await discoverWithGoogleCSE(name, company);
  if (googleResult.urls.length > 0) {
    console.log(`[Discovery] Google CSE found ${googleResult.urls.length} LinkedIn URLs for "${name}"`);
    return googleResult;
  }

  // No results from either provider
  if (!jinaApiKey && googleResult.error === 'not_configured') {
    console.log('[Discovery] No search providers configured (need JINA_API_KEY or GOOGLE_CSE_API_KEY)');
    return { urls: [], error: 'not_configured' };
  }

  console.log(`[Discovery] No LinkedIn URLs found for "${name}"`);
  return { urls: [], error: 'no_results' };
}

/**
 * ScrapIn API Response Types
 */
export interface ScrapInProfile {
  success: boolean;
  credits_consumed?: number;
  credits_left?: number;
  rate_limit_left?: number;
  metadata?: {
    source?: string;
    request_id?: string;
    updatedAt?: string;
  };
  person?: {
    publicIdentifier?: string;
    linkedInIdentifier?: string;
    memberIdentifier?: string;
    linkedInUrl?: string;
    firstName?: string;
    lastName?: string;
    headline?: string;
    location?: {
      city?: string;
      state?: string;
      country?: string;
      countryCode?: string;
    };
    summary?: string;
    photoUrl?: string;
    backgroundUrl?: string;
    openToWork?: boolean;
    premium?: boolean;
    connectionsCount?: number;
    followerCount?: number;
    positions?: {
      positionsCount?: number;
      positionHistory?: Array<{
        title?: string;
        companyName?: string;
        linkedInId?: string;
        linkedInUrl?: string;
        companyLogo?: string;
        companyLocation?: string;
        description?: string;
        contractType?: string;
        startEndDate?: {
          start?: { month?: number; year?: number };
          end?: { month?: number; year?: number } | null;
        };
      }>;
    };
    schools?: {
      educationsCount?: number;
      educationHistory?: Array<{
        schoolName?: string;
        degreeName?: string;
        fieldOfStudy?: string;
        description?: string;
        linkedInUrl?: string;
        schoolLogo?: string;
        startEndDate?: {
          start?: { month?: number; year?: number };
          end?: { month?: number; year?: number };
        };
      }>;
    };
    skills?: string[];
    languages?: string[];
    languagesWithProficiency?: Array<{
      name?: string;
      proficiency?: string;
    }>;
  };
  company?: {
    linkedInId?: string;
    name?: string;
    universalName?: string;
    linkedInUrl?: string;
    employeeCount?: number;
    followerCount?: number;
    websiteUrl?: string;
    description?: string;
    industry?: string;
    specialities?: string[];
    headquarter?: {
      city?: string;
      country?: string;
    };
    logo?: string;
  };
  error?: string;
  msg?: string;
  title?: string;
}

/**
 * Search for LinkedIn profiles by name using ScrapIn Person Search API.
 * Returns multiple results, fuzzy matching, only 0.1 credits per search.
 * Endpoint: POST https://api.scrapin.io/v1/enrichment/persons/search?apikey=
 */
export interface ScrapInPersonResult {
  publicIdentifier?: string;
  linkedInUrl?: string;
  firstName?: string;
  lastName?: string;
  headline?: string;
  currentPositionTitle?: string;
  currentCompanyName?: string;
  currentCompanyLinkedinId?: string;
  updateDate?: string;
}

export interface ScrapInSearchResponse {
  success: boolean;
  credits_consumed?: number;
  credits_left?: number;
  pagination?: {
    currentPage: number;
    totalPages: number;
    totalResults: number;
    resultsPerPage: number;
  };
  persons?: ScrapInPersonResult[];
}

export async function searchPersonsWithScrapIn(
  firstName: string,
  lastName?: string,
  companyName?: string
): Promise<ScrapInPersonResult[]> {
  const scrapInApiKey = process.env.SCRAPIN_API_KEY;

  if (!scrapInApiKey) {
    console.log('[ScrapIn] SCRAPIN_API_KEY not configured');
    return [];
  }

  try {
    console.log(`[ScrapIn] Person search: ${firstName} ${lastName || ''}${companyName ? ` at ${companyName}` : ''}`);

    const apiUrl = `https://api.scrapin.io/v1/enrichment/persons/search?apikey=${scrapInApiKey}`;

    const body: any = { page: 1, firstName };
    if (lastName) body.lastName = lastName;
    if (companyName) body.companyName = companyName;

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const data: ScrapInSearchResponse = await response.json();

    if (data.success && data.persons && data.persons.length > 0) {
      console.log(`[ScrapIn] Person search found ${data.persons.length} results (${data.pagination?.totalResults} total) | Credits left: ${data.credits_left}`);
      return data.persons;
    }

    console.log('[ScrapIn] Person search: no results for', firstName, lastName || '');
    return [];
  } catch (error) {
    console.error('[ScrapIn] Person search failed:', error);
    return [];
  }
}

/**
 * Match a LinkedIn profile by name using ScrapIn Match API.
 * Returns 0 or 1 exact match. Used as fallback after person search.
 * Endpoint: POST https://api.scrapin.io/v1/enrichment/match?apikey=
 */
export async function matchWithScrapIn(firstName: string, lastName: string, companyName?: string): Promise<ScrapInProfile | null> {
  const scrapInApiKey = process.env.SCRAPIN_API_KEY;

  if (!scrapInApiKey) {
    console.log('[ScrapIn] SCRAPIN_API_KEY not configured');
    return null;
  }

  try {
    console.log(`[ScrapIn] Matching profile: ${firstName} ${lastName}${companyName ? ` at ${companyName}` : ''}`);

    const apiUrl = `https://api.scrapin.io/v1/enrichment/match?apikey=${scrapInApiKey}`;

    const body: any = {
      firstName,
      lastName,
      includes: {
        includeCompany: true,
        includeSummary: true,
        includeFollowersCount: true,
        includeSkills: true,
        includeExperience: true,
        includeEducation: true,
      },
      cacheDuration: '7d',
    };

    if (companyName) {
      body.companyName = companyName;
    }

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const data: ScrapInProfile = await response.json();

    if (data.success && data.person) {
      console.log('[ScrapIn] Match found:', data.person.firstName, data.person.lastName, '| LinkedIn:', data.person.linkedInUrl);
      console.log('[ScrapIn] Credits left:', data.credits_left, '| Cache:', data.metadata?.source);
      return data;
    }

    console.log('[ScrapIn] No match found for:', firstName, lastName, '| Response:', JSON.stringify({ success: data.success, error: (data as any).error, credits_left: data.credits_left }));
    return null;
  } catch (error) {
    console.error('[ScrapIn] Match failed:', error);
    return null;
  }
}

/**
 * Scrape LinkedIn profile using ScrapIn API (PRIMARY SOURCE)
 * Endpoint: POST https://api.scrapin.io/v1/enrichment/profile?apikey=
 */
export async function scrapeWithScrapIn(linkedInUrl: string): Promise<ScrapInProfile | null> {
  const scrapInApiKey = process.env.SCRAPIN_API_KEY;

  if (!scrapInApiKey) {
    console.log('[ScrapIn] SCRAPIN_API_KEY not configured');
    return null;
  }

  try {
    console.log('[ScrapIn] Scraping LinkedIn profile:', linkedInUrl);

    // ScrapIn v1 API - API key as query parameter
    const apiUrl = `https://api.scrapin.io/v1/enrichment/profile?apikey=${scrapInApiKey}`;

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        linkedInUrl,
        includes: {
          includeCompany: true,
          includeSummary: true,
          includeFollowersCount: true,
          includeSkills: true,
          includeLanguages: true,
          includeExperience: true,
          includeEducation: true,
          includeCertifications: true,
        },
        cacheDuration: '7d', // Use ScrapIn's built-in 7-day cache
      }),
    });

    const data: ScrapInProfile = await response.json();

    if (data.success && data.person) {
      console.log('[ScrapIn] Successfully scraped profile for:', data.person.firstName, data.person.lastName);
      console.log('[ScrapIn] Credits left:', data.credits_left, '| Cache:', data.metadata?.source);
      return data;
    }

    if (!data.success) {
      console.log('[ScrapIn] API returned error:', data.msg || data.title || 'Unknown error');
    } else {
      console.log('[ScrapIn] No profile data returned');
    }
    return null;
  } catch (error) {
    console.error('[ScrapIn] Scrape failed:', error);
    return null;
  }
}

/**
 * Fetch LinkedIn posts/activity for a profile using ScrapIn API.
 * Endpoint: GET https://api.scrapin.io/v1/enrichment/persons/activities/posts?apikey=&linkedInUrl=&page=1
 * Costs 1 credit per call.
 */
export interface ScrapInPost {
  activityId?: string;
  text?: string;
  reactionsCount?: number;
  commentsCount?: number;
  activityDate?: string;
  activityUrl?: string;
  shareUrl?: string;
  author?: {
    authorName?: string;
    authorHeadline?: string;
    authorImage?: string;
  };
}

export interface ScrapInPostsResponse {
  success: boolean;
  credits_left?: number;
  posts?: ScrapInPost[];
  pagination?: {
    currentPage: number;
    total: number;
  };
}

export async function fetchPostsWithScrapIn(linkedInUrl: string): Promise<ScrapInPost[]> {
  const scrapInApiKey = process.env.SCRAPIN_API_KEY;

  if (!scrapInApiKey) {
    return [];
  }

  try {
    console.log('[ScrapIn] Fetching posts for:', linkedInUrl);

    const apiUrl = `https://api.scrapin.io/v1/enrichment/persons/activities/posts?apikey=${scrapInApiKey}&linkedInUrl=${encodeURIComponent(linkedInUrl)}&page=1`;

    const response = await fetch(apiUrl, { method: 'GET' });
    const data: ScrapInPostsResponse = await response.json();

    if (data.success && data.posts && data.posts.length > 0) {
      console.log(`[ScrapIn] Found ${data.posts.length} posts | Credits left: ${data.credits_left}`);
      return data.posts;
    }

    console.log('[ScrapIn] No posts found for:', linkedInUrl);
    return [];
  } catch (error) {
    console.error('[ScrapIn] Fetch posts failed:', error);
    return [];
  }
}

/**
 * Verify employment using Perplexity sonar-pro
 * Called ONLY when card data != LinkedIn data
 */
async function verifyEmploymentWithPerplexity(
  name: string,
  cardCompany?: string,
  cardTitle?: string,
  linkedInCompany?: string,
  linkedInTitle?: string
): Promise<{
  verified: boolean;
  currentCompany?: string;
  currentTitle?: string;
  confidence: number;
  source: string;
}> {
  const perplexityKey = process.env.PERPLEXITY_API_KEY;

  if (!perplexityKey) {
    console.log('[ScrapIn] PERPLEXITY_API_KEY not configured, skipping verification');
    return {
      verified: false,
      confidence: 50,
      source: 'unverified',
    };
  }

  try {
    console.log('[ScrapIn] Verifying employment with Perplexity for:', name);

    const prompt = `I need to verify the CURRENT employment status of ${name}.

Business card shows:
- Company: ${cardCompany || 'Not specified'}
- Title: ${cardTitle || 'Not specified'}

LinkedIn shows:
- Company: ${linkedInCompany || 'Not specified'}
- Title: ${linkedInTitle || 'Not specified'}

Please search the web to determine:
1. Where does ${name} CURRENTLY work as of today?
2. What is their CURRENT job title?
3. If there's a discrepancy, which is correct?

Return ONLY a JSON object:
{
  "currentCompany": "verified company name",
  "currentTitle": "verified job title",
  "verifiedVia": "source of verification (LinkedIn, company website, news article, etc.)",
  "confidence": 0-100,
  "notes": "any relevant details about job changes"
}`;

    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${perplexityKey}`,
      },
      body: JSON.stringify({
        model: 'sonar-pro',
        messages: [
          {
            role: 'system',
            content: 'You are an employment verification assistant. Search the web to verify current employment status. Return only valid JSON.',
          },
          { role: 'user', content: prompt },
        ],
        temperature: 0.1,
        max_tokens: 500,
        search_recency_filter: 'week',
      }),
    });

    if (!response.ok) {
      console.error('[ScrapIn] Perplexity verification error:', response.status);
      return {
        verified: false,
        confidence: 50,
        source: 'perplexity_error',
      };
    }

    const result = await response.json();
    const content = result.choices[0]?.message?.content;

    if (!content) {
      return {
        verified: false,
        confidence: 50,
        source: 'no_response',
      };
    }

    // Parse JSON response
    let cleanedContent = content.trim();
    if (cleanedContent.startsWith('```')) {
      cleanedContent = cleanedContent.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
    }

    const jsonMatch = cleanedContent.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const verificationData = JSON.parse(jsonMatch[0]);
      return {
        verified: true,
        currentCompany: verificationData.currentCompany,
        currentTitle: verificationData.currentTitle,
        confidence: verificationData.confidence || 70,
        source: `perplexity:${verificationData.verifiedVia || 'web'}`,
      };
    }

    return {
      verified: false,
      confidence: 50,
      source: 'parse_error',
    };
  } catch (error) {
    console.error('[ScrapIn] Perplexity verification failed:', error);
    return {
      verified: false,
      confidence: 50,
      source: 'exception',
    };
  }
}

/**
 * Generate smart ice breakers based on profile data
 */
function generateIceBreakers(
  profile: Partial<EnrichedProfile>,
  employmentChanged: boolean
): string[] {
  const iceBreakers: string[] = [];
  const firstName = profile.name?.split(' ')[0] || 'there';

  // If employment changed, congratulate them
  if (employmentChanged && profile.company) {
    iceBreakers.push(
      `Hi ${firstName}! Congratulations on joining ${profile.company}! I'd love to hear about what drew you to this new role.`
    );
  }

  // Based on skills
  if (profile.skills && profile.skills.length > 0) {
    const topSkill = profile.skills[0];
    iceBreakers.push(
      `Hi ${firstName}! I noticed your expertise in ${topSkill} - I'm curious about how you've applied this in your current work.`
    );
  }

  // Based on company
  if (profile.company) {
    iceBreakers.push(
      `Hi ${firstName}! I've been following ${profile.company}'s work - would love to learn more about what your team is focused on.`
    );
  }

  // Based on job title
  if (profile.jobTitle) {
    iceBreakers.push(
      `Hi ${firstName}! Your role as ${profile.jobTitle} sounds fascinating - what's been the most exciting project you've worked on recently?`
    );
  }

  // Generic professional
  if (iceBreakers.length < 3) {
    iceBreakers.push(
      `Hi ${firstName}! I came across your profile and thought we might have some interesting synergies. Would you be open to a brief chat?`
    );
  }

  return iceBreakers.slice(0, 5);
}

/**
 * Normalize company names for comparison
 */
function normalizeCompany(company?: string): string {
  if (!company) return '';
  return company
    .toLowerCase()
    .replace(/\s*(inc\.?|llc\.?|ltd\.?|corp\.?|co\.?|limited|corporation)\s*$/i, '')
    .replace(/[^\w\s]/g, '')
    .trim();
}

/**
 * Check if two company names match
 */
function companiesMatch(company1?: string, company2?: string): boolean {
  const norm1 = normalizeCompany(company1);
  const norm2 = normalizeCompany(company2);

  if (!norm1 || !norm2) return false;

  // Exact match
  if (norm1 === norm2) return true;

  // One contains the other
  if (norm1.includes(norm2) || norm2.includes(norm1)) return true;

  return false;
}

/**
 * Main enrichment function
 */
export async function enrich(input: EnrichmentInput): Promise<EnrichedProfile> {
  const startTime = Date.now();
  const sourcesUsed: string[] = ['card'];
  const warnings: string[] = [];

  // Check cache first
  const cacheKey = generateCacheKey(input);
  const cached = getFromCache(cacheKey);
  if (cached) {
    console.log('[ScrapIn] Cache hit for:', input.name);
    return cached;
  }

  // Initialize result with card data
  const result: EnrichedProfile = {
    name: input.name,
    company: input.company,
    jobTitle: input.jobTitle,
    email: input.email,
    phone: input.phone,
    linkedInUrl: input.linkedInUrl,
    location: input.location,
    employmentVerification: {
      status: 'UNVERIFIED',
      confidence: {
        overall: 30,
        level: 'LOW',
        reasons: ['Card data only - not verified'],
      },
    },
    sourcesUsed,
    processingTimeMs: 0,
    cacheHit: false,
  };

  try {
    // Step 1: Discover LinkedIn URL if not provided
    let linkedInUrl = input.linkedInUrl;
    if (!linkedInUrl && input.name) {
      linkedInUrl = await discoverLinkedInUrl(input.name, input.company) ?? undefined;
      if (linkedInUrl) {
        result.linkedInUrl = linkedInUrl;
        sourcesUsed.push('google_cse');
      }
    }

    // Step 2: Scrape LinkedIn with ScrapIn (PRIMARY SOURCE)
    let scrapInData: ScrapInProfile | null = null;
    if (linkedInUrl) {
      scrapInData = await scrapeWithScrapIn(linkedInUrl);

      if (scrapInData?.person) {
        sourcesUsed.push('scrapin');

        const person = scrapInData.person;

        // Extract current position (first in positionHistory is usually current)
        const currentPosition = person.positions?.positionHistory?.[0];

        // Update result with ScrapIn data
        result.name = [person.firstName, person.lastName].filter(Boolean).join(' ') || result.name;
        result.company = currentPosition?.companyName || scrapInData.company?.name || result.company;
        result.jobTitle = currentPosition?.title || person.headline || result.jobTitle;
        result.pictureUrl = person.photoUrl;
        result.bio = person.summary;

        // Extract location (now an object)
        if (person.location) {
          const loc = person.location;
          result.location = [loc.city, loc.state, loc.country].filter(Boolean).join(', ') || result.location;
        }

        // Extract skills (now just string array)
        if (person.skills && person.skills.length > 0) {
          result.skills = person.skills;
        }

        // Extract education (now in schools.educationHistory)
        if (person.schools?.educationHistory && person.schools.educationHistory.length > 0) {
          result.education = person.schools.educationHistory.map(edu => ({
            school: edu.schoolName,
            degree: edu.degreeName,
            field: edu.fieldOfStudy,
            startYear: edu.startEndDate?.start?.year,
            endYear: edu.startEndDate?.end?.year,
          }));
        }

        // Extract experience history
        if (person.positions?.positionHistory && person.positions.positionHistory.length > 0) {
          result.experience = person.positions.positionHistory.map((pos, index) => {
            // Format start/end dates
            let startDate: string | undefined;
            let endDate: string | undefined;
            if (pos.startEndDate?.start) {
              const s = pos.startEndDate.start;
              startDate = s.month && s.year ? `${s.year}-${String(s.month).padStart(2, '0')}` : String(s.year);
            }
            if (pos.startEndDate?.end) {
              const e = pos.startEndDate.end;
              endDate = e.month && e.year ? `${e.year}-${String(e.month).padStart(2, '0')}` : String(e.year);
            }

            return {
              company: pos.companyName,
              title: pos.title,
              startDate,
              endDate,
              isCurrent: !pos.startEndDate?.end, // No end date = current position
              description: pos.description,
            };
          });
        }
      }
    }

    // Step 3: Cross-validation - Check for employment changes
    const cardCompany = input.company;
    const linkedInCompany = scrapInData?.person?.positions?.positionHistory?.[0]?.companyName ||
                           scrapInData?.company?.name;

    const employmentMatches = companiesMatch(cardCompany, linkedInCompany);

    if (scrapInData?.person && cardCompany && linkedInCompany && !employmentMatches) {
      // Employment mismatch detected - verify with Perplexity
      console.log('[ScrapIn] Employment mismatch detected!');
      console.log('  Card:', cardCompany);
      console.log('  LinkedIn:', linkedInCompany);

      const verification = await verifyEmploymentWithPerplexity(
        result.name || input.name || '',
        cardCompany,
        input.jobTitle,
        linkedInCompany,
        result.jobTitle
      );

      if (verification.verified) {
        sourcesUsed.push('perplexity');

        // Update with verified data
        if (verification.currentCompany) {
          result.company = verification.currentCompany;
        }
        if (verification.currentTitle) {
          result.jobTitle = verification.currentTitle;
        }

        result.employmentVerification = {
          status: 'CHANGED',
          cardData: {
            company: cardCompany,
            jobTitle: input.jobTitle,
          },
          verifiedData: {
            company: verification.currentCompany || linkedInCompany,
            jobTitle: verification.currentTitle || result.jobTitle,
            source: verification.source,
          },
          changeDetails: {
            previousCompany: cardCompany,
            newCompany: verification.currentCompany || linkedInCompany,
            previousTitle: input.jobTitle,
            newTitle: verification.currentTitle || result.jobTitle,
            changeDetectedVia: 'scrapin+perplexity',
          },
          confidence: {
            overall: verification.confidence,
            level: verification.confidence >= 80 ? 'HIGH' : verification.confidence >= 60 ? 'MEDIUM' : 'LOW',
            reasons: ['LinkedIn profile (via ScrapIn)', `Verified via ${verification.source}`],
          },
        };

        // Add warning about employment change
        warnings.push(
          `EMPLOYMENT CHANGED: ${result.name} no longer works at ${cardCompany}. ` +
          `Now at ${verification.currentCompany || linkedInCompany} as ${verification.currentTitle || result.jobTitle}.`
        );
      } else {
        // Couldn't verify - use LinkedIn data with medium confidence
        result.employmentVerification = {
          status: 'CHANGED',
          cardData: {
            company: cardCompany,
            jobTitle: input.jobTitle,
          },
          verifiedData: {
            company: linkedInCompany,
            jobTitle: result.jobTitle,
            source: 'scrapin',
          },
          changeDetails: {
            previousCompany: cardCompany,
            newCompany: linkedInCompany,
            changeDetectedVia: 'scrapin',
          },
          confidence: {
            overall: 70,
            level: 'MEDIUM',
            reasons: ['LinkedIn profile (via ScrapIn)', 'Perplexity verification failed'],
          },
        };

        warnings.push(
          `POSSIBLE EMPLOYMENT CHANGE: ${result.name} may no longer work at ${cardCompany}. ` +
          `LinkedIn shows ${linkedInCompany}. Please verify before reaching out.`
        );
      }
    } else if (scrapInData?.person && (!cardCompany || employmentMatches)) {
      // Employment confirmed or no card company to compare
      result.employmentVerification = {
        status: 'CURRENT',
        cardData: cardCompany ? { company: cardCompany, jobTitle: input.jobTitle } : undefined,
        verifiedData: {
          company: result.company,
          jobTitle: result.jobTitle,
          source: 'scrapin',
        },
        confidence: {
          overall: 90,
          level: 'HIGH',
          reasons: ['LinkedIn profile (via ScrapIn)', 'Employment confirmed'],
        },
      };
    } else if (!scrapInData?.person) {
      // Could not scrape LinkedIn
      result.employmentVerification = {
        status: 'UNKNOWN',
        cardData: { company: cardCompany, jobTitle: input.jobTitle },
        confidence: {
          overall: 40,
          level: 'LOW',
          reasons: ['Could not access LinkedIn profile', 'Using card data only'],
        },
      };

      if (linkedInUrl) {
        warnings.push('Could not access LinkedIn profile - using card data only.');
      } else {
        warnings.push('No LinkedIn profile found - using card data only.');
      }
    }

    // Step 4: Generate ice breakers
    const employmentChanged = result.employmentVerification.status === 'CHANGED';
    result.iceBreakers = generateIceBreakers(result, employmentChanged);

    // Set warnings
    result.warnings = warnings.length > 0 ? warnings : undefined;

    // Set processing time
    result.processingTimeMs = Date.now() - startTime;
    result.sourcesUsed = sourcesUsed;

    // Cache the result
    setInCache(cacheKey, result);

    console.log('[ScrapIn] Enrichment complete:', {
      name: result.name,
      sourcesUsed,
      employmentStatus: result.employmentVerification.status,
      processingTimeMs: result.processingTimeMs,
    });

    return result;
  } catch (error) {
    console.error('[ScrapIn] Enrichment error:', error);

    // Return card data with error status
    result.processingTimeMs = Date.now() - startTime;
    result.warnings = ['Enrichment failed - using card data only'];
    return result;
  }
}

// Export singleton service
export const scrapInEnrichmentService = {
  enrich,
};

export default scrapInEnrichmentService;
