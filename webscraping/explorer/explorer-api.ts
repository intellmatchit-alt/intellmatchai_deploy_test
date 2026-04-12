/**
 * Explorer API Route
 *
 * AI-powered profile research using Perplexity API for real-time web search.
 * Searches the internet for actual, up-to-date information about people.
 */

import { NextRequest, NextResponse } from 'next/server';

interface ExplorerRequest {
  name: string;
  linkedIn?: string;
  twitter?: string;
  website?: string;
  additionalInfo?: string;
}

interface SocialMediaAccount {
  platform: string;
  url: string;
  username?: string;
  followers?: string;
}

interface ProfileData {
  name: string;
  summary: string;
  professionalBackground: string;
  sectors: string[];
  skills: string[];
  interests: string[];
  iceBreakers: string[];
  commonGround: string[];
  approachTips: string;
  sources?: string[];
  socialMedia?: SocialMediaAccount[];
  company?: string;
  jobTitle?: string;
  location?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: ExplorerRequest = await request.json();

    if (!body.name) {
      return NextResponse.json(
        { error: 'Name is required' },
        { status: 400 }
      );
    }

    // Try Perplexity first (has real-time web search)
    const perplexityKey = process.env.PERPLEXITY_API_KEY;
    if (perplexityKey) {
      try {
        return await searchWithPerplexity(body, perplexityKey);
      } catch (error) {
        console.error('Perplexity search failed, trying OpenAI:', error);
      }
    }

    // Fallback to OpenAI
    const openaiKey = process.env.OPENAI_API_KEY;
    if (!openaiKey) {
      return NextResponse.json(
        { error: 'No API keys configured' },
        { status: 500 }
      );
    }

