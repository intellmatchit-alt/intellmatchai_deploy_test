/**
 * Explorer Scan API Route
 *
 * Uses GPT-4o vision to extract information from business card images
 * and then searches for the person online.
 */

import { NextRequest, NextResponse } from 'next/server';

interface ScanRequest {
  images: { base64: string; mimeType: string }[];
}

interface ExtractedData {
  name?: string;
  company?: string;
  jobTitle?: string;
  email?: string;
  phone?: string;
  website?: string;
  linkedInUrl?: string;
  twitterUrl?: string;
  location?: string;
  additionalInfo?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: ScanRequest = await request.json();

    if (!body.images || body.images.length === 0) {
      return NextResponse.json(
        { error: 'No images provided' },
        { status: 400 }
      );
    }

    const openaiKey = process.env.OPENAI_API_KEY;
    if (!openaiKey) {
      return NextResponse.json(
        { error: 'OpenAI API key not configured' },
        { status: 500 }
      );
    }

    // Process all images with GPT-4o vision
    const extractedDataList: ExtractedData[] = [];

    for (const image of body.images) {
      try {
        const extracted = await extractFromImageWithGPT(image.base64, image.mimeType, openaiKey);
        if (extracted) {
          extractedDataList.push(extracted);
        }
      } catch (error) {
        console.error('Failed to extract from image:', error);
      }
    }

    if (extractedDataList.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Could not extract any data from the images',
      });
    }

    // Merge extracted data from all images
    const mergedData = mergeExtractedData(extractedDataList);

    // If we have a name, search for the person online
    if (mergedData.name) {
      const perplexityKey = process.env.PERPLEXITY_API_KEY;

      if (perplexityKey) {
        try {
          const searchResult = await searchPersonOnline(mergedData, perplexityKey);
          return NextResponse.json({
            success: true,
            extractedData: mergedData,
            profileData: searchResult.profileData,
            searchEngine: 'perplexity',
          });
        } catch (error) {
          console.error('Online search failed:', error);
        }
      }
    }

    // Return just the extracted data if search fails or no name found
    return NextResponse.json({
      success: true,
      extractedData: mergedData,
      profileData: null,
      warning: mergedData.name ? 'Could not search online' : 'No name found in images',
    });

  } catch (error: any) {
    console.error('Scan API error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Extract contact information from an image using GPT-4o vision
 */
async function extractFromImageWithGPT(
  base64: string,
  mimeType: string,
  apiKey: string
): Promise<ExtractedData | null> {
  const systemPrompt = `You are an expert at reading business cards and extracting contact information.
Analyze the image and extract ALL visible information.

Return ONLY a valid JSON object with these fields (omit fields that are not visible):
{
  "name": "Full name of the person",
  "company": "Company or organization name",
  "jobTitle": "Job title or position",
  "email": "Email address",
  "phone": "Phone number(s)",
  "website": "Website URL",
  "linkedInUrl": "LinkedIn profile URL if visible",
  "twitterUrl": "Twitter/X handle or URL if visible",
  "location": "Address or location",
  "additionalInfo": "Any other relevant information (certifications, taglines, etc.)"
}

IMPORTANT:
- Extract the EXACT text as shown on the card
- For names, include any titles (Dr., Eng., etc.)
- For URLs, include the full URL if visible
- If a field is not visible or unclear, omit it from the JSON
- Return ONLY the JSON, no explanation`;

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
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Extract all contact information from this business card image:',
            },
            {
              type: 'image_url',
              image_url: {
                url: `data:${mimeType};base64,${base64}`,
                detail: 'high',
              },
            },
          ],
        },
      ],
      max_tokens: 1000,
      temperature: 0.1,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    console.error('GPT-4o vision API error:', response.status, error);
    throw new Error(`GPT-4o API error: ${response.status}`);
  }

  const data = await response.json();
  const content = data.choices[0]?.message?.content;

  if (!content) {
    return null;
  }

  try {
    // Remove markdown code blocks if present
    let cleanedContent = content.trim();
    if (cleanedContent.startsWith('```')) {
      cleanedContent = cleanedContent.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
    }
    return JSON.parse(cleanedContent);
  } catch (error) {
    console.error('Failed to parse GPT response:', content);
    return null;
  }
}

