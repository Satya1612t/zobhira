"""Grows the skill vocabulary from your own data instead of a hand-edited list.

    # weekly: find candidates, auto-promote the safe ones
    python -m scripts.mine_skills --scan 5000

    # see what is waiting for review without changing anything
    python -m scripts.mine_skills --report

    # promote / reject by hand
    python -m scripts.mine_skills --promote "solidity" --reject "immediate joining"

TWO SOURCES, TWO MEANINGS
-------------------------
1. JOB DESCRIPTIONS — what employers are asking for. High volume, high noise.
2. USER SKILL SEARCHES THAT RETURNED NOTHING — what candidates are looking
   for. Low volume, very high signal.

Source 2 splits further, and conflating the halves is the mistake to avoid:

  * searched AND present in descriptions -> a genuine vocabulary gap. The jobs
    exist, we just could not tag them. Promote immediately.
  * searched AND absent from every description -> NOT a vocabulary gap. It is
    unmet demand: users want a skill you have no inventory for. Adding it to
    the vocabulary changes nothing at all, because nothing will ever match it.
    What it should do is feed scraper query planning
    (taxonomy.STREAM_QUERIES). This script reports those separately rather
    than promoting them.

WHY MINING RAW TEXT DOES NOT WORK
----------------------------------
Counting capitalised tokens across whole descriptions returns, in order:
"Job", "Description", "Bangalore", "Responsibilities", "Immediate", "Joiner",
"Bachelor". Frequency alone cannot tell a skill from boilerplate.

Three filters fix it, and all three are necessary:

  a) CONTEXT WINDOWS. Only scan text following a skill-introducing phrase
     ("proficiency in", "experience with", "tech stack:", "skills:"). This
     alone removes most of the noise, because boilerplate does not follow
     those phrases.
  b) DISTINCT COMPANY COUNT, not document count. A term appearing 400 times
     across 3 companies is one employer's footer. A term appearing 40 times
     across 30 companies is a real skill. Any threshold on raw frequency
     promotes boilerplate.
  c) A BLOCKLIST for the categories that survive (a) and (b) anyway —
     locations, degrees, and generic soft skills. See migration 0020.

SCOPE GUARD: this adds SKILLS only. Not designations (designation_classifier
owns those), not employment types, not locations, not degrees. If a candidate
is not a technology, tool, platform, framework, or a specific technical
practice, it does not belong here.
"""

from __future__ import annotations

import argparse
import logging
import re
import sys
from collections import defaultdict
from difflib import SequenceMatcher

from dotenv import load_dotenv

sys.path.insert(0, ".")

from db.repository import connect  # noqa: E402
from utils.skill_vocab import normalize  # noqa: E402

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s: %(message)s")
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Promotion thresholds
# ---------------------------------------------------------------------------
# Aliases are cheap to get wrong (a bad alias points an existing skill at one
# more spelling) and expensive to miss, so they auto-promote readily.
# New canonical skills are the opposite — a bad one becomes a filter facet
# that mis-tags jobs forever — so they need real corroboration.
ALIAS_SIMILARITY = 0.88
ALIAS_MIN_DOCS = 3

NEW_SKILL_MIN_DOCS = 25
NEW_SKILL_MIN_COMPANIES = 10

# A user searching for something IS corroboration. If the term also exists in
# descriptions, one search plus a much lower document bar is enough.
QUERY_BACKED_MIN_DOCS = 3
QUERY_BACKED_MIN_SEARCHES = 2

# ---------------------------------------------------------------------------
# Context extraction
# ---------------------------------------------------------------------------
_SKILL_CONTEXT_RE = re.compile(
    r"(?:"
    r"(?:technical\s+)?skills?\s*(?:required)?\s*[:\-–]"
    r"|tech(?:nical)?\s+stack\s*[:\-–]"
    r"|technologies\s*[:\-–]"
    r"|tools?\s*(?:&|and)?\s*technologies\s*[:\-–]"
    r"|proficien(?:t|cy)\s+(?:in|with)"
    r"|experien(?:ce|ced)\s+(?:in|with|using)"
    r"|hands[\s-]?on\s+(?:experience\s+)?(?:in|with)"
    r"|(?:strong|good|working|sound)\s+(?:knowledge|understanding)\s+(?:of|in)"
    r"|familiar(?:ity)?\s+with"
    r"|expertise\s+in"
    r"|exposure\s+to"
    r"|must\s+have\s*[:\-–]?"
    r"|worked\s+(?:on|with)"
    r")",
    re.I,
)

