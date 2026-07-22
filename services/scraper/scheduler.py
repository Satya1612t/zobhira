import logging
import threading
from datetime import datetime, time, timedelta, timezone

from apscheduler.schedulers.blocking import BlockingScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger
from dotenv import load_dotenv

from db.repository import connect, get_recent_searches, reap_expired, reap_stale
from scripts.run_scrape import run_source
from taxonomy import STREAM_QUERIES

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
logger = logging.getLogger(__name__)

REAP_STALE_AFTER_DAYS = 30
REAP_EVERY_HOURS = 24
DEFAULT_EXPIRY_DAYS = 30  # for jobs with no source-provided deadline_at

# Naukri and Indeed scrapers were removed entirely (see README Notes) —
# Naukri was confirmed blocked at the bot-detection level, and Indeed's
# detail pages were only reliably readable for the single page-preloaded
# first job per query, which the mandatory-description rule in
# scripts/run_scrape.py would discard almost everything else for anyway.
# This platform is India-focused (see README), so every query is scraped
# with location="India" — sources that don't support a location param
# (YC/RemoteOK) just ignore it, same as live search.
LOCATION = "India"
# Raised from 15 after a live test (detail_limit=40: 32/40 postings got a
# usable description, ~80% success rate, no bot-blocking/CAPTCHA at any
# point) confirmed enrichment success rate holds steady deeper into the
# results list. 25 is a middle ground between the old 15 and the tested 40
# — more usable postings per query without tripling sweep time.
DETAIL_LIMIT = 25

# Sources are tiered by real-world posting volume (see chat discussion citing
# LinkedIn as the high-volume platform vs. RemoteOK/Talentd/YC as low-volume
# niche boards) rather than all swept on one cadence: high-volume sources are
# checked daily, low-volume ones less often since there's little new to find
# in between. All tiers fire at 02:00 local time so they don't compete with
# daytime traffic/usage.
RUN_AT = time(hour=2, minute=0)

# 15-day freshness window, applied uniformly (see run_source's max_age_hours
# docstring: a posting with no confirmed date is kept, not dropped — this
# only drops postings *confirmed* older than 15 days). Replaces the old
# per-source MAX_RESULTS cap entirely: no volume cap anymore, freshness +
# dedup (upsert_job's similarity check) are what bound what gets saved.
MAX_AGE_HOURS = 15 * 24

TIER_SOURCES: dict[str, list[str]] = {
    "daily": ["linkedin"],
    "every_2_days": ["talentd", "remoteok"],
    "every_3_days": ["ycombinator"],
}

# Supplementary LinkedIn sweep over whatever users have actually searched
# for on the site (search_queries table, same one apps/web's StreamsPanel
# reads from) instead of the fixed STREAM_QUERIES list — same scraping
# caveats as the regular daily sweep (real server-side search, 24h f_TPR
# filter, DETAIL_LIMIT enrichment cap, mandatory-field rule, all via the
# same run_source() call). Chained 1 hour after the daily LinkedIn sweep
# finishes (see scrape_daily) rather than its own fixed cron slot, so it
# never overlaps that run; only fires 3x/week since it's a supplementary
# pass on top of the main sweep, not a replacement for it.
RECENT_SEARCHES_LIMIT = 12
RECENT_SEARCHES_WEEKDAYS = {0, 2, 4}  # Monday, Wednesday, Friday (datetime.weekday())
RECENT_SEARCHES_DELAY_SECONDS = 60 * 60  # 1 hour

# Sources whose deterministic scraper has no real server-side search — each
# just loads one fixed listing page/API response and filters by substring
# match against the title client-side (confirmed by reading scrape_list() in
# scrapers/ycombinator.py, scrapers/talentd.py, scrapers/remoteok.py).
# Looping many queries against these just re-fetches and re-filters the same
# fixed page/response over and over, missing anything whose title doesn't
# contain any query term — so they get a single query-less pass instead.
# LinkedIn builds a real `q=<query>` server-side search URL, where query
# breadth actually changes what comes back, so it keeps the STREAM_QUERIES
# loop.
NO_SEARCH_SOURCES: set[str] = {"ycombinator", "talentd", "remoteok"}
SOURCE_TIER: dict[str, str] = {
    source: tier for tier, sources in TIER_SOURCES.items() for source in sources
}
ALL_SOURCES: list[str] = list(SOURCE_TIER)

# Guards _current/_last_runs below and enforces "only one source scrapes at
# a time, across every tier" — the same reliability principle already used
# for scraping itself (concurrent Playwright browsers caused real
# contention failures). trigger() uses a non-blocking acquire attempt so a
# manual trigger while something is already running fails fast instead of
# queuing up behind it.
_lock = threading.Lock()
_current: dict | None = None  # progress for whichever single source is running right now
_last_runs: dict[str, dict | None] = {source: None for source in ALL_SOURCES}
_last_runs["linkedin_recent_searches"] = None


