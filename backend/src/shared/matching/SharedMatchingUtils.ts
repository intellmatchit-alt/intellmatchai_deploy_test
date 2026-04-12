/**
 * Shared Matching Utilities
 *
 * Consolidated utility functions used across all matching services.
 * Provides pure functions for similarity calculation, skill complementarity,
 * role pattern detection, and score classification.
 *
 * @module shared/matching/SharedMatchingUtils
 */

// ============================================================================
// String Similarity Functions
// ============================================================================

/**
 * Calculate Levenshtein (edit) distance between two strings
 */
export function levenshteinDistance(str1: string, str2: string): number {
  const m = str1.length;
  const n = str2.length;

  if (m === 0) return n;
  if (n === 0) return m;

  const dp: number[][] = Array(m + 1)
    .fill(null)
    .map(() => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,      // deletion
        dp[i][j - 1] + 1,      // insertion
        dp[i - 1][j - 1] + cost // substitution
      );
    }
  }

  return dp[m][n];
}

/**
 * Simple fuzzy matching for similar words.
 * Checks prefix similarity (70%) and Levenshtein distance (30% threshold).
 */
export function fuzzyMatch(a: string, b: string): boolean {
  if (a.length < 3 || b.length < 3) return false;

  // Check if they share a significant prefix
  const minLen = Math.min(a.length, b.length);
  const prefix = Math.floor(minLen * 0.7);

  if (a.substring(0, prefix) === b.substring(0, prefix)) {
    return true;
  }

  // Calculate Levenshtein distance
  const distance = levenshteinDistance(a, b);
  const threshold = Math.floor(Math.max(a.length, b.length) * 0.3);

  return distance <= threshold;
}

/**
 * Check if two strings are similar using Levenshtein distance
 */
export function areStringsSimilar(str1: string, str2: string, threshold: number = 0.8): boolean {
  const s1 = normalizeString(str1);
  const s2 = normalizeString(str2);

  if (s1 === s2) return true;
  if (s1.includes(s2) || s2.includes(s1)) return true;

  const distance = levenshteinDistance(s1, s2);
  const maxLength = Math.max(s1.length, s2.length);
  const similarity = 1 - distance / maxLength;

  return similarity >= threshold;
}

/**
 * Normalize a string for comparison (lowercase, trim, remove extra spaces)
 */
export function normalizeString(str: string): string {
  return str.toLowerCase().trim().replace(/\s+/g, ' ');
}

// ============================================================================
// Set Similarity Functions
// ============================================================================

/**
 * Calculate Jaccard similarity between two sets of strings.
 * Returns a value between 0 and 100.
 */
export function jaccardSimilarity(set1: Set<string>, set2: Set<string>): number {
  if (set1.size === 0 && set2.size === 0) return 0;
  if (set1.size === 0 || set2.size === 0) return 0;

  const intersection = new Set([...set1].filter(x => set2.has(x)));
  const union = new Set([...set1, ...set2]);

  return (intersection.size / union.size) * 100;
}

/**
 * Calculate overlap percentage (intersection / smaller set).
 * Returns a value between 0 and 100.
 */
export function overlapPercentage(arr1: string[], arr2: string[]): number {
  if (arr1.length === 0 || arr2.length === 0) return 0;

  const set1 = new Set(arr1.map(s => s.toLowerCase()));
  const set2 = new Set(arr2.map(s => s.toLowerCase()));

  const intersection = [...set1].filter(x => set2.has(x));
  const minSize = Math.min(set1.size, set2.size);

  return (intersection.length / minSize) * 100;
}

/**
 * Find common items between two arrays (case-insensitive)
 */
export function findCommonItems(arr1: string[], arr2: string[]): string[] {
  const set2Lower = new Set(arr2.map(s => s.toLowerCase()));
  const found = new Set<string>();

  for (const item of arr1) {
    if (set2Lower.has(item.toLowerCase())) {
      found.add(item);
    }
  }

  return [...found];
}

// ============================================================================
// Vector Similarity
// ============================================================================

/**
 * Calculate cosine similarity between two vectors.
 * Returns a value between -1 and 1.
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const magnitude = Math.sqrt(normA) * Math.sqrt(normB);

  if (magnitude === 0) return 0;

  return dotProduct / magnitude;
}

// ============================================================================
// Score Classification
// ============================================================================

/** Match status type */
export type MatchStatus = 'PERFECT' | 'EXCELLENT' | 'STRONG' | 'MODERATE' | 'WEAK' | 'NO_MATCH';

