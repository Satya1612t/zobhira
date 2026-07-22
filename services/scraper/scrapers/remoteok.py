import logging
from datetime import datetime, timezone

from playwright.sync_api import sync_playwright

from scrapers.base import BaseJobScraper, JobPosting, SelectorNotFoundError
from utils.http import fetch, make_client
from utils.rate_limit import throttle
from utils.text import strip_html

logger = logging.getLogger(__name__)

API_URL = "https://remoteok.com/api"
HOMEPAGE_URL = "https://remoteok.com/"


class RemoteOKScraper(BaseJobScraper):
    source_name = "remoteok"

    def scrape(
        self, query: str, location: str | None = None, detail_limit: int | None = None
    ) -> list[JobPosting]:
        # No per-job detail pass here (description/date come free from the
        # API, logos from one shared homepage visit) — detail_limit doesn't
        # apply to this source, kept only for interface consistency.
        try:
            return self._scrape_deterministic(query, location)
        except SelectorNotFoundError:
            logger.warning(
                "RemoteOK API shape looked unexpected — falling back to LLM extraction"
            )
            return self._scrape_with_llm(query, location)

    def scrape_list(self, query: str, location: str | None = None) -> list[JobPosting]:
        return self.scrape(query, location)

    def enrich(self, postings: list[JobPosting], detail_limit: int | None = None) -> None:
        """No-op: description/date/logo are already complete after
        scrape_list — nothing left to fetch per-job."""

    def _scrape_deterministic(self, query: str, location: str | None) -> list[JobPosting]:
        throttle(API_URL)
        with make_client() as client:
            response = fetch(client, API_URL)
            response.raise_for_status()
            data = response.json()

        if not isinstance(data, list) or len(data) == 0:
            raise SelectorNotFoundError("RemoteOK API returned no data")

        # First element is a legend/metadata entry, not a job.
        entries = [item for item in data if isinstance(item, dict) and item.get("id")]
        if not entries:
            raise SelectorNotFoundError("RemoteOK API returned no job entries")

        logo_by_id = self._fetch_logo_map()

        postings: list[JobPosting] = []
        query_lower = query.lower() if query else ""
        for item in entries:
            title = item.get("position") or item.get("title")
            company = item.get("company")
            if not title or not company:
                continue
            if query_lower and query_lower not in title.lower():
                tags = " ".join(item.get("tags", []) or []).lower()
                if query_lower not in tags:
                    continue

            posted_at = None
            date_str = item.get("date")
            if date_str:
                try:
                    posted_at = datetime.fromisoformat(date_str.replace("Z", "+00:00"))
                except ValueError:
                    posted_at = None

            postings.append(
                JobPosting(
                    title=title,
                    company=company,
                    location=item.get("location") or "Remote",
                    workplace_type="remote",
                    salary_min=item.get("salary_min"),
                    salary_max=item.get("salary_max"),
                    salary_currency="USD" if item.get("salary_min") else None,
                    source=self.source_name,
                    source_url=item.get("url") or f"https://remoteok.com/l/{item.get('id')}",
                    description=strip_html(item.get("description")),
                    tags=item.get("tags", []) or [],
                    posted_at=posted_at,
                    logo_url=logo_by_id.get(str(item.get("id"))),
                    extraction_method="deterministic",
                    raw=item,
                )
            )

        if not postings:
            raise SelectorNotFoundError("No RemoteOK postings matched after filtering")
        return postings

    def _fetch_logo_map(self) -> dict[str, str]:
        """RemoteOK's public JSON API always returns empty logo/company_logo
        fields (confirmed by direct inspection), but the rendered homepage
        does show real logos per row, keyed by the same job id via
        `tr.job[data-id]` / `img.logo[src]`. One extra page load gets logos
        for whatever's currently on the homepage; jobs further down the
        full API list that aren't on the homepage simply get no logo."""
        throttle(HOMEPAGE_URL)
        logo_by_id: dict[str, str] = {}
        try:
            with sync_playwright() as pw:
                browser = pw.chromium.launch(headless=True)
                page = browser.new_page(
                    user_agent=(
                        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                        "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
                    )
                )
                try:
                    page.goto(HOMEPAGE_URL, wait_until="domcontentloaded", timeout=20000)
                    page.wait_for_timeout(1500)
                    rows = page.locator("tr.job")
                    for i in range(rows.count()):
                        row = rows.nth(i)
                        job_id = row.get_attribute("data-id")
                        if not job_id:
                            continue
                        logo_el = row.locator("img.logo").first
                        if logo_el.count() > 0:
                            # data-src holds the real URL regardless of lazy-load
                            # timing; src can still be the pixel.gif placeholder.
                            src = logo_el.get_attribute("data-src") or logo_el.get_attribute("src")
                            if src and "pixel.gif" not in src:
                                logo_by_id[job_id] = src
                finally:
                    browser.close()
        except Exception:
            logger.warning("Could not fetch RemoteOK logo map; continuing without logos")
        return logo_by_id

    def _scrape_with_llm(self, query: str, location: str | None) -> list[JobPosting]:
        from scrapers.llm_fallback import run_smart_scraper

        prompt = (
            f"Extract all remote job postings related to '{query}' from this page. "
            "For each job return: title, company, location, salary_min, salary_max, "
            "salary_currency, description, and the job posting URL."
        )
        result = run_smart_scraper(prompt, "https://remoteok.com/")

        postings: list[JobPosting] = []
        for item in result.get("jobs", []) if isinstance(result, dict) else []:
            postings.append(
                JobPosting(
                    title=item.get("title", "Unknown"),
                    company=item.get("company", "Unknown"),
                    location=item.get("location") or "Remote",
                    workplace_type="remote",
                    salary_min=item.get("salary_min"),
                    salary_max=item.get("salary_max"),
                    salary_currency=item.get("salary_currency"),
                    source=self.source_name,
                    source_url=item.get("url") or "https://remoteok.com/",
                    description=item.get("description"),
                    tags=item.get("tags", []) or [],
                    extraction_method="llm",
                    raw=item,
                )
            )
        return postings
