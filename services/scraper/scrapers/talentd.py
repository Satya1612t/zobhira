import json
import logging
from datetime import datetime
from urllib.parse import urljoin

from scrapers.base import BaseJobScraper, JobPosting, SelectorNotFoundError
from utils.browser import block_heavy_resources, get_browser, run_concurrently
from utils.enrichment import select_unenriched
from utils.rate_limit import throttle
from utils.text import clean_replacement_chars

logger = logging.getLogger(__name__)

BASE_URL = "https://www.talentd.in"
JOBS_URL = f"{BASE_URL}/jobs"


class TalentdScraper(BaseJobScraper):
    """talentd.in — entry-level/fresher-focused Indian job board.

    Browsable without login, but job cards are hydrated client-side from a
    Next.js RSC payload — the raw HTML response has no real job data (only
    static nav links), so this requires a rendered browser (Playwright)
    rather than a plain HTTP GET. Card structure confirmed by inspecting
    the rendered DOM: each card is an ancestor div (class contains
    "rounded-xl") of an `<a aria-label="View {title} at {company}">`.
    """

    source_name = "talentd"

    def scrape(
        self, query: str, location: str | None = None, detail_limit: int | None = None, browser=None
    ) -> list[JobPosting]:
        try:
            return self._scrape_deterministic(query, location, detail_limit, browser)
        except SelectorNotFoundError:
            logger.warning(
                "Talentd deterministic selectors found nothing — falling back to LLM extraction"
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
                    page.wait_for_selector('a[aria-label^="View "]', timeout=15000)
                except Exception:
                    pass  # fall through to the count()==0 check below

                links = page.locator('a[aria-label^="View "]')
                count = links.count()
                if count == 0:
                    raise SelectorNotFoundError("No job cards found on Talentd jobs page")

                for i in range(count):
                    link = links.nth(i)
                    href = link.get_attribute("href")
                    if not href:
                        continue

                    card = link.locator('xpath=ancestor::div[contains(@class,"rounded-xl")][1]')

                    title = None
                    h2 = card.locator("h2").first
                    if h2.count() > 0:
                        title = clean_replacement_chars(h2.inner_text().strip())
                    if not title:
                        continue
                    if query_lower and query_lower not in title.lower():
                        continue

                    company = "Unknown"
                    loc_text = None
                    meta_line = card.locator("p.text-muted-foreground.text-sm").first
                    if meta_line.count() > 0:
                        meta_text = meta_line.inner_text().strip()
                        parts = [p.strip() for p in meta_text.split("•")]
                        if parts:
                            company = clean_replacement_chars(parts[0]) or "Unknown"
                        if len(parts) > 1:
                            loc_text = clean_replacement_chars(parts[1]) or None

                    salary_text = None
                    salary_el = card.locator("p.text-green-600.font-medium").first
                    if salary_el.count() > 0:
                        salary_text = salary_el.inner_text().strip()

                    tags = [
                        t.strip()
                        for t in card.locator('a[href*="/jobs/skills/"]').all_inner_texts()
                        if t.strip()
                    ]

                    logo_url = None
                    logo_el = card.locator("img").first
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
                            salary_currency="INR" if salary_text else None,
                            source=self.source_name,
                            source_url=urljoin(BASE_URL, href),
                            description=None,
                            tags=tags,
                            logo_url=logo_url,
                            extraction_method="deterministic",
                            raw={"salary_text": salary_text},
                        )
                    )

            finally:
                page.close()

        if not postings:
            raise SelectorNotFoundError("Parsed 0 postings from Talentd jobs page")
        return postings

    def enrich(self, postings: list[JobPosting], detail_limit: int | None = None, browser=None) -> None:
        """Runs the per-job detail-page fetch (description/date/salary/logo)
        over already-built postings, mutating them in place. Separated from
        `scrape_list` so live search can enrich just a small batch (5, then
        +10 on scroll) instead of the whole result set up front.

        Runs across several concurrent worker threads (see utils/browser.py's
        run_concurrently) — each owns its own browser, since Playwright's
        sync API can't safely share one across threads. `browser` (accepted
        for interface consistency with scrape_list()) is unused here for
        that same reason."""
        targets = postings[:detail_limit] if detail_limit else postings
        run_concurrently(targets, self._fetch_detail)

    def _fetch_detail(self, page, posting: JobPosting) -> None:
        """Each job detail page embeds a schema.org JobPosting node across
        two `<script type="application/ld+json">` tags (one per @graph);
        that gives a clean `datePosted` and numeric `baseSalary`, but its
        `description` field is SEO-truncated ("...[&hellip;]"). The full
        description text lives in the page's first `<section>` element
        (confirmed by inspecting the rendered DOM — it's reliably the
        job-content block, ahead of the "similar jobs" sidebar content
        that bleeds into broader ancestor containers)."""
        throttle(posting.source_url)
        try:
            page.goto(posting.source_url, wait_until="domcontentloaded", timeout=15000)
            page.wait_for_selector("section", timeout=10000)

            section = page.locator("section").first
            if section.count() > 0:
                posting.description = clean_replacement_chars(section.inner_text().strip())

            ld_json_blobs = page.evaluate(
                """() => Array.from(
                    document.querySelectorAll('script[type="application/ld+json"]')
                ).map(el => el.textContent)"""
            )
            job_node = None
            for blob in ld_json_blobs:
                try:
                    parsed = json.loads(blob)
                except (json.JSONDecodeError, TypeError):
                    continue
                for node in parsed.get("@graph", []):
                    if node.get("@type") == "JobPosting":
                        job_node = node
                        break
                if job_node:
                    break

            if not job_node:
                return

            date_posted = job_node.get("datePosted")
            if date_posted:
                try:
                    posting.posted_at = datetime.fromisoformat(date_posted.replace("Z", "+00:00"))
                except ValueError:
                    pass

            # schema.org JobPosting's standard application-deadline field —
            # present on some (not most) listings; falls back to the
            # 30-day-from-first-seen default expiry (reap_expired) when absent.
            valid_through = job_node.get("validThrough")
            if valid_through:
                try:
                    posting.deadline_at = datetime.fromisoformat(valid_through.replace("Z", "+00:00"))
                except ValueError:
                    pass

            base_salary = job_node.get("baseSalary") or {}
            value = base_salary.get("value") or {}
            if value.get("minValue") is not None:
                posting.salary_min = value.get("minValue")
                posting.salary_max = value.get("maxValue")
                posting.salary_currency = base_salary.get("currency") or posting.salary_currency

            hiring_org = job_node.get("hiringOrganization") or {}
            logo = hiring_org.get("logo")
            if logo:
                posting.logo_url = logo
            # Detail-page name is cleaner than the list-card text (which
            # sometimes truncates or includes stray punctuation) — verified
            # against 3 real postings, always present and correct.
            org_name = hiring_org.get("name")
            if org_name:
                posting.company = clean_replacement_chars(org_name)

            # Real, structured fields confirmed present on every Talentd
            # posting checked (3/3) — not guessed from the description text.
            # `qualifications`/`responsibilities`/`industry`/`jobLocationType`
            # were also checked for and are NOT present on any of the 3, so
            # they're deliberately not read here (no dead lookups).
            employment_type = job_node.get("employmentType")
            if employment_type:
                # Raw schema.org value (e.g. "FULL_TIME", "CONTRACTOR") goes
                # onto the posting itself so utils/field_enrichment.py's
                # canonical_employment_type() can resolve it into the
                # indexed employment_type column — previously this only ever
                # reached `tags`, so the column stayed null for every
                # Talentd posting and only the tag-based OR fallback in
                # jobQuery.ts's employmentTypeFilter caught it.
                posting.employment_type = employment_type
                # Match the existing tag style already used elsewhere
                # (e.g. YCombinator's "Fulltime", not "full-time").
                normalized = employment_type.replace("-", "").replace(" ", "").capitalize()
                if normalized and normalized not in posting.tags:
                    posting.tags.append(normalized)

            # `experienceRequirements` ("0-2 years") and `skills` (a
            # comma-separated string, not an array) don't have a first-class
            # column yet — stashed in `raw` so the data isn't thrown away,
            # available for the dispatch endpoint or a future filter to use
            # without needing a schema change today.
            experience_requirements = job_node.get("experienceRequirements")
            if experience_requirements:
                posting.raw["experience_requirements"] = experience_requirements
            skills_text = job_node.get("skills")
            if skills_text:
                posting.raw["skills"] = [s.strip() for s in skills_text.split(",") if s.strip()]
        except Exception:
            logger.warning("Could not fetch Talentd job detail for %s", posting.source_url)

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
                    salary_currency=item.get("salary_currency") or "INR",
                    source=self.source_name,
                    source_url=item.get("url") or JOBS_URL,
                    description=item.get("description"),
                    tags=item.get("tags", []) or [],
                    extraction_method="llm",
                    raw=item,
                )
            )
        return postings
