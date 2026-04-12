/**
 * Deep Search API Route for Card Scan
 *
 * Uses OpenAI GPT-4o with REAL web search to find verified data about a person
 * after their business card has been scanned.
 *
 * IMPORTANT: This uses the web_search tool to get REAL data from the internet,
 * NOT generated content from AI training data.
 */

import { NextRequest, NextResponse } from 'next/server';

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
  // Basic info (verified from web)
  name: string;
  company?: string;
  jobTitle?: string;
  location?: string;

  // Enhanced data from web search
  bio?: string;
  linkedInUrl?: string;
  twitterUrl?: string;
  websiteUrl?: string;

  // Professional data
  skills: string[];
  sectors: string[];
  interests: string[];

  // Work history
  experience?: Array<{
    company: string;
    title: string;
    period?: string;
    isCurrent?: boolean;
  }>;

  // Education
  education?: Array<{
    institution: string;
    degree?: string;
    field?: string;
    year?: string;
  }>;

  // Sources - REQUIRED for verification
  sources: string[];

  // Confidence
  confidence: 'high' | 'medium' | 'low';
  searchEngine: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: DeepSearchRequest = await request.json();

    if (!body.name) {
      return NextResponse.json(
        { error: 'Name is required' },
        { status: 400 }
      );
    }

    const openaiKey = process.env.OPENAI_API_KEY;
    const perplexityKey = process.env.PERPLEXITY_API_KEY;

    // Try OpenAI with web search first (REAL web data)
    if (openaiKey) {
      const result = await searchWithOpenAI(body, openaiKey);
      if (result) return result;
    }

    // Try Perplexity as fallback (also has real web search)
    if (perplexityKey) {
      const result = await searchWithPerplexity(body, perplexityKey);
      if (result) return result;
    }

    return NextResponse.json(
      { error: 'No search API configured' },
      { status: 500 }
    );
  } catch (error: any) {
    console.error('Deep search API error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Deep web search using OpenAI GPT-4o with REAL web search tool
 * This uses the Responses API with web_search to get actual internet data
 */
async function searchWithOpenAI(body: DeepSearchRequest, apiKey: string) {
  // Detect if name might be Arabic/Middle Eastern for better search
  const mightBeArabic = /[أ-ي]/.test(body.name) ||
    body.name.toLowerCase().includes('al-') ||
    body.name.toLowerCase().includes('el-') ||
    body.name.toLowerCase().includes('abu') ||
    body.company?.toLowerCase().includes('arab') ||
    body.company?.toLowerCase().includes('middle east');

  const systemPrompt = `You are a research assistant with web search capabilities. Your task is to SEARCH THE INTERNET and find REAL, VERIFIED information about a person from their business card.

CRITICAL RULES:
1. You MUST use web search to find REAL data - DO NOT make up or generate information
2. Every piece of information must come from an actual website you searched
3. You MUST include source URLs for EVERY piece of information
4. If you cannot find real information, say "not found" - DO NOT guess or generate
5. Only include data you actually found on real websites

SEARCH STRATEGY - Search ALL of these:
1. LinkedIn: "${body.name}" + company name - find their actual profile
2. Company website: Look for team/about page with their bio
3. Google: "${body.name}" + job title - find articles, news, mentions
4. Twitter/X: Search for their actual account
5. YouTube: Search for interviews, talks, presentations
6. News articles: Recent mentions or features
7. Professional directories in their field
${mightBeArabic ? `8. Arabic search: Try Arabic variations of name
9. Regional sources: Middle Eastern business directories` : ''}

OUTPUT FORMAT - Return valid JSON:
{
  "name": "Full name as found online",
  "company": "Company from their actual profile",
  "jobTitle": "Title from their actual profile",
  "location": "Location if found",
  "bio": "Summary based ONLY on what you found online - cite sources",
  "linkedInUrl": "Actual LinkedIn URL found",
  "twitterUrl": "Actual Twitter/X URL found",
  "websiteUrl": "Personal/company website found",
  "skills": ["Skills mentioned in their actual profiles"],
  "sectors": ["Industries from their real work history"],
  "interests": ["Interests from their actual posts/content"],
  "experience": [{"company": "Real company", "title": "Real title", "period": "Actual dates"}],
  "education": [{"institution": "Real school", "degree": "Actual degree"}],
  "sources": ["REQUIRED - URLs where you found this information"],
  "confidence": "high if found LinkedIn/multiple sources, medium if few sources, low if minimal data"
}

IMPORTANT: The "sources" array is REQUIRED. If you have no sources, you have no real data.`;

  const searchHints = [];
  if (body.company) searchHints.push(`Company: ${body.company}`);
  if (body.jobTitle) searchHints.push(`Title: ${body.jobTitle}`);
  if (body.email) searchHints.push(`Email domain: ${body.email.split('@')[1]}`);
  if (body.linkedInUrl) searchHints.push(`LinkedIn: ${body.linkedInUrl}`);
  if (body.website) searchHints.push(`Website: ${body.website}`);

  const userPrompt = `SEARCH THE INTERNET NOW to find REAL information about this person:

**Name:** ${body.name}
${searchHints.length > 0 ? `\n**Search hints from business card:**\n${searchHints.join('\n')}` : ''}

SEARCH CHECKLIST - Complete ALL searches:
□ LinkedIn: Search "${body.name}"${body.company ? ` at ${body.company}` : ''}
□ Google: Search "${body.name}"${body.jobTitle ? ` ${body.jobTitle}` : ''}
□ Company website: ${body.company ? `Search ${body.company} team page` : 'Search company if found'}
□ Twitter/X: Search for their account
□ News: Search for recent articles about them
${body.linkedInUrl ? `□ Visit LinkedIn URL: ${body.linkedInUrl}` : ''}
${body.website ? `□ Visit website: ${body.website}` : ''}
${mightBeArabic ? `□ Arabic Google: Search Arabic name variations
□ Arabic LinkedIn: Try Arabic profile search` : ''}

After searching, return JSON with ONLY verified information and source URLs.
If you cannot find real data, return empty arrays and "confidence": "low".`;

  try {
    // Use OpenAI's Responses API with web search tool
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        tools: [{ type: 'web_search' }],
        input: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.2,
      }),
    });

    if (!response.ok) {
      console.error('OpenAI Responses API error:', await response.text());
      // Try fallback to chat completions
      return await fallbackOpenAI(body, apiKey, systemPrompt, userPrompt);
    }

    const data = await response.json();

    // Extract the output text
    let content = '';
    if (data.output) {
      for (const item of data.output) {
        if (item.type === 'message' && item.content) {
          for (const block of item.content) {
            if (block.type === 'output_text') {
              content = block.text;
              break;
            }
          }
        }
      }
    }

    if (!content) {
      return await fallbackOpenAI(body, apiKey, systemPrompt, userPrompt);
    }

    // Parse the JSON response
    const result = parseSearchResult(content, 'openai-web-search');
    return NextResponse.json({ success: true, data: result });
  } catch (error: any) {
    console.error('OpenAI search error:', error);
    return await fallbackOpenAI(body, apiKey, systemPrompt, userPrompt);
  }
}

