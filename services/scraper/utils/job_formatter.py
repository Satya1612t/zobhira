import json
import logging
import re

logger = logging.getLogger(__name__)

_CODE_FENCE_RE = re.compile(r"^```(?:json)?\s*|\s*```$", re.MULTILINE)


def _strip_code_fence(text: str) -> str:
    """Some models wrap JSON in a ```json ... ``` fence despite being told
    not to — same class of prompt-compliance gap already seen and worked
    around for run_smart_scraper's/contest_summarizer's strict-JSON
    output."""
    return _CODE_FENCE_RE.sub("", text).strip()


# Some sources (Himalayas in particular — live-confirmed on a real GDIT
# posting) embed a form's worth of HR/legal field labels with nothing
# actually filled in ("Clearance Level Must Currently Possess:", "Travel
# Required:", etc.) — an artifact of their own site's HTML structure (an
# empty <dd>/value slot next to a label), not real content. A line is
# treated as an empty label only when the NEXT non-blank line is also a
# bare "Label:" line (i.e. this one's value was blank) or it's the very
# last line — a label immediately followed by real prose is left alone,
# since that's a legitimate (if slightly redundant) section header, not
# noise. Deterministic and dependency-free: runs unconditionally, so the
# page has at least this baseline cleanup even when every LLM provider is
# unavailable — matches this session's LLM-billing situation, where the
# richer structuring pass below often can't run at all.
_LABEL_LINE_RE = re.compile(r"^[A-Z][A-Za-z0-9 /&()\-]{1,70}:$")


def strip_empty_label_lines(text: str) -> str:
    non_empty = [ln.strip() for ln in text.splitlines() if ln.strip()]
    keep = [True] * len(non_empty)
    for i, line in enumerate(non_empty):
        if not _LABEL_LINE_RE.match(line):
            continue
        nxt = non_empty[i + 1] if i + 1 < len(non_empty) else None
        if nxt is None or _LABEL_LINE_RE.match(nxt):
            keep[i] = False
    return "\n\n".join(ln for ln, k in zip(non_empty, keep) if k)


# Scraped "Show more"/"Show less"/"See more"/"See less" text is the
# source site's own expand/collapse UI control label bleeding into the
# description content, not real content or a real link — utils/text.py's
# strip_trailing_toggle() already handled this, but only as a single
# trailing suffix on LinkedIn specifically. This is broader: every
# source, and every occurrence (a standalone line, or attached to the end
# of a real sentence), not just the very end of the whole text. Live-
# verified against both shapes before wiring in.
_UI_TOGGLE_WHOLE_LINE_RE = re.compile(r"(?i)^(show more|show less|see more|see less)\.?$")
_UI_TOGGLE_TRAILING_RE = re.compile(r"(?i)\s*(show more|show less|see more|see less)\.?\s*$")


def strip_ui_toggle_text(text: str) -> str:
    lines = []
    for line in text.splitlines():
        stripped = line.strip()
        if not stripped:
            lines.append(line)
            continue
        if _UI_TOGGLE_WHOLE_LINE_RE.match(stripped):
            continue  # the whole line was just toggle chrome — drop it
        lines.append(_UI_TOGGLE_TRAILING_RE.sub("", line))
    return "\n".join(lines)


# Structured shape (replaces the old plain-prose "formatted_description"
# string) — stored JSON-encoded in the same TEXT column, no migration
# needed. Every list is best-effort: a bullet that doesn't clearly belong
# to responsibilities/requirements/niceToHave/benefits goes into "details"
# rather than being forced into the wrong bucket or dropped, since most
# real postings don't cleanly separate into these categories themselves.
_JSON_SHAPE_HINT = (
    '{"overview": "1-2 paragraph summary or null", '
    '"responsibilities": ["...", ...], "requirements": ["...", ...], '
    '"niceToHave": ["...", ...], "benefits": ["...", ...], '
    '"details": ["...", ...], "highlights": ["...", ...]}'
)


