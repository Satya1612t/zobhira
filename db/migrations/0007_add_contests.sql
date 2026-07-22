CREATE TABLE IF NOT EXISTS contests (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dedup_key         TEXT NOT NULL UNIQUE,
    title             TEXT NOT NULL,
    platform          TEXT NOT NULL,
    organizer         TEXT,
    mode              TEXT NOT NULL DEFAULT 'unknown'
                          CHECK (mode IN ('online', 'hybrid', 'in_person', 'unknown')),
    prize_amount      NUMERIC,
    prize_currency    TEXT,
    prize_summary     TEXT,
    source            TEXT NOT NULL,
    source_url        TEXT NOT NULL,
    description       TEXT,
    tags              TEXT[] NOT NULL DEFAULT '{}',
    starts_at         TIMESTAMPTZ,
    deadline_at       TIMESTAMPTZ,
    first_seen_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_scraped_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    is_active         BOOLEAN NOT NULL DEFAULT true,
    extraction_method TEXT NOT NULL DEFAULT 'deterministic'
                          CHECK (extraction_method IN ('deterministic', 'llm')),
    logo_url          TEXT,
    raw               JSONB
);

CREATE INDEX IF NOT EXISTS idx_contests_source ON contests (source);
CREATE INDEX IF NOT EXISTS idx_contests_deadline ON contests (deadline_at);
CREATE INDEX IF NOT EXISTS idx_contests_tags ON contests USING gin (tags);
CREATE INDEX IF NOT EXISTS idx_contests_title_trgm ON contests USING gin (title gin_trgm_ops);
