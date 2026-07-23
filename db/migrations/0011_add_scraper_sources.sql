CREATE TABLE IF NOT EXISTS scraper_sources (
    name           TEXT PRIMARY KEY,
    family         TEXT NOT NULL CHECK (family IN ('job', 'contest')),
    enabled        BOOLEAN NOT NULL DEFAULT true,
    last_error     TEXT,
    last_error_at  TIMESTAMPTZ
);

INSERT INTO scraper_sources (name, family) VALUES
    ('linkedin', 'job'),
    ('talentd', 'job'),
    ('remoteok', 'job'),
    ('ycombinator', 'job'),
    ('dev_community', 'contest')
ON CONFLICT (name) DO NOTHING;