    return await searchWithOpenAI(body, openaiKey);
  } catch (error: any) {
    console.error('Explorer API error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Search using Perplexity API (has built-in web search)
 */
async function searchWithPerplexity(body: ExplorerRequest, apiKey: string) {
  // Detect if name might be Arabic/Middle Eastern
  const mightBeArabic = /[أ-ي]/.test(body.name) ||
    body.name.toLowerCase().includes('dr.') ||
    body.name.toLowerCase().includes('al-') ||
    body.name.toLowerCase().includes('el-') ||
    body.name.toLowerCase().includes('abu') ||
    body.additionalInfo?.toLowerCase().includes('arab') ||
    body.additionalInfo?.toLowerCase().includes('jordan') ||
    body.additionalInfo?.toLowerCase().includes('egypt') ||
    body.additionalInfo?.toLowerCase().includes('saudi') ||
    body.additionalInfo?.toLowerCase().includes('middle east');

  const systemPrompt = `You are an expert research assistant with LIVE internet access. Your task is to search the web RIGHT NOW and find the MOST CURRENT and UP-TO-DATE information about a person.

CRITICAL: You MUST search for the LATEST information available TODAY. Do NOT use cached or old data. Always prioritize:
- Their CURRENT job title and company (as of today)
- Their LATEST social media posts and activity
- Recent news articles from 2024-2025
- Current follower counts and engagement

SEARCH THOROUGHLY FOR:
1. LinkedIn profile - CURRENT position and company
2. Twitter/X account - LATEST tweets and activity
3. YouTube channel - RECENT videos and subscriber count
4. Facebook, Instagram, TikTok - CURRENT profiles
5. Company website - CURRENT role
6. RECENT news articles and press mentions (last 12 months)
7. Recent podcasts, interviews, conference talks
8. Latest publications, books, articles

OUTPUT FORMAT: Return ONLY a valid JSON object (no markdown, no code blocks):
{
  "name": "Full verified name",
  "company": "Current company if found",
  "jobTitle": "Current job title if found",
  "location": "Location if found",
  "summary": "2-3 sentence summary based on VERIFIED information found online",
  "professionalBackground": "Their actual job titles, companies, education - only what you verified",
  "sectors": ["Array of 2-4 industries they work in"],
  "skills": ["Array of 4-6 professional skills"],
  "interests": ["Array of verified interests"],
  "iceBreakers": ["Array of 4-5 specific conversation starters"],
  "commonGround": ["Array of potential connection topics"],
  "approachTips": "Specific tips based on their online presence",
  "socialMedia": [
    {"platform": "LinkedIn", "url": "https://linkedin.com/in/...", "username": "their-username"},
    {"platform": "Twitter/X", "url": "https://twitter.com/...", "username": "@handle", "followers": "10K"},
    {"platform": "YouTube", "url": "https://youtube.com/...", "username": "channel-name", "followers": "subscribers count"},
    {"platform": "Instagram", "url": "https://instagram.com/...", "username": "@handle"},
    {"platform": "Facebook", "url": "https://facebook.com/...", "username": "profile"},
    {"platform": "TikTok", "url": "https://tiktok.com/...", "username": "@handle"},
    {"platform": "Website", "url": "https://their-website.com"}
  ],
  "sources": ["Array of URLs where you found information"]
}

IMPORTANT: Include ALL social media profiles you find. The socialMedia array should contain every platform where they have a presence.

If you cannot find information, still return JSON with what you can infer and note the limitations.`;

  const userPrompt = `Search the internet RIGHT NOW for the LATEST information about this person (as of today, January 2025):

**Name:** ${body.name}
${body.linkedIn ? `**LinkedIn:** ${body.linkedIn}` : ''}
${body.twitter ? `**Twitter/X:** ${body.twitter}` : ''}
${body.website ? `**Website:** ${body.website}` : ''}
${body.additionalInfo ? `**Additional Context:** ${body.additionalInfo}` : ''}

${mightBeArabic ? `
IMPORTANT: This person may have Arabic content. Also search:
- Arabic name variations
- Arabic social media and YouTube
- Middle Eastern news sources
` : ''}

IMPORTANT: I need their CURRENT information - not old data. Search for:
- Their CURRENT job and company (2024-2025)
- Their LATEST social media activity
- Recent news and articles about them
- Current follower/subscriber counts

Return the JSON profile with the most up-to-date information you can find.`;

  const response = await fetch('https://api.perplexity.ai/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'sonar-pro', // Best model with web search - has LIVE internet access
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.1, // Lower temperature for more factual responses
      max_tokens: 4000,
      return_citations: true,
      // No search_recency_filter - get ALL available data, both recent and historical
      // Perplexity will automatically prioritize recent results
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    console.error('Perplexity API error:', response.status, errorData);
    throw new Error(`Perplexity API error: ${response.status}`);
  }

  const data = await response.json();
  const content = data.choices[0]?.message?.content;
  const citations = data.citations || [];

  if (!content) {
    throw new Error('No response from Perplexity');
  }

  // Parse the JSON response
  let profileData: ProfileData;
  try {
    // Try to extract JSON from the response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      profileData = JSON.parse(jsonMatch[0]);
    } else {
      throw new Error('No JSON found in response');
    }

    // Add citations as sources if not already present
    if (citations.length > 0 && (!profileData.sources || profileData.sources.length === 0)) {
      profileData.sources = citations;
    }
  } catch (parseError) {
    console.error('Failed to parse Perplexity response:', parseError);
    // Return raw content if parsing fails
    return NextResponse.json({
      content: content,
      profileData: null,
      searchEngine: 'perplexity',
      warning: 'Could not parse structured data from search results',
    });
  }

  return NextResponse.json({
    content: content,
    profileData: profileData,
    searchEngine: 'perplexity',
  });
}

/**
 * Fallback to OpenAI (no web search, uses training data)
 */
async function searchWithOpenAI(body: ExplorerRequest, apiKey: string) {
  const systemPrompt = `You are a professional networking assistant. Based on the information provided, create a helpful profile analysis.

OUTPUT FORMAT: Return ONLY a valid JSON object:
{
  "name": "Full name",
  "summary": "2-3 sentence summary",
  "professionalBackground": "Likely professional background based on context",
  "sectors": ["Array of likely industries"],
  "skills": ["Array of likely skills"],
  "interests": ["Array of possible interests"],
  "iceBreakers": ["Array of 4-5 conversation starters"],
  "commonGround": ["Array of connection topics"],
  "approachTips": "General tips for approaching this person",
  "socialMedia": []
}

Note: You don't have internet access, so make educated inferences based on the provided information.`;

  const userPrompt = `Create a profile analysis for:

**Name:** ${body.name}
${body.linkedIn ? `**LinkedIn:** ${body.linkedIn}` : ''}
${body.twitter ? `**Twitter/X:** ${body.twitter}` : ''}
${body.website ? `**Website:** ${body.website}` : ''}
${body.additionalInfo ? `**Additional Context:** ${body.additionalInfo}` : ''}

Return the JSON profile based on what you can infer.`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.3,
      max_tokens: 4000,
    }),
  });

  if (!response.ok) {
    throw new Error('OpenAI API request failed');
  }

  const data = await response.json();
  const content = data.choices[0]?.message?.content;

  if (!content) {
    throw new Error('No response from AI');
  }

  let profileData: ProfileData;
  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      profileData = JSON.parse(jsonMatch[0]);
    } else {
      throw new Error('No JSON found');
    }
  } catch (parseError) {
    return NextResponse.json({
      content: content,
      profileData: null,
      searchEngine: 'openai',
      warning: 'Results based on AI inference only (no web search available)',
    });
  }

  return NextResponse.json({
    content: content,
    profileData: profileData,
    searchEngine: 'openai',
    warning: 'Results based on AI inference only. For real-time web search, ensure Perplexity API is configured.',
  });
}
