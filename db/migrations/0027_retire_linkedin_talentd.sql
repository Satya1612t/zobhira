-- Retire the LinkedIn and Talentd v1 scrapers (the plan's §9 endgame) — the
-- v2 feed layer + aggregators now cover their role with cleaner, direct-apply
-- data. Their scraper modules and scheduler wiring are already deleted in
-- code; this drops their runtime footprint in the DB:
--   1. deactivate any of their still-live jobs (the source-agnostic 30-day
--      reaper would eventually age them out anyway, but there's no reason to
--      keep serving them once the scraper that produced them is gone)
--   2. remove their scraper_sources rows so the admin enable/disable UI stops
--      listing sources that can no longer run
UPDATE jobs SET is_active = false WHERE source IN ('linkedin', 'talentd') AND is_active = true;

DELETE FROM scraper_sources WHERE name IN ('linkedin', 'talentd');
