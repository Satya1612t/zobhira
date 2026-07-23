import os

import psycopg
from psycopg.rows import dict_row

from scrapers.base import JobPosting
from scrapers.contest_base import ContestPosting
from utils.dedup import make_contest_dedup_key, make_dedup_key

_UPSERT_SQL = """
INSERT INTO jobs (
    dedup_key, title, company, location, workplace_type,
    salary_min, salary_max, salary_currency,
    source, source_url, description, tags, posted_at, deadline_at, logo_url,
    last_scraped_at, is_active, extraction_method, raw
)
VALUES (
    %(dedup_key)s, %(title)s, %(company)s, %(location)s, %(workplace_type)s,
    %(salary_min)s, %(salary_max)s, %(salary_currency)s,
    %(source)s, %(source_url)s, %(description)s, %(tags)s, %(posted_at)s, %(deadline_at)s, %(logo_url)s,
    now(), true, %(extraction_method)s, %(raw)s
)
ON CONFLICT (dedup_key) DO UPDATE SET
    last_scraped_at = now(),
    is_active = true,
    title = EXCLUDED.title,
    location = EXCLUDED.location,
    workplace_type = EXCLUDED.workplace_type,
    salary_min = EXCLUDED.salary_min,
    salary_max = EXCLUDED.salary_max,
    salary_currency = EXCLUDED.salary_currency,
    description = EXCLUDED.description,
    tags = EXCLUDED.tags,
    posted_at = EXCLUDED.posted_at,
    deadline_at = EXCLUDED.deadline_at,
    logo_url = EXCLUDED.logo_url,
    extraction_method = EXCLUDED.extraction_method,
    raw = EXCLUDED.raw;
"""

_EXISTS_BY_DEDUP_KEY_SQL = "SELECT EXISTS (SELECT 1 FROM jobs WHERE dedup_key = %(dedup_key)s) AS found;"

# Trigram similarity against the title of active jobs from the same
# company — catches near-duplicates that don't share an exact dedup_key
# (slightly different title wording, punctuation, location formatting)
# without needing an exact match. Company match keeps this from firing
# across unrelated companies that happen to post similarly-worded roles.
_SIMILAR_EXISTS_SQL = """
SELECT EXISTS (
    SELECT 1 FROM jobs
    WHERE is_active = true
      AND lower(company) = lower(%(company)s)
      AND similarity(title, %(title)s) > 0.6
) AS found;
"""

_MARK_STALE_SQL = """
UPDATE jobs
SET is_active = false
WHERE source = %(source)s
  AND last_scraped_at < %(cutoff)s
  AND is_active = true;
"""

_REAP_STALE_SQL = """
UPDATE jobs
SET is_active = false
WHERE last_scraped_at < %(cutoff)s
  AND is_active = true;
"""

_REAP_EXPIRED_SQL = """
UPDATE jobs
SET is_active = false
WHERE is_active = true
  AND (
    (deadline_at IS NOT NULL AND deadline_at < now())
    OR (deadline_at IS NULL AND first_seen_at < %(default_cutoff)s)
  );
"""


def connect() -> psycopg.Connection:
    database_url = os.environ["DATABASE_URL"]
    return psycopg.connect(database_url, row_factory=dict_row)


def upsert_job(conn: psycopg.Connection, posting: JobPosting) -> bool:
    """Returns True if the posting was actually written (a fresh insert, or
    an update to its own existing row via dedup_key), False if it was
    skipped as a near-duplicate of a different existing row (see
    _SIMILAR_EXISTS_SQL) — the exact-match case (same dedup_key) always
    proceeds, since that's just this same posting being refreshed, not a
    new row to dedup against anything.

    Does not commit — callers upsert many postings per connection in a
    loop (one query's worth, or a whole scheduled sweep), and committing
    once per row means one fsync per row, which dominates wall-clock time
    at the volumes this app writes (hundreds of postings per scheduled
    run). Callers must call `conn.commit()` themselves after their loop —
    see `run_source()` and `api.py::_upsert_all()`."""
    dedup_key = make_dedup_key(posting.company, posting.title, posting.location)
    with conn.cursor() as cur:
        cur.execute(_EXISTS_BY_DEDUP_KEY_SQL, {"dedup_key": dedup_key})
        already_exists = cur.fetchone()["found"]

        if not already_exists:
            cur.execute(_SIMILAR_EXISTS_SQL, {"company": posting.company, "title": posting.title})
            if cur.fetchone()["found"]:
                return False

        cur.execute(
            _UPSERT_SQL,
            {
                "dedup_key": dedup_key,
                "title": posting.title,
                "company": posting.company,
                "location": posting.location,
                "workplace_type": posting.workplace_type,
                "salary_min": posting.salary_min,
                "salary_max": posting.salary_max,
                "salary_currency": posting.salary_currency,
                "source": posting.source,
                "source_url": posting.source_url,
                "description": posting.description,
                "tags": posting.tags,
                "posted_at": posting.posted_at,
                "deadline_at": posting.deadline_at,
                "logo_url": posting.logo_url,
                "extraction_method": posting.extraction_method,
                "raw": psycopg.types.json.Json(posting.raw),
            },
        )
    return True