def get_progress() -> dict:
    """Snapshot of scheduler state for the /progress UI: the currently
    running source (if any) and each of the 5 sources' most recent
    completed-run summary."""
    return {"current": _current, "last_runs": _last_runs}


def trigger(source: str) -> bool:
    """Runs a single source's full 15-stream sweep in a background thread.
    Returns False without starting anything if a sweep (scheduled or
    another manual trigger) is already running — callers should surface
    that as "already running" rather than queuing, since sweeps aren't
    meant to stack."""
    if source not in SOURCE_TIER:
        raise ValueError(f"Unknown source: {source!r}")
    if _lock.locked():
        return False
    thread = threading.Thread(target=_sweep, args=([source],), daemon=True)
    thread.start()
    return True


def _sweep(sources: list[str]) -> None:
    """Runs one broad query per stream (STREAM_QUERIES, 15 of them) against
    each of `sources` in turn, one source at a time — sequential, not
    concurrent, for the same reliability reason live search is sequential
    (running several Playwright browsers at once caused real contention
    failures under load). Exception: sources in NO_SEARCH_SOURCES (YC,
    Talentd, RemoteOK) have no server-side search, so they get a single
    query-less pass instead of the 15-query loop.

    `mark_stale=False` on every call is required,
    not optional: looping many queries against the same source in one run
    must not let query #2 mark query #1's results stale — the exact bug
    already hit and fixed once for live search. Cleanup is handled
    entirely by reap_stale/reap_expired instead.

    Per-designation granularity is recovered afterward by tagging each
    scraped posting's title against the full 58-designation list (see
    designation_classifier.classify_title, called from run_source) rather
    than by searching for it directly.

    Tracks live progress in the module-level `_current` dict, one source
    at a time (step-level: one step per query, not per-posting), and
    writes each source's summary to `_last_runs` as soon as that source
    finishes — so the /progress UI (one card per source) updates
    immediately rather than waiting for every source in the batch to be
    done."""
    global _current
    if not _lock.acquire(blocking=False):
        logger.warning("Sweep for sources=%s skipped: another sweep is already running", sources)
        return

    try:
        for source in sources:
            started_at = datetime.now(timezone.utc)
            queries = [""] if source in NO_SEARCH_SOURCES else STREAM_QUERIES
            total_steps = len(queries)
            _current = {
                "source": source, "tier": SOURCE_TIER[source], "started_at": started_at.isoformat(),
                "total_steps": total_steps, "completed_steps": 0, "saved_count": 0,
                "current_query": None,
            }
            errors = 0
            for query in queries:
                _current["current_query"] = query or "(all listings, no query filter)"
                try:
                    count = run_source(
                        source, query=query, location=LOCATION,
                        mark_stale=False, detail_limit=DETAIL_LIMIT,
                        max_age_hours=MAX_AGE_HOURS, max_results=None,
                    )
                    logger.info("source=%s query=%r -> %d postings saved", source, query, count)
                    _current["saved_count"] += count
                except Exception:
                    logger.exception(
                        "Scheduled scrape failed for source=%s query=%r", source, query
                    )
                    errors += 1
                finally:
                    _current["completed_steps"] += 1
            finished_at = datetime.now(timezone.utc)
            _last_runs[source] = {
                "started_at": started_at.isoformat(), "finished_at": finished_at.isoformat(),
                "total_steps": total_steps, "saved_count": _current["saved_count"], "errors": errors,
            }
    finally:
        _current = None
        _lock.release()


def scrape_recent_searches_linkedin() -> None:
    """LinkedIn only, queried against recent real user searches instead of
    STREAM_QUERIES — same run_source() call, same caveats (real server-side
    search, 24h f_TPR filter + India geoId, DETAIL_LIMIT=25 enrichment cap,
    mandatory 5-field rule, dedup) as the regular daily sweep. Shares the
    same _lock as every other sweep, so if something is still running when
    the 1-hour delay (see _maybe_chain_recent_searches_sweep) elapses, this
    just skips rather than stacking."""
    global _current
    if not _lock.acquire(blocking=False):
        logger.warning("Recent-searches LinkedIn sweep skipped: another sweep is already running")
        return

    try:
        conn = connect()
        try:
            queries = get_recent_searches(conn, limit=RECENT_SEARCHES_LIMIT)
        finally:
            conn.close()
        if not queries:
            logger.info("No recent searches recorded yet — skipping recent-searches LinkedIn sweep")
            return

        source = "linkedin"
        started_at = datetime.now(timezone.utc)
        total_steps = len(queries)
        _current = {
            "source": source, "tier": "recent_searches", "started_at": started_at.isoformat(),
            "total_steps": total_steps, "completed_steps": 0, "saved_count": 0,
            "current_query": None,
        }
        errors = 0
        for query in queries:
            _current["current_query"] = query
            try:
                count = run_source(
                    source, query=query, location=LOCATION,
                    mark_stale=False, detail_limit=DETAIL_LIMIT,
                    max_age_hours=MAX_AGE_HOURS, max_results=None,
                )
                logger.info("recent-search query=%r -> %d postings saved", query, count)
                _current["saved_count"] += count
            except Exception:
                logger.exception("Recent-searches LinkedIn scrape failed for query=%r", query)
                errors += 1
            finally:
                _current["completed_steps"] += 1
        finished_at = datetime.now(timezone.utc)
        _last_runs["linkedin_recent_searches"] = {
            "started_at": started_at.isoformat(), "finished_at": finished_at.isoformat(),
            "total_steps": total_steps, "saved_count": _current["saved_count"], "errors": errors,
        }
    finally:
        _current = None
        _lock.release()


