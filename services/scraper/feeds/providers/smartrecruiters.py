"""SmartRecruiters — Stage 4. Public, unauthenticated, no API key. The only
feed provider where `enrich()` isn't a no-op: the list endpoint doesn't
include the job description at all, so a second per-job call is required
(same two-phase list/enrich shape v1's Playwright scrapers use, just HTTP
instead of a browser).

Schema confirmed live (visa/grab boards):

List: GET https://api.smartrecruiters.com/v1/companies/{token}/postings?limit=200
-> {"offset", "limit", "totalFound", "content": [{
    id, name (title), uuid, releasedDate (ISO 8601),
    location: {city, region, country (lowercase ISO-2, e.g. "in"),
               remote, hybrid, fullLocation},
    department: {label}, typeOfEmployment: {label}, ref (detail API URL)
}]}
NOTE: limit=200 in one call — genuinely large boards (>200 open roles)
won't get full coverage from a single request yet; proper offset-paginated
looping is a follow-up, not needed for the pilot's small seeded boards.

Detail: GET https://api.smartrecruiters.com/v1/companies/{token}/postings/{id}
-> { jobAd: { sections: { companyDescription, jobDescription, qualifications,
     additionalInformation } (each {title, text}) }, postingUrl, applyUrl }
"""

from __future__ import annotations

import logging
from datetime import datetime

from feeds.feed_base import FeedJobPosting, FeedScraper
from feeds.feed_http import make_client
from utils.rate_limit import throttle
from utils.text import strip_html

logger = logging.getLogger(__name__)

_LIST_URL = "https://api.smartrecruiters.com/v1/companies/{token}/postings?limit=200"
_DETAIL_URL = "https://api.smartrecruiters.com/v1/companies/{token}/postings/{posting_id}"

_SECTION_KEYS = ("companyDescription", "jobDescription", "qualifications", "additionalInformation")


def _parse_posted_at(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None


class SmartRecruitersFeedScraper(FeedScraper):
    provider = "smartrecruiters"
    source_name = "smartrecruiters"

    def board_url(self, ats_token: str) -> str:
        return _LIST_URL.format(token=ats_token)

    def normalize_board(self, company: dict, payload) -> list[FeedJobPosting]:
        raw_jobs = (payload or {}).get("content", [])
        postings: list[FeedJobPosting] = []
        for raw_job in raw_jobs:
            location = raw_job.get("location") or {}
            country = (location.get("country") or "").strip().upper()
            # Filter to India HERE, before enrich() — unlike every other
            # provider, SmartRecruiters' enrich() makes one detail HTTP call
            # PER POSTING (see its docstring), and the generic India filter
            # in run_feed.py only runs after scrape() (list + enrich) both
            # complete. Without this, a large global board (live-confirmed:
            # Grab's 345 open roles) makes ~345 throttled detail calls just
            # to then throw away the ~344 non-India results — several
            # minutes wasted per run for nothing. SmartRecruiters' list
            # response already has a clean, authoritative `location.country`
            # field, so filtering this early costs nothing in accuracy.
            if country != "IN":
                continue
            location_str = location.get("fullLocation") or location.get("city")
            if location_str and "india" not in location_str.lower():
                location_str = f"{location_str}, India"

            employment = (raw_job.get("typeOfEmployment") or {}).get("label")
            department = (raw_job.get("department") or {}).get("label")
            external_id = raw_job.get("id")
            posting_url = f"https://jobs.smartrecruiters.com/{company['ats_token']}/{external_id}"

            postings.append(
                FeedJobPosting(
                    title=raw_job.get("name") or "",
                    company=company["name"],
                    location=location_str,
                    workplace_type="remote" if location.get("remote") else ("hybrid" if location.get("hybrid") else "unknown"),
                    salary_min=None,
                    salary_max=None,
                    salary_currency=None,
                    source=self.source_name,
                    # Placeholder until enrich() fills in the real
                    # postingUrl/applyUrl from the detail call — the list
                    # endpoint gives no direct board-page link, only `ref`
                    # (the *API* url, not a human page).
                    source_url=posting_url,
                    description=None,
                    tags=[department] if department else [],
                    posted_at=_parse_posted_at(raw_job.get("releasedDate")),
                    employment_type=employment,
                    logo_url=None,
                    extraction_method="deterministic",
                    raw={"smartrecruiters_posting_id": external_id, "smartrecruiters_token": company["ats_token"]},
                    apply_url=posting_url,
                    external_id=external_id,
                    company_id=company["id"],
                )
            )
        return postings

    def enrich(self, postings: list[FeedJobPosting], detail_limit=None, browser=None) -> None:
        """Fetches each posting's detail endpoint for the real description
        + postingUrl/applyUrl. `detail_limit` caps how many (from the
        start) get the detail call, same meaning as v1's scrapers — the
        rest keep the list-only stub (no description, placeholder URL)."""
        targets = postings if detail_limit is None else postings[:detail_limit]
        with make_client() as client:
            for posting in targets:
                token = posting.raw.get("smartrecruiters_token")
                posting_id = posting.raw.get("smartrecruiters_posting_id")
                if not token or not posting_id:
                    continue
                detail_url = _DETAIL_URL.format(token=token, posting_id=posting_id)
                throttle(detail_url)
                try:
                    response = client.get(detail_url)
                    response.raise_for_status()
                    detail = response.json()
                except Exception as exc:  # noqa: BLE001 — one bad detail call must not sink the run
                    logger.warning("smartrecruiters detail fetch failed for posting_id=%s: %s", posting_id, exc)
                    continue

                sections = ((detail.get("jobAd") or {}).get("sections") or {})
                parts = [
                    sections[key]["text"]
                    for key in _SECTION_KEYS
                    if isinstance(sections.get(key), dict) and sections[key].get("text")
                ]
                if parts:
                    posting.description = strip_html("<br><br>".join(parts))
                if detail.get("postingUrl"):
                    posting.source_url = detail["postingUrl"]
                if detail.get("applyUrl"):
                    posting.apply_url = detail["applyUrl"]
