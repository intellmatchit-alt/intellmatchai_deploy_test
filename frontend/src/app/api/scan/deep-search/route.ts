/**
 * Deep Search API Route for Card Scan
 *
 * PRIMARY: Uses ScrapIn + Jina AI for LinkedIn discovery and profile scraping
 * FALLBACK: OpenAI/Perplexity for additional web search
 *
 * This matches the Explorer feature's search methodology for consistency.
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyApiAuth } from '@/lib/api/auth-guard';
import {
  scrapeWithScrapIn,
  discoverLinkedInUrls,
  fetchPostsWithScrapIn,
  ScrapInProfile,
  ScrapInPost,
} from '@/lib/services/enrichment/ScrapInEnrichmentService';

interface DeepSearchRequest {
  name: string;
  company?: string;
  jobTitle?: string;
  email?: string;
  phone?: string;
  website?: string;
  linkedInUrl?: string;
}

interface DeepSearchResult {
  name: string;
  company?: string;
  jobTitle?: string;
  location?: string;
  bio?: string;
  linkedInUrl?: string;
  twitterUrl?: string;
  websiteUrl?: string;
  pictureUrl?: string;
  skills: string[];
  sectors: string[];
  interests: string[];
  experience?: Array<{
    company: string;
    title: string;
    period?: string;
    startDate?: string;
    endDate?: string;
    isCurrent?: boolean;
    description?: string;
  }>;
  education?: Array<{
    institution: string;
    degree?: string;
    field?: string;
    year?: string;
  }>;
  posts?: Array<{
    text?: string;
    activityDate?: string;
    reactionsCount?: number;
    commentsCount?: number;
  }>;
  latestPostDate?: string;
  sources: string[];
  confidence: 'high' | 'medium' | 'low';
  searchEngine: string;
}

export async function POST(request: NextRequest) {
  try {
    const auth = await verifyApiAuth(request);
    if (auth instanceof NextResponse) return auth;

    const body: DeepSearchRequest = await request.json();

    if (!body.name) {
      return NextResponse.json(
        { error: 'Name is required' },
        { status: 400 }
      );
    }

    console.log(`[DeepSearch] Starting search for: ${body.name}`);

    // STEP 1: Try ScrapIn + Jina discovery (same as Explorer)
    const scrapInResult = await searchWithScrapIn(body);
    if (scrapInResult) {
      console.log(`[DeepSearch] ScrapIn success for: ${body.name}`);
      return NextResponse.json({ success: true, data: scrapInResult });
    }

    // STEP 2: Fallback to OpenAI/Perplexity web search
    const openaiKey = process.env.OPENAI_API_KEY;
    const perplexityKey = process.env.PERPLEXITY_API_KEY;

    if (perplexityKey) {
      const result = await searchWithPerplexity(body, perplexityKey);
      if (result) return result;
    }

    if (openaiKey) {
      const result = await searchWithOpenAI(body, openaiKey);
      if (result) return result;
    }

    // No results from any source
    return NextResponse.json({
      success: true,
      data: {
        name: body.name,
        company: body.company,
        jobTitle: body.jobTitle,
        linkedInUrl: body.linkedInUrl,
        websiteUrl: body.website,
        skills: [],
        sectors: [],
        interests: [],
        sources: [],
        confidence: 'low',
        searchEngine: 'none',
      },
      warning: 'Could not find additional information about this person.',
    });
  } catch (error: any) {
    console.error('[DeepSearch] API error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Search using ScrapIn + Jina AI (same methodology as Explorer)
 */
