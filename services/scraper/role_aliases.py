"""Title-normalization layer for designation_classifier.py.

WHY THIS EXISTS
---------------
classify_title() matches a title against the 58-designation taxonomy by
requiring that EVERY word of a designation appear in the title. With raw
words that fails constantly on real Indian job titles:

  "Full Stack Engineer"     vs "Full Stack Developer"  -> no match
                               (engineer != developer)
  "Senior Software Engineer" -> no match at all
                               ("Software Engineer" was not even in the
                                taxonomy, despite being the single most
                                common title in the market)
  "SDE - 2"                  -> no match (never expanded)
  "Sr. Backend Dev"          -> no match ("dev" != "developer")

Every one of those is a job that ends up with zero designation tags, which
means it is missing from the designation x city landing pages, from the
"related jobs" rail, and from any tag-based browse — while still being
perfectly findable by free-text search, which is why the gap is easy to
miss in testing.

TWO MECHANISMS
--------------
1. TITLE_EXPANSIONS rewrite abbreviations into their full words BEFORE
   tokenizing ("sde" -> "software development engineer").
2. TOKEN_CANONICAL collapses interchangeable words to one representative
   ("engineer"/"programmer"/"dev" -> "developer") on BOTH the title side
   and the designation side, so the subset check compares like with like.

Kept deliberately narrow. Every alias added here widens recall for every
designation at once, so an over-eager entry (e.g. mapping "ui" -> "frontend")
mislabels roles in bulk — "UI Designer" would start matching frontend
developer postings.
"""

from __future__ import annotations

import re

# Applied in order to the lowercased title. Each is (pattern, replacement);
# the replacement is APPENDED to the matched text rather than replacing it
# where both spellings are useful, which is why several read as expansions
# rather than substitutions.
TITLE_EXPANSIONS: list[tuple[re.Pattern[str], str]] = [
    (re.compile(r"\bsdet\b"), "sdet software development engineer test"),
    (re.compile(r"\bsde\b"), "software development engineer"),
    (re.compile(r"\bswe\b"), "software engineer"),
    (re.compile(r"\bsre\b"), "site reliability engineer"),
    (re.compile(r"\bdba\b"), "database administrator"),
    (re.compile(r"\bqa\b"), "qa quality assurance engineer"),
    (re.compile(r"\bsdr\b"), "sales development representative"),
    (re.compile(r"\bui\s*/\s*ux\b"), "ui ux"),
    (re.compile(r"\bux\s*/\s*ui\b"), "ui ux"),
    (re.compile(r"\bai\s*/\s*ml\b"), "ai machine learning"),
    (re.compile(r"\bml\b"), "machine learning"),
    (re.compile(r"\bnlp\b"), "nlp natural language processing"),
    (re.compile(r"\bcv\b(?!\s*(?:screening|shortlist))"), "computer vision"),
    (re.compile(r"\bbi\b"), "bi business intelligence"),
    (re.compile(r"\bfull[\s\-]?stack\b"), "full stack"),
    (re.compile(r"\bfront[\s\-]?end\b"), "frontend"),
    (re.compile(r"\bback[\s\-]?end\b"), "backend"),
    (re.compile(r"\bnode\.?\s*js\b"), "nodejs backend"),
    (re.compile(r"\breact\.?\s*js\b"), "react frontend"),
    (re.compile(r"\bdot\s*net\b|\.net\b"), "dotnet backend"),
    (re.compile(r"\bios\b"), "ios mobile"),
    (re.compile(r"\bandroid\b"), "android mobile"),
    (re.compile(r"\bdevops\b"), "devops"),
    (re.compile(r"\bseo\b"), "seo specialist"),
    (re.compile(r"\bppc\b|\bsem\b"), "sem ppc specialist"),
    (re.compile(r"\bsmm\b"), "social media marketing"),
]

# Interchangeable role nouns collapsed to one representative. Applied to
# both the title tokens and the designation tokens.
#
# NOT included on purpose: "analyst" -> "engineer" (a Data Analyst is a
# genuinely different role from a Data Engineer), "designer" -> "developer",
# "manager" -> "lead".
TOKEN_CANONICAL: dict[str, str] = {
    "engineer": "developer",
    "engineering": "developer",
    "programmer": "developer",
    "dev": "developer",
    "developement": "developer",   # common misspelling in real postings
    "development": "developer",
    "coder": "developer",
    "administrator": "admin",
    "administration": "admin",
    "specialist": "specialist",
    "sr": "senior",
    "jr": "junior",
    "mgr": "manager",
    "arch": "architect",
    "sysadmin": "systems admin",
    "db": "database",
    "ai": "ai",
    "artificial": "ai",
}

# Seniority/modifier noise stripped before matching, so "Senior Backend
# Developer II (Remote, Contract)" reduces to the same token set as
# "Backend Developer".
STOP_TOKENS: frozenset[str] = frozenset({
    "senior", "junior", "lead", "principal", "staff", "associate", "assistant",
    "trainee", "intern", "internship", "fresher", "graduate", "entry", "level",
    "i", "ii", "iii", "iv", "v", "1", "2", "3",
    "remote", "hybrid", "onsite", "contract", "fulltime", "parttime",
    "urgent", "hiring", "immediate", "joiner", "joining", "opening", "openings",
    "and", "or", "the", "for", "with", "at", "in", "of", "a", "an",
})

_WORD_RE = re.compile(r"[a-z0-9+#.]+")


def tokenize(text: str) -> set[str]:
    """Lowercase -> expand abbreviations -> split -> canonicalize -> drop
    noise. Used for BOTH sides of the designation subset check; using
    different tokenizers on the two sides is precisely the bug this
    replaces."""
    if not text:
        return set()
    lowered = text.lower()
    for pattern, expansion in TITLE_EXPANSIONS:
        if pattern.search(lowered):
            lowered = f"{lowered} {expansion}"
    tokens = set()
    for word in _WORD_RE.findall(lowered):
        word = word.strip(".")
        if not word:
            continue
        canonical = TOKEN_CANONICAL.get(word, word)
        for part in canonical.split():
            if part not in STOP_TOKENS:
                tokens.add(part)
    return tokens
