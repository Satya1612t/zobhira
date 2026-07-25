import logging
from datetime import datetime, timezone
from urllib.parse import quote_plus

from bs4 import BeautifulSoup

from scrapers.base import BaseJobScraper, JobPosting, SelectorNotFoundError
from utils.browser import get_browser, run_concurrently
from utils.enrichment import select_unenriched
from utils.http import fetch, make_client
from utils.rate_limit import throttle
from utils.text import strip_trailing_toggle

logger = logging.getLogger(__name__)

BASE_URL = "https://www.linkedin.com"

# LinkedIn's own server-side "posted within" filter — `f_TPR=r<seconds>`,
# r172800 = last 48 hours. Widened from the original 24h: this source is
# scraped daily, but a single failed/skipped run at exactly 24h meant that
# day's postings were gone for good once the next run's window rolled past
# them — dedup (upsert_job's exact + trigram-similarity checks) already
# prevents re-saving anything already seen, so there's no real cost to
# overlapping two days' worth of results other than a bit of wasted
# re-fetching, which is far cheaper than permanently losing a day's jobs.
TIME_FILTER = "f_TPR=r172800"

# LinkedIn's precise geo ID for India, as opposed to the free-text
# `location=India` string — confirmed live alongside the time filter above.
# Only applied when the caller's location is India (this platform's
# default, see scheduler.py's LOCATION); other locations keep using the
# plain free-text `location=` param, since we don't have a geoId mapping
# for arbitrary locations.
INDIA_GEO_ID = "102713980"

# The guest "load more" endpoint LinkedIn's own search page calls under the
# hood — confirmed live via plain httpx (no Playwright/JS needed): returns
# real static HTML, `start=0` returns the identical first card as browsing
# `/jobs/search` directly, and `start=10/20/...` returns genuinely different,
# further-down results (verified: page-2 titles differ entirely from
# page-1's). 10 cards per page. Standardizing on this one endpoint for every
# page (instead of the rendered search page for page 1 + this for the rest)
# keeps the pagination loop uniform.
GUEST_PAGINATION_URL = f"{BASE_URL}/jobs-guest/jobs/api/seeMoreJobPostings/search"
PAGE_SIZE = 10
# Cap at 5 pages (~50 results/query) — plenty above what detail_limit
# actually enriches per run, and keeps a single query from fetching
# unboundedly deep into stale/low-relevance results.
MAX_PAGES = 5