async function searchWithScrapIn(body: DeepSearchRequest): Promise<DeepSearchResult | null> {
  const scrapInApiKey = process.env.SCRAPIN_API_KEY;
  if (!scrapInApiKey) {
    console.log('[DeepSearch] ScrapIn not configured');
    return null;
  }

  try {
    let linkedInUrl = body.linkedInUrl;

    // If no LinkedIn URL provided, discover it using Jina + ScrapIn
    if (!linkedInUrl) {
      // Build search context from all available card data
      let company = body.company;

      // Try to extract company from email domain if not provided
      if (!company && body.email) {
        const emailDomain = body.email.split('@')[1];
        if (emailDomain && !['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'icloud.com', 'me.com'].includes(emailDomain.toLowerCase())) {
          // Extract company name from domain (e.g., "microsoft.com" -> "Microsoft")
          const domainName = emailDomain.split('.')[0];
          company = domainName.charAt(0).toUpperCase() + domainName.slice(1);
          console.log(`[DeepSearch] Inferred company from email domain: ${company}`);
        }
      }

      // Use job title as keywords (helps find the right person)
      const keywords = body.jobTitle || undefined;

      console.log(`[DeepSearch] Discovering LinkedIn URL for: ${body.name}${company ? ` at ${company}` : ''}${keywords ? ` (${keywords})` : ''}`);
      const discovery = await discoverLinkedInUrls(body.name, company, keywords);

      if (discovery.urls.length > 0) {
        // Try to find a URL that matches the person's name
        const nameParts = body.name.toLowerCase().split(/\s+/).filter(p => p.length > 2);

        // Also check for Al-prefix variations (common in Arabic names)
        const nameVariants = nameParts.flatMap(part => {
          const variants = [part];
          if (part.startsWith('al')) {
            variants.push(part.slice(2)); // "alasasfeh" -> "asasfeh"
            variants.push('al-' + part.slice(2)); // "alasasfeh" -> "al-asasfeh"
            variants.push('al ' + part.slice(2)); // for matching
          }
          return variants;
        });

        const matchingUrl = discovery.urls.find(url => {
          const slug = url.toLowerCase();
          // Check if at least 2 name parts appear in the URL slug
          const matches = nameVariants.filter(part => slug.includes(part.replace(/^(al|el)-?/i, '')));
          return matches.length >= 2 || (nameParts.length === 1 && matches.length >= 1);
        });

        // Also check for job title match if no name match
        let titleMatchUrl: string | undefined;
        if (!matchingUrl && body.jobTitle) {
          const titleWords = body.jobTitle.toLowerCase().split(/\s+/).filter(w => w.length > 3);
          titleMatchUrl = discovery.urls.find(url => {
            const slug = url.toLowerCase();
            return titleWords.some(word => slug.includes(word));
          });
        }

        linkedInUrl = matchingUrl || titleMatchUrl || discovery.urls[0];
        console.log(`[DeepSearch] Found LinkedIn URL: ${linkedInUrl}${matchingUrl ? ' (name matched)' : titleMatchUrl ? ' (title matched)' : ' (first result)'}`);
      }
    }

    if (!linkedInUrl) {
      console.log('[DeepSearch] No LinkedIn URL found');
      return null;
    }

    // Scrape the LinkedIn profile
    console.log(`[DeepSearch] Scraping profile: ${linkedInUrl}`);
    const profile = await scrapeWithScrapIn(linkedInUrl);
    if (!profile || !profile.person) {
      console.log('[DeepSearch] Failed to scrape profile');
      return null;
    }

    // Fetch recent posts
    const posts = await fetchPostsWithScrapIn(linkedInUrl);
    const recentPosts = posts.slice(0, 5).map(p => ({
      text: p.text,
      activityDate: p.activityDate,
      reactionsCount: p.reactionsCount,
      commentsCount: p.commentsCount,
    }));
    const latestPostDate = recentPosts[0]?.activityDate;

    // Map ScrapIn data to DeepSearchResult
    const person = profile.person;
    const currentPosition = person.positions?.positionHistory?.[0];

    // Build location string
    const location = person.location
      ? [person.location.city, person.location.state, person.location.country].filter(Boolean).join(', ')
      : undefined;

    // Map experience
    const experience = (person.positions?.positionHistory || []).map(pos => {
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
        company: pos.companyName || '',
        title: pos.title || '',
        startDate,
        endDate,
        period: [startDate, endDate || 'Present'].filter(Boolean).join(' - '),
        isCurrent: !pos.startEndDate?.end,
        description: pos.description,
      };
    });

    // Map education
    const education = (person.schools?.educationHistory || []).map(edu => ({
      institution: edu.schoolName || '',
      degree: edu.degreeName,
      field: edu.fieldOfStudy,
    }));

    // Infer sectors from positions and skills
    const sectors = inferSectors(person, profile.company);

    return {
      name: `${person.firstName || ''} ${person.lastName || ''}`.trim() || body.name,
      company: currentPosition?.companyName || profile.company?.name || body.company,
      jobTitle: currentPosition?.title || body.jobTitle,
      location,
      bio: person.summary,
      linkedInUrl,
      pictureUrl: person.photoUrl,
      skills: person.skills || [],
      sectors,
      interests: [], // Will be enhanced by AI if needed
      experience,
      education,
      posts: recentPosts.length > 0 ? recentPosts : undefined,
      latestPostDate,
      sources: [linkedInUrl],
      confidence: 'high',
      searchEngine: 'scrapin',
    };
  } catch (error) {
    console.error('[DeepSearch] ScrapIn search failed:', error);
    return null;
  }
}

