-- Makes v2 Stage 5 aggregator postings (Adzuna/Jooble/Careerjet) actually
-- rank below direct ATS/scraped jobs, by teaching quality_score to read the
-- `raw.flagged_indirect` flag those connectors set (see
-- services/scraper/feeds/providers/adzuna.py). Until now that flag was
-- stored but nothing consumed it (the plan's §9 deferred item) — this wires
-- it in. Penalty -15, same magnitude as flagged_staffing_agency: an
-- apply link that only reaches the employer via an aggregator redirect is a
-- real downgrade against Zobhira's "direct, no-login apply" promise, but not
-- as severe as a ghost listing (-40).
--
-- ⚠️  quality_score is a STORED generated column, so this DROP/ADD REWRITES
-- THE WHOLE jobs TABLE and takes an ACCESS EXCLUSIVE lock (same caveat as
-- db/migrations/0019). Run in a maintenance window on a large table. Wrapped
-- in one transaction so a failure leaves no partial state. The expression is
-- otherwise byte-identical to 0019's — only the final flagged_indirect term
-- is new.

BEGIN;

DROP INDEX IF EXISTS idx_jobs_quality_score;
ALTER TABLE jobs DROP COLUMN IF EXISTS quality_score;

ALTER TABLE jobs ADD COLUMN quality_score INTEGER GENERATED ALWAYS AS (
    -- Completeness signals
    (CASE WHEN salary_min IS NOT NULL THEN 20 ELSE 0 END) +
    (CASE WHEN logo_url IS NOT NULL THEN 5 ELSE 0 END) +
    (CASE WHEN deadline_at IS NOT NULL THEN 5 ELSE 0 END) +
    (CASE WHEN array_length(tags, 1) > 0 THEN 5 ELSE 0 END) +
    (CASE WHEN btrim(coalesce(description, '')) <> '' THEN 10 ELSE 0 END) +
    -- Depth, heavily capped
    (CASE
        WHEN btrim(coalesce(description, '')) = '' THEN 0
        ELSE LEAST(
            array_length(regexp_split_to_array(btrim(description), '\s+'), 1) / 20,
            15
        )
    END) +
    -- Knowing the experience level at all is itself a quality signal
    (CASE WHEN experience_band IS NOT NULL AND experience_band <> 'unknown' THEN 5 ELSE 0 END) +
    -- Audience fit: this platform exists for early-career applicants
    (CASE experience_band WHEN 'fresher' THEN 15 WHEN 'junior' THEN 8 ELSE 0 END) -
    -- Negative signals
    (CASE WHEN company ~* '^(confidential|unknown|n/a|na|company name withheld)\s*$' THEN 50 ELSE 0 END) -
    (CASE WHEN (raw ->> 'flagged_ghost_listing') = 'true' THEN 40 ELSE 0 END) -
    (CASE WHEN (raw ->> 'flagged_staffing_agency') = 'true' THEN 15 ELSE 0 END) -
    -- NEW: indirect apply link (aggregator redirect, not the employer/ATS)
    (CASE WHEN (raw ->> 'flagged_indirect') = 'true' THEN 15 ELSE 0 END)
) STORED;

CREATE INDEX IF NOT EXISTS idx_jobs_quality_score ON jobs (quality_score DESC);

COMMIT;
