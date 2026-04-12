/**
 * Explorer API Route
 *
 * Profile research using ScrapIn LinkedIn data + GPT-4o for ice breakers.
 * No Perplexity. ScrapIn provides the real data, GPT generates conversation starters.
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyApiAuth } from '@/lib/api/auth-guard';
import { fetchPostsWithScrapIn, ScrapInPost } from '@/lib/services/enrichment/ScrapInEnrichmentService';

interface ScrapInPosition {
  title?: string;
  company?: string;
  startDate?: string;
  endDate?: string;
  isCurrent?: boolean;
  description?: string;
  companyLogo?: string;
  location?: string;
}

interface LinkedInPost {
  text?: string;
  reactionsCount?: number;
  commentsCount?: number;
  activityDate?: string;
  activityUrl?: string;
}

interface ScrapInData {
  photoUrl?: string;
  company?: string;
  jobTitle?: string;
  location?: string;
  headline?: string;
  linkedInUrl?: string;
  summary?: string;
  positions?: ScrapInPosition[];
  skills?: string[];
  education?: Array<{ school?: string; degree?: string; field?: string }>;
}

interface ExplorerRequest {
  name: string;
  linkedIn?: string;
  twitter?: string;
  website?: string;
  additionalInfo?: string;
  scrapInData?: ScrapInData;
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
  photoUrl?: string;
  positions?: ScrapInPosition[];
  latestActivity?: string;
  latestPostDate?: string;
  posts?: LinkedInPost[];
}

export async function POST(request: NextRequest) {
  try {
    const auth = await verifyApiAuth(request);
    if (auth instanceof NextResponse) return auth;

    const body: ExplorerRequest = await request.json();

    if (!body.name) {
      return NextResponse.json(
        { error: 'Name is required' },
        { status: 400 }
      );
    }

    // If we have ScrapIn data, build profile directly from it + GPT for ice breakers
    if (body.scrapInData) {
      return await buildProfileFromScrapIn(body);
    }

    // No ScrapIn data — fallback to OpenAI inference only
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
 * Build profile directly from ScrapIn data + GPT-4o for ice breakers/tips
 */
async function buildProfileFromScrapIn(body: ExplorerRequest) {
  const d = body.scrapInData!;

  // Build professional background from positions
  const positionLines = (d.positions || []).map(p => {
    const dates = [p.startDate, p.isCurrent ? 'Present' : p.endDate].filter(Boolean).join(' - ');
    return `${p.title || 'Unknown Role'} at ${p.company || 'Unknown Company'} (${dates})${p.description ? ': ' + p.description : ''}`;
  });

  const educationLines = (d.education || []).map(e =>
    `${e.degree || ''} ${e.field ? `in ${e.field}` : ''} at ${e.school || 'Unknown'}`.trim()
  );

  const professionalBackground = [
    ...positionLines,
    educationLines.length > 0 ? `Education: ${educationLines.join('; ')}` : '',
  ].filter(Boolean).join('. ');

  // Infer sectors from positions and skills
  const sectors = inferSectors(d);

  // Build social media
  const socialMedia: SocialMediaAccount[] = [];
  if (d.linkedInUrl) {
    socialMedia.push({ platform: 'LinkedIn', url: d.linkedInUrl });
  }

  // Fetch LinkedIn posts in parallel with building the profile
  let posts: LinkedInPost[] = [];
  let latestPostDate: string | undefined;
  if (d.linkedInUrl) {
    try {
      const rawPosts = await fetchPostsWithScrapIn(d.linkedInUrl);
      posts = rawPosts.slice(0, 10).map(p => ({
        text: p.text,
        reactionsCount: p.reactionsCount,
        commentsCount: p.commentsCount,
        activityDate: p.activityDate,
        activityUrl: p.activityUrl || p.shareUrl,
      }));
      // Get the latest post date (posts are already sorted by date, most recent first)
      if (posts.length > 0 && posts[0].activityDate) {
        latestPostDate = posts[0].activityDate;
      }
    } catch (err) {
      console.error('[Explorer] Failed to fetch posts:', err);
    }
  }

  // Build base profile
  const profileData: ProfileData = {
    name: body.name,
    summary: d.summary || d.headline || `${d.jobTitle || 'Professional'} at ${d.company || 'their company'}`,
    professionalBackground,
    sectors,
    skills: d.skills || [],
    interests: [],
    iceBreakers: [],
    commonGround: [],
    approachTips: '',
    socialMedia,
    company: d.company,
    jobTitle: d.jobTitle,
    location: d.location,
    photoUrl: d.photoUrl,
    positions: d.positions,
    posts: posts.length > 0 ? posts : undefined,
    latestPostDate,
  };

  // Use GPT-4o to generate ice breakers, interests, approach tips from the ScrapIn data + posts
  const openaiKey = process.env.OPENAI_API_KEY;
  if (openaiKey) {
    try {
      const aiEnhancements = await generateAIEnhancements(body.name, d, openaiKey, posts);
      if (aiEnhancements) {
        profileData.iceBreakers = aiEnhancements.iceBreakers || [];
        profileData.commonGround = aiEnhancements.commonGround || [];
        profileData.approachTips = aiEnhancements.approachTips || '';
        profileData.interests = aiEnhancements.interests || [];
        if (aiEnhancements.latestActivity) {
          profileData.latestActivity = aiEnhancements.latestActivity;
        }
        // Use AI summary if ScrapIn summary is short
        if (aiEnhancements.summary && (!d.summary || d.summary.length < 50)) {
          profileData.summary = aiEnhancements.summary;
        }
      }
    } catch (err) {
      console.error('[Explorer] GPT enhancement failed, using ScrapIn data only:', err);
    }
  }

  // Fallback ice breakers if GPT failed
  if (profileData.iceBreakers.length === 0) {
    profileData.iceBreakers = generateFallbackIceBreakers(d);
  }

  return NextResponse.json({
    profileData,
    searchEngine: 'scrapin',
  });
}

