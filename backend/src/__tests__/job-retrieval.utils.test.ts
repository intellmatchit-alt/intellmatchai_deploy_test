/**
 * Tests for the retrieval layer (Phase 6).
 *
 * The spec-critical contracts:
 *   - When a component is unavailable (data not present), it is excluded
 *     from the weighted sum AND from the denominator. Spec §6.
 *   - There is NEVER a fake 50 fallback for missing data.
 *   - normalizedScore = weightedSum / availableWeight, clamped to [0,100].
 *   - When ALL components are unavailable, normalizedScore is 0 — not 50.
 *
 * @module __tests__/job-retrieval.utils
 */

import {
  CANDIDATE_RETRIEVAL_WEIGHTS,
  HELPER_RETRIEVAL_WEIGHTS,
  computeCandidateRetrievalScore,
  computeHelperRetrievalScore,
} from '../infrastructure/external/opportunities/v3/job-retrieval.utils';
import {
  HiringProfile,
  CandidateProfile,
  Seniority,
} from '../infrastructure/external/opportunities/v3/job-matching.types';
import type { HelperRecord } from '../infrastructure/external/opportunities/v3/job-helper-scoring.utils';

// ============================================================================
// FIXTURES
// ============================================================================

function makeJob(overrides: Partial<HiringProfile> = {}): HiringProfile {
  return {
    id: 'job_1',
    userId: 'u_employer',
    organizationId: null,
    title: 'Senior Backend Engineer',
    roleArea: 'Engineering',
    seniority: Seniority.SENIOR,
    location: 'Amman',
    workMode: 'REMOTE' as any,
    employmentType: 'FULL_TIME' as any,
    mustHaveSkills: ['python', 'aws'],
    preferredSkills: ['kafka'],
    jobSummaryRequirements: 'Build payments services.',
    industries: ['fintech'],
    requiredLanguages: [],
    requiredCertifications: [],
    requiredEducationLevels: [],
    embedding: [],
    tags: [],
    excludedCandidates: [],
    dataQualityScore: 80,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as HiringProfile;
}

function makeCandidate(overrides: Partial<CandidateProfile> = {}): CandidateProfile {
  return {
    id: 'cand_1',
    userId: 'u_cand',
    organizationId: null,
    title: 'Senior Backend Engineer',
    roleArea: 'Engineering',
    seniority: Seniority.SENIOR,
    location: 'Amman',
    desiredWorkMode: ['REMOTE'] as any,
    desiredEmploymentType: ['FULL_TIME'] as any,
    skills: ['python', 'aws'],
    profileSummaryPreferences: 'I build backend services in Python.',
    industries: ['fintech'],
    languages: [],
    certifications: [],
    education: [],
    relevantExperience: [],
    embedding: [],
    tags: [],
    dataQualityScore: 80,
    optedOut: false,
    blocked: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as CandidateProfile;
}

function makeHelper(overrides: Partial<HelperRecord> = {}): HelperRecord {
  return {
    id: 'h_1',
    userId: null,
    contactId: 'c_1',
    fullName: 'Sara Recruiter',
    jobTitle: 'Senior Recruiter',
    company: 'Acme Corp',
    bio: null,
    email: null,
    linkedinUrl: null,
    sectors: ['fintech'],
    skills: ['python'],
    interests: [],
    network: {
      degree: 1,
      mutualConnections: 0,
      sameOrganization: false,
      relationshipStrength: 0,
    },
    ...overrides,
  };
}

// ============================================================================
// computeCandidateRetrievalScore — HIRING_TO_CANDIDATES
// ============================================================================

describe('computeCandidateRetrievalScore', () => {
  it('emits all four named components in fixed order', () => {
    const r = computeCandidateRetrievalScore(makeJob(), makeCandidate());
    expect(r.components.map((c) => c.name)).toEqual([
      'structured',
      'lexical',
      'semantic',
      'network',
    ]);
  });

  it('produces a high normalizedScore for a strong match (role + skills + industry)', () => {
    const r = computeCandidateRetrievalScore(makeJob(), makeCandidate());
    // structured + lexical + semantic should all light up; network is
    // unavailable but renormalises away.
    expect(r.normalizedScore).toBeGreaterThan(40);
    expect(r.normalizedScore).toBeLessThanOrEqual(100);
  });

  it('renormalises against availableWeight, not the static weight sum', () => {
    const r = computeCandidateRetrievalScore(makeJob(), makeCandidate());
    // Network is unavailable in the hiring flow today; total static weight
    // is 1.0 but availableWeight should be < 1.0.
    expect(r.availableWeight).toBeLessThan(1);
    expect(r.availableWeight).toBeGreaterThan(0);
    // weightedSum / availableWeight equals normalizedScore (within rounding).
    const expected = Math.round(r.weightedSum / r.availableWeight);
    expect(r.normalizedScore).toBeGreaterThanOrEqual(Math.max(0, expected - 1));
    expect(r.normalizedScore).toBeLessThanOrEqual(Math.min(100, expected + 1));
  });

  it('marks the network component unavailable in the hiring flow (not faked)', () => {
    const r = computeCandidateRetrievalScore(makeJob(), makeCandidate());
    const network = r.components.find((c) => c.name === 'network');
    expect(network?.available).toBe(false);
    // No fake "50" — the score field on an unavailable component does not
    // contribute to weightedSum regardless of its value.
  });

  it('weights match the spec table', () => {
    const r = computeCandidateRetrievalScore(makeJob(), makeCandidate());
    const byName = Object.fromEntries(r.components.map((c) => [c.name, c.weight]));
    expect(byName.structured).toBe(CANDIDATE_RETRIEVAL_WEIGHTS.structured);
    expect(byName.lexical).toBe(CANDIDATE_RETRIEVAL_WEIGHTS.lexical);
    expect(byName.semantic).toBe(CANDIDATE_RETRIEVAL_WEIGHTS.semantic);
    expect(byName.network).toBe(CANDIDATE_RETRIEVAL_WEIGHTS.network);
  });
});

// ============================================================================
// computeHelperRetrievalScore — OPEN_TO_OPPORTUNITY_TO_HELPERS
// ============================================================================

describe('computeHelperRetrievalScore', () => {
  it('emits all four named components', () => {
    const r = computeHelperRetrievalScore(makeCandidate(), makeHelper());
    expect(r.components.map((c) => c.name)).toEqual([
      'structured',
      'lexical',
      'semantic',
      'network',
    ]);
  });

  it('renormalisation kicks in when components are unavailable', () => {
    // Strip everything that lights up structured/lexical/semantic to leave
    // only network available — the score should still be valid + bounded
    // by network's contribution alone.
    const helper = makeHelper({
      jobTitle: null,
      company: null,
      bio: null,
      sectors: [],
      skills: [],
      interests: [],
      network: {
        degree: 1,
        mutualConnections: 5,
        sameOrganization: true,
        relationshipStrength: 0.9,
      },
    });
    const r = computeHelperRetrievalScore(makeCandidate(), helper);
    // Network is available with strong signals → normalizedScore should be
    // > 0 and ≤ 100, never a fake 50 fallback.
    expect(r.normalizedScore).toBeGreaterThan(0);
    expect(r.normalizedScore).toBeLessThanOrEqual(100);
  });

  it('weights match the spec table (network gets 0.25 in helper flow)', () => {
    const r = computeHelperRetrievalScore(makeCandidate(), makeHelper());
    const byName = Object.fromEntries(r.components.map((c) => [c.name, c.weight]));
    expect(byName.structured).toBe(HELPER_RETRIEVAL_WEIGHTS.structured);
    expect(byName.lexical).toBe(HELPER_RETRIEVAL_WEIGHTS.lexical);
    expect(byName.semantic).toBe(HELPER_RETRIEVAL_WEIGHTS.semantic);
    expect(byName.network).toBe(HELPER_RETRIEVAL_WEIGHTS.network);
    // Helper flow weights network higher than candidate flow.
    expect(HELPER_RETRIEVAL_WEIGHTS.network).toBeGreaterThan(
      CANDIDATE_RETRIEVAL_WEIGHTS.network,
    );
  });

  it('weighted sum / available weight equals normalizedScore (no hidden 50 floor)', () => {
    const r = computeHelperRetrievalScore(makeCandidate(), makeHelper());
    expect(r.availableWeight).toBeGreaterThan(0);
    const expected = Math.round(r.weightedSum / r.availableWeight);
    expect(Math.abs(r.normalizedScore - expected)).toBeLessThanOrEqual(1);
  });
});