/**
 * Convert a score (0-100) to a MatchStatus
 */
export function scoreToStatus(score: number): MatchStatus {
  if (score >= 95) return 'PERFECT';
  if (score >= 80) return 'EXCELLENT';
  if (score >= 60) return 'STRONG';
  if (score >= 40) return 'MODERATE';
  if (score >= 20) return 'WEAK';
  return 'NO_MATCH';
}

// ============================================================================
// Role Pattern Detection
// ============================================================================

/**
 * Senior/Leadership job title patterns
 */
export const SENIOR_ROLE_PATTERNS: RegExp[] = [
  /\b(ceo|cto|cfo|coo|cmo|cio|chief)\b/i,
  /\b(president|vp|vice\s*president)\b/i,
  /\b(director|head\s+of|lead)\b/i,
  /\b(senior|sr\.?|principal|staff)\b/i,
  /\b(founder|co-?founder|partner)\b/i,
  /\b(managing\s+director|md)\b/i,
  /\b(executive|evp|svp)\b/i,
];

/**
 * Investor/VC job title patterns
 */
export const INVESTOR_ROLE_PATTERNS: RegExp[] = [
  /\b(investor|venture\s*capital|vc)\b/i,
  /\b(angel|seed|funding)\b/i,
  /\b(portfolio|investment|fund)\b/i,
  /\b(partner.*capital|capital.*partner)\b/i,
  /\b(managing.*partner)\b/i,
];

/**
 * Hiring/Recruiter job title patterns
 */
export const HIRING_ROLE_PATTERNS: RegExp[] = [
  /\b(recruiter|recruiting|talent)\b/i,
  /\b(hr|human\s*resources)\b/i,
  /\b(hiring\s*manager)\b/i,
  /\b(people\s*operations)\b/i,
];

/**
 * Investment company patterns
 */
export const INVESTMENT_COMPANY_PATTERNS: RegExp[] = [
  /capital/i,
  /ventures/i,
  /partners/i,
  /investments/i,
  /fund/i,
  /holdings/i,
];

/**
 * Decision maker title keywords (for deal/product matching)
 */
export const DECISION_MAKER_TITLES = [
  'ceo', 'chief executive', 'founder', 'co-founder', 'owner', 'president',
  'cto', 'cfo', 'coo', 'cmo', 'cio', 'cpo', 'chief',
  'managing director', 'general manager', 'partner',
];

/**
 * Influencer title keywords
 */
export const INFLUENCER_TITLES = [
  'vp', 'vice president', 'director', 'head of', 'senior director',
  'principal', 'senior manager', 'department head',
];

/**
 * Consultant title keywords
 */
export const CONSULTANT_TITLES = [
  'consultant', 'advisor', 'freelance', 'independent', 'contractor',
  'strategist', 'specialist',
];

/**
 * Broker title keywords
 */
export const BROKER_TITLES = [
  'business development', 'bd manager', 'partnerships', 'alliance',
  'channel', 'reseller', 'agency', 'broker', 'intermediary',
];

/**
 * Check if a job title matches any of the given patterns
 */
export function matchesRolePatterns(title: string, patterns: RegExp[]): boolean {
  return patterns.some(p => p.test(title));
}

/**
 * Check if a title contains any of the given keywords
 */
export function titleContainsAny(title: string, keywords: string[]): boolean {
  const titleLower = title.toLowerCase();
  return keywords.some(kw => titleLower.includes(kw));
}

// ============================================================================
// Seniority Detection
// ============================================================================

export enum SeniorityLevel {
  ENTRY = 'ENTRY',
  MID = 'MID',
  SENIOR = 'SENIOR',
  LEAD = 'LEAD',
  DIRECTOR = 'DIRECTOR',
  VP = 'VP',
  C_LEVEL = 'C_LEVEL',
  BOARD = 'BOARD',
}

/**
 * Seniority keywords for each level.
 * Consolidated from SharedMatchingUtils, ProductMatch.ts, and OpportunityMatchingService.
 * Order matters: checked from highest to lowest, and multi-word patterns are listed
 * before single-word patterns within each level to avoid false matches.
 */
