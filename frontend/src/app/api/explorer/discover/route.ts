/**
 * Explorer Discovery API Route
 *
 * Uses ScrapIn Person Search API to find LinkedIn profiles by name.
 * Returns lightweight preview data for user selection.
 * When a specific profile is selected, it gets scraped for full data.
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyApiAuth } from '@/lib/api/auth-guard';
import {
  scrapeWithScrapIn,
  searchPersonsWithScrapIn,
  discoverLinkedInUrls,
  ScrapInProfile,
  ScrapInPersonResult,
} from '@/lib/services/enrichment/ScrapInEnrichmentService';

export interface DiscoveredPosition {
  title?: string;
  company?: string;
  startDate?: string;
  endDate?: string;
  isCurrent?: boolean;
  description?: string;
  companyLogo?: string;
  location?: string;
}

export interface DiscoveredProfile {
  linkedInUrl: string;
  firstName: string;
  lastName: string;
  photoUrl?: string;
  headline?: string;
  currentCompany?: string;
  currentTitle?: string;
  location?: string;
  connectionsCount?: number;
  openToWork?: boolean;
  summary?: string;
  positions?: DiscoveredPosition[];
  skills?: string[];
  education?: Array<{
    school?: string;
    degree?: string;
    field?: string;
  }>;
}

/**
 * Map a ScrapIn Person Search result (lightweight) to a DiscoveredProfile.
 * Only has basic info — no positions, skills, education, photo.
 */
function mapPersonResultToDiscovered(person: ScrapInPersonResult): DiscoveredProfile | null {
  if (!person.linkedInUrl && !person.publicIdentifier) return null;

  const linkedInUrl = person.linkedInUrl
    || `https://www.linkedin.com/in/${person.publicIdentifier}`;

  return {
    linkedInUrl,
    firstName: person.firstName || '',
    lastName: person.lastName || '',
    headline: person.headline,
    currentCompany: person.currentCompanyName,
    currentTitle: person.currentPositionTitle,
  };
}

/**
 * Map a full ScrapIn profile scrape to a DiscoveredProfile.
 * Has all the details — positions, skills, education, photo, etc.
 */
function mapScrapInToDiscovered(linkedInUrl: string, data: ScrapInProfile): DiscoveredProfile | null {
  const person = data.person;
  if (!person) return null;

  const currentPosition = person.positions?.positionHistory?.[0];
  const location = person.location
    ? [person.location.city, person.location.state, person.location.country].filter(Boolean).join(', ')
    : undefined;

  const positions: DiscoveredPosition[] = (person.positions?.positionHistory || []).map(pos => {
    let startDate: string | undefined;
    let endDate: string | undefined;
    if (pos.startEndDate?.start) {
      const s = pos.startEndDate.start;
      startDate = s.month && s.year ? `${s.year}-${String(s.month).padStart(2, '0')}` : s.year ? String(s.year) : undefined;
    }
    if (pos.startEndDate?.end) {
      const e = pos.startEndDate.end;
      endDate = e.month && e.year ? `${e.year}-${String(e.month).padStart(2, '0')}` : e.year ? String(e.year) : undefined;
    }
    return {
      title: pos.title,
      company: pos.companyName,
      startDate,
      endDate,
      isCurrent: !pos.startEndDate?.end,
      description: pos.description,
      companyLogo: pos.companyLogo,
      location: pos.companyLocation,
    };
  });

  const education = (person.schools?.educationHistory || []).map(edu => ({
    school: edu.schoolName,
    degree: edu.degreeName,
    field: edu.fieldOfStudy,
  }));

  return {
    linkedInUrl,
    firstName: person.firstName || '',
    lastName: person.lastName || '',
    photoUrl: person.photoUrl,
    headline: person.headline,
    currentCompany: currentPosition?.companyName || data.company?.name,
    currentTitle: currentPosition?.title,
    location,
    connectionsCount: person.connectionsCount,
    openToWork: person.openToWork,
    summary: person.summary ? person.summary.slice(0, 200) : undefined,
    positions: positions.length > 0 ? positions : undefined,
    skills: person.skills && person.skills.length > 0 ? person.skills : undefined,
    education: education.length > 0 ? education : undefined,
  };
}

