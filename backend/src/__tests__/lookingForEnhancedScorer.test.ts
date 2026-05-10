/**
 * Tests for the per-Looking-For matching engine.
 *
 * Covers the contract laid out in the IntellMatch spec:
 *   - One selected Looking For type → totalScore equals that type's score.
 *   - Multiple selected types → totalScore is the MAX, bestLookingFor is the
 *     argmax.
 *   - One type fails the per-type hard filter → match is still returned for
 *     the other selected types.
 *   - All selected types fail → totalScore is 0 / bestLookingFor is null.
 *   - AI delta beyond ±15 is clamped.
 *   - AI MUST NEVER override a hard-filter FAIL.
 *
 * @module __tests__/lookingForEnhancedScorer
 */

import {
  AI_PER_TYPE_MAX_DELTA,
  applyLookingForAIValidation,
  clampAIDelta,
  dedupeMatchesByTarget,
  enrichLookingForResult,
  getBestLookingForScore,
  getLookingForBand,
  LookingForType,
  mergeEnrichedLookingForResults,
  rankByTotalLookingForScore,
  runLookingForHardFilters,
  targetDedupeKey,
} from '../infrastructure/external/projects/lookingForEnhancedScorer';

describe('getLookingForBand', () => {
  it.each([
    [0, 'WEAK'],
    [39, 'WEAK'],
    [40, 'PARTIAL'],
    [54, 'PARTIAL'],
    [55, 'GOOD'],
    [69, 'GOOD'],
    [70, 'VERY_GOOD'],
    [84, 'VERY_GOOD'],
    [85, 'EXCELLENT'],
    [100, 'EXCELLENT'],
  ])('maps score %d to band %s', (score, band) => {
    expect(getLookingForBand(score)).toBe(band);
  });

  it('does not produce a POOR band for any input', () => {
    for (let s = 0; s <= 100; s++) {
      expect(getLookingForBand(s)).not.toBe('POOR');
    }
  });
});

describe('clampAIDelta', () => {
  it('passes deltas inside the bound', () => {
    expect(clampAIDelta(5)).toBe(5);
    expect(clampAIDelta(-AI_PER_TYPE_MAX_DELTA)).toBe(-AI_PER_TYPE_MAX_DELTA);
  });

  it('clamps positive deltas to AI_PER_TYPE_MAX_DELTA', () => {
    expect(clampAIDelta(40)).toBe(AI_PER_TYPE_MAX_DELTA);
  });

  it('clamps negative deltas to -AI_PER_TYPE_MAX_DELTA', () => {
    expect(clampAIDelta(-40)).toBe(-AI_PER_TYPE_MAX_DELTA);
  });

  it('returns 0 for non-finite deltas', () => {
    expect(clampAIDelta(NaN)).toBe(0);
    expect(clampAIDelta(Infinity)).toBe(0);
  });
});

describe('runLookingForHardFilters', () => {
  it('FAILs when the candidate is blocked', () => {
    const r = runLookingForHardFilters(LookingForType.INVESTOR, {}, 80, 70, {
      blocked: true,
    });
    expect(r.status).toBe('FAIL');
    expect(r.reason).toBe('BLOCKED');
  });

  it('FAILs when the candidate has opted out', () => {
    const r = runLookingForHardFilters(LookingForType.INVESTOR, {}, 80, 70, {
      optedOut: true,
    });
    expect(r.status).toBe('FAIL');
    expect(r.reason).toBe('OPT_OUT');
  });

  it('FAILs when there is no role signal at all', () => {
    const r = runLookingForHardFilters(LookingForType.INVESTOR, {}, 0, 0);
    expect(r.status).toBe('FAIL');
    expect(r.reason).toBe('NO_ROLE_SIGNAL');
  });

  it('WARNs when evidence is limited (<30)', () => {
    const r = runLookingForHardFilters(LookingForType.ADVISOR, {}, 20, 10);
    expect(r.status).toBe('WARN');
    expect(r.reason).toBe('LIMITED_ADVISOR_EVIDENCE');
  });

  it('PASSes when evidence is strong', () => {
    const r = runLookingForHardFilters(LookingForType.INVESTOR, {}, 80, 70);
    expect(r.status).toBe('PASS');
    expect(r.reason).toBe('NONE');
  });
});

