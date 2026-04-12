/**
 * Experience Parsing Service
 *
 * Parses job titles to extract role, seniority, department, and decision-maker status.
 * Estimates years of experience and career trajectory.
 *
 * @module infrastructure/services/experience/ExperienceParsingService
 */

import {
  detectSeniorityLevel,
  SeniorityLevel,
  SENIORITY_SCORES,
  matchesRolePatterns,
  SENIOR_ROLE_PATTERNS,
  INVESTOR_ROLE_PATTERNS,
} from '../../../shared/matching';

// ============================================================================
// Types
// ============================================================================

export interface ParsedJobTitle {
  role: string;
  seniority: SeniorityLevel;
  seniorityScore: number;
  department: string | null;
  isDecisionMaker: boolean;
}

export enum CareerTrajectory {
  ASCENDING = 'ASCENDING',
  LATERAL = 'LATERAL',
  DESCENDING = 'DESCENDING',
  UNKNOWN = 'UNKNOWN',
}

export interface ExperienceMatchResult {
  score: number; // 0-100
  explanation: string;
}

// ============================================================================
// Department Detection
// ============================================================================

const DEPARTMENT_KEYWORDS: Record<string, string[]> = {
  'Engineering': ['engineer', 'developer', 'programmer', 'software', 'technical', 'architect', 'devops', 'sre', 'infrastructure', 'platform'],
  'Product': ['product', 'ux', 'ui', 'design', 'user experience', 'user interface'],
  'Sales': ['sales', 'account executive', 'account manager', 'revenue', 'commercial', 'business development'],
  'Marketing': ['marketing', 'brand', 'growth', 'demand', 'content', 'seo', 'social media', 'communications'],
  'Finance': ['finance', 'accounting', 'treasurer', 'controller', 'financial', 'cfo', 'audit'],
  'Operations': ['operations', 'ops', 'supply chain', 'logistics', 'procurement', 'facilities'],
  'HR': ['hr', 'human resources', 'people', 'talent', 'recruiting', 'recruitment', 'culture'],
  'Legal': ['legal', 'counsel', 'compliance', 'regulatory', 'attorney', 'lawyer'],
  'IT': ['it', 'information technology', 'systems', 'network', 'security', 'helpdesk'],
  'Data': ['data', 'analytics', 'data science', 'machine learning', 'ai', 'business intelligence'],
  'Customer Success': ['customer success', 'customer support', 'customer experience', 'client success'],
  'Executive': ['ceo', 'cto', 'cfo', 'coo', 'cmo', 'cio', 'chief', 'president', 'founder'],
};

const DECISION_MAKER_KEYWORDS = [
  'ceo', 'cto', 'cfo', 'coo', 'cmo', 'cio', 'chief',
  'president', 'founder', 'co-founder', 'owner',
  'vp', 'vice president', 'svp', 'evp',
  'director', 'head of', 'managing director',
  'general manager', 'partner', 'managing partner',
];

// ============================================================================
// Arabic Department Keywords
// ============================================================================

const ARABIC_DEPARTMENT_KEYWORDS: Record<string, string[]> = {
  'Engineering': ['مهندس', 'مهندسة', 'مطور', 'مطورة', 'مبرمج', 'تقني', 'برمجيات'],
  'Product': ['منتج', 'تصميم', 'تجربة المستخدم'],
  'Sales': ['مبيعات', 'تطوير الأعمال', 'تجاري'],
  'Marketing': ['تسويق', 'علامة تجارية', 'محتوى', 'إعلام'],
  'Finance': ['مالي', 'مالية', 'محاسب', 'محاسبة', 'المدير المالي'],
  'Operations': ['عمليات', 'تشغيل', 'لوجستيات'],
  'HR': ['موارد بشرية', 'توظيف', 'شؤون الموظفين'],
  'Legal': ['قانوني', 'قانونية', 'محامي', 'امتثال'],
  'IT': ['تكنولوجيا المعلومات', 'أنظمة', 'شبكات', 'أمن المعلومات'],
  'Data': ['بيانات', 'تحليلات', 'ذكاء اصطناعي'],
  'Customer Success': ['خدمة العملاء', 'نجاح العملاء', 'دعم العملاء'],
  'Executive': ['المدير التنفيذي', 'الرئيس التنفيذي', 'المدير التقني', 'مدير العمليات', 'مؤسس', 'رئيس'],
};

