"""Structured, schema-validated LLM field extraction — the gap-fill pass.

WHAT CHANGED CONCEPTUALLY
-------------------------
Before this module the codebase used an LLM in three places and NONE of them
populated a field anyone can filter on:

  * scrapers/llm_fallback.py::run_smart_scraper — only fires when
    deterministic selectors break, returns free-form fields straight into
    JobPosting via .get() with no validation whatsoever
  * utils/job_formatter.py::format_job_description — prose sectioning, run
    ON DEMAND at first detail-page view, so the first visitor to every job
    page pays a full LLM round-trip
  * utils/contest_summarizer.py — contests only

This module adds the missing one: a single structured pass at INGEST that
produces the values /jobs actually filters and sorts on.

THE FOUR RULES THAT MAKE THIS SAFE
----------------------------------
1. CLOSED VOCABULARIES. Every list-valued field is constrained to a fixed
   set handed to the model in the prompt and re-checked on the way back. An
   open "return the skills" prompt yields "React.js", "ReactJS" and "React
   Framework" for one posting, none of which match a user typing "react" —
   which is exactly the unfilterable-tag problem this whole workstream is
   fixing. Reintroducing it via the LLM would be self-defeating.

2. EVIDENCE SPANS, VERIFIED. Every inferred number must come with the
   verbatim phrase it was read from, and that phrase must actually occur in
   the source text (whitespace-insensitively). If it does not, the field is
   DISCARDED. This is the single highest-value guard here: a hallucinated
   min_years_experience would corrupt the fresher filter far worse than the
   old regex did, because it would look confident and specific.

3. LLM NEVER OVERWRITES DETERMINISTIC. It fills nulls only. merge_into()
   enforces this and records per-field provenance so a bad prompt revision
   can be rolled back against only the rows it touched.

4. NEVER RAISES. A failure here must leave the posting storable with
   whatever the deterministic pass found. Returns None on any failure.

MODEL SELECTION
---------------
This pass pins ONE model via EXTRACTION_MODEL rather than using
FreeLLMAPI's "auto" router. Auto-routing picks a different model per call,
which means extraction quality varies run to run and a prompt change cannot
be evaluated — you would never know whether a metric moved because of your
prompt or because the router happened to pick a different backend that
hour. Routing is fine for the scrapegraphai fallback (where any working
model beats no model); it is not fine for a field extractor whose output
lands in a filter.
"""

from __future__ import annotations

import json
import logging
import os
import re
from typing import Literal

from pydantic import BaseModel, Field, ValidationError, field_validator

from utils.skill_vocab import canonical_skills, canonicalize

logger = logging.getLogger(__name__)

# Pin one model. Override per-environment, but do NOT set this to "auto".
EXTRACTION_MODEL = os.environ.get("EXTRACTION_MODEL", "gemini-2.0-flash")

# Descriptions are truncated before being sent. Two reasons: cost, and the
# fact that experience/skill requirements essentially always appear in the
# first part of a posting — the tail is benefits and EEO boilerplate.
MAX_DESCRIPTION_CHARS = 6000

EMPLOYMENT_TYPES = ["fulltime", "parttime", "contract", "internship", "apprenticeship", "unknown"]
WORKPLACE_TYPES = ["remote", "hybrid", "onsite", "unknown"]
EXPERIENCE_BANDS = ["fresher", "junior", "mid", "senior", "lead", "unknown"]
EDUCATION_LEVELS = [
    "any", "diploma", "btech", "be", "bsc", "bca", "bcom", "ba",
    "mtech", "msc", "mca", "mba", "phd",
]


