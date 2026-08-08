"""Jooble — Stage 5 aggregator. Same shape as adzuna.py (keyed, query-driven,
daily-only, indirect links) — see that module's docstring for the shared
rationale. Differences: Jooble is a POST API (JSON body, key in the URL
path) and searches by free-text keywords + location rather than Adzuna's
country-index path.

POST https://jooble.org/api/{JOOBLE_API_KEY}   body {"keywords","location"}
-> {"totalCount", "jobs": [{
    title, company, location, snippet (HTML preview, not full description),
    salary, source (the original board's host), type (employment type),
    link (jooble.org/jdp/... — INDIRECT, redirects through Jooble),
    updated (ISO 8601), id
}]}

Missing JOOBLE_API_KEY -> logs "skipped" and returns nothing.
"""

from __future__ import annotations

import logging
import os
from datetime import datetime

from feeds.feed_base import FeedJobPosting, FeedScraper
from taxonomy import STREAM_QUERIES
from utils.rate_limit import throttle
from utils.text import strip_html

logger = logging.getLogger(__name__)

_API_URL = "https://jooble.org/api/{key}"
_LOCATION = "India"


def _parse_posted_at(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None


class JoobleFeedScraper(FeedScraper):
    provider = "jooble"
    source_name = "jooble"

    def scrape_list(self, query=None, location=None, browser=None) -> list[FeedJobPosting]:
        if self.tier is not None and self.tier != 3:
            return []  # daily-only, same as Adzuna

        key = os.environ.get("JOOBLE_API_KEY")
        if not key:
            logger.info("jooble: JOOBLE_API_KEY not set — skipped")
            return []

        from feeds import feed_http

        url = _API_URL.format(key=key)
        out: list[FeedJobPosting] = []
        seen_ids: set[str] = set()
        with feed_http.make_client() as client:
            for term in STREAM_QUERIES:
                throttle(url)
                try:
                    response = client.post(url, json={"keywords": term, "location": _LOCATION})
                    response.raise_for_status()
                    data = response.json()
                except Exception as exc:  # noqa: BLE001 — one bad query must not sink the run
                    logger.warning("jooble query=%r failed: %s", term, exc)
                    continue

                for result in data.get("jobs", []):
                    external_id = str(result.get("id")) if result.get("id") is not None else None
                    if not external_id or external_id in seen_ids:
                        continue
                    seen_ids.add(external_id)
                    posting = self._normalize(result, external_id)
                    if posting:
                        out.append(posting)
        logger.info("jooble: %d postings across %d stream queries", len(out), len(STREAM_QUERIES))
        return out

    def _normalize(self, result: dict, external_id: str) -> FeedJobPosting | None:
        company = result.get("company")
        if not company:
            return None

        location = result.get("location") or _LOCATION
        if "india" not in location.lower():
            location = f"{location}, India"
        link = result.get("link")

        return FeedJobPosting(
            title=result.get("title") or "",
            company=company,
            location=location,
            workplace_type="unknown",
            salary_min=None,
            salary_max=None,
            salary_currency=None,
            source=self.source_name,
            source_url=link or "",
            description=strip_html(result.get("snippet")),
            tags=[],
            posted_at=_parse_posted_at(result.get("updated")),
            employment_type=result.get("type"),
            logo_url=None,
            extraction_method="deterministic",
            raw={
                "jooble_id": external_id,
                "jooble_origin": result.get("source"),
                # Jooble's link redirects through jooble.org, not the
                # employer/original board directly — flag, don't reject.
                "flagged_indirect": True,
            },
            apply_url=link,
            external_id=external_id,
            company_id=None,
        )
