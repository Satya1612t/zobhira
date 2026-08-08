"""Ashby — Stage 4. Public, unauthenticated, no API key. Best structured
salary data of any of these feeds when compensation is disclosed (see
`includeCompensation=true`) — not consumed yet (salary_min/max left None),
future work once a representative posting with compensation is found to
confirm the shape.

Schema confirmed live (openai/elevenlabs/harvey/notion boards):
GET https://api.ashbyhq.com/posting-api/job-board/{name}?includeCompensation=true
-> {"jobs": [...], "apiVersion": "1"}

    id                              -> external_id
    title                           -> title
    location                        -> location (plain string, e.g. "New
                                        York, NY" — often has no country
                                        qualifier, same caveat as Lever)
    address.postalAddress.addressCountry -> full country name (e.g.
                                        "India", not an ISO code) — folded
                                        into `location` for the same reason
                                        as lever.py.
    employmentType                  -> employment_type ("FullTime", "Intern", ...)
    department                      -> tags seed
    descriptionHtml                 -> description
    publishedAt (ISO 8601)          -> posted_at
    jobUrl                          -> source_url
    applyUrl                        -> apply_url
"""

from __future__ import annotations

from datetime import datetime

from feeds.feed_base import FeedJobPosting, FeedScraper
from utils.text import strip_html

_BOARD_URL = "https://api.ashbyhq.com/posting-api/job-board/{token}?includeCompensation=true"


def _parse_posted_at(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None


class AshbyFeedScraper(FeedScraper):
    provider = "ashby"
    source_name = "ashby"

    def board_url(self, ats_token: str) -> str:
        return _BOARD_URL.format(token=ats_token)

    def normalize_board(self, company: dict, payload) -> list[FeedJobPosting]:
        raw_jobs = (payload or {}).get("jobs", [])
        postings: list[FeedJobPosting] = []
        for raw_job in raw_jobs:
            location = raw_job.get("location") or None
            address_country = (
                ((raw_job.get("address") or {}).get("postalAddress") or {}).get("addressCountry")
            )
            if address_country and address_country.strip().lower() == "india" and (
                not location or "india" not in location.lower()
            ):
                location = f"{location}, India" if location else "India"

            department = raw_job.get("department")
            job_url = raw_job.get("jobUrl")
            external_id = raw_job.get("id")

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
                    source_url=job_url or "",
                    description=strip_html(raw_job.get("descriptionHtml")),
                    tags=[department] if department else [],
                    posted_at=_parse_posted_at(raw_job.get("publishedAt")),
                    employment_type=raw_job.get("employmentType"),
                    logo_url=None,
                    extraction_method="deterministic",
                    raw={"ashby_job_id": external_id, "ashby_address_country": address_country},
                    apply_url=raw_job.get("applyUrl") or job_url,
                    external_id=external_id,
                    company_id=company["id"],
                )
            )
        return postings
