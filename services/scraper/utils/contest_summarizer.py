import json
import logging
import re

logger = logging.getLogger(__name__)

_CODE_FENCE_RE = re.compile(r"^```(?:json)?\s*|\s*```$", re.MULTILINE)

_VALID_MODES = {"online", "hybrid", "in_person"}


def _strip_code_fence(text: str) -> str:
    """Some models wrap JSON in a ```json ... ``` fence despite being told
    not to — same class of prompt-compliance gap already seen and worked
    around for run_smart_scraper's strict-JSON output."""
    return _CODE_FENCE_RE.sub("", text).strip()


def summarize_contest(description: str | None, *, known_starts_at: str | None = None) -> dict:
    """Rewrites a raw, messy scraped contest description into a clean
    summary + highlights, and also pulls out structured facts (deadline,
    mode, prize) the source feed didn't provide but the prose actually
    states — e.g. DEV Community's RSS has no structured deadline/prize/mode
    field at all, yet posts routinely say "submissions close July 20" or
    "fully remote hackathon" in plain text. All best-effort: returns
    `{"summary": None, "highlights": [], "deadline": None, "mode": None,
    "prize_summary": None}` if there's nothing to summarize or every LLM
    provider fails — callers must never let this block the scrape/upsert
    pipeline, same as the logo-lookup backfill in run_scrape.py. Callers
    must also treat every field here as a GAP-FILL only, never overriding
    real structured data the feed already provided (see run_contest_scrape.py)."""
    empty = {"summary": None, "highlights": [], "deadline": None, "mode": None, "prize_summary": None}
    if not description or not description.strip():
        return empty

    # Lazy import, not module-top — matches the exact convention every
    # existing scraper's _scrape_with_llm already follows (remoteok.py,
    # linkedin.py, talentd.py, ycombinator.py). llm_fallback.py reads
    # FREELLMAPI_BASE_URL/FREELLMAPI_API_KEY from os.environ at IMPORT
    # time; importing it at module top here meant it got evaluated (and
    # frozen to None) before main()'s load_dotenv() call ever ran, since
    # Python resolves all of a module's top-level imports before executing
    # its body — live-confirmed this exact bug: a real scrape run skipped
    # FreeLLMAPI entirely and burned ~40s retrying the billing-blocked
    # direct providers instead.
    from scrapers.llm_fallback import run_text_completion

    anchor_hint = (
        f" Today's reference date for resolving a bare month/day like \"July 20\" into a "
        f"full year is around {known_starts_at}." if known_starts_at else ""
    )
    prompt = (
        "Rewrite this hackathon/contest description as a clean 2-3 sentence "
        "summary, then list up to 6 short highlight facts (deadline, prize, "
        "eligibility, team size, tech focus, mode — only ones actually "
        "present, skip ones not mentioned). Also separately extract, if and "
        "only if clearly stated in the text: the submission deadline as an "
        "ISO date (YYYY-MM-DD), the mode (one of online/hybrid/in_person), "
        "and a short prize summary. Do not invent or guess any of these — "
        f"use null for anything not clearly stated.{anchor_hint}\n\n"
        f"DESCRIPTION:\n{description}\n\n"
        'Respond with ONLY valid JSON: {"summary": "...", "highlights": ["...", ...], '
        '"deadline": "YYYY-MM-DD" or null, "mode": "online"|"hybrid"|"in_person" or null, '
        '"prize_summary": "..." or null}.'
    )

    raw = run_text_completion(prompt)
    if not raw:
        return empty

    try:
        data = json.loads(_strip_code_fence(raw))
    except json.JSONDecodeError:
        logger.warning("Could not parse contest summary JSON: %r", raw[:200])
        return empty
    if not isinstance(data, dict):
        return empty

    highlights = data.get("highlights", [])
    if not isinstance(highlights, list):
        highlights = []

    mode = data.get("mode")
    if mode not in _VALID_MODES:
        mode = None

    deadline = data.get("deadline")
    if not isinstance(deadline, str) or not deadline.strip():
        deadline = None

    prize_summary = data.get("prize_summary")
    if not isinstance(prize_summary, str) or not prize_summary.strip():
        prize_summary = None

    return {
        "summary": data.get("summary"),
        "highlights": [str(h) for h in highlights[:6]],
        "deadline": deadline,
        "mode": mode,
        "prize_summary": prize_summary,
    }
