import logging
import threading
import uuid
from datetime import datetime, timezone

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger
from dotenv import load_dotenv
from fastapi import FastAPI
from pydantic import BaseModel

import contest_scheduler
import scheduler
from db.repository import connect, get_job, update_job_formatting, upsert_job
from scripts.run_scrape import SCRAPERS, has_mandatory_fields
from utils.job_formatter import format_job_description
from utils.logo_lookup import find_logo_url

load_dotenv()
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
logger = logging.getLogger(__name__)

app = FastAPI(title="Job Portal Scraper API")


@app.on_event("startup")
def _start_background_scheduler() -> None:
    """Runs the tiered scheduler (see scheduler.py) inside this same
    process, in the background, so this API can report live progress and
    accept manual triggers for it. This means api.py is now the only
    process that needs to run — don't also run `python scheduler.py`
    standalone alongside it, or two sweeps could fire concurrently
    (scheduler.py's own lock only guards within its own process)."""
    bg = BackgroundScheduler()
    bg.add_job(
        scheduler.scrape_daily,
        CronTrigger(hour=scheduler.RUN_AT.hour, minute=scheduler.RUN_AT.minute),
        max_instances=1, coalesce=True,
    )
    bg.add_job(
        scheduler.scrape_every_2_days,
        IntervalTrigger(days=2, start_date=scheduler._next_run_at(scheduler.RUN_AT.hour, scheduler.RUN_AT.minute)),
        max_instances=1, coalesce=True,
    )
    bg.add_job(
        scheduler.scrape_every_3_days,
        IntervalTrigger(days=3, start_date=scheduler._next_run_at(scheduler.RUN_AT.hour, scheduler.RUN_AT.minute)),
        max_instances=1, coalesce=True,
    )
    bg.add_job(scheduler.reap_stale_jobs, "interval", hours=scheduler.REAP_EVERY_HOURS, next_run_time=None)
    bg.add_job(scheduler.reap_expired_jobs, "interval", hours=scheduler.REAP_EVERY_HOURS, next_run_time=None)
    bg.start()
    logger.info(
        "Background scheduler started: linkedin daily, talentd+remoteok every 2 "
        "days, ycombinator every 3 days, all at %02d:%02d local",
        scheduler.RUN_AT.hour, scheduler.RUN_AT.minute,
    )


@app.on_event("startup")
def _start_contest_background_scheduler() -> None:
    """Separate BackgroundScheduler instance from the jobs one above — two
    APScheduler registries in one process is fine; what matters is that
    contest_scheduler has its own threading.Lock (see contest_scheduler.py),
    so a contest sweep never blocks on or gets blocked by a job sweep."""
    bg = BackgroundScheduler()
    bg.add_job(
        contest_scheduler.scrape_contests_daily,
        CronTrigger(hour=contest_scheduler.CONTEST_RUN_AT.hour, minute=contest_scheduler.CONTEST_RUN_AT.minute),
        max_instances=1, coalesce=True,
    )
    bg.add_job(contest_scheduler.reap_stale_contests_job, "interval", hours=contest_scheduler.REAP_EVERY_HOURS, next_run_time=None)
    bg.add_job(contest_scheduler.reap_expired_contests_job, "interval", hours=contest_scheduler.REAP_EVERY_HOURS, next_run_time=None)
    bg.start()
    logger.info(
        "Contest background scheduler started: dev_community daily at %02d:%02d local",
        contest_scheduler.CONTEST_RUN_AT.hour, contest_scheduler.CONTEST_RUN_AT.minute,
    )


@app.get("/contests/scheduler/progress")
def get_contest_scheduler_progress():
    return contest_scheduler.get_contest_progress()


@app.post("/contests/scheduler/trigger/{source}")
def trigger_contest_scheduler(source: str):
    if source not in contest_scheduler.CONTEST_SOURCE_TIER:
        return {"started": False, "reason": f"Unknown source: {source!r}"}
    started = contest_scheduler.trigger_contest(source)
    if not started:
        return {"started": False, "reason": "a contest sweep is already running"}
    return {"started": True}


@app.get("/scheduler/progress")
def get_scheduler_progress():
    return scheduler.get_progress()


