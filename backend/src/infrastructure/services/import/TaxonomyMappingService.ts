/**
 * Taxonomy Mapping Service
 *
 * Maps job titles, industries, and company information to
 * internal sectors and skills taxonomy.
 *
 * @module infrastructure/services/import/TaxonomyMappingService
 */

import { prisma } from '../../database/prisma/client.js';
import { logger } from '../../../shared/logger/index.js';

/**
 * Extracted tags from contact data
 */
export interface ExtractedTags {
  sectors: Array<{ id: string; name: string; confidence: number }>;
  skills: Array<{ id: string; name: string; confidence: number }>;
  interests: Array<{ id: string; name: string; confidence: number }>;
  overallConfidence: number;
}

/**
 * Job title keyword to skills/sectors mapping
 */
const TITLE_MAPPINGS: Record<string, { skills: string[]; sectors: string[] }> = {
  // Technology
  'engineer': { skills: ['Engineering', 'Problem Solving'], sectors: ['Technology'] },
  'developer': { skills: ['Software Development', 'Programming'], sectors: ['Technology'] },
  'programmer': { skills: ['Programming', 'Software Development'], sectors: ['Technology'] },
  'software': { skills: ['Software Development'], sectors: ['Technology'] },
  'frontend': { skills: ['Frontend Development', 'JavaScript', 'React'], sectors: ['Technology'] },
  'backend': { skills: ['Backend Development', 'APIs', 'Databases'], sectors: ['Technology'] },
  'fullstack': { skills: ['Full Stack Development', 'Frontend Development', 'Backend Development'], sectors: ['Technology'] },
  'devops': { skills: ['DevOps', 'Cloud', 'Infrastructure'], sectors: ['Technology'] },
  'data scientist': { skills: ['Data Science', 'Machine Learning', 'Python'], sectors: ['Technology', 'Data & Analytics'] },
  'data analyst': { skills: ['Data Analysis', 'SQL', 'Statistics'], sectors: ['Data & Analytics'] },
  'machine learning': { skills: ['Machine Learning', 'AI', 'Python'], sectors: ['Technology', 'AI & ML'] },
  'ai ': { skills: ['AI', 'Machine Learning'], sectors: ['Technology', 'AI & ML'] },
  'architect': { skills: ['Architecture', 'System Design'], sectors: ['Technology'] },
  'cloud': { skills: ['Cloud', 'AWS', 'Azure'], sectors: ['Technology'] },
  'security': { skills: ['Security', 'Cybersecurity'], sectors: ['Technology', 'Security'] },
  'mobile': { skills: ['Mobile Development', 'iOS', 'Android'], sectors: ['Technology'] },

  // Leadership & Management
  'ceo': { skills: ['Leadership', 'Strategy', 'Management'], sectors: ['Executive'] },
  'cto': { skills: ['Leadership', 'Technology Strategy', 'Engineering Management'], sectors: ['Technology', 'Executive'] },
  'cfo': { skills: ['Finance', 'Strategy', 'Leadership'], sectors: ['Finance', 'Executive'] },
  'coo': { skills: ['Operations', 'Strategy', 'Leadership'], sectors: ['Operations', 'Executive'] },
  'cmo': { skills: ['Marketing', 'Strategy', 'Leadership'], sectors: ['Marketing', 'Executive'] },
  'president': { skills: ['Leadership', 'Strategy', 'Management'], sectors: ['Executive'] },
  'vice president': { skills: ['Leadership', 'Management', 'Strategy'], sectors: [] },
  'vp': { skills: ['Leadership', 'Management', 'Strategy'], sectors: [] },
  'director': { skills: ['Leadership', 'Management', 'Strategy'], sectors: [] },
  'manager': { skills: ['Management', 'Leadership', 'Team Building'], sectors: [] },
  'head of': { skills: ['Leadership', 'Management'], sectors: [] },
  'lead': { skills: ['Leadership', 'Team Lead'], sectors: [] },
  'senior': { skills: [], sectors: [] },
  'principal': { skills: [], sectors: [] },
  'founder': { skills: ['Entrepreneurship', 'Leadership', 'Strategy'], sectors: ['Startups'] },
  'co-founder': { skills: ['Entrepreneurship', 'Leadership', 'Strategy'], sectors: ['Startups'] },

  // Sales & Business Development
  'sales': { skills: ['Sales', 'Negotiation', 'Communication'], sectors: ['Sales'] },
  'account executive': { skills: ['Sales', 'Account Management', 'Negotiation'], sectors: ['Sales'] },
  'account manager': { skills: ['Account Management', 'Client Relations', 'Sales'], sectors: ['Sales'] },
  'business development': { skills: ['Business Development', 'Sales', 'Partnerships'], sectors: ['Sales', 'Business Development'] },
  'bdm': { skills: ['Business Development', 'Sales', 'Partnerships'], sectors: ['Business Development'] },

  // Marketing
  'marketing': { skills: ['Marketing', 'Communication', 'Analytics'], sectors: ['Marketing'] },
  'content': { skills: ['Content Marketing', 'Writing', 'SEO'], sectors: ['Marketing'] },
  'social media': { skills: ['Social Media', 'Content', 'Marketing'], sectors: ['Marketing'] },
  'seo': { skills: ['SEO', 'Digital Marketing', 'Analytics'], sectors: ['Marketing'] },
  'growth': { skills: ['Growth', 'Marketing', 'Analytics'], sectors: ['Marketing', 'Growth'] },
  'brand': { skills: ['Branding', 'Marketing', 'Communication'], sectors: ['Marketing'] },

  // Product
  'product manager': { skills: ['Product Management', 'Strategy', 'UX'], sectors: ['Product'] },
  'product owner': { skills: ['Product Management', 'Agile', 'Scrum'], sectors: ['Product'] },
  'pm': { skills: ['Product Management', 'Project Management'], sectors: ['Product'] },

  // Design
  'designer': { skills: ['Design', 'Creativity'], sectors: ['Design'] },
  'ux': { skills: ['UX Design', 'User Research', 'Prototyping'], sectors: ['Design'] },
  'ui': { skills: ['UI Design', 'Visual Design'], sectors: ['Design'] },
  'graphic': { skills: ['Graphic Design', 'Visual Design'], sectors: ['Design'] },

  // Finance
  'finance': { skills: ['Finance', 'Financial Analysis'], sectors: ['Finance'] },
  'accountant': { skills: ['Accounting', 'Finance', 'Tax'], sectors: ['Finance'] },
  'analyst': { skills: ['Analysis', 'Research'], sectors: [] },
  'investment': { skills: ['Investment', 'Finance', 'Analysis'], sectors: ['Finance', 'Investment'] },
  'banker': { skills: ['Banking', 'Finance'], sectors: ['Finance', 'Banking'] },
  'trader': { skills: ['Trading', 'Finance', 'Analysis'], sectors: ['Finance'] },

  // Consulting
  'consultant': { skills: ['Consulting', 'Strategy', 'Analysis'], sectors: ['Consulting'] },
  'advisor': { skills: ['Advisory', 'Strategy', 'Consulting'], sectors: ['Consulting'] },
  'partner': { skills: ['Leadership', 'Strategy', 'Client Relations'], sectors: [] },

  // HR & People
  'hr': { skills: ['HR', 'Recruiting', 'People Management'], sectors: ['Human Resources'] },
  'human resources': { skills: ['HR', 'Recruiting', 'People Management'], sectors: ['Human Resources'] },
  'recruiter': { skills: ['Recruiting', 'HR', 'Talent Acquisition'], sectors: ['Human Resources'] },
  'talent': { skills: ['Talent Acquisition', 'HR'], sectors: ['Human Resources'] },

  // Legal
  'lawyer': { skills: ['Legal', 'Contracts', 'Negotiation'], sectors: ['Legal'] },
  'attorney': { skills: ['Legal', 'Contracts', 'Litigation'], sectors: ['Legal'] },
  'legal': { skills: ['Legal', 'Compliance'], sectors: ['Legal'] },
  'counsel': { skills: ['Legal', 'Contracts', 'Advisory'], sectors: ['Legal'] },

  // Healthcare
  'doctor': { skills: ['Medicine', 'Healthcare'], sectors: ['Healthcare'] },
  'physician': { skills: ['Medicine', 'Healthcare'], sectors: ['Healthcare'] },
  'nurse': { skills: ['Nursing', 'Healthcare', 'Patient Care'], sectors: ['Healthcare'] },
  'medical': { skills: ['Healthcare', 'Medicine'], sectors: ['Healthcare'] },
  'pharma': { skills: ['Pharmaceuticals', 'Healthcare'], sectors: ['Healthcare', 'Pharmaceuticals'] },

  // Education
  'teacher': { skills: ['Teaching', 'Education'], sectors: ['Education'] },
  'professor': { skills: ['Teaching', 'Research', 'Academic'], sectors: ['Education', 'Academia'] },
  'educator': { skills: ['Education', 'Teaching'], sectors: ['Education'] },

  // Operations
  'operations': { skills: ['Operations', 'Process Improvement'], sectors: ['Operations'] },
  'logistics': { skills: ['Logistics', 'Supply Chain'], sectors: ['Operations', 'Logistics'] },
  'supply chain': { skills: ['Supply Chain', 'Logistics', 'Operations'], sectors: ['Operations', 'Logistics'] },

  // Research
  'researcher': { skills: ['Research', 'Analysis'], sectors: ['Research'] },
  'scientist': { skills: ['Research', 'Science', 'Analysis'], sectors: ['Research', 'Science'] },

  // Customer Success
  'customer success': { skills: ['Customer Success', 'Account Management', 'Communication'], sectors: ['Customer Success'] },
  'support': { skills: ['Customer Support', 'Communication', 'Problem Solving'], sectors: ['Customer Support'] },
};

