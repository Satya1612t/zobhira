"""v2's own scheduler — a 4th independent APScheduler instance/lock inside
api.py, alongside scheduler.py (jobs), contest_scheduler.py (contests) and
skill_miner_scheduler.py. scheduler.py itself is never touched.

Stage 7 — TIERED POLLING. Cadence is driven by company_registry.tier, not
one flat daily sweep:

    tier 1  every FEED_TIER1_INTERVAL_MIN (default 15 min)  hottest companies
    tier 2  every FEED_TIER2_INTERVAL_MIN (default 60 min)  the middle
    tier 3  daily at FEED_RUN_AT                            long tail + aggregators

Each tier sweep polls only that tier's companies (across every provider).
~95% of those requests come back as a cheap 304 Not Modified (conditional
GET, see feeds/feed_http.py) — which is the only reason 15-minute polling is
affordable at all. A daily auto-tiering job (promote_tiers_job) reads real
apply-click demand and moves the most-clicked companies up to tier 1 and the
rest back to tier 2 (see feeds/registry.py::promote_hot_companies).

No separate reap job here: scheduler.py's existing reap_stale_jobs/
reap_expired_jobs (registered once in api.py) are source-agnostic — they
deactivate/expire any job row regardless of `source` — so feed-sourced rows
are already covered by v1's existing 24h reap cadence with zero new code.
"""

import logging
import os
import threading
from datetime import datetime, time, timezone

from apscheduler.schedulers.blocking import BlockingScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger
from dotenv import load_dotenv

from db.repository import connect, get_enabled_sources, record_source_error
from feeds import registry
from scripts.run_feed import PROVIDERS, run_feed_provider

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
logger = logging.getLogger(__name__)

# Tier-3 daily sweep time — offset from jobs (02:00), contests (03:00) and
# the weekly skill miner (Sunday 04:00) to avoid unrelated sweeps' DB-write
# load coinciding. Not required for correctness (no shared lock), just tidy.
FEED_RUN_AT = time(hour=5, minute=0)

# Tier 1/2 cadences, overridable via env (see the v2 plan's working notes).
FEED_TIER1_INTERVAL_MIN = int(os.environ.get("FEED_TIER1_INTERVAL_MIN", "15"))
FEED_TIER2_INTERVAL_MIN = int(os.environ.get("FEED_TIER2_INTERVAL_MIN", "60"))

# Daily auto-tiering: the N most-apply-clicked companies become tier 1.
PROMOTE_TIER1_TOP_N = int(os.environ.get("FEED_PROMOTE_TOP_N", "50"))
PROMOTE_WINDOW_DAYS = int(os.environ.get("FEED_PROMOTE_WINDOW_DAYS", "14"))

# `FEED_SOURCE_TIER`/`ALL_FEED_SOURCES` here are about which PROVIDERS exist
# (for the admin "Run now" trigger's membership check + progress cards) —
# NOT company_registry.tier, which is the separate polling-cadence concept
# above. A manual per-provider trigger sweeps every tier for that provider.
FEED_SOURCE_TIER: dict[str, str] = {source: "feed" for source in PROVIDERS}
ALL_FEED_SOURCES: list[str] = list(PROVIDERS)

# A separate lock from scheduler.py's/contest_scheduler.py's own — a feed
# sweep is plain HTTP (no Playwright), so it can run fully concurrently with
# either without contention. Never run feed_scheduler.py standalone
# alongside api.py — same in-process-lock caveat as the other schedulers.
_feed_lock = threading.Lock()
_feed_current: dict | None = None
_feed_last_runs: dict[str, dict | None] = {source: None for source in ALL_FEED_SOURCES}


def get_feed_progress() -> dict:
    return {"current": _feed_current, "last_runs": _feed_last_runs}


def trigger_feed(source: str) -> bool:
    """Manual per-provider full sweep (admin 'Run now') — every tier for
    that provider (tier=None), unlike the scheduled tier-scoped sweeps."""
    if source not in FEED_SOURCE_TIER:
        raise ValueError(f"Unknown feed provider: {source!r}")
    if _feed_lock.locked():
        return False
    thread = threading.Thread(target=_feed_sweep, args=([source],), kwargs={"tier": None}, daemon=True)
    thread.start()
    return True


