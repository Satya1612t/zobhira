"""Deterministic experience-level extraction from a posting's title and
description. Runs at ingest; the result is stored in
jobs.min_years_exp / max_years_exp / experience_band / exp_source so
/jobs can filter on an indexed column instead of regex-matching free text
on every request.

WHY THIS REPLACES THE OLD QUERY-TIME REGEX
------------------------------------------
apps/web/src/lib/jobQuery.ts used a single pattern:

    (\\d+)\\+?\\s*(?:-|to)?\\s*\\d*\\+?\\s*years?\\s+(?:of\\s+)?experience

which requires the literal word "experience" directly after "years". That
misses nearly every real phrasing — "5+ years of hands-on experience",
"3 years' experience", "Experience: 4+ years", "4 yrs experience",
"5-7 years in backend development". And the fresher branch was

    matches fresher keywords  OR  description !~* <that pattern>

so every senior posting the pattern failed to recognise fell through the
`!~*` arm and was returned as a FRESHER result. The filter was not empty,
it was inverted.

Three further holes this module closes:

1. A NULL description made every branch evaluate to NULL, so unenriched
   stubs (most fresh LinkedIn/Talentd/YC inventory) matched no experience
   filter at all. Title is always present, so title-only rows are now
   classifiable.
2. The title was never consulted, despite being the single most reliable
   signal available ("Senior", "Intern", "SDE-1").
3. regexp_match returns only the FIRST match in the document, so
   "founded 10 years ago ... 2 years experience required" read as 10+.

RECONCILIATION RULES (deliberate, and the part worth arguing about)
-------------------------------------------------------------------
* An intern/trainee/fresher TITLE beats anything the description says.
  Descriptions routinely carry company boilerplate ("we hire engineers
  with 10+ years across the org"); an "Intern" title never means senior.
* A senior/lead TITLE sets a FLOOR that the description can raise but not
  lower, for the mirror-image reason: "Senior Engineer ... freshers may
  also apply to our graduate programme" must not land in the fresher band.
* When several year-figures appear, the one inside the requirements /
  eligibility section wins; failing that, the SMALLEST is used. Smallest
  is an inclusive bias, chosen on purpose: for a platform whose whole
  pitch is early-career reach, wrongly showing a fresher a 2-year role is
  a far cheaper error than hiding a role that would have taken them.

Everything here is pure text -> value with no I/O, which is what makes it
cheap enough to run on every posting and testable without a database. Rows
this module cannot classify are left band='unknown' for the LLM gap-fill
pass in utils/ai_extract.py to attempt.
"""

from __future__ import annotations

import re
from dataclasses import dataclass

# Band cutoffs on min_years. The FIRST bound is INCLUSIVE and the rest are
# EXCLUSIVE, which is not a typo:
#
#   min <= 1  -> fresher     (0-1 yr, and 1-3 yr postings, which in the
#                             Indian early-career market do take graduates)
#   1 < min < 3  -> junior
#   3 <= min < 5 -> mid
#   5 <= min < 8 -> senior
#   min >= 8     -> lead
#
# Getting this wrong is easy and expensive: an all-inclusive `<=` reads
# "5+ years" as mid and "8+ years" as senior, quietly promoting senior
# roles into the bands freshers browse. The eval harness
# (scripts/eval_experience.py) covers exactly these boundary values.
FRESHER_MAX_YEARS = 1.0
BAND_THRESHOLDS: list[tuple[float, str]] = [
    (3.0, "junior"),
    (5.0, "mid"),
    (8.0, "senior"),
]
TOP_BAND = "lead"

# How far after a bare "N years" we look for a disqualifying word before
# accepting it as an experience requirement.
_BARE_CONTEXT_WINDOW = 45

# How much text after a requirements/eligibility heading counts as "the
# requirements section".
_SECTION_WINDOW = 2000


@dataclass(frozen=True)
class ExperienceSignal:
    """min/max are years. `band` is always one of BAND_THRESHOLDS' labels,
    TOP_BAND, or 'unknown'. `source` records which extractor won, and is
    persisted so a later prompt/regex change can be re-run against only the
    rows it produced. `evidence` is the verbatim span the numbers came from
    — kept short, and surfaced in the admin UI so a wrong classification is
    debuggable without re-reading the whole JD."""

    min_years: float | None
    max_years: float | None
    band: str
    source: str  # 'title' | 'description' | 'none'
    evidence: str | None = None

    @property
    def is_known(self) -> bool:
        return self.band != "unknown"


