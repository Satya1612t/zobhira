-- Caches company-name -> domain resolutions from Clearbit's autocomplete
-- API (see services/scraper/utils/logo_lookup.py), so the same company
-- (e.g. "Google", "Amazon") doesn't get re-queried from every scraper
-- process run — only the first time it's ever seen. `domain` may be NULL,
-- meaning "looked up, nothing found" (negative caching) — the company still
-- counts as resolved, just has no logo, so it isn't queried again either.
CREATE TABLE IF NOT EXISTS company_domains (
    company      TEXT PRIMARY KEY,
    domain       TEXT,
    resolved_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