def mark_stale_inactive(conn: psycopg.Connection, source: str, cutoff) -> None:
    with conn.cursor() as cur:
        cur.execute(_MARK_STALE_SQL, {"source": source, "cutoff": cutoff})
    conn.commit()


def reap_stale(conn: psycopg.Connection, cutoff) -> int:
    """Source-agnostic sweep: deactivates any job not touched by any scrape
    since `cutoff`, regardless of source. Unlike `mark_stale_inactive`
    (which only fires per-source on a full CLI re-scrape of that exact
    source), this is what keeps live-search-injected rows from lingering
    forever, since live search never marks a source stale
    (`run_source(..., mark_stale=False)`)."""
    with conn.cursor() as cur:
        cur.execute(_REAP_STALE_SQL, {"cutoff": cutoff})
        affected = cur.rowcount
    conn.commit()
    return affected


def reap_expired(conn: psycopg.Connection, default_cutoff) -> int:
    """Deadline-aware expiry, distinct from `reap_stale` above: a job that
    keeps matching one of the scheduler's designations every cycle has its
    `last_scraped_at` continuously refreshed, so `reap_stale` alone would
    never age it out. This enforces a hard cap instead — a listing's own
    `deadline_at` if the source provided one, otherwise `default_cutoff`
    (30 days from `first_seen_at`, passed in by the caller)."""
    with conn.cursor() as cur:
        cur.execute(_REAP_EXPIRED_SQL, {"default_cutoff": default_cutoff})
        affected = cur.rowcount
    conn.commit()
    return affected


_UPSERT_CONTEST_SQL = """
INSERT INTO contests (
    dedup_key, title, platform, organizer, mode,
    prize_amount, prize_currency, prize_summary,
    source, source_url, description, summary, highlights, tags,
    starts_at, deadline_at, logo_url,
    last_scraped_at, is_active, extraction_method, raw
)
VALUES (
    %(dedup_key)s, %(title)s, %(platform)s, %(organizer)s, %(mode)s,
    %(prize_amount)s, %(prize_currency)s, %(prize_summary)s,
    %(source)s, %(source_url)s, %(description)s, %(summary)s, %(highlights)s, %(tags)s,
    %(starts_at)s, %(deadline_at)s, %(logo_url)s,
    now(), true, %(extraction_method)s, %(raw)s
)
ON CONFLICT (dedup_key) DO UPDATE SET
    last_scraped_at = now(),
    is_active = true,
    title = EXCLUDED.title,
    organizer = EXCLUDED.organizer,
    mode = EXCLUDED.mode,
    prize_amount = EXCLUDED.prize_amount,
    prize_currency = EXCLUDED.prize_currency,
    prize_summary = EXCLUDED.prize_summary,
    description = EXCLUDED.description,
    -- LLM summarization is more failure-prone than the rest of a feed's
    -- structured fields (transient provider hiccups, parse errors) — a
    -- failed re-scrape's NULL/empty result must not erase a previously
    -- good summary/highlights, unlike every other column here which just
    -- always takes the freshest value.
    summary = COALESCE(EXCLUDED.summary, contests.summary),
    highlights = COALESCE(NULLIF(EXCLUDED.highlights, '{}'), contests.highlights),
    tags = EXCLUDED.tags,
    starts_at = EXCLUDED.starts_at,
    deadline_at = EXCLUDED.deadline_at,
    logo_url = EXCLUDED.logo_url,
    extraction_method = EXCLUDED.extraction_method,
    raw = EXCLUDED.raw;
"""

_MARK_STALE_CONTESTS_SQL = """
UPDATE contests
SET is_active = false
WHERE source = %(source)s
  AND last_scraped_at < %(cutoff)s
  AND is_active = true;
"""

_REAP_STALE_CONTESTS_SQL = """
UPDATE contests
SET is_active = false
WHERE last_scraped_at < %(cutoff)s
  AND is_active = true;
"""

_REAP_EXPIRED_CONTESTS_SQL = """
DELETE FROM contests
WHERE (deadline_at IS NOT NULL AND deadline_at < now())
   OR (deadline_at IS NULL AND first_seen_at < %(default_cutoff)s);
"""


def upsert_contest(conn: psycopg.Connection, posting: ContestPosting) -> bool:
    """Same shape as upsert_job, but no fuzzy trigram fallback — contests
    dedup on an exact (platform, source_url) match (see
    utils/dedup.py::make_contest_dedup_key), since one canonical URL exists
    per contest per platform, unlike jobs which get re-posted with
    slightly different wording across many boards. Does not commit —
    callers upsert many postings per connection then commit once, same
    reasoning as upsert_job."""
    dedup_key = make_contest_dedup_key(posting.platform, posting.source_url)
    with conn.cursor() as cur:
        cur.execute(
            _UPSERT_CONTEST_SQL,
            {
                "dedup_key": dedup_key,
                "title": posting.title,
                "platform": posting.platform,
                "organizer": posting.organizer,
                "mode": posting.mode,
                "prize_amount": posting.prize_amount,
                "prize_currency": posting.prize_currency,
                "prize_summary": posting.prize_summary,
                "source": posting.source,
                "source_url": posting.source_url,
                "description": posting.description,
                "summary": posting.summary,
                "highlights": posting.highlights,
                "tags": posting.tags,
                "starts_at": posting.starts_at,
                "deadline_at": posting.deadline_at,
                "logo_url": posting.logo_url,
                "extraction_method": posting.extraction_method,
                "raw": psycopg.types.json.Json(posting.raw),
            },
        )
    return True