/**
 * Company name patterns to sectors
 */
const COMPANY_SECTORS: Record<string, string[]> = {
  // Tech Giants
  'google': ['Technology'],
  'microsoft': ['Technology'],
  'apple': ['Technology'],
  'amazon': ['Technology', 'E-commerce'],
  'meta': ['Technology', 'Social Media'],
  'facebook': ['Technology', 'Social Media'],
  'netflix': ['Technology', 'Entertainment'],
  'tesla': ['Technology', 'Automotive'],
  'uber': ['Technology', 'Transportation'],
  'airbnb': ['Technology', 'Hospitality'],
  'salesforce': ['Technology', 'SaaS'],
  'oracle': ['Technology'],
  'ibm': ['Technology'],
  'intel': ['Technology', 'Hardware'],
  'nvidia': ['Technology', 'Hardware', 'AI & ML'],

  // Finance
  'goldman sachs': ['Finance', 'Investment'],
  'jpmorgan': ['Finance', 'Banking'],
  'morgan stanley': ['Finance', 'Investment'],
  'blackrock': ['Finance', 'Investment'],
  'citadel': ['Finance', 'Hedge Fund'],
  'two sigma': ['Finance', 'Hedge Fund'],
  'bridgewater': ['Finance', 'Hedge Fund'],

  // Consulting
  'mckinsey': ['Consulting'],
  'bain': ['Consulting'],
  'bcg': ['Consulting'],
  'boston consulting': ['Consulting'],
  'deloitte': ['Consulting', 'Accounting'],
  'pwc': ['Consulting', 'Accounting'],
  'kpmg': ['Consulting', 'Accounting'],
  'ey': ['Consulting', 'Accounting'],
  'ernst & young': ['Consulting', 'Accounting'],
  'accenture': ['Consulting', 'Technology'],

  // VC/PE
  'sequoia': ['Venture Capital'],
  'andreessen': ['Venture Capital'],
  'a16z': ['Venture Capital'],
  'benchmark': ['Venture Capital'],
  'greylock': ['Venture Capital'],
  'kleiner': ['Venture Capital'],
  'blackstone': ['Private Equity'],
  'kkr': ['Private Equity'],
  'carlyle': ['Private Equity'],

  // Healthcare
  'pfizer': ['Healthcare', 'Pharmaceuticals'],
  'johnson & johnson': ['Healthcare', 'Pharmaceuticals'],
  'merck': ['Healthcare', 'Pharmaceuticals'],
  'novartis': ['Healthcare', 'Pharmaceuticals'],

  // Retail
  'walmart': ['Retail'],
  'target': ['Retail'],
  'costco': ['Retail'],
};

