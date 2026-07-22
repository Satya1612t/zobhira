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


def format_job_description(description: str | None) -> dict:
    """Reformats a raw scraped job description into clean, well-structured
    text — PRESERVES all original content (never summarized/shortened,
    only restructured for readability) — plus up to 6 short highlight
    facts (salary/compensation, required experience, key benefits, notable
    requirements) pulled out of the text, only when actually present.
    Best-effort only: returns `{"formatted_description": None,
    "highlights": []}` if there's nothing to format or every LLM provider
    fails — this is called on-demand (one job at a time, on first detail-
    page view), not in a batch pipeline, so a failure here must never
    break the page, just leave it showing the raw description."""
    empty = {"formatted_description": None, "highlights": []}
    if not description or not description.strip():
        return empty

    # Lazy import, not module-top — llm_fallback.py reads
    # FREELLMAPI_BASE_URL/FREELLMAPI_API_KEY from os.environ at IMPORT
    # time; importing it at module top here would freeze them to None if
    # this module gets imported before load_dotenv() runs (the exact bug
    # already hit and fixed for contest_summarizer.py).
    from scrapers.llm_fallback import run_text_completion

    prompt = (
        "Reformat this job description into clean, well-structured text — "
        "proper paragraphs and bullet points where the content calls for "
        "it. Preserve ALL of the original information; do not summarize, "
        "shorten, or omit anything. Plain text only — no markdown syntax "
        "like ** or # or *, since this renders as plain text, not "
        "markdown; use a plain dash (-) for bullets and blank lines "
        "between paragraphs/sections instead. Then separately list up to "
        "6 short highlight facts if clearly present: salary/compensation, "
        "required experience level, key benefits, notable requirements. "
        "Skip anything not actually stated — do not invent or guess.\n\n"
        f"DESCRIPTION:\n{description}\n\n"
        'Respond with ONLY valid JSON: {"formatted_description": "...", "highlights": ["...", ...]}.'
    )

    raw = run_text_completion(prompt)
    if not raw:
        return empty

    try:
        data = json.loads(_strip_code_fence(raw))
    except json.JSONDecodeError:
        logger.warning("Could not parse job formatting JSON: %r", raw[:200])
        return empty
    if not isinstance(data, dict):
        return empty

    highlights = data.get("highlights", [])
    if not isinstance(highlights, list):
        highlights = []

    formatted = data.get("formatted_description")
    if not isinstance(formatted, str) or not formatted.strip():
        formatted = None

    return {
        "formatted_description": formatted,
        "highlights": [str(h) for h in highlights[:6]],
    }
