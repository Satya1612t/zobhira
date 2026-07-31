-- First-party traffic analytics: one row per page view, one per outbound
-- apply/register click. Deliberately separate from Firebase Analytics — this
-- exists so the admin panel can answer "which traffic source actually produces
-- apply-clicks, and on which listings", which needs a join against jobs/contests
-- that a third-party analytics product can't do.
--
-- Two conventions worth noting:
--   * `traffic_source` is NOT `jobs.source`. That column is the scraper the
--     listing came from (linkedin, ycombinator, …) and stays internal-only.
--     This one is where the *visitor* came from (instagram, google, direct).
--     Different concepts, so deliberately different names.
--   * content_type/content_id mirrors dispatch_log (0012), so contest clicks
--     are covered by the same table with zero schema change.
--
-- BIGSERIAL rather than the UUID PK used elsewhere in this schema: these are
-- append-only, high-volume, and never referenced by FK. Random UUIDs would
-- fragment the primary-key index for no benefit at insert rates this table
-- will see.

CREATE TABLE IF NOT EXISTS page_view (
    id              BIGSERIAL PRIMARY KEY,
    visitor_id      UUID        NOT NULL,
    session_id      UUID        NOT NULL,
    path            TEXT        NOT NULL,
    referrer        TEXT,
    traffic_source  TEXT        NOT NULL DEFAULT 'direct',
    utm_medium      TEXT,
    utm_campaign    TEXT,
    device          TEXT        CHECK (device IN ('mobile', 'tablet', 'desktop')),
    country         TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS apply_click (
    id              BIGSERIAL PRIMARY KEY,
    visitor_id      UUID        NOT NULL,
    session_id      UUID        NOT NULL,
    content_type    TEXT        NOT NULL CHECK (content_type IN ('job', 'contest')),
    content_id      UUID        NOT NULL,
    traffic_source  TEXT        NOT NULL DEFAULT 'direct',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Every dashboard query is "within a date range", usually "grouped by source".
CREATE INDEX IF NOT EXISTS idx_page_view_created_at
    ON page_view (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_page_view_source_created_at
    ON page_view (traffic_source, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_page_view_visitor
    ON page_view (visitor_id);

CREATE INDEX IF NOT EXISTS idx_apply_click_created_at
    ON apply_click (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_apply_click_source_created_at
    ON apply_click (traffic_source, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_apply_click_visitor
    ON apply_click (visitor_id);
CREATE INDEX IF NOT EXISTS idx_apply_click_content
    ON apply_click (content_type, content_id);
