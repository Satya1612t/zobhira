"""The one entry point run_scrape.py calls to populate every derived field.

Order is deliberate and cheap-to-expensive:

    1. designation tags   (title only, pure function, microseconds)
    2. skill tags         (title + description, pure function)
    3. employment type    (source value -> canonical, pure function)
    4. workplace type     (text signals, pure function)
    5. experience         (title + description, pure function)
    6. LLM gap-fill        (network, only if 1-5 left something important null)

Step 6 is what keeps this affordable. On a representative sweep the
deterministic passes resolve experience for roughly two-thirds of postings
outright — every "Intern"/"Senior"/"SDE-1" title and every posting stating a
year figure in a recognizable form — so the LLM is only asked about the
genuinely ambiguous remainder. Running it unconditionally on every posting
would cost 3x more for no additional coverage.
"""

from __future__ import annotations

import hashlib
import logging

from designation_classifier import classify_title_list
from utils.experience import extract_experience
from utils.skill_tagger import build_tags_norm, extract_skills

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Employment type
# ---------------------------------------------------------------------------
# THE BUG THIS FIXES: buildJobsWhere() matched `tags: { has: "Fulltime" }`
# — exact, case-sensitive — against a whitelist of five canonical strings.
# Reality per source:
#   linkedin   normalizes correctly, but only during detail-page enrichment,
#              so unenriched stubs silently fail the filter
#   talentd    same
#   ycombinator pushes the RAW site value ("Full-time", with the hyphen)
#              straight into tags, so it NEVER matched "Fulltime"
#   himalayas  has real structured data in its own employment_type column
#              that was never copied into tags, so it never matched either
# Net effect: the Full-time/Internship/Contract filter worked on a minority
# of rows from one and a half sources.
#
# Now every source funnels through one canonicalizer and the value lands in
# the employment_type COLUMN (indexed) as well as tags (for display).
_EMPLOYMENT_CANONICAL = {
    "fulltime": "Fulltime", "full time": "Fulltime", "full-time": "Fulltime",
    "permanent": "Fulltime", "regular": "Fulltime",
    "parttime": "Parttime", "part time": "Parttime", "part-time": "Parttime",
    "contract": "Contract", "contractor": "Contract", "contractual": "Contract",
    "freelance": "Contract", "temporary": "Contract", "c2h": "Contract",
    "internship": "Internship", "intern": "Internship",
    "apprenticeship": "Apprenticeship", "apprentice": "Apprenticeship",
    "trainee": "Apprenticeship",
}

# Title fallback, used only when the source gave us nothing. An "Intern" in
# the title is a reliable employment-type signal and costs nothing.
_TITLE_EMPLOYMENT = [
    ("Internship", ("intern", "internship", "summer intern")),
    ("Apprenticeship", ("apprentice", "trainee", "graduate engineer trainee")),
    ("Contract", ("contract", "freelance", "consultant")),
    ("Parttime", ("part time", "part-time", "parttime")),
]


def canonical_employment_type(raw: str | None, title: str | None = None) -> str | None:
    if raw:
        key = raw.strip().lower().replace("_", " ")
        canonical = _EMPLOYMENT_CANONICAL.get(key) or _EMPLOYMENT_CANONICAL.get(key.replace(" ", ""))
        if canonical:
            return canonical
    lowered = (title or "").lower()
    for canonical, needles in _TITLE_EMPLOYMENT:
        if any(needle in lowered for needle in needles):
            return canonical
    return None


# ---------------------------------------------------------------------------
# Workplace type
# ---------------------------------------------------------------------------
# THE BUG THIS FIXES: the /jobs dropdown offers Remote / Hybrid / Onsite, but
# no scraper has ever emitted "hybrid" or "onsite" — LinkedIn/Talentd/YC set
# `"remote" if "remote" in location.lower() else "unknown"`, and Himalayas
# hardcodes "remote" because it is a remote-only board. Two of the four
# options are guaranteed-empty dead ends in the UI.
_HYBRID_MARKERS = ("hybrid", "partially remote", "part remote", "flexible working model",
                   "days in office", "days from office", "wfo and wfh")
