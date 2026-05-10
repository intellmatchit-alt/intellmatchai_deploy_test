/**
 * Tests for the spec-mandated 5-band match level system (Phase 5 migration).
 *
 * The spec replaces the legacy POOR / WEAK / GOOD / VERY_GOOD / EXCELLENT
 * layout with WEAK / PARTIAL / GOOD / VERY_GOOD / EXCELLENT. POOR is retained
 * on the persistence enum for legacy hydration ONLY; new code never emits
 * it. Hard-filter FAIL is therefore capped to WEAK (not POOR).
 *
 * Boundaries (spec §10):
 *   WEAK       0–39
 *   PARTIAL    40–54
 *   GOOD       55–69
 *   VERY_GOOD  70–84
 *   EXCELLENT  85–100
 *
 * @module __tests__/matching-bands.constants
 */

import {
  AI_MAX_SCORE_ADJUSTMENT,
  HardFilterStatus,
  MATCH_LEVEL_BOUNDARIES,
  MatchLevel,
  applyBoundedAIAdjustment,
  applyGating,
  bandExplanation,
  getMatchLevelFromScore,
  matchLevelLabel,
} from '../infrastructure/external/opportunities/v3/matching-bands.constants';

// ============================================================================
// getMatchLevelFromScore
// ============================================================================

describe('getMatchLevelFromScore', () => {
  it.each([
    [0, MatchLevel.WEAK],
    [39, MatchLevel.WEAK],
    [40, MatchLevel.PARTIAL],
    [54, MatchLevel.PARTIAL],
    [55, MatchLevel.GOOD],
    [69, MatchLevel.GOOD],
    [70, MatchLevel.VERY_GOOD],
    [84, MatchLevel.VERY_GOOD],
    [85, MatchLevel.EXCELLENT],
    [100, MatchLevel.EXCELLENT],
  ])('score %d → %s', (score, expected) => {
    expect(getMatchLevelFromScore(score)).toBe(expected);
  });

  it('never returns the legacy POOR level for ANY score', () => {
    for (let s = 0; s <= 100; s++) {
      expect(getMatchLevelFromScore(s)).not.toBe(MatchLevel.POOR);
    }
  });
});

describe('MATCH_LEVEL_BOUNDARIES', () => {
  it('does NOT include a POOR boundary entry (legacy-only enum value)', () => {
    expect(MATCH_LEVEL_BOUNDARIES).not.toHaveProperty('POOR');
  });

  it('boundaries are contiguous and cover 0..100', () => {
    expect(MATCH_LEVEL_BOUNDARIES.WEAK.min).toBe(0);
    expect(MATCH_LEVEL_BOUNDARIES.WEAK.max + 1).toBe(MATCH_LEVEL_BOUNDARIES.PARTIAL.min);
    expect(MATCH_LEVEL_BOUNDARIES.PARTIAL.max + 1).toBe(MATCH_LEVEL_BOUNDARIES.GOOD.min);
    expect(MATCH_LEVEL_BOUNDARIES.GOOD.max + 1).toBe(MATCH_LEVEL_BOUNDARIES.VERY_GOOD.min);
    expect(MATCH_LEVEL_BOUNDARIES.VERY_GOOD.max + 1).toBe(MATCH_LEVEL_BOUNDARIES.EXCELLENT.min);
    expect(MATCH_LEVEL_BOUNDARIES.EXCELLENT.max).toBe(100);
  });
});

// ============================================================================
// matchLevelLabel + bandExplanation (legacy POOR rendering)
// ============================================================================

describe('matchLevelLabel', () => {
  it('renders POOR as "Weak" so legacy rows display alongside WEAK', () => {
    expect(matchLevelLabel(MatchLevel.POOR)).toBe('Weak');
    expect(matchLevelLabel(MatchLevel.WEAK)).toBe('Weak');
  });

  it.each([
    [MatchLevel.PARTIAL, 'Partial'],
    [MatchLevel.GOOD, 'Good'],
    [MatchLevel.VERY_GOOD, 'Very Good'],
    [MatchLevel.EXCELLENT, 'Excellent'],
  ])('label for %s is %s', (level, expected) => {
    expect(matchLevelLabel(level)).toBe(expected);
  });
});