class LinkedInScraper(BaseJobScraper):
    """linkedin.com/jobs/search (and its guest pagination endpoint,
    GUEST_PAGINATION_URL) — the guest (logged-out) view is browsable
    without login and doesn't require the harder, auth-gated job detail/
    search API. Card structure confirmed by inspecting the rendered DOM:
    each result is `.base-card`, with `h3.base-search-card__title` (title),
    `h4.base-search-card__subtitle a` (company),
    `span.job-search-card__location` (location), and `a.base-card__full-link`
    (canonical job URL). Posted date used to be reliably
    `time.job-search-card__listdate[datetime]`, but confirmed live that a
    filtered search (time filter and/or geoId present) renders a different
    element instead: `time.job-search-card__listdate--new` — both class
    names are checked now, since which one appears isn't guaranteed to stay
    consistent as LinkedIn changes its search UI. This is the least stable
    of the sources built so far — LinkedIn has the strongest anti-bot
    posture of the group, so expect this to break/get rate limited sooner
    than the others, at which point the LLM fallback carries it.

    `scrape_list` doesn't use Playwright at all — confirmed live that the
    guest pagination endpoint returns real static HTML with every field the
    old rendered-DOM approach read, plus a real logo URL
    (`img.artdeco-entity-image[data-delayed-url]`) that the lazy-loaded
    `src` attribute the old Playwright pass read never reliably had. `enrich`
    (the per-job detail-page pass) still uses Playwright — see its own
    docstring."""

    source_name = "linkedin"

    def scrape(
        self, query: str, location: str | None = None, detail_limit: int | None = None, browser=None
    ) -> list[JobPosting]:
        try:
            return self._scrape_deterministic(query, location, detail_limit, browser)
        except SelectorNotFoundError:
            logger.warning(
                "LinkedIn deterministic selectors found nothing — falling back to LLM extraction"
            )
            return self._scrape_with_llm(query, location)

    def _build_url(self, query: str, location: str | None) -> str:
        """Human-facing search URL — only used by the LLM fallback below,
        which needs a real renderable page for scrapegraphai to browse."""
        params = f"keywords={quote_plus(query)}"
        if location:
            params += f"&location={quote_plus(location)}"
            if location.strip().lower() == "india":
                params += f"&geoId={INDIA_GEO_ID}"
        params += f"&{TIME_FILTER}"
        return f"{BASE_URL}/jobs/search?{params}"

    def _build_pagination_url(self, query: str, location: str | None, start: int) -> str:
        params = f"keywords={quote_plus(query)}"
        if location:
            params += f"&location={quote_plus(location)}"
            if location.strip().lower() == "india":
                params += f"&geoId={INDIA_GEO_ID}"
        params += f"&{TIME_FILTER}&start={start}"
        return f"{GUEST_PAGINATION_URL}?{params}"

    def _scrape_deterministic(
        self, query: str, location: str | None, detail_limit: int | None = None, browser=None
    ) -> list[JobPosting]:
        """CLI/scheduler path: list + enrich in one call, same as before the
        list/enrich split below. Live search (api.py) calls `scrape_list`
        and `enrich` separately instead, so listing can be upserted and
        reported "done" without waiting on the slow per-job detail pass.

        `detail_limit` caps how many postings get a fresh detail-page fetch
        — but only counting ones we don't already have a description for
        (see utils/enrichment.py), since LinkedIn is swept daily and most
        of what a new sweep finds is the same postings seen yesterday."""
        postings = self.scrape_list(query, location, browser)
        to_enrich = select_unenriched(postings, detail_limit)
        self.enrich(to_enrich, detail_limit=len(to_enrich) or None, browser=browser)
        return postings

    def scrape_list(self, query: str, location: str | None = None, browser=None) -> list[JobPosting]:
        """Paginates the guest endpoint (see GUEST_PAGINATION_URL) up to
        MAX_PAGES pages of PAGE_SIZE cards each, stopping early once a page
        comes back with zero cards (end of results) or zero *new* cards
        (everything on this page is already a dup of an earlier page —
        seen with overlapping/shifting result sets across requests).
        `browser` is accepted for interface consistency with the abstract
        base class but unused — this no longer needs Playwright."""
        query_lower = query.lower() if query else ""
        postings: list[JobPosting] = []
        seen_urls: set[str] = set()

        for page_num in range(MAX_PAGES):
            start = page_num * PAGE_SIZE
            url = self._build_pagination_url(query, location, start)
            throttle(url)
            with make_client() as client:
                response = fetch(client, url)

            if response.status_code in (403, 429, 999):
                raise SelectorNotFoundError(
                    f"LinkedIn returned status {response.status_code} (likely bot-blocked)"
                )
            if response.status_code != 200:
                break

            soup = BeautifulSoup(response.text, "html.parser")
            cards = soup.select(".base-card")
            if not cards:
                break

            new_this_page = 0
            for card in cards:
                posting = self._parse_card(card, query_lower)
                if posting is None or posting.source_url in seen_urls:
                    continue
                seen_urls.add(posting.source_url)
                postings.append(posting)
                new_this_page += 1

            if new_this_page == 0:
                break

        if not postings:
            raise SelectorNotFoundError("Parsed 0 postings from LinkedIn results page")
        return postings

    def _parse_card(self, card, query_lower: str) -> JobPosting | None:
        title_el = card.select_one("h3.base-search-card__title")
        title = title_el.get_text(strip=True) if title_el else None
        if not title:
            return None
        if query_lower and query_lower not in title.lower():
            return None

        company_el = card.select_one("h4.base-search-card__subtitle a")
        company = company_el.get_text(strip=True) if company_el else "Unknown"

        loc_el = card.select_one("span.job-search-card__location")
        loc_text = loc_el.get_text(strip=True) if loc_el else None

        link_el = card.select_one("a.base-card__full-link")
        href = link_el.get("href") if link_el else None
        if not href:
            return None

        posted_at = None
        time_el = card.select_one(
            "time.job-search-card__listdate, time.job-search-card__listdate--new"
        )
        if time_el:
            date_str = time_el.get("datetime")
            if date_str:
                try:
                    posted_at = datetime.fromisoformat(date_str)
                    # LinkedIn's `datetime` attribute is a plain date
                    # ("2024-01-15") with no timezone — naive datetimes
                    # crash any tz-aware comparison (e.g. the scheduler's
                    # freshness cutoff), so pin it to UTC here.
                    if posted_at.tzinfo is None:
                        posted_at = posted_at.replace(tzinfo=timezone.utc)
                except ValueError:
                    posted_at = None

        logo_url = None
        logo_el = card.select_one("img.artdeco-entity-image")
        if logo_el:
            # `data-delayed-url` holds the real image URL regardless of
            # lazy-load timing; `src` is often still the placeholder.
            logo_url = logo_el.get("data-delayed-url") or logo_el.get("src")

        return JobPosting(
            title=title,
            company=company,
            location=loc_text,
            workplace_type="remote" if loc_text and "remote" in loc_text.lower() else "unknown",
            salary_min=None,
            salary_max=None,
            salary_currency=None,
            source=self.source_name,
            source_url=href.split("?")[0],
            description=None,
            tags=[],
            posted_at=posted_at,
            logo_url=logo_url,
            extraction_method="deterministic",
            raw={},
        )

    def enrich(self, postings: list[JobPosting], detail_limit: int | None = None, browser=None) -> None:
        """Runs the slow per-job detail-page pass (description + logo) over
        already-built postings, mutating them in place. Separated from
        `scrape_list` so live search (api.py) can upsert list results and
        report the source "done" immediately, then call this afterward in a
        background thread — LinkedIn routinely returns 100-300+ results and
        each detail fetch is a full page navigation, which is what makes
        this the slowest part of the source by far. `detail_limit` caps how
        many postings get enriched; the rest stay list-only (title/company/
        location/date, no description/logo).

        Runs across several concurrent worker threads (see utils/browser.py's
        run_concurrently) — each owns its own browser, since Playwright's
        sync API can't safely share one across threads. `browser` (accepted
        for interface consistency with scrape_list()) is unused here for
        that same reason."""
        targets = postings[:detail_limit] if detail_limit else postings
        run_concurrently(targets, self._fetch_description)

    def _fetch_description(self, page, posting: JobPosting) -> None:
        """Unlike Indeed, LinkedIn's guest job detail pages
        (/jobs/view/<slug>) load cleanly via direct navigation — confirmed
        by testing 5 consecutive detail-page loads in one session (4/5
        succeeded quickly, one had no description, likely an expired/
        malformed listing rather than a block). Description text lives at
        `div.description__text`. The list card's logo (`img.
        artdeco-entity-image`) is lazy-loaded and only populates for
        cards already in the initial viewport, so most rows miss it —
        the same class reliably has a real `src` on the detail page
        (it's above the fold there), so logo extraction happens here
        instead, overwriting whatever the list pass found (or didn't).

        Also reads the "criteria" box near the bottom of the page (seniority
        level / employment type / job function / industries) — confirmed
        live across 3 real postings, same markup every time:
        `ul.description__job-criteria-list > li.description__job-criteria-item`,
        each with an `h3.description__job-criteria-subheader` label and a
        `span.description__job-criteria-text` value. Employment type
        replaces the guesswork elsewhere and feeds `tags` directly (same
        normalization as Talentd's); seniority level/job function/industries
        don't have dedicated columns yet, so they're stashed in `raw`."""
        try:
            throttle(posting.source_url)
            page.goto(posting.source_url, wait_until="domcontentloaded", timeout=15000)
            page.wait_for_selector("div.description__text", timeout=8000)
            desc_el = page.locator("div.description__text").first
            posting.description = strip_trailing_toggle(desc_el.inner_text().strip())

            logo_el = page.locator("img.artdeco-entity-image").first
            if logo_el.count() > 0:
                src = logo_el.get_attribute("src")
                if src:
                    posting.logo_url = src

            criteria = page.evaluate(
                """() => {
                    const items = Array.from(document.querySelectorAll(
                        'ul.description__job-criteria-list li.description__job-criteria-item'
                    ));
                    const result = {};
                    for (const item of items) {
                        const label = item.querySelector('h3.description__job-criteria-subheader');
                        const value = item.querySelector('span.description__job-criteria-text');
                        if (label && value) {
                            result[label.textContent.trim()] = value.textContent.trim();
                        }
                    }
                    return result;
                }"""
            )
            employment_type = criteria.get("Employment type")
            if employment_type:
                normalized = employment_type.replace("-", "").replace(" ", "").capitalize()
                if normalized and normalized not in posting.tags:
                    posting.tags.append(normalized)
            seniority_level = criteria.get("Seniority level")
            if seniority_level:
                posting.raw["seniority_level"] = seniority_level
            job_function = criteria.get("Job function")
            if job_function:
                posting.raw["job_function"] = job_function
            industries = criteria.get("Industries")
            if industries:
                posting.raw["industries"] = industries
        except Exception:
            logger.warning("Could not fetch LinkedIn job description for %s", posting.source_url)

    def _scrape_with_llm(self, query: str, location: str | None) -> list[JobPosting]:
        from scrapers.llm_fallback import run_smart_scraper

        url = self._build_url(query, location)
        prompt = (
            f"Extract all job postings related to '{query}' from this page. "
            "For each job return: title, company, location, salary_min, salary_max, "
            "salary_currency, workplace_type (remote/hybrid/onsite/unknown), description, "
            "and the job posting URL."
        )
        result = run_smart_scraper(prompt, url)

        postings: list[JobPosting] = []
        for item in result.get("jobs", []) if isinstance(result, dict) else []:
            postings.append(
                JobPosting(
                    title=item.get("title", "Unknown"),
                    company=item.get("company", "Unknown"),
                    location=item.get("location"),
                    workplace_type=item.get("workplace_type") or "unknown",
                    salary_min=item.get("salary_min"),
                    salary_max=item.get("salary_max"),
                    salary_currency=item.get("salary_currency"),
                    source=self.source_name,
                    source_url=item.get("url") or url,
                    description=item.get("description"),
                    tags=item.get("tags", []) or [],
                    extraction_method="llm",
                    raw=item,
                )
            )
        return postings
