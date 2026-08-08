"""Greenhouse — the Stage 3 pilot connector (see the v2 plan, §6). Chosen
first because `?content=true` returns the full job description in the same
list call that returns titles/locations, so there's no per-job detail pass
at all: `enrich()` stays the no-op FeedScraper already provides.

Public, unauthenticated, no API key: https://developers.greenhouse.io/job-board.html
"""

from __future__ import annotations

import html
from datetime import datetime

from feeds.feed_base import FeedJobPosting, FeedScraper
from utils.text import strip_html

_BOARD_URL = "https://boards-api.greenhouse.io/v1/boards/{token}/jobs?content=true"


def _parse_posted_at(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None


class GreenhouseFeedScraper(FeedScraper):
    provider = "greenhouse"
    source_name = "greenhouse"

    def board_url(self, ats_token: str) -> str:
        return _BOARD_URL.format(token=ats_token)

    def normalize_board(self, company: dict, payload) -> list[FeedJobPosting]:
        raw_jobs = (payload or {}).get("jobs", [])
        postings: list[FeedJobPosting] = []
        for raw_job in raw_jobs:
            location = (raw_job.get("location") or {}).get("name")
            description = strip_html(html.unescape(raw_job.get("content") or ""))
            departments = [d.get("name") for d in raw_job.get("departments") or [] if d.get("name")]
            absolute_url = raw_job.get("absolute_url")
            external_id = str(raw_job.get("id")) if raw_job.get("id") is not None else None

            postings.append(
                FeedJobPosting(
                    title=raw_job.get("title") or "",
                    company=company["name"],
                    location=location,
                    workplace_type="unknown",
                    salary_min=None,
                    salary_max=None,
                    salary_currency=None,
                    source=self.source_name,
                    source_url=absolute_url or "",
                    description=description,
                    tags=list(departments),
                    posted_at=_parse_posted_at(raw_job.get("updated_at")),
                    logo_url=None,
                    extraction_method="deterministic",
                    raw={"greenhouse_job_id": raw_job.get("id")},
                    apply_url=absolute_url,
                    external_id=external_id,
                    company_id=company["id"],
                )
            )
        return postings
