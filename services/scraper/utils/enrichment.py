from db.repository import connect, get_known_dedup_keys
from utils.dedup import make_dedup_key


def select_unenriched(postings: list, detail_limit: int | None) -> list:
    """Returns up to `detail_limit` postings from `postings` that don't
    already have a saved description — used by each Playwright-based
    scraper's `_scrape_deterministic()` right before calling `enrich()`, so
    a full detail-page load (the slowest part of any sweep by far) is only
    spent on postings we genuinely don't have yet. Previously `detail_limit`
    always meant "the first N postings in list order," which on a source
    swept repeatedly (LinkedIn: daily) meant re-fetching the same
    already-known jobs' detail pages over and over while newer postings
    further down the list never got enriched at all.

    Safe to skip enrichment entirely for an already-known posting: the
    UPSERT in db/repository.py preserves the existing description/tags/raw/
    logo_url when this run's posting object leaves them empty, so a skipped
    posting's earlier good data isn't lost."""
    if not postings:
        return []
    dedup_keys = [make_dedup_key(p.company, p.title, p.location) for p in postings]
    conn = connect()
    try:
        known = get_known_dedup_keys(conn, dedup_keys)
    finally:
        conn.close()
    unenriched = [p for p, key in zip(postings, dedup_keys) if key not in known]
    return unenriched[:detail_limit] if detail_limit else unenriched
