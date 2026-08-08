"""Auto-detects which ATS (Greenhouse/Lever/Ashby/SmartRecruiters/Workable/
Recruitee) a company uses, and its board token, from just a careers-page URL
— so growing company_registry doesn't mean hand-verifying every company the
way the Stage 3/4 pilots did.

Three strategies, cheapest first (see the v2 plan's Stage 4):
  1. Follow the careers URL's redirects — the final hostname usually gives
     the ATS away outright (job-boards.greenhouse.io/TOKEN,
     jobs.lever.co/TOKEN, jobs.ashbyhq.com/TOKEN, ...), token = path segment.
  2. Else grep the fetched HTML for an embedded board/iframe/script pointing
     at one of those hosts.
  3. Else probe: derive candidate tokens from the company's own domain and
     try each provider's API; a 200 with a non-empty listing wins. (This is
     what catches e.g. Postman, whose careers page hides the ATS entirely
     but whose greenhouse token is just "postman".)

Every detection is VERIFIED against the provider's real API before being
accepted — a guessed token that returns nothing is discarded, never
written. Output is CSV rows in company_registry.csv's exact shape (printed
by default; --write upserts straight into company_registry).

    python -m scripts.detect_ats --url https://www.postman.com/company/careers/ --name Postman
    python -m scripts.detect_ats --file careers_urls.txt          # one "URL,Name" per line
    python -m scripts.detect_ats --file careers_urls.txt --write  # also upsert into company_registry
"""

from __future__ import annotations

import argparse
import logging
import re
from urllib.parse import urlparse

from dotenv import load_dotenv

from feeds import feed_http
from feeds.providers.ashby import AshbyFeedScraper
from feeds.providers.greenhouse import GreenhouseFeedScraper
from feeds.providers.lever import LeverFeedScraper
from feeds.providers.recruitee import RecruiteeFeedScraper
from feeds.providers.smartrecruiters import SmartRecruitersFeedScraper
from feeds.providers.workable import WorkableFeedScraper

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
logger = logging.getLogger(__name__)

# host-substring -> (provider, regex capturing the token from a URL on that
# host). Ordered most-specific first. Used for BOTH the final-redirect-URL
# check (strategy 1) and the HTML-body scan (strategy 2).
_HOST_PATTERNS: list[tuple[str, str, str]] = [
    ("greenhouse", "greenhouse", r"(?:job-boards|boards|boards-api)\.greenhouse\.io/(?:v1/boards/|embed/job_board\?(?:[^\"'&]*&)?for=)?([a-zA-Z0-9_-]+)"),
    ("lever", "lever", r"(?:jobs|api)\.lever\.co/(?:v0/postings/)?([a-zA-Z0-9_-]+)"),
    ("ashby", "ashby", r"(?:jobs\.ashbyhq\.com|api\.ashbyhq\.com/posting-api/job-board)/([a-zA-Z0-9_-]+)"),
    ("smartrecruiters", "smartrecruiters", r"(?:jobs|careers|api)\.smartrecruiters\.com/(?:v1/companies/)?([a-zA-Z0-9_.-]+)"),
    ("recruitee", "recruitee", r"([a-zA-Z0-9_-]+)\.recruitee\.com"),
    ("workable", "workable", r"(?:apply\.workable\.com/(?:api/v1/widget/accounts/)?|(?:www\.)?workable\.com/)([a-zA-Z0-9_-]+)"),
]

_PROVIDERS = {
    "greenhouse": GreenhouseFeedScraper(),
    "lever": LeverFeedScraper(),
    "ashby": AshbyFeedScraper(),
    "smartrecruiters": SmartRecruitersFeedScraper(),
    "workable": WorkableFeedScraper(),
    "recruitee": RecruiteeFeedScraper(),
}

# Non-token trailing path segments that show up right after the ATS host but
# aren't the company token (e.g. jobs.lever.co/xxx where xxx is really a
# posting id, or generic app routes).
_TOKEN_STOPWORDS = {"embed", "widget", "api", "v0", "v1", "postings", "boards", "job_board", "job-board", "jobs", "companies"}


def _slug_candidates(careers_url: str, name: str | None) -> list[str]:
    """Plausible token guesses from the company's domain and name, for the
    probe fallback: the registrable domain label ('postman' from
    postman.com) and a de-spaced lowercased name ('acmecorp' from 'Acme
    Corp')."""
    candidates: list[str] = []
    host = urlparse(careers_url).netloc.lower().removeprefix("www.")
    domain_label = host.split(".")[0] if host else ""
    if domain_label:
        candidates.append(domain_label)
    if name:
        slug = re.sub(r"[^a-z0-9]", "", name.lower())
        if slug and slug not in candidates:
            candidates.append(slug)
    return candidates


