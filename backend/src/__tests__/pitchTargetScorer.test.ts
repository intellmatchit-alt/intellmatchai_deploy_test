/**
 * Tests for the per-Match-Target pitch matching engine.
 *
 * Covers the IntellMatch pitch spec contract:
 *   - One selected Match Target → totalScore equals that target's score.
 *   - Multiple selected → totalScore is the MAX, bestMatchTarget is the
 *     argmax, every selected target has its own score in matchTargetScores.
 *   - One target fails the per-target hard filter → contact still returned
 *     for the other selected targets.
 *   - All selected targets fail → totalScore is 0 / bestMatchTarget is null.
 *   - AI delta beyond ±15 is clamped.
 *   - AI MUST NEVER override a hard-filter FAIL.
 *   - Backward-compat fields (selectedIntent, finalScore aliases) match.
 *
 * @module __tests__/pitchTargetScorer
 */

import {
  applyMatchTargetAIValidation,
  clampMatchTargetAIDelta,
  enrichPitchMatchTargets,
  getBestMatchTargetScore,
  getMatchTargetBand,
  MATCH_TARGET_AI_MAX_DELTA,
  MatchTargetType,
  mergeEnrichedMatchTargetResults,
  normalizeSelectedMatchTargets,
  rankByTotalMatchTargetScore,
  runMatchTargetHardFilters,
} from '../infrastructure/services/pitch/pitchTargetScorer';

describe('getMatchTargetBand', () => {
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
    expect(getMatchTargetBand(score)).toBe(band);
  });

  it('never produces POOR or STRONG bands', () => {
    for (let s = 0; s <= 100; s++) {
      const b = getMatchTargetBand(s);
      expect(b).not.toBe('POOR');
      expect(b).not.toBe('STRONG');
    }
  });
});

describe('clampMatchTargetAIDelta', () => {
  it('passes deltas inside ±15', () => {
    expect(clampMatchTargetAIDelta(7)).toBe(7);
    expect(clampMatchTargetAIDelta(-12)).toBe(-12);
  });

  it('clamps positive deltas above the bound', () => {
    expect(clampMatchTargetAIDelta(40)).toBe(MATCH_TARGET_AI_MAX_DELTA);
  });

  it('clamps negative deltas below the bound', () => {
    expect(clampMatchTargetAIDelta(-99)).toBe(-MATCH_TARGET_AI_MAX_DELTA);
  });

  it('treats non-finite deltas as 0', () => {
    expect(clampMatchTargetAIDelta(NaN)).toBe(0);
    expect(clampMatchTargetAIDelta(Infinity)).toBe(0);
  });
});

describe('normalizeSelectedMatchTargets', () => {
  it('returns canonical UPPER_SNAKE values, deduped', () => {
    expect(
      normalizeSelectedMatchTargets(['INVESTOR', 'INVESTOR', 'ADVISOR']),
    ).toEqual([MatchTargetType.INVESTOR, MatchTargetType.ADVISOR]);
  });

  it('drops unknown / non-string values', () => {
    expect(
      normalizeSelectedMatchTargets([
        'INVESTOR',
        'NOT_A_TARGET',
        null as any,
        42 as any,
      ]),
    ).toEqual([MatchTargetType.INVESTOR]);
  });
});

describe('runMatchTargetHardFilters', () => {
  it('FAILs when contact is BLOCKED', () => {
    const r = runMatchTargetHardFilters(MatchTargetType.INVESTOR, 90, 90, {
      blocked: true,
    });
    expect(r.status).toBe('FAIL');
    expect(r.reason).toBe('BLOCKED');
  });

  it('FAILs when contact has OPTED_OUT', () => {
    const r = runMatchTargetHardFilters(MatchTargetType.INVESTOR, 90, 90, {
      optedOut: true,
    });
    expect(r.status).toBe('FAIL');
    expect(r.reason).toBe('OPT_OUT');
  });

  it('FAILs when there is no signal at all', () => {
    const r = runMatchTargetHardFilters(MatchTargetType.INVESTOR, 0, 0);
    expect(r.status).toBe('FAIL');
    expect(r.reason).toBe('NO_TARGET_SIGNAL');
  });

  it('WARNs when evidence is limited (<30)', () => {
    const r = runMatchTargetHardFilters(MatchTargetType.ADVISOR, 20, 5);
    expect(r.status).toBe('WARN');
    expect(r.reason).toBe('LIMITED_ADVISOR_EVIDENCE');
  });

  it('PASSes when evidence is strong', () => {
    const r = runMatchTargetHardFilters(MatchTargetType.INVESTOR, 80, 70);
    expect(r.status).toBe('PASS');
    expect(r.reason).toBe('NONE');
  });
});

