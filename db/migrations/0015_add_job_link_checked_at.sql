-- Tracks when each job's source_url was last verified reachable (see
-- apps/web/src/app/api/admin/link-health/route.ts). NULL = never checked.
-- Partial index (active jobs only) with NULLS FIRST so the endpoint's
-- "least-recently-checked" batch naturally covers never-checked jobs first,
-- then cycles through the rest oldest-checked-first over repeated calls.
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS link_checked_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_jobs_link_checked_at
    ON jobs (link_checked_at ASC NULLS FIRST)
    WHERE is_active = true;
