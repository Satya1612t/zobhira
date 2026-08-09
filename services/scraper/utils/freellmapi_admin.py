"""Reads the self-hosted FreeLLMAPI router's own admin dashboard API so the
Zobhira admin can surface which of its ~29 aggregated free LLM providers are
healthy / rate-limited and how much has been used.

FreeLLMAPI has TWO auth realms: the inference API key (FREELLMAPI_API_KEY,
used for /v1/chat/completions) and a SEPARATE dashboard login (email +
password) that gates the /api/* management/analytics endpoints. This module
uses the latter — set FREELLMAPI_ADMIN_EMAIL + FREELLMAPI_ADMIN_PASSWORD in
the scraper env. Missing either -> returns {"configured": False} so the UI
shows a "not configured" state instead of erroring.

Auth flow (reverse-engineered from the dashboard's own JS):
  POST {base}/api/auth/login  {email, password}  -> {token}
  then send `Authorization: Bearer {token}` on /api/analytics/* and /api/keys.
Token is cached in-process and re-fetched on a 401 (expiry/restart).

Never raises: on any failure returns {"configured": True, "error": "..."} so
a router hiccup can't take the admin page down.
"""

from __future__ import annotations

import logging
import os
import threading

import httpx

logger = logging.getLogger(__name__)

_token: str | None = None
_token_lock = threading.Lock()


def _admin_base() -> str | None:
    """FreeLLMAPI's origin (no /v1) — derived from FREELLMAPI_BASE_URL, e.g.
    'http://freellmapi:3001/v1' -> 'http://freellmapi:3001'."""
    base = os.environ.get("FREELLMAPI_BASE_URL")
    if not base:
        return None
    return base.rstrip("/").removesuffix("/v1").rstrip("/")


def _login(client: httpx.Client, base: str, email: str, password: str) -> str | None:
    resp = client.post(f"{base}/api/auth/login", json={"email": email, "password": password})
    resp.raise_for_status()
    return (resp.json() or {}).get("token")


def _get(client: httpx.Client, base: str, path: str, token: str) -> object:
    resp = client.get(f"{base}{path}", headers={"Authorization": f"Bearer {token}"})
    resp.raise_for_status()
    return resp.json()


def fetch_llm_status() -> dict:
    """Returns a dict the admin LLM page renders:
      {"configured": bool, "error"?: str, "summary"?: ..., "byPlatform"?: ...,
       "keys"?: ...} — the three payloads are passed through fairly raw (the
    dashboard's own shapes) so the UI can render defensively without this
    module having to track every FreeLLMAPI schema change."""
    global _token
    base = _admin_base()
    email = os.environ.get("FREELLMAPI_ADMIN_EMAIL")
    password = os.environ.get("FREELLMAPI_ADMIN_PASSWORD")
    if not base or not email or not password:
        return {"configured": False}

    try:
        with httpx.Client(timeout=15.0) as client:
            with _token_lock:
                if not _token:
                    _token = _login(client, base, email, password)
            token = _token
            if not token:
                return {"configured": True, "error": "Login returned no token."}

            def fetch_all(tok: str) -> dict:
                return {
                    "configured": True,
                    "summary": _get(client, base, "/api/analytics/summary?range=30d", tok),
                    "byPlatform": _get(client, base, "/api/analytics/by-platform?range=30d", tok),
                    "keys": _get(client, base, "/api/keys", tok),
                }

            try:
                return fetch_all(token)
            except httpx.HTTPStatusError as exc:
                if exc.response.status_code != 401:
                    raise
                # Session expired — re-login once and retry.
                with _token_lock:
                    _token = _login(client, base, email, password)
                if not _token:
                    return {"configured": True, "error": "Re-login returned no token."}
                return fetch_all(_token)
    except Exception as exc:  # noqa: BLE001 — must never break the admin page
        logger.warning("freellmapi admin fetch failed: %s", exc)
        return {"configured": True, "error": f"Could not reach the FreeLLMAPI router: {exc}"}
