CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE IF NOT EXISTS jobs (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dedup_key         TEXT NOT NULL UNIQUE,
    title             TEXT NOT NULL,
    company           TEXT NOT NULL,
    location          TEXT,
    workplace_type    TEXT NOT NULL DEFAULT 'unknown'
                          CHECK (workplace_type IN ('remote', 'hybrid', 'onsite', 'unknown')),
    salary_min        NUMERIC,
    salary_max        NUMERIC,
    salary_currency   TEXT,
    source            TEXT NOT NULL,
    source_url        TEXT NOT NULL,
    description       TEXT,
    tags              TEXT[] NOT NULL DEFAULT '{}',
    posted_at         TIMESTAMPTZ,
    first_seen_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_scraped_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    is_active         BOOLEAN NOT NULL DEFAULT true,
    extraction_method TEXT NOT NULL DEFAULT 'deterministic'
                          CHECK (extraction_method IN ('deterministic', 'llm')),
    raw               JSONB
);

CREATE INDEX IF NOT EXISTS idx_jobs_source ON jobs (source);
CREATE INDEX IF NOT EXISTS idx_jobs_title_trgm ON jobs USING gin (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_jobs_location ON jobs (location);
CREATE INDEX IF NOT EXISTS idx_jobs_posted_at ON jobs (posted_at DESC);