describe('enrichPitchMatchTargets — single target', () => {
  it('totalScore equals the only selected target score', () => {
    const result = enrichPitchMatchTargets({
      selected: [MatchTargetType.INVESTOR],
      contact: { jobTitle: 'Angel Investor', company: 'Apex Ventures' },
    });
    expect(result.selectedMatchTargets).toEqual([MatchTargetType.INVESTOR]);
    expect(result.matchTargetScores).toHaveLength(1);
    expect(result.totalScore).toBe(result.matchTargetScores[0].finalScore);
    expect(result.bestMatchTarget).toBe(MatchTargetType.INVESTOR);
    expect(result.matchTargetScores[0].isBestMatchTarget).toBe(true);
  });
});

describe('enrichPitchMatchTargets — multiple targets', () => {
  it('returns one detail per selected target', () => {
    const result = enrichPitchMatchTargets({
      selected: [MatchTargetType.INVESTOR, MatchTargetType.ADVISOR, MatchTargetType.STRATEGIC_PARTNER],
      contact: { jobTitle: 'CEO', company: 'Example Corp' },
    });
    expect(result.matchTargetScores).toHaveLength(3);
    expect(new Set(result.matchTargetScores.map((s) => s.matchTarget))).toEqual(
      new Set([
        MatchTargetType.INVESTOR,
        MatchTargetType.ADVISOR,
        MatchTargetType.STRATEGIC_PARTNER,
      ]),
    );
  });

  it('totalScore equals the MAX of per-target final scores (not avg, not sum)', () => {
    const result = enrichPitchMatchTargets({
      selected: [MatchTargetType.INVESTOR, MatchTargetType.ADVISOR],
      // Strong advisor signal, weak investor signal.
      contact: {
        jobTitle: 'Board Advisor',
        company: 'Acme',
        bio: 'Sit on advisory boards for several startups.',
      },
    });
    const investor = result.matchTargetScores.find(
      (s) => s.matchTarget === MatchTargetType.INVESTOR,
    )!;
    const advisor = result.matchTargetScores.find(
      (s) => s.matchTarget === MatchTargetType.ADVISOR,
    )!;
    const max = Math.max(investor.finalScore, advisor.finalScore);
    const avg = (investor.finalScore + advisor.finalScore) / 2;
    const sum = investor.finalScore + advisor.finalScore;
    expect(result.totalScore).toBe(max);
    if (avg !== max) expect(result.totalScore).not.toBe(avg);
    if (sum !== max) expect(result.totalScore).not.toBe(sum);
    expect(result.bestMatchTarget).toBe(MatchTargetType.ADVISOR);
  });

  it('exposes lower-scoring targets too (does not hide them)', () => {
    const result = enrichPitchMatchTargets({
      selected: [
        MatchTargetType.INVESTOR,
        MatchTargetType.ADVISOR,
        MatchTargetType.STRATEGIC_PARTNER,
      ],
      contact: { jobTitle: 'CEO' },
    });
    for (const t of [
      MatchTargetType.INVESTOR,
      MatchTargetType.ADVISOR,
      MatchTargetType.STRATEGIC_PARTNER,
    ]) {
      const detail = result.matchTargetScores.find((s) => s.matchTarget === t);
      expect(detail).toBeDefined();
      expect(typeof detail!.finalScore).toBe('number');
      expect(typeof detail!.matchLevel).toBe('string');
    }
  });

  it('Customer / Buyer recognised as a Match Target', () => {
    const result = enrichPitchMatchTargets({
      selected: [MatchTargetType.CUSTOMER_BUYER],
      contact: { jobTitle: 'Chief Procurement Officer' },
    });
    expect(result.matchTargetScores).toHaveLength(1);
    expect(result.matchTargetScores[0].matchTarget).toBe(
      MatchTargetType.CUSTOMER_BUYER,
    );
    expect(result.totalScore).toBeGreaterThan(0);
  });
});

