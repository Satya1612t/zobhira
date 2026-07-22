import logging
import threading
from datetime import datetime, time, timedelta, timezone

from apscheduler.schedulers.blocking import BlockingScheduler
from apscheduler.triggers.cron import CronTrigger
from dotenv import load_dotenv

from db.repository import connect, reap_expired_contests, reap_stale_contests
from scripts.run_contest_scrape import CONTEST_SCRAPERS, run_contest_source

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
logger = logging.getLogger(__name__)

REAP_STALE_AFTER_DAYS = 30
REAP_EVERY_HOURS = 24
DEFAULT_EXPIRY_DAYS = 30  # for contests with no source-provided deadline_at

# Offset from jobs' 02:00 purely to avoid two unrelated sweeps' DB-write
# load coinciding — the two schedulers don't share a lock (see below), so
# this isn't required for correctness, just tidiness.
CONTEST_RUN_AT = time(hour=3, minute=0)

# DEV Community only now — Devpost was removed entirely (see README Notes):
# its public JSON list endpoint has no free-text description field at all,
# so it could never pass the strict mandatory-field rule in
# run_contest_scrape.py (title/description/start date/end date, same
# spirit as jobs' 5-field rule). Runs daily — too low a volume (one
# bounded feed fetch, not a 15-query sweep) to need tiering by cadence.
CONTEST_TIER_SOURCES: dict[str, list[str]] = {"daily": ["dev_community"]}
CONTEST_SOURCE_TIER: dict[str, str] = {
    source: tier for tier, sources in CONTEST_TIER_SOURCES.items() for source in sources
}
ALL_CONTEST_SOURCES: list[str] = list(CONTEST_SOURCE_TIER)

# A SEPARATE lock from scheduler.py's _lock, deliberately — a contest sweep
# and a job sweep can run fully concurrently without contention, since
# neither drives Playwright (both are plain HTTP/RSS fetches). Jobs'
# _lock exists specifically because concurrent Playwright browsers caused
# real contention failures, which doesn't apply here. Never run
# contest_scheduler.py's main() standalone alongside api.py — same
# reasoning as scheduler.py: api.py already runs this in-process, so a
# second standalone process would let two contest sweeps fire at once
# (this lock only guards within its own process).
_contest_lock = threading.Lock()
_contest_current: dict | None = None
_contest_last_runs: dict[str, dict | None] = {source: None for source in ALL_CONTEST_SOURCES}


def get_contest_progress() -> dict:
    return {"current": _contest_current, "last_runs": _contest_last_runs}


def trigger_contest(source: str) -> bool:
    if source not in CONTEST_SOURCE_TIER:
        raise ValueError(f"Unknown contest source: {source!r}")
    if _contest_lock.locked():
        return False
    thread = threading.Thread(target=_contest_sweep, args=([source],), daemon=True)
    thread.start()
    return True


def _contest_sweep(sources: list[str]) -> None:
    global _contest_current
    if not _contest_lock.acquire(blocking=False):
        logger.warning("Contest sweep for sources=%s skipped: another contest sweep is running", sources)
        return

    try:
        for source in sources:
            started_at = datetime.now(timezone.utc)
            _contest_current = {
                "source": source, "tier": CONTEST_SOURCE_TIER[source],
                "started_at": started_at.isoformat(),
                "total_steps": 1, "completed_steps": 0, "saved_count": 0,
                "current_query": None,
            }
            errors = 0
            try:
                count = run_contest_source(source, mark_stale=False)
                logger.info("contest source=%s -> %d postings saved", source, count)
                _contest_current["saved_count"] += count
            except Exception:
                logger.exception("Contest scrape failed for source=%s", source)
                errors += 1
            finally:
                _contest_current["completed_steps"] += 1
            finished_at = datetime.now(timezone.utc)
            _contest_last_runs[source] = {
                "started_at": started_at.isoformat(), "finished_at": finished_at.isoformat(),
                "total_steps": 1, "saved_count": _contest_current["saved_count"], "errors": errors,
            }
    finally:
        _contest_current = None
        _contest_lock.release()


def scrape_contests_daily() -> None:
    _contest_sweep(CONTEST_TIER_SOURCES["daily"])


def reap_stale_contests_job() -> None:
    cutoff = datetime.now(timezone.utc) - timedelta(days=REAP_STALE_AFTER_DAYS)
    conn = connect()
    try:
        affected = reap_stale_contests(conn, cutoff)
    finally:
        conn.close()
    logger.info("Deactivated %d contest(s) not scraped in the last %d day(s)", affected, REAP_STALE_AFTER_DAYS)


def reap_expired_contests_job() -> None:
    default_cutoff = datetime.now(timezone.utc) - timedelta(days=DEFAULT_EXPIRY_DAYS)
    conn = connect()
    try:
        affected = reap_expired_contests(conn, default_cutoff)
    finally:
        conn.close()
    logger.info(
        "Deleted %d contest(s) past their deadline (or %d days old with no deadline)",
        affected, DEFAULT_EXPIRY_DAYS,
    )


def main() -> None:
    load_dotenv()
    scheduler = BlockingScheduler()

    scheduler.add_job(
        scrape_contests_daily,
        CronTrigger(hour=CONTEST_RUN_AT.hour, minute=CONTEST_RUN_AT.minute),
        max_instances=1, coalesce=True,
    )
    scheduler.add_job(reap_stale_contests_job, "interval", hours=REAP_EVERY_HOURS, next_run_time=None)
    scheduler.add_job(reap_expired_contests_job, "interval", hours=REAP_EVERY_HOURS, next_run_time=None)

    logger.info(
        "Contest scheduler started: dev_community daily at %02d:%02d local; "
        "reap_stale/reap_expired every %d hours",
        CONTEST_RUN_AT.hour, CONTEST_RUN_AT.minute, REAP_EVERY_HOURS,
    )
    scheduler.start()


if __name__ == "__main__":
    main()
