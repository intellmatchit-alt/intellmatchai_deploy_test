/**
 * IntellMatch Job Matching Engine — Helper-Flow Scoring Utilities
 *
 * Deterministic scoring for OPEN_TO_OPPORTUNITY_TO_HELPERS and
 * TARGET_JOB_TO_HELPERS modes. Answers:
 *
 *     "Why might this person help the candidate get a job?"
 *
 * NOT a candidate-fit scorer. The helper does NOT need to be a great
 * candidate — they need to be plausibly able to refer, introduce, advise,
 * or otherwise unlock opportunities.
 *
 * Ten components per the Job Engine spec §10. Weights sum to 1.00 and are
 * declared at the top of the file so reviewers can see them at a glance.
 *
 * @module job-matching/job-helper-scoring.utils
 */

import {
  HardFilterReason,
  HelperType,
  HELPER_TYPE_LABELS,
  LikelyHelpType,
  CandidateProfile,
  DeterministicScoreBreakdown,
  ScoringComponent,
} from './job-matching.types';
import { HardFilterStatus } from './job-matching.types';

// ============================================================================
// WEIGHTS — single source of truth (spec §14)
// ============================================================================

/**
 * OPEN_TO_OPPORTUNITY_TO_HELPERS weights. Sum to 1.00.
 * Tilted toward relationship/intro signals; recruiter/hiring/functional
 * signals are equal-weighted; semantic is the lowest because it's noisiest.
 */
export const HELPER_SCORING_WEIGHTS = {
  recruiterTalentSignalScore: 0.12,
  hiringInfluenceScore: 0.12,
  functionalRelevanceScore: 0.12,
  companyOpportunityAccessScore: 0.10,
  relationshipTrustScore: 0.14,
  introPathScore: 0.12,
  advocacyLikelihoodScore: 0.10,
  candidateSupportFitScore: 0.10,
  helperNetworkStrengthScore: 0.05,
  semanticOpportunityFitScore: 0.03,
} as const;

export type HelperComponentName = keyof typeof HELPER_SCORING_WEIGHTS;

// ============================================================================
// HELPER RECORD — normalized input to the scorer
// ============================================================================

/**
 * Normalised view of a "helper" — a person in the requester's network who
 * might help the candidate. Sourced from Contact rows (and User rows in
 * future phases).
 */
export interface HelperRecord {
  id: string;
  /** Unique key for dedupe. Prefer `userId` when the helper is a registered
   *  user; falls back to `contactId` for contacts without a user account. */
  userId: string | null;
  contactId: string | null;
  fullName: string;
  jobTitle: string | null;
  company: string | null;
  bio: string | null;
  email: string | null;
  linkedinUrl: string | null;
  sectors: string[];
  skills: string[];
  interests: string[];
  /** Network signals — populated by the retrieval layer. Defaults are
   *  conservative ("we don't know") rather than optimistic. */
  network: {
    /** 1 = direct connection / contact owned by requester; 2 = mutual; 3 = farther. */
    degree: 1 | 2 | 3;
    mutualConnections: number;
    sameOrganization: boolean;
    relationshipStrength: number; // 0..1
  };
  /** Optional flags — only present if the source table has them. */
  optedOut?: boolean;
  blocked?: boolean;
  excluded?: boolean;
}

// ============================================================================
// KEYWORD TAXONOMIES
// ============================================================================

const RECRUITER_KEYWORDS = [
  'recruiter',
  'talent acquisition',
  'talent partner',
  'talent advisor',
  'talent sourcer',
  'sourcer',
  'people partner',
  'people operations',
  'people ops',
  'human resources',
  ' hr ',
  'hr business partner',
  'hrbp',
  'hiring manager',
  'staffing',
  'headhunter',
  'executive search',
];

const HIRING_INFLUENCE_KEYWORDS = [
  'founder',
  'co-founder',
  'cofounder',
  ' ceo',
  ' cto',
  ' coo',
  ' cfo',
  ' cmo',
  ' cpo',
  'chief ',
  'vp ',
  'vice president',
  'svp',
  'evp',
  'managing director',
  'managing partner',
  'director of',
  'head of',
  'principal',
  'partner ',
  'general manager',
  'gm ',
  'president',
];

const SENIOR_OPERATOR_KEYWORDS = [
  'lead',
  'staff ',
  'principal',
  'senior',
  'manager',
];

// ============================================================================
// HELPERS — text utilities
// ============================================================================

