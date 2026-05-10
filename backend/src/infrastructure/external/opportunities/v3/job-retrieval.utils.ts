/**
 * IntellMatch Job Matching Engine — Hybrid Retrieval Layer
 *
 * Computes a CHEAP retrieval score per candidate / helper for use as a
 * pre-filter and as a transparent diagnostic signal alongside the full
 * deterministic score.
 *
 * Two flows, two weight sets (spec §13):
 *
 *   HIRING_TO_CANDIDATES retrieval weights:
 *     structured 0.40  +  lexical 0.20  +  semantic 0.25  +  network 0.15
 *
 *   OPEN_TO_OPPORTUNITY_TO_HELPERS retrieval weights:
 *     structured 0.35  +  lexical 0.20  +  semantic 0.20  +  network 0.25
 *
 * Critically, when a component cannot be computed (e.g., no embeddings on
 * file), it returns `available: false` and is dropped from the weighted
 * sum. The combiner re-normalises over only the available weights — never
 * substitutes a neutral 50, per the spec invariant "do not use neutral
 * fake embedding scores".
 *
 * The retrievalScore is RANK-ONLY and DIAGNOSTIC. The headline displayed
 * score remains finalScore (deterministic + bounded AI). Use retrievalScore
 * to:
 *   - prefilter very large candidate pools before expensive scoring
 *   - sort secondary lists ("more matches like this")
 *   - surface as an explainability signal in the breakdown
 *
 * @module job-matching/job-retrieval.utils
 */

import { HiringProfile, CandidateProfile } from './job-matching.types';
import type { HelperRecord } from './job-helper-scoring.utils';

// ============================================================================
// WEIGHTS — single source of truth (spec §13)
// ============================================================================

export const CANDIDATE_RETRIEVAL_WEIGHTS = {
  structured: 0.40,
  lexical: 0.20,
  semantic: 0.25,
  network: 0.15,
} as const;

export const HELPER_RETRIEVAL_WEIGHTS = {
  structured: 0.35,
  lexical: 0.20,
  semantic: 0.20,
  network: 0.25,
} as const;

// ============================================================================
// TYPES
// ============================================================================

export interface RetrievalComponent {
  name: 'structured' | 'lexical' | 'semantic' | 'network';
  score: number; // 0..100
  weight: number; // 0..1
  /** False when the data needed for this component is missing. The
   *  combiner drops unavailable components from the weighted sum so the
   *  final retrievalScore renormalises against what's actually known. */
  available: boolean;
  evidence: string[];
}

export interface RetrievalBreakdown {
  components: RetrievalComponent[];
  /** Sum of (score × weight) over AVAILABLE components only. */
  weightedSum: number;
  /** Sum of weights over available components. */
  availableWeight: number;
  /** retrievalScore = weightedSum / availableWeight, clamped to [0,100].
   *  When no components are available this returns 0 (NOT 50). */
  normalizedScore: number;
}

// ============================================================================
// SHARED HELPERS
// ============================================================================

const STOPWORDS = new Set([
  'and', 'or', 'the', 'for', 'with', 'in', 'of', 'to', 'a', 'an',
  'on', 'at', 'by', 'from', 'as', 'is', 'are', 'was', 'were',
]);

function tokens(s: string | null | undefined): string[] {
  if (!s) return [];
  return s
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 2 && !STOPWORDS.has(t));
}

function tokenSet(values: (string | null | undefined)[]): Set<string> {
  const set = new Set<string>();
  for (const v of values) for (const t of tokens(v)) set.add(t);
  return set;
}

function lc(s: string | null | undefined): string {
  return (s || '').toLowerCase().trim();
}

