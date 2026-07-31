import argparse
import logging
import re
from datetime import datetime, timedelta, timezone

from dotenv import load_dotenv

from db.repository import connect, flag_if_repost, mark_stale_inactive, upsert_job
from utils.dedup import make_dedup_key
from utils.field_enrichment import enrich_posting
from scrapers.base import BaseJobScraper
from scrapers.himalayas import HimalayasScraper
from scrapers.linkedin import LinkedInScraper
from scrapers.talentd import TalentdScraper
from scrapers.ycombinator import YCombinatorScraper
from utils.logo_lookup import find_logo_url

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
logger = logging.getLogger(__name__)

# A posting missing any of these can't be identified, located, or applied
# to at all, so it's discarded rather than stored. `source_url` doubles as
# the "apply link" here — every scraper already points it at the canonical
# job posting page (third-party ATS or the source site itself), there's no
# separate apply-link field in the schema.
#
# `description` deliberately isn't in this list. It used to be, which meant
# any posting whose detail-page enrichment hadn't run yet (bounded by
# detail_limit — see scheduler.py) or failed was discarded outright, even
# though its title/company/location/link were all perfectly real and
# useful. A posting with those four fields but no description yet gets
# saved as a "stub" instead — upsert_job's COALESCE on description means a
# later sweep that re-finds the same posting (via select_unenriched, see
# utils/enrichment.py) and successfully enriches it fills the description
# in without a second discard-and-rediscover cycle. The site itself already
# handles a null description gracefully (FormattedJobDescription renders
# nothing rather than crashing).
MANDATORY_FIELDS = ("title", "company", "source_url", "location")


def has_mandatory_fields(posting) -> bool:
    """Shared with api.py's live-search upsert path, not just this CLI/
    scheduler one — both must enforce the same rule before anything reaches
    the DB."""
    return all(str(getattr(posting, field) or "").strip() for field in MANDATORY_FIELDS)


# Zobhira serves the Indian job market — a posting that's neither remote nor
# India-based isn't usable by the target audience, so (like the mandatory-
# field check above) it's discarded before ever reaching the DB rather than
# stored and hidden client-side.
_INDIA_TOKENS = {"in", "india"}

# YC ("workatastartup.com") frequently marks a role "remote" but restricts it
# to specific countries in a parenthetical — confirmed against real scraped
# data already in the DB: "United States - Remote / Remote (US)", "San
# Francisco, CA, US / Remote (DE; New York, NY, US; Toronto, ON, CA; Toronto,
# Ontario, CA)". A bare "Remote" with no such parenthetical is treated as
# genuinely worldwide (there's no restriction text to go on, and most other
# sources' "remote" postings never carry this kind of qualifier at all).
_REMOTE_RESTRICTION_RE = re.compile(r"remote\s*\(([^)]+)\)", re.IGNORECASE)


def _is_remote_restricted_away_from_india(location: str | None) -> bool:
    if not location:
        return False
    match = _REMOTE_RESTRICTION_RE.search(location)
    if not match:
        return False
    tokens = re.split(r"[,;()]", match.group(1))
    return not any(t.strip().lower() in _INDIA_TOKENS for t in tokens if t.strip())


def is_india_or_remote(posting) -> bool:
    """Shared with api.py's live-search upsert path, not just this CLI/
    scheduler one — both must enforce the same rule before anything reaches
    the DB."""
    if posting.workplace_type == "remote":
        # "Remote" alone isn't enough on YC — it frequently restricts who
        # can actually take the role despite the generic "remote" label, so
        # a role explicitly restricted away from India isn't actually
        # usable by this audience even though it's technically "remote".
        if posting.source == "ycombinator" and _is_remote_restricted_away_from_india(posting.location):
            return False
        return True
    if posting.source == "talentd":
        # Talentd is an India-only job board (see scrapers/talentd.py) whose
        # postings are often bare Indian city names ("Bangalore", "Pune")
        # with no country marker to text-match — source alone is a reliable
        # signal here, so every Talentd listing counts as India-based.
        return True
    location = posting.location or ""
    tokens = re.split(r"[,/()]", location)
    return any(t.strip().lower() in _INDIA_TOKENS for t in tokens if t.strip())


# LinkedIn-specific quality gates (see scrapers/linkedin.py's docstring on
# ghost listings/staffing-agency reposts being this source's main quality
# problem) — a no-op for every other source, same "shared choke point,
# source-conditional inside" pattern as is_india_or_remote's Talentd case.
_STAFFING_KEYWORDS = ("consultancy", "staffing", "manpower", "recruiters", "hr solutions")
_SCAM_FEE_KEYWORDS = (
    "registration fee", "registration charge", "training fee",
    "training charge", "security deposit", "refundable deposit",
)
MIN_DESCRIPTION_WORDS = 80
REPOST_WINDOW_DAYS = 30
REPOST_THRESHOLD = 5


