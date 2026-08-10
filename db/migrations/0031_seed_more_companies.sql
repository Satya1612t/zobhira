-- Add 40 more feed companies to company_registry (61 -> 101). Same rationale
-- and idempotent shape as 0030_seed_companies.sql: seeded via a psql migration
-- because the scraper Docker image's build context is services/scraper/, so the
-- repo-root db/seeds/company_registry.csv is never in the image. Also appended
-- to that CSV for local-dev parity.
--
-- Every ats_token here was verified live against its public board API
-- (boards-api.greenhouse.io / api.lever.co / api.ashbyhq.com /
-- api.smartrecruiters.com) and confirmed to currently return India-located
-- roles. Tiers reflect India-role volume at add time: tier 1 = 20+ India roles,
-- tier 2 = 5-19, tier 3 = <5 (the daily apply-click auto-tiering pass adjusts
-- these over time regardless). Re-running updates in place.
INSERT INTO company_registry (name, slug, ats_provider, ats_token, careers_url, country_hint, tier) VALUES
    ('Pure Storage', 'purestorage', 'greenhouse', 'purestorage', 'https://boards.greenhouse.io/purestorage', 'IN', 1),
    ('Coupang', 'coupang', 'greenhouse', 'coupang', 'https://boards.greenhouse.io/coupang', 'IN', 1),
    ('Freshworks', 'freshworks', 'smartrecruiters', 'Freshworks', 'https://careers.smartrecruiters.com/Freshworks', 'IN', 1),
    ('Tide', 'tide', 'greenhouse', 'tide', 'https://boards.greenhouse.io/tide', 'IN', 1),
    ('Zeta Global', 'zeta-global', 'greenhouse', 'zetaglobal', 'https://boards.greenhouse.io/zetaglobal', 'IN', 1),
    ('Fictiv', 'fictiv', 'greenhouse', 'fictiv', 'https://boards.greenhouse.io/fictiv', 'IN', 1),
    ('Toast', 'toast', 'greenhouse', 'toast', 'https://boards.greenhouse.io/toast', 'IN', 1),
    ('Instawork', 'instawork', 'greenhouse', 'instawork', 'https://boards.greenhouse.io/instawork', 'IN', 1),
    ('Netskope', 'netskope', 'greenhouse', 'netskope', 'https://boards.greenhouse.io/netskope', 'IN', 1),
    ('Glean', 'glean', 'greenhouse', 'gleanwork', 'https://boards.greenhouse.io/gleanwork', 'IN', 1),
    ('Harness', 'harness', 'greenhouse', 'harnessinc', 'https://boards.greenhouse.io/harnessinc', 'IN', 2),
    ('SolarWinds', 'solarwinds', 'greenhouse', 'solarwinds', 'https://boards.greenhouse.io/solarwinds', 'IN', 2),
    ('Kong', 'kong', 'ashby', 'kong', 'https://jobs.ashbyhq.com/kong', 'IN', 2),
    ('Roblox', 'roblox', 'greenhouse', 'roblox', 'https://boards.greenhouse.io/roblox', 'IN', 2),
    ('Smartsheet', 'smartsheet', 'greenhouse', 'smartsheet', 'https://boards.greenhouse.io/smartsheet', 'IN', 2),
    ('Zuora', 'zuora', 'greenhouse', 'zuora', 'https://boards.greenhouse.io/zuora', 'IN', 2),
    ('Razorpay', 'razorpay', 'greenhouse', 'razorpaysoftwareprivatelimited', 'https://boards.greenhouse.io/razorpaysoftwareprivatelimited', 'IN', 2),
    ('Commvault', 'commvault', 'greenhouse', 'commvault', 'https://boards.greenhouse.io/commvault', 'IN', 2),
    ('Workato', 'workato', 'greenhouse', 'workato', 'https://boards.greenhouse.io/workato', 'IN', 2),
    ('Bosch', 'bosch', 'smartrecruiters', 'BoschGroup', 'https://careers.smartrecruiters.com/BoschGroup', 'IN', 2),
    ('Couchbase', 'couchbase', 'greenhouse', 'couchbaseinc', 'https://boards.greenhouse.io/couchbaseinc', 'IN', 2),
    ('SmartBear', 'smartbear', 'greenhouse', 'smartbear', 'https://boards.greenhouse.io/smartbear', 'IN', 2),
    ('Sumo Logic', 'sumologic', 'greenhouse', 'sumologic', 'https://boards.greenhouse.io/sumologic', 'IN', 2),
    ('Turing', 'turing', 'greenhouse', 'turing', 'https://boards.greenhouse.io/turing', 'IN', 2),
    ('Yugabyte', 'yugabyte', 'greenhouse', 'yugabyte', 'https://boards.greenhouse.io/yugabyte', 'IN', 2),
    ('Adyen', 'adyen', 'greenhouse', 'adyen', 'https://boards.greenhouse.io/adyen', 'IN', 2),
    ('SpotDraft', 'spotdraft', 'ashby', 'spotdraft', 'https://jobs.ashbyhq.com/spotdraft', 'IN', 2),
    ('Aviatrix', 'aviatrix', 'greenhouse', 'aviatrix', 'https://boards.greenhouse.io/aviatrix', 'IN', 2),
    ('Wiz', 'wiz', 'greenhouse', 'wizinc', 'https://boards.greenhouse.io/wizinc', 'IN', 2),
    ('Legion', 'legion', 'greenhouse', 'legion', 'https://boards.greenhouse.io/legion', 'IN', 2),
    ('Yext', 'yext', 'greenhouse', 'yext', 'https://boards.greenhouse.io/yext', 'IN', 2),
    ('Coursera', 'coursera', 'greenhouse', 'coursera', 'https://boards.greenhouse.io/coursera', 'IN', 3),
    ('Ubisoft', 'ubisoft', 'smartrecruiters', 'Ubisoft2', 'https://careers.smartrecruiters.com/Ubisoft2', 'IN', 3),
    ('Together AI', 'together-ai', 'greenhouse', 'togetherai', 'https://boards.greenhouse.io/togetherai', 'IN', 3),
    ('Vonage', 'vonage', 'greenhouse', 'vonage', 'https://boards.greenhouse.io/vonage', 'IN', 3),
    ('Deepgram', 'deepgram', 'ashby', 'deepgram', 'https://jobs.ashbyhq.com/deepgram', 'IN', 3),
    ('Temporal', 'temporal', 'greenhouse', 'temporaltechnologies', 'https://boards.greenhouse.io/temporaltechnologies', 'IN', 3),
    ('LaunchDarkly', 'launchdarkly', 'greenhouse', 'launchdarkly', 'https://boards.greenhouse.io/launchdarkly', 'IN', 3),
    ('Anthropic', 'anthropic', 'greenhouse', 'anthropic', 'https://boards.greenhouse.io/anthropic', 'IN', 3),
    ('Cribl', 'cribl', 'greenhouse', 'cribl', 'https://boards.greenhouse.io/cribl', 'IN', 3)
ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    ats_provider = EXCLUDED.ats_provider,
    ats_token = EXCLUDED.ats_token,
    careers_url = EXCLUDED.careers_url,
    country_hint = EXCLUDED.country_hint,
    tier = EXCLUDED.tier,
    is_active = true;
