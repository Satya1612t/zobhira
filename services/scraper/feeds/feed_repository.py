"""v2's own upsert — db/repository.py is frozen (see feeds/feed_base.py's
module docstring for why v2 keeps a fully separate code path). Writes to
the same `jobs` table, using the same `dedup_key` identity (so a feed row
and a v1-scraped row for the real same job still merge onto one row — see
the plan's §8.1), plus the three feed-only columns from
db/migrations/0023_job_feed_columns.sql.
"""

from __future__ import annotations

import psycopg
from psycopg.rows import dict_row

from scripts.run_scrape import has_mandatory_fields
from utils.dedup import make_dedup_key

from .feed_base import FeedJobPosting

_UPSERT_FEED_JOB_SQL = """
INSERT INTO jobs (
    dedup_key, title, company, location, workplace_type,
    salary_min, salary_max, salary_currency,
    source, source_url, apply_url, external_id, company_id,
    description, tags, posted_at, deadline_at, logo_url,
    last_scraped_at, is_active, extraction_method, employment_type, seniority, raw,
    min_years_exp, max_years_exp, experience_band, exp_source, tags_norm, field_provenance, enrichment_hash, enriched_at,
    formatted_description, highlights
)
VALUES (
    %(dedup_key)s, %(title)s, %(company)s, %(location)s, %(workplace_type)s,
    %(salary_min)s, %(salary_max)s, %(salary_currency)s,
    %(source)s, %(source_url)s, %(apply_url)s, %(external_id)s, %(company_id)s,
    %(description)s, %(tags)s, %(posted_at)s, %(deadline_at)s, %(logo_url)s,
    now(), true, %(extraction_method)s, %(employment_type)s, %(seniority)s, %(raw)s,
    %(min_years_exp)s, %(max_years_exp)s, %(experience_band)s, %(exp_source)s, %(tags_norm)s, %(field_provenance)s, %(enrichment_hash)s, now(),
    %(formatted_description)s, %(highlights)s
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
    -- A feed re-poll always carries the full board response, unlike v1's
    -- re-scrape which can skip a already-enriched job's detail pass — so
    -- unlike db/repository.py's upsert_job, there is no COALESCE-against-
    -- stale-skip concern here: every field below is always fresh.
    apply_url = EXCLUDED.apply_url,
    external_id = EXCLUDED.external_id,
    company_id = EXCLUDED.company_id,
    employment_type = COALESCE(EXCLUDED.employment_type, jobs.employment_type),
    seniority = COALESCE(EXCLUDED.seniority, jobs.seniority),
    description = COALESCE(EXCLUDED.description, jobs.description),
    tags = CASE WHEN array_length(EXCLUDED.tags, 1) > 0 THEN EXCLUDED.tags ELSE jobs.tags END,
    posted_at = EXCLUDED.posted_at,
    deadline_at = EXCLUDED.deadline_at,
    logo_url = COALESCE(EXCLUDED.logo_url, jobs.logo_url),
    extraction_method = EXCLUDED.extraction_method,
    raw = COALESCE(jobs.raw, '{}'::jsonb) || COALESCE(EXCLUDED.raw, '{}'::jsonb),
    min_years_exp    = COALESCE(EXCLUDED.min_years_exp, jobs.min_years_exp),
    max_years_exp    = COALESCE(EXCLUDED.max_years_exp, jobs.max_years_exp),
    experience_band  = CASE WHEN EXCLUDED.experience_band IS NOT NULL
                             AND EXCLUDED.experience_band <> 'unknown'
                        THEN EXCLUDED.experience_band ELSE jobs.experience_band END,
    exp_source       = COALESCE(EXCLUDED.exp_source, jobs.exp_source),
    tags_norm        = CASE WHEN cardinality(EXCLUDED.tags_norm) > 0
                        THEN EXCLUDED.tags_norm ELSE jobs.tags_norm END,
    field_provenance = COALESCE(jobs.field_provenance,'{}'::jsonb)
                       || COALESCE(EXCLUDED.field_provenance,'{}'::jsonb),
    enrichment_hash  = COALESCE(EXCLUDED.enrichment_hash, jobs.enrichment_hash),
    enriched_at      = now(),
    -- Same "always fresh" reasoning as apply_url/external_id/company_id
    -- above (a feed re-poll always re-runs formatting on the full current
    -- description, never a stale-skip) — but guarded with COALESCE anyway
    -- since format_job_description can legitimately return None (empty
    -- description), and that must not blank out a previously-good value.
    formatted_description = COALESCE(EXCLUDED.formatted_description, jobs.formatted_description),
    highlights       = CASE WHEN array_length(EXCLUDED.highlights, 1) > 0 THEN EXCLUDED.highlights ELSE jobs.highlights END;
"""


def upsert_feed_job(conn: psycopg.Connection, posting: FeedJobPosting) -> bool:
    """Returns False (and writes nothing) if `posting` fails the shared
    mandatory-field gate (scripts/run_scrape.py::has_mandatory_fields) —
    same rule v1 enforces, applied here since feed_scheduler.py doesn't
    route through run_source() at all. Otherwise always writes (feed
    sources have no v1-style fuzzy-dedup skip: a feed's own external_id
    already guarantees exactness, so the (company, title) trigram
    near-duplicate check upsert_job runs would only risk merging two
    genuinely distinct postings from the same company).

    Does NOT enrich `posting` — same split as db/repository.py's upsert_job/
    run_scrape.py's run_source: the caller (scripts/run_feed.py) must call
    enrich_posting() on every posting BEFORE filtering/upserting, since
    is_india_or_remote's remote-detection depends on workplace_type having
    already been inferred (a location like "Remote - India" or "Remote
    India" only maps to workplace_type='remote' after enrichment — filtering
    on the raw pre-enrichment posting silently drops genuinely valid rows).

    Does not commit — same batching discipline as db/repository.py's
    upsert_job; callers commit once per run."""
    if not has_mandatory_fields(posting):
        return False

    dedup_key = make_dedup_key(posting.company, posting.title, posting.location)

    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            _UPSERT_FEED_JOB_SQL,
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
                "apply_url": posting.apply_url,
                "external_id": posting.external_id,
                "company_id": posting.company_id,
                "description": posting.description,
                "tags": posting.tags,
                "posted_at": posting.posted_at,
                "deadline_at": posting.deadline_at,
                "logo_url": posting.logo_url,
                "extraction_method": posting.extraction_method,
                "employment_type": posting.employment_type,
                "seniority": posting.seniority,
                "raw": psycopg.types.json.Json(posting.raw),
                "min_years_exp": posting.min_years_exp,
                "max_years_exp": posting.max_years_exp,
                "experience_band": posting.experience_band,
                "exp_source": posting.exp_source,
                "tags_norm": posting.tags_norm,
                "field_provenance": psycopg.types.json.Json(posting.field_provenance),
                "enrichment_hash": posting.enrichment_hash,
                "formatted_description": posting.formatted_description,
                "highlights": posting.highlights,
            },
        )
    return True