/**
 * Infer industry sectors from profile data
 */
function inferSectors(person: any, company: any): string[] {
  const sectors = new Set<string>();
  const text = [
    person.headline || '',
    person.summary || '',
    ...(person.positions?.positionHistory || []).map((p: any) => `${p.title || ''} ${p.companyName || ''} ${p.description || ''}`),
    ...(person.skills || []),
    company?.industry || '',
  ].join(' ').toLowerCase();

  const sectorMap: Record<string, string[]> = {
    'Technology': ['software', 'developer', 'engineer', 'tech', 'programming', 'IT', 'cloud', 'saas', 'ai', 'machine learning'],
    'Finance': ['finance', 'banking', 'investment', 'fintech', 'accounting', 'financial'],
    'Healthcare': ['health', 'medical', 'pharma', 'biotech', 'hospital', 'clinic'],
    'Education': ['education', 'university', 'school', 'teaching', 'professor', 'academic'],
    'Marketing': ['marketing', 'advertising', 'brand', 'digital marketing', 'seo', 'content'],
    'Sales': ['sales', 'business development', 'account executive', 'revenue'],
    'Consulting': ['consulting', 'consultant', 'advisory', 'strategy'],
    'Real Estate': ['real estate', 'property', 'realty'],
    'Manufacturing': ['manufacturing', 'production', 'factory', 'industrial'],
    'Retail': ['retail', 'ecommerce', 'store', 'shop'],
    'Hospitality': ['hotel', 'hospitality', 'tourism', 'travel'],
    'Legal': ['legal', 'law', 'attorney', 'lawyer'],
    'Government': ['government', 'public sector', 'minister', 'policy'],
    'Entrepreneurship': ['entrepreneur', 'startup', 'founder', 'co-founder'],
  };

  for (const [sector, keywords] of Object.entries(sectorMap)) {
    if (keywords.some(kw => text.includes(kw))) {
      sectors.add(sector);
    }
  }

  return Array.from(sectors).slice(0, 5);
}

/**
 * Fallback: Search using Perplexity API
 */
