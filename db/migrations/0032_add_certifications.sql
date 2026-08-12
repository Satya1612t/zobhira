-- Certifications: a small, hand-curated catalogue (~200-300 rows at most),
-- NOT an ingested feed. There is deliberately no scraper/scheduler for this
-- table — the whole value proposition is that a human picked these. Rows
-- arrive via scripts/seed_certifications.py (from db/seeds/certifications.csv)
-- or the admin UI, and are edited in place afterwards.

CREATE TABLE IF NOT EXISTS certifications (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Stable human-authored identifier; also the public URL segment
    -- (/certifications/{slug}). Never regenerate these after launch — an
    -- existing slug is a live URL and changing it breaks SEO.
    slug              TEXT NOT NULL UNIQUE,

    title             TEXT NOT NULL,
    provider          TEXT NOT NULL,             -- 'AWS', 'NPTEL', 'Scaler'
    provider_slug     TEXT NOT NULL,             -- 'aws', 'nptel', 'scaler'
    provider_logo_url TEXT,

    -- Free-text one-liner shown on the card, and a longer body for the
    -- detail page. Both written in our own words — never pasted from the
    -- provider's marketing copy (duplicate content is an SEO penalty, and
    -- it's their copyright).
    summary           TEXT,
    description       TEXT,
    -- Short bullet facts ("No prior experience needed", "Recognised by
    -- Indian recruiters"). Same shape as contests.highlights.
    highlights        TEXT[] NOT NULL DEFAULT '{}',

    category          TEXT NOT NULL,             -- 'cloud', 'data', 'web', ...
    tags              TEXT[] NOT NULL DEFAULT '{}',
    level             TEXT NOT NULL DEFAULT 'beginner'
                          CHECK (level IN ('beginner', 'intermediate', 'advanced')),

    -- THE filter that matters most to a student with no money:
    --   free      — learn AND certify at no cost
    --   freemium  — learn free, pay only for the certificate/exam (NPTEL,
    --               Coursera audit track). This is its own bucket on purpose;
    --               lumping it under 'paid' hides genuinely accessible options
    --               and lumping it under 'free' is a lie the student finds out
    --               about at checkout.
    --   paid      — costs money to start
    price_type        TEXT NOT NULL DEFAULT 'free'
                          CHECK (price_type IN ('free', 'freemium', 'paid')),
    price_amount      NUMERIC,                   -- NULL for 'free'
    price_currency    TEXT DEFAULT 'INR',
    duration_hours    INTEGER,

    -- Two links, deliberately. `url` is the plain public link and always
    -- works. `affiliate_url` starts NULL and gets filled in months later,
    -- once a network approves us — at which point nothing else changes.
    -- The app always prefers affiliate_url and falls back to url, so the
    -- feature ships and earns without a second deploy.
    url               TEXT NOT NULL,
    affiliate_url     TEXT,
    affiliate_network TEXT,                      -- 'impact', 'cuelinks', 'direct'

    -- Same draft/published gate as the contest review queue — a seeded row
    -- is never live until someone has actually looked at it.
    publish_status    TEXT NOT NULL DEFAULT 'draft'
                          CHECK (publish_status IN ('draft', 'published', 'archived')),
    published_at      TIMESTAMPTZ,

    -- Prices and course pages go stale. `verified_at` is when a human last
    -- confirmed the price/URL were still correct; the admin list sorts by
    -- it so the most rotten rows surface first. NULL = never checked.
    verified_at       TIMESTAMPTZ,
    verified_by       TEXT,

    is_featured       BOOLEAN NOT NULL DEFAULT false,
    display_order     INTEGER NOT NULL DEFAULT 100,

    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_certifications_public
    ON certifications (publish_status, display_order, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_certifications_category
    ON certifications (category);
CREATE INDEX IF NOT EXISTS idx_certifications_price_type
    ON certifications (price_type);
CREATE INDEX IF NOT EXISTS idx_certifications_provider
    ON certifications (provider_slug);
CREATE INDEX IF NOT EXISTS idx_certifications_tags
    ON certifications USING gin (tags);
CREATE INDEX IF NOT EXISTS idx_certifications_title_trgm
    ON certifications USING gin (title gin_trgm_ops);
-- Stalest-first review queue: rows never verified sort ahead of old ones.
CREATE INDEX IF NOT EXISTS idx_certifications_verified
    ON certifications (verified_at NULLS FIRST);


-- Outbound click tracking, deliberately a near-copy of apply_click (0021)
-- rather than an extra content_type on it: apply_click is read by the
-- admin analytics dashboard as "job/contest engagement" and mixing a
-- monetised partner click into that number would quietly corrupt it.
--
-- This table is also the negotiating lever. When we email Scaler asking for
-- a better rate, "we sent you 400 clicks from job-seeking students last
-- month" is the argument, and this is where that number comes from.
CREATE TABLE IF NOT EXISTS partner_click (
    id                BIGSERIAL PRIMARY KEY,
    visitor_id        UUID        NOT NULL,
    session_id        UUID        NOT NULL,
    certification_id  UUID        NOT NULL REFERENCES certifications(id) ON DELETE CASCADE,
    -- Snapshotted, not joined: we need to know what the click was worth at
    -- the time even if the row is later re-priced or the deal changes.
    provider_slug     TEXT        NOT NULL,
    affiliate_network TEXT,
    is_monetised      BOOLEAN     NOT NULL DEFAULT false,
    -- Where the VISITOR came from (instagram/google/direct) — the same
    -- meaning as apply_click.traffic_source. Never confused with where the
    -- listing came from.
    traffic_source    TEXT        NOT NULL DEFAULT 'direct',
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_partner_click_created_at
    ON partner_click (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_partner_click_certification
    ON partner_click (certification_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_partner_click_provider
    ON partner_click (provider_slug, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_partner_click_source
    ON partner_click (traffic_source, created_at DESC);