UNKNOWN = ExperienceSignal(None, None, "unknown", "none", None)


def band_for(min_years: float | None) -> str:
    if min_years is None:
        return "unknown"
    if min_years <= FRESHER_MAX_YEARS:
        return "fresher"
    for upper, band in BAND_THRESHOLDS:
        if min_years < upper:
            return band
    return TOP_BAND


# ---------------------------------------------------------------------------
# Title signals
# ---------------------------------------------------------------------------
# Evaluated in this order, first match wins — so "Senior Associate" reads as
# senior, not junior, and "Lead Data Scientist" as lead, not mid.

_TITLE_LEAD = re.compile(
    r"\b(principal|staff\s+engineer|distinguished|architect|head\s+of|"
    r"director|vice\s+president|vp\b|chief|cto\b|engineering\s+manager|"
    r"director\s+of\s+engineering)\b",
    re.I,
)

_TITLE_SENIOR = re.compile(
    r"(\bsenior\b|\bsr\.?\b|\blead\b|tech(?:nical)?\s+lead|team\s+lead|"
    r"\bsde\s*[-–]?\s*(?:3|iii)\b|\bswe\s*[-–]?\s*(?:3|iii)\b|"
    r"\b(?:engineer|developer|analyst)\s+(?:iii|iv)\b)",
    re.I,
)

_TITLE_MID = re.compile(
    r"(\bsde\s*[-–]?\s*(?:2|ii)\b|\bswe\s*[-–]?\s*(?:2|ii)\b|"
    r"\b(?:engineer|developer|analyst)\s+ii\b|\bmid[\s-]?level\b)",
    re.I,
)

# Fresher = genuinely zero-experience-friendly.
_TITLE_FRESHER = re.compile(
    r"(\bintern\b|\binternship\b|\btrainee\b|\bfresher(?:s)?\b|"
    r"graduate\s+(?:engineer|trainee|programme|program)|\bget\b|"
    r"\bapprentice(?:ship)?\b|\bcampus\b|entry[\s-]?level|"
    r"\bsde\s*[-–]?\s*(?:1|i)\b|\bswe\s*[-–]?\s*(?:1|i)\b|"
    r"\b(?:engineer|developer|analyst)\s+i\b|"
    r"\b0\s*[-–to]{1,2}\s*1\s*(?:years?|yrs?)\b)",
    re.I,
)

# Junior = one rung up; keeps "Junior Developer" out of the fresher bucket
# without pushing it all the way to mid.
_TITLE_JUNIOR = re.compile(r"(\bjunior\b|\bjr\.?\b|\bassociate\b)", re.I)

# (regex, floor_years, band_if_this_is_the_only_signal)
_TITLE_RULES: list[tuple[re.Pattern[str], float, str]] = [
    (_TITLE_LEAD, 8.0, TOP_BAND),
    (_TITLE_SENIOR, 5.0, "senior"),
    (_TITLE_MID, 2.0, "junior"),
    (_TITLE_FRESHER, 0.0, "fresher"),
    (_TITLE_JUNIOR, 1.0, "junior"),
]


def title_signal(title: str | None) -> ExperienceSignal:
    if not title:
        return UNKNOWN
    for pattern, floor, band in _TITLE_RULES:
        match = pattern.search(title)
        if match:
            return ExperienceSignal(
                min_years=floor,
                max_years=None,
                band=band,
                source="title",
                evidence=match.group(0).strip(),
            )
    return UNKNOWN


# ---------------------------------------------------------------------------
# Description signals
# ---------------------------------------------------------------------------

_WORD_NUMBERS = {
    "zero": 0, "one": 1, "two": 2, "three": 3, "four": 4, "five": 5,
    "six": 6, "seven": 7, "eight": 8, "nine": 9, "ten": 10, "twelve": 12,
}
_NUM = r"(\d{1,2}(?:\.\d)?|" + "|".join(_WORD_NUMBERS) + r")"
_YEARS = r"(?:years?|yrs?\.?|yr\.?)"
_DASH = r"(?:-|–|—|\bto\b|\bor\b)"

