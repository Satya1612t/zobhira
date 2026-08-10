"""Lever — Stage 4. Public, unauthenticated, no API key.

Schema confirmed live (epifi/highspot/zeta/outreach boards):
GET https://api.lever.co/v0/postings/{token}?mode=json -> a bare JSON array
(not wrapped in an object, unlike Greenhouse/Ashby/SmartRecruiters).

    id                    -> external_id
    text                  -> title
    categories.location   -> location (raw city string, often no country)
    country               -> ISO-2 code ("IN") — more reliable than the
                             location string alone, since Lever's location
                             field is frequently a bare city name with no
                             country qualifier ("Bangalore", not "Bangalore,
                             India"). Folded into `location` below so the
                             shared _feed_location_is_eligible() check in
                             run_feed.py (which only looks at the location
                             string) still catches these correctly.
    categories.commitment -> employment_type seed (raw string: "Full-time",
                             "Intern", etc.)
    categories.department -> tags seed
    description (HTML)    -> description
    createdAt (epoch ms)  -> posted_at
    hostedUrl             -> source_url
    applyUrl              -> apply_url
"""

from __future__ import annotations

from datetime import datetime, timezone

from feeds.feed_base import FeedJobPosting, FeedScraper
from utils.text import strip_html

_BOARD_URL = "https://api.lever.co/v0/postings/{token}?mode=json"


def _parse_posted_at(epoch_ms) -> datetime | None:
    if not epoch_ms:
        return None
    try:
        return datetime.fromtimestamp(int(epoch_ms) / 1000, tz=timezone.utc)
    except (ValueError, OSError):
        return None


class LeverFeedScraper(FeedScraper):
    provider = "lever"
    source_name = "lever"

    def board_url(self, ats_token: str) -> str:
        return _BOARD_URL.format(token=ats_token)

    def normalize_board(self, company: dict, payload) -> list[FeedJobPosting]:
        raw_jobs = payload if isinstance(payload, list) else []
        postings: list[FeedJobPosting] = []
        for raw_job in raw_jobs:
            categories = raw_job.get("categories") or {}
            location = categories.get("location") or None
            country = (raw_job.get("country") or "").strip().upper()
            # See module docstring: fold the authoritative country code into
            # the location string itself, since that's the only field the
            # shared India filter (run_feed.py::_feed_location_is_eligible)
            # actually looks at.
            if country == "IN" and (not location or "india" not in location.lower()):
                location = f"{location}, India" if location else "India"

            department = categories.get("department")
            hosted_url = raw_job.get("hostedUrl")
            external_id = raw_job.get("id")

            postings.append(
                FeedJobPosting(
                    title=raw_job.get("text") or "",
                    company=company["name"],
                    location=location,
                    workplace_type="unknown",
                    salary_min=None,
                    salary_max=None,
                    salary_currency=None,
                    source=self.source_name,
                    source_url=hosted_url or "",
                    description=strip_html(raw_job.get("description")),
                    tags=[department] if department else [],
                    posted_at=_parse_posted_at(raw_job.get("createdAt")),
                    employment_type=categories.get("commitment"),
                    logo_url=None,
                    extraction_method="deterministic",
                    raw={"lever_posting_id": external_id, "lever_country": country},
                    apply_url=raw_job.get("applyUrl") or hosted_url,
                    external_id=external_id,
                    company_id=company["id"],
                )
            )
        return postings
