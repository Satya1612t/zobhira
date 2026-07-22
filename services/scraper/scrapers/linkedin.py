import logging
from datetime import datetime, timezone
from urllib.parse import quote_plus

from playwright.sync_api import sync_playwright

from scrapers.base import BaseJobScraper, JobPosting, SelectorNotFoundError
from utils.rate_limit import throttle
from utils.text import strip_trailing_toggle

logger = logging.getLogger(__name__)

BASE_URL = "https://www.linkedin.com"

# LinkedIn's own server-side "posted within" filter — `f_TPR=r<seconds>`,
# r86400 = last 24 hours. This source is scraped daily (see scheduler.py),
# so there's never a reason to pull anything older than the previous run's
# window; letting LinkedIn filter server-side means less wasted scraping of
# stale jobs we'd just drop client-side anyway, and confirmed live to still
# return real results (200 status, correct relative-time postings).
TIME_FILTER = "f_TPR=r86400"

# LinkedIn's precise geo ID for India, as opposed to the free-text
# `location=India` string — confirmed live alongside the time filter above.
# Only applied when the caller's location is India (this platform's
# default, see scheduler.py's LOCATION); other locations keep using the
# plain free-text `location=` param, since we don't have a geoId mapping
# for arbitrary locations.
INDIA_GEO_ID = "102713980"


class LinkedInScraper(BaseJobScraper):
    """linkedin.com/jobs/search — the guest (logged-out) search results
    view is browsable without login and doesn't require the harder,
    auth-gated job detail/search API. Card structure confirmed by
    inspecting the rendered DOM: each result is `.base-card`, with
    `h3.base-search-card__title` (title), `h4.base-search-card__subtitle a`
    (company), `span.job-search-card__location` (location), and
    `a.base-card__full-link` (canonical job URL). Posted date used to be
    reliably `time.job-search-card__listdate[datetime]`, but confirmed live
    that a filtered search (time filter and/or geoId present) renders a
    different element instead: `time.job-search-card__listdate--new` — both
    class names are checked now, since which one appears isn't guaranteed
    to stay consistent as LinkedIn changes its search UI. This is the least
    stable of the sources built so far — LinkedIn has the strongest
    anti-bot posture of the group, so expect this to break/get rate
    limited sooner than the others, at which point the LLM fallback
    carries it."""

    source_name = "linkedin"

    def scrape(
        self, query: str, location: str | None = None, detail_limit: int | None = None
    ) -> list[JobPosting]:
        try:
            return self._scrape_deterministic(query, location, detail_limit)
        except SelectorNotFoundError:
            logger.warning(
                "LinkedIn deterministic selectors found nothing — falling back to LLM extraction"
            )
            return self._scrape_with_llm(query, location)

    def _build_url(self, query: str, location: str | None) -> str:
        params = f"keywords={quote_plus(query)}"
        if location:
            params += f"&location={quote_plus(location)}"
            if location.strip().lower() == "india":
                params += f"&geoId={INDIA_GEO_ID}"
        params += f"&{TIME_FILTER}"
        return f"{BASE_URL}/jobs/search?{params}"

    def _scrape_deterministic(
        self, query: str, location: str | None, detail_limit: int | None = None
    ) -> list[JobPosting]:
        """CLI/scheduler path: list + enrich in one call, same as before the
        list/enrich split below. Live search (api.py) calls `scrape_list`
        and `enrich` separately instead, so listing can be upserted and
        reported "done" without waiting on the slow per-job detail pass."""
        postings = self.scrape_list(query, location)
        self.enrich(postings, detail_limit)
        return postings

    def scrape_list(self, query: str, location: str | None) -> list[JobPosting]:
        url = self._build_url(query, location)
        throttle(url)
        postings: list[JobPosting] = []

        with sync_playwright() as pw:
            browser = pw.chromium.launch(headless=True)
            page = browser.new_page(
                user_agent=(
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                    "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
                )
            )
            try:
                response = page.goto(url, wait_until="domcontentloaded", timeout=20000)
                if response is not None and response.status in (403, 429, 999):
                    raise SelectorNotFoundError(
                        f"LinkedIn returned status {response.status} (likely bot-blocked)"
                    )
                try:
                    page.wait_for_selector(".base-card", timeout=15000)
                except Exception:
                    pass

                cards = page.locator(".base-card")
                count = cards.count()
                if count == 0:
                    raise SelectorNotFoundError("No job cards found on LinkedIn results page")

                for i in range(count):
                    card = cards.nth(i)

                    title_el = card.locator("h3.base-search-card__title").first
                    title = title_el.inner_text().strip() if title_el.count() > 0 else None
                    if not title:
                        continue

                    company_el = card.locator("h4.base-search-card__subtitle a").first
                    company = (
                        company_el.inner_text().strip() if company_el.count() > 0 else "Unknown"
                    )

                    loc_el = card.locator("span.job-search-card__location").first
                    loc_text = loc_el.inner_text().strip() if loc_el.count() > 0 else None

                    link_el = card.locator("a.base-card__full-link").first
                    href = link_el.get_attribute("href") if link_el.count() > 0 else None
                    if not href:
                        continue

                    posted_at = None
                    time_el = card.locator(
                        "time.job-search-card__listdate, time.job-search-card__listdate--new"
                    ).first
                    if time_el.count() > 0:
                        date_str = time_el.get_attribute("datetime")
                        if date_str:
                            try:
                                posted_at = datetime.fromisoformat(date_str)
                                # LinkedIn's `datetime` attribute is a plain
                                # date ("2024-01-15") with no timezone —
                                # naive datetimes crash any tz-aware
                                # comparison (e.g. the scheduler's 12h
                                # freshness cutoff), so pin it to UTC here.
                                if posted_at.tzinfo is None:
                                    posted_at = posted_at.replace(tzinfo=timezone.utc)
                            except ValueError:
                                posted_at = None

                    logo_url = None
                    logo_el = card.locator("img.artdeco-entity-image").first
                    if logo_el.count() > 0:
                        logo_url = logo_el.get_attribute("src")

                    postings.append(
                        JobPosting(
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
                    )
            finally:
                browser.close()

        if not postings:
            raise SelectorNotFoundError("Parsed 0 postings from LinkedIn results page")
        return postings

    def enrich(self, postings: list[JobPosting], detail_limit: int | None = None) -> None:
        """Runs the slow per-job detail-page pass (description + logo) over
        already-built postings, mutating them in place. Separated from
        `scrape_list` so live search (api.py) can upsert list results and
        report the source "done" immediately, then call this afterward in a
        background thread — LinkedIn routinely returns 100-300+ results and
        each detail fetch is a full page navigation, which is what makes
        this the slowest part of the source by far. `detail_limit` caps how
        many postings get enriched; the rest stay list-only (title/company/
        location/date, no description/logo)."""
        targets = postings[:detail_limit] if detail_limit else postings
        if not targets:
            return
        with sync_playwright() as pw:
            browser = pw.chromium.launch(headless=True)
            page = browser.new_page(
                user_agent=(
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                    "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
                )
            )
            try:
                for posting in targets:
                    self._fetch_description(page, posting)
            finally:
                browser.close()

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
        instead, overwriting whatever the list pass found (or didn't)."""
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
