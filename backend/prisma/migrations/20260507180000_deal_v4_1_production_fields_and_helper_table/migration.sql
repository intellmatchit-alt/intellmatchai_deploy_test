-- v4.1 Deal Matching Engine: production-grade persistence
-- 1. Add the new fields to deal_match_results (direct buyer↔seller flow)
-- 2. Create deal_helper_match_results (helper / introducer flows)

-- ----------------------------------------------------------------------------
-- 1. deal_match_results — additive columns + index for effectiveRankScore
-- ----------------------------------------------------------------------------

ALTER TABLE `deal_match_results`
  ADD COLUMN `final_score`           SMALLINT NULL,
  ADD COLUMN `deterministic_score`   SMALLINT NULL,
  ADD COLUMN `ai_score`              SMALLINT NULL,
  ADD COLUMN `effective_rank_score`  DOUBLE   NULL,
  ADD COLUMN `match_level`           VARCHAR(20) NULL,
  ADD COLUMN `retrieval_score`       DOUBLE   NULL,
  ADD COLUMN `retrieval_breakdown`   JSON     NULL,
  ADD COLUMN `ranking_factors`       JSON     NULL,
  ADD COLUMN `ai_reasoning`          TEXT     NULL,
  ADD COLUMN `ai_green_flags`        JSON     NULL,
  ADD COLUMN `ai_red_flags`          JSON     NULL,
  ADD COLUMN `network_relationship`  JSON     NULL,
  ADD COLUMN `match_mode`            VARCHAR(40) NULL;

CREATE INDEX `deal_match_results_dealRequestId_effectiveRankScore_idx`
  ON `deal_match_results` (`deal_request_id`, `effective_rank_score`);

-- ----------------------------------------------------------------------------
-- 2. deal_helper_match_results — new table for helper / introducer matches
-- ----------------------------------------------------------------------------

CREATE TABLE `deal_helper_match_results` (
  `id`                     VARCHAR(191) NOT NULL,
  `deal_request_id`        VARCHAR(191) NOT NULL,
  `helper_contact_id`      VARCHAR(191) NULL,
  `helper_user_id`         VARCHAR(191) NULL,
  `match_mode`             VARCHAR(40)  NOT NULL,
  `helper_type`            VARCHAR(40)  NOT NULL,
  `helper_type_label`      VARCHAR(80)  NULL,
  `likely_help_type`       TEXT         NULL,
  `helper_name`            VARCHAR(200) NOT NULL,
  `helper_title`           VARCHAR(200) NULL,
  `helper_role_area`       VARCHAR(120) NULL,
  `helper_organization`    VARCHAR(200) NULL,

  `final_score`            SMALLINT     NOT NULL,
  `deterministic_score`    SMALLINT     NOT NULL,
  `ai_score`               SMALLINT     NULL,
  `effective_rank_score`   DOUBLE       NOT NULL,
  `confidence`             DOUBLE       NOT NULL,
  `match_level`            VARCHAR(20)  NOT NULL,
  `surfaced_status`        VARCHAR(20)  NULL,
  `hard_filter_status`     VARCHAR(20)  NULL,
  `hard_filter_reason`     VARCHAR(100) NULL,
  `retrieval_score`        DOUBLE       NULL,
  `retrieval_breakdown`    JSON         NULL,
  `ranking_factors`        JSON         NULL,
  `score_breakdown`        JSON         NOT NULL,
  `explanation`            JSON         NOT NULL,
  `helper_explanation`     TEXT         NULL,
  `strengths`              JSON         NULL,
  `gaps`                   JSON         NULL,
  `matched_signals`        JSON         NULL,
  `missing_fields`         JSON         NULL,
  `network_relationship`   JSON         NULL,
  `ai_reasoning`           TEXT         NULL,
  `ai_green_flags`         JSON         NULL,
  `ai_red_flags`           JSON         NULL,

  `rank`                   INT          NULL,
  `status`                 ENUM('NEW','SAVED','IGNORED','CONTACTED','ARCHIVED') NOT NULL DEFAULT 'NEW',
  `saved_at`               DATETIME(3)  NULL,
  `ignored_at`             DATETIME(3)  NULL,
  `contacted_at`           DATETIME(3)  NULL,
  `archived_at`            DATETIME(3)  NULL,
  `created_at`             DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at`             DATETIME(3)  NOT NULL,

  PRIMARY KEY (`id`),
  CONSTRAINT `deal_helper_match_results_dealRequestId_fkey`
    FOREIGN KEY (`deal_request_id`) REFERENCES `deal_requests`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  INDEX `deal_helper_match_results_dealRequestId_idx`
    (`deal_request_id`),
  INDEX `deal_helper_match_results_dealRequestId_effectiveRankScore_idx`
    (`deal_request_id`, `effective_rank_score`),
  INDEX `deal_helper_match_results_helperUserId_idx`
    (`helper_user_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