@app.post("/scheduler/trigger/{source}")
def trigger_scheduler(source: str):
    if source not in scheduler.SOURCE_TIER:
        return {"started": False, "reason": f"Unknown source: {source!r}"}
    started = scheduler.trigger(source)
    if not started:
        return {"started": False, "reason": "a sweep is already running"}
    return {"started": True}


@app.post("/scheduler/trigger/recent-searches/linkedin")
def trigger_recent_searches_sweep():
    """Manual/testing path for scrape_recent_searches_linkedin() — bypasses
    the weekday check and 1-hour delay that gate it in normal operation
    (see scheduler._maybe_chain_recent_searches_sweep), but still goes
    through the same _lock as every other sweep."""
    if scheduler._lock.locked():
        return {"started": False, "reason": "a sweep is already running"}
    thread = threading.Thread(target=scheduler.scrape_recent_searches_linkedin, daemon=True)
    thread.start()
    return {"started": True}

# LinkedIn is listed first since it's usually the biggest contributor of
# results. Naukri and Indeed were both removed entirely (scrapers, config,
# and historical DB rows) — Naukri was confirmed blocked at the
# bot-detection level, and Indeed's mandatory-description rule left it with
# ~1 usable posting per query (see README Notes for both).
LIVE_SEARCH_SOURCES = ["linkedin", "ycombinator", "remoteok", "talentd"]

# First pass enriches only the 5 latest matching postings per source (fast);
# scrolling to the bottom of the results fetches 5 more per source that
# actually had results the first time. Sources are processed strictly
# sequentially, one Playwright browser at a time — running several browsers
# concurrently was tried and caused real contention failures (timeouts,
# selectors failing to find content in time under CPU/network pressure).
# Small batches make sequential fast enough without that risk.
INITIAL_BATCH = 5
MORE_BATCH = 5

_jobs: dict[str, dict] = {}
# job_id -> source -> full scrape_list() result (not JSON-serializable,
# never exposed via the API — kept separate from _jobs so "load more" can
# enrich further slices without re-hitting the site).
_source_cache: dict[str, dict[str, list]] = {}


class ScrapeRequest(BaseModel):
    query: str
    location: str | None = None
    sources: list[str] | None = None


def _upsert_all(postings: list) -> None:
    """Called twice per source during live search — once with list-only
    fields (before enrichment), once again after enrich() fills in
    description/logo/date. The mandatory-field check (same rule as the
    scheduler's run_source(), see scripts/run_scrape.py) means the first
    call is a no-op for any source that only gets a description from
    enrichment: those postings simply don't land until enrichment succeeds,
    or never land if it doesn't — same strict rule, not a separate one."""
    postings = [p for p in postings if has_mandatory_fields(p)]
    if not postings:
        return
    for posting in postings:
        if not posting.logo_url:
            posting.logo_url = find_logo_url(posting.company)
    conn = connect()
    try:
        for posting in postings:
            upsert_job(conn, posting)
        conn.commit()  # one commit for the whole batch, not one per posting
    finally:
        conn.close()


def _scrape_one_source_initial(job_id: str, query: str, location: str | None, source: str) -> None:
    _jobs[job_id]["sources"][source] = {
        "status": "running", "count": None, "shown": 0, "has_more": False, "error": None,
    }
    scraper = SCRAPERS[source]()
    try:
        full_list = scraper.scrape_list(query, location)
    except Exception as exc:
        logger.exception("Live scrape failed for source=%s query=%r", source, query)
        _jobs[job_id]["sources"][source] = {
            "status": "error", "count": 0, "shown": 0, "has_more": False, "error": str(exc),
        }
        return

    _source_cache.setdefault(job_id, {})[source] = full_list
    _upsert_all(full_list)  # list-only fields land immediately, before enrichment

    batch = full_list[:INITIAL_BATCH]
    try:
        scraper.enrich(batch, INITIAL_BATCH)
    except Exception:
        logger.exception("Enrichment failed for source=%s query=%r", source, query)
    _upsert_all(batch)

    _jobs[job_id]["sources"][source] = {
        "status": "done",
        "count": len(full_list),
        "shown": min(INITIAL_BATCH, len(full_list)),
        "has_more": len(full_list) > INITIAL_BATCH,
        "error": None,
    }


