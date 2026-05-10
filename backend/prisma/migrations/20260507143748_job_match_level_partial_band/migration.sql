-- Phase 5 of the Job Matching Engine spec: switch the band system from the
-- legacy POOR(0-20) / WEAK(21-40) / GOOD(41-60) / VERY_GOOD(61-80) /
-- EXCELLENT(81-100) layout to the spec-mandated WEAK(0-39) / PARTIAL(40-54)
-- / GOOD(55-69) / VERY_GOOD(70-84) / EXCELLENT(85-100) layout.
--
-- Strategy:
--   1. Add PARTIAL to the `match_level` enum (also keep POOR — see
--      schema.prisma comment — so pre-migration rows hydrate cleanly).
--   2. Recompute `match_level` from `final_score` for every existing row
--      using the new boundaries. Today the table is empty so nothing
--      changes; the SQL is here for correctness when production data
--      starts flowing.
--
-- New rows emit only the 5 spec bands (POOR is never written by code post
-- Phase 5).

ALTER TABLE `job_matches`
  MODIFY COLUMN `match_level` ENUM(
    'POOR',
    'WEAK',
    'PARTIAL',
    'GOOD',
    'VERY_GOOD',
    'EXCELLENT'
  ) NOT NULL;

-- Backfill: rewrite every row's match_level based on final_score using the
-- new spec boundaries. CASE order matters — highest band first.
UPDATE `job_matches`
SET `match_level` = CASE
  WHEN `final_score` >= 85 THEN 'EXCELLENT'
  WHEN `final_score` >= 70 THEN 'VERY_GOOD'
  WHEN `final_score` >= 55 THEN 'GOOD'
  WHEN `final_score` >= 40 THEN 'PARTIAL'
  ELSE 'WEAK'
END
WHERE `match_level` IS NOT NULL;
