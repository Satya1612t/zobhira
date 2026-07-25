import random
import threading
import time
from collections import defaultdict
from urllib.parse import urlparse

_last_request_at: dict[str, float] = defaultdict(float)

# run_concurrently (see utils/browser.py) calls throttle() from up to
# CONCURRENT_ENRICH_WORKERS (4) threads at once, often for the same domain's
# detail pages. Without a lock, all four read the same _last_request_at,
# compute the same wait, sleep the same amount, and fire simultaneously —
# the politeness layer silently doing nothing at the exact moment
# concurrency made it matter most. Held across the read, sleep, and write
# (not just the dict update) so same-domain requests genuinely serialize at
# the interval instead of just racing on the bookkeeping around it.
_lock = threading.Lock()


def throttle(url: str, min_delay: float = 1.5, max_delay: float = 3.0) -> None:
    """Sleep as needed to enforce a randomized minimum delay between
    requests to the same domain. Thread-safe — see _lock above."""
    domain = urlparse(url).netloc
    with _lock:
        elapsed = time.monotonic() - _last_request_at[domain]
        wait = random.uniform(min_delay, max_delay)
        if elapsed < wait:
            time.sleep(wait - elapsed)
        _last_request_at[domain] = time.monotonic()