def mark_stale_inactive_contests(conn: psycopg.Connection, source: str, cutoff) -> None:
    with conn.cursor() as cur:
        cur.execute(_MARK_STALE_CONTESTS_SQL, {"source": source, "cutoff": cutoff})
    conn.commit()


def reap_stale_contests(conn: psycopg.Connection, cutoff) -> int:
    with conn.cursor() as cur:
        cur.execute(_REAP_STALE_CONTESTS_SQL, {"cutoff": cutoff})
        affected = cur.rowcount
    conn.commit()
    return affected


def reap_expired_contests(conn: psycopg.Connection, default_cutoff) -> int:
    """Contests are inherently deadline-driven, more so than jobs — this is
    the single most load-bearing cleanup function for this table.

    Unlike reap_expired (jobs), this DELETEs the row rather than flipping
    is_active — a past-deadline contest has no reason to be kept around at
    all (nothing left to register for, ever), whereas a stale job might
    still be worth surfacing in "closed roles" contexts. Cutoff: a
    contest's own deadline_at if the source (or the LLM gap-fill in
    run_contest_scrape.py) provided one, otherwise default_cutoff (days
    from first_seen_at) for contests with no knowable deadline at all."""
    with conn.cursor() as cur:
        cur.execute(_REAP_EXPIRED_CONTESTS_SQL, {"default_cutoff": default_cutoff})
        affected = cur.rowcount
    conn.commit()
    return affected


def get_recent_searches(conn: psycopg.Connection, limit: int = 12) -> list[str]:
    """Reads the same `search_queries` table the Next.js app writes to
    (apps/web/src/lib/jobQuery.ts::recordSearch) — same Postgres database,
    so no API call back to the web app is needed. Powers the scheduler's
    recent-searches LinkedIn sweep (see scheduler.py)."""
    with conn.cursor() as cur:
        cur.execute(
            "SELECT query FROM search_queries ORDER BY last_searched_at DESC LIMIT %(limit)s",
            {"limit": limit},
        )
        return [row["query"] for row in cur.fetchall()]


def get_job(conn: psycopg.Connection, job_id: str) -> dict | None:
    """Single-row lookup for the on-demand description-formatting endpoint
    (api.py::format_job_description_endpoint) — unlike every other query
    in this file, this is called synchronously from a live HTTP request
    (one job at a time), not a batch scrape."""
    with conn.cursor() as cur:
        cur.execute(
            "SELECT id, description, formatted_description, highlights FROM jobs WHERE id = %(id)s",
            {"id": job_id},
        )
        return cur.fetchone()


def update_job_formatting(
    conn: psycopg.Connection, job_id: str, formatted_description: str | None, highlights: list[str]
) -> None:
    """Commits itself — this is a single-row on-demand write from a live
    request, not part of a batch upsert loop, so there's no shared
    transaction to defer to."""
    with conn.cursor() as cur:
        cur.execute(
            "UPDATE jobs SET formatted_description = %(formatted_description)s, highlights = %(highlights)s WHERE id = %(id)s",
            {"formatted_description": formatted_description, "highlights": highlights, "id": job_id},
        )
    conn.commit()


def get_enabled_sources(conn: psycopg.Connection, family: str) -> set[str]:
    """Reads the same `scraper_sources` table the admin panel writes to
    (apps/web/src/app/api/admin/sources/[name]/route.ts) — same Postgres
    database, no API call back to the web app needed, same
    cross-language-shared-table pattern as get_recent_searches above.
    Every real source has a seeded row (db/migrations/0011); a source with
    no row at all simply won't appear in the returned set (callers should
    add a migration row for any new source, not rely on a missing-row
    default)."""
    with conn.cursor() as cur:
        cur.execute(
            "SELECT name FROM scraper_sources WHERE family = %(family)s AND enabled = true",
            {"family": family},
        )
        return {row["name"] for row in cur.fetchall()}


def record_source_error(conn: psycopg.Connection, source: str, error: str) -> None:
    """Best-effort — overwrites with the most recent failure, not an
    accumulating log. Commits itself since this is called from inside a
    per-source except block, not a shared batch transaction."""
    with conn.cursor() as cur:
        cur.execute(
            "UPDATE scraper_sources SET last_error = %(error)s, last_error_at = now() WHERE name = %(source)s",
            {"error": error[:2000], "source": source},
        )
    conn.commit()
