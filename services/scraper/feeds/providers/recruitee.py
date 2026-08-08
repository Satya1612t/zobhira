"""Recruitee — Stage 4, lowest India density per the plan (do last). Public,
unauthenticated, no API key.

Schema confirmed live (personio.recruitee.com — a real, currently-active
Recruitee-hosted board, even though its actual postings are sandbox/demo
content, not a real hiring company — the JSON shape itself is genuine
production Recruitee API output):

GET https://{company}.recruitee.com/api/offers/
-> {"offers": [{
    title, slug, careers_url, description (HTML, English top-level field —
    NOT under `translations`, which holds other-language copies),
    locations: [{name, city, country (full name, e.g. "India" or
                 "Deutschland" — not an ISO code), country_code (ISO-2)}],
    employment_type_code, remote (bool), hybrid (bool),
    updated_at (e.g. "2025-01-02 18:53:43 UTC")
}]}
"""

from __future__ import annotations

from datetime import datetime

from feeds.feed_base import FeedJobPosting, FeedScraper
from utils.text import strip_html

_BOARD_URL = "https://{token}.recruitee.com/api/offers/"


def _parse_posted_at(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.strptime(value, "%Y-%m-%d %H:%M:%S %Z")
    except ValueError:
        return None


class RecruiteeFeedScraper(FeedScraper):
    provider = "recruitee"
    source_name = "recruitee"

    def board_url(self, ats_token: str) -> str:
        return _BOARD_URL.format(token=ats_token)

    def normalize_board(self, company: dict, payload) -> list[FeedJobPosting]:
        raw_jobs = (payload or {}).get("offers", [])
        postings: list[FeedJobPosting] = []
        for raw_job in raw_jobs:
            locations = raw_job.get("locations") or []
            first_location = locations[0] if locations else {}
            country_code = (first_location.get("country_code") or "").strip().upper()
            location = first_location.get("name") or first_location.get("city")
            if country_code == "IN" and location and "india" not in location.lower():
                location = f"{location}, India"

            careers_url = raw_job.get("careers_url")
            external_id = raw_job.get("slug")

            postings.append(
                FeedJobPosting(
                    title=raw_job.get("title") or "",
                    company=company["name"],
                    location=location,
                    workplace_type="remote" if raw_job.get("remote") else ("hybrid" if raw_job.get("hybrid") else "unknown"),
                    salary_min=None,
                    salary_max=None,
                    salary_currency=None,
                    source=self.source_name,
                    source_url=careers_url or "",
                    description=strip_html(raw_job.get("description")),
                    tags=[],
                    posted_at=_parse_posted_at(raw_job.get("updated_at")),
                    employment_type=raw_job.get("employment_type_code"),
                    logo_url=None,
                    extraction_method="deterministic",
                    raw={"recruitee_slug": external_id},
                    apply_url=careers_url,
                    external_id=external_id,
                    company_id=company["id"],
                )
            )
        return postings
