import argparse
import logging
from datetime import datetime, timedelta, timezone

from dotenv import load_dotenv

from db.repository import connect, mark_stale_inactive_contests, upsert_contest
from scrapers.contest_base import BaseContestScraper
from scrapers.dev_community import DevCommunityScraper
from utils.contest_summarizer import summarize_contest

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
logger = logging.getLogger(__name__)

# Structural essentials — can't be created by the LLM gap-fill step, so
# checked first, before spending an LLM call on a posting that has no
# title/link to begin with.
BASE_FIELDS = ("title", "platform", "source_url")

# Strict guardrail, same spirit as jobs' 5-field rule
# (scripts/run_scrape.py::has_mandatory_fields): a posting missing any of
# these can't be shown/registered for meaningfully, so it's discarded
# rather than stored. Checked AFTER the LLM gap-fill pass below, since for
# DEV Community (the only source now that Devpost has been removed —
# ToS-driven from Step 8 of the source guide, plus Devpost's no-card free
# API contributing no free-text description anyway) deadline_at only ever
# gets populated from the LLM extracting it out of the post's prose.
def has_mandatory_contest_fields(posting, *, now: datetime) -> bool:
    if not str(posting.title or "").strip():
        return False
    if not str(posting.description or "").strip():
        return False
    if posting.starts_at is None:
        return False
    if posting.deadline_at is None:
        return False
    if posting.deadline_at < now:  # "should be active" — nothing left to register for otherwise
        return False
    return True


CONTEST_SCRAPERS: dict[str, type[BaseContestScraper]] = {
    "dev_community": DevCommunityScraper,
}


def run_contest_source(source: str, mark_stale: bool = True) -> int:
    """No query/location/detail_limit/max_age_hours/max_results, unlike
    run_source() for jobs — each contest source is a single bounded fetch
    of "current listings" from a public feed, not a keyword-searched,
    per-item-enriched crawl."""
    scraper_cls = CONTEST_SCRAPERS[source]
    scraper = scraper_cls()

    run_started_at = datetime.now(timezone.utc)
    postings = scraper.scrape()
    logger.info("Scraped %d contest postings from %s", len(postings), source)

    before = len(postings)
    postings = [
        p for p in postings
        if all(str(getattr(p, field) or "").strip() for field in BASE_FIELDS)
    ]
    dropped = before - len(postings)
    if dropped:
        logger.info(
            "Discarded %d/%d contest postings from %s missing title/platform/source_url",
            dropped, before, source,
        )

    # Best-effort LLM rewrite (clean summary + highlight facts), plus a
    # gap-fill pass for structured facts (deadline/mode/prize) the feed
    # itself didn't provide but the prose actually states — e.g. DEV
    # Community's RSS has no structured deadline field at all, yet posts
    # routinely say "submissions close July 20" in plain text. One call
    # per posting, tolerant of individual failures (a bad response from
    # one contest must not drop the rest of the batch), same philosophy as
    # the logo-lookup backfill in run_scrape.py. Runs once per scrape here
    # (not per page view), cached in the DB via upsert_contest below.
    for posting in postings:
        try:
            known_starts_at = posting.starts_at.date().isoformat() if posting.starts_at else None
            result = summarize_contest(posting.description, known_starts_at=known_starts_at)
            posting.summary = result["summary"]
            posting.highlights = result["highlights"]
            if posting.deadline_at is None and result["deadline"]:
                try:
                    posting.deadline_at = datetime.fromisoformat(result["deadline"]).replace(tzinfo=timezone.utc)
                except ValueError:
                    logger.warning("Could not parse LLM-extracted deadline %r for %r", result["deadline"], posting.title)
            if posting.mode == "unknown" and result["mode"]:
                posting.mode = result["mode"]
            if not posting.prize_summary and result["prize_summary"]:
                posting.prize_summary = result["prize_summary"]
        except Exception:
            logger.warning("Contest summarization failed for %r, leaving unset", posting.title)

    before_mandatory = len(postings)
    postings = [p for p in postings if has_mandatory_contest_fields(p, now=run_started_at)]
    dropped_mandatory = before_mandatory - len(postings)
    if dropped_mandatory:
        logger.info(
            "Discarded %d/%d contest postings from %s missing a mandatory field "
            "(title/description/start date/end date) or already past their deadline",
            dropped_mandatory, before_mandatory, source,
        )

    conn = connect()
    saved = 0
    try:
        for posting in postings:
            if upsert_contest(conn, posting):
                saved += 1
        conn.commit()  # one commit for the whole batch, not one per posting
        if mark_stale:
            mark_stale_inactive_contests(
                conn, source=source, cutoff=run_started_at - timedelta(minutes=1),
            )
    finally:
        conn.close()

    return saved


def main() -> None:
    load_dotenv()
    parser = argparse.ArgumentParser(description="Run a contest scrape for a given source.")
    parser.add_argument("--source", choices=sorted(CONTEST_SCRAPERS), required=True)
    args = parser.parse_args()

    count = run_contest_source(args.source)
    logger.info("Done: %d contests upserted for source=%s", count, args.source)


if __name__ == "__main__":
    main()
