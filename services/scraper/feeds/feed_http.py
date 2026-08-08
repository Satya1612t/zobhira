"""v2's own HTTP client — deliberately NOT shared with utils/http.py (frozen,
see feeds/feed_base.py's module docstring). v1's scrapers politely disguise
nothing in particular but also don't need conditional GETs; v2 polls the
same handful of ATS endpoints repeatedly (eventually every 15 minutes for
tier-1 companies, see the plan's Stage 7) so `If-None-Match`/
`If-Modified-Since` support is the difference between a cheap 304 and a full
payload on almost every request once tiered polling ships.

These are published, documented board APIs meant to be polled by the
company's own careers page — there is no reason to rotate or disguise
anything, unlike utils/http.py's scraper UA rotation for sites that don't
want to be scraped.
"""

from __future__ import annotations

import logging
import os
from dataclasses import dataclass
from typing import Any

import httpx
from tenacity import retry, retry_if_exception_type, stop_after_attempt, wait_exponential

from scrapers.base import RateLimitedError

logger = logging.getLogger(__name__)

DEFAULT_USER_AGENT = (
    "ZobhiraFeedBot/1.0 (+https://zobhira.com; job aggregator, contact via site)"
)


def _user_agent() -> str:
    return os.environ.get("FEED_USER_AGENT") or DEFAULT_USER_AGENT


def make_client(timeout: float = 20.0) -> httpx.Client:
    return httpx.Client(
        headers={"User-Agent": _user_agent(), "Accept": "application/json"},
        timeout=timeout,
        follow_redirects=True,
    )


@dataclass
class FeedResponse:
    not_modified: bool
    status_code: int
    json: Any | None
    etag: str | None
    last_modified: str | None


def _is_retryable(exc: BaseException) -> bool:
    if isinstance(exc, httpx.TimeoutException):
        return True
    if isinstance(exc, httpx.HTTPStatusError):
        return 500 <= exc.response.status_code < 600
    return False


@retry(
    reraise=True,
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=1, max=10),
    retry=retry_if_exception_type((httpx.TimeoutException, httpx.HTTPStatusError)),
)
def _get(client: httpx.Client, url: str, headers: dict[str, str], params: dict | None) -> httpx.Response:
    response = client.get(url, headers=headers, params=params)
    if response.status_code == 429:
        raise RateLimitedError(f"429 from {url}")
    if 500 <= response.status_code < 600:
        response.raise_for_status()
    return response


def conditional_get(
    client: httpx.Client,
    url: str,
    etag: str | None = None,
    last_modified: str | None = None,
    params: dict | None = None,
) -> FeedResponse:
    """GETs `url`, sending `If-None-Match`/`If-Modified-Since` if the caller
    has a prior etag/last_modified (from company_registry) — a 304 means
    "nothing changed", the caller should treat that as zero new postings
    without re-parsing anything. Raises RateLimitedError on 429 (same
    semantics as utils/http.py, caught the same way by feed_scheduler.py's
    sweep loop)."""
    headers: dict[str, str] = {}
    if etag:
        headers["If-None-Match"] = etag
    if last_modified:
        headers["If-Modified-Since"] = last_modified

    response = _get(client, url, headers, params)

    if response.status_code == 304:
        return FeedResponse(not_modified=True, status_code=304, json=None, etag=etag, last_modified=last_modified)

    response.raise_for_status()
    return FeedResponse(
        not_modified=False,
        status_code=response.status_code,
        json=response.json(),
        etag=response.headers.get("ETag"),
        last_modified=response.headers.get("Last-Modified"),
    )
