import logging
import re
from calendar import timegm
from datetime import datetime, timezone

import feedparser

from scrapers.contest_base import BaseContestScraper, ContestPosting
from utils.rate_limit import throttle
from utils.text import strip_html

logger = logging.getLogger(__name__)

# Confirmed live (2026-07-21) as a real RSS 2.0 feed. Thin secondary source:
# no structured deadline/prize/organizer at all (that's Devpost's job) —
# this mostly adds discovery breadth from community-posted hackathon
# announcements.
FEED_URL = "https://dev.to/feed/tag/hackathon"

# DEV's "hackathon" tag catches ANY post mentioning hackathons — including
# retrospectives/recaps about events that already happened (e.g. "How We
# Organized the Build with Gemma Hackathon... crowned 3 winning teams"),
# which read exactly like an open contest listing to a naive consumer but
# aren't one — there's nothing left to register for. This is a best-effort
# keyword heuristic, not a real classifier: it will have false negatives
# (recaps that don't use these phrasings) and, in principle, could have
# false positives, but for a thin secondary/discovery-only source that
# trade-off is fine — better to under-include than surface dead listings.
_RECAP_PATTERNS = [
    r"\bhow we (organized|ran|hosted|built|planned)\b",
    r"\bwe (hosted|organized|recently hosted|wrapped up|just wrapped)\b",
    r"\brecap\b",
    r"\bretrospective\b",
    r"\bpostmortem\b",
    r"\bcrowned\b",
    r"\bwinners? (were|have been|got)? ?announced\b",
    r"\bwinning team",
    r"\bwe welcomed\b",
    r"\blessons (we )?learned\b",
    r"\bwrapped up\b",
    r"\b(hackathon|event) (has )?concluded\b",
    r"\blooking back (at|on)\b",
]
_RECAP_RE = re.compile("|".join(_RECAP_PATTERNS), re.IGNORECASE)


def _looks_like_recap(title: str, description: str | None) -> bool:
    return bool(_RECAP_RE.search(f"{title} {description or ''}"))


class DevCommunityScraper(BaseContestScraper):
    source_name = "dev_community"

    def scrape(self) -> list[ContestPosting]:
        throttle(FEED_URL)
        parsed = feedparser.parse(FEED_URL)
        if parsed.bozo:
            logger.warning("DEV Community feed did not parse cleanly: %s", parsed.get("bozo_exception"))

        postings: list[ContestPosting] = []
        for entry in parsed.entries:
            title = entry.get("title")
            link = entry.get("link")
            if not title or not link:
                continue

            description = strip_html(entry.get("summary"))
            if _looks_like_recap(title, description):
                logger.info("Skipping likely recap/retrospective post: %r", title)
                continue

            starts_at = None
            if entry.get("published_parsed"):
                # This is when DEV published the post, not when the actual
                # contest starts — no better signal exists in RSS.
                starts_at = datetime.fromtimestamp(
                    timegm(entry["published_parsed"]), tz=timezone.utc
                )

            postings.append(
                ContestPosting(
                    title=title,
                    platform="dev_community",
                    organizer=None,
                    mode="unknown",
                    prize_amount=None,
                    prize_currency=None,
                    prize_summary=None,
                    source=self.source_name,
                    source_url=link,
                    description=description,
                    tags=["hackathon"],
                    starts_at=starts_at,
                    deadline_at=None,
                    logo_url=None,
                    extraction_method="deterministic",
                    # Not dict(entry) — feedparser's FeedParserDict holds
                    # non-JSON-serializable values (e.g. struct_time for
                    # published_parsed), which would fail at insert time via
                    # psycopg's Json() wrapper. Keep only plain-string fields.
                    raw={
                        "title": title,
                        "link": link,
                        "published": entry.get("published"),
                        "summary": entry.get("summary"),
                    },
                )
            )

        return postings