/**
 * Use GPT-4o to generate ice breakers, approach tips, and interests from ScrapIn data
 */
async function generateAIEnhancements(name: string, d: ScrapInData, apiKey: string, posts: LinkedInPost[] = []) {
  const positionSummary = (d.positions || []).slice(0, 5).map(p => {
    const dates = [p.startDate, p.isCurrent ? 'Present' : p.endDate].filter(Boolean).join(' - ');
    return `${p.title || '?'} at ${p.company || '?'} (${dates})`;
  }).join('\n');

  // Build posts section for GPT context
  const recentPosts = posts.slice(0, 5);
  const latestPostDate = recentPosts[0]?.activityDate ? new Date(recentPosts[0].activityDate).toLocaleDateString() : null;
  const postsSection = recentPosts.length > 0
    ? `\n\n=== RECENT LINKEDIN POSTS (MOST IMPORTANT FOR ICE BREAKERS) ===
Latest post was on: ${latestPostDate || 'Unknown'}
${recentPosts.map((p, i) => {
        const date = p.activityDate ? new Date(p.activityDate).toLocaleDateString() : '?';
        const engagement = [p.reactionsCount ? `${p.reactionsCount} reactions` : '', p.commentsCount ? `${p.commentsCount} comments` : ''].filter(Boolean).join(', ');
        const text = (p.text || '').slice(0, 400);
        return `POST ${i + 1} [${date}]${engagement ? ` - ${engagement}` : ''}:\n"${text}"`;
      }).join('\n\n')}`
    : '';

  const prompt = `Based on this LinkedIn profile data, generate networking insights.

Name: ${name}
Headline: ${d.headline || 'N/A'}
Current: ${d.jobTitle || '?'} at ${d.company || '?'}
Location: ${d.location || 'N/A'}
Bio: ${d.summary || 'N/A'}
Work History:
${positionSummary || 'N/A'}
Skills: ${(d.skills || []).slice(0, 15).join(', ') || 'N/A'}
Education: ${(d.education || []).map(e => `${e.degree || ''} ${e.field ? 'in ' + e.field : ''} at ${e.school || '?'}`).join(', ') || 'N/A'}${postsSection}

Return ONLY valid JSON:
{
  "summary": "2-3 sentence professional summary",
  "iceBreakers": ["5 specific conversation starters${recentPosts.length > 0 ? ' — AT LEAST 3 MUST reference their recent LinkedIn posts with specific details from the post content' : ''}, referencing their current role, career transitions, skills, or achievements"],
  "commonGround": ["4-5 potential networking topics${recentPosts.length > 0 ? ' derived from their posts and profile' : ''}"],
  "interests": ["3-5 likely interests based on their career${recentPosts.length > 0 ? ' and the topics they post about' : ''}"],
  "approachTips": "2-3 sentences on the best way to approach this person${recentPosts.length > 0 ? '. Start by mentioning their most recent post (from ' + latestPostDate + ') as a natural conversation opener' : ''}",
  "latestActivity": "${recentPosts.length > 0 ? 'Describe what they recently posted about on LinkedIn (include specific topics, events, or ideas from their posts). Mention the date of their latest post.' : 'Brief note about their most recent career move or position change based on the data'}"
}

Make ice breakers SPECIFIC to this person — reference their actual company, role, career path, or skills.${recentPosts.length > 0 ? `

CRITICAL: You have access to their ACTUAL LinkedIn posts above. Use them!
- Their latest post was on ${latestPostDate}
- Reference SPECIFIC content from their posts (events they attended, topics they discussed, opinions they shared)
- Example: "I saw your post about the Global Labor Market Conference in Riyadh — what were your key takeaways?"
- This shows you've done your research and creates an authentic, personalized connection.` : ''} Not generic.`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'user', content: prompt },
      ],
      temperature: 0.4,
      max_tokens: 1500,
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.status}`);
  }

  const data = await response.json();
  const content = data.choices[0]?.message?.content;
  if (!content) return null;

  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;

  return JSON.parse(jsonMatch[0]);
}

/**
 * Generate fallback ice breakers without AI
 */
function generateFallbackIceBreakers(d: ScrapInData): string[] {
  const breakers: string[] = [];

  if (d.jobTitle && d.company) {
    breakers.push(`I see you're working as ${d.jobTitle} at ${d.company} — how's that going?`);
  }
  if (d.positions && d.positions.length > 1) {
    const prev = d.positions[1];
    if (prev.company && prev.company !== d.company) {
      breakers.push(`Interesting career path from ${prev.company} to ${d.company} — what motivated the move?`);
    }
  }
  if (d.headline) {
    breakers.push(`Your headline "${d.headline}" caught my attention — I'd love to learn more about what you do.`);
  }
  if (d.skills && d.skills.length > 0) {
    breakers.push(`I noticed your expertise in ${d.skills.slice(0, 3).join(', ')} — would love to connect on that.`);
  }
  if (d.education && d.education.length > 0 && d.education[0].school) {
    breakers.push(`Fellow ${d.education[0].field || 'graduate'} from ${d.education[0].school} — great to connect!`);
  }

  return breakers.length > 0 ? breakers : ['Would love to connect and learn more about your work!'];
}