def _feed_sweep(sources: list[str], tier: int | None = None) -> None:
    """Polls each of `sources` (providers), restricted to company_registry
    tier `tier` (None = all tiers, for a manual full sweep). One lock across
    every tier: a tier-1 15-min tick that lands while a slower tier-3 daily
    sweep is still running just skips this round rather than piling on —
    cheap 304s mean it'll catch up on the next tick anyway."""
    global _feed_current
    if not _feed_lock.acquire(blocking=False):
        logger.info("Feed sweep (tier=%s) skipped: another feed sweep is running", tier)
        return

    try:
        conn = connect()
        try:
            enabled = get_enabled_sources(conn, "job")
        finally:
            conn.close()

        for source in sources:
            if source not in enabled:
                logger.info("Skipping feed provider=%s: disabled in admin panel", source)
                continue

            started_at = datetime.now(timezone.utc)
            _feed_current = {
                "source": source, "tier": tier if tier is not None else "all",
                "started_at": started_at.isoformat(),
                "total_steps": 1, "completed_steps": 0, "saved_count": 0,
                "current_query": None,
            }
            errors = 0
            try:
                # use_llm=False: the free-tier/billing situation across the
                # whole LLM fallback chain (freellmapi -> Gemini -> Anthropic)
                # is currently exhausted/blocked (known, standing issue — not
                # something this scheduler should re-chase). Without this, a
                # scheduled run can spend 20+ minutes retrying dead providers
                # per posting before giving up. Postings still save fully —
                # this only skips filling employment_type/experience_band for
                # the minority of rows the deterministic passes can't resolve
                # (see utils/field_enrichment.py). Flip back once billing is
                # sorted.
                count = run_feed_provider(source, dry_run=False, use_llm=False, tier=tier)
                logger.info("feed provider=%s tier=%s -> %d postings saved", source, tier, count)
                _feed_current["saved_count"] += count
            except Exception as exc:
                logger.exception("Feed poll failed for provider=%s tier=%s", source, tier)
                errors += 1
                try:
                    error_conn = connect()
                    try:
                        record_source_error(error_conn, source, str(exc))
                    finally:
                        error_conn.close()
                except Exception:
                    logger.warning("Could not record last_error for feed provider=%s", source)
            finally:
                _feed_current["completed_steps"] += 1
            finished_at = datetime.now(timezone.utc)
            _feed_last_runs[source] = {
                "started_at": started_at.isoformat(), "finished_at": finished_at.isoformat(),
                "total_steps": 1, "saved_count": _feed_current["saved_count"], "errors": errors,
            }
    finally:
        _feed_current = None
        _feed_lock.release()


def poll_tier1() -> None:
    _feed_sweep(ALL_FEED_SOURCES, tier=1)


def poll_tier2() -> None:
    _feed_sweep(ALL_FEED_SOURCES, tier=2)


def poll_feeds_daily() -> None:
    """Tier 3 — the daily long-tail + aggregators sweep. Kept under this
    name (not poll_tier3) since api.py already registers it."""
    _feed_sweep(ALL_FEED_SOURCES, tier=3)


def promote_tiers_job() -> None:
    """Daily auto-tiering by real apply-click demand (see
    feeds/registry.py::promote_hot_companies). Runs after the tier-3 sweep
    so promotions take effect on the next 15-min tick."""
    try:
        promoted, demoted = registry.promote_hot_companies(PROMOTE_TIER1_TOP_N, PROMOTE_WINDOW_DAYS)
        logger.info("Auto-tiering: promoted %d company(ies) to tier 1, demoted %d to tier 2", promoted, demoted)
    except Exception:
        logger.exception("Auto-tiering (promote_hot_companies) failed")


def main() -> None:
    load_dotenv()
    scheduler = BlockingScheduler()

    scheduler.add_job(poll_tier1, IntervalTrigger(minutes=FEED_TIER1_INTERVAL_MIN), max_instances=1, coalesce=True)
    scheduler.add_job(poll_tier2, IntervalTrigger(minutes=FEED_TIER2_INTERVAL_MIN), max_instances=1, coalesce=True)
    scheduler.add_job(
        poll_feeds_daily,
        CronTrigger(hour=FEED_RUN_AT.hour, minute=FEED_RUN_AT.minute),
        max_instances=1, coalesce=True,
    )
    scheduler.add_job(
        promote_tiers_job,
        CronTrigger(hour=FEED_RUN_AT.hour, minute=30),
        max_instances=1, coalesce=True,
    )

    logger.info(
        "Feed scheduler started: tier1 every %dmin, tier2 every %dmin, tier3 daily %02d:%02d, auto-tiering daily %02d:30",
        FEED_TIER1_INTERVAL_MIN, FEED_TIER2_INTERVAL_MIN, FEED_RUN_AT.hour, FEED_RUN_AT.minute, FEED_RUN_AT.hour,
    )
    scheduler.start()


if __name__ == "__main__":
    main()