# How much text after the trigger counts as "the skills bit".
_CONTEXT_WINDOW = 260

# Fragments are split on list punctuation. "and"/"or" are included because
# postings write "React and Node and Express" as often as they use commas.
_SPLIT_RE = re.compile(r"[,;/|•\n\t]|\s+(?:and|or)\s+|\s{3,}", re.I)

# Leading/trailing filler that clings to a fragment: "strong React", "React
# etc", "React (mandatory)".
_TRIM_RE = re.compile(
    r"^(?:strong|good|basic|sound|solid|excellent|very|working|prior|relevant|"
    r"any|the|a|an|in|with|of|on|using|knowledge|understanding|experience)\s+"
    r"|\s+(?:etc\.?|is\s+a\s+plus|preferred|mandatory|required|must|desirable)$",
    re.I,
)
# Trailing nouns that turn a blocked term into an unblocked one. Without this,
# "B.Tech degree" normalizes to "btechdegree" and sails straight past the
# "btech" blocklist entry; same for "communication skills" vs "communication".
_TRAIL_NOUN_RE = re.compile(r"\s+(?:degree|skills?|knowledge|expertise|certification)$", re.I)
_PAREN_RE = re.compile(r"\([^)]*\)")

# A fragment must look like a skill name, not a sentence. Skills are short,
# have no verbs-in-clauses, and contain at least one letter.
_MAX_WORDS = 3
_MIN_CHARS = 2
_MAX_CHARS = 30
_HAS_LETTER_RE = re.compile(r"[a-z]", re.I)
_SENTENCE_TELL_RE = re.compile(
    r"\b(?:you|we|our|your|will|should|must|can|are|is|have|has|the\s+role|"
    r"candidate|applicant|able\s+to|responsible)\b",
    re.I,
)

# The trigger phrases themselves leak in as fragments: clipping one window at
# the next trigger's start leaves a remainder like "strong " or "Proficiency".
# These words are never skills in any context, so reject them outright rather
# than relying on the DB blocklist to catch each one.
_NEVER_SKILL = {
    "strong", "good", "basic", "sound", "solid", "excellent", "working",
    "experience", "experienced", "proficiency", "proficient", "handson",
    "hands-on", "familiarity", "familiar", "knowledge", "understanding",
    "expertise", "exposure", "skills", "skill", "must", "have", "plus",
    "preferred", "mandatory", "required", "etc", "tools", "technologies",
    "stack", "others", "similar", "related", "various", "any", "other",
}


def _clean_fragment(fragment: str) -> str | None:
    text = _PAREN_RE.sub("", fragment).strip(" .:-–—*·\t•")
    for _ in range(3):  # filler can stack: "strong working knowledge of X"
        trimmed = _TRAIL_NOUN_RE.sub("", _TRIM_RE.sub("", text)).strip()
        if trimmed == text:
            break
        text = trimmed
    if not text:
        return None
    if len(text) < _MIN_CHARS or len(text) > _MAX_CHARS:
        return None
    if len(text.split()) > _MAX_WORDS:
        return None
    if not _HAS_LETTER_RE.search(text):
        return None
    if _SENTENCE_TELL_RE.search(text):
        return None
    if text.isdigit():
        return None
    if text.strip().lower() in _NEVER_SKILL:
        return None
    return text