/**
 * Industry to sector mapping (from enrichment services like PDL)
 */
const PDL_INDUSTRY_MAP: Record<string, string> = {
  'computer software': 'Technology',
  'information technology and services': 'Technology',
  'internet': 'Technology',
  'financial services': 'Finance',
  'banking': 'Finance',
  'investment banking': 'Finance',
  'investment management': 'Finance',
  'venture capital & private equity': 'Venture Capital',
  'management consulting': 'Consulting',
  'marketing and advertising': 'Marketing',
  'human resources': 'Human Resources',
  'legal services': 'Legal',
  'hospital & health care': 'Healthcare',
  'pharmaceuticals': 'Healthcare',
  'biotechnology': 'Healthcare',
  'education management': 'Education',
  'higher education': 'Education',
  'real estate': 'Real Estate',
  'construction': 'Construction',
  'oil & energy': 'Energy',
  'utilities': 'Energy',
  'automotive': 'Automotive',
  'transportation/trucking/railroad': 'Transportation',
  'logistics and supply chain': 'Logistics',
  'retail': 'Retail',
  'consumer goods': 'Consumer Goods',
  'food & beverages': 'Food & Beverage',
  'hospitality': 'Hospitality',
  'entertainment': 'Entertainment',
  'media production': 'Media',
  'telecommunications': 'Telecommunications',
  'insurance': 'Insurance',
  'government administration': 'Government',
  'non-profit organization management': 'Non-Profit',
  'design': 'Design',
  'architecture & planning': 'Architecture',
  'e-learning': 'Education',
  'research': 'Research',
};

