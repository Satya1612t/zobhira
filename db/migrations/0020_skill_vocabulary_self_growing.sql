-- Moves the skill vocabulary out of source code and into the database, so it
-- can grow from scraped descriptions and from what users actually search for
-- — without a deploy, and without anyone hand-editing a Python dict forever.
--
-- This also removes the drift hazard flagged in 0019's rollout: previously the
-- vocabulary existed twice (skill_vocab.py for the writer, skillVocab.ts for
-- the reader) and if the two copies disagreed the skills filter silently
-- returned nothing. Now both read the same tables. There is only one copy.
--
-- SCOPE GUARD — read before extending: these tables hold SKILLS ONLY.
-- Not designations, not employment types, not locations, not company names,
-- not degrees. The mining job is aggressive enough that without that rule the
-- vocabulary fills with "Bangalore", "Immediate Joiner" and "B.Tech" within
-- one run, and then every job in the database gets tagged with them. The
-- blocklist below is load-bearing, not decorative.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. The live vocabulary
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS skills (
    canonical        TEXT PRIMARY KEY,
    normalized       TEXT NOT NULL UNIQUE,
    -- 'seed'   : came from utils/skill_vocab.py's SEED_SKILL_ALIASES
    -- 'mined'  : discovered in scraped job descriptions
    -- 'query'  : discovered from user skill searches
    -- 'manual' : added by an admin
    origin           TEXT NOT NULL DEFAULT 'seed',
    -- 'active'  : usable for tagging and filtering
    -- 'blocked' : explicitly rejected; keeps the miner from re-proposing it
    status           TEXT NOT NULL DEFAULT 'active',
    -- Excluded from free-text scanning but still resolvable when a SOURCE
    -- hands us the tag explicitly. See skill_vocab.py's notes on why "REST",
    -- "Spring" and "Excel" cannot be matched as bare words.
    ambiguous        BOOLEAN NOT NULL DEFAULT false,
    -- Corroborating terms required in the same text before this counts.
    -- Lets high-value-but-ambiguous skills stay usable: "Swift" only tags a
    -- posting that also mentions iOS/Xcode/SwiftUI.
    context_required TEXT[] NOT NULL DEFAULT '{}',
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT skills_status_check CHECK (status IN ('active', 'blocked')),
    CONSTRAINT skills_origin_check CHECK (origin IN ('seed', 'mined', 'query', 'manual'))
);

CREATE INDEX IF NOT EXISTS idx_skills_active ON skills (normalized) WHERE status = 'active';

