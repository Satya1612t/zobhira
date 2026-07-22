"""Shared LLM extraction helper used by every scraper's `_scrape_with_llm`.

Tries FreeLLMAPI first — a self-hosted, OpenAI-compatible proxy
(https://github.com/tashfeenahmed/freellmapi) that aggregates free-tier
quotas across ~29 LLM providers with its own internal failover, no billing
needed for any of them — then falls through to the direct Gemini,
Anthropic, and OpenAI calls as a secondary tier (only reached if the local
FreeLLMAPI container itself is unreachable; those three are currently all
blocked on billing/credits, see memory, but kept as a no-cost safety net).
A provider with no credentials set in the environment is skipped rather
than attempted. Only raises once every configured provider has failed, so
a single account/service issue no longer takes the LLM fallback path down
entirely."""

import logging
import os

logger = logging.getLogger(__name__)

# scrapegraphai's page loader (ChromiumLoader) defaults to
# `wait_until="domcontentloaded"` with no extra wait — fine for static
# pages, but live-confirmed wrong for sites that populate content via
# client-side JS after the initial DOM load (e.g. remoteok.com's job table
# fetches asynchronously): the loader was capturing the page before a
# single job row existed in the DOM, so the LLM correctly but uselessly
# reported "nothing found" for content that hadn't rendered yet.
# "networkidle" makes Playwright wait until the page's own network
# activity quiets down (a solid proxy for "JS-driven fetches finished")
# before handing off content — same category of fix RemoteOK's
# deterministic scraper already applies via its own explicit
# `page.wait_for_timeout()` calls, just generalized for any LLM-fallback
# target site via scrapegraphai's `loader_kwargs` passthrough (confirmed by
# reading fetch_node.py: graph_config["loader_kwargs"] flows straight into
# `ChromiumLoader(**loader_kwargs)`).
_LOADER_KWARGS = {"load_state": "networkidle"}

# FreeLLMAPI's own model router: "auto" lets it pick whichever configured
# provider/model currently has quota, instead of us hardcoding one upstream
# model id ourselves (confirmed via its README's documented request format).
_FREELLMAPI_BASE_URL = os.environ.get("FREELLMAPI_BASE_URL")  # e.g. http://localhost:3001/v1
_FREELLMAPI_API_KEY = os.environ.get("FREELLMAPI_API_KEY")  # freellmapi-...

# (provider prefix understood by scrapegraphai, model name, env var holding the key)
_PROVIDERS: list[tuple[str, str, str]] = [
    ("google_genai", "gemini-2.0-flash", "GEMINI_API_KEY"),
    ("anthropic", "claude-sonnet-5", "ANTHROPIC_API_KEY"),
    ("openai", "gpt-4o-mini", "OPENAI_API_KEY"),
]


def _freellmapi_graph_config() -> dict | None:
    """scrapegraphai's `openai` provider routes through langchain's
    `init_chat_model` -> `ChatOpenAI`, which accepts `base_url` directly —
    so pointing the `openai/<model>` provider string at FreeLLMAPI's local
    endpoint works with no new dependency (confirmed by reading
    scrapegraphai's abstract_graph.py::_create_llm)."""
    if not _FREELLMAPI_BASE_URL or not _FREELLMAPI_API_KEY:
        return None
    return {
        "llm": {
            "api_key": _FREELLMAPI_API_KEY,
            "model": "openai/auto",
            "base_url": _FREELLMAPI_BASE_URL,
            # scrapegraphai's token registry has no entry for "auto" (it's a
            # FreeLLMAPI-specific router alias, not a real upstream model
            # id), so it silently fell back to an 8192-token budget and
            # aggressively chunked/truncated larger pages — live-confirmed
            # this caused real job listings further down a page (e.g.
            # remoteok.com) to never reach the model at all, producing a
            # confident-sounding but wrong "nothing found" answer instead of
            # an error. 100_000 stays safely under the smallest context
            # window FreeLLMAPI reports for a routable model (131_072 for
            # DeepSeek/Mistral) while still being ~12x more generous than
            # the silent default.
            "model_tokens": 100_000,
        },
        "verbose": False,
        "headless": True,
        "loader_kwargs": _LOADER_KWARGS,
    }


