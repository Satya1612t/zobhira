"""v2 CLI, parallel to scripts/run_scrape.py.

    python -m scripts.run_feed --provider greenhouse --dry-run   # prints, writes nothing
    python -m scripts.run_feed --provider greenhouse             # live

--dry-run is not optional to skip when validating a new provider or a newly
seeded batch of companies — see the plan's Stage 3 acceptance gate. It never
touches the `jobs` table; company_registry's etag/last_modified bookkeeping
(feeds/registry.py) still updates either way, since that's just conditional-
GET state, not data written to the shared table.
"""

from __future__ import annotations

import argparse
import logging

from dotenv import load_dotenv

from db.repository import connect
from feeds.feed_base import FeedScraper
from feeds.feed_repository import upsert_feed_job
from feeds.location_filter import is_eligible_location, is_india_location
from feeds.providers.adzuna import AdzunaFeedScraper
from feeds.providers.ashby import AshbyFeedScraper
from feeds.providers.careerjet import CareerjetFeedScraper
from feeds.providers.greenhouse import GreenhouseFeedScraper
from feeds.providers.jooble import JoobleFeedScraper
from feeds.providers.lever import LeverFeedScraper
from feeds.providers.recruitee import RecruiteeFeedScraper
from feeds.providers.smartrecruiters import SmartRecruitersFeedScraper
from feeds.providers.workable import WorkableFeedScraper
from feeds.providers.workday import WorkdayFeedScraper
from utils.field_enrichment import enrich_posting
from utils.job_formatter import format_job_description
from utils.logo_lookup import find_logo_url

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
logger = logging.getLogger(__name__)

PROVIDERS: dict[str, type[FeedScraper]] = {
    "greenhouse": GreenhouseFeedScraper,
    "lever": LeverFeedScraper,
    "ashby": AshbyFeedScraper,
    "smartrecruiters": SmartRecruitersFeedScraper,
    "workable": WorkableFeedScraper,
    "recruitee": RecruiteeFeedScraper,
    "adzuna": AdzunaFeedScraper,
    "jooble": JoobleFeedScraper,
    "careerjet": CareerjetFeedScraper,
    "workday": WorkdayFeedScraper,
}

# Deliberately NOT reusing run_scrape.py::is_india_or_remote here — live-
# tested and found unsafe for feed sources. That function trusts
# `workplace_type == 'remote'` unconditionally for every source except
# ycombinator (whose own docstring explains why: YC postings often say
# "remote" while restricting it to specific countries in a parenthetical).
# Greenhouse postings have the exact same problem in prose form, just more
# often: e.g. a real Samsara "Account Executive, Commercial" posting whose
# location is literally "Seattle, WA" got its workplace_type flipped to
# 'remote' by enrich_posting's description-text inference, because the JD
# body said "This is a remote position open to candidates residing in the
# US." — is_india_or_remote would have accepted that as India-eligible
# despite the location field never mentioning India (or even being remote
# in a way an Indian candidate could take). Confirmed live: reusing
# is_india_or_remote here let ~1180 non-India postings through vs ~20 with
# this check.
#
# Greenhouse's `location.name` is clean structured data (see
# providers/greenhouse.py's mapping table) — real India-eligible postings
# always say so directly in location itself ("India", "Bengaluru, India",
# "Remote - India", "Remote India"), so trusting that field alone is both
# simpler and safer than trusting body-text-inferred workplace_type. The
# India/global-remote rule itself lives in feeds/location_filter.py so every
# provider (incl. workday's own pre-filter) reuses the exact same logic.
def _feed_location_is_eligible(posting) -> bool:
    return is_eligible_location(posting.location)


def _dedupe_by_external_id(postings: list) -> list:
    """Collapse postings sharing (source, external_id) to one, preferring an
    India-located variant. Preserves input order for the kept postings."""
    chosen: dict = {}
    order: list = []
    passthrough: list = []
    for p in postings:
        ext = getattr(p, "external_id", None)
        if not ext:
            passthrough.append(p)
            continue
        key = (getattr(p, "source", None), ext)
        existing = chosen.get(key)
        if existing is None:
            chosen[key] = p
            order.append(key)
        elif is_india_location(p.location) and not is_india_location(existing.location):
            # Upgrade to the India-located variant of the same job.
            chosen[key] = p
    return [chosen[k] for k in order] + passthrough


