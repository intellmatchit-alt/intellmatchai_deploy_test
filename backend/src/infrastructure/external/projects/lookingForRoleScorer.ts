/**
 * Per-Role Scoring for Project Matching
 *
 * Given a project's `lookingFor` list (e.g. ["investor", "technical_partner",
 * "strategic_partner"]) and a candidate contact/user, computes a 0-100
 * relevance score for each role independently.
 *
 * Composition (final per-role score):
 *
 *   keywordTier(title/company/bio, English+Arabic)  → 0..100 base
 *   + skillsOverlapBonus(project.skillsNeeded, contact.skills) → 0..30 bonus
 *   + sectorsOverlapBonus(project.sectors, contact.sectors)    → 0..20 bonus
 *   capped at 100
 *
 * Caller may also blend in an embedding-based semantic score with
 * `blendWithSemantic(...)` exported below: final = max(keyword+bonus, semantic).
 *
 * Total score for a match (the headline number on the card) =
 *   max of all per-role final scores.
 *
 * @module infrastructure/external/projects/lookingForRoleScorer
 */

import { countSynonymOverlap } from "./synonyms";

export type LookingForRole =
  | "investor"
  | "technical_partner"
  | "strategic_partner"
  | "advisor"
  | "service_provider"
  | "cofounder_talent"
  | "customer"
  | "mentor";

export const ROLE_LABELS: Record<string, string> = {
  investor: "Investor",
  technical_partner: "Technical Partner",
  strategic_partner: "Strategic Partner",
  advisor: "Advisor",
  service_provider: "Service Provider",
  cofounder_talent: "Cofounder / Talent",
  customer: "Customer",
  mentor: "Mentor",
};

/**
 * Plain-text descriptions of each role, used for embedding-based semantic
 * scoring. They're written so a model gets a faithful idea of what each role
 * means and what kinds of profiles fit it.
 */
export const ROLE_DESCRIPTIONS: Record<string, string> = {
  investor:
    "An investor: someone who invests money in startups. Examples: angel investor, venture capitalist, VC partner, family office principal, accelerator partner. They evaluate deal flow, do due diligence, sit on cap tables, and hold equity.",
  technical_partner:
    "A technical partner: a senior technical leader who can help build the product. Examples: CTO, VP of engineering, principal engineer, staff engineer, software architect, full-stack engineer, ML engineer, DevOps lead. Strong coding and engineering background.",
  strategic_partner:
    "A strategic partner: a senior business leader who can open doors, drive partnerships and growth. Examples: CEO, COO, head of business development, VP of partnerships, head of strategy, general manager, country manager, corporate development lead.",
  advisor:
    "An advisor: an experienced operator who provides guidance without taking an operating role. Examples: advisory board member, board director, chairman, mentor, retired CEO/CTO/CFO, professor, consultant with deep domain expertise.",
  service_provider:
    "A service provider: an external firm or specialist hired to deliver a defined service. Examples: agency, consulting firm, law firm, accounting firm, design studio, marketing agency, freelancer, contractor.",
  cofounder_talent:
    "A cofounder or early talent: someone willing to join as cofounder or founding team member. Examples: founder, cofounder, founding engineer, founding member, entrepreneur in residence, generalist operator, product/tech lead at an early-stage startup.",
  customer:
    "A potential customer or buyer for the product. Examples: chief procurement officer, head of procurement, head of operations, director of finance/HR/marketing/sales who would buy or pilot the product.",
  mentor:
    "A mentor: an experienced person who provides ongoing guidance and feedback to founders. Examples: mentor, coach, professor, trainer, instructor, educator, experienced advisor.",
};

export interface ContactScoringInput {
  fullName?: string | null;
  jobTitle?: string | null;
  company?: string | null;
  bio?: string | null;
  headline?: string | null;
  /** Names (English) of skills attached to this contact/user. */
  skillNames?: string[];
  /** IDs of skills attached. Used for set-overlap with project.skillsNeeded. */
  skillIds?: string[];
  /** IDs of sectors attached. Used for set-overlap with project.sectors. */
  sectorIds?: string[];
  /** Names of sectors attached. Used for synonym-aware overlap. */
  sectorNames?: string[];
}

export interface ProjectScoringInput {
  /** IDs of skills the project needs (from ProjectSkill rows). */
  skillIds?: string[];
  /** Names of skills (for surface display + synonym-aware overlap). */
  skillNames?: string[];
  /** IDs of sectors the project is in (from ProjectSector rows). */
  sectorIds?: string[];
  /** Names of sectors the project is in. Used for synonym-aware overlap. */
  sectorNames?: string[];
}

