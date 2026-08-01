def check_quota_available() -> bool:
    """Pre-flight hook for scrape-time LLM formatting (job_formatter.py's
    format_posting_with_breaker). Stub — always True until a real FreeLLMAPI
    quota-status endpoint exists; swap this body for an HTTP GET against it
    once that's available. Deliberately fails open (True) rather than closed:
    an unreachable/unknown quota status shouldn't block formatting on its
    own — the reactive circuit breaker in job_formatter.py already handles
    genuine exhaustion once calls actually start failing."""
    return True