-- ---------------------------------------------------------------------------
-- 2. Alias spellings
-- ---------------------------------------------------------------------------
-- Keyed on the NORMALIZED alias, because that is what both the tagger and the
-- user-query expander look up. "ReactJS", "React.js" and "React JS" all
-- normalize to "reactjs" and collapse to one row.
CREATE TABLE IF NOT EXISTS skill_aliases (
    normalized  TEXT PRIMARY KEY,
    display     TEXT NOT NULL,
    canonical   TEXT NOT NULL REFERENCES skills(canonical) ON DELETE CASCADE,
    origin      TEXT NOT NULL DEFAULT 'seed',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_skill_aliases_canonical ON skill_aliases (canonical);

-- ---------------------------------------------------------------------------
-- 3. The review queue
-- ---------------------------------------------------------------------------
-- Everything the miner finds lands here first. Nothing enters `skills`
-- directly from mining without clearing the promotion thresholds in
-- scripts/mine_skills.py.
--
-- company_count is the important column, not doc_count. A term appearing 400
-- times across 3 companies is that company's internal jargon or a boilerplate
-- footer; a term appearing 40 times across 30 companies is a real skill. Any
-- promotion rule keyed on raw frequency alone will promote boilerplate.
CREATE TABLE IF NOT EXISTS skill_candidates (
    normalized       TEXT PRIMARY KEY,
    display          TEXT NOT NULL,
    doc_count        INTEGER NOT NULL DEFAULT 0,
    company_count    INTEGER NOT NULL DEFAULT 0,
    query_count      INTEGER NOT NULL DEFAULT 0,
    -- Set when the term looks like a new spelling of something we already
    -- know ("react js" -> "React"). Those are promoted as ALIASES, which is
    -- far lower risk than creating a new canonical entry.
    suggested_alias_of TEXT REFERENCES skills(canonical) ON DELETE SET NULL,
    similarity       REAL,
    sample_contexts  TEXT[] NOT NULL DEFAULT '{}',
    status           TEXT NOT NULL DEFAULT 'pending',
    first_seen_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_seen_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    reviewed_at      TIMESTAMPTZ,
    CONSTRAINT skill_candidates_status_check
        CHECK (status IN ('pending', 'promoted', 'rejected'))
);

CREATE INDEX IF NOT EXISTS idx_skill_candidates_pending
    ON skill_candidates (company_count DESC, doc_count DESC) WHERE status = 'pending';

-- ---------------------------------------------------------------------------
-- 4. Zero-result skill searches
-- ---------------------------------------------------------------------------
-- The single highest-signal source of missing vocabulary: a user typed a skill
-- into the filter and got nothing back.
--
-- Two very different causes, and the miner MUST distinguish them:
--   (a) the term exists in job descriptions but not in the vocabulary
--       -> a vocabulary gap. Promote it.
--   (b) the term appears in no description at all
--       -> not a vocabulary gap. It is unmet demand: users want a skill you
--          have no inventory for. Adding it to the vocabulary changes
--          nothing; what it should do is feed scheduler query planning.
-- Conflating the two quietly fills the vocabulary with terms that can never
-- match anything.
CREATE TABLE IF NOT EXISTS skill_query_misses (
    normalized     TEXT PRIMARY KEY,
    display        TEXT NOT NULL,
    miss_count     INTEGER NOT NULL DEFAULT 1,
    first_seen_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_seen_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_skill_query_misses_count ON skill_query_misses (miss_count DESC);

-- ---------------------------------------------------------------------------
-- 5. Blocklist — the thing that keeps the vocabulary clean
-- ---------------------------------------------------------------------------
-- Seeded with the categories that dominate raw n-gram output from Indian job
-- descriptions. Without these, one mining run tags every posting with
-- "Bangalore" and "Immediate Joiner".
CREATE TABLE IF NOT EXISTS skill_blocklist (
    normalized  TEXT PRIMARY KEY,
    reason      TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO skill_blocklist (normalized, reason) VALUES
    -- locations
    ('bangalore','location'), ('bengaluru','location'), ('mumbai','location'),
    ('delhi','location'), ('pune','location'), ('hyderabad','location'),
    ('chennai','location'), ('kolkata','location'), ('noida','location'),
    ('gurgaon','location'), ('gurugram','location'), ('india','location'),
    ('remote','location'), ('onsite','location'), ('hybrid','location'),
    -- qualifications (belong in the education field, not skills)
    ('btech','degree'), ('be','degree'), ('bsc','degree'), ('bca','degree'),
    ('mtech','degree'), ('msc','degree'), ('mca','degree'), ('mba','degree'),
    ('phd','degree'), ('graduate','degree'), ('postgraduate','degree'),
    ('bachelors','degree'), ('masters','degree'), ('diploma','degree'),
    -- HR / posting boilerplate
    ('immediatejoiner','boilerplate'), ('noticeperiod','boilerplate'),
    ('workfromhome','boilerplate'), ('fulltime','boilerplate'),
    ('parttime','boilerplate'), ('internship','boilerplate'),
    ('jobdescription','boilerplate'), ('rolesandresponsibilities','boilerplate'),
    ('equalopportunity','boilerplate'), ('salary','boilerplate'),
    ('ctc','boilerplate'), ('lpa','boilerplate'), ('stipend','boilerplate'),
    ('experience','boilerplate'), ('responsibilities','boilerplate'),
    ('requirements','boilerplate'), ('qualifications','boilerplate'),
    ('candidate','boilerplate'), ('applicant','boilerplate'),
    ('company','boilerplate'), ('team','boilerplate'), ('client','boilerplate'),
    ('years','boilerplate'), ('freshers','boilerplate'), ('walkin','boilerplate'),
    -- generic soft-skill noise: real, but useless as a filter facet because
    -- it appears in essentially every posting
    ('communication','toogeneric'), ('communicationskills','toogeneric'),
    ('teamwork','toogeneric'), ('problemsolving','toogeneric'),
    ('leadership','toogeneric'), ('timemanagement','toogeneric'),
    ('interpersonalskills','toogeneric'), ('selfmotivated','toogeneric'),
    ('detailoriented','toogeneric'), ('fastpaced','toogeneric'),
    ('goodcommunication','toogeneric'), ('english','toogeneric')
ON CONFLICT (normalized) DO NOTHING;

COMMIT;