async function searchWithPerplexity(body: DeepSearchRequest, apiKey: string) {
  const searchQuery = [body.name, body.company, body.jobTitle, 'LinkedIn profile'].filter(Boolean).join(' ');

  try {
    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'sonar',
        messages: [
          {
            role: 'system',
            content: `You are researching a professional contact. Search the web and return JSON with:
{
  "name": "Full name",
  "company": "Company",
  "jobTitle": "Title",
  "location": "Location",
  "bio": "2-3 sentence summary",
  "linkedInUrl": "LinkedIn URL",
  "skills": ["skill1", "skill2"],
  "sectors": ["industry1"],
  "interests": ["interest1"],
  "experience": [{"company": "...", "title": "...", "period": "..."}],
  "education": [{"institution": "...", "degree": "..."}],
  "sources": ["url1", "url2"],
  "confidence": "high/medium/low"
}
Only include verified information.`
          },
          {
            role: 'user',
            content: `Search for professional information about: ${searchQuery}`
          }
        ],
        temperature: 0.2,
        max_tokens: 4000,
      }),
    });

    if (!response.ok) {
      console.error('[DeepSearch] Perplexity API error:', await response.text());
      return null;
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content;
    if (!content) return null;

    const result = parseSearchResult(content, 'perplexity');
    if (result) {
      return NextResponse.json({ success: true, data: result });
    }
    return null;
  } catch (error) {
    console.error('[DeepSearch] Perplexity search error:', error);
    return null;
  }
}

/**
 * Fallback: Search using OpenAI
 */
async function searchWithOpenAI(body: DeepSearchRequest, apiKey: string) {
  // Use a simple completion since web_search tool may not be available
  const searchQuery = [body.name, body.company, body.jobTitle].filter(Boolean).join(', ');

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `Based on the name and company provided, infer likely professional information. Return JSON:
{
  "name": "Full name",
  "company": "Company",
  "jobTitle": "Title",
  "skills": ["likely skills based on role"],
  "sectors": ["likely industries"],
  "interests": ["likely professional interests"],
  "sources": [],
  "confidence": "low"
}
Note: This is inference only, not verified web data.`
          },
          {
            role: 'user',
            content: `Infer professional profile for: ${searchQuery}`
          }
        ],
        temperature: 0.3,
        max_tokens: 1000,
      }),
    });

    if (!response.ok) {
      console.error('[DeepSearch] OpenAI API error:', await response.text());
      return null;
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content;
    if (!content) return null;

    const result = parseSearchResult(content, 'openai-inference');
    if (result) {
      // Mark as low confidence since it's inference, not verified
      result.confidence = 'low';
      return NextResponse.json({ success: true, data: result });
    }
    return null;
  } catch (error) {
    console.error('[DeepSearch] OpenAI search error:', error);
    return null;
  }
}

/**
 * Parse search result JSON from AI response
 */
function parseSearchResult(content: string, searchEngine: string): DeepSearchResult | null {
  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const parsed = JSON.parse(jsonMatch[0]);
    const sources = Array.isArray(parsed.sources) ? parsed.sources.filter((s: string) => s && s.startsWith('http')) : [];

    let confidence: 'high' | 'medium' | 'low' = parsed.confidence || 'medium';
    if (sources.length === 0) {
      confidence = 'low';
    } else if (sources.length >= 3) {
      confidence = 'high';
    }

    return {
      name: parsed.name || '',
      company: parsed.company,
      jobTitle: parsed.jobTitle,
      location: parsed.location,
      bio: parsed.bio,
      linkedInUrl: parsed.linkedInUrl,
      twitterUrl: parsed.twitterUrl,
      websiteUrl: parsed.websiteUrl,
      pictureUrl: parsed.pictureUrl,
      skills: Array.isArray(parsed.skills) ? parsed.skills : [],
      sectors: Array.isArray(parsed.sectors) ? parsed.sectors : [],
      interests: Array.isArray(parsed.interests) ? parsed.interests : [],
      experience: Array.isArray(parsed.experience) ? parsed.experience : [],
      education: Array.isArray(parsed.education) ? parsed.education : [],
      sources,
      confidence,
      searchEngine,
    };
  } catch (error) {
    console.error('[DeepSearch] Failed to parse result:', error);
    return null;
  }
}