/**
 * Fallback when web search is not available
 * Returns minimal data with clear warning - we don't want to return AI-generated fake data
 */
async function fallbackOpenAI(
  body: DeepSearchRequest,
  apiKey: string,
  systemPrompt: string,
  userPrompt: string
) {
  // Instead of generating fake data, return a minimal response with a warning
  // Real web search failed, so we shouldn't pretend we have real data
  console.warn('Web search API unavailable, returning minimal response');

  return NextResponse.json({
    success: true,
    data: {
      name: body.name,
      company: body.company,
      jobTitle: body.jobTitle,
      location: undefined,
      bio: undefined,
      linkedInUrl: body.linkedInUrl,
      websiteUrl: body.website,
      skills: [],
      sectors: [],
      interests: [],
      experience: [],
      education: [],
      sources: [],
      confidence: 'low',
      searchEngine: 'none',
    },
    warning: 'Web search unavailable. Only using data from the scanned card. No additional information could be verified.',
  });
}

/**
 * Search using Perplexity API
 */
async function searchWithPerplexity(body: DeepSearchRequest, apiKey: string) {
  const searchQuery = [
    body.name,
    body.company,
    body.jobTitle,
    'LinkedIn profile'
  ].filter(Boolean).join(' ');

  try {
    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'llama-3.1-sonar-large-128k-online',
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
      console.error('Perplexity API error:', await response.text());
      return null;
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content;

    if (!content) {
      return null;
    }

    const result = parseSearchResult(content, 'perplexity');
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error('Perplexity search error:', error);
    return null;
  }
}

/**
 * Parse search result JSON from AI response
 * Validates that sources are present - no sources means no real web data
 */
function parseSearchResult(content: string, searchEngine: string): DeepSearchResult | null {
  try {
    // Try to extract JSON from the response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return null;
    }

    const parsed = JSON.parse(jsonMatch[0]);
    const sources = Array.isArray(parsed.sources) ? parsed.sources.filter((s: string) => s && s.startsWith('http')) : [];

    // Determine confidence based on sources found
    let confidence: 'high' | 'medium' | 'low' = parsed.confidence || 'medium';
    if (sources.length === 0) {
      confidence = 'low'; // No sources = not verified
    } else if (sources.length >= 3) {
      confidence = 'high'; // Multiple sources = high confidence
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
      skills: Array.isArray(parsed.skills) ? parsed.skills : [],
      sectors: Array.isArray(parsed.sectors) ? parsed.sectors : [],
      interests: Array.isArray(parsed.interests) ? parsed.interests : [],
      experience: Array.isArray(parsed.experience) ? parsed.experience : [],
      education: Array.isArray(parsed.education) ? parsed.education : [],
      sources: sources,
      confidence: confidence,
      searchEngine,
    };
  } catch (error) {
    console.error('Failed to parse search result:', error);
    return null;
  }
}
