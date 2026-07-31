"""Loads SEED_SKILL_ALIASES into the `skills` / `skill_aliases` tables.

    python -m scripts.seed_skills          # insert what's missing
    python -m scripts.seed_skills --reset  # wipe seed-origin rows and reload

Run ONCE after migration 0020. From then on the database is the vocabulary
and utils/skill_vocab.py's dict is dead weight kept only as a cold-start
fallback (so tests and the eval harness work without a database).

Never overwrites rows whose origin is 'mined', 'query' or 'manual' — those
came from real data or a human decision and outrank the hardcoded seed.
--reset only clears origin='seed' rows for exactly that reason.
"""

from __future__ import annotations

import argparse
import logging
import sys

from dotenv import load_dotenv

sys.path.insert(0, ".")

from db.repository import connect  # noqa: E402
from utils.skill_vocab import (  # noqa: E402
    SEED_AMBIGUOUS,
    SEED_CONTEXT_REQUIRED,
    SEED_SKILL_ALIASES,
    normalize,
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s: %(message)s")
logger = logging.getLogger(__name__)


def seed(conn, reset: bool) -> None:
    with conn.cursor() as cur:
        if reset:
            cur.execute("DELETE FROM skill_aliases WHERE origin = 'seed'")
            cur.execute("DELETE FROM skills WHERE origin = 'seed'")
            logger.info("Cleared seed-origin rows (mined/query/manual rows kept)")

        skills = aliases = 0
        for canonical, alias_list in SEED_SKILL_ALIASES.items():
            cur.execute(
                """
                INSERT INTO skills (canonical, normalized, origin, ambiguous, context_required)
                VALUES (%(c)s, %(n)s, 'seed', %(amb)s, %(ctx)s)
                ON CONFLICT (canonical) DO NOTHING
                """,
                {
                    "c": canonical,
                    "n": normalize(canonical),
                    "amb": canonical in SEED_AMBIGUOUS,
                    "ctx": SEED_CONTEXT_REQUIRED.get(canonical, []),
                },
            )
            skills += cur.rowcount

            for alias in alias_list:
                cur.execute(
                    """
                    INSERT INTO skill_aliases (normalized, display, canonical, origin)
                    VALUES (%(n)s, %(d)s, %(c)s, 'seed')
                    ON CONFLICT (normalized) DO NOTHING
                    """,
                    {"n": normalize(alias), "d": alias, "c": canonical},
                )
                aliases += cur.rowcount
    conn.commit()

    with conn.cursor() as cur:
        cur.execute("SELECT count(*) AS n FROM skills WHERE status='active'")
        total_skills = cur.fetchone()["n"]
        cur.execute("SELECT count(*) AS n FROM skill_aliases")
        total_aliases = cur.fetchone()["n"]
    logger.info(
        "Inserted %d skills and %d aliases. Vocabulary now: %d canonical, %d aliases.",
        skills, aliases, total_skills, total_aliases,
    )


def main() -> None:
    load_dotenv()
    parser = argparse.ArgumentParser(description="Seed the skill vocabulary tables.")
    parser.add_argument("--reset", action="store_true", help="clear seed-origin rows first")
    args = parser.parse_args()

    conn = connect()
    try:
        seed(conn, args.reset)
    finally:
        conn.close()


if __name__ == "__main__":
    main()
