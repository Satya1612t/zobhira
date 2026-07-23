# Job Portal

A searchable job board aggregating technical roles from LinkedIn, Y Combinator / Work at
a Startup, RemoteOK, and Talentd — plus a companion contest/hackathon aggregator sourced
from public RSS/JSON feeds (DEV Community). Both are kept fresh by background scrapers
and enriched with an optional, self-hostable LLM pass for cleaner descriptions and
highlighted facts.

## Structure
- `apps/web` — Next.js 14 (App Router) job/contest listing and search UI, Prisma + Postgres
- `apps/admin` — separate Next.js 14 app, its own Prisma client against the same Postgres
  database; unauthenticated management UI (jobs/contests CRUD, scraper source
  enable/disable, live scheduler progress + manual triggers). Deployed as its own
  container on its own subdomain, not a path on the public site — see
  [Deployment](#deployment).
- `services/scraper` — Python scraping microservice (Playwright + httpx, ScrapeGraphAI for
  LLM fallback), writes directly to Postgres; exposes a FastAPI app (`api.py`) that also
  runs the background schedulers and on-demand endpoints in-process
- `db/migrations` — plain SQL migrations, source of truth for the schema
- `deploy` — production Docker deployment runbook (see [Deployment](#deployment) below)

## Local dev

1. **Start Postgres:**
   ```
   docker compose up -d
   ```
   The schema is created automatically from `db/migrations/*.sql` on a **fresh** volume.
   If you're applying new migrations to an existing volume, run the new file(s) manually:
   ```
   psql -h localhost -U postgres -d job_portal -f db/migrations/000X_something.sql
   ```

2. **Run a scrape:**
   ```
   cd services/scraper
   pip install -e .
   playwright install chromium
   copy .env.example .env   # fill in DATABASE_URL (+ optional LLM keys, see below)
   python -m scripts.run_scrape --source ycombinator --query "software engineer"
   python -m scripts.run_scrape --source remoteok --query "software engineer"
   python -m scripts.run_scrape --source talentd --query "software engineer"
   python -m scripts.run_scrape --source linkedin --query "software engineer"
   python -m scripts.run_contest_scrape --source dev_community
   ```

3. **Run the scraper API** (needed for `/progress`, the background schedulers, and the
   on-demand LLM description formatting):
   ```
   cd services/scraper
   python -m uvicorn api:app --port 8000
   ```
   This single process runs **two** independent background schedulers (see
   [Schedulers](#schedulers) below) and exposes their live progress + manual triggers,
   surfaced in the admin app (see step 5). **Don't also run `scheduler.py` or
   `contest_scheduler.py` standalone alongside this** — each has its own lock that only
   guards within its own process, so a second standalone process risks two sweeps of the
   same family running concurrently.

4. **Run the web app:**
   ```
   cd apps/web
   npm install
   copy .env.example .env   # SCRAPER_API_URL defaults to http://localhost:8000
   npx prisma generate
   npm run dev
   ```
   Visit http://localhost:3000

5. **Run the admin app** (separate process, separate port — jobs/contests
   management, scraper source toggles, live scheduler progress):
   ```
   cd apps/admin
   npm install
   copy .env.example .env   # DATABASE_URL + SCRAPER_API_URL (defaults to localhost:8000)
   npx prisma generate
   npm run dev
   ```
   Visit http://localhost:3002 — unauthenticated, so don't expose this port beyond
   your own machine in local dev.

## Schedulers

Two separate schedulers run inside the `api.py` process, each with its own lock (a
job sweep and a contest sweep can run concurrently — neither drives Playwright at the
same volume, so there's no contention risk like there is *within* a family):

**Jobs** (`scheduler.py`) — tiered by real-world posting volume:

| Source | Cadence | Time |
|---|---|---|
| LinkedIn | Daily | 02:00 local |
| Talentd + RemoteOK | Every 2 days | 02:00 local |
| YCombinator | Every 3 days | 02:00 local |
| LinkedIn (recent user searches) | 3x/week (Mon/Wed/Fri) | 1h after the daily LinkedIn sweep finishes |
| Reap stale jobs (`is_active=false` if unscraped 30+ days) | Every 24h | — |
| Reap expired jobs (deadline passed, or 30+ days old with none) | Every 24h | — |

Manual triggers: `POST /scheduler/trigger/{source}` (`linkedin`/`talentd`/`remoteok`/
`ycombinator`), `POST /scheduler/trigger/recent-searches/linkedin`. Progress:
`GET /scheduler/progress`.

**Contests** (`contest_scheduler.py`) — currently DEV Community only (Devpost was
removed, see [Notes](#notes)):

| Source | Cadence | Time |
|---|---|---|
| DEV Community | Daily | 03:00 local |
| Reap stale contests | Every 24h | — |
| Reap expired contests (**deletes** the row, not just deactivates) | Every 24h | — |

Manual trigger: `POST /contests/scheduler/trigger/dev_community`. Progress:
`GET /contests/scheduler/progress`. Contests are deleted rather than deactivated on
expiry since a past-deadline contest has nothing left to register for.

## Scraping pipeline

Every job scraper implements the same interface (`scrapers/base.py`): `scrape_list()`
(fast — builds the list from search results, no per-job navigation) and `enrich()` (slow
— visits each job's own page for description/logo/date, capped by `detail_limit` per
query). `scrape()` composes both for CLI/scheduler use.

**LinkedIn** has a real server-side search (with a 24h recency filter and India geo-ID
baked into the URL); **RemoteOK, Talentd, and YCombinator** don't — each just loads one
fixed page/API response and is swept once per run with no query loop, since looping
queries against a client-side-only filter just re-fetches the same content. RemoteOK's
public JSON API returns everything (description, tags, date) in one shot with no
detail-page pass needed; Talentd and YCombinator need the detail-page `enrich()` pass
like LinkedIn does. Per-designation tagging is recovered afterward by classifying each
scraped title against a 58-designation list, regardless of which query found it.

Contests follow a simpler shape (`scrapers/contest_base.py`) — one bounded
`scrape()` call per source, no query/location/detail_limit concept, since a contest
platform's feed is "what's currently open," not something to keyword-search.

**Every posting goes through the same guardrail before it reaches the DB**
(`scripts/run_scrape.py::has_mandatory_fields` / `scripts/run_contest_scrape.py`):
- **Jobs** require title, company, description, location, and `source_url` — anything
  missing one gets discarded (a missing logo alone doesn't count; that's a best-effort
  backfill via `utils/logo_lookup.py`).
- **Contests** require title, description, a start date, and an end date, **and** the
  end date must not have already passed — anything missing one, or already expired, is
  discarded before it's ever stored.

Dedup for both is a hash-based upsert: jobs hash `(company, title, location)` with a
fuzzy trigram fallback (catches re-posted listings with near-identical wording); contests
hash `(platform, source_url)` with no fuzzy fallback, since a contest has one canonical
URL per platform.

## LLM-powered enrichment (optional, self-hostable, zero-cost)

Two independent features use the same shared LLM fallback path
(`scrapers/llm_fallback.py`), which tries a self-hosted
[FreeLLMAPI](https://github.com/tashfeenahmed/freellmapi) instance first — it aggregates
free-tier quotas across ~29 LLM providers with its own internal failover, no billing
needed for any of them — then falls through to direct `GEMINI_API_KEY`/
`ANTHROPIC_API_KEY`/`OPENAI_API_KEY` calls as a backup. All are optional and
independently skippable; deterministic scraping (the primary path for every source)
works with none of them configured.

To self-host FreeLLMAPI: clone it separately (not part of this repo), `docker compose up
-d`, then create the dashboard account + add a couple of free-provider keys (Groq,
Gemini, OpenRouter — see its own README) to get a unified key for this project's
`.env` (`FREELLMAPI_BASE_URL`, `FREELLMAPI_API_KEY`).

**1. Contest description restructuring** (batch, at scrape time) — every contest's raw
description gets rewritten into a clean summary plus up to 6 highlight facts (deadline,
prize, eligibility, tech focus, mode), and gap-fills `deadline_at`/`mode`/`prize_summary`
from the prose itself when the source feed didn't provide them structurally (real
feed-provided data always wins; this only fills gaps). Runs once per contest per scrape
— contest volume is low enough (tens, not hundreds) that batch processing is fine.

**2. Job description formatting** (on-demand, cached) — jobs are two orders of magnitude
higher volume than contests, so this runs the *first time* a job's detail page is
viewed, not at scrape time: the page renders instantly with the raw description, a
client component fires a background request to `POST /jobs/{id}/format-description`,
and the restructured description + highlight chips (salary, experience level, key
benefits/requirements — only when actually present) swap in once ready. The result is
cached in the DB, so every viewer after the first gets it instantly with no further LLM
call. The reformatted text preserves all original content — it's restructured for
readability, never summarized or shortened.

## Search & filters

Both the Jobs and Live Opening pages render instantly from whatever's already in
Postgres — no on-search scraping is triggered from the UI; freshness comes from the
background schedulers on their own cadence per source.

`SearchBar.tsx` — location (major Indian cities + Remote, with an "Other…" free-text
fallback), workplace type (remote/hybrid/onsite), posted-within (24h/week/month), sort
(newest/oldest), and experience level (fresher/1+/2+/3+/5+, inferred from description
text via a Postgres regex, since it isn't a real scraped field). All map onto Prisma
`where`/`orderBy` clauses in `jobQuery.ts` — no client-side filtering.

Misspelled searches that return zero results get a **"Did you mean…"** suggestion,
powered by Postgres trigram similarity (`pg_trgm`) against titles already in the DB —
self-improving as the DB grows, no hardcoded word list. It's a suggestion link, not an
auto-substitution.

The scraper API's on-demand live-search endpoints (`POST /scrape`, `GET /scrape/{job_id}`,
`POST /scrape/{job_id}/more`) still exist and are proxied from Next.js at `/api/scrape*`,
but aren't called automatically by any page — callable directly if you want to wire up a
live-search UI later.

## Schema

3 Prisma models (`apps/web/prisma/schema.prisma`), backed by 10 plain SQL migrations in
`db/migrations/`:
- **`Job`** — title/company/location/workplaceType/salary/source/description/
  formattedDescription/highlights/tags/postedAt/deadlineAt/logoUrl, indexed on
  `source`, `location`, `postedAt`, `tags` (GIN), and `(isActive, postedAt)`.
- **`Contest`** — title/platform/organizer/mode/prizeAmount/prizeCurrency/prizeSummary/
  source/description/summary/highlights/tags/startsAt/deadlineAt/logoUrl, indexed on
  `source`, `deadlineAt`, `tags` (GIN), and `(isActive, deadlineAt)`.
- **`SearchQuery`** — tracks every distinct search so `StreamsPanel` can surface recent
  searches as quick-access links; also feeds the scheduler's recent-searches LinkedIn sweep.

## Deployment

`docker-compose.prod.yml` at the repo root containerizes the full stack (Postgres, the
scraper API, the web app, and a self-hosted FreeLLMAPI instance) behind an Nginx reverse
proxy with automatic Let's Encrypt TLS — see **[`deploy/DEPLOY.md`](deploy/DEPLOY.md)**
for the full EC2 setup runbook. The plain `docker-compose.yml` at the root (Postgres
only) is untouched and still used for local dev as described above.

## Notes
- Deterministic parsing (CSS selectors / JSON APIs) is the default scraping path for
  every source; the LLM-driven fallback is only used when a source's expected structure
  breaks.
- **Logo / description / posted-date coverage varies by source** — most only expose full
  details on each job's individual detail page, not the search results list:
  - **RemoteOK**: description + posted date come free from the API; logos are pulled
    from the homepage (only jobs currently listed there get one).
  - **YCombinator**: logo + full description from each job's detail page. No posted date
    exists anywhere on the site — this field is always empty for YC.
  - **Talentd**: logo + full description + posted date + real numeric salary, all from a
    schema.org `JobPosting` JSON-LD block embedded in each detail page.
  - **LinkedIn**: posted date from the list view; logo + description from each job's
    detail page (a handful of listings are expired/malformed and simply have no
    description to fetch).
  - **DEV Community** (contests): no structured deadline/prize/mode at all — these are
    gap-filled from the post's own prose via the LLM pass described above when present.
- **Naukri and Indeed were removed entirely** (scrapers, config, historical rows).
  Naukri was confirmed blocked at the bot-detection level (Akamai/bot-manager-level
  403/406 + reCAPTCHA on both the site and its internal API, even with a realistic
  browser context). Indeed's detail pages were only reliably readable for the single
  page-preloaded first job per query — every other detail page hit a 403 interstitial —
  which under the mandatory-description rule left it with ~1 usable posting per query.
- **Devpost was removed as a contest source.** Its public list API returns rich
  structured metadata (prize, dates, organizer) but no free-text description field at
  all, so every Devpost posting failed the mandatory-description guardrail once it was
  tightened to match the jobs table's standard. DEV Community's RSS feed does carry
  real prose, so it remains the only contest source.