function low(s: string | null | undefined): string {
  return (s || "").toLowerCase().trim();
}

/**
 * Each role-specific scorer inspects fields separately and returns the
 * MAX score it can justify for the keyword tier (0..100). No summing of
 * keyword hits — that previously caused a contact whose title literally
 * is "Investor" to score 55 instead of 100.
 *
 * Where useful, both English and Arabic regexes are tried; either matching
 * triggers the tier.
 */
const KEYWORD_SCORERS: Record<string, (c: ContactScoringInput) => number> = {
  investor: (c) => {
    const title = `${low(c.jobTitle)} ${low(c.headline)}`;
    const company = low(c.company);
    const bio = low(c.bio);

    const investmentCompany =
      /\b(venture\s*capital|venture\s*partners?|capital\s*partners?|capital\b|ventures?\b|fund\b|funds\b|equity|investments?|holdings?|asset\s*management|family\s*office|accelerator|incubator|sovereign\s*wealth|pension\s*fund|hedge\s*fund|private\s*equity|\bpe\b)\b/.test(company) ||
      /(رأس\s*مال|صندوق|صناديق|استثمار|استثمارات|حاضنة|مسرعة|الاستثمار|المالية\s*القابضة)/.test(company);

    // Tier 1 (100): explicit investor title (any context)
    if (
      /\b(investor|angel\s*investor|venture\s*capitalist|business\s*angel|\bvc\b|seed\s*investor|growth\s*investor|impact\s*investor|early[\s-]stage\s*investor)\b/.test(title) ||
      /(مستثمر|مستثمرة|مستثمرون|مستثمرين|راعي\s*مالي|ملاك\s*أعمال|مستثمر\s*مبكر)/.test(title)
    ) return 100;

    // Tier 1b (95): partner/principal title combined with investment-firm context.
    // Catches "Operating Partner at X Capital", "Venture Partner @ Y Ventures",
    // "Limited Partner / LP", and the classic "General Partner".
    if (
      /\b(general\s*partner|managing\s*partner|founding\s*partner|operating\s*partner|venture\s*partner|limited\s*partner|\blp\b|\bgp\b)\b/.test(title)
    ) return investmentCompany ? 100 : 90;

    // Tier 2 (90): senior role at an investment firm — including Founder/CEO
    // of one. A "Founder of <VC firm>" IS an investor in the production sense.
    if (
      (/\b(partner|principal|associate|director|founder|co[\s-]?founder|cofounder|ceo|chief\s*investment|cio\b|chief\s*executive|managing\s*director|md\b|portfolio\s*manager|portfolio\s*director|investment\s*manager|investment\s*director|investment\s*analyst|investment\s*associate)\b/.test(title) ||
        /(شريك|شريك\s*مدير|شريك\s*مؤسس|مدير|مؤسس|مدير\s*استثمار|محلل\s*استثمار)/.test(title)) &&
      investmentCompany
    ) return 90;

    // Tier 3 (65): just an investment firm (any title) — they're embedded in
    // the investment world and likely to have deal flow / referrals.
    if (investmentCompany) return 65;

    // Tier 4 (45): bio mentions clear investor activity
    if (
      /\b(angel\s*investor|venture\s*capital|business\s*angel|active\s*investor|angel\s*investing|seed\s*investing)\b/.test(bio) ||
      /(مستثمر|استثمار\s*مخاطر|رأس\s*مال\s*مخاطر)/.test(bio)
    ) return 45;
    // Tier 5 (30): bio mentions investing patterns / portfolio language
    if (
      /\b(invest(ed|ing|or)|portfolio\s*compan(y|ies)|deal\s*flow|due\s*diligence|cap\s*table|term\s*sheet|first\s*check|lead\s*investor|follow[\s-]on|exits?|aum\b|raised\s*\$|backing|backed)\b/.test(bio) ||
      /(محفظة\s*استثمارية|عناية\s*واجبة|تمويل\s*مخاطر)/.test(bio)
    ) return 30;

    return 0;
  },

  technical_partner: (c) => {
    const title = `${low(c.jobTitle)} ${low(c.headline)}`;
    const company = low(c.company);
    const bio = low(c.bio);

    // Tier 1 (100): C-level technical title (incl. founding-CTO patterns)
    if (
      /\b(cto|chief\s*technology|chief\s*technical|technical\s*partner|chief\s*architect|chief\s*ai|chief\s*data|chief\s*ml|chief\s*scientist|founding\s*cto)\b/.test(title) ||
      /\b((co[\s-]?founder|cofounder|founder)\s*[\/&,]\s*cto)\b/.test(title) ||
      /(الرئيس\s*التقني|مدير\s*تقني\s*تنفيذي|شريك\s*تقني|كبير\s*المسؤولين\s*التقنيين)/.test(title)
    ) return 100;
    if (
      /\b(vp\s*of\s*(engineering|technology|product\s*engineering)|head\s*of\s*(engineering|technology|platform|infrastructure)|svp\s*engineering|evp\s*engineering)\b/.test(title) ||
      /(نائب\s*رئيس\s*الهندسة|رئيس\s*قسم\s*(الهندسة|التقنية|التكنولوجيا))/.test(title)
    ) return 95;
    // Tier 2 (90): senior IC / specialist / lead
    if (
      /\b(principal\s*engineer|staff\s*engineer|distinguished\s*engineer|engineering\s*lead|tech\s*lead|technical\s*lead|ml\s*lead|ai\s*lead|data\s*lead|data\s*engineering\s*lead|platform\s*lead|hacker\s*in\s*residence)\b/.test(title) ||
      /(قائد\s*هندسي|قائد\s*تقني|كبير\s*المهندسين|رئيس\s*المهندسين)/.test(title)
    ) return 90;
    if (
      /\b(senior\s+(software|backend|frontend|full[\s-]?stack|data|ml|ai|cloud|infrastructure|devops|platform)\s+(engineer|developer|architect)|solutions\s*architect|cloud\s*architect|software\s*architect|data\s*architect|enterprise\s*architect|solution\s*architect)\b/.test(title)
    ) return 88;
    if (
      /\b(software\s*engineer|backend\s*engineer|frontend\s*engineer|full[\s-]?stack(\s*engineer)?|data\s*scientist|ml\s*engineer|ai\s*engineer|machine\s*learning\s*engineer|data\s*engineer|infrastructure\s*engineer|reliability\s*engineer)\b/.test(title) ||
      /(مهندس\s*برمجيات|مهندس\s*برمجة|عالم\s*بيانات|مهندس\s*تعلم\s*آلي|مهندس\s*ذكاء\s*اصطناعي)/.test(title)
    ) return 85;
    // Tier 3 (75): generic engineer / technical role
    if (
      /\b(engineer|developer|programmer|architect|devops|sre|site\s*reliability|platform\s*engineer|qa\s*engineer|test\s*engineer)\b/.test(title) ||
      /(مهندس|مطور|مبرمج|معماري)/.test(title)
    ) return 75;
    // Tier 4 (50): "technical" / "technology" / "software" anywhere in title
    if (
      /\b(technical|technology|software|technologist|engineering)\b/.test(title) ||
      /(تقني|تكنولوجيا|برمجيات|تكنولوجي)/.test(title)
    ) return 50;
    // Tier 5 (45): Founder + tech-shaped company → likely the technical lead.
    if (
      /\b(co[\s-]?founder|cofounder|founder)\b/.test(title) &&
      (/\b(software|technology|tech|engineering|ai|ml|data|cloud|saas|fintech|biotech|robotics|cyber)\b/.test(company) ||
        /(برمجيات|تكنولوجيا|تقنية)/.test(company))
    ) return 45;
    // Tier 6 (40): tech-shaped company name (any title)
    if (
      /\b(software|technology|tech|engineering|ai|ml|data|cloud|saas|fintech|biotech|robotics|cyber)\b/.test(company) ||
      /(برمجيات|تكنولوجيا|تقنية)/.test(company)
    ) return 40;
    // Tier 7 (30): bio mentions technical work
    if (
      /\b(software\s*engineer|software\s*developer|coding|programming|technical|engineering|architecture|building\s*the\s*product|wrote\s*the\s*code)\b/.test(bio) ||
      /(برمجة|تطوير\s*برمجيات|هندسة)/.test(bio)
    ) return 30;
    return 0;
  },

  strategic_partner: (c) => {
    const title = `${low(c.jobTitle)} ${low(c.headline)}`;

    // Tier 1 (100): C-suite / explicit strategic title.
    // Founders and Chairmen sit at the same strategic-decision level as CEOs:
    // they're the people who form B2B partnerships, alliances, and JV deals,
    // so this tier explicitly includes them (English + Arabic).
    if (
      /\b(ceo|chief\s*executive|coo|chief\s*operating|chief\s*business|strategic\s*partner|founder|co[\s-]*founder|cofounder|chairman|chairperson|chair\b|chairwoman)\b/.test(title) ||
      /(الرئيس\s*التنفيذي|مدير\s*تنفيذي|مدير\s*عمليات|شريك\s*استراتيجي|الرئيس\s*التشغيلي|مؤسس|مؤسسة|الشريك\s*المؤسس|رئيس\s*مجلس\s*الإدارة|رئيس\s*المجلس)/.test(title)
    ) return 100;
    if (
      /\b(business\s*development|bus\s*dev|\bbd\b|partnerships?|strategic\s*partnerships?)\b/.test(title) ||
      /(تطوير\s*أعمال|تطوير\s*الأعمال|شراكات|الشراكات|تطوير\s*الشراكات)/.test(title)
    ) return 95;
    // Tier 2 (90): senior leadership
    if (
      /\b(president|managing\s*director|managing\s*partner|md\b)\b/.test(title) ||
      /(رئيس\s*تنفيذي|مدير\s*عام\s*تنفيذي|الرئيس)/.test(title)
    ) return 90;
    if (/\b(vp\b|vice\s*president|svp|evp)\b/.test(title) && /\b(strategy|business|partnership|operations)\b/.test(title)) return 90;
    // Tier 3 (80): general / country / regional manager
    if (
      /\b(general\s*manager|country\s*manager|regional\s*manager|gm\b)\b/.test(title) ||
      /(مدير\s*عام|مدير\s*إقليمي|مدير\s*منطقة|مدير\s*دولة)/.test(title)
    ) return 80;
    // Tier 4 (75): VP/SVP/EVP/Head Of/Director
    if (
      /\b(vp\b|vice\s*president|svp|evp|head\s*of|director\s*of|director\b)\b/.test(title) ||
      /(نائب\s*رئيس|رئيس\s*قسم|مدير\s*قسم|مدير\s*إدارة)/.test(title)
    ) return 75;
    // Tier 5 (70): strategy / alliances / corp dev
    if (
      /\b(strategy|strategic|alliances?|corporate\s*development|corp\s*dev)\b/.test(title) ||
      /(الاستراتيجية|تحالفات|تطوير\s*الشركات)/.test(title)
    ) return 70;
    // Tier 6 (50): senior manager / lead consultant
    if (/\b(senior|sr\.?|lead)\s+(manager|consultant|specialist|advisor)\b/.test(title)) return 50;
    return 0;
  },

  advisor: (c) => {
    const title = `${low(c.jobTitle)} ${low(c.headline)}`;
    const bio = low(c.bio);

    // Tier 1 (100): explicit advisor / board / chair role
    if (
      /\b(advisor|senior\s*advisor|strategic\s*advisor|industry\s*advisor|domain\s*advisor|technical\s*advisor|business\s*advisor|advisory\s*board|board\s*member|board\s*director|board\s*observer|non[\s-]?executive\s*director|\bned\b|independent\s*director|chairman|chairperson|chair\b|chairwoman)\b/.test(title) ||
      /(مستشار|مستشارة|مجلس\s*استشاري|عضو\s*مجلس|رئيس\s*مجلس|رئيس\s*مجلس\s*الإدارة|مستشار\s*أول|مستشار\s*استراتيجي)/.test(title)
    ) return 100;
    // Tier 2 (85): mentor / coach
    if (
      /\b(mentor|coach|executive\s*coach|business\s*coach|startup\s*coach)\b/.test(title) ||
      /(مرشد|موجه|مدرب)/.test(title)
    ) return 85;
    // Tier 3 (75): senior fellow / distinguished
    if (/\b(fellow|senior\s*fellow|distinguished\s*fellow|visiting\s*fellow|entrepreneur\s*in\s*residence|\beir\b|executive\s*in\s*residence)\b/.test(title)) return 75;
    // Tier 4 (70): consultant titles
    if (
      /\b(consultant|consulting|consultancy|principal\s*consultant)\b/.test(title) ||
      /(استشاري|استشارات)/.test(title)
    ) return 70;
    // Tier 5 (65): former exec / retired (bio or title)
    if (
      /\b(former\s*(ceo|cto|cfo|cmo|coo|founder)|ex[\s-](ceo|cto|cfo|cmo|coo|founder)|retired|emeritus)\b/.test(title + " " + bio) ||
      /(سابق(اً)?|متقاعد)/.test(title + " " + bio)
    ) return 65;
    // Tier 6 (60): academic
    if (
      /\b(professor|associate\s*professor|assistant\s*professor|lecturer|adjunct)\b/.test(title) ||
      /(أستاذ\s*جامعي|أستاذ|بروفسور|محاضر)/.test(title)
    ) return 60;
    // Tier 7 (40): bio mentions advising activity
    if (
      /\b(advise|advising|advisor|sit\s*on\s*\d+\s*board|advised\s+\d+|board\s+of\s+\w+)\b/.test(bio) ||
      /(استشارة|تقديم\s*المشورة|عضو\s*في\s*مجلس)/.test(bio)
    ) return 40;
    return 0;
  },

  service_provider: (c) => {
    const title = `${low(c.jobTitle)} ${low(c.headline)}`;
    const company = low(c.company);

    if (
      /\b(law\s*firm|accounting\s*firm|design\s*studio|software\s*house|dev\s*shop|marketing\s*agency|pr\s*agency|creative\s*agency|digital\s*agency|consulting\s*firm)\b/.test(company) ||
      /(مكتب\s*محاماة|مكتب\s*محاسبة|شركة\s*استشارات|وكالة\s*تسويق|وكالة\s*إعلان|بيت\s*برمجة)/.test(company)
    ) return 100;
    if (
      /\b(agency|consulting|consultancy|services|solutions)\b/.test(company) ||
      /(وكالة|استشارات|خدمات|حلول)/.test(company)
    ) return 90;
    if (
      /\b(provider|outsourcing|freelance|freelancer|contractor|service\s*provider)\b/.test(title) ||
      /(مزود\s*خدمة|مقاول|مستقل|خدمات\s*خارجية)/.test(title)
    ) return 80;
    if (
      /\b(account\s*manager|client\s*services|client\s*success|account\s*director)\b/.test(title) ||
      /(مدير\s*حسابات|مدير\s*عملاء)/.test(title)
    ) return 65;
    return 0;
  },

  cofounder_talent: (c) => {
    const title = `${low(c.jobTitle)} ${low(c.headline)}`;
    const bio = low(c.bio);

    // Tier 1 (100): explicit founder / cofounder
    if (
      /\b(co[\s-]?founder|cofounder|founder|solo\s*founder)\b/.test(title) ||
      /(مؤسس|مؤسسة|مؤسس\s*مشارك|مؤسسون|شريك\s*مؤسس)/.test(title)
    ) return 100;
    // Tier 2 (95): founding-team roles
    if (
      /\b(founding\s*(team|engineer|member|partner|designer|product|product\s*manager|pm|operations|operator|ceo|cto|cfo|coo))\b/.test(title) ||
      /(عضو\s*مؤسس|فريق\s*مؤسس|مهندس\s*مؤسس)/.test(title)
    ) return 95;
    // Tier 3 (75): entrepreneur / stealth / EIR
    if (
      /\b(entrepreneur|stealth(\s*startup)?|entrepreneur\s*in\s*residence|\beir\b)\b/.test(title) ||
      /(رائد\s*أعمال|رائدة\s*أعمال|روّاد\s*أعمال)/.test(title)
    ) return 75;
    // Tier 4 (60): senior IC at startup-stage
    if (/\b(principal\s*engineer|staff\s*engineer|tech\s*lead|product\s*lead|engineering\s*lead|design\s*lead|growth\s*lead)\b/.test(title)) return 60;
    // Tier 5 (50): generalist / operator / builder vocabulary
    if (/\b(generalist|maker|builder|operator|chief\s*of\s*staff|head\s*of\s*operations)\b/.test(title)) return 50;
    // Tier 6 (40): bio mentions founder/startup history
    if (
      /\b(founded|co[\s-]?founded|started\s+(my\s+)?(startup|company)|building\s+(my\s+)?startup|founding\s+team)\b/.test(bio) ||
      /(أسست|شاركت\s*في\s*تأسيس|أنشأت)/.test(bio)
    ) return 40;
    return 0;
  },

  customer: (c) => {
    const title = `${low(c.jobTitle)} ${low(c.headline)}`;

    if (
      /\b(chief\s*procurement|cpo\b|head\s*of\s*procurement|director\s*of\s*procurement)\b/.test(title) ||
      /(مدير\s*المشتريات|رئيس\s*المشتريات)/.test(title)
    ) return 100;
    if (
      /\b(procurement|buyer|purchasing\s*manager|sourcing\s*manager)\b/.test(title) ||
      /(مشتريات|مشتري)/.test(title)
    ) return 85;
    if (
      /\b(head\s*of|vp\s*of|director\s*of)\b/.test(title) ||
      /(رئيس\s*قسم|مدير\s*قسم)/.test(title)
    ) return 60;
    if (/\b(operations|finance|hr|marketing|sales)\s+(director|head|manager|lead)\b/.test(title)) return 55;
    if (/\b(ceo|coo|cfo|cmo|cio)\b/.test(title)) return 50;
    return 0;
  },

  mentor: (c) => {
    const title = `${low(c.jobTitle)} ${low(c.headline)}`;
    const bio = low(c.bio);

    if (
      /\b(mentor|coach|teacher|professor|trainer|instructor|educator)\b/.test(title) ||
      /(مرشد|موجه|مدرب|أستاذ|معلم|بروفسور)/.test(title)
    ) return 100;
    if (
      /\b(advisor|advising)\b/.test(title + " " + bio) ||
      /(مستشار)/.test(title + " " + bio)
    ) return 75;
    return 0;
  },
};