# Every caller (remoteok.py/talentd.py/linkedin.py/ycombinator.py's
# `_scrape_with_llm`) asks for "title, company, ... URL" in free-form
# English and then reads `result.get("jobs", [])` — live-confirmed the
# router-selected model can find the right data (verified against a real
# page: correct titles/companies/salaries/URLs) but still answer in plain
# prose ("Job 1: ... Job 2: ...") instead of the expected JSON shape,
# since the prompt never actually specified one. Enforcing the schema once
# here, instead of in all four scrapers separately, guarantees every
# caller gets the same contract.
_JSON_FORMAT_SUFFIX = (
    "\n\nRespond with ONLY valid JSON in exactly this shape, no other text: "
    '{"jobs": [{"title": "...", "company": "...", "location": "...", '
    '"salary_min": null, "salary_max": null, "salary_currency": null, '
    '"description": "...", "url": "..."}]}. '
    'If nothing matches, respond with {"jobs": []}.'
)


def run_smart_scraper(prompt: str, source: str) -> dict:
    """Runs a SmartScraperGraph extraction against `source` — FreeLLMAPI
    first if configured, then each provider in `_PROVIDERS` in turn, until
    one returns successfully."""
    from scrapegraphai.graphs import SmartScraperGraph

    prompt = prompt + _JSON_FORMAT_SUFFIX
    last_error: Exception | None = None
    tried_any = False

    freellmapi_config = _freellmapi_graph_config()
    if freellmapi_config is None:
        logger.info(
            "Skipping FreeLLMAPI: FREELLMAPI_BASE_URL/FREELLMAPI_API_KEY not both set"
        )
    else:
        tried_any = True
        try:
            graph = SmartScraperGraph(prompt=prompt, source=source, config=freellmapi_config)
            result = graph.run()
            logger.info("LLM extraction succeeded via provider=freellmapi")
            return result
        except Exception as exc:
            logger.warning("LLM extraction via provider=freellmapi failed, trying next: %s", exc)
            last_error = exc

    for provider, model, env_var in _PROVIDERS:
        api_key = os.environ.get(env_var)
        if not api_key:
            logger.info("Skipping LLM provider=%s: %s not set", provider, env_var)
            continue

        tried_any = True
        graph_config = {
            "llm": {"api_key": api_key, "model": f"{provider}/{model}"},
            "verbose": False,
            "headless": True,
            "loader_kwargs": _LOADER_KWARGS,
        }
        try:
            graph = SmartScraperGraph(prompt=prompt, source=source, config=graph_config)
            result = graph.run()
            logger.info("LLM extraction succeeded via provider=%s", provider)
            return result
        except Exception as exc:
            logger.warning("LLM extraction via provider=%s failed, trying next: %s", provider, exc)
            last_error = exc

    if last_error is not None:
        raise last_error
    if not tried_any:
        raise RuntimeError(
            "No LLM provider configured — set FREELLMAPI_BASE_URL + FREELLMAPI_API_KEY, "
            "or GEMINI_API_KEY, ANTHROPIC_API_KEY, or OPENAI_API_KEY"
        )
    raise RuntimeError("All configured LLM providers failed")


def _build_chat_models() -> list[tuple[str, object]]:
    """Same try-order as run_smart_scraper (FreeLLMAPI first, then the
    direct Gemini/Anthropic/OpenAI fallbacks), but returns ready langchain
    chat model instances for plain text-in/text-out calls — no page fetch,
    no scrapegraphai/Playwright involved, since callers here already have
    the text they want processed (e.g. a scraped description) rather than
    a URL to scrape."""
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
    """Plain text completion (no page fetch) — same provider fallback
    order as run_smart_scraper. Returns None (never raises) if every
    configured provider fails or none are configured, so a caller can
    degrade gracefully instead of blocking its own pipeline."""
    for name, model in _build_chat_models():
        try:
            response = model.invoke(prompt)
            logger.info("Text completion succeeded via provider=%s", name)
            return response.content
        except Exception as exc:
            logger.warning("Text completion via provider=%s failed: %s", name, exc)
    return None