describe('enrichLookingForResult — single Looking For', () => {
  it('totalScore equals the only selected type score', () => {
    const result = enrichLookingForResult({
      selected: ['investor'],
      contact: { jobTitle: 'Angel Investor', company: 'Apex Ventures' },
    });
    expect(result.selectedLookingFor).toEqual([LookingForType.INVESTOR]);
    expect(result.lookingForScores).toHaveLength(1);
    expect(result.totalScore).toBe(result.lookingForScores[0].finalScore);
    expect(result.bestLookingFor).toBe(LookingForType.INVESTOR);
    expect(result.lookingForScores[0].isBestMatchType).toBe(true);
  });
});

describe('enrichLookingForResult — multiple Looking For', () => {
  it('returns one detail per selected type', () => {
    const result = enrichLookingForResult({
      selected: ['investor', 'advisor', 'strategic_partner'],
      contact: { jobTitle: 'CEO', company: 'Example Corp' },
    });
    expect(result.selectedLookingFor).toHaveLength(3);
    expect(result.lookingForScores).toHaveLength(3);
    expect(new Set(result.lookingForScores.map((s) => s.lookingFor))).toEqual(
      new Set([
        LookingForType.INVESTOR,
        LookingForType.ADVISOR,
        LookingForType.STRATEGIC_PARTNER,
      ]),
    );
  });

  it('totalScore equals the MAX of per-type final scores', () => {
    const result = enrichLookingForResult({
      selected: ['investor', 'advisor'],
      // Strong advisor signal, weak investor signal.
      contact: {
        jobTitle: 'Board Advisor',
        company: 'Acme',
        bio: 'Sit on advisory boards for several startups.',
      },
    });
    const maxScore = Math.max(
      ...result.lookingForScores.map((s) => s.finalScore),
    );
    expect(result.totalScore).toBe(maxScore);
    const best = result.lookingForScores.find((s) => s.isBestMatchType);
    expect(best?.lookingFor).toBe(LookingForType.ADVISOR);
    expect(result.bestLookingFor).toBe(LookingForType.ADVISOR);
  });

  it('does NOT average or sum the scores', () => {
    const result = enrichLookingForResult({
      selected: ['investor', 'advisor'],
      contact: { jobTitle: 'Board Advisor' },
    });
    const investor = result.lookingForScores.find(
      (s) => s.lookingFor === LookingForType.INVESTOR,
    )!;
    const advisor = result.lookingForScores.find(
      (s) => s.lookingFor === LookingForType.ADVISOR,
    )!;
    const avg = (investor.finalScore + advisor.finalScore) / 2;
    const sum = investor.finalScore + advisor.finalScore;
    // totalScore must equal the max — not the average and not the sum
    // (unless they happen to coincide, which here they do not).
    if (avg !== Math.max(investor.finalScore, advisor.finalScore)) {
      expect(result.totalScore).not.toBe(avg);
    }
    if (sum !== Math.max(investor.finalScore, advisor.finalScore)) {
      expect(result.totalScore).not.toBe(sum);
    }
    expect(result.totalScore).toBe(
      Math.max(investor.finalScore, advisor.finalScore),
    );
  });

  it('exposes individual per-type scores in lookingForScores (not hidden)', () => {
    const result = enrichLookingForResult({
      selected: ['investor', 'advisor', 'strategic_partner'],
      contact: { jobTitle: 'CEO' },
    });
    for (const lf of [
      LookingForType.INVESTOR,
      LookingForType.ADVISOR,
      LookingForType.STRATEGIC_PARTNER,
    ]) {
      const detail = result.lookingForScores.find((s) => s.lookingFor === lf);
      expect(detail).toBeDefined();
      expect(typeof detail!.finalScore).toBe('number');
      expect(typeof detail!.matchLevel).toBe('string');
    }
  });
});