def format_job_description(description: str | None, use_llm: bool = True) -> dict:
    """Restructures a raw scraped job description into distinct sections
    (overview / responsibilities / requirements / nice-to-have / benefits /
    details) plus up to 6 short highlight facts — PRESERVES all original
    substantive content (never summarized/shortened, only categorized),
    only omitting boilerplate label lines that had nothing actually filled
    in. Best-effort only: falls back to `{"formatted_description":
    <deterministically cleaned text>, "highlights": []}` if there's
    nothing to format or every LLM provider fails — this is called
    on-demand (one job at a time, on first detail-page view), not in a
    batch pipeline, so a failure here must never break the page, and the
    deterministic cleanup alone is still a real improvement over showing
    the fully raw description.

    use_llm=False skips the LLM call entirely and returns the
    deterministic-cleanup fallback directly — for a caller (e.g.
    feeds/scripts/run_feed.py) that wants guaranteed-fast, guaranteed-non-
    network formatting rather than paying the retry cost of a
    fully-exhausted/billing-blocked provider chain."""
    # llm_used distinguishes "the real structuring pass ran" from "fell back
    # to deterministic cleanup only" — the on-demand caller doesn't care
    # (either result is fine to cache/show), but the scrape-time circuit
    # breaker in format_posting_with_breaker() below needs this to count
    # actual LLM failures, since a fallback result otherwise looks
    # superficially like success (non-None formatted_description).
    empty = {"formatted_description": None, "highlights": [], "llm_used": False}
    if not description or not description.strip():
        return empty

    cleaned = strip_ui_toggle_text(strip_empty_label_lines(description))
    # Fallback if every LLM provider fails below — plain cleaned text,
    # same shape FormattedJobDescription.tsx already renders as prose for
    # any pre-existing (old-format) formatted_description row.
    fallback = {"formatted_description": cleaned or None, "highlights": [], "llm_used": False}
    if not cleaned:
        return empty
    if not use_llm:
        return fallback

    # Lazy import, not module-top — llm_fallback.py reads
    # FREELLMAPI_BASE_URL/FREELLMAPI_API_KEY from os.environ at IMPORT
    # time; importing it at module top here would freeze them to None if
    # this module gets imported before load_dotenv() runs (the exact bug
    # already hit and fixed for contest_summarizer.py).
    from scrapers.llm_fallback import run_text_completion

    prompt = (
        "Restructure this job description into distinct sections. Preserve "
        "ALL of the original substantive information; do not summarize, "
        "shorten, or omit anything real — only reorganize it. Sort each "
        "point into whichever of these it best matches: responsibilities "
        "(what the person will do), requirements (must-have "
        "qualifications), niceToHave (preferred/bonus qualifications), "
        "benefits (perks/compensation extras, not salary itself). If a "
        "point doesn't clearly belong to any of those, put it in "
        "'details' instead of forcing it into the wrong category or "
        "dropping it. 'overview' is a short 1-2 paragraph summary of the "
        "role itself (null if the source has no real overview prose). "
        "Then separately list up to 6 short highlight facts if clearly "
        "present: salary/compensation, required experience level, a key "
        "benefit, a notable requirement. Skip anything not actually "
        "stated — do not invent or guess. Leave any section empty ([]) "
        "if the source has nothing for it.\n\n"
        f"DESCRIPTION:\n{cleaned}\n\n"
        f"Respond with ONLY valid JSON in exactly this shape: {_JSON_SHAPE_HINT}"
    )

    raw = run_text_completion(prompt)
    if not raw:
        return fallback

    try:
        data = json.loads(_strip_code_fence(raw))
    except json.JSONDecodeError:
        logger.warning("Could not parse job formatting JSON: %r", raw[:200])
        return fallback
    if not isinstance(data, dict):
        return fallback

    def _str_list(key: str) -> list[str]:
        value = data.get(key)
        return [str(v) for v in value] if isinstance(value, list) else []

    overview = data.get("overview")
    structured = {
        "overview": overview if isinstance(overview, str) and overview.strip() else None,
        "responsibilities": _str_list("responsibilities"),
        "requirements": _str_list("requirements"),
        "niceToHave": _str_list("niceToHave"),
        "benefits": _str_list("benefits"),
        "details": _str_list("details"),
    }
    # Every section empty and no overview — the model returned nothing
    # useful, same as an LLM failure from the caller's point of view.
    if not structured["overview"] and not any(
        structured[k] for k in ("responsibilities", "requirements", "niceToHave", "benefits", "details")
    ):
        return fallback

    highlights = _str_list("highlights")[:6]
    return {"formatted_description": json.dumps(structured), "highlights": highlights, "llm_used": True}


# Consecutive total-provider failures (every provider in llm_fallback.py's
# chain failed for one posting) tolerated within a single scrape run before
# skipping formatting for the rest of that run — avoids hammering a
# genuinely exhausted quota across hundreds of remaining postings. Reset
# every run (breaker_state is a plain dict passed in by the caller, never
# module-level), so a fresh scrape always gets a fresh chance.
BREAKER_THRESHOLD = 5


def format_posting_with_breaker(posting, breaker_state: dict) -> None:
    """Mutates posting.formatted_description / posting.highlights in place
    for scrape-time formatting (see run_scrape.py's run_source()). No-ops
    once the breaker has tripped or the quota pre-flight check says
    unavailable — posting is then saved with formatted_description left at
    its default (None), same as if formatting were never attempted, so it
    stays a normal candidate for a later backfill sweep.

    breaker_state = {"consecutive_failures": int, "tripped": bool} — local
    to one run_source() call, passed in by the caller, never persisted or
    shared across runs."""
    from utils.quota_checker import check_quota_available

    if breaker_state["tripped"] or not check_quota_available():
        return
    result = format_job_description(posting.description)
    if not result["llm_used"]:
        breaker_state["consecutive_failures"] += 1
        if breaker_state["consecutive_failures"] >= BREAKER_THRESHOLD:
            breaker_state["tripped"] = True
        return
    breaker_state["consecutive_failures"] = 0
    posting.formatted_description = result["formatted_description"]
    posting.highlights = result["highlights"]
