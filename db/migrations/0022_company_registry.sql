-- v2 feed layer. Maps a company to its hiring-software board so the feed
-- connectors know which endpoint to call. Independent of company_domains
-- (0013), which caches logo lookups only.
CREATE TABLE IF NOT EXISTS company_registry (
    id            BIGSERIAL PRIMARY KEY,
    name          TEXT NOT NULL,
    slug          TEXT NOT NULL UNIQUE,
    ats_provider  TEXT NOT NULL
                     CHECK (ats_provider IN ('greenhouse','lever','ashby',
                                             'workable','smartrecruiters','recruitee')),
    ats_token     TEXT NOT NULL,
    careers_url   TEXT,
    country_hint  TEXT NOT NULL DEFAULT 'IN',
    tier          SMALLINT NOT NULL DEFAULT 2 CHECK (tier BETWEEN 1 AND 3),
    is_active     BOOLEAN NOT NULL DEFAULT true,
    last_ok_at    TIMESTAMPTZ,
    last_error    TEXT,
    fail_streak   INT NOT NULL DEFAULT 0,
    etag          TEXT,
    last_modified TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (ats_provider, ats_token)
);

CREATE INDEX IF NOT EXISTS idx_registry_active_tier
    ON company_registry (tier, last_ok_at NULLS FIRST) WHERE is_active;