def extract_candidates(description: str) -> list[str]:
    """Pulls skill-shaped fragments out of the skills-context regions only.

    Pure function, no I/O — so the precision of this step can be measured on a
    sample of real descriptions before any of it reaches the database. Do that
    before raising any threshold: this function's precision is what determines
    whether the vocabulary stays clean.
    """
    triggers = list(_SKILL_CONTEXT_RE.finditer(description))
    found: list[str] = []
    seen: set[str] = set()

    for index, match in enumerate(triggers):
        start = match.end()
        # Clip at the NEXT trigger, not at a fixed offset. Fixed windows
        # overlap the following skills line, so the same terms get harvested
        # three or four times and the trigger phrase itself ("familiarity
        # with CCNA") shows up as a candidate.
        hard_end = triggers[index + 1].start() if index + 1 < len(triggers) else len(description)
        end = min(start + _CONTEXT_WINDOW, hard_end)
        # Extend to the next word boundary so the window cannot cut a term in
        # half — a truncated "B.Tech degr" is a candidate that matches nothing
        # and can never be blocklisted.
        if end < len(description):
            boundary = description.find(" ", end)
            end = boundary if 0 <= boundary <= end + 20 else end
        window = description[start:end]
        # Stop at the first sentence end — past that we are back in prose.
        window = re.split(r"(?<=[a-z])\.\s+[A-Z]", window)[0]

        for fragment in _SPLIT_RE.split(window):
            cleaned = _clean_fragment(fragment)
            if not cleaned:
                continue
            key = normalize(cleaned)
            if key in seen:
                continue
            seen.add(key)
            found.append(cleaned)
    return found


# ---------------------------------------------------------------------------
# Vocabulary lookups
# ---------------------------------------------------------------------------

def _load_known(conn) -> tuple[dict[str, str], set[str], set[str]]:
    """Returns (normalized -> canonical, blocked normalized, all canonicals)."""
    known: dict[str, str] = {}
    with conn.cursor() as cur:
        cur.execute("SELECT canonical, normalized FROM skills WHERE status = 'active'")
        for row in cur.fetchall():
            known[row["normalized"]] = row["canonical"]
        cur.execute("SELECT normalized, canonical FROM skill_aliases")
        for row in cur.fetchall():
            known[row["normalized"]] = row["canonical"]
        cur.execute("SELECT normalized FROM skill_blocklist")
        blocked = {row["normalized"] for row in cur.fetchall()}
        cur.execute("SELECT normalized FROM skills WHERE status = 'blocked'")
        blocked |= {row["normalized"] for row in cur.fetchall()}
        cur.execute("SELECT canonical FROM skills WHERE status = 'active'")
        canonicals = {row["canonical"] for row in cur.fetchall()}
    return known, blocked, canonicals


def _best_alias_match(term: str, canonicals: set[str]) -> tuple[str | None, float]:
    """Finds the closest existing canonical, so a new spelling becomes an
    ALIAS rather than a duplicate canonical entry. Comparison is on the
    normalized forms, so "react js" vs "React" scores on "reactjs" vs
    "react" — which is exactly the family of near-misses worth catching."""
    target = normalize(term)
    best, best_score = None, 0.0
    for canonical in canonicals:
        score = SequenceMatcher(None, target, normalize(canonical)).ratio()
        if score > best_score:
            best, best_score = canonical, score
    return best, best_score


# ---------------------------------------------------------------------------
# Mining
# ---------------------------------------------------------------------------