describe('enrichPitchMatchTargets — hard filters per target', () => {
  it('contact strong for ADVISOR is still returned when INVESTOR fails', () => {
    const result = enrichPitchMatchTargets({
      selected: [MatchTargetType.INVESTOR, MatchTargetType.ADVISOR],
      // Advisor profile, no investor signal at all.
      contact: { jobTitle: 'Advisory Board Member' },
    });
    const investor = result.matchTargetScores.find(
      (s) => s.matchTarget === MatchTargetType.INVESTOR,
    )!;
    const advisor = result.matchTargetScores.find(
      (s) => s.matchTarget === MatchTargetType.ADVISOR,
    )!;
    expect(investor.hardFilterStatus).toBe('FAIL');
    expect(advisor.hardFilterStatus).toBe('PASS');
    expect(advisor.finalScore).toBeGreaterThan(0);
    expect(result.totalScore).toBe(advisor.finalScore);
    expect(result.bestMatchTarget).toBe(MatchTargetType.ADVISOR);
  });

  it('all-FAIL contact yields totalScore 0 and null bestMatchTarget', () => {
    const result = enrichPitchMatchTargets({
      selected: [MatchTargetType.INVESTOR, MatchTargetType.ADVISOR],
      contact: { jobTitle: 'Random Person', company: 'Random Co' },
    });
    expect(result.totalScore).toBe(0);
    expect(result.bestMatchTarget).toBeNull();
  });

  it('candidate-level BLOCKED FAILs every selected target', () => {
    const result = enrichPitchMatchTargets({
      selected: [MatchTargetType.INVESTOR, MatchTargetType.ADVISOR],
      contact: { jobTitle: 'Angel Investor' },
      flags: { blocked: true },
    });
    expect(
      result.matchTargetScores.every((s) => s.hardFilterStatus === 'FAIL'),
    ).toBe(true);
    expect(result.totalScore).toBe(0);
    expect(result.bestMatchTarget).toBeNull();
  });
});

describe('applyMatchTargetAIValidation', () => {
  function fixtureMultiTargetResult() {
    return enrichPitchMatchTargets({
      selected: [MatchTargetType.INVESTOR, MatchTargetType.ADVISOR],
      contact: {
        jobTitle: 'CEO and Angel Investor',
        company: 'Apex Ventures',
        bio: 'Started 3 companies; sit on 2 advisory boards.',
      },
    });
  }

  it('clamps positive AI delta to ±15', () => {
    const base = fixtureMultiTargetResult();
    const before = base.matchTargetScores.find(
      (s) => s.matchTarget === MatchTargetType.INVESTOR,
    )!;
    const after = applyMatchTargetAIValidation(base, [
      { matchTarget: MatchTargetType.INVESTOR, aiScoreDelta: 50 },
    ]);
    const afterInvestor = after.matchTargetScores.find(
      (s) => s.matchTarget === MatchTargetType.INVESTOR,
    )!;
    expect(afterInvestor.scoreBreakdown.aiDelta).toBe(15);
    expect(afterInvestor.aiAdjustmentBounded).toBe(true);
    expect(afterInvestor.finalScore).toBe(Math.min(100, before.score + 15));
  });

  it('clamps negative AI delta to ±15', () => {
    const base = fixtureMultiTargetResult();
    const before = base.matchTargetScores.find(
      (s) => s.matchTarget === MatchTargetType.INVESTOR,
    )!;
    const after = applyMatchTargetAIValidation(base, [
      { matchTarget: MatchTargetType.INVESTOR, aiScoreDelta: -99 },
    ]);
    const afterInvestor = after.matchTargetScores.find(
      (s) => s.matchTarget === MatchTargetType.INVESTOR,
    )!;
    expect(afterInvestor.scoreBreakdown.aiDelta).toBe(-15);
    expect(afterInvestor.finalScore).toBe(Math.max(0, before.score - 15));
  });

  it('NEVER overrides a hard-filter FAIL', () => {
    const failing = enrichPitchMatchTargets({
      selected: [MatchTargetType.INVESTOR, MatchTargetType.ADVISOR],
      contact: { jobTitle: 'Random Person' },
    });
    expect(failing.totalScore).toBe(0);
    const after = applyMatchTargetAIValidation(failing, [
      { matchTarget: MatchTargetType.INVESTOR, aiScoreDelta: 15 },
      { matchTarget: MatchTargetType.ADVISOR, aiScoreDelta: 15 },
    ]);
    expect(after.totalScore).toBe(0);
    expect(after.bestMatchTarget).toBeNull();
  });

  it('attaches aiReasoning to the per-target detail', () => {
    const base = fixtureMultiTargetResult();
    const after = applyMatchTargetAIValidation(base, [
      {
        matchTarget: MatchTargetType.INVESTOR,
        aiScoreDelta: 5,
        aiReasoning: 'Active investor on AngelList for 3 years.',
      },
    ]);
    const investor = after.matchTargetScores.find(
      (s) => s.matchTarget === MatchTargetType.INVESTOR,
    )!;
    expect(investor.aiReasoning).toContain('Active investor');
    expect(investor.explanation).toContain('Active investor');
  });
});