// ============================================================================
// Arabic Decision Maker Keywords
// ============================================================================

const ARABIC_DECISION_MAKER_KEYWORDS = [
  'المدير التنفيذي', 'الرئيس التنفيذي',
  'المدير التقني', 'مدير التكنولوجيا',
  'المدير المالي',
  'مدير العمليات',
  'مؤسس', 'شريك مؤسس',
  'نائب الرئيس',
  'مدير عام', 'رئيس',
  'شريك',
];

// ============================================================================
// Seniority to estimated years mapping
// ============================================================================

const SENIORITY_YEARS: Record<SeniorityLevel, { min: number; typical: number; max: number }> = {
  [SeniorityLevel.BOARD]: { min: 15, typical: 25, max: 40 },
  [SeniorityLevel.C_LEVEL]: { min: 10, typical: 20, max: 40 },
  [SeniorityLevel.VP]: { min: 8, typical: 15, max: 30 },
  [SeniorityLevel.DIRECTOR]: { min: 6, typical: 12, max: 25 },
  [SeniorityLevel.LEAD]: { min: 5, typical: 10, max: 20 },
  [SeniorityLevel.SENIOR]: { min: 4, typical: 8, max: 20 },
  [SeniorityLevel.MID]: { min: 2, typical: 4, max: 10 },
  [SeniorityLevel.ENTRY]: { min: 0, typical: 1, max: 3 },
};

// ============================================================================
// Service
// ============================================================================

export class ExperienceParsingService {
  /**
   * Parse a job title into structured components
   */
  parseJobTitle(title: string): ParsedJobTitle {
    if (!title || title.trim().length === 0) {
      return {
        role: '',
        seniority: SeniorityLevel.MID,
        seniorityScore: SENIORITY_SCORES[SeniorityLevel.MID],
        department: null,
        isDecisionMaker: false,
      };
    }

    const titleLower = title.toLowerCase().trim();
    const isArabic = /[\u0600-\u06FF]/.test(title);

    // Detect seniority
    const seniority = detectSeniorityLevel(titleLower);
    const seniorityScore = SENIORITY_SCORES[seniority];

    // Detect department
    const department = this.detectDepartment(titleLower);

    // Check decision maker (include Arabic keywords if Arabic text detected)
    const isDecisionMaker = DECISION_MAKER_KEYWORDS.some(kw => titleLower.includes(kw))
      || (isArabic && ARABIC_DECISION_MAKER_KEYWORDS.some(kw => title.includes(kw)));

    // Extract role (remove seniority prefixes/suffixes)
    const role = this.extractRole(title);

    return {
      role,
      seniority,
      seniorityScore,
      department,
      isDecisionMaker,
    };
  }

  /**
   * Estimate years of experience from profile data
   */
  estimateYearsOfExperience(profile: {
    jobTitle?: string | null;
    enrichmentData?: any;
  }): number {
    // Try enrichment data first
    if (profile.enrichmentData) {
      const enrichment = profile.enrichmentData;
      if (enrichment.yearsOfExperience) {
        return parseInt(enrichment.yearsOfExperience, 10) || 0;
      }
      if (enrichment.experience && Array.isArray(enrichment.experience)) {
        return this.calculateYearsFromExperience(enrichment.experience);
      }
    }

    // Fallback to seniority heuristic
    if (profile.jobTitle) {
      const seniority = detectSeniorityLevel(profile.jobTitle);
      return SENIORITY_YEARS[seniority].typical;
    }

    return 0;
  }

  /**
   * Calculate career trajectory from a list of titles (newest first)
   */
  calculateCareerTrajectory(titles: string[]): CareerTrajectory {
    if (titles.length < 2) return CareerTrajectory.UNKNOWN;

    const seniorityScores = titles.map(t => SENIORITY_SCORES[detectSeniorityLevel(t)]);

    // Compare first (most recent) to last (oldest)
    const recentScore = seniorityScores[0];
    const oldestScore = seniorityScores[seniorityScores.length - 1];

    const diff = recentScore - oldestScore;

    if (diff > 10) return CareerTrajectory.ASCENDING;
    if (diff < -10) return CareerTrajectory.DESCENDING;
    return CareerTrajectory.LATERAL;
  }

