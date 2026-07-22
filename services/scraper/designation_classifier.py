"""Matches a scraped job's title back against the 58-designation taxonomy.

Needed because the scheduler now searches each source with one broad query
per stream (STREAM_QUERIES) instead of all 58 exact designations — a job
titled "iOS Developer" is returned by the broad "Mobile Developer" search,
but nothing marks it as specifically "iOS Developer" anymore. This recovers
that granularity from the title text alone, purely for tagging (browse/
filter); it has no effect on whether a posting gets scraped or saved."""

import re

from taxonomy import TECHNICAL_DESIGNATIONS

_WORD_RE = re.compile(r"[a-z0-9]+")


def _words(text: str) -> set[str]:
    return set(_WORD_RE.findall(text.lower()))


# Precomputed once at import time: each designation's own significant words
# (dropping short filler words like "of"/"a" isn't needed here since the
# taxonomy strings are all clean title-case role names).
_DESIGNATION_WORDS: list[tuple[str, set[str]]] = [
    (designation, _words(designation)) for designation in TECHNICAL_DESIGNATIONS
]


def classify_title(title: str) -> list[str]:
    """Returns every designation whose full set of words all appear
    somewhere in the title (e.g. "Senior iOS Developer, Payments" matches
    "iOS Developer" since both "ios" and "developer" are present). A title
    can match more than one designation (e.g. "QA Automation Test
    Engineer" matches both "QA Engineer" and "Automation Test Engineer");
    all matches are kept since this is a tag, not a single category."""
    if not title:
        return []
    title_words = _words(title)
    return [
        designation
        for designation, designation_words in _DESIGNATION_WORDS
        if designation_words <= title_words
    ]