export async function POST(request: NextRequest) {
  try {
    const auth = await verifyApiAuth(request);
    if (auth instanceof NextResponse) return auth;

    const body = await request.json();
    const { firstName: rawFirstName, lastName: rawLastName, company, location, linkedInUrl, name: legacyName, keywords } = body;

    // Support both new (firstName/lastName) and legacy (name) formats
    let firstName = rawFirstName?.trim() || '';
    let lastName = rawLastName?.trim() || '';
    if (!firstName && legacyName) {
      const parts = legacyName.trim().split(/\s+/);
      firstName = parts[0] || '';
      lastName = parts.slice(1).join(' ') || '';
    }

    if (!firstName && !linkedInUrl) {
      return NextResponse.json(
        { profiles: [], error: 'name_required' },
        { status: 400 }
      );
    }

    // Check if ScrapIn is configured
    if (!process.env.SCRAPIN_API_KEY) {
      return NextResponse.json({ profiles: [], error: 'not_configured' });
    }

    // If a direct LinkedIn URL is provided, scrape it directly for full data
    if (linkedInUrl) {
      try {
        const result = await scrapeWithScrapIn(linkedInUrl);
        if (result) {
          const profile = mapScrapInToDiscovered(linkedInUrl, result);
          if (profile) {
            console.log(`[Discovery] Direct scrape successful for: ${linkedInUrl}`);
            return NextResponse.json({ profiles: [profile] });
          }
        }
        return NextResponse.json({ profiles: [], error: 'scrape_failed' });
      } catch (err) {
        console.error('[Discovery] Direct scrape failed:', err);
        return NextResponse.json({ profiles: [], error: 'scrape_failed' });
      }
    }

    const fullName = `${firstName} ${lastName}`.trim();

    // Run ScrapIn Person Search + Google CSE in parallel for maximum coverage
    const [personSearchResult, cseResult] = await Promise.allSettled([
      (async () => {
        let persons = await searchPersonsWithScrapIn(firstName, lastName || undefined, company || undefined);
        if (persons.length === 0 && company) {
          console.log(`[Discovery] Retrying search without company "${company}"`);
          persons = await searchPersonsWithScrapIn(firstName, lastName || undefined);
        }
        return persons;
      })(),
      discoverLinkedInUrls(fullName, company || undefined, keywords || undefined, location || undefined),
    ]);

    const persons = personSearchResult.status === 'fulfilled' ? personSearchResult.value : [];
    const cseUrls = cseResult.status === 'fulfilled' ? cseResult.value.urls : [];

    const seenUrls = new Set<string>();
    const profiles: DiscoveredProfile[] = [];

    // Helper to add URL-based profile
    const addUrlProfile = (url: string, source: string) => {
      const normalizedUrl = url.split('?')[0].replace(/\/$/, '').toLowerCase();
      if (seenUrls.has(normalizedUrl)) return;
      seenUrls.add(normalizedUrl);

      // Extract name from URL slug: /in/ali-rodan-phd-... → Ali Rodan Phd
      const slug = url.match(/linkedin\.com\/in\/([^/?]+)/)?.[1] || '';
      const nameParts = slug.split('-').filter(p => p.length > 0 && !/^\d+[a-z]*$/.test(p)); // Filter out ID suffixes
      profiles.push({
        linkedInUrl: url,
        firstName: nameParts[0] ? nameParts[0].charAt(0).toUpperCase() + nameParts[0].slice(1) : '',
        lastName: nameParts.slice(1).map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' '),
        headline: source,
      });
    };

    // If keywords provided, prioritize URLs that contain those keywords in the slug
    if (keywords) {
      const keywordTerms = keywords.toLowerCase().split(/[\s,]+/).filter((k: string) => k.length > 2);
      const keywordUrls: string[] = [];
      const otherUrls: string[] = [];

      for (const url of cseUrls) {
        const slug = url.toLowerCase();
        const hasKeyword = keywordTerms.some((kw: string) => slug.includes(kw));
        if (hasKeyword) {
          keywordUrls.push(url);
        } else {
          otherUrls.push(url);
        }
      }

      // Add keyword-matched URLs first (highest priority)
      for (const url of keywordUrls) {
        addUrlProfile(url, `Found via keyword search`);
      }

      // Then add ScrapIn Person Search results
      for (const person of persons.slice(0, 10)) {
        const profile = mapPersonResultToDiscovered(person);
        if (profile) {
          const normalizedUrl = profile.linkedInUrl.split('?')[0].replace(/\/$/, '').toLowerCase();
          if (!seenUrls.has(normalizedUrl)) {
            seenUrls.add(normalizedUrl);
            profiles.push(profile);
          }
        }
      }

      // Finally add other URLs
      for (const url of otherUrls) {
        addUrlProfile(url, `Found via search`);
      }
    } else {
      // No keywords - use original order: ScrapIn results first, then URLs
      for (const person of persons.slice(0, 10)) {
        const profile = mapPersonResultToDiscovered(person);
        if (profile) {
          const normalizedUrl = profile.linkedInUrl.split('?')[0].replace(/\/$/, '').toLowerCase();
          seenUrls.add(normalizedUrl);
          profiles.push(profile);
        }
      }

      for (const url of cseUrls) {
        addUrlProfile(url, `Found via search`);
      }
    }

    if (profiles.length > 0) {
      if (profiles.length === 1) {
        // Only one result — scrape it immediately for full data
        try {
          const fullData = await scrapeWithScrapIn(profiles[0].linkedInUrl);
          if (fullData) {
            const fullProfile = mapScrapInToDiscovered(profiles[0].linkedInUrl, fullData);
            if (fullProfile) {
              console.log(`[Discovery] Single result, scraped full data: ${fullProfile.firstName} ${fullProfile.lastName}`);
              return NextResponse.json({ profiles: [fullProfile] });
            }
          }
        } catch (err) {
          // Fall through to return lightweight profile
        }
      }

      console.log(`[Discovery] Found ${profiles.length} profiles for "${fullName}" (${persons.length} ScrapIn + ${cseUrls.length} CSE)`);
      return NextResponse.json({ profiles });
    }

    return NextResponse.json({ profiles: [], error: 'no_profiles_found' });
  } catch (error: any) {
    console.error('[Discovery] Error:', error);
    return NextResponse.json(
      { profiles: [], error: 'internal_error' },
      { status: 500 }
    );
  }
}