def _run_initial_batch(job_id: str, query: str, location: str | None, sources: list[str]) -> None:
    for source in sources:
        _scrape_one_source_initial(job_id, query, location, source)
    _jobs[job_id]["status"] = "done"
    _jobs[job_id]["finished_at"] = datetime.now(timezone.utc).isoformat()


def _scrape_one_source_more(job_id: str, source: str) -> None:
    cached = _source_cache.get(job_id, {}).get(source)
    state = _jobs[job_id]["sources"].get(source)
    if not cached or not state or not state.get("has_more"):
        return

    shown = state["shown"]
    batch = cached[shown : shown + MORE_BATCH]
    if not batch:
        state["has_more"] = False
        return

    state["status"] = "running"
    _upsert_all(batch)  # list-only fields land immediately
    scraper = SCRAPERS[source]()
    try:
        scraper.enrich(batch, len(batch))
    except Exception:
        logger.exception("Enrichment failed for source=%s (load more)", source)
    _upsert_all(batch)

    new_shown = shown + len(batch)
    _jobs[job_id]["sources"][source] = {
        "status": "done",
        "count": state["count"],
        "shown": new_shown,
        "has_more": new_shown < len(cached),
        "error": None,
    }


def _run_more_batch(job_id: str) -> None:
    sources = [s for s, state in _jobs[job_id]["sources"].items() if state.get("has_more")]
    for source in sources:
        _scrape_one_source_more(job_id, source)
    _jobs[job_id]["status"] = "done"
    _jobs[job_id]["finished_at"] = datetime.now(timezone.utc).isoformat()


@app.post("/scrape")
def start_scrape(req: ScrapeRequest):
    sources = req.sources or LIVE_SEARCH_SOURCES
    unknown = [s for s in sources if s not in SCRAPERS]
    if unknown:
        return {"error": f"Unknown source(s): {unknown}"}

    job_id = str(uuid.uuid4())
    _jobs[job_id] = {
        "status": "running",
        "query": req.query,
        "location": req.location,
        "started_at": datetime.now(timezone.utc).isoformat(),
        "finished_at": None,
        "sources": {
            s: {"status": "pending", "count": None, "shown": 0, "has_more": False, "error": None}
            for s in sources
        },
    }
    thread = threading.Thread(
        target=_run_initial_batch, args=(job_id, req.query, req.location, sources), daemon=True
    )
    thread.start()
    return {"job_id": job_id}


@app.post("/scrape/{job_id}/more")
def load_more(job_id: str):
    job = _jobs.get(job_id)
    if not job:
        return {"error": "job not found"}
    if job["status"] != "done":
        return {"error": "job still running, wait for it to finish first"}
    if not any(s.get("has_more") for s in job["sources"].values()):
        return {"status": "no_more"}

    job["status"] = "running"
    thread = threading.Thread(target=_run_more_batch, args=(job_id,), daemon=True)
    thread.start()
    return {"status": "started"}


@app.get("/scrape/{job_id}")
def get_scrape_status(job_id: str):
    job = _jobs.get(job_id)
    if not job:
        return {"status": "not_found"}
    return job


@app.post("/jobs/{job_id}/format-description")
def format_job_description_endpoint(job_id: str):
    """On-demand, one job at a time (called from a live detail-page view,
    not a batch sweep) — deliberately NOT part of the scheduled pipeline
    given job volume (hundreds of active postings) vs. contests' handful;
    see contest_summarizer.py's docstring for the volume reasoning this
    mirrors. Idempotent: a job that already has a cached
    formatted_description just returns it without touching the LLM again."""
    conn = connect()
    try:
        job = get_job(conn, job_id)
        if job is None:
            return {"error": "not found"}
        if job["formatted_description"]:
            return {"formatted_description": job["formatted_description"], "highlights": job["highlights"]}
        result = format_job_description(job["description"])
        if result["formatted_description"]:
            update_job_formatting(conn, job_id, result["formatted_description"], result["highlights"])
        return result
    finally:
        conn.close()
