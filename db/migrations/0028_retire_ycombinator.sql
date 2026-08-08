-- Retire the YCombinator scraper — the last browser-driven (Playwright)
-- source. Its coverage is increasingly duplicated by the Lever/Ashby feeds
-- (most YC companies hire on those), and retiring it lets Playwright +
-- ScrapeGraphAI be dropped from the image entirely (the plan's §9). Its
-- scraper module + scheduler wiring are already deleted in code; this drops
-- its runtime footprint in the DB, same as 0027 did for LinkedIn/Talentd.
UPDATE jobs SET is_active = false WHERE source = 'ycombinator' AND is_active = true;

DELETE FROM scraper_sources WHERE name = 'ycombinator';
