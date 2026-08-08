"""Workday — a great many large enterprises (Nvidia, Dell, Deloitte, Adobe,
…) run their careers site on Workday. Public, unauthenticated JSON API, but
messier than the token-based ATS boards, so this connector is the most
involved:

  - CONFIG is a triple, not a single token. Workday URLs are
    https://{tenant}.{wd}.myworkdayjobs.com/{site}/... where all three parts
    vary per company. They're packed into company_registry.ats_token as
    "tenant:wd:site" (e.g. "nvidia:wd5:NVIDIAExternalCareerSite") and split
    here.
  - QUERY-driven India filtering. A Workday board can have thousands of jobs
    across every country; paginating all of them to find the ~50 Indian ones
    is wasteful. Instead we POST the search endpoint once per Indian city as
    `searchText` — Workday returns just that city's matches (small), with a
    clean `locationsText` like "India, Bengaluru". Results are de-duped by
    externalPath across cities.
  - enrich() ISN'T a no-op (like SmartRecruiters): the list has no
    description, so each surviving posting's detail endpoint is fetched for
    the real HTML description, precise date, and the direct apply URL.

List:  POST {api}/jobs   body {limit, offset, searchText, appliedFacets:{}}
       -> {total, jobPostings: [{title, externalPath, locationsText,
           postedOn, bulletFields:[jobReqId]}]}
Detail: GET  {api}{externalPath}
       -> {jobPostingInfo: {title, jobDescription (HTML), location,
           startDate (YYYY-MM-DD), timeType, jobReqId, externalUrl}}
where {api} = https://{tenant}.{wd}.myworkdayjobs.com/wday/cxs/{tenant}/{site}
"""

from __future__ import annotations

import logging
from datetime import date, datetime

from feeds.feed_base import FeedJobPosting, FeedScraper
from feeds.feed_http import make_client
from utils.rate_limit import throttle
from utils.text import strip_html

logger = logging.getLogger(__name__)

# One search per city — each returns only that city's matches (efficient),
# and every result's location already carries the country ("India, <city>"),
# so run_feed.py's India filter passes without extra work.
_INDIA_CITIES = [
    "Bengaluru", "Bangalore", "Mumbai", "Pune", "Hyderabad", "Gurugram",
    "Gurgaon", "Delhi", "Chennai", "Noida", "Kolkata", "Ahmedabad",
]
_PAGE_SIZE = 20
_MAX_PAGES_PER_CITY = 5  # safety cap; India results per city are small


def _api_base(tenant: str, wd: str, site: str) -> str:
    return f"https://{tenant}.{wd}.myworkdayjobs.com/wday/cxs/{tenant}/{site}"


def _public_url(tenant: str, wd: str, site: str, external_path: str) -> str:
    return f"https://{tenant}.{wd}.myworkdayjobs.com/{site}{external_path}"


def _parse_posted_at(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.combine(date.fromisoformat(value[:10]), datetime.min.time())
    except ValueError:
        return None


class WorkdayFeedScraper(FeedScraper):
    provider = "workday"
    source_name = "workday"

    def _config(self, ats_token: str) -> tuple[str, str, str] | None:
        parts = (ats_token or "").split(":")
        if len(parts) != 3 or not all(parts):
            logger.warning("workday: ats_token %r is not 'tenant:wd:site'", ats_token)
            return None
        return parts[0], parts[1], parts[2]

    def scrape_list(self, query=None, location=None, browser=None) -> list[FeedJobPosting]:
        from feeds import registry

        companies = registry.active_companies(self.provider, tier=self.tier)
        if not companies:
            logger.info("workday: no active companies (tier=%s)", self.tier)
            return []

        out: list[FeedJobPosting] = []
        with make_client() as client:
            for company in companies:
                cfg = self._config(company["ats_token"])
                if not cfg:
                    continue
                tenant, wd, site = cfg
                api = _api_base(tenant, wd, site)
                seen_paths: set[str] = set()
                count_before = len(out)
                for city in _INDIA_CITIES:
                    offset = 0
                    for _ in range(_MAX_PAGES_PER_CITY):
                        throttle(api)
                        try:
                            resp = client.post(
                                f"{api}/jobs",
                                json={"limit": _PAGE_SIZE, "offset": offset, "searchText": city, "appliedFacets": {}},
                            )
                            resp.raise_for_status()
                            data = resp.json()
                        except Exception as exc:  # noqa: BLE001 — one bad city/page mustn't sink the run
                            logger.warning("workday %s city=%s failed: %s", company["slug"], city, exc)
                            break
                        postings = data.get("jobPostings", [])
                        for raw_job in postings:
                            path = raw_job.get("externalPath")
                            loc = raw_job.get("locationsText") or ""
                            if not path or path in seen_paths:
                                continue
                            # Guard: searchText can match description text, so
                            # only keep rows whose location actually says India.
                            if "india" not in loc.lower():
                                continue
                            seen_paths.add(path)
                            out.append(self._stub(company, tenant, wd, site, raw_job, loc))
                        total = data.get("total", 0)
                        offset += _PAGE_SIZE
                        if offset >= total or not postings:
                            break
                logger.info("workday company=%s -> %d India postings", company["slug"], len(out) - count_before)
        return out

    def _stub(self, company: dict, tenant: str, wd: str, site: str, raw_job: dict, location: str) -> FeedJobPosting:
        path = raw_job["externalPath"]
        req_ids = raw_job.get("bulletFields") or []
        public = _public_url(tenant, wd, site, path)
        return FeedJobPosting(
            title=raw_job.get("title") or "",
            company=company["name"],
            location=location,
            workplace_type="unknown",
            salary_min=None,
            salary_max=None,
            salary_currency=None,
            source=self.source_name,
            source_url=public,
            description=None,  # filled by enrich()
            tags=[],
            posted_at=None,  # relative "Posted Today" only in list; enrich() has the real date
            logo_url=None,
            extraction_method="deterministic",
            raw={"workday_external_path": path, "workday_api": _api_base(tenant, wd, site)},
            apply_url=public,
            external_id=(req_ids[0] if req_ids else None),
            company_id=company["id"],
        )

    def enrich(self, postings: list[FeedJobPosting], detail_limit=None, browser=None) -> None:
        targets = postings if detail_limit is None else postings[:detail_limit]
        with make_client() as client:
            for posting in targets:
                api = posting.raw.get("workday_api")
                path = posting.raw.get("workday_external_path")
                if not api or not path:
                    continue
                url = f"{api}{path}"
                throttle(url)
                try:
                    resp = client.get(url)
                    resp.raise_for_status()
                    info = (resp.json() or {}).get("jobPostingInfo", {})
                except Exception as exc:  # noqa: BLE001
                    logger.warning("workday detail fetch failed for %s: %s", path, exc)
                    continue
                if info.get("jobDescription"):
                    posting.description = strip_html(info["jobDescription"])
                if info.get("location"):
                    posting.location = info["location"]
                posting.posted_at = _parse_posted_at(info.get("startDate")) or posting.posted_at
                if info.get("timeType"):
                    posting.employment_type = info["timeType"]
                if info.get("externalUrl"):
                    posting.source_url = info["externalUrl"]
                    posting.apply_url = info["externalUrl"]
                if info.get("jobReqId"):
                    posting.external_id = info["jobReqId"]
