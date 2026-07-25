-- RemoteOK removed as a source entirely — its real application link is
-- gated behind a mandatory account signup for most listings (confirmed
-- live: traced the site's obfuscated JS "apply" redirect all the way
-- through to a /sign-up?user_type=worker wall), which isn't something a
-- user can act on directly from an aggregated listing here. See
-- services/scraper/scheduler.py's top-of-file comment for the fuller
-- history (alongside the earlier Naukri/Indeed removals).
--
-- Deactivated, not deleted — same "never hard-delete a job row" convention
-- reap_expired/reap_stale already use elsewhere, in case this needs to be
-- reversed or audited later.
UPDATE jobs SET is_active = false WHERE source = 'remoteok';

DELETE FROM scraper_sources WHERE name = 'remoteok';
