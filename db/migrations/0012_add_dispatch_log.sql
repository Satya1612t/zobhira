-- Tracks which content items (jobs/contests) have been posted to which
-- outbound platform (telegram, and later whatsapp/instagram/youtube).
-- One row per (content_type, content_id, platform). A row is created only
-- when a send is attempted-and-confirmed by n8n (mark-posted upsert), so
-- "pending" = no row yet OR a row with posted_at IS NULL. This keeps items
-- eligible for retry until a send is confirmed, and lets a new platform be
-- added with zero schema change (just a new `platform` value).
CREATE TABLE IF NOT EXISTS dispatch_log (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    content_type  TEXT NOT NULL CHECK (content_type IN ('job', 'contest')),
    content_id    UUID NOT NULL,
    platform      TEXT NOT NULL CHECK (platform IN ('telegram', 'whatsapp', 'instagram', 'youtube')),
    posted_at     TIMESTAMPTZ,
    attempts      INTEGER NOT NULL DEFAULT 0,
    last_error    TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (content_type, content_id, platform)
);

-- Fast "is this item already posted to this platform" lookups and the
-- NOT EXISTS anti-join the pending query runs.
CREATE INDEX IF NOT EXISTS idx_dispatch_log_lookup
    ON dispatch_log (platform, content_type, content_id);