// ─── Skills / sectors overlap bonus ──────────────────────────────────────────

/**
 * Bonus = min(+30, +5 × matched skills) + min(+20, +10 × matched sectors).
 *
 * Each side is the MAX of the legacy ID-overlap and the synonym-aware name
 * overlap. The synonym layer catches "Big Data & Analytics" vs "Data
 * Analytics", "AI" vs "Artificial Intelligence", and Arabic ↔ English pairs.
 */
function overlapBonus(
  project: ProjectScoringInput | undefined,
  contact: ContactScoringInput,
): number {
  if (!project) return 0;

  // ID-based overlap (legacy, exact match)
  const projSkillIds = new Set(project.skillIds || []);
  const projSectorIds = new Set(project.sectorIds || []);
  const idSkillCount = (contact.skillIds || []).filter((id) => projSkillIds.has(id)).length;
  const idSectorCount = (contact.sectorIds || []).filter((id) => projSectorIds.has(id)).length;

  // Synonym-aware overlap on the human-readable names
  const synSkill = countSynonymOverlap(project.skillNames, contact.skillNames);
  const synSector = countSynonymOverlap(project.sectorNames, contact.sectorNames);

  const skillCount = Math.max(idSkillCount, synSkill.count);
  const sectorCount = Math.max(idSectorCount, synSector.count);

  const skillBonus = Math.min(30, skillCount * 5);
  const sectorBonus = Math.min(20, sectorCount * 10);
  return skillBonus + sectorBonus;
}

