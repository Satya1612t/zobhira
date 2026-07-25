-- Himalayas.app: remote-only job board, free public JSON search API, no
-- auth. Promotes employment_type/seniority out of `raw` into real columns
-- since Himalayas' API returns both as clean, structured fields on every
-- posting (unlike other sources where this is inconsistently present or
-- buried in free text).
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS employment_type TEXT;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS seniority TEXT;

INSERT INTO scraper_sources (name, family) VALUES
    ('himalayas', 'job')
ON CONFLICT (name) DO NOTHING;
