/**
 * Tests for the helper-flow scoring utilities.
 *
 * Covers the spec-critical surfaces:
 *   - dedupeHelpersByIdentity: union-find by userId / contactId / email /
 *     linkedinUrl / (name + normalized company). User-backed records win
 *     canonical, but profile data merges. Spec §18.
 *   - deriveHelperType: thresholds for the six HelperType buckets. Spec §11.
 *   - deriveLikelyHelpType: helperType → action verb mapping for UI labels.
 *
 * @module __tests__/job-helper-scoring.utils
 */

import {
  HelperRecord,
  dedupeHelpersByIdentity,
  deriveHelperType,
  deriveLikelyHelpType,
} from '../infrastructure/external/opportunities/v3/job-helper-scoring.utils';
import { HelperType } from '../infrastructure/external/opportunities/v3/job-matching.types';

// ============================================================================
// FIXTURES
// ============================================================================

function makeHelper(overrides: Partial<HelperRecord> = {}): HelperRecord {
  return {
    id: overrides.id ?? `h_${Math.random().toString(36).slice(2, 8)}`,
    userId: null,
    contactId: null,
    fullName: 'Murad Abu Jamous',
    jobTitle: null,
    company: null,
    bio: null,
    email: null,
    linkedinUrl: null,
    sectors: [],
    skills: [],
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
// dedupeHelpersByIdentity
// ============================================================================

describe('dedupeHelpersByIdentity', () => {
  it('returns the input unchanged when there is 0 or 1 helper', () => {
    expect(dedupeHelpersByIdentity([])).toEqual([]);
    const single = makeHelper({ id: 'a', userId: 'u1' });
    expect(dedupeHelpersByIdentity([single])).toEqual([single]);
  });

  it('collapses duplicates that share a userId', () => {
    const a = makeHelper({ id: 'a', userId: 'u1', skills: ['python'] });
    const b = makeHelper({ id: 'b', userId: 'u1', skills: ['rust'] });
    const out = dedupeHelpersByIdentity([a, b]);
    expect(out).toHaveLength(1);
    // Skills should merge as a union (case-insensitive dedupe).
    expect(out[0].skills.sort()).toEqual(['python', 'rust']);
  });

  it('collapses duplicates that share a contactId', () => {
    const a = makeHelper({ id: 'a', contactId: 'c1' });
    const b = makeHelper({ id: 'b', contactId: 'c1' });
    expect(dedupeHelpersByIdentity([a, b])).toHaveLength(1);
  });

  it('collapses duplicates that share an email (case-insensitive)', () => {
    const a = makeHelper({ id: 'a', email: 'jane@example.com' });
    const b = makeHelper({ id: 'b', email: 'JANE@example.com' });
    expect(dedupeHelpersByIdentity([a, b])).toHaveLength(1);
  });

  it('collapses duplicates by linkedinUrl ignoring trailing slash and case', () => {
    const a = makeHelper({ id: 'a', linkedinUrl: 'https://linkedin.com/in/jane/' });
    const b = makeHelper({ id: 'b', linkedinUrl: 'https://linkedin.com/in/JANE' });
    expect(dedupeHelpersByIdentity([a, b])).toHaveLength(1);
  });

  it('collapses duplicates by name+normalized-company fingerprint', () => {
    // The two companies should normalize to the same fingerprint via the
    // boilerplate stripper ("FOR SOFTWARE", "INC", "LLC").
    const a = makeHelper({
      id: 'a',
      fullName: 'Token Founder',
      company: 'TOKEN MASTERS FOR SOFTWARE',
    });
    const b = makeHelper({
      id: 'b',
      fullName: 'TOKEN FOUNDER',
      company: 'Token Masters Inc.',
    });
    expect(dedupeHelpersByIdentity([a, b])).toHaveLength(1);
  });

  it('does NOT collapse different companies even when name matches', () => {
    const a = makeHelper({ id: 'a', fullName: 'John Smith', company: 'Acme' });
    const b = makeHelper({ id: 'b', fullName: 'John Smith', company: 'Globex' });
    // Different namco fingerprints — should remain separate.
    expect(dedupeHelpersByIdentity([a, b])).toHaveLength(2);
  });

  it('prefers User-backed record as canonical even when listed second', () => {
    const contactOnly = makeHelper({
      id: 'a',
      contactId: 'c1',
      userId: null,
      email: 'jane@example.com',
    });
    const userBacked = makeHelper({
      id: 'b',
      userId: 'u1',
      contactId: null,
      email: 'jane@example.com',
      jobTitle: 'Senior Engineer',
    });
    const out = dedupeHelpersByIdentity([contactOnly, userBacked]);
    expect(out).toHaveLength(1);
    expect(out[0].userId).toBe('u1');
    // Even though the contact listing came first, the User-backed record's
    // jobTitle wins as canonical metadata.
    expect(out[0].jobTitle).toBe('Senior Engineer');
  });

  it('takes the better network signal of the two when merging', () => {
    const a = makeHelper({
      id: 'a',
      userId: 'u1',
      network: {
        degree: 3,
        mutualConnections: 0,
        sameOrganization: false,
        relationshipStrength: 0.1,
      },
    });
    const b = makeHelper({
      id: 'b',
      userId: 'u1',
      network: {
        degree: 1,
        mutualConnections: 5,
        sameOrganization: true,
        relationshipStrength: 0.8,
      },
    });
    const out = dedupeHelpersByIdentity([a, b]);
    expect(out[0].network).toEqual({
      degree: 1,
      mutualConnections: 5,
      sameOrganization: true,
      relationshipStrength: 0.8,
    });
  });

  it('chains identities transitively through union-find', () => {
    // a ~ b via email; b ~ c via linkedin; therefore a, b, c collapse.
    const a = makeHelper({ id: 'a', email: 'jane@example.com', skills: ['x'] });
    const b = makeHelper({
      id: 'b',
      email: 'jane@example.com',
      linkedinUrl: 'https://linkedin.com/in/jane',
      skills: ['y'],
    });
    const c = makeHelper({
      id: 'c',
      linkedinUrl: 'https://linkedin.com/in/jane',
      skills: ['z'],
    });
    const out = dedupeHelpersByIdentity([a, b, c]);
    expect(out).toHaveLength(1);
    expect(out[0].skills.sort()).toEqual(['x', 'y', 'z']);
  });

  it('keeps unrelated helpers separate', () => {
    const a = makeHelper({ id: 'a', userId: 'u1', fullName: 'Alice Smith' });
    const b = makeHelper({ id: 'b', userId: 'u2', fullName: 'Bob Jones' });
    expect(dedupeHelpersByIdentity([a, b])).toHaveLength(2);
  });
});

// ============================================================================
// deriveHelperType
// ============================================================================

describe('deriveHelperType', () => {
  const baseCtx = {
    recruiterScore: 0,
    hiringInfluenceScore: 0,
    functionalRelevanceScore: 0,
    relationshipTrustScore: 0,
    introPathScore: 0,
    advocacyLikelihoodScore: 0,
  };

  it('flags strong recruiter signal as RECRUITER_CONTACT', () => {
    expect(
      deriveHelperType({ ...baseCtx, recruiterScore: 80 }),
    ).toBe(HelperType.RECRUITER_CONTACT);
  });

  it('flags strong hiring-influence as HIRING_PATH_CONTACT', () => {
    expect(
      deriveHelperType({ ...baseCtx, hiringInfluenceScore: 80 }),
    ).toBe(HelperType.HIRING_PATH_CONTACT);
  });

  it('recruiter beats hiring-influence when both fire (recruiter checked first)', () => {
    expect(
      deriveHelperType({
        ...baseCtx,
        recruiterScore: 80,
        hiringInfluenceScore: 90,
      }),
    ).toBe(HelperType.RECRUITER_CONTACT);
  });

  it('high trust + moderate hiring-path fires DIRECT_REFERRAL_CONTACT', () => {
    expect(
      deriveHelperType({
        ...baseCtx,
        relationshipTrustScore: 75,
        hiringInfluenceScore: 50,
      }),
    ).toBe(HelperType.DIRECT_REFERRAL_CONTACT);
  });

  it('intro path ≥ 60 with no recruiter/hiring signal → WARM_INTRO_CONTACT', () => {
    expect(
      deriveHelperType({ ...baseCtx, introPathScore: 65 }),
    ).toBe(HelperType.WARM_INTRO_CONTACT);
  });

  it('functional relevance ≥ 60 with nothing else → ADVISORY_CONTACT', () => {
    expect(
      deriveHelperType({ ...baseCtx, functionalRelevanceScore: 70 }),
    ).toBe(HelperType.ADVISORY_CONTACT);
  });

  it('falls through to WEAK_PATH for low signals across the board', () => {
    expect(
      deriveHelperType({
        ...baseCtx,
        recruiterScore: 10,
        hiringInfluenceScore: 10,
        functionalRelevanceScore: 30,
      }),
    ).toBe(HelperType.WEAK_PATH);
  });
});

// ============================================================================
// deriveLikelyHelpType
// ============================================================================

describe('deriveLikelyHelpType', () => {
  it.each([
    [HelperType.RECRUITER_CONTACT, 'refer'],
    [HelperType.HIRING_PATH_CONTACT, 'refer'],
    [HelperType.DIRECT_REFERRAL_CONTACT, 'refer'],
    [HelperType.WARM_INTRO_CONTACT, 'introduce'],
    [HelperType.ADVISORY_CONTACT, 'advise'],
    [HelperType.WEAK_PATH, 'connect'],
  ])('helperType=%s → %s', (helperType, expected) => {
    expect(deriveLikelyHelpType(helperType)).toBe(expected);
  });
});