function clamp100(n: number): number {
  if (!isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function jaccardPercent(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let intersect = 0;
  for (const x of a) if (b.has(x)) intersect++;
  const union = a.size + b.size - intersect;
  return union === 0 ? 0 : Math.round((intersect / union) * 100);
}

function overlapCount<T>(a: T[] | null | undefined, b: T[] | null | undefined): number {
  if (!a?.length || !b?.length) return 0;
  const bs = new Set(b.map((x) => String(x).toLowerCase()));
  let n = 0;
  for (const x of a) if (bs.has(String(x).toLowerCase())) n++;
  return n;
}

function combine(
  components: Array<RetrievalComponent>,
): RetrievalBreakdown {
  let weightedSum = 0;
  let availableWeight = 0;
  for (const c of components) {
    if (!c.available) continue;
    weightedSum += c.score * c.weight;
    availableWeight += c.weight;
  }
  const normalizedScore =
    availableWeight > 0 ? clamp100(weightedSum / availableWeight) : 0;
  return { components, weightedSum, availableWeight, normalizedScore };
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (!Array.isArray(a) || !Array.isArray(b)) return 0;
  const len = Math.min(a.length, b.length);
  if (len === 0) return 0;
  let dot = 0;
  let aMag = 0;
  let bMag = 0;
  for (let i = 0; i < len; i++) {
    const av = Number(a[i]) || 0;
    const bv = Number(b[i]) || 0;
    dot += av * bv;
    aMag += av * av;
    bMag += bv * bv;
  }
  if (aMag === 0 || bMag === 0) return 0;
  return dot / (Math.sqrt(aMag) * Math.sqrt(bMag));
}

// ============================================================================
// HIRING_TO_CANDIDATES retrieval components
// ============================================================================

function hiringStructured(job: HiringProfile, c: CandidateProfile): RetrievalComponent {
  const evidence: string[] = [];
  let score = 0;
  let weight = CANDIDATE_RETRIEVAL_WEIGHTS.structured;

  // Role area / title hard alignment (weighted heavily within structured)
  const jobRole = lc((job as any).roleArea);
  const candRole = lc((c as any).roleArea);
  if (jobRole && candRole) {
    if (jobRole === candRole) {
      score += 35;
      evidence.push('role area exact match');
    } else if (jobRole.includes(candRole) || candRole.includes(jobRole)) {
      score += 20;
      evidence.push('role area partial match');
    }
  }

  // Seniority bucket distance (closer = better)
  const senOrder = ['INTERN', 'JUNIOR', 'MID', 'SENIOR', 'LEAD', 'MANAGER', 'DIRECTOR', 'VP', 'EXECUTIVE', 'FOUNDER'];
  const ji = senOrder.indexOf(String((job as any).seniority || '').toUpperCase());
  const ci = senOrder.indexOf(String((c as any).seniority || '').toUpperCase());
  if (ji >= 0 && ci >= 0) {
    const dist = Math.abs(ji - ci);
    if (dist === 0) {
      score += 25;
      evidence.push('seniority exact match');
    } else if (dist === 1) {
      score += 15;
      evidence.push('seniority adjacent');
    } else if (dist === 2) {
      score += 5;
    }
  }

  // Must-have skill coverage (binary-style threshold)
  const must: string[] = (job as any).mustHaveSkills ?? [];
  const candSkills: string[] = (c as any).skills ?? [];
  if (must.length > 0) {
    const overlap = overlapCount(must, candSkills);
    const ratio = overlap / must.length;
    score += Math.min(25, Math.round(ratio * 25));
    if (ratio >= 0.7) evidence.push(`${overlap}/${must.length} must-have skills`);
  }

  // Work mode + employment type compatibility (cheap signals)
  const candWorkModes: string[] = (c as any).desiredWorkMode ?? [];
  if ((job as any).workMode && candWorkModes.length > 0) {
    if (candWorkModes.includes((job as any).workMode)) {
      score += 8;
      evidence.push('work mode compatible');
    }
  }
  const candEmpTypes: string[] = (c as any).desiredEmploymentType ?? [];
  if ((job as any).employmentType && candEmpTypes.length > 0) {
    if (candEmpTypes.includes((job as any).employmentType)) {
      score += 7;
      evidence.push('employment type compatible');
    }
  }

  return {
    name: 'structured',
    score: clamp100(score),
    weight,
    available: true,
    evidence,
  };
}

function hiringLexical(job: HiringProfile, c: CandidateProfile): RetrievalComponent {
  const jobText = tokenSet([
    job.title,
    (job as any).roleArea,
    (job as any).jobSummaryRequirements ?? (job as any).summary,
    ...((job as any).mustHaveSkills ?? []),
    ...((job as any).preferredSkills ?? []),
    ...((job as any).industries ?? []),
  ]);
  const candText = tokenSet([
    c.title,
    (c as any).roleArea,
    (c as any).profileSummaryPreferences,
    ...((c as any).skills ?? []),
    ...((c as any).industries ?? []),
  ]);

  const score = jaccardPercent(jobText, candText);
  const evidence = score > 0 ? [`${score}% Jaccard token overlap`] : [];

  return {
    name: 'lexical',
    score,
    weight: CANDIDATE_RETRIEVAL_WEIGHTS.lexical,
    available: jobText.size > 0 && candText.size > 0,
    evidence,
  };
}

function hiringSemantic(job: HiringProfile, c: CandidateProfile): RetrievalComponent {
  const jobEmb = (job as any).embedding;
  const candEmb = (c as any).embedding;
  const haveEmbeddings = Array.isArray(jobEmb) && Array.isArray(candEmb);

  if (!haveEmbeddings) {
    // SPEC §13: do not substitute a neutral 50. Mark unavailable.
    return {
      name: 'semantic',
      score: 0,
      weight: CANDIDATE_RETRIEVAL_WEIGHTS.semantic,
      available: false,
      evidence: ['No embeddings on file — semantic component skipped'],
    };
  }

  const sim = cosineSimilarity(jobEmb, candEmb);
  const score = clamp100(Math.max(0, sim) * 100);
  return {
    name: 'semantic',
    score,
    weight: CANDIDATE_RETRIEVAL_WEIGHTS.semantic,
    available: true,
    evidence: [`Embedding cosine similarity ${sim.toFixed(3)}`],
  };
}

function hiringNetwork(_job: HiringProfile, _c: CandidateProfile): RetrievalComponent {
  // No network model exists yet for hiring → candidate matching at retrieval
  // time (the candidate is a stand-alone profile; the requester is the
  // hiring company). When org membership / connection signals are added,
  // wire them here. For now report unavailable so the score renormalises
  // over structured + lexical + semantic.
  return {
    name: 'network',
    score: 0,
    weight: CANDIDATE_RETRIEVAL_WEIGHTS.network,
    available: false,
    evidence: ['Network signals not yet wired into hiring retrieval'],
  };
}

export function computeCandidateRetrievalScore(
  job: HiringProfile,
  candidate: CandidateProfile,
): RetrievalBreakdown {
  return combine([
    hiringStructured(job, candidate),
    hiringLexical(job, candidate),
    hiringSemantic(job, candidate),
    hiringNetwork(job, candidate),
  ]);
}

// ============================================================================
// OPEN_TO_OPPORTUNITY_TO_HELPERS retrieval components
// ============================================================================

function helperStructured(c: CandidateProfile, h: HelperRecord): RetrievalComponent {
  const evidence: string[] = [];
  let score = 0;

  const candRole = lc((c as any).roleArea);
  if (candRole && lc(h.jobTitle).includes(candRole)) {
    score += 25;
    evidence.push('helper title contains candidate role area');
  }

  // Industry / sector overlap
  const indOverlap = overlapCount((c as any).industries ?? [], h.sectors);
  if (indOverlap > 0) {
    score += Math.min(25, indOverlap * 12);
    evidence.push(`${indOverlap} industry overlap(s)`);
  }

  // Skills overlap (helper has them = could refer)
  const skillOverlap = overlapCount((c as any).skills ?? [], h.skills);
  if (skillOverlap > 0) {
    score += Math.min(20, skillOverlap * 7);
    evidence.push(`${skillOverlap} skill overlap(s)`);
  }

  // Helper has a named company (potential entry point)
  if (h.company) {
    score += 15;
  }

  // Recruiter-ish title boost
  const title = ` ${lc(h.jobTitle)} `;
  if (
    title.includes('recruit') ||
    title.includes('talent') ||
    title.includes('hr ') ||
    title.includes('people partner')
  ) {
    score += 15;
    evidence.push('recruiter / talent signal in title');
  }

  return {
    name: 'structured',
    score: clamp100(score),
    weight: HELPER_RETRIEVAL_WEIGHTS.structured,
    available: true,
    evidence,
  };
}

function helperLexical(c: CandidateProfile, h: HelperRecord): RetrievalComponent {
  const candText = tokenSet([
    c.title,
    (c as any).roleArea,
    (c as any).profileSummaryPreferences,
    ...((c as any).skills ?? []),
    ...((c as any).industries ?? []),
  ]);
  const helperText = tokenSet([
    h.jobTitle,
    h.company,
    h.bio,
    ...h.sectors,
    ...h.skills,
    ...h.interests,
  ]);

  const score = jaccardPercent(candText, helperText);
  return {
    name: 'lexical',
    score,
    weight: HELPER_RETRIEVAL_WEIGHTS.lexical,
    available: candText.size > 0 && helperText.size > 0,
    evidence: score > 0 ? [`${score}% Jaccard token overlap`] : [],
  };
}

function helperSemantic(c: CandidateProfile, _h: HelperRecord): RetrievalComponent {
  const candEmb = (c as any).embedding;
  // No helper embedding column on the Contact table today. Fall back to
  // structural token-similarity bucket so the component still contributes
  // something — but mark unavailable so the combiner treats this as a
  // missing signal rather than a real semantic score.
  if (!Array.isArray(candEmb)) {
    return {
      name: 'semantic',
      score: 0,
      weight: HELPER_RETRIEVAL_WEIGHTS.semantic,
      available: false,
      evidence: ['No candidate embedding on file — semantic component skipped'],
    };
  }
  // Helpers don't carry embeddings yet, so even with a candidate embedding
  // we can't compute a true similarity. Stay unavailable.
  return {
    name: 'semantic',
    score: 0,
    weight: HELPER_RETRIEVAL_WEIGHTS.semantic,
    available: false,
    evidence: ['Helper embeddings not yet computed — semantic component skipped'],
  };
}

function helperNetwork(h: HelperRecord): RetrievalComponent {
  let score = 0;
  const evidence: string[] = [];
  const { degree, mutualConnections, sameOrganization, relationshipStrength } =
    h.network;

  if (degree === 1) {
    score += 60;
    evidence.push('direct connection');
  } else if (degree === 2) {
    score += 30;
    evidence.push('second-degree connection');
  } else {
    score += 10;
  }

  if (sameOrganization) {
    score += 20;
    evidence.push('same organisation');
  }
  if (mutualConnections > 0) {
    score += Math.min(15, mutualConnections * 3);
    evidence.push(`${mutualConnections} mutual(s)`);
  }
  if (relationshipStrength > 0) {
    score += Math.round(relationshipStrength * 5);
  }

  return {
    name: 'network',
    score: clamp100(score),
    weight: HELPER_RETRIEVAL_WEIGHTS.network,
    available: true,
    evidence,
  };
}

export function computeHelperRetrievalScore(
  candidate: CandidateProfile,
  helper: HelperRecord,
): RetrievalBreakdown {
  return combine([
    helperStructured(candidate, helper),
    helperLexical(candidate, helper),
    helperSemantic(candidate, helper),
    helperNetwork(helper),
  ]);
}
