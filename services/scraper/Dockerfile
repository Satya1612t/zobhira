FROM python:3.12-slim-bookworm
WORKDIR /app

COPY pyproject.toml ./
COPY scrapers ./scrapers
COPY db ./db
COPY utils ./utils
COPY scripts ./scripts
COPY api.py scheduler.py contest_scheduler.py designation_classifier.py taxonomy.py ./

RUN pip install --no-cache-dir -e .
# Installs Chromium plus every OS-level dependency it needs in one step
# (Playwright's own recommended approach) — avoids hand-listing apt
# packages that could drift from whatever Playwright version
# pyproject.toml pins.
RUN playwright install --with-deps chromium

EXPOSE 8000
CMD ["uvicorn", "api:app", "--host", "0.0.0.0", "--port", "8000"]