/**
 * Infer industry sectors from positions and skills
 */
function inferSectors(d: ScrapInData): string[] {
  const sectors = new Set<string>();
  const text = [
    d.headline || '',
    d.summary || '',
    ...(d.positions || []).map(p => `${p.title || ''} ${p.company || ''} ${p.description || ''}`),
    ...(d.skills || []),
  ].join(' ').toLowerCase();

  const sectorMap: Record<string, string[]> = {
    'Technology': ['software', 'developer', 'engineer', 'tech', 'programming', 'coding', 'IT', 'devops', 'cloud', 'saas'],
    'Finance': ['finance', 'banking', 'investment', 'fintech', 'accounting', 'financial'],
    'Healthcare': ['health', 'medical', 'pharma', 'biotech', 'clinical', 'hospital'],
    'Education': ['education', 'university', 'teaching', 'academic', 'professor', 'school'],
    'Marketing': ['marketing', 'advertising', 'brand', 'digital marketing', 'seo', 'content'],
    'Consulting': ['consulting', 'advisory', 'consultant', 'strategy'],
    'Entrepreneurship': ['founder', 'co-founder', 'startup', 'entrepreneur', 'ceo', 'cto'],
    'E-commerce': ['ecommerce', 'e-commerce', 'retail', 'marketplace'],
    'AI & Data': ['artificial intelligence', 'machine learning', 'data science', 'ai', 'ml', 'deep learning'],
    'Design': ['design', 'ux', 'ui', 'creative', 'graphic'],
  };

  for (const [sector, keywords] of Object.entries(sectorMap)) {
    if (keywords.some(kw => text.includes(kw))) {
      sectors.add(sector);
    }
  }

  return sectors.size > 0 ? Array.from(sectors).slice(0, 4) : ['Professional Services'];
}

/**
 * Fallback to OpenAI when no ScrapIn data available
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
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.3,
      max_tokens: 2000,
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
      warning: 'Could not parse AI response',
    });
  }

  return NextResponse.json({
    profileData: profileData,
    searchEngine: 'openai',
    warning: 'No LinkedIn profile selected. Results based on AI inference only.',
  });
}