function lc(s: string | null | undefined): string {
  return (s || '').toLowerCase();
}

function paddedText(s: string | null | undefined): string {
  // Pad with spaces so " ceo" / " hr " keyword matches don't trigger on
  // substrings like "received" or "shr".
  return ` ${lc(s)} `;
}

function uniqLower(values: (string | null | undefined)[]): string[] {
  const set = new Set<string>();
  for (const v of values) {
    if (typeof v !== 'string') continue;
    const norm = v.trim().toLowerCase();
    if (norm) set.add(norm);
  }
  return [...set];
}

function overlapCount(a: string[], b: string[]): number {
  if (!a.length || !b.length) return 0;
  const bs = new Set(b.map((x) => x.toLowerCase()));
  let n = 0;
  for (const x of a) if (bs.has(x.toLowerCase())) n++;
  return n;
}

function clamp01(n: number): number {
  if (!isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function clamp100(n: number): number {
  if (!isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

// ============================================================================
// COMPONENT SCORERS — each returns { score, evidence, penalties, confidence }
// ============================================================================

interface ComponentResult {
  score: number;
  evidence: string[];
  penalties: string[];
  confidence: number;
}

/**
 * 1. recruiterTalentSignalScore — is this a recruiter / talent / HR contact?
 *
 * Pure title-based signal. Bio mentions count for less because they're
 * noisier. Penalises mismatches lightly when we see a senior IC title with
 * no recruiter signal at all (we still want the helper, just not under this
 * banner).
 */
function scoreRecruiterTalentSignal(helper: HelperRecord): ComponentResult {
  const title = paddedText(helper.jobTitle);
  const bio = paddedText(helper.bio);

  const titleHits = RECRUITER_KEYWORDS.filter((k) => title.includes(k));
  const bioHits = RECRUITER_KEYWORDS.filter((k) => bio.includes(k));

  let score = 0;
  const evidence: string[] = [];

  if (titleHits.length > 0) {
    score = 90;
    evidence.push(`Title indicates recruiter/talent role: "${helper.jobTitle}"`);
  } else if (bioHits.length > 0) {
    score = 55;
    evidence.push(`Bio mentions recruiting/talent activity`);
  } else {
    score = 0;
  }

  return {
    score,
    evidence,
    penalties: [],
    confidence: titleHits.length > 0 ? 0.9 : bioHits.length > 0 ? 0.6 : 0.4,
  };
}

/**
 * 2. hiringInfluenceScore — is this a decision-maker / hiring authority?
 *
 * Founder, CEO, CTO, VP, Director, Head of X, principal, etc. NOT the same
 * as "senior" — a senior IC has limited hiring authority unless they're
 * also a tech lead.
 */
function scoreHiringInfluence(helper: HelperRecord): ComponentResult {
  const title = paddedText(helper.jobTitle);
  const hits = HIRING_INFLUENCE_KEYWORDS.filter((k) => title.includes(k));
  const seniorHits = SENIOR_OPERATOR_KEYWORDS.filter((k) => title.includes(k));

  let score = 0;
  const evidence: string[] = [];

  if (hits.length > 0) {
    score = 88;
    evidence.push(`Senior decision-maker role: "${helper.jobTitle}"`);
  } else if (seniorHits.length > 0) {
    // Senior IC / lead — partial signal. They influence hiring within their
    // team but aren't the primary authority.
    score = 50;
    evidence.push(`Senior role with team-level hiring influence: "${helper.jobTitle}"`);
  }

  return {
    score,
    evidence,
    penalties: [],
    confidence: hits.length > 0 ? 0.85 : seniorHits.length > 0 ? 0.55 : 0.4,
  };
}

/**
 * 3. functionalRelevanceScore — does the helper work in the same/related
 *    role area as the candidate's target role?
 *
 * Compares helper.jobTitle / sectors / skills against candidate.roleArea +
 * skills + industries.
 */
function scoreFunctionalRelevance(
  helper: HelperRecord,
  candidate: CandidateProfile,
): ComponentResult {
  const candidateRoleArea = lc((candidate as any).roleArea);
  const candidateSkills = uniqLower((candidate as any).skills ?? []);
  const candidateIndustries = uniqLower((candidate as any).industries ?? []);

  const evidence: string[] = [];
  let score = 0;

  // Role area / title overlap
  if (candidateRoleArea && lc(helper.jobTitle).includes(candidateRoleArea)) {
    score += 35;
    evidence.push(`Helper job title contains role area "${candidateRoleArea}"`);
  } else if (
    candidateRoleArea &&
    helper.sectors.some((s) => lc(s).includes(candidateRoleArea))
  ) {
    score += 20;
    evidence.push(`Helper sector aligns with role area "${candidateRoleArea}"`);
  }

  // Skill overlap (at most 35 pts)
  const skillOverlap = overlapCount(helper.skills, candidateSkills);
  if (skillOverlap > 0) {
    const skillPts = Math.min(35, skillOverlap * 10);
    score += skillPts;
    evidence.push(`${skillOverlap} overlapping skill(s)`);
  }

  // Industry overlap (at most 30 pts)
  const indOverlap = overlapCount(helper.sectors, candidateIndustries);
  if (indOverlap > 0) {
    const indPts = Math.min(30, indOverlap * 12);
    score += indPts;
    evidence.push(`${indOverlap} industry overlap(s)`);
  }

  return {
    score: clamp100(score),
    evidence,
    penalties: [],
    confidence: candidateRoleArea ? 0.7 : 0.5,
  };
}

/**
 * 4. companyOpportunityAccessScore — is the helper connected to companies,
 *    sectors, or markets where the candidate is likely to find opportunities?
 *
 * Strong signal when helper.company is well-known/relevant or when helper
 * sectors overlap candidate.industries.
 */
function scoreCompanyOpportunityAccess(
  helper: HelperRecord,
  candidate: CandidateProfile,
): ComponentResult {
  const candidateIndustries = uniqLower((candidate as any).industries ?? []);
  const evidence: string[] = [];
  let score = 0;

  // Sector / industry overlap is the primary signal
  const indOverlap = overlapCount(helper.sectors, candidateIndustries);
  if (indOverlap > 0) {
    score += Math.min(60, indOverlap * 25);
    evidence.push(
      `Helper operates in ${indOverlap} relevant industry/sector(s)`,
    );
  }

  // Helper has a named company — even without industry overlap, that's a
  // potential entry point.
  if (helper.company) {
    score += 25;
    evidence.push(`Connected to company "${helper.company}"`);
  }

  return {
    score: clamp100(score),
    evidence,
    penalties: helper.company ? [] : ['No clear company affiliation found'],
    confidence: helper.company ? 0.75 : 0.45,
  };
}

/**
 * 5. relationshipTrustScore — strength of the requester↔helper relationship.
 *
 * Driven by network.degree, mutualConnections, sameOrganization, and
 * relationshipStrength provided by the retrieval layer.
 */
function scoreRelationshipTrust(helper: HelperRecord): ComponentResult {
  const { degree, mutualConnections, sameOrganization, relationshipStrength } =
    helper.network;
  const evidence: string[] = [];
  let score = 0;

  if (degree === 1) {
    score += 60;
    evidence.push('Direct connection in your network');
  } else if (degree === 2) {
    score += 30;
    evidence.push('Second-degree connection (introducer required)');
  } else {
    score += 10;
    evidence.push('Distant connection');
  }

  if (sameOrganization) {
    score += 15;
    evidence.push('Same organisation as you');
  }

  if (mutualConnections > 0) {
    score += Math.min(15, mutualConnections * 3);
    evidence.push(`${mutualConnections} mutual connection(s)`);
  }

  if (relationshipStrength > 0) {
    score += Math.round(relationshipStrength * 10);
    if (relationshipStrength >= 0.6) {
      evidence.push('Strong prior interaction history');
    }
  }

  return {
    score: clamp100(score),
    evidence,
    penalties: [],
    confidence: degree === 1 ? 0.85 : 0.6,
  };
}

/**
 * 6. introPathScore — can the helper realistically make a warm intro?
 *
 * Combines relationship trust with hiring influence / recruiter signal. A
 * direct connection who's also a hiring manager is a strong intro path.
 */
function scoreIntroPath(
  helper: HelperRecord,
  recruiter: ComponentResult,
  hiring: ComponentResult,
): ComponentResult {
  const { degree, mutualConnections } = helper.network;

  let score = 0;
  const evidence: string[] = [];

  // Has to be reachable in network at all
  if (degree === 1) score += 45;
  else if (degree === 2 && mutualConnections > 0) score += 25;
  else score += 5;

  // And has to have somewhere to take the candidate
  if (recruiter.score >= 70) {
    score += 35;
    evidence.push('Direct recruiter pathway');
  } else if (hiring.score >= 70) {
    score += 30;
    evidence.push('Direct hiring-decision pathway');
  } else if (recruiter.score >= 40 || hiring.score >= 40) {
    score += 15;
    evidence.push('Adjacent hiring pathway');
  }

  if (helper.linkedinUrl) {
    score += 5;
    evidence.push('LinkedIn channel available for introduction');
  }

  return {
    score: clamp100(score),
    evidence,
    penalties:
      degree > 2 && mutualConnections === 0
        ? ['No clear introduction path — distant connection with no mutuals']
        : [],
    confidence: degree === 1 ? 0.8 : 0.55,
  };
}

/**
 * 7. advocacyLikelihoodScore — would the helper actually advocate for the
 *    candidate? Combines relationship trust × functional relevance.
 *
 * Someone close + functionally relevant is much more likely to advocate
 * than a distant contact with no shared context.
 */
function scoreAdvocacyLikelihood(
  trust: ComponentResult,
  functional: ComponentResult,
  recruiter: ComponentResult,
): ComponentResult {
  // Geometric-ish blend: both legs have to be non-trivial.
  const trustNorm = trust.score / 100;
  const funcNorm = functional.score / 100;
  const recruiterBoost = recruiter.score >= 70 ? 1.1 : 1.0;
  const score = clamp100(Math.sqrt(trustNorm * funcNorm) * 100 * recruiterBoost);

  const evidence: string[] = [];
  if (trust.score >= 60 && functional.score >= 60) {
    evidence.push('Strong advocacy potential (close + functionally relevant)');
  } else if (trust.score >= 60) {
    evidence.push('Strong relationship but limited functional overlap');
  } else if (functional.score >= 60) {
    evidence.push('Strong functional fit but limited relationship strength');
  }

  return {
    score,
    evidence,
    penalties: [],
    confidence: 0.65,
  };
}

/**
 * 8. candidateSupportFitScore — does the helper's profile *match the kind
 *    of help this specific candidate needs*?
 *
 * Senior IC candidate looking for a senior IC role → senior helpers /
 * recruiters in that band score well. Founder-track candidate → founders
 * and investors score well.
 */
function scoreCandidateSupportFit(
  helper: HelperRecord,
  candidate: CandidateProfile,
  recruiter: ComponentResult,
  hiring: ComponentResult,
): ComponentResult {
  const seniority = String((candidate as any).seniority || '').toUpperCase();
  const evidence: string[] = [];
  let score = 50; // neutral baseline

  if (seniority === 'EXECUTIVE' || seniority === 'FOUNDER') {
    if (hiring.score >= 70) {
      score = 90;
      evidence.push('Helper has executive-level reach for an executive candidate');
    } else if (recruiter.score >= 70) {
      score = 65;
      evidence.push('Recruiter contact, but candidate is seeking executive-level path');
    } else {
      score = 35;
    }
  } else if (
    seniority === 'SENIOR' ||
    seniority === 'LEAD' ||
    seniority === 'STAFF' ||
    seniority === 'PRINCIPAL'
  ) {
    if (recruiter.score >= 70 || hiring.score >= 60) {
      score = 80;
      evidence.push('Helper aligned with senior-IC / staff-level hiring paths');
    } else {
      score = 55;
    }
  } else {
    // Mid / junior / intern — recruiter contacts and hiring managers both fit
    if (recruiter.score >= 60 || hiring.score >= 50) {
      score = 75;
      evidence.push('Helper aligned with the candidate seniority band');
    }
  }

  return {
    score: clamp100(score),
    evidence,
    penalties: [],
    confidence: 0.6,
  };
}

/**
 * 9. helperNetworkStrengthScore — proxy for "how much reach does this
 *    helper have themselves?". Without explicit network analytics we use
 *    job title (senior/director/founder) and presence of LinkedIn URL as
 *    weak proxies for reach.
 */
function scoreHelperNetworkStrength(
  helper: HelperRecord,
  hiring: ComponentResult,
): ComponentResult {
  let score = 30; // baseline
  const evidence: string[] = [];

  if (hiring.score >= 80) {
    score += 40;
    evidence.push('Senior leadership position implies broad network');
  } else if (hiring.score >= 50) {
    score += 25;
    evidence.push('Mid-leadership position with growing network');
  }

  if (helper.linkedinUrl) {
    score += 15;
    evidence.push('LinkedIn presence');
  }

  if (helper.company) {
    score += 10;
  }

  return {
    score: clamp100(score),
    evidence,
    penalties: helper.linkedinUrl ? [] : ['No LinkedIn URL on file — reach unknown'],
    confidence: 0.45,
  };
}

/**
 * 10. semanticOpportunityFitScore — broad "vibes" check between the
 *     candidate's profileSummaryPreferences and the helper's bio/title/
 *     company text. Lexical only here; embedding-based semantic matching
 *     can be plugged in via the Cohere reranker (Phase 0 architecture).
 */
function scoreSemanticOpportunityFit(
  helper: HelperRecord,
  candidate: CandidateProfile,
): ComponentResult {
  const candText = lc(
    [
      (candidate as any).profileSummaryPreferences,
      (candidate as any).title,
      (candidate as any).roleArea,
      ...((candidate as any).skills || []),
      ...((candidate as any).industries || []),
    ]
      .filter(Boolean)
      .join(' '),
  );

  const helperText = lc(
    [
      helper.jobTitle,
      helper.company,
      helper.bio,
      ...helper.sectors,
      ...helper.skills,
    ]
      .filter(Boolean)
      .join(' '),
  );

  if (!candText || !helperText) {
    return { score: 30, evidence: [], penalties: [], confidence: 0.3 };
  }

  // Lexical token overlap on words longer than 3 chars
  const candTokens = new Set(
    candText.split(/\W+/).filter((t) => t.length > 3),
  );
  const helperTokens = helperText.split(/\W+/).filter((t) => t.length > 3);
  let hits = 0;
  for (const t of helperTokens) if (candTokens.has(t)) hits++;
  const ratio = candTokens.size > 0 ? hits / candTokens.size : 0;
  const score = clamp100(Math.round(ratio * 100));

  return {
    score,
    evidence: hits > 0 ? [`${hits} shared semantic token(s) with candidate profile`] : [],
    penalties: [],
    confidence: 0.45,
  };
}

// ============================================================================
// COMBINER
// ============================================================================

function buildComponent(
  name: HelperComponentName,
  result: ComponentResult,
  explanationFallback: string,
): ScoringComponent {
  const weight = HELPER_SCORING_WEIGHTS[name];
  return {
    name,
    score: result.score,
    weight,
    weightedScore: result.score * weight,
    explanation:
      result.evidence[0] ||
      result.penalties[0] ||
      explanationFallback,
    confidence: clamp01(result.confidence),
    evidence: result.evidence,
    penalties: result.penalties,
  };
}

/**
 * Run every helper-flow component and return a unified deterministic
 * breakdown — same shape as the candidate-flow scorer, so the existing
 * gating / explanation / persistence layers don't need to know the
 * difference.
 */
export function calculateHelperDeterministicScore(
  helper: HelperRecord,
  candidate: CandidateProfile,
): DeterministicScoreBreakdown {
  const recruiter = scoreRecruiterTalentSignal(helper);
  const hiring = scoreHiringInfluence(helper);
  const functional = scoreFunctionalRelevance(helper, candidate);
  const companyAccess = scoreCompanyOpportunityAccess(helper, candidate);
  const trust = scoreRelationshipTrust(helper);
  const introPath = scoreIntroPath(helper, recruiter, hiring);
  const advocacy = scoreAdvocacyLikelihood(trust, functional, recruiter);
  const supportFit = scoreCandidateSupportFit(helper, candidate, recruiter, hiring);
  const networkStrength = scoreHelperNetworkStrength(helper, hiring);
  const semantic = scoreSemanticOpportunityFit(helper, candidate);

  const components: ScoringComponent[] = [
    buildComponent('recruiterTalentSignalScore', recruiter, 'No recruiter/talent signal detected'),
    buildComponent('hiringInfluenceScore', hiring, 'Limited hiring authority signal'),
    buildComponent('functionalRelevanceScore', functional, 'Limited functional overlap with target role'),
    buildComponent('companyOpportunityAccessScore', companyAccess, 'Unknown company / sector access'),
    buildComponent('relationshipTrustScore', trust, 'Relationship strength unknown'),
    buildComponent('introPathScore', introPath, 'No clear introduction path'),
    buildComponent('advocacyLikelihoodScore', advocacy, 'Advocacy likelihood is uncertain'),
    buildComponent('candidateSupportFitScore', supportFit, 'Support fit is partial'),
    buildComponent('helperNetworkStrengthScore', networkStrength, 'Network strength unknown'),
    buildComponent('semanticOpportunityFitScore', semantic, 'Limited semantic overlap'),
  ];

  const totalWeight = components.reduce((s, c) => s + c.weight, 0);
  const weighted = components.reduce((s, c) => s + c.weightedScore, 0);
  const normalizedScore = totalWeight > 0 ? clamp100(weighted / totalWeight) : 0;
  const rawScore = clamp100(weighted);
  const confidence = clamp01(
    components.reduce((s, c) => s + c.confidence * c.weight, 0) / (totalWeight || 1),
  );
  const penalties = components.flatMap((c) => c.penalties);

  return { components, rawScore, normalizedScore, confidence, totalWeight, penalties };
}

// ============================================================================
// HARD FILTERS — less aggressive than candidate filters per spec §11
// ============================================================================

export interface HelperHardFilterResult {
  status: HardFilterStatus;
  reason: HardFilterReason;
  details: string;
}

export interface HelperHardFilterContext {
  /** UserId of the candidate the helpers are being matched FOR. Used to
   *  prevent the candidate from showing up as their own helper. */
  candidateUserId?: string | null;
  /** Explicit user-id exclusion list from the request filter. */
  excludeUserIds?: string[];
}

/**
 * Helper hard filters are minimal: a non-recruiter senior professional can
 * still be a great warm-intro. We only hide a helper when:
 *   - they've opted out
 *   - they're blocked
 *   - they're explicitly excluded
 *   - they're the candidate themselves (self-match)
 *   - they're unreachable in the network (degree > 3)
 *
 * INSUFFICIENT_DATA is reported as WARN, not FAIL — the gating layer can
 * decide whether to suppress.
 */
export function runHelperHardFilters(
  helper: HelperRecord,
  context: HelperHardFilterContext = {},
): HelperHardFilterResult {
  if (helper.optedOut === true) {
    return {
      status: HardFilterStatus.FAIL,
      reason: HardFilterReason.OPT_OUT,
      details: 'Helper has opted out of being matched.',
    };
  }
  if (helper.blocked === true) {
    return {
      status: HardFilterStatus.FAIL,
      reason: HardFilterReason.BLOCKED,
      details: 'Helper is blocked.',
    };
  }
  if (
    context.candidateUserId &&
    helper.userId &&
    helper.userId === context.candidateUserId
  ) {
    return {
      status: HardFilterStatus.FAIL,
      reason: HardFilterReason.SELF_MATCH,
      details: 'Helper is the candidate themselves.',
    };
  }
  if (
    context.excludeUserIds &&
    helper.userId &&
    context.excludeUserIds.includes(helper.userId)
  ) {
    return {
      status: HardFilterStatus.FAIL,
      reason: HardFilterReason.EXCLUDED,
      details: 'Helper explicitly excluded by request filter.',
    };
  }
  if (helper.excluded === true) {
    return {
      status: HardFilterStatus.FAIL,
      reason: HardFilterReason.EXCLUDED,
      details: 'Helper is on the requester’s exclusion list.',
    };
  }
  if (helper.network && helper.network.degree > 3) {
    return {
      status: HardFilterStatus.FAIL,
      reason: HardFilterReason.UNREACHABLE,
      details: `Helper is ${helper.network.degree} hops away with no clear introduction path.`,
    };
  }

  // Insufficient data is a soft warning, not a fail.
  const hasJob = !!helper.jobTitle && helper.jobTitle.trim().length > 0;
  const hasBio = !!helper.bio && helper.bio.trim().length > 0;
  const hasSkills = Array.isArray(helper.skills) && helper.skills.length > 0;
  if (!hasJob && !hasBio && !hasSkills) {
    return {
      status: HardFilterStatus.WARN,
      reason: HardFilterReason.INSUFFICIENT_DATA,
      details: 'Helper profile lacks title, skills, and bio — score is best-effort.',
    };
  }

  return {
    status: HardFilterStatus.PASS,
    reason: HardFilterReason.NONE,
    details: '',
  };
}

// ============================================================================
// DEDUPE — collapse the same person across retrieval sources (spec §18)
// ============================================================================

/**
 * Collapse helpers that resolve to the same real-world person. Mirrors the
 * project/contact dedupe pattern: union-find over identity keys (userId,
 * contactId, email, linkedinUrl, name|company fingerprint, fullName as a
 * last resort).
 *
 * When two helpers collide we prefer the User-backed record (richer,
 * system-authoritative profile) over the Contact-only record. Skills,
 * sectors, and interests are merged so we keep the union of profile data.
 *
 * For Phase 2/3 the retrieval layer only sources from the Contact table so
 * collisions are rare (only when two contacts have the same email or
 * normalised company fingerprint). Phase 6 will add User-side retrieval
 * which makes this dedupe load-bearing.
 */
export function dedupeHelpersByIdentity(helpers: HelperRecord[]): HelperRecord[] {
  if (helpers.length <= 1) return helpers;

  const parent = new Map<string, string>();
  const find = (k: string): string => {
    const p = parent.get(k);
    if (!p || p === k) {
      parent.set(k, k);
      return k;
    }
    const root = find(p);
    parent.set(k, root);
    return root;
  };
  const union = (a: string, b: string) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent.set(ra, rb);
  };

  const keysFor = (h: HelperRecord): string[] => {
    const keys: string[] = [];
    if (h.userId) keys.push(`user:${h.userId}`);
    if (h.contactId) keys.push(`contact:${h.contactId}`);
    if (h.email) keys.push(`email:${h.email.trim().toLowerCase()}`);
    if (h.linkedinUrl) {
      keys.push(`linkedin:${h.linkedinUrl.trim().toLowerCase().replace(/\/+$/, '')}`);
    }
    const name = (h.fullName || '').trim().toLowerCase().replace(/\s+/g, ' ');
    const company = normCompany(h.company);
    if (name && company) keys.push(`namco:${name}|${company}`);
    else if (name) keys.push(`name:${name}`);
    return keys;
  };

  const itemKeys = helpers.map(keysFor);
  for (const keys of itemKeys) {
    if (!keys.length) continue;
    for (const k of keys) find(k);
    for (let i = 1; i < keys.length; i++) union(keys[0], keys[i]);
  }

  const groups = new Map<string, HelperRecord>();
  const order: string[] = [];

  const uniq = (xs: string[]) =>
    Array.from(new Set(xs.map((x) => x.trim()).filter(Boolean)));
  const longer = (a?: string | null, b?: string | null): string | null =>
    (a?.length ?? 0) >= (b?.length ?? 0) ? (a ?? null) : (b ?? null);

  const merge = (base: HelperRecord, other: HelperRecord): HelperRecord => ({
    ...base,
    jobTitle: longer(base.jobTitle, other.jobTitle),
    company: base.company || other.company,
    bio: longer(base.bio, other.bio),
    email: base.email || other.email,
    linkedinUrl: base.linkedinUrl || other.linkedinUrl,
    sectors: uniq([...base.sectors, ...other.sectors]),
    skills: uniq([...base.skills, ...other.skills]),
    interests: uniq([...base.interests, ...other.interests]),
    // Network: take the better signal of the two
    network: {
      degree: Math.min(base.network.degree, other.network.degree) as 1 | 2 | 3,
      mutualConnections: Math.max(
        base.network.mutualConnections,
        other.network.mutualConnections,
      ),
      sameOrganization: base.network.sameOrganization || other.network.sameOrganization,
      relationshipStrength: Math.max(
        base.network.relationshipStrength,
        other.network.relationshipStrength,
      ),
    },
  });

  for (let i = 0; i < helpers.length; i++) {
    const h = helpers[i];
    const keys = itemKeys[i];
    const root = keys.length ? find(keys[0]) : `anon:${i}`;
    const existing = groups.get(root);
    if (!existing) {
      order.push(root);
      groups.set(root, h);
      continue;
    }
    // Prefer the User-backed helper as canonical, then merge profile data.
    const canonical = existing.userId
      ? existing
      : h.userId
        ? h
        : existing;
    const secondary = canonical === existing ? h : existing;
    groups.set(root, merge(canonical, secondary));
  }

  return order.map((k) => groups.get(k)!);
}

/**
 * Strip company-name boilerplate so "TOKEN MASTERS FOR SOFTWARE" and
 * "Token Masters" collapse to the same fingerprint. Matches the project
 * engine's normCompany() so dedupe is consistent across surfaces.
 */
function normCompany(company?: string | null): string {
  if (!company) return '';
  let s = company.toLowerCase().trim();
  s = s.replace(/[^a-z0-9& ]+/g, ' ');
  s = s
    .split(/\s+/)
    .filter(
      (tok) =>
        tok &&
        ![
          'llc', 'inc', 'ltd', 'co', 'company', 'corp', 'corporation',
          'gmbh', 'sa', 'sas', 'sarl', 'lp', 'llp', 'for', 'software',
          'tech', 'technologies', 'technology', '&', 'and',
        ].includes(tok),
    )
    .slice(0, 3)
    .join(' ');
  return s;
}

// ============================================================================
// HELPER TYPE / LIKELY HELP TYPE DERIVATION
// ============================================================================

interface HelperTypeContext {
  recruiterScore: number;
  hiringInfluenceScore: number;
  functionalRelevanceScore: number;
  relationshipTrustScore: number;
  introPathScore: number;
  advocacyLikelihoodScore: number;
}

/**
 * Pick the dominant HelperType for the helper based on which signals
 * fired strongest. The thresholds are intentionally generous: we'd rather
 * tag an ADVISORY_CONTACT than fall through to WEAK_PATH for a useful
 * person.
 */
export function deriveHelperType(ctx: HelperTypeContext): HelperType {
  const {
    recruiterScore,
    hiringInfluenceScore,
    functionalRelevanceScore,
    relationshipTrustScore,
    introPathScore,
  } = ctx;

  if (recruiterScore >= 70) return HelperType.RECRUITER_CONTACT;
  if (hiringInfluenceScore >= 70) return HelperType.HIRING_PATH_CONTACT;

  if (
    relationshipTrustScore >= 70 &&
    (recruiterScore >= 40 || hiringInfluenceScore >= 40)
  ) {
    return HelperType.DIRECT_REFERRAL_CONTACT;
  }
  if (introPathScore >= 60) return HelperType.WARM_INTRO_CONTACT;
  if (functionalRelevanceScore >= 60) return HelperType.ADVISORY_CONTACT;

  return HelperType.WEAK_PATH;
}

export function deriveLikelyHelpType(
  helperType: HelperType,
): LikelyHelpType {
  switch (helperType) {
    case HelperType.RECRUITER_CONTACT:
      return 'refer';
    case HelperType.HIRING_PATH_CONTACT:
      return 'refer';
    case HelperType.DIRECT_REFERRAL_CONTACT:
      return 'refer';
    case HelperType.WARM_INTRO_CONTACT:
      return 'introduce';
    case HelperType.ADVISORY_CONTACT:
      return 'advise';
    case HelperType.WEAK_PATH:
      return 'connect';
    default:
      return 'connect';
  }
}

// ============================================================================
// HELPER-FRAMED EXPLANATION
// ============================================================================

/**
 * Build a natural-language summary that answers:
 * "Why might this person help you get a job?"
 *
 * Critically, this is NOT framed as candidate-fit. It's framed around the
 * helper's *ability to help*.
 */
export function buildHelperExplanationSummary(
  helper: HelperRecord,
  helperType: HelperType,
  likelyHelp: LikelyHelpType,
  breakdown: DeterministicScoreBreakdown,
): string {
  const parts: string[] = [];
  const label = HELPER_TYPE_LABELS[helperType];

  parts.push(
    `This person may help${verbForHelp(likelyHelp)} because they're a ${label.toLowerCase()}` +
      (helper.company ? ` at ${helper.company}` : '') +
      '.',
  );

  // Pull the top-2 strongest components (by weighted score, score >= 60)
  const strong = [...breakdown.components]
    .filter((c) => c.score >= 60)
    .sort((a, b) => b.weightedScore - a.weightedScore)
    .slice(0, 2);

  if (strong.length > 0) {
    parts.push(strong.map((c) => c.explanation).join(' '));
  }

  // Add the most informative gap (penalty) if any
  const topPenalty =
    breakdown.penalties[0] ||
    breakdown.components
      .filter((c) => c.score < 40 && c.penalties.length > 0)
      .map((c) => c.penalties[0])[0];
  if (topPenalty) {
    parts.push(`Limitation: ${topPenalty.toLowerCase()}`);
  }

  return parts.join(' ');
}

function verbForHelp(t: LikelyHelpType): string {
  switch (t) {
    case 'refer':
      return ' refer you to relevant roles';
    case 'introduce':
      return ' introduce you to relevant hiring contacts';
    case 'advise':
      return ' advise you on your job search';
    case 'connect':
      return ' connect you with their network';
    case 'review':
      return ' review your profile or pitch';
    case 'guide':
      return ' guide you toward relevant opportunities';
    default:
      return '';
  }
}