def mine(conn, scan_limit: int) -> None:
    known, blocked, canonicals = _load_known(conn)
    logger.info("Vocabulary: %d known spellings, %d canonical, %d blocked",
                len(known), len(canonicals), len(blocked))

    with conn.cursor() as cur:
        cur.execute(
            "SELECT company, description FROM jobs "
            "WHERE is_active = true AND description IS NOT NULL "
            "ORDER BY first_seen_at DESC LIMIT %(limit)s",
            {"limit": scan_limit},
        )
        rows = cur.fetchall()

    docs: dict[str, int] = defaultdict(int)
    companies: dict[str, set[str]] = defaultdict(set)
    display: dict[str, str] = {}
    samples: dict[str, list[str]] = defaultdict(list)

    for row in rows:
        seen_in_doc: set[str] = set()
        for term in extract_candidates(row["description"]):
            key = normalize(term)
            if not key or key in known or key in blocked:
                continue
            if key in seen_in_doc:
                continue
            seen_in_doc.add(key)
            docs[key] += 1
            companies[key].add((row["company"] or "").lower())
            display.setdefault(key, term)
            if len(samples[key]) < 3:
                samples[key].append(term)

    logger.info("Scanned %d descriptions, found %d distinct unknown terms", len(rows), len(docs))

    # Fold in user searches that returned nothing.
    with conn.cursor() as cur:
        cur.execute("SELECT normalized, display, miss_count FROM skill_query_misses")
        misses = {row["normalized"]: row for row in cur.fetchall()}

    for key, row in misses.items():
        if key in known or key in blocked:
            continue
        display.setdefault(key, row["display"])
        docs.setdefault(key, 0)

    # Upsert candidates.
    upserted = 0
    with conn.cursor() as cur:
        for key, doc_count in docs.items():
            alias_of, similarity = _best_alias_match(display[key], canonicals)
            if similarity < ALIAS_SIMILARITY:
                alias_of, similarity = None, similarity
            cur.execute(
                """
                INSERT INTO skill_candidates
                    (normalized, display, doc_count, company_count, query_count,
                     suggested_alias_of, similarity, sample_contexts, last_seen_at)
                VALUES
                    (%(normalized)s, %(display)s, %(doc_count)s, %(company_count)s,
                     %(query_count)s, %(alias_of)s, %(similarity)s, %(samples)s, now())
                ON CONFLICT (normalized) DO UPDATE SET
                    doc_count     = EXCLUDED.doc_count,
                    company_count = EXCLUDED.company_count,
                    query_count   = EXCLUDED.query_count,
                    last_seen_at  = now()
                WHERE skill_candidates.status = 'pending';
                """,
                {
                    "normalized": key,
                    "display": display[key],
                    "doc_count": doc_count,
                    "company_count": len(companies.get(key, ())),
                    "query_count": misses.get(key, {}).get("miss_count", 0),
                    "alias_of": alias_of,
                    "similarity": round(similarity, 3),
                    "samples": samples.get(key, []),
                },
            )
            upserted += 1
    conn.commit()
    logger.info("Upserted %d candidates", upserted)


def auto_promote(conn) -> None:
    """Promotes only what clears the thresholds. Everything else waits for a
    human. The asymmetry is deliberate: a missed alias costs one unmatched
    spelling, a wrong canonical skill becomes a permanent bad filter facet."""
    with conn.cursor() as cur:
        # --- aliases of skills we already have: low risk, promote freely
        cur.execute(
            """
            SELECT normalized, display, suggested_alias_of FROM skill_candidates
            WHERE status = 'pending' AND suggested_alias_of IS NOT NULL
              AND similarity >= %(sim)s AND doc_count >= %(docs)s
            """,
            {"sim": ALIAS_SIMILARITY, "docs": ALIAS_MIN_DOCS},
        )
        aliases = cur.fetchall()
        for row in aliases:
            cur.execute(
                "INSERT INTO skill_aliases (normalized, display, canonical, origin) "
                "VALUES (%(n)s, %(d)s, %(c)s, 'mined') ON CONFLICT DO NOTHING",
                {"n": row["normalized"], "d": row["display"], "c": row["suggested_alias_of"]},
            )
            cur.execute(
                "UPDATE skill_candidates SET status='promoted', reviewed_at=now() "
                "WHERE normalized = %(n)s",
                {"n": row["normalized"]},
            )

        # --- brand-new skills: need breadth across employers, OR real user
        #     demand that is actually satisfiable by existing inventory
        cur.execute(
            """
            SELECT normalized, display FROM skill_candidates
            WHERE status = 'pending' AND suggested_alias_of IS NULL
              AND (
                    (doc_count >= %(min_docs)s AND company_count >= %(min_cos)s)
                 OR (query_count >= %(min_q)s  AND doc_count >= %(q_docs)s)
              )
            """,
            {
                "min_docs": NEW_SKILL_MIN_DOCS,
                "min_cos": NEW_SKILL_MIN_COMPANIES,
                "min_q": QUERY_BACKED_MIN_SEARCHES,
                "q_docs": QUERY_BACKED_MIN_DOCS,
            },
        )
        new_skills = cur.fetchall()
        for row in new_skills:
            cur.execute(
                "INSERT INTO skills (canonical, normalized, origin) "
                "VALUES (%(d)s, %(n)s, 'mined') ON CONFLICT DO NOTHING",
                {"d": row["display"], "n": row["normalized"]},
            )
            cur.execute(
                "UPDATE skill_candidates SET status='promoted', reviewed_at=now() "
                "WHERE normalized = %(n)s",
                {"n": row["normalized"]},
            )
    conn.commit()
    logger.info("Auto-promoted %d aliases and %d new skills", len(aliases), len(new_skills))


