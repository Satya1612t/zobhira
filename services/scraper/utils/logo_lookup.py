import logging

from utils.http import make_client

logger = logging.getLogger(__name__)

# Clearbit's company-autocomplete endpoint takes a plain company name (no
# domain guessing needed) and returns candidate companies with a resolved
# domain. Its own `logo` field is dead — Clearbit's actual logo-serving API
# (logo.clearbit.com) was decommissioned after the HubSpot acquisition and
# no longer resolves at all (confirmed: DNS lookup fails outright) — so this
# is only used to turn a company name into a domain.
SUGGEST_URL = "https://autocomplete.clearbit.com/v1/companies/suggest"

# Google's favicon service takes any domain and returns a real image with no
# API key and no rate limit surprises so far — used here purely as a logo
# stand-in once a domain is known. Lower fidelity than a dedicated logo API
# (favicon-sized, not a full brand mark), but it's live and free.
FAVICON_URL = "https://www.google.com/s2/favicons"


def _resolve_domain(company: str) -> str | None:
    try:
        with make_client(timeout=5.0) as client:
            response = client.get(SUGGEST_URL, params={"query": company})
            response.raise_for_status()
            results = response.json()
    except Exception:
        logger.warning("Company->domain lookup failed for company=%r", company)
        return None

    if not isinstance(results, list) or not results:
        return None
    return results[0].get("domain") or None


def find_logo_url(company: str) -> str | None:
    """Best-effort lookup, not a hard dependency — any failure (network,
    no match, unexpected shape) just returns None so the caller falls back
    to storing the job without a logo rather than blocking on this."""
    if not company or not company.strip() or company.strip().lower() == "unknown":
        return None
    domain = _resolve_domain(company.strip())
    if not domain:
        return None
    return f"{FAVICON_URL}?domain={domain}&sz=128"