# Ordered most-specific first. Each entry is (pattern, group_for_min,
# group_for_max_or_None).
_RANGE_RE = re.compile(rf"{_NUM}\s*{_DASH}\s*{_NUM}\s*\+?\s*{_YEARS}", re.I)
_PLUS_RE = re.compile(rf"{_NUM}\s*\+\s*{_YEARS}", re.I)
_MIN_PHRASE_RE = re.compile(
    rf"(?:minimum|min\.?|at\s*least|atleast|more\s+than|over|upwards\s+of)\s*"
    rf"(?:of\s*)?{_NUM}\s*\+?\s*{_YEARS}",
    re.I,
)
# "Experience: 3-5 years" / "Experience - 4 years" / "Exp: 2+ yrs"
_REVERSED_RANGE_RE = re.compile(
    rf"(?:experience|exp\.?|work\s*ex)\s*[:\-–]\s*{_NUM}\s*{_DASH}\s*{_NUM}\s*\+?\s*{_YEARS}?",
    re.I,
)
_REVERSED_SINGLE_RE = re.compile(
    rf"(?:experience|exp\.?|work\s*ex)\s*[:\-–]\s*{_NUM}\s*\+?\s*{_YEARS}?",
    re.I,
)
# Months, for the "6 months to 2 years" / "6+ months" shape common on
# internship-adjacent postings. Converted to fractional years so a
# six-month requirement lands in the fresher band rather than rounding to 1.
_MONTHS_RE = re.compile(rf"{_NUM}\s*\+?\s*(?:months?|mos?\.?)\b", re.I)

# A bare "5 years" is only an experience requirement if nothing nearby says
# it is something else. Without this guard, "a 10 year old company" and
# "5 years in business" both read as senior requirements.
_BARE_RE = re.compile(rf"{_NUM}\s*\+?\s*{_YEARS}", re.I)
_BARE_DISQUALIFIERS = re.compile(
    r"\b(old|ago|anniversary|founded|established|running|in\s+business|"
    r"history|since|track\s+record\s+of\s+growth|warranty|contract\s+term|"
    r"visa|bond|lock[\s-]?in)\b",
    re.I,
)
_EXPERIENCE_CONTEXT = re.compile(
    r"\b(experience|exp\b|hands[\s-]?on|professional|industry|relevant|"
    r"working|work\s*ex|background|expertise|practice)\b",
    re.I,
)

# Zero-experience phrasing. Checked only when no numeric requirement was
# found, so "freshers may apply to our other openings" inside a senior JD
# cannot override an explicit "5+ years".
_FRESHER_PHRASE_RE = re.compile(
    r"(\bfresher(?:s)?\b|fresh\s+graduates?|recent\s+graduates?|"
    r"no\s+(?:prior\s+|previous\s+)?experience(?:\s+(?:is\s+)?"
    r"(?:required|necessary|needed))?|entry[\s-]?level|"
    r"final[\s-]?year\s+students?|pre[\s-]?final[\s-]?year|"
    r"(?:batch\s+of\s+)?20\d\d\s+(?:pass\s*outs?|batch)|batch\s+of\s+20\d\d|"
    r"campus\s+(?:hiring|placement|drive|recruitment)|"
    r"open\s+to\s+freshers|freshers?\s+(?:are\s+)?welcome|"
    r"0\s*[-–]\s*1\s*(?:years?|yrs?))",
    re.I,
)

_REQUIREMENTS_HEADING_RE = re.compile(
    r"^\s*(?:#+\s*)?(?:required\s+)?"
    r"(requirements?|qualifications?|eligibility|who\s+(?:you\s+are|we"
    r"'?re\s+looking\s+for)|what\s+we(?:'|’)?re\s+looking\s+for|"
    r"skills?\s*(?:&|and)?\s*(?:experience|requirements?)?|"
    r"desired\s+(?:candidate\s+)?profile|candidate\s+profile|must[\s-]?haves?)"
    r"\s*:?\s*$",
    re.I | re.M,
)


def _to_float(token: str) -> float | None:
    token = token.strip().lower()
    if token in _WORD_NUMBERS:
        return float(_WORD_NUMBERS[token])
    try:
        return float(token)
    except ValueError:
        return None


def _requirements_slice(text: str) -> str | None:
    """Returns the chunk of text following the first requirements-style
    heading, or None if the posting has no such heading. Restricting the
    numeric search to this slice is what stops a company blurb's "serving
    customers for 15 years" from setting the experience bar."""
    match = _REQUIREMENTS_HEADING_RE.search(text)
    if not match:
        return None
    chunk = text[match.end() : match.end() + _SECTION_WINDOW]
    return chunk if chunk.strip() else None


