"""Second-phase LLM formatting pass over jobs already in the DB.

The feed/scrape ingest saves every job with a *deterministically* cleaned
`formatted_description` (plain text) so it's visible on the portal right away.
This pass then upgrades those rows to the richer LLM-structured JSON
(overview / responsibilities / requirements / …) that FormattedJobDescription
renders as sections — decoupled from ingest so a slow/limited LLM never holds
up (or hides) a job.

    # format everything still on the deterministic (plain-text) version
    python -m scripts.format_jobs

    # bounded run (what the scheduler uses)
    python -m scripts.format_jobs --limit 200

How "still needs LLM formatting" is detected without a schema change: an
LLM-formatted row's `formatted_description` is a JSON object (starts with
'{'); a deterministic-only row is plain text. So a row is a candidate while
its formatted_description is NULL or doesn't start with '{'. Once the LLM
succeeds it becomes JSON and drops out of the candidate set on its own.

Resumable: keyset-paginated by descending id, so a run only ever moves
forward and an interrupt loses at most the current batch. LLM billing is via
the self-hosted FreeLLMAPI router (see scrapers/llm_fallback.py); a run stops
early if the provider chain fails repeatedly (circuit breaker), leaving the
untouched rows as candidates for the next pass.
"""

from __future__ import annotations

import argparse
import json
import logging
import re
import sys

from dotenv import load_dotenv

sys.path.insert(0, ".")

from db.repository import connect  # noqa: E402
from utils.job_formatter import BREAKER_THRESHOLD, format_job_description  # noqa: E402

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
logger = logging.getLogger(__name__)

BATCH_SIZE = 100

# Below this word count the source description is treated as a short snippet
# (typical of the Adzuna/Jooble/Careerjet aggregators, whose full JD lives
# behind a redirecting apply link) — we attach a note pointing the reader to
# the apply link for the complete listing rather than pretending the snippet
# is the whole job.
SHORT_DESC_WORDS = 60
# A trailing ellipsis is an explicit truncation marker: some boards cut the JD
# mid-sentence ("…working closely with senior team members …") while still
# leaving it well over SHORT_DESC_WORDS, so word count alone misses these.
# Treat any description that ends in "…" or "..." as truncated regardless of
# length.
_TRUNCATED_RE = re.compile(r"(\.\.\.|…)\s*$")
SOURCE_NOTE_TEXT = (
    "This is a condensed summary from the original listing. Click Apply to "
    "view the complete job description and all details."
)

_SELECT_SQL = """
    SELECT id, description
    FROM jobs
    WHERE is_active = true
      AND description IS NOT NULL AND btrim(description) <> ''
      AND (formatted_description IS NULL OR left(btrim(formatted_description), 1) <> '{')
      -- Cast the keyset cursor so Postgres can infer its type on the first
      -- page, when it's NULL (an untyped NULL param used only in IS NULL /
      -- comparisons has no inferable type — "could not determine data type").
      -- jobs.id is a UUID; its byte-order total order makes keyset paging by
      -- `id < cursor` / `ORDER BY id DESC` stable and correct.
      AND (%(last_id)s::uuid IS NULL OR id < %(last_id)s::uuid)
    ORDER BY id DESC
    LIMIT %(limit)s
"""

_UPDATE_SQL = """
    UPDATE jobs
    SET formatted_description = %(formatted_description)s,
        highlights = %(highlights)s
    WHERE id = %(id)s
"""


_COUNT_SQL = """
    SELECT count(*) AS n
    FROM jobs
    WHERE is_active = true
      AND description IS NOT NULL AND btrim(description) <> ''
      AND (formatted_description IS NULL OR left(btrim(formatted_description), 1) <> '{')
"""


def count_pending() -> int:
    """How many visible jobs are still on the deterministic (plain-text)
    description, i.e. the LLM formatting backlog. Used by the admin card."""
    conn = connect()
    try:
        with conn.cursor() as cur:
            cur.execute(_COUNT_SQL)
            return cur.fetchone()["n"]
    finally:
        conn.close()


def _source_note(description: str | None) -> str | None:
    text = (description or "").strip()
    words = len(re.findall(r"\S+", text))
    if words < SHORT_DESC_WORDS or _TRUNCATED_RE.search(text):
        return SOURCE_NOTE_TEXT
    return None


