-- Accounts & profiles. Identity (uid, password, reset, email verification,
-- Google sign-in) lives in Firebase; Postgres owns everything else and joins
-- to it by firebase_uid. Postgres NEVER stores a password.
--
-- Resume-shaped sections (education/experience/projects/achievements) are
-- jsonb, not tables: they're repeatable, free-shaped, and only ever read as a
-- whole to render a resume. Skills are the exception — they're a join table so
-- profile skills share the canonical vocabulary the job search already uses
-- (skills.canonical), which is what makes "match this user to this job"
-- possible later.

CREATE TABLE IF NOT EXISTS users (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    firebase_uid   TEXT NOT NULL UNIQUE,
    email          TEXT NOT NULL UNIQUE,   -- stored lowercased (Firebase is case-insensitive)
    full_name      TEXT,
    phone          TEXT,
    city           TEXT,
    email_verified BOOLEAN NOT NULL DEFAULT false,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_login_at  TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS user_profiles (
    -- One row per user, created lazily on first save.
    user_id        UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    headline       TEXT,
    summary        TEXT,
    links          JSONB NOT NULL DEFAULT '{}'::jsonb,   -- { github, linkedin, portfolio }
    education      JSONB NOT NULL DEFAULT '[]'::jsonb,
    experience     JSONB NOT NULL DEFAULT '[]'::jsonb,
    projects       JSONB NOT NULL DEFAULT '[]'::jsonb,
    achievements   JSONB NOT NULL DEFAULT '[]'::jsonb,
    -- jsonb has no migrations; this is how we know which rows need upgrading
    -- when an entry's shape changes.
    schema_version INTEGER NOT NULL DEFAULT 1,
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_skills (
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    -- Reuses the canonical vocabulary (db/migrations/0020) rather than forking
    -- it with free text — unknown input is routed through the existing
    -- miss-recording path at write time, not stored raw here.
    canonical   TEXT NOT NULL REFERENCES skills(canonical) ON DELETE CASCADE,
    proficiency TEXT,
    PRIMARY KEY (user_id, canonical)
);
CREATE INDEX IF NOT EXISTS idx_user_skills_canonical ON user_skills (canonical);