/**
 * Taxonomy Mapping Service
 */
export class TaxonomyMappingService {
  private sectorCache: Map<string, { id: string; name: string }> = new Map();
  private skillCache: Map<string, { id: string; name: string }> = new Map();
  private interestCache: Map<string, { id: string; name: string }> = new Map();
  private cacheLoaded = false;

  /**
   * Load taxonomy caches from database
   */
  async loadCache(): Promise<void> {
    if (this.cacheLoaded) return;

    try {
      // Load sectors
      const sectors = await prisma.sector.findMany({
        select: { id: true, name: true },
      });
      for (const sector of sectors) {
        this.sectorCache.set(sector.name.toLowerCase(), { id: sector.id, name: sector.name });
      }

      // Load skills
      const skills = await prisma.skill.findMany({
        select: { id: true, name: true },
      });
      for (const skill of skills) {
        this.skillCache.set(skill.name.toLowerCase(), { id: skill.id, name: skill.name });
      }

      // Load interests
      const interests = await prisma.interest.findMany({
        select: { id: true, name: true },
      });
      for (const interest of interests) {
        this.interestCache.set(interest.name.toLowerCase(), { id: interest.id, name: interest.name });
      }

      this.cacheLoaded = true;
      logger.debug('Taxonomy cache loaded', {
        sectors: this.sectorCache.size,
        skills: this.skillCache.size,
        interests: this.interestCache.size,
      });
    } catch (error) {
      logger.error('Failed to load taxonomy cache', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Map a job title to skills and sectors
   */
  mapJobTitle(title: string | undefined | null): { skills: string[]; sectors: string[]; confidence: number } {
    if (!title) {
      return { skills: [], sectors: [], confidence: 0.1 };
    }

    const normalized = title.toLowerCase();
    const matchedSkills = new Set<string>();
    const matchedSectors = new Set<string>();
    let matchCount = 0;

    // Check against all title mappings
    for (const [keyword, mapping] of Object.entries(TITLE_MAPPINGS)) {
      if (normalized.includes(keyword)) {
        mapping.skills.forEach(s => matchedSkills.add(s));
        mapping.sectors.forEach(s => matchedSectors.add(s));
        matchCount++;
      }
    }

    // Calculate confidence based on matches
    const confidence = Math.min(0.9, 0.3 + (matchCount * 0.15));

    return {
      skills: Array.from(matchedSkills),
      sectors: Array.from(matchedSectors),
      confidence: matchCount > 0 ? confidence : 0.2,
    };
  }

  /**
   * Map a company name to sectors
   */
  mapCompany(company: string | undefined | null): { sectors: string[]; confidence: number } {
    if (!company) {
      return { sectors: [], confidence: 0.1 };
    }

    const normalized = company.toLowerCase();

    // Check against known companies
    for (const [companyKey, sectors] of Object.entries(COMPANY_SECTORS)) {
      if (normalized.includes(companyKey)) {
        return { sectors, confidence: 0.85 };
      }
    }

    // Check for common patterns
    if (normalized.includes('capital') || normalized.includes('ventures') ||
        normalized.includes('partners') || normalized.includes('investments')) {
      return { sectors: ['Finance', 'Investment'], confidence: 0.6 };
    }

    if (normalized.includes('consulting') || normalized.includes('advisors')) {
      return { sectors: ['Consulting'], confidence: 0.6 };
    }

    if (normalized.includes('tech') || normalized.includes('software') ||
        normalized.includes('labs') || normalized.includes('ai')) {
      return { sectors: ['Technology'], confidence: 0.5 };
    }

    if (normalized.includes('health') || normalized.includes('medical') ||
        normalized.includes('pharma')) {
      return { sectors: ['Healthcare'], confidence: 0.5 };
    }

    if (normalized.includes('bank')) {
      return { sectors: ['Finance', 'Banking'], confidence: 0.6 };
    }

    return { sectors: [], confidence: 0.2 };
  }

  /**
   * Map PDL industry to internal sector
   */
  mapPDLIndustry(industry: string | undefined | null): string | undefined {
    if (!industry) return undefined;
    return PDL_INDUSTRY_MAP[industry.toLowerCase()];
  }

  /**
   * Map enrichment data from PDL to extracted tags
   */
  mapEnrichmentData(enrichment: {
    industry?: string;
    skills?: string[];
    interests?: string[];
    likelihood?: number;
  }): Partial<ExtractedTags> {
    const sectors: Array<{ id: string; name: string; confidence: number }> = [];
    const skills: Array<{ id: string; name: string; confidence: number }> = [];
    const interests: Array<{ id: string; name: string; confidence: number }> = [];

    const baseConfidence = enrichment.likelihood ? enrichment.likelihood / 10 : 0.5;

    // Map industry to sector
    if (enrichment.industry) {
      const sectorName = this.mapPDLIndustry(enrichment.industry);
      if (sectorName) {
        const sector = this.sectorCache.get(sectorName.toLowerCase());
        if (sector) {
          sectors.push({ ...sector, confidence: baseConfidence });
        }
      }
    }

    // Map skills
    if (enrichment.skills) {
      for (const skillName of enrichment.skills.slice(0, 10)) {
        const skill = this.skillCache.get(skillName.toLowerCase());
        if (skill) {
          skills.push({ ...skill, confidence: baseConfidence * 0.9 });
        }
      }
    }

    // Map interests
    if (enrichment.interests) {
      for (const interestName of enrichment.interests.slice(0, 5)) {
        const interest = this.interestCache.get(interestName.toLowerCase());
        if (interest) {
          interests.push({ ...interest, confidence: baseConfidence * 0.8 });
        }
      }
    }

    return {
      sectors: sectors.length > 0 ? sectors : undefined,
      skills: skills.length > 0 ? skills : undefined,
      interests: interests.length > 0 ? interests : undefined,
    };
  }

  /**
   * Find sector by name (with fuzzy matching)
   */
  findSector(name: string): { id: string; name: string } | undefined {
    const normalized = name.toLowerCase();
    return this.sectorCache.get(normalized);
  }

  /**
   * Find skill by name (with fuzzy matching)
   */
  findSkill(name: string): { id: string; name: string } | undefined {
    const normalized = name.toLowerCase();
    return this.skillCache.get(normalized);
  }

  /**
   * Find interest by name (with fuzzy matching)
   */
  findInterest(name: string): { id: string; name: string } | undefined {
    const normalized = name.toLowerCase();
    return this.interestCache.get(normalized);
  }

  /**
   * Resolve sector/skill names to IDs, creating if necessary
   */
  async resolveToIds(
    sectorNames: string[],
    skillNames: string[],
    interestNames: string[] = []
  ): Promise<{
    sectorIds: Array<{ id: string; name: string; confidence: number }>;
    skillIds: Array<{ id: string; name: string; confidence: number }>;
    interestIds: Array<{ id: string; name: string; confidence: number }>;
  }> {
    await this.loadCache();

    const sectorIds: Array<{ id: string; name: string; confidence: number }> = [];
    const skillIds: Array<{ id: string; name: string; confidence: number }> = [];
    const interestIds: Array<{ id: string; name: string; confidence: number }> = [];

    // Resolve sectors
    for (const name of sectorNames) {
      const sector = this.findSector(name);
      if (sector) {
        sectorIds.push({ ...sector, confidence: 0.7 });
      }
    }

    // Resolve skills
    for (const name of skillNames) {
      const skill = this.findSkill(name);
      if (skill) {
        skillIds.push({ ...skill, confidence: 0.7 });
      }
    }

    // Resolve interests
    for (const name of interestNames) {
      const interest = this.findInterest(name);
      if (interest) {
        interestIds.push({ ...interest, confidence: 0.6 });
      }
    }

    return { sectorIds, skillIds, interestIds };
  }
}

// Export singleton instance
export const taxonomyMappingService = new TaxonomyMappingService();
export default TaxonomyMappingService;