def run(limit: int | None = None, batch_size: int = BATCH_SIZE) -> dict:
    """Formats up to `limit` candidate jobs (all of them if None). Returns
    {"processed", "formatted", "tripped"} for the scheduler's progress view."""
    conn = connect()
    processed = 0
    formatted = 0
    breaker = {"consecutive_failures": 0, "tripped": False}
    last_id = None  # UUID keyset cursor (jobs.id); None on the first page
    try:
        while limit is None or processed < limit:
            batch = min(batch_size, (limit - processed)) if limit else batch_size
            with conn.cursor() as cur:
                cur.execute(_SELECT_SQL, {"last_id": last_id, "limit": batch})
                rows = cur.fetchall()
            if not rows:
                break

            for row in rows:
                last_id = row["id"]
                processed += 1
                note = _source_note(row["description"])
                try:
                    result = format_job_description(row["description"], use_llm=True, source_note=note)
                except Exception as exc:  # noqa: BLE001
                    logger.warning("Formatting failed for id=%s: %s", row["id"], exc)
                    result = {"llm_used": False}

                if not result.get("llm_used"):
                    # LLM didn't actually structure this one (provider failure
                    # or an empty model reply) — leave the row on its
                    # deterministic version for a later pass to retry.
                    breaker["consecutive_failures"] += 1
                    if breaker["consecutive_failures"] >= BREAKER_THRESHOLD:
                        breaker["tripped"] = True
                        break
                    continue

                breaker["consecutive_failures"] = 0
                with conn.cursor() as cur:
                    cur.execute(
                        _UPDATE_SQL,
                        {
                            "id": row["id"],
                            "formatted_description": result["formatted_description"],
                            "highlights": result["highlights"],
                        },
                    )
                formatted += 1

            conn.commit()
            logger.info("Formatting: processed=%d formatted=%d", processed, formatted)
            if breaker["tripped"] or len(rows) < batch:
                break
    finally:
        conn.close()

    if breaker["tripped"]:
        logger.warning("Formatting stopped early: LLM provider chain failing repeatedly")
    logger.info("Done. processed=%d formatted=%d", processed, formatted)
    return {"processed": processed, "formatted": formatted, "tripped": breaker["tripped"]}


# Already-structured (JSON) rows that qualify for the source note but predate
# the note logic: truncated/short but no "sourceNote" key. The pass in run()
# never revisits a '{'-row, so these can only be reached here.
_REFRESH_SELECT_SQL = """
    SELECT id, description, formatted_description
    FROM jobs
    WHERE is_active = true
      AND description IS NOT NULL AND btrim(description) <> ''
      AND left(btrim(formatted_description), 1) = '{'
      AND formatted_description NOT LIKE '%%sourceNote%%'
      AND (%(last_id)s::uuid IS NULL OR id < %(last_id)s::uuid)
    ORDER BY id DESC
    LIMIT %(limit)s
"""


def refresh_truncated(limit: int | None = None, batch_size: int = BATCH_SIZE) -> dict:
    """Backfill the source note onto already-structured jobs that are
    truncated/short but were formatted before the note logic existed.

    Does NOT call the LLM — the structure is already there, so it just injects
    the "sourceNote" key into the existing JSON. Fast and spends zero quota.
    Only rows _source_note() still classifies as truncated/short are touched;
    everything else is left exactly as-is. Returns {"processed", "updated"}."""
    conn = connect()
    processed = 0
    updated = 0
    last_id = None  # UUID keyset cursor (jobs.id); None on the first page
    try:
        while limit is None or processed < limit:
            batch = min(batch_size, (limit - processed)) if limit else batch_size
            with conn.cursor() as cur:
                cur.execute(_REFRESH_SELECT_SQL, {"last_id": last_id, "limit": batch})
                rows = cur.fetchall()
            if not rows:
                break

            for row in rows:
                last_id = row["id"]
                processed += 1
                note = _source_note(row["description"])
                if not note:
                    continue  # not actually truncated/short — leave it alone
                try:
                    data = json.loads(row["formatted_description"])
                except (json.JSONDecodeError, TypeError):
                    continue
                if not isinstance(data, dict) or data.get("sourceNote"):
                    continue
                data["sourceNote"] = note
                with conn.cursor() as cur:
                    cur.execute(
                        "UPDATE jobs SET formatted_description = %(fd)s WHERE id = %(id)s",
                        {"fd": json.dumps(data), "id": row["id"]},
                    )
                updated += 1

            conn.commit()
            logger.info("Refresh truncated: processed=%d updated=%d", processed, updated)
            if len(rows) < batch:
                break
    finally:
        conn.close()

    logger.info("Done. processed=%d updated=%d", processed, updated)
    return {"processed": processed, "updated": updated}


def main() -> None:
    load_dotenv()
    parser = argparse.ArgumentParser(description="LLM-format jobs still on the deterministic description.")
    parser.add_argument("--limit", type=int, default=None, help="stop after N jobs (default: all)")
    parser.add_argument(
        "--refresh-truncated", action="store_true",
        help="backfill the source note onto already-structured truncated/short jobs (no LLM call)",
    )
    args = parser.parse_args()
    if args.refresh_truncated:
        refresh_truncated(limit=args.limit)
    else:
        run(limit=args.limit)


if __name__ == "__main__":
    main()
