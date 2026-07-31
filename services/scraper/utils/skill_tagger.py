"""Extracts canonical skill tags from a posting's title + description, and
builds the normalized tag array the search index uses.

Runs at ingest for EVERY posting, on every source. This closes the biggest
recall hole in tag search: LinkedIn (the highest-volume source) contributed
zero skill tags, because the only tech-keyword extractor in the codebase
(extractTechnologies in apps/web/src/lib/jobInsights.ts) ran at render time
in Next.js and was never persisted. A LinkedIn posting mentioning React in
every other sentence was invisible to the Skills filter unless "React"
happened to be in its title.

Only emits terms from the live vocabulary (the `skills`/`skill_aliases`
tables — see utils/skill_vocab.py). Free-text skill extraction is what
produced the "React.js" / "ReactJS" / "React Framework" variant mess that no
user query matches. The vocabulary grows via scripts/mine_skills.py, not by
loosening this.
"""

from __future__ import annotations

from utils.skill_vocab import canonicalize, get_vocabulary, normalize

# Title matches are worth more than description matches — a skill in the
# title is what the role IS; one in the description may be a nice-to-have
# buried in a list of twenty. Title hits are emitted first so the cap keeps
# the most meaningful ones.
DEFAULT_LIMIT = 25

# Long JDs append the company's whole tech-stack boilerplate. Only the first
# N characters are scanned, so a 12,000-character page cannot tag a frontend
# role with Hadoop and Cassandra.
_SCAN_CHARS = 6000


def extract_skills(title: str | None, description: str | None, limit: int = DEFAULT_LIMIT) -> list[str]:
    """Returns canonical skill names, title matches first, de-duplicated and
    order-stable. Safe on None for both arguments."""
    vocab = get_vocabulary()
    haystack = f"{title or ''}\n{(description or '')[:_SCAN_CHARS]}".lower()

    found: list[str] = []
    seen: set[str] = set()

    for text in (title or "", (description or "")[:_SCAN_CHARS]):
        if not text.strip():
            continue
        for canonical, pattern in vocab.matchers:
            if canonical in seen:
                continue
            if not pattern.search(text):
                continue
            # Context-gated skills need a corroborating term somewhere in the
            # posting. "Swift" is a major mobile skill, but "swift
            # resolution" is ordinary corporate filler — requiring
            # iOS/Xcode/SwiftUI nearby keeps the skill usable without the
            # false positives that would otherwise force it onto the
            # never-match list entirely.
            required = vocab.context_required.get(canonical)
            if required and not any(term in haystack for term in required):
                continue
            seen.add(canonical)
            found.append(canonical)
            if len(found) >= limit:
                return found
    return found


def build_tags_norm(tags: list[str]) -> list[str]:
    """Builds the tags_norm array backing the GIN index.

    Emits up to two keys per tag — the raw normalized form AND the canonical
    one — because source-provided tags carry real signal that is not in our
    vocabulary (Himalayas categories, Talentd skill strings, the designation
    names). Dropping unknowns would make the Skills filter WORSE than today
    for those sources, so unknowns are kept, just normalized.

    Both the writer and the reader must go through skill_vocab.normalize().
    A user typing "node js" normalizes to "nodejs"; the canonical "Node.js"
    normalizes to "nodejs"; they meet. That symmetry is the entire fix for
    the casing bugs in the old `t ILIKE ANY(...)` and `tags: { hasSome }`
    paths.
    """
    out: list[str] = []
    seen: set[str] = set()
    for tag in tags:
        if not tag or not tag.strip():
            continue
        for key in filter(None, (normalize(tag), _canonical_key(tag))):
            if key not in seen:
                seen.add(key)
                out.append(key)
    return out


def _canonical_key(tag: str) -> str | None:
    canonical = canonicalize(tag)
    return normalize(canonical) if canonical else None


def expand_query_terms(raw: str) -> list[str]:
    """Turns comma-separated Skills input into normalized keys to match
    against tags_norm. Mirrored in apps/web/src/lib/skillVocab.ts."""
    keys: list[str] = []
    seen: set[str] = set()
    for term in raw.split(","):
        term = term.strip()
        if not term:
            continue
        for key in filter(None, (normalize(term), _canonical_key(term))):
            if key not in seen:
                seen.add(key)
                keys.append(key)
    return keys