class ExtractedFields(BaseModel):
    """Strict schema. Anything the model returns that is not in here is
    dropped by pydantic; anything malformed raises ValidationError, which
    the caller turns into one repair retry."""

    min_years_experience: float | None = Field(default=None, ge=0, le=40)
    max_years_experience: float | None = Field(default=None, ge=0, le=40)
    experience_band: Literal["fresher", "junior", "mid", "senior", "lead", "unknown"] = "unknown"
    employment_type: Literal[
        "fulltime", "parttime", "contract", "internship", "apprenticeship", "unknown"
    ] = "unknown"
    workplace_type: Literal["remote", "hybrid", "onsite", "unknown"] = "unknown"
    is_walk_in: bool = False
    education: list[str] = Field(default_factory=list)
    skills: list[str] = Field(default_factory=list)
    salary_min: float | None = Field(default=None, ge=0)
    salary_max: float | None = Field(default=None, ge=0)
    salary_period: Literal["year", "month", "hour", "unknown"] = "unknown"
    # field name -> verbatim source phrase the value was read from
    evidence: dict[str, str] = Field(default_factory=dict)

    @field_validator("skills", mode="after")
    @classmethod
    def _only_known_skills(cls, value: list[str]) -> list[str]:
        """Second line of defence behind the prompt: models drift off a
        supplied vocabulary surprisingly often, especially when they are
        confident the right answer is just outside it."""
        out: list[str] = []
        for item in value:
            canonical = canonicalize(str(item))
            if canonical and canonical not in out:
                out.append(canonical)
        return out

    @field_validator("education", mode="after")
    @classmethod
    def _only_known_education(cls, value: list[str]) -> list[str]:
        return [v for v in dict.fromkeys(str(x).strip().lower() for x in value) if v in EDUCATION_LEVELS]


def _build_prompt(title: str, company: str, location: str | None, description: str) -> str:
    skills = ", ".join(canonical_skills())
    return f"""You are extracting structured data from a job posting for a search index.

Extract ONLY what the posting actually states. Do not infer, guess, or use
general knowledge about the company or the role. If the posting does not
state something, use null (for numbers), "unknown" (for enums), or [] (for
lists). A missing value is correct and useful; an invented value corrupts
the search index.

For every numeric field you fill in (min_years_experience,
max_years_experience, salary_min, salary_max), you MUST add an entry to
"evidence" whose value is the exact substring of the posting the number
came from, copied character-for-character. If you cannot quote it, set the
field to null instead.

FIELD RULES
- min/max_years_experience: years of professional experience REQUIRED of the
  applicant. Ignore any mention of the company's own age, how long it has
  operated, contract length, or notice period.
- experience_band: fresher (0-1 yrs), junior (1-3), mid (3-5), senior (5-8),
  lead (8+). Must agree with min_years_experience when that is set.
- employment_type: one of {", ".join(EMPLOYMENT_TYPES)}
- workplace_type: one of {", ".join(WORKPLACE_TYPES)}. Use "onsite" only if
  the posting says work happens at an office/site; do not infer it from the
  presence of a city name.
- is_walk_in: true only if the posting describes a walk-in drive or asks
  candidates to physically attend without applying first.
- education: zero or more of {", ".join(EDUCATION_LEVELS)}
- salary_min/max: numbers only, no currency symbols or commas. Use the
  period the posting states via salary_period. Do not convert.
- skills: choose ONLY from this exact list, copying the spelling exactly.
  Any value outside this list will be discarded:
{skills}

POSTING
Title: {title}
Company: {company}
Location: {location or "not stated"}
Description:
{description[:MAX_DESCRIPTION_CHARS]}

Respond with ONLY valid JSON, no markdown fence and no commentary, in
exactly this shape:
{{"min_years_experience": null, "max_years_experience": null,
"experience_band": "unknown", "employment_type": "unknown",
"workplace_type": "unknown", "is_walk_in": false, "education": [],
"skills": [], "salary_min": null, "salary_max": null,
"salary_period": "unknown", "evidence": {{}}}}"""


_FENCE_RE = re.compile(r"^\s*```(?:json)?\s*|\s*```\s*$", re.MULTILINE)
_WS_RE = re.compile(r"\s+")


def _strip_fence(text: str) -> str:
    return _FENCE_RE.sub("", text).strip()


def _normalize_for_evidence(text: str) -> str:
    """Whitespace- and case-insensitive comparison. Models reliably
    normalize whitespace when quoting (collapsing a line break inside a
    bullet to a single space), and rejecting a correct quote over a newline
    would throw away good extractions."""
    return _WS_RE.sub(" ", text).strip().lower()


# Fields whose value is only trusted if backed by a verifiable quote.
EVIDENCE_REQUIRED = ("min_years_experience", "max_years_experience", "salary_min", "salary_max")


