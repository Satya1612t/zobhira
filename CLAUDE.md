# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

**Zobhira** — a searchable job/contest board that aggregates technical roles and hackathons from
multiple sources via background scrapers, with an optional self-hosted LLM pass for cleaner
descriptions. Three independently-run pieces sharing one Postgres database:

- **`apps/web`** — Next.js 14 (App Router) public site. Job/contest search UI, Prisma client.
- **`apps/admin`** — separate Next.js 14 app, own Prisma client against the *same* Postgres DB.
  Firebase-authenticated (`requireAdmin`) management UI: jobs/contests CRUD, scraper source
  enable/disable, live scheduler progress + manual triggers. Runs on its own port/subdomain, never
  as a path on the public site.
- **`services/scraper`** — Python microservice (Playwright + httpx, ScrapeGraphAI for LLM
  fallback). Writes directly to Postgres. `api.py` is a FastAPI app that also runs two background
  schedulers in-process and exposes on-demand endpoints.

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
pip install -e . && playwright install chromium
python -m uvicorn api:app --port 8000         # runs both schedulers + on-demand endpoints

cd apps/web && npm install && npx prisma generate && npm run dev   # :3000
cd apps/admin && npm install && npx prisma generate && npm run dev # :3002, unauthenticated locally
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

**Scraper** (manual one-off runs; the API's schedulers are the normal path):
```bash
cd services/scraper
python -m scripts.run_scrape --source linkedin --query "software engineer"
python -m scripts.run_contest_scrape --source dev_community
```
Don't run `scheduler.py`/`contest_scheduler.py` standalone alongside `api.py` — each has its own
in-process lock, so a second standalone process risks two concurrent sweeps of the same family.

**Production:** `docker-compose.prod.yml` (full stack + Nginx/Let's Encrypt) — see
`deploy/DEPLOY.md`. The root `docker-compose.yml` (Postgres only) is local-dev-only, untouched by
prod changes.

## Architecture

### Scraper pipeline (`services/scraper`)
Every job scraper implements `scrapers/base.py`: `scrape_list()` (fast, no per-job navigation) +
`enrich()` (slow, visits each job's detail page, capped by `detail_limit`); `scrape()` composes
both. Contests use the simpler `scrapers/contest_base.py` (one bounded `scrape()`, no
query/location/detail_limit — a contest feed is "what's currently open," not keyword-searched).

Current sources: **LinkedIn** (real server-side search, 24h recency filter, India geo-ID),
**Talentd**, **YCombinator**, **Himalayas** (all job boards, no real search on the latter three —
swept once per run, tag-classified after the fact against a 58-designation list in
`taxonomy.py`/`designation_classifier.py`). Contests: **DEV Community** only (RSS/JSON feed).
Naukri/Indeed/RemoteOK/Devpost were tried and removed — see README.md "Notes" for why (bot
detection, gated apply links, missing description field) before re-adding any of them.

Every posting passes a mandatory-field guardrail before it's stored
(`scripts/run_scrape.py::has_mandatory_fields` / `scripts/run_contest_scrape.py`) — jobs need
title/company/location/source_url (missing description → saved as a backfillable "stub," not
discarded); contests need title/description/start/end dates with the end date not already passed.
Dedup is hash-based: jobs on `(company, title, location)` with a fuzzy trigram fallback; contests
on `(platform, source_url)`, no fuzzy fallback.

`scrapers/llm_fallback.py` is the shared LLM path used by two independent features (contest
description restructuring at scrape time; on-demand job description formatting via
`POST /jobs/{id}/format-description`, cached in the DB after first view) — tries a self-hosted
FreeLLMAPI instance first (aggregates free-tier quotas across ~29 providers), then falls through to
direct Gemini/Anthropic/OpenAI keys. All optional; deterministic scraping is the primary path and
works with none of them configured.

`api.py` runs three independent APScheduler instances (jobs: `scheduler.py`, tiered by source
volume; contests: `contest_scheduler.py`; skill vocabulary mining: `skill_miner_scheduler.py`,
weekly) plus reap jobs (deactivate stale/expired jobs; **delete** expired contests outright, since
a past-deadline contest has nothing left to register for) and a daily `prune_analytics_job`
(trims `page_view`/`apply_click` past their retention window — see `apps/web`'s analytics bullet
above). Manual trigger + progress endpoints exist per source and for the skill miner — see
README.md "Schedulers" for the exact cadence table.

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
Firebase Auth-gated (`requireAdmin`), same Prisma-over-Postgres pattern as `apps/web` but its own
`schema.prisma`/client. Surfaces: jobs/contests CRUD, `ScraperSource` enable/disable, scheduler
progress + manual trigger proxying through to the scraper API (`SCRAPER_API_URL`), link-health
checking, and an `/analytics` dashboard (`GET /api/analytics` — visitors/sources/top-clicked
listings/daily trend, all `::int`-cast to avoid BigInt-vs-`NextResponse.json()` crashes) reading
the `page_view`/`apply_click` tables `apps/web` writes. Deliberately unauthenticated when run
locally (see README) — don't expose port 3002 beyond localhost in dev.

## Repo layout
```
apps/web            Next.js public site
apps/admin          Next.js admin/management app (separate Prisma client, same DB)
services/scraper    Python scraping microservice + FastAPI schedulers/API
db/migrations       Numbered SQL migrations — schema source of truth
deploy/DEPLOY.md    Production EC2/Docker runbook
docker-compose.yml       Postgres-only, local dev
docker-compose.prod.yml  Full stack + Nginx/Let's Encrypt, production
n8n/                Workflow definitions for the dispatch-to-Telegram automation
```