def report(conn) -> None:
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT display, doc_count, company_count, query_count,
                   suggested_alias_of, similarity
            FROM skill_candidates WHERE status = 'pending'
            ORDER BY company_count DESC, doc_count DESC LIMIT 40
            """
        )
        print("\nPending candidates (top 40 by employer breadth)")
        print(f"{'term':28} {'docs':>6} {'firms':>6} {'srch':>5}  alias-of")
        for row in cur.fetchall():
            alias = f"{row['suggested_alias_of']} ({row['similarity']})" if row["suggested_alias_of"] else "-"
            print(f"{row['display'][:28]:28} {row['doc_count']:6} {row['company_count']:6} "
                  f"{row['query_count']:5}  {alias}")

        # Unmet demand — searched for, but present in NO description. Do not
        # promote these; they are a scraping-coverage signal, not a
        # vocabulary gap. Feeding them into taxonomy.STREAM_QUERIES is the
        # action that actually helps.
        cur.execute(
            """
            SELECT m.display, m.miss_count
            FROM skill_query_misses m
            LEFT JOIN skill_candidates c ON c.normalized = m.normalized
            WHERE COALESCE(c.doc_count, 0) = 0
            ORDER BY m.miss_count DESC LIMIT 20
            """
        )
        rows = cur.fetchall()
        if rows:
            print("\nUnmet demand — users searched, no posting mentions it.")
            print("Do NOT add these to the vocabulary; they would never match.")
            print("Consider adding them to taxonomy.STREAM_QUERIES instead.\n")
            for row in rows:
                print(f"  {row['display'][:34]:34} {row['miss_count']:5} searches")


def main() -> None:
    load_dotenv()
    parser = argparse.ArgumentParser(description="Grow the skill vocabulary from real data.")
    parser.add_argument("--scan", type=int, default=0, metavar="N",
                        help="scan N most recent descriptions for candidates")
    parser.add_argument("--no-auto", action="store_true", help="find candidates but promote nothing")
    parser.add_argument("--report", action="store_true", help="show the pending queue and exit")
    parser.add_argument("--promote", nargs="*", default=[], metavar="TERM")
    parser.add_argument("--reject", nargs="*", default=[], metavar="TERM")
    args = parser.parse_args()

    conn = connect()
    try:
        for term in args.promote:
            key = normalize(term)
            with conn.cursor() as cur:
                cur.execute(
                    "INSERT INTO skills (canonical, normalized, origin) "
                    "VALUES (%(d)s, %(n)s, 'manual') ON CONFLICT DO NOTHING",
                    {"d": term, "n": key},
                )
                cur.execute(
                    "UPDATE skill_candidates SET status='promoted', reviewed_at=now() "
                    "WHERE normalized=%(n)s", {"n": key},
                )
            logger.info("Promoted %r", term)

        for term in args.reject:
            key = normalize(term)
            with conn.cursor() as cur:
                # Blocklisted, not just rejected — otherwise the next run
                # re-proposes it and you review the same noise forever.
                cur.execute(
                    "INSERT INTO skill_blocklist (normalized, reason) "
                    "VALUES (%(n)s, 'manual reject') ON CONFLICT DO NOTHING",
                    {"n": key},
                )
                cur.execute(
                    "UPDATE skill_candidates SET status='rejected', reviewed_at=now() "
                    "WHERE normalized=%(n)s", {"n": key},
                )
            logger.info("Rejected and blocklisted %r", term)

        if args.promote or args.reject:
            conn.commit()

        if args.scan:
            mine(conn, args.scan)
            if not args.no_auto:
                auto_promote(conn)

        if args.report or not (args.scan or args.promote or args.reject):
            report(conn)
    finally:
        conn.close()


if __name__ == "__main__":
    main()
