"""Shared LLM text-completion helper.

Tries FreeLLMAPI first — a self-hosted, OpenAI-compatible proxy
(https://github.com/tashfeenahmed/freellmapi) that aggregates free-tier
quotas across ~29 LLM providers with its own internal failover, no billing
needed for any of them — then falls through to the direct Gemini, Anthropic,
and OpenAI calls as a secondary tier (only reached if the local FreeLLMAPI
container itself is unreachable; those three are currently all blocked on
billing/credits, see memory, but kept as a no-cost safety net). A provider
with no credentials set in the environment is skipped rather than attempted.
Never raises — returns None once every configured provider has failed.

HISTORY: this module also used to expose `run_smart_scraper`, a
ScrapeGraphAI/Playwright page-extraction path used only by the browser-driven
scrapers (LinkedIn/Talentd/YCombinator). All three were retired (the plan's
§9) and Playwright/scrapegraphai dropped from the image, so that function and
its Chromium plumbing are gone; only the plain text-in/text-out path remains
(used by utils/job_formatter.py, utils/ai_extract.py, utils/contest_summarizer.py).
"""

import logging
import os

logger = logging.getLogger(__name__)

_FREELLMAPI_BASE_URL = os.environ.get("FREELLMAPI_BASE_URL")  # e.g. http://localhost:3001/v1
_FREELLMAPI_API_KEY = os.environ.get("FREELLMAPI_API_KEY")  # freellmapi-...

# (provider prefix understood by langchain, model name, env var holding the key)
_PROVIDERS: list[tuple[str, str, str]] = [
    ("google_genai", "gemini-2.0-flash", "GEMINI_API_KEY"),
    ("anthropic", "claude-sonnet-5", "ANTHROPIC_API_KEY"),
    ("openai", "gpt-4o-mini", "OPENAI_API_KEY"),
]


def _build_chat_models() -> list[tuple[str, object]]:
    """FreeLLMAPI first, then the direct Gemini/Anthropic/OpenAI fallbacks —
    returns ready langchain chat model instances for plain text-in/text-out
    calls. No page fetch, no browser: callers already have the text they want
    processed (e.g. a scraped description), not a URL to scrape."""
    from langchain.chat_models import init_chat_model

    models: list[tuple[str, object]] = []
    if _FREELLMAPI_BASE_URL and _FREELLMAPI_API_KEY:
        models.append((
            "freellmapi",
            init_chat_model(
                model="auto",
                model_provider="openai",
                api_key=_FREELLMAPI_API_KEY,
                base_url=_FREELLMAPI_BASE_URL,
            ),
        ))
    for provider, model, env_var in _PROVIDERS:
        api_key = os.environ.get(env_var)
        if not api_key:
            continue
        models.append((provider, init_chat_model(model=model, model_provider=provider, api_key=api_key)))
    return models


def run_text_completion(prompt: str) -> str | None:
    """Plain text completion (no page fetch). Returns None (never raises) if
    every configured provider fails or none are configured, so a caller can
    degrade gracefully instead of blocking its own pipeline."""
    for name, model in _build_chat_models():
        try:
            response = model.invoke(prompt)
            logger.info("Text completion succeeded via provider=%s", name)
            return response.content
        except Exception as exc:
            logger.warning("Text completion via provider=%s failed: %s", name, exc)
    return None