describe('mergeEnrichedMatchTargetResults', () => {
  it('keeps the higher-scoring detail per target after merge', () => {
    const a = enrichPitchMatchTargets({
      selected: [MatchTargetType.INVESTOR, MatchTargetType.ADVISOR],
      contact: { jobTitle: 'Angel Investor' }, // strong investor
    });
    const b = enrichPitchMatchTargets({
      selected: [MatchTargetType.INVESTOR, MatchTargetType.ADVISOR],
      contact: { jobTitle: 'Board Advisor' }, // strong advisor
    });
    const merged = mergeEnrichedMatchTargetResults(a, b);
    const investor = merged.matchTargetScores.find(
      (s) => s.matchTarget === MatchTargetType.INVESTOR,
    )!;
    const advisor = merged.matchTargetScores.find(
      (s) => s.matchTarget === MatchTargetType.ADVISOR,
    )!;
    const aInv = a.matchTargetScores.find(
      (s) => s.matchTarget === MatchTargetType.INVESTOR,
    )!.finalScore;
    const aAdv = a.matchTargetScores.find(
      (s) => s.matchTarget === MatchTargetType.ADVISOR,
    )!.finalScore;
    const bInv = b.matchTargetScores.find(
      (s) => s.matchTarget === MatchTargetType.INVESTOR,
    )!.finalScore;
    const bAdv = b.matchTargetScores.find(
      (s) => s.matchTarget === MatchTargetType.ADVISOR,
    )!.finalScore;
    expect(investor.finalScore).toBe(Math.max(aInv, bInv));
    expect(advisor.finalScore).toBe(Math.max(aAdv, bAdv));
    expect(merged.totalScore).toBe(
      Math.max(...merged.matchTargetScores.map((s) => s.finalScore)),
    );
    // Exactly one isBestMatchTarget after merge.
    expect(
      merged.matchTargetScores.filter((s) => s.isBestMatchTarget),
    ).toHaveLength(1);
  });
});

describe('getBestMatchTargetScore', () => {
  it('returns null when every score is 0', () => {
    const detail = enrichPitchMatchTargets({
      selected: [MatchTargetType.INVESTOR, MatchTargetType.ADVISOR],
      contact: { jobTitle: 'Random Person' },
    });
    expect(getBestMatchTargetScore(detail.matchTargetScores)).toBeNull();
  });
});

describe('rankByTotalMatchTargetScore', () => {
  it('orders by totalScore desc, then bestConfidence, then deterministic', () => {
    const items = [
      { totalScore: 50, bestConfidence: 0.9, deterministicScore: 50 },
      { totalScore: 80, bestConfidence: 0.4, deterministicScore: 80 },
      { totalScore: 80, bestConfidence: 0.7, deterministicScore: 80 },
    ];
    items.sort(rankByTotalMatchTargetScore);
    expect(items[0].totalScore).toBe(80);
    expect(items[0].bestConfidence).toBe(0.7);
    expect(items[items.length - 1].totalScore).toBe(50);
  });
});

describe('Backward-compatibility', () => {
  it('legacyScoresMap mirrors per-target finalScores keyed by canonical type', () => {
    const result = enrichPitchMatchTargets({
      selected: [MatchTargetType.INVESTOR, MatchTargetType.ADVISOR],
      contact: { jobTitle: 'Board Advisor' },
    });
    for (const d of result.matchTargetScores) {
      expect(result.legacyScoresMap[d.matchTarget]).toBe(d.finalScore);
      expect(result.legacyLabelsMap[d.matchTarget]).toBe(d.label);
    }
  });
});