def _bare_is_plausible(text: str, match: re.Match[str]) -> bool:
    window = text[match.end() : match.end() + _BARE_CONTEXT_WINDOW]
    if _BARE_DISQUALIFIERS.search(window):
        return False
    # Look both directions for a word that makes this an experience figure.
    before = text[max(0, match.start() - _BARE_CONTEXT_WINDOW) : match.start()]
    return bool(_EXPERIENCE_CONTEXT.search(window) or _EXPERIENCE_CONTEXT.search(before))


def _collect_candidates(text: str) -> list[tuple[float, float | None, str]]:
    """Returns every (min, max, evidence) year-figure the text plausibly
    states as an experience requirement. Deliberately collects ALL of them
    rather than stopping at the first — picking among them is the caller's
    job and needs the full set."""
    found: list[tuple[float, float | None, str]] = []

    def add(lo: str, hi: str | None, evidence: str) -> None:
        low = _to_float(lo)
        if low is None or low > 40:  # 40+ years is a parse error, not a job
            return
        high = _to_float(hi) if hi else None
        if high is not None and high < low:
            high = None
        found.append((low, high, evidence.strip()))

    for pattern in (_REVERSED_RANGE_RE, _RANGE_RE):
        for m in pattern.finditer(text):
            add(m.group(1), m.group(2), m.group(0))

    for pattern in (_MIN_PHRASE_RE, _PLUS_RE, _REVERSED_SINGLE_RE):
        for m in pattern.finditer(text):
            add(m.group(1), None, m.group(0))

    for m in _MONTHS_RE.finditer(text):
        months = _to_float(m.group(1))
        if months is not None and months <= 60:
            add(str(round(months / 12.0, 1)), None, m.group(0))

    if not found:
        for m in _BARE_RE.finditer(text):
            if _bare_is_plausible(text, m):
                add(m.group(1), None, m.group(0))

    return found


def description_signal(description: str | None) -> ExperienceSignal:
    if not description or not description.strip():
        return UNKNOWN

    # Prefer figures stated inside the requirements section; fall back to
    # the whole document only if that section has none.
    section = _requirements_slice(description)
    candidates = _collect_candidates(section) if section else []
    if not candidates:
        candidates = _collect_candidates(description)

    if candidates:
        # Smallest stated minimum wins — see the module docstring on why the
        # inclusive bias is the right error to make here.
        low, high, evidence = min(candidates, key=lambda c: c[0])
        return ExperienceSignal(low, high, band_for(low), "description", evidence)

    phrase = _FRESHER_PHRASE_RE.search(description)
    if phrase:
        return ExperienceSignal(0.0, 1.0, "fresher", "description", phrase.group(0).strip())

    return UNKNOWN


# ---------------------------------------------------------------------------
# Reconciliation
# ---------------------------------------------------------------------------

def extract_experience(title: str | None, description: str | None) -> ExperienceSignal:
    """The one function callers use. Safe on None/empty for both arguments;
    returns UNKNOWN rather than raising, because a posting that cannot be
    classified must still be storable."""
    from_title = title_signal(title)
    from_desc = description_signal(description)

    # An intern/trainee/fresher title is decisive — no description figure
    # overrides it. This is the single highest-precision rule in the module.
    if from_title.band == "fresher":
        return from_title

    if from_title.is_known and from_desc.is_known:
        # Title sets a floor; the description may raise it but never lower
        # it, so "Senior Engineer" cannot be dragged into fresher by
        # graduate-programme boilerplate further down the page.
        low = max(from_title.min_years or 0.0, from_desc.min_years or 0.0)
        high = from_desc.max_years
        if high is not None and high < low:
            high = None
        # Credit the description when it is what actually moved the number,
        # so exp_source stays honest for later re-runs.
        source = "description" if (from_desc.min_years or 0.0) >= (from_title.min_years or 0.0) else "title"
        evidence = from_desc.evidence if source == "description" else from_title.evidence
        return ExperienceSignal(low, high, band_for(low), source, evidence)

    if from_desc.is_known:
        return from_desc
    return from_title  # known-from-title, or UNKNOWN