export const SENIORITY_KEYWORDS: Record<SeniorityLevel, string[]> = {
  [SeniorityLevel.BOARD]: [
    'board member', 'board of directors', 'board',
    'chairman', 'chairwoman', 'chairperson',
  ],
  [SeniorityLevel.C_LEVEL]: [
    'ceo', 'cto', 'cfo', 'coo', 'cmo', 'cio', 'cpo', 'cro', 'cao', 'chief',
    'founder', 'co-founder', 'cofounder', 'owner', 'president',
    'managing director', 'partner',
  ],
  [SeniorityLevel.VP]: [
    'vice president', 'vice-president', 'senior vice', 'executive vice',
    'vp', 'svp', 'evp', 'avp',
  ],
  [SeniorityLevel.DIRECTOR]: [
    'senior director', 'global head', 'regional head', 'country head',
    'head of', 'head,',
    'director', 'general manager', 'gm',
  ],
  [SeniorityLevel.LEAD]: [
    'team lead', 'tech lead', 'principal', 'lead',
  ],
  [SeniorityLevel.SENIOR]: [
    'senior manager', 'sr manager', 'sr. manager', 'senior specialist',
    'senior', 'staff',
  ],
  [SeniorityLevel.MID]: [
    'manager', 'specialist', 'analyst', 'consultant', 'coordinator',
    'supervisor', 'executive', 'intermediate',
  ],
  [SeniorityLevel.ENTRY]: [
    'junior', 'associate', 'assistant', 'trainee', 'intern',
    'entry', 'graduate', 'clerk',
  ],
};

/** Arabic seniority keywords for each level */
export const ARABIC_SENIORITY_KEYWORDS: Record<SeniorityLevel, string[]> = {
  [SeniorityLevel.BOARD]: ['عضو مجلس إدارة', 'رئيس مجلس الإدارة'],
  [SeniorityLevel.C_LEVEL]: ['المدير التنفيذي', 'الرئيس التنفيذي', 'المدير التقني', 'المدير المالي'],
  [SeniorityLevel.VP]: ['نائب الرئيس'],
  [SeniorityLevel.DIRECTOR]: ['مدير عام', 'مدير إدارة'],
  [SeniorityLevel.LEAD]: ['قائد فريق', 'رئيس فريق'],
  [SeniorityLevel.SENIOR]: ['كبير', 'أول'],
  [SeniorityLevel.MID]: ['مدير', 'مديرة'],
  [SeniorityLevel.ENTRY]: ['مبتدئ', 'متدرب'],
};

/** Seniority score mapping (0-100) */
export const SENIORITY_SCORES: Record<SeniorityLevel, number> = {
  [SeniorityLevel.BOARD]: 100,
  [SeniorityLevel.C_LEVEL]: 95,
  [SeniorityLevel.VP]: 80,
  [SeniorityLevel.DIRECTOR]: 65,
  [SeniorityLevel.LEAD]: 55,
  [SeniorityLevel.SENIOR]: 45,
  [SeniorityLevel.MID]: 30,
  [SeniorityLevel.ENTRY]: 15,
};

/**
 * Ordered list of seniority levels from lowest to highest.
 * Useful for index-based comparison (e.g., seniority fit scoring).
 * Typed as string[] for compatibility with both shared and Prisma SeniorityLevel enums.
 */
export const SENIORITY_ORDER: string[] = [
  SeniorityLevel.ENTRY,
  SeniorityLevel.MID,
  SeniorityLevel.SENIOR,
  SeniorityLevel.LEAD,
  SeniorityLevel.DIRECTOR,
  SeniorityLevel.VP,
  SeniorityLevel.C_LEVEL,
  SeniorityLevel.BOARD,
];

/**
 * Detect seniority level from job title.
 * Consolidated detection that handles English, Arabic, and regex-based patterns.
 * Checks levels from highest to lowest to avoid false matches on generic keywords.
 */
export function detectSeniorityLevel(title: string): SeniorityLevel {
  const titleLower = title.toLowerCase();
  const isArabic = /[\u0600-\u06FF]/.test(title);

  // Check from highest seniority to lowest
  const levels: SeniorityLevel[] = [
    SeniorityLevel.BOARD,
    SeniorityLevel.C_LEVEL,
    SeniorityLevel.VP,
    SeniorityLevel.DIRECTOR,
    SeniorityLevel.LEAD,
    SeniorityLevel.SENIOR,
    SeniorityLevel.MID,
    SeniorityLevel.ENTRY,
  ];

  // Check Arabic keywords first (more specific patterns before generic ones)
  if (isArabic) {
    for (const level of levels) {
      const arabicKeywords = ARABIC_SENIORITY_KEYWORDS[level];
      if (arabicKeywords.some(kw => title.includes(kw))) {
        return level;
      }
    }
  }

  for (const level of levels) {
    const keywords = SENIORITY_KEYWORDS[level];
    if (keywords.some(kw => titleLower.includes(kw))) {
      return level;
    }
  }

  return SeniorityLevel.MID;
}