def _maybe_chain_recent_searches_sweep() -> None:
    """Called right after the daily LinkedIn sweep finishes. Only actually
    schedules anything on the 3 target weekdays — the delayed call itself
    (not a fixed cron slot) is what guarantees this never overlaps that
    sweep, satisfying "1 hour after the linkedin run finishes" literally
    rather than approximating it with a fixed clock time."""
    if datetime.now().weekday() not in RECENT_SEARCHES_WEEKDAYS:
        return
    logger.info(
        "Scheduling LinkedIn recent-searches sweep in %d minutes",
        RECENT_SEARCHES_DELAY_SECONDS // 60,
    )
    timer = threading.Timer(RECENT_SEARCHES_DELAY_SECONDS, scrape_recent_searches_linkedin)
    timer.daemon = True
    timer.start()


def scrape_daily() -> None:
    """High-volume source: LinkedIn — every 24h at 02:00. Chains the
    recent-searches sweep 1 hour after this finishes, 3x/week (see
    _maybe_chain_recent_searches_sweep)."""
    _sweep(TIER_SOURCES["daily"])
    _maybe_chain_recent_searches_sweep()


def scrape_every_2_days() -> None:
    """Lower-volume sources: Talentd, then RemoteOK — every 2 days at 02:00.
    Both are in NO_SEARCH_SOURCES: single query-less pass each, not the
    15-query loop."""
    _sweep(TIER_SOURCES["every_2_days"])


def scrape_every_3_days() -> None:
    """Lowest-volume source: YCombinator — every 3 days at 02:00. Single
    query-less pass (see _sweep), not the 15-query loop other tiers use."""
    _sweep(TIER_SOURCES["every_3_days"])


def _next_run_at(hour: int, minute: int) -> datetime:
    """Next occurrence of the given local time, today if it hasn't passed
    yet, otherwise tomorrow. Used as the anchor for the interval-based
    (every-2-days / every-3-days) triggers so they stay pinned to 02:00
    instead of drifting to whatever time the scheduler process happened to
    start at."""
    now = datetime.now()
    candidate = now.replace(hour=hour, minute=minute, second=0, microsecond=0)
    if candidate <= now:
        candidate += timedelta(days=1)
    return candidate


def reap_stale_jobs() -> None:
    cutoff = datetime.now(timezone.utc) - timedelta(days=REAP_STALE_AFTER_DAYS)
    conn = connect()
    try:
        affected = reap_stale(conn, cutoff)
    finally:
        conn.close()
    logger.info("Deactivated %d job(s) not scraped in the last %d day(s)", affected, REAP_STALE_AFTER_DAYS)


def reap_expired_jobs() -> None:
    default_cutoff = datetime.now(timezone.utc) - timedelta(days=DEFAULT_EXPIRY_DAYS)
    conn = connect()
    try:
        affected = reap_expired(conn, default_cutoff)
    finally:
        conn.close()
    logger.info(
        "Deactivated %d job(s) past their deadline (or %d days old with no deadline)",
        affected, DEFAULT_EXPIRY_DAYS,
    )


def main() -> None:
    load_dotenv()
    scheduler = BlockingScheduler()

    scheduler.add_job(
        scrape_daily, CronTrigger(hour=RUN_AT.hour, minute=RUN_AT.minute),
        max_instances=1, coalesce=True,
    )
    scheduler.add_job(
        scrape_every_2_days,
        IntervalTrigger(days=2, start_date=_next_run_at(RUN_AT.hour, RUN_AT.minute)),
        max_instances=1, coalesce=True,
    )
    scheduler.add_job(
        scrape_every_3_days,
        IntervalTrigger(days=3, start_date=_next_run_at(RUN_AT.hour, RUN_AT.minute)),
        max_instances=1, coalesce=True,
    )
    scheduler.add_job(reap_stale_jobs, "interval", hours=REAP_EVERY_HOURS, next_run_time=None)
    scheduler.add_job(reap_expired_jobs, "interval", hours=REAP_EVERY_HOURS, next_run_time=None)

    logger.info(
        "Scheduler started: linkedin daily, talentd+remoteok every 2 days, "
        "ycombinator every 3 days, all at %02d:%02d local; %d streams/source; "
        "reap_stale/reap_expired every %d hours",
        RUN_AT.hour, RUN_AT.minute, len(STREAM_QUERIES), REAP_EVERY_HOURS,
    )
    scheduler.start()


if __name__ == "__main__":
    main()