/**
 * Merge extracted data from multiple images
 */
function mergeExtractedData(dataList: ExtractedData[]): ExtractedData {
  const merged: ExtractedData = {};

  for (const data of dataList) {
    // Use the first non-empty value for each field
    if (data.name && !merged.name) merged.name = data.name;
    if (data.company && !merged.company) merged.company = data.company;
    if (data.jobTitle && !merged.jobTitle) merged.jobTitle = data.jobTitle;
    if (data.email && !merged.email) merged.email = data.email;
    if (data.phone && !merged.phone) merged.phone = data.phone;
    if (data.website && !merged.website) merged.website = data.website;
    if (data.linkedInUrl && !merged.linkedInUrl) merged.linkedInUrl = data.linkedInUrl;
    if (data.twitterUrl && !merged.twitterUrl) merged.twitterUrl = data.twitterUrl;
    if (data.location && !merged.location) merged.location = data.location;

    // Concatenate additional info
    if (data.additionalInfo) {
      merged.additionalInfo = merged.additionalInfo
        ? `${merged.additionalInfo}; ${data.additionalInfo}`
        : data.additionalInfo;
    }
  }

  return merged;
}

/**
 * Search for person online using Google CSE + Perplexity for latest data
 */
async function searchPersonOnline(
  data: ExtractedData,
  perplexityKey: string
): Promise<{ profileData: any }> {
  const googleApiKey = process.env.GOOGLE_CSE_API_KEY;
  const googleCx = process.env.GOOGLE_CSE_CX;

  // Step 1: Search Google for LinkedIn profile and recent news
  let googleResults: { linkedInUrl?: string; snippets: string[]; urls: string[] } = {
    snippets: [],
    urls: [],
  };

  if (googleApiKey && googleCx) {
    try {
      // Search specifically for LinkedIn profile
      const linkedInQuery = `${data.name} ${data.company || ''} site:linkedin.com/in`;
      const linkedInResults = await searchGoogle(linkedInQuery, googleApiKey, googleCx);

      if (linkedInResults.items?.length > 0) {
        const linkedInItem = linkedInResults.items.find((item: any) =>
          item.link?.includes('linkedin.com/in/')
        );
        if (linkedInItem) {
          googleResults.linkedInUrl = linkedInItem.link;
          googleResults.snippets.push(linkedInItem.snippet || '');
        }
      }

      // Search for recent news/articles
      const newsQuery = `"${data.name}" ${data.company || ''} 2024 OR 2025`;
      const newsResults = await searchGoogle(newsQuery, googleApiKey, googleCx);

      if (newsResults.items?.length > 0) {
        for (const item of newsResults.items.slice(0, 5)) {
          googleResults.snippets.push(item.snippet || '');
          googleResults.urls.push(item.link);
        }
      }
    } catch (error) {
      console.error('Google search failed:', error);
    }
  }

  // Step 2: Use Perplexity with Google results context for most accurate data
  const context = [
    data.company ? `Company: ${data.company}` : '',
    data.jobTitle ? `Job Title: ${data.jobTitle}` : '',
    data.location ? `Location: ${data.location}` : '',
    data.additionalInfo || '',
  ].filter(Boolean).join('. ');

  const googleContext = googleResults.snippets.length > 0
    ? `\n\nGOOGLE SEARCH RESULTS (use these as reference):\n${googleResults.snippets.join('\n')}`
    : '';

  const linkedInContext = googleResults.linkedInUrl || data.linkedInUrl
    ? `\n\nLINKEDIN PROFILE URL: ${googleResults.linkedInUrl || data.linkedInUrl}\nIMPORTANT: Visit this LinkedIn profile and extract the CURRENT job title, company, and experience.`
    : '';

  const systemPrompt = `You are an expert research assistant with LIVE internet access. Your PRIMARY task is to find the person's CURRENT LinkedIn profile and extract their LATEST information.

CRITICAL INSTRUCTIONS:
1. FIRST search for and visit their LinkedIn profile
2. Extract their CURRENT job title and company from LinkedIn (not old data)
3. Look for recent posts, articles, or news from 2024-2025
4. Find all their social media profiles with CURRENT follower counts

DO NOT use cached or outdated information. I need data from TODAY.

OUTPUT FORMAT: Return ONLY a valid JSON object:
{
  "name": "Full name as shown on LinkedIn",
  "company": "CURRENT company from LinkedIn profile",
  "jobTitle": "CURRENT job title from LinkedIn profile",
  "location": "Current location",
  "summary": "2-3 sentences about who they are RIGHT NOW",
  "professionalBackground": "Their career history from LinkedIn",
  "sectors": ["Industries from their LinkedIn"],
  "skills": ["Top skills from LinkedIn"],
  "interests": ["Interests based on their activity"],
  "iceBreakers": ["5 specific ice breaker messages to start a conversation based on their RECENT activity - make them personal and engaging"],
  "commonGround": ["Topics to connect on"],
  "approachTips": "How to approach them based on their LinkedIn activity",
  "socialMedia": [
    {"platform": "LinkedIn", "url": "full-linkedin-url", "username": "profile-id"},
    {"platform": "Twitter/X", "url": "...", "username": "@handle", "followers": "count"},
    {"platform": "YouTube", "url": "...", "followers": "subscribers"},
    {"platform": "Instagram", "url": "...", "username": "@handle"},
    {"platform": "Website", "url": "..."}
  ],
  "sources": ["LinkedIn URL and other sources"]
}`;

  const userPrompt = `Find the CURRENT LinkedIn profile and LATEST information about this person (as of January 2025):

**Name:** ${data.name}
${linkedInContext}
${data.twitterUrl ? `**Twitter:** ${data.twitterUrl}` : ''}
${data.website ? `**Website:** ${data.website}` : ''}
${context ? `**Business Card Info:** ${context}` : ''}
${googleContext}

IMPORTANT:
1. Search LinkedIn for "${data.name}" and find their CURRENT profile
2. Get their CURRENT job title and company (not previous jobs)
3. Look for their LATEST posts and activity
4. Find recent news or mentions from 2024-2025
5. Get current social media follower counts

Return the JSON with the most UP-TO-DATE information you can find.`;

  const response = await fetch('https://api.perplexity.ai/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${perplexityKey}`,
    },
    body: JSON.stringify({
      model: 'sonar-pro',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.1,
      max_tokens: 4000,
      return_citations: true,
      search_recency_filter: 'month', // Only recent results
    }),
  });

  if (!response.ok) {
    throw new Error(`Perplexity API error: ${response.status}`);
  }

  const result = await response.json();
  const content = result.choices[0]?.message?.content;
  const citations = result.citations || [];

  if (!content) {
    throw new Error('No response from Perplexity');
  }

  // Parse JSON response
  let profileData;
  try {
    // Remove markdown code blocks if present
    let cleanedContent = content.trim();
    if (cleanedContent.startsWith('```')) {
      cleanedContent = cleanedContent.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
    }

    const jsonMatch = cleanedContent.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      profileData = JSON.parse(jsonMatch[0]);

      // Add Google-found LinkedIn URL if not in response
      if (googleResults.linkedInUrl && !profileData.socialMedia?.find((s: any) => s.platform === 'LinkedIn')?.url) {
        if (!profileData.socialMedia) profileData.socialMedia = [];
        const linkedInEntry = profileData.socialMedia.find((s: any) => s.platform === 'LinkedIn');
        if (linkedInEntry) {
          linkedInEntry.url = googleResults.linkedInUrl;
        } else {
          profileData.socialMedia.unshift({
            platform: 'LinkedIn',
            url: googleResults.linkedInUrl,
          });
        }
      }

      // Add citations as sources
      if (citations.length > 0) {
        profileData.sources = [...new Set([...(profileData.sources || []), ...citations])];
      }
      if (googleResults.urls.length > 0) {
        profileData.sources = [...new Set([...(profileData.sources || []), ...googleResults.urls])];
      }
    }
  } catch (error) {
    console.error('Failed to parse search response:', error);
    profileData = null;
  }

  return { profileData };
}

/**
 * Search Google using Custom Search API
 */
async function searchGoogle(query: string, apiKey: string, cx: string): Promise<any> {
  const url = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${cx}&q=${encodeURIComponent(query)}&num=10`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Google API error: ${response.status}`);
  }

  return response.json();
}
