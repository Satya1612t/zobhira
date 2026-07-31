"""Runs scripts/mine_skills.py's mine()+auto_promote() on a weekly cadence,
inside api.py's process, with the same live-progress + manual-trigger shape
as scheduler.py/contest_scheduler.py — so the admin panel can show it and
kick it off on demand the same way it already does for job/contest sweeps.

A SEPARATE lock from both of those, deliberately: mining is a read-heavy scan
over `jobs` plus a handful of small writes to the skill_* tables, not a
Playwright-driven sweep, so there is no contention reason to block it behind
either scraper lock, and no reason either of those need to wait on it.

Not scheduled by scheduler.py/contest_scheduler.py themselves — the miner
has nothing to do with scraping a source, it grows the skill vocabulary from
what's already in the DB (services/scraper/scripts/mine_skills.py's own
docstring covers the two-source design: job descriptions + zero-result skill
searches). Kept in its own module so a change to either scraper scheduler
can't accidentally affect the miner's cadence or lock.
"""

from __future__ import annotations

import logging
import threading
from datetime import datetime, timezone

from db.repository import connect
from scripts.mine_skills import auto_promote, mine

logger = logging.getLogger(__name__)

# Weekly is the cadence the addendum itself recommends — the vocabulary
# doesn't move fast enough to need more, and each run scans real rows so
# running it more often just re-scans mostly-unchanged inventory.
DEFAULT_SCAN_LIMIT = 5000

_lock = threading.Lock()
_current: dict | None = None
_last_run: dict | None = None


def get_progress() -> dict:
    return {"current": _current, "last_run": _last_run}


def trigger(scan_limit: int = DEFAULT_SCAN_LIMIT) -> bool:
    """Returns False without starting anything if a mining run is already
    in progress — same "fail fast, don't queue" rule as the scraper
    schedulers' trigger()."""
    if _lock.locked():
        return False
    thread = threading.Thread(target=_run, args=(scan_limit,), daemon=True)
    thread.start()
    return True


def _run(scan_limit: int) -> None:
    global _current, _last_run
    if not _lock.acquire(blocking=False):
        logger.warning("Skill mining run skipped: another run is already in progress")
        return

    started_at = datetime.now(timezone.utc)
    _current = {"started_at": started_at.isoformat(), "scan_limit": scan_limit}
    error: str | None = None
    try:
        conn = connect()
        try:
            with conn.cursor() as cur:
                cur.execute("SELECT count(*) AS n FROM skill_candidates WHERE status = 'pending'")
                pending_before = cur.fetchone()["n"]
                cur.execute("SELECT count(*) AS n FROM skills WHERE status = 'active'")
                skills_before = cur.fetchone()["n"]

            mine(conn, scan_limit)
            auto_promote(conn)

            with conn.cursor() as cur:
                cur.execute("SELECT count(*) AS n FROM skill_candidates WHERE status = 'pending'")
                pending_after = cur.fetchone()["n"]
                cur.execute("SELECT count(*) AS n FROM skills WHERE status = 'active'")
                skills_after = cur.fetchone()["n"]
        finally:
            conn.close()
    except Exception as exc:  # noqa: BLE001 — must never crash the scheduler thread
        logger.exception("Skill mining run failed")
        error = str(exc)
        pending_before = pending_after = skills_before = skills_after = 0
    finally:
        finished_at = datetime.now(timezone.utc)
        _last_run = {
            "started_at": started_at.isoformat(),
            "finished_at": finished_at.isoformat(),
            "scan_limit": scan_limit,
            # Net new active canonical skills this run promoted (aliases
            # don't move this count, only new canonical entries do).
            "skills_promoted": skills_after - skills_before,
            "candidates_pending": pending_after,
            "new_candidates_found": max(0, pending_after - pending_before),
            "error": error,
        }
        _current = None
        _lock.release()


def mine_skills_weekly() -> None:
    """APScheduler entry point — see api.py's startup hook."""
    _run(DEFAULT_SCAN_LIMIT)
