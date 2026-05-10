-- Per-LookingFor / matchIntent persistence for the Pitch Matching Engine.
--
-- These columns let GET /pitches/:id/results return the same per-target
-- breakdown that POST /pitches/:id/find-matches generates, instead of
-- recomputing enrichment in memory on every request.

ALTER TABLE `pitch_matches`
  ADD COLUMN `total_score` SMALLINT NULL,
  ADD COLUMN `deterministic_score` SMALLINT NULL,
  ADD COLUMN `ai_score` SMALLINT NULL,
  ADD COLUMN `best_match_target` VARCHAR(50) NULL,
  ADD COLUMN `match_target_scores_json` JSON NULL,
  ADD COLUMN `overall_explanation_json` JSON NULL;
