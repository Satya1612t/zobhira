import logging
import re
import threading
import uuid
from datetime import datetime, timedelta, timezone

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger
from dotenv import load_dotenv
from fastapi import FastAPI
from pydantic import BaseModel

import contest_scheduler
import feed_scheduler
import format_scheduler
import scheduler
import skill_miner_scheduler
from db.repository import connect, flag_if_repost, get_job, update_job_formatting, upsert_job
from scripts.run_scrape import (
    REPOST_THRESHOLD,
    REPOST_WINDOW_DAYS,
    SCRAPERS,
    flag_staffing_agency,
    has_mandatory_fields,
    is_india_or_remote,
    passes_content_quality,
)
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
    bg.add_job(scheduler.reap_stale_jobs, "interval", hours=scheduler.REAP_EVERY_HOURS, next_run_time=None)
    bg.add_job(scheduler.reap_expired_jobs, "interval", hours=scheduler.REAP_EVERY_HOURS, next_run_time=None)
    bg.add_job(scheduler.prune_analytics_job, "interval", hours=24, next_run_time=None)
    bg.start()
    logger.info(
        "Background scheduler started: himalayas daily at %02d:%02d local "
        "(linkedin + talentd + ycombinator retired; Playwright removed)",
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


@app.on_event("startup")
def _start_feed_background_scheduler() -> None:
    """A FOURTH, separate BackgroundScheduler/lock (see feed_scheduler.py)
    — v2's feed connectors are plain HTTP polls (no Playwright), so this has
    no contention reason to share a lock with any of the other three.
    Stage 7 tiered cadence: tier-1 companies every 15 min, tier-2 hourly,
    tier-3 (long tail) daily, plus a daily apply-click auto-tiering pass —
    all mirroring feed_scheduler.main()."""
    bg = BackgroundScheduler()
    bg.add_job(
        feed_scheduler.poll_tier1,
        IntervalTrigger(minutes=feed_scheduler.FEED_TIER1_INTERVAL_MIN),
        max_instances=1, coalesce=True,
    )
    bg.add_job(
        feed_scheduler.poll_tier2,
        IntervalTrigger(minutes=feed_scheduler.FEED_TIER2_INTERVAL_MIN),
        max_instances=1, coalesce=True,
    )
    bg.add_job(
        feed_scheduler.poll_feeds_daily,
        CronTrigger(hour=feed_scheduler.FEED_RUN_AT.hour, minute=feed_scheduler.FEED_RUN_AT.minute),
        max_instances=1, coalesce=True,
    )
    bg.add_job(
        feed_scheduler.promote_tiers_job,
        CronTrigger(hour=feed_scheduler.FEED_RUN_AT.hour, minute=30),
        max_instances=1, coalesce=True,
    )
    bg.start()
    logger.info(
        "Feed background scheduler started: tier1 every %dmin, tier2 every %dmin, tier3 daily %02d:%02d, auto-tiering daily %02d:30",
        feed_scheduler.FEED_TIER1_INTERVAL_MIN, feed_scheduler.FEED_TIER2_INTERVAL_MIN,
        feed_scheduler.FEED_RUN_AT.hour, feed_scheduler.FEED_RUN_AT.minute, feed_scheduler.FEED_RUN_AT.hour,
    )


@app.get("/llm/quota")
def get_llm_quota():
    """FreeLLMAPI router status for the admin LLM page — provider health +
    usage/analytics, read from the router's own dashboard API (see
    utils/freellmapi_admin.py). Returns {"configured": False} if the admin
    creds aren't set, never raises."""
    from utils.freellmapi_admin import fetch_llm_status

    return fetch_llm_status()


@app.get("/feeds/scheduler/progress")
def get_feed_scheduler_progress():
    return feed_scheduler.get_feed_progress()


@app.post("/feeds/scheduler/trigger/{source}")
def trigger_feed_scheduler(source: str):
    if source not in feed_scheduler.FEED_SOURCE_TIER:
        return {"started": False, "reason": f"Unknown feed provider: {source!r}"}
    started = feed_scheduler.trigger_feed(source)
    if not started:
        return {"started": False, "reason": "a feed sweep is already running"}
    return {"started": True}


class DetectCompanyRequest(BaseModel):
    url: str
    name: str | None = None


@app.post("/feeds/companies/detect")
def detect_and_add_company(body: DetectCompanyRequest):
    """Runs the ATS auto-detection (scripts/detect_ats.py) on a careers-page
    URL and, if a real+verified board is found, upserts it into
    company_registry — the server-side engine behind the admin "add a
    company by pasting its careers URL" flow. Returns the detected
    provider/token on success, or a reason on failure (no ATS found, or the
    detected board had no live postings). Detection is Python-only (regex +
    live API probing), which is why this lives here, not in the admin app's
    Prisma layer."""
    from scripts.detect_ats import detect

    result = detect(body.url, body.name)
    if not result:
        return {"detected": False, "reason": "No supported ATS (or no live postings) found for that URL."}
    provider, token = result

    slug = re.sub(r"[^a-z0-9]+", "-", (body.name or token).lower()).strip("-")
    conn = connect()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO company_registry (name, slug, ats_provider, ats_token, careers_url, country_hint, tier)
                VALUES (%(name)s, %(slug)s, %(provider)s, %(token)s, %(careers_url)s, 'IN', 2)
                ON CONFLICT (ats_provider, ats_token) DO UPDATE SET
                    name = EXCLUDED.name, careers_url = EXCLUDED.careers_url, is_active = true
                RETURNING id
                """,
                {"name": body.name or token, "slug": slug, "provider": provider, "token": token, "careers_url": body.url},
            )
            row = cur.fetchone()
        conn.commit()
    finally:
        conn.close()

    return {"detected": True, "provider": provider, "token": token, "name": body.name or token, "id": row["id"] if row else None}


@app.on_event("startup")
def _start_skill_miner_scheduler() -> None:
    """A THIRD, separate BackgroundScheduler/lock (see
    skill_miner_scheduler.py) — mining is a DB scan + a handful of small
    writes to the skill_* tables, not a Playwright-driven sweep, so it has
    no contention reason to share a lock with either scraper scheduler.
    Sunday 04:00 local — after both scrapers' 02:00/03:00 runs, so the
    week's freshest descriptions are in `jobs` before the scan."""
    bg = BackgroundScheduler()
    bg.add_job(
        skill_miner_scheduler.mine_skills_weekly,
        CronTrigger(day_of_week="sun", hour=4, minute=0),
        max_instances=1, coalesce=True,
    )
    bg.start()
    logger.info("Skill miner scheduler started: weekly, Sunday 04:00 local")


@app.get("/skills/miner/progress")
def get_skill_miner_progress():
    return skill_miner_scheduler.get_progress()


@app.post("/skills/miner/trigger")
def trigger_skill_miner():
    started = skill_miner_scheduler.trigger()
    if not started:
        return {"started": False, "reason": "a mining run is already in progress"}
    return {"started": True}


@app.on_event("startup")
def _start_format_scheduler() -> None:
    """A FIFTH, separate BackgroundScheduler/lock (see format_scheduler.py) —
    the second-phase LLM formatting pass. Ingest already leaves every job with
    a visible deterministic description; this rolls over the DB on its own
    interval and upgrades those to LLM-structured sections, decoupled from any
    ingest sweep so a slow/limited LLM never blocks or hides a job."""
    bg = BackgroundScheduler()
    bg.add_job(
        format_scheduler.format_jobs_scheduled,
        IntervalTrigger(minutes=format_scheduler.FEED_FORMAT_INTERVAL_MIN),
        max_instances=1, coalesce=True,
    )
    bg.start()
    logger.info(
        "Format scheduler started: LLM formatting pass every %dmin",
        format_scheduler.FEED_FORMAT_INTERVAL_MIN,
    )


@app.get("/jobs/formatting/progress")
def get_formatting_progress():
    return format_scheduler.get_progress()


@app.get("/jobs/formatting/backlog")
def get_formatting_backlog():
    """Count of jobs still on the deterministic description (LLM backlog).
    Separate from /progress so the admin card can poll progress cheaply
    (in-memory) and this DB count only occasionally."""
    from scripts.format_jobs import count_pending

    return {"pending": count_pending()}


@app.post("/jobs/formatting/trigger")
def trigger_formatting():
    started = format_scheduler.trigger()
    if not started:
        return {"started": False, "reason": "a formatting run is already in progress"}
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


# Empty now — on-demand "live search" fundamentally needs a scraper it can
# fire per query, and every such scraper (LinkedIn/Talentd/YCombinator, plus
# earlier Naukri/Indeed/RemoteOK) has been retired (the plan's §9). The
# remaining sources are all scheduled feeds/JSON boards, not per-query
# scrapers, so the live-search endpoints below simply return no new results
# (they no-op cleanly over an empty list rather than erroring). Kept as a
# list so live search can be re-enabled instantly if a per-query source is
# ever added back.
LIVE_SEARCH_SOURCES: list[str] = []

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
    postings = [p for p in postings if is_india_or_remote(p)]
    postings = [p for p in postings if passes_content_quality(p)]
    if not postings:
        return
    for posting in postings:
        flag_staffing_agency(posting)
    conn = connect()
    repost_cutoff = datetime.now(timezone.utc) - timedelta(days=REPOST_WINDOW_DAYS)
    try:
        # Connection passed through so already-resolved companies hit the
        # persisted cache instead of re-querying Clearbit (see
        # utils/logo_lookup.py).
        for posting in postings:
            if not posting.logo_url:
                posting.logo_url = find_logo_url(posting.company, conn)
        for posting in postings:
            if upsert_job(conn, posting) and posting.source == "linkedin":
                flag_if_repost(conn, posting, repost_cutoff, REPOST_THRESHOLD)
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
