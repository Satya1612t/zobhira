from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime


class SelectorNotFoundError(Exception):
    """Raised by a deterministic scraper when an expected element/selector
    is missing, signalling that the caller should fall back to the
    LLM-driven extraction path."""


@dataclass
class JobPosting:
    title: str
    company: str
    location: str | None
    workplace_type: str  # 'remote' | 'hybrid' | 'onsite' | 'unknown'
    salary_min: float | None
    salary_max: float | None
    salary_currency: str | None
    source: str
    source_url: str
    description: str | None
    tags: list[str] = field(default_factory=list)
    posted_at: datetime | None = None
    deadline_at: datetime | None = None
    logo_url: str | None = None
    extraction_method: str = "deterministic"
    raw: dict = field(default_factory=dict)


class BaseJobScraper(ABC):
    source_name: str

    @abstractmethod
    def scrape(
        self, query: str, location: str | None = None, detail_limit: int | None = None
    ) -> list[JobPosting]:
        """Scrape job postings matching query/location for this source.

        detail_limit: if set, only the first N postings get the (slow,
        per-job) detail-page enrichment pass (description/logo/date);
        the rest stay list-only. Used by live search to bound wall-clock
        time on high-volume sources like LinkedIn. None means no cap —
        the default for CLI/scheduler runs."""
        raise NotImplementedError

    @abstractmethod
    def scrape_list(self, query: str, location: str | None = None) -> list[JobPosting]:
        """Fast path: builds the list of postings (title/company/location/
        source_url/...) without the slow per-job detail-page pass. Live
        search calls this directly so a small batch can be upserted and
        enriched (via `enrich()`) without doing the full detail pass up
        front. `scrape()` composes `scrape_list()` + `enrich()` for the
        CLI/scheduler path, where the full result set is wanted at once."""
        raise NotImplementedError

    @abstractmethod
    def enrich(self, postings: list[JobPosting], detail_limit: int | None = None) -> None:
        """Runs the slow per-job detail-page pass over already-built
        postings from `scrape_list()`, mutating them in place. `detail_limit`
        caps how many of `postings` (from the start) get enriched; the rest
        are left as-is. A no-op for sources with nothing left to fetch after
        `scrape_list()` (e.g. RemoteOK)."""
        raise NotImplementedError