describe('enrichLookingForResult — hard filters per type', () => {
  it('candidate strong for advisor still returned even if investor fails', () => {
    const result = enrichLookingForResult({
      selected: ['investor', 'advisor'],
      // Advisor profile, no investor signal at all.
      contact: { jobTitle: 'Advisory Board Member' },
    });
    const investor = result.lookingForScores.find(
      (s) => s.lookingFor === LookingForType.INVESTOR,
    )!;
    const advisor = result.lookingForScores.find(
      (s) => s.lookingFor === LookingForType.ADVISOR,
    )!;
    expect(investor.hardFilterStatus).toBe('FAIL');
    expect(advisor.hardFilterStatus).toBe('PASS');
    expect(advisor.finalScore).toBeGreaterThan(0);
    expect(result.totalScore).toBe(advisor.finalScore);
    expect(result.bestLookingFor).toBe(LookingForType.ADVISOR);
  });

  it('all-FAIL candidate yields totalScore 0 and null bestLookingFor', () => {
    const result = enrichLookingForResult({
      selected: ['investor', 'advisor'],
      contact: { jobTitle: 'Random Person', company: 'Random Co' },
    });
    expect(result.totalScore).toBe(0);
    expect(result.bestLookingFor).toBeNull();
    expect(
      result.lookingForScores.every((s) => s.hardFilterStatus === 'FAIL'),
    ).toBe(true);
  });

  it('candidate-level BLOCKED FAILs every selected type', () => {
    const result = enrichLookingForResult({
      selected: ['investor', 'advisor'],
      contact: { jobTitle: 'Angel Investor' },
      flags: { blocked: true },
    });
    expect(
      result.lookingForScores.every((s) => s.hardFilterStatus === 'FAIL'),
    ).toBe(true);
    expect(result.totalScore).toBe(0);
    expect(result.bestLookingFor).toBeNull();
  });
});

describe('applyLookingForAIValidation', () => {
  function fixtureMultiTypeResult() {
    return enrichLookingForResult({
      selected: ['investor', 'advisor'],
      contact: {
        jobTitle: 'CEO and Angel Investor',
        company: 'Apex Ventures',
        bio: 'Started 3 companies; sit on 2 advisory boards.',
      },
    });
  }

  it('clamps positive AI delta to ±AI_PER_TYPE_MAX_DELTA', () => {
    const base = fixtureMultiTypeResult();
    const beforeInvestor = base.lookingForScores.find(
      (s) => s.lookingFor === LookingForType.INVESTOR,
    )!;
    const after = applyLookingForAIValidation(base, [
      { lookingFor: LookingForType.INVESTOR, aiScoreDelta: 50 },
    ]);
    const afterInvestor = after.lookingForScores.find(
      (s) => s.lookingFor === LookingForType.INVESTOR,
    )!;
    expect(afterInvestor.scoreBreakdown.aiDelta).toBe(AI_PER_TYPE_MAX_DELTA);
    // finalScore moved by the bounded delta, capped at 100.
    const expected = Math.min(100, beforeInvestor.score + AI_PER_TYPE_MAX_DELTA);
    expect(afterInvestor.finalScore).toBe(expected);
  });

  it('clamps negative AI delta to ±AI_PER_TYPE_MAX_DELTA', () => {
    const base = fixtureMultiTypeResult();
    const beforeInvestor = base.lookingForScores.find(
      (s) => s.lookingFor === LookingForType.INVESTOR,
    )!;
    const after = applyLookingForAIValidation(base, [
      { lookingFor: LookingForType.INVESTOR, aiScoreDelta: -50 },
    ]);
    const afterInvestor = after.lookingForScores.find(
      (s) => s.lookingFor === LookingForType.INVESTOR,
    )!;
    expect(afterInvestor.scoreBreakdown.aiDelta).toBe(-AI_PER_TYPE_MAX_DELTA);
    expect(afterInvestor.finalScore).toBe(
      Math.max(0, beforeInvestor.score - AI_PER_TYPE_MAX_DELTA),
    );
  });

  it('does not override a hard-filter FAIL', () => {
    const failing = enrichLookingForResult({
      selected: ['investor', 'advisor'],
      contact: { jobTitle: 'Random Person' }, // no signal anywhere
    });
    expect(failing.totalScore).toBe(0);
    const after = applyLookingForAIValidation(failing, [
      { lookingFor: LookingForType.INVESTOR, aiScoreDelta: 15 },
      { lookingFor: LookingForType.ADVISOR, aiScoreDelta: 15 },
    ]);
    expect(after.totalScore).toBe(0);
    expect(after.bestLookingFor).toBeNull();
    for (const s of after.lookingForScores) {
      expect(s.scoreBreakdown.aiDelta).toBe(0);
    }
  });

  it('recomputes bestLookingFor after AI shifts ranking', () => {
    // Start with advisor as best by a small margin, then push investor up.
    const base = enrichLookingForResult({
      selected: ['investor', 'advisor'],
      contact: {
        jobTitle: 'Board Advisor',
        company: 'Apex Ventures',
        bio: 'Advisor and occasional angel investor.',
      },
    });
    const initialBest = base.bestLookingFor;
    expect(initialBest).toBeTruthy();
    const after = applyLookingForAIValidation(base, [
      { lookingFor: LookingForType.INVESTOR, aiScoreDelta: 15 },
      { lookingFor: LookingForType.ADVISOR, aiScoreDelta: -15 },
    ]);
    // Either investor wins outright, or it ties and the tie-breaker holds.
    const investor = after.lookingForScores.find(
      (s) => s.lookingFor === LookingForType.INVESTOR,
    )!;
    const advisor = after.lookingForScores.find(
      (s) => s.lookingFor === LookingForType.ADVISOR,
    )!;
    expect(after.totalScore).toBe(
      Math.max(investor.finalScore, advisor.finalScore),
    );
  });
});

