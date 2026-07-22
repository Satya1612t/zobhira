import argparse
import logging
from datetime import datetime, timedelta, timezone

from dotenv import load_dotenv

from db.repository import connect, mark_stale_inactive, upsert_job
from designation_classifier import classify_title
from scrapers.base import BaseJobScraper
from scrapers.linkedin import LinkedInScraper
from scrapers.remoteok import RemoteOKScraper
from scrapers.talentd import TalentdScraper
from scrapers.ycombinator import YCombinatorScraper
from utils.logo_lookup import find_logo_url

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
logger = logging.getLogger(__name__)

# A posting missing any of these can't be shown/applied to meaningfully (no
# way to identify the employer, describe the role, locate it, or reach it),
# so it's discarded rather than stored. `source_url` doubles as the "apply
# link" here — every scraper already points it at the canonical job posting
# page (third-party ATS or the source site itself), there's no separate
# apply-link field in the schema.
MANDATORY_FIELDS = ("title", "company", "description", "source_url", "location")


def has_mandatory_fields(posting) -> bool:
    """Shared with api.py's live-search upsert path, not just this CLI/
    scheduler one — both must enforce the same rule before anything reaches
    the DB."""
    return all(str(getattr(posting, field) or "").strip() for field in MANDATORY_FIELDS)

SCRAPERS: dict[str, type[BaseJobScraper]] = {
    "ycombinator": YCombinatorScraper,
    "remoteok": RemoteOKScraper,
    "talentd": TalentdScraper,
    "linkedin": LinkedInScraper,
}


def run_source(
    source: str,
    query: str,
    location: str | None,
    mark_stale: bool = True,
    detail_limit: int | None = None,
    max_age_hours: int | None = None,
    max_results: int | None = None,
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

    Every posting must have title/company/description/location/source_url
    (see MANDATORY_FIELDS) or it's discarded before ever reaching the DB —
    it can't be shown or applied to meaningfully otherwise. Note this drops
    a meaningful share of Talentd/YC postings that don't get the per-job
    detail-page enrichment pass (bounded by `detail_limit`), since those
    stay description-less. A missing logo alone doesn't get a posting
    discarded — find_logo_url() tries a best-effort lookup instead."""
    scraper_cls = SCRAPERS[source]
    scraper = scraper_cls()

    run_started_at = datetime.now(timezone.utc)
    postings = scraper.scrape(query=query, location=location, detail_limit=detail_limit)
    logger.info("Scraped %d postings from %s", len(postings), source)

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

    # The scheduler now searches one broad query per stream (see
    # taxonomy.STREAM_QUERIES) instead of all 58 exact designations, so
    # this recovers per-designation granularity from the title text for
    # browse/filter use. Appended, not replacing, any tags a scraper
    # already set from the source itself (e.g. RemoteOK's real skill tags).
    for posting in postings:
        for designation in classify_title(posting.title):
            if designation not in posting.tags:
                posting.tags.append(designation)

    before_mandatory = len(postings)
    postings = [p for p in postings if has_mandatory_fields(p)]
    dropped_mandatory = before_mandatory - len(postings)
    if dropped_mandatory:
        logger.info(
            "Discarded %d/%d postings from %s missing a mandatory field "
            "(title/company/description/location/apply link)",
            dropped_mandatory, before_mandatory, source,
        )

    # Best-effort logo backfill for whatever survived the mandatory-field
    # filter above — a missing logo alone doesn't get a posting discarded,
    # unlike the five fields above.
    for posting in postings:
        if not posting.logo_url:
            posting.logo_url = find_logo_url(posting.company)

    conn = connect()
    saved = 0
    try:
        for posting in postings:
            if upsert_job(conn, posting):
                saved += 1
        conn.commit()  # one commit for the whole batch, not one per posting
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
