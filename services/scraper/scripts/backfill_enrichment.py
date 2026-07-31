"""Backfills the new derived columns over rows already in the database.

    # deterministic only, safe and fast — run this first, on everything
    python -m scripts.backfill_enrichment --no-llm

    # then let the LLM close the gaps, rate-limited and resumable
    python -m scripts.backfill_enrichment --llm --limit 500

    # re-run just the rows a bad prompt revision touched
    python -m scripts.backfill_enrichment --llm --only-source llm --limit 500

Designed to be interrupted and restarted. Progress is durable in the rows
themselves (enriched_at / exp_source), not in a cursor file, so a killed run
loses at most one batch.

RUN ORDER MATTERS. Do the --no-llm pass over the whole table before any
--llm pass: the deterministic extractors resolve the large majority of rows
for free, and every row they resolve is a row you do not pay an LLM to read.
Running --llm first would spend real money re-deriving what a regex was
about to give you.
"""

from __future__ import annotations

import argparse
import logging
import sys

from dotenv import load_dotenv

sys.path.insert(0, ".")

from db.repository import connect  # noqa: E402
from utils.field_enrichment import enrich_posting  # noqa: E402

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
logger = logging.getLogger(__name__)

BATCH_SIZE = 200

_UPDATE_SQL = """
UPDATE jobs SET
    tags             = %(tags)s,
    tags_norm        = %(tags_norm)s,
    min_years_exp    = %(min_years_exp)s,
    max_years_exp    = %(max_years_exp)s,
    experience_band  = %(experience_band)s,
    exp_source       = %(exp_source)s,
    employment_type  = COALESCE(%(employment_type)s, employment_type),
    workplace_type   = %(workplace_type)s,
    field_provenance = %(field_provenance)s,
    enrichment_hash  = %(enrichment_hash)s,
    enriched_at      = now()
WHERE id = %(id)s;
"""


class _Row:
    """Adapter giving a DB row the same attribute surface enrich_posting()
    expects from a JobPosting, so the backfill and the live ingest path run
    the exact same code. Any divergence between them would mean backfilled
    rows and freshly-scraped rows get classified differently — which is the
    kind of inconsistency that is very hard to debug later."""

    __slots__ = (
        "id", "title", "company", "location", "description", "tags", "raw",
        "workplace_type", "employment_type", "salary_min", "salary_max",
        "min_years_exp", "max_years_exp", "experience_band", "exp_source",
        "tags_norm", "field_provenance", "enrichment_hash",
    )

    def __init__(self, row: dict) -> None:
        self.id = row["id"]
        self.title = row["title"]
        self.company = row["company"]
        self.location = row["location"]
        self.description = row["description"]
        self.tags = list(row["tags"] or [])
        self.raw = dict(row.get("raw") or {})
        self.workplace_type = row["workplace_type"]
        self.employment_type = row["employment_type"]
        self.salary_min = row["salary_min"]
        self.salary_max = row["salary_max"]
        self.min_years_exp = None
        self.max_years_exp = None
        self.experience_band = None
        self.exp_source = None
        self.tags_norm = []
        self.field_provenance = {}
        self.enrichment_hash = None


def _select_sql(use_llm: bool, only_source: str | None) -> str:
    # Deterministic pass: everything not yet touched.
    # LLM pass: only rows the deterministic pass could not resolve, and only
    # those with enough text to be worth reading.
    if not use_llm:
        where = "enriched_at IS NULL"
    else:
        where = (
            "experience_band IN ('unknown') "
            "AND description IS NOT NULL "
            "AND array_length(regexp_split_to_array(btrim(description), '\\s+'), 1) >= 30"
        )
    if only_source:
        where += " AND exp_source = %(only_source)s"
    return f"""
        SELECT id, title, company, location, description, tags, raw,
               workplace_type, employment_type, salary_min, salary_max
        FROM jobs
        WHERE is_active = true AND {where}
        ORDER BY first_seen_at DESC
        LIMIT %(limit)s
    """


def run(use_llm: bool, limit: int | None, only_source: str | None) -> None:
    import psycopg

    conn = connect()
    processed = 0
    changed = 0
    try:
        while limit is None or processed < limit:
            batch = min(BATCH_SIZE, (limit - processed) if limit else BATCH_SIZE)
            with conn.cursor() as cur:
                cur.execute(
                    _select_sql(use_llm, only_source),
                    {"limit": batch, "only_source": only_source},
                )
                rows = cur.fetchall()
            if not rows:
                break

            for raw_row in rows:
                row = _Row(raw_row)
                try:
                    enrich_posting(row, use_llm=use_llm)
                except Exception as exc:  # noqa: BLE001
                    logger.warning("Enrichment failed for id=%s: %s", row.id, exc)
                    continue

                with conn.cursor() as cur:
                    cur.execute(
                        _UPDATE_SQL,
                        {
                            "id": row.id,
                            "tags": row.tags,
                            "tags_norm": row.tags_norm,
                            "min_years_exp": row.min_years_exp,
                            "max_years_exp": row.max_years_exp,
                            "experience_band": row.experience_band,
                            "exp_source": row.exp_source,
                            "employment_type": row.employment_type,
                            "workplace_type": row.workplace_type,
                            "field_provenance": psycopg.types.json.Json(row.field_provenance),
                            "enrichment_hash": row.enrichment_hash,
                        },
                    )
                changed += 1

            # Commit per batch, not per row (one fsync per row dominates
            # wall-clock at these volumes) and not per whole run (so an
            # interrupt keeps the work already done).
            conn.commit()
            processed += len(rows)
            logger.info("Backfilled %d rows (%d updated) so far", processed, changed)

            if len(rows) < batch:
                break
    finally:
        conn.close()

    logger.info("Done. processed=%d updated=%d llm=%s", processed, changed, use_llm)


def main() -> None:
    load_dotenv()
    parser = argparse.ArgumentParser(description="Backfill derived job fields.")
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--no-llm", action="store_true", help="deterministic only (run this first)")
    group.add_argument("--llm", action="store_true", help="LLM gap-fill for unresolved rows")
    parser.add_argument("--limit", type=int, default=None, help="stop after N rows")
    parser.add_argument("--only-source", default=None,
                        choices=["title", "description", "llm", "none"],
                        help="restrict to rows whose exp_source is this")
    args = parser.parse_args()

    run(use_llm=args.llm, limit=args.limit, only_source=args.only_source)


if __name__ == "__main__":
    main()
