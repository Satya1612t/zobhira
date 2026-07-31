"""Matches a scraped job's title back against the designation taxonomy.

Needed because the scheduler searches each source with one broad query per
stream (taxonomy.STREAM_QUERIES) instead of all the exact designations — a
job titled "iOS Developer" comes back from the broad "Mobile Developer"
search, but nothing marks it as specifically "iOS Developer". This recovers
that granularity from the title alone, purely for tagging (browse/filter);
it has no effect on whether a posting gets scraped or saved.

CHANGED FROM THE ORIGINAL: both the title and each designation now go
through role_aliases.tokenize(), which expands abbreviations (SDE, SWE,
SRE, QA), collapses interchangeable role nouns (engineer/programmer/dev ->
developer) and strips seniority noise. Previously the check was a raw
word-subset test, so "Full Stack Engineer" did not match "Full Stack
Developer", "Senior Software Engineer" matched nothing at all, and every
"SDE-2" posting came out untagged. Those are not edge cases — between them
they are a large share of Indian technical postings, and an untagged job is
missing from every tag-driven surface on the site.

Still a pure function of the title with no I/O, so it stays cheap enough to
run on every posting and testable without a database.
"""

from __future__ import annotations

from functools import lru_cache

from role_aliases import tokenize
from taxonomy import TECHNICAL_DESIGNATIONS

# Precomputed once at import: each designation's canonical token set.
_DESIGNATION_TOKENS: list[tuple[str, set[str]]] = [
    (designation, tokenize(designation)) for designation in TECHNICAL_DESIGNATIONS
]

# A designation whose tokens all survive stop-word stripping would match
# everything; guard against a taxonomy entry made entirely of noise words.
_DESIGNATION_TOKENS = [(d, t) for d, t in _DESIGNATION_TOKENS if t]


@lru_cache(maxsize=8192)
def classify_title(title: str) -> tuple[str, ...]:
    """Returns every designation whose full canonical token set appears in
    the title's canonical token set.

    A title can legitimately match more than one designation ("QA Automation
    Test Engineer" matches both "QA Engineer" and "Automation Test
    Engineer"); all matches are kept, since this is a tag, not a single
    category.

    Returns a tuple rather than a list so the result is hashable and this
    can be lru_cached — the same handful of titles recur constantly across a
    sweep (every source returns "Software Engineer" dozens of times), and the
    tokenizer is the most expensive part of the ingest path.
    """
    if not title:
        return ()
    title_tokens = tokenize(title)
    if not title_tokens:
        return ()
    return tuple(
        designation
        for designation, designation_tokens in _DESIGNATION_TOKENS
        if designation_tokens <= title_tokens
    )


def classify_title_list(title: str) -> list[str]:
    """List-returning wrapper for callers that mutate the result (run_scrape
    appends these onto posting.tags). Never hand out the cached tuple's
    contents in a way that lets a caller mutate shared state."""
    return list(classify_title(title or ""))