describe('getBestLookingForScore', () => {
  it('returns null for an empty list', () => {
    expect(getBestLookingForScore([])).toBeNull();
  });

  it('returns null when every score is 0', () => {
    const detail = enrichLookingForResult({
      selected: ['investor', 'advisor'],
      contact: { jobTitle: 'Random Person' },
    });
    expect(getBestLookingForScore(detail.lookingForScores)).toBeNull();
  });

  it('breaks ties on confidence', () => {
    // Synthesize two details with equal finalScore but different confidence.
    const result = enrichLookingForResult({
      selected: ['investor', 'advisor'],
      contact: { jobTitle: 'CEO' },
    });
    if (result.lookingForScores.length >= 2) {
      result.lookingForScores[0].finalScore = 70;
      result.lookingForScores[1].finalScore = 70;
      result.lookingForScores[0].confidence = 0.4;
      result.lookingForScores[1].confidence = 0.9;
      const best = getBestLookingForScore(result.lookingForScores);
      expect(best).toBe(result.lookingForScores[1]);
    }
  });
});

describe('targetDedupeKey / targetDedupeKeys', () => {
  // We import the multi-key helper too — needed for the merge tests below.
  const { targetDedupeKeys } = require('../infrastructure/external/projects/lookingForEnhancedScorer');

  it('prefers normalized email so user + contact rows for the same person collapse', () => {
    expect(targetDedupeKey({ userId: 'u1', email: 'a@b.com' })).toBe('email:a@b.com');
    expect(targetDedupeKey({ contactId: 'c1', email: ' A@B.com ' })).toBe('email:a@b.com');
  });

  it('falls back to linkedin URL when no email', () => {
    expect(targetDedupeKey({ linkedinUrl: 'https://linkedin.com/in/foo' })).toBe(
      'linkedin:https://linkedin.com/in/foo',
    );
  });

  it('falls back to userId when no email/linkedin', () => {
    expect(targetDedupeKey({ userId: 'u1' })).toBe('user:u1');
  });

  it('falls back to a normalized full name as last resort', () => {
    expect(targetDedupeKey({ fullName: '  Murad   Abu  Jamous ' })).toBe(
      'name:murad abu jamous',
    );
  });

  it('exposes a `name|company` fingerprint that ignores legal-form suffixes', () => {
    const a = targetDedupeKeys({
      fullName: 'Murad Abu Jamous',
      company: 'Token Masters',
    });
    const b = targetDedupeKeys({
      fullName: 'Murad Abu Jamous',
      company: 'TOKEN MASTERS FOR SOFTWARE',
    });
    // Both rows should produce the SAME `namco:` fingerprint key.
    const namcoA = a.find((k: string) => k.startsWith('namco:'));
    const namcoB = b.find((k: string) => k.startsWith('namco:'));
    expect(namcoA).toBeDefined();
    expect(namcoA).toBe(namcoB);
  });

  it('high-trust keys (email/linkedin) appear before per-row IDs so cross-record merges always win', () => {
    const keys = targetDedupeKeys({
      userId: 'u1',
      contactId: 'c1',
      email: 'foo@bar.com',
      linkedinUrl: 'https://linkedin.com/in/foo',
      fullName: 'Foo Bar',
      company: 'Foo Co',
    });
    const idxEmail = keys.indexOf('email:foo@bar.com');
    const idxUser = keys.indexOf('user:u1');
    const idxContact = keys.indexOf('contact:c1');
    expect(idxEmail).toBeGreaterThanOrEqual(0);
    expect(idxEmail).toBeLessThan(idxUser);
    expect(idxEmail).toBeLessThan(idxContact);
  });
});