// ─── Public API ──────────────────────────────────────────────────────────────

export function scoreLookingForRoles(
  roles: string[],
  contact: ContactScoringInput,
  project?: ProjectScoringInput,
): Record<string, number> {
  if (!roles?.length) return {};
  const bonus = overlapBonus(project, contact);
  const out: Record<string, number> = {};
  for (const role of roles) {
    const fn = KEYWORD_SCORERS[role];
    const base = fn ? fn(contact) : 0;
    // The bonus only applies when the contact has at least *some* role-relevant
    // signal (base > 0). Otherwise a contact with zero role fit but matching
    // skills could rank above an actual fit, which is misleading.
    const score = base > 0 ? Math.min(100, base + bonus) : 0;
    out[role] = Math.round(score);
  }
  return out;
}

/**
 * Blend a precomputed semantic similarity score (0..100) into the
 * keyword/skills score, taking the max. This lets a contact whose title
 * doesn't match keywords still surface if their bio is semantically close
 * to the role description.
 */
export function blendWithSemantic(
  keywordScores: Record<string, number>,
  semanticScores: Record<string, number> | null | undefined,
): Record<string, number> {
  if (!semanticScores) return keywordScores;
  const out: Record<string, number> = { ...keywordScores };
  for (const [role, sem] of Object.entries(semanticScores)) {
    out[role] = Math.max(keywordScores[role] ?? 0, Math.round(sem));
  }
  return out;
}

export function totalScoreFromLookingFor(
  scores: Record<string, number> | null | undefined,
): number | null {
  if (!scores) return null;
  const values = Object.values(scores);
  if (!values.length) return null;
  return Math.max(...values);
}