def passes_content_quality(posting) -> bool:
    """Only judges postings that already have a description — one that
    hasn't been enriched yet (outside this run's detail_limit) is left
    alone rather than penalized for missing data it was never given a
    chance to have."""
    if posting.source != "linkedin" or not posting.description:
        return True
    word_count = len(posting.description.split())
    if word_count < MIN_DESCRIPTION_WORDS:
        return False
    lowered = posting.description.lower()
    return not any(kw in lowered for kw in _SCAM_FEE_KEYWORDS)


def flag_staffing_agency(posting) -> None:
    """Demotes (flags in `raw`), doesn't drop — some staffing/recruitment
    agencies post genuine roles, so this is a signal for ranking to use
    later, not an auto-reject. Mutates `posting.raw` in place."""
    if posting.source != "linkedin":
        return
    lowered = posting.company.lower()
    if any(kw in lowered for kw in _STAFFING_KEYWORDS):
        posting.raw["flagged_staffing_agency"] = True

SCRAPERS: dict[str, type[BaseJobScraper]] = {
    "ycombinator": YCombinatorScraper,
    "talentd": TalentdScraper,
    "linkedin": LinkedInScraper,
    "himalayas": HimalayasScraper,
}


def run_source(
    source: str,
    query: str,
    location: str | None,
    mark_stale: bool = True,
    detail_limit: int | None = None,
    max_age_hours: int | None = None,
    max_results: int | None = None,
    browser=None,
    seen_dedup_keys: set[str] | None = None,
) -> int:
    """`mark_stale=True` flips any job from this source not seen in this
    run to inactive — correct for a broad, periodic re-scrape (CLI/
    scheduler use), but wrong for a narrow on-demand keyword search: that
    would deactivate every previously-scraped job from this source that
    just doesn't happen to match the new query. Live-search callers
    (services/scraper/api.py) pass `mark_stale=False` since they're always
    additive, never a full-source refresh.

    `detail_limit` caps how many postings get the slow per-job detail-page
    enrichment pass (description/logo/date) on sources that do one — the
    rest stay list-only. Bounds wall-clock time on high-volume sources
    (LinkedIn) for live search; None (CLI/scheduler default) means no cap.

    `max_age_hours` drops any posting whose `posted_at` is confirmed older
    than that cutoff. A posting with no `posted_at` at all is *kept*, not
    dropped — sources like YCombinator never expose a posted date; treating
    "unknown" as "too old" would silently zero out those sources.
    Missing-date postings still go through the same dedup (upsert_job's
    similarity check), so this doesn't reintroduce unbounded duplication —
    it just means freshness can't be verified for them one way or the
    other. CLI/scheduler callers that want no filtering at all just omit
    the argument (default None).

    `max_results` caps how many postings (from the start of the list —
    newest-first on every source we scrape) get kept at all. Used as a
    volume cap for sources exempted from `max_age_hours` (YCombinator)
    since a hard date cutoff isn't meaningful for it.

    Every posting must have title/company/location/source_url (see
    MANDATORY_FIELDS) or it's discarded before ever reaching the DB —
    it can't be identified, located, or applied to meaningfully otherwise.
    A missing description no longer discards a posting (see MANDATORY_FIELDS'
    own comment) — it's saved as a stub and backfilled by a later sweep's
    enrichment pass instead. A missing logo alone doesn't get a posting
    discarded either — find_logo_url() tries a best-effort lookup instead.

    `browser`: an already-launched Playwright Browser to reuse instead of
    letting the scraper launch its own — see utils/browser.py's
    get_browser(). Passed straight through to `scraper.scrape()`. None (the
    default) preserves the old per-call launch/close behavior; scheduler.py
    passes one in so a whole source's multi-query sweep shares a single
    browser instead of relaunching Chromium for every query.

    `seen_dedup_keys`: an optional set the caller owns across a whole
    multi-query sweep (see scheduler.py's `_sweep()`) — if given, this run
    logs how many of its postings are genuinely new to the sweep so far vs.
    already found by an earlier query, then adds its own to the set. Not
    used for any filtering decision here — purely instrumentation, so that
    which of taxonomy.STREAM_QUERIES actually contribute unique postings
    (vs. just re-finding what a broader query already found) can be judged
    from real logs instead of guessed at."""
    scraper_cls = SCRAPERS[source]
    scraper = scraper_cls()

    run_started_at = datetime.now(timezone.utc)
    postings = scraper.scrape(query=query, location=location, detail_limit=detail_limit, browser=browser)
    logger.info("Scraped %d postings from %s", len(postings), source)

    if seen_dedup_keys is not None:
        this_query_keys = {make_dedup_key(p.company, p.title, p.location) for p in postings}
        new_keys = this_query_keys - seen_dedup_keys
        logger.info(
            "query-overlap source=%s query=%r new=%d overlap=%d total=%d",
            source, query, len(new_keys), len(this_query_keys) - len(new_keys), len(this_query_keys),
        )
        seen_dedup_keys.update(this_query_keys)

    if max_age_hours is not None:
        cutoff = run_started_at - timedelta(hours=max_age_hours)
        before = len(postings)

        def _is_fresh(p) -> bool:
            if p.posted_at is None:
                return True
            # Defensive: a naive posted_at (no tzinfo) would otherwise crash
            # this comparison outright — treat it as UTC rather than assume
            # every scraper's date parsing is tz-aware.
            posted_at = p.posted_at if p.posted_at.tzinfo else p.posted_at.replace(tzinfo=timezone.utc)
            return posted_at >= cutoff

        postings = [p for p in postings if _is_fresh(p)]
        dropped = before - len(postings)
        if dropped:
            logger.info(
                "Dropped %d/%d postings from %s older than %dh",
                dropped, before, source, max_age_hours,
            )

    if max_results is not None and len(postings) > max_results:
        postings = postings[:max_results]

    # Designation tags, skill tags, employment type, workplace type and
    # experience — all derived here, once, instead of at query time.
    # `use_llm` is False on live-search calls (mark_stale=False), which are
    # latency-sensitive; the scheduled sweep does the LLM gap-fill.
    for posting in postings:
        enrich_posting(posting, use_llm=mark_stale)

    before_mandatory = len(postings)
    postings = [p for p in postings if has_mandatory_fields(p)]
    dropped_mandatory = before_mandatory - len(postings)
    if dropped_mandatory:
        logger.info(
            "Discarded %d/%d postings from %s missing a mandatory field "
            "(title/company/description/location/apply link)",
            dropped_mandatory, before_mandatory, source,
        )

    before_location = len(postings)
    postings = [p for p in postings if is_india_or_remote(p)]
    dropped_location = before_location - len(postings)
    if dropped_location:
        logger.info(
            "Discarded %d/%d postings from %s: neither remote nor India-based",
            dropped_location, before_location, source,
        )

    # LinkedIn-only (no-op for every other source): drop thin/scam-flavored
    # descriptions outright; flag (don't drop) staffing-agency postings.
    before_quality = len(postings)
    postings = [p for p in postings if passes_content_quality(p)]
    dropped_quality = before_quality - len(postings)
    if dropped_quality:
        logger.info(
            "Discarded %d/%d postings from %s: too thin or scam-flagged description",
            dropped_quality, before_quality, source,
        )
    for posting in postings:
        flag_staffing_agency(posting)

    conn = connect()
    saved = 0
    repost_cutoff = run_started_at - timedelta(days=REPOST_WINDOW_DAYS)
    flagged_reposts = 0
    try:
        # Best-effort logo backfill for whatever survived the mandatory-field
        # filter above — a missing logo alone doesn't get a posting
        # discarded, unlike MANDATORY_FIELDS' four. Connection passed through
        # so already-resolved companies hit the persisted cache instead of
        # re-querying Clearbit (see utils/logo_lookup.py).
        for posting in postings:
            if not posting.logo_url:
                posting.logo_url = find_logo_url(posting.company, conn)

        for posting in postings:
            if upsert_job(conn, posting):
                saved += 1
                if posting.source == "linkedin":
                    if flag_if_repost(conn, posting, repost_cutoff, REPOST_THRESHOLD) > REPOST_THRESHOLD:
                        flagged_reposts += 1
        conn.commit()  # one commit for the whole batch, not one per posting
        if flagged_reposts:
            logger.info(
                "Flagged %d/%d saved postings from %s as likely ghost listings "
                "(same company+title posted >%d times in %d days)",
                flagged_reposts, saved, source, REPOST_THRESHOLD, REPOST_WINDOW_DAYS,
            )
        if mark_stale:
            mark_stale_inactive(conn, source=source, cutoff=run_started_at - timedelta(minutes=1))
    finally:
        conn.close()

    skipped = len(postings) - saved
    if skipped:
        logger.info("Skipped %d/%d postings from %s as near-duplicates", skipped, len(postings), source)

    return saved


def main() -> None:
    load_dotenv()
    parser = argparse.ArgumentParser(description="Run a job scrape for a given source.")
    parser.add_argument("--source", choices=sorted(SCRAPERS), required=True)
    parser.add_argument("--query", default="engineer", help="Keyword filter, e.g. 'backend engineer'")
    parser.add_argument("--location", default=None)
    args = parser.parse_args()

    count = run_source(args.source, args.query, args.location)
    logger.info("Done: %d jobs upserted for source=%s", count, args.source)


if __name__ == "__main__":
    main()