  /**
   * Match experience level: how well does a candidate match a required experience level?
   * Returns 0-100.
   */
  matchExperienceLevel(
    required: { seniority?: SeniorityLevel; minYears?: number; maxYears?: number },
    candidate: { jobTitle?: string | null; enrichmentData?: any }
  ): ExperienceMatchResult {
    const candidateTitle = candidate.jobTitle || '';
    const candidateSeniority = detectSeniorityLevel(candidateTitle);
    const candidateYears = this.estimateYearsOfExperience(candidate);

    let score = 0;
    let explanation = '';

    // Seniority matching (60% of score)
    if (required.seniority) {
      const requiredScore = SENIORITY_SCORES[required.seniority];
      const candidateScore = SENIORITY_SCORES[candidateSeniority];

      // Calculate seniority match
      const diff = Math.abs(requiredScore - candidateScore);
      const seniorityMatch = Math.max(0, 100 - diff * 2);
      score += seniorityMatch * 0.6;

      if (candidateScore >= requiredScore) {
        explanation = `${candidateSeniority} level matches or exceeds required ${required.seniority}`;
      } else {
        explanation = `${candidateSeniority} level is below required ${required.seniority}`;
      }
    } else {
      score += 50 * 0.6; // Neutral if no seniority required
      explanation = 'No specific seniority required';
    }

    // Years of experience matching (40% of score)
    if (required.minYears !== undefined || required.maxYears !== undefined) {
      const minYears = required.minYears || 0;
      const maxYears = required.maxYears || 99;

      if (candidateYears >= minYears && candidateYears <= maxYears) {
        score += 100 * 0.4;
        explanation += `. ~${candidateYears} years experience fits the range`;
      } else if (candidateYears < minYears) {
        const gap = minYears - candidateYears;
        const yearsMatch = Math.max(0, 100 - gap * 15);
        score += yearsMatch * 0.4;
        explanation += `. ~${candidateYears} years, ${gap} below minimum`;
      } else {
        // Over-qualified is less penalized
        const excess = candidateYears - maxYears;
        const yearsMatch = Math.max(50, 100 - excess * 5);
        score += yearsMatch * 0.4;
        explanation += `. ~${candidateYears} years, may be overqualified`;
      }
    } else {
      score += 50 * 0.4; // Neutral
    }

    return {
      score: Math.round(Math.min(100, score)),
      explanation,
    };
  }

  // ============================================================================
  // Private Helpers
  // ============================================================================

  private detectDepartment(titleLower: string): string | null {
    for (const [dept, keywords] of Object.entries(DEPARTMENT_KEYWORDS)) {
      if (keywords.some(kw => titleLower.includes(kw))) {
        return dept;
      }
    }
    // Check Arabic department keywords
    for (const [dept, keywords] of Object.entries(ARABIC_DEPARTMENT_KEYWORDS)) {
      if (keywords.some(kw => titleLower.includes(kw))) {
        return dept;
      }
    }
    return null;
  }

  private extractRole(title: string): string {
    // Remove common seniority prefixes
    let role = title
      .replace(/\b(senior|sr\.?|junior|jr\.?|lead|principal|staff|chief|head of|vp of|director of|manager of)\b/gi, '')
      .replace(/\b(intern|trainee|associate|assistant)\b/gi, '')
      .trim()
      .replace(/^\s*[-,]\s*/, '')
      .replace(/\s*[-,]\s*$/, '')
      .trim();

    return role || title;
  }

  private calculateYearsFromExperience(experience: any[]): number {
    if (!experience || experience.length === 0) return 0;

    let totalMonths = 0;
    const now = new Date();

    for (const exp of experience) {
      const startDate = exp.startDate ? new Date(exp.startDate) : null;
      const endDate = exp.endDate ? new Date(exp.endDate) : now;

      if (startDate) {
        const months = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24 * 30);
        totalMonths += Math.max(0, months);
      }
    }

    return Math.round(totalMonths / 12);
  }
}

// Export singleton instance
export const experienceParsingService = new ExperienceParsingService();
