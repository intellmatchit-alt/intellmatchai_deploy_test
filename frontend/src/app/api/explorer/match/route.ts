/**
 * Explorer Match API Route
 *
 * Calculates compatibility between the logged-in user's profile and a
 * discovered LinkedIn profile. Uses a simplified version of the backend
 * matching algorithm (sector overlap, skill match, goal alignment,
 * complementary skills, location).
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyApiAuth } from '@/lib/api/auth-guard';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

interface DiscoveredProfileInput {
  firstName?: string;
  lastName?: string;
  headline?: string;
  currentCompany?: string;
  currentTitle?: string;
  location?: string;
  skills?: string[];
  summary?: string;
  sectors?: string[];
  positions?: Array<{
    title?: string;
    company?: string;
    description?: string;
  }>;
  education?: Array<{
    school?: string;
    degree?: string;
    field?: string;
  }>;
}

interface MatchBreakdown {
  sectorScore: number;
  skillScore: number;
  goalAlignmentScore: number;
  complementarySkillsScore: number;
  locationScore: number;
  experienceScore: number;
}

interface MatchIntersection {
  type: 'sector' | 'skill' | 'goal' | 'complementary' | 'location' | 'company';
  label: string;
}

interface MatchResponse {
  score: number;
  breakdown: MatchBreakdown;
  intersections: MatchIntersection[];
  reasons: string[];
}

// Weights for the simplified scoring
const WEIGHTS = {
  sector: 0.25,
  skill: 0.20,
  goalAlignment: 0.25,
  complementarySkills: 0.15,
  location: 0.08,
  experience: 0.07,
};

// Same complementary skills matrix as backend
const COMPLEMENTARY_SKILLS: Record<string, string[]> = {
  'Sales': ['Marketing', 'Business Development', 'Communication', 'Negotiation'],
  'Marketing': ['Sales', 'Content', 'Analytics', 'Social Media', 'SEO'],
  'Frontend Development': ['Backend Development', 'UI/UX Design', 'DevOps', 'Mobile Development'],
  'Backend Development': ['Frontend Development', 'DevOps', 'Data Engineering', 'Cloud', 'Database'],
  'Full Stack Development': ['DevOps', 'Cloud', 'UI/UX Design'],
  'Mobile Development': ['Frontend Development', 'UI/UX Design', 'Backend Development'],
  'DevOps': ['Backend Development', 'Cloud', 'Security', 'Infrastructure'],
  'Cloud': ['DevOps', 'Backend Development', 'Security', 'Infrastructure'],
  'Data Analysis': ['Data Science', 'Business Intelligence', 'Machine Learning', 'Statistics'],
  'Data Science': ['Machine Learning', 'Data Analysis', 'AI', 'Python', 'Statistics'],
  'Machine Learning': ['Data Science', 'AI', 'Python', 'Deep Learning'],
  'AI': ['Machine Learning', 'Data Science', 'Deep Learning', 'NLP'],
  'UI/UX Design': ['Product Design', 'Frontend Development', 'Research', 'Figma'],
  'Product Management': ['Engineering', 'Design', 'Marketing', 'Data Analysis', 'Strategy'],
  'Project Management': ['Product Management', 'Agile', 'Scrum', 'Operations'],
  'Business Development': ['Sales', 'Marketing', 'Strategy', 'Partnerships'],
  'Strategy': ['Business Development', 'Finance', 'Operations', 'Consulting'],
  'Consulting': ['Strategy', 'Business Analysis', 'Project Management'],
  'Finance': ['Legal', 'Strategy', 'Operations', 'Accounting'],
  'Operations': ['Project Management', 'Strategy', 'Finance', 'Supply Chain'],
  'Content': ['Marketing', 'SEO', 'Social Media', 'Writing'],
  'Leadership': ['Management', 'Strategy', 'Team Building', 'Communication'],
  'Management': ['Leadership', 'Operations', 'Strategy', 'HR'],
};

// Senior role patterns
const SENIOR_ROLE_PATTERNS = [
  /\b(ceo|cto|cfo|coo|cmo|cio|chief)\b/i,
  /\b(president|vp|vice\s*president)\b/i,
  /\b(director|head\s+of|lead)\b/i,
  /\b(senior|sr\.?|principal|staff)\b/i,
  /\b(founder|co-?founder|partner)\b/i,
  /\b(managing\s+director|md)\b/i,
  /\b(executive|evp|svp)\b/i,
];

const INVESTOR_ROLE_PATTERNS = [
  /\b(investor|venture\s*capital|vc)\b/i,
  /\b(angel|seed|funding)\b/i,
  /\b(portfolio|investment|fund)\b/i,
];

const HIRING_ROLE_PATTERNS = [
  /\b(recruiter|recruiting|talent)\b/i,
  /\b(hr|human\s*resources)\b/i,
  /\b(hiring\s*manager)\b/i,
];

// Sector inference from text (same as explorer route)
const SECTOR_MAP: Record<string, string[]> = {
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
  'Real Estate': ['real estate', 'property', 'construction', 'architecture'],
  'Energy': ['energy', 'oil', 'gas', 'renewable', 'solar', 'petroleum'],
  'Legal': ['legal', 'law', 'attorney', 'lawyer', 'compliance'],
  'Media': ['media', 'journalism', 'broadcasting', 'publishing', 'content creation'],
  'Manufacturing': ['manufacturing', 'production', 'factory', 'industrial'],
  'Hospitality': ['hospitality', 'hotel', 'tourism', 'travel', 'restaurant'],
};

export async function POST(request: NextRequest) {
  try {
    const auth = await verifyApiAuth(request);
    if (auth instanceof NextResponse) return auth;

    const body: DiscoveredProfileInput = await request.json();

    // Forward auth token to backend to get user profile
    const authHeader = request.headers.get('authorization');
    const cookieHeader = request.headers.get('cookie');

    // Try to get access token from cookie or header
    let accessToken = '';
    if (authHeader) {
      accessToken = authHeader.replace('Bearer ', '');
    } else if (cookieHeader) {
      const match = cookieHeader.match(/p2p_access_token=([^;]+)/);
      if (match) accessToken = match[1];
    }

    if (!accessToken) {
      // Try from body as fallback
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Fetch user profile from backend
    const profileRes = await fetch(`${API_BASE_URL}/profile`, {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    });

    if (!profileRes.ok) {
      return NextResponse.json({ error: 'Failed to fetch profile' }, { status: 500 });
    }

    const profileData = await profileRes.json();
    const profile = profileData.data || profileData;

    if (!profile || !profile.id) {
      return NextResponse.json({ error: 'Invalid profile data' }, { status: 500 });
    }

    // Calculate match
    const result = calculateMatch(profile, body);

    return NextResponse.json({ success: true, match: result });
  } catch (error: any) {
    console.error('[Explorer Match] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal error' },
      { status: 500 }
    );
  }
}

function calculateMatch(
  userProfile: any,
  discovered: DiscoveredProfileInput
): MatchResponse {
  const intersections: MatchIntersection[] = [];
  const reasons: string[] = [];

  // --- 1. Sector Score ---
  const userSectorNames = (userProfile.sectors || []).map((s: any) =>
    (s.name || '').toLowerCase()
  );

  // Infer sectors from the discovered profile
  const discoveredText = [
    discovered.headline || '',
    discovered.summary || '',
    discovered.currentTitle || '',
    discovered.currentCompany || '',
    ...(discovered.positions || []).map(p => `${p.title || ''} ${p.company || ''} ${p.description || ''}`),
    ...(discovered.skills || []),
    ...(discovered.sectors || []),
  ].join(' ').toLowerCase();

  const discoveredSectors = new Set<string>();
  // First add explicitly provided sectors
  if (discovered.sectors) {
    for (const s of discovered.sectors) {
      discoveredSectors.add(s.toLowerCase());
    }
  }
  // Then infer from text
  for (const [sector, keywords] of Object.entries(SECTOR_MAP)) {
    if (keywords.some(kw => discoveredText.includes(kw))) {
      discoveredSectors.add(sector.toLowerCase());
    }
  }

  let sectorMatches = 0;
  for (const us of userSectorNames) {
    for (const ds of discoveredSectors) {
      if (us.includes(ds) || ds.includes(us)) {
        sectorMatches++;
        intersections.push({ type: 'sector', label: us });
        break;
      }
    }
  }

  const sectorUnion = Math.max(1, new Set([...userSectorNames, ...discoveredSectors]).size);
  const sectorScore = Math.min(100, Math.round((sectorMatches / sectorUnion) * 100) + (sectorMatches > 0 ? 20 : 0));

  if (sectorMatches > 0) {
    reasons.push(`Shares ${sectorMatches} industry sector${sectorMatches > 1 ? 's' : ''}`);
  }

  // --- 2. Skill Score ---
  const userSkillNames = (userProfile.skills || []).map((s: any) =>
    (s.name || '').toLowerCase()
  );
  const discoveredSkillNames = (discovered.skills || []).map(s => s.toLowerCase());

  let skillMatches = 0;
  const matchedSkills: string[] = [];
  for (const us of userSkillNames) {
    for (const ds of discoveredSkillNames) {
      if (us === ds || us.includes(ds) || ds.includes(us)) {
        skillMatches++;
        matchedSkills.push(us);
        intersections.push({ type: 'skill', label: us });
        break;
      }
    }
  }

  const skillUnion = Math.max(1, new Set([...userSkillNames, ...discoveredSkillNames]).size);
  const skillScore = Math.min(100, Math.round((skillMatches / skillUnion) * 100) + (skillMatches > 0 ? 15 : 0));

  if (skillMatches > 0) {
    reasons.push(`${skillMatches} shared skill${skillMatches > 1 ? 's' : ''}: ${matchedSkills.slice(0, 3).join(', ')}`);
  }

  // --- 3. Goal Alignment ---
  const userGoals = userProfile.goals || [];
  const contactTitle = (discovered.currentTitle || '').toLowerCase();
  const contactCompany = (discovered.currentCompany || '').toLowerCase();
  const isSenior = SENIOR_ROLE_PATTERNS.some(p => p.test(contactTitle));
  const isInvestor = INVESTOR_ROLE_PATTERNS.some(p => p.test(contactTitle));
  const isHiring = HIRING_ROLE_PATTERNS.some(p => p.test(contactTitle));

  let goalScore = 0;
  for (const goal of userGoals) {
    const type = goal.type || goal.goalType || '';
    switch (type) {
      case 'MENTORSHIP':
        if (isSenior) { goalScore += 40; intersections.push({ type: 'goal', label: 'Potential mentor (senior role)' }); }
        if (sectorMatches > 0) goalScore += 30;
        break;
      case 'INVESTMENT':
        if (isInvestor) { goalScore += 50; intersections.push({ type: 'goal', label: 'Investor/VC' }); }
        break;
      case 'PARTNERSHIP':
        if (sectorMatches > 0) goalScore += 30;
        if (skillMatches > 0) goalScore += 40;
        if (goalScore > 0) intersections.push({ type: 'goal', label: 'Partnership potential' });
        break;
      case 'HIRING':
        if (discoveredSkillNames.length > 0) goalScore += 30;
        if (sectorMatches > 0) goalScore += 20;
        break;
      case 'JOB_SEEKING':
        if (isHiring) { goalScore += 50; intersections.push({ type: 'goal', label: 'Recruiter/HR' }); }
        if (isSenior && sectorMatches > 0) goalScore += 30;
        break;
      case 'COLLABORATION':
        if (sectorMatches > 0) goalScore += 30;
        if (skillMatches > 0) goalScore += 40;
        if (goalScore > 0) intersections.push({ type: 'goal', label: 'Collaboration fit' });
        break;
      case 'LEARNING':
        if (isSenior) goalScore += 35;
        if (discoveredSkillNames.length > 0) goalScore += 25;
        break;
      case 'SALES':
        if (isSenior) goalScore += 30;
        if (sectorMatches > 0) goalScore += 20;
        break;
    }
  }
  const goalAlignmentScore = userGoals.length > 0
    ? Math.min(100, Math.round(goalScore / userGoals.length))
    : 0;

  if (goalAlignmentScore > 30) {
    reasons.push('Aligns with your networking goals');
  }

  // --- 4. Complementary Skills ---
  let compScore = 0;
  const compMatches: string[] = [];
  for (const us of userSkillNames) {
    const complements = COMPLEMENTARY_SKILLS[us] || [];
    for (const comp of complements) {
      if (discoveredSkillNames.some(ds => ds.includes(comp.toLowerCase()) || comp.toLowerCase().includes(ds))) {
        compScore += 25;
        if (!compMatches.includes(comp)) {
          compMatches.push(comp);
          intersections.push({ type: 'complementary', label: `${us} + ${comp}` });
        }
      }
    }
  }
  const complementarySkillsScore = Math.min(100, compScore);

  if (compMatches.length > 0) {
    reasons.push(`Complementary skills: ${compMatches.slice(0, 2).join(', ')}`);
  }

  // --- 5. Location Score ---
  let locationScore = 0;
  const userLocation = (userProfile.location || '').toLowerCase();
  const discoveredLocation = (discovered.location || '').toLowerCase();
  if (userLocation && discoveredLocation) {
    const userParts = userLocation.split(/[,\s]+/).filter(Boolean);
    const discParts = discoveredLocation.split(/[,\s]+/).filter(Boolean);
    for (const up of userParts) {
      if (up.length > 2 && discParts.some(dp => dp.includes(up) || up.includes(dp))) {
        locationScore = 100;
        intersections.push({ type: 'location', label: discovered.location || '' });
        reasons.push(`Same location: ${discovered.location}`);
        break;
      }
    }
  }

  // --- 6. Experience Level Score ---
  let experienceScore = 0;
  const positionCount = discovered.positions?.length || 0;
  if (positionCount > 0) {
    experienceScore = Math.min(100, positionCount * 15 + 20);
  }
  if (discovered.education && discovered.education.length > 0) {
    experienceScore = Math.min(100, experienceScore + 20);
  }

  // Company match bonus
  const userCompany = (userProfile.company || '').toLowerCase();
  if (userCompany && contactCompany && (userCompany.includes(contactCompany) || contactCompany.includes(userCompany))) {
    intersections.push({ type: 'company', label: discovered.currentCompany || '' });
    reasons.push(`Works at ${discovered.currentCompany}`);
  }

  // --- Calculate final weighted score ---
  const breakdown: MatchBreakdown = {
    sectorScore,
    skillScore,
    goalAlignmentScore,
    complementarySkillsScore,
    locationScore,
    experienceScore,
  };

  const totalScore = Math.round(
    sectorScore * WEIGHTS.sector +
    skillScore * WEIGHTS.skill +
    goalAlignmentScore * WEIGHTS.goalAlignment +
    complementarySkillsScore * WEIGHTS.complementarySkills +
    locationScore * WEIGHTS.location +
    experienceScore * WEIGHTS.experience
  );

  // Ensure at least some base score if there are ANY intersections
  const finalScore = Math.min(100, Math.max(intersections.length > 0 ? 5 : 0, totalScore));

  if (reasons.length === 0) {
    reasons.push('Limited profile data available for matching');
  }

  return {
    score: finalScore,
    breakdown,
    intersections,
    reasons,
  };
}
