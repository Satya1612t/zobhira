-- Records who did what in the admin panel for every destructive/mutating
-- action (delete, active-toggle, source enable/disable, scheduler trigger).
-- Write-only from the app's perspective — nothing reads this back into any
-- UI query path yet, it exists purely so an incident/question ("who deleted
-- this job", "who fired that scrape") has an answer.
CREATE TABLE IF NOT EXISTS admin_audit_log (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_email  TEXT NOT NULL,
    action       TEXT NOT NULL,
    target_type  TEXT NOT NULL CHECK (target_type IN ('job', 'contest', 'source', 'scheduler')),
    target_id    TEXT NOT NULL,
    metadata     JSONB,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Recent-first listing is the only query shape this needs right now.
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_created_at
    ON admin_audit_log (created_at DESC);