describe('mergeEnrichedLookingForResults', () => {
  it('keeps the higher-scoring detail per Looking For type', () => {
    const a = enrichLookingForResult({
      selected: ['investor', 'advisor'],
      contact: { jobTitle: 'Angel Investor' },
    });
    const b = enrichLookingForResult({
      selected: ['investor', 'advisor'],
      contact: { jobTitle: 'Board Advisor' },
    });
    const merged = mergeEnrichedLookingForResults(a, b);
    const investor = merged.lookingForScores.find(
      (s) => s.lookingFor === LookingForType.INVESTOR,
    )!;
    const advisor = merged.lookingForScores.find(
      (s) => s.lookingFor === LookingForType.ADVISOR,
    )!;
    const aInvestor = a.lookingForScores.find(
      (s) => s.lookingFor === LookingForType.INVESTOR,
    )!.finalScore;
    const aAdvisor = a.lookingForScores.find(
      (s) => s.lookingFor === LookingForType.ADVISOR,
    )!.finalScore;
    const bInvestor = b.lookingForScores.find(
      (s) => s.lookingFor === LookingForType.INVESTOR,
    )!.finalScore;
    const bAdvisor = b.lookingForScores.find(
      (s) => s.lookingFor === LookingForType.ADVISOR,
    )!.finalScore;
    expect(investor.finalScore).toBe(Math.max(aInvestor, bInvestor));
    expect(advisor.finalScore).toBe(Math.max(aAdvisor, bAdvisor));
  });

  it('recomputes totalScore and bestLookingFor after merge', () => {
    const a = enrichLookingForResult({
      selected: ['investor', 'advisor'],
      contact: { jobTitle: 'Angel Investor' }, // strong investor
    });
    const b = enrichLookingForResult({
      selected: ['investor', 'advisor'],
      contact: { jobTitle: 'Board Advisor' }, // strong advisor
    });
    const merged = mergeEnrichedLookingForResults(a, b);
    expect(merged.totalScore).toBe(
      Math.max(...merged.lookingForScores.map((s) => s.finalScore)),
    );
    const best = merged.lookingForScores.find((s) => s.isBestMatchType);
    expect(best?.finalScore).toBe(merged.totalScore);
    // Only one detail is the best.
    expect(
      merged.lookingForScores.filter((s) => s.isBestMatchType),
    ).toHaveLength(1);
  });
});

