-- Phase 8 of the Job Matching Engine: persistence parity for both flows.
--
-- The existing JobMatch table was hiring-flow specific (job_id +
-- candidate_id, both NOT NULL). The user picked "Reuse JobMatch +
-- matchMode discriminator" at scoping time. To make that work cleanly:
--
--   1. job_id and candidate_id become nullable so helper-flow rows can
--      omit them (a helper match has no associated hiring profile and
--      no "matched candidate" — the candidate is the source, not a
--      result).
--   2. Add match_mode discriminator with the spec's three values; default
--      'HIRING_TO_CANDIDATES' so existing rows hydrate cleanly.
--   3. Add helper-flow columns: candidate_profile_id (the source
--      job-seeker), target_job_id (TARGET_JOB_TO_HELPERS only),
--      helper_user_id / helper_contact_id (the helper), helper_type +
--      label + likely_help_type, helper_explanation text.
--   4. Add Phase 0/6/7 diagnostic columns: effective_rank_score,
--      rerank_score, retrieval_score, network_relationship. These were
--      already returned in API responses; persisting them so GET
--      hydrates the same shape.
--   5. Index match_mode-keyed query paths so list reads stay fast.
--
-- Table is currently empty in production data so this is zero-risk.

-- 1) Relax NOT NULL on the existing FK columns.
ALTER TABLE `job_matches`
  MODIFY COLUMN `job_id` VARCHAR(191) NULL,
  MODIFY COLUMN `candidate_id` VARCHAR(191) NULL;

-- 2) Discriminator column. Default keeps existing rows valid.
ALTER TABLE `job_matches`
  ADD COLUMN `match_mode` VARCHAR(50) NOT NULL DEFAULT 'HIRING_TO_CANDIDATES';

-- 3) Helper-flow identity columns.
ALTER TABLE `job_matches`
  ADD COLUMN `candidate_profile_id` VARCHAR(191) NULL,
  ADD COLUMN `target_job_id` VARCHAR(191) NULL,
  ADD COLUMN `helper_user_id` VARCHAR(191) NULL,
  ADD COLUMN `helper_contact_id` VARCHAR(191) NULL;

-- 4) Helper-flow display columns.
ALTER TABLE `job_matches`
  ADD COLUMN `helper_type` VARCHAR(50) NULL,
  ADD COLUMN `helper_type_label` VARCHAR(100) NULL,
  ADD COLUMN `likely_help_type` VARCHAR(20) NULL,
  ADD COLUMN `helper_explanation` TEXT NULL,
  ADD COLUMN `network_relationship` VARCHAR(100) NULL;

-- 5) Diagnostic / rank columns surfaced in the API since Phases 0/6/7.
ALTER TABLE `job_matches`
  ADD COLUMN `effective_rank_score` FLOAT NULL,
  ADD COLUMN `rerank_score` FLOAT NULL,
  ADD COLUMN `retrieval_score` SMALLINT NULL;

-- 6) Indexes that match the new query patterns.
CREATE INDEX `job_matches_match_mode_idx` ON `job_matches`(`match_mode`);
CREATE INDEX `job_matches_candidate_profile_id_archived_idx`
  ON `job_matches`(`candidate_profile_id`, `archived`);
CREATE INDEX `job_matches_helper_user_id_idx` ON `job_matches`(`helper_user_id`);
CREATE INDEX `job_matches_helper_contact_id_idx` ON `job_matches`(`helper_contact_id`);
