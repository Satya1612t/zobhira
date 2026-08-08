"""v2: reads a hiring-platform's public JSON board directly, instead of
rendering a page with Playwright and scraping it. See feeds/providers/ for
concrete connectors (Greenhouse first — feeds/providers/greenhouse.py).

Subclasses scrapers/base.py::BaseJobScraper (frozen) so the JobPosting
contract and every downstream consumer (db/repository.py's upsert, the web
app's Prisma queries) stay identical to v1. Differences from a v1 scraper:
  - never touches Playwright; `browser` is accepted and ignored
  - `query`/`location` are ignored: a board returns the company's whole
    open list in one call, so there is nothing to keyword-search (same
    shape as Talentd/YC, which are also swept once per run with no
    server-side search)
  - `enrich()` is a no-op for every provider except SmartRecruiters
    (Stage 4 — its description needs a second call the list endpoint
    doesn't include)
  - uses its own HTTP client (feed_http.py) with conditional GET, not
    utils/http.py's UA-rotating client — see feed_http.py's docstring
"""

from __future__ import annotations

import logging
from dataclasses import dataclass

from scrapers.base import BaseJobScraper, JobPosting, RateLimitedError
from utils.rate_limit import throttle

from . import feed_http, registry

logger = logging.getLogger(__name__)


@dataclass
class FeedJobPosting(JobPosting):
    """JobPosting plus the three columns only feed sources populate (see
    db/migrations/0023_job_feed_columns.sql). A subclass rather than editing
    the frozen JobPosting itself — every new field has a default, so it
    slots in after JobPosting's own defaulted fields with no reordering
    issue. feed_repository.py reads these three; db/repository.py (v1's
    upsert, frozen) never sees them."""

    apply_url: str | None = None
    external_id: str | None = None
    company_id: int | None = None


class FeedScraper(BaseJobScraper):
    provider: str
    # Set by run_feed.py::run_feed_provider before scraping. None means
    # "every active company for this provider" (a manual full sweep); an int
    # restricts to that polling tier only (Stage 7 tiered cadence — see
    # feed_scheduler.py). An instance attribute rather than a scrape_list()
    # parameter so it doesn't have to thread through the frozen
    # BaseJobScraper.scrape_list contract.
    tier: int | None = None

    def board_url(self, ats_token: str) -> str:
        """Full URL for this provider's board API, given one company's
        token. Implemented by each provider (feeds/providers/*.py)."""
        raise NotImplementedError

    def normalize_board(self, company: dict, payload) -> list[JobPosting]:
        """Turns one company's raw board JSON into JobPostings. `company` is
        the company_registry row (dict: id/name/slug/ats_token/careers_url/
        country_hint/tier/...) — `company` (not the payload) is always the
        source of truth for JobPosting.company, since some boards' JSON
        omits the company name entirely (it's implicit in the URL)."""
        raise NotImplementedError

    def scrape_list(self, query=None, location=None, browser=None) -> list[JobPosting]:
        companies = registry.active_companies(self.provider, tier=self.tier)
        if not companies:
            logger.info("feed provider=%s: no active companies in company_registry (tier=%s)", self.provider, self.tier)
            return []

        out: list[JobPosting] = []
        with feed_http.make_client() as client:
            for company in companies:
                url = self.board_url(company["ats_token"])
                throttle(url)
                try:
                    response = feed_http.conditional_get(
                        client, url,
                        etag=company["etag"], last_modified=company["last_modified"],
                    )
                except RateLimitedError:
                    # Same host serves every company on this provider — a
                    # 429 means back off entirely for this run rather than
                    # ploughing through the rest, same reasoning as v1's
                    # scheduler.py catching RateLimitedError per-source.
                    registry.record_error(company["id"], "rate limited (429)")
                    logger.warning(
                        "feed provider=%s company=%s rate limited — aborting rest of this run",
                        self.provider, company["slug"],
                    )
                    raise
                except Exception as exc:  # noqa: BLE001 — one bad company must not sink the run
                    registry.record_error(company["id"], str(exc))
                    logger.warning("feed provider=%s company=%s fetch failed: %s", self.provider, company["slug"], exc)
                    continue

                if response.not_modified:
                    registry.record_not_modified(company["id"])
                    continue

                try:
                    postings = self.normalize_board(company, response.json)
                except Exception as exc:  # noqa: BLE001 — a malformed payload must not sink the run
                    registry.record_error(company["id"], f"normalize failed: {exc}")
                    logger.warning("feed provider=%s company=%s normalize failed: %s", self.provider, company["slug"], exc)
                    continue

                out.extend(postings)
                registry.record_ok(company["id"], response.etag, response.last_modified)
                logger.info("feed provider=%s company=%s -> %d postings", self.provider, company["slug"], len(postings))

        return out

    def enrich(self, postings: list[JobPosting], detail_limit: int | None = None, browser=None) -> None:
        return

    def scrape(self, query=None, location=None, detail_limit=None, browser=None) -> list[JobPosting]:
        postings = self.scrape_list()
        self.enrich(postings, detail_limit=detail_limit)
        return postings