def _drop_unevidenced(data: ExtractedFields, source_text: str) -> ExtractedFields:
    """Nulls out every numeric field whose evidence string does not actually
    occur in the posting. Rule 2 from the module docstring, and the reason
    this pass can be trusted near the fresher filter."""
    haystack = _normalize_for_evidence(source_text)
    payload = data.model_dump()
    dropped: list[str] = []

    for field in EVIDENCE_REQUIRED:
        if payload.get(field) is None:
            continue
        quote = data.evidence.get(field)
        if not quote or _normalize_for_evidence(quote) not in haystack:
            payload[field] = None
            dropped.append(field)

    if dropped:
        logger.info("Dropped unevidenced LLM fields: %s", ", ".join(dropped))
        # An experience band asserted without a verifiable number behind it
        # is exactly the confident-but-wrong output that would poison the
        # fresher filter, so it goes too.
        if payload.get("min_years_experience") is None:
            payload["experience_band"] = "unknown"

    return ExtractedFields.model_validate(payload)


def extract_fields(
    title: str,
    company: str,
    location: str | None,
    description: str | None,
) -> ExtractedFields | None:
    """Runs one extraction. Returns None on any failure — never raises, so a
    provider outage degrades to "deterministic values only" rather than
    stalling the pipeline."""
    if not description or not description.strip():
        return None

    from scrapers.llm_fallback import run_text_completion

    prompt = _build_prompt(title, company, location, description)
    raw = run_text_completion(prompt)
    if not raw:
        return None

    for attempt in range(2):
        try:
            parsed = json.loads(_strip_fence(raw))
            data = ExtractedFields.model_validate(parsed)
            return _drop_unevidenced(data, description)
        except (json.JSONDecodeError, ValidationError) as exc:
            if attempt == 1:
                logger.warning("LLM extraction unusable after repair attempt: %s", exc)
                return None
            # One repair round-trip with the actual error appended. Far
            # cheaper and more reliable than discarding the call, because
            # the common failure is a single bad enum value or a stray
            # trailing comma, not a wholesale misunderstanding.
            logger.info("LLM extraction did not validate, requesting repair: %s", exc)
            raw = run_text_completion(
                f"{prompt}\n\nYour previous answer was rejected with this error:\n{exc}\n"
                "Return corrected JSON only."
            ) or ""
            if not raw:
                return None
    return None


def merge_into(posting, extracted: ExtractedFields | None) -> dict[str, str]:
    """Applies extracted values to `posting` WITHOUT overwriting anything
    already set deterministically, and returns the provenance map for the
    fields it actually filled.

    Rule 3 from the module docstring. Deterministic extraction is auditable
    and reproducible; LLM extraction is neither. When they disagree, the
    auditable one wins — the LLM is here to fill gaps, not to arbitrate.
    """
    provenance: dict[str, str] = {}
    if extracted is None:
        return provenance

    if posting.min_years_exp is None and extracted.min_years_experience is not None:
        posting.min_years_exp = extracted.min_years_experience
        posting.max_years_exp = extracted.max_years_experience
        posting.experience_band = extracted.experience_band
        posting.exp_source = "llm"
        provenance["min_years_exp"] = "llm"

    if not posting.employment_type and extracted.employment_type != "unknown":
        posting.employment_type = extracted.employment_type
        provenance["employment_type"] = "llm"

    if posting.workplace_type in (None, "", "unknown") and extracted.workplace_type != "unknown":
        posting.workplace_type = extracted.workplace_type
        provenance["workplace_type"] = "llm"

    if posting.salary_min is None and extracted.salary_min is not None:
        posting.salary_min = extracted.salary_min
        posting.salary_max = extracted.salary_max
        provenance["salary_min"] = "llm"

    new_skills = [s for s in extracted.skills if s not in posting.tags]
    if new_skills:
        posting.tags.extend(new_skills)
        provenance["skills"] = "llm"

    if extracted.is_walk_in and "Walk-in" not in posting.tags:
        posting.tags.append("Walk-in")
        provenance["is_walk_in"] = "llm"

    for level in extracted.education:
        tag = level.upper()
        if tag not in posting.tags:
            posting.tags.append(tag)

    return provenance