_ONSITE_MARKERS = ("on-site", "onsite", "in-office", "work from office", "wfo",
                   "in office", "on site", "walk-in", "walk in drive")
_REMOTE_MARKERS = ("remote", "work from home", "wfh", "telecommute", "anywhere in india")


def infer_workplace_type(current: str | None, location: str | None, description: str | None) -> str:
    """Hybrid is checked FIRST: a hybrid posting almost always also contains
    the word "remote" somewhere ("3 days remote, 2 in office"), so checking
    remote first would swallow every hybrid role."""
    if current and current not in ("", "unknown"):
        return current
    haystack = f"{location or ''} {(description or '')[:2500]}".lower()
    if any(marker in haystack for marker in _HYBRID_MARKERS):
        return "hybrid"
    if any(marker in haystack for marker in _REMOTE_MARKERS):
        return "remote"
    if any(marker in haystack for marker in _ONSITE_MARKERS):
        return "onsite"
    return "unknown"


# ---------------------------------------------------------------------------
# Orchestration
# ---------------------------------------------------------------------------

def enrichment_hash(title: str, description: str | None) -> str:
    """Cache key for the LLM pass. A daily re-scrape whose description is
    byte-identical must not pay for extraction again."""
    payload = f"{title}\x00{description or ''}".encode()
    return hashlib.sha256(payload).hexdigest()


def _needs_llm(posting) -> bool:
    """Only call out when a field that actually drives filtering is still
    unknown AND there is text worth reading."""
    if not posting.description or len(posting.description.split()) < 30:
        return False
    return (
        posting.min_years_exp is None
        or not posting.employment_type
        or posting.workplace_type in (None, "", "unknown")
    )


def enrich_posting(posting, use_llm: bool = True) -> None:
    """Mutates `posting` in place. Never raises: a posting that cannot be
    enriched must still be storable, exactly like the existing
    stub-with-no-description path."""
    provenance: dict[str, str] = {}

    # 1. Designation tags from the title.
    for designation in classify_title_list(posting.title):
        if designation not in posting.tags:
            posting.tags.append(designation)
            provenance.setdefault("designations", "title")

    # 2. Skill tags. This is the step that gives LinkedIn postings skill
    #    tags for the first time.
    for skill in extract_skills(posting.title, posting.description):
        if skill not in posting.tags:
            posting.tags.append(skill)
            provenance.setdefault("skills", "description")

    # 3. Employment type -> canonical column AND tag.
    employment = canonical_employment_type(posting.employment_type, posting.title)
    if employment:
        posting.employment_type = employment
        if employment not in posting.tags:
            posting.tags.append(employment)
        provenance["employment_type"] = "source" if posting.employment_type else "title"

    # 4. Workplace type.
    inferred_workplace = infer_workplace_type(
        posting.workplace_type, posting.location, posting.description
    )
    if inferred_workplace != posting.workplace_type:
        posting.workplace_type = inferred_workplace
        provenance["workplace_type"] = "description"

    # 5. Experience.
    signal = extract_experience(posting.title, posting.description)
    posting.min_years_exp = signal.min_years
    posting.max_years_exp = signal.max_years
    posting.experience_band = signal.band
    posting.exp_source = signal.source
    if signal.is_known:
        provenance["min_years_exp"] = signal.source
        if signal.evidence:
            posting.raw["experience_evidence"] = signal.evidence

    # 6. LLM gap-fill, only for what is left.
    if use_llm and _needs_llm(posting):
        try:
            from utils.ai_extract import extract_fields, merge_into

            extracted = extract_fields(
                posting.title, posting.company, posting.location, posting.description
            )
            provenance.update(merge_into(posting, extracted))
        except Exception as exc:  # noqa: BLE001 — must never break ingest
            logger.warning("AI field extraction failed for %r: %s", posting.title, exc)

    # Band may have been filled by the LLM; keep it consistent either way.
    if not posting.experience_band:
        posting.experience_band = "unknown"

    posting.tags_norm = build_tags_norm(posting.tags)
    posting.field_provenance = provenance
    posting.enrichment_hash = enrichment_hash(posting.title, posting.description)
