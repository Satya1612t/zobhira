import logging
import re
from urllib.parse import urljoin

from scrapers.base import BaseJobScraper, JobPosting, SelectorNotFoundError
from utils.browser import block_heavy_resources, get_browser, run_concurrently
from utils.enrichment import select_unenriched
from utils.rate_limit import throttle

logger = logging.getLogger(__name__)

BASE_URL = "https://www.workatastartup.com"
JOBS_URL = f"{BASE_URL}/jobs"

# YC's own salary-range text, e.g. "$150K - $200K", "$124K - $188K CAD",
# "₹3M - ₹7.5M INR", "€85 - €120 EUR" — confirmed against 20 real postings
# already stored in the DB (via raw->>'salary_text'). Old code took the
# text's last 3 characters and checked .isalpha(), which only ever matched
# when a currency code was already present as a suffix — "$150K - $200K"
# slices to "00K", fails isalpha(), so salary_currency was always None.
_CURRENCY_SYMBOLS = {"$": "USD", "€": "EUR", "£": "GBP", "₹": "INR"}
_SALARY_MULTIPLIERS = {"K": 1_000, "M": 1_000_000}
_SALARY_RANGE_RE = re.compile(
    r"([$€£₹])\s*([\d,.]+)\s*([KM]?)\s*-\s*[$€£₹]?\s*([\d,.]+)\s*([KM]?)"
)
_TRAILING_CURRENCY_CODE_RE = re.compile(r"([A-Z]{3})\s*$")


def parse_salary_text(salary_text: str | None) -> tuple[float | None, float | None, str | None]:
    """Verified against 20 real `salary_text` samples already in the DB —
    every format seen (K/M multiplier suffixes, decimal values like "7.5M",
    with or without a trailing 3-letter currency code) parses correctly.
    An explicit trailing code ("... CAD") wins over the symbol-based guess,
    since $ alone is ambiguous between USD/CAD/AUD/etc."""
    if not salary_text:
        return None, None, None
    match = _SALARY_RANGE_RE.search(salary_text)
    if not match:
        return None, None, None
    symbol, min_str, min_mult, max_str, max_mult = match.groups()

    def to_number(num_str: str, multiplier: str) -> float:
        return float(num_str.replace(",", "")) * _SALARY_MULTIPLIERS.get(multiplier, 1)

    salary_min = to_number(min_str, min_mult)
    salary_max = to_number(max_str, max_mult)

    code_match = _TRAILING_CURRENCY_CODE_RE.search(salary_text.strip())
    currency = code_match.group(1) if code_match else _CURRENCY_SYMBOLS.get(symbol)

    return salary_min, salary_max, currency


