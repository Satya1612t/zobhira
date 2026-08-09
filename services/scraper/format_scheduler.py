"""Runs scripts/format_jobs.py's LLM formatting pass on a periodic cadence
inside api.py's process, with the same live-progress + manual-trigger shape as
the other schedulers — so the admin panel can show it and kick it off on
demand the same way.

Its OWN lock, separate from the scrape/feed/skill schedulers: formatting is a
read-of-jobs + LLM-call + small-write loop with no contention reason to block
behind (or be blocked by) an ingest sweep. Decoupling it is the whole point —
ingest stays fast and always leaves a visible deterministic description; this
pass upgrades those to LLM-structured sections whenever it next runs.

Not scheduled by the ingest schedulers themselves; api.py registers it on its
own interval (FEED_FORMAT_INTERVAL_MIN) as a rolling catch-up over whatever
ingest has added since the last pass.
"""

from __future__ import annotations

import logging
import os
import threading
from datetime import datetime, timezone

from scripts.format_jobs import run

logger = logging.getLogger(__name__)

# How often the rolling catch-up pass runs (api.py registers this interval).
FEED_FORMAT_INTERVAL_MIN = int(os.environ.get("FEED_FORMAT_INTERVAL_MIN", "30"))

# How many jobs one scheduled pass will format before yielding. Bounds each
# run's LLM spend/latency; the next interval picks up any remainder.
DEFAULT_LIMIT = 200

_lock = threading.Lock()
_current: dict | None = None
_last_run: dict | None = None


def get_progress() -> dict:
    return {"current": _current, "last_run": _last_run}


def trigger(limit: int = DEFAULT_LIMIT) -> bool:
    """Returns False without starting anything if a formatting run is already
    in progress — same fail-fast, don't-queue rule as the other schedulers."""
    if _lock.locked():
        return False
    thread = threading.Thread(target=_run, args=(limit,), daemon=True)
    thread.start()
    return True


def _run(limit: int) -> None:
    global _current, _last_run
    if not _lock.acquire(blocking=False):
        logger.warning("Formatting run skipped: another run is already in progress")
        return

    started_at = datetime.now(timezone.utc)
    _current = {"started_at": started_at.isoformat(), "limit": limit}
    error: str | None = None
    stats = {"processed": 0, "formatted": 0, "tripped": False}
    try:
        stats = run(limit=limit)
    except Exception as exc:  # noqa: BLE001 — must never crash the scheduler thread
        logger.exception("Formatting run failed")
        error = str(exc)
    finally:
        finished_at = datetime.now(timezone.utc)
        _last_run = {
            "started_at": started_at.isoformat(),
            "finished_at": finished_at.isoformat(),
            "limit": limit,
            "processed": stats["processed"],
            "formatted": stats["formatted"],
            "tripped": stats["tripped"],
            "error": error,
        }
        _current = None
        _lock.release()


def format_jobs_scheduled() -> None:
    """APScheduler entry point — see api.py's startup hook."""
    _run(DEFAULT_LIMIT)
