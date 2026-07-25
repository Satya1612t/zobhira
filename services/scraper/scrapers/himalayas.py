import logging
import random
import time
from datetime import datetime, timezone
from urllib.parse import urlencode

from scrapers.base import BaseJobScraper, JobPosting, RateLimitedError
from utils.http import make_client
from utils.rate_limit import throttle
from utils.text import strip_html

logger = logging.getLogger(__name__)

SEARCH_URL = "https://himalayas.app/jobs/api/search"

# Bounds wall-clock time per query — Himalayas has a real server-side search
# (like LinkedIn, unlike Talentd/YC), so the scheduler loops STREAM_QUERIES
# against it; 3 pages/query keeps a full 15-query sweep comparable in cost
# to LinkedIn's rather than paginating hundreds of results per query.
MAX_PAGES_PER_QUERY = 3

# Live-observed (2026-07-25, first real 15-query sweep): 4/15 queries hit a
# 403 on page 1, always isolated — the very next (different-query) request a
# few seconds later succeeded cleanly, and no two consecutive requests ever
# both 403'd. That rules out a sustained IP ban (which would keep failing)
# and points to a transient WAF/bot-score challenge on an individual
# request. Unlike 429 (a real, explicit rate-limit signal — abort the whole
# run, see scrapers.base.RateLimitedError), a 403 is worth a few quick retries with
# backoff before giving up: the evidence says a retry is very likely to
# succeed. Gives up on just that one query (not the whole sweep) if all
# retries are also 403 — a page 2/3 fetch mid-query isn't retried this way,
# since none has ever failed; only fresh (page 1) requests have.
MAX_403_RETRIES = 3
BACKOFF_BASE_SECONDS = 2.0

# Live-verified against a real response (2026-07-25): a page can return
# fewer than `limit` jobs even when more results exist elsewhere (page 1 of
# a 723-result query returned 18, not 20) — so `len(jobs) < limit` is NOT a
# safe "last page" signal. `offset + len(jobs) >= totalCount` (both present
# in every response) is the only reliable stop condition.


def _parse_timestamp(value) -> datetime | None:
    """Himalayas' own docs are inconsistent about whether pubDate/expiryDate
    are Unix timestamps or ISO strings (live-verified: they're Unix
    *seconds*, e.g. 1784972163) — handled defensively for both shapes in
    case that ever changes, same discipline as the naive-datetime bug hit
    on LinkedIn earlier. Always returns tz-aware UTC."""
    if value is None:
        return None
    if isinstance(value, (int, float)):
        # Disambiguate seconds vs. milliseconds: a millisecond timestamp for
        # any date after 1973 is > 1e11, a second timestamp isn't until year
        # 5138 — comfortably separates the two for any real-world date.
        seconds = value / 1000 if value > 1e11 else value
        try:
            return datetime.fromtimestamp(seconds, tz=timezone.utc)
        except (ValueError, OSError):
            return None
    if isinstance(value, str):
        try:
            return datetime.fromisoformat(value.replace("Z", "+00:00"))
        except ValueError:
            return None
    return None


def _is_india_eligible(location_restrictions: list | None) -> bool:
    """Safety net independent of run_scrape.py's generic is_india_or_remote
    filter, which treats any workplace_type=='remote' posting as
    automatically eligible — that's wrong for Himalayas, whose postings
    carry real per-country restrictions that a generic remote check can't
    see. Empty list means no restriction (worldwide-open, live-confirmed:
    a country=IN search still returns jobs with an empty
    locationRestrictions). "Never store a job your users can't take."
    Exact match (not substring) — a substring check would also match
    "British Indian Ocean Territory", which isn't India."""
    if not location_restrictions:
        return True
    return any(str(c).strip().lower() == "india" for c in location_restrictions)


def _format_location(location_restrictions: list | None) -> str:
    """Himalayas' own published docs describe locationRestrictions as
    `[{alpha2, name, slug}]` objects; live responses (verified 2026-07-25)
    are actually plain strings. Coercing with str(c) keeps this from
    crashing (and dropping the whole query) if that ever reverts to the
    documented object shape — matches the same defensive str(c) coercion
    _is_india_eligible already does."""
    if not location_restrictions:
        return "Worldwide"
    names = [str(c) for c in location_restrictions]
    if len(names) <= 5:
        return ", ".join(names)
    return ", ".join(names[:5]) + f" +{len(names) - 5} more"


