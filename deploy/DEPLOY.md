# Deploying to a single EC2 instance with Docker Compose

This runs the full stack — Postgres, the scraper API (with both background
schedulers), the Next.js web app, a separate Firebase-authenticated admin app,
a self-hosted FreeLLMAPI instance, self-hosted OpenWA (WhatsApp API) and n8n
(workflow automation), and an Nginx reverse proxy with automatic Let's
Encrypt TLS — as Docker containers on one EC2 instance, via
`docker-compose.prod.yml` at the repo root.

This is a config/runbook only — it doesn't run itself. You (or a CI pipeline) apply it
on the actual instance.

## Prerequisites

- **Instance size**: recommend **t3.medium or larger** (2 vCPU / 4 GB RAM minimum).
  This box runs Postgres, FreeLLMAPI, the scraper API, Next.js, and a headless Chromium
  instance all at once — Chromium in particular can spike memory during concurrent
  LinkedIn detail-page scraping, so more headroom avoids OOM kills.
- **Security group**: open **80 and 443 only**. Postgres (5432), the scraper API
  (8000), FreeLLMAPI (3001), and **OpenWA (2785)** are never published to the host —
  only n8n (5678) reaches the outside world through nginx-proxy on 80/443, alongside
  `web`/`admin`. OpenWA deliberately stays unpublished: its docker-socket-proxy sidecar
  grants it container-creation rights (needed for its per-session sidecars), which is
  equivalent to root on this host, so it never gets a public URL — see the comment on
  the `openwa` service in `docker-compose.prod.yml`.
- **Domain**: `zobhira.com`, `admin.zobhira.com`, and `n8n.zobhira.com` each need
  their own A record pointed at the instance's public IP before first boot, or Let's
  Encrypt issuance will fail for that one. Each gets issued its own cert independently.
  OpenWA needs no domain at all (see above).

## One-time setup

1. Install Docker + the Compose plugin (Ubuntu):
   ```
   sudo apt-get update
   sudo apt-get install -y docker.io docker-compose-plugin
   sudo usermod -aG docker $USER   # log out/in after this
   ```
2. Clone the repo onto the instance and `cd` into it.
3. ```
   cp .env.production.example .env
   ```
   Fill in every value — generate `POSTGRES_PASSWORD`, `FREELLMAPI_ENCRYPTION_KEY`,
   `OPENWA_API_MASTER_KEY`, and `N8N_ENCRYPTION_KEY` with `openssl rand -hex 32` each,
   and `N8N_BASIC_AUTH_PASSWORD` with `openssl rand -hex 20`.
   `DOMAIN`/`ADMIN_DOMAIN`/`N8N_DOMAIN`/`ACME_EMAIL` are required; the LLM keys can
   stay blank for now (see step 5).
4. ```
   docker compose -f docker-compose.prod.yml up -d --build
   ```
   **Migrations only auto-apply on a brand-new Postgres volume** (mounted into
   `docker-entrypoint-initdb.d`, which Postgres only runs once, on an empty data
   directory) — same caveat as local dev. Any migration file added *after* this first
   boot needs to be applied manually:
   ```
   docker compose -f docker-compose.prod.yml exec -T postgres \
     psql -U postgres -d job_portal < db/migrations/000X_something.sql
   ```
5. **FreeLLMAPI's first-run setup code.** Its dashboard is opened from your own laptop
   browser, not from the EC2 box itself, which means it will ask for a one-time setup
   code (not just plain signup) the first time you try to create an account — printed
   once in its container logs:
   ```
   docker compose -f docker-compose.prod.yml logs freellmapi | grep -i "setup code"
   ```
   Use that code to create the account at `https://<your-domain-or-instance>` — actually
   FreeLLMAPI isn't published to the host, so reach its dashboard by temporarily
   forwarding the port over SSH instead of exposing it publicly:
   ```
   ssh -L 3001:localhost:3001 <ec2-user>@<instance-ip>
   ```
   then open `http://localhost:3001` in your own browser. Add a couple of free-provider
   keys (Groq, Gemini, OpenRouter — see FreeLLMAPI's own README), copy its unified key,
   put it in `.env` as `FREELLMAPI_API_KEY`, then:
   ```
   docker compose -f docker-compose.prod.yml up -d scraper
   ```
   to pick up the new value.
6. **OpenWA — link a WhatsApp number.** Not published to the host (see the security-group
   note above), so reach its dashboard the same way as FreeLLMAPI's — an SSH tunnel:
   ```
   ssh -L 2785:localhost:2785 <ec2-user>@<instance-ip>
   ```
   then open `http://localhost:2785`, sign in with `OPENWA_API_MASTER_KEY`, create a
   session, and scan the QR code with the WhatsApp account you want this to send/receive
   as (Linked Devices → Link a Device). n8n workflows reach it internally at
   `http://openwa:2785` — no tunnel needed there. See OpenWA's own README
   (https://github.com/rmyndharis/OpenWA) for its REST API shape once a session is connected.
7. **n8n — first login.** Visit `https://$N8N_DOMAIN` and sign in with
   `N8N_BASIC_AUTH_USER`/`N8N_BASIC_AUTH_PASSWORD`. From there it's n8n's own UI —
   build workflows, add credentials (its stored-credential encryption uses
   `N8N_ENCRYPTION_KEY`, so back that value up somewhere safe, not just in `.env` on
   this one instance).

## Verifying

```
docker compose -f docker-compose.prod.yml ps                # all should be healthy/running
docker compose -f docker-compose.prod.yml logs -f web        # tail the web app
```
Visit `https://$DOMAIN` and confirm it loads with a valid Let's Encrypt certificate
(the browser padlock, not a warning page). Do the same for `https://$ADMIN_DOMAIN`
(should redirect to its Google-sign-in login page) and `https://$N8N_DOMAIN`. OpenWA
has no public URL to check — confirm it's up instead with
`docker compose -f docker-compose.prod.yml logs openwa`.

## Redeploying after a code change

```
git pull
docker compose -f docker-compose.prod.yml up -d --build web admin scraper
```
Only rebuilds the three application images — Postgres, FreeLLMAPI, OpenWA, n8n, and
the proxy containers are untouched and keep running (and keep their data). To pick up
a newer OpenWA or n8n release instead:
```
docker compose -f docker-compose.prod.yml pull openwa n8n
docker compose -f docker-compose.prod.yml up -d openwa n8n
```

## Triggering scrapes on a fresh, empty database

Same manual trigger endpoints already documented in the main `README.md`
(`POST /scheduler/trigger/{source}`, `POST /contests/scheduler/trigger/dev_community`,
etc.) — just hit them through `https://$ADMIN_DOMAIN/scheduler` instead of localhost
(the admin app is where the scheduler UI now lives, not the public site's `/progress`).