class YCombinatorScraper(BaseJobScraper):
    """workatastartup.com — browsable without login. Job cards confirmed
    by inspecting the rendered DOM: each real job title link has
    `target="job"` (distinguishing it from the `/jobs/l/<category>` filter
    links, which share the `/jobs/` href substring but aren't real
    postings). The enclosing card two levels up (`ancestor::div[2]`)
    holds the company name (`span.font-bold`) and details spans
    (`p.job-details span`: employment type, location, category)."""

    source_name = "ycombinator"

    def scrape(
        self, query: str, location: str | None = None, detail_limit: int | None = None, browser=None
    ) -> list[JobPosting]:
        try:
            return self._scrape_deterministic(query, location, detail_limit, browser)
        except SelectorNotFoundError:
            logger.warning(
                "YC deterministic selectors found nothing (site markup may have "
                "changed) — falling back to LLM extraction"
            )
            return self._scrape_with_llm(query, location)

    def _scrape_deterministic(
        self, query: str, location: str | None, detail_limit: int | None = None, browser=None
    ) -> list[JobPosting]:
        """CLI/scheduler path: list + enrich in one call. Live search
        (api.py) calls `scrape_list` and `enrich` separately instead, so
        listing can be upserted and a small batch enriched without doing
        the full detail pass up front.

        `detail_limit` only counts postings we don't already have a
        description for (see utils/enrichment.py) — a repeat sweep a few
        days later shouldn't re-fetch the same descriptions it already has."""
        postings = self.scrape_list(query, location, browser)
        to_enrich = select_unenriched(postings, detail_limit)
        self.enrich(to_enrich, detail_limit=len(to_enrich) or None, browser=browser)
        return postings

    def scrape_list(self, query: str, location: str | None = None, browser=None) -> list[JobPosting]:
        throttle(JOBS_URL)
        postings: list[JobPosting] = []
        query_lower = query.lower() if query else ""

        with get_browser(browser) as br:
            page = br.new_page(
                user_agent=(
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                    "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
                )
            )
            block_heavy_resources(page)
            try:
                page.goto(JOBS_URL, wait_until="domcontentloaded", timeout=20000)
                try:
                    page.wait_for_selector('a[target="job"]', timeout=15000)
                except Exception:
                    pass  # fall through to the count()==0 check below

                links = page.locator('a[target="job"]')
                count = links.count()
                if count == 0:
                    raise SelectorNotFoundError("No job links found on YC jobs page")

                for i in range(count):
                    link = links.nth(i)
                    href = link.get_attribute("href")
                    title = link.inner_text().strip()
                    if not href or not title:
                        continue
                    if query_lower and query_lower not in title.lower():
                        continue

                    card = link.locator("xpath=ancestor::div[2]")

                    company = "Unknown"
                    company_el = card.locator("span.font-bold").first
                    if company_el.count() > 0:
                        company = company_el.inner_text().strip()

                    logo_url = None
                    logo_el = card.locator("img.logo").first
                    if logo_el.count() > 0:
                        logo_url = logo_el.get_attribute("src")

                    detail_spans = card.locator("p.job-details span").all_inner_texts()
                    detail_spans = [d.strip() for d in detail_spans if d.strip()]

                    employment_type = detail_spans[0] if detail_spans else None
                    remaining = detail_spans[1:]

                    salary_text = next(
                        (d for d in remaining if any(c in d for c in "$€£₹")), None
                    )
                    remaining = [d for d in remaining if d != salary_text]

                    category = remaining[-1] if len(remaining) > 1 else None
                    loc_text = (
                        " ".join(remaining[:-1]) if len(remaining) > 1
                        else (remaining[0] if remaining else None)
                    )

                    tags = [t for t in (employment_type, category) if t]

                    salary_min, salary_max, salary_currency = parse_salary_text(salary_text)

                    postings.append(
                        JobPosting(
                            title=title,
                            company=company,
                            location=loc_text,
                            workplace_type="remote" if loc_text and "remote" in loc_text.lower() else "unknown",
                            salary_min=salary_min,
                            salary_max=salary_max,
                            salary_currency=salary_currency,
                            source=self.source_name,
                            source_url=urljoin(BASE_URL, href),
                            description=None,
                            tags=tags,
                            logo_url=logo_url,
                            extraction_method="deterministic",
                            raw={"detail_spans": detail_spans, "salary_text": salary_text},
                        )
                    )

            finally:
                page.close()

        if not postings:
            raise SelectorNotFoundError("Parsed 0 postings from YC jobs page")
        return postings

    def enrich(self, postings: list[JobPosting], detail_limit: int | None = None, browser=None) -> None:
        """Runs the per-job detail-page description fetch over already-built
        postings, mutating them in place. Separated from `scrape_list` so
        live search can enrich just a small batch (5, then +10 on scroll)
        instead of the whole result set up front.

        Runs across several concurrent worker threads (see utils/browser.py's
        run_concurrently) — each owns its own browser, since Playwright's
        sync API can't safely share one across threads. `browser` (accepted
        for interface consistency with scrape_list()) is unused here for
        that same reason."""
        targets = postings[:detail_limit] if detail_limit else postings
        run_concurrently(targets, self._fetch_and_set_description)

    def _fetch_and_set_description(self, page, posting: JobPosting) -> None:
        posting.description = self._fetch_description(page, posting.source_url)

    def _fetch_description(self, page, url: str) -> str | None:
        """YC job detail pages expose no posted-date anywhere (list or
        detail) — confirmed by inspecting the rendered detail page, so
        `posted_at` stays unset for this source. Description lives across
        multiple `div.prose` blocks: index 0 is always the company's
        general "about" blurb (repeated on every job at that company), the
        rest is the actual job description/requirements, so those are
        joined and the company blurb is dropped."""
        throttle(url)
        try:
            page.goto(url, wait_until="domcontentloaded", timeout=15000)
            page.wait_for_selector("div.prose", timeout=10000)
            proses = page.locator("div.prose")
            count = proses.count()
            if count == 0:
                return None
            texts = [proses.nth(i).inner_text().strip() for i in range(count)]
            texts = [t for t in texts if t]
            body = texts[1:] if len(texts) > 1 else texts
            return "\n\n".join(body) if body else None
        except Exception:
            logger.warning("Could not fetch YC job description for %s", url)
            return None

    def _scrape_with_llm(self, query: str, location: str | None) -> list[JobPosting]:
        from scrapers.llm_fallback import run_smart_scraper

        prompt = (
            f"Extract all job postings related to '{query}' from this page. "
            "For each job return: title, company, location, salary_min, salary_max, "
            "salary_currency, workplace_type (remote/hybrid/onsite/unknown), description, "
            "and the job posting URL."
        )
        result = run_smart_scraper(prompt, JOBS_URL)

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
                    source_url=item.get("url") or JOBS_URL,
                    description=item.get("description"),
                    tags=item.get("tags", []) or [],
                    extraction_method="llm",
                    raw=item,
                )
            )
        return postings
