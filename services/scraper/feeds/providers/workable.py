"""Workable — Stage 4. Public, unauthenticated, no API key.

⚠️ UNVERIFIED AGAINST A LIVE NON-EMPTY BOARD. Every real company account
checked during this stage (buffer, zapier, depop, revolut, ...) currently
has zero open postings on Workable's public widget, so the per-job field
names below are the officially documented shape (Workable's own "jobs
widget" API docs), NOT confirmed against real response data — unlike every
other provider in this package. The plan's own notes flagged this
("Verify the path; it has changed before"). Before trusting this
connector's output, find one real company with active Workable postings,
compare the actual response shape against this file, and update this
docstring once confirmed.

GET https://apply.workable.com/api/v1/widget/accounts/{token}?details=true
-> {"name", "description", "jobs": [{
    title, shortcode, code, employment_type, telecommuting (bool),
    department, url (board page), application_url, shortlink,
    published_on (date), country, city, region
}]}
No per-job description in the list response even with details=true (per
docs) — descriptions require a separate authenticated endpoint Workable
doesn't expose publicly, so `description` stays unset here (same
"stub, backfilled later if ever" pattern MANDATORY_FIELDS already
tolerates for postings with no description).
"""

from __future__ import annotations

from datetime import date, datetime

from feeds.feed_base import FeedJobPosting, FeedScraper

_BOARD_URL = "https://apply.workable.com/api/v1/widget/accounts/{token}?details=true"


def _parse_posted_at(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.combine(date.fromisoformat(value), datetime.min.time())
    except ValueError:
        return None


class WorkableFeedScraper(FeedScraper):
    provider = "workable"
    source_name = "workable"

    def board_url(self, ats_token: str) -> str:
        return _BOARD_URL.format(token=ats_token)

    def normalize_board(self, company: dict, payload) -> list[FeedJobPosting]:
        raw_jobs = (payload or {}).get("jobs", [])
        postings: list[FeedJobPosting] = []
        for raw_job in raw_jobs:
            country = (raw_job.get("country") or "").strip()
            city = raw_job.get("city")
            location = ", ".join(part for part in (city, country) if part) or None
            if country.lower() == "india" and location and "india" not in location.lower():
                location = f"{location}, India"

            board_url = raw_job.get("url")
            external_id = raw_job.get("shortcode")
            department = raw_job.get("department")

            postings.append(
                FeedJobPosting(
                    title=raw_job.get("title") or "",
                    company=company["name"],
                    location=location,
                    workplace_type="remote" if raw_job.get("telecommuting") else "unknown",
                    salary_min=None,
                    salary_max=None,
                    salary_currency=None,
                    source=self.source_name,
                    source_url=board_url or "",
                    description=None,
                    tags=[department] if department else [],
                    posted_at=_parse_posted_at(raw_job.get("published_on")),
                    employment_type=raw_job.get("employment_type"),
                    logo_url=None,
                    extraction_method="deterministic",
                    raw={"workable_shortcode": external_id},
                    apply_url=raw_job.get("application_url") or board_url,
                    external_id=external_id,
                    company_id=company["id"],
                )
            )
        return postings
