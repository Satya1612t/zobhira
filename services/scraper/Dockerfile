FROM python:3.12-slim-bookworm
WORKDIR /app

COPY pyproject.toml ./
COPY scrapers ./scrapers
COPY feeds ./feeds
COPY db ./db
COPY utils ./utils
COPY scripts ./scripts
COPY api.py scheduler.py contest_scheduler.py feed_scheduler.py skill_miner_scheduler.py format_scheduler.py designation_classifier.py taxonomy.py role_aliases.py ./

RUN pip install --no-cache-dir -e .
# No `playwright install` anymore — the last browser-driven scraper
# (YCombinator) was retired and playwright/scrapegraphai dropped from
# pyproject.toml (the plan's §9). Every remaining source is a plain
# HTTP/JSON API, so no Chromium (and its ~400 MB of OS deps) is needed.

EXPOSE 8000
CMD ["uvicorn", "api:app", "--host", "0.0.0.0", "--port", "8000"]
