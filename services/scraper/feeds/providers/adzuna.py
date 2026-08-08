"""Adzuna — Stage 5 aggregator. Fundamentally different shape from the ATS
providers: KEYED (needs ADZUNA_APP_ID/ADZUNA_APP_KEY) and QUERY-driven, not
company_registry-driven. It's a job-search aggregator, so instead of polling
one company's board it searches the India index (`/jobs/in/`) for each of
taxonomy.STREAM_QUERIES and collects what comes back.

Overrides scrape_list() entirely (board_url/normalize_board — the
company-loop hooks — are unused here). No conditional-GET/etag bookkeeping
either, since there's no per-company state to cache.

Two deliberate guards:
  - DAILY ONLY. Adzuna's free tier rate-limits hard, so this self-skips on
    the 15-min/hourly tier-1/tier-2 ticks and only runs on the daily tier-3
    sweep (or a manual full "Run now", tier=None).
  - INDIRECT LINKS. Adzuna's redirect_url points at adzuna.in (its own
    detail page), not the employer's application form — so every posting is
    flagged `raw.flagged_indirect = true` (the flag-don't-reject pattern
    from db/migrations/0014). apply_url is still set (one hop through Adzuna
    is usable), just marked so ranking can demote it later if wanted.

Missing key → logs "skipped" and returns nothing, same graceful-degrade
behaviour as the optional LLM path.
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

_SEARCH_URL = "https://api.adzuna.com/v1/api/jobs/in/search/1"
_RESULTS_PER_PAGE = 50
_MAX_DAYS_OLD = 1  # only very fresh postings — this is a daily top-up, not a backfill


def _parse_posted_at(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None


def _employment_type(result: dict) -> str | None:
    # Adzuna exposes contract_time (full_time/part_time) and contract_type
    # (permanent/contract) — canonical_employment_type (called later in
    # enrich_posting) maps these the rest of the way.
    return result.get("contract_type") or result.get("contract_time")


class AdzunaFeedScraper(FeedScraper):
    provider = "adzuna"
    source_name = "adzuna"

    def scrape_list(self, query=None, location=None, browser=None) -> list[FeedJobPosting]:
        # Daily-only guard: skip the frequent tier-1/tier-2 ticks entirely.
        if self.tier is not None and self.tier != 3:
            return []

        app_id = os.environ.get("ADZUNA_APP_ID")
        app_key = os.environ.get("ADZUNA_APP_KEY")
        if not app_id or not app_key:
            logger.info("adzuna: ADZUNA_APP_ID/ADZUNA_APP_KEY not set — skipped")
            return []

        from feeds import feed_http

        out: list[FeedJobPosting] = []
        seen_ids: set[str] = set()
        base_params = {
            "app_id": app_id,
            "app_key": app_key,
            "results_per_page": _RESULTS_PER_PAGE,
            "max_days_old": _MAX_DAYS_OLD,
            "content-type": "application/json",
        }
        with feed_http.make_client() as client:
            for term in STREAM_QUERIES:
                throttle(_SEARCH_URL)
                try:
                    response = client.get(_SEARCH_URL, params={**base_params, "what": term})
                    response.raise_for_status()
                    data = response.json()
                except Exception as exc:  # noqa: BLE001 — one bad query must not sink the run
                    logger.warning("adzuna query=%r failed: %s", term, exc)
                    continue

                for result in data.get("results", []):
                    external_id = str(result.get("id")) if result.get("id") is not None else None
                    if not external_id or external_id in seen_ids:
                        continue
                    seen_ids.add(external_id)
                    posting = self._normalize(result, external_id)
                    if posting:
                        out.append(posting)
        logger.info("adzuna: %d postings across %d stream queries", len(out), len(STREAM_QUERIES))
        return out

    def _normalize(self, result: dict, external_id: str) -> FeedJobPosting | None:
        company = (result.get("company") or {}).get("display_name")
        if not company:
            return None

        location_obj = result.get("location") or {}
        location = location_obj.get("display_name")
        area = location_obj.get("area") or []
        # Every result is from the /in/ (India) index, so it IS India — but
        # the display_name is often a bare locality ("Richmond Town,
        # Bangalore") with no country token for run_feed.py's India filter to
        # catch. area[] always leads with "India", so fold it in.
        if location and "india" not in location.lower() and any(a.lower() == "india" for a in area):
            location = f"{location}, India"
        elif not location:
            location = "India"

        redirect_url = result.get("redirect_url")
        category = (result.get("category") or {}).get("label")
        salary_min = result.get("salary_min")
        salary_max = result.get("salary_max")

        return FeedJobPosting(
            title=result.get("title") or "",
            company=company,
            location=location,
            workplace_type="unknown",
            salary_min=float(salary_min) if salary_min is not None else None,
            salary_max=float(salary_max) if salary_max is not None else None,
            salary_currency="INR" if salary_min is not None else None,
            source=self.source_name,
            source_url=redirect_url or "",
            description=strip_html(result.get("description")),
            tags=[category] if category else [],
            posted_at=_parse_posted_at(result.get("created")),
            employment_type=_employment_type(result),
            logo_url=None,
            extraction_method="deterministic",
            raw={
                "adzuna_id": external_id,
                "adzuna_category": (result.get("category") or {}).get("tag"),
                "salary_is_predicted": result.get("salary_is_predicted"),
                # Adzuna's redirect_url is its own detail page, never the
                # employer/ATS directly — flag so ranking can demote later
                # (see the plan's §5 / db/migrations/0014 flag-don't-reject).
                "flagged_indirect": True,
            },
            apply_url=redirect_url,
            external_id=external_id,
            company_id=None,
        )