def _verify(provider: str, token: str) -> bool:
    """True only if this provider's real API returns a valid, non-empty
    board for `token` — the gate that keeps a wrong guess out of the
    registry."""
    if not token or token in _TOKEN_STOPWORDS:
        return False
    scraper = _PROVIDERS[provider]
    url = scraper.board_url(token)
    try:
        with feed_http.make_client(timeout=10.0) as client:
            resp = feed_http.conditional_get(client, url)
    except Exception:
        return False
    if resp.not_modified or resp.json is None:
        return False
    payload = resp.json
    # Each provider's non-empty "there are real postings here" shape.
    if provider == "lever":
        return isinstance(payload, list) and len(payload) > 0
    if provider in ("greenhouse", "ashby"):
        return bool((payload or {}).get("jobs"))
    if provider == "smartrecruiters":
        return int((payload or {}).get("totalFound", 0)) > 0
    if provider == "recruitee":
        return bool((payload or {}).get("offers"))
    if provider == "workable":
        return bool((payload or {}).get("jobs"))
    return False


def _match_host(text: str) -> list[tuple[str, str]]:
    """All (provider, token) pairs found in `text` (a URL or a blob of HTML)
    via the host patterns, de-duplicated, order-preserving."""
    found: list[tuple[str, str]] = []
    for _, provider, pattern in _HOST_PATTERNS:
        for m in re.finditer(pattern, text):
            token = m.group(1)
            if token and token not in _TOKEN_STOPWORDS and (provider, token) not in found:
                found.append((provider, token))
    return found


def detect(careers_url: str, name: str | None = None) -> tuple[str, str] | None:
    """Returns (provider, token) if detected+verified, else None."""
    # Strategies 1 + 2: one fetch (follows redirects), then inspect both the
    # final URL and the returned HTML for known ATS hosts.
    final_url = careers_url
    html = ""
    try:
        with feed_http.make_client(timeout=15.0) as client:
            resp = client.get(careers_url)
            final_url = str(resp.url)
            html = resp.text or ""
    except Exception as exc:  # noqa: BLE001 — a dead careers URL just falls through to probing
        logger.warning("fetch failed for %s: %s", careers_url, exc)

    for candidates in (_match_host(final_url), _match_host(html)):
        for provider, token in candidates:
            if _verify(provider, token):
                return provider, token

    # Strategy 3: probe domain/name-derived token guesses against every API.
    for token in _slug_candidates(careers_url, name):
        for provider in _PROVIDERS:
            if _verify(provider, token):
                return provider, token

    return None


def _csv_row(name: str, provider: str, token: str, careers_url: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", (name or token).lower()).strip("-")
    return f"{name or token},{slug},{provider},{token},{careers_url},IN,2"


def _write_registry(name: str, provider: str, token: str, careers_url: str) -> None:
    from db.repository import connect

    slug = re.sub(r"[^a-z0-9]+", "-", (name or token).lower()).strip("-")
    conn = connect()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO company_registry (name, slug, ats_provider, ats_token, careers_url, country_hint, tier)
                VALUES (%(name)s, %(slug)s, %(provider)s, %(token)s, %(careers_url)s, 'IN', 2)
                ON CONFLICT (ats_provider, ats_token) DO UPDATE SET
                    name = EXCLUDED.name, careers_url = EXCLUDED.careers_url, is_active = true
                """,
                {"name": name or token, "slug": slug, "provider": provider, "token": token, "careers_url": careers_url},
            )
        conn.commit()
    finally:
        conn.close()


def _parse_line(line: str) -> tuple[str, str | None]:
    parts = [p.strip() for p in line.split(",", 1)]
    url = parts[0]
    name = parts[1] if len(parts) > 1 and parts[1] else None
    return url, name


def main() -> None:
    load_dotenv()
    parser = argparse.ArgumentParser(description="Detect a company's ATS + token from its careers URL.")
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--url", help="A single careers-page URL.")
    group.add_argument("--file", help="File with one 'URL,Company Name' per line (name optional).")
    parser.add_argument("--name", help="Company name (with --url).")
    parser.add_argument("--write", action="store_true", help="Upsert detected companies into company_registry.")
    args = parser.parse_args()

    if args.url:
        targets = [(args.url, args.name)]
    else:
        with open(args.file, encoding="utf-8") as f:
            targets = [_parse_line(ln) for ln in f if ln.strip() and not ln.startswith("#")]

    detected = 0
    print("name,slug,ats_provider,ats_token,careers_url,country_hint,tier")
    for url, name in targets:
        result = detect(url, name)
        if not result:
            logger.warning("NO ATS detected for %s (%s)", name or "?", url)
            continue
        provider, token = result
        detected += 1
        print(_csv_row(name or token, provider, token, url))
        if args.write:
            _write_registry(name or token, provider, token, url)

    logger.info("Detected %d/%d companies%s", detected, len(targets), " (written to company_registry)" if args.write else "")


if __name__ == "__main__":
    main()