describe('bandExplanation', () => {
  it('shows WEAK boundary range for a legacy POOR row', () => {
    const text = bandExplanation(20, MatchLevel.POOR);
    expect(text).toMatch(/Weak/);
    expect(text).toMatch(/0.{1,3}39/);
  });

  it('shows PARTIAL boundary range for a 45-score row', () => {
    const text = bandExplanation(45, MatchLevel.PARTIAL);
    expect(text).toMatch(/Partial/);
    expect(text).toMatch(/40.{1,3}54/);
  });
});

// ============================================================================
// applyGating — Phase 5 contract: FAIL caps to WEAK (not POOR)
// ============================================================================

describe('applyGating', () => {
  it('hard filter FAIL caps the level to WEAK (no POOR in new code)', () => {
    const r = applyGating(95, 0.95, HardFilterStatus.FAIL, false);
    expect(r.level).toBe(MatchLevel.WEAK);
    expect(r.level).not.toBe(MatchLevel.POOR);
    expect(r.capped).toBe(true);
    expect(r.reason).toMatch(/Hard filter failed/);
  });

  it('PASS + high confidence preserves the natural band', () => {
    const r = applyGating(90, 0.9, HardFilterStatus.PASS, false);
    expect(r.level).toBe(MatchLevel.EXCELLENT);
    expect(r.capped).toBe(false);
    expect(r.reason).toBeNull();
  });

  it('low confidence demotes EXCELLENT → VERY_GOOD', () => {
    const r = applyGating(90, 0.5, HardFilterStatus.PASS, false);
    expect(r.level).toBe(MatchLevel.VERY_GOOD);
    expect(r.capped).toBe(true);
    expect(r.reason).toMatch(/EXCELLENT.*VERY_GOOD/);
  });

  it('low confidence demotes VERY_GOOD → GOOD', () => {
    const r = applyGating(80, 0.5, HardFilterStatus.PASS, false);
    expect(r.level).toBe(MatchLevel.GOOD);
    expect(r.capped).toBe(true);
  });

  it('sparse profiles cap at GOOD by default even on EXCELLENT scores', () => {
    const r = applyGating(95, 0.9, HardFilterStatus.PASS, true);
    expect(r.level).toBe(MatchLevel.GOOD);
    expect(r.capped).toBe(true);
    expect(r.reason).toMatch(/[Ss]parse/);
  });

  it('hard filter WARN caps EXCELLENT → VERY_GOOD', () => {
    const r = applyGating(90, 0.9, HardFilterStatus.WARN, false);
    expect(r.level).toBe(MatchLevel.VERY_GOOD);
    expect(r.capped).toBe(true);
  });

  it('a 45-score PASS lands in PARTIAL — the new spec band', () => {
    const r = applyGating(45, 0.8, HardFilterStatus.PASS, false);
    expect(r.level).toBe(MatchLevel.PARTIAL);
  });
});

// ============================================================================
// applyBoundedAIAdjustment — ±15 clamp (engine-wide invariant)
// ============================================================================

describe('applyBoundedAIAdjustment', () => {
  it('passes adjustments inside ±15 unchanged', () => {
    const r = applyBoundedAIAdjustment(70, 80);
    expect(r.adjustedScore).toBe(80);
    expect(r.bounded).toBe(false);
  });

  it('clamps positive adjustments above the bound', () => {
    const r = applyBoundedAIAdjustment(50, 90); // delta = +40 → clamp to +15
    expect(r.adjustedScore).toBe(50 + AI_MAX_SCORE_ADJUSTMENT);
    expect(r.bounded).toBe(true);
  });

  it('clamps negative adjustments below the bound', () => {
    const r = applyBoundedAIAdjustment(80, 10); // delta = -70 → clamp to -15
    expect(r.adjustedScore).toBe(80 - AI_MAX_SCORE_ADJUSTMENT);
    expect(r.bounded).toBe(true);
  });

  it('clamps the final score to [0, 100]', () => {
    const r = applyBoundedAIAdjustment(95, 200);
    expect(r.adjustedScore).toBeLessThanOrEqual(100);
    const s = applyBoundedAIAdjustment(5, -50);
    expect(s.adjustedScore).toBeGreaterThanOrEqual(0);
  });
});
