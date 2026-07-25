from concurrent.futures import ThreadPoolExecutor
from contextlib import contextmanager

from playwright.sync_api import sync_playwright

# Every scraper here only reads text (titles, descriptions, JSON-LD/
# structured data) — none of them render or screenshot a page, so images/
# fonts/media/stylesheets are pure waste on every navigation. Confirmed a
# standard, well-documented Playwright pattern (route interception); halves
# navigation time on image-heavy job-board pages in typical use.
_BLOCKED_RESOURCE_TYPES = {"image", "font", "media", "stylesheet"}

DEFAULT_USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
)

# "4-5 pages" per the review — bounded so a detail-page enrichment pass
# doesn't hammer a site with a burst of concurrent requests.
CONCURRENT_ENRICH_WORKERS = 4


@contextmanager
def get_browser(browser=None):
    """Yields a Playwright Browser — the given `browser` if one is passed in
    (the caller owns its lifecycle; see scheduler.py's `_sweep()`, which
    launches a single browser and reuses it across an entire source's
    15-query sweep instead of the old one-launch-per-query-per-phase
    pattern), otherwise launches and closes a fresh one scoped to just this
    call. Callers must close whatever *page* they open themselves — this
    only manages the browser."""
    if browser is not None:
        yield browser
        return
    with sync_playwright() as pw:
        owned = pw.chromium.launch(headless=True)
        try:
            yield owned
        finally:
            owned.close()


def block_heavy_resources(page) -> None:
    page.route(
        "**/*",
        lambda route: route.abort()
        if route.request.resource_type in _BLOCKED_RESOURCE_TYPES
        else route.continue_(),
    )


def run_concurrently(items: list, fetch_one, max_workers: int = CONCURRENT_ENRICH_WORKERS) -> None:
    """Runs `fetch_one(page, item)` once per item, spread across up to
    `max_workers` concurrent worker threads — each thread launches and owns
    its own short-lived Playwright browser+page for its share of the work.
    This is the only safe way to parallelize Playwright's *sync* API:
    sharing one Browser/Page across threads is explicitly unsupported by
    Playwright (only separate Playwright instances per thread are), so this
    deliberately does NOT reuse `get_browser()`'s injected sweep-level
    browser — it trades that optimization away for just this phase, in
    exchange for genuine wall-clock parallelism on what's normally the
    slowest part of a sweep by far: N sequential full-page navigations, one
    per posting's detail page.

    `fetch_one` must not raise for a single failed item — every caller here
    already wraps its own per-item fetch in try/except (same as the old
    sequential loop did), since an uncaught exception would abort that
    worker's remaining share of the batch."""
    if not items:
        return

    def _worker(batch: list) -> None:
        with get_browser() as browser:
            page = browser.new_page(user_agent=DEFAULT_USER_AGENT)
            block_heavy_resources(page)
            try:
                for item in batch:
                    fetch_one(page, item)
            finally:
                page.close()

    chunks = [items[i::max_workers] for i in range(max_workers)]
    chunks = [chunk for chunk in chunks if chunk]
    with ThreadPoolExecutor(max_workers=len(chunks)) as executor:
        # list(...) forces each future's result (re-raising the worker's
        # exception here, on the calling thread) instead of letting a
        # background thread's failure disappear silently.
        list(executor.map(_worker, chunks))