// ============================================================================
// Complementary Skills Matrix
// ============================================================================

/**
 * Canonical complementary skills matrix.
 * Merged from DeterministicMatchingService (30+ categories) and EventController (16 categories).
 */
export const COMPLEMENTARY_SKILLS: Record<string, string[]> = {
  // Tech
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
  'Product Design': ['UI/UX Design', 'Research', 'Prototyping'],

  // Business
  'Product Management': ['Engineering', 'Design', 'Marketing', 'Data Analysis', 'Strategy'],
  'Project Management': ['Product Management', 'Agile', 'Scrum', 'Operations'],
  'Business Development': ['Sales', 'Marketing', 'Strategy', 'Partnerships'],
  'Strategy': ['Business Development', 'Finance', 'Operations', 'Consulting'],
  'Consulting': ['Strategy', 'Business Analysis', 'Project Management'],
  'Finance': ['Legal', 'Strategy', 'Operations', 'Accounting'],
  'Accounting': ['Finance', 'Tax', 'Audit', 'Compliance'],
  'Legal': ['Finance', 'Compliance', 'Contracts', 'IP'],
  'Operations': ['Project Management', 'Strategy', 'Finance', 'Supply Chain'],

  // Creative
  'Content': ['Marketing', 'SEO', 'Social Media', 'Writing'],
  'Writing': ['Content', 'Editing', 'Marketing', 'Communications'],
  'Graphic Design': ['UI/UX Design', 'Branding', 'Marketing'],
  'Video Production': ['Content', 'Marketing', 'Animation'],

  // Leadership
  'Leadership': ['Management', 'Strategy', 'Team Building', 'Communication'],
  'Management': ['Leadership', 'Operations', 'Strategy', 'HR'],
  'Team Building': ['Leadership', 'HR', 'Management'],
};

/**
 * Calculate complementary skills score between two skill sets.
 * Returns 0-100.
 */
export function calculateComplementarySkillsScore(skills1: string[], skills2: string[]): number {
  if (skills1.length === 0 || skills2.length === 0) return 0;

  let matches = 0;
  const normalized2 = skills2.map(s => s.toLowerCase());

  for (const skill of skills1) {
    const complements = COMPLEMENTARY_SKILLS[skill] || [];
    for (const complement of complements) {
      if (normalized2.some(cs => cs.includes(complement.toLowerCase()))) {
        matches++;
      }
    }
  }

  return Math.min(100, matches * 25);
}

/**
 * Check if two skill sets have any complementary skills
 */
export function hasComplementarySkills(skills1: string[], skills2: string[]): boolean {
  if (skills1.length === 0 || skills2.length === 0) return false;

  const normalized2 = skills2.map(s => s.toLowerCase());
  for (const skill of skills1) {
    const complements = COMPLEMENTARY_SKILLS[skill] || [];
    for (const complement of complements) {
      if (normalized2.some(cs => cs.includes(complement.toLowerCase()))) return true;
    }
  }

  return false;
}

// ============================================================================
// Solution Type Keywords (for Deal matching)
// ============================================================================

export const SOLUTION_TYPE_KEYWORDS: Record<string, string[]> = {
  crm: ['crm', 'salesforce', 'hubspot', 'pipedrive', 'customer relationship', 'sales automation', 'lead management'],
  erp: ['erp', 'sap', 'oracle', 'netsuite', 'enterprise resource', 'business management', 'operations management'],
  marketing: ['marketing', 'advertising', 'digital marketing', 'seo', 'content', 'social media', 'branding', 'growth'],
  fintech: ['fintech', 'payment', 'banking', 'financial', 'lending', 'insurance', 'investment', 'trading'],
  hr: ['hr', 'human resources', 'recruitment', 'talent', 'payroll', 'employee', 'workforce', 'staffing'],
  cybersecurity: ['security', 'cybersecurity', 'infosec', 'protection', 'compliance', 'privacy', 'encryption'],
  cloud: ['cloud', 'aws', 'azure', 'gcp', 'infrastructure', 'devops', 'hosting', 'saas', 'paas'],
  ai: ['ai', 'artificial intelligence', 'machine learning', 'ml', 'data science', 'analytics', 'deep learning', 'nlp', 'computer vision'],
  ecommerce: ['ecommerce', 'e-commerce', 'online store', 'marketplace', 'retail', 'shopify', 'woocommerce'],
  logistics: ['logistics', 'supply chain', 'shipping', 'fulfillment', 'warehouse', 'transportation', 'delivery'],
  healthcare: ['healthcare', 'health', 'medical', 'pharma', 'biotech', 'telemedicine', 'clinical', 'patient'],
  education: ['education', 'edtech', 'learning', 'training', 'e-learning', 'lms', 'course', 'tutoring'],
  consulting: ['consulting', 'advisory', 'strategy', 'management consulting', 'professional services'],
  legal: ['legal', 'law', 'compliance', 'regulatory', 'contract', 'intellectual property'],
  realestate: ['real estate', 'property', 'proptech', 'construction', 'architecture', 'building'],
};

