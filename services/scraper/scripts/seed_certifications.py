"""Loads db/seeds/certifications.csv into certifications (upsert on slug).

Deliberately the same shape as scripts/seed_registry.py — but note what this
script is NOT: there is no scraper, no scheduler and no provider connector
for certifications. The catalogue is small (a few hundred rows at most) and
changes slowly, so a human curates it and this script just loads the file.
Safe to re-run any time; existing rows are updated in place, not duplicated.

    python -m scripts.seed_certifications
    python -m scripts.seed_certifications --file db/seeds/certifications.csv
    python -m scripts.seed_certifications --publish   # go live immediately

Rows land as publish_status='draft' by default, on purpose: seeded prices
and URLs have not been checked by anyone yet, and a wrong price on a live
page is worse than an empty page. Verify in the admin UI, then publish.
`--publish` exists for local dev, where an empty page is just annoying.
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

# Pipe, not comma: tags and highlights are multi-value fields living inside
# a comma-separated file, and highlights are human sentences that will
# eventually contain commas.
LIST_SEPARATOR = "|"

VALID_LEVELS = {"beginner", "intermediate", "advanced"}
VALID_PRICE_TYPES = {"free", "freemium", "paid"}


def _default_csv_path() -> Path:
    """Walk up to find db/seeds/certifications.csv — same reason as
    seed_registry.py: the file sits at a different depth in local dev
    (services/scraper/scripts/…) than in the Docker image (/app/scripts/…),
    so hardcoding parents[N] breaks in one of the two."""
    here = Path(__file__).resolve()
    for parent in here.parents:
        candidate = parent / "db" / "seeds" / "certifications.csv"
        if candidate.exists():
            return candidate
    return here.parent / "db" / "seeds" / "certifications.csv"


DEFAULT_CSV_PATH = _default_csv_path()

# COALESCE on the four curated/editorial columns is the important bit: an
# admin who fixes a price or writes a better summary in the UI must not have
# that work wiped out the next time someone re-runs the seed. The CSV is the
# bootstrap, the database is the source of truth once a human has touched it.
_UPSERT_SQL = """
INSERT INTO certifications (
    slug, title, provider, provider_slug, category, tags, level,
    price_type, price_amount, price_currency, duration_hours,
    url, summary, highlights, is_featured, display_order, publish_status
)
VALUES (
    %(slug)s, %(title)s, %(provider)s, %(provider_slug)s, %(category)s, %(tags)s, %(level)s,
    %(price_type)s, %(price_amount)s, %(price_currency)s, %(duration_hours)s,
    %(url)s, %(summary)s, %(highlights)s, %(is_featured)s, %(display_order)s, %(publish_status)s
)
ON CONFLICT (slug) DO UPDATE SET
    title          = EXCLUDED.title,
    provider       = EXCLUDED.provider,
    provider_slug  = EXCLUDED.provider_slug,
    category       = EXCLUDED.category,
    tags           = EXCLUDED.tags,
    level          = EXCLUDED.level,
    price_type     = EXCLUDED.price_type,
    url            = EXCLUDED.url,
    is_featured    = EXCLUDED.is_featured,
    display_order  = EXCLUDED.display_order,
    -- Human-edited fields: keep whatever is already in the DB.
    price_amount   = COALESCE(certifications.price_amount, EXCLUDED.price_amount),
    duration_hours = COALESCE(certifications.duration_hours, EXCLUDED.duration_hours),
    summary        = COALESCE(certifications.summary, EXCLUDED.summary),
    highlights     = CASE WHEN certifications.highlights = '{}'
                          THEN EXCLUDED.highlights ELSE certifications.highlights END,
    updated_at     = now();
"""


def _split_list(value: str | None) -> list[str]:
    if not value:
        return []
    return [part.strip() for part in value.split(LIST_SEPARATOR) if part.strip()]


def _optional_number(value: str | None, cast):
    text = (value or "").strip()
    if not text:
        return None
    try:
        return cast(text)
    except ValueError:
        logger.warning("Could not parse %r as a number, storing NULL", value)
        return None


def seed_from_csv(csv_path: Path, *, publish: bool = False) -> tuple[int, int]:
    publish_status = "published" if publish else "draft"
    conn = connect()
    saved = 0
    skipped = 0
    try:
        with csv_path.open(newline="", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            with conn.cursor() as cur:
                for line_no, row in enumerate(reader, start=2):
                    slug = (row.get("slug") or "").strip()
                    title = (row.get("title") or "").strip()
                    url = (row.get("url") or "").strip()

                    # Minimum viable row. Anything without these three can't
                    # be shown or clicked, so it's a data-entry mistake worth
                    # shouting about rather than silently storing.
                    if not slug or not title or not url:
                        logger.warning("Line %d: missing slug/title/url, skipping", line_no)
                        skipped += 1
                        continue

                    level = (row.get("level") or "beginner").strip().lower()
                    if level not in VALID_LEVELS:
                        logger.warning("Line %d: unknown level %r, defaulting to 'beginner'", line_no, level)
                        level = "beginner"

                    price_type = (row.get("price_type") or "free").strip().lower()
                    if price_type not in VALID_PRICE_TYPES:
                        logger.warning("Line %d: unknown price_type %r, defaulting to 'free'", line_no, price_type)
                        price_type = "free"

                    price_amount = _optional_number(row.get("price_amount"), float)
                    # A paid row with no price still gets stored — it shows up
                    # in the admin's unverified queue as "price needed", which
                    # is exactly the list of things to go and look up.
                    if price_type == "paid" and price_amount is None:
                        logger.info("Line %d (%s): paid with no price yet — needs a look", line_no, slug)

                    cur.execute(
                        _UPSERT_SQL,
                        {
                            "slug": slug,
                            "title": title,
                            "provider": (row.get("provider") or "").strip(),
                            "provider_slug": (row.get("provider_slug") or "").strip(),
                            "category": (row.get("category") or "other").strip(),
                            "tags": _split_list(row.get("tags")),
                            "level": level,
                            "price_type": price_type,
                            "price_amount": price_amount,
                            "price_currency": (row.get("price_currency") or "INR").strip() or "INR",
                            "duration_hours": _optional_number(row.get("duration_hours"), int),
                            "url": url,
                            "summary": (row.get("summary") or "").strip() or None,
                            "highlights": _split_list(row.get("highlights")),
                            "is_featured": (row.get("is_featured") or "").strip().lower() == "true",
                            "display_order": _optional_number(row.get("display_order"), int) or 100,
                            "publish_status": publish_status,
                        },
                    )
                    saved += 1
        conn.commit()
    finally:
        conn.close()
    return saved, skipped


def main() -> None:
    load_dotenv()
    parser = argparse.ArgumentParser(description="Seed certifications from a CSV file.")
    parser.add_argument("--file", type=Path, default=DEFAULT_CSV_PATH)
    parser.add_argument(
        "--publish",
        action="store_true",
        help="Insert as published instead of draft (local dev convenience only).",
    )
    args = parser.parse_args()

    saved, skipped = seed_from_csv(args.file, publish=args.publish)
    logger.info(
        "Seeded/updated %d certification row(s) (%d skipped) from %s as %s",
        saved, skipped, args.file, "published" if args.publish else "draft",
    )


if __name__ == "__main__":
    main()
