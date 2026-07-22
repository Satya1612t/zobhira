import argparse
import logging
from datetime import datetime, timedelta, timezone

from dotenv import load_dotenv

from db.repository import connect, reap_stale

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
logger = logging.getLogger(__name__)


def main() -> None:
    load_dotenv()
    parser = argparse.ArgumentParser(
        description="Deactivate jobs not touched by any scrape in N days, across all sources."
    )
    parser.add_argument("--days", type=int, default=30)
    args = parser.parse_args()

    cutoff = datetime.now(timezone.utc) - timedelta(days=args.days)
    conn = connect()
    try:
        affected = reap_stale(conn, cutoff)
    finally:
        conn.close()
    logger.info("Deactivated %d job(s) not scraped in the last %d day(s)", affected, args.days)


if __name__ == "__main__":
    main()