// ============================================================================
// Investment Range Utilities
// ============================================================================

/**
 * Parse investment range to min/max values
 */
export function parseInvestmentRange(range: string): { min: number; max: number } | null {
  if (!range) return null;

  const cleaned = range.replace(/[$\u20AC\u00A3,]/g, '').toLowerCase();

  const rangeMatch = cleaned.match(/(\d+(?:\.\d+)?)\s*[km]?\s*[-\u2013to]\s*(\d+(?:\.\d+)?)\s*[km]?/i);
  if (rangeMatch) {
    let min = parseFloat(rangeMatch[1]);
    let max = parseFloat(rangeMatch[2]);

    if (cleaned.includes('k')) {
      min *= 1000;
      max *= 1000;
    } else if (cleaned.includes('m')) {
      min *= 1000000;
      max *= 1000000;
    }

    return { min, max };
  }

  const singleMatch = cleaned.match(/(\d+(?:\.\d+)?)\s*([km])?/i);
  if (singleMatch) {
    let value = parseFloat(singleMatch[1]);
    const suffix = singleMatch[2];

    if (suffix?.toLowerCase() === 'k') value *= 1000;
    else if (suffix?.toLowerCase() === 'm') value *= 1000000;

    return { min: value, max: value };
  }

  return null;
}

/**
 * Check if investment ranges overlap
 */
export function doRangesOverlap(
  range1: { min: number; max: number },
  range2: { min: number; max: number }
): boolean {
  return range1.min <= range2.max && range2.min <= range1.max;
}

// ============================================================================
// Confidence Calculation
// ============================================================================

export type MatchQuality = 'HIGH' | 'MEDIUM' | 'LOW';

export interface ConfidenceResult {
  confidence: number; // 0-100
  matchQuality: MatchQuality;
  dataCompleteness: number; // 0-100
  factors: string[]; // what contributed to confidence
}

// ============================================================================
// Goal Alignment
// ============================================================================

/**
 * Complementary goal pairs - goals that work well together
 */
export const COMPLEMENTARY_GOAL_PAIRS: Array<{
  goal1: string;
  goal2: string;
  score: number;
  bidirectional: boolean;
  reason: string;
}> = [
  { goal1: 'HIRING', goal2: 'JOB_SEEKING', score: 100, bidirectional: true, reason: 'Hiring manager meets job seeker' },
  { goal1: 'INVESTMENT', goal2: 'PARTNERSHIP', score: 90, bidirectional: true, reason: 'Investor meets founder seeking funding' },
  { goal1: 'MENTORSHIP', goal2: 'LEARNING', score: 90, bidirectional: true, reason: 'Mentor meets mentee' },
  { goal1: 'PARTNERSHIP', goal2: 'PARTNERSHIP', score: 85, bidirectional: false, reason: 'Both seeking partnership' },
  { goal1: 'COLLABORATION', goal2: 'COLLABORATION', score: 80, bidirectional: false, reason: 'Both open to collaboration' },
  { goal1: 'SALES', goal2: 'PARTNERSHIP', score: 70, bidirectional: true, reason: 'Sales professional meets potential partner' },
  { goal1: 'MENTORSHIP', goal2: 'COLLABORATION', score: 65, bidirectional: true, reason: 'Mentor can collaborate' },
  { goal1: 'HIRING', goal2: 'COLLABORATION', score: 60, bidirectional: true, reason: 'Hiring for collaborative work' },
];

/**
 * Calculate goal alignment score between two sets of goals.
 * Returns the highest-scoring complementary pair found.
 */
