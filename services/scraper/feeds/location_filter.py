"""Shared eligibility check for feed postings' raw `location` string.

Kept in its own module (not scripts/run_feed.py) so every provider can reuse
the exact same rule without importing run_feed — which would be circular, since
run_feed imports the providers. Trusts ONLY the structured location string,
never description-inferred workplace_type — see run_feed.py's long comment for
the ~1180-leak reason.
"""

from __future__ import annotations

import re

_INDIA_LOCATION_RE = re.compile(r"\bindia\b", re.IGNORECASE)

# Truly-global remote — a role open to anywhere on earth, which an India-based
# candidate can take. A deliberate WHITELIST of unambiguous "anywhere in the
# world" phrasing; a bare "Remote"/"Fully Remote" is NOT accepted (it usually
# defaults to a specific country) precisely to avoid re-introducing non-India
# leakage.
_GLOBAL_REMOTE_RE = re.compile(
    r"\b(worldwide|world\s*wide|globally|anywhere"
    r"|remote\s*[-–—,/]?\s*global|global\s*[-–—,/]?\s*remote)\b",
    re.IGNORECASE,
)
# A country/region qualifier means the remote is scoped, NOT global — reject
# even when a global-ish word also appears ("Anywhere in the US", "Remote -
# Global, US timezones"). Regional buckets (EMEA/APAC) are scoped too. India is
# intentionally absent — an India mention is already accepted above.
_NON_INDIA_RESTRICTION_RE = re.compile(
    r"\b(u\.?s\.?a?|us|united states|americas?|north america|canada|uk|"
    r"united kingdom|emea|apac|europe(?:an)?|latam|latin america|mexico|brazil|"
    r"argentina|australia|singapore|germany|france|ireland|poland|portugal|"
    r"spain|romania|philippines|japan|china|uae|dubai|nigeria|kenya|egypt)\b",
    re.IGNORECASE,
)


def is_india_location(location: str | None) -> bool:
    return bool(_INDIA_LOCATION_RE.search(location or ""))


def is_eligible_location(location: str | None) -> bool:
    """India-located OR truly-global-remote (open to anywhere). Country-scoped
    remote (Remote - US/EMEA/APAC/…) and bare 'Remote' are excluded."""
    loc = location or ""
    if _INDIA_LOCATION_RE.search(loc):
        return True
    return bool(_GLOBAL_REMOTE_RE.search(loc) and not _NON_INDIA_RESTRICTION_RE.search(loc))