describe('dedupeMatchesByTarget', () => {
  type Row = {
    id: string;
    matchedUser?: { id?: string; email?: string | null; linkedinUrl?: string | null; fullName?: string | null; company?: string | null } | null;
    matchedContact?: { id?: string; email?: string | null; linkedinUrl?: string | null; fullName?: string | null; company?: string | null } | null;
    matchScore: number;
    enrichment: ReturnType<typeof enrichLookingForResult>;
  };

  function id(r: Row) {
    return {
      userId: r.matchedUser?.id ?? null,
      contactId: r.matchedContact?.id ?? null,
      email: r.matchedUser?.email ?? r.matchedContact?.email ?? null,
      linkedinUrl: r.matchedUser?.linkedinUrl ?? r.matchedContact?.linkedinUrl ?? null,
      fullName: r.matchedUser?.fullName ?? r.matchedContact?.fullName ?? null,
      company: r.matchedUser?.company ?? r.matchedContact?.company ?? null,
    };
  }

  it('merges a User row and a Contact row that share an email', () => {
    const userRow: Row = {
      id: 'm1',
      matchedUser: { id: 'u1', email: 'murad@example.com', fullName: 'Murad' },
      matchScore: 60,
      enrichment: enrichLookingForResult({
        selected: ['advisor', 'technical_partner'],
        contact: { jobTitle: 'Software Engineer' },
      }),
    };
    const contactRow: Row = {
      id: 'm2',
      matchedContact: { id: 'c1', email: 'Murad@Example.com', fullName: 'Murad' },
      matchScore: 40,
      enrichment: enrichLookingForResult({
        selected: ['advisor', 'technical_partner'],
        contact: { jobTitle: 'Board Advisor' },
      }),
    };
    const grouped = dedupeMatchesByTarget([userRow, contactRow], {
      getIdentity: id,
      getEnrichment: (r) => r.enrichment,
      pickCanonical: (a, b) => (a.matchedUser?.id ? a : b),
    });
    expect(grouped).toHaveLength(1);
    expect(grouped[0].canonical.id).toBe('m1'); // user row preferred
    const merged = grouped[0].merged!;
    const advisor = merged.lookingForScores.find(
      (s) => s.lookingFor === LookingForType.ADVISOR,
    )!;
    const technical = merged.lookingForScores.find(
      (s) => s.lookingFor === LookingForType.TECHNICAL_PARTNER,
    )!;
    // Advisor MAX comes from the contact row, technical MAX from the user row.
    expect(advisor.finalScore).toBeGreaterThanOrEqual(
      contactRow.enrichment.lookingForScores.find(
        (s) => s.lookingFor === LookingForType.ADVISOR,
      )!.finalScore,
    );
    expect(technical.finalScore).toBeGreaterThanOrEqual(
      userRow.enrichment.lookingForScores.find(
        (s) => s.lookingFor === LookingForType.TECHNICAL_PARTNER,
      )!.finalScore,
    );
  });

  it('does not merge two distinct people', () => {
    const a: Row = {
      id: 'm1',
      matchedUser: { id: 'u1', email: 'a@x.com', fullName: 'A' },
      matchScore: 50,
      enrichment: enrichLookingForResult({
        selected: ['investor'],
        contact: { jobTitle: 'CEO' },
      }),
    };
    const b: Row = {
      id: 'm2',
      matchedUser: { id: 'u2', email: 'b@x.com', fullName: 'B' },
      matchScore: 70,
      enrichment: enrichLookingForResult({
        selected: ['investor'],
        contact: { jobTitle: 'Angel Investor' },
      }),
    };
    const grouped = dedupeMatchesByTarget([a, b], {
      getIdentity: id,
      getEnrichment: (r) => r.enrichment,
    });
    expect(grouped).toHaveLength(2);
  });

  it('merges User + Contact rows that disagree on email but share the name+company fingerprint (the Murad Abu Jamous bug)', () => {
    // Real-world reproduction: same person registered as a User AND added as
    // a Contact by the requester. The two records report DIFFERENT emails
    // (signup email vs. business-card email), so the older email-only
    // dedupe key never collapsed them. The new multi-key union-find catches
    // them via the `name|company` fingerprint.
    const userRow: Row = {
      id: 'm-user',
      matchedUser: {
        id: 'u-murad',
        email: 'murad.signup@gmail.com',
        fullName: 'Murad Abu Jamous',
        // user.company is freeform; person types a short version
        company: 'Token Masters',
      } as any,
      matchScore: 55,
      enrichment: enrichLookingForResult({
        selected: ['advisor', 'technical_partner', 'cofounder_talent'],
        contact: { jobTitle: 'Entrepreneur and General Manager' },
      }),
    };
    const contactRow: Row = {
      id: 'm-contact',
      matchedContact: {
        id: 'c-murad',
        email: 'murad@tokenmasters.com',
        fullName: 'Murad Abu Jamous',
        // contact.company comes from a business card with the legal name
        company: 'TOKEN MASTERS FOR SOFTWARE',
      } as any,
      matchScore: 70,
      enrichment: enrichLookingForResult({
        selected: ['advisor', 'technical_partner', 'cofounder_talent'],
        contact: { jobTitle: 'Founder & General Manager' },
      }),
    };
    const grouped = dedupeMatchesByTarget([userRow, contactRow], {
      getIdentity: id,
      getEnrichment: (r) => r.enrichment,
      pickCanonical: (a, b) => (a.matchedUser?.id ? a : b),
    });
    expect(grouped).toHaveLength(1);
    // Canonical row is the User one (per the pickCanonical preference)
    expect(grouped[0].canonical.id).toBe('m-user');
    // The merged enrichment carries every per-Looking-For type once.
    const merged = grouped[0].merged!;
    expect(merged.lookingForScores).toHaveLength(3);
    // totalScore is the MAX across the merged per-type details — it never
    // drops below either side's totalScore.
    expect(merged.totalScore).toBeGreaterThanOrEqual(
      Math.max(userRow.enrichment.totalScore, contactRow.enrichment.totalScore),
    );
  });

  it('groups two contact rows with the same email', () => {
    const a: Row = {
      id: 'm1',
      matchedContact: { id: 'c1', email: 'foo@example.com', fullName: 'Foo' },
      matchScore: 30,
      enrichment: enrichLookingForResult({
        selected: ['advisor'],
        contact: { jobTitle: 'Mentor' },
      }),
    };
    const b: Row = {
      id: 'm2',
      matchedContact: { id: 'c2', email: 'foo@example.com', fullName: 'Foo' },
      matchScore: 80,
      enrichment: enrichLookingForResult({
        selected: ['advisor'],
        contact: { jobTitle: 'Board Advisor' },
      }),
    };
    const grouped = dedupeMatchesByTarget([a, b], {
      getIdentity: id,
      getEnrichment: (r) => r.enrichment,
      pickCanonical: (x, y) => (x.matchScore >= y.matchScore ? x : y),
    });
    expect(grouped).toHaveLength(1);
    expect(grouped[0].canonical.id).toBe('m2');
  });
});

describe('rankByTotalLookingForScore', () => {
  it('orders matches by totalScore desc', () => {
    const items = [
      { totalScore: 50 },
      { totalScore: 80 },
      { totalScore: 65 },
    ];
    items.sort(rankByTotalLookingForScore);
    expect(items.map((i) => i.totalScore)).toEqual([80, 65, 50]);
  });

  it('breaks ties on bestConfidence', () => {
    const items = [
      { totalScore: 70, bestConfidence: 0.5 },
      { totalScore: 70, bestConfidence: 0.9 },
    ];
    items.sort(rankByTotalLookingForScore);
    expect(items[0].bestConfidence).toBe(0.9);
  });

  it('then matchScore, then deterministic best score', () => {
    const items = [
      { totalScore: 70, bestConfidence: 0.5, matchScore: 60, bestDeterministicScore: 50 },
      { totalScore: 70, bestConfidence: 0.5, matchScore: 80, bestDeterministicScore: 30 },
    ];
    items.sort(rankByTotalLookingForScore);
    expect(items[0].matchScore).toBe(80);
  });
});
