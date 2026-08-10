# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

**Zobhira** — a searchable job/contest board for the Indian market that aggregates technical roles
and hackathons, with an optional self-hosted LLM pass for cleaner descriptions. Two ingestion
approaches share one `jobs` table: the **v2 feed layer** (the primary path — reads companies'
public hiring-board JSON APIs and job-search aggregators directly, no browser) and a shrinking set
of **v1 scrapers** (now just Himalayas for jobs + DEV Community for contests). Three
independently-run pieces sharing one Postgres database:

- **`apps/web`** — Next.js 14 (App Router) public site. Job/contest search UI, Prisma client.
- **`apps/admin`** — separate Next.js 14 app, own Prisma client against the *same* Postgres DB.
  Firebase-authenticated (`requireAdmin`) management UI: jobs/contests CRUD, scraper source
  enable/disable, a **Companies** page (add/enable/remove feed companies by pasting a careers URL —
  auto-detects the ATS), live scheduler progress + manual triggers. Runs on its own port/subdomain,
  never as a path on the public site.
- **`services/scraper`** — Python microservice (httpx-based; **no Playwright/ScrapeGraphAI** — both
  removed with the last browser-driven scraper). Writes directly to Postgres. `api.py` is a FastAPI
  app that also runs four background schedulers in-process and exposes on-demand endpoints. The name
  is now a misnomer (it's mostly feed connectors, not scrapers) but hasn't been renamed yet.

`db/migrations/*.sql` (plain numbered SQL files) is the schema source of truth — `apps/web` and
`apps/admin` each have their own `prisma/schema.prisma` mirroring it, so a schema change means
editing the SQL migration **and** both Prisma schemas, then regenerating both clients.

No automated test suite exists in this repo (no test runner configured in either `package.json`,
no `pytest`/test files under `services/scraper`) — don't invent test commands.

## Commands

**Local dev bring-up** (see README.md for full detail):
```bash
docker compose up -d                          # Postgres only; schema auto-applies on a fresh volume

cd services/scraper
pip install -e .                              # no `playwright install` anymore — no browser deps
python -m uvicorn api:app --port 8000         # runs all four schedulers + on-demand endpoints

cd apps/web && npm install && npx prisma generate && npm run dev   # :3000
cd apps/admin && npm install && npx prisma generate && npm run dev # :3002 (Firebase-gated; set the
                                                                   # FIREBASE_* + ADMIN_ALLOWED_EMAILS
                                                                   # env vars, or it can't sign in)
```

**Web/admin** (identical scripts in both `apps/web` and `apps/admin`):
```bash
npm run dev      # apps/web -> :3000, apps/admin -> :3002 (hardcoded via -p)
npm run build
npm run lint      # next lint
npx tsc --noEmit -p tsconfig.json   # typecheck — run this after any edit, no separate `typecheck` script exists
npx prisma generate                 # after any schema.prisma change
```

**Applying a new DB migration to an existing (non-fresh) volume:**
```bash
psql -h localhost -U postgres -d job_portal -f db/migrations/00XX_something.sql
```

**Ingestion** (manual one-off runs; the API's schedulers are the normal path):
```bash
cd services/scraper
# v2 feed layer (the primary path) — ATS boards + aggregators:
python -m scripts.run_feed --provider greenhouse --dry-run --no-llm  # preview, writes nothing
python -m scripts.run_feed --provider greenhouse --no-llm            # live (--no-llm while LLM billing is blocked)
python -m scripts.seed_registry                                      # load db/seeds/company_registry.csv
python -m scripts.detect_ats --url https://acme.com/careers --write  # auto-detect a company's ATS + add it
# v1 scrapers (only Himalayas for jobs remains) + contests:
python -m scripts.run_scrape --source himalayas --query "software engineer"
python -m scripts.run_contest_scrape --source dev_community
```
Don't run `scheduler.py`/`contest_scheduler.py`/`feed_scheduler.py` standalone alongside `api.py` —
each has its own in-process lock, so a second standalone process risks two concurrent sweeps of the
same family.

**Production:** `docker-compose.prod.yml` (full stack + Nginx/Let's Encrypt) — see
`deploy/DEPLOY.md`. The root `docker-compose.yml` (Postgres only) is local-dev-only, untouched by
prod changes.

## Architecture

### Scraper pipeline (`services/scraper`)
Every job scraper implements `scrapers/base.py`: `scrape_list()` (fast, no per-job navigation) +
`enrich()` (slow, visits each job's detail page, capped by `detail_limit`); `scrape()` composes
both. Contests use the simpler `scrapers/contest_base.py` (one bounded `scrape()`, no
query/location/detail_limit — a contest feed is "what's currently open," not keyword-searched).

**The v2 feed layer (`services/scraper/feeds/`) is the primary ingestion path** — see its own
section below. It reads companies' public hiring-board JSON APIs (Greenhouse/Lever/Ashby/
SmartRecruiters/Workable/Recruitee, keyed off the `company_registry` table) plus job-search
aggregators (Adzuna/Jooble/Careerjet, key-gated, query-driven). No browser, structured data, direct
apply links.

Remaining v1 scrapers: **Himalayas** only (remote-only board, plain JSON API — tag-classified after
the fact against the 58-designation list in `taxonomy.py`/`designation_classifier.py`). Contests:
**DEV Community** only (RSS/JSON feed). **LinkedIn, Talentd and YCombinator were retired** once the
feed layer covered their role with cleaner direct-apply data — and with the last browser-driven
scraper (YC) gone, **Playwright + ScrapeGraphAI were removed entirely**. Naukri/Indeed/RemoteOK/
Devpost were removed earlier — see README.md "Notes" for why (bot detection, gated apply links,
missing description field) before re-adding any of them. Because the retired scrapers were the only
per-query "live search" sources, the on-demand live-search endpoints now no-op over an empty source
list.

Every posting passes a mandatory-field guardrail before it's stored
(`scripts/run_scrape.py::has_mandatory_fields` / `scripts/run_contest_scrape.py`) — jobs need
title/company/location/source_url (missing description → saved as a backfillable "stub," not
discarded); contests need title/description/start/end dates with the end date not already passed.
Dedup is hash-based: jobs on `(company, title, location)` with a fuzzy trigram fallback; contests
on `(platform, source_url)`, no fuzzy fallback.

`scrapers/llm_fallback.py` is the shared LLM path (`run_text_completion` only now — the
ScrapeGraphAI/Playwright `run_smart_scraper` path was removed with the browser scrapers) used by
two independent features (contest description restructuring at scrape time; on-demand job
description formatting via `POST /jobs/{id}/format-description`, cached in the DB after first view)
— tries a self-hosted FreeLLMAPI instance first (aggregates free-tier quotas across ~29 providers),
then falls through to direct Gemini/Anthropic/OpenAI keys. All optional; deterministic ingestion is
the primary path and works with none of them configured. (LLM billing is currently blocked across
all three direct providers, so both scheduled feed runs and the scheduler default to `use_llm=False`
— formatting still produces real content via deterministic cleanup, it just skips AI classification.)

`api.py` runs **five** independent APScheduler instances (jobs: `scheduler.py`, now Himalayas-only
daily; contests: `contest_scheduler.py`; skill vocabulary mining: `skill_miner_scheduler.py`,
weekly; **v2 feeds: `feed_scheduler.py`, tiered by `company_registry.tier` — tier 1 every 15 min,
tier 2 hourly, tier 3 daily, plus a daily apply-click auto-tiering pass that promotes the
most-clicked companies to tier 1**; **LLM description formatting: `format_scheduler.py`, every
`FEED_FORMAT_INTERVAL_MIN` (default 30 min)**) plus reap jobs (deactivate stale/expired jobs;
**delete** expired contests outright, since a past-deadline contest has nothing left to register
for) and a daily `prune_analytics_job` (trims `page_view`/`apply_click` past their retention window
— see `apps/web`'s analytics bullet above). Manual trigger + progress endpoints exist per source
(incl. `/feeds/scheduler/trigger/{provider}`, `/jobs/formatting/trigger`) and for the skill miner.

**Description formatting is a decoupled two-phase pipeline.** Ingest (feeds + v1) always writes a
*deterministic* cleaned `formatted_description` (plain text) so a job is visible on the portal
immediately (the portal only shows jobs where `formatted_description IS NOT NULL` —
`jobQuery.ts`). The second-phase `format_scheduler.py` pass (`scripts/format_jobs.py`) then rolls
over the DB and *upgrades* those to the LLM-structured JSON (overview/responsibilities/… sections)
via the FreeLLMAPI router, so a slow/limited LLM never blocks or hides a job. Candidates are found
migration-free: an LLM-formatted row's `formatted_description` is a JSON object (starts with `{`),
a deterministic-only row is plain text, so `WHERE formatted_description IS NULL OR NOT LIKE '{%'`
selects exactly the not-yet-upgraded rows. Aggregator/short-source jobs get a `sourceNote` embedded
in the JSON pointing to the apply link for the full JD (rendered by `FormattedJobDescription.tsx`)
— the LLM restructures what's there but never fabricates a fuller description. **Gotcha:** the feed
upsert preserves the existing `formatted_description` on re-poll (`COALESCE(jobs., EXCLUDED.)`) so a
15-min tier-1 re-poll can't clobber an LLM upgrade back down to plain text.

### v2 feed layer (`services/scraper/feeds/`) — the primary ingestion path
Additive, fully separate code path from the frozen v1 scrapers (its own HTTP client, upsert, and
scheduler), but writes to the **same `jobs` table** using the same `dedup_key` identity (so a feed
row and a v1 row for the real same job merge onto one row).
- **`feed_base.py::FeedScraper`** subclasses `scrapers/base.py::BaseJobScraper` — reuses the
  `JobPosting` contract so every downstream consumer is identical. `FeedJobPosting` adds the three
  feed-only columns (`apply_url`/`external_id`/`company_id`, see `db/migrations/0023`).
- **`providers/*.py`** — one connector per source. ATS boards (greenhouse/lever/ashby/
  smartrecruiters/workable/recruitee) are company-driven: they loop `company_registry` rows for
  their provider. Aggregators (adzuna/jooble/careerjet) override `scrape_list()` to be query-driven
  (loop `taxonomy.STREAM_QUERIES` against the India index), are key-gated (env vars; skip if unset),
  daily-only (they rate-limit), and set `raw.flagged_indirect = true` on every posting since their
  apply links redirect through the aggregator — which `quality_score` docks −15 for (`0026`), so
  they rank below direct ATS jobs.
- **`feed_http.py`** — own httpx client with **conditional GET** (`If-None-Match`/`If-Modified-Since`
  per company, stored on `company_registry`); a 304 means "nothing changed, skip." This is what
  makes 15-min tier-1 polling affordable (~95% of polls are free 304s). **Gotcha:** truncating the
  `jobs` table without also clearing `company_registry.etag`/`last_modified` makes the next run 304
  everything and repopulate almost nothing — clear both together.
- **`company_registry`** (`0022`) is the "which companies to poll" table: name/slug/ats_provider/
  ats_token/tier. Grown via `scripts/seed_registry.py` (from `db/seeds/company_registry.csv`) or
  `scripts/detect_ats.py` (auto-detects a company's ATS + token from just a careers URL, verifies
  against the live board, upserts) — the latter is wired into the admin **Companies** page.
- **`run_feed.py`** filters every posting on the raw `location` string via
  `_feed_location_is_eligible`: keeps India-located roles **and truly-global-remote** ones
  (location literally says worldwide/anywhere/global), while a country-qualifier guard still drops
  scoped remote (`Remote - US`/`EMEA`/`APAC`) and bare `Remote`. Deliberately NOT reusing
  `run_scrape.py::is_india_or_remote`, which trusts description-inferred `workplace_type` — unsafe
  for verbose ATS descriptions that mention "remote" while being country-restricted), then
  enriches (shared `enrich_posting`), formats (`format_job_description`, which yields real content
  even with no LLM), backfills logos (`find_logo_url`), and upserts. `--no-llm` skips the LLM steps.

### Web app (`apps/web`)
- **Route groups**: `src/app/(main)/*` is every public page (home, `/jobs`, `/jobs/[id]`,
  `/contest`, `/contest/[id]`, `/live`, `/profile`, `/login`, `/about`, `/contact`, `/privacy`) —
  all rendered inside the shared `AppShell` (Sidebar + Navbar + `.main-scroll-area` + Footer),
  wired in `app/(main)/layout.tsx`. `/login` hides the Sidebar (see `AppShell.tsx`'s `hideSidebar`
  check) but still gets Navbar/Footer.
- **`AppShell.tsx`** owns two independent open/closed states passed down to `Sidebar`: mobile
  off-canvas drawer (`sidebarOpen`) vs. desktop icon-only/expanded toggle (`desktopExpanded`,
  72px↔264px, driven by CSS classes in `globals.css` + a `main-content-expanded` class that shifts
  `.main-content`'s `margin-left` to match). These are orthogonal — don't conflate them.
- **No Tailwind** — despite most Stitch-mockup HTML using Tailwind classes, this app translates
  every design into the existing CSS-custom-property system (`globals.css` `:root` tokens:
  `--color-accent`, `--ink`, `--surface`, `--line`, `--radius`, `--font-display`/`--font-mono`,
  plus shared classes like `.card`, `.tag`, `.btn`). When porting a Stitch screen, re-derive the
  Tailwind spacing/colors into these tokens — never add the Tailwind CDN script.
  `apps/web/src/app/globals.css`'s `:root` block is the single source of truth for the current
  palette; **DESIGN.md predates this palette and is being kept in sync manually** — read
  `globals.css` directly if the two ever disagree.
- **Query building lives in `src/lib`**, not in components: `jobQuery.ts` (search/filter/sort →
  Prisma `where`/`orderBy`, recent-searches tracking, trigram-based "did you mean" suggestions),
  `contestQuery.ts` (same shape for contests), `jobInsights.ts` (regex-based extraction — tech
  keywords, experience level, email — used both by the UI and by the dispatch API's LLM-fallback
  decision), `dispatchAuth.ts`/`dispatchLlm.ts` (n8n-facing dispatch API support, see below).
- **Third-party/scraper branding is intentionally not surfaced to end users** — no "via LinkedIn"
  badges, no platform-name filter pills on `/contest`, generic copy on About/Privacy. `job.source`/
  `contest.platform` exist as DB/filter fields only, never rendered as visible text. Keep this
  invariant when adding new UI that touches scraped content.
- **`/api/dispatch/{pending,mark-posted}`** — a small shared-secret-gated (`X-Dispatch-Key`, see
  `dispatchAuth.ts`) API surface for an external n8n workflow to poll unposted jobs/contests and
  mark them posted (e.g. to Telegram), tracked via the `DispatchLog` model
  (`(contentType, contentId, platform)` unique, retry-safe on `postedAt IS NULL`). Not used by the
  web UI itself.
- **First-party analytics** (`db/migrations/0021`, no third-party script): `src/middleware.ts`
  assigns `zb_vid`/`zb_sid` cookies and resolves `zb_src` (UTM/referrer attribution) once per
  session; `<Analytics/>` (root `layout.tsx`, in Suspense) fires page views to `POST /api/track`,
  `JobDetailActions`/`ContestDetailActions` fire apply/register clicks the same way. Written to
  `PageView`/`ApplyClick` (`page_view`/`apply_click` tables) — `traffic_source` there is the
  *visitor's* origin (instagram/google/direct), never confused with `jobs.source`/
  `contests.platform` (the scraper origin, internal-only per the invariant above). Read by
  `apps/admin`'s `GET /api/analytics` (see below). Pruned on a schedule — see `services/scraper`
  section.
- **Stitch integration**: Stitch mockups (accessed via the `mcp__stitch__*` tools, project
  "Dynamic Recruitment Portal") are the design reference for most pages/components — screens are
  ported faithfully (content, structure) but always re-implemented in this app's own token system,
  and any real brand-name company logos in a mockup get swapped for either real scraped data or
  generic placeholders (see `CareerExcellenceSection.tsx` for the pattern: real jobs instead of
  fake Apple/Google/Amazon cards, generic text wordmarks instead of real employer logos).

### Admin app (`apps/admin`)
Firebase Auth-gated (`requireAdmin`) **including locally** — sign-in needs the `NEXT_PUBLIC_FIREBASE_*`
+ `FIREBASE_ADMIN_*` env vars set and the caller's email in `ADMIN_ALLOWED_EMAILS`, or login fails.
(Google sign-in is popup-based, so `next.config.js` sets `Cross-Origin-Opener-Policy:
same-origin-allow-popups` — without it the OAuth popup can't hand the token back and login breaks
with "Invalid or expired token".) Same Prisma-over-Postgres pattern as `apps/web` but its own
`schema.prisma`/client. Surfaces: jobs/contests CRUD, `ScraperSource` enable/disable, scheduler
progress + manual trigger proxying through to the scraper API (`SCRAPER_API_URL`) — including a
**Feeds** section and a **Companies** page (add/enable/remove `company_registry` companies by
pasting a careers URL, which proxies to the scraper's `POST /feeds/companies/detect`), link-health
checking, and an `/analytics` dashboard (`GET /api/analytics` — visitors/sources/top-clicked
listings/daily trend, all `::int`-cast to avoid BigInt-vs-`NextResponse.json()` crashes) reading
the `page_view`/`apply_click` tables `apps/web` writes. **BigInt note:** `company_registry.id` is a
Postgres BIGINT → Prisma `BigInt`, which `NextResponse.json()` can't serialize — cast to `Number()`
before returning it (see the jobs detail + companies routes). Don't expose port 3002 beyond
localhost in dev.

## Repo layout
```
apps/web            Next.js public site
apps/admin          Next.js admin/management app (separate Prisma client, same DB)
services/scraper    Python ingestion microservice + FastAPI schedulers/API. `feeds/` is the v2
                    feed layer (primary path); the top-level scrapers are the v1 remnant (Himalayas
                    + DEV Community). Name kept for now despite being mostly feeds, not scrapers.
db/migrations       Numbered SQL migrations — schema source of truth
deploy/DEPLOY.md    Production EC2/Docker runbook
docker-compose.yml       Postgres-only, local dev
docker-compose.prod.yml  Full stack + Nginx/Let's Encrypt, production
n8n/                Workflow definitions for the dispatch-to-Telegram automation
```
