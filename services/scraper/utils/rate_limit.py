import random
import time
from collections import defaultdict
from urllib.parse import urlparse

_last_request_at: dict[str, float] = defaultdict(float)


def throttle(url: str, min_delay: float = 1.5, max_delay: float = 3.0) -> None:
    """Sleep as needed to enforce a randomized minimum delay between
    requests to the same domain."""
    domain = urlparse(url).netloc
    elapsed = time.monotonic() - _last_request_at[domain]
    wait = random.uniform(min_delay, max_delay)
    if elapsed < wait:
        time.sleep(wait - elapsed)
    _last_request_at[domain] = time.monotonic()
