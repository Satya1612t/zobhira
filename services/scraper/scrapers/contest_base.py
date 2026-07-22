from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime


@dataclass
class ContestPosting:
    title: str
    platform: str
    organizer: str | None
    mode: str  # 'online' | 'hybrid' | 'in_person' | 'unknown'
    prize_amount: float | None
    prize_currency: str | None
    prize_summary: str | None
    source: str
    source_url: str
    description: str | None
    tags: list[str] = field(default_factory=list)
    starts_at: datetime | None = None
    deadline_at: datetime | None = None
    logo_url: str | None = None
    extraction_method: str = "deterministic"
    raw: dict = field(default_factory=dict)
    # LLM-rewritten clean summary + short highlight facts, computed
    # best-effort at scrape time (see utils/contest_summarizer.py) —
    # never required, always safe to leave at their defaults.
    summary: str | None = None
    highlights: list[str] = field(default_factory=list)


class BaseContestScraper(ABC):
    source_name: str

    @abstractmethod
    def scrape(self) -> list[ContestPosting]:
        """Fetch the current listing of contests for this source. Unlike
        BaseJobScraper, there's no query/location split or detail_limit —
        every source here is a public RSS/JSON feed of "what's currently
        open," fetched whole in one call, not searched or enriched
        per-item."""
        raise NotImplementedError