export function calculateGoalAlignment(
  userGoals: string[],
  targetGoals: string[]
): { score: number; matchedPairs: Array<{ pair: string; score: number; reason: string }> } {
  const matchedPairs: Array<{ pair: string; score: number; reason: string }> = [];
  let maxScore = 0;

  for (const userGoal of userGoals) {
    for (const targetGoal of targetGoals) {
      // Same goal bonus
      if (userGoal === targetGoal) {
        const sameScore = 60;
        if (sameScore > maxScore) {
          maxScore = sameScore;
          matchedPairs.push({
            pair: `${userGoal} ↔ ${targetGoal}`,
            score: sameScore,
            reason: `Both seeking ${userGoal.replace(/_/g, ' ').toLowerCase()}`,
          });
        }
      }

      // Complementary pair check
      const match = COMPLEMENTARY_GOAL_PAIRS.find(
        (cg) =>
          (cg.goal1 === userGoal && cg.goal2 === targetGoal) ||
          (cg.bidirectional && cg.goal1 === targetGoal && cg.goal2 === userGoal)
      );

      if (match && match.score > maxScore) {
        maxScore = match.score;
        matchedPairs.push({
          pair: `${userGoal} ↔ ${targetGoal}`,
          score: match.score,
          reason: match.reason,
        });
      }
    }
  }

  return { score: maxScore, matchedPairs };
}

/**
 * Calculate match confidence based on data completeness of both profiles.
 * Higher confidence = more data available = more reliable score.
 */
export function calculateConfidence(
  sourceProfile: {
    hasSectors?: boolean;
    hasSkills?: boolean;
    hasGoals?: boolean;
    hasBio?: boolean;
    hasEmbedding?: boolean;
    hasInterests?: boolean;
    hasHobbies?: boolean;
  },
  targetProfile: {
    hasSectors?: boolean;
    hasSkills?: boolean;
    hasGoals?: boolean;
    hasBio?: boolean;
    hasEmbedding?: boolean;
    hasInterests?: boolean;
    hasHobbies?: boolean;
  }
): ConfidenceResult {
  const factors: string[] = [];
  let dataPoints = 0;
  const totalDataPoints = 14; // 7 fields x 2 profiles

  const checkField = (source: boolean | undefined, target: boolean | undefined, label: string) => {
    if (source) dataPoints++;
    if (target) dataPoints++;
    if (source && target) {
      factors.push(label);
    }
  };

  checkField(sourceProfile.hasSectors, targetProfile.hasSectors, 'Sectors');
  checkField(sourceProfile.hasSkills, targetProfile.hasSkills, 'Skills');
  checkField(sourceProfile.hasGoals, targetProfile.hasGoals, 'Goals');
  checkField(sourceProfile.hasBio, targetProfile.hasBio, 'Bio');
  checkField(sourceProfile.hasEmbedding, targetProfile.hasEmbedding, 'AI Similarity');
  checkField(sourceProfile.hasInterests, targetProfile.hasInterests, 'Interests');
  checkField(sourceProfile.hasHobbies, targetProfile.hasHobbies, 'Hobbies');

  const dataCompleteness = Math.round((dataPoints / totalDataPoints) * 100);

  // Confidence = weighted data completeness
  // Core fields (sectors, skills, goals, bio) have more impact
  let confidence = 0;
  const coreWeight = 15;
  const secondaryWeight = 5;

  // Core fields (both profiles)
  if (sourceProfile.hasSectors) confidence += coreWeight;
  if (targetProfile.hasSectors) confidence += coreWeight;
  if (sourceProfile.hasSkills) confidence += coreWeight;
  if (targetProfile.hasSkills) confidence += coreWeight;
  if (sourceProfile.hasGoals) confidence += 5;
  if (targetProfile.hasGoals) confidence += 5;
  if (sourceProfile.hasBio) confidence += secondaryWeight;
  if (targetProfile.hasBio) confidence += secondaryWeight;
  if (sourceProfile.hasEmbedding && targetProfile.hasEmbedding) confidence += 10;
  if (sourceProfile.hasInterests) confidence += 2;
  if (targetProfile.hasInterests) confidence += 2;
  if (sourceProfile.hasHobbies) confidence += 1;
  if (targetProfile.hasHobbies) confidence += 1;

  confidence = Math.min(100, confidence);

  let matchQuality: MatchQuality;
  if (confidence >= 60) matchQuality = 'HIGH';
  else if (confidence >= 30) matchQuality = 'MEDIUM';
  else matchQuality = 'LOW';

  return { confidence, matchQuality, dataCompleteness, factors };
}
