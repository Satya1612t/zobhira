-- Job-quality signal, computed automatically by Postgres from columns that
-- already exist (GENERATED ALWAYS ... STORED — no scraper/application code
-- writes this directly, it's recomputed whenever a row's underlying columns
-- change). Used to sort listings by "how good is this posting" instead of
-- postedAt alone, and to demote (never delete — same "flag, don't
-- auto-reject" caution as the scraper's own repost/staffing-agency flags)
-- thin or suspicious postings rather than hiding them outright.
--
-- Positive signals: has a salary, has a logo, has a deadline, has tags, and
-- description length (word count, capped so a very long description can't
-- dominate the score on its own).
-- Negative signals: placeholder/missing company name ("Confidential" etc.),
-- and the LinkedIn-specific ghost-listing/staffing-agency flags already
-- written into `raw` by services/scraper/scripts/run_scrape.py's
-- flag_if_repost / flag_staffing_agency (see db/migrations — no new scraper
-- work needed, this just reads flags that already exist).
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS quality_score INTEGER GENERATED ALWAYS AS (
    (CASE WHEN salary_min IS NOT NULL THEN 20 ELSE 0 END) +
    (CASE WHEN logo_url IS NOT NULL THEN 5 ELSE 0 END) +
    (CASE WHEN deadline_at IS NOT NULL THEN 5 ELSE 0 END) +
    (CASE WHEN array_length(tags, 1) > 0 THEN 5 ELSE 0 END) +
    -- regexp_split_to_array('', ...) returns a one-element array ({''}),
    -- not an empty array, so a NULL/blank description would otherwise
    -- score as "1 word" instead of 0 — explicitly zeroed here instead.
    (CASE
        WHEN trim(coalesce(description, '')) = '' THEN 0
        ELSE LEAST(array_length(regexp_split_to_array(trim(description), '\s+'), 1), 60)
    END) -
    (CASE WHEN company ~* '^(confidential|unknown|n/a|na|company name withheld)\s*$' THEN 50 ELSE 0 END) -
    (CASE WHEN (raw ->> 'flagged_ghost_listing') = 'true' THEN 40 ELSE 0 END) -
    (CASE WHEN (raw ->> 'flagged_staffing_agency') = 'true' THEN 15 ELSE 0 END)
) STORED;

-- Sorting by this becomes the default listing order (see apps/web/src/lib/jobQuery.ts).
CREATE INDEX IF NOT EXISTS idx_jobs_quality_score ON jobs (quality_score DESC);
