-- is_active is filtered on in nearly every hot-path query (job/contest
-- listings, stats) but had no supporting index on either table.
-- Composite with the column each listing actually orders by, so the
-- planner can use one index for both the filter and the sort.
CREATE INDEX IF NOT EXISTS idx_jobs_active_posted_at ON jobs (is_active, posted_at DESC);
CREATE INDEX IF NOT EXISTS idx_contests_active_deadline ON contests (is_active, deadline_at);

-- 0001_init.sql and 0003_add_trgm.sql each created an identical GIN
-- trigram index on jobs.title under a different name (idx_jobs_title_trgm
-- vs jobs_title_trgm_idx) — both exist, wasting write-time index
-- maintenance for no benefit. Drop the later, redundant one.
DROP INDEX IF EXISTS jobs_title_trgm_idx;
