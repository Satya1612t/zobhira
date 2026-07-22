# How the job scrapers work: scraping, formatting, saving to DB

## Shared pipeline (all sources go through this)

Every scraper implements the same interface (`scrapers/base.py`):
- `scrape_list(query, location)` — fast pass, builds the basic list (title/company/location/URL) without visiting each job's page.
- `enrich(postings, detail_limit)` — slow pass, visits individual job pages to fill in description/logo/date, capped at `detail_limit` (currently 25) postings per query so it doesn't take forever.
- `scrape()` — just calls both in sequence, used by the CLI/scheduler.

After scraping, `scripts/run_scrape.py::run_source()` does the same steps for every source, in order:
1. **Freshness filter** — drops postings confirmed older than 15 days (keeps ones with no date at all, since some sources never expose one).
2. **Tag classification** — matches the title against a 58-designation list to tag it (e.g. "Backend Engineer", "Data Scientist"), regardless of what query found it.
3. **Mandatory-field check** — discards anything missing title, company, description, location, or a source URL. This is the strict rule — no description, no save.
4. **Logo backfill** — best-effort lookup if the scraper didn't already find one.
5. **Dedup + save** — hashes (company, title, location) into a dedup key; if it's a new key, inserts; if it matches an existing active job closely (fuzzy title match, same company), skips as a duplicate; otherwise refreshes the existing row.
6. One database commit for the whole batch (not per-job, for speed).

## LinkedIn (the main source)
- Real server-side search — builds an actual LinkedIn search URL per query/location, with a 24-hour recency filter baked in (`f_TPR=r86400`) and an India geo-ID, so it's always pulling jobs posted in the last day.
- List pass grabs title/company/location/date from the search results page.
- Enrich pass visits each job's own page (up to 25 per query) to pull the real description and logo.
- About 1 in 5 enriched jobs still comes back with no usable description (dead/expired listing) — those get dropped by the mandatory-field rule.
- Scraped daily, plus a smaller supplementary sweep 3x/week that re-runs whatever people actually searched for on the site.

## RemoteOK, Talentd, YCombinator (lower-volume sources)
- None of these have a real server-side search — they each just load one fixed page/API response and filter client-side by matching the query against the title. So looping many different search terms against them is pointless; they're swept once per run with no query filter, and the tag-classification step recovers per-role labeling afterward.
- RemoteOK is the cleanest: it's a public JSON API, so the list pass gets everything (description, tags, date) in one shot with no per-job page visits — its "enrich" step is a no-op.
- Talentd and YCombinator need the detail-page enrich pass like LinkedIn does, since their list view alone doesn't have full descriptions.
- Scraped every 2–3 days rather than daily, since they're low-volume niche boards with little new content day to day.

## What happens when a deterministic scraper fails
If a source's expected page structure breaks, each scraper can fall back to an LLM-driven extraction pass instead (via FreeLLMAPI first, then direct Gemini/Anthropic/OpenAI as backup) — same mandatory-field rule applies afterward regardless of which path produced the data.