def run_feed_provider(provider: str, dry_run: bool = False, use_llm: bool = True, tier: int | None = None) -> int:
    scraper_cls = PROVIDERS[provider]
    scraper = scraper_cls()
    # tier=None sweeps every active company for the provider (manual "Run
    # now"); an int restricts to that polling tier (Stage 7, see
    # feed_scheduler.py). Set before scrape() so scrape_list() reads it.
    scraper.tier = tier
    postings = scraper.scrape()
    logger.info("Fetched %d postings from feed provider=%s (tier=%s)", len(postings), provider, tier)

    # Eligibility filter FIRST, on the raw pre-enrichment location field — see
    # _feed_location_is_eligible's docstring above for why this deliberately
    # doesn't wait for (or use) enrich_posting's workplace_type inference.
    # A global board like Greenhouse's returns every country's openings in
    # one call, and this platform is India-focused (CLAUDE.md's stated
    # invariant), so without this a provider like Cloudflare/Samsara would
    # flood the shared `jobs` table with hundreds of non-India roles. Accepts
    # India-located AND truly-global-remote roles (an India candidate can take
    # the latter); country-scoped remote is still dropped.
    before = len(postings)
    postings = [p for p in postings if _feed_location_is_eligible(p)]
    dropped = before - len(postings)
    if dropped:
        logger.info("Dropped %d/%d postings from feed provider=%s: location not India or global-remote", dropped, before, provider)

    # De-dupe within this run by (source, external_id). One board job listed at
    # several locations (e.g. India + Remote-Worldwide) comes back once per
    # location with the SAME external_id but a different dedup_key; both now
    # pass the filter above, and storing both would violate the jobs table's
    # (source, external_id) unique index. Keep ONE, preferring the India-
    # located variant so the portal shows the India office over a generic
    # "Remote - Worldwide". Postings with no external_id (shouldn't happen for
    # feeds, but be safe) are all kept.
    postings = _dedupe_by_external_id(postings)

    # Enrich only the survivors — cheaper than v1's enrich-then-filter order
    # (run_scrape.py::run_source) and safe here specifically because the
    # filter above never depends on anything enrich_posting produces (unlike
    # is_india_or_remote's workplace_type dependency, which is exactly what
    # made that ordering necessary — and unsafe — above).
    for posting in postings:
        enrich_posting(posting, use_llm=use_llm)

    # Scrape-time description formatting — REQUIRED for public visibility:
    # apps/web's listing query and job detail page both gate on
    # formattedDescription being non-null (see jobQuery.ts, jobs/[id]/page.tsx
    # — a job with no formatted_description is treated as "not yet ready to
    # show", same as a stub with no description at all). Unlike
    # run_scrape.py::run_source's format_posting_with_breaker (which only
    # persists a result when the real LLM structuring pass succeeds, and
    # silently leaves formatted_description NULL otherwise so a fully
    # exhausted/billing-blocked provider chain means NOTHING becomes
    # visible), this always takes format_job_description's result —
    # including its deterministic-cleanup-only fallback — since some
    # visible content is strictly better than a job that can never be
    # found. Opportunistically upgrades to the real LLM-structured version
    # whenever use_llm=True and a provider actually succeeds.
    for posting in postings:
        result = format_job_description(posting.description, use_llm=use_llm)
        posting.formatted_description = result["formatted_description"]
        posting.highlights = result["highlights"]

    if dry_run:
        for posting in postings:
            desc_words = len((posting.description or "").split())
            logger.info(
                "[dry-run] %-40s | %-30s | %-25s | desc=%dw | apply=%s",
                posting.title[:40], posting.company[:30], (posting.location or "?")[:25],
                desc_words, posting.apply_url,
            )
        return len(postings)

    conn = connect()
    saved = 0
    try:
        # Best-effort logo backfill (same helper + persisted company_domains
        # cache v1 uses in run_scrape.py::run_source) — Greenhouse's board
        # JSON has no logo field at all, so without this every feed-sourced
        # job would show no company logo.
        for posting in postings:
            if not posting.logo_url:
                posting.logo_url = find_logo_url(posting.company, conn)

        for posting in postings:
            if upsert_feed_job(conn, posting):
                saved += 1
        conn.commit()
    finally:
        conn.close()

    skipped = len(postings) - saved
    if skipped:
        logger.info("Skipped %d/%d postings from feed provider=%s: missing mandatory fields", skipped, len(postings), provider)
    return saved


def main() -> None:
    load_dotenv()
    parser = argparse.ArgumentParser(description="Run a v2 feed poll for a given ATS provider.")
    parser.add_argument("--provider", choices=sorted(PROVIDERS), required=True)
    parser.add_argument("--dry-run", action="store_true", help="Print postings instead of writing to the jobs table.")
    parser.add_argument(
        "--no-llm", action="store_true",
        help="Skip the LLM gap-fill/formatting steps entirely — recommended while the "
             "LLM provider chain is billing-blocked/rate-limited, since with it left on "
             "a single ambiguous posting can retry every dead provider for several "
             "minutes before giving up (see feed_scheduler.py, which already defaults "
             "to this for the scheduled daily run).",
    )
    args = parser.parse_args()

    count = run_feed_provider(args.provider, dry_run=args.dry_run, use_llm=not args.no_llm)
    if args.dry_run:
        logger.info("Done: %d postings fetched (dry-run, nothing written) for provider=%s", count, args.provider)
    else:
        logger.info("Done: %d jobs upserted for provider=%s", count, args.provider)


if __name__ == "__main__":
    main()
