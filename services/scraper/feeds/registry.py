"""Reads/writes `company_registry` (db/migrations/0022) — the table that
tells a feed connector which companies to poll and what conditional-GET
state (etag/last_modified) to send. Deliberately separate from
db/repository.py (frozen) even though it uses the same `connect()` helper —
see feeds/feed_base.py's module docstring for why v2 keeps its own code
path end to end.

Each function opens and closes its own short-lived connection rather than
threading one through from the caller — company_registry reads/writes here
happen a handful of times per scrape run (once per company, not once per
posting), so the extra round-trips are negligible, and it keeps
feed_base.py's scrape_list() free of a conn parameter that would otherwise
have to thread through the whole BaseJobScraper contract.
"""

from __future__ import annotations

from db.repository import connect


def active_companies(provider: str, tier: int | None = None) -> list[dict]:
    """Every enabled company_registry row for this ATS provider, ordered so
    a company that's never succeeded (or hasn't been polled in the
    longest) comes first — matches idx_registry_active_tier.

    `tier`: if given, restrict to companies of exactly that polling tier
    (1 = every 15 min, 2 = hourly, 3 = daily — see feed_scheduler.py's
    Stage 7 tiered cadence). None (the default) returns every active
    company for the provider regardless of tier, the behaviour a manual
    "Run now" / full sweep wants."""
    conn = connect()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT id, name, slug, ats_provider, ats_token, careers_url,
                       country_hint, tier, etag, last_modified, fail_streak
                FROM company_registry
                WHERE is_active = true AND ats_provider = %(provider)s
                  AND (%(tier)s::int IS NULL OR tier = %(tier)s)
                ORDER BY tier, last_ok_at NULLS FIRST
                """,
                {"provider": provider, "tier": tier},
            )
            return cur.fetchall()
    finally:
        conn.close()


def record_ok(company_id: int, etag: str | None, last_modified: str | None) -> None:
    conn = connect()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                UPDATE company_registry
                SET last_ok_at = now(), last_error = NULL, fail_streak = 0,
                    etag = %(etag)s, last_modified = %(last_modified)s
                WHERE id = %(id)s
                """,
                {"id": company_id, "etag": etag, "last_modified": last_modified},
            )
        conn.commit()
    finally:
        conn.close()


def record_not_modified(company_id: int) -> None:
    """A 304 is still a success — resets fail_streak without touching
    last_ok_at's underlying etag/last_modified (nothing changed, so the
    cached validators are still correct)."""
    conn = connect()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE company_registry SET last_ok_at = now(), last_error = NULL, fail_streak = 0 WHERE id = %(id)s",
                {"id": company_id},
            )
        conn.commit()
    finally:
        conn.close()


def record_error(company_id: int, error: str) -> None:
    conn = connect()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                UPDATE company_registry
                SET last_error = %(error)s, fail_streak = fail_streak + 1
                WHERE id = %(id)s
                """,
                {"id": company_id, "error": error[:2000]},
            )
        conn.commit()
    finally:
        conn.close()


def promote_hot_companies(top_n: int = 50, window_days: int = 14) -> tuple[int, int]:
    """Auto-tiers companies by real apply-click demand (Stage 7). The N
    companies whose feed-sourced jobs got the most apply clicks in the last
    `window_days` become tier 1 (polled every 15 min — "apply early" where
    it actually matters); everyone else that isn't already daily-tier-3
    long-tail settles at tier 2 (hourly).

    Reads the apply_click table (db/migrations/0021) — content_id there is a
    job UUID, joined back through jobs.company_id to company_registry. This
    is the one place that click signal drives anything; ranking never used
    it before. Returns (promoted_to_tier1, demoted_to_tier2) counts.

    Deliberately does NOT touch a company already sitting at tier 3: tier 3
    is the intentional "long tail + aggregators, daily is fine" bucket
    (including Stage 5's keyed aggregators), not a demotion target — only
    companies actively competing for the tier-1 slots move between 1 and 2.
    A brand-new company keeps whatever tier it was seeded at until it has
    click history to earn promotion."""
    conn = connect()
    try:
        with conn.cursor() as cur:
            # Rank companies by apply-click volume on their feed jobs.
            cur.execute(
                """
                SELECT j.company_id, count(*) AS clicks
                FROM apply_click ac
                JOIN jobs j ON j.id = ac.content_id
                WHERE ac.content_type = 'job'
                  AND ac.created_at >= now() - make_interval(days => %(days)s)
                  AND j.company_id IS NOT NULL
                GROUP BY j.company_id
                ORDER BY clicks DESC
                LIMIT %(top_n)s
                """,
                {"days": window_days, "top_n": top_n},
            )
            hot_ids = [row["company_id"] for row in cur.fetchall()]

            if hot_ids:
                cur.execute(
                    "UPDATE company_registry SET tier = 1 WHERE id = ANY(%(ids)s) AND tier <> 1",
                    {"ids": hot_ids},
                )
                promoted = cur.rowcount
                # Anyone currently tier 1 who fell out of the hot list drops
                # back to tier 2 (hourly) — never to tier 3, which is the
                # deliberate daily long-tail bucket.
                cur.execute(
                    "UPDATE company_registry SET tier = 2 WHERE tier = 1 AND id <> ALL(%(ids)s)",
                    {"ids": hot_ids},
                )
                demoted = cur.rowcount
            else:
                promoted = 0
                cur.execute("UPDATE company_registry SET tier = 2 WHERE tier = 1")
                demoted = cur.rowcount
        conn.commit()
    finally:
        conn.close()
    return promoted, demoted
