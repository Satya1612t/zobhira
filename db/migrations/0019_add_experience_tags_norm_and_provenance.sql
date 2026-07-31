-- Materializes the three things /jobs currently derives at query time —
-- experience level, normalized tags, and employment type — into real,
-- indexed columns, and recalibrates quality_score so the default listing
-- order stops rewarding verbose senior JDs over short fresher ones.
--
-- WHY: experienceMatchingIds/skillsMatchingIds in apps/web/src/lib/jobQuery.ts
-- each run a full sequential scan over `jobs`, ship every matching id back
-- to Node, and then send it to Postgres again as `id IN (...)`. That is
-- O(table) per request per filter, and it is also *wrong* — see
-- services/scraper/utils/experience.py's module docstring for why the
-- old EXPERIENCE_PATTERN regex swept most senior postings into "fresher".
--
-- ⚠️  ADDING A STORED GENERATED COLUMN REWRITES THE WHOLE TABLE AND TAKES AN
-- ACCESS EXCLUSIVE LOCK. On a large `jobs` table run this in a maintenance
-- window. The quality_score DROP/ADD below is a second full rewrite.
-- Everything is wrapped in one transaction so a failure leaves no partial
-- state.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Experience, extracted once at ingest instead of regex-matched per query
-- ---------------------------------------------------------------------------
-- min/max are NUMERIC(4,1) rather than INTEGER because real postings say
-- "0.6-1 years" and "6 months to 2 years"; storing 0.5 beats rounding a
-- six-month role up to 1 and losing it from the fresher band.
--
-- exp_source records WHICH extractor produced the value ('title' /
-- 'description' / 'llm' / 'none'), so a bad prompt change can be found and
-- re-run against only the rows it touched instead of the whole table.
ALTER TABLE jobs
    ADD COLUMN IF NOT EXISTS min_years_exp   NUMERIC(4,1),
    ADD COLUMN IF NOT EXISTS max_years_exp   NUMERIC(4,1),
    ADD COLUMN IF NOT EXISTS experience_band TEXT,
    ADD COLUMN IF NOT EXISTS exp_source      TEXT;

ALTER TABLE jobs DROP CONSTRAINT IF EXISTS jobs_experience_band_check;
ALTER TABLE jobs ADD CONSTRAINT jobs_experience_band_check
    CHECK (experience_band IS NULL OR experience_band IN
        ('fresher', 'junior', 'mid', 'senior', 'lead', 'unknown'));

ALTER TABLE jobs DROP CONSTRAINT IF EXISTS jobs_exp_source_check;
ALTER TABLE jobs ADD CONSTRAINT jobs_exp_source_check
    CHECK (exp_source IS NULL OR exp_source IN ('title', 'description', 'llm', 'none'));

-- Sort key for "fresher first". Prisma cannot express `ORDER BY CASE ...`,
-- so the CASE lives in the database as a generated column and jobOrderBy()
-- just sorts on it ascending.
--
-- NOTE the deliberate gap: NULL and 'unknown' rank 2 — ABOVE mid/senior,
-- BELOW fresher/junior. During rollout almost every row is NULL, and
-- ranking unknowns last would empty the front page until the backfill
-- finishes. Ranking them dead-first would flood it with unclassified
-- senior roles. Sitting them in the middle degrades gracefully in both
-- directions.
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS fresher_rank SMALLINT GENERATED ALWAYS AS (
    CASE experience_band
        WHEN 'fresher' THEN 0
        WHEN 'junior'  THEN 1
        WHEN 'mid'     THEN 3
        WHEN 'senior'  THEN 4
        WHEN 'lead'    THEN 5
        ELSE 2
    END
) STORED;

-- ---------------------------------------------------------------------------
-- 2. Normalized tags — makes the GIN index actually usable
-- ---------------------------------------------------------------------------
-- The existing skills filter does `unnest(tags) AS t WHERE t ILIKE ANY(...)`,
-- which cannot use idx_jobs_tags (GIN on tags) at all: unnest + ILIKE is
-- opaque to the planner. tags_norm holds the same tags lowercased and
-- alias-collapsed ("NodeJS"/"Node.js"/"node" -> "node.js"), so the filter
-- becomes `tags_norm && ARRAY[...]`, which the GIN index below serves
-- directly.
--
-- `tags` stays exactly as-is and remains the display value — this is an
-- additive search index, not a replacement.
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS tags_norm TEXT[] NOT NULL DEFAULT '{}';

-- Rough seed so the column is never empty before the Python backfill runs
-- (which re-derives it properly through the alias map). Safe to re-run.
UPDATE jobs
SET tags_norm = ARRAY(SELECT DISTINCT lower(btrim(t)) FROM unnest(tags) AS t WHERE btrim(t) <> '')
WHERE cardinality(tags_norm) = 0 AND cardinality(tags) > 0;