class HimalayasScraper(BaseJobScraper):
    """himalayas.app — remote-only job board with a free, public, no-auth
    JSON search API. Every field this app needs (description, salary,
    dates, logo, categories) arrives in the search response itself, so
    unlike LinkedIn/Talentd/YCombinator there's no per-job detail-page pass
    at all — `enrich()` is a no-op (same shape RemoteOK had before its
    removal).

    Attribution requirement (Himalayas' terms): any UI displaying this
    data must show a visible link back to himalayas.app and mention
    "Himalayas" as the source, and these listings must never be
    re-submitted to a third-party job-indexing/aggregator feed. Both are
    enforced in apps/web, not here — see JobCard/Footer attribution and
    the sitemap/JSON-LD exclusion for source == 'himalayas'.
    """

    source_name = "himalayas"

    def scrape(
        self, query: str, location: str | None = None, detail_limit: int | None = None, browser=None
    ) -> list[JobPosting]:
        postings = self.scrape_list(query, location, browser)
        self.enrich(postings, detail_limit=detail_limit, browser=browser)
        return postings

    def scrape_list(self, query: str, location: str | None = None, browser=None) -> list[JobPosting]:
        postings: list[JobPosting] = []
        seen_guids: set[str] = set()
        client = make_client()
        try:
            for page in range(1, MAX_PAGES_PER_QUERY + 1):
                params = {"q": query or "", "country": "IN", "sort": "recent", "page": page}
                url = f"{SEARCH_URL}?{urlencode(params)}"

                response = None
                for attempt in range(MAX_403_RETRIES + 1):
                    throttle(url)
                    response = client.get(url)
                    if response.status_code != 403:
                        break
                    if attempt == MAX_403_RETRIES:
                        logger.warning(
                            "Himalayas returned 403 for query=%r page=%d after %d retries — "
                            "giving up on this query",
                            query, page, MAX_403_RETRIES,
                        )
                        break
                    backoff = BACKOFF_BASE_SECONDS * (2 ** attempt) + random.uniform(0, 1)
                    logger.warning(
                        "Himalayas returned 403 for query=%r page=%d — retrying in %.1fs (attempt %d/%d)",
                        query, page, backoff, attempt + 1, MAX_403_RETRIES,
                    )
                    time.sleep(backoff)

                if response.status_code == 403:
                    break  # exhausted retries — skip remaining pages of this query, keep what we have
                if response.status_code == 429:
                    logger.warning("Himalayas rate-limited us (429) on page %d — aborting this run", page)
                    raise RateLimitedError(f"Himalayas returned 429 on page {page}")
                if response.status_code == 400:
                    logger.warning("Himalayas returned 400 for query=%r page=%d — stopping", query, page)
                    break
                response.raise_for_status()
                data = response.json()
                jobs = data.get("jobs") or []
                if not jobs:
                    break

                for job in jobs:
                    guid = job.get("guid")
                    if not guid or guid in seen_guids:
                        continue
                    seen_guids.add(guid)

                    location_restrictions = job.get("locationRestrictions") or []
                    if not _is_india_eligible(location_restrictions):
                        continue

                    title = job.get("title")
                    company = job.get("companyName")
                    if not title or not company:
                        continue

                    # applicationLink has equaled guid on every posting seen
                    # live so far, but that's not a guaranteed API contract
                    # — guid isn't documented as a URL at all, and trusting
                    # it as a fallback apply link risks silently storing a
                    # broken (or non-URL) apply destination. Skip rather
                    # than guess: same "never store a job your users can't
                    # take" principle as _is_india_eligible above.
                    application_link = job.get("applicationLink")
                    if not application_link:
                        logger.warning(
                            "Himalayas posting %r (guid=%r) has no applicationLink — skipping",
                            title, guid,
                        )
                        continue

                    description = strip_html(job.get("description")) or strip_html(job.get("excerpt"))
                    seniority = job.get("seniority")
                    seniority_text = ", ".join(seniority) if isinstance(seniority, list) else seniority

                    tags = [c for c in (job.get("categories") or []) if c]

                    postings.append(
                        JobPosting(
                            title=title,
                            company=company,
                            location=_format_location(location_restrictions),
                            workplace_type="remote",
                            salary_min=job.get("minSalary"),
                            salary_max=job.get("maxSalary"),
                            salary_currency=job.get("currency"),
                            source=self.source_name,
                            source_url=application_link,
                            description=description,
                            tags=tags,
                            posted_at=_parse_timestamp(job.get("pubDate")),
                            deadline_at=_parse_timestamp(job.get("expiryDate")),
                            logo_url=job.get("companyLogo"),
                            extraction_method="deterministic",
                            employment_type=job.get("employmentType"),
                            seniority=seniority_text,
                            raw={
                                "guid": guid,
                                "location_restrictions": location_restrictions,
                                "parent_categories": job.get("parentCategories"),
                                "salary_period": job.get("salaryPeriod"),
                                "company_slug": job.get("companySlug"),
                            },
                        )
                    )

                offset = data.get("offset", 0)
                total_count = data.get("totalCount", 0)
                if offset + len(jobs) >= total_count:
                    break
        finally:
            client.close()

        return postings

    def enrich(self, postings: list[JobPosting], detail_limit: int | None = None, browser=None) -> None:
        """No-op: the search response already carries everything
        (description, salary, dates, logo, categories) that a detail-page
        visit would otherwise fill in on other sources."""
