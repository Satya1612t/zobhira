"""Loads db/seeds/company_registry.csv into company_registry (upsert on
slug). Run once to bootstrap the pilot's 20 companies; safe to re-run any
time to pick up additions to the CSV (existing rows are updated in place,
not duplicated).

    python -m scripts.seed_registry
    python -m scripts.seed_registry --file db/seeds/company_registry.csv
"""

from __future__ import annotations

import argparse
import csv
import logging
from pathlib import Path

from dotenv import load_dotenv

from db.repository import connect

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
logger = logging.getLogger(__name__)

DEFAULT_CSV_PATH = Path(__file__).resolve().parents[3] / "db" / "seeds" / "company_registry.csv"

_UPSERT_SQL = """
INSERT INTO company_registry (name, slug, ats_provider, ats_token, careers_url, country_hint, tier)
VALUES (%(name)s, %(slug)s, %(ats_provider)s, %(ats_token)s, %(careers_url)s, %(country_hint)s, %(tier)s)
ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    ats_provider = EXCLUDED.ats_provider,
    ats_token = EXCLUDED.ats_token,
    careers_url = EXCLUDED.careers_url,
    country_hint = EXCLUDED.country_hint,
    tier = EXCLUDED.tier,
    is_active = true;
"""


def seed_from_csv(csv_path: Path) -> int:
    conn = connect()
    count = 0
    try:
        with csv_path.open(newline="", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            with conn.cursor() as cur:
                for row in reader:
                    cur.execute(
                        _UPSERT_SQL,
                        {
                            "name": row["name"].strip(),
                            "slug": row["slug"].strip(),
                            "ats_provider": row["ats_provider"].strip(),
                            "ats_token": row["ats_token"].strip(),
                            "careers_url": (row.get("careers_url") or "").strip() or None,
                            "country_hint": (row.get("country_hint") or "IN").strip() or "IN",
                            "tier": int(row.get("tier") or 2),
                        },
                    )
                    count += 1
        conn.commit()
    finally:
        conn.close()
    return count


def main() -> None:
    load_dotenv()
    parser = argparse.ArgumentParser(description="Seed company_registry from a CSV file.")
    parser.add_argument("--file", type=Path, default=DEFAULT_CSV_PATH)
    args = parser.parse_args()

    count = seed_from_csv(args.file)
    logger.info("Seeded/updated %d company_registry row(s) from %s", count, args.file)


if __name__ == "__main__":
    main()