-- ---------------------------------------------------------------------------
-- 3. Per-field provenance + AI enrichment bookkeeping
-- ---------------------------------------------------------------------------
-- field_provenance maps field name -> 'title'|'description'|'source'|'llm'.
-- The row-level extraction_method column already exists but is too coarse:
-- a row is routinely part-deterministic and part-LLM, and when an LLM
-- extraction turns out to be wrong you need to know exactly which fields to
-- invalidate. Shape: {"min_years_exp": "llm", "skills": "description"}
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS field_provenance JSONB NOT NULL DEFAULT '{}'::jsonb;

-- enrichment_hash is sha256 of (title || description). A re-scrape whose
-- description is byte-identical skips the LLM call entirely — on a source
-- swept daily that is the difference between paying once per job and paying
-- once per job per day.
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS enriched_at      TIMESTAMPTZ;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS enrichment_hash  TEXT;

-- ---------------------------------------------------------------------------
-- 4. Recalibrate quality_score
-- ---------------------------------------------------------------------------
-- The 0014 formula gave description word count up to 60 points while salary
-- was worth 20 — so the single biggest driver of default ordering was
-- "which JD is longest". Long JDs skew heavily corporate and senior, which
-- means the old default order actively fought "show freshers first".
--
-- Changes: word count contributes at most 15 (rewarding "has real content"
-- without letting a 1200-word wall dominate), a flat +10 for having any
-- description at all, and a positive weight for actually knowing the
-- experience band — with an explicit fresher/junior boost, since fresher
-- inventory is this platform's stated reason to exist.
--
-- A STORED generated column may reference other plain columns but NOT other
-- generated columns, which is why this reads experience_band (plain) and not
-- fresher_rank (generated).
DROP INDEX IF EXISTS idx_jobs_quality_score;
ALTER TABLE jobs DROP COLUMN IF EXISTS quality_score;

ALTER TABLE jobs ADD COLUMN quality_score INTEGER GENERATED ALWAYS AS (
    -- Completeness signals
    (CASE WHEN salary_min IS NOT NULL THEN 20 ELSE 0 END) +
    (CASE WHEN logo_url IS NOT NULL THEN 5 ELSE 0 END) +
    (CASE WHEN deadline_at IS NOT NULL THEN 5 ELSE 0 END) +
    (CASE WHEN array_length(tags, 1) > 0 THEN 5 ELSE 0 END) +
    (CASE WHEN btrim(coalesce(description, '')) <> '' THEN 10 ELSE 0 END) +
    -- Depth, heavily capped (was LEAST(words, 60), now LEAST(words/20, 15):
    -- 300 words earns full marks, 1200 words earns no more than 300 does)
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
    -- Negative signals (unchanged from 0014)
    (CASE WHEN company ~* '^(confidential|unknown|n/a|na|company name withheld)\s*$' THEN 50 ELSE 0 END) -
    (CASE WHEN (raw ->> 'flagged_ghost_listing') = 'true' THEN 40 ELSE 0 END) -
    (CASE WHEN (raw ->> 'flagged_staffing_agency') = 'true' THEN 15 ELSE 0 END)
) STORED;

-- ---------------------------------------------------------------------------
-- 5. Indexes
-- ---------------------------------------------------------------------------
-- All partial on is_active because buildJobsWhere() unconditionally sets
-- `isActive: true` — the predicate always matches, and excluding dead rows
-- keeps these indexes roughly the size of live inventory rather than of
-- everything ever scraped.
CREATE INDEX IF NOT EXISTS idx_jobs_quality_score ON jobs (quality_score DESC);

CREATE INDEX IF NOT EXISTS idx_jobs_experience_band
    ON jobs (experience_band) WHERE is_active;

CREATE INDEX IF NOT EXISTS idx_jobs_min_years_exp
    ON jobs (min_years_exp) WHERE is_active;

-- Serves the new default ORDER BY (fresher_rank, quality_score DESC,
-- posted_at DESC) as a single index scan with no sort node.
CREATE INDEX IF NOT EXISTS idx_jobs_fresher_order
    ON jobs (fresher_rank, quality_score DESC, posted_at DESC) WHERE is_active;

CREATE INDEX IF NOT EXISTS idx_jobs_tags_norm ON jobs USING GIN (tags_norm);

-- Worklist for the AI enrichment pass: "active, never enriched".
CREATE INDEX IF NOT EXISTS idx_jobs_needs_enrichment
    ON jobs (first_seen_at) WHERE is_active AND enriched_at IS NULL;

-- employment_type is now populated for every source (see
-- utils/field_enrichment.py::normalize_employment_type), not just Himalayas,
-- so it is worth indexing.
CREATE INDEX IF NOT EXISTS idx_jobs_employment_type
    ON jobs (employment_type) WHERE is_active;

COMMIT;
