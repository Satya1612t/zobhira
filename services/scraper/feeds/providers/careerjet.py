"""Careerjet — Stage 5 aggregator. Same keyed/query-driven/daily-only/
indirect-link shape as adzuna.py & jooble.py; see adzuna.py's docstring for
the shared rationale.

GET http://public.api.careerjet.net/search
    ?locale_code=en_IN&keywords=...&location=india&affid={CAREERJET_AFFID}
    &user_ip=...&user_agent=...&pagesize=...&sort=date
Requires a `Referer` header (the API rejects the call without one).
-> {"jobs": [{
    title, description (HTML preview), company, locations (free string,
    e.g. "Bangalore, Karnataka" — often no country token, and NOT reliably
    India even with location=india: non-India results leak in), salary,
    date (RFC-2822, e.g. "Sat, 08 Aug 2026 07:59:05 GMT"),
    url (jobviewtrack.com redirect — INDIRECT), site
}]}

TWO Careerjet-specific quirks handled here:
  - No stable job id in the response — external_id stays None; dedup falls
    back to dedup_key (company/title/location), which upsert_feed_job uses
    anyway.
  - `location=india` is only a hint; foreign cities leak through AND real
    Indian rows are often bare "City, State" with no "india" token for
    run_feed.py's India filter to catch. So the normalizer appends ", India"
    only when the location matches a known Indian city/state — which both
    rescues "Bangalore, Karnataka" and lets "Santa Clara, California" fall
    through to be dropped.

Missing CAREERJET_AFFID -> logs "skipped" and returns nothing.
"""

from __future__ import annotations

import logging
import os
from datetime import datetime
from email.utils import parsedate_to_datetime

from feeds.feed_base import FeedJobPosting, FeedScraper
from taxonomy import STREAM_QUERIES
from utils.rate_limit import throttle
from utils.text import strip_html

logger = logging.getLogger(__name__)

_API_URL = "http://public.api.careerjet.net/search"
_REFERER = "https://zobhira.com/jobs"
# Careerjet wants the end-user's IP/UA for its analytics; for a server-side
# poll a stable placeholder is fine (and honest — it IS a server calling).
_USER_IP = "203.0.113.10"
_USER_AGENT = "ZobhiraFeedBot/1.0"

# Indian city/state tokens — a location matching any of these is treated as
# India even when the raw string omits the country (see module docstring).
_INDIA_PLACE_TOKENS = {
    "india", "bangalore", "bengaluru", "mumbai", "pune", "hyderabad", "chennai",
    "delhi", "new delhi", "gurugram", "gurgaon", "noida", "kolkata", "ahmedabad",
    "jaipur", "kochi", "cochin", "ernakulam", "coimbatore", "chandigarh", "indore",
    "nagpur", "lucknow", "thiruvananthapuram", "trivandrum", "mysore", "mysuru",
    "vadodara", "visakhapatnam", "vizag", "bhubaneswar", "patna", "surat",
    "karnataka", "maharashtra", "telangana", "tamil nadu", "kerala", "gujarat",
    "west bengal", "uttar pradesh", "haryana", "rajasthan", "punjab",
    "madhya pradesh", "andhra pradesh", "bihar", "odisha",
}


def _parse_posted_at(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return parsedate_to_datetime(value)
    except (TypeError, ValueError):
        return None


def _looks_indian(location: str) -> bool:
    low = location.lower()
    return any(token in low for token in _INDIA_PLACE_TOKENS)


class CareerjetFeedScraper(FeedScraper):
    provider = "careerjet"
    source_name = "careerjet"

    def scrape_list(self, query=None, location=None, browser=None) -> list[FeedJobPosting]:
        if self.tier is not None and self.tier != 3:
            return []  # daily-only, same as the other aggregators

        affid = os.environ.get("CAREERJET_AFFID")
        if not affid:
            logger.info("careerjet: CAREERJET_AFFID not set — skipped")
            return []

        from feeds import feed_http

        out: list[FeedJobPosting] = []
        seen_urls: set[str] = set()
        base_params = {
            "locale_code": "en_IN",
            "location": "india",
            "affid": affid,
            "user_ip": _USER_IP,
            "user_agent": _USER_AGENT,
            "pagesize": 50,
            "sort": "date",
        }
        with feed_http.make_client() as client:
            for term in STREAM_QUERIES:
                throttle(_API_URL)
                try:
                    response = client.get(
                        _API_URL,
                        params={**base_params, "keywords": term},
                        headers={"Referer": _REFERER},
                    )
                    response.raise_for_status()
                    data = response.json()
                except Exception as exc:  # noqa: BLE001 — one bad query must not sink the run
                    logger.warning("careerjet query=%r failed: %s", term, exc)
                    continue

                for result in data.get("jobs", []):
                    url = result.get("url")
                    if not url or url in seen_urls:
                        continue
                    seen_urls.add(url)
                    posting = self._normalize(result, url)
                    if posting:
                        out.append(posting)
        logger.info("careerjet: %d postings across %d stream queries", len(out), len(STREAM_QUERIES))
        return out

    def _normalize(self, result: dict, url: str) -> FeedJobPosting | None:
        company = result.get("company")
        location = result.get("locations")
        if not company or not location:
            return None
        # Rescue bare "City, State" India rows; leave foreign ones untouched
        # so run_feed.py's India filter drops them.
        if _looks_indian(location) and "india" not in location.lower():
            location = f"{location}, India"

        return FeedJobPosting(
            title=result.get("title") or "",
            company=company,
            location=location,
            workplace_type="unknown",
            salary_min=None,
            salary_max=None,
            salary_currency=None,
            source=self.source_name,
            source_url=url,
            description=strip_html(result.get("description")),
            tags=[],
            posted_at=_parse_posted_at(result.get("date")),
            logo_url=None,
            extraction_method="deterministic",
            raw={
                "careerjet_origin": result.get("site"),
                # jobviewtrack.com redirect, not the employer directly.
                "flagged_indirect": True,
            },
            apply_url=url,
            external_id=None,  # Careerjet exposes no stable id — dedup via dedup_key
            company_id=None,
        )
