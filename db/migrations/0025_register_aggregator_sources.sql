-- v2 Stage 5 aggregators. Same admin enable/disable toggle as every other
-- feed source (db/migrations/0024). Query-driven (India index searched by
-- keyword), not company_registry-driven like the ATS providers — see
-- services/scraper/feeds/providers/adzuna.py. jooble/careerjet registered
-- ahead of their connectors so the toggle exists the moment they ship.
INSERT INTO scraper_sources (name, family) VALUES
    ('adzuna','job'), ('jooble','job'), ('careerjet','job')
ON CONFLICT (name) DO NOTHING;
