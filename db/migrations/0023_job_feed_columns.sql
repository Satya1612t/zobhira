-- All nullable, no defaults: plain metadata-only ADD COLUMN, no table
-- rewrite, no ACCESS EXCLUSIVE lock (unlike the generated columns in 0019).
-- Safe to apply to a live volume outside a maintenance window.
--
-- source_url stays exactly as v1 uses it. apply_url is additive: for feed
-- sources the board page and the application form are different URLs, and
-- the apply link is the one that matters to a candidate.
ALTER TABLE jobs
    ADD COLUMN IF NOT EXISTS apply_url   TEXT,
    ADD COLUMN IF NOT EXISTS external_id TEXT,
    ADD COLUMN IF NOT EXISTS company_id  BIGINT REFERENCES company_registry(id);

-- Partial index: only feed sources set external_id, so v1 rows are entirely
-- unaffected by this constraint.
CREATE UNIQUE INDEX IF NOT EXISTS idx_jobs_source_external
    ON jobs (source, external_id) WHERE external_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_jobs_company_id
    ON jobs (company_id) WHERE is_active;
